use crate::rpc_middleware::{RateLimitConfig, RateLimitMetrics, RateLimiter};
use jsonrpsee::{core::RpcResult, proc_macros::rpc};
use pallet_atomic_trade_engine::{
    runtime_api::{BatchStatusResponse, PriceDataResponse, SimulationResult},
    types::TradeRoute,
    AtomicTradeEngineApi as AtomicTradeEngineRuntimeApi,
};
use pallet_evolution_core::runtime_api::{
    BlockMetricsResponse, EvolutionCoreApi as EvolutionCoreRuntimeApi, EvolutionStatusResponse,
    EvolvableParamsResponse, ProposalResponse,
};
use pallet_transaction_payment_rpc::{
    TransactionPayment, TransactionPaymentApiServer, TransactionPaymentRuntimeApi,
};
use pallet_x3_domain_registry::runtime_api::{
    X3DnsRecordResponse, X3DomainRegistryApi as X3DomainRegistryRuntimeApi, X3DomainResponse,
};
use pallet_x3_kernel::AtlasKernelRuntimeApi;
use pallet_x3_verifier::runtime_api::{
    ExecutorResponse, JobResponse, ReceiptResponse, VerifierStatusResponse,
    X3VerifierApi as X3VerifierRuntimeApi,
};
use sc_client_api::{BlockBackend, BlockchainEvents};
use sc_rpc::SubscriptionTaskExecutor;
use sc_rpc_api::DenyUnsafe;
use sc_transaction_pool_api::TransactionPool;
use sp_api::ProvideRuntimeApi;
use sp_block_builder::BlockBuilder;
use sp_blockchain::HeaderBackend;
use sp_core::H256;
use sp_runtime::traits::{Block as BlockT, SaturatedConversion};
use std::sync::Arc;
use std::sync::OnceLock;
use substrate_frame_rpc_system::{System, SystemApiServer};
/// JSON-RPC Endpoints for X3 Chain
///
/// Provides RPC methods for querying X3 Kernel state via runtime APIs
/// Includes system RPC methods for account nonce queries
/// Supports WebSocket subscriptions for real-time block and event updates
use x3_chain_runtime::{
    opaque::Block, AccountId, AssetId, Balance, BlockNumber, ChainId, Nonce, NATIVE_GAS_PRICE,
};

fn runtime_api_error<E: std::fmt::Debug>(e: E) -> jsonrpsee::core::Error {
    jsonrpsee::core::Error::Call(jsonrpsee::types::error::CallError::Custom(
        jsonrpsee::types::ErrorObjectOwned::owned(
            1,
            format!("Runtime API error: {:?}", e),
            None::<()>,
        ),
    ))
}

static RPC_RATE_LIMITER: OnceLock<RateLimiter> = OnceLock::new();

fn rpc_rate_limiter() -> &'static RateLimiter {
    RPC_RATE_LIMITER.get_or_init(|| RateLimiter::new(RateLimitConfig::default()))
}

fn rate_limit_error(message: String) -> jsonrpsee::core::Error {
    jsonrpsee::core::Error::Call(jsonrpsee::types::error::CallError::Custom(
        jsonrpsee::types::ErrorObjectOwned::owned(-32098, message, None::<()>),
    ))
}

fn enforce_rpc_rate_limit(method: &str) -> RpcResult<()> {
    rpc_rate_limiter()
        .check_request(0, method)
        .map_err(|e| rate_limit_error(format!("Rate limit exceeded for `{method}`: {e}")))
}

/// X3 Kernel RPC API
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

/// Flash Finality RPC API
#[rpc(client, server)]
pub trait FlashFinalityApi<BlockHash> {
    /// Get Flash Finality certificate for a given block hash
    #[method(name = "x3_finalityProof")]
    fn get_finality_proof(
        &self,
        block_hash: BlockHash,
    ) -> RpcResult<Option<flash_finality::FinalityCertificate>>;
}

/// X3 Domains RPC API
///
/// Exposes chain-backed `.x3` domain records for the authoritative DNS server.
#[rpc(client, server)]
pub trait X3DomainsApi<BlockHash> {
    /// Get all records for a domain.
    #[method(name = "x3Domains_getRecords")]
    fn get_records(&self, domain: String, at: Option<BlockHash>) -> RpcResult<Vec<X3DnsRecordRpc>>;

    /// Get domain snapshot (owner + records).
    #[method(name = "x3Domains_getDomain")]
    fn get_domain(
        &self,
        domain: String,
        at: Option<BlockHash>,
    ) -> RpcResult<Option<X3DomainRpcResponse>>;

