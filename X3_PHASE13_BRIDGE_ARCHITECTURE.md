# X3 Bridge & Relayer Architecture (Phase 13)

**Status:** RC-1 Phase 13 — Bridge & Relayer Flow Integration  
**Date:** April 20, 2026  
**Scope:** End-to-end bridge lifecycle, relayer responsibility design, cross-chain proof flow

---

## Executive Summary

Phase 13 specifies the **complete bridge-to-settlement pipeline** that enables cross-chain value transfer:

1. **Relayer architecture** — Header ingestion, proof acquisition, replay protection
2. **ChainRegistry** — Domain routing (EVM chain IDs ↔ X3 shards, SVM clusters ↔ X3 zones)
3. **Proof submission flow** — From relayer through pallet-x3-verifier to settlement
4. **Finality integration** — CrossChainStateRootApi (Phase 9) + GovernanceSettlementApi (Phase 10a)
5. **Pause & recovery semantics** — How bridge halts and resumes safely

**Exit Criteria:**
- ✅ Complete relayer responsibility document
- ✅ ChainRegistry specification with mapping examples
- ✅ End-to-end bridge lifecycle diagram & specification
- ✅ Relayer → pallet-x3-verifier integration verified
- ✅ Pause/recovery & replay protection designed
- ✅ Testnet bridge validation checklist

---

## Part 1: Relayer Architecture Overview

### What is a Relayer?

A relayer is an **off-chain service** that:
1. Watches source chain headers (EVM, SVM)
2. Acquires proof data (merkle trees, validator signatures)
3. Submits proofs to X3 settlement pallet
4. Tracks settlement finality

**Relayers are NOT:**
- Validators (do not participate in X3 consensus)
- Signers (do not custody keys)
- Bridge operators (any operator can run one)

**Relayers ARE:**
- Stateless proof aggregators
- Fee-earning services (collect transaction fees)
- Replay-safe (idempotent submission)

---

## Part 2: ChainRegistry Specification

### 2.1 Domain Mapping

X3 defines **domain identifiers** for each remote chain:

#### EVM Domain Registry

```rust
#[derive(Clone, Encode, Decode)]
pub struct EvmChainConfig {
    pub chain_id: u32,           // e.g., 1 (Ethereum), 137 (Polygon)
    pub x3_domain_id: u32,       // e.g., 100 (X3 domain 100 = Ethereum)
    pub rpc_endpoint: String,    // Relayer's RPC endpoint for this chain
    pub finality_threshold: u32, // Confirmations before proof is valid (e.g., 12)
    pub state_root_contract: String, // 0x... address of X3 bridge contract
}

#[cfg_attr(feature = "std", derive(serde::Serialize, serde::Deserialize))]
pub struct EvmDomainRegistry {
    pub networks: BTreeMap<u32, EvmChainConfig>,
}
```

**Example Mainnet Configuration:**

| EVM Chain | Chain ID | X3 Domain | Finality | Bridge Contract |
|-----------|----------|-----------|----------|-----------------|
| Ethereum | 1 | 100 | 12 blocks (~3 min) | 0xabc... |
| Polygon | 137 | 101 | 128 blocks (~4 min) | 0xdef... |
| Arbitrum | 42161 | 102 | 1 block (~0.25s) | 0xghi... |
| Base | 8453 | 103 | 2 blocks (~24s) | 0xjkl... |

**Testnet Configuration:**

| EVM Chain | Chain ID | X3 Domain | Finality | Bridge Contract |
|-----------|----------|-----------|----------|-----------------|
| Sepolia | 11155111 | 200 | 12 blocks | 0xtest1... |
| Polygon Mumbai | 80001 | 201 | 128 blocks | 0xtest2... |

#### Solana Domain Registry

```rust
#[derive(Clone, Encode, Decode)]
pub struct SvmClusterConfig {
    pub cluster_name: String,          // "mainnet-beta", "testnet", "devnet"
    pub x3_domain_id: u32,             // e.g., 500 (X3 domain 500 = Solana mainnet)
    pub rpc_endpoint: String,          // Solana RPC URL
    pub finality_threshold: u32,       // Confirmations (e.g., 32)
    pub program_id: String,            // Solana program ID of X3 settlement
}

#[cfg_attr(feature = "std", derive(serde::Serialize, serde::Deserialize))]
pub struct SvmDomainRegistry {
    pub clusters: BTreeMap<String, SvmClusterConfig>,
}
```

