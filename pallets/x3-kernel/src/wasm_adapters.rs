//! WASM/no-std VM adapters backed by inline interpreters.
//!
//! `WasmEvmAdapter`  — uses `x3_evm_integration::mini_evm`
//! `WasmSvmAdapter`  — uses `x3_svm_integration::interp_execute_bpf`
//! `WasmX3Adapter`   — uses `x3_x3_integration::X3Executor` (mini_x3 in no-std)
//!
//! These are available in both std and no-std builds; the underlying
//! integration crates choose their fast (native) or mini (WASM) path
//! based on their own feature flags.

use crate::ExecutionReceipt;
use crate::adapters::{EvmExecutorAdapter, SvmExecutorAdapter, X3ExecutorAdapter};
use frame_support::pallet_prelude::DispatchError;
use sp_std::vec::Vec;

// ---------------------------------------------------------------------------
// WasmEvmAdapter
// ---------------------------------------------------------------------------

/// EVM adapter powered by `mini_evm` — runs the SputnikVM interpreter.
pub struct WasmEvmAdapter;

impl EvmExecutorAdapter for WasmEvmAdapter {
    fn execute(payload: &[u8], gas_limit: u64) -> Result<ExecutionReceipt, DispatchError> {
        if payload.is_empty() {
            return Err(DispatchError::Other("Empty EVM payload"));
        }
        x3_evm_integration::mini_evm::execute_evm(payload, gas_limit)
            .map(|res| ExecutionReceipt {
                success: res.success,
                gas_used: res.gas_used,
                return_data: res.output,
                logs: Vec::new(),
                state_changes: Vec::new(),
            })
            .map_err(|_| DispatchError::Other("EVM execution failed"))
    }

    fn estimate_gas(payload: &[u8]) -> Result<u64, DispatchError> {
        if payload.is_empty() {
            return Err(DispatchError::Other("Empty EVM payload"));
        }
        x3_evm_integration::mini_evm::estimate_gas_evm(payload)
            .map_err(|_| DispatchError::Other("EVM gas estimation failed"))
    }

    fn validate(payload: &[u8]) -> Result<(), DispatchError> {
        if payload.is_empty() {
            return Err(DispatchError::Other("Empty EVM payload"));
        }
        x3_evm_integration::mini_evm::validate_evm(payload)
            .map_err(|_| DispatchError::Other("EVM validation failed"))
    }
}

// ---------------------------------------------------------------------------
// WasmSvmAdapter
// ---------------------------------------------------------------------------

/// SVM adapter powered by the inline eBPF interpreter (`interp.rs`).
pub struct WasmSvmAdapter;

impl SvmExecutorAdapter for WasmSvmAdapter {
    fn execute(payload: &[u8], compute_limit: u64) -> Result<ExecutionReceipt, DispatchError> {
        if payload.is_empty() {
            return Err(DispatchError::Other("Empty SVM payload"));
        }
        let config = x3_svm_integration::SvmConfig {
            compute_unit_limit: compute_limit,
            compute_unit_price: 1,
            slot: 0,
            block_timestamp: 0,
            recent_blockhash: [0u8; 32],
            enable_cpi: false,
            max_cpi_depth: 0,
        };
        x3_svm_integration::interp_execute_bpf(payload, &[], &config)
            .map(|res| ExecutionReceipt {
                success: res.success,
                gas_used: res.compute_units_used,
                return_data: res.output,
                logs: Vec::new(),
                state_changes: Vec::new(),
            })
            .map_err(|_| DispatchError::Other("SVM execution failed"))
    }

    fn validate(payload: &[u8]) -> Result<(), DispatchError> {
        if payload.is_empty() {
            return Err(DispatchError::Other("Empty SVM payload"));
        }
        x3_svm_integration::interp_validate_program(payload)
            .map_err(|_| DispatchError::Other("SVM validation failed"))
    }
}

// ---------------------------------------------------------------------------
// WasmX3Adapter
// ---------------------------------------------------------------------------

/// X3 adapter backed by `mini_x3` in no-std and `x3-vm` in std.
pub struct WasmX3Adapter;

impl X3ExecutorAdapter for WasmX3Adapter {
    fn execute(payload: &[u8], gas_limit: u64) -> Result<ExecutionReceipt, DispatchError> {
        if payload.is_empty() {
            return Err(DispatchError::Other("Empty X3 payload"));
        }
        let config = x3_x3_integration::X3ExecutorConfig { gas_limit, ..Default::default() };
        x3_x3_integration::X3Executor::execute(payload, &[], config)
            .map(|rec| ExecutionReceipt {
                success: rec.success,
                gas_used: rec.gas_used,
                return_data: rec.return_data,
                logs: Vec::new(),
                state_changes: Vec::new(),
            })
            .map_err(|_| DispatchError::Other("X3 execution failed"))
    }

    fn validate(payload: &[u8]) -> Result<(), DispatchError> {
        if payload.is_empty() {
            return Err(DispatchError::Other("Empty X3 payload"));
        }
        x3_x3_integration::X3Executor::verify(payload, false)
            .map_err(|_| DispatchError::Other("X3 validation failed"))
    }

    fn estimate_gas(payload: &[u8]) -> Result<u64, DispatchError> {
        if payload.is_empty() {
            return Err(DispatchError::Other("Empty X3 payload"));
        }
        x3_x3_integration::X3Executor::estimate_gas(payload)
            .map_err(|_| DispatchError::Other("X3 gas estimation failed"))
    }
}
