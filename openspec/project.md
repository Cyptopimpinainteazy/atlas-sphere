# Project Context

## Purpose

Atlas Sphere is a Substrate-based Layer-1 chain that unifies Ethereum-style and Solana-style execution environments. The Atlas Kernel pallet coordinates atomic "Comit" transactions, a canonical ledger, and asset registry so that both the Frontier EVM adapter and the Solana-style SVM adapter can participate in the same blocks with predictable gas/fee handling.

## Tech Stack

- Rust + Cargo for the node binary, runtime, pallets, adapters, and CLI tooling (targets include `wasm32-unknown-unknown`).
- Substrate/FRAME as the runtime framework with Aura block production, GRANDPA finality, and custom pallets (`atlas-kernel`, authorization, asset registry).
- Frontend tooling built on Next.js 14 + React 18 + Tailwind CSS, powered by Zustand, @tanstack/react-query, SWR, and ethers for browser interactions.
- Node.js (>=20) scripts for orchestration, the BMAD Method integration (`crates/vibe-bmad`), and Next.js builds.
- Supporting CLIs: `subkey`, `subxt`, `node`/`npm`, and OpenSpec itself for spec-driven requirements.

## Project Conventions


### Code Style

- Rust code follows Substrate + Polkadot conventions: use `cargo fmt --all` before commits, enforce `cargo clippy --all-targets -- -D warnings`, prefer `Result` propagation via `?`, and keep runtime logic inside pallets/modules rather than free functions.
- Frontend/JS code uses TypeScript, runs ESLint/Prettier via the Next.js stack, and keeps styling in Tailwind CSS utilities; avoid introducing new CSS frameworks without a clear justification.
- Documentation and specs are maintained inside `openspec/changes` and `openspec/specs`; every new capability must have a proposal, delta spec, and task list before implementation.

### Architecture Patterns

- Layered runtime: `pallets/atlas-kernel` for cross-VM orchestration, runtime wiring in `runtime/src/lib.rs`, and node service + RPC plumbing under `node/src/`.
- Dual-execution model with mock adapters wired during development and Frontier/SVM integrations controlled by adapter traits defined in `pallets/atlas-kernel/src/adapters.rs`.
- Canonical ledger and `Comit` flow: validate payloads (<32KiB), check authorization, execute via adapters, and finalize committed outputs before updating on-chain state.
- Tooling is modular: CLI scripts, BMAD workflows, and frontend apps live in their own crates/apps but rely on shared runtime artifacts and onboarding docs under `docs/` and `how-to-guides/`.

### Testing Strategy

- Run `cargo test --all`, targeted pallet suites like `cargo test -p pallet-atlas-kernel`, and `./RUN_ALL_TESTS.sh` for full integration coverage.
- Enforce formatting/linting with `cargo fmt --all` and `cargo clippy --all-targets --all-features -- -D warnings` as part of CI.
- Validate OpenSpec proposals via `openspec validate <change-id> --strict` before implementation; spec scenarios must be concrete and executable.
- Expect frontend/local tooling to have their own scripts (`npm run test`, etc.) where relevant; new UI work should ship with storybook or React testing as needed.

### Git Workflow

- Branch from `main` for each change, use descriptive commit messages, and reference related issues/PRs.
- Create feature/fix proposals under `openspec/changes/<change-id>/` before touching runtime or protocol behavior; update `tasks.md`, delta specs, and designs as required.
- Always run the relevant test suite (runtime, node, or frontend) locally before pushing; the GitHub Actions CI will rerun `cargo build`, `cargo test`, and WASM checks.
- Keep working trees clean; do not reset or revert unrelated changes unless the user explicitly asks.

## Domain Context

- Atlas Sphere is a heterogeneous blockchain: Substrate runtime with Aura + GRANDPA consensus, a canonical ledger (Atlas Kernel), and two VM adapters (Frontier-based EVM + SVM bridge) that aim to execute within the same block for atomic cross-domain transactions.
- The key security focus is on account authorization (only authorized accounts can submit `Comit`s) and matching `prepare_root` values, ensuring finality across VM executions without trusted intermediaries.
- The project bundles CLI tools, wallet/explorer frontends, a dex playground, and a BMAD-powered planning workflow, all grounded on dual-VM interoperability and deterministic state transitions.

## Important Constraints

- WASM runtime builds are fragile (`InvalidTableReference(128)` appears if dependencies drift); every contribution must respect the pinned Substrate revision (commit `948fbd2`) and `patches/` folder overrides.
- Dual-VM adapters currently use mock executors; production-ready Frontier and rBPF adapters are still under integration, so new features must account for missing execution paths.
- Authorization checks default to strict mode; the `dev-bypass` feature is only for development and must never ship in production builds.
- `Comit` payloads must stay within the documented size limits (≤16KiB per payload, ≤32KiB combined) and follow the canonical ledger ordering requirements.

## External Dependencies

- Substrate (FRAME pallets, node/cli helpers) and Polkadot primitives (Aura, GRANDPA, SCALE codec) underpin the runtime.
- Frontier EVM adapter and Solana rBPF/SVM bridge libraries live in `crates/` and are orchestrated through adapter traits; dependencies include `evm`, `solana_rbpf`, and `parity-scale-codec`.
- Frontend stack depends on Next.js 14, React 18, Tailwind CSS, Zustand, @tanstack/react-query, SWR, ethers, and related tooling across `apps/{wallet,explorer,dex}`.
- Planning & automation integrate BMAD (Node.js-based) in `crates/vibe-bmad`; Node 20+ is required along with npm/yarn for scripts.
- CLI/key tooling uses `subkey`, `subxt`, `openssl`, `cmake`, and standard Linux packages documented in the README prerequisites.
