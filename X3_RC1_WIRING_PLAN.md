# RC-1: Wiring Gaps Execution Plan

**Audit Reference:** §3 (Wiring Gaps), §5 (New Components)  
**Goal:** Wire all production modules into `node/src/service.rs` and `runtime_api` so they are reachable from the node and network.  
**Estimated Duration:** 3–4 weeks (can parallelize many phases)  
**Dependency Order:** Phases must proceed in order; parallelization noted per phase.

---

## RC-1 Phase Summary

| Phase | Target Module | Wiring Point | Blocker? | Est. Days |
|-------|---------------|--------------|----------|-----------|
| 1 | x3-gpu-validator-swarm | node/src/service.rs spawn + node/src/rpc.rs | No | 3 |
| 2 | pallet-x3-verifier | Add GpuValidatorApi runtime_api | Blocks 3 | 2 |
| 3 | cross-chain-gpu-validator | Register with pallet-x3-verifier + failover | Blocks 5 | 3 |
| 4 | cross-vm-bridge + cross-vm-coordinator | Bind via pallet-x3-kernel adapters | Parallel with 5 | 4 |
| 5 | external-chains router | node/src/chain_spec.rs config | Blocks 6 | 2 |
| 6 | x3-relayer (NEW) | Create skeleton + wire router | Parallel with 5 | 5 |
| 7 | All other gaps (§3 items 5–12) | Per table below | None | 2–3 |
| 8 | Integration test | zombienet scenario | Final | 3 |

---

## Phase 1: Wire GPU Validator Swarm to Node

### Objective
Make `node/src/service.rs` spawn the GPU validator orchestrator if `--gpu-validator` CLI flag is set.

### Files to Modify
- `node/src/service.rs` — add orchestrator task spawn
- `node/src/rpc.rs` — expose health/telemetry gRPC endpoints
- `node/src/cli.rs` (or equiv) — add `--gpu-validator` flag

### Specific Changes

#### 1.1 Add GPU Validator Feature & Dependencies
```toml
# node/Cargo.toml
[dependencies]
x3-gpu-validator-swarm = { path = "../crates/x3-gpu-validator-swarm", optional = true }
gpu-sig-verifier = { path = "../crates/gpu-sig-verifier", optional = true }

[features]
default = []
gpu-validator = ["x3-gpu-validator-swarm", "gpu-sig-verifier"]
```

#### 1.2 Modify node/src/service.rs
Add after `TaskManager::new(...)` in the service setup:

```rust
// Wire GPU validator swarm if enabled
#[cfg(feature = "gpu-validator")]
if config.gpu_validator_enabled {
    let gpu_validator_task = {
        let orchestrator = x3_gpu_validator_swarm::orchestrator::SwarmOrchestrator::new(
            config.gpu_validator_config.clone(),
        );
        async move {
            orchestrator.run().await;
        }
    };
    task_manager.spawn_essential("gpu-validator-orchestrator", gpu_validator_task)?;
}
```

#### 1.3 Expose gRPC Endpoints
In `node/src/rpc.rs`, add GPU validator health + metrics:

```rust
pub fn create_gpu_validator_rpc() -> impl jsonrpc_core::Metadata + Default {
    let mut io = jsonrpc_core::IoHandler::new();
    
    // Health check
    io.add_method("gpu_validator_health", |_| {
        async_trait::async_trait::block_on(async {
            Ok(jsonrpc_core::Value::String("healthy".to_string()))
        })
    });
    
    // Metrics
    io.add_method("gpu_validator_metrics", |_| {
        async_trait::async_trait::block_on(async {
            // Return SwarmMetrics as JSON
            Ok(jsonrpc_core::to_value(&SwarmMetrics::current()).unwrap())
        })
    });
    
    io
}
```

### Success Criteria
- [ ] `cargo build --features=gpu-validator` succeeds
- [ ] `./x3-chain-node --gpu-validator` spawns orchestrator task without panic
- [ ] gRPC endpoints respond to `curl localhost:9944 -X POST ... -d '{"jsonrpc":"2.0","method":"gpu_validator_health"}'`

---

## Phase 2: Expose GpuValidatorApi Runtime API

### Objective
Allow GPU validator swarm to submit aggregated proofs to `pallet-x3-verifier` via a new `GpuValidatorApi` runtime API.

