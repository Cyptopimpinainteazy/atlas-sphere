//! Mynta RPC Client
//! Handles all communication with the myntad daemon

use base64::{engine::general_purpose::STANDARD as BASE64, Engine};
use reqwest::Client;
use serde::{de::DeserializeOwned, Deserialize, Serialize};
use std::sync::Arc;
use parking_lot::RwLock;
use thiserror::Error;

use crate::chain_params::Network;

#[derive(Error, Debug)]
pub enum RpcError {
    #[error("Connection failed: {0}")]
    Connection(String),
    #[error("RPC error ({code}): {message}")]
    Rpc { code: i32, message: String },
    #[error("Parse error: {0}")]
    Parse(String),
    #[error("Node not connected")]
    NotConnected,
}

#[derive(Debug, Serialize)]
struct RpcRequest<'a> {
    jsonrpc: &'a str,
    id: &'a str,
    method: &'a str,
    params: Vec<serde_json::Value>,
}

#[derive(Debug, Deserialize)]
struct RpcResponse<T> {
    result: Option<T>,
    error: Option<RpcErrorDetail>,
    #[allow(dead_code)]
    id: String,
}

#[derive(Debug, Deserialize)]
struct RpcErrorDetail {
    code: i32,
    message: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ConnectionConfig {
    pub host: String,
    pub port: u16,
    pub username: String,
    pub password: String,
    pub network: Network,
}

impl Default for ConnectionConfig {
    fn default() -> Self {
        Self {
            host: "127.0.0.1".to_string(),
            port: 8322,
            username: "mynta".to_string(),
            password: "mynta".to_string(),
            network: Network::Mainnet,
        }
    }
}

pub struct RpcClient {
    client: Client,
    config: Arc<RwLock<Option<ConnectionConfig>>>,
}

impl RpcClient {
    pub fn new() -> Self {
        Self {
            client: Client::builder()
                .timeout(std::time::Duration::from_secs(30))
                .build()
                .expect("Failed to create HTTP client"),
            config: Arc::new(RwLock::new(None)),
        }
    }

    pub fn connect(&self, config: ConnectionConfig) {
        *self.config.write() = Some(config);
    }

    pub fn disconnect(&self) {
        *self.config.write() = None;
    }

    pub fn is_connected(&self) -> bool {
        self.config.read().is_some()
    }

    pub fn get_config(&self) -> Option<ConnectionConfig> {
        self.config.read().clone()
    }

    async fn call<T: DeserializeOwned>(
        &self,
        method: &str,
        params: Vec<serde_json::Value>,
    ) -> Result<T, RpcError> {
        let config = self.config.read().clone().ok_or(RpcError::NotConnected)?;

        let url = format!("http://{}:{}", config.host, config.port);
        let auth = BASE64.encode(format!("{}:{}", config.username, config.password));

        let request = RpcRequest {
            jsonrpc: "1.0",
            id: "wallet",
            method,
            params,
        };

        let response = self
            .client
            .post(&url)
            .header("Authorization", format!("Basic {}", auth))
            .header("Content-Type", "application/json")
            .json(&request)
            .send()
            .await
            .map_err(|e| RpcError::Connection(e.to_string()))?;

        let rpc_response: RpcResponse<T> = response
            .json()
            .await
            .map_err(|e| RpcError::Parse(e.to_string()))?;

        if let Some(error) = rpc_response.error {
            return Err(RpcError::Rpc {
                code: error.code,
                message: error.message,
            });
        }

        rpc_response
            .result
            .ok_or_else(|| RpcError::Parse("No result in response".to_string()))
    }

    // ========== Blockchain Info ==========

    pub async fn get_blockchain_info(&self) -> Result<BlockchainInfo, RpcError> {
        self.call("getblockchaininfo", vec![]).await
    }

    pub async fn get_block_count(&self) -> Result<u64, RpcError> {
        self.call("getblockcount", vec![]).await
    }

    pub async fn get_best_block_hash(&self) -> Result<String, RpcError> {
        self.call("getbestblockhash", vec![]).await
    }

    pub async fn get_network_info(&self) -> Result<NetworkInfo, RpcError> {
        self.call("getnetworkinfo", vec![]).await
    }

    pub async fn get_peer_info(&self) -> Result<Vec<PeerInfo>, RpcError> {
        self.call("getpeerinfo", vec![]).await
    }