**Example Configuration:**

| SVM Cluster | X3 Domain | Finality | Program ID |
|-------------|-----------|----------|------------|
| mainnet-beta | 500 | 32 (~12.8s) | X3XxxYyyZzz... |
| testnet | 501 | 32 (~12.8s) | X3TestAaaB... |

#### X3 Internal Domain Registry

```rust
pub struct X3ShardRegistry {
    pub shard_id: u32,
    pub validator_set: Vec<AccountId>,
    pub finality_threshold: u32,  // Always 1 for X3 (200ms block time)
}
```

### 2.2 ChainRegistry Storage (On-Chain)

Located in **pallet-x3-domain-registry**:

```rust
#[pallet::storage]
pub type EvmNetworks<T: Config> = 
    StorageMap<_, Identity, u32, EvmChainConfig>;

#[pallet::storage]
pub type SvmClusters<T: Config> = 
    StorageMap<_, Identity, String, SvmClusterConfig>;

#[pallet::storage]
pub type X3Shards<T: Config> = 
    StorageMap<_, Identity, u32, X3ShardRegistry>;

#[pallet::storage]
pub type DomainToChain<T: Config> = 
    StorageMap<_, Identity, u32, ChainType>;
    // Maps X3 domain ID → EVM/SVM/X3 union type
```

### 2.3 ChainRegistry Updates

**Who can update:** On-chain governance only (pallet-x3-kernel via referendum)

**Update process:**
1. Governance submits `pallet_x3_domain_registry::Call::register_evm_network`
2. Vote passes → Proposal enacts
3. New chain becomes routable

**Testnet flow (for Phase 13 testing):**
```
Manual CLI registration:
  x3-chain-cli domain-registry register-evm \
    --chain-id 11155111 \
    --x3-domain 200 \
    --finality 12 \
    --rpc-endpoint https://sepolia.infura.io/v3/... \
    --bridge-contract 0xtest...
```

---

## Part 3: Relayer Data Flow

### 3.1 High-Level Relayer Lifecycle

```
┌─────────────────────────────────────────────────────────────────┐
│ 1. HEADER WATCHING                                              │
│ Relayer polls source chain RPC every N blocks                   │
└─────────────────────────────────────────────────────────────────┘
  ↓
┌─────────────────────────────────────────────────────────────────┐
│ 2. FINALITY CHECK                                               │
│ Waits until block height ≥ finality_threshold                   │
│ (EVM: 12 blocks, SVM: 32 confirmations, X3: 1 block)           │
└─────────────────────────────────────────────────────────────────┘
  ↓
┌─────────────────────────────────────────────────────────────────┐
│ 3. PROOF ACQUISITION                                            │
│ Calls source chain RPCs for:                                    │
│  - Header (block hash, state root, timestamp)                   │
│  - Merkle proof (if EVM contract state is involved)             │
│  - Validator signatures (if SVM finality required)              │
└─────────────────────────────────────────────────────────────────┘
  ↓
┌─────────────────────────────────────────────────────────────────┐
│ 4. PROOF SUBMISSION TO X3                                       │
│ Calls `X3VerifierApi::verify_bridge_proof()`                    │
│ via node RPC: submitCrossVmTransaction or dedicated endpoint     │
└─────────────────────────────────────────────────────────────────┘
  ↓
┌─────────────────────────────────────────────────────────────────┐
│ 5. SETTLEMENT POLL                                              │
│ Polls `queryProofFinality` RPC until status = Confirmed         │
│ Relayer earns fee once settlement finalizes                     │
└─────────────────────────────────────────────────────────────────┘
```

### 3.2 Relayer Implementation (Pseudocode)

#### Startup & Configuration

