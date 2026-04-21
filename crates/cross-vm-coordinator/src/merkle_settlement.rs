//! # Merkle-Backed Settlement for Cross-VM Coordinator
//!
//! Extends the cross-VM coordinator with merkle proof verification for atomic settlement.
//! This module integrates Gap #2 (state merkle proofs) into the coordinator's HTLC-based
//! settlement phase, enabling cryptographically verified atomic swap completion.

use crate::types::SwapSession;
use crate::types::HtlcSecret;
use crate::{CoordinatorError, SwapCoordinator};
use serde::{Deserialize, Serialize};
use std::collections::BTreeMap;
use x3_cross_vm_bridge::merkle_settlement_bridge::{MerkleEnabledSettlement, MerkleSettlementExt};
use x3_cross_vm_bridge::merkle_proof_validator::{
    DefaultMerkleProofValidator, MerkleProofSettlement as BridgeMerkleProofSettlement,
};
use x3_cross_vm_bridge::{CrossVmBridge, MAX_PROOF_AGE_BLOCKS_TESTNET};

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
    fn apply_bridge_verification_result<E: core::fmt::Debug>(
        &mut self,
        bridge_result: Result<bool, E>,
    ) -> Result<(), String> {
        match bridge_result {
            Ok(true) => {
                self.outcome = MerkleSettlementOutcome::Verified;
                Ok(())
            }
            Ok(false) => {
                self.outcome = MerkleSettlementOutcome::Failed;
                Err("bridge merkle settlement returned false".to_string())
            }
            Err(e) => {
                self.outcome = MerkleSettlementOutcome::Failed;
                Err(format!("{e:?}"))
            }
        }
    }

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

    /// Convert this coordinator proof into the canonical bridge proof type.
    pub fn to_bridge_settlement(&self) -> BridgeMerkleProofSettlement {
        BridgeMerkleProofSettlement {
            state_root: self.state_root,
            finalized_block: self.finalized_block,
            merkle_proof_bytes: self.merkle_proof_bytes.clone(),
            validator_signatures: self.validator_signatures.clone(),
            execution_index: self.execution_index,
            metadata: Some(self.session_id.as_bytes().to_vec()),
        }
    }

    /// Verify this settlement with the canonical bridge validator path.
    ///
    /// Uses bridge-default freshness bounds anchored to this proof's finalized block.
    fn verify_via_bridge_validator(
        &mut self,
        authorized_validators: &BTreeMap<Address, Vec<u8>>,
        finality_threshold: u32,
    ) -> Result<(), String> {
        self.verify_via_bridge_validator_with_freshness(
            authorized_validators,
            finality_threshold,
            self.finalized_block,
            MAX_PROOF_AGE_BLOCKS_TESTNET as u64,
        )
    }

    /// Verify this settlement via canonical bridge settlement verification with explicit
    /// freshness context.
    ///
    /// On success, marks this proof as verified. On failure, marks it failed.
    fn verify_via_bridge_validator_with_freshness(
        &mut self,
        authorized_validators: &BTreeMap<Address, Vec<u8>>,
        finality_threshold: u32,
        current_finalized_block: u64,
        max_proof_age_blocks: u64,
    ) -> Result<(), String> {
        let bridge = CrossVmBridge::new();
        let validator = DefaultMerkleProofValidator::new();
        let settlement = MerkleEnabledSettlement::new(
            self.execution_index,
            Some(self.to_bridge_settlement()),
        )
        .with_finality_threshold(finality_threshold)
        .with_freshness(current_finalized_block, max_proof_age_blocks);

        self.apply_bridge_verification_result(
            bridge.verify_merkle_settlement(&settlement, &validator, authorized_validators),
        )
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

trait MerkleSettlementCarrier {
    fn settlement_proof_mut(&mut self) -> &mut Option<MerkleSettlementProof>;
}

impl MerkleSettlementCarrier for MerkleEnabledFastClaim {
    fn settlement_proof_mut(&mut self) -> &mut Option<MerkleSettlementProof> {
        &mut self.merkle_settlement
    }
}

impl MerkleSettlementCarrier for MerkleEnabledSlowClaim {
    fn settlement_proof_mut(&mut self) -> &mut Option<MerkleSettlementProof> {
        &mut self.merkle_settlement
    }
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
    fn validate_settlement_session_binding(
        session_id: &str,
        settlement: &MerkleSettlementProof,
    ) -> Result<(), CoordinatorError> {
        if settlement.session_id != session_id {
            return Err(CoordinatorError::Internal(format!(
                "Merkle settlement session mismatch: claim session '{}' does not match proof session '{}'",
                session_id, settlement.session_id
            )));
        }
        Ok(())
    }

    fn record_merkle_claim_with_bridge_context<C, F>(
        &mut self,
        session_id: &str,
        now_unix: u64,
        mut claim: C,
        authorized_validators: &BTreeMap<Address, Vec<u8>>,
        finality_threshold: u32,
        freshness: Option<(u64, u64)>,
        record_claim: F,
    ) -> Result<MerkleVerificationResult, CoordinatorError>
    where
        C: MerkleSettlementCarrier,
        F: FnOnce(&mut Self, &str, C, u64) -> Result<MerkleVerificationResult, CoordinatorError>,
    {
        Self::verify_claim_settlement_with_session_bridge_internal(
            session_id,
            now_unix,
            claim.settlement_proof_mut(),
            authorized_validators,
            finality_threshold,
            freshness,
        )
        .map_err(|e| {
            CoordinatorError::Internal(format!(
                "Merkle settlement bridge verification failed for session '{session_id}': {e}"
            ))
        })?;

        record_claim(self, session_id, claim, now_unix)
    }

    fn build_ephemeral_merkle_session(
        session_id: &str,
        now_unix: u64,
        proof: MerkleSettlementProof,
    ) -> MerkleSwapSession {
        // Coordinator claim paths may verify before canonical session lookup,
        // so wrap the supplied proof in an ephemeral merkle-aware session.
        let base_session = SwapSession {
            session_id: session_id.to_string(),
            hash_lock: crate::types::HtlcHash([0u8; 32]),
            htlc_fast: None,
            htlc_slow: None,
            flash_legs: Vec::new(),
            leg_outcomes: Vec::new(),
            phase: crate::types::SwapPhase::Setup,
            timelock_fast: 0,
            timelock_slow: 0,
            created_at: now_unix,
            updated_at: now_unix,
            requires_merkle_verification: true,
        };

        let mut merkle_session = MerkleSwapSession::new(base_session, true);
        merkle_session.settlement_proof = Some(proof);
        merkle_session
    }

    fn verify_claim_settlement_with_session_bridge_internal(
        session_id: &str,
        now_unix: u64,
        settlement_proof: &mut Option<MerkleSettlementProof>,
        authorized_validators: &BTreeMap<Address, Vec<u8>>,
        finality_threshold: u32,
        freshness: Option<(u64, u64)>,
    ) -> Result<(), CoordinatorError> {
        let Some(proof) = settlement_proof.take() else {
            return Ok(());
        };

        Self::validate_settlement_session_binding(session_id, &proof)?;

        let mut merkle_session = Self::build_ephemeral_merkle_session(session_id, now_unix, proof);

        let verification_result = if let Some((current_finalized_block, max_proof_age_blocks)) =
            freshness
        {
            merkle_session.verify_settlement_with_bridge_freshness(
                authorized_validators,
                finality_threshold,
                current_finalized_block,
                max_proof_age_blocks,
            )
        } else {
            merkle_session.verify_settlement_with_bridge(authorized_validators, finality_threshold)
        };

        *settlement_proof = merkle_session.settlement_proof;
        verification_result
    }

    fn evaluate_optional_settlement_verification(
        session_id: &str,
        settlement: Option<&MerkleSettlementProof>,
    ) -> Result<MerkleVerificationResult, CoordinatorError> {
        match settlement {
            Some(settlement) => {
                Self::validate_settlement_session_binding(session_id, settlement)?;
                if !settlement.is_verified() {
                    return Err(CoordinatorError::Internal(format!(
                        "Merkle settlement for session '{}' failed verification (outcome: {:?})",
                        session_id, settlement.outcome
                    )));
                }
                Ok(MerkleVerificationResult::Verified)
            }
            None => Ok(MerkleVerificationResult::NotProvided),
        }
    }

    fn record_merkle_claim_with_optional_verification<F>(
        &mut self,
        session_id: &str,
        settlement: Option<&MerkleSettlementProof>,
        record_fn: F,
    ) -> Result<MerkleVerificationResult, CoordinatorError>
    where
        F: FnOnce(&mut Self) -> Result<(), CoordinatorError>,
    {
        let verification_result =
            Self::evaluate_optional_settlement_verification(session_id, settlement)?;
        record_fn(self)?;
        Ok(verification_result)
    }

    /// Record a fast chain claim with optional merkle proof verification.
    pub fn record_merkle_fast_claim(
        &mut self,
        session_id: &str,
        fast_claim: MerkleEnabledFastClaim,
        now_unix: u64,
    ) -> Result<MerkleVerificationResult, CoordinatorError> {
        let secret = HtlcSecret(fast_claim.secret_bytes);
        self.record_merkle_claim_with_optional_verification(
            session_id,
            fast_claim.merkle_settlement.as_ref(),
            |coordinator| coordinator.record_fast_claim(session_id, secret, now_unix),
        )
    }

    /// Record a fast claim and verify merkle proof with the canonical bridge validator.
    pub fn record_merkle_fast_claim_with_bridge_verification(
        &mut self,
        session_id: &str,
        fast_claim: MerkleEnabledFastClaim,
        now_unix: u64,
        authorized_validators: &BTreeMap<Address, Vec<u8>>,
        finality_threshold: u32,
    ) -> Result<MerkleVerificationResult, CoordinatorError> {
        self.record_merkle_claim_with_bridge_context(
            session_id,
            now_unix,
            fast_claim,
            authorized_validators,
            finality_threshold,
            None,
            SwapCoordinator::record_merkle_fast_claim,
        )
    }

    /// Record a fast claim and verify merkle proof with explicit freshness context.
    pub fn record_merkle_fast_claim_with_bridge_freshness_verification(
        &mut self,
        session_id: &str,
        fast_claim: MerkleEnabledFastClaim,
        now_unix: u64,
        authorized_validators: &BTreeMap<Address, Vec<u8>>,
        finality_threshold: u32,
        current_finalized_block: u64,
        max_proof_age_blocks: u64,
    ) -> Result<MerkleVerificationResult, CoordinatorError> {
        self.record_merkle_claim_with_bridge_context(
            session_id,
            now_unix,
            fast_claim,
            authorized_validators,
            finality_threshold,
            Some((current_finalized_block, max_proof_age_blocks)),
            SwapCoordinator::record_merkle_fast_claim,
        )
    }

    /// Record a slow chain claim with optional merkle proof verification.
    pub fn record_merkle_slow_claim(
        &mut self,
        session_id: &str,
        slow_claim: MerkleEnabledSlowClaim,
        now_unix: u64,
    ) -> Result<MerkleVerificationResult, CoordinatorError> {
        self.record_merkle_claim_with_optional_verification(
            session_id,
            slow_claim.merkle_settlement.as_ref(),
            |coordinator| coordinator.record_slow_claim(session_id, now_unix),
        )
    }

    /// Record a slow claim and verify merkle proof with the canonical bridge validator.
    pub fn record_merkle_slow_claim_with_bridge_verification(
        &mut self,
        session_id: &str,
        slow_claim: MerkleEnabledSlowClaim,
        now_unix: u64,
        authorized_validators: &BTreeMap<Address, Vec<u8>>,
        finality_threshold: u32,
    ) -> Result<MerkleVerificationResult, CoordinatorError> {
        self.record_merkle_claim_with_bridge_context(
            session_id,
            now_unix,
            slow_claim,
            authorized_validators,
            finality_threshold,
            None,
            SwapCoordinator::record_merkle_slow_claim,
        )
    }

    /// Record a slow claim and verify merkle proof with explicit freshness context.
    pub fn record_merkle_slow_claim_with_bridge_freshness_verification(
        &mut self,
        session_id: &str,
        slow_claim: MerkleEnabledSlowClaim,
        now_unix: u64,
        authorized_validators: &BTreeMap<Address, Vec<u8>>,
        finality_threshold: u32,
        current_finalized_block: u64,
        max_proof_age_blocks: u64,
    ) -> Result<MerkleVerificationResult, CoordinatorError> {
        self.record_merkle_claim_with_bridge_context(
            session_id,
            now_unix,
            slow_claim,
            authorized_validators,
            finality_threshold,
            Some((current_finalized_block, max_proof_age_blocks)),
            SwapCoordinator::record_merkle_slow_claim,
        )
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
    fn verify_settlement_internal<F>(
        &mut self,
        error_prefix: &str,
        verify_fn: F,
    ) -> Result<(), CoordinatorError>
    where
        F: FnOnce(&mut MerkleSettlementProof) -> Result<(), String>,
    {
        if !self.requires_merkle_verification {
            return Ok(());
        }

        let proof = self
            .settlement_proof
            .as_mut()
            .ok_or_else(|| {
                CoordinatorError::Internal(
                    "Merkle settlement proof not initialized for required session".to_string(),
                )
            })?;

        verify_fn(proof)
            .map_err(|e| CoordinatorError::Internal(format!("{error_prefix}: {e}")))
    }

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

    /// Verify this session's settlement proof via the canonical bridge validator path.
    pub fn verify_settlement_with_bridge(
        &mut self,
        authorized_validators: &BTreeMap<Address, Vec<u8>>,
        finality_threshold: u32,
    ) -> Result<(), CoordinatorError> {
        self.verify_settlement_internal(
            "Session merkle verification failed",
            |proof| proof.verify_via_bridge_validator(authorized_validators, finality_threshold),
        )
    }

    /// Verify this session's settlement proof with explicit freshness bounds.
    pub fn verify_settlement_with_bridge_freshness(
        &mut self,
        authorized_validators: &BTreeMap<Address, Vec<u8>>,
        finality_threshold: u32,
        current_finalized_block: u64,
        max_proof_age_blocks: u64,
    ) -> Result<(), CoordinatorError> {
        self.verify_settlement_internal(
            "Session merkle freshness verification failed",
            |proof| {
                proof.verify_via_bridge_validator_with_freshness(
                authorized_validators,
                finality_threshold,
                current_finalized_block,
                max_proof_age_blocks,
                )
            },
        )
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

        let ok_result: Result<bool, &str> = Ok(true);
        let _ = proof.apply_bridge_verification_result(ok_result);
        assert_eq!(proof.outcome, MerkleSettlementOutcome::Verified);
        assert!(proof.is_verified());

        let err_result: Result<bool, &str> = Err("forced-failure");
        let _ = proof.apply_bridge_verification_result(err_result);
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
            let ok_result: Result<bool, &str> = Ok(true);
            let _ = proof.apply_bridge_verification_result(ok_result);
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
    fn test_session_verify_with_bridge_requires_initialized_proof() {
        let base_session = create_test_session();
        let mut session = MerkleSwapSession::new(base_session, true);

        let validators = BTreeMap::new();
        let result = session.verify_settlement_with_bridge(&validators, 1);
        assert!(result.is_err());
        assert!(result
            .unwrap_err()
            .to_string()
            .contains("not initialized"));
    }

    #[test]
    fn test_session_verify_with_bridge_freshness_rejects_stale_proof() {
        let base_session = create_test_session();
        let mut session = MerkleSwapSession::new(base_session, true);

        session.init_merkle_settlement([42u8; 32], 100, vec![42; 72], 0, 1000);

        let mut validators = BTreeMap::new();
        validators.insert([1u8; 32], vec![7u8; 32]);

        let result = session.verify_settlement_with_bridge_freshness(&validators, 1, 200, 50);
        assert!(result.is_err());
        assert!(result
            .unwrap_err()
            .to_string()
            .contains("freshness verification failed"));
        assert_eq!(session.settlement_outcome(), Some(MerkleSettlementOutcome::Failed));
    }

    #[test]
    fn test_session_verify_with_bridge_rejects_invalid_proof() {
        let base_session = create_test_session();
        let mut session = MerkleSwapSession::new(base_session, true);

        session.init_merkle_settlement([0u8; 32], 100, vec![1, 2, 3, 4], 0, 1000);

        let validators = BTreeMap::new();
        let result = session.verify_settlement_with_bridge(&validators, 1);
        assert!(result.is_err());
        assert!(result
            .unwrap_err()
            .to_string()
            .contains("verification failed"));
        assert_eq!(session.settlement_outcome(), Some(MerkleSettlementOutcome::Failed));
    }

    #[test]
    fn test_session_verify_with_bridge_non_merkle_noop() {
        let base_session = create_test_session();
        let mut session = MerkleSwapSession::new(base_session, false);

        let validators = BTreeMap::new();
        let result = session.verify_settlement_with_bridge(&validators, 1);
        assert!(result.is_ok());
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

    #[test]
    fn test_to_bridge_settlement_preserves_fields() {
        let mut proof = MerkleSettlementProof::new(
            "test-session".to_string(),
            [7u8; 32],
            777,
            vec![9, 8, 7],
            3,
            1000,
        );
        proof.add_validator_signature([1u8; 32], vec![2u8; 64]);

        let bridge = proof.to_bridge_settlement();
        assert_eq!(bridge.state_root, [7u8; 32]);
        assert_eq!(bridge.finalized_block, 777);
        assert_eq!(bridge.merkle_proof_bytes, vec![9, 8, 7]);
        assert_eq!(bridge.execution_index, 3);
        assert_eq!(bridge.validator_signatures.len(), 1);
        assert_eq!(bridge.metadata, Some(b"test-session".to_vec()));
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

    #[test]
    fn test_fast_claim_bridge_verification_runs_before_session_lookup() {
        let mut coordinator = SwapCoordinator::with_default_config();
        let fast_claim = MerkleEnabledFastClaim {
            secret_bytes: [0u8; 32],
            merkle_settlement: Some(MerkleSettlementProof::new(
                "missing-session".to_string(),
                [0u8; 32],
                100,
                vec![1, 2, 3, 4],
                0,
                1,
            )),
        };

        let validators = BTreeMap::new();
        let err = coordinator
            .record_merkle_fast_claim_with_bridge_verification(
                "missing-session",
                fast_claim,
                1,
                &validators,
                1,
            )
            .unwrap_err();

        assert!(
            err.to_string().contains("bridge verification failed"),
            "expected bridge verification failure before session-not-found"
        );
    }

    #[test]
    fn test_fast_claim_non_bridge_rejects_unverified_before_session_lookup() {
        let mut coordinator = SwapCoordinator::with_default_config();
        let fast_claim = MerkleEnabledFastClaim {
            secret_bytes: [0u8; 32],
            merkle_settlement: Some(MerkleSettlementProof::new(
                "missing-session".to_string(),
                [0u8; 32],
                100,
                vec![1, 2, 3, 4],
                0,
                1,
            )),
        };

        let err = coordinator
            .record_merkle_fast_claim("missing-session", fast_claim, 1)
            .unwrap_err();

        assert!(
            err.to_string().contains("failed verification"),
            "expected merkle verification failure before session-not-found"
        );
    }

    #[test]
    fn test_fast_claim_non_bridge_rejects_mismatched_proof_session_before_lookup() {
        let mut coordinator = SwapCoordinator::with_default_config();
        let mut proof = MerkleSettlementProof::new(
            "other-session".to_string(),
            [1u8; 32],
            100,
            vec![1, 2, 3, 4],
            0,
            1,
        );
        proof.outcome = MerkleSettlementOutcome::Verified;

        let fast_claim = MerkleEnabledFastClaim {
            secret_bytes: [0u8; 32],
            merkle_settlement: Some(proof),
        };

        let err = coordinator
            .record_merkle_fast_claim("missing-session", fast_claim, 1)
            .unwrap_err();

        assert!(
            err.to_string().contains("session mismatch"),
            "expected session-binding mismatch failure before session-not-found"
        );
    }

    #[test]
    fn test_fast_claim_non_bridge_verified_matching_session_falls_through_to_lookup() {
        let mut coordinator = SwapCoordinator::with_default_config();
        let mut proof = MerkleSettlementProof::new(
            "missing-session".to_string(),
            [1u8; 32],
            100,
            vec![1, 2, 3, 4],
            0,
            1,
        );
        proof.outcome = MerkleSettlementOutcome::Verified;

        let fast_claim = MerkleEnabledFastClaim {
            secret_bytes: [0u8; 32],
            merkle_settlement: Some(proof),
        };

        let err = coordinator
            .record_merkle_fast_claim("missing-session", fast_claim, 1)
            .unwrap_err();

        assert!(
            matches!(err, CoordinatorError::SessionNotFound { .. }),
            "expected session-not-found after verified proof passes"
        );
    }

    #[test]
    fn test_fast_claim_non_bridge_without_proof_falls_through_to_session_lookup() {
        let mut coordinator = SwapCoordinator::with_default_config();
        let fast_claim = MerkleEnabledFastClaim {
            secret_bytes: [0u8; 32],
            merkle_settlement: None,
        };

        let err = coordinator
            .record_merkle_fast_claim("missing-session", fast_claim, 1)
            .unwrap_err();

        assert!(
            matches!(err, CoordinatorError::SessionNotFound { .. }),
            "expected session-not-found when proof is not provided"
        );
    }

    #[test]
    fn test_slow_claim_bridge_verification_runs_before_session_lookup() {
        let mut coordinator = SwapCoordinator::with_default_config();
        let slow_claim = MerkleEnabledSlowClaim {
            merkle_settlement: Some(MerkleSettlementProof::new(
                "missing-session".to_string(),
                [0u8; 32],
                100,
                vec![1, 2, 3, 4],
                0,
                1,
            )),
        };

        let validators = BTreeMap::new();
        let err = coordinator
            .record_merkle_slow_claim_with_bridge_verification(
                "missing-session",
                slow_claim,
                1,
                &validators,
                1,
            )
            .unwrap_err();

        assert!(
            err.to_string().contains("bridge verification failed"),
            "expected bridge verification failure before session-not-found"
        );
    }

    #[test]
    fn test_fast_claim_bridge_without_proof_falls_through_to_session_lookup() {
        let mut coordinator = SwapCoordinator::with_default_config();
        let fast_claim = MerkleEnabledFastClaim {
            secret_bytes: [0u8; 32],
            merkle_settlement: None,
        };

        let validators = BTreeMap::new();
        let err = coordinator
            .record_merkle_fast_claim_with_bridge_verification(
                "missing-session",
                fast_claim,
                1,
                &validators,
                1,
            )
            .unwrap_err();

        assert!(
            matches!(err, CoordinatorError::SessionNotFound { .. }),
            "expected session-not-found when bridge proof is not provided"
        );
    }

    #[test]
    fn test_fast_claim_bridge_rejects_mismatched_proof_session_before_lookup() {
        let mut coordinator = SwapCoordinator::with_default_config();
        let fast_claim = MerkleEnabledFastClaim {
            secret_bytes: [0u8; 32],
            merkle_settlement: Some(MerkleSettlementProof::new(
                "other-session".to_string(),
                [0u8; 32],
                100,
                vec![1, 2, 3, 4],
                0,
                1,
            )),
        };

        let validators = BTreeMap::new();
        let err = coordinator
            .record_merkle_fast_claim_with_bridge_verification(
                "missing-session",
                fast_claim,
                1,
                &validators,
                1,
            )
            .unwrap_err();

        assert!(
            err.to_string().contains("session mismatch"),
            "expected session-binding mismatch failure before session-not-found"
        );
    }

    #[test]
    fn test_slow_claim_non_bridge_rejects_unverified_before_session_lookup() {
        let mut coordinator = SwapCoordinator::with_default_config();
        let slow_claim = MerkleEnabledSlowClaim {
            merkle_settlement: Some(MerkleSettlementProof::new(
                "missing-session".to_string(),
                [0u8; 32],
                100,
                vec![1, 2, 3, 4],
                0,
                1,
            )),
        };

        let err = coordinator
            .record_merkle_slow_claim("missing-session", slow_claim, 1)
            .unwrap_err();

        assert!(
            err.to_string().contains("failed verification"),
            "expected merkle verification failure before session-not-found"
        );
    }

    #[test]
    fn test_fast_and_slow_unverified_non_bridge_share_error_class_markers() {
        let mut fast_coordinator = SwapCoordinator::with_default_config();
        let fast_claim = MerkleEnabledFastClaim {
            secret_bytes: [0u8; 32],
            merkle_settlement: Some(MerkleSettlementProof::new(
                "missing-session".to_string(),
                [0u8; 32],
                100,
                vec![1, 2, 3, 4],
                0,
                1,
            )),
        };

        let fast_err = fast_coordinator
            .record_merkle_fast_claim("missing-session", fast_claim, 1)
            .unwrap_err();

        let mut slow_coordinator = SwapCoordinator::with_default_config();
        let slow_claim = MerkleEnabledSlowClaim {
            merkle_settlement: Some(MerkleSettlementProof::new(
                "missing-session".to_string(),
                [0u8; 32],
                100,
                vec![1, 2, 3, 4],
                0,
                1,
            )),
        };

        let slow_err = slow_coordinator
            .record_merkle_slow_claim("missing-session", slow_claim, 1)
            .unwrap_err();

        let fast_msg = fast_err.to_string();
        let slow_msg = slow_err.to_string();

        assert!(
            fast_msg.contains("Internal error:"),
            "expected fast path internal error classification"
        );
        assert!(
            slow_msg.contains("Internal error:"),
            "expected slow path internal error classification"
        );
        assert!(
            fast_msg.contains("failed verification"),
            "expected fast path verification failure marker"
        );
        assert!(
            slow_msg.contains("failed verification"),
            "expected slow path verification failure marker"
        );
    }

    #[test]
    fn test_slow_claim_non_bridge_rejects_mismatched_proof_session_before_lookup() {
        let mut coordinator = SwapCoordinator::with_default_config();
        let mut proof = MerkleSettlementProof::new(
            "other-session".to_string(),
            [1u8; 32],
            100,
            vec![1, 2, 3, 4],
            0,
            1,
        );
        proof.outcome = MerkleSettlementOutcome::Verified;

        let slow_claim = MerkleEnabledSlowClaim {
            merkle_settlement: Some(proof),
        };

        let err = coordinator
            .record_merkle_slow_claim("missing-session", slow_claim, 1)
            .unwrap_err();

        assert!(
            err.to_string().contains("session mismatch"),
            "expected session-binding mismatch failure before session-not-found"
        );
    }

    #[test]
    fn test_fast_and_slow_mismatched_non_bridge_share_error_class_markers() {
        let mut fast_proof = MerkleSettlementProof::new(
            "other-session".to_string(),
            [1u8; 32],
            100,
            vec![1, 2, 3, 4],
            0,
            1,
        );
        fast_proof.outcome = MerkleSettlementOutcome::Verified;

        let mut fast_coordinator = SwapCoordinator::with_default_config();
        let fast_claim = MerkleEnabledFastClaim {
            secret_bytes: [0u8; 32],
            merkle_settlement: Some(fast_proof),
        };

        let fast_err = fast_coordinator
            .record_merkle_fast_claim("missing-session", fast_claim, 1)
            .unwrap_err();

        let mut slow_proof = MerkleSettlementProof::new(
            "other-session".to_string(),
            [1u8; 32],
            100,
            vec![1, 2, 3, 4],
            0,
            1,
        );
        slow_proof.outcome = MerkleSettlementOutcome::Verified;

        let mut slow_coordinator = SwapCoordinator::with_default_config();
        let slow_claim = MerkleEnabledSlowClaim {
            merkle_settlement: Some(slow_proof),
        };

        let slow_err = slow_coordinator
            .record_merkle_slow_claim("missing-session", slow_claim, 1)
            .unwrap_err();

        let fast_msg = fast_err.to_string();
        let slow_msg = slow_err.to_string();

        assert!(
            fast_msg.contains("Internal error:"),
            "expected fast path internal error classification"
        );
        assert!(
            slow_msg.contains("Internal error:"),
            "expected slow path internal error classification"
        );
        assert!(
            fast_msg.contains("session mismatch"),
            "expected fast path mismatch marker"
        );
        assert!(
            slow_msg.contains("session mismatch"),
            "expected slow path mismatch marker"
        );
    }

    #[test]
    fn test_fast_and_slow_mismatched_bridge_share_error_class_markers() {
        let mut fast_coordinator = SwapCoordinator::with_default_config();
        let fast_claim = MerkleEnabledFastClaim {
            secret_bytes: [0u8; 32],
            merkle_settlement: Some(MerkleSettlementProof::new(
                "other-session".to_string(),
                [0u8; 32],
                100,
                vec![1, 2, 3, 4],
                0,
                1,
            )),
        };

        let validators = BTreeMap::new();
        let fast_err = fast_coordinator
            .record_merkle_fast_claim_with_bridge_verification(
                "missing-session",
                fast_claim,
                1,
                &validators,
                1,
            )
            .unwrap_err();

        let mut slow_coordinator = SwapCoordinator::with_default_config();
        let slow_claim = MerkleEnabledSlowClaim {
            merkle_settlement: Some(MerkleSettlementProof::new(
                "other-session".to_string(),
                [0u8; 32],
                100,
                vec![1, 2, 3, 4],
                0,
                1,
            )),
        };

        let slow_err = slow_coordinator
            .record_merkle_slow_claim_with_bridge_verification(
                "missing-session",
                slow_claim,
                1,
                &validators,
                1,
            )
            .unwrap_err();

        let fast_msg = fast_err.to_string();
        let slow_msg = slow_err.to_string();

        assert!(
            fast_msg.contains("Internal error:"),
            "expected fast path internal error classification"
        );
        assert!(
            slow_msg.contains("Internal error:"),
            "expected slow path internal error classification"
        );
        assert!(
            fast_msg.contains("bridge verification failed"),
            "expected fast path bridge verification failure marker"
        );
        assert!(
            slow_msg.contains("bridge verification failed"),
            "expected slow path bridge verification failure marker"
        );
        assert!(
            fast_msg.contains("session mismatch"),
            "expected fast path mismatch marker"
        );
        assert!(
            slow_msg.contains("session mismatch"),
            "expected slow path mismatch marker"
        );
    }

    #[test]
    fn test_fast_and_slow_bridge_verification_share_error_class_markers() {
        let mut fast_coordinator = SwapCoordinator::with_default_config();
        let fast_claim = MerkleEnabledFastClaim {
            secret_bytes: [0u8; 32],
            merkle_settlement: Some(MerkleSettlementProof::new(
                "missing-session".to_string(),
                [0u8; 32],
                100,
                vec![1, 2, 3, 4],
                0,
                1,
            )),
        };

        let validators = BTreeMap::new();
        let fast_err = fast_coordinator
            .record_merkle_fast_claim_with_bridge_verification(
                "missing-session",
                fast_claim,
                1,
                &validators,
                1,
            )
            .unwrap_err();

        let mut slow_coordinator = SwapCoordinator::with_default_config();
        let slow_claim = MerkleEnabledSlowClaim {
            merkle_settlement: Some(MerkleSettlementProof::new(
                "missing-session".to_string(),
                [0u8; 32],
                100,
                vec![1, 2, 3, 4],
                0,
                1,
            )),
        };

        let slow_err = slow_coordinator
            .record_merkle_slow_claim_with_bridge_verification(
                "missing-session",
                slow_claim,
                1,
                &validators,
                1,
            )
            .unwrap_err();

        let fast_msg = fast_err.to_string();
        let slow_msg = slow_err.to_string();

        assert!(
            fast_msg.contains("Internal error:"),
            "expected fast path internal error classification"
        );
        assert!(
            slow_msg.contains("Internal error:"),
            "expected slow path internal error classification"
        );
        assert!(
            fast_msg.contains("bridge verification failed"),
            "expected fast path bridge verification failure marker"
        );
        assert!(
            slow_msg.contains("bridge verification failed"),
            "expected slow path bridge verification failure marker"
        );
    }

    #[test]
    fn test_fast_and_slow_mismatched_freshness_bridge_share_error_class_markers() {
        let mut fast_coordinator = SwapCoordinator::with_default_config();
        let fast_claim = MerkleEnabledFastClaim {
            secret_bytes: [0u8; 32],
            merkle_settlement: Some(MerkleSettlementProof::new(
                "other-session".to_string(),
                [42u8; 32],
                100,
                vec![42; 72],
                0,
                1,
            )),
        };

        let mut validators = BTreeMap::new();
        validators.insert([1u8; 32], vec![7u8; 32]);

        let fast_err = fast_coordinator
            .record_merkle_fast_claim_with_bridge_freshness_verification(
                "missing-session",
                fast_claim,
                1,
                &validators,
                1,
                200,
                50,
            )
            .unwrap_err();

        let mut slow_coordinator = SwapCoordinator::with_default_config();
        let slow_claim = MerkleEnabledSlowClaim {
            merkle_settlement: Some(MerkleSettlementProof::new(
                "other-session".to_string(),
                [42u8; 32],
                100,
                vec![42; 72],
                0,
                1,
            )),
        };

        let slow_err = slow_coordinator
            .record_merkle_slow_claim_with_bridge_freshness_verification(
                "missing-session",
                slow_claim,
                1,
                &validators,
                1,
                200,
                50,
            )
            .unwrap_err();

        let fast_msg = fast_err.to_string();
        let slow_msg = slow_err.to_string();

        assert!(
            fast_msg.contains("Internal error:"),
            "expected fast path internal error classification"
        );
        assert!(
            slow_msg.contains("Internal error:"),
            "expected slow path internal error classification"
        );
        assert!(
            fast_msg.contains("bridge verification failed"),
            "expected fast path bridge verification failure marker"
        );
        assert!(
            slow_msg.contains("bridge verification failed"),
            "expected slow path bridge verification failure marker"
        );
        assert!(
            fast_msg.contains("session mismatch"),
            "expected fast path mismatch marker"
        );
        assert!(
            slow_msg.contains("session mismatch"),
            "expected slow path mismatch marker"
        );
    }

    #[test]
    fn test_slow_claim_non_bridge_verified_matching_session_falls_through_to_lookup() {
        let mut coordinator = SwapCoordinator::with_default_config();
        let mut proof = MerkleSettlementProof::new(
            "missing-session".to_string(),
            [1u8; 32],
            100,
            vec![1, 2, 3, 4],
            0,
            1,
        );
        proof.outcome = MerkleSettlementOutcome::Verified;

        let slow_claim = MerkleEnabledSlowClaim {
            merkle_settlement: Some(proof),
        };

        let err = coordinator
            .record_merkle_slow_claim("missing-session", slow_claim, 1)
            .unwrap_err();

        assert!(
            matches!(err, CoordinatorError::SessionNotFound { .. }),
            "expected session-not-found after verified proof passes"
        );
    }

    #[test]
    fn test_fast_and_slow_verified_non_bridge_share_session_not_found_class() {
        let mut fast_proof = MerkleSettlementProof::new(
            "missing-session".to_string(),
            [1u8; 32],
            100,
            vec![1, 2, 3, 4],
            0,
            1,
        );
        fast_proof.outcome = MerkleSettlementOutcome::Verified;

        let mut fast_coordinator = SwapCoordinator::with_default_config();
        let fast_claim = MerkleEnabledFastClaim {
            secret_bytes: [0u8; 32],
            merkle_settlement: Some(fast_proof),
        };

        let fast_err = fast_coordinator
            .record_merkle_fast_claim("missing-session", fast_claim, 1)
            .unwrap_err();

        let mut slow_proof = MerkleSettlementProof::new(
            "missing-session".to_string(),
            [1u8; 32],
            100,
            vec![1, 2, 3, 4],
            0,
            1,
        );
        slow_proof.outcome = MerkleSettlementOutcome::Verified;

        let mut slow_coordinator = SwapCoordinator::with_default_config();
        let slow_claim = MerkleEnabledSlowClaim {
            merkle_settlement: Some(slow_proof),
        };

        let slow_err = slow_coordinator
            .record_merkle_slow_claim("missing-session", slow_claim, 1)
            .unwrap_err();

        assert!(
            matches!(fast_err, CoordinatorError::SessionNotFound { .. }),
            "expected fast path to fall through to session-not-found after verified proof"
        );
        assert!(
            matches!(slow_err, CoordinatorError::SessionNotFound { .. }),
            "expected slow path to fall through to session-not-found after verified proof"
        );
    }

    #[test]
    fn test_slow_claim_non_bridge_without_proof_falls_through_to_session_lookup() {
        let mut coordinator = SwapCoordinator::with_default_config();
        let slow_claim = MerkleEnabledSlowClaim {
            merkle_settlement: None,
        };

        let err = coordinator
            .record_merkle_slow_claim("missing-session", slow_claim, 1)
            .unwrap_err();

        assert!(
            matches!(err, CoordinatorError::SessionNotFound { .. }),
            "expected session-not-found when proof is not provided"
        );
    }

    #[test]
    fn test_slow_claim_bridge_without_proof_falls_through_to_session_lookup() {
        let mut coordinator = SwapCoordinator::with_default_config();
        let slow_claim = MerkleEnabledSlowClaim {
            merkle_settlement: None,
        };

        let validators = BTreeMap::new();
        let err = coordinator
            .record_merkle_slow_claim_with_bridge_verification(
                "missing-session",
                slow_claim,
                1,
                &validators,
                1,
            )
            .unwrap_err();

        assert!(
            matches!(err, CoordinatorError::SessionNotFound { .. }),
            "expected session-not-found when bridge proof is not provided"
        );
    }

    #[test]
    fn test_fast_and_slow_bridge_without_proof_share_session_not_found_class() {
        let validators = BTreeMap::new();

        let mut fast_coordinator = SwapCoordinator::with_default_config();
        let fast_claim = MerkleEnabledFastClaim {
            secret_bytes: [0u8; 32],
            merkle_settlement: None,
        };

        let fast_err = fast_coordinator
            .record_merkle_fast_claim_with_bridge_verification(
                "missing-session",
                fast_claim,
                1,
                &validators,
                1,
            )
            .unwrap_err();

        let mut slow_coordinator = SwapCoordinator::with_default_config();
        let slow_claim = MerkleEnabledSlowClaim {
            merkle_settlement: None,
        };

        let slow_err = slow_coordinator
            .record_merkle_slow_claim_with_bridge_verification(
                "missing-session",
                slow_claim,
                1,
                &validators,
                1,
            )
            .unwrap_err();

        assert!(
            matches!(fast_err, CoordinatorError::SessionNotFound { .. }),
            "expected fast bridge no-proof path to return SessionNotFound"
        );
        assert!(
            matches!(slow_err, CoordinatorError::SessionNotFound { .. }),
            "expected slow bridge no-proof path to return SessionNotFound"
        );
    }

    #[test]
    fn test_slow_claim_bridge_rejects_mismatched_proof_session_before_lookup() {
        let mut coordinator = SwapCoordinator::with_default_config();
        let slow_claim = MerkleEnabledSlowClaim {
            merkle_settlement: Some(MerkleSettlementProof::new(
                "other-session".to_string(),
                [0u8; 32],
                100,
                vec![1, 2, 3, 4],
                0,
                1,
            )),
        };

        let validators = BTreeMap::new();
        let err = coordinator
            .record_merkle_slow_claim_with_bridge_verification(
                "missing-session",
                slow_claim,
                1,
                &validators,
                1,
            )
            .unwrap_err();

        assert!(
            err.to_string().contains("session mismatch"),
            "expected session-binding mismatch failure before session-not-found"
        );
    }

    #[test]
    fn test_fast_claim_bridge_freshness_verification_rejects_stale_before_session_lookup() {
        let mut coordinator = SwapCoordinator::with_default_config();
        let fast_claim = MerkleEnabledFastClaim {
            secret_bytes: [0u8; 32],
            merkle_settlement: Some(MerkleSettlementProof::new(
                "missing-session".to_string(),
                [42u8; 32],
                100,
                vec![42; 72],
                0,
                1,
            )),
        };

        let mut validators = BTreeMap::new();
        validators.insert([1u8; 32], vec![7u8; 32]);

        let err = coordinator
            .record_merkle_fast_claim_with_bridge_freshness_verification(
                "missing-session",
                fast_claim,
                1,
                &validators,
                1,
                200,
                50,
            )
            .unwrap_err();

        assert!(
            err.to_string().contains("bridge verification failed"),
            "expected stale-proof bridge verification failure before session-not-found"
        );
    }

    #[test]
    fn test_fast_claim_bridge_freshness_without_proof_falls_through_to_session_lookup() {
        let mut coordinator = SwapCoordinator::with_default_config();
        let fast_claim = MerkleEnabledFastClaim {
            secret_bytes: [0u8; 32],
            merkle_settlement: None,
        };

        let validators = BTreeMap::new();
        let err = coordinator
            .record_merkle_fast_claim_with_bridge_freshness_verification(
                "missing-session",
                fast_claim,
                1,
                &validators,
                1,
                200,
                50,
            )
            .unwrap_err();

        assert!(
            matches!(err, CoordinatorError::SessionNotFound { .. }),
            "expected session-not-found when freshness proof is not provided"
        );
    }

    #[test]
    fn test_fast_claim_bridge_freshness_rejects_mismatched_proof_session_before_lookup() {
        let mut coordinator = SwapCoordinator::with_default_config();
        let fast_claim = MerkleEnabledFastClaim {
            secret_bytes: [0u8; 32],
            merkle_settlement: Some(MerkleSettlementProof::new(
                "other-session".to_string(),
                [42u8; 32],
                100,
                vec![42; 72],
                0,
                1,
            )),
        };

        let validators = BTreeMap::new();
        let err = coordinator
            .record_merkle_fast_claim_with_bridge_freshness_verification(
                "missing-session",
                fast_claim,
                1,
                &validators,
                1,
                200,
                50,
            )
            .unwrap_err();

        assert!(
            err.to_string().contains("session mismatch"),
            "expected session-binding mismatch failure before session-not-found"
        );
    }

    #[test]
    fn test_fast_freshness_mismatch_takes_precedence_over_stale_validation() {
        let mut coordinator = SwapCoordinator::with_default_config();
        let fast_claim = MerkleEnabledFastClaim {
            secret_bytes: [0u8; 32],
            merkle_settlement: Some(MerkleSettlementProof::new(
                "other-session".to_string(),
                [42u8; 32],
                100,
                vec![42; 72],
                0,
                1,
            )),
        };

        // Even with plausible validator input and stale freshness parameters,
        // session binding must fail first.
        let mut validators = BTreeMap::new();
        validators.insert([1u8; 32], vec![7u8; 32]);

        let err = coordinator
            .record_merkle_fast_claim_with_bridge_freshness_verification(
                "missing-session",
                fast_claim,
                1,
                &validators,
                1,
                200,
                50,
            )
            .unwrap_err();

        assert!(
            err.to_string().contains("session mismatch"),
            "expected session mismatch to be enforced before stale-proof validation"
        );
    }

    #[test]
    fn test_slow_claim_bridge_freshness_verification_rejects_stale_before_session_lookup() {
        let mut coordinator = SwapCoordinator::with_default_config();
        let slow_claim = MerkleEnabledSlowClaim {
            merkle_settlement: Some(MerkleSettlementProof::new(
                "missing-session".to_string(),
                [42u8; 32],
                100,
                vec![42; 72],
                0,
                1,
            )),
        };

        let mut validators = BTreeMap::new();
        validators.insert([1u8; 32], vec![7u8; 32]);

        let err = coordinator
            .record_merkle_slow_claim_with_bridge_freshness_verification(
                "missing-session",
                slow_claim,
                1,
                &validators,
                1,
                200,
                50,
            )
            .unwrap_err();

        assert!(
            err.to_string().contains("bridge verification failed"),
            "expected stale-proof bridge verification failure before session-not-found"
        );
    }

    #[test]
    fn test_slow_claim_bridge_freshness_without_proof_falls_through_to_session_lookup() {
        let mut coordinator = SwapCoordinator::with_default_config();
        let slow_claim = MerkleEnabledSlowClaim {
            merkle_settlement: None,
        };

        let validators = BTreeMap::new();
        let err = coordinator
            .record_merkle_slow_claim_with_bridge_freshness_verification(
                "missing-session",
                slow_claim,
                1,
                &validators,
                1,
                200,
                50,
            )
            .unwrap_err();

        assert!(
            matches!(err, CoordinatorError::SessionNotFound { .. }),
            "expected session-not-found when freshness proof is not provided"
        );
    }

    #[test]
    fn test_fast_and_slow_freshness_without_proof_share_session_not_found_class() {
        let mut fast_coordinator = SwapCoordinator::with_default_config();
        let fast_claim = MerkleEnabledFastClaim {
            secret_bytes: [0u8; 32],
            merkle_settlement: None,
        };

        let validators = BTreeMap::new();
        let fast_err = fast_coordinator
            .record_merkle_fast_claim_with_bridge_freshness_verification(
                "missing-session",
                fast_claim,
                1,
                &validators,
                1,
                200,
                50,
            )
            .unwrap_err();

        let mut slow_coordinator = SwapCoordinator::with_default_config();
        let slow_claim = MerkleEnabledSlowClaim {
            merkle_settlement: None,
        };

        let slow_err = slow_coordinator
            .record_merkle_slow_claim_with_bridge_freshness_verification(
                "missing-session",
                slow_claim,
                1,
                &validators,
                1,
                200,
                50,
            )
            .unwrap_err();

        assert!(
            matches!(fast_err, CoordinatorError::SessionNotFound { .. }),
            "expected fast freshness no-proof path to return SessionNotFound"
        );
        assert!(
            matches!(slow_err, CoordinatorError::SessionNotFound { .. }),
            "expected slow freshness no-proof path to return SessionNotFound"
        );
    }

    #[test]
    fn test_slow_claim_bridge_freshness_rejects_mismatched_proof_session_before_lookup() {
        let mut coordinator = SwapCoordinator::with_default_config();
        let slow_claim = MerkleEnabledSlowClaim {
            merkle_settlement: Some(MerkleSettlementProof::new(
                "other-session".to_string(),
                [42u8; 32],
                100,
                vec![42; 72],
                0,
                1,
            )),
        };

        let validators = BTreeMap::new();
        let err = coordinator
            .record_merkle_slow_claim_with_bridge_freshness_verification(
                "missing-session",
                slow_claim,
                1,
                &validators,
                1,
                200,
                50,
            )
            .unwrap_err();

        assert!(
            err.to_string().contains("session mismatch"),
            "expected session-binding mismatch failure before session-not-found"
        );
    }

    #[test]
    fn test_slow_freshness_mismatch_takes_precedence_over_stale_validation() {
        let mut coordinator = SwapCoordinator::with_default_config();
        let slow_claim = MerkleEnabledSlowClaim {
            merkle_settlement: Some(MerkleSettlementProof::new(
                "other-session".to_string(),
                [42u8; 32],
                100,
                vec![42; 72],
                0,
                1,
            )),
        };

        // Even with plausible validator input and stale freshness parameters,
        // session binding must fail first.
        let mut validators = BTreeMap::new();
        validators.insert([1u8; 32], vec![7u8; 32]);

        let err = coordinator
            .record_merkle_slow_claim_with_bridge_freshness_verification(
                "missing-session",
                slow_claim,
                1,
                &validators,
                1,
                200,
                50,
            )
            .unwrap_err();

        assert!(
            err.to_string().contains("session mismatch"),
            "expected session mismatch to be enforced before stale-proof validation"
        );
    }

    #[test]
    fn test_fast_and_slow_stale_freshness_share_error_class_markers() {
        let mut validators = BTreeMap::new();
        validators.insert([1u8; 32], vec![7u8; 32]);

        let mut fast_coordinator = SwapCoordinator::with_default_config();
        let fast_claim = MerkleEnabledFastClaim {
            secret_bytes: [0u8; 32],
            merkle_settlement: Some(MerkleSettlementProof::new(
                "missing-session".to_string(),
                [42u8; 32],
                100,
                vec![42; 72],
                0,
                1,
            )),
        };

        let fast_err = fast_coordinator
            .record_merkle_fast_claim_with_bridge_freshness_verification(
                "missing-session",
                fast_claim,
                1,
                &validators,
                1,
                200,
                50,
            )
            .unwrap_err();

        let mut slow_coordinator = SwapCoordinator::with_default_config();
        let slow_claim = MerkleEnabledSlowClaim {
            merkle_settlement: Some(MerkleSettlementProof::new(
                "missing-session".to_string(),
                [42u8; 32],
                100,
                vec![42; 72],
                0,
                1,
            )),
        };

        let slow_err = slow_coordinator
            .record_merkle_slow_claim_with_bridge_freshness_verification(
                "missing-session",
                slow_claim,
                1,
                &validators,
                1,
                200,
                50,
            )
            .unwrap_err();

        let fast_msg = fast_err.to_string();
        let slow_msg = slow_err.to_string();

        assert!(
            fast_msg.contains("Internal error:"),
            "expected fast path internal error classification"
        );
        assert!(
            slow_msg.contains("Internal error:"),
            "expected slow path internal error classification"
        );
        assert!(
            fast_msg.contains("bridge verification failed"),
            "expected fast path bridge verification failure marker"
        );
        assert!(
            slow_msg.contains("bridge verification failed"),
            "expected slow path bridge verification failure marker"
        );
    }
}
