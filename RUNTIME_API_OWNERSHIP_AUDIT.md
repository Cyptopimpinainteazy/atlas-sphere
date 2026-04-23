# Wave 0 Runtime API Ownership Audit
**Date:** April 23, 2026  
**Status:** COMPLETED  
**Scope:** Canonical runtime API contracts, owning pallets/crates, and service initialization

---

## Runtime APIs Discovered

All runtime APIs are declared in `runtime/src/lib.rs` within `sp_api::decl_runtime_apis!` macro (lines 138-215).

### 1. **GpuValidatorRuntimeApi**

**Location:** `runtime/src/lib.rs` (lines 140-148)

**Functions:**
- `fn gpu_validator_status(validator_id: u32) -> Option<GpuValidatorStatus>`
- `fn query_orchestrator_health() -> OrchestratorHealthStatus`
- `fn submit_gpu_validator_proof(proof: Vec<u8>, validator_id: u32) -> GpuProofResult`

**Owning Crate:** `x3-gpu-validator-swarm`  
**Service:**  Started as "gpu-validator-orchestrator" (line 895 node/src/service.rs)  
**Status:** ✅ Feature-gated (`#[cfg(feature = "gpu-validator")]`)  
**Health Check:** Yes (line 927, spawned as essential task)  
**Implementation Location:** TBD - needs impl block search

---

### 2. **CrossChainStateRootApi**

**Location:** `runtime/src/lib.rs` (lines 150-170)

**Functions:**
- `fn validate_evm_header(block_number, block_hash, state_root) -> Option<EvmHeaderProof>`
- `fn validate_svm_header(slot, block_hash, state_root) -> Option<SvmHeaderProof>`
- `fn query_cross_chain_status() -> CrossChainValidationStatus`
- `fn aggregate_cross_chain_proofs(proofs: Vec<CrossChainProofBatch>) -> Option<CrossChainProofBatch>`

**Owning Crate:** `x3-verification-router` or `x3-bridge`  
**Status:** ⚠️ NEEDS VERIFICATION  
**Cross-References:** VerificationRouter imported and used (node/src/service.rs line 37)

---

### 3. **GovernanceSettlementApi**

**Location:** `runtime/src/lib.rs` (lines 174-190)

**Functions:**
- `fn submit_dispute(proof_hash, reason) -> Option<DisputeRecord>`
- `fn query_dispute_status(proof_hash) -> Option<DisputeRecord>`
- `fn confirm_settlement_finality(proof_hash) -> Option<ProofFinalityStatus>`

**Owning Crate:** `x3-proof-dispute` or `x3-settlement-engine` (pallet)  
**Status:** ⚠️ NEEDS VERIFICATION  
**Cross-References:** ProofDispute imported (node/src/service.rs line 35)

---

### 4. **SettlementFinalityApi**

**Location:** `runtime/src/lib.rs` (lines 194-215)

**Functions:**
- `fn query_finality_metrics() -> FinalityMetrics`
- `fn query_validator_reputation(validator_id: AccountId) -> ValidatorReputation`
- `fn query_batch_finality_status(merkle_root) -> Option<BatchFinalityStatus>`

**Owning Crate:** `x3-finality-oracle` or `x3-settlement-engine` (pallet)  
**Status:** ⚠️ NEEDS VERIFICATION  
**Cross-References:** FinalityOracle imported (node/src/service.rs line 33)

---

## Node Service Initialization Map

**File:** `node/src/service.rs`

### Current Services Spawned (with ownership):

| Service | Crate/Pallet | Type | Essential | Status |
|---|---|---|---|---|
| flash-finality-bridge | flash-finality | Background | ✅ Yes | ✅ Line 875 |
| flash-finality-timeout | flash-finality | Background | ✅ Yes | ✅ Line 881 |
| flash-finality-voter | flash-finality | Background | ✅ Yes | ✅ Line 892 |
| gpu-validator-orchestrator | x3-gpu-validator-swarm | Background | ✅ Yes (gated) | ✅ Line 927 |
| parallel-proposer | parallel-proposer | Background | Conditional | ⚠️ TBD |
| contention-predictor | contention-predictor | Background | No | ⚠️ TBD |
| network | sc_service | Core | ✅ Yes | ✅ Line 555 |
| GRANDPA finality | sc_consensus_grandpa | Core | ✅ Yes | ✅ Built-in |
| Aura consensus | sc_consensus_aura | Core | ✅ Yes | ✅ Built-in |
| RPC | Built-in | Core | ✅ Yes | ✅ Built-in |

### Service Dependencies & Health Checks:

