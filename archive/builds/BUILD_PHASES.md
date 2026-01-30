# Atlas Sphere - Phase-Based Build Plan

## 📋 **Package Management Structure**

### **Rust Crates**
- Each pallet/crate has independent `Cargo.toml`
- Test targets in each `Cargo.toml`
- Shared dependencies managed at workspace level

### **TypeScript/Python SDKs**
- **TS SDK**: Managed with `package.json`
- **Python SDK**: Managed with `pyproject.toml`
- **Frontend**: Separate `package.json` with Jest/Vitest

### **Frontend Packages**
- **Wallet**: `wallet/package.json`
- **Explorer**: `explorer/package.json`
- **DEX Interface**: `dex/package.json`

---

## 🏗️ **Dual-VM Integration Architecture**

### **Kernel Layer**
```rust
// Kernel exposes DualVmDispatcher trait
pub trait DualVmDispatcher {
    fn execute_evm_tx(&self, tx: EvmTransaction) -> ExecutionReceipt;
    fn execute_svm_tx(&self, tx: SvmTransaction) -> ExecutionReceipt;
    fn merge_receipts(&self, receipts: Vec<ExecutionReceipt>) -> SphereState;
}
```

### **Runtime Implementation**
- Each runtime implements `execute_tx(tx) → ExecutionReceipt`
- Dispatcher merges receipts into unified Sphere State Tree
- State tree maintains consistency across both VMs

### **RPC Layer Structure**
```
Node CLI ──┬─► /rpc/evm/* (EVM-specific endpoints)
Explorer ──┤
Wallet ────┴─► /rpc/svm/* (SVM-specific endpoints)
```

**Note**: Single port possible with namespace routing

---

## 🧪 **Testing & CI Strategy**

### **Rust Testing**
```toml
# Each Cargo.toml includes:
[dev-dependencies]
proptest = "1.0"
tokio-test = "0.4"

[[test]]
name = "integration_tests"
path = "tests/integration.rs"

[[test]]
name = "unit_tests"
path = "tests/unit.rs"
```

### **Frontend Testing**
- **Explorer + Wallet**: Jest / Vitest
- **Mock external RPCs** for Cannibalizer tests
- **Component testing** with React Testing Library

### **CI Pipeline Structure**
```yaml
# GitHub Actions / GitLab CI
stages:
  - test-rust
  - test-frontend
  - integration-test
  - build-docker
  - deploy-testnet
```

---

## 📅 **Phase-Based Development Plan**

### **🏛️ Phase 1: Core Infrastructure (Week 1-2)**

