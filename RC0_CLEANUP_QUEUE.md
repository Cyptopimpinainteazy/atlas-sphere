# RC-0 Cleanup Queue — X3 Chain

**Scope:** Deletion / consolidation checklist tied to verified repository paths.
**Evidence basis:** Directory enumeration + `Cargo.toml` dependency graph walk + repo memory (GPU mock audit, atomic-swap adapter audit).
**Safety rule:** This is an *inventory* document. Nothing is deleted. Each item has a claim + evidence line + action.
**How to read status tags:**

- `DEAD` — zero consumers anywhere in `**/Cargo.toml` dep graph.
- `ORPHAN` — on disk but not a workspace member.
- `DUPLICATE` — real duplicate source/logic; canonical must be picked.
- `BACKUP` — `.bak` / draft artifact, mechanically safe to delete.
- `DEMOTE` — keep but strip to a thin wrapper per audit direction.
- `NAME-COLLISION` — looks like a duplicate by name but lives at a different layer (lib vs pallet vs runtime). NOT a duplicate — document the boundary only.

---

## 1. Dead Rust crates (zero consumers)

These crates exist on disk; nothing in any `Cargo.toml` depends on them. Safe to delete after one final reverse-dep sweep.

| # | Path | Status | Evidence | Action |
|---|---|---|---|---|
| 1.1 | [crates/x3-bridge/](crates/x3-bridge/) | DEAD | No `Cargo.toml` under the workspace lists `x3-bridge`. Not a workspace member. Contains 11 bridge source files (`bitcoin_htlc.rs`, `btc_spv.rs`, `ethereum_bridge.rs`, `wormhole_adapter.rs`, `ibc_light_client.rs`, `l2_bridge.rs`, `gas_relayer.rs`, `cross_chain_account.rs`, `cross_chain_proofs.rs`, `security_council.rs`, `lib.rs`) that duplicate what `crates/cross-vm-bridge/` + `crates/external-chains/` cover. | **Delete whole directory.** |
| 1.2 | [crates/x3-swap-router/](crates/x3-swap-router/) | DEAD | Not a workspace member. No consumers. `pub struct AtomicSwapRouter` duplicates `crates/external-chains/src/router.rs::SwapRouter`. | **Delete whole directory.** |
| 1.3 | [crates/cross-chain-gpu-validator/](crates/cross-chain-gpu-validator/) | DEAD (workspace member, no consumers) | Listed in `Cargo.toml` workspace members (line 90) but no other `Cargo.toml` depends on it. Contains `evm_validator.rs`, `svm_validator.rs`, `kernels.rs`, `orchestrator.rs`, `dashboard.rs`, `main.rs` — overlaps with `crates/x3-gpu-validator-swarm/`. | **Delete directory + remove workspace member entry.** |
| 1.4 | [crates/treasury/](crates/treasury/) | DEAD | Not a workspace member. `pallets/treasury/` is canonical (referenced by `runtime/Cargo.toml:53` as `pallet-treasury`). | **Delete directory.** |
| 1.5 | [pallets/x3-governance/](pallets/x3-governance/) | DEAD | Not a workspace member. `pallets/governance/` is canonical (referenced by `runtime/Cargo.toml:52` as `pallet-governance`, has `benchmarking.rs` + `migrations.rs` + `runtime_api.rs` + `weights.rs` — real runtime pallet). `pallets/x3-governance/` has only 4 plain files (`lib.rs`, `proposal_manager.rs`, `treasury.rs`, `voting_engine.rs`) and no FRAME plumbing. | **Delete directory.** |

---

## 2. Duplicate Python / orchestration validator trees

`cross-chain-gpu-validator/` at the repo root and `infra-structure/validator/` are near-identical copies of the same Python validator (same `pyproject.toml`, same `kernels/`, `dashboard/`, `Dockerfile.test`, `Dockerfile.testnet`, `INVARIANTS_REGISTRY_ENTRIES.toml`, `docker-compose.testnet.yml`, `start_gpu_lanes.sh`, `prometheus.yml`).

| # | Path | Status | Evidence | Action |
|---|---|---|---|---|
| 2.1 | [cross-chain-gpu-validator/](cross-chain-gpu-validator/) (repo root) | DUPLICATE | Mirror of `infra-structure/validator/`. Has `.pytest_cache/`, `todo-tree-…txt`, `.egg-info/` — clearly a working copy. | **Delete whole root-level directory.** Canonical path is `infra-structure/validator/`. |
| 2.2 | `infra-structure/validator/src/cross_chain_gpu_validator/gpu/kernels.py` | MOCK (per repo memory) | Repo memory (`/memories/repo/x3-chain.md`) records this as a Python stub that underpins the claimed GPU TPS numbers. | **Keep, but mark `# MOCK` in file header** until a real kernel replaces it. Do not delete (it is the only thing currently satisfying the Python import surface). |

