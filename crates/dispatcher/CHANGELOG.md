## Unreleased

- Add `test-helpers` feature to expose `dispatcher::test_utils::sign_payload` for use in other crates' tests. This helper returns `(compressed_sec1_pubkey_33_bytes, compact_ecdsa_signature_64_bytes)` and standardizes test signing.
- Gate `test_utils` module behind feature `test-helpers`; it's still available during the crate's internal tests (via `#[cfg(test)]`).

Usage (in consuming crate `Cargo.toml` dev-dependencies):

[dev-dependencies]
dispatcher = { path = "../../crates/dispatcher", features = ["test-helpers"], default-features = false }

Then in tests: `let (pubkey, sig) = dispatcher::test_utils::sign_payload(&[11u8;32], &payload);`