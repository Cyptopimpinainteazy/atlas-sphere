use sc_client_api::{BlockBackend, BlockchainEvents};
use sc_consensus_aura::{ImportQueueParams, SlotProportion, StartAuraParams};
use sc_consensus_grandpa::SharedVoterState;
use sc_executor::NativeElseWasmExecutor;
use sc_service::{
    ChainType, Configuration, Error as ServiceError, KeystoreContainer, PartialComponents,
    TaskManager,
};
use sc_telemetry::{Telemetry, TelemetryWorker};
use sp_api::HeaderT;
use sp_consensus_aura::sr25519::AuthorityPair as AuraPair;
use sp_core::{crypto::KeyTypeId, Pair};
use sp_runtime::SaturatedConversion;
use std::sync::Arc;
use std::time::Duration;
use tokio::sync::oneshot;
/// X3 Chain node service module
///
/// Provides node initialization, partial components, and full service setup with:
/// - Aura (Authority Round) block authoring consensus
/// - GRANDPA finality gadget
/// - libp2p networking with peer discovery
/// - Proper block import queue with consensus verification
use x3_chain_runtime::{opaque::Block, RuntimeApi};

/// Key type for Aura block authoring
const AURA: KeyTypeId = KeyTypeId(*b"aura");
/// Key type for GRANDPA finality
const GRANDPA: KeyTypeId = KeyTypeId(*b"gran");

const TX_POOL_READY_COUNT: usize = 100_000;
const TX_POOL_FUTURE_COUNT: usize = 50_000;
const TX_POOL_TOTAL_BYTES: usize = 20 * 1024 * 1024;
const TX_POOL_BAN_TIME_SECS: u64 = 30;

/// Rollout feature flags for consensus and execution paths.
#[derive(Debug, Clone, Copy, Default)]
pub struct NodeFeatureFlags {
    pub enable_parallel_proposer: bool,
    pub enable_flash_finality: bool,
    pub enable_poh: bool,
    pub gpu_required: bool,
    pub enable_gpu_validation: bool,
}

/// X3 Chain native executor implementation
pub struct AtlasSphereExecutorDispatch;

impl sc_executor::NativeExecutionDispatch for AtlasSphereExecutorDispatch {
    type ExtendHostFunctions = sp_io::SubstrateHostFunctions;

    fn dispatch(method: &str, data: &[u8]) -> Option<Vec<u8>> {
        x3_chain_runtime::api::dispatch(method, data)
    }

    fn native_version() -> sc_executor::NativeVersion {
        x3_chain_runtime::native_version()
    }
}

/// Executor for X3 Chain
///
/// In normal builds we use `NativeElseWasmExecutor` so the node can
/// execute both natively and via the embedded WASM runtime. For
/// `skip-wasm-build` development builds, we force a pure native
/// executor to avoid deserializing a missing or dummy WASM blob.
pub type Executor = NativeElseWasmExecutor<AtlasSphereExecutorDispatch>;

/// Full client type alias
pub type FullClient = sc_service::TFullClient<Block, RuntimeApi, Executor>;

/// Full backend type alias
pub type FullBackend = sc_service::TFullBackend<Block>;

/// Type alias for select chain implementation
pub type SelectChain = sc_consensus::LongestChain<FullBackend, Block>;

fn spawn_gpu_validation_shadow(
    spawn_handle: sc_service::SpawnTaskHandle,
    gpu_required: bool,
) {
    spawn_handle.spawn("gpu-validation-shadow", None, async move {
        let config = gpu_sig_verifier::VerifierConfig::default();
        let verifier = gpu_sig_verifier::GPUSignatureVerifier::new(config);
        let mut interval = tokio::time::interval(Duration::from_secs(10));

        loop {
            interval.tick().await;

            let sample_signature = "shadow-signature";
            let sample_payload = b"shadow-payload";
            let gpu_result = verifier.verify_signature(sample_signature, sample_payload).await;

            match gpu_result {
                Ok(result) => {
                    if !result.verified && gpu_required {
                        log::warn!(
                            "GPU validation required but sample verification failed: {:?}",
                            result.error_message
                        );
                    } else {
                        log::debug!(
                            "GPU validation shadow check ok: verified={}, time_ms={}",
                            result.verified,
                            result.verification_time_ms
                        );
                    }
                }
                Err(err) => {
                    if gpu_required {
                        log::warn!("GPU validation required but verifier errored: {}", err);
                    } else {
                        log::debug!("GPU validation shadow errored: {}", err);
                    }
                }
            }
        }
    });
}

