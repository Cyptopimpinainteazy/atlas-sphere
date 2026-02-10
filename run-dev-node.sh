#!/bin/bash
# Atlas Sphere Development Node Launcher
# This script launches a local Atlas Sphere blockchain node in development mode

set -e

PROJECT_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$PROJECT_ROOT"

echo "🌌 Atlas Sphere Development Node Launcher"
echo "==========================================="
echo ""

# Check if the binary is built
if [ ! -f "target/release/atlas-sphere-node" ]; then
    echo "⚠️  Binary not found. Building with: cargo build --release"
    cargo build --release
fi

# Default configuration
BASE_PATH="${BASE_PATH:-/tmp/atlas-dev}"
RPC_PORT="${RPC_PORT:-9944}"
WS_PORT="${WS_PORT:-9945}"
P2P_PORT="${P2P_PORT:-30333}"
PROMETHEUS_PORT="${PROMETHEUS_PORT:-9615}"

# Security: Determine RPC binding based on environment
# Production: bind only to localhost
# Development: can optionally bind externally with --unsafe-rpc-external
RPC_EXTERNAL=""
CORS_ORIGINS="http://localhost:3000,http://127.0.0.1:3000"

if [ "$ATLAS_DEV_MODE" = "external" ]; then
    echo "⚠️  WARNING: External RPC access enabled (development only!)"
    RPC_EXTERNAL="--rpc-external --unsafe-rpc-external"
    CORS_ORIGINS="*"
fi

# Clean previous state if requested
if [ "$1" = "--purge" ] || [ "$1" = "-p" ]; then
    echo "🧹 Purging chain data at $BASE_PATH..."
    rm -rf "$BASE_PATH"
fi

echo ""
echo "Configuration:"
echo "  Base Path: $BASE_PATH"
echo "  RPC Port: $RPC_PORT"
echo "  P2P Port: $P2P_PORT"
echo "  Prometheus: http://127.0.0.1:$PROMETHEUS_PORT/metrics"
echo ""

# Check if desktop app should be started
START_DESKTOP="${START_DESKTOP:-true}"

# Start the node with secure defaults in the background
./target/release/atlas-sphere-node \
    --dev \
    --base-path "$BASE_PATH" \
    --rpc-port "$RPC_PORT" \
    --port "$P2P_PORT" \
    --prometheus-port "$PROMETHEUS_PORT" \
    --rpc-cors "$CORS_ORIGINS" \
    --rpc-methods Safe \
    --rpc-max-connections 100 \
    --rpc-max-request-size 10 \
    --rpc-max-response-size 50 \
    --rpc-max-subscriptions-per-connection 10 \
    --detailed-log-output \
    --log sync=debug,consensus=debug,grandpa=debug,runtime=info \
    $RPC_EXTERNAL \
    "$@" &

# Store the blockchain process PID
BLOCKCHAIN_PID=$!
echo "✅ Blockchain started (PID: $BLOCKCHAIN_PID)"
echo ""

# Wait for blockchain to initialize (checking RPC port)
echo "⏳ Waiting for blockchain to be ready..."
sleep 3
for i in {1..30}; do
    if nc -z localhost $RPC_PORT 2>/dev/null || timeout 1 curl -s http://localhost:$RPC_PORT/health >/dev/null 2>&1; then
        echo "✅ Blockchain is ready!"
        break
    fi
    if [ $i -eq 30 ]; then
        echo "⚠️  Blockchain may not be fully ready, but continuing..."
    fi
    sleep 1
done

# Start the desktop app if enabled
if [ "$START_DESKTOP" = "true" ]; then
    echo ""
    echo "🚀 Starting Tauri desktop app..."
    cd apps/atlas-desktop
    npm run tauri dev &
    DESKTOP_PID=$!
    echo "✅ Desktop app started (PID: $DESKTOP_PID)"
    cd "$PROJECT_ROOT"
    echo ""
    echo "📍 Running services:"
    echo "   • Blockchain RPC: ws://127.0.0.1:$RPC_PORT"
    echo "   • Desktop App: Launching..."
    echo ""
    echo "Press Ctrl+C to stop both services"
    echo ""
    
    # Wait for both processes
    wait $BLOCKCHAIN_PID $DESKTOP_PID
else
    echo "🚀 Desktop app disabled (set START_DESKTOP=true to enable)"
    echo ""
    echo "📍 Blockchain RPC: ws://127.0.0.1:$RPC_PORT"
    echo ""
    echo "Press Ctrl+C to stop the blockchain"
    echo ""
    
    # Wait for blockchain only
    wait $BLOCKCHAIN_PID
fi

