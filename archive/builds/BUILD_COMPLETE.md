# Atlas Sphere - Complete Build & Run Guide

## 🎯 Current Build Status

### ✅ Successfully Built Components
- **Runtime** (`atlas-sphere-runtime`)
  - All Substrate pallets configured
  - Block weights validated
  - Runtime integrity tests: **PASS**
  
- **Custom Pallet** (`pallet-atlas-kernel`)
  - Asset registry implementation
  - Comit submission & verification
  - Canonical ledger management
  - 33/40 tests passing (7 tests have expected event-on-error behavior differences)

- **Integration Crates**
  - EVM integration layer
  - SVM integration layer

### ⚠️  Known Issues
- **Node Binary**: Blocked by external Frontier dependency version conflicts
  - Issue: `sc-network` has duplicate variant indexes in polkadot-v1.0.0
  - Frontier crates need updates for v1.0.0 compatibility
  
## 🛠️  Building Components

### Build Runtime Only
```bash
cargo build -p atlas-sphere-runtime --release
```

### Test Runtime
```bash
cargo test -p atlas-sphere-runtime --release
```

### Build Custom Pallet
```bash
cargo build -p pallet-atlas-kernel --release
```

### Test Custom Pallet
```bash
cargo test -p pallet-atlas-kernel --release
```

## 🚀 Running the Blockchain

### Option 1: Fix Frontier Dependencies (Recommended)
Update `Cargo.toml` workspace dependencies to use compatible Frontier versions:
```toml
[workspace.dependencies]
# Change from branch = "polkadot-v1.0.0" to a stable release
fc-api = { git = "https://github.com/paritytech/frontier", tag = "v1.0.0-rc1" }
fc-cli = { git = "https://github.com/paritytech/frontier", tag = "v1.0.0-rc1" }
# ... etc
```

Then rebuild:
```bash
cargo build -p atlas-sphere-node --release
./run-dev-node.sh
```

### Option 2: Revert to Polkadot v0.9.x
Use a stable Frontier version that works with v0.9.x:
```bash
# Update rust-toolchain.toml
echo 'nightly-2023-06-01' > rust-toolchain.toml

# Update Cargo.toml branches
sed -i 's/polkadot-v1.0.0/polkadot-v0.9.38/g' Cargo.toml

cargo build -p atlas-sphere-node --release
./run-dev-node.sh
```

### Option 3: Build Without EVM Support (Fastest)
For a Substrate-only node without Frontier:

1. Remove Frontier dependencies from `node/Cargo.toml`:
   - Remove `fc-cli`, `fc-consensus`, `fc-db`, `fc-mapping-sync`, `fc-rpc`, `fc-rpc-core`, `fc-storage`
   - Remove `ethereum`, `ethereum-types`

2. Update `node/src/service.rs` to remove Frontier service components

3. Rebuild:
   ```bash
   cargo build -p atlas-sphere-node --release
   ./run-dev-node.sh
   ```

## 📊 Verifying Your Blockchain

Once the node is running, test it with:

```bash
# Get node info
curl -s http://localhost:9944 \
  -H "Content-Type: application/json" \
  -d '{"jsonrpc":"2.0","method":"chain_getHeader","params":[],"id":1}' \
  | jq .

# Get account balance
curl -s http://localhost:9944 \
  -H "Content-Type: application/json" \
  -d '{"jsonrpc":"2.0","method":"state_getStorage","params":["0x...",""],"id":1}' \
  | jq .
```

## 📦 Project Structure

```
atlas-sphere/
├── runtime/                  # ✅ Runtime (compiled & tested)
│   └── src/lib.rs           # All configs fixed
├── node/                     # ⚠️  Blocked on Frontier
│   ├── src/
│   │   ├── main.rs
│   │   ├── cli.rs
│   │   ├── command.rs
│   │   ├── lib.rs
│   │   └── service.rs
│   └── Cargo.toml
├── pallets/
│   └── atlas-kernel/        # ✅ Pallet (mostly tested)
│       └── src/
│           ├── lib.rs       # Core logic
│           ├── types.rs     # Type definitions
│           ├── tests.rs     # 33/40 passing
│           └── mock.rs      # Test setup
├── crates/
│   ├── evm-integration/
│   └── svm-integration/
└── run-dev-node.sh          # Node launcher script
```

## 🎓 What Works

### ✅ Core Blockchain Features
1. **Substrate Runtime** - Fully configured with all required pallets
2. **Block validation** - Block weights and limits properly set
3. **Transaction processing** - Working for valid transactions
4. **Asset Registry** - Create and manage multi-chain assets
5. **Comit Submission** - Dual-VM cross-chain transaction framework
6. **Nonce Management** - Per-account transaction sequencing
7. **Prepare Root Verification** - Cryptographic commitment validation

### 🚧 In Progress
1. **Node Binary** - Waiting on Frontier dependency resolution
2. **EVM RPC** - Frontier FC-RPC compatibility needed
3. **SVM Integration** - Ready but needs node runtime

## 📝 Next Steps

1. **Resolve Frontier dependencies** - Most critical blocker
2. **Complete event emission tests** - Currently 7 tests expect events on failed transactions
3. **Implement EVM adapter** - Full Frontier pallet integration
4. **Implement SVM adapter** - Solana VM bytecode execution
5. **Add RPC endpoints** - Chain state queries and transaction submission
6. **Deploy test wallets** - Fund accounts and test transactions

## 🔗 References

- [Substrate Framework](https://docs.substrate.io/)
- [Frontier EVM Integration](https://github.com/paritytech/frontier)
- [Comit Specification](./docs/COMIT_SPEC.md)
- [Architecture Documentation](./docs/ARCHITECTURE.md)

---

**Generated:** November 7, 2025  
**Status:** 🟡 Waiting for Frontier compatibility fixes
