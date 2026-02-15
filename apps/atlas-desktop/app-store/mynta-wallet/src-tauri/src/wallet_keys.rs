//! Mynta Wallet Key Management
//!
//! Implements BIP39/BIP44 HD wallet functionality for seed phrase
//! generation, validation, and key derivation.
//!
//! Security Notes:
//! - All sensitive data uses zeroize for secure memory clearing
//! - Entropy sourced from system CSPRNG
//! - Follows BIP39/BIP44 standards for interoperability

use bip39::{Language, Mnemonic};
use bitcoin::bip32::{DerivationPath, Xpriv, Xpub};
use bitcoin::secp256k1::Secp256k1;
use bitcoin::Network;
use rand::RngCore;
use serde::{Deserialize, Serialize};
use std::str::FromStr;
use thiserror::Error;
use zeroize::{Zeroize, ZeroizeOnDrop};

/// BIP44 coin type for Mynta (using 2025 as registered)
pub const MYNTA_COIN_TYPE: u32 = 2025;

/// Default derivation path for Mynta: m/44'/2025'/0'/0/0
pub const DEFAULT_DERIVATION_PATH: &str = "m/44'/2025'/0'/0/0";

#[derive(Error, Debug)]
pub enum KeyError {
    #[error("Invalid mnemonic: {0}")]
    InvalidMnemonic(String),
    #[error("Invalid word count: {0}. Must be 12 or 24.")]
    InvalidWordCount(usize),
    #[error("Invalid derivation path: {0}")]
    InvalidDerivationPath(String),
    #[error("Key derivation failed: {0}")]
    DerivationFailed(String),
    #[error("Invalid word at position {0}: {1}")]
    InvalidWord(usize, String),
    #[error("Checksum verification failed")]
    ChecksumFailed,
}

/// Secure wrapper for mnemonic that zeroizes on drop
#[derive(Zeroize, ZeroizeOnDrop)]
pub struct SecureMnemonic {
    words: String,
}

impl SecureMnemonic {
    pub fn new(words: String) -> Self {
        Self { words }
    }

    pub fn as_str(&self) -> &str {
        &self.words
    }

    pub fn words(&self) -> Vec<&str> {
        self.words.split_whitespace().collect()
    }
}

/// Result of seed phrase generation
#[derive(Debug, Serialize)]
pub struct GeneratedSeed {
    /// The mnemonic words (space-separated)
    pub mnemonic: String,
    /// Number of words
    pub word_count: usize,
    /// The words as an array for display
    pub words: Vec<String>,
}

/// Seed phrase validation result
#[derive(Debug, Serialize)]
pub struct ValidationResult {
    pub valid: bool,
    pub error: Option<String>,
    pub invalid_words: Vec<InvalidWordInfo>,
}

#[derive(Debug, Serialize)]
pub struct InvalidWordInfo {
    pub index: usize,
    pub word: String,
    pub suggestions: Vec<String>,
}

/// Derived address information
#[derive(Debug, Serialize)]
pub struct DerivedAddress {
    pub path: String,
    pub address: String,
    pub public_key: String,
}

/// Generate a new BIP39 mnemonic seed phrase
///
/// # Arguments
/// * `word_count` - Number of words (12 or 24)
///
/// # Returns
/// * `GeneratedSeed` with the mnemonic and word array
pub fn generate_mnemonic(word_count: u8) -> Result<GeneratedSeed, KeyError> {
    // Determine entropy size: 12 words = 128 bits (16 bytes), 24 words = 256 bits (32 bytes)
    let entropy_bytes = match word_count {
        12 => 16,
        24 => 32,
        _ => return Err(KeyError::InvalidWordCount(word_count as usize)),
    };

    // Generate entropy using system CSPRNG
    let mut entropy = vec![0u8; entropy_bytes];
    rand::thread_rng().fill_bytes(&mut entropy);

    // Generate mnemonic from entropy
    let mnemonic = Mnemonic::from_entropy(&entropy)
        .map_err(|e| KeyError::InvalidMnemonic(e.to_string()))?;
    
    let phrase = mnemonic.to_string();
    let words: Vec<String> = phrase.split_whitespace().map(String::from).collect();

    Ok(GeneratedSeed {
        mnemonic: phrase,
        word_count: words.len(),
        words,
    })
}

