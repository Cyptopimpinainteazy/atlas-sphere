# Atlas Sphere Architecture

## 1. Purpose of this Document

This document is the authoritative reference for the Atlas Sphere Layer-1 blockchain architecture. It is intended for protocol engineers, runtime developers, auditors, and ecosystem partners who need a comprehensive understanding of the system design. Topics covered include:

- Dual virtual machine (VM) execution model
- Atlas Kernel pallet and canonical ledger
- Comit transaction lifecycle and atomic cross-domain execution
- Account, asset, and fee models
- Consensus, networking, and operational considerations

## 2. System Overview

Atlas Sphere is a Substrate-based Layer-1 network that unifies Ethereum Virtual Machine (EVM) and Solana Virtual Machine (SVM) execution under a single state transition function. The runtime exposes a dual-VM experience through the Atlas Kernel pallet, enabling atomic cross-domain composability without wrapped tokens or custodial bridges.

Top-level components:

1. **Node Service** – Networking, RPC surfaces, consensus orchestration.
2. **Runtime** – FRAME-based logic containing native pallets, Atlas Kernel, and consensus hooks.
3. **Atlas Kernel** – Canonical ledger manager, Comit executor, dual-VM coordinator.
4. **EVM & SVM Adapters** – Execution environments wired into the kernel for domain-specific state transitions.
5. **Storage & State** – Off-chain database persistence of runtime state roots and consensus records.

## 3. High-Level Architecture

~~~mermaid
flowchart LR
    subgraph Client Layer
        Wallets
        CLI
        dApps
    end

    subgraph Node Service
        RPC
        Networking
        Consensus[Aura/GRANDPA]
        TxPool
    end

    subgraph Runtime
        System
        Balances
        AtlasKernel[Atlas Kernel Pallet]
        EVMAdapter[EVM Adapter]
        SVMAdapter[SVM Adapter]
    end

    subgraph Storage
        StateDB[(State DB)]
        CanonicalLedger[(Canonical Ledger)]
    end

    Wallets -->|Submits Comit| RPC --> TxPool
    TxPool --> Runtime
    Runtime --> AtlasKernel
    AtlasKernel -->|Routes Payload| EVMAdapter
    AtlasKernel -->|Routes Payload| SVMAdapter
    Runtime --> Storage
    Consensus --> Runtime
~~~

## 4. Runtime Composition

The runtime combines standard FRAME pallets with Atlas-specific logic:

- **System & Timestamp** – Base block execution utilities.
- **Balances & Transaction Payment** – Native token accounting and fee deduction.
- **Aura & Grandpa** – Authoring and finality consensus engines.
- **Sudo (development only)** – Administrative control until governance is enabled.
- **Atlas Kernel** – Canonical ledger, Comit processing, VM orchestration.
- **Frontier Integration (future)** – Provides Ethereum JSON-RPC compatibility over the EVM adapter.
- **SVM Integration (future)** – Hosts Solana Sealevel execution semantics.

The runtime is compiled to both native and Wasm targets. Wasm artifacts run on-chain and must remain deterministic; all pallets honor `no_std` constraints.

## 5. Dual-VM Execution Model

Atlas Sphere treats EVM and SVM programs as first-class citizens executing within the same block context:

- **Unified Account Abstraction** – A single Substrate `AccountId` maps to an Atlas identifier used across both VMs.
- **Canonical Ledger** – Maintains per-account asset balances, ensuring EVM and SVM share identical liquidity pools.
- **Execution Routing** – The Atlas Kernel inspects Comit payloads and dispatches them to the appropriate VM adapters.
- **Deterministic Ordering** – VM executions occur in the order defined by block authoring, ensuring cross-domain operations remain atomic.
- **State Commitments** – Each VM adapter emits receipts (prepare roots, execution traces) that the kernel validates before updating the canonical ledger.

