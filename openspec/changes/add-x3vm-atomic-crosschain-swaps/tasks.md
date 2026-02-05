## 1. Spec & Protocol Definition
- [ ] 1.1 Define the `x3vm-crosschain-swaps` capability requirements and scenarios
- [ ] 1.2 Define a chain capability matrix (BTC, EVM, SVM, Atlas) with finality + timeout defaults
- [ ] 1.3 Define message compatibility rules with `cross-chain-settlement` events (backward compatible extensions only)

## 2. On-Chain (Atlas) Integration Plan
- [ ] 2.1 Specify Atlas escrow HOLD/RELEASE/REFUND primitives (storage, events, access control)
- [ ] 2.2 Specify how X3VM atomic windows create swap intents and place holds
- [ ] 2.3 Specify receipt/attestation verification hooks for trust-minimized vs federated modes

## 3. Off-Chain Coordinator + Adapters Plan
- [ ] 3.1 Specify coordinator state machine mapping to on-chain holds and external HTLC legs
- [ ] 3.2 Specify adapter interfaces for EVM, SVM (Solana), and BTC (fund/claim/refund/watch/finality)
- [ ] 3.3 Specify signer integration boundary (MPC/HSM/threshold) and signing request lifecycle

## 4. Testing & Validation Plan
- [ ] 4.1 Add end-to-end scenario definitions for each direction: Atlas↔BTC, Atlas↔EVM, Atlas↔SVM, BTC↔EVM, BTC↔SVM, EVM↔SVM
- [ ] 4.2 Add reorg/rollback and timeout chaos test scenarios
- [ ] 4.3 Define invariants and property tests (no loss, unilateral refund, secret uniqueness)

## 5. Deliverables
- [ ] 5.1 Produce implementation roadmap milestones (MVP → hardening → trust-minimized)
- [ ] 5.2 Produce ops checklist (monitoring, alerting, key rotation, incident runbooks)
