//! X3 Bytecode Binary Format
//!
//! Defines the structure of compiled X3 bytecode modules.
//!
//! # Binary Layout
//!
//! ```text
//! ┌────────────────────────────────────────┐
//! │ Header (16 bytes)                      │
//! │   Magic: "X3BC" (4 bytes)              │
//! │   Version: u32                         │
//! │   Flags: u32                           │
//! │   Checksum: u32                        │
//! ├────────────────────────────────────────┤
//! │ Section Table                          │
//! │   Section count: u16                   │
//! │   [Section entries...]                 │
//! ├────────────────────────────────────────┤
//! │ Constant Pool Section                  │
//! │   Entry count: u32                     │
//! │   [Constant entries...]                │
//! ├────────────────────────────────────────┤
//! │ Function Table Section                 │
//! │   Entry count: u32                     │
//! │   [Function entries...]                │
//! ├────────────────────────────────────────┤
//! │ Global Table Section                   │
//! │   Entry count: u32                     │
//! │   [Global entries...]                  │
//! ├────────────────────────────────────────┤
//! │ Instruction Stream Section             │
//! │   Size: u32                            │
//! │   [Encoded instructions...]            │
//! ├────────────────────────────────────────┤
//! │ Debug Info Section (optional)          │
//! │   Source map entries                   │
//! │   Symbol names                         │
//! └────────────────────────────────────────┘
//! ```

use serde::{Deserialize, Serialize};
use std::collections::HashMap;

use crate::error::{BackendError, BackendErrorKind, BackendResult};
use crate::opcode::{ConstIdx, FuncIdx, Register};

/// Magic bytes identifying X3 bytecode files.
pub const MAGIC: &[u8; 4] = b"X3BC";

/// Current bytecode format version.
pub const VERSION: u32 = 1;

/// Maximum bytecode size (16 MB).
pub const MAX_BYTECODE_SIZE: usize = 16 * 1024 * 1024;

/// Maximum constant pool entries.
pub const MAX_CONST_POOL: u32 = 65536;

/// Maximum functions per module.
pub const MAX_FUNCTIONS: u32 = 65536;

/// Maximum string length in constant pool.
pub const MAX_STRING_LEN: usize = 65535;

/// Bytecode module flags.
#[derive(Clone, Copy, Debug, Default, PartialEq, Eq, Serialize, Deserialize)]
pub struct ModuleFlags(pub u32);

impl ModuleFlags {
    /// Module contains debug information.
    pub const DEBUG_INFO: u32 = 1 << 0;
    /// Module uses EVM intrinsics.
    pub const USES_EVM: u32 = 1 << 1;
    /// Module uses SVM intrinsics.
    pub const USES_SVM: u32 = 1 << 2;
    /// Module uses atomic blocks.
    pub const USES_ATOMIC: u32 = 1 << 3;
    /// Module is deterministic (no randomness/timing).
    pub const DETERMINISTIC: u32 = 1 << 4;

    pub fn new() -> Self {
        Self(0)
    }

    pub fn set(&mut self, flag: u32) {
        self.0 |= flag;
    }

    pub fn has(&self, flag: u32) -> bool {
        (self.0 & flag) != 0
    }
}

/// A complete bytecode module ready for execution.
#[derive(Clone, Debug, Serialize, Deserialize)]
pub struct BytecodeModule {
    /// Module version.
    pub version: u32,
    /// Module flags.
    pub flags: ModuleFlags,
    /// Constant pool.
    pub const_pool: ConstPool,
    /// Function table.
    pub functions: Vec<FunctionEntry>,
    /// Global variable table.
    pub globals: Vec<GlobalEntry>,
    /// Encoded instruction stream.
    pub code: Vec<u8>,
    /// Debug information (if present).
    pub debug_info: Option<DebugInfo>,
}

impl BytecodeModule {
    /// Create a new empty module.
    pub fn new() -> Self {
        Self {
            version: VERSION,
            flags: ModuleFlags::new(),
            const_pool: ConstPool::new(),
            functions: Vec::new(),
            globals: Vec::new(),
            code: Vec::new(),
            debug_info: None,
        }
    }

