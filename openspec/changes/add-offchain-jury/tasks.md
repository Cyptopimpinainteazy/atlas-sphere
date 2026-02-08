## 1. Proposal & Specs
- [ ] 1.1 Finalize `proposal.md` and `design.md`
- [ ] 1.2 Add spec delta under `specs/orchestra-governance/spec.md` (ADDED requirements + scenarios)
- [ ] 1.3 Run `openspec validate add-offchain-jury --strict`

## 2. Implementation
- [ ] 2.1 Create `swarm/jury/` module skeleton (lifecycle, voting, rotation)
- [ ] 2.2 Add API endpoints in `swarm/api_server.py` for jury operations
- [ ] 2.3 Implement secure logging mechanism (encrypted logs + on-chain hash anchors)
- [ ] 2.4 Add unit & integration tests (voting, anonymity, snapshot flow)
- [ ] 2.5 Add docs and examples (.md task specs + usage)

## 3. Infra & Deploy
- [ ] 3.1 Add systemd/docker configs / compose with GPU access
- [ ] 3.2 CI tests for `openspec validate` and unit tests

## 4. Post-Deployment
- [ ] 4.1 Run a small pilot session (staging)
- [ ] 4.2 Iterate on design based on audits & telemetry
- [ ] 4.3 Archive change when stable
