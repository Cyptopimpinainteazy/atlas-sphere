//! X3VM Bridge for X3 Chain Integration
//!
//! This module provides the integration layer between the X3VM bytecode executor
//! and the X3 Chain dual-VM runtime. It enables X3 programs to:
//!
//! 1. Execute on Solana via the x3vm-executor Anchor program
//! 2. Run off-chain in the native X3VM for simulation/testing
//! 3. Bridge to EVM contracts via cross-VM hostcalls
//!
//! # Architecture
//!
//! ```text
//! ┌─────────────────────────────────────────────────────────────────────┐
//! │                        X3 Chain Runtime                          │
//! │  ┌──────────────┐  ┌──────────────┐  ┌──────────────────────────┐  │
//! │  │ X3VM Native  │  │ SVM Executor │  │ EVM Executor              │  │
//! │  │ (off-chain)  │  │ (Solana)     │  │ (Frontier)               │  │
//! │  └──────┬───────┘  └──────┬───────┘  └──────────┬───────────────┘  │
//! │         │                 │                     │                   │
//! │         └─────────────────┼─────────────────────┘                   │
//! │                           │                                         │
//! │                    ┌──────▼──────┐                                  │
//! │                    │ X3VM Bridge │                                  │
//! │                    │ (hostcalls) │                                  │
//! │                    └─────────────┘                                  │
//! └─────────────────────────────────────────────────────────────────────┘
//! ```

use crate::gpu_hostcalls::GpuHostcalls;
use crate::{ExecutionResult, VMConfig, VMError, VMErrorKind, Value, VM};

// Re-export x3-backend types for bytecode helpers (used by tests and callers)
pub use x3_backend::bc_format_helpers;

#[cfg(feature = "x3-evm-integration")]
use x3_evm_integration::{EvmConfig, EvmExecutor};
#[cfg(feature = "x3-svm-integration")]
use x3_svm_integration::{SvmConfig, SvmExecutor};

#[cfg(any(feature = "x3-evm-integration", feature = "x3-svm-integration"))]
use std::sync::Arc;

/// Configuration for the X3VM bridge
#[derive(Clone, Debug)]
pub struct BridgeConfig {
    /// Enable SVM (Solana) hostcalls
    pub enable_svm: bool,
    /// Enable EVM hostcalls
    pub enable_evm: bool,
    /// Enable GPU compute hostcalls (CUDA dispatch)
    pub enable_gpu: bool,
    /// Gas limit for bridge operations
    pub gas_limit: u64,
    /// Maximum CPI depth for Solana calls
    pub max_cpi_depth: u8,
}

impl Default for BridgeConfig {
    fn default() -> Self {
        Self {
            // Safe-by-default: bridge hostcalls are disabled unless explicitly enabled
            // by the caller. Even when enabled, mocked behavior is only available
            // behind the `bridge-mocks` feature.
            enable_svm: false,
            enable_evm: false,
            enable_gpu: true, // GPU hostcalls are safe (read-only compute, no state mutation)
            gas_limit: 1_000_000,
            max_cpi_depth: 4,
        }
    }
}

fn bridge_disabled_error(name: &str) -> VMError {
    VMError::without_ip(VMErrorKind::HostcallError(format!(
        "bridge hostcall '{}': no executor configured (call X3VMBridge::with_executors())",
        name
    )))
}

/// X3VM Bridge for cross-VM execution
pub struct X3VMBridge {
    config: BridgeConfig,
    gpu: Option<GpuHostcalls>,
    #[cfg(feature = "x3-evm-integration")]
    evm: Option<Arc<dyn EvmExecutor + Send + Sync>>,
    #[cfg(feature = "x3-svm-integration")]
    svm: Option<Arc<dyn SvmExecutor + Send + Sync>>,
}

impl X3VMBridge {
    /// Create a new X3VM bridge with default configuration (no EVM/SVM executors).
    pub fn new() -> Self {
        Self::with_config(BridgeConfig::default())
    }