    /// Serialize module to bytes.
    pub fn to_bytes(&self) -> Vec<u8> {
        let mut bytes = Vec::new();

        // Header
        bytes.extend_from_slice(MAGIC);
        bytes.extend_from_slice(&self.version.to_le_bytes());
        bytes.extend_from_slice(&self.flags.0.to_le_bytes());
        // Placeholder for checksum (filled at end)
        let checksum_pos = bytes.len();
        bytes.extend_from_slice(&0u32.to_le_bytes());

        // Constant pool
        self.write_const_pool(&mut bytes);

        // Function table
        self.write_functions(&mut bytes);

        // Global table
        self.write_globals(&mut bytes);

        // Code section
        bytes.extend_from_slice(&(self.code.len() as u32).to_le_bytes());
        bytes.extend_from_slice(&self.code);

        // Debug info (optional)
        if let Some(ref debug) = self.debug_info {
            bytes.push(1); // Has debug info
            self.write_debug_info(&mut bytes, debug);
        } else {
            bytes.push(0); // No debug info
        }

        // Compute and write checksum
        let checksum = self.compute_checksum(&bytes[16..]); // Skip header
        bytes[checksum_pos..checksum_pos + 4].copy_from_slice(&checksum.to_le_bytes());

        bytes
    }

    /// Deserialize module from bytes.
    pub fn from_bytes(bytes: &[u8]) -> BackendResult<Self> {
        if bytes.len() < 16 {
            return Err(BackendError::without_span(BackendErrorKind::UnexpectedEof));
        }

        // Verify magic
        if &bytes[0..4] != MAGIC {
            return Err(BackendError::without_span(BackendErrorKind::InvalidMagic));
        }

        let version = u32::from_le_bytes([bytes[4], bytes[5], bytes[6], bytes[7]]);
        if version > VERSION {
            return Err(BackendError::without_span(
                BackendErrorKind::UnsupportedVersion(version),
            ));
        }

        let flags = ModuleFlags(u32::from_le_bytes([
            bytes[8], bytes[9], bytes[10], bytes[11],
        ]));
        let _checksum = u32::from_le_bytes([bytes[12], bytes[13], bytes[14], bytes[15]]);

        let mut offset = 16;

        // Read constant pool
        let (const_pool, new_offset) = Self::read_const_pool(bytes, offset)?;
        offset = new_offset;

        // Read function table
        let (functions, new_offset) = Self::read_functions(bytes, offset)?;
        offset = new_offset;

        // Read global table
        let (globals, new_offset) = Self::read_globals(bytes, offset)?;
        offset = new_offset;

        // Read code section
        if offset + 4 > bytes.len() {
            return Err(BackendError::without_span(BackendErrorKind::UnexpectedEof));
        }
        let code_len = u32::from_le_bytes([
            bytes[offset],
            bytes[offset + 1],
            bytes[offset + 2],
            bytes[offset + 3],
        ]) as usize;
        offset += 4;

        if offset + code_len > bytes.len() {
            return Err(BackendError::without_span(BackendErrorKind::UnexpectedEof));
        }
        let code = bytes[offset..offset + code_len].to_vec();
        offset += code_len;

        // Read debug info
        let debug_info = if offset < bytes.len() && bytes[offset] == 1 {
            offset += 1;
            let (debug, _) = Self::read_debug_info(bytes, offset)?;
            Some(debug)
        } else {
            None
        };

        Ok(Self {
            version,
            flags,
            const_pool,
            functions,
            globals,
            code,
            debug_info,
        })
    }

    fn write_const_pool(&self, bytes: &mut Vec<u8>) {
        bytes.extend_from_slice(&(self.const_pool.entries.len() as u32).to_le_bytes());
        for entry in &self.const_pool.entries {
            match entry {
                ConstValue::Integer(v) => {
                    bytes.push(0);
                    bytes.extend_from_slice(&v.to_le_bytes());
                }
                ConstValue::Float(v) => {
                    bytes.push(1);
                    bytes.extend_from_slice(&v.to_le_bytes());
                }
                ConstValue::String(s) => {
                    bytes.push(2);
                    bytes.extend_from_slice(&(s.len() as u32).to_le_bytes());
                    bytes.extend_from_slice(s.as_bytes());
                }
                ConstValue::Bool(b) => {
                    bytes.push(3);
                    bytes.push(if *b { 1 } else { 0 });
                }
                ConstValue::Bytes(b) => {
                    bytes.push(4);
                    bytes.extend_from_slice(&(b.len() as u32).to_le_bytes());
                    bytes.extend_from_slice(b);
                }
            }
        }
    }

