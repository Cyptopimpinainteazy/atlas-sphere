"""
Knowledge Base — Ralph-style persistent knowledge entries.
Stores pitfalls, patterns, configs, and references as markdown files.
"""

import os
import json
import logging
from pathlib import Path
from datetime import datetime

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

router = APIRouter()
logger = logging.getLogger("knowledge")

KNOWLEDGE_DIR = Path(os.getenv("KNOWLEDGE_DIR", "./data/knowledge"))
KNOWLEDGE_DIR.mkdir(parents=True, exist_ok=True)


class KnowledgeEntry(BaseModel):
    id: str
    title: str
    content: str
    category: str = "pattern"  # pitfall, pattern, config, reference
    tags: list[str] = []
    createdAt: int = 0
    updatedAt: int = 0


@router.get("/list")
async def list_entries(category: str = ""):
    """List all knowledge entries, optionally filtered by category."""
    entries = []
    for fp in KNOWLEDGE_DIR.glob("*.json"):
        try:
            entry = json.loads(fp.read_text())
            if not isinstance(entry, dict):
                continue
            if category and entry.get("category") != category:
                continue
            entries.append(entry)
        except Exception:
            pass
    return sorted(entries, key=lambda e: e.get("updatedAt", 0), reverse=True)


@router.get("/get/{entry_id}")
async def get_entry(entry_id: str):
    """Get a single knowledge entry by ID."""
    fp = KNOWLEDGE_DIR / f"{entry_id}.json"
    if not fp.exists():
        raise HTTPException(404, "Entry not found")
    return json.loads(fp.read_text())


@router.post("/save")
async def save_entry(entry: KnowledgeEntry):
    """Create or update a knowledge entry."""
    if not entry.createdAt:
        entry.createdAt = int(datetime.now().timestamp() * 1000)
    entry.updatedAt = int(datetime.now().timestamp() * 1000)

    fp = KNOWLEDGE_DIR / f"{entry.id}.json"
    fp.write_text(json.dumps(entry.model_dump(), indent=2))
    logger.info(f"Saved knowledge entry: {entry.id} ({entry.title})")
    return {"status": "saved", "id": entry.id}


@router.delete("/delete/{entry_id}")
async def delete_entry(entry_id: str):
    """Delete a knowledge entry."""
    fp = KNOWLEDGE_DIR / f"{entry_id}.json"
    if fp.exists():
        fp.unlink()
        return {"status": "deleted", "id": entry_id}
    raise HTTPException(404, "Entry not found")


@router.get("/search")
async def search_entries(q: str = "", category: str = ""):
    """Full-text search across knowledge entries."""
    results = []
    query = q.lower()
    for fp in KNOWLEDGE_DIR.glob("*.json"):
        try:
            entry = json.loads(fp.read_text())
            if category and entry.get("category") != category:
                continue
            searchable = f"{entry.get('title', '')} {entry.get('content', '')} {' '.join(entry.get('tags', []))}"
            if query in searchable.lower():
                results.append(entry)
        except Exception:
            pass
    return results
