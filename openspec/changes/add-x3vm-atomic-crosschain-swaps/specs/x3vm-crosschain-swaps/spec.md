## ADDED Requirements

### Requirement: Direction-Agnostic Atomic Swap Support
The system SHALL support atomic cross-chain swaps where each swap leg MAY be any supported chain domain: `ATLAS (X3VM)`, `EVM`, `SVM`, or `BTC`.

#### Scenario: Any direction is expressible
- **WHEN** a user creates a swap intent for `BTC → ATLAS`
- **THEN** the swap intent model supports BTC escrow funding and an Atlas escrow hold/release
- **AND** the same model supports `ATLAS → BTC` by swapping leg roles

### Requirement: Unified Swap Intent Model
The system SHALL define a `SwapIntent` that includes:
- `swapId` (uuid)
- `legA` and `legB` (each contains `chain`, `asset`, `amount`, `recipient`)
- `secretHash` (sha256 hex)
- `timelocks` (object with `t_fund`, `t_claim`, `t_refund` per leg)
- `policy` (object including `slowFirst = true|false`, and per-chain finality thresholds)

#### Scenario: Intent is compatible with existing coordinator messages
- **WHEN** a `SwapIntent` is created
- **THEN** the coordinator can emit `SwapIntentCreated` as defined in `cross-chain-settlement`
- **AND** any new fields are optional and do not break existing JSON decoders

### Requirement: Secret and Preimage Handling
The system SHALL use a single `secretHash` for both escrow legs, and SHALL guarantee that revealing the preimage on one chain is sufficient to claim the other leg.

#### Scenario: Claim on one chain enables claim on the other
- **GIVEN** two escrows are funded with the same `secretHash`
- **WHEN** a claim transaction is observed on the first chain
- **THEN** the system extracts the preimage and uses it to claim the other escrow

### Requirement: Atlas Escrow Hold/Release/Refund Primitive
The system SHALL provide an Atlas-native escrow primitive that supports:
- `HOLD`: lock an internal Atlas balance/asset for a `swapId`
- `RELEASE(preimage)`: release the held funds to the swap recipient if `sha256(preimage) == secretHash`
- `REFUND`: unlock held funds back to the original owner after timelock expiry

#### Scenario: ATLAS → BTC funding does not leak value
- **WHEN** an `ATLAS → BTC` swap is initiated
- **THEN** Atlas funds are placed in `HOLD` (not transferred to the counterparty)
- **AND** funds only move to the counterparty on `RELEASE(preimage)`

#### Scenario: ATLAS hold refunds after timeout
- **GIVEN** an Atlas hold exists for a `swapId`
- **WHEN** the external leg is not funded or claimed before timelock expiry
- **THEN** the holder can execute `REFUND` and recover funds

### Requirement: EVM HTLC Escrow Contract Support
For EVM chains, the system SHALL use an HTLC escrow contract that supports:
- Funding by depositing native/token assets bound to `secretHash` and `timelock`
- Claiming by presenting the preimage
- Refunding after timeout
- Emitting events for funded/claimed/refunded states

#### Scenario: EVM ↔ ATLAS swap completes
- **GIVEN** an `EVM → ATLAS` swap intent
- **WHEN** the EVM escrow is funded and reaches configured finality
- **AND** the Atlas hold is created
- **AND** one side claims revealing the preimage
- **THEN** the counterparty can claim the other leg using the same preimage

### Requirement: SVM (Solana) HTLC-Style Escrow Support
For SVM chains, the system SHALL use an escrow program/account model that supports hashlock + timelock semantics equivalent to EVM HTLC.

#### Scenario: SVM ↔ BTC swap completes
- **GIVEN** an `SVM → BTC` swap intent
- **WHEN** both escrows are funded and finality thresholds are reached
- **AND** a claim reveals the preimage
- **THEN** the other escrow can be claimed with the same preimage

### Requirement: BTC Script HTLC Support
For BTC, the system SHALL support script-based HTLC outputs such that:
- A valid claim spend reveals the preimage
- A valid refund spend is possible after the refund timelock

#### Scenario: BTC refund path is unilateral
- **GIVEN** a BTC escrow output is funded
- **WHEN** the counterparty does not claim before the claim window expires
- **THEN** the funder can unilaterally refund after the timelock

### Requirement: Finality and Reorg Gating
The system SHALL not advance the swap lifecycle from “funded” to “next step” until the previous chain leg meets configured finality/confirmation thresholds, and SHALL support reorg detection that can move a swap back to a prior state.

#### Scenario: Reorg invalidates observed funding
- **GIVEN** an adapter reports a funding tx as confirmed
- **WHEN** a reorg removes that tx from the canonical chain
- **THEN** the coordinator reverts the swap state to the pre-funded state
- **AND** it MUST NOT proceed to the next funding/claim step

### Requirement: Slow-First Funding Policy
The system SHALL fund the slower-finality leg first by default and SHALL validate that timelocks guarantee refunds remain possible even if the fast leg is claimed near its deadline.

#### Scenario: BTC is slow, EVM is fast
- **GIVEN** a BTC ↔ EVM swap configuration
- **WHEN** a swap is created with default policy
- **THEN** the BTC escrow is funded before the EVM escrow
- **AND** the BTC refund timelock exceeds the EVM claim timelock by the configured safety margin

### Requirement: X3VM Orchestration Compatibility
The system SHALL allow X3VM programs to author swap intents and place Atlas holds inside an atomic window, while deferring final settlement (release) until external settlement proof or preimage is available.

#### Scenario: X3VM program triggers an ATLAS ↔ EVM swap
- **WHEN** an X3VM program opens an atomic window and requests a cross-chain swap
- **THEN** the program can place an Atlas hold and emit a swap intent deterministically
- **AND** the release step occurs only when the preimage is provided or verified
