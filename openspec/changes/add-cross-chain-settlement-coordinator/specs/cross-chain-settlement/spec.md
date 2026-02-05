## ADDED Requirements

### Requirement: Core Module Mapping
The system SHALL define explicit modules for cross-chain exchange and settlement, and each module SHALL have a single primary responsibility boundary.

#### Scenario: Operators identify ownership boundaries
- **WHEN** a new chain integration is added
- **THEN** it is implemented as a `ChainAdapter` without modifying the coordinator state machine
- **AND** it is observable via the same event/message schema as existing chains

### Requirement: Atomic Swap Lifecycle State Machine
The system SHALL implement the atomic swap lifecycle using the following states:
- `OPEN`
- `FUNDED_SLOW_CHAIN`
- `FUNDED_FAST_CHAIN`
- `CLAIMED`
- `REFUNDED_FAST_CHAIN`
- `REFUNDED_SLOW_CHAIN`
- `COMPLETED`

The system SHALL fund the slow-finality chain escrow before funding the fast-finality chain escrow by default.

#### Scenario: Happy path swap completes
- **GIVEN** a BTC ↔ EVM swap intent
- **WHEN** the BTC escrow is funded and reaches the configured confirmation threshold
- **AND** the EVM escrow is funded and reaches the configured finality threshold
- **AND** one party claims an escrow revealing the secret
- **THEN** the counterparty MUST be able to claim the other escrow using the revealed secret
- **AND** the swap transitions to `COMPLETED`

#### Scenario: Counterparty disappears after slow chain funding
- **GIVEN** a swap in `FUNDED_SLOW_CHAIN`
- **WHEN** the fast chain escrow is not funded before the configured timeout
- **THEN** the system transitions to `REFUNDED_SLOW_CHAIN`
- **AND** emits an `EscrowRefunded` event with `reason = "timeout"`

### Requirement: JSON-Serializable Settlement Messages
All settlement lifecycle messages SHALL be JSON-serializable and SHALL include a stable `swapId`.

#### Scenario: UI consumes events over WebSocket
- **WHEN** the coordinator emits `SwapIntentCreated`, `EscrowFunded`, `EscrowClaimed`, `EscrowRefunded`, and `SwapCompleted`
- **THEN** a Next.js client MUST be able to decode them without out-of-band schema information

### Requirement: SwapIntentCreated Schema
The system SHALL emit a `SwapIntentCreated` message with the following fields:
- `swapId` (uuid)
- `maker` (address)
- `taker` (address)
- `assetA` (object with `chain`, `amount`)
- `assetB` (object with `chain`, `amount`)
- `secretHash` (sha256 hex)
- `timelocks` (object with `slow`, `fast`)
- `expiry` (ISO8601 timestamp)

#### Scenario: Matching engine creates a swap intent
- **WHEN** an order match results in a cross-chain swap
- **THEN** the system emits `SwapIntentCreated`
- **AND** the `secretHash` is present and immutable for the swap lifecycle

### Requirement: EscrowFunded Schema
The system SHALL emit an `EscrowFunded` message with the following fields:
- `swapId`
- `chain`
- `txHash`
- `blockHeight`
- `confirmations`

#### Scenario: BTC escrow reaches confirmations
- **WHEN** the BTC adapter observes the escrow funding transaction
- **THEN** it emits `EscrowFunded` with confirmations >= configured threshold

### Requirement: EscrowClaimed Schema
The system SHALL emit an `EscrowClaimed` message with the following fields:
- `swapId`
- `chain`
- `txHash`
- `secret` (preimage hex)
- `timestamp` (ISO8601)

#### Scenario: Secret is revealed on chain
- **WHEN** a claim transaction is observed on either chain
- **THEN** `EscrowClaimed.secret` MUST contain the preimage required for the other chain claim

### Requirement: EscrowRefunded Schema
The system SHALL emit an `EscrowRefunded` message with the following fields:
- `swapId`
- `chain`
- `txHash`
- `reason` (enum: `timeout` | `counterparty_missing`)
- `timestamp` (ISO8601)

#### Scenario: Refund is executed after timeout
- **WHEN** the coordinator determines the refund path is required
- **THEN** it triggers the adapter refund and emits `EscrowRefunded`

### Requirement: SwapCompleted Schema
The system SHALL emit a `SwapCompleted` message with the following fields:
- `swapId`
- `status` (string literal: `completed`)
- `finalBalances` (object keyed by participant)
- `timestamp` (ISO8601)

#### Scenario: Completed swap updates balances
- **WHEN** both escrows are resolved successfully
- **THEN** the system emits `SwapCompleted` with final balances for maker and taker

### Requirement: Chain Adapter Interface
Each external chain integration SHALL implement a `ChainAdapter` interface with the following behaviors:
- Watch deposits for a set of addresses
- Estimate finality confidence and reorg risk for a transaction
- Build, verify, claim, refund, and broadcast escrow transactions

#### Scenario: Add a new EVM chain without changing coordinator
- **GIVEN** an EVM network config (RPC, chainId, finality thresholds)
- **WHEN** an adapter implements the interface
- **THEN** the coordinator can settle swaps on that chain without coordinator code changes

### Requirement: BTC UTXO Funding Support
The BTC adapter SHALL implement a UTXO selection method suitable for funding HTLC escrows.

#### Scenario: UTXO selection funds HTLC
- **WHEN** a BTC HTLC escrow is constructed
- **THEN** UTXOs are selected to meet amount + fee requirements

### Requirement: UI Settlement State Presentation
The UI layer SHALL present swap progression as:
`Pending → In-Settlement → On-Chain → Finalized`.

#### Scenario: Advanced view shows finality and escrow hashes
- **WHEN** the UI renders a swap detail view
- **THEN** it shows per-chain escrow transaction hashes and confirmation/finality progress

### Requirement: Observability and Alerting
The system SHALL produce append-only audit logs for all swap lifecycle events and SHALL alert on:
- Missing escrow funding
- Reorg detection
- Timeout-based refunds

#### Scenario: Alert on stuck fast-chain funding
- **GIVEN** a swap in `FUNDED_SLOW_CHAIN`
- **WHEN** no `EscrowFunded` arrives for the fast chain before timeout
- **THEN** an alert is emitted and the refund workflow is initiated

### Requirement: Chaos Testing
The system SHALL support chaos tests that inject:
- Delayed confirmations
- Reorg events
- Counterparty disappearance

#### Scenario: Simulate delayed confirmations
- **WHEN** confirmations are artificially delayed for the slow chain
- **THEN** the coordinator does not proceed to fast-chain funding until thresholds are met
