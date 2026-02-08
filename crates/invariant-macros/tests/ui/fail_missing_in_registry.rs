use invariant_macros::invariant;

// This test ensures the proc-macro will fail when INVARIANT_REGISTRY_PATH points to
// a registry that does not contain the referenced ID. The trybuild runner will set
// INVARIANT_REGISTRY_PATH in CI to a sanitized fixture to validate this behavior.

#[invariant("NOT-REAL-999|STRICT")]
fn test_missing() {
    // should fail when registry is provided and doesn't contain the ID
}

fn main() {}
