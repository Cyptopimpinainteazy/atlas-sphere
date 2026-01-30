//! X3VM Executor for Solana
//!
//! This Anchor program provides a deterministic bytecode execution environment
//! for X3 programs on Solana. It implements a subset of the X3VM opcode set
//! optimized for on-chain execution.
//!
//! # Architecture
//!
//! ```text
//! ┌─────────────────────────────────────────────────────────────────┐
//! │                    X3VM Solana Executor                          │
//! │  ┌──────────────┐  ┌──────────────┐  ┌──────────────────────┐  │
//! │  │ X3 Bytecode  │──│ Interpreter  │──│ State Storage (PDA)  │  │
//! │  │ Module       │  │ (on-chain)   │  │ Execution Results    │  │
//! │  └──────────────┘  └──────────────┘  └──────────────────────┘  │
//! └─────────────────────────────────────────────────────────────────┘
//! ```

use anchor_lang::prelude::*;

// Program ID - will be replaced by `anchor keys sync` after first build
declare_id!("X3vmExec11111111111111111111111111111111111");

/// X3BC Magic bytes
pub const X3BC_MAGIC: &[u8; 4] = b"X3BC";

/// Maximum bytecode size (16KB for on-chain)
pub const MAX_BYTECODE_SIZE: usize = 16 * 1024;

/// Maximum execution steps (compute budget)
pub const MAX_EXECUTION_STEPS: u64 = 100_000;

/// Maximum stack depth
pub const MAX_STACK_DEPTH: usize = 64;

/// Maximum registers
pub const MAX_REGISTERS: usize = 256;

#[program]
pub mod x3vm_executor {
    use super::*;

    /// Initialize a new X3VM program instance
    pub fn initialize_program(
        ctx: Context<InitializeProgram>,
        bytecode: Vec<u8>,
        name: String,
    ) -> Result<()> {
        require!(
            bytecode.len() <= MAX_BYTECODE_SIZE,
            X3VMError::BytecodeTooLarge
        );
        require!(bytecode.len() >= 12, X3VMError::InvalidBytecode);
        require!(&bytecode[0..4] == X3BC_MAGIC, X3VMError::InvalidMagic);

        let program_state = &mut ctx.accounts.program_state;
        program_state.authority = ctx.accounts.authority.key();
        program_state.name = name;
        program_state.bytecode = bytecode;
        program_state.execution_count = 0;
        program_state.total_gas_used = 0;
        program_state.created_at = Clock::get()?.unix_timestamp;
        program_state.bump = ctx.bumps.program_state;

        msg!("X3VM Program initialized: {}", program_state.name);
        Ok(())
    }

    /// Execute an X3VM program function
    pub fn execute(
        ctx: Context<Execute>,
        function_index: u32,
        args: Vec<i64>,
        gas_limit: u64,
    ) -> Result<()> {
        let program_state = &ctx.accounts.program_state;
        let execution_result = &mut ctx.accounts.execution_result;

        // Parse and execute bytecode
        let result = execute_bytecode(
            &program_state.bytecode,
            function_index,
            &args,
            gas_limit.min(MAX_EXECUTION_STEPS),
        )?;

        // Store execution result
        execution_result.program = program_state.key();
        execution_result.executor = ctx.accounts.executor.key();
        execution_result.function_index = function_index;
        execution_result.return_value = result.return_value;
        execution_result.gas_used = result.gas_used;
        execution_result.success = true;
        execution_result.executed_at = Clock::get()?.unix_timestamp;
        execution_result.bump = ctx.bumps.execution_result;

        // Update program stats
        let program_state = &mut ctx.accounts.program_state;
        program_state.execution_count += 1;
        program_state.total_gas_used += result.gas_used;

        msg!(
            "X3VM Execution complete: function={}, gas={}, result={:?}",
            function_index,
            result.gas_used,
            result.return_value
        );

        emit!(ExecutionCompleted {
            program: program_state.key(),
            function_index,
            return_value: result.return_value,
            gas_used: result.gas_used,
            executor: ctx.accounts.executor.key(),
        });

        Ok(())
    }

