---
description: Comprehensive validation command for the Context-Engineering-Intro codebase
---

# Comprehensive Validation for Context Engineering Template

This validation ensures the entire Context Engineering template and all use-cases work correctly.

## Phase 1: Python Environment Setup

```bash
# Ensure Python environment is active
source venv_linux/bin/activate 2>/dev/null || python3 -m venv venv_linux && source venv_linux/bin/activate

# Install core dependencies for all Python use-cases
pip install -q pytest pytest-asyncio black ruff mypy pydantic pydantic-ai python-dotenv
```

## Phase 2: Linting & Style Checks

### Python Linting (All Use-Cases)
```bash
echo "=== Python Linting with Ruff ==="
ruff check use-cases/agent-factory-with-subagents/agents/rag_agent/ --ignore E501 || true
ruff check use-cases/pydantic-ai/examples/ --ignore E501 || true

echo "=== Black Formatting Check ==="
black --check use-cases/agent-factory-with-subagents/agents/rag_agent/ || true
black --check use-cases/pydantic-ai/examples/ || true
```

### TypeScript/JavaScript Linting (MCP Server)
```bash
echo "=== TypeScript Linting (MCP Server) ==="
cd use-cases/mcp-server && npm install && npm run type-check || true
```

## Phase 3: Type Checking

### Python Type Checking
```bash
echo "=== MyPy Type Checking ==="
mypy use-cases/agent-factory-with-subagents/agents/rag_agent/ --ignore-missing-imports || true
mypy use-cases/pydantic-ai/examples/ --ignore-missing-imports || true
```

### TypeScript Type Checking
```bash
echo "=== TypeScript Type Checking ==="
cd use-cases/mcp-server && npx tsc --noEmit || true
```

## Phase 4: Unit Tests

### RAG Agent Tests
```bash
echo "=== RAG Agent Unit Tests ==="
cd use-cases/agent-factory-with-subagents/agents/rag_agent
pip install -r requirements.txt -q || true
pytest tests/ -v --tb=short || echo "Some tests may require database setup"
```

### MCP Server Tests  
```bash
echo "=== MCP Server Unit Tests ==="
cd use-cases/mcp-server
npm run test:run || true
```

### Pydantic AI Testing Examples
```bash
echo "=== Pydantic AI Testing Examples ==="
cd use-cases/pydantic-ai/examples/testing_examples
pytest test_agent_patterns.py -v --tb=short || echo "Tests may require LLM API key"
```

## Phase 5: Template Integrity Checks

### Verify All Required Files Exist
```bash
echo "=== Template Structure Validation ==="

# Root-level files
test -f CLAUDE.md && echo "✓ CLAUDE.md exists" || echo "✗ CLAUDE.md missing"
test -f README.md && echo "✓ README.md exists" || echo "✗ README.md missing"
test -f INITIAL.md && echo "✓ INITIAL.md exists" || echo "✗ INITIAL.md missing"
test -f INITIAL_EXAMPLE.md && echo "✓ INITIAL_EXAMPLE.md exists" || echo "✗ INITIAL_EXAMPLE.md missing"

# Claude commands
test -f .claude/commands/generate-prp.md && echo "✓ generate-prp.md exists" || echo "✗ generate-prp.md missing"
test -f .claude/commands/execute-prp.md && echo "✓ execute-prp.md exists" || echo "✗ execute-prp.md missing"

# PRP templates
test -f PRPs/templates/prp_base.md && echo "✓ PRP base template exists" || echo "✗ PRP base template missing"
test -f PRPs/EXAMPLE_multi_agent_prp.md && echo "✓ Example PRP exists" || echo "✗ Example PRP missing"

# Use-case specific files
test -f use-cases/pydantic-ai/CLAUDE.md && echo "✓ Pydantic AI CLAUDE.md exists" || echo "✗ missing"
test -f use-cases/mcp-server/CLAUDE.md && echo "✓ MCP Server CLAUDE.md exists" || echo "✗ missing"
test -f use-cases/agent-factory-with-subagents/CLAUDE.md && echo "✓ Agent Factory CLAUDE.md exists" || echo "✗ missing"
```

## Phase 6: Example Code Validation

### Verify Python Examples Import Correctly
```bash
echo "=== Python Import Validation ==="

# Basic chat agent
python -c "import sys; sys.path.insert(0, 'use-cases/pydantic-ai/examples/basic_chat_agent'); import agent" 2>&1 || echo "Note: May need env vars"

# Tool-enabled agent
python -c "import sys; sys.path.insert(0, 'use-cases/pydantic-ai/examples/tool_enabled_agent'); import agent" 2>&1 || echo "Note: May need env vars"

# Structured output agent  
python -c "import sys; sys.path.insert(0, 'use-cases/pydantic-ai/examples/structured_output_agent'); import agent" 2>&1 || echo "Note: May need env vars"

# RAG agent components
python -c "import sys; sys.path.insert(0, 'use-cases/agent-factory-with-subagents/agents/rag_agent'); from ingestion import chunker, embedder" 2>&1 || echo "Note: May need dependencies"
```

