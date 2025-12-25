# Axe triage automation

This document explains how the Axe accessibility triage automation works and how to configure it.

Summary
- The repository runs Playwright e2e tests which include a small axe-core accessibility scan that writes `swarm-dashboard/e2e/axe-violations.json` when violations are detected.
- The e2e workflow (`.github/workflows/swarm-dashboard-e2e.yml`) will post a comment to the PR and upload the `axe-violations.json` artifact when violations are present.
- A separate workflow (`.github/workflows/swarm-dashboard-axe-triage.yml`) runs on pull requests as a safety net and will create a triage issue (labels: `accessibility`, `triage`) when `axe-violations.json` is present.

Configuration
- `AXE_TRIAGE_ASSIGNEE` (Repository variable): set this to a GitHub username to auto-assign created triage issues. Leave unset to create issues unassigned.
  - Example (CLI): `gh variable set AXE_TRIAGE_ASSIGNEE --body alice -R <owner/repo>`

Behavior and safeguards
- Duplicate-protection: Before creating a new triage issue the workflow searches for an open issue with the same title and will skip issue creation if one already exists.
- Labels: Issues are created with the `accessibility` and `triage` labels. If the labels are missing, the workflow will create the issue without labels (labels are now added to the repo to avoid this).
- Permissions: The triage workflow runs with `GH_TOKEN` to allow the GitHub CLI (`gh`) to create issues and post comments.

Triage steps (quick)
1. Download `axe-violations.json` from the workflow run artifacts.
2. Reproduce locally using the demo (`swarm-dashboard/e2e/index.html`) or run Playwright locally.
3. Inspect each violation (impact, selector, nodes); provide reproduction steps in the issue if needed.
4. Assign (or accept auto-assignment), set priority, and attach any follow-up artifacts.

Notes
- The `axe-triage` job is intentionally kept as an independent, low-friction safety net so accessibility regressions are recorded even if Playwright e2e fails early or times out.
- See `.github/ISSUE_TEMPLATE/axe-violations.md` for an issue template with triage checklist and commands to run locally.
