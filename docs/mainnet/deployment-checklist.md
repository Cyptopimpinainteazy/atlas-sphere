# Deployment Checklist — Mainnet Readiness

This checklist is actionable and prioritized for initial Mainnet readiness work.

## Pre-deployment (Discovery & Planning)
1. Inventory all components and owners (nodes, RPC, indexers, wallets, relayers, oracles, monitoring) — Owner: PM
2. Define non-functional requirements (throughput, latency, availability, retention) — Owner: Architect
3. Prepare **project-context.md** and confirm acceptance criteria — Owner: PM + Tech Writer

## Hardening & Testing
1. Security audit and secrets management review — Owner: Security Lead / Architect
2. Automated tests: unit, integration, and system-level smoke tests — Owner: Test Architect
3. Performance benchmarking and capacity planning (scale tests) — Owner: DevOps
4. Observability: metrics, dashboards, alerting, distributed tracing — Owner: DevOps / QA

## CI/CD & Release Flow
1. Ensure reproducible builds and immutable artifacts for nodes & components — Owner: Dev Team
2. Canary promotion pipeline with automated smoke and rollback hooks — Owner: DevOps
3. Release runbooks and rollback playbooks tested in staging — Owner: PM + DevOps

## Deployment & Post-deploy
1. Canary deploy to limited validators / regions, monitor metrics & SLOs — Owner: DevOps
2. Run security + performance tests in canary; hold for sign-off — Owner: Test Architect
3. Graduated rollout to full mainnet after go/no-go check — Owner: PM

## Communication
- Pre-launch stakeholder announcement + ops channel for alerts — Owner: PM
- Post-deploy status report and incident playbooks accessible to on-call team — Owner: Tech Writer

---
*Use this checklist as the operational ground truth for go/no-go decisions.*
