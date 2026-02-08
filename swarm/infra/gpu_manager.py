"""In-memory GPU manager for local testing."""

from dataclasses import dataclass, field
from typing import Dict, List, Optional
import time
import uuid
from swarm.core.orchestrator import GPUCapabilities, Contributor, Task


class GPUManager:
    def __init__(self, total_gpus: int = 0):
        self.total_gpus = total_gpus
        self.contributors: Dict[str, Contributor] = {}
        self.tasks: Dict[str, Task] = {}
        self.queue: List[Task] = []

    # Contributor management
    def register(self, contributor_id: str, wallet: Optional[str], capabilities: GPUCapabilities):
        c = Contributor(contributor_id=contributor_id, wallet=wallet, capabilities=capabilities)
        self.contributors[contributor_id] = c
        return c

    def heartbeat(self, contributor_id: str, utilization: float, temperature_c: float):
        c = self.contributors.get(contributor_id)
        if c:
            c.utilization = utilization
            c.temperature_c = temperature_c
            c.last_heartbeat_at = time.time()
            c.online = True

    def mark_offline(self, contributor_id: str):
        c = self.contributors.get(contributor_id)
        if c:
            c.online = False

    def list_contributors(self) -> List[Contributor]:
        return list(self.contributors.values())

    # Task management
    def enqueue_task(self, workload_type: str, payload: dict, required_vram_mb: int = 0, min_compute_score: float = 0.0, max_runtime_s: Optional[int] = None) -> str:
        tid = str(uuid.uuid4())
        t = Task(task_id=tid, workload_type=workload_type, payload=payload, required_vram_mb=required_vram_mb, min_compute_score=min_compute_score, max_runtime_s=max_runtime_s)
        self.tasks[tid] = t
        self.queue.append(t)
        return tid

    def assign_task_to(self, contributor_id: str):
        c = self.contributors.get(contributor_id)
        if not c or not c.online:
            return type('R', (), {'task': None, 'reason': 'contributor offline or unknown'})()
        # Simple FIFO: pop first queued task
        if not self.queue:
            return type('R', (), {'task': None, 'reason': 'no tasks queued'})()
        t = self.queue.pop(0)
        t.status = 'assigned'
        t.assigned_to = contributor_id
        c.active_task_id = t.task_id
        return type('R', (), {'task': t, 'reason': None})()

    def submit_result(self, contributor_id: str, task_id: str, success: bool, result=None, error=None) -> bool:
        t = self.tasks.get(task_id)
        c = self.contributors.get(contributor_id)
        if not t or not c:
            return False
        t.status = 'completed' if success else 'failed'
        c.active_task_id = None
        if success:
            c.tasks_completed += 1
        else:
            c.tasks_failed += 1
        return True

    def cancel_task(self, task_id: str) -> bool:
        t = self.tasks.get(task_id)
        if not t:
            return False
        t.status = 'cancelled'
        try:
            self.queue = [q for q in self.queue if q.task_id != task_id]
        except Exception:
            pass
        return True

    def list_tasks(self, limit: int = 100):
        return list(self.tasks.values())[:limit]

    def queue_depth(self) -> int:
        return len(self.queue)

    def get_queue_stats(self):
        return {'queued': len(self.queue)}

    def get_task(self, task_id: str) -> Optional[Task]:
        return self.tasks.get(task_id)
