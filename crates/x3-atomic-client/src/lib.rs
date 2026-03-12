//! # X3 Atomic Client Library
//!
//! Typed Rust client for interacting with the X3 Atomic Kernel via RPC.
//!
//! ## Features
//!
//! - **Bundle builder**: Fluent API for constructing atomic bundles with
//!   declared access sets and multi-VM legs.
//! - **Proof retrieval**: Fetch PoAE proofs for cross-chain settlement.
//! - **Subscription helpers**: Stream finalization events for real-time UX.
//! - **Verification helpers**: Validate PoAE proof structure locally.
//!
//! ## Example
//!
//! ```rust,ignore
//! use x3_atomic_client::{AtomicBundleBuilder, VmType, X3AtomicClient};
//!
//! #[tokio::main]
//! async fn main() -> anyhow::Result<()> {
//!     let client = X3AtomicClient::connect("ws://localhost:9944").await?;
//!
//!     let bundle = AtomicBundleBuilder::new()
//!         .add_leg(VmType::Evm, token_a, token_b, 1000, 990, 60)
//!         .add_leg(VmType::Svm, token_b, token_c, 990, 980, 60)
//!         .build()?;
//!
//!     let bundle_id = client.submit_bundle(&bundle).await?;
//!     let proof = client.get_proof(bundle_id).await?;
//!
//!     Ok(())
//! }
//! ```

use anyhow::{anyhow, Result};
use codec::{Decode, Encode};
use serde::{Deserialize, Serialize};
use sp_core::H256;
use tracing::{debug, info};

// ─── Core Types ───────────────────────────────────────────────────────────────

/// VM type for a bundle leg.
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize, Encode, Decode)]
pub enum VmType {
    Evm,
    Svm,
    X3,
    Cross,
}

/// Declared access set for parallel scheduling.
#[derive(Debug, Clone, Serialize, Deserialize, Encode, Decode)]
pub struct DeclaredAccess {
    pub reads: Vec<H256>,
    pub writes: Vec<H256>,
}

impl Default for DeclaredAccess {
    fn default() -> Self {
        Self {
            reads: Vec::new(),
            writes: Vec::new(),
        }
    }
}

/// A single leg in an atomic bundle.
#[derive(Debug, Clone, Serialize, Deserialize, Encode, Decode)]
pub struct BundleLeg {
    pub vm_type: VmType,
    pub token_in: H256,
    pub token_out: H256,
    pub amount_in: u128,
    pub min_amount_out: u128,
    pub deadline: u64,
    pub access: DeclaredAccess,
}

/// An atomic bundle ready for submission.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AtomicBundle {
    pub legs: Vec<BundleLeg>,
    pub deadline_blocks: u32,
}

/// PoAE proof returned from the chain.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PoaeProof {
    pub bundle_id: H256,
    pub receipt_root: H256,
    pub finalized_block: u64,
    pub finality_cert: H256,
    pub legs_hash: H256,
    pub leg_count: u32,
}

impl PoaeProof {
    /// Validate structural consistency of a proof.
    pub fn validate_structure(&self) -> bool {
        self.bundle_id != H256::zero()
            && self.receipt_root != H256::zero()
            && self.finalized_block > 0
            && self.finality_cert != H256::zero()
            && self.leg_count > 0
    }

    /// Compute proof hash (matches on-chain computation).
    pub fn proof_hash(&self) -> H256 {
        use sp_core::hashing::sha2_256;
        let mut data = self.bundle_id.as_bytes().to_vec();
        data.extend_from_slice(self.receipt_root.as_bytes());
        data.extend_from_slice(&self.finalized_block.to_le_bytes());
        data.extend_from_slice(self.finality_cert.as_bytes());
        data.extend_from_slice(self.legs_hash.as_bytes());
        H256(sha2_256(&data))
    }
}

/// Bundle submission result.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SubmitResult {
    pub bundle_id: H256,
    pub estimated_finality_ms: u64,
    pub status: String,
}

/// Bundle status.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct BundleStatus {
    pub bundle_id: H256,
    pub status: String,
    pub leg_count: u32,
    pub submitted_at: u64,
    pub deadline_block: u64,
}

// ─── Builder ──────────────────────────────────────────────────────────────────

/// Fluent builder for atomic bundles.
pub struct AtomicBundleBuilder {
    legs: Vec<BundleLeg>,
    deadline_blocks: u32,
}

impl AtomicBundleBuilder {
    pub fn new() -> Self {
        Self {
            legs: Vec::new(),
            deadline_blocks: 100, // default ~20s at 200ms blocks
        }
    }

    /// Add a trade leg to the bundle.
    pub fn add_leg(
        mut self,
        vm_type: VmType,
        token_in: H256,
        token_out: H256,
        amount_in: u128,
        min_amount_out: u128,
        deadline_secs: u64,
    ) -> Self {
        self.legs.push(BundleLeg {
            vm_type,
            token_in,
            token_out,
            amount_in,
            min_amount_out,
            deadline: deadline_secs,
            access: DeclaredAccess::default(),
        });
        self
    }

    /// Add a leg with explicit access declarations (required for parallel execution).
    pub fn add_leg_with_access(
        mut self,
        vm_type: VmType,
        token_in: H256,
        token_out: H256,
        amount_in: u128,
        min_amount_out: u128,
        deadline_secs: u64,
        reads: Vec<H256>,
        writes: Vec<H256>,
    ) -> Self {
        self.legs.push(BundleLeg {
            vm_type,
            token_in,
            token_out,
            amount_in,
            min_amount_out,
            deadline: deadline_secs,
            access: DeclaredAccess { reads, writes },
        });
        self
    }

