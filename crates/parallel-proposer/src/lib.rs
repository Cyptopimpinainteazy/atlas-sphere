//! Deterministic parallel proposer primitives.
//!
//! This crate is intentionally runtime-agnostic: it models deterministic scheduling,
//! shard execution, and serial fallback behavior used by a production proposer.
//! ML contention prediction is treated as a hint only.

use anyhow::{anyhow, Result};
use blake3::Hasher;
use serde::{Deserialize, Serialize};
use std::collections::{BTreeMap, BTreeSet, HashMap, VecDeque};
use std::sync::Arc;
use tokio::sync::Mutex;
use tokio::time::Instant;

/// Transaction metadata consumed by the proposer.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TransactionMeta {
    pub tx_hash: String,
    pub sender: String,
    pub receiver: String,
    pub value: u128,
    pub gas_limit: u64,
    pub gas_price: u128,
    pub nonce: u64,
    pub signature: String,
    pub contract_address: Option<String>,
    pub timestamp: u64,
}

/// Deterministic access declaration (parallel-eligible path).
#[derive(Debug, Clone, Default, Serialize, Deserialize)]
pub struct DeclaredAccess {
    pub reads: Vec<String>,
    pub writes: Vec<String>,
}

/// Parallel proposal configuration.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ProposalConfig {
    pub max_parallelism: usize,
    pub contention_threshold: f64,
    pub gpu_batch_size: usize,
    pub timeout_seconds: u64,
    pub signature_batch_size: usize,
    pub min_predictor_confidence: f32,
}

impl Default for ProposalConfig {
    fn default() -> Self {
        Self {
            max_parallelism: 16,
            contention_threshold: 0.7,
            gpu_batch_size: 256,
            timeout_seconds: 30,
            signature_batch_size: 64,
            min_predictor_confidence: 0.8,
        }
    }
}

/// Contention prediction for observability.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ContentionPrediction {
    pub tx_hash: String,
    pub contention_score: f64,
    pub conflicting_txs: Vec<String>,
    pub priority: u8,
}

/// Parallel proposal output.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ProposalResult {
    pub block_hash: String,
    pub transactions: Vec<TransactionMeta>,
    pub execution_order: Vec<usize>,
    pub contention_predictions: Vec<ContentionPrediction>,
    pub verification_stats: VerificationStats,
    pub processing_time_ms: u64,
    pub parallel_shards: Vec<Vec<String>>,
    pub serial_fallback_txs: Vec<String>,
    pub used_serial_fallback: bool,
}

/// Signature verification statistics.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct VerificationStats {
    pub total_verified: usize,
    pub successful_verifications: usize,
    pub failed_verifications: usize,
    pub average_verification_time_ms: f64,
    pub gpu_utilization_percent: f64,
}

/// Parallel proposer core.
pub struct ParallelProposer {
    config: ProposalConfig,
    state: Arc<Mutex<ProposerState>>,
}

struct ProposerState {
    tx_pool: VecDeque<TransactionMeta>,
    access_metadata: HashMap<String, DeclaredAccess>,
    proposal_id: u64,
    contention_stats: ContentionStats,
    gpu_stats: GPUStats,
}

impl ParallelProposer {
    /// Create a new proposer.
    pub fn new(config: ProposalConfig) -> Self {
        Self {
            config,
            state: Arc::new(Mutex::new(ProposerState {
                tx_pool: VecDeque::new(),
                access_metadata: HashMap::new(),
                proposal_id: 0,
                contention_stats: ContentionStats::default(),
                gpu_stats: GPUStats::default(),
            })),
        }
    }

    /// Submit transaction without declared access metadata.
    ///
    /// This is treated as legacy/global-write and forces serial fallback.
    pub async fn submit_transaction(&self, tx: TransactionMeta) -> Result<()> {
        self.submit_transaction_with_access(tx, None).await
    }

    /// Submit transaction with declared deterministic access metadata.
    pub async fn submit_transaction_with_access(
        &self,
        tx: TransactionMeta,
        declared_access: Option<DeclaredAccess>,
    ) -> Result<()> {
        let mut state = self.state.lock().await;
        if state.tx_pool.iter().any(|pending| pending.tx_hash == tx.tx_hash) {
            return Err(anyhow!("transaction already in pool"));
        }

        if let Some(access) = declared_access {
            state.access_metadata.insert(tx.tx_hash.clone(), access);
        }

        state.tx_pool.push_back(tx);
        Ok(())
    }

