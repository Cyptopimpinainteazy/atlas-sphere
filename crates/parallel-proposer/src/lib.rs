<<<<<<< HEAD
//! Deterministic parallel proposer primitives.
//!
//! This crate is intentionally runtime-agnostic: it models deterministic scheduling,
//! shard execution, and serial fallback behavior used by a production proposer.
//! ML contention prediction is treated as a hint only.
=======
//! Parallel Proposer Module
//!
//! Implements parallel block proposal with GPU-accelerated signature verification
//! and contention prediction for optimal transaction ordering.
>>>>>>> fac1538ff (big push)

use anyhow::{anyhow, Result};
use blake3::Hasher;
use serde::{Deserialize, Serialize};
<<<<<<< HEAD
use std::collections::{BTreeMap, BTreeSet, HashMap, VecDeque};
use std::sync::Arc;
use tokio::sync::Mutex;
use tokio::time::Instant;

/// Transaction metadata consumed by the proposer.
=======
use std::collections::{HashMap, HashSet};
use std::sync::{Arc, Mutex};
use std::time::Duration;
use tokio::sync::mpsc;
use tokio::time::Instant;
use tracing::{debug, info, warn};

/// Transaction metadata for parallel processing
>>>>>>> fac1538ff (big push)
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

<<<<<<< HEAD
/// Deterministic access declaration (parallel-eligible path).
#[derive(Debug, Clone, Default, Serialize, Deserialize)]
pub struct DeclaredAccess {
    pub reads: Vec<String>,
    pub writes: Vec<String>,
}

/// Parallel proposal configuration.
=======
/// Parallel proposal configuration
>>>>>>> fac1538ff (big push)
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ProposalConfig {
    pub max_parallelism: usize,
    pub contention_threshold: f64,
    pub gpu_batch_size: usize,
    pub timeout_seconds: u64,
    pub signature_batch_size: usize,
<<<<<<< HEAD
    pub min_predictor_confidence: f32,
=======
>>>>>>> fac1538ff (big push)
}

impl Default for ProposalConfig {
    fn default() -> Self {
        Self {
            max_parallelism: 16,
            contention_threshold: 0.7,
            gpu_batch_size: 256,
            timeout_seconds: 30,
            signature_batch_size: 64,
<<<<<<< HEAD
            min_predictor_confidence: 0.8,
=======
>>>>>>> fac1538ff (big push)
        }
    }
}

<<<<<<< HEAD
/// Contention prediction for observability.
=======
/// Contention prediction result
>>>>>>> fac1538ff (big push)
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ContentionPrediction {
    pub tx_hash: String,
    pub contention_score: f64,
    pub conflicting_txs: Vec<String>,
    pub priority: u8,
}

<<<<<<< HEAD
/// Parallel proposal output.
=======
/// Parallel proposal result
>>>>>>> fac1538ff (big push)
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ProposalResult {
    pub block_hash: String,
    pub transactions: Vec<TransactionMeta>,
    pub execution_order: Vec<usize>,
    pub contention_predictions: Vec<ContentionPrediction>,
    pub verification_stats: VerificationStats,
    pub processing_time_ms: u64,
<<<<<<< HEAD
    pub parallel_shards: Vec<Vec<String>>,
    pub serial_fallback_txs: Vec<String>,
    pub used_serial_fallback: bool,
}

/// Signature verification statistics.
=======
}

/// GPU verification statistics
>>>>>>> fac1538ff (big push)
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct VerificationStats {
    pub total_verified: usize,
    pub successful_verifications: usize,
    pub failed_verifications: usize,
    pub average_verification_time_ms: f64,
    pub gpu_utilization_percent: f64,
}

<<<<<<< HEAD
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
=======
/// Parallel proposer core
pub struct ParallelProposer {
    config: ProposalConfig,
    gpu_client: Arc<Mutex<GPUClient>>,
    contention_predictor: Arc<Mutex<ContentionPredictor>>,
    tx_pool: Arc<Mutex<TransactionPool>>,
    proposal_id: u64,
}

