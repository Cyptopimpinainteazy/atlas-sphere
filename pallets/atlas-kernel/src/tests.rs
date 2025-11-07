use frame_support::{assert_noop, assert_ok};
use parity_scale_codec::Encode;
use sp_core::{hashing::blake2_256, H256};

use crate::{
	AccountRegistry, AssetRegistry, CanonicalLedger, ComitFailureReason, Nonces,
};

use crate::mock::{
	self, new_test_ext, AtlasId, AtlasKernel, RuntimeEvent, RuntimeOrigin, System, ALICE, BOB, CHARLIE,
	AssetId, Balance,
};

type Test = mock::Test;
type AtlasEvent = crate::Event<Test>;
type AtlasError = crate::Error<Test>;

fn compute_prepare_root(
	comit_id: H256,
	evm_payload: &[u8],
	svm_payload: &[u8],
	nonce: u64,
	fee: Balance,
) -> H256 {
	let mut data = Vec::new();
	data.extend_from_slice(comit_id.as_bytes());
	data.extend_from_slice(evm_payload);
	data.extend_from_slice(svm_payload);
	data.extend_from_slice(&nonce.to_le_bytes());
	data.extend_from_slice(&fee.encode());
	H256::from(blake2_256(&data))
}

#[test]
fn submit_comit_successful_flow() {
	new_test_ext().execute_with(|| {
		let comit_id = H256::from_low_u64_be(1);
		let evm_payload = vec![1, 2, 3];
		let svm_payload = vec![4, 5];
		let fee: Balance = 500;

		assert_ok!(AtlasKernel::submit_comit(
			RuntimeOrigin::signed(ALICE),
			comit_id,
			evm_payload.clone(),
			svm_payload.clone(),
			0,
			fee,
			H256::zero(),
		));

		assert_eq!(Nonces::<Test>::get(ALICE), 1);
		assert_eq!(AccountRegistry::<Test>::get(ALICE), Some(AtlasId::default()));

		let events = System::events();
		assert_eq!(events.len(), 1);
		match &events[0].event {
			RuntimeEvent::AtlasKernel(AtlasEvent::ComitSubmitted {
				comit_id: id,
				origin,
				nonce,
				fee: emitted_fee,
			}) => {
				assert_eq!(*id, comit_id);
				assert_eq!(*origin, ALICE);
				assert_eq!(*nonce, 0);
				assert_eq!(*emitted_fee, fee);
			},
			e => panic!("Unexpected event: {:?}", e),
		}
	});
}

#[test]
fn submit_comit_with_matching_prepare_root_succeeds() {
	new_test_ext().execute_with(|| {
		let comit_id = H256::from_low_u64_be(11);
		let evm_payload = vec![9, 9, 9];
		let svm_payload = vec![7, 7];
		let fee: Balance = 42;
		let nonce = 0;
		let prepare_root = compute_prepare_root(
			comit_id,
			&evm_payload,
			&svm_payload,
			nonce,
			fee,
		);

		assert_ok!(AtlasKernel::submit_comit(
			RuntimeOrigin::signed(ALICE),
			comit_id,
			evm_payload,
			svm_payload,
			nonce,
			fee,
			prepare_root,
		));

		assert_eq!(Nonces::<Test>::get(ALICE), 1);
	});
}

#[test]
fn submit_comit_rejects_empty_payloads() {
	new_test_ext().execute_with(|| {
		let comit_id = H256::from_low_u64_be(2);
		let fee: Balance = 100;

		assert_noop!(
			AtlasKernel::submit_comit(
				RuntimeOrigin::signed(ALICE),
				comit_id,
				Vec::new(),
				Vec::new(),
				0,
				fee,
				H256::zero(),
			),
			AtlasError::EmptyPayloads
		);

		assert_eq!(Nonces::<Test>::get(ALICE), 0);

		let events = System::events();
		assert_eq!(events.len(), 1);
		match &events[0].event {
			RuntimeEvent::AtlasKernel(AtlasEvent::ComitFailed { comit_id: id, reason }) => {
				assert_eq!(*id, comit_id);
				assert_eq!(*reason, ComitFailureReason::EmptyPayloads);
			},
			e => panic!("Unexpected event: {:?}", e),
		}
	});
}

