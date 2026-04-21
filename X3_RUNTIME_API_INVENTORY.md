# X3 Runtime API Inventory & Freeze (Phase 11)

**Status:** RC-1 Phase 11 — Canonical Runtime API Surface Stabilization  
**Date:** April 20, 2026  
**Scope:** Map, audit, and freeze all runtime APIs before RC-2 audit

---

## Executive Summary

The X3 runtime currently exposes **13+ distinct runtime API traits** across consensus, settlement, governance, verification, and GPU validation domains. Phase 11 consolidates these into a frozen canonical surface by:

1. **Inventorying all APIs** by owner pallet and subsystem
2. **Removing duplicates and dead code** (CrossChainStateRootApi audit required)
3. **Mapping downstream consumers** (sidecar, gateway, indexer, validator)
4. **Establishing API versioning rules** for safe client upgrades
5. **Freezing the canonical surface** for RC-2 audit evaluation

**Exit Criteria:**
- ✅ One canonical runtime API inventory with clear ownership
- ✅ Zero duplicate or unused APIs
- ✅ Every surviving API has documented consumer set
- ✅ Versioning policy established for client compatibility
- ✅ RPC surface mapped to backing runtime APIs

---

## Part 1: Consensus & System APIs (Substrate Standard)

### 1.1 Aura Consensus API

**Trait:** `sp_consensus_aura::AuraApi<Block, AuthorityId>`  
**Location:** `runtime/src/lib.rs:2319`  
**Owner:** substrate consensus  
**Responsibility:** Authority slot scheduling, next authority set

**Methods:**
- `slot_duration() -> u64` — Returns 200ms (MILLISECS_PER_BLOCK)
- `authorities() -> Vec<AuthorityId>` — List current aura authorities

**Consumers:**
- Aura consensus engine (node)
- Authority rotation on finality

**Status:** ✅ **KEEP** — Standard Substrate pattern, required for consensus

---

### 1.2 Grandpa Finality API

**Trait:** `sp_consensus_grandpa::GrandpaApi<Block>`  
**Location:** `runtime/src/lib.rs:2329`  
**Owner:** substrate finality  
**Responsibility:** GRANDPA authority set tracking

**Methods:**
- `grandpa_authorities() -> AuthorityList` — Current validator set for Grandpa
- `submit_report_equivocation_unsigned_extrinsic(...)` — Report double-voting

**Consumers:**
- Grandpa finality gadget
- Slashing engine (via equivocation reports)

**Status:** ✅ **KEEP** — Standard Substrate finality primitive

---

### 1.3 System Account Nonce API

**Trait:** `frame_system_rpc_runtime_api::AccountNonceApi<Block, AccountId, Nonce>`  
**Location:** `runtime/src/lib.rs:2377`  
**Owner:** frame-system  
**Responsibility:** Transaction nonce retrieval

**Methods:**
- `account_nonce(account: AccountId) -> Nonce` — Get next valid nonce for account

**Consumers:**
- RPC: `system_accountNextIndex`
- Wallet/signer clients

**Status:** ✅ **KEEP** — Standard RPC infrastructure

---

### 1.4 Transaction Payment API

**Trait:** `pallet_transaction_payment_rpc_runtime_api::TransactionPaymentApi<Block, Balance>`  
**Location:** `runtime/src/lib.rs:2383`  
**Owner:** pallet-transaction-payment  
**Responsibility:** Fee estimation

**Methods:**
- `query_info(uxt: Extrinsic, len: u32) -> RuntimeDispatchInfo<Balance>` — Estimate call fees
- `query_fee_details(uxt: Extrinsic, len: u32) -> FeeDetails<Balance>` — Detailed fee breakdown

**Consumers:**
- RPC: `payment_queryInfo`, `payment_queryFeeDetails`
- Wallet fee estimation UI

**Status:** ✅ **KEEP** — Required for fee estimation UX

---

## Part 2: X3 Domain APIs (Pallet-Specific)

### 2.1 X3 Kernel (Atlas Kernel) API

**Trait:** `pallet_x3_kernel::AtlasKernelRuntimeApi<Block, AccountId, Balance, AssetId>`  
**Location:** `runtime/src/lib.rs:1795`  
**Owner:** `pallet-x3-kernel` (governance consolidation, Phase 10a)  
**Responsibility:** Kernel policy, cross-domain settlement authorization

**Methods:**
- `kernel_policy(pallet_id: u16) -> KernelPolicy` — Get governance policy for pallet
- `is_settlement_authorized(proof_hash: H256, domain: u32) -> bool` — Check if proof meets governance approval threshold
- `governance_status() -> GovernanceStatus` — Current governance mode (normal, emergency, paused)
- `get_active_disputes() -> Vec<DisputeId>` — List ongoing governance disputes (Phase 10a)

