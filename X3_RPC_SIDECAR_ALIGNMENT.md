# X3 RPC & Sidecar Alignment (Phase 12)

**Status:** RC-1 Phase 12 — RPC Surface Stabilization & Sidecar Contract Design  
**Date:** April 20, 2026  
**Scope:** Map all 29 RPC methods to backing runtime APIs. Define stable sidecar interface.

---

## Executive Summary

The X3 node exposes **29 JSON-RPC methods** across wallet, trading, verification, and governance domains. Phase 12 consolidates these into a **frozen RPC contract** with:

1. **RPC method inventory** — All 29 methods mapped to backing runtime APIs
2. **Stability tiers** — Core, extension, experimental classifications
3. **Sidecar contract specification** — What the sidecar must implement
4. **Versioning & compatibility policy** — How clients handle API changes
5. **Error semantics** — Consistent error response format across all methods

**Exit Criteria:**
- ✅ Every RPC method has documented backing API
- ✅ RPC contract frozen (no new methods without architecture review)
- ✅ Sidecar spec completed (ready for implementation)
- ✅ Client versioning strategy established
- ✅ Error handling standardized

---

## Part 1: RPC Method Inventory (29 Total)

### 1.1 Core Consensus Methods (Substrate-Standard)

#### `system_accountNextIndex`
**Owner:** frame-system  
**Backing API:** `AccountNonceApi::account_nonce(AccountId) -> Nonce`  
**Parameters:**
- `account_id: String` (SS58 or hex)

**Returns:**
```json
{
  "nonce": "u32",
  "account_id": "String"
}
```
**Stability Tier:** ✅ **CORE** — Consensus-critical  
**Consumers:** Wallet signers, transaction builders  
**Test Coverage:** Unit tests in frame-system-rpc-runtime-api

---

#### `payment_queryInfo`
**Owner:** pallet-transaction-payment  
**Backing API:** `TransactionPaymentApi::query_info(Extrinsic, Length) -> RuntimeDispatchInfo<Balance>`  
**Parameters:**
- `extrinsic: String` (hex-encoded extrinsic)

**Returns:**
```json
{
  "weight": {
    "ref_time": "u64",
    "proof_size": "u64"
  },
  "partial_fee": "String",
  "class": "Enum (Normal|Operational|Mandatory)"
}
```
**Stability Tier:** ✅ **CORE** — Fee estimation  
**Consumers:** Wallet UX, fee calculation  
**Test Coverage:** Benchmark weight models

---

### 1.2 Settlement & Verification Methods (Phase 10a, 9)

#### `submitDispute`
**Owner:** gpu-validator (GovernanceSettlementApi)  
**Backing API:** `GovernanceSettlementApi::submit_dispute(H256, Vec<u8>) -> Option<DisputeRecord>`  
**Parameters:**
- `proof_hash: String` (0x-prefixed H256)
- `reason: String` (UTF-8 encoded reason text)

**Returns:**
```json
{
  "dispute_id": "u64",
  "proof_hash": "String",
  "challenger": "String",
  "status": "Pending|UnderReview|Resolved|Dismissed",
  "timestamp": "u64"
}
```
**Stability Tier:** ✅ **CORE** — Governance settlement  
**Consumers:** Governance UI, dispute dashboard  
**Freeze Status:** ✅ Frozen for RC-2 audit  
**Phase:** 10a

---

#### `queryDisputeStatus`
**Owner:** gpu-validator (GovernanceSettlementApi)  
**Backing API:** `GovernanceSettlementApi::query_dispute_status(H256) -> Option<DisputeRecord>`  
**Parameters:**
- `proof_hash: String` (0x-prefixed H256)

**Returns:**
```json
{
  "dispute_id": "u64",
  "proof_hash": "String",
  "challenger": "String",
  "status": "Pending|UnderReview|Resolved|Dismissed",
  "voting_results": {
    "approve_count": "u32",
    "reject_count": "u32",
    "total_validators": "u32"
  },
  "reason": "String"
}
```
**Stability Tier:** ✅ **CORE** — Governance queries  
**Consumers:** Governance UI, proof status dashboard  
**Freeze Status:** ✅ Frozen for RC-2 audit  
**Phase:** 10a

