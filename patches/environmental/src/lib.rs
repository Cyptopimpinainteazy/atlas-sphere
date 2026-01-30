//! Minimal placeholder for `environmental` used as a local patch to unblock builds.

/// Return a stub value so dependent crates can link.
pub fn placeholder_env_value() -> &'static str { "placeholder" }
