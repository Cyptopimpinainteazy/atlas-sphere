//! VM Execution Adapters for Atlas Kernel
//!
//! This module provides the bridge between the pallet's execution interface
//! and the real EVM/SVM executors from the integration crates.

#[cfg(feature = "std")]
use crate::ExecutionLog;
use crate::{ExecutionReceipt, StateChange};
use frame_support::pallet_prelude::*;
use sp_core::H256;
use sp_std::vec;
use sp_std::vec::Vec;

/// Trait for EVM execution adapters
/// Runtime configures this with either MockEvmAdapter (tests) or FrontierEvmAdapter (production)
pub trait EvmExecutorAdapter {
    /// Execute EVM payload and return execution receipt
    fn execute(payload: &[u8], gas_limit: u64) -> Result<ExecutionReceipt, DispatchError>;

    /// Estimate gas for a payload without state changes
    fn estimate_gas(payload: &[u8]) -> Result<u64, DispatchError>;

    /// Validate EVM bytecode without execution
    fn validate(payload: &[u8]) -> Result<(), DispatchError>;
}

/// Trait for SVM execution adapters
/// Runtime configures this with either MockSvmAdapter (tests) or RbpfSvmAdapter (production)
pub trait SvmExecutorAdapter {
    /// Execute SVM/BPF payload and return execution receipt
    fn execute(payload: &[u8], compute_limit: u64) -> Result<ExecutionReceipt, DispatchError>;

    /// Validate BPF program without execution
    fn validate(payload: &[u8]) -> Result<(), DispatchError>;
}

/// Mock EVM adapter for testing - always succeeds with predictable values
pub struct MockEvmAdapter;

impl EvmExecutorAdapter for MockEvmAdapter {
    fn execute(payload: &[u8], _gas_limit: u64) -> Result<ExecutionReceipt, DispatchError> {
        // Mock execution: hash payload to generate deterministic state changes
        let state_root = if payload.is_empty() {
            H256::zero()
        } else {
            H256::from(sp_io::hashing::blake2_256(payload))
        };

        Ok(ExecutionReceipt {
            success: true,
            gas_used: 21000 + (payload.len() as u64 * 68), // Base + calldata gas
            return_data: Vec::new(),
            logs: Vec::new(),
            state_changes: vec![StateChange {
                address: vec![0u8; 20], // Zero address
                key: state_root,
                value: state_root,
            }],
        })
    }

    fn estimate_gas(payload: &[u8]) -> Result<u64, DispatchError> {
        Ok(21000 + (payload.len() as u64 * 68))
    }

    fn validate(payload: &[u8]) -> Result<(), DispatchError> {
        if payload.is_empty() {
            return Err(DispatchError::Other("Empty EVM payload"));
        }
        Ok(())
    }
}

impl EvmExecutorAdapter for () {
    fn execute(_payload: &[u8], _gas_limit: u64) -> Result<ExecutionReceipt, DispatchError> {
        // Unit type returns mock receipt (for backwards compatibility)
        Ok(ExecutionReceipt {
            success: true,
            gas_used: 21000,
            return_data: Vec::new(),
            logs: Vec::new(),
            state_changes: Vec::new(),
        })
    }

    fn estimate_gas(_payload: &[u8]) -> Result<u64, DispatchError> {
        Ok(21000)
    }

    fn validate(_payload: &[u8]) -> Result<(), DispatchError> {
        Ok(())
    }
}

/// Mock SVM adapter for testing - always succeeds with predictable values
pub struct MockSvmAdapter;

impl SvmExecutorAdapter for MockSvmAdapter {
    fn execute(payload: &[u8], _compute_limit: u64) -> Result<ExecutionReceipt, DispatchError> {
        // Mock execution: hash payload to generate deterministic state changes
        let state_root = if payload.is_empty() {
            H256::zero()
        } else {
            H256::from(sp_io::hashing::blake2_256(payload))
        };

        Ok(ExecutionReceipt {
            success: true,
            gas_used: 5000 + (payload.len() as u64 * 10), // Base + instruction cost
            return_data: Vec::new(),
            logs: Vec::new(),
            state_changes: vec![StateChange {
                address: vec![0u8; 32], // Zero pubkey
                key: state_root,
                value: state_root,
            }],
        })
    }

    fn validate(payload: &[u8]) -> Result<(), DispatchError> {
        if payload.is_empty() {
            return Err(DispatchError::Other("Empty SVM payload"));
        }
        Ok(())
    }
}

/// Mock EVM adapter that simulates failures for testing error paths (L-5)
/// Fails when payload starts with 0xFF
pub struct FailingMockEvmAdapter;

