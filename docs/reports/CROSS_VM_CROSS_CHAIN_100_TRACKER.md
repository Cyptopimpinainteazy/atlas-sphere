# Cross-VM / Cross-Chain 100% Completion Tracker

**Last Updated:** 2026-03-22  
**Owner:** Core protocol team  
**Goal:** Remove all runtime placeholders/stubs in the atomic cross-VM + cross-chain execution path and ship production-grade behavior.

---

## Last Completed Task (Checkpoint)

- [x] Audited core cross-VM/cross-chain path for unfinished code and placeholders.
- [x] Identified and prioritized production blockers with exact file locations.
- [x] Confirmed fee policy implementation exists (4% cross-VM, 2% same-VM cross-chain) and targeted tests pass.

**Resume From:** P0-1 (proof verification wiring)

---

## Definition of Done (100%)

- [ ] No proof-validation stubs in runtime-critical paths.
- [ ] No placeholder bridge/mirror execution in runtime-critical paths.
- [ ] No placeholder payload encoding for bridge/unwrap/amount fields.
- [ ] Rollback/refund math uses actual executed-leg accounting.
- [ ] Cross-chain relayer + event paths are functionally implemented.
- [ ] Targeted crate tests pass for all touched modules.
- [ ] `progress.txt` checkpoint updated after each completed item.

---

## Priority Backlog

### P0 — Security / Correctness blockers

- [ ] **P0-1: Real proof verification in x3-coin runtime paths**
  - Files:
    - `pallets/x3-coin/src/lib.rs`
    - `pallets/x3-coin/src/cross_chain.rs`
  - Scope:
    - [x] Replace `Ok(())` proof branches with strict per-chain proof validation (EVM/SVM/BTC).
    - [x] Add regression tests for invalid EVM/SVM/BTC proofs in `pallets/x3-coin/src/tests.rs`.
    - [x] Enforce versioned finality envelope checks (magic/version/chain-id/confirmations + header/receipt commitments) for EVM/SVM/BTC proofs.
    - [ ] Extend to full external finality verification hooks (receipt/header/light-client-level validation).

- [ ] **P0-2: Replace fake keccak in bridge IBC client**
  - File: `crates/x3-bridge/src/ibc_light_client.rs`
  - Scope:
    - [x] Replace toy hash implementation with real `keccak_256` path.
    - [x] Ensure merkle root verification behavior is deterministic and test-covered.
    - [x] Add/enable test target for `crates/x3-bridge` (workspace package + focused tests now runnable).

- [ ] **P0-3: Remove placeholder bridge/mirror execution stubs**
  - File: `pallets/x3-coin/src/cross_chain.rs`
  - Scope:
    - [x] Replace EVM mirror mint/burn false-success stubs with deterministic ABI encoding + strict validation.
    - [x] Replace SVM mirror execute false-success stub with strict validation + explicit failure until runtime wiring exists.
    - [x] Implement deterministic BTC HTLC script builder + strict proof verification checks.
    - [x] Wire EVM/SVM mirror actions to runtime dispatch for end-to-end on-chain execution.

### P1 — Integration completeness

- [ ] **P1-1: External chain router payload correctness**
  - File: `crates/external-chains/src/router.rs`
  - Scope:
    - [x] Replace placeholder amount fields with encoded values in bridge/unwrap payloads.
    - [x] Add router unit tests confirming encoded amount words are present.

- [ ] **P1-2: External chain adapter defaults and chain-specific stubs**
  - Files:
    - `crates/external-chains/src/adapter.rs`
    - `crates/external-chains/src/chains/arbitrum.rs`
  - Scope:
    - [x] Remove placeholder contracts/defaults for production paths.
    - [x] Replace placeholder Arbitrum offset/L1 block logic with real behavior.
    - [x] Added focused regression tests for deterministic defaults and ABI layout.

- [ ] **P1-3: SVM runtime dispatch placeholders**
  - Files:
    - `crates/x3-bridge-adapters/src/lib.rs`
    - `crates/svm-integration/src/interp.rs`
  - Scope:
    - [x] Replace "echo success" dispatcher path with explicit execution-unavailable failure.
    - [x] Replace CPI stub-success syscall return with non-zero error code.
    - [x] Add regression coverage for CPI behavior.

### P2 — Economic correctness and ops

- [ ] **P2-1: Rollback refund accounting**
  - File: `crates/x3-atomic-trade/src/rollback_listener.rs`
  - Scope:
    - [x] Replace fixed refund increment with per-leg executed value accounting.
    - [x] Add input validation for duplicate legs and zero executed-leg values.
    - [x] Wire `crates/x3-atomic-trade` into workspace/package graph and run focused tests.

- [ ] **P2-2: Relayer registry and cross-chain event pipeline**
  - File: `pallets/x3-coin/src/cross_chain.rs`
  - Scope:
    - [x] Implement relayer registration/config/path discovery logic (storage-backed registry + filtering).
    - [x] Implement event processing + history retrieval logic (bounded per-chain history).
    - [x] Activate runtime-path relayer/event helpers in compiled pallet code (`lib.rs`) using storage-backed implementation.
    - [x] Consolidate/remove divergent dormant `cross_chain.rs` duplicate logic and module wiring debt.

---

## Execution Log

