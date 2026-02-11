# P5: DAYS 1-5 EVM GPU KERNEL ROADMAP
## secp256k1 + keccak256 GPU Acceleration 

**Phase**: Cross-Chain GPU Validator (P5) Phase 1
**Duration**: 5 days (Feb 9-14, 2026)
**Effort**: 36 hours (~7.2 hours/day)
**Output**: 3 production-ready EVM GPU kernels

---

## OVERVIEW: Why EVM GPU Matters

Ethereum uses **secp256k1** for signatures (different from Solana's Ed25519) and **keccak256** for hashing (different from Solana's SHA256). These are the bottlenecks for EVM validator performance.

**Target Performance**:
- secp256k1: 600k-800k signature verifications/sec per GPU
- keccak256: 200-400k hash operations/sec per GPU  
- Combined EVM TPS: 1-2M (target varies by load)

**Why GPU Helps**: 
- Crypto math is highly parallelizable (thousands of sigs simultaneously)
- Dedicated crypto hardware (tensor cores) runs 10-100x faster than CPU
- Bottleneck: Transfer to/from GPU (must batch, not worth it for single sig)

**Key Insight**: Each EVM block has ~100-200 transactions, each validating ~1-5 signatures. One GPU can verify all signatures in one block in <1ms.

---

## DAY 1: EVM GPU ARCHITECTURE & secp256k1 KERNEL DESIGN

### Objective
Design and prototype the secp256k1 batch signature verification kernel for CUDA.

### Tasks

#### 1.1 Review secp256k1 Math (1 hour)
**What**: Understand elliptic curve math differences from Ed25519
- **Ed25519** (Solana): Montgomery curve, radically fast
- **secp256k1** (Bitcoin/Ethereum): Weierstrass curve, more complex math
- **Key difference**: secp256k1 requires modular inversion, harder to parallelize

**Deliverable**: Understand why secp256k1 is "harder" but still viable

#### 1.2 Design Batch Verification Strategy (2 hours)
**Concept**: Instead of verifying one signature at a time, verify 64-128 in parallel.

```
Standard (CPU):
  For each signature:
    - Check ECDSA equation: R = [k]G + [e]Q
    - 2-3ms per sig → 333 sig/sec per CPU core

GPU Batch (CUDA):
  Block of 64 signatures:
    - Each thread handles 1 signature
    - 64 threads in parallel = 64x faster (in theory)
    - Actual: 10-20x faster due to memory/latency
    - Result: 3000-6000 sig/sec per GPU
```

**Deliverable**: Algorithm design doc (pseudo-code + complexity analysis)

#### 1.3 Set Up Development Environment (2 hours)
**Setup**:
- CUDA Toolkit 11.8 installed ✅ (from P4)
- cuDNN for accelerated crypto (optional but helpful)
- Test harness: Python wrapper around CUDA kernels
- Benchmark framework: timing + accuracy validation

**Deliverable**: Makefile + build scripts for EVM GPU kernel

#### 1.4 Prototype secp256k1 Kernel (3 hours)
**Code Structure**:
```cuda
__global__ void verify_secp256k1_batch(
    uint8_t* signatures,    // 64-byte each
    uint8_t* public_keys,   // 33-byte compressed, 65-byte uncompressed
    uint8_t* messages,      // 32-byte hashes
    int count,              // how many to verify
    uint8_t* results        // 1 = valid, 0 = invalid
) {
    int idx = blockIdx.x * blockDim.x + threadIdx.x;
    if (idx >= count) return;
    
    // Each thread verifies one signature
    uint8_t sig[64] = signatures[idx * 64 : (idx+1)*64];
    point_t pk = decompress_point(public_keys[idx]);
    hash_t msg = messages[idx * 32 : (idx+1)*32];
    
    // ECDSA check: R == [r^-1 * (z*G + r*Q)]_x mod p
    // Simplified: verify the curve equation
    results[idx] = ecdsa_verify(sig, pk, msg) ? 1 : 0;
}
```

**Complexity**: 
- Modular arithmetic (add, sub, mul, inv) mod p = 2^256 - 2^32 - 977
- Point addition (projective coords to minimize inversions)
- ~50-100 operations per signature

