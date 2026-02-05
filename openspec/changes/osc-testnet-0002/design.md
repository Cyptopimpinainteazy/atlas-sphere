## Context

Atlas Sphere currently exposes a mix of custom JSON-RPC methods and partial Ethereum compatibility, and can be run as a public RPC node via `deployment/public-rpc/`. Historically, WebSocket support has been a pain point for tooling that expects subscriptions and extrinsic submission over WS.

Separately, runtime WASM builds have been fragile due to upstream dependency drift and WASM target constraints. “Testnet-ready” must include a reproducible build story.

## Goals

- Define a testable readiness bar that is:
  - necessary for wallets/explorers/indexers
  - safe enough for public RPC exposure
  - compatible with current architecture (FRAME runtime, custom RPC)
- Keep scope focused on readiness, not feature expansion.

## Non-Goals

- Full Frontier `eth_*` parity and EVM execution correctness.
- Implementing production EVM/SVM execution adapters.
- Re-architecting networking or consensus.

## Key Decisions

- **Minimal standard Substrate RPC**: provide the RPC methods required by Polkadot.js and `subxt` (metadata, chain, state, and authoring essentials) in addition to custom Atlas RPC.
- **WebSocket is required**: readiness requires WS availability and functional subscriptions.
- **Public RPC is safe-by-default**: public profile must run with safe methods, conservative CORS, and rate limiting.
- **Health endpoints must be real**: `system_health` should reflect actual peers and sync state, not placeholders.
- **WASM build is a gate**: release builds must not require bypass flags to produce a valid runtime WASM.

## Risks / Trade-offs

- Adding standard Substrate RPC may increase surface area; mitigated by safe method exposure controls and separate ops/public profiles.
- Tightening WASM build requirements may require patch maintenance; mitigated by pinning and CI verification.

## Rollout / Migration

- Land changes behind deployment profiles first (dev/testnet), then roll out to public RPC nodes.
- Update docs and runbooks to remove ambiguity about WS endpoints and safe/public exposure.

## Open Questions

- Exact minimal set of Substrate RPC methods required by current frontend apps.
- Whether WS should be enabled on the same port as HTTP or dedicated port for ops/public.
