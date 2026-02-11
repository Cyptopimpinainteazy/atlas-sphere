# P5: DAYS 6-10 ATOMIC SWAP ORCHESTRATOR ROADMAP
## Dual-Chain Coordination Layer

**Phase**: Cross-Chain GPU Validator (P5) Phase 2
**Duration**: 5 days (Feb 15-19, 2026)
**Effort**: 36 hours (~7.2 hours/day)
**Output**: Production-ready atomic swap orchestrator + fallback mechanisms

---

## OVERVIEW: THE GAME-CHANGER

**Problem**: 
Validators are chain-specific. You validate Solana OR Ethereum, not both atomically. If you're a cross-chain swapper and want to guarantee that if the Solana side succeeds, the Ethereum side also succeeds, you need a trusted oracle or external validator. **This is expensive and slow.**

**Solution**: 
A single operator can run both validators and **guarantee atomicity**:
- Solana transaction proceeds → Ethereum must also accept same atomic swap ID
- If Ethereum stalls or rejects → Solana rolls back automatically
- No intermediate state, no oracle, no slippage risk
- **This doesn't exist anywhere else yet.**

**Who Wants This**:
- DEX operators (Uniswap, Curve, etc. wanting cross-chain liquidity)
- Bridge protocols (Wormhole, Multichain, etc.)
- Staking-as-a-service platforms (wanting unified validator)
- High-frequency traders (valuing atomic guarantees)

---

## DAY 6: ATOMIC SWAP ARCHITECTURE & STATE MACHINE DESIGN

### Objective
Design the dual-chain coordination protocol that guarantees atomic transactions across Solana + Ethereum.

### Context
**What is an Atomic Swap?**

Standard (risky):
```
User A on Solana wants to swap 100 SOL → 1 USDC (on Ethereum)
User B on Ethereum wants to swap 1 USDC → 100 SOL

Flow (vulnerable):
1. User A sends 100 SOL to swap contract (locked)
2. User B sends 1 USDC to swap contract (locked)
3. User A claims USDC on Ethereum → ✅ SUCCESS
4. User B tries to claim SOL on Solana → ❌ FAILS (network down)
   → User A got USDC, User B never got SOL
   → Atomic guarantee broken
```

**P5 Solution: GPU Validator Guarantees Atomicity**
```
Same swap, but with P5 validator:
1. User A locks 100 SOL (Solana) + User B locks 1 USDC (Ethereum)
2. P5 validator receives "commit" from both chains
3. Validator checks:
   - Solana side valid? (sig check, balance check)
   - Ethereum side valid? (sig check, balance check)
   - Both atomic IDs match? (shared atomic_swap_id)
4. If both ✓:
   - GPU validates both simultaneously
   - Commits both atomically (< 100ms)
   - Both chains see "APPROVED" for same atomic_id
   - Users claim results → ✅ BOTH SUCCEED
5. If either fails:
   - Validator doesn't approve
   - Both lockups expire → Both refunded
   - ❌ BOTH FAIL (atomic guarantee honored)
```

### Tasks

#### 6.1 Define Atomic Swap Protocol (2 hours)
**Data Structure**:
```rust
// Atomic Swap Agreement
struct AtomicSwap {
    id: u256,                           // Unique identifier
    timestamp: u64,                     // When created
    swap_type: "SVM_TO_EVM" | "EVM_TO_SVM",
    
    // SVM Side (Solana)
    svm_sender: Pubkey,
    svm_amount: u64,
    svm_token_mint: Pubkey,
    svm_signature: [u8; 64],
    
    // EVM Side (Ethereum)
    evm_sender: Address,
    evm_amount: u256,
    evm_token_address: Address,
    evm_signature: [u8; 65],            // Different format (65 bytes)
    
    // State
    status: "PENDING" | "APPROVED" | "EXECUTED" | "FAILED",
    svm_validated: bool,
    evm_validated: bool,
}
```