```python
class X3Relayer:
    def __init__(self, config):
        self.x3_rpc = RpcClient(config.x3_node_rpc)
        self.source_rpcs = {
            100: RpcClient(config.evm_sepolia_rpc),  # Domain 100 = Sepolia
            500: RpcClient(config.svm_mainnet_rpc),  # Domain 500 = Solana
        }
        self.chain_registry = self.x3_rpc.call(
            "x3_getChainRegistry"
        )
        self.nonce = self.x3_rpc.call(
            "system_accountNextIndex", self.relayer_account
        )
        self.submitted_proofs = set()  # Replay protection cache

    def start(self):
        while True:
            for domain_id, source_rpc in self.source_rpcs.items():
                self.process_domain(domain_id, source_rpc)
            time.sleep(self.config.poll_interval_sec)
```

#### Header Watching & Processing

```python
    def process_domain(self, domain_id: int, source_rpc):
        # Step 1: Get current chain tip from source
        current_height = source_rpc.call("eth_blockNumber")
        
        # Step 2: Check against ChainRegistry finality threshold
        chain_config = self.chain_registry[domain_id]
        finality_threshold = chain_config.finality_threshold
        
        if current_height < finality_threshold:
            return  # Not enough confirmations yet
        
        # Step 3: For each block in [last_processed + 1, current - finality]:
        for height in range(self.last_processed[domain_id] + 1, current_height - finality_threshold + 1):
            header = source_rpc.call("eth_getBlockByNumber", hex(height), False)
            
            # Step 4: Acquire proof data
            proof = self.acquire_proof(
                domain_id=domain_id,
                block_height=height,
                state_root=header.state_root,
                source_rpc=source_rpc
            )
            
            # Step 5: Submit to X3
            self.submit_proof(
                domain_id=domain_id,
                proof=proof,
                height=height
            )
```

#### Proof Acquisition (EVM Example)

```python
    def acquire_proof(self, domain_id: int, block_height: int, 
                      state_root: str, source_rpc) -> EvmHeaderProof:
        """Acquires header proof from EVM chain."""
        
        # For EVM, proof includes:
        # 1. Block header (hash, timestamp, state root)
        # 2. Merkle proof of state root (from trusted contract)
        # 3. Validator signatures (if EVM has consensus-level state root)
        
        header = source_rpc.call("eth_getBlockByNumber", hex(block_height), True)
        
        # Call X3 bridge contract for state root proof
        bridge_contract = chain_config[domain_id].state_root_contract
        proof = source_rpc.call(
            "eth_call",
            {
                "to": bridge_contract,
                "data": encode_function_call(
                    "getStateRootProof",
                    state_root
                )
            }
        )
        
        return EvmHeaderProof(
            block_hash=header.hash,
            block_height=header.number,
            state_root=header.state_root,
            timestamp=header.timestamp,
            state_root_proof=proof,
            proof_nonce=self.nonce
        )
```

#### Proof Submission to X3

```python
    def submit_proof(self, domain_id: int, proof: HeaderProof, height: int):
        """Submits proof to X3 settlement pallet."""
        
        # Step 1: Check replay protection (idempotency)
        proof_hash = hash(proof)
        if proof_hash in self.submitted_proofs:
            logging.info(f"Proof {proof_hash} already submitted, skipping")
            return
        
        # Step 2: Build extrinsic
        extrinsic = self.x3_rpc.build_extrinsic(
            method="x3_submitCrossVmTransaction",
            params={
                "source_domain": domain_id,
                "proof": proof.encode(),
                "height": height,
            }
        )
        
        # Step 3: Sign with relayer private key
        signed_extrinsic = self.signer.sign(extrinsic, nonce=self.nonce)
        
        # Step 4: Submit to X3 RPC
        try:
            tx_hash = self.x3_rpc.call(
                "author_submitExtrinsic",
                signed_extrinsic
            )
            self.submitted_proofs.add(proof_hash)
            self.nonce += 1
            
            logging.info(f"Submitted proof {proof_hash}, tx={tx_hash}")
        except Exception as e:
            logging.error(f"Failed to submit proof: {e}")
            # Retry on next cycle
```

#### Settlement Finality Polling

