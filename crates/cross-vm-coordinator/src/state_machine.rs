//! Core state machine for the Cross-VM Atomic Swap Coordinator.
//!
//! Implements the 4-phase swap protocol:
//!   1. Setup (secret/hash, timelock computation)
//!   2. Lock HTLCs (both chains)
//!   3. Execute flash legs (borrow → swap → repay, per chain)
//!   4. Settle (reveal secret → claim both sides)
//!
//! Each phase transition is validated and logged. On any failure,
//! the machine transitions to Aborting → Refunded.

use crate::config::CoordinatorConfig;
use crate::types::*;
use std::collections::HashMap;
use tracing::{error, info, warn};

/// The Cross-VM Swap Coordinator.
///
/// Manages the lifecycle of atomic swap sessions across EVM, SVM, and X3VM.
pub struct SwapCoordinator {
    config: CoordinatorConfig,
    sessions: HashMap<String, SwapSession>,
}

impl SwapCoordinator {
    pub fn new(config: CoordinatorConfig) -> Self {
        Self {
            config,
            sessions: HashMap::new(),
        }
    }

    pub fn with_default_config() -> Self {
        Self::new(CoordinatorConfig::default())
    }

    /// Get a session by ID.
    pub fn get_session(&self, session_id: &str) -> Option<&SwapSession> {
        self.sessions.get(session_id)
    }

    /// Get a mutable session by ID.
    pub fn get_session_mut(&mut self, session_id: &str) -> Option<&mut SwapSession> {
        self.sessions.get_mut(session_id)
    }

    /// Total active sessions.
    pub fn active_sessions(&self) -> usize {
        self.sessions
            .values()
            .filter(|s| {
                !matches!(
                    s.phase,
                    SwapPhase::Complete | SwapPhase::Refunded | SwapPhase::Failed
                )
            })
            .count()
    }

    // ── Phase 1: Setup ────────────────────────────────────────────────────

    /// Initialize a new atomic swap session.
    ///
    /// Generates the secret/hash pair, computes timelocks, and returns
    /// the session ID. The secret is returned separately so the caller
    /// can hold it securely until Phase 4.
    pub fn setup_swap(
        &mut self,
        fast_vm: VmTarget,
        slow_vm: VmTarget,
        flash_legs: Vec<FlashLeg>,
        now_unix: u64,
    ) -> Result<(String, HtlcSecret, HtlcHash), CoordinatorError> {
        // Generate cryptographic secret and hash
        let secret = HtlcSecret::generate();
        let hash = secret.hash();

        // Compute timelocks
        let (t_fast, t_slow) = self.config.compute_timelocks(now_unix, &fast_vm);

        // Validate flashloan providers
        for leg in &flash_legs {
            if !leg.provider.supports_vm(&leg.vm) {
                return Err(CoordinatorError::ProviderUnavailable {
                    provider: leg.provider.clone(),
                    vm: leg.vm.to_string(),
                });
            }
        }

        // Generate session ID
        let session_id = format!("swap-{}", hex::encode(&hash.0[..8]));

        let session = SwapSession {
            session_id: session_id.clone(),
            hash_lock: hash,
            htlc_fast: None,
            htlc_slow: None,
            flash_legs,
            leg_outcomes: Vec::new(),
            phase: SwapPhase::Setup,
            timelock_fast: t_fast,
            timelock_slow: t_slow,
            created_at: now_unix,
            updated_at: now_unix,
        };

        self.sessions.insert(session_id.clone(), session);

        info!(
            session = %session_id,
            hash = %hash,
            fast_vm = %fast_vm,
            slow_vm = %slow_vm,
            t_fast = t_fast,
            t_slow = t_slow,
            "Swap session created"
        );

        Ok((session_id, secret, hash))
    }

    // ── Phase 2: Lock HTLCs ───────────────────────────────────────────────

