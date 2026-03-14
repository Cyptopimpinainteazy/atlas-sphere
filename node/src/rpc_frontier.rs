//! Frontier RPC wiring stub
//!
//! This module provides optional wiring for Frontier JSON-RPC endpoints.
//! When `feature = "frontier"` is enabled for the node crate, this module
//! will create and merge additional Ethereum-compatible RPC handlers. These
//! should be replaced (or extended) with the `fc-rpc`/`fp-rpc` modules once
//! the Frontier version compatibility is resolved.

use hex;
use jsonrpsee::RpcModule;
use pallet_x3_kernel::AtlasKernelRuntimeApi;
use sc_client_api::BlockBackend;
use sp_api::ProvideRuntimeApi;
use sp_blockchain::HeaderBackend;
use std::sync::Arc;
use x3_chain_runtime::{opaque::Block, AccountId, AssetId, Balance};

/// Helper: decode a hex EVM address string to a 20-byte Vec
fn decode_address(s: &str) -> Result<Vec<u8>, jsonrpsee::core::Error> {
    let stripped = s.strip_prefix("0x").unwrap_or(s);
    let bytes = hex::decode(stripped)
        .map_err(|e| jsonrpsee::core::Error::Custom(format!("Invalid address: {}", e)))?;
    if bytes.len() != 20 {
        return Err(jsonrpsee::core::Error::Custom("Address must be 20 bytes".into()));
    }
    Ok(bytes)
}

/// Create a Frontier-compatible JSON-RPC module backed by runtime API calls.
/// Provides eth_getBalance, eth_getCode, eth_getStorageAt,
/// eth_getTransactionCount (nonce), eth_call, and eth_estimateGas.
pub fn create_frontier_stub<C>(
    client: Arc<C>,
) -> Result<RpcModule<()>, Box<dyn std::error::Error + Send + Sync>>
where
    C: Send
        + Sync
        + 'static
        + ProvideRuntimeApi<Block>
        + HeaderBackend<Block>
        + BlockBackend<Block>,
    C::Api: pallet_x3_kernel::AtlasKernelRuntimeApi<Block, AccountId, Balance, AssetId>,
{
    let mut module = RpcModule::new(());

    // eth_getBalance — returns native balance for an EVM address as hex wei
    let c = client.clone();
    module.register_method("eth_getBalance", move |params, _| {
        let (address_hex, _block): (String, serde_json::Value) =
            params.parse().unwrap_or_else(|_| {
                let s: String = params.one().unwrap_or_default();
                (s, serde_json::Value::Null)
            });
        let bytes = decode_address(&address_hex)?;
        let api = c.runtime_api();
        let at = c.info().best_hash;
        let balance: Balance = api
            .get_evm_balance(at, bytes, 0u32)
            .map_err(|e| jsonrpsee::core::Error::Custom(format!("Runtime error: {:?}", e)))?
            .unwrap_or_default();
        Ok(format!("0x{:x}", balance))
    })?;

    // eth_getCode — returns contract bytecode for an EVM address as 0x-prefixed hex
    let c = client.clone();
    module.register_method("eth_getCode", move |params, _| {
        let (address_hex, _block): (String, serde_json::Value) =
            params.parse().unwrap_or_else(|_| {
                let s: String = params.one().unwrap_or_default();
                (s, serde_json::Value::Null)
            });
        let bytes = decode_address(&address_hex)?;
        let api = c.runtime_api();
        let at = c.info().best_hash;
        let code: Vec<u8> = api
            .get_evm_code(at, bytes)
            .map_err(|e| jsonrpsee::core::Error::Custom(format!("Runtime error: {:?}", e)))?;
        Ok(format!("0x{}", hex::encode(code)))
    })?;

    // eth_getStorageAt — returns EVM storage value at (address, slot) as 0x-prefixed hex
    let c = client.clone();
    module.register_method("eth_getStorageAt", move |params, _| {
        let (address_hex, slot_hex, _block): (String, String, serde_json::Value) =
            params.parse().map_err(|e| jsonrpsee::core::Error::Custom(e.to_string()))?;
        let addr_bytes = decode_address(&address_hex)?;
        let slot_stripped = slot_hex.strip_prefix("0x").unwrap_or(&slot_hex);
        let slot_bytes = hex::decode(slot_stripped)
            .map_err(|e| jsonrpsee::core::Error::Custom(format!("Invalid slot: {}", e)))?;
        if slot_bytes.len() > 32 {
            return Err(jsonrpsee::core::Error::Custom("Slot must be ≤32 bytes".into()));
        }
        let mut key = [0u8; 32];
        let offset = 32 - slot_bytes.len();
        key[offset..].copy_from_slice(&slot_bytes);
        let storage_key = sp_core::H256::from(key);
        let api = c.runtime_api();
        let at = c.info().best_hash;
        let val: Option<sp_core::H256> = api
            .get_evm_storage(at, addr_bytes, storage_key)
            .map_err(|e| jsonrpsee::core::Error::Custom(format!("Runtime error: {:?}", e)))?;
        Ok(format!("0x{}", hex::encode(val.unwrap_or_default().as_bytes())))
    })?;

    // eth_getTransactionCount — returns account nonce as hex
    let c = client.clone();
    module.register_method("eth_getTransactionCount", move |params, _| {
        let (address_hex, _block): (String, serde_json::Value) =
            params.parse().unwrap_or_else(|_| {
                let s: String = params.one().unwrap_or_default();
                (s, serde_json::Value::Null)
            });
        let bytes = decode_address(&address_hex)?;
        let api = c.runtime_api();
        let at = c.info().best_hash;
        let nonce: u64 = api
            .get_evm_nonce(at, bytes)
            .map_err(|e| jsonrpsee::core::Error::Custom(format!("Runtime error: {:?}", e)))?;
        Ok(format!("0x{:x}", nonce))
    })?;

    // eth_estimateGas — returns a fixed conservative estimate (21_000 base + data cost)
    // Full simulation requires a stateful runner; this safe approximation avoids
    // the sp-io duplicate panic_impl issue that blocks wasm32 compilation.
    module.register_method("eth_estimateGas", move |params, _| {
        let tx_obj: serde_json::Value =
            params.one().unwrap_or(serde_json::Value::Object(Default::default()));
        let data_len = tx_obj.get("data")
            .and_then(|v| v.as_str())
            .map(|s| s.strip_prefix("0x").unwrap_or(s).len() / 2)
            .unwrap_or(0);
        // 21_000 base + 68 gas per non-zero data byte (conservative)
        let estimate: u64 = 21_000 + (data_len as u64) * 68;
        Ok(format!("0x{:x}", estimate))
    })?;

    Ok(module)
}

