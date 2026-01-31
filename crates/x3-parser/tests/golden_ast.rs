use std::fs;
use x3_parser::parse_program;

#[test]
fn golden_ast_matches_fixture() {
    let source = r#"
        fn reference(a: i32, b: i32) -> i32 {
            let x = 1 + 2 * 3;
            let y = sum(4, factorial(5 + 6));
            return x + y;
        }
    "#;

    let module = parse_program(source).expect("should parse program");
    let actual = serde_json::to_string_pretty(&module).expect("serialize module");

    let golden_dir = format!("{}/tests/golden", env!("CARGO_MANIFEST_DIR"));
    let golden_path = format!("{}/reference_program.json", golden_dir);

    match fs::read_to_string(&golden_path) {
        Ok(expected) => {
            assert_eq!(expected, actual, "AST serialization diverged from golden fixture");
        }
        Err(_) => {
            // First run: write golden for developer review and fail the test so it gets committed.
            fs::create_dir_all(&golden_dir).expect("create golden dir");
            fs::write(&golden_path, &actual).expect("write golden file");
            panic!("Golden file created at {} — inspect and commit it", golden_path);
        }
    }
}