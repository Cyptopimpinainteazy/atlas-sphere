# 🔮 Atlas SuperIDE

A unified development environment combining the best of 9 powerful repos into one cohesive IDE.

## What's Inside

| Feature | Source Repo | Description |
|---------|------------|-------------|
| **⟠ Remix IDE** | ethereum/remix-desktop | Solidity compiler, deployer, debugger |
| **🤖 AI Chat** | OpenClaw/Ollama | Local LLM integration with streaming |
| **🎙️ NotebookLM** | gabrielchua/open-notebooklm | Document → conversation generation |
| **📋 Task Planning** | traycer-ai/internship | Codebase analysis + AI task plans |
| **🧠 Knowledge Base** | Chat Ralph | Persistent pitfalls/patterns/configs |
| **🎯 Context Eng** | dmarx/context-engineering-intro | PRP workflow for features |
| **🕸️ RAG Engine** | coleam00/mcp-crawl4ai-rag | Web crawling + vector search |
| **📊 Research** | coleam00/second-brain-research-dashboard | Generative UI dashboard |
| **⚡ Skills** | coleam00/second-brain-skills | Extensible skill framework |

> File Explorer now browses the actual workspace, lets you open/edit/save real files and create new ones. Large directories (node_modules, .git, etc.) are automatically hidden for performance.

> The Remix panel compiles Solidity from the active editor tab and writes the source to disk; if you have `solc` installed the backend will run a real compilation.

## Quick Start

```bash
cd apps/super-ide

# Option 1: Use the start script (recommended)
./start.sh

# Option 2: Manual startup
npm install
cd backend && python3 -m venv venv && source venv/bin/activate && pip install -r requirements.txt && cd ..
npm run start
```

**Prerequisites:**
- Node.js 18+
- Python 3.11+
- [Ollama](https://ollama.com) with at least one model pulled (optional if you use other free LLMs)

You can also connect to free LLM providers via environment variables (see full list at https://github.com/zebbern/no-cost-ai):

```bash
# OpenRouter (requires free API key)
export OPENROUTER_API_KEY=your_key_here

# Ollama Free public endpoint (no key required, defaults to https://api.ollama.ai)
export OLLAMA_FREE_URL=https://api.ollama.ai

# GPTOSS proxy (self‑hosted or remote)
export GPTOSS_URL=https://your-gptoss-instance/chat

# you can swap provider in Settings → AI Provider dropdown
```

**Looking for even more free models or workflows?**
- FREEGLM technique for accessing open‑source models: https://github.com/wangshengithub/FREEGLM
- Aichixia generative workflow and tooling: https://github.com/Takawell/Aichixia
- Right‑side chat interface (BoltDIY) that you can incorporate: https://github.com/Decentralised-AI/bolt.diy

These community resources complement the built‑in providers and can be plugged into the IDE via the `aiProvider` dropdown or by hosting your own proxy endpoints.

In the AI Chat panel select provider dropdown to pick `OpenRouter`, `OllamaFree`, or `GPTOSS` and enter the desired model name (e.g. `gpt-3.5-turbo`).
## Architecture

```
apps/super-ide/
├── src/                    # React + Vite + TypeScript frontend
│   ├── components/
│   │   ├── panels/         # 10 side panel components
│   │   │   ├── ExplorerPanel    # File tree
│   │   │   ├── SearchPanel      # Multi-mode search
│   │   │   ├── RemixPanel       # Solidity compile/deploy/debug
│   │   │   ├── AiChatPanel      # Ollama chat with streaming
│   │   │   ├── NotebookPanel    # Document → conversation
│   │   │   ├── RagPanel         # Crawl4AI + vector search
│   │   │   ├── KnowledgePanel   # Persistent knowledge base
│   │   │   ├── ResearchPanel    # Generative research dashboard
│   │   │   ├── SkillsPanel      # Extensible skills
│   │   │   └── SettingsPanel    # Configuration
│   │   ├── TitleBar         # Menu bar
│   │   ├── Sidebar          # Icon activity bar
│   │   ├── SidePanel        # Panel container
│   │   ├── EditorArea       # Monaco editor with tabs
│   │   ├── BottomPanel      # Terminal, output, problems
│   │   └── StatusBar        # Connection status
│   ├── store/
│   │   └── ideStore.ts      # Zustand state management
│   └── lib/
│       └── api.ts           # Unified API client
├── backend/                 # Python FastAPI backend
│   ├── main.py              # App entry + health check
│   └── routes/
│       ├── ollama_proxy.py  # Ollama streaming proxy
│       ├── rag.py           # Crawl4AI + vector search
│       ├── notebook.py      # NotebookLM generation
│       ├── analyze.py       # Codebase analysis + task plans
│       ├── knowledge.py     # Knowledge base CRUD
│       ├── research.py      # Research dashboard streaming
│       ├── remix.py         # Solidity compilation
│       └── skills.py        # Skill execution engine
├── start.sh                 # Start script
├── package.json
└── vite.config.ts
```

## Ports

| Service | Port | URL |
|---------|------|-----|
| Frontend | 3420 | http://localhost:3420 |
| Backend | 8420 | http://localhost:8420 |
| Ollama | 11434 | http://localhost:11434 |
| API Docs | 8420 | http://localhost:8420/docs |

## Tech Stack

**Frontend:** React 19 · Vite 6 · TypeScript 5.5 · Tailwind CSS · Monaco Editor · Zustand · react-resizable-panels

**Backend:** Python · FastAPI · httpx · Crawl4AI · BeautifulSoup · numpy · scikit-learn

**AI Runtime:** Ollama (local) with OpenClaw-style auto-discovery

## Key Features

### AI Chat (OpenClaw)
- Auto-discovers local Ollama models
- Streaming responses with abort support
- Three modes: Chat, Task Planner, Context Engineering

### RAG Engine (Crawl4AI)
- Crawl any URL and chunk into vectors
- Semantic, keyword, or hybrid search
- Ollama embeddings (`nomic-embed-text`)

### NotebookLM
- Convert URLs/text/PDFs into podcast conversations, summaries, or Q&A
- Tone selection: conversational, academic, technical

### Remix IDE
- Solidity compilation with version selector
- Contract deployment to JS VM, MetaMask, or custom RPC
- Gas optimization and debugging tools

### Knowledge Base (Ralph)
- Persistent storage of pitfalls, patterns, configs, references
- Full-text search with category and tag filtering
- Markdown content with CRUD operations

### Research Dashboard
- Streaming research analysis generation
- Cards categorized as insights, metrics, actions, warnings
- Quick templates for common research topics

### Skills Framework
- 8 built-in skills (contract scanner, gas optimizer, test generator, etc.)
- Extensible architecture for adding custom skills
- MCP client integration for external tool calling
