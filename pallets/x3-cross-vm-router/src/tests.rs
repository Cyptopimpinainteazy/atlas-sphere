// SPDX-License-Identifier: Apache-2.0
//
// Mock runtime + acceptance tests for the X3 Universal Asset Kernel MVP.
//
// This harness wires together the three kernel pallets — registry, supply
// ledger, cross-VM router — inside a minimal Substrate runtime and exercises
// the golden-path round-trip and the six-route matrix.
//
// The **one** test that matters: `test_x3_native_evm_svm_roundtrip_preserves_supply`.

#![cfg(test)]

use crate as pallet_x3_cross_vm_router;
use frame_support::{
    construct_runtime, derive_impl, parameter_types,
    traits::{ConstU32, EnsureOrigin},
};
use frame_system as system;
use sp_core::H256;
use sp_runtime::{
    traits::{BlakeTwo256, IdentityLookup},
    BuildStorage,
};
use x3_asset_kernel_types::{
    AccountBytes, AssetId, DomainId, ProofTier, RouteConfig, RouteLimits, SupplyPolicy,
};

type Block = frame_system::mocking::MockBlock<Test>;

construct_runtime!(
    pub enum Test {
        System: frame_system,
        Registry: pallet_x3_asset_registry,
        Ledger: pallet_x3_supply_ledger,
        Router: pallet_x3_cross_vm_router,
    }
);

parameter_types! {
    pub const BlockHashCount: u64 = 250;
    pub const SS58Prefix: u8 = 42;
}

#[derive_impl(frame_system::config_preludes::TestDefaultConfig)]
impl frame_system::Config for Test {
    type BaseCallFilter = frame_support::traits::Everything;
    type BlockWeights = ();
    type BlockLength = ();
    type DbWeight = ();
    type RuntimeOrigin = RuntimeOrigin;
    type RuntimeCall = RuntimeCall;
    type Nonce = u64;
    type Hash = H256;
    type Hashing = BlakeTwo256;
    type AccountId = u64;
    type Lookup = IdentityLookup<Self::AccountId>;
    type Block = Block;
    type RuntimeEvent = RuntimeEvent;
    type BlockHashCount = BlockHashCount;
    type Version = ();
    type PalletInfo = PalletInfo;
    type AccountData = ();
    type OnNewAccount = ();
    type OnKilledAccount = ();
    type SystemWeightInfo = ();
    type SS58Prefix = SS58Prefix;
    type OnSetCode = ();
    type MaxConsumers = ConstU32<16>;
}

// Root-or-signed passthrough: any signed origin counts as governance in tests.
pub struct RootOrAny;
impl EnsureOrigin<RuntimeOrigin> for RootOrAny {
    type Success = ();
    fn try_origin(o: RuntimeOrigin) -> Result<(), RuntimeOrigin> {
        match o.clone().into() {
            Ok(system::RawOrigin::Root) => Ok(()),
            Ok(system::RawOrigin::Signed(_)) => Ok(()),
            _ => Err(o),
        }
    }
    #[cfg(feature = "runtime-benchmarks")]
    fn try_successful_origin() -> Result<RuntimeOrigin, ()> {
        Ok(RuntimeOrigin::root())
    }
}

parameter_types! {
    pub const MaxAssets: u32 = 64;
}

impl pallet_x3_asset_registry::Config for Test {
    type RuntimeEvent = RuntimeEvent;
    type RegistryOrigin = RootOrAny;
    type EmergencyPauseOrigin = RootOrAny;
    type MaxAssets = MaxAssets;
}

impl pallet_x3_supply_ledger::Config for Test {
    type RuntimeEvent = RuntimeEvent;
    type SupplyGovernance = RootOrAny;
    type Registry = Registry;
}

impl pallet_x3_cross_vm_router::Config for Test {
    type RuntimeEvent = RuntimeEvent;
    type Registry = Registry;
    type Ledger = Ledger;
}

