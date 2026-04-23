# X3 RPC & Sidecar Alignment

**Status:** RC-1 generated-contract handoff  
**Date:** April 22, 2026  
**Scope:** Keep frontend and sidecar consumers anchored to LaunchOps-generated truth instead of a hand-maintained RPC table.

## Contract Source

This file is no longer the canonical RPC inventory. The canonical contract pack is generated from live code into these artifacts under `.launchops/`:

- `runtime_rpc_inventory.json`
- `rpc_contract_matrix.json`
- `rpc_contract_matrix.md`
- `rpc_consumer_contracts.json`
- `rpc_consumer_contracts.md`
- `frontend_route_allowlist.json`
- `frontend_route_allowlist.md`
- `sidecar_adapter_backlog.json`
- `sidecar_adapter_backlog.md`

Refresh the pack with `cargo run -p launchops -- inventory-contracts && cargo run -p launchops -- validate-contract`.

## Consumer Rules

Frontend work should start from `.launchops/rpc_consumer_contracts.json` and then prefer `.launchops/frontend_route_allowlist.json` for route-scoped integration planning.

- `frontend_safe_methods` are the only direct-read candidates.
- `sidecar_only_methods` remain behind a sidecar or node-local adapter, even if they call runtime APIs internally.
- `mock_only_methods` are not live product contracts.

Sidecar work should start from `.launchops/rpc_consumer_contracts.json` and then use `.launchops/sidecar_adapter_backlog.json` as the operational backlog view.

- `pass_through_candidate` means the sidecar can mostly preserve the runtime-backed read surface.
- `orchestrate` means the sidecar owns composition, policy, queueing, billing, or other adapter behavior.
- `defer` means the method is not a stable live contract yet.

## Interpretation Notes

LaunchOps now distinguishes between suspicious bucket drift and expected mixed ownership more explicitly.

- `x3_flashFinalityStatus` is currently treated as an intentional conditional registration pattern rather than a confirmed duplicate-registration bug.
- `x3_submitCrossVmTransaction` remains sidecar-owned, but its mixed ownership is expected because runtime execution and node-local orchestration both participate in the handler.

## What Stays Here

This file remains a human-facing handoff note only. It should not grow another static RPC method table. When the live method inventory, trait hints, node-local signals, or consumer modes change, the source of truth is the generated LaunchOps output under `.launchops/`.

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
3. Poll `queryProofFinality` until the proof reaches a terminal finality state
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

- **RC-1:** Current RPC surface remains provisional until runtime and node-local contract reconciliation completes
- **Testnet:** Allow safe changes (sidecar abstraction)
- **RC-2 Audit:** Review consolidation plan, approve major version bump

---

## Part 6: RPC Freeze Checklist

**Before RC-2 audit, complete:**

- [ ] All 29 RPC methods have documented live code paths and ownership boundaries
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
| requestProofChallenge | EXPERIMENTAL | ⏳ | ⏳ | ⏳ |
| x3_submitCrossVmTransaction | EXTENSION | ✅ | ⏳ | ⏳ |
| x3_getAuthorities | EXTENSION | ✅ | ⏳ | ⏳ |
| x3_getCanonicalBalance | CORE | ✅ | ✅ | ✅ |
| x3_estimateGas | CORE | ✅ | ✅ | ✅ |
| **walletDex_estimateSwap** | EXTENSION | ✅ | ⏳ | ⏳ |
| **walletDex_executeSwap** | EXTENSION | ✅ | ⏳ | ⏳ |
| **atomicTrade_*** (5 methods) | EXTENSION | ✅ | ⏳ | ⏳ |
| x3_submitSvmTransaction | EXTENSION | ⏳ | ⏳ | ⏳ |
| x3_submitX3vmTransaction | EXPERIMENTAL | ✅ | N/A | N/A |
| x3_getAssetMetadata | EXTENSION | ⏳ | ⏳ | ⏳ |
| x3_isAuthorized | EXTENSION | ⏳ | ⏳ | ⏳ |
| x3_getAuthorizedAccounts | EXTENSION | ⏳ | ⏳ | ⏳ |
| x3_newCore | EXPERIMENTAL | ⏳ | N/A | N/A |

**Legend:** ✅ = Implemented | ⏳ = Planned | N/A = Not applicable

---

## Part 8: Rollout Plan

### Phase 12a: Specification (This Phase)
- ✅ Map all 29 RPC methods to current live code paths
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
| queryProofFinality | GovernanceSettlementApi::confirm_settlement_finality | CORE | 10a | ⚠️ |
| requestProofChallenge | No live runtime-backed challenge execution path | EXPERIMENTAL | 6 | ⚠️ |
| x3_submitCrossVmTransaction | AtlasKernelRuntimeApi::submit_evm_transaction + node-local CrossVmBridge queue | EXTENSION | 6 | ⚠️ |
| x3_getAuthorities | AtlasKernelRuntimeApi::get_authorities | EXTENSION | 10a | ✅ |
| x3_getCanonicalBalance | pallet_balances | CORE | 6 | ✅ |
| x3_estimateGas | AtlasKernelRuntimeApi::estimate_evm_gas | CORE | 6 | ✅ |
| walletDex_estimateSwap | WalletDexRpc node-local service | EXTENSION | 6 | ⚠️ |
| walletDex_executeSwap | WalletDexRpc node-local service | EXTENSION | 6 | ⚠️ |
| atomicTrade_createSwap | SwapRPCServer node-local service | EXTENSION | 6 | ⚠️ |
| atomicTrade_executeSwap | SwapRPCServer node-local service | EXTENSION | 6 | ⚠️ |
| atomicTrade_getSwapQuote | SwapRPCServer node-local service | EXTENSION | 6 | ⚠️ |
| atomicTrade_estimateSlippage | SwapRPCServer node-local service | EXTENSION | 6 | ⚠️ |
| atomicTrade_getSwapStatus | SwapRPCServer node-local service | EXTENSION | 6 | ⚠️ |
| x3_submitSvmTransaction | Node-local CrossVmBridge queue | EXTENSION | 6 | ⚠️ |
| x3_submitX3vmTransaction | Intentional guidance error only | EXPERIMENTAL | 6 | ✅ |
| x3_getAssetMetadata | AtlasKernelRuntimeApi::get_asset_metadata | EXTENSION | 6 | ✅ |
| x3_isAuthorized | AtlasKernelRuntimeApi | EXTENSION | 10a | ✅ |
| x3_getAuthorizedAccounts | AtlasKernelRuntimeApi | EXTENSION | 10a | ✅ |
| x3_newCore | No live implementation | EXPERIMENTAL | 6+ | ✅ |
| x3_flashFinalityStatus | Node-local flash finality gadget | EXPERIMENTAL | 6+ | ✅ |
| **GPU debug endpoints** (4+) | Various | EXPERIMENTAL | 6+ | ⏳ |

**Total: 29 documented methods**  
**Status:** ⚠️ Specification reconciled to live code, but not yet frozen

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

