//! SVM (Solana Virtual Machine) Integration for Atlas Sphere
//!
//! This crate provides integration points for executing SVM transactions
//! as part of dual-VM operations on Atlas Sphere.
//! Uses solana-rbpf for actual BPF program execution.

#![cfg_attr(not(feature = "std"), no_std)]

extern crate alloc;

use parity_scale_codec::{Decode, Encode};
use scale_info::TypeInfo;
use sp_std::vec;
use sp_std::vec::Vec;

/// Real BPF execution module (std only)
#[cfg(feature = "std")]
pub mod rbpf;

#[cfg(feature = "std")]
pub use rbpf::RbpfSvmExecutor;

/// Result type for SVM operations
pub type SvmResult<T> = Result<T, SvmError>;

/// Errors that can occur during SVM execution
#[derive(Debug, Clone, PartialEq, Eq, Encode, Decode, TypeInfo)]
pub enum SvmError {
    /// Invalid program or transaction data
    InvalidPayload,
    /// Program execution failed
    ExecutionFailed,
    /// Account not found or invalid
    InvalidAccount,
    /// Signature verification failed
    InvalidSignature,
    /// Out of compute units
    OutOfComputeUnits,
    /// Invalid instruction data
    InvalidInstructionData,
    /// Account data too small
    AccountDataTooSmall,
    /// Insufficient funds for fee
    InsufficientFunds,
    /// Program not executable
    ProgramNotExecutable,
    /// Invalid program ID
    InvalidProgramId,
    /// Other execution error with code
    ExecutionError(u32),
}

/// Represents the result of SVM program execution
#[derive(Debug, Clone, Default, PartialEq, Eq, Encode, Decode, TypeInfo)]
pub struct SvmExecutionResult {
    /// Whether execution succeeded
    pub success: bool,
    /// Output data from the execution (return data)
    pub output: Vec<u8>,
    /// Compute units used in the execution
    pub compute_units_used: u64,
    /// Account changes during execution
    pub account_updates: Vec<AccountUpdate>,
    /// Log messages emitted by the program
    pub logs: Vec<Vec<u8>>,
    /// State root after execution
    pub state_root: [u8; 32],
}

/// Represents an update to an account during SVM execution
#[derive(Debug, Clone, PartialEq, Eq, Encode, Decode, TypeInfo)]
pub struct AccountUpdate {
    /// Account public key (32 bytes)
    pub pubkey: [u8; 32],
    /// New account data
    pub data: Vec<u8>,
    /// New lamport balance
    pub lamports: u64,
    /// Is account executable
    pub executable: bool,
    /// Owner program ID
    pub owner: [u8; 32],
    /// Rent epoch
    pub rent_epoch: u64,
}

impl Default for AccountUpdate {
    fn default() -> Self {
        Self {
            pubkey: [0u8; 32],
            data: Vec::new(),
            lamports: 0,
            executable: false,
            owner: [0u8; 32],
            rent_epoch: 0,
        }
    }
}

/// SVM execution environment configuration
#[derive(Debug, Clone, Encode, Decode, TypeInfo)]
pub struct SvmConfig {
    /// Maximum compute units per transaction
    pub compute_unit_limit: u64,
    /// Compute unit price (microlamports)
    pub compute_unit_price: u64,
    /// Block height (slot) for execution context
    pub slot: u64,
    /// Block timestamp for execution context (unix timestamp)
    pub block_timestamp: i64,
    /// Recent blockhash for transaction validation
    pub recent_blockhash: [u8; 32],
    /// Enable cross-program invocation (CPI)
    pub enable_cpi: bool,
    /// Maximum CPI depth
    pub max_cpi_depth: u8,
}

impl Default for SvmConfig {
    fn default() -> Self {
        Self {
            compute_unit_limit: 200_000,
            compute_unit_price: 1,
            slot: 0,
            block_timestamp: 0,
            recent_blockhash: [0u8; 32],
            enable_cpi: true,
            max_cpi_depth: 4,
        }
    }
}

impl SvmConfig {
    /// Create a new SvmConfig with explicit parameters
    pub fn new(
        compute_unit_limit: u64,
        compute_unit_price: u64,
        slot: u64,
        block_timestamp: i64,
    ) -> Self {
        Self {
            compute_unit_limit,
            compute_unit_price,
            slot,
            block_timestamp,
            recent_blockhash: [0u8; 32],
            enable_cpi: true,
            max_cpi_depth: 4,
        }
    }

    /// Set the recent blockhash
    pub fn with_blockhash(mut self, hash: [u8; 32]) -> Self {
        self.recent_blockhash = hash;
        self
    }