fn new_test_ext() -> sp_io::TestExternalities {
    let t = frame_system::GenesisConfig::<Test>::default()
        .build_storage()
        .unwrap();
    let mut ext: sp_io::TestExternalities = t.into();
    ext.execute_with(|| System::set_block_number(1));
    ext
}

// ── Fixtures ──────────────────────────────────────────────────────────────

/// Alice on X3Native.
fn alice_native() -> AccountBytes {
    AccountBytes::X3Native([1u8; 32])
}
/// Alice's EVM-side address.
fn alice_evm() -> AccountBytes {
    AccountBytes::Evm([2u8; 20])
}
/// Alice's SVM-side address.
fn alice_svm() -> AccountBytes {
    AccountBytes::Svm([3u8; 32])
}

fn permissive_route() -> RouteConfig {
    RouteConfig {
        enabled: true,
        limits: RouteLimits::DEV_PERMISSIVE,
        fee_bps: 0,
        expiry_blocks: 100,
        proof_tier: ProofTier::TrustedInternal,
    }
}

/// Register X3 as a native-mint-burn asset across all three internal domains,
/// enable all six internal routes, mint `supply` into the native leg.
fn bootstrap_x3_asset(supply: u128) -> AssetId {
    // Register.
    Registry::register_asset(
        RuntimeOrigin::root(),
        b"X3".to_vec(),
        b"X3 Token".to_vec(),
        12,
        DomainId::X3Native,
        0,
        b"native".to_vec(),
        SupplyPolicy::NativeMintBurn,
    )
    .expect("register_asset");

    // Recompute the same asset id the pallet derived.
    let asset_id =
        x3_asset_kernel_types::derive_asset_id(DomainId::X3Native, 0, b"native", b"X3", 12);

    Registry::activate_asset(RuntimeOrigin::root(), asset_id).unwrap();

    // Enable all six internal routes.
    for (src, dst) in [
        (DomainId::X3Native, DomainId::X3Evm),
        (DomainId::X3Evm, DomainId::X3Native),
        (DomainId::X3Native, DomainId::X3Svm),
        (DomainId::X3Svm, DomainId::X3Native),
        (DomainId::X3Evm, DomainId::X3Svm),
        (DomainId::X3Svm, DomainId::X3Evm),
    ] {
        Registry::configure_route(
            RuntimeOrigin::root(),
            asset_id,
            src,
            dst,
            permissive_route(),
        )
        .unwrap();
    }

    // Mint canonical supply into the native leg.
    Ledger::mint_canonical(RuntimeOrigin::root(), asset_id, DomainId::X3Native, supply).unwrap();

    asset_id
}

fn addr_for(domain: DomainId) -> AccountBytes {
    match domain {
        DomainId::X3Native => alice_native(),
        DomainId::X3Evm => alice_evm(),
        DomainId::X3Svm => alice_svm(),
        _ => unreachable!("MVP only uses internal domains"),
    }
}

fn do_xvm(asset_id: AssetId, src: DomainId, dst: DomainId, amount: u128) -> H256 {
    let sender = addr_for(src);
    let recipient = addr_for(dst);
    let now = System::block_number();
    let expires_at = now + 50;

    // Capture nonce before call.
    let nonce = Router::next_nonce(src, sender.clone());

    Router::xvm_transfer(
        RuntimeOrigin::signed(1),
        asset_id,
        src,
        dst,
        sender.clone(),
        recipient.clone(),
        amount,
        expires_at,
    )
    .expect("xvm_transfer");

    // Rebuild the message exactly as the router did, then rederive id.
    let msg = x3_asset_kernel_types::X3TransferMessage::<u64> {
        version: x3_asset_kernel_types::MESSAGE_FORMAT_VERSION,
        asset_id,
        source_domain: src,
        destination_domain: dst,
        sender,
        recipient,
        amount,
        nonce,
        created_at: now,
        expires_at,
    };
    let message_id = x3_asset_kernel_types::derive_message_id::<u64>(&msg);

    Router::complete_xvm_transfer(RuntimeOrigin::signed(1), message_id).expect("complete");
    message_id
}