    /// Execute X3VM bytecode atomically (with rollback on failure)
    pub fn execute_atomic(
        ctx: Context<ExecuteAtomic>,
        function_index: u32,
        args: Vec<i64>,
        gas_limit: u64,
    ) -> Result<()> {
        let program_state = &ctx.accounts.program_state;

        // Execute with atomic semantics
        let result = execute_bytecode(
            &program_state.bytecode,
            function_index,
            &args,
            gas_limit.min(MAX_EXECUTION_STEPS),
        )?;

        // Atomic execution results
        let execution_result = &mut ctx.accounts.execution_result;
        execution_result.program = program_state.key();
        execution_result.executor = ctx.accounts.executor.key();
        execution_result.function_index = function_index;
        execution_result.return_value = result.return_value;
        execution_result.gas_used = result.gas_used;
        execution_result.success = true;
        execution_result.is_atomic = true;
        execution_result.executed_at = Clock::get()?.unix_timestamp;
        execution_result.bump = ctx.bumps.execution_result;

        emit!(AtomicExecutionCompleted {
            program: program_state.key(),
            function_index,
            return_value: result.return_value,
            gas_used: result.gas_used,
            atomic_id: execution_result.key(),
        });

        Ok(())
    }

    /// Update X3VM program bytecode (authority only)
    pub fn update_program(ctx: Context<UpdateProgram>, new_bytecode: Vec<u8>) -> Result<()> {
        require!(
            new_bytecode.len() <= MAX_BYTECODE_SIZE,
            X3VMError::BytecodeTooLarge
        );
        require!(new_bytecode.len() >= 12, X3VMError::InvalidBytecode);
        require!(&new_bytecode[0..4] == X3BC_MAGIC, X3VMError::InvalidMagic);

        let program_state = &mut ctx.accounts.program_state;
        program_state.bytecode = new_bytecode;

        msg!("X3VM Program updated: {}", program_state.name);
        Ok(())
    }

    /// Close a program and reclaim rent
    pub fn close_program(_ctx: Context<CloseProgram>) -> Result<()> {
        msg!("X3VM Program closed");
        Ok(())
    }
}

// ============================================================================
// X3VM Interpreter (On-chain)
// ============================================================================

/// Execution result from X3VM interpreter
#[derive(Debug, Clone)]
pub struct InterpreterResult {
    pub return_value: Option<i64>,
    pub gas_used: u64,
}

/// X3VM Value types
#[derive(Clone, Copy, Debug, Default)]
pub enum Value {
    #[default]
    Unit,
    I64(i64),
    Bool(bool),
}

impl Value {
    fn as_i64(&self) -> Result<i64> {
        match self {
            Value::I64(v) => Ok(*v),
            Value::Bool(b) => Ok(if *b { 1 } else { 0 }),
            Value::Unit => Ok(0),
        }
    }

    fn as_bool(&self) -> bool {
        match self {
            Value::I64(v) => *v != 0,
            Value::Bool(b) => *b,
            Value::Unit => false,
        }
    }
}

