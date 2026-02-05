# Change: Add X3 parser grammar documentation and tests

## Why

Atlas Sphere needs a deterministic parser reference so every compiler pass, GPU mutation agent, and validator can agree on what valid X3 looks like. Right now the codebase groks only the minimal AST but lacks a canonical grammar document, OpenSpec requirement, and targeted tests to keep future evolution honest.

## What Changes

- Publish the X3 grammar reference so designers, implementers, and AI agents share the same Pratt expression rules, statement forms, and precedence table.
- Expand `crates/x3-parser` tests to exercise function bodies, `let` bindings, and call arguments derived from the grammar so parsing regressions are caught early.
- Capture the grammar requirement inside `openspec/specs/x3-language/spec.md` and link it to the new documentation.
- Outline follow-up work (atomic blocks, agent/context constructs) in the change tasks so the parser roadmap stays visible.

## Impact

- Affected specs: `x3-language` (new capability for parser grammar documentation and deterministic coverage).
- Affected code: `crates/x3-parser/src/parser.rs`, `openspec/x3-language-grammar.md`, `openspec/specs/x3-language/spec.md`.