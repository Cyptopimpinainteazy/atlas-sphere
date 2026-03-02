//! X3 Atomic Trade Engine
//!
//! RPC endpoints for swaps, quotes, and DEX operations.

pub mod swap_rpc;
pub mod rollback_listener;

pub use swap_rpc::{SwapRPCServer, SwapQuote, SwapOrder, AMMPool};
pub use rollback_listener::{RollbackEventListener, TradeBatchFailure, FailureReason, RollbackLog, FailureNotification, SeverityLevel};
