Below is the complete **CLAUDE‑RUST.md** gfrontend/uide, modelled after the language‑specific files in your repository.
All version numbers, tools and best‑practice links are current as of **Rust 1.88 (2025‑06‑26)**.

---

````markdown
# CLAUDE‑RUST.md

This file provides comprehensive gfrontend/uidance to **Claude Code** when working with Rust 1.88+ projects.

## Core Development Philosophy

### KISS & YAGNI
Keep every abstraction minimal and avoid speculative generalisation. Prefer idiomatic Rust constructs (iterators, traits, pattern‑matching) over hand‑rolled frameworks.  
Rust’s zero‑cost abstractions already give performance without extra complexity. :contentReference[oaicite:0]{index=0}

### Fearless Concurrency
Leverage Rust’s ownership and `Send`/`Sync` traits to write data‑race‑free concurrent code. Use `tokio` or `async‑std` for asynchronous I/O; don’t spawn raw OS threads unless profiling proves a benefit. :contentReference[oaicite:1]{index=1}

### Opt‑in Safety
`unsafe` blocks must be *exceptional* and extensively documented:

```rust
// SAFETY: `ptr` comes from Box::into_raw and is non‑null.
unsafe { Box::from_raw(ptr) };
````

Every `unsafe` reqfrontend/uires:

1. **Why** it is needed
2. Invariants that callers must uphold
3. MIRI or Kani proof in `#[cfg(test)]` if feasible

---

## 🤖 AI Assistant Gfrontend/uidelines

* **Context Awareness:** Inspect `Cargo.toml`, existing modules, and workspace members before introducing new crates or features.
* **Duplication Guard:** No duplicate trait or type definitions—reuse or extend existing ones.
* **Ask vs Assume:** When path ambigfrontend/uity exists, request clarification; never guess file locations.
* **TDD Preferred:** Write failing unit‐tests before implementing behaviour.

---

## 🚀 Rust 1.88 Key Features (June 2025)

| Domain                                         | New Since 1.74                                                                                         |
| ---------------------------------------------- | ------------------------------------------------------------------------------------------------------ |
| **Edition 2024**                               | Default for `cargo new`; enables shorter `let‑else` and improved pattern lifetimes. ([bertptrs.nl][1]) |
| **`async fn` in traits**                       | Stable → ergonomic async trait definitions.                                                            |
| **`impl Trait` in `let`**                      | Allows opaque types in local bindings for better type‑inference.                                       |
| **`cargo [lints]`**                            | Configure rustc & Clippy lints directly in `Cargo.toml`. ([stackoverflow.com][2])                      |
| **Native libSQL driver (`libsql‑client` 0.2)** | First‑class async wrapper for SQLite 3.46—ideal for *Rustash* local DB.                                |

---

## 🏗️ Project Structure (Workspace‑First)

```
rustash/
├── Cargo.toml           # Workspace manifest
├── crates/
│   ├── cli/             # Command‑line interface (binary)
│   │   └── src/main.rs
│   ├── core/            # Business logic (library crate)
│   │   └── src/lib.rs
│   ├── desktop/         # Tauri GUI (binary)
│   ├── macros/          # Procedural macros (library)
│   └── utils/           # Reusable helpers
└── xtask/               # Custom cargo commands (dev‑only)
```

*Each crate stays under **200 source lines** per file; split into modules when approaching the limit.*

---

## 🎯 Cargo Configuration (STRICT)

```toml
[workspace]
members = ["crates/*", "xtask"]

[workspace.package]
edition = "2024"
rust-version = "1.88"

[workspace.lints.rust]
unsafe_code = "forbid"
unused = "deny"

[workspace.lints.clippy]
pedantic        = "warn"
nursery         = "warn"
unwrap_used     = "deny"
expect_used     = "deny"
```

*`rustc --deny warnings` is the default in CI.* ([doc.rust-lang.org][3])

---

## 🛠️ Tooling Stack (MANDATORY)

