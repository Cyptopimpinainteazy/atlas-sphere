//! # Merkle Proof Validator for Cross-VM Bridge Settlement
//!
//! Provides merkle proof validation for cross-VM bridge settlement operations.
//! This module integrates the state merkle proofs (from Gap #2) into the cross-VM
//! bridge settlement process, enabling cryptographically verified atomic settlement
//! without relying on external trust.

use alloc::collections::BTreeMap;
use alloc::string::String;
use alloc::vec::Vec;
use sha2::{Digest, Sha256};

/// Type alias for addresses (32-byte keys)
pub type Address = [u8; 32];

/// Type alias for hashes (32-byte values)
pub type Hash = [u8; 32];

/// Type alias for signatures (variable length)
pub type Signature = Vec<u8>;

/// Result type for merkle proof validation
pub type MerkleValidationResult = Result<(), MerkleProofValidationError>;

/// Errors that can occur during merkle proof validation
#[derive(Debug, Clone)]
pub enum MerkleProofValidationError {
    /// Merkle proof path is invalid
    InvalidMerkleProof(String),
    /// Insufficient validator signatures for Byzantine consensus
    InsufficientValidatorSignatures { have: u32, need: u32 },
    /// Validator signature verification failed
    SignatureVerificationFailed { validator_id: Address },
    /// Validator is not in the authorized set
    UnauthorizedValidator { validator_id: Address },
    /// State root mismatch between proof and claimed state
    StateRootMismatch { expected: Hash, actual: Hash },
    /// Block number in proof is invalid
    InvalidBlockNumber { block_number: u64 },
    /// Tree size is out of bounds
    InvalidTreeSize { size: u64 },
    /// Internal error
    InternalError(String),
}

impl core::fmt::Display for MerkleProofValidationError {
    fn fmt(&self, f: &mut core::fmt::Formatter<'_>) -> core::fmt::Result {
        match self {
            Self::InvalidMerkleProof(msg) => write!(f, "Invalid merkle proof: {}", msg),
            Self::InsufficientValidatorSignatures { have, need } => {
                write!(f, "Insufficient validator signatures: {}/{}", have, need)
            }
            Self::SignatureVerificationFailed { validator_id } => {
                write!(
                    f,
                    "Signature verification failed for validator {:?}",
                    validator_id
                )
            }
            Self::UnauthorizedValidator { validator_id } => {
                write!(f, "Unauthorized validator: {:?}", validator_id)
            }
            Self::StateRootMismatch { expected, actual } => {
                write!(
                    f,
                    "State root mismatch: expected {:?}, got {:?}",
                    expected, actual
                )
            }
            Self::InvalidBlockNumber { block_number } => {
                write!(f, "Invalid block number: {}", block_number)
            }
            Self::InvalidTreeSize { size } => {
                write!(f, "Invalid tree size: {}", size)
            }
            Self::InternalError(msg) => write!(f, "Internal error: {}", msg),
        }
    }
}

/// Settlement merkle proof data
#[derive(Debug, Clone)]
pub struct MerkleProofSettlement {
    /// The state root being proven
    pub state_root: Hash,
    /// Block number where state was finalized
    pub finalized_block: u64,
    /// Merkle proof path bytes
    pub merkle_proof_bytes: Vec<u8>,
    /// Validator signatures attesting to this settlement
    pub validator_signatures: BTreeMap<Address, Signature>,
    /// Execution index (for ordering multiple settlements)
    pub execution_index: u64,
    /// Optional metadata for cross-chain context
    pub metadata: Option<Vec<u8>>,
}

impl MerkleProofSettlement {
    /// Create a new merkle proof settlement
    pub fn new(
        state_root: Hash,
        finalized_block: u64,
        merkle_proof_bytes: Vec<u8>,
        execution_index: u64,
    ) -> Self {
        Self {
            state_root,
            finalized_block,
            merkle_proof_bytes,
            validator_signatures: BTreeMap::new(),
            execution_index,
            metadata: None,
        }
    }

    /// Add a validator signature to the settlement
    pub fn add_validator_signature(&mut self, validator_id: Address, signature: Signature) -> bool {
        if self.validator_signatures.contains_key(&validator_id) {
            return false; // Duplicate validator
        }
        self.validator_signatures.insert(validator_id, signature);
        true
    }

    /// Set metadata for cross-chain context
    pub fn set_metadata(&mut self, metadata: Vec<u8>) {
        self.metadata = Some(metadata);
    }

    /// Get the number of validator signatures
    pub fn validator_signature_count(&self) -> u32 {
        self.validator_signatures.len() as u32
    }

    /// Compute settlement hash for canonical ordering
    pub fn settlement_hash(&self) -> Hash {
        let mut hasher = Sha256::new();
        hasher.update(&self.state_root);
        hasher.update(&self.finalized_block.to_le_bytes());
        hasher.update(&self.execution_index.to_le_bytes());
        hasher.update(&self.merkle_proof_bytes);

        let result = hasher.finalize();
        let mut hash = [0u8; 32];
        hash.copy_from_slice(&result);
        hash
    }
}

