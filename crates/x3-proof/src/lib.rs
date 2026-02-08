//! # X3 Proof Engine
//!
//! Deterministic execution proof generation and verification for the X3 jurisdiction.
//!
//! Every execution within X3 produces a cryptographic proof chain that can be
//! independently verified by any observer. Proofs are the foundation of the
//! court system — disputes are resolved by deterministic replay, not voting.
//!
//! ## Architecture
//!
//! - **ExecutionProof**: Captures a single atomic execution step
//! - **StateProof**: Captures a state transition with before/after hashes
//! - **ProofChain**: An ordered sequence of proofs forming a complete execution trace
//! - **ProofEngine**: Generates proofs during VM execution
//! - **ProofVerifier**: Independently verifies proof chains against replay

pub mod types;
pub mod hasher;
pub mod engine;
pub mod verifier;
pub mod chain;
pub mod error;

pub use types::*;
pub use hasher::DeterministicHasher;
pub use engine::ProofEngine;
pub use engine::ProofEngineConfig;
pub use verifier::ProofVerifier;
pub use chain::ProofChain;
pub use error::ProofError;
