## 1. Specification
- [ ] 1.1 Add delta spec for `x3-domain-registry` capability
- [ ] 1.2 Validate change with `openspec validate add-x3-domain-registry --strict`

## 2. Runtime: On-chain Domain Registry
- [ ] 2.1 Create new pallet (e.g. `pallets/x3-domain-registry/`)
- [ ] 2.2 Add bounded storage for domain ownership + record sets
- [ ] 2.3 Enforce `.x3` suffix for all domain operations
- [ ] 2.4 Add events + errors + storage versioning
- [ ] 2.5 Wire pallet into `runtime/src/lib.rs`

## 3. Runtime API + Node RPC
- [ ] 3.1 Add runtime API to query domain record sets
- [ ] 3.2 Add node RPC method(s) to expose the runtime API (`x3Domains_*` or similar)

## 4. DNS Server Integration
- [ ] 4.1 Update `crates/atlas-dns-server` to fetch zone records from chain via RPC when blockchain integration is enabled
- [ ] 4.2 Keep `.x3` restriction enforced server-side even if chain is unavailable

## 5. Public `.x3` Validation Tooling
- [ ] 5.1 Add a script that validates official/public endpoints are `.x3`
- [ ] 5.2 Integrate the validator into deployment docs/scripts

## 6. Verification
- [ ] 6.1 `cargo check` and targeted tests for the new pallet
- [ ] 6.2 Ensure node builds and DNS server crate still compiles
