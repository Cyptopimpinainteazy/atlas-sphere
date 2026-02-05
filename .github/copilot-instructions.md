# GitHub Copilot Instructions for atlas-sphere

## Repository Overview

This is the **atlas-sphere** repository, a multi-language project containing:
- A React/TypeScript dashboard application (`swarm-dashboard/`)
- Rust crates for backend services (`crates/`)
- Python scripts for validation and database migrations (`alembic/`)

## Technology Stack

### Frontend (swarm-dashboard/)
- **Language**: TypeScript/React 18
- **Build Tool**: Webpack 5
- **Testing**: Jest with ts-jest and React Testing Library
- **E2E Testing**: Playwright with axe-core accessibility scanning
- **TypeScript Config**: Strict mode enabled with `noUncheckedIndexedAccess`

### Backend (crates/swarm-media/)
- **Language**: Rust (2021 edition)
- **Framework**: Tokio async runtime
- **Database**: SQLx with PostgreSQL
- **Testing**: Cargo test with mockall

### Database Migrations
- **Tool**: Alembic (Python)
- **Database**: PostgreSQL 15
- **Validation**: Custom Python validation script (`scripts/validate_alembic.py`)

## Build and Test Commands

### Frontend (swarm-dashboard/)
```bash
cd swarm-dashboard
npm install              # Install dependencies
npm run tsc              # Type-check TypeScript
npm run build            # Production build
npm test                 # Run unit tests
npm run test:ci          # Run tests with coverage in CI
npm run e2e:serve        # Start demo server for E2E tests
npm run e2e:test         # Run Playwright E2E tests
```

### Backend (Rust)
```bash
cd crates/swarm-media
cargo build              # Build the crate
cargo test               # Run tests
cargo clippy             # Lint code
```

### Database Migrations
```bash
alembic upgrade head     # Run migrations
alembic downgrade base   # Rollback all migrations
python scripts/validate_alembic.py  # Validate migration files
```

## Coding Conventions

### TypeScript/React
- Use **TypeScript strict mode** with `noUncheckedIndexedAccess` enabled
- Prefer **functional components** with hooks
- Use **explicit return types** for hooks and functions
- Follow React 18 best practices
- Use **TSX** file extension for React components
- Place test files adjacent to components in `tests/` directory
- Use Testing Library for component tests

### Rust
- Follow Rust 2021 edition standards
- Use async/await with Tokio runtime
- Prefer `thiserror` for error types
- Use `tracing` for logging (not `println!`)
- Include comprehensive error handling
- Write unit tests for all public APIs

### Python
- Use type hints where applicable
- Follow PEP 8 style guidelines
- Validate Alembic migrations with the provided script

### General
- Keep commits focused and descriptive
- Reference issue numbers in commit messages
- Run linters and tests before committing

## Accessibility Requirements

**Critical**: This repository has strict accessibility standards.

- All UI changes **must pass axe-core accessibility checks**
- Playwright E2E tests automatically run axe-core scans
- Violations are reported in `swarm-dashboard/e2e/axe-violations.json`
- CI will create triage issues labeled `accessibility` and `triage` for violations
- See `.github/triage/AXE_TRIAGE.md` for triage procedures
- Add accessibility checks to PR checklists

## CI/CD Workflows

The repository uses GitHub Actions for CI:
- **ci-swarm.yml**: Main CI for swarm-dashboard (build, test, lint, Lighthouse)
- **swarm-dashboard-e2e.yml**: Playwright E2E tests with accessibility checks
- **swarm-dashboard-axe-triage.yml**: Accessibility violation triage automation
- **swarm-media-integration.yml**: Rust crate testing and integration
- **alembic-roundtrip.yml**: Database migration validation (label-gated with `run-alembic-roundtrip`)

## Project Structure

```
atlas-sphere/
├── .github/
│   ├── workflows/          # GitHub Actions CI/CD workflows
│   ├── triage/             # Triage documentation (AXE_TRIAGE.md, etc.)
│   ├── CONTRIBUTING.md     # Contribution guidelines
│   └── PULL_REQUEST_TEMPLATE.md
├── swarm-dashboard/        # React/TypeScript frontend application
│   ├── src/                # Source code
│   ├── e2e/                # Playwright E2E tests
│   ├── tests/              # Unit tests
│   ├── package.json
│   └── tsconfig.json
├── crates/
│   └── swarm-media/        # Rust backend service
│       ├── src/
│       └── Cargo.toml
├── alembic/                # Database migrations
│   ├── versions/           # Migration files
│   └── env.py
├── scripts/
│   └── validate_alembic.py # Alembic validation script
└── bin/
    └── act                 # Local GitHub Actions runner
```

## Special Considerations

### Alembic Migrations
- All migration files must include proper upgrade/downgrade guards
- Use `validate_alembic.py` to check for common issues
- Label PRs with `run-alembic-roundtrip` to trigger roundtrip testing
- Migrations must be reversible (downgrade should work)

### Testing Strategy
- Unit tests are required for new components and functions
- E2E tests should cover critical user paths
- Accessibility tests run automatically on all PRs
- Coverage reports are uploaded as CI artifacts

### PR Checklist
When creating PRs, ensure:
- [ ] Type-checking passes (`npm run tsc`)
- [ ] Unit tests pass with adequate coverage
- [ ] E2E tests pass
- [ ] Axe accessibility checks pass (no new violations)
- [ ] Alembic migrations validated (if applicable)
- [ ] Code follows repository conventions

## Common Tasks

### Adding a New React Component
1. Create component in `swarm-dashboard/src/components/ComponentName.tsx`
2. Use TypeScript with strict typing
3. Add unit test in `swarm-dashboard/tests/ComponentName.spec.js`
4. Ensure accessibility compliance (ARIA labels, semantic HTML)
5. Run `npm run tsc` and `npm test` before committing

### Adding a New Rust Module
1. Create module in `crates/swarm-media/src/module_name.rs`
2. Export in `lib.rs` or appropriate parent module
3. Add unit tests in the same file or `tests/` directory
4. Run `cargo test` and `cargo clippy`
5. Ensure proper error handling with `thiserror` or `anyhow`

### Updating Database Schema
1. Create migration: `alembic revision -m "description"`
2. Implement upgrade and downgrade functions
3. Run `python scripts/validate_alembic.py`
4. Test locally: `alembic upgrade head && alembic downgrade base`
5. Add `run-alembic-roundtrip` label to PR for CI validation

## Resources

- [CONTRIBUTING.md](.github/CONTRIBUTING.md) - Contribution guidelines
- [AXE_TRIAGE.md](.github/triage/AXE_TRIAGE.md) - Accessibility triage process
- [Dashboard MVP](swarm-dashboard/DASHBOARD_MVP.md) - Dashboard feature specification
- [Alembic README](alembic/README.md) - Migration documentation

## Security & Best Practices

- Never commit secrets or credentials
- Use environment variables for configuration
- Validate all user inputs
- Follow OWASP security guidelines for web applications
- Keep dependencies up to date
- Use `npm audit` and `cargo audit` regularly
