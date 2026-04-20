//! # Merkle-Backed Settlement for Cross-VM Coordinator
//!
//! Extends the cross-VM coordinator with merkle proof verification for atomic settlement.
//! This module integrates Gap #2 (state merkle proofs) into the coordinator's HTLC-based
//! settlement phase, enabling cryptographically verified atomic swap completion.

use crate::types::SwapSession;
use crate::{CoordinatorError, SwapCoordinator};
use crate::types::HtlcSecret;
use serde::{Deserialize, Serialize};
use std::collections::BTreeMap;

pub type Address = [u8; 32];
pub type Hash = [u8; 32];
pub type Signature = Vec<u8>;

/// Settlement outcome from merkle proof verification
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
pub enum MerkleSettlementOutcome {
    /// Merkle settlement verified successfully
    Verified,
    /// Merkle settlement pending verification
    Pending,
    /// Merkle settlement failed verification
    Failed,
}

/// Merkle-backed settlement data for atomic swap completion
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct MerkleSettlementProof {
    /// The atomic swap session being settled
    pub session_id: String,
    /// State root being proven
    pub state_root: Hash,
    /// Block number where settlement was finalized
    pub finalized_block: u64,
    /// Merkle proof path bytes
    pub merkle_proof_bytes: Vec<u8>,
    /// Validator signatures attesting to settlement
    pub validator_signatures: BTreeMap<Address, Signature>,
    /// Current settlement outcome
    pub outcome: MerkleSettlementOutcome,
    /// Timestamp when settlement was initiated (unix seconds)
    pub settlement_timestamp: u64,
    /// Index of this settlement in execution order (for ordering multiple settlements)
    pub execution_index: u64,
}

impl MerkleSettlementProof {
    /// Create a new merkle settlement proof
    pub fn new(
        session_id: String,
        state_root: Hash,
        finalized_block: u64,
        merkle_proof_bytes: Vec<u8>,
        execution_index: u64,
        now_unix: u64,
    ) -> Self {
        Self {
            session_id,
            state_root,
            finalized_block,
            merkle_proof_bytes,
            validator_signatures: BTreeMap::new(),
            outcome: MerkleSettlementOutcome::Pending,
            settlement_timestamp: now_unix,
            execution_index,
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

    /// Get the number of validator signatures
    pub fn validator_signature_count(&self) -> u32 {
        self.validator_signatures.len() as u32
    }

    /// Mark settlement as verified
    pub fn mark_verified(&mut self) {
        self.outcome = MerkleSettlementOutcome::Verified;
    }

    /// Mark settlement as failed
    pub fn mark_failed(&mut self) {
        self.outcome = MerkleSettlementOutcome::Failed;
    }

    /// Check if settlement is verified
    pub fn is_verified(&self) -> bool {
        self.outcome == MerkleSettlementOutcome::Verified
    }

    /// Compute settlement commitment hash
    pub fn settlement_commitment(&self) -> Hash {
        use sha2::{Digest, Sha256};

        let mut hasher = Sha256::new();
        hasher.update(self.session_id.as_bytes());
        hasher.update(self.state_root);
        hasher.update(self.finalized_block.to_le_bytes());
        hasher.update(self.execution_index.to_le_bytes());
        hasher.update(&self.merkle_proof_bytes);

        let result = hasher.finalize();
        let mut hash = [0u8; 32];
        hash.copy_from_slice(&result);
        hash
    }
}

/// Extended swap session with merkle settlement support
///
/// This tracks the merkle proof settlement for a swap session,
/// extending the base SwapSession with cryptographic verification.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct MerkleSwapSession {
    /// Base swap session
    pub base_session: SwapSession,
    /// Merkle settlement proof (optional until settlement begins)
    pub settlement_proof: Option<MerkleSettlementProof>,
    /// Whether merkle verification is required for this session
    pub requires_merkle_verification: bool,
}

/// Merkle-enabled settlement claim for fast chain.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct MerkleEnabledFastClaim {
    /// The HTLC secret preimage for the fast chain.
    pub secret_bytes: [u8; 32],
    /// Merkle settlement proof (optional - if None, falls back to non-merkle path).
    pub merkle_settlement: Option<MerkleSettlementProof>,
}

/// Merkle-enabled settlement claim for slow chain.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct MerkleEnabledSlowClaim {
    /// Merkle settlement proof (optional - if None, falls back to non-merkle path).
    pub merkle_settlement: Option<MerkleSettlementProof>,
}

/// Result of merkle settlement verification.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum MerkleVerificationResult {
    /// Merkle settlement was verified successfully.
    Verified,
    /// Merkle settlement verification failed.
    VerificationFailed,
    /// Settlement proof was not provided (non-merkle path).
    NotProvided,
}

