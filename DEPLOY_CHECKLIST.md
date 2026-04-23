# X3 Chain Testnet Deployment Checklist

Use this checklist to deploy X3 Chain and run the real X3 kernel benchmark.

## Pre-Deployment

- [x] Read `TESTNET_READINESS_SUMMARY.md` for overview
- [x] Read `BENCHMARK_GUIDE.md` for detailed deployment steps
- [x] Verify system has: Rust 1.70+, Node.js 18+, Python 3.8+
- [ ] Clone/pull latest x3-chain-master repo with patches applied
- [x] Verify patches are in place:
  - [x] `runtime/src/lib.rs:746` — No mock EVM fallback
  - [x] `node/src/rpc_frontier.rs` — Functions renamed to `create_frontier_rpc()`
  - [x] `scripts/run-validator.sh` — No `CCGV_USE_MOCK_RPC=true` export

## Build & Verification

- [x] Build release node: `cargo build -p x3-chain-node --release` (takes ~5 min)
  - Built with mitigation flags `CARGO_PROFILE_RELEASE_CODEGEN_UNITS=16 CARGO_PROFILE_RELEASE_OPT_LEVEL=1 CARGO_PROFILE_RELEASE_LTO=false` to dodge the rustc 1.88.0 / LLVM 20.1.5 SIGSEGV that hits with the workspace default `opt-level=2, codegen-units=1, lto=false` profile (panics in `blake3`, `tokio`, `wasmtime-jit`, `sp-arithmetic`).
- [x] Verify build succeeds with no errors
- [x] Binary created at: `target/release/x3-chain-node` (53MB with `opt-level=1`; original ~150MB target assumes `opt-level=2`+full debug)
  - `file target/release/x3-chain-node` → ELF 64-bit LSB pie executable, dynamically linked, BuildID `80338a02…`
  - `./target/release/x3-chain-node --version` → `X3 Chain Node 0.1.0`
- [x] Install Node.js deps: `cd scripts/testnet && npm install`
- [x] Verify npm packages installed: check `node_modules/@polkadot/api`

## Local Chain Deployment

- [x] Start validator node (CLI flags reconciled to current binary — `--ws-port`/`--ws-external` are gone; HTTP+WS multiplex on `--rpc-port`):
  ```bash
  ./target/release/x3-chain-node --dev --rpc-port 9933
  ```
  `--dev` is the documented shortcut for `--chain=dev --force-authoring --rpc-cors=all --alice --tmp` and seeds the keystore with Alice's session keys so blocks are produced.
- [x] Verify chain starts (watch for "Alice" authority logs) — `--alice` implied by `--dev`; logs show `Pre-sealed block for proposal at <n>` and `🏆 Block finalized: #<n> ✅`.
- [x] Verify RPC is listening on `127.0.0.1:9933` (this binary multiplexes JSON-RPC HTTP+WS on `--rpc-port`; `9944` no longer applies):
  - `system_health` → `{peers:0, isSyncing:false, shouldHavePeers:false}`
  - `chain_getHeader` t=0  → block `0xf3` (= 243)
  - `chain_getHeader` t=+8s → block `0x11b` (= 283)
  - Δ ≈ 40 blocks in 8 s ⇒ ~5 blk/s, finalization advancing in lockstep.
- [x] Let chain run for ~30 sec to stabilize
- [x] Keep chain running in background terminal

## Account Authorization

> **BLOCKED on `--dev` chain spec.** Verified against the live runtime metadata at `ws://127.0.0.1:9933`:
> - There is **no `Sudo` pallet** in this runtime (`pallets` = System, Timestamp, Aura, Grandpa, Session, Balances, TransactionPayment, Scheduler, Preimage, EVM, AtlasKernel, X3Coin, AtomicTradeEngine, Council, Governance, Treasury, … — `tx.sudo` is empty), so `authorize-accounts.js`'s `api.tx.sudo.sudo(...)` call has no target.
> - `pallets/x3-kernel/src/lib.rs:1591` requires `T::GovernanceOrigin::ensure_origin(origin)?`, and `runtime/src/lib.rs:680` sets `type GovernanceOrigin = EnsureRootOrHalfCouncil`.
> - `--dev` genesis seeds **zero Council members** (`api.query.council.members()` → `[]`, `prime` → `null`), so the half-council path is also unreachable.
> - A direct dry-run of `atlasKernel.authorizeAccount(//Alice//load//0)` signed by Alice was included in a block and dispatched **`BadOrigin`** (expected, given the above).
>
> Unblock options (any one, requires rebuild):
>   1. Add Alice to `council.members` in the dev `chain_spec.rs` genesis (smallest change), then `council.execute(authorizeAccount(target))`.
>   2. Re-add the `Sudo` pallet to the runtime with Alice as sudo key for non-mainnet specs.
>   3. Loosen `AtlasKernel::GovernanceOrigin` to `EnsureRootOrAuthority` for non-mainnet builds.
> Until one of those lands, the four account-authorization items below remain **unchecked on purpose**.

- [ ] Run authorization script:
  ```bash
  cd scripts/testnet
  node authorize-accounts.js \
    --wsEndpoint ws://127.0.0.1:9933 \
    --baseDerivation //Alice//load \
    --count 240 \
    --sudoSeed //Alice
  ```
