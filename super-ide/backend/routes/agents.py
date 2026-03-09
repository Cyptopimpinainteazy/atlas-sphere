"""
Multi-agent orchestration routes.
"""

import asyncio
import json
import os
import re
import time
import uuid
from pathlib import Path
from typing import Literal

import httpx
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, Field

router = APIRouter()

OLLAMA_URL = os.getenv("OLLAMA_URL", "http://localhost:11434")
OPENROUTER_KEY = os.getenv("OPENROUTER_API_KEY", "")
OLLAMA_FREE_URL = os.getenv("OLLAMA_FREE_URL", "https://api.ollama.ai")
GPTOSS_URL = os.getenv("GPTOSS_URL", "")

RUNS_DIR = Path(os.getenv("AGENT_RUNS_DIR", "./data/agent_runs"))
RUNS_DIR.mkdir(parents=True, exist_ok=True)
REPO_ROOT = Path(__file__).resolve().parents[4]

ACTIVE_RUN_TASKS: dict[str, asyncio.Task] = {}


class AgentProfilePayload(BaseModel):
    id: str
    name: str
    role: str
    provider: Literal["ollama", "openrouter", "ollamafree", "gptoss"] = "ollama"
    model: str = ""
    systemPrompt: str = ""
    openclawTools: dict = Field(default_factory=dict)
    enabled: bool = True


class AgentRunRequest(BaseModel):
    objective: str = ""
    definitionOfDone: str = ""
    executionMode: Literal["parallel", "sequential"] = "parallel"
    workspaceRoot: str = "."
    ralphMode: bool = False
    ralphLoop: bool = False
    resumeRalph: bool = False
    maxIterations: int = 6
    ralphState: dict = Field(default_factory=dict)
    agents: list[AgentProfilePayload] = Field(default_factory=list)


class AgentCancelRequest(BaseModel):
    run_id: str


def _run_path(run_id: str) -> Path:
    return RUNS_DIR / f"{run_id}.json"


def _save_run(run_data: dict):
    _run_path(run_data["id"]).write_text(json.dumps(run_data, indent=2))


def _load_runs() -> list[dict]:
    runs: list[dict] = []
    for file_path in RUNS_DIR.glob("*.json"):
        try:
            runs.append(json.loads(file_path.read_text()))
        except Exception:
            continue
    return sorted(runs, key=lambda item: item.get("updatedAt", 0), reverse=True)


def _resolve_workspace_root(workspace_root: str) -> Path:
    candidate = (REPO_ROOT / (workspace_root or ".")).resolve()
    try:
        candidate.relative_to(REPO_ROOT)
    except ValueError as exc:
        raise HTTPException(400, "workspaceRoot must stay inside the repository") from exc
    return candidate


def _ralph_paths(workspace_dir: Path) -> dict[str, Path]:
    ralph_dir = workspace_dir / ".ralph"
    ralph_dir.mkdir(parents=True, exist_ok=True)
    return {
        "dir": ralph_dir,
        "task": ralph_dir / "ralph_task.md",
        "guardrails": ralph_dir / "guardrails.md",
        "progress": ralph_dir / "progress.md",
        "errors": ralph_dir / "errors.log",
        "activity": ralph_dir / "activity.log",
    }


def _append_line(path: Path, content: str):
    path.parent.mkdir(parents=True, exist_ok=True)
    with path.open("a", encoding="utf-8") as handle:
        handle.write(content)


def _format_success_criteria(definition_of_done: str) -> str:
    lines = [line.strip() for line in definition_of_done.splitlines() if line.strip()]
    if not lines:
        return "- [ ] Define success criteria before declaring completion."

    formatted: list[str] = []
    for line in lines:
        normalized = re.sub(r"^\d+\.\s*", "", line)
        if re.match(r"^[-*]\s+\[[ xX]\]\s+.+", normalized):
            formatted.append(normalized)
        elif re.match(r"^\[[ xX]\]\s+.+", normalized):
            formatted.append(f"- {normalized}")
        else:
            formatted.append(f"- [ ] {normalized}")
    return "\n".join(formatted)


def _read_text(path: Path) -> str:
    if not path.exists():
        return ""
    return path.read_text(encoding="utf-8")