---

## 3. Root-level Python / shell artifacts (scratch / blueprint files)

These are roadmap/blueprint scratch files checked into repo root. None are imported by any Rust or Python package.

| # | Path | Status | Action |
|---|---|---|---|
| 3.1 | [P4_DAY1_EXECUTION_BLUEPRINT.py](P4_DAY1_EXECUTION_BLUEPRINT.py) | DEAD | Delete. |
| 3.2 | [P4_DAY2_ACCELERATION_TEST.py](P4_DAY2_ACCELERATION_TEST.py) | DEAD | Delete. |
| 3.3 | [P4_DAY2-3_SIGVERIFIER_BLUEPRINT.py](P4_DAY2-3_SIGVERIFIER_BLUEPRINT.py) | DEAD | Delete. |
| 3.4 | [P4_DAYS5-8_GPU_EXECUTION_ROADMAP.py](P4_DAYS5-8_GPU_EXECUTION_ROADMAP.py) | DEAD | Delete. |
| 3.5 | [P4_DAYS9-12_TESTNET_SHIP_ROADMAP.py](P4_DAYS9-12_TESTNET_SHIP_ROADMAP.py) | DEAD | Delete. |
| 3.6 | [P5_CROSS_CHAIN_GPU_VALIDATOR_PROPOSAL.py](P5_CROSS_CHAIN_GPU_VALIDATOR_PROPOSAL.py) | DEAD | Delete. |
| 3.7 | [P5_VISUAL_ROADMAP.py](P5_VISUAL_ROADMAP.py) | DEAD | Delete. |
| 3.8 | [DEBUG_MODE_FULL.py](DEBUG_MODE_FULL.py) | DEAD | Delete. |
| 3.9 | [chainlink_vuln_scanner.py](chainlink_vuln_scanner.py) | DEAD | Delete (or move to `tools/` if ever actually used — currently unreferenced). |
| 3.10 | [mock_nvcc.sh](mock_nvcc.sh) | MOCK | Per repo memory, this shim writes an empty `.so` to satisfy GPU build paths. **Keep only if the build still requires it; otherwise delete and fix the build.** Flag, do not auto-delete. |
| 3.11 | [fix_all_errors.sh](fix_all_errors.sh) | SUSPECT | Delete unless someone claims ownership. |
| 3.12 | [fix_nvidia_driver.sh](fix_nvidia_driver.sh) | SUSPECT | Delete unless documented in an ops runbook. |
| 3.13 | [apply_audit_fixes.sh](apply_audit_fixes.sh) | SUSPECT | Delete. |

---

## 4. In-crate backup / draft files

| # | Path | Status | Action |
|---|---|---|---|
| 4.1 | [crates/cross-vm-coordinator/src/htlc.rs.bak](crates/cross-vm-coordinator/src/htlc.rs.bak) | BACKUP | **Delete.** `htlc.rs` is the live file. |

---

## 5. Duplicate Merkle settlement surfaces

Three files implement Merkle settlement in two crates. Per audit §4, canonical is **bridge-side** (`cross-vm-bridge`); coordinator keeps only orchestration.

| # | Path | Status | Action |
|---|---|---|---|
| 5.1 | [crates/cross-vm-bridge/src/merkle_settlement_bridge.rs](crates/cross-vm-bridge/src/merkle_settlement_bridge.rs) | CANONICAL | Keep. |
| 5.2 | [crates/cross-vm-bridge/src/merkle_proof_validator.rs](crates/cross-vm-bridge/src/merkle_proof_validator.rs) | CANONICAL (supporting) | Keep. |
| 5.3 | [crates/cross-vm-coordinator/src/merkle_settlement.rs](crates/cross-vm-coordinator/src/merkle_settlement.rs) | DUPLICATE | **Delete** — move any unique call-site hooks into `state_machine.rs`, then replace the import with `x3_cross_vm_bridge::merkle_settlement_bridge`. |
| 5.4 | [crates/cross-vm-coordinator/src/merkle_settlement_coordinator.rs](crates/cross-vm-coordinator/src/merkle_settlement_coordinator.rs) | DUPLICATE | **Delete** or collapse into a 1-file `coordinator::settlement` module that only wraps the bridge module. |

---

## 6. Duplicate optimizer passes in `x3-opt`

`crates/x3-opt/src/` has top-level pass files *and* a `passes/` subdirectory with the same logical passes. Audit B12.

