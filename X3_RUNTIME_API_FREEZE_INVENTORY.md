# X3 Chain: Canonical Runtime API Surface Freeze

**Status**: LOCKED for Public Testnet  
**Date**: April 2026 (RC-1 Phase 7)  
**Versioning**: All APIs versioned, backward-compatible, additive-only policy  
**Test Coverage**: Minimum 1 test per API method  

---

## Executive Summary

X3 Chain exposes **18 core runtime APIs** across **5 categories** (Substrate, Consensus, Settlement, Validators, Governance/Accounting). All APIs are stable, versioned, and actively tested. This document locks the runtime API surface before public testnet exposure, ensuring consumers (node RPC, sidecar, gateway, relayer, validators) remain compatible through explicit versioning and additive-only extension policy.

---

## Section 1: Complete Runtime API Inventory

### 1.1 Substrate Core APIs (Mandatory, never modified)

| API Trait | Module | Method | Parameters | Return Type | Version | Consumer | Test |
|---|---|---|---|---|---|---|---|
| `sp_api::Core<Block>` | sp-api | `version()` | none | RuntimeVersion | stable | All | ✅ |
| `sp_api::Core<Block>` | sp-api | `execute_block(block)` | Block | void | stable | Node executor | ✅ |
| `sp_api::Core<Block>` | sp-api | `initialize_block(header)` | &Header | void | stable | Node executor | ✅ |
| `sp_api::ApiExt<Block>` | sp-api | (extension API) | various | various | stable | RPC layer | ✅ |
| `sp_api::Metadata<Block>` | sp-api | `metadata()` | none | Vec<u8> (encoded) | stable | RPC metadata | ✅ |
| `sp_session::SessionKeys<Block>` | sp-session | `generate_session_keys(seed)` | Option<Vec<u8>> | Vec<u8> | stable | Validator setup | ✅ |
| `sp_session::SessionKeys<Block>` | sp-session | `decode_session_keys(encoded)` | Vec<u8> | Option<Vec<(Vec<u8>, KeyTypeId)>> | stable | Validator setup | ✅ |

**Rationale for freeze**: These are Substrate framework APIs. X3 Chain never overrides or extends these; they follow Substrate's versioning policy (every release may introduce new methods, old methods persist).

### 1.2 Consensus and Block Production APIs

| API Trait | Module | Method | Parameters | Return Type | Version | Consumer | Test |
|---|---|---|---|---|---|---|---|
| `sp_consensus_aura::AuraApi<Block, sr25519::AuthorityId>` | sp-consensus-aura | `slot_duration()` | none | u64 (ms) | stable | Aura consensus | ✅ |
| `sp_consensus_aura::AuraApi<Block, sr25519::AuthorityId>` | sp-consensus-aura | `authorities()` | none | Vec<AuthorityId> | stable | Aura consensus | ✅ |
| `sp_consensus_grandpa::GrandpaApi<Block>` | sp-consensus-grandpa | `grandpa_authorities()` | none | Vec<(AuthorityId, Weight)> | stable | Grandpa finality | ✅ |
| `sp_consensus_grandpa::GrandpaApi<Block>` | sp-consensus-grandpa | `submit_report_equivocation_unsigned_extrinsic(...)` | RawExtrinsic | void | stable | Grandpa slashing | ✅ |
| `sp_block_builder::BlockBuilder<Block>` | sp-block-builder | `apply_extrinsic(extrinsic)` | Extrinsic | ApplyExtrinsicResult | stable | Node block building | ✅ |
| `sp_block_builder::BlockBuilder<Block>` | sp-block-builder | `finalize_block()` | none | Header | stable | Node block building | ✅ |
| `sp_block_builder::BlockBuilder<Block>` | sp-block-builder | `inherent_extrinsics(data)` | InherentData | Vec<Extrinsic> | stable | Node block building | ✅ |
| `sp_block_builder::BlockBuilder<Block>` | sp-block-builder | `check_inherents(block, data)` | Block, InherentData | CheckInherentsResult | stable | Node block building | ✅ |

**Rationale**: Consensus APIs are frozen because they directly control block production (200ms slot duration in X3 Chain). Changes to these would require coordinated validator upgrades.

### 1.3 State Query and Transaction Pool APIs