    /// Create a new X3VM bridge with custom configuration.
    pub fn with_config(config: BridgeConfig) -> Self {
        let gpu = if config.enable_gpu {
            Some(GpuHostcalls::new())
        } else {
            None
        };
        Self {
            config,
            gpu,
            #[cfg(feature = "x3-evm-integration")]
            evm: None,
            #[cfg(feature = "x3-svm-integration")]
            svm: None,
        }
    }

    /// Attach real EVM and SVM executors to the bridge.
    ///
    /// When executors are provided the bridge hostcalls (0x10-0x22) route to
    /// them instead of returning an error. The bridge ops (0x30-0x31) that
    /// require canonical ledger context remain fail-closed until the canonical
    /// ledger is wired at the runtime level.
    #[cfg(all(feature = "x3-evm-integration", feature = "x3-svm-integration"))]
    pub fn with_executors(
        mut self,
        evm: Arc<dyn EvmExecutor + Send + Sync>,
        svm: Arc<dyn SvmExecutor + Send + Sync>,
    ) -> Self {
        self.evm = Some(evm);
        self.svm = Some(svm);
        self
    }

    /// Execute X3 bytecode with bridge hostcalls enabled
    pub fn execute(
        &self,
        bytecode: &[u8],
        function_index: usize,
        args: &[Value],
    ) -> Result<ExecutionResult, BridgeError> {
        let mut vm =
            VM::from_bytes(bytecode).map_err(|e| BridgeError::VMError(format!("{:?}", e)))?;

        // Configure VM
        vm.config.gas_limit = self.config.gas_limit;

        // Register bridge hostcalls
        self.register_hostcalls(&mut vm);

        // Execute
        vm.call_function(function_index, args)
            .map_err(|e| BridgeError::ExecutionError(format!("{:?}", e)))
    }

    /// Register cross-VM hostcalls on a VM instance.
    ///
    /// This is exposed publicly so callers (e.g. `AtomicSwapOrchestrator`) can
    /// wire bridge hostcalls onto an externally-created VM without going through
    /// `execute()`.
    pub fn register_bridge_hostcalls(&self, vm: &mut VM) {
        self.register_hostcalls(vm);
    }

