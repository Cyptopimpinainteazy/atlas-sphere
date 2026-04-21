# X3 Phase 13b: Bridge Integration Test Specification

**Status:** RC-1 Phase 13b — Integration Testing & Validation  
**Date:** April 20, 2026  
**Scope:** End-to-end testing of bridge components (ChainRegistry, proof submission, finality polling, replay protection)

---

## Executive Summary

Phase 13b validates that the bridge architecture from Phase 13a integrates correctly:

1. **ChainRegistry storage** — EVM/SVM domain configurations are stored and queryable
2. **Proof submission flow** — RPC submitCrossVmTransaction routes to CrossChainStateRootApi correctly
3. **Finality polling** — Proof status transitions (Verifying → Confirmed) work end-to-end
4. **Replay protection** — Double submissions are idempotently rejected
5. **Error handling** — Invalid proofs, wrong domains, paused bridge all return proper errors
6. **Settlement integration** — GovernanceSettlementApi polls work correctly

**Exit Criteria:**
- ✅ ChainRegistry tests (storage, updates, queries)
- ✅ Proof submission integration tests
- ✅ Finality polling tests
- ✅ Replay protection verification tests
- ✅ Error scenario tests (5+ cases)
- ✅ All tests passing, no panics

---

## Part 1: RPC → API → Pallet Wiring Diagram

### Current Architecture (Phase 12 + Phase 9)

```
┌─────────────────────────────────────────────────────────────────────┐
│ CLIENT (Relayer)                                                    │
│  x3_submitCrossVmTransaction({source_domain, proof, height})        │
└────────────────┬────────────────────────────────────────────────────┘
                 │
                 ▼
┌─────────────────────────────────────────────────────────────────────┐
│ RPC LAYER (node/src/rpc.rs)                                        │
│  submitCrossVmTransaction method → encode_proof() → build extrinsic │
└────────────────┬────────────────────────────────────────────────────┘
                 │
                 ▼
┌─────────────────────────────────────────────────────────────────────┐
│ RUNTIME API (gpu-validator)                                         │
│  CrossChainStateRootApi::validate_evm_header / validate_svm_header │
│  ├─ Check ChainRegistry for domain config                          │
│  ├─ Verify finality threshold met                                  │
│  ├─ Validate proof structure                                       │
│  └─ Return EvmHeaderProof or SvmHeaderProof                        │
└────────────────┬────────────────────────────────────────────────────┘
                 │
                 ▼
┌─────────────────────────────────────────────────────────────────────┐
│ PALLET STORAGE (pallet-x3-verifier)                                │
│  ├─ Jobs: Store verified proofs                                   │
│  ├─ VerificationEnabled: Track verification status                │
│  └─ ProofRegistry: Replay protection cache                        │
└────────────────┬────────────────────────────────────────────────────┘
                 │
                 ▼
┌─────────────────────────────────────────────────────────────────────┐
│ SETTLEMENT FINALITY (GovernanceSettlementApi)                       │
│  ├─ queryProofFinality(proof_hash)                                 │
│  ├─ Returns: {status, confirmation_count, threshold}              │
│  └─ Relayer polls until status = Confirmed                        │
└─────────────────────────────────────────────────────────────────────┘
```

### ChainRegistry Integration Point (NEW in Phase 13b)