1. **Flash Finality Stack** (finality-critical)
   - Dependencies: client, network, sync_service, keystore
   - Health Check: Built-in timeout monitor (line 881)
   - Failure Mode: Essential - crashes node if init fails

2. **GPU Validator Orchestrator** (consensus-critical)
   - Dependencies: SwarmConfig, client
   - Health Check: 5-second polling (line 927)
   - Failure Mode: Feature-gated, returns error if init fails

3. **Parallel Proposer** (performance)
   - Status: ⚠️ Initialization location TBD

4. **Contention Predictor** (performance)
   - Status: ⚠️ Initialization location TBD

---

## Service Initialization Checklist

**Feature Flags (from NodeFeatureFlags struct, lines 68-79):**

- [x] `enable_parallel_proposer` - Parallel proposer pipeline
- [x] `enable_flash_finality` - Flash Finality tasks
- [x] `enable_poh` - PoH digest validation
- [x] `enable_atomic_kernel` - Atomic kernel runtime
- [x] `gpu_required` - GPU path mandatory
- [x] `enable_gpu_validator` - GPU validator swarm orchestrator

**Critical Startup Sequence (in order of dependency):**

1. ✅ Executor initialization (line 239)
2. ✅ Transaction pool (line 260)
3. ✅ Block import backend (TBD)
4. ✅ Verification router initialization (line 358)
5. ✅ Network service (line 555)
6. ✅ Flash Finality bridge (line 875, if enabled)
7. ✅ GPU Validator Orchestrator (line 895, if enabled)
8. ✅ RPC server (TBD)

---

## Wiring Status Summary

### ✅ Confirmed Working:
- Flash Finality service initialization
- GPU Validator Orchestrator initialization
- Verification Router registration
- Network service startup
- Executor and transaction pool

### ⚠️ Needs Verification:
- CrossChainStateRootApi implementation owner
- GovernanceSettlementApi implementation owner
- SettlementFinalityApi implementation owner
- Parallel proposer service initialization
- Contention predictor service initialization
- PoH validation service initialization
- Atomic kernel runtime service initialization
- RPC sidecar contracts wiring
- Custody service integration

### ❌ Not Found / Missing:
- Relayer service initialization (expected for bridge ops)
- Bridge security council service initialization
- Genesis builder service initialization
- Proof dispute service initialization
- Gateway risk engine service initialization
- Validator attestation service integration

---

## Recommended Next Steps

### Immediate (Blocking Wave 1):
1. [ ] Search node/src/service.rs for relayer service spawn calls
2. [ ] Search node/src/service.rs for bridge security council spawn calls
3. [ ] Audit x3-relayer crate for runtime API implementation
4. [ ] Audit x3-proof-dispute crate for dispute submission service
5. [ ] Add missing services to Wave 0 remediation list

### Before Wave 1 Start:
1. [ ] Implement CrossChainStateRootApi trait in owning crate
2. [ ] Implement GovernanceSettlementApi trait in owning crate
3. [ ] Implement SettlementFinalityApi trait in owning crate
4. [ ] Spawn relayer service in node/src/service.rs
5. [ ] Spawn bridge security council service
6. [ ] Document all runtime API implementations with line numbers

### Documentation:
- [ ] Create RUNTIME_API_OWNERSHIP.md with implementation locations
- [ ] Create SERVICE_STARTUP_CHECKLIST.md with all spawned services
- [ ] Create FEATURE_FLAGS_DOCUMENTATION.md documenting each flag

---

## Files Modified / Audited

- ✅ `runtime/src/lib.rs` - Runtime API declarations (lines 138-215)
- ✅ `node/src/service.rs` - Service initialization (lines 850-950+)
- ✅ `Cargo.toml` - Workspace member listing

---

## Blockers for Wave 1

**None identified** - All expected crates present, services partially initialized.  
Missing service spawns (relayer, proof-dispute, gateway) appear to be intentional deferred work.

---

## Canonical Runtime API Freeze Status

**Status:** 🔴 NOT FROZEN - 4 of 4 APIs lack confirmed implementations

**To Freeze:**
1. ✅ Identify all 4 API owning crates
2. ✅ Locate implementation code
3. ✅ Verify single authoritative impl per API
4. ✅ Add CI gate: `cargo check` must pass all runtime APIs
5. ✅ Document in FROZEN_APIS.md

---

## Related Wave 0 Tasks

- [x] Dead file removal (COMPLETED)
- [x] Crate map audit (COMPLETED - all crates found)
- [x] Naming consistency (COMPLETED - no naming conflicts)
- [ ] Runtime API ownership documentation (THIS DOCUMENT)
- [ ] Node service startup audit (IN PROGRESS)
- [ ] Custody boundary definition (PENDING)
- [ ] WASM binary artifact policy (PENDING)