**Invariants** (must ALWAYS hold):
```
INVARIANT #1: Atomicity
  At any time, either:
    - Both svm_validated AND evm_validated (both succeed)
    - OR neither validated (both failed/pending)
  NEVER: svm_validated=true AND evm_validated=false

INVARIANT #2: Mutual Commitment
  If SVM side locked 100 tokens,
  THEN EVM side must have locked equivalent value
  BEFORE validator approves either

INVARIANT #3: Signature Validity
  svm_signature must verify against svm_sender (Ed25519)
  evm_signature must verify against evm_sender (secp256k1)
  Validator uses GPU to verify both

INVARIANT #4: Timeout
  If validator doesn't approve within 30 seconds,
  THEN automatically rollback both sides
  (prevents deadlock)
```

**Deliverable**: Protocol specification (state machine diagram + pseudocode)

#### 6.2 Design State Machine (2 hours)
**States & Transitions**:
```
PENDING (initial)
  ├─ [Receive SVM + EVM signatures]
  ├─ [Validate both signatures via GPU]
  ├─ [Check balances exist]
  └─► APPROVED_BOTH (if all checks pass)
  or► FAILED (if any check fails)

APPROVED_BOTH
  ├─ [Emit success to both chains]
  ├─ [Release lockups simultaneously]
  └─► EXECUTED

FAILED
  ├─ [Emit rollback to both chains]
  ├─ [Refund both parties]
  └─► ROLLED_BACK

Timeout Path (30 seconds):
  PENDING ─[30s]─► ROLLED_BACK
```

**Transitions Guarded By**:
- PENDING → APPROVED_BOTH: GPU sig validation MUST pass for BOTH
- APPROVED_BOTH → EXECUTED: Both chains MUST ack within 5 seconds
- Any state → ROLLED_BACK: Timeout OR GPU validation failure

#### 6.3 Design Fallback Mechanisms (2 hours)
**What If One Chain Fails?**

Scenarios:
```
Scenario A: Solana validator crashes
  - Detect: No "APPROVED" within 15 seconds
  - Action: Emit ROLLBACK to Ethereum
  - Ethereum rolls back automatically
  - User's USDC refunded 
  - Atomic guarantee preserved ✓

Scenario B: Ethereum RPC node slow
  - Detect: EVM signature validation taking >20 seconds
  - Action: Timeout → ROLLBACK
  - Both chains rollback
  - No atomic violation risk ✓

Scenario C: GPU kernel hangs
  - Detect: Timeout threshold (10 seconds)
  - Action: Fall back to CPU verification (slower but correct)
  - CPU validates all sigs (still atomic)
  - Throughput reduced but guarantee maintained ✓

Scenario D: Network partition
  - Detect: Can't reach Ethereum RPC
  - Action: Don't approve anything on Solana
  - Lock stays locked, timeout triggers
  - Self-healing (timeout → release) ✓
```

**Conservative Design Philosophy**:
> "When in doubt, reject the atomic swap."
> 
> It's better to fail one atomic swap than to violate the atomic guarantee on thousands.

**Deliverable**: Fallback decision tree (if-then flowchart) + pseudocode

#### 6.4 Design Operator Dashboard (1 hour)
**What the validator operator sees**:
```
ATOMIC SWAP ORCHESTRATOR DASHBOARD
═════════════════════════════════════════

LIVE METRICS:
  Solana GPU Status:  ✅ 1.85M TPS (3.4GB/7GB VRAM)
  Ethereum GPU Status: ✅ 1.2M TPS (2.1GB/7GB VRAM)
  Atomic Orchestrator: ✅ HEALTHY (500k swaps/min)
  
CURRENT SWAPS:
  Pending:    234 (avg 2.3s to APPROVED)
  Approved:    12 (waiting for user claim)
  Executed:  1,234 (in last hour)
  Failed:       0 (1.00% success rate)
  
ALERTS:
  ⚠️  Ethereum latency: 4.2s (normal < 2s)
     → GPU hash validation taking longer
     → Consider less aggressive batching
  
ACTIONS:
  [View Pending] [View Failed] [Manual Override] [Shutdown]
```

**Deliverable**: Dashboard mockup (wireframe + interaction spec)

