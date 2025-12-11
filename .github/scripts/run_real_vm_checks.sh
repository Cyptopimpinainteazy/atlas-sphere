#!/bin/sh
set -euo pipefail

echo "==> Running real-VM integration checks"

echo "-- Rust toolchain --"
rustc --version || true

echo "-- Add wasm target --"
rustup target add wasm32-unknown-unknown || true

echo "-- Cargo check (selected crates with std) --"
cargo check -p pallet-atlas-kernel -p evm-integration -p runtime --features std

echo "-- Build runtime WASM (no_std compatibility) --"
cd runtime
cargo build --release --target wasm32-unknown-unknown --no-default-features
cd -

echo "-- Run unit tests for key crates (std) --"
cargo test -p runtime --features std --no-fail-fast
cargo test -p pallet-atlas-kernel --features std --no-fail-fast
cargo test -p evm-integration --features std --no-fail-fast
cargo test -p svm-integration --features std --no-fail-fast || true
cargo test -p x3-integration --features std --no-fail-fast || true

echo "-- Optionally run full test script (may need additional packages) --"
if [ -f ./RUN_ALL_TESTS.sh ]; then
  ./RUN_ALL_TESTS.sh || true
fi

echo "==> Real-VM checks completed"
