"""
NotebookLM — Convert documents/URLs into conversations/summaries using Ollama.
Inspired by Open NotebookLM Ollama (gabrielchua/open-notebooklm).
"""

import os
import logging
import json
import base64
import io

import httpx
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

router = APIRouter()
logger = logging.getLogger("notebook")

OLLAMA_URL = os.getenv("OLLAMA_URL", "http://localhost:11434")
DEFAULT_MODEL = os.getenv("DEFAULT_MODEL", "llama3.3")

# persistence directory for sessions
from pathlib import Path
NOTEBOOK_DIR = Path(os.getenv("NOTEBOOK_DIR", "./data/notebook"))
NOTEBOOK_DIR.mkdir(parents=True, exist_ok=True)


class NotebookRequest(BaseModel):
    sourceType: str = "url"  # url, text, pdf
    sourceUrl: str = ""
    sourceText: str = ""
    sourceFileName: str = ""
    sourceFileData: str = ""
    focusArea: str = ""
    tone: str = "conversational"  # conversational, academic, technical
    format: str = "podcast"  # podcast, summary, qa
    provider: str = "ollama"
    model: str = ""


SYSTEM_PROMPTS = {
    "podcast": (
        "You are a podcast script writer. Given the following source material, "
        "create an engaging podcast-style conversation between two hosts discussing the content. "
        "Host A introduces topics and asks questions. Host B provides detailed explanations. "
        "Keep it informative yet conversational. Use natural dialogue with personality."
    ),
    "summary": (
        "You are a technical writer. Given the following source material, "
        "create a comprehensive, well-structured summary. Use headers, bullet points, "
        "and clear explanations. Highlight key concepts, important details, and actionable insights."
    ),
    "qa": (
        "You are a study guide creator. Given the following source material, "
        "create a set of questions and detailed answers that cover the key concepts. "
        "Include both basic comprehension and advanced analysis questions."
    ),
}

TONE_MODS = {
    "conversational": " Use casual, approachable language with analogies.",
    "academic": " Use formal academic style with citations and precise terminology.",
    "technical": " Use technical language appropriate for practitioners. Include code examples where relevant.",
}


# persistence helpers and HTTP endpoints ------------------------------------------------

def _save_session(session: dict):
    fp = NOTEBOOK_DIR / f"{session['id']}.json"
    fp.write_text(json.dumps(session, indent=2))

@router.get("/list")
async def list_sessions():
    sessions = []
    for fp in NOTEBOOK_DIR.glob("*.json"):
        try:
            sessions.append(json.loads(fp.read_text()))
        except Exception:
            pass
    return sorted(sessions, key=lambda s: s.get("createdAt", 0), reverse=True)

@router.delete("/delete/{session_id}")
async def delete_session(session_id: str):
    fp = NOTEBOOK_DIR / f"{session_id}.json"
    if fp.exists():
        fp.unlink()
        return {"status": "deleted"}
    raise HTTPException(404, "Session not found")

@router.post("/save")
async def save_session_route(session: dict):
    # simply dump the provided session
    _save_session(session)
    return {"status": "saved", "id": session.get("id")}



@router.post("/generate")
async def generate_notebook(req: NotebookRequest):
    """Generate a notebook-style output from source content."""
    # Get source content
    source_content = ""
    title = ""

    if req.sourceType == "url" and req.sourceUrl:
        try:
            async with httpx.AsyncClient(timeout=30, follow_redirects=True) as client:
                resp = await client.get(req.sourceUrl)
                resp.raise_for_status()

            from bs4 import BeautifulSoup
            soup = BeautifulSoup(resp.text, "html.parser")
            for tag in soup(["script", "style", "nav", "footer"]):
                tag.decompose()
            source_content = soup.get_text(separator="\n", strip=True)[:8000]
            title = req.sourceUrl
        except Exception as e:
            raise HTTPException(400, f"Failed to fetch URL: {e}")

    elif req.sourceType == "text" and req.sourceText:
        source_content = req.sourceText[:8000]
        title = (req.sourceText[:50] + "...") if req.sourceText else "Notebook text"
    elif req.sourceType == "pdf" and req.sourceFileData:
        try:
            try:
                from pypdf import PdfReader
            except ImportError:
                from PyPDF2 import PdfReader  # type: ignore

            pdf_bytes = base64.b64decode(req.sourceFileData)
            reader = PdfReader(io.BytesIO(pdf_bytes))
            extracted_pages = []
            for page in reader.pages:
                extracted_pages.append(page.extract_text() or "")
            source_content = "\n".join(extracted_pages).strip()[:8000]
            title = req.sourceFileName or "PDF notebook"
            if not source_content:
                raise HTTPException(400, "The selected PDF did not contain readable text.")
        except HTTPException:
            raise
        except ImportError:
            raise HTTPException(500, "PDF extraction requires pypdf or PyPDF2 on the backend.")
        except Exception as e:
            raise HTTPException(400, f"Failed to parse PDF: {e}")
    else:
        raise HTTPException(400, "No source content provided.")

    # Build prompt

    import time
    system = SYSTEM_PROMPTS.get(req.format, SYSTEM_PROMPTS["summary"])
    system += TONE_MODS.get(req.tone, "")

    user_prompt = f"Source material:\n\n{source_content}"
    if req.focusArea:
        user_prompt += f"\n\nPlease focus especially on: {req.focusArea}"

    model = req.model or DEFAULT_MODEL

    # Helper to call local free proxy
    async def call_free(body: dict):
        async with httpx.AsyncClient(timeout=300) as client:
            resp = await client.post(
                "http://localhost:8420/api/free/chat",
                json={"provider": req.provider, "body": body},
            )
            resp.raise_for_status()
            return resp.json()

    try:
        if req.provider == "ollama":
            async with httpx.AsyncClient(timeout=300) as client:
                resp = await client.post(
                    f"{OLLAMA_URL}/api/chat",
                    json={
                        "model": model,
                        "messages": [
                            {"role": "system", "content": system},
                            {"role": "user", "content": user_prompt},
                        ],
                        "stream": False,
                    },
                )
                if resp.status_code == 404:
                    resp = await client.post(
                        f"{OLLAMA_URL}/api/generate",
                        json={
                            "model": model,
                            "prompt": f"{system}\n\n{user_prompt}",
                            "stream": False,
                        },
                    )

                resp.raise_for_status()
                data = resp.json()
                content = data.get("message", {}).get("content", "") or data.get("response", "")
                # persist session
                session = {
                    "id": f"nb-{int(time.time()*1000)}",
                    "title": title,
                    "sourceType": req.sourceType,
                    "sourceUrl": req.sourceUrl or req.sourceFileName,
                    "focusArea": req.focusArea,
                    "transcript": content,
                    "createdAt": int(time.time()*1000),
                }
                _save_session(session)
                return {"transcript": content, "content": content, "model": model}
        else:
            data = await call_free({
                "model": model,
                "messages": [
                    {"role": "system", "content": system},
                    {"role": "user", "content": user_prompt},
                ],
            })
            text = data.get("choices", [{}])[0].get("message", {}).get("content") or data.get("text") or str(data)
            session = {
                "id": f"nb-{int(time.time()*1000)}",
                "title": title,
                "sourceType": req.sourceType,
                "sourceUrl": req.sourceUrl or req.sourceFileName,
                "focusArea": req.focusArea,
                "transcript": text,
                "createdAt": int(time.time()*1000),
            }
            _save_session(session)
            return {"transcript": text, "content": text, "model": model}
    except httpx.HTTPError as e:
        raise HTTPException(502, f"LLM request failed: {e}")
