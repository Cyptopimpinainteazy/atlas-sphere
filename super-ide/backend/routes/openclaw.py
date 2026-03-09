"""
OpenClaw integration routes.

This is a thin local config + proxy layer so the frontend can manage OpenClaw
tool settings and invoke typed tools through a single backend contract.
"""

import json
import os
from pathlib import Path

import httpx
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, Field

router = APIRouter()

DATA_DIR = Path(os.getenv("KNOWLEDGE_DIR", "./data"))
DATA_DIR.mkdir(parents=True, exist_ok=True)
CONFIG_PATH = DATA_DIR / "openclaw.json"

DEFAULT_CONFIG = {
    "baseUrl": "",
    "toolEndpoint": "/api/tools/invoke",
    "gatewayToken": "",
    "defaultProfile": "coding",
    "webProvider": "brave",
    "loopDetectionEnabled": True,
}

TOOL_INVENTORY = [
    {
        "name": "browser",
        "category": "ui",
        "summary": "Managed browser automation, snapshots, screenshots, and actions.",
        "commonActions": ["status", "start", "open", "snapshot", "screenshot", "act"],
    },
    {
        "name": "canvas",
        "category": "ui",
        "summary": "Canvas presentation, evaluation, snapshots, and A2UI rendering.",
        "commonActions": ["present", "navigate", "eval", "snapshot", "a2ui_push"],
    },
    {
        "name": "nodes",
        "category": "nodes",
        "summary": "Node discovery, notifications, camera, screen, and device actions.",
        "commonActions": ["status", "describe", "notify", "run", "camera_snap", "screen_record"],
    },
    {
        "name": "message",
        "category": "messaging",
        "summary": "Cross-channel messaging actions for send, thread, react, and moderation.",
        "commonActions": ["send", "thread-create", "search", "pin", "read"],
    },
    {
        "name": "cron",
        "category": "automation",
        "summary": "Cron jobs, wake signals, and scheduled task management.",
        "commonActions": ["status", "list", "add", "update", "run"],
    },
    {
        "name": "exec",
        "category": "runtime",
        "summary": "Synchronous or background command execution in a workspace.",
        "commonActions": ["command"],
    },
    {
        "name": "process",
        "category": "runtime",
        "summary": "Manage background exec sessions.",
        "commonActions": ["list", "poll", "log", "write", "kill"],
    },
    {
        "name": "web_search",
        "category": "web",
        "summary": "Search the web through Brave, Perplexity, Gemini, Grok, or Kimi.",
        "commonActions": ["query"],
    },
    {
        "name": "web_fetch",
        "category": "web",
        "summary": "Fetch readable content from a URL.",
        "commonActions": ["url"],
    },
    {
        "name": "pdf",
        "category": "documents",
        "summary": "Analyze PDF documents.",
        "commonActions": ["files"],
    },
    {
        "name": "image",
        "category": "media",
        "summary": "Analyze images with an image model.",
        "commonActions": ["image", "prompt"],
    },
]

TOOL_PROFILES = ["minimal", "coding", "messaging", "full"]

TOOL_GROUPS = [
    "group:runtime",
    "group:fs",
    "group:sessions",
    "group:memory",
    "group:web",
    "group:ui",
    "group:automation",
    "group:messaging",
    "group:nodes",
    "group:openclaw",
]


class OpenClawConfigPayload(BaseModel):
    baseUrl: str = ""
    toolEndpoint: str = "/api/tools/invoke"
    gatewayToken: str = ""
    defaultProfile: str = "coding"
    webProvider: str = "brave"
    loopDetectionEnabled: bool = True


class OpenClawToolRunPayload(BaseModel):
    tool: str
    input: dict = Field(default_factory=dict)


def _load_config() -> dict:
    if not CONFIG_PATH.exists():
        return dict(DEFAULT_CONFIG)

    try:
        data = json.loads(CONFIG_PATH.read_text(encoding="utf-8"))
    except Exception:
        return dict(DEFAULT_CONFIG)

    return {
        "baseUrl": str(data.get("baseUrl", DEFAULT_CONFIG["baseUrl"])),
        "toolEndpoint": str(data.get("toolEndpoint", DEFAULT_CONFIG["toolEndpoint"])),
        "gatewayToken": str(data.get("gatewayToken", DEFAULT_CONFIG["gatewayToken"])),
        "defaultProfile": str(data.get("defaultProfile", DEFAULT_CONFIG["defaultProfile"])),
        "webProvider": str(data.get("webProvider", DEFAULT_CONFIG["webProvider"])),
        "loopDetectionEnabled": bool(data.get("loopDetectionEnabled", DEFAULT_CONFIG["loopDetectionEnabled"])),
    }


def _save_config(config: dict):
    CONFIG_PATH.write_text(json.dumps(config, indent=2), encoding="utf-8")


@router.get("/config")
async def get_config():
    return _load_config()


@router.post("/config")
async def save_config(payload: OpenClawConfigPayload):
    data = {
        "baseUrl": payload.baseUrl.strip(),
        "toolEndpoint": payload.toolEndpoint.strip() or DEFAULT_CONFIG["toolEndpoint"],
        "gatewayToken": payload.gatewayToken.strip(),
        "defaultProfile": payload.defaultProfile.strip() or DEFAULT_CONFIG["defaultProfile"],
        "webProvider": payload.webProvider.strip() or DEFAULT_CONFIG["webProvider"],
        "loopDetectionEnabled": payload.loopDetectionEnabled,
    }
    _save_config(data)
    return data


@router.get("/tools")
async def list_tools():
    return {
        "profiles": TOOL_PROFILES,
        "groups": TOOL_GROUPS,
        "tools": TOOL_INVENTORY,
    }


@router.post("/run")
async def run_tool(payload: OpenClawToolRunPayload):
    config = _load_config()
    if not config["baseUrl"]:
        raise HTTPException(400, "OpenClaw base URL is not configured")

    endpoint = f"{config['baseUrl'].rstrip('/')}/{config['toolEndpoint'].lstrip('/')}"
    headers = {"Content-Type": "application/json"}
    if config["gatewayToken"]:
        headers["Authorization"] = f"Bearer {config['gatewayToken']}"
        headers["X-OpenClaw-Token"] = config["gatewayToken"]

    try:
        async with httpx.AsyncClient(timeout=60) as client:
            response = await client.post(
                endpoint,
                json={"tool": payload.tool, "input": payload.input},
                headers=headers,
            )
            response.raise_for_status()
            try:
                data = response.json()
            except Exception:
                data = {"text": response.text}
            return {
                "ok": True,
                "tool": payload.tool,
                "endpoint": endpoint,
                "result": data,
            }
    except httpx.HTTPStatusError as exc:
        detail = exc.response.text or str(exc)
        raise HTTPException(exc.response.status_code, detail[:1000])
    except Exception as exc:
        raise HTTPException(502, f"OpenClaw tool call failed: {exc}")
