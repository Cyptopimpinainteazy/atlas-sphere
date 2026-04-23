# Generated Sidecar Adapter Backlog

This file is generated from rpc_consumer_contracts.json. Do not hand-edit it.

Generated at: 2026-04-23T01:23:10.262898101+00:00

| Route | Method | Reason | Ownership Note | Notes |
| --- | --- | --- | --- | --- |
| `bridge-status` | `x3_submitCrossVmTransaction` | Bridge submission stays behind the sidecar because queueing, billing, and orchestration remain node-owned. | expected mixed ownership: runtime executes the EVM leg while node-local billing and queueing own the orchestration boundary | contains both runtime-backed and node-local behavior; keep frontend integration behind sidecar or adapter ownership |
| `bridge-status` | `x3_submitSvmTransaction` | Bridge submission stays behind the sidecar because queueing, billing, and orchestration remain node-owned. | - | - |
| `governance` | `submitDispute` | Governance actions must stay behind a sidecar or signer boundary even when read visibility is frontend-safe. | - | - |
| `network-overview` | `gpu_submitProof` | Proof submission is an operator or service action, not a direct frontend read contract. | - | - |
| `network-overview` | `x3_flashFinalityStatus` | Flash finality status should stay sidecar-owned until conditional registration semantics stay intentionally documented and tested. | - | - |
| `wallet-home` | `atomicTrade_createSwap` | Trading and swap flows remain sidecar-owned because they are backed by node-local services rather than stable direct-read contracts. | - | - |
| `wallet-home` | `atomicTrade_estimateSlippage` | Trading and swap flows remain sidecar-owned because they are backed by node-local services rather than stable direct-read contracts. | - | - |
| `wallet-home` | `atomicTrade_executeSwap` | Trading and swap flows remain sidecar-owned because they are backed by node-local services rather than stable direct-read contracts. | - | - |
| `wallet-home` | `atomicTrade_getSwapQuote` | Trading and swap flows remain sidecar-owned because they are backed by node-local services rather than stable direct-read contracts. | - | - |
| `wallet-home` | `atomicTrade_getSwapStatus` | Trading and swap flows remain sidecar-owned because they are backed by node-local services rather than stable direct-read contracts. | - | - |
| `wallet-home` | `walletDex_estimateSwap` | Trading and swap flows remain sidecar-owned because they are backed by node-local services rather than stable direct-read contracts. | - | - |
| `wallet-home` | `walletDex_executeSwap` | Trading and swap flows remain sidecar-owned because they are backed by node-local services rather than stable direct-read contracts. | - | - |
| `wallet-home` | `x3_estimateGas` | Wallet-facing action preparation still depends on adapter-owned semantics and should not bind directly to frontend routes. | - | - |
| `wallet-home` | `x3_isAuthorized` | Wallet-facing action preparation still depends on adapter-owned semantics and should not bind directly to frontend routes. | - | - |
