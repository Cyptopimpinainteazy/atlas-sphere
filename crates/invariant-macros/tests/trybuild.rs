#[test]
fn ui_tests() {
    let t = trybuild::TestCases::new();

    // Ensure the registry path points to a fixture that contains LANG-COMPILE-001 for the passing case
    std::env::set_var("INVARIANT_REGISTRY_PATH", "tests/fixtures/valid_registry.toml");
    t.pass("tests/ui/ok_case.rs");

    // Invalid format should fail regardless of registry
    t.compile_fail("tests/ui/fail_invalid_format.rs");

    // For missing-registry test, point to an absolute path for the empty registry so the macro errors
    let mut cwd = std::env::current_dir().expect("cwd");
    cwd.push("tests/fixtures/empty_registry.toml");
    std::env::set_var("INVARIANT_REGISTRY_PATH", cwd.display().to_string());
    std::env::set_var("INVARIANT_REGISTRY_STRICT", "1");
    t.compile_fail("tests/ui/fail_missing_in_registry.rs");
    // unset strict afterward
    std::env::remove_var("INVARIANT_REGISTRY_STRICT");
    std::env::remove_var("INVARIANT_REGISTRY_PATH");
}