```python
    def poll_finality(self, proof_hash: str, timeout_blocks: int = 100):
        """Polls finality status until confirmed or timeout."""
        
        start_block = self.x3_rpc.call("chain_getFinalizedHead")
        
        while True:
            current_block = self.x3_rpc.call("chain_getFinalizedHead")
            
            # Timeout after N blocks
            if current_block - start_block > timeout_blocks:
                logging.error(f"Proof {proof_hash} finality timeout")
                return None
            
            # Query proof finality status
            finality = self.x3_rpc.call(
                "queryProofFinality",
                proof_hash
            )
            
            if finality.status == "Confirmed":
                logging.info(f"Proof {proof_hash} finalized!")
                self.on_proof_finalized(proof_hash)
                return finality
            
            time.sleep(2)  # Poll every ~2 seconds
```

---

## Part 4: Integration with Runtime APIs

### 4.1 Relayer ↔ CrossChainStateRootApi (Phase 9)

**Relayer calls** (via RPC):
```
x3_submitCrossVmTransaction(
    source_domain: u32,
    proof: CrossChainProof,
    height: u32
)
```

**Routes to runtime API** (gpu-validator):
```rust
impl CrossChainStateRootApi for Runtime {
    fn validate_evm_header(
        chain_id: u64,
        state_root: H256,
        proof: H256,
    ) -> EvmHeaderProof {
        // 1. Verify state root hash matches proof
        // 2. Check against ChainRegistry finality threshold
        // 3. Return EvmHeaderProof or error
    }
    
    fn query_cross_chain_status() -> CrossChainStatus {
        // Returns current cross-chain header state
        // (last confirmed height per domain, aggregate metrics)
    }
}
```

**Data flow:**
```
Relayer (off-chain)
  ↓
RPC endpoint (node/src/rpc.rs: submitCrossVmTransaction)
  ↓
Runtime API (gpu-validator: CrossChainStateRootApi)
  ↓
Pallet storage (pallet-x3-verifier: Jobs, VerificationEnabled)
  ↓
Settlement finality (GovernanceSettlementApi polls this)
```

### 4.2 Relayer ↔ GovernanceSettlementApi (Phase 10a)

**After proof verification**, settlement governance is triggered:

```rust
impl GovernanceSettlementApi for Runtime {
    fn submit_dispute(proof_hash: H256, reason: Vec<u8>) 
        -> Option<DisputeRecord> {
        // Called by governance if proof verification fails
        // Returns dispute ID for tracking
    }
    
    fn query_dispute_status(proof_hash: H256) -> Option<DisputeRecord> {
        // Relayer polls this to track dispute resolution
    }
}
```

**Relayer polling sequence:**
```
1. Submit proof via CrossChainStateRootApi
2. Poll queryProofFinality every 2 blocks
3. If status remains "Unconfirmed" for > threshold blocks:
   - Proof is challenged
   - queryDisputeStatus shows disputed reason
4. Dispute resolves → finality confirmed or rejected
5. Relayer receives fee or faces slashing (if malicious)
```

---

## Part 5: Replay Protection & Idempotency

### 5.1 Replay Attack Scenario

**Without replay protection:**
```
Block 100: Relayer submits Proof A (Ethereum block 1000)
Block 101: Node crashes, proof still pending
Block 101: Relayer resubmits same Proof A
Block 102: Settlement processes BOTH proofs
Block 103: Double-settlement occurs (bridge drained)
```

### 5.2 Replay Protection Implementation

**Mechanism:** Proof nonce + hash-based cache

```rust
#[pallet::storage]
pub type ProofRegistry<T: Config> = 
    StorageMap<_, Blake2_128Concat, H256, ProofRecord>;
    // Key: proof_hash
    // Value: (block_number, status, relayer_nonce)

pub struct ProofRecord {
    pub block_number: BlockNumber,
    pub status: ProofStatus,  // Verified|Disputed|Finalized
    pub relayer_nonce: u32,
}
```

**Verification logic in `GovernanceSettlementApi::submit_dispute`:**

