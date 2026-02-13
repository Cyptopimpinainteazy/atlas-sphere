//! X3 Virtual Machine - Deterministic Interpreter
//!
//! A register-based bytecode interpreter for X3BC modules.
//!
//! # Features
//!
//! - **Deterministic execution**: Same inputs always produce same outputs
//! - **Gas metering**: Configurable gas limits for bounded execution
//! - **Hostcall interface**: Extensible external function hooks
//! - **Atomic windows**: Track atomic begin/end for transaction safety
//!
//! # Architecture
//!
//! ```text
//! ┌─────────────────────────────────────────────────┐
//! │                      VM                         │
//! │  ┌──────────┐  ┌──────────┐  ┌──────────────┐  │
//! │  │ Module   │  │ Registers│  │ Call Stack   │  │
//! │  │ (code,   │  │ (256 max)│  │ (64 depth)   │  │
//! │  │  consts) │  │          │  │              │  │
//! │  └──────────┘  └──────────┘  └──────────────┘  │
//! │  ┌──────────┐  ┌──────────┐  ┌──────────────┐  │
//! │  │ Operand  │  │ Gas      │  │ Atomic       │  │
//! │  │ Stack    │  │ Counter  │  │ Depth        │  │
//! │  └──────────┘  └──────────┘  └──────────────┘  │
//! └─────────────────────────────────────────────────┘
//! ```

use x3_backend::bc_format::{BytecodeModule, ConstValue};
use x3_backend::opcode::Opcode;

use crate::error::{VMError, VMErrorKind, VMResult};
use crate::hostcall::HostcallRegistry;

/// Maximum register count.
pub const MAX_REGISTERS: usize = 256;

/// Maximum call stack depth.
pub const MAX_CALL_DEPTH: usize = 64;

/// Maximum operand stack size.
pub const MAX_STACK_SIZE: usize = 1024;

/// Default gas limit.
pub const DEFAULT_GAS_LIMIT: u64 = 1_000_000;

/// VM configuration.
#[derive(Clone, Debug)]
pub struct VMConfig {
    /// Maximum gas allowed.
    pub gas_limit: u64,
    /// Maximum call stack depth.
    pub max_call_depth: usize,
    /// Maximum operand stack size.
    pub max_stack_size: usize,
    /// Enable debug tracing.
    pub trace: bool,
}

impl Default for VMConfig {
    fn default() -> Self {
        Self {
            gas_limit: DEFAULT_GAS_LIMIT,
            max_call_depth: MAX_CALL_DEPTH,
            max_stack_size: MAX_STACK_SIZE,
            trace: false,
        }
    }
}

/// Runtime value in the VM.
#[derive(Clone, Debug, PartialEq)]
pub enum Value {
    /// 64-bit signed integer.
    I64(i64),
    /// 64-bit floating point.
    F64(f64),
    /// Boolean.
    Bool(bool),
    /// String (heap allocated).
    String(String),
    /// Byte array.
    Bytes(Vec<u8>),
    /// Address/pointer.
    Addr(u64),
    /// Unit (void/null).
    Unit,
}

impl Value {
    /// Convert constant value to runtime value.
    pub fn from_const(c: &ConstValue) -> Self {
        match c {
            ConstValue::Integer(i) => Value::I64(*i),
            ConstValue::Float(f) => Value::F64(*f),
            ConstValue::String(s) => Value::String(s.clone()),
            ConstValue::Bool(b) => Value::Bool(*b),
            ConstValue::Bytes(b) => Value::Bytes(b.clone()),
        }
    }

    /// Get as i64.
    pub fn as_i64(&self) -> VMResult<i64> {
        match self {
            Value::I64(v) => Ok(*v),
            _ => Err(VMError::without_ip(VMErrorKind::TypeMismatch(
                "i64".to_string(),
                format!("{:?}", self),
            ))),
        }
    }

    /// Get as f64.
    pub fn as_f64(&self) -> VMResult<f64> {
        match self {
            Value::F64(v) => Ok(*v),
            _ => Err(VMError::without_ip(VMErrorKind::TypeMismatch(
                "f64".to_string(),
                format!("{:?}", self),
            ))),
        }
    }

    /// Get as bool.
    pub fn as_bool(&self) -> VMResult<bool> {
        match self {
            Value::Bool(v) => Ok(*v),
            // Truthy conversion
            Value::I64(v) => Ok(*v != 0),
            _ => Err(VMError::without_ip(VMErrorKind::TypeMismatch(
                "bool".to_string(),
                format!("{:?}", self),
            ))),
        }
    }
}

impl Default for Value {
    fn default() -> Self {
        Value::Unit
    }
}

/// Call frame on the call stack.
#[derive(Clone, Debug)]
pub struct Frame {
    /// Instruction pointer (offset in code).
    pub ip: usize,
    /// Base register index for this frame.
    pub base: usize,
    /// Return address (IP to return to).
    pub ret_addr: usize,
    /// Function index.
    pub func_idx: usize,
}

/// Execution result.
#[derive(Clone, Debug)]
pub struct ExecutionResult {
    /// Return value (if any).
    pub value: Option<Value>,
    /// Gas consumed.
    pub gas_used: u64,
    /// Number of instructions executed.
    pub instruction_count: u64,
}

/// The X3 Virtual Machine.
pub struct VM {
    /// Loaded module.
    module: BytecodeModule,
    /// Register file.
    regs: Vec<Value>,
    /// Operand stack.
    stack: Vec<Value>,
    /// Call stack.
    call_stack: Vec<Frame>,
    /// Configuration.
    pub config: VMConfig,
    /// Gas consumed.
    gas_used: u64,
    /// Atomic nesting depth.
    atomic_depth: usize,
    /// Snapshot stack for atomic windows (regs, globals)
    atomic_snapshots: Vec<(Vec<Value>, Vec<Value>)>,
    /// Global storage (module.globals length)
    globals: Vec<Value>,
    /// Hostcall registry.
    hostcalls: HostcallRegistry,
    /// Instruction count.
    instruction_count: u64,
}

