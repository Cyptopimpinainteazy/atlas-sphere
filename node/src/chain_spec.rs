use atlas_sphere_runtime::{
    AccountId, AuraConfig, BalancesConfig, GrandpaConfig, RuntimeGenesisConfig, Signature,
    SystemConfig, WASM_BINARY,
};
use parity_scale_codec::Encode;
use sc_chain_spec::Properties;
use sc_network::config::MultiaddrWithPeerId;
use sc_service::GenericChainSpec;
use sc_service::{ChainSpec as ServiceChainSpec, ChainType};
use serde::{Deserialize, Serialize};
use sp_consensus_aura::sr25519::AuthorityId as AuraId;
use sp_consensus_grandpa::AuthorityId as GrandpaId;
use sp_core::{sr25519, Pair, Public};
use sp_runtime::traits::{IdentifyAccount, Verify};
use std::{collections::BTreeSet, path::PathBuf};

/// Chain specification specialized to this runtime's genesis configuration.
pub type ChainSpec = GenericChainSpec<RuntimeGenesisConfig>;

const DEFAULT_PROTOCOL_ID: &str = "atlas";
const ATLAS: u128 = 1_000_000_000_000;
const ENDOWMENT: u128 = 1_000_000 * ATLAS;

type AccountPublic = <Signature as Verify>::Signer;

/// Load the named `ChainSpec` via the supplied identifier string.
pub fn load_spec(id: &str) -> Result<Box<dyn ServiceChainSpec>, String> {
    match id {
        "" | "dev" => Ok(Box::new(development_config()?)),
        "local" => Ok(Box::new(local_testnet_config()?)),
        "staging" => Ok(Box::new(staging_config()?)),
        path => Ok(Box::new(ChainSpec::from_json_file(PathBuf::from(path))?)),
    }
}

/// Bfrontend/uild the `ChainSpec` powering the development network (local node).
pub fn development_config() -> Result<ChainSpec, String> {
    eprintln!("DEBUG: WASM_BINARY is: {:?}", WASM_BINARY.is_some());
    // For native-dev bfrontend/uilds (e.g., with `skip-wasm-bfrontend/uild`), we still want to be
    // able to construct a development chain spec even if no WASM runtime blob
    // is embedded. In that case, we fall back to an empty code blob and rely
    // entirely on the native runtime. Runtime upgrades via `set_code` will not
    // work in this mode, which is acceptable for local development.
    let wasm_binary = WASM_BINARY.unwrap_or(&[]);
    let initial_authorities = vec![authority_keys_from_seed("Alice")];
    let endowed_accounts = vec![
        get_account_id_from_seed::<sr25519::Public>("Alice"),
        get_account_id_from_seed::<sr25519::Public>("Bob"),
        get_account_id_from_seed::<sr25519::Public>("Charlie"),
        get_account_id_from_seed::<sr25519::Public>("Dave"),
        get_account_id_from_seed::<sr25519::Public>("Eve"),
        get_account_id_from_seed::<sr25519::Public>("Ferdie"),
    ];

    Ok(ChainSpec::from_genesis(
        "Atlas Sphere Development",
        "atlas_sphere_dev",
        ChainType::Development,
        move || {
            atlas_sphere_genesis(
                wasm_binary,
                initial_authorities.clone(),
                endowed_accounts.clone(),
            )
        },
        vec![],
        None,
        Some(DEFAULT_PROTOCOL_ID),
        None,
        Default::default(),
        None,
    ))
}

/// Bfrontend/uild the local testnet `ChainSpec` used during development.
pub fn local_testnet_config() -> Result<ChainSpec, String> {
    // Mirror the development config behavior: allow local testnets to run
    // without an embedded WASM blob when using native-only execution.
    let wasm_binary = WASM_BINARY.unwrap_or(&[]);
    let initial_authorities = vec![
        authority_keys_from_seed("Alice"),
        authority_keys_from_seed("Bob"),
    ];
    let endowed_accounts = vec![
        get_account_id_from_seed::<sr25519::Public>("Alice"),
        get_account_id_from_seed::<sr25519::Public>("Bob"),
        get_account_id_from_seed::<sr25519::Public>("Charlie"),
        get_account_id_from_seed::<sr25519::Public>("Dave"),
        get_account_id_from_seed::<sr25519::Public>("Eve"),
        get_account_id_from_seed::<sr25519::Public>("Ferdie"),
    ];

    Ok(ChainSpec::from_genesis(
        "Atlas Sphere Local Testnet",
        "atlas_sphere_local",
        ChainType::Local,
        move || {
            atlas_sphere_genesis(
                wasm_binary,
                initial_authorities.clone(),
                endowed_accounts.clone(),
            )
        },
        vec![],
        None,
        Some(DEFAULT_PROTOCOL_ID),
        None,
        Default::default(),
        None,
    ))
}

