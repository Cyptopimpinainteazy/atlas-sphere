## ADDED Requirements

### Requirement: Repo-local PRP resource bundle
The repository MUST include a repo-local PRP resource bundle that provides templates, documentation, and (optionally) runner scripts for creating and executing Product Requirement Prompts (PRPs).

#### Scenario: PRP assets are discoverable
- **WHEN** a developer or AI assistant inspects the repository root
- **THEN** they can find PRP templates and guidance under `PRPs/` without cloning external repositories.

### Requirement: Claude Code command integration
The repository MUST provide Claude Code slash command definitions under `.claude/commands/` that support PRP creation and PRP execution workflows.

#### Scenario: Commands are available without overwriting existing config
- **WHEN** the repo is opened with an existing `.claude/settings.local.json`
- **THEN** the PRP commands can be added without overwriting existing `.claude` settings.

### Requirement: Additive, non-invasive integration
Adding PRP resources MUST be additive and MUST NOT change Atlas Sphere runtime behavior or consensus-critical logic.

#### Scenario: Runtime behavior remains unchanged
- **WHEN** the PRP resources are added
- **THEN** no runtime/node/pallet code paths are modified as a prerequisite for the PRP workflow.

### Requirement: No secrets in repo-local PRP resources
Repo-local PRP resources MUST NOT embed secrets; any required tokens/credentials MUST be supplied via environment variables or local (ignored) configuration files.

#### Scenario: Secret-free resources
- **WHEN** a maintainer reviews the PRP resources
- **THEN** no tokens/credentials are present in the committed files.