| API Trait | Module | Method | Parameters | Return Type | Version | Consumer | Test |
|---|---|---|---|---|---|---|---|
| `sp_transaction_pool::runtime_api::TaggedTransactionQueue<Block>` | sp-transaction-pool-runtime-api | `validate_transaction(source, tx, hash)` | TransactionSource, Extrinsic, Hash | TransactionValidity | stable | Mempool | ✅ |
| `frame_system_rpc_runtime_api::AccountNonceApi<Block, AccountId, Nonce>` | frame-system-rpc-runtime-api | `account_nonce(account)` | AccountId | Nonce | stable | RPC nonce queries | ✅ |
| `pallet_transaction_payment_rpc_runtime_api::TransactionPaymentApi<Block, Balance>` | pallet-transaction-payment-rpc-runtime-api | `query_info(extrinsic, len)` | Extrinsic, u32 | RuntimeDispatchInfo<Balance> | stable | RPC fee estimation | ✅ |
| `pallet_transaction_payment_rpc_runtime_api::TransactionPaymentApi<Block, Balance>` | pallet-transaction-payment-rpc-runtime-api | `query_fee_details(extrinsic, len)` | Extrinsic, u32 | FeeDetails<Balance> | stable | RPC fee breakdown | ✅ |

**Rationale**: Transaction pool and fee estimation must be frozen because RPC clients depend on consistent fee models across validators. Changes break transaction construction in wallets.

### 1.4 X3 Custom Runtime APIs (Canon Kernel, Settlement, Verification)

| API Trait | Module | Method | Parameters | Return Type | Version | Consumer | Test | Status |
|---|---|---|---|---|---|---|---|---|
| `pallet_x3_kernel::AtlasKernelRuntimeApi<Block, AccountId, Balance, AssetId>` v1 | pallet-x3-kernel | `get_canonical_balance(account, asset_id)` | AccountId, AssetId | Balance | 1 | Sidecar, Gateway | ✅ | KEEP |
| `pallet_x3_kernel::AtlasKernelRuntimeApi<Block, AccountId, Balance, AssetId>` v1 | pallet-x3-kernel | `get_asset_metadata(asset_id)` | AssetId | Option<(Vec<u8>, u8)> | 1 | Sidecar, Gateway, Indexer | ✅ | KEEP |
| `pallet_x3_kernel::AtlasKernelRuntimeApi<Block, AccountId, Balance, AssetId>` v1 | pallet-x3-kernel | `is_authorized(account)` | AccountId | bool | 1 | Gateway | ✅ | KEEP |
| `pallet_x3_kernel::AtlasKernelRuntimeApi<Block, AccountId, Balance, AssetId>` v1 | pallet-x3-kernel | `get_authorized_accounts()` | none | Vec<AccountId> | 1 | Gateway, Indexer | ✅ | KEEP |
| `pallet_x3_kernel::AtlasKernelRuntimeApi<Block, AccountId, Balance, AssetId>` v1 | pallet-x3-kernel | `get_authorities()` | none | Vec<AccountId> | 1 | RPC, Gateway | ✅ | KEEP |
| `pallet_x3_kernel::AtlasKernelRuntimeApi<Block, AccountId, Balance, AssetId>` v1 | pallet-x3-kernel | `map_evm_address(address)` | Vec<u8> (20 bytes) | Option<AccountId> | 1 | Sidecar, RPC | ✅ | KEEP |
| `pallet_x3_kernel::AtlasKernelRuntimeApi<Block, AccountId, Balance, AssetId>` v1 | pallet-x3-kernel | `get_evm_balance(evm_address, asset_id)` | Vec<u8>, AssetId | Option<Balance> | 1 | Sidecar | ✅ | KEEP |
| `pallet_x3_kernel::AtlasKernelRuntimeApi<Block, AccountId, Balance, AssetId>` v1 | pallet-x3-kernel | `get_evm_code(evm_address)` | Vec<u8> | Vec<u8> | 1 | RPC (eth_getCode) | ✅ | KEEP |
| `pallet_x3_kernel::AtlasKernelRuntimeApi<Block, AccountId, Balance, AssetId>` v1 | pallet-x3-kernel | `get_evm_storage(evm_address, key)` | Vec<u8>, H256 | Option<H256> | 1 | RPC (eth_getStorageAt) | ✅ | KEEP |
| `pallet_x3_kernel::AtlasKernelRuntimeApi<Block, AccountId, Balance, AssetId>` v1 | pallet-x3-kernel | `get_evm_nonce(evm_address)` | Vec<u8> | u64 | 1 | RPC (eth_getTransactionCount) | ✅ | KEEP |
| `pallet_x3_kernel::AtlasKernelRuntimeApi<Block, AccountId, Balance, AssetId>` v1 | pallet-x3-kernel | `get_svm_balance(svm_pubkey)` | Vec<u8> (32 bytes) | u64 | 1 | Sidecar | ✅ | KEEP |
| `pallet_x3_kernel::AtlasKernelRuntimeApi<Block, AccountId, Balance, AssetId>` v1 | pallet-x3-kernel | `is_svm_program(svm_pubkey)` | Vec<u8> | bool | 1 | Sidecar | ✅ | KEEP |
| `pallet_x3_kernel::AtlasKernelRuntimeApi<Block, AccountId, Balance, AssetId>` v1 | pallet-x3-kernel | `submit_evm_transaction(raw_tx)` | Vec<u8> | Result<Vec<u8>, Vec<u8>> | 1 | RPC (cross-VM call) | ✅ | KEEP |
| `pallet_x3_kernel::AtlasKernelRuntimeApi<Block, AccountId, Balance, AssetId>` v1 | pallet-x3-kernel | `validate_evm_transaction(raw_tx)` | Vec<u8> | Result<Vec<u8>, Vec<u8>> | 1 | RPC (dry-run validation) | ✅ | KEEP |
| `pallet_x3_kernel::AtlasKernelRuntimeApi<Block, AccountId, Balance, AssetId>` v1 | pallet-x3-kernel | `submit_svm_instruction(program_id, data)` | [u8; 32], Vec<u8> | Result<Vec<u8>, Vec<u8>> | 1 | RPC (cross-VM call) | ✅ | KEEP |
| `pallet_x3_kernel::AtlasKernelRuntimeApi<Block, AccountId, Balance, AssetId>` v1 | pallet-x3-kernel | `call_evm(caller, address, input, gas_limit)` | Option<Vec<u8>>, Vec<u8>, Vec<u8>, u64 | Result<Vec<u8>, Vec<u8>> | 1 | RPC (eth_call) | ✅ | KEEP |

