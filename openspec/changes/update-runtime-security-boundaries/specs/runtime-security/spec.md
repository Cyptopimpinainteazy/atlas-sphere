## MODIFIED Requirements

### Requirement: Privileged Runtime Operations Are Not Public
The runtime SHALL restrict privileged operations (including emergency controls and admin-only operations) to an explicitly authorized origin (e.g., a collective threshold), and MUST NOT allow arbitrary signed accounts to invoke emergency-only functions.

#### Scenario: Emergency actions require collective authorization
- **WHEN** an arbitrary signed account attempts to invoke an emergency-only governance action
- **THEN** the call MUST be rejected

#### Scenario: Emergency actions succeed via authorized collective origin
- **WHEN** the authorized collective threshold origin invokes an emergency-only governance action
- **THEN** the call MUST succeed

### Requirement: Consensus-Critical VM Adapter Behavior Is Deterministic
For any runtime path that can affect canonical on-chain state based on VM receipts/state changes, the runtime SHALL ensure deterministic adapter behavior across native (`std`) and WASM (`no_std`) execution.

#### Scenario: Native and WASM execution yield equivalent state transitions
- **WHEN** the same block is executed via native runtime code and via WASM runtime code
- **THEN** the resulting state transitions MUST be equivalent

#### Scenario: Real adapters are feature-gated for non-production use
- **WHEN** real VM adapters are not available/deterministic for WASM execution
- **THEN** native execution MUST default to mock adapters unless an explicit non-production feature flag is enabled
