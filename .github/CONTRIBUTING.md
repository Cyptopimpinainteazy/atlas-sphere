# Contributing to atlas-sphere

Thanks for contributing! This repository runs CI checks for continuous integration and accessibility.

Accessibility checks
- Playwright e2e includes a small axe-core accessibility scan. If violations are detected, a file `swarm-dashboard/e2e/axe-violations.json` is produced and uploaded by CI.
- The repository has an `axe-triage` workflow that will create a triage issue (labeled `accessibility` and `triage`) if the violations file is present on a PR. The repo Variable `AXE_TRIAGE_ASSIGNEE` can be set to auto-assign triage issues.
- See `.github/triage/AXE_TRIAGE.md` for full details and triage steps.

PR checklist recommendation
- Please ensure new PRs include the standard project checklist and verify the **Axe accessibility checks** bullet is present (CI will run them automatically).