/// Insert development keys into the keystore for block authoring.
///
/// For development mode (`--dev`), this inserts Alice's Aura (sr25519) and
/// GRANDPA (ed25519) keys into the keystore so the node can author blocks.
fn insert_dev_keys_with_seed(keystore: &KeystoreContainer, seed: &str) -> Result<(), ServiceError> {
    use sp_core::crypto::SecretStringError;

    let keystore = keystore.keystore();

    // Insert Aura key (sr25519) for block authoring
    let aura_pair =
        sp_core::sr25519::Pair::from_string(seed, None).map_err(|e: SecretStringError| {
            ServiceError::Other(format!("Failed to generate Aura keypair: {:?}", e))
        })?;
    keystore
        .insert(AURA, seed, &aura_pair.public().0)
        .map_err(|e| ServiceError::Other(format!("Failed to insert Aura key: {:?}", e)))?;

    log::info!("🔑 Inserted Aura key for block authoring");

    // Insert GRANDPA key (ed25519) for finality
    let grandpa_pair =
        sp_core::ed25519::Pair::from_string(seed, None).map_err(|e: SecretStringError| {
            ServiceError::Other(format!("Failed to generate GRANDPA keypair: {:?}", e))
        })?;
    keystore
        .insert(GRANDPA, seed, &grandpa_pair.public().0)
        .map_err(|e| ServiceError::Other(format!("Failed to insert GRANDPA key: {:?}", e)))?;

    log::info!("🔑 Inserted GRANDPA key for finality");

    Ok(())
}

fn maybe_insert_dev_keys(
    config: &Configuration,
    keystore: &KeystoreContainer,
) -> Result<(), ServiceError> {
    // If X3_DEV_SEED is set, insert that key regardless of chain type (testnet convenience).
    if let Ok(seed) = std::env::var("X3_DEV_SEED") {
        log::info!("🔑 Inserting dev keys from X3_DEV_SEED");
        return insert_dev_keys_with_seed(keystore, &seed);
    }

    // For development chains, insert Alice's keys for block authoring
    if config.chain_spec.chain_type() == ChainType::Development {
        return insert_dev_keys_with_seed(keystore, "//Alice");
    }

    Ok(())
}

fn tuned_transaction_pool_options(
    mut options: sc_transaction_pool::Options,
) -> sc_transaction_pool::Options {
    options.ready.count = options.ready.count.max(TX_POOL_READY_COUNT);
    options.future.count = options.future.count.max(TX_POOL_FUTURE_COUNT);
    options.ready.total_bytes = options.ready.total_bytes.max(TX_POOL_TOTAL_BYTES);
    options.future.total_bytes = options.future.total_bytes.max(TX_POOL_TOTAL_BYTES);
    options.ban_time = Duration::from_secs(TX_POOL_BAN_TIME_SECS);
    options
}

/// Apply the tuned limits to a runtime configuration before the pool is built.
pub fn tune_transaction_pool_config(config: &mut Configuration) {
    config.transaction_pool = tuned_transaction_pool_options(config.transaction_pool.clone());
}

