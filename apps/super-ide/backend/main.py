"""
Atlas SuperIDE — FastAPI Backend
Combines: Ollama proxy, RAG engine (Crawl4AI), NotebookLM, Codebase Analyzer,
Knowledge Base, Research Dashboard, Remix compiler, Skills framework.
"""

import os
import json
import logging
from pathlib import Path
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from dotenv import load_dotenv

load_dotenv()

from routes import rag, notebook, analyze, knowledge, research, remix, skills, ollama_proxy, files, free_providers, testing, security

logger = logging.getLogger("atlas-superide")
logging.basicConfig(level=logging.INFO)

DATA_DIR = Path(os.getenv("KNOWLEDGE_DIR", "./data"))
DATA_DIR.mkdir(parents=True, exist_ok=True)
(DATA_DIR / "knowledge").mkdir(exist_ok=True)
(DATA_DIR / "crawl").mkdir(exist_ok=True)
(DATA_DIR / "research").mkdir(exist_ok=True)


@asynccontextmanager
async def lifespan(app: FastAPI):
    logger.info("🔮 Atlas SuperIDE backend starting...")
    logger.info(f"   Ollama URL: {os.getenv('OLLAMA_URL', 'http://localhost:11434')}")
    logger.info(f"   Data dir: {DATA_DIR.resolve()}")
    yield
    logger.info("Atlas SuperIDE backend shutting down.")


app = FastAPI(
    title="Atlas SuperIDE Backend",
    version="0.1.0",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Mount route groups
app.include_router(ollama_proxy.router, prefix="/api/ollama", tags=["ollama"])
app.include_router(rag.router, prefix="/api/rag", tags=["rag"])
app.include_router(notebook.router, prefix="/api/notebook", tags=["notebook"])
app.include_router(analyze.router, prefix="/api/analyze", tags=["analyze"])
app.include_router(knowledge.router, prefix="/api/knowledge", tags=["knowledge"])
app.include_router(research.router, prefix="/api/research", tags=["research"])
app.include_router(remix.router, prefix="/api/remix", tags=["remix"])
app.include_router(skills.router, prefix="/api/skills", tags=["skills"])
app.include_router(files.router, prefix="/api", tags=["files"])
app.include_router(free_providers.router, prefix="/api/free", tags=["free"])
app.include_router(testing.router, prefix="/api/testing", tags=["testing"])
app.include_router(security.router, prefix="/api/security", tags=["security"])


@app.get("/api/health")
async def health():
    """Health check — returns backend and Ollama status."""
    import httpx
    ollama_url = os.getenv("OLLAMA_URL", "http://localhost:11434")
    ollama_ok = False
    models = []
    try:
        async with httpx.AsyncClient(timeout=3) as client:
            resp = await client.get(f"{ollama_url}/api/tags")
            if resp.status_code == 200:
                ollama_ok = True
                data = resp.json()
                models = [m["name"] for m in data.get("models", [])]
    except Exception:
        pass

    return {
        "status": "ok",
        "backend": "running",
        "ollama": {
            "connected": ollama_ok,
            "url": ollama_url,
            "models": models,
        },
    }


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(
        "main:app",
        host=os.getenv("BACKEND_HOST", "0.0.0.0"),
        port=int(os.getenv("BACKEND_PORT", "8420")),
        reload=True,
    )
