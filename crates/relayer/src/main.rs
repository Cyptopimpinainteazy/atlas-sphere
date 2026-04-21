/// X3 Relayer Service - Main entry point
///
/// This service watches EVM (Sepolia testnet) and SVM (Solana testnet) chains,
/// acquires finalized proofs, and submits them to the X3 runtime for cross-chain
/// proof aggregation and settlement.

mod relayer;
mod submitter;
mod types;
mod watchers;

use anyhow::{anyhow, Result};
use log::info;
use relayer::RelayerService;
use std::fs;
use std::path::Path;
use std::sync::Arc;
use tokio::signal;
use types::RelayerConfig;

#[tokio::main]
async fn main() -> Result<()> {
    // Initialize logging
    env_logger::Builder::from_default_env()
        .filter_level(log::LevelFilter::Info)
        .init();

    info!("X3 Relayer Service starting");

    // Load configuration
    let config_path = std::env::args()
        .nth(1)
        .unwrap_or_else(|| "relayer-config.yaml".to_string());

    let config = load_config(&config_path)?;
    
    info!("Configuration loaded from: {}", config_path);
    info!("Connecting to X3 runtime at: {}", config.x3.rpc_url);
    info!("EVM chains configured: {}", config.evm_chains.len());
    info!("SVM clusters configured: {}", config.svm_clusters.len());

    // Initialize relayer service
    let relayer = Arc::new(RelayerService::new(config).await?);

    // Setup signal handling for graceful shutdown
    let relayer_clone = Arc::clone(&relayer);
    let shutdown_handle = tokio::spawn(async move {
        let _ = signal::ctrl_c().await;
        info!("SIGINT received, initiating graceful shutdown");
        relayer_clone.shutdown().await;
    });

    // Run the relay loop
    let relay_handle = tokio::spawn(async move {
        if let Err(e) = relayer.run().await {
            eprintln!("Relay loop error: {}", e);
            std::process::exit(1);
        }
    });

    // Wait for either the relay loop to end or shutdown signal
    tokio::select! {
        _ = relay_handle => {
            info!("Relay loop exited");
        }
        _ = shutdown_handle => {
            info!("Shutdown complete");
        }
    }

    info!("X3 Relayer Service exiting");
    Ok(())
}

/// Load configuration from YAML file
fn load_config(config_path: &str) -> Result<RelayerConfig> {
    if !Path::new(config_path).exists() {
        return Err(anyhow!(
            "Configuration file not found: {}",
            config_path
        ));
    }

    let config_content = fs::read_to_string(config_path)?;
    let config: RelayerConfig = serde_yaml::from_str(&config_content)?;

    Ok(config)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_load_config_missing_file() {
        let result = load_config("/nonexistent/path/config.yaml");
        assert!(result.is_err());
    }
}
