# Mainnet Gating Artifact Bundle (2026-04-23)

This bundle captures the latest local rerun evidence for the `release-hard-gates`, `determinism`, and workspace compile slices of `.github/workflows/mainnet-gating.yml` as reconciled on April 23, 2026.

## Contents

- `mainnet-gating-finality-oracle.log`: `bash scripts/ci/check_finality_oracle_feature_guards.sh`
- `mainnet-gating-crate-check.log`: `cargo check -p x3-relayer -p x3-bridge-security-council -p x3-genesis-builder`
- `mainnet-gating-launchops-scan.log`: `cargo run -p launchops -- scan`
- `mainnet-gating-rustfmt.log`: `cargo fmt --all -- --check`
- `mainnet-gating-workspace-check.log`: `cargo check --workspace --all-targets`
- `launchops/`: current `.launchops` snapshot captured after the fresh scan

## Summary

- Release-hard-gates substeps rerun locally and passed for finality-oracle feature guards, targeted crate compilation, and LaunchOps scan.
- Determinism now passes locally: `cargo fmt --all -- --check` completed cleanly on April 23, 2026.
- Workspace-wide compilation is still blocked. The current failing surface has moved beyond the earlier release-hard-gates slice and now includes deeper test/mock issues such as `pallet-x3-coin` test scaffolding and `x3-integration` test-only wiring.
- This bundle supports a conservative readiness delta only; it does not prove full workflow green.