#[test]
fn submit_comit_rejects_payloads_exceeding_limit() {
	new_test_ext().execute_with(|| {
		let comit_id = H256::from_low_u64_be(4);
		let payload = vec![0u8; 4_097];
		let fee: Balance = 1;

		assert_noop!(
			AtlasKernel::submit_comit(
				RuntimeOrigin::signed(ALICE),
				comit_id,
				payload,
				Vec::new(),
				0,
				fee,
				H256::zero(),
			),
			AtlasError::PayloadTooLarge
		);

		assert_eq!(Nonces::<Test>::get(ALICE), 0);

		let events = System::events();
		assert_eq!(events.len(), 1);
		match &events[0].event {
			RuntimeEvent::AtlasKernel(AtlasEvent::ComitFailed { reason, .. }) => {
				assert_eq!(*reason, ComitFailureReason::PayloadTooLarge);
			},
			e => panic!("Unexpected event: {:?}", e),
		}
	});
}

#[test]
fn submit_comit_rejects_invalid_nonce() {
	new_test_ext().execute_with(|| {
		let comit_id = H256::from_low_u64_be(3);
		let fee: Balance = 100;

		assert_noop!(
			AtlasKernel::submit_comit(
				RuntimeOrigin::signed(ALICE),
				comit_id,
				vec![1],
				vec![1],
				1,
				fee,
				H256::zero(),
			),
			AtlasError::InvalidNonce
		);

		assert_eq!(Nonces::<Test>::get(ALICE), 0);

		let events = System::events();
		assert_eq!(events.len(), 1);
		match &events[0].event {
			RuntimeEvent::AtlasKernel(AtlasEvent::ComitFailed { reason, .. }) => {
				assert_eq!(*reason, ComitFailureReason::InvalidNonce);
			},
			e => panic!("Unexpected event: {:?}", e),
		}
	});
}

#[test]
fn submit_comit_rejects_when_prepare_root_mismatch() {
	new_test_ext().execute_with(|| {
		let comit_id = H256::from_low_u64_be(6);
		let evm_payload = vec![1, 2];
		let svm_payload = vec![3, 4];
		let fee: Balance = 10;
		let correct_root =
			compute_prepare_root(comit_id, &evm_payload, &svm_payload, 0, fee);
		let mismatched_root = H256::from_low_u64_be(999);
		assert_ne!(mismatched_root, correct_root);

		assert_noop!(
			AtlasKernel::submit_comit(
				RuntimeOrigin::signed(ALICE),
				comit_id,
				evm_payload,
				svm_payload,
				0,
				fee,
				mismatched_root,
			),
			AtlasError::ComitVerificationFailed
		);

		assert_eq!(Nonces::<Test>::get(ALICE), 0);

		let events = System::events();
		assert_eq!(events.len(), 1);
		match &events[0].event {
			RuntimeEvent::AtlasKernel(AtlasEvent::ComitFailed { reason, .. }) => {
				assert_eq!(*reason, ComitFailureReason::Verification);
			},
			e => panic!("Unexpected event: {:?}", e),
		}
	});
}

#[test]
fn submit_comit_fails_when_nonce_overflows() {
	new_test_ext().execute_with(|| {
		Nonces::<Test>::insert(ALICE, u64::MAX);
		let comit_id = H256::from_low_u64_be(12);
		let fee: Balance = 1;

		assert_noop!(
			AtlasKernel::submit_comit(
				RuntimeOrigin::signed(ALICE),
				comit_id,
				vec![1],
				vec![1],
				u64::MAX,
				fee,
				H256::zero(),
			),
			AtlasError::NonceOverflow
		);

		assert_eq!(Nonces::<Test>::get(ALICE), u64::MAX);
		assert!(System::events().is_empty());
	});
}

