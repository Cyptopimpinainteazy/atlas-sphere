## Context
Atlas Sphere uses OpenSpec for spec-driven development and GitHub Copilot instructions under `.github/`. The repo also contains a root `.claude/settings.local.json` but no standardized PRP command set or PRP directory at the repo root.

We want a repo-local, assistant-friendly resource bundle that makes PRP creation/execution reproducible and consistent.

## Goals
- Provide a standardized PRP workflow usable from Claude Code (slash commands + templates).
- Keep the change additive and non-invasive: no runtime behavior changes.
- Avoid collisions with existing assistant config (OpenSpec, Copilot instructions, existing `.claude` settings).
- Enable validation loops that match Atlas Sphere conventions (Rust fmt/clippy/tests, etc.).

## Non-Goals
- No changes to runtime/node/pallet behavior.
- No requirement to introduce new SaaS dependencies.
- No enforcement of a single assistant; Copilot and others should remain supported.

## Decisions
### Decision: Vendor resources into the repo
We will vendor the PRP resources into this repository (rather than requiring separate cloning) to maximize discoverability and reduce setup friction.

### Decision: Preserve and extend `.claude/`
- Keep existing `.claude/settings.local.json`.
- Add `.claude/commands/` and place new commands there.
- If command names collide, prefer a namespacing convention (e.g., `prp-*.md`) and keep existing commands unchanged.

### Decision: Place PRP assets under `PRPs/`
Use a top-level `PRPs/` directory consistent with common PRP kits:
- `PRPs/templates/`
- `PRPs/scripts/`
- `PRPs/ai_docs/` (optional but recommended)

## Risks / Trade-offs
- Command collisions across assistants: mitigated via additive placement and naming.
- Stale vendored content over time: mitigated via a documented “update procedure” (manual sync).

## Migration / Rollback
- Migration: create new directories and docs; no data migration.
- Rollback: remove `PRPs/` and `.claude/commands/` additions.

## Open Questions
- Should we support only Claude Code or also ship generalized commands for other assistants?
- Should the PRP runner be included (Python/uv) or remain “Claude command only”?
- Should we place the PRP bundle at repo root or under `docs/ai/` to avoid clutter?
