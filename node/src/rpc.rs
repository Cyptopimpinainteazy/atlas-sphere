/// JSON-RPC Endpoints for Atlas Sphere
///
/// Provides RPC methods for querying Atlas Kernel state via runtime APIs
/// Includes system RPC methods for account nonce queries
use atlas_sphere_runtime::{
    opaque::Block, AccountId, AssetId, Balance, ChainId, Nonce, NATIVE_GAS_PRICE,
};
use frame_system_rpc_runtime_api::AccountNonceApi;
use jsonrpsee::{core::RpcResult, proc_macros::rpc};
use pallet_atlas_kernel::AtlasKernelRuntimeApi;
use sc_client_api::BlockBackend;
use sp_api::ProvideRuntimeApi;
use sp_blockchain::HeaderBackend;
use sp_runtime::traits::{Block as BlockT, SaturatedConversion};
use std::sync::Arc;

/// System RPC API for account nonce queries
#[rpc(client, server)]
pub trait SystemApi<BlockHash> {
    /// Returns the next valid index (aka nonce) for given account
    #[method(name = "system_accountNextIndex")]
    fn account_next_index(&self, account: AccountId, at: Option<BlockHash>) -> RpcResult<Nonce>;
}

/// Atlas Kernel RPC API
#[rpc(client, server)]
pub trait AtlasKernelApi<BlockHash> {
    /// Get canonical balance for an account and asset
    #[method(name = "atlasKernel_getCanonicalBalance")]
    fn get_canonical_balance(
        &self,
        account: AccountId,
        asset_id: AssetId,
        at: Option<BlockHash>,
    ) -> RpcResult<Balance>;

    /// Get asset metadata (symbol, decimals)
    #[method(name = "atlasKernel_getAssetMetadata")]
    fn get_asset_metadata(
        &self,
        asset_id: AssetId,
        at: Option<BlockHash>,
    ) -> RpcResult<Option<(Vec<u8>, u8)>>;

    /// Check if account is authorized
    #[method(name = "atlasKernel_isAuthorized")]
    fn is_authorized(&self, account: AccountId, at: Option<BlockHash>) -> RpcResult<bool>;

    /// Get all authorized accounts
    #[method(name = "atlasKernel_getAuthorizedAccounts")]
    fn get_authorized_accounts(&self, at: Option<BlockHash>) -> RpcResult<Vec<AccountId>>;

    /// Get current authority set
    #[method(name = "atlasKernel_getAuthorities")]
    fn get_authorities(&self, at: Option<BlockHash>) -> RpcResult<Vec<AccountId>>;
}

/// Minimal Ethereum-compatible RPC for chain metadata
///
/// Provides `eth_chainId`, `eth_gasPrice`, and `eth_blockNumber` backed by
/// runtime constants and client block info so standard EVM tools can discover
/// basic network parameters even before full Frontier RPC wiring is in place.
#[rpc(client, server)]
pub trait EthCompatApi {
    /// Get the EVM chain ID as a hex quantity (e.g. 0x9ebd0)
    #[method(name = "eth_chainId")]
    fn chain_id(&self) -> RpcResult<String>;

    /// Get the current gas price (native units) as a hex quantity
    #[method(name = "eth_gasPrice")]
    fn gas_price(&self) -> RpcResult<String>;

    /// Get the current block number as a hex quantity
    #[method(name = "eth_blockNumber")]
    fn block_number(&self) -> RpcResult<String>;
}

/// System RPC server implementation
pub struct SystemRpc<C, B> {
    client: Arc<C>,
    _marker: std::marker::PhantomData<B>,
}

impl<C, B> SystemRpc<C, B> {
    /// Create new System RPC instance
    pub fn new(client: Arc<C>) -> Self {
        Self {
            client,
            _marker: Default::default(),
        }
    }
}

impl<C, Block> SystemApiServer<<Block as BlockT>::Hash> for SystemRpc<C, Block>
where
    Block: BlockT,
    C: Send + Sync + 'static + ProvideRuntimeApi<Block> + HeaderBackend<Block>,
    C::Api: AccountNonceApi<Block, AccountId, Nonce>,
{
    fn account_next_index(
        &self,
        account: AccountId,
        at: Option<<Block as BlockT>::Hash>,
    ) -> RpcResult<Nonce> {
        let api = self.client.runtime_api();
        let at = at.unwrap_or_else(|| self.client.info().best_hash);

        api.account_nonce(at, account).map_err(|e| {
            jsonrpsee::types::ErrorObjectOwned::owned(
                1,
                format!("Runtime API error: {:?}", e),
                None::<()>,
            )
        })
    }
}

/// Atlas Kernel RPC server implementation
pub struct AtlasKernelRpc<C, B> {
    client: Arc<C>,
    _marker: std::marker::PhantomData<B>,
}

impl<C, B> AtlasKernelRpc<C, B> {
    /// Create new RPC instance
    pub fn new(client: Arc<C>) -> Self {
        Self {
            client,
            _marker: Default::default(),
        }
    }
}