    fn read_const_pool(bytes: &[u8], mut offset: usize) -> BackendResult<(ConstPool, usize)> {
        if offset + 4 > bytes.len() {
            return Err(BackendError::without_span(BackendErrorKind::UnexpectedEof));
        }
        let count = u32::from_le_bytes([
            bytes[offset],
            bytes[offset + 1],
            bytes[offset + 2],
            bytes[offset + 3],
        ]) as usize;
        offset += 4;

        let mut pool = ConstPool::new();
        for _ in 0..count {
            if offset >= bytes.len() {
                return Err(BackendError::without_span(BackendErrorKind::UnexpectedEof));
            }
            let tag = bytes[offset];
            offset += 1;

            let value = match tag {
                0 => {
                    // Integer
                    if offset + 8 > bytes.len() {
                        return Err(BackendError::without_span(BackendErrorKind::UnexpectedEof));
                    }
                    let v = i64::from_le_bytes([
                        bytes[offset],
                        bytes[offset + 1],
                        bytes[offset + 2],
                        bytes[offset + 3],
                        bytes[offset + 4],
                        bytes[offset + 5],
                        bytes[offset + 6],
                        bytes[offset + 7],
                    ]);
                    offset += 8;
                    ConstValue::Integer(v)
                }
                1 => {
                    // Float
                    if offset + 8 > bytes.len() {
                        return Err(BackendError::without_span(BackendErrorKind::UnexpectedEof));
                    }
                    let v = f64::from_le_bytes([
                        bytes[offset],
                        bytes[offset + 1],
                        bytes[offset + 2],
                        bytes[offset + 3],
                        bytes[offset + 4],
                        bytes[offset + 5],
                        bytes[offset + 6],
                        bytes[offset + 7],
                    ]);
                    offset += 8;
                    ConstValue::Float(v)
                }
                2 => {
                    // String
                    if offset + 4 > bytes.len() {
                        return Err(BackendError::without_span(BackendErrorKind::UnexpectedEof));
                    }
                    let len = u32::from_le_bytes([
                        bytes[offset],
                        bytes[offset + 1],
                        bytes[offset + 2],
                        bytes[offset + 3],
                    ]) as usize;
                    offset += 4;
                    if offset + len > bytes.len() {
                        return Err(BackendError::without_span(BackendErrorKind::UnexpectedEof));
                    }
                    let s = String::from_utf8_lossy(&bytes[offset..offset + len]).to_string();
                    offset += len;
                    ConstValue::String(s)
                }
                3 => {
                    // Bool
                    if offset >= bytes.len() {
                        return Err(BackendError::without_span(BackendErrorKind::UnexpectedEof));
                    }
                    let b = bytes[offset] != 0;
                    offset += 1;
                    ConstValue::Bool(b)
                }
                4 => {
                    // Bytes
                    if offset + 4 > bytes.len() {
                        return Err(BackendError::without_span(BackendErrorKind::UnexpectedEof));
                    }
                    let len = u32::from_le_bytes([
                        bytes[offset],
                        bytes[offset + 1],
                        bytes[offset + 2],
                        bytes[offset + 3],
                    ]) as usize;
                    offset += 4;
                    if offset + len > bytes.len() {
                        return Err(BackendError::without_span(BackendErrorKind::UnexpectedEof));
                    }
                    let b = bytes[offset..offset + len].to_vec();
                    offset += len;
                    ConstValue::Bytes(b)
                }
                _ => {
                    return Err(BackendError::without_span(
                        BackendErrorKind::CorruptedBytecode { offset: offset - 1 },
                    ));
                }
            };
            pool.entries.push(value);
        }

        Ok((pool, offset))
    }

    fn write_functions(&self, bytes: &mut Vec<u8>) {
        bytes.extend_from_slice(&(self.functions.len() as u32).to_le_bytes());
        for func in &self.functions {
            // Name length + name
            bytes.extend_from_slice(&(func.name.len() as u16).to_le_bytes());
            bytes.extend_from_slice(func.name.as_bytes());
            // Entry point
            bytes.extend_from_slice(&func.entry_point.to_le_bytes());
            // Parameter count
            bytes.push(func.param_count);
            // Local count
            bytes.extend_from_slice(&func.local_count.to_le_bytes());
            // Max stack
            bytes.extend_from_slice(&func.max_stack.to_le_bytes());
            // Return type tag (simplified: 0=void, 1=int, 2=float, 3=bool, 4=other)
            bytes.push(func.return_type_tag);
        }
    }

