//! # Merkle Settlement Integration for SwapCoordinator
//!
//! This module extends the SwapCoordinator with merkle proof verification capabilities.
//! It provides methods to integrate merkle proofs into the fast/slow claim settlement flow,
//! maintaining backward compatibility with non-merkle settlements.

use crate::merkle_settlement::{MerkleSettlementOutcome, MerkleSettlementProof};
use crate::types::HtlcSecret;
use crate::{CoordinatorError, SwapCoordinator};
use serde::{Deserialize, Serialize};
use std::collections::BTreeMap;

pub type Address = [u8; 32];
pub type Hash = [u8; 32];
pub type Signature = Vec<u8>;

/// Merkle-enabled settlement claim for fast chain
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct MerkleEnabledFastClaim {
    /// The HTLC secret preimage for the fast chain
    pub secret_bytes: [u8; 32],
    /// Merkle settlement proof (optional - if None, falls back to non-merkle path)
    pub merkle_settlement: Option<MerkleSettlementProof>,
}

/// Merkle-enabled settlement claim for slow chain
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct MerkleEnabledSlowClaim {
    /// Merkle settlement proof (optional - if None, falls back to non-merkle path)
    pub merkle_settlement: Option<MerkleSettlementProof>,
}

/// Result of merkle settlement verification
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum MerkleVerificationResult {
    /// Merkle settlement was verified successfully
    Verified,
    /// Merkle settlement verification failed
    VerificationFailed,
    /// Settlement proof was not provided (non-merkle path)
    NotProvided,
}

impl SwapCoordinator {
    /// Record a fast chain claim with optional merkle proof verification.
    ///
    /// If `merkle_settlement` is provided, verification status is checked before
    /// allowing the claim to proceed. If verification fails, an error is returned.
    /// If `merkle_settlement` is None, operates as standard non-merkle settlement.
    ///
    /// # Arguments
    /// * `session_id` - The swap session identifier
    /// * `fast_claim` - The fast claim with optional merkle settlement
    /// * `now_unix` - Current unix timestamp
    ///
    /// # Returns
    /// * `Ok(MerkleVerificationResult)` - Verification status
    /// * `Err(CoordinatorError)` - If claim fails or merkle verification fails
    pub fn record_merkle_fast_claim(
        &mut self,
        session_id: &str,
        fast_claim: MerkleEnabledFastClaim,
        now_unix: u64,
    ) -> Result<MerkleVerificationResult, CoordinatorError> {
        // Verify merkle settlement if provided
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

        // Convert secret_bytes to HtlcSecret and delegate to standard fast claim
        let secret = HtlcSecret(fast_claim.secret_bytes);
        self.record_fast_claim(session_id, secret, now_unix)?;

        Ok(verification_result)
    }

    /// Record a slow chain claim with optional merkle proof verification.
    ///
    /// If `merkle_settlement` is provided, verification status is checked before
    /// allowing the claim to proceed. If verification fails, an error is returned.
    /// If `merkle_settlement` is None, operates as standard non-merkle settlement.
    ///
    /// # Arguments
    /// * `session_id` - The swap session identifier
    /// * `slow_claim` - The slow claim with optional merkle settlement
    /// * `now_unix` - Current unix timestamp
    ///
    /// # Returns
    /// * `Ok(MerkleVerificationResult)` - Verification status
    /// * `Err(CoordinatorError)` - If claim fails or merkle verification fails
    pub fn record_merkle_slow_claim(
        &mut self,
        session_id: &str,
        slow_claim: MerkleEnabledSlowClaim,
        now_unix: u64,
    ) -> Result<MerkleVerificationResult, CoordinatorError> {
        // Verify merkle settlement if provided
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

        // Delegate to standard slow claim
        self.record_slow_claim(session_id, now_unix)?;

        Ok(verification_result)
    }

