## 1. Runtime Origin Hardening
- [ ] 1.1 Replace governance `EmergencyOrigin` wiring with a collective threshold origin
- [ ] 1.2 Tighten `RuntimeUpgradeOrigin` away from `EnsureRoot` to a collective threshold origin
- [ ] 1.3 Move scheduler/preimage manager origins away from `EnsureRoot` to a collective threshold origin
- [ ] 1.4 Review treasury privileged origins and gate them behind the same collective threshold
- [ ] 1.5 Review agent/admin pallets (`agent_accounts`, `agent_memory`, `evolution_core`) and gate privileged origins behind the same collective threshold

## 2. VM Adapter Determinism
- [ ] 2.1 Identify all consensus-critical uses of VM receipts/state changes (Atlas Kernel)
- [ ] 2.2 Ensure native and WASM execution paths use equivalent adapter behavior for consensus-critical operations
- [ ] 2.3 If real adapters are not deterministic/available in WASM, default native to mocks and gate real adapters behind an explicit *non-production* feature flag

## 3. Validation
- [ ] 3.1 `cargo check` (workspace)
- [ ] 3.2 `cargo test -p pallet-atlas-kernel`
- [ ] 3.3 `cargo test -p pallet-governance` (if present)
- [ ] 3.4 Run `openspec validate update-runtime-security-boundaries --strict`
