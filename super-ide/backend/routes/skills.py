"""
Skills Framework — Extensible skill execution engine.
Inspired by Second Brain Skills (coleam00/second-brain-skills).
"""

import json
import logging
import os
import time
from pathlib import Path

import httpx
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from . import mcp as mcp_routes

router = APIRouter()
logger = logging.getLogger("skills")

OLLAMA_URL = os.getenv("OLLAMA_URL", "http://localhost:11434")
DEFAULT_MODEL = os.getenv("DEFAULT_MODEL", "")
REPO_ROOT = Path(__file__).resolve().parents[4]
LOCAL_SKILLS_DIR = REPO_ROOT / ".agents" / "skills"

SKILLS_HISTORY_DIR = Path(os.getenv("SKILLS_HISTORY_DIR", "./data/skills_history"))
SKILLS_HISTORY_DIR.mkdir(parents=True, exist_ok=True)


class SkillExecRequest(BaseModel):
    skill_id: str
    inputs: dict = {}
    provider: str = "ollama"
    model: str = ""


BUILTIN_SKILLS = [
    {
        "id": "mcp-client",
        "name": "MCP Client",
        "description": "Connect to MCP servers and call tools without loading large tool schemas into the active context.",
        "category": "mcp",
        "inputs": [
            {"name": "server", "type": "string", "required": True, "description": "MCP server URL or configured name"},
            {"name": "tool", "type": "string", "required": True, "description": "Tool name to call"},
            {"name": "params", "type": "json", "required": False, "description": "JSON arguments for the tool"},
        ],
        "triggers": ["connect to Zapier", "use MCP server", "call Zapier action"],
        "notes": "Backend execution calls configured MCP servers via streamable HTTP or stdio.",
        "recommendedMode": "context-eng",
    },
    {
        "id": "sop-creator",
        "name": "SOP Creator",
        "description": "Generate concise, scannable SOPs, runbooks, and operational procedures from a task description.",
        "category": "docs",
        "inputs": [
            {"name": "task", "type": "string", "required": True, "description": "Task or workflow to document"},
            {"name": "audience", "type": "string", "required": False, "description": "Target audience"},
        ],
        "triggers": ["create a runbook", "document this process", "write an SOP"],
        "recommendedMode": "chat",
    },
    {
        "id": "skill-creator",
        "name": "Skill Creator",
        "description": "Design new skills with concise instructions, scoped references, and progressive disclosure.",
        "category": "meta",
        "inputs": [
            {"name": "description", "type": "string", "required": True, "description": "What the skill should do"},
            {"name": "language", "type": "string", "required": False, "description": "Implementation language"},
        ],
        "triggers": ["create a new skill", "update this skill", "extend super-ide"],
        "recommendedMode": "context-eng",
    },
    {
        "id": "contract-scanner",
        "name": "Contract Scanner",
        "description": "Scan Solidity contracts for common vulnerabilities and security review targets.",
        "category": "security",
        "inputs": [
            {"name": "source", "type": "text", "required": True, "description": "Solidity source code"},
            {"name": "severity", "type": "string", "required": False, "description": "Minimum severity filter"},
        ],
        "recommendedMode": "task-plan",
    },
    {
        "id": "gas-optimizer",
        "name": "Gas Optimizer",
        "description": "Analyze Solidity contracts for gas optimization opportunities.",
        "category": "optimization",
        "inputs": [
            {"name": "source", "type": "text", "required": True, "description": "Solidity source code"},
        ],
        "recommendedMode": "task-plan",
    },
    {
        "id": "abi-generator",
        "name": "ABI Generator",
        "description": "Generate TypeScript wrappers and hooks from a contract ABI.",
        "category": "codegen",
        "inputs": [
            {"name": "abi", "type": "json", "required": True, "description": "Contract ABI JSON"},
            {"name": "contractName", "type": "string", "required": True, "description": "Contract name"},
        ],
        "recommendedMode": "task-plan",
    },
    {
        "id": "test-generator",
        "name": "Test Generator",
        "description": "Generate Hardhat or Foundry test scaffolding for smart contracts.",
        "category": "testing",
        "inputs": [
            {"name": "source", "type": "text", "required": True, "description": "Contract source code"},
            {"name": "framework", "type": "string", "required": False, "description": "hardhat or foundry"},
        ],
        "recommendedMode": "task-plan",
    },
    {
        "id": "doc-generator",
        "name": "NatSpec Doc Generator",
        "description": "Generate NatSpec documentation for Solidity contracts.",
        "category": "docs",
        "inputs": [
            {"name": "source", "type": "text", "required": True, "description": "Contract source code"},
        ],
        "recommendedMode": "chat",
    },
]

