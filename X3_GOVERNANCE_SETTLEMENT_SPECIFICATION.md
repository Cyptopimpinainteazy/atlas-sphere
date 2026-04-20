# Phase 10a: Governance and Settlement Finality Specification

**Status**: Phase 10a (Structural Framework) - RC-1 Ready for audit
**Commitment**: Complete specification + RPC methods + runtime API wiring  
**Unblocks**: RC-2 Security audit, Phase 10b cryptographic validation

---

## Executive Summary

Phase 10a implements the structural framework for governance-driven settlement finality and dispute resolution on X3 Chain. This phase:

- **Bridges Phase 6-9** (relayer → proof validation) with governance consensus
- **Enables fraud proofs** (dispute mechanism, validator slashing)
- **Confirms settlement finality** (threshold voting, merkle aggregation)
- **Provides RPC interface** for dispute submission and status queries

This is **structural only** (Phase 10a); cryptographic validation of proofs is deferred to Phase 10b.

---

## Architecture Overview

```
External Chain Headers (EVM/SVM)
           ↓
  Phase 9: CrossChainStateRootApi
  (header validation, proof aggregation)
           ↓
  Phase 10a: GovernanceSettlementApi
  (dispute resolution, finality confirmation)
           ↓
  Phase 10b: Fraud Proofs (Phase 10b+)
  (merkle validation, cryptographic verification)
           ↓
  Settlement Engine Finalization
  (confirm settlement, release escrowed assets)
```

### Key Components

**1. Dispute Resolution Framework** (pallet-x3-governance)
- Validators challenge settlement proofs
- Dispute voting via governance consensus
- Slashing mechanism for false disputes

**2. Settlement Finality Engine** (pallet-x3-settlement-engine)
- Proof status tracking (Submitted → Disputed → Validated/Rejected)
- Finality confirmation thresholds (default: 2/3 validators)
- Merkle proof aggregation (5+ proofs → single aggregated proof)

**3. Runtime API** (GovernanceSettlementApi)
- `submit_dispute()` - Register validator dispute
- `query_dispute_status()` - Get dispute resolution state
- `confirm_settlement_finality()` - Validate proof meets threshold
- `aggregate_settlement_proofs()` - Combine multiple proofs

**4. RPC Interface**
- `submitDispute` - HTTP/JSON-RPC dispute submission
- `queryDisputeStatus` - Get dispute voting state
- `queryProofFinality` - Check if proof is finalized
- `requestProofChallenge` - Challenge settlement proof

---

## Dispute Resolution Pipeline

### Flow Diagram

```
[PROOF SUBMITTED] (Phase 9)
        ↓
[DISPUTE WINDOW] (24 hours)
   ↙       ↖
[CHALLENGED]  [VALIDATED]
   ↓             ↓
[VOTING]    [FINALIZED]
(2/3 validator consensus)
   ↓
[OUTCOME]
├─ Proof accepted: Release settlement
├─ Proof rejected: Slash validator, refund asset
└─ Invalid dispute: Slash challenger
```

### Dispute Resolution Thresholds

| Parameter | Value | Notes |
|-----------|-------|-------|
| Dispute Window | 24 hours (432,000 blocks @ 200ms) | Time to challenge proof |
| Validator Quorum | 2/3 of active set | Minimum for valid outcome |
| Slash Amount (Invalid Dispute) | 100 X3 | Penalize bad-faith challenges |
| Reward (Valid Dispute) | 50 X3 | Incentivize fraud detection |
| Finality Threshold | 2/3 + 1 validator approval | Supermajority consensus |

---

## Runtime API Specification

### GovernanceSettlementApi (Phase 10a)

#### Type Definitions

