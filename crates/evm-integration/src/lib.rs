// EVM Integration Layer for Atlas Sphere
// This module provides the bridge between the Atlas Kernel and the EVM execution environment
// Supports REAL EVM execution via Frontier pallet-evm

#![cfg_attr(not(feature = "std"), no_std)]

extern crate alloc;

use parity_scale_codec::{Decode, Encode};
use scale_info::TypeInfo;
use sp_core::{H160, H256, U256};
use sp_std::vec;
use sp_std::vec::Vec;

/// Phase 2: EVM State Integration
/// Account state management, contract code storage, and state database
pub mod state;

/// Frontier EVM execution backend
#[cfg(feature = "std")]
pub mod frontier;

#[cfg(feature = "std")]
pub use frontier::FrontierEvmExecutor;

/// Result type for EVM operations
pub type EvmResult<T> = Result<T, EvmError>;

/// Errors that can occur during EVM execution
#[derive(Debug, Clone, PartialEq, Eq, Encode, Decode, TypeInfo)]
pub enum EvmError {
    /// Invalid bytecode or transaction data
    InvalidPayload,
    /// EVM execution reverted
    ExecutionReverted,
    /// Out of gas
    OutOfGas,
    /// Invalid account state
    InvalidState,
    /// Stack overflow
    StackOverflow,
    /// Stack underflow
    StackUnderflow,
    /// Invalid opcode
    InvalidOpcode(u8),
    /// Contract creation collision
    CreateCollision,
    /// Other execution error with code
    ExecutionFailed(u32),
}

/// Represents the result of EVM execution
#[derive(Debug, Clone, Default, PartialEq, Eq, Encode, Decode, TypeInfo)]
pub struct EvmExecutionResult {
    /// Whether execution succeeded
    pub success: bool,
    /// Output data from the execution
    pub output: Vec<u8>,
    /// Gas used in the execution
    pub gas_used: u64,
    /// Any logs emitted during execution
    pub logs: Vec<EvmLog>,
    /// State changes from execution
    pub state_changes: Vec<EvmStateChange>,
    /// State root after execution (computed from state changes)
    pub state_root: [u8; 32],
}

/// Represents an EVM log entry
#[derive(Debug, Clone, PartialEq, Eq, Encode, Decode, TypeInfo)]
pub struct EvmLog {
    /// Address that emitted the log
    pub address: H160,
    /// Topics for the log
    pub topics: Vec<H256>,
    /// Data payload
    pub data: Vec<u8>,
}

/// Represents a state change from EVM execution
#[derive(Debug, Clone, PartialEq, Eq, Encode, Decode, TypeInfo)]
pub struct EvmStateChange {
    /// Account address affected
    pub address: H160,
    /// Balance change (positive or negative encoded as signed)
    pub balance_delta: i128,
    /// Nonce change
    pub nonce_delta: i64,
    /// Storage changes (key -> new value)
    pub storage_changes: Vec<(H256, H256)>,
    /// New code deployed (if contract creation)
    pub code: Option<Vec<u8>>,
}

/// EVM execution environment configuration
#[derive(Debug, Clone, Encode, Decode, TypeInfo)]
pub struct EvmConfig {
    /// Maximum gas per transaction
    pub gas_limit: u64,
    /// Gas price per unit
    pub gas_price: U256,
    /// Block number for execution context
    pub block_number: u64,
    /// Block timestamp for execution context
    pub block_timestamp: u64,
    /// Chain ID (EIP-155)
    pub chain_id: u64,
    /// Base fee per gas (EIP-1559)
    pub base_fee: U256,
    /// Coinbase/block author address
    pub coinbase: H160,
}

impl Default for EvmConfig {
    fn default() -> Self {
        Self {
            gas_limit: 21_000_000,                // ~20M gas per block
            gas_price: U256::from(1_000_000_000), // 1 gwei
            block_number: 0,
            block_timestamp: 0,
            chain_id: 42,                        // Atlas Sphere default chain ID
            base_fee: U256::from(1_000_000_000), // 1 gwei base
            coinbase: H160::zero(),
        }
    }
}

/// EvmConfig builder for explicit runtime configuration
impl EvmConfig {
    /// Create a new EvmConfig with explicit parameters
    pub fn new(
        gas_limit: u64,
        gas_price: U256,
        block_number: u64,
        block_timestamp: u64,
        chain_id: u64,
    ) -> Self {
        Self {
            gas_limit,
            gas_price,
            block_number,
            block_timestamp,
            chain_id,
            base_fee: U256::from(1_000_000_000),
            coinbase: H160::zero(),
        }
    }

