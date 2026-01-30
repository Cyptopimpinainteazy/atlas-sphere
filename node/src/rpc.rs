/// JSON-RPC Endpoints for Atlas Sphere
///
/// Provides RPC methods for querying Atlas Kernel state via runtime APIs
/// Includes system RPC methods for account nonce queries
/// Supports WebSocket subscriptions for real-time block and event updates
use atlas_sphere_runtime::{
    opaque::Block, AccountId, AssetId, Balance, BlockNumber, ChainId, Nonce, NATIVE_GAS_PRICE,
};
use frame_system_rpc_runtime_api::AccountNonceApi;
use jsonrpsee::{
    core::{async_trait, RpcResult},
    proc_macros::rpc,
    PendingSubscriptionSink,
};
use pallet_atlas_kernel::AtlasKernelRuntimeApi;
use pallet_atomic_trade_engine::{
    runtime_api::{BatchStatusResponse, PriceDataResponse, SimulationResult},
    AtomicTradeEngineApi as AtomicTradeEngineRuntimeApi,
};
use pallet_evolution_core::runtime_api::{
    BlockMetricsResponse, EvolutionCoreApi as EvolutionCoreRuntimeApi, EvolutionStatusResponse,
    EvolvableParamsResponse, ProposalResponse,
};
use pallet_x3_verifier::runtime_api::{
    ExecutorResponse, JobId, JobResponse, ReceiptResponse, VerifierStatusResponse,
    X3VerifierApi as X3VerifierRuntimeApi,
};
use sc_client_api::BlockBackend;
use sp_api::ProvideRuntimeApi;
use sp_blockchain::HeaderBackend;
use sp_core::H256;
use sp_runtime::traits::{Block as BlockT, Header as HeaderT, SaturatedConversion};
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

/// Health check RPC API for monitoring and load balancers
#[rpc(client, server)]
pub trait HealthApi {
    /// Returns node health status including sync state and peer count
    #[method(name = "system_health")]
    fn health(&self) -> RpcResult<HealthStatus>;

    /// Returns node version and build info
    #[method(name = "system_version")]
    fn version(&self) -> RpcResult<NodeVersion>;

    /// Simple liveness check - returns true if node is responsive
    #[method(name = "system_ping")]
    fn ping(&self) -> RpcResult<bool>;
}

/// Health status response for monitoring
#[derive(Debug, Clone, serde::Serialize, serde::Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct HealthStatus {
    /// Whether the node is syncing
    pub is_syncing: bool,
    /// Number of connected peers
    pub peers: u32,
    /// Whether the node should be accepting transactions
    pub should_have_peers: bool,
    /// Current best block number
    pub best_block: u64,
    /// Finalized block number
    pub finalized_block: u64,
    /// Blocks behind (0 if synced)
    pub blocks_behind: u64,
}

/// Node version information
#[derive(Debug, Clone, serde::Serialize, serde::Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct NodeVersion {
    /// Node implementation name
    pub name: String,
    /// Node version
    pub version: String,
    /// Chain specification name
    pub chain: String,
    /// Runtime spec version
    pub spec_version: u32,
}

/// WebSocket Subscription API for real-time updates
#[rpc(client, server)]
pub trait ChainSubscriptionApi {
    /// Subscribe to new block headers
    #[subscription(name = "chain_subscribeNewHeads" => "chain_newHead", unsubscribe = "chain_unsubscribeNewHeads", item = BlockHeader)]
    async fn subscribe_new_heads(&self);

    /// Subscribe to finalized block headers
    #[subscription(name = "chain_subscribeFinalizedHeads" => "chain_finalizedHead", unsubscribe = "chain_unsubscribeFinalizedHeads", item = BlockHeader)]
    async fn subscribe_finalized_heads(&self);
}

/// Block header info for subscriptions
#[derive(Debug, Clone, serde::Serialize, serde::Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct BlockHeader {
    /// Block number
    pub number: u64,
    /// Block hash
    pub hash: H256,
    /// Parent block hash
    pub parent_hash: H256,
    /// State root
    pub state_root: H256,
    /// Extrinsics root
    pub extrinsics_root: H256,
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

// ============================================================================
// Health Check RPC
// ============================================================================

/// Health check RPC server implementation
pub struct HealthRpc<C, B> {
    client: Arc<C>,
    chain_name: String,
    _marker: std::marker::PhantomData<B>,
}