### Files to Modify
- `pallets/x3-verifier/src/runtime_api.rs` — define API
- `pallets/x3-verifier/src/lib.rs` — implement API handlers
- `runtime/src/lib.rs` — register API in runtime

### Specific Changes

#### 2.1 Define GpuValidatorApi
Create `pallets/x3-verifier/src/runtime_api.rs`:

```rust
use sp_api::decl_runtime_apis;
use sp_core::H256;
use sp_std::vec::Vec;

decl_runtime_apis! {
    pub trait GpuValidatorApi {
        /// Submit aggregated GPU validator proof for on-chain verification
        /// Returns proof hash on success
        fn submit_gpu_validator_proof(
            proof: Vec<u8>,
            aggregate_signature: Vec<u8>,
            validator_set_hash: H256,
        ) -> Result<H256, sp_runtime::DispatchError>;
        
        /// Query current GPU validator status
        fn gpu_validator_status() -> GpuValidatorStatus;
    }
}

#[derive(Clone, Encode, Decode, Eq, PartialEq, Debug)]
pub struct GpuValidatorStatus {
    pub is_enabled: bool,
    pub validator_count: u32,
    pub last_proof_hash: H256,
    pub last_proof_block: u32,
}
```

#### 2.2 Implement GpuValidatorApi in Runtime
In `runtime/src/lib.rs`, add after all other runtime API impls:

```rust
impl sp_runtime_api::GpuValidatorApi<Block> for Runtime {
    fn submit_gpu_validator_proof(
        proof: Vec<u8>,
        aggregate_signature: Vec<u8>,
        validator_set_hash: H256,
    ) -> Result<H256, sp_runtime::DispatchError> {
        // Verify proof signature
        let proof_hash = sp_io::hashing::blake2_256(&proof).into();
        
        // Call pallet-x3-verifier extrinsic
        pallet_x3_verifier::Pallet::<Self>::verify_gpu_proof(
            frame_system::RawOrigin::None.into(),
            proof,
            aggregate_signature,
            validator_set_hash,
        )?;
        
        Ok(proof_hash)
    }
    
    fn gpu_validator_status() -> GpuValidatorStatus {
        GpuValidatorStatus {
            is_enabled: true, // Read from pallet storage
            validator_count: pallet_x3_verifier::ValidatorCount::<Self>::get(),
            last_proof_hash: pallet_x3_verifier::LastProofHash::<Self>::get(),
            last_proof_block: pallet_x3_verifier::LastProofBlock::<Self>::get(),
        }
    }
}
```

#### 2.3 Add Runtime API Handler to Pallet
In `pallets/x3-verifier/src/lib.rs`, add:

```rust
#[pallet::call]
impl<T: Config> Pallet<T> {
    /// Verify GPU validator proof and apply state changes
    pub fn verify_gpu_proof(
        origin: OriginFor<T>,
        proof: Vec<u8>,
        aggregate_signature: Vec<u8>,
        validator_set_hash: T::Hash,
    ) -> DispatchResult {
        ensure_none(origin)?; // Only via runtime_api, not extrinsic
        
        // 1. Verify aggregate signature
        Self::verify_aggregate_signature(&aggregate_signature, &proof)?;
        
        // 2. Verify proof against validator set
        Self::verify_validator_set(&validator_set_hash)?;
        
        // 3. Store proof
        let proof_hash = T::Hashing::hash(&proof);
        LastProofHash::<T>::put(proof_hash);
        LastProofBlock::<T>::put(<frame_system::Pallet<T>>::block_number());
        
        Self::deposit_event(Event::GpuProofVerified { proof_hash });
        Ok(())
    }
}

// Storage items
#[pallet::storage]
pub type LastProofHash<T: Config> = StorageValue<_, T::Hash, ValueQuery>;

#[pallet::storage]
pub type LastProofBlock<T: Config> = StorageValue<_, T::BlockNumber, ValueQuery>;

#[pallet::storage]
pub type ValidatorCount<T: Config> = StorageValue<_, u32, ValueQuery>;
```

### Success Criteria
- [ ] `cargo build --release` succeeds
- [ ] `cargo test -p pallet-x3-verifier` passes
- [ ] GPU validator can call `submit_gpu_validator_proof` via runtime API without error

---

## Phase 3: Wire Cross-Chain GPU Validator

### Objective
Register state-root validation results from `crates/cross-chain-gpu-validator` with `pallet-x3-verifier`.