```
┌──────────────────────────────────────────────────────────────────────┐
│ PALLET STORAGE (pallet-x3-domain-registry)  [NEW - Phase 13b]        │
│                                                                      │
│  EvmNetworks: Map<u32, EvmChainConfig>                              │
│  ├─ Key: chain_id (e.g., 11155111 for Sepolia)                     │
│  └─ Value: {                                                         │
│      x3_domain_id: 200,                                             │
│      finality_threshold: 12,                                        │
│      rpc_endpoint: "https://sepolia.infura.io/...",                │
│      state_root_contract: "0xtest..."                              │
│    }                                                                 │
│                                                                      │
│  SvmClusters: Map<String, SvmClusterConfig>                         │
│  ├─ Key: "testnet" or "mainnet-beta"                               │
│  └─ Value: {                                                         │
│      x3_domain_id: 501,                                             │
│      finality_threshold: 32,                                        │
│      rpc_endpoint: "https://api.testnet.solana.com",               │
│      program_id: "X3TestAaaB..."                                   │
│    }                                                                 │
│                                                                      │
└──────────────────────────────────────────────────────────────────────┘
       ▲
       │ Used by CrossChainStateRootApi to verify finality threshold
       │
       └─ validate_evm_header(chain_id, state_root, proof)
          1. Look up chain_id in EvmNetworks
          2. Get finality_threshold from config
          3. Check if current_block ≥ proof.block + finality_threshold
          4. If valid, store in pallet-x3-verifier::Jobs
```

---

## Part 2: Test Cases

### 2.1 ChainRegistry Storage Tests

**Test: test_evm_network_registration**
- Precondition: Runtime initialized
- Action: Register Sepolia (chain_id=11155111, x3_domain=200, finality=12)
- Expected: EvmNetworks contains entry, queryable via runtime API
- Assertion: EvmNetworks::<T>::get(11155111) == Some(EvmChainConfig { ... })

**Test: test_svm_cluster_registration**
- Precondition: Runtime initialized
- Action: Register Solana testnet (cluster="testnet", x3_domain=501, finality=32)
- Expected: SvmClusters contains entry
- Assertion: SvmClusters::<T>::get("testnet") == Some(SvmClusterConfig { ... })

**Test: test_domain_lookup_succeeds**
- Precondition: Sepolia registered in EvmNetworks
- Action: Query domain config by chain_id
- Expected: Returns correct finality threshold (12)
- Assertion: Config.finality_threshold == 12

**Test: test_domain_lookup_fails_unknown_chain**
- Precondition: No config for chain_id=999999
- Action: Try to query chain_id 999999
- Expected: Returns None or error
- Assertion: EvmNetworks::<T>::get(999999) == None

**Test: test_governance_can_update_registry**
- Precondition: Sepolia registered with finality=12
- Action: Governance updates Sepolia config (finality=20)
- Expected: Update succeeds, new finality is 20
- Assertion: EvmNetworks::<T>::get(11155111).finality_threshold == 20

**Test: test_non_governance_cannot_update_registry**
- Precondition: ChainRegistry initialized
- Action: Regular account attempts to register new network
- Expected: Fails with error (requires governance)
- Assertion: assert_noop!(result, Error::<T>::NotGovernance)

---

### 2.2 Proof Submission Integration Tests

**Test: test_submit_evm_proof_valid**
- Precondition: Sepolia registered (chain_id=11155111, x3_domain=200)
- Action: Submit EvmHeaderProof (block=18500000, state_root=0xabc, proof_nonce=0)
- Expected: Proof stored in pallet-x3-verifier::Jobs
- Verification:
  1. RPC call succeeds
  2. Extrinsic included in block
  3. Jobs storage contains proof_hash

**Test: test_submit_evm_proof_invalid_domain**
- Precondition: ChainRegistry only has Sepolia (chain_id=11155111)
- Action: Submit proof with source_domain=999 (not registered)
- Expected: Fails with error (domain not found)
- Assertion: Result is Err(CrossChainError::UnknownDomain)

**Test: test_submit_evm_proof_finality_not_met**
- Precondition: Sepolia registered with finality=12
- Action: Submit proof for block that's only 6 blocks old (< 12)
- Expected: Fails (finality threshold not reached)
- Assertion: Result is Err(CrossChainError::FinalityNotMet)

**Test: test_submit_svm_proof_valid**
- Precondition: Solana testnet registered (cluster="testnet", x3_domain=501)
- Action: Submit SvmHeaderProof (slot=123456, validator_signatures=[...])
- Expected: Proof stored in pallet-x3-verifier::Jobs
- Verification: Jobs storage contains proof_hash