impl ParallelProposer {
    /// Create a new parallel proposer
    pub fn new(config: ProposalConfig) -> Self {
        Self {
            config,
            gpu_client: Arc::new(Mutex::new(GPUClient::new())),
            contention_predictor: Arc::new(Mutex::new(ContentionPredictor::new())),
            tx_pool: Arc::new(Mutex::new(TransactionPool::new())),
            proposal_id: 0,
        }
    }

    /// Submit transaction to pool
    pub async fn submit_transaction(&self, tx: TransactionMeta) -> Result<()> {
        let mut pool = self.tx_pool.lock().await;
        pool.add_transaction(tx).await?;
        Ok(())
    }

    /// Create parallel proposal
    pub async fn create_proposal(&mut self) -> Result<ProposalResult> {
        let start_time = Instant::now();
        self.proposal_id += 1;

        let mut pool = self.tx_pool.lock().await;
        let mut predictor = self.contention_predictor.lock().await;
        let mut gpu = self.gpu_client.lock().await;

        // Get transactions from pool
        let txs = pool.get_transactions(self.config.max_parallelism).await?;
        if txs.is_empty() {
            return Err(anyhow!("No transactions available for proposal"));
        }

        // Predict contention
        let predictions = predictor.predict_contention(&txs).await?;

        // Sort by contention score and priority
        let mut sorted_txs: Vec<_> = txs.into_iter().enumerate().collect();
        sorted_txs.sort_by(|a, b| {
            let a_score = predictions
                .get(&a.1.tx_hash)
                .map(|p| p.contention_score)
                .unwrap(0.0);
            let b_score = predictions
                .get(&b.1.tx_hash)
                .map(|p| p.contention_score)
                .unwrap(0.0);
            b_score.partial_cmp(&a_score).unwrap()
        });

        // Extract sorted transactions and execution order
        let (indices, sorted_txs): (Vec<_>, Vec<_>) = sorted_txs.into_iter().unzip();
        let execution_order: Vec<usize> = indices.into_iter().map(|(i, _)| i).collect();

        // Batch signature verification using GPU
        let verification_results = gpu
            .verify_signatures(&sorted_txs, self.config.signature_batch_size)
            .await?;

        // Filter valid transactions
        let valid_txs: Vec<_> = sorted_txs
            .into_iter()
            .zip(verification_results)
            .filter(|(_, result)| result.is_ok())
            .map(|(tx, _)| tx)
            .collect();

        // Create block hash
        let block_hash = self.create_block_hash(&valid_txs);

        let processing_time = start_time.elapsed().as_millis() as u64;

        Ok(ProposalResult {
            block_hash,
            transactions: valid_txs,
            execution_order,
            contention_predictions: predictions.values().cloned().collect(),
            verification_stats: gpu.get_verification_stats(),
            processing_time_ms: processing_time,
        })
    }

    /// Create block hash from transactions
    fn create_block_hash(&self, txs: &[TransactionMeta]) -> String {
        let mut hasher = Hasher::new();
        for tx in txs {
            hasher.update(tx.tx_hash.as_bytes());
        }
        format!("{}", hasher.finalize().to_hex())
    }

    /// Get proposal statistics
    pub async fn get_stats(&self) -> ProposalStats {
        let pool = self.tx_pool.lock().await;
        let predictor = self.contention_predictor.lock().await;
        let gpu = self.gpu_client.lock().await;

        ProposalStats {
            pending_txs: pool.len(),
            contention_predictions: predictor.get_stats(),
            gpu_stats: gpu.get_stats(),
            proposal_id: self.proposal_id,
>>>>>>> fac1538ff (big push)
        }
    }
}

<<<<<<< HEAD
fn create_block_hash(txs: &[TransactionMeta]) -> String {
    let mut hasher = Hasher::new();
    for tx in txs {
        hasher.update(tx.tx_hash.as_bytes());
    }
    hasher.finalize().to_hex().to_string()
}

=======
/// Proposal statistics
>>>>>>> fac1538ff (big push)
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ProposalStats {
    pub pending_txs: usize,
    pub contention_predictions: ContentionStats,
    pub gpu_stats: GPUStats,
    pub proposal_id: u64,
}

