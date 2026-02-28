#!/usr/bin/env bash
# ☢️ YOLO FINISHER v5.0 — PRE-COMMIT HARD GATE HOOK
# Enforces nuclear finisher rules at commit time.
# Install: cp .clinerules/hooks/finisher-pre-commit.sh .git/hooks/pre-commit
set -euo pipefail

RED='\033[0;31m'
YELLOW='\033[1;33m'
GREEN='\033[0;32m'
NC='\033[0m'

ERRORS=0

echo "☢️  YOLO FINISHER — Pre-Commit Gate Check"
echo "────────────────────────────────────────"

# ──────────────────────────────────────────
# GATE 1: No TODOs, FIXMEs, HACKs, XXXs
# ──────────────────────────────────────────
TODO_COUNT=$(git diff --cached --name-only | xargs grep -rn 'TODO\|FIXME\|HACK\|XXX' 2>/dev/null | grep -v 'node_modules' | grep -v '.git/' | wc -l || true)
if [ "$TODO_COUNT" -gt 0 ]; then
    echo -e "${RED}❌ GATE 1 FAILED: Found $TODO_COUNT TODO/FIXME/HACK/XXX markers${NC}"
    git diff --cached --name-only | xargs grep -rn 'TODO\|FIXME\|HACK\|XXX' 2>/dev/null | grep -v 'node_modules' | grep -v '.git/' | head -10
    ERRORS=$((ERRORS + 1))
else
    echo -e "${GREEN}✔ GATE 1: No TODO/FIXME/HACK/XXX markers${NC}"
fi

# ──────────────────────────────────────────
# GATE 2: No hardcoded secrets patterns
# ──────────────────────────────────────────
SECRET_PATTERNS='(password|secret|api_key|apikey|token|private_key)\s*=\s*["\x27][^"\x27]{8,}'
SECRET_COUNT=$(git diff --cached --name-only | xargs grep -rniE "$SECRET_PATTERNS" 2>/dev/null | grep -v 'node_modules' | grep -v '.git/' | grep -v '.env.example' | grep -v 'test' | wc -l || true)
if [ "$SECRET_COUNT" -gt 0 ]; then
    echo -e "${RED}❌ GATE 2 FAILED: Found $SECRET_COUNT potential hardcoded secrets${NC}"
    git diff --cached --name-only | xargs grep -rniE "$SECRET_PATTERNS" 2>/dev/null | grep -v 'node_modules' | grep -v '.git/' | grep -v '.env.example' | grep -v 'test' | head -5
    ERRORS=$((ERRORS + 1))
else
    echo -e "${GREEN}✔ GATE 2: No hardcoded secrets detected${NC}"
fi

# ──────────────────────────────────────────
# GATE 3: No stub/placeholder functions
# ──────────────────────────────────────────
STUB_PATTERNS='(pass$|raise NotImplementedError|throw new Error.*not implemented|unimplemented!|todo!)'
STUB_COUNT=$(git diff --cached --name-only | xargs grep -rniE "$STUB_PATTERNS" 2>/dev/null | grep -v 'node_modules' | grep -v '.git/' | grep -v 'test' | wc -l || true)
if [ "$STUB_COUNT" -gt 0 ]; then
    echo -e "${YELLOW}⚠️  GATE 3 WARNING: Found $STUB_COUNT potential stubs/placeholders${NC}"
    git diff --cached --name-only | xargs grep -rniE "$STUB_PATTERNS" 2>/dev/null | grep -v 'node_modules' | grep -v '.git/' | grep -v 'test' | head -5
    ERRORS=$((ERRORS + 1))
else
    echo -e "${GREEN}✔ GATE 3: No stubs or placeholders${NC}"
fi

# ──────────────────────────────────────────
# GATE 4: No commented-out code blocks
# ──────────────────────────────────────────
COMMENTED_PATTERNS='^\s*(//|#)\s*(fn |def |class |function |const |let |var |import |from |export )'
COMMENTED_COUNT=$(git diff --cached --name-only | xargs grep -rnE "$COMMENTED_PATTERNS" 2>/dev/null | grep -v 'node_modules' | grep -v '.git/' | wc -l || true)
if [ "$COMMENTED_COUNT" -gt 0 ]; then
    echo -e "${YELLOW}⚠️  GATE 4 WARNING: Found $COMMENTED_COUNT lines of commented-out code${NC}"
    git diff --cached --name-only | xargs grep -rnE "$COMMENTED_PATTERNS" 2>/dev/null | grep -v 'node_modules' | grep -v '.git/' | head -5
    ERRORS=$((ERRORS + 1))
else
    echo -e "${GREEN}✔ GATE 4: No commented-out code blocks${NC}"
fi

# ──────────────────────────────────────────
# GATE 5: No console.log / print debugging
# ──────────────────────────────────────────
DEBUG_PATTERNS='(console\.log\(|print\(.*DEBUG|debugger;|binding\.pry|import pdb)'
DEBUG_COUNT=$(git diff --cached --diff-filter=ACM --name-only | xargs grep -rnE "$DEBUG_PATTERNS" 2>/dev/null | grep -v 'node_modules' | grep -v '.git/' | grep -v 'test' | wc -l || true)
if [ "$DEBUG_COUNT" -gt 0 ]; then
    echo -e "${YELLOW}⚠️  GATE 5 WARNING: Found $DEBUG_COUNT debug statements in staged files${NC}"
    ERRORS=$((ERRORS + 1))
else
    echo -e "${GREEN}✔ GATE 5: No debug statements in production code${NC}"
fi

echo "────────────────────────────────────────"

if [ "$ERRORS" -gt 0 ]; then
    echo -e "${RED}☢️  FINISHER GATE: $ERRORS gate(s) failed. Commit blocked.${NC}"
    echo -e "${RED}   Fix issues or use --no-verify to bypass (NOT recommended).${NC}"
    exit 1
else
    echo -e "${GREEN}☢️  FINISHER GATE: All gates passed. Commit approved.${NC}"
    exit 0
fi
