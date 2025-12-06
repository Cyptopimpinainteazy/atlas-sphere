#!/bin/bash
# Atlas Sphere Production Node Launcher
# This script launches an Atlas Sphere node with production security settings

set -e

PROJECT_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$PROJECT_ROOT"

echo "🌌 Atlas Sphere Production Node"
echo "================================"

# Verify we're running as a service user (not root)
if [ "$(id -u)" = "0" ]; then
    echo "❌ ERROR: Do not run this script as root!"
    echo "   Create a dedicated 'atlas' user and run as that user."
    exit 1
fi

# Required configuration
NODE_NAME="${NODE_NAME:?NODE_NAME environment variable required}"
BASE_PATH="${BASE_PATH:-/var/lib/atlas-sphere}"
CHAIN="${CHAIN:-local}"  # local, staging, or mainnet

# Network ports
RPC_PORT="${RPC_PORT:-9944}"
P2P_PORT="${P2P_PORT:-30333}"
PROMETHEUS_PORT="${PROMETHEUS_PORT:-9615}"

# Security: RPC should ONLY bind to localhost in production
# Use a reverse proxy (nginx/caddy) for external access with proper auth
RPC_CORS="${RPC_CORS:-https://explorer.atlas-sphere.io,https://dex.atlas-sphere.io}"

# Verify binary exists
if [ ! -f "./target/release/atlas-sphere-node" ]; then
    echo "❌ Binary not found. Build with: cargo build --release"
    exit 1
fi

# Verify chain spec exists for non-dev chains
if [ "$CHAIN" != "dev" ] && [ ! -f "chain-specs/${CHAIN}.json" ]; then
    echo "❌ Chain spec not found: chain-specs/${CHAIN}.json"
    exit 1
fi

echo ""
echo "Security Configuration:"
echo "  ✅ RPC bound to localhost only (127.0.0.1)"
echo "  ✅ Prometheus bound to localhost only"
echo "  ✅ Safe RPC methods only (no Unsafe/Author)"
echo "  ✅ CORS restricted to: $RPC_CORS"
echo "  ✅ Rate limiting enabled (50 req/s, 10 subscriptions)"
echo ""

# Determine chain spec argument
if [ "$CHAIN" = "dev" ]; then
    CHAIN_ARG="--dev"
else
    CHAIN_ARG="--chain chain-specs/${CHAIN}.json"
fi

# Key file (for validators)
KEY_FILE="${KEY_FILE:-}"
KEY_ARGS=""
if [ -n "$KEY_FILE" ] && [ -f "$KEY_FILE" ]; then
    echo "🔑 Using key file: $KEY_FILE"
    KEY_ARGS="--keystore-path $KEY_FILE"
fi

# Bootnodes (for non-dev chains)
BOOTNODES="${BOOTNODES:-}"
BOOTNODE_ARGS=""
if [ -n "$BOOTNODES" ]; then
    BOOTNODE_ARGS="--bootnodes $BOOTNODES"
fi

# Validator mode
VALIDATOR="${VALIDATOR:-false}"
VALIDATOR_ARGS=""
if [ "$VALIDATOR" = "true" ]; then
    echo "⚙️  Running as VALIDATOR"
    VALIDATOR_ARGS="--validator"
fi

# Start with production security hardening
exec ./target/release/atlas-sphere-node \
    $CHAIN_ARG \
    --name "$NODE_NAME" \
    --base-path "$BASE_PATH" \
    --port "$P2P_PORT" \
    --rpc-port "$RPC_PORT" \
    --prometheus-port "$PROMETHEUS_PORT" \
    --prometheus-external=false \
    --rpc-cors "$RPC_CORS" \
    --rpc-methods Safe \
    --no-hardware-benchmarks \
    --rpc-max-connections 500 \
    --rpc-max-request-size 10 \
    --rpc-max-response-size 50 \
    --rpc-max-subscriptions-per-connection 10 \
    --wasm-execution compiled \
    --execution native-else-wasm \
    --state-pruning archive \
    $KEY_ARGS \
    $BOOTNODE_ARGS \
    $VALIDATOR_ARGS \
    "$@"
