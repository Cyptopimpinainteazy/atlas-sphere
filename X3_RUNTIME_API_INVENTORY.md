# X3 Runtime API Inventory & Freeze (Phase 11)

**Status:** RC-1 Phase 11 — Generated-contract handoff  
**Date:** April 22, 2026  
**Scope:** Keep the runtime API inventory anchored to LaunchOps-generated artifacts instead of a hand-maintained trait catalog.

---

## Contract Source

This document is no longer the canonical runtime API inventory. The canonical runtime contract surface now comes from LaunchOps and is generated from live code into `.launchops/runtime_rpc_inventory.json`. That artifact is emitted from `runtime/src/lib.rs` and paired with `.launchops/rpc_contract_matrix.json` and `.launchops/rpc_contract_matrix.md` so the runtime trait inventory and node RPC contract map stay tied to the same scan.

Refresh the contract pack with `cargo run -p launchops -- inventory-contracts && cargo run -p launchops -- validate-contract`. The inventory step parses the live runtime and RPC source files, emits the machine-readable trait and method inventory, and publishes the result through the LaunchOps artifact manifest. The validation step checks the generated JSON and markdown artifacts against the declared schema contract so drift becomes a CI failure instead of a documentation cleanup task.

The current generated snapshot reports 54 runtime trait impl blocks in `runtime/src/lib.rs`. That number includes both configuration impls and callable runtime API surfaces. Consumers that need callable APIs should filter on entries with non-empty `methods` arrays in the generated artifact rather than relying on a hand-maintained doc excerpt.

## Freeze Interpretation

This file remains a freeze-readiness note, not the inventory itself. Freeze work should use the generated artifact to answer three questions: which runtime API traits actually expose callable methods, which methods are paired to live RPC consumers through the generated contract matrix, and which traits still exist only as implementation scaffolding or feature-gated surfaces without a stable external consumer path.

The generated output is intentionally narrower than a narrative architecture document. It records trait names, source locations, optional cfg guards, and per-method line references. Decisions about whether a trait is stable, provisional, release-gated, or removable should be made from that generated inventory plus the generated RPC bucket matrix, not from another copied list of methods in markdown.

## What Stays Here

This document should explain how the runtime inventory is produced and how to interpret it during release hardening. It should not grow another static runtime trait table. If a reviewer needs the live trait list, callable methods, cfg guards, or line references, the correct source is `.launchops/runtime_rpc_inventory.json`, with `.launchops/rpc_contract_matrix.json` used to understand which of those runtime methods are actually projected into the current node RPC surface.

---

### 4.2 Settlement Finality API

**Trait:** `gpu_validator_api::SettlementFinalityApi<Block>`  
**Location:** `runtime/src/lib.rs:194` (declaration), `2978` (implementation)  
**Owner:** Settlement finality engine  
**Responsibility:** Validator attestation aggregation, finality threshold tracking

**Methods:**
- `query_finality_metrics() -> FinalityMetrics` — Confirmations pending, threshold percentage, timeout blocks remaining
- `query_validator_reputation(validator_id: AccountId) -> ReputationScore` — Slashing history for reputation-based weighting
- (Additional methods inferred from usage at line 3535, 3547, 3553)

**Consumers:**
- Relayer (finality confirmation before settlement)
- Gateway API (finality status queries)
- Indexer (finality state tracking)

**Status:** ✅ **KEEP** — Required for finality confirmation tracking

**Finality Thresholds:**
- EVM: 12 block confirmations (~3 minutes)
- SVM (Solana): 32 confirmations (~12.8 seconds)
- X3: 1 confirmation (200ms flash finality)

---

## Part 5: GPU Validator API

### 5.1 GPU Validator Runtime API

**Trait:** `gpu_validator_api::GpuValidatorRuntimeApi<Block>`  
**Location:** `runtime/src/lib.rs:140` (declaration), `2686` (implementation)  
**Owner:** `gpu-validator` crate  
**Responsibility:** GPU validator orchestration and health monitoring

