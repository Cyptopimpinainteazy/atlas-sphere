#!/usr/bin/env python3
"""
Example: Integration with Phase 5 Jury Blockchain Anchoring

This script demonstrates how to integrate with the jury anchoring system:
1. Finalize a jury session
2. Anchor decision to blockchain
3. Wait for confirmation
4. Verify on-chain
5. Update application state
"""

import asyncio
import json
import time
from typing import Optional

import aiohttp


class JuryIntegrationExample:
    """Example integration with jury blockchain anchoring."""

    def __init__(self, jury_url: str = "http://localhost:8080", rpc_url: str = "http://localhost:9944"):
        self.jury_url = jury_url
        self.rpc_url = rpc_url

    async def get_session_details(self, session_id: str) -> dict:
        """Get jury session details."""
        async with aiohttp.ClientSession() as session:
            async with session.get(f"{self.jury_url}/api/jury/sessions/{session_id}") as resp:
                return await resp.json()

    async def finalize_session(self, session_id: str) -> dict:
        """Finalize jury session and get result."""
        async with aiohttp.ClientSession() as session:
            async with session.post(
                f"{self.jury_url}/api/jury/sessions/{session_id}/finalize"
            ) as resp:
                return await resp.json()

    async def check_anchor_status(self, session_id: str) -> dict:
        """Check if decision is anchored on blockchain."""
        async with aiohttp.ClientSession() as session:
            # Query RPC for decision
            payload = {
                "jsonrpc": "2.0",
                "method": "query.atlasJuryAnchor.juryDecisions",
                "params": [session_id],
                "id": 1,
            }
            async with session.post(self.rpc_url, json=payload) as resp:
                result = await resp.json()
                return {
                    "is_anchored": "result" in result,
                    "on_chain": result.get("result", {}),
                }

    async def wait_for_anchor(self, session_id: str, timeout: int = 60) -> bool:
        """Wait for decision to be anchored on blockchain."""
        start = time.time()
        while time.time() - start < timeout:
            status = await self.check_anchor_status(session_id)
            if status["is_anchored"]:
                print(f"✓ Decision anchored at block #{status['on_chain'].get('block_number')}")
                return True
            print(f"Waiting for anchor... ({int(time.time() - start)}s)")
            await asyncio.sleep(2)

        print(f"✗ Anchor timeout after {timeout}s")
        return False

    async def run_complete_flow(self, session_id: str):
        """Run complete jury → decide → anchor → verify flow."""
        print(f"\n🚀 Starting jury integration example for session: {session_id}\n")

        # Step 1: Get session details
        print("Step 1: Fetching session details...")
        try:
            session = await self.get_session_details(session_id)
            print(f"  Session status: {session.get('status')}")
            print(f"  Members: {session.get('member_count')}")
        except Exception as e:
            print(f"  ✗ Error: {e}")
            return False

        # Step 2: Finalize session
        print("\nStep 2: Finalizing jury session...")
        try:
            result = await self.finalize_session(session_id)
            decision = result.get("decision")
            print(f"  ✓ Decision: {decision}")
            print(f"  Result: {'PASS' if decision else 'FAIL'}")
        except Exception as e:
            print(f"  ✗ Error: {e}")
            return False

        # Step 3: Check initial anchor status
        print("\nStep 3: Checking initial anchor status...")
        status = await self.check_anchor_status(session_id)
        if status["is_anchored"]:
            print(f"  ✓ Already anchored!")
        else:
            print(f"  Waiting for anchoring service...")

            # (Anchoring happens automatically in background)
            # Example shows how to wait for it from application

        # Step 4: Wait for anchor
        print("\nStep 4: Waiting for blockchain confirmation...")
        if await self.wait_for_anchor(session_id):
            print("  ✓ Blockchain confirmation received!")
        else:
            print("  ✗ Failed to get confirmation")
            return False

        # Step 5: Verify on-chain
        print("\nStep 5: Verifying decision on blockchain...")
        status = await self.check_anchor_status(session_id)
        on_chain = status.get("on_chain", {})
        print(f"  Block: #{on_chain.get('block_number')}")
        print(f"  Timestamp: {on_chain.get('timestamp')}")
        print(f"  Hash verified: {'✓' if on_chain.get('verified') else '✗'}")

        # Step 6: Update application
        print("\nStep 6: Updating application state...")
        print(f"  ✓ Application can now trust decision is immutable")
        print(f"  ✓ Can trigger downstream contracts")
        print(f"  ✓ Can display to users with confidence")

        print("\n✅ Complete flow successful!\n")
        return True


async def main():
    """Run the example."""
    example = JuryIntegrationExample()

    # You can replace SESSION_ID with actual session ID
    session_id = "session_example_12345"

    try:
        success = await example.run_complete_flow(session_id)
        exit(0 if success else 1)
    except KeyboardInterrupt:
        print("\nInterrupted by user")
        exit(1)


if __name__ == "__main__":
    asyncio.run(main())
