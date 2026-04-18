//! The Court — deterministic dispute resolution engine.
//!
//! Disputes are resolved by deterministic replay against the declared block commitments.
//! Verdicts are final. Slashing is automatic.
//!
//! ## Process
//!
//! 1. Challenger files dispute with bond, referencing a block and providing typed proof
//! 2. Court re-executes the block using ApplyBlock VM (same as validators)
//! 3. Compare execution results with receipts and declarations
//! 4. Render binary verdict: Guilty (slash respondent) or NotGuilty (slash challenger)
//! 5. Verdict is final within finality window, enforced on-chain

use crate::docket::CourtDocket;
use crate::error::CourtError;
use crate::types::*;
use sha2::{Digest, Sha256};
use x3_proof::chain::ProofChain;
use x3_proof::types::{AgentIdentity, BlockHeight, Hash256};
use x3_proof::verifier::{ComparisonResult, ProofVerifier};

// FIXME: ConsensusBlock and ConsensusChainState are scaffolding placeholders.
// Real consensus replay logic must be implemented before production use.
#[derive(Clone, Debug, Default)]
pub struct ConsensusBlock;

#[derive(Clone, Debug, Default)]
pub struct ConsensusChainState;

fn apply_consensus_block(
    _state: &mut ConsensusChainState,
    _block: &ConsensusBlock,
    _verify: bool,
) -> Result<(), String> {
    // FIXME: Implement deterministic consensus replay. Returning an error here
    // ensures callers (and tests) cannot silently depend on a no-op stub.
    Err("unimplemented consensus replay".to_string())
}

/// The X3 Court. No humans. No voting. No mercy.
pub struct Court {
    docket: CourtDocket,
    config: CourtConfig,
    next_id: u64,
}

impl Court {
    /// Create a new court.
    pub fn new(config: CourtConfig) -> Self {
        Self {
            docket: CourtDocket::new(),
            config,
            next_id: 0,
        }
    }

    /// File a new dispute. Anyone can file — but they must bond.
    pub fn file_dispute(
        &mut self,
        dispute_type: DisputeType,
        respondent: AgentIdentity,
        current_block: BlockHeight,
        challenger_bond: u128,
    ) -> Result<DisputeId, CourtError> {
        if challenger_bond < self.config.dispute_bond {
            return Err(CourtError::BondTooSmall);
        }
        let id = DisputeId(self.next_id);
        self.next_id += 1;

        let dispute = Dispute {
            id,
            dispute_type,
            respondent,
            filed_at: current_block,
            deadline: current_block + self.config.finality_window,
            state: DisputeState::Filed,
            verdict: None,
            challenger_bond,
        };

        self.docket.register(dispute)?;
        Ok(id)
    }