#[test]
fn account_registry_not_updated_on_failed_submission() {
	new_test_ext().execute_with(|| {
		assert!(AccountRegistry::<Test>::get(ALICE).is_none());

		assert_noop!(
			AtlasKernel::submit_comit(
				RuntimeOrigin::signed(ALICE),
				H256::from_low_u64_be(20),
				vec![1],
				vec![2],
				1,
				10,
				H256::zero(),
			),
			AtlasError::InvalidNonce
		);

		assert!(AccountRegistry::<Test>::get(ALICE).is_none());
	});
}

#[test]
fn submit_comit_allows_duplicate_ids_with_sequential_nonces() {
	new_test_ext().execute_with(|| {
		let comit_id = H256::from_low_u64_be(5);
		let fee: Balance = 5;

		assert_ok!(AtlasKernel::submit_comit(
			RuntimeOrigin::signed(ALICE),
			comit_id,
			vec![1],
			vec![2],
			0,
			fee,
			H256::zero(),
		));

		assert_ok!(AtlasKernel::submit_comit(
			RuntimeOrigin::signed(ALICE),
			comit_id,
			vec![1],
			vec![2],
			1,
			fee,
			H256::zero(),
		));

		assert_eq!(Nonces::<Test>::get(ALICE), 2);

		let events: Vec<AtlasEvent> = System::events()
			.into_iter()
			.filter_map(|record| match record.event {
				RuntimeEvent::AtlasKernel(event) => Some(event),
				_ => None,
			})
			.collect();

		let submission_events: Vec<_> = events
			.iter()
			.filter(|event| matches!(event, AtlasEvent::ComitSubmitted { .. }))
			.collect();

		assert_eq!(submission_events.len(), 2);
	});
}

#[test]
fn register_asset_successfully_records_metadata() {
	new_test_ext().execute_with(|| {
		let asset_id: AssetId = 42;
		let symbol = b"ATLAS".to_vec();
		let decimals = 12;

		assert_ok!(AtlasKernel::register_asset(
			RuntimeOrigin::root(),
			asset_id,
			symbol.clone(),
			decimals,
		));

		let stored = AssetRegistry::<Test>::get(asset_id)
			.expect("asset metadata should exist");
		assert_eq!(stored.symbol.into_inner(), symbol);
		assert_eq!(stored.decimals, decimals);

		let events = System::events();
		assert_eq!(events.len(), 1);
		match &events[0].event {
			RuntimeEvent::AtlasKernel(AtlasEvent::AssetRegistered {
				asset_id: emitted_id,
				symbol: emitted_symbol,
				decimals: emitted_decimals,
			}) => {
				assert_eq!(*emitted_id, asset_id);
				assert_eq!(emitted_symbol, &symbol);
				assert_eq!(*emitted_decimals, decimals);
			},
			e => panic!("Unexpected event: {:?}", e),
		}
	});
}

#[test]
fn register_asset_rejects_symbol_exceeding_limit() {
	new_test_ext().execute_with(|| {
		let asset_id: AssetId = 1;
		let long_symbol = vec![b'X'; 17];

		assert_noop!(
			AtlasKernel::register_asset(RuntimeOrigin::root(), asset_id, long_symbol, 12),
			AtlasError::SymbolTooLong
		);

		assert!(AssetRegistry::<Test>::get(asset_id).is_none());
		assert!(System::events().is_empty());
	});
}

#[test]
fn register_asset_prevents_duplicate_entries() {
	new_test_ext().execute_with(|| {
		let asset_id: AssetId = 7;

		assert_ok!(AtlasKernel::register_asset(
			RuntimeOrigin::root(),
			asset_id,
			b"USD".to_vec(),
			6,
		));

		assert_noop!(
			AtlasKernel::register_asset(
				RuntimeOrigin::root(),
				asset_id,
				b"USD".to_vec(),
				6
			),
			AtlasError::AssetAlreadyRegistered
		);

		let events = System::events();
		assert_eq!(events.len(), 1);
	});
}

