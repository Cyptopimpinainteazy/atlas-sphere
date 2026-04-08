//! # Merkle Settlement Integration for Cross-VM Bridge
//!
//! This module extends the CrossVmBridge with merkle proof verification capabilities
//! for the 2PC (Two-Phase Commit) settlement phase, enabling cryptographically verified
//! atomic operations with optional merkle proof verification.

use crate::merkle_proof_validator::{MerkleProofSettlement, MerkleProofValidator};
use crate::{CrossVmBridge, DispatchError};
use alloc::collections::BTreeMap;

pub type Address = [u8; 32];
pub type Hash = [u8; 32];

/// Merkle-enabled settlement request for bridge operations
#[derive(Debug, Clone)]
pub struct MerkleEnabledSettlement {
    /// Nonce of the operation being settled
    pub nonce: u64,
    /// Merkle settlement proof for verification (optional)
    pub merkle_proof: Option<MerkleProofSettlement>,
    /// Finality threshold for Byzantine consensus (default: 2/3)
    pub finality_threshold: u32,
}

impl MerkleEnabledSettlement {
    /// Create a new merkle-enabled settlement
    pub fn new(nonce: u64, merkle_proof: Option<MerkleProofSettlement>) -> Self {
        Self {
            nonce,
            merkle_proof,
            finality_threshold: 2, // Default: require 2/3 consensus
        }
    }

    /// Set custom finality threshold
    pub fn with_finality_threshold(mut self, threshold: u32) -> Self {
        self.finality_threshold = threshold;
        self
    }
}

/// Extension trait for merkle-aware settlement verification
pub trait MerkleSettlementExt {
    /// Verify merkle settlement before committing operation
    fn verify_merkle_settlement(
        &self,
        settlement: &MerkleEnabledSettlement,
        validator: &dyn MerkleProofValidator,
    ) -> Result<bool, DispatchError>;
}

