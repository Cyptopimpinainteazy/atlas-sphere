# Delta Specifications for Testnet Readiness Capability

## ADDED Requirements

### Requirement: Runtime Build Reproducibility
The system MUST support reproducible release builds that produce a runtime WASM artifact for the pinned Substrate dependency set.

#### Scenario: Release build produces runtime WASM
- **WHEN** the project is built with `cargo build --release`
- **THEN** the build MUST succeed without requiring bypass flags (e.g. skipping WASM build)

#### Scenario: WASM toolchain prerequisites are defined
- **GIVEN** a fresh build environment
- **WHEN** a developer follows documented prerequisites
- **THEN** the runtime WASM build prerequisites MUST include `wasm32-unknown-unknown` target and required components

### Requirement: WebSocket Availability for Tooling
The node MUST expose a WebSocket JSON-RPC endpoint suitable for Polkadot.js and `subxt` workflows.

#### Scenario: WebSocket endpoint accepts subscriptions
- **WHEN** a client connects over WebSocket
- **THEN** subscription methods MUST function for new heads and finalized heads

#### Scenario: WebSocket endpoint supports signed extrinsic submission
- **WHEN** a client submits a signed extrinsic using standard tooling expectations
- **THEN** the node MUST accept and process the submission over WebSocket

### Requirement: Standard Substrate RPC Compatibility (Minimum)
The node MUST expose a minimum set of standard Substrate JSON-RPC methods required by ecosystem tooling.

#### Scenario: Client can discover chain and metadata
- **WHEN** a client initializes via JSON-RPC
- **THEN** the node MUST provide chain identity and runtime metadata needed to construct calls

#### Scenario: Client can query blocks and state
- **WHEN** a client queries recent blocks and state
- **THEN** the node MUST return consistent data for best and finalized chains

### Requirement: Custom Atlas RPC Stability
The node MUST continue to expose the current Atlas custom RPC methods for runtime APIs.

#### Scenario: Atlas Kernel RPC remains available
- **WHEN** a client calls `atlasKernel_getAuthorizedAccounts`
- **THEN** the node MUST return a valid response

#### Scenario: Atomic Trade / Evolution / X3 RPC remain available
- **WHEN** a client calls `atomicTrade_*`, `evolutionCore_*`, or `x3Verifier_*`
- **THEN** the node MUST return valid responses or well-formed errors

### Requirement: Public RPC Hardening Profiles
The deployment system MUST provide safe-by-default configuration profiles for public and ops RPC exposure.

#### Scenario: Public RPC uses safe method exposure
- **GIVEN** the public RPC profile
- **WHEN** the node is started for internet exposure
- **THEN** unsafe authoring/admin methods MUST NOT be exposed

#### Scenario: Ops RPC is restricted
- **GIVEN** the ops RPC profile
- **WHEN** the node is started
- **THEN** ops-only methods MUST be restricted to trusted access paths

### Requirement: Health and Monitoring Signals
The node MUST provide health endpoints and metrics suitable for automated monitoring.

#### Scenario: Health endpoint reflects real peer and sync status
- **WHEN** `system_health` is queried
- **THEN** the response MUST reflect actual peer count and whether the node is syncing

#### Scenario: Metrics endpoint is available
- **WHEN** Prometheus metrics are scraped
- **THEN** the node MUST expose scrapeable metrics for basic node health
