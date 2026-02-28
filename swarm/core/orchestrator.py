"""Minimal orchestrator & job distribution classes for local testing."""

from dataclasses import dataclass, field
from typing import Dict, List, Optional, Tuple
import time
import uuid


@dataclass
class GPUCapabilities:
    vendor: str
    device_name: str
    vram_mb: int
    cuda: bool = False
    compute_score: float = 0.0


@dataclass
class Contributor:
    contributor_id: str
    wallet: Optional[str]
    capabilities: GPUCapabilities
    online: bool = True
    utilization: float = 0.0
    temperature_c: float = 0.0
    tasks_completed: int = 0
    tasks_failed: int = 0
    active_task_id: Optional[str] = None
    last_heartbeat_at: float = field(default_factory=time.time)


@dataclass
class Task:
    task_id: str
    workload_type: str
    payload: dict
    required_vram_mb: int = 0
    min_compute_score: float = 0.0
    max_runtime_s: Optional[int] = None
    status: str = "queued"
    created_at: float = field(default_factory=time.time)
    assigned_to: Optional[str] = None


@dataclass
class RequestResult:
    task: Optional[Task]
    reason: Optional[str] = None


class GPUOrchestrator:
    def __init__(self, gpu_manager):
        self.gpu_manager = gpu_manager

    def register_contributor(self, contributor_id: str, wallet: Optional[str], capabilities: GPUCapabilities):
        self.gpu_manager.register(contributor_id, wallet, capabilities)

    def heartbeat(self, contributor_id: str, utilization=None, temperature_c=None, power_w=None, uptime_s=None):
        self.gpu_manager.heartbeat(contributor_id, utilization or 0.0, temperature_c or 0.0)

    def enqueue_task(self, workload_type: str, payload: dict, required_vram_mb: int = 0, min_compute_score: float = 0.0, max_runtime_s: Optional[int] = None, priority=None) -> str:
        return self.gpu_manager.enqueue_task(workload_type, payload, required_vram_mb, min_compute_score, max_runtime_s)

    def request_task(self, contributor_id: str) -> RequestResult:
        return self.gpu_manager.assign_task_to(contributor_id)

    def submit_result(self, contributor_id: str, task_id: str, success: bool, result=None, error=None) -> bool:
        return self.gpu_manager.submit_result(contributor_id, task_id, success, result, error)

    def cancel_task(self, task_id: str) -> bool:
        return self.gpu_manager.cancel_task(task_id)


class AgentJobDistributionManager:
    def __init__(self, total_gpus: int, gpu_orchestrator: GPUOrchestrator):
        self.total_gpus = total_gpus
        self.orch = gpu_orchestrator

    def update_distribution_targets(self, new_dist: dict):
        # Minimal stub for now
        return True