    fn read_functions(
        bytes: &[u8],
        mut offset: usize,
    ) -> BackendResult<(Vec<FunctionEntry>, usize)> {
        if offset + 4 > bytes.len() {
            return Err(BackendError::without_span(BackendErrorKind::UnexpectedEof));
        }
        let count = u32::from_le_bytes([
            bytes[offset],
            bytes[offset + 1],
            bytes[offset + 2],
            bytes[offset + 3],
        ]) as usize;
        offset += 4;

        let mut functions = Vec::with_capacity(count);
        for _ in 0..count {
            // Name
            if offset + 2 > bytes.len() {
                return Err(BackendError::without_span(BackendErrorKind::UnexpectedEof));
            }
            let name_len = u16::from_le_bytes([bytes[offset], bytes[offset + 1]]) as usize;
            offset += 2;
            if offset + name_len > bytes.len() {
                return Err(BackendError::without_span(BackendErrorKind::UnexpectedEof));
            }
            let name = String::from_utf8_lossy(&bytes[offset..offset + name_len]).to_string();
            offset += name_len;

            // Entry point
            if offset + 4 > bytes.len() {
                return Err(BackendError::without_span(BackendErrorKind::UnexpectedEof));
            }
            let entry_point = u32::from_le_bytes([
                bytes[offset],
                bytes[offset + 1],
                bytes[offset + 2],
                bytes[offset + 3],
            ]);
            offset += 4;

            // Param count
            if offset >= bytes.len() {
                return Err(BackendError::without_span(BackendErrorKind::UnexpectedEof));
            }
            let param_count = bytes[offset];
            offset += 1;

            // Local count
            if offset + 2 > bytes.len() {
                return Err(BackendError::without_span(BackendErrorKind::UnexpectedEof));
            }
            let local_count = u16::from_le_bytes([bytes[offset], bytes[offset + 1]]);
            offset += 2;

            // Max stack
            if offset + 2 > bytes.len() {
                return Err(BackendError::without_span(BackendErrorKind::UnexpectedEof));
            }
            let max_stack = u16::from_le_bytes([bytes[offset], bytes[offset + 1]]);
            offset += 2;

            // Return type tag
            if offset >= bytes.len() {
                return Err(BackendError::without_span(BackendErrorKind::UnexpectedEof));
            }
            let return_type_tag = bytes[offset];
            offset += 1;

            functions.push(FunctionEntry {
                name,
                entry_point,
                param_count,
                local_count,
                max_stack,
                return_type_tag,
            });
        }

        Ok((functions, offset))
    }

    fn write_globals(&self, bytes: &mut Vec<u8>) {
        bytes.extend_from_slice(&(self.globals.len() as u32).to_le_bytes());
        for global in &self.globals {
            bytes.extend_from_slice(&(global.name.len() as u16).to_le_bytes());
            bytes.extend_from_slice(global.name.as_bytes());
            bytes.push(global.type_tag);
            bytes.push(if global.mutable { 1 } else { 0 });
            bytes.extend_from_slice(&global.init_const.0.to_le_bytes());
        }
    }

