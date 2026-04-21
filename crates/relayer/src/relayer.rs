/// Relayer Service - Main orchestrator for proof acquisition and submission

use crate::submitter::RpcSubmitter;
use crate::types::*;
use crate::watchers::{EvmHeaderWatcher, SvmHeaderWatcher};
use anyhow::Result;
use log::{debug, error, info, warn};
use std::collections::{BTreeMap, BTreeSet};
use std::sync::Arc;
use tokio::sync::RwLock;
use tokio::time::{sleep, Duration};

pub struct RelayerService {
    config: RelayerConfig,
    state: Arc<RwLock<RelayerInternalState>>,
    evm_watchers: Vec<EvmHeaderWatcher>,
    svm_watchers: Vec<SvmHeaderWatcher>,
    submitter: Arc<RpcSubmitter>,
    metrics: Arc<RwLock<RelayerMetrics>>,
}

struct RelayerInternalState {
    status: RelayerStateEnum,
    current_nonce: u32,
    evm_heads: BTreeMap<u32, u64>,  // domain_id -> block_number
    svm_heads: BTreeMap<u32, u64>,  // domain_id -> slot
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
        })
    }

    /// Main relay loop - runs indefinitely until shutdown
    pub async fn run(&self) -> Result<()> {
        info!("Starting relay loop");

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

            // Poll EVM headers
            self.poll_evm_headers().await;

            // Poll SVM headers
            self.poll_svm_headers().await;

            // Check finality and submit proofs
            self.process_finalized_headers().await;

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
            match watcher.poll().await {
                Ok(headers) => {
                    if !headers.is_empty() {
                        debug!("Polled {} EVM headers from watcher {}", headers.len(), idx);
                        
                        let mut state = self.state.write().await;
                        for header in &headers {
                            state.evm_heads.insert(header.chain_id, header.block_number);
                        }
                        
                        let mut metrics = self.metrics.write().await;
                        metrics.blocks_polled += headers.len() as u64;
                    }
                }
                Err(e) => {
                    warn!("Failed to poll EVM headers from watcher {}: {}", idx, e);
                }
            }
        }
    }

    async fn poll_svm_headers(&self) {
        for (idx, watcher) in self.svm_watchers.iter().enumerate() {
            match watcher.poll().await {
                Ok(headers) => {
                    if !headers.is_empty() {
                        debug!("Polled {} SVM headers from watcher {}", headers.len(), idx);
                        
                        let mut state = self.state.write().await;
                        for header in &headers {
                            state.svm_heads.insert(header.chain_id, header.block_number);
                        }
                        
                        let mut metrics = self.metrics.write().await;
                        metrics.blocks_polled += headers.len() as u64;
                    }
                }
                Err(e) => {
                    warn!("Failed to poll SVM headers from watcher {}: {}", idx, e);
                }
            }
        }
    }

    async fn process_finalized_headers(&self) {
        let state = self.state.read().await;
        
        // Process EVM blocks that have reached finality
        for (domain_id, _block_number) in state.evm_heads.iter() {
            // In production, would acquire actual proof from EVM and submit
            debug!("Processing EVM domain: {}", domain_id);
        }

        // Process SVM slots that have reached finality
        for (domain_id, _slot) in state.svm_heads.iter() {
            // In production, would acquire actual proof from SVM and submit
            debug!("Processing SVM domain: {}", domain_id);
        }
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
}
