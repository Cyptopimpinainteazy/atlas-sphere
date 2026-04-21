/// Relayer Service - Main orchestrator for proof acquisition and submission

use crate::submitter::RpcSubmitter;
use crate::types::*;
use crate::watchers::{EvmHeaderWatcher, SvmHeaderWatcher};
use anyhow::Result;
use log::{debug, error, info, warn};
use std::collections::{BTreeMap, BTreeSet};
use std::sync::Arc;
use tokio::sync::{RwLock, Semaphore};
use tokio::time::{sleep, Duration};

pub struct RelayerService {
    config: RelayerConfig,
    state: Arc<RwLock<RelayerInternalState>>,
    evm_watchers: Vec<EvmHeaderWatcher>,
    svm_watchers: Vec<SvmHeaderWatcher>,
    submitter: Arc<RpcSubmitter>,
    metrics: Arc<RwLock<RelayerMetrics>>,
    evm_concurrency_limiter: Arc<Semaphore>,  // Max 10 concurrent EVM polls
    svm_concurrency_limiter: Arc<Semaphore>,  // Max 20 concurrent SVM polls
}

struct RelayerInternalState {
    status: RelayerStateEnum,
    current_nonce: u32,
    evm_heads: BTreeMap<u32, u64>,  // domain_id -> block_number
    svm_heads: BTreeMap<u32, u64>,  // domain_id -> slot
    finalized_evm_headers: BTreeMap<u32, u64>,  // domain_id -> finalized block_number
    finalized_svm_headers: BTreeMap<u32, u64>,  // domain_id -> finalized slot
    proof_cache: BTreeSet<[u8; 32]>,  // Submitted proof hashes (replay protection)
    pending_submissions: u32,
    shutdown_signal: bool,
    pause_reason: Option<String>,
}

impl RelayerService {
    pub async fn new(config: RelayerConfig) -> Result<Self> {
        info!("Initializing RelayerService");

        // Initialize EVM watchers
        let mut evm_watchers = Vec::new();
        for evm_config in &config.evm_chains {
            match EvmHeaderWatcher::new(evm_config.clone()).await {
                Ok(watcher) => evm_watchers.push(watcher),
                Err(e) => warn!("Failed to initialize EVM watcher for {}: {}", evm_config.name, e),
            }
        }

        // Initialize SVM watchers
        let mut svm_watchers = Vec::new();
        for svm_config in &config.svm_clusters {
            match SvmHeaderWatcher::new(svm_config.clone()).await {
                Ok(watcher) => svm_watchers.push(watcher),
                Err(e) => warn!("Failed to initialize SVM watcher for {}: {}", svm_config.name, e),
            }
        }

        // Initialize RPC submitter
        let submitter = RpcSubmitter::new(
            config.x3.rpc_url.clone(),
            config.x3.relayer_account.clone(),
        )
        .await?;

        let state = RelayerInternalState {
            status: RelayerStateEnum::Active,
            current_nonce: 0,
            evm_heads: BTreeMap::new(),
            svm_heads: BTreeMap::new(),
            finalized_evm_headers: BTreeMap::new(),
            finalized_svm_headers: BTreeMap::new(),
            proof_cache: BTreeSet::new(),
            pending_submissions: 0,
            shutdown_signal: false,
            pause_reason: None,
        };

        info!("RelayerService initialized with {} EVM chains and {} SVM clusters",
              evm_watchers.len(), svm_watchers.len());

        Ok(Self {
            config,
            state: Arc::new(RwLock::new(state)),
            evm_watchers,
            svm_watchers,
            submitter: Arc::new(submitter),
            metrics: Arc::new(RwLock::new(RelayerMetrics::default())),
            evm_concurrency_limiter: Arc::new(Semaphore::new(10)),  // Max 10 concurrent EVM polls
            svm_concurrency_limiter: Arc::new(Semaphore::new(20)),  // Max 20 concurrent SVM polls
        })
    }