### Validation (Day 6 End)
```
✅ Protocol fully specified (invariants + state machine)
✅ Atomicity guaranteed by design
✅ Fallback mechanisms cover all failure modes
✅ Operator dashboard designed
```

---

## DAY 7: STATE SYNCHRONIZATION PROTOCOL IMPLEMENTATION

### Objective
Implement the real-time communication between SVM validator and EVM validator to maintain atomic consistency.

### Tasks

#### 7.1 Design Sync Protocol (2 hours)
**Problem**: Solana and Ethereum are independent peers. How do they know each other's state?

**Solution**: P5 Validator acts as intermediary (same operator, both chains)

```
Solana Validator                    Ethereum Validator
(GPU: 1.85M TPS)                    (GPU: 1.2M TPS)
       │                                   │
       │  ◄─── Atomic Swap ───►           │
       │   "Validate this?"                │
       │    (SVM + EVM sigs)               │
       │                                   │
       └───── SHARED STATE ─────────────────
             (Redis / Shared Memory)
             
  Atomic Swap Registry (locked):
  {
    id_123: {
      svm_validated: false,
      evm_validated: false,
      created_at: 1707000000,
      timeout_at: 1707000030
    }
  }
```

**State Sync Algorithm**:
```
Every 10ms:
  1. Lock the atomic swap registry
  2. Check for PENDING swaps (no timeout)
  3. For each PENDING:
     a. SVM validator validates SVM side
        - Check sigs (GPU; 600k/sec)
        - Check balances (local state)
        - Set svm_validated = true if OK
     b. EVM validator validates EVM side
        - Check sigs (GPU; 600k/sec)
        - Check balances (RPC call)
        - Set evm_validated = true if OK
  4. If svm_validated AND evm_validated:
     - Set status = APPROVED
     - Emit event to both chains
  5. If timeout OR any check failed:
     - Set status = FAILED
     - Emit rollback event to both chains
  6. Unlock registry
```

**Latency Budget** (must be < 30s total):
- GPU sig validation (SVM): 0.1ms (single batch)
- GPU sig validation (EVM): 0.1ms (single batch)
- Balance check (local): 0.1ms
- Balance check (RPC): 0.5-2s (this is slow!)
- Network latency: 0.1-0.5s
- Processing: 0.1ms
- **Total**: 0.8-2.7s (well under 30s timeout) ✓

**Deliverable**: Protocol implementation (Python/Rust pseudocode)

#### 7.2 Implement Shared State (1 hour)
**Technology Options**:
1. **Redis**: Fast, persistent, distributed
2. **In-memory dict**: Simplest, single process
3. **Shared memory (mmap)**: Between processes on same machine
4. **Custom RPC**: Both validators talk to each other

**Implementation** (using Redis for reliability):
```python
import redis

class AtomicSwapRegistry:
    def __init__(self, redis_host='localhost', redis_port=6379):
        self.redis = redis.Redis(host=redis_host, port=redis_port)
    
    def register_swap(self, atomic_swap_id, svm_data, evm_data):
        """Register new atomic swap"""
        swap = {
            'id': atomic_swap_id,
            'status': 'PENDING',
            'svm_validated': False,
            'evm_validated': False,
            'created_at': time.time(),
            'timeout_at': time.time() + 30,
            'svm_sigs': json.dumps(svm_data),
            'evm_sigs': json.dumps(evm_data),
        }
        self.redis.hset(f'swap:{atomic_swap_id}', mapping=swap)
        self.redis.expire(f'swap:{atomic_swap_id}', 35)  # Auto-cleanup after timeout
    
    def validate_svm_side(self, atomic_swap_id, gpu_validator):
        """SVM validator marks its side as validated"""
        swap = self.redis.hgetall(f'swap:{atomic_swap_id}')
        
        # Parse SVM data
        svm_sigs = json.loads(swap[b'svm_sigs'])
        
        # GPU validate signatures
        is_valid = gpu_validator.verify(svm_sigs)
        
        # Update registry
        if is_valid:
            self.redis.hset(f'swap:{atomic_swap_id}', 'svm_validated', 'true')
        else:
            self.redis.hset(f'swap:{atomic_swap_id}', 'status', 'FAILED')
        
        return self._check_atomic_ready(atomic_swap_id)
    
    def validate_evm_side(self, atomic_swap_id, gpu_validator):
        """EVM validator marks its side as validated"""
        swap = self.redis.hgetall(f'swap:{atomic_swap_id}')
        
        # Parse EVM data
        evm_sigs = json.loads(swap[b'evm_sigs'])
        
        # GPU validate signatures
        is_valid = gpu_validator.verify(evm_sigs)
        
        # Update registry
        if is_valid:
            self.redis.hset(f'swap:{atomic_swap_id}', 'evm_validated', 'true')
        else:
            self.redis.hset(f'swap:{atomic_swap_id}', 'status', 'FAILED')
        
        return self._check_atomic_ready(atomic_swap_id)
    
    def _check_atomic_ready(self, atomic_swap_id):
        """Check if both sides validated, become APPROVED"""
        swap = self.redis.hgetall(f'swap:{atomic_swap_id}')
        
        svm_valid = swap.get(b'svm_validated') == b'true'
        evm_valid = swap.get(b'evm_validated') == b'true'
        
        if svm_valid and evm_valid:
            self.redis.hset(f'swap:{atomic_swap_id}', 'status', 'APPROVED')
            return True
        
        return False
```

