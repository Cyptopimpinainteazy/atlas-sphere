#!/bin/bash

# Check if Foundry is installed
if ! command -v anvil &> /dev/null; then
  echo "Foundry not found. Installing..."
  curl -L https://foundry.paradigm.xyz | bash
  source ~/.bashrc
  foundryup
fi

# Start Anvil in the background
echo "Starting Anvil fork of Ethereum mainnet..."
anvil --fork-url https://eth-mainnet.g.alchemy.com/v2/4UjEl1ULr2lQYsGR5n7gGKd3pzgAzxKs &
ANVIL_PID=$!

# Wait for Anvil to start
sleep 2

# Start MCP server in the background
echo "Starting MCP server..."
cargo run --bin mcp-server &
MCP_PID=$!

# Wait for MCP server to start
sleep 2

# Start RIG client
echo "Starting RIG client..."
cargo run --bin rig-client

# Cleanup on exit
function cleanup {
  echo "Shutting down services..."
  kill $MCP_PID
  kill $ANVIL_PID
}

trap cleanup EXIT