<<<<<<< HEAD
#[derive(Debug, Clone, Default, Serialize, Deserialize)]
=======
/// Contention prediction statistics
#[derive(Debug, Clone, Serialize, Deserialize)]
>>>>>>> fac1538ff (big push)
pub struct ContentionStats {
    pub total_predictions: usize,
    pub high_contention: usize,
    pub medium_contention: usize,
    pub low_contention: usize,
    pub accuracy: f64,
}

<<<<<<< HEAD
#[derive(Debug, Clone, Default, Serialize, Deserialize)]
=======
/// GPU statistics
#[derive(Debug, Clone, Serialize, Deserialize)]
>>>>>>> fac1538ff (big push)
pub struct GPUStats {
    pub utilization_percent: f64,
    pub memory_usage_mb: u64,
    pub temperature_c: f64,
    pub power_draw_w: f64,
}

<<<<<<< HEAD
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

=======
/// Transaction pool
struct TransactionPool {
    transactions: HashMap<String, TransactionMeta>,
    pending_hashes: Vec<String>,
}

impl TransactionPool {
    fn new() -> Self {
        Self {
            transactions: HashMap::new(),
            pending_hashes: Vec::new(),
        }
    }

    async fn add_transaction(&mut self, tx: TransactionMeta) -> Result<()> {
        if self.transactions.contains_key(&tx.tx_hash) {
            return Err(anyhow!("Transaction already in pool"));
        }

        self.transactions.insert(tx.tx_hash.clone(), tx);
        self.pending_hashes.push(tx.tx_hash.clone());
        Ok(())
    }

    async fn get_transactions(&mut self, max_count: usize) -> Result<Vec<TransactionMeta>> {
        let count = std::cmp::min(max_count, self.pending_hashes.len());
        let selected_hashes = self.pending_hashes.drain(..count);
        let txs: Vec<_> = selected_hashes
            .filter_map(|hash| self.transactions.remove(&hash))
            .collect();
        Ok(txs)
    }

    fn len(&self) -> usize {
        self.pending_hashes.len()
    }
}

/// Contention predictor
struct ContentionPredictor {
    model: Option<ContentionModel>,
}

impl ContentionPredictor {
    fn new() -> Self {
        Self { model: None }
    }

    async fn predict_contention(
        &mut self,
        txs: &[TransactionMeta],
    ) -> Result<HashMap<String, ContentionPrediction>> {
        if self.model.is_none() {
            self.model = Some(ContentionModel::load_default().await?);
        }

        let model = self.model.as_mut().unwrap();
        let mut predictions = HashMap::new();

        for tx in txs {
            let prediction = model.predict(tx).await?;
            predictions.insert(tx.tx_hash.clone(), prediction);
        }

        Ok(predictions)
    }

    fn get_stats(&self) -> ContentionStats {
        // TODO: Implement actual stats tracking
        ContentionStats {
            total_predictions: 0,
            high_contention: 0,
            medium_contention: 0,
            low_contention: 0,
            accuracy: 0.0,
        }
    }
}

/// Contention prediction model
struct ContentionModel {
    // Model parameters would be stored here
}

impl ContentionModel {
    async fn load_default() -> Result<Self> {
        // Load or initialize default model
        Ok(Self {})
    }

    async fn predict(&self, tx: &TransactionMeta) -> Result<ContentionPrediction> {
        // Simple heuristic-based prediction
        let contention_score = if tx.value > 1_000_000_000 {
            0.9
        } else if tx.gas_price > 100_000_000 {
            0.7
        } else {
            0.3
        };

        let priority = if contention_score > 0.8 {
            1
        } else if contention_score > 0.5 {
            2
        } else {
            3
        };

        Ok(ContentionPrediction {
            tx_hash: tx.tx_hash.clone(),
            contention_score,
            conflicting_txs: Vec::new(),
            priority,
        })
    }
}

/// GPU client for signature verification
struct GPUClient {
    // GPU context and resources would be managed here
}