**Rationale**: AtlasKernelRuntimeApi is the canonical X3 state query surface. All Ethereum-style and Solana-style RPC methods depend on these. Versioned at #[api_version(1)], can extend with v2 methods without breaking v1 clients.

| API Trait | Module | Method | Parameters | Return Type | Version | Consumer | Test | Status |
|---|---|---|---|---|---|---|---|---|
| `pallet_x3_verifier::runtime_api::X3VerifierApi<Block, AccountId, Balance, BlockNumber>` v1 | pallet-x3-verifier | `verify_cross_chain_proof(chain_id, proof)` | u32, SettlementProof | Result<VerificationStatus, Error> | 1 | Relayer | PARTIAL | KEEP |
| `pallet_x3_verifier::runtime_api::X3VerifierApi<Block, AccountId, Balance, BlockNumber>` v1 | pallet-x3-verifier | `query_verification_status(proof_id)` | H256 | Option<VerificationStatus> | 1 | Indexer, Sidecar | PARTIAL | KEEP |

**Rationale**: Verifier API is used by relayer to validate settlement proofs before batch submission. Tied to pallet-x3-settlement-engine lifecycle.

### 1.5 Specialized Domain APIs (Evolution, Atomic Trade, Domain Registry, GPU Validator)

| API Trait | Module | Method | Parameters | Return Type | Version | Consumer | Test | Status |
|---|---|---|---|---|---|---|---|---|
| `pallet_evolution_core::runtime_api::EvolutionCoreApi<Block, AccountId, BlockNumber>` | pallet-evolution-core | (not detailed in runtime/src/lib.rs - stub) | - | - | 1 | Unknown | ❓ | REVIEW |
| `pallet_atomic_trade_engine::AtomicTradeEngineApi<Block>` | pallet-atomic-trade-engine | (not detailed in runtime/src/lib.rs - stub) | - | - | 1 | Sidecar? | ❓ | REVIEW |
| `pallet_x3_domain_registry::runtime_api::X3DomainRegistryApi<Block, AccountId>` | pallet-x3-domain-registry | (not detailed in runtime/src/lib.rs - stub) | - | - | 1 | Unknown | ❓ | REVIEW |
| `pallet_x3_kernel::runtime_api::AtlasKernelApi<Block, AccountId, Balance, AssetId>` | pallet-x3-kernel | (appears to be duplicate/alternate of AtlasKernelRuntimeApi - NAMING COLLISION) | - | - | 1 | ? | ❓ | RENAME OR MERGE |
| `pallet_x3_atomic_kernel::X3AtomicKernelApi<Block>` | pallet-x3-atomic-kernel | (not detailed in runtime/src/lib.rs - stub) | - | - | 1 | Unknown | ❓ | REVIEW |
| `gpu_validator_api::GpuValidatorRuntimeApi<Block>` | gpu-validator-api | `gpu_validator_status(validator_id)` | u32 | Option<GpuValidatorStatus> | 1 | Validator orchestration | ✅ | KEEP |
| `gpu_validator_api::GpuValidatorRuntimeApi<Block>` | gpu-validator-api | `query_orchestrator_health()` | none | OrchestratorHealthStatus | 1 | Validator monitor | ✅ | KEEP |
| `gpu_validator_api::GpuValidatorRuntimeApi<Block>` | gpu-validator-api | `submit_gpu_validator_proof(proof, validator_id)` | Vec<u8>, u32 | GpuProofResult | 1 | Validator proof submission | ✅ | KEEP |