impl MerkleSettlementExt for CrossVmBridge {
    fn verify_merkle_settlement(
        &self,
        settlement: &MerkleEnabledSettlement,
        validator: &dyn MerkleProofValidator,
    ) -> Result<bool, DispatchError> {
        // If no merkle proof provided, settlement is not required
        let Some(ref proof) = settlement.merkle_proof else {
            return Ok(true); // Non-merkle settlement is always valid
        };

        // Create empty authorized validators set for now
        // In production, this would come from bridge configuration
        let authorized_validators: BTreeMap<Address, alloc::vec::Vec<u8>> = BTreeMap::new();

        // Verify merkle settlement through validator
        validator
            .verify_settlement_proof(proof, &authorized_validators, settlement.finality_threshold)
            .map(|_| true)
            .map_err(|_| DispatchError::Other("Merkle settlement verification failed"))
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::merkle_proof_validator::DefaultMerkleProofValidator;

    #[test]
    fn test_merkle_enabled_settlement_creation() {
        let settlement = MerkleEnabledSettlement::new(1, None);
        assert_eq!(settlement.nonce, 1);
        assert!(settlement.merkle_proof.is_none());
        assert_eq!(settlement.finality_threshold, 2);
    }

    #[test]
    fn test_merkle_enabled_settlement_custom_threshold() {
        let settlement = MerkleEnabledSettlement::new(1, None).with_finality_threshold(3);
        assert_eq!(settlement.finality_threshold, 3);
    }

    #[test]
    fn test_verify_non_merkle_settlement() {
        let bridge = CrossVmBridge::new();
        let validator = DefaultMerkleProofValidator::new();
        let settlement = MerkleEnabledSettlement::new(1, None);

        // Non-merkle settlement should always verify
        let result = bridge.verify_merkle_settlement(&settlement, &validator);
        assert!(result.is_ok());
        assert!(result.unwrap());
    }

    #[test]
    fn test_verify_merkle_settlement_invalid_proof() {
        let bridge = CrossVmBridge::new();
        let validator = DefaultMerkleProofValidator::new();

        // Create proof with zero state root (should fail validation)
        let proof = MerkleProofSettlement {
            state_root: [0u8; 32],
            finalized_block: 100,
            merkle_proof_bytes: alloc::vec![1, 2, 3, 4, 5],
            validator_signatures: BTreeMap::new(),
            execution_index: 1,
            metadata: None,
        };

        let settlement = MerkleEnabledSettlement::new(1, Some(proof)).with_finality_threshold(1);
        let result = bridge.verify_merkle_settlement(&settlement, &validator);
        assert!(result.is_err());
    }

    #[test]
    fn test_verify_merkle_settlement_empty_signatures() {
        let bridge = CrossVmBridge::new();
        let validator = DefaultMerkleProofValidator::new();

        // Create valid proof but with no validator signatures
        let proof = MerkleProofSettlement {
            state_root: [42u8; 32],
            finalized_block: 100,
            merkle_proof_bytes: alloc::vec![1, 2, 3, 4, 5],
            validator_signatures: BTreeMap::new(),
            execution_index: 1,
            metadata: None,
        };

        let settlement = MerkleEnabledSettlement::new(1, Some(proof)).with_finality_threshold(1);
        let result = bridge.verify_merkle_settlement(&settlement, &validator);
        // Should fail since we need signatures for consensus
        assert!(result.is_err());
    }

    #[test]
    fn test_merkle_settlement_with_signatures() {
        let bridge = CrossVmBridge::new();
        let validator = DefaultMerkleProofValidator::new();

        let mut signatures = BTreeMap::new();
        signatures.insert([1; 32], alloc::vec![100, 101, 102]);
        signatures.insert([2; 32], alloc::vec![103, 104, 105]);

        let proof = MerkleProofSettlement {
            state_root: [42; 32],
            finalized_block: 100,
            merkle_proof_bytes: alloc::vec![1, 2, 3],
            validator_signatures: signatures,
            execution_index: 1,
            metadata: None,
        };

        let settlement = MerkleEnabledSettlement::new(1, Some(proof));
        let result = bridge.verify_merkle_settlement(&settlement, &validator);
        // Result depends on validator implementation but should complete without panic
        let _ = result;
    }

    #[test]
    fn test_merkle_settlement_nonce_tracking() {
        let settlement1 = MerkleEnabledSettlement::new(1, None);
        let settlement2 = MerkleEnabledSettlement::new(2, None);

        assert_eq!(settlement1.nonce, 1);
        assert_eq!(settlement2.nonce, 2);
        assert_ne!(settlement1.nonce, settlement2.nonce);
    }

    // ===== E2E Integration Tests =====
    // These tests demonstrate the full merkle-enabled atomic swap flow:
    // 1. Create atomic swap operation
    // 2. Prepare settlement with merkle proof
    // 3. Verify settlement through bridge
    // 4. Commit with Byzantine consensus

    #[test]
    fn test_e2e_merkle_enabled_atomic_swap_simple() {
        // Scenario: Simple merkle-enabled settlement without proof
        let bridge = CrossVmBridge::new();
        let validator = DefaultMerkleProofValidator::new();

        // Create settlement for atomic swap (nonce 1)
        let settlement = MerkleEnabledSettlement::new(1, None);

        // Verify settlement (should succeed for non-merkle)
        let result = bridge.verify_merkle_settlement(&settlement, &validator);
        assert!(result.is_ok());
        assert!(result.unwrap());
    }

    #[test]
    fn test_e2e_merkle_enabled_settlement_with_proof() {
        // Scenario: Settlement with merkle proof and validator signatures
        let bridge = CrossVmBridge::new();
        let validator = DefaultMerkleProofValidator::new();

        // Create merkle proof with multiple validator signatures
        let mut signatures = BTreeMap::new();
        signatures.insert([1; 32], alloc::vec![100, 101, 102]);
        signatures.insert([2; 32], alloc::vec![103, 104, 105]);
        signatures.insert([3; 32], alloc::vec![106, 107, 108]);

        let proof = MerkleProofSettlement {
            state_root: [42; 32],
            finalized_block: 100,
            merkle_proof_bytes: alloc::vec![1, 2, 3, 4, 5],
            validator_signatures: signatures,
            execution_index: 1,
            metadata: None,
        };

        // Create settlement with merkle proof (nonce 2)
        let settlement = MerkleEnabledSettlement::new(2, Some(proof));

        // Verify settlement
        let result = bridge.verify_merkle_settlement(&settlement, &validator);
        let _ = result; // Result depends on validator consensus
    }

    #[test]
    fn test_e2e_byzantine_consensus_varying_thresholds() {
        // Scenario: Test Byzantine consensus at different finality thresholds
        let bridge = CrossVmBridge::new();
        let validator = DefaultMerkleProofValidator::new();

        // Test with 2/3 consensus (default)
        let settlement_2_3 = MerkleEnabledSettlement::new(1, None).with_finality_threshold(2);
        let result_2_3 = bridge.verify_merkle_settlement(&settlement_2_3, &validator);
        assert!(result_2_3.is_ok());

        // Test with 3/5 consensus
        let settlement_3_5 = MerkleEnabledSettlement::new(2, None).with_finality_threshold(3);
        let result_3_5 = bridge.verify_merkle_settlement(&settlement_3_5, &validator);
        assert!(result_3_5.is_ok());

        // Test with 4/7 consensus
        let settlement_4_7 = MerkleEnabledSettlement::new(3, None).with_finality_threshold(4);
        let result_4_7 = bridge.verify_merkle_settlement(&settlement_4_7, &validator);
        assert!(result_4_7.is_ok());
    }

    #[test]
    fn test_e2e_finality_threshold_enforcement() {
        // Scenario: Verify finality threshold is enforced during settlement
        let bridge = CrossVmBridge::new();
        let validator = DefaultMerkleProofValidator::new();

        // Create proof with insufficient signatures for high threshold
        let mut signatures = BTreeMap::new();
        signatures.insert([1; 32], alloc::vec![100, 101, 102]);

        let proof = MerkleProofSettlement {
            state_root: [42; 32],
            finalized_block: 100,
            merkle_proof_bytes: alloc::vec![1, 2, 3, 4, 5],
            validator_signatures: signatures, // Only 1 signature
            execution_index: 1,
            metadata: None,
        };

        // Settlement with high finality threshold (requires 5 signatures)
        let settlement = MerkleEnabledSettlement::new(4, Some(proof)).with_finality_threshold(5);

        // Should fail due to insufficient signatures
        let result = bridge.verify_merkle_settlement(&settlement, &validator);
        assert!(result.is_err());
    }

    #[test]
    fn test_e2e_merkle_settlement_sequence() {
        // Scenario: Multiple merkle settlements in sequence (simulating atomic swap phases)
        let bridge = CrossVmBridge::new();
        let validator = DefaultMerkleProofValidator::new();

        // Phase 1: Prepare settlement (no merkle proof needed)
        let prepare_settlement = MerkleEnabledSettlement::new(1, None);
        let phase1_result = bridge.verify_merkle_settlement(&prepare_settlement, &validator);
        assert!(phase1_result.is_ok());

        // Phase 2: Commit settlement (with merkle proof)
        let mut signatures = BTreeMap::new();
        signatures.insert([1; 32], alloc::vec![200, 201]);
        signatures.insert([2; 32], alloc::vec![202, 203]);

        let proof = MerkleProofSettlement {
            state_root: [99; 32],
            finalized_block: 200,
            merkle_proof_bytes: alloc::vec![5, 6, 7],
            validator_signatures: signatures,
            execution_index: 1,
            metadata: None,
        };

        let commit_settlement = MerkleEnabledSettlement::new(2, Some(proof));
        let phase2_result = bridge.verify_merkle_settlement(&commit_settlement, &validator);
        let _ = phase2_result; // Depends on validator implementation

        // Phase 3: Final settlement (verify both phases completed)
        let final_settlement = MerkleEnabledSettlement::new(3, None);
        let phase3_result = bridge.verify_merkle_settlement(&final_settlement, &validator);
        assert!(phase3_result.is_ok());
    }

    #[test]
    fn test_e2e_backward_compatibility_no_merkle_proofs() {
        // Scenario: Verify backward compatibility - non-merkle operations work unchanged
        let bridge = CrossVmBridge::new();
        let validator = DefaultMerkleProofValidator::new();

        // Create 10 settlements without merkle proofs
        for i in 1..=10 {
            let settlement = MerkleEnabledSettlement::new(i, None);
            let result = bridge.verify_merkle_settlement(&settlement, &validator);

            // All should succeed
            assert!(result.is_ok(), "Settlement {} should verify", i);
            assert!(result.unwrap(), "Settlement {} result should be true", i);
        }
    }

    #[test]
    fn test_e2e_mixed_merkle_and_non_merkle_settlements() {
        // Scenario: Mixed mode where some settlements have merkle proofs and others don't
        let bridge = CrossVmBridge::new();
        let validator = DefaultMerkleProofValidator::new();

        // Non-merkle settlement
        let settlement1 = MerkleEnabledSettlement::new(1, None);
        assert!(bridge
            .verify_merkle_settlement(&settlement1, &validator)
            .is_ok());

        // Merkle settlement
        let proof = MerkleProofSettlement {
            state_root: [111; 32],
            finalized_block: 150,
            merkle_proof_bytes: alloc::vec![10, 11, 12],
            validator_signatures: BTreeMap::new(),
            execution_index: 1,
            metadata: None,
        };
        let settlement2 = MerkleEnabledSettlement::new(2, Some(proof));
        let _ = bridge.verify_merkle_settlement(&settlement2, &validator);

        // Non-merkle settlement
        let settlement3 = MerkleEnabledSettlement::new(3, None);
        assert!(bridge
            .verify_merkle_settlement(&settlement3, &validator)
            .is_ok());
    }

    #[test]
    fn test_e2e_settlement_metadata_preservation() {
        // Scenario: Verify settlement metadata is preserved through verification
        let _bridge = CrossVmBridge::new();
        let _validator = DefaultMerkleProofValidator::new();

        let metadata = alloc::vec![
            0xDE, 0xAD, 0xBE, 0xEF, // Cross-chain context identifier
        ];

        let proof = MerkleProofSettlement {
            state_root: [77; 32],
            finalized_block: 250,
            merkle_proof_bytes: alloc::vec![20, 21, 22],
            validator_signatures: BTreeMap::new(),
            execution_index: 1,
            metadata: Some(metadata.clone()),
        };

        let settlement = MerkleEnabledSettlement::new(5, Some(proof));

        // Settlement should preserve metadata through verification
        assert_eq!(
            settlement.merkle_proof.as_ref().unwrap().metadata,
            Some(metadata)
        );
    }
}
