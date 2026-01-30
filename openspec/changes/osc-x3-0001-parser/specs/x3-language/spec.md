## ADDED Requirements

### Requirement: Pratt expression parser with precedence table

The parser SHALL implement a Pratt-style expression parser where each binary operator is assigned a `(left_bp, right_bp)` binding-power tuple. The precedence table MUST match the tiers documented in `openspec/x3-language-grammar.md` (function calls at 120, unary at 110, multiplicative at 100, etc.). The parser SHALL produce an identical AST for a given source on every invocation.

#### Scenario: Binary expression precedence
- **WHEN** the parser encounters `1 + 2 * 3`
- **THEN** it produces an AST where `*` binds tighter than `+`, resulting in `Add(1, Mul(2, 3))`.

#### Scenario: Nested call expressions
- **WHEN** the parser encounters `log(sum(1, 2 + 3))`
- **THEN** it produces a `Call(log, [Call(sum, [1, Add(2, 3)])])` node, respecting call precedence above additive.

---

### Requirement: Statement and block parser

The parser SHALL parse statements including `let`, `return`, `atomic`, `agent`, `context`, `if`, `while`, `loop`, `for`, and `emit` as defined in the grammar document. Blocks are delimited by `{` `}` and contain zero or more statements.

#### Scenario: Function with let and return
- **WHEN** the parser encounters `fn measure() -> i32 { let x = 1; return x; }`
- **THEN** it produces a `Function` node containing a block with two statements: a `Let` binding and a `Return` expression.

---

### Requirement: Deterministic TokenStream wrapper

The parser SHALL wrap lexer output in a position-tracking `TokenStream` so that every token carries a `Span` and the current position is always recoverable for error diagnostics.

#### Scenario: Error span accuracy
- **WHEN** an unexpected token is encountered at byte offset 42
- **THEN** the resulting `ParseError` includes a `Span` pointing to byte 42 with at least 1-byte length.

---

### Requirement: Error diagnostics without panics

The parser SHALL never panic on arbitrary user input. Memory use MUST be bounded (nesting depth ≤256). On malformed tokens or syntax errors, the parser SHALL return a `ParseError` containing a human-readable message, span, and optional hint.

#### Scenario: Deeply nested expression limit
- **WHEN** a source file contains expressions nested deeper than 256 levels
- **THEN** the parser returns an error indicating nesting limit exceeded rather than stack-overflowing.

---

### Requirement: Golden AST fixtures for regression testing

The parser crate SHALL include test fixtures (`.x3` files) and corresponding golden AST JSON outputs. `cargo test -p x3-parser` MUST compare the parsed AST against the golden file and fail if they differ.

#### Scenario: Golden regression guard
- **WHEN** a developer runs `cargo test -p x3-parser`
- **THEN** each fixture is parsed and the resulting AST is compared to the stored JSON; any mismatch causes a test failure.

---

### Requirement: Integration with compile pipeline

The `compiler::compile_program` function SHALL accept the AST produced by `parse_program` and emit `.x3b` bytecode for basic examples. This ensures the parser output is consumable by downstream compiler passes.

#### Scenario: End-to-end compilation
- **WHEN** the compiler loads a simple `.x3` source via `parse_program` and invokes lowering + emit passes
- **THEN** it produces a `.x3b` file whose header matches the expected magic bytes and can be loaded by the verifier without errors.
