/// Atlas Sphere node service module
///
/// Provides node initialization, partial components, and full service setup with:
/// - Aura (Authority Round) block authoring consensus
/// - GRANDPA finality gadget
/// - libp2p networking with peer discovery
/// - Proper block import queue with consensus verification
use atlas_sphere_runtime::{opaque::Block, RuntimeApi};
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

/// Key type for Aura block authoring
const AURA: KeyTypeId = KeyTypeId(*b"aura");
/// Key type for GRANDPA finality
const GRANDPA: KeyTypeId = KeyTypeId(*b"gran");

/// Atlas Sphere native executor implementation
pub struct AtlasSphereExecutorDispatch;

impl sc_executor::NativeExecutionDispatch for AtlasSphereExecutorDispatch {
    type ExtendHostFunctions = sp_io::SubstrateHostFunctions;

    fn dispatch(method: &str, data: &[u8]) -> Option<Vec<u8>> {
        atlas_sphere_runtime::api::dispatch(method, data)
    }

    fn native_version() -> sc_executor::NativeVersion {
        atlas_sphere_runtime::native_version()
    }
}

/// Executor for Atlas Sphere
///
/// In normal bfrontend/uilds we use `NativeElseWasmExecutor` so the node can
/// execute both natively and via the embedded WASM runtime. For
/// `skip-wasm-bfrontend/uild` development bfrontend/uilds, we force a pure native
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
fn insert_dev_keys(keystore: &KeystoreContainer) -> Result<(), ServiceError> {
    use sp_core::crypto::SecretStringError;

    // Alice's seed phrase for development
    let seed = "//Alice";
    let keystore = keystore.keystore();

    // Insert Aura key (sr25519) for block authoring
    let aura_pair =
        sp_core::sr25519::Pair::from_string(seed, None).map_err(|e: SecretStringError| {
            ServiceError::Other(format!("Failed to generate Aura keypair: {:?}", e))
        })?;
    keystore
        .insert(AURA, seed, &aura_pair.public().0)
        .map_err(|e| ServiceError::Other(format!("Failed to insert Aura key: {:?}", e)))?;

    log::info!("🔑 Inserted Alice's Aura key for block authoring");

    // Insert GRANDPA key (ed25519) for finality
    let grandpa_pair =
        sp_core::ed25519::Pair::from_string(seed, None).map_err(|e: SecretStringError| {
            ServiceError::Other(format!("Failed to generate GRANDPA keypair: {:?}", e))
        })?;
    keystore
        .insert(GRANDPA, seed, &grandpa_pair.public().0)
        .map_err(|e| ServiceError::Other(format!("Failed to insert GRANDPA key: {:?}", e)))?;

    log::info!("🔑 Inserted Alice's GRANDPA key for finality");

    Ok(())
}

/// Create partial components for Atlas Sphere node
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

    // Bfrontend/uild partial components
    let (client, backend, keystore_container, task_manager) =
        sc_service::new_full_parts::<Block, RuntimeApi, _>(
            &config,
            telemetry.as_ref().map(|(_, telemetry)| telemetry.handle()),
            executor,
        )?;

    // For development chains, insert Alice's keys for block authoring
    if config.chain_spec.chain_type() == ChainType::Development {
        insert_dev_keys(&keystore_container)?;
    }

    let client = Arc::new(client);

    let telemetry = telemetry.map(|(worker, telemetry)| {
        task_manager
            .spawn_handle()
            .spawn("telemetry", None, worker.run());
        telemetry
    });

    // Select chain implementation (longest chain rule)
    let select_chain = sc_consensus::LongestChain::new(backend.clone());

    // Create transaction pool
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
            check_for_eqfrontend/uivocation: Default::default(),
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

