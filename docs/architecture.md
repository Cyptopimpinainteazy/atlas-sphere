# Atlas Sphere Architecture

This document provides a deep dive into Atlas Sphere's technical architecture, explaining how the dual-VM system works, node roles, and VM routing mechanisms.

## System Overview

Atlas Sphere implements a layered architecture that enables atomic execution across EVM and SVM while maintaining security and performance.

```
┌─────────────────────────────────────────────────────────────────┐
│                    ATLAS SPHERE ARCHITECTURE                    │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  ┌───────────────┐    ┌───────────────┐    ┌───────────────┐  │
│  │   CONSENSUS   │    │   RUNTIME     │    │   NETWORK     │  │
│  │               │    │               │    │               │  │
│  │ • Aura        │    │ • EVM Layer   │    │ • libp2p      │  │
│  │ • GRANDPA     │    │ • SVM Layer   │    │ • gRPC        │  │
│  │ • BABE        │    │ • X3 Layer    │    │ • WebSocket   │  │
│  └───────┬───────┘    └───────┬───────┘    └───────┬───────┘  │
│          │                    │                    │          │
│          └────────────────────┼────────────────────┘          │
│                                 │                               │
│  ┌─────────────────────────────▼─────────────────────────────┐ │
│  │                 CANONICAL LEDGER                         │ │
│  │                                                         │ │
│  │  ┌─────────────┐ ┌─────────────┐ ┌─────────────────────┐ │ │
│  │  │ EVM State   │ │ SVM State   │ │ X3 State            │ │ │
│  │  │ Tree        │ │ Tree        │ │ Slots + Heap        │ │ │
│  │  └─────────────┘ └─────────────┘ └─────────────────────┘ │ │
│  │                                                         │ │
│  │  ┌─────────────────────────────────────────────────────┐ │ │
│  │  │           CROSS-VM BRIDGE                           │ │ │
│  │  │ • Asset Registry    • Atomic Execution             │ │ │
│  │  │ • State Sync        • Gas Accounting               │ │ │
│  │  │ • Call Routing      • Event Emission               │ │ │
│  │  └─────────────────────────────────────────────────────┘ │ │
│  └─────────────────────────────────────────────────────────┘ │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

## Node Roles

Atlas Sphere nodes can serve different roles depending on their configuration and network participation:

### Validator Nodes
**Purpose**: Block production and consensus participation

```
┌─────────────────────────────────────────┐
│            VALIDATOR NODE                │
├─────────────────────────────────────────┤
│                                         │
│  ┌─────────────┐  ┌─────────────┐     │
│  │ Block       │  │ Consensus   │     │
│  │ Producer    │  │ Engine      │     │
│  └──────┬──────┘  └──────┬──────┘     │
│         │                 │            │
│  ┌──────▼──────────┐ ┌───▼────────┐   │
│  │ EVM Adapter     │ │ SVM Adapter │   │
│  │ • State         │ │ • BPF       │   │
│  │ • Execution     │ │ • Execution │   │
│  │ • Gas           │ │ • CU        │   │
│  └──────┬──────────┘ └───┬────────┘   │
│         │                │            │
│  ┌──────▼────────────────▼──────────┐ │
│  │   CANONICAL LEDGER               │ │
│  │   • Atomic commit               │ │
│  │   • Cross-VM state              │ │
│  │   • Asset registry              │ │
│  └─────────────────────────────────┘ │
│                                         │
└─────────────────────────────────────────┘
```

**Responsibilities:**
- Produce blocks every 6 seconds (Aura consensus)
- Validate transactions across both VMs
- Execute cross-VM atomic operations
- Maintain canonical ledger state
- Participate in GRANDPA finality

**Configuration:**
```toml
[validator]
enabled = true
# Enable block production
block_production = true

[consensus]
# Aura configuration
aura = { authorities = ["alice", "bob", "charlie"] }