impl VM {
    /// Create a new VM with the given module.
    pub fn new(module: BytecodeModule) -> Self {
        Self::with_config(module, VMConfig::default())
    }

    /// Create a new VM with custom configuration.
    pub fn with_config(module: BytecodeModule, config: VMConfig) -> Self {
        // initialize globals from module (use const pool initializers where present)
        let mut globals: Vec<Value> = Vec::new();
        for g in &module.globals {
            let idx = g.init_const.0 as usize;
            let val = module
                .const_pool
                .entries
                .get(idx)
                .map(|c| Value::from_const(c))
                .unwrap_or(Value::Unit);
            globals.push(val);
        }

        Self {
            module,
            regs: vec![Value::Unit; MAX_REGISTERS],
            stack: Vec::with_capacity(config.max_stack_size),
            call_stack: Vec::with_capacity(config.max_call_depth),
            config,
            gas_used: 0,
            atomic_depth: 0,
            atomic_snapshots: Vec::new(),
            globals,
            hostcalls: HostcallRegistry::with_standard(),
            instruction_count: 0,
        }
    }

    /// Create a VM from raw bytes.
    pub fn from_bytes(bytes: &[u8]) -> VMResult<Self> {
        let module = BytecodeModule::from_bytes(bytes)
            .map_err(|e| VMError::without_ip(VMErrorKind::ModuleLoadError(format!("{:?}", e))))?;
        Ok(Self::new(module))
    }

    /// Register a hostcall.
    pub fn register_hostcall<F>(
        &mut self,
        id: u8,
        name: impl Into<String>,
        arg_count: usize,
        handler: F,
    ) where
        F: Fn(&[Value]) -> VMResult<Option<Value>> + Send + Sync + 'static,
    {
        self.hostcalls.register(id, name, arg_count, handler);
    }

    /// Get the loaded module.
    pub fn module(&self) -> &BytecodeModule {
        &self.module
    }

    /// Get gas used.
    pub fn gas_used(&self) -> u64 {
        self.gas_used
    }

    /// Set a register value directly.
    ///
    /// Useful for testing or pre-initializing registers before execution.
    /// Panics if the register index is out of bounds.
    pub fn set_register(&mut self, idx: usize, value: Value) {
        self.regs[idx] = value;
    }

    /// Get a register value.
    pub fn get_register(&self, idx: usize) -> &Value {
        &self.regs[idx]
    }

    /// Resolve a virtual register index to the underlying physical register
    /// using the current frame base. Returns an error if out of bounds.
    fn resolve_reg_checked(&self, reg: usize, ip: usize) -> VMResult<usize> {
        let base = self.call_stack.last().map(|f| f.base).unwrap_or(0);
        let idx = base + reg;
        if idx >= self.regs.len() {
            return Err(self.error_at(ip, VMErrorKind::RegisterOutOfBounds(reg as u16)));
        }
        Ok(idx)
    }

    /// Resolve register without IP (used in contexts where ip not available).
    fn resolve_reg(&self, reg: usize) -> usize {
        self.call_stack.last().map(|f| f.base).unwrap_or(0) + reg
    }

    /// Call a function by index.
    pub fn call_function(&mut self, func_idx: usize, args: &[Value]) -> VMResult<ExecutionResult> {
        // Validate function index
        if func_idx >= self.module.functions.len() {
            return Err(VMError::without_ip(VMErrorKind::FunctionNotFound(func_idx)));
        }

        let func = &self.module.functions[func_idx];

        // Validate argument count
        if args.len() != func.param_count as usize {
            return Err(VMError::without_ip(VMErrorKind::ArgumentCountMismatch(
                func.param_count as usize,
                args.len(),
            )));
        }

        // Set up registers with arguments
        for (i, arg) in args.iter().enumerate() {
            self.regs[i] = arg.clone();
        }

        // Push initial frame
        self.call_stack.push(Frame {
            ip: func.entry_point as usize,
            base: 0,
            ret_addr: usize::MAX, // Sentinel for top-level return
            func_idx,
        });

        // Execute
        let result = self.execute()?;

        Ok(ExecutionResult {
            value: result,
            gas_used: self.gas_used,
            instruction_count: self.instruction_count,
        })
    }

    /// Call a function by name.
    pub fn call_function_by_name(
        &mut self,
        name: &str,
        args: &[Value],
    ) -> VMResult<ExecutionResult> {
        let func_idx = self
            .module
            .functions
            .iter()
            .position(|f| f.name == name)
            .ok_or_else(|| {
                VMError::without_ip(VMErrorKind::FunctionNotFoundByName(name.to_string()))
            })?;
        self.call_function(func_idx, args)
    }

    /// Main execution loop.
    fn execute(&mut self) -> VMResult<Option<Value>> {
        loop {
            // Check gas limit
            if self.gas_used >= self.config.gas_limit {
                return Err(self.error(VMErrorKind::GasLimitExceeded));
            }

            // Get current frame
            let frame = match self.call_stack.last_mut() {
                Some(f) => f,
                None => return Ok(None), // No frames left
            };

            let ip = frame.ip;

            // Bounds check
            if ip >= self.module.code.len() {
                return Err(self.error_at(ip, VMErrorKind::InstructionPointerOutOfBounds));
            }

            // Fetch opcode
            let opcode_byte = self.module.code[ip];
            let opcode = Opcode::from_byte(opcode_byte)
                .ok_or_else(|| self.error_at(ip, VMErrorKind::InvalidOpcode(opcode_byte)))?;

            // Consume gas
            self.gas_used += self.opcode_gas_cost(opcode);
            self.instruction_count += 1;

            // Trace if enabled
            if self.config.trace {
                log::trace!("[VM] IP={:04x} {:?}", ip, opcode);
            }

            // Execute instruction
            match self.execute_instruction(opcode, ip)? {
                StepResult::Continue(next_ip) => {
                    if let Some(f) = self.call_stack.last_mut() {
                        f.ip = next_ip;
                    }
                }
                StepResult::Return(value) => {
                    // Pop frame
                    let frame = self.call_stack.pop().unwrap();
                    if frame.ret_addr == usize::MAX {
                        // Top-level return
                        return Ok(value);
                    }
                    // Set return value in caller's r0 (respect caller base)
                    if let Some(v) = value {
                        if let Some(caller) = self.call_stack.last() {
                            let idx = caller.base + 0;
                            self.regs[idx] = v;
                        } else {
                            self.regs[0] = v;
                        }
                    }
                    // Resume at return address
                    if let Some(f) = self.call_stack.last_mut() {
                        f.ip = frame.ret_addr;
                    }
                }
                StepResult::Halt => {
                    return Ok(None);
                }
            }
        }
    }