| # | Path | Status | Action |
|---|---|---|---|
| 6.1 | [crates/x3-opt/src/dce.rs](crates/x3-opt/src/dce.rs) | DUPLICATE | Compare vs `src/passes/dead_code_elimination.rs`. Keep newer / more-tested. Merge unique helpers. |
| 6.2 | [crates/x3-opt/src/passes/dead_code_elimination.rs](crates/x3-opt/src/passes/dead_code_elimination.rs) | DUPLICATE | See 6.1. |
| 6.3 | [crates/x3-opt/src/edge_const_prop.rs](crates/x3-opt/src/edge_const_prop.rs) | DUPLICATE | Compare vs `src/passes/edge_const_prop.rs`. |
| 6.4 | [crates/x3-opt/src/passes/edge_const_prop.rs](crates/x3-opt/src/passes/edge_const_prop.rs) | DUPLICATE | See 6.3. |
| 6.5 | [crates/x3-opt/src/peephole_autogen.rs](crates/x3-opt/src/peephole_autogen.rs) | DUPLICATE | Compare vs `src/passes/peephole.rs`; `_autogen` suggests it is generated output that should not be hand-edited. Pick one or wire the generator. |
| 6.6 | [crates/x3-opt/src/passes/peephole.rs](crates/x3-opt/src/passes/peephole.rs) | DUPLICATE | See 6.5. |
| 6.7 | [crates/x3-opt/src/passes/pre.rs](crates/x3-opt/src/passes/pre.rs) + [pre_simple.rs](crates/x3-opt/src/passes/pre_simple.rs) | DUPLICATE | Two PRE implementations. Keep benchmarked one; delete the other. |
| 6.8 | [crates/x3-opt/src/run_yolo.rs](crates/x3-opt/src/run_yolo.rs) | SUSPECT | Name screams scratch file. Audit & delete if not on a bench path. |

---

## 7. GPU cluster — consolidate, do not delete

Per repo memory (`/memories/repo/x3-chain.md`), all GPU backends currently return CPU Blake3 hashes. The named-3M-TPS figures are mock. This section describes **role boundaries**, not deletions.

| # | Path | Role in RC-0 | Action |
|---|---|---|---|
| 7.1 | [crates/x3-gpu-validator-swarm/](crates/x3-gpu-validator-swarm/) | Canonical **validator process** (has `orchestrator.rs`, `multi_gpu_dispatcher.rs`, `gpu_receipt.rs`, `state_merkle_proof.rs`, `unified_proof.rs`). | Keep. Mark every function that still calls blake3 on CPU with `// MOCK: real GPU path pending`. |
| 7.2 | [crates/gpu-sig-verifier/](crates/gpu-sig-verifier/) | Canonical **signature-verify library** (used by `import-queue-wrapper`). | Keep. Single `lib.rs`. |
| 7.3 | [crates/gpu-swarm/](crates/gpu-swarm/) | DePIN / marketplace layer (admin UI, billing, announcer, wallet, funding, sandbox manager). Distinct concern from validator. | Demote to DePIN-only. Strip any "I am a validator" paths — those move to x3-gpu-validator-swarm. |
| 7.4 | [crates/cross-chain-gpu-validator/](crates/cross-chain-gpu-validator/) | See §1.3 — DEAD. | Delete. |
| 7.5 | [cross-chain-gpu-validator/](cross-chain-gpu-validator/) (root) | See §2.1 — DUPLICATE. | Delete. |
| 7.6 | [infra-structure/validator/](infra-structure/validator/) | Python validator / smoke-test harness. | Keep. Canonical Python tree. |

---

## 8. Atomic-swap surface — consolidate, do not delete

Per repo memory: `atomic-swap-sdk` (EVM/Solana/Substrate/Bitcoin HTLC adapters) is real; `cross-vm-coordinator` owns the durable `SwapCoordinator`.

| # | Path | Role | Action |
|---|---|---|---|
| 8.1 | [crates/cross-vm-coordinator/](crates/cross-vm-coordinator/) | Canonical orchestrator (state machine, persistence, relayer, rpc_client, flashloan adapter). | Keep. Clean `htlc.rs.bak` (§4.1) + merge merkle dupes (§5). |
| 8.2 | [crates/atomic-swap-orchestrator/](crates/atomic-swap-orchestrator/) | Thin outer layer (`atomic_lock.rs`, `lib.rs`). | **DEMOTE** to thin wrapper that delegates to `cross-vm-coordinator`. Do not delete — it is a `node` + `x3-bot` dep. |
| 8.3 | [crates/x3-atomic-client/](crates/x3-atomic-client/) | Keep. | Keep. |
| 8.4 | [crates/x3-atomic-trade/](crates/x3-atomic-trade/) | Keep. | Keep. |
| 8.5 | [pallets/x3-atomic-kernel/](pallets/x3-atomic-kernel/) | Keep. On-chain. | Keep. |
| 8.6 | [pallets/atomic-trade-engine/](pallets/atomic-trade-engine/) | Keep. On-chain. | Keep. |

---

## 9. Bridge routers — which crate wins

