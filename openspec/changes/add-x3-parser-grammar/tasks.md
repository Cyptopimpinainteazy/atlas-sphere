## 1. Implementation
- [ ] Publish `openspec/x3-language-grammar.md` detailing the X3 grammar, Pratt rules, and precedence table.
- [ ] Expand `crates/x3-parser/src/parser.rs` tests so the parser proves it can parse functions, `let` bindings, returns, and nested call expressions.
- [ ] Create `openspec/specs/x3-language/spec.md` that codifies the grammar requirement and references the new document.
- [ ] Add the `changes/add-x3-parser-grammar/specs/x3-language/spec.md` delta so OpenSpec knows this change adds the parser grammar capability.

## 2. Validation
- [ ] Run `cargo test -p x3-parser` to ensure the new tests compile and pass.
- [ ] Run `openspec validate add-x3-parser-grammar --strict` and resolve any validation concerns.