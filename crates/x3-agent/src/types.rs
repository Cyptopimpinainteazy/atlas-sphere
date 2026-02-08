//! Core agent types.

use serde::{Deserialize, Serialize};
use x3_proof::types::{AgentIdentity, BlockHeight};

/// Agent registration status.
#[derive(Debug, Clone, Copy, Serialize, Deserialize, PartialEq, Eq)]
pub enum AgentStatus {
    /// Agent is registered and active.
    Active,
    /// Agent is suspended (bond below minimum).
    Suspended,
    /// Agent has voluntarily deregistered.
    Deregistered,
    /// Agent was forcibly deactivated (critical slash).
    Deactivated,
}

/// Full agent record — the permanent identity of an agent in the jurisdiction.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AgentRecord {
    /// Primary identity (persistent key).
    pub identity: AgentIdentity,
    /// Registration block.
    pub registered_at: BlockHeight,
    /// Current status.
    pub status: AgentStatus,
    /// Initial bond amount.
    pub initial_bond: u128,
    /// Current effective bond (after any slashing).
    pub current_bond: u128,
    /// Linked ephemeral identities.
    pub ephemeral_keys: Vec<[u8; 32]>,
    /// Execution statistics.
    pub stats: AgentStats,
    /// Reputation data (computed from stats).
    pub reputation: x3_fees::types::AgentReputation,
}

/// Agent execution statistics.
#[derive(Debug, Clone, Default, Serialize, Deserialize)]
pub struct AgentStats {
    /// Total intents submitted.
    pub intents_submitted: u64,
    /// Total intents executed successfully.
    pub intents_succeeded: u64,
    /// Total intents failed.
    pub intents_failed: u64,
    /// Total intents cancelled.
    pub intents_cancelled: u64,
    /// Total intents expired.
    pub intents_expired: u64,
    /// Total slash events.
    pub slash_count: u64,
    /// Total amount slashed across all events.
    pub total_slashed: u128,
    /// Total volume executed.
    pub total_volume: u128,
    /// Total fees paid.
    pub total_fees_paid: u128,
    /// Total profit realized.
    pub total_profit: i128,
    /// Last activity block.
    pub last_active_at: BlockHeight,
}

/// Configuration for the agent system.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AgentConfig {
    /// Minimum bond to register as an agent.
    pub min_registration_bond: u128,
    /// Maximum ephemeral keys per agent.
    pub max_ephemeral_keys: usize,
    /// Number of slashes before automatic deactivation.
    pub critical_slash_threshold: u64,
    /// Minimum bond to remain active (below this = suspended).
    pub min_active_bond: u128,
}

impl Default for AgentConfig {
    fn default() -> Self {
        Self {
            min_registration_bond: 10_000_000,
            max_ephemeral_keys: 10,
            critical_slash_threshold: 3,
            min_active_bond: 1_000_000,
        }
    }
}

/// Event emitted by the agent system.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum AgentEvent {
    /// Agent registered.
    Registered {
        pubkey: [u8; 32],
        bond: u128,
        block: BlockHeight,
    },
    /// Ephemeral key linked.
    EphemeralKeyLinked {
        pubkey: [u8; 32],
        ephemeral: [u8; 32],
        block: BlockHeight,
    },
    /// Execution recorded.
    ExecutionRecorded {
        pubkey: [u8; 32],
        success: bool,
        volume: u128,
        block: BlockHeight,
    },
    /// Agent slashed.
    Slashed {
        pubkey: [u8; 32],
        amount: u128,
        reason: String,
        block: BlockHeight,
    },
    /// Agent deactivated.
    Deactivated {
        pubkey: [u8; 32],
        reason: String,
        block: BlockHeight,
    },
    /// Agent deregistered.
    Deregistered {
        pubkey: [u8; 32],
        bond_returned: u128,
        block: BlockHeight,
    },
}
