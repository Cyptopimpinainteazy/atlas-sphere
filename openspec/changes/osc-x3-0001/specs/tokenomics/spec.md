## ADDED Requirements

### Requirement: Fixed-supply revenue-share token
The system SHALL mint a single, never-reissued token (e.g., 10,000 units) that represents a perpetual claim on a tiny fee share (0.05–0.20% of each transaction fee) so investors own a predictable, scarcity-backed piece of the L1’s throughput.

#### Scenario: Protocol royalty issuance
- **WHEN** transactions execute on the chain
- **THEN** 99.8–99.95% of the fee goes to validators while 0.05–0.20% flows into the Founder Vault contract, which records the source block, fee amount, and timestamp for future distribution or buyback

### Requirement: Transparent vault accounting & distribution
The system SHALL maintain on-chain vault accounting, offer an investor dashboard (real-time revenue, APY projection, transaction volume, distribution history), and allow either pro-rata payouts or automated buyback-and-burn cycles configurable by governance.

#### Scenario: Investor visibility
- **WHEN** an investor opens the dashboard
- **THEN** they see current vault balance, recent allocations, next distribution date, effective APY, and a burn log; governance can switch between direct dividends and buyback/burn to stabilize price

### Requirement: Utility-forward and compliance-safe framing
The system SHALL pair the revenue-share token with non-security utility (discounted fees, governance votes, priority blockspace, early MEV tooling access) and legal framing (protocol royalty, not service promise) while optionally scheduling halving windows or bonded staking to limit sell pressure.

#### Scenario: Utility + compliance
- **WHEN** governance introduces a halving or staking requirement
- **THEN** the policy document explains that halving mimics Bitcoin scarcity, staking locks supply, holders still earn a share of the vault, and the token remains framed as revenue rights, keeping the project on the right side of compliance