def _initialize_ralph_state(workspace_dir: Path, objective: str, definition_of_done: str, role_profile: str):
    paths = _ralph_paths(workspace_dir)
    if not paths["task"].exists():
        paths["task"].write_text(
            "\n".join(
                [
                    f"task: {objective}",
                    "",
                    "# ralph task",
                    "",
                    "## objective",
                    objective,
                    "",
                    "## success criteria",
                    _format_success_criteria(definition_of_done),
                    "",
                ]
            ),
            encoding="utf-8",
        )
    if not paths["guardrails"].exists():
        paths["guardrails"].write_text(
            "\n".join(
                [
                    "# guardrails",
                    "",
                    "## default",
                    f"- {role_profile or 'Stay on the anchor task. Persist durable state to files. Do not drift into unrelated work.'}",
                    "",
                ]
            ),
            encoding="utf-8",
        )
    if not paths["progress"].exists():
        paths["progress"].write_text("# progress\n\n", encoding="utf-8")
    _append_line(
        paths["activity"],
        f"[{int(time.time())}] initialized objective={objective!r} workspace={workspace_dir}\n",
    )
    return paths


def _extract_objective_from_task(task_text: str) -> str:
    for line in task_text.splitlines():
        match = re.match(r"^task:\s*(.+?)\s*$", line.strip(), re.IGNORECASE)
        if match:
            return match.group(1).strip()

    lines = task_text.splitlines()
    for index, line in enumerate(lines):
        if line.strip().lower() != "## objective":
            continue
        collected: list[str] = []
        for next_line in lines[index + 1 :]:
            stripped = next_line.strip()
            if stripped.startswith("## "):
                break
            if stripped:
                collected.append(stripped)
        return " ".join(collected).strip()
    return ""


def _load_ralph_resume_state(workspace_dir: Path) -> dict:
    paths = _ralph_paths(workspace_dir)
    if not paths["task"].exists():
        raise HTTPException(404, "No .ralph/ralph_task.md found for this workspace")

    task_text = _read_text(paths["task"])
    checklist = _parse_task_checklist(task_text)
    objective = _extract_objective_from_task(task_text)
    if not objective:
        raise HTTPException(400, "Unable to infer Ralph objective from .ralph/ralph_task.md")

    definition_lines = [
        f"- [{'x' if item['done'] else ' '}] {item['text']}"
        for item in checklist
    ]
    role_profile = _read_text(paths["guardrails"]).strip()
    return {
        "objective": objective,
        "definitionOfDone": "\n".join(definition_lines),
        "roleProfile": role_profile,
        "checklist": {
            "total": len(checklist),
            "completed": sum(1 for item in checklist if item["done"]),
            "remaining": [item["text"] for item in checklist if not item["done"]],
        },
    }


def _parse_task_checklist(task_text: str) -> list[dict]:
    items: list[dict] = []
    for line in task_text.splitlines():
        match = re.match(r"^(\s*(?:[-*]|\d+\.)\s+\[)([ xX])(\]\s+)(.+?)\s*$", line)
        if not match:
            continue
        items.append(
            {
                "line": line,
                "done": match.group(2).lower() == "x",
                "text": match.group(4).strip(),
            }
        )
    return items


def _extract_checkoffs(output: str) -> list[str]:
    fenced_match = re.search(r"```(?:ralph|json)\s*(\{.*?\})\s*```", output, re.DOTALL)
    candidates: list[str] = []
    if fenced_match:
        candidates.append(fenced_match.group(1).strip())
    stripped = output.strip()
    if stripped.startswith("{") and stripped.endswith("}"):
        candidates.append(stripped)

    for candidate in candidates:
        try:
            payload = json.loads(candidate)
        except json.JSONDecodeError:
            continue
        if not isinstance(payload, dict):
            continue
        checkoffs = payload.get("checkoffs")
        if isinstance(checkoffs, list):
            return [item.strip() for item in checkoffs if isinstance(item, str) and item.strip()]

    return [
        line.split("CHECK_OFF:", 1)[1].strip()
        for line in output.splitlines()
        if line.strip().startswith("CHECK_OFF:")
    ]


