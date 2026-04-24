# X3 LaunchOps Verify Report

## Overall Status

**BLOCKED**

## Command Results

| Command | Status | Exit | Duration |
|---|---|---:|---:|
| `cargo audit` | Failed | 101 | 28 ms |
| `cargo check --workspace --all-targets` | Failed | 101 | 13628 ms |
| `cargo clippy --workspace --all-targets -- -D warnings` | Failed | 101 | 10605 ms |
| `cargo deny check` | Failed | 5 | 6127 ms |
| `cargo fmt --all -- --check` | Failed | 1 | 2390 ms |
| `cargo test --workspace --no-fail-fast` | Failed | 101 | 10547 ms |

## Gates

| Gate | Status | Required | Source | Reason |
|---|---|:-:|---|---|
| Bridge Replay Tests | PASS | yes | source:feature_matrix:bridge | - |
| Clippy Clean | FAIL | yes | command:cargo_clippy | cargo clippy --workspace --all-targets -- -D warnings exited with Some(101) |
| Cross Vm Atomic Tests | PASS | yes | source:feature_matrix:cross_vm | - |
| Dex Liquidity Lock Tests | PASS | yes | source:feature_matrix:dex | - |
| Formatting Clean | FAIL | yes | command:cargo_fmt | cargo fmt --all -- --check exited with Some(1) |
| No P0 Blockers | PASS | yes | source:blockers | - |
| No Production Stubs | FAIL | yes | source:red_flags | 227 critical red flags in production code |
| Workspace Compiles | FAIL | yes | command:cargo_check | cargo check --workspace --all-targets exited with Some(101) |
| Workspace Tests Pass | FAIL | yes | command:cargo_test | cargo test --workspace --no-fail-fast exited with Some(101) |

## Top Red Flags

- **Critical** `crates/atomic-swap-orchestrator/src/lib.rs:621` [unwrap()] — Unsafe unwrap in production code
- **Critical** `crates/atomic-swap-orchestrator/src/lib.rs:652` [unwrap()] — Unsafe unwrap in production code
- **Critical** `crates/atomic-swap-orchestrator/src/lib.rs:791` [unwrap()] — Unsafe unwrap in production code
- **Critical** `crates/atomic-swap-orchestrator/src/lib.rs:800` [unwrap()] — Unsafe unwrap in production code
- **Critical** `crates/atomic-swap-orchestrator/src/lib.rs:901` [unwrap()] — Unsafe unwrap in production code
- **Critical** `crates/cross-chain-gpu-validator/src/evm_validator.rs:125` [unwrap()] — Unsafe unwrap in production code
- **Critical** `crates/cross-chain-gpu-validator/src/evm_validator.rs:138` [unwrap()] — Unsafe unwrap in production code
- **Critical** `crates/cross-chain-gpu-validator/src/evm_validator.rs:147` [unwrap()] — Unsafe unwrap in production code
- **Critical** `crates/cross-chain-gpu-validator/src/evm_validator.rs:157` [unwrap()] — Unsafe unwrap in production code
- **Critical** `crates/cross-chain-gpu-validator/src/failover.rs:126` [unwrap()] — Unsafe unwrap in production code
- **Critical** `crates/cross-chain-gpu-validator/src/failover.rs:135` [unwrap()] — Unsafe unwrap in production code
- **Critical** `crates/cross-chain-gpu-validator/src/kernels.rs:170` [unwrap()] — Unsafe unwrap in production code
- **Critical** `crates/cross-chain-gpu-validator/src/kernels.rs:178` [unwrap()] — Unsafe unwrap in production code
- **Critical** `crates/cross-chain-gpu-validator/src/kernels.rs:203` [unwrap()] — Unsafe unwrap in production code
- **Critical** `crates/cross-chain-gpu-validator/src/svm_validator.rs:110` [unwrap()] — Unsafe unwrap in production code
- **Critical** `crates/cross-chain-gpu-validator/src/svm_validator.rs:123` [unwrap()] — Unsafe unwrap in production code
- **Critical** `crates/cross-chain-gpu-validator/src/svm_validator.rs:137` [unwrap()] — Unsafe unwrap in production code
- **Critical** `crates/cross-chain-gpu-validator/src/svm_validator.rs:146` [unwrap()] — Unsafe unwrap in production code
- **Critical** `crates/cross-vm-bridge/src/canonical.rs:412` [unwrap()] — Unsafe unwrap in production code
- **Critical** `crates/cross-vm-bridge/src/lib.rs:2585` [unwrap()] — Unsafe unwrap in production code
- **Critical** `crates/cross-vm-bridge/src/lib.rs:2600` [unwrap()] — Unsafe unwrap in production code
- **Critical** `crates/cross-vm-bridge/src/lib.rs:2601` [unwrap()] — Unsafe unwrap in production code
- **Critical** `crates/cross-vm-bridge/src/lib.rs:2621` [unwrap()] — Unsafe unwrap in production code
- **Critical** `crates/cross-vm-bridge/src/lib.rs:2651` [unwrap()] — Unsafe unwrap in production code
- **Critical** `crates/cross-vm-bridge/src/lib.rs:2653` [unwrap()] — Unsafe unwrap in production code
- **Critical** `crates/cross-vm-bridge/src/lib.rs:2672` [unwrap()] — Unsafe unwrap in production code
- **Critical** `crates/cross-vm-bridge/src/lib.rs:2674` [unwrap()] — Unsafe unwrap in production code
- **Critical** `crates/cross-vm-bridge/src/lib.rs:2691` [unwrap()] — Unsafe unwrap in production code
- **Critical** `crates/cross-vm-bridge/src/lib.rs:2693` [unwrap()] — Unsafe unwrap in production code
- **Critical** `crates/cross-vm-bridge/src/lib.rs:2703` [unwrap()] — Unsafe unwrap in production code

## Multipliers

- command: 0.50
- gate: 0.55
- red_flag: 0.50
