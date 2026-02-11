"""GPU batch verifier for secp256k1 signatures."""

from __future__ import annotations

from dataclasses import dataclass
import os
from typing import Iterable
import ctypes

from .cuda_loader import CudaRuntime

# ---------------------------------------------------------------------------
# Module-level secp256k1 curve constants (computed once at import time)
# ---------------------------------------------------------------------------
_P = 0xFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFEFFFFFC2F
_N = 0xFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFEBAAEDCE6AF48A03BBFD25E8CD0364141
_GX = 0x79BE667EF9DCBBAC55A06295CE870B07029BFCDB2DCE28D959F2815B16F81798
_GY = 0x483ADA7726A3C4655DA4FBFC0E1108A8FD17B448A68554199C47D08FFB10D4B8
_G: tuple[int, int] = (_GX, _GY)

Point = tuple[int, int] | None

# ---------------------------------------------------------------------------
# Pure-Python elliptic-curve helpers (used by CPU fallback)
# ---------------------------------------------------------------------------

def _inv(x: int, mod: int = _P) -> int:
    """Modular inverse via Python's built-in pow."""
    return pow(x, -1, mod)


def _point_add(p1: Point, p2: Point) -> Point:
    if p1 is None:
        return p2
    if p2 is None:
        return p1
    x1, y1 = p1
    x2, y2 = p2
    if x1 == x2 and (y1 + y2) % _P == 0:
        return None
    if x1 == x2 and y1 == y2:
        lam = (3 * x1 * x1) * _inv(2 * y1 % _P) % _P
    else:
        lam = (y2 - y1) * _inv((x2 - x1) % _P) % _P
    x3 = (lam * lam - x1 - x2) % _P
    y3 = (lam * (x1 - x3) - y1) % _P
    return x3, y3


def _point_neg(pt: Point) -> Point:
    if pt is None:
        return None
    return (pt[0], (-pt[1]) % _P)


def _scalar_mul_simple(k: int, point: Point) -> Point:
    """Double-and-add scalar multiplication (for arbitrary points)."""
    result: Point = None
    addend = point
    while k:
        if k & 1:
            result = _point_add(result, addend)
        addend = _point_add(addend, addend)
        k >>= 1
    return result


def _build_window_table(base: Point, window: int = 4) -> list[Point]:
    """Pre-compute [0*base, 1*base, ..., (2^w-1)*base]."""
    table: list[Point] = [None]
    for i in range(1, 1 << window):
        table.append(_point_add(table[i - 1], base))
    return table