LOCAL_SKILL_OVERRIDES = {
    "brand-voice-generator": {
        "category": "brand",
        "triggers": ["create a brand system", "generate my tone of voice", "set up my brand"],
        "notes": "Installed local skill package. Loaded on demand when brand guidance is needed.",
        "recommendedMode": "chat",
    },
    "mcp-client": {
        "category": "mcp",
        "triggers": ["connect to Zapier", "list MCP tools", "use MCP server"],
        "notes": "Installed local skill package plus browser-facing backend stub.",
        "recommendedMode": "context-eng",
    },
    "pptx-generator": {
        "category": "slides",
        "triggers": ["create a presentation", "make slides", "build a LinkedIn carousel"],
        "notes": "Installed local skill package for branded decks and carousel layouts.",
        "recommendedMode": "chat",
    },
    "sop-creator": {
        "category": "docs",
        "triggers": ["create a runbook", "document this process", "write an SOP"],
        "notes": "Installed local skill package plus browser-facing backend stub.",
        "recommendedMode": "chat",
    },
    "remotion-video-creator": {
        "category": "video",
        "triggers": ["create a Remotion video", "render an animation", "build a short with React"],
        "notes": "Installed local skill package for React-based video generation workflows.",
        "recommendedMode": "chat",
    },
    "find-skills": {
        "category": "knowledge",
        "triggers": ["find a skill", "is there a skill for this", "install a skill"],
        "notes": "Installed local discovery skill for capability expansion.",
        "recommendedMode": "context-eng",
    },
    "smart-contract-security": {
        "category": "security",
        "triggers": ["audit this contract", "review smart contract security", "check for reentrancy"],
        "notes": "Installed local security skill for smart contract reviews and incident response guidance.",
        "recommendedMode": "task-plan",
    },
    "specstory-guard": {
        "category": "security",
        "triggers": ["install specstory guard", "scan specstory for secrets", "protect my history"],
        "notes": "Installed local security utility for secret scanning in SpecStory history.",
        "recommendedMode": "context-eng",
    },
    "specstory-link-trail": {
        "category": "knowledge",
        "triggers": ["show my link trail", "what URLs did I visit", "list fetched links"],
        "notes": "Installed local audit skill for tracing external links consulted during SpecStory sessions.",
        "recommendedMode": "chat",
    },
    "specstory-organize": {
        "category": "knowledge",
        "triggers": ["organize my history", "clean up specstory", "sort my sessions"],
        "notes": "Installed local utility for organizing SpecStory history files.",
        "recommendedMode": "context-eng",
    },
    "specstory-project-stats": {
        "category": "knowledge",
        "triggers": ["get project stats", "show specstory stats", "specstory metrics"],
        "notes": "Installed local reporting skill for SpecStory Cloud project metrics.",
        "recommendedMode": "chat",
    },
    "specstory-session-summary": {
        "category": "docs",
        "triggers": ["summarize recent sessions", "standup summary", "what did I work on"],
        "notes": "Installed local summarization skill for converting session history into standup-ready notes.",
        "recommendedMode": "chat",
    },
    "specstory-yak": {
        "category": "knowledge",
        "triggers": ["analyze my yak shaving", "check for rabbit holes", "yak shave score"],
        "notes": "Installed local analysis skill for spotting rabbit holes and effort drift.",
        "recommendedMode": "chat",
    },
}

PLANNED_SKILLS = [
    {
        "id": "knowledge-capture-studio",
        "name": "Knowledge Capture Studio",
        "description": "Planned skill for turning notes, decisions, and research into a reusable second-brain knowledge base.",
        "category": "knowledge",
        "status": "planned",
        "source": "planned",
        "executionMode": "planned",
        "inputs": [],
        "triggers": ["capture this research", "save this decision", "turn this into reusable knowledge"],
        "notes": "Planned stub to make the product direction explicit in the registry.",
        "recommendedMode": "chat",
    },
    {
        "id": "brand-asset-sync",
        "name": "Brand Asset Sync",
        "description": "Planned skill for syncing logos, typography, and palette files into the shared brand system used by docs and decks.",
        "category": "brand",
        "status": "planned",
        "source": "planned",
        "executionMode": "planned",
        "inputs": [],
        "triggers": ["sync brand assets", "update brand files"],
        "notes": "Planned stub; not installed yet.",
        "recommendedMode": "chat",
    },
    {
        "id": "video-publish-pipeline",
        "name": "Video Publish Pipeline",
        "description": "Planned skill for exporting, packaging, and publishing generated videos after render completes.",
        "category": "video",
        "status": "planned",
        "source": "planned",
        "executionMode": "planned",
        "inputs": [],
        "triggers": ["publish this video", "export a final cut"],
        "notes": "Planned stub; not installed yet.",
        "recommendedMode": "chat",
    },
]