/// Execute X3 bytecode
fn execute_bytecode(
    bytecode: &[u8],
    function_index: u32,
    args: &[i64],
    gas_limit: u64,
) -> Result<InterpreterResult> {
    // Validate magic
    if bytecode.len() < 12 || &bytecode[0..4] != X3BC_MAGIC {
        return Err(X3VMError::InvalidBytecode.into());
    }

    // Parse header
    let _version = u32::from_le_bytes([bytecode[4], bytecode[5], bytecode[6], bytecode[7]]);
    let _flags = u32::from_le_bytes([bytecode[8], bytecode[9], bytecode[10], bytecode[11]]);

    // Simple bytecode execution
    let mut registers: [Value; MAX_REGISTERS] = [Value::Unit; MAX_REGISTERS];
    let mut gas_used: u64 = 0;

    // Load arguments into registers
    for (i, &arg) in args.iter().enumerate() {
        if i < MAX_REGISTERS {
            registers[i] = Value::I64(arg);
        }
    }

    // Simplified execution: find function entry point and execute
    // In production, this would parse the full function table
    let code_start = 12; // After header
    let mut ip = code_start;

    while ip < bytecode.len() && gas_used < gas_limit {
        let opcode = bytecode[ip];
        gas_used += 1;

        match opcode {
            // Nop
            0x00 => {
                ip += 1;
            }

            // Halt
            0x07 => {
                break;
            }

            // LoadConst (simplified - load immediate)
            0x10 => {
                if ip + 5 < bytecode.len() {
                    let dst = bytecode[ip + 1] as usize;
                    let val = i32::from_le_bytes([
                        bytecode[ip + 2],
                        bytecode[ip + 3],
                        bytecode[ip + 4],
                        bytecode[ip + 5],
                    ]) as i64;
                    if dst < MAX_REGISTERS {
                        registers[dst] = Value::I64(val);
                    }
                }
                ip += 6;
            }

            // Mov
            0x11 => {
                if ip + 2 < bytecode.len() {
                    let dst = bytecode[ip + 1] as usize;
                    let src = bytecode[ip + 2] as usize;
                    if dst < MAX_REGISTERS && src < MAX_REGISTERS {
                        registers[dst] = registers[src];
                    }
                }
                ip += 3;
            }

            // LoadImm
            0x18 => {
                if ip + 2 < bytecode.len() {
                    let dst = bytecode[ip + 1] as usize;
                    let val = bytecode[ip + 2] as i8 as i64;
                    if dst < MAX_REGISTERS {
                        registers[dst] = Value::I64(val);
                    }
                }
                ip += 3;
            }

            // LoadZero
            0x19 => {
                if ip + 1 < bytecode.len() {
                    let dst = bytecode[ip + 1] as usize;
                    if dst < MAX_REGISTERS {
                        registers[dst] = Value::I64(0);
                    }
                }
                ip += 2;
            }

            // LoadTrue
            0x1A => {
                if ip + 1 < bytecode.len() {
                    let dst = bytecode[ip + 1] as usize;
                    if dst < MAX_REGISTERS {
                        registers[dst] = Value::Bool(true);
                    }
                }
                ip += 2;
            }

            // LoadFalse
            0x1B => {
                if ip + 1 < bytecode.len() {
                    let dst = bytecode[ip + 1] as usize;
                    if dst < MAX_REGISTERS {
                        registers[dst] = Value::Bool(false);
                    }
                }
                ip += 2;
            }

            // AddI
            0x20 => {
                if ip + 3 < bytecode.len() {
                    let dst = bytecode[ip + 1] as usize;
                    let a = bytecode[ip + 2] as usize;
                    let b = bytecode[ip + 3] as usize;
                    if dst < MAX_REGISTERS && a < MAX_REGISTERS && b < MAX_REGISTERS {
                        let va = registers[a].as_i64()?;
                        let vb = registers[b].as_i64()?;
                        registers[dst] = Value::I64(va.wrapping_add(vb));
                    }
                }
                ip += 4;
                gas_used += 1;
            }

            // SubI
            0x21 => {
                if ip + 3 < bytecode.len() {
                    let dst = bytecode[ip + 1] as usize;
                    let a = bytecode[ip + 2] as usize;
                    let b = bytecode[ip + 3] as usize;
                    if dst < MAX_REGISTERS && a < MAX_REGISTERS && b < MAX_REGISTERS {
                        let va = registers[a].as_i64()?;
                        let vb = registers[b].as_i64()?;
                        registers[dst] = Value::I64(va.wrapping_sub(vb));
                    }
                }
                ip += 4;
                gas_used += 1;
            }

            // MulI
            0x22 => {
                if ip + 3 < bytecode.len() {
                    let dst = bytecode[ip + 1] as usize;
                    let a = bytecode[ip + 2] as usize;
                    let b = bytecode[ip + 3] as usize;
                    if dst < MAX_REGISTERS && a < MAX_REGISTERS && b < MAX_REGISTERS {
                        let va = registers[a].as_i64()?;
                        let vb = registers[b].as_i64()?;
                        registers[dst] = Value::I64(va.wrapping_mul(vb));
                    }
                }
                ip += 4;
                gas_used += 2;
            }

            // DivI
            0x23 => {
                if ip + 3 < bytecode.len() {
                    let dst = bytecode[ip + 1] as usize;
                    let a = bytecode[ip + 2] as usize;
                    let b = bytecode[ip + 3] as usize;
                    if dst < MAX_REGISTERS && a < MAX_REGISTERS && b < MAX_REGISTERS {
                        let va = registers[a].as_i64()?;
                        let vb = registers[b].as_i64()?;
                        if vb == 0 {
                            return Err(X3VMError::DivisionByZero.into());
                        }
                        registers[dst] = Value::I64(va / vb);
                    }
                }
                ip += 4;
                gas_used += 5;
            }

            // ModI
            0x24 => {
                if ip + 3 < bytecode.len() {
                    let dst = bytecode[ip + 1] as usize;
                    let a = bytecode[ip + 2] as usize;
                    let b = bytecode[ip + 3] as usize;
                    if dst < MAX_REGISTERS && a < MAX_REGISTERS && b < MAX_REGISTERS {
                        let va = registers[a].as_i64()?;
                        let vb = registers[b].as_i64()?;
                        if vb == 0 {
                            return Err(X3VMError::DivisionByZero.into());
                        }
                        registers[dst] = Value::I64(va % vb);
                    }
                }
                ip += 4;
                gas_used += 5;
            }

            // NegI
            0x25 => {
                if ip + 2 < bytecode.len() {
                    let dst = bytecode[ip + 1] as usize;
                    let src = bytecode[ip + 2] as usize;
                    if dst < MAX_REGISTERS && src < MAX_REGISTERS {
                        let v = registers[src].as_i64()?;
                        registers[dst] = Value::I64(v.wrapping_neg());
                    }
                }
                ip += 3;
            }

            // EqI
            0x40 => {
                if ip + 3 < bytecode.len() {
                    let dst = bytecode[ip + 1] as usize;
                    let a = bytecode[ip + 2] as usize;
                    let b = bytecode[ip + 3] as usize;
                    if dst < MAX_REGISTERS && a < MAX_REGISTERS && b < MAX_REGISTERS {
                        let va = registers[a].as_i64()?;
                        let vb = registers[b].as_i64()?;
                        registers[dst] = Value::Bool(va == vb);
                    }
                }
                ip += 4;
            }

            // LtI
            0x42 => {
                if ip + 3 < bytecode.len() {
                    let dst = bytecode[ip + 1] as usize;
                    let a = bytecode[ip + 2] as usize;
                    let b = bytecode[ip + 3] as usize;
                    if dst < MAX_REGISTERS && a < MAX_REGISTERS && b < MAX_REGISTERS {
                        let va = registers[a].as_i64()?;
                        let vb = registers[b].as_i64()?;
                        registers[dst] = Value::Bool(va < vb);
                    }
                }
                ip += 4;
            }

            // GtI
            0x44 => {
                if ip + 3 < bytecode.len() {
                    let dst = bytecode[ip + 1] as usize;
                    let a = bytecode[ip + 2] as usize;
                    let b = bytecode[ip + 3] as usize;
                    if dst < MAX_REGISTERS && a < MAX_REGISTERS && b < MAX_REGISTERS {
                        let va = registers[a].as_i64()?;
                        let vb = registers[b].as_i64()?;
                        registers[dst] = Value::Bool(va > vb);
                    }
                }
                ip += 4;
            }

            // And
            0x50 => {
                if ip + 3 < bytecode.len() {
                    let dst = bytecode[ip + 1] as usize;
                    let a = bytecode[ip + 2] as usize;
                    let b = bytecode[ip + 3] as usize;
                    if dst < MAX_REGISTERS && a < MAX_REGISTERS && b < MAX_REGISTERS {
                        let va = registers[a].as_i64()?;
                        let vb = registers[b].as_i64()?;
                        registers[dst] = Value::I64(va & vb);
                    }
                }
                ip += 4;
            }

            // Or
            0x51 => {
                if ip + 3 < bytecode.len() {
                    let dst = bytecode[ip + 1] as usize;
                    let a = bytecode[ip + 2] as usize;
                    let b = bytecode[ip + 3] as usize;
                    if dst < MAX_REGISTERS && a < MAX_REGISTERS && b < MAX_REGISTERS {
                        let va = registers[a].as_i64()?;
                        let vb = registers[b].as_i64()?;
                        registers[dst] = Value::I64(va | vb);
                    }
                }
                ip += 4;
            }

            // Xor
            0x52 => {
                if ip + 3 < bytecode.len() {
                    let dst = bytecode[ip + 1] as usize;
                    let a = bytecode[ip + 2] as usize;
                    let b = bytecode[ip + 3] as usize;
                    if dst < MAX_REGISTERS && a < MAX_REGISTERS && b < MAX_REGISTERS {
                        let va = registers[a].as_i64()?;
                        let vb = registers[b].as_i64()?;
                        registers[dst] = Value::I64(va ^ vb);
                    }
                }
                ip += 4;
            }

            // Shl
            0x54 => {
                if ip + 3 < bytecode.len() {
                    let dst = bytecode[ip + 1] as usize;
                    let a = bytecode[ip + 2] as usize;
                    let b = bytecode[ip + 3] as usize;
                    if dst < MAX_REGISTERS && a < MAX_REGISTERS && b < MAX_REGISTERS {
                        let va = registers[a].as_i64()?;
                        let vb = registers[b].as_i64()? as u32;
                        registers[dst] = Value::I64(va.wrapping_shl(vb));
                    }
                }
                ip += 4;
            }

            // Shr
            0x55 => {
                if ip + 3 < bytecode.len() {
                    let dst = bytecode[ip + 1] as usize;
                    let a = bytecode[ip + 2] as usize;
                    let b = bytecode[ip + 3] as usize;
                    if dst < MAX_REGISTERS && a < MAX_REGISTERS && b < MAX_REGISTERS {
                        let va = registers[a].as_i64()?;
                        let vb = registers[b].as_i64()? as u32;
                        registers[dst] = Value::I64(va.wrapping_shr(vb));
                    }
                }
                ip += 4;
            }

            // Ret (return r0)
            0x05 => {
                if ip + 1 < bytecode.len() {
                    let src = bytecode[ip + 1] as usize;
                    if src < MAX_REGISTERS {
                        let return_value = registers[src].as_i64().ok();
                        return Ok(InterpreterResult {
                            return_value,
                            gas_used,
                        });
                    }
                }
                break;
            }

            // RetVoid
            0x06 => {
                return Ok(InterpreterResult {
                    return_value: None,
                    gas_used,
                });
            }

            // Jump
            0x01 => {
                if ip + 4 < bytecode.len() {
                    let target = u32::from_le_bytes([
                        bytecode[ip + 1],
                        bytecode[ip + 2],
                        bytecode[ip + 3],
                        bytecode[ip + 4],
                    ]) as usize;
                    ip = target;
                    gas_used += 2;
                    continue;
                }
                ip += 5;
            }

            // JumpIf
            0x02 => {
                if ip + 5 < bytecode.len() {
                    let cond = bytecode[ip + 1] as usize;
                    let target = u32::from_le_bytes([
                        bytecode[ip + 2],
                        bytecode[ip + 3],
                        bytecode[ip + 4],
                        bytecode[ip + 5],
                    ]) as usize;
                    if cond < MAX_REGISTERS && registers[cond].as_bool() {
                        ip = target;
                        gas_used += 2;
                        continue;
                    }
                }
                ip += 6;
                gas_used += 2;
            }

            // JumpUnless
            0x03 => {
                if ip + 5 < bytecode.len() {
                    let cond = bytecode[ip + 1] as usize;
                    let target = u32::from_le_bytes([
                        bytecode[ip + 2],
                        bytecode[ip + 3],
                        bytecode[ip + 4],
                        bytecode[ip + 5],
                    ]) as usize;
                    if cond < MAX_REGISTERS && !registers[cond].as_bool() {
                        ip = target;
                        gas_used += 2;
                        continue;
                    }
                }
                ip += 6;
                gas_used += 2;
            }

            // Unknown opcode - skip
            _ => {
                ip += 1;
            }
        }
    }

    // Default return
    let return_value = registers[0].as_i64().ok();
    Ok(InterpreterResult {
        return_value,
        gas_used,
    })
}