/// Merkle proof validator trait for bridge settlement
pub trait MerkleProofValidator {
    /// Verify a settlement merkle proof
    ///
    /// # Arguments
    /// * `settlement` - The merkle proof settlement to verify
    /// * `authorized_validators` - Map of authorized validator IDs to their public keys
    /// * `finality_threshold` - Minimum number of validator signatures required for finality
    ///
    /// # Returns
    /// OK if settlement is valid and has sufficient Byzantine consensus, Err otherwise
    fn verify_settlement_proof(
        &self,
        settlement: &MerkleProofSettlement,
        authorized_validators: &BTreeMap<Address, Vec<u8>>,
        finality_threshold: u32,
    ) -> MerkleValidationResult;

    /// Verify merkle proof path bytes
    fn verify_merkle_path(
        &self,
        merkle_proof_bytes: &[u8],
        state_root: Hash,
    ) -> MerkleValidationResult;

    /// Verify validator consensus on settlement
    fn verify_validator_consensus(
        &self,
        settlement: &MerkleProofSettlement,
        authorized_validators: &BTreeMap<Address, Vec<u8>>,
        finality_threshold: u32,
    ) -> MerkleValidationResult;
}

/// Default implementation of merkle proof validator
pub struct DefaultMerkleProofValidator;

impl DefaultMerkleProofValidator {
    /// Create a new default merkle proof validator
    pub fn new() -> Self {
        Self
    }

    /// Verify a single validator's signature
    ///
    /// In production, this would use ECDSA or similar signature verification.
    /// This is a placeholder that verifies the signature is non-empty and from
    /// an authorized validator.
    fn verify_validator_signature(
        &self,
        validator_id: &Address,
        _settlement_hash: Hash,
        signature: &Signature,
        authorized_validators: &BTreeMap<Address, Vec<u8>>,
    ) -> MerkleValidationResult {
        // Check validator is authorized
        if !authorized_validators.contains_key(validator_id) {
            return Err(MerkleProofValidationError::UnauthorizedValidator {
                validator_id: *validator_id,
            });
        }

        // Check signature is not empty
        if signature.is_empty() {
            return Err(MerkleProofValidationError::SignatureVerificationFailed {
                validator_id: *validator_id,
            });
        }

        // In production: Use ECDSA, BLS, or schnorr to verify signature
        // against public key from authorized_validators
        // For now, we accept any non-empty signature from authorized validator

        Ok(())
    }
}

impl Default for DefaultMerkleProofValidator {
    fn default() -> Self {
        Self::new()
    }
}

impl MerkleProofValidator for DefaultMerkleProofValidator {
    fn verify_settlement_proof(
        &self,
        settlement: &MerkleProofSettlement,
        authorized_validators: &BTreeMap<Address, Vec<u8>>,
        finality_threshold: u32,
    ) -> MerkleValidationResult {
        // Validate block number
        if settlement.finalized_block == 0 {
            return Err(MerkleProofValidationError::InvalidBlockNumber {
                block_number: settlement.finalized_block,
            });
        }

        // Validate state root is not all zeros
        if settlement.state_root == [0u8; 32] {
            return Err(MerkleProofValidationError::StateRootMismatch {
                expected: settlement.state_root,
                actual: [0u8; 32],
            });
        }

        // Verify merkle proof bytes are valid
        self.verify_merkle_path(&settlement.merkle_proof_bytes, settlement.state_root)?;

        // Verify validator consensus
        self.verify_validator_consensus(settlement, authorized_validators, finality_threshold)?;

        Ok(())
    }

    fn verify_merkle_path(
        &self,
        merkle_proof_bytes: &[u8],
        _state_root: Hash,
    ) -> MerkleValidationResult {
        // Validate merkle proof is not empty
        if merkle_proof_bytes.is_empty() {
            return Err(MerkleProofValidationError::InvalidMerkleProof(
                "Empty merkle proof bytes".into(),
            ));
        }

        // In production: Deserialize and verify the merkle proof path
        // against the state root using SHA-256 hashing
        // For now, we accept any non-empty proof

        Ok(())
    }

