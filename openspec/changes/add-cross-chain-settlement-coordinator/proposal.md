# Change: Add Cross-Chain Settlement Coordinator

## Why
Atlas Sphere already defines atomic execution across dual VMs (EVM + SVM) via the Atlas Kernel. To extend that atomicity to *external* chains (BTC, EVM L1/L2s), we need a deterministic, event-sourced settlement coordinator and a standardized adapter/message model.

This proposal captures the requirements and the state machine for cross-chain atomic swaps (HTLC / escrow-contract based), plus the message schemas required for UI/API and operational monitoring.

## What Changes
- Add a new OpenSpec capability: `cross-chain-settlement`.
- Define an atomic swap lifecycle state machine (slow-chain-first, fast-chain-second funding, claim/refund paths).
- Standardize JSON-serializable event/message schemas (`SwapIntentCreated`, `EscrowFunded`, `EscrowClaimed`, `EscrowRefunded`, `SwapCompleted`).
- Define a pluggable `ChainAdapter` interface (BTC, EVM, L2s) with finality/reorg risk estimation.
- Define UI/API integration requirements (real-time pending → in-settlement → finalized views).
- Define observability requirements (append-only audit log, alerts, chaos testing scenarios).

## Impact
- New spec capability: `openspec/specs/cross-chain-settlement/spec.md` (via delta in this change).
- Planned code impact (post-approval):
  - A Settlement Coordinator module (off-chain service/library) that consumes chain events, sequences escrows, and emits events.
  - Adapter implementations for BTC + EVM chains.
  - Next.js UI wiring to subscribe to swap events and show settlement progression.

## Non-Goals (this change)
- Shipping the full production implementation before approval.
- Implementing MPC/HSM custody itself (only interface boundaries are specified).
- Replacing existing Atlas Kernel `Comit` semantics (this integrates with them).
