import os
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from typing import List, Dict, Any
import stat

router = APIRouter()

# workspace root defaults to the repository root
ROOT_DIR = os.getenv(
    "WORKSPACE_ROOT",
    os.path.abspath(os.path.join(os.path.dirname(__file__), "../../../..")),
)
SKIP_DIRS = {"node_modules", ".git", "dist", "build", "target", "__pycache__", ".venv", "venv"}
VISIBLE_DOT_DIRS = {".cargo", ".github", ".agents", ".githooks", ".ralph"}
MAX_SEARCH_FILE_SIZE = 1_000_000

class FileEntry(BaseModel):
    name: str
    path: str
    type: str  # "file" or "dir"
    children: List[Any] = []

class SavePayload(BaseModel):
    path: str
    content: str


def _normalize(rel_path: str) -> str:
    # prevent directory traversal outside root
    full = os.path.normpath(os.path.join(ROOT_DIR, rel_path))
    if not full.startswith(ROOT_DIR):
        raise HTTPException(status_code=400, detail="Invalid path")
    return full


def _build_tree(rel_path: str = ".") -> List[Dict[str, Any]]:
    full = _normalize(rel_path)
    items: List[Dict[str, Any]] = []
    try:
        for entry in sorted(os.scandir(full), key=lambda e: (not e.is_dir(), e.name.lower())):
            # skip unwanted directories
            if entry.name in SKIP_DIRS:
                continue
            if entry.name.startswith(".") and entry.name not in VISIBLE_DOT_DIRS:
                continue
            rel = os.path.relpath(entry.path, ROOT_DIR)
            node = {
                "name": entry.name,
                "path": rel,
                "type": "dir" if entry.is_dir() else "file",
            }
            if entry.is_dir():
                node["children"] = _build_tree(rel)
            items.append(node)
    except FileNotFoundError:
        pass
    return items


def _iter_files(rel_path: str = "."):
    root = _normalize(rel_path)
    for current_root, dirnames, filenames in os.walk(root):
        dirnames[:] = [
            d
            for d in dirnames
            if d not in SKIP_DIRS and (not d.startswith(".") or d in VISIBLE_DOT_DIRS)
        ]
        for filename in filenames:
            full_path = os.path.join(current_root, filename)
            if not os.path.isfile(full_path):
                continue
            if os.path.getsize(full_path) > MAX_SEARCH_FILE_SIZE:
                continue
            yield full_path


def _normalize_terms(query: str) -> list[str]:
    return [term for term in query.lower().split() if term]


def _path_match_score(rel_path: str, name: str, terms: list[str]) -> int:
    rel_lower = rel_path.lower()
    name_lower = name.lower()
    score = 0
    for term in terms:
        if term in name_lower:
            score += 6
            if name_lower.startswith(term):
                score += 2
        if term in rel_lower:
            score += 2
    return score


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


@router.get("/files/tree")
def files_tree(path: str = "."):
    """Return a nested directory tree starting at path."""
    return {"tree": _build_tree(path)}


@router.get("/files")
def list_files(path: str = "."):
    """Return flat list of files/directories in the given path."""
    full = _normalize(path)
    items: List[Dict[str, Any]] = []
    try:
        for entry in sorted(os.scandir(full), key=lambda e: (not e.is_dir(), e.name.lower())):
            items.append({
                "name": entry.name,
                "path": os.path.relpath(entry.path, ROOT_DIR),
                "type": "dir" if entry.is_dir() else "file",
            })
    except FileNotFoundError:
        raise HTTPException(status_code=404, detail="Path not found")
    return {"files": items}


@router.get("/search/files")
def search_files(q: str, path: str = ".", limit: int = 50):
    """Search file paths within the workspace."""
    terms = _normalize_terms(q)
    if not terms:
        return {"results": []}

    max_results = max(1, min(limit, 200))
    results: List[Dict[str, Any]] = []

    for full_path in _iter_files(path):
        rel_path = os.path.relpath(full_path, ROOT_DIR)
        name = os.path.basename(full_path)
        if not all(term in rel_path.lower() for term in terms):
            continue
        results.append({
            "name": name,
            "path": rel_path,
            "type": "file",
            "score": _path_match_score(rel_path, name, terms),
        })

    results.sort(key=lambda item: (-item["score"], len(item["path"]), item["path"]))
    return {"results": results[:max_results]}


@router.get("/search/codebase")
def search_codebase(q: str, path: str = ".", limit: int = 25):
    """Search file contents and return best matching lines."""
    terms = _normalize_terms(q)
    if not terms:
        return {"results": []}

    max_results = max(1, min(limit, 100))
    results: List[Dict[str, Any]] = []

    for full_path in _iter_files(path):
        rel_path = os.path.relpath(full_path, ROOT_DIR)
        try:
            with open(full_path, "r", encoding="utf-8") as handle:
                lines = handle.readlines()
        except (UnicodeDecodeError, OSError):
            continue

        best_match: Dict[str, Any] | None = None
        for line_number, line in enumerate(lines, start=1):
            if not any(term in line.lower() for term in terms):
                continue

            snippet = line.strip()
            if not snippet:
                continue

            score = _line_match_score(line, rel_path, terms)
            candidate = {
                "name": os.path.basename(full_path),
                "path": rel_path,
                "line": line_number,
                "snippet": snippet[:240],
                "score": score,
            }
            if best_match is None or candidate["score"] > best_match["score"]:
                best_match = candidate

        if best_match is not None:
            results.append(best_match)

    results.sort(key=lambda item: (-item["score"], item["path"], item["line"]))
    return {"results": results[:max_results]}


@router.get("/file")
def get_file(path: str):
    full = _normalize(path)
    if not os.path.exists(full) or not os.path.isfile(full):
        raise HTTPException(status_code=404, detail="File not found")
    try:
        with open(full, "r", encoding="utf-8") as f:
            content = f.read()
    except UnicodeDecodeError:
        # binary file, return placeholder
        content = "<binary>"
    return {"path": path, "content": content}


@router.post("/file")
def save_file(payload: SavePayload):
    full = _normalize(payload.path)
    dirpath = os.path.dirname(full)
    os.makedirs(dirpath, exist_ok=True)
    with open(full, "w", encoding="utf-8") as f:
        f.write(payload.content)
    return {"status": "ok", "path": payload.path}


@router.get("/git-hook-status")
def check_git_hook_status():
    """Check if pre-commit hook is installed."""
    hook_path = os.path.join(ROOT_DIR, ".git", "hooks", "pre-commit")
    return {"installed": os.path.exists(hook_path) and os.path.isfile(hook_path)}


class GitHookPayload(BaseModel):
    hook: str  # 'pre-commit', 'pre-push', etc.
    script: str


@router.post("/install-git-hook")
def install_git_hook(payload: GitHookPayload):
    """Install a git hook script."""
    hook_path = os.path.join(ROOT_DIR, ".git", "hooks", payload.hook)
    hook_dir = os.path.dirname(hook_path)
    
    os.makedirs(hook_dir, exist_ok=True)
    
    try:
        # Write the hook script
        with open(hook_path, "w", encoding="utf-8") as f:
            f.write(payload.script)
        
        # Make it executable (Unix/Linux/macOS)
        st = os.stat(hook_path)
        os.chmod(hook_path, st.st_mode | stat.S_IEXEC | stat.S_IXUSR | stat.S_IXGRP | stat.S_IXOTH)
        
        return {
            "status": "success",
            "message": f"✅ Git hook '{payload.hook}' installed",
            "path": hook_path
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to install hook: {str(e)}")
