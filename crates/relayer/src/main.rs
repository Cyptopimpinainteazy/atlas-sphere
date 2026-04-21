/// X3 Relayer Service - Main entry point
///
/// This service watches EVM (Sepolia testnet) and SVM (Solana testnet) chains,
/// acquires finalized proofs, and submits them to the X3 runtime for cross-chain
/// proof aggregation and settlement.
///
/// Configuration Precedence:
/// 1. Environment variables (X3_RPC_URL, X3_RELAYER_ACCOUNT, etc.)
/// 2. Configuration file (YAML, argument or default relayer-config.yaml)
/// 3. Default values in types.rs
///
/// Environment Variables:
/// - X3_RPC_URL: X3 runtime RPC endpoint
/// - X3_RELAYER_ACCOUNT: Relayer account address
/// - X3_RELAYER_SEED_PHRASE: Relayer account seed phrase (optional)
/// - X3_LOG_LEVEL: Log level (debug, info, warn, error)
/// - X3_CONFIG_PATH: Configuration file path (overrides argument)

mod relayer;
mod submitter;
mod types;
mod watchers;

use anyhow::{anyhow, Context, Result};
use log::{info, warn, error};
use relayer::RelayerService;
use std::env;
use std::fs;
use std::path::Path;
use std::sync::Arc;
use tokio::signal;
use types::RelayerConfig;

const DEFAULT_CONFIG_PATH: &str = "relayer-config.yaml";
const LOG_LEVEL_ENV: &str = "X3_LOG_LEVEL";
const RPC_URL_ENV: &str = "X3_RPC_URL";
const RELAYER_ACCOUNT_ENV: &str = "X3_RELAYER_ACCOUNT";
const RELAYER_SEED_ENV: &str = "X3_RELAYER_SEED_PHRASE";
const CONFIG_PATH_ENV: &str = "X3_CONFIG_PATH";