    /// List all registered domains.
    #[method(name = "x3Domains_listDomains")]
    fn list_domains(&self, at: Option<BlockHash>) -> RpcResult<Vec<String>>;
}

/// DNS record returned via RPC.
#[derive(Clone, Debug, serde::Serialize, serde::Deserialize)]
pub struct X3DnsRecordRpc {
    /// DNS record type (e.g. 1 = A, 28 = AAAA).
    pub rr_type: u16,
    /// Time-to-live in seconds.
    pub ttl: u32,
    /// Record data (address, CNAME, etc.).
    pub data: String,
}

/// Full domain response returned via RPC.
#[derive(Clone, Debug, serde::Serialize, serde::Deserialize)]
pub struct X3DomainRpcResponse {
    /// Registered domain name.
    pub domain: String,
    /// Account that owns the domain.
    pub owner: AccountId,
    /// DNS records attached to this domain.
    pub records: Vec<X3DnsRecordRpc>,
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

/// Node telemetry RPC API (operator-focused observability).
#[rpc(client, server)]
pub trait NodeTelemetryApi {
    /// Fetch current RPC rate-limiter counters.
    #[method(name = "x3Node_getRateLimitMetrics")]
    fn get_rate_limit_metrics(&self) -> RpcResult<RateLimitMetrics>;
}

/// X3 Kernel RPC server implementation
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
        enforce_rpc_rate_limit("atlasKernel_getCanonicalBalance")?;
        let api = self.client.runtime_api();
        let at = at.unwrap_or_else(|| self.client.info().best_hash);

        api.get_canonical_balance(at, account, asset_id)
            .map_err(runtime_api_error)
    }

    fn get_asset_metadata(
        &self,
        asset_id: AssetId,
        at: Option<<Block as BlockT>::Hash>,
    ) -> RpcResult<Option<(Vec<u8>, u8)>> {
        enforce_rpc_rate_limit("atlasKernel_getAssetMetadata")?;
        let api = self.client.runtime_api();
        let at = at.unwrap_or_else(|| self.client.info().best_hash);

        api.get_asset_metadata(at, asset_id)
            .map_err(runtime_api_error)
    }

    fn is_authorized(
        &self,
        account: AccountId,
        at: Option<<Block as BlockT>::Hash>,
    ) -> RpcResult<bool> {
        enforce_rpc_rate_limit("atlasKernel_isAuthorized")?;
        let api = self.client.runtime_api();
        let at = at.unwrap_or_else(|| self.client.info().best_hash);

        api.is_authorized(at, account).map_err(runtime_api_error)
    }

    fn get_authorized_accounts(
        &self,
        at: Option<<Block as BlockT>::Hash>,
    ) -> RpcResult<Vec<AccountId>> {
        enforce_rpc_rate_limit("atlasKernel_getAuthorizedAccounts")?;
        let api = self.client.runtime_api();
        let at = at.unwrap_or_else(|| self.client.info().best_hash);

        api.get_authorized_accounts(at).map_err(runtime_api_error)
    }

    fn get_authorities(&self, at: Option<<Block as BlockT>::Hash>) -> RpcResult<Vec<AccountId>> {
        enforce_rpc_rate_limit("atlasKernel_getAuthorities")?;
        let api = self.client.runtime_api();
        let at = at.unwrap_or_else(|| self.client.info().best_hash);

        api.get_authorities(at).map_err(runtime_api_error)
    }
}

/// Flash Finality RPC server implementation
pub struct FlashFinalityRpc<B> {
    gadget: Arc<flash_finality::FlashFinalityGadget>,
    _marker: std::marker::PhantomData<B>,
}

impl<B> FlashFinalityRpc<B> {
    pub fn new(gadget: Arc<flash_finality::FlashFinalityGadget>) -> Self {
        Self {
            gadget,
            _marker: Default::default(),
        }
    }
}

impl<Block> FlashFinalityApiServer<<Block as BlockT>::Hash> for FlashFinalityRpc<Block>
where
    Block: BlockT,
{
    fn get_finality_proof(
        &self,
        block_hash: <Block as BlockT>::Hash,
    ) -> RpcResult<Option<flash_finality::FinalityCertificate>> {
        enforce_rpc_rate_limit("x3_finalityProof")?;

        // Convert H256 to [u8; 32]
        let hash: [u8; 32] = block_hash.as_ref().try_into().unwrap_or([0u8; 32]);

        // Query gadget for certificate
        // We use block_on here because RPC methods are not async in this version of jsonrpsee
        // Or we can make it async if supported.
        let cert = futures::executor::block_on(self.gadget.get_certificate(hash));
        Ok(cert)
    }
}

