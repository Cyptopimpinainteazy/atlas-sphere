//! Tauri Commands for Seed Phrase Management
//!
//! These commands expose the BIP39 functionality to the frontend
//! with proper security considerations.

use serde::{Deserialize, Serialize};
use crate::wallet_keys::{
    self, GeneratedSeed, ValidationResult, DerivedAddress, KeyError,
};
use crate::commands::CommandResult;

/// Generate a new seed phrase
/// 
/// # Arguments
/// * `word_count` - Number of words (12 or 24)
#[tauri::command]
pub async fn generate_seed_phrase(word_count: u8) -> Result<CommandResult<GeneratedSeed>, ()> {
    match wallet_keys::generate_mnemonic(word_count) {
        Ok(seed) => Ok(CommandResult::ok(seed)),
        Err(e) => Ok(CommandResult::err(e.to_string())),
    }
}

/// Validate a seed phrase
/// 
/// # Arguments
/// * `phrase` - The mnemonic phrase to validate
#[tauri::command]
pub async fn validate_seed_phrase(phrase: String) -> Result<ValidationResult, ()> {
    Ok(wallet_keys::validate_mnemonic(&phrase))
}

/// Get random indices for verification quiz
/// 
/// Returns 3 random word positions that user must verify
#[tauri::command]
pub async fn get_verification_indices(word_count: usize) -> Result<Vec<usize>, ()> {
    Ok(wallet_keys::get_verification_indices(word_count))
}

/// Get word suggestions for autocomplete
#[tauri::command]
pub async fn get_word_suggestions(prefix: String, limit: usize) -> Result<Vec<String>, ()> {
    Ok(wallet_keys::get_word_suggestions(&prefix, limit.min(10)))
}

/// Parameters for wallet restoration
#[derive(Debug, Deserialize)]
pub struct RestoreParams {
    pub mnemonic: String,
    pub passphrase: Option<String>,
    pub wallet_password: String,
}

/// Restore wallet from seed phrase
/// 
/// This will:
/// 1. Validate the mnemonic
/// 2. Derive the master key
/// 3. Import the first address into the daemon
/// 4. Encrypt the wallet with the provided password
#[tauri::command]
pub async fn restore_from_seed(
    params: RestoreParams,
) -> Result<CommandResult<RestoreResult>, ()> {
    // First validate the mnemonic
    let validation = wallet_keys::validate_mnemonic(&params.mnemonic);
    if !validation.valid {
        return Ok(CommandResult::err(
            validation.error.unwrap_or_else(|| "Invalid mnemonic".to_string())
        ));
    }

    // Derive the first address to verify derivation works
    match wallet_keys::derive_address(
        &params.mnemonic,
        params.passphrase.as_deref(),
        0, // account
        0, // external chain
        0, // first address
    ) {
        Ok(derived) => {
            // TODO: Actually import the derived key into the daemon
            // This would require:
            // 1. Getting the WIF private key from the derived key
            // 2. Calling importprivkey RPC
            // 3. Encrypting the wallet
            
            Ok(CommandResult::ok(RestoreResult {
                success: true,
                first_address: derived.address,
                message: "Wallet restoration prepared. Keys derived successfully.".to_string(),
            }))
        }
        Err(e) => Ok(CommandResult::err(e.to_string())),
    }
}

#[derive(Debug, Serialize)]
pub struct RestoreResult {
    pub success: bool,
    pub first_address: String,
    pub message: String,
}

/// Derive an address from seed phrase (for verification)
#[tauri::command]
pub async fn derive_address_from_seed(
    mnemonic: String,
    passphrase: Option<String>,
    account: u32,
    change: u32,
    address_index: u32,
) -> Result<CommandResult<DerivedAddress>, ()> {
    match wallet_keys::derive_address(
        &mnemonic,
        passphrase.as_deref(),
        account,
        change,
        address_index,
    ) {
        Ok(address) => Ok(CommandResult::ok(address)),
        Err(e) => Ok(CommandResult::err(e.to_string())),
    }
}

/// Get the seed as hex (for advanced backup)
/// 
/// WARNING: This exposes sensitive data. Use with caution.
#[tauri::command]
pub async fn get_seed_hex(
    mnemonic: String,
    passphrase: Option<String>,
) -> Result<CommandResult<String>, ()> {
    match wallet_keys::mnemonic_to_seed_hex(&mnemonic, passphrase.as_deref()) {
        Ok(hex) => Ok(CommandResult::ok(hex)),
        Err(e) => Ok(CommandResult::err(e.to_string())),
    }
}

/// Check if wallet has been initialized (has seed phrase backup)
/// 
/// This checks for a marker file in the data directory
#[tauri::command]
pub async fn is_wallet_initialized() -> Result<bool, ()> {
    let data_dir = crate::daemon::DaemonManager::get_default_data_dir();
    let marker_path = data_dir.join(".wallet_initialized");
    Ok(marker_path.exists())
}

/// Mark wallet as initialized after successful setup
#[tauri::command]
pub async fn mark_wallet_initialized() -> Result<CommandResult<bool>, ()> {
    let data_dir = crate::daemon::DaemonManager::get_default_data_dir();
    
    // Ensure directory exists
    if let Err(e) = std::fs::create_dir_all(&data_dir) {
        return Ok(CommandResult::err(format!("Failed to create data directory: {}", e)));
    }

    let marker_path = data_dir.join(".wallet_initialized");
    
    // Write initialization timestamp
    let content = format!(
        "Wallet initialized: {}\nVersion: {}\n",
        chrono::Utc::now().to_rfc3339(),
        env!("CARGO_PKG_VERSION")
    );
    
    match std::fs::write(&marker_path, content) {
        Ok(_) => Ok(CommandResult::ok(true)),
        Err(e) => Ok(CommandResult::err(format!("Failed to write marker: {}", e))),
    }
}

/// Reset wallet initialization (for testing/recovery)
#[tauri::command]
pub async fn reset_wallet_initialization() -> Result<CommandResult<bool>, ()> {
    let data_dir = crate::daemon::DaemonManager::get_default_data_dir();
    let marker_path = data_dir.join(".wallet_initialized");
    
    if marker_path.exists() {
        match std::fs::remove_file(&marker_path) {
            Ok(_) => Ok(CommandResult::ok(true)),
            Err(e) => Ok(CommandResult::err(format!("Failed to remove marker: {}", e))),
        }
    } else {
        Ok(CommandResult::ok(true))
    }
}

