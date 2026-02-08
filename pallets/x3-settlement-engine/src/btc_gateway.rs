//! BTC Atomic Gateway Module
//!
//! Handles native BTC settlement through:
//! - UTXO state tracking
//! - SPV proof verification
//! - HTLC script generation
//! - Adaptor signature support
//!
//! ## Design Principle
//!
//! BTC is a FIRST-CLASS ASSET, not a special case.
//! All BTC operations are controlled by X3 proofs.

use crate::types::{BtcBlockHeader, BtcUtxoState};
use codec::{Decode, Encode};
use scale_info::TypeInfo;
use sp_core::H256;
use sp_runtime::RuntimeDebug;
use sp_std::vec::Vec;

/// BTC HTLC parameters
#[derive(Clone, Encode, Decode, RuntimeDebug, TypeInfo)]
pub struct BtcHtlcParams {
    /// Secret hash (SHA256)
    pub secret_hash: H256,
    /// Recipient public key hash (20 bytes)
    pub recipient_pkh: [u8; 20],
    /// Refund public key hash (20 bytes)
    pub refund_pkh: [u8; 20],
    /// Timeout (block height)
    pub timeout_height: u64,
}

impl BtcHtlcParams {
    /// Generate HTLC redeem script
    ///
    /// Script structure (P2SH compatible):
    /// ```text
    /// OP_IF
    ///     OP_SHA256 <secret_hash> OP_EQUALVERIFY
    ///     OP_DUP OP_HASH160 <recipient_pkh> OP_EQUALVERIFY OP_CHECKSIG
    /// OP_ELSE
    ///     <timeout> OP_CHECKLOCKTIMEVERIFY OP_DROP
    ///     OP_DUP OP_HASH160 <refund_pkh> OP_EQUALVERIFY OP_CHECKSIG
    /// OP_ENDIF
    /// ```
    pub fn to_redeem_script(&self) -> Vec<u8> {
        let mut script = Vec::with_capacity(128);

        // OP_IF (claim path)
        script.push(0x63); // OP_IF

        // OP_SHA256 <secret_hash> OP_EQUALVERIFY
        script.push(0xa8); // OP_SHA256
        script.push(0x20); // Push 32 bytes
        script.extend_from_slice(self.secret_hash.as_bytes());
        script.push(0x88); // OP_EQUALVERIFY

        // OP_DUP OP_HASH160 <recipient_pkh> OP_EQUALVERIFY OP_CHECKSIG
        script.push(0x76); // OP_DUP
        script.push(0xa9); // OP_HASH160
        script.push(0x14); // Push 20 bytes
        script.extend_from_slice(&self.recipient_pkh);
        script.push(0x88); // OP_EQUALVERIFY
        script.push(0xac); // OP_CHECKSIG

        // OP_ELSE (refund path)
        script.push(0x67); // OP_ELSE

        // <timeout> OP_CHECKLOCKTIMEVERIFY OP_DROP
        let timeout_bytes = self.timeout_height.to_le_bytes();
        let significant_bytes = timeout_bytes
            .iter()
            .rev()
            .skip_while(|&&b| b == 0)
            .count()
            .max(1);
        script.push(significant_bytes as u8);
        script.extend_from_slice(&timeout_bytes[..significant_bytes]);
        script.push(0xb1); // OP_CHECKLOCKTIMEVERIFY
        script.push(0x75); // OP_DROP

        // OP_DUP OP_HASH160 <refund_pkh> OP_EQUALVERIFY OP_CHECKSIG
        script.push(0x76); // OP_DUP
        script.push(0xa9); // OP_HASH160
        script.push(0x14); // Push 20 bytes
        script.extend_from_slice(&self.refund_pkh);
        script.push(0x88); // OP_EQUALVERIFY
        script.push(0xac); // OP_CHECKSIG

        // OP_ENDIF
        script.push(0x68); // OP_ENDIF

        script
    }

    /// Compute P2SH address from redeem script
    pub fn to_p2sh_address(&self, testnet: bool) -> Vec<u8> {
        let script = self.to_redeem_script();
        let script_hash = sp_io::hashing::sha2_256(&script);
        let hash160 = Self::ripemd160(&script_hash);

        let mut address = Vec::with_capacity(25);
        // Version byte: 0x05 for mainnet P2SH, 0xC4 for testnet
        address.push(if testnet { 0xC4 } else { 0x05 });
        address.extend_from_slice(&hash160);

        // Add checksum (double SHA256, take first 4 bytes)
        let checksum = Self::double_sha256(&address);
        address.extend_from_slice(&checksum[..4]);

        address
    }

    fn ripemd160(data: &[u8]) -> [u8; 20] {
        // Simplified - in production use proper RIPEMD160
        let mut result = [0u8; 20];
        result.copy_from_slice(&sp_io::hashing::sha2_256(data)[..20]);
        result
    }

    fn double_sha256(data: &[u8]) -> [u8; 32] {
        let first = sp_io::hashing::sha2_256(data);
        sp_io::hashing::sha2_256(&first)
    }
}