#[test]
fn update_canonical_balance_succeeds_and_emits_finalization_event() {
	new_test_ext().execute_with(|| {
		let asset_id: AssetId = 9;
		let new_balance: Balance = 777;

		assert_ok!(AtlasKernel::register_asset(
			RuntimeOrigin::root(),
			asset_id,
			b"ETH".to_vec(),
			18,
		));

		System::reset_events();

		let comit_id = H256::from_low_u64_be(77);
		assert_ok!(AtlasKernel::update_canonical_balance(
			RuntimeOrigin::root(),
			BOB,
			asset_id,
			new_balance,
			Some(comit_id),
		));

		let balance = CanonicalLedger::<Test>::get(BOB, &asset_id);
		assert_eq!(balance, new_balance);

		let events = System::events();
		assert_eq!(events.len(), 1);
		match &events[0].event {
			RuntimeEvent::AtlasKernel(AtlasEvent::ComitFinalized { comit_id: emitted_id }) => {
				assert_eq!(*emitted_id, comit_id);
			},
			e => panic!("Unexpected event: {:?}", e),
		}
	});
}

#[test]
fn update_canonical_balance_rejects_unknown_asset() {
	new_test_ext().execute_with(|| {
		let asset_id: AssetId = 99;

		assert_noop!(
			AtlasKernel::update_canonical_balance(
				RuntimeOrigin::root(),
				BOB,
				asset_id,
				10,
				None,
			),
			AtlasError::UnknownAsset
		);

		// With a DoubleMap, we can't easily check if the account is empty,
		// but the fact that the call failed means no balance was updated
		assert!(System::events().is_empty());
	});
}

#[test]
fn update_canonical_balance_without_comit_id_skips_finalization_event() {
	new_test_ext().execute_with(|| {
		let asset_id: AssetId = 10;

		assert_ok!(AtlasKernel::register_asset(
			RuntimeOrigin::root(),
			asset_id,
			b"SOL".to_vec(),
			9,
		));

		System::reset_events();

		let new_balance: Balance = 123;
		assert_ok!(AtlasKernel::update_canonical_balance(
			RuntimeOrigin::root(),
			BOB,
			asset_id,
			new_balance,
			None,
		));

		let balance = CanonicalLedger::<Test>::get(BOB, &asset_id);
		assert_eq!(balance, new_balance);

		assert!(System::events().is_empty());
	});
}

#[test]
fn update_canonical_balance_can_record_zero_balance() {
	new_test_ext().execute_with(|| {
		let asset_id: AssetId = 11;

		assert_ok!(AtlasKernel::register_asset(
			RuntimeOrigin::root(),
			asset_id,
			b"USDC".to_vec(),
			6,
		));

		System::reset_events();

		assert_ok!(AtlasKernel::update_canonical_balance(
			RuntimeOrigin::root(),
			BOB,
			asset_id,
			0,
			None,
		));

		let balance = CanonicalLedger::<Test>::get(BOB, &asset_id);
		assert_eq!(balance, 0);
		assert!(System::events().is_empty());
	});
}

// ============= EDGE CASE & OVERFLOW TESTS =============

#[test]
fn submit_comit_with_max_balance_value() {
	new_test_ext().execute_with(|| {
		let comit_id = H256::from_low_u64_be(100);
		let max_balance: Balance = Balance::MAX;

		assert_ok!(AtlasKernel::submit_comit(
			RuntimeOrigin::signed(ALICE),
			comit_id,
			vec![1],
			vec![2],
			0,
			max_balance,
			H256::zero(),
		));

		assert_eq!(Nonces::<Test>::get(ALICE), 1);
	});
}