### Files to Modify
- `crates/cross-chain-gpu-validator/src/lib.rs` — add integration point
- `crates/cross-chain-gpu-validator/src/failover.rs` — complete failover logic
- `pallets/x3-verifier/src/lib.rs` — add external_root submission handler

### Specific Changes

#### 3.1 Add ChainState External Root Handler
In `pallets/x3-verifier/src/lib.rs`:

```rust
#[pallet::call]
impl<T: Config> Pallet<T> {
    /// Submit external chain state root (EVM/SVM) validated by GPU
    pub fn submit_external_root(
        origin: OriginFor<T>,
        chain_id: u32,
        block_number: u32,
        state_root: T::Hash,
        proof: Vec<u8>,
        validation_source: ValidationSource,  // GPU or CPU fallback
    ) -> DispatchResult {
        let submitter = ensure_signed(origin)?;
        
        // 1. Verify proof matches state root
        Self::verify_state_root_proof(&chain_id, &state_root, &proof)?;
        
        // 2. Store external root
        ExternalChainRoots::<T>::insert((chain_id, block_number), state_root);
        
        // 3. Award proof submitter
        let reward = Self::calculate_reward(&proof);
        T::Currency::transfer(&T::RewardSource::get(), &submitter, reward, KeepAlive)?;
        
        Self::deposit_event(Event::ExternalRootSubmitted {
            chain_id,
            block_number,
            state_root,
            source: validation_source,
        });
        Ok(())
    }
}

#[derive(Clone, Encode, Decode, Eq, PartialEq, Debug)]
pub enum ValidationSource {
    Gpu,
    CpuFallback,
}

#[pallet::storage]
pub type ExternalChainRoots<T: Config> = 
    StorageMap<_, Blake2_128Concat, (u32, u32), T::Hash, OptionQuery>;
```

#### 3.2 Wire cross-chain-gpu-validator to Submit
In `crates/cross-chain-gpu-validator/src/lib.rs`:

```rust
use sp_runtime::DispatchError;

pub struct CrossChainGpuValidator<Client> {
    client: Client,
}

impl<Client> CrossChainGpuValidator<Client> {
    /// Validate EVM state root and submit to chain
    pub async fn validate_and_submit_evm(
        &self,
        chain_id: u32,
        block_number: u32,
        evm_state_root: H256,
        proof: Vec<u8>,
    ) -> Result<(), DispatchError> {
        // 1. GPU validation (via crates/cross-chain-gpu-validator/evm_validator.rs)
        let gpu_result = self.evm_validator.validate_gpu(&evm_state_root).await
            .map_err(|_| DispatchError::Other("GPU validation failed"))?;
        
        // 2. CPU verification as fallback
        let cpu_result = self.evm_validator.validate_cpu(&evm_state_root).await
            .map_err(|_| DispatchError::Other("CPU validation failed"))?;
        
        // 3. Ensure GPU and CPU agree (divergence = quarantine)
        if gpu_result != cpu_result {
            self.failover_manager.trigger_quarantine(
                FailureReason::GpuCpuDivergence,
            ).await;
            return Err(DispatchError::Other("GPU/CPU divergence detected"));
        }
        
        // 4. Submit to chain via runtime API
        let runtime_api_result = self.client.submit_external_root(
            chain_id,
            block_number,
            evm_state_root.into(),
            proof,
            ValidationSource::Gpu,
        ).await;
        
        Ok(())
    }
}
```

#### 3.3 Implement Failover in failover.rs
In `crates/cross-chain-gpu-validator/src/failover.rs`:

```rust
pub struct FailoverManager {
    cpu_validator: CpuValidator,
    quarantine: QuarantineState,
}

impl FailoverManager {
    /// Fallback to CPU if GPU diverges
    pub async fn fallback_to_cpu(
        &self,
        chain_id: u32,
        state_root: H256,
    ) -> Result<ValidationResult, Error> {
        // Set flag that CPU path is active
        self.quarantine.mark_gpu_unavailable(chain_id).await;
        
        // Run CPU validation
        let result = self.cpu_validator.validate(&state_root).await?;
        
        Ok(result)
    }
    
    pub async fn trigger_quarantine(&self, reason: FailureReason) {
        // Log incident
        eprintln!("[GPU VALIDATOR] Quarantine triggered: {:?}", reason);
        
        // Mark validators as unhealthy
        self.quarantine.disable_gpu_path().await;
        
        // Alert monitoring system
        metrics::gpu_fallback_activated();
    }
}

#[derive(Debug)]
pub enum FailureReason {
    GpuCpuDivergence,
    TimeoutExceeded,
    InvalidProof,
}
```