    pub async fn get_connection_count(&self) -> Result<u32, RpcError> {
        self.call("getconnectioncount", vec![]).await
    }

    // ========== Wallet ==========

    pub async fn get_balance(&self, min_conf: Option<u32>) -> Result<f64, RpcError> {
        let params = match min_conf {
            Some(conf) => vec!["*".into(), conf.into()],
            None => vec![],
        };
        self.call("getbalance", params).await
    }

    pub async fn get_unconfirmed_balance(&self) -> Result<f64, RpcError> {
        self.call("getunconfirmedbalance", vec![]).await
    }

    pub async fn get_new_address(&self, label: Option<&str>) -> Result<String, RpcError> {
        let params = match label {
            Some(l) => vec![l.into()],
            None => vec!["".into()],
        };
        self.call("getnewaddress", params).await
    }

    pub async fn get_addresses_by_label(&self, label: &str) -> Result<serde_json::Value, RpcError> {
        self.call("getaddressesbylabel", vec![label.into()]).await
    }

    pub async fn list_labels(&self) -> Result<Vec<String>, RpcError> {
        self.call("listlabels", vec![]).await
    }

    pub async fn validate_address(&self, address: &str) -> Result<AddressInfo, RpcError> {
        self.call("validateaddress", vec![address.into()]).await
    }

    pub async fn send_to_address(
        &self,
        address: &str,
        amount: f64,
        comment: Option<&str>,
    ) -> Result<String, RpcError> {
        let mut params: Vec<serde_json::Value> = vec![address.into(), amount.into()];
        if let Some(c) = comment {
            params.push(c.into());
        }
        self.call("sendtoaddress", params).await
    }

    pub async fn send_many(
        &self,
        amounts: std::collections::HashMap<String, f64>,
    ) -> Result<String, RpcError> {
        let amounts_json = serde_json::to_value(amounts).unwrap();
        self.call("sendmany", vec!["".into(), amounts_json]).await
    }

    pub async fn list_transactions(
        &self,
        count: Option<u32>,
        skip: Option<u32>,
    ) -> Result<Vec<Transaction>, RpcError> {
        let count = count.unwrap_or(50);
        let skip = skip.unwrap_or(0);
        self.call("listtransactions", vec!["*".into(), count.into(), skip.into()])
            .await
    }

    pub async fn get_transaction(&self, txid: &str) -> Result<TransactionDetail, RpcError> {
        self.call("gettransaction", vec![txid.into()]).await
    }

    pub async fn list_unspent(
        &self,
        min_conf: Option<u32>,
        max_conf: Option<u32>,
    ) -> Result<Vec<Utxo>, RpcError> {
        let min = min_conf.unwrap_or(1);
        let max = max_conf.unwrap_or(9999999);
        self.call("listunspent", vec![min.into(), max.into()]).await
    }

    pub async fn get_wallet_info(&self) -> Result<WalletInfo, RpcError> {
        self.call("getwalletinfo", vec![]).await
    }

    pub async fn encrypt_wallet(&self, passphrase: &str) -> Result<String, RpcError> {
        self.call("encryptwallet", vec![passphrase.into()]).await
    }

    pub async fn wallet_lock(&self) -> Result<(), RpcError> {
        let _: serde_json::Value = self.call("walletlock", vec![]).await?;
        Ok(())
    }

    pub async fn wallet_passphrase(&self, passphrase: &str, timeout: u32) -> Result<(), RpcError> {
        let _: serde_json::Value = self
            .call("walletpassphrase", vec![passphrase.into(), timeout.into()])
            .await?;
        Ok(())
    }

    pub async fn dump_privkey(&self, address: &str) -> Result<String, RpcError> {
        self.call("dumpprivkey", vec![address.into()]).await
    }

    pub async fn import_privkey(
        &self,
        privkey: &str,
        label: Option<&str>,
        rescan: bool,
    ) -> Result<(), RpcError> {
        let label = label.unwrap_or("");
        let _: serde_json::Value = self
            .call("importprivkey", vec![privkey.into(), label.into(), rescan.into()])
            .await?;
        Ok(())
    }

    pub async fn backup_wallet(&self, destination: &str) -> Result<(), RpcError> {
        let _: serde_json::Value = self.call("backupwallet", vec![destination.into()]).await?;
        Ok(())
    }