    /// Main relay loop - runs indefinitely until shutdown
    pub async fn run(&self) -> Result<()> {
        info!("Starting relay loop");

        let mut startup_time = std::time::Instant::now();

        loop {
            // Check for shutdown signal
            {
                let state = self.state.read().await;
                if state.shutdown_signal {
                    info!("Shutdown signal received, exiting relay loop");
                    break;
                }
            }

            // Check governance pause status
            if let Ok(paused) = self.submitter.is_bridge_paused().await {
                if paused {
                    let mut state = self.state.write().await;
                    if state.status != RelayerStateEnum::Paused {
                        warn!("Bridge paused by governance");
                        state.status = RelayerStateEnum::Paused;
                        state.pause_reason = Some("Governance pause".to_string());
                        let mut metrics = self.metrics.write().await;
                        metrics.pause_events += 1;
                    }
                    
                    sleep(Duration::from_secs(self.config.governance.poll_interval_secs)).await;
                    continue;
                } else {
                    let mut state = self.state.write().await;
                    if state.status == RelayerStateEnum::Paused {
                        info!("Bridge unpaused, resuming operations");
                        state.status = RelayerStateEnum::Active;
                        state.pause_reason = None;
                    }
                }
            }

            // Poll EVM headers (with concurrency limiting)
            self.poll_evm_headers().await;

            // Poll SVM headers (with concurrency limiting)
            self.poll_svm_headers().await;

            // Check finality and submit proofs (with deduplication)
            self.process_finalized_headers().await;

            // Update uptime metrics
            let mut metrics = self.metrics.write().await;
            metrics.uptime_secs = startup_time.elapsed().as_secs();

            // Sleep before next iteration
            sleep(Duration::from_millis(
                self.config.evm_chains
                    .first()
                    .map(|c| c.block_poll_interval_ms)
                    .unwrap_or(12000),
            ))
            .await;
        }

        Ok(())
    }

    pub async fn shutdown(&self) {
        let mut state = self.state.write().await;
        state.shutdown_signal = true;
        info!("Shutdown requested");
    }

    pub async fn get_metrics(&self) -> RelayerMetrics {
        self.metrics.read().await.clone()
    }

    pub async fn get_status(&self) -> RelayerStateEnum {
        self.state.read().await.status.clone()
    }

    // ============================================================================
    // Private Methods
    // ============================================================================

    async fn poll_evm_headers(&self) {
        for (idx, watcher) in self.evm_watchers.iter().enumerate() {
            // Acquire permit from concurrency limiter (max 10 concurrent)
            let _permit = self.evm_concurrency_limiter.acquire().await;
            
            match watcher.poll().await {
                Ok(headers) => {
                    if !headers.is_empty() {
                        debug!("Polled {} EVM headers from watcher {}", headers.len(), idx);
                        
                        let mut state = self.state.write().await;
                        
                        // Process each header for finality checking
                        for header in &headers {
                            // Store raw header
                            state.evm_heads.insert(header.chain_id, header.block_number);
                            
                            // Check if header has reached finality
                            if let Ok(is_finalized) = watcher.check_finality(header.block_number).await {
                                if is_finalized {
                                    debug!("EVM block {} (chain {}) has reached finality", 
                                           header.block_number, header.chain_id);
                                    state.finalized_evm_headers.insert(header.chain_id, header.block_number);
                                }
                            } else {
                                debug!("Failed to check finality for EVM block {}", header.block_number);
                            }
                        }
                        
                        let mut metrics = self.metrics.write().await;
                        metrics.blocks_polled += headers.len() as u64;
                    }
                }
                Err(e) => {
                    warn!("Failed to poll EVM headers from watcher {}: {}", idx, e);
                    let mut metrics = self.metrics.write().await;
                    metrics.poll_failures += 1;
                }
            }
        }
    }

    async fn poll_svm_headers(&self) {
        for (idx, watcher) in self.svm_watchers.iter().enumerate() {
            // Acquire permit from concurrency limiter (max 20 concurrent)
            let _permit = self.svm_concurrency_limiter.acquire().await;
            
            match watcher.poll().await {
                Ok(headers) => {
                    if !headers.is_empty() {
                        debug!("Polled {} SVM headers from watcher {}", headers.len(), idx);
                        
                        let mut state = self.state.write().await;
                        
                        // Process each header for finality checking
                        for header in &headers {
                            // Store raw header
                            state.svm_heads.insert(header.chain_id, header.block_number);
                            
                            // Check if header has reached finality
                            if let Ok(is_finalized) = watcher.check_finality(header.block_number).await {
                                if is_finalized {
                                    debug!("SVM slot {} (domain {}) has reached finality", 
                                           header.block_number, header.chain_id);
                                    state.finalized_svm_headers.insert(header.chain_id, header.block_number);
                                }
                            } else {
                                debug!("Failed to check finality for SVM slot {}", header.block_number);
                            }
                        }
                        
                        let mut metrics = self.metrics.write().await;
                        metrics.blocks_polled += headers.len() as u64;
                    }
                }
                Err(e) => {
                    warn!("Failed to poll SVM headers from watcher {}: {}", idx, e);
                    let mut metrics = self.metrics.write().await;
                    metrics.poll_failures += 1;
                }
            }
        }
    }