### Success Criteria
- [ ] `cargo test -p cross-chain-gpu-validator` passes with failover tests
- [ ] GPU and CPU results match in test suite
- [ ] Quarantine triggers when divergence detected
- [ ] CPU fallback produces correct validation result

---

## Phase 4: Bind Cross-VM Bridge to Runtime

### Objective
Wire `crates/cross-vm-bridge` and `crates/cross-vm-coordinator` into `pallet-x3-kernel` adapters.

### Files to Modify
- `pallets/x3-kernel/src/adapters.rs` — add cross-vm dispatcher
- `pallets/x3-kernel/src/wasm_adapters.rs` — add WASM bridge interface
- `pallets/x3-kernel/src/lib.rs` — expose adapter extrinsics
- `pallets/x3-settlement-engine/src/lib.rs` — register Merkle settlement

### Specific Changes

#### 4.1 Implement Cross-VM Dispatcher in adapters.rs
In `pallets/x3-kernel/src/adapters.rs`:

```rust
use x3_cross_vm_bridge::{CrossVmBridge, CallMessage, CallResult};
use sp_core::{H256, H160};

pub struct RuntimeCrossVmDispatcher<T: Config> {
    bridge: CrossVmBridge,
    _phantom: PhantomData<T>,
}

impl<T: Config> RuntimeCrossVmDispatcher<T> {
    /// Dispatch cross-VM call (EVM → SVM or vice versa)
    pub fn dispatch_cross_vm_call(
        origin: OriginFor<T>,
        target_vm: VmType,
        contract_address: Vec<u8>,
        call_data: Vec<u8>,
    ) -> DispatchResult {
        let caller = ensure_signed(origin)?;
        
        // 1. Build call message
        let message = CallMessage {
            source: VmType::Evm,  // infer from caller
            target: target_vm,
            contract: contract_address.into(),
            payload: call_data,
            nonce: Self::next_cross_vm_nonce(&caller),
            value: 0,  // TODO: extract from extrinsic
        };
        
        // 2. Verify replay protection
        Self::verify_cross_vm_nonce(&caller, &message)?;
        
        // 3. Execute via bridge
        let result = self.bridge.execute_cross_vm(&message)
            .map_err(|_| Error::<T>::CrossVmExecutionFailed)?;
        
        // 4. Store result proof
        Self::store_cross_vm_result(&message, &result)?;
        
        Self::deposit_event(Event::CrossVmCallExecuted {
            caller: caller.clone(),
            target_vm,
            result: result.status,
        });
        
        Ok(())
    }
}

pub enum VmType {
    Evm,
    Svm,
}

#[pallet::storage]
pub type CrossVmNonces<T: Config> = 
    StorageMap<_, Blake2_128Concat, T::AccountId, u64, ValueQuery>;

#[pallet::storage]
pub type CrossVmResults<T: Config> = 
    StorageMap<_, Blake2_128Concat, (T::AccountId, u64), H256, OptionQuery>;
```

#### 4.2 Add WASM Call Interface
In `pallets/x3-kernel/src/wasm_adapters.rs`:

```rust
use sp_core::H256;

pub struct WasmCrossVmDispatcher;

impl WasmCrossVmDispatcher {
    /// Called from within WASM (x3-vm) to dispatch cross-VM calls
    pub fn wasm_call_into_evm(
        target_address: [u8; 20],
        call_data: &[u8],
    ) -> Result<Vec<u8>, String> {
        // Call into EVM via Bridge
        let result = Pallet::<T>::dispatch_cross_vm_call(
            VmType::Evm,
            target_address.to_vec(),
            call_data.to_vec(),
        ).map_err(|_| "EVM dispatch failed")?;
        
        Ok(result)
    }
    
    pub fn wasm_call_into_svm(
        program_id: [u8; 32],
        instruction: &[u8],
    ) -> Result<Vec<u8>, String> {
        // Call into SVM via Bridge
        let result = Pallet::<T>::dispatch_cross_vm_call(
            VmType::Svm,
            program_id.to_vec(),
            instruction.to_vec(),
        ).map_err(|_| "SVM dispatch failed")?;
        
        Ok(result)
    }
}
```

#### 4.3 Register in pallet-x3-settlement-engine
In `pallets/x3-settlement-engine/src/lib.rs`:

