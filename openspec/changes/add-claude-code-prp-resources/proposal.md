# Change: Add Claude Code PRP resources

## Why
Atlas Sphere already uses OpenSpec and GitHub Copilot instructions, but it does not currently ship a first-class, repo-local “agentic engineering kit” for Claude Code (and other assistants) that standardizes PRP creation/execution workflows.

Adding a curated PRP resource bundle (commands, templates, runner, and AI docs) reduces iteration churn, improves first-pass quality, and makes development workflows consistent across assistants.

## What Changes
- Add a repo-local PRP resource bundle optimized for Claude Code usage:
  - Claude slash commands under `.claude/commands/`
  - PRP templates and scripts under `PRPs/`
  - Optional `PRPs/ai_docs/` curated references
- Ensure the bundle coexists with OpenSpec and existing assistant instructions:
  - Avoid overwriting existing `.claude` configuration
  - Prefer additive placement and name-spacing where needed
- Document a single “happy path” for:
  - Creating a PRP
  - Executing a PRP
  - Validation loops (format/lint/test) aligned to Atlas Sphere conventions

## Impact
- Affected specs:
  - New capability proposed: `claude-code-prp-resources`
- Affected repo areas (planned):
  - `.claude/` (new commands; preserve existing settings)
  - `PRPs/` (new templates/scripts/docs)
  - `CLAUDE.md` (optional, to describe Claude Code workflow) and/or `docs/` (if preferred)
- Security/ops considerations:
  - Commands MUST avoid embedding secrets; any token-based flows must use environment variables.
  - The resource bundle MUST not change runtime behavior of the chain.
