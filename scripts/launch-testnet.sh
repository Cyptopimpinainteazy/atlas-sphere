#!/usr/bin/env bash
# =============================================================================
# X3 Chain Testnet Launch Script
# =============================================================================
# Launches a 4-validator testnet on localhost with staggered ports.
#
# Usage:
#   ./launch-testnet.sh            # Launch all 4 validators
#   ./launch-testnet.sh validator1 # Launch a single validator
#   ./launch-testnet.sh stop       # Stop all validators
#
# Each validator gets unique ports:
#   TestnetAlpha:  P2P=30333, RPC=9944, WS=9944
#   TestnetBeta:   P2P=30334, RPC=9945, WS=9945
#   TestnetGamma:  P2P=30335, RPC=9946, WS=9946
#   TestnetDelta:  P2P=30336, RPC=9947, WS=9947
# =============================================================================

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
BINARY="${SCRIPT_DIR}/target/release/x3-chain-node"
BASE_PATH="${SCRIPT_DIR}/testnet-data"
CHAIN="testnet"

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

log_info()  { echo -e "${GREEN}[INFO]${NC} $*"; }
log_warn()  { echo -e "${YELLOW}[WARN]${NC} $*"; }
log_error() { echo -e "${RED}[ERROR]${NC} $*"; }

# Check binary exists
check_binary() {
    if [ ! -f "$BINARY" ]; then
        log_error "Binary not found at $BINARY"
        log_info "Build with: cargo build --release -p x3-chain-node"
        exit 1
    fi
}

# Validator configuration
declare -A VALIDATORS=(
    [validator1]="TestnetAlpha:30333:9944"
    [validator2]="TestnetBeta:30334:9945"
    [validator3]="TestnetGamma:30335:9946"
    [validator4]="TestnetDelta:30336:9947"
)

launch_validator() {
    local name="$1"
    local config="${VALIDATORS[$name]}"
    IFS=':' read -r seed p2p_port rpc_port <<< "$config"

    local data_dir="${BASE_PATH}/${name}"
    mkdir -p "$data_dir"

    log_info "Launching $seed (P2P: $p2p_port, RPC: $rpc_port)..."

    "$BINARY" \
        --chain="$CHAIN" \
        --base-path="$data_dir" \
        --name="$seed" \
        --validator \
        --port="$p2p_port" \
        --rpc-port="$rpc_port" \
        --rpc-cors=all \
        --rpc-methods=Unsafe \
        --unsafe-rpc-external \
        --log="info" \
        --telemetry-url="wss://telemetry.polkadot.io/submit/ 0" \
        2>&1 | tee "${data_dir}/${name}.log" &

    echo $! > "${data_dir}/${name}.pid"
    log_info "$seed started (PID: $(cat "${data_dir}/${name}.pid"))"
}

stop_all() {
    log_info "Stopping all testnet validators..."
    for name in "${!VALIDATORS[@]}"; do
        local pid_file="${BASE_PATH}/${name}/${name}.pid"
        if [ -f "$pid_file" ]; then
            local pid
            pid=$(cat "$pid_file")
            if kill -0 "$pid" 2>/dev/null; then
                kill "$pid"
                log_info "Stopped $name (PID: $pid)"
            fi
            rm -f "$pid_file"
        fi
    done
}

status() {
    log_info "Testnet validator status:"
    for name in "${!VALIDATORS[@]}"; do
        local config="${VALIDATORS[$name]}"
        IFS=':' read -r seed p2p_port rpc_port <<< "$config"
        local pid_file="${BASE_PATH}/${name}/${name}.pid"

        if [ -f "$pid_file" ] && kill -0 "$(cat "$pid_file")" 2>/dev/null; then
            echo -e "  ${GREEN}●${NC} $seed ($name) - Running (PID: $(cat "$pid_file"), RPC: $rpc_port)"
        else
            echo -e "  ${RED}●${NC} $seed ($name) - Stopped"
        fi
    done
}

# Main
case "${1:-all}" in
    validator1|validator2|validator3|validator4)
        check_binary
        launch_validator "$1"
        ;;
    all)
        check_binary
        log_info "Launching X3 Chain testnet with 4 validators..."
        for name in validator1 validator2 validator3 validator4; do
            launch_validator "$name"
            sleep 1 # Stagger launches
        done
        log_info "All validators launched!"
        log_info "RPC endpoints: ws://localhost:9944 - ws://localhost:9947"
        ;;
    stop)
        stop_all
        ;;
    status)
        status
        ;;
    *)
        echo "Usage: $0 {all|validator1|validator2|validator3|validator4|stop|status}"
        exit 1
        ;;
esac