    /// Execute a single instruction.
    fn execute_instruction(&mut self, opcode: Opcode, ip: usize) -> VMResult<StepResult> {
        let code = &self.module.code;

        match opcode {
            // ================================================================
            // Control Flow
            // ================================================================
            Opcode::Nop => Ok(StepResult::Continue(ip + 1)),

            Opcode::Jump => {
                let target = self.read_u32(ip + 1)? as usize;
                Ok(StepResult::Continue(target))
            }

            Opcode::JumpIf => {
                let cond_reg = self.read_u8(ip + 1)? as usize;
                let target = self.read_u32(ip + 2)? as usize;
                if self.regs[cond_reg].as_bool()? {
                    Ok(StepResult::Continue(target))
                } else {
                    Ok(StepResult::Continue(ip + 6))
                }
            }

            Opcode::JumpUnless => {
                let cond_reg = self.read_u8(ip + 1)? as usize;
                let target = self.read_u32(ip + 2)? as usize;
                if !self.regs[cond_reg].as_bool()? {
                    Ok(StepResult::Continue(target))
                } else {
                    Ok(StepResult::Continue(ip + 6))
                }
            }

            Opcode::Call => {
                // call dst:reg func:u32 argc:u16 [args:reg...]
                let _dst = self.read_u8(ip + 1)? as usize; // dst currently unused; return is in r0
                let func_idx = self.read_u32(ip + 2)? as usize;
                let argc = self.read_u16(ip + 6)? as usize;

                if func_idx >= self.module.functions.len() {
                    return Err(self.error_at(ip, VMErrorKind::FunctionNotFound(func_idx)));
                }

                if self.call_stack.len() >= self.config.max_call_depth {
                    return Err(self.error_at(
                        ip,
                        VMErrorKind::StackOverflow(
                            self.call_stack.len(),
                            self.config.max_call_depth,
                        ),
                    ));
                }

                // Read argument registers from caller (respect caller base)
                let mut args = Vec::with_capacity(argc);
                for i in 0..argc {
                    let arg_reg = self.read_u8(ip + 8 + i)? as usize;
                    let resolved = self.resolve_reg(arg_reg);
                    args.push(self.regs[resolved].clone());
                }

                let func = &self.module.functions[func_idx];
                let ret_addr = ip + 8 + argc;

                // Compute callee base: caller.base + caller.local_count (simple stack-frame window)
                let caller_base = self.call_stack.last().map(|f| f.base).unwrap_or(0);
                let caller_local_count = self
                    .call_stack
                    .last()
                    .map(|f| self.module.functions[f.func_idx].local_count as usize)
                    .unwrap_or(0);
                let callee_base = caller_base + caller_local_count;

                // Bounds check for callee window
                if callee_base + func.local_count as usize >= MAX_REGISTERS {
                    return Err(self.error_at(ip, VMErrorKind::RegisterOutOfBounds(
                        (callee_base + func.local_count as usize) as u16,
                    )));
                }

                // Place args into callee register window
                for (i, arg) in args.into_iter().enumerate() {
                    self.regs[callee_base + i] = arg;
                }

                // Push new frame with computed base
                self.call_stack.push(Frame {
                    ip: func.entry_point as usize,
                    base: callee_base,
                    ret_addr,
                    func_idx,
                });

                Ok(StepResult::Continue(func.entry_point as usize))
            }

            Opcode::Ret => {
                let src = self.read_u8(ip + 1)? as usize;
                let src_resolved = self.resolve_reg_checked(src, ip)?;
                let value = self.regs[src_resolved].clone();
                Ok(StepResult::Return(Some(value)))
            }

            Opcode::RetVoid => Ok(StepResult::Return(None)),

            Opcode::Halt => Ok(StepResult::Halt),

            // ================================================================
            // Load/Store
            // ================================================================
            Opcode::LoadConst => {
                let dst = self.read_u8(ip + 1)? as usize;
                let idx = self.read_u32(ip + 2)? as usize;

                if idx >= self.module.const_pool.entries.len() {
                    return Err(self.error_at(ip, VMErrorKind::ConstPoolOutOfBounds(idx)));
                }

                let dst_r = self.resolve_reg_checked(dst, ip)?;
                self.regs[dst_r] = Value::from_const(&self.module.const_pool.entries[idx]);
                Ok(StepResult::Continue(ip + 6))
            }

            Opcode::Mov => {
                let dst = self.read_u8(ip + 1)? as usize;
                let src = self.read_u8(ip + 2)? as usize;
                let dst_r = self.resolve_reg_checked(dst, ip)?;
                let src_r = self.resolve_reg_checked(src, ip)?;
                self.regs[dst_r] = self.regs[src_r].clone();
                Ok(StepResult::Continue(ip + 3))
            }

            Opcode::LoadGlobal => {
                let dst = self.read_u8(ip + 1)? as usize;
                let idx = self.read_u32(ip + 2)? as usize;
                // TODO: implement global variable storage
                self.regs[dst] = Value::Unit;
                Ok(StepResult::Continue(ip + 6))
            }

            Opcode::StoreGlobal => {
                let _idx = self.read_u32(ip + 1)? as usize;
                let _src = self.read_u8(ip + 5)? as usize;
                // TODO: implement global variable storage
                Ok(StepResult::Continue(ip + 6))
            }

            Opcode::LoadImm => {
                let dst = self.read_u8(ip + 1)? as usize;
                let val = self.read_i8(ip + 2)?;
                let dst_r = self.resolve_reg_checked(dst, ip)?;
                self.regs[dst_r] = Value::I64(val as i64);
                Ok(StepResult::Continue(ip + 3))
            }

            Opcode::LoadZero => {
                let dst = self.read_u8(ip + 1)? as usize;
                let dst_r = self.resolve_reg_checked(dst, ip)?;
                self.regs[dst_r] = Value::I64(0);
                Ok(StepResult::Continue(ip + 2))
            }

            Opcode::LoadTrue => {
                let dst = self.read_u8(ip + 1)? as usize;
                let dst_r = self.resolve_reg_checked(dst, ip)?;
                self.regs[dst_r] = Value::Bool(true);
                Ok(StepResult::Continue(ip + 2))
            }

            Opcode::LoadFalse => {
                let dst = self.read_u8(ip + 1)? as usize;
                let dst_r = self.resolve_reg_checked(dst, ip)?;
                self.regs[dst_r] = Value::Bool(false);
                Ok(StepResult::Continue(ip + 2))
            }

            // ================================================================
            // Integer Arithmetic
            // ================================================================
            Opcode::AddI => {
                let dst = self.read_u8(ip + 1)? as usize;
                let a = self.read_u8(ip + 2)? as usize;
                let b = self.read_u8(ip + 3)? as usize;
                let va = self.regs[a].as_i64()?;
                let vb = self.regs[b].as_i64()?;
                self.regs[dst] = Value::I64(va.wrapping_add(vb));
                Ok(StepResult::Continue(ip + 4))
            }

            Opcode::SubI => {
                let dst = self.read_u8(ip + 1)? as usize;
                let a = self.read_u8(ip + 2)? as usize;
                let b = self.read_u8(ip + 3)? as usize;
                let va = self.regs[a].as_i64()?;
                let vb = self.regs[b].as_i64()?;
                self.regs[dst] = Value::I64(va.wrapping_sub(vb));
                Ok(StepResult::Continue(ip + 4))
            }

            Opcode::MulI => {
                let dst = self.read_u8(ip + 1)? as usize;
                let a = self.read_u8(ip + 2)? as usize;
                let b = self.read_u8(ip + 3)? as usize;
                let va = self.regs[a].as_i64()?;
                let vb = self.regs[b].as_i64()?;
                self.regs[dst] = Value::I64(va.wrapping_mul(vb));
                Ok(StepResult::Continue(ip + 4))
            }

            Opcode::DivI => {
                let dst = self.read_u8(ip + 1)? as usize;
                let a = self.read_u8(ip + 2)? as usize;
                let b = self.read_u8(ip + 3)? as usize;
                let va = self.regs[a].as_i64()?;
                let vb = self.regs[b].as_i64()?;
                if vb == 0 {
                    return Err(self.error_at(ip, VMErrorKind::DivisionByZero));
                }
                self.regs[dst] = Value::I64(va / vb);
                Ok(StepResult::Continue(ip + 4))
            }

            Opcode::ModI => {
                let dst = self.read_u8(ip + 1)? as usize;
                let a = self.read_u8(ip + 2)? as usize;
                let b = self.read_u8(ip + 3)? as usize;
                let va = self.regs[a].as_i64()?;
                let vb = self.regs[b].as_i64()?;
                if vb == 0 {
                    return Err(self.error_at(ip, VMErrorKind::DivisionByZero));
                }
                self.regs[dst] = Value::I64(va % vb);
                Ok(StepResult::Continue(ip + 4))
            }

            Opcode::NegI => {
                let dst = self.read_u8(ip + 1)? as usize;
                let src = self.read_u8(ip + 2)? as usize;
                let v = self.regs[src].as_i64()?;
                self.regs[dst] = Value::I64(v.wrapping_neg());
                Ok(StepResult::Continue(ip + 3))
            }

            // ================================================================
            // Float Arithmetic
            // ================================================================
            Opcode::AddF => {
                let dst = self.read_u8(ip + 1)? as usize;
                let a = self.read_u8(ip + 2)? as usize;
                let b = self.read_u8(ip + 3)? as usize;
                let va = self.regs[a].as_f64()?;
                let vb = self.regs[b].as_f64()?;
                self.regs[dst] = Value::F64(va + vb);
                Ok(StepResult::Continue(ip + 4))
            }

            Opcode::SubF => {
                let dst = self.read_u8(ip + 1)? as usize;
                let a = self.read_u8(ip + 2)? as usize;
                let b = self.read_u8(ip + 3)? as usize;
                let va = self.regs[a].as_f64()?;
                let vb = self.regs[b].as_f64()?;
                self.regs[dst] = Value::F64(va - vb);
                Ok(StepResult::Continue(ip + 4))
            }

            Opcode::MulF => {
                let dst = self.read_u8(ip + 1)? as usize;
                let a = self.read_u8(ip + 2)? as usize;
                let b = self.read_u8(ip + 3)? as usize;
                let va = self.regs[a].as_f64()?;
                let vb = self.regs[b].as_f64()?;
                self.regs[dst] = Value::F64(va * vb);
                Ok(StepResult::Continue(ip + 4))
            }

            Opcode::DivF => {
                let dst = self.read_u8(ip + 1)? as usize;
                let a = self.read_u8(ip + 2)? as usize;
                let b = self.read_u8(ip + 3)? as usize;
                let va = self.regs[a].as_f64()?;
                let vb = self.regs[b].as_f64()?;
                // Float division by zero produces infinity, not error
                self.regs[dst] = Value::F64(va / vb);
                Ok(StepResult::Continue(ip + 4))
            }

            Opcode::NegF => {
                let dst = self.read_u8(ip + 1)? as usize;
                let src = self.read_u8(ip + 2)? as usize;
                let v = self.regs[src].as_f64()?;
                self.regs[dst] = Value::F64(-v);
                Ok(StepResult::Continue(ip + 3))
            }

            // ================================================================
            // Comparisons
            // ================================================================
            Opcode::EqI => {
                let dst = self.read_u8(ip + 1)? as usize;
                let a = self.read_u8(ip + 2)? as usize;
                let b = self.read_u8(ip + 3)? as usize;
                let va = self.regs[a].as_i64()?;
                let vb = self.regs[b].as_i64()?;
                self.regs[dst] = Value::Bool(va == vb);
                Ok(StepResult::Continue(ip + 4))
            }

            Opcode::NeI => {
                let dst = self.read_u8(ip + 1)? as usize;
                let a = self.read_u8(ip + 2)? as usize;
                let b = self.read_u8(ip + 3)? as usize;
                let va = self.regs[a].as_i64()?;
                let vb = self.regs[b].as_i64()?;
                self.regs[dst] = Value::Bool(va != vb);
                Ok(StepResult::Continue(ip + 4))
            }

            Opcode::LtI => {
                let dst = self.read_u8(ip + 1)? as usize;
                let a = self.read_u8(ip + 2)? as usize;
                let b = self.read_u8(ip + 3)? as usize;
                let va = self.regs[a].as_i64()?;
                let vb = self.regs[b].as_i64()?;
                self.regs[dst] = Value::Bool(va < vb);
                Ok(StepResult::Continue(ip + 4))
            }

            Opcode::LeI => {
                let dst = self.read_u8(ip + 1)? as usize;
                let a = self.read_u8(ip + 2)? as usize;
                let b = self.read_u8(ip + 3)? as usize;
                let va = self.regs[a].as_i64()?;
                let vb = self.regs[b].as_i64()?;
                self.regs[dst] = Value::Bool(va <= vb);
                Ok(StepResult::Continue(ip + 4))
            }

            Opcode::GtI => {
                let dst = self.read_u8(ip + 1)? as usize;
                let a = self.read_u8(ip + 2)? as usize;
                let b = self.read_u8(ip + 3)? as usize;
                let va = self.regs[a].as_i64()?;
                let vb = self.regs[b].as_i64()?;
                self.regs[dst] = Value::Bool(va > vb);
                Ok(StepResult::Continue(ip + 4))
            }

            Opcode::GeI => {
                let dst = self.read_u8(ip + 1)? as usize;
                let a = self.read_u8(ip + 2)? as usize;
                let b = self.read_u8(ip + 3)? as usize;
                let va = self.regs[a].as_i64()?;
                let vb = self.regs[b].as_i64()?;
                self.regs[dst] = Value::Bool(va >= vb);
                Ok(StepResult::Continue(ip + 4))
            }

            // Float comparisons
            Opcode::EqF => {
                let dst = self.read_u8(ip + 1)? as usize;
                let a = self.read_u8(ip + 2)? as usize;
                let b = self.read_u8(ip + 3)? as usize;
                let va = self.regs[a].as_f64()?;
                let vb = self.regs[b].as_f64()?;
                self.regs[dst] = Value::Bool(va == vb);
                Ok(StepResult::Continue(ip + 4))
            }

            Opcode::NeF => {
                let dst = self.read_u8(ip + 1)? as usize;
                let a = self.read_u8(ip + 2)? as usize;
                let b = self.read_u8(ip + 3)? as usize;
                let va = self.regs[a].as_f64()?;
                let vb = self.regs[b].as_f64()?;
                self.regs[dst] = Value::Bool(va != vb);
                Ok(StepResult::Continue(ip + 4))
            }

            Opcode::LtF => {
                let dst = self.read_u8(ip + 1)? as usize;
                let a = self.read_u8(ip + 2)? as usize;
                let b = self.read_u8(ip + 3)? as usize;
                let va = self.regs[a].as_f64()?;
                let vb = self.regs[b].as_f64()?;
                self.regs[dst] = Value::Bool(va < vb);
                Ok(StepResult::Continue(ip + 4))
            }

            Opcode::LeF => {
                let dst = self.read_u8(ip + 1)? as usize;
                let a = self.read_u8(ip + 2)? as usize;
                let b = self.read_u8(ip + 3)? as usize;
                let va = self.regs[a].as_f64()?;
                let vb = self.regs[b].as_f64()?;
                self.regs[dst] = Value::Bool(va <= vb);
                Ok(StepResult::Continue(ip + 4))
            }

            Opcode::GtF => {
                let dst = self.read_u8(ip + 1)? as usize;
                let a = self.read_u8(ip + 2)? as usize;
                let b = self.read_u8(ip + 3)? as usize;
                let va = self.regs[a].as_f64()?;
                let vb = self.regs[b].as_f64()?;
                self.regs[dst] = Value::Bool(va > vb);
                Ok(StepResult::Continue(ip + 4))
            }

            Opcode::GeF => {
                let dst = self.read_u8(ip + 1)? as usize;
                let a = self.read_u8(ip + 2)? as usize;
                let b = self.read_u8(ip + 3)? as usize;
                let va = self.regs[a].as_f64()?;
                let vb = self.regs[b].as_f64()?;
                self.regs[dst] = Value::Bool(va >= vb);
                Ok(StepResult::Continue(ip + 4))
            }

            // ================================================================
            // Bitwise Operations
            // ================================================================
            Opcode::And => {
                let dst = self.read_u8(ip + 1)? as usize;
                let a = self.read_u8(ip + 2)? as usize;
                let b = self.read_u8(ip + 3)? as usize;
                let va = self.regs[a].as_i64()?;
                let vb = self.regs[b].as_i64()?;
                self.regs[dst] = Value::I64(va & vb);
                Ok(StepResult::Continue(ip + 4))
            }

            Opcode::Or => {
                let dst = self.read_u8(ip + 1)? as usize;
                let a = self.read_u8(ip + 2)? as usize;
                let b = self.read_u8(ip + 3)? as usize;
                let va = self.regs[a].as_i64()?;
                let vb = self.regs[b].as_i64()?;
                self.regs[dst] = Value::I64(va | vb);
                Ok(StepResult::Continue(ip + 4))
            }

            Opcode::Xor => {
                let dst = self.read_u8(ip + 1)? as usize;
                let a = self.read_u8(ip + 2)? as usize;
                let b = self.read_u8(ip + 3)? as usize;
                let va = self.regs[a].as_i64()?;
                let vb = self.regs[b].as_i64()?;
                self.regs[dst] = Value::I64(va ^ vb);
                Ok(StepResult::Continue(ip + 4))
            }

            Opcode::Not => {
                let dst = self.read_u8(ip + 1)? as usize;
                let src = self.read_u8(ip + 2)? as usize;
                let v = self.regs[src].as_i64()?;
                self.regs[dst] = Value::I64(!v);
                Ok(StepResult::Continue(ip + 3))
            }

            Opcode::Shl => {
                let dst = self.read_u8(ip + 1)? as usize;
                let a = self.read_u8(ip + 2)? as usize;
                let b = self.read_u8(ip + 3)? as usize;
                let va = self.regs[a].as_i64()?;
                let vb = self.regs[b].as_i64()? as u32;
                self.regs[dst] = Value::I64(va.wrapping_shl(vb));
                Ok(StepResult::Continue(ip + 4))
            }

            Opcode::Shr => {
                let dst = self.read_u8(ip + 1)? as usize;
                let a = self.read_u8(ip + 2)? as usize;
                let b = self.read_u8(ip + 3)? as usize;
                let va = self.regs[a].as_i64()?;
                let vb = self.regs[b].as_i64()? as u32;
                self.regs[dst] = Value::I64(va.wrapping_shr(vb));
                Ok(StepResult::Continue(ip + 4))
            }

            Opcode::UShr => {
                let dst = self.read_u8(ip + 1)? as usize;
                let a = self.read_u8(ip + 2)? as usize;
                let b = self.read_u8(ip + 3)? as usize;
                let va = self.regs[a].as_i64()? as u64;
                let vb = self.regs[b].as_i64()? as u32;
                self.regs[dst] = Value::I64(va.wrapping_shr(vb) as i64);
                Ok(StepResult::Continue(ip + 4))
            }

            // ================================================================
            // Logical Operations
            // ================================================================
            Opcode::LAnd => {
                let dst = self.read_u8(ip + 1)? as usize;
                let a = self.read_u8(ip + 2)? as usize;
                let b = self.read_u8(ip + 3)? as usize;
                let va = self.regs[a].as_bool()?;
                let vb = self.regs[b].as_bool()?;
                self.regs[dst] = Value::Bool(va && vb);
                Ok(StepResult::Continue(ip + 4))
            }

            Opcode::LOr => {
                let dst = self.read_u8(ip + 1)? as usize;
                let a = self.read_u8(ip + 2)? as usize;
                let b = self.read_u8(ip + 3)? as usize;
                let va = self.regs[a].as_bool()?;
                let vb = self.regs[b].as_bool()?;
                self.regs[dst] = Value::Bool(va || vb);
                Ok(StepResult::Continue(ip + 4))
            }

            Opcode::LNot => {
                let dst = self.read_u8(ip + 1)? as usize;
                let src = self.read_u8(ip + 2)? as usize;
                let v = self.regs[src].as_bool()?;
                self.regs[dst] = Value::Bool(!v);
                Ok(StepResult::Continue(ip + 3))
            }

            // ================================================================
            // Atomic Operations
            // ================================================================
            Opcode::AtomicBegin => {
                // snapshot regs + globals
                self.atomic_snapshots
                    .push((self.regs.clone(), self.globals.clone()));
                self.atomic_depth += 1;
                Ok(StepResult::Continue(ip + 3)) // opcode + id:u16
            }

            Opcode::AtomicCommit => {
                if self.atomic_depth == 0 {
                    return Err(self.error_at(ip, VMErrorKind::AtomicEndWithoutBegin));
                }
                // commit: discard last snapshot
                self.atomic_snapshots.pop();
                self.atomic_depth -= 1;
                Ok(StepResult::Continue(ip + 3)) // opcode + id:u16
            }

            Opcode::AtomicRollback => {
                if self.atomic_depth == 0 {
                    return Err(self.error_at(ip, VMErrorKind::AtomicRollbackWithoutBegin));
                }
                // restore last snapshot
                if let Some((regs_snap, globals_snap)) = self.atomic_snapshots.pop() {
                    self.regs = regs_snap;
                    self.globals = globals_snap;
                }
                self.atomic_depth -= 1;
                return Err(self.error_at(ip, VMErrorKind::AtomicAborted));
            }

            // ================================================================
            // Debug Operations (no-op in production)
            // ================================================================
            Opcode::DebugPrint => {
                let src = self.read_u8(ip + 1)? as usize;
                log::debug!("[DEBUG] r{} = {:?}", src, self.regs[src]);
                Ok(StepResult::Continue(ip + 2))
            }

            Opcode::Breakpoint => {
                log::debug!("[DEBUG] BREAK at IP={}", ip);
                Ok(StepResult::Continue(ip + 1))
            }

            Opcode::Assert => {
                let cond = self.read_u8(ip + 1)? as usize;
                let _msg_idx = self.read_u32(ip + 2)?;
                if !self.regs[cond].as_bool()? {
                    return Err(self.error_at(ip, VMErrorKind::AssertionFailed));
                }
                Ok(StepResult::Continue(ip + 6))
            }

            Opcode::Panic => {
                let msg_idx = self.read_u32(ip + 1)? as usize;
                let msg = if msg_idx < self.module.const_pool.entries.len() {
                    if let ConstValue::String(s) = &self.module.const_pool.entries[msg_idx] {
                        s.clone()
                    } else {
                        "panic".to_string()
                    }
                } else {
                    "panic".to_string()
                };
                return Err(self.error_at(ip, VMErrorKind::UserPanic(msg)));
            }

            // ================================================================
            // GPU Intrinsics (0xD0 – 0xD5)
            // Dispatch to registered hostcalls which call real CUDA kernels
            // via libloading FFI (see gpu_hostcalls.rs).
            //
            // Encoding:
            //   GpuSha256Batch:    [0xD0] dst:u8 inputs:u8 count:u8   → 4 bytes
            //   GpuEd25519Verify:  [0xD1] dst:u8 sigs:u8 count:u8     → 4 bytes
            //   GpuPohChain:       [0xD2] dst:u8 seeds:u8 count:u8 chain_len:u8 → 5 bytes
            //   GpuSha256Streamed: [0xD3] dst:u8 inputs:u8 count:u8 streams:u8  → 5 bytes
            //   GpuDeviceCount:    [0xD4] dst:u8                       → 2 bytes
            //   GpuBenchmark:      [0xD5] dst:u8 count:u8 streams:u8  → 4 bytes
            // ================================================================

            Opcode::GpuSha256Batch => {
                // gpu_sha256_batch(inputs: Bytes, count: I64) → Bytes
                let dst = self.read_u8(ip + 1)? as usize;
                let inputs_reg = self.read_u8(ip + 2)? as usize;
                let count_reg = self.read_u8(ip + 3)? as usize;
                let args = vec![self.regs[inputs_reg].clone(), self.regs[count_reg].clone()];
                let result = self.hostcalls.invoke(0xD0, &args)
                    .map_err(|e| self.error_at(ip, e.kind))?;
                if let Some(v) = result {
                    self.regs[dst] = v;
                }
                Ok(StepResult::Continue(ip + 4))
            }

            Opcode::GpuEd25519Verify => {
                // gpu_ed25519_verify(sigs: Bytes, count: I64) → Bytes
                let dst = self.read_u8(ip + 1)? as usize;
                let sigs_reg = self.read_u8(ip + 2)? as usize;
                let count_reg = self.read_u8(ip + 3)? as usize;
                let args = vec![self.regs[sigs_reg].clone(), self.regs[count_reg].clone()];
                let result = self.hostcalls.invoke(0xD1, &args)
                    .map_err(|e| self.error_at(ip, e.kind))?;
                if let Some(v) = result {
                    self.regs[dst] = v;
                }
                Ok(StepResult::Continue(ip + 4))
            }

            Opcode::GpuPohChain => {
                // gpu_poh_chain(seeds: Bytes, num_chains: I64, chain_length: I64) → Bytes
                let dst = self.read_u8(ip + 1)? as usize;
                let seeds_reg = self.read_u8(ip + 2)? as usize;
                let count_reg = self.read_u8(ip + 3)? as usize;
                let chain_len_reg = self.read_u8(ip + 4)? as usize;
                let args = vec![
                    self.regs[seeds_reg].clone(),
                    self.regs[count_reg].clone(),
                    self.regs[chain_len_reg].clone(),
                ];
                let result = self.hostcalls.invoke(0xD2, &args)
                    .map_err(|e| self.error_at(ip, e.kind))?;
                if let Some(v) = result {
                    self.regs[dst] = v;
                }
                Ok(StepResult::Continue(ip + 5))
            }

            Opcode::GpuSha256Streamed => {
                // gpu_sha256_streamed(inputs: Bytes, count: I64, streams: I64) → Bytes
                let dst = self.read_u8(ip + 1)? as usize;
                let inputs_reg = self.read_u8(ip + 2)? as usize;
                let count_reg = self.read_u8(ip + 3)? as usize;
                let streams_reg = self.read_u8(ip + 4)? as usize;
                let args = vec![
                    self.regs[inputs_reg].clone(),
                    self.regs[count_reg].clone(),
                    self.regs[streams_reg].clone(),
                ];
                let result = self.hostcalls.invoke(0xD3, &args)
                    .map_err(|e| self.error_at(ip, e.kind))?;
                if let Some(v) = result {
                    self.regs[dst] = v;
                }
                Ok(StepResult::Continue(ip + 5))
            }

            Opcode::GpuDeviceCount => {
                // gpu_device_count() → I64
                let dst = self.read_u8(ip + 1)? as usize;
                let result = self.hostcalls.invoke(0xD4, &[])
                    .map_err(|e| self.error_at(ip, e.kind))?;
                if let Some(v) = result {
                    self.regs[dst] = v;
                }
                Ok(StepResult::Continue(ip + 2))
            }

            Opcode::GpuBenchmark => {
                // gpu_benchmark(count: I64, streams: I64) → Bytes (JSON)
                let dst = self.read_u8(ip + 1)? as usize;
                let count_reg = self.read_u8(ip + 2)? as usize;
                let streams_reg = self.read_u8(ip + 3)? as usize;
                let args = vec![self.regs[count_reg].clone(), self.regs[streams_reg].clone()];
                let result = self.hostcalls.invoke(0xD5, &args)
                    .map_err(|e| self.error_at(ip, e.kind))?;
                if let Some(v) = result {
                    self.regs[dst] = v;
                }
                Ok(StepResult::Continue(ip + 4))
            }

            Opcode::GpuKeccak256Batch => {
                // gpu_keccak256_batch(inputs: Bytes, count: I64) → Bytes
                let dst = self.read_u8(ip + 1)? as usize;
                let inputs_reg = self.read_u8(ip + 2)? as usize;
                let count_reg = self.read_u8(ip + 3)? as usize;
                let args = vec![self.regs[inputs_reg].clone(), self.regs[count_reg].clone()];
                let result = self.hostcalls.invoke(0xD6, &args)
                    .map_err(|e| self.error_at(ip, e.kind))?;
                if let Some(v) = result {
                    self.regs[dst] = v;
                }
                Ok(StepResult::Continue(ip + 4))
            }

            Opcode::GpuSecp256k1Verify => {
                // gpu_secp256k1_verify(sigs: Bytes, count: I64) → Bytes
                let dst = self.read_u8(ip + 1)? as usize;
                let sigs_reg = self.read_u8(ip + 2)? as usize;
                let count_reg = self.read_u8(ip + 3)? as usize;
                let args = vec![self.regs[sigs_reg].clone(), self.regs[count_reg].clone()];
                let result = self.hostcalls.invoke(0xD7, &args)
                    .map_err(|e| self.error_at(ip, e.kind))?;
                if let Some(v) = result {
                    self.regs[dst] = v;
                }
                Ok(StepResult::Continue(ip + 4))
            }

            // ================================================================
            // Unimplemented opcodes return error
            // ================================================================
            _ => {
                let opc = self.module.code[ip];
                Err(self.error_at(ip, VMErrorKind::UnimplementedOpcode(opc)))
            }
        }
    }

