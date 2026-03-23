//! RPC wiring for X3 Chain.

use std::sync::Arc;

use flash_finality::FlashFinalityGadget;
use jsonrpsee::core::Error as JsonRpseeError;
use jsonrpsee::RpcModule;
use pallet_transaction_payment_rpc::{TransactionPayment, TransactionPaymentApiServer};
use pallet_x3_kernel::AtlasKernelRuntimeApi;
use parity_scale_codec::{Decode, Encode};
use sc_client_api::BlockBackend;
pub use sc_rpc_api::DenyUnsafe;
use sc_transaction_pool_api::TransactionPool;
use sp_api::ProvideRuntimeApi;
use sp_block_builder::BlockBuilder;
use sp_blockchain::{Error as BlockChainError, HeaderBackend, HeaderMetadata};
use substrate_frame_rpc_system::{System, SystemApiServer};
use x3_chain_runtime::{opaque::Block, AccountId, AssetId, Balance, Nonce};

fn custom_error(message: impl Into<String>) -> JsonRpseeError {
    JsonRpseeError::Custom(message.into())
}

fn decode_hex_param(value: &str, label: &str) -> Result<Vec<u8>, JsonRpseeError> {
    let stripped = value.strip_prefix("0x").unwrap_or(value);
    hex::decode(stripped).map_err(|e| custom_error(format!("Invalid {label}: {e}")))
}

fn decode_account_id(value: &str) -> Result<AccountId, JsonRpseeError> {
    let bytes = decode_hex_param(value, "account")?;

    if bytes.len() == 32 {
        return AccountId::decode(&mut &bytes[..])
            .or_else(|_| AccountId::decode(&mut &bytes.encode()[..]))
            .map_err(|e| custom_error(format!("Invalid account bytes: {e}")));
    }

    AccountId::decode(&mut &bytes[..])
        .map_err(|e| custom_error(format!("Invalid SCALE-encoded account: {e}")))
}

/// Build the full RPC module exposed by the node.
pub fn create_full<C, P>(
    client: Arc<C>,
    pool: Arc<P>,
    deny_unsafe: DenyUnsafe,
    _flash_finality_gadget: Option<Arc<FlashFinalityGadget>>,
) -> Result<RpcModule<()>, Box<dyn std::error::Error + Send + Sync>>
where
    C: ProvideRuntimeApi<Block>
        + HeaderBackend<Block>
        + HeaderMetadata<Block, Error = BlockChainError>
        + BlockBackend<Block>
        + Send
        + Sync
        + 'static,
    C::Api: substrate_frame_rpc_system::AccountNonceApi<Block, AccountId, Nonce>
        + pallet_transaction_payment_rpc::TransactionPaymentRuntimeApi<Block, Balance>
        + BlockBuilder<Block>
        + pallet_x3_kernel::AtlasKernelRuntimeApi<Block, AccountId, Balance, AssetId>,
    P: TransactionPool + Sync + Send + 'static,
{
    let mut module = RpcModule::new(());

    module.merge(System::new(client.clone(), pool, deny_unsafe).into_rpc())?;
    module.merge(TransactionPayment::new(client.clone()).into_rpc())?;
    module.merge(crate::rpc_frontier::create_frontier_stub(client.clone())?)?;
    module.merge(crate::rpc_frontier::create_svm_stub(client.clone())?)?;

    let c = client.clone();
    module.register_method("x3_getAssetMetadata", move |params, _| {
        let asset_id: u32 = params.one()?;
        let api = c.runtime_api();
        let at = c.info().best_hash;
        let metadata: Option<(Vec<u8>, u8)> = api
            .get_asset_metadata(at, asset_id)
            .map_err(|e| custom_error(format!("Runtime error: {e:?}")))?;

        Ok(metadata
            .map(|(symbol, decimals)| (String::from_utf8_lossy(&symbol).to_string(), decimals)))
    })?;

    let c = client.clone();
    module.register_method("x3_isAuthorized", move |params, _| {
        let account: String = params.one()?;
        let account_id = decode_account_id(&account)?;
        let api = c.runtime_api();
        let at = c.info().best_hash;
        api.is_authorized(at, account_id)
            .map_err(|e| custom_error(format!("Runtime error: {e:?}")))
    })?;

    let c = client.clone();
    module.register_method("x3_getAuthorizedAccounts", move |_params, _| {
        let api = c.runtime_api();
        let at = c.info().best_hash;
        let accounts = api
            .get_authorized_accounts(at)
            .map_err(|e| custom_error(format!("Runtime error: {e:?}")))?;

        Ok(accounts
            .into_iter()
            .map(|account| format!("0x{}", hex::encode(account.encode())))
            .collect::<Vec<_>>())
    })?;

    let c = client.clone();
    module.register_method("x3_getAuthorities", move |_params, _| {
        let api = c.runtime_api();
        let at = c.info().best_hash;
        let authorities = api
            .get_authorities(at)
            .map_err(|e| custom_error(format!("Runtime error: {e:?}")))?;

        Ok(authorities
            .into_iter()
            .map(|account| format!("0x{}", hex::encode(account.encode())))
            .collect::<Vec<_>>())
    })?;

    module.register_method("x3_newCore", move |_params, _| {
        Err::<String, _>(custom_error(
            "x3_newCore is not available on this node build",
        ))
    })?;

    module.register_method("eth_call", move |_params, _| Ok(String::from("0x")))?;

    Ok(module)
}
