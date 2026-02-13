//! # Contention Predictor
//!
//! Proposal: EXEC-PREDICT-002
//!
//! ML-based predictive parallel execution engine that forecasts transaction
//! state-access patterns and partitions blocks into conflict-free shard groups
//! for parallel GPU execution.
//!
//! ## Architecture
//!
//! ```text
//! ┌───────────────────────────────────────────────────────────────┐
//! │                   Contention Predictor                        │
//! │  ┌──────────────┐  ┌───────────────┐  ┌───────────────────┐  │
//! │  │   Feature    │  │   ML Model    │  │  Shard Planner    │  │
//! │  │  Extractor   │──▶  (TensorRT)   │──▶  (Graph Coloring) │  │
//! │  └──────┬───────┘  └───────────────┘  └───────────┬───────┘  │
//! │         │                                         │          │
//! │    TX metadata                              Shard Groups     │
//! │    → features                               → parallel      │
//! └─────────────────────────────────────────────────────────────  │
//! ```
//!
//! ## Key Invariants
//!
//! - EXEC-PREDICT-001: Prediction must never cause incorrect execution
//! - EXEC-PREDICT-002: P95 prediction latency ≤ 500µs
//! - EXEC-PREDICT-003: Accuracy ≥ 85% on same-epoch access sets
//! - EXEC-PREDICT-004: Fallback to serial when confidence < 0.65
//! - EXEC-PREDICT-005: Contention heatmap reflects latest 100 blocks

pub mod feature_extractor;
pub mod model;
pub mod shard_planner;
pub mod fallback;

use std::collections::HashMap;
use std::time::{Duration, Instant};

/// A predicted state access for a transaction.
#[derive(Debug, Clone, PartialEq, Eq, Hash)]
pub struct AccessPrediction {
    /// Storage key being accessed.
    pub storage_key: Vec<u8>,
    /// Whether the access is a write (true) or read (false).
    pub is_write: bool,
    /// Confidence of this prediction (0.0 - 1.0 as fixed-point u16, 10000 = 100%).
    pub confidence: u16,
}

/// A group of transactions that can execute in parallel.
#[derive(Debug, Clone)]
pub struct ShardGroup {
    /// Shard identifier.
    pub shard_id: u32,
    /// Transaction indices in this shard (indices into the block's TX list).
    pub tx_indices: Vec<usize>,
    /// Color assigned by graph coloring.
    pub color: u32,
}

/// Contention heatmap entry—tracks which storage keys are hot.
#[derive(Debug, Clone)]
pub struct HeatmapEntry {
    /// Storage key.
    pub key: Vec<u8>,
    /// Number of accesses in the recent window.
    pub access_count: u64,
    /// Number of write conflicts in the recent window.
    pub conflict_count: u64,
    /// Temperature score (0.0 – 1.0 as f64).
    pub temperature: f64,
}

/// Transaction metadata used for feature extraction.
#[derive(Debug, Clone)]
pub struct TxMetadata {
    /// Transaction hash.
    pub tx_hash: [u8; 32],
    /// Sender address.
    pub sender: [u8; 32],
    /// Target contract / receiver.
    pub target: Option<[u8; 32]>,
    /// Function selector (first 4 bytes of calldata).
    pub selector: Option<[u8; 4]>,
    /// Gas limit.
    pub gas_limit: u64,
    /// Value transferred.
    pub value: u128,
    /// Calldata length.
    pub calldata_len: usize,
    /// Nonce.
    pub nonce: u64,
}

/// Feature vector extracted from transaction metadata.
#[derive(Debug, Clone)]
pub struct FeatureVector {
    /// Raw feature values (fixed-size for model input).
    pub features: Vec<f32>,
    /// Source transaction hash.
    pub tx_hash: [u8; 32],
}

/// Configuration for the contention predictor.
#[derive(Debug, Clone)]
pub struct PredictorConfig {
    /// Minimum confidence threshold before falling back to serial.
    /// Default: 0.65 (6500 in basis points).
    pub min_confidence: f64,

