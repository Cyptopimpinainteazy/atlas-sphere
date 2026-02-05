## Context
- The runtime cannot perform networking; DNS serving must remain off-chain.
- We can still make the chain the canonical source of truth for `.x3` domain ownership and DNS record sets.
- The existing `crates/atlas-dns-server` has a `DomainRegistry` and “blockchain integration” module that is currently simulated.

## Goals / Non-Goals
- Goals:
  - Enforce `.x3` suffix on-chain for any domain registration/update.
  - Provide a deterministic query surface for an authoritative `.x3` DNS server to read records from chain.
  - Ensure official/public deployment configs resolve under `.x3` via validation tooling.
- Non-Goals:
  - Enforce `.x3` usage on arbitrary client machines or third-party DNS resolvers.

## Decisions
- Decision: introduce a minimal on-chain domain registry pallet.
  - Stores domain ownership and DNS records for `.x3`.
  - All extrinsics validate `.x3` suffix and reject any other TLD.
  - Writes are permissioned (governance-controlled origin for record updates; ownership-controlled for certain mutations if desired).
- Decision: expose a runtime API + node RPC method(s) to query domain records.
  - DNS server calls the node RPC to bootstrap/refresh its authoritative zone.
- Decision: add a deployment validation script.
  - Validates that configured “official” endpoints (rpc/bootnode/faucet/metrics) end with `.x3`.

## Risks / Trade-offs
- Storage growth: domain + record storage must be bounded.
  - Mitigation: limits on domain length, record count per domain, and max record size.
- Upgrade coordination: new pallet storage + runtime API means runtime upgrade.
  - Mitigation: include explicit storage versioning and migrations.

## Migration Plan
1. Add pallet + storage version + genesis config for default system records.
2. Wire pallet into runtime.
3. Add runtime API + node RPC endpoints.
4. Update DNS server to optionally source records from chain.
5. Add deployment validation tooling and document usage.

## Open Questions
- Should domain ownership be user-registrable or governance-only in v1?
- Should DNS records be stored in a compact custom format vs a typed enum matching `atlas-dns-server`?