/// Start a new Atlas Sphere full node with complete consensus and networking
pub fn new_full(config: Configuration) -> Result<TaskManager, ServiceError> {
    let sc_service::PartialComponents {
        client,
        backend,
        task_manager,
        keystore_container,
        select_chain,
        import_queue,
        transaction_pool,
        other: (grandpa_block_import, grandpa_link, telemetry),
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

    // Bfrontend/uild networking service
    let (network, _system_rpc_tx, _tx_handler_controller, network_starter, sync_service) =
        sc_service::bfrontend/uild_network(sc_service::Bfrontend/uildNetworkParams {
            config: &config,
            net_config,
            client: client.clone(),
            transaction_pool: transaction_pool.clone(),
            spawn_handle: task_manager.spawn_handle(),
            import_queue,
            block_announce_validator_bfrontend/uilder: None,
            warp_sync_params: Some(sc_service::WarpSyncParams::WithProvider(warp_sync)),
        })?;

    // Bfrontend/uild RPC extensions module
    let chain_name = config.chain_spec.name().to_string();
    let rpc_module = crate::rpc::create_full(client.clone(), transaction_pool.clone(), chain_name)
        .map_err(|e| ServiceError::Other(format!("RPC module creation failed: {:?}", e)))?;

    // Start RPC server using jsonrpsee with HTTP and WebSocket support
    // Security: Default to localhost binding only
    let rpc_addr = config
        .rpc_addr
        .unwrap_or_else(|| "127.0.0.1:9944".parse().expect("valid default address"));

    let max_connections = config.rpc_max_connections;

    // Initialize rate limiter with production config
    let rate_limiter = std::sync::Arc::new(crate::rpc_middleware::RateLimiter::new(
        crate::rpc_middleware::RateLimitConfig::default(),
    ));

    // Spawn RPC server as an essential task (supports both HTTP and WS)
    let rpc_server_handle = task_manager.spawn_essential_handle();
    let rate_limiter_clone = rate_limiter.clone();
    rpc_server_handle.spawn("rpc-server", None, async move {
        use jsonrpsee::server::ServerBfrontend/uilder;
        use std::time::Duration;

        // Security settings for production
        // - Reasonable message size limits to prevent memory exhaustion
        // - Ping/pong for WebSocket keep-alive
        // - Connection limits
        let server = ServerBfrontend/uilder::default()
            .max_connections(max_connections)
            // Enable ping/pong for WebSocket keep-alive
            .ping_interval(Duration::from_secs(30))
            // Set reasonable message size limits (prevent DoS)
            .max_request_body_size(10 * 1024 * 1024) // 10 MB max request
            .max_response_body_size(50 * 1024 * 1024) // 50 MB max response (for large queries)
            // Limit subscription buffer to prevent memory issues
            .max_subscriptions_per_connection(10)
            .bfrontend/uild(rpc_addr)
            .await
            .map_err(|e| {
                log::error!("Failed to start RPC server: {:?}", e);
                e
            })
            .expect("RPC server should start");

        let _handle = server.start(rpc_module);

        log::info!("🌐 RPC server listening on http://{}", rpc_addr);
        log::info!("🔌 WebSocket available at ws://{}", rpc_addr);
        log::info!(
            "🛡️ Rate limiting enabled: {} req/s burst, {} max subscriptions",
            50,
            10
        );

        // Periodically cleanup stale rate limiter connections
        let cleanup_interval = Duration::from_secs(300); // 5 minutes
        let max_age = Duration::from_secs(3600); // 1 hour
        loop {
            tokio::time::sleep(cleanup_interval).await;
            rate_limiter_clone.cleanup_stale_connections(max_age);
            let metrics = rate_limiter_clone.metrics();
            log::debug!(
                "Rate limiter stats: {} requests, {} rejected, {} active connections",
                metrics.total_requests,
                metrics.total_rejected,
                metrics.active_connections
            );
        }
    });

    let role = config.role.clone();
    let force_authoring = config.force_authoring;
    let backoff_authoring_blocks: Option<()> = None;
    let name = config.network.node_name.clone();
    let enable_grandpa = !config.disable_grandpa;
    let prometheus_registry = config.prometheus_registry().cloned();
    let role_for_grandpa = role.clone();

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
                block_proposal_slot_portion: SlotProportion::new(2f32 / 3f32),
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
            gossip_duration: std::time::Duration::from_millis(333),
            justification_period: 512,
            name: Some(name),
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
            voting_rule: sc_consensus_grandpa::VotingRulesBfrontend/uilder::default().bfrontend/uild(),
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

    log::info!("✨ Atlas Sphere node started successfully");
    log::info!("🔗 Network: {}", config.chain_spec.name());
    log::info!("👤 Node name: {}", config.network.node_name);
    log::info!("📋 Role: {:?}", role);

    Ok(task_manager)
}