#[test]
fn submit_comit_with_very_large_payloads_near_limit() {
	new_test_ext().execute_with(|| {
		let comit_id = H256::from_low_u64_be(101);
		let large_payload = vec![0u8; 4_095];
		let small_payload = vec![1u8; 1];
		let fee: Balance = 1;

		assert_ok!(AtlasKernel::submit_comit(
			RuntimeOrigin::signed(ALICE),
			comit_id,
			large_payload,
			small_payload,
			0,
			fee,
			H256::zero(),
		));

		assert_eq!(Nonces::<Test>::get(ALICE), 1);
	});
}

#[test]
fn submit_comit_both_payloads_at_max_size() {
	new_test_ext().execute_with(|| {
		let comit_id = H256::from_low_u64_be(102);
		let payload = vec![0u8; 4_096];

		assert_ok!(AtlasKernel::submit_comit(
			RuntimeOrigin::signed(ALICE),
			comit_id,
			payload.clone(),
			payload,
			0,
			1,
			H256::zero(),
		));

		assert_eq!(Nonces::<Test>::get(ALICE), 1);
	});
}

#[test]
fn submit_comit_one_payload_empty_one_populated() {
	new_test_ext().execute_with(|| {
		let comit_id = H256::from_low_u64_be(103);

		assert_ok!(AtlasKernel::submit_comit(
			RuntimeOrigin::signed(ALICE),
			comit_id,
			vec![],
			vec![1, 2, 3],
			0,
			1,
			H256::zero(),
		));

		assert_eq!(Nonces::<Test>::get(ALICE), 1);
	});
}

#[test]
fn submit_comit_only_evm_payload() {
	new_test_ext().execute_with(|| {
		let comit_id = H256::from_low_u64_be(104);

		assert_ok!(AtlasKernel::submit_comit(
			RuntimeOrigin::signed(ALICE),
			comit_id,
			vec![9, 8, 7],
			vec![],
			0,
			500,
			H256::zero(),
		));

		assert_eq!(Nonces::<Test>::get(ALICE), 1);
	});
}

#[test]
fn sequential_nonce_increments_per_account() {
	new_test_ext().execute_with(|| {
		let base_id = H256::from_low_u64_be(200);

		for nonce in 0..10 {
			let comit_id = H256::from_low_u64_be(base_id.as_bytes()[0] as u64 + nonce);
			assert_ok!(AtlasKernel::submit_comit(
				RuntimeOrigin::signed(ALICE),
				comit_id,
				vec![1],
				vec![2],
				nonce,
				10,
				H256::zero(),
			));
		}

		assert_eq!(Nonces::<Test>::get(ALICE), 10);
	});
}

#[test]
fn multiple_accounts_independent_nonces() {
	new_test_ext().execute_with(|| {
		let comit_id_alice = H256::from_low_u64_be(1);
		let comit_id_bob = H256::from_low_u64_be(2);

		assert_ok!(AtlasKernel::submit_comit(
			RuntimeOrigin::signed(ALICE),
			comit_id_alice,
			vec![1],
			vec![2],
			0,
			10,
			H256::zero(),
		));

		assert_ok!(AtlasKernel::submit_comit(
			RuntimeOrigin::signed(BOB),
			comit_id_bob,
			vec![3],
			vec![4],
			0,
			20,
			H256::zero(),
		));

		assert_eq!(Nonces::<Test>::get(ALICE), 1);
		assert_eq!(Nonces::<Test>::get(BOB), 1);
	});
}

#[test]
fn prepare_root_zero_hash_accepted_as_bypass() {
	new_test_ext().execute_with(|| {
		let comit_id = H256::from_low_u64_be(500);

		assert_ok!(AtlasKernel::submit_comit(
			RuntimeOrigin::signed(ALICE),
			comit_id,
			vec![1, 2],
			vec![3, 4],
			0,
			100,
			H256::zero(),
		));

		assert_eq!(Nonces::<Test>::get(ALICE), 1);
	});
}

