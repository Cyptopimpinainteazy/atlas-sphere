"""Proxy to free LLM providers: OpenRouter, OllamaFreeAPI, GPTOSS"""

import os
import httpx
from fastapi import APIRouter, HTTPException, Request

router = APIRouter()

OPENROUTER_KEY = os.getenv("OPENROUTER_API_KEY", "")
OLLAMA_FREE_URL = os.getenv("OLLAMA_FREE_URL", "https://api.ollama.ai")
GPTOSS_URL = os.getenv("GPTOSS_URL", "")

@router.post("/chat")
async def free_chat(request: Request):
    data = await request.json()
    provider = data.get("provider")
    if provider == "openrouter":
        if not OPENROUTER_KEY:
            raise HTTPException(500, "OPENROUTER_API_KEY not configured")
        # forward to openrouter chat
        headers = {"Authorization": f"Bearer {OPENROUTER_KEY}"}
        async with httpx.AsyncClient(timeout=300) as client:
            resp = await client.post(
                "https://api.openrouter.ai/v1/chat/completions",
                json=data.get("body", {}),
                headers=headers,
            )
            return resp.json()

    elif provider == "ollamafree":
        # assume free ollama compatible endpoint
        url = OLLAMA_FREE_URL.rstrip("/") + "/api/chat"
        async with httpx.AsyncClient(timeout=300) as client:
            resp = await client.post(url, json=data.get("body", {}))
            return resp.json()

    elif provider == "gptoss":
        if not GPTOSS_URL:
            raise HTTPException(500, "GPTOSS_URL not configured")
        async with httpx.AsyncClient(timeout=300) as client:
            resp = await client.post(GPTOSS_URL.rstrip("/") + "/chat", json=data.get("body", {}))
            return resp.json()

    else:
        raise HTTPException(400, f"Unknown provider {provider}")