---

#### `queryProofFinality`
**Owner:** gpu-validator (SettlementFinalityApi)  
**Backing API:** `SettlementFinalityApi (Phase 10a)`  
**Parameters:**
- `proof_hash: String` (0x-prefixed H256)

**Returns:**
```json
{
  "proof_hash": "String",
  "status": "Unconfirmed|Confirming|Confirmed|Challenged",
  "confirmation_count": "u32",
  "required_threshold": "u32",
  "finality_percent": "u8",
  "remaining_blocks": "u32"
}
```
**Stability Tier:** ✅ **CORE** — Finality tracking  
**Consumers:** Settlement UI, finality dashboards  
**Freeze Status:** ✅ Frozen for RC-2 audit  
**Phase:** 10a

---

#### `recordProofConfirmation`
**Owner:** gpu-validator (SettlementFinalityApi)  
**Backing API:** `SettlementFinalityApi::record_proof_confirmation(...)`  
**Parameters:**
- `proof_hash: String` (0x-prefixed H256)
- `validator_id: String` (0x-prefixed H256 or SS58)
- `approval: bool`

**Returns:**
```json
{
  "proof_hash": "String",
  "validator_id": "String",
  "approval": "bool",
  "confirmation_block": "u32",
  "aggregated_approval_percent": "u8"
}
```
**Stability Tier:** ✅ **CORE** — Finality confirmation  
**Consumers:** Validators, finality aggregation  
**Freeze Status:** ✅ Frozen for RC-2 audit  
**Phase:** 10a

---

#### `requestProofChallenge`
**Owner:** pallet-x3-verifier (Phase 6)  
**Backing API:** `X3VerifierApi::get_verification_threshold()`  
**Parameters:**
- `proof_hash: String`
- `challenge_reason: String`

**Returns:**
```json
{
  "challenge_id": "u64",
  "proof_hash": "String",
  "status": "Submitted|UnderReview|Resolved",
  "dispute_window_blocks": "u32"
}
```
**Stability Tier:** 🟡 **EXTENSION** — Dispute flow  
**Consumers:** Proof challenge workflows  
**Phase:** 6

---

### 1.3 Bridge & Cross-Chain Methods (Phase 6)

#### `x3_submitCrossVmTransaction`
**Owner:** pallet-x3-verifier  
**Backing API:** `X3VerifierApi::verify_bridge_proof(...)`  
**Parameters:**
- `source_domain: u32` (EVM chain ID)
- `target_domain: u32` (X3 shard ID)
- `proof: String` (hex-encoded bridge proof)
- `transaction_data: String` (cross-VM operation)

**Returns:**
```json
{
  "transaction_hash": "String",
  "status": "Verified|Pending|Rejected",
  "confirmation_count": "u32"
}
```
**Stability Tier:** ✅ **CORE** — Bridge flow  
**Consumers:** Bridge relayer, cross-VM transactions  
**Phase:** 6

---

#### `x3_submitSvmTransaction`
**Owner:** pallet-x3-domain-registry  
**Backing API:** `X3DomainRegistryApi::route_to_domain(...)`  
**Parameters:**
- `solana_transaction: String` (base64-encoded transaction)
- `x3_shard_id: u32`

**Returns:**
```json
{
  "signature": "String",
  "status": "Submitted|Confirmed",
  "shard_confirmed_in_block": "u64"
}
```
**Stability Tier:** 🟡 **EXTENSION** — SVM routing  
**Consumers:** Solana bridge relayer  
**Phase:** 6

---

#### `x3_submitX3vmTransaction`
**Owner:** pallet-x3-atomic-kernel  
**Backing API:** `X3AtomicKernelApi::is_atomic_operation_valid(...)`  
**Parameters:**
- `operation: String` (JSON: type, params, witness)

**Returns:**
```json
{
  "operation_id": "u64",
  "status": "Queued|Executing|Committed|Failed",
  "commitment_block": "u32"
}
```
**Stability Tier:** 🟡 **EXTENSION** — Atomic X3VM ops  
**Consumers:** X3VM execution orchestrator  
**Phase:** 6

