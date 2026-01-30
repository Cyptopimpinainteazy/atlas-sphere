# Change: On-chain .x3 Domain Registry + Public Endpoint Validation

## Why
Atlas Sphere uses `.x3` as the canonical namespace for public services and protocol-facing domains, but the current DNS server’s “blockchain integration” is stubbed and there is no on-chain source of truth to enforce `.x3` or drive authoritative records.

## What Changes
- Add an on-chain domain registry as the canonical source of truth for `.x3` domains and DNS record sets.
- Enforce `.x3` suffix rules on-chain for all domain registration and record updates.
- Provide a runtime API and node RPC surface so the Atlas DNS server can query on-chain zone data deterministically.
- Add deployment validation tooling to ensure official/public endpoints are consistently configured under `.x3`.

## Impact
- Affected specs: new `x3-domain-registry` capability.
- Affected code:
  - new pallet under `pallets/` and runtime wiring in `runtime/src/lib.rs`
  - new runtime API and node RPC module wiring in `node/src/rpc.rs`
  - `crates/atlas-dns-server` integration to load records from chain
  - deployment scripts/config validation under `deployment/` and/or `scripts/`

## Non-Goals
- Forcing third-party clients or external resolvers to use `.x3` (only official infra + on-chain rules can be enforced).
- Running a DNS server inside the runtime WASM (networking remains off-chain by design).