// ============================================================================
// Account Structures
// ============================================================================

/// X3VM Program state stored on-chain
#[account]
#[derive(Default)]
pub struct X3VMProgramState {
    /// Authority who can update/close this program
    pub authority: Pubkey,
    /// Program name
    pub name: String,
    /// X3 bytecode
    pub bytecode: Vec<u8>,
    /// Total execution count
    pub execution_count: u64,
    /// Total gas used across all executions
    pub total_gas_used: u64,
    /// Creation timestamp
    pub created_at: i64,
    /// PDA bump
    pub bump: u8,
}

/// Execution result stored on-chain
#[account]
#[derive(Default)]
pub struct X3VMExecutionResult {
    /// Program that was executed
    pub program: Pubkey,
    /// Who executed the program
    pub executor: Pubkey,
    /// Function index that was called
    pub function_index: u32,
    /// Return value (if any)
    pub return_value: Option<i64>,
    /// Gas used
    pub gas_used: u64,
    /// Whether execution succeeded
    pub success: bool,
    /// Whether this was an atomic execution
    pub is_atomic: bool,
    /// Execution timestamp
    pub executed_at: i64,
    /// PDA bump
    pub bump: u8,
}

// ============================================================================
// Context Definitions
// ============================================================================

#[derive(Accounts)]
#[instruction(bytecode: Vec<u8>, name: String)]
pub struct InitializeProgram<'info> {
    #[account(
        init,
        payer = authority,
        space = 8 + 32 + 4 + name.len() + 4 + bytecode.len() + 8 + 8 + 8 + 1 + 64,
        seeds = [b"x3vm_program", authority.key().as_ref(), name.as_bytes()],
        bump
    )]
    pub program_state: Account<'info, X3VMProgramState>,

    #[account(mut)]
    pub authority: Signer<'info>,

    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct Execute<'info> {
    #[account(mut)]
    pub program_state: Account<'info, X3VMProgramState>,

    #[account(
        init,
        payer = executor,
        space = 8 + 32 + 32 + 4 + 9 + 8 + 1 + 1 + 8 + 1 + 32,
        seeds = [
            b"x3vm_result",
            program_state.key().as_ref(),
            executor.key().as_ref(),
            &program_state.execution_count.to_le_bytes()
        ],
        bump
    )]
    pub execution_result: Account<'info, X3VMExecutionResult>,

    #[account(mut)]
    pub executor: Signer<'info>,

    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct ExecuteAtomic<'info> {
    #[account(mut)]
    pub program_state: Account<'info, X3VMProgramState>,

    #[account(
        init,
        payer = executor,
        space = 8 + 32 + 32 + 4 + 9 + 8 + 1 + 1 + 8 + 1 + 32,
        seeds = [
            b"x3vm_atomic",
            program_state.key().as_ref(),
            executor.key().as_ref(),
            &Clock::get().unwrap().unix_timestamp.to_le_bytes()
        ],
        bump
    )]
    pub execution_result: Account<'info, X3VMExecutionResult>,

    #[account(mut)]
    pub executor: Signer<'info>,

    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct UpdateProgram<'info> {
    #[account(
        mut,
        has_one = authority,
    )]
    pub program_state: Account<'info, X3VMProgramState>,

    pub authority: Signer<'info>,
}

