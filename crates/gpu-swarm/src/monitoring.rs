//! Monitoring and Observability Module
//!
//! Comprehensive monitoring, metrics collection, distributed tracing,
//! and structured logging for production operations.

use std::sync::Arc;
use std::collections::HashMap;
use prometheus::{Counter, Gauge, Histogram, Registry, Result as PrometheusResult};
use tracing::{info, debug, warn, error};
use serde::{Serialize, Deserialize};
use std::time::{Duration, SystemTime};

/// Metrics collector for swarm operations
pub struct MetricsCollector {
    /// Prometheus registry
    registry: Registry,

    // Task metrics
    pub tasks_submitted: Counter,
    pub tasks_completed: Counter,
    pub tasks_failed: Counter,
    pub task_execution_time: Histogram,
    pub task_queue_size: Gauge,

    // GPU metrics
    pub gpu_utilization: Gauge,
    pub gpu_memory_used: Gauge,
    pub gpu_temperature: Gauge,
    pub gpu_power_consumption: Gauge,
    pub gpu_compute_throughput: Gauge,

    // Network metrics
    pub network_messages_sent: Counter,
    pub network_messages_received: Counter,
    pub network_peers_connected: Gauge,
    pub network_peer_latency: Histogram,
    pub network_bytes_sent: Counter,
    pub network_bytes_received: Counter,

    // Verification metrics
    pub verification_consensus_reached: Counter,
    pub verification_consensus_failed: Counter,
    pub verification_time: Histogram,

    // Economic metrics
    pub rewards_distributed: Gauge,
    pub slashing_events: Counter,
    pub reputation_score: Gauge,

    // System metrics
    pub node_uptime: Gauge,
    pub node_cpu_usage: Gauge,
    pub node_memory_usage: Gauge,
    pub sync_lag: Gauge,
}

