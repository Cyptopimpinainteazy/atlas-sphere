---
proposer_id: SYSTEM_BOOT
section: Percussion
severity: Minor
intent: Initialize Scrap Yard
constraints:
  - "Ten Commandments: Failed Agents Must Retire"
impact: "Establish forensic archive folder"
---
# Action
Check write permissions on `orchestra/scrapyard/` and ensure `archive.py` can create a dummy case file.