impl<C, B> HealthRpc<C, B> {
    /// Create a new Health RPC instance
    pub fn new(client: Arc<C>, chain_name: String) -> Self {
        Self {
            client,
            chain_name,
            _marker: Default::default(),
        }
    }
}

impl<C, Block> HealthApiServer for HealthRpc<C, Block>
where
    Block: BlockT,
    C: Send + Sync + 'static + ProvideRuntimeApi<Block> + HeaderBackend<Block>,
{
    fn health(&self) -> RpcResult<HealthStatus> {
        let info = self.client.info();
        let best: u64 = info.best_number.saturated_into();
        let finalized: u64 = info.finalized_number.saturated_into();

        // Consider synced if within 10 blocks of finalized
        let blocks_behind = best.saturating_sub(finalized);
        let is_syncing = blocks_behind > 10;

        Ok(HealthStatus {
            is_syncing,
            peers: 0, // Would need network service to get actual peer count
            should_have_peers: true,
            best_block: best,
            finalized_block: finalized,
            blocks_behind,
        })
    }

    fn version(&self) -> RpcResult<NodeVersion> {
        Ok(NodeVersion {
            name: "Atlas Sphere Node".to_string(),
            version: env!("CARGO_PKG_VERSION").to_string(),
            chain: self.chain_name.clone(),
            spec_version: 1, // Matches runtime VERSION
        })
    }

    fn ping(&self) -> RpcResult<bool> {
        Ok(true)
    }
}

// ============================================================================
// Atomic Trade Engine RPC
// ============================================================================

/// Atomic Trade Engine RPC API for AI agents and frontends
#[rpc(client, server)]
pub trait AtomicTradeEngineApi<BlockHash> {
    /// Simulate a trade path without execution
    #[method(name = "atomicTrade_simulate")]
    fn simulate_trade(
        &self,
        token_in: H256,
        token_out: H256,
        amount_in: u128,
        slippage_bps: u32,
        at: Option<BlockHash>,
    ) -> RpcResult<SimulationResult>;

    /// Estimate execution costs (EVM gas, SVM compute units)
    #[method(name = "atomicTrade_estimateCost")]
    fn estimate_cost(
        &self,
        legs: u32,
        vm_types: Vec<u8>,
        at: Option<BlockHash>,
    ) -> RpcResult<(u64, u64)>;

    /// Get TWAP and latest price for a token pair
    #[method(name = "atomicTrade_getPriceData")]
    fn get_price_data(
        &self,
        token_a: H256,
        token_b: H256,
        at: Option<BlockHash>,
    ) -> RpcResult<PriceDataResponse>;

    /// Get batch execution status
    #[method(name = "atomicTrade_getBatchStatus")]
    fn get_batch_status(
        &self,
        batch_hash: H256,
        at: Option<BlockHash>,
    ) -> RpcResult<BatchStatusResponse>;

    /// Check if account is authorized for atomic trades
    #[method(name = "atomicTrade_isAuthorized")]
    fn is_trade_authorized(&self, account: AccountId, at: Option<BlockHash>) -> RpcResult<bool>;
}

/// Atomic Trade Engine RPC server implementation
pub struct AtomicTradeEngineRpc<C, B> {
    client: Arc<C>,
    _marker: std::marker::PhantomData<B>,
}

impl<C, B> AtomicTradeEngineRpc<C, B> {
    /// Create new RPC instance
    pub fn new(client: Arc<C>) -> Self {
        Self {
            client,
            _marker: Default::default(),
        }
    }
}

impl<C, Block> AtomicTradeEngineApiServer<<Block as BlockT>::Hash>
    for AtomicTradeEngineRpc<C, Block>
