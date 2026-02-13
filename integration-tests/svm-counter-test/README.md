# SVM Counter Integration Test

Purpose
- Small, isolated integration test that deploys a minimal Solana (SVM) counter program and verifies it increments an on-chain counter using `solana-program-test`.

Why isolated
- `solana-program-test` pulls Solana runtime dependencies that conflict with some workspace Substrate pins; keeping this test in an isolated workspace crate avoids cargo resolution conflicts while still validating SVM behavior.

Run locally
```bash
cd integration-tests/svm-counter-test
cargo test --test counter -- --nocapture
```

CI
- GitHub Actions workflow `.github/workflows/svm-counter-integration.yml` runs this test on push/PR when related files change.

Notes
- The same counter implementation is available under `crates/svm-counter` (BPF crate) and is used by the in-repo integration test at `crates/svm-integration/tests/counter_integration.rs` where feasible.