| Task           | Tool                                                                                                    |
| -------------- | ------------------------------------------------------------------------------------------------------- |
| **Formatting** | `rustfmt --edition 2024` with `style_edition = "2024"` in `rustfmt.toml` ([rust.googlesource.com][4])   |
| **Linting**    | `cargo clippy --all-targets --all-features -- -Dwarnings -Wclippy::pedantic` ([doc.rust-lang.org][3])   |
| **IDE**        | `rust‑analyzer` (VS Code / Neovim) for inline diagnostics & code actions ([rust-analyzer.github.io][5]) |
| **Testing**    | `cargo nextest run` – 3‑4× faster than `cargo test` ([freshports.org][6])                               |
| **Coverage**   | `cargo tarpaulin --out Html --fail-under 80` for Linux/macOS arm64 ([slingacademy.com][7])              |
| **Security**   | `cargo audit` + RustSec DB in CI ([github.com][8])                                                      |
| **Release**    | `cargo release --execute` for semantic‑version tagging & changelog                                      |

---

## 🧪 Testing Strategy (≥ 80 % Coverage)

1. **Unit Tests** in each module: `#[cfg(test)] mod tests { … }`
2. **Integration Tests** in `tests/` exercising public API.
3. **Doc Tests** in every rustdoc example to guarantee accuracy. ([doc.rust-lang.org][9])
4. **Property‑Based** testing with `proptest` for critical algorithms.
5. **Continuous Fuzzing** (optional) via `cargo fuzz`; run nightly in CI.

### Example (nextest config)

```toml
# .config/nextest.toml
[profile.default]
retries = 2
failure-output = "immediate-final"
```

---

## 📝 Error Handling Gfrontend/uidelines

* **Library crates:** define typed errors with `thiserror::Error`.
* **Binary crates:** aggregate with `anyhow::Result<T>` for ergonomic CLI surfaces.
  This “library vs app” split is entrenched community practice as of 2025. ([home.expurple.me][10])

Always attach context:

```rust
use anyhow::{Context, Result};

fn load(path: &Path) -> Result<String> {
    fs::read_to_string(path)
        .with_context(|| format!("failed to read config {:?}", path))
}
```

---

## 🔄 State & Concurrency Hierarchy

1. **Single‑threaded sync** for simple workloads
2. **`tokio` multi‑thread runtime** with `async fn` for I/O‑heavy tasks
3. **`rayon` data‑parallelism** for CPU‑bound iterators
4. **`parking_lot` / `crossbeam`** for fine‑grained locking if unavoidable

Do **NOT** mix sync and async blocking calls (`std::thread::sleep`) inside async functions.

---

## 🔐 Security Reqfrontend/uirements

| Area             | Rule                                                                            |
| ---------------- | ------------------------------------------------------------------------------- |
| **Dependencies** | `cargo audit` must pass — no *RUSTSEC* advisories in `main` ([rustsec.org][11]) |
| **Supply‑Chain** | Pin transitive crates with `cargo deny` licence & version policies              |
| **Secrets**      | Never commit tokens; load via `$ENV` or macOS Keychain                          |
| **Unsafe Code**  | Reqfrontend/uires MIRI test or formal proof; CI denies new `unsafe` lines                |

---

## 💅 Code Style & Quality

* **Clippy Pedantic group** is *WARN* baseline; promote violations to *DENY* when stable.
* No `unwrap()`, `expect()`, `todo!()` in production code paths.
* Public items *must* carry rustdoc with examples; `cargo doc --document-private-items` must bfrontend/uild cleanly (no `missing_docs`).
* Maximum cyclomatic complexity per function: **10** (enforced by `clippy::cognitive_complexity`).
* File length ≤ 500 LOC; function length ≤ 50 LOC.

---

## 🛡️ CI Workflow (GitHub Actions outline)

