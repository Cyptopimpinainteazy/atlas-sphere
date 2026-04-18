//! Cross-chain GPU validator service for Solana and Ethereum
//!
//! This crate provides GPU-accelerated validation of signatures and hashes for EVM,
//! coupled with an atomic swap orchestrator for dual-chain commit/rollback semantics.

pub mod dashboard;
pub mod error;
pub mod evm_validator;
pub mod failover;
pub mod kernels;
pub mod orchestrator;
pub mod registry;
pub mod svm_validator;

pub use error::ValidatorError;
pub use kernels::{Keccak256Kernel, Secp256k1Kernel};
pub use orchestrator::{AtomicSwapOrchestrator, SwapStatus};

/// Core validator types and traits
#[derive(Debug, Clone, serde::Serialize, serde::Deserialize)]
pub struct ValidationResult {
    pub valid: bool,
    pub error: Option<String>,
    pub duration_ms: u64,
}

#[derive(Debug, Clone, serde::Serialize, serde::Deserialize)]
pub struct SwapRequest {
    pub swap_id: String,
    pub evm_data: Vec<u8>,
    pub svm_data: Vec<u8>,
    pub timeout_secs: u64,
}
