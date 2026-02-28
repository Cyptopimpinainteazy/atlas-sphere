"""GPU provider implementations.

MockGpuProvider  — in-memory, immediate completion (for tests)
RustGpuProvider  — stub for future HTTP/FFI to real Rust coordinator
"""

from __future__ import annotations

import hashlib
import uuid
from datetime import datetime, timezone
from typing import Any, Callable, Dict, List, Optional

from swarm.gpu_bridge.schema import (
    GpuExecutionProof,
    GpuTask,
    GpuTaskResult,
    GpuTaskStatus,
    GpuTaskType,
)


# ──────────────────────────────────────────────────────────────────
# Mock provider (deterministic, for unit/integration tests)
# ──────────────────────────────────────────────────────────────────

class MockGpuProvider:
    """In-memory GPU provider that completes tasks instantly.

    Supports:
    - Configurable latency (default: 0 = instant)
    - Injection of custom executors per task type
    - Failure injection via fail_next / fail_tasks
    - Result introspection via .completed / .cancelled dicts
    """

    def __init__(self) -> None:
        self._pending: Dict[str, GpuTask] = {}
        self._results: Dict[str, GpuTaskResult] = {}
        self._cancelled: Dict[str, GpuTask] = {}
        self._executors: Dict[str, Callable[[GpuTask], Dict[str, Any]]] = {}
        self._fail_next: int = 0
        self._fail_task_ids: set[str] = set()
        self._latency_ticks: int = 0  # poll ticks before result
        self._tick_counts: Dict[str, int] = {}

    # ------ Configuration helpers ------

    def register_executor(
        self,
        task_type: str,
        fn: Callable[[GpuTask], Dict[str, Any]],
    ) -> None:
        """Register a custom executor for a task type."""
        self._executors[task_type] = fn

    def set_latency(self, ticks: int) -> None:
        """Set how many poll() calls before a result appears."""
        self._latency_ticks = max(0, ticks)

    def inject_failure(self, count: int = 1) -> None:
        """Next *count* submitted tasks will fail."""
        self._fail_next = count

    def inject_task_failure(self, task_id: str) -> None:
        """Force a specific task to fail on poll."""
        self._fail_task_ids.add(task_id)

    # ------ GpuProvider protocol ------

    async def submit(self, task: GpuTask) -> str:
        tid = task.task_id
        should_fail = False

        if self._fail_next > 0:
            self._fail_next -= 1
            should_fail = True

        if should_fail or tid in self._fail_task_ids:
            self._fail_task_ids.discard(tid)
            self._results[tid] = GpuTaskResult(
                task_id=tid,
                agent_id=task.agent_id,
                status=GpuTaskStatus.FAILED,
                error="injected failure",
            )
        elif self._latency_ticks == 0:
            self._results[tid] = self._execute(task)
        else:
            self._pending[tid] = task
            self._tick_counts[tid] = 0

        return tid

    async def poll(self, task_id: str) -> Optional[GpuTaskResult]:
        # Immediate results (no latency or failed)
        if task_id in self._results:
            return self._results[task_id]

        # Latency simulation
        if task_id in self._pending:
            self._tick_counts[task_id] = self._tick_counts.get(task_id, 0) + 1
            if self._tick_counts[task_id] >= self._latency_ticks:
                task = self._pending.pop(task_id)
                result = self._execute(task)
                self._results[task_id] = result
                return result

        return None

    async def cancel(self, task_id: str) -> bool:
        if task_id in self._pending:
            task = self._pending.pop(task_id)
            self._cancelled[task_id] = task
            self._results[task_id] = GpuTaskResult(
                task_id=task_id,
                agent_id=task.agent_id,
                status=GpuTaskStatus.CANCELLED,
            )
            return True
        return False

    async def list_pending(self) -> List[str]:
        return list(self._pending.keys())

    # ------ Internal ------

    def _execute(self, task: GpuTask) -> GpuTaskResult:
        """Run a task through the appropriate executor."""
        executor = self._executors.get(task.task_type)
        if executor is not None:
            result_data = executor(task)
        else:
            result_data = self._default_execute(task)

        payload_bytes = str(task.payload).encode()
        result_bytes = str(result_data).encode()
        input_hash = hashlib.sha256(payload_bytes).hexdigest()
        output_hash = hashlib.sha256(result_bytes).hexdigest()

        proof = GpuExecutionProof(
            device_fingerprint="mock-gpu-0",
            input_hash=input_hash,
            output_hash=output_hash,
            compute_units_used=len(payload_bytes) + len(result_bytes),
            nonce=abs(hash(task.task_id)) % (2**32),
        )

        return GpuTaskResult(
            task_id=task.task_id,
            status=GpuTaskStatus.COMPLETED,
            agent_id=task.agent_id,
            executor_node="mock-node-0",
            result_data=result_data,
            result_hash=output_hash,
            compute_units_used=proof.compute_units_used,
            execution_proof=proof,
        )

    @staticmethod
    def _default_execute(task: GpuTask) -> Dict[str, Any]:
        """Default mock execution — echoes the payload with metadata."""
        return {
            "echo": task.payload,
            "task_type": task.task_type,
            "agent_id": task.agent_id,
            "mock": True,
        }

    # ------ Introspection ------

    @property
    def completed(self) -> Dict[str, GpuTaskResult]:
        return {k: v for k, v in self._results.items()
                if v.status == GpuTaskStatus.COMPLETED.value}

    @property
    def failed(self) -> Dict[str, GpuTaskResult]:
        return {k: v for k, v in self._results.items()
                if v.status == GpuTaskStatus.FAILED.value}

    @property
    def cancelled_tasks(self) -> Dict[str, GpuTask]:
        return dict(self._cancelled)


# ──────────────────────────────────────────────────────────────────
# Rust coordinator provider (stub — future FFI/HTTP bridge)
# ──────────────────────────────────────────────────────────────────

class RustGpuProvider:
    """Future: talks to the Rust SwarmCoordinator via HTTP or FFI.

    The Rust coordinator runs on axum (port configurable), exposing
    REST endpoints for task submission, polling, and cancellation.

    Not yet implemented — placeholder for Phase 3b wiring.
    """

    def __init__(
        self,
        coordinator_url: str = "http://127.0.0.1:9955",
    ) -> None:
        self._url = coordinator_url

    async def submit(self, task: GpuTask) -> str:
        raise NotImplementedError(
            "RustGpuProvider requires a running Rust coordinator. "
            f"Expected at {self._url}/api/v1/tasks"
        )

    async def poll(self, task_id: str) -> Optional[GpuTaskResult]:
        raise NotImplementedError("RustGpuProvider.poll not yet wired")

    async def cancel(self, task_id: str) -> bool:
        raise NotImplementedError("RustGpuProvider.cancel not yet wired")

    async def list_pending(self) -> List[str]:
        raise NotImplementedError("RustGpuProvider.list_pending not yet wired")
