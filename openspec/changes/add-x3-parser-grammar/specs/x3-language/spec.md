## ADDED Requirements

### Requirement: X3 parser grammar reference
The system SHALL publish a single source of truth for the X3 grammar so that every parser implementation, compiler pass, and AI agent agrees on function signatures, `let` bindings, atomic blocks, and Pratt-style expressions. The document MUST capture statement forms, the complete expression grammar, and the precedence table shown at the top of `openspec/x3-language-grammar.md`.

#### Scenario: Grammar review
- **WHEN** a compiler engineer or AI prompt ingests `openspec/x3-language-grammar.md`
- **THEN** they can trace every statement production rule and precedence tier so that emitted AST nodes match the runtime expectation.

### Requirement: Parser coverage for core grammar
The parser MUST ship parser tests that parse a function containing `let` bindings, return statements, and nested call expressions that exercise Pratt precedence. These tests guard the grammar baseline and must live inside `crates/x3-parser` so any regression is detected during `cargo test` and the new AST matches the documented grammar.

#### Scenario: Parser regression guard
- **WHEN** the test suite runs `cargo test -p x3-parser`
- **THEN** it exercises the grammar baseline, ensures `let` statements appear before `return`, and validates a call expression with binary arguments.