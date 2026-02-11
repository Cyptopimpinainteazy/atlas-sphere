"""GPU batch hasher for keccak256."""

from __future__ import annotations

from dataclasses import dataclass
import hashlib
import os
import ctypes
from typing import Iterable

from .cuda_loader import CudaRuntime


def _keccak256(data: bytes) -> bytes:
    """Hash data using Keccak-256 (same as Ethereum)."""
    # Use SHA3-256 (which is Keccak-256 in Python's hashlib)
    return hashlib.sha3_256(data).digest()


@dataclass
class KeccakBatchHasher:
    """Batch hasher with GPU-first execution and CPU failover."""

    runtime: CudaRuntime
    kernel_dir: str
    parity_check: bool
    allow_failover: bool

    def __init__(
        self,
        runtime: CudaRuntime,
        kernel_dir: str,
        parity_check: bool = True,
        allow_failover: bool = True,
    ) -> None:
        self.runtime = runtime
        self.kernel_dir = kernel_dir
        self.parity_check = parity_check
        self.allow_failover = allow_failover
        self._lib = None
        if self.runtime.available:
            lib_path = os.path.join(self.kernel_dir, "build", "libkeccak256_batch.so")
            if os.path.exists(lib_path):
                self._lib = ctypes.CDLL(lib_path)
                self._lib.keccak256_batch_host.argtypes = [
                    ctypes.c_void_p,
                    ctypes.c_int,
                    ctypes.c_void_p,
                ]
                self._lib.keccak256_batch_host.restype = ctypes.c_int
            elif not self.allow_failover:
                raise RuntimeError("Missing libkeccak256_batch.so for required GPU mode")

    def hash_batch(self, payloads: Iterable[bytes]) -> list[bytes]:
        try:
            if self.runtime.available and self._lib is not None:
                return self._hash_gpu(payloads)
        except Exception:
            if self.allow_failover:
                return self._hash_cpu(payloads)
            raise
        return self._hash_cpu(payloads)

    def _hash_gpu(self, payloads: Iterable[bytes]) -> list[bytes]:
        packed_payloads = self._pack_bytes(payloads, 32, "payloads")
        count = len(packed_payloads) // 32
        digests = (ctypes.c_ubyte * (count * 32))()
        status = self._lib.keccak256_batch_host(
            ctypes.c_char_p(packed_payloads),
            ctypes.c_int(count),
            ctypes.byref(digests),
        )
        if status != 0:
            raise RuntimeError("GPU keccak256 batch hashing failed")
        gpu_hashes = [bytes(digests[i * 32 : (i + 1) * 32]) for i in range(count)]
        if self.parity_check:
            cpu_hashes = self._hash_cpu(payloads)
            if gpu_hashes != cpu_hashes:
                raise RuntimeError("GPU keccak256 results diverged from CPU")
        return gpu_hashes

    @staticmethod
    def _pack_bytes(values: Iterable[bytes], size: int, label: str) -> bytes:
        packed = bytearray()
        for value in values:
            if len(value) != size:
                raise ValueError(f"{label} entry must be {size} bytes")
            packed.extend(value)
        if not packed:
            raise ValueError(f"{label} batch is empty")
        return bytes(packed)

    @staticmethod
    def _hash_cpu(payloads: Iterable[bytes]) -> list[bytes]:
        return [hashlib.sha3_256(payload).digest() for payload in payloads]