**Deliverable**: First CUDA kernel (untested, ~150 LOC)

### Validation (Day 1 End)
```
✅ Kernel code compiles (nvcc)
✅ Algorithm correct (mathematical check)
❌ Performance unknown (test tomorrow)
```

---

## DAY 2: secp256k1 PERFORMANCE OPTIMIZATION & CPU PARITY

### Objective
Optimize secp256k1 kernel to 600k-800k sig/sec and verify it matches CPU results.

### Tasks

#### 2.1 Implement CPU Reference (2 hours)
**Purpose**: golden standard to test GPU against

```python
def verify_secp256k1_cpu(signature, public_key, message_hash):
    # Use libsecp256k1 (battle-tested library)
    # Return True/False for each signature
    ...
```

**Deliverable**: CPU verification function (use existing library if available)

#### 2.2 Optimize Kernel for Memory Access (3 hours)
**Problem**: GPU kernels are memory-bound, not compute-bound

**Optimization Techniques**:
1. **Coalesced Memory Access**: Load signatures sequentially (GPU pattern)
2. **Shared Memory**: Cache public key points in shared memory
3. **Batch Loading**: Load 256 signatures at once, process in waves
4. **Reduce Inversions**: Use Jacobian coordinates (1 inversion per 20 ops, not per op)

**Code Pattern**:
```cuda
__global__ void verify_secp256k1_batch_optimized(
    const uint8_t* __restrict__ sigs,      // Device memory (coalesced)
    const uint8_t* __restrict__ pks,
    const uint8_t* __restrict__ msgs,
    int count,
    uint8_t* __restrict__ results
) {
    __shared__ jacobian_point_t pk_cache[256];  // Shared memory
    
    // Load 256 public keys into shared cache
    if (threadIdx.x < 256) {
        pk_cache[threadIdx.x] = load_pk(pks + threadIdx.x * 33);
    }
    __syncthreads();
    
    // Each thread verifies one signature
    int idx = blockIdx.x * blockDim.x + threadIdx.x;
    if (idx < count) {
        jacobian_point_t pk = pk_cache[idx % 256];
        uint8_t sig = sigs[idx];
        uint8_t msg = msgs[idx];
        results[idx] = verify_ecdsa_jacobian(sig, pk, msg);
    }
}
```

**Expected Improvement**: 10-50x vs. naive kernel

#### 2.3 Benchmark & Profile (2 hours)
**Benchmark Setup**:
```python
# Test 10,000 signatures
gpu_verify_batch(sigs=10k, pks=10k, msgs=10k)
# Measure: throughput (sig/sec) + latency (ms/batch)

# Compare to CPU
cpu_verify_batch(sigs=10k)  # Single-threaded baseline
```

**Target**: 600k-800k sig/sec on single GPU

**Fallback**: If <600k, debug (usually memory bottleneck)

#### 2.4 Validate CPU/GPU Parity (1 hour)
**Test**: Run 10,000 random signatures, compare GPU vs. CPU results
```python
for i in range(10000):
    gpu_result = gpu_verify(sig[i], pk[i], msg[i])
    cpu_result = cpu_verify(sig[i], pk[i], msg[i])
    assert gpu_result == cpu_result, f"Mismatch at {i}"
```

**Success Criteria**:
- ✅ All results match CPU 
- ✅ GPU throughput >= 600k sig/sec
- ✅ No crashes or memory errors

### Validation (Day 2 End)
```
✅ secp256k1 kernel optimized to 600k-800k sig/sec
✅ CPU/GPU results match perfectly (tested on 10k+ sigs)
✅ Memory efficient (< 100MB VRAM for 10k batch)
```

---

## DAY 3: KECCAK256 GPU ACCELERATION

### Objective
Implement GPU-accelerated keccak256 hashing (more difficult than SHA256 due to algorithm structure).

### Context
Ethereum state tree uses Merkle trees with keccak256 hashing. Validating state transitions requires hashing many nodes (~100-1000 per block).

**Challenge**: keccak256 is more compute-intensive than SHA256, less amenable to GPU acceleration. But batching helps.

