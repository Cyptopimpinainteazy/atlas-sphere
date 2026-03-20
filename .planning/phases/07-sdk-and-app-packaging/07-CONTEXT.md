# Phase 07 Context — SDK and App Packaging

Date: 2026-03-20
Milestone: v1.1 Release Readiness
Owner: Copilot execution session

## Objective

Ensure TypeScript packages and supported app-facing package surfaces build cleanly and match release contract expectations.

## Plan Status

- 07-01: Green package builds for SDK, connector, and Polkawallet workspaces — ✅ COMPLETE (2026-03-20)
- 07-02: Close remaining SDK/API surface gaps required for release — ⏳ IN PROGRESS
- 07-03: Produce release-ready package artifacts and usage docs — ✅ COMPLETE (2026-03-20)

## 07-01 Execution Evidence

Command run from repo root:

- `npm run build:all-packages --if-present`

Observed package builds:

- `@x3-chain/ts-sdk` (`tsc`) — PASS
- `@x3-chain/atomic-swap-sdk` (`tsc`) — PASS
- `@x3-chain/blockchain-adapter` (`tsc`) — PASS
- `@x3-chain/blockchain-connector` (`tsc`) — PASS
- `@x3-chain/x3-wallet` / Polkawallet plugin (`tsup`) — PASS
- `@x3-chain/polkawallet-bridge-adapter` (`tsc`) — PASS

Notes:

- Build emitted non-blocking warnings in Polkawallet plugin bundle (unused imports, mixed default + named export warning), but build completed successfully.
- This satisfies the packaging green gate for configured npm workspaces.

## Inputs Integrated from Phase 6

- Runtime startup safety fix in `runtime/src/fraud_proofs/startup_gate.rs` remains in place and does not regress package build gates.
- Security hardening findings (RPC input caps + pallet origin audit) are now reflected in planning state and carried forward as baseline assumptions for release packaging.

## 07-02 Findings (Current Pass)

- `X3_GAPS_REPORT.md` had stale SDK entries (`SDK-003`, `SDK-004`) pointing at `packages/sdk/*` and marked TODO.
- Verified current implementation already exists in `packages/ts-sdk`:
   - Collateral RPC client in `packages/ts-sdk/src/collateral.ts`
   - SHA256-based hashing path in `packages/ts-sdk/src/svm.ts`
- Updated `X3_GAPS_REPORT.md` to mark `SDK-003` and `SDK-004` as fixed with correct file paths.
- `packages/ts-sdk/src/svm.ts` PDA comment updated to match implementation (SHA256 hashing used; curve validation still simplified by design).
- Re-validated with targeted build: `npm run build --workspace packages/ts-sdk` — PASS.

### Remaining open SDK release gaps

- `SDK-006`: Integration tests against live node (environment-gated)
- `SDK-007`: npm publication/release step

## SDK-006 Execution Attempt (2026-03-20)

### What was executed

1. Attempted local dev-node startup for live tests:
    - `./run-dev-node.sh`
2. Attempted live test directly against public endpoints:
    - `RUN_LIVE_INTEGRATION_TESTS=1 X3_WS_ENDPOINT=wss://testnet.atlassphere.io npm test --workspace packages/ts-sdk -- tests/live.integration.test.ts --runInBand`
    - `RUN_LIVE_INTEGRATION_TESTS=1 X3_WS_ENDPOINT=wss://rpc.atlassphere.io npm test --workspace packages/ts-sdk -- tests/live.integration.test.ts --runInBand`

### Results

- Local dev-node path blocked at build step by upstream Substrate compile failure:
   - `sc-network` `E0080` duplicate variant index in `client/network/src/protocol/message.rs`
   - (`Consensus` and `RemoteCallResponse` both index `6`)
- Public endpoint path reached test execution, but connection test failed with:
   - `ConnectionError: Failed to connect to X3 Chain node at wss://testnet.atlassphere.io`
   - `ConnectionError: Failed to connect to X3 Chain node at wss://rpc.atlassphere.io`
- Gated transfer test correctly skipped without signer secret (`TESTNET_SIGNER_URI` not set).

### Decision

- `SDK-006` remains open, but now has reproducible diagnostics and unblock criteria.

### Unblock path

1. Fix/align Substrate dependency causing `sc-network` compile panic, then re-run local node path.
2. Or provide a reachable X3 WS endpoint (and optionally signer URI) to execute live suite without local node build.

## 07-03 Release Artifacts + Usage Docs

### Artifacts generated

Generated npm tarballs under `.artifacts/phase7-packages/`:

- `x3-chain-ts-sdk-0.1.0.tgz`
- `x3-chain-blockchain-connector-0.1.0.tgz`
- `x3-chain-x3-wallet-0.1.0.tgz`
- `x3-chain-polkawallet-bridge-adapter-0.1.0.tgz`

### Packaging validation

- `npm pack --dry-run` passed for all four target packages.
- `npm pack` (real artifact generation) passed for all four target packages.

### Usage docs packaged

Added package-local usage docs and ensured they are included in published files:

- `packages/ts-sdk/docs/root/README.md`
- `packages/blockchain-connector/docs/root/README.md`
- `packages/polkawallet-plugin/docs/root/README.md`
- `packages/polkawallet-bridge-adapter/docs/root/README.md`

Updated package manifests to include docs for Polkawallet packages:

- `packages/polkawallet-plugin/package.json`
- `packages/polkawallet-bridge-adapter/package.json`

## Next Steps (remaining 07-02)

1. Resolve `SDK-006` environment blocker (local node compile issue or reachable endpoint) and rerun live integration suite.
2. Finalize `SDK-007` publish step when credentials/registry policy are available (dry-run + artifacts are complete).