/// X3 Domains RPC server implementation
pub struct X3DomainsRpc<C, B> {
    client: Arc<C>,
    _marker: std::marker::PhantomData<B>,
}

impl<C, B> X3DomainsRpc<C, B> {
    /// Create a new X3 Domains RPC instance.
    pub fn new(client: Arc<C>) -> Self {
        Self {
            client,
            _marker: Default::default(),
        }
    }
}

impl<C, Block> X3DomainsApiServer<<Block as BlockT>::Hash> for X3DomainsRpc<C, Block>
where
    Block: BlockT,
    C: Send
        + Sync
        + 'static
        + ProvideRuntimeApi<Block>
        + HeaderBackend<Block>
        + BlockBackend<Block>,
    C::Api: X3DomainRegistryRuntimeApi<Block, AccountId>,
{
    fn get_records(
        &self,
        domain: String,
        at: Option<<Block as BlockT>::Hash>,
    ) -> RpcResult<Vec<X3DnsRecordRpc>> {
        enforce_rpc_rate_limit("x3Domains_getRecords")?;
        let api = self.client.runtime_api();
        let at = at.unwrap_or_else(|| self.client.info().best_hash);

        let records: Vec<X3DnsRecordResponse> = api
            .get_records(at, domain.into_bytes())
            .map_err(runtime_api_error)?;

        Ok(records.into_iter().map(map_x3_record_response).collect())
    }

    fn get_domain(
        &self,
        domain: String,
        at: Option<<Block as BlockT>::Hash>,
    ) -> RpcResult<Option<X3DomainRpcResponse>> {
        enforce_rpc_rate_limit("x3Domains_getDomain")?;
        let api = self.client.runtime_api();
        let at = at.unwrap_or_else(|| self.client.info().best_hash);

        let domain_resp: Option<X3DomainResponse<AccountId>> = api
            .get_domain(at, domain.into_bytes())
            .map_err(runtime_api_error)?;

        Ok(domain_resp.map(|d| X3DomainRpcResponse {
            domain: String::from_utf8_lossy(&d.domain).to_string(),
            owner: d.owner,
            records: d.records.into_iter().map(map_x3_record_response).collect(),
        }))
    }

    fn list_domains(&self, at: Option<<Block as BlockT>::Hash>) -> RpcResult<Vec<String>> {
        enforce_rpc_rate_limit("x3Domains_listDomains")?;
        let api = self.client.runtime_api();
        let at = at.unwrap_or_else(|| self.client.info().best_hash);

        let domains = api.list_domains(at).map_err(runtime_api_error)?;

        Ok(domains
            .into_iter()
            .map(|d| String::from_utf8_lossy(&d).to_string())
            .collect())
    }
}

fn map_x3_record_response(r: X3DnsRecordResponse) -> X3DnsRecordRpc {
    let data = match r.rr_type {
        1 if r.data.len() == 4 => {
            let ip = std::net::Ipv4Addr::new(r.data[0], r.data[1], r.data[2], r.data[3]);
            ip.to_string()
        }
        28 if r.data.len() == 16 => {
            let mut octets = [0u8; 16];
            octets.copy_from_slice(&r.data[..16]);
            let ip = std::net::Ipv6Addr::from(octets);
            ip.to_string()
        }
        _ => String::from_utf8_lossy(&r.data).to_string(),
    };

    X3DnsRecordRpc {
        rr_type: r.rr_type,
        ttl: r.ttl,
        data,
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
        enforce_rpc_rate_limit("eth_chainId")?;
        // Return hex-encoded chain ID quantity (Ethereum-style)
        let id: u64 = ChainId::get();
        Ok(format!("0x{:x}", id))
    }

    fn gas_price(&self) -> RpcResult<String> {
        enforce_rpc_rate_limit("eth_gasPrice")?;
        // Return hex-encoded gas price in native units
        let price: u64 = NATIVE_GAS_PRICE;
        Ok(format!("0x{:x}", price))
    }

    fn block_number(&self) -> RpcResult<String> {
        enforce_rpc_rate_limit("eth_blockNumber")?;
        // Map best Substrate block number to Ethereum-style hex quantity
        let info = self.client.info();
        let n: u64 = info.best_number.saturated_into();
        Ok(format!("0x{:x}", n))
    }
}

