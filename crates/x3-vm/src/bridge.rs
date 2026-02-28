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

// Re-export x3-backend types for bytecode helpers
pub use x3_backend::bc_format_helpers;

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
        "bridge hostcall '{}' disabled (enable real backend or build with --features bridge-mocks for dev/testing)",
        name
    )))
}

/// X3VM Bridge for cross-VM execution
pub struct X3VMBridge {
    config: BridgeConfig,
    gpu: Option<GpuHostcalls>,
}

impl X3VMBridge {
    /// Create a new X3VM bridge with default configuration
    pub fn new() -> Self {
        Self::with_config(BridgeConfig::default())
    }

    /// Create a new X3VM bridge with custom configuration
    pub fn with_config(config: BridgeConfig) -> Self {
        let gpu = if config.enable_gpu {
            Some(GpuHostcalls::new())
        } else {
            None
        };
        Self { config, gpu }
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

    /// Register cross-VM hostcalls
    fn register_hostcalls(&self, vm: &mut VM) {
        // GPU compute hostcalls (0xD0 - 0xDF)
        if let Some(ref gpu) = self.gpu {
            gpu.register_on_vm(vm);
        }

        // SVM hostcalls
        if self.config.enable_svm {
            vm.register_hostcall(0x10, "svm_transfer", 3, |args| {
                #[cfg(feature = "bridge-mocks")]
                {
                    // Mock SVM transfer: from, to, lamports
                    log::debug!("SVM Transfer (mock): {:?}", args);
                    return Ok(Some(Value::Bool(true)));
                }

                #[cfg(not(feature = "bridge-mocks"))]
                {
                    let _ = args;
                    return Err(bridge_disabled_error("svm_transfer"));
                }
            });

            vm.register_hostcall(0x11, "svm_invoke", 3, |args| {
                #[cfg(feature = "bridge-mocks")]
                {
                    // Mock SVM CPI
                    log::debug!("SVM Invoke (mock): {:?}", args);
                    return Ok(Some(Value::I64(0)));
                }

                #[cfg(not(feature = "bridge-mocks"))]
                {
                    let _ = args;
                    return Err(bridge_disabled_error("svm_invoke"));
                }
            });

            vm.register_hostcall(0x12, "svm_get_balance", 1, |args| {
                #[cfg(feature = "bridge-mocks")]
                {
                    // Mock get balance
                    log::debug!("SVM Get Balance (mock): {:?}", args);
                    return Ok(Some(Value::I64(1_000_000_000))); // 1 SOL in lamports
                }

                #[cfg(not(feature = "bridge-mocks"))]
                {
                    let _ = args;
                    return Err(bridge_disabled_error("svm_get_balance"));
                }
            });
        }

        // EVM hostcalls
        if self.config.enable_evm {
            vm.register_hostcall(0x20, "evm_call", 4, |args| {
                #[cfg(feature = "bridge-mocks")]
                {
                    // Mock EVM call: gas, address, value, data
                    log::debug!("EVM Call (mock): {:?}", args);
                    return Ok(Some(Value::Bool(true)));
                }

                #[cfg(not(feature = "bridge-mocks"))]
                {
                    let _ = args;
                    return Err(bridge_disabled_error("evm_call"));
                }
            });

            vm.register_hostcall(0x21, "evm_staticcall", 3, |args| {
                #[cfg(feature = "bridge-mocks")]
                {
                    // Mock EVM staticcall
                    log::debug!("EVM StaticCall (mock): {:?}", args);
                    return Ok(Some(Value::Bool(true)));
                }

                #[cfg(not(feature = "bridge-mocks"))]
                {
                    let _ = args;
                    return Err(bridge_disabled_error("evm_staticcall"));
                }
            });

            vm.register_hostcall(0x22, "evm_balance", 1, |args| {
                #[cfg(feature = "bridge-mocks")]
                {
                    // Mock EVM balance
                    log::debug!("EVM Balance (mock): {:?}", args);
                    return Ok(Some(Value::I64(1_000_000_000_000_000_000))); // 1 ETH in wei
                }

                #[cfg(not(feature = "bridge-mocks"))]
                {
                    let _ = args;
                    return Err(bridge_disabled_error("evm_balance"));
                }
            });
        }

        // Cross-VM bridge hostcalls
        vm.register_hostcall(0x30, "bridge_svm_to_evm", 2, |args| {
            #[cfg(feature = "bridge-mocks")]
            {
                // Bridge tokens from SVM to EVM
                log::debug!("Bridge SVM->EVM (mock): {:?}", args);
                return Ok(Some(Value::Bool(true)));
            }

            #[cfg(not(feature = "bridge-mocks"))]
            {
                let _ = args;
                return Err(bridge_disabled_error("bridge_svm_to_evm"));
            }
        });

        vm.register_hostcall(0x31, "bridge_evm_to_svm", 2, |args| {
            #[cfg(feature = "bridge-mocks")]
            {
                // Bridge tokens from EVM to SVM
                log::debug!("Bridge EVM->SVM (mock): {:?}", args);
                return Ok(Some(Value::Bool(true)));
            }

            #[cfg(not(feature = "bridge-mocks"))]
            {
                let _ = args;
                return Err(bridge_disabled_error("bridge_evm_to_svm"));
            }
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