#[tokio::main]
async fn main() -> Result<()> {
    // Initialize logging with environment variable support
    let log_level = env::var(LOG_LEVEL_ENV)
        .unwrap_or_else(|_| "info".to_string());
    
    env_logger::Builder::from_default_env()
        .filter_level(log_level.parse().unwrap_or(log::LevelFilter::Info))
        .format_timestamp_millis()
        .init();

    info!("═══════════════════════════════════════════════════════════");
    info!("X3 Relayer Service starting (Phase 13c)");
    info!("═══════════════════════════════════════════════════════════");

    // Determine configuration path (env var > command arg > default)
    let config_path = env::var(CONFIG_PATH_ENV)
        .ok()
        .or_else(|| env::args().nth(1))
        .unwrap_or_else(|| DEFAULT_CONFIG_PATH.to_string());

    // Load and validate configuration
    let mut config = load_config(&config_path)
        .with_context(|| format!("Failed to load configuration from {}", config_path))?;

    // Apply environment variable overrides
    apply_environment_overrides(&mut config)?;

    // Validate configuration
    validate_config(&config)?;

    info!("Configuration loaded and validated");
    info!("  X3 RPC: {}", config.x3.rpc_url);
    info!("  Relayer Account: {}", config.x3.relayer_account);
    info!("  EVM Chains: {}", config.evm_chains.len());
    info!("  SVM Clusters: {}", config.svm_clusters.len());
    info!("  Log Level: {}", log_level);

    // Initialize relayer service
    info!("Initializing RelayerService...");
    let relayer = Arc::new(
        RelayerService::new(config)
            .await
            .context("Failed to initialize RelayerService")?
    );
    info!("RelayerService initialized successfully");

    // Setup signal handling for graceful shutdown
    let relayer_clone = Arc::clone(&relayer);
    let shutdown_handle = tokio::spawn(async move {
        let _ = signal::ctrl_c().await;
        warn!("SIGINT received, initiating graceful shutdown");
        relayer_clone.shutdown().await;
    });

    // Run the relay loop
    let relay_handle = tokio::spawn(async move {
        if let Err(e) = relayer.run().await {
            error!("Relay loop error: {}", e);
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

    info!("═══════════════════════════════════════════════════════════");
    info!("X3 Relayer Service exiting");
    info!("═══════════════════════════════════════════════════════════");
    Ok(())
}

/// Load configuration from YAML file
fn load_config(config_path: &str) -> Result<RelayerConfig> {
    info!("Loading configuration from: {}", config_path);
    
    if !Path::new(config_path).exists() {
        return Err(anyhow!(
            "Configuration file not found: {}. \
             Create one or specify path via {} env var or command argument",
            config_path, CONFIG_PATH_ENV
        ));
    }

    let config_content = fs::read_to_string(config_path)
        .with_context(|| format!("Failed to read configuration file: {}", config_path))?;
    
    let config: RelayerConfig = serde_yaml::from_str(&config_content)
        .with_context(|| format!("Failed to parse YAML configuration from: {}", config_path))?;

    info!("Configuration file parsed successfully");
    Ok(config)
}

/// Apply environment variable overrides to configuration
fn apply_environment_overrides(config: &mut RelayerConfig) -> Result<()> {
    // Override X3 RPC URL if environment variable is set
    if let Ok(rpc_url) = env::var(RPC_URL_ENV) {
        info!("Applying {} environment override", RPC_URL_ENV);
        config.x3.rpc_url = rpc_url;
    }

    // Override relayer account if environment variable is set
    if let Ok(relayer_account) = env::var(RELAYER_ACCOUNT_ENV) {
        info!("Applying {} environment override", RELAYER_ACCOUNT_ENV);
        config.x3.relayer_account = relayer_account;
    }

    // Apply seed phrase from environment if available
    if let Ok(seed_phrase) = env::var(RELAYER_SEED_ENV) {
        info!("Applying {} environment override", RELAYER_SEED_ENV);
        config.x3.relayer_seed_phrase = Some(seed_phrase);
    }

    Ok(())
}

/// Validate configuration for required fields and valid values
fn validate_config(config: &RelayerConfig) -> Result<()> {
    // Validate X3 configuration
    if config.x3.rpc_url.is_empty() {
        return Err(anyhow!(
            "X3 RPC URL is empty. Set via X3_RPC_URL env var or config file"
        ));
    }

    if !config.x3.rpc_url.starts_with("http://") && !config.x3.rpc_url.starts_with("https://") {
        return Err(anyhow!(
            "Invalid X3 RPC URL format: {}. Must start with http:// or https://",
            config.x3.rpc_url
        ));
    }

    if config.x3.relayer_account.is_empty() {
        return Err(anyhow!(
            "Relayer account is empty. Set via X3_RELAYER_ACCOUNT env var or config file"
        ));
    }

    // Validate EVM chains
    if config.evm_chains.is_empty() {
        warn!("No EVM chains configured - relayer will only watch SVM clusters");
    }

    for evm_chain in &config.evm_chains {
        if evm_chain.name.is_empty() {
            return Err(anyhow!("EVM chain name is empty"));
        }
        if evm_chain.rpc_endpoint.is_empty() {
            return Err(anyhow!("EVM chain {} has empty RPC endpoint", evm_chain.name));
        }
        if evm_chain.finality_threshold == 0 {
            return Err(anyhow!("EVM chain {} has zero finality threshold", evm_chain.name));
        }
    }

    // Validate SVM clusters
    if config.svm_clusters.is_empty() {
        warn!("No SVM clusters configured - relayer will only watch EVM chains");
    }

    for svm_cluster in &config.svm_clusters {
        if svm_cluster.name.is_empty() {
            return Err(anyhow!("SVM cluster name is empty"));
        }
        if svm_cluster.rpc_endpoint.is_empty() {
            return Err(anyhow!("SVM cluster {} has empty RPC endpoint", svm_cluster.name));
        }
        if svm_cluster.finality_threshold == 0 {
            return Err(anyhow!("SVM cluster {} has zero finality threshold", svm_cluster.name));
        }
    }

    // At least one chain must be configured
    if config.evm_chains.is_empty() && config.svm_clusters.is_empty() {
        return Err(anyhow!(
            "No EVM chains or SVM clusters configured. \
             At least one chain/cluster must be configured for relayer to operate"
        ));
    }

    // Validate submission configuration
    if config.submission.batch_size == 0 {
        return Err(anyhow!("Submission batch_size must be > 0"));
    }

    if config.submission.timeout_secs == 0 {
        return Err(anyhow!("Submission timeout_secs must be > 0"));
    }

    info!("Configuration validation passed");
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;
    use types::X3Config;

    #[test]
    fn test_load_config_missing_file() {
        let result = load_config("/nonexistent/path/config.yaml");
        assert!(result.is_err());
        let err_msg = result.unwrap_err().to_string();
        assert!(err_msg.contains("not found"));
    }

    #[test]
    fn test_validate_config_empty_rpc_url() {
        let mut config = RelayerConfig {
            x3: X3Config {
                rpc_url: String::new(),
                relayer_account: "test".to_string(),
                relayer_seed_phrase: None,
            },
            evm_chains: vec![],
            svm_clusters: vec![],
            submission: Default::default(),
            governance: Default::default(),
            logging: Default::default(),
        };
        
        // Need at least one chain
        config.evm_chains.push(types::EvmChainConfig {
            name: "test".to_string(),
            chain_id: 1,
            x3_domain_id: 1,
            rpc_endpoint: "http://localhost:8545".to_string(),
            state_root_contract: "0x0".to_string(),
            finality_threshold: 12,
            block_poll_interval_ms: 1000,
            max_concurrent_requests: 5,
        });
        
        let result = validate_config(&config);
        assert!(result.is_err());
    }

    #[test]
    fn test_apply_environment_overrides() {
        let mut config = RelayerConfig {
            x3: X3Config {
                rpc_url: "http://original:9933".to_string(),
                relayer_account: "original_account".to_string(),
                relayer_seed_phrase: None,
            },
            evm_chains: vec![],
            svm_clusters: vec![],
            submission: Default::default(),
            governance: Default::default(),
            logging: Default::default(),
        };

        // Set environment variables for testing
        env::set_var(RPC_URL_ENV, "http://override:9933");
        env::set_var(RELAYER_ACCOUNT_ENV, "override_account");

        let result = apply_environment_overrides(&mut config);
        assert!(result.is_ok());
        
        // Verify overrides were applied
        assert_eq!(config.x3.rpc_url, "http://override:9933");
        assert_eq!(config.x3.relayer_account, "override_account");

        // Clean up
        env::remove_var(RPC_URL_ENV);
        env::remove_var(RELAYER_ACCOUNT_ENV);
    }
}

