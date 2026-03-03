"""
Research Dashboard — Streaming research generation using Ollama.
Inspired by Second Brain research-dashboard generative UI.
"""

import os
import json
import logging

import httpx
from fastapi import APIRouter
from fastapi.responses import StreamingResponse
from pydantic import BaseModel

router = APIRouter()
logger = logging.getLogger("research")

OLLAMA_URL = os.getenv("OLLAMA_URL", "http://localhost:11434")
DEFAULT_MODEL = os.getenv("DEFAULT_MODEL", "llama3.3")

from pathlib import Path
RESEARCH_DIR = Path(os.getenv("RESEARCH_DIR", "./data/research"))
RESEARCH_DIR.mkdir(parents=True, exist_ok=True)


class ResearchRequest(BaseModel):
    prompt: str
    provider: str = "ollama"
    model: str = ""


@router.post("/generate")
async def generate_research(req: ResearchRequest):
    """Generate research analysis with SSE streaming."""
    model = req.model or DEFAULT_MODEL

    async def call_free(body: dict):
        async with httpx.AsyncClient(timeout=300) as client:
            resp = await client.post("http://localhost:8420/api/free/chat", json={"provider": req.provider, "body": body})
            resp.raise_for_status()
            return resp.json()

    import time

    system = (
        "You are a senior research analyst. Given a research topic, provide a comprehensive analysis. "
        "Structure your response with clear sections:\n"
        "## Key Insights\n"
        "## Metrics & Data Points\n"
        "## Risks & Warnings\n"
        "## Recommended Actions\n\n"
        "Be specific, data-driven, and actionable. Use bullet points and clear formatting."
    )

    async def sse_stream():
        try:
            if req.provider == "ollama":
                async with httpx.AsyncClient(timeout=300) as client:
                    async with client.stream(
                        "POST",
                        f"{OLLAMA_URL}/api/chat",
                        json={
                            "model": model,
                            "messages": [
                                {"role": "system", "content": system},
                                {"role": "user", "content": req.prompt},
                            ],
                            "stream": True,
                        },
                    ) as resp:
                        async for line in resp.aiter_lines():
                            if line.strip():
                                try:
                                    data = json.loads(line)
                                    content = data.get("message", {}).get("content", "")
                                    if content:
                                        yield f"data: {json.dumps({'content': content})}\n\n"
                                except json.JSONDecodeError:
                                    pass
                yield "data: [DONE]\n\n"
            else:
                # non-streaming fallback: simulate chunked output
                data = await call_free({
                    "model": model,
                    "messages": [
                        {"role": "system", "content": system},
                        {"role": "user", "content": req.prompt},
                    ],
                })
                text = data.get("choices", [{}])[0].get("message", {}).get("content") or data.get("text") or str(data)
                # break into sentences for streaming-like experience
                chunks = text.replace("\n", " ").split(". ")
                for chunk in chunks:
                    if chunk.strip():
                        yield f"data: {json.dumps({'content': chunk + '.'})}\n\n"
                yield "data: [DONE]\n\n"
        except Exception as e:
            yield f"data: {json.dumps({'error': str(e)})}\n\n"

    return StreamingResponse(sse_stream(), media_type="text/event-stream")

# persistence helpers ----------------------------------------------------------

def _save_card(card: dict):
    fp = RESEARCH_DIR / f"{card['id']}.json"
    fp.write_text(json.dumps(card, indent=2))

@router.get("/list")
async def list_cards():
    cards = []
    for fp in RESEARCH_DIR.glob("*.json"):
        try:
            cards.append(json.loads(fp.read_text()))
        except Exception:
            pass
    return sorted(cards, key=lambda c: c.get("createdAt", 0), reverse=True)

@router.post("/save")
async def save_card(card: dict):
    if not card.get("createdAt"):
        card["createdAt"] = int(time.time() * 1000)
    _save_card(card)
    return {"status": "saved", "id": card.get("id")}

@router.delete("/delete/{card_id}")
async def delete_card(card_id: str):
    fp = RESEARCH_DIR / f"{card_id}.json"
    if fp.exists():
        fp.unlink()
        return {"status": "deleted"}
    raise HTTPException(404, "Card not found")
