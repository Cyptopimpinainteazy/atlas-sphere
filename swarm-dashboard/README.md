# Swarm Dashboard — TypeScript Migration & Tests

This directory contains the `swarm-dashboard` app. Recent work in this branch migrates several UI components from JavaScript to TypeScript/TSX and adds a minimal test setup.

## Summary of changes

- Converted components to TypeScript (TSX):
  - `CiStatusTile`, `TestHealthTile`, `AlertsPanel`, `TestnetReadinessTile`, `MediaProductionPanel`
- Added typed hook: `src/hooks/useMediaMetrics.ts`
- Added `tsconfig.json` and tightened compiler options (e.g. `noUncheckedIndexedAccess`)
- Added unit testing with Jest + ts-jest + Testing Library (one unit test for `useMediaMetrics`)
- Added Playwright smoke e2e test: `e2e/tests/dashboard-smoke.spec.ts`

> Note: A `CiStatusTile` unit test was attempted but is currently postponed due to a module resolution issue; I can follow up to add that unit test as well.

## Run locally

1. Install deps:

   npm install

2. Type-check:

   npm run tsc --silent

3. Run unit tests:

   npm test

4. Run the demo server and e2e tests (in two terminals):

   # serve the demo site
   npm run e2e:serve

   # in another terminal, run playwright tests
   npm run e2e:test


## Viewing coverage artifacts from CI 🔎

When the unit test job runs in CI it uploads the coverage report (lcov + HTML) as a workflow artifact named `swarm-dashboard-coverage`.

To download and inspect coverage from a CI run:

1. Open the GitHub Actions run for the branch/PR.
2. Find the **unit-tests** job and expand it.
3. Under **Artifacts**, click **swarm-dashboard-coverage** and download the zip.
4. Unzip and open `coverage/lcov-report/index.html` in your browser to view the interactive HTML report, or use `coverage/lcov.info` to upload to a coverage service later.

Note: We intentionally keep Codecov disabled by default; if you want Codecov integration enabled I can set it up (requires adding a `CODECOV_TOKEN` to repo secrets or installing the Codecov GitHub App).

## Notes & follow-ups

- I tightened typings in `useMediaMetrics` (explicit return types) and added prop typings in `dashboard-example.tsx`. If you want, I can continue and make prop types stricter across all components and add more unit tests (e.g. the `CiStatusTile` test) — say the word and I'll continue.