def _mark_task_items_complete(task_path: Path, checkoffs: list[str]) -> int:
    if not checkoffs or not task_path.exists():
        return 0

    normalized_targets = [
        re.sub(r"\s+", " ", item.strip().lower())
        for item in checkoffs
        if item.strip()
    ]
    if not normalized_targets:
        return 0

    changed = 0
    updated_lines: list[str] = []
    for line in task_path.read_text(encoding="utf-8").splitlines():
        match = re.match(r"^(\s*(?:[-*]|\d+\.)\s+\[)([ xX])(\]\s+)(.+?)\s*$", line)
        if not match:
            updated_lines.append(line)
            continue

        item_key = re.sub(r"\s+", " ", match.group(4).strip().lower())
        should_mark = any(
            target == item_key or target.startswith(item_key) or item_key in target
            for target in normalized_targets
        )
        if match.group(2).lower() == " " and should_mark:
            updated_lines.append(f"{match.group(1)}x{match.group(3)}{match.group(4)}")
            changed += 1
        else:
            updated_lines.append(line)

    if changed:
        task_path.write_text("\n".join(updated_lines) + "\n", encoding="utf-8")
    return changed


def _checklist_snapshot(task_path: Path) -> dict:
    items = _parse_task_checklist(_read_text(task_path))
    completed = sum(1 for item in items if item["done"])
    remaining = [item["text"] for item in items if not item["done"]]
    return {
        "total": len(items),
        "completed": completed,
        "remaining": remaining,
    }


def _extract_text(payload: dict) -> str:
    return (
        payload.get("message", {}).get("content")
        or payload.get("response")
        or payload.get("choices", [{}])[0].get("message", {}).get("content")
        or payload.get("text")
        or json.dumps(payload)
    )


def _extract_error_detail(response: httpx.Response) -> str:
    try:
        payload = response.json()
        detail = (
            payload.get("error")
            or payload.get("detail")
            or payload.get("message")
            or payload.get("response")
        )
        if detail:
            return str(detail)
    except Exception:
        pass

    text = response.text.strip()
    if text:
        return text
    return f"HTTP {response.status_code}"


def _should_fallback_ollama_chat(response: httpx.Response) -> bool:
    if response.status_code != 404:
        return False

    detail = _extract_error_detail(response).lower()
    if "model" in detail:
        return False
    return (
        detail in {"404 page not found", "not found"}
        or "page not found" in detail
        or "unknown route" in detail
        or "endpoint not found" in detail
    )


async def _resolve_ollama_model(client: httpx.AsyncClient, model: str) -> str:
    normalized = (model or "").strip()
    if not normalized or ":" in normalized:
        return normalized

    try:
        response = await client.get(f"{OLLAMA_URL}/api/tags")
        if response.status_code >= 400:
            return normalized
        payload = response.json()
        names = [item.get("name", "") for item in payload.get("models", []) if item.get("name")]
    except Exception:
        return normalized

    exact = next((name for name in names if name == normalized), None)
    if exact:
        return exact

    prefix = next(
        (name for name in names if name.lower().startswith(f"{normalized.lower()}:")),
        None,
    )
    return prefix or normalized


async def _call_provider(provider: str, model: str, messages: list[dict]) -> str:
    async with httpx.AsyncClient(timeout=300) as client:
        if provider == "ollama":
            resolved_model = await _resolve_ollama_model(client, model)
            response = await client.post(
                f"{OLLAMA_URL}/api/chat",
                json={
                    "model": resolved_model,
                    "messages": messages,
                    "stream": False,
                },
            )
            if _should_fallback_ollama_chat(response):
                response = await client.post(
                    f"{OLLAMA_URL}/api/generate",
                    json={
                        "model": resolved_model,
                        "prompt": "\n\n".join(message["content"] for message in messages),
                        "stream": False,
                    },
                )
            if response.status_code >= 400:
                raise HTTPException(response.status_code, _extract_error_detail(response)[:1000])
            return _extract_text(response.json())

        if provider == "openrouter":
            if not OPENROUTER_KEY:
                raise HTTPException(500, "OPENROUTER_API_KEY not configured")
            response = await client.post(
                "https://api.openrouter.ai/v1/chat/completions",
                json={"model": model, "messages": messages},
                headers={"Authorization": f"Bearer {OPENROUTER_KEY}"},
            )
            response.raise_for_status()
            return _extract_text(response.json())

        if provider == "ollamafree":
            response = await client.post(
                OLLAMA_FREE_URL.rstrip("/") + "/api/chat",
                json={"model": model, "messages": messages},
            )
            response.raise_for_status()
            return _extract_text(response.json())

        if provider == "gptoss":
            if not GPTOSS_URL:
                raise HTTPException(500, "GPTOSS_URL not configured")
            response = await client.post(
                GPTOSS_URL.rstrip("/") + "/chat",
                json={"model": model, "messages": messages},
            )
            response.raise_for_status()
            return _extract_text(response.json())

    raise HTTPException(400, f"Unknown provider {provider}")


