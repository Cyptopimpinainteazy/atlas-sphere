// crates/gpu-swarm/src/monitoring/tracing.rs
// Distributed tracing setup (OpenTelemetry/Jaeger can be added later)

use std::error::Error;
use tracing_subscriber::{layer::SubscriberExt, util::SubscriberInitExt};

pub fn setup_tracing() -> Result<(), Box<dyn Error>> {
    // Setup tracing subscriber with env-filter and stdout fmt layer
    // TODO: Add OpenTelemetry/Jaeger integration when opentelemetry crates are added to Cargo.toml
    tracing_subscriber::registry()
        .with(tracing_subscriber::fmt::layer().with_writer(std::io::stdout))
        .with(
            tracing_subscriber::EnvFilter::try_from_default_env()
                .unwrap_or_else(|_| "info".parse().unwrap())
        )
        .init();

    ::tracing::info!("✅ Tracing initialized");
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
