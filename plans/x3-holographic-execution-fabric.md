# X3 Holographic Execution Fabric

## Purpose

This plan turns X3 from a monolithic executor into a root-finalized execution fabric:

- one canonical chain
- many deterministic execution cells
- one proof bus
- explicit cross-cell atomicity only when required
- global consensus on roots, dependencies, and disputes rather than raw transaction grind

This is a production architecture plan, not a benchmark story. Every stage must preserve deterministic replay, canonical safety, and truthful measurement.

## North Star

X3 should optimize for three honest throughput numbers:

1. `Ingress TPS` - accepted operations entering execution cells
2. `Settled Receipt TPS` - operations with durable inclusion proofs
3. `Canonical State-Transition TPS` - final irreversible net state transitions after compression

Claims about scale are invalid unless all three are reported together.

## Core Model

### Canonical Chain

The canonical chain does not directly execute all user transactions.

It finalizes:

- ordered cell batch roots
- dependency edges between cells
- dispute outcomes
- cross-cell commit/abort decisions
- the merged canonical root

### Execution Cells

Execution cells own narrow deterministic state domains. Candidate domain families:

- wallet / payment cells
- DEX pool cells
- orderbook market cells
- NFT / game / social cells
- EVM contract clusters
- SVM object clusters
- X3VM resource clusters
- bridge / BTC / HTLC session cells
- governance / slashing / system cells

The default rule is locality: a transaction should remain inside one cell unless it explicitly declares cross-cell coordination.

### Proof Bus

Each cell batch emits a proof artifact onto a shared proof bus:

- execution root
- delta commitment
- receipt root
- conflict commitment
- fee commitment
- replay seed
- optional fraud or zk fragment

The canonical chain finalizes proof-bus ordering and dependency interpretation.

## Architectural Layers

### Layer A - Cell Routing

Every transaction is classified before execution with:

- `CellDomain`
- `VmLane`
- `ConflictClass`
- `CrossCellPolicy`
- estimated execution cost
- expected read/write summary

Routing must be based on economic locality, not random shard math.

Good routing keys:

- pool
- market
- vault
- app namespace
- user cluster
- bridge session
- governance domain

Bad routing key:

- address modulo N

### Layer B - Cell-Local Mempools

Validators maintain:

- global proof-bus mempool
- per-cell ingress queues
- cross-cell coordination queue

Each cell mempool enforces:

- local fee market
- local quotas
- per-account pending caps
- spam scoring
- cell-level congestion isolation

### Layer C - Cell Execution Classes

#### Class 1 - Ultra-local fast cells

Use for:

- transfers
- isolated user actions
- app-local object updates

Goals:

- maximal parallelism
- minimal coordination
- cheap deterministic replay

#### Class 2 - Conflict-managed cells

Use for:

- AMM pools
- orderbooks
- hot contracts
- active shared state zones

Mechanics:

- speculative execution
- local STM / conflict graph scheduling
- local fee market for hot resources
- canonical serial-equivalence proofs

#### Class 3 - Atomic coordinator cells

Use for:

- cross-VM swaps
- BTC bridge
- HTLC
- governance
- slashing
- system-critical state

Mechanics:

- explicit reservation
- prepare / commit / abort protocol
- stronger observability
- slower but narrow path

### Layer D - Dependency DAG

Each cell batch emits:

- batch root
- read/write summary
- dependency list
- receipt root

The root settlement layer constructs a dependency DAG:

- independent cells settle together
- dependent cells settle in edge order
- conflicting cells escalate to deterministic ordering or dispute

### Layer E - Temporal Compression

Inside each cell, X3 may compress reversible noise inside a bounded micro-window while preserving merklized receipts.

Examples:

- repeated balance updates collapse to net delta
- cancel/replace order churn settles to net book effect
- micro-swaps settle to net pool transition

Compression invariants:

- receipt commitments remain auditable
- irreversible state after compression matches uncompressed canonical replay
- compression windows are deterministic and versioned

