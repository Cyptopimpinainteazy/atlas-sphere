## ADDED Requirements

### Requirement: Supported Chain Domains
All settlement messages that include a `chain` discriminator (including `SwapIntentCreated.assetA.chain`, `SwapIntentCreated.assetB.chain`, `EscrowFunded.chain`, `EscrowClaimed.chain`, and `EscrowRefunded.chain`) SHALL support the following values at minimum:
- `BTC`
- `EVM`
- `SVM`
- `ATLAS`

#### Scenario: ATLAS and SVM are first-class in settlement events
- **WHEN** the coordinator emits `SwapIntentCreated` for an `ATLAS ↔ SVM` swap
- **THEN** both legs specify `chain` values using `ATLAS` and `SVM`
- **AND** downstream consumers can route/render per-chain status without special casing

### Requirement: ATLAS Escrow Hold Mapping
The system SHALL model the ATLAS (X3VM) leg as an escrow with equivalent semantics to external HTLC escrows, such that:
- An Atlas `HOLD` is represented as `EscrowFunded` with `chain = "ATLAS"`
- An Atlas `RELEASE(preimage)` is represented as `EscrowClaimed` with `chain = "ATLAS"`
- An Atlas `REFUND` is represented as `EscrowRefunded` with `chain = "ATLAS"`

The system SHALL NOT overload `txHash` to carry non-transaction identifiers for `chain = "ATLAS"`.

#### Scenario: UI shows ATLAS leg like any other escrow
- **GIVEN** an `EVM ↔ ATLAS` swap
- **WHEN** the Atlas hold is created
- **THEN** the coordinator emits `EscrowFunded` with `chain = "ATLAS"`
- **AND** it provides an ATLAS-specific escrow reference as defined by `escrowRefType`

### Requirement: Optional Escrow Reference Type
The system SHALL support optional fields on escrow lifecycle messages (`EscrowFunded`, `EscrowClaimed`, `EscrowRefunded`) to identify the authoritative reference for the escrow action:
- `escrowRefType` (enum: `txHash` | `extrinsicHash` | `eventId`)
- `escrowRef` (string)

If `escrowRefType` is present, `escrowRef` MUST be present.

#### Scenario: ATLAS escrow uses extrinsic hash reference
- **WHEN** the coordinator emits `EscrowFunded` with `chain = "ATLAS"`
- **THEN** it includes `escrowRefType = "extrinsicHash"`
- **AND** `escrowRef` contains the Atlas extrinsic hash

#### Scenario: EVM escrow continues to use txHash
- **WHEN** the coordinator emits `EscrowFunded` with `chain = "EVM"`
- **THEN** it MAY omit `escrowRefType` and use the existing `txHash`
- **OR** it includes `escrowRefType = "txHash"` with `escrowRef` equal to `txHash`

### Requirement: Backward-Compatible Message Extensions
All settlement messages MAY include additional optional fields (for example: `leg = "A"|"B"`, `escrowType`, `domain`, or per-chain risk/finality hints) and MUST remain JSON-decodable by clients that only understand the base schema.

#### Scenario: Older clients ignore new fields
- **WHEN** the coordinator emits a message containing additional optional fields
- **THEN** a client that only decodes the base fields still parses `swapId`, `chain`, and `txHash` successfully
- **AND** the client can safely ignore unknown fields