#[test]
fn prepare_root_verification_correct_hash_passes() {
	new_test_ext().execute_with(|| {
		let comit_id = H256::from_low_u64_be(501);
		let evm_payload = vec![10, 20, 30];
		let svm_payload = vec![40, 50];
		let fee: Balance = 555;
		let nonce = 0;
		let correct_root = compute_prepare_root(comit_id, &evm_payload, &svm_payload, nonce, fee);

		assert_ok!(AtlasKernel::submit_comit(
			RuntimeOrigin::signed(ALICE),
			comit_id,
			evm_payload,
			svm_payload,
			nonce,
			fee,
			correct_root,
		));

		assert_eq!(Nonces::<Test>::get(ALICE), 1);
	});
}

#[test]
fn prepare_root_verification_incorrect_hash_fails() {
	new_test_ext().execute_with(|| {
		let comit_id = H256::from_low_u64_be(502);
		let evm_payload = vec![100];
		let svm_payload = vec![200];
		let fee: Balance = 777;
		let wrong_root = H256::from_low_u64_be(9999);

		assert_noop!(
			AtlasKernel::submit_comit(
				RuntimeOrigin::signed(ALICE),
				comit_id,
				evm_payload,
				svm_payload,
				0,
				fee,
				wrong_root,
			),
			AtlasError::ComitVerificationFailed
		);
	});
}

#[test]
fn asset_registry_stores_multiple_assets() {
	new_test_ext().execute_with(|| {
		let assets = vec![
			(1u32, b"ATLAS".to_vec(), 12u8),
			(2u32, b"ETH".to_vec(), 18u8),
			(3u32, b"SOL".to_vec(), 9u8),
			(4u32, b"USDC".to_vec(), 6u8),
		];

		for (id, symbol, decimals) in &assets {
			assert_ok!(AtlasKernel::register_asset(
				RuntimeOrigin::root(),
				*id,
				symbol.clone(),
				*decimals,
			));
		}

		for (id, symbol, decimals) in assets {
			let stored = AssetRegistry::<Test>::get(id).expect("asset should exist");
			assert_eq!(stored.symbol.into_inner(), symbol);
			assert_eq!(stored.decimals, decimals);
		}
	});
}

#[test]
fn canonical_ledger_multiple_assets_per_account() {
	new_test_ext().execute_with(|| {
		let assets = vec![(0u32, 100u128), (1u32, 200u128), (2u32, 300u128)];

		for (asset_id, balance) in &assets {
			assert_ok!(AtlasKernel::register_asset(
				RuntimeOrigin::root(),
				*asset_id,
				format!("ASSET{}", asset_id).into_bytes(),
				6,
			));

			System::reset_events();

			assert_ok!(AtlasKernel::update_canonical_balance(
				RuntimeOrigin::root(),
				ALICE,
				*asset_id,
				*balance,
				None,
			));
		}

		// Verify all assets were registered
		for (asset_id, balance) in assets {
			let stored_balance = CanonicalLedger::<Test>::get(ALICE, &asset_id);
			assert_eq!(stored_balance, balance);
		}
	});
}

#[test]
fn canonical_ledger_update_overwrites_previous_balance() {
	new_test_ext().execute_with(|| {
		let asset_id = 0u32;

		assert_ok!(AtlasKernel::register_asset(
			RuntimeOrigin::root(),
			asset_id,
			b"TEST".to_vec(),
			6,
		));

		assert_ok!(AtlasKernel::update_canonical_balance(
			RuntimeOrigin::root(),
			BOB,
			asset_id,
			100,
			None,
		));

		let balance1 = CanonicalLedger::<Test>::get(BOB, &asset_id);
		assert_eq!(balance1, 100);

		assert_ok!(AtlasKernel::update_canonical_balance(
			RuntimeOrigin::root(),
			BOB,
			asset_id,
			999,
			None,
		));

		let balance2 = CanonicalLedger::<Test>::get(BOB, &asset_id);
		assert_eq!(balance2, 999);
	});
}