**Test: test_submit_svm_proof_insufficient_signatures**
- Precondition: Solana testnet requires 66% validator signatures
- Action: Submit SvmHeaderProof with only 50% signatures
- Expected: Fails with error
- Assertion: Result is Err(CrossChainError::InsufficientValidators)

---

### 2.3 Finality Polling Integration Tests

**Test: test_query_proof_finality_pending**
- Precondition: Proof submitted in block N, not yet finalized
- Action: Poll queryProofFinality(proof_hash)
- Expected: Returns {status: "Verifying", confirmation_count: 0, threshold: 1}
- Assertion: status != "Confirmed"

**Test: test_query_proof_finality_confirmed**
- Precondition: Proof submitted in block N, now block N+1 (finalized)
- Action: Poll queryProofFinality(proof_hash)
- Expected: Returns {status: "Confirmed", confirmation_count: 1, threshold: 1}
- Assertion: status == "Confirmed"

**Test: test_query_proof_finality_unknown_proof**
- Precondition: No proof with this hash submitted
- Action: Poll queryProofFinality(unknown_hash)
- Expected: Returns error or {status: "Unknown"}
- Assertion: Either Err or status == "Unknown"

**Test: test_proof_status_transitions_correctly**
- Precondition: Proof submitted in block N
- Scenario:
  1. Block N: Submit proof → status = "Verifying"
  2. Block N+1: Poll → status = "Confirmed"
  3. Block N+2: Poll again → status = "Confirmed" (stable)
- Expected: Status transitions correctly
- Assertion: All transitions match expected sequence

---

### 2.4 Replay Protection Tests

**Test: test_replay_protection_same_proof_twice**
- Precondition: Proof A submitted successfully
- Action:
  1. Submit Proof A (success, nonce=0)
  2. Immediately resubmit same Proof A with nonce=1
- Expected: Second submission rejected (duplicate proof hash)
- Assertion: Second submission fails with Err(Duplicate) or returns without storage update

**Test: test_replay_protection_cache_lookup**
- Precondition: Proof A submitted and finalized
- Action:
  1. Query ProofRegistry storage for proof_hash
  2. Check that status = "Finalized"
- Expected: Registry entry exists with correct status
- Assertion: ProofRegistry::<T>::get(proof_hash) == Some({status: "Finalized", ...})

**Test: test_replay_protection_nonce_increment**
- Precondition: Relayer account nonce = 5
- Action:
  1. Submit Proof A with extrinsic nonce=5
  2. Submit Proof B with extrinsic nonce=6
  3. Submit Proof C with extrinsic nonce=7
- Expected: All three succeed, account nonce increments
- Assertion: Each proof stored with unique proof_hash, nonce in sequence

**Test: test_nonce_out_of_order_rejected**
- Precondition: Relayer account nonce = 5
- Action: Try to submit extrinsic with nonce=7 (skip 6)
- Expected: Fails (Substrate frame-system rejects out-of-order nonce)
- Assertion: Extrinsic rejected before reaching pallet logic

---

### 2.5 Error Handling Tests

**Test: test_invalid_proof_format**
- Precondition: EvmHeaderProof decoded incorrectly
- Action: Submit malformed proof (bad encoding)
- Expected: Fails with error
- Assertion: Result is Err(DecodingError) or Err(InvalidProof)

**Test: test_proof_state_root_mismatch**
- Precondition: Proof claims state_root=0xabc but actual=0xdef
- Action: Submit proof with mismatched state root
- Expected: Fails (state root validation fails)
- Assertion: Result is Err(StateRootMismatch)

**Test: test_governance_pause_bridge**
- Precondition: Bridge running, proofs accepted
- Action:
  1. Governance calls pause_bridge("Critical bug found")
  2. Try to submit proof
- Expected: Submission rejected (bridge paused)
- Assertion: Result is Err(BridgePaused)

**Test: test_proof_submission_while_bridge_paused**
- Precondition: Bridge in paused state
- Action: Attempt to submit any proof
- Expected: Rejected with error
- Assertion: Every submission fails with BridgePaused

