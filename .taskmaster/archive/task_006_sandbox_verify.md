---
proposer_id: SYSTEM_BOOT
section: Brass
severity: Minor
intent: Verify Sandbox Isolation
constraints:
  - "Ten Commandments: Jurors Must Be Isolated"
impact: "Security of voting process"
---
# Action
Instantiate `orchestra.infra.sandbox.SandboxEnvironment` and attempt a `write_file` operation. Verify it raises `PermissionError`.