impl EvmExecutorAdapter for FailingMockEvmAdapter {
    fn execute(payload: &[u8], gas_limit: u64) -> Result<ExecutionReceipt, DispatchError> {
        // Simulate failure when payload starts with 0xFF
        if payload.first() == Some(&0xFF) {
            return Err(DispatchError::Other("EVM execution failed (simulated)"));
        }
        // Simulate execution failure (success=false) when payload starts with 0xFE
        if payload.first() == Some(&0xFE) {
            return Ok(ExecutionReceipt {
                success: false,
                gas_used: gas_limit / 2, // Partial gas consumed
                return_data: b"revert".to_vec(),
                logs: Vec::new(),
                state_changes: Vec::new(),
            });
        }
        // Otherwise delegate to normal mock
        MockEvmAdapter::execute(payload, gas_limit)
    }

    fn estimate_gas(payload: &[u8]) -> Result<u64, DispatchError> {
        MockEvmAdapter::estimate_gas(payload)
    }

    fn validate(payload: &[u8]) -> Result<(), DispatchError> {
        MockEvmAdapter::validate(payload)
    }
}

/// Mock SVM adapter that simulates failures for testing error paths (L-5)
/// Fails when payload starts with 0xFF
pub struct FailingMockSvmAdapter;

impl SvmExecutorAdapter for FailingMockSvmAdapter {
    fn execute(payload: &[u8], compute_limit: u64) -> Result<ExecutionReceipt, DispatchError> {
        // Simulate failure when payload starts with 0xFF
        if payload.first() == Some(&0xFF) {
            return Err(DispatchError::Other("SVM execution failed (simulated)"));
        }
        // Simulate execution failure (success=false) when payload starts with 0xFE
        if payload.first() == Some(&0xFE) {
            return Ok(ExecutionReceipt {
                success: false,
                gas_used: compute_limit / 2,
                return_data: b"program error".to_vec(),
                logs: Vec::new(),
                state_changes: Vec::new(),
            });
        }
        // Otherwise delegate to normal mock
        MockSvmAdapter::execute(payload, compute_limit)
    }

    fn validate(payload: &[u8]) -> Result<(), DispatchError> {
        MockSvmAdapter::validate(payload)
    }
}

impl SvmExecutorAdapter for () {
    fn execute(_payload: &[u8], _compute_limit: u64) -> Result<ExecutionReceipt, DispatchError> {
        // Unit type returns mock receipt (for backwards compatibility)
        Ok(ExecutionReceipt {
            success: true,
            gas_used: 5000,
            return_data: Vec::new(),
            logs: Vec::new(),
            state_changes: Vec::new(),
        })
    }

    fn validate(_payload: &[u8]) -> Result<(), DispatchError> {
        Ok(())
    }
}

#[cfg(feature = "std")]
pub mod real_adapters {
    //! Real VM adapters using Frontier EVM and solana-rbpf
    //!
    //! These are only available in std builds due to external dependencies

    use super::*;
    use atlas_evm_integration::{EvmConfig, EvmExecutor, MockEvmExecutor};
    use atlas_svm_integration::{RbpfSvmExecutor, SvmConfig, SvmExecutor};
    use sp_core::{H160, U256};

    /// Production EVM adapter using Frontier
    pub struct FrontierEvmAdapter;

    impl EvmExecutorAdapter for FrontierEvmAdapter {
        fn execute(payload: &[u8], gas_limit: u64) -> Result<ExecutionReceipt, DispatchError> {
            let executor = atlas_evm_integration::MockEvmExecutor; // Use mock for now until pallet-evm is wired

            let config = EvmConfig {
                chain_id: 1, // Atlas chain ID
                gas_limit,
                gas_price: sp_core::U256::from(1_000_000_000u64), // 1 Gwei
                block_number: 0,
                block_timestamp: 0,
                base_fee: sp_core::U256::from(1_000_000_000u64),
                coinbase: H160::zero(),
            };

            // Execute with zero caller/value for now - full integration would parse tx
            let result = executor
                .execute(payload, H160::zero(), None, U256::zero(), &config)
                .map_err(|e| {
                    DispatchError::Other(match e {
                        atlas_evm_integration::EvmError::OutOfGas => "EVM out of gas",
                        atlas_evm_integration::EvmError::StackOverflow => "EVM stack overflow",
                        atlas_evm_integration::EvmError::StackUnderflow => "EVM stack underflow",
                        atlas_evm_integration::EvmError::InvalidPayload => "Invalid EVM payload",
                        atlas_evm_integration::EvmError::ExecutionReverted => {
                            "EVM execution reverted"
                        }
                        _ => "EVM execution failed",
                    })
                })?;

            // Convert EVM result to pallet ExecutionReceipt
            Ok(ExecutionReceipt {
                success: result.success,
                gas_used: result.gas_used,
                return_data: result.output,
                logs: result
                    .logs
                    .into_iter()
                    .map(|log| ExecutionLog {
                        address: log.address.as_bytes().to_vec(),
                        topics: log.topics,
                        data: log.data,
                    })
                    .collect(),
                state_changes: result
                    .state_changes
                    .into_iter()
                    .map(|change| StateChange {
                        address: change.address.as_bytes().to_vec(),
                        key: H256::from_low_u64_be(change.balance_delta as u64),
                        value: H256::from_low_u64_be(change.nonce_delta as u64),
                    })
                    .collect(),
            })
        }

