## ADDED Requirements

### Requirement: Atomic Cross-VM Commit Protocol
The system SHALL enable X3 programs to open an atomic window and coordinate calls into foreign adapters (EVM, SVM, MoveVM, ZK) such that either every adapter effect commits or the entire window rolls back deterministically with bonded rollback proofs.

#### Scenario: Coordinated multi-VM trade commits
- **WHEN** an X3 program opens an atomic window, issues adapter calls to EVM, SVM, and MoveVM, and includes signed rollback proofs for each adapter
- **THEN** the runtime records a global commit timestamp, waits for success proofs from every adapter, and only commits the atomic window once all proofs arrive; if any adapter reports failure or proofs mismatch, the stored rollback proofs revert the bundle before finalizing the block

### Requirement: Deterministic Window Ordering
The runtime SHALL serialize atomic windows with global ordering metadata so that committed windows can be replayed deterministically on any validator while respecting cross-VM timeouts.

#### Scenario: Deterministic replay of windows
- **WHEN** validators receive a block containing multiple atomic windows from different X3 programs
- **THEN** they apply windows in the recorded global ordering and validate that each adapter confirmation arrives before its timeout, ensuring the deterministic replay yields the same ledger state on every node

### Requirement: Cross-VM Hostcall Guarantees
The system SHALL expose a hostcall ABI for X3 programs to request proof-of-intent and rollback bundles from foreign adapters, and SHALL enforce gas limits plus checksum verification before accepting adapter responses.

#### Scenario: Hostcall proof validation
- **WHEN** an X3 hostcall requests a proof-of-intent from the SVM adapter and returns with a checksum and gas usage metrics
- **THEN** the host runtime verifies the proof, charges deterministic gas, and rejects the window if the proof fails checksum or exceeds the pre-negotiated gas budget, triggering rollback proofs instead