    fn read_globals(bytes: &[u8], mut offset: usize) -> BackendResult<(Vec<GlobalEntry>, usize)> {
        if offset + 4 > bytes.len() {
            return Err(BackendError::without_span(BackendErrorKind::UnexpectedEof));
        }
        let count = u32::from_le_bytes([
            bytes[offset],
            bytes[offset + 1],
            bytes[offset + 2],
            bytes[offset + 3],
        ]) as usize;
        offset += 4;

        let mut globals = Vec::with_capacity(count);
        for _ in 0..count {
            // Name
            if offset + 2 > bytes.len() {
                return Err(BackendError::without_span(BackendErrorKind::UnexpectedEof));
            }
            let name_len = u16::from_le_bytes([bytes[offset], bytes[offset + 1]]) as usize;
            offset += 2;
            if offset + name_len > bytes.len() {
                return Err(BackendError::without_span(BackendErrorKind::UnexpectedEof));
            }
            let name = String::from_utf8_lossy(&bytes[offset..offset + name_len]).to_string();
            offset += name_len;

            if offset + 6 > bytes.len() {
                return Err(BackendError::without_span(BackendErrorKind::UnexpectedEof));
            }
            let type_tag = bytes[offset];
            let mutable = bytes[offset + 1] != 0;
            let init_const = ConstIdx(u32::from_le_bytes([
                bytes[offset + 2],
                bytes[offset + 3],
                bytes[offset + 4],
                bytes[offset + 5],
            ]));
            offset += 6;

            globals.push(GlobalEntry {
                name,
                type_tag,
                mutable,
                init_const,
            });
        }

        Ok((globals, offset))
    }

    fn write_debug_info(&self, bytes: &mut Vec<u8>, debug: &DebugInfo) {
        // Source map entries
        bytes.extend_from_slice(&(debug.source_map.len() as u32).to_le_bytes());
        for entry in &debug.source_map {
            bytes.extend_from_slice(&entry.code_offset.to_le_bytes());
            bytes.extend_from_slice(&entry.source_line.to_le_bytes());
            bytes.extend_from_slice(&entry.source_column.to_le_bytes());
        }

        // Symbol names
        bytes.extend_from_slice(&(debug.symbol_names.len() as u32).to_le_bytes());
        for (idx, name) in &debug.symbol_names {
            bytes.extend_from_slice(&idx.to_le_bytes());
            bytes.extend_from_slice(&(name.len() as u16).to_le_bytes());
            bytes.extend_from_slice(name.as_bytes());
        }
    }

    fn read_debug_info(bytes: &[u8], mut offset: usize) -> BackendResult<(DebugInfo, usize)> {
        // Source map
        if offset + 4 > bytes.len() {
            return Err(BackendError::without_span(BackendErrorKind::UnexpectedEof));
        }
        let map_count = u32::from_le_bytes([
            bytes[offset],
            bytes[offset + 1],
            bytes[offset + 2],
            bytes[offset + 3],
        ]) as usize;
        offset += 4;

        let mut source_map = Vec::with_capacity(map_count);
        for _ in 0..map_count {
            if offset + 8 > bytes.len() {
                return Err(BackendError::without_span(BackendErrorKind::UnexpectedEof));
            }
            let code_offset = u32::from_le_bytes([
                bytes[offset],
                bytes[offset + 1],
                bytes[offset + 2],
                bytes[offset + 3],
            ]);
            let source_line = u16::from_le_bytes([bytes[offset + 4], bytes[offset + 5]]);
            let source_column = u16::from_le_bytes([bytes[offset + 6], bytes[offset + 7]]);
            offset += 8;
            source_map.push(SourceMapEntry {
                code_offset,
                source_line,
                source_column,
            });
        }

        // Symbol names
        if offset + 4 > bytes.len() {
            return Err(BackendError::without_span(BackendErrorKind::UnexpectedEof));
        }
        let name_count = u32::from_le_bytes([
            bytes[offset],
            bytes[offset + 1],
            bytes[offset + 2],
            bytes[offset + 3],
        ]) as usize;
        offset += 4;

        let mut symbol_names = HashMap::new();
        for _ in 0..name_count {
            if offset + 6 > bytes.len() {
                return Err(BackendError::without_span(BackendErrorKind::UnexpectedEof));
            }
            let idx = u32::from_le_bytes([
                bytes[offset],
                bytes[offset + 1],
                bytes[offset + 2],
                bytes[offset + 3],
            ]);
            let name_len = u16::from_le_bytes([bytes[offset + 4], bytes[offset + 5]]) as usize;
            offset += 6;

            if offset + name_len > bytes.len() {
                return Err(BackendError::without_span(BackendErrorKind::UnexpectedEof));
            }
            let name = String::from_utf8_lossy(&bytes[offset..offset + name_len]).to_string();
            offset += name_len;
            symbol_names.insert(idx, name);
        }

        Ok((
            DebugInfo {
                source_map,
                symbol_names,
            },
            offset,
        ))
    }