### Layer F - Dispute Lane

X3 must include a lie detector:

- random batch re-execution sampling
- deterministic replay witnesses
- fraud proof challenges
- slashable invalid roots
- emergency degraded mode with stricter verification

## Hardware-Affinity Twist

X3 cells are assigned deterministic hardware affinity lanes:

- CPU core groups / NUMA node
- GPU stream bundle
- memory zone
- relay region
- validator subgroup role

This is not opportunistic scheduling. The mapping must be deterministic enough that validators reproduce the same outputs even if their hardware topology differs.

Valid use cases:

- GPU-assisted signature verification
- GPU conflict scoring
- GPU erasure coding
- X3VM heavy compute lanes
- CPU commit lanes for final canonical writes

Non-negotiable rule: hardware acceleration may change speed, never semantics.

## Required Modules

### New top-level systems

- `x3-cell-router`
- `x3-cell-executor`
- `x3-proof-bus`
- `x3-root-settlement`
- `x3-dependency-dag`
- `x3-temporal-compressor`
- `x3-dispute-engine`

### Module responsibilities

#### `x3-cell-router`

- map tx to cell
- classify VM lane and conflict class
- assign local fee class
- declare cross-cell policy
- emit routing metadata

#### `x3-cell-executor`

- run local execution
- maintain local mempool
- produce local snapshot handles
- emit batch root and receipt root
- preserve serial-equivalence guarantees

#### `x3-proof-bus`

- transport cell proofs
- separate critical and bulk lanes
- publish compact witness commitments
- anchor DA references

#### `x3-root-settlement`

- order cell roots
- merge dependency DAG
- finalize canonical merged root
- apply dispute outcomes

#### `x3-temporal-compressor`

- coalesce reversible activity
- preserve receipt proofs
- emit deterministic net deltas

#### `x3-dispute-engine`

- challenge protocol
- sample re-execution
- fraud proof verification
- slashing hooks

## Repo Mapping

### Existing systems to extend

- `crates/parallel-proposer` becomes the first deterministic scheduling and conflict kernel
- `crates/contention-predictor` becomes hinting infrastructure, never consensus truth
- `crates/cross-vm-coordinator` becomes the narrow atomic-session fabric
- `pallets/x3-kernel` remains canonical runtime entrypoint for committed state
- `runtime/src/lib.rs` remains canonical settlement root environment

### Immediate code-path implication

The typed conflict work now in `crates/parallel-proposer/src/lib.rs` is the seed for the cell model:

- `VmLane`
- `ConflictClass`
- `AtomicSessionId`
- `StateKey`
- structured `DeclaredAccess`

Those types should become shared primitives for routing, scheduling, proof generation, and dispute replay.

## Invariants

Every stage of this architecture must preserve the following:

### Deterministic replay

Replaying a cell batch with the same inputs, replay seed, and canonical dependencies must produce identical outputs.

### Canonical serial equivalence

Any compressed or parallelized execution must match the canonical serial semantics of that cell domain.

### Cross-cell atomicity discipline

Cross-cell or cross-VM operations either:

- commit fully
- abort fully

There are no phantom partial commits.

### Receipt/state coherence

Receipts cannot become committed before the corresponding canonical state consequence is committed.

### Locality by default

Most traffic must remain cell-local. If the majority of flow becomes cross-cell, the architecture has failed economically.

### Honest measurement

Ingress, settled receipts, and canonical state transitions must be measured separately and published together.

### Degraded-mode safety

Under overload or partition, X3 may reduce throughput or disable compression/parallel optimizations, but must not alter semantics.

## Message Flow

### Local fast-path transaction

1. ingress accepted
2. `x3-cell-router` maps tx to one cell
3. cell-local mempool admits tx
4. cell executes tx or micro-window batch
5. cell emits receipt root, delta root, execution root
6. proof bus transports batch artifact
7. root settlement finalizes cell batch root
8. canonical merged root advances