### Tasks

#### 3.1 Understanding keccak256 (1 hour)
**Algorithm Structure** (simplified):
- Input: 1088-bit message (Ethereum uses 32-byte hash → padded)
- 24 rounds of XOR + rotation + chi + theta operations
- Output: 256-bit hash

**Key Property**: Highly regular, perfect for SIMD/GPU parallelization
- Each round is the same operation on different data
- No branching, no memory-dependent control flow

#### 3.2 Design Batch Strategy (1 hour)
**Concept**: Hash 256 messages in parallel (not sequential)

```
Standard (CPU):
  For each message:
    - Run 24 rounds of keccak ops → 1-2 microseconds
    - 500k-1M hash/sec per CPU core

GPU Batch:
  Block of 256 messages:
    - Each thread handles 1 message
    - 256 threads in parallel
    - Actual: 200-400k hash/sec (not 256x, due to memory/ops)
```

**Why Slower Than Ed25519**: keccak is more complex (24 rounds vs. 10 ops for SHA256)

#### 3.3 Implement GPU Kernel (3 hours)
**Code Structure**:
```cuda
__global__ void keccak256_batch(
    const uint8_t* messages,      // 32 bytes each
    int count,
    uint8_t* digests              // 32 bytes each
) {
    int idx = blockIdx.x * blockDim.x + threadIdx.x;
    if (idx >= count) return;
    
    // Each thread computes keccak256 for one message
    uint8_t msg[32];
    uint8_t digest[32];
    
    // Copy message from global memory
    for (int i = 0; i < 32; i += 4) {
        *(uint32_t*)(msg + i) = *(uint32_t*)(messages + idx * 32 + i);
    }
    
    // Run keccak256 (use library or inline)
    keccak256(msg, 32, digest);
    
    // Copy result back
    for (int i = 0; i < 32; i += 4) {
        *(uint32_t*)(digests + idx * 32 + i) = *(uint32_t*)(digest + i);
    }
}
```

**Library Option**: Use existing cuBLAS or cuCrypto if available, or implement inline

#### 3.4 Benchmark & Validate (1 hour)
**Test**: In validation set = 10,000 random 32-byte messages
```python
gpu_hashes = gpu_keccak256_batch(messages, 10000)
cpu_hashes = [hashlib.sha3_256(msg).digest() for msg in messages]
assert gpu_hashes == cpu_hashes
```

**Target**: 200-400k hash/sec

### Validation (Day 3 End)
```
✅ keccak256 GPU kernel implemented
✅ 200-400k hash/sec achieved
✅ CPU/GPU results match on 10k+ hashes
```

---

## DAY 4: EVM STATE ROOT GPU VALIDATION

### Objective
Combine secp256k1 + keccak256 to validate EVM state tree updates (the actual validator workload).

### Context
An EVM block contains:
- ~200 transactions (~100-200 signatures)
- State tree updates (1000-5000 keccak256 hashes to verify tree consistency)
- Total: ~1500 hashes + ~150 signatures per block

GPU validation in one block: <2ms ✓

### Tasks

#### 4.1 Design State Root Algorithm (2 hours)
**Algorithm**:
1. Collect all signature validations → batch to GPU
2. Collect state tree hashes → batch to GPU
3. Aggregate results
4. Verify: state root (parent merkle hash(transactions, state updates))

