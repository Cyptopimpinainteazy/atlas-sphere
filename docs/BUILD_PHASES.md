# 🛠 Atlas Sphere — Step-by-Step Build Order

## Phase 0: Foundations

**Goal:** Make sure your environment is fully ready to compile, test, and run Substrate + Rust + dual VMs.

- Install Rust, WASM target, Substrate deps, Clang, OpenSSL.
- Verify cargo build works for a minimal node template.
- Decide on repo structure: kernel/, evm/, svm/, cli/, sdk/, explorer/, wallet/, dex/, cannibalizer/.

## Phase 1: Atlas Kernel

**Goal:** Core L1 logic + dual-VM orchestration.

- FRAME runtime + pallets: balances, staking, transaction payment.
- Consensus: Aura + GRANDPA (or hybrid PoS/BFT if preferred).
- Dual VM layer:
  - Integrate pallet-evm.
  - Scaffold pallet-svm (stub Sealevel execution).
- Sphere State Tree: unified Merkle forest (EVM + SVM state).
- RPC endpoints for both VMs (future-proof your JSON-RPC + SVM RPC).

**Output:** Node compiles and runs; dummy EVM/SVM txs can hit the runtime.

## Phase 2: Cross-Domain Kernel / Atomic Ops

**Goal:** Enable atomic ops and cross-VM calls.

- Implement message lanes: tx routing between EVM <-> SVM.
- Enforce atomic state commits: one tx, dual VM update, or rollback.
- Test with simple Solidity contract calling a stub SVM program.

**Output:** Verified dual-VM atomic transaction execution.

## Phase 3: Wallet & Key Management

**Goal:** Single-seed, dual-address abstraction.

- CLI wallet: sphere-wallet (support for EVM + SVM addresses).
- Generate authority keys: Aura + GRANDPA + SVM validator keys.
- MetaMask & Phantom plugin integration (allow devs to use existing wallets for testing).

**Output:** Send/receive transactions on both VMs; one seed controls both addresses.

## Phase 4: Explorer

**Goal:** Visualize chain state for both runtimes.

Build "Sphere Explorer":
- Tab 1: EVM view (txs, logs, contract state).
- Tab 2: SVM view (accounts, logs, program state).
- Tab 3: unified cross-VM state summary.
- Hook into node RPCs.
- Enable testnet block tracking, tx search, runtime inspection.

**Output:** Devs can verify txs, block history, and dual-VM execution visually.

## Phase 5: Native DEX — SphereSwap

**Goal:** Cross-VM atomic swaps for real ETH + SOL (no wrapping).

- Build AMM pool contracts for dual VM.
- Implement liquidity management + cross-VM swap adapter.
- Test swaps: EVM → SVM, SVM → EVM, atomically.
- Optional: integrate cannibalizer hooks for mirrored pools.

**Output:** Working atomic swap; liquidity flows between VMs seamlessly.

## Phase 6: Cannibalizer

**Goal:** Auto-mirror EVM + SVM ecosystems.

- Read-only ingestion of existing EVM/SVM contracts.
- State proofs: validate source chain state on Atlas Sphere.
- Deploy "mirrored" contract instances on Atlas Sphere (native assets, no wrapping).
- Optional: automate liquidity migration for major DEXes.

**Output:** Atlas Sphere has instant utility; external projects appear natively in your chain.

## Phase 7: Testnet & QA

**Goal:** Harden validator logic, cross-VM txs, explorer, DEX, wallets.

- Run multi-node devnet: EVM txs, SVM txs, cross-VM atomic calls.
- Verify atomic swap correctness and mirrored state.
- Stress-test consensus with dual-VM workload.
- CI/CD: cargo tests + wasm builds + linting.

**Output:** Hardened testnet, ready for incentivized validator program.

## Phase 8: Beta & SDK

**Goal:** Make Atlas Sphere accessible to devs.

- Rust SDK (runtime & pallet interaction).
- TypeScript SDK (frontend, wallets, explorer hooks).
- Python SDK (bots, arbitrage, AI strategy integration).
- Documentation: docs.atlas-sphere.io.

**Output:** Dev ecosystem live, first dApps running on dual VM testnet.

## Phase 9: Mainnet Launch

- Raw chain spec distribution to validators.
- Incentivized staking program.
- Full explorer + wallet + SphereSwap live.
- Cannibalizer actively ingesting external assets/apps.

**Output:** Fully operational Atlas Sphere L1.