// ── THE golden-path test ──────────────────────────────────────────────────

#[test]
fn test_x3_native_evm_svm_roundtrip_preserves_supply() {
    new_test_ext().execute_with(|| {
        // 1 billion units canonical supply.
        let asset_id = bootstrap_x3_asset(1_000_000_000);

        // Sanity: entire supply sits on the native leg.
        let l0 = Ledger::ledgers(asset_id).unwrap();
        assert_eq!(l0.canonical_supply, 1_000_000_000);
        assert_eq!(l0.native_supply, 1_000_000_000);
        assert_eq!(l0.evm_supply, 0);
        assert_eq!(l0.svm_supply, 0);
        assert_eq!(l0.pending_supply, 0);
        l0.check_invariant().unwrap();

        // Native → EVM 250
        do_xvm(asset_id, DomainId::X3Native, DomainId::X3Evm, 250);
        let l1 = Ledger::ledgers(asset_id).unwrap();
        assert_eq!(l1.native_supply, 1_000_000_000 - 250);
        assert_eq!(l1.evm_supply, 250);
        assert_eq!(l1.svm_supply, 0);
        assert_eq!(l1.pending_supply, 0);
        l1.check_invariant().unwrap();

        // EVM → SVM 100
        do_xvm(asset_id, DomainId::X3Evm, DomainId::X3Svm, 100);
        let l2 = Ledger::ledgers(asset_id).unwrap();
        assert_eq!(l2.native_supply, 1_000_000_000 - 250);
        assert_eq!(l2.evm_supply, 150);
        assert_eq!(l2.svm_supply, 100);
        assert_eq!(l2.pending_supply, 0);
        l2.check_invariant().unwrap();

        // SVM → Native 50
        do_xvm(asset_id, DomainId::X3Svm, DomainId::X3Native, 50);
        let l3 = Ledger::ledgers(asset_id).unwrap();
        assert_eq!(l3.native_supply, 1_000_000_000 - 250 + 50);
        assert_eq!(l3.evm_supply, 150);
        assert_eq!(l3.svm_supply, 50);
        assert_eq!(l3.pending_supply, 0);

        // Canonical supply never changed.
        assert_eq!(l3.canonical_supply, 1_000_000_000);
        // King invariant still holds.
        l3.check_invariant().unwrap();
        // Represented == canonical (nothing minted or burned).
        assert_eq!(l3.represented().unwrap(), l3.canonical_supply);
    });
}

// ── Six-route matrix ──────────────────────────────────────────────────────

#[test]
fn test_all_six_internal_routes_succeed() {
    new_test_ext().execute_with(|| {
        let asset_id = bootstrap_x3_asset(10_000);

        // Seed each domain with enough balance to move from it.
        // Start: 10_000 on native, 0 elsewhere. Preload EVM and SVM.
        do_xvm(asset_id, DomainId::X3Native, DomainId::X3Evm, 1_000);
        do_xvm(asset_id, DomainId::X3Native, DomainId::X3Svm, 1_000);

        // Exercise each of the 6 routes.
        for (src, dst) in [
            (DomainId::X3Native, DomainId::X3Evm),
            (DomainId::X3Evm, DomainId::X3Native),
            (DomainId::X3Native, DomainId::X3Svm),
            (DomainId::X3Svm, DomainId::X3Native),
            (DomainId::X3Evm, DomainId::X3Svm),
            (DomainId::X3Svm, DomainId::X3Evm),
        ] {
            do_xvm(asset_id, src, dst, 10);
            let l = Ledger::ledgers(asset_id).unwrap();
            l.check_invariant().unwrap();
            assert_eq!(l.pending_supply, 0);
        }

        // Canonical unchanged.
        let l = Ledger::ledgers(asset_id).unwrap();
        assert_eq!(l.canonical_supply, 10_000);
        assert_eq!(l.represented().unwrap(), 10_000);
    });
}

