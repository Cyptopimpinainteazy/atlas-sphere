# Atlas Sphere L1

[![Build Status](https://github.com/your-org/atlas-sphere/actions/workflows/ci.yml/badge.svg)](https://github.com/your-org/atlas-sphere/actions/workflows/ci.yml) [![License](https://img.shields.io/badge/license-Apache%202.0-blue.svg)](./LICENSE)

Atlas Sphere is a next-generation Layer-1 blockchain purpose-built to host dual virtual machines (EVM + SVM), enabling native interoperability between Ethereum-style smart contracts and Solana-style Sealevel programs. The network is optimized for cross-domain composability, featuring a native asset layer, predictable execution semantics, and atomic cross-chain operations to bridge ecosystem liquidity without trusted intermediaries.

## Table of Contents

1. [Vision & Core Features](#vision--core-features)
2. [Current Status](#current-status)
3. [Architecture Overview](#architecture-overview)
4. [Development Setup](#development-setup)
5. [Build Instructions](#build-instructions)
6. [Quick Start](#quick-start)
7. [Running a Node](#running-a-node)
8. [Consensus](#consensus)
9. [Network Configuration](#network-configuration)
10. [Key Management](#key-management)
11. [Basic Usage Examples](#basic-usage-examples)
12. [Testing & Quality Gates](#testing--quality-gates)
13. [Contribution Guidelines](#contribution-guidelines)
14. [Roadmap Snapshot](#roadmap-snapshot)
15. [Resources & Further Reading](#resources--further-reading)
16. [License](#license)

---

## Vision & Core Features

- **Dual-VM Execution (EVM + SVM):** Run Solidity/Vyper contracts and Sealevel programs side-by-side with deterministic consensus ordering. Atlas Sphere exposes a unified account abstraction to simplify cross-VM asset flows.
- **Native Asset Layer:** The Atlas native asset powers staking, fee markets, and rewards. Additional assets can be registered via asset pallets and used across both VMs without wrapping.
- **Atomic Cross-Chain Operations:** Built-in message-lane primitives let developers submit atomic transactions that span multiple domains, eliminating the need for fragile multi-step bridging.
- **High-Performance Substrate Foundation:** Built on Substrate for modularity, runtime upgrades, and rich tooling while maintaining a custom runtime tuned for Atlas’ heterogeneous VM workloads.

## Current Status

- ✅ Atlas Kernel pallet implemented with Comit submission, nonce management, and canonical ledger primitives wired into the runtime.
- ✅ Runtime integrates the Atlas Kernel alongside balances, transaction payment, Aura, and GRANDPA, enabling end-to-end Comit processing in development environments.
- 🚧 Dual-VM adapters (Frontier EVM + SVM integration) remain in development, with execution routing and tooling slated for the next milestone.

---

## Architecture Overview

| Component | Status | Summary |
| --- | --- | --- |
| **Runtime** | Dev-ready | FRAME-based runtime integrating Aura + GRANDPA consensus, balances, transaction payment, sudo (for dev), and scaffolding for VM orchestration. |
| **Dual VM Layer** | In Development | Frontier-based EVM adapter and SVM bridge are being wired into the canonical ledger with forthcoming execution and RPC exposure. |
| **Cross-Domain Kernel** | Implemented (MVP) | Atlas Kernel pallet anchors Comit submission, asset registry, and canonical ledger updates powering dual-VM coordination. |
| **Node Service** | In Progress | Provides RPC, telemetry, and networking services with hooks for future Frontier JSON-RPC and SVM execution interfaces. |
| **Tooling** | In Progress | CLI utilities cover chain specs and key handling; Comit crafting helpers and SDK improvements are scheduled next. |

---

## Development Setup

### Prerequisites

- **Operating System:** Linux or macOS (Windows via WSL2 recommended).
- **Rust Toolchain:** `rustup` with the stable toolchain (or project-specified override via `rust-toolchain.toml`).
  ```bash
  rustup toolchain install stable
  rustup default stable
  rustup target add wasm32-unknown-unknown
  rustup component add rustfmt clippy
  ```
  Verify installation:
  ```bash
  rustup show active-toolchain
  cargo --version
  ```
- **Build Dependencies:** `cmake`, `pkg-config`, `openssl`, `libclang`, and `clang` (required by Substrate).
  ```bash
  # Debian/Ubuntu
  sudo apt update
  sudo apt install -y build-essential cmake pkg-config libssl-dev git clang libclang-dev
  ```
- **Substrate Dependencies:** Refer to the [official Substrate prerequisites](https://docs.substrate.io/install/) for platform-specific instructions.
- **Optional:** `just`, `direnv`, Docker, and Polkadot.js apps for local interactions.

### Repository Setup

```bash
git clone https://github.com/your-org/atlas-sphere.git
cd atlas-sphere
```

---

## Build Instructions

Compile the Atlas Sphere node and runtime artifacts:

```bash
cargo build --release
```

Key artifacts:

- `target/release/atlas-sphere-node` – Native node binary.
- `runtime/wasm/atlas_sphere_runtime.compact.wasm` – Runtime WASM (generated via build script).

For iterative development builds:

```bash
cargo build
```

## Quick Start

1. **Build the binaries**

   ```bash
   cargo build --release
   ```

2. **Launch a development node with the Atlas Kernel runtime**

   ```bash
   ./target/release/atlas-sphere-node --dev --tmp --log runtime=info
   ```

3. **Submit a test Comit extrinsic (requires `subxt` CLI)**

   ```bash
   cargo install --locked subxt-cli
   subxt extrinsic submit \
     --url ws://127.0.0.1:9944 \
     --suri //Alice \
     atlasKernel submitComit \
     0x0102030405060708090a0b0c0d0e0f00112233445566778899aabbccddeeff00 \
     0x \
     0x0102 \
     0 \
     1000000000000 \
     0x0000000000000000000000000000000000000000000000000000000000000000
   ```

4. **Watch Comit events**

   ```bash
   subxt event watch --url ws://127.0.0.1:9944 atlasKernel
   ```

   You should see `ComitSubmitted` (and optionally `ComitFinalized`) events emitted as the runtime processes the transaction.

---

## Running a Node

Launch a local development node with instant seal and predictable authority:

```bash
./target/release/atlas-sphere-node --dev
```

Useful flags:

- `--tmp` – Run with an in-memory DB (cleared on exit).
- `--rpc-cors all` – Allow RPC calls from any origin (development only).
- `--log runtime=debug` – Increase logging verbosity for runtime modules.

Stop the node with `Ctrl+C`. Logs are streamed to stdout by default.

## Consensus

Atlas Sphere currently leverages the Aura block authoring engine paired with GRANDPA finality, delivering a 6-second target block time and deterministic development workflows. The core team is actively evaluating a future migration path toward a Tendermint-style BFT consensus set to enhance liveness under adversarial network conditions while preserving runtime upgrade flexibility.

---

## Network Configuration

Atlas Sphere ships with multiple chain specifications:

| Spec | Command | Description |
| --- | --- | --- |
| Development | `atlas-sphere-node --dev` | Single-node authority, instant block production. |
| Local Testnet | `atlas-sphere-node --chain local -d /tmp/atlas-local` | Multi-node authority with deterministic keys (use `--alice`, `--bob`). |
| Staging/Mainnet (future) | `atlas-sphere-node --chain atlas` | Use generated chain spec files committed by core team. |

Generate custom chain specs:

```bash
# Export plain chain spec
./target/release/atlas-sphere-node build-spec --disable-default-bootnode > atlas.json

# Export raw chain spec (ready for launch)
./target/release/atlas-sphere-node build-spec --chain atlas.json --raw --disable-default-bootnode > atlas-raw.json
```

Distribute the raw chain spec to validators to ensure consensus on initial state.

---

## Key Management

Use Substrate tooling (`subkey`) to generate and manage keys:

```bash
# Install subkey (ships with Substrate toolchain)
cargo install --force subkey --git https://github.com/paritytech/substrate --locked

# Generate aura/grandpa keys
subkey generate --scheme sr25519   # Aura authority
subkey inspect "<SECRET_PHRASE>" --scheme ed25519  # Grandpa authority
```

Inject keys into the keystore:

```bash
./target/release/atlas-sphere-node \
  --chain atlas \
  --name "Validator-01" \
  --base-path /var/lib/atlas \
  key insert \
  --scheme sr25519 \
  --suri "<SECRET_PHRASE>" \
  --key-type aura
```

For production, store secret phrases securely (e.g., HSM, Hashicorp Vault). Never expose raw secret seeds in scripts or logs.

---

## Basic Usage Examples

### 1. Interact via RPC

Enable RPC endpoints:

```bash
./target/release/atlas-sphere-node --dev --rpc-methods=Unsafe --rpc-port 9933
```

Query system chain info:

```bash
curl http://127.0.0.1:9933 -H "Content-Type: application/json" \
     -d '{"id":1,"jsonrpc":"2.0","method":"system_chain","params":[]}'
```

### 2. Deploy Solidity Contracts

1. Start node with EVM RPC compatibility (future release flag).
2. Use Hardhat/Foundry endpoint: `http://127.0.0.1:8545`.
3. Deploy contract as on any Ethereum-compatible network.

### 3. Execute SVM Programs (Roadmap)

- Build SVM program with Solana toolchain.
- Submit via Atlas Sphere SVM adaptor pallet (forthcoming).
- Monitor execution via RPC subscription.

### 4. Atomic Cross-Chain Operation (Simulated)

1. Start the Atlas Sphere node alongside your target counterparty chain (e.g., a local Substrate relay or Ethereum devnet) ensuring both expose RPC endpoints.
2. Use the Atlas CLI (roadmap) to draft a cross-domain manifest and submit it via the `atlas_sphere_cross_chain_submit` RPC; during active development you can mock this with `author_submitExtrinsic` carrying the kernel pallet call.
3. Observe the composite transaction status via `system.events` and confirm both VM executions are finalized in the same block.
4. Inspect `atlasKernel.lanes` RPC (coming soon) or node logs tagged `atlas-kernel` to verify lane commitments and relay messages.

---

## Testing & Quality Gates

Run unit tests across workspace members:

```bash
cargo test --all
```

Linting and formatting:

```bash
cargo fmt --all
cargo clippy --all-targets --all-features -- -D warnings
```

Runtime checks:

```bash
cargo test -p atlas-sphere-runtime
cargo build -p atlas-sphere-runtime --release --features runtime-benchmarks
```

Continuous Integration (GitHub Actions) enforces these gates, alongside WASM runtime builds for determinism.

---

## Contribution Guidelines

1. **Fork & Branch:** Create feature branches from `main`.
2. **Coding Standards:** Follow Rust best practices, ensure `cargo fmt` and `cargo clippy` pass.
3. **Commits:** Use descriptive messages; reference GitHub issues or PRs when applicable.
4. **Testing:** Add unit/integration tests covering new functionality.
5. **PR Review:** Request review from Atlas Sphere maintainers; expect automated checks before merge.
6. **Security:** Report vulnerabilities privately to the core team (security@atlas-sphere.io) before public disclosure.

Please read `CONTRIBUTING.md` (forthcoming) for detailed policies, CLA requirements, and governance.

---

## Roadmap Snapshot

- ✅ Atlas Kernel pallet MVP landed with Comit submission, asset registry, and canonical ledger primitives now available on-chain.
- ✅ Runtime integrates Aura + GRANDPA consensus, transaction payment, and Atlas Kernel wiring for end-to-end Comit handling.
- 🚧 Dual VM adapters (Frontier EVM + SVM bridge) under active development with a developer preview targeted for the next milestone.
- 🔜 Next up: Tendermint-style consensus evaluation, governance pallet activation to retire sudo, and comprehensive runtime benchmarking.

Progress is tracked publicly via our GitHub Projects board.

---

## Resources & Further Reading

- Atlas Sphere Documentation (coming soon): [https://docs.atlas-sphere.io](https://docs.atlas-sphere.io)
- Atlas Sphere Cross-Chain Primer: [https://labs.atlas-sphere.io/cross-chain-primer](https://labs.atlas-sphere.io/cross-chain-primer)
- Substrate Developer Hub: [https://docs.substrate.io](https://docs.substrate.io)
- FRAME Runtime Overview: [https://docs.substrate.io/build/runtime/](https://docs.substrate.io/build/runtime/)
- Substrate Node Template: [https://github.com/substrate-developer-hub/substrate-node-template](https://github.com/substrate-developer-hub/substrate-node-template)
- Polkadot.js Apps: [https://polkadot.js.org/apps/](https://polkadot.js.org/apps/)
- Solana Sealevel Docs: [https://docs.solana.com/developing/programming-model/overview](https://docs.solana.com/developing/programming-model/overview)
- Ethereum JSON-RPC Spec: [https://ethereum.org/en/developers/docs/apis/json-rpc/](https://ethereum.org/en/developers/docs/apis/json-rpc/)

---

## License

Atlas Sphere is released under the Apache License 2.0. See `LICENSE` for details.