def _build_messages(
    agent: AgentProfilePayload,
    objective: str,
    definition_of_done: str,
    context: str,
    ralph_mode: bool = False,
    ralph_loop: bool = False,
    ralph_paths: dict[str, Path] | None = None,
    ralph_role_profile: str = "",
) -> list[dict]:
    system_parts = [
        f"You are {agent.name}, acting as {agent.role}.",
        "Work only on your specialty and contribute to the shared delivery.",
        f"Shared objective: {objective}.",
    ]
    if definition_of_done:
        system_parts.append(f"Definition of done: {definition_of_done}.")
    if agent.systemPrompt:
        system_parts.append(agent.systemPrompt)
    if agent.openclawTools:
        system_parts.append(
            "OpenClaw tool policy: "
            + json.dumps(agent.openclawTools, sort_keys=True)
        )
    if ralph_mode:
        ralph_location = f" at {ralph_paths['dir']}" if ralph_paths else ""
        system_parts.extend(
            [
                "RALPH mode is active. Treat this as a fresh iteration with no trust in stale context.",
                "Durable state lives in files, git, and explicit logs. Failures should become guardrails instead of repeated mistakes.",
                f"Use .ralph as the anchor state directory{ralph_location}.",
            ]
        )
        if ralph_role_profile:
            system_parts.append(f"Global Ralph guardrail profile: {ralph_role_profile}.")

    user_parts = [
        f"Objective: {objective}",
        f"Role: {agent.role}",
    ]
    if definition_of_done:
        user_parts.append(f"Definition of done: {definition_of_done}")
    if context:
        user_parts.append(f"Context from other agents:\n{context}")
    if ralph_mode:
        user_parts.append(
            "Update your contribution as if another clean agent may resume from files only. Keep output structured, specific, and implementation-focused."
        )
    if ralph_loop:
        user_parts.append(
            'Return a fenced JSON block as the first block of your reply using this exact schema: ```ralph {"checkoffs":["exact checklist text"],"status":"continue|blocked|complete","notes":"brief status note"} ```. '
            "Use an empty checkoffs array when nothing new is complete. After the fenced block, you may add structured reasoning."
        )
    user_parts.append("Produce a focused contribution, decisions, risks, and next actions for your role.")

    return [
        {"role": "system", "content": " ".join(system_parts)},
        {"role": "user", "content": "\n\n".join(user_parts)},
    ]


def _ralph_context_block(ralph_paths: dict[str, Path]) -> str:
    sections: list[str] = []
    task_text = _read_text(ralph_paths["task"]).strip()
    if task_text:
        sections.append(f"Anchor task file:\n{task_text}")
    guardrails_text = _read_text(ralph_paths["guardrails"]).strip()
    if guardrails_text:
        sections.append(f"Guardrails:\n{guardrails_text}")
    progress_text = _read_text(ralph_paths["progress"]).strip()
    if progress_text:
        sections.append(f"Progress log:\n{progress_text}")
    return "\n\n".join(sections)


