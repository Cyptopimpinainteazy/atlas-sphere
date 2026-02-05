# Mainnet Readiness Checklist (Epics & 0-30-90 plan)

## Epics
- Epic 1: Project Onboarding & Requirements (0–7 days)
  - Tasks: Stakeholder interviews, inventory, success criteria, draft project-context.md
  - Owner: PM
- Epic 2: Security & Secrets (0–30 days)
  - Tasks: Key management review, access controls, basic audit
  - Owner: Architect/Security
- Epic 3: Testing & Observability (7–45 days)
  - Tasks: Test scaffolding, CI pipelines, metrics and alerting dashboards
  - Owner: Test Architect / DevOps
- Epic 4: Canary Release & Rollout (30–90 days)
  - Tasks: Canary pipeline, automated smoke, rollback plan, final validation
  - Owner: DevOps / PM

## 0-30-90 Plan (summary)
- 0–30 days: Inventory, requirements, security review, tests & CI foundations
- 30–60 days: Run full staging test, fix blockers, integrate observability and performance tuning
- 60–90 days: Canary release, performance validation, final go/no-go and full rollout

## Acceptance Criteria
- Passing automated readiness checks in staging for all critical components
- Verified security posture for key management and node access
- Documented runbooks and rollback procedures, verified in rehearsal
- Stakeholder sign-off on go/no-go checklist

---
*Files created and a BMAD simulation transcript are available at `crates/vibe-bmad/_bmad-output/party_simulation.txt` and `party_simulation_round2.txt`.*
