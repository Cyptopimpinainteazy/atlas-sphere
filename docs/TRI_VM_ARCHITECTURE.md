# Tri-VM Architecture Document v1.0

> **Status**: Canonical | **Version**: 1.0.0 | **Last Updated**: 2025-12-10

This document defines how Atlas Sphere merges EVM + SVM + X3 into one unified execution organism.

---

## Table of Contents

1. [Architecture Overview](#1-architecture-overview)
2. [VM Layers](#2-vm-layers)
3. [Atomic Multi-VM Execution](#3-atomic-multi-vm-execution)
4. [Warp Engine](#4-warp-engine)
5. [Cross-VM ABI](#5-cross-vm-abi)
6. [State Management](#6-state-management)
7. [Gas Metering](#7-gas-metering)
8. [Security Model](#8-security-model)

---

## 1. Architecture Overview

### 1.1 The Tri-VM Vision

Atlas Sphere is the first blockchain to natively execute three virtual machines in a single, atomic transaction context:

```
┌─────────────────────────────────────────────────────────────────────┐
│                      ATLAS SPHERE RUNTIME                           │
├─────────────────────────────────────────────────────────────────────┤
│                                                                     │
│  ┌─────────────┐    ┌─────────────┐    ┌─────────────┐             │
│  │    EVM      │    │    SVM      │    │    X3       │             │
│  │             │    │             │    │             │             │
│  │  Solidity   │◄──►│   Solana    │◄──►│  Native     │             │
│  │  Vyper      │    │   Programs  │    │  Bytecode   │             │
│  │  ABI        │    │   BPF       │    │  Warp       │             │
│  └─────────────┘    └─────────────┘    └─────────────┘             │
│         │                  │                  │                     │
│         └──────────────────┼──────────────────┘                     │
│                            │                                        │
│                   ┌────────▼────────┐                               │
│                   │  UNIFIED STATE  │                               │
│                   │    MANAGER      │                               │
│                   └────────┬────────┘                               │
│                            │                                        │
│                   ┌────────▼────────┐                               │
│                   │ CANONICAL LEDGER│                               │
│                   └─────────────────┘                               │
│                                                                     │
└─────────────────────────────────────────────────────────────────────┘
```

### 1.2 Design Principles

| Principle            | Description                                                 |
| -------------------- | ----------------------------------------------------------- |
| **Atomicity**        | All VM operations in a transaction succeed or all revert    |
| **Interoperability** | Any VM can call any other VM seamlessly                     |
| **Determinism**      | Identical inputs produce identical outputs across all nodes |
| **Composability**    | Contracts across VMs can be composed like LEGO blocks       |
| **Efficiency**       | Route computation to the optimal VM for each task           |

### 1.3 Why Three VMs?

Each VM has unique strengths:

| VM      | Strength                | Use Case                                 |
| ------- | ----------------------- | ---------------------------------------- |
| **EVM** | Ecosystem compatibility | DeFi, tokens, existing contracts         |
| **SVM** | Parallel execution      | High-throughput, zone-based processing   |
| **X3**  | Optimized compute       | AI agents, arbitrage, complex algorithms |

---

## 2. VM Layers

### 2.1 EVM Layer (Ethereum Virtual Machine)

The EVM layer provides full Ethereum compatibility via Frontier integration.

**Capabilities:**
- Full EVM opcode support (London fork)
- Solidity/Vyper contract deployment
- Standard Ethereum ABI encoding
- ERC-20, ERC-721, ERC-1155 support
- Web3/Ethers.js compatibility

**Configuration:**
```rust
// Runtime EVM configuration
impl pallet_evm::Config for Runtime {
    type FeeCalculator = BaseFee;
    type GasWeightMapping = AtlasGasWeightMapping;
    type BlockHashMapping = EthereumBlockHashMapping;
    type CallOrigin = EnsureAddressTruncated;
    type WithdrawOrigin = EnsureAddressTruncated;
    type AddressMapping = HashedAddressMapping<BlakeTwo256>;
    type Currency = Balances;
    type RuntimeEvent = RuntimeEvent;
    type PrecompiledContracts = AtlasPrecompiles;
    type ChainId = ChainId;
    type BlockGasLimit = BlockGasLimit;
    type Runner = pallet_evm::runner::stack::Runner<Self>;
    type OnChargeTransaction = EVMCurrencyAdapter<Balances>;
}
```

**Address Space:**
```
EVM addresses: 0x0000...0000 to 0xFFFF...FFFF (20 bytes)
Mapped to SS58 via: blake2_256(evm_address)[0..32]
```

### 2.2 SVM Layer (Solana Virtual Machine)

The SVM layer provides Solana program execution via rBPF.

**Capabilities:**
- Solana BPF program execution
- Account-based state model
- Zone-based parallel execution
- Sealevel runtime compatibility
- Anchor framework support

**Execution Model:**
```
┌─────────────────────────────────────────────────┐
│                SVM EXECUTOR                      │
├─────────────────────────────────────────────────┤
│  ┌──────────┐  ┌──────────┐  ┌──────────┐      │
│  │  Zone 1  │  │  Zone 2  │  │  Zone 3  │      │
│  │  Tx A    │  │  Tx B    │  │  Tx C    │      │
│  │  Tx D    │  │  Tx E    │  │  Tx F    │      │
│  └──────────┘  └──────────┘  └──────────┘      │
│       │             │             │             │
│       └─────────────┼─────────────┘             │
│                     ▼                           │
│            PARALLEL COMMIT                      │
└─────────────────────────────────────────────────┘
```

**Zone Isolation:**
- Transactions touching disjoint accounts execute in parallel
- Conflict detection at account granularity
- Automatic zone assignment by scheduler

### 2.3 X3 Layer (Native Bytecode VM)

The X3 layer is the native, optimized execution environment.

**Capabilities:**
- 16-pass optimized bytecode execution
- Warp engine for speculative execution
- Direct memory control
- AI agent runtime support
- Flash loan primitives
- Atomic swap operations

**Execution Stack:**
```
┌─────────────────────────────────────────────────┐
│                 X3 EXECUTOR                      │
├─────────────────────────────────────────────────┤
│                                                 │
│  ┌───────────────────────────────────────────┐  │
│  │           WARP ENGINE                     │  │
│  │  ┌─────────┐ ┌─────────┐ ┌─────────┐     │  │
│  │  │ Path 1  │ │ Path 2  │ │ Path 3  │     │  │
│  │  └────┬────┘ └────┬────┘ └────┬────┘     │  │
│  │       └───────────┼───────────┘          │  │
│  │                   ▼                      │  │
│  │           BEST PATH SELECTOR             │  │
│  └───────────────────────────────────────────┘  │
│                      │                          │
│                      ▼                          │
│  ┌───────────────────────────────────────────┐  │
│  │         BYTECODE INTERPRETER              │  │
│  │  Registers │ Stack │ Heap │ Globals       │  │
│  └───────────────────────────────────────────┘  │
│                                                 │
└─────────────────────────────────────────────────┘
```

---

## 3. Atomic Multi-VM Execution

### 3.1 Transaction Flow

A single Atlas Sphere transaction can span all three VMs:

```
┌─────────────────────────────────────────────────────────────────────┐
│                    MULTI-VM TRANSACTION                              │
├─────────────────────────────────────────────────────────────────────┤
│                                                                      │
│  Step 1: EVM Pre-Check                                              │
│  ┌──────────────────────────────────────────────┐                   │
│  │ contract Guard {                              │                   │
│  │   function preCheck() returns (bool) {       │                   │
│  │     require(balanceOf(msg.sender) > 1000);   │                   │
│  │     return true;                              │                   │
│  │   }                                           │                   │
│  │ }                                             │                   │
│  └──────────────────────────────────────────────┘                   │
│                         │                                            │
│                         ▼                                            │
│  Step 2: X3 Heavy Compute                                           │
│  ┌──────────────────────────────────────────────┐                   │
│  │ fn compute_optimal_route(                    │                   │
│  │     pools: [Pool; 10],                       │                   │
│  │     amount: u128                              │                   │
│  │ ) -> Route {                                  │                   │
│  │     // Complex pathfinding algorithm         │                   │
│  │     warp {                                    │                   │
│  │         path1 { bellman_ford(pools) }        │                   │
│  │         path2 { dijkstra(pools) }            │                   │
│  │         path3 { a_star(pools) }              │                   │
│  │     }                                         │                   │
│  │ }                                             │                   │
│  └──────────────────────────────────────────────┘                   │
│                         │                                            │
│                         ▼                                            │
│  Step 3: SVM Parallel Execution                                     │
│  ┌──────────────────────────────────────────────┐                   │
│  │ // Execute swaps in parallel zones           │                   │
│  │ Zone 1: swap(pool_a, USDC, ETH)             │                   │
│  │ Zone 2: swap(pool_b, ETH, ATLAS)            │                   │
│  │ Zone 3: swap(pool_c, ATLAS, USDC)           │                   │
│  └──────────────────────────────────────────────┘                   │
│                         │                                            │
│                         ▼                                            │
│  Step 4: EVM Final Settlement                                       │
│  ┌──────────────────────────────────────────────┐                   │
│  │ contract Settlement {                         │                   │
│  │   function finalize(uint profit) {           │                   │
│  │     require(profit > minProfit);             │                   │
│  │     treasury.deposit(profit);                │                   │
│  │     emit ArbitrageComplete(profit);          │                   │
│  │   }                                           │                   │
│  │ }                                             │                   │
│  └──────────────────────────────────────────────┘                   │
│                                                                      │
└─────────────────────────────────────────────────────────────────────┘
```

### 3.2 Atomicity Guarantee

**If ANY step fails, ALL steps revert:**

```rust
pub fn execute_multi_vm_transaction(
    tx: MultiVmTransaction,
) -> Result<Receipt, ExecutionError> {
    // Create savepoint
    let snapshot = state.snapshot();
    
    // Execute all VM calls
    for call in tx.calls {
        let result = match call.vm {
            VM::EVM => evm_executor.execute(call),
            VM::SVM => svm_executor.execute(call),
            VM::X3  => x3_executor.execute(call),
        };
        
        if result.is_err() {
            // Revert ALL changes
            state.revert_to(snapshot);
            return Err(result.unwrap_err());
        }
    }
    
    // Commit all changes atomically
    state.commit();
    Ok(Receipt::success())
}
```

### 3.3 Cross-VM Call Protocol

```
┌─────────────────────────────────────────────────────────────────────┐
│                    CROSS-VM CALL FLOW                                │
├─────────────────────────────────────────────────────────────────────┤
│                                                                      │
│  EVM Contract                                                        │
│       │                                                              │
│       │ x3_call(target, method, args)                               │
│       ▼                                                              │
│  ┌─────────────────────────────────────────┐                        │
│  │          BRIDGE PRECOMPILE              │                        │
│  │  Address: 0x0000...0800                 │                        │
│  │  - Encode call data                     │                        │
│  │  - Transfer context                     │                        │
│  │  - Handle return values                 │                        │
│  └─────────────────────────────────────────┘                        │
│       │                                                              │
│       │ native_call(X3_VM, encoded_call)                            │
│       ▼                                                              │
│  ┌─────────────────────────────────────────┐                        │
│  │           X3 EXECUTOR                   │                        │
│  │  - Decode arguments                     │                        │
│  │  - Execute X3 bytecode                  │                        │
│  │  - Encode return value                  │                        │
│  └─────────────────────────────────────────┘                        │
│       │                                                              │
│       │ return encoded_result                                        │
│       ▼                                                              │
│  EVM Contract (continues)                                            │
│                                                                      │
└─────────────────────────────────────────────────────────────────────┘
```

---

## 4. Warp Engine

### 4.1 Quantum-Like Execution Model

The Warp Engine enables speculative parallel execution of multiple code paths:

```x3
// X3 Warp syntax
warp {
    path1 {
        // Strategy A: Direct swap
        let out = swap(uniswap, USDC, ETH, amount);
        return out;
    }
    path2 {
        // Strategy B: Two-hop
        let mid = swap(curve, USDC, DAI, amount);
        let out = swap(sushi, DAI, ETH, mid);
        return out;
    }
    path3 {
        // Strategy C: Flash + arb
        flash(aave, ETH, 1000, |loan| {
            let profit = arbitrage(loan);
            return loan + profit;
        });
    }
}
```

### 4.2 Warp Execution Flow

```
┌─────────────────────────────────────────────────────────────────────┐
│                      WARP ENGINE                                     │
├─────────────────────────────────────────────────────────────────────┤
│                                                                      │
│  Phase 1: SUPERPOSITION                                             │
│  ┌─────────────────────────────────────────────────────────────┐    │
│  │  All paths execute in parallel with isolated state snapshots │    │
│  │                                                               │    │
│  │  ┌─────────┐    ┌─────────┐    ┌─────────┐                   │    │
│  │  │ Path 1  │    │ Path 2  │    │ Path 3  │                   │    │
│  │  │ State A │    │ State B │    │ State C │                   │    │
│  │  │ Gas: 50k│    │ Gas: 80k│    │ Gas: 120k│                  │    │
│  │  │ PnL: +5%│    │ PnL: +8%│    │ PnL: +12%│                  │    │
│  │  └─────────┘    └─────────┘    └─────────┘                   │    │
│  └─────────────────────────────────────────────────────────────┘    │
│                              │                                       │
│                              ▼                                       │
│  Phase 2: EVALUATION                                                 │
│  ┌─────────────────────────────────────────────────────────────┐    │
│  │  Score each path:                                             │    │
│  │  score = (profit * profit_weight) -                          │    │
│  │          (gas * gas_weight) +                                 │    │
│  │          (success_probability * prob_weight)                  │    │
│  │                                                               │    │
│  │  Path 1: score = 45                                          │    │
│  │  Path 2: score = 62                                          │    │
│  │  Path 3: score = 78  ← WINNER                                │    │
│  └─────────────────────────────────────────────────────────────┘    │
│                              │                                       │
│                              ▼                                       │
│  Phase 3: COLLAPSE                                                   │
│  ┌─────────────────────────────────────────────────────────────┐    │
│  │  - Discard losing paths                                       │    │
│  │  - Commit winning path's state changes                        │    │
│  │  - Return winning path's result                               │    │
│  └─────────────────────────────────────────────────────────────┘    │
│                                                                      │
└─────────────────────────────────────────────────────────────────────┘
```

### 4.3 Warp Configuration

```rust
pub struct WarpConfig {
    /// Maximum number of parallel paths
    pub max_paths: u32,  // Default: 8
    
    /// Maximum gas per path
    pub path_gas_limit: u64,  // Default: 1_000_000
    
    /// Scoring weights
    pub profit_weight: f64,  // Default: 0.5
    pub gas_weight: f64,     // Default: 0.3
    pub prob_weight: f64,    // Default: 0.2
    
    /// Timeout per path (milliseconds)
    pub path_timeout_ms: u64,  // Default: 100
}
```

### 4.4 Warp Safety Rules

1. **Isolation**: Each path has its own state snapshot
2. **Determinism**: Path selection must be deterministic across nodes
3. **Gas Accounting**: Total gas = sum of all paths (worst case)
4. **No Side Effects**: Losing paths cannot emit events or modify external state

---

## 5. Cross-VM ABI

### 5.1 Unified ABI Layer

All cross-VM calls use a standardized encoding:

```
┌────────────────────────────────────────────────────────────────────┐
│                    UNIFIED ABI ENCODING                             │
├────────────────────────────────────────────────────────────────────┤
│                                                                     │
│  Header (32 bytes):                                                │
│  ┌──────────┬──────────┬──────────┬──────────┐                     │
│  │ Version  │ Target VM│ Method ID│ Reserved │                     │
│  │ (4 bytes)│ (4 bytes)│ (8 bytes)│ (16 bytes│                     │
│  └──────────┴──────────┴──────────┴──────────┘                     │
│                                                                     │
│  Arguments (variable):                                              │
│  ┌──────────┬──────────┬──────────────────────┐                    │
│  │ Arg Count│ Type Tags│ Encoded Values       │                    │
│  │ (4 bytes)│ (n bytes)│ (variable)           │                    │
│  └──────────┴──────────┴──────────────────────┘                    │
│                                                                     │
└────────────────────────────────────────────────────────────────────┘
```

### 5.2 VM Identifiers

```rust
pub enum VmId {
    EVM = 0x01,
    SVM = 0x02,
    X3  = 0x03,
}
```

### 5.3 Type Mapping

| X3 Type   | EVM Type  | SVM Type   |
| --------- | --------- | ---------- |
| `u8`      | `uint8`   | `u8`       |
| `u64`     | `uint64`  | `u64`      |
| `u128`    | `uint128` | `u128`     |
| `u256`    | `uint256` | `[u64; 4]` |
| `address` | `address` | `Pubkey`   |
| `bytes`   | `bytes`   | `Vec<u8>`  |
| `bool`    | `bool`    | `bool`     |

### 5.4 Cross-VM Call Examples

**EVM calling X3:**
```solidity
// Solidity
interface IX3Bridge {
    function callX3(
        bytes32 target,
        bytes calldata method,
        bytes calldata args
    ) external returns (bytes memory);
}

contract MyContract {
    IX3Bridge bridge = IX3Bridge(0x0000...0800);
    
    function useX3() external {
        bytes memory result = bridge.callX3(
            x3_contract_id,
            "compute_route",
            abi.encode(pools, amount)
        );
        // Process result
    }
}
```

**X3 calling EVM:**
```x3
// X3
fn call_evm_contract() -> u128 {
    let result = evm_call(
        0x1234...5678,  // EVM contract address
        "balanceOf",    // Method
        (tx.sender,)    // Arguments
    );
    return decode<u128>(result);
}
```

**X3 calling SVM:**
```x3
// X3
fn call_solana_program() -> bytes {
    let accounts = [
        AccountMeta { pubkey: pool_account, is_signer: false, is_writable: true },
        AccountMeta { pubkey: user_account, is_signer: true, is_writable: true },
    ];
    
    let result = svm_call(
        raydium_program_id,
        "swap",
        accounts,
        swap_instruction_data
    );
    
    return result;
}
```

---

## 6. State Management

### 6.1 Unified State Tree

```
┌─────────────────────────────────────────────────────────────────────┐
│                    ATLAS SPHERE STATE                                │
├─────────────────────────────────────────────────────────────────────┤
│                                                                      │
│  Root Hash                                                           │
│       │                                                              │
│       ├── EVM State                                                  │
│       │   ├── Account 0x1234...                                     │
│       │   │   ├── nonce                                             │
│       │   │   ├── balance                                           │
│       │   │   ├── code_hash                                         │
│       │   │   └── storage_root                                      │
│       │   └── Account 0x5678...                                     │
│       │                                                              │
│       ├── SVM State                                                  │
│       │   ├── Account Abc123...                                     │
│       │   │   ├── lamports                                          │
│       │   │   ├── data                                              │
│       │   │   ├── owner                                             │
│       │   │   └── executable                                        │
│       │   └── Account Def456...                                     │
│       │                                                              │
│       └── X3 State                                                   │
│           ├── Global Slot 0                                         │
│           ├── Global Slot 1                                         │
│           ├── Heap Region 0x1000-0x2000                             │
│           └── Agent Memory                                           │
│                                                                      │
└─────────────────────────────────────────────────────────────────────┘
```

### 6.2 State Isolation

Each VM maintains its own state namespace:

```rust
pub struct StateManager {
    /// EVM state (Patricia-Merkle trie)
    evm_state: EvmState,
    
    /// SVM state (account-based)
    svm_state: SvmState,
    
    /// X3 state (slot-based globals + heap)
    x3_state: X3State,
    
    /// Cross-VM bridges (canonical ledger)
    bridge_state: BridgeState,
}
```

### 6.3 Cross-VM Asset Transfers

Assets can flow between VMs through the Canonical Ledger:

```
┌─────────────────────────────────────────────────────────────────────┐
│                    CANONICAL LEDGER                                  │
├─────────────────────────────────────────────────────────────────────┤
│                                                                      │
│  Asset ID: 0x0001 (Native ATLAS)                                    │
│  ┌─────────────────────────────────────────────────────────────┐    │
│  │ EVM Balance:  1,000,000 ATLAS                               │    │
│  │ SVM Balance:    500,000 ATLAS                               │    │
│  │ X3 Balance:     250,000 ATLAS                               │    │
│  │ ─────────────────────────────────────                       │    │
│  │ Total Supply: 1,750,000 ATLAS ✓                             │    │
│  └─────────────────────────────────────────────────────────────┘    │
│                                                                      │
│  Transfer: EVM → X3                                                  │
│  ┌─────────────────────────────────────────────────────────────┐    │
│  │ 1. Lock 100 ATLAS in EVM bridge contract                    │    │
│  │ 2. Update Canonical Ledger                                   │    │
│  │ 3. Credit 100 ATLAS to X3 global storage                    │    │
│  │ 4. Emit CrossVmTransfer event                               │    │
│  └─────────────────────────────────────────────────────────────┘    │
│                                                                      │
└─────────────────────────────────────────────────────────────────────┘
```

---

## 7. Gas Metering

### 7.1 Unified Gas Model

All VMs use a unified gas model for fair resource accounting:

```rust
pub struct GasConfig {
    // Base costs
    pub base_tx_cost: u64,           // 21,000
    pub cross_vm_call_cost: u64,     // 10,000
    pub warp_path_overhead: u64,     // 5,000 per path
    
    // EVM costs (Ethereum-compatible)
    pub evm_sload: u64,              // 2,100
    pub evm_sstore: u64,             // 20,000
    pub evm_call: u64,               // 2,600
    
    // SVM costs (compute units → gas)
    pub svm_cu_to_gas_ratio: u64,    // 1 CU = 10 gas
    
    // X3 costs
    pub x3_instruction: u64,         // 3 gas per instruction
    pub x3_memory_page: u64,         // 100 gas per 4KB page
    pub x3_global_read: u64,         // 200 gas
    pub x3_global_write: u64,        // 5,000 gas
}
```

### 7.2 Gas Calculation

```
Total Gas = Base Cost 
          + Σ(EVM operations) 
          + Σ(SVM compute units) × conversion_rate
          + Σ(X3 instructions) × instruction_cost
          + Cross-VM call overhead × num_calls
          + Warp overhead × num_paths
```

### 7.3 Gas Limits

| Scope                 | Limit              |
| --------------------- | ------------------ |
| Block gas limit       | 30,000,000         |
| Transaction gas limit | 10,000,000         |
| Cross-VM call limit   | 1,000,000          |
| Warp path limit       | 1,000,000 per path |

---

## 8. Security Model

### 8.1 Isolation Guarantees

```
┌─────────────────────────────────────────────────────────────────────┐
│                    SECURITY BOUNDARIES                               │
├─────────────────────────────────────────────────────────────────────┤
│                                                                      │
│  ┌─────────────────────────────────────────────────────────────┐    │
│  │                    VM SANDBOX                                │    │
│  │  Each VM executes in isolated memory space                   │    │
│  │  - No direct memory access between VMs                       │    │
│  │  - All communication via ABI-encoded messages                │    │
│  │  - Capability-based access control                           │    │
│  └─────────────────────────────────────────────────────────────┘    │
│                                                                      │
│  ┌─────────────────────────────────────────────────────────────┐    │
│  │                    STATE ISOLATION                           │    │
│  │  Each VM has separate state namespace                        │    │
│  │  - EVM cannot read SVM accounts directly                     │    │
│  │  - X3 cannot modify EVM storage directly                     │    │
│  │  - All state changes go through bridge contracts             │    │
│  └─────────────────────────────────────────────────────────────┘    │
│                                                                      │
│  ┌─────────────────────────────────────────────────────────────┐    │
│  │                    ATOMIC COMMIT                             │    │
│  │  All-or-nothing transaction semantics                        │    │
│  │  - Failure in any VM reverts all VMs                         │    │
│  │  - No partial state updates visible                          │    │
│  │  - Deterministic rollback                                    │    │
│  └─────────────────────────────────────────────────────────────┘    │
│                                                                      │
└─────────────────────────────────────────────────────────────────────┘
```

### 8.2 Reentrancy Protection

```rust
pub struct ReentrancyGuard {
    /// Current call depth per VM
    evm_depth: u32,
    svm_depth: u32,
    x3_depth: u32,
    
    /// Maximum allowed depth
    max_depth: u32,  // Default: 64
    
    /// Cross-VM reentrancy tracking
    cross_vm_calls: Vec<(VmId, VmId)>,
}

impl ReentrancyGuard {
    pub fn check_reentrancy(&self, from: VmId, to: VmId) -> Result<(), Error> {
        // Detect circular cross-VM calls
        if self.cross_vm_calls.contains(&(to, from)) {
            return Err(Error::ReentrancyDetected);
        }
        Ok(())
    }
}
```

### 8.3 Audit Considerations

| Area           | Risk            | Mitigation                      |
| -------------- | --------------- | ------------------------------- |
| Cross-VM calls | Type confusion  | Strict ABI validation           |
| Warp execution | Non-determinism | Deterministic scoring algorithm |
| State bridges  | Double-spend    | Atomic commit protocol          |
| Gas metering   | DoS attacks     | Conservative gas pricing        |
| Memory access  | Buffer overflow | Bounds checking in all VMs      |

---

## Appendix A: Precompile Addresses

| Address         | Name        | Description            |
| --------------- | ----------- | ---------------------- |
| `0x0000...0001` | ECRECOVER   | Signature recovery     |
| `0x0000...0002` | SHA256      | SHA-256 hash           |
| `0x0000...0003` | RIPEMD160   | RIPEMD-160 hash        |
| `0x0000...0004` | IDENTITY    | Data copy              |
| `0x0000...0005` | MODEXP      | Modular exponentiation |
| `0x0000...0800` | X3_BRIDGE   | Cross-VM bridge to X3  |
| `0x0000...0801` | SVM_BRIDGE  | Cross-VM bridge to SVM |
| `0x0000...0802` | WARP_INVOKE | Warp engine trigger    |
| `0x0000...0803` | FLASH_LOAN  | Flash loan primitive   |
| `0x0000...0804` | ATOMIC_SWAP | Atomic swap primitive  |

---

## Appendix B: Error Codes

| Code   | Name                   | Description                          |
| ------ | ---------------------- | ------------------------------------ |
| `0x01` | `VM_EXECUTION_FAILED`  | VM execution error                   |
| `0x02` | `CROSS_VM_CALL_FAILED` | Cross-VM call failed                 |
| `0x03` | `INVALID_VM_TARGET`    | Unknown VM identifier                |
| `0x04` | `ABI_DECODE_ERROR`     | Failed to decode arguments           |
| `0x05` | `REENTRANCY_ERROR`     | Reentrancy detected                  |
| `0x06` | `WARP_PATH_FAILED`     | All warp paths failed                |
| `0x07` | `GAS_EXHAUSTED`        | Out of gas                           |
| `0x08` | `STATE_CONFLICT`       | State conflict in parallel execution |
| `0x09` | `BRIDGE_LOCKED`        | Bridge asset locked                  |
| `0x0A` | `INVALID_SIGNATURE`    | Invalid transaction signature        |

---

**Document Version:** 1.0.0  
**Specification Status:** Canonical  
**Maintainer:** Atlas Sphere Core Engineering
