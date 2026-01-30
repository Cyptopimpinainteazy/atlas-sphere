Alembic migration notes

Label-gated roundtrip check

This repository includes a non-blocking Alembic roundtrip check that runs a `downgrade base` followed by `upgrade head`. To avoid running this check on every PR, it is gated by a label.

- Label name: `run-alembic-roundtrip`
- How to trigger: add the label `run-alembic-roundtrip` to a pull request; this emits a `pull_request` labeled event and the CI will run the non-blocking Alembic roundtrip job on that PR.
- Behavior: The job is non-blocking (`continue-on-error: true`) and will not prevent merges; failures are surfaced in the Actions logs for follow-up.

Tips

- Use the manual workflow `alembic-roundtrip.yml` from the Actions UI (available on `main`) for a strict downgrade->upgrade verification.
- If you need to enforce stricter checks, consider requesting the `run-alembic-roundtrip` label as part of your review process.
