---
proposer_id: SYSTEM_BOOT
section: Brass
severity: Major
intent: Stress Test Routing Logic
constraints:
  - "Adversarial: Must Challenge Assumptions"
impact: "Verifies high-severity tasks are caught by Jury"
---
# Action
Submit a Mock Major Task via `TaskSpec` and verify `TaskRouter` returns "JURY". This is a self-referential test of the safety catch.
