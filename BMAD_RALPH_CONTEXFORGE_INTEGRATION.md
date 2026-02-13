# BMAD + Ralph + Context Forge Integration

## Vision

Unified autonomous development system combining:
- **BMAD (Build More, Architect Dreams)**: Structured methodology & planning
- **Ralph**: Autonomous task execution via GitHub Copilot
- **Context Forge**: Documentation scaffolding, validation, Claude hooks

## Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                    FULL AUTONOMOUS LOOP                         │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│   ┌──────────┐    ┌──────────┐    ┌──────────────────────┐  │
│   │   BMAD   │───▶│  Ralph   │───▶│   Context Forge      │  │
│   │ Planning │    │ Execute  │    │ Validation & Docs    │  │
│   └──────────┘    └──────────┘    └──────────────────────┘  │
│        │               │                    │                 │
│        │               │                    │                 │
│        ▼               ▼                    ▼                 │
│   ┌─────────┐    ┌─────────┐         ┌──────────┐          │
│   │ Epics  │    │ Tasks   │         │ CLAUDE.md│          │
│   │ Stories │    │ PRD.md  │         │ Hooks    │          │
│   │ Sprint  │    │ progress│         │ Validate │          │
│   └─────────┘    └─────────┘         └──────────┘          │
│                                                                 │
│   ┌─────────────────────────────────────────────────────────┐  │
│   │            ESCALATION LOOP                             │  │
│   │  If Ralph stuck → /bmad-help → BMAD workflow         │  │
│   │  If validation fails → Context Forge fixes            │  │
│   └─────────────────────────────────────────────────────────┘  │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

## Integration Flow

### Phase 1: BMAD Planning (Completed)
1. Product Brief → PRD → UX → Architecture → Epics → Stories
2. Sprint Planning creates `sprint-status.yaml`
3. Stories written to `_bmad-output/implementation-artifacts/`

### Phase 2: Ralph Execution with BMAD Integration
1. Ralph reads from BMAD story files
2. Converts to task format
3. Executes via GitHub Copilot
4. If stuck → calls `/bmad-bmm-sprint-status` or `/bmad-help`

### Phase 3: Context Forge Validation
1. Pre-submit hooks run validation
2. Security scanning (npm audit, etc.)
3. Test execution
4. Quality gates

## Ralph-BMAD Integration Commands

### New Commands for Ralph
```
/bmad-status           # Check current sprint status
/bmad-next-story       # Get next story to implement
/bmad-help             # Get BMAD guidance when stuck
/bmad-validate         # Run BMAD validation checks
```

### Ralph PRD Format (BMAD Compatible)
```markdown
# Atlas Sphere - Sprint 1

## Epic 1: Multi-Chain Wallet Foundation

### Story 1.1: Wallet Core
- [ ] Implement BIP-39 mnemonic generation
- [ ] Implement wallet import
- [ ] Add multi-chain address derivation

### Story 1.2: Multi-Chain Display
- [ ] Create unified balance display
- [ ] Add network switching UI
- [ ] Implement token list view
```

## Context Forge Integration

### Generated Files
```
.claude/
├── commands/
│   ├── bmad-status.md      # Sprint status command
│   ├── bmad-next.md        # Next story command  
│   └── bmad-help.md        # BMAD help command
├── hooks/
│   ├── PreCompact.py       # Preserve BMAD context
│   ├── PreSubmit.py        # Run validation
│   └── bmad-progress.py   # Track BMAD progress
└── settings.yaml           # BMAD configuration
```

### Validation Pipeline
```yaml
# .context-forge/validation.yaml
validation:
  - name: bmad-structure
    command: check-bmad-files
    critical: true
    
  - name: tests
    command: npm test
    critical: true
    
  - name: security  
    command: npm audit
    critical: false
    
  - name: typescript
    command: tsc --noEmit
    critical: true
```

## BMAD Workflow Escalation

### When Ralph Gets Stuck

1. **Detection**: Ralph detects iteration limit or repeated failures
2. **Escalation**: Ralph calls `/bmad-help`
3. **BMAD Analysis**: BMAD workflow analyzes the issue
4. **Guidance**: BMAD provides specific fix instructions
5. **Retry**: Ralph continues with new guidance

### BMAD Help Response Format
```markdown
# BMAD Assistance

## Issue Detected
Ralph is stuck on [story/feature]

## Analysis
[Root cause analysis from BMAD]

## Recommended Actions
1. [Specific fix step 1]
2. [Specific fix step 2]

## Related Stories
- See Story X.Y for similar implementation
```

## Full Implementation Checklist

### Step 1: BMAD Setup (DONE ✓)
- [x] Install BMAD V6
- [x] Create Product Brief
- [x] Create PRD
- [x] Create Architecture
- [x] Create Epics & Stories
- [x] Sprint Planning

### Step 2: Ralph Integration (IN PROGRESS)
- [x] Ralph installed
- [ ] Configure Ralph to read BMAD stories
- [ ] Add BMAD commands to Ralph
- [ ] Create escalation workflow

### Step 3: Context Forge Integration
- [ ] Run context-forge init
- [ ] Generate CLAUDE.md
- [ ] Add validation hooks
- [ ] Configure security scanning

### Step 4: Full Loop Testing
- [ ] Run Ralph on Story 1.2
- [ ] Verify BMAD escalation works
- [ ] Verify Context Forge validation
- [ ] End-to-end test

## Usage

### Start Full Autonomous Development
```bash
# 1. Check BMAD status
/bmad-sprint-status

# 2. Start Ralph with BMAD stories
ralph start --source _bmad-output/implementation-artifacts/

# 3. Ralph will:
#    - Read BMAD stories
#    - Execute via Copilot
#    - Run Context Forge validation
#    - Escalate to BMAD if stuck
```

### Manual Intervention
```bash
# Get BMAD guidance
/bmad-help

# Check sprint status  
/bmad-sprint-status

# Run validation
context-forge validate
```

## Files Created

| File | Purpose |
|------|---------|
| `_bmad-output/planning-artifacts/` | BMAD planning documents |
| `_bmad-output/implementation-artifacts/` | Stories & sprint status |
| `.claude/` | Claude Code hooks & commands |
| `CLAUDE.md` | Main context file |

## Next Steps

1. **Configure Ralph** to read from `_bmad-output/implementation-artifacts/`
2. **Add BMAD commands** to Claude/Ralph
3. **Run Context Forge** to generate hooks
4. **Test full loop** with Story 1.2

---

*Integration v1.0 - February 2026*