### Cross-cell atomic transaction

1. ingress marks tx as atomic-session candidate
2. router assigns `AtomicSessionId`
3. session manager reserves participant resources
4. involved cells execute prepare phase
5. proof bus carries prepare commitments
6. root settlement orders dependency edge and commit decision
7. cells apply commit or abort
8. canonical merged root advances with one coherent outcome

### Dispute flow

1. challenger submits fraud witness against cell batch root
2. dispute engine reconstructs replay inputs
3. deterministic re-execution verifies batch validity
4. settlement layer slashes invalid root producer or dismisses challenge
5. canonical root remains stable or applies dispute correction path

## Benchmark Plan

### Truthful benchmark outputs

For every benchmark run, publish:

- ingress ops/sec
- settled receipts/sec
- canonical state transitions/sec
- p50/p95/p99 receipt latency
- p50/p95/p99 canonical settlement latency
- cross-cell transaction ratio
- compression ratio
- dispute replay success rate
- hot-cell concentration ratio

### Benchmark scenarios

#### Scenario 1 - Pure local traffic

- isolated transfers
- isolated app actions
- target: demonstrate cell-local scaling curve

#### Scenario 2 - Conflict-heavy market cell

- one or more hot DEX pools
- target: demonstrate local hotspot containment and local fee response

#### Scenario 3 - Mixed multi-VM workload

- EVM + SVM + X3VM + governance + bridge mix
- target: demonstrate lane-aware scheduling and shared root settlement

#### Scenario 4 - Cross-cell atomic stress

- cross-VM swaps and bridge sessions
- target: prove the rare slow path does not poison the common fast path

#### Scenario 5 - Degraded network and dispute mode

- delayed proof bus delivery
- replay sampling
- fraud challenge path
- target: prove safety under adversity

## Rollout Phases

### Phase 0 - Deterministic substrate hardening

- finish typed conflict metadata adoption in proposer and routing code
- extend metadata extraction into real runtime call classification
- complete serial-vs-parallel replay validation
- add canonical benchmark gates

### Phase 1 - Cell-local execution pilot

- introduce one or two cell families in software only
- route local transaction classes into cell-local queues
- emit cell batch roots without changing final canonical semantics

### Phase 2 - Proof bus and root settlement

- implement proof-bus transport
- settle cell roots and dependency edges on canonical chain
- keep disputes conservative and synchronous first

### Phase 3 - Temporal compression

- enable deterministic micro-window compression in selected cell classes
- publish dual metrics: receipts vs canonical net transitions

### Phase 4 - Atomic session fabric

- move cross-VM and bridge flows into explicit session protocol
- reserve resources up front
- commit/abort under root-settlement control

### Phase 5 - Adaptive cells

- split hot cells into child cells
- preserve parent root lineage
- benchmark hotspot isolation and merge-back behavior

### Phase 6 - Production hardening

- adversarial testing
- large validator benchmarking
- dispute drills
- operational runbooks
- public measurement standard

## Immediate Next Implementation Slice

1. promote conflict primitives from `parallel-proposer` into shared architecture ownership
2. add runtime-aware call classification that projects extrinsics into `StateKey` families
3. add benchmark instrumentation for local-vs-atomic-vs-cross-cell ratios
4. define proof-bus artifact schema
5. prototype one real execution cell family, likely payments or one DEX domain

## Stop Conditions

Do not proceed to the next phase if any of the following are false:

- replay is deterministic
- canonical serial equivalence is proven for the optimized path
- measurement distinguishes receipts from compressed net transitions
- cross-cell rate remains economically narrow
- dispute path can invalidate incorrect cell roots

## Bottom Line

X3 reaches extreme throughput only if most activity stops requiring global execution. The canonical chain must become a root-finalized settlement spine for a mesh of deterministic execution cells. The fabric is only valid if it stays truthful: deterministic replay, explicit atomicity, honest metrics, and a working dispute lane.
