"""Atomic swap registry backed by Redis."""

from __future__ import annotations

from dataclasses import dataclass
import json
import time
from typing import Iterable

import redis


@dataclass(frozen=True)
class AtomicSwapRecord:
    swap_id: str
    created_at: float
    timeout_at: float
    svm_validated: bool
    evm_validated: bool
    status: str


class AtomicSwapRegistry:
    """Redis-backed registry for atomic swaps."""

    def __init__(self, redis_url: str) -> None:
        self._client = redis.Redis.from_url(redis_url)
        if not self._client.ping():
            raise RuntimeError("Atomic registry unavailable (Redis ping failed).")

    def register_swap(self, swap_id: str, payload: dict) -> None:
        record = {
            "swap_id": swap_id,
            "created_at": time.time(),
            "timeout_at": time.time() + payload["timeout_seconds"],
            "svm_validated": False,
            "evm_validated": False,
            "status": "PENDING",
            "payload": payload,
        }
        self._client.set(f"swap:{swap_id}", json.dumps(record), ex=payload["timeout_seconds"] + 10)

    def get_swap(self, swap_id: str) -> AtomicSwapRecord | None:
        raw = self._client.get(f"swap:{swap_id}")
        if raw is None:
            return None
        data = json.loads(raw)
        return AtomicSwapRecord(
            swap_id=data["swap_id"],
            created_at=data["created_at"],
            timeout_at=data["timeout_at"],
            svm_validated=data["svm_validated"],
            evm_validated=data["evm_validated"],
            status=data["status"],
        )

    def update_validation(self, swap_id: str, svm_valid: bool, evm_valid: bool) -> None:
        raw = self._client.get(f"swap:{swap_id}")
        if raw is None:
            return
        data = json.loads(raw)
        data["svm_validated"] = svm_valid
        data["evm_validated"] = evm_valid
        self._client.set(f"swap:{swap_id}", json.dumps(data))

    def update_status(self, swap_id: str, status: str) -> None:
        raw = self._client.get(f"swap:{swap_id}")
        if raw is None:
            return
        data = json.loads(raw)
        data["status"] = status
        self._client.set(f"swap:{swap_id}", json.dumps(data))

    def pending_swaps(self) -> Iterable[str]:
        for key in self._client.scan_iter(match="swap:*"):
            data = json.loads(self._client.get(key))
            if data["status"] == "PENDING":
                yield data["swap_id"]