/// Node telemetry RPC implementation.
pub struct NodeTelemetryRpc;

impl NodeTelemetryRpc {
    /// Create a new node telemetry RPC instance.
    pub fn new() -> Self {
        Self
    }
}

impl Default for NodeTelemetryRpc {
    fn default() -> Self {
        Self::new()
    }
}

impl NodeTelemetryApiServer for NodeTelemetryRpc {
    fn get_rate_limit_metrics(&self) -> RpcResult<RateLimitMetrics> {
        enforce_rpc_rate_limit("x3Node_getRateLimitMetrics")?;
        Ok(rpc_rate_limiter().metrics())
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

    /// Resolve the best execution path across registered AMM adapters
    #[method(name = "x3_findBestPath")]
    fn find_best_path(
        &self,
        token_in: H256,
        token_out: H256,
        amount_in: u128,
        at: Option<BlockHash>,
    ) -> RpcResult<Option<TradeRoute>>;
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
        enforce_rpc_rate_limit("atomicTrade_simulate")?;
        let api = self.client.runtime_api();
        let at = at.unwrap_or_else(|| self.client.info().best_hash);

        api.simulate_trade(at, token_in, token_out, amount_in, slippage_bps)
            .map_err(runtime_api_error)
    }

    fn estimate_cost(
        &self,
        legs: u32,
        vm_types: Vec<u8>,
        at: Option<<Block as BlockT>::Hash>,
    ) -> RpcResult<(u64, u64)> {
        enforce_rpc_rate_limit("atomicTrade_estimateCost")?;
        let api = self.client.runtime_api();
        let at = at.unwrap_or_else(|| self.client.info().best_hash);

        api.estimate_execution_cost(at, legs, vm_types)
            .map_err(runtime_api_error)
    }

    fn get_price_data(
        &self,
        token_a: H256,
        token_b: H256,
        at: Option<<Block as BlockT>::Hash>,
    ) -> RpcResult<PriceDataResponse> {
        enforce_rpc_rate_limit("atomicTrade_getPriceData")?;
        let api = self.client.runtime_api();
        let at = at.unwrap_or_else(|| self.client.info().best_hash);

        api.get_price_data(at, token_a, token_b)
            .map_err(runtime_api_error)
    }

    fn get_batch_status(
        &self,
        batch_hash: H256,
        at: Option<<Block as BlockT>::Hash>,
    ) -> RpcResult<BatchStatusResponse> {
        enforce_rpc_rate_limit("atomicTrade_getBatchStatus")?;
        let api = self.client.runtime_api();
        let at = at.unwrap_or_else(|| self.client.info().best_hash);

        api.get_batch_status(at, batch_hash)
            .map_err(runtime_api_error)
    }

    fn is_trade_authorized(
        &self,
        account: AccountId,
        at: Option<<Block as BlockT>::Hash>,
    ) -> RpcResult<bool> {
        enforce_rpc_rate_limit("atomicTrade_isAuthorized")?;
        let api = self.client.runtime_api();
        let at = at.unwrap_or_else(|| self.client.info().best_hash);

        // Convert AccountId to bytes for runtime API
        use parity_scale_codec::Encode;
        let account_bytes = account.encode();

        api.is_authorized(at, account_bytes)
            .map_err(runtime_api_error)
    }

    fn find_best_path(
        &self,
        token_in: H256,
        token_out: H256,
        amount_in: u128,
        at: Option<<Block as BlockT>::Hash>,
    ) -> RpcResult<Option<TradeRoute>> {
        enforce_rpc_rate_limit("x3_findBestPath")?;
        let api = self.client.runtime_api();
        let at = at.unwrap_or_else(|| self.client.info().best_hash);

        api.find_route(at, token_in, token_out, amount_in)
            .map_err(runtime_api_error)
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
        enforce_rpc_rate_limit("evolutionCore_getParams")?;
        let api = self.client.runtime_api();
        let at = at.unwrap_or_else(|| self.client.info().best_hash);

        api.get_params(at).map_err(runtime_api_error)
    }

    fn get_status(
        &self,
        at: Option<<Block as BlockT>::Hash>,
    ) -> RpcResult<EvolutionStatusResponse> {
        enforce_rpc_rate_limit("evolutionCore_getStatus")?;
        let api = self.client.runtime_api();
        let at = at.unwrap_or_else(|| self.client.info().best_hash);

        api.get_status(at).map_err(runtime_api_error)
    }

