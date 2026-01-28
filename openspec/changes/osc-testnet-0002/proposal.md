# Change: Testnet Readiness Hardening (Runtime, RPC, and Ops Gates)

## Why

Atlas Sphere has a functioning testnet, but “testnet-ready” needs to mean more than “node starts”. We need a crisp, testable definition of readiness that covers runtime build reproducibility, RPC/WS developer ergonomics, public RPC hardening, and operational health signals.

This change focuses on the remaining engineering gaps that block reliable testnet usage by wallets, indexers, explorers, and automation.

## What Changes

- Define a dedicated **testnet-readiness** capability with concrete acceptance scenarios.
- Standardize a minimal, well-defined RPC surface required by:
  - explorer/wallet tooling (Polkadot.js / `subxt`)
  - ops health checks and runbooks
  - current Atlas custom RPC methods
- Require WebSocket availability for subscription-based workflows.
- Require public RPC deployment profiles to be safe-by-default and observable.
- Require reproducible runtime WASM builds without relying on ad-hoc environment bypasses.

## Impact

- Affected specs:
  - `testnet-readiness` (new capability)
  - References: complements existing change `osc-testnet-0001` (deployment checklist)
- Affected code/artifacts (expected):
  - Node RPC wiring (`node/src/rpc.rs` and related service wiring)
  - Deployment scripts and env profiles (`deployment/public-rpc/*`)
  - Build tooling / docs for WASM builds (`runtime/`, CI scripts)
- Operational impact:
  - RPC nodes and load balancer configuration
  - Health checks, monitoring dashboards, and alerting thresholds