impl<C, Block> AtlasKernelApiServer<<Block as BlockT>::Hash> for AtlasKernelRpc<C, Block>
where
    Block: BlockT,
    C: Send
        + Sync
        + 'static
        + ProvideRuntimeApi<Block>
        + HeaderBackend<Block>
        + BlockBackend<Block>,
    C::Api: AtlasKernelRuntimeApi<Block, AccountId, Balance, AssetId>,
{
    fn get_canonical_balance(
        &self,
        account: AccountId,
        asset_id: AssetId,
        at: Option<<Block as BlockT>::Hash>,
    ) -> RpcResult<Balance> {
        let api = self.client.runtime_api();
        let at = at.unwrap_or_else(|| self.client.info().best_hash);

        api.get_canonical_balance(at, account, asset_id)
            .map_err(|e| {
                jsonrpsee::types::ErrorObjectOwned::owned(
                    1,
                    format!("Runtime API error: {:?}", e),
                    None::<()>,
                )
            })
    }

    fn get_asset_metadata(
        &self,
        asset_id: AssetId,
        at: Option<<Block as BlockT>::Hash>,
    ) -> RpcResult<Option<(Vec<u8>, u8)>> {
        let api = self.client.runtime_api();
        let at = at.unwrap_or_else(|| self.client.info().best_hash);

        api.get_asset_metadata(at, asset_id).map_err(|e| {
            jsonrpsee::types::ErrorObjectOwned::owned(
                1,
                format!("Runtime API error: {:?}", e),
                None::<()>,
            )
        })
    }

    fn is_authorized(
        &self,
        account: AccountId,
        at: Option<<Block as BlockT>::Hash>,
    ) -> RpcResult<bool> {
        let api = self.client.runtime_api();
        let at = at.unwrap_or_else(|| self.client.info().best_hash);

        api.is_authorized(at, account).map_err(|e| {
            jsonrpsee::types::ErrorObjectOwned::owned(
                1,
                format!("Runtime API error: {:?}", e),
                None::<()>,
            )
        })
    }

    fn get_authorized_accounts(
        &self,
        at: Option<<Block as BlockT>::Hash>,
    ) -> RpcResult<Vec<AccountId>> {
        let api = self.client.runtime_api();
        let at = at.unwrap_or_else(|| self.client.info().best_hash);

        api.get_authorized_accounts(at).map_err(|e| {
            jsonrpsee::types::ErrorObjectOwned::owned(
                1,
                format!("Runtime API error: {:?}", e),
                None::<()>,
            )
        })
    }

    fn get_authorities(&self, at: Option<<Block as BlockT>::Hash>) -> RpcResult<Vec<AccountId>> {
        let api = self.client.runtime_api();
        let at = at.unwrap_or_else(|| self.client.info().best_hash);

        api.get_authorities(at).map_err(|e| {
            jsonrpsee::types::ErrorObjectOwned::owned(
                1,
                format!("Runtime API error: {:?}", e),
                None::<()>,
            )
        })
    }
}

/// Ethereum-compatible RPC implementation backed by runtime constants and client block info
pub struct EthCompatRpc<C, B> {
    client: Arc<C>,
    _marker: std::marker::PhantomData<B>,
}

impl<C, B> EthCompatRpc<C, B> {
    /// Create a new EthCompat RPC instance
    pub fn new(client: Arc<C>) -> Self {
        Self {
            client,
            _marker: Default::default(),
        }
    }
}

impl<C, Block> EthCompatApiServer for EthCompatRpc<C, Block>
where
    Block: BlockT,
    C: Send
        + Sync
        + 'static
        + ProvideRuntimeApi<Block>
        + HeaderBackend<Block>
        + BlockBackend<Block>,
{
    fn chain_id(&self) -> RpcResult<String> {
        // Return hex-encoded chain ID quantity (Ethereum-style)
        let id: u64 = ChainId::get();
        Ok(format!("0x{:x}", id))
    }

    fn gas_price(&self) -> RpcResult<String> {
        // Return hex-encoded gas price in native units
        let price: u64 = NATIVE_GAS_PRICE;
        Ok(format!("0x{:x}", price))
    }

    fn block_number(&self) -> RpcResult<String> {
        // Map best Substrate block number to Ethereum-style hex quantity
        let info = self.client.info();
        let n: u64 = info.best_number.saturated_into();
        Ok(format!("0x{:x}", n))
    }
}

/// Create full RPC extensions with Atlas Kernel and system methods
pub fn create_full<C, P>(
    client: Arc<C>,
    _pool: Arc<P>,
) -> Result<jsonrpsee::RpcModule<()>, Box<dyn std::error::Error + Send + Sync>>
where
    C: Send
        + Sync
        + 'static
        + ProvideRuntimeApi<Block>
        + HeaderBackend<Block>
        + BlockBackend<Block>,
    C::Api: AtlasKernelRuntimeApi<Block, AccountId, Balance, AssetId>,
    C::Api: AccountNonceApi<Block, AccountId, Nonce>,
    P: Send + Sync + 'static,
{
    use jsonrpsee::RpcModule;

    let mut module = RpcModule::new(());

    // Add system RPC (account nonce)
    let system = SystemRpc::<C, Block>::new(client.clone());
    module.merge(SystemApiServer::into_rpc(system))?;

    // Add Atlas Kernel custom RPC
    let atlas_kernel = AtlasKernelRpc::<C, Block>::new(client.clone());
    module.merge(AtlasKernelApiServer::into_rpc(atlas_kernel))?;

    // Add minimal Ethereum-compatible RPC (chainId, gasPrice, blockNumber)
    let eth_compat = EthCompatRpc::<C, Block>::new(client);
    module.merge(EthCompatApiServer::into_rpc(eth_compat))?;

    Ok(module)
}
