# Change: Add X3VM Atomic Cross-Chain Swaps (EVM/SVM/BTC)

## Why
Atlas Sphere already targets atomic execution across internal execution domains (EVM + SVM) via the Atlas Kernel and X3VM “atomic windows”. We also have a cross-chain settlement coordinator spec for external chains (BTC + EVM L1/L2).

What’s missing is an end-to-end, direction-agnostic plan that guarantees **atomic swaps across any pair** of: `X3VM (Atlas)`, `EVM`, `SVM`, and `BTC`, with clear escrow primitives, timeouts, finality gating, and a single lifecycle model that is compatible with our existing swap coordinator events.

## What Changes
- Add a new OpenSpec capability: `x3vm-crosschain-swaps`.
- Define a unified swap intent + escrow model that covers these legs:
  - Atlas internal (X3VM-mediated) accounting + internal VM assets
  - External EVM chains (Solidity HTLC escrow contract)
  - External SVM (Solana) chains (SPL-compatible hashlock/timelock escrow program)
  - Bitcoin (script-based HTLC escrow)
- Define direction-agnostic sequences so any chain can be the “slow” or “fast” leg depending on configured finality.
- Define how the swap lifecycle integrates with:
  - X3VM atomic windows (internal effects are **locked/held**, then finalized on settlement)
  - Atlas Kernel canonical ledger (escrow holds, releases, refunds)
  - The existing `cross-chain-settlement` coordinator lifecycle/events (compatibility + extensions only)
- Define security and trust modes (dev/testnet vs production):
  - **Trust-minimized**: verify external chain receipts with on-chain light-client / proof verification where feasible.
  - **Federated**: coordinator + threshold signers with slashing/attestation (explicitly modeled).

## Impact
- New change assets:
  - `openspec/changes/add-x3vm-atomic-crosschain-swaps/specs/x3vm-crosschain-swaps/spec.md`
  - `openspec/changes/add-x3vm-atomic-crosschain-swaps/design.md`
  - `openspec/changes/add-x3vm-atomic-crosschain-swaps/tasks.md`
- Related (existing) work this change composes with:
  - `openspec/changes/add-cross-chain-settlement-coordinator/` (event-sourced coordinator + adapter interface)
  - `openspec/changes/osc-x3-0001/specs/atomic-commit/spec.md` (atomic windows concept)

## Non-Goals
- Implementing the coordinator, adapters, or on-chain pallets in this proposal.
- Selecting a specific MPC/HSM vendor or signing transport.
- Introducing non-HTLC cross-chain primitives (e.g., IBC-like light-client routing) beyond defined “trust-minimized” hooks.
