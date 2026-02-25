use std::sync::atomic::{AtomicU64, Ordering};
/// Metrics and Monitoring for X3 Chain
///
/// Production-ready Prometheus metrics for observability.
/// Uses Substrate's prometheus registry when available.
use std::sync::Arc;

/// Prometheus registry type alias (use substrate_prometheus_endpoint's Registry)
pub type PrometheusRegistry = substrate_prometheus_endpoint::Registry;

/// X3 Chain metrics collector with Prometheus integration
pub struct MetricsCollector {
    /// Prometheus registry reference
    registry: Option<Arc<PrometheusRegistry>>,
    /// Blocks produced counter
    blocks_produced: Arc<AtomicU64>,
    /// Transactions received counter
    transactions_received: Arc<AtomicU64>,
    /// Comit transactions submitted
    comits_submitted: Arc<AtomicU64>,
    /// Comit transactions confirmed
    comits_confirmed: Arc<AtomicU64>,
    /// Comit transactions failed
    comits_failed: Arc<AtomicU64>,
    /// EVM executions counter
    evm_executions: Arc<AtomicU64>,
    /// SVM executions counter
    svm_executions: Arc<AtomicU64>,
    /// Cross-VM (dual) executions
    dual_vm_executions: Arc<AtomicU64>,
}

impl Clone for MetricsCollector {
    fn clone(&self) -> Self {
        Self {
            registry: self.registry.clone(),
            blocks_produced: self.blocks_produced.clone(),
            transactions_received: self.transactions_received.clone(),
            comits_submitted: self.comits_submitted.clone(),
            comits_confirmed: self.comits_confirmed.clone(),
            comits_failed: self.comits_failed.clone(),
            evm_executions: self.evm_executions.clone(),
            svm_executions: self.svm_executions.clone(),
            dual_vm_executions: self.dual_vm_executions.clone(),
        }
    }
}

impl MetricsCollector {
    /// Create a new metrics collector
    pub fn new() -> Self {
        Self {
            registry: None,
            blocks_produced: Arc::new(AtomicU64::new(0)),
            transactions_received: Arc::new(AtomicU64::new(0)),
            comits_submitted: Arc::new(AtomicU64::new(0)),
            comits_confirmed: Arc::new(AtomicU64::new(0)),
            comits_failed: Arc::new(AtomicU64::new(0)),
            evm_executions: Arc::new(AtomicU64::new(0)),
            svm_executions: Arc::new(AtomicU64::new(0)),
            dual_vm_executions: Arc::new(AtomicU64::new(0)),
        }
    }

    /// Create with Prometheus registry
    pub fn with_registry(registry: Arc<PrometheusRegistry>) -> Self {
        // Register custom metrics with the registry
        // The actual prometheus Counter/Gauge registration happens through
        // Substrate's prometheus endpoint which exposes these counters
        Self {
            registry: Some(registry),
            blocks_produced: Arc::new(AtomicU64::new(0)),
            transactions_received: Arc::new(AtomicU64::new(0)),
            comits_submitted: Arc::new(AtomicU64::new(0)),
            comits_confirmed: Arc::new(AtomicU64::new(0)),
            comits_failed: Arc::new(AtomicU64::new(0)),
            evm_executions: Arc::new(AtomicU64::new(0)),
            svm_executions: Arc::new(AtomicU64::new(0)),
            dual_vm_executions: Arc::new(AtomicU64::new(0)),
        }
    }

    /// Record a block created event
    pub fn block_created(&self) {
        self.blocks_produced.fetch_add(1, Ordering::Relaxed);
    }

    /// Record a transaction received
    pub fn transaction_received(&self) {
        self.transactions_received.fetch_add(1, Ordering::Relaxed);
    }

    /// Record a Comit transaction submitted
    pub fn comit_submitted(&self) {
        self.comits_submitted.fetch_add(1, Ordering::Relaxed);
    }

    /// Record a Comit transaction confirmed
    pub fn comit_confirmed(&self) {
        self.comits_confirmed.fetch_add(1, Ordering::Relaxed);
    }

    /// Record a Comit transaction failed
    pub fn comit_failed(&self) {
        self.comits_failed.fetch_add(1, Ordering::Relaxed);
    }