~~~mermaid
sequenceDiagram
    participant Actor as dApp / Wallet
    participant Kernel as Atlas Kernel
    participant EVM as EVM Adapter
    participant SVM as SVM Adapter
    participant Ledger as Canonical Ledger

    Actor->>Kernel: Submit Comit (EVM & SVM payloads)
    Kernel->>EVM: Execute EVM payload
    EVM-->>Kernel: EVM receipt + state diff
    Kernel->>SVM: Execute SVM payload
    SVM-->>Kernel: SVM receipt + state diff
    Kernel->>Kernel: Verify dual-VM prepare root
    Kernel->>Ledger: Update balances / state
    Kernel-->>Actor: Emit ComitFinalized event
~~~

## 6. Comit Transaction Lifecycle

### 6.1 Comit Structure

| Field | Type | Description |
| --- | --- | --- |
| `comit_id` | `H256` | Globally unique identifier derived from payloads and metadata. |
| `origin` | `AccountId` | Substrate account submitting the Comit. |
| `evm_payload` | `Vec<u8>` | ABI-encoded call bundle targeting the EVM adapter. |
| `svm_payload` | `Vec<u8>` | Borsh-encoded instruction bundle targeting the SVM adapter. |
| `nonce` | `u64` | Sequential guard against replay per origin account. |
| `fee` | `Balance` | Fee paid in ATLAS for execution and storage. |
| `prepare_root` | `H256` | Commitment to the dual-VM prepare phase for validation. |

### 6.2 Processing Stages

1. **Submission** – Wallet constructs a Comit and submits it via `atlas_kernel::submit_comit`. The node validates signature and format.
2. **Pre-Dispatch Checks** – Runtime verifies payload sizes, ensures at least one VM payload is non-empty, confirms nonce.
3. **Dual-VM Execution** – Atlas Kernel dispatches payloads to VM adapters. Each adapter executes deterministically and returns receipts.
4. **Prepare Root Verification** – Kernel recomputes the `prepare_root` (e.g., `blake2_256` hash) across commit metadata and VM traces. A mismatch aborts execution.
5. **Ledger Update** – Upon success, the kernel updates the canonical ledger (balances, state objects) atomically.
6. **Finalization** – `ComitFinalized` event emitted; optional `ComitFailed` event details error reason.
7. **Post-State Availability** – VM-specific storage changes are exposed via RPCs, and canonical ledger deltas are persisted.

### 6.3 Error Handling

- **Invalid Nonce** – Rejects with `ComitFailureReason::InvalidNonce`.
- **Payload Violations** – Oversized or empty payload combinations return error events and do not mutate state.
- **Prepare Root Mismatch** – Signals `ComitFailureReason::Verification`.
- **Ledger Constraints** – Unknown assets or overflow conditions revert execution before state changes.

## 7. Canonical Ledger Design

The canonical ledger is a runtime storage map:

```
CanonicalLedger<AccountId> -> BTreeMap<AssetId, Balance>
```

Key properties:

- **Single Source of Truth** – EVM and SVM read/write through the kernel, preventing balance fragmentation.
- **Asset-Agnostic** – Supports ATLAS native token and external assets (e.g., ETH, SOL, USDC) via `AssetRegistry`.
- **Deterministic Updates** – Ledger changes happen only after dual-VM verification passes.
- **Auditable Events** – Ledger modifications trigger events that auditors can index for compliance.

Ledger operations:

- `update_canonical_balance` (root-only during MVP) – Administrative adjustments or Comit finalization hooks.
- Future releases will allow VM adapters to request state transitions under kernel supervision, eliminating the need for root origin.

## 8. Atomic Cross-Chain Operations

Atlas Kernel enables a two-phase commit protocol across VMs and, in future phases, external chains:

1. **Prepare Phase** – Each domain executes its payload in a dry-run mode, producing receipts and Merkleized state deltas.
2. **Commit Phase** – If all domain receipts validate against the Comit `prepare_root`, the kernel applies state changes atomically.

### Eliminating Wrapped Tokens

- Assets exist once, recorded in the canonical ledger.
- VM adapters reference canonical balances directly instead of issuing wrapped IOUs.
- Cross-domain asset transfers are in-kernel ledger mutations rather than token mint/burn on separate ledgers.
- External chain interoperability will rely on light-client proofs mapping to canonical ledger entries, keeping wrapped representations unnecessary.