**Consumers:**
- Relayer (settlement authorization before proof submission)
- Bridge verifier (pause/emergency authority check)
- Gateway API (governance status queries)

**Status:** ✅ **KEEP** — Critical for governance-driven settlement flow

**Freeze Note:** Post-Phase-10a, this API becomes the canonical governance settlement interface. RPC exposure planned via sidecar.

---

### 2.2 Atomic Trade Engine API

**Trait:** `pallet_atomic_trade_engine::AtomicTradeEngineApi<Block>`  
**Location:** `runtime/src/lib.rs:2164`  
**Owner:** `pallet-atomic-trade-engine`  
**Responsibility:** Cross-chain atomic trade state and price feeds

**Methods:**
- `atomic_trade_status(trade_id: H256) -> TradeStatus` — Get current trade state (pending, locked, settled, disputed, reverted)
- `get_trade_price(trading_pair: TradingPair) -> Option<PricePoint>` — Get latest oracle price for pair
- `validate_trade_commitment(trade_hash: H256) -> bool` — Verify trade parameters match commitment hash

**Consumers:**
- RPC: `x3_getTradeStatus`, `x3_getTradePrice`
- Sidecar: Trade settlement queries
- Indexer: Trade lifecycle events

**Status:** ✅ **KEEP** — Required for atomic trade settlement UX

---

### 2.3 X3 Verifier API (Bridge Proof Validation)

**Trait:** `pallet_x3_verifier::runtime_api::X3VerifierApi<Block, AccountId, Balance, BlockNumber>`  
**Location:** `runtime/src/lib.rs:2523`  
**Owner:** `pallet-x3-verifier` (Phase 6 relayer integration)  
**Responsibility:** Bridge proof validation thresholds and validator reputation

**Methods:**
- `verify_bridge_proof(proof: BridgeProof) -> VerificationResult` — Validate EVM/SVM header proof
- `get_validator_reputation(validator_id: AccountId) -> ReputationScore` — Query validator slashing history
- `get_verification_threshold() -> VerificationThreshold` — Current proof validation parameters
- `get_active_validators() -> Vec<(AccountId, Stake)>` — List validators eligible for proof validation
- `query_proof_status(proof_hash: H256) -> ProofStatus` — Get settlement state (pending, verified, disputed, rejected)

**Consumers:**
- Relayer (pre-submission proof validation — Phase 6)
- Bridge verifier pallet (proof state management)
- Gateway API (proof status queries)
- Indexer (proof lifecycle events)

**Status:** ✅ **KEEP** — Core bridge verification interface

**Freeze Note:** Proof validation thresholds are immutable post-freeze. Any threshold changes require governance approval via Phase 10a GovernanceSettlementApi.

---

### 2.4 X3 Domain Registry API

**Trait:** `pallet_x3_domain_registry::runtime_api::X3DomainRegistryApi<Block, AccountId>`  
**Location:** `runtime/src/lib.rs:2646`  
**Owner:** `pallet-x3-domain-registry`  
**Responsibility:** Cross-chain domain mapping and routing

**Methods:**
- `get_domain_config(domain_id: u32) -> DomainConfig` — EVM chain ID, SVM cluster ID, X3 shard mapping
- `route_to_domain(asset_address: H160, domain: u32) -> RoutingInfo` — Get bridge endpoint for cross-chain asset
- `query_domain_status(domain_id: u32) -> DomainStatus` — Operational status (active, paused, deprecated)

**Consumers:**
- Relayer (domain routing)
- RPC: `x3_routeToDomain`
- Sidecar (domain availability checks)

**Status:** ✅ **KEEP** — Required for multi-chain routing

---

### 2.5 X3 Atomic Kernel API

**Trait:** `pallet_x3_atomic_kernel::X3AtomicKernelApi<Block>`  
**Location:** `runtime/src/lib.rs:2667`  
**Owner:** `pallet-x3-atomic-kernel`  
**Responsibility:** Atomic operation determinism and rollback semantics

**Methods:**
- `is_atomic_operation_valid(op_hash: H256) -> bool` — Check if atomic operation parameters are deterministic
- `get_atomic_rollback_state(op_id: u64) -> RollbackState` — Retrieve atomic operation failure state for recovery
- `atomic_commit_count() -> u64` — Atomic operations successfully committed in this block

**Consumers:**
- Settlement verification (atomicity validation)
- Indexer (atomic operation tracking)

**Status:** ✅ **KEEP** — Required for atomic cross-VM operations

---

### 2.6 Evolution Core API

**Trait:** `pallet_evolution_core::runtime_api::EvolutionCoreApi<Block, AccountId, BlockNumber>`  
**Location:** `runtime/src/lib.rs:2448`  
**Owner:** `pallet-evolution-core`  
**Responsibility:** GPU validator evolution and scoring