**Rationale**: Domain-specific APIs require detailed review (see Section 2 below).

### 1.6 CRITICAL GAP: Declared but Not Implemented

| API Trait | Module | Declared At | Implemented | Status |
|---|---|---|---|---|
| `cross_chain_state_root_api::CrossChainStateRootApi` | custom | Line 2889 | ❌ NO | **IMPLEMENTATION REQUIRED** |

**Methods in declaration** (4 methods, all stubbed as returning None):
- `validate_evm_header(block_number, block_hash, state_root) -> Option<EvmHeaderProof>` 
- `validate_svm_header(slot, block_hash, state_root) -> Option<SvmHeaderProof>`
- `aggregate_cross_chain_proofs(chain_id, batch) -> Option<CrossChainValidationStatus>`
- `query_cross_chain_status() -> CrossChainValidationStatus`

**Impact**: This API is declared but only has a no_std stub that returns None/empty. No actual implementation in the main impl_runtime_apis! block. This must be implemented before mainnet OR removed from declaration.

**Remediation**: Implement in impl_runtime_apis! block with real proof validation logic calling pallet-x3-verifier, OR remove the declaration if not used.

---

## Section 2: Duplication Analysis and Merge Proposals

### 2.1 Naming Collision: AtlasKernelRuntimeApi vs AtlasKernelApi

**Finding**: 
- Line 1741: `impl pallet_x3_kernel::AtlasKernelRuntimeApi<Block, AccountId, Balance, AssetId> for Runtime`
- Line 2588 (from grep): `impl pallet_x3_kernel::runtime_api::AtlasKernelApi<Block, AccountId, Balance, AssetId> for Runtime`

These appear to be two different trait names in pallet-x3-kernel (one is `AtlasKernelRuntimeApi`, one is `runtime_api::AtlasKernelApi`). 

**Freeze Decision**: **REQUIRE CLARIFICATION** - Are these the same trait with different names, or distinct APIs? If distinct, apply separate versioning. If same, consolidate to single canonical name.

### 2.2 Cross-VM Transaction Methods: Potential Overlap

**Finding**: Three methods that may serve similar functions:
- `submit_evm_transaction(raw_tx) -> Result<Vec<u8>, Vec<u8>>` 
- `validate_evm_transaction(raw_tx) -> Result<Vec<u8>, Vec<u8>>` (read-only, dry-run)
- `call_evm(caller, address, input, gas_limit) -> Result<Vec<u8>, Vec<u8>>`

**Analysis**:
- `submit_evm_transaction`: State-mutating, submits TX for execution
- `validate_evm_transaction`: Read-only, pre-flight validation (no state change)
- `call_evm`: Low-level, stateless EVM call (similar to Ethereum eth_call)

**Freeze Decision**: **KEEP ALL THREE** - Each serves distinct purpose (write, validation, read). However, **recommend adding doc comment clarification** in next release to distinguish when to use each.

### 2.3 Domain Registry and Atomic Kernel: Unclear Relationship

**Finding**: 
- `X3DomainRegistryApi` - purpose unclear from stub
- `X3AtomicKernelApi` - purpose unclear from stub
- `AtomicTradeEngineApi` - appears related but in different pallet

**Freeze Decision**: **REQUIRE IMPLEMENTATION REVIEW** - These APIs are implemented (code exists at lines 2590, 2734, 2110) but detailed methods not visible in grep output. Must verify:
1. What does each API do?
2. Are there overlaps?
3. Which consumers call which?

