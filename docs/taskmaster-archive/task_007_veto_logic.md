---
proposer_id: SYSTEM_BOOT
section: Strings
severity: Minor
intent: Test Veto File Watcher
constraints:
  - "Human Deletion Rule"
impact: "Prove human override capability"
---
# Action
Mock a file deletion event in `orchestra/infra/veto_system.py` and verify the corresponding ID is flagged as INVALID.
