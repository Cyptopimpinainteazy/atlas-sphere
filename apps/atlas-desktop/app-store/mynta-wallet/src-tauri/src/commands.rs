//! Tauri Commands - Frontend API

use serde::{Deserialize, Serialize};
use std::sync::Arc;
use tauri::State;

use crate::rpc::{ConnectionConfig, RpcClient, RpcError};
use crate::chain_params::Network;

/// Wallet state shared across commands
pub struct WalletState {
    pub rpc: Arc<RpcClient>,
}

impl Default for WalletState {
    fn default() -> Self {
        Self {
            rpc: Arc::new(RpcClient::new()),
        }
    }
}

impl WalletState {
    pub fn with_rpc(rpc: Arc<RpcClient>) -> Self {
        Self { rpc }
    }
}

/// Command result wrapper
#[derive(Debug, Serialize)]
pub struct CommandResult<T> {
    pub success: bool,
    pub data: Option<T>,
    pub error: Option<String>,
}

impl<T> CommandResult<T> {
    pub fn ok(data: T) -> Self {
        Self {
            success: true,
            data: Some(data),
            error: None,
        }
    }

    pub fn err(error: impl ToString) -> Self {
        Self {
            success: false,
            data: None,
            error: Some(error.to_string()),
        }
    }
}

impl<T> From<Result<T, RpcError>> for CommandResult<T> {
    fn from(result: Result<T, RpcError>) -> Self {
        match result {
            Ok(data) => CommandResult::ok(data),
            Err(e) => CommandResult::err(e),
        }
    }
}

// ========== Connection Commands ==========

#[derive(Debug, Deserialize)]
pub struct ConnectParams {
    pub host: String,
    pub port: u16,
    pub username: String,
    pub password: String,
    pub network: String,
}

#[tauri::command]
pub async fn connect(
    state: State<'_, WalletState>,
    params: ConnectParams,
) -> Result<CommandResult<bool>, ()> {
    let network = match params.network.as_str() {
        "testnet" => Network::Testnet,
        "regtest" => Network::Regtest,
        _ => Network::Mainnet,
    };

    let config = ConnectionConfig {
        host: params.host,
        port: params.port,
        username: params.username,
        password: params.password,
        network,
    };

    state.rpc.connect(config);

    // Test connection
    match state.rpc.get_blockchain_info().await {
        Ok(_) => Ok(CommandResult::ok(true)),
        Err(e) => {
            state.rpc.disconnect();
            Ok(CommandResult::err(e))
        }
    }
}

#[tauri::command]
pub async fn disconnect(state: State<'_, WalletState>) -> Result<CommandResult<bool>, ()> {
    state.rpc.disconnect();
    Ok(CommandResult::ok(true))
}

#[tauri::command]
pub async fn is_connected(state: State<'_, WalletState>) -> Result<bool, ()> {
    Ok(state.rpc.is_connected())
}

#[tauri::command]
pub async fn get_connection_config(
    state: State<'_, WalletState>,
) -> Result<Option<ConnectionConfig>, ()> {
    Ok(state.rpc.get_config())
}

// ========== Blockchain Commands ==========

#[tauri::command]
pub async fn get_blockchain_info(
    state: State<'_, WalletState>,
) -> Result<CommandResult<crate::rpc::BlockchainInfo>, ()> {
    Ok(state.rpc.get_blockchain_info().await.into())
}

#[tauri::command]
pub async fn get_block_count(state: State<'_, WalletState>) -> Result<CommandResult<u64>, ()> {
    Ok(state.rpc.get_block_count().await.into())
}

#[tauri::command]
pub async fn get_network_info(
    state: State<'_, WalletState>,
) -> Result<CommandResult<crate::rpc::NetworkInfo>, ()> {
    Ok(state.rpc.get_network_info().await.into())
}

#[tauri::command]
pub async fn get_peer_info(
    state: State<'_, WalletState>,
) -> Result<CommandResult<Vec<crate::rpc::PeerInfo>>, ()> {
    Ok(state.rpc.get_peer_info().await.into())
}

#[tauri::command]
pub async fn get_connection_count(state: State<'_, WalletState>) -> Result<CommandResult<u32>, ()> {
    Ok(state.rpc.get_connection_count().await.into())
}

#[tauri::command]
pub async fn get_mining_info(
    state: State<'_, WalletState>,
) -> Result<CommandResult<crate::rpc::MiningInfo>, ()> {
    Ok(state.rpc.get_mining_info().await.into())
}

// ========== Wallet Commands ==========

#[tauri::command]
pub async fn get_balance(
    state: State<'_, WalletState>,
    min_conf: Option<u32>,
) -> Result<CommandResult<f64>, ()> {
    Ok(state.rpc.get_balance(min_conf).await.into())
}