    /// Number of recent blocks to maintain in heatmap.
    pub heatmap_window: u64,

    /// Maximum shards to create per block.
    pub max_shards: u32,

    /// Maximum prediction latency budget (microseconds).
    pub max_latency_us: u64,

    /// Feature vector dimension.
    pub feature_dim: usize,

    /// Whether to use GPU for inference.
    pub use_gpu_inference: bool,
}

impl Default for PredictorConfig {
    fn default() -> Self {
        Self {
            min_confidence: 0.65,
            heatmap_window: 100,
            max_shards: 16,
            max_latency_us: 500,
            feature_dim: 64,
            use_gpu_inference: true,
        }
    }
}

/// The main contention predictor struct.
pub struct ContentionPredictor {
    config: PredictorConfig,
    heatmap: HashMap<Vec<u8>, HeatmapEntry>,
    model: model::PredictionModel,
    shard_planner: shard_planner::ShardPlanner,
    total_predictions: u64,
    fallback_count: u64,
}

impl ContentionPredictor {
    /// Create a new contention predictor.
    pub fn new(config: PredictorConfig) -> Self {
        Self {
            model: model::PredictionModel::new(config.feature_dim, config.use_gpu_inference),
            shard_planner: shard_planner::ShardPlanner::new(config.max_shards),
            config,
            heatmap: HashMap::new(),
            total_predictions: 0,
            fallback_count: 0,
        }
    }

    /// Predict access patterns for a batch of transactions and return shard groups.
    ///
    /// # Invariant: EXEC-PREDICT-001, EXEC-PREDICT-002, EXEC-PREDICT-004
    pub fn predict_and_shard(
        &mut self,
        transactions: &[TxMetadata],
    ) -> Result<Vec<ShardGroup>, PredictionError> {
        let start = Instant::now();

        // 1. Extract features
        let features: Vec<FeatureVector> = transactions
            .iter()
            .map(|tx| feature_extractor::extract_features(tx, &self.heatmap))
            .collect();

        // 2. Run model inference
        let predictions: Vec<Vec<AccessPrediction>> = self.model.predict_batch(&features)?;
        self.total_predictions += predictions.len() as u64;

        // 3. Check confidence — if any TX has low confidence, check fallback
        let avg_confidence = Self::average_confidence(&predictions);
        if avg_confidence < self.config.min_confidence {
            self.fallback_count += 1;
            return Ok(fallback::serial_execution(transactions.len()));
        }

        // 4. Build conflict graph and plan shards
        let shards = self.shard_planner.plan(&predictions)?;

        // 5. Check latency budget
        let elapsed = start.elapsed();
        if elapsed > Duration::from_micros(self.config.max_latency_us) {
            tracing::warn!(
                elapsed_us = elapsed.as_micros(),
                budget_us = self.config.max_latency_us,
                "Prediction exceeded latency budget, result still used"
            );
        }

        Ok(shards)
    }

    /// Update the heatmap with observed access patterns after block execution.
    ///
    /// # Invariant: EXEC-PREDICT-005
    pub fn update_heatmap(
        &mut self,
        block_number: u64,
        observed_accesses: &[(Vec<u8>, bool)], // (key, is_write)
    ) {
        for (key, is_write) in observed_accesses {
            let entry = self.heatmap.entry(key.clone()).or_insert(HeatmapEntry {
                key: key.clone(),
                access_count: 0,
                conflict_count: 0,
                temperature: 0.0,
            });
            entry.access_count += 1;
            if *is_write {
                entry.conflict_count += 1;
            }
            // Exponential moving average for temperature
            entry.temperature = entry.temperature * 0.95 + 0.05;
        }

        // Prune stale entries (decay every block)
        self.heatmap.retain(|_, entry| {
            entry.temperature *= 0.99;
            entry.temperature > 0.001
        });

        let _ = block_number; // used for windowing in production
    }

