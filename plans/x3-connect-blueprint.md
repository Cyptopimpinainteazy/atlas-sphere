# X3 Connect Blueprint

## Positioning

X3 should be positioned as a throughput coprocessor and interoperability fabric for chains.

It should not be sold as "just a faster chain" or as a vanity TPS claim. The product must let a partner chain keep its own:

- brand
- token
- governance
- base consensus
- application surface

while using X3 for selective execution acceleration, benchmarking, routing, bridge assistance, and optional shared settlement.

## Product Surface

### 1. X3 Benchmark Cloud

The first product to sell.

Capabilities:

- passive latency and block analysis
- traffic trace ingestion
- replay against X3 execution models
- conflict heatmaps
- hotspot reports
- signed benchmark certification

This is the lowest-friction product and the entry point into deeper integration.

### 2. X3 Connect SDK

Developer-facing integration toolkit for:

- cross-chain messaging
- route discovery
- canonical bridge paths
- intent submission
- receipt verification
- benchmark API integration

Adapters should meet existing chain stacks where they are.

### 3. X3 Turbo Lanes

Dedicated high-throughput execution lanes for partner workloads such as:

- swaps
- payments
- orderflow
- game actions
- bot traffic
- NFT mints
- bridge settlement

The partner routes selected classes of work to X3 instead of replacing its base chain.

### 4. X3 Shared Settlement

Higher-trust deeper integration for chains that want:

- state-root posting to X3
- proof-bus participation
- shared execution
- shared sequencing
- dispute and replay support

This is the highest-value and highest-lock-in tier.

## Target Architecture

### Layer 1 - X3 Root

Canonical control chain for:

- settlement roots
- partner registry
- validator / staking logic
- billing and metering anchors
- dispute resolution
- proof commitments
- cross-lane accounting

The root chain should not directly process all partner traffic.

### Layer 2 - X3 Turbo Fabric

Primary execution engine containing:

- deterministic execution cells
- partner-specific lanes
- lane schedulers
- conflict-aware routing
- GPU assist services
- temporal compression
- receipt generation
- proof packaging

### Layer 3 - X3 Connect Adapters

Adapter families for:

- EVM chains
- OP Stack style chains
- Substrate / Cosmos style appchains
- custom appchains
- later: SVM-compatible environments

### Layer 4 - X3 Proof Bus

Proof and message backbone carrying:

- receipt root
- state delta root
- dependency digest
- replay seed
- fee meter
- witness handle

### Layer 5 - X3 Benchmark Harness

Operational benchmark layer containing:

- baseline collector
- replay runner
- shadow-mode comparator
- dashboarding
- CI-consumable signed reports

## Service Tiers

### Tier 0 - Benchmark Only

Partner provides:

- RPC endpoint
- chain metadata
- block and mempool samples if available
- workload traces

X3 provides:

- latency profile
- hotspot analysis
- conflict map
- throughput ceiling estimate
- X3 replay comparison
- integration recommendation

### Tier 1 - Sidecar Mode

Partner integrates:

- X3 SDK
- sidecar / submission proxy
- benchmark agent
- optional receipt bridge

Use cases:

- route search
- soft confirms
- cross-chain messaging
- batch execution assistance
- bridge settlement assistance

### Tier 2 - Turbo Lane Mode

Partner routes selected workloads into X3 lanes.

Candidate workload classes:

- DEX pair groups
- payments
- orderflow
- game actions
- AI agent traffic
- NFT mint bursts

### Tier 3 - Shared Settlement Mode

Partner uses X3 for:

- shared sequencing
- shared execution
- proof settlement
- cross-chain interoperability

## Onboarding Flow

### Day 1

- create partner account
- register chain config
- connect RPC / endpoint sources
- install SDK or proxy
- ingest sample traffic
- run baseline benchmark

### Day 2

- receive baseline and X3 replay report
- inspect hotspot and conflict dashboard
- choose sidecar or turbo lane mode
- deploy testnet adapter

### Week 1

- run shadow production
- compare live baseline vs X3 lane output
- choose pricing tier
- enable selective workload routing

### Later

- deepen integration into shared settlement
- enable dedicated lanes
- negotiate reserved throughput tier

## Benchmark Report Schema

Every benchmark certification must include:

### Partner metadata

- chain name
- chain type
- benchmark date
- traffic window
- software versions

### Baseline metrics

- p50/p95/p99 latency
- block fullness
- failed transaction rate
- congestion episodes
- hotspot contracts or state domains
- estimated contention profile

### X3 replay metrics

- replayed workload count
- X3 lane throughput
- X3 receipt latency
- projected rejection rate delta
- projected congestion isolation gain
- projected route or bridge improvement

### Integration recommendation

- benchmark-only
- sidecar mode
- turbo lane mode
- shared settlement mode

### Certification block

- report digest
- signer identity
- generation timestamp
- replay config hash

## Revenue Model

### 1. Benchmark fee

Flat fee for:

- trace ingestion
- replay analysis
- signed report generation
- integration recommendation

### 2. Integration fee

One-time fee for:

- adapter deployment
- SDK support
- workload mapping
- shadow-mode setup

### 3. Ongoing throughput fee

Metered pricing for:

- million receipts
- proof commitments
- cross-chain messages
- reserved throughput capacity
- GPU burst compute
- DA or proof storage

### 4. Premium reserved lanes

Premium contracts for:

- guaranteed TPS floor
- guaranteed latency tier
- private regional lanes
- enterprise reporting
- dedicated support

### 5. Revenue share on flow

Optional share on:

- bridge volume
- routed volume
- execution-improved orderflow

## Repo Mapping

### Existing crates that should anchor the product

- `crates/x3-rpc` - partner-facing RPC and benchmark/report APIs
- `crates/x3-sidecar` - sidecar daemon and submission proxy foundation
- `crates/x3-gateway` - metrics portal, partner API, dashboard backend
- `crates/x3-bridge-adapters` - bridge and chain-specific adapter surface
- `crates/parallel-proposer` - deterministic lane scheduling seed
- `crates/contention-predictor` - non-consensus hinting and hotspot analysis

### New planned systems

- `x3-connect-sdk`
- `x3-benchmark-cloud`
- `x3-turbo-lane`
- `x3-proof-bus`
- `x3-metering`
- `x3-partner-registry`

## Technical Priorities

### Priority 1

- benchmark harness
- signed report generation
- EVM adapter and proxy
- metrics portal

### Priority 2

- turbo lane engine
- receipt bridge
- proof-bus artifact schema
- billing and metering hooks

### Priority 3

- multistack adapters
- shared settlement interfaces
- partner registry and reserved-lane controls

## Success Criteria

The product is only worth shipping if partner chains can measure at least one of:

- materially better hot-path throughput
- noticeably faster confirmations
- lower failure rate under load
- better cross-chain UX
- better bridge or route quality
- easier launch of high-throughput app-specific lanes

## Anti-Goals

Do not require partners to:

- rewrite their whole chain
- abandon their token or governance
- trust a black box
- move all workloads to X3 immediately

## Bottom Line

The right near-term business is `X3 Connect + Benchmark Cloud + Turbo Lanes`.

The sales motion is simple:

"Connect your chain, replay your traffic, prove the gain, then route only the workloads that benefit."
