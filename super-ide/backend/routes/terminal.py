"""
Terminal routes — PTY-backed shell sessions plus simple one-shot execution helpers.
"""

import asyncio
import errno
import json
import os
import pty
import signal
import struct
import subprocess
import termios
import fcntl
import uuid
from dataclasses import dataclass
from pathlib import Path
from typing import Literal

from fastapi import APIRouter, HTTPException, WebSocket, WebSocketDisconnect
from pydantic import BaseModel

router = APIRouter()

REPO_ROOT = Path(__file__).resolve().parents[4]
SHELL = os.getenv("SHELL", "/bin/bash")


@dataclass
class TerminalSession:
    cwd: Path
    process: subprocess.Popen
    read_fd: int
    write_fd: int
    transport: Literal["pty", "pipe"]


TERMINAL_SESSIONS: dict[str, TerminalSession] = {}


class TerminalCreateRequest(BaseModel):
    cwd: str = "."


class TerminalExecRequest(BaseModel):
    session_id: str
    command: str


class TerminalSignalRequest(BaseModel):
    signal: str = "INT"


def _resolve_workspace_path(raw_path: str) -> Path:
    requested = (raw_path or ".").strip() or "."
    candidate = (Path(requested) if requested.startswith("/") else (REPO_ROOT / requested)).resolve()

    try:
        candidate.relative_to(REPO_ROOT)
    except ValueError as exc:
        raise HTTPException(400, f"Path escapes workspace: {requested}") from exc

    if not candidate.exists():
        raise HTTPException(404, f"Path not found: {requested}")
    if not candidate.is_dir():
        raise HTTPException(400, f"Not a directory: {requested}")
    return candidate


def _relative_path(path: Path) -> str:
    try:
        relative = path.relative_to(REPO_ROOT)
    except ValueError:
        return "."
    rendered = relative.as_posix()
    return rendered or "."


def _spawn_pipe_shell(cwd: Path) -> TerminalSession:
    env = os.environ.copy()
    env.setdefault("TERM", "xterm-256color")

    process = subprocess.Popen(
        [SHELL, "-i"],
        stdin=subprocess.PIPE,
        stdout=subprocess.PIPE,
        stderr=subprocess.STDOUT,
        cwd=cwd,
        env=env,
        start_new_session=True,
        close_fds=True,
        bufsize=0,
    )
    if process.stdin is None or process.stdout is None:
        raise RuntimeError("Failed to attach terminal pipes")

    read_fd = process.stdout.fileno()
    write_fd = process.stdin.fileno()
    os.set_blocking(read_fd, False)
    os.set_blocking(write_fd, False)
    return TerminalSession(
        cwd=cwd,
        process=process,
        read_fd=read_fd,
        write_fd=write_fd,
        transport="pipe",
    )


def _spawn_shell(cwd: Path) -> TerminalSession:
    master_fd, slave_fd = pty.openpty()
    env = os.environ.copy()
    env.setdefault("TERM", "xterm-256color")

    process = subprocess.Popen(
        [SHELL, "-i"],
        stdin=slave_fd,
        stdout=slave_fd,
        stderr=slave_fd,
        cwd=cwd,
        env=env,
        start_new_session=True,
        close_fds=True,
    )
    os.close(slave_fd)
    os.set_blocking(master_fd, False)
    return TerminalSession(
        cwd=cwd,
        process=process,
        read_fd=master_fd,
        write_fd=master_fd,
        transport="pty",
    )


def _create_shell_session(cwd: Path) -> TerminalSession:
    try:
        return _spawn_shell(cwd)
    except OSError as exc:
        # Some hosts do not expose usable /dev/ptmx access. Fall back to
        # pipe-backed streaming so the terminal still works for shells/builds.
        if exc.errno not in {None, errno.EPERM, errno.EACCES, errno.ENOSPC} and "pty" not in str(exc).lower():
            raise
        return _spawn_pipe_shell(cwd)


def _cleanup_session(session_id: str):
    session = TERMINAL_SESSIONS.pop(session_id, None)
    if not session:
        return

    try:
        os.close(session.read_fd)
    except OSError:
        pass
    if session.write_fd != session.read_fd:
        try:
            os.close(session.write_fd)
        except OSError:
            pass

    if session.process.poll() is None:
        try:
            os.killpg(os.getpgid(session.process.pid), signal.SIGTERM)
        except OSError:
            pass
        try:
            session.process.wait(timeout=2)
        except subprocess.TimeoutExpired:
            try:
                os.killpg(os.getpgid(session.process.pid), signal.SIGKILL)
            except OSError:
                pass


def _resize_pty(master_fd: int, cols: int, rows: int):
    winsize = struct.pack("HHHH", rows, cols, 0, 0)
    fcntl.ioctl(master_fd, termios.TIOCSWINSZ, winsize)


