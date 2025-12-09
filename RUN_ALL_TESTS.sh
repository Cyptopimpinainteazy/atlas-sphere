#!/bin/bash

echo "╔════════════════════════════════════════════════════════════════╗"
echo "║          ATLAS SPHERE - COMPLETE TEST SUITE RUN               ║"
echo "║                    November 7, 2025                           ║"
echo "╚════════════════════════════════════════════════════════════════╝"
echo ""

PASSED=0
FAILED=0

run_test() {
    local name=$1
    local cmd=$2
    
    echo "▶ Testing $name..."
    if output=$(eval "$cmd" 2>&1); then
        result=$(echo "$output" | grep "test result" | tail -1)
        if echo "$result" | grep -q "0 failed"; then
            echo "  ✅ PASSED - $result"
            ((PASSED++))
        else
            echo "  ❌ FAILED - $result"
            ((FAILED++))
        fi
    else
        echo "  ❌ BUILD FAILED"
        ((FAILED++))
    fi
    echo ""
}

# Run all tests
run_test "atlas-sphere-runtime" "cargo test -p atlas-sphere-runtime --release 2>&1"
run_test "pallet-atlas-kernel" "cargo test -p pallet-atlas-kernel --release 2>&1"
run_test "atlas-evm-integration" "cargo test -p atlas-evm-integration --release 2>&1"
run_test "atlas-svm-integration" "cargo test -p atlas-svm-integration --release 2>&1"
run_test "x3-parser" "cargo test -p x3-parser 2>&1"
run_test "x3-semantics" "cargo test -p x3-semantics 2>&1"
run_test "x3-typeck" "cargo test -p x3-typeck 2>&1"
run_test "x3-mir" "cargo test -p x3-mir 2>&1"
run_test "x3-opt" "cargo test -p x3-opt 2>&1"

echo "╔════════════════════════════════════════════════════════════════╗"
echo "║                     TEST SUITE RESULTS                        ║"
echo "╠════════════════════════════════════════════════════════════════╣"
echo "║                                                                ║"
echo "║  ✅ Passed: $PASSED                                               ║"
echo "║  ❌ Failed: $FAILED                                               ║"
echo "║                                                                ║"
if [ $FAILED -eq 0 ]; then
    echo "║  🎉 ALL TESTS PASSED!                                          ║"
else
    echo "║  ⚠️  Some tests failed                                          ║"
fi
echo "║                                                                ║"
echo "╚════════════════════════════════════════════════════════════════╝"
