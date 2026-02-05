## 1. Spec + Acceptance
- [ ] 1.1 Confirm required RPC methods for explorer/wallet/indexer (HTTP + WS)
- [ ] 1.2 Confirm security posture for public RPC (Safe methods, CORS, rate limits)
- [ ] 1.3 Confirm runtime WASM build gate definition (no bypass env vars)

## 2. Node RPC / WS Readiness
- [ ] 2.1 Ensure WebSocket server is enabled and documented for dev/testnet profiles
- [ ] 2.2 Provide required standard Substrate RPC methods needed by Polkadot.js and `subxt`
- [ ] 2.3 Ensure custom RPC modules remain available (atlasKernel/atomicTrade/evolutionCore/x3Verifier)
- [ ] 2.4 Ensure subscription methods work over WS (`chain_subscribeNewHeads`, finalized heads)

## 3. Public RPC Hardening
- [ ] 3.1 Align `deployment/public-rpc/env/*` profiles (dev/testnet/testnet-public/testnet-ops)
- [ ] 3.2 Enforce safe RPC method exposure and disable unsafe endpoints for public profile
- [ ] 3.3 Add/verify request limits and logging suitable for internet exposure

## 4. Health, Observability, and SLOs
- [ ] 4.1 Make `system_health` report real peer count and sync state
- [ ] 4.2 Define baseline SLOs (latency/availability) and minimum dashboards/alerts

## 5. Build Gates
- [ ] 5.1 Ensure `cargo build --release` succeeds with runtime WASM build (no SKIP_WASM_BUILD)
- [ ] 5.2 Document the supported build matrix (native, wasm, dev/testnet)

## 6. Validation
- [ ] 6.1 `openspec validate osc-testnet-0002 --strict`
- [ ] 6.2 Update/extend runbooks or quickstart docs to match the new readiness definition