```rust
pub struct DisputeRecord {
    pub proof_hash: H256,
    pub challenger: AccountId,
    pub reason: Vec<u8>,                    // utf8 string: "MerkleProofInvalid", etc.
    pub chain_id: u64,
    pub block_created: BlockNumber,
    pub voting_end: BlockNumber,
    pub votes_yes: u32,                     // Validator count (not balance)
    pub votes_no: u32,
    pub status: DisputeStatus,              // Pending, Resolved, Slashed
}

pub enum DisputeStatus {
    Pending,        // Awaiting validator votes (< 2/3 voted)
    Resolved,       // Vote concluded (≥ 2/3 voted)
    Slashed,        // Challenger slashed for invalid dispute
    Withdrawn,      // Challenger withdrew before vote
}

pub struct ProofFinalityStatus {
    pub proof_hash: H256,
    pub chain_id: u64,
    pub submitted_block: BlockNumber,
    pub finality_confirmations: u32,        // Validator confirmations
    pub required_confirmations: u32,        // 2/3 of active validators
    pub is_finalized: bool,
    pub last_updated: BlockNumber,
}

pub struct SettlementFinality {
    pub proof_count: u32,
    pub aggregated_root: H256,
    pub confirmed_by: u32,                  // Validator count
    pub finality_percentage: u32,           // 0-100, 100 = finalized
}
```

#### Methods

**1. submit_dispute(proof_hash, reason, evidence)**

Submit a dispute challenge against a settlement proof.

```
Parameters:
- proof_hash: H256       Hash of proof being disputed
- reason: Vec<u8>       UTF8 reason ("MerkleProofInvalid", "IncorrectStateRoot", etc.)
- evidence: Vec<u8>     Optional evidence payload (Phase 10b validates this)

Returns:
- Option<DisputeRecord>

Validation (Phase 10a):
✓ proof_hash not zero
✓ reason not empty
✓ validator has stake (pallet-x3-verifier balance > 0)
✗ cryptographic proof validation → Phase 10b

Slashing (Phase 10b):
- If dispute invalid: -100 X3 from challenger
- If dispute valid: +50 X3 to challenger

Side Effects:
- Dispute record stored in SettlementDisputes<Runtime>
- Voting period starts (432,000 blocks = 24 hours)
- Proof marked as "Disputed" in SettlementProofs<Runtime>
```

**2. query_dispute_status(proof_hash)**

Get the current voting state of a dispute.

```
Parameters:
- proof_hash: H256

Returns:
- Option<DisputeRecord>

Content:
{
  "proof_hash": "0x...",
  "challenger": "0x...",
  "reason": "MerkleProofInvalid",
  "votes_yes": 45,
  "votes_no": 25,
  "votes_total": 70,
  "status": "Pending",                     // Still voting
  "finality_percentage": 64,               // 45/(45+25) = 64%
  "voting_blocks_remaining": 12345
}

Voting Rules:
- Each active validator = 1 vote (not stake-weighted)
- 2/3 majority = consensus threshold
- Dispute resolved when either:
  a) votes_yes ≥ 2/3 of active validators (proof rejected)
  b) votes_no ≥ 1/3 of active validators (proof accepted)
```

**3. confirm_settlement_finality(proof_hash)**

Confirm that a proof has reached finality consensus.

```
Parameters:
- proof_hash: H256

Returns:
- Option<ProofFinalityStatus>

Content:
{
  "proof_hash": "0x...",
  "chain_id": 1,                          // Ethereum
  "finality_confirmations": 67,           // Validator count confirming
  "required_confirmations": 66,           // 2/3 of 99 validators
  "is_finalized": true,
  "percentage": 100
}

Finality Achieved When:
- No active disputes for this proof
- OR dispute voted to accept proof (votes_yes ≥ 2/3)
- AND all escrow conditions met (Phase 10b)

Side Effects (Phase 10b):
- Call pallet-x3-settlement-engine::confirm_intent_finality()
- Release escrowed assets on source chain
- Emit SettlementFinalized event
```

**4. aggregate_settlement_proofs(proof_hashes, merkle_tree)**

Aggregate 5+ settlement proofs into a single merkle tree proof for batch finality.