// ── Negative tests ────────────────────────────────────────────────────────

#[test]
fn test_duplicate_message_replay_rejected() {
    new_test_ext().execute_with(|| {
        let asset_id = bootstrap_x3_asset(10_000);

        // Manually build + submit a transfer to capture the message id.
        let now = System::block_number();
        let sender = alice_native();
        let recipient = alice_evm();
        let nonce = Router::next_nonce(DomainId::X3Native, sender.clone());
        let expires_at = now + 50;

        Router::xvm_transfer(
            RuntimeOrigin::signed(1),
            asset_id,
            DomainId::X3Native,
            DomainId::X3Evm,
            sender.clone(),
            recipient.clone(),
            100,
            expires_at,
        )
        .unwrap();

        let msg = x3_asset_kernel_types::X3TransferMessage::<u64> {
            version: x3_asset_kernel_types::MESSAGE_FORMAT_VERSION,
            asset_id,
            source_domain: DomainId::X3Native,
            destination_domain: DomainId::X3Evm,
            sender,
            recipient,
            amount: 100,
            nonce,
            created_at: now,
            expires_at,
        };
        let message_id = x3_asset_kernel_types::derive_message_id::<u64>(&msg);

        // First completion succeeds.
        Router::complete_xvm_transfer(RuntimeOrigin::signed(1), message_id).unwrap();

        // Second completion must fail — state is now Finalized, not SourceDebited.
        assert!(
            Router::complete_xvm_transfer(RuntimeOrigin::signed(1), message_id).is_err(),
            "re-completing a finalized transfer must fail"
        );
    });
}

#[test]
fn test_paused_asset_rejects_transfers() {
    new_test_ext().execute_with(|| {
        let asset_id = bootstrap_x3_asset(10_000);
        Registry::pause_asset(RuntimeOrigin::root(), asset_id).unwrap();

        let r = Router::xvm_transfer(
            RuntimeOrigin::signed(1),
            asset_id,
            DomainId::X3Native,
            DomainId::X3Evm,
            alice_native(),
            alice_evm(),
            10,
            60,
        );
        assert!(r.is_err(), "paused asset must reject transfers");
    });
}

#[test]
fn test_closed_route_rejects_transfers() {
    new_test_ext().execute_with(|| {
        let asset_id = bootstrap_x3_asset(10_000);
        Registry::set_route_enabled(
            RuntimeOrigin::root(),
            asset_id,
            DomainId::X3Native,
            DomainId::X3Evm,
            false,
        )
        .unwrap();

        let r = Router::xvm_transfer(
            RuntimeOrigin::signed(1),
            asset_id,
            DomainId::X3Native,
            DomainId::X3Evm,
            alice_native(),
            alice_evm(),
            10,
            60,
        );
        assert!(r.is_err(), "disabled route must reject transfers");
    });
}

#[test]
fn test_zero_amount_rejected() {
    new_test_ext().execute_with(|| {
        let asset_id = bootstrap_x3_asset(10_000);
        let r = Router::xvm_transfer(
            RuntimeOrigin::signed(1),
            asset_id,
            DomainId::X3Native,
            DomainId::X3Evm,
            alice_native(),
            alice_evm(),
            0,
            60,
        );
        assert!(r.is_err(), "zero amount must be rejected");
    });
}

#[test]
fn test_incompatible_recipient_rejected() {
    new_test_ext().execute_with(|| {
        let asset_id = bootstrap_x3_asset(10_000);
        // Native→Evm but recipient is an SVM key: must fail.
        let r = Router::xvm_transfer(
            RuntimeOrigin::signed(1),
            asset_id,
            DomainId::X3Native,
            DomainId::X3Evm,
            alice_native(),
            alice_svm(), // wrong type for X3Evm
            10,
            60,
        );
        assert!(
            r.is_err(),
            "EVM destination with SVM recipient must be rejected"
        );
    });
}

