# Phase 07 Context — SDK and App Packaging

Date: 2026-03-20
Milestone: v1.1 Release Readiness
Owner: Copilot execution session

## Objective

Ensure TypeScript packages and supported app-facing package surfaces build cleanly and match release contract expectations.

## Plan Status

- 07-01: Green package builds for SDK, connector, and Polkawallet workspaces — ✅ COMPLETE (2026-03-20)
- 07-02: Close remaining SDK/API surface gaps required for release — ⏳ IN PROGRESS
- 07-03: Produce release-ready package artifacts and usage docs — ⏳ PENDING

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

## Next Steps (07-02 → 07-03 handoff)

1. Enumerate SDK/API release contract and compare exported surfaces for:
   - `packages/ts-sdk`
   - `packages/blockchain-connector`
   - Polkawallet package surfaces
2. Close any missing/incorrect exports, versioning metadata, or typed API inconsistencies.
3. Define execution path for the two remaining release gaps (`SDK-006`, `SDK-007`).
4. Re-run targeted package builds + tests for changed packages.
