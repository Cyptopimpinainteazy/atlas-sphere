# Phase 08 Context — Testnet Proving and Go/No-Go

Date: 2026-03-21
Milestone: v1.1 Release Readiness
Owner: Copilot execution session

## Objective

Phase 8 validates startup/testnet behavior and prepares release decision artifacts.

## 08-01 Execution (Startup smoke + local multi-validator verification)

### Startup smoke (PASS)

Command:

- `bash tests/startup_smoke.sh`

Observed results:

- `[OK] Ollama /api/tags reachable`
- `[OK] Blockchain JSON-RPC responding at http://127.0.0.1:9944`
- `[OK] Swarm readiness OK at http://127.0.0.1:8080/ready`
- `[OK] App ports 3000/3001/3002/3003 listening`

Conclusion: startup smoke gate passes in current environment.

### Multi-validator launch verification (PARTIAL PASS)

Command sequence:

- `bash scripts/launch-testnet.sh all`
- `bash scripts/launch-testnet.sh status`
- Per-node `system_health` on ports `9944..9947`

Observed results:

- 4 validator processes launched and reported as running.
- All 4 RPC endpoints respond.
- `system_health.peers` reported `3` on each node, indicating local mesh connectivity.

### Consensus progression check (BLOCKED)

Command:

- Sampled `chain_getHeader` and `chain_getFinalizedHead` twice (6s apart) on `9944..9947`.

Observed results:

- `best_block` stayed at `0` on all nodes.
- `finalized_head` stayed at genesis on all nodes.

Assessment:

- Network-level multi-validator connectivity is verified.
- Block production/finality did not progress, so full `08-01` consensus verification remains blocked.
- This points to local authority/key or chain-spec alignment issues for this testnet launch path.

## Fixes Applied During 08-01

Updated `scripts/launch-testnet.sh`:

1. Corrected repo-root binary path resolution (`target/release/x3-chain-node`).
2. Assigned unique Prometheus ports per validator to avoid bind conflicts.
3. Added bootnode wiring for validator2..4 based on validator1 peer ID.
4. Enabled `--allow-private-ip` and `--force-authoring` for local peering/testing.

## Next Actions to close 08-01

1. Align validator authority keys with testnet chain spec used by `scripts/launch-testnet.sh`.
2. Re-run 4-validator launch and verify block/finality progression (`best_block > 0`, advancing finalized head).
3. Once progression is confirmed, mark `08-01` complete and proceed to `08-02`.