```
Parameters:
- proof_hashes: Vec<H256>        >= 5 proofs to aggregate
- merkle_tree: Option<Vec<H256>> Optional pre-computed merkle tree levels

Returns:
- Option<SettlementFinality>

Content:
{
  "proof_count": 8,
  "aggregated_root": "0x...",               // Merkle root of all 8 proofs
  "confirmed_by": 67,                       // Validator consensus on aggregation
  "finality_percentage": 100,
  "merkle_proof_vector": ["0x...", ...]   // Path for light-client verification
}

Merkle Aggregation (Phase 10b):
- Construct merkle tree: leaf_i = proof_hash_i
- Each level: hash(left || right) = keccak256
- Root = merkle_root
- Store in MerkleAggregations<Runtime>
- Allows O(log n) verification for light clients

Batch Finality:
- 5+ proofs ≥ 2/3 validator confirmations
- Single merkle proof = efficient light-client verification
- Reduces RPC bandwidth for finality status queries
```

---

### SettlementFinalityApi (Phase 10a)

#### Methods

**1. query_finality_metrics()**

Get settlement finality pipeline statistics.

```
Returns:
{
  "total_proofs_submitted": 1234,
  "proofs_finalized": 1200,
  "proofs_disputed": 25,
  "proofs_rejected": 9,
  "active_disputes": 3,
  "average_finality_blocks": 100000,       // ~8.3 hours
  "finality_rate_percent": 97.2
}

Calculation:
- finality_rate = (finalized / submitted) * 100
- average_finality = sum(finality_blocks) / finalized_count
```

**2. query_validator_reputation(validator_id)**

Get validator dispute resolution track record (Phase 10b uses for slashing decisions).

```
Parameters:
- validator_id: AccountId

Returns:
{
  "disputes_raised": 5,
  "disputes_won": 3,
  "disputes_lost": 2,
  "valid_dispute_percent": 60,
  "total_slashed": 0,                      // X3 tokens slashed
  "reputation_score": 85                   // 0-100, higher = more trusted
}

Reputation Rules (Phase 10b):
- reputation = (valid_disputes / total_disputes) * 100
- If reputation < 50: Require 2x stake to dispute
- If reputation = 0: Banned from disputing
- Score recalculates each epoch (14400 blocks)
```

**3. query_batch_finality_status(merkle_root)**

Check if a merkle-aggregated batch has finality.

```
Parameters:
- merkle_root: H256                        Root of aggregated proof merkle tree

Returns:
{
  "merkle_root": "0x...",
  "proof_count": 8,
  "leaf_count": 8,
  "is_finalized": true,
  "confirmations": 67,
  "threshold": 66,
  "merkle_depth": 3
}

Merkle Path Calculation (Phase 10b):
- Given leaf index i, return path [sibling_0, sibling_1, ..., sibling_log2(n)]
- Path allows O(log n) verification against merkle_root
```

---

## RPC Interface Specification

### JSON-RPC Methods

#### 1. submitDispute

**Purpose**: Register a validator challenge against a settlement proof.

**Signature**:
```
submitDispute(proof_hash: String, reason: String, evidence?: String) 
  -> { dispute_hash: String, status: String, voting_blocks: u32 }
```

**Parameters**:
- `proof_hash`: "0x..." hexadecimal settlement proof hash
- `reason`: UTF-8 string ("MerkleProofInvalid", "IncorrectStateRoot", "DoubleSettlement")
- `evidence`: Optional hex-encoded evidence payload

**Response**:
```json
{
  "dispute_hash": "0x...",
  "challenger": "0x...",
  "status": "Pending",
  "voting_blocks": 432000,
  "voting_hours": 24,
  "reason": "MerkleProofInvalid"
}
```

**Error Cases**:
- Invalid proof_hash format → `custom_error("Invalid proof_hash hex")`
- Empty reason → `custom_error("Reason cannot be empty")`
- Validator not staked → `custom_error("Caller not registered validator")`
- Proof not found → `custom_error("Proof hash not found")`

**Example (curl)**:
```bash
curl -X POST http://localhost:9933 \
  -H "Content-Type: application/json" \
  -d '{
    "jsonrpc": "2.0",
    "id": 1,
    "method": "submitDispute",
    "params": [
      "0xaabbccdd...",
      "MerkleProofInvalid",
      "0x..."
    ]
  }'
```

