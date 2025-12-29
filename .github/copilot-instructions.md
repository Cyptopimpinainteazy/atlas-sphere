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
