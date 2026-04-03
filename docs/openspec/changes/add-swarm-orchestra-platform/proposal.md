# Change: add-swarm-orchestra-platform

## Status

DRAFT

## Authors

GitHub Copilot

## Summary

Define the X3 swarm + orchestra platform as a proposal-backed subsystem that combines the dual-VM blockchain, GPU swarm, message-bus-driven application services, governance approval flow, security controls, and operator interfaces into one bounded multi-agent operating model.

## Motivation

The repository already contains swarm, GPU validator, arbitrage, content, and governance work, but the platform-level shape is distributed across multiple documents and implementation areas. That makes it difficult to reason about agent boundaries, approval flow, security controls, compute routing, and rollout criteria. A single change proposal is needed so architecture, invariants, and implementation ownership stay aligned as the orchestra platform grows.

## Design

The platform is structured as an interface layer, gateway layer, protocol layer, service layer, and control layer. Frontends connect through a GraphQL/REST gateway to the node and off-chain services. The protocol layer provides dual-VM execution, agent and compute registries, exchange primitives, and governance hooks. The service layer provides market-data ingestion, arbitrage scanning, risk review, trade execution, content generation, compliance analysis, autonomic operations, and GPU workload orchestration. The control layer provides security swarm enforcement, approval workflow, dispute handling, evidence retention, and operator dashboards.

Workflows remain role-typed. Strategy agents do not bypass risk review. Risk review does not bypass governance approval for high-risk tasks. Execution services do not bypass security or evidence capture. Content generation remains separated from financial execution. The security swarm remains the containment and audit substrate for the whole system.

## Integration Points

- [docs/x3-swarm-orchestra/README.md](../../x3-swarm-orchestra/README.md)
- [docs/x3-swarm-orchestra/EXECUTIVE_SUMMARY.md](../../x3-swarm-orchestra/EXECUTIVE_SUMMARY.md)
- [x3-security-swarm/README.md](../../../x3-security-swarm/README.md)
- [crates/x3-gpu-validator-swarm/src/orchestrator.rs](../../../crates/x3-gpu-validator-swarm/src/orchestrator.rs)
- [crates/x3-gpu-validator-swarm/src/quarantine.rs](../../../crates/x3-gpu-validator-swarm/src/quarantine.rs)
- [crates/gpu-swarm/src/warden/governance.rs](../../../crates/gpu-swarm/src/warden/governance.rs)
- [tests/invariants/registry.toml](../../../tests/invariants/registry.toml)

## Invariants

- `SWARM-ORCH-001` — strategy actions with financial impact must pass risk review before execution.
- `SWARM-ORCH-002` — permanent sanctions require governance or appeals flow and cannot be triggered by autonomous containment.
- `SWARM-ORCH-003` — every externally visible action must map back to an intent, reviewer, execution path, and evidence bundle.
- `SWARM-ORCH-004` — content/media agents can only consume approved asset sources and may not publish without approval state.

## Testing Strategy

Add workflow tests around approval gating, intent lineage, reversible containment, content-asset policy enforcement, and routing separation between financial and media tasks. Add integration tests around orchestrator event emission into the security swarm and around immutable evidence-bundle creation after execution or containment.

## Rollout Plan

Start with documentation and invariant registration. Next, map the existing swarm and security crates to the new role boundaries. Then wire approval and evidence lineage into a narrow internal-only workflow. Only after those controls exist should new public-facing automation surfaces be enabled.

## Risks and Mitigations

The largest risk is architecture sprawl without enforcement boundaries. The mitigation is proposal-backed interfaces plus invariant registration before new orchestration paths are added. A second risk is mixing content and trading capabilities in the same trust domain. The mitigation is role separation, service isolation, and approval-bound permissions. A third risk is uncontrolled agent authority. The mitigation is the existing security swarm scaffold, kill switches, and governance-controlled escalation.

## Open Questions

- Which service should own the authoritative intent ledger for off-chain actions?
- Should the first approval layer live in CRM integration, the API gateway, or a dedicated governance service?
- Which operator dashboard becomes the canonical control plane for approval, security, and performance views?