    // ========== Assets ==========

    pub async fn list_assets(&self) -> Result<serde_json::Value, RpcError> {
        self.call("listassets", vec!["*".into(), true.into()]).await
    }

    pub async fn list_my_assets(&self) -> Result<serde_json::Value, RpcError> {
        self.call("listmyassets", vec!["*".into(), true.into()]).await
    }

    pub async fn get_asset_data(&self, asset_name: &str) -> Result<AssetData, RpcError> {
        self.call("getassetdata", vec![asset_name.into()]).await
    }

    pub async fn issue_asset(
        &self,
        asset_name: &str,
        qty: f64,
        units: u8,
        reissuable: bool,
        has_ipfs: bool,
        ipfs_hash: Option<&str>,
    ) -> Result<Vec<String>, RpcError> {
        let mut params: Vec<serde_json::Value> = vec![
            asset_name.into(),
            qty.into(),
            "".into(), // to_address (empty = new address)
            "".into(), // change_address
            units.into(),
            reissuable.into(),
            has_ipfs.into(),
        ];
        if let Some(hash) = ipfs_hash {
            params.push(hash.into());
        }
        self.call("issue", params).await
    }

    pub async fn transfer_asset(
        &self,
        asset_name: &str,
        qty: f64,
        to_address: &str,
    ) -> Result<String, RpcError> {
        self.call("transfer", vec![asset_name.into(), qty.into(), to_address.into()])
            .await
    }

    pub async fn reissue_asset(
        &self,
        asset_name: &str,
        qty: f64,
        reissuable: bool,
    ) -> Result<String, RpcError> {
        self.call(
            "reissue",
            vec![
                asset_name.into(),
                qty.into(),
                "".into(),
                reissuable.into(),
            ],
        )
        .await
    }

    pub async fn list_asset_balances(&self) -> Result<serde_json::Value, RpcError> {
        self.call("listassetbalancesbyaddress", vec!["*".into()]).await
    }

    // ========== Masternodes ==========

    pub async fn masternode_count(&self) -> Result<MasternodeCount, RpcError> {
        self.call("masternode", vec!["count".into()]).await
    }

    pub async fn masternode_list(&self, mode: Option<&str>) -> Result<serde_json::Value, RpcError> {
        let mode = mode.unwrap_or("json");
        self.call("masternode", vec!["list".into(), mode.into()]).await
    }

    pub async fn masternode_status(&self) -> Result<serde_json::Value, RpcError> {
        self.call("masternode", vec!["status".into()]).await
    }

    pub async fn protx_list(&self, detailed: bool) -> Result<Vec<serde_json::Value>, RpcError> {
        self.call("protx", vec!["list".into(), "registered".into(), detailed.into()])
            .await
    }

    // ========== Mining ==========

    pub async fn get_mining_info(&self) -> Result<MiningInfo, RpcError> {
        self.call("getmininginfo", vec![]).await
    }

    pub async fn generate(&self, n_blocks: u32) -> Result<Vec<String>, RpcError> {
        self.call("generate", vec![n_blocks.into()]).await
    }

    // ========== Raw Transactions ==========

    pub async fn get_raw_transaction(
        &self,
        txid: &str,
        verbose: bool,
    ) -> Result<serde_json::Value, RpcError> {
        self.call("getrawtransaction", vec![txid.into(), verbose.into()])
            .await
    }

    pub async fn decode_raw_transaction(&self, hex: &str) -> Result<serde_json::Value, RpcError> {
        self.call("decoderawtransaction", vec![hex.into()]).await
    }

    // ========== Utility ==========

    pub async fn help(&self, command: Option<&str>) -> Result<String, RpcError> {
        let params = match command {
            Some(c) => vec![c.into()],
            None => vec![],
        };
        self.call("help", params).await
    }