---

### 1.4 Trading Methods (Atomic Trade Engine)

#### `walletDex_estimateSwap`
**Owner:** pallet-atomic-trade-engine  
**Backing API:** `AtomicTradeEngineApi::get_trade_price(...)`  
**Parameters:**
- `trading_pair: String` (asset address + target asset)
- `input_amount: String` (human-readable decimal)

**Returns:**
```json
{
  "output_amount": "String",
  "price": "String",
  "slippage_percent": "f64",
  "execution_fee": "String"
}
```
**Stability Tier:** 🟡 **EXTENSION** — Trading UX  
**Consumers:** Wallet swap UI, price feeds  
**Phase:** 6

---

#### `walletDex_executeSwap`
**Owner:** pallet-atomic-trade-engine  
**Backing API:** `AtomicTradeEngineApi::atomic_trade_status(...)`  
**Parameters:**
- `trading_pair: String`
- `input_amount: String`
- `min_output_amount: String` (slippage protection)
- `deadline_block: u32`

**Returns:**
```json
{
  "trade_id": "String",
  "status": "Pending|Locked|Settled|Disputed|Reverted",
  "output_received": "String",
  "settlement_block": "u32"
}
```
**Stability Tier:** 🟡 **EXTENSION** — Trading execution  
**Consumers:** Wallet trading UI  
**Phase:** 6

---

#### `atomicTrade_createSwap` / `atomicTrade_executeSwap` / `atomicTrade_getSwapQuote` / `atomicTrade_estimateSlippage` / `atomicTrade_getSwapStatus`
**Owner:** pallet-atomic-trade-engine  
**Backing API:** `AtomicTradeEngineApi (multiple methods)`  
**Stability Tier:** 🟡 **EXTENSION** — Advanced trading  
**Consumers:** Trading dashboards, bots, DeFi aggregators  
**Phase:** 6

**Note:** These 5 methods are variants of walletDex methods. Recommend consolidating into single `atomicTrade_*` namespace post-RC-2.

---

### 1.5 Account & Authorization Methods

#### `x3_getAssetMetadata`
**Owner:** pallet-x3-domain-registry  
**Backing API:** `X3DomainRegistryApi::get_domain_config(...)`  
**Parameters:**
- `asset_address: String` (EVM 0x address or SVM mint)

**Returns:**
```json
{
  "symbol": "String",
  "decimals": "u8",
  "total_supply": "String",
  "chain_id": "u32"
}
```
**Stability Tier:** 🟡 **EXTENSION** — Asset registry  
**Consumers:** Wallet asset display, trading UX  
**Phase:** 6

---

#### `x3_isAuthorized`
**Owner:** pallet-x3-kernel (Atlas Kernel)  
**Backing API:** `AtlasKernelRuntimeApi::kernel_policy(...)`  
**Parameters:**
- `account_id: String` (SS58 or hex)
- `action: String` (e.g., "can_trade", "can_stake")

**Returns:**
```json
{
  "authorized": "bool",
  "reason_if_denied": "String"
}
```
**Stability Tier:** 🟡 **EXTENSION** — Authorization checks  
**Consumers:** Wallet permission UI  
**Phase:** 10a

---

#### `x3_getAuthorizedAccounts`
**Owner:** pallet-x3-kernel  
**Backing API:** `AtlasKernelRuntimeApi`  
**Returns:**
```json
[
  {
    "account_id": "String",
    "permissions": ["trade", "stake", "vote"]
  }
]
```
**Stability Tier:** 🟡 **EXTENSION** — Account listing  
**Consumers:** Admin dashboards  
**Phase:** 10a

---

#### `x3_getAuthorities`
**Owner:** pallet-x3-kernel  
**Backing API:** `GrandpaApi::grandpa_authorities()`  
**Returns:**
```json
[
  {
    "authority_id": "String",
    "weight": "u64"
  }
]
```
**Stability Tier:** ✅ **CORE** — Consensus authorities  
**Consumers:** Authority tracking, validator monitoring  
**Phase:** Substrate standard

