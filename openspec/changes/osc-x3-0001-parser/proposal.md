# Change: X3 Language Parser — Pratt Expression Engine + Statement Parser

## Why

The parser is the gating factor for the entire compiler → bytecode → VM pipeline.
Right now the codebase has a scaffold in `crates/x3-parser`, but there is no formalized grammar reference, no Pratt precedence engine with documented binding-power table, and no golden output tests to prevent regressions. Downstream components (HIR, MIR, emitter, verifier, sidecar) cannot advance until `parse_program(src)` returns a deterministic, well-defined AST.

This proposal formalizes:
- The expected grammar (statements, expressions, blocks).
- Operator precedence rules with explicit binding-power numbers.
- The public API (`parse_program`).
- Security expectations (no panics, bounded memory, graceful failure).
- CI requirements (unit tests, golden AST fixtures).

## What Changes

- Implement the complete `crates/x3-parser` crate (`lib.rs`, `grammar.rs`, `tokens.rs`, `error.rs`, `parser.rs`).
- Add a deterministic `TokenStream` wrapper over the lexer that tracks position for diagnostics.
- Build the Pratt expression parser with the documented precedence table (see `openspec/x3-language-grammar.md`).
- Implement statement/block parsing (`let`, `return`, `atomic`, `agent`, `context`, `if`, `while`, `loop`, `for`, `emit`).
- Create test fixtures (`.x3` sample files) and golden AST JSON output for regression testing.
- Add CI rules: `cargo test -p x3-parser`, AST canonicalization checks.
- Ensure `compiler::compile_program` can consume `parse_program` output and produce `.x3b` bytes for basic examples.

## Impact

- **Affected specs:** `x3-language` (adds parser grammar and deterministic AST requirements).
- **Affected code:** `crates/x3-parser/`, `crates/x3-ast/`, `crates/x3-lexer/`, integration wiring in the compiler crate.
- **Related change:** `osc-x3-0001` (the broader X3 compute layer; this change focuses specifically on the parser).

## Acceptance Criteria

1. `parse_program(src)` returns a deterministic AST for each provided fixture.
2. All CI tests pass; golden AST matches recorded snapshots.
3. Integration: `compiler::compile_program` can consume `parse_program` output and produce `.x3b` bytes for basic examples.
4. Parser never panics on user input; bounded memory use; graceful failure on malformed tokens.

## Security Considerations

- Parser must **never panic** on arbitrary user input.
- Memory usage must be bounded (fail with error on excessively nested constructs).
- Malformed tokens must result in clear `ParseError` diagnostics, not undefined behavior.

## Timeline

| Phase                   | Effort |
| ----------------------- | ------ |
| Implement parser crate  | 3 days |
| Tests + golden fixtures | 1 day  |
| Integration & CI        | 1 day  |

## Author

lojak

## Status

Draft