#[derive(Accounts)]
pub struct CloseProgram<'info> {
    #[account(
        mut,
        has_one = authority,
        close = authority,
    )]
    pub program_state: Account<'info, X3VMProgramState>,

    #[account(mut)]
    pub authority: Signer<'info>,
}

// ============================================================================
// Events
// ============================================================================

#[event]
pub struct ExecutionCompleted {
    pub program: Pubkey,
    pub function_index: u32,
    pub return_value: Option<i64>,
    pub gas_used: u64,
    pub executor: Pubkey,
}

#[event]
pub struct AtomicExecutionCompleted {
    pub program: Pubkey,
    pub function_index: u32,
    pub return_value: Option<i64>,
    pub gas_used: u64,
    pub atomic_id: Pubkey,
}

// ============================================================================
// Errors
// ============================================================================

#[error_code]
pub enum X3VMError {
    #[msg("Bytecode exceeds maximum size")]
    BytecodeTooLarge,

    #[msg("Invalid bytecode format")]
    InvalidBytecode,

    #[msg("Invalid X3BC magic bytes")]
    InvalidMagic,

    #[msg("Gas limit exceeded")]
    GasLimitExceeded,

    #[msg("Stack overflow")]
    StackOverflow,

    #[msg("Division by zero")]
    DivisionByZero,

    #[msg("Invalid function index")]
    InvalidFunctionIndex,

    #[msg("Execution failed")]
    ExecutionFailed,

    #[msg("Type mismatch")]
    TypeMismatch,

    #[msg("Invalid instruction")]
    InvalidInstruction,
}