**Complexity**: Must maintain merkle tree structure (can't parallelize tree ops)

#### 4.2 Implement GPU State Validator (2 hours)
**Structure**:
```python
class EVMStateValidator:
    def __init__(self):
        self.gpu_sig_verifier = GPUSecp256k1()   # From Day 2
        self.gpu_keccak = GPUKeccak256()          # From Day 3
    
    def validate_block(self, block):
        # 1. Validate all tx signatures (GPU parallel)
        sig_valid = self.gpu_sig_verifier.batch_verify(
            block.transactions.signatures,
            block.transactions.public_keys,
            block.transactions.hashes
        )
        
        # 2. Hash state tree nodes (GPU parallel)
        new_state_root = block.state_root  # already computed by client
        tree_hashes = self.gpu_keccak.batch_hash(
            block.state_changes.nodes
        )
        
        # 3. Aggregate and verify merkle
        root = aggregate_merkle_tree(tree_hashes)
        
        # Result: All sigs valid? Root matches? Block is valid ✓
        return all(sig_valid) and root == new_state_root
```

**Test Case**: 
```python
# Ethereum testnet block (real data)
block = eth_client.get_block(17000000)  # Real block
is_valid = validator.validate_block(block)
assert is_valid == True  # Should validate to Ethereum's own result
```

#### 4.3 Performance Test (1 hour)
**Benchmark**:
```python
# 1000 blocks
for block in testnet_blocks[:1000]:
    start = time.time()
    is_valid = validator.validate_block(block)
    elapsed = time.time() - start
    print(f"Block {block.number}: {elapsed*1000:.1f}ms")

avg_ms = sum(times) / len(times)
print(f"Average: {avg_ms:.1f}ms/block → {1000/avg_ms:.0f} blocks/sec")
```

**Target**: 500+ blocks/sec (blocks, not TPS)
- 1 block = ~150 tx = 150-200 TPS
- 500 blocks/sec = 75-100k TPS for block validation alone

### Validation (Day 4 End)
```
✅ State root validator implemented (sig + hash validation)
✅ Validates real Ethereum testnet blocksgetId
✅ Performance: 500+ blocks/sec validated
```

---

## DAY 5: FULL EVM GPU ORCHESTRATOR & INTEGRATION TESTS

### Objective
Integrate secp256k1 + keccak256 + state validator into full EVM GPU pipeline (equivalent to P4 Day 5).

### Tasks

#### 5.1 Build EVM GPU Orchestrator (3 hours)
**Architecture**:
```
EVM Block Stream
    ↓
GPU Orchestrator:
    ├─ Collect block data → transfer to GPU
    ├─ Run secp256k1 batch (sigs)
    ├─ Run keccak256 batch (state tree)
    ├─ Aggregate results
    └─ Return valid/invalid
    ↓
Next Block
```

**Key Metric**: End-to-end latency (block in → validation complete)

```python
class EVMGPUOrchestrator:
    def __init__(self, num_gpus=1, batch_size=16):
        self.gpus = [GPUContext() for _ in range(num_gpus)]
        self.sig_verifier = [GPUSecp256k1() for _ in self.gpus]
        self.keccak = [GPUKeccak256() for _ in self.gpus]
        self.batch_size = batch_size
    
    def process_block_stream(self, blocks):
        # Queue blocks for GPU processing
        queue = []
        for block in blocks:
            queue.append(block)
            if len(queue) >= self.batch_size:
                results = self._batch_validate(queue)
                yield results
                queue = []
        
        # Process remaining
        if queue:
            yield self._batch_validate(queue)
    
    def _batch_validate(self, block_batch):
        # Collect all sigs and hashes from batch
        all_sigs = [sig for block in block_batch for sig in block.sigs]
        all_msgs = [msg for block in block_batch for msg in block.msgs]
        all_pks = [pk for block in block_batch for pk in block.pks]
        all_hashes = [node for block in block_batch for node in block.state_nodes]
        
        # GPU validation (parallel)
        sig_results = self.sig_verifier[0].batch_verify(all_sigs, all_pks, all_msgs)
        hash_results = self.keccak[0].batch_hash(all_hashes)
        
        # Aggregate by block
        results = []
        idx = 0
        for block in block_batch:
            block_sigs_valid = all(sig_results[idx:idx + len(block.sigs)])
            idx += len(block.sigs)
            results.append(block_sigs_valid)
        
        return results
```

#### 5.2 Comprehensive Testing (2 hours)
**Test Suite**:
```python
class TestEVMGPUOrchestrator:
    
    def test_single_block(self):
        # Real Ethereum testnet block
        block = fetch_testnet_block(17000000)
        results = orchestrator.validate([block])
        assert results[0] == True  # Block should be valid
    
    def test_batch_100_blocks(self):
        # Fetch 100 blocks
        blocks = fetch_testnet_blocks(17000000, 17000100)
        results = orchestrator.validate(blocks)
        assert all(results)  # All should be valid
        
        # Measure throughput
        elapsed = measure_time(lambda: orchestrator.validate(blocks))
        tps_blocks = 100 / elapsed
        tps = tps_blocks * 150  # 150 tx/block avg
        print(f"Throughput: {tps_blocks:.0f} blocks/sec = {tps:.0f} TPS")
    
    def test_invalid_signature_rejected(self):
        # Create fake invalid sig
        block = fetch_testnet_block(17000000)
        block.transactions[0].signature = b'\x00' * 64
        results = orchestrator.validate([block])
        assert results[0] == False  # Should be rejected
    
    def test_memory_stability(self):
        # Run for 1000 blocks, check VRAM doesn't leak
        blocks = fetch_testnet_blocks(17000000, 17001000)
        for i in range(10):
            results = orchestrator.validate(blocks[i*100:(i+1)*100])
        # Assert VRAM < 2GB max
        assert get_gpu_memory() < 2000  # MB
    
    def test_cpu_only_fallback(self):
        # Disable GPU, validate should still work (slow)
        orchestrator.use_cpu = True
        blocks = fetch_testnet_blocks(17000000, 17000010)
        results = orchestrator.validate(blocks)
        assert all(results)
        # CPU-only should be slower but correct
```

**Expected Results**:
- ✅ Single block: valid ✓
- ✅ Batch 100 blocks: 500+ blocks/sec = 75-100k TPS
- ✅ Invalid sig detected ✓
- ✅ Memory stable (no leaks) ✓
- ✅ CPU fallback works ✓

### Validation (Day 5 End)
```
✅ Full EVM GPU pipeline implemented
✅ Validates real Ethereum testnet blocks at 500+ blocks/sec
✅ Fallback mechanisms working
✅ Ready for P5 Days 6-10 (Atomic Swap Orchestrator)
```

---

## SUMMARY: DAYS 1-5 DELIVERABLES

| Day | Component | Status | Performance |
|-----|-----------|--------|-------------|
| 1 | secp256k1 kernel design | ✅ | N/A (prototype) |
| 2 | secp256k1 optimization | ✅ | 600-800k sig/sec |
| 3 | keccak256 GPU kernel | ✅ | 200-400k hash/sec |
| 4 | State root validator | ✅ | 500+ blocks/sec |
| 5 | Full orchestrator | ✅ | 75-100k TPS (EVM only) |

**Total Output**: 3 GPU kernels (secp256k1, keccak256, orchestrator) + integration tests
**Code Quality**: Production-ready (benchmarked, tested, fallback-safe)
**Ready For**: Days 6-10 Atomic Swap Orchestrator integration

---

## DEPENDENCIES & ASSUMPTIONS

**Hardware**:
- 3x NVIDIA GPUs (or 1 GPU for development)
- CUDA 11.8+ toolkit
- 6GB VRAM minimum per GPU

**Libraries**:
- cuBLAS (matrix ops)
- libsecp256k1 (CPU reference)
- Ethereum JSON-RPC client (to fetch blocks)

**APIs**:
- Ethereum testnet RPC (public)
- Geth or Infura endpoint

---

## SUCCESS CRITERIA (Overall Phase)

✅ **Code**: 3 GPU kernels, 400+ LOC each, production-ready
✅ **Performance**: 600k sig/sec + 200k hash/sec = 75-100k EVM TPS
✅ **Testing**: 26+ tests covering all kernels and orchestrator
✅ **Documentation**: Operations guides + kernel tuning docs
✅ **Security**: No integer overflows, constant-time crypto ops
✅ **Fallback**: CPU-only mode guaranteed (500k atomic tx/sec)

---

## NEXT STEPS (After Day 5)

**Days 6-10**: Atomic Swap Orchestrator
- Coordinate Solana SVM + Ethereum EVM validators
- Guarantee atomic: both chains succeed or both rollback
- Single operator, dual validator, unified rewards

**Days 11-12**: Testnet Deployment (both chains live)

**Days 13-14**: Documentation + Security Audit + Release