/// BTC SPV proof data
#[derive(Clone, Encode, Decode, RuntimeDebug, TypeInfo)]
pub struct BtcSpvProof {
    /// Transaction (raw bytes)
    pub tx_bytes: Vec<u8>,
    /// Block header
    pub block_header: BtcBlockHeader,
    /// Merkle proof path (hashes from leaf to root)
    pub merkle_path: Vec<H256>,
    /// Index of transaction in block
    pub tx_index: u32,
}

impl BtcSpvProof {
    /// Verify SPV proof
    ///
    /// Steps:
    /// 1. Compute txid from tx_bytes
    /// 2. Verify merkle path leads to block_header.merkle_root
    /// 3. (Caller verifies block header is in valid chain)
    pub fn verify(&self) -> bool {
        // Compute txid (double SHA256)
        let txid_bytes = Self::double_sha256(&self.tx_bytes);
        let mut current = H256::from(txid_bytes);

        // Walk merkle path
        let mut index = self.tx_index;
        for sibling in &self.merkle_path {
            let combined = if index % 2 == 0 {
                // Current is left child
                Self::concat_and_hash(current.as_bytes(), sibling.as_bytes())
            } else {
                // Current is right child
                Self::concat_and_hash(sibling.as_bytes(), current.as_bytes())
            };
            current = H256::from(combined);
            index /= 2;
        }

        // Compare computed root with block header
        current == self.block_header.merkle_root
    }

    fn double_sha256(data: &[u8]) -> [u8; 32] {
        let first = sp_io::hashing::sha2_256(data);
        sp_io::hashing::sha2_256(&first)
    }

    fn concat_and_hash(left: &[u8], right: &[u8]) -> [u8; 32] {
        let mut combined = Vec::with_capacity(64);
        combined.extend_from_slice(left);
        combined.extend_from_slice(right);
        Self::double_sha256(&combined)
    }
}

/// BTC adaptor signature for atomic swaps
///
/// Adaptor signatures allow atomic BTC swaps without on-chain HTLCs:
/// 1. Maker creates adaptor signature with secret point
/// 2. Taker can extract secret from completed signature
/// 3. Secret revelation is atomic with BTC spend
#[derive(Clone, Encode, Decode, RuntimeDebug, TypeInfo)]
pub struct BtcAdaptorSignature {
    /// Pre-signature (incomplete until adapted)
    pub pre_signature: [u8; 64],
    /// Adaptor point (secret * G)
    pub adaptor_point: [u8; 33],
    /// Public nonce
    pub nonce: [u8; 33],
}

impl BtcAdaptorSignature {
    /// Verify adaptor signature is valid for given message and pubkey
    pub fn verify(&self, _message: &[u8; 32], _pubkey: &[u8; 33]) -> bool {
        // TODO: Implement Schnorr adaptor signature verification
        // This requires secp256k1 operations
        true // Placeholder
    }

    /// Extract secret from completed signature
    pub fn extract_secret(&self, completed_sig: &[u8; 64]) -> Option<[u8; 32]> {
        // s_complete = s_pre + secret
        // secret = s_complete - s_pre
        let mut secret = [0u8; 32];

        // Get s values (last 32 bytes of signature)
        let s_complete = &completed_sig[32..64];
        let s_pre = &self.pre_signature[32..64];

        // Subtract (mod curve order) - simplified
        for i in 0..32 {
            secret[i] = s_complete[i].wrapping_sub(s_pre[i]);
        }

        Some(secret)
    }
}

/// Track BTC reorg risk for a block
#[derive(Clone, Encode, Decode, RuntimeDebug, TypeInfo)]
pub struct BtcReorgRisk {
    /// Block hash
    pub block_hash: H256,
    /// Current depth (confirmations)
    pub depth: u32,
    /// Estimated reorg probability (basis points)
    pub reorg_probability_bps: u32,
    /// Time since block was seen
    pub age_seconds: u64,
}

impl BtcReorgRisk {
    /// Calculate reorg probability based on depth
    ///
    /// Approximate probabilities:
    /// - 1 conf: ~25% risk
    /// - 2 conf: ~5% risk
    /// - 3 conf: ~1% risk
    /// - 6 conf: ~0.01% risk
    pub fn estimate(depth: u32) -> u32 {
        match depth {
            0 => 10000, // 100%
            1 => 2500,  // 25%
            2 => 500,   // 5%
            3 => 100,   // 1%
            4 => 50,    // 0.5%
            5 => 10,    // 0.1%
            6 => 1,     // 0.01%
            _ => 0,     // Considered final
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_htlc_script_generation() {
        let params = BtcHtlcParams {
            secret_hash: H256::repeat_byte(0xAB),
            recipient_pkh: [0x11; 20],
            refund_pkh: [0x22; 20],
            timeout_height: 800000,
        };

        let script = params.to_redeem_script();
        assert!(!script.is_empty());

        // Verify script starts with OP_IF
        assert_eq!(script[0], 0x63);
    }

    #[test]
    fn test_reorg_probability() {
        assert_eq!(BtcReorgRisk::estimate(0), 10000);
        assert_eq!(BtcReorgRisk::estimate(1), 2500);
        assert_eq!(BtcReorgRisk::estimate(6), 1);
        assert_eq!(BtcReorgRisk::estimate(10), 0);
    }
}
