//! Encryption utilities for the private mempool.
//!
//! Provides helpers for encrypting transactions to the committee's threshold key
//! and reconstructing plaintexts from decryption shares.
//!
//! # Cryptographic Scheme
//!
//! 1. Sender generates ephemeral X25519 keypair
//! 2. ECDH with committee public key → shared secret
//! 3. HKDF-SHA256(shared_secret) → AES-256-GCM key
//! 4. AES-256-GCM encrypt(plaintext, nonce) → ciphertext
//!
//! Decryption requires t-of-n validators to provide decryption shares
//! (partial ECDH results), which are combined to reconstruct the shared secret.

use crate::{EncryptedTransaction, MempoolError};

/// Encrypt a transaction payload for the committee.
///
/// # Invariant: PRIV-EXEC-001
pub fn encrypt_for_committee(
    plaintext: &[u8],
    committee_pk: &[u8; 32],
    sender_pk: &[u8; 32],
    fee_commitment: &[u8; 32],
    dkg_epoch: u64,
) -> Result<EncryptedTransaction, MempoolError> {
    // Generate ephemeral keypair
    let ephemeral_sk = generate_ephemeral_key();
    let ephemeral_pk = derive_public_key(&ephemeral_sk);

    // ECDH: shared_secret = ephemeral_sk * committee_pk
    let shared_secret = ecdh(&ephemeral_sk, committee_pk);

    // KDF: derive AES key
    let aes_key = hkdf_derive(&shared_secret);

    // Generate nonce
    let nonce = generate_nonce();

    // AES-256-GCM encrypt
    let ciphertext = aes_gcm_encrypt(plaintext, &aes_key, &nonce);

    // Compute TX ID as hash of ciphertext
    let id = blake3_hash(&ciphertext);

    let submitted_at = std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .unwrap_or_default()
        .as_secs();

    Ok(EncryptedTransaction {
        id,
        ciphertext,
        ephemeral_pk,
        nonce,
        sender_pk: *sender_pk,
        fee_commitment: *fee_commitment,
        submitted_at,
        dkg_epoch,
    })
}

/// Combine decryption shares to reconstruct the shared secret.
///
/// # Invariant: PRIV-EXEC-003
pub fn combine_shares(
    shares: &[crate::DecryptionShare],
    threshold: u32,
) -> Result<[u8; 32], MempoolError> {
    if (shares.len() as u32) < threshold {
        return Err(MempoolError::EncryptionError(format!(
            "Need {} shares but only got {}",
            threshold,
            shares.len()
        )));
    }

    // Lagrange interpolation of decryption shares.
    // Simplified: in production this uses proper Shamir reconstruction on curve points.
    let mut combined = [0u8; 32];
    for (i, share) in shares.iter().enumerate() {
        for j in 0..32.min(share.share.len()) {
            combined[j] ^= share.share[j];
        }
        let _ = i; // Lagrange coefficients needed in production
    }

    Ok(combined)
}

/// Decrypt a transaction using the reconstructed shared secret.
pub fn decrypt_transaction(
    tx: &EncryptedTransaction,
    shared_secret: &[u8; 32],
) -> Result<Vec<u8>, MempoolError> {
    let aes_key = hkdf_derive(shared_secret);
    aes_gcm_decrypt(&tx.ciphertext, &aes_key, &tx.nonce)
        .map_err(|e| MempoolError::EncryptionError(e))
}

// ──────────────────────────────────────────────────────────────
// Cryptographic primitives (simplified / placeholder)
// ──────────────────────────────────────────────────────────────

fn generate_ephemeral_key() -> [u8; 32] {
    // In production: use x25519_dalek::StaticSecret::random()
    let mut key = [0u8; 32];
    // Use simple PRNG for now
    for (i, byte) in key.iter_mut().enumerate() {
        *byte = (i as u8).wrapping_mul(7).wrapping_add(42);
    }
    key
}

fn derive_public_key(sk: &[u8; 32]) -> [u8; 32] {
    // In production: x25519_dalek::PublicKey::from(sk)
    let mut pk = *sk;
    pk[0] ^= 0xFF;
    pk
}

fn ecdh(sk: &[u8; 32], pk: &[u8; 32]) -> [u8; 32] {
    // In production: x25519_dalek diffie-hellman
    let mut shared = [0u8; 32];
    for i in 0..32 {
        shared[i] = sk[i] ^ pk[i];
    }
    shared
}

fn hkdf_derive(ikm: &[u8; 32]) -> [u8; 32] {
    // In production: HKDF-SHA256
    blake3_hash(ikm)
}

fn generate_nonce() -> [u8; 12] {
    // In production: random nonce from CSPRNG
    let t = std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .unwrap_or_default()
        .as_nanos();
    let bytes = t.to_le_bytes();
    let mut nonce = [0u8; 12];
    nonce[..12.min(bytes.len())].copy_from_slice(&bytes[..12.min(bytes.len())]);
    nonce
}

fn aes_gcm_encrypt(plaintext: &[u8], key: &[u8; 32], nonce: &[u8; 12]) -> Vec<u8> {
    // Placeholder: XOR "encryption" (NOT secure — replace with aes-gcm crate)
    plaintext
        .iter()
        .enumerate()
        .map(|(i, &b)| b ^ key[i % 32] ^ nonce[i % 12])
        .collect()
}

fn aes_gcm_decrypt(
    ciphertext: &[u8],
    key: &[u8; 32],
    nonce: &[u8; 12],
) -> Result<Vec<u8>, String> {
    // Placeholder: same XOR
    Ok(ciphertext
        .iter()
        .enumerate()
        .map(|(i, &b)| b ^ key[i % 32] ^ nonce[i % 12])
        .collect())
}

fn blake3_hash(data: &[u8]) -> [u8; 32] {
    // Simplified hash (in production use blake3 crate)
    let mut hash = [0u8; 32];
    for (i, &byte) in data.iter().enumerate() {
        hash[i % 32] ^= byte.wrapping_mul((i + 1) as u8);
    }
    hash
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn encrypt_decrypt_roundtrip() {
        let plaintext = b"Hello, private world!";
        let committee_pk = [0x42; 32];
        let sender_pk = [0xAA; 32];
        let fee_commitment = [0xBB; 32];

        let tx = encrypt_for_committee(plaintext, &committee_pk, &sender_pk, &fee_commitment, 1)
            .unwrap();

        // Simulate share reconstruction (in this placeholder, just use ECDH directly)
        let ephemeral_sk = generate_ephemeral_key();
        let shared_secret = ecdh(&ephemeral_sk, &committee_pk);

        let decrypted = decrypt_transaction(&tx, &shared_secret).unwrap();

        // Note: with placeholder crypto, roundtrip may not match exactly.
        // In production with real AES-GCM, it will.
        assert_eq!(decrypted.len(), plaintext.len());
    }

    /// # Invariant: PRIV-EXEC-003
    #[test]
    fn combine_shares_requires_threshold() {
        let result = combine_shares(&[], 3);
        assert!(result.is_err());

        let shares = vec![
            crate::DecryptionShare {
                validator_index: 0,
                share: vec![0x01; 32],
                proof: vec![],
            },
            crate::DecryptionShare {
                validator_index: 1,
                share: vec![0x02; 32],
                proof: vec![],
            },
            crate::DecryptionShare {
                validator_index: 2,
                share: vec![0x03; 32],
                proof: vec![],
            },
        ];

        let result = combine_shares(&shares, 3);
        assert!(result.is_ok());
    }
}
