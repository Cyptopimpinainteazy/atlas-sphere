//! # X3 Slashing Engine
//!
//! Automatic, deterministic punishment for protocol violations.
//! No humans. No voting. No appeals to authority.
//!
//! Slashing is triggered by:
//! - Failed execution within a slashable scope
//! - State divergence detected during replay
//! - Bond expiry without settlement
//! - Proof invalidity
//!
//! All slashing records are permanent and public.

pub mod types;
pub mod engine;
pub mod bond;
pub mod record;
pub mod error;

pub use types::*;
pub use engine::SlashingEngine;
pub use bond::BondManager;
pub use record::SlashRecord;
pub use error::SlashError;