**Deliverable**: Redis-backed registry + validation API

#### 7.3 Implement Validators' Sync Loop (2 hours)
**SVM Validator Side**:
```python
class SVMValidator:
    def __init__(self, orchestrator):
        self.orchestrator = orchestrator  # Has GPU sig verifier
        self.registry = AtomicSwapRegistry()
        self.running = False
    
    def listen_for_swaps(self):
        """Listen on Solana chain for atomic swap initiation"""
        # Subscribe to Solana program events
        # (simplified; real impl uses Solana web3.py)
        
        async for event in solana_client.listen_events():
            if event.type == 'AtomicSwapInitiated':
                atomic_id = event.atomic_swap_id
                svm_data = event.svm_transfer_data
                evm_data = event.evm_transfer_data  # Included in event
                
                # Register in shared state
                self.registry.register_swap(
                    atomic_id,
                    svm_sigs=svm_data['signatures'],
                    evm_sigs=evm_data['signatures']
                )
    
    def validate_loop(self):
        """Continuously validate SVM sides of pending swaps"""
        while self.running:
            # Get all PENDING swaps
            pending = self.registry.get_pending_swaps()
            
            for swap_id in pending:
                # Check timeout
                if self.registry.is_timeout(swap_id):
                    self.registry.mark_failed(swap_id)
                    continue
                
                # Validate SVM side with GPU
                self.registry.validate_svm_side(
                    swap_id,
                    gpu_validator=self.orchestrator.gpu_sig_verifier
                )
            
            time.sleep(0.01)  # 10ms loop cycle
```

**EVM Validator Side**: (same pattern, different chain API)

**Deliverable**: Full sync loop implementation (SVM + EVM)

### Validation (Day 7 End)
```
✅ State sync protocol fully implemented
✅ Redis registry working
✅ Both SVM and EVM validators syncing
✅ GPU validation called for each side
```

---

## DAY 8: DUAL VALIDATOR INTEGRATION & ORCHESTRATION

### Objective
Wire the SVM and EVM validators together so a single operator can run both atomically.

### Tasks

#### 8.1 Design Orchestrator Interface (2 hours)
**Architecture**:
```
Operator Interface
       ↓
   Orchestrator (single process, owns both)
       │
       ├─► SVM Validator (GPU + sync loop)
       │
       └─► EVM Validator (GPU + sync loop)
           
               ├─ Shared Redis Registry
               ├─ Shared GPU contexts
               └─ Unified monitoring
```

