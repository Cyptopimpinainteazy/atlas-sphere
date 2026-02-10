"""Cross-chain orchestrator enforcing atomic swap invariants across N chains."""

from __future__ import annotations

from dataclasses import dataclass, field
import time
from typing import Iterable

from cross_chain_gpu_validator.chain_adapter import ChainTransaction
from cross_chain_gpu_validator.chain_registry import ChainRegistry
from cross_chain_gpu_validator.metrics import MetricsStore
from .registry import AtomicSwapRegistry


@dataclass(frozen=True)
class MultiChainSwapPayload:
    """Generic multi-chain atomic swap payload."""

    swap_id: str
    chain_transactions: dict[str, list[ChainTransaction]]  # chain_id -> transactions
    timeout_seconds: int


@dataclass(frozen=True)
class AtomicSwapPayload:
    """Legacy 2-chain atomic swap payload (SVM + EVM) for backward compatibility."""

    swap_id: str
    svm_transactions: list[ChainTransaction] = field(default_factory=list)
    evm_transactions: list[ChainTransaction] = field(default_factory=list)
    timeout_seconds: int = 30


class MultiChainOrchestrator:
    """Coordinates validation across N chains with atomic guarantees."""

    def __init__(
        self,
        registry: AtomicSwapRegistry,
        chain_registry: ChainRegistry,
        metrics: MetricsStore,
    ) -> None:
        self._registry = registry
        self._chain_registry = chain_registry
        self._metrics = metrics
        self._rollbacks = 0
        self._approvals = 0
        self._payloads: dict[str, MultiChainSwapPayload] = {}

    def submit_swap(self, payload: MultiChainSwapPayload) -> None:
        """Submit a multi-chain atomic swap."""
        # Validate all chains are registered
        if not self._chain_registry.validate_enabled_chains(payload.chain_transactions.keys()):
            raise ValueError("One or more chains in swap are not registered")

        swap_registry_data = {
            "timeout_seconds": payload.timeout_seconds,
            "chain_count": len(payload.chain_transactions),
        }
        for chain_id, txs in payload.chain_transactions.items():
            swap_registry_data[f"{chain_id}_count"] = len(txs)

        self._registry.register_swap(payload.swap_id, swap_registry_data)
        self._payloads[payload.swap_id] = payload

    def process_pending(self) -> None:
        """Process all pending atomic swaps."""
        for swap_id in self._registry.pending_swaps():
            record = self._registry.get_swap(swap_id)
            if record is None:
                continue

            # Check timeout
            if time.time() > record.timeout_at:
                self._registry.update_status(swap_id, "FAILED")
                self._rollbacks += 1
                continue

            # Get payload
            payload = self._payloads.get(swap_id)
            if payload is None:
                self._registry.update_status(swap_id, "FAILED")
                self._rollbacks += 1
                continue

            # Validate all chains
            all_valid = True
            chain_results: dict[str, bool] = {}

            for chain_id, txs in payload.chain_transactions.items():
                validator = self._chain_registry.get_validator(chain_id)
                if validator is None:
                    all_valid = False
                    chain_results[chain_id] = False
                    continue

                results = validator.validate_transactions(txs)
                chain_valid = all(results)
                chain_results[chain_id] = chain_valid
                if not chain_valid:
                    all_valid = False

            # Update registry with results
            self._registry.update_status(
                swap_id,
                "APPROVED" if all_valid else "FAILED"
            )

            if all_valid:
                self._approvals += 1
            else:
                self._rollbacks += 1

        self._update_metrics()

    def validate_swap(self, payload: MultiChainSwapPayload) -> bool:
        """Validate a swap without updating registry."""
        for chain_id, txs in payload.chain_transactions.items():
            validator = self._chain_registry.get_validator(chain_id)
            if validator is None:
                return False
            results = validator.validate_transactions(txs)
            if not all(results):
                return False
        return True

    def get_swap_status(self, swap_id: str) -> dict | None:
        """Get status of a swap."""
        record = self._registry.get_swap(swap_id)
        if record is None:
            return None
        return {
            "swap_id": swap_id,
            "status": record.status,
            "created_at": record.created_at,
            "timeout_at": record.timeout_at,
            "expired": time.time() > record.timeout_at,
        }

    def _update_metrics(self) -> None:
        total = max(self._approvals + self._rollbacks, 1)
        success_rate = self._approvals / total
        self._metrics.update_atomic(success_rate, self._rollbacks)


class CrossChainOrchestrator(MultiChainOrchestrator):
    """Backward-compatible orchestrator for 2-chain (Solana + Ethereum) swaps.
    
    This is a legacy wrapper that maintains compatibility with the original
    SVM/EVM orchestrator while delegating to MultiChainOrchestrator.
    """

    def __init__(
        self,
        registry: AtomicSwapRegistry,
        chain_registry: ChainRegistry,
        metrics: MetricsStore,
    ) -> None:
        super().__init__(registry, chain_registry, metrics)

    def submit_swap_legacy(self, payload: AtomicSwapPayload) -> None:
        """Submit a 2-chain swap in legacy format."""
        chain_txs: dict[str, list[ChainTransaction]] = {}
        if payload.svm_transactions:
            chain_txs["solana"] = payload.svm_transactions
        if payload.evm_transactions:
            chain_txs["ethereum"] = payload.evm_transactions

        multi_payload = MultiChainSwapPayload(
            swap_id=payload.swap_id,
            chain_transactions=chain_txs,
            timeout_seconds=payload.timeout_seconds,
        )
        self.submit_swap(multi_payload)
