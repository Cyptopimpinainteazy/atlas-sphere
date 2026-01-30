use anyhow::Result;
use ed25519_dalek::{Keypair, PublicKey, SecretKey, Signature, Signer, Verifier};
use sha2::{Digest, Sha256};

/// Derive an ed25519 Keypair deterministically from a 64-byte BIP39 seed.
/// This uses the first 32 bytes of the seed as the ed25519 secret seed.
pub fn derive_ed25519_keypair(seed: &[u8; 64]) -> Result<Keypair> {
    let seed32: [u8; 32] = seed[0..32]
        .try_into()
        .map_err(|_| anyhow::anyhow!("invalid seed length"))?;
    let sk = SecretKey::from_bytes(&seed32)?;
    let pk = PublicKey::from(&sk);
    Ok(Keypair {
        secret: sk,
        public: pk,
    })
}

/// Return the public key as hex string
pub fn public_key_hex(kp: &Keypair) -> String {
    hex::encode(kp.public.as_bytes())
}

/// Return a simple address: SHA256(pubkey) hex (prototype format)
pub fn address_from_keypair(kp: &Keypair) -> String {
    let h = Sha256::digest(kp.public.as_bytes());
    hex::encode(h)
}

/// Sign message with the keypair
pub fn sign_message(kp: &Keypair, msg: &[u8]) -> Vec<u8> {
    kp.sign(msg).to_bytes().to_vec()
}

/// Verify signature and return bool
pub fn verify_signature(kp: &Keypair, msg: &[u8], sig: &[u8]) -> bool {
    use std::convert::TryInto;
    if let Ok(sig_arr) = sig.try_into() as Result<&[u8; 64], _> {
        if let Ok(sig_obj) = ed25519_dalek::Signature::from_bytes(sig_arr) {
            return kp.public.verify(msg, &sig_obj).is_ok();
        }
    }
    false
}
