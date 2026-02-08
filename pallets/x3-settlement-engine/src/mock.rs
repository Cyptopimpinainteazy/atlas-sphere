//! Minimal test harness mocks for `pallet-x3-settlement-engine` used in unit tests.

#[cfg(test)]
pub mod mock {
    use super::*;

    /// Prepare a minimal test environment. In the real pallet tests, this would
    /// construct a full runtime externals environment. For our incremental
    /// collateral PoC we only need a compile-time placeholder.
    pub fn _setup() {
        // No-op placeholder for test harness setup
    }
}
