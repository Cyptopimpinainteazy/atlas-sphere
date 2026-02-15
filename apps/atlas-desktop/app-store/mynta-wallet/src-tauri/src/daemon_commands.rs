//! Tauri Commands for Daemon Management

use std::sync::Arc;
use tauri::State;
use tokio::sync::Mutex as TokioMutex;
use serde::{Deserialize, Serialize};

use crate::daemon::{DaemonManager, DaemonStatus};
use crate::chain_params::Network;
use crate::commands::CommandResult;
use crate::rpc::RpcClient;

/// Shared daemon state
pub struct DaemonState {
    pub manager: Arc<TokioMutex<Option<DaemonManager>>>,
    pub rpc: Arc<RpcClient>,
}

impl Default for DaemonState {
    fn default() -> Self {
        Self::new()
    }
}

impl DaemonState {
    pub fn new() -> Self {
        // Try to find the daemon binary
        let binary_path = DaemonManager::find_daemon_binary();
        
        let manager = binary_path.map(DaemonManager::new);
        
        Self {
            manager: Arc::new(TokioMutex::new(manager)),
            rpc: Arc::new(RpcClient::new()),
        }
    }
}

/// Daemon info returned to frontend
#[derive(Debug, Clone, Serialize)]
pub struct DaemonInfo {
    pub available: bool,
    pub binary_path: Option<String>,
    pub status: DaemonStatus,
    pub data_dir: String,
    pub network: Option<String>,
    pub rpc_connected: bool,
}

/// Start daemon parameters
#[derive(Debug, Deserialize)]
pub struct StartDaemonParams {
    pub network: String,
}

// ========== Daemon Commands ==========

#[tauri::command]
pub async fn get_daemon_info(state: State<'_, DaemonState>) -> Result<DaemonInfo, ()> {
    let manager = state.manager.lock().await;
    
    let (available, binary_path, status) = if let Some(ref mgr) = *manager {
        (true, Some(mgr.binary_path().display().to_string()), mgr.status().await)
    } else {
        (false, None, DaemonStatus::Stopped)
    };
    
    let data_dir = DaemonManager::get_default_data_dir();
    
    Ok(DaemonInfo {
        available,
        binary_path,
        status,
        data_dir: data_dir.display().to_string(),
        network: None,
        rpc_connected: state.rpc.is_connected(),
    })
}

#[tauri::command]
pub async fn start_daemon(
    state: State<'_, DaemonState>,
    params: StartDaemonParams,
) -> Result<CommandResult<bool>, ()> {
    let network = match params.network.as_str() {
        "testnet" => Network::Testnet,
        "regtest" => Network::Regtest,
        _ => Network::Mainnet,
    };

    // Get or create manager
    let mgr = {
        let mut manager = state.manager.lock().await;
        if manager.is_none() {
            if let Some(binary_path) = DaemonManager::find_daemon_binary() {
                *manager = Some(DaemonManager::new(binary_path));
            } else {
                return Ok(CommandResult::err("Daemon binary not found"));
            }
        }
        manager.clone()
    };

    // Start daemon
    if let Some(ref mgr) = mgr {
        match mgr.start(network).await {
            Ok(()) => {
                // Connect RPC to the running daemon
                if let Some(config) = mgr.get_rpc_config().await {
                    state.rpc.connect(config);
                } else {
                    tracing::warn!("No RPC config available after daemon start");
                }
                Ok(CommandResult::ok(true))
            }
            Err(e) => Ok(CommandResult::err(e.to_string())),
        }
    } else {
        Ok(CommandResult::err("Daemon manager not available"))
    }
}

#[tauri::command]
pub async fn stop_integrated_daemon(state: State<'_, DaemonState>) -> Result<CommandResult<bool>, ()> {
    let mgr = {
        let manager = state.manager.lock().await;
        manager.clone()
    };
    
    if let Some(ref mgr) = mgr {
        match mgr.stop().await {
            Ok(()) => {
                state.rpc.disconnect();
                Ok(CommandResult::ok(true))
            }
            Err(e) => Ok(CommandResult::err(e.to_string())),
        }
    } else {
        Ok(CommandResult::ok(true)) // Not running anyway
    }
}

#[tauri::command]
pub async fn get_daemon_status(state: State<'_, DaemonState>) -> Result<DaemonStatus, ()> {
    let manager = state.manager.lock().await;
    
    if let Some(ref mgr) = *manager {
        Ok(mgr.status().await)
    } else {
        Ok(DaemonStatus::Stopped)
    }
}

#[tauri::command]
pub async fn is_daemon_running(state: State<'_, DaemonState>) -> Result<bool, ()> {
    let manager = state.manager.lock().await;
    
    if let Some(ref mgr) = *manager {
        Ok(mgr.is_running())
    } else {
        Ok(false)
    }
}

#[tauri::command]
pub async fn check_daemon_binary() -> Result<CommandResult<String>, ()> {
    match DaemonManager::find_daemon_binary() {
        Some(path) => Ok(CommandResult::ok(path.display().to_string())),
        None => Ok(CommandResult::err("Daemon binary not found. Please ensure myntad is installed or bundled with the application.")),
    }
}

