//! Real BPF Executor using solana-rbpf
//!
//! This module provides actual Solana BPF program execution using
//! the solana-rbpf virtual machine.

use crate::{
    AccountUpdate, SvmAccountMeta, SvmConfig, SvmError, SvmExecutionResult, SvmExecutor,
    SvmInstruction, SvmResult,
};
use solana_rbpf::{
    ebpf,
    elf::Executable,
    error::ProgramResult,
    memory_region::{MemoryMapping, MemoryRegion},
    program::{BuiltinProgram, FunctionRegistry, SBPFVersion},
    verifier::RequisiteVerifier,
    vm::{Config, ContextObject, EbpfVm},
};
use std::sync::Arc;

/// Real SVM executor using solana-rbpf
pub struct RbpfSvmExecutor {
    /// VM configuration
    config: Config,
}

impl RbpfSvmExecutor {
    /// Create a new RBPF executor
    pub fn new() -> Self {
        Self {
            config: Config {
                max_call_depth: 64,
                stack_frame_size: 4096,
                enable_stack_frame_gaps: true,
                instruction_meter_checkpoint_distance: 10000,
                enable_instruction_meter: true,
                enable_instruction_tracing: false,
                enable_symbol_and_section_labels: false,
                reject_broken_elfs: true,
                noop_instruction_rate: 256,
                sanitize_user_provided_values: true,
                external_internal_function_hash_collision: false,
                reject_callx_r10: true,
                optimize_rodata: true,
                aligned_memory_mapping: true,
                ..Config::default()
            },
        }
    }

    /// Create executor with custom config
    pub fn with_config(config: Config) -> Self {
        Self { config }
    }

    /// Serialize accounts into a buffer for BPF program access (M-7 fix).
    ///
    /// Format per account:
    /// - 32 bytes: pubkey
    /// - 8 bytes: lamports (little-endian u64)
    /// - 1 byte: is_signer flag
    /// - 1 byte: is_writable flag
    /// - Variable: data from AccountUpdate
    fn serialize_accounts(accounts: &[(SvmAccountMeta, AccountUpdate)]) -> Vec<u8> {
        let mut buffer = Vec::new();

        // Write account count as u32 LE
        buffer.extend_from_slice(&(accounts.len() as u32).to_le_bytes());

        for (meta, update) in accounts {
            // Pubkey (32 bytes)
            buffer.extend_from_slice(&meta.pubkey);

            // Lamports from update (8 bytes)
            buffer.extend_from_slice(&update.lamports.to_le_bytes());

            // Flags (2 bytes)
            buffer.push(if meta.is_signer { 1 } else { 0 });
            buffer.push(if meta.is_writable { 1 } else { 0 });

            // Data length and data
            buffer.extend_from_slice(&(update.data.len() as u32).to_le_bytes());
            buffer.extend_from_slice(&update.data);
        }

        buffer
    }
}

impl AtlasSyscallContext {
    fn new(compute_limit: u64) -> Self {
        Self {
            compute_units_remaining: compute_limit,
            compute_units_used: 0,
            logs: Vec::new(),
            return_data: Vec::new(),
        }
    }
}

impl ContextObject for AtlasSyscallContext {
    fn trace(&mut self, _state: [u64; 12]) {}

    fn consume(&mut self, amount: u64) {
        self.compute_units_used = self.compute_units_used.saturating_add(amount);
        self.compute_units_remaining = self.compute_units_remaining.saturating_sub(amount);
    }

    fn get_remaining(&self) -> u64 {
        self.compute_units_remaining
    }
}

/// Create the built-in program (no syscalls for minimal version)
fn create_loader() -> Arc<BuiltinProgram<AtlasSyscallContext>> {
    Arc::new(BuiltinProgram::new_loader(
        Config::default(),
        FunctionRegistry::default(),
    ))
}

impl SvmExecutor for RbpfSvmExecutor {
    fn execute(
        &self,
        instruction: &SvmInstruction,
        _payer: [u8; 32],
        accounts: &[(SvmAccountMeta, AccountUpdate)],
        config: &SvmConfig,
    ) -> SvmResult<SvmExecutionResult> {
        // For now, we expect the program data to be in instruction.data
        // In a full implementation, we'd look up the program from storage by program_id
        if instruction.program_id == [0u8; 32] {
            return Err(SvmError::InvalidProgramId);
        }

        // Serialize accounts into input buffer for BPF program access (M-7 fix)
        let account_input = Self::serialize_accounts(accounts);

        // Execute the BPF program with instruction data + serialized accounts as input
        self.execute_bpf(&instruction.data, &account_input, config)
    }