## 9. Account Model

- **Primary Identifier** – Substrate `AccountId` (`sp_core::crypto::AccountId32`) governs origin and fee payment.
- **Atlas ID Mapping** – `AccountRegistry` associates accounts with Atlas IDs for cross-VM identity management.
- **Nonce Tracking** – `Nonces` storage ensures monotonic Comit sequencing per account.
- **Authorization** – Calls use standard FRAME origins (signed, root, future collective origins).

## 10. Asset Registry

`AssetRegistry<AssetId, AssetMetadata>` stores metadata:

- `symbol: BoundedVec<u8>` (enforces `MaxAssetSymbolLength`)
- `decimals: u8` (precision used across VMs)

Asset lifecycle:

1. **Registration** – Root origin registers initial assets (ATLAS, ETH, SOL, USDC). Future governance to manage additions.
2. **Validation** – Kernel checks presence of asset IDs before ledger mutations.
3. **Extensibility** – Metadata can expand to include pricing or compliance flags without breaking SCALE encoding.

## 11. Fee Structure

- Comit authors pay fees in ATLAS.
- Fee calculation combines:
  - **Base Weight** – Deterministic costs for Comit verification.
  - **VM Execution Weight** – Per-adapter cost (future dynamic pricing).
  - **Storage Deposit** – Persistent ledger entries may require deposits to prevent storage bloat.
- Fees are deducted during Comit submission prior to execution. Failure scenarios retain a partial fee to compensate block producers.
- Governance will calibrate fee multipliers based on benchmarking (e.g., runtime benchmarking feature flag).

## 12. Consensus & Networking

- **Authoring** – Aura (Authority Round) produces blocks at a 6-second target slot time.
- **Finality** – GRANDPA ensures probabilistic finality with clear justification streams.
- **Telemetry** – Node service integrates telemetry endpoints for monitoring consensus health.
- **Networking** – Libp2p-based gossip propagates blocks and transactions. Future improvements include domain-specific gossip lanes for dual-VM receipts.

Potential future roadmap includes migrating to a BFT consensus (e.g., Tendermint-style) once validator decentralization targets are met.

## 13. Security & Audit Considerations

- **Deterministic Execution** – All runtime code (including VM adapters) must maintain deterministic behavior in Wasm.
- **Receipt Validation** – Prepare root hashing functions should be audited for collision resistance and misuse.
- **Nonce Integrity** – Replay protection relies on strict nonce increments; test coverage confirms invariants.
- **Governance Controls** – Sudo origin is temporary and will be replaced with an on-chain governance pallet prior to mainnet launch.
- **Logging & Observability** – Runtime emits structured events (`ComitSubmitted`, `ComitFinalized`, `AssetRegistered`) for SIEM integration.

## 14. Implementation Status & Roadmap

| Component | Status | Next Steps |
| --- | --- | --- |
| Atlas Kernel Pallet | MVP implemented | Harden verification logic, integrate governance for asset management |
| EVM Adapter | Scaffolded | Wire into Frontier RPC, enable gas metering with canonical ledger |
| SVM Adapter | Planned | Implement Sealevel execution bridge and sidecar verification |
| Comit Verification | MVP (hash-based) | Enhance with merkleized receipts and zero-knowledge proofs |
| Consensus | Aura + GRANDPA | Evaluate hybrid consensus and weighted authority sets |
| Tooling | Node CLI, RPC | Expand developer SDKs, add Comit crafting utilities |

## 15. Glossary

- **Comit** – Commit transaction bridging multiple VMs in one atomic operation.
- **Prepare Root** – Commitment hash produced during the prepare phase used to verify multi-domain consistency.
- **Canonical Ledger** – Single ledger governing asset balances across all execution environments.
- **Atlas ID** – Cross-VM identity tied to a Substrate account.
- **Adapter** – Runtime component translating VM-specific execution to canonical ledger mutations.

---

For questions, implementation details, or security disclosures, reach out to the Atlas Sphere core engineering team through the official communication channels.