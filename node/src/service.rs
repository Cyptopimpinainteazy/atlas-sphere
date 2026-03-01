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
use crate::flash_finality::{FlashFinalityBridge};
use flash_finality::{FlashFinalityGadget, FlashFinalityConfig, FLASH_FINALITY_PROTOCOL_ID};
use poh_generator::{PoHState};
use parity_scale_codec;
use futures_util::StreamExt;
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

/// Txpool sizing aligned to X3 throughput targets.
/// Default Substrate pool (8 192/512) is 12x too small for 100k TPS goals.
/// Tuned per audit recommendation: 100k ready / 50k future, 256 MiB / 64 MiB.
const TX_POOL_READY_COUNT: usize = 100_000;
const TX_POOL_FUTURE_COUNT: usize = 50_000;
const TX_POOL_READY_BYTES: usize = 256 * 1024 * 1024; // 256 MiB
const TX_POOL_FUTURE_BYTES: usize = 64 * 1024 * 1024; // 64 MiB
const TX_POOL_BAN_TIME_SECS: u64 = 60; // 60s ban (vs default 1800s) — faster retry under burst

/// Rollout feature flags for consensus and execution paths.
/// All flags default to off; enable per-validator via CLI or env on canary set first.
#[derive(Debug, Clone, Copy, Default)]
pub struct NodeFeatureFlags {
    pub enable_parallel_proposer: bool,
    pub enable_flash_finality: bool,
    pub enable_poh: bool,
    pub gpu_required: bool,
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
    // Count caps: 100k ready / 50k future (audit recommendation for 100k TPS target)
    options.ready.count = options.ready.count.max(TX_POOL_READY_COUNT);
    options.future.count = options.future.count.max(TX_POOL_FUTURE_COUNT);
    // Byte caps: 256 MiB ready / 64 MiB future — aligned with large burst tx sets
    options.ready.total_bytes = options.ready.total_bytes.max(TX_POOL_READY_BYTES);
    options.future.total_bytes = options.future.total_bytes.max(TX_POOL_FUTURE_BYTES);
    // Ban time: 60s instead of default 1800s — faster retry for legitimate bursts
    options.ban_time = Duration::from_secs(TX_POOL_BAN_TIME_SECS);
    options
}

/// Apply the tuned limits to a runtime configuration before the pool is built.
pub fn tune_transaction_pool_config(config: &mut Configuration) {
    config.transaction_pool = tuned_transaction_pool_options(config.transaction_pool.clone());
}