    /// Register cross-VM hostcalls
    fn register_hostcalls(&self, vm: &mut VM) {
        // GPU compute hostcalls (0xD0 - 0xDF)
        if let Some(ref gpu) = self.gpu {
            gpu.register_on_vm(vm);
        }

        // ── SVM hostcalls ────────────────────────────────────────────────
        if self.config.enable_svm {
            #[cfg(feature = "x3-svm-integration")]
            {
                let svm_exec = self.svm.clone();

                vm.register_hostcall(0x10, "svm_transfer", 3, {
                    let svm = svm_exec.clone();
                    move |args| {
                        // SVM balance transfers require canonical ledger context
                        // (pallet storage).  Without it we fail-closed so callers
                        // know they must route through the Substrate runtime.
                        let _ = (args, &svm);
                        Err(VMError::without_ip(VMErrorKind::HostcallError(
                            "svm_transfer requires canonical ledger (wire via Substrate runtime)"
                                .into(),
                        )))
                    }
                });

                vm.register_hostcall(0x11, "svm_invoke", 3, {
                    let svm = svm_exec.clone();
                    move |args| {
                        let executor = svm.as_ref().ok_or_else(|| {
                            VMError::without_ip(VMErrorKind::HostcallError(
                                "svm_invoke: no SVM executor configured".into(),
                            ))
                        })?;
                        let program = match args.first() {
                            Some(Value::Bytes(b)) => b.clone(),
                            _ => {
                                return Err(VMError::without_ip(VMErrorKind::HostcallError(
                                    "svm_invoke: arg[0] (program) must be Bytes".into(),
                                )))
                            }
                        };
                        let input = match args.get(1) {
                            Some(Value::Bytes(b)) => b.clone(),
                            _ => vec![],
                        };
                        let compute_units = match args.get(2) {
                            Some(Value::I64(v)) => (*v).max(0) as u64,
                            _ => 200_000,
                        };
                        let cfg = SvmConfig {
                            compute_unit_limit: compute_units,
                            ..SvmConfig::default()
                        };
                        let result = executor
                            .execute_bpf(&program, &input, &cfg)
                            .map_err(|e| {
                                VMError::without_ip(VMErrorKind::HostcallError(format!(
                                    "svm_invoke failed: {:?}",
                                    e
                                )))
                            })?;
                        Ok(Some(Value::Bytes(result.output)))
                    }
                });

                vm.register_hostcall(0x12, "svm_get_balance", 1, {
                    let svm = svm_exec;
                    move |args| {
                        // Balance lookup requires Substrate storage access; fail-closed.
                        let _ = (args, &svm);
                        Err(VMError::without_ip(VMErrorKind::HostcallError(
                            "svm_get_balance requires canonical ledger (wire via Substrate runtime)"
                                .into(),
                        )))
                    }
                });
            }

            #[cfg(not(feature = "x3-svm-integration"))]
            {
                vm.register_hostcall(0x10, "svm_transfer", 3, |_args| {
                    Err(bridge_disabled_error("svm_transfer"))
                });
                vm.register_hostcall(0x11, "svm_invoke", 3, |_args| {
                    Err(bridge_disabled_error("svm_invoke"))
                });
                vm.register_hostcall(0x12, "svm_get_balance", 1, |_args| {
                    Err(bridge_disabled_error("svm_get_balance"))
                });
            }
        }

        // ── EVM hostcalls ────────────────────────────────────────────────
        if self.config.enable_evm {
            #[cfg(feature = "x3-evm-integration")]
            {
                let evm_exec = self.evm.clone();

                vm.register_hostcall(0x20, "evm_call", 4, {
                    let evm = evm_exec.clone();
                    move |args| {
                        let executor = evm.as_ref().ok_or_else(|| {
                            VMError::without_ip(VMErrorKind::HostcallError(
                                "evm_call: no EVM executor configured".into(),
                            ))
                        })?;
                        let gas = match args.first() {
                            Some(Value::I64(v)) => (*v).max(0) as u64,
                            _ => 21_000,
                        };
                        let addr_bytes = match args.get(1) {
                            Some(Value::Bytes(b)) if b.len() == 20 => {
                                sp_core::H160::from_slice(b)
                            }
                            _ => sp_core::H160::zero(),
                        };
                        let value_u256 = match args.get(2) {
                            Some(Value::I64(v)) => sp_core::U256::from((*v).max(0) as u64),
                            _ => sp_core::U256::zero(),
                        };
                        let data = match args.get(3) {
                            Some(Value::Bytes(b)) => b.clone(),
                            _ => vec![],
                        };
                        let cfg = EvmConfig {
                            gas_limit: gas,
                            ..EvmConfig::default()
                        };
                        let result = executor
                            .call(
                                &data,
                                sp_core::H160::zero(),
                                addr_bytes,
                                value_u256,
                                &cfg,
                            )
                            .map_err(|e| {
                                VMError::without_ip(VMErrorKind::HostcallError(format!(
                                    "evm_call failed: {:?}",
                                    e
                                )))
                            })?;
                        Ok(Some(Value::Bytes(result.output)))
                    }
                });

                vm.register_hostcall(0x21, "evm_staticcall", 3, {
                    let evm = evm_exec.clone();
                    move |args| {
                        let executor = evm.as_ref().ok_or_else(|| {
                            VMError::without_ip(VMErrorKind::HostcallError(
                                "evm_staticcall: no EVM executor configured".into(),
                            ))
                        })?;
                        let addr_bytes = match args.first() {
                            Some(Value::Bytes(b)) if b.len() == 20 => {
                                sp_core::H160::from_slice(b)
                            }
                            _ => sp_core::H160::zero(),
                        };
                        let gas = match args.get(1) {
                            Some(Value::I64(v)) => (*v).max(0) as u64,
                            _ => 21_000,
                        };
                        let data = match args.get(2) {
                            Some(Value::Bytes(b)) => b.clone(),
                            _ => vec![],
                        };
                        let cfg = EvmConfig {
                            gas_limit: gas,
                            ..EvmConfig::default()
                        };
                        let result = executor
                            .call(
                                &data,
                                sp_core::H160::zero(),
                                addr_bytes,
                                sp_core::U256::zero(),
                                &cfg,
                            )
                            .map_err(|e| {
                                VMError::without_ip(VMErrorKind::HostcallError(format!(
                                    "evm_staticcall failed: {:?}",
                                    e
                                )))
                            })?;
                        Ok(Some(Value::Bytes(result.output)))
                    }
                });

                vm.register_hostcall(0x22, "evm_balance", 1, {
                    let evm = evm_exec;
                    move |args| {
                        // Balance lookup requires pallet-evm storage; fail-closed.
                        let _ = (args, &evm);
                        Err(VMError::without_ip(VMErrorKind::HostcallError(
                            "evm_balance requires canonical ledger (wire via Substrate runtime)"
                                .into(),
                        )))
                    }
                });
            }

            #[cfg(not(feature = "x3-evm-integration"))]
            {
                vm.register_hostcall(0x20, "evm_call", 4, |_args| {
                    Err(bridge_disabled_error("evm_call"))
                });
                vm.register_hostcall(0x21, "evm_staticcall", 3, |_args| {
                    Err(bridge_disabled_error("evm_staticcall"))
                });
                vm.register_hostcall(0x22, "evm_balance", 1, |_args| {
                    Err(bridge_disabled_error("evm_balance"))
                });
            }
        }

        // ── Cross-VM bridge ops (require canonical ledger — fail-closed) ──
        vm.register_hostcall(0x30, "bridge_svm_to_evm", 2, |_args| {
            Err(VMError::without_ip(VMErrorKind::HostcallError(
                "bridge_svm_to_evm: wire canonical bridge + ledger (not yet implemented)".into(),
            )))
        });
        vm.register_hostcall(0x31, "bridge_evm_to_svm", 2, |_args| {
            Err(VMError::without_ip(VMErrorKind::HostcallError(
                "bridge_evm_to_svm: wire canonical bridge + ledger (not yet implemented)".into(),
            )))
        });
    }
}

