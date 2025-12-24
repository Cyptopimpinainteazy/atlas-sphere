# Dashboard MVP (CI + Test Health + Alerts)

## Purpose

Small, focused MVP to surface branch CI status, `atlas-evm-integration` test health counts, and alerts (manual links to SIGILL gist / PR) in the dashboard.

## Endpoints (mock server)

- POST /rpc with JSON-RPC method `ci_status` -> returns:
  - branch, pr, status, last_checked, details
- POST /rpc with JSON-RPC method `test_health` -> returns project test counts (unit/integration)
- POST /rpc with JSON-RPC method `alerts` -> returns list of alerts
- POST /rpc with JSON-RPC method `create_alert` (params: alert object) -> creates alert (MVP manual creation)
- GET /api/alerts/sigill -> returns pre-filtered list of SIGILL-related alerts with artifact links (count + alerts[])
- GET /api/readiness/testnet -> aggregated readiness payload (score, ci, tests, node, network, last_updated)

Mock server is `mock-rpc-server.js` and uses `mock-rpc-data.json` as the data source. The SIGILL triage playbook is in `.github/triage/SIGILL_PLAYBOOK.md` and the SIGILL issue template is available at `.github/ISSUE_TEMPLATE/sigill-crash-report.md`.

## Frontend

- `src/components/CiStatusTile.js` - CI status tile
- `src/components/TestHealthTile.js` - Test health counts
- `src/components/AlertsPanel.js` - Alerts list with links
- Integrated into `src/app/dashboard-example.tsx` in the sidebar

## Tests

- `tests/mock-rpc.spec.js` - Jest tests for RPC endpoints
- `tests/components.spec.js` - placeholder frontend test (smoke)

Run unit tests with:

```
cd swarm-dashboard
npm test
```

## Acceptance Criteria

- [ ] Dashboard tile shows CI status for branch `feature/swarm-dashboard-e2e` / PR #3
- [ ] Test health counts show unit/integration counts for `atlas-evm-integration`
- [ ] Alerts panel shows the SIGILL alert with gist link and PR reference
- [ ] Backend endpoints have unit tests and docs
- [ ] Draft PR opened with description, checklist, and screenshots where appropriate

## Next Steps

- Wire to real CI provider for live status (GitHub Actions/GitHub Checks)
- Add automated collection of SIGILL artifacts when CI fails
- Expand frontend unit tests (React Testing Library)
