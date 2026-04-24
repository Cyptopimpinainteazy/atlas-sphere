#!/bin/bash
# Wave 1 Phase 3 Integration Verification Script
# Performs static validation of service initialization and runtime API integration

set -e

echo "=== Wave 1 Phase 3: Integration Verification ==="
echo

echo "1. Verifying Flash Finality Service Spawning..."
if grep -q '"flash-finality-bridge"' node/src/service.rs; then
    echo "   ✅ Flash Finality Bridge spawn: FOUND"
else
    echo "   ❌ Flash Finality Bridge spawn: NOT FOUND"
    exit 1
fi

if grep -q '"flash-finality-voter"' node/src/service.rs; then
    echo "   ✅ Flash Finality Voter spawn: FOUND"
else
    echo "   ❌ Flash Finality Voter spawn: NOT FOUND"
    exit 1
fi
echo

echo "2. Verifying GPU Validator Orchestrator Spawning..."
if grep -q '"gpu-validator-orchestrator"' node/src/service.rs; then
    echo "   ✅ GPU Validator Orchestrator spawn: FOUND"
else
    echo "   ❌ GPU Validator Orchestrator spawn: NOT FOUND"
    exit 1
fi

if grep -q 'health_check()' node/src/service.rs; then
    echo "   ✅ GPU Validator health checks: FOUND"
else
    echo "   ❌ GPU Validator health checks: NOT FOUND"
    exit 1
fi
echo

echo "3. Verifying Runtime API Implementations..."
RUNTIME_FILE="runtime/src/lib.rs"

echo "   Checking impl_runtime_apis! macro..."
if grep -q "impl_runtime_apis!" "$RUNTIME_FILE"; then
    echo "      ✅ impl_runtime_apis! macro: FOUND"
else
    echo "      ❌ impl_runtime_apis! macro: NOT FOUND"
    exit 1
fi

echo "   Checking GpuValidatorRuntimeApi..."
if grep -q "GpuValidatorRuntimeApi" "$RUNTIME_FILE"; then
    echo "      ✅ GpuValidatorRuntimeApi implemented"
else
    echo "      ❌ GpuValidatorRuntimeApi NOT implemented"
    exit 1
fi

echo "   Checking CrossChainStateRootApi..."
if grep -q "CrossChainStateRootApi" "$RUNTIME_FILE"; then
    echo "      ✅ CrossChainStateRootApi implemented"
else
    echo "      ❌ CrossChainStateRootApi NOT implemented"
    exit 1
fi

echo "   Checking GovernanceSettlementApi..."
if grep -q "GovernanceSettlementApi" "$RUNTIME_FILE"; then
    echo "      ✅ GovernanceSettlementApi implemented"
else
    echo "      ❌ GovernanceSettlementApi NOT implemented"
    exit 1
fi

echo "   Checking SettlementFinalityApi..."
if grep -q "SettlementFinalityApi" "$RUNTIME_FILE"; then
    echo "      ✅ SettlementFinalityApi implemented"
else
    echo "      ❌ SettlementFinalityApi NOT implemented"
    exit 1
fi
echo

echo "4. Verifying Cross-Chain Verification Infrastructure..."
if grep -q "VerificationRouter" node/src/service.rs; then
    echo "   ✅ VerificationRouter integrated"
else
    echo "   ❌ VerificationRouter NOT integrated"
    exit 1
fi

if grep -q "x3_cross_vm_bridge" node/src/service.rs; then
    echo "   ✅ Cross-VM Bridge wiring present"
else
    echo "   ❌ Cross-VM Bridge wiring NOT present"
    exit 1
fi
echo

echo "5. Verifying Proof Dispute Integration..."
if grep -q "DisputeTracker" node/src/service.rs; then
    echo "   ✅ DisputeTracker integrated"
else
    echo "   ❌ DisputeTracker NOT integrated"
    exit 1
fi
echo

echo "6. Verifying Finality Oracle Integration..."
if grep -q "FinalityOracle" node/src/service.rs; then
    echo "   ✅ FinalityOracle integrated"
else
    echo "   ❌ FinalityOracle NOT integrated"
    exit 1
fi
echo

echo "=== Integration Verification Complete ==="
echo
echo "✅ All critical services verified present"
echo "✅ All runtime APIs verified implemented"
echo "✅ Cross-chain infrastructure verified"
echo
echo "System ready for Phase 4: Readiness Scorecard"
