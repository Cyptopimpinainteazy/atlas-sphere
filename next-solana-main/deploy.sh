#!/bin/bash

# Production Deployment Script for Solana Flashloan Arbitrage Bot
# This script builds, deploys, and starts the arbitrage system

set -e  # Exit on any error

echo "🚀 Starting Solana Flashloan Arbitrage Bot Deployment"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Configuration
NETWORK=${NETWORK:-mainnet-beta}
WALLET_KEYPAIR=${WALLET_KEYPAIR:-~/.config/solana/id.json}
ANCHOR_PROJECT_PATH="./anchor"

# Check prerequisites
check_prerequisites() {
    echo -e "${YELLOW}Checking prerequisites...${NC}"

    # Check if solana CLI is installed
    if ! command -v solana &> /dev/null; then
        echo -e "${RED}Error: Solana CLI not found. Install from https://docs.solana.com/cli/install-solana-cli-tools${NC}"
        exit 1
    fi

    # Check if anchor is installed
    if ! command -v anchor &> /dev/null; then
        echo -e "${RED}Error: Anchor CLI not found. Install from https://www.anchor-lang.com/docs/installation${NC}"
        exit 1
    fi

    # Check if node and npm are installed
    if ! command -v node &> /dev/null || ! command -v npm &> /dev/null; then
        echo -e "${RED}Error: Node.js and npm required${NC}"
        exit 1
    fi

    # Check if python3 is installed
    if ! command -v python3 &> /dev/null; then
        echo -e "${RED}Error: Python 3 required${NC}"
        exit 1
    fi

    echo -e "${GREEN}Prerequisites check passed${NC}"
}

# Setup Solana CLI
setup_solana() {
    echo -e "${YELLOW}Setting up Solana CLI...${NC}"

    # Set network
    solana config set --url $NETWORK

    # Check wallet balance
    if [ ! -f "$WALLET_KEYPAIR" ]; then
        echo -e "${RED}Error: Wallet keypair not found at $WALLET_KEYPAIR${NC}"
        echo -e "${YELLOW}Create a new wallet: solana-keygen new --outfile $WALLET_KEYPAIR${NC}"
        exit 1
    fi

    solana config set --keypair $WALLET_KEYPAIR
    WALLET_ADDRESS=$(solana address)

    echo -e "${GREEN}Using wallet: $WALLET_ADDRESS${NC}"

    # Check balance
    BALANCE=$(solana balance | awk '{print $1}')
    echo -e "${YELLOW}Wallet balance: $BALANCE SOL${NC}"

    if (( $(echo "$BALANCE < 0.5" | bc -l) )); then
        echo -e "${RED}Warning: Low balance. Need at least 0.5 SOL for deployment${NC}"
        read -p "Continue anyway? (y/N): " -n 1 -r
        echo
        if [[ ! $REPLY =~ ^[Yy]$ ]]; then
            exit 1
        fi
    fi
}

# Build Anchor programs
build_programs() {
    echo -e "${YELLOW}Building Anchor programs...${NC}"

    cd $ANCHOR_PROJECT_PATH

    # Build programs
    anchor build

    if [ $? -ne 0 ]; then
        echo -e "${RED}Error: Failed to build Anchor programs${NC}"
        exit 1
    fi

    echo -e "${GREEN}Programs built successfully${NC}"
    cd ..
}

# Deploy programs
deploy_programs() {
    echo -e "${YELLOW}Deploying programs to $NETWORK...${NC}"

    cd $ANCHOR_PROJECT_PATH

    # Deploy programs
    anchor deploy

    if [ $? -ne 0 ]; then
        echo -e "${RED}Error: Failed to deploy programs${NC}"
        exit 1
    fi

    echo -e "${GREEN}Programs deployed successfully${NC}"

    # Extract program IDs from Anchor.toml
    FLASHLOAN_PROGRAM_ID=$(grep 'flashloan_receiver' Anchor.toml | sed 's/.*= "\(.*\)"/\1/')
    ARB_ENGINE_PROGRAM_ID=$(grep 'arb_engine' Anchor.toml | sed 's/.*= "\(.*\)"/\1/')

    echo -e "${GREEN}FlashloanReceiver Program ID: $FLASHLOAN_PROGRAM_ID${NC}"
    echo -e "${GREEN}ArbEngine Program ID: $ARB_ENGINE_PROGRAM_ID${NC}"

    cd ..
}

# Setup Python environment
setup_python() {
    echo -e "${YELLOW}Setting up Python environment...${NC}"

    cd python-services

    # Create virtual environment if it doesn't exist
    if [ ! -d "venv" ]; then
        python3 -m venv venv
    fi

    # Activate virtual environment
    source venv/bin/activate

    # Install dependencies
    pip install -r arb_daemon/requirements.txt
    pip install -r trading-engine/requirements.txt

    echo -e "${GREEN}Python environment setup complete${NC}"
    cd ..
}