async def _execute_single_agent(
    run_data: dict,
    agent_index: int,
    context: str = "",
    ralph_paths: dict[str, Path] | None = None,
    ralph_role_profile: str = "",
):
    agent_record = run_data["agents"][agent_index]
    agent_record["status"] = "running"
    run_data["updatedAt"] = int(time.time() * 1000)
    _save_run(run_data)
    if ralph_paths:
        _append_line(
            ralph_paths["activity"],
            f"[{int(time.time())}] start {agent_record['name']} provider={agent_record['provider']} model={agent_record['model'] or 'default'}\n",
        )

    payload = AgentProfilePayload(
        id=agent_record["id"],
        name=agent_record["name"],
        role=agent_record["role"],
        provider=agent_record["provider"],
        model=agent_record["model"],
        systemPrompt=agent_record.get("systemPrompt", ""),
        openclawTools=agent_record.get("openclawTools", {}) or {},
        enabled=True,
    )
    messages = _build_messages(
        payload,
        run_data["objective"],
        run_data.get("definitionOfDone", ""),
        context,
        run_data.get("ralphMode", False),
        run_data.get("ralphLoop", False),
        ralph_paths,
        ralph_role_profile,
    )
    try:
        output = await _call_provider(payload.provider, payload.model, messages)
        agent_record["status"] = "completed"
        agent_record["output"] = output
        agent_record["error"] = ""
        if ralph_paths:
            _append_line(
                ralph_paths["progress"],
                "\n".join(
                    [
                        f"## {agent_record['name']} ({payload.provider}/{payload.model or 'default'})",
                        output.strip() or "- No output",
                        "",
                    ]
                ),
            )
            _append_line(
                ralph_paths["activity"],
                f"[{int(time.time())}] complete {agent_record['name']}\n",
            )
    except asyncio.CancelledError:
        agent_record["status"] = "cancelled"
        if ralph_paths:
            _append_line(
                ralph_paths["activity"],
                f"[{int(time.time())}] cancelled {agent_record['name']}\n",
            )
        raise
    except Exception as exc:
        agent_record["status"] = "failed"
        agent_record["error"] = str(exc)
        if ralph_paths:
            _append_line(
                ralph_paths["errors"],
                f"[{int(time.time())}] {agent_record['name']}: {exc}\n",
            )
            _append_line(
                ralph_paths["activity"],
                f"[{int(time.time())}] failed {agent_record['name']} error={exc}\n",
            )
    finally:
        run_data["updatedAt"] = int(time.time() * 1000)
        _save_run(run_data)