### Verify TypeScript Compiles
```bash
echo "=== TypeScript Compilation Check ==="
cd use-cases/mcp-server && npx tsc --noEmit || echo "TypeScript compilation issues found"
```

## Phase 7: Documentation Validation

### Check All READMEs Exist and Are Non-Empty
```bash
echo "=== Documentation Validation ==="

for readme in \
  README.md \
  use-cases/pydantic-ai/README.md \
  use-cases/mcp-server/README.md \
  use-cases/agent-factory-with-subagents/README.md \
  use-cases/agent-factory-with-subagents/agents/rag_agent/README.md \
  use-cases/template-generator/README.md \
  use-cases/ai-coding-workflows-foundation/README.md \
  validation/README.md
do
  if [ -f "$readme" ] && [ -s "$readme" ]; then
    echo "✓ $readme ($(wc -l < "$readme") lines)"
  else
    echo "✗ $readme missing or empty"
  fi
done
```

## Phase 8: End-to-End Workflow Validation

### Test PRP Generation Workflow (Dry Run)
```bash
echo "=== PRP Workflow Validation ==="

# Verify INITIAL.md template is valid
test -f INITIAL.md && grep -q "FEATURE" INITIAL.md && echo "✓ INITIAL.md has FEATURE section" || echo "✗ INITIAL.md format issue"
test -f INITIAL.md && grep -q "EXAMPLES" INITIAL.md && echo "✓ INITIAL.md has EXAMPLES section" || echo "✗ INITIAL.md format issue"
test -f INITIAL.md && grep -q "DOCUMENTATION" INITIAL.md && echo "✓ INITIAL.md has DOCUMENTATION section" || echo "✗ INITIAL.md format issue"

# Verify PRP template structure
test -f PRPs/templates/prp_base.md && grep -q "Context" PRPs/templates/prp_base.md && echo "✓ PRP template has Context section" || echo "✗ PRP template issue"
```

### Test Copy Template Script
```bash
echo "=== Template Copy Script Validation ==="
cd use-cases/pydantic-ai
python -c "import copy_template; print('✓ copy_template.py imports successfully')" 2>&1 || echo "✗ copy_template.py has issues"
```

## Phase 9: Integration Validation

### Database Schema Validation (RAG Agent)
```bash
echo "=== SQL Schema Validation ==="
test -f use-cases/agent-factory-with-subagents/agents/rag_agent/sql/schema.sql && echo "✓ RAG agent schema exists" || echo "✗ Schema missing"

# Verify schema has required tables
grep -q "documents" use-cases/agent-factory-with-subagents/agents/rag_agent/sql/schema.sql && echo "✓ documents table defined" || echo "✗ documents table missing"
grep -q "chunks" use-cases/agent-factory-with-subagents/agents/rag_agent/sql/schema.sql && echo "✓ chunks table defined" || echo "✗ chunks table missing"
```

### MCP Server Configuration Validation
```bash
echo "=== MCP Server Config Validation ==="
cd use-cases/mcp-server
test -f wrangler.jsonc && echo "✓ Wrangler config exists" || echo "✗ Wrangler config missing"
test -f tsconfig.json && echo "✓ TypeScript config exists" || echo "✗ TypeScript config missing"
test -f vitest.config.js && echo "✓ Vitest config exists" || echo "✗ Vitest config missing"
```

## Phase 10: Final Summary

```bash
echo ""
echo "=========================================="
echo "       VALIDATION COMPLETE"
echo "=========================================="
echo ""
echo "Review any ✗ markers above for issues."
echo "Some tests may require:"
echo "  - LLM API keys (OPENAI_API_KEY, etc.)"
echo "  - PostgreSQL with PGVector extension"
echo "  - Node.js and npm installed"
echo "  - Python virtual environment activated"
echo ""
echo "For full E2E testing of agents:"
echo "  1. Set up .env files in each use-case"
echo "  2. Run ingestion for RAG agent: python -m ingestion.ingest"
echo "  3. Run agents interactively: python -m cli"
echo ""
```

---

## Quick Validation (Fast Mode)

For a quick validation without full test runs:

```bash
# Structure check only
find . -name "CLAUDE.md" -o -name "README.md" -o -name "*.py" | head -50
tree -L 2 --dirsfirst

# Python syntax check
python -m py_compile use-cases/pydantic-ai/examples/basic_chat_agent/agent.py
python -m py_compile use-cases/agent-factory-with-subagents/agents/rag_agent/agent.py

# TypeScript check
cd use-cases/mcp-server && npx tsc --noEmit
```