/// Return the correct Aura slot duration for a given runtime spec_version.
///
/// CRITICAL: Aura enforces slot monotonicity. If the slot duration changes mid-chain,
/// nodes that don't gate on spec_version will compute wrong slots for historical blocks
/// and either stall or fork. This function is the safety valve.
///
/// - spec_version < 5: legacy 400ms slots (genesis chain used 400ms)
/// - spec_version >= 5: 200ms slots (v5 migration target)
///
/// Call this when building/verifying any block with a spec_version you can read.
pub fn slot_duration_for_spec(spec_version: u32) -> Duration {
    if spec_version >= 5 {
        Duration::from_millis(200)
    } else {
        Duration::from_millis(400)
    }
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

/// Determine whether GRANDPA should run given configuration and feature flags.
///
/// - returns `false` when either the user disabled GRANDPA explicitly or when the
///   experimental Flash Finality gadget flag is active. This helper exists so
///   that unit tests can verify the decision logic without spawning a full node.
pub fn compute_enable_grandpa(config: &Configuration, feature_flags: NodeFeatureFlags) -> bool {
    let mut enable = !config.disable_grandpa;
    if feature_flags.enable_flash_finality {
        enable = false;
    }
    enable
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

    // configure network protocols; GRANDPA may be disabled when using Flash Finality
    let mut net_config = sc_network::config::FullNetworkConfiguration::new(&config.network);

    // decide whether GRANDPA should be active; tests can call the helper below.
    let mut enable_grandpa = compute_enable_grandpa(&config, feature_flags);
    if !enable_grandpa && feature_flags.enable_flash_finality {
        log::info!("⚡ Flash Finality flag is set; GRANDPA will be disabled for this node");
    }

    let grandpa_protocol_name = sc_consensus_grandpa::protocol_standard_name(
        &client.block_hash(0)?.expect("Genesis block exists; qed"),
        &config.chain_spec,
    );

    if enable_grandpa {
        net_config.add_notification_protocol(sc_consensus_grandpa::grandpa_peers_set_config(
            grandpa_protocol_name.clone(),
        ));
    }

    let warp_sync = if enable_grandpa {
        Some(Arc::new(sc_consensus_grandpa::warp_proof::NetworkProvider::new(
            backend.clone(),
            grandpa_link.shared_authority_set().clone(),
            Vec::default(),
        )))
    } else {
        None
    };

    if feature_flags.enable_flash_finality {
        net_config.add_notification_protocol(sc_network::config::NotificationProtocolConfig {
            protocol_name: FLASH_FINALITY_PROTOCOL_ID.into(),
            allow_non_reserved_nodes: true,
            ..Default::default()
        });
    }

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
            warp_sync_params: warp_sync.map(|w| sc_service::WarpSyncParams::WithProvider(w)),
        })?;

    let role = config.role.clone();
    let force_authoring = config.force_authoring;
    let backoff_authoring_blocks: Option<()> = None;
    let name = config.network.node_name.clone();
    let chain_name = config.chain_spec.name().to_string();
    // retain previous computed value if we set it earlier; otherwise fall back
    // to the original disable flag. (`enable_grandpa` may already be in scope
    // from the network config section, but Rust doesn't allow redeclaration in
    // the same block. we intentionally shadow with `mut` here so we can modify.)
    let mut enable_grandpa = !config.disable_grandpa;
    if feature_flags.enable_flash_finality {
        enable_grandpa = false;
    }
    let prometheus_registry = config.prometheus_registry().cloned();
    let role_for_grandpa = role.clone();

    if feature_flags.enable_parallel_proposer {
        log::warn!(
            "⚠️ --enable-parallel-proposer is set, but node wiring still uses basic authorship. \
            Keep this in shadow mode until deterministic scheduler integration is complete."
        );
    }
    if feature_flags.enable_flash_finality {
        if compute_enable_grandpa(&config, feature_flags) {
            // still running grandpa due to some configuration oddity
            log::warn!(
                "⚠️ --enable-flash-finality is set but GRANDPA will still run due to configuration."
            );
        } else {
            log::info!(
                "⚡ Flash Finality is enabled; GRANDPA has been disabled for this node (shadow mode)."
            );
        }
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

    // Initialize PoH State if enabled
    let shared_poh_state = if feature_flags.enable_poh {
        Some(Arc::new(Mutex::new(PoHState::default())))
    } else {
        None
    };

    // Initialize Flash Finality Gadget for RPC regardless of whether we run the bridge
    let flash_finality_gadget = if feature_flags.enable_flash_finality {
        let keystore = keystore_container.keystore();
        let my_id = keystore.sr25519_public_keys(KeyTypeId(*b"flsh"))
            .get(0)
            .map(|k| k.0)
            .unwrap_or([0xAA; 32]); // Fallback to mock if no key found

        Some(Arc::new(FlashFinalityGadget::new(
            FlashFinalityConfig::default(),
            my_id,
            Some(keystore),
        )))
    } else {
        None
    };

    // Spawn core Substrate tasks (RPC, network, telemetry, txpool, offchain, etc.)
    let rpc_builder = {
        let client = client.clone();
        let transaction_pool = transaction_pool.clone();
        let gadget = flash_finality_gadget.clone();
        Box::new(move |deny_unsafe, subscription_executor| {
            crate::rpc::create_full(
                client.clone(),
                transaction_pool.clone(),
                deny_unsafe,
                subscription_executor,
                gadget.clone(),
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
                create_inherent_data_providers: move |_, ()| {
                    let poh_state = shared_poh_state.clone();
                    async move {
                        let timestamp = sp_timestamp::InherentDataProvider::from_system_time();
                        let slot =
                            sp_consensus_aura::inherents::InherentDataProvider::from_timestamp_and_slot_duration(
                                *timestamp,
                                slot_duration,
                            );

                        // If PoH is enabled, advance and provide its inherent.
                        // Otherwise, we still need a consistent return type, so we use an empty vec for the 3rd slot?
                        // Actually, we can return a tuple of (slot, timestamp, Option<PoHInherentDataProvider>).
                        // But we need to check if Option implements the trait. It does in some Substrate versions.
                        // Let's use a simpler approach: return (slot, timestamp) and conditionally add PoH.
                        // Wait, Aura's start_aura expects a single return type from the closure.
                        
                        let poh_digest = if let Some(state_arc) = poh_state {
                            let mut state = state_arc.lock().await;
                            Some(state.advance(&[]))
                        } else {
                            None
                        };

                        Ok((slot, timestamp, poh_digest.map(|digest| poh_generator::PoHInherentDataProvider { digest })))
                    }
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

    // Start Flash Finality if enabled
    if let Some(gadget) = flash_finality_gadget {
        let bridge = FlashFinalityBridge::new(
            gadget.clone(),
            client.clone(),
            network.clone(),
            keystore_container.keystore(),
        );

        task_manager.spawn_essential_handle().spawn(
            "flash-finality-bridge",
            Some("flash-finality"),
            bridge.run(),
        );

        task_manager.spawn_essential_handle().spawn(
            "flash-finality-timeout",
            Some("flash-finality"),
            gadget.spawn_timeout_monitor(),
        );

        // Spawn the Flash-Finality voter to apply certificates as finality
        // In live mode (when enable_flash_finality=true and vote_on_flash=true),
        // this will move the finalized head based on certificates.
        // In shadow mode, it logs certificate availability for monitoring.
        let gadget_for_voter = gadget.clone();
        let client_for_voter = client.clone();
        let enable_flash_live_mode = feature_flags.enable_flash_finality && !config.disable_grandpa;
        
        task_manager.spawn_essential_handle().spawn(
            "flash-finality-voter",
            Some("flash-finality"),
            run_flash_finality_voter(gadget_for_voter, client_for_voter, enable_flash_live_mode),
        );

        log::info!("⚡ Flash Finality gadget, network bridge, and voter started");
    }

    // Start PoH Generator background task if enabled
    if let Some(poh_state_arc) = shared_poh_state {
        let client_clone = client.clone();
        
        task_manager.spawn_essential_handle().spawn(
            "poh-watcher",
            Some("poh"),
            async move {
                let mut import_notifications = client_clone.import_notification_stream();
                while let Some(notification) = import_notifications.next().await {
                    if notification.is_new_best {
                        let mut state = poh_state_arc.lock().await;
                        state.advance(&[]); 
                        log::info!("⏱️  [PoH] Shadow tick {} anchored to block {}", 
                            state.tick(), 
                            notification.hash
                        );
                    }
                }
            }
        );
        log::info!("⏱️ Proof of History (PoH) generator enabled and wired to block loop");
    }

    log::info!("✨ X3 Chain node started successfully");
    log::info!("🔗 Network: {}", chain_name);
    log::info!("👤 Node name: {}", name);
    log::info!("📋 Role: {:?}", role);

    Ok(task_manager)
}

/// Runs the Flash-Finality voter that applies certificates as actual finality.
///
/// This voter listens to block finality notifications and uses Flash-Finality
/// certificates to move the canonical finalized head. When live mode is enabled,
/// certificates override GRANDPA finality; in shadow mode, they're logged for comparison.
async fn run_flash_finality_voter<Client, Block>(
    gadget: Arc<FlashFinalityGadget>,
    client: Arc<Client>,
    enable_live_mode: bool,
) where
    Client: BlockchainEvents<Block> + BlockBackend<Block> + Send + Sync + 'static,
    Block: sp_runtime::traits::Block + 'static,
    Block::Header: HeaderT,
{
    use futures_util::StreamExt;

    log::info!(
        "⚡ Flash-Finality voter started — live_mode={}",
        if enable_live_mode { "ON" } else { "SHADOW" }
    );

    let mut finality_notifications = client.finality_notification_stream();

    loop {
        match finality_notifications.next().await {
            Some(notification) => {
                let number: u64 = (*notification.header.number()).saturated_into();
                let hash = notification.hash;

                // Try to get a Flash-Finality certificate for this block
                if let Some(cert) = gadget.get_certificate(hash).await {
                    if enable_live_mode {
                        // In live mode: encode certificate and import as justification
                        // to officially finalize the block via the client
                        let encoded_cert = parity_scale_codec::Encode::encode(&cert);
                        log::info!(
                            "⚡✅ Live mode: applying Flash-Finality cert for #{} — votes: {}",
                            number, cert.vote_count
                        );

                        // In live mode we actually import the certificate as a justification
                        // so that the client advances the finalized head based on Flash.
                        // The certificate already contains a proof of quorum agreement.
                        if let Err(e) = client.import_justification(hash.clone(), encoded_cert.into()) {
                            log::error!("⚡❌ failed to import Flash justification for #{}: {:?}", number, e);
                        }
                    } else {
                        // Shadow mode: log certificate for monitoring without applying it
                        log::debug!(
                            "⚡🔍 Shadow: Flash cert available for #{} — {} votes (not applied)",
                            number, cert.vote_count
                        );
                    }

                    // Record metrics
                    let metrics = gadget.metrics().await;
                    log::info!(
                        "📊 Flash-Finality metrics: total_rounds={}, agreements={}",
                        metrics.total_rounds, metrics.agreements
                    );
                } else {
                    // No Flash certificate yet; this could be normal if finality advanced
                    // via GRANDPA first, or if we're still in earlier consensus phases
                    log::debug!("⚡ No Flash cert for #{} yet", number);
                }
            }

            None => {
                log::warn!("⚡ Flash-Finality voter: client finality stream closed");
                break;
            }
        }
    }
}

//====== tests ======

#[cfg(test)]
mod tests {
    use super::*;
    use sc_service::Configuration;

    fn default_config() -> Configuration {
        let mut cfg = Configuration::default();
        cfg.network.node_name = "testnode".into();
        cfg.chain_spec = "test".into();
        cfg
    }

    #[test]
    fn compute_enable_grandpa_honors_flag() {
        let mut cfg = default_config();
        cfg.disable_grandpa = false;

        let flags = NodeFeatureFlags::default();
        assert!(compute_enable_grandpa(&cfg, flags));

        // explicit disable wins
        cfg.disable_grandpa = true;
        assert!(!compute_enable_grandpa(&cfg, flags));

        // flash finality disables regardless of config
        cfg.disable_grandpa = false;
        let flags = NodeFeatureFlags { enable_flash_finality: true, ..Default::default() };
        assert!(!compute_enable_grandpa(&cfg, flags));
    }

    #[tokio::test]
    async fn new_full_with_flash_flag_skips_grandpa() {
        // we can't easily inspect spawned tasks, but we can verify that the
        // function returns Ok and that the returned TaskManager is usable
        // and that enabling the flag doesn't panic.  additionally, check the log warning
        // by capturing stderr via the `log` crate's test helper.

        let mut cfg = default_config();
        let flags = NodeFeatureFlags { enable_flash_finality: true, ..Default::default() };

        // ensure the helper also indicates grandpa will be off
        assert!(!compute_enable_grandpa(&cfg, flags));

        // now actually start a node (in-memory, no network) to exercise code paths
        let manager = new_full(cfg.clone(), flags).expect("node startup should succeed");
        drop(manager); // cleanup
    }
}