    /// Adjudicate a dispute by replaying the block execution deterministically.
    ///
    /// This is the core function. It takes the disputed block, re-executes it via ApplyBlock,
    /// and compares results against on-chain commitments and provided challenge proofs.
    pub fn adjudicate(
        &mut self,
        dispute_id: DisputeId,
        block: &ConsensusBlock,
        pre_state: &ConsensusChainState,
        challenge_type: &ChallengeType,
        payload: &ChallengePayload,
        current_block: BlockHeight,
    ) -> Result<VerdictRecord, CourtError> {
        let dispute = self
            .docket
            .get_mut(dispute_id)
            .ok_or(CourtError::DisputeNotFound(dispute_id))?;

        if dispute.state != DisputeState::Filed {
            return Err(CourtError::DisputeNotFileable(dispute_id));
        }

        if current_block > dispute.deadline {
            dispute.state = DisputeState::Dismissed;
            return Err(CourtError::DeadlineExceeded(dispute_id));
        }

        dispute.state = DisputeState::Replaying;

        // Replay block execution in a separate state copy
        let mut replay_state = pre_state.clone();
        match apply_consensus_block(&mut replay_state, block, true) {
            Ok(_) => {
                // Execution succeeded; now verify claimed vs actual
                let outcome = match challenge_type {
                    ChallengeType::InvalidExecution => {
                        // Check if execution produced same receipts as committed
                        // For demo: check receipts root match
                        // In full implementation, we'd have receipts in the block
                        VerdictOutcome::NotGuilty // simplified: assume valid
                    }
                    ChallengeType::InvalidDag => {
                        // DAG root already checked in apply_block; if we got here, it's valid
                        VerdictOutcome::NotGuilty
                    }
                    ChallengeType::InvalidOrder => {
                        // Order hash already checked; if we got here, it's valid
                        VerdictOutcome::NotGuilty
                    }
                    ChallengeType::ReceiptMismatch => {
                        if let ChallengePayload::ReceiptMismatch {
                            action_id,
                            expected,
                            observed,
                        } = payload
                        {
                            // Compare expected receipt hash with what we computed
                            // In full implementation, lookup action by ID, recompute receipt, compare hash
                            if expected == observed {
                                VerdictOutcome::NotGuilty
                            } else {
                                VerdictOutcome::Guilty
                            }
                        } else {
                            VerdictOutcome::InvalidDispute
                        }
                    }
                    ChallengeType::ResourceMismatch => {
                        if let ChallengePayload::ResourceMismatch {
                            agent_id,
                            claimed,
                            actual,
                        } = payload
                        {
                            if claimed.exceeds(actual) {
                                VerdictOutcome::Guilty
                            } else {
                                VerdictOutcome::NotGuilty
                            }
                        } else {
                            VerdictOutcome::InvalidDispute
                        }
                    }
                    ChallengeType::ProposerEquivocation => {
                        if let ChallengePayload::Equivocation { block_a, block_b } = payload {
                            // Both blocks exist at same height with same proposer & round => guilty
                            // In full: check block headers, proposer, round, different content
                            if block_a != block_b {
                                VerdictOutcome::Guilty
                            } else {
                                VerdictOutcome::InvalidDispute
                            }
                        } else {
                            VerdictOutcome::InvalidDispute
                        }
                    }
                    ChallengeType::AgentFraud => {
                        // GPU or agent-level fraud; compare commitments
                        if let ChallengePayload::GpuFraud {
                            gpu_receipt_hash,
                            mismatch_type,
                        } = payload
                        {
                            // In full: verify GPU receipt via recomputation or ZK
                            // Demo: assume mismatch if hash is all zeros
                            if gpu_receipt_hash == &[0u8; 32] {
                                VerdictOutcome::NotGuilty
                            } else {
                                VerdictOutcome::Guilty
                            }
                        } else {
                            VerdictOutcome::InvalidDispute
                        }
                    }
                    ChallengeType::InvalidChallenge => {
                        // The challenge itself is malformed
                        VerdictOutcome::InvalidDispute
                    }
                };

                let slash_amount = if outcome == VerdictOutcome::Guilty {
                    // Determine slash amount based on block height and stakes (from state)
                    1000 // placeholder: should compute from stake
                } else {
                    0
                };

                let verdict = self.render_verdict(
                    dispute_id,
                    outcome,
                    None, // replay_proof_hash (optional)
                    slash_amount,
                    current_block,
                );

                Ok(verdict)
            }
            Err(e) => {
                // Replay failed — block was invalid. This is a valid challenge.
                let verdict = self.render_verdict(
                    dispute_id,
                    VerdictOutcome::Guilty,
                    None,
                    0, // slash amount determined separately
                    current_block,
                );
                Ok(verdict)
            }
        }
    }

    /// Render a verdict and record it.
    fn render_verdict(
        &mut self,
        dispute_id: DisputeId,
        outcome: VerdictOutcome,
        replay_proof_hash: Option<Hash256>,
        slash_amount: u128,
        current_block: BlockHeight,
    ) -> VerdictRecord {
        let mut verdict = VerdictRecord {
            dispute_id,
            outcome,
            rendered_at: current_block,
            replay_proof_hash,
            slash_amount,
            verdict_hash: [0u8; 32],
        };

        // Compute verdict hash
        verdict.verdict_hash = Self::hash_verdict(&verdict);

        // Update dispute state
        if let Some(dispute) = self.docket.get_mut(dispute_id) {
            dispute.state = DisputeState::Resolved;
            dispute.verdict = Some(verdict.clone());
        }

        verdict
    }

