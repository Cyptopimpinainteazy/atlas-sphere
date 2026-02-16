//! Universal Multi-Chain Wallet - BIP39 + EVM chains + Substrate

use bip39::{Mnemonic, Language};
use rand::RngCore;
use sp_core::{sr25519, Pair};
use sp_core::crypto::Ss58Codec;
use std::error::Error;
use tauri::command;

#[derive(Debug, thiserror::Error)]
pub enum WalletError {
    #[error("Crypto error: {0}")]
    CryptoError(String),
}

#[derive(serde::Serialize)]
pub struct UniversalWallet {
    mnemonic: String,
    seed_hex: String,
    evm_address: String,
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
        substrate_address,
        evm_chain_count,
        warning: "⚠️ LIVE KEYS - Backup mnemonic securely.".to_string(),
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
        substrate_address,
        evm_chain_count,
        warning: "⚠️ IMPORTED KEYS - Verify and backup securely.".to_string(),
    })
}

#[command]
pub fn get_evm_chain_count() -> usize {
    59263
}
