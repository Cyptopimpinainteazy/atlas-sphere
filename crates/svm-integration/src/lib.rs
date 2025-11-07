//! SVM (Solana Virtual Machine) Integration for Atlas Sphere
//!
//! This crate provides integration points for executing SVM transactions
//! as part of dual-VM operations on Atlas Sphere.

#![cfg_attr(not(feature = "std"), no_std)]

use sp_std::vec::Vec;

/// Result type for SVM operations
pub type SvmResult<T> = Result<T, SvmError>;

/// Errors that can occur during SVM execution
#[derive(Debug, Clone, PartialEq, Eq)]
pub enum SvmError {
    /// Invalid program or transaction data
    InvalidPayload,
    /// Program execution failed
    ExecutionFailed,
    /// Account not found or invalid
    InvalidAccount,
    /// Signature verification failed
    InvalidSignature,
    /// Other execution error
    ExecutionError(u32),
}

/// Represents the result of SVM program execution
#[derive(Debug, Clone, Default, PartialEq, Eq)]
pub struct SvmExecutionResult {
    /// Whether execution succeeded
    pub success: bool,
    /// Output data from the execution
    pub output: Vec<u8>,
    /// Compute units used in the execution
    pub compute_units_used: u64,
    /// Account changes during execution
    pub account_updates: Vec<AccountUpdate>,
    /// State root after execution
    pub state_root: [u8; 32],
}

/// Represents an update to an account during SVM execution
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct AccountUpdate {
    /// Account public key (32 bytes)
    pub pubkey: [u8; 32],
    /// New account data
    pub data: Vec<u8>,
    /// New lamport balance
    pub lamports: u64,
    /// Is account executable
    pub executable: bool,
}

/// SVM execution environment configuration
#[derive(Debug, Clone)]
pub struct SvmConfig {
    /// Maximum compute units per transaction
    pub compute_unit_limit: u64,
    /// Compute unit price (microlamports)
    pub compute_unit_price: u64,
    /// Block height for execution context
    pub block_height: u64,
    /// Block timestamp for execution context
    pub block_timestamp: u64,
    /// Cluster identifier
    pub cluster_id: u8,
}

impl Default for SvmConfig {
    fn default() -> Self {
        Self {
            compute_unit_limit: 200_000,      // Standard compute limit
            compute_unit_price: 1,              // 1 microlamport per compute unit
            block_height: 0,
            block_timestamp: 0,
            cluster_id: 42,                    // Atlas Sphere cluster ID
        }
    }
}

/// Trait for SVM execution adapters
pub trait SvmExecutor {
    /// Execute SVM program
    fn execute(
        &self,
        payload: &[u8],
        payer: &[u8; 32],
        config: &SvmConfig,
    ) -> SvmResult<SvmExecutionResult>;

    /// Validate SVM program without executing
    fn validate_program(&self, payload: &[u8]) -> SvmResult<()>;
}

/// Mock SVM executor for testing (always succeeds)
pub struct MockSvmExecutor;

impl SvmExecutor for MockSvmExecutor {
    fn execute(
        &self,
        payload: &[u8],
        _payer: &[u8; 32],
        config: &SvmConfig,
    ) -> SvmResult<SvmExecutionResult> {
        if payload.is_empty() {
            return Err(SvmError::InvalidPayload);
        }

        Ok(SvmExecutionResult {
            success: true,
            output: vec![0x01], // Success indicator
            compute_units_used: config.compute_unit_limit / 2,
            account_updates: vec![],
            state_root: [0u8; 32],
        })
    }

    fn validate_program(&self, payload: &[u8]) -> SvmResult<()> {
        if payload.is_empty() {
            Err(SvmError::InvalidPayload)
        } else {
            Ok(())
        }
    }
}

/// Prepare root computation for SVM execution
pub fn compute_svm_prepare_root(
    comit_id: &[u8; 32],
    payload: &[u8],
    result: &SvmExecutionResult,
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
        let config = SvmConfig::default();
        assert_eq!(config.compute_unit_limit, 200_000);
        assert_eq!(config.cluster_id, 42);
    }

    #[test]
    fn test_mock_executor_success() {
        let executor = MockSvmExecutor;
        let result = executor.execute(&[0x01, 0x02], &[0u8; 32], &SvmConfig::default());
        assert!(result.is_ok());
        let result = result.unwrap();
        assert!(result.success);
    }

    #[test]
    fn test_mock_executor_empty_payload() {
        let executor = MockSvmExecutor;
        let result = executor.execute(&[], &[0u8; 32], &SvmConfig::default());
        assert_eq!(result, Err(SvmError::InvalidPayload));
    }
}