```rust
#[pallet::call]
impl<T: Config> Pallet<T> {
    /// Register Merkle settlement proof for atomic swap
    pub fn settle_merkle_proof(
        origin: OriginFor<T>,
        merkle_proof: Vec<u8>,
        settlement_root: H256,
    ) -> DispatchResult {
        let settler = ensure_signed(origin)?;
        
        // 1. Verify Merkle proof
        x3_cross_vm_bridge::merkle_proof_validator::verify_proof(&merkle_proof)?;
        
        // 2. Store settlement
        MerkleSettlements::<T>::insert(settlement_root, merkle_proof);
        
        // 3. Mark atomic swap as settled
        // (integration with atomic-trade-engine pallet)
        
        Self::deposit_event(Event::MerkleProofSettled {
            settler,
            settlement_root,
        });
        
        Ok(())
    }
}
```

### Success Criteria
- [ ] Cross-VM call dispatch compiles
- [ ] Replay nonce verification works in unit tests
- [ ] Merkle proof settlement stores proof correctly
- [ ] WASM bridge calls execute without error

---

## Phase 5: Expose External Chains Router in Chain Spec

### Objective
Make `crates/external-chains/src/router.rs` available as runtime configuration in `node/src/chain_spec.rs` so the relayer can discover all 60+ chains.

### Files to Modify
- `node/src/chain_spec.rs` — add chain registry config
- `runtime/src/lib.rs` — expose chain registry in runtime const
- `crates/external-chains/src/lib.rs` — add config builder

### Specific Changes

#### 5.1 Create Chain Registry Config Builder
In `crates/external-chains/src/lib.rs`:

```rust
use sp_core::H160;
use sp_std::vec::Vec;

#[derive(Clone, Debug)]
pub struct ChainRegistry {
    pub chains: Vec<ChainConfig>,
}

#[derive(Clone, Debug)]
pub struct ChainConfig {
    pub chain_id: u32,
    pub chain_name: &'static str,
    pub rpc_url: &'static str,
    pub block_explorer: &'static str,
    pub token_symbol: &'static str,
    pub l1_gateway: H160,  // Deposit/withdraw contract
    pub confirmation_depth: u32,
    pub bridges_supported: Vec<BridgeType>,
}

#[derive(Clone, Debug, PartialEq)]
pub enum BridgeType {
    Ethereum,
    Wormhole,
    IBC,
    BtcSpv,
    LayerZero,
}

impl ChainRegistry {
    pub fn mainnet() -> Self {
        ChainRegistry {
            chains: vec![
                ChainConfig {
                    chain_id: 1,
                    chain_name: "Ethereum",
                    rpc_url: "https://eth.infura.io/v3/...",
                    block_explorer: "https://etherscan.io",
                    token_symbol: "ETH",
                    l1_gateway: H160::from_low_u64_be(0x...),
                    confirmation_depth: 15,
                    bridges_supported: vec![BridgeType::Ethereum, BridgeType::Wormhole],
                },
                ChainConfig {
                    chain_id: 42161,
                    chain_name: "Arbitrum",
                    rpc_url: "https://arb1.arbitrum.io/rpc",
                    block_explorer: "https://arbiscan.io",
                    token_symbol: "AETH",
                    l1_gateway: H160::from_low_u64_be(0x...),
                    confirmation_depth: 1,
                    bridges_supported: vec![BridgeType::Wormhole, BridgeType::LayerZero],
                },
                // ... 58 more chains
            ],
        }
    }
    
    pub fn find_chain(&self, chain_id: u32) -> Option<&ChainConfig> {
        self.chains.iter().find(|c| c.chain_id == chain_id)
    }
    
    pub fn find_by_name(&self, name: &str) -> Option<&ChainConfig> {
        self.chains.iter().find(|c| c.chain_name == name)
    }
}
```

#### 5.2 Wire into Runtime Config
In `runtime/src/lib.rs`:

```rust
use external_chains::ChainRegistry;

/// Global chain registry (static, updated via runtime upgrade)
pub const X3_CHAIN_REGISTRY: ChainRegistry = ChainRegistry::mainnet();
```

#### 5.3 Expose in Chain Spec
In `node/src/chain_spec.rs`:

```rust
use external_chains::ChainRegistry;

pub struct ChainSpecConfig {
    pub chain_registry: ChainRegistry,
    pub relayer_config: RelayerConfig,
}

pub fn development_config() -> ChainSpec {
    let mut properties = sc_chain_spec::Properties::new();
    properties.insert("tokenSymbol".into(), "X3".into());
    properties.insert("tokenDecimals".into(), 18.into());
    
    // Load chain registry
    let chain_registry = ChainRegistry::mainnet();
    
    ChainSpec::from_genesis(
        "X3 Chain Development",
        "x3_dev",
        ChainType::Development,
        move || {
            testnet_genesis(
                vec![/* validators */],
                get_account_id_from_seed::<sr25519::Public>("Alice"),
                chain_registry.clone(),
            )
        },
        vec![],
        None,
        None,
        None,
        Some(properties),
        None,
    )
}

fn testnet_genesis(
    initial_authorities: Vec<(AccountId, AuraId, GrandpaId)>,
    root_key: AccountId,
    chain_registry: ChainRegistry,
) -> GenesisConfig {
    GenesisConfig {
        system: SystemConfig {
            code: WASM_BINARY.unwrap().to_vec(),
            ..Default::default()
        },
        
        // Store chain registry as runtime constant
        external_chains_config: external_chains::GenesisConfig {
            registry: chain_registry,
        },
        
        /* ... rest of genesis config */
    }
}
```

### Success Criteria
- [ ] `node/src/chain_spec.rs` compiles with ChainRegistry
- [ ] `./x3-chain-node --dev` starts with chain registry loaded
- [ ] RPC query can list all 60+ chains
- [ ] Relayer can access registry without querying blockchain

---

## Phase 6: Create X3 Relayer Service (NEW)

### Objective
Build `crates/x3-relayer/` — off-chain service that bridges `external-chains` → `pallet-x3-verifier`.

### Files to Create
- `crates/x3-relayer/Cargo.toml` — new crate
- `crates/x3-relayer/src/lib.rs` — main relayer logic
- `crates/x3-relayer/src/main.rs` — binary entry point
- `crates/x3-relayer/src/header_sync.rs` — chain header polling
- `crates/x3-relayer/src/proof_aggregator.rs` — proof collection

### Structure

```
crates/x3-relayer/
├── Cargo.toml
├── src/
│   ├── lib.rs          # Core relayer types and traits
│   ├── main.rs         # CLI entry point
│   ├── header_sync.rs  # Poll chain headers from external RPC
│   ├── proof_agg.rs    # Aggregate proofs from validators
│   ├── state_root.rs   # Compute/submit state roots
│   ├── failover.rs     # Fallback logic if X3 chain unavailable
│   └── config.rs       # Config file parsing
└── examples/
    ├── mainnet.toml    # Mainnet relayer config
    └── testnet.toml
```

#### 6.1 Core Relayer Skeleton
Create `crates/x3-relayer/src/lib.rs`:

