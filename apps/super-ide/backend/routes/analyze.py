"""
Codebase Analyzer — Traycer-style codebase analysis and task plan generation.
Scans files, extracts structure, generates AI-powered task plans.
"""

import os
import logging
from pathlib import Path

import httpx
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

router = APIRouter()
logger = logging.getLogger("analyze")

OLLAMA_URL = os.getenv("OLLAMA_URL", "http://localhost:11434")
DEFAULT_MODEL = os.getenv("DEFAULT_MODEL", "llama3.3")


class AnalyzeRequest(BaseModel):
    path: str = "."
    includePatterns: list[str] = ["*.sol", "*.ts", "*.py", "*.rs", "*.js"]
    excludePatterns: list[str] = ["node_modules", ".git", "target", "__pycache__"]
    maxFiles: int = 100


class TaskPlanRequest(BaseModel):
    description: str
    codebaseContext: str = ""
    provider: str = "ollama"
    model: str = ""


@router.post("/codebase")
async def analyze_codebase(req: AnalyzeRequest):
    """Scan a directory and return file structure + key metrics."""
    root = Path(req.path).resolve()
    if not root.exists():
        raise HTTPException(404, f"Path not found: {req.path}")

    files = []
    total_lines = 0

    for pattern in req.includePatterns:
        for fp in root.rglob(pattern):
            # Check excludes
            if any(ex in str(fp) for ex in req.excludePatterns):
                continue
            if len(files) >= req.maxFiles:
                break

            try:
                content = fp.read_text(errors="ignore")
                lines = content.count("\n") + 1
                total_lines += lines
                files.append({
                    "path": str(fp.relative_to(root)),
                    "lines": lines,
                    "size": fp.stat().st_size,
                    "extension": fp.suffix,
                })
            except Exception:
                pass

    # Group by extension
    by_ext: dict[str, int] = {}
    for f in files:
        ext = f["extension"]
        by_ext[ext] = by_ext.get(ext, 0) + 1

    return {
        "root": str(root),
        "totalFiles": len(files),
        "totalLines": total_lines,
        "byExtension": by_ext,
        "files": sorted(files, key=lambda f: f["path"]),
    }


@router.post("/task-plan")
async def generate_task_plan(req: TaskPlanRequest):
    """Generate an AI-powered task plan given a description and optional codebase context."""
    model = req.model or DEFAULT_MODEL

    system = (
        "You are a senior software engineer and project planner. "
        "Given a task description (and optionally, codebase context), generate a detailed, "
        "actionable task plan. Include:\n"
        "1. Task title\n"
        "2. Estimated complexity (low/medium/high)\n"
        "3. Step-by-step plan with specific files to create/modify\n"
        "4. Testing strategy\n"
        "5. Potential risks and mitigations\n"
        "6. Dependencies\n\n"
        "Format as structured markdown with clear headings."
    )

    user_prompt = f"Task: {req.description}"
    if req.codebaseContext:
        user_prompt += f"\n\nCodebase context:\n{req.codebaseContext}"

    async def call_free(body: dict):
        async with httpx.AsyncClient(timeout=300) as client:
            resp = await client.post("http://localhost:8420/api/free/chat", json={"provider": req.provider, "body": body})
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
                resp.raise_for_status()
                data = resp.json()
                plan_content = data.get("message", {}).get("content", "")
                return {"plan": plan_content, "model": model}
        else:
            data = await call_free({
                "model": model,
                "messages": [
                    {"role": "system", "content": system},
                    {"role": "user", "content": user_prompt},
                ],
            })
            text = data.get("choices", [{}])[0].get("message", {}).get("content") or data.get("text") or str(data)
            return {"plan": text, "model": model}
    except httpx.HTTPError as e:
        raise HTTPException(502, f"LLM request failed: {e}")
