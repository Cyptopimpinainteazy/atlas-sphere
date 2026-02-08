## ADDED Requirements

### Requirement: Off-Chain Jury System
The system SHALL provide an Off-Chain Jury capability to vet "major" tasks and proposals before execution. The jury SHALL be composed of a randomized set of agents with configurable proportions from on-chain and off-chain pools.

#### Scenario: Major task requires jury approval
- **WHEN** a task is marked as `task-type: law` or otherwise classified as MAJOR
- **THEN** the task SHALL be enqueued for Jury review and not executed until majority Yes vote

#### Scenario: Jury rotation
- **WHEN** a jury session completes
- **THEN** rotated on-chain agents SHALL be returned to on-chain duty after audit and optional retraining

### Requirement: Anonymous Binary Voting
Jury members MUST only cast a binary vote (Yes/No). Votes SHALL be anonymous until aggregation and SHALL be auditable via cryptographic proofs.

#### Scenario: Commit-reveal
- **WHEN** the session starts
- **THEN** members SHALL submit vote commitments
- **WHEN** reveal phase completes
- **THEN** the system SHALL reveal and aggregate votes and publish the result

### Requirement: Encrypted Audit Logging
All jury actions (votes, comments, deltas) SHALL be stored encrypted off-chain and an immutable hash anchor SHALL be written on-chain.

#### Scenario: Audit retrieval
- **WHEN** an auditor requests the session logs with appropriate clearance
- **THEN** the system SHALL provide encrypted logs and proof of on-chain anchor for verification

### Requirement: Task Execution Rules
- Minor tasks SHALL be executed when Core agents approve
- Major tasks SHALL execute only when Jury majority votes Yes

#### Scenario: Execution flow
- **WHEN** task is approved (core or jury) and passes checks
- **THEN** the task SHALL be scheduled for execution and the outcome logged per audit rules

### Requirement: Scrap Yard and Slashing
Agents found misaligned SHALL be retired, studied, and relevant data used to train models. Misalignment evidence SHALL be stored with on-chain anchors.

#### Scenario: Agent retires to scrap yard
- **WHEN** an agent is flagged as misaligned by majority or audit
- **THEN** the system SHALL retire the agent and persist evidence per the audit spec