```rust
use external_chains::{ChainRegistry, ChainConfig};
use sc_rpc_api::chain::ChainApi;
use sp_core::H256;
use std::sync::Arc;

pub struct X3Relayer {
    chain_registry: Arc<ChainRegistry>,
    rpc_client: Arc<SubstrateRpcClient>,
    polling_interval: Duration,
}

impl X3Relayer {
    pub fn new(
        registry: ChainRegistry,
        x3_rpc_url: &str,
        polling_interval: Duration,
    ) -> Result<Self, RelayerError> {
        let rpc_client = SubstrateRpcClient::connect(x3_rpc_url)?;
        
        Ok(X3Relayer {
            chain_registry: Arc::new(registry),
            rpc_client: Arc::new(rpc_client),
            polling_interval,
        })
    }
    
    /// Main relayer loop: poll all chains and submit proofs
    pub async fn run(&mut self) -> Result<(), RelayerError> {
        loop {
            for chain in &self.chain_registry.chains {
                if let Err(e) = self.sync_chain(chain).await {
                    eprintln!("[{}] sync error: {:?}", chain.chain_name, e);
                    continue;
                }
            }
            
            tokio::time::sleep(self.polling_interval).await;
        }
    }
    
    /// Sync a single chain: fetch headers, compute proofs, submit to X3
    async fn sync_chain(&self, chain: &ChainConfig) -> Result<(), RelayerError> {
        // 1. Poll latest block header from external RPC
        let latest_block = self.fetch_block_header(chain).await?;
        
        // 2. Check if already synced
        let last_synced = self.get_last_synced_block(chain.chain_id).await?;
        if latest_block.number <= last_synced {
            return Ok(());
        }
        
        // 3. Build Merkle proof of state root
        let state_root_proof = self.build_state_root_proof(chain, latest_block.number).await?;
        
        // 4. Submit proof to X3 chain via pallet-x3-verifier
        self.submit_external_root(
            chain.chain_id,
            latest_block.number,
            latest_block.state_root,
            state_root_proof,
        ).await?;
        
        // 5. Store watermark
        self.store_last_synced_block(chain.chain_id, latest_block.number).await?;
        
        Ok(())
    }
    
    async fn fetch_block_header(&self, chain: &ChainConfig) -> Result<BlockHeader, RelayerError> {
        // Connect to external chain RPC
        let client = reqwest::Client::new();
        let response = client
            .post(&chain.rpc_url)
            .json(&json!({
                "jsonrpc": "2.0",
                "method": "eth_getBlockByNumber",
                "params": ["latest", false],
                "id": 1,
            }))
            .send()
            .await?;
        
        let block = response.json::<BlockHeader>().await?;
        Ok(block)
    }
    
    async fn build_state_root_proof(
        &self,
        chain: &ChainConfig,
        block_number: u64,
    ) -> Result<Vec<u8>, RelayerError> {
        // TODO: call external-chains proof builder
        // For Ethereum: StateProof (Merkle path from block header to state root)
        // For Solana: SlotCommitment + ProofOfHistory
        Ok(vec![])
    }
    
    async fn submit_external_root(
        &self,
        chain_id: u32,
        block_number: u64,
        state_root: H256,
        proof: Vec<u8>,
    ) -> Result<(), RelayerError> {
        // Call pallet-x3-verifier::submit_external_root via RPC
        self.rpc_client.submit_external_root(
            chain_id,
            block_number as u32,
            state_root,
            proof,
            ValidationSource::Relayer,
        ).await?;
        
        Ok(())
    }
    
    async fn get_last_synced_block(&self, chain_id: u32) -> Result<u64, RelayerError> {
        // Query pallet-x3-verifier storage
        self.rpc_client.query_storage(
            "X3Verifier",
            "LastSyncedBlock",
            &chain_id.encode(),
        ).await
    }
    
    async fn store_last_synced_block(
        &self,
        chain_id: u32,
        block_number: u64,
    ) -> Result<(), RelayerError> {
        // Store locally in SQLite/RocksDB
        Ok(())
    }
}

#[derive(Debug)]
pub enum RelayerError {
    RpcConnectionFailed(String),
    ProofBuildingFailed(String),
    SubmissionFailed(String),
    StorageError(String),
}
```

#### 6.2 Binary Entry Point
Create `crates/x3-relayer/src/main.rs`:

```rust
use clap::Parser;
use external_chains::ChainRegistry;
use std::time::Duration;
use x3_relayer::X3Relayer;

#[derive(Parser, Debug)]
#[command(name = "x3-relayer")]
#[command(about = "X3 Cross-chain Relayer Service")]
struct Args {
    /// X3 chain RPC URL
    #[arg(long, default_value = "ws://localhost:9944")]
    x3_rpc: String,

    /// Config file path
    #[arg(long, default_value = "relayer-config.toml")]
    config: String,

    /// Polling interval in seconds
    #[arg(long, default_value = "30")]
    poll_interval: u64,
}

#[tokio::main]
async fn main() -> Result<(), Box<dyn std::error::Error>> {
    let args = Args::parse();

    // Load chain registry
    let registry = ChainRegistry::mainnet();

    // Create relayer
    let mut relayer = X3Relayer::new(
        registry,
        &args.x3_rpc,
        Duration::from_secs(args.poll_interval),
    )?;

    // Run forever
    relayer.run().await?;
    Ok(())
}
```

### Success Criteria
- [ ] `cargo build -p x3-relayer` succeeds
- [ ] `./x3-relayer --x3-rpc=ws://localhost:9944 --poll-interval=30` starts without panic
- [ ] Relayer successfully polls Ethereum testnet headers
- [ ] Submits proofs to local X3 testnet via pallet-x3-verifier RPC

---

## Phase 7: Wire Remaining Gaps (§3 Items 5–12)

### Quick Reference Table