    fn get_metrics(
        &self,
        depth: u32,
        at: Option<<Block as BlockT>::Hash>,
    ) -> RpcResult<Vec<(BlockNumber, BlockMetricsResponse)>> {
        enforce_rpc_rate_limit("evolutionCore_getMetrics")?;
        let api = self.client.runtime_api();
        let at = at.unwrap_or_else(|| self.client.info().best_hash);

        api.get_recent_metrics(at, depth).map_err(runtime_api_error)
    }

    fn get_pending_proposals(
        &self,
        at: Option<<Block as BlockT>::Hash>,
    ) -> RpcResult<Vec<ProposalResponse<AccountId, BlockNumber>>> {
        enforce_rpc_rate_limit("evolutionCore_getPendingProposals")?;
        let api = self.client.runtime_api();
        let at = at.unwrap_or_else(|| self.client.info().best_hash);

        api.get_pending_proposals(at).map_err(runtime_api_error)
    }

    fn is_enabled(&self, at: Option<<Block as BlockT>::Hash>) -> RpcResult<bool> {
        enforce_rpc_rate_limit("evolutionCore_isEnabled")?;
        let api = self.client.runtime_api();
        let at = at.unwrap_or_else(|| self.client.info().best_hash);

        api.is_evolution_enabled(at).map_err(runtime_api_error)
    }

    fn is_ai_agent(
        &self,
        account: AccountId,
        at: Option<<Block as BlockT>::Hash>,
    ) -> RpcResult<bool> {
        enforce_rpc_rate_limit("evolutionCore_isAiAgent")?;
        let api = self.client.runtime_api();
        let at = at.unwrap_or_else(|| self.client.info().best_hash);

        api.is_ai_agent(at, account).map_err(runtime_api_error)
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
        enforce_rpc_rate_limit("x3Verifier_getStatus")?;
        let api = self.client.runtime_api();
        let at = at.unwrap_or_else(|| self.client.info().best_hash);

        api.get_status(at).map_err(runtime_api_error)
    }

    fn get_executor(
        &self,
        account: AccountId,
        at: Option<<Block as BlockT>::Hash>,
    ) -> RpcResult<Option<ExecutorResponse<AccountId, Balance>>> {
        enforce_rpc_rate_limit("x3Verifier_getExecutor")?;
        let api = self.client.runtime_api();
        let at = at.unwrap_or_else(|| self.client.info().best_hash);

        api.get_executor(at, account).map_err(runtime_api_error)
    }

    fn get_active_executors(
        &self,
        at: Option<<Block as BlockT>::Hash>,
    ) -> RpcResult<Vec<ExecutorResponse<AccountId, Balance>>> {
        enforce_rpc_rate_limit("x3Verifier_getActiveExecutors")?;
        let api = self.client.runtime_api();
        let at = at.unwrap_or_else(|| self.client.info().best_hash);

        api.get_active_executors(at).map_err(runtime_api_error)
    }

    fn get_job(
        &self,
        job_id: H256,
        at: Option<<Block as BlockT>::Hash>,
    ) -> RpcResult<Option<JobResponse<AccountId, Balance, BlockNumber>>> {
        enforce_rpc_rate_limit("x3Verifier_getJob")?;
        let api = self.client.runtime_api();
        let at = at.unwrap_or_else(|| self.client.info().best_hash);

        api.get_job(at, job_id).map_err(runtime_api_error)
    }

    fn get_pending_jobs(
        &self,
        at: Option<<Block as BlockT>::Hash>,
    ) -> RpcResult<Vec<JobResponse<AccountId, Balance, BlockNumber>>> {
        enforce_rpc_rate_limit("x3Verifier_getPendingJobs")?;
        let api = self.client.runtime_api();
        let at = at.unwrap_or_else(|| self.client.info().best_hash);

        api.get_pending_jobs(at).map_err(runtime_api_error)
    }

    fn get_receipt(
        &self,
        job_id: H256,
        at: Option<<Block as BlockT>::Hash>,
    ) -> RpcResult<Option<ReceiptResponse<AccountId>>> {
        enforce_rpc_rate_limit("x3Verifier_getReceipt")?;
        let api = self.client.runtime_api();
        let at = at.unwrap_or_else(|| self.client.info().best_hash);

        api.get_receipt(at, job_id).map_err(runtime_api_error)
    }

    fn is_enabled(&self, at: Option<<Block as BlockT>::Hash>) -> RpcResult<bool> {
        enforce_rpc_rate_limit("x3Verifier_isEnabled")?;
        let api = self.client.runtime_api();
        let at = at.unwrap_or_else(|| self.client.info().best_hash);

        api.is_verification_enabled(at).map_err(runtime_api_error)
    }