SKILL_PROMPTS = {
    "sop-creator": (
        "You are an SOP generator. Create a concise, scannable SOP for the given task. Include: "
        "title, purpose, prerequisites, step-by-step instructions, expected outcomes, and troubleshooting. "
        "Format the output as clean Markdown."
    ),
    "skill-creator": (
        "You are a skill definition generator. Create a compact skill definition with an id, name, "
        "description, inputs, and implementation notes. Prefer progressive disclosure over long prompts."
    ),
    "contract-scanner": (
        "You are a smart contract security auditor. Review the Solidity source for reentrancy, arithmetic, "
        "access control, front-running, and logic issues. Rate findings and suggest fixes."
    ),
    "gas-optimizer": (
        "You are a Solidity gas optimization expert. Suggest practical gas reductions with brief reasoning "
        "and estimated impact."
    ),
    "abi-generator": (
        "You are a TypeScript code generator. Given an ABI, generate typed wrappers and React hooks."
    ),
    "test-generator": (
        "You are a smart contract test generator. Produce test scaffolding that covers the happy path, edge cases, "
        "access control, and revert conditions."
    ),
    "doc-generator": (
        "You are a Solidity documentation generator. Produce NatSpec comments for contracts, functions, events, and errors."
    ),
}


def _save_history(entry: dict):
    fp = SKILLS_HISTORY_DIR / f"{entry['id']}.json"
    fp.write_text(json.dumps(entry, indent=2))


def _title_from_id(skill_id: str) -> str:
    return skill_id.replace("-", " ").title()


def _read_skill_metadata(skill_dir: Path) -> dict:
    skill_file = skill_dir / "SKILL.md"
    if not skill_file.exists():
        return {}

    raw = skill_file.read_text(encoding="utf-8")
    lines = raw.splitlines()
    if len(lines) < 3 or lines[0].strip() != "---":
        return {}

    meta = {}
    for line in lines[1:]:
        stripped = line.strip()
        if stripped == "---":
            break
        if ":" not in stripped:
            continue
        key, value = stripped.split(":", 1)
        meta[key.strip()] = value.strip().strip('"')
    return meta


def _read_openai_metadata(skill_dir: Path) -> dict:
    metadata_file = skill_dir / "agents" / "openai.yaml"
    if not metadata_file.exists():
        return {}

    raw = metadata_file.read_text(encoding="utf-8")
    lines = raw.splitlines()
    in_interface = False
    meta = {}

    for line in lines:
        stripped = line.strip()
        if stripped == "interface:":
            in_interface = True
            continue

        if not in_interface:
            continue

        if not line.startswith("  "):
            break

        if ":" not in stripped:
            continue

        key, value = stripped.split(":", 1)
        meta[key.strip()] = value.strip().strip('"').strip("'")

    return meta


def _build_skill_registry():
    registry = {}

    for skill in BUILTIN_SKILLS:
        entry = dict(skill)
        entry.setdefault("inputs", [])
        entry.setdefault("triggers", [])
        entry.setdefault("notes", "")
        entry.setdefault("recommendedMode", "chat")
        entry["status"] = "available"
        entry["source"] = "backend"
        entry["executionMode"] = "backend"
        entry["path"] = None
        entry["displayName"] = entry.get("name")
        entry["shortDescription"] = None
        entry["defaultPrompt"] = None
        entry["uiMetadataPath"] = None
        registry[entry["id"]] = entry

    if LOCAL_SKILLS_DIR.exists():
        for skill_dir in sorted(LOCAL_SKILLS_DIR.iterdir()):
            if not skill_dir.is_dir():
                continue

            metadata = _read_skill_metadata(skill_dir)
            if not metadata:
                continue

            ui_metadata = _read_openai_metadata(skill_dir)
            skill_id = skill_dir.name
            override = LOCAL_SKILL_OVERRIDES.get(skill_id, {})
            rel_path = skill_dir.relative_to(REPO_ROOT).as_posix()
            metadata_path = skill_dir / "agents" / "openai.yaml"

            local_entry = {
                "id": skill_id,
                "name": ui_metadata.get("display_name") or metadata.get("name") or _title_from_id(skill_id),
                "description": metadata.get("description") or "Local skill package.",
                "category": override.get("category", "knowledge"),
                "inputs": [],
                "triggers": override.get("triggers", []),
                "notes": override.get("notes", "Installed local skill package."),
                "recommendedMode": override.get("recommendedMode", "chat"),
                "status": "installed",
                "source": "local",
                "executionMode": "package",
                "path": rel_path,
                "displayName": ui_metadata.get("display_name"),
                "shortDescription": ui_metadata.get("short_description"),
                "defaultPrompt": ui_metadata.get("default_prompt"),
                "uiMetadataPath": (
                    metadata_path.relative_to(REPO_ROOT).as_posix()
                    if metadata_path.exists()
                    else None
                ),
            }

            if skill_id in registry:
                merged = registry[skill_id]
                merged.update({
                    "name": local_entry["name"],
                    "description": local_entry["description"],
                    "category": local_entry["category"],
                    "triggers": local_entry["triggers"],
                    "notes": local_entry["notes"],
                    "recommendedMode": local_entry["recommendedMode"],
                    "status": "installed",
                    "source": "local+backend",
                    "executionMode": "hybrid",
                    "path": rel_path,
                    "displayName": local_entry["displayName"] or merged.get("name"),
                    "shortDescription": local_entry["shortDescription"],
                    "defaultPrompt": local_entry["defaultPrompt"],
                    "uiMetadataPath": local_entry["uiMetadataPath"],
                })
            else:
                registry[skill_id] = local_entry

    for planned in PLANNED_SKILLS:
        if planned["id"] not in registry:
            registry[planned["id"]] = dict(planned)

    return list(registry.values())


