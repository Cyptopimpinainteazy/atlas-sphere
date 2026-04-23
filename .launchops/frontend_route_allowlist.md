# Generated Frontend Route Allowlist

This file is generated from rpc_consumer_contracts.json. Do not hand-edit it.

Generated at: 2026-04-23T01:23:10.262898101+00:00

| Route | Allowed Methods | Rationale |
| --- | --- | --- |
| `bridge-status` | `query_crossChainStatus, validate_evmHeader, validate_svmHeader` | Only read-side proof and validation signals are allowed directly; settlement and cross-VM submission remain sidecar-owned. |
| `explorer` | `-` | No stable direct-read explorer contract is carved out yet from the current RPC surface. |
| `governance` | `queryDisputeStatus, queryProofFinality` | Direct-read governance dispute and finality visibility is allowed; proposal actions stay behind sidecar and signing boundaries. |
| `network-overview` | `gpu_orchestratorHealth, gpu_validatorStatus` | Public network posture can bind to direct-read validator and operational health endpoints only. |
| `wallet-home` | `x3_getAssetMetadata, x3_getAuthorities, x3_getAuthorizedAccounts, x3_getCanonicalBalance` | Direct-read wallet and account posture data only; no relayer, queue, or signer-owned mutations. |