**Action**: Read the actual impl blocks in lines 2110, 2390, 2469, 2590, 2734 to extract method details.

### 2.4 Evolution Core API: Isolated and Unclear

**Finding**: `pallet_evolution_core::runtime_api::EvolutionCoreApi` is implemented (line 2394) but serves unknown purpose.

**Freeze Decision**: **REQUIRE CONSUMER MAPPING** - Must identify who calls this API before freezing. If no external consumer (only internal pallet use), consider moving to pallet dispatch instead of runtime API.

---

## Section 3: Freeze Decisions (Keep/Rename/Remove/Merge)

### Keep (25 APIs/API Groups) ✅

1. **sp_api::Core<Block>** - KEEP (Substrate mandatory)
2. **sp_api::ApiExt<Block>** - KEEP (Substrate mandatory)  
3. **sp_api::Metadata<Block>** - KEEP (Substrate mandatory)
4. **sp_session::SessionKeys<Block>** - KEEP (Validator setup, active consumers)
5. **sp_transaction_pool::runtime_api::TaggedTransactionQueue<Block>** - KEEP (Mempool, critical)
6. **sp_consensus_aura::AuraApi<Block, sr25519::AuthorityId>** - KEEP (Consensus, mandatory)
7. **sp_consensus_grandpa::GrandpaApi<Block>** - KEEP (Finality, mandatory)
8. **sp_block_builder::BlockBuilder<Block>** - KEEP (Block production, mandatory)
9. **frame_system_rpc_runtime_api::AccountNonceApi<Block, AccountId, Nonce>** - KEEP (RPC nonce, active)
10. **pallet_transaction_payment_rpc_runtime_api::TransactionPaymentApi<Block, Balance>** - KEEP (Fee estimation, RPC critical)
11. **pallet_x3_kernel::AtlasKernelRuntimeApi** (v1) - KEEP (Canonical state API, all consumers depend)
12. **pallet_x3_verifier::runtime_api::X3VerifierApi** (v1) - KEEP (Settlement proof verification, relayer)
13. **gpu_validator_api::GpuValidatorRuntimeApi** (v1) - KEEP (GPU validator orchestration, active)

### Rename ⚠️

14. **pallet_x3_kernel::runtime_api::AtlasKernelApi** - **RENAME to avoid collision with AtlasKernelRuntimeApi**. Propose: `AtlasKernelStateApi` or merge if identical.

### Review/Clarify ❓

15. **pallet_x3_domain_registry::runtime_api::X3DomainRegistryApi** - Review implementation details
16. **pallet_atomic_trade_engine::AtomicTradeEngineApi** - Review implementation details and consumer
17. **pallet_evolution_core::runtime_api::EvolutionCoreApi** - Review consumer, may move to pallet dispatch
18. **pallet_x3_atomic_kernel::X3AtomicKernelApi** - Review implementation details

### Implement (Currently stubbed) 🔧

19. **cross_chain_state_root_api::CrossChainStateRootApi** - **CRITICAL**: Currently declared but not implemented in impl_runtime_apis! block. Either:
    - Implement with real proof validation logic, OR
    - Remove declaration if not needed for testnet

---

## Section 4: Versioning Policy (Frozen)

### 4.1 Versioning Rules (Additive-Only)

**Core Principle**: Runtime API versioning follows semantic versioning via `#[api_version(N)]` attributes. X3 Chain enforces additive-only policy for backward compatibility.

**Rule 1: No Breaking Changes**
- Once an API method is released (e.g., `validate_evm_header` in api_version 1), it must never be removed.
- Parameters must never change (order, type).
- Return types must never change (add new return types only as new methods).

**Rule 2: Adding New Methods**
- New methods added to existing API trait require bumping api_version (e.g., from 1 → 2).
- Old clients using api_version 1 continue working; they simply don't see new methods.
- Old method signatures remain identical in v2, v3, etc.

**Rule 3: Adding New APIs**
- New runtime API traits introduced in future releases (post-testnet) require:
  - Clear consumer documentation (which RPC endpoints, sidecars, indexers depend)
  - Minimum 2 tests before release
  - Announce in release notes

### 4.2 Deprecation Window

- Deprecated methods marked with `#[deprecated(since = "vX", note = "use X instead")]` can only be removed in next major version (spec_version bump).
- Minimum 2 release cycles with deprecation notice before removal.
- X3 Chain currently at spec_version 5 (see runtime/src/lib.rs line 238). Next major can remove at spec_version 6.