    /// Record that an HTLC has been created on the fast chain.
    pub fn record_htlc_fast(
        &mut self,
        session_id: &str,
        record: HtlcRecord,
        now_unix: u64,
    ) -> Result<(), CoordinatorError> {
        // Read phase first, then validate, then mutate.
        let current_phase = self
            .sessions
            .get(session_id)
            .ok_or_else(|| CoordinatorError::SessionNotFound {
                session_id: session_id.to_string(),
            })?
            .phase;

        Self::validate_phase_transition(current_phase, SwapPhase::LockingHtlcs)?;

        let session = self.sessions.get_mut(session_id).unwrap();

        info!(
            session = %session_id,
            htlc_id = %record.id.to_hex(),
            vm = ?record.params.vm,
            "Fast chain HTLC recorded"
        );

        session.htlc_fast = Some(record);
        session.phase = SwapPhase::LockingHtlcs;
        session.updated_at = now_unix;
        Ok(())
    }

    /// Record that an HTLC has been created on the slow chain.
    pub fn record_htlc_slow(
        &mut self,
        session_id: &str,
        record: HtlcRecord,
        now_unix: u64,
    ) -> Result<(), CoordinatorError> {
        let session =
            self.sessions
                .get_mut(session_id)
                .ok_or_else(|| CoordinatorError::SessionNotFound {
                    session_id: session_id.to_string(),
                })?;

        info!(
            session = %session_id,
            htlc_id = %record.id.to_hex(),
            vm = ?record.params.vm,
            "Slow chain HTLC recorded"
        );

        session.htlc_slow = Some(record);
        session.updated_at = now_unix;

        // If both HTLCs are now recorded, advance phase
        if session.htlc_fast.is_some() && session.htlc_slow.is_some() {
            session.phase = SwapPhase::HtlcsLocked;
            info!(session = %session_id, "Both HTLCs locked — ready for flash legs");
        }

        Ok(())
    }

    /// Update confirmation count for an HTLC and check if we can proceed.
    pub fn update_confirmations(
        &mut self,
        session_id: &str,
        is_fast: bool,
        confirmations: u32,
        now_unix: u64,
    ) -> Result<bool, CoordinatorError> {
        let session =
            self.sessions
                .get_mut(session_id)
                .ok_or_else(|| CoordinatorError::SessionNotFound {
                    session_id: session_id.to_string(),
                })?;

        let htlc = if is_fast {
            session.htlc_fast.as_mut()
        } else {
            session.htlc_slow.as_mut()
        };

        let htlc = htlc.ok_or_else(|| {
            CoordinatorError::Internal(format!(
                "HTLC not found for {} chain",
                if is_fast { "fast" } else { "slow" }
            ))
        })?;

        htlc.confirmations = confirmations;
        session.updated_at = now_unix;

        // Check if both HTLCs have enough confirmations
        let fast_ok = session
            .htlc_fast
            .as_ref()
            .map(|h| h.confirmations >= h.confirmations_required)
            .unwrap_or(false);
        let slow_ok = session
            .htlc_slow
            .as_ref()
            .map(|h| h.confirmations >= h.confirmations_required)
            .unwrap_or(false);

        Ok(fast_ok && slow_ok)
    }

    // ── Phase 3: Execute Flash Legs ───────────────────────────────────────

    /// Begin executing flashloan legs.
    pub fn begin_flash_execution(
        &mut self,
        session_id: &str,
        now_unix: u64,
    ) -> Result<(), CoordinatorError> {
        let current_phase = self
            .sessions
            .get(session_id)
            .ok_or_else(|| CoordinatorError::SessionNotFound {
                session_id: session_id.to_string(),
            })?
            .phase;

        Self::validate_phase_transition(current_phase, SwapPhase::ExecutingFlashLegs)?;

        let session = self.sessions.get_mut(session_id).unwrap();

        // Safety check: ensure we're not too close to timelock
        if self.config.is_near_expiry(session.timelock_fast, now_unix) {
            warn!(
                session = %session_id,
                timelock = session.timelock_fast,
                now = now_unix,
                "Near timelock expiry — aborting flash execution"
            );
            session.phase = SwapPhase::Aborting;
            return Err(CoordinatorError::TimelockExpired {
                htlc_id: session_id.to_string(),
            });
        }

        session.phase = SwapPhase::ExecutingFlashLegs;
        session.updated_at = now_unix;

        info!(
            session = %session_id,
            legs = session.flash_legs.len(),
            "Beginning flash leg execution"
        );

        Ok(())
    }