    /// Set the coinbase address
    pub fn with_coinbase(mut self, coinbase: H160) -> Self {
        self.coinbase = coinbase;
        self
    }

    /// Set the base fee
    pub fn with_base_fee(mut self, base_fee: U256) -> Self {
        self.base_fee = base_fee;
        self
    }
}

/// Trait for EVM execution adapters
pub trait EvmExecutor {
    /// Execute EVM bytecode/transaction
    fn execute(
        &self,
        payload: &[u8],
        caller: H160,
        target: Option<H160>, // None for contract creation
        value: U256,
        config: &EvmConfig,
    ) -> EvmResult<EvmExecutionResult>;

    /// Call EVM contract (read-only, no state changes)
    fn call(
        &self,
        payload: &[u8],
        caller: H160,
        target: H160,
        value: U256,
        config: &EvmConfig,
    ) -> EvmResult<EvmExecutionResult>;

    /// Validate EVM bytecode without executing
    fn validate_bytecode(&self, payload: &[u8]) -> EvmResult<()>;

    /// Estimate gas for a transaction
    fn estimate_gas(
        &self,
        payload: &[u8],
        caller: H160,
        target: Option<H160>,
        value: U256,
        config: &EvmConfig,
    ) -> EvmResult<u64>;
}

/// Mock EVM executor for testing (always succeeds)
pub struct MockEvmExecutor;

impl EvmExecutor for MockEvmExecutor {
    fn execute(
        &self,
        payload: &[u8],
        _caller: H160,
        _target: Option<H160>,
        _value: U256,
        config: &EvmConfig,
    ) -> EvmResult<EvmExecutionResult> {
        if payload.is_empty() {
            return Err(EvmError::InvalidPayload);
        }

        Ok(EvmExecutionResult {
            success: true,
            output: vec![0x01], // Success indicator
            gas_used: config.gas_limit / 2,
            logs: vec![],
            state_changes: vec![],
            state_root: [0u8; 32],
        })
    }

    fn call(
        &self,
        payload: &[u8],
        caller: H160,
        target: H160,
        value: U256,
        config: &EvmConfig,
    ) -> EvmResult<EvmExecutionResult> {
        self.execute(payload, caller, Some(target), value, config)
    }

    fn validate_bytecode(&self, payload: &[u8]) -> EvmResult<()> {
        if payload.is_empty() {
            Err(EvmError::InvalidPayload)
        } else {
            Ok(())
        }
    }

    fn estimate_gas(
        &self,
        _payload: &[u8],
        _caller: H160,
        _target: Option<H160>,
        _value: U256,
        config: &EvmConfig,
    ) -> EvmResult<u64> {
        Ok(config.gas_limit / 2)
    }
}

/// Prepare root computation for EVM execution
pub fn compute_evm_prepare_root(
    comit_id: &[u8; 32],
    payload: &[u8],
    result: &EvmExecutionResult,
) -> [u8; 32] {
    use sp_core::hashing::blake2_256;

    let mut preimage = Vec::new();
    preimage.extend_from_slice(comit_id);
    preimage.extend_from_slice(payload);
    preimage.extend_from_slice(&result.state_root);

    blake2_256(&preimage)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_default_config() {
        let config = EvmConfig::default();
        assert_eq!(config.gas_limit, 21_000_000);
        assert_eq!(config.chain_id, 42);
    }

    #[test]
    fn test_mock_executor_success() {
        let executor = MockEvmExecutor;
        let result = executor.execute(
            &[0x01, 0x02],
            H160::zero(),
            Some(H160::zero()),
            U256::zero(),
            &EvmConfig::default(),
        );
        assert!(result.is_ok());
        let result = result.unwrap();
        assert!(result.success);
    }

    #[test]
    fn test_mock_executor_empty_payload() {
        let executor = MockEvmExecutor;
        let result = executor.execute(
            &[],
            H160::zero(),
            Some(H160::zero()),
            U256::zero(),
            &EvmConfig::default(),
        );
        assert_eq!(result, Err(EvmError::InvalidPayload));
    }

    #[test]
    fn test_estimate_gas() {
        let executor = MockEvmExecutor;
        let gas = executor.estimate_gas(
            &[0x60, 0x01],
            H160::zero(),
            None,
            U256::zero(),
            &EvmConfig::default(),
        );
        assert!(gas.is_ok());
    }
}