where
    Block: BlockT,
    C: Send
        + Sync
        + 'static
        + ProvideRuntimeApi<Block>
        + HeaderBackend<Block>
        + BlockBackend<Block>,
    C::Api: AtomicTradeEngineRuntimeApi<Block>,
{
    fn simulate_trade(
        &self,
        token_in: H256,
        token_out: H256,
        amount_in: u128,
        slippage_bps: u32,
        at: Option<<Block as BlockT>::Hash>,
    ) -> RpcResult<SimulationResult> {
        let api = self.client.runtime_api();
        let at = at.unwrap_or_else(|| self.client.info().best_hash);

        api.simulate_trade(at, token_in, token_out, amount_in, slippage_bps)
            .map_err(|e| {
                jsonrpsee::types::ErrorObjectOwned::owned(
                    1,
                    format!("Runtime API error: {:?}", e),
                    None::<()>,
                )
            })
    }

    fn estimate_cost(
        &self,
        legs: u32,
        vm_types: Vec<u8>,
        at: Option<<Block as BlockT>::Hash>,
    ) -> RpcResult<(u64, u64)> {
        let api = self.client.runtime_api();
        let at = at.unwrap_or_else(|| self.client.info().best_hash);

        api.estimate_execution_cost(at, legs, vm_types)
            .map_err(|e| {
                jsonrpsee::types::ErrorObjectOwned::owned(
                    1,
                    format!("Runtime API error: {:?}", e),
                    None::<()>,
                )
            })
    }

    fn get_price_data(
        &self,
        token_a: H256,
        token_b: H256,
        at: Option<<Block as BlockT>::Hash>,
    ) -> RpcResult<PriceDataResponse> {
        let api = self.client.runtime_api();
        let at = at.unwrap_or_else(|| self.client.info().best_hash);

        api.get_price_data(at, token_a, token_b).map_err(|e| {
            jsonrpsee::types::ErrorObjectOwned::owned(
                1,
                format!("Runtime API error: {:?}", e),
                None::<()>,
            )
        })
    }

    fn get_batch_status(
        &self,
        batch_hash: H256,
        at: Option<<Block as BlockT>::Hash>,
    ) -> RpcResult<BatchStatusResponse> {
        let api = self.client.runtime_api();
        let at = at.unwrap_or_else(|| self.client.info().best_hash);

        api.get_batch_status(at, batch_hash).map_err(|e| {
            jsonrpsee::types::ErrorObjectOwned::owned(
                1,
                format!("Runtime API error: {:?}", e),
                None::<()>,
            )
        })
    }

    fn is_trade_authorized(
        &self,
        account: AccountId,
        at: Option<<Block as BlockT>::Hash>,
    ) -> RpcResult<bool> {
        let api = self.client.runtime_api();
        let at = at.unwrap_or_else(|| self.client.info().best_hash);

        // Convert AccountId to bytes for runtime API
        use parity_scale_codec::Encode;
        let account_bytes = account.encode();

        api.is_authorized(at, account_bytes).map_err(|e| {
            jsonrpsee::types::ErrorObjectOwned::owned(
                1,
                format!("Runtime API error: {:?}", e),
                None::<()>,
            )
        })
    }
}

// ============================================================================
// Evolution Core RPC
// ============================================================================

/// Evolution Core RPC API for querying AIC evolution state
#[rpc(client, server)]
pub trait EvolutionCoreApi<BlockHash> {
    /// Get current evolvable parameters
    #[method(name = "evolutionCore_getParams")]
    fn get_params(&self, at: Option<BlockHash>) -> RpcResult<EvolvableParamsResponse>;

    /// Get evolution status summary
    #[method(name = "evolutionCore_getStatus")]
    fn get_status(&self, at: Option<BlockHash>) -> RpcResult<EvolutionStatusResponse>;

    /// Get recent block metrics
    #[method(name = "evolutionCore_getMetrics")]
    fn get_metrics(
        &self,
        depth: u32,
        at: Option<BlockHash>,
    ) -> RpcResult<Vec<(BlockNumber, BlockMetricsResponse)>>;

    /// Get pending proposals
    #[method(name = "evolutionCore_getPendingProposals")]
    fn get_pending_proposals(
        &self,
        at: Option<BlockHash>,
    ) -> RpcResult<Vec<ProposalResponse<AccountId, BlockNumber>>>;

    /// Check if evolution is enabled
    #[method(name = "evolutionCore_isEnabled")]
    fn is_enabled(&self, at: Option<BlockHash>) -> RpcResult<bool>;

    /// Check if account is an AI agent
    #[method(name = "evolutionCore_isAiAgent")]
    fn is_ai_agent(&self, account: AccountId, at: Option<BlockHash>) -> RpcResult<bool>;
}