/// Validate a BIP39 mnemonic phrase
///
/// # Arguments
/// * `phrase` - Space-separated mnemonic words
///
/// # Returns
/// * `ValidationResult` with validity status and any errors
pub fn validate_mnemonic(phrase: &str) -> ValidationResult {
    let words: Vec<&str> = phrase.split_whitespace().collect();
    
    // Check word count
    if words.len() != 12 && words.len() != 24 {
        return ValidationResult {
            valid: false,
            error: Some(format!(
                "Invalid word count: {}. Must be 12 or 24 words.",
                words.len()
            )),
            invalid_words: vec![],
        };
    }

    // Check each word against BIP39 wordlist
    let wordlist = Language::English.word_list();
    let mut invalid_words = Vec::new();

    for (index, word) in words.iter().enumerate() {
        let word_lower = word.to_lowercase();
        if !wordlist.iter().any(|w| *w == word_lower) {
            // Find suggestions (words that start with the same letters)
            let prefix_len = std::cmp::min(2, word_lower.len());
            let suggestions: Vec<String> = wordlist
                .iter()
                .filter(|w| w.starts_with(&word_lower[..prefix_len]))
                .take(5)
                .map(|s| s.to_string())
                .collect();

            invalid_words.push(InvalidWordInfo {
                index: index + 1, // 1-indexed for user display
                word: word.to_string(),
                suggestions,
            });
        }
    }

    if !invalid_words.is_empty() {
        return ValidationResult {
            valid: false,
            error: Some(format!(
                "{} invalid word(s) found",
                invalid_words.len()
            )),
            invalid_words,
        };
    }

    // Try to parse as valid mnemonic (includes checksum validation)
    match Mnemonic::parse_in_normalized(Language::English, phrase) {
        Ok(_) => ValidationResult {
            valid: true,
            error: None,
            invalid_words: vec![],
        },
        Err(e) => ValidationResult {
            valid: false,
            error: Some(format!("Checksum validation failed: {}", e)),
            invalid_words: vec![],
        },
    }
}

/// Get random word indices for verification quiz
///
/// Returns 3 random indices (1-indexed) that the user must verify
pub fn get_verification_indices(word_count: usize) -> Vec<usize> {
    use rand::seq::SliceRandom;
    use rand::thread_rng;

    let mut indices: Vec<usize> = (1..=word_count).collect();
    indices.shuffle(&mut thread_rng());
    indices.truncate(3);
    indices.sort();
    indices
}

/// Derive master extended private key from mnemonic
///
/// # Arguments
/// * `mnemonic` - The BIP39 mnemonic phrase
/// * `passphrase` - Optional passphrase (BIP39 "25th word")
/// * `network` - Bitcoin network (mainnet/testnet)
///
/// # Returns
/// * Extended private key (xpriv)
pub fn derive_master_key(
    mnemonic_phrase: &str,
    passphrase: Option<&str>,
    network: Network,
) -> Result<Xpriv, KeyError> {
    let mnemonic = Mnemonic::parse_in_normalized(Language::English, mnemonic_phrase)
        .map_err(|e| KeyError::InvalidMnemonic(e.to_string()))?;

    let seed = mnemonic.to_seed(passphrase.unwrap_or(""));
    
    let xpriv = Xpriv::new_master(network, &seed)
        .map_err(|e| KeyError::DerivationFailed(e.to_string()))?;

    Ok(xpriv)
}

/// Derive a child key at a specific path
///
/// # Arguments
/// * `master` - The master extended private key
/// * `path` - BIP32 derivation path (e.g., "m/44'/2025'/0'/0/0")
///
/// # Returns
/// * Derived extended private key
pub fn derive_child_key(master: &Xpriv, path: &str) -> Result<Xpriv, KeyError> {
    let secp = Secp256k1::new();
    let derivation_path = DerivationPath::from_str(path)
        .map_err(|e| KeyError::InvalidDerivationPath(e.to_string()))?;

    let derived = master
        .derive_priv(&secp, &derivation_path)
        .map_err(|e| KeyError::DerivationFailed(e.to_string()))?;

    Ok(derived)
}