    /// Record the outcome of a flashloan leg.
    pub fn record_leg_outcome(
        &mut self,
        session_id: &str,
        outcome: FlashLegOutcome,
        now_unix: u64,
    ) -> Result<(), CoordinatorError> {
        let session =
            self.sessions
                .get_mut(session_id)
                .ok_or_else(|| CoordinatorError::SessionNotFound {
                    session_id: session_id.to_string(),
                })?;

        let leg_index = session.leg_outcomes.len();

        match outcome {
            FlashLegOutcome::Success {
                tx_hash: _,
                gas_used,
                output_amount,
                premium_paid,
            } => {
                info!(
                    session = %session_id,
                    leg = leg_index,
                    gas_used,
                    output_amount,
                    premium_paid,
                    "Flash leg succeeded"
                );
                session.leg_outcomes.push(outcome);
            }
            FlashLegOutcome::Reverted { ref reason } => {
                let reason_clone = reason.clone();
                error!(
                    session = %session_id,
                    leg = leg_index,
                    reason = %reason_clone,
                    "Flash leg REVERTED — aborting swap"
                );
                session.phase = SwapPhase::Aborting;
                session.updated_at = now_unix;
                session.leg_outcomes.push(outcome);
                return Err(CoordinatorError::FlashLegReverted {
                    vm: format!("leg-{}", leg_index),
                    reason: reason_clone,
                });
            }
        }

        session.updated_at = now_unix;

        // Check if all legs are complete
        if session.leg_outcomes.len() == session.flash_legs.len() {
            let all_success = session
                .leg_outcomes
                .iter()
                .all(|o| matches!(o, FlashLegOutcome::Success { .. }));

            if all_success {
                session.phase = SwapPhase::LegsComplete;
                info!(session = %session_id, "All flash legs complete — ready for settlement");
            } else {
                session.phase = SwapPhase::Aborting;
                warn!(session = %session_id, "Not all legs succeeded — aborting");
            }
        }

        Ok(())
    }

    // ── Phase 4: Settlement ───────────────────────────────────────────────

    /// Begin settlement: reveal secret on the fast chain.
    pub fn begin_settlement(
        &mut self,
        session_id: &str,
        now_unix: u64,
    ) -> Result<HtlcHash, CoordinatorError> {
        let current_phase = self
            .sessions
            .get(session_id)
            .ok_or_else(|| CoordinatorError::SessionNotFound {
                session_id: session_id.to_string(),
            })?
            .phase;

        Self::validate_phase_transition(current_phase, SwapPhase::ClaimingFast)?;

        let session = self.sessions.get_mut(session_id).unwrap();

        // Safety: don't reveal if near fast chain timelock
        if self.config.is_near_expiry(session.timelock_fast, now_unix) {
            session.phase = SwapPhase::Aborting;
            return Err(CoordinatorError::TimelockExpired {
                htlc_id: session_id.to_string(),
            });
        }

        session.phase = SwapPhase::ClaimingFast;
        session.updated_at = now_unix;

        info!(session = %session_id, "Settlement: claiming on fast chain");

        Ok(session.hash_lock)
    }

    /// Record that the fast chain claim succeeded (secret revealed on-chain).
    pub fn record_fast_claim(
        &mut self,
        session_id: &str,
        now_unix: u64,
    ) -> Result<(), CoordinatorError> {
        let session =
            self.sessions
                .get_mut(session_id)
                .ok_or_else(|| CoordinatorError::SessionNotFound {
                    session_id: session_id.to_string(),
                })?;

        if let Some(ref mut htlc) = session.htlc_fast {
            htlc.status = HtlcStatus::Claimed;
        }

        session.phase = SwapPhase::ClaimingSlow;
        session.updated_at = now_unix;

        info!(session = %session_id, "Fast chain claimed — now claiming slow chain");
        Ok(())
    }

