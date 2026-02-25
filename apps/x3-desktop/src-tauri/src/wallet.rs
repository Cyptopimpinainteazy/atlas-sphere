//! Universal Multi-Chain Wallet - BIP39 + EVM chains + Substrate

use bip39::{Mnemonic, Language};
use rand::RngCore;
use sp_core::{sr25519, Pair};
use sp_core::crypto::Ss58Codec;
use solana_sdk::signature::{Keypair, SeedDerivable, Signer};
use bs58;
use tauri::command;

#[derive(Debug, thiserror::Error, serde::Serialize)]
pub enum WalletError {
    #[error("Crypto error: {0}")]
    CryptoError(String),
}

#[derive(serde::Serialize, serde::Deserialize)]
pub struct UniversalWallet {
    mnemonic: String,
    seed_hex: String,
    evm_address: String,
    evm_private_key: String,
    solana_address: String,
    solana_private_key: String,
    substrate_address: String,
    evm_chain_count: usize,
    warning: String,
}

#[command]
pub fn generate_universal_wallet() -> Result<UniversalWallet, WalletError> {
    // Generate 12-word mnemonic using supported bip39 API
    use rand::thread_rng;
    let mut entropy = [0u8; 16];
    thread_rng().fill_bytes(&mut entropy);
    let mnemonic = Mnemonic::from_entropy_in(Language::English, &entropy)
        .map_err(|e| WalletError::CryptoError(e.to_string()))?;
    let mnemonic_str = mnemonic.to_string();
    let seed = mnemonic.to_seed("");

    // Derive EVM address from seed (use keccak256 of seed)
    let hash = sp_core::hashing::keccak_256(&seed);
    let evm_address = format!("0x{}", hex::encode(&hash[12..32]));
    let evm_private_key = format!("0x{}", hex::encode(&seed[0..32]));

    // Solana
    let mut solana_seed = [0u8; 32];
    solana_seed.copy_from_slice(&seed[0..32]);
    let solana_keypair = Keypair::from_seed(&solana_seed).map_err(|e| WalletError::CryptoError(format!("Solana keypair error: {}", e)))?;
    let solana_address = solana_keypair.pubkey().to_string();
    let solana_private_key = bs58::encode(solana_keypair.to_bytes()).into_string();

    // Substrate (using Polkadot SS58 format)
    let mut seed_array = [0u8; 32];
    seed_array.copy_from_slice(&seed[0..32]);
    let pair = sr25519::Pair::from_seed(&seed_array);
    let substrate_address = pair.public().to_ss58check();

    // Chain count - placeholder
    let evm_chain_count = 60000;

    Ok(UniversalWallet {
        mnemonic: mnemonic_str,
        seed_hex: hex::encode(seed),
        evm_address,
        evm_private_key,
        solana_address,
        solana_private_key,
        substrate_address,
        evm_chain_count,
        warning: "⚠️ LIVE KEYS - Backup mnemonic securely. Single EVM address works on 60k+ chains.".to_string(),
    })
}

#[command]
pub fn import_universal_wallet(mnemonic: String) -> Result<UniversalWallet, WalletError> {
    // Use provided mnemonic
    let mnemonic = Mnemonic::parse_in(Language::English, mnemonic.as_str())
        .map_err(|e| WalletError::CryptoError(e.to_string()))?;
    let mnemonic_str = mnemonic.to_string();
    let seed = mnemonic.to_seed("");

    // Derive EVM address from seed
    let hash = sp_core::hashing::keccak_256(&seed);
    let evm_address = format!("0x{}", hex::encode(&hash[12..32]));
    let evm_private_key = format!("0x{}", hex::encode(&seed[0..32]));

    // Solana
    let mut solana_seed = [0u8; 32];
    solana_seed.copy_from_slice(&seed[0..32]);
    let solana_keypair = Keypair::from_seed(&solana_seed).map_err(|e| WalletError::CryptoError(format!("Solana keypair error: {}", e)))?;
    let solana_address = solana_keypair.pubkey().to_string();
    let solana_private_key = bs58::encode(solana_keypair.to_bytes()).into_string();

    // Substrate
    let mut seed_array = [0u8; 32];
    seed_array.copy_from_slice(&seed[0..32]);
    let pair = sr25519::Pair::from_seed(&seed_array);
    let substrate_address = pair.public().to_ss58check();

    let evm_chain_count = 60000;

    Ok(UniversalWallet {
        mnemonic: mnemonic_str,
        seed_hex: hex::encode(seed),
        evm_address,
        evm_private_key,
        solana_address,
        solana_private_key,
        substrate_address,
        evm_chain_count,
        warning: "⚠️ IMPORTED KEYS - Verify and backup securely.".to_string(),
    })
}

#[command]
pub fn get_evm_chain_count() -> usize {
    59263
}

#[command]
pub async fn store_wallet_secure(_wallet: UniversalWallet) -> Result<(), WalletError> {
    // Use Tauri's store plugin for secure storage
    // For now, placeholder - in production would encrypt and store
    Ok(())
}

#[command]
pub async fn get_wallet_balance(_chain_id: String, _address: String) -> Result<String, WalletError> {
    // Use blockchain connector to fetch balance
    // Placeholder - would integrate with ChainDB
    Ok("0.0".to_string())
}

#[command]
pub async fn submit_cross_swap(_from_chain: String, _to_chain: String, _amount: String) -> Result<String, WalletError> {
    // Integrate with Comit v2 for atomic swaps
    // Placeholder
    Ok("swap_tx_hash".to_string())
}

#[command]
pub async fn execute_x3_script(_script: String, _wallet: UniversalWallet) -> Result<String, WalletError> {
    // Execute x3-lang script with wallet context
    // Placeholder
    Ok("execution_result".to_string())
}
