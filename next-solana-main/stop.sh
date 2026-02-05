#!/bin/bash

# Stop Script for Solana Flashloan Arbitrage Bot
# This script gracefully stops all running services

echo "🛑 Stopping Solana Flashloan Arbitrage Bot"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Function to kill process gracefully
kill_process() {
    local pid=$1
    local name=$2
    local timeout=${3:-10}

    if [ -z "$pid" ] || ! kill -0 "$pid" 2>/dev/null; then
        echo -e "${YELLOW}$name is not running${NC}"
        return 0
    fi

    echo -e "${YELLOW}Stopping $name (PID: $pid)...${NC}"

    # Send SIGTERM first
    kill -TERM "$pid" 2>/dev/null

    # Wait for graceful shutdown
    local count=0
    while kill -0 "$pid" 2>/dev/null && [ $count -lt $timeout ]; do
        sleep 1
        ((count++))
        echo -n "."
    done
    echo ""

    # Force kill if still running
    if kill -0 "$pid" 2>/dev/null; then
        echo -e "${RED}Force killing $name...${NC}"
        kill -KILL "$pid" 2>/dev/null
        sleep 2
    fi

    if kill -0 "$pid" 2>/dev/null; then
        echo -e "${RED}Failed to stop $name${NC}"
        return 1
    else
        echo -e "${GREEN}$name stopped successfully${NC}"
        return 0
    fi
}

# Stop arbitrage daemon
if [ -f "arb_daemon.pid" ]; then
    DAEMON_PID=$(cat arb_daemon.pid)
    if kill_process "$DAEMON_PID" "Arbitrage Daemon" 15; then
        rm arb_daemon.pid
    fi
else
    echo -e "${YELLOW}Arbitrage daemon PID file not found${NC}"
fi

# Stop trading engine API
if [ -f "trading_engine.pid" ]; then
    API_PID=$(cat trading_engine.pid)
    if kill_process "$API_PID" "Trading Engine API" 10; then
        rm trading_engine.pid
    fi
else
    echo -e "${YELLOW}Trading engine API PID file not found${NC}"
fi

# Stop any remaining Python processes related to the bot
echo -e "${YELLOW}Checking for any remaining bot processes...${NC}"
BOT_PROCESSES=$(pgrep -f "arb_daemon.py\|main.py" || true)

if [ -n "$BOT_PROCESSES" ]; then
    echo -e "${YELLOW}Found additional bot processes: $BOT_PROCESSES${NC}"
    echo "$BOT_PROCESSES" | while read -r pid; do
        if [ -n "$pid" ]; then
            kill_process "$pid" "Bot Process (PID: $pid)"
        fi
    done
else
    echo -e "${GREEN}No additional bot processes found${NC}"
fi

# Clean up any temporary files (optional)
echo -e "${YELLOW}Cleaning up temporary files...${NC}"
# Add cleanup commands here if needed

echo -e "${GREEN}=== All services stopped ===${NC}"
echo -e "${YELLOW}To restart the bot, run: ./deploy.sh restart${NC}"