    /// Record that the slow chain claim succeeded. Swap is complete!
    pub fn record_slow_claim(
        &mut self,
        session_id: &str,
        now_unix: u64,
    ) -> Result<(), CoordinatorError> {
        let session =
            self.sessions
                .get_mut(session_id)
                .ok_or_else(|| CoordinatorError::SessionNotFound {
                    session_id: session_id.to_string(),
                })?;

        if let Some(ref mut htlc) = session.htlc_slow {
            htlc.status = HtlcStatus::Claimed;
        }

        session.phase = SwapPhase::Complete;
        session.updated_at = now_unix;

        info!(session = %session_id, "🎉 Atomic swap COMPLETE — both sides claimed");
        Ok(())
    }

    // ── Abort & Refund ────────────────────────────────────────────────────

    /// Abort the swap. Triggers refund after timelocks expire.
    pub fn abort(
        &mut self,
        session_id: &str,
        reason: &str,
        now_unix: u64,
    ) -> Result<(), CoordinatorError> {
        let session =
            self.sessions
                .get_mut(session_id)
                .ok_or_else(|| CoordinatorError::SessionNotFound {
                    session_id: session_id.to_string(),
                })?;

        warn!(session = %session_id, reason, "Aborting swap — will refund after timelocks");

        session.phase = SwapPhase::Aborting;
        session.updated_at = now_unix;
        Ok(())
    }

    /// Record that both HTLCs have been refunded.
    pub fn record_refunds(
        &mut self,
        session_id: &str,
        now_unix: u64,
    ) -> Result<(), CoordinatorError> {
        let session =
            self.sessions
                .get_mut(session_id)
                .ok_or_else(|| CoordinatorError::SessionNotFound {
                    session_id: session_id.to_string(),
                })?;

        if let Some(ref mut htlc) = session.htlc_fast {
            htlc.status = HtlcStatus::Refunded;
        }
        if let Some(ref mut htlc) = session.htlc_slow {
            htlc.status = HtlcStatus::Refunded;
        }

        session.phase = SwapPhase::Refunded;
        session.updated_at = now_unix;

        info!(session = %session_id, "Both HTLCs refunded — swap cancelled cleanly");
        Ok(())
    }

    // ── Internal Helpers ──────────────────────────────────────────────────

    fn validate_phase_transition(from: SwapPhase, to: SwapPhase) -> Result<(), CoordinatorError> {
        let valid = matches!(
            (from, to),
            (SwapPhase::Setup, SwapPhase::LockingHtlcs)
                | (SwapPhase::LockingHtlcs, SwapPhase::HtlcsLocked)
                | (SwapPhase::HtlcsLocked, SwapPhase::ExecutingFlashLegs)
                | (SwapPhase::ExecutingFlashLegs, SwapPhase::LegsComplete)
                | (SwapPhase::LegsComplete, SwapPhase::ClaimingFast)
                | (SwapPhase::ClaimingFast, SwapPhase::ClaimingSlow)
                | (SwapPhase::ClaimingSlow, SwapPhase::Complete)
                // Abort from any active phase
                | (SwapPhase::Setup, SwapPhase::Aborting)
                | (SwapPhase::LockingHtlcs, SwapPhase::Aborting)
                | (SwapPhase::HtlcsLocked, SwapPhase::Aborting)
                | (SwapPhase::ExecutingFlashLegs, SwapPhase::Aborting)
                | (SwapPhase::LegsComplete, SwapPhase::Aborting)
                | (SwapPhase::ClaimingFast, SwapPhase::Aborting)
                | (SwapPhase::Aborting, SwapPhase::Refunded)
        );

        if valid {
            Ok(())
        } else {
            Err(CoordinatorError::InvalidPhaseTransition {
                from: from.to_string(),
                to: to.to_string(),
            })
        }
    }
}