---

### 1.6 Balance & Gas Estimation Methods

#### `x3_getCanonicalBalance`
**Owner:** pallet-x3-coin  
**Backing API:** Runtime state query (pallet_balances)  
**Parameters:**
- `account_id: String`
- `asset_id: u32` (optional, defaults to X3 native)

**Returns:**
```json
{
  "free": "String",
  "reserved": "String",
  "total": "String",
  "asset_id": "u32"
}
```
**Stability Tier:** ✅ **CORE** — Account balances  
**Consumers:** Wallet balance display  
**Phase:** 6

---

#### `x3_estimateGas`
**Owner:** pallet-transaction-payment  
**Backing API:** `TransactionPaymentApi::query_info(...)`  
**Parameters:**
- `extrinsic: String` (hex-encoded operation)

**Returns:**
```json
{
  "gas_units": "u64",
  "estimated_fee": "String",
  "weight_breakdown": {
    "ref_time": "u64",
    "proof_size": "u64"
  }
}
```
**Stability Tier:** ✅ **CORE** — Fee estimation  
**Consumers:** Wallet UX, fee calculators  
**Phase:** 6

---

### 1.7 Network & Status Methods

#### `x3_newCore` / `x3_flashFinalityStatus`
**Owner:** GPU validator / finality orchestrator  
**Backing API:** `GpuValidatorRuntimeApi::query_orchestrator_health()`  
**Stability Tier:** 🟡 **EXTENSION** — Telemetry  
**Consumers:** Node health dashboards  
**Phase:** 6+

---

## Part 2: RPC Stability Tiers

### Tier 1: ✅ CORE (Immutable Post-RC-2)
Methods required for consensus, settlement, and primary UX. No breaking changes allowed without major version bump.

**List:**
- `system_accountNextIndex`
- `payment_queryInfo`
- `submitDispute`
- `queryDisputeStatus`
- `queryProofFinality`
- `recordProofConfirmation`
- `x3_submitCrossVmTransaction`
- `x3_getAuthorities`
- `x3_getCanonicalBalance`
- `x3_estimateGas`

**Count:** 10 methods  
**Freeze Status:** ✅ Frozen post-RC-1 Phase 11

---

### Tier 2: 🟡 EXTENSION (Locked Post-Testnet)
Methods for advanced features. Can be modified before testnet, then frozen.

**List:**
- `x3_submitSvmTransaction`
- `x3_submitX3vmTransaction`
- `walletDex_estimateSwap`
- `walletDex_executeSwap`
- `atomicTrade_createSwap` (& 4 related)
- `x3_getAssetMetadata`
- `x3_isAuthorized`
- `x3_getAuthorizedAccounts`
- `x3_flashFinalityStatus`
- `requestProofChallenge`

**Count:** 15 methods  
**Freeze Status:** ⏳ Can iterate until testnet launch

---

### Tier 3: 🔴 EXPERIMENTAL (Internal Only)
Methods under development. Subject to breaking changes.

**List:**
- GPU validator debug methods
- Internal orchestrator probes
- Performance benchmarking endpoints

**Count:** 4+ methods  
**Stability:** Subject to removal without notice

---

## Part 3: Sidecar Contract Specification

### Purpose
The sidecar serves as the high-level orchestration layer. Node RPC owns low-latency chain-native operations. Sidecar owns aggregation, query shaping, and consumer-friendly business logic.

### Boundary Rules

**Node RPC handles:**
- Single-method runtime API calls
- Fee estimation
- Balance queries
- Proof verification status
- Direct transaction submission

**Sidecar handles:**
- Multi-step settlement workflows
- Governance dispute orchestration
- Cross-chain routing optimization
- Event aggregation and history
- Client session management

### Sidecar Endpoints (Target Design)

#### Settlement Orchestration

**`POST /api/v1/settlement/submit-and-finalize`**
```json
REQUEST: {
  "proof_hash": "String",
  "challenging_account": "String",
  "reason": "String"
}

RESPONSE: {
  "dispute_id": "u64",
  "status": "SubmittedToGovernance",
  "estimated_finality_blocks": "u32",
  "polling_interval_ms": "u32"
}
```