#[test]
fn test_expired_transfer_refunds_to_source() {
    new_test_ext().execute_with(|| {
        let asset_id = bootstrap_x3_asset(10_000);

        let now = System::block_number();
        let sender = alice_native();
        let recipient = alice_evm();
        let nonce = Router::next_nonce(DomainId::X3Native, sender.clone());
        let expires_at = now + 5;

        Router::xvm_transfer(
            RuntimeOrigin::signed(1),
            asset_id,
            DomainId::X3Native,
            DomainId::X3Evm,
            sender.clone(),
            recipient.clone(),
            100,
            expires_at,
        )
        .unwrap();

        // Advance past expiry.
        System::set_block_number(expires_at + 1);

        let msg = x3_asset_kernel_types::X3TransferMessage::<u64> {
            version: x3_asset_kernel_types::MESSAGE_FORMAT_VERSION,
            asset_id,
            source_domain: DomainId::X3Native,
            destination_domain: DomainId::X3Evm,
            sender,
            recipient,
            amount: 100,
            nonce,
            created_at: now,
            expires_at,
        };
        let message_id = x3_asset_kernel_types::derive_message_id::<u64>(&msg);

        Router::cancel_expired_xvm_transfer(RuntimeOrigin::signed(1), message_id).unwrap();

        let l = Ledger::ledgers(asset_id).unwrap();
        // Supply fully returned to native leg; pending zero.
        assert_eq!(l.native_supply, 10_000);
        assert_eq!(l.evm_supply, 0);
        assert_eq!(l.pending_supply, 0);
        l.check_invariant().unwrap();
    });
}

#[test]
fn test_cannot_cancel_before_expiry() {
    new_test_ext().execute_with(|| {
        let asset_id = bootstrap_x3_asset(10_000);

        let now = System::block_number();
        let sender = alice_native();
        let recipient = alice_evm();
        let nonce = Router::next_nonce(DomainId::X3Native, sender.clone());
        let expires_at = now + 50;

        Router::xvm_transfer(
            RuntimeOrigin::signed(1),
            asset_id,
            DomainId::X3Native,
            DomainId::X3Evm,
            sender.clone(),
            recipient.clone(),
            100,
            expires_at,
        )
        .unwrap();

        let msg = x3_asset_kernel_types::X3TransferMessage::<u64> {
            version: x3_asset_kernel_types::MESSAGE_FORMAT_VERSION,
            asset_id,
            source_domain: DomainId::X3Native,
            destination_domain: DomainId::X3Evm,
            sender,
            recipient,
            amount: 100,
            nonce,
            created_at: now,
            expires_at,
        };
        let message_id = x3_asset_kernel_types::derive_message_id::<u64>(&msg);

        // Still in-flight; cancel must refuse.
        assert!(
            Router::cancel_expired_xvm_transfer(RuntimeOrigin::signed(1), message_id).is_err(),
            "cancel before expiry must fail"
        );
    });
}

#[test]
fn test_external_route_rejected_in_mvp() {
    new_test_ext().execute_with(|| {
        let asset_id = bootstrap_x3_asset(10_000);
        let r = Router::xvm_transfer(
            RuntimeOrigin::signed(1),
            asset_id,
            DomainId::X3Native,
            DomainId::Ethereum,
            alice_native(),
            AccountBytes::Evm([9u8; 20]),
            10,
            60,
        );
        assert!(r.is_err(), "external routes must be rejected in MVP");
    });
}

// ── Property / fuzz: random cross-VM transfer sequences preserve the king invariant ──
//
// For a deterministic PRNG-generated sequence of internal transfers between
// X3Native / X3Evm / X3Svm, after *every* successful transfer the supply
// ledger's `check_invariant()` must hold: canonical_supply equals the sum of
// all represented legs (native + evm + svm + external_locked + pending).
//
// We keep the per-test bound tight (transfers <= legs) and run many random
// seeds so that failures surface as a concrete seed the developer can replay.