**Test: test_governance_unpause_resumes_submissions**
- Precondition: Bridge is paused
- Action:
  1. Governance calls unpause_bridge()
  2. Try to submit proof
- Expected: Submission accepted
- Assertion: Proof stored successfully

---

## Part 3: Integration Test Implementation Plan

### Location
`crates/cross-vm-coordinator/src/bridge_integration_tests.rs`

### Test Module Structure

```rust
#[cfg(test)]
mod bridge_integration_tests {
    use super::*;
    use frame_support::{assert_noop, assert_ok};
    
    // 2.1 ChainRegistry tests
    mod chain_registry {
        #[test]
        fn test_evm_network_registration() { ... }
        #[test]
        fn test_svm_cluster_registration() { ... }
        // ... 4 more tests
    }
    
    // 2.2 Proof submission tests
    mod proof_submission {
        #[test]
        fn test_submit_evm_proof_valid() { ... }
        #[test]
        fn test_submit_evm_proof_invalid_domain() { ... }
        // ... 5 more tests
    }
    
    // 2.3 Finality polling tests
    mod finality_polling {
        #[test]
        fn test_query_proof_finality_pending() { ... }
        #[test]
        fn test_query_proof_finality_confirmed() { ... }
        // ... 3 more tests
    }
    
    // 2.4 Replay protection tests
    mod replay_protection {
        #[test]
        fn test_replay_protection_same_proof_twice() { ... }
        #[test]
        fn test_replay_protection_cache_lookup() { ... }
        // ... 3 more tests
    }
    
    // 2.5 Error handling tests
    mod error_handling {
        #[test]
        fn test_invalid_proof_format() { ... }
        #[test]
        fn test_proof_state_root_mismatch() { ... }
        // ... 3 more tests
    }
}
```

### Execution Model

Each test will:
1. Set up mock runtime with ChainRegistry initialized
2. Create test fixtures (proofs, domain configs)
3. Execute the integration flow
4. Assert expected outcomes
5. Clean up (implicit via test framework)

### Dependencies

- `frame-support`: assert_ok, assert_noop
- `frame-system`: Account, block number tracking
- `pallet-x3-verifier`: Jobs storage, verification logic
- `pallet-x3-domain-registry`: EvmNetworks, SvmClusters storage
- Cross-VM bridge types: EvmHeaderProof, SvmHeaderProof

---

## Part 4: Test Execution & Validation

### Running Tests

```bash
# Run all integration tests
cargo test --package cross-vm-coordinator bridge_integration_tests

# Run specific test module
cargo test --package cross-vm-coordinator bridge_integration_tests::proof_submission

# Run single test with output
cargo test --package cross-vm-coordinator bridge_integration_tests::proof_submission::test_submit_evm_proof_valid -- --nocapture
```

### Success Criteria

- [ ] All 25+ tests passing
- [ ] No panic messages or unwrap failures
- [ ] No timeout issues (< 5s per test)
- [ ] Code coverage > 85% for bridge-related code
- [ ] RPC → API → Pallet wiring verified end-to-end

### Failure Investigation

If tests fail, check:
1. **ChainRegistry not initialized** → Ensure test setup calls register_evm_network/register_svm_cluster
2. **Proof format mismatch** → Verify EvmHeaderProof/SvmHeaderProof encoding
3. **Finality not advancing** → Check mock block height incrementing logic
4. **Replay protection not working** → Verify ProofRegistry storage is persisting across calls
5. **RPC routing incorrect** → Check submitCrossVmTransaction method in node/src/rpc.rs

---

## Part 5: Testnet Deployment Validation

### Pre-Deployment Checklist

After all integration tests pass, verify on testnet:

