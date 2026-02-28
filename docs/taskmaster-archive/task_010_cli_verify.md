---
proposer_id: SYSTEM_BOOT
section: Strings
severity: Minor
intent: Verify CLI Integration
constraints:
  - "Ten Commandments: State must be observable"
impact: "Operator visibility"
---
# Action
Execute `python3 -m orchestra.views.cli` and manually verify that tasks 001-009 appear in the [PENDING TASKS] list.
