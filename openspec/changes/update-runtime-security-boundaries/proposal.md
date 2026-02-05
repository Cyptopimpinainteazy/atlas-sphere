# Change: Update Runtime Security Boundaries

## Why
The current runtime wiring leaves multiple critical operations gated by `EnsureRoot` and (more importantly) configures governance emergency controls in a way that is effectively public when combined with Root-dispatch proposal enactment. Additionally, the VM adapter selection differs between `std` and `no_std` builds even though adapter receipts can affect canonical on-chain state.

These are consensus- and governance-critical security boundaries; they should be explicitly constrained and documented.

## What Changes
- Tighten privileged origins in the runtime so emergency actions and sensitive admin operations are not callable by arbitrary signed accounts.
- Replace `EnsureRoot` usage for day-to-day privileged operations with a governance/collective origin (e.g., a council threshold) where appropriate.
- Make VM adapter selection explicitly safe for consensus: ensure native execution does not diverge from WASM behavior for consensus-critical paths.

## Impact
- Affected code:
  - `runtime/src/lib.rs` (origin wiring for scheduler/preimage/treasury/governance/emergency)
  - `pallets/governance/src/lib.rs` (origin expectations and emergency controls)
  - Potentially `crates/{evm,svm,x3}-integration` feature gating (adapter selection)
- Affected behavior:
  - Who can trigger emergency governance paths
  - Who can schedule/manage privileged calls
  - How VM adapter behavior is selected during native vs WASM execution
