//! # X3 Agent System
//!
//! Permissionless agent registration with bonded admission.
//!
//! ## Principles
//!
//! - **Permissionless** — anyone can register by posting a bond. NO whitelists.
//! - **Bonded admission** — skin in the game from block zero.
//! - **Ephemeral identities** — agents can use disposable keys.
//! - **Reputation tracking** — public record of all executions.
//! - **Automatic slashing** — violations are punished, not governed.
//! - **Permanent record** — history is never deleted.
//! - **NO admin overrides** — the protocol is the authority.

pub mod types;
pub mod registry;
pub mod reputation;
pub mod identity;
pub mod error;

pub use types::*;
pub use registry::AgentRegistry;
pub use reputation::ReputationTracker;
pub use identity::IdentityManager;
pub use error::AgentError;
