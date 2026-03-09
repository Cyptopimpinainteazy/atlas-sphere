"""
MCP routes — configurable streamable HTTP and stdio MCP connectivity.
"""

import asyncio
import json
import os
import select
import subprocess
import time
import uuid
from pathlib import Path
from typing import Literal

import httpx
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, Field

router = APIRouter()

REPO_ROOT = Path(__file__).resolve().parents[4]
DATA_DIR = Path(os.getenv("KNOWLEDGE_DIR", "./data"))
DATA_DIR.mkdir(parents=True, exist_ok=True)
CONFIG_PATH = DATA_DIR / "mcp_servers.json"


class MCPServerConfig(BaseModel):
    name: str
    transport: Literal["streamable-http", "stdio"] = "streamable-http"
    url: str | None = None
    command: str | None = None
    args: list[str] = Field(default_factory=list)
    cwd: str | None = None
    env: dict[str, str] = Field(default_factory=dict)
    headers: dict[str, str] = Field(default_factory=dict)


class MCPToolCallRequest(BaseModel):
    server: str
    tool: str
    arguments: dict = Field(default_factory=dict)


def _load_configs() -> dict[str, MCPServerConfig]:
    if not CONFIG_PATH.exists():
        return {}
    try:
        raw = json.loads(CONFIG_PATH.read_text())
    except Exception as exc:
        raise HTTPException(500, f"Failed to read MCP config: {exc}") from exc

    configs: dict[str, MCPServerConfig] = {}
    for item in raw:
        config = MCPServerConfig.model_validate(item)
        configs[config.name] = config
    return configs


def _save_configs(configs: dict[str, MCPServerConfig]):
    CONFIG_PATH.write_text(
        json.dumps([config.model_dump() for config in configs.values()], indent=2)
    )


def _get_config(name: str) -> MCPServerConfig:
    config = _load_configs().get(name)
    if not config:
        raise HTTPException(404, f"MCP server not found: {name}")
    return config


def _request_id() -> str:
    return f"rpc-{uuid.uuid4().hex[:12]}"


def _initialize_payload() -> dict:
    return {
        "protocolVersion": "2024-11-05",
        "capabilities": {},
        "clientInfo": {
            "name": "atlas-superide",
            "version": "0.1.0",
        },
    }


def _resolve_config_cwd(config: MCPServerConfig) -> Path:
    requested = (config.cwd or ".").strip() or "."
    candidate = (Path(requested) if requested.startswith("/") else (REPO_ROOT / requested)).resolve()
    try:
        candidate.relative_to(REPO_ROOT)
    except ValueError as exc:
        raise HTTPException(400, f"MCP cwd escapes workspace: {requested}") from exc
    if not candidate.exists():
        raise HTTPException(404, f"MCP cwd not found: {requested}")
    if not candidate.is_dir():
        raise HTTPException(400, f"MCP cwd is not a directory: {requested}")
    return candidate


async def _http_request(config: MCPServerConfig, payload: dict, expect_response: bool = True):
    if not config.url:
        raise HTTPException(400, f"MCP server {config.name} is missing a URL")

    headers = {
        "Content-Type": "application/json",
        "Accept": "application/json, text/event-stream",
        **config.headers,
    }

    async with httpx.AsyncClient(timeout=30) as client:
        response = await client.post(config.url, json=payload, headers=headers)
        response.raise_for_status()
        if not expect_response:
            return None
        try:
            return response.json()
        except Exception as exc:
            raise HTTPException(502, f"MCP server {config.name} returned invalid JSON") from exc


async def _run_http_operation(config: MCPServerConfig, method: str, params: dict | None = None):
    init_id = _request_id()
    init_response = await _http_request(
        config,
        {
            "jsonrpc": "2.0",
            "id": init_id,
            "method": "initialize",
            "params": _initialize_payload(),
        },
    )
    if init_response.get("error"):
        raise HTTPException(502, f"MCP initialize failed: {init_response['error']}")

    await _http_request(
        config,
        {
            "jsonrpc": "2.0",
            "method": "notifications/initialized",
            "params": {},
        },
        expect_response=False,
    )

    request_id = _request_id()
    response = await _http_request(
        config,
        {
            "jsonrpc": "2.0",
            "id": request_id,
            "method": method,
            "params": params or {},
        },
    )
    if response.get("error"):
        raise HTTPException(502, f"MCP {method} failed: {response['error']}")
    return response.get("result", {})


def _stdio_send(proc: subprocess.Popen, payload: dict):
    if proc.stdin is None:
        raise RuntimeError("MCP stdin is not available")
    proc.stdin.write(json.dumps(payload) + "\n")
    proc.stdin.flush()