#[test]
fn canonical_ledger_max_balance_value() {
	new_test_ext().execute_with(|| {
		let asset_id = 5u32;

		assert_ok!(AtlasKernel::register_asset(
			RuntimeOrigin::root(),
			asset_id,
			b"MAX".to_vec(),
			12,
		));

		assert_ok!(AtlasKernel::update_canonical_balance(
			RuntimeOrigin::root(),
			ALICE,
			asset_id,
			Balance::MAX,
			None,
		));

		let balance = CanonicalLedger::<Test>::get(ALICE, &asset_id);
		assert_eq!(balance, Balance::MAX);
	});
}

#[test]
fn account_registry_created_on_successful_submission() {
	new_test_ext().execute_with(|| {
		assert!(AccountRegistry::<Test>::get(CHARLIE).is_none());

		assert_ok!(AtlasKernel::submit_comit(
			RuntimeOrigin::signed(CHARLIE),
			H256::from_low_u64_be(1),
			vec![1],
			vec![2],
			0,
			1,
			H256::zero(),
		));

		assert_eq!(
			AccountRegistry::<Test>::get(CHARLIE),
			Some(AtlasId::default())
		);
	});
}

#[test]
fn account_registry_not_overwritten_on_repeated_submission() {
	new_test_ext().execute_with(|| {
		let stored_id = AtlasId::default();

		assert_ok!(AtlasKernel::submit_comit(
			RuntimeOrigin::signed(ALICE),
			H256::from_low_u64_be(1),
			vec![1],
			vec![2],
			0,
			1,
			H256::zero(),
		));

		assert_eq!(AccountRegistry::<Test>::get(ALICE), Some(stored_id));

		assert_ok!(AtlasKernel::submit_comit(
			RuntimeOrigin::signed(ALICE),
			H256::from_low_u64_be(2),
			vec![3],
			vec![4],
			1,
			1,
			H256::zero(),
		));

		assert_eq!(AccountRegistry::<Test>::get(ALICE), Some(stored_id));
	});
}

#[test]
fn comit_submission_emits_all_required_event_fields() {
	new_test_ext().execute_with(|| {
		let comit_id = H256::from_low_u64_be(2000);
		let fee: Balance = 12_345;
		let nonce = 5u64;

		assert_ok!(AtlasKernel::submit_comit(
			RuntimeOrigin::signed(ALICE),
			comit_id,
			vec![1, 2, 3, 4, 5],
			vec![6, 7, 8],
			nonce,
			fee,
			H256::zero(),
		));

		let events: Vec<AtlasEvent> = System::events()
			.into_iter()
			.filter_map(|record| match record.event {
				RuntimeEvent::AtlasKernel(event) => Some(event),
				_ => None,
			})
			.collect();

		assert_eq!(events.len(), 1);
		match &events[0] {
			AtlasEvent::ComitSubmitted {
				comit_id: id,
				origin,
				nonce: n,
				fee: f,
			} => {
				assert_eq!(*id, comit_id);
				assert_eq!(*origin, ALICE);
				assert_eq!(*n, nonce);
				assert_eq!(*f, fee);
			},
			_ => panic!("Unexpected event"),
		}
	});
}

#[test]
fn register_asset_rejects_non_root_origin() {
	new_test_ext().execute_with(|| {
		let asset_id: AssetId = 50;

		assert_noop!(
			AtlasKernel::register_asset(
				RuntimeOrigin::signed(ALICE),
				asset_id,
				b"TEST".to_vec(),
				6,
			),
			frame_support::dispatch::DispatchError::BadOrigin
		);

		assert!(AssetRegistry::<Test>::get(asset_id).is_none());
	});
}