- [ ] Deploy pallet-x3-domain-registry to X3 testnet
- [ ] Register Sepolia (chain_id=11155111, domain=200) in governance
- [ ] Register Solana testnet (cluster="testnet", domain=501) in governance
- [ ] Verify ChainRegistry queryable via runtime API
- [ ] Deploy relayer service pointing to testnet X3 node
- [ ] Relayer successfully submits Sepolia block proof
- [ ] Proof shows up in pallet-x3-verifier::Jobs storage
- [ ] queryProofFinality returns correct status
- [ ] Proof finalizes within 1 block (~200ms)
- [ ] Attempt replay submission → rejected
- [ ] Test pause/resume cycle
- [ ] Verify dispute flow (challenge proof, vote, resolve)

---

## Part 6: Integration Test Timeline

| Phase | Task | Duration | Status |
|-------|------|----------|--------|
| **13b-1** | Implement ChainRegistry tests (6 tests) | 0.5 hrs | ⏳ |
| **13b-2** | Implement proof submission tests (7 tests) | 0.75 hrs | ⏳ |
| **13b-3** | Implement finality polling tests (5 tests) | 0.5 hrs | ⏳ |
| **13b-4** | Implement replay protection tests (4 tests) | 0.5 hrs | ⏳ |
| **13b-5** | Implement error handling tests (5 tests) | 0.75 hrs | ⏳ |
| **13b-6** | Integration verification & fixes | 0.5 hrs | ⏳ |
| **Total** | Phase 13b complete | ~3.5 hrs | ⏳ |

---

## Appendix: Mock Test Data

### Testnet Configuration (Sepolia + Solana)

```rust
pub fn setup_testnet_chain_registry() {
    // Sepolia EVM config
    let sepolia = EvmChainConfig {
        chain_id: 11155111u32,
        x3_domain_id: 200u32,
        rpc_endpoint: "https://sepolia.infura.io/v3/YOUR_KEY".to_string(),
        finality_threshold: 12u32,
        state_root_contract: "0x1234567890123456789012345678901234567890".to_string(),
    };
    EvmNetworks::<T>::insert(11155111, sepolia);
    
    // Solana testnet config
    let solana_testnet = SvmClusterConfig {
        cluster_name: "testnet".to_string(),
        x3_domain_id: 501u32,
        rpc_endpoint: "https://api.testnet.solana.com".to_string(),
        finality_threshold: 32u32,
        program_id: "X3TestAaaB...".to_string(),
    };
    SvmClusters::<T>::insert("testnet", solana_testnet);
}

pub fn sample_evm_header_proof() -> EvmHeaderProof {
    EvmHeaderProof {
        block_height: 18500000u32,
        block_hash: H256::from_slice(&[1u8; 32]),
        state_root: H256::from_slice(&[2u8; 32]),
        timestamp: 1713607200u64,  // 2024-04-20 12:00:00 UTC
        state_root_proof: vec![1, 2, 3, 4],
        nonce: 0u32,
    }
}

pub fn sample_svm_header_proof() -> SvmHeaderProof {
    SvmHeaderProof {
        slot: 123456789u64,
        blockhash: [3u8; 32],
        block_time: 1713607200u64,
        validator_signatures: vec![
            (PublicKey::from([4u8; 32]), vec![5u8; 64]),
            (PublicKey::from([6u8; 32]), vec![7u8; 64]),
        ],
        signature_count: 2u32,
        required_signatures: 3u32,  // 2/3 majority threshold
    }
}
```

---

## Exit Criteria for Phase 13b

- ✅ 25+ integration tests implemented
- ✅ All tests passing (cargo test)
- ✅ ChainRegistry storage tested (registration, lookup, update)
- ✅ Proof submission flow tested (EVM + SVM, valid + invalid)
- ✅ Finality polling tested (status transitions)
- ✅ Replay protection verified (idempotency)
- ✅ Error scenarios tested (5+ failure cases)
- ✅ RPC → API → Pallet wiring verified end-to-end
- ✅ Testnet deployment checklist created

---

## Next Steps

After Phase 13b completes:
- **Phase 13c:** Relayer service implementation and deployment
- **Phase 12b:** RPC testing (parallel track)
- **Phase 14:** Custody boundaries (parallel track)
- **Testnet Launch:** Bridge validation with live Sepolia ↔ X3 testnet proofs
