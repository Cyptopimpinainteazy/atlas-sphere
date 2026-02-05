# Design: Authorization Gate Enforcement (Auth Enforcement)

⚠️ Summary

We will strengthen the authorization gate for `submit_comit` and other critical commit/transaction entrypoints in the Atlas Kernel pallet to ensure only authorized accounts can submit Comits. This design produces a formal plan, test matrix, CI changes, docs, and a migration strategy that defers removal of the `dev-bypass` feature (per current decision) but treats it as deprecated and carefully controlled.

Goals

- Ensure `AuthorizedAccounts` checks are enforced in unit, integration, and CI tests.
- Prevent accidental or malicious use of `dev-bypass` on the main branch.
- Add CI gating to block merges until tests/docs/verification are present.
- Provide an auditable design and acceptance criteria matching X3 Constitution rules.

Scope

- Code changes in `pallets/atlas-kernel` (core enforcement, tests)
- CI workflow updates (GitHub Actions or equivalent) to detect `dev-bypass` feature and verify enforcement
- Documentation updates in `pallets/atlas-kernel/README.md` and `docs/`
- Red-team tests (fuzzing harness for `submit_comit`) as a follow-up

Requirements

1. Tests
   - Unit tests demonstrating `submit_comit` fails for unauthorized callers (both runtime and mock adapters)
   - Integration tests validating end-to-end behavior when `AuthorizedAccounts` is present and absent
   - Regression tests for any behavior previously allowed by `dev-bypass` that could leak

2. CI
   - Add a CI job that builds and runs tests with default features (no `dev-bypass`) — **blocking** on main.
   - Add a CI audit job that ensures PRs do not enable `dev-bypass` (fail if Cargo is built with `--features dev-bypass` or if feature present in Cargo.toml on main branch).

3. Documentation
   - Update `pallets/atlas-kernel/README.md` with authorization model, failure modes, and migration steps
   - Update `X3` Agent Constitution references where relevant

4. Red-team
   - Add a fuzz target targeting the `submit_comit` deserialization/authorization path
   - Automate a simple adversarial script to attempt bypassing authorization in tests

Design Proposals

A. Enforcement in Pallet
- Explicit `ensure!(AuthorizedAccounts::<T>::contains_key(&caller), Error::<T>::Unauthorized);` lines must be covered by unit tests.
- Add defensive checks upstream in `submit_comit` to validate payload sizes and signature formats for early rejection.
- Add a `#[cfg(test)]` dev harness to simulate `dev-bypass` behavior only for local tests; avoid exposing bypass behavior to CI builds.

B. CI Safety Net
- Add `ci/no_dev_bypass.yml` job that:
  - Runs `cargo test --workspace` with default features
  - Fails if any crate sets `dev-bypass` in `Cargo.toml` for main
  - Optionally runs a `cargo test --features dev-bypass` in a gated job that is allowed only on feature branches (non-main)

C. Deprecation Path for `dev-bypass`
- Mark `dev-bypass` deprecated in docs
- Add an issue to remove the feature (owner: infra/security) with milestone and deadline
- For now, ensure `dev-bypass` is off for `main` and blocked by CI

Acceptance Criteria (DONE)
- ✅ Unit tests for `submit_comit` unauthorized failure pass
- ✅ Integration test demonstrating authorized commit passes
- ✅ CI job added to block `dev-bypass` on `main` and to run tests without the feature
- ✅ Docs updated and PR includes a design/README
- ✅ Red-team job exists (can be staged as non-blocking initially)

Migration & Rollout Plan
- Phase 1 (Week 0): Draft design PR and gather review (this PR)
- Phase 2 (Week 1): Implement tests and CI gating; land on `main` (blocking)
- Phase 3 (Week 2): Add fuzzing and red-team automation; mark `dev-bypass` deprecated in code and docs
- Phase 4 (Future): Remove `dev-bypass` feature entirely when the team approves

Risks & Mitigations
- Risk: Breaking internal dev flows that rely on `dev-bypass`.
  - Mitigation: Keep `dev-bypass` available on dev branches only; document and notify teams.
- Risk: False negatives/positives in CI feature detection.
  - Mitigation: Add explicit checks and a quick alerting path; run gated tests in both default and feature modes during rollout.

Owners
- Implementation owner: @engineer-agent (TBD)
- Reviewers: Runtime architects, Security/Red-team
- Scribe: Documentation owner (TBD)

Next steps
1. Open a design PR with this doc attached and solicit review. (This is the next action I will take per your selection.)
2. After sign-off, implement unit/integration tests in `pallets/atlas-kernel` and add CI changes.

---

*Drafted by an X3 agent following the X3 Constitution: ship, enforce correctness, document failure modes, and automate enforcement.*