/// Tiny splitmix64 PRNG — deterministic and zero-dependency.
fn rng_next(state: &mut u64) -> u64 {
    *state = state.wrapping_add(0x9E3779B97F4A7C15);
    let mut z = *state;
    z = (z ^ (z >> 30)).wrapping_mul(0xBF58476D1CE4E5B9);
    z = (z ^ (z >> 27)).wrapping_mul(0x94D049BB133111EB);
    z ^ (z >> 31)
}

fn domain_from(v: u64) -> DomainId {
    match v % 3 {
        0 => DomainId::X3Native,
        1 => DomainId::X3Evm,
        _ => DomainId::X3Svm,
    }
}

fn leg_balance(l: &x3_asset_kernel_types::SupplyLedger, d: DomainId) -> u128 {
    match d {
        DomainId::X3Native => l.native_supply,
        DomainId::X3Evm => l.evm_supply,
        DomainId::X3Svm => l.svm_supply,
        _ => 0,
    }
}

/// Execute one random transfer. Returns true if attempted (valid src != dst
/// and non-zero amount available on src); the caller asserts the invariant.
fn random_transfer_step(asset_id: AssetId, rng: &mut u64) -> bool {
    let src = domain_from(rng_next(rng));
    let dst = domain_from(rng_next(rng));
    if src == dst {
        return false;
    }
    let l = Ledger::ledgers(asset_id).unwrap();
    let avail = leg_balance(&l, src);
    if avail == 0 {
        return false;
    }
    // Transfer a fraction of available, at least 1.
    let amount = 1 + (rng_next(rng) as u128 % avail);
    do_xvm(asset_id, src, dst, amount);
    true
}

#[test]
fn fuzz_random_transfer_sequence_preserves_invariant() {
    // 64 seeds * up to 40 transfers each. Any invariant violation panics.
    for seed in 0u64..64 {
        new_test_ext().execute_with(|| {
            let asset_id = bootstrap_x3_asset(1_000_000);
            let mut rng = seed.wrapping_mul(0xABCDEF0123456789).wrapping_add(1);

            let canonical_before = Ledger::ledgers(asset_id).unwrap().canonical_supply;

            for _ in 0..40 {
                let _ = random_transfer_step(asset_id, &mut rng);
                let l = Ledger::ledgers(asset_id).unwrap();
                // KING INVARIANT: supply never drifts, no matter the path.
                l.check_invariant()
                    .expect("invariant must hold on every step");
                assert_eq!(
                    l.canonical_supply, canonical_before,
                    "canonical supply must be immutable under transfers (seed={})",
                    seed
                );
                // Router settles synchronously in MVP, so nothing should be pending.
                assert_eq!(
                    l.pending_supply, 0,
                    "pending must drain to 0 after each completion (seed={})",
                    seed
                );
                // Represented total always equals canonical.
                assert_eq!(
                    l.represented().expect("represented ok"),
                    l.canonical_supply,
                    "represented == canonical (seed={})",
                    seed
                );
            }
        });
    }
}

#[test]
fn fuzz_large_value_transfers_preserve_invariant() {
    // Stress with near-u128-max canonical supply to catch overflow / wrap bugs.
    new_test_ext().execute_with(|| {
        let big = u128::MAX / 2;
        let asset_id = bootstrap_x3_asset(big);
        let mut rng = 0xDEADBEEFu64;

        for _ in 0..32 {
            let _ = random_transfer_step(asset_id, &mut rng);
            let l = Ledger::ledgers(asset_id).unwrap();
            l.check_invariant().expect("big-value invariant");
            assert_eq!(l.canonical_supply, big);
            assert_eq!(l.pending_supply, 0);
        }
    });
}