---

#### 2. queryDisputeStatus

**Purpose**: Get dispute voting state and validator positions.

**Signature**:
```
queryDisputeStatus(proof_hash: String) 
  -> { proof_hash, votes_yes, votes_no, status, percentage_yes }
```

**Parameters**:
- `proof_hash`: "0x..." hexadecimal proof hash

**Response**:
```json
{
  "proof_hash": "0x...",
  "challenger": "0x...",
  "reason": "MerkleProofInvalid",
  "votes_yes": 45,
  "votes_no": 25,
  "votes_total": 70,
  "votes_required": 66,
  "status": "Pending",
  "percentage_yes": 64,
  "voting_blocks_remaining": 100000,
  "voting_hours_remaining": 8.3
}
```

**Error Cases**:
- Invalid proof_hash format → `custom_error("Invalid proof_hash hex")`
- Dispute not found → `custom_error("Dispute not found for proof_hash")`

---

#### 3. queryProofFinality

**Purpose**: Check if a proof has reached settlement finality.

**Signature**:
```
queryProofFinality(proof_hash: String) 
  -> { is_finalized: bool, confirmations: u32, percentage: u32 }
```

**Parameters**:
- `proof_hash`: "0x..." hexadecimal proof hash

**Response**:
```json
{
  "proof_hash": "0x...",
  "chain_id": 1,
  "is_finalized": true,
  "confirmations": 67,
  "required_confirmations": 66,
  "finality_percentage": 100,
  "settled_block": 1234567,
  "settled_timestamp": 1713607200
}
```

**Finality States**:
- `is_finalized: true` → Proof accepted, settlement can proceed
- `is_finalized: false, percentage: < 50` → Dispute in progress, outcome unclear
- `is_finalized: false, percentage: >= 50, disputes: 0` → Likely finalizing next block

---

#### 4. requestProofChallenge

**Purpose**: Request that a proof undergo fraud verification (Phase 10b).

**Signature**:
```
requestProofChallenge(proof_hash: String, challenge_type: String) 
  -> { challenge_id: String, verification_blocks: u32 }
```

**Parameters**:
- `proof_hash`: "0x..." hexadecimal proof hash
- `challenge_type`: "MerkleValidation" | "StateRootVerification" | "CryptoProof"

**Response**:
```json
{
  "proof_hash": "0x...",
  "challenge_id": "0xchallenge...",
  "challenge_type": "MerkleValidation",
  "status": "Pending",
  "verification_blocks": 100,
  "verification_hours": 0.83
}
```

**Error Cases**:
- Unknown challenge_type → `custom_error("Invalid challenge_type")`
- Proof already finalized → `custom_error("Cannot challenge finalized proof")`

---

## Governance Parameters

### Constants (Phase 10a)

```rust
parameter_types! {
    // Dispute window and voting
    pub const DisputeWindowBlocks: u32 = 432_000;      // 24 hours @ 200ms
    pub const GovernanceQuorum: Percent = Percent::from_percent(66);
    pub const ValidatorSlashAmount: Balance = 100 * X3;
    pub const ValidDisputeReward: Balance = 50 * X3;
    
    // Finality thresholds
    pub const SettlementFinalityThreshold: Percent = Percent::from_percent(67);  // 2/3 + 1
    pub const MinProofsForAggregation: u32 = 5;        // Merkle aggregation minimum
    
    // Validator reputation
    pub const ReputationRecalcPeriod: BlockNumber = 14400;  // 1 day @ 6s blocks
    pub const MinReputationToDispute: u32 = 0;         // Can dispute at reputation 0
}
```

### Configurable Parameters (Runtime Config)

| Param | Default | Tunable by | Purpose |
|-------|---------|------------|---------|
| DisputeWindowBlocks | 432,000 | Governance | Time to challenge proof |
| GovernanceQuorum | 2/3 | Council | Min validators for decision |
| ValidatorSlashAmount | 100 X3 | Treasury | Penalty for invalid dispute |
| SettlementFinalityThreshold | 2/3 | Governance | Supermajority finality |
| MinProofsForAggregation | 5 | Governance | Merkle tree minimum |

