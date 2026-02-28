# X3 Chain — Codex Agent Rules (Solo Mode)

These rules are mandatory for any automated code modification.
Violation invalidates the change.

---

## 1) Test Integrity

- Never modify tests to “make green” unless explicitly intended.
- If a test fails:
  - Fix production code first.
  - Only change tests if provably wrong and explain why.

Forbidden:
- Weakening assertions
- Removing assertions
- Adding skip/ignore markers
- Updating snapshots to match incorrect output

---

## 2) Consensus / State Transition Safety

Any change affecting block/tx validation, state transition, fork choice, finality,
gas/fees, slashing, VM semantics, or cross-VM atomicity requires:

1) Invariant list (.codex/CONSENSUS_INVARIANTS.md)
2) Property or fuzz plan (.codex/FUZZ_OR_PROPERTY_PLAN.md)
3) Audit pass summary (.codex/X3_AUDIT_PASS.md) based on:
   codex --profile x3-audit

If unsure whether it touches consensus: assume it does.

---

## 3) Determinism

Consensus code must not depend on:
- wall clock time
- unseeded randomness
- unordered map iteration

---

## 4) Cross-VM Atomicity (X3)

Any change affecting EVM↔SVM, BTC atomic, or X3VM requires:
- atomic commit/rollback analysis
- partial failure handling
- replay protection review
