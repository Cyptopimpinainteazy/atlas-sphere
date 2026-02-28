#!/bin/bash

# Integration Test & Verification Script
# Tests the complete Substreams Skills + LLM integration

set -e

echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "  Substreams Skills LLM Integration — Verification"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo

# Color codes
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Test results
TESTS_PASSED=0
TESTS_FAILED=0

# Helper functions
test_cmd() {
    local name=$1
    local cmd=$2
    
    echo -n "Testing: $name ... "
    
    if eval "$cmd" > /dev/null 2>&1; then
        echo -e "${GREEN}✓ PASS${NC}"
        ((TESTS_PASSED++))
        return 0
    else
        echo -e "${RED}✗ FAIL${NC}"
        ((TESTS_FAILED++))
        return 1
    fi
}

# Phase 1: Check prerequisites
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "  Phase 1: Prerequisites"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo

test_cmd "Node.js installed" "command -v node"
test_cmd "npm installed" "command -v npm"
test_cmd "Node 18+" "node --version | grep -q 'v1[89]\|v2[0-9]'"

echo

# Phase 2: Check installation
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "  Phase 2: Files & Configuration"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo

test_cmd "llm-config.json exists" "[ -f llm-config.json ]"
test_cmd "router.js exists" "[ -f llm-service/router.js ]"
test_cmd "client.js exists" "[ -f llm-service/client.js ]"
test_cmd "client.py exists" "[ -f llm-service/client.py ]"
test_cmd "llm-config.json valid JSON" "node -e \"JSON.parse(require('fs').readFileSync('llm-config.json'))\" 2>/dev/null"

echo

# Phase 3: Check services
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "  Phase 3: Services"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo

# Check Ollama
if command -v ollama &> /dev/null; then
    test_cmd "Ollama installed" "command -v ollama"
    
    # Check if Ollama service is running
    if curl -s http://localhost:11434/api/tags > /dev/null 2>&1; then
        echo -n "Testing: Ollama service running ... "
        echo -e "${GREEN}✓ PASS${NC}"
        ((TESTS_PASSED++))
        
        test_cmd "Ollama model available" "curl -s http://localhost:11434/api/tags | grep -q '\"name\"'"
    else
        echo -n "Testing: Ollama service running ... "
        echo -e "${YELLOW}⚠ SKIP${NC} (start with 'ollama serve')"
    fi
else
    echo -n "Testing: Ollama installed ... "
    echo -e "${YELLOW}⚠ OPTIONAL${NC} (install from https://ollama.ai)"
fi

echo

# Phase 4: Check LLM Router
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "  Phase 4: LLM Router"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo

# Check if router is running
if curl -s http://localhost:3000/health > /dev/null 2>&1; then
    echo -n "Testing: LLM Router running ... "
    echo -e "${GREEN}✓ PASS${NC}"
    ((TESTS_PASSED++))
    
    test_cmd "Router health check" "curl -s http://localhost:3000/health | grep -q '\"status\"'"
    test_cmd "Router models endpoint" "curl -s http://localhost:3000/models | grep -q '\"type\"'"
    test_cmd "Router metrics endpoint" "curl -s http://localhost:3000/metrics | grep -q '\"total_queries\"'"
else
    echo -n "Testing: LLM Router running ... "
    echo -e "${YELLOW}⚠ NOT RUNNING${NC} (start with 'npm start')"
    echo
fi

echo

# Phase 5: Syntax & Validity
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "  Phase 5: Code Syntax"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo

test_cmd "router.js valid" "node -c llm-service/router.js"
test_cmd "client.js valid" "node -c llm-service/client.js"
test_cmd "examples.js valid" "node -c llm-service/examples.js"

echo

# Phase 6: Docker (optional)
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "  Phase 6: Docker Support (Optional)"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo

if command -v docker &> /dev/null; then
    test_cmd "Docker installed" "command -v docker"
    test_cmd "docker-compose config valid" "docker-compose -f docker-compose.llm.yml config > /dev/null"
    test_cmd "Dockerfile.llm-service exists" "[ -f Dockerfile.llm-service ]"
else
    echo -n "Docker: "
    echo -e "${YELLOW}⚠ NOT INSTALLED${NC} (optional, for containerization)"
fi

echo

# Phase 7: Kubernetes (optional)
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "  Phase 7: Kubernetes Support (Optional)"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo

if command -v kubectl &> /dev/null; then
    test_cmd "kubectl installed" "command -v kubectl"
    test_cmd "K8s manifests valid" "kubectl apply -f k8s-deployment.yaml --dry-run=client > /dev/null"
else
    echo -n "Kubernetes: "
    echo -e "${YELLOW}⚠ NOT INSTALLED${NC} (optional, for K8s deployment)"
fi

echo

# Summary
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "  Test Summary"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo

echo -e "Tests passed:  ${GREEN}$TESTS_PASSED${NC}"
echo -e "Tests failed:  ${RED}$TESTS_FAILED${NC}"
echo

if [ $TESTS_FAILED -eq 0 ]; then
    echo -e "${GREEN}✓ All core tests passed!${NC}"
    echo
    echo "Next steps:"
    echo "  1. Start Ollama (if not running):"
    echo "     $ ollama serve"
    echo
    echo "  2. Start LLM Router (in another terminal):"
    echo "     $ npm start"
    echo
    echo "  3. Test the integration:"
    echo "     $ curl http://localhost:3000/health"
    echo
    echo "  4. Run examples:"
    echo "     $ node llm-service/examples.js"
    echo
    exit 0
else
    echo -e "${RED}✗ Some tests failed. Check the output above.${NC}"
    echo
    echo "Issues:"
    echo "  - Prerequisites: Install missing tools (Node.js, npm, etc.)"
    echo "  - Services: Start Ollama and LLM Router"
    echo "  - Configuration: Check llm-config.json"
    echo "  - Syntax: Review error messages above"
    echo
    exit 1
fi