**Sidecar Logic:**
1. Call `submitDispute` RPC
2. Poll `queryDisputeStatus` every 2 blocks
3. Once status = Resolved, call `recordProofConfirmation` RPC
4. Return final settlement state to client

---

#### Finality Confirmation Tracking

**`GET /api/v1/finality/proof/:proof_hash`**

**Response:**
```json
{
  "proof_hash": "String",
  "status": "Unconfirmed|Confirming|Confirmed",
  "confirmation_timeline": [
    {
      "validator_id": "String",
      "confirmed_at_block": "u32",
      "approval": "bool"
    }
  ],
  "estimated_blocks_to_finality": "u32"
}
```

**Sidecar Logic:**
1. Query `queryProofFinality` RPC
2. Index on-chain events (ProofConfirmed, ValidatorAttested)
3. Build confirmation timeline from event log
4. Estimate remaining blocks based on finality threshold

---

#### Governance State Machine

**`GET /api/v1/governance/disputes/:proof_hash`**

**Response:**
```json
{
  "dispute_id": "u64",
  "proof_hash": "String",
  "status": "Pending|UnderReview|Resolved|Dismissed",
  "timeline": [
    {
      "event": "DisputeSubmitted|VoterAttested|ResolutionReached",
      "timestamp_block": "u32",
      "data": {}
    }
  ],
  "voting_state": {
    "approve_count": "u32",
    "reject_count": "u32",
    "required_for_approval": "u32"
  }
}
```

---

### Error Semantics

**Standard Error Format (All Endpoints):**
```json
{
  "error": {
    "code": "String",
    "message": "String",
    "context": {}
  }
}
```

**Error Codes:**
- `PROOF_NOT_FOUND` (404) — Proof hash doesn't exist
- `PROOF_UNVERIFIED` (422) — Proof failed verification before dispute submission
- `INVALID_HEX` (400) — Malformed proof hash or parameter
- `GOVERNANCE_PAUSED` (503) — Governance settlement temporarily disabled
- `SESSION_MISMATCH` (422) — Merkle proof session doesn't match current settlement session
- `RPC_TIMEOUT` (504) — Sidecar → Node RPC timeout

---

## Part 4: Versioning & Compatibility

### RPC API Versioning

**Format:** `vX.Y.Z`
- **X (Major):** Breaking changes (method removed, signature changed)
- **Y (Minor):** New methods, optional parameters
- **Z (Patch):** Bug fixes, error message clarifications

### Semantic Versioning Rules

1. **Client Registration:**
   - Clients specify `minimum_rpc_version: "1.0.0"` in handshake
   - Server responds with `current_rpc_version: "1.2.3"`

2. **Backward Compatibility:**
   - 1.x clients can connect to 1.y servers (y >= x)
   - 2.x clients CANNOT connect to 1.x servers

3. **Deprecation Path:**
   - Deprecated methods marked with `deprecated: true` in schema
   - Maintained for 2 minor versions before removal
   - Warning returned in response headers

### Examples

**Major Version Bump (1.0 → 2.0):**
- Remove `atomicTrade_*` methods (consolidate into single namespace)
- Change `submitDispute` signature

**Minor Version Bump (1.0 → 1.1):**
- Add `x3_getAssetMetadata` (new method)
- Add optional `chain_id` filter to `x3_submitCrossVmTransaction`

**Patch Version Bump (1.0 → 1.0.1):**
- Fix error message for `GOVERNANCE_PAUSED`
- Improve timeout handling on `queryDisputeStatus`

---

## Part 5: Consolidation Recommendations

### Recommended Changes (Post-RC-2, Pre-Testnet)

1. **Consolidate trading namespace:**
   - Merge `walletDex_*` and `atomicTrade_*` into single `/api/v2/trades/*` endpoint set
   - Add batch quote endpoint: `POST /trades/batch-quotes`

2. **Simplify authorization:**
   - Merge `x3_isAuthorized` + `x3_getAuthorizedAccounts` into single `/accounts/{id}/permissions` endpoint