[vm]
# Enable both VM execution
evm_enabled = true
svm_enabled = true
```

### RPC Nodes
**Purpose**: Provide external API access for developers and applications

```
┌─────────────────────────────────────────┐
│              RPC NODE                   │
├─────────────────────────────────────────┤
│                                         │
│  ┌─────────────┐  ┌─────────────┐     │
│  │ JSON-RPC    │  │ WebSocket   │     │
│  │ HTTP Server │  │ Server      │     │
│  └──────┬──────┘  └──────┬──────┘     │
│         │                 │            │
│  ┌──────▼──────────┐ ┌───▼────────┐   │
│  │ EVM RPC         │ │ SVM RPC    │   │
│  │ • eth_*         │ │ • sol_*    │   │
│  │ • net_*         │ │ • get_*    │   │
│  │ • web3_*        │ │ • program_*│   │
│  └──────┬──────────┘ └───┬────────┘   │
│         │                │            │
│  ┌──────▼────────────────▼──────────┐ │
│  │   CANONICAL LEDGER (READ-ONLY)   │ │
│  │   • Query state                 │ │
│  │   • Subscribe to events         │ │
│  │   • Cross-VM calls              │ │
│  └─────────────────────────────────┘ │
│                                         │
└─────────────────────────────────────────┘
```

**Services Provided:**
- Ethereum-compatible JSON-RPC (port 9933)
- Solana-compatible RPC (port 9934)  
- WebSocket subscriptions (port 9944)
- Cross-VM call interface
- Block and transaction indexing

**Why this matters**: RPC nodes enable external applications to interact with Atlas Sphere using familiar APIs from both Ethereum and Solana ecosystems.

### Archive Nodes
**Purpose**: Full blockchain history and state archival

```
┌─────────────────────────────────────────┐
│             ARCHIVE NODE                │
├─────────────────────────────────────────┤
│                                         │
│  ┌─────────────┐  ┌─────────────┐     │
│  │ State       │  │ Block       │     │
│  │ Database    │  │ Storage     │     │
│  │ • Full      │  │ • All       │     │
│  │   History   │  │   Blocks    │     │
│  └──────┬──────┘  └──────┬──────┘     │
│         │                 │            │
│  ┌──────▼──────────┐ ┌───▼────────┐   │
│  │ EVM Archive     │ │ SVM Archive│   │
│  │ • Account State │ │ • Account  │   │
│  │ • Storage Trie  │ │   States   │   │
│  │ • Receipts      │ │ • Programs │   │
│  └──────┬──────────┘ └───┬────────┘   │
│         │                │            │
│  ┌──────▼────────────────▼──────────┐ │
│  │      CROSS-VM INDEX              │ │
│  │      • Transaction mapping       │ │
│  │      • Event correlation         │ │
│  │      • Asset flow tracking       │ │
│  └─────────────────────────────────┘ │
│                                         │
└─────────────────────────────────────────┘
```

**Benefits:**
- Complete historical query capability
- Analytics and research support
- Network state reconstruction
- Cross-VM transaction analysis

## VM Routing

Atlas Sphere automatically routes transactions to the appropriate VM based on payload characteristics:

### EVM Transaction Flow
```
┌─────────────────────────────────────────┐
│            EVM ROUTING                   │
├─────────────────────────────────────────┤
│                                         │
│  1. Transaction Receipt                  │
│     ┌─────────────────────┐             │
│     │ • to: contract addr │             │
│     │ • data: bytecode    │             │
│     │ • value: amount     │             │
│     └─────────┬───────────┘             │
│               │                         │
│  2. EVM Adapter Selection                │
│     ┌─────────▼───────────┐             │
│     │ • Check address     │             │
│     │ • Validate format   │             │
│     │ • Route to EVM      │             │
│     └─────────┬───────────┘             │
│               │                         │
│  3. EVM Execution                       │
│     ┌─────────▼───────────┐             │
│     │ • Bytecode          │             │
│     │ • OPCODE dispatch   │             │
│     │ • Gas metering      │             │
│     └─────────┬───────────┘             │
│               │                         │
│  4. State Update                        │
│     ┌─────────▼───────────┐             │
│     │ • Storage writes    │             │
│     │ • Balance changes   │             │
│     │ • Event emission    │             │
│     └─────────────────────┘             │
│                                         │
└─────────────────────────────────────────┘
```

### SVM Transaction Flow
```
┌─────────────────────────────────────────┐
│            SVM ROUTING                   │
├─────────────────────────────────────────┤
│                                         │
│  1. Instruction Receipt                  │
│     ┌─────────────────────┐             │
│     │ • program_id        │             │
│     │ • accounts[]        │             │
│     │ • instruction_data  │             │
│     └─────────┬───────────┘             │
│               │                         │
│  2. SVM Adapter Selection                │
│     ┌─────────▼───────────┐             │
│     │ • Validate program  │             │
│     │ • Check accounts    │             │
│     │ • Route to SVM      │             │
│     └─────────┬───────────┘             │
│               │                         │
│  3. BPF Execution                        │
│     ┌─────────▼───────────┐             │
│     │ • Bytecode          │             │
│     │ • Account access    │             │
│     │ • Compute units     │             │
│     └─────────┬───────────┘             │
│               │                         │
│  4. State Update                        │
│     ┌─────────▼───────────┐             │
│     │ • Account data      │             │
│     │ • Program state     │             │
│     │ • Log emission      │             │
│     └─────────────────────┘             │
│                                         │
└─────────────────────────────────────────┘
```

### Cross-VM Transaction Flow
```
┌─────────────────────────────────────────┐
│          CROSS-VM ROUTING                │
├─────────────────────────────────────────┤
│                                         │
│  1. Multi-VM Transaction                 │
│     ┌─────────────────────┐             │
│     │ • evm_payload       │             │
│     │ • svm_payload       │             │
│     │ • atomic: true      │             │
│     └─────────┬───────────┘             │
│               │                         │
│  2. Transaction Analysis                 │
│     ┌─────────▼───────────┐             │
│     │ • Parse payloads    │             │
│     │ • Route EVM part    │             │
│     │ • Route SVM part    │             │
│     └─────────┬───────────┘             │
│               │                         │
│  3. Parallel Execution                   │
│     ┌───────▼───────┐ ┌─────▼───────┐   │
│     │ EVM Execution │ │ SVM Execution│   │
│     │ • Pre-check   │ │ • Parallel  │   │
│     │ • Contract    │ │ • BPF       │   │
│     │ • Settlement  │ │ • Compute   │   │
│     └───────┬───────┘ └───┬───────┘   │
│             │             │            │
│  4. Atomic Commit/Rollback                 │
│     ┌───────▼─────────────▼───────┐     │
│     │ • Both succeed? Commit      │     │
│     │ • Any fails? Revert all     │     │
│     │ • Update canonical ledger   │     │
│     └─────────────────────────────┘     │
│                                         │
└─────────────────────────────────────────┘
```

**Why this matters**: Cross-VM routing enables atomic operations between EVM and SVM, ensuring data consistency and eliminating the need for complex bridging mechanisms.

## State Management

### Canonical Ledger Structure
The canonical ledger maintains a unified view of all VM states:

```
┌─────────────────────────────────────────────────────────┐
│                CANONICAL LEDGER                         │
├─────────────────────────────────────────────────────────┤
│                                                         │
│  Asset Registry                                         │
│  ┌─────────────┐ ┌─────────────┐ ┌─────────────────────┐ │
│  │ Asset ID    │ │ EVM Balance │ │ SVM Balance         │ │
│  │ 0xATLAS     │ │ 1,000,000   │ │ 500,000             │ │
│  │ 0xUSDC      │ │ 250,000     │ │ 750,000             │ │
│  │ 0xETH       │ │ 100         │ │ 0                   │ │
│  └─────────────┘ └─────────────┘ └─────────────────────┘ │
│                                                         │
│  Cross-VM State Map                                     │
│  ┌─────────────────────────────────────────────────────┐ │
│  │ Transaction: 0x1234...                              │ │
│  │ ├─ EVM State                                        │ │
│  │ │  ├─ Contract: 0xabcd...                           │ │
│  │ │  ├─ Storage: { key: value }                      │ │
│  │ │  └─ Events: [Transfer, Swap]                     │ │
│  │ └─ SVM State                                        │ │
│  │    ├─ Program: 0xef01...                           │ │
│  │    ├─ Accounts: [user, pool, treasury]             │ │
│  │    └─ Logs: [TradeExecuted, FeeCollected]          │ │
│  └─────────────────────────────────────────────────────┘ │
│                                                         │
│  Execution Results                                      │
│  ┌─────────────────────────────────────────────────────┐ │
│  │ Success: true                                       │ │
│  │ Gas Used: 150,000                                   │ │
│  │ Compute Units: 75,000                               │ │
│  │ Events: 4 total (2 EVM, 2 SVM)                     │ │
│  │ State Root: 0x5678...                               │ │
│  └─────────────────────────────────────────────────────┘ │
│                                                         │
└─────────────────────────────────────────────────────────┘
```

### State Synchronization
When cross-VM operations occur, the canonical ledger ensures consistency:

```
┌─────────────────────────────────────────┐
│        STATE SYNCHRONIZATION            │
├─────────────────────────────────────────┤
│                                         │
│  Step 1: EVM Execution                   │
│  ┌─────────────────────────────────┐   │
│  │ Contract A: balance -= 100      │   │
│  │ Contract B: balance += 100      │   │
│  │ Event: Transfer(100)            │   │
│  └─────────────────┬───────────────┘   │
│                    │                   │
│  Step 2: SVM Execution                   │
│  ┌─────────────────▼───────────────┐   │
│  │ Account X: lamports -= 50       │   │
│  │ Program Y: state += trade_data  │   │
│  │ Log: TradeExecuted(50)          │   │
│  └─────────────────┬───────────────┘   │
│                    │                   │
│  Step 3: Canonical Ledger Update        │
│  ┌─────────────────▼───────────────┐   │
│  │ Asset ATLAS:                    │   │
│  │   EVM:  1,000,000 -> 999,900    │   │
│  │   SVM:    500,000 -> 499,950    │   │
│  │   Total: 1,500,000 (preserved)  │   │
│  │                                 │   │
│  │ Cross-VM Transaction:           │   │
│  │   TX: 0x1234...                 │   │
│  │   Success: true                 │   │
│  │   Atomic: true                  │   │
│  └─────────────────────────────────┘   │
│                                         │
└─────────────────────────────────────────┘
```

## Performance Characteristics

### Throughput Analysis
| Component | EVM | SVM | Cross-VM |
|-----------|-----|-----|----------|
| **Sequential TPS** | ~1,000 | ~50,000 | ~5,000 |
| **Parallel TPS** | ~1,000 | ~200,000 | ~20,000 |
| **Block Time** | 6s | 6s | 6s |
| **Finality** | 12s | 12s | 12s |
| **Gas per TX** | ~150k | ~50k CU | ~200k + ~75k CU |

### Resource Allocation
```
┌─────────────────────────────────────────┐
│        BLOCK RESOURCE ALLOCATION        │
├─────────────────────────────────────────┤
│                                         │
│  Available per block:                   │
│  ┌─────────────────────────────────┐   │
│  │ Gas Limit: 30,000,000           │   │
│  │ CU Limit: 12,000,000            │   │
│  │ Storage: 1GB                    │   │
│  └─────────────────────────────────┘   │
│                                         │
│  Typical allocation:                     │
│  ┌─────────────┬─────────────┬─────────┐ │
│  │ EVM (
