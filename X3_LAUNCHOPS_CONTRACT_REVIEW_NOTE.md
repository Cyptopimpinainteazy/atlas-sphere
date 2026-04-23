# X3 LaunchOps Contract Review Note

**Status:** Active review note  
**Date:** April 22, 2026  
**Scope:** Generated frontend route allowlist and sidecar adapter backlog under `.launchops/`

## Purpose

This note is the explicit human review record for intentional changes to LaunchOps-generated consumer artifacts, especially:

- `.launchops/frontend_route_allowlist.json`
- `.launchops/sidecar_adapter_backlog.json`

CI now expects this file to change whenever those generated artifacts drift relative to the base commit.

## Current Reality

The current contract change set does three deliberate things:

1. It stops treating `x3_flashFinalityStatus` as a real duplicate-registration bug when the two registrations are mutually exclusive `if/else` branches in `node/src/rpc.rs`.
2. It records `x3_submitCrossVmTransaction` as expected mixed ownership rather than warning-level bucket drift, because runtime execution and node-local orchestration both participate in the handler.
3. It generates a route-scoped frontend allowlist and a sidecar adapter backlog so the disposable shell and release workflows consume the same machine-checked contract truth.

The current follow-up change set does two more deliberate things:

4. It makes the disposable frontend shell consume the generated route allowlist directly through `x3fronend/src/mock/frontendShellContractData.js`, so route-level direct-read affordances come from LaunchOps output instead of hand-maintained fixture text.
5. It turns the existing `scripts/ci/verify_launchops_contract_review.sh` check into a real CI/mainnet gate by invoking it from `.github/workflows/ci.yml` and `.github/workflows/mainnet-gating.yml`.

## Verified

- `cargo test -p launchops`
- `cargo run -p launchops -- inventory-contracts`
- `cargo run -p launchops -- validate-contract`

Current generated outcome from this review:

- `duplicate_registrations=0`
- `bucket_drift=0`
- `routes=5`
- `backlog=14`

## Consumer Impact

- Frontend shell routes now consume the generated allowlist directly and should only present direct-read RPC candidates from that artifact.
- Sidecar planning should use the generated backlog instead of hand-maintained notes when deciding which adapters still block route durability.
- CI now fails when `frontend_route_allowlist.json` or `sidecar_adapter_backlog.json` drift against the base commit without a corresponding update to this review note.

## Next Required Work

When the generated allowlist or backlog changes again, update this note with:

- what changed
- why the drift is intentional
- what user-facing or sidecar-facing surfaces are affected
- what validation was rerun

## Validation For This Review

- `cd x3fronend && npm run build`
- `cargo build -p launchops`
- `BASE_SHA=<base> HEAD_SHA=<head> bash scripts/ci/verify_launchops_contract_review.sh`