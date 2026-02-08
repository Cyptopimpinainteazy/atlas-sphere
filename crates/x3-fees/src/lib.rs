//! # X3 Fee Curve Engine
//!
//! Vector-based, dynamic fee calculation for the X3 jurisdiction.
//!
//! ## Fee Formula
//!
//! ```text
//! TotalFee = BaseFee
//!          + ComplexityFee(legs × state_touches)
//!          + CapitalFee(log₂(capital))
//!          − ReputationDiscount(success_rate, capped)
//! ```
//!
//! ## Design Principles
//!
//! - No flat fees anywhere — every fee is a function of execution parameters
//! - External bots hit negative EV faster than X3-optimized programs
//! - Reputation affects cost, not access — anyone can participate
//! - Fees create exclusivity economically, not politically
//! - Fee pre-calculation is deterministic and must happen BEFORE execution

pub mod curve;
pub mod types;
pub mod calculator;
pub mod reputation;
pub mod error;

pub use types::*;
pub use curve::FeeCurve;
pub use calculator::FeeCalculator;
pub use reputation::ReputationScore;
pub use error::FeeError;
