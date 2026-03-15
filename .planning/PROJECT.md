# X3 Chain

## What This Is

X3 Chain is a next-generation blockchain execution layer that aims to deliver both high throughput and flexible VM support (EVM + SVM) for developers and validators. It combines a modular runtime, performant transaction processing, and modern tooling to make building on-chain applications easier.

## Core Value

Deliver a reliable, extensible blockchain execution engine that can run both EVM and SVM workloads with predictable performance.

## Requirements

### Validated

(None yet — ship to validate)

### Active

- [ ] Establish planning infrastructure (roadmap, requirements, state, phases)

### Out of Scope

- Full tokenomics and token launch (deferred until core chain is stable)

## Context

This repository contains the core node implementation, tooling, and documentation for the X3 Chain execution environment. The current focus is on building a predictable development process and establishing clear traceability between requirements and implementation.

## Constraints

- **Tech stack:** Rust (primary), with support for EVM (Frontier) and SVM (Solana components)
- **Timeline:** Initial milestone focuses on planning and foundational structure before major feature work

## Key Decisions

| Decision | Rationale | Outcome |
|----------|-----------|---------|
| Use GSD workflow for planning | Provides structured phase/plan tracking, audit capability, and repeatable execution | ✓ Good |

---
*Last updated: 2026-03-15 after bootstrapping planning artifacts*