def _stdio_read_response(proc: subprocess.Popen, request_id: str, timeout: float = 15.0):
    if proc.stdout is None:
        raise RuntimeError("MCP stdout is not available")

    deadline = time.time() + timeout
    while time.time() < deadline:
        ready, _, _ = select.select([proc.stdout], [], [], 0.25)
        if not ready:
            if proc.poll() is not None:
                break
            continue

        line = proc.stdout.readline()
        if not line:
            continue

        line = line.strip()
        if not line:
            continue

        try:
            message = json.loads(line)
        except json.JSONDecodeError:
            continue

        if message.get("id") == request_id:
            return message

    stderr_output = ""
    if proc.stderr is not None:
        try:
            stderr_output = proc.stderr.read() or ""
        except Exception:
            stderr_output = ""
    raise HTTPException(504, f"MCP stdio request timed out. {stderr_output}".strip())


def _run_stdio_operation_sync(config: MCPServerConfig, method: str, params: dict | None = None):
    if not config.command:
        raise HTTPException(400, f"MCP server {config.name} is missing a command")

    proc = subprocess.Popen(
        [config.command, *config.args],
        stdin=subprocess.PIPE,
        stdout=subprocess.PIPE,
        stderr=subprocess.PIPE,
        text=True,
        bufsize=1,
        cwd=_resolve_config_cwd(config),
        env={**os.environ, **config.env},
    )

    try:
        init_id = _request_id()
        _stdio_send(
            proc,
            {
                "jsonrpc": "2.0",
                "id": init_id,
                "method": "initialize",
                "params": _initialize_payload(),
            },
        )
        init_response = _stdio_read_response(proc, init_id)
        if init_response.get("error"):
            raise HTTPException(502, f"MCP initialize failed: {init_response['error']}")

        _stdio_send(
            proc,
            {
                "jsonrpc": "2.0",
                "method": "notifications/initialized",
                "params": {},
            },
        )

        request_id = _request_id()
        _stdio_send(
            proc,
            {
                "jsonrpc": "2.0",
                "id": request_id,
                "method": method,
                "params": params or {},
            },
        )
        response = _stdio_read_response(proc, request_id)
        if response.get("error"):
            raise HTTPException(502, f"MCP {method} failed: {response['error']}")
        return response.get("result", {})
    finally:
        if proc.poll() is None:
            proc.terminate()
            try:
                proc.wait(timeout=2)
            except subprocess.TimeoutExpired:
                proc.kill()


async def _run_stdio_operation(config: MCPServerConfig, method: str, params: dict | None = None):
    return await asyncio.to_thread(_run_stdio_operation_sync, config, method, params)


async def test_server_connection(name: str):
    config = _get_config(name)
    if config.transport == "streamable-http":
        await _run_http_operation(config, "tools/list")
    else:
        await _run_stdio_operation(config, "tools/list")
    return {"status": "ok", "name": config.name, "transport": config.transport}


async def list_tools_for_server(name: str):
    config = _get_config(name)
    result = (
        await _run_http_operation(config, "tools/list")
        if config.transport == "streamable-http"
        else await _run_stdio_operation(config, "tools/list")
    )
    return result.get("tools", [])


async def call_tool_for_server(name: str, tool: str, arguments: dict | None = None):
    config = _get_config(name)
    payload = {
        "name": tool,
        "arguments": arguments or {},
    }
    return (
        await _run_http_operation(config, "tools/call", payload)
        if config.transport == "streamable-http"
        else await _run_stdio_operation(config, "tools/call", payload)
    )


@router.get("/servers")
async def list_servers():
    return [config.model_dump() for config in _load_configs().values()]


@router.post("/servers")
async def save_server(config: MCPServerConfig):
    configs = _load_configs()
    configs[config.name] = config
    _save_configs(configs)
    return {"status": "saved", "server": config.model_dump()}


@router.delete("/servers/{name}")
async def delete_server(name: str):
    configs = _load_configs()
    if name not in configs:
        raise HTTPException(404, f"MCP server not found: {name}")
    del configs[name]
    _save_configs(configs)
    return {"status": "deleted", "name": name}


@router.post("/test/{name}")
async def test_server(name: str):
    return await test_server_connection(name)


@router.get("/tools/{name}")
async def list_tools(name: str):
    return await list_tools_for_server(name)


@router.post("/call")
async def call_tool(req: MCPToolCallRequest):
    return await call_tool_for_server(req.server, req.tool, req.arguments)