```rust
pub fn submit_dispute(proof_hash: H256, reason: Vec<u8>) -> Option<DisputeRecord> {
    // Check 1: Is this proof already in registry?
    if let Some(record) = ProofRegistry::<T>::get(proof_hash) {
        // Proof already processed; is it fresh?
        if record.status == ProofStatus::Finalized {
            // Already finalized; ignore replay
            return None;
        }
        if record.status == ProofStatus::Disputed {
            // Already disputed; return existing dispute
            return Some(record.dispute_id);
        }
    }
    
    // Check 2: Verify relayer nonce is sequential
    let relayer = Extrinsic::caller();
    let current_nonce = frame_system::pallet::Account::<T>::get(relayer).nonce;
    // Nonce checked by frame-system before extrinsic execution
    
    // Check 3: Create new dispute record
    let dispute_id = DisputeCounter::<T>::mutate(|n| {
        *n += 1;
        *n
    });
    
    ProofRegistry::<T>::insert(proof_hash, ProofRecord {
        block_number: frame_system::pallet::Pallet::<T>::block_number(),
        status: ProofStatus::Disputed,
        relayer_nonce: current_nonce,
    });
    
    Some(DisputeRecord {
        dispute_id,
        proof_hash,
        challenger: relayer,
        reason,
        status: DisputeStatus::UnderReview,
    })
}
```

### 5.3 Relayer-Side Idempotency Cache

```python
class X3Relayer:
    def __init__(self, ...):
        self.submitted_proofs: Dict[str, SubmissionRecord] = {}
        # Format: {proof_hash: (tx_hash, block_height, status)}
    
    def submit_proof(self, proof: HeaderProof):
        proof_hash = hash(proof)
        
        # Check 1: Is this already submitted?
        if proof_hash in self.submitted_proofs:
            record = self.submitted_proofs[proof_hash]
            if record.status == "Finalized":
                logging.info(f"Proof {proof_hash} already finalized, skipping")
                return
            # If pending, allow retry (different transaction, same proof)
        
        # Check 2: Increment nonce ONCE per unique proof
        extrinsic = build_extrinsic(..., nonce=self.nonce)
        self.nonce += 1
        
        # ... submit ...
        
        self.submitted_proofs[proof_hash] = SubmissionRecord(
            tx_hash=tx_hash,
            block_height=current_block,
            status="Pending"
        )
```

---

## Part 6: Pause & Recovery Semantics

### 6.1 Why Pause?

Bridge pauses when:
1. **Critical bug discovered** → Safety pause while analyzing
2. **Validator attestation consensus broken** → Wait for governance fix
3. **Cross-chain finality fork** → Halt until fork resolves

### 6.2 On-Chain Pause Mechanism

```rust
#[pallet::storage]
pub type BridgePausedStatus<T: Config> = 
    StorageValue<_, BridgePauseState>;

pub enum BridgePauseState {
    Running,
    Paused {
        reason: BoundedString,
        paused_at_block: BlockNumber,
        requested_by: AccountId,
    },
}
```

**Governance triggers pause:**
```rust
pub fn pause_bridge(reason: String) -> DispatchResult {
    // Only governance can pause
    ensure_governance()?;
    
    BridgePausedStatus::<T>::put(BridgePauseState::Paused {
        reason: reason.try_into()?,
        paused_at_block: frame_system::pallet::Pallet::<T>::block_number(),
        requested_by: frame_system::pallet::Pallet::<T>::account_id(),
    });
    
    // Emit event for relayers
    Self::deposit_event(Event::BridgePaused { reason });
    Ok(())
}
```

**Relayer respects pause:**
```python
def process_domain(self, domain_id: int, source_rpc):
    # Check if bridge is paused
    pause_state = self.x3_rpc.call("x3_getBridgePauseState")
    
    if pause_state == "Paused":
        logging.warning(f"Bridge paused: {pause_state.reason}")
        # Stop submitting proofs
        return
    
    # Normal processing...
```

### 6.3 Recovery Process

1. **Governance diagnoses issue**
2. **Governance submits `unpause_bridge()`**
3. **Vote passes** → Bridge resumes
4. **Relayers resume header watching** (no catchup needed due to replay protection)

---

## Part 7: Cross-Chain Proof Format