3. **Unify finality tracking:**
   - Rename `queryProofFinality` → `queryProofFinalityStatus` (minor clarity improvement)
   - Add batch endpoint: `POST /proofs/batch-finality` (accept array of proof hashes)

4. **Remove experimental methods:**
   - Delete `x3_newCore`, `x3_flashFinalityStatus` (move to private telemetry endpoint)

### Timeline

- **RC-1:** Current RPC surface frozen as-is
- **Testnet:** Allow safe changes (sidecar abstraction)
- **RC-2 Audit:** Review consolidation plan, approve major version bump

---

## Part 6: RPC Freeze Checklist

**Before RC-2 audit, complete:**

- [ ] All 29 RPC methods have documented backing APIs
- [ ] Stability tiers assigned and reviewed
- [ ] Error semantics standardized across all endpoints
- [ ] Sidecar contract spec completed (5+ endpoints designed)
- [ ] Versioning policy established and tested
- [ ] RPC method → API mapping document finalized
- [ ] Client integration tests cover all CORE methods
- [ ] Rate limiting policy defined
- [ ] Batch endpoint performance validated
- [ ] Gateway bridge contract aligned with sidecar design

---

## Part 7: Test Coverage Matrix

| RPC Method | Stability Tier | Unit Test | Integration Test | Sidecar Test |
|-----------|----------------|-----------|-----------------|--------------|
| system_accountNextIndex | CORE | ✅ | ✅ | ✅ |
| payment_queryInfo | CORE | ✅ | ✅ | ✅ |
| submitDispute | CORE | ✅ | ✅ | ⏳ |
| queryDisputeStatus | CORE | ✅ | ✅ | ⏳ |
| queryProofFinality | CORE | ✅ | ✅ | ⏳ |
| recordProofConfirmation | CORE | ✅ | ✅ | ⏳ |
| x3_submitCrossVmTransaction | CORE | ✅ | ✅ | ⏳ |
| x3_getAuthorities | CORE | ✅ | ✅ | ⏳ |
| x3_getCanonicalBalance | CORE | ✅ | ✅ | ✅ |
| x3_estimateGas | CORE | ✅ | ✅ | ✅ |
| **walletDex_estimateSwap** | EXTENSION | ✅ | ⏳ | ⏳ |
| **walletDex_executeSwap** | EXTENSION | ✅ | ⏳ | ⏳ |
| **atomicTrade_*** (5 methods) | EXTENSION | ✅ | ⏳ | ⏳ |
| x3_submitSvmTransaction | EXTENSION | ⏳ | ⏳ | ⏳ |
| x3_submitX3vmTransaction | EXTENSION | ⏳ | ⏳ | ⏳ |
| x3_getAssetMetadata | EXTENSION | ⏳ | ⏳ | ⏳ |
| x3_isAuthorized | EXTENSION | ⏳ | ⏳ | ⏳ |
| x3_getAuthorizedAccounts | EXTENSION | ⏳ | ⏳ | ⏳ |
| x3_getAuthorities | CORE | ✅ | ⏳ | ⏳ |
| requestProofChallenge | EXTENSION | ⏳ | ⏳ | ⏳ |
| x3_newCore | EXPERIMENTAL | ⏳ | N/A | N/A |

**Legend:** ✅ = Implemented | ⏳ = Planned | N/A = Not applicable

---

## Part 8: Rollout Plan

### Phase 12a: Specification (This Phase)
- ✅ Map all 29 RPC methods to backing APIs
- ✅ Define stability tiers
- ✅ Design sidecar contract (5+ endpoints)
- ✅ Establish versioning policy

### Phase 12b: Testing & Documentation
- Implement integration tests for CORE methods
- Add RPC → API mapping to schema files
- Document error semantics
- Create client integration guide

### Phase 12c: Freeze & Gate
- Enable RPC change detection in CI/CD
- Generate API compatibility matrix
- Establish review board for post-testnet changes
- Publish RPC contract to OpenRPC spec format

### Phase 13+: Sidecar Implementation
- Implement sidecar endpoints (Phase 12 design)
- Gateway alignment
- Client library generation from schema