**Methods:**
- `gpu_validator_status(validator_id: u32) -> Option<GpuValidatorStatus>` — Individual validator status (operational, offline, slashed)
- `query_orchestrator_health() -> OrchestratorHealthStatus` — Aggregated orchestrator metrics (CPU, GPU memory, proof throughput)
- `submit_gpu_validator_proof(proof: Vec<u8>, validator_id: u32) -> GpuProofResult` — Accept GPU-generated merkle or fraud proofs

**Consumers:**
- RPC: `gpu_status`, `orchestratorHealth` (validator monitoring)
- Node telemetry (orchestrator health dashboards)
- Indexer (validator status changes)

**Status:** ✅ **KEEP** — Required for GPU validator orchestration

---

## Part 6: RPC Surface Mapping

The node exposes **29 JSON-RPC methods**. Below are the phase-critical ones:

### Governance & Settlement RPC

| RPC Method | Backing API | Impl Location | Phase | Status |
|-----------|-------------|----------------|-------|--------|
| `submitDispute` | GovernanceSettlementApi::submit_dispute | node/src/rpc.rs:298 | 10a | ✅ FROZEN |
| `queryDisputeStatus` | GovernanceSettlementApi::query_dispute_status | node/src/rpc.rs:336 | 10a | ✅ FROZEN |
| `queryProofFinality` | GovernanceSettlementApi::confirm_settlement_finality | node/src/rpc.rs:377 | 10a | ⚠️ PROVISIONAL |
| `requestProofChallenge` | No live runtime-backed challenge execution yet; structural RPC placeholder only | node/src/rpc.rs:414 | 10a | ⚠️ PROVISIONAL |

### Wallet & Cross-VM RPC

| RPC Method | Backing API | Owner | Status |
|-----------|-------------|-------|--------|
| `x3_submitCrossVmTransaction` | AtlasKernelRuntimeApi::submit_evm_transaction for the EVM leg plus node-local CrossVmBridge queueing for optional SVM | cross-VM RPC path | ⚠️ PROVISIONAL |
| `x3_submitSvmTransaction` | Node-local CrossVmBridge queueing only in this build | cross-VM RPC path | ⚠️ PROVISIONAL |
| `x3_submitX3vmTransaction` | No live execution path; RPC returns a guidance error | x3vm placeholder | ❌ NOT AVAILABLE |
| `x3_getAssetMetadata` | AtlasKernelRuntimeApi::get_asset_metadata | kernel asset registry | ✅ ACTIVE |
| `x3_estimateGas` | AtlasKernelRuntimeApi::estimate_evm_gas | kernel EVM helper | ✅ ACTIVE |

---

## Part 7: API Removal Candidates

Based on inventory, candidates for consolidation or removal:

### 7.1 Duplicate Trait Declarations

Lines 3245 and 3261 declare `GovernanceSettlementApi` and `SettlementFinalityApi` again outside the main `sp_api::decl_runtime_apis!` block. 

**Status:** ⚠️ **AUDIT REQUIRED** — Verify if these are:
- Duplicate declarations for compatibility (bad practice)
- Separate trait definitions with different method signatures
- Test/mock versions

**Action:** Remove duplicates or document reason for separation.

---

## Part 8: Versioning Policy

Once frozen, runtime API changes follow this policy:

### Version Bumping Rules

1. **Bug fixes in implementation** → No version bump (transparent)
2. **Adding optional methods** → MINOR version bump
3. **Removing/renaming methods** → MAJOR version bump
4. **Changing method signatures** → MAJOR version bump
5. **Changing return types** → MAJOR version bump

### Client Compatibility

- Clients must specify minimum runtime version they support
- Sidecar/Gateway must handle version mismatch gracefully
- Indexer subscribes to `RuntimeUpgraded` pallet events to detect version changes

---

## Part 9: Freeze Checklist

**Before RC-2 audit, complete all items:**

- [ ] Audit CrossChainStateRootApi implementation (line 2734) — Is it used or dead code?
- [ ] Remove or document duplicate GovernanceSettlementApi/SettlementFinalityApi declarations (lines 3245, 3261)
- [ ] Add comprehensive integration tests for all 13 runtime APIs
- [ ] Document downstream consumer requirements for each API
- [ ] Implement API versioning support in node RPC handlers
- [ ] Update sidecar/gateway to support all frozen APIs
- [ ] Add runtime API change detection to CI/CD gates
- [ ] Sign off on canonical API surface with architecture review

