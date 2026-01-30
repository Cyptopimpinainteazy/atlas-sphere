## 1. Proposal Grounding
- [ ] 1.1 Confirm existing assistant/tooling conventions in this repo (`.claude/`, `.github/*instructions*`, `openspec/*`).
- [ ] 1.2 Confirm desired scope: Claude Code only vs “multi-assistant kit” (Copilot + Claude + others).

## 2. Add PRP Resource Bundle (Repo-Local)
- [ ] 2.1 Decide import strategy: vendor files into repo vs git submodule vs docs-only pointers.
- [ ] 2.2 Add `.claude/commands/` PRP commands (namespaced if collisions exist).
- [ ] 2.3 Add `PRPs/templates/` baseline PRP templates.
- [ ] 2.4 Add `PRPs/scripts/` runner utilities (if adopted) or document intended runner.
- [ ] 2.5 Add/merge `PRPs/ai_docs/` curated reference docs.

## 3. Documentation & Onboarding
- [ ] 3.1 Add a short `PRPs/README.md` (or update existing) describing the repo’s PRP workflow.
- [ ] 3.2 Add/adjust `CLAUDE.md` guidance for Claude Code command usage.
- [ ] 3.3 Ensure guidance aligns with Atlas Sphere conventions in `openspec/project.md`.

## 4. Validation
- [ ] 4.1 Run `openspec validate add-claude-code-prp-resources --strict`.
- [ ] 4.2 Verify no command name collisions with existing `.claude/commands`.
- [ ] 4.3 Ensure no secrets are introduced; env vars only.

## 5. Rollout & Follow-ups
- [ ] 5.1 (Optional) Add a small “example PRP” under `PRPs/` that targets a safe, non-runtime documentation task.
- [ ] 5.2 (Optional) Add CI note for running PRP validations (docs-only).