async def _run_agents(run_id: str, request: AgentRunRequest):
    run_data = json.loads(_run_path(run_id).read_text())
    run_data["status"] = "running"
    run_data["updatedAt"] = int(time.time() * 1000)
    _save_run(run_data)
    ralph_paths = None
    ralph_role_profile = ""

    try:
        if run_data.get("ralphMode"):
            workspace_dir = _resolve_workspace_root(run_data.get("workspaceRoot", "."))
            ralph_state = run_data.get("ralphState") or {}
            ralph_role_profile = (ralph_state.get("roleProfile") or "").strip()
            ralph_paths = _initialize_ralph_state(
                workspace_dir,
                (ralph_state.get("objective") or run_data["objective"]).strip(),
                (ralph_state.get("definitionOfDone") or run_data.get("definitionOfDone", "")).strip(),
                ralph_role_profile,
            )

        if run_data.get("ralphLoop"):
            max_iterations = max(1, min(int(run_data.get("maxIterations", 6) or 6), 25))
            run_data["summary"] = ""
            stalled = False
            if ralph_paths:
                checklist = _checklist_snapshot(ralph_paths["task"])
                run_data["checklist"] = checklist
                if checklist["total"] > 0 and not checklist["remaining"]:
                    run_data["status"] = "completed"
                    run_data["summary"] = "Ralph loop already complete. All checklist items are checked off."
                    _append_line(
                        ralph_paths["activity"],
                        f"[{int(time.time())}] resume requested but checklist already complete\n",
                    )
                    _save_run(run_data)
                    return

            for iteration in range(1, max_iterations + 1):
                run_data["iterationCount"] = iteration
                run_data["updatedAt"] = int(time.time() * 1000)
                for agent in run_data["agents"]:
                    agent["status"] = "queued"
                    agent["output"] = ""
                    agent["error"] = ""
                _save_run(run_data)

                prior_outputs: list[str] = []
                for index, agent in enumerate(run_data["agents"]):
                    if agent["status"] != "queued":
                        continue

                    context_parts: list[str] = []
                    if ralph_paths:
                        context_parts.append(_ralph_context_block(ralph_paths))
                    if prior_outputs:
                        context_parts.append("Current iteration outputs:\n\n" + "\n\n".join(prior_outputs[-3:]))

                    await _execute_single_agent(
                        run_data,
                        index,
                        "\n\n".join(part for part in context_parts if part).strip(),
                        ralph_paths,
                        ralph_role_profile,
                    )
                    if run_data["agents"][index].get("output"):
                        prior_outputs.append(
                            f"{run_data['agents'][index]['name']}:\n{run_data['agents'][index]['output']}"
                        )

                if ralph_paths:
                    all_checkoffs: list[str] = []
                    for agent in run_data["agents"]:
                        all_checkoffs.extend(_extract_checkoffs(agent.get("output", "")))
                    checked_now = _mark_task_items_complete(ralph_paths["task"], all_checkoffs)
                    checklist = _checklist_snapshot(ralph_paths["task"])
                    run_data["checklist"] = checklist
                    run_data["summary"] = (
                        f"Ralph loop iteration {iteration}/{max_iterations}. "
                        f"Checklist: {checklist['completed']}/{checklist['total']} complete.\n\n"
                        + "\n\n".join(
                            f"{agent['name']} ({agent['provider']}):\n{agent.get('output', '')}".strip()
                            for agent in run_data["agents"]
                            if agent.get("output")
                        )
                    ).strip()
                    _append_line(
                        ralph_paths["activity"],
                        (
                            f"[{int(time.time())}] iteration={iteration} "
                            f"checkoffs={checked_now} checklist={checklist['completed']}/{checklist['total']}\n"
                        ),
                    )
                    if checklist["total"] > 0 and not checklist["remaining"]:
                        run_data["status"] = "completed"
                        break
                    if checklist["total"] == 0:
                        run_data["status"] = "completed"
                        run_data["summary"] = (
                            "Ralph loop stopped after one iteration because no checklist items were found in "
                            ".ralph/ralph_task.md.\n\n"
                            + run_data["summary"]
                        )
                        break
                    if checked_now == 0:
                        stalled = True
                        run_data["status"] = "stalled"
                        run_data["summary"] = (
                            "Ralph loop stalled because no checklist items were checked off in the latest "
                            "iteration.\n\n"
                            + run_data["summary"]
                        )
                        break
                else:
                    run_data["status"] = "completed"
                    break

            else:
                run_data["status"] = "stalled"
                checklist = run_data.get("checklist", {"completed": 0, "total": 0, "remaining": []})
                run_data["summary"] = (
                    f"Ralph loop hit the iteration limit ({max_iterations}) before all checklist items were "
                    f"complete ({checklist.get('completed', 0)}/{checklist.get('total', 0)}).\n\n"
                    + run_data.get("summary", "")
                ).strip()

            if ralph_paths and stalled:
                _append_line(
                    ralph_paths["errors"],
                    f"[{int(time.time())}] Ralph loop stalled before completion\n",
                )

        elif run_data["executionMode"] == "sequential":
            prior_outputs: list[str] = []
            for index, agent in enumerate(run_data["agents"]):
                if agent["status"] != "queued":
                    continue
                context_parts = prior_outputs[-3:]
                if ralph_paths and ralph_paths["progress"].exists():
                    progress_text = ralph_paths["progress"].read_text(encoding="utf-8").strip()
                    if progress_text:
                        context_parts.append(f"Persistent progress log:\n{progress_text}")
                context = "\n\n".join(context_parts)
                await _execute_single_agent(
                    run_data,
                    index,
                    context,
                    ralph_paths,
                    ralph_role_profile,
                )
                if run_data["agents"][index].get("output"):
                    prior_outputs.append(
                        f"{run_data['agents'][index]['name']}:\n{run_data['agents'][index]['output']}"
                    )
        else:
            await asyncio.gather(
                *[
                    _execute_single_agent(run_data, index, "", ralph_paths, ralph_role_profile)
                    for index, agent in enumerate(run_data["agents"])
                    if agent["status"] == "queued"
                ]
            )

        if not run_data.get("ralphLoop"):
            statuses = {agent["status"] for agent in run_data["agents"]}
            if "failed" in statuses:
                run_data["status"] = "failed"
            elif statuses == {"cancelled"} or "cancelled" in statuses:
                run_data["status"] = "cancelled"
            else:
                run_data["status"] = "completed"

            completed_outputs = [
                f"{agent['name']} ({agent['provider']}):\n{agent.get('output', '')}".strip()
                for agent in run_data["agents"]
                if agent.get("output")
            ]
            run_data["summary"] = "\n\n".join(completed_outputs)

        if ralph_paths and run_data.get("summary"):
            _append_line(
                ralph_paths["progress"],
                "\n".join(
                    [
                        "## run summary",
                        run_data["summary"],
                        "",
                    ]
                ),
            )
    except asyncio.CancelledError:
        run_data["status"] = "cancelled"
        for agent in run_data["agents"]:
            if agent["status"] in {"queued", "running"}:
                agent["status"] = "cancelled"
        run_data["summary"] = "Run cancelled."
        if ralph_paths:
            _append_line(ralph_paths["activity"], f"[{int(time.time())}] run cancelled\n")
    finally:
        run_data["updatedAt"] = int(time.time() * 1000)
        _save_run(run_data)
        ACTIVE_RUN_TASKS.pop(run_id, None)


