# Consensus Invariants (X3)

## Safety
- [ ] Determinism: identical inputs → identical state root
- [ ] Validity: invalid tx/block never accepted
- [ ] No unintended mint/burn

## Liveness
- [ ] Valid tx eventually eligible for inclusion
- [ ] No deadlocks in proposer/validator flow

## Economic
- [ ] Fee accounting correct
- [ ] Gas metering correct