@router.get("/list")
async def list_skills():
    """List the full skills registry: backend skills, installed local packages, and planned stubs."""
    return _build_skill_registry()


@router.get("/history/list")
async def list_history():
    entries = []
    for fp in SKILLS_HISTORY_DIR.glob("*.json"):
        try:
            entries.append(json.loads(fp.read_text()))
        except Exception:
            pass
    return sorted(entries, key=lambda e: e.get("timestamp", 0), reverse=True)


@router.post("/history/save")
async def save_history(entry: dict):
    if not entry.get("timestamp"):
        entry["timestamp"] = int(time.time() * 1000)
    _save_history(entry)
    return {"status": "saved", "id": entry.get("id")}


@router.delete("/history/delete/{entry_id}")
async def delete_history(entry_id: str):
    fp = SKILLS_HISTORY_DIR / f"{entry_id}.json"
    if fp.exists():
        fp.unlink()
        return {"status": "deleted"}
    raise HTTPException(404, "Entry not found")


@router.post("/execute")
async def execute_skill(req: SkillExecRequest):
    """Execute backend-wired skills. Package-only and planned skills are browse-only in the UI."""
    skill = next((s for s in BUILTIN_SKILLS if s["id"] == req.skill_id), None)
    if not skill:
        raise HTTPException(404, f"Skill not found or not executable: {req.skill_id}")

    if req.skill_id == "mcp-client":
        raw_params = req.inputs.get("params", {})
        if isinstance(raw_params, str) and raw_params.strip():
            try:
                raw_params = json.loads(raw_params)
            except json.JSONDecodeError as exc:
                raise HTTPException(400, f"Invalid JSON for params: {exc}") from exc
        if raw_params in ("", None):
            raw_params = {}
        if not isinstance(raw_params, dict):
            raise HTTPException(400, "MCP params must decode to a JSON object")

        result = await mcp_routes.call_tool_for_server(
            req.inputs.get("server", ""),
            req.inputs.get("tool", ""),
            raw_params,
        )
        return {
            "result": result,
            "status": "ok",
        }

    system = SKILL_PROMPTS.get(req.skill_id, f"Execute the skill: {skill['name']}. {skill['description']}")
    model = req.model or DEFAULT_MODEL

    user_parts = []
    for inp in skill.get("inputs", []):
        value = req.inputs.get(inp["name"], "")
        if value:
            user_parts.append(f"{inp['name']}: {value}")
    user_prompt = "\n".join(user_parts) if user_parts else json.dumps(req.inputs)

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
                result = data.get("message", {}).get("content", "") or data.get("response", "")
        else:
            data = await call_free({
                "model": model,
                "messages": [
                    {"role": "system", "content": system},
                    {"role": "user", "content": user_prompt},
                ],
            })
            result = data.get("choices", [{}])[0].get("message", {}).get("content") or data.get("text") or str(data)

        entry = {
            "id": f"hist-{int(time.time() * 1000)}",
            "skill": req.skill_id,
            "name": skill["name"],
            "inputs": req.inputs,
            "result": result,
            "provider": req.provider,
            "model": model,
            "timestamp": int(time.time() * 1000),
        }
        _save_history(entry)
        return {"result": result, "model": model, "skill": req.skill_id, "history": entry}
    except httpx.HTTPError as e:
        raise HTTPException(502, f"LLM request failed: {e}")