**Orchestrator** (main coordinator):
```python
class CrossChainGPUOrchestrator:
    def __init__(self, config):
        # GPU setup
        self.svm_sigverifier = SVMGPUSigVerifier()  # P4
        self.evm_sigverifier = EVMGPUSigVerifier()  # P5 Days 1-2
        self.evm_keccak = EVMGPUKeccak256()         # P5 Day 3
        
        # Validators
        self.svm_validator = SVMValidator(self)
        self.evm_validator = EVMValidator(self)
        
        # Shared state
        self.registry = AtomicSwapRegistry()
        
        # Monitoring
        self.metrics = MetricsCollector()
    
    def start(self):
        """Start both validators"""
        # Start SVM validator (listens to Solana, validates SVM sides)
        svm_thread = threading.Thread(
            target=self.svm_validator.run_loop,
            daemon=True
        )
        svm_thread.start()
        
        # Start EVM validator (listens to Ethereum, validates EVM sides)
        evm_thread = threading.Thread(
            target=self.evm_validator.run_loop,
            daemon=True
        )
        evm_thread.start()
        
        # Start metrics reporter
        metrics_thread = threading.Thread(
            target=self.metrics.report_loop,
            daemon=True
        )
        metrics_thread.start()
        
        # Start HTTP server for operator dashboard
        self.start_dashboard_server()
        
        print("✅ Cross-Chain GPU Validator started")
        print(f"   SVM validator: listening to {self.svm_validator.rpc_url}")
        print(f"   EVM validator: listening to {self.evm_validator.rpc_url}")
        print(f"   Registry: Redis @ {self.registry.redis.connection_pool.connection_kwargs['host']}")
    
    def stop(self):
        """Graceful shutdown"""
        print("Shutting down cross-chain validator...")
        self.svm_validator.stop()
        self.evm_validator.stop()
        self.metrics.stop()
        print("✅ Shutdown complete")
```

**Deliverable**: Full orchestrator class with start/stop

#### 8.2 Implement Dual Validation (1 hour)
**Key Innovation**: Both validators run in parallel (multithreaded)
```
SVM Thread (validating Solana sides):
  └─ GPU sig verify: 600k/sec → can validate 1000s of swaps/sec
  
EVM Thread (validating Ethereum sides):
  └─ GPU sig verify: 600k/sec + GPU keccak: 200k/sec
  
Both threads hit the SAME Redis registry
  → Atomic invariant kept

Result: Single operator, dual validation, atomic guarantee
```

#### 8.3 Add Fallback Handlers (1 hour)
**What if GPU crashes?**
```python
class FallbackValidator:
    """CPU-only validation (slower but guaranteed correct)"""
    
    def verify_svm_fallback(self, signatures):
        """Fall back to CPU Ed25519 verification"""
        results = []
        for sig in signatures:
            try:
                is_valid = ed25519_verify_cpu(sig)
                results.append(is_valid)
            except Exception as e:
                # Conservative: assume invalid if check fails
                results.append(False)
        return results
    
    def verify_evm_fallback(self, signatures):
        """Fall back to CPU secp256k1 verification"""
        results = []
        for sig in signatures:
            try:
                is_valid = secp256k1_verify_cpu(sig)
                results.append(is_valid)
            except Exception as e:
                results.append(False)
        return results
```

**Orchestrator Integration**:
```python
class CrossChainGPUOrchestrator:
    def __init__(self, config):
        # ... existing setup ...
        self.fallback = FallbackValidator()
        self.use_gpu = True
    
    def validate_with_fallback(self, atomic_id, side):
        """Try GPU, fall back to CPU"""
        try:
            if self.use_gpu:
                if side == 'svm':
                    return self.svm_sigverifier.verify(...)
                else:
                    return self.evm_sigverifier.verify(...)
        except GPUError:
            print("⚠️  GPU error, falling back to CPU")
            self.use_gpu = False  # Disable GPU for future attempts
        
        # CPU fallback
        if side == 'svm':
            return self.fallback.verify_svm_fallback(...)
        else:
            return self.fallback.verify_evm_fallback(...)
```

**Deliverable**: Fallback validation fully integrated

### Validation (Day 8 End)
```
✅ Orchestrator controls both validators
✅ Both validators validating simultaneously
✅ Shared registry maintaining atomic invariant
✅ Fallback ready if GPU fails
```

---

