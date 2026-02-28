<<<<<<< HEAD
//! Lightweight integration helpers for the parallel proposer.

use crate::{DeclaredAccess, ParallelProposer, ProposalConfig, ProposalResult, TransactionMeta};
use anyhow::Result;
use std::sync::Arc;

#[derive(Debug, Clone)]
pub struct IntegrationConfig {
    pub proposer_config: ProposalConfig,
=======
//! Integration Module
//!
//! Integrates the parallel-proposer with the existing blockchain system
//! and transaction pool.

use crate::lib::{ParallelProposer, ProposalConfig, TransactionMeta};
use tracing::{info, debug, warn};
use tokio::sync::mpsc;
use anyhow::{Result, anyhow};
use std::sync::Arc;
use std::time::Duration;

/// Integration configuration
#[derive(Debug, Clone)]
pub struct IntegrationConfig {
    pub proposer_config: ProposalConfig,
    pub integration_timeout: u64,
    pub max_integration_attempts: u8,
    pub enable_metrics: bool,
>>>>>>> fac1538ff (big push)
}

impl Default for IntegrationConfig {
    fn default() -> Self {
        Self {
            proposer_config: ProposalConfig::default(),
<<<<<<< HEAD
=======
            integration_timeout: 30,
            max_integration_attempts: 3,
            enable_metrics: true,
>>>>>>> fac1538ff (big push)
        }
    }
}

<<<<<<< HEAD
#[derive(Debug, Clone, Default)]
pub struct IntegrationMetrics {
    pub total_submissions: u64,
    pub total_proposals: u64,
    pub failed_proposals: u64,
}

pub struct IntegrationContext {
    proposer: Arc<ParallelProposer>,
    metrics: tokio::sync::Mutex<IntegrationMetrics>,
}

impl IntegrationContext {
    pub fn new(config: IntegrationConfig) -> Result<Self> {
        Ok(Self {
            proposer: Arc::new(ParallelProposer::new(config.proposer_config)),
            metrics: tokio::sync::Mutex::new(IntegrationMetrics::default()),
        })
    }

    pub fn proposer(&self) -> Arc<ParallelProposer> {
        self.proposer.clone()
    }

    pub async fn submit_transaction(
        &self,
        tx: TransactionMeta,
        declared_access: Option<DeclaredAccess>,
    ) -> Result<()> {
        self.proposer
            .submit_transaction_with_access(tx, declared_access)
            .await?;

        let mut metrics = self.metrics.lock().await;
        metrics.total_submissions = metrics.total_submissions.saturating_add(1);
        Ok(())
    }

    pub async fn build_next_proposal(&self) -> Result<ProposalResult> {
        let result = self.proposer.create_proposal().await;

        let mut metrics = self.metrics.lock().await;
        match &result {
            Ok(_) => {
                metrics.total_proposals = metrics.total_proposals.saturating_add(1);
            }
            Err(_) => {
                metrics.failed_proposals = metrics.failed_proposals.saturating_add(1);
            }
        }

        result
    }