    fn is_executor(
        &self,
        account: AccountId,
        at: Option<<Block as BlockT>::Hash>,
    ) -> RpcResult<bool> {
        enforce_rpc_rate_limit("x3Verifier_isExecutor")?;
        let api = self.client.runtime_api();
        let at = at.unwrap_or_else(|| self.client.info().best_hash);

        api.is_executor(at, account).map_err(runtime_api_error)
    }
}

/// Create full RPC extensions with X3 Kernel and system methods
pub fn create_full<C, P>(
    client: Arc<C>,
    pool: Arc<P>,
    deny_unsafe: DenyUnsafe,
    _subscription_executor: SubscriptionTaskExecutor,
    flash_finality_gadget: Option<Arc<flash_finality::FlashFinalityGadget>>,
) -> Result<jsonrpsee::RpcModule<()>, Box<dyn std::error::Error + Send + Sync>>
where
    C: Send
        + Sync
        + 'static
        + ProvideRuntimeApi<Block>
        + HeaderBackend<Block>
        + BlockBackend<Block>
        + BlockchainEvents<Block>,
    C::Api: substrate_frame_rpc_system::AccountNonceApi<Block, AccountId, Nonce>,
    C::Api: TransactionPaymentRuntimeApi<Block, Balance>,
    C::Api: BlockBuilder<Block>,
    C::Api: AtlasKernelRuntimeApi<Block, AccountId, Balance, AssetId>,
    C::Api: X3DomainRegistryRuntimeApi<Block, AccountId>,
    C::Api: AtomicTradeEngineRuntimeApi<Block>,
    C::Api: EvolutionCoreRuntimeApi<Block, AccountId, BlockNumber>,
    C::Api: X3VerifierRuntimeApi<Block, AccountId, Balance, BlockNumber>,
    P: TransactionPool + 'static,
{
    use jsonrpsee::RpcModule;

    let mut module = RpcModule::new(());

    // Add standard Substrate modules
    module.merge(System::new(client.clone(), pool.clone(), deny_unsafe).into_rpc())?;
    module.merge(TransactionPayment::new(client.clone()).into_rpc())?;

    // Add X3 Kernel custom RPC
    let x3_kernel = AtlasKernelRpc::<C, Block>::new(client.clone());
    module.merge(AtlasKernelApiServer::into_rpc(x3_kernel))?;

    // Add X3 Domains custom RPC
    let x3_domains = X3DomainsRpc::<C, Block>::new(client.clone());
    module.merge(X3DomainsApiServer::into_rpc(x3_domains))?;

    // Add minimal Ethereum-compatible RPC (chainId, gasPrice, blockNumber)
    let eth_compat = EthCompatRpc::<C, Block>::new(client.clone());
    module.merge(EthCompatApiServer::into_rpc(eth_compat))?;

    // Add node telemetry RPC (rate-limiter counters)
    let node_telemetry = NodeTelemetryRpc::new();
    module.merge(NodeTelemetryApiServer::into_rpc(node_telemetry))?;

    // Add Atomic Trade Engine RPC for AI agents
    let atomic_trade = AtomicTradeEngineRpc::<C, Block>::new(client.clone());
    module.merge(AtomicTradeEngineApiServer::into_rpc(atomic_trade))?;

    // Add Evolution Core RPC for AIC parameter evolution
    let evolution_core = EvolutionCoreRpc::<C, Block>::new(client.clone());
    module.merge(EvolutionCoreApiServer::into_rpc(evolution_core))?;

    // Add X3 Verifier RPC for off-chain job verification
    let x3_verifier = X3VerifierRpc::<C, Block>::new(client.clone());
    module.merge(X3VerifierApiServer::into_rpc(x3_verifier))?;

    // If the `frontier` feature is enabled, try to add Frontier JSON-RPC modules
    // (full `eth_*`, `net_*`, `web3_*` endpoints). This is compiled conditionally
    // so that builds without Frontier dependencies continue to work.
    #[cfg(feature = "frontier")]
    {
        if let Ok(fmod) = crate::rpc_frontier::create_frontier_stub(client.clone()) {
            module.merge(fmod)?;
        }
    }

    if let Some(gadget) = flash_finality_gadget {
        module.merge(FlashFinalityRpc::new(gadget).into_rpc())?;
    }

    Ok(module)
}