/// Evolution Core RPC server implementation
pub struct EvolutionCoreRpc<C, B> {
    client: Arc<C>,
    _marker: std::marker::PhantomData<B>,
}

impl<C, B> EvolutionCoreRpc<C, B> {
    /// Create new RPC instance
    pub fn new(client: Arc<C>) -> Self {
        Self {
            client,
            _marker: Default::default(),
        }
    }
}

impl<C, Block> EvolutionCoreApiServer<<Block as BlockT>::Hash> for EvolutionCoreRpc<C, Block>
where
    Block: BlockT,
    C: Send + Sync + 'static + ProvideRuntimeApi<Block> + HeaderBackend<Block>,
    C::Api: EvolutionCoreRuntimeApi<Block, AccountId, BlockNumber>,
{
    fn get_params(
        &self,
        at: Option<<Block as BlockT>::Hash>,
    ) -> RpcResult<EvolvableParamsResponse> {
        let api = self.client.runtime_api();
        let at = at.unwrap_or_else(|| self.client.info().best_hash);

        api.get_params(at).map_err(|e| {
            jsonrpsee::types::ErrorObjectOwned::owned(
                1,
                format!("Runtime API error: {:?}", e),
                None::<()>,
            )
        })
    }

    fn get_status(
        &self,
        at: Option<<Block as BlockT>::Hash>,
    ) -> RpcResult<EvolutionStatusResponse> {
        let api = self.client.runtime_api();
        let at = at.unwrap_or_else(|| self.client.info().best_hash);

        api.get_status(at).map_err(|e| {
            jsonrpsee::types::ErrorObjectOwned::owned(
                1,
                format!("Runtime API error: {:?}", e),
                None::<()>,
            )
        })
    }

    fn get_metrics(
        &self,
        depth: u32,
        at: Option<<Block as BlockT>::Hash>,
    ) -> RpcResult<Vec<(BlockNumber, BlockMetricsResponse)>> {
        let api = self.client.runtime_api();
        let at = at.unwrap_or_else(|| self.client.info().best_hash);

        api.get_recent_metrics(at, depth).map_err(|e| {
            jsonrpsee::types::ErrorObjectOwned::owned(
                1,
                format!("Runtime API error: {:?}", e),
                None::<()>,
            )
        })
    }

    fn get_pending_proposals(
        &self,
        at: Option<<Block as BlockT>::Hash>,
    ) -> RpcResult<Vec<ProposalResponse<AccountId, BlockNumber>>> {
        let api = self.client.runtime_api();
        let at = at.unwrap_or_else(|| self.client.info().best_hash);

        api.get_pending_proposals(at).map_err(|e| {
            jsonrpsee::types::ErrorObjectOwned::owned(
                1,
                format!("Runtime API error: {:?}", e),
                None::<()>,
            )
        })
    }

    fn is_enabled(&self, at: Option<<Block as BlockT>::Hash>) -> RpcResult<bool> {
        let api = self.client.runtime_api();
        let at = at.unwrap_or_else(|| self.client.info().best_hash);

        api.is_evolution_enabled(at).map_err(|e| {
            jsonrpsee::types::ErrorObjectOwned::owned(
                1,
                format!("Runtime API error: {:?}", e),
                None::<()>,
            )
        })
    }

    fn is_ai_agent(
        &self,
        account: AccountId,
        at: Option<<Block as BlockT>::Hash>,
    ) -> RpcResult<bool> {
        let api = self.client.runtime_api();
        let at = at.unwrap_or_else(|| self.client.info().best_hash);

        api.is_ai_agent(at, account).map_err(|e| {
            jsonrpsee::types::ErrorObjectOwned::owned(
                1,
                format!("Runtime API error: {:?}", e),
                None::<()>,
            )
        })
    }
}

// ============================================================================
// X3 Verifier RPC
// ============================================================================

/// X3 Verifier RPC API for querying swarm execution state
#[rpc(client, server)]
pub trait X3VerifierApi<BlockHash> {
    /// Get verifier status summary
    #[method(name = "x3Verifier_getStatus")]
    fn get_status(&self, at: Option<BlockHash>) -> RpcResult<VerifierStatusResponse>;

    /// Get executor information
    #[method(name = "x3Verifier_getExecutor")]
    fn get_executor(
        &self,
        account: AccountId,
        at: Option<BlockHash>,
    ) -> RpcResult<Option<ExecutorResponse<AccountId, Balance>>>;