---

# Repository Structure

```
atlas-sphere/
│
├── Cargo.toml                  # Root workspace manifest
├── README.md
├── LICENSE
├── .gitignore
│
├── kernel/                     # Phase 1: Atlas Kernel
│   ├── Cargo.toml
│   ├── src/
│   │   ├── lib.rs
│   │   ├── runtime.rs          # FRAME runtime glue
│   │   ├── consensus.rs        # Aura + GRANDPA + hybrid PoS
│   │   └── state_tree.rs       # Sphere State Tree logic
│   └── pallets/
│       ├── balances/
│       ├── staking/
│       ├── transaction_payment/
│       ├── dual_vm_dispatcher/ # Handles EVM <-> SVM tx routing
│       └── cross_domain_kernel/
│
├── evm/                        # Phase 1: EVM Runtime
│   ├── Cargo.toml
│   ├── src/
│   │   ├── lib.rs
│   │   └── host.rs             # EVM execution host
│   └── pallet-evm-integration/ # Custom wrapper to link EVM to Sphere Kernel
│
├── svm/                        # Phase 1: SVM Runtime
│   ├── Cargo.toml
│   ├── src/
│   │   ├── lib.rs
│   │   └── host.rs             # Sealevel execution host
│   └── pallet-svm-integration/ # Custom wrapper to link SVM to Sphere Kernel
│
├── cli/                        # Node CLI (Phase 0+1)
│   ├── Cargo.toml
│   └── src/
│       └── main.rs             # SubstrateCli impl, command line parsing
│
├── sdk/                        # Phase 8: Developer SDKs
│   ├── rust/                   # Rust SDK for runtime interaction
│   │   ├── Cargo.toml
│   │   └── src/lib.rs
│   ├── ts/                     # TypeScript SDK for dApp
│   │   ├── package.json
│   │   └── src/index.ts
│   └── python/                 # Python SDK for bots, AI, strategy
│       ├── pyproject.toml
│       └── atlas_sphere/
│           └── __init__.py
│
├── explorer/                   # Phase 4: Sphere Explorer
│   ├── package.json
│   ├── tsconfig.json
│   └── src/
│       ├── index.tsx
│       ├── components/
│       ├── pages/
│       └── utils/rpc.ts        # RPC adapters for dual VM
│
├── wallet/                     # Phase 3: Sphere Wallet
│   ├── package.json
│   ├── tsconfig.json
│   └── src/
│       ├── core.ts             # Wallet core logic (dual address derivation)
│       ├── providers/
│       └── ui/
│
├── dex/                        # Phase 5: SphereSwap AMM
│   ├── Cargo.toml
│   ├── src/
│   │   ├── lib.rs
│   │   └── amm.rs              # Cross-VM liquidity pool
│   └── contracts/
│       ├── evm/
│       └── svm/
│
└── cannibalizer/               # Phase 6: Liquidity + App Mirror
    ├── Cargo.toml
    ├── src/
    │   ├── lib.rs
    │   ├── ingestion.rs       # Read-only state proofs from external chains
    │   └── deploy.rs          # Auto-deploy mirrored contracts
    └── config/
```

## Notes on Wiring

### Workspace Cargo.toml
```toml
[workspace]
members = [
    "kernel",
    "evm", 
    "svm",
    "cli",
    "sdk/rust",
    "dex",
    "cannibalizer"
]
```

TS/Python SDKs and frontend packages managed separately with package.json / pyproject.toml.

### Dual-VM Integration
- Kernel exposes DualVmDispatcher trait.
- Each runtime implements `execute_tx(tx)` → returns ExecutionReceipt.
- Dispatcher merges receipts into unified Sphere State Tree.

### RPC Layer
- Node CLI and Explorer connect to rpc/ endpoints.
- Separate namespaces: /evm and /svm but same port possible.

### Testing & CI
- Each crate has Cargo.toml test targets.
- Explorer + Wallet uses Jest / Vitest.
- Cannibalizer uses mock external chain RPCs.

### Phase-based Build
1. Start with kernel/ + evm/ + svm/ + cli/.
2. Add wallet/ + explorer/ next.
3. Add dex/ when cross-VM txs stable.
4. Integrate cannibalizer/ last, when testnet is operational.

This skeleton gives a drop-in starting point, with crates, pallets, SDKs, and frontend wired logically by phase. You could literally git init, create folders + Cargo.toml files, and start coding each module in order.
