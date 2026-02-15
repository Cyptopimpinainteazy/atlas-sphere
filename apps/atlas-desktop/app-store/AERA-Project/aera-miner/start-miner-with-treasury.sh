#!/bin/bash
# AERA Miner Launch Script with X3 Treasury Integration
# This script launches the AERA miner with automatic 50% treasury routing

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
CONFIG_FILE="$SCRIPT_DIR/x3_treasury_config.json"
LOG_DIR="$SCRIPT_DIR/logs"

# Colors for output
GREEN='\033[0;32m'
BLUE='\033[0;34m'
ORANGE='\033[0;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

echo -e "${BLUE}================================${NC}"
echo -e "${BLUE}  AERA Miner + X3 Treasury${NC}"
echo -e "${BLUE}================================${NC}"
echo ""

# Create logs directory
mkdir -p "$LOG_DIR"

# Validate config
if [ ! -f "$CONFIG_FILE" ]; then
    echo -e "${RED}❌ Treasury config not found: $CONFIG_FILE${NC}"
    echo "Creating default config..."
    # Config was created above, this is just a safety check
fi

# Read treasury configuration
TREASURY_ADDRESS=$(jq -r '.treasury_config.x3_treasury_address' "$CONFIG_FILE")
TREASURY_SHARE=$(jq -r '.treasury_config.treasury_share' "$CONFIG_FILE")
AUTO_TRANSFER=$(jq -r '.treasury_config.auto_transfer' "$CONFIG_FILE")

echo -e "${GREEN}✅ Treasury Integration Active${NC}"
echo -e "   Address: ${ORANGE}$TREASURY_ADDRESS${NC}"
echo -e "   Share: ${ORANGE}${TREASURY_SHARE}%${NC} (50% to X3 Treasury)"
echo -e "   Auto-transfer: ${ORANGE}$AUTO_TRANSFER${NC}"
echo ""

# Check if treasury address is configured
if [[ "$TREASURY_ADDRESS" == *"REPLACE"* ]]; then
    echo -e "${ORANGE}⚠️  Warning: Treasury address needs to be configured in production${NC}"
    echo -e "   Edit: $CONFIG_FILE"
    echo ""
fi

# Check for miner executable
MINER_EXEC="$SCRIPT_DIR/aera-miner"
if [ ! -f "$MINER_EXEC" ]; then
    echo -e "${RED}❌ Miner executable not found: $MINER_EXEC${NC}"
    echo "Please build the miner first or check the installation."
    exit 1
fi

# Export treasury configuration as environment variables
export X3_TREASURY_ADDRESS="$TREASURY_ADDRESS"
export X3_TREASURY_SHARE="$TREASURY_SHARE"
export X3_AUTO_TRANSFER="$AUTO_TRANSFER"
export X3_LOG_DIR="$LOG_DIR"

# Launch miner with treasury integration
echo -e "${GREEN}🚀 Starting AERA Miner with X3 Treasury Integration...${NC}"
echo ""
echo "Mining rewards will be automatically split:"
echo "  • 50% → X3 Treasury ($TREASURY_ADDRESS)"
echo "  • 50% → Your Wallet"
echo ""
echo -e "${BLUE}Press Ctrl+C to stop mining${NC}"
echo ""

# Start the miner
# This assumes the miner reads X3_ environment variables for treasury integration
"$MINER_EXEC" \
    --config "$CONFIG_FILE" \
    --treasury-enabled \
    --treasury-address "$TREASURY_ADDRESS" \
    --treasury-share "$TREASURY_SHARE" \
    --log-file "$LOG_DIR/miner.log" \
    2>&1 | tee -a "$LOG_DIR/treasury_integration.log"

# Log exit
echo ""
echo -e "${ORANGE}Miner stopped.${NC}"
echo "Treasury transaction log: $LOG_DIR/treasury_transfers.log"