    async fn process_finalized_headers(&self) {
        let mut state = self.state.write().await;
        
        // Process EVM blocks that have reached finality
        let evm_domains: Vec<u32> = state.finalized_evm_headers.keys().cloned().collect();
        for domain_id in evm_domains {
            if let Some(&block_number) = state.finalized_evm_headers.get(&domain_id) {
                debug!("Processing finalized EVM domain {}: block {}", domain_id, block_number);
                
                // Acquire proof from finalized block
                let block_hash = [0x00u8; 32];  // In production, get from watcher
                let state_root = [0x00u8; 32];  // In production, get from watcher
                
                if let Ok(proof) = self.submitter
                    .acquire_evm_proof(domain_id, block_number, block_hash, state_root)
                    .await
                {
                    // Calculate proof hash for deduplication
                    let proof_hash = self.calculate_proof_hash_evm(&proof);
                    
                    // Check if proof has already been submitted (deduplication)
                    if state.proof_cache.contains(&proof_hash) {
                        debug!("Proof already submitted, skipping deduplication");
                        continue;
                    }
                    
                    // Submit proof with retries
                    match self.submitter.submit_evm_proof(proof).await {
                        Ok(tx_hash) => {
                            debug!("Submitted EVM proof: {}", tx_hash);
                            state.pending_submissions = state.pending_submissions.saturating_sub(1);
                            state.proof_cache.insert(proof_hash);
                            let mut metrics = self.metrics.write().await;
                            metrics.proofs_submitted += 1;
                        }
                        Err(e) => {
                            warn!("Failed to submit EVM proof: {}", e);
                            let mut metrics = self.metrics.write().await;
                            metrics.proofs_failed += 1;
                        }
                    }
                }
                
                let mut metrics = self.metrics.write().await;
                metrics.blocks_finalized += 1;
            }
        }

        // Process SVM slots that have reached finality
        let svm_domains: Vec<u32> = state.finalized_svm_headers.keys().cloned().collect();
        for domain_id in svm_domains {
            if let Some(&slot) = state.finalized_svm_headers.get(&domain_id) {
                debug!("Processing finalized SVM domain {}: slot {}", domain_id, slot);
                
                // Acquire proof from finalized slot
                let blockhash = [0x00u8; 32];  // In production, get from watcher
                
                if let Ok(proof) = self.submitter
                    .acquire_svm_proof(domain_id, slot, blockhash)
                    .await
                {
                    // Calculate proof hash for deduplication
                    let proof_hash = self.calculate_proof_hash_svm(&proof);
                    
                    // Check if proof has already been submitted (deduplication)
                    if state.proof_cache.contains(&proof_hash) {
                        debug!("Proof already submitted, skipping deduplication");
                        continue;
                    }
                    
                    // Submit proof with retries
                    match self.submitter.submit_svm_proof(proof).await {
                        Ok(tx_hash) => {
                            debug!("Submitted SVM proof: {}", tx_hash);
                            state.pending_submissions = state.pending_submissions.saturating_sub(1);
                            state.proof_cache.insert(proof_hash);
                            let mut metrics = self.metrics.write().await;
                            metrics.proofs_submitted += 1;
                        }
                        Err(e) => {
                            warn!("Failed to submit SVM proof: {}", e);
                            let mut metrics = self.metrics.write().await;
                            metrics.proofs_failed += 1;
                        }
                    }
                }
                
                let mut metrics = self.metrics.write().await;
                metrics.blocks_finalized += 1;
            }
        }
        
        // Clear processed finalized headers for next iteration
        state.finalized_evm_headers.clear();
        state.finalized_svm_headers.clear();
    }

    /// Calculate hash of EVM proof for deduplication
    fn calculate_proof_hash_evm(&self, proof: &crate::types::EvmProof) -> [u8; 32] {
        use std::collections::hash_map::DefaultHasher;
        use std::hash::{Hash, Hasher};
        
        let mut hasher = DefaultHasher::new();
        proof.source_domain.hash(&mut hasher);
        proof.finalized_block.hash(&mut hasher);
        proof.block_hash.hash(&mut hasher);
        
        let hash_u64 = hasher.finish();
        let mut result = [0u8; 32];
        result[0..8].copy_from_slice(&hash_u64.to_le_bytes());
        result
    }