/// Create partial components for X3 Chain node
///
/// Returns the common components needed by various subcommands (benchmarking, export, etc.)
pub fn new_partial(
    config: &Configuration,
) -> Result<
    PartialComponents<
        FullClient,
        FullBackend,
        SelectChain,
        sc_consensus::DefaultImportQueue<Block, FullClient>,
        sc_transaction_pool::FullPool<Block, FullClient>,
        (
            sc_consensus_grandpa::GrandpaBlockImport<FullBackend, Block, FullClient, SelectChain>,
            sc_consensus_grandpa::LinkHalf<Block, FullClient, SelectChain>,
            Option<Telemetry>,
        ),
    >,
    ServiceError,
> {
    // Set up telemetry if endpoints are configured
    let telemetry = config
        .telemetry_endpoints
        .clone()
        .filter(|x| !x.is_empty())
        .map(|endpoints| -> Result<_, sc_telemetry::Error> {
            let worker = TelemetryWorker::new(16)?;
            let telemetry = worker.handle().new_telemetry(endpoints);
            Ok((worker, telemetry))
        })
        .transpose()?;

    // Create executor
    let executor = Executor::new(config.wasm_method, None, 8, 64);

    // Build partial components
    let (client, backend, keystore_container, task_manager) =
        sc_service::new_full_parts::<Block, RuntimeApi, _>(
            &config,
            telemetry.as_ref().map(|(_, telemetry)| telemetry.handle()),
            executor,
        )?;

    // For dev chains or when X3_DEV_SEED is set, insert keys for block authoring.
    maybe_insert_dev_keys(config, &keystore_container)?;

    let client = Arc::new(client);

    let telemetry = telemetry.map(|(worker, telemetry)| {
        task_manager
            .spawn_handle()
            .spawn("telemetry", None, worker.run());
        telemetry
    });

    // Select chain implementation (longest chain rule)
    let select_chain = sc_consensus::LongestChain::new(backend.clone());

    // Create transaction pool with tuned limits to reduce rejection under heavy load
    let transaction_pool = sc_transaction_pool::BasicPool::new_full(
        config.transaction_pool.clone(),
        config.role.is_authority().into(),
        config.prometheus_registry(),
        task_manager.spawn_essential_handle(),
        client.clone(),
    );

    // Create GRANDPA block import wrapper
    let (grandpa_block_import, grandpa_link) = sc_consensus_grandpa::block_import(
        client.clone(),
        &client,
        select_chain.clone(),
        telemetry.as_ref().map(|x| x.handle()),
    )?;

    // Create Aura import queue with proper block verification
    let slot_duration = sc_consensus_aura::slot_duration(&*client)?;

    let import_queue =
        sc_consensus_aura::import_queue::<AuraPair, _, _, _, _, _>(ImportQueueParams {
            block_import: grandpa_block_import.clone(),
            justification_import: Some(Box::new(grandpa_block_import.clone())),
            client: client.clone(),
            create_inherent_data_providers: move |_, ()| async move {
                let timestamp = sp_timestamp::InherentDataProvider::from_system_time();

                let slot =
					sp_consensus_aura::inherents::InherentDataProvider::from_timestamp_and_slot_duration(
						*timestamp,
						slot_duration,
					);

                Ok((slot, timestamp))
            },
            spawner: &task_manager.spawn_essential_handle(),
            registry: config.prometheus_registry(),
            check_for_equivocation: Default::default(),
            telemetry: telemetry.as_ref().map(|x| x.handle()),
            compatibility_mode: Default::default(),
        })?;

    Ok(PartialComponents {
        client,
        backend,
        task_manager,
        keystore_container,
        select_chain,
        import_queue,
        transaction_pool,
        other: (grandpa_block_import, grandpa_link, telemetry),
    })
}