    fn compute_checksum(&self, data: &[u8]) -> u32 {
        // Simple CRC32-like checksum
        let mut sum: u32 = 0;
        for byte in data {
            sum = sum.wrapping_add(*byte as u32);
            sum = sum.wrapping_mul(31);
        }
        sum
    }

    /// Get function by index.
    pub fn get_function(&self, idx: FuncIdx) -> Option<&FunctionEntry> {
        self.functions.get(idx.0 as usize)
    }

    /// Get function by name.
    pub fn find_function(&self, name: &str) -> Option<(FuncIdx, &FunctionEntry)> {
        self.functions
            .iter()
            .enumerate()
            .find(|(_, f)| f.name == name)
            .map(|(i, f)| (FuncIdx(i as u32), f))
    }

    /// Get constant from pool.
    pub fn get_const(&self, idx: ConstIdx) -> Option<&ConstValue> {
        self.const_pool.get(idx)
    }
}

impl Default for BytecodeModule {
    fn default() -> Self {
        Self::new()
    }
}

/// Constant pool for immediate values.
#[derive(Clone, Debug, Default, Serialize, Deserialize)]
pub struct ConstPool {
    pub entries: Vec<ConstValue>,
    /// Deduplication map for integers.
    #[serde(skip)]
    int_map: HashMap<i64, ConstIdx>,
    /// Deduplication map for floats (using bits).
    #[serde(skip)]
    float_map: HashMap<u64, ConstIdx>,
    /// Deduplication map for strings.
    #[serde(skip)]
    string_map: HashMap<String, ConstIdx>,
}

impl ConstPool {
    pub fn new() -> Self {
        Self {
            entries: Vec::new(),
            int_map: HashMap::new(),
            float_map: HashMap::new(),
            string_map: HashMap::new(),
        }
    }

    /// Add an integer constant, deduplicating.
    pub fn add_integer(&mut self, value: i64) -> BackendResult<ConstIdx> {
        if let Some(&idx) = self.int_map.get(&value) {
            return Ok(idx);
        }
        let idx = self.add_entry(ConstValue::Integer(value))?;
        self.int_map.insert(value, idx);
        Ok(idx)
    }

    /// Add a float constant, deduplicating.
    pub fn add_float(&mut self, value: f64) -> BackendResult<ConstIdx> {
        let bits = value.to_bits();
        if let Some(&idx) = self.float_map.get(&bits) {
            return Ok(idx);
        }
        let idx = self.add_entry(ConstValue::Float(value))?;
        self.float_map.insert(bits, idx);
        Ok(idx)
    }

    /// Add a string constant, deduplicating.
    pub fn add_string(&mut self, value: String) -> BackendResult<ConstIdx> {
        if value.len() > MAX_STRING_LEN {
            return Err(BackendError::without_span(
                BackendErrorKind::StringTooLong {
                    len: value.len(),
                    max: MAX_STRING_LEN,
                },
            ));
        }
        if let Some(&idx) = self.string_map.get(&value) {
            return Ok(idx);
        }
        let idx = self.add_entry(ConstValue::String(value.clone()))?;
        self.string_map.insert(value, idx);
        Ok(idx)
    }

    /// Add a bool constant.
    pub fn add_bool(&mut self, value: bool) -> BackendResult<ConstIdx> {
        // Bools are not deduplicated (they're tiny)
        self.add_entry(ConstValue::Bool(value))
    }

    /// Add raw bytes.
    pub fn add_bytes(&mut self, value: Vec<u8>) -> BackendResult<ConstIdx> {
        self.add_entry(ConstValue::Bytes(value))
    }

    fn add_entry(&mut self, value: ConstValue) -> BackendResult<ConstIdx> {
        if self.entries.len() >= MAX_CONST_POOL as usize {
            return Err(BackendError::without_span(
                BackendErrorKind::ConstPoolOverflow {
                    max: MAX_CONST_POOL,
                },
            ));
        }
        let idx = ConstIdx(self.entries.len() as u32);
        self.entries.push(value);
        Ok(idx)
    }

    /// Get constant by index.
    pub fn get(&self, idx: ConstIdx) -> Option<&ConstValue> {
        self.entries.get(idx.0 as usize)
    }

    /// Number of entries in pool.
    pub fn len(&self) -> usize {
        self.entries.len()
    }

