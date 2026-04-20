# Phase 9: Canonical Bridge and Relayer Flows - Execution Plan

**RC-1 Phase 9** implements cross-chain proof validation and bridges Phase 7 (frozen runtime APIs) with Phase 6 (relayer service) to enable end-to-end settlement.

## Phase 9 Objectives

### Primary Goals
1. **Implement CrossChainStateRootApi** (deferred from Phase 8)
   - Proof validation methods: validate_evm_header, validate_svm_header
   - Status query: query_cross_chain_status
   - Finality aggregation: aggregate_cross_chain_proofs

2. **Integrate pallet-x3-verifier** 
   - EVM header proof validation (using existing pallet structure)
   - SVM header proof validation (Solana-style)
   - Proof chain construction and verification

3. **Wire Relayer → Verification → Settlement**
   - x3-relayer (Phase 6) submits proofs
   - pallet-x3-verifier validates proofs
   - pallet-x3-settlement-engine records validated state
   - Query APIs expose validated cross-chain state

4. **Enable Cross-Chain RPC Methods**
   - `validate_evmHeader(block_number, block_hash, state_root)` → validates EVM proof
   - `validate_svmHeader(slot, block_hash, state_root)` → validates SVM proof
   - `query_crossChainStatus()` → returns validation statistics

### Secondary Goals
- Feature gate behind `cross-chain-verification` flag
- Add comprehensive error handling for proof validation failures
- Create X3_BRIDGE_RELAYER_SPECIFICATION.md (Phase 9 deliverable)
- Verify end-to-end testnet settlement flow

---

## Phase 9 Work Breakdown

### Section 1: Implement CrossChainStateRootApi (runtime/src/lib.rs)

**Location**: runtime/src/lib.rs, implement in `impl_runtime_apis!` block

**API Definition** (already in sp_api::decl_runtime_apis! from Phase 7):
```rust
sp_api::decl_runtime_apis! {
    // ... other APIs ...
    pub trait CrossChainStateRootApi {
        fn validate_evm_header(
            block_number: u64,
            block_hash: H256,
            state_root: H256,
        ) -> Option<CrossChainHeaderProof>;
        
        fn validate_svm_header(
            slot: u64,
            block_hash: H256,
            state_root: H256,
        ) -> Option<CrossChainHeaderProof>;
        
        fn query_cross_chain_status() -> CrossChainStatus;
        
        fn aggregate_cross_chain_proofs(
            proofs: Vec<CrossChainHeaderProof>,
        ) -> Option<AggregatedProof>;
    }
}
```

**Implementation** (add to impl_runtime_apis! block):
```rust
impl pallet_x3_kernel::CrossChainStateRootApi<Block> for Runtime {
    fn validate_evm_header(block_number: u64, block_hash: H256, state_root: H256) -> Option<CrossChainHeaderProof> {
        // 1. Query pallet_x3_verifier for proof validation
        // 2. Return HeaderProof with block_number, block_hash, state_root, confirmation_count
        // 3. Record metric: cross_chain_header_validated
        // TODO: Call pallet-x3-verifier::Pallet::<T>::validate_evm_header()
    }
    
    fn validate_svm_header(slot: u64, block_hash: H256, state_root: H256) -> Option<CrossChainHeaderProof> {
        // 1. Validate Solana-style slot and block hash
        // 2. Check finality requirements (32 confirmations for SVM)
        // TODO: Call pallet-x3-verifier::Pallet::<T>::validate_svm_header()
    }
    
    fn query_cross_chain_status() -> CrossChainStatus {
        // 1. Read pallet-x3-verifier storage: confirmed_headers, validation_failures
        // 2. Calculate statistics: evm_validated, svm_validated, total_failures
        // TODO: Aggregate from pallet storage
    }
    
    fn aggregate_cross_chain_proofs(proofs: Vec<CrossChainHeaderProof>) -> Option<AggregatedProof> {
        // 1. Verify all proofs are from finalized chains
        // 2. Construct merkle tree of proofs
        // 3. Return aggregated proof with confidence score
        // TODO: Use merkle tree from pallet-x3-settlement-engine
    }
}
```