/// Bfrontend/uild the staging `ChainSpec` matching the release network parameters.
pub fn staging_config() -> Result<ChainSpec, String> {
    // Staging networks are expected to have a proper WASM runtime embedded.
    // Keep the strict check here so that any missing or invalid blob fails
    // fast during chain spec construction.
    let wasm_binary =
        WASM_BINARY.ok_or_else(|| "Atlas Sphere WASM binary not available".to_string())?;
    let initial_authorities = vec![
        authority_keys_from_seed("AtlasAlpha"),
        authority_keys_from_seed("AtlasBeta"),
        authority_keys_from_seed("AtlasGamma"),
    ];
    let endowed_accounts = vec![
        get_account_id_from_seed::<sr25519::Public>("AtlasFoundation"),
        get_account_id_from_seed::<sr25519::Public>("AtlasEcosystem"),
        get_account_id_from_seed::<sr25519::Public>("AtlasCommunity"),
    ];

    Ok(ChainSpec::from_genesis(
        "Atlas Sphere Staging",
        "atlas_sphere_staging",
        ChainType::Live,
        move || {
            atlas_sphere_genesis(
                wasm_binary,
                initial_authorities.clone(),
                endowed_accounts.clone(),
            )
        },
        vec![],
        None,
        Some(DEFAULT_PROTOCOL_ID),
        None,
        Default::default(),
        None,
    ))
}

fn atlas_sphere_genesis(
    wasm_binary: &[u8],
    initial_authorities: Vec<(AuraId, GrandpaId)>,
    endowed_accounts: Vec<AccountId>,
) -> RuntimeGenesisConfig {
    let mut endowed: BTreeSet<AccountId> = endowed_accounts.into_iter().collect();

    // Add authority accounts to endowed set
    for (aura, _) in initial_authorities.iter() {
        // Derive account from Aura public key
        let mut account_bytes = [0u8; 32];
        account_bytes.copy_from_slice(&aura.encode()[..32]);
        let account_id = AccountId::from(account_bytes);
        endowed.insert(account_id);
    }

    let balances = endowed
        .iter()
        .cloned()
        .map(|account| (account, ENDOWMENT))
        .collect::<Vec<_>>();

    let aura_authorities: Vec<AuraId> = initial_authorities
        .iter()
        .map(|(aura, _): &(AuraId, GrandpaId)| aura.clone())
        .collect();

    let grandpa_authorities: Vec<(GrandpaId, u64)> = initial_authorities
        .into_iter()
        .map(|(_, grandpa)| (grandpa, 1))
        .collect();

    RuntimeGenesisConfig {
        system: SystemConfig {
            code: wasm_binary.to_vec(),
            ..Default::default()
        },
        balances: BalancesConfig { balances },
        aura: AuraConfig {
            authorities: aura_authorities,
        },
        grandpa: GrandpaConfig {
            authorities: grandpa_authorities,
            _config: Default::default(),
        },
        transaction_payment: Default::default(),
        council: Default::default(),
        evm: Default::default(),
        governance: Default::default(),
        treasury: Default::default(),
        evolution_core: Default::default(),
        x3_verifier: Default::default(),
        #[cfg(feature = "dev")]
        sudo: Default::default(),
    }
}

fn default_properties() -> Properties {
    let mut properties = Properties::new();
    properties.insert("tokenSymbol".into(), "ATLAS".into());
    properties.insert("tokenDecimals".into(), 12.into());
    properties.insert("ss58Format".into(), 42.into());
    properties
}

fn authority_keys_from_seed(seed: &str) -> (AuraId, GrandpaId) {
    (
        get_from_seed::<AuraId>(seed),
        get_from_seed::<GrandpaId>(seed),
    )
}

fn get_account_id_from_seed<TPublic: Public>(seed: &str) -> AccountId
where
    AccountPublic: From<TPublic>,
    TPublic::Pair: Pair,
    TPublic: From<<TPublic::Pair as Pair>::Public>,
{
    AccountPublic::from(get_from_seed::<TPublic>(seed)).into_account()
}

fn get_from_seed<TPublic: Public>(seed: &str) -> TPublic
where
    TPublic::Pair: Pair,
    TPublic: From<<TPublic::Pair as Pair>::Public>,
{
    TPublic::Pair::from_string(&format!("//{}", seed), None)
        .expect("static seeds are valid; qed")
        .public()
        .into()
}
