# Wave 1 Verification & Integration Testing Plan

**Status:** IN PROGRESS  
**Date Started:** April 23, 2026  
**Estimated Duration:** 4-6 hours  
**Prerequisite:** Wave 0 COMPLETE ✅

---

## Wave 1 Overview

Wave 1 builds on Wave 0's frozen contracts and verified infrastructure. Primary goals:
1. **Compilation verification** - Ensure all code fixes compile successfully
2. **Unit test execution** - Validate critical crate logic
3. **Integration testing** - Verify service interactions
4. **Relayer integration** - Add deferred RelayerService spawn

---

## Phase 1A: Compilation Verification (60 min target)

### Current Status:
- Storage: 67GB free ✅
- Cargo clean completed ✅
- Wave 0 artifacts cleaned ✅

### Commands Executing:
```bash
cargo check --workspace --lib
# Started: 10:50 AM MDT
# Expected: ~45-60 minutes for full workspace
```

### Success Criteria:
- ✅ Command completes with exit code 0
- ✅ No `error[E]` messages
- ✅ Warnings acceptable (non-blocking)
- ✅ All 113 crates type-check successfully

### Possible Issues & Recovery:
- **Issue:** Disk fills again during build
  - Recovery: Kill cargo, run `cargo clean`, retry
- **Issue:** Compilation errors in Wave 0 code fixes
  - Recovery: Debug and fix, then retry
- **Issue:** Timeout (build takes >3 hours)
  - Recovery: Check process status, continue waiting

---

## Phase 1B: Unit Test Execution (30 min target)

### Trigger Condition:
- AFTER: Cargo check succeeds
- COMMAND: `cargo test --workspace --all-targets`

### Critical Crates to Monitor:
1. **x3-court** - Consensus replay logic
   - Expected: Tests pass (from prior session implementation)
2. **x3-gpu-validator-swarm** - GPU orchestration
   - Expected: Tests pass
3. **x3-bridge** - Bridge adapter logic
   - Expected: Tests pass
4. **x3-finality-oracle** - Finality computation
   - Expected: Tests pass

### Success Criteria:
- ✅ All tests pass (0 failures)
- ✅ Exit code: 0
- ✅ No panics in critical paths

### Next Step on Success:
→ Proceed to Phase 2 (Relayer Integration)

---

## Phase 2: Relayer Service Integration (30 min target)

### Goal:
Add deferred RelayerService spawning to node/src/service.rs

### Location:
`node/src/service.rs` around line 920 (after GPU Validator spawning)

### Code to Add:
```rust
// Around line 950, after GPU Validator Orchestrator spawn:
if feature_flags.enable_relayer {
    let relayer = match RelayerService::new(
        client.clone(),
        network_service.clone(),
        keystore_container.keystore(),
    ) {
        Ok(r) => {
            log::info!("🌉 RelayerService initialized");
            r
        }
        Err(e) => {
            log::error!("❌ Failed to initialize RelayerService: {}", e);
            return Err(ServiceError::Other(format!(
                "RelayerService initialization failed: {}",
                e
            )));
        }
    };

    task_manager.spawn_essential_handle().spawn(
        "x3-relayer",
        Some("relayer"),
        relayer.run(),
    );

    log::info!("🌉 RelayerService spawned and monitoring");
}
```

### Steps:
1. Verify `enable_relayer` feature flag exists in `NodeFeatureFlags`
2. Add import: `use x3_relayer::RelayerService;`
3. Add spawn logic above
4. Recompile: `cargo check --workspace --lib`
5. Verify no new errors

---

## Phase 3: Integration Testing (120 min target)

### Test 1: Flash Finality End-to-End
**Goal:** Verify Flash Finality gadget + voter work together
- [ ] Start node with `enable_flash_finality=true`
- [ ] Monitor logs for: "Flash Finality gadget, network bridge, and voter started"
- [ ] Check: 3 service tasks spawned
- [ ] Verify: Health monitoring active

### Test 2: GPU Validator End-to-End
**Goal:** Verify GPU Validator spawns with health checks
- [ ] Start node with `enable_gpu_validator=true`
- [ ] Monitor logs for: "GPU Validator Orchestrator spawned and monitoring"
- [ ] Check: Health check loop running (5-sec intervals)
- [ ] Verify: No panics in orchestrator

### Test 3: Cross-Chain Verification (if Relayer integrated)
**Goal:** Verify relayer + verification router integration
- [ ] Start relayer service
- [ ] Monitor: EVM header watcher active
- [ ] Monitor: SVM header watcher active
- [ ] Verify: No panics in watchers