    pub async fn stop(&self) -> Result<String, RpcError> {
        self.call("stop", vec![]).await
    }
}

impl Default for RpcClient {
    fn default() -> Self {
        Self::new()
    }
}

// ========== Response Types ==========

/// Blockchain info response - handles varying fields across coin implementations
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(default)]
pub struct BlockchainInfo {
    pub chain: String,
    pub blocks: u64,
    pub headers: u64,
    #[serde(default)]
    pub bestblockhash: String,
    pub difficulty: f64,
    #[serde(default)]
    pub mediantime: u64,
    #[serde(default)]
    pub verificationprogress: f64,
    #[serde(default)]
    pub initialblockdownload: bool,
    #[serde(default)]
    pub chainwork: String,
    pub size_on_disk: Option<u64>,
    #[serde(default)]
    pub pruned: bool,
    #[serde(default)]
    pub warnings: String,
    // Mynta launch countdown fields
    #[serde(default)]
    pub chain_start_time: Option<i64>,
    #[serde(default)]
    pub chain_start_date: Option<String>,
    #[serde(default)]
    pub chain_started: Option<bool>,
    #[serde(default)]
    pub seconds_until_launch: Option<i64>,
    #[serde(default)]
    pub time_until_launch: Option<String>,
}

impl Default for BlockchainInfo {
    fn default() -> Self {
        Self {
            chain: String::new(),
            blocks: 0,
            headers: 0,
            bestblockhash: String::new(),
            difficulty: 0.0,
            mediantime: 0,
            verificationprogress: 0.0,
            initialblockdownload: false,
            chainwork: String::new(),
            size_on_disk: None,
            pruned: false,
            warnings: String::new(),
            chain_start_time: None,
            chain_start_date: None,
            chain_started: None,
            seconds_until_launch: None,
            time_until_launch: None,
        }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct NetworkInfo {
    pub version: u32,
    pub subversion: String,
    pub protocolversion: u32,
    pub connections: u32,
    #[serde(default)]
    pub networks: Vec<NetworkDetail>,
    pub relayfee: f64,
    pub localaddresses: Vec<serde_json::Value>,
    #[serde(default)]
    pub warnings: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct NetworkDetail {
    pub name: String,
    pub limited: bool,
    pub reachable: bool,
    pub proxy: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PeerInfo {
    pub id: u64,
    pub addr: String,
    pub addrlocal: Option<String>,
    pub version: u32,
    pub subver: String,
    pub startingheight: i64,
    pub synced_headers: i64,
    pub synced_blocks: i64,
    pub conntime: u64,
    pub inbound: bool,
    pub banscore: Option<u32>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Transaction {
    pub txid: String,
    pub address: Option<String>,
    pub category: String,
    pub amount: f64,
    pub label: Option<String>,
    pub confirmations: i32,
    pub blockhash: Option<String>,
    pub blocktime: Option<u64>,
    pub time: u64,
    pub timereceived: u64,
    #[serde(default)]
    pub fee: Option<f64>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TransactionDetail {
    pub txid: String,
    pub hash: String,
    pub amount: f64,
    pub confirmations: i32,
    pub blockhash: Option<String>,
    pub blocktime: Option<u64>,
    pub time: u64,
    pub timereceived: u64,
    pub details: Vec<TxDetailEntry>,
    pub hex: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TxDetailEntry {
    pub address: Option<String>,
    pub category: String,
    pub amount: f64,
    pub label: Option<String>,
    pub vout: u32,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Utxo {
    pub txid: String,
    pub vout: u32,
    pub address: String,
    pub scriptPubKey: String,
    pub amount: f64,
    pub confirmations: u32,
    pub spendable: bool,
    pub solvable: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct WalletInfo {
    pub walletname: String,
    pub walletversion: u32,
    pub balance: f64,
    pub unconfirmed_balance: f64,
    pub immature_balance: f64,
    pub txcount: u64,
    pub keypoololdest: Option<u64>,
    pub keypoolsize: u32,
    pub keypoolsize_hd_internal: Option<u32>,
    pub unlocked_until: Option<u64>,
    pub paytxfee: f64,
    pub hdmasterkeyid: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AddressInfo {
    pub isvalid: bool,
    pub address: Option<String>,
    pub ismine: Option<bool>,
    pub iswatchonly: Option<bool>,
    pub isscript: Option<bool>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AssetData {
    pub name: String,
    pub amount: f64,
    pub units: u8,
    pub reissuable: bool,
    pub has_ipfs: bool,
    pub ipfs_hash: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct MasternodeCount {
    pub total: u32,
    pub enabled: u32,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct MiningInfo {
    pub blocks: u64,
    pub difficulty: f64,
    pub networkhashps: f64,
    pub pooledtx: u32,
    pub chain: String,
}