impl MetricsCollector {
    /// Create a new metrics collector
    pub fn new() -> PrometheusResult<Self> {
        let registry = Registry::new();

        let tasks_submitted = Counter::with_opts(
            prometheus::CounterOpts::new(
                "swarm_tasks_submitted_total",
                "Total number of tasks submitted",
            ),
        )?;
        registry.register(Box::new(tasks_submitted.clone()))?;

        let tasks_completed = Counter::with_opts(
            prometheus::CounterOpts::new(
                "swarm_tasks_completed_total",
                "Total number of tasks completed successfully",
            ),
        )?;
        registry.register(Box::new(tasks_completed.clone()))?;

        let tasks_failed = Counter::with_opts(
            prometheus::CounterOpts::new(
                "swarm_tasks_failed_total",
                "Total number of tasks failed",
            ),
        )?;
        registry.register(Box::new(tasks_failed.clone()))?;

        let task_execution_time = Histogram::with_opts(
            prometheus::HistogramOpts::new(
                "swarm_task_execution_time_seconds",
                "Task execution time in seconds",
            )
            .buckets(vec![0.1, 0.5, 1.0, 5.0, 10.0, 30.0, 60.0, 300.0]),
        )?;
        registry.register(Box::new(task_execution_time.clone()))?;

        let task_queue_size = Gauge::with_opts(
            prometheus::GaugeOpts::new("swarm_task_queue_size", "Current task queue size"),
        )?;
        registry.register(Box::new(task_queue_size.clone()))?;

        let gpu_utilization = Gauge::with_opts(
            prometheus::GaugeOpts::new("gpu_utilization_percent", "GPU utilization percentage"),
        )?;
        registry.register(Box::new(gpu_utilization.clone()))?;

        let gpu_memory_used = Gauge::with_opts(
            prometheus::GaugeOpts::new("gpu_memory_used_bytes", "GPU memory used in bytes"),
        )?;
        registry.register(Box::new(gpu_memory_used.clone()))?;

        let gpu_temperature = Gauge::with_opts(
            prometheus::GaugeOpts::new("gpu_temperature_celsius", "GPU temperature in Celsius"),
        )?;
        registry.register(Box::new(gpu_temperature.clone()))?;

        let gpu_power_consumption = Gauge::with_opts(
            prometheus::GaugeOpts::new("gpu_power_consumption_watts", "GPU power consumption in watts"),
        )?;
        registry.register(Box::new(gpu_power_consumption.clone()))?;

        let gpu_compute_throughput = Gauge::with_opts(
            prometheus::GaugeOpts::new("gpu_compute_throughput_gflops", "GPU compute throughput in GFLOPS"),
        )?;
        registry.register(Box::new(gpu_compute_throughput.clone()))?;

        let network_messages_sent = Counter::with_opts(
            prometheus::CounterOpts::new(
                "swarm_network_messages_sent_total",
                "Total messages sent over network",
            ),
        )?;
        registry.register(Box::new(network_messages_sent.clone()))?;

        let network_messages_received = Counter::with_opts(
            prometheus::CounterOpts::new(
                "swarm_network_messages_received_total",
                "Total messages received over network",
            ),
        )?;
        registry.register(Box::new(network_messages_received.clone()))?;

        let network_peers_connected = Gauge::with_opts(
            prometheus::GaugeOpts::new("swarm_network_peers_connected", "Number of connected peers"),
        )?;
        registry.register(Box::new(network_peers_connected.clone()))?;

        let network_peer_latency = Histogram::with_opts(
            prometheus::HistogramOpts::new(
                "swarm_network_peer_latency_ms",
                "Network latency to peers in milliseconds",
            )
            .buckets(vec![1.0, 5.0, 10.0, 50.0, 100.0, 500.0, 1000.0]),
        )?;
        registry.register(Box::new(network_peer_latency.clone()))?;

        let network_bytes_sent = Counter::with_opts(
            prometheus::CounterOpts::new(
                "swarm_network_bytes_sent_total",
                "Total bytes sent over network",
            ),
        )?;
        registry.register(Box::new(network_bytes_sent.clone()))?;

        let network_bytes_received = Counter::with_opts(
            prometheus::CounterOpts::new(
                "swarm_network_bytes_received_total",
                "Total bytes received over network",
            ),
        )?;
        registry.register(Box::new(network_bytes_received.clone()))?;

        let verification_consensus_reached = Counter::with_opts(
            prometheus::CounterOpts::new(
                "swarm_verification_consensus_reached_total",
                "Times verification consensus was reached",
            ),
        )?;
        registry.register(Box::new(verification_consensus_reached.clone()))?;

        let verification_consensus_failed = Counter::with_opts(
            prometheus::CounterOpts::new(
                "swarm_verification_consensus_failed_total",
                "Times verification consensus was not reached",
            ),
        )?;
        registry.register(Box::new(verification_consensus_failed.clone()))?;

        let verification_time = Histogram::with_opts(
            prometheus::HistogramOpts::new(
                "swarm_verification_time_seconds",
                "Task verification time in seconds",
            )
            .buckets(vec![0.5, 1.0, 5.0, 10.0, 30.0, 60.0]),
        )?;
        registry.register(Box::new(verification_time.clone()))?;

        let rewards_distributed = Gauge::with_opts(
            prometheus::GaugeOpts::new("swarm_rewards_distributed_tokens", "Total rewards distributed"),
        )?;
        registry.register(Box::new(rewards_distributed.clone()))?;

        let slashing_events = Counter::with_opts(
            prometheus::CounterOpts::new("swarm_slashing_events_total", "Total slashing events"),
        )?;
        registry.register(Box::new(slashing_events.clone()))?;

        let reputation_score = Gauge::with_opts(
            prometheus::GaugeOpts::new(
                "swarm_reputation_score",
                "Node reputation score (0-100)",
            ),
        )?;
        registry.register(Box::new(reputation_score.clone()))?;

        let node_uptime = Gauge::with_opts(
            prometheus::GaugeOpts::new("node_uptime_seconds", "Node uptime in seconds"),
        )?;
        registry.register(Box::new(node_uptime.clone()))?;

        let node_cpu_usage = Gauge::with_opts(
            prometheus::GaugeOpts::new("node_cpu_usage_percent", "Node CPU usage percentage"),
        )?;
        registry.register(Box::new(node_cpu_usage.clone()))?;

        let node_memory_usage = Gauge::with_opts(
            prometheus::GaugeOpts::new("node_memory_usage_bytes", "Node memory usage in bytes"),
        )?;
        registry.register(Box::new(node_memory_usage.clone()))?;

        let sync_lag = Gauge::with_opts(
            prometheus::GaugeOpts::new("swarm_sync_lag_blocks", "Blockchain sync lag in blocks"),
        )?;
        registry.register(Box::new(sync_lag.clone()))?;

        Ok(Self {
            registry,
            tasks_submitted,
            tasks_completed,
            tasks_failed,
            task_execution_time,
            task_queue_size,
            gpu_utilization,
            gpu_memory_used,
            gpu_temperature,
            gpu_power_consumption,
            gpu_compute_throughput,
            network_messages_sent,
            network_messages_received,
            network_peers_connected,
            network_peer_latency,
            network_bytes_sent,
            network_bytes_received,
            verification_consensus_reached,
            verification_consensus_failed,
            verification_time,
            rewards_distributed,
            slashing_events,
            reputation_score,
            node_uptime,
            node_cpu_usage,
            node_memory_usage,
            sync_lag,
        })
    }

