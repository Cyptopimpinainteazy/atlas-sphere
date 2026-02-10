# Atlas Sphere Documentation Index

> **Status**: Canonical | **Version**: 1.0.0 | **Last Updated**: 2025-12-10

**Master Index**: [docs/master/INDEX.md](master/INDEX.md)

## Complete Documentation Set

This index provides unified access to all canonical documentation for the Atlas Sphere blockchain platform, the X3 language, and the X3Script DSL.

---

## Quick Navigation

| Document                                                      | Purpose                       | Audience       |
| ------------------------------------------------------------- | ----------------------------- | -------------- |
| [X3 Language Specification](#x3-language-specification)       | Formal language definition    | Compiler devs  |
| [X3 Language Reference](#x3-language-reference)               | Practical guide with examples | All developers |
| [Tri-VM Architecture](#tri-vm-architecture)                   | EVM+SVM+X3 integration        | Core devs      |
| [X3Script DSL Specification](#x3script-dsl-specification)     | High-level DSL for contracts  | Contract devs  |
| [AI Agent API Specification](#ai-agent-api-specification)     | Autonomous agent framework    | Agent devs     |
| [Standard Library Reference](#standard-library-reference)     | 12-module stdlib              | All developers |
| [Quantum Execution Whitepaper](#quantum-execution-whitepaper) | Speculative execution model   | Advanced users |

---

## 1. X3 Language Specification

**File:** [`docs/X3_LANGUAGE_SPECIFICATION.md`](./X3_LANGUAGE_SPECIFICATION.md)

**Purpose:** Complete formal specification of the X3 programming language.

**Key Topics:**
- Type system (primitives, arrays, structs, enums)
- Memory model (4 domains: register/stack/heap/global)
- Control flow (branches, loops, function calls)
- Built-in functions and hostcalls
- Bytecode model and instruction encoding
- 16-pass compilation pipeline

**Audience:** Compiler developers, VM implementers, language contributors

**Prerequisites:** Understanding of low-level programming, familiarity with assembly concepts

---

## 2. X3 Language Reference

**File:** [`docs/X3_LANGUAGE_REFERENCE.md`](./X3_LANGUAGE_REFERENCE.md)

**Purpose:** Practical developer reference with working examples.

**Key Topics:**
- AtomicSwap example walkthrough
- Grammar sketch (BNF-style)
- Glossary of 40+ terms
- Frequently asked questions
- Porting guide from Solidity/Rust

**Audience:** All developers writing X3 code

**Prerequisites:** Basic programming knowledge

---

## 3. Tri-VM Architecture

**File:** [`docs/TRI_VM_ARCHITECTURE.md`](./TRI_VM_ARCHITECTURE.md)

**Purpose:** Technical specification for multi-VM execution.

**Key Topics:**
- Three-VM unified execution model
- EVM integration (Frontier-based)
- SVM integration (solana-rbpf)
- X3 native VM execution
- Atomic cross-VM transactions (Comit)
- Warp engine speculative execution
- Cross-VM ABI and message passing
- Canonical ledger unification

**Audience:** Core developers, protocol engineers

**Prerequisites:** Understanding of EVM/SVM, blockchain consensus

---

## 4. X3Script DSL Specification

**File:** [`docs/X3SCRIPT_DSL_SPECIFICATION.md`](./X3SCRIPT_DSL_SPECIFICATION.md)

**Purpose:** High-level domain-specific language for smart contracts.

**Key Topics:**
- Module system and imports
- Function and task definitions
- Storage declarations and memory regions
- Cross-VM hostcalls (evm.call, svm.invoke)
- AI-specific constructs (agent, strategy)
- Safety rules and invariants
- Complete ArbBot example

**Audience:** Smart contract developers

**Prerequisites:** Basic programming, familiarity with DeFi concepts

---

## 5. AI Agent API Specification

**File:** [`docs/AI_AGENT_API_SPECIFICATION.md`](./AI_AGENT_API_SPECIFICATION.md)

**Purpose:** Framework for autonomous AI-powered agents.

**Key Topics:**
- Agent anatomy (file structure, manifest)
- Four program unit types: contract, agent, strategy, kernel
- Runtime API (hooks, lifecycle, IPC)
- Evolution engine (mutation, crossover, selection)
- Strategy system (prioritization, triggers, conditions)
- Predictive execution and resource management
- Multi-agent coordination (swarms, consensus)
- Security model and sandboxing

**Audience:** AI agent developers, DeFi strategists

**Prerequisites:** X3Script knowledge, ML/optimization familiarity helpful

---

## 6. Standard Library Reference

**File:** [`docs/X3SCRIPT_STDLIB_REFERENCE.md`](./X3SCRIPT_STDLIB_REFERENCE.md)

**Purpose:** Complete reference for the 12-module standard library.

**Modules:**

| Module      | Purpose        | Key Functions                                            |
| ----------- | -------------- | -------------------------------------------------------- |
| `core`      | Primitives     | `assert`, `require`, `keccak256`                         |
| `token`     | ERC20/SPL      | `transfer`, `approve`, `balance_of`                      |
| `dex`       | DEX operations | `get_price`, `swap_exact_in`, `add_liquidity`            |
| `flashloan` | Flash loans    | `borrow`, `multi_borrow`, `repay`                        |
| `oracle`    | Price feeds    | `get_price`, `get_twap`, `check_freshness`               |
| `vault`     | Yield vaults   | `deposit`, `withdraw`, `harvest`                         |
| `bridge`    | Cross-chain    | `initiate_transfer`, `claim`, `verify_proof`             |
| `agent`     | Agent runtime  | `spawn`, `send`, `receive`, `mutate`                     |
| `ai`        | AI/ML          | `predict`, `train_online`, `neural_forward`              |
| `zk`        | Zero-knowledge | `verify_groth16`, `commit`, `reveal`                     |
| `safety`    | Security       | `check_reentrancy`, `validate_oracle`, `assert_slippage` |
| `devtools`  | Development    | `log`, `trace`, `measure_gas`, `dump_state`              |

**Audience:** All X3Script developers

**Prerequisites:** X3Script basics

---

## 7. Quantum Execution Whitepaper

**File:** [`docs/QUANTUM_EXECUTION_WHITEPAPER.md`](./QUANTUM_EXECUTION_WHITEPAPER.md)

**Purpose:** Theoretical foundation for speculative parallel execution.

**Key Topics:**
- Superposition model (multiple execution paths)
- Collapse mechanics (path selection)
- Probabilistic execution and branching
- Warp engine architecture
- Runtime adaptation and optimization
- Performance analysis and benchmarks
- Security considerations

**Audience:** Advanced developers, researchers

**Prerequisites:** Strong CS fundamentals, probability theory

---

## Documentation by Use Case

### Getting Started
1. **New to Atlas Sphere?** → Start with [X3 Language Reference](#x3-language-reference)
2. **Writing your first contract?** → [X3Script DSL Specification](#x3script-dsl-specification)
3. **Using the stdlib?** → [Standard Library Reference](#standard-library-reference)

### Building DeFi Applications
1. [X3Script DSL Specification](#x3script-dsl-specification) — Contract structure
2. [Standard Library Reference](#standard-library-reference) — `dex`, `flashloan`, `oracle` modules
3. [Tri-VM Architecture](#tri-vm-architecture) — Cross-VM interactions

### Building AI Agents
1. [AI Agent API Specification](#ai-agent-api-specification) — Agent framework
2. [Standard Library Reference](#standard-library-reference) — `agent`, `ai` modules
3. [Quantum Execution Whitepaper](#quantum-execution-whitepaper) — Speculative strategies

### Core Development
1. [X3 Language Specification](#x3-language-specification) — Language internals
2. [Tri-VM Architecture](#tri-vm-architecture) — VM integration
3. [Quantum Execution Whitepaper](#quantum-execution-whitepaper) — Warp engine

### Contract Auditing
1. [X3 Language Specification](#x3-language-specification) — Type safety rules
2. [Standard Library Reference](#standard-library-reference) — `safety` module
3. [AI Agent API Specification](#ai-agent-api-specification) — Security model

---

## Architecture Overview

```
┌─────────────────────────────────────────────────────────────────────┐
│                        ATLAS SPHERE STACK                           │
├─────────────────────────────────────────────────────────────────────┤
│                                                                     │
│  ┌─────────────────────────────────────────────────────────────┐   │
│  │                    X3SCRIPT DSL LAYER                        │   │
│  │  Docs: X3Script DSL Spec, AI Agent API, Stdlib Reference    │   │
│  └─────────────────────────────────────────────────────────────┘   │
│                              │                                      │
│                              ▼                                      │
│  ┌─────────────────────────────────────────────────────────────┐   │
│  │                     X3 LANGUAGE LAYER                        │   │
│  │  Docs: X3 Language Spec, X3 Language Reference              │   │
│  └─────────────────────────────────────────────────────────────┘   │
│                              │                                      │
│                              ▼                                      │
│  ┌─────────────────────────────────────────────────────────────┐   │
│  │                    EXECUTION LAYER                           │   │
│  │  ┌───────────┐  ┌───────────┐  ┌───────────┐               │   │
│  │  │    EVM    │  │    SVM    │  │    X3     │               │   │
│  │  │  Adapter  │  │  Adapter  │  │    VM     │               │   │
│  │  └───────────┘  └───────────┘  └───────────┘               │   │
│  │  Docs: Tri-VM Architecture, Quantum Execution Whitepaper    │   │
│  └─────────────────────────────────────────────────────────────┘   │
│                              │                                      │
│                              ▼                                      │
│  ┌─────────────────────────────────────────────────────────────┐   │
│  │                   SUBSTRATE RUNTIME                          │   │
│  │  Atlas Kernel Pallet • Consensus (Aura+GRANDPA)             │   │
│  └─────────────────────────────────────────────────────────────┘   │
│                                                                     │
└─────────────────────────────────────────────────────────────────────┘
```

---

## Version History

| Version | Date       | Changes                   |
| ------- | ---------- | ------------------------- |
| 1.0.0   | 2025-12-10 | Initial canonical release |

---

## Related Resources

### In-Repository
- [`/pallets/atlas-kernel/`](../pallets/atlas-kernel/) — Core pallet implementation
- [`/runtime/src/lib.rs`](../runtime/src/lib.rs) — Runtime composition
- [`/crates/evm-integration/`](../crates/evm-integration/) — EVM adapter
- [`/crates/svm-integration/`](../crates/svm-integration/) — SVM adapter
- [`/apps/`](../apps/) — Frontend applications

### External
- [Substrate Documentation](https://docs.substrate.io/)
- [Frontier (EVM)](https://github.com/polkadot-evm/frontier)
- [Solana BPF](https://github.com/solana-labs/rbpf)

---

## Contributing

Documentation improvements welcome! See the main project's contributing guidelines.

For questions: [Atlas Sphere Discord/Forums]

---

**Document Version:** 1.0.0  
**Specification Status:** Canonical  
**Maintainer:** Atlas Sphere Core Engineering
