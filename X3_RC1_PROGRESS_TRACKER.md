# RC-1 Progress Tracker

**Status:** Not Started  
**Current Phase:** —  
**Last Updated:** 2026-04-20 10:35 UTC  

---

## Phase Completion Matrix

| Phase | Status | Subtasks | Blocker? | Owner | ETA |
|-------|--------|----------|----------|-------|-----|
| **1** GPU Validator → node/service.rs | ⬜ 0% | 3 | No | — | — |
| **2** GpuValidatorApi runtime_api | ⬜ 0% | 3 | Phase 1 | — | — |
| **3** Cross-chain GPU Validator | ⬜ 0% | 3 | Phase 2 | — | — |
| **4** Cross-VM Bridge binding | ⬜ 0% | 3 | None | — | — |
| **5** External Chains Router config | ⬜ 0% | 3 | None | — | — |
| **6** X3 Relayer (NEW) | ⬜ 0% | 4 | Phase 5 | — | — |
| **7** Remaining gaps (5–12) | ⬜ 0% | 8 items | Phase 4 | — | — |
| **8** Zombienet integration | ⬜ 0% | 5 | All phases | — | — |

---

## Phase 1: GPU Validator → node/service.rs

### ⬜ 1.1 Add GPU Validator Feature & Dependencies
- [ ] `node/Cargo.toml` — add `x3-gpu-validator-swarm` + `gpu-sig-verifier` optional dependencies
- [ ] Create `gpu-validator` feature gate
- **Status:** Not started  
- **Checklist Link:** [§Phase 1.1](X3_RC1_WIRING_PLAN.md#11-add-gpu-validator-feature--dependencies)

### ⬜ 1.2 Modify node/src/service.rs
- [ ] Add `NodeFeatureFlags::gpu_validator_enabled` to config struct
- [ ] Spawn `SwarmOrchestrator` task if flag set
- [ ] Wire into `TaskManager::spawn_essential()`
- **Status:** Not started  
- **Checklist Link:** [§Phase 1.2](X3_RC1_WIRING_PLAN.md#12-modify-nodesrcservicers)

### ⬜ 1.3 Expose gRPC Endpoints
- [ ] `node/src/rpc.rs` — add `gpu_validator_health` method
- [ ] Add `gpu_validator_metrics` method  
- [ ] Return SwarmMetrics as JSON
- **Status:** Not started  
- **Checklist Link:** [§Phase 1.3](X3_RC1_WIRING_PLAN.md#13-expose-grpc-endpoints)

### ✅ Phase 1 Success Criteria
- [ ] `cargo build --features=gpu-validator` succeeds
- [ ] `./x3-chain-node --gpu-validator` spawns orchestrator without panic
- [ ] gRPC endpoints respond to health/metrics queries

---

## Phase 2: GpuValidatorApi runtime_api

### ⬜ 2.1 Define GpuValidatorApi
- [ ] Create `pallets/x3-verifier/src/runtime_api.rs`
- [ ] Declare `submit_gpu_validator_proof()` extrinsic
- [ ] Declare `gpu_validator_status()` query
- [ ] Define `GpuValidatorStatus` struct
- **Status:** Not started  

### ⬜ 2.2 Implement GpuValidatorApi in Runtime
- [ ] `runtime/src/lib.rs` — add impl block for GpuValidatorApi
- [ ] Call `pallet-x3-verifier::verify_gpu_proof`
- [ ] Return proof hash on success
- **Status:** Not started  

### ⬜ 2.3 Add Runtime API Handler to Pallet
- [ ] `pallets/x3-verifier/src/lib.rs` — add `verify_gpu_proof` extrinsic
- [ ] Verify aggregate signature
- [ ] Verify validator set
- [ ] Store proof + emit event
- **Status:** Not started  

### ✅ Phase 2 Success Criteria
- [ ] `cargo build --release` succeeds
- [ ] `cargo test -p pallet-x3-verifier` passes
- [ ] GPU validator can call `submit_gpu_validator_proof` via runtime API

---

## Phase 3: Cross-chain GPU Validator

### ⬜ 3.1 Add External Root Handler
- [ ] `pallets/x3-verifier/src/lib.rs` — add `submit_external_root` extrinsic
- [ ] Verify state root proof
- [ ] Store external root in storage map
- [ ] Award reward to submitter
- **Status:** Not started  

### ⬜ 3.2 Wire cross-chain-gpu-validator to Submit
- [ ] `crates/cross-chain-gpu-validator/src/lib.rs` — add EVM/SVM validators
- [ ] Implement `validate_and_submit_evm()` method
- [ ] Call runtime API `submit_external_root`
- **Status:** Not started  

### ⬜ 3.3 Implement Failover
- [ ] `crates/cross-chain-gpu-validator/src/failover.rs` — complete `FailoverManager`
- [ ] Implement `fallback_to_cpu()` method
- [ ] Implement `trigger_quarantine()` with metrics
- **Status:** Not started  

### ✅ Phase 3 Success Criteria
- [ ] `cargo test -p cross-chain-gpu-validator` passes with failover tests
- [ ] GPU/CPU validation results match in test suite
- [ ] Quarantine triggers on divergence detection
- [ ] CPU fallback produces correct results

---

## Phase 4: Cross-VM Bridge binding

### ⬜ 4.1 Implement RuntimeCrossVmDispatcher
- [ ] `pallets/x3-kernel/src/adapters.rs` — add dispatcher struct
- [ ] Implement `dispatch_cross_vm_call()` method
- [ ] Add replay nonce protection
- [ ] Store proof + emit event
- **Status:** Not started  

### ⬜ 4.2 Add WASM Call Interface
- [ ] `pallets/x3-kernel/src/wasm_adapters.rs` — add `WasmCrossVmDispatcher`
- [ ] Implement `wasm_call_into_evm()` hostcall
- [ ] Implement `wasm_call_into_svm()` hostcall
- **Status:** Not started  

### ⬜ 4.3 Register in pallet-x3-settlement-engine
- [ ] `pallets/x3-settlement-engine/src/lib.rs` — add `settle_merkle_proof` extrinsic
- [ ] Verify Merkle proof
- [ ] Store settlement + emit event
- **Status:** Not started  

### ✅ Phase 4 Success Criteria
- [ ] Cross-VM call dispatch compiles
- [ ] Replay nonce verification works in tests
- [ ] Merkle proof settlement stores correctly
- [ ] WASM bridge calls execute without error

---

## Phase 5: External Chains Router config

### ⬜ 5.1 Create Chain Registry Config Builder
- [ ] `crates/external-chains/src/lib.rs` — define `ChainRegistry` struct
- [ ] Add `ChainConfig` struct with 60+ chains
- [ ] Implement `find_chain()` and `find_by_name()` methods
- [ ] Add mainnet/testnet presets
- **Status:** Not started  

### ⬜ 5.2 Wire into Runtime Config
- [ ] `runtime/src/lib.rs` — expose `X3_CHAIN_REGISTRY` constant
- [ ] Make registry immutable global
- **Status:** Not started  

### ⬜ 5.3 Expose in Chain Spec
- [ ] `node/src/chain_spec.rs` — add registry to `ChainSpecConfig`
- [ ] Load registry in `development_config()`
- [ ] Pass to `testnet_genesis()`
- **Status:** Not started  

### ✅ Phase 5 Success Criteria
- [ ] `node/src/chain_spec.rs` compiles with registry
- [ ] `./x3-chain-node --dev` starts with registry loaded
- [ ] RPC query can list all 60+ chains
- [ ] Relayer can access registry statically

---

## Phase 6: X3 Relayer (NEW)

### ⬜ 6.1 Core Relayer Skeleton
- [ ] Create `crates/x3-relayer/Cargo.toml`
- [ ] Create `crates/x3-relayer/src/lib.rs` with `X3Relayer` struct
- [ ] Implement `run()` main loop
- [ ] Implement `sync_chain()` method
- [ ] Implement `submit_external_root()` RPC call
- **Status:** Not started  

### ⬜ 6.2 Binary Entry Point
- [ ] Create `crates/x3-relayer/src/main.rs`
- [ ] Parse CLI args (x3-rpc, config, poll-interval)
- [ ] Load chain registry
- [ ] Create relayer and start main loop
- **Status:** Not started  

### ⬜ 6.3 Header Sync Module
- [ ] Create `crates/x3-relayer/src/header_sync.rs`
- [ ] Implement `fetch_block_header()` via HTTP RPC
- [ ] Parse Ethereum/Solana block headers
- **Status:** Not started  

### ⬜ 6.4 Proof Aggregation Module
- [ ] Create `crates/x3-relayer/src/proof_aggregator.rs`
- [ ] Implement proof collection from validators
- [ ] Aggregate signatures (if needed)
- **Status:** Not started  

### ✅ Phase 6 Success Criteria
- [ ] `cargo build -p x3-relayer` succeeds
- [ ] `./x3-relayer --x3-rpc=ws://localhost:9944` starts without panic
- [ ] Relayer syncs Ethereum testnet headers
- [ ] Submits proofs to local X3 testnet

---

## Phase 7: Remaining gaps (§3 items 5–12)

### ⬜ 7.1 Data Availability (Item 5)
- [ ] `crates/x3-da` + `pallets/x3-da` — wire block import verification
- **Est:** 2 days | **Status:** Not started  

### ⬜ 7.2 Flash Finality (Item 6)
- [ ] `crates/flash-finality` — register gossip handler
- [ ] `node/src/flash_finality.rs` — confirm subsystem startup
- **Est:** 1 day | **Status:** Not started  

### ⬜ 7.3 Parallel Proposer (Item 7)
- [ ] `crates/parallel-proposer` → `x3-consensus/parallel_proposer.rs`
- [ ] Expose limit via runtime params
- **Est:** 2 days | **Status:** Not started  

### ⬜ 7.4 PoH Generator + Turbine (Item 8)
- [ ] `crates/poh-generator` + `x3-turbine` → block authoring pipeline
- **Est:** 2 days | **Status:** Not started  

### ⬜ 7.5 Quantum Crypto (Item 9)
- [ ] Feature gate + rotation API in `pallet-governance`
- **Est:** 1 day | **Status:** Not started  

### ⬜ 7.6 Custody Service (Item 10)
- [ ] Replace in-process signers with HSM-backed `crates/custody-service`
- **Est:** 3 days | **Status:** Not started  

### ⬜ 7.7 Gateway/Sidecar/Indexer (Item 11)
- [ ] Verify `runtime_api` surface compatibility
- [ ] Add migrations (e.g., `0005_vote_window_tally.sql`)
- **Est:** 2 days | **Status:** Not started  

### ⬜ 7.8 Launch Validator Checks (Item 12)
- [ ] Turn `crates/x3-launch-validator/checks.rs` into CI gate
- **Est:** 1 day | **Status:** Not started  

---

## Phase 8: Zombienet Integration Test

### ⬜ 8.1 Setup Scenario
- [ ] Start 4-validator zombienet
- [ ] Start 1 GPU validator node
- [ ] Start 1 relayer to goerli
- [ ] Start 1 relayer to Solana devnet
- **Status:** Not started  

### ⬜ 8.2 Deposit Test
- [ ] Send ERC-20 to X3 Gateway on Ethereum
- [ ] Verify mint on X3 chain
- **Status:** Not started  

### ⬜ 8.3 Cross-VM Swap Test
- [ ] Execute MEV-protected swap (EVM → SVM call)
- [ ] Verify state updates on both sides
- **Status:** Not started  

### ⬜ 8.4 Withdraw Test
- [ ] Burn X3 token
- [ ] Claim on Ethereum
- **Status:** Not started  

### ⬜ 8.5 Verification
- [ ] Verify all state roots match
- [ ] Check no GPU/CPU divergence occurred
- [ ] Confirm metrics show success
- **Status:** Not started  

---

## Build & Test Status

| Target | Status | Last Check |
|--------|--------|-----------|
| `cargo fmt --check` | ✅ Pass | 2026-04-20 10:35 |
| `cargo clippy --workspace -- -D warnings` | ⚠️ TBD | — |
| `cargo test --workspace` | ⚠️ TBD | — |
| `cargo dylint --workspace` | ⚠️ TBD | — |
| `cargo deny check` | ⚠️ TBD | — |
| `cargo audit` | ⚠️ TBD | — |

---

## Notes & Blockers

### Current Blockers
- None — RC-0 cleanup successfully completed

### Known Issues
- Solana version mismatch (1.88 vs 1.89) affects some crates — pre-existing, not RC-1 related
- GPU CUDA kernels require NVIDIA driver + CUDA toolkit on build system

### Dependencies
- Phase 1 must complete before Phase 2
- Phase 5 must be started before Phase 6 relayer
- All Phases 1–7 must complete before Phase 8

---

## Estimated Timeline

| Week | Focus | Phases |
|------|-------|--------|
| Week 1 | GPU validator wiring | 1–2 |
| Week 2 | GPU + Cross-VM integration | 3–4 + start 5–6 |
| Week 3 | Relayer + early gaps | 5–6 finish + 7.1–4 |
| Week 4 | Final gaps + integration | 7.5–8 + Phase 8 |

**Total EST:** 3–4 weeks (with parallelization)

---

## Artifacts Generated

- ✅ [X3_RC1_WIRING_PLAN.md](X3_RC1_WIRING_PLAN.md) — full phase specs + code templates
- ✅ [X3_RC1_PROGRESS_TRACKER.md](X3_RC1_PROGRESS_TRACKER.md) — this file
- 📋 (TBD) Phase 1 implementation branch
- 📋 (TBD) Phase 2 runtime API branch
- ... etc.

