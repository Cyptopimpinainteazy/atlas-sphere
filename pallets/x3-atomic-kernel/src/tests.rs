//! Tests for pallet-x3-atomic-kernel

use super::pallet::*;
use super::proof::*;
use sp_core::H256;

// ── Simple unit tests (no FRAME mock needed) ────────────────────────────────

#[test]
fn test_poae_proof_structure_validation() {
    let valid = PoaeProof {
        bundle_id: H256::repeat_byte(0x01),
        receipt_root: H256::repeat_byte(0x02),
        finalized_block: 100,
        finality_cert: H256::repeat_byte(0x03),
        legs_hash: H256::repeat_byte(0x04),
        leg_count: 2,
    };
    assert!(valid.validate_structure());
}

#[test]
fn test_poae_proof_zero_bundle_id_invalid() {
    let invalid = PoaeProof {
        bundle_id: H256::zero(),
        receipt_root: H256::repeat_byte(0x02),
        finalized_block: 100,
        finality_cert: H256::repeat_byte(0x03),
        legs_hash: H256::repeat_byte(0x04),
        leg_count: 2,
    };
    assert!(!invalid.validate_structure());
}

#[test]
fn test_poae_proof_zero_block_invalid() {
    let invalid = PoaeProof {
        bundle_id: H256::repeat_byte(0x01),
        receipt_root: H256::repeat_byte(0x02),
        finalized_block: 0, // should be > 0
        finality_cert: H256::repeat_byte(0x03),
        legs_hash: H256::repeat_byte(0x04),
        leg_count: 2,
    };
    assert!(!invalid.validate_structure());
}

#[test]
fn test_poae_proof_hash_is_deterministic() {
    let proof = PoaeProof {
        bundle_id: H256::repeat_byte(0x11),
        receipt_root: H256::repeat_byte(0x22),
        finalized_block: 500,
        finality_cert: H256::repeat_byte(0x33),
        legs_hash: H256::repeat_byte(0x44),
        leg_count: 3,
    };
    // Same proof → same hash (determinism)
    assert_eq!(proof.proof_hash(), proof.proof_hash());
}

#[test]
fn test_poae_proof_hash_differs_on_different_data() {
    let p1 = PoaeProof {
        bundle_id: H256::repeat_byte(0x01),
        receipt_root: H256::repeat_byte(0x02),
        finalized_block: 100,
        finality_cert: H256::repeat_byte(0x03),
        legs_hash: H256::repeat_byte(0x04),
        leg_count: 1,
    };
    let p2 = PoaeProof {
        bundle_id: H256::repeat_byte(0x01),
        receipt_root: H256::repeat_byte(0xFF), // different receipt
        ..p1.clone()
    };
    assert_ne!(p1.proof_hash(), p2.proof_hash());
}

#[test]
fn test_bundle_leg_encode_decode_roundtrip() {
    use parity_scale_codec::{Decode, Encode};

    let leg = BundleLeg {
        vm_type: VmType::Cross,
        token_in: H256::repeat_byte(0xAA),
        token_out: H256::repeat_byte(0xBB),
        amount_in: 1_000_000_000_000u128,
        min_amount_out: 990_000_000_000u128,
        deadline: 1_800_000_000u64,
        access: DeclaredAccess {
            reads: Default::default(),
            writes: Default::default(),
        },
    };

    let encoded = leg.encode();
    let decoded = BundleLeg::decode(&mut &encoded[..]).expect("decode failed");
    assert_eq!(leg, decoded);
}