### 7.1 EVM Proof Structure

```rust
pub struct EvmHeaderProof {
    pub block_height: u32,
    pub block_hash: H256,
    pub state_root: H256,
    pub timestamp: u64,
    pub state_root_proof: Vec<u8>,  // Merkle proof from bridge contract
    pub nonce: u32,  // Relayer transaction nonce
}

impl Encode for EvmHeaderProof { ... }
impl Decode for EvmHeaderProof { ... }
```

### 7.2 SVM Proof Structure

```rust
pub struct SvmHeaderProof {
    pub slot: u64,
    pub blockhash: [u8; 32],
    pub block_time: u64,
    pub validator_signatures: Vec<(PublicKey, Signature)>,
    pub signature_count: u32,
    pub required_signatures: u32,  // Consensus threshold
}
```

### 7.3 Proof Submission via RPC

```json
POST /

{
  "jsonrpc": "2.0",
  "method": "x3_submitCrossVmTransaction",
  "params": [
    {
      "source_domain": 100,
      "proof": "0x...",  // Encoded EvmHeaderProof
      "height": 18500000
    }
  ],
  "id": 1
}

RESPONSE:

{
  "jsonrpc": "2.0",
  "result": {
    "transaction_hash": "0xabc...",
    "proof_hash": "0xdef...",
    "status": "Verified"
  },
  "id": 1
}
```

---

## Part 8: End-to-End Bridge Lifecycle

### 8.1 Happy Path: Ethereum Block → X3 Settlement

```
[Block 18500000 on Ethereum Sepolia]
  ↓
[12 blocks pass (confirmations = 12, threshold met)]
  ↓
[Relayer polls eth_getBlockByNumber(18500000)]
  ↓
[Relayer acquires proof from bridge contract]
  ↓
[Relayer submits to X3: x3_submitCrossVmTransaction]
  ↓
[X3 block N: CrossChainStateRootApi::validate_evm_header validates proof]
  ↓
[X3 block N+1: Proof stored in pallet-x3-verifier::Jobs]
  ↓
[Relayer polls queryProofFinality every 2 blocks]
  ↓
[X3 block N+1: GovernanceSettlementApi records validator attestations]
  ↓
[X3 block N+2: Finality threshold (1 confirmation) reached]
  ↓
[queryProofFinality returns status = "Confirmed"]
  ↓
[Relayer collects fee, moves to next block]
```

**Timeline:**
- Ethereum: ~3 min (12 blocks × 12s)
- X3 submission: ~0.2 sec (1 block × 200ms)
- Settlement confirmation: ~0.2 sec (1 X3 block)
- **Total latency: ~3 min from Ethereum finality to settlement**

### 8.2 Dispute Path: Proof Challenged

```
[Proof submitted to X3, status = Verifying]
  ↓
[Validator notices proof inconsistency]
  ↓
[Validator submits dispute: submitDispute(proof_hash, reason)]
  ↓
[X3 block N: Governance poll opens]
  ↓
[Validators vote on dispute validity]
  ↓
[Consensus reached: Proof is invalid]
  ↓
[Relayer is fined/reputation decreased]
  ↓
[Proof status = Disputed, not eligible for settlement]
  ↓
[Relayer resubmits corrected proof from same block]
```

---

## Part 9: Testnet Bridge Validation Checklist

**Before testnet deployment, verify:**

- [ ] ChainRegistry initialized with Sepolia + Solana testnet configs
- [ ] Relayer can connect to X3 testnet RPC
- [ ] Relayer successfully submits Sepolia block proof
- [ ] queryProofFinality returns correct finality status
- [ ] Proof disputes trigger correctly
- [ ] Validator attestation aggregation works
- [ ] Pause/resume functionality tested
- [ ] Replay protection verified (idempotent resubmission)
- [ ] Fee calculation and relayer payout tested
- [ ] Cross-chain finality threshold (EVM 12, SVM 32, X3 1) validated

**Test scenario:**
1. Send test transaction on Sepolia → wait 12 blocks
2. Relayer submits proof
3. Poll finality until confirmed (~0.2s)
4. Verify settlement occurred without double-processing