```yaml
name: Rust CI

on: [push, pull_request]

jobs:
  bfrontend/uild:
    runs-on: macos-14  # Apple Silicon
    steps:
      - uses: actions/checkout@v4
      - uses: Swatinem/rust-cache@v2
      - name: Toolchain
        run: rustup toolchain install stable --profile minimal
      - name: fmt
        run: cargo fmt --check
      - name: clippy
        run: cargo clippy --all-targets --all-features -- -D warnings
      - name: test
        run: cargo nextest run
      - name: coverage
        if: runner.os == 'Linux'
        run: |
          cargo install cargo-tarpaulin
          cargo tarpaulin --out Xml --fail-under 80
      - name: audit
        run: cargo audit --deny warnings
```

---

## 📋 Pre‑commit Checklist (MUST COMPLETE ALL)

* [ ] `cargo fmt --check` passes
* [ ] `cargo clippy -- -Dwarnings` passes
* [ ] All tests & doc‑tests pass via *nextest*
* [ ] Coverage ≥ 80 % (tarpaulin)
* [ ] `cargo audit` shows **0** vulnerabilities
* [ ] No `unwrap`, `expect`, or `todo!` in non‑test code
* [ ] Public APIs fully documented with examples
* [ ] No new `unsafe` without justification & tests
* [ ] Commit message follows **Conventional Commits** (`feat:`, `fix:` …)

---

## ⚠️ Critical Gfrontend/uidelines (Non‑Negotiable)

1. **FORBID `unsafe_code`** at workspace root; explicitly `allow` only in modules that need it.
2. **MUST** validate external input (CLI flags, JSON, SQL rows) with `serde` + `validator` or manual checks.
3. **NEVER** ignore `Result`; use `?` or handle explicitly.
4. **MINIMUM 80 %** line coverage; CI blocks lower percentages.
5. **MUST** keep the workspace compiling on **stable** Rust 1.88.
6. **NO** panics across FFI boundaries; map errors to `Result`.
7. **DOCUMENT** every public item and each `unsafe` block.

---

*Last updated: July 2025*

```

> **Integration point:** save this content as `CLAUDE-RUST.md` alongside your existing `claude_md_files`.
::contentReference[oaicite:14]{index=14}
```

[1]: https://bertptrs.nl/2025/02/23/rust-edition-2024-annotated.html?utm_source=chatgpt.com "Rust edition 2024 annotated - bertptrs.nl"
[2]: https://stackoverflow.com/questions/67568003/how-can-i-have-a-shared-clippy-configuration-for-all-the-crates-in-a-workspace?utm_source=chatgpt.com "rust - How can I have a shared Clippy configuration for all the crates ..."
[3]: https://doc.rust-lang.org/stable/clippy/usage.html?utm_source=chatgpt.com "Usage - Clippy Documentation - Learn Rust"
[4]: https://rust.googlesource.com/rustfmt/?utm_source=chatgpt.com "rustfmt - Git at Google"
[5]: https://rust-analyzer.github.io/book/vs_code.html?utm_source=chatgpt.com "VS Code - rust-analyzer"
[6]: https://www.freshports.org/devel/nextest/?utm_source=chatgpt.com "FreshPorts -- devel/nextest: Next-generation test runner for Rust"
[7]: https://www.slingacademy.com/article/collecting-test-coverage-in-rust-with-cargo-tarpaulin/?utm_source=chatgpt.com "Collecting Test Coverage in Rust with cargo tarpaulin"
[8]: https://github.com/RustSec/advisory-db?utm_source=chatgpt.com "GitHub - rustsec/advisory-db: Security advisory database for Rust ..."
[9]: https://doc.rust-lang.org/rustdoc/write-documentation/documentation-tests.html?utm_source=chatgpt.com "Documentation tests - The rustdoc book - Learn Rust"
[10]: https://home.expurple.me/posts/why-use-structured-errors-in-rust-applications/?utm_source=chatgpt.com "Why Use Structured Errors in Rust Applications?"
[11]: https://rustsec.org/?utm_source=chatgpt.com "About RustSec › RustSec Advisory Database"