# Generate configuration files
generate_config() {
    echo -e "${YELLOW}Generating configuration files...${NC}"

    # Create .env file for Python daemon
    cat > python-services/.env << EOF
WALLET_PRIVATE_KEY=$(solana-keygen pubkey $WALLET_KEYPAIR | xargs solana-keygen grind --ends-with | head -n 1 | awk '{print $1}')
FLASHLOAN_PROGRAM_ID=$FLASHLOAN_PROGRAM_ID
ARB_ENGINE_PROGRAM_ID=$ARB_ENGINE_PROGRAM_ID
SOLANA_NETWORK=$NETWORK
RPC_URL=https://api.mainnet-beta.solana.com
LOG_LEVEL=INFO
EOF

    echo -e "${GREEN}Configuration files generated${NC}"
}

# Initialize PDAs and accounts
initialize_accounts() {
    echo -e "${YELLOW}Initializing program accounts...${NC}"

    cd python-services

    # Run initialization script
    source venv/bin/activate
    python3 scripts/initialize_accounts.py

    if [ $? -ne 0 ]; then
        echo -e "${RED}Error: Failed to initialize accounts${NC}"
        exit 1
    fi

    echo -e "${GREEN}Program accounts initialized${NC}"
    cd ..
}

# Start services
start_services() {
    echo -e "${YELLOW}Starting services...${NC}"

    # Create logs directory
    mkdir -p logs

    # Start arbitrage daemon
    cd python-services
    source venv/bin/activate

    echo -e "${GREEN}Starting arbitrage daemon...${NC}"
    nohup python3 arb_daemon.py > ../logs/arb_daemon.log 2>&1 &
    DAEMON_PID=$!
    echo $DAEMON_PID > ../arb_daemon.pid

    # Start trading engine API
    echo -e "${GREEN}Starting trading engine API...${NC}"
    nohup python3 trading-engine/main.py > ../logs/trading_engine.log 2>&1 &
    API_PID=$!
    echo $API_PID > ../trading_engine.pid

    cd ..

    echo -e "${GREEN}Services started successfully${NC}"
    echo -e "${YELLOW}Daemon PID: $DAEMON_PID${NC}"
    echo -e "${YELLOW}API PID: $API_PID${NC}"
    echo -e "${YELLOW}Logs: logs/arb_daemon.log, logs/trading_engine.log${NC}"
}

# Health check
health_check() {
    echo -e "${YELLOW}Running health checks...${NC}"

    # Wait a moment for services to start
    sleep 5

    # Check if processes are running
    if kill -0 $DAEMON_PID 2>/dev/null; then
        echo -e "${GREEN}Arbitrage daemon is running${NC}"
    else
        echo -e "${RED}Arbitrage daemon failed to start${NC}"
        exit 1
    fi

    if kill -0 $API_PID 2>/dev/null; then
        echo -e "${GREEN}Trading engine API is running${NC}"
    else
        echo -e "${RED}Trading engine API failed to start${NC}"
        exit 1
    fi

    # Check API health endpoint
    if curl -s http://localhost:8001/health > /dev/null; then
        echo -e "${GREEN}API health check passed${NC}"
    else
        echo -e "${RED}API health check failed${NC}"
        exit 1
    fi
}

# Stop services
stop_services() {
    echo -e "${YELLOW}Stopping services...${NC}"

    if [ -f "arb_daemon.pid" ]; then
        DAEMON_PID=$(cat arb_daemon.pid)
        if kill -0 $DAEMON_PID 2>/dev/null; then
            kill $DAEMON_PID
            echo -e "${GREEN}Arbitrage daemon stopped${NC}"
        fi
        rm arb_daemon.pid
    fi

    if [ -f "trading_engine.pid" ]; then
        API_PID=$(cat trading_engine.pid)
        if kill -0 $API_PID 2>/dev/null; then
            kill $API_PID
            echo -e "${GREEN}Trading engine API stopped${NC}"
        fi
        rm trading_engine.pid
    fi
}

# Main deployment flow
main() {
    echo -e "${GREEN}=== Solana Flashloan Arbitrage Bot Deployment ===${NC}"

    check_prerequisites
    setup_solana
    build_programs
    deploy_programs
    setup_python
    generate_config
    initialize_accounts
    start_services
    health_check

    echo -e "${GREEN}=== Deployment Complete! ===${NC}"
    echo -e "${GREEN}Your arbitrage bot is now running on $NETWORK${NC}"
    echo -e "${YELLOW}Monitor logs with: tail -f logs/arb_daemon.log${NC}"
    echo -e "${YELLOW}Stop services with: ./stop.sh${NC}"
}

# Cleanup on error
trap 'echo -e "${RED}Deployment failed${NC}"; stop_services' ERR

# Parse command line arguments
case "${1:-}" in
    "stop")
        stop_services
        ;;
    "restart")
        stop_services
        sleep 2
        start_services
        health_check
        ;;
    *)
        main
        ;;
esac