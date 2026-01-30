## Context
We want atomic swaps between any two of {Atlas/X3VM, EVM, SVM, BTC}. “Atomic” here means: either both legs settle (each participant receives the intended asset) or each participant can unilaterally recover their own funds via refund paths after timeouts.

Atlas already has a strong internal atomicity primitive (Atlas Kernel `Comit` and X3VM atomic windows), but external chains do not share a synchronous commit boundary. Therefore the design uses escrow-based atomicity (hashlock + timelock) on each external chain, and a native Atlas escrow-hold that integrates with the canonical ledger.

## Goals / Non-Goals
- Goals:
  - Direction-agnostic swaps: any chain can be A or B.
  - Single lifecycle model compatible with `cross-chain-settlement` events.
  - Internal Atlas leg is safe: funds are locked until settlement, never “minted out of thin air”.
  - Clear reorg/finality gating policy per chain.
- Non-Goals:
  - Replacing Atlas Kernel `Comit` semantics.
  - Shipping a production-grade BTC light client in this change.

## System Components
1. **X3VM Swap Program (on-chain intent authoring)**
   - An X3 program creates a `SwapIntent` describing both legs, timeouts, secret hash, recipients, and policy.
   - The program can open an atomic window to perform internal preparatory actions (e.g., reserve balance, lock internal VM asset).

2. **Atlas Escrow Hold (runtime / pallet boundary)**
   - Native escrow primitive for the Atlas leg: `hold`, `release(preimage)`, `refund(timeout)`.
   - Must be callable by the swap coordinator (or by any user, if a valid preimage is provided).

3. **Settlement Coordinator (off-chain)**
   - Event-sourced state machine as specified in `cross-chain-settlement`.
   - Chooses “slow-first” funding order by default based on chain risk policy.
   - Watches funding, claim, and refund events; triggers the next step by requesting signatures/broadcasts.

4. **Chain Adapters (off-chain, pluggable)**
   - EVM adapter: deploy/use standard HTLC escrow contract; watch events; build claim/refund txs.
   - SVM adapter: interact with Solana HTLC-style escrow program; watch accounts/logs; build claim/refund txs.
   - BTC adapter: construct script-based HTLC outputs; monitor confirmations; build spend txs.

## Key Decisions
1. **Internal Atlas leg uses HOLD/RELEASE (not immediate transfer)**
   - This prevents the internal chain from being out of sync with external settlement and gives clean refund semantics.

2. **Two trust modes are explicitly modeled**
   - Trust-minimized mode (future): Atlas verifies external settlement receipts via proofs/light-clients.
   - Federated mode (near-term): coordinator produces attestations; key material lives in threshold signers; misbehavior is slashable by policy.

3. **Finality gating is mandatory**
   - Coordinator MUST not proceed to the next irreversible step until the prior step reaches configured finality/confirmations.

4. **Timeout policy is directional, derived from risk**
   - For a pair (A,B), define `Tslow` and `Tfast` such that:
     - Refund on the slow chain is always possible after the fast chain’s claim window expires.

## Direction-Agnostic Flows (high level)
- Swap between Atlas and External Chain:
  - Lock Atlas funds (HOLD) and lock external funds (HTLC), ordered by slow-first.
  - First claim reveals preimage; other leg claimed with same preimage.
  - If either side fails to fund/claim, refunds unlock the affected leg.

- Swap between two External Chains (EVM↔BTC, SVM↔BTC, EVM↔SVM):
  - Same HTLC primitives, with the coordinator sequencing and observing secret revelation.
  - Atlas/X3VM can still be the orchestration plane (intent + monitoring + accounting), but the value exchange occurs on the two externals.

## Risks / Trade-offs
- BTC and Solana proof verification on-chain is complex; we keep trust-minimized hooks but allow federated operation.
- Wrong timeout configuration can break refund guarantees; mitigation: conservative defaults + validation rules.
- Reorgs can invalidate observed funding/claim events; mitigation: finality thresholds, reorg detection, and rollback in coordinator state.

## Migration Plan
- Phase 0 (spec): finalize this capability spec + task list.
- Phase 1 (testnet MVP): federated mode with coordinator + adapters, Atlas HOLD/RELEASE primitives, end-to-end e2e tests.
- Phase 2 (hardening): HA coordinator, durable event log, alerts/metrics, chain registry expansion.
- Phase 3 (trust-minimized): add light-client/proof verification paths for BTC/EVM/SVM where feasible.

## Open Questions
- Should Solana/SVM swaps target Solana main chain explicitly, or a generic “SVM chain” abstraction?
- Do we want external-chain-to-external-chain swaps to be first-class, or always routed through an Atlas asset representation?
- What is the minimum viable attestation format for federated mode (threshold signature vs committee votes)?