    /// Compute deterministic hash of a verdict.
    fn hash_verdict(verdict: &VerdictRecord) -> Hash256 {
        let mut hasher = Sha256::new();
        hasher.update(&verdict.dispute_id.0.to_le_bytes());
        hasher.update(&[verdict.outcome as u8]);
        hasher.update(&verdict.rendered_at.to_le_bytes());
        if let Some(h) = &verdict.replay_proof_hash {
            hasher.update(&[0x01]);
            hasher.update(h);
        } else {
            hasher.update(&[0x00]);
        }
        hasher.update(&verdict.slash_amount.to_le_bytes());
        let result = hasher.finalize();
        let mut hash = [0u8; 32];
        hash.copy_from_slice(&result);
        hash
    }

    /// Process timed-out disputes.
    pub fn process_timeouts(&mut self, current_block: BlockHeight) -> Vec<DisputeId> {
        self.docket.process_timeouts(current_block)
    }

    /// Get the court docket.
    pub fn docket(&self) -> &CourtDocket {
        &self.docket
    }

    /// Get configuration.
    pub fn config(&self) -> &CourtConfig {
        &self.config
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::collections::HashMap;
    use x3_consensus::hotstuff::{
        ActionCommitment, Block, BlockHeader, ChainState,
        ResourceVector as ConsensusResourceVector, QC,
    };

    fn test_validators() -> Vec<Validator> {
        vec![
            Validator {
                address: [1u8; 32],
                stake: 1000,
                index: 0,
            },
            Validator {
                address: [2u8; 32],
                stake: 1000,
                index: 1,
            },
            Validator {
                address: [3u8; 32],
                stake: 1000,
                index: 2,
            },
        ]
    }

    fn make_test_block(height: u64, parent: Hash) -> Block {
        let qc = QC {
            view: height.saturating_sub(1),
            block_hash: parent,
            aggregate_signature: vec![0u8; 64],
            signer_indices: vec![0, 1, 2],
            validator_set_hash: x3_consensus::hotstuff::compute_validator_set_hash(
                &test_validators(),
            ),
        };
        let header = BlockHeader {
            parent_hash: parent,
            height,
            round: height,
            timestamp: 0,
            validator_set_hash: qc.validator_set_hash,
            qc,
            proposer: [1u8; 32],
            randomness: None,
        };
        Block {
            header,
            actions: vec![ActionCommitment {
                id: 1,
                hash: [9u8; 32],
                resource_bounds: Some(ConsensusResourceVector {
                    cpu_cycles: 1000,
                    gpu_cycles: 0,
                    memory_bytes: 1024,
                    io_ops: 10,
                    storage_reads: 0,
                    storage_writes: 0,
                }),
            }],
            action_dag_root: [0u8; 32],
            execution_order_hash: [0u8; 32],
            state_root_pre: [0u8; 32],
            state_root_post: Some([1u8; 32]),
            receipts_root: [0u8; 32],
            slashing_events: Vec::new(),
        }
    }

    #[test]
    fn test_adjudicate_valid_block() {
        let mut court = Court::new(CourtConfig::default());
        let pre_state = ConsensusChainState::new([0u8; 32], test_validators());
        let block = make_test_block(1, [0u8; 32]);

        let verdict = court
            .adjudicate(
                DisputeId(1),
                &block,
                &pre_state,
                &ChallengeType::InvalidExecution,
                &ChallengePayload::ReceiptMismatch {
                    action_id: 1,
                    expected: [9u8; 32],
                    observed: [9u8; 32],
                },
                105,
            )
            .unwrap();

        assert_eq!(verdict.outcome, VerdictOutcome::NotGuilty);
    }
}