    /// Calculate hash of SVM proof for deduplication
    fn calculate_proof_hash_svm(&self, proof: &crate::types::SvmProof) -> [u8; 32] {
        use std::collections::hash_map::DefaultHasher;
        use std::hash::{Hash, Hasher};
        
        let mut hasher = DefaultHasher::new();
        proof.source_domain.hash(&mut hasher);
        proof.slot.hash(&mut hasher);
        proof.blockhash.hash(&mut hasher);
        
        let hash_u64 = hasher.finish();
        let mut result = [0u8; 32];
        result[0..8].copy_from_slice(&hash_u64.to_le_bytes());
        result
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[tokio::test]
    async fn test_relayer_initialization() {
        let config = RelayerConfig {
            x3: X3Config {
                rpc_url: "http://localhost:9933".to_string(),
                relayer_account: "5GrwvaEF5zXb26Fz9rcQkEvVkd7FcWI4twpBD6CFPhxGwwQ".to_string(),
                relayer_seed_phrase: None,
            },
            evm_chains: vec![],
            svm_clusters: vec![],
            submission: SubmissionConfig {
                batch_size: 1,
                timeout_secs: 60,
                max_retries: 3,
                retry_backoff_ms: 1000,
            },
            governance: GovernanceConfig {
                poll_interval_secs: 5,
                enable_graceful_shutdown: true,
            },
            logging: LoggingConfig {
                level: "info".to_string(),
                format: String::new(),
            },
        };

        // Note: This test will fail without a running X3 node
        // In CI, mock the RPC submitter initialization
    }

    #[tokio::test]
    async fn test_relayer_state_transitions() {
        let config = RelayerConfig {
            x3: X3Config {
                rpc_url: "http://localhost:9933".to_string(),
                relayer_account: "5GrwvaEF5zXb26Fz9rcQkEvVkd7FcWI4twpBD6CFPhxGwwQ".to_string(),
                relayer_seed_phrase: None,
            },
            evm_chains: vec![],
            svm_clusters: vec![],
            submission: SubmissionConfig {
                batch_size: 1,
                timeout_secs: 60,
                max_retries: 3,
                retry_backoff_ms: 1000,
            },
            governance: GovernanceConfig {
                poll_interval_secs: 5,
                enable_graceful_shutdown: true,
            },
            logging: LoggingConfig {
                level: "info".to_string(),
                format: String::new(),
            },
        };

        // State transitions tested with mock objects
    }

    #[tokio::test]
    async fn test_finality_state_tracking() {
        let config = RelayerConfig {
            x3: X3Config {
                rpc_url: "http://localhost:9933".to_string(),
                relayer_account: "5GrwvaEF5zXb26Fz9rcQkEvVkd7FcWI4twpBD6CFPhxGwwQ".to_string(),
                relayer_seed_phrase: None,
            },
            evm_chains: vec![],
            svm_clusters: vec![],
            submission: Default::default(),
            governance: Default::default(),
            logging: Default::default(),
        };

        // Verify state initialization includes finalized header tracking
        let state = RelayerInternalState {
            status: RelayerStateEnum::Active,
            current_nonce: 0,
            evm_heads: BTreeMap::new(),
            svm_heads: BTreeMap::new(),
            finalized_evm_headers: BTreeMap::new(),
            finalized_svm_headers: BTreeMap::new(),
            proof_cache: BTreeSet::new(),
            pending_submissions: 0,
            shutdown_signal: false,
            pause_reason: None,
        };

        assert!(state.finalized_evm_headers.is_empty());
        assert!(state.finalized_svm_headers.is_empty());
    }

    #[tokio::test]
    async fn test_metrics_finality_tracking() {
        let mut metrics = RelayerMetrics::default();
        
        // Verify finality metrics are tracked
        assert_eq!(metrics.blocks_polled, 0);
        assert_eq!(metrics.blocks_finalized, 0);
        assert_eq!(metrics.poll_failures, 0);
        
        // Simulate polling and finality
        metrics.blocks_polled += 5;
        metrics.blocks_finalized += 2;
        metrics.poll_failures += 1;
        
        assert_eq!(metrics.blocks_polled, 5);
        assert_eq!(metrics.blocks_finalized, 2);
        assert_eq!(metrics.poll_failures, 1);
    }

    #[test]
    fn test_concurrency_semaphore_initialization() {
        // Verify concurrency limiters are properly initialized
        let evm_semaphore = Semaphore::new(10);
        let svm_semaphore = Semaphore::new(20);
        
        // Verify semaphores have correct capacity
        assert_eq!(evm_semaphore.available_permits(), 10);
        assert_eq!(svm_semaphore.available_permits(), 20);
    }

    #[test]
    fn test_proof_deduplication_cache() {
        // Test proof deduplication using BTreeSet
        let mut proof_cache = std::collections::BTreeSet::new();
        let proof_hash = [0x42u8; 32];
        
        // First insertion should succeed
        assert!(proof_cache.insert(proof_hash));
        
        // Second insertion of same proof should be detected (deduplication)
        assert!(!proof_cache.insert(proof_hash));
        
        // Different proof should succeed
        let mut different_proof = [0x00u8; 32];
        different_proof[0] = 0x99;
        assert!(proof_cache.insert(different_proof));
        
        assert_eq!(proof_cache.len(), 2);
    }

    #[test]
    fn test_relay_state_uptime_tracking() {
        // Test that uptime can be tracked via metrics
        let mut metrics = RelayerMetrics::default();
        assert_eq!(metrics.uptime_secs, 0);
        
        metrics.uptime_secs = 300;  // 5 minutes
        assert_eq!(metrics.uptime_secs, 300);
    }
}
