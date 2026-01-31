# Contributing

Thank you for contributing to Atlas Sphere! A few repo conventions to help reviewers and CI:

## Golden AST fixtures
- Some parser tests rely on *golden* JSON fixtures under `crates/x3-parser/tests/fixtures/` (and new `crates/x3-parser/tests/golden/`).
- If you intentionally change the AST shape (e.g., adding new AST node fields or changing serialization), update the corresponding golden fixtures by running the tests locally:

  ```sh
  cd crates/x3-parser
  cargo test --test golden -- --nocapture
  ```

  The test will regenerate golden files in `tests/fixtures/` or create a new golden under `tests/golden/` and fail so you can inspect and commit the updated golden files.

- When updating golden fixtures, include the updated `.json` golden files in your PR and add a short note explaining the intentional AST change.

## CI expectations
- CI runs `cargo test` for the workspace and the parser crate specifically. Ensure `cargo test -p x3-parser` passes locally before opening a PR.

## Questions
If you're unsure whether an AST change is appropriate, open an issue or ask for a design review on PRs that update golden fixtures.