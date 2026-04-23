# Generated RPC Contract Matrix

This file is generated from live code by LaunchOps. Do not hand-edit it.

Generated at: 2026-04-23T01:23:10.262898101+00:00

Source: `node/src/rpc.rs`

Buckets: runtime_backed=15 node_local_adapter=11 placeholder=3

Flags: duplicate_registrations=0 bucket_drift=0

## Runtime-Backed

| Method | Runtime Calls | Trait Hints | Frontend | Sidecar | Notes |
| --- | --- | --- | --- | --- | --- |
| `gpu_orchestratorHealth` | `query_orchestrator_health` | `gpu_validator_api::GpuValidatorRuntimeApi<Block>` | `direct_read_candidate` | `pass_through_candidate` | - |
| `gpu_validatorStatus` | `gpu_validator_status` | `gpu_validator_api::GpuValidatorRuntimeApi<Block>` | `direct_read_candidate` | `pass_through_candidate` | - |
| `gpu_submitProof` | `submit_gpu_validator_proof` | `gpu_validator_api::GpuValidatorRuntimeApi<Block>` | `adapter_only` | `orchestrate` | - |
| `validate_evmHeader` | `validate_evm_header` | `gpu_validator_api::CrossChainStateRootApi<Block>` | `direct_read_candidate` | `pass_through_candidate` | - |
| `validate_svmHeader` | `validate_svm_header` | `gpu_validator_api::CrossChainStateRootApi<Block>` | `direct_read_candidate` | `pass_through_candidate` | - |
| `query_crossChainStatus` | `query_cross_chain_status` | `gpu_validator_api::CrossChainStateRootApi<Block>` | `direct_read_candidate` | `pass_through_candidate` | - |
| `submitDispute` | `submit_dispute` | `gpu_validator_api::GovernanceSettlementApi<Block>` | `adapter_only` | `orchestrate` | - |
| `queryDisputeStatus` | `query_dispute_status` | `gpu_validator_api::GovernanceSettlementApi<Block>` | `direct_read_candidate` | `pass_through_candidate` | - |
| `queryProofFinality` | `confirm_settlement_finality` | `gpu_validator_api::GovernanceSettlementApi<Block>` | `direct_read_candidate` | `pass_through_candidate` | - |
| `x3_getAssetMetadata` | `get_asset_metadata` | `pallet_x3_kernel::AtlasKernelRuntimeApi<Block, AccountId, Balance, AssetId>` | `direct_read_candidate` | `pass_through_candidate` | - |
| `x3_isAuthorized` | `is_authorized` | `pallet_atomic_trade_engine::AtomicTradeEngineApi<Block>, pallet_x3_kernel::AtlasKernelRuntimeApi<Block, AccountId, Balance, AssetId>` | `adapter_only` | `orchestrate` | - |
| `x3_getAuthorizedAccounts` | `get_authorized_accounts` | `pallet_x3_kernel::AtlasKernelRuntimeApi<Block, AccountId, Balance, AssetId>` | `direct_read_candidate` | `pass_through_candidate` | - |
| `x3_getAuthorities` | `get_authorities` | `pallet_x3_kernel::AtlasKernelRuntimeApi<Block, AccountId, Balance, AssetId>` | `direct_read_candidate` | `pass_through_candidate` | - |
| `x3_getCanonicalBalance` | `get_canonical_balance` | `pallet_x3_kernel::AtlasKernelRuntimeApi<Block, AccountId, Balance, AssetId>` | `direct_read_candidate` | `pass_through_candidate` | - |
| `x3_estimateGas` | `estimate_evm_gas` | `pallet_x3_kernel::AtlasKernelRuntimeApi<Block, AccountId, Balance, AssetId>` | `adapter_only` | `orchestrate` | - |

## Node-Local Adapter

| Method | Runtime Calls | Trait Hints | Frontend | Sidecar | Notes |
| --- | --- | --- | --- | --- | --- |
| `x3_submitCrossVmTransaction` | `submit_evm_transaction` | `pallet_x3_kernel::AtlasKernelRuntimeApi<Block, AccountId, Balance, AssetId>` | `adapter_only` | `orchestrate` | expected mixed ownership: runtime executes the EVM leg while node-local billing and queueing own the orchestration boundary |
| `x3_submitSvmTransaction` | `-` | `-` | `adapter_only` | `orchestrate` | BillingMiddleware quota path |
| `walletDex_estimateSwap` | `-` | `-` | `adapter_only` | `orchestrate` | WalletDexRpc service adapter |
| `walletDex_executeSwap` | `-` | `-` | `adapter_only` | `orchestrate` | WalletDexRpc service adapter |
| `atomicTrade_createSwap` | `-` | `-` | `adapter_only` | `orchestrate` | - |
| `atomicTrade_executeSwap` | `-` | `-` | `adapter_only` | `orchestrate` | - |
| `atomicTrade_getSwapQuote` | `-` | `-` | `adapter_only` | `orchestrate` | - |
| `atomicTrade_estimateSlippage` | `-` | `-` | `adapter_only` | `orchestrate` | - |
| `atomicTrade_getSwapStatus` | `-` | `-` | `adapter_only` | `orchestrate` | - |
| `x3_flashFinalityStatus` | `-` | `-` | `adapter_only` | `orchestrate` | async node-local orchestration, flash finality gadget |
| `x3_flashFinalityStatus` | `-` | `-` | `adapter_only` | `orchestrate` | - |

## Placeholder

| Method | Runtime Calls | Trait Hints | Frontend | Sidecar | Notes |
| --- | --- | --- | --- | --- | --- |
| `requestProofChallenge` | `-` | `-` | `mock_only` | `defer` | structural placeholder until Phase 10b challenge execution is implemented |
| `x3_submitX3vmTransaction` | `-` | `-` | `mock_only` | `defer` | intentional guidance error; standalone X3VM submission is unavailable on this build |
| `x3_newCore` | `-` | `-` | `mock_only` | `defer` | not available on this node build |

