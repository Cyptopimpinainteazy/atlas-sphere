# Atlas Sphere - Copilot Instructions

## Project Overview

Atlas Sphere is a next-generation Layer-1 blockchain with dual virtual machine support (EVM + SVM), enabling native interoperability between Ethereum-style smart contracts and Solana-style Sealevel programs. The network is built on Substrate and optimized for cross-domain composability with atomic cross-chain operations.

## Technology Stack

### Core Technologies
- **Rust**: Primary language for blockchain runtime, pallets, and node (stable toolchain)
- **Substrate Framework**: FRAME-based runtime with Aura + GRANDPA consensus
- **TypeScript/JavaScript**: Frontend applications, tooling, and testing
- **React 19**: UI components and web applications
- **Node.js**: Build tooling and development scripts

### Key Components
- **Runtime**: Substrate FRAME runtime with custom pallets
- **Pallets**: Custom blockchain modules (atlas-kernel, atomic-trade-engine, governance, treasury, etc.)
- **EVM Integration**: Frontier-based Ethereum compatibility layer
- **SVM Integration**: Solana Virtual Machine adapter
- **Node Service**: P2P networking, RPC server, consensus
- **Crates**: Supporting libraries (atlas-sdk, x3-cli, indexer, gateway, etc.)

### Build Tools
- `cargo` for Rust compilation
- `rustup` for toolchain management
- `npm` for JavaScript/TypeScript dependencies
- `make` for BMAD build automation
- GitHub Actions for CI/CD

## Coding Standards

### Rust Code Style
- Follow the official Rust style guide
- Use `rustfmt` for automatic formatting
- Use `clippy` for linting and catching common mistakes
- Run `cargo fmt` and `cargo clippy` before committing
- Write comprehensive doc comments for public APIs using `///`
- Use snake_case for function and variable names
- Use PascalCase for types and traits
- Prefer explicit error handling over unwrapping (avoid `.unwrap()` in production code)

### TypeScript/JavaScript Style
- Use TypeScript for type safety in new code
- Follow modern ES6+ syntax
- Use functional components with hooks in React
- Prefer `const` over `let`, avoid `var`
- Use meaningful variable and function names
- Add JSDoc comments for complex functions

### Testing Requirements
- All new Substrate pallets must include unit tests using `#[test]` and mock runtime
- Runtime changes require integration tests
- Frontend changes should include React component tests where appropriate
- Run `cargo test` for Rust tests
- Run `npm test` for JavaScript/TypeScript tests
- E2E tests use Playwright and Cypress

### Security Best Practices
- Never commit secrets, private keys, or credentials
- Validate all external inputs in pallets and RPCs
- Use safe arithmetic operations (checked/saturating math) in Substrate code
- Review security implications of storage changes
- Follow OWASP guidelines for web components
- Report security vulnerabilities to security@atlas-sphere.io (not via GitHub issues)

## Architecture Patterns

### Substrate Runtime Development
- Each pallet should be self-contained with clear interfaces
- Use `Config` trait to define pallet dependencies
- Implement proper weight calculations for all extrinsics
- Use storage versioning for migrations
- Prefer `BoundedVec` over `Vec` in storage
- Use events for important state changes
- Implement proper error handling with custom error types

### Cross-VM Bridge Pattern
- The Atlas Kernel pallet coordinates dual-VM execution
- Comits (commits) represent atomic cross-domain operations
- Asset registry manages native and wrapped assets
- Canonical ledger tracks cross-VM state

### RPC and Client Interaction
- Node provides HTTP JSON-RPC on port 9944
- Atlas Kernel exposes custom RPC methods via `node/src/rpc.rs`
- Use polkadot.js for client-side interactions
- Frontend apps use `@polkadot/api` and `ethers.js`

## Development Workflow

### Building the Project
```bash
# Build the node
cargo build --release

# Build with WASM runtime
cargo build --release --features runtime-wasm

# Build specific workspace member
cargo build -p pallet-atlas-kernel
```

### Running Tests
```bash
# Run all Rust tests
cargo test --workspace

# Run tests for specific crate
cargo test -p pallet-atlas-kernel

# Run JavaScript/TypeScript tests
npm test

# Run E2E tests
npm run test
```

### Linting and Formatting
```bash
# Format Rust code
cargo fmt --all

# Lint Rust code
cargo clippy --workspace --all-targets -- -D warnings

# Check without building
cargo check --workspace
```

### Running a Node
```bash
# Development node with clean state
cargo run --release -- --dev --tmp

# Connect to testnet
# RPC: http://rpc.testnet.atlas-sphere.io:9944
# Faucet: https://faucet.testnet.atlas-sphere.io
```

## Project Structure

- `/pallets/` - Substrate runtime pallets
- `/crates/` - Supporting Rust libraries
- `/runtime/` - Substrate runtime definition
- `/node/` - Node service implementation
- `/apps/` - Frontend applications
- `/ui/` - React UI components
- `/scripts/` - Build and deployment scripts
- `/tests/` - Integration and E2E tests
- `/.github/workflows/` - CI/CD pipelines

## Important Files and Conventions

- `Cargo.toml` - Workspace configuration and dependencies
- `rust-toolchain.toml` - Rust toolchain specification
- `Makefile` - BMAD build targets
- `.gitleaks.toml` - Secret scanning configuration
- `SECURITY.md` - Security policy and reporting
- `CONTRIBUTING.md` - Contribution guidelines

## Common Tasks

### Adding a New Pallet
1. Create directory under `/pallets/`
2. Add to workspace in root `Cargo.toml`
3. Implement `Config` trait and storage
4. Add to runtime in `/runtime/src/lib.rs`
5. Write unit tests using mock runtime
6. Document public APIs

### Adding a New Crate
1. Create directory under `/crates/`
2. Add to workspace in root `Cargo.toml`
3. Follow standard Rust project structure
4. Include README.md with usage examples
5. Add tests and documentation

### Working with Frontend
1. Frontend code is in `/ui/`, `/apps/`, and `/swarm-dashboard/`
2. Use React 19 with functional components
3. State management follows React patterns
4. Use ethers.js for Ethereum interactions
5. Use @polkadot/api for Substrate interactions

## CI/CD and Quality Gates

- CI runs on all PRs via GitHub Actions
- Required checks: build, test, lint, security scan
- Accessibility checks run on frontend changes (axe-core)
- Docker images published via `docker-publish.yml`
- Production deployment via `production-deploy.yml`
- E2E integration tests via `e2e-integration-tests.yml`

## Resources and Documentation

- [Substrate Documentation](https://docs.substrate.io/)
- [FRAME Documentation](https://docs.substrate.io/reference/frame-pallets/)
- [Polkadot.js API](https://polkadot.js.org/docs/)
- Project Status: See `PROJECT_STATUS.md` and `ATLAS_SPHERE_STATUS.md`
- Testnet Info: See `TESTNET_ANNOUNCEMENT.md`
- Security Policy: See `SECURITY.md`
- Contributing: See `.github/CONTRIBUTING.md`

## Code Review Guidelines

- Keep PRs focused and small when possible
- Include tests for new functionality
- Update documentation for API changes
- Run all checks locally before pushing
- Follow security best practices
- Consider performance implications of runtime changes
- Test cross-VM interactions thoroughly

## Special Notes

- The project uses BMAD Method for workflow automation (see `crates/vibe-bmad/`)
- Testnet is currently running with mock VM executors; full EVM/SVM integration in progress
- Governance pallet is not yet implemented (sudo enabled for development)
- X3 language compiler and toolchain included in `/crates/x3-*`
- GPU swarm and quantum computing features are experimental
