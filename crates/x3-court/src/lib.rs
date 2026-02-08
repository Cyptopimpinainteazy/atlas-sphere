//! # X3 Deterministic Courts
//!
//! Dispute resolution through deterministic replay. No humans. No voting.
//! No governance tokens. No appeals to authority.
//!
//! ## How It Works
//!
//! 1. A dispute is filed referencing an execution proof chain
//! 2. The court replays the execution deterministically
//! 3. If the replay diverges from the original, the agent is slashed
//! 4. Verdicts are final within the finality window
//! 5. All verdicts are permanent and public
//!
//! ## Principles
//!
//! - **Determinism** — same inputs, same outputs, always
//! - **Finality** — verdicts cannot be appealed or overturned
//! - **Automation** — no human judgment required
//! - **Transparency** — all disputes and verdicts are public
//! - **Immediate enforcement** — slashing happens automatically

pub mod types;
pub mod court;
pub mod replay;
pub mod verdict;
pub mod docket;
pub mod error;

pub use types::*;
pub use court::Court;
pub use replay::ReplayEngine;
pub use verdict::Verdict;
pub use docket::CourtDocket;
pub use error::CourtError;