---

## Part 10: Rollout Plan

### Phase 11a: Audit (This Phase)
- ✅ Inventory all APIs
- ⏳ Audit CrossChainStateRootApi
- ⏳ Resolve duplicate declarations
- ⏳ Map consumer requirements

### Phase 11b: Documentation & Testing
- Document every consumer relationship
- Add integration tests for all APIs
- Implement versioning support

### Phase 11c: Freeze & Gate
- Generate final API compatibility matrix
- Establish CI/CD gates blocking API changes
- Freeze surface for RC-2 audit

### Phase 12: Sidecar/Gateway Alignment
- Sidecar implements all required API consumers
- Gateway exposes stable API contracts
- Indexer aligns to canonical event model

---

## Appendix: Complete API Reference

| API | Trait | Location | Methods | Phase | Owner | Consumer Count |
|-----|-------|----------|---------|-------|-------|-----------------|
| Aura | sp_consensus_aura::AuraApi | 2319 | 2 | Substrate | substrate | Consensus |
| Grandpa | sp_consensus_grandpa::GrandpaApi | 2329 | 2 | Substrate | substrate | Finality |
| System Nonce | frame_system_rpc_runtime_api::AccountNonceApi | 2377 | 1 | Substrate | substrate | RPC, Wallet |
| Tx Payment | pallet_transaction_payment_rpc_runtime_api::TransactionPaymentApi | 2383 | 2 | Substrate | substrate | RPC, Fee UI |
| Atlas Kernel | pallet_x3_kernel::AtlasKernelRuntimeApi | 1795 | 4+ | 10a | x3-kernel | Relayer, Verifier, Gateway |
| Atomic Trade | pallet_atomic_trade_engine::AtomicTradeEngineApi | 2164 | 3 | 6 | atomic-trade-engine | RPC, Sidecar, Indexer |
| X3 Verifier | pallet_x3_verifier::runtime_api::X3VerifierApi | 2523 | 5 | 6 | x3-verifier | Relayer, Verifier, Gateway |
| Domain Registry | pallet_x3_domain_registry::runtime_api::X3DomainRegistryApi | 2646 | 3 | 6 | x3-domain-registry | Relayer, RPC, Sidecar |
| Atomic Kernel | pallet_x3_atomic_kernel::X3AtomicKernelApi | 2667 | 3 | 6 | x3-atomic-kernel | Settlement, Indexer |
| Evolution Core | pallet_evolution_core::runtime_api::EvolutionCoreApi | 2448 | 3 | 6 | evolution-core | GPU Validator, Indexer |
| **Cross-Chain State Root** | **gpu_validator_api::CrossChainStateRootApi** | **150, 2734** | **4** | **9** | **gpu-validator** | **⚠️ AUDIT** |
| **GPU Validator** | **gpu_validator_api::GpuValidatorRuntimeApi** | **140, 2730** | **3** | **6+** | **gpu-validator** | **RPC, Telemetry** |
| **Governance Settlement** | **gpu_validator_api::GovernanceSettlementApi** | **175, 2867** | **3** | **10a** | **governance** | **RPC, Relayer, Governance UI** |
| **Settlement Finality** | **gpu_validator_api::SettlementFinalityApi** | **194, 2978** | **2+** | **10a** | **settlement** | **Relayer, Gateway, Indexer** |

**Total: 15+ distinct runtime APIs**  
**Status: ❌ NOT FROZEN** — Awaiting CrossChainStateRootApi audit

---

## Recommendations

1. **Immediate (this phase):**
   - Audit CrossChainStateRootApi — either remove or confirm active use
   - Remove duplicate declarations (lines 3245, 3261)
   - Document every consumer relationship

2. **Before RC-2 audit:**
   - Implement comprehensive integration tests for all 13 APIs
   - Establish API change detection in CI/CD
   - Finalize sidecar/gateway consumer alignment

3. **Phase 12+:**
   - Implement API versioning in runtime and clients
   - Establish deprecation policy for future API changes
   - Create API change review board for post-testnet updates