@router.post("/run")
async def run_agents(request: AgentRunRequest):
    workspace_dir = _resolve_workspace_root(request.workspaceRoot)
    objective = request.objective.strip()
    definition_of_done = request.definitionOfDone.strip()
    ralph_state = dict(request.ralphState or {})

    if request.resumeRalph:
        resume_state = _load_ralph_resume_state(workspace_dir)
        objective = resume_state["objective"]
        if not definition_of_done:
            definition_of_done = resume_state["definitionOfDone"]
        ralph_state = {
            "objective": objective,
            "definitionOfDone": definition_of_done or resume_state["definitionOfDone"],
            "roleProfile": ralph_state.get("roleProfile") or resume_state.get("roleProfile", ""),
        }

    if not objective:
        raise HTTPException(400, "Objective is required")

    enabled_agents = [agent for agent in request.agents if agent.enabled]
    if not enabled_agents:
        raise HTTPException(400, "At least one enabled agent is required")

    run_id = f"run-{uuid.uuid4().hex[:12]}"
    now = int(time.time() * 1000)
    ralph_mode = request.ralphMode or request.ralphLoop
    execution_mode = "sequential" if ralph_mode else request.executionMode
    run_data = {
        "id": run_id,
        "objective": objective,
        "definitionOfDone": definition_of_done,
        "executionMode": execution_mode,
        "workspaceRoot": request.workspaceRoot.strip() or ".",
        "ralphMode": ralph_mode,
        "ralphLoop": request.ralphLoop,
        "resumeRalph": request.resumeRalph,
        "maxIterations": max(1, min(request.maxIterations, 25)),
        "ralphState": ralph_state,
        "status": "queued",
        "createdAt": now,
        "updatedAt": now,
        "summary": "",
        "agents": [
            {
                "id": agent.id,
                "name": agent.name,
                "role": agent.role,
                "provider": agent.provider,
                "model": agent.model,
                "systemPrompt": agent.systemPrompt,
                "openclawTools": agent.openclawTools,
                "status": "queued",
                "output": "",
                "error": "",
            }
            for agent in enabled_agents
        ],
    }
    _save_run(run_data)

    task = asyncio.create_task(_run_agents(run_id, request))
    ACTIVE_RUN_TASKS[run_id] = task

    return run_data


@router.get("/runs")
async def list_runs():
    return _load_runs()


@router.post("/cancel")
async def cancel_run(request: AgentCancelRequest):
    task = ACTIVE_RUN_TASKS.get(request.run_id)
    if task is None:
        run_file = _run_path(request.run_id)
        if not run_file.exists():
            raise HTTPException(404, "Run not found")
        run_data = json.loads(run_file.read_text())
        return {"status": run_data.get("status", "unknown"), "run_id": request.run_id}

    task.cancel()
    return {"status": "cancelling", "run_id": request.run_id}
