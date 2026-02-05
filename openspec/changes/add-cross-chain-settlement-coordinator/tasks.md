## 1. Spec
- [ ] 1.1 Add `cross-chain-settlement` delta spec with requirements + scenarios
- [ ] 1.2 Validate the change with `openspec validate add-cross-chain-settlement-coordinator --strict`

## 2. Coordinator (post-approval)
- [ ] 2.1 Implement in-memory Settlement Coordinator state machine
- [ ] 2.2 Implement persistence layer (append-only event log; replay -> state)
- [ ] 2.3 Implement timeouts + refund automation hooks

## 3. Adapters (post-approval)
- [ ] 3.1 BTC adapter: deposit watcher + HTLC funding/claim/refund transaction builder
- [ ] 3.2 EVM adapter: escrow contract interface + logs watcher + finality estimator
- [ ] 3.3 Per-chain finality config registry (confirmations, reorg policy)

## 4. UI/API (post-approval)
- [ ] 4.1 WebSocket feed for swap events
- [ ] 4.2 Portfolio view: unified vs per-chain balances with provisional states
- [ ] 4.3 Swap UI: display status timeline + escrow TX hashes + finality/reorg risk

## 5. Observability (post-approval)
- [ ] 5.1 Emit structured audit logs for all swap events
- [ ] 5.2 Alerts for stuck funding, reorg detection, and timeout-based refunds
- [ ] 5.3 Chaos tests: delayed confirmations, reorg simulation, taker disappearance