| Item | Module | Wiring Point | PR Estimate |
|------|--------|--------------|-------------|
| 5 | `crates/x3-da` | Data availability commit verification in block import | 2 days |
| 6 | `crates/flash-finality` | Register gossip handler in node/src/flash_finality.rs | 1 day |
| 7 | `crates/parallel-proposer` | Bind into consensus via x3-consensus/parallel_proposer.rs | 2 days |
| 8 | `crates/poh-generator` + `x3-turbine` | Wire into block authoring pipeline | 2 days |
| 9 | `crates/quantum-crypto` | Feature gate + rotation API in pallet-governance | 1 day |
| 10 | `crates/custody-service` | Replace in-process signers in x3-wallet validator path | 3 days |
| 11 | `crates/x3-gateway` + `x3-sidecar` + `x3-indexer` | Verify runtime_api surface, add migrations | 2 days |
| 12 | `crates/x3-launch-validator` | Turn checks.rs into CI gate | 1 day |

**Est. Total for Phase 7:** 2–3 weeks (can run 2–3 in parallel)

---

## Phase 8: Integration Test (Zombienet)

### Objective
End-to-end scenario with 4 validators, 1 GPU validator, 2 relayers (Ethereum + Solana).

### Test Scenario
1. **Setup:** Start 4-validator zombienet + 1 GPU validator node + 1 relayer to goerli, 1 relayer to Solana devnet
2. **Deposit:** Send ERC-20 to X3 Gateway on Ethereum → mint on X3 chain
3. **Swap:** Execute MEV-protected swap (EVM → SVM cross-VM call)
4. **Withdraw:** Burn X3 token → claim on Ethereum
5. **Verify:** All state roots match, no divergence

---

## Dependency Graph

```
┌─────────────────────────────────────────────────────────────┐
│ Phase 1: GPU Validator → node/service.rs                    │
│ ✅ No blockers                                              │
└──────────────────┬──────────────────────────────────────────┘
                   │
                   ▼
┌─────────────────────────────────────────────────────────────┐
│ Phase 2: GpuValidatorApi runtime_api                        │
│ ✅ Depends on Phase 1                                       │
└──────────────────┬──────────────────────────────────────────┘
                   │
           ┌───────┴───────┐
           ▼               ▼
   ┌──────────────┐  ┌──────────────┐
   │ Phase 3:     │  │ Phase 4:     │
   │ Cross-chain  │  │ Cross-VM     │
   │ GPU Validator│  │ Bridge       │
   └──────────────┘  └──────────────┘
           │               │
           └───────┬───────┘
                   ▼
   ┌───────────────────────────────────┐
   │ Phase 5: External Chains Router    │
   │ Phase 6: X3 Relayer (NEW)         │
   │ ✅ Both can run in parallel       │
   └───────────────────────────────────┘
           │
           ▼
   ┌─────────────────────────────────────┐
   │ Phase 7: Remaining gaps (5–12)     │
   │ ✅ Can start after Phase 4 (independent)
   └─────────────────────────────────────┘
           │
           ▼
   ┌─────────────────────────────────────┐
   │ Phase 8: Zombienet Integration Test │
   │ ✅ Final validation                 │
   └─────────────────────────────────────┘
```

---

## Execution Timeline

**Parallel execution windows:**
- **Week 1:** Phases 1–2 (GPU validator wiring)
- **Week 2:** Phases 3–4 (GPU/Cross-VM integration) + start Phase 5–6 (relayer)
- **Week 3:** Phase 5–6 completion + Phase 7 items 1–4 in parallel
- **Week 4:** Phase 7 items 5–12 + final Phase 8 integration testing

---

## Success Criteria (RC-1 Complete)

- [ ] All 12 wiring gaps (§3) have entry points in code
- [ ] Every crate reachable from `node/src/service.rs` or `runtime_api`
- [ ] Cross-VM call round-trip (EVM → SVM → EVM) works on devnet
- [ ] GPU validator swarm submits proofs to pallet-x3-verifier
- [ ] Relayer successfully syncs 3+ external chains to X3
- [ ] All §8 RC-0 cleanup verified to still compile + tests pass
- [ ] CI pipeline (§6) configured and passing
- [ ] Zombienet scenario completes deposit → swap → withdraw

---

## Notes

- All code must pass `cargo fmt`, `cargo clippy -D warnings`, `cargo test`
- Determinism lint must pass: `cargo dylint --workspace`
- SBOM regenerated: `cargo cyclonedx --output-file x3-chain-runtime.cdx.json`
- No new `#![allow(...)]` lints added without justification