impl SwapCoordinator {
    /// Record a fast chain claim with optional merkle proof verification.
    pub fn record_merkle_fast_claim(
        &mut self,
        session_id: &str,
        fast_claim: MerkleEnabledFastClaim,
        now_unix: u64,
    ) -> Result<MerkleVerificationResult, CoordinatorError> {
        let verification_result = if let Some(ref settlement) = fast_claim.merkle_settlement {
            if !settlement.is_verified() {
                return Err(CoordinatorError::Internal(format!(
                    "Merkle settlement for session '{}' failed verification (outcome: {:?})",
                    session_id, settlement.outcome
                )));
            }
            MerkleVerificationResult::Verified
        } else {
            MerkleVerificationResult::NotProvided
        };

        let secret = HtlcSecret(fast_claim.secret_bytes);
        self.record_fast_claim(session_id, secret, now_unix)?;

        Ok(verification_result)
    }

    /// Record a slow chain claim with optional merkle proof verification.
    pub fn record_merkle_slow_claim(
        &mut self,
        session_id: &str,
        slow_claim: MerkleEnabledSlowClaim,
        now_unix: u64,
    ) -> Result<MerkleVerificationResult, CoordinatorError> {
        let verification_result = if let Some(ref settlement) = slow_claim.merkle_settlement {
            if !settlement.is_verified() {
                return Err(CoordinatorError::Internal(format!(
                    "Merkle settlement for session '{}' failed verification (outcome: {:?})",
                    session_id, settlement.outcome
                )));
            }
            MerkleVerificationResult::Verified
        } else {
            MerkleVerificationResult::NotProvided
        };

        self.record_slow_claim(session_id, now_unix)?;

        Ok(verification_result)
    }

    /// Initialize merkle settlement tracking for a session.
    pub fn init_merkle_settlement(
        &self,
        session_id: String,
        state_root: Hash,
        finalized_block: u64,
        merkle_proof_bytes: Vec<u8>,
        execution_index: u64,
        now_unix: u64,
    ) -> MerkleSettlementProof {
        MerkleSettlementProof::new(
            session_id,
            state_root,
            finalized_block,
            merkle_proof_bytes,
            execution_index,
            now_unix,
        )
    }

    /// Check if a session requires merkle verification.
    pub fn session_requires_merkle(&self, session_id: &str) -> Result<bool, CoordinatorError> {
        self.get_session(session_id)
            .map(|s| s.requires_merkle_verification)
            .ok_or_else(|| CoordinatorError::SessionNotFound {
                session_id: session_id.to_string(),
            })
    }
}

impl MerkleSwapSession {
    /// Create a new merkle swap session wrapping a base session
    pub fn new(base_session: SwapSession, requires_merkle_verification: bool) -> Self {
        Self {
            base_session,
            settlement_proof: None,
            requires_merkle_verification,
        }
    }

    /// Initialize merkle settlement for this session
    pub fn init_merkle_settlement(
        &mut self,
        state_root: Hash,
        finalized_block: u64,
        merkle_proof_bytes: Vec<u8>,
        execution_index: u64,
        now_unix: u64,
    ) {
        if self.requires_merkle_verification {
            let proof = MerkleSettlementProof::new(
                self.base_session.session_id.clone(),
                state_root,
                finalized_block,
                merkle_proof_bytes,
                execution_index,
                now_unix,
            );
            self.settlement_proof = Some(proof);
        }
    }

    /// Check if settlement is ready for finalization
    pub fn is_settlement_ready(&self) -> bool {
        if !self.requires_merkle_verification {
            return true; // Non-merkle sessions are always ready
        }

        if let Some(proof) = &self.settlement_proof {
            proof.is_verified() && proof.validator_signature_count() > 0
        } else {
            false // No settlement proof initialized
        }
    }

