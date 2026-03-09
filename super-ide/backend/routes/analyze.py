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
ROOT_DIR = os.getenv(
    "WORKSPACE_ROOT",
    os.path.abspath(os.path.join(os.path.dirname(__file__), "../../../..")),
)
SKIP_DIRS = {"node_modules", ".git", "dist", "build", "target", "__pycache__", ".venv", "venv"}
VISIBLE_DOT_DIRS = {".cargo", ".github", ".agents", ".githooks", ".ralph"}
MAX_SEARCH_FILE_SIZE = 1_000_000


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


class WorkspaceContextRequest(BaseModel):
    query: str
    workspaceRoot: str = "."
    activeFilePath: str = ""
    activeFileContent: str = ""
    openTabs: list[str] = []
    maxMatches: int = 4
    maxFiles: int = 3
    maxCharsPerFile: int = 8000


class EditFile(BaseModel):
    path: str
    content: str


class ApplyEditsRequest(BaseModel):
    files: list[EditFile]


def _normalize_workspace_path(rel_path: str) -> Path:
    full = os.path.normpath(os.path.join(ROOT_DIR, rel_path or "."))
    if not full.startswith(ROOT_DIR):
        raise HTTPException(status_code=400, detail="Invalid workspace path")
    return Path(full)


def _iter_workspace_files(rel_path: str = "."):
    root = _normalize_workspace_path(rel_path)
    for current_root, dirnames, filenames in os.walk(root):
        dirnames[:] = [
            d
            for d in dirnames
            if d not in SKIP_DIRS and (not d.startswith(".") or d in VISIBLE_DOT_DIRS)
        ]
        for filename in filenames:
            full_path = Path(current_root) / filename
            if not full_path.is_file():
                continue
            try:
                if full_path.stat().st_size > MAX_SEARCH_FILE_SIZE:
                    continue
            except OSError:
                continue
            yield full_path


def _normalize_terms(query: str) -> list[str]:
    return [term for term in query.lower().split() if term]


def _line_match_score(line: str, rel_path: str, terms: list[str]) -> int:
    line_lower = line.lower()
    rel_lower = rel_path.lower()
    score = 0
    for term in terms:
        if term in line_lower:
            score += 10
        if term in rel_lower:
            score += 2
    return score


def _truncate_text(content: str, max_chars: int) -> str:
    if len(content) <= max_chars:
        return content
    return f"{content[:max_chars]}\n\n... [truncated {len(content) - max_chars} chars]"


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


@router.post("/workspace-context")
async def build_workspace_context(req: WorkspaceContextRequest):
    terms = _normalize_terms(req.query)
    max_matches = max(1, min(req.maxMatches, 10))
    max_files = max(1, min(req.maxFiles, 6))
    max_chars = max(500, min(req.maxCharsPerFile, 20_000))

    sections: list[str] = [
        f"Workspace root: {req.workspaceRoot}",
        f"Open tabs: {', '.join(req.openTabs) if req.openTabs else 'none'}",
    ]

    if req.activeFilePath and req.activeFileContent:
        sections.append(
            "\n".join(
                [
                    f"Active file: {req.activeFilePath}",
                    "```",
                    _truncate_text(req.activeFileContent, max_chars),
                    "```",
                ]
            )
        )

    matches: list[dict] = []
    files: list[dict] = []

    if terms:
        for full_path in _iter_workspace_files(req.workspaceRoot):
            rel_path = os.path.relpath(full_path, ROOT_DIR)
            try:
                content = full_path.read_text(encoding="utf-8")
            except (UnicodeDecodeError, OSError):
                continue

            best_match = None
            for line_number, line in enumerate(content.splitlines(), start=1):
                if not any(term in line.lower() for term in terms):
                    continue
                snippet = line.strip()
                if not snippet:
                    continue
                candidate = {
                    "path": rel_path,
                    "line": line_number,
                    "snippet": snippet[:240],
                    "score": _line_match_score(line, rel_path, terms),
                }
                if best_match is None or candidate["score"] > best_match["score"]:
                    best_match = candidate

            if best_match is not None:
                matches.append(best_match)

        matches.sort(key=lambda item: (-item["score"], item["path"], item["line"]))
        matches = matches[:max_matches]

        if matches:
            sections.append(
                "\n".join(
                    [
                        "Relevant matches:",
                        *[
                            f"- {match['path']}:{match['line']} — {match['snippet']}"
                            for match in matches
                        ],
                    ]
                )
            )

        seen_paths: set[str] = set()
        for match in matches:
            path = match["path"]
            if path == req.activeFilePath or path in seen_paths:
                continue
            seen_paths.add(path)
            try:
                full = _normalize_workspace_path(path)
                content = full.read_text(encoding="utf-8")
            except (UnicodeDecodeError, OSError, HTTPException):
                continue
            files.append({"path": path, "content": _truncate_text(content, max_chars)})
            sections.append(
                "\n".join(
                    [
                        f"Relevant file: {path}",
                        "```",
                        files[-1]["content"],
                        "```",
                    ]
                )
            )
            if len(files) >= max_files:
                break

    return {
        "context": "\n\n".join(sections),
        "matches": matches,
        "files": files,
    }


@router.post("/apply-edits")
async def apply_workspace_edits(req: ApplyEditsRequest):
    if not req.files:
        raise HTTPException(status_code=400, detail="No files to apply")

    applied: list[dict] = []
    for file in req.files:
        full = _normalize_workspace_path(file.path)
        full.parent.mkdir(parents=True, exist_ok=True)
        full.write_text(file.content, encoding="utf-8")
        applied.append({"path": file.path, "bytes": len(file.content.encode("utf-8"))})

    return {"status": "ok", "applied": applied}