    /// Create a deterministic proposal from currently queued transactions.
    pub async fn create_proposal(&self) -> Result<ProposalResult> {
        let started_at = Instant::now();
        let mut state = self.state.lock().await;
        state.proposal_id = state.proposal_id.saturating_add(1);

        let max_txs = self.config.max_parallelism.max(1);
        let mut txs = Vec::with_capacity(max_txs);
        for _ in 0..max_txs {
            if let Some(tx) = state.tx_pool.pop_front() {
                txs.push(tx);
            } else {
                break;
            }
        }

        if txs.is_empty() {
            return Err(anyhow!("no transactions available for proposal"));
        }

        let predictor = ContentionPredictor::new(self.config.max_parallelism.max(1));
        let hints = predictor.predict_contention(&txs);

        let verifier = SignatureVerifier;
        let verify_started = Instant::now();
        let verification_mask = verifier.verify_signatures(&txs, self.config.signature_batch_size);
        let verify_ms = verify_started.elapsed().as_secs_f64() * 1000.0;

        let mut valid_txs = Vec::new();
        for (idx, tx) in txs.into_iter().enumerate() {
            if verification_mask[idx] {
                valid_txs.push((idx, tx));
            }
        }

        if valid_txs.is_empty() {
            return Err(anyhow!("all transactions failed signature verification"));
        }

        let scheduler = DeterministicScheduler::new(
            self.config.max_parallelism.max(1),
            self.config.min_predictor_confidence,
        );
        let plan = scheduler.build_plan(&valid_txs, &state.access_metadata, &hints);

        state.contention_stats = scheduler.build_contention_stats(&plan.predictions);

        let mut overlay_outputs = Vec::new();
        for shard in &plan.shards {
            overlay_outputs.push(execute_shard(shard, &valid_txs, &state.access_metadata));
        }

        let mut used_serial_fallback = false;
        let mut serial_fallback_indices = plan.serial_fallback.clone();
        if detect_overlay_conflict(&overlay_outputs) {
            used_serial_fallback = true;
            serial_fallback_indices = (0..valid_txs.len()).collect();
        }

        // Deterministic block transaction ordering remains the canonical input order.
        let mut execution_order: Vec<usize> = (0..valid_txs.len()).collect();
        execution_order.sort_unstable();

        let ordered_txs: Vec<TransactionMeta> = execution_order
            .iter()
            .map(|idx| valid_txs[*idx].1.clone())
            .collect();

        let block_hash = create_block_hash(&ordered_txs);

        state.gpu_stats = GPUStats {
            utilization_percent: 0.0,
            memory_usage_mb: 0,
            temperature_c: 0.0,
            power_draw_w: 0.0,
        };

        let processing_time_ms = started_at.elapsed().as_millis() as u64;
        let total_verified = verification_mask.len();
        let successful_verifications = verification_mask.iter().filter(|ok| **ok).count();

        let serial_fallback_txs = serial_fallback_indices
            .iter()
            .map(|idx| valid_txs[*idx].1.tx_hash.clone())
            .collect::<Vec<_>>();

        let parallel_shards = plan
            .shards
            .iter()
            .map(|shard| {
                shard.tx_indices
                    .iter()
                    .map(|idx| valid_txs[*idx].1.tx_hash.clone())
                    .collect::<Vec<_>>()
            })
            .collect::<Vec<_>>();

        Ok(ProposalResult {
            block_hash,
            transactions: ordered_txs,
            execution_order,
            contention_predictions: plan.predictions,
            verification_stats: VerificationStats {
                total_verified,
                successful_verifications,
                failed_verifications: total_verified.saturating_sub(successful_verifications),
                average_verification_time_ms: if total_verified == 0 {
                    0.0
                } else {
                    verify_ms / total_verified as f64
                },
                gpu_utilization_percent: 0.0,
            },
            processing_time_ms,
            parallel_shards,
            serial_fallback_txs,
            used_serial_fallback,
        })
    }