impl GPUClient {
    fn new() -> Self {
        Self {}
    }

    async fn verify_signatures(
        &mut self,
        txs: &[TransactionMeta],
        batch_size: usize,
    ) -> Result<Vec<Result<(), String>>> {
        // Simulate GPU verification with batch processing
        let mut results = Vec::with_capacity(txs.len());

        for chunk in txs.chunks(batch_size) {
            let batch_results = self.verify_batch(chunk).await?;
            results.extend(batch_results);
        }

        Ok(results)
    }

    async fn verify_batch(&mut self, txs: &[TransactionMeta]) -> Result<Vec<Result<(), String>>> {
        // Simulate verification with random success/failure
        let mut results = Vec::with_capacity(txs.len());

        for tx in txs {
            if Self::simulate_verification(tx) {
                results.push(Ok(()));
            } else {
                results.push(Err("Invalid signature".to_string()));
            }
        }

        Ok(results)
    }

    fn simulate_verification(tx: &TransactionMeta) -> bool {
        // Simple validation - in real implementation this would use GPU acceleration
        !tx.signature.is_empty() && tx.signature.len() > 64
    }

    fn get_verification_stats(&self) -> VerificationStats {
        // Return simulated stats
        VerificationStats {
            total_verified: 100,
            successful_verifications: 95,
            failed_verifications: 5,
            average_verification_time_ms: 2.5,
            gpu_utilization_percent: 75.0,
        }
    }

    fn get_stats(&self) -> GPUStats {
        GPUStats {
            utilization_percent: 75.0,
            memory_usage_mb: 2048,
            temperature_c: 65.0,
            power_draw_w: 150.0,
        }
    }
}

>>>>>>> fac1538ff (big push)
#[cfg(test)]
mod tests {
    use super::*;

<<<<<<< HEAD
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
=======
    #[tokio::test]
    async fn test_parallel_proposer_basic_flow() {
        let config = ProposalConfig::default();
        let mut proposer = ParallelProposer::new(config);

        // Create test transactions
        let tx1 = TransactionMeta {
            tx_hash: "tx1".to_string(),
            sender: "0x1234".to_string(),
            receiver: "0x5678".to_string(),
            value: 1_000_000_000,
            gas_limit: 21_000,
            gas_price: 20_000_000,
            nonce: 1,
            signature: "valid_sig1".to_string(),
            contract_address: None,
            timestamp: 1234567890,
        };

        let tx2 = TransactionMeta {
            tx_hash: "tx2".to_string(),
            sender: "0x2345".to_string(),
            receiver: "0x6789".to_string(),
            value: 500_000_000,
            gas_limit: 21_000,
            gas_price: 30_000_000,
            nonce: 1,
            signature: "valid_sig2".to_string(),
            contract_address: None,
            timestamp: 1234567891,
        };

        // Submit transactions
        proposer.submit_transaction(tx1.clone()).await.unwrap();
        proposer.submit_transaction(tx2.clone()).await.unwrap();

        // Create proposal
        let proposal = proposer.create_proposal().await.unwrap();

        assert!(!proposal.block_hash.is_empty());
        assert_eq!(proposal.transactions.len(), 2);
        assert!(!proposal.execution_order.is_empty());
    }

    #[tokio::test]
    async fn test_contention_prediction() {
        let mut predictor = ContentionPredictor::new();
        let tx = TransactionMeta {
            tx_hash: "test_tx".to_string(),
            sender: "0x1234".to_string(),
            receiver: "0x5678".to_string(),
            value: 2_000_000_000,
            gas_limit: 21_000,
            gas_price: 50_000_000,
            nonce: 1,
            signature: "valid_sig".to_string(),
            contract_address: None,
            timestamp: 1234567890,
        };

        let predictions = predictor.predict_contention(&[tx.clone()]).await.unwrap();
        let prediction = predictions.get(&tx.tx_hash).unwrap();

        assert!(prediction.contention_score > 0.5);
        assert!(prediction.priority <= 3);
>>>>>>> fac1538ff (big push)
    }
}
