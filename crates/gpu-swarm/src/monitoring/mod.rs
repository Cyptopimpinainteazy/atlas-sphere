// crates/gpu-swarm/src/monitoring/mod.rs
// GPU Swarm Monitoring Module - Prometheus metrics, OpenTelemetry integration, logging

pub mod metrics;
pub mod tracing;
pub mod logging;

pub use metrics::MetricsCollector;
pub use tracing::setup_tracing;
pub use logging::setup_logging;

use prometheus::{Registry, Encoder, TextEncoder};
use std::sync::Arc;
use tokio::sync::RwLock;

/// Global metrics registry
pub static METRICS_REGISTRY: once_cell::sync::Lazy<prometheus::Registry> = 
    once_cell::sync::Lazy::new(|| prometheus::Registry::new());

/// Initialize all monitoring subsystems
pub async fn init_monitoring() -> Result<Arc<MetricsCollector>, Box<dyn std::error::Error>> {
    // Setup tracing (OpenTelemetry/Jaeger)
    setup_tracing()?;
    
    // Setup structured logging
    setup_logging()?;
    
    // Initialize metrics collector
    let collector = MetricsCollector::new(METRICS_REGISTRY.clone())?;
    
    tracing::info!("✅ Monitoring subsystems initialized");
    
    Ok(Arc::new(collector))
}

/// Expose metrics endpoint for Prometheus
pub async fn metrics_handler() -> Result<String, Box<dyn std::error::Error>> {
    let encoder = TextEncoder::new();
    let metric_families = METRICS_REGISTRY.gather();
    let mut buffer = vec![];
    encoder.encode(&metric_families, &mut buffer)?;
    Ok(String::from_utf8(buffer)?)
}