| # | Path | Status | Action |
|---|---|---|---|
| 9.1 | [crates/cross-vm-bridge/](crates/cross-vm-bridge/) | CANONICAL (used by `node`, `runtime`, `pallet-x3-kernel`, `external-chains`, `x3-bridge-adapters`). | Keep. |
| 9.2 | [crates/x3-bridge-adapters/](crates/x3-bridge-adapters/) | CANONICAL (`SubstrateClientBalanceAdapter`, `PalletEscrowAdapter`). | Keep. |
| 9.3 | [crates/external-chains/](crates/external-chains/) | THIN (only `cross-chain-position-manager` depends on it). `SwapRouter` + per-chain adapters + `RpcRegistry`. | Keep as the single external-chain surface. Ensure runtime/bridge actually call it — otherwise it is wasted code. Track under RC-1 wiring, not RC-0 deletion. |
| 9.4 | [crates/x3-bridge/](crates/x3-bridge/) | DEAD | See §1.1. |
| 9.5 | [crates/x3-swap-router/](crates/x3-swap-router/) | DEAD | See §1.2. |

---

## 10. Name collisions (NOT duplicates — document the boundary)

These pairs look like duplicates but live at different layers. Do **not** delete either; add a top-of-file comment pointing at the other so future readers do not confuse them.

| # | Pair | Boundary |
|---|---|---|
| 10.1 | [crates/x3-verifier/](crates/x3-verifier/) ↔ [pallets/x3-verifier/](pallets/x3-verifier/) | `crates/x3-verifier` = X3-lang **compiler/IR verifier** (used by `x3-compiler`, `x3-evolution`, `x3-integration`). `pallets/x3-verifier` = **runtime pallet** that verifies on-chain proofs (used by `node` + `runtime`). Both canonical. |
| 10.2 | [crates/x3-slash/](crates/x3-slash/) ↔ [pallets/x3-slash/](pallets/x3-slash/) | `crates/x3-slash` = **shared slash types library** (used by `x3-flashloan`, `x3-court`, `x3-intent`, `x3-agent`, and **by the pallet itself** via `pallets/x3-slash/Cargo.toml:19`). `pallets/x3-slash` = runtime pallet wrapping the library. Both canonical. |
| 10.3 | [pallets/treasury/](pallets/treasury/) ↔ [pallets/x3-treasury-policy/](pallets/x3-treasury-policy/) | `pallets/treasury` = standard treasury (used by `runtime`). `pallets/x3-treasury-policy` = policy/guard pallet (used by `pallets/x3-rebalance`). Distinct roles. Keep both. |

---

## 11. Workspace-member hygiene

Cross-check between `/Cargo.toml` `[workspace].members` and on-disk crates. After §1–§2 deletions, also remove these workspace lines:

| # | Line to remove from [Cargo.toml](Cargo.toml) | Reason |
|---|---|---|
| 11.1 | `"crates/cross-chain-gpu-validator",` | See §1.3. |

All other DEAD crates in §1 are already *not* workspace members — deleting the directories is sufficient.

---

## 12. Execution order (recommended, non-destructive first)

1. **Snapshot only** (RC-0a):
   - Run `cargo check --workspace` → save log as baseline.
   - Run `rg --files-without-match . -g '!target' | grep -E '\.(rs|py|sh)$'` for a size baseline.
2. **Mechanical deletions** (RC-0b) — no code logic changes:
   - §4 `.bak` files (1 file).
   - §3 root scratch files (11 files, keep `mock_nvcc.sh` flagged).
   - §2.1 root-level duplicated Python validator tree.
3. **Dead-crate deletions** (RC-0c):
   - §1.1, §1.2, §1.4, §1.5 (no workspace edit needed).
   - §1.3 (also edit `Cargo.toml` per §11.1).
4. **Duplicate merges** (RC-0d — requires real code review per file):
   - §5 Merkle settlement dedup.
   - §6 x3-opt pass dedup.
5. **Re-run** `cargo check --workspace` after each of steps 2–4. Any regression means the "dead" label was wrong; stop and re-audit.
6. **Demotions** (§8.2 atomic-swap-orchestrator, §7.3 gpu-swarm) are logic changes, not RC-0. Move to RC-1.

---

## 13. What this document does NOT do

- It does **not** delete anything.
- It does **not** fix the GPU mock — that is an RC-1 item once the dead weight is off the tree.
- It does **not** judge whether `external-chains` is actually wired into the hot bridge path; that goes in the RC-1 "missing wiring" sweep.
- It does **not** touch `pallets/x3-sequencer/`, `pallets/x3-da/`, `pallets/fraud-proofs/` etc. — those were not flagged as duplicates.

---

**Estimated disk / LoC impact after RC-0a + RC-0b + RC-0c:**
- Directories removed: 5 Rust crates + 1 duplicated Python tree + 1 `.bak` + 11 root scripts.
- Workspace members removed: 1.
- No production build-graph change expected (all items have zero consumers).
