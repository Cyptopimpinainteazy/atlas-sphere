pub mod core;
pub mod intent;
pub mod verifier;
pub mod signers;
pub mod broadcaster;
pub mod monitor;
pub mod crypto;
pub mod ipc;

/// Wallet Core entrypoint.
/// Strict boundary: Only `verifier` talks to RPC. `signers` isolated.
pub struct ExecutionFirewall {
    // Scaffold for Option 1 & 3 integration
}
