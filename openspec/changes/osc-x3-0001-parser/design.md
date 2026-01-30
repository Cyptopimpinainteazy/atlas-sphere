## Context

This design covers the internal implementation decisions for the X3 parser crate. The primary audience is the compiler team and AI agents that will maintain or extend the parser.

## Goals / Non-Goals

**Goals:**
- Deliver a deterministic parser that produces the same AST on every run.
- Provide clear error messages with source spans.
- Support incremental parsing (future) by making the token stream position-aware.
- Keep memory bounded and avoid panics on untrusted input.

**Non-Goals:**
- Full error recovery (single-error-exit is acceptable for v1).
- IDE incremental parsing / tree-sitter integration (deferred).
- Pretty-printing / formatter (separate crate).

## Decisions

### Pratt Parsing

We use a binding-power-based Pratt parser for expressions. Each binary operator has a `(left_bp, right_bp)` tuple; prefix/postfix operators have a single binding power. The table lives in `grammar.rs` and is referenced by the grammar doc at `openspec/x3-language-grammar.md`.

**Alternatives considered:**
- Recursive descent with explicit precedence functions – more verbose, harder to extend.
- PEG / parser combinator – extra dependency, non-obvious precedence handling.

### TokenStream Wrapper

A thin wrapper (`tokens.rs`) over the lexer iterator that tracks current position and provides `peek()`, `bump()`, `expect()`. This allows the parser to remain lexer-agnostic and simplifies span tracking.

### Error Model

`ParseError` carries:
- `message: String`
- `span: Span`
- `hint: Option<String>`

We do not implement multi-error recovery for v1. The parser exits on the first unrecoverable error.

### Determinism

- Statements and expressions are collected into `Vec` in source order.
- No hash-based containers for ordering.
- Floating-point literals are stored as strings until semantic analysis.

## Risks / Trade-offs

| Risk                                           | Mitigation                                                                     |
| ---------------------------------------------- | ------------------------------------------------------------------------------ |
| Deeply nested expressions could stack-overflow | Enforce a maximum nesting depth (~256) and return error.                       |
| Lexer bugs surface as parser panics            | Unit-test the lexer separately; parser uses `expect()` which returns `Result`. |
| Grammar drift (doc ≠ code)                     | CI step compares binding-power table against grammar doc.                      |

## Migration Plan

N/A – this is new code.

## Open Questions

- Should `atomic` block metadata expression be optional or required?
- Do we need `break` / `continue` for `loop` / `while` / `for` in v1?
