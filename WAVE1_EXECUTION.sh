#!/bin/bash
set -e

echo "🚀 RC-0 Wave 1: Dead File & Python GPU Cleanup"
echo "================================================"
echo "Timeline: ~15 minutes"
echo ""

# Counters
DELETED=0
FAILED=0

# Function to safely delete file
delete_file() {
    if [ -f "$1" ]; then
        echo "  ✓ Deleting $1"
        rm "$1"
        ((DELETED++))
    else
        echo "  ⚠ File not found: $1"
        ((FAILED++))
    fi
}

# Function to safely delete directory
delete_dir() {
    if [ -d "$1" ]; then
        echo "  ✓ Deleting directory $1"
        rm -rf "$1"
        ((DELETED++))
    else
        echo "  ⚠ Directory not found: $1"
        ((FAILED++))
    fi
}

echo "Step 1: Delete nohup.out files (log artifacts)"
delete_file "./nohup.out"
delete_file "./crates/gpu-swarm/src/cu_kernels/nohup.out"

echo ""
echo "Step 2: Delete lib.rs.new (build artifact duplicate)"
delete_file "./crates/x3-bridge-adapters/src/lib.rs.new"

echo ""
echo "Step 3: Delete Python GPU helper files (supply-chain hazard)"
delete_file "./crates/gpu-swarm/src/ed25519_gpu.py"
delete_file "./crates/gpu-swarm/src/sha256_gpu.py"
delete_file "./crates/gpu-swarm/src/solana_accelerators.py"
delete_file "./crates/gpu-swarm/src/solana_accelerators_gpu.py"
delete_file "./crates/gpu-swarm/src/jury_system.py"

echo ""
echo "================================================"
echo "Wave 1 Summary: $DELETED deleted, $FAILED failed"
echo ""

# Validation
echo "Step 4: Validate no references remain"
echo "  Checking for Python imports in Rust code..."
if grep -r "\.py\|import.*python" crates/ --include="*.rs" >/dev/null 2>&1; then
    echo "  ⚠ WARNING: Python references still found!"
    grep -r "\.py\|import.*python" crates/ --include="*.rs" | head -5
else
    echo "  ✓ No Python references found in Rust code"
fi

echo ""
echo "Step 5: Build verification"
echo "  Running: cargo check --workspace (this may take 2-3 min)"
cargo check --workspace --quiet
BUILD_RESULT=$?

echo ""
if [ $BUILD_RESULT -eq 0 ]; then
    echo "✅ Wave 1 PASSED: Workspace builds cleanly"
    echo ""
    echo "Next Steps:"
    echo "  1. Review git diff: git diff --name-status"
    echo "  2. Commit: git add -A && git commit -m 'RC-0 Wave 1: Delete dead files and Python GPU helpers'"
    echo "  3. Start Wave 2-4 in parallel"
else
    echo "❌ Wave 1 FAILED: Build errors detected"
    echo "  Restore with: git checkout HEAD -- ."
    exit 1
fi