#[tauri::command]
pub async fn get_unconfirmed_balance(
    state: State<'_, WalletState>,
) -> Result<CommandResult<f64>, ()> {
    Ok(state.rpc.get_unconfirmed_balance().await.into())
}

#[tauri::command]
pub async fn get_new_address(
    state: State<'_, WalletState>,
    label: Option<String>,
) -> Result<CommandResult<String>, ()> {
    Ok(state.rpc.get_new_address(label.as_deref()).await.into())
}

#[tauri::command]
pub async fn validate_address(
    state: State<'_, WalletState>,
    address: String,
) -> Result<CommandResult<crate::rpc::AddressInfo>, ()> {
    Ok(state.rpc.validate_address(&address).await.into())
}

#[tauri::command]
pub async fn send_to_address(
    state: State<'_, WalletState>,
    address: String,
    amount: f64,
    comment: Option<String>,
) -> Result<CommandResult<String>, ()> {
    Ok(state
        .rpc
        .send_to_address(&address, amount, comment.as_deref())
        .await
        .into())
}

#[tauri::command]
pub async fn list_transactions(
    state: State<'_, WalletState>,
    count: Option<u32>,
    skip: Option<u32>,
) -> Result<CommandResult<Vec<crate::rpc::Transaction>>, ()> {
    Ok(state.rpc.list_transactions(count, skip).await.into())
}

#[tauri::command]
pub async fn get_transaction(
    state: State<'_, WalletState>,
    txid: String,
) -> Result<CommandResult<crate::rpc::TransactionDetail>, ()> {
    Ok(state.rpc.get_transaction(&txid).await.into())
}

#[tauri::command]
pub async fn list_unspent(
    state: State<'_, WalletState>,
    min_conf: Option<u32>,
    max_conf: Option<u32>,
) -> Result<CommandResult<Vec<crate::rpc::Utxo>>, ()> {
    Ok(state.rpc.list_unspent(min_conf, max_conf).await.into())
}

#[tauri::command]
pub async fn get_wallet_info(
    state: State<'_, WalletState>,
) -> Result<CommandResult<crate::rpc::WalletInfo>, ()> {
    Ok(state.rpc.get_wallet_info().await.into())
}

#[tauri::command]
pub async fn encrypt_wallet(
    state: State<'_, WalletState>,
    passphrase: String,
) -> Result<CommandResult<String>, ()> {
    Ok(state.rpc.encrypt_wallet(&passphrase).await.into())
}

#[tauri::command]
pub async fn wallet_lock(state: State<'_, WalletState>) -> Result<CommandResult<bool>, ()> {
    match state.rpc.wallet_lock().await {
        Ok(_) => Ok(CommandResult::ok(true)),
        Err(e) => Ok(CommandResult::err(e)),
    }
}

#[tauri::command]
pub async fn wallet_unlock(
    state: State<'_, WalletState>,
    passphrase: String,
    timeout: u32,
) -> Result<CommandResult<bool>, ()> {
    match state.rpc.wallet_passphrase(&passphrase, timeout).await {
        Ok(_) => Ok(CommandResult::ok(true)),
        Err(e) => Ok(CommandResult::err(e)),
    }
}

#[tauri::command]
pub async fn backup_wallet(
    state: State<'_, WalletState>,
    destination: String,
) -> Result<CommandResult<bool>, ()> {
    match state.rpc.backup_wallet(&destination).await {
        Ok(_) => Ok(CommandResult::ok(true)),
        Err(e) => Ok(CommandResult::err(e)),
    }
}

#[tauri::command]
pub async fn dump_privkey(
    state: State<'_, WalletState>,
    address: String,
) -> Result<CommandResult<String>, ()> {
    Ok(state.rpc.dump_privkey(&address).await.into())
}

#[tauri::command]
pub async fn import_privkey(
    state: State<'_, WalletState>,
    privkey: String,
    label: Option<String>,
    rescan: bool,
) -> Result<CommandResult<bool>, ()> {
    match state
        .rpc
        .import_privkey(&privkey, label.as_deref(), rescan)
        .await
    {
        Ok(_) => Ok(CommandResult::ok(true)),
        Err(e) => Ok(CommandResult::err(e)),
    }
}

// ========== Asset Commands ==========

#[tauri::command]
pub async fn list_assets(
    state: State<'_, WalletState>,
) -> Result<CommandResult<serde_json::Value>, ()> {
    Ok(state.rpc.list_assets().await.into())
}

