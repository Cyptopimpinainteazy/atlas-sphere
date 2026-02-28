# ☢️ YOLO FINISHER v5.0 — NUCLEAR FINALIZATION WORKFLOW

## Purpose
Full nuclear finalization loop. Zero TODOs, zero stubs, zero lies.
Run agents in sequence. Loop until 100/100 completion score.

## Agent Execution Order

1. **CARTOGRAPHER** 🗺️ — Map execution, data, trust boundaries
2. **ARCHAEOLOGIST** 🦴 — Find dead flags, legacy rot
3. **BREAKER** 💣 — Force failure paths, prove system lies
4. **AUDITOR** 🕵️ — Full security audit + smart contract audit
5. **INTENT ANALYST** 🧠 — Classify unused code (A/B/C)
6. **INTEGRATOR** 🔩 — Wire everything, enforce symmetry
7. **VERIFIER** ✅ — Expected-vs-actual execution diff
8. **FIXER** 🛠️ — Fix all errors, harden everything
9. **ECONOMIST** 💸 — Loss modeling, circuit breakers
10. **CHAOS ENGINE** 🌪️ — Fuzz, chaos inject, verify invariants
11. **COMPLETION JUDGE** ⚖️ — Score. If < 100 → loop again.

## Global Rules

- FAIL IF UNCERTAIN: choose safest interpretation, implement, document
- INTENT RECOVERY: unused code is A (intended) by default, not deleted
- SYMMETRY: every architectural element needs its counterpart
- CONFIG LAW: every flag must alter behavior
- COLD START: must work on fresh machine
- NO: TODOs, stubs, placeholders, dead code, undocumented assumptions

## Hard Gates (ALL must pass)

- Zero TODOs
- Zero unused files
- Zero unreachable code
- Zero known vulnerabilities
- Zero undocumented behavior
- Zero failing chaos tests

## Completion

Loop until all gates pass. Generate FINAL_REPORT.md and SCORE_REPORT.json.