**Types Definition** (add to runtime/src/lib.rs):
```rust
#[derive(Encode, Decode, Clone, Debug, PartialEq, Eq)]
pub struct CrossChainHeaderProof {
    pub block_number: u64,
    pub block_hash: H256,
    pub state_root: H256,
    pub confirmation_count: u32,
    pub validator_signatures: Vec<[u8; 65]>,  // Ethereum-style signatures
    pub proof_type: ProofType,  // Merkle, LightClient, SPV, Wormhole, IBC
    pub timestamp: u64,
}

#[derive(Encode, Decode, Clone, Debug, PartialEq, Eq)]
pub struct CrossChainStatus {
    pub evm_headers_validated: u64,
    pub svm_headers_validated: u64,
    pub total_validation_failures: u64,
    pub last_validated_block: Option<u64>,
    pub active_confirmations: u32,  // Minimum finality for accepting proofs
}

#[derive(Encode, Decode, Clone, Debug, PartialEq, Eq)]
pub enum ProofType {
    Merkle,
    LightClient,
    Spv,
    Wormhole,
    Ibc,
}
```

**Dependencies**:
- pallet-x3-verifier storage queries (confirmed_headers, validation_failures)
- pallet-x3-settlement-engine merkle tree construction
- Finality oracle from consensus (HotStuff + PoH)

**Effort**: 60 minutes (implementation + testing)

---

### Section 2: Wire Relayer Proof Submission

**File**: node/src/service.rs (existing relayer integration)

**Changes**: Currently relayer calls `SubmissionHandler::submit_proof()` with stub implementation. Phase 9 wires to actual verification:

```rust
// In SubmissionHandler::do_submit()
async fn do_submit(&self, chain_id: u64, intent_id: H256, proof: SettlementProof) -> Result<H256> {
    // 1. Call CrossChainStateRootApi::validate_evm_header (or validate_svm_header)
    // 2. On success, get CrossChainHeaderProof
    // 3. Call pallet-x3-settlement-engine::submit_proof(intent_id, chain_id, proof)
    // 4. Record metric: settlement_proof_validated
    // 5. Return extrinsic hash
    
    let runtime_api = self.rpc_client.runtime_api();
    let best_hash = self.rpc_client.info().best_hash;
    
    let header_proof = runtime_api
        .validate_evm_header(best_hash, proof.block_number, proof.block_hash, proof.state_root)?
        .ok_or(RelayerError::InvalidProof)?;
    
    // Now submit to settlement engine
    let extrinsic_hash = self.submit_to_settlement_engine(intent_id, chain_id, header_proof).await?;
    
    Ok(extrinsic_hash)
}
```

**Location**: crates/x3-relayer/src/submission_handler.rs

**Effort**: 30 minutes (wire existing pieces)

---

### Section 3: Re-enable Cross-Chain RPC Methods

**File**: node/src/rpc.rs (previously removed as orphaned in Phase 8)

**Re-add** with proper implementation (lines ~180-270):
```rust
#[cfg(feature = "cross-chain-verification")]
{
    let c = client.clone();
    
    // validate_evmHeader: Validate EVM block header
    module.register_method("validate_evmHeader", move |params, _| {
        let (block_number, block_hash, state_root) = params.parse::<(u64, String, String)>()?;
        let runtime_api = c.runtime_api();
        let best_hash = c.info().best_hash;
        
        // Call now-implemented CrossChainStateRootApi::validate_evm_header
        if let Some(proof) = runtime_api.validate_evm_header(best_hash, block_number, ..., ...)? {
            Ok(serde_json::json!({
                "block_number": proof.block_number,
                "confirmation_count": proof.confirmation_count,
                "proof_type": format!("{:?}", proof.proof_type),
                "validated": true,
            }))
        } else {
            Ok(serde_json::json!({"validated": false}))
        }
    })?;
    
    // validate_svmHeader: Validate SVM block header
    module.register_method("validate_svmHeader", move |params, _| {
        // Similar pattern for Solana headers
    })?;
    
    // query_crossChainStatus: Get cross-chain validation statistics
    module.register_method("query_crossChainStatus", move |_params, _| {
        let runtime_api = c.runtime_api();
        let best_hash = c.info().best_hash;
        let status = runtime_api.query_cross_chain_status(best_hash)?;
        Ok(serde_json::json!({
            "evm_headers_validated": status.evm_headers_validated,
            "svm_headers_validated": status.svm_headers_validated,
            "validation_failures": status.total_validation_failures,
            "last_validated_block": status.last_validated_block,
            "active_confirmations": status.active_confirmations,
        }))
    })?;
}
```

