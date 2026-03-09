"""
RAG Engine — Web crawling (Crawl4AI) + vector search.
Crawls URLs, chunks content, embeds with Ollama, and stores in SQLite.
"""

import os
import json
import hashlib
import logging
from pathlib import Path
from datetime import datetime
from typing import Optional

import httpx
import numpy as np
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

router = APIRouter()
logger = logging.getLogger("rag")

OLLAMA_URL = os.getenv("OLLAMA_URL", "http://localhost:11434")
EMBEDDING_MODEL = os.getenv("EMBEDDING_MODEL", "nomic-embed-text")
CHUNK_SIZE = int(os.getenv("CHUNK_SIZE", "512"))
CHUNK_OVERLAP = int(os.getenv("CHUNK_OVERLAP", "50"))
DATA_DIR = Path(os.getenv("CRAWL_DATA_DIR", "./data/crawl"))
DATA_DIR.mkdir(parents=True, exist_ok=True)

# In-memory store (replace with SQLite/Supabase for persistence)
_chunks: list[dict] = []
_sources: list[dict] = []

# load existing saved files on startup
for fp in DATA_DIR.glob("*.json"):
    try:
        data = json.loads(fp.read_text())
        if "source" in data:
            _sources.append(data["source"])
        if "chunks" in data and isinstance(data["chunks"], list):
            _chunks.extend(data["chunks"])
    except Exception:
        pass


class CrawlRequest(BaseModel):
    url: str
    depth: int = 1


class QueryRequest(BaseModel):
    query: str
    strategy: str = "hybrid"  # semantic, keyword, hybrid
    limit: int = 10


async def get_embedding(text: str) -> list[float]:
    """Get embedding vector from Ollama."""
    async with httpx.AsyncClient(timeout=30) as client:
        resp = await client.post(
            f"{OLLAMA_URL}/api/embed",
            json={"model": EMBEDDING_MODEL, "input": text},
        )
        if resp.status_code != 200:
            raise HTTPException(500, f"Embedding failed: {resp.text}")
        data = resp.json()
        return data.get("embeddings", [data.get("embedding", [])])[0]


def chunk_text(text: str, size: int = CHUNK_SIZE, overlap: int = CHUNK_OVERLAP) -> list[str]:
    """Split text into overlapping chunks."""
    words = text.split()
    chunks = []
    for i in range(0, len(words), size - overlap):
        chunk = " ".join(words[i : i + size])
        if chunk.strip():
            chunks.append(chunk)
    return chunks


def cosine_similarity(a: list[float], b: list[float]) -> float:
    a_np = np.array(a)
    b_np = np.array(b)
    return float(np.dot(a_np, b_np) / (np.linalg.norm(a_np) * np.linalg.norm(b_np) + 1e-10))


@router.post("/crawl")
async def crawl_url(req: CrawlRequest):
    """Crawl a URL, chunk content, and embed for RAG."""
    try:
        # Fetch page content
        async with httpx.AsyncClient(timeout=30, follow_redirects=True) as client:
            resp = await client.get(req.url)
            resp.raise_for_status()

        # Simple HTML text extraction
        from bs4 import BeautifulSoup
        soup = BeautifulSoup(resp.text, "html.parser")

        # Remove script/style
        for tag in soup(["script", "style", "nav", "footer", "header"]):
            tag.decompose()

        text = soup.get_text(separator="\n", strip=True)
        title = soup.title.string if soup.title else req.url

        # Chunk
        chunks = chunk_text(text)

        # Embed each chunk
        embedded_chunks = []
        for i, chunk in enumerate(chunks):
            try:
                embedding = await get_embedding(chunk)
                embedded_chunks.append({
                    "id": hashlib.md5(f"{req.url}:{i}".encode()).hexdigest(),
                    "content": chunk,
                    "embedding": embedding,
                    "source": req.url,
                    "chunk_index": i,
                })
            except Exception as e:
                logger.warning(f"Failed to embed chunk {i}: {e}")
                embedded_chunks.append({
                    "id": hashlib.md5(f"{req.url}:{i}".encode()).hexdigest(),
                    "content": chunk,
                    "embedding": [],
                    "source": req.url,
                    "chunk_index": i,
                })

        _chunks.extend(embedded_chunks)

        source = {
            "id": hashlib.md5(req.url.encode()).hexdigest(),
            "url": req.url,
            "title": title,
            "chunkCount": len(chunks),
            "crawledAt": int(datetime.now().timestamp() * 1000),
            "status": "ready",
        }
        _sources.append(source)

        # Save to disk (include chunks for persistence)
        save_path = DATA_DIR / f"{source['id']}.json"
        save_path.write_text(
            json.dumps({"source": source, "chunks": embedded_chunks}, indent=2)
        )

        return {"title": title, "chunks": len(chunks), "source_id": source["id"]}

    except httpx.HTTPError as e:
        raise HTTPException(400, f"Failed to crawl URL: {e}")


@router.post("/query")
async def query_rag(req: QueryRequest):
    """Search crawled content using semantic, keyword, or hybrid strategy."""
    if not _chunks:
        return {"results": [], "message": "No content crawled yet."}

    results = []

    if req.strategy in ("semantic", "hybrid"):
        try:
            query_embedding = await get_embedding(req.query)
            for chunk in _chunks:
                if chunk.get("embedding"):
                    score = cosine_similarity(query_embedding, chunk["embedding"])
                    results.append({
                        "content": chunk["content"],
                        "source": chunk["source"],
                        "score": score,
                        "method": "semantic",
                    })
        except Exception as e:
            logger.warning(f"Semantic search failed: {e}")

    if req.strategy in ("keyword", "hybrid"):
        query_terms = set(req.query.lower().split())
        for chunk in _chunks:
            content_lower = chunk["content"].lower()
            matches = sum(1 for t in query_terms if t in content_lower)
            if matches > 0:
                score = matches / len(query_terms)
                results.append({
                    "content": chunk["content"],
                    "source": chunk["source"],
                    "score": score,
                    "method": "keyword",
                })

    # Deduplicate and sort
    seen = set()
    deduped = []
    for r in sorted(results, key=lambda x: x["score"], reverse=True):
        key = r["content"][:100]
        if key not in seen:
            seen.add(key)
            deduped.append(r)
        if len(deduped) >= req.limit:
            break

    return deduped


@router.get("/sources")
async def list_sources():
    """List all crawled sources."""
    return _sources
