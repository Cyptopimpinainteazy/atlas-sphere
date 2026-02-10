"""State root calculation utilities."""

from __future__ import annotations

import hashlib
from typing import Iterable


def merkle_root(leaves: Iterable[bytes]) -> bytes:
    """Compute a keccak256-based merkle root from leaves."""

    nodes = [hashlib.sha3_256(leaf).digest() for leaf in leaves]
    if not nodes:
        return hashlib.sha3_256(b"").digest()
    while len(nodes) > 1:
        if len(nodes) % 2 == 1:
            nodes.append(nodes[-1])
        next_level: list[bytes] = []
        for i in range(0, len(nodes), 2):
            combined = nodes[i] + nodes[i + 1]
            next_level.append(hashlib.sha3_256(combined).digest())
        nodes = next_level
    return nodes[0]