    /// Set the deadline in blocks for the bundle.
    pub fn deadline_blocks(mut self, blocks: u32) -> Self {
        self.deadline_blocks = blocks;
        self
    }

    /// Build the atomic bundle.
    pub fn build(self) -> Result<AtomicBundle> {
        if self.legs.is_empty() {
            return Err(anyhow!("Bundle must have at least one leg"));
        }
        if self.legs.len() > 16 {
            return Err(anyhow!("Bundle exceeds maximum of 16 legs"));
        }

        Ok(AtomicBundle {
            legs: self.legs,
            deadline_blocks: self.deadline_blocks,
        })
    }
}

impl Default for AtomicBundleBuilder {
    fn default() -> Self {
        Self::new()
    }
}

// ─── Client ───────────────────────────────────────────────────────────────────

/// X3 atomic execution RPC client.
///
/// Connects to an X3 chain node and provides typed methods for bundle
/// lifecycle operations.
pub struct X3AtomicClient {
    endpoint: String,
    // In production, this would hold a jsonrpsee WS client handle.
    // For now, we expose the interface for external integration.
}

impl X3AtomicClient {
    /// Connect to an X3 chain node.
    pub async fn connect(endpoint: &str) -> Result<Self> {
        info!("Connecting to X3 node at {}", endpoint);
        // TODO: Initialize jsonrpsee WebSocket client
        Ok(Self {
            endpoint: endpoint.to_string(),
        })
    }

    /// Submit an atomic bundle for execution.
    pub async fn submit_bundle(&self, bundle: &AtomicBundle) -> Result<SubmitResult> {
        debug!("Submitting bundle with {} legs", bundle.legs.len());
        // TODO: Call atomic_submitAtomicBundle RPC
        Err(anyhow!("RPC client not yet connected — use with live node"))
    }

    /// Get the status of a bundle.
    pub async fn get_status(&self, bundle_id: H256) -> Result<BundleStatus> {
        debug!("Getting status for bundle {:?}", bundle_id);
        // TODO: Call atomic_getBundleStatus RPC
        Err(anyhow!("RPC client not yet connected — use with live node"))
    }

    /// Get the PoAE proof for a finalized bundle.
    pub async fn get_proof(&self, bundle_id: H256) -> Result<PoaeProof> {
        debug!("Getting proof for bundle {:?}", bundle_id);
        // TODO: Call atomic_getAtomicExecutionProof RPC
        Err(anyhow!("RPC client not yet connected — use with live node"))
    }

    /// Simulate a bundle without executing it.
    pub async fn simulate(&self, bundle: &AtomicBundle) -> Result<SimulationResult> {
        debug!("Simulating bundle with {} legs", bundle.legs.len());
        // TODO: Call atomic_simulateAtomicBundle RPC
        Err(anyhow!("RPC client not yet connected — use with live node"))
    }

    /// The WebSocket endpoint this client is connected to.
    pub fn endpoint(&self) -> &str {
        &self.endpoint
    }
}

/// Result from bundle simulation.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SimulationResult {
    pub success: bool,
    pub estimated_gas: u64,
    pub estimated_finality_ms: u64,
    pub error: Option<String>,
}

// ─── Tests ────────────────────────────────────────────────────────────────────

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_builder_requires_at_least_one_leg() {
        let result = AtomicBundleBuilder::new().build();
        assert!(result.is_err());
    }

    #[test]
    fn test_builder_rejects_too_many_legs() {
        let mut builder = AtomicBundleBuilder::new();
        for _ in 0..17 {
            builder = builder.add_leg(VmType::Evm, H256::zero(), H256::zero(), 100, 90, 60);
        }
        let result = builder.build();
        assert!(result.is_err());
    }

    #[test]
    fn test_builder_happy_path() {
        let bundle = AtomicBundleBuilder::new()
            .add_leg(VmType::Evm, H256::zero(), H256::zero(), 100, 90, 60)
            .add_leg(VmType::Svm, H256::zero(), H256::zero(), 90, 85, 60)
            .deadline_blocks(200)
            .build()
            .unwrap();

        assert_eq!(bundle.legs.len(), 2);
        assert_eq!(bundle.deadline_blocks, 200);
    }

    #[test]
    fn test_proof_validate_structure() {
        let valid = PoaeProof {
            bundle_id: H256::repeat_byte(1),
            receipt_root: H256::repeat_byte(2),
            finalized_block: 42,
            finality_cert: H256::repeat_byte(3),
            legs_hash: H256::repeat_byte(4),
            leg_count: 2,
        };
        assert!(valid.validate_structure());

        let invalid = PoaeProof {
            bundle_id: H256::zero(),
            ..valid.clone()
        };
        assert!(!invalid.validate_structure());
    }

    #[test]
    fn test_proof_hash_deterministic() {
        let proof = PoaeProof {
            bundle_id: H256::repeat_byte(0xAA),
            receipt_root: H256::repeat_byte(0xBB),
            finalized_block: 100,
            finality_cert: H256::repeat_byte(0xCC),
            legs_hash: H256::repeat_byte(0xDD),
            leg_count: 3,
        };

        let hash1 = proof.proof_hash();
        let hash2 = proof.proof_hash();
        assert_eq!(hash1, hash2);
    }
}