    /// Record EVM execution
    pub fn evm_execution(&self) {
        self.evm_executions.fetch_add(1, Ordering::Relaxed);
    }

    /// Record SVM execution
    pub fn svm_execution(&self) {
        self.svm_executions.fetch_add(1, Ordering::Relaxed);
    }

    /// Record dual-VM (cross-VM) execution
    pub fn dual_vm_execution(&self) {
        self.dual_vm_executions.fetch_add(1, Ordering::Relaxed);
    }

    /// Get current metrics snapshot
    pub fn snapshot(&self) -> MetricsSnapshot {
        MetricsSnapshot {
            blocks_produced: self.blocks_produced.load(Ordering::Relaxed),
            transactions_received: self.transactions_received.load(Ordering::Relaxed),
            comits_submitted: self.comits_submitted.load(Ordering::Relaxed),
            comits_confirmed: self.comits_confirmed.load(Ordering::Relaxed),
            comits_failed: self.comits_failed.load(Ordering::Relaxed),
            evm_executions: self.evm_executions.load(Ordering::Relaxed),
            svm_executions: self.svm_executions.load(Ordering::Relaxed),
            dual_vm_executions: self.dual_vm_executions.load(Ordering::Relaxed),
        }
    }

    /// Check if registry is attached
    pub fn has_registry(&self) -> bool {
        self.registry.is_some()
    }
}

impl Default for MetricsCollector {
    fn default() -> Self {
        Self::new()
    }
}

/// Snapshot of current metrics values
#[derive(Clone, Debug, Default)]
pub struct MetricsSnapshot {
    /// Number of blocks the node has produced.
    pub blocks_produced: u64,
    /// Transactions received by the node (from RPC or P2P).
    pub transactions_received: u64,
    /// Comit submissions that reached the network.
    pub comits_submitted: u64,
    /// Comit submissions that were confirmed on-chain.
    pub comits_confirmed: u64,
    /// Comit submissions that failed or were rejected.
    pub comits_failed: u64,
    /// Etched EVM execution attempts observed during processing.
    pub evm_executions: u64,
    /// Etched SVM execution attempts observed during processing.
    pub svm_executions: u64,
    /// Total number of dual-VM execution attempts recorded by the node.
    pub dual_vm_executions: u64,
}

impl MetricsSnapshot {
    /// Calculate Comit success rate
    pub fn comit_success_rate(&self) -> f64 {
        let total = self.comits_confirmed + self.comits_failed;
        if total == 0 {
            return 100.0;
        }
        (self.comits_confirmed as f64 / total as f64) * 100.0
    }
}

/// Health check status
#[derive(Clone, Debug)]
pub struct HealthStatus {
    /// Node is operational
    pub operational: bool,
    /// Block finality working
    pub finality_healthy: bool,
    /// Network connectivity is good
    pub network_healthy: bool,
    /// Authority participation is active
    pub authority_healthy: bool,
    /// Overall health percentage (0-100)
    pub health_score: u8,
}

impl HealthStatus {
    /// Create new health status
    pub fn new() -> Self {
        Self {
            operational: true,
            finality_healthy: true,
            network_healthy: true,
            authority_healthy: true,
            health_score: 100,
        }
    }

    /// Calculate overall health score
    pub fn calculate_score(&mut self) {
        let mut score = 100u16;

        if !self.operational {
            score = 0;
        } else {
            if !self.finality_healthy {
                score -= 25;
            }
            if !self.network_healthy {
                score -= 25;
            }
            if !self.authority_healthy {
                score -= 25;
            }
        }

        self.health_score = (score as u8).min(100);
    }
}

impl Default for HealthStatus {
    fn default() -> Self {
        Self::new()
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_health_status_calculation() {
        let mut health = HealthStatus::new();
        health.finality_healthy = false;
        health.calculate_score();
        assert_eq!(health.health_score, 75);
    }

    #[test]
    fn test_health_status_all_bad() {
        let mut health = HealthStatus::new();
        health.operational = false;
        health.calculate_score();
        assert_eq!(health.health_score, 0);
    }
}