---

## Testing Strategy

### Unit Tests (Phase 10a)

```rust
#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_submit_dispute_validation() {
        // ✓ Non-zero proof_hash
        // ✓ Non-empty reason
        // ✓ Caller is registered validator
        // ✗ Zero proof_hash → error
        // ✗ Empty reason → error
        // ✗ Unregistered validator → error
    }

    #[test]
    fn test_dispute_voting() {
        // ✓ Votes counted correctly
        // ✓ Reach 2/3 yes = dispute resolved (proof rejected)
        // ✓ Reach 1/3 no = dispute resolved (proof accepted)
        // ✗ Voting before voting_end → error
    }

    #[test]
    fn test_proof_finality() {
        // ✓ No active disputes → finalized
        // ✓ All disputes resolved → finalized
        // ✗ Active dispute → not finalized
    }

    #[test]
    fn test_merkle_aggregation() {
        // ✓ 5 proofs → single merkle root
        // ✓ merkle_leaf_i = proof_hash_i
        // ✓ merkle_root verifiable with O(log n) proofs
        // ✗ < 5 proofs → error
    }
}
```

### Integration Tests (Phase 10b)

- Real merkle proof validation against finalized state roots
- Validator slashing execution
- Governance integration (council veto on disputes)
- Cross-chain settlement confirmation

---

## Future Extensions (Phase 10b+)

1. **Cryptographic Fraud Proofs**
   - Merkle tree validation (keccak256)
   - State root verification against finalized blocks
   - ECDSA/BLS signature verification for validator attestations

2. **Advanced Dispute Resolution**
   - Bisection-style fraud proofs (narrow down exact disputed transition)
   - Time-locked disputes (escalate after voting deadline)
   - Governance veto on sentinel disputes

3. **Batch Optimization**
   - SNARK-style proof compression (merkle → recursive proof)
   - Light-client friendly batch proofs
   - Interoperability with Nomad/IBC light clients

4. **Validator Reputation System**
   - Dynamic slash amounts based on reputation
   - Reputation recovery mechanism
   - Dispute cost bonds (require stake to dispute)

---

## Implementation Checklist

- [x] Runtime API trait declaration (GovernanceSettlementApi, SettlementFinalityApi)
- [x] Dummy implementations for no_std
- [x] impl_runtime_apis! implementations (structural validation only)
- [x] RPC method registration (submitDispute, queryDisputeStatus, queryProofFinality, requestProofChallenge)
- [x] Specification document (this file)
- [ ] Unit tests (Phase 10b)
- [ ] Integration with pallet-x3-governance
- [ ] Integration with pallet-x3-settlement-engine
- [ ] Testnet deployment and validation
- [ ] Cryptographic proof validation (Phase 10b)

---

## Integration Points

### With Phase 6 (x3-relayer)
- Relayer submits proofs → settlement engine stores proof_hash
- Proof status queryable via settlement API

### With Phase 9 (CrossChainStateRootApi)
- EVM/SVM headers validated → referenced in dispute challenges
- Header proof_hash used as identifier in dispute records

### With pallet-x3-settlement-engine
- Settlement intents tied to proof finality
- Finality confirms escrow release
- Challenge mechanism prevents partial settlements

### With pallet-x3-governance
- Disputes escalate to governance if validator quorum not reached
- Council can emergency-veto settlements
- Slashing execution delegates to governance pallet

---

## References

- **Phase 6**: x3-relayer (proof construction)
- **Phase 7**: Runtime API freeze (18 canonical APIs)
- **Phase 8**: RPC specification (78 methods)
- **Phase 9**: Bridge/relayer flows (CrossChainStateRootApi)
- **Phase 10a**: Governance & settlement finality (this doc)
- **Phase 10b**: Fraud proofs & cryptographic validation

---

**Document Version**: 1.0
**Last Updated**: April 20, 2026
**RC-1 Status**: READY FOR AUDIT
