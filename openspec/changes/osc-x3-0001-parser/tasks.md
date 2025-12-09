## 1. Parser Implementation

- [x] 1.1 Create `crates/x3-parser/src/tokens.rs` – deterministic `TokenStream` wrapper with position tracking.
- [x] 1.2 Implement `crates/x3-parser/src/error.rs` – `ParseError` type with span, message, and recovery hints.
- [x] 1.3 Implement `crates/x3-parser/src/grammar.rs` – canonical binding-power table and operator metadata.
- [x] 1.4 Extend `crates/x3-parser/src/parser.rs` – Pratt expression parser (`parse_expression_bp`).
- [x] 1.5 Implement statement parsers (`let`, `return`, `atomic`, `agent`, `context`, `if`, `while`, `loop`, `for`, `emit`).
- [x] 1.6 Implement block and function parsers; ensure deterministic ordering of items.
- [x] 1.7 Expose `pub fn parse_program(src: &str) -> Result<Module, ParseError>` in `lib.rs`.

## 2. AST Updates

- [x] 2.1 Ensure `crates/x3-ast` has node types for all statement forms and expressions.
- [x] 2.2 Add `Span` fields to every AST node for diagnostics.
- [x] 2.3 Structural Validator Pass – `crates/x3-parser/src/validator.rs` with scope tracking for `return`, `break`, `continue`, atomic nesting, and span validation.

## 3. Testing & Golden Fixtures

- [ ] 3.1 Create `crates/x3-parser/tests/fixtures/*.x3` sample programs covering grammar surface.
- [ ] 3.2 Generate golden AST JSON outputs for each fixture.
- [ ] 3.3 Add `cargo test -p x3-parser` tests that assert AST equals golden JSON (canonicalized).

## 4. CI Integration

- [ ] 4.1 Add `cargo test -p x3-parser` to `RUN_ALL_TESTS.sh`.
- [ ] 4.2 Add CI step that verifies golden AST files are up-to-date.

## 5. Compiler Integration

- [ ] 5.1 Wire `parse_program` into `compiler::compile_program` (if a compiler crate exists).
- [ ] 5.2 Verify basic `.x3` source compiles to `.x3b` bytes without errors.

## 6. Validation

- [ ] 6.1 Run `openspec validate osc-x3-0001-parser --strict` and resolve any issues.
- [ ] 6.2 Manual review: ensure parser never panics, memory use is bounded, errors are clear.