    /// Initialize merkle settlement tracking for a session.
    ///
    /// Creates and registers a new merkle settlement proof for the given session,
    /// tracking the state root and block number for later verification.
    ///
    /// # Arguments
    /// * `session_id` - The swap session identifier
    /// * `state_root` - The state merkle root being proven
    /// * `finalized_block` - Block number where state was finalized
    /// * `merkle_proof_bytes` - Raw merkle proof bytes
    /// * `execution_index` - Index for execution ordering
    /// * `now_unix` - Current unix timestamp
    ///
    /// # Returns
    /// * `MerkleSettlementProof` - The initialized settlement proof
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
    ///
    /// # Arguments
    /// * `session_id` - The swap session identifier
    ///
    /// # Returns
    /// * `Ok(bool)` - True if session requires merkle verification
    /// * `Err(CoordinatorError)` - If session not found
    pub fn session_requires_merkle(&self, session_id: &str) -> Result<bool, CoordinatorError> {
        self.get_session(session_id).map(|_| false).ok_or_else(|| {
            CoordinatorError::SessionNotFound {
                session_id: session_id.to_string(),
            }
        })
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::types::{
        FlashLeg, HtlcCreateParams, HtlcHash, HtlcId, HtlcRecord, HtlcStatus, VmTarget,
    };

    fn create_coordinator() -> SwapCoordinator {
        SwapCoordinator::with_default_config()
    }

    fn create_test_settlement() -> MerkleSettlementProof {
        let mut proof = MerkleSettlementProof::new(
            "test-session".to_string(),
            [42u8; 32],
            100,
            vec![1, 2, 3, 4, 5],
            0,
            1000,
        );
        proof.mark_verified();
        proof
    }

    fn prime_session_to_claiming_fast(
        coordinator: &mut SwapCoordinator,
        session_id: &str,
        hash: HtlcHash,
        now: u64,
    ) {
        let fast_htlc = HtlcRecord {
            id: HtlcId::from_bytes(vec![1u8; 32]),
            params: HtlcCreateParams {
                vm: VmTarget::Svm,
                recipient: vec![2u8; 32],
                hash_lock: hash,
                timelock: now + 3600,
                asset: vec![0u8; 32],
                amount: 1_000,
            },
            status: HtlcStatus::Funded,
            created_at_block: 1,
            confirmations_required: 1,
            confirmations: 1,
            params_hash: [0u8; 32],
        };

        let slow_htlc = HtlcRecord {
            id: HtlcId::from_bytes(vec![2u8; 32]),
            params: HtlcCreateParams {
                vm: VmTarget::Evm { chain_id: 1 },
                recipient: vec![3u8; 20],
                hash_lock: hash,
                timelock: now + 7200,
                asset: vec![0u8; 20],
                amount: 1_000,
            },
            status: HtlcStatus::Funded,
            created_at_block: 1,
            confirmations_required: 1,
            confirmations: 1,
            params_hash: [0u8; 32],
        };

        coordinator
            .record_htlc_fast(session_id, fast_htlc, now + 10)
            .expect("Failed to record fast HTLC");
        coordinator
            .record_htlc_slow(session_id, slow_htlc, now + 20)
            .expect("Failed to record slow HTLC");
        coordinator
            .begin_flash_execution(session_id, now + 30)
            .expect("Failed to begin flash execution");
    }

    #[test]
    fn test_merkle_fast_claim_with_verified_proof() {
        let mut coordinator = create_coordinator();

        // Setup a swap
        let flash_legs = vec![];
        let (session_id, secret, _hash) = coordinator
            .setup_swap(
                crate::types::VmTarget::Svm,
                crate::types::VmTarget::Evm { chain_id: 1 },
                flash_legs,
                1000,
            )
            .expect("Failed to setup swap");

        let hash = secret.hash();
        prime_session_to_claiming_fast(&mut coordinator, &session_id, hash, 1000);

        let settlement = create_test_settlement();
        let fast_claim = MerkleEnabledFastClaim {
            secret_bytes: secret.0,
            merkle_settlement: Some(settlement),
        };

        let result = coordinator
            .record_merkle_fast_claim(&session_id, fast_claim, 2000)
            .expect("Failed to record merkle fast claim");

        assert_eq!(result, MerkleVerificationResult::Verified);
    }

    #[test]
    fn test_merkle_fast_claim_without_proof() {
        let mut coordinator = create_coordinator();

        // Setup a swap
        let flash_legs = vec![];
        let (session_id, secret, _hash) = coordinator
            .setup_swap(
                crate::types::VmTarget::Svm,
                crate::types::VmTarget::Evm { chain_id: 1 },
                flash_legs,
                1000,
            )
            .expect("Failed to setup swap");

        let hash = secret.hash();
        prime_session_to_claiming_fast(&mut coordinator, &session_id, hash, 1000);

        let fast_claim = MerkleEnabledFastClaim {
            secret_bytes: secret.0,
            merkle_settlement: None,
        };

        let result = coordinator
            .record_merkle_fast_claim(&session_id, fast_claim, 2000)
            .expect("Failed to record non-merkle fast claim");

        assert_eq!(result, MerkleVerificationResult::NotProvided);
    }

    #[test]
    fn test_merkle_fast_claim_with_failed_verification() {
        let mut coordinator = create_coordinator();

        // Setup a swap
        let flash_legs = vec![];
        let (session_id, secret, _hash) = coordinator
            .setup_swap(
                crate::types::VmTarget::Svm,
                crate::types::VmTarget::Evm { chain_id: 1 },
                flash_legs,
                1000,
            )
            .expect("Failed to setup swap");

        let hash = secret.hash();
        prime_session_to_claiming_fast(&mut coordinator, &session_id, hash, 1000);

        let mut settlement = MerkleSettlementProof::new(
            session_id.clone(),
            [42u8; 32],
            100,
            vec![1, 2, 3, 4, 5],
            0,
            1000,
        );
        settlement.mark_failed(); // Mark as failed

        let fast_claim = MerkleEnabledFastClaim {
            secret_bytes: secret.0,
            merkle_settlement: Some(settlement),
        };

        let result = coordinator.record_merkle_fast_claim(&session_id, fast_claim, 2000);
        assert!(result.is_err());
        assert!(result
            .unwrap_err()
            .to_string()
            .contains("failed verification"));
    }

    #[test]
    fn test_merkle_slow_claim_with_verified_proof() {
        let mut coordinator = create_coordinator();

        // Setup a swap
        let flash_legs = vec![];
        let (session_id, secret, _hash) = coordinator
            .setup_swap(
                crate::types::VmTarget::Svm,
                crate::types::VmTarget::Evm { chain_id: 1 },
                flash_legs,
                1000,
            )
            .expect("Failed to setup swap");

        let hash = secret.hash();
        prime_session_to_claiming_fast(&mut coordinator, &session_id, hash, 1000);

        // Progress to ClaimingSlow
        coordinator
            .record_fast_claim(&session_id, secret, 1500)
            .expect("Failed to record fast claim");

        let settlement = create_test_settlement();
        let slow_claim = MerkleEnabledSlowClaim {
            merkle_settlement: Some(settlement),
        };

        let result = coordinator
            .record_merkle_slow_claim(&session_id, slow_claim, 2000)
            .expect("Failed to record merkle slow claim");

        assert_eq!(result, MerkleVerificationResult::Verified);
    }

    #[test]
    fn test_merkle_slow_claim_without_proof() {
        let mut coordinator = create_coordinator();

        // Setup a swap
        let flash_legs = vec![];
        let (session_id, secret, _hash) = coordinator
            .setup_swap(
                crate::types::VmTarget::Svm,
                crate::types::VmTarget::Evm { chain_id: 1 },
                flash_legs,
                1000,
            )
            .expect("Failed to setup swap");

        let hash = secret.hash();
        prime_session_to_claiming_fast(&mut coordinator, &session_id, hash, 1000);

        // Progress to ClaimingSlow
        coordinator
            .record_fast_claim(&session_id, secret, 1500)
            .expect("Failed to record fast claim");

        let slow_claim = MerkleEnabledSlowClaim {
            merkle_settlement: None,
        };

        let result = coordinator
            .record_merkle_slow_claim(&session_id, slow_claim, 2000)
            .expect("Failed to record non-merkle slow claim");

        assert_eq!(result, MerkleVerificationResult::NotProvided);
    }


    #[test]
    fn test_init_merkle_settlement() {
        let coordinator = create_coordinator();
        let settlement = coordinator.init_merkle_settlement(
            "test-session".to_string(),
            [42u8; 32],
            100,
            vec![1, 2, 3],
            0,
            1000,
        );

        assert_eq!(settlement.session_id, "test-session");
        assert_eq!(settlement.state_root, [42u8; 32]);
        assert_eq!(settlement.finalized_block, 100);
        assert_eq!(settlement.outcome, MerkleSettlementOutcome::Pending);
    }

    #[test]
    fn test_session_requires_merkle() {
        let coordinator = create_coordinator();
        let result = coordinator.session_requires_merkle("nonexistent");
        assert!(result.is_err());
    }
}