    /// Enable/disable CPI
    pub fn with_cpi(mut self, enable: bool, max_depth: u8) -> Self {
        self.enable_cpi = enable;
        self.max_cpi_depth = max_depth;
        self
    }
}

/// Instruction for SVM execution
#[derive(Debug, Clone, Encode, Decode, TypeInfo)]
pub struct SvmInstruction {
    /// Program ID to invoke
    pub program_id: [u8; 32],
    /// Accounts required by the instruction
    pub accounts: Vec<SvmAccountMeta>,
    /// Instruction data
    pub data: Vec<u8>,
}

/// Account metadata for SVM instruction
#[derive(Debug, Clone, Encode, Decode, TypeInfo)]
pub struct SvmAccountMeta {
    /// Account public key
    pub pubkey: [u8; 32],
    /// Is signer
    pub is_signer: bool,
    /// Is writable
    pub is_writable: bool,
}

/// Trait for SVM execution adapters
pub trait SvmExecutor {
    /// Execute SVM program with instruction
    fn execute(
        &self,
        instruction: &SvmInstruction,
        payer: [u8; 32],
        accounts: &[(SvmAccountMeta, AccountUpdate)],
        config: &SvmConfig,
    ) -> SvmResult<SvmExecutionResult>;

    /// Execute raw BPF bytecode directly
    fn execute_bpf(
        &self,
        program: &[u8],
        input: &[u8],
        config: &SvmConfig,
    ) -> SvmResult<SvmExecutionResult>;

    /// Validate BPF program
    fn validate_program(&self, program: &[u8]) -> SvmResult<()>;
}

/// Mock SVM executor for testing (always succeeds)
pub struct MockSvmExecutor;

impl SvmExecutor for MockSvmExecutor {
    fn execute(
        &self,
        instruction: &SvmInstruction,
        _payer: [u8; 32],
        _accounts: &[(SvmAccountMeta, AccountUpdate)],
        config: &SvmConfig,
    ) -> SvmResult<SvmExecutionResult> {
        if instruction.data.is_empty() && instruction.program_id == [0u8; 32] {
            return Err(SvmError::InvalidPayload);
        }

        Ok(SvmExecutionResult {
            success: true,
            output: vec![0x01],
            compute_units_used: config.compute_unit_limit / 2,
            account_updates: vec![],
            logs: vec![],
            state_root: [0u8; 32],
        })
    }

    fn execute_bpf(
        &self,
        program: &[u8],
        _input: &[u8],
        config: &SvmConfig,
    ) -> SvmResult<SvmExecutionResult> {
        if program.is_empty() {
            return Err(SvmError::InvalidPayload);
        }

        Ok(SvmExecutionResult {
            success: true,
            output: vec![0x01],
            compute_units_used: config.compute_unit_limit / 2,
            account_updates: vec![],
            logs: vec![],
            state_root: [0u8; 32],
        })
    }

    fn validate_program(&self, program: &[u8]) -> SvmResult<()> {
        if program.is_empty() {
            Err(SvmError::InvalidPayload)
        } else {
            Ok(())
        }
    }
}

/// Prepare root computation for SVM execution
pub fn compute_svm_prepare_root(
    comit_id: &[u8; 32],
    instruction: &SvmInstruction,
    result: &SvmExecutionResult,
) -> [u8; 32] {
    use sp_io::hashing::blake2_256;

    let mut preimage = Vec::new();
    preimage.extend_from_slice(comit_id);
    preimage.extend_from_slice(&instruction.program_id);
    preimage.extend_from_slice(&instruction.data);
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
        assert!(config.enable_cpi);
        assert_eq!(config.max_cpi_depth, 4);
    }

    #[test]
    fn test_mock_executor_success() {
        let executor = MockSvmExecutor;
        let instruction = SvmInstruction {
            program_id: [1u8; 32],
            accounts: vec![],
            data: vec![0x01, 0x02],
        };
        let result = executor.execute(&instruction, [0u8; 32], &[], &SvmConfig::default());
        assert!(result.is_ok());
        assert!(result.unwrap().success);
    }

    #[test]
    fn test_mock_executor_bpf() {
        let executor = MockSvmExecutor;
        let result = executor.execute_bpf(&[0x79, 0x00], &[], &SvmConfig::default());
        assert!(result.is_ok());
    }

    #[test]
    fn test_mock_executor_empty_program() {
        let executor = MockSvmExecutor;
        let result = executor.execute_bpf(&[], &[], &SvmConfig::default());
        assert_eq!(result, Err(SvmError::InvalidPayload));
    }
}
