# BMAD Help

Get BMAD methodology guidance when Ralph is stuck or needs help.

## Usage

Use this command when:
- Ralph reaches iteration limit
- Ralph gets stuck on a task
- Ralph needs guidance on next steps
- Ralph encounters an error it can't resolve

## What This Command Does

1. Reads current sprint status from `_bmad-output/implementation-artifacts/sprint-status.yaml`
2. Analyzes the current story context
3. Provides specific BMAD workflow guidance
4. Suggests possible solutions or workarounds

## Example Scenarios

### Stuck on Implementation
```
I'm stuck implementing [story]. The code isn't compiling.
→ BMAD will provide: specific fix steps, similar implementations in other stories
```

### Iteration Limit Reached
```
I've reached max iterations on [story].
→ BMAD will provide: guidance on whether to continue, skip, or get human help
```

### Validation Failure
```
Tests are failing and I can't fix them.
→ BMAD will provide: test debugging guidance, known issues
```

## Integration with Ralph

This command is called automatically when:
1. Ralph reaches max iterations
2. Ralph encounters repeated failures
3. Ralph requests human assistance via `/bmad-help`

## BMAD Workflow Reference

- Sprint Planning: `/bmad-bmm-sprint-planning`
- Sprint Status: `/bmad-bmm-sprint-status`
- Create Story: `/bmad-bmm-create-story`
- Dev Story: `/bmad-bmm-dev-story`
- Code Review: `/bmad-bmm-code-review`
- Retrospective: `/bmad-bmm-retrospective`
