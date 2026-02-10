---
proposer_id: SYSTEM_BOOT
section: Percussion
severity: Major
intent: Jury Selection Dry Run
constraints:
  - "Rule of Representation: Diversity"
impact: "Validate lawyer selection logic"
---
# Action
Run `orchestra.governance.selection.JurySelector` requesting a 5-person jury. Verify no Section has > 3 members.