    /// Get all active executors
    #[method(name = "x3Verifier_getActiveExecutors")]
    fn get_active_executors(
        &self,
        at: Option<BlockHash>,
    ) -> RpcResult<Vec<ExecutorResponse<AccountId, Balance>>>;

    /// Get job information
    #[method(name = "x3Verifier_getJob")]
    fn get_job(
        &self,
        job_id: H256,
        at: Option<BlockHash>,
    ) -> RpcResult<Option<JobResponse<AccountId, Balance, BlockNumber>>>;

    /// Get pending jobs
    #[method(name = "x3Verifier_getPendingJobs")]
    fn get_pending_jobs(
        &self,
        at: Option<BlockHash>,
    ) -> RpcResult<Vec<JobResponse<AccountId, Balance, BlockNumber>>>;

    /// Get receipt for a job
    #[method(name = "x3Verifier_getReceipt")]
    fn get_receipt(
        &self,
        job_id: H256,
        at: Option<BlockHash>,
    ) -> RpcResult<Option<ReceiptResponse<AccountId>>>;

    /// Check if verification is enabled
    #[method(name = "x3Verifier_isEnabled")]
    fn is_enabled(&self, at: Option<BlockHash>) -> RpcResult<bool>;

    /// Check if account is a registered executor
    #[method(name = "x3Verifier_isExecutor")]
    fn is_executor(&self, account: AccountId, at: Option<BlockHash>) -> RpcResult<bool>;
}

/// X3 Verifier RPC server implementation
pub struct X3VerifierRpc<C, B> {
    client: Arc<C>,
    _marker: std::marker::PhantomData<B>,
}

impl<C, B> X3VerifierRpc<C, B> {
    /// Create new RPC instance
    pub fn new(client: Arc<C>) -> Self {
        Self {
            client,
            _marker: Default::default(),
        }
    }
}

impl<C, Block> X3VerifierApiServer<<Block as BlockT>::Hash> for X3VerifierRpc<C, Block>
where
    Block: BlockT,
    C: Send + Sync + 'static + ProvideRuntimeApi<Block> + HeaderBackend<Block>,
    C::Api: X3VerifierRuntimeApi<Block, AccountId, Balance, BlockNumber>,
{
    fn get_status(&self, at: Option<<Block as BlockT>::Hash>) -> RpcResult<VerifierStatusResponse> {
        let api = self.client.runtime_api();
        let at = at.unwrap_or_else(|| self.client.info().best_hash);

        api.get_status(at).map_err(|e| {
            jsonrpsee::types::ErrorObjectOwned::owned(
                1,
                format!("Runtime API error: {:?}", e),
                None::<()>,
            )
        })
    }

    fn get_executor(
        &self,
        account: AccountId,
        at: Option<<Block as BlockT>::Hash>,
    ) -> RpcResult<Option<ExecutorResponse<AccountId, Balance>>> {
        let api = self.client.runtime_api();
        let at = at.unwrap_or_else(|| self.client.info().best_hash);

        api.get_executor(at, account).map_err(|e| {
            jsonrpsee::types::ErrorObjectOwned::owned(
                1,
                format!("Runtime API error: {:?}", e),
                None::<()>,
            )
        })
    }

    fn get_active_executors(
        &self,
        at: Option<<Block as BlockT>::Hash>,
    ) -> RpcResult<Vec<ExecutorResponse<AccountId, Balance>>> {
        let api = self.client.runtime_api();
        let at = at.unwrap_or_else(|| self.client.info().best_hash);

        api.get_active_executors(at).map_err(|e| {
            jsonrpsee::types::ErrorObjectOwned::owned(
                1,
                format!("Runtime API error: {:?}", e),
                None::<()>,
            )
        })
    }

    fn get_job(
        &self,
        job_id: H256,
        at: Option<<Block as BlockT>::Hash>,
    ) -> RpcResult<Option<JobResponse<AccountId, Balance, BlockNumber>>> {
        let api = self.client.runtime_api();
        let at = at.unwrap_or_else(|| self.client.info().best_hash);

        api.get_job(at, job_id).map_err(|e| {
            jsonrpsee::types::ErrorObjectOwned::owned(
                1,
                format!("Runtime API error: {:?}", e),
                None::<()>,
            )
        })
    }

    fn get_pending_jobs(
        &self,
        at: Option<<Block as BlockT>::Hash>,
    ) -> RpcResult<Vec<JobResponse<AccountId, Balance, BlockNumber>>> {
        let api = self.client.runtime_api();
        let at = at.unwrap_or_else(|| self.client.info().best_hash);

        api.get_pending_jobs(at).map_err(|e| {
            jsonrpsee::types::ErrorObjectOwned::owned(
                1,
                format!("Runtime API error: {:?}", e),
                None::<()>,
            )
        })
    }

    fn get_receipt(
        &self,
        job_id: H256,
        at: Option<<Block as BlockT>::Hash>,
    ) -> RpcResult<Option<ReceiptResponse<AccountId>>> {
        let api = self.client.runtime_api();
        let at = at.unwrap_or_else(|| self.client.info().best_hash);

        api.get_receipt(at, job_id).map_err(|e| {
            jsonrpsee::types::ErrorObjectOwned::owned(
                1,
                format!("Runtime API error: {:?}", e),
                None::<()>,
            )
        })
    }

    fn is_enabled(&self, at: Option<<Block as BlockT>::Hash>) -> RpcResult<bool> {
        let api = self.client.runtime_api();
        let at = at.unwrap_or_else(|| self.client.info().best_hash);

        api.is_verification_enabled(at).map_err(|e| {
            jsonrpsee::types::ErrorObjectOwned::owned(
                1,
                format!("Runtime API error: {:?}", e),
                None::<()>,
            )
        })
    }

    fn is_executor(
        &self,
        account: AccountId,
        at: Option<<Block as BlockT>::Hash>,
    ) -> RpcResult<bool> {
        let api = self.client.runtime_api();
        let at = at.unwrap_or_else(|| self.client.info().best_hash);

        api.is_executor(at, account).map_err(|e| {
            jsonrpsee::types::ErrorObjectOwned::owned(
                1,
                format!("Runtime API error: {:?}", e),
                None::<()>,
            )
        })
    }
}