#[tauri::command]
pub async fn list_my_assets(
    state: State<'_, WalletState>,
) -> Result<CommandResult<serde_json::Value>, ()> {
    Ok(state.rpc.list_my_assets().await.into())
}

#[tauri::command]
pub async fn get_asset_data(
    state: State<'_, WalletState>,
    asset_name: String,
) -> Result<CommandResult<crate::rpc::AssetData>, ()> {
    Ok(state.rpc.get_asset_data(&asset_name).await.into())
}

#[derive(Debug, Deserialize)]
pub struct IssueAssetParams {
    pub name: String,
    pub qty: f64,
    pub units: u8,
    pub reissuable: bool,
    pub has_ipfs: bool,
    pub ipfs_hash: Option<String>,
}

#[tauri::command]
pub async fn issue_asset(
    state: State<'_, WalletState>,
    params: IssueAssetParams,
) -> Result<CommandResult<Vec<String>>, ()> {
    Ok(state
        .rpc
        .issue_asset(
            &params.name,
            params.qty,
            params.units,
            params.reissuable,
            params.has_ipfs,
            params.ipfs_hash.as_deref(),
        )
        .await
        .into())
}

#[tauri::command]
pub async fn transfer_asset(
    state: State<'_, WalletState>,
    asset_name: String,
    qty: f64,
    to_address: String,
) -> Result<CommandResult<String>, ()> {
    Ok(state
        .rpc
        .transfer_asset(&asset_name, qty, &to_address)
        .await
        .into())
}

#[tauri::command]
pub async fn reissue_asset(
    state: State<'_, WalletState>,
    asset_name: String,
    qty: f64,
    reissuable: bool,
) -> Result<CommandResult<String>, ()> {
    Ok(state
        .rpc
        .reissue_asset(&asset_name, qty, reissuable)
        .await
        .into())
}

// ========== Masternode Commands ==========

#[tauri::command]
pub async fn masternode_count(
    state: State<'_, WalletState>,
) -> Result<CommandResult<crate::rpc::MasternodeCount>, ()> {
    Ok(state.rpc.masternode_count().await.into())
}

#[tauri::command]
pub async fn masternode_list(
    state: State<'_, WalletState>,
    mode: Option<String>,
) -> Result<CommandResult<serde_json::Value>, ()> {
    Ok(state.rpc.masternode_list(mode.as_deref()).await.into())
}

#[tauri::command]
pub async fn masternode_status(
    state: State<'_, WalletState>,
) -> Result<CommandResult<serde_json::Value>, ()> {
    Ok(state.rpc.masternode_status().await.into())
}

#[tauri::command]
pub async fn protx_list(
    state: State<'_, WalletState>,
    detailed: bool,
) -> Result<CommandResult<Vec<serde_json::Value>>, ()> {
    Ok(state.rpc.protx_list(detailed).await.into())
}

// ========== Utility Commands ==========

#[tauri::command]
pub async fn rpc_help(
    state: State<'_, WalletState>,
    command: Option<String>,
) -> Result<CommandResult<String>, ()> {
    Ok(state.rpc.help(command.as_deref()).await.into())
}

#[tauri::command]
pub async fn stop_daemon(state: State<'_, WalletState>) -> Result<CommandResult<String>, ()> {
    Ok(state.rpc.stop().await.into())
}

/// Dashboard data - aggregated for performance
#[derive(Debug, Serialize)]
pub struct DashboardData {
    pub balance: f64,
    pub unconfirmed_balance: f64,
    pub block_height: u64,
    pub connections: u32,
    pub chain: String,
    pub synced: bool,
    pub recent_transactions: Vec<crate::rpc::Transaction>,
}

#[tauri::command]
pub async fn get_dashboard_data(
    state: State<'_, WalletState>,
) -> Result<CommandResult<DashboardData>, ()> {
    let blockchain_info = match state.rpc.get_blockchain_info().await {
        Ok(info) => info,
        Err(e) => {
            tracing::warn!("get_blockchain_info failed: {}", e);
            return Ok(CommandResult::err(e));
        }
    };

    let balance = state.rpc.get_balance(None).await.unwrap_or(0.0);
    let unconfirmed = state.rpc.get_unconfirmed_balance().await.unwrap_or(0.0);
    let connections = state.rpc.get_connection_count().await.unwrap_or(0);
    let transactions = state.rpc.list_transactions(Some(10), None).await.unwrap_or_default();

    let data = DashboardData {
        balance,
        unconfirmed_balance: unconfirmed,
        block_height: blockchain_info.blocks,
        connections,
        chain: blockchain_info.chain,
        synced: blockchain_info.verificationprogress > 0.999,
        recent_transactions: transactions,
    };

    Ok(CommandResult::ok(data))
}