### 2026-03-22
- Created this tracker from the latest audit.
- Next immediate action: implement P0-1 proof verification wiring and tests.
- P0-2 progress: replaced fake hash with `sp_io::hashing::keccak_256` in `crates/x3-bridge/src/ibc_light_client.rs`.
- P0-1 progress: hardened x3-coin proof checks + added invalid-proof regression tests.
- P1-1 completed: replaced bridge/unwrap amount placeholders and validated with `cargo test -p x3-external-chains payload_includes_amount_word` (PASS).
- P1-2 completed: deterministic non-zero default contracts + Arbitrum ABI/RPC placeholder replacement.
- P1-2 verification:
  - `cargo test -p x3-external-chains test_default_contracts_are_non_zero_and_distinct` (PASS)
  - `cargo test -p x3-external-chains test_default_contracts_are_chain_specific` (PASS)
  - `cargo test -p x3-external-chains test_encode_send_l2_message_dynamic_bytes_layout` (PASS)
- P1-3 completed: removed fake-success SVM dispatcher/interpreter behavior.
- P1-3 verification:
  - `cargo test -p x3-bridge-adapters --lib` (PASS, 21/21)
  - `cargo test -p x3-svm-integration test_cpi_syscall_not_implemented_returns_error_code` (PASS)
- P0-3 progress: `pallets/x3-coin/src/cross_chain.rs` mirror/HTLC stubs replaced with deterministic logic and strict fail-fast behavior.
- P0-3 verification:
  - `cargo check -p pallet-x3-coin --lib` (PASS)
- P0-3 completion: `finalize_operation` now dispatches mirror actions by proof type via kernel adapters before final ledger finalization.
- P0-1 progress (deeper hooks):
  - `pallets/x3-coin/src/lib.rs` and `pallets/x3-coin/src/cross_chain.rs` now require a versioned `X3PF` finality envelope for EVM/SVM/BTC proofs and enforce chain-specific minimum confirmations.
  - Added low-confirmation rejection tests in `pallets/x3-coin/src/tests.rs` for EVM/SVM/BTC.
  - Validation: `cargo check -p pallet-x3-coin --lib` (PASS).
  - Note: focused `cargo test -p pallet-x3-coin ...` remains blocked by pre-existing `mock.rs` runtime drift in this repo (unrelated baseline issue).
- P0-2 progress (deterministic merkle verification):
  - `crates/x3-bridge/src/ibc_light_client.rs` now performs key-bound membership verification (`proof.key` must match expected key) for packet/state proofs.
  - Merkle root computation is now domain-separated and deterministic for leaf/internal hashing.
  - Added regression tests for packet/state key mismatch rejection.
  - Validation: file diagnostics clean + bridge-adjacent sanity compile `cargo check -p x3-bridge-adapters --lib` (PASS).
- P2-1 progress (rollback accounting):
  - `crates/x3-atomic-trade/src/rollback_listener.rs` now computes refund from explicit executed-leg values (`Vec<(leg_index, executed_value)>`) instead of fixed per-leg increments.
  - Added duplicate-leg and zero-value rejection checks to fail closed on malformed rollback accounting inputs.
  - Added/updated rollback listener tests for executed-leg summation and malformed inputs.
  - Validation status: edited file diagnostics clean; direct crate tests blocked because `crates/x3-atomic-trade` has source only (no `Cargo.toml` / not a workspace package).
- P2-2 progress (relayer + event pipeline):
  - Added pallet storage backing in `pallets/x3-coin/src/lib.rs`:
    - `RelayerRegistryStore`
    - `CrossChainEventHistoryStore`
  - Replaced TODOs in `pallets/x3-coin/src/cross_chain.rs` with:
    - relayer registration validation + persistence
    - relayer config retrieval
    - source/target operation path discovery
    - cross-chain event ingestion and bounded history retrieval
  - Added runtime-path helper APIs in compiled pallet path (`lib.rs`):
    - `register_relayer_config`
    - `get_relayer_config_entry`
    - `get_available_relayer_paths`
    - `process_cross_chain_event`
    - `get_cross_chain_event_history`
  - Consolidated `pallets/x3-coin/src/cross_chain.rs` into a compile-safe delegated module and wired it via `pub mod cross_chain;` in `lib.rs`.
  - Validation: `cargo check -p pallet-x3-coin --lib` (PASS).
- Packaging/testability unblock completed:
  - Added workspace packages:
    - `crates/x3-bridge/Cargo.toml`
    - `crates/x3-atomic-trade/Cargo.toml`
    - root `Cargo.toml` members updated
  - Fixed post-packaging compile blockers:
    - `crates/x3-bridge/src/wormhole_adapter.rs` payload amount parse fix
    - `crates/x3-bridge/src/bitcoin_htlc.rs` state tuple type alignment
    - `crates/x3-atomic-trade/src/rollback_listener.rs` malformed block repair + unicode enum cleanup + executed-leg rollback path restoration
    - `crates/x3-atomic-trade/src/swap_rpc.rs` deadline type comparison fix
  - Verification:
    - `cargo check -p x3-bridge --lib` (PASS)
    - `cargo check -p x3-atomic-trade --lib` (PASS)
    - `cargo test -p x3-bridge key_mismatch` (PASS, 2 tests)
    - `cargo test -p x3-atomic-trade initiate_rollback_sums_executed_leg_values` (PASS, 1 test)