- [ ] Verify all 240 accounts authorized (check for ✓ messages)
- [ ] Wait for finalization to complete

## Benchmark Execution

### Option A: Dev/Debug Run (Fast, Low Load)

- [ ] Run single-process benchmark:
  ```bash
  node load-x3-comit-v2-tps.js \
    --wsEndpoint ws://127.0.0.1:9944 \
    --numSenders 16 \
    --concurrency 64 \
    --durationSec 120 \
    --finalityWaitSec 30 \
    --verbose
  ```
- [ ] Watch output for:
  - [ ] "Starting submission phase..."
  - [ ] "Blocks produced..." (should see ~600 blocks in 120 sec)
  - [ ] "Finality complete..."
  - [ ] Final metrics table
- [ ] Expected result: 50–500 finalized TPS (depending on system)
- [ ] Save output or redirect to file: `... > bench_dev.log 2>&1`

### Option B: Production Run (Full Load, Long Duration)

- [ ] Run multiprocess benchmark:
  ```bash
  python3 run-multiprocess-load.py \
    --rpc-ws ws://127.0.0.1:9944 \
    --workers 8 \
    --senders 240 \
    --duration-sec 600 \
    --finality-wait-sec 45 \
    --concurrency-total 1024 \
    --output benchmarks/x3_chain_baseline_tps.json
  ```
- [ ] Monitor output for:
  - [ ] "Prefund stage completed"
  - [ ] "Worker 1..8 starting..."
  - [ ] Progress percentage increasing
  - [ ] Final JSON output with metrics
- [ ] Wait for full duration (600 sec = 10 minutes)
- [ ] Output saved to: `benchmarks/x3_chain_baseline_tps.json`
- [ ] View results: `jq . benchmarks/x3_chain_baseline_tps.json`

## Results Analysis

- [ ] Open benchmark output JSON
- [ ] Extract key metrics:
  - [ ] `finalized_tps_submit_window` — Primary metric
  - [ ] `in_block_tps` — In-flight metric
  - [ ] `avg_block_time_ms` — Should be ~200
  - [ ] `avg_signed_extrinsics_per_block` — Load distribution
  - [ ] `failure_reasons` — Check for unexpected errors
- [ ] Fill in `BENCHMARK_COMPARISON.md` template:
  - [ ] Paste benchmark command
  - [ ] Paste finalized TPS result
  - [ ] Record block time
  - [ ] Record test duration and sender count
- [ ] Compare against known benchmarks:
  - [ ] Solana non-vote TPS (4,000–10,000 typical)
  - [ ] Ethereum L1 TPS (~15–25 typical)
  - [ ] Polkadot parachain TPS (1,000–3,000 typical)

## Troubleshooting

### Chain Won't Start
- [ ] Check port 9944 is free: `lsof -i :9944`
- [ ] Kill any blocking process: `pkill x3-chain-node`
- [ ] Try again

### Low Finalized TPS
- [ ] Check block time in logs (should be ~200ms)
- [ ] Increase `--finalityWaitSec` by 10 sec and re-run
- [ ] Check chain logs for adapter errors (search for "error\|panic")
- [ ] Try dev run first to isolate issues

### Authorization Fails
- [ ] Verify chain is running
- [ ] Verify Alice account exists (should auto-exist on local chain)
- [ ] Try authorizing manually via Polkadot.js UI
- [ ] Check chain logs for sudo errors
- [x] **Confirmed root cause on current `--dev` build**: no `Sudo` pallet, empty Council; `authorize_account` requires `EnsureRootOrHalfCouncil`. See the Account Authorization section above for the three unblock options.

### Benchmark Hangs on Finality
- [ ] May be normal if finality_wait_sec is high
- [ ] Kill with Ctrl+C after 5+ minutes if stuck
- [ ] Check if blocks are still being produced in chain logs
- [ ] Increase finality_wait_sec or reduce benchmark duration

## Documentation & Next Steps

- [ ] Review benchmark results against BENCHMARK_COMPARISON.md expectations
- [ ] Identify any bottlenecks:
  - [ ] Is finalized TPS < 100? Check block weights, adapters
  - [ ] Is error rate > 5%? Check rate limits, increase signers
  - [ ] Is block time > 250ms? Check chain load, CPU utilization
- [ ] If tuning is needed:
  - [ ] Increase `MILLISECS_PER_BLOCK` or `BLOCK_WEIGHT_LIMIT` in `runtime/src/lib.rs`
  - [ ] Rebuild and re-run benchmark
  - [ ] Document performance improvements
- [ ] Publish results:
  - [ ] Copy JSON output to report
  - [ ] Add notes on any issues or tuning applied
  - [ ] Compare finalized TPS against other chains
  - [ ] Share findings with team

## Sign-Off

- [ ] Deployment completed successfully
- [ ] Benchmark executed and results collected
- [ ] Results analyzed and documented
- [ ] Comparison against known benchmarks completed
- [ ] Testnet approved for public deployment

**Completed By:** _________________  
**Date:** _________________  
**Result Status:** ✅ PASS / ⚠️ NEEDS TUNING / ❌ FAILED