**Methods:**
- `get_evolution_score(validator_id: AccountId) -> u32` — Current evolutionary fitness score
- `query_evolution_metrics() -> EvolutionMetrics` — Population statistics, diversity metrics
- `get_next_evolution_epoch() -> BlockNumber` — When next evolution round executes

**Consumers:**
- GPU validator selection (stake + evolution score)
- Indexer (validator metrics)

**Status:** ✅ **KEEP** — Required for GPU validator selection

---

## Part 3: Phase 9 APIs (Cross-Chain Settlement)

### 3.1 Cross-Chain State Root API ⚠️

**Trait:** `gpu_validator_api::CrossChainStateRootApi<Block>`  
**Location:** `runtime/src/lib.rs:150` (declaration), `2734` (implementation)  
**Owner:** `gpu-validator` crate  
**Responsibility:** EVM/SVM header validation and proof aggregation

**Methods:**
- `validate_evm_header(block_number: u64, block_hash: H256, state_root: H256) -> Option<EvmHeaderProof>` — Validate EVM block header
- `validate_svm_header(slot: u64, block_hash: H256, state_root: H256) -> Option<SvmHeaderProof>` — Validate Solana header
- `query_cross_chain_status() -> CrossChainValidationStatus` — Aggregated validation metrics
- `aggregate_cross_chain_proofs(proofs: Vec<CrossChainProofBatch>) -> Option<CrossChainProofBatch>` — Combine multiple proofs

**Consumers:**
- Relayer (proof aggregation — Phase 6)
- Bridge verifier pallet (header validation during proof verification)
- Indexer (cross-chain event correlation)

**Status:** ⚠️ **AUDIT REQUIRED** — Previous context flagged this as "unimplemented"

**Action Items:**
1. Verify `impl CrossChainStateRootApi for Runtime` at line 2734 actually contains logic
2. Check if EVM/SVM header proofs are being used in production verification
3. If unused → **REMOVE** entirely and consolidate header validation into pallet-x3-verifier
4. If used → Add comprehensive integration tests and document relationship to Phase 6 relayer

**Freeze Status:** ❌ **BLOCKED** — Cannot freeze Phase 11 until CrossChainStateRootApi audit completes

---

## Part 4: Phase 10a APIs (Governance Settlement & Finality)

### 4.1 Governance Settlement API

**Trait:** `gpu_validator_api::GovernanceSettlementApi<Block>`  
**Location:** `runtime/src/lib.rs:175` (declaration), `2867` (implementation)  
**Owner:** Governance policy layer (consolidated into x3-kernel pallet, Phase 10a)  
**Responsibility:** Dispute submission, voting tracking, settlement confirmation

**Methods:**
- `submit_dispute(proof_hash: H256, reason: Vec<u8>) -> Option<DisputeRecord>` — Challenge a proof's settlement status
- `query_dispute_status(proof_hash: H256) -> Option<DisputeRecord>` — Get voting results for active dispute
- `confirm_settlement_finality(proof_hash: H256) -> Option<ProofFinalityStatus>` — Confirm proof reached consensus finality

**Consumers:**
- RPC: `submitDispute`, `queryDisputeStatus` (Phase 10a RPC methods)
- Relayer (settlement authorization check before proof submission)
- Governance UI (dispute voting and visualization)
- Indexer (dispute lifecycle events)

**Status:** ✅ **KEEP** — Canonical governance settlement interface

**Freeze Notes:**
- These methods become immutable once RC-2 audit completes
- Dispute reason encoding is not encrypted; governance disputes are public
- Settlement finality is deterministic once threshold validators attest (no subjective reversals)

**Phase 10b Dependency:** Signature validation and merkle proof verification deferred to Phase 10b post-audit

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
| `queryProofFinality` | SettlementFinalityApi | node/src/rpc.rs:377 | 10a | ✅ FROZEN |
| `recordProofConfirmation` | SettlementFinalityApi | node/src/rpc.rs:414 | 10a | ✅ FROZEN |

### Wallet & Cross-VM RPC

| RPC Method | Backing API | Owner | Status |
|-----------|-------------|-------|--------|
| `x3_submitCrossVmTransaction` | X3VerifierApi | bridge validation | ✅ ACTIVE |
| `x3_submitSvmTransaction` | X3VerifierApi + X3DomainRegistryApi | SVM routing | ✅ ACTIVE |
| `x3_submitX3vmTransaction` | AtomicTradeEngineApi | atomic trades | ✅ ACTIVE |
| `x3_getAssetMetadata` | X3DomainRegistryApi | asset registry | ✅ ACTIVE |
| `x3_estimateGas` | TransactionPaymentApi | fee estimation | ✅ ACTIVE |

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
| **GPU Validator** | **gpu_validator_api::GpuValidatorRuntimeApi** | **140, 2686** | **3** | **6+** | **gpu-validator** | **RPC, Telemetry** |
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