def _scalar_mul_windowed(k: int, table: list[Point], window: int = 4) -> Point:
    """Fixed-window scalar multiplication using a precomputed table."""
    mask = (1 << window) - 1
    result: Point = None
    bits = k.bit_length()
    # Process from most-significant window down
    top = ((bits + window - 1) // window) * window
    for i in range(top, 0, -window):
        for _ in range(window):
            result = _point_add(result, result)  # double
        idx = (k >> (i - window)) & mask
        if idx:
            result = _point_add(result, table[idx])
    return result


# Pre-compute table for generator point G (done once at import)
_G_TABLE = _build_window_table(_G, 4)


def _scalar_mul_G(k: int) -> Point:
    """Fast scalar multiplication k*G using precomputed window table."""
    return _scalar_mul_windowed(k, _G_TABLE, 4)


def _multi_scalar_mul(u1: int, u2: int, pubkey_point: Point) -> Point:
    """Shamir's trick: compute u1*G + u2*Q in a single pass (~40% faster)."""
    if u1 == 0 and u2 == 0:
        return None
    g = _G
    q = pubkey_point
    gq = _point_add(g, q)  # G + Q (precomputed)
    result: Point = None
    # Walk bits from MSB to LSB
    length = max(u1.bit_length(), u2.bit_length())
    for i in range(length - 1, -1, -1):
        result = _point_add(result, result)  # double
        b1 = (u1 >> i) & 1
        b2 = (u2 >> i) & 1
        if b1 and b2:
            result = _point_add(result, gq)
        elif b1:
            result = _point_add(result, g)
        elif b2:
            result = _point_add(result, q)
    return result


@dataclass
class Secp256k1BatchVerifier:
    """Batch verifier with GPU-first execution and CPU failover."""

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
            lib_path = os.path.join(self.kernel_dir, "build", "libsecp256k1_batch.so")
            if os.path.exists(lib_path):
                self._lib = ctypes.CDLL(lib_path)
                self._lib.secp256k1_ecdsa_verify_host.argtypes = [
                    ctypes.c_void_p,
                    ctypes.c_void_p,
                    ctypes.c_void_p,
                    ctypes.c_int,
                    ctypes.c_void_p,
                ]
                self._lib.secp256k1_ecdsa_verify_host.restype = ctypes.c_int
            elif not self.allow_failover:
                raise RuntimeError("Missing libsecp256k1_batch.so for required GPU mode")

    def verify_batch(
        self, signatures: Iterable[bytes], messages: Iterable[bytes], pubkeys: Iterable[bytes]
    ) -> list[bool]:
        """Verify a batch of signatures with GPU preference.

        This uses a placeholder CPU parity check for now; replace with actual
        secp256k1 GPU kernel bindings.
        """

        try:
            if self.runtime.available and self._lib is not None:
                return self._verify_gpu(signatures, messages, pubkeys)
        except Exception:
            if self.allow_failover:
                return self._verify_cpu(signatures, messages, pubkeys)
            raise
        return self._verify_cpu(signatures, messages, pubkeys)

    def _verify_gpu(self, signatures: Iterable[bytes], messages: Iterable[bytes], pubkeys: Iterable[bytes]) -> list[bool]:
        signatures_list = list(signatures)
        messages_list = list(messages)
        pubkeys_list = list(pubkeys)

        count = len(messages_list)
        if count == 0:
            raise ValueError("signatures batch is empty")
        if len(signatures_list) != count or len(pubkeys_list) != count:
            raise ValueError("signature, message, and pubkey batch sizes must match")

        u1_bytes, u2_bytes, r_values = self._compute_u1_u2(signatures_list, messages_list)
        packed_pubkeys = self._pack_bytes(pubkeys_list, 64, "pubkeys")

        out_x = (ctypes.c_ubyte * (count * 32))()
        status = self._lib.secp256k1_ecdsa_verify_host(
            ctypes.c_char_p(u1_bytes),
            ctypes.c_char_p(u2_bytes),
            ctypes.c_char_p(packed_pubkeys),
            ctypes.c_int(count),
            ctypes.byref(out_x),
        )
        if status != 0:
            raise RuntimeError("GPU secp256k1 batch verification failed")

        gpu_results = []
        for idx in range(count):
            x_bytes = bytes(out_x[idx * 32 : (idx + 1) * 32])
            x_value = int.from_bytes(x_bytes, "big") % self._curve_order()
            gpu_results.append(x_value == r_values[idx])

        if self.parity_check:
            cpu_results = self._verify_cpu(signatures_list, messages_list, pubkeys_list)
            if gpu_results != cpu_results:
                raise RuntimeError("GPU secp256k1 results diverged from CPU")
        return gpu_results

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
    def _curve_order() -> int:
        return _N

    def _compute_u1_u2(
        self, signatures: list[bytes], messages: list[bytes]
    ) -> tuple[bytes, bytes, list[int]]:
        order = self._curve_order()
        u1_parts: list[bytes] = []
        u2_parts: list[bytes] = []
        r_values: list[int] = []

        for signature, message in zip(signatures, messages):
            if len(signature) != 64:
                raise ValueError("signature must be 64 bytes (r||s)")
            if len(message) != 32:
                raise ValueError("message must be 32 bytes")
            r = int.from_bytes(signature[:32], "big")
            s = int.from_bytes(signature[32:], "big")
            if r == 0 or s == 0 or r >= order or s >= order:
                u1 = 0
                u2 = 0
            else:
                z = int.from_bytes(message, "big")
                w = pow(s, -1, order)
                u1 = (z * w) % order
                u2 = (r * w) % order
            u1_parts.append(u1.to_bytes(32, "big"))
            u2_parts.append(u2.to_bytes(32, "big"))
            r_values.append(r)

        return b"".join(u1_parts), b"".join(u2_parts), r_values

    @staticmethod
    def _verify_cpu(
        signatures: Iterable[bytes], messages: Iterable[bytes], pubkeys: Iterable[bytes]
    ) -> list[bool]:
        results: list[bool] = []
        for signature, message, pubkey in zip(signatures, messages, pubkeys):
            if len(signature) != 64 or len(message) != 32 or len(pubkey) != 64:
                results.append(False)
                continue
            r = int.from_bytes(signature[:32], "big")
            s = int.from_bytes(signature[32:], "big")
            if r == 0 or s == 0 or r >= _N or s >= _N:
                results.append(False)
                continue
            z = int.from_bytes(message, "big")
            w = _inv(s, _N)
            u1 = (z * w) % _N
            u2 = (r * w) % _N
            pub_x = int.from_bytes(pubkey[:32], "big")
            pub_y = int.from_bytes(pubkey[32:], "big")
            # Shamir's trick: u1*G + u2*Q in one pass
            point = _multi_scalar_mul(u1, u2, (pub_x, pub_y))
            if point is None:
                results.append(False)
                continue
            x_coord = point[0] % _N
            results.append(x_coord == r)
        return results
