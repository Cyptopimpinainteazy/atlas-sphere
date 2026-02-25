use axum::{routing::get, Json, Router};
use std::net::SocketAddr;
use crate::telemetry::{REGISTRY, ATOMIC_SWAPS_SUCCESS, ATOMIC_SWAPS_FAILED, TRADES_EXECUTED};
use serde_json::{json, Value};
use tokio::net::TcpListener;
use tracing::info;

pub async fn start_metrics_server(port: u16) {
    let app = Router::new()
        .route("/metrics.json", get(get_metrics_json))
        .route("/health", get(|| async { "OK" }));

    let addr = SocketAddr::from(([0, 0, 0, 0], port));
    info!("📈 Metrics server listening on http://{}", addr);

    let listener = TcpListener::bind(addr).await.unwrap();
    axum::serve(listener, app).await.unwrap();
}

async fn get_metrics_json() -> Json<Value> {
    // Collect Prometheus metrics and format for the Dashboard index.html
    let success = ATOMIC_SWAPS_SUCCESS.get();
    let failed = ATOMIC_SWAPS_FAILED.get();
    let total_swaps = success + failed;
    let success_rate = if total_swaps > 0.0 { success / total_swaps } else { 1.0 };

    Json(json!({
        "timestamp": std::time::SystemTime::now()
            .duration_since(std::time::UNIX_EPOCH)
            .unwrap()
            .as_secs(),
        "svm_tps": 1850000.0, // Mocked live TPS from P4
        "evm_tps": 850000.0,  // Mocked live TPS from P5
        "total_tx": TRADES_EXECUTED.get(),
        "chains_active": 2,
        "gpu_count": 3,
        "gpu_health": "perfect",
        "atomic_success_rate": success_rate,
        "atomic_rollbacks": failed as u64,
        "pending_swaps": 0,
        "uptime_sec": 3600, // TODO: track actual uptime
    }))
}