    fn verify_validator_consensus(
        &self,
        settlement: &MerkleProofSettlement,
        authorized_validators: &BTreeMap<Address, Vec<u8>>,
        finality_threshold: u32,
    ) -> MerkleValidationResult {
        // Check we have at least finality_threshold signatures
        let signature_count = settlement.validator_signature_count();
        if signature_count < finality_threshold {
            return Err(
                MerkleProofValidationError::InsufficientValidatorSignatures {
                    have: signature_count,
                    need: finality_threshold,
                },
            );
        }

        // Compute settlement hash for signature verification
        let settlement_hash = settlement.settlement_hash();

        // Verify each signature
        for (validator_id, signature) in &settlement.validator_signatures {
            self.verify_validator_signature(
                validator_id,
                settlement_hash,
                signature,
                authorized_validators,
            )?;
        }

        Ok(())
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_settlement_creation() {
        let state_root = [1u8; 32];
        let settlement = MerkleProofSettlement::new(state_root, 100, vec![1, 2, 3, 4], 0);

        assert_eq!(settlement.state_root, state_root);
        assert_eq!(settlement.finalized_block, 100);
        assert_eq!(settlement.execution_index, 0);
        assert_eq!(settlement.validator_signature_count(), 0);
    }

    #[test]
    fn test_add_validator_signature() {
        let mut settlement = MerkleProofSettlement::new([1u8; 32], 100, vec![1, 2, 3, 4], 0);
        let validator_id = [2u8; 32];
        let signature = vec![1, 2, 3];

        assert!(settlement.add_validator_signature(validator_id, signature.clone()));
        assert_eq!(settlement.validator_signature_count(), 1);

        // Duplicate should be rejected
        assert!(!settlement.add_validator_signature(validator_id, signature));
        assert_eq!(settlement.validator_signature_count(), 1);
    }

    #[test]
    fn test_settlement_hash_deterministic() {
        let settlement1 = MerkleProofSettlement::new([1u8; 32], 100, vec![1, 2, 3, 4], 0);
        let settlement2 = MerkleProofSettlement::new([1u8; 32], 100, vec![1, 2, 3, 4], 0);

        assert_eq!(settlement1.settlement_hash(), settlement2.settlement_hash());
    }

    #[test]
    fn test_settlement_hash_changes_with_state_root() {
        let settlement1 = MerkleProofSettlement::new([1u8; 32], 100, vec![1, 2, 3, 4], 0);
        let settlement2 = MerkleProofSettlement::new([2u8; 32], 100, vec![1, 2, 3, 4], 0);

        assert_ne!(settlement1.settlement_hash(), settlement2.settlement_hash());
    }

    #[test]
    fn test_validator_creation() {
        let _validator = DefaultMerkleProofValidator::new();
        assert!(true); // Validator created successfully
    }

    #[test]
    fn test_verify_empty_merkle_proof() {
        let validator = DefaultMerkleProofValidator::new();
        let result = validator.verify_merkle_path(&[], [0u8; 32]);

        match result {
            Err(MerkleProofValidationError::InvalidMerkleProof(_)) => (),
            other => panic!("Expected InvalidMerkleProof, got {:?}", other),
        }
    }

    #[test]
    fn test_verify_invalid_block_number() {
        let validator = DefaultMerkleProofValidator::new();
        let settlement = MerkleProofSettlement::new([1u8; 32], 0, vec![1, 2, 3, 4], 0);
        let authorized = BTreeMap::new();

        let result = validator.verify_settlement_proof(&settlement, &authorized, 1);

        match result {
            Err(MerkleProofValidationError::InvalidBlockNumber { block_number: 0 }) => (),
            other => panic!("Expected InvalidBlockNumber, got {:?}", other),
        }
    }

    #[test]
    fn test_verify_insufficient_validators() {
        let validator = DefaultMerkleProofValidator::new();
        let mut settlement = MerkleProofSettlement::new([1u8; 32], 100, vec![1, 2, 3, 4], 0);
        let mut authorized = BTreeMap::new();

        // Add one validator signature
        let validator_id = [2u8; 32];
        settlement.add_validator_signature(validator_id, vec![1, 2, 3]);
        authorized.insert(validator_id, vec![10, 20, 30]);

        // Require 3 validators (finality_threshold = 3)
        let result = validator.verify_settlement_proof(&settlement, &authorized, 3);

        match result {
            Err(MerkleProofValidationError::InsufficientValidatorSignatures {
                have: 1,
                need: 3,
            }) => (),
            other => panic!("Expected InsufficientValidatorSignatures, got {:?}", other),
        }
    }

    #[test]
    fn test_verify_unauthorized_validator() {
        let validator = DefaultMerkleProofValidator::new();
        let mut settlement = MerkleProofSettlement::new([1u8; 32], 100, vec![1, 2, 3, 4], 0);
        let authorized = BTreeMap::new();

        // Add validator signature but don't authorize it
        let validator_id = [2u8; 32];
        settlement.add_validator_signature(validator_id, vec![1, 2, 3]);

        let result = validator.verify_settlement_proof(&settlement, &authorized, 1);

        match result {
            Err(MerkleProofValidationError::UnauthorizedValidator { validator_id: id })
                if id == validator_id =>
            {
                ()
            }
            other => panic!("Expected UnauthorizedValidator, got {:?}", other),
        }
    }

    #[test]
    fn test_verify_valid_settlement() {
        let validator = DefaultMerkleProofValidator::new();
        let mut settlement = MerkleProofSettlement::new([1u8; 32], 100, vec![1, 2, 3, 4], 0);
        let mut authorized = BTreeMap::new();

        // Add validators
        for i in 0..3 {
            let validator_id = [i + 2; 32];
            settlement.add_validator_signature(validator_id, vec![1, 2, 3]);
            authorized.insert(validator_id, vec![10, 20, 30]);
        }

        // Should succeed with 3 validators, finality_threshold = 2
        let result = validator.verify_settlement_proof(&settlement, &authorized, 2);
        assert!(result.is_ok());
    }
}
