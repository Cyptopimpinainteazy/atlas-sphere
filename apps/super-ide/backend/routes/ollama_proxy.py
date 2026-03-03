"""Ollama proxy — forwards requests to the local Ollama instance with streaming support."""

import os
import httpx
from fastapi import APIRouter, Request
from fastapi.responses import StreamingResponse

router = APIRouter()

OLLAMA_URL = os.getenv("OLLAMA_URL", "http://localhost:11434")


@router.get("/tags")
async def list_models():
    """List available Ollama models."""
    async with httpx.AsyncClient(timeout=10) as client:
        resp = await client.get(f"{OLLAMA_URL}/api/tags")
        return resp.json()


@router.post("/show")
async def show_model(request: Request):
    """Show model details."""
    body = await request.json()
    async with httpx.AsyncClient(timeout=10) as client:
        resp = await client.post(f"{OLLAMA_URL}/api/show", json=body)
        return resp.json()


@router.post("/chat")
async def chat_stream(request: Request):
    """Proxy Ollama chat with streaming."""
    body = await request.json()

    async def stream():
        async with httpx.AsyncClient(timeout=300) as client:
            async with client.stream(
                "POST", f"{OLLAMA_URL}/api/chat", json=body
            ) as resp:
                async for line in resp.aiter_lines():
                    if line.strip():
                        yield line + "\n"

    return StreamingResponse(stream(), media_type="application/x-ndjson")


@router.post("/generate")
async def generate_stream(request: Request):
    """Proxy Ollama generate with streaming."""
    body = await request.json()

    async def stream():
        async with httpx.AsyncClient(timeout=300) as client:
            async with client.stream(
                "POST", f"{OLLAMA_URL}/api/generate", json=body
            ) as resp:
                async for line in resp.aiter_lines():
                    if line.strip():
                        yield line + "\n"

    return StreamingResponse(stream(), media_type="application/x-ndjson")