    // ========================================================================
    // Helpers
    // ========================================================================

    fn read_u8(&self, offset: usize) -> VMResult<u8> {
        self.module
            .code
            .get(offset)
            .copied()
            .ok_or_else(|| self.error_at(offset, VMErrorKind::InstructionPointerOutOfBounds))
    }

    fn read_i8(&self, offset: usize) -> VMResult<i8> {
        Ok(self.read_u8(offset)? as i8)
    }

    fn read_u16(&self, offset: usize) -> VMResult<u16> {
        if offset + 2 > self.module.code.len() {
            return Err(self.error_at(offset, VMErrorKind::InstructionPointerOutOfBounds));
        }
        Ok(u16::from_le_bytes([
            self.module.code[offset],
            self.module.code[offset + 1],
        ]))
    }

    fn read_u32(&self, offset: usize) -> VMResult<u32> {
        if offset + 4 > self.module.code.len() {
            return Err(self.error_at(offset, VMErrorKind::InstructionPointerOutOfBounds));
        }
        Ok(u32::from_le_bytes([
            self.module.code[offset],
            self.module.code[offset + 1],
            self.module.code[offset + 2],
            self.module.code[offset + 3],
        ]))
    }

    fn error(&self, kind: VMErrorKind) -> VMError {
        VMError::without_ip(kind)
    }

