#!/usr/bin/env bash
# Atlas SuperIDE — Start Script
# Launches both frontend (Vite) and backend (FastAPI) servers.
set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"

echo "╔════════════════════════════════════════════╗"
echo "║  🔮 Atlas SuperIDE                         ║"
echo "║  Remix + OpenClaw + NotebookLM + RAG + KB  ║"
echo "╚════════════════════════════════════════════╝"
echo ""

# Check for Ollama
if command -v ollama &>/dev/null; then
    echo "✅ Ollama found: $(ollama --version 2>/dev/null || echo 'installed')"
    if curl -s http://localhost:11434/api/tags >/dev/null 2>&1; then
        MODEL_COUNT=$(curl -s http://localhost:11434/api/tags | python3 -c "import sys,json; print(len(json.load(sys.stdin).get('models',[])))" 2>/dev/null || echo "?")
        echo "✅ Ollama running — $MODEL_COUNT models available"
    else
        echo "⚠️  Ollama installed but not running. Start it: ollama serve"
    fi
else
    echo "⚠️  Ollama not found. Install from https://ollama.com"
fi
echo ""

# Setup backend
if [ ! -d "backend/venv" ]; then
    echo "📦 Setting up Python virtual environment..."
    python3 -m venv backend/venv
    source backend/venv/bin/activate
    pip install -r backend/requirements.txt
else
    source backend/venv/bin/activate
fi

# Copy .env if needed
if [ ! -f "backend/.env" ] && [ -f "backend/.env.example" ]; then
    cp backend/.env.example backend/.env
    echo "📋 Created backend/.env from .env.example"
fi

# Install npm dependencies
if [ ! -d "node_modules" ]; then
    echo "📦 Installing frontend dependencies..."
    npm install
fi

echo ""
echo "🚀 Starting Atlas SuperIDE..."
echo "   Frontend: http://localhost:3420"
echo "   Backend:  http://localhost:8420"
echo "   API docs: http://localhost:8420/docs"
echo ""

# Start both servers
npm run start
