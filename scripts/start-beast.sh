#!/bin/bash
# Quick start script for Atlas Sphere - "The Beast"

set -e

PROJECT_ROOT="/home/lojak/Desktop/atlas-sphere-master"

echo "╔════════════════════════════════════════════════════════════╗"
echo "║  🦾 Atlas Sphere - Starting 'The Beast'                    ║"
echo "╚════════════════════════════════════════════════════════════╝"
echo ""

# Color codes
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

# Kill any existing processes (cleanup)
echo -e "${YELLOW}[*] Cleaning up old processes...${NC}"
pkill -f "npm run dev" || true
pkill -f "cross_chain_gpu_validator" || true
sleep 1

# Start X3 Intelligence Dashboard
echo -e "${BLUE}[*] Starting X3 Intelligence Dashboard...${NC}"
cd "$PROJECT_ROOT/apps/x3-intelligence"
npm install --silent > /dev/null 2>&1 || true
PORT=5173 npm run dev > /tmp/x3-intelligence.log 2>&1 &
X3_PID=$!
echo -e "${GREEN}✓ X3 Intelligence started (PID: $X3_PID)${NC}"
echo "   URL: http://localhost:5173"
echo "   Logs: tail -f /tmp/x3-intelligence.log"
echo ""

# Start Cross-Chain GPU Validator
echo -e "${BLUE}[*] Starting Cross-Chain GPU Validator...${NC}"
cd "$PROJECT_ROOT/cross-chain-gpu-validator"
source .venv/bin/activate 2>/dev/null || python3 -m venv .venv && source .venv/bin/activate
pip install -q -e . > /dev/null 2>&1 || true
export CCGV_USE_MOCK_RPC=true
python -m cross_chain_gpu_validator.cli serve --host 0.0.0.0 --port 8000 > /tmp/ccgv-validator.log 2>&1 &
CCGV_PID=$!
echo -e "${GREEN}✓ GPU Validator started (PID: $CCGV_PID)${NC}"
echo "   URL: http://localhost:8000/metrics.json"
echo "   Logs: tail -f /tmp/ccgv-validator.log"
echo ""

# Save PIDs for later cleanup
cat > /tmp/atlas-sphere-pids.txt << EOF
X3_INTELLIGENCE_PID=$X3_PID
CCGV_VALIDATOR_PID=$CCGV_PID
EOF

echo "╔════════════════════════════════════════════════════════════╗"
echo "║  🦾 The Beast is Running!                                  ║"
echo "╚════════════════════════════════════════════════════════════╝"
echo ""
echo "Services:"
echo "  📊 X3 Intelligence:    http://localhost:5173"
echo "  ⚙️  GPU Validator:       http://localhost:8000/metrics.json"
echo ""
echo "Login:"
echo "  Username: admin"
echo "  Password: atlas-sphere-2026"
echo ""
echo "PIDs saved to: /tmp/atlas-sphere-pids.txt"
echo ""
echo "To stop all services:"
echo "  bash $PROJECT_ROOT/scripts/stop-beast.sh"
echo ""
echo "To view logs:"
echo "  tail -f /tmp/x3-intelligence.log"
echo "  tail -f /tmp/ccgv-validator.log"
echo ""

# Wait for services to be ready
sleep 3

# Check services are running
echo -e "${BLUE}[*] Verifying services...${NC}"
if ps -p $X3_PID > /dev/null; then
    echo -e "${GREEN}✓ X3 Intelligence is running${NC}"
else
    echo -e "${YELLOW}⚠ X3 Intelligence failed to start${NC}"
fi

if ps -p $CCGV_PID > /dev/null; then
    echo -e "${GREEN}✓ GPU Validator is running${NC}"
else
    echo -e "${YELLOW}⚠ GPU Validator failed to start${NC}"
fi

echo ""
echo -e "${GREEN}✅ Setup complete! Point your browser to http://localhost:5173${NC}"
echo ""

# Keep script running
wait