    fn error_at(&self, ip: usize, kind: VMErrorKind) -> VMError {
        VMError::at_ip(ip, kind)
    }

    fn opcode_gas_cost(&self, opcode: Opcode) -> u64 {
        match opcode {
            Opcode::Nop => 1,
            Opcode::Jump | Opcode::JumpIf | Opcode::JumpUnless => 2,
            Opcode::Call => 10,
            Opcode::Ret | Opcode::RetVoid => 2,
            Opcode::Halt => 1,
            Opcode::LoadConst | Opcode::Mov | Opcode::LoadImm => 1,
            Opcode::LoadGlobal | Opcode::StoreGlobal => 3,
            Opcode::AddI | Opcode::SubI | Opcode::MulI => 1,
            Opcode::DivI | Opcode::ModI => 5,
            Opcode::AddF | Opcode::SubF | Opcode::MulF | Opcode::DivF => 2,
            Opcode::EqI | Opcode::NeI | Opcode::LtI | Opcode::LeI | Opcode::GtI | Opcode::GeI => 1,
            Opcode::And | Opcode::Or | Opcode::Xor | Opcode::Not => 1,
            Opcode::Shl | Opcode::Shr | Opcode::UShr => 1,
            Opcode::AtomicBegin | Opcode::AtomicCommit => 5,
            Opcode::AtomicRollback => 10,
            // GPU intrinsics — expensive (real CUDA kernel launch)
            Opcode::GpuSha256Batch | Opcode::GpuEd25519Verify | Opcode::GpuPohChain
                | Opcode::GpuKeccak256Batch => 500,
            Opcode::GpuSecp256k1Verify => 600, // ECC scalar mul is heavier
            Opcode::GpuSha256Streamed => 750, // stream pipeline setup overhead
            Opcode::GpuDeviceCount => 10,      // device query only
            Opcode::GpuBenchmark => 1000,      // full benchmark run
            _ => 1,
        }
    }
}

