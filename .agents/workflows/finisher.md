---
description: "YOLO FINISHER v5.0 — Full Nuclear Finalization Workflow. Run agents in sequence until repo scores 100/100."
---

# ☢️ YOLO FINISHER v5.0 — EXECUTION WORKFLOW

## Overview

This workflow runs the nuclear finisher agent stack against the repository.
Agents run in sequence. Loop until COMPLETION_SCORE == 100.

## Prerequisites

- All agent prompts are in `.github/prompts/finisher-*.prompt.md`
- The finisher daemon is in `scripts/finisher_daemon.py`
- CI chaos tests are wired in `.github/workflows/finisher-chaos-ci.yml`

## Execution Order

Run agents in this exact sequence:

### Phase 0 — Mapping
// turbo
1. Run **CARTOGRAPHER** (`finisher-cartographer.prompt.md`)
   - Build execution graph, data lifecycle, trust boundary maps
   - Output: `SYSTEM_MAP.md`

### Phase 1 — Archaeology
// turbo
2. Run **ARCHAEOLOGIST** (`finisher-archaeologist.prompt.md`)
   - Find dead flags, legacy rot, half-migrated systems
   - Output: findings list with classifications

### Phase 2 — Breaking
// turbo
3. Run **BREAKER** (`finisher-breaker.prompt.md`)
   - Force failure paths, simulate outages, prove system lies
   - Output: breakpoint list with file+line references

### Phase 3 — Security
// turbo
4. Run **AUDITOR** (`finisher-auditor.prompt.md`)
   - Full security audit + smart contract deep audit
   - FIX every vulnerability (not just report)

### Phase 4 — Intent Recovery
// turbo
5. Run **INTENT ANALYST** (`finisher-intent-analyst.prompt.md`)
   - Classify all unused code as A/B/C
   - Hand off A-class components to Integrator

### Phase 5 — Symmetry
// turbo
6. Run **SYMMETRY ENFORCER** (integrated into Integrator prompt)
   - Detect architectural one-sidedness
   - Implement missing counterparts

### Phase 6 — Integration
// turbo
7. Run **INTEGRATOR** (`finisher-integrator.prompt.md`)
   - Wire all A-class components
   - Eliminate phantom wiring
   - Enforce single source of truth

### Phase 7 — Reality Diff
// turbo
8. Run **VERIFIER** (`finisher-verifier.prompt.md`)
   - Compare docs vs actual execution
   - Prove system does what it claims
   - Config effectiveness checks

### Phase 8 — Fixing
// turbo
9. Run **FIXER** (`finisher-fixer.prompt.md`)
   - Fix all errors from Breaker + Auditor
   - Harden logic, add guards, implement recovery

### Phase 9 — Economics
// turbo
10. Run **ECONOMIST** (`finisher-economist.prompt.md`)
    - If money/value exists: loss modeling, circuit breakers
    - Add capital exposure limits

### Phase 10 — Chaos
// turbo
11. Run **CHAOS ENGINE** (`finisher-chaos-engine.prompt.md`)
    - Fuzz inputs, randomize timing, inject failures
    - Verify invariants hold under chaos

### Phase 11 — Scoring
// turbo
12. Run **COMPLETION JUDGE** (`finisher-completion-judge.prompt.md`)
    - Score all categories
    - If score < 100 → **LOOP BACK TO PHASE 2**
    - Generate `SCORE_REPORT.json` and `FINAL_REPORT.md`

## Loop Rule

```
LOOP UNTIL COMPLETION_SCORE == 100:
  CARTOGRAPHER → ARCHAEOLOGIST → BREAKER → AUDITOR →
  INTENT ANALYST → INTEGRATOR → VERIFIER → FIXER →
  ECONOMIST → CHAOS ENGINE → COMPLETION JUDGE
```

No human approval. No "looks good to me". Only math and execution.

## Final Report Requirements

`FINAL_REPORT.md` MUST include:
1. System execution map
2. Data lifecycle map
3. Security threat model
4. Failure mode analysis
5. Recovery behavior
6. Setup from empty machine
7. Verified workflows
8. What was removed and why
9. Architecture symmetry table
10. Expected vs actual execution diff
11. Config effectiveness matrix
12. Intent recovery decisions
13. Completion score breakdown
14. All enforced invariants
15. Chaos scenarios survived
16. Auto-heal actions taken
17. Zero remaining assumptions