// ============================================================================
// Chain Subscription Implementation
// ============================================================================

use jsonrpsee::SubscriptionMessage;
use sc_client_api::BlockchainEvents;
use tokio_stream::StreamExt;

/// Chain subscription RPC server implementation
pub struct ChainSubscriptionRpc<C, B> {
    client: Arc<C>,
    _marker: std::marker::PhantomData<B>,
}

impl<C, B> ChainSubscriptionRpc<C, B> {
    /// Create new chain subscription RPC instance
    pub fn new(client: Arc<C>) -> Self {
        Self {
            client,
            _marker: Default::default(),
        }
    }
}

#[async_trait]
impl<C, Block> ChainSubscriptionApiServer for ChainSubscriptionRpc<C, Block>
where
    Block: BlockT,
    C: Send
        + Sync
        + 'static
        + ProvideRuntimeApi<Block>
        + HeaderBackend<Block>
        + BlockBackend<Block>
        + BlockchainEvents<Block>,
{
    async fn subscribe_new_heads(&self, pending: PendingSubscriptionSink) {
        let client = self.client.clone();

        // Accept the subscription
        let sink = match pending.accept().await {
            Ok(sink) => sink,
            Err(e) => {
                log::warn!("Failed to accept subscription: {:?}", e);
                return;
            }
        };

        // Subscribe to import notifications
        let mut notifications = client.import_notification_stream();

        // Stream block headers to subscriber
        tokio::spawn(async move {
            while let Some(notification) = notifications.next().await {
                // Access header fields through the Header trait
                let header_ref = &notification.header;
                let number: u64 = (*header_ref.number()).saturated_into();

                let header = BlockHeader {
                    number,
                    hash: H256::from_slice(notification.hash.as_ref()),
                    parent_hash: H256::from_slice(header_ref.parent_hash().as_ref()),
                    state_root: H256::from_slice(header_ref.state_root().as_ref()),
                    extrinsics_root: H256::from_slice(header_ref.extrinsics_root().as_ref()),
                };

                let msg = SubscriptionMessage::from_json(&header).unwrap_or_else(|_| {
                    SubscriptionMessage::from_json(
                        &serde_json::json!({"error": "serialization failed"}),
                    )
                    .unwrap()
                });
                if sink.send(msg).await.is_err() {
                    // Subscriber disconnected
                    break;
                }
            }
        });
    }

    async fn subscribe_finalized_heads(&self, pending: PendingSubscriptionSink) {
        let client = self.client.clone();

        // Accept the subscription
        let sink = match pending.accept().await {
            Ok(sink) => sink,
            Err(e) => {
                log::warn!("Failed to accept finalized subscription: {:?}", e);
                return;
            }
        };

        // Subscribe to finality notifications
        let mut notifications = client.finality_notification_stream();

        // Stream finalized block headers to subscriber
        tokio::spawn(async move {
            while let Some(notification) = notifications.next().await {
                // Access header fields through the Header trait
                let header_ref = &notification.header;
                let number: u64 = (*header_ref.number()).saturated_into();

                let header = BlockHeader {
                    number,
                    hash: H256::from_slice(notification.hash.as_ref()),
                    parent_hash: H256::from_slice(header_ref.parent_hash().as_ref()),
                    state_root: H256::from_slice(header_ref.state_root().as_ref()),
                    extrinsics_root: H256::from_slice(header_ref.extrinsics_root().as_ref()),
                };

                let msg = SubscriptionMessage::from_json(&header).unwrap_or_else(|_| {
                    SubscriptionMessage::from_json(
                        &serde_json::json!({"error": "serialization failed"}),
                    )
                    .unwrap()
                });
                if sink.send(msg).await.is_err() {
                    // Subscriber disconnected
                    break;
                }
            }
        });
    }
}

