// crates/gpu-swarm/src/monitoring/tracing.rs
// OpenTelemetry/Jaeger tracing setup

use opentelemetry::{global, sdk::trace::Tracer};
use opentelemetry_jaeger::new_agent_pipeline;
use std::error::Error;
use tracing_subscriber::{layer::SubscribedLayer, util::SubscriberInitExt};

pub fn setup_tracing() -> Result<(), Box<dyn Error>> {
    // Create Jaeger exporter
    let tracer = new_agent_pipeline()
        .install_simple()?;

    // Create tracing layer
    let tracer_layer = tracing_opentelemetry::layer().with_tracer(tracer);

    // Setup structured logging with tracing
    tracing_subscriber::registry()
        .with(tracer_layer)
        .with(tracing_subscriber::fmt::layer().with_writer(std::io::stdout))
        .with(
            tracing_subscriber::EnvFilter::try_from_default_env()
                .unwrap_or_else(|_| "info".parse().unwrap())
        )
        .init();

    tracing::info!("✅ Jaeger tracing initialized");
    Ok(())
}

/// Create a span for tracking distributed transactions
#[macro_export]
macro_rules! trace_span {
    ($name:expr) => {
        tracing::debug_span!($name)
    };
}

/// Record an event in the current span
#[macro_export]
macro_rules! trace_event {
    ($level:expr, $($arg:tt)*) => {
        tracing::event!($level, $($arg)*)
    };
}