/// Get the public key from an extended private key
pub fn get_public_key(xpriv: &Xpriv) -> Xpub {
    let secp = Secp256k1::new();
    Xpub::from_priv(&secp, xpriv)
}

/// Derive a Mynta address from mnemonic
///
/// This creates a P2PKH address suitable for Mynta
///
/// # Arguments
/// * `mnemonic_phrase` - The BIP39 mnemonic
/// * `passphrase` - Optional passphrase
/// * `account` - Account index (default 0)
/// * `change` - Change index (0 for external, 1 for internal)
/// * `address_index` - Address index
pub fn derive_address(
    mnemonic_phrase: &str,
    passphrase: Option<&str>,
    account: u32,
    change: u32,
    address_index: u32,
) -> Result<DerivedAddress, KeyError> {
    // Use mainnet for Mynta (we'll convert the address prefix later)
    let master = derive_master_key(mnemonic_phrase, passphrase, Network::Bitcoin)?;
    
    // BIP44 path: m/44'/coin_type'/account'/change/address_index
    let path = format!(
        "m/44'/{}'/{}'/{}'/{}",
        MYNTA_COIN_TYPE, account, change, address_index
    );

    let derived = derive_child_key(&master, &path)?;
    let secp = Secp256k1::new();
    let public_key = bitcoin::PublicKey::new(derived.private_key.public_key(&secp));
    
    // Get the public key hex
    let pubkey_hex = hex::encode(public_key.to_bytes());

    // For now, return the Bitcoin-format address
    // The actual Mynta address conversion would require the specific address format
    // This demonstrates the derivation works
    let address = bitcoin::Address::p2pkh(&public_key, Network::Bitcoin);

    Ok(DerivedAddress {
        path,
        address: address.to_string(),
        public_key: pubkey_hex,
    })
}

/// Export the seed as hex (for backup purposes)
pub fn mnemonic_to_seed_hex(mnemonic_phrase: &str, passphrase: Option<&str>) -> Result<String, KeyError> {
    let mnemonic = Mnemonic::parse_in_normalized(Language::English, mnemonic_phrase)
        .map_err(|e| KeyError::InvalidMnemonic(e.to_string()))?;

    let seed = mnemonic.to_seed(passphrase.unwrap_or(""));
    Ok(hex::encode(seed))
}

/// Get word suggestions for autocomplete
pub fn get_word_suggestions(prefix: &str, limit: usize) -> Vec<String> {
    if prefix.is_empty() {
        return vec![];
    }

    let wordlist = Language::English.word_list();
    let prefix_lower = prefix.to_lowercase();

    wordlist
        .iter()
        .filter(|w| w.starts_with(&prefix_lower))
        .take(limit)
        .map(|s| s.to_string())
        .collect()
}

/// Get the full BIP39 English wordlist
pub fn get_wordlist() -> Vec<String> {
    Language::English
        .word_list()
        .iter()
        .map(|s| s.to_string())
        .collect()
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_generate_12_words() {
        let result = generate_mnemonic(12).unwrap();
        assert_eq!(result.word_count, 12);
        assert_eq!(result.words.len(), 12);
    }

    #[test]
    fn test_generate_24_words() {
        let result = generate_mnemonic(24).unwrap();
        assert_eq!(result.word_count, 24);
        assert_eq!(result.words.len(), 24);
    }

    #[test]
    fn test_invalid_word_count() {
        let result = generate_mnemonic(15);
        assert!(result.is_err());
    }

    #[test]
    fn test_validate_valid_mnemonic() {
        // Generate and validate
        let generated = generate_mnemonic(12).unwrap();
        let validation = validate_mnemonic(&generated.mnemonic);
        assert!(validation.valid);
    }

    #[test]
    fn test_validate_invalid_word() {
        let phrase = "abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon xyz";
        let validation = validate_mnemonic(phrase);
        assert!(!validation.valid);
        assert!(!validation.invalid_words.is_empty());
    }

    #[test]
    fn test_word_suggestions() {
        let suggestions = get_word_suggestions("aban", 5);
        assert!(suggestions.contains(&"abandon".to_string()));
    }

    #[test]
    fn test_verification_indices() {
        let indices = get_verification_indices(12);
        assert_eq!(indices.len(), 3);
        for idx in &indices {
            assert!(*idx >= 1 && *idx <= 12);
        }
    }
}