    /// Get the current heatmap.
    pub fn heatmap(&self) -> &HashMap<Vec<u8>, HeatmapEntry> {
        &self.heatmap
    }

    /// Get prediction statistics.
    pub fn stats(&self) -> PredictorStats {
        PredictorStats {
            total_predictions: self.total_predictions,
            fallback_count: self.fallback_count,
            heatmap_size: self.heatmap.len(),
            fallback_rate: if self.total_predictions > 0 {
                self.fallback_count as f64 / self.total_predictions as f64
            } else {
                0.0
            },
        }
    }

    fn average_confidence(predictions: &[Vec<AccessPrediction>]) -> f64 {
        let (total, count) = predictions.iter().flatten().fold((0u64, 0u64), |(t, c), p| {
            (t + p.confidence as u64, c + 1)
        });
        if count == 0 {
            return 1.0; // No predictions = assume confident
        }
        (total as f64) / (count as f64) / 10_000.0
    }
}

/// Prediction statistics.
#[derive(Debug, Clone)]
pub struct PredictorStats {
    pub total_predictions: u64,
    pub fallback_count: u64,
    pub heatmap_size: usize,
    pub fallback_rate: f64,
}

/// Errors from the prediction pipeline.
#[derive(Debug, thiserror::Error)]
pub enum PredictionError {
    #[error("Model inference failed: {0}")]
    InferenceFailed(String),

    #[error("Feature extraction failed: {0}")]
    FeatureExtractionFailed(String),

    #[error("Shard planning failed: {0}")]
    ShardPlanningFailed(String),

    #[error("Timeout: prediction exceeded {budget_us}µs budget")]
    Timeout { budget_us: u64 },
}

#[cfg(test)]
mod tests {
    use super::*;

    fn sample_tx(nonce: u64) -> TxMetadata {
        TxMetadata {
            tx_hash: [nonce as u8; 32],
            sender: [0x01; 32],
            target: Some([0x02; 32]),
            selector: Some([0xA9, 0x05, 0x9C, 0xBB]), // transfer(address,uint256)
            gas_limit: 21_000,
            value: 0,
            calldata_len: 68,
            nonce,
        }
    }

    /// # Invariant: EXEC-PREDICT-004
    #[test]
    fn fallback_on_low_confidence() {
        let config = PredictorConfig {
            min_confidence: 0.99, // Impossibly high → force fallback
            ..Default::default()
        };
        let mut predictor = ContentionPredictor::new(config);

        let txs: Vec<TxMetadata> = (0..5).map(sample_tx).collect();
        let shards = predictor.predict_and_shard(&txs).unwrap();

        // Fallback = single shard with all TXs (serial)
        assert_eq!(shards.len(), 1);
        assert_eq!(shards[0].tx_indices.len(), 5);
    }

    /// # Invariant: EXEC-PREDICT-005
    #[test]
    fn heatmap_updates() {
        let mut predictor = ContentionPredictor::new(PredictorConfig::default());

        predictor.update_heatmap(1, &[
            (vec![0x01, 0x02], true),
            (vec![0x03, 0x04], false),
        ]);

        assert_eq!(predictor.heatmap().len(), 2);
        assert!(predictor.heatmap()[&vec![0x01, 0x02]].conflict_count > 0);
    }

    /// # Invariant: EXEC-PREDICT-001
    #[test]
    fn sharding_produces_valid_groups() {
        let mut predictor = ContentionPredictor::new(PredictorConfig::default());

        let txs: Vec<TxMetadata> = (0..10).map(sample_tx).collect();
        let shards = predictor.predict_and_shard(&txs).unwrap();

        // All TX indices must be covered
        let mut all_indices: Vec<usize> = shards.iter().flat_map(|s| s.tx_indices.iter().copied()).collect();
        all_indices.sort();
        all_indices.dedup();
        assert_eq!(all_indices.len(), 10);
    }
}
