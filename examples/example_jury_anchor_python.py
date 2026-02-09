#!/usr/bin/env python3
"""
Example: Complete Jury Decision Anchoring Flow

This example demonstrates:
1. Creating a jury session
2. Collecting votes from 5 jurors
3. Finalizing the decision
4. Anchoring to blockchain
5. Verifying on-chain hash
"""

import asyncio
import json
import logging
from typing import Dict, List

import aiohttp
from pydantic import BaseModel

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# Configuration
JURY_SERVICE_URL = "http://localhost:8080"
RPC_URL = "http://localhost:9944"


class Vote(BaseModel):
    juror_id: str
    salt: str
    vote_hash: str


class JuryDecision(BaseModel):
    session_id: str
    votes: List[Vote]
    result: str  # "PASS" or "FAIL"
    quorum_met: bool


async def create_jury_session(topic: str) -> str:
    """Create a new jury session"""
    logger.info(f"Creating jury session for: {topic}")

    async with aiohttp.ClientSession() as session:
        async with session.post(
            f"{JURY_SERVICE_URL}/api/sessions",
            json={"topic": topic, "quorum": 3},
        ) as response:
            data = await response.json()
            session_id = data["session_id"]
            logger.info(f"  ✓ Session created: {session_id}")
            return session_id


async def collect_votes(session_id: str, votes: List[Dict]) -> bool:
    """Collect commit-reveal votes from jurors"""
    logger.info(f"Collecting votes for session {session_id}...")

    async with aiohttp.ClientSession() as session:
        for vote in votes:
            response = await session.post(
                f"{JURY_SERVICE_URL}/api/sessions/{session_id}/votes",
                json=vote,
            )
            if response.status == 201:
                logger.info(f"  ✓ Vote recorded from {vote['juror_id']}")
            else:
                logger.error(f"  ✗ Failed to record vote: {response.status}")
                return False

    return True


async def finalize_jury(session_id: str) -> JuryDecision:
    """Finalize jury decision"""
    logger.info(f"Finalizing jury session {session_id}...")

    async with aiohttp.ClientSession() as session:
        response = await session.post(
            f"{JURY_SERVICE_URL}/api/sessions/{session_id}/finalize"
        )
        data = await response.json()

        decision = JuryDecision(
            session_id=session_id,
            votes=data["votes"],
            result=data["result"],
            quorum_met=data["quorum_met"],
        )

        logger.info(
            f"  ✓ Decision: {decision.result} "
            f"(quorum: {decision.quorum_met})"
        )
        return decision


async def anchor_decision(decision: JuryDecision) -> str:
    """Anchor decision to blockchain"""
    logger.info(f"Anchoring decision to blockchain...")

    # Compute decision hash
    decision_hash = compute_decision_hash(decision)
    logger.info(f"  Decision hash: {decision_hash}")

    async with aiohttp.ClientSession() as session:
        # Submit anchor transaction
        payload = {
            "session_id": decision.session_id,
            "decision_hash": decision_hash,
        }

        async with session.post(
            f"{JURY_SERVICE_URL}/api/anchor", json=payload
        ) as response:
            if response.status == 200:
                tx_hash = (await response.json())["tx_hash"]
                logger.info(f"  ✓ Anchoring submitted: {tx_hash}")
                return tx_hash
            else:
                logger.error(f"  ✗ Anchor failed: {response.status}")
                raise Exception("Anchor failed")


async def wait_for_anchor(session_id: str, timeout: int = 30) -> bool:
    """Wait for decision to be anchored on blockchain"""
    logger.info(f"Waiting for anchor confirmation (timeout: {timeout}s)...")

    async with aiohttp.ClientSession() as session:
        start = asyncio.get_event_loop().time()

        while True:
            elapsed = asyncio.get_event_loop().time() - start
            if elapsed > timeout:
                logger.error("  ✗ Timeout waiting for anchor")
                return False

            response = await session.get(
                f"{JURY_SERVICE_URL}/api/anchor/{session_id}/status"
            )
            data = await response.json()

            if data.get("status") == "anchored":
                logger.info(f"  ✓ Anchored on block #{data['block_number']}")
                return True

            await asyncio.sleep(2)


async def verify_anchor(session_id: str, decision_hash: str) -> bool:
    """Verify decision on blockchain"""
    logger.info("Verifying anchor on blockchain...")

    async with aiohttp.ClientSession() as session:
        async with session.post(
            f"{RPC_URL}",
            json={
                "jsonrpc": "2.0",
                "method": "query.atlasJuryAnchor.verifyDecision",
                "params": [session_id, decision_hash],
                "id": 1,
            },
        ) as response:
            result = await response.json()

            if result.get("result", {}).get("is_verified"):
                logger.info("  ✓ Decision verified on blockchain!")
                return True
            else:
                logger.error("  ✗ Verification failed")
                return False


def compute_decision_hash(decision: JuryDecision) -> str:
    """Compute SHA256 hash of decision"""
    import hashlib

    data = {
        "session_id": decision.session_id,
        "votes_count": len(decision.votes),
        "result": decision.result,
        "quorum_met": decision.quorum_met,
    }

    hash_str = hashlib.sha256(
        json.dumps(data, sort_keys=True).encode()
    ).hexdigest()

    return f"0x{hash_str}"


async def main():
    """Run complete jury → anchor → verify flow"""
    logger.info("=" * 60)
    logger.info("Phase 5: Jury Blockchain Anchoring - Example Flow")
    logger.info("=" * 60)

    # Create session
    session_id = await create_jury_session(
        "Is the new feature production-ready?"
    )

    # Define votes
    votes = [
        {
            "juror_id": "juror_1",
            "salt": "salt_123",
            "vote_hash": "0xabc123",
        },
        {
            "juror_id": "juror_2",
            "salt": "salt_456",
            "vote_hash": "0xabc123",
        },
        {
            "juror_id": "juror_3",
            "salt": "salt_789",
            "vote_hash": "0xdef456",
        },
        {
            "juror_id": "juror_4",
            "salt": "salt_012",
            "vote_hash": "0xabc123",
        },
        {
            "juror_id": "juror_5",
            "salt": "salt_345",
            "vote_hash": "0xabc123",
        },
    ]

    # Collect votes
    if not await collect_votes(session_id, votes):
        logger.error("Failed to collect votes")
        return

    # Finalize
    decision = await finalize_jury(session_id)

    # Anchor to blockchain
    tx_hash = await anchor_decision(decision)

    # Wait for confirmation
    if not await wait_for_anchor(session_id):
        logger.error("Anchor confirmation timeout")
        return

    # Verify on-chain
    decision_hash = compute_decision_hash(decision)
    if await verify_anchor(session_id, decision_hash):
        logger.info("=" * 60)
        logger.info("✓ SUCCESS: Decision anchored and verified!")
        logger.info("=" * 60)
    else:
        logger.error("✗ FAILED: Verification did not match")


if __name__ == "__main__":
    asyncio.run(main())