        fn estimate_gas(payload: &[u8]) -> Result<u64, DispatchError> {
            let executor = atlas_evm_integration::MockEvmExecutor;

            let config = EvmConfig {
                chain_id: 1,
                gas_limit: u64::MAX / 2,
                gas_price: sp_core::U256::from(1_000_000_000u64),
                block_number: 0,
                block_timestamp: 0,
                base_fee: sp_core::U256::from(1_000_000_000u64),
                coinbase: H160::zero(),
            };

            let gas = executor
                .estimate_gas(payload, H160::zero(), None, U256::zero(), &config)
                .map_err(|_| DispatchError::Other("Gas estimation failed"))?;

            Ok(gas)
        }

        fn validate(payload: &[u8]) -> Result<(), DispatchError> {
            let executor = atlas_evm_integration::MockEvmExecutor;
            executor
                .validate_bytecode(payload)
                .map_err(|_| DispatchError::Other("Invalid EVM bytecode"))
        }
    }

    /// Production SVM adapter using solana-rbpf
    pub struct RbpfSvmAdapter;

    impl SvmExecutorAdapter for RbpfSvmAdapter {
        fn execute(payload: &[u8], compute_limit: u64) -> Result<ExecutionReceipt, DispatchError> {
            let executor = RbpfSvmExecutor::new();

            let config = SvmConfig {
                compute_unit_limit: compute_limit,
                compute_unit_price: 1,
                slot: 0,
                block_timestamp: 0,
                recent_blockhash: [0u8; 32],
                enable_cpi: false,
                max_cpi_depth: 0,
            };

            let result = executor.execute_bpf(payload, &[], &config).map_err(|e| {
                DispatchError::Other(match e {
                    atlas_svm_integration::SvmError::OutOfComputeUnits => {
                        "SVM out of compute units"
                    }
                    atlas_svm_integration::SvmError::InvalidPayload => "Invalid SVM payload",
                    atlas_svm_integration::SvmError::InvalidProgramId => "Invalid program ID",
                    atlas_svm_integration::SvmError::InvalidAccount => "Invalid account",
                    _ => "SVM execution failed",
                })
            })?;

            // Convert SVM result to pallet ExecutionReceipt
            Ok(ExecutionReceipt {
                success: result.success,
                gas_used: result.compute_units_used,
                return_data: result.output,
                logs: result
                    .logs
                    .into_iter()
                    .map(|log| ExecutionLog {
                        address: vec![0u8; 32], // SVM doesn't have per-log addresses
                        topics: Vec::new(),
                        data: log,
                    })
                    .collect(),
                state_changes: result
                    .account_updates
                    .into_iter()
                    .map(|update| StateChange {
                        address: update.pubkey.to_vec(),
                        key: H256::from_low_u64_be(update.lamports),
                        value: H256::from_slice(&update.data.get(..32).unwrap_or(&[0u8; 32])),
                    })
                    .collect(),
            })
        }

        fn validate(payload: &[u8]) -> Result<(), DispatchError> {
            let executor = RbpfSvmExecutor::new();
            executor
                .validate_program(payload)
                .map_err(|_| DispatchError::Other("Invalid BPF program"))
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_mock_evm_adapter_execute() {
        let payload = b"test payload";
        let result = MockEvmAdapter::execute(payload, 100_000).unwrap();
        assert!(result.success);
        assert!(result.gas_used > 21000);
    }

    #[test]
    fn test_mock_svm_adapter_execute() {
        let payload = b"test payload";
        let result = MockSvmAdapter::execute(payload, 100_000).unwrap();
        assert!(result.success);
        assert!(result.gas_used > 5000);
    }

    #[test]
    fn test_unit_adapter_backwards_compat() {
        let result = <() as EvmExecutorAdapter>::execute(b"test", 100_000).unwrap();
        assert!(result.success);
        assert_eq!(result.gas_used, 21000);

        let result = <() as SvmExecutorAdapter>::execute(b"test", 100_000).unwrap();
        assert!(result.success);
        assert_eq!(result.gas_used, 5000);
    }
}
