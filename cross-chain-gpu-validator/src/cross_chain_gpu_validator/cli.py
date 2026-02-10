"""CLI entrypoint for the cross-chain validator."""

from __future__ import annotations

import argparse
import os
import time

from cross_chain_gpu_validator.config import load_settings
from cross_chain_gpu_validator.dashboard.server import run_dashboard
from cross_chain_gpu_validator.evm import EvmValidator
from cross_chain_gpu_validator.gpu import CudaRuntime, KeccakBatchHasher, Secp256k1BatchVerifier
from cross_chain_gpu_validator.logging_utils import configure_logging, get_logger
from cross_chain_gpu_validator.metrics import MetricsStore
from cross_chain_gpu_validator.orchestrator import AtomicSwapRegistry, CrossChainOrchestrator
from cross_chain_gpu_validator.svm import SvmValidator
from cross_chain_gpu_validator.benchmark import run_benchmark, write_report


def _run_orchestrator() -> None:
    settings = load_settings()
    configure_logging(settings.log_level)
    logger = get_logger("ccgv")

    runtime = CudaRuntime.detect()
    if settings.require_gpu:
        runtime.require()
    logger.info("cuda runtime detected", extra={"trace_id": "bootstrap", "span_id": "n/a"})

    sig_verifier = Secp256k1BatchVerifier(
        runtime,
        settings.kernel_dir,
        parity_check=settings.gpu_parity_check,
        allow_failover=not settings.require_gpu,
    )
    keccak_hasher = KeccakBatchHasher(
        runtime,
        settings.kernel_dir,
        parity_check=settings.gpu_parity_check,
        allow_failover=not settings.require_gpu,
    )
    evm_validator = EvmValidator(sig_verifier, keccak_hasher)
    svm_validator = SvmValidator(sig_verifier)

    registry = AtomicSwapRegistry(settings.redis_url)
    metrics = MetricsStore()

    orchestrator = CrossChainOrchestrator(registry, svm_validator, evm_validator, metrics)
    logger.info("orchestrator started", extra={"trace_id": "bootstrap", "span_id": "n/a"})

    while True:
        orchestrator.process_pending()
        time.sleep(0.5)


def _run_dashboard() -> None:
    settings = load_settings()
    configure_logging(settings.log_level)
    metrics = MetricsStore()
    static_dir = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "..", "..", "dashboard"))
    run_dashboard(settings.dashboard_host, settings.dashboard_port, metrics, static_dir)


def _run_benchmark(output: str) -> None:
    settings = load_settings()
    report = run_benchmark(svm_tps=1_850_000, evm_tps=1_000_000, duration_seconds=10)
    write_report(report, output)


def main() -> None:
    parser = argparse.ArgumentParser(description="Cross-chain GPU validator")
    sub = parser.add_subparsers(dest="command", required=True)

    sub.add_parser("orchestrator", help="Run the orchestrator")
    sub.add_parser("dashboard", help="Run the dashboard server")
    bench = sub.add_parser("benchmark", help="Run benchmark and emit report")
    bench.add_argument("--output", default="benchmark_report.json")

    args = parser.parse_args()
    if args.command == "orchestrator":
        _run_orchestrator()
    elif args.command == "dashboard":
        _run_dashboard()
    elif args.command == "benchmark":
        _run_benchmark(args.output)


if __name__ == "__main__":
    main()
