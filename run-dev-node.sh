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
    echo "⚠️  Binary not found. Building atlas-sphere-node..."
    echo "This may take several minutes on first build."
    echo ""
    
    # Note: The full workspace build has external dependency issues with Frontier
    # For now, we'll document what needs to be done
    echo "STATUS: Node build currently blocked by Frontier dependency compatibility issues"
    echo "        (sc-network duplicate variant indexes in polkadot-v1.0.0)"
    echo ""
    echo "WORKAROUND: To run a development node, you can:"
    echo "1. Use the polkadot-v0.9.x branch which has better Frontier support"
    echo "2. Remove Frontier dependencies and build with Substrate only"
    echo "3. Wait for Frontier to release polkadot-v1.0.0 compatible versions"
    echo ""
    exit 1
fi

# Launch the node
echo "🚀 Starting Atlas Sphere node..."
echo "   Mode: Development (single validator)"
echo "   Chain: Atlas Sphere Dev"
echo ""
echo "Node is listening on:"
echo "   RPC:   ws://127.0.0.1:9944"
echo "   WS:    ws://127.0.0.1:9945"
echo "   P2P:   127.0.0.1:30333"
echo ""
echo "Press Ctrl+C to stop the node"
echo ""

# Run with dev configuration
exec ./target/release/atlas-sphere-node \
    --dev \
    --ws-external \
    --rpc-external \
    --rpc-methods unsafe \
    --log=info,runtime=debug