    pub fn is_empty(&self) -> bool {
        self.entries.is_empty()
    }
}

/// Values stored in the constant pool.
#[derive(Clone, Debug, PartialEq, Serialize, Deserialize)]
pub enum ConstValue {
    Integer(i64),
    Float(f64),
    String(String),
    Bool(bool),
    Bytes(Vec<u8>),
}

impl ConstValue {
    pub fn as_integer(&self) -> Option<i64> {
        match self {
            ConstValue::Integer(v) => Some(*v),
            _ => None,
        }
    }

    pub fn as_float(&self) -> Option<f64> {
        match self {
            ConstValue::Float(v) => Some(*v),
            _ => None,
        }
    }

    pub fn as_string(&self) -> Option<&str> {
        match self {
            ConstValue::String(s) => Some(s),
            _ => None,
        }
    }

    pub fn as_bool(&self) -> Option<bool> {
        match self {
            ConstValue::Bool(b) => Some(*b),
            _ => None,
        }
    }
}

/// Function table entry.
#[derive(Clone, Debug, Serialize, Deserialize)]
pub struct FunctionEntry {
    /// Function name.
    pub name: String,
    /// Byte offset in instruction stream.
    pub entry_point: u32,
    /// Number of parameters.
    pub param_count: u8,
    /// Number of local variables (excluding params).
    pub local_count: u16,
    /// Maximum stack depth needed.
    pub max_stack: u16,
    /// Return type tag (0=void, 1=int, 2=float, 3=bool, 4=other).
    pub return_type_tag: u8,
}

/// Global variable entry.
#[derive(Clone, Debug, Serialize, Deserialize)]
pub struct GlobalEntry {
    /// Global name.
    pub name: String,
    /// Type tag.
    pub type_tag: u8,
    /// Whether this global is mutable.
    pub mutable: bool,
    /// Initial value constant index.
    pub init_const: ConstIdx,
}

/// Debug information for source mapping.
#[derive(Clone, Debug, Default, Serialize, Deserialize)]
pub struct DebugInfo {
    /// Maps code offsets to source locations.
    pub source_map: Vec<SourceMapEntry>,
    /// Maps symbol indices to names.
    pub symbol_names: HashMap<u32, String>,
}

/// Single entry in the source map.
#[derive(Clone, Debug, Serialize, Deserialize)]
pub struct SourceMapEntry {
    /// Byte offset in instruction stream.
    pub code_offset: u32,
    /// Source line number (1-based).
    pub source_line: u16,
    /// Source column number (1-based).
    pub source_column: u16,
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn const_pool_dedup() {
        let mut pool = ConstPool::new();

        let idx1 = pool.add_integer(42).unwrap();
        let idx2 = pool.add_integer(42).unwrap();
        assert_eq!(idx1, idx2);

        let idx3 = pool.add_integer(100).unwrap();
        assert_ne!(idx1, idx3);

        assert_eq!(pool.len(), 2);
    }

    #[test]
    fn module_roundtrip() {
        let mut module = BytecodeModule::new();
        module.const_pool.add_integer(123).unwrap();
        module.const_pool.add_string("hello".to_string()).unwrap();
        module.functions.push(FunctionEntry {
            name: "main".to_string(),
            entry_point: 0,
            param_count: 0,
            local_count: 2,
            max_stack: 4,
            return_type_tag: 1,
        });
        module.code = vec![0x10, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x05]; // LoadConst r0, c0; Ret r0

        let bytes = module.to_bytes();
        let decoded = BytecodeModule::from_bytes(&bytes).unwrap();

        assert_eq!(decoded.const_pool.len(), 2);
        assert_eq!(decoded.functions.len(), 1);
        assert_eq!(decoded.functions[0].name, "main");
        assert_eq!(decoded.code.len(), module.code.len());
    }

    #[test]
    fn module_flags() {
        let mut flags = ModuleFlags::new();
        assert!(!flags.has(ModuleFlags::DEBUG_INFO));

        flags.set(ModuleFlags::DEBUG_INFO);
        flags.set(ModuleFlags::USES_EVM);

        assert!(flags.has(ModuleFlags::DEBUG_INFO));
        assert!(flags.has(ModuleFlags::USES_EVM));
        assert!(!flags.has(ModuleFlags::USES_SVM));
    }
}