    pub async fn get_metrics(&self) -> IntegrationMetrics {
        self.metrics.lock().await.clone()
=======
/// Integration context
pub struct IntegrationContext {
    proposer: Arc<ParallelProposer>,
    config: IntegrationConfig,
    tx_stream: mpsc::UnboundedSender<TransactionMeta>,
    metrics: Option<IntegrationMetrics>,
}

impl IntegrationContext {
    /// Create new integration context
    pub fn new(config: IntegrationConfig) -> Result<Self> {
        let proposer = Arc::new(ParallelProposer::new(config.proposer_config.clone()));
        let (tx_stream, _rx_stream) = mpsc::unbounded_channel();

        let metrics = if config.enable_metrics {
            Some(IntegrationMetrics::new())
        } else {
            None
        };

        Ok(Self {
            proposer,
            config,
            tx_stream,
            metrics,
        })
    }

    /// Integrate with existing transaction pool
    pub async fn integrate_with_pool(&self, pool: &mut TransactionPool) -> Result<()> {
        info!("Integrating parallel-proposer with transaction pool");

        // Hook into transaction submission
        pool.set_submission_hook(self.tx_stream.clone());

        // Start proposal generation
        self.start_proposal_generation().await?;

        Ok(())
    }

    /// Start proposal generation
    async fn start_proposal_generation(&self) -> Result<()> {
        let proposer = self.proposer.clone();
        let config = self.config.clone();

        tokio::spawn(async move {
            loop {
                // Create proposal
                if let Err(e) = proposer.create_proposal().await {
                    warn!("Proposal generation failed: {}", e);
                }

                // Wait before next proposal
                tokio::time::sleep(Duration::from_secs(config.proposer_config.timeout_seconds)).await;
            }
        });

        Ok(())
    }

    /// Submit transaction through integration
    pub async fn submit_transaction(&self, tx: TransactionMeta) -> Result<()> {
        // Submit to proposer
        self.proposer.submit_transaction(tx).await?;

        // Update metrics
        if let Some(metrics) = &self.metrics {
            metrics.increment_submissions();
        }

        Ok(())
    }

    /// Get integration metrics
    pub fn get_metrics(&self) -> Option<IntegrationMetrics> {
        self.metrics.clone()
    }
}

/// Integration metrics
#[derive(Debug, Clone)]
pub struct IntegrationMetrics {
    pub total_submissions: u64,
    pub successful_proposals: u64,
    pub failed_proposals: u64,
    pub average_processing_time_ms: f64,
    pub current_queue_size: usize,
}

impl IntegrationMetrics {
    fn new() -> Self {
        Self {
            total_submissions: 0,
            successful_proposals: 0,
            failed_proposals: 0,
            average_processing_time_ms: 0.0,
            current_queue_size: 0,
        }
    }

    fn increment_submissions(&mut self) {
        self.total_submissions += 1;
    }

    fn increment_successful_proposals(&mut self) {
        self.successful_proposals += 1;
    }

    fn increment_failed_proposals(&mut self) {
        self.failed_proposals += 1;
    }

    fn update_queue_size(&mut self, size: usize) {
        self.current_queue_size = size;
    }
}

/// Transaction pool with integration hooks
#[derive(Debug)]
pub struct TransactionPool {
    transactions: Vec<TransactionMeta>,
    submission_hook: Option<mpsc::UnboundedSender<TransactionMeta>>,
}

impl TransactionPool {
    /// Create new transaction pool
    pub fn new() -> Self {
        Self {
            transactions: Vec::new(),
            submission_hook: None,
        }
    }

    /// Set submission hook
    pub fn set_submission_hook(&mut self, hook: mpsc::UnboundedSender<TransactionMeta>) {
        self.submission_hook = Some(hook);
    }

    /// Submit transaction
    pub async fn submit(&mut self, tx: TransactionMeta) -> Result<()> {
        // Add to local pool
        self.transactions.push(tx.clone());

        // Forward to integration hook if set
        if let Some(hook) = &self.submission_hook {
            if hook.send(tx).is_err() {
                warn!("Failed to forward transaction to integration hook");
            }
        }

        Ok(())
    }

    /// Get transactions
    pub fn get_transactions(&self) -> Vec<TransactionMeta> {
        self.transactions.clone()
    }

    /// Get pool size
    pub fn size(&self) -> usize {
        self.transactions.len()
>>>>>>> fac1538ff (big push)
    }
}

#[cfg(test)]
mod tests {
    use super::*;

<<<<<<< HEAD
    fn sample_tx(id: &str) -> TransactionMeta {
        TransactionMeta {
            tx_hash: id.to_string(),
            sender: "0x1".to_string(),
            receiver: "0x2".to_string(),
            value: 1,
            gas_limit: 21_000,
            gas_price: 1,
            nonce: 0,
            signature: "0123456789abcdef".to_string(),
            contract_address: Some("0xabc".to_string()),
            timestamp: 1,
        }
    }

    #[tokio::test]
    async fn integration_tracks_submissions_and_proposals() {
        let ctx = IntegrationContext::new(IntegrationConfig::default()).unwrap();
        ctx.submit_transaction(
            sample_tx("tx-1"),
            Some(DeclaredAccess {
                reads: vec!["r:1".to_string()],
                writes: vec!["w:1".to_string()],
            }),
        )
        .await
        .unwrap();

        let _ = ctx.build_next_proposal().await.unwrap();

        let metrics = ctx.get_metrics().await;
        assert_eq!(metrics.total_submissions, 1);
        assert_eq!(metrics.total_proposals, 1);
        assert_eq!(metrics.failed_proposals, 0);
    }
}
=======
    #[tokio::test]
    async fn test_integration_context_creation() {
        let config = IntegrationConfig::default();
        let context = IntegrationContext::new(config).unwrap();

        assert!(context.proposer.is_some());
        assert!(context.tx_stream.is_some());
    }

    #[tokio::test]
    async fn test_transaction_pool() {
        let mut pool = TransactionPool::new();

        let tx = TransactionMeta {
            tx_hash: "test_tx".to_string(),
            sender: "0x1234".to_string(),
            receiver: "0x5678".to_string(),
            value: 1_000_000_000,
            gas_limit: 21_000,
            gas_price: 20_000_000,
            nonce: 1,
            signature: "valid_sig".to_string(),
            contract_address: None,
            timestamp: 1234567890,
        };

        // Submit transaction
        pool.submit(tx.clone()).await.unwrap();

        // Verify transaction in pool
        assert_eq!(pool.size(), 1);
        assert_eq!(pool.get_transactions().len(), 1);
    }
}
>>>>>>> fac1538ff (big push)
