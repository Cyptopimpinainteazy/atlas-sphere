//! X3 RPC Server
//!
//! JSON-RPC endpoints for block exploration, gas estimation, wallet operations, and DEX integration.

pub mod gas_estimation;
pub mod wallet_dex_rpc;

pub use gas_estimation::{GasEstimationRPC, GasEstimation, RPCTransaction, ExecutionStatus};
pub use wallet_dex_rpc::{WalletDexApi, WalletDexRpc, SwapRequest, SwapResponse, HardwareSigningRequest};