**Feature Gate**: `cross-chain-verification` (not gpu-validator)

**Effort**: 20 minutes (add back 3 RPC methods)

---

### Section 4: Create Phase 9 Specification

**File**: X3_BRIDGE_RELAYER_SPECIFICATION.md (Phase 9 deliverable)

**Contents** (~400 lines):
1. **Architecture Diagram**: Relayer → Verification → Settlement flow
2. **CrossChainStateRootApi Methods** (3 methods with parameter/return specs)
3. **Proof Validation Pipeline**:
   - Relayer fetches block from external chain
   - ProofBuilder constructs SettlementProof
   - CrossChainStateRootApi validates proof structure and finality
   - pallet-x3-verifier records confirmed header
   - pallet-x3-settlement-engine updates canonical state
4. **RPC Method Documentation** (validate_evmHeader, validate_svmHeader, query_crossChainStatus)
5. **Error Handling**: InvalidProof, FinalityNotMet, ProofStructureError
6. **Finality Requirements**: 
   - EVM: 12 confirmations (Ethereum default)
   - SVM: 32 confirmations (Solana finality)
   - X3: Flash finality (200ms block time)
7. **Testing Strategy**: Unit tests for proof validation, integration tests for end-to-end settlement
8. **Future Extensions**: Fraud proofs, ZK proofs, aggregated proof trees

**Effort**: 40 minutes (documentation)

---

## Phase 9 Testing Strategy

### Unit Tests
- `test_validate_evm_header_success`: Valid EVM proof with sufficient confirmations
- `test_validate_evm_header_insufficient_finality`: FinalityNotMet error
- `test_validate_svm_header_success`: Valid SVM proof
- `test_query_cross_chain_status`: Returns aggregated statistics
- `test_aggregate_cross_chain_proofs`: Merkle tree construction

### Integration Tests
- `test_end_to_end_settlement`: Relayer → Verification → Settlement flow
- `test_rpc_validate_evm_header`: Call via RPC, validate response
- `test_rpc_query_cross_chain_status`: Check status via RPC

### Property Tests (if time permits)
- Proof immutability: Once validated, cannot be modified
- Finality monotonicity: Confirmation counts only increase
- Consensus safety: Invalid proofs never pass validation

---

## Phase 9 Implementation Order

1. ✅ **Section 1** (60 min): Implement CrossChainStateRootApi in runtime
2. ✅ **Section 3** (20 min): Re-enable RPC methods with proper implementation
3. ✅ **Section 2** (30 min): Wire relayer to use validated proofs
4. ✅ **Section 4** (40 min): Create X3_BRIDGE_RELAYER_SPECIFICATION.md
5. ✅ **Testing** (30 min): Unit + integration tests
6. ✅ **Commit** (10 min): Atomic commit with comprehensive message

**Total Estimated Time**: 190 minutes (~3 hours)

---

## Unblocks After Phase 9

✅ **RC-2 Security Audit**: Complete bridge architecture verified
✅ **Public Testnet Launch**: End-to-end settlement flow working
✅ **Mainnet Preparation**: Cross-chain proof validation hardened

---

## Phase 9 Definition of Done

- [ ] CrossChainStateRootApi implemented (3 methods)
- [ ] Relayer wired to validation API
- [ ] RPC methods re-enabled with proper implementation
- [ ] All unit + integration tests passing
- [ ] X3_BRIDGE_RELAYER_SPECIFICATION.md created
- [ ] Atomic commit with detailed message
- [ ] No compilation errors
- [ ] Phase 9 verification checklist complete

---

## Next Phase (Phase 10)

**Phase 10: Governance and Settlement Finality**
- Implement governance pallet integration
- Settlement finality proof tracking
- Dispute resolution mechanism
