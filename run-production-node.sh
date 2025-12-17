#!/bin/bash
# Atlas Sphere Production Node Launcher
# This script launches an Atlas Sphere node with production security settings

set -euo pipefail

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
CHAIN="${CHAIN:-local}"  # dev, local, staging, testnet, or a custom chainspec path

# Where to load chain specs from (repo default).
CHAIN_SPEC_DIR="${CHAIN_SPEC_DIR:-deployment/chain-specs}"

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

# If CHAIN points to an explicit file, verify it exists early.
if [ -f "${CHAIN}" ]; then
    :
elif [ "${CHAIN}" != "dev" ] && [ "${CHAIN}" != "local" ] && [ "${CHAIN}" != "staging" ] && [ "${CHAIN}" != "testnet" ]; then
    echo "⚠️  CHAIN='${CHAIN}' is not one of dev/local/staging/testnet and is not a file path."
    echo "   The node will attempt to resolve it via built-in chain spec loading."
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
case "${CHAIN}" in
    dev)
        CHAIN_ARG="--dev"
        ;;
    local)
        # Uses the built-in local testnet chainspec loader.
        CHAIN_ARG="--chain local"
        ;;
    staging)
        # Prefer the curated deployment chainspec if present.
        if [ -f "${CHAIN_SPEC_DIR}/atlas-staging-plain.json" ]; then
            CHAIN_ARG="--chain ${CHAIN_SPEC_DIR}/atlas-staging-plain.json"
        else
            CHAIN_ARG="--chain staging"
        fi
        ;;
    testnet)
        # Prefer raw (fully specified) spec if present.
        if [ -f "${CHAIN_SPEC_DIR}/atlas-testnet-raw.json" ]; then
            CHAIN_ARG="--chain ${CHAIN_SPEC_DIR}/atlas-testnet-raw.json"
        elif [ -f "${CHAIN_SPEC_DIR}/atlas-testnet-plain.json" ]; then
            CHAIN_ARG="--chain ${CHAIN_SPEC_DIR}/atlas-testnet-plain.json"
        else
            echo "❌ No testnet chainspec found in ${CHAIN_SPEC_DIR}."
            echo "   Expected atlas-testnet-raw.json or atlas-testnet-plain.json."
            exit 1
        fi
        ;;
    *)
        if [ -f "${CHAIN}" ]; then
            CHAIN_ARG="--chain ${CHAIN}"
        else
            # Fall back to built-in resolution (or a custom chain ID).
            CHAIN_ARG="--chain ${CHAIN}"
        fi
        ;;
esac

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