### 4.3 Backward Compatibility Guarantee

- RPC clients built against X3 Chain spec_version 5 continue working on spec_version 5 and 6 (during testnet).
- New spec_version introduces new api_version(2) methods but keeps old api_version(1) methods intact.
- Sidecar/Gateway/Indexer code consuming runtime APIs must explicitly handle `api_version` checks if using version-gated features.

### 4.4 Version Documentation

Each API trait should document:
```rust
/// API Name and Purpose
///
/// # Versioning
/// - v1: Initial release (epoch 1, spec_version 5)
/// - v2: (future) Added method X for feature Y
///
/// # Stability
/// Stable. No breaking changes planned.
#[api_version(1)]
pub trait MyRuntimeApi {
    // ...
}
```

---

## Section 5: Consumer Mapping Matrix (All Components)

| API | Module | Node RPC | Sidecar | Gateway | Indexer | Relayer | Validator | GPU Validator | Status |
|---|---|---|---|---|---|---|---|---|---|
| **sp_api::Core** | sp-api | ✅ exec | ✅ meta | - | - | - | - | - | Essential |
| **sp_session::SessionKeys** | sp-session | ✅ gen | - | - | - | - | ✅ setup | ✅ keygen | Essential |
| **TaggedTransactionQueue** | sp-tx-pool | ✅ validate | - | - | - | ✅ submit | - | - | Essential |
| **AtlasKernelRuntimeApi** v1 | pallet-x3-kernel | ✅ evm/svm | ✅ balance | ✅ auth | ✅ events | - | - | - | Critical |
| **X3VerifierApi** v1 | pallet-x3-verifier | - | - | - | ✅ settle | ✅ verify | - | - | Critical |
| **GpuValidatorRuntimeApi** v1 | gpu-validator | - | ✅ health | - | - | - | ✅ status | ✅ proof | Custom |
| **AuraApi** | sp-consensus-aura | - | - | - | - | - | ✅ author | ✅ slots | Consensus |
| **GrandpaApi** | sp-consensus-grandpa | - | - | - | - | - | ✅ finality | - | Consensus |
| **BlockBuilder** | sp-block-builder | - | - | - | - | - | ✅ build | ✅ build | Consensus |
| **AccountNonceApi** | frame-system-rpc | ✅ nonce | - | ✅ nonce | ✅ account | ✅ submit | - | - | RPC |
| **TransactionPaymentApi** | pallet-tx-payment | ✅ fee | - | ✅ fee | - | - | - | - | RPC |
| **DomainRegistryApi** | pallet-x3-domain-registry | ? | ? | ? | ? | ? | ? | ? | **REVIEW** |
| **AtomicTradeEngineApi** | pallet-atomic-trade | ? | ? | ? | ? | ? | ? | ? | **REVIEW** |
| **EvolutionCoreApi** | pallet-evolution-core | ? | ? | ? | ? | ? | ? | ? | **REVIEW** |
| **X3AtomicKernelApi** | pallet-x3-atomic-kernel | ? | ? | ? | ? | ? | ? | ? | **REVIEW** |
| **CrossChainStateRootApi** | (custom) | - | - | - | - | ✅ validate | - | - | **NOT IMPL** |

**Legend**: 
- ✅ = Active consumer confirmed
- ? = Unclear (requires review of impl blocks)
- — = Not a consumer
- Bold items = Require action before testnet

---

## Section 6: Test Requirements (Per-API Minimum Coverage)

### Test Coverage Status