### Test 4: Proof Submission Flow
**Goal:** Verify proof dispute API works
- [ ] Call: `submit_dispute(proof_hash, reason)`
- [ ] Verify: Returns `Option<DisputeRecord>`
- [ ] Verify: Dispute recorded in runtime state

### Test 5: Finality Query Flow
**Goal:** Verify settlement finality API works
- [ ] Call: `query_finality_metrics()`
- [ ] Verify: Returns `FinalityMetrics`
- [ ] Verify: Metrics reflect current state

---

## Phase 4: Mainnet Launch Readiness Scorecard (60 min target)

### Build Scorecard:

**Critical Path Components (Must Be Green):**
- [ ] Runtime APIs: All 4 implemented and tested
- [ ] Core Services: Flash Finality spawned and healthy
- [ ] GPU Validator: Spawned with health monitoring
- [ ] Compilation: Full workspace checks without errors
- [ ] Tests: All unit tests pass

**Important Components (Should Be Green):**
- [ ] Relayer: Integrated and spawned
- [ ] Settlement Finality: API working
- [ ] Cross-Chain Verification: API working
- [ ] Proof Disputes: API working
- [ ] Integration tests: Passing

**Optional Components (Can Be Yellow):**
- [ ] Bridge Security Council: Not critical for launch
- [ ] Governance: Deferred to Wave 2
- [ ] Advanced metrics: Deferred to Wave 2

### Output Format:
```
MAINNET LAUNCH READINESS SCORECARD
====================================
Date: April 23, 2026
Wave: 1 (Verification)

CRITICAL PATH:     🟢 GREEN (5/5)
  ├─ Runtime APIs        ✅
  ├─ Core Services       ✅
  ├─ GPU Validator       ✅
  ├─ Compilation         ✅
  └─ Unit Tests          ✅

IMPORTANT:         🟢 GREEN (5/5)
  ├─ Relayer             ✅
  ├─ Settlement          ✅
  ├─ Cross-Chain         ✅
  ├─ Disputes            ✅
  └─ Integration Tests   ✅

OPTIONAL:          🟡 YELLOW (2/3)
  ├─ Bridge Council      ⏳ Deferred
  ├─ Governance          ⏳ Deferred
  └─ Metrics             ⏳ Deferred

OVERALL: 🟢 GREEN - READY FOR MAINNET LAUNCH
```

---

## Wave 1 Completion Criteria

| Criterion | Status | Evidence |
|-----------|--------|----------|
| Workspace compiles | ⏳ IN PROGRESS | cargo check running |
| All tests pass | ⏳ PENDING | After: cargo check succeeds |
| Relayer integrated | ⏳ PENDING | After: tests pass |
| Integration tests pass | ⏳ PENDING | After: relayer added |
| Readiness scorecard | ⏳ PENDING | After: all tests pass |

---

## Risk Factors

### Low Risk:
- Compilation should succeed (Wave 0 code verified)
- Unit tests should pass (fixes implemented correctly)
- Relayer integration is straightforward

### Medium Risk:
- Integration tests may reveal service interaction issues
- Health monitoring may need tuning
- Storage may fill again during compilation (mitigation: monitor)

### High Risk:
- None identified

---

## Timeline

| Phase | Duration | Status |
|-------|----------|--------|
| 1A: Compilation | 60 min | ⏳ IN PROGRESS (started 10:50 AM) |
| 1B: Unit Tests | 30 min | ⏳ PENDING |
| Phase 2: Relayer | 30 min | ⏳ PENDING |
| Phase 3: Integration | 120 min | ⏳ PENDING |
| Phase 4: Scorecard | 60 min | ⏳ PENDING |

**Total Duration:** 300 min (5 hours)  
**Expected Completion:** ~3:50 PM MDT

---

## Exit Criteria for Wave 1 Success

✅ **PASS:** All 5 phases complete with green status
- Proceed to Wave 2 (Production Hardening)

🟡 **PARTIAL:** 3-4 phases complete, 1-2 issues
- Debug issues, retry, proceed to Wave 2

❌ **FAIL:** 2 or more phases fail
- Escalate, debug, retry full Wave 1

---

## Success Indicators (Real-Time)

Watch for these in logs:
```
✅ "Finished check [unoptimized] target(s)"
✅ "test result: ok"
✅ "🌉 RelayerService spawned and monitoring"
✅ "Flash Finality gadget, network bridge, and voter started"
✅ "GPU Validator Orchestrator spawned and monitoring"
```

---

**Next Action:** Monitor cargo check completion, then proceed through phases sequentially.