---

## Part 10: Relayer Deployment Topology

### Production Architecture

```
                ┌─────────────────────────────────────────┐
                │ X3 Chain (Mainnet)                      │
                │  - pallet-x3-verifier                   │
                │  - pallet-x3-settlement-engine          │
                │  - pallet-x3-kernel (governance)        │
                └─────────────────────────────────────────┘
                     ↑
                     │ RPC: submitCrossVmTransaction
                     │
        ┌────────────┴────────────┬────────────┐
        │                         │            │
    ┌───┴────┐          ┌────────┴──┐    ┌────┴─────┐
    │Relayer1│          │ Relayer 2  │    │ Relayer N │
    └────┬───┘          └────┬───────┘    └────┬─────┘
         │                   │                 │
   ┌─────┴────────────────────┴─────────────────┴─────┐
   │ Source Chain RPC Endpoints                      │
   │  - Ethereum: eth_getBlockByNumber, etc.         │
   │  - Solana: getBlockCommitment, getBlock, etc.   │
   │  - Polygon: eth_getBlockByNumber, etc.          │
   └──────────────────────────────────────────────────┘
```

**Deployment considerations:**
- Relayers are **stateless** (any operator can run)
- Multiple relayers improve **censorship resistance**
- Each relayer maintains its own replay protection cache
- No shared state required (idempotent submission via nonce)

---

## Part 11: Recommended Testnet Rollout

### Phase 13a: Specification (This Phase) ✅

- Define ChainRegistry
- Document relayer lifecycle
- Specify pause/recovery
- Design proof formats

### Phase 13b: Integration Testing

- Implement ChainRegistry storage
- Test CrossChainStateRootApi + GovernanceSettlementApi integration
- Verify RPC endpoint acceptance of cross-VM proofs
- Validate replay protection with duplicate submissions

### Phase 13c: Relayer Deployment

- Deploy relayer service (on testnet)
- Test Sepolia → X3 testnet bridge
- Validate finality polling and settlement
- Stress test with multiple relayers

---

## Key Dependencies

| Component | Status | Phase | Notes |
|-----------|--------|-------|-------|
| CrossChainStateRootApi | ✅ Implemented | 9 | EVM/SVM proof validation |
| GovernanceSettlementApi | ✅ Implemented | 10a | Settlement finality tracking |
| X3DomainRegistryApi | ✅ Implemented | 6 | Domain routing |
| pallet-x3-verifier | ✅ Implemented | 6 | Proof storage & verification |
| RPC submitCrossVmTransaction | ✅ Implemented | 6 | Relayer submission endpoint |
| ChainRegistry (on-chain) | ⏳ Phase 13b | 13 | Governance-managed domain config |
| Relayer service | ⏳ Phase 13c | 13 | Off-chain proof aggregation |
| Pause/recovery mechanism | ⏳ Phase 13b | 13 | Safety circuit breaker |

---

## Exit Criteria for Phase 13

- ✅ Complete relayer responsibility document (this spec)
- ✅ ChainRegistry specification with example configs
- ✅ End-to-end bridge lifecycle fully documented
- ✅ Relayer → runtime API integration verified
- ✅ Replay protection & idempotency designed
- ✅ Pause/recovery semantics specified
- ✅ Testnet validation checklist created
- ⏳ Integration testing (Phase 13b)
- ⏳ Relayer implementation (Phase 13c)

---

## Appendix: Common Relayer Failure Modes & Recovery

| Failure | Cause | Detection | Recovery |
|---------|-------|-----------|----------|
| Proof stuck "Unconfirmed" | Finality threshold increased | Poll timeout > 100 blocks | Resubmit with updated threshold |
| Bridge paused by governance | Critical bug found | RPC returns "Paused" | Poll unpause event, resume |
| Nonce out of sync | Relayer crash/restart | Extrinsic rejected | Query system_accountNextIndex, resume |
| Replay attack detected | Bug in cache logic | queryProofFinality returns duplicate | Use idempotent submission, skip retry |
| Relayer slashed | Malicious proof | Check validator reputation API | Investigate, resubmit corrected proof |