    fn execute_bpf(
        &self,
        program: &[u8],
        input: &[u8],
        config: &SvmConfig,
    ) -> SvmResult<SvmExecutionResult> {
        if program.is_empty() {
            return Err(SvmError::InvalidPayload);
        }

        // Create the built-in program with syscalls
        let loader = create_loader();
        let sbpf_version = SBPFVersion::V1;

        // Try to parse as ELF, fall back to raw bytecode
        let executable = if program.starts_with(b"\x7fELF") {
            // Parse ELF file
            Executable::from_elf(program, loader.clone()).map_err(|_| SvmError::InvalidPayload)?
        } else {
            // Treat as raw SBPFv1 bytecode
            Executable::from_text_bytes(
                program,
                loader.clone(),
                sbpf_version.clone(),
                FunctionRegistry::default(),
            )
            .map_err(|_| SvmError::InvalidPayload)?
        };

        // Verify the program
        executable
            .verify::<RequisiteVerifier>()
            .map_err(|_| SvmError::InvalidPayload)?;

        // Create memory regions for input data
        let mut input_data = vec![0u8; input.len().max(64)];
        input_data[..input.len()].copy_from_slice(input);

        let regions = vec![MemoryRegion::new_writable(
            input_data.as_mut_slice(),
            ebpf::MM_INPUT_START,
        )];

        let memory_mapping = MemoryMapping::new(regions, &self.config, &sbpf_version)
            .map_err(|_| SvmError::ExecutionFailed)?;

        // Create execution context
        let mut context = AtlasSyscallContext::new(config.compute_unit_limit);

        // Create and run VM
        let mut vm = EbpfVm::new(
            loader,
            &sbpf_version,
            &mut context,
            memory_mapping,
            0, // stack_len
        );

        let (_total_insn, result) = vm.execute_program(&executable, true);

        match result {
            ProgramResult::Ok(_return_value) => {
                // Compute state root from logs
                let state_root = compute_state_root(&context.logs, &context.return_data);

                Ok(SvmExecutionResult {
                    success: true,
                    output: context.return_data,
                    compute_units_used: context.compute_units_used,
                    account_updates: vec![],
                    logs: context.logs,
                    state_root,
                })
            }
            ProgramResult::Err(e) => {
                use solana_rbpf::error::EbpfError;
                match e {
                    EbpfError::ExceededMaxInstructions => Err(SvmError::OutOfComputeUnits),
                    _ => Err(SvmError::ExecutionFailed),
                }
            }
        }
    }

    fn validate_program(&self, program: &[u8]) -> SvmResult<()> {
        if program.is_empty() {
            return Err(SvmError::InvalidPayload);
        }

        let loader = create_loader();
        let sbpf_version = SBPFVersion::V1;

        // Try to parse and verify
        let executable = if program.starts_with(b"\x7fELF") {
            Executable::from_elf(program, loader).map_err(|_| SvmError::InvalidPayload)?
        } else {
            Executable::from_text_bytes(program, loader, sbpf_version, FunctionRegistry::default())
                .map_err(|_| SvmError::InvalidPayload)?
        };

        executable
            .verify::<RequisiteVerifier>()
            .map_err(|_| SvmError::InvalidPayload)?;

        Ok(())
    }
}

/// Compute state root from execution results
fn compute_state_root(logs: &[Vec<u8>], return_data: &[u8]) -> [u8; 32] {
    use sp_core::hashing::blake2_256;

    let mut data = Vec::new();
    for log in logs {
        data.extend_from_slice(log);
    }
    data.extend_from_slice(return_data);

    if data.is_empty() {
        return [0u8; 32];
    }

    blake2_256(&data)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_rbpf_executor_creation() {
        let executor = RbpfSvmExecutor::new();
        assert!(executor.config.enable_instruction_meter);
    }

    #[test]
    fn test_rbpf_executor_empty_program() {
        let executor = RbpfSvmExecutor::new();
        let result = executor.execute_bpf(&[], &[], &SvmConfig::default());
        assert_eq!(result, Err(SvmError::InvalidPayload));
    }

    #[test]
    fn test_rbpf_executor_validate_empty() {
        let executor = RbpfSvmExecutor::new();
        let result = executor.validate_program(&[]);
        assert_eq!(result, Err(SvmError::InvalidPayload));
    }
}