---

## Appendix: Complete RPC Reference

| Method | Backing API | Tier | Phase | Status |
|--------|-------------|------|-------|--------|
| system_accountNextIndex | AccountNonceApi | CORE | Substrate | ✅ |
| payment_queryInfo | TransactionPaymentApi | CORE | Substrate | ✅ |
| submitDispute | GovernanceSettlementApi | CORE | 10a | ✅ |
| queryDisputeStatus | GovernanceSettlementApi | CORE | 10a | ✅ |
| queryProofFinality | SettlementFinalityApi | CORE | 10a | ✅ |
| recordProofConfirmation | SettlementFinalityApi | CORE | 10a | ✅ |
| x3_submitCrossVmTransaction | X3VerifierApi | CORE | 6 | ✅ |
| x3_getAuthorities | GrandpaApi | CORE | Substrate | ✅ |
| x3_getCanonicalBalance | pallet_balances | CORE | 6 | ✅ |
| x3_estimateGas | TransactionPaymentApi | CORE | 6 | ✅ |
| walletDex_estimateSwap | AtomicTradeEngineApi | EXTENSION | 6 | ✅ |
| walletDex_executeSwap | AtomicTradeEngineApi | EXTENSION | 6 | ✅ |
| atomicTrade_createSwap | AtomicTradeEngineApi | EXTENSION | 6 | ✅ |
| atomicTrade_executeSwap | AtomicTradeEngineApi | EXTENSION | 6 | ✅ |
| atomicTrade_getSwapQuote | AtomicTradeEngineApi | EXTENSION | 6 | ✅ |
| atomicTrade_estimateSlippage | AtomicTradeEngineApi | EXTENSION | 6 | ✅ |
| atomicTrade_getSwapStatus | AtomicTradeEngineApi | EXTENSION | 6 | ✅ |
| x3_submitSvmTransaction | X3DomainRegistryApi | EXTENSION | 6 | ✅ |
| x3_submitX3vmTransaction | X3AtomicKernelApi | EXTENSION | 6 | ✅ |
| x3_getAssetMetadata | X3DomainRegistryApi | EXTENSION | 6 | ✅ |
| x3_isAuthorized | AtlasKernelRuntimeApi | EXTENSION | 10a | ✅ |
| x3_getAuthorizedAccounts | AtlasKernelRuntimeApi | EXTENSION | 10a | ✅ |
| requestProofChallenge | X3VerifierApi | EXTENSION | 6 | ✅ |
| x3_newCore | GpuValidatorRuntimeApi | EXPERIMENTAL | 6+ | ✅ |
| x3_flashFinalityStatus | GpuValidatorRuntimeApi | EXPERIMENTAL | 6+ | ✅ |
| **GPU debug endpoints** (4+) | Various | EXPERIMENTAL | 6+ | ⏳ |

**Total: 29 documented methods**  
**Status:** ✅ Specification complete

---

## Key Deliverables (Phase 12)

1. **X3_RPC_SIDECAR_ALIGNMENT.md** (this file) — Complete RPC inventory, stability tiers, sidecar spec
2. **RPC API backing map** — Every method → runtime API relationship documented
3. **Sidecar contract design** — 5+ high-level endpoints with JSON specs
4. **Versioning policy** — How clients handle API evolution
5. **Error semantics** — Standard error format across all endpoints
6. **Test coverage matrix** — What needs unit/integration/sidecar tests

---

## Recommendations

1. **Immediate (Phase 12):**
   - ✅ Complete RPC method inventory
   - ✅ Design sidecar endpoints
   - ✅ Establish versioning policy

2. **Phase 12b:**
   - Implement integration tests for 10 CORE methods
   - Document RPC → API mapping in schema
   - Create client integration guide

3. **Before Testnet:**
   - Consolidate trading methods into unified `/trades/*` namespace
   - Implement sidecar according to Phase 12 spec
   - Enable RPC change detection in CI/CD

4. **Post-Testnet:**
   - Review consolidation plan for RC-2 major version bump
   - Establish post-RC-2 API deprecation policy
   - Create API governance review board