#[test]
fn update_canonical_balance_rejects_non_root_origin() {
	new_test_ext().execute_with(|| {
		let asset_id: AssetId = 51;

		assert_ok!(AtlasKernel::register_asset(
			RuntimeOrigin::root(),
			asset_id,
			b"TEST".to_vec(),
			6,
		));

		assert_noop!(
			AtlasKernel::update_canonical_balance(
				RuntimeOrigin::signed(BOB),
				BOB,
				asset_id,
				100,
				None,
			),
			frame_support::dispatch::DispatchError::BadOrigin
		);
	});
}

#[test]
fn comit_failed_event_emitted_on_empty_payloads() {
	new_test_ext().execute_with(|| {
		let comit_id = H256::from_low_u64_be(3000);

		assert_noop!(
			AtlasKernel::submit_comit(
				RuntimeOrigin::signed(ALICE),
				comit_id,
				vec![],
				vec![],
				0,
				1,
				H256::zero(),
			),
			AtlasError::EmptyPayloads
		);

		let events: Vec<AtlasEvent> = System::events()
			.into_iter()
			.filter_map(|record| match record.event {
				RuntimeEvent::AtlasKernel(event) => Some(event),
				_ => None,
			})
			.collect();

		assert_eq!(events.len(), 1);
		match &events[0] {
			AtlasEvent::ComitFailed { comit_id: id, reason } => {
				assert_eq!(*id, comit_id);
				assert_eq!(*reason, ComitFailureReason::EmptyPayloads);
			},
			_ => panic!("Expected ComitFailed event"),
		}
	});
}

#[test]
fn comit_failed_event_emitted_on_invalid_nonce() {
	new_test_ext().execute_with(|| {
		let comit_id = H256::from_low_u64_be(3001);

		assert_noop!(
			AtlasKernel::submit_comit(
				RuntimeOrigin::signed(ALICE),
				comit_id,
				vec![1],
				vec![2],
				5,
				1,
				H256::zero(),
			),
			AtlasError::InvalidNonce
		);

		let events: Vec<AtlasEvent> = System::events()
			.into_iter()
			.filter_map(|record| match record.event {
				RuntimeEvent::AtlasKernel(event) => Some(event),
				_ => None,
			})
			.collect();

		assert_eq!(events.len(), 1);
		match &events[0] {
			AtlasEvent::ComitFailed { comit_id: id, reason } => {
				assert_eq!(*id, comit_id);
				assert_eq!(*reason, ComitFailureReason::InvalidNonce);
			},
			_ => panic!("Expected ComitFailed event"),
		}
	});
}

#[test]
fn asset_symbol_boundary_lengths() {
	new_test_ext().execute_with(|| {
		let max_valid = vec![b'A'; 16];
		let too_long = vec![b'A'; 17];

		assert_ok!(AtlasKernel::register_asset(
			RuntimeOrigin::root(),
			100,
			max_valid,
			12,
		));

		assert_noop!(
			AtlasKernel::register_asset(RuntimeOrigin::root(), 101, too_long, 12),
			AtlasError::SymbolTooLong
		);
	});
}

#[test]
fn asset_registration_emits_correct_metadata() {
	new_test_ext().execute_with(|| {
		let asset_id = 200u32;
		let symbol = b"MYTOKEN".to_vec();
		let decimals = 8u8;

		assert_ok!(AtlasKernel::register_asset(
			RuntimeOrigin::root(),
			asset_id,
			symbol.clone(),
			decimals,
		));

		let events: Vec<AtlasEvent> = System::events()
			.into_iter()
			.filter_map(|record| match record.event {
				RuntimeEvent::AtlasKernel(event) => Some(event),
				_ => None,
			})
			.collect();

		match &events[0] {
			AtlasEvent::AssetRegistered {
				asset_id: id,
				symbol: sym,
				decimals: dec,
			} => {
				assert_eq!(*id, asset_id);
				assert_eq!(sym, &symbol);
				assert_eq!(*dec, decimals);
			},
			_ => panic!("Unexpected event"),
		}
	});
}