impl Default for X3VMBridge {
    fn default() -> Self {
        Self::new()
    }
}

/// Errors that can occur during bridge operations
#[derive(Debug, Clone)]
pub enum BridgeError {
    /// Error loading or validating bytecode
    VMError(String),
    /// Error during execution
    ExecutionError(String),
    /// SVM operation failed
    SVMError(String),
    /// EVM operation failed
    EVMError(String),
    /// Bridge operation failed
    BridgeOperationError(String),
}

impl std::fmt::Display for BridgeError {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        match self {
            BridgeError::VMError(msg) => write!(f, "VM Error: {}", msg),
            BridgeError::ExecutionError(msg) => write!(f, "Execution Error: {}", msg),
            BridgeError::SVMError(msg) => write!(f, "SVM Error: {}", msg),
            BridgeError::EVMError(msg) => write!(f, "EVM Error: {}", msg),
            BridgeError::BridgeOperationError(msg) => write!(f, "Bridge Error: {}", msg),
        }
    }
}

impl std::error::Error for BridgeError {}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_bridge_execute_simple() {
        let bridge = X3VMBridge::new();
        let bytecode = bc_format_helpers::assemble_simple_module();

        let result = bridge.execute(&bytecode, 0, &[]);
        assert!(result.is_ok());

        let exec_result = result.unwrap();
        assert_eq!(exec_result.value, Some(Value::I64(49)));
    }

    #[test]
    fn test_bridge_with_args() {
        let bridge = X3VMBridge::new();
        let bytecode = bc_format_helpers::assemble_param_module();

        let result = bridge.execute(&bytecode, 0, &[Value::I64(100), Value::I64(200)]);
        assert!(result.is_ok());

        let exec_result = result.unwrap();
        assert_eq!(exec_result.value, Some(Value::I64(300)));
    }

    #[test]
    fn test_bridge_config() {
        let config = BridgeConfig {
            enable_svm: true,
            enable_evm: false,
            enable_gpu: true,
            gas_limit: 500_000,
            max_cpi_depth: 2,
        };

        let bridge = X3VMBridge::with_config(config);
        assert!(!bridge.config.enable_evm);
        assert_eq!(bridge.config.gas_limit, 500_000);
    }
}