/// Result of executing one instruction.
enum StepResult {
    /// Continue to next IP.
    Continue(usize),
    /// Return from current function.
    Return(Option<Value>),
    /// Halt execution.
    Halt,
}

#[cfg(test)]
mod tests {
    use super::*;
    use x3_backend::bc_format_helpers;

    #[test]
    fn vm_smoke_add() {
        // Use the helper to assemble a simple module
        let bytes = bc_format_helpers::assemble_simple_module();
        let mut vm = VM::from_bytes(&bytes).expect("module should load");

        // Call function 0 with no arguments
        let result = vm.call_function(0, &[]).expect("execution should succeed");

        // Should return 42 + 7 = 49
        assert_eq!(result.value, Some(Value::I64(49)));
        assert!(result.gas_used > 0);
        assert!(result.instruction_count > 0);
    }

    #[test]
    fn vm_with_parameters() {
        let bytes = bc_format_helpers::assemble_param_module();
        let mut vm = VM::from_bytes(&bytes).expect("module should load");

        let result = vm
            .call_function(0, &[Value::I64(10), Value::I64(20)])
            .expect("execution should succeed");

        assert_eq!(result.value, Some(Value::I64(30)));
    }

    #[test]
    fn vm_branch_positive() {
        let bytes = bc_format_helpers::assemble_branch_module();
        let mut vm = VM::from_bytes(&bytes).expect("module should load");

        // Positive value: should return the value
        let result = vm
            .call_function(0, &[Value::I64(5)])
            .expect("execution should succeed");

        assert_eq!(result.value, Some(Value::I64(5)));
    }

    #[test]
    fn vm_branch_negative() {
        let bytes = bc_format_helpers::assemble_branch_module();
        let mut vm = VM::from_bytes(&bytes).expect("module should load");

        // Negative value: should return 0
        let result = vm
            .call_function(0, &[Value::I64(-5)])
            .expect("execution should succeed");

        assert_eq!(result.value, Some(Value::I64(0)));
    }

    #[test]
    fn vm_halt() {
        let bytes = bc_format_helpers::assemble_halt_module();
        let mut vm = VM::from_bytes(&bytes).expect("module should load");

        let result = vm.call_function(0, &[]).expect("execution should succeed");

        assert_eq!(result.value, None);
    }

    #[test]
    fn vm_gas_limit() {
        let bytes = bc_format_helpers::assemble_simple_module();
        let mut vm = VM::from_bytes(&bytes).expect("module should load");

        // Set very low gas limit
        vm.config.gas_limit = 1;

        let result = vm.call_function(0, &[]);
        assert!(result.is_err());
        match result {
            Err(e) => assert!(matches!(e.kind, VMErrorKind::GasLimitExceeded)),
            _ => panic!("expected gas limit error"),
        }
    }
}