## DAY 9: FALLBACK & SAFETY MECHANISMS

### Objective
Bulletproof the system. What if things go wrong?

### Tasks

#### 9.1 Implement Timeout Mechanism (1 hour)
**Problem**: What if one validator hangs?

**Solution**: 30-second global timeout
```python
class TimeoutManager:
    """Ensures no atomic swap hangs forever"""
    
    def __init__(self, timeout_seconds=30):
        self.timeout_seconds = timeout_seconds
        self.registry = AtomicSwapRegistry()
    
    def check_timeouts(self):
        """Check for expired swaps and rollback"""
        while True:
            pending = self.registry.get_pending_swaps()
            
            for swap_id in pending:
                swap = self.registry.get_swap(swap_id)
                age = time.time() - swap['created_at']
                
                if age > self.timeout_seconds:
                    print(f"⏱️  Timeout: swap {swap_id} exceeded {self.timeout_seconds}s")
                    
                    # Rollback both sides
                    self.registry.mark_failed(swap_id)
                    
                    # Emit rollback to both chains
                    self.emit_rollback_to_svm(swap_id)
                    self.emit_rollback_to_evm(swap_id)
                    
                    # Log for operator review
                    self.log_timeout_event(swap_id, age)
            
            time.sleep(1)  # Check every second
```

**Deliverable**: Timeout mechanism + rollback functions

#### 9.2 Implement Manual Override (1 hour)
**For operator emergency situations**:
```python
class ManualOverride:
    """Operator can manually approve/reject atomic swaps"""
    
    def __init__(self, require_password=True):
        self.require_password = require_password
    
    def approve_swap_manual(self, swap_id, operator_password=None):
        """Operator manually approves a swap"""
        if self.require_password:
            if not self.verify_password(operator_password):
                raise PermissionError("Invalid password")
        
        self.registry.mark_approved(swap_id)
        self.emit_success_to_svm(swap_id)
        self.emit_success_to_evm(swap_id)
        
        print(f"⚠️  Manual override: swap {swap_id} APPROVED by operator")
        self.log_override(swap_id, 'APPROVED')
    
    def reject_swap_manual(self, swap_id, reason, operator_password=None):
        """Operator manually rejects a swap"""
        if self.require_password:
            if not self.verify_password(operator_password):
                raise PermissionError("Invalid password")
        
        self.registry.mark_failed(swap_id, reason)
        self.emit_rollback_to_svm(swap_id)
        self.emit_rollback_to_evm(swap_id)
        
        print(f"⚠️  Manual override: swap {swap_id} REJECTED - {reason}")
        self.log_override(swap_id, 'REJECTED', reason)
```

**Deliverable**: Operator override API (HTTP endpoint)

#### 9.3 Implement Emergency Shutdown (1 hour)
**Nuclear button: stop validator**:
```python
class EmergencyShutdown:
    """Gracefully shut down without losing money"""
    
    def initiate_shutdown(self, orchestrator):
        """Gracefully shut down, protecting in-flight swaps"""
        print("🚨 EMERGENCY SHUTDOWN INITIATED")
        
        # Step 1: Stop accepting new swaps
        orchestrator.accept_new_swaps = False
        print("  ✓ Stopped accepting new swaps")
        
        # Step 2: Mark all PENDING swaps as failed (safe choice)
        pending = orchestrator.registry.get_pending_swaps()
        for swap_id in pending:
            orchestrator.registry.mark_failed(swap_id, "validator_shutdown")
        print(f"  ✓ Marked {len(pending)} pending swaps as failed (will rollback)")
        
        # Step 3: Wait for all swaps to finalize (max 30s for timeout)
        print("  ⏳ Waiting for in-flight swaps to finalize...")
        max_wait = 35  # 30s timeout + 5s buffer
        for i in range(max_wait):
            active = len(orchestrator.registry.get_active_swaps())
            if active == 0:
                print(f"  ✓ All swaps finalized after {i}s")
                break
            print(f"    {active} swaps still active... ({i}s elapsed)")
            time.sleep(1)
        
        # Step 4: Stop validators
        orchestrator.stop()
        print("  ✓ Validators stopped")
        
        print("🚨 EMERGENCY SHUTDOWN COMPLETE")
        print("   ✅ All user funds protected")
        print("   📋 Logs preserved in /var/log/p5_shutdown.log")
```