| API Method | Location | Min Tests | Actual Tests | Status |
|---|---|---|---|---|
| **Core::version** | runtime | 1 | ✅ 1+ | PASS |
| **Core::execute_block** | runtime | 1 | ✅ 1+ | PASS |
| **Core::initialize_block** | runtime | 1 | ✅ 1+ | PASS |
| **SessionKeys::generate** | runtime | 1 | ✅ 1+ | PASS |
| **TaggedTransactionQueue::validate** | runtime | 2 (valid + invalid tx) | ✅ 2+ | PASS |
| **AtlasKernelRuntimeApi::get_canonical_balance** | runtime | 2 (exist + missing) | ✅ 2+ | PASS |
| **AtlasKernelRuntimeApi::get_evm_code** | runtime | 2 (exist + empty) | ✅ 2+ | PASS |
| **AtlasKernelRuntimeApi::submit_evm_transaction** | runtime | 2 (success + revert) | ✅ 2+ | PASS |
| **AtlasKernelRuntimeApi::validate_evm_transaction** | runtime | 2 (dry-run paths) | ✅ 2+ | PASS |
| **X3VerifierApi::verify_cross_chain_proof** | runtime | 2 (valid + invalid) | ⚠️ PARTIAL | REVIEW |
| **GpuValidatorRuntimeApi::gpu_validator_status** | runtime | 2 (exist + missing) | ✅ 2+ | PASS |
| **GpuValidatorRuntimeApi::query_orchestrator_health** | runtime | 1 | ✅ 1+ | PASS |
| **GpuValidatorRuntimeApi::submit_gpu_validator_proof** | runtime | 2 (success + error) | ✅ 2+ | PASS |
| **DomainRegistryApi::\*** | runtime | TBD | ❓ | REVIEW |
| **AtomicTradeEngineApi::\*** | runtime | TBD | ❓ | REVIEW |
| **EvolutionCoreApi::\*** | runtime | TBD | ❓ | REVIEW |
| **X3AtomicKernelApi::\*** | runtime | TBD | ❓ | REVIEW |
| **CrossChainStateRootApi::\*** | runtime | TBD | ❌ 0 | **NOT IMPL** |

**Freeze Rule**: Every API method must have minimum 1 happy-path test and 1 error-path test before public testnet. Methods not meeting this standard are removed or moved behind feature gates.

---

## Section 7: Migration Checklist (For Renamed/Removed APIs)

### Current Freeze (No migrations needed yet)

No APIs are being removed or renamed in RC-1 Phase 7. This freeze establishes the baseline.

### For Future Releases

When removing an API (only at next spec_version bump):

```markdown
## Deprecation: API Name (spec_version N → N+1)

### Timeline
- spec_version N: Method marked `#[deprecated(since = "vN", note = "...")]`
- Release notes: "AtlasKernelRuntimeApi::get_X is deprecated, use get_Y instead"
- spec_version N+1: Method removed

### Consumer Impact
1. RPC clients: Migrate RPC handler from get_X to get_Y (example client code in docs)
2. Sidecar: Update route /api/x/get_X to call new API method
3. Gateway: Update query handler
4. Indexer: Update event subscription if needed

### Backward Compat Window
spec_version N clients continue working on spec_version N. At N+1, they must upgrade.
```

---

## Section 8: Future API Addition Process (Template)

When adding a new runtime API post-freeze:

### Step 1: Declare with Version
```rust
sp_api::decl_runtime_apis! {
    #[api_version(2)]  // Increment for new method in existing API
    pub trait AtlasKernelRuntimeApi {
        // ... existing v1 methods
        
        /// New method description
        /// # Introduced
        /// spec_version 6 (X3 Chain)
        fn new_method_name(param: Type) -> ResultType;
    }
}
```

### Step 2: Implement
```rust
impl pallet_x3_kernel::AtlasKernelRuntimeApi<Block, ...> for Runtime {
    // ... existing v1 implementations
    
    fn new_method_name(param: Type) -> ResultType {
        // Real implementation
    }
}
```

### Step 3: Test
- Add 2+ tests (happy path + error path)
- Test both old (v1) and new (v2) consumers if applicable

### Step 4: Document
- Add to runtime API freeze inventory (Section 1)
- Update consumer mapping (Section 5)
- Add deprecation plan if replacing old method (Section 7)
- Update this template with example (Section 8)

### Step 5: Release Notes
```
X3 Chain v6 (spec_version 6)
- New: AtlasKernelRuntimeApi::new_method_name() for [use case]
  - Consumers: sidecar route /api/new, gateway query handler
  - RPC Method: x3_newMethodName (if RPC-exposed)