def _signal_value(name: str) -> int:
    normalized = (name or "INT").upper().replace("SIG", "")
    if normalized == "TERM":
        return signal.SIGTERM
    if normalized == "KILL":
        return signal.SIGKILL
    return signal.SIGINT


@router.post("/session")
async def create_terminal_session(req: TerminalCreateRequest):
    cwd = _resolve_workspace_path(req.cwd)
    session_id = f"term-{uuid.uuid4().hex[:12]}"
    session = _create_shell_session(cwd)
    TERMINAL_SESSIONS[session_id] = session
    return {
        "session_id": session_id,
        "cwd": _relative_path(cwd),
        "transport": session.transport,
    }


@router.delete("/session/{session_id}")
async def close_terminal_session(session_id: str):
    if session_id not in TERMINAL_SESSIONS:
        raise HTTPException(404, "Terminal session not found")
    _cleanup_session(session_id)
    return {"status": "closed"}


@router.post("/session/{session_id}/signal")
async def signal_terminal_session(session_id: str, req: TerminalSignalRequest):
    session = TERMINAL_SESSIONS.get(session_id)
    if not session:
        raise HTTPException(404, "Terminal session not found")
    if session.process.poll() is not None:
        raise HTTPException(400, "Terminal process is not running")

    os.killpg(os.getpgid(session.process.pid), _signal_value(req.signal))
    return {"status": "sent", "signal": req.signal.upper()}


@router.post("/execute")
async def execute_terminal_command(req: TerminalExecRequest):
    session = TERMINAL_SESSIONS.get(req.session_id)
    if session is None:
        raise HTTPException(404, "Terminal session not found")

    command = req.command.strip()
    if not command:
        raise HTTPException(400, "Command is required")

    if command == "cd":
        session.cwd = REPO_ROOT
        return {
            "session_id": req.session_id,
            "cwd": _relative_path(session.cwd),
            "stdout": "",
            "stderr": "",
            "exit_code": 0,
        }

    if command.startswith("cd "):
        target = command[3:].strip() or "."
        base = session.cwd if not target.startswith("/") else Path("/")
        next_cwd = _resolve_workspace_path(str((base / target).resolve() if not target.startswith("/") else Path(target)))
        session.cwd = next_cwd
        return {
            "session_id": req.session_id,
            "cwd": _relative_path(session.cwd),
            "stdout": "",
            "stderr": "",
            "exit_code": 0,
        }

    try:
        result = subprocess.run(
            command,
            shell=True,
            executable=SHELL,
            cwd=session.cwd,
            capture_output=True,
            text=True,
            timeout=20,
        )
    except subprocess.TimeoutExpired as exc:
        return {
            "session_id": req.session_id,
            "cwd": _relative_path(session.cwd),
            "stdout": exc.stdout or "",
            "stderr": (exc.stderr or "") + "\nCommand timed out after 20 seconds.",
            "exit_code": 124,
        }

    return {
        "session_id": req.session_id,
        "cwd": _relative_path(session.cwd),
        "stdout": result.stdout,
        "stderr": result.stderr,
        "exit_code": result.returncode,
    }


def _read_session_output(session: TerminalSession) -> bytes | None:
    try:
        return os.read(session.read_fd, 4096)
    except BlockingIOError:
        return None
    except OSError:
        return b""


def _write_session_input(session: TerminalSession, data: str):
    if not data:
        return
    os.write(session.write_fd, data.encode())


@router.websocket("/ws/{session_id}")
async def terminal_websocket(websocket: WebSocket, session_id: str):
    session = TERMINAL_SESSIONS.get(session_id)
    if not session:
        await websocket.close(code=4404)
        return

    await websocket.accept()

    async def stream_output():
        while True:
            data = _read_session_output(session)
            if data is None:
                if session.process.poll() is not None:
                    break
                await asyncio.sleep(0.02)
                continue
            if not data:
                if session.process.poll() is not None:
                    break
                await asyncio.sleep(0.02)
                continue

            await websocket.send_text(data.decode(errors="replace"))

        while True:
            data = _read_session_output(session)
            if not data:
                break
            await websocket.send_text(data.decode(errors="replace"))

        await websocket.close()

    async def receive_input():
        while True:
            payload = await websocket.receive_text()
            try:
                message = json.loads(payload)
            except json.JSONDecodeError:
                _write_session_input(session, payload)
                continue

            message_type = message.get("type")
            if message_type == "input":
                data = message.get("data", "")
                if data:
                    _write_session_input(session, data)
            elif message_type == "resize":
                cols = int(message.get("cols", 80))
                rows = int(message.get("rows", 24))
                if session.transport == "pty":
                    _resize_pty(session.read_fd, cols, rows)
            elif message_type == "signal":
                if session.process.poll() is None:
                    os.killpg(os.getpgid(session.process.pid), _signal_value(message.get("signal", "INT")))

    try:
        await asyncio.gather(stream_output(), receive_input())
    except WebSocketDisconnect:
        return
    except Exception:
        try:
            await websocket.close(code=1011)
        except Exception:
            pass
