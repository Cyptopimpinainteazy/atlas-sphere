## Context
Atlas Sphere’s on-chain Atlas Kernel pallet provides atomic, deterministic execution across internal VMs (EVM + SVM). Cross-chain atomic swaps with external networks (BTC, EVM L1/L2s) require off-chain coordination of escrow funding, finality monitoring, and claim/refund sequencing.

## Goals
- Provide a deterministic, event-sourced settlement coordinator that sequences escrow legs and emits canonical swap lifecycle events.
- Make chain integrations pluggable through a shared `ChainAdapter` interface.
- Support “instant” UX via provisional balances while ensuring on-chain settlement correctness.

## Non-Goals
- Implementing custody key management (MPC/HSM) itself; only interface boundaries and signing request flows are specified.
- Moving external chain interactions on-chain inside the runtime.

## Key Decisions
1. **Coordinator is off-chain, state is event-sourced**
   - Coordinator runs as a service/library (Node/Go/Rust std) and persists an append-only event log.
   - Swap state is derived by replaying events; coordinator can restart safely.

2. **On-chain kernel remains the authoritative ledger for Atlas internal accounting**
   - Coordinator integrates with Atlas by posting events/receipts (e.g., via extrinsics or service API), but external chain monitoring and transaction broadcast stays off-chain.

3. **Slow-chain-first funding**
   - Default policy funds the slower-finality chain escrow first (often BTC), then the faster chain.
   - Policy is configurable (per chain pair) but MUST preserve atomicity/refund guarantees.

4. **Finality is modeled probabilistically**
   - Adapters expose `estimateFinality` returning confidence and reorg risk.
   - Coordinator uses configurable thresholds per chain/network.

## Risks / Trade-offs
- Finality estimation is heuristic; incorrect thresholds can increase reorg risk. Mitigation: conservative defaults, per-chain overrides, and alerting.
- L2 finality differs from L1; mitigation: support separate “sequencer-finality” vs “L1-finality” policies and conservative withdrawal logic.

## Migration Plan
- Phase 1: Spec + in-memory coordinator (dev/testnet).
- Phase 2: Durable event log + adapters for BTC and one EVM chain.
- Phase 3: Expand chain registry to 100+ EVM networks with capability flags and per-chain risk policy.

## Open Questions
- Where should the canonical event log live (Postgres, RocksDB, or on-chain events only)?
- How are signing requests routed to MPC/HSM (gRPC, message bus, or local HSM)?
- How do we represent L2 finality and withdrawal constraints for UX and risk gating?