    /// Gather all metrics as Prometheus text format
    pub fn gather_metrics(&self) -> String {
        let encoder = prometheus::TextEncoder::new();
        let metric_families = self.registry.gather();
        encoder.encode(&metric_families, &mut String::new().as_bytes_mut())
            .unwrap_or_default();
        String::new()
    }
}

impl Default for MetricsCollector {
    fn default() -> Self {
        Self::new().expect("Failed to create MetricsCollector")
    }
}

/// Distributed tracing context
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TraceContext {
    /// Unique trace ID
    pub trace_id: String,

    /// Parent span ID
    pub parent_span_id: Option<String>,

    /// Current span ID
    pub span_id: String,

    /// Baggage items
    pub baggage: HashMap<String, String>,
}

impl TraceContext {
    /// Create a new trace context
    pub fn new() -> Self {
        Self {
            trace_id: uuid::Uuid::new_v4().to_string(),
            parent_span_id: None,
            span_id: uuid::Uuid::new_v4().to_string(),
            baggage: HashMap::new(),
        }
    }

    /// Create a child span from this context
    pub fn child_span(&self) -> Self {
        Self {
            trace_id: self.trace_id.clone(),
            parent_span_id: Some(self.span_id.clone()),
            span_id: uuid::Uuid::new_v4().to_string(),
            baggage: self.baggage.clone(),
        }
    }

    /// Add baggage item
    pub fn with_baggage(mut self, key: String, value: String) -> Self {
        self.baggage.insert(key, value);
        self
    }
}

impl Default for TraceContext {
    fn default() -> Self {
        Self::new()
    }
}

/// Structured logging with correlation IDs
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct LogEvent {
    /// Timestamp
    pub timestamp: SystemTime,

    /// Log level
    pub level: String,

    /// Logger name
    pub logger: String,

    /// Message
    pub message: String,

    /// Trace context
    pub trace_context: Option<TraceContext>,

    /// Additional fields
    pub fields: HashMap<String, serde_json::Value>,
}

impl LogEvent {
    /// Create a new log event
    pub fn new(level: &str, logger: &str, message: impl Into<String>) -> Self {
        Self {
            timestamp: SystemTime::now(),
            level: level.to_string(),
            logger: logger.to_string(),
            message: message.into(),
            trace_context: None,
            fields: HashMap::new(),
        }
    }

    /// Add trace context
    pub fn with_trace_context(mut self, ctx: TraceContext) -> Self {
        self.trace_context = Some(ctx);
        self
    }

    /// Add field
    pub fn with_field(mut self, key: String, value: serde_json::Value) -> Self {
        self.fields.insert(key, value);
        self
    }
}

/// Health check response
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct HealthCheckResponse {
    /// Status
    pub status: String,

    /// Uptime in seconds
    pub uptime_seconds: u64,

    /// Number of connected peers
    pub connected_peers: usize,

    /// Task queue size
    pub task_queue_size: usize,

    /// GPU devices available
    pub gpu_devices_available: usize,

    /// CPU usage percentage
    pub cpu_usage_percent: f32,

    /// Memory usage percentage
    pub memory_usage_percent: f32,

    /// Network sync status
    pub network_sync_status: String,

    /// Last block number
    pub last_block_number: u64,

    /// Is synced
    pub is_synced: bool,

    /// Timestamp
    pub timestamp: i64,
}

/// Alert rule for triggering notifications
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AlertRule {
    /// Alert name
    pub name: String,

    /// Metric to monitor
    pub metric: String,

    /// Condition (e.g., "gt", "lt", "eq")
    pub condition: String,

    /// Threshold value
    pub threshold: f64,

    /// Duration in seconds
    pub duration_seconds: u64,

    /// Alert severity (critical, warning, info)
    pub severity: String,

    /// Description
    pub description: String,
}

impl AlertRule {
    /// Check if this rule should trigger
    pub fn should_trigger(&self, current_value: f64) -> bool {
        match self.condition.as_str() {
            "gt" => current_value > self.threshold,
            "lt" => current_value < self.threshold,
            "eq" => (current_value - self.threshold).abs() < 0.001,
            "gte" => current_value >= self.threshold,
            "lte" => current_value <= self.threshold,
            _ => false,
        }
    }
}