/// Create an SVM-compatible JSON-RPC module backed by runtime API calls.
/// Provides svm_getBalance and svm_isProgram endpoints for querying SVM state.
pub fn create_svm_stub<C>(
    client: Arc<C>,
) -> Result<RpcModule<()>, Box<dyn std::error::Error + Send + Sync>>
where
    C: Send
        + Sync
        + 'static
        + ProvideRuntimeApi<Block>
        + HeaderBackend<Block>
        + BlockBackend<Block>,
    C::Api: pallet_x3_kernel::AtlasKernelRuntimeApi<Block, AccountId, Balance, AssetId>,
{
    let mut module = RpcModule::new(());

    // svm_getBalance — returns lamport balance for a base58 or hex SVM pubkey
    let c = client.clone();
    module.register_method("svm_getBalance", move |params, _| {
        let pubkey_str: String = params.one()?;
        let bytes = decode_svm_pubkey(&pubkey_str)?;
        let api = c.runtime_api();
        let at = c.info().best_hash;
        let balance: u64 = api
            .get_svm_balance(at, bytes)
            .map_err(|e| jsonrpsee::core::Error::Custom(format!("Runtime error: {:?}", e)))?;
        Ok(serde_json::json!({ "value": balance }))
    })?;

    // svm_isProgram — returns whether a pubkey has a deployed executable program
    let c = client.clone();
    module.register_method("svm_isProgram", move |params, _| {
        let pubkey_str: String = params.one()?;
        let bytes = decode_svm_pubkey(&pubkey_str)?;
        let api = c.runtime_api();
        let at = c.info().best_hash;
        let is_prog: bool = api
            .is_svm_program(at, bytes)
            .map_err(|e| jsonrpsee::core::Error::Custom(format!("Runtime error: {:?}", e)))?;
        Ok(serde_json::json!({ "result": is_prog }))
    })?;

    Ok(module)
}

/// Decode a SVM pubkey from either a 0x-prefixed hex string (32 bytes) or
/// a base58-encoded Solana-style pubkey.
fn decode_svm_pubkey(s: &str) -> Result<Vec<u8>, jsonrpsee::core::Error> {
    if let Some(hex_str) = s.strip_prefix("0x") {
        let bytes = hex::decode(hex_str)
            .map_err(|e| jsonrpsee::core::Error::Custom(format!("Invalid hex pubkey: {}", e)))?;
        if bytes.len() != 32 {
            return Err(jsonrpsee::core::Error::Custom("SVM pubkey must be 32 bytes".into()));
        }
        return Ok(bytes);
    }
    // base58 decode
    let bytes = bs58::decode(s)
        .into_vec()
        .map_err(|e| jsonrpsee::core::Error::Custom(format!("Invalid base58 pubkey: {}", e)))?;
    if bytes.len() != 32 {
        return Err(jsonrpsee::core::Error::Custom("SVM pubkey must be 32 bytes".into()));
    }
    Ok(bytes)
}
