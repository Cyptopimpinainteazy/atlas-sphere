//! Temporary stub for `compiler_bridge` to allow formatting and CI until the real
//! generated file is available. This file should be replaced by the generated
//! bridge when the `compile` feature is enabled.

#![allow(dead_code)]

/// Placeholder function used by tests or build tooling.
#[cfg(feature = "compile")]
pub fn compile_bridge_placeholder() -> Result<(), ()> {
    Ok(())
}