/// Create full RPC extensions with Atlas Kernel and system methods
pub fn create_full<C, P>(
    client: Arc<C>,
    _pool: Arc<P>,
    chain_name: String,
) -> Result<jsonrpsee::RpcModule<()>, Box<dyn std::error::Error + Send + Sync>>
where
    C: Send
        + Sync
        + 'static
        + ProvideRuntimeApi<Block>
        + HeaderBackend<Block>
        + BlockBackend<Block>
        + BlockchainEvents<Block>,
    C::Api: AtlasKernelRuntimeApi<Block, AccountId, Balance, AssetId>,
    C::Api: AccountNonceApi<Block, AccountId, Nonce>,
    C::Api: AtomicTradeEngineRuntimeApi<Block>,
    C::Api: EvolutionCoreRuntimeApi<Block, AccountId, BlockNumber>,
    C::Api: X3VerifierRuntimeApi<Block, AccountId, Balance, BlockNumber>,
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
    let eth_compat = EthCompatRpc::<C, Block>::new(client.clone());
    module.merge(EthCompatApiServer::into_rpc(eth_compat))?;

    // Add Health check RPC for monitoring and load balancers
    let health = HealthRpc::<C, Block>::new(client.clone(), chain_name);
    module.merge(HealthApiServer::into_rpc(health))?;

    // Add Atomic Trade Engine RPC for AI agents
    let atomic_trade = AtomicTradeEngineRpc::<C, Block>::new(client.clone());
    module.merge(AtomicTradeEngineApiServer::into_rpc(atomic_trade))?;

    // Add Evolution Core RPC for AIC parameter evolution
    let evolution_core = EvolutionCoreRpc::<C, Block>::new(client.clone());
    module.merge(EvolutionCoreApiServer::into_rpc(evolution_core))?;

    // Add X3 Verifier RPC for off-chain job verification
    let x3_verifier = X3VerifierRpc::<C, Block>::new(client.clone());
    module.merge(X3VerifierApiServer::into_rpc(x3_verifier))?;

    // Add WebSocket subscription handlers for new/finalized blocks
    let chain_sub = ChainSubscriptionRpc::<C, Block>::new(client);
    module.merge(ChainSubscriptionApiServer::into_rpc(chain_sub))?;

    // If the `frontier` feature is enabled, try to add Frontier JSON-RPC modules
    // (full `eth_*`, `net_*`, `web3_*` endpoints). This is compiled conditionally
    // so that builds without Frontier dependencies continue to work.
    #[cfg(feature = "frontier")]
    {
        // TODO: Implement frontier RPC module when needed
        // if let Ok(fmod) = crate::rpc_frontier::create_frontier_stub(client.clone(), _pool) {
        //     module.merge(fmod)?;
        // }
    }

    Ok(module)
}
