---
proposer_id: SYSTEM_BOOT
section: Woodwinds
severity: Minor
intent: Establish Baseline Metrics
constraints:
  - "Rule of Law: Observable State"
impact: "Zero-state calibration"
---
# Action
Run `orchestra.evals.judgment.SafetyMetrics` with zero data to ensure no division-by-zero errors in the dashboard.