#### **Priority Components:**
- ✅ **atlas-sphere/Cargo.toml** (Workspace root)
- ✅ **pallets/atlas-kernel/** (Core kernel pallet)
- ✅ **runtime/** (Runtime configuration)
- ✅ **node/** (Node implementation)

#### **Key Deliverables:**
- [ ] Basic kernel pallet with DualVmDispatcher trait
- [ ] Runtime with EVM + SVM integration
- [ ] Node CLI with basic RPC endpoints
- [ ] Unit tests for all core components

#### **Success Criteria:**
- Node compiles and starts
- Basic EVM transactions execute
- Basic SVM transactions execute
- RPC endpoints respond

---

### **🔗 Phase 2: Frontend Foundation (Week 3-4)**

#### **Priority Components:**
- **SDKs**: TypeScript + Python bindings
- **Wallet**: Basic wallet interface
- **Explorer**: Block/transaction viewer

#### **Key Deliverables:**
- [ ] TypeScript SDK (`packages/ts-sdk/`)
- [ ] Python SDK (`packages/py-sdk/`)
- [ ] Basic wallet interface (`apps/wallet/`)
- [ ] Block explorer (`apps/explorer/`)

#### **Success Criteria:**
- Wallet can connect to local node
- Explorer displays blocks/transactions
- SDKs provide type-safe interfaces
- Jest/Vitest tests passing

---

### **⚡ Phase 3: DEX Integration (Week 5-6)**

#### **Priority Components:**
- **DEX Pallet**: Cross-VM DEX functionality
- **DEX Frontend**: Trading interface
- **Cross-VM Transactions**: Atomic swaps

#### **Key Deliverables:**
- [ ] DEX pallet with cross-VM swaps
- [ ] DEX frontend interface
- [ ] Cross-VM transaction types
- [ ] Integration tests

#### **Success Criteria:**
- Cross-VM swaps execute atomically
- DEX frontend functional
- Price feeds integrated
- Liquidity provision working

---

### **🎯 Phase 4: Advanced Features (Week 7-8)**

#### **Priority Components:**
- **Cannibalizer**: External chain integration
- **Advanced DEX**: Complex order types
- **Governance**: On-chain governance

#### **Key Deliverables:**
- [ ] Cannibalizer with mock external RPCs
- [ ] Advanced order types (limit, stop-loss)
- [ ] Governance pallet
- [ ] Bridge integration

#### **Success Criteria:**
- Cannibalizer can simulate external chains
- Advanced trading features work
- Governance proposals execute
- Bridge transfers functional

---

### **🚀 Phase 5: Production Readiness (Week 9-10)**

#### **Priority Components:**
- **Testing Infrastructure**: Full test coverage
- **Documentation**: API docs + guides
- **Deployment**: Docker + orchestration
- **Monitoring**: Metrics + alerting

#### **Key Deliverables:**
- [ ] 95%+ test coverage
- [ ] Complete API documentation
- [ ] Production Docker setup
- [ ] Monitoring dashboard

---

## 📁 **Project Structure Overview**

```
atlas-sphere/
├── 📁 crates/                    # Rust workspace
│   ├── atlas-kernel/            # Core kernel pallet
│   ├── evm-integration/         # EVM compatibility
│   ├── svm-integration/         # SVM compatibility
│   └── runtime/                 # Runtime configuration
├── 📁 node/                     # Node implementation
├── 📁 pallets/                  # Substrate pallets
├── 📁 apps/                     # Frontend applications
│   ├── wallet/                  # Wallet interface
│   ├── explorer/                # Block explorer
│   └── dex/                     # DEX interface
├── 📁 packages/                 # SDKs
│   ├── ts-sdk/                  # TypeScript SDK
│   └── py-sdk/                  # Python SDK
├── 📁 docs/                     # Documentation
└── 📁 infra/                    # Infrastructure configs
```

---

## 🔧 **Development Workflow**

### **Daily Development:**
1. **Rust**: `cargo build` + `cargo test`
2. **Frontend**: `npm run dev` + `npm test`
3. **Integration**: Run local testnet node
4. **Documentation**: Update as you build

### **Code Organization:**
- **One feature per branch** for focused development
- **Draft PRs** for early feedback
- **Comprehensive tests** before merging
- **Documentation updates** with code changes

---

## ⚡ **Quick Start Commands**

```bash
# Phase 1 - Core Development
cd atlas-sphere
cargo build                    # Build all crates
cargo test                     # Run all tests
./target/debug/atlas-node --dev # Start local node

# Phase 2 - Frontend Development
cd apps/wallet
npm install && npm run dev     # Start wallet dev server
npm test                       # Run wallet tests

# Phase 3+ - Full Stack
docker-compose up              # Start full stack
```

---

## 🎯 **Success Metrics**

### **Phase 1 Complete:**
- [ ] Node starts without errors
- [ ] Basic transactions execute
- [ ] RPC endpoints functional
- [ ] 80% test coverage

### **Phase 2 Complete:**
- [ ] Frontend apps load without errors
- [ ] Wallet connects to node
- [ ] Explorer shows real data
- [ ] SDK tests pass

### **Phase 3 Complete:**
- [ ] Cross-VM transactions work
- [ ] DEX frontend functional
- [ ] Real token swaps execute
- [ ] Integration tests pass

### **Project Complete:**
- [ ] All phases implemented
- [ ] Production deployment ready
- [ ] Documentation complete
- [ ] Performance benchmarks met

---

## 🚨 **Critical Path Dependencies**

### **Phase 1 Must Be Solid:**
- Kernel implementation affects everything
- Runtime configuration is foundation
- Node stability is critical

### **Phase 2 Enables UX:**
- Frontend quality affects adoption
- SDK quality affects developer experience
- Testing foundation is crucial

### **Phase 3+ Are Features:**
- DEX can be iterated post-launch
- Advanced features can be added later
- Cannibalizer is optimization

This phased approach ensures steady progress while maintaining quality and allowing for learning/adaptation at each stage.