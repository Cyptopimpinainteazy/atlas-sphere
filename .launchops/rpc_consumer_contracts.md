# Generated RPC Consumer Contracts

This file is generated from the LaunchOps RPC contract matrix. Do not hand-edit it.

Generated at: 2026-04-23T01:23:10.262898101+00:00

Source matrix: `rpc_contract_matrix.json`

Contract split: frontend_safe=11 sidecar_only=14 mock_only=3

## Frontend-Safe

| Method | Registrations | Bucket | Frontend | Sidecar | Trait Hints | Ownership | Notes |
| --- | --- | --- | --- | --- | --- | --- | --- |
| `gpu_orchestratorHealth` | `1` | `runtime_backed` | `direct_read_candidate` | `pass_through_candidate` | `gpu_validator_api::GpuValidatorRuntimeApi<Block>` | - | - |
| `gpu_validatorStatus` | `1` | `runtime_backed` | `direct_read_candidate` | `pass_through_candidate` | `gpu_validator_api::GpuValidatorRuntimeApi<Block>` | - | - |
| `queryDisputeStatus` | `1` | `runtime_backed` | `direct_read_candidate` | `pass_through_candidate` | `gpu_validator_api::GovernanceSettlementApi<Block>` | - | - |
| `queryProofFinality` | `1` | `runtime_backed` | `direct_read_candidate` | `pass_through_candidate` | `gpu_validator_api::GovernanceSettlementApi<Block>` | - | - |
| `query_crossChainStatus` | `1` | `runtime_backed` | `direct_read_candidate` | `pass_through_candidate` | `gpu_validator_api::CrossChainStateRootApi<Block>` | - | - |
| `validate_evmHeader` | `1` | `runtime_backed` | `direct_read_candidate` | `pass_through_candidate` | `gpu_validator_api::CrossChainStateRootApi<Block>` | - | - |
| `validate_svmHeader` | `1` | `runtime_backed` | `direct_read_candidate` | `pass_through_candidate` | `gpu_validator_api::CrossChainStateRootApi<Block>` | - | - |
| `x3_getAssetMetadata` | `1` | `runtime_backed` | `direct_read_candidate` | `pass_through_candidate` | `pallet_x3_kernel::AtlasKernelRuntimeApi<Block, AccountId, Balance, AssetId>` | - | - |
| `x3_getAuthorities` | `1` | `runtime_backed` | `direct_read_candidate` | `pass_through_candidate` | `pallet_x3_kernel::AtlasKernelRuntimeApi<Block, AccountId, Balance, AssetId>` | - | - |
| `x3_getAuthorizedAccounts` | `1` | `runtime_backed` | `direct_read_candidate` | `pass_through_candidate` | `pallet_x3_kernel::AtlasKernelRuntimeApi<Block, AccountId, Balance, AssetId>` | - | - |
| `x3_getCanonicalBalance` | `1` | `runtime_backed` | `direct_read_candidate` | `pass_through_candidate` | `pallet_x3_kernel::AtlasKernelRuntimeApi<Block, AccountId, Balance, AssetId>` | - | - |

## Sidecar-Only

| Method | Registrations | Bucket | Frontend | Sidecar | Trait Hints | Ownership | Notes |
| --- | --- | --- | --- | --- | --- | --- | --- |
| `atomicTrade_createSwap` | `1` | `node_local_adapter` | `adapter_only` | `orchestrate` | `-` | - | - |
| `atomicTrade_estimateSlippage` | `1` | `node_local_adapter` | `adapter_only` | `orchestrate` | `-` | - | - |
| `atomicTrade_executeSwap` | `1` | `node_local_adapter` | `adapter_only` | `orchestrate` | `-` | - | - |
| `atomicTrade_getSwapQuote` | `1` | `node_local_adapter` | `adapter_only` | `orchestrate` | `-` | - | - |
| `atomicTrade_getSwapStatus` | `1` | `node_local_adapter` | `adapter_only` | `orchestrate` | `-` | - | - |
| `gpu_submitProof` | `1` | `runtime_backed` | `adapter_only` | `orchestrate` | `gpu_validator_api::GpuValidatorRuntimeApi<Block>` | - | - |
| `submitDispute` | `1` | `runtime_backed` | `adapter_only` | `orchestrate` | `gpu_validator_api::GovernanceSettlementApi<Block>` | - | - |
| `walletDex_estimateSwap` | `1` | `node_local_adapter` | `adapter_only` | `orchestrate` | `-` | - | - |
| `walletDex_executeSwap` | `1` | `node_local_adapter` | `adapter_only` | `orchestrate` | `-` | - | - |
| `x3_estimateGas` | `1` | `runtime_backed` | `adapter_only` | `orchestrate` | `pallet_x3_kernel::AtlasKernelRuntimeApi<Block, AccountId, Balance, AssetId>` | - | - |
| `x3_flashFinalityStatus` | `2` | `node_local_adapter` | `adapter_only` | `orchestrate` | `-` | - | - |
| `x3_isAuthorized` | `1` | `runtime_backed` | `adapter_only` | `orchestrate` | `pallet_atomic_trade_engine::AtomicTradeEngineApi<Block>, pallet_x3_kernel::AtlasKernelRuntimeApi<Block, AccountId, Balance, AssetId>` | - | - |
| `x3_submitCrossVmTransaction` | `1` | `node_local_adapter` | `adapter_only` | `orchestrate` | `pallet_x3_kernel::AtlasKernelRuntimeApi<Block, AccountId, Balance, AssetId>` | expected mixed ownership: runtime executes the EVM leg while node-local billing and queueing own the orchestration boundary | contains both runtime-backed and node-local behavior; keep frontend integration behind sidecar or adapter ownership |
| `x3_submitSvmTransaction` | `1` | `node_local_adapter` | `adapter_only` | `orchestrate` | `-` | - | - |

## Mock-Only

| Method | Registrations | Bucket | Frontend | Sidecar | Trait Hints | Ownership | Notes |
| --- | --- | --- | --- | --- | --- | --- | --- |
| `requestProofChallenge` | `1` | `placeholder` | `mock_only` | `defer` | `-` | - | structural placeholder until Phase 10b challenge execution is implemented |
| `x3_newCore` | `1` | `placeholder` | `mock_only` | `defer` | `-` | - | not available on this node build |
| `x3_submitX3vmTransaction` | `1` | `placeholder` | `mock_only` | `defer` | `-` | - | intentional guidance error; standalone X3VM submission is unavailable on this build |

