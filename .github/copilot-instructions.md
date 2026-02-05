# GitHub Copilot Instructions for atlas-sphere

## Repository Overview

This is a multi-language project combining TypeScript/React frontend, Rust backend services, and Python database migrations. The repository emphasizes accessibility testing, diagnostic capabilities, and continuous integration.

## Project Structure

- **swarm-dashboard/** - React/TypeScript dashboard application with Webpack bundling
- **crates/swarm-media/** - Rust service for media handling using Tokio async runtime
- **alembic/** - Python database migrations using Alembic
- **scripts/** - Utility scripts for validation and automation

## Technology Stack

### Frontend (swarm-dashboard)
- **Language**: TypeScript/TSX (migrated from JavaScript)
- **Framework**: React 18
- **Build Tool**: Webpack 5
- **Testing**: Jest with ts-jest, React Testing Library, Playwright for E2E
- **Key Libraries**: D3.js for visualizations, Howler.js for audio, react-toastify for notifications

### Backend (crates/swarm-media)
- **Language**: Rust (Edition 2021)
- **Runtime**: Tokio async
- **Database**: PostgreSQL with SQLx
- **Key Libraries**: serde for serialization, reqwest for HTTP, tracing for logging

### Database
- **Engine**: PostgreSQL 15
- **Migration Tool**: Alembic (Python)
- **Connection**: SQLx for Rust, standard PostgreSQL drivers

## Build & Test Commands

### Frontend (swarm-dashboard)
```bash
cd swarm-dashboard
npm ci                      # Install dependencies
npm run tsc                 # Type-check TypeScript
npm test                    # Run Jest unit tests
npm run test:ci             # Run tests with coverage
npm run build               # Production build
npm run e2e:serve           # Start E2E demo server (port 3001)
npm run e2e:test            # Run Playwright E2E tests
```

### Backend (Rust)
```bash
cd crates/swarm-media
cargo build                 # Build the project
cargo test                  # Run unit tests
cargo test -- --nocapture   # Run tests with output
```

### Database Migrations
```bash
# Requires DATABASE_URL environment variable
# Example for local development (use your actual credentials):
export DATABASE_URL=postgresql://username:password@localhost:5432/swarm_test
alembic upgrade head        # Apply migrations
python scripts/validate_alembic.py  # Validate migrations
```

## Code Style & Conventions

### TypeScript/React
- Use TypeScript with strict compiler options (`noUncheckedIndexedAccess` enabled)
- Components should be functional with hooks (no class components)
- Use explicit return types for hooks and complex functions
- Prefer TSX over JSX for all React components
- Test React components with React Testing Library and Jest

### Rust
- Follow standard Rust conventions (rustfmt)
- Use async/await with Tokio runtime
- Implement proper error handling with thiserror/anyhow
- Include unit tests in the same file using `#[cfg(test)]`
- Use mockall for mocking in tests

### Python
- Follow PEP 8 style guidelines
- Alembic migrations must include orphaned-sequence guards or `# sequence-guard` comment
- Place migration files in `alembic/versions/`

## Accessibility Requirements

**Critical**: This repository has automated accessibility testing with axe-core.

- All UI changes must pass axe-core accessibility checks
- Playwright E2E tests automatically run accessibility scans
- Violations are captured in `swarm-dashboard/e2e/axe-violations.json`
- CI will create triage issues (labels: `accessibility`, `triage`) when violations are detected
- Reference: `.github/triage/AXE_TRIAGE.md` for triage procedures

### Accessibility Checklist for UI Changes
- Ensure proper ARIA labels and roles
- Maintain keyboard navigation support
- Provide sufficient color contrast
- Include alt text for images
- Test with screen readers when possible

## Pull Request Guidelines

### Required Checklist Items
- [ ] I added/updated Alembic migrations if needed.
- [ ] **If** adding an Alembic migration, I included an orphaned-sequence guard or added a `# sequence-guard` comment.
- [ ] If you want the non-blocking Alembic roundtrip check to run on this PR, add the label: `run-alembic-roundtrip`.

### Adding Alembic Migration
1. Create migration file in `alembic/versions/`
2. Include sequence guard or `# sequence-guard` comment
3. Add label `run-alembic-roundtrip` to PR if you want roundtrip validation

## CI/CD Workflows

### Key Workflows
- **playwright-e2e.yml** - Runs Jest unit tests (with coverage) and Playwright E2E tests separately; uploads coverage artifacts
- **ci-swarm.yml** - Full CI pipeline with PostgreSQL, Python tests, Node tests, Lighthouse performance checks, and Rust EVM diagnostics
- **swarm-dashboard-axe-triage.yml** - Creates accessibility triage issues when axe violations are detected
- **alembic-roundtrip.yml** - Validates database migration reversibility (triggered by `run-alembic-roundtrip` label)

### Diagnostic Capabilities
The repository includes advanced diagnostic workflows for EVM integration:
- SIGILL detection with automatic issue creation
- strace and gdb capture for debugging
- Core dump analysis
- See `.github/triage/SIGILL_PLAYBOOK.md` for details

## Testing Philosophy

1. **Unit Tests**: Test individual functions and components in isolation
2. **Integration Tests**: Test service interactions (especially for Rust services)
3. **E2E Tests**: Validate complete user workflows with Playwright
4. **Accessibility Tests**: Automated axe-core scans on all E2E tests
5. **Coverage**: Jest generates coverage reports uploaded to CI artifacts

## Common Tasks

### Adding a New React Component
1. Create component file in `swarm-dashboard/src/components/` as `.tsx`
2. Define TypeScript interfaces for props
3. Add unit test in `swarm-dashboard/src/__tests__/` or co-located test file
4. Ensure accessibility compliance (ARIA, keyboard navigation)
5. Run `npm run tsc` to verify types
6. Run `npm test` to verify tests pass

### Adding a New Rust Service
1. Create module in `crates/swarm-media/src/`
2. Implement async functions with proper error handling
3. Add unit tests using `#[tokio::test]`
4. Update `Cargo.toml` if new dependencies needed
5. Run `cargo test` to verify

### Adding Database Migration
1. Create migration file: `alembic/versions/NNN_description.py`
2. Include sequence guard or `# sequence-guard` comment
3. Test locally: `alembic upgrade head` then `alembic downgrade -1`
4. Add `run-alembic-roundtrip` label to PR for CI validation

## Environment Setup

### Required Environment Variables
- `DATABASE_URL` - PostgreSQL connection string (for migrations and Rust services)
  - Format: `postgresql://username:password@host:port/database`
- `AXE_TRIAGE_ASSIGNEE` (optional) - GitHub username for auto-assigning accessibility triage issues
  - Set as a Repository Variable in GitHub Settings → Secrets and variables → Actions → Variables
  - Example: `gh variable set AXE_TRIAGE_ASSIGNEE --body username -R owner/repo`

### Local Development
1. Install Node.js 20+
2. Install Rust (stable toolchain)
3. Install Python 3.11+
4. Install PostgreSQL 15+
5. Run `npm ci` in swarm-dashboard directory
6. Set up local PostgreSQL database
7. Apply migrations with `alembic upgrade head`

## Security & Diagnostics

- Never commit secrets or credentials
- Use environment variables for sensitive configuration
- The repository includes SIGILL crash detection and reporting
- Core dumps and strace logs are captured automatically in CI
- Security issues are labeled and tracked through GitHub Issues

## Additional Resources

- Contributing guidelines: `.github/CONTRIBUTING.md`
- Accessibility triage: `.github/triage/AXE_TRIAGE.md`
- SIGILL debugging: `.github/triage/SIGILL_PLAYBOOK.md`
- Dashboard README: `swarm-dashboard/README.md`
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
- E2E tests use both Playwright (swarm-dashboard) and Cypress (apps/e2e)
- Jest for unit/integration tests in TypeScript projects

### Security Best Practices
- Never commit secrets, private keys, or credentials
- Validate all external inputs in pallets and RPCs
- Use safe arithmetic operations (checked/saturating math) in Substrate code
- Review security implications of storage changes
- Follow OWASP guidelines for web components
- Report security vulnerabilities to security@atlas-sphere.io (not via GitHub issues)
- Security reports receive acknowledgment within 48 hours (see SECURITY.md)

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
- Comits (atomic cross-domain commits) represent transactions spanning both VMs
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

# Run E2E tests with Cypress (from root)
npm test

# Open Cypress test runner
npm run test:open

# Run Playwright tests (in swarm-dashboard)
cd swarm-dashboard && npm run test:e2e

# Run Jest unit tests (in swarm-dashboard)
cd swarm-dashboard && npm test
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