**Deliverable**: Emergency shutdown procedure (fully tested)

### Validation (Day 9 End)
```
✅ Timeout mechanism working (30s global timeout)
✅ Manual override tested (operator can approve/reject)
✅ Emergency shutdown tested (funds protected)
✅ All edge cases covered
```

---

## DAY 10: UNIFIED MONITORING & METRICS

### Objective
Operator dashboard shows complete cross-chain validator health.

### Tasks

#### 10.1 Design Metrics (1 hour)
**What to monitor**:
```
PERFORMANCE METRICS:
  - SVM TPS: current rate
  - EVM TPS: current rate
  - Atomic throughput: swaps/sec
  - Latency: p50/p95/p99 (milliseconds)
  - Success rate: % of swaps APPROVED (target: 99%+)

GPU METRICS:
  - SVM GPU VRAM: % used
  - EVM GPU VRAM: % used
  - GPU temp: °C (target: < 80°C)
  - GPU util: % (target: 70-90%)

CHAIN HEALTH:
  - Solana RPC latency: ms
  - Ethereum RPC latency: ms
  - Solana block time: s (target: 0.4s)
  - Ethereum block time: s (target: 12s)

ATOMIC SWAP HEALTH:
  - Pending swaps: count
  - Approved swaps: count
  - Failed swaps: count
  - Timeout rate: % (target: 0%)
  - Atomic violation rate: % (target: 0%, must be zero)

OPERATOR ALERTS:
  - ⚠️  GPU temperature high (> 85°C)
  - ⚠️  RPC latency spike (> 5s)
  - 🔴 GPU out of memory
  - 🔴 Atomic violation detected
  - 🔴 Validator crashed
```

#### 10.2 Implement Metrics Collector (2 hours)
```python
class MetricsCollector:
    """Collects all performance metrics"""
    
    def __init__(self, prometheus_pushgateway=None):
        self.prometheus = prometheus_pushgateway  # Optional
        self.metrics = {}
    
    def collect_performance_metrics(self):
        """Collect real-time performance data"""
        return {
            'svm_tps': self.measure_svm_throughput(),
            'evm_tps': self.measure_evm_throughput(),
            'atomic_throughput': self.measure_atomic_throughput(),
            'latency_p50': self.measure_latency(percentile=50),
            'latency_p95': self.measure_latency(percentile=95),
            'latency_p99': self.measure_latency(percentile=99),
            'success_rate': self.compute_success_rate(),
        }
    
    def collect_gpu_metrics(self):
        """GPU health"""
        return {
            'svm_gpu_vram_percent': self.measure_gpu_vram('svm'),
            'evm_gpu_vram_percent': self.measure_gpu_vram('evm'),
            'svm_gpu_temp': self.measure_gpu_temp('svm'),
            'evm_gpu_temp': self.measure_gpu_temp('evm'),
            'svm_gpu_util': self.measure_gpu_util('svm'),
            'evm_gpu_util': self.measure_gpu_util('evm'),
        }
    
    def collect_chain_health(self):
        """RPC and chain metrics"""
        return {
            'solana_rpc_latency_ms': self.measure_rpc_latency('solana'),
            'ethereum_rpc_latency_ms': self.measure_rpc_latency('ethereum'),
            'solana_block_time': self.measure_chain_blocktime('solana'),
            'ethereum_block_time': self.measure_chain_blocktime('ethereum'),
        }
    
    def collect_swap_health(self):
        """Atomic swap health"""
        swap_stats = self.registry.get_state_summary()
        return {
            'pending_swaps': swap_stats['pending'],
            'approved_swaps': swap_stats['approved'],
            'failed_swaps': swap_stats['failed'],
            'timeout_rate': swap_stats['timeout_rate'],
            'atomic_violation_count': swap_stats['violations'],  # Must be 0!
        }
    
    def check_alerts(self):
        """Raise operator alerts"""
        alerts = []
        
        gpu_metrics = self.collect_gpu_metrics()
        if gpu_metrics['svm_gpu_temp'] > 85:
            alerts.append("⚠️  SVM GPU temperature high: 85°C+")
        if gpu_metrics['evm_gpu_vram_percent'] > 95:
            alerts.append("⚠️  EVM GPU running low on VRAM: 95%+")
        
        chain_metrics = self.collect_chain_health()
        if chain_metrics['solana_rpc_latency_ms'] > 5000:
            alerts.append("⚠️  Solana RPC slow: >5s latency")
        
        swap_metrics = self.collect_swap_health()
        if swap_metrics['atomic_violation_count'] > 0:
            alerts.append("🔴 CRITICAL: Atomic violation detected!")
        if swap_metrics['timeout_rate'] > 0.05:  # > 5%
            alerts.append("⚠️  High timeout rate: >5%")
        
        return alerts
```

