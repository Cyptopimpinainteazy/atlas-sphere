// EVM Integration Layer for Atlas Sphere
// This module provides the bridge between the Atlas Kernel and the EVM execution environment

#![cfg_attr(not(feature = "std"), no_std)]

use sp_core::H160;
use sp_std::vec::Vec;
use sp_std::vec;

/// Result type for EVM operations
pub type EvmResult<T> = Result<T, EvmError>;

/// Errors that can occur during EVM execution
#[derive(Debug, Clone, PartialEq, Eq)]
pub enum EvmError {
    /// Invalid bytecode or transaction data
    InvalidPayload,
    /// EVM execution reverted
    ExecutionReverted,
    /// Out of gas
    OutOfGas,
    /// Invalid account state
    InvalidState,
    /// Other execution error
    ExecutionFailed(u32),
}

/// Represents the result of EVM execution
#[derive(Debug, Clone, Default, PartialEq, Eq)]
pub struct EvmExecutionResult {
    /// Whether execution succeeded
    pub success: bool,
    /// Output data from the execution
    pub output: Vec<u8>,
    /// Gas used in the execution
    pub gas_used: u64,
    /// Any logs emitted during execution
    pub logs: Vec<EvmLog>,
    /// State root after execution
    pub state_root: [u8; 32],
}

/// Represents an EVM log entry
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct EvmLog {
    /// Address that emitted the log
    pub address: H160,
    /// Topics for the log
    pub topics: Vec<[u8; 32]>,
    /// Data payload
    pub data: Vec<u8>,
}

/// EVM execution environment configuration
#[derive(Debug, Clone)]
pub struct EvmConfig {
    /// Maximum gas per transaction
    pub gas_limit: u64,
    /// Gas price per unit
    pub gas_price: u64,
    /// Block number for execution context
    pub block_number: u64,
    /// Block timestamp for execution context
    pub block_timestamp: u64,
    /// Chain ID
    pub chain_id: u64,
}

impl Default for EvmConfig {
    fn default() -> Self {
        Self {
            gas_limit: 21_000_000,      // ~20M gas per block
            gas_price: 1,                // 1 wei
            block_number: 0,
            block_timestamp: 0,
            chain_id: 42,                // Atlas Sphere chain ID
        }
    }
}

/// Trait for EVM execution adapters
pub trait EvmExecutor {
    /// Execute EVM bytecode
    fn execute(
        &self,
        payload: &[u8],
        caller: &[u8; 20],
        config: &EvmConfig,
    ) -> EvmResult<EvmExecutionResult>;

    /// Validate EVM bytecode without executing
    fn validate_bytecode(&self, payload: &[u8]) -> EvmResult<()>;
}

/// Mock EVM executor for testing (always succeeds)
pub struct MockEvmExecutor;

impl EvmExecutor for MockEvmExecutor {
    fn execute(
        &self,
        payload: &[u8],
        _caller: &[u8; 20],
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
            state_root: [0u8; 32],
        })
    }

    fn validate_bytecode(&self, payload: &[u8]) -> EvmResult<()> {
        if payload.is_empty() {
            Err(EvmError::InvalidPayload)
        } else {
            Ok(())
        }
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
        let result = executor.execute(&[0x01, 0x02], &[0u8; 20], &EvmConfig::default());
        assert!(result.is_ok());
        let result = result.unwrap();
        assert!(result.success);
    }

    #[test]
    fn test_mock_executor_empty_payload() {
        let executor = MockEvmExecutor;
        let result = executor.execute(&[], &[0u8; 20], &EvmConfig::default());
        assert_eq!(result, Err(EvmError::InvalidPayload));
    }
}

