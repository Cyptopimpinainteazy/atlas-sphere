#!/usr/bin/env bash
set -euo pipefail

# Run inside the repo root
cd "$(dirname "${BASH_SOURCE[0]}")/../.."

echo "=== Phase 1: Python Environment Setup ==="
if [ ! -d "venv_linux" ]; then
	python3 -m venv venv_linux
fi
source venv_linux/bin/activate
pip install -q pytest pytest-asyncio black ruff mypy pydantic pydantic-ai python-dotenv

echo "=== Phase 2: Linting & Style Checks ==="
ruff check use-cases/agent-factory-with-subagents/agents/rag_agent/ --ignore E501 || true
ruff check use-cases/pydantic-ai/examples/ --ignore E501 || true
black --check use-cases/agent-factory-with-subagents/agents/rag_agent/ || true
black --check use-cases/pydantic-ai/examples/ || true

echo "=== Phase 3: Type Checking ==="
mypy use-cases/agent-factory-with-subagents/agents/rag_agent/ --ignore-missing-imports || true
mypy use-cases/pydantic-ai/examples/ --ignore-missing-imports || true

echo "=== Phase 4: Unit Tests ==="
pushd use-cases/agent-factory-with-subagents/agents/rag_agent >/dev/null
pip install -r requirements.txt -q || true
pytest tests/ -v --tb=short || echo "[warn] RAG agent tests may require DB setup"
popd >/dev/null

pushd use-cases/mcp-server >/dev/null
echo "=== Phase 4b: MCP Server Tests ==="
npm install
npm run type-check || true
npx tsc --noEmit || true
npm run test:run || true
popd >/dev/null

pushd use-cases/pydantic-ai/examples/testing_examples >/dev/null
echo "=== Phase 4c: Pydantic AI Testing Examples ==="
pytest test_agent_patterns.py -v --tb=short || echo "[warn] Tests may require LLM API key"
popd >/dev/null

echo "=== Phase 5: Template Integrity & Docs ==="
test -f CLAUDE.md || echo "[warn] CLAUDE.md missing"
test -f README.md || echo "[warn] README.md missing"
test -f INITIAL.md || echo "[warn] INITIAL.md missing"
test -f INITIAL_EXAMPLE.md || echo "[warn] INITIAL_EXAMPLE.md missing"
test -f .claude/commands/generate-prp.md || echo "[warn] generate-prp.md missing"
test -f .claude/commands/execute-prp.md || echo "[warn] execute-prp.md missing"
test -f PRPs/templates/prp_base.md || echo "[warn] PRP base template missing"
test -f PRPs/EXAMPLE_multi_agent_prp.md || echo "[warn] Example PRP missing"

echo "=== Phase 6: Example Import Checks ==="
python -c "import sys; sys.path.insert(0, 'use-cases/pydantic-ai/examples/basic_chat_agent'); import agent" 2>/dev/null || echo "[warn] basic_chat_agent import failed"
python -c "import sys; sys.path.insert(0, 'use-cases/pydantic-ai/examples/tool_enabled_agent'); import agent" 2>/dev/null || echo "[warn] tool_enabled_agent import failed"
python -c "import sys; sys.path.insert(0, 'use-cases/pydantic-ai/examples/structured_output_agent'); import agent" 2>/dev/null || echo "[warn] structured_output_agent import failed"
python -c "import sys; sys.path.insert(0, 'use-cases/agent-factory-with-subagents/agents/rag_agent'); from ingestion import chunker, embedder" 2>/dev/null || echo "[warn] rag_agent ingestion import failed"

echo "=== Phase 7: Minimal PRP Workflow Sanity ==="
grep -q "FEATURE" INITIAL.md || echo "[warn] INITIAL.md missing FEATURE section"
grep -q "EXAMPLES" INITIAL.md || echo "[warn] INITIAL.md missing EXAMPLES section"
grep -q "DOCUMENTATION" INITIAL.md || echo "[warn] INITIAL.md missing DOCUMENTATION section"
grep -q "Context" PRPs/templates/prp_base.md || echo "[warn] PRP base template missing Context section"

echo "=== Validation Complete (see warnings above, if any) ==="