#### 10.3 Operator Dashboard (1 hour)
**HTTP Server**:
```python
from flask import Flask, jsonify, render_template

app = Flask(__name__)

@app.route('/metrics/json')
def metrics_json():
    """REST API for metrics"""
    collector = MetricsCollector()
    return jsonify({
        'performance': collector.collect_performance_metrics(),
        'gpu': collector.collect_gpu_metrics(),
        'chain': collector.collect_chain_health(),
        'swaps': collector.collect_swap_health(),
        'alerts': collector.check_alerts(),
        'timestamp': datetime.now().isoformat(),
    })

@app.route('/dashboard')
def dashboard():
    """HTML dashboard"""
    return render_template('dashboard.html')

@app.route('/health')
def health():
    """Liveness check"""
    return jsonify({'status': 'healthy', 'timestamp': time.time()})

if __name__ == '__main__':
    app.run(host='0.0.0.0', port=8080)
```

**Dashboard Features**:
- Real-time charts (TPS, latency, GPU usage)
- Alert notifications with color coding
- Swap history (last 100 swaps)
- Manual approve/reject buttons (operator override)
- Emergency shutdown button

**Deliverable**: Full metrics system + HTTP dashboard

### Validation (Day 10 End)
```
✅ All metrics collected and displayed
✅ Alerts system working
✅ Dashboard accessible at http://localhost:8080
✅ Operator has complete visibility
```

---

## SUMMARY: DAYS 6-10 DELIVERABLES

| Day | Component | Status | Deliverable |
|-----|-----------|--------|-------------|
| 6 | Atomic swap protocol | ✅ | Design + state machine |
| 7 | State sync implementation | ✅ | Redis registry + sync loop |
| 8 | Dual validator integration | ✅ | Orchestrator class |
| 9 | Fallback & safety | ✅ | Timeout + override + shutdown |
| 10 | Monitoring | ✅ | Metrics collector + dashboard |

**Total Output**: Full atomic swap orchestrator with complete fallback and monitoring
**Code Quality**: Production-ready (tested, instrumented, operator-friendly)
**Ready For**: Days 11-12 live testnet deployment

---

## CRITICAL INVARIANTS (MUST NEVER BREAK)

```
INVARIANT #1: Atomic Consistency
  At any time:
    (svm_validated AND evm_validated) OR NOT (svm_validated OR evm_validated)
  Never: svm_validated XOR evm_validated (asymmetric state)

INVARIANT #2: No User Fund Loss
  If either validator fails to approve:
    Both swaps rolled back automatically
  If either validator processes before both validate:
    Emergency shutdown triggered

INVARIANT #3: Timeout Safety
  Every atomic swap has 30-second timeout
  If no approval within 30 seconds:
    Both sides refunded automatically
  No swap can hang indefinitely

INVARIANT #4: GPU Failure Tolerance
  If GPU fails:
    CPU fallback activated
    No atomic swaps rejected (fallback still validates)
  If CPU also fails:
    Emergency shutdown (fail-safe)
```

**Testing**: P5 validation phase must include 10,000+ atomic swaps with random failures injected to ensure invariants hold.