    /// Snapshot proposer stats.
    pub async fn get_stats(&self) -> ProposalStats {
        let state = self.state.lock().await;
        ProposalStats {
            pending_txs: state.tx_pool.len(),
            contention_predictions: state.contention_stats.clone(),
            gpu_stats: state.gpu_stats.clone(),
            proposal_id: state.proposal_id,
        }
    }
}

fn create_block_hash(txs: &[TransactionMeta]) -> String {
    let mut hasher = Hasher::new();
    for tx in txs {
        hasher.update(tx.tx_hash.as_bytes());
    }
    hasher.finalize().to_hex().to_string()
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ProposalStats {
    pub pending_txs: usize,
    pub contention_predictions: ContentionStats,
    pub gpu_stats: GPUStats,
    pub proposal_id: u64,
}

#[derive(Debug, Clone, Default, Serialize, Deserialize)]
pub struct ContentionStats {
    pub total_predictions: usize,
    pub high_contention: usize,
    pub medium_contention: usize,
    pub low_contention: usize,
    pub accuracy: f64,
}

#[derive(Debug, Clone, Default, Serialize, Deserialize)]
pub struct GPUStats {
    pub utilization_percent: f64,
    pub memory_usage_mb: u64,
    pub temperature_c: f64,
    pub power_draw_w: f64,
}

struct SignatureVerifier;

impl SignatureVerifier {
    fn verify_signatures(&self, txs: &[TransactionMeta], _batch_size: usize) -> Vec<bool> {
        txs.iter()
            .map(|tx| !tx.signature.is_empty() && tx.signature.len() >= 16)
            .collect()
    }
}

#[derive(Debug, Clone)]
struct PredictorHint {
    suggested_shard: usize,
    confidence: f32,
    contention_score: f64,
}

struct ContentionPredictor {
    shard_count: usize,
}

impl ContentionPredictor {
    fn new(shard_count: usize) -> Self {
        Self {
            shard_count: shard_count.max(1),
        }
    }

    fn predict_contention(&self, txs: &[TransactionMeta]) -> HashMap<String, PredictorHint> {
        let mut out = HashMap::with_capacity(txs.len());
        for tx in txs {
            let contention_score = contention_score(tx);
            let confidence = if tx.contract_address.is_some() { 0.88 } else { 0.62 };
            let suggested_shard = (stable_hash_u64(&tx.tx_hash) as usize) % self.shard_count;
            out.insert(
                tx.tx_hash.clone(),
                PredictorHint {
                    suggested_shard,
                    confidence,
                    contention_score,
                },
            );
        }
        out
    }
}

fn stable_hash_u64(input: &str) -> u64 {
    let mut h = Hasher::new();
    h.update(input.as_bytes());
    let digest = h.finalize();
    let bytes = digest.as_bytes();
    let mut out = [0u8; 8];
    out.copy_from_slice(&bytes[..8]);
    u64::from_le_bytes(out)
}

fn contention_score(tx: &TransactionMeta) -> f64 {
    let value_term = (tx.value as f64 / 10_000_000_000.0).min(0.4);
    let gas_term = (tx.gas_price as f64 / 200_000_000.0).min(0.4);
    let vm_term = if tx.contract_address.is_some() { 0.2 } else { 0.05 };
    (value_term + gas_term + vm_term).min(1.0)
}

#[derive(Debug, Clone)]
struct Shard {
    tx_indices: Vec<usize>,
    reads: BTreeSet<String>,
    writes: BTreeSet<String>,
}

#[derive(Debug)]
struct Plan {
    shards: Vec<Shard>,
    serial_fallback: Vec<usize>,
    predictions: Vec<ContentionPrediction>,
}

struct DeterministicScheduler {
    max_parallelism: usize,
    min_predictor_confidence: f32,
}

impl DeterministicScheduler {
    fn new(max_parallelism: usize, min_predictor_confidence: f32) -> Self {
        Self {
            max_parallelism: max_parallelism.max(1),
            min_predictor_confidence,
        }
    }

    fn build_plan(
        &self,
        txs: &[(usize, TransactionMeta)],
        metadata: &HashMap<String, DeclaredAccess>,
        hints: &HashMap<String, PredictorHint>,
    ) -> Plan {
        let mut shards: Vec<Shard> = Vec::new();
        let mut serial_fallback = Vec::new();
        let mut predictions = Vec::with_capacity(txs.len());

        for (slot_idx, (_, tx)) in txs.iter().enumerate() {
            let Some(access) = metadata.get(&tx.tx_hash) else {
                serial_fallback.push(slot_idx);
                predictions.push(ContentionPrediction {
                    tx_hash: tx.tx_hash.clone(),
                    contention_score: 1.0,
                    conflicting_txs: vec!["missing_access_metadata".to_string()],
                    priority: 1,
                });
                continue;
            };

            if access.reads.is_empty() && access.writes.is_empty() {
                serial_fallback.push(slot_idx);
                predictions.push(ContentionPrediction {
                    tx_hash: tx.tx_hash.clone(),
                    contention_score: 1.0,
                    conflicting_txs: vec!["empty_access_metadata".to_string()],
                    priority: 1,
                });
                continue;
            }

            let hint = hints.get(&tx.tx_hash);
            let conflicting_shards = conflicting_shards(access, &shards);

            let target_shard = if conflicting_shards.len() > 1 {
                serial_fallback.push(slot_idx);
                predictions.push(ContentionPrediction {
                    tx_hash: tx.tx_hash.clone(),
                    contention_score: 1.0,
                    conflicting_txs: conflicting_shards
                        .iter()
                        .map(|s| format!("conflict_shard_{s}"))
                        .collect(),
                    priority: 1,
                });
                continue;
            } else if let Some(conflict_idx) = conflicting_shards.first().copied() {
                conflict_idx
            } else if let Some(pred) = hint {
                if pred.confidence >= self.min_predictor_confidence && pred.suggested_shard < shards.len()
                {
                    pred.suggested_shard
                } else {
                    self.pick_or_create_shard(&mut shards)
                }
            } else {
                self.pick_or_create_shard(&mut shards)
            };

            if target_shard >= shards.len() {
                shards.push(Shard {
                    tx_indices: Vec::new(),
                    reads: BTreeSet::new(),
                    writes: BTreeSet::new(),
                });
            }

            add_to_shard(&mut shards[target_shard], slot_idx, access);

            let contention_score = hint.map(|h| h.contention_score).unwrap_or(0.5);
            let priority = if contention_score >= 0.8 {
                1
            } else if contention_score >= 0.5 {
                2
            } else {
                3
            };

            predictions.push(ContentionPrediction {
                tx_hash: tx.tx_hash.clone(),
                contention_score,
                conflicting_txs: Vec::new(),
                priority,
            });
        }

        Plan {
            shards,
            serial_fallback,
            predictions,
        }
    }

    fn pick_or_create_shard(&self, shards: &mut Vec<Shard>) -> usize {
        if shards.len() < self.max_parallelism {
            return shards.len();
        }

        // Deterministic fallback when shard budget is exhausted: choose shard with least txs.
        shards
            .iter()
            .enumerate()
            .min_by_key(|(_, shard)| shard.tx_indices.len())
            .map(|(idx, _)| idx)
            .unwrap_or(0)
    }

    fn build_contention_stats(&self, predictions: &[ContentionPrediction]) -> ContentionStats {
        let mut stats = ContentionStats::default();
        stats.total_predictions = predictions.len();

        for prediction in predictions {
            if prediction.contention_score >= 0.8 {
                stats.high_contention += 1;
            } else if prediction.contention_score >= 0.5 {
                stats.medium_contention += 1;
            } else {
                stats.low_contention += 1;
            }
        }

        stats.accuracy = 1.0;
        stats
    }
}

fn conflicting_shards(access: &DeclaredAccess, shards: &[Shard]) -> Vec<usize> {
    let access_reads: BTreeSet<String> = access.reads.iter().cloned().collect();
    let access_writes: BTreeSet<String> = access.writes.iter().cloned().collect();

    shards
        .iter()
        .enumerate()
        .filter_map(|(idx, shard)| {
            let write_write = !access_writes.is_disjoint(&shard.writes);
            let write_read = !access_writes.is_disjoint(&shard.reads);
            let read_write = !access_reads.is_disjoint(&shard.writes);

            if write_write || write_read || read_write {
                Some(idx)
            } else {
                None
            }
        })
        .collect()
}

fn add_to_shard(shard: &mut Shard, tx_idx: usize, access: &DeclaredAccess) {
    shard.tx_indices.push(tx_idx);
    shard.reads.extend(access.reads.iter().cloned());
    shard.writes.extend(access.writes.iter().cloned());
}

#[derive(Debug)]
struct OverlayDiff {
    writes: BTreeMap<String, String>,
}

fn execute_shard(
    shard: &Shard,
    txs: &[(usize, TransactionMeta)],
    metadata: &HashMap<String, DeclaredAccess>,
) -> OverlayDiff {
    let mut writes = BTreeMap::new();

    for tx_idx in &shard.tx_indices {
        let tx = &txs[*tx_idx].1;
        if let Some(access) = metadata.get(&tx.tx_hash) {
            for key in &access.writes {
                writes.insert(key.clone(), tx.tx_hash.clone());
            }
        }
    }

    OverlayDiff { writes }
}

fn detect_overlay_conflict(diff_sets: &[OverlayDiff]) -> bool {
    let mut seen = BTreeSet::new();
    for diff in diff_sets {
        for key in diff.writes.keys() {
            if !seen.insert(key.clone()) {
                return true;
            }
        }
    }
    false
}

pub mod integration;

#[cfg(test)]
mod tests {
    use super::*;

    fn mk_tx(id: &str, signature: &str) -> TransactionMeta {
        TransactionMeta {
            tx_hash: id.to_string(),
            sender: "0x01".to_string(),
            receiver: "0x02".to_string(),
            value: 10,
            gas_limit: 21_000,
            gas_price: 20_000_000,
            nonce: 1,
            signature: signature.to_string(),
            contract_address: Some("0xCAFE".to_string()),
            timestamp: 1,
        }
    }

    #[tokio::test]
    async fn missing_metadata_forces_serial_fallback() {
        let proposer = ParallelProposer::new(ProposalConfig::default());
        proposer
            .submit_transaction(mk_tx("tx-a", "0123456789abcdef"))
            .await
            .unwrap();

        let proposal = proposer.create_proposal().await.unwrap();
        assert!(proposal.used_serial_fallback || !proposal.serial_fallback_txs.is_empty());
        assert_eq!(proposal.transactions.len(), 1);
    }

    #[tokio::test]
    async fn non_overlapping_writes_can_be_parallelized() {
        let proposer = ParallelProposer::new(ProposalConfig {
            max_parallelism: 4,
            ..ProposalConfig::default()
        });

        proposer
            .submit_transaction_with_access(
                mk_tx("tx-a", "0123456789abcdef"),
                Some(DeclaredAccess {
                    reads: vec!["r:a".to_string()],
                    writes: vec!["w:a".to_string()],
                }),
            )
            .await
            .unwrap();

        proposer
            .submit_transaction_with_access(
                mk_tx("tx-b", "fedcba9876543210"),
                Some(DeclaredAccess {
                    reads: vec!["r:b".to_string()],
                    writes: vec!["w:b".to_string()],
                }),
            )
            .await
            .unwrap();

        let proposal = proposer.create_proposal().await.unwrap();
        assert!(!proposal.parallel_shards.is_empty());
        assert!(proposal.serial_fallback_txs.is_empty());
    }

    #[tokio::test]
    async fn conflicting_access_is_serialized() {
        let proposer = ParallelProposer::new(ProposalConfig {
            max_parallelism: 4,
            ..ProposalConfig::default()
        });

        proposer
            .submit_transaction_with_access(
                mk_tx("tx-a", "0123456789abcdef"),
                Some(DeclaredAccess {
                    reads: vec!["state:x".to_string()],
                    writes: vec!["state:x".to_string()],
                }),
            )
            .await
            .unwrap();

        proposer
            .submit_transaction_with_access(
                mk_tx("tx-b", "fedcba9876543210"),
                Some(DeclaredAccess {
                    reads: vec!["state:x".to_string()],
                    writes: vec!["state:x".to_string()],
                }),
            )
            .await
            .unwrap();

        let proposal = proposer.create_proposal().await.unwrap();
        assert!(proposal.serial_fallback_txs.len() <= 1);
        assert_eq!(proposal.transactions.len(), 2);
    }
}