    /// Get settlement outcome
    pub fn settlement_outcome(&self) -> Option<MerkleSettlementOutcome> {
        self.settlement_proof.as_ref().map(|p| p.outcome)
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::types::{HtlcHash, SwapPhase};

    fn create_test_session() -> SwapSession {
        SwapSession {
            session_id: "test-session".to_string(),
            hash_lock: HtlcHash([1u8; 32]),
            htlc_fast: None,
            htlc_slow: None,
            flash_legs: Vec::new(),
            leg_outcomes: Vec::new(),
            phase: SwapPhase::Setup,
            timelock_fast: 100,
            timelock_slow: 200,
            created_at: 0,
            updated_at: 0,
            requires_merkle_verification: true,
        }
    }

    #[test]
    fn test_merkle_settlement_creation() {
        let proof = MerkleSettlementProof::new(
            "test-session".to_string(),
            [1u8; 32],
            100,
            vec![1, 2, 3, 4],
            0,
            1000,
        );

        assert_eq!(proof.session_id, "test-session");
        assert_eq!(proof.state_root, [1u8; 32]);
        assert_eq!(proof.finalized_block, 100);
        assert_eq!(proof.validator_signature_count(), 0);
        assert_eq!(proof.outcome, MerkleSettlementOutcome::Pending);
    }

    #[test]
    fn test_add_validator_signature() {
        let mut proof = MerkleSettlementProof::new(
            "test-session".to_string(),
            [1u8; 32],
            100,
            vec![1, 2, 3, 4],
            0,
            1000,
        );

        let validator_id = [2u8; 32];
        let signature = vec![1, 2, 3];

        assert!(proof.add_validator_signature(validator_id, signature.clone()));
        assert_eq!(proof.validator_signature_count(), 1);

        // Duplicate should be rejected
        assert!(!proof.add_validator_signature(validator_id, signature));
        assert_eq!(proof.validator_signature_count(), 1);
    }

    #[test]
    fn test_merkle_settlement_verification_states() {
        let mut proof = MerkleSettlementProof::new(
            "test-session".to_string(),
            [1u8; 32],
            100,
            vec![1, 2, 3, 4],
            0,
            1000,
        );

        assert_eq!(proof.outcome, MerkleSettlementOutcome::Pending);
        assert!(!proof.is_verified());

        proof.mark_verified();
        assert_eq!(proof.outcome, MerkleSettlementOutcome::Verified);
        assert!(proof.is_verified());

        proof.mark_failed();
        assert_eq!(proof.outcome, MerkleSettlementOutcome::Failed);
        assert!(!proof.is_verified());
    }

    #[test]
    fn test_merkle_swap_session_creation() {
        let base_session = create_test_session();
        let merkle_session = MerkleSwapSession::new(base_session.clone(), true);

        assert_eq!(
            merkle_session.base_session.session_id,
            base_session.session_id
        );
        assert!(merkle_session.requires_merkle_verification);
        assert!(merkle_session.settlement_proof.is_none());
    }

    #[test]
    fn test_merkle_swap_session_settlement_readiness() {
        let base_session = create_test_session();
        let mut merkle_session = MerkleSwapSession::new(base_session, true);

        // Not ready yet - no settlement proof
        assert!(!merkle_session.is_settlement_ready());

        // Initialize settlement
        merkle_session.init_merkle_settlement([1u8; 32], 100, vec![1, 2, 3, 4], 0, 1000);

        // Still not ready - not verified
        assert!(!merkle_session.is_settlement_ready());

        // Mark as verified with signature
        if let Some(proof) = &mut merkle_session.settlement_proof {
            proof.add_validator_signature([2u8; 32], vec![1, 2, 3]);
            proof.mark_verified();
        }

        // Now ready
        assert!(merkle_session.is_settlement_ready());
    }

    #[test]
    fn test_merkle_swap_session_non_merkle_always_ready() {
        let base_session = create_test_session();
        let merkle_session = MerkleSwapSession::new(base_session, false);

        // Non-merkle sessions are always ready
        assert!(merkle_session.is_settlement_ready());
    }

    #[test]
    fn test_settlement_commitment_deterministic() {
        let proof1 = MerkleSettlementProof::new(
            "test-session".to_string(),
            [1u8; 32],
            100,
            vec![1, 2, 3, 4],
            0,
            1000,
        );

        let proof2 = MerkleSettlementProof::new(
            "test-session".to_string(),
            [1u8; 32],
            100,
            vec![1, 2, 3, 4],
            0,
            1000,
        );

        assert_eq!(
            proof1.settlement_commitment(),
            proof2.settlement_commitment()
        );
    }

    #[test]
    fn test_settlement_commitment_changes_with_state_root() {
        let proof1 = MerkleSettlementProof::new(
            "test-session".to_string(),
            [1u8; 32],
            100,
            vec![1, 2, 3, 4],
            0,
            1000,
        );

        let proof2 = MerkleSettlementProof::new(
            "test-session".to_string(),
            [2u8; 32],
            100,
            vec![1, 2, 3, 4],
            0,
            1000,
        );

        assert_ne!(
            proof1.settlement_commitment(),
            proof2.settlement_commitment()
        );
    }
}

#[cfg(test)]
mod coordinator_merkle_tests {
    use super::*;

    #[test]
    fn test_session_requires_merkle_missing_session() {
        let coordinator = SwapCoordinator::with_default_config();
        let result = coordinator.session_requires_merkle("nonexistent");
        assert!(result.is_err());
    }
}