/// Start a new X3 Chain full node with complete consensus and networking
pub fn new_full(
    mut config: Configuration,
    feature_flags: NodeFeatureFlags,
) -> Result<TaskManager, ServiceError> {
    tune_transaction_pool_config(&mut config);
    let sc_service::PartialComponents {
        client,
        backend,
        mut task_manager,
        keystore_container,
        select_chain,
        import_queue,
        transaction_pool,
        other: (grandpa_block_import, grandpa_link, mut telemetry),
    } = new_partial(&config)?;

    let mut net_config = sc_network::config::FullNetworkConfiguration::new(&config.network);

    let grandpa_protocol_name = sc_consensus_grandpa::protocol_standard_name(
        &client.block_hash(0)?.expect("Genesis block exists; qed"),
        &config.chain_spec,
    );

    net_config.add_notification_protocol(sc_consensus_grandpa::grandpa_peers_set_config(
        grandpa_protocol_name.clone(),
    ));

    let warp_sync = Arc::new(sc_consensus_grandpa::warp_proof::NetworkProvider::new(
        backend.clone(),
        grandpa_link.shared_authority_set().clone(),
        Vec::default(),
    ));

    // Build networking service
    let (network, system_rpc_tx, tx_handler_controller, network_starter, sync_service) =
        sc_service::build_network(sc_service::BuildNetworkParams {
            config: &config,
            net_config,
            client: client.clone(),
            transaction_pool: transaction_pool.clone(),
            spawn_handle: task_manager.spawn_handle(),
            import_queue,
            block_announce_validator_builder: None,
            warp_sync_params: Some(sc_service::WarpSyncParams::WithProvider(warp_sync)),
        })?;

    let role = config.role.clone();
    let force_authoring = config.force_authoring;
    let backoff_authoring_blocks: Option<()> = None;
    let name = config.network.node_name.clone();
    let chain_name = config.chain_spec.name().to_string();
    let enable_grandpa = !config.disable_grandpa;
    let prometheus_registry = config.prometheus_registry().cloned();
    let role_for_grandpa = role.clone();

    if feature_flags.enable_parallel_proposer {
        log::warn!(
            "⚠️ --enable-parallel-proposer is set, but node wiring still uses basic authorship. \
            Keep this in shadow mode until deterministic scheduler integration is complete."
        );
    }
    if feature_flags.enable_flash_finality {
        log::warn!(
            "⚠️ --enable-flash-finality is set, but GRANDPA remains the active finality engine in this build."
        );
    }
    if feature_flags.enable_poh {
        log::warn!(
            "⚠️ --enable-poh is set, but PoH digest verification is not yet enforced in block import."
        );
    }
    if feature_flags.gpu_required {
        log::warn!(
            "⚠️ --gpu-required=true is set; ensure CPU fallback is not relied on by your deployment policy."
        );
    }
    if feature_flags.enable_gpu_validation {
        log::info!("GPU validation shadow mode enabled.");
        spawn_gpu_validation_shadow(task_manager.spawn_handle(), feature_flags.gpu_required);
    }

    // Spawn core Substrate tasks (RPC, network, telemetry, txpool, offchain, etc.)
    let rpc_builder = {
        let client = client.clone();
        let transaction_pool = transaction_pool.clone();
        Box::new(move |deny_unsafe, subscription_executor| {
            crate::rpc::create_full(
                client.clone(),
                transaction_pool.clone(),
                deny_unsafe,
                subscription_executor,
            )
            .map_err(|e| ServiceError::Other(format!("RPC module creation failed: {:?}", e)))
        })
    };

    sc_service::spawn_tasks(sc_service::SpawnTasksParams {
        config,
        client: client.clone(),
        backend: backend.clone(),
        task_manager: &mut task_manager,
        keystore: keystore_container.keystore(),
        transaction_pool: transaction_pool.clone(),
        rpc_builder,
        network: network.clone(),
        system_rpc_tx,
        tx_handler_controller,
        sync_service: sync_service.clone(),
        telemetry: telemetry.as_mut(),
    })?;

    // Start Aura block authoring if this is an authority node
    if role.is_authority() {
        let proposer_factory = sc_basic_authorship::ProposerFactory::new(
            task_manager.spawn_handle(),
            client.clone(),
            transaction_pool.clone(),
            prometheus_registry.as_ref(),
            telemetry.as_ref().map(|x| x.handle()),
        );

        let slot_duration = sc_consensus_aura::slot_duration(&*client)?;

        let aura = sc_consensus_aura::start_aura::<AuraPair, _, _, _, _, _, _, _, _, _, _>(
            StartAuraParams {
                slot_duration,
                client: client.clone(),
                select_chain,
                block_import: grandpa_block_import,
                proposer_factory,
                create_inherent_data_providers: move |_, ()| async move {
                    let timestamp = sp_timestamp::InherentDataProvider::from_system_time();

                    let slot =
						sp_consensus_aura::inherents::InherentDataProvider::from_timestamp_and_slot_duration(
							*timestamp,
							slot_duration,
						);

                    Ok((slot, timestamp))
                },
                force_authoring,
                backoff_authoring_blocks,
                keystore: keystore_container.keystore(),
                sync_oracle: sync_service.clone(),
                justification_sync_link: sync_service.clone(),
                block_proposal_slot_portion: SlotProportion::new(0.9f32),
                max_block_proposal_slot_portion: None,
                telemetry: telemetry.as_ref().map(|x| x.handle()),
                compatibility_mode: Default::default(),
            },
        )?;

        task_manager
            .spawn_essential_handle()
            .spawn_blocking("aura", Some("block-authoring"), aura);
    }

    // Start GRANDPA finality gadget
    if enable_grandpa {
        let grandpa_config = sc_consensus_grandpa::Config {
            gossip_duration: std::time::Duration::from_millis(100),
            justification_period: 64,
            name: Some(name.clone()),
            observer_enabled: false,
            keystore: Some(keystore_container.keystore()),
            local_role: role_for_grandpa,
            telemetry: telemetry.as_ref().map(|x| x.handle()),
            protocol_name: grandpa_protocol_name,
        };

        // Create GRANDPA parameters with offchain transaction pool
        let offchain_tx_pool_factory =
            sc_transaction_pool_api::OffchainTransactionPoolFactory::new(transaction_pool.clone());

        let grandpa_params = sc_consensus_grandpa::GrandpaParams {
            config: grandpa_config,
            link: grandpa_link,
            network,
            sync: Arc::new(sync_service),
            voting_rule: sc_consensus_grandpa::VotingRulesBuilder::default().build(),
            prometheus_registry,
            shared_voter_state: SharedVoterState::empty(),
            telemetry: telemetry.as_ref().map(|x| x.handle()),
            offchain_tx_pool_factory,
        };

        task_manager.spawn_essential_handle().spawn_blocking(
            "grandpa-voter",
            None,
            sc_consensus_grandpa::run_grandpa_voter(grandpa_params)?,
        );
    }

    // Start the network
    network_starter.start_network();

    // Spawn a background task to watch finalized blocks and log events with emojis
    {
        let client = client.clone();
        task_manager
            .spawn_handle()
            .spawn("import-watcher", None, async move {
                use futures_util::StreamExt;

                let mut notifications = client.import_notification_stream();
                while let Some(notification) = notifications.next().await {
                    let number: u64 = (*notification.header.number()).saturated_into();
                    log::info!("🟡 Block imported: #{} — syncing state", number);
                }
            });
    }

    {
        let client = client.clone();
        task_manager
            .spawn_handle()
            .spawn("block-watcher", None, async move {
                use futures_util::StreamExt;

                let mut notifications = client.finality_notification_stream();
                while let Some(notification) = notifications.next().await {
                    // number is saturated into u64
                    let number: u64 = (*notification.header.number()).saturated_into();
                    log::info!("🔔 Block finalized: #{} ✅", number);
                }
            });
    }

    log::info!("✨ X3 Chain node started successfully");
    log::info!("🔗 Network: {}", chain_name);
    log::info!("👤 Node name: {}", name);
    log::info!("📋 Role: {:?}", role);

    Ok(task_manager)
}