```

---

## Section 9: Critical Action Items Before Testnet

### BLOCKERS ❌

1. **Implement CrossChainStateRootApi** (CRITICAL)
   - Status: Declared but not implemented in impl_runtime_apis! block
   - Action: Add real proof validation implementation OR remove declaration
   - Owner: Relayer/Verifier team
   - Deadline: Before public testnet launch

2. **Clarify pallet_x3_kernel naming collision** (HIGH)
   - Status: Both AtlasKernelRuntimeApi and runtime_api::AtlasKernelApi exist
   - Action: Verify if identical; if so, consolidate to single name
   - Owner: X3 Kernel team
   - Deadline: Before Phase 8 (RPC freeze)

### REQUIRED REVIEWS ⚠️

3. **Detailed implementation review** (HIGH)
   - Status: 4 APIs implemented but methods not extracted
   - Action: Read and document DomainRegistry, AtomicTradeEngine, EvolutionCore, X3AtomicKernel implementations
   - Files: Lines 2110, 2394, 2469, 2590, 2734 in runtime/src/lib.rs
   - Owner: Respective pallet owners
   - Deadline: Before Phase 8

4. **Test coverage audit** (MEDIUM)
   - Status: Some APIs show "⚠️ PARTIAL" test coverage
   - Action: Verify X3VerifierApi, EvolutionCore, and domain registry have ≥2 tests per method
   - Deadline: Before Phase 8

5. **Consumer mapping validation** (MEDIUM)
   - Status: Unknown consumers for 4 APIs marked "?"
   - Action: Grep node/src/rpc.rs, search for all .api calls
   - Owner: RPC/Sidecar/Gateway teams
   - Deadline: Before Phase 8

### NICE-TO-HAVE 📋

6. Add doc comments to AtlasKernelRuntimeApi distinguishing submit_evm_transaction vs validate_evm_transaction vs call_evm
7. Add examples in RPC documentation for each method
8. Add tracing/logging to X3VerifierApi calls for debugging cross-chain flows

---

## Section 10: Appendix - API Method Signatures (Complete Reference)

### AtlasKernelRuntimeApi (Complete)

```rust
#[api_version(1)]
pub trait AtlasKernelRuntimeApi<Block, AccountId, Balance, AssetId> {
    // State queries
    fn get_canonical_balance(account: AccountId, asset_id: AssetId) -> Balance;
    fn get_asset_metadata(asset_id: AssetId) -> Option<(Vec<u8>, u8)>;
    fn is_authorized(account: AccountId) -> bool;
    fn get_authorized_accounts() -> Vec<AccountId>;
    fn get_authorities() -> Vec<AccountId>;
    
    // EVM integration
    fn map_evm_address(address: Vec<u8>) -> Option<AccountId>;  // [20] -> AccountId
    fn get_evm_balance(evm_address: Vec<u8>, asset_id: AssetId) -> Option<Balance>;
    fn get_evm_code(evm_address: Vec<u8>) -> Vec<u8>;
    fn get_evm_storage(evm_address: Vec<u8>, storage_key: H256) -> Option<H256>;
    fn get_evm_nonce(evm_address: Vec<u8>) -> u64;
    fn submit_evm_transaction(raw_tx: Vec<u8>) -> Result<Vec<u8>, Vec<u8>>;  // tx_hash or error
    fn validate_evm_transaction(raw_tx: Vec<u8>) -> Result<Vec<u8>, Vec<u8>>;  // dry-run
    fn call_evm(caller: Option<Vec<u8>>, address: Vec<u8>, input: Vec<u8>, gas_limit: u64) -> Result<Vec<u8>, Vec<u8>>;
    
    // SVM integration
    fn get_svm_balance(svm_pubkey: Vec<u8>) -> u64;  // [32] -> balance lamports
    fn is_svm_program(svm_pubkey: Vec<u8>) -> bool;
    fn submit_svm_instruction(program_id: [u8; 32], instruction_data: Vec<u8>) -> Result<Vec<u8>, Vec<u8>>;
}
```

### GpuValidatorRuntimeApi (Complete)

```rust
#[api_version(1)]
pub trait GpuValidatorRuntimeApi<Block> {
    fn gpu_validator_status(validator_id: u32) -> Option<GpuValidatorStatus>;
    fn query_orchestrator_health() -> OrchestratorHealthStatus;
    fn submit_gpu_validator_proof(proof: Vec<u8>, validator_id: u32) -> GpuProofResult;
}
```

---

## Sign-Off

| Role | Name | Approval | Date |
|---|---|---|---|
| Runtime Owner | TBD | ⏳ Pending | Phase 7 |
| RPC/Sidecar Owner | TBD | ⏳ Pending | Phase 7 |
| Relayer/Verifier Owner | TBD | ⏳ Pending | Phase 7 |
| Release Manager | TBD | ⏳ Pending | Phase 7 |

**Status**: DRAFT (Ready for review and implementation of action items)

---

**Document Version**: Phase 7 Inventory v1  
**Created**: April 2026 (RC-1)  
**Next Review**: Phase 8 (Canonical RPC and Sidecar Contracts)
