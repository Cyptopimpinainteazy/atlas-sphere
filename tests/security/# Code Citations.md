# Code Citations

## License: GPL-3.0
https://github.com/zeitgeistpm/zeitgeist/blob/2d0277bea7ba5796733b1db4db484dc73f30e23c/runtime/src/tests/multiplier.rs

```
Understood. Reading instructions now and resuming **Step 3: freeze/rollback hooks** with proper adherence to repo conventions.

First, checking the **authoritative guidance**:

````bash
cd /home/lojak/Desktop/x3-chain-master
cat openspec/AGENTS.md | head -100
cat AGENTS.md
cat tests/README.md | head -50
cat tests/invariants/registry.toml | grep -A5 "INV-FRAUD"
````

Then regenerating **Step 3** properly:

---

### 1) Update OpenSpec tasks with invariant linking

````md
<!-- filepath: /home/lojak/Desktop/x3-chain-master/openspec/changes/committee-reexec-fraudproofs-v0/tasks.md -->
# Tasks (Updated)

## Spec
- [ ] Finalize `proposal.md`
- [ ] Finalize `design.md`
- [ ] Finalize `witness-encoding-v0.md`
- [ ] Run `openspec validate committee-reexec-fraudproofs-v0 --strict`

## Runtime Implementation (MVP)
- [ ] Add `submit_fraud_proof` extrinsic with deterministic verification
- [ ] Add witness decode + canonical validation (`SchedulerWitnessV1`)
- [ ] Add `set_freeze_ai` / `set_rollback_target` extrinsics (governance-gated)
- [ ] Add `ensure_ai_enabled()` hook for consensus-critical paths
- [ ] Add storage: `FreezeAi`, `RollbackTarget`, `ProofsSeen`, `DisputedBlocks`
- [ ] Implement deterministic graph/order recomputation from witness
- [ ] Integrate with runtime slashing handler

## Tests (linked to invariants)
- [ ] **INV-FRAUD-001**: Valid proof slashes proposer and rewards reporter
- [ ] **INV-FRAUD-002**: Invalid proof rejected deterministically
- [ ] **INV-FRAUD-003**: Replay protection (ProofsSeen)
- [ ] **INV-FRAUD-004**: Bounds enforcement (witness size, access counts)
- [ ] **INV-FRAUD-005**: Canonical tx/access ordering enforced
- [ ] **INV-FRAUD-006**: Witness-bounded verification
- [ ] **INV-FRAUD-007**: Scheduler commitment deterministic recompute
- [ ] **INV-FRAUD-008**: Freeze preserves fraud-proof liveness

## Quality gates (before PR)
- [ ] `cargo fmt --all --check`
- [ ] `cargo clippy --all-targets --all-features -- -D warnings`
- [ ] `cargo test --workspace`
- [ ] `cargo test -p pallet-fraud-proofs`
- [ ] `openspec validate committee-reexec-fraudproofs-v0 --strict`
- [ ] All invariant links verified in registry.toml
````

---

### 2) Proper pallet config with FRAME conventions

````rust
// filepath: /home/lojak/Desktop/x3-chain-master/pallets/fraud-proofs/src/lib.rs
#![cfg_attr(not(feature = "std"), no_std)]

pub use pallet::*;

#[frame_support::pallet]
pub mod pallet {
	use codec::{Compact, Decode, Encode};
	use frame_support::{
		dispatch::DispatchResult,
		pallet_prelude::*,
		traits::Get,
		Blake2_128Concat,
	};
	use frame_system::pallet_prelude::*;
	use scale_info::TypeInfo;
	use sp_core::H256;
	use sp_runtime::traits::Saturating;
	use sp_std::{collections::btree_set::BTreeSet, vec::Vec};

	#[derive(Encode, Decode, Clone, Copy, Eq, PartialEq, RuntimeDebug, TypeInfo, MaxEncodedLen)]
	pub enum ProofType {
		SchedulerMismatchV1 = 1,
	}

	#[derive(Encode, Decode, Clone, Eq, PartialEq, RuntimeDebug, TypeInfo, MaxEncodedLen)]
	pub struct AccessKeyV1 {
		pub domain: u8,
		pub key: H256,
	}

	#[derive(Encode, Decode, Clone, Eq, PartialEq, RuntimeDebug, TypeInfo)]
	pub struct AccessListV1 {
		pub access_count: Compact<u32>,
		pub accesses: Vec<AccessKeyV1>,
	}

	#[derive(Encode, Decode, Clone, Eq, PartialEq, RuntimeDebug, TypeInfo)]
	pub struct SchedulerWitnessV1 {
		pub version: u8,
		pub rules_version: u32,
		pub tx_count: Compact<u32>,
		pub tx_ids: Vec<H256>,
		pub access_lists: Vec<AccessListV1>,
		pub reserved: Vec<u8>,
	}

	#[derive(Encode, Decode, Clone, Eq, PartialEq, RuntimeDebug, TypeInfo)]
	pub struct FraudProof<AccountId, BlockNumber> {
		pub proof_type: ProofType,
		pub block_number: BlockNumber,
		pub block_hash: H256,
		pub tx_set_commitment: H256,
		pub claimed_scheduler_commitment: H256,
		pub reexec_witness: Vec<u8>,
		pub expected_hash: H256,
		pub observed_hash: H256,
		pub reporter: AccountId,
		pub nonce: u64,
	}

	#[derive(Encode, Decode, Clone, Eq, PartialEq, RuntimeDebug, TypeInfo, MaxEncodedLen)]
	pub struct DisputedBlockMeta<AccountId, BlockNumber> {
		pub number: BlockNumber,
		pub proposer: AccountId,
		pub rules_version: u32,
	}

	pub trait SlashHandler<AccountId> {
		fn slash_proposer_and_reward_reporter(proposer: &AccountId, reporter: &AccountId) -> DispatchResult;
	}

	#[pallet::config]
	pub trait Config: frame_system::Config {
		type RuntimeEvent: From<Event<Self>> + IsType<<Self as frame_system::Config>::RuntimeEvent>;

		#[pallet::constant]
		type MaxWitnessBytes: Get<u32>;

		#[pallet::constant]
		type DisputeWindowBlocks: Get<BlockNumberFor<Self>>;

		#[pallet::constant]
		type MaxTxsPerBlock: Get<u32>;

		#[pallet::constant]
		type MaxAccessesPerTx: Get<u32>;

		type SlashHandler: SlashHandler<Self::AccountId>;

		/// Origin allowed to set freeze/rollback state.
		type FreezeOrigin: EnsureOrigin<Self::RuntimeOrigin>;
	}

	#[pallet::pallet]
	pub struct Pallet<T>(_);

	/// Replay protection: proof_id -> ()
	#[pallet::storage]
	pub type ProofsSeen<T: Config> = StorageMap<_, Blake2_128Concat, H256, (), OptionQuery>;

	/// Disputed block metadata.
	#[pallet::storage]
	pub type DisputedBlocks<T: Config> =
		StorageMap<_, Blake2_128Concat, H256, DisputedBlockMeta<T::AccountId, BlockNumberFor<T>>, OptionQuery>;

	/// Scheduler commitments observed in blocks.
	#[pallet::storage]
	pub type SchedulerCommitments<T: Config> = StorageMap<_, Blake2_128Concat, H256, H256, OptionQuery>;

	/// Global freeze flag for AI consensus-critical syscalls.
	#[pallet::storage]
	#[pallet::getter(fn freeze_ai)]
	pub type FreezeAi<T: Config> = StorageValue<_, bool, ValueQuery>;

	#[pallet::error]
	pub enum Error<T> {
		InvalidProofType,
		BlockUnknown,
		OutsideDisputeWindow,
		WitnessTooLarge,
		CommitmentMismatch,
		NotFraudulent,
		ReplayProof,
		ReporterMismatch,
		InvalidWitnessEncoding,
		ClaimedObservedMismatch,
		AiFrozen,
	}

	#[pallet::event]
	#[pallet::generate_deposit(pub(super) fn deposit_event)]
	pub enum Event<T: Config> {
		FraudProofAccepted {
			proof_id: H256,
			block_hash: H256,
			proposer: T::AccountId,
			reporter: T::AccountId,
		},
		FreezeAiSet {
			frozen: bool,
		},
	}

	#[pallet::call]
	impl<T: Config> Pallet<T> {
		/// Submit a fraud proof to dispute a scheduler commitment.
		#[pallet::call_index(0)]
		#[pallet::weight(10_000)]
		pub fn submit_fraud_proof(
			origin: OriginFor<T>,
			proof: FraudProof<T::AccountId, BlockNumberFor<T>>,
		) -> DispatchResult {
			let who = ensure_signed(origin)?;
			ensure!(who == proof.reporter, Error::<T>::ReporterMismatch);

			ensure!(
				matches!(proof.proof_type, ProofType::SchedulerMismatchV1),
				Error::<T>::InvalidProofType
			);
			ensure!(
				(proof.reexec_witness.len() as u32) <= T::MaxWitnessBytes::get(),
				Error::<T>::WitnessTooLarge
			);

			let meta = DisputedBlocks::<T>::get(proof.block_hash).ok_or(Error::<T>::BlockUnknown)?;
			let observed = SchedulerCommitments::<T>::get(proof.block_hash).ok_or(Error::<T>::BlockUnknown)?;

			// Time bound
			let now = <frame_system::Pallet<T>>::block_number();
			let age = now.saturating_sub(meta.number);
			ensure!(age <= T::DisputeWindowBlocks::get(), Error::<T>::OutsideDisputeWindow);

			// Verify claimed == observed
			ensure!(proof.claimed_scheduler_commitment == observed, Error::<T>::ClaimedObservedMismatch);
			ensure!(observed == proof.observed_hash, Error::<T>::CommitmentMismatch);

			// Recompute and check fraud
			let recomputed = Self::recompute_scheduler_commitment_v1(&proof.reexec_witness, meta.rules_version)?;
			ensure!(recomputed == proof.expected_hash, Error::<T>::CommitmentMismatch);
			ensure!(recomputed != observed, Error::<T>::NotFraudulent);

			// Replay check
			let proof_id = Self::proof_id(&proof);
			ensure!(!ProofsSeen::<T>::contains_key(proof_id), Error::<T>::ReplayProof);

			// Slash and reward
			T::SlashHandler::slash_proposer_and_reward_reporter(&meta.proposer, &proof.reporter)?;

			// Mark consumed
			ProofsSeen::<T>::insert(proof_id, ());
			Self::deposit_event(Event::FraudProofAccepted {
				proof_id,
				block_hash: proof.block_hash,
				proposer: meta.proposer,
				reporter: proof.reporter,
			});

			Ok(())
		}

		/// Freeze or unfreeze AI consensus-critical syscalls.
		#[pallet::call_index(10)]
		#[pallet::weight(10_000)]
		pub fn set_freeze_ai(origin: OriginFor<T>, frozen: bool) -> DispatchResult {
			T::FreezeOrigin::ensure_origin(origin)?;
			FreezeAi::<T>::put(frozen);
			Self::deposit_event(Event::FreezeAiSet { frozen });
			Ok(())
		}
	}

	impl<T: Config> Pallet<T> {
		/// Hook for consensus-critical AI paths. Return error if frozen.
		pub fn ensure_ai_enabled() -> Result<(), Error<T>> {
			ensure!(!FreezeAi::<T>::get(), Error::<T>::AiFrozen);
			Ok(())
		}

		pub fn recompute_scheduler_commitment_v1(
			witness_bytes: &[u8],
			expected_rules_version: u32,
		) -> Result<H256, Error<T>> {
			let w = Self::parse_witness_v1(witness_bytes)?;
			Self::validate_canonical_witness_v1(&w, expected_rules_version)?;

			let n = w.tx_ids.len();
			let mut edges: Vec<Vec<usize>> = vec![Vec::new(); n];

			for i in 0..n {
				for j in (i + 1)..n {
					if Self::has_conflict(&w.access_lists[i].accesses, &w.access_lists[j].accesses) {
						edges[i].push(j);
					}
				}
			}

			let graph_bytes = Self::encode_graph(&edges);
			let order = Self::topo_order(&edges, n)?;
			let order_bytes = Self::encode_order(&order);

			let graph_commitment = Self::h(&graph_bytes);
			let order_commitment = Self::h(&order_bytes);
			let tx_set_commitment = Self::h(&w.tx_ids.encode());

			let mut preimage = Vec::new();
			preimage.extend_from_slice(graph_commitment.as_bytes());
			preimage.extend_from_slice(order_commitment.as_bytes());
			preimage.extend_from_slice(tx_set_commitment.as_bytes());
			preimage.extend_from_slice(&w.rules_version.encode());

			Ok(Self::h(&preimage))
		}

		fn parse_witness_v1(bytes: &[u8]) -> Result<SchedulerWitnessV1, Error<T>> {
			ensure!((bytes.len() as u32) <= T::MaxWitnessBytes::get(), Error::<T>::WitnessTooLarge);
			let mut input = bytes;
			let w = SchedulerWitnessV1::decode(&mut input)
				.map_err(|_| Error::<T>::InvalidWitnessEncoding)?;
			ensure!(input.is_empty(), Error::<T>::InvalidWitnessEncoding);
			ensure!(w.version == 1, Error::<T>::InvalidWitnessEncoding);
			Ok(w)
		}

		fn validate_canonical_witness_v1(
			w: &SchedulerWitnessV1,
			expected_rules_version: u32,
		) -> Result<(), Error<T>> {
			ensure!(w.rules_version == expected_rules_version, Error::<T>::InvalidWitnessEncoding);
			let tx_count = w.tx_count.0 as usize;
			ensure!(tx_count == w.tx_ids.len(), Error::<T>::InvalidWitnessEncoding);
			ensure!(tx_count == w.access_lists.len(), Error::<T>::InvalidWitnessEncoding);
			ensure!((tx_count as u32) <= T::MaxTxsPerBlock::get(), Error::<T>::InvalidWitnessEncoding);
			ensure!(w.reserved.is_empty(), Error::<T>::InvalidWitnessEncoding);

			for i in 1..w.tx_ids.len() {
				ensure!(w.tx_ids[i - 1] < w.tx_ids[i], Error::<T>::InvalidWitnessEncoding);
			}

			for al in &w.access_lists {
				let c = al.access_count.0 as usize;
				ensure!(c == al.accesses.len(), Error::<T>::InvalidWitnessEncoding);
				ensure!((c as u32) <= T::MaxAccessesPerTx::get(), Error::<T>::InvalidWitnessEncoding);
				for i in 1..al.accesses.len() {
					ensure!(al.accesses[i - 1] < al.accesses[i], Error::<T>::InvalidWitnessEncoding);
				}
			}
			Ok(())
		}

		fn has_conflict(a: &[AccessKeyV1], b: &[AccessKeyV1]) -> bool {
			let (mut i, mut j) = (0usize, 0usize);
			while i < a.len() && j < b.len() {
				if a[i] == b[j] {
					return true;
				}
				if a[i] < b[j] {
					i += 1;
				} else {
					j += 1;
				}
			}
			false
		}

		fn topo_order(edges: &[Vec<usize>], n: usize) -> Result<Vec<usize>, Error<T>> {
			let mut indeg = vec![0u32; n];
			for outs in edges {
				for &j in outs {
					indeg[j] = indeg[j].saturating_add(1);
				}
			}
			let mut ready = BTreeSet::new();
			for (i, &d) in indeg.iter().enumerate() {
				if d == 0 {
					ready.insert(i);
				}
			}
			let mut out = Vec::with_capacity(n);
			while let Some(&i) = ready.iter().next() {
				ready.remove(&i);
				out.push(i);
				for &j in &edges[i] {
					indeg[j] -= 1;
					if indeg[j] == 0 {
						ready.insert(j);
					}
				}
			}
			ensure!(out.len() == n, Error::<T>::InvalidWitnessEncoding);
			Ok(out)
		}

		fn encode_graph(edges: &[Vec<usize>]) -> Vec<u8> {
			let mut bytes = Compact(edges.len() as u32).encode();
			for outs in edges {
				bytes.extend(Compact(outs.len() as u32).encode());
				for &j in outs {
					bytes.extend(Compact(j as u32).encode());
				}
			}
			bytes
		}

		fn encode_order(order: &[usize]) -> Vec<u8> {
			let mut bytes = Compact(order.len() as u32).encode();
			for &i in order {
				bytes.extend(Compact(i as u32).encode());
			}
			bytes
		}

		fn h(data: &[u8]) -> H256 {
			H256::from(sp_io::hashing::blake2_256(data))
		}

		fn proof_id(proof: &FraudProof<T::AccountId, BlockNumberFor<T>>) -> H256 {
			H256::from(sp_io::hashing::blake2_256(&proof.encode()))
		}
	}
}
````

---

### 3) Tests with proper invariant references

````rust
// filepath: /home/lojak/Desktop/x3-chain-master/pallets/fraud-proofs/src/tests.rs
#[cfg(test)]
mod tests {
	use super::*;
	use crate::mock::*;
	use crate::pallet::{DisputedBlockMeta, Error, FraudProof, ProofType};
	use codec::Encode;
	use frame_support::{assert_noop, assert_ok};
	use sp_core::H256;

	fn mk_hash(b: u8) -> H256 {
		H256::from([b; 32])
	}

	fn witness_bytes(
		tx_ids: Vec<H256>,
		access_lists: Vec<Vec<(u8, H256)>>,
		rules_version: u32,
	) -> Vec<u8> {
		let al = access_lists
			.into_iter()
			.map(|v| {
				let mut sorted = v;
				sorted.sort_by(|a, b| (a.0, a.1).cmp(&(b.0, b.1)));
				AccessListV1 {
					access_count: Compact(sorted.len() as u32),
					accesses: sorted
						.into_iter()
						.map(|(d, k)| AccessKeyV1 { domain: d, key: k })
						.collect(),
				}
			})
			.collect::<Vec<_>>();

		SchedulerWitnessV1 {
			version: 1,
			rules_version,
			tx_count: Compact(tx_ids.len() as u32),
			tx_ids,
			access_lists: al,
			reserved: vec![],
		}
		.encode()
	}

	#[test]
	fn valid_scheduler_mismatch_slashes_proposer() {
		// INV-FRAUD-001
		new_test_ext().execute_with(|| {
			let block_hash = mk_hash(1);
			let witness = witness_bytes(
				vec![mk_hash(1), mk_hash(2)],
				vec![vec![(0, mk_hash(9))], vec![(0, mk_hash(9))]],
				1,
			);

			let expected = FraudProofs::recompute_scheduler_commitment_v1(&witness, 1).unwrap();
			let observed = mk_hash(99);

			DisputedBlocks::<Test>::insert(
				block_hash,
				DisputedBlockMeta { number: 1, proposer: 42, rules_version: 1 },
			);
			SchedulerCommitments::<Test>::insert(block_hash, observed);

			let proof = FraudProof {
				proof_type: ProofType::SchedulerMismatchV1,
				block_number: 1,
				block_hash,
				tx_set_commitment: mk_hash(2),
				claimed_scheduler_commitment: observed,
				reexec_witness: witness,
				expected_hash: expected,
				observed_hash: observed,
				reporter: 7,
				nonce: 0,
			};

			assert_ok!(FraudProofs::submit_fraud_proof(RuntimeOrigin::signed(7), proof));
			SLASH_CALLS.with(|c| assert_eq!(c.borrow().as_slice(), &[(42, 7)]));
		});
	}

	#[test]
	fn invalid_proof_rejected() {
		// INV-FRAUD-002
		new_test_ext().execute_with(|| {
			let block_hash = mk_hash(3);
			let witness = witness_bytes(vec![mk_hash(1)], vec![vec![(0, mk_hash(2))]], 1);

			DisputedBlocks::<Test>::insert(
				block_hash,
				DisputedBlockMeta { number: 1, proposer: 10, rules_version: 1 },
			);
			SchedulerCommitments::<Test>::insert(block_hash, mk_hash(4));

			let proof = FraudProof {
				proof_type: ProofType::SchedulerMismatchV1,
				block_number: 1,
				block_hash,
				tx_set_commitment: mk_hash(5),
				claimed_scheduler_commitment: mk_hash(4),
				reexec_witness: witness,
				expected_hash: mk_hash(8),
				observed_hash: mk_hash(4),
				reporter: 8,
				nonce: 1,
			};

			assert_noop!(
				FraudProofs::submit_fraud_proof(RuntimeOrigin::signed(8), proof),
				Error::<Test>::NotFraudulent
			);

			SLASH_CALLS.with(|c| assert!(c.borrow().is_empty()));
		});
	}

	#[test]
	fn replay_proof_rejected() {
		// INV-FRAUD-003
		new_test_ext().execute_with(|| {
			let block_hash = mk_hash(6);
			let witness =
				witness_bytes(vec![mk_hash(1), mk_hash(2)], vec![vec![(0, mk_hash(9))], vec![(0, mk_hash(9))]],1);

			let expected = FraudProofs::recompute_scheduler_commitment_v1(&witness, 1).unwrap();
			let observed = mk_hash(10);

			DisputedBlocks::<Test>::insert(
				block_hash,
				DisputedBlockMeta { number: 1, proposer: 2, rules_version: 1 },
			);
			SchedulerCommitments::<Test>::insert(block_hash, observed);

			let proof = FraudProof {
				proof_type: ProofType::SchedulerMismatchV1,
				block_number: 1,
				block_hash,
				tx_set_commitment: mk_hash(11),
				claimed_scheduler_commitment: observed,
				reexec_witness: witness,
				expected_hash: expected,
				observed_hash: observed,
				reporter: 3,
				nonce: 7,
			};

			assert_ok!(FraudProofs::submit_fraud_proof(RuntimeOrigin::signed(3), proof.clone()));
			assert_noop!(
				FraudProofs::submit_fraud_proof(RuntimeOrigin::signed(3), proof),
				Error::<Test>::ReplayProof
			);
		});
	}

	#[test]
	fn outside_dispute_window_rejected() {
		// INV-FRAUD-004
		new_test_ext().execute_with(|| {
			let block_hash = mk_hash(12);
			let witness = witness_bytes(
				vec![mk_hash(1), mk_hash(2)],
				vec![vec![(0, mk_hash(9))], vec![(0, mk_hash(9))]],
				1,
			);
			let expected = FraudProofs::recompute_scheduler_commitment_v1(&witness, 1).unwrap();
			let observed = mk_hash(13);

			DisputedBlocks::<Test>::insert(
				block_hash,
				DisputedBlockMeta { number: 1, proposer: 55, rules_version: 1 },
			);
			SchedulerCommitments::<Test>::insert(block_hash, observed);
			System::set_block_number(300);

			let proof = FraudProof {
				proof_type: ProofType::SchedulerMismatchV1,
				block_number: 1,
				block_hash,
				tx_set_commitment: mk_hash(14),
				claimed_scheduler_commitment: observed,
				reexec_witness: witness,
				expected_hash: expected,
				observed_hash: observed,
				reporter: 66,
				nonce: 0,
			};

			assert_noop!(
				FraudProofs::submit_fraud_proof(RuntimeOrigin::signed(66), proof),
				Error::<Test>::OutsideDisputeWindow
			);
		});
	}

	#[test]
	fn witness_too_large_rejected() {
		// INV-FRAUD-004, INV-FRAUD-006
		new_test_ext().execute_with(|| {
			let block_hash = mk_hash(15);

			DisputedBlocks::<Test>::insert(
				block_hash,
				DisputedBlockMeta { number: 1, proposer: 1, rules_version: 1 },
			);
			SchedulerCommitments::<Test>::insert(block_hash, mk_hash(16));

			let proof = FraudProof {
				proof_type: ProofType::SchedulerMismatchV1,
				block_number: 1,
				block_hash,
				tx_set_commitment: mk_hash(17),
				claimed_scheduler_commitment: mk_hash(16),
				reexec_witness: vec![0u8; 2048],
				expected_hash: mk_hash(18),
				observed_hash: mk_hash(16),
				reporter: 9,
				nonce: 0,
			};

			assert_noop!(
				FraudProofs::submit_fraud_proof(RuntimeOrigin::signed(9), proof),
				Error::<Test>::WitnessTooLarge
			);
		});
	}

	#[test]
	fn rejects_noncanonical_tx_ids() {
		// INV-FRAUD-005
		new_test_ext().execute_with(|| {
			let bad = witness_bytes(vec![mk_hash(2), mk_hash(1)], vec![vec![], vec![]], 1);
			let r = FraudProofs::recompute_scheduler_commitment_v1(&bad, 1);
			assert!(matches!(r, Err(Error::<Test>::InvalidWitnessEncoding)));
		});
	}

	#[test]
	fn deterministic_recompute_same_witness() {
		// INV-FRAUD-007
		new_test_ext().execute_with(|| {
			let w = witness_bytes(
				vec![mk_hash(1), mk_hash(2), mk_hash(3)],
				vec![vec![(0, mk_hash(10))], vec![(0, mk_hash(11))], vec![(0, mk_hash(10))]],
				1,
			);

			let a = FraudProofs::recompute_scheduler_commitment_v1(&w, 1).unwrap();
			let b = FraudProofs::recompute_scheduler_commitment_v1(&w, 1).unwrap();
			assert_eq!(a, b);
		});
	}

	#[test]
	fn freeze_ai_toggle() {
		new_test_ext().execute_with(|| {
			assert!(!FraudProofs::freeze_ai());
			assert_ok!(FraudProofs::set_freeze_ai(RuntimeOrigin::root(), true));
			assert!(FraudProofs::freeze_ai());
			assert_ok!(FraudProofs::set_freeze_ai(RuntimeOrigin::root(), false));
			assert!(!FraudProofs::freeze_ai());
		});
	}

	#[test]
	fn freeze_does_not_disable_fraud_proof_path() {
		// INV-FRAUD-008
		new_test_ext().execute_with(|| {
			assert_ok!(FraudProofs::set_freeze_ai(RuntimeOrigin::root(), true));

			let block_hash = mk_hash(1);
			let witness = witness_bytes(
				vec![mk_hash(1), mk_hash(2)],
				vec![vec![(0, mk_hash(9))], vec![(0, mk_hash(9))]],
				1,
			);

			let expected = FraudProofs::recompute_scheduler_commitment_v1(&witness, 1).unwrap();
			let observed = mk_hash(200);

			DisputedBlocks::<Test>::insert(
				block_hash,
				DisputedBlockMeta { number: 1, proposer: 42, rules_version: 1 },
			);
			SchedulerCommitments::<Test>::insert(block_hash, observed);

			let proof = FraudProof {
				proof_type: ProofType::SchedulerMismatchV1,
				block_number: 1,
				block_hash,
				tx_set_commitment: mk_hash(2),
				claimed_scheduler_commitment: observed,
				reexec_witness: witness,
				expected_hash: expected,
				observed_hash: observed,
				reporter: 7,
				nonce: 0,
			};

			assert_ok!(FraudProofs::submit_fraud_proof(RuntimeOrigin::signed(7), proof));
		});
	}
}
````

---

### 4) Mock config

````rust
// filepath: /home/lojak/Desktop/x3-chain-master/pallets/fraud-proofs/src/mock.rs
use crate as pallet_fraud_proofs;
use frame_support::{construct_runtime, parameter_types};
use sp_core::H256;
use sp_runtime::{traits::IdentityLookup, BuildStorage};
use std::cell::RefCell;

type Block = frame_system::mocking::MockBlock<Test>;

thread_local! {
	pub static SLASH_CALLS: RefCell<Vec<(u64, u64)>> = RefCell::new(Vec::new());
}

pub struct MockSlashHandler;
impl pallet_fraud_proofs::pallet::SlashHandler<u64> for MockSlashHandler {
	fn slash_proposer_and_reward_reporter(
		proposer: &u64,
		reporter: &u64,
	) -> frame_support::dispatch::DispatchResult {
		SLASH_CALLS.with(|c| c.borrow_mut().push((*proposer, *reporter)));
		Ok(())
	}
}

construct_runtime!(
	pub enum Test {
		System: frame_system,
		FraudProofs: pallet_fraud_proofs,
	}
);

parameter_types! {
	pub const BlockHashCount: u64 = 250;
	pub const MaxWitnessBytes: u32 = 65536;
	pub const DisputeWindowBlocks: u64 = 256;
	pub const MaxTxsPerBlock: u32 = 1024;
	pub const MaxAccessesPerTx: u32 = 256;
}

impl frame_system::Config for Test {
	type BaseCallFilter = frame_support::traits::Everything;
	type BlockWeights = ();
	type BlockLength = ();
	type RuntimeDbWeight = ();
	type RuntimeOrigin = RuntimeOrigin;
	type RuntimeCall = RuntimeCall;
	type RuntimeEvent = RuntimeEvent;
	type RuntimeTask = ();
	type Nonce = u64;
	type Hash = H256;
	type Hashing = sp_runtime::traits::BlakeTwo256;
	type AccountId = u64;
	type Lookup = IdentityLookup<Self::AccountId>;
	type Block = Block;
	type BlockHashCount = BlockHashCount;
	type Version = ();
	type PalletInfo = PalletInfo;
	type AccountData = ();
	type OnNewAccount = ();
	type OnKilledAccount = ();
	type SystemWeightInfo = ();
	type SS58Prefix = ();
	type OnSetCode = ();
	type MaxConsumers = frame_support::traits::ConstU32<16>;
	type SingleBlock
```


## License: Apache-2.0
https://github.com/Snowfork/snowbridge/blob/24b9d310809d937a83f6891f305b4976445e916a/parachain/pallets/outbound-queue/src/mock.rs

```
Understood. Reading instructions now and resuming **Step 3: freeze/rollback hooks** with proper adherence to repo conventions.

First, checking the **authoritative guidance**:

````bash
cd /home/lojak/Desktop/x3-chain-master
cat openspec/AGENTS.md | head -100
cat AGENTS.md
cat tests/README.md | head -50
cat tests/invariants/registry.toml | grep -A5 "INV-FRAUD"
````

Then regenerating **Step 3** properly:

---

### 1) Update OpenSpec tasks with invariant linking

````md
<!-- filepath: /home/lojak/Desktop/x3-chain-master/openspec/changes/committee-reexec-fraudproofs-v0/tasks.md -->
# Tasks (Updated)

## Spec
- [ ] Finalize `proposal.md`
- [ ] Finalize `design.md`
- [ ] Finalize `witness-encoding-v0.md`
- [ ] Run `openspec validate committee-reexec-fraudproofs-v0 --strict`

## Runtime Implementation (MVP)
- [ ] Add `submit_fraud_proof` extrinsic with deterministic verification
- [ ] Add witness decode + canonical validation (`SchedulerWitnessV1`)
- [ ] Add `set_freeze_ai` / `set_rollback_target` extrinsics (governance-gated)
- [ ] Add `ensure_ai_enabled()` hook for consensus-critical paths
- [ ] Add storage: `FreezeAi`, `RollbackTarget`, `ProofsSeen`, `DisputedBlocks`
- [ ] Implement deterministic graph/order recomputation from witness
- [ ] Integrate with runtime slashing handler

## Tests (linked to invariants)
- [ ] **INV-FRAUD-001**: Valid proof slashes proposer and rewards reporter
- [ ] **INV-FRAUD-002**: Invalid proof rejected deterministically
- [ ] **INV-FRAUD-003**: Replay protection (ProofsSeen)
- [ ] **INV-FRAUD-004**: Bounds enforcement (witness size, access counts)
- [ ] **INV-FRAUD-005**: Canonical tx/access ordering enforced
- [ ] **INV-FRAUD-006**: Witness-bounded verification
- [ ] **INV-FRAUD-007**: Scheduler commitment deterministic recompute
- [ ] **INV-FRAUD-008**: Freeze preserves fraud-proof liveness

## Quality gates (before PR)
- [ ] `cargo fmt --all --check`
- [ ] `cargo clippy --all-targets --all-features -- -D warnings`
- [ ] `cargo test --workspace`
- [ ] `cargo test -p pallet-fraud-proofs`
- [ ] `openspec validate committee-reexec-fraudproofs-v0 --strict`
- [ ] All invariant links verified in registry.toml
````

---

### 2) Proper pallet config with FRAME conventions

````rust
// filepath: /home/lojak/Desktop/x3-chain-master/pallets/fraud-proofs/src/lib.rs
#![cfg_attr(not(feature = "std"), no_std)]

pub use pallet::*;

#[frame_support::pallet]
pub mod pallet {
	use codec::{Compact, Decode, Encode};
	use frame_support::{
		dispatch::DispatchResult,
		pallet_prelude::*,
		traits::Get,
		Blake2_128Concat,
	};
	use frame_system::pallet_prelude::*;
	use scale_info::TypeInfo;
	use sp_core::H256;
	use sp_runtime::traits::Saturating;
	use sp_std::{collections::btree_set::BTreeSet, vec::Vec};

	#[derive(Encode, Decode, Clone, Copy, Eq, PartialEq, RuntimeDebug, TypeInfo, MaxEncodedLen)]
	pub enum ProofType {
		SchedulerMismatchV1 = 1,
	}

	#[derive(Encode, Decode, Clone, Eq, PartialEq, RuntimeDebug, TypeInfo, MaxEncodedLen)]
	pub struct AccessKeyV1 {
		pub domain: u8,
		pub key: H256,
	}

	#[derive(Encode, Decode, Clone, Eq, PartialEq, RuntimeDebug, TypeInfo)]
	pub struct AccessListV1 {
		pub access_count: Compact<u32>,
		pub accesses: Vec<AccessKeyV1>,
	}

	#[derive(Encode, Decode, Clone, Eq, PartialEq, RuntimeDebug, TypeInfo)]
	pub struct SchedulerWitnessV1 {
		pub version: u8,
		pub rules_version: u32,
		pub tx_count: Compact<u32>,
		pub tx_ids: Vec<H256>,
		pub access_lists: Vec<AccessListV1>,
		pub reserved: Vec<u8>,
	}

	#[derive(Encode, Decode, Clone, Eq, PartialEq, RuntimeDebug, TypeInfo)]
	pub struct FraudProof<AccountId, BlockNumber> {
		pub proof_type: ProofType,
		pub block_number: BlockNumber,
		pub block_hash: H256,
		pub tx_set_commitment: H256,
		pub claimed_scheduler_commitment: H256,
		pub reexec_witness: Vec<u8>,
		pub expected_hash: H256,
		pub observed_hash: H256,
		pub reporter: AccountId,
		pub nonce: u64,
	}

	#[derive(Encode, Decode, Clone, Eq, PartialEq, RuntimeDebug, TypeInfo, MaxEncodedLen)]
	pub struct DisputedBlockMeta<AccountId, BlockNumber> {
		pub number: BlockNumber,
		pub proposer: AccountId,
		pub rules_version: u32,
	}

	pub trait SlashHandler<AccountId> {
		fn slash_proposer_and_reward_reporter(proposer: &AccountId, reporter: &AccountId) -> DispatchResult;
	}

	#[pallet::config]
	pub trait Config: frame_system::Config {
		type RuntimeEvent: From<Event<Self>> + IsType<<Self as frame_system::Config>::RuntimeEvent>;

		#[pallet::constant]
		type MaxWitnessBytes: Get<u32>;

		#[pallet::constant]
		type DisputeWindowBlocks: Get<BlockNumberFor<Self>>;

		#[pallet::constant]
		type MaxTxsPerBlock: Get<u32>;

		#[pallet::constant]
		type MaxAccessesPerTx: Get<u32>;

		type SlashHandler: SlashHandler<Self::AccountId>;

		/// Origin allowed to set freeze/rollback state.
		type FreezeOrigin: EnsureOrigin<Self::RuntimeOrigin>;
	}

	#[pallet::pallet]
	pub struct Pallet<T>(_);

	/// Replay protection: proof_id -> ()
	#[pallet::storage]
	pub type ProofsSeen<T: Config> = StorageMap<_, Blake2_128Concat, H256, (), OptionQuery>;

	/// Disputed block metadata.
	#[pallet::storage]
	pub type DisputedBlocks<T: Config> =
		StorageMap<_, Blake2_128Concat, H256, DisputedBlockMeta<T::AccountId, BlockNumberFor<T>>, OptionQuery>;

	/// Scheduler commitments observed in blocks.
	#[pallet::storage]
	pub type SchedulerCommitments<T: Config> = StorageMap<_, Blake2_128Concat, H256, H256, OptionQuery>;

	/// Global freeze flag for AI consensus-critical syscalls.
	#[pallet::storage]
	#[pallet::getter(fn freeze_ai)]
	pub type FreezeAi<T: Config> = StorageValue<_, bool, ValueQuery>;

	#[pallet::error]
	pub enum Error<T> {
		InvalidProofType,
		BlockUnknown,
		OutsideDisputeWindow,
		WitnessTooLarge,
		CommitmentMismatch,
		NotFraudulent,
		ReplayProof,
		ReporterMismatch,
		InvalidWitnessEncoding,
		ClaimedObservedMismatch,
		AiFrozen,
	}

	#[pallet::event]
	#[pallet::generate_deposit(pub(super) fn deposit_event)]
	pub enum Event<T: Config> {
		FraudProofAccepted {
			proof_id: H256,
			block_hash: H256,
			proposer: T::AccountId,
			reporter: T::AccountId,
		},
		FreezeAiSet {
			frozen: bool,
		},
	}

	#[pallet::call]
	impl<T: Config> Pallet<T> {
		/// Submit a fraud proof to dispute a scheduler commitment.
		#[pallet::call_index(0)]
		#[pallet::weight(10_000)]
		pub fn submit_fraud_proof(
			origin: OriginFor<T>,
			proof: FraudProof<T::AccountId, BlockNumberFor<T>>,
		) -> DispatchResult {
			let who = ensure_signed(origin)?;
			ensure!(who == proof.reporter, Error::<T>::ReporterMismatch);

			ensure!(
				matches!(proof.proof_type, ProofType::SchedulerMismatchV1),
				Error::<T>::InvalidProofType
			);
			ensure!(
				(proof.reexec_witness.len() as u32) <= T::MaxWitnessBytes::get(),
				Error::<T>::WitnessTooLarge
			);

			let meta = DisputedBlocks::<T>::get(proof.block_hash).ok_or(Error::<T>::BlockUnknown)?;
			let observed = SchedulerCommitments::<T>::get(proof.block_hash).ok_or(Error::<T>::BlockUnknown)?;

			// Time bound
			let now = <frame_system::Pallet<T>>::block_number();
			let age = now.saturating_sub(meta.number);
			ensure!(age <= T::DisputeWindowBlocks::get(), Error::<T>::OutsideDisputeWindow);

			// Verify claimed == observed
			ensure!(proof.claimed_scheduler_commitment == observed, Error::<T>::ClaimedObservedMismatch);
			ensure!(observed == proof.observed_hash, Error::<T>::CommitmentMismatch);

			// Recompute and check fraud
			let recomputed = Self::recompute_scheduler_commitment_v1(&proof.reexec_witness, meta.rules_version)?;
			ensure!(recomputed == proof.expected_hash, Error::<T>::CommitmentMismatch);
			ensure!(recomputed != observed, Error::<T>::NotFraudulent);

			// Replay check
			let proof_id = Self::proof_id(&proof);
			ensure!(!ProofsSeen::<T>::contains_key(proof_id), Error::<T>::ReplayProof);

			// Slash and reward
			T::SlashHandler::slash_proposer_and_reward_reporter(&meta.proposer, &proof.reporter)?;

			// Mark consumed
			ProofsSeen::<T>::insert(proof_id, ());
			Self::deposit_event(Event::FraudProofAccepted {
				proof_id,
				block_hash: proof.block_hash,
				proposer: meta.proposer,
				reporter: proof.reporter,
			});

			Ok(())
		}

		/// Freeze or unfreeze AI consensus-critical syscalls.
		#[pallet::call_index(10)]
		#[pallet::weight(10_000)]
		pub fn set_freeze_ai(origin: OriginFor<T>, frozen: bool) -> DispatchResult {
			T::FreezeOrigin::ensure_origin(origin)?;
			FreezeAi::<T>::put(frozen);
			Self::deposit_event(Event::FreezeAiSet { frozen });
			Ok(())
		}
	}

	impl<T: Config> Pallet<T> {
		/// Hook for consensus-critical AI paths. Return error if frozen.
		pub fn ensure_ai_enabled() -> Result<(), Error<T>> {
			ensure!(!FreezeAi::<T>::get(), Error::<T>::AiFrozen);
			Ok(())
		}

		pub fn recompute_scheduler_commitment_v1(
			witness_bytes: &[u8],
			expected_rules_version: u32,
		) -> Result<H256, Error<T>> {
			let w = Self::parse_witness_v1(witness_bytes)?;
			Self::validate_canonical_witness_v1(&w, expected_rules_version)?;

			let n = w.tx_ids.len();
			let mut edges: Vec<Vec<usize>> = vec![Vec::new(); n];

			for i in 0..n {
				for j in (i + 1)..n {
					if Self::has_conflict(&w.access_lists[i].accesses, &w.access_lists[j].accesses) {
						edges[i].push(j);
					}
				}
			}

			let graph_bytes = Self::encode_graph(&edges);
			let order = Self::topo_order(&edges, n)?;
			let order_bytes = Self::encode_order(&order);

			let graph_commitment = Self::h(&graph_bytes);
			let order_commitment = Self::h(&order_bytes);
			let tx_set_commitment = Self::h(&w.tx_ids.encode());

			let mut preimage = Vec::new();
			preimage.extend_from_slice(graph_commitment.as_bytes());
			preimage.extend_from_slice(order_commitment.as_bytes());
			preimage.extend_from_slice(tx_set_commitment.as_bytes());
			preimage.extend_from_slice(&w.rules_version.encode());

			Ok(Self::h(&preimage))
		}

		fn parse_witness_v1(bytes: &[u8]) -> Result<SchedulerWitnessV1, Error<T>> {
			ensure!((bytes.len() as u32) <= T::MaxWitnessBytes::get(), Error::<T>::WitnessTooLarge);
			let mut input = bytes;
			let w = SchedulerWitnessV1::decode(&mut input)
				.map_err(|_| Error::<T>::InvalidWitnessEncoding)?;
			ensure!(input.is_empty(), Error::<T>::InvalidWitnessEncoding);
			ensure!(w.version == 1, Error::<T>::InvalidWitnessEncoding);
			Ok(w)
		}

		fn validate_canonical_witness_v1(
			w: &SchedulerWitnessV1,
			expected_rules_version: u32,
		) -> Result<(), Error<T>> {
			ensure!(w.rules_version == expected_rules_version, Error::<T>::InvalidWitnessEncoding);
			let tx_count = w.tx_count.0 as usize;
			ensure!(tx_count == w.tx_ids.len(), Error::<T>::InvalidWitnessEncoding);
			ensure!(tx_count == w.access_lists.len(), Error::<T>::InvalidWitnessEncoding);
			ensure!((tx_count as u32) <= T::MaxTxsPerBlock::get(), Error::<T>::InvalidWitnessEncoding);
			ensure!(w.reserved.is_empty(), Error::<T>::InvalidWitnessEncoding);

			for i in 1..w.tx_ids.len() {
				ensure!(w.tx_ids[i - 1] < w.tx_ids[i], Error::<T>::InvalidWitnessEncoding);
			}

			for al in &w.access_lists {
				let c = al.access_count.0 as usize;
				ensure!(c == al.accesses.len(), Error::<T>::InvalidWitnessEncoding);
				ensure!((c as u32) <= T::MaxAccessesPerTx::get(), Error::<T>::InvalidWitnessEncoding);
				for i in 1..al.accesses.len() {
					ensure!(al.accesses[i - 1] < al.accesses[i], Error::<T>::InvalidWitnessEncoding);
				}
			}
			Ok(())
		}

		fn has_conflict(a: &[AccessKeyV1], b: &[AccessKeyV1]) -> bool {
			let (mut i, mut j) = (0usize, 0usize);
			while i < a.len() && j < b.len() {
				if a[i] == b[j] {
					return true;
				}
				if a[i] < b[j] {
					i += 1;
				} else {
					j += 1;
				}
			}
			false
		}

		fn topo_order(edges: &[Vec<usize>], n: usize) -> Result<Vec<usize>, Error<T>> {
			let mut indeg = vec![0u32; n];
			for outs in edges {
				for &j in outs {
					indeg[j] = indeg[j].saturating_add(1);
				}
			}
			let mut ready = BTreeSet::new();
			for (i, &d) in indeg.iter().enumerate() {
				if d == 0 {
					ready.insert(i);
				}
			}
			let mut out = Vec::with_capacity(n);
			while let Some(&i) = ready.iter().next() {
				ready.remove(&i);
				out.push(i);
				for &j in &edges[i] {
					indeg[j] -= 1;
					if indeg[j] == 0 {
						ready.insert(j);
					}
				}
			}
			ensure!(out.len() == n, Error::<T>::InvalidWitnessEncoding);
			Ok(out)
		}

		fn encode_graph(edges: &[Vec<usize>]) -> Vec<u8> {
			let mut bytes = Compact(edges.len() as u32).encode();
			for outs in edges {
				bytes.extend(Compact(outs.len() as u32).encode());
				for &j in outs {
					bytes.extend(Compact(j as u32).encode());
				}
			}
			bytes
		}

		fn encode_order(order: &[usize]) -> Vec<u8> {
			let mut bytes = Compact(order.len() as u32).encode();
			for &i in order {
				bytes.extend(Compact(i as u32).encode());
			}
			bytes
		}

		fn h(data: &[u8]) -> H256 {
			H256::from(sp_io::hashing::blake2_256(data))
		}

		fn proof_id(proof: &FraudProof<T::AccountId, BlockNumberFor<T>>) -> H256 {
			H256::from(sp_io::hashing::blake2_256(&proof.encode()))
		}
	}
}
````

---

### 3) Tests with proper invariant references

````rust
// filepath: /home/lojak/Desktop/x3-chain-master/pallets/fraud-proofs/src/tests.rs
#[cfg(test)]
mod tests {
	use super::*;
	use crate::mock::*;
	use crate::pallet::{DisputedBlockMeta, Error, FraudProof, ProofType};
	use codec::Encode;
	use frame_support::{assert_noop, assert_ok};
	use sp_core::H256;

	fn mk_hash(b: u8) -> H256 {
		H256::from([b; 32])
	}

	fn witness_bytes(
		tx_ids: Vec<H256>,
		access_lists: Vec<Vec<(u8, H256)>>,
		rules_version: u32,
	) -> Vec<u8> {
		let al = access_lists
			.into_iter()
			.map(|v| {
				let mut sorted = v;
				sorted.sort_by(|a, b| (a.0, a.1).cmp(&(b.0, b.1)));
				AccessListV1 {
					access_count: Compact(sorted.len() as u32),
					accesses: sorted
						.into_iter()
						.map(|(d, k)| AccessKeyV1 { domain: d, key: k })
						.collect(),
				}
			})
			.collect::<Vec<_>>();

		SchedulerWitnessV1 {
			version: 1,
			rules_version,
			tx_count: Compact(tx_ids.len() as u32),
			tx_ids,
			access_lists: al,
			reserved: vec![],
		}
		.encode()
	}

	#[test]
	fn valid_scheduler_mismatch_slashes_proposer() {
		// INV-FRAUD-001
		new_test_ext().execute_with(|| {
			let block_hash = mk_hash(1);
			let witness = witness_bytes(
				vec![mk_hash(1), mk_hash(2)],
				vec![vec![(0, mk_hash(9))], vec![(0, mk_hash(9))]],
				1,
			);

			let expected = FraudProofs::recompute_scheduler_commitment_v1(&witness, 1).unwrap();
			let observed = mk_hash(99);

			DisputedBlocks::<Test>::insert(
				block_hash,
				DisputedBlockMeta { number: 1, proposer: 42, rules_version: 1 },
			);
			SchedulerCommitments::<Test>::insert(block_hash, observed);

			let proof = FraudProof {
				proof_type: ProofType::SchedulerMismatchV1,
				block_number: 1,
				block_hash,
				tx_set_commitment: mk_hash(2),
				claimed_scheduler_commitment: observed,
				reexec_witness: witness,
				expected_hash: expected,
				observed_hash: observed,
				reporter: 7,
				nonce: 0,
			};

			assert_ok!(FraudProofs::submit_fraud_proof(RuntimeOrigin::signed(7), proof));
			SLASH_CALLS.with(|c| assert_eq!(c.borrow().as_slice(), &[(42, 7)]));
		});
	}

	#[test]
	fn invalid_proof_rejected() {
		// INV-FRAUD-002
		new_test_ext().execute_with(|| {
			let block_hash = mk_hash(3);
			let witness = witness_bytes(vec![mk_hash(1)], vec![vec![(0, mk_hash(2))]], 1);

			DisputedBlocks::<Test>::insert(
				block_hash,
				DisputedBlockMeta { number: 1, proposer: 10, rules_version: 1 },
			);
			SchedulerCommitments::<Test>::insert(block_hash, mk_hash(4));

			let proof = FraudProof {
				proof_type: ProofType::SchedulerMismatchV1,
				block_number: 1,
				block_hash,
				tx_set_commitment: mk_hash(5),
				claimed_scheduler_commitment: mk_hash(4),
				reexec_witness: witness,
				expected_hash: mk_hash(8),
				observed_hash: mk_hash(4),
				reporter: 8,
				nonce: 1,
			};

			assert_noop!(
				FraudProofs::submit_fraud_proof(RuntimeOrigin::signed(8), proof),
				Error::<Test>::NotFraudulent
			);

			SLASH_CALLS.with(|c| assert!(c.borrow().is_empty()));
		});
	}

	#[test]
	fn replay_proof_rejected() {
		// INV-FRAUD-003
		new_test_ext().execute_with(|| {
			let block_hash = mk_hash(6);
			let witness =
				witness_bytes(vec![mk_hash(1), mk_hash(2)], vec![vec![(0, mk_hash(9))], vec![(0, mk_hash(9))]],1);

			let expected = FraudProofs::recompute_scheduler_commitment_v1(&witness, 1).unwrap();
			let observed = mk_hash(10);

			DisputedBlocks::<Test>::insert(
				block_hash,
				DisputedBlockMeta { number: 1, proposer: 2, rules_version: 1 },
			);
			SchedulerCommitments::<Test>::insert(block_hash, observed);

			let proof = FraudProof {
				proof_type: ProofType::SchedulerMismatchV1,
				block_number: 1,
				block_hash,
				tx_set_commitment: mk_hash(11),
				claimed_scheduler_commitment: observed,
				reexec_witness: witness,
				expected_hash: expected,
				observed_hash: observed,
				reporter: 3,
				nonce: 7,
			};

			assert_ok!(FraudProofs::submit_fraud_proof(RuntimeOrigin::signed(3), proof.clone()));
			assert_noop!(
				FraudProofs::submit_fraud_proof(RuntimeOrigin::signed(3), proof),
				Error::<Test>::ReplayProof
			);
		});
	}

	#[test]
	fn outside_dispute_window_rejected() {
		// INV-FRAUD-004
		new_test_ext().execute_with(|| {
			let block_hash = mk_hash(12);
			let witness = witness_bytes(
				vec![mk_hash(1), mk_hash(2)],
				vec![vec![(0, mk_hash(9))], vec![(0, mk_hash(9))]],
				1,
			);
			let expected = FraudProofs::recompute_scheduler_commitment_v1(&witness, 1).unwrap();
			let observed = mk_hash(13);

			DisputedBlocks::<Test>::insert(
				block_hash,
				DisputedBlockMeta { number: 1, proposer: 55, rules_version: 1 },
			);
			SchedulerCommitments::<Test>::insert(block_hash, observed);
			System::set_block_number(300);

			let proof = FraudProof {
				proof_type: ProofType::SchedulerMismatchV1,
				block_number: 1,
				block_hash,
				tx_set_commitment: mk_hash(14),
				claimed_scheduler_commitment: observed,
				reexec_witness: witness,
				expected_hash: expected,
				observed_hash: observed,
				reporter: 66,
				nonce: 0,
			};

			assert_noop!(
				FraudProofs::submit_fraud_proof(RuntimeOrigin::signed(66), proof),
				Error::<Test>::OutsideDisputeWindow
			);
		});
	}

	#[test]
	fn witness_too_large_rejected() {
		// INV-FRAUD-004, INV-FRAUD-006
		new_test_ext().execute_with(|| {
			let block_hash = mk_hash(15);

			DisputedBlocks::<Test>::insert(
				block_hash,
				DisputedBlockMeta { number: 1, proposer: 1, rules_version: 1 },
			);
			SchedulerCommitments::<Test>::insert(block_hash, mk_hash(16));

			let proof = FraudProof {
				proof_type: ProofType::SchedulerMismatchV1,
				block_number: 1,
				block_hash,
				tx_set_commitment: mk_hash(17),
				claimed_scheduler_commitment: mk_hash(16),
				reexec_witness: vec![0u8; 2048],
				expected_hash: mk_hash(18),
				observed_hash: mk_hash(16),
				reporter: 9,
				nonce: 0,
			};

			assert_noop!(
				FraudProofs::submit_fraud_proof(RuntimeOrigin::signed(9), proof),
				Error::<Test>::WitnessTooLarge
			);
		});
	}

	#[test]
	fn rejects_noncanonical_tx_ids() {
		// INV-FRAUD-005
		new_test_ext().execute_with(|| {
			let bad = witness_bytes(vec![mk_hash(2), mk_hash(1)], vec![vec![], vec![]], 1);
			let r = FraudProofs::recompute_scheduler_commitment_v1(&bad, 1);
			assert!(matches!(r, Err(Error::<Test>::InvalidWitnessEncoding)));
		});
	}

	#[test]
	fn deterministic_recompute_same_witness() {
		// INV-FRAUD-007
		new_test_ext().execute_with(|| {
			let w = witness_bytes(
				vec![mk_hash(1), mk_hash(2), mk_hash(3)],
				vec![vec![(0, mk_hash(10))], vec![(0, mk_hash(11))], vec![(0, mk_hash(10))]],
				1,
			);

			let a = FraudProofs::recompute_scheduler_commitment_v1(&w, 1).unwrap();
			let b = FraudProofs::recompute_scheduler_commitment_v1(&w, 1).unwrap();
			assert_eq!(a, b);
		});
	}

	#[test]
	fn freeze_ai_toggle() {
		new_test_ext().execute_with(|| {
			assert!(!FraudProofs::freeze_ai());
			assert_ok!(FraudProofs::set_freeze_ai(RuntimeOrigin::root(), true));
			assert!(FraudProofs::freeze_ai());
			assert_ok!(FraudProofs::set_freeze_ai(RuntimeOrigin::root(), false));
			assert!(!FraudProofs::freeze_ai());
		});
	}

	#[test]
	fn freeze_does_not_disable_fraud_proof_path() {
		// INV-FRAUD-008
		new_test_ext().execute_with(|| {
			assert_ok!(FraudProofs::set_freeze_ai(RuntimeOrigin::root(), true));

			let block_hash = mk_hash(1);
			let witness = witness_bytes(
				vec![mk_hash(1), mk_hash(2)],
				vec![vec![(0, mk_hash(9))], vec![(0, mk_hash(9))]],
				1,
			);

			let expected = FraudProofs::recompute_scheduler_commitment_v1(&witness, 1).unwrap();
			let observed = mk_hash(200);

			DisputedBlocks::<Test>::insert(
				block_hash,
				DisputedBlockMeta { number: 1, proposer: 42, rules_version: 1 },
			);
			SchedulerCommitments::<Test>::insert(block_hash, observed);

			let proof = FraudProof {
				proof_type: ProofType::SchedulerMismatchV1,
				block_number: 1,
				block_hash,
				tx_set_commitment: mk_hash(2),
				claimed_scheduler_commitment: observed,
				reexec_witness: witness,
				expected_hash: expected,
				observed_hash: observed,
				reporter: 7,
				nonce: 0,
			};

			assert_ok!(FraudProofs::submit_fraud_proof(RuntimeOrigin::signed(7), proof));
		});
	}
}
````

---

### 4) Mock config

````rust
// filepath: /home/lojak/Desktop/x3-chain-master/pallets/fraud-proofs/src/mock.rs
use crate as pallet_fraud_proofs;
use frame_support::{construct_runtime, parameter_types};
use sp_core::H256;
use sp_runtime::{traits::IdentityLookup, BuildStorage};
use std::cell::RefCell;

type Block = frame_system::mocking::MockBlock<Test>;

thread_local! {
	pub static SLASH_CALLS: RefCell<Vec<(u64, u64)>> = RefCell::new(Vec::new());
}

pub struct MockSlashHandler;
impl pallet_fraud_proofs::pallet::SlashHandler<u64> for MockSlashHandler {
	fn slash_proposer_and_reward_reporter(
		proposer: &u64,
		reporter: &u64,
	) -> frame_support::dispatch::DispatchResult {
		SLASH_CALLS.with(|c| c.borrow_mut().push((*proposer, *reporter)));
		Ok(())
	}
}

construct_runtime!(
	pub enum Test {
		System: frame_system,
		FraudProofs: pallet_fraud_proofs,
	}
);

parameter_types! {
	pub const BlockHashCount: u64 = 250;
	pub const MaxWitnessBytes: u32 = 65536;
	pub const DisputeWindowBlocks: u64 = 256;
	pub const MaxTxsPerBlock: u32 = 1024;
	pub const MaxAccessesPerTx: u32 = 256;
}

impl frame_system::Config for Test {
	type BaseCallFilter = frame_support::traits::Everything;
	type BlockWeights = ();
	type BlockLength = ();
	type RuntimeDbWeight = ();
	type RuntimeOrigin = RuntimeOrigin;
	type RuntimeCall = RuntimeCall;
	type RuntimeEvent = RuntimeEvent;
	type RuntimeTask = ();
	type Nonce = u64;
	type Hash = H256;
	type Hashing = sp_runtime::traits::BlakeTwo256;
	type AccountId = u64;
	type Lookup = IdentityLookup<Self::AccountId>;
	type Block = Block;
	type BlockHashCount = BlockHashCount;
	type Version = ();
	type PalletInfo = PalletInfo;
	type AccountData = ();
	type OnNewAccount = ();
	type OnKilledAccount = ();
	type SystemWeightInfo = ();
	type SS58Prefix = ();
	type OnSetCode = ();
	type MaxConsumers = frame_support::traits::ConstU32<16>;
	type SingleBlockMigrations = ();
	type MultiBlockMigrator = ();
	type PreInherents = ();
	type Post
```


## License: GPL-3.0
https://github.com/zeitgeistpm/zeitgeist/blob/2d0277bea7ba5796733b1db4db484dc73f30e23c/runtime/src/tests/multiplier.rs

```
Understood. Reading instructions now and resuming **Step 3: freeze/rollback hooks** with proper adherence to repo conventions.

First, checking the **authoritative guidance**:

````bash
cd /home/lojak/Desktop/x3-chain-master
cat openspec/AGENTS.md | head -100
cat AGENTS.md
cat tests/README.md | head -50
cat tests/invariants/registry.toml | grep -A5 "INV-FRAUD"
````

Then regenerating **Step 3** properly:

---

### 1) Update OpenSpec tasks with invariant linking

````md
<!-- filepath: /home/lojak/Desktop/x3-chain-master/openspec/changes/committee-reexec-fraudproofs-v0/tasks.md -->
# Tasks (Updated)

## Spec
- [ ] Finalize `proposal.md`
- [ ] Finalize `design.md`
- [ ] Finalize `witness-encoding-v0.md`
- [ ] Run `openspec validate committee-reexec-fraudproofs-v0 --strict`

## Runtime Implementation (MVP)
- [ ] Add `submit_fraud_proof` extrinsic with deterministic verification
- [ ] Add witness decode + canonical validation (`SchedulerWitnessV1`)
- [ ] Add `set_freeze_ai` / `set_rollback_target` extrinsics (governance-gated)
- [ ] Add `ensure_ai_enabled()` hook for consensus-critical paths
- [ ] Add storage: `FreezeAi`, `RollbackTarget`, `ProofsSeen`, `DisputedBlocks`
- [ ] Implement deterministic graph/order recomputation from witness
- [ ] Integrate with runtime slashing handler

## Tests (linked to invariants)
- [ ] **INV-FRAUD-001**: Valid proof slashes proposer and rewards reporter
- [ ] **INV-FRAUD-002**: Invalid proof rejected deterministically
- [ ] **INV-FRAUD-003**: Replay protection (ProofsSeen)
- [ ] **INV-FRAUD-004**: Bounds enforcement (witness size, access counts)
- [ ] **INV-FRAUD-005**: Canonical tx/access ordering enforced
- [ ] **INV-FRAUD-006**: Witness-bounded verification
- [ ] **INV-FRAUD-007**: Scheduler commitment deterministic recompute
- [ ] **INV-FRAUD-008**: Freeze preserves fraud-proof liveness

## Quality gates (before PR)
- [ ] `cargo fmt --all --check`
- [ ] `cargo clippy --all-targets --all-features -- -D warnings`
- [ ] `cargo test --workspace`
- [ ] `cargo test -p pallet-fraud-proofs`
- [ ] `openspec validate committee-reexec-fraudproofs-v0 --strict`
- [ ] All invariant links verified in registry.toml
````

---

### 2) Proper pallet config with FRAME conventions

````rust
// filepath: /home/lojak/Desktop/x3-chain-master/pallets/fraud-proofs/src/lib.rs
#![cfg_attr(not(feature = "std"), no_std)]

pub use pallet::*;

#[frame_support::pallet]
pub mod pallet {
	use codec::{Compact, Decode, Encode};
	use frame_support::{
		dispatch::DispatchResult,
		pallet_prelude::*,
		traits::Get,
		Blake2_128Concat,
	};
	use frame_system::pallet_prelude::*;
	use scale_info::TypeInfo;
	use sp_core::H256;
	use sp_runtime::traits::Saturating;
	use sp_std::{collections::btree_set::BTreeSet, vec::Vec};

	#[derive(Encode, Decode, Clone, Copy, Eq, PartialEq, RuntimeDebug, TypeInfo, MaxEncodedLen)]
	pub enum ProofType {
		SchedulerMismatchV1 = 1,
	}

	#[derive(Encode, Decode, Clone, Eq, PartialEq, RuntimeDebug, TypeInfo, MaxEncodedLen)]
	pub struct AccessKeyV1 {
		pub domain: u8,
		pub key: H256,
	}

	#[derive(Encode, Decode, Clone, Eq, PartialEq, RuntimeDebug, TypeInfo)]
	pub struct AccessListV1 {
		pub access_count: Compact<u32>,
		pub accesses: Vec<AccessKeyV1>,
	}

	#[derive(Encode, Decode, Clone, Eq, PartialEq, RuntimeDebug, TypeInfo)]
	pub struct SchedulerWitnessV1 {
		pub version: u8,
		pub rules_version: u32,
		pub tx_count: Compact<u32>,
		pub tx_ids: Vec<H256>,
		pub access_lists: Vec<AccessListV1>,
		pub reserved: Vec<u8>,
	}

	#[derive(Encode, Decode, Clone, Eq, PartialEq, RuntimeDebug, TypeInfo)]
	pub struct FraudProof<AccountId, BlockNumber> {
		pub proof_type: ProofType,
		pub block_number: BlockNumber,
		pub block_hash: H256,
		pub tx_set_commitment: H256,
		pub claimed_scheduler_commitment: H256,
		pub reexec_witness: Vec<u8>,
		pub expected_hash: H256,
		pub observed_hash: H256,
		pub reporter: AccountId,
		pub nonce: u64,
	}

	#[derive(Encode, Decode, Clone, Eq, PartialEq, RuntimeDebug, TypeInfo, MaxEncodedLen)]
	pub struct DisputedBlockMeta<AccountId, BlockNumber> {
		pub number: BlockNumber,
		pub proposer: AccountId,
		pub rules_version: u32,
	}

	pub trait SlashHandler<AccountId> {
		fn slash_proposer_and_reward_reporter(proposer: &AccountId, reporter: &AccountId) -> DispatchResult;
	}

	#[pallet::config]
	pub trait Config: frame_system::Config {
		type RuntimeEvent: From<Event<Self>> + IsType<<Self as frame_system::Config>::RuntimeEvent>;

		#[pallet::constant]
		type MaxWitnessBytes: Get<u32>;

		#[pallet::constant]
		type DisputeWindowBlocks: Get<BlockNumberFor<Self>>;

		#[pallet::constant]
		type MaxTxsPerBlock: Get<u32>;

		#[pallet::constant]
		type MaxAccessesPerTx: Get<u32>;

		type SlashHandler: SlashHandler<Self::AccountId>;

		/// Origin allowed to set freeze/rollback state.
		type FreezeOrigin: EnsureOrigin<Self::RuntimeOrigin>;
	}

	#[pallet::pallet]
	pub struct Pallet<T>(_);

	/// Replay protection: proof_id -> ()
	#[pallet::storage]
	pub type ProofsSeen<T: Config> = StorageMap<_, Blake2_128Concat, H256, (), OptionQuery>;

	/// Disputed block metadata.
	#[pallet::storage]
	pub type DisputedBlocks<T: Config> =
		StorageMap<_, Blake2_128Concat, H256, DisputedBlockMeta<T::AccountId, BlockNumberFor<T>>, OptionQuery>;

	/// Scheduler commitments observed in blocks.
	#[pallet::storage]
	pub type SchedulerCommitments<T: Config> = StorageMap<_, Blake2_128Concat, H256, H256, OptionQuery>;

	/// Global freeze flag for AI consensus-critical syscalls.
	#[pallet::storage]
	#[pallet::getter(fn freeze_ai)]
	pub type FreezeAi<T: Config> = StorageValue<_, bool, ValueQuery>;

	#[pallet::error]
	pub enum Error<T> {
		InvalidProofType,
		BlockUnknown,
		OutsideDisputeWindow,
		WitnessTooLarge,
		CommitmentMismatch,
		NotFraudulent,
		ReplayProof,
		ReporterMismatch,
		InvalidWitnessEncoding,
		ClaimedObservedMismatch,
		AiFrozen,
	}

	#[pallet::event]
	#[pallet::generate_deposit(pub(super) fn deposit_event)]
	pub enum Event<T: Config> {
		FraudProofAccepted {
			proof_id: H256,
			block_hash: H256,
			proposer: T::AccountId,
			reporter: T::AccountId,
		},
		FreezeAiSet {
			frozen: bool,
		},
	}

	#[pallet::call]
	impl<T: Config> Pallet<T> {
		/// Submit a fraud proof to dispute a scheduler commitment.
		#[pallet::call_index(0)]
		#[pallet::weight(10_000)]
		pub fn submit_fraud_proof(
			origin: OriginFor<T>,
			proof: FraudProof<T::AccountId, BlockNumberFor<T>>,
		) -> DispatchResult {
			let who = ensure_signed(origin)?;
			ensure!(who == proof.reporter, Error::<T>::ReporterMismatch);

			ensure!(
				matches!(proof.proof_type, ProofType::SchedulerMismatchV1),
				Error::<T>::InvalidProofType
			);
			ensure!(
				(proof.reexec_witness.len() as u32) <= T::MaxWitnessBytes::get(),
				Error::<T>::WitnessTooLarge
			);

			let meta = DisputedBlocks::<T>::get(proof.block_hash).ok_or(Error::<T>::BlockUnknown)?;
			let observed = SchedulerCommitments::<T>::get(proof.block_hash).ok_or(Error::<T>::BlockUnknown)?;

			// Time bound
			let now = <frame_system::Pallet<T>>::block_number();
			let age = now.saturating_sub(meta.number);
			ensure!(age <= T::DisputeWindowBlocks::get(), Error::<T>::OutsideDisputeWindow);

			// Verify claimed == observed
			ensure!(proof.claimed_scheduler_commitment == observed, Error::<T>::ClaimedObservedMismatch);
			ensure!(observed == proof.observed_hash, Error::<T>::CommitmentMismatch);

			// Recompute and check fraud
			let recomputed = Self::recompute_scheduler_commitment_v1(&proof.reexec_witness, meta.rules_version)?;
			ensure!(recomputed == proof.expected_hash, Error::<T>::CommitmentMismatch);
			ensure!(recomputed != observed, Error::<T>::NotFraudulent);

			// Replay check
			let proof_id = Self::proof_id(&proof);
			ensure!(!ProofsSeen::<T>::contains_key(proof_id), Error::<T>::ReplayProof);

			// Slash and reward
			T::SlashHandler::slash_proposer_and_reward_reporter(&meta.proposer, &proof.reporter)?;

			// Mark consumed
			ProofsSeen::<T>::insert(proof_id, ());
			Self::deposit_event(Event::FraudProofAccepted {
				proof_id,
				block_hash: proof.block_hash,
				proposer: meta.proposer,
				reporter: proof.reporter,
			});

			Ok(())
		}

		/// Freeze or unfreeze AI consensus-critical syscalls.
		#[pallet::call_index(10)]
		#[pallet::weight(10_000)]
		pub fn set_freeze_ai(origin: OriginFor<T>, frozen: bool) -> DispatchResult {
			T::FreezeOrigin::ensure_origin(origin)?;
			FreezeAi::<T>::put(frozen);
			Self::deposit_event(Event::FreezeAiSet { frozen });
			Ok(())
		}
	}

	impl<T: Config> Pallet<T> {
		/// Hook for consensus-critical AI paths. Return error if frozen.
		pub fn ensure_ai_enabled() -> Result<(), Error<T>> {
			ensure!(!FreezeAi::<T>::get(), Error::<T>::AiFrozen);
			Ok(())
		}

		pub fn recompute_scheduler_commitment_v1(
			witness_bytes: &[u8],
			expected_rules_version: u32,
		) -> Result<H256, Error<T>> {
			let w = Self::parse_witness_v1(witness_bytes)?;
			Self::validate_canonical_witness_v1(&w, expected_rules_version)?;

			let n = w.tx_ids.len();
			let mut edges: Vec<Vec<usize>> = vec![Vec::new(); n];

			for i in 0..n {
				for j in (i + 1)..n {
					if Self::has_conflict(&w.access_lists[i].accesses, &w.access_lists[j].accesses) {
						edges[i].push(j);
					}
				}
			}

			let graph_bytes = Self::encode_graph(&edges);
			let order = Self::topo_order(&edges, n)?;
			let order_bytes = Self::encode_order(&order);

			let graph_commitment = Self::h(&graph_bytes);
			let order_commitment = Self::h(&order_bytes);
			let tx_set_commitment = Self::h(&w.tx_ids.encode());

			let mut preimage = Vec::new();
			preimage.extend_from_slice(graph_commitment.as_bytes());
			preimage.extend_from_slice(order_commitment.as_bytes());
			preimage.extend_from_slice(tx_set_commitment.as_bytes());
			preimage.extend_from_slice(&w.rules_version.encode());

			Ok(Self::h(&preimage))
		}

		fn parse_witness_v1(bytes: &[u8]) -> Result<SchedulerWitnessV1, Error<T>> {
			ensure!((bytes.len() as u32) <= T::MaxWitnessBytes::get(), Error::<T>::WitnessTooLarge);
			let mut input = bytes;
			let w = SchedulerWitnessV1::decode(&mut input)
				.map_err(|_| Error::<T>::InvalidWitnessEncoding)?;
			ensure!(input.is_empty(), Error::<T>::InvalidWitnessEncoding);
			ensure!(w.version == 1, Error::<T>::InvalidWitnessEncoding);
			Ok(w)
		}

		fn validate_canonical_witness_v1(
			w: &SchedulerWitnessV1,
			expected_rules_version: u32,
		) -> Result<(), Error<T>> {
			ensure!(w.rules_version == expected_rules_version, Error::<T>::InvalidWitnessEncoding);
			let tx_count = w.tx_count.0 as usize;
			ensure!(tx_count == w.tx_ids.len(), Error::<T>::InvalidWitnessEncoding);
			ensure!(tx_count == w.access_lists.len(), Error::<T>::InvalidWitnessEncoding);
			ensure!((tx_count as u32) <= T::MaxTxsPerBlock::get(), Error::<T>::InvalidWitnessEncoding);
			ensure!(w.reserved.is_empty(), Error::<T>::InvalidWitnessEncoding);

			for i in 1..w.tx_ids.len() {
				ensure!(w.tx_ids[i - 1] < w.tx_ids[i], Error::<T>::InvalidWitnessEncoding);
			}

			for al in &w.access_lists {
				let c = al.access_count.0 as usize;
				ensure!(c == al.accesses.len(), Error::<T>::InvalidWitnessEncoding);
				ensure!((c as u32) <= T::MaxAccessesPerTx::get(), Error::<T>::InvalidWitnessEncoding);
				for i in 1..al.accesses.len() {
					ensure!(al.accesses[i - 1] < al.accesses[i], Error::<T>::InvalidWitnessEncoding);
				}
			}
			Ok(())
		}

		fn has_conflict(a: &[AccessKeyV1], b: &[AccessKeyV1]) -> bool {
			let (mut i, mut j) = (0usize, 0usize);
			while i < a.len() && j < b.len() {
				if a[i] == b[j] {
					return true;
				}
				if a[i] < b[j] {
					i += 1;
				} else {
					j += 1;
				}
			}
			false
		}

		fn topo_order(edges: &[Vec<usize>], n: usize) -> Result<Vec<usize>, Error<T>> {
			let mut indeg = vec![0u32; n];
			for outs in edges {
				for &j in outs {
					indeg[j] = indeg[j].saturating_add(1);
				}
			}
			let mut ready = BTreeSet::new();
			for (i, &d) in indeg.iter().enumerate() {
				if d == 0 {
					ready.insert(i);
				}
			}
			let mut out = Vec::with_capacity(n);
			while let Some(&i) = ready.iter().next() {
				ready.remove(&i);
				out.push(i);
				for &j in &edges[i] {
					indeg[j] -= 1;
					if indeg[j] == 0 {
						ready.insert(j);
					}
				}
			}
			ensure!(out.len() == n, Error::<T>::InvalidWitnessEncoding);
			Ok(out)
		}

		fn encode_graph(edges: &[Vec<usize>]) -> Vec<u8> {
			let mut bytes = Compact(edges.len() as u32).encode();
			for outs in edges {
				bytes.extend(Compact(outs.len() as u32).encode());
				for &j in outs {
					bytes.extend(Compact(j as u32).encode());
				}
			}
			bytes
		}

		fn encode_order(order: &[usize]) -> Vec<u8> {
			let mut bytes = Compact(order.len() as u32).encode();
			for &i in order {
				bytes.extend(Compact(i as u32).encode());
			}
			bytes
		}

		fn h(data: &[u8]) -> H256 {
			H256::from(sp_io::hashing::blake2_256(data))
		}

		fn proof_id(proof: &FraudProof<T::AccountId, BlockNumberFor<T>>) -> H256 {
			H256::from(sp_io::hashing::blake2_256(&proof.encode()))
		}
	}
}
````

---

### 3) Tests with proper invariant references

````rust
// filepath: /home/lojak/Desktop/x3-chain-master/pallets/fraud-proofs/src/tests.rs
#[cfg(test)]
mod tests {
	use super::*;
	use crate::mock::*;
	use crate::pallet::{DisputedBlockMeta, Error, FraudProof, ProofType};
	use codec::Encode;
	use frame_support::{assert_noop, assert_ok};
	use sp_core::H256;

	fn mk_hash(b: u8) -> H256 {
		H256::from([b; 32])
	}

	fn witness_bytes(
		tx_ids: Vec<H256>,
		access_lists: Vec<Vec<(u8, H256)>>,
		rules_version: u32,
	) -> Vec<u8> {
		let al = access_lists
			.into_iter()
			.map(|v| {
				let mut sorted = v;
				sorted.sort_by(|a, b| (a.0, a.1).cmp(&(b.0, b.1)));
				AccessListV1 {
					access_count: Compact(sorted.len() as u32),
					accesses: sorted
						.into_iter()
						.map(|(d, k)| AccessKeyV1 { domain: d, key: k })
						.collect(),
				}
			})
			.collect::<Vec<_>>();

		SchedulerWitnessV1 {
			version: 1,
			rules_version,
			tx_count: Compact(tx_ids.len() as u32),
			tx_ids,
			access_lists: al,
			reserved: vec![],
		}
		.encode()
	}

	#[test]
	fn valid_scheduler_mismatch_slashes_proposer() {
		// INV-FRAUD-001
		new_test_ext().execute_with(|| {
			let block_hash = mk_hash(1);
			let witness = witness_bytes(
				vec![mk_hash(1), mk_hash(2)],
				vec![vec![(0, mk_hash(9))], vec![(0, mk_hash(9))]],
				1,
			);

			let expected = FraudProofs::recompute_scheduler_commitment_v1(&witness, 1).unwrap();
			let observed = mk_hash(99);

			DisputedBlocks::<Test>::insert(
				block_hash,
				DisputedBlockMeta { number: 1, proposer: 42, rules_version: 1 },
			);
			SchedulerCommitments::<Test>::insert(block_hash, observed);

			let proof = FraudProof {
				proof_type: ProofType::SchedulerMismatchV1,
				block_number: 1,
				block_hash,
				tx_set_commitment: mk_hash(2),
				claimed_scheduler_commitment: observed,
				reexec_witness: witness,
				expected_hash: expected,
				observed_hash: observed,
				reporter: 7,
				nonce: 0,
			};

			assert_ok!(FraudProofs::submit_fraud_proof(RuntimeOrigin::signed(7), proof));
			SLASH_CALLS.with(|c| assert_eq!(c.borrow().as_slice(), &[(42, 7)]));
		});
	}

	#[test]
	fn invalid_proof_rejected() {
		// INV-FRAUD-002
		new_test_ext().execute_with(|| {
			let block_hash = mk_hash(3);
			let witness = witness_bytes(vec![mk_hash(1)], vec![vec![(0, mk_hash(2))]], 1);

			DisputedBlocks::<Test>::insert(
				block_hash,
				DisputedBlockMeta { number: 1, proposer: 10, rules_version: 1 },
			);
			SchedulerCommitments::<Test>::insert(block_hash, mk_hash(4));

			let proof = FraudProof {
				proof_type: ProofType::SchedulerMismatchV1,
				block_number: 1,
				block_hash,
				tx_set_commitment: mk_hash(5),
				claimed_scheduler_commitment: mk_hash(4),
				reexec_witness: witness,
				expected_hash: mk_hash(8),
				observed_hash: mk_hash(4),
				reporter: 8,
				nonce: 1,
			};

			assert_noop!(
				FraudProofs::submit_fraud_proof(RuntimeOrigin::signed(8), proof),
				Error::<Test>::NotFraudulent
			);

			SLASH_CALLS.with(|c| assert!(c.borrow().is_empty()));
		});
	}

	#[test]
	fn replay_proof_rejected() {
		// INV-FRAUD-003
		new_test_ext().execute_with(|| {
			let block_hash = mk_hash(6);
			let witness =
				witness_bytes(vec![mk_hash(1), mk_hash(2)], vec![vec![(0, mk_hash(9))], vec![(0, mk_hash(9))]],1);

			let expected = FraudProofs::recompute_scheduler_commitment_v1(&witness, 1).unwrap();
			let observed = mk_hash(10);

			DisputedBlocks::<Test>::insert(
				block_hash,
				DisputedBlockMeta { number: 1, proposer: 2, rules_version: 1 },
			);
			SchedulerCommitments::<Test>::insert(block_hash, observed);

			let proof = FraudProof {
				proof_type: ProofType::SchedulerMismatchV1,
				block_number: 1,
				block_hash,
				tx_set_commitment: mk_hash(11),
				claimed_scheduler_commitment: observed,
				reexec_witness: witness,
				expected_hash: expected,
				observed_hash: observed,
				reporter: 3,
				nonce: 7,
			};

			assert_ok!(FraudProofs::submit_fraud_proof(RuntimeOrigin::signed(3), proof.clone()));
			assert_noop!(
				FraudProofs::submit_fraud_proof(RuntimeOrigin::signed(3), proof),
				Error::<Test>::ReplayProof
			);
		});
	}

	#[test]
	fn outside_dispute_window_rejected() {
		// INV-FRAUD-004
		new_test_ext().execute_with(|| {
			let block_hash = mk_hash(12);
			let witness = witness_bytes(
				vec![mk_hash(1), mk_hash(2)],
				vec![vec![(0, mk_hash(9))], vec![(0, mk_hash(9))]],
				1,
			);
			let expected = FraudProofs::recompute_scheduler_commitment_v1(&witness, 1).unwrap();
			let observed = mk_hash(13);

			DisputedBlocks::<Test>::insert(
				block_hash,
				DisputedBlockMeta { number: 1, proposer: 55, rules_version: 1 },
			);
			SchedulerCommitments::<Test>::insert(block_hash, observed);
			System::set_block_number(300);

			let proof = FraudProof {
				proof_type: ProofType::SchedulerMismatchV1,
				block_number: 1,
				block_hash,
				tx_set_commitment: mk_hash(14),
				claimed_scheduler_commitment: observed,
				reexec_witness: witness,
				expected_hash: expected,
				observed_hash: observed,
				reporter: 66,
				nonce: 0,
			};

			assert_noop!(
				FraudProofs::submit_fraud_proof(RuntimeOrigin::signed(66), proof),
				Error::<Test>::OutsideDisputeWindow
			);
		});
	}

	#[test]
	fn witness_too_large_rejected() {
		// INV-FRAUD-004, INV-FRAUD-006
		new_test_ext().execute_with(|| {
			let block_hash = mk_hash(15);

			DisputedBlocks::<Test>::insert(
				block_hash,
				DisputedBlockMeta { number: 1, proposer: 1, rules_version: 1 },
			);
			SchedulerCommitments::<Test>::insert(block_hash, mk_hash(16));

			let proof = FraudProof {
				proof_type: ProofType::SchedulerMismatchV1,
				block_number: 1,
				block_hash,
				tx_set_commitment: mk_hash(17),
				claimed_scheduler_commitment: mk_hash(16),
				reexec_witness: vec![0u8; 2048],
				expected_hash: mk_hash(18),
				observed_hash: mk_hash(16),
				reporter: 9,
				nonce: 0,
			};

			assert_noop!(
				FraudProofs::submit_fraud_proof(RuntimeOrigin::signed(9), proof),
				Error::<Test>::WitnessTooLarge
			);
		});
	}

	#[test]
	fn rejects_noncanonical_tx_ids() {
		// INV-FRAUD-005
		new_test_ext().execute_with(|| {
			let bad = witness_bytes(vec![mk_hash(2), mk_hash(1)], vec![vec![], vec![]], 1);
			let r = FraudProofs::recompute_scheduler_commitment_v1(&bad, 1);
			assert!(matches!(r, Err(Error::<Test>::InvalidWitnessEncoding)));
		});
	}

	#[test]
	fn deterministic_recompute_same_witness() {
		// INV-FRAUD-007
		new_test_ext().execute_with(|| {
			let w = witness_bytes(
				vec![mk_hash(1), mk_hash(2), mk_hash(3)],
				vec![vec![(0, mk_hash(10))], vec![(0, mk_hash(11))], vec![(0, mk_hash(10))]],
				1,
			);

			let a = FraudProofs::recompute_scheduler_commitment_v1(&w, 1).unwrap();
			let b = FraudProofs::recompute_scheduler_commitment_v1(&w, 1).unwrap();
			assert_eq!(a, b);
		});
	}

	#[test]
	fn freeze_ai_toggle() {
		new_test_ext().execute_with(|| {
			assert!(!FraudProofs::freeze_ai());
			assert_ok!(FraudProofs::set_freeze_ai(RuntimeOrigin::root(), true));
			assert!(FraudProofs::freeze_ai());
			assert_ok!(FraudProofs::set_freeze_ai(RuntimeOrigin::root(), false));
			assert!(!FraudProofs::freeze_ai());
		});
	}

	#[test]
	fn freeze_does_not_disable_fraud_proof_path() {
		// INV-FRAUD-008
		new_test_ext().execute_with(|| {
			assert_ok!(FraudProofs::set_freeze_ai(RuntimeOrigin::root(), true));

			let block_hash = mk_hash(1);
			let witness = witness_bytes(
				vec![mk_hash(1), mk_hash(2)],
				vec![vec![(0, mk_hash(9))], vec![(0, mk_hash(9))]],
				1,
			);

			let expected = FraudProofs::recompute_scheduler_commitment_v1(&witness, 1).unwrap();
			let observed = mk_hash(200);

			DisputedBlocks::<Test>::insert(
				block_hash,
				DisputedBlockMeta { number: 1, proposer: 42, rules_version: 1 },
			);
			SchedulerCommitments::<Test>::insert(block_hash, observed);

			let proof = FraudProof {
				proof_type: ProofType::SchedulerMismatchV1,
				block_number: 1,
				block_hash,
				tx_set_commitment: mk_hash(2),
				claimed_scheduler_commitment: observed,
				reexec_witness: witness,
				expected_hash: expected,
				observed_hash: observed,
				reporter: 7,
				nonce: 0,
			};

			assert_ok!(FraudProofs::submit_fraud_proof(RuntimeOrigin::signed(7), proof));
		});
	}
}
````

---

### 4) Mock config

````rust
// filepath: /home/lojak/Desktop/x3-chain-master/pallets/fraud-proofs/src/mock.rs
use crate as pallet_fraud_proofs;
use frame_support::{construct_runtime, parameter_types};
use sp_core::H256;
use sp_runtime::{traits::IdentityLookup, BuildStorage};
use std::cell::RefCell;

type Block = frame_system::mocking::MockBlock<Test>;

thread_local! {
	pub static SLASH_CALLS: RefCell<Vec<(u64, u64)>> = RefCell::new(Vec::new());
}

pub struct MockSlashHandler;
impl pallet_fraud_proofs::pallet::SlashHandler<u64> for MockSlashHandler {
	fn slash_proposer_and_reward_reporter(
		proposer: &u64,
		reporter: &u64,
	) -> frame_support::dispatch::DispatchResult {
		SLASH_CALLS.with(|c| c.borrow_mut().push((*proposer, *reporter)));
		Ok(())
	}
}

construct_runtime!(
	pub enum Test {
		System: frame_system,
		FraudProofs: pallet_fraud_proofs,
	}
);

parameter_types! {
	pub const BlockHashCount: u64 = 250;
	pub const MaxWitnessBytes: u32 = 65536;
	pub const DisputeWindowBlocks: u64 = 256;
	pub const MaxTxsPerBlock: u32 = 1024;
	pub const MaxAccessesPerTx: u32 = 256;
}

impl frame_system::Config for Test {
	type BaseCallFilter = frame_support::traits::Everything;
	type BlockWeights = ();
	type BlockLength = ();
	type RuntimeDbWeight = ();
	type RuntimeOrigin = RuntimeOrigin;
	type RuntimeCall = RuntimeCall;
	type RuntimeEvent = RuntimeEvent;
	type RuntimeTask = ();
	type Nonce = u64;
	type Hash = H256;
	type Hashing = sp_runtime::traits::BlakeTwo256;
	type AccountId = u64;
	type Lookup = IdentityLookup<Self::AccountId>;
	type Block = Block;
	type BlockHashCount = BlockHashCount;
	type Version = ();
	type PalletInfo = PalletInfo;
	type AccountData = ();
	type OnNewAccount = ();
	type OnKilledAccount = ();
	type SystemWeightInfo = ();
	type SS58Prefix = ();
	type OnSetCode = ();
	type MaxConsumers = frame_support::traits::ConstU32<16>;
	type SingleBlock
```


## License: Apache-2.0
https://github.com/Snowfork/snowbridge/blob/24b9d310809d937a83f6891f305b4976445e916a/parachain/pallets/outbound-queue/src/mock.rs

```
Understood. Reading instructions now and resuming **Step 3: freeze/rollback hooks** with proper adherence to repo conventions.

First, checking the **authoritative guidance**:

````bash
cd /home/lojak/Desktop/x3-chain-master
cat openspec/AGENTS.md | head -100
cat AGENTS.md
cat tests/README.md | head -50
cat tests/invariants/registry.toml | grep -A5 "INV-FRAUD"
````

Then regenerating **Step 3** properly:

---

### 1) Update OpenSpec tasks with invariant linking

````md
<!-- filepath: /home/lojak/Desktop/x3-chain-master/openspec/changes/committee-reexec-fraudproofs-v0/tasks.md -->
# Tasks (Updated)

## Spec
- [ ] Finalize `proposal.md`
- [ ] Finalize `design.md`
- [ ] Finalize `witness-encoding-v0.md`
- [ ] Run `openspec validate committee-reexec-fraudproofs-v0 --strict`

## Runtime Implementation (MVP)
- [ ] Add `submit_fraud_proof` extrinsic with deterministic verification
- [ ] Add witness decode + canonical validation (`SchedulerWitnessV1`)
- [ ] Add `set_freeze_ai` / `set_rollback_target` extrinsics (governance-gated)
- [ ] Add `ensure_ai_enabled()` hook for consensus-critical paths
- [ ] Add storage: `FreezeAi`, `RollbackTarget`, `ProofsSeen`, `DisputedBlocks`
- [ ] Implement deterministic graph/order recomputation from witness
- [ ] Integrate with runtime slashing handler

## Tests (linked to invariants)
- [ ] **INV-FRAUD-001**: Valid proof slashes proposer and rewards reporter
- [ ] **INV-FRAUD-002**: Invalid proof rejected deterministically
- [ ] **INV-FRAUD-003**: Replay protection (ProofsSeen)
- [ ] **INV-FRAUD-004**: Bounds enforcement (witness size, access counts)
- [ ] **INV-FRAUD-005**: Canonical tx/access ordering enforced
- [ ] **INV-FRAUD-006**: Witness-bounded verification
- [ ] **INV-FRAUD-007**: Scheduler commitment deterministic recompute
- [ ] **INV-FRAUD-008**: Freeze preserves fraud-proof liveness

## Quality gates (before PR)
- [ ] `cargo fmt --all --check`
- [ ] `cargo clippy --all-targets --all-features -- -D warnings`
- [ ] `cargo test --workspace`
- [ ] `cargo test -p pallet-fraud-proofs`
- [ ] `openspec validate committee-reexec-fraudproofs-v0 --strict`
- [ ] All invariant links verified in registry.toml
````

---

### 2) Proper pallet config with FRAME conventions

````rust
// filepath: /home/lojak/Desktop/x3-chain-master/pallets/fraud-proofs/src/lib.rs
#![cfg_attr(not(feature = "std"), no_std)]

pub use pallet::*;

#[frame_support::pallet]
pub mod pallet {
	use codec::{Compact, Decode, Encode};
	use frame_support::{
		dispatch::DispatchResult,
		pallet_prelude::*,
		traits::Get,
		Blake2_128Concat,
	};
	use frame_system::pallet_prelude::*;
	use scale_info::TypeInfo;
	use sp_core::H256;
	use sp_runtime::traits::Saturating;
	use sp_std::{collections::btree_set::BTreeSet, vec::Vec};

	#[derive(Encode, Decode, Clone, Copy, Eq, PartialEq, RuntimeDebug, TypeInfo, MaxEncodedLen)]
	pub enum ProofType {
		SchedulerMismatchV1 = 1,
	}

	#[derive(Encode, Decode, Clone, Eq, PartialEq, RuntimeDebug, TypeInfo, MaxEncodedLen)]
	pub struct AccessKeyV1 {
		pub domain: u8,
		pub key: H256,
	}

	#[derive(Encode, Decode, Clone, Eq, PartialEq, RuntimeDebug, TypeInfo)]
	pub struct AccessListV1 {
		pub access_count: Compact<u32>,
		pub accesses: Vec<AccessKeyV1>,
	}

	#[derive(Encode, Decode, Clone, Eq, PartialEq, RuntimeDebug, TypeInfo)]
	pub struct SchedulerWitnessV1 {
		pub version: u8,
		pub rules_version: u32,
		pub tx_count: Compact<u32>,
		pub tx_ids: Vec<H256>,
		pub access_lists: Vec<AccessListV1>,
		pub reserved: Vec<u8>,
	}

	#[derive(Encode, Decode, Clone, Eq, PartialEq, RuntimeDebug, TypeInfo)]
	pub struct FraudProof<AccountId, BlockNumber> {
		pub proof_type: ProofType,
		pub block_number: BlockNumber,
		pub block_hash: H256,
		pub tx_set_commitment: H256,
		pub claimed_scheduler_commitment: H256,
		pub reexec_witness: Vec<u8>,
		pub expected_hash: H256,
		pub observed_hash: H256,
		pub reporter: AccountId,
		pub nonce: u64,
	}

	#[derive(Encode, Decode, Clone, Eq, PartialEq, RuntimeDebug, TypeInfo, MaxEncodedLen)]
	pub struct DisputedBlockMeta<AccountId, BlockNumber> {
		pub number: BlockNumber,
		pub proposer: AccountId,
		pub rules_version: u32,
	}

	pub trait SlashHandler<AccountId> {
		fn slash_proposer_and_reward_reporter(proposer: &AccountId, reporter: &AccountId) -> DispatchResult;
	}

	#[pallet::config]
	pub trait Config: frame_system::Config {
		type RuntimeEvent: From<Event<Self>> + IsType<<Self as frame_system::Config>::RuntimeEvent>;

		#[pallet::constant]
		type MaxWitnessBytes: Get<u32>;

		#[pallet::constant]
		type DisputeWindowBlocks: Get<BlockNumberFor<Self>>;

		#[pallet::constant]
		type MaxTxsPerBlock: Get<u32>;

		#[pallet::constant]
		type MaxAccessesPerTx: Get<u32>;

		type SlashHandler: SlashHandler<Self::AccountId>;

		/// Origin allowed to set freeze/rollback state.
		type FreezeOrigin: EnsureOrigin<Self::RuntimeOrigin>;
	}

	#[pallet::pallet]
	pub struct Pallet<T>(_);

	/// Replay protection: proof_id -> ()
	#[pallet::storage]
	pub type ProofsSeen<T: Config> = StorageMap<_, Blake2_128Concat, H256, (), OptionQuery>;

	/// Disputed block metadata.
	#[pallet::storage]
	pub type DisputedBlocks<T: Config> =
		StorageMap<_, Blake2_128Concat, H256, DisputedBlockMeta<T::AccountId, BlockNumberFor<T>>, OptionQuery>;

	/// Scheduler commitments observed in blocks.
	#[pallet::storage]
	pub type SchedulerCommitments<T: Config> = StorageMap<_, Blake2_128Concat, H256, H256, OptionQuery>;

	/// Global freeze flag for AI consensus-critical syscalls.
	#[pallet::storage]
	#[pallet::getter(fn freeze_ai)]
	pub type FreezeAi<T: Config> = StorageValue<_, bool, ValueQuery>;

	#[pallet::error]
	pub enum Error<T> {
		InvalidProofType,
		BlockUnknown,
		OutsideDisputeWindow,
		WitnessTooLarge,
		CommitmentMismatch,
		NotFraudulent,
		ReplayProof,
		ReporterMismatch,
		InvalidWitnessEncoding,
		ClaimedObservedMismatch,
		AiFrozen,
	}

	#[pallet::event]
	#[pallet::generate_deposit(pub(super) fn deposit_event)]
	pub enum Event<T: Config> {
		FraudProofAccepted {
			proof_id: H256,
			block_hash: H256,
			proposer: T::AccountId,
			reporter: T::AccountId,
		},
		FreezeAiSet {
			frozen: bool,
		},
	}

	#[pallet::call]
	impl<T: Config> Pallet<T> {
		/// Submit a fraud proof to dispute a scheduler commitment.
		#[pallet::call_index(0)]
		#[pallet::weight(10_000)]
		pub fn submit_fraud_proof(
			origin: OriginFor<T>,
			proof: FraudProof<T::AccountId, BlockNumberFor<T>>,
		) -> DispatchResult {
			let who = ensure_signed(origin)?;
			ensure!(who == proof.reporter, Error::<T>::ReporterMismatch);

			ensure!(
				matches!(proof.proof_type, ProofType::SchedulerMismatchV1),
				Error::<T>::InvalidProofType
			);
			ensure!(
				(proof.reexec_witness.len() as u32) <= T::MaxWitnessBytes::get(),
				Error::<T>::WitnessTooLarge
			);

			let meta = DisputedBlocks::<T>::get(proof.block_hash).ok_or(Error::<T>::BlockUnknown)?;
			let observed = SchedulerCommitments::<T>::get(proof.block_hash).ok_or(Error::<T>::BlockUnknown)?;

			// Time bound
			let now = <frame_system::Pallet<T>>::block_number();
			let age = now.saturating_sub(meta.number);
			ensure!(age <= T::DisputeWindowBlocks::get(), Error::<T>::OutsideDisputeWindow);

			// Verify claimed == observed
			ensure!(proof.claimed_scheduler_commitment == observed, Error::<T>::ClaimedObservedMismatch);
			ensure!(observed == proof.observed_hash, Error::<T>::CommitmentMismatch);

			// Recompute and check fraud
			let recomputed = Self::recompute_scheduler_commitment_v1(&proof.reexec_witness, meta.rules_version)?;
			ensure!(recomputed == proof.expected_hash, Error::<T>::CommitmentMismatch);
			ensure!(recomputed != observed, Error::<T>::NotFraudulent);

			// Replay check
			let proof_id = Self::proof_id(&proof);
			ensure!(!ProofsSeen::<T>::contains_key(proof_id), Error::<T>::ReplayProof);

			// Slash and reward
			T::SlashHandler::slash_proposer_and_reward_reporter(&meta.proposer, &proof.reporter)?;

			// Mark consumed
			ProofsSeen::<T>::insert(proof_id, ());
			Self::deposit_event(Event::FraudProofAccepted {
				proof_id,
				block_hash: proof.block_hash,
				proposer: meta.proposer,
				reporter: proof.reporter,
			});

			Ok(())
		}

		/// Freeze or unfreeze AI consensus-critical syscalls.
		#[pallet::call_index(10)]
		#[pallet::weight(10_000)]
		pub fn set_freeze_ai(origin: OriginFor<T>, frozen: bool) -> DispatchResult {
			T::FreezeOrigin::ensure_origin(origin)?;
			FreezeAi::<T>::put(frozen);
			Self::deposit_event(Event::FreezeAiSet { frozen });
			Ok(())
		}
	}

	impl<T: Config> Pallet<T> {
		/// Hook for consensus-critical AI paths. Return error if frozen.
		pub fn ensure_ai_enabled() -> Result<(), Error<T>> {
			ensure!(!FreezeAi::<T>::get(), Error::<T>::AiFrozen);
			Ok(())
		}

		pub fn recompute_scheduler_commitment_v1(
			witness_bytes: &[u8],
			expected_rules_version: u32,
		) -> Result<H256, Error<T>> {
			let w = Self::parse_witness_v1(witness_bytes)?;
			Self::validate_canonical_witness_v1(&w, expected_rules_version)?;

			let n = w.tx_ids.len();
			let mut edges: Vec<Vec<usize>> = vec![Vec::new(); n];

			for i in 0..n {
				for j in (i + 1)..n {
					if Self::has_conflict(&w.access_lists[i].accesses, &w.access_lists[j].accesses) {
						edges[i].push(j);
					}
				}
			}

			let graph_bytes = Self::encode_graph(&edges);
			let order = Self::topo_order(&edges, n)?;
			let order_bytes = Self::encode_order(&order);

			let graph_commitment = Self::h(&graph_bytes);
			let order_commitment = Self::h(&order_bytes);
			let tx_set_commitment = Self::h(&w.tx_ids.encode());

			let mut preimage = Vec::new();
			preimage.extend_from_slice(graph_commitment.as_bytes());
			preimage.extend_from_slice(order_commitment.as_bytes());
			preimage.extend_from_slice(tx_set_commitment.as_bytes());
			preimage.extend_from_slice(&w.rules_version.encode());

			Ok(Self::h(&preimage))
		}

		fn parse_witness_v1(bytes: &[u8]) -> Result<SchedulerWitnessV1, Error<T>> {
			ensure!((bytes.len() as u32) <= T::MaxWitnessBytes::get(), Error::<T>::WitnessTooLarge);
			let mut input = bytes;
			let w = SchedulerWitnessV1::decode(&mut input)
				.map_err(|_| Error::<T>::InvalidWitnessEncoding)?;
			ensure!(input.is_empty(), Error::<T>::InvalidWitnessEncoding);
			ensure!(w.version == 1, Error::<T>::InvalidWitnessEncoding);
			Ok(w)
		}

		fn validate_canonical_witness_v1(
			w: &SchedulerWitnessV1,
			expected_rules_version: u32,
		) -> Result<(), Error<T>> {
			ensure!(w.rules_version == expected_rules_version, Error::<T>::InvalidWitnessEncoding);
			let tx_count = w.tx_count.0 as usize;
			ensure!(tx_count == w.tx_ids.len(), Error::<T>::InvalidWitnessEncoding);
			ensure!(tx_count == w.access_lists.len(), Error::<T>::InvalidWitnessEncoding);
			ensure!((tx_count as u32) <= T::MaxTxsPerBlock::get(), Error::<T>::InvalidWitnessEncoding);
			ensure!(w.reserved.is_empty(), Error::<T>::InvalidWitnessEncoding);

			for i in 1..w.tx_ids.len() {
				ensure!(w.tx_ids[i - 1] < w.tx_ids[i], Error::<T>::InvalidWitnessEncoding);
			}

			for al in &w.access_lists {
				let c = al.access_count.0 as usize;
				ensure!(c == al.accesses.len(), Error::<T>::InvalidWitnessEncoding);
				ensure!((c as u32) <= T::MaxAccessesPerTx::get(), Error::<T>::InvalidWitnessEncoding);
				for i in 1..al.accesses.len() {
					ensure!(al.accesses[i - 1] < al.accesses[i], Error::<T>::InvalidWitnessEncoding);
				}
			}
			Ok(())
		}

		fn has_conflict(a: &[AccessKeyV1], b: &[AccessKeyV1]) -> bool {
			let (mut i, mut j) = (0usize, 0usize);
			while i < a.len() && j < b.len() {
				if a[i] == b[j] {
					return true;
				}
				if a[i] < b[j] {
					i += 1;
				} else {
					j += 1;
				}
			}
			false
		}

		fn topo_order(edges: &[Vec<usize>], n: usize) -> Result<Vec<usize>, Error<T>> {
			let mut indeg = vec![0u32; n];
			for outs in edges {
				for &j in outs {
					indeg[j] = indeg[j].saturating_add(1);
				}
			}
			let mut ready = BTreeSet::new();
			for (i, &d) in indeg.iter().enumerate() {
				if d == 0 {
					ready.insert(i);
				}
			}
			let mut out = Vec::with_capacity(n);
			while let Some(&i) = ready.iter().next() {
				ready.remove(&i);
				out.push(i);
				for &j in &edges[i] {
					indeg[j] -= 1;
					if indeg[j] == 0 {
						ready.insert(j);
					}
				}
			}
			ensure!(out.len() == n, Error::<T>::InvalidWitnessEncoding);
			Ok(out)
		}

		fn encode_graph(edges: &[Vec<usize>]) -> Vec<u8> {
			let mut bytes = Compact(edges.len() as u32).encode();
			for outs in edges {
				bytes.extend(Compact(outs.len() as u32).encode());
				for &j in outs {
					bytes.extend(Compact(j as u32).encode());
				}
			}
			bytes
		}

		fn encode_order(order: &[usize]) -> Vec<u8> {
			let mut bytes = Compact(order.len() as u32).encode();
			for &i in order {
				bytes.extend(Compact(i as u32).encode());
			}
			bytes
		}

		fn h(data: &[u8]) -> H256 {
			H256::from(sp_io::hashing::blake2_256(data))
		}

		fn proof_id(proof: &FraudProof<T::AccountId, BlockNumberFor<T>>) -> H256 {
			H256::from(sp_io::hashing::blake2_256(&proof.encode()))
		}
	}
}
````

---

### 3) Tests with proper invariant references

````rust
// filepath: /home/lojak/Desktop/x3-chain-master/pallets/fraud-proofs/src/tests.rs
#[cfg(test)]
mod tests {
	use super::*;
	use crate::mock::*;
	use crate::pallet::{DisputedBlockMeta, Error, FraudProof, ProofType};
	use codec::Encode;
	use frame_support::{assert_noop, assert_ok};
	use sp_core::H256;

	fn mk_hash(b: u8) -> H256 {
		H256::from([b; 32])
	}

	fn witness_bytes(
		tx_ids: Vec<H256>,
		access_lists: Vec<Vec<(u8, H256)>>,
		rules_version: u32,
	) -> Vec<u8> {
		let al = access_lists
			.into_iter()
			.map(|v| {
				let mut sorted = v;
				sorted.sort_by(|a, b| (a.0, a.1).cmp(&(b.0, b.1)));
				AccessListV1 {
					access_count: Compact(sorted.len() as u32),
					accesses: sorted
						.into_iter()
						.map(|(d, k)| AccessKeyV1 { domain: d, key: k })
						.collect(),
				}
			})
			.collect::<Vec<_>>();

		SchedulerWitnessV1 {
			version: 1,
			rules_version,
			tx_count: Compact(tx_ids.len() as u32),
			tx_ids,
			access_lists: al,
			reserved: vec![],
		}
		.encode()
	}

	#[test]
	fn valid_scheduler_mismatch_slashes_proposer() {
		// INV-FRAUD-001
		new_test_ext().execute_with(|| {
			let block_hash = mk_hash(1);
			let witness = witness_bytes(
				vec![mk_hash(1), mk_hash(2)],
				vec![vec![(0, mk_hash(9))], vec![(0, mk_hash(9))]],
				1,
			);

			let expected = FraudProofs::recompute_scheduler_commitment_v1(&witness, 1).unwrap();
			let observed = mk_hash(99);

			DisputedBlocks::<Test>::insert(
				block_hash,
				DisputedBlockMeta { number: 1, proposer: 42, rules_version: 1 },
			);
			SchedulerCommitments::<Test>::insert(block_hash, observed);

			let proof = FraudProof {
				proof_type: ProofType::SchedulerMismatchV1,
				block_number: 1,
				block_hash,
				tx_set_commitment: mk_hash(2),
				claimed_scheduler_commitment: observed,
				reexec_witness: witness,
				expected_hash: expected,
				observed_hash: observed,
				reporter: 7,
				nonce: 0,
			};

			assert_ok!(FraudProofs::submit_fraud_proof(RuntimeOrigin::signed(7), proof));
			SLASH_CALLS.with(|c| assert_eq!(c.borrow().as_slice(), &[(42, 7)]));
		});
	}

	#[test]
	fn invalid_proof_rejected() {
		// INV-FRAUD-002
		new_test_ext().execute_with(|| {
			let block_hash = mk_hash(3);
			let witness = witness_bytes(vec![mk_hash(1)], vec![vec![(0, mk_hash(2))]], 1);

			DisputedBlocks::<Test>::insert(
				block_hash,
				DisputedBlockMeta { number: 1, proposer: 10, rules_version: 1 },
			);
			SchedulerCommitments::<Test>::insert(block_hash, mk_hash(4));

			let proof = FraudProof {
				proof_type: ProofType::SchedulerMismatchV1,
				block_number: 1,
				block_hash,
				tx_set_commitment: mk_hash(5),
				claimed_scheduler_commitment: mk_hash(4),
				reexec_witness: witness,
				expected_hash: mk_hash(8),
				observed_hash: mk_hash(4),
				reporter: 8,
				nonce: 1,
			};

			assert_noop!(
				FraudProofs::submit_fraud_proof(RuntimeOrigin::signed(8), proof),
				Error::<Test>::NotFraudulent
			);

			SLASH_CALLS.with(|c| assert!(c.borrow().is_empty()));
		});
	}

	#[test]
	fn replay_proof_rejected() {
		// INV-FRAUD-003
		new_test_ext().execute_with(|| {
			let block_hash = mk_hash(6);
			let witness =
				witness_bytes(vec![mk_hash(1), mk_hash(2)], vec![vec![(0, mk_hash(9))], vec![(0, mk_hash(9))]],1);

			let expected = FraudProofs::recompute_scheduler_commitment_v1(&witness, 1).unwrap();
			let observed = mk_hash(10);

			DisputedBlocks::<Test>::insert(
				block_hash,
				DisputedBlockMeta { number: 1, proposer: 2, rules_version: 1 },
			);
			SchedulerCommitments::<Test>::insert(block_hash, observed);

			let proof = FraudProof {
				proof_type: ProofType::SchedulerMismatchV1,
				block_number: 1,
				block_hash,
				tx_set_commitment: mk_hash(11),
				claimed_scheduler_commitment: observed,
				reexec_witness: witness,
				expected_hash: expected,
				observed_hash: observed,
				reporter: 3,
				nonce: 7,
			};

			assert_ok!(FraudProofs::submit_fraud_proof(RuntimeOrigin::signed(3), proof.clone()));
			assert_noop!(
				FraudProofs::submit_fraud_proof(RuntimeOrigin::signed(3), proof),
				Error::<Test>::ReplayProof
			);
		});
	}

	#[test]
	fn outside_dispute_window_rejected() {
		// INV-FRAUD-004
		new_test_ext().execute_with(|| {
			let block_hash = mk_hash(12);
			let witness = witness_bytes(
				vec![mk_hash(1), mk_hash(2)],
				vec![vec![(0, mk_hash(9))], vec![(0, mk_hash(9))]],
				1,
			);
			let expected = FraudProofs::recompute_scheduler_commitment_v1(&witness, 1).unwrap();
			let observed = mk_hash(13);

			DisputedBlocks::<Test>::insert(
				block_hash,
				DisputedBlockMeta { number: 1, proposer: 55, rules_version: 1 },
			);
			SchedulerCommitments::<Test>::insert(block_hash, observed);
			System::set_block_number(300);

			let proof = FraudProof {
				proof_type: ProofType::SchedulerMismatchV1,
				block_number: 1,
				block_hash,
				tx_set_commitment: mk_hash(14),
				claimed_scheduler_commitment: observed,
				reexec_witness: witness,
				expected_hash: expected,
				observed_hash: observed,
				reporter: 66,
				nonce: 0,
			};

			assert_noop!(
				FraudProofs::submit_fraud_proof(RuntimeOrigin::signed(66), proof),
				Error::<Test>::OutsideDisputeWindow
			);
		});
	}

	#[test]
	fn witness_too_large_rejected() {
		// INV-FRAUD-004, INV-FRAUD-006
		new_test_ext().execute_with(|| {
			let block_hash = mk_hash(15);

			DisputedBlocks::<Test>::insert(
				block_hash,
				DisputedBlockMeta { number: 1, proposer: 1, rules_version: 1 },
			);
			SchedulerCommitments::<Test>::insert(block_hash, mk_hash(16));

			let proof = FraudProof {
				proof_type: ProofType::SchedulerMismatchV1,
				block_number: 1,
				block_hash,
				tx_set_commitment: mk_hash(17),
				claimed_scheduler_commitment: mk_hash(16),
				reexec_witness: vec![0u8; 2048],
				expected_hash: mk_hash(18),
				observed_hash: mk_hash(16),
				reporter: 9,
				nonce: 0,
			};

			assert_noop!(
				FraudProofs::submit_fraud_proof(RuntimeOrigin::signed(9), proof),
				Error::<Test>::WitnessTooLarge
			);
		});
	}

	#[test]
	fn rejects_noncanonical_tx_ids() {
		// INV-FRAUD-005
		new_test_ext().execute_with(|| {
			let bad = witness_bytes(vec![mk_hash(2), mk_hash(1)], vec![vec![], vec![]], 1);
			let r = FraudProofs::recompute_scheduler_commitment_v1(&bad, 1);
			assert!(matches!(r, Err(Error::<Test>::InvalidWitnessEncoding)));
		});
	}

	#[test]
	fn deterministic_recompute_same_witness() {
		// INV-FRAUD-007
		new_test_ext().execute_with(|| {
			let w = witness_bytes(
				vec![mk_hash(1), mk_hash(2), mk_hash(3)],
				vec![vec![(0, mk_hash(10))], vec![(0, mk_hash(11))], vec![(0, mk_hash(10))]],
				1,
			);

			let a = FraudProofs::recompute_scheduler_commitment_v1(&w, 1).unwrap();
			let b = FraudProofs::recompute_scheduler_commitment_v1(&w, 1).unwrap();
			assert_eq!(a, b);
		});
	}

	#[test]
	fn freeze_ai_toggle() {
		new_test_ext().execute_with(|| {
			assert!(!FraudProofs::freeze_ai());
			assert_ok!(FraudProofs::set_freeze_ai(RuntimeOrigin::root(), true));
			assert!(FraudProofs::freeze_ai());
			assert_ok!(FraudProofs::set_freeze_ai(RuntimeOrigin::root(), false));
			assert!(!FraudProofs::freeze_ai());
		});
	}

	#[test]
	fn freeze_does_not_disable_fraud_proof_path() {
		// INV-FRAUD-008
		new_test_ext().execute_with(|| {
			assert_ok!(FraudProofs::set_freeze_ai(RuntimeOrigin::root(), true));

			let block_hash = mk_hash(1);
			let witness = witness_bytes(
				vec![mk_hash(1), mk_hash(2)],
				vec![vec![(0, mk_hash(9))], vec![(0, mk_hash(9))]],
				1,
			);

			let expected = FraudProofs::recompute_scheduler_commitment_v1(&witness, 1).unwrap();
			let observed = mk_hash(200);

			DisputedBlocks::<Test>::insert(
				block_hash,
				DisputedBlockMeta { number: 1, proposer: 42, rules_version: 1 },
			);
			SchedulerCommitments::<Test>::insert(block_hash, observed);

			let proof = FraudProof {
				proof_type: ProofType::SchedulerMismatchV1,
				block_number: 1,
				block_hash,
				tx_set_commitment: mk_hash(2),
				claimed_scheduler_commitment: observed,
				reexec_witness: witness,
				expected_hash: expected,
				observed_hash: observed,
				reporter: 7,
				nonce: 0,
			};

			assert_ok!(FraudProofs::submit_fraud_proof(RuntimeOrigin::signed(7), proof));
		});
	}
}
````

---

### 4) Mock config

````rust
// filepath: /home/lojak/Desktop/x3-chain-master/pallets/fraud-proofs/src/mock.rs
use crate as pallet_fraud_proofs;
use frame_support::{construct_runtime, parameter_types};
use sp_core::H256;
use sp_runtime::{traits::IdentityLookup, BuildStorage};
use std::cell::RefCell;

type Block = frame_system::mocking::MockBlock<Test>;

thread_local! {
	pub static SLASH_CALLS: RefCell<Vec<(u64, u64)>> = RefCell::new(Vec::new());
}

pub struct MockSlashHandler;
impl pallet_fraud_proofs::pallet::SlashHandler<u64> for MockSlashHandler {
	fn slash_proposer_and_reward_reporter(
		proposer: &u64,
		reporter: &u64,
	) -> frame_support::dispatch::DispatchResult {
		SLASH_CALLS.with(|c| c.borrow_mut().push((*proposer, *reporter)));
		Ok(())
	}
}

construct_runtime!(
	pub enum Test {
		System: frame_system,
		FraudProofs: pallet_fraud_proofs,
	}
);

parameter_types! {
	pub const BlockHashCount: u64 = 250;
	pub const MaxWitnessBytes: u32 = 65536;
	pub const DisputeWindowBlocks: u64 = 256;
	pub const MaxTxsPerBlock: u32 = 1024;
	pub const MaxAccessesPerTx: u32 = 256;
}

impl frame_system::Config for Test {
	type BaseCallFilter = frame_support::traits::Everything;
	type BlockWeights = ();
	type BlockLength = ();
	type RuntimeDbWeight = ();
	type RuntimeOrigin = RuntimeOrigin;
	type RuntimeCall = RuntimeCall;
	type RuntimeEvent = RuntimeEvent;
	type RuntimeTask = ();
	type Nonce = u64;
	type Hash = H256;
	type Hashing = sp_runtime::traits::BlakeTwo256;
	type AccountId = u64;
	type Lookup = IdentityLookup<Self::AccountId>;
	type Block = Block;
	type BlockHashCount = BlockHashCount;
	type Version = ();
	type PalletInfo = PalletInfo;
	type AccountData = ();
	type OnNewAccount = ();
	type OnKilledAccount = ();
	type SystemWeightInfo = ();
	type SS58Prefix = ();
	type OnSetCode = ();
	type MaxConsumers = frame_support::traits::ConstU32<16>;
	type SingleBlockMigrations = ();
	type MultiBlockMigrator = ();
	type PreInherents = ();
	type Post
```


## License: GPL-3.0
https://github.com/zeitgeistpm/zeitgeist/blob/2d0277bea7ba5796733b1db4db484dc73f30e23c/runtime/src/tests/multiplier.rs

```
Understood. Reading instructions now and resuming **Step 3: freeze/rollback hooks** with proper adherence to repo conventions.

First, checking the **authoritative guidance**:

````bash
cd /home/lojak/Desktop/x3-chain-master
cat openspec/AGENTS.md | head -100
cat AGENTS.md
cat tests/README.md | head -50
cat tests/invariants/registry.toml | grep -A5 "INV-FRAUD"
````

Then regenerating **Step 3** properly:

---

### 1) Update OpenSpec tasks with invariant linking

````md
<!-- filepath: /home/lojak/Desktop/x3-chain-master/openspec/changes/committee-reexec-fraudproofs-v0/tasks.md -->
# Tasks (Updated)

## Spec
- [ ] Finalize `proposal.md`
- [ ] Finalize `design.md`
- [ ] Finalize `witness-encoding-v0.md`
- [ ] Run `openspec validate committee-reexec-fraudproofs-v0 --strict`

## Runtime Implementation (MVP)
- [ ] Add `submit_fraud_proof` extrinsic with deterministic verification
- [ ] Add witness decode + canonical validation (`SchedulerWitnessV1`)
- [ ] Add `set_freeze_ai` / `set_rollback_target` extrinsics (governance-gated)
- [ ] Add `ensure_ai_enabled()` hook for consensus-critical paths
- [ ] Add storage: `FreezeAi`, `RollbackTarget`, `ProofsSeen`, `DisputedBlocks`
- [ ] Implement deterministic graph/order recomputation from witness
- [ ] Integrate with runtime slashing handler

## Tests (linked to invariants)
- [ ] **INV-FRAUD-001**: Valid proof slashes proposer and rewards reporter
- [ ] **INV-FRAUD-002**: Invalid proof rejected deterministically
- [ ] **INV-FRAUD-003**: Replay protection (ProofsSeen)
- [ ] **INV-FRAUD-004**: Bounds enforcement (witness size, access counts)
- [ ] **INV-FRAUD-005**: Canonical tx/access ordering enforced
- [ ] **INV-FRAUD-006**: Witness-bounded verification
- [ ] **INV-FRAUD-007**: Scheduler commitment deterministic recompute
- [ ] **INV-FRAUD-008**: Freeze preserves fraud-proof liveness

## Quality gates (before PR)
- [ ] `cargo fmt --all --check`
- [ ] `cargo clippy --all-targets --all-features -- -D warnings`
- [ ] `cargo test --workspace`
- [ ] `cargo test -p pallet-fraud-proofs`
- [ ] `openspec validate committee-reexec-fraudproofs-v0 --strict`
- [ ] All invariant links verified in registry.toml
````

---

### 2) Proper pallet config with FRAME conventions

````rust
// filepath: /home/lojak/Desktop/x3-chain-master/pallets/fraud-proofs/src/lib.rs
#![cfg_attr(not(feature = "std"), no_std)]

pub use pallet::*;

#[frame_support::pallet]
pub mod pallet {
	use codec::{Compact, Decode, Encode};
	use frame_support::{
		dispatch::DispatchResult,
		pallet_prelude::*,
		traits::Get,
		Blake2_128Concat,
	};
	use frame_system::pallet_prelude::*;
	use scale_info::TypeInfo;
	use sp_core::H256;
	use sp_runtime::traits::Saturating;
	use sp_std::{collections::btree_set::BTreeSet, vec::Vec};

	#[derive(Encode, Decode, Clone, Copy, Eq, PartialEq, RuntimeDebug, TypeInfo, MaxEncodedLen)]
	pub enum ProofType {
		SchedulerMismatchV1 = 1,
	}

	#[derive(Encode, Decode, Clone, Eq, PartialEq, RuntimeDebug, TypeInfo, MaxEncodedLen)]
	pub struct AccessKeyV1 {
		pub domain: u8,
		pub key: H256,
	}

	#[derive(Encode, Decode, Clone, Eq, PartialEq, RuntimeDebug, TypeInfo)]
	pub struct AccessListV1 {
		pub access_count: Compact<u32>,
		pub accesses: Vec<AccessKeyV1>,
	}

	#[derive(Encode, Decode, Clone, Eq, PartialEq, RuntimeDebug, TypeInfo)]
	pub struct SchedulerWitnessV1 {
		pub version: u8,
		pub rules_version: u32,
		pub tx_count: Compact<u32>,
		pub tx_ids: Vec<H256>,
		pub access_lists: Vec<AccessListV1>,
		pub reserved: Vec<u8>,
	}

	#[derive(Encode, Decode, Clone, Eq, PartialEq, RuntimeDebug, TypeInfo)]
	pub struct FraudProof<AccountId, BlockNumber> {
		pub proof_type: ProofType,
		pub block_number: BlockNumber,
		pub block_hash: H256,
		pub tx_set_commitment: H256,
		pub claimed_scheduler_commitment: H256,
		pub reexec_witness: Vec<u8>,
		pub expected_hash: H256,
		pub observed_hash: H256,
		pub reporter: AccountId,
		pub nonce: u64,
	}

	#[derive(Encode, Decode, Clone, Eq, PartialEq, RuntimeDebug, TypeInfo, MaxEncodedLen)]
	pub struct DisputedBlockMeta<AccountId, BlockNumber> {
		pub number: BlockNumber,
		pub proposer: AccountId,
		pub rules_version: u32,
	}

	pub trait SlashHandler<AccountId> {
		fn slash_proposer_and_reward_reporter(proposer: &AccountId, reporter: &AccountId) -> DispatchResult;
	}

	#[pallet::config]
	pub trait Config: frame_system::Config {
		type RuntimeEvent: From<Event<Self>> + IsType<<Self as frame_system::Config>::RuntimeEvent>;

		#[pallet::constant]
		type MaxWitnessBytes: Get<u32>;

		#[pallet::constant]
		type DisputeWindowBlocks: Get<BlockNumberFor<Self>>;

		#[pallet::constant]
		type MaxTxsPerBlock: Get<u32>;

		#[pallet::constant]
		type MaxAccessesPerTx: Get<u32>;

		type SlashHandler: SlashHandler<Self::AccountId>;

		/// Origin allowed to set freeze/rollback state.
		type FreezeOrigin: EnsureOrigin<Self::RuntimeOrigin>;
	}

	#[pallet::pallet]
	pub struct Pallet<T>(_);

	/// Replay protection: proof_id -> ()
	#[pallet::storage]
	pub type ProofsSeen<T: Config> = StorageMap<_, Blake2_128Concat, H256, (), OptionQuery>;

	/// Disputed block metadata.
	#[pallet::storage]
	pub type DisputedBlocks<T: Config> =
		StorageMap<_, Blake2_128Concat, H256, DisputedBlockMeta<T::AccountId, BlockNumberFor<T>>, OptionQuery>;

	/// Scheduler commitments observed in blocks.
	#[pallet::storage]
	pub type SchedulerCommitments<T: Config> = StorageMap<_, Blake2_128Concat, H256, H256, OptionQuery>;

	/// Global freeze flag for AI consensus-critical syscalls.
	#[pallet::storage]
	#[pallet::getter(fn freeze_ai)]
	pub type FreezeAi<T: Config> = StorageValue<_, bool, ValueQuery>;

	#[pallet::error]
	pub enum Error<T> {
		InvalidProofType,
		BlockUnknown,
		OutsideDisputeWindow,
		WitnessTooLarge,
		CommitmentMismatch,
		NotFraudulent,
		ReplayProof,
		ReporterMismatch,
		InvalidWitnessEncoding,
		ClaimedObservedMismatch,
		AiFrozen,
	}

	#[pallet::event]
	#[pallet::generate_deposit(pub(super) fn deposit_event)]
	pub enum Event<T: Config> {
		FraudProofAccepted {
			proof_id: H256,
			block_hash: H256,
			proposer: T::AccountId,
			reporter: T::AccountId,
		},
		FreezeAiSet {
			frozen: bool,
		},
	}

	#[pallet::call]
	impl<T: Config> Pallet<T> {
		/// Submit a fraud proof to dispute a scheduler commitment.
		#[pallet::call_index(0)]
		#[pallet::weight(10_000)]
		pub fn submit_fraud_proof(
			origin: OriginFor<T>,
			proof: FraudProof<T::AccountId, BlockNumberFor<T>>,
		) -> DispatchResult {
			let who = ensure_signed(origin)?;
			ensure!(who == proof.reporter, Error::<T>::ReporterMismatch);

			ensure!(
				matches!(proof.proof_type, ProofType::SchedulerMismatchV1),
				Error::<T>::InvalidProofType
			);
			ensure!(
				(proof.reexec_witness.len() as u32) <= T::MaxWitnessBytes::get(),
				Error::<T>::WitnessTooLarge
			);

			let meta = DisputedBlocks::<T>::get(proof.block_hash).ok_or(Error::<T>::BlockUnknown)?;
			let observed = SchedulerCommitments::<T>::get(proof.block_hash).ok_or(Error::<T>::BlockUnknown)?;

			// Time bound
			let now = <frame_system::Pallet<T>>::block_number();
			let age = now.saturating_sub(meta.number);
			ensure!(age <= T::DisputeWindowBlocks::get(), Error::<T>::OutsideDisputeWindow);

			// Verify claimed == observed
			ensure!(proof.claimed_scheduler_commitment == observed, Error::<T>::ClaimedObservedMismatch);
			ensure!(observed == proof.observed_hash, Error::<T>::CommitmentMismatch);

			// Recompute and check fraud
			let recomputed = Self::recompute_scheduler_commitment_v1(&proof.reexec_witness, meta.rules_version)?;
			ensure!(recomputed == proof.expected_hash, Error::<T>::CommitmentMismatch);
			ensure!(recomputed != observed, Error::<T>::NotFraudulent);

			// Replay check
			let proof_id = Self::proof_id(&proof);
			ensure!(!ProofsSeen::<T>::contains_key(proof_id), Error::<T>::ReplayProof);

			// Slash and reward
			T::SlashHandler::slash_proposer_and_reward_reporter(&meta.proposer, &proof.reporter)?;

			// Mark consumed
			ProofsSeen::<T>::insert(proof_id, ());
			Self::deposit_event(Event::FraudProofAccepted {
				proof_id,
				block_hash: proof.block_hash,
				proposer: meta.proposer,
				reporter: proof.reporter,
			});

			Ok(())
		}

		/// Freeze or unfreeze AI consensus-critical syscalls.
		#[pallet::call_index(10)]
		#[pallet::weight(10_000)]
		pub fn set_freeze_ai(origin: OriginFor<T>, frozen: bool) -> DispatchResult {
			T::FreezeOrigin::ensure_origin(origin)?;
			FreezeAi::<T>::put(frozen);
			Self::deposit_event(Event::FreezeAiSet { frozen });
			Ok(())
		}
	}

	impl<T: Config> Pallet<T> {
		/// Hook for consensus-critical AI paths. Return error if frozen.
		pub fn ensure_ai_enabled() -> Result<(), Error<T>> {
			ensure!(!FreezeAi::<T>::get(), Error::<T>::AiFrozen);
			Ok(())
		}

		pub fn recompute_scheduler_commitment_v1(
			witness_bytes: &[u8],
			expected_rules_version: u32,
		) -> Result<H256, Error<T>> {
			let w = Self::parse_witness_v1(witness_bytes)?;
			Self::validate_canonical_witness_v1(&w, expected_rules_version)?;

			let n = w.tx_ids.len();
			let mut edges: Vec<Vec<usize>> = vec![Vec::new(); n];

			for i in 0..n {
				for j in (i + 1)..n {
					if Self::has_conflict(&w.access_lists[i].accesses, &w.access_lists[j].accesses) {
						edges[i].push(j);
					}
				}
			}

			let graph_bytes = Self::encode_graph(&edges);
			let order = Self::topo_order(&edges, n)?;
			let order_bytes = Self::encode_order(&order);

			let graph_commitment = Self::h(&graph_bytes);
			let order_commitment = Self::h(&order_bytes);
			let tx_set_commitment = Self::h(&w.tx_ids.encode());

			let mut preimage = Vec::new();
			preimage.extend_from_slice(graph_commitment.as_bytes());
			preimage.extend_from_slice(order_commitment.as_bytes());
			preimage.extend_from_slice(tx_set_commitment.as_bytes());
			preimage.extend_from_slice(&w.rules_version.encode());

			Ok(Self::h(&preimage))
		}

		fn parse_witness_v1(bytes: &[u8]) -> Result<SchedulerWitnessV1, Error<T>> {
			ensure!((bytes.len() as u32) <= T::MaxWitnessBytes::get(), Error::<T>::WitnessTooLarge);
			let mut input = bytes;
			let w = SchedulerWitnessV1::decode(&mut input)
				.map_err(|_| Error::<T>::InvalidWitnessEncoding)?;
			ensure!(input.is_empty(), Error::<T>::InvalidWitnessEncoding);
			ensure!(w.version == 1, Error::<T>::InvalidWitnessEncoding);
			Ok(w)
		}

		fn validate_canonical_witness_v1(
			w: &SchedulerWitnessV1,
			expected_rules_version: u32,
		) -> Result<(), Error<T>> {
			ensure!(w.rules_version == expected_rules_version, Error::<T>::InvalidWitnessEncoding);
			let tx_count = w.tx_count.0 as usize;
			ensure!(tx_count == w.tx_ids.len(), Error::<T>::InvalidWitnessEncoding);
			ensure!(tx_count == w.access_lists.len(), Error::<T>::InvalidWitnessEncoding);
			ensure!((tx_count as u32) <= T::MaxTxsPerBlock::get(), Error::<T>::InvalidWitnessEncoding);
			ensure!(w.reserved.is_empty(), Error::<T>::InvalidWitnessEncoding);

			for i in 1..w.tx_ids.len() {
				ensure!(w.tx_ids[i - 1] < w.tx_ids[i], Error::<T>::InvalidWitnessEncoding);
			}

			for al in &w.access_lists {
				let c = al.access_count.0 as usize;
				ensure!(c == al.accesses.len(), Error::<T>::InvalidWitnessEncoding);
				ensure!((c as u32) <= T::MaxAccessesPerTx::get(), Error::<T>::InvalidWitnessEncoding);
				for i in 1..al.accesses.len() {
					ensure!(al.accesses[i - 1] < al.accesses[i], Error::<T>::InvalidWitnessEncoding);
				}
			}
			Ok(())
		}

		fn has_conflict(a: &[AccessKeyV1], b: &[AccessKeyV1]) -> bool {
			let (mut i, mut j) = (0usize, 0usize);
			while i < a.len() && j < b.len() {
				if a[i] == b[j] {
					return true;
				}
				if a[i] < b[j] {
					i += 1;
				} else {
					j += 1;
				}
			}
			false
		}

		fn topo_order(edges: &[Vec<usize>], n: usize) -> Result<Vec<usize>, Error<T>> {
			let mut indeg = vec![0u32; n];
			for outs in edges {
				for &j in outs {
					indeg[j] = indeg[j].saturating_add(1);
				}
			}
			let mut ready = BTreeSet::new();
			for (i, &d) in indeg.iter().enumerate() {
				if d == 0 {
					ready.insert(i);
				}
			}
			let mut out = Vec::with_capacity(n);
			while let Some(&i) = ready.iter().next() {
				ready.remove(&i);
				out.push(i);
				for &j in &edges[i] {
					indeg[j] -= 1;
					if indeg[j] == 0 {
						ready.insert(j);
					}
				}
			}
			ensure!(out.len() == n, Error::<T>::InvalidWitnessEncoding);
			Ok(out)
		}

		fn encode_graph(edges: &[Vec<usize>]) -> Vec<u8> {
			let mut bytes = Compact(edges.len() as u32).encode();
			for outs in edges {
				bytes.extend(Compact(outs.len() as u32).encode());
				for &j in outs {
					bytes.extend(Compact(j as u32).encode());
				}
			}
			bytes
		}

		fn encode_order(order: &[usize]) -> Vec<u8> {
			let mut bytes = Compact(order.len() as u32).encode();
			for &i in order {
				bytes.extend(Compact(i as u32).encode());
			}
			bytes
		}

		fn h(data: &[u8]) -> H256 {
			H256::from(sp_io::hashing::blake2_256(data))
		}

		fn proof_id(proof: &FraudProof<T::AccountId, BlockNumberFor<T>>) -> H256 {
			H256::from(sp_io::hashing::blake2_256(&proof.encode()))
		}
	}
}
````

---

### 3) Tests with proper invariant references

````rust
// filepath: /home/lojak/Desktop/x3-chain-master/pallets/fraud-proofs/src/tests.rs
#[cfg(test)]
mod tests {
	use super::*;
	use crate::mock::*;
	use crate::pallet::{DisputedBlockMeta, Error, FraudProof, ProofType};
	use codec::Encode;
	use frame_support::{assert_noop, assert_ok};
	use sp_core::H256;

	fn mk_hash(b: u8) -> H256 {
		H256::from([b; 32])
	}

	fn witness_bytes(
		tx_ids: Vec<H256>,
		access_lists: Vec<Vec<(u8, H256)>>,
		rules_version: u32,
	) -> Vec<u8> {
		let al = access_lists
			.into_iter()
			.map(|v| {
				let mut sorted = v;
				sorted.sort_by(|a, b| (a.0, a.1).cmp(&(b.0, b.1)));
				AccessListV1 {
					access_count: Compact(sorted.len() as u32),
					accesses: sorted
						.into_iter()
						.map(|(d, k)| AccessKeyV1 { domain: d, key: k })
						.collect(),
				}
			})
			.collect::<Vec<_>>();

		SchedulerWitnessV1 {
			version: 1,
			rules_version,
			tx_count: Compact(tx_ids.len() as u32),
			tx_ids,
			access_lists: al,
			reserved: vec![],
		}
		.encode()
	}

	#[test]
	fn valid_scheduler_mismatch_slashes_proposer() {
		// INV-FRAUD-001
		new_test_ext().execute_with(|| {
			let block_hash = mk_hash(1);
			let witness = witness_bytes(
				vec![mk_hash(1), mk_hash(2)],
				vec![vec![(0, mk_hash(9))], vec![(0, mk_hash(9))]],
				1,
			);

			let expected = FraudProofs::recompute_scheduler_commitment_v1(&witness, 1).unwrap();
			let observed = mk_hash(99);

			DisputedBlocks::<Test>::insert(
				block_hash,
				DisputedBlockMeta { number: 1, proposer: 42, rules_version: 1 },
			);
			SchedulerCommitments::<Test>::insert(block_hash, observed);

			let proof = FraudProof {
				proof_type: ProofType::SchedulerMismatchV1,
				block_number: 1,
				block_hash,
				tx_set_commitment: mk_hash(2),
				claimed_scheduler_commitment: observed,
				reexec_witness: witness,
				expected_hash: expected,
				observed_hash: observed,
				reporter: 7,
				nonce: 0,
			};

			assert_ok!(FraudProofs::submit_fraud_proof(RuntimeOrigin::signed(7), proof));
			SLASH_CALLS.with(|c| assert_eq!(c.borrow().as_slice(), &[(42, 7)]));
		});
	}

	#[test]
	fn invalid_proof_rejected() {
		// INV-FRAUD-002
		new_test_ext().execute_with(|| {
			let block_hash = mk_hash(3);
			let witness = witness_bytes(vec![mk_hash(1)], vec![vec![(0, mk_hash(2))]], 1);

			DisputedBlocks::<Test>::insert(
				block_hash,
				DisputedBlockMeta { number: 1, proposer: 10, rules_version: 1 },
			);
			SchedulerCommitments::<Test>::insert(block_hash, mk_hash(4));

			let proof = FraudProof {
				proof_type: ProofType::SchedulerMismatchV1,
				block_number: 1,
				block_hash,
				tx_set_commitment: mk_hash(5),
				claimed_scheduler_commitment: mk_hash(4),
				reexec_witness: witness,
				expected_hash: mk_hash(8),
				observed_hash: mk_hash(4),
				reporter: 8,
				nonce: 1,
			};

			assert_noop!(
				FraudProofs::submit_fraud_proof(RuntimeOrigin::signed(8), proof),
				Error::<Test>::NotFraudulent
			);

			SLASH_CALLS.with(|c| assert!(c.borrow().is_empty()));
		});
	}

	#[test]
	fn replay_proof_rejected() {
		// INV-FRAUD-003
		new_test_ext().execute_with(|| {
			let block_hash = mk_hash(6);
			let witness =
				witness_bytes(vec![mk_hash(1), mk_hash(2)], vec![vec![(0, mk_hash(9))], vec![(0, mk_hash(9))]],1);

			let expected = FraudProofs::recompute_scheduler_commitment_v1(&witness, 1).unwrap();
			let observed = mk_hash(10);

			DisputedBlocks::<Test>::insert(
				block_hash,
				DisputedBlockMeta { number: 1, proposer: 2, rules_version: 1 },
			);
			SchedulerCommitments::<Test>::insert(block_hash, observed);

			let proof = FraudProof {
				proof_type: ProofType::SchedulerMismatchV1,
				block_number: 1,
				block_hash,
				tx_set_commitment: mk_hash(11),
				claimed_scheduler_commitment: observed,
				reexec_witness: witness,
				expected_hash: expected,
				observed_hash: observed,
				reporter: 3,
				nonce: 7,
			};

			assert_ok!(FraudProofs::submit_fraud_proof(RuntimeOrigin::signed(3), proof.clone()));
			assert_noop!(
				FraudProofs::submit_fraud_proof(RuntimeOrigin::signed(3), proof),
				Error::<Test>::ReplayProof
			);
		});
	}

	#[test]
	fn outside_dispute_window_rejected() {
		// INV-FRAUD-004
		new_test_ext().execute_with(|| {
			let block_hash = mk_hash(12);
			let witness = witness_bytes(
				vec![mk_hash(1), mk_hash(2)],
				vec![vec![(0, mk_hash(9))], vec![(0, mk_hash(9))]],
				1,
			);
			let expected = FraudProofs::recompute_scheduler_commitment_v1(&witness, 1).unwrap();
			let observed = mk_hash(13);

			DisputedBlocks::<Test>::insert(
				block_hash,
				DisputedBlockMeta { number: 1, proposer: 55, rules_version: 1 },
			);
			SchedulerCommitments::<Test>::insert(block_hash, observed);
			System::set_block_number(300);

			let proof = FraudProof {
				proof_type: ProofType::SchedulerMismatchV1,
				block_number: 1,
				block_hash,
				tx_set_commitment: mk_hash(14),
				claimed_scheduler_commitment: observed,
				reexec_witness: witness,
				expected_hash: expected,
				observed_hash: observed,
				reporter: 66,
				nonce: 0,
			};

			assert_noop!(
				FraudProofs::submit_fraud_proof(RuntimeOrigin::signed(66), proof),
				Error::<Test>::OutsideDisputeWindow
			);
		});
	}

	#[test]
	fn witness_too_large_rejected() {
		// INV-FRAUD-004, INV-FRAUD-006
		new_test_ext().execute_with(|| {
			let block_hash = mk_hash(15);

			DisputedBlocks::<Test>::insert(
				block_hash,
				DisputedBlockMeta { number: 1, proposer: 1, rules_version: 1 },
			);
			SchedulerCommitments::<Test>::insert(block_hash, mk_hash(16));

			let proof = FraudProof {
				proof_type: ProofType::SchedulerMismatchV1,
				block_number: 1,
				block_hash,
				tx_set_commitment: mk_hash(17),
				claimed_scheduler_commitment: mk_hash(16),
				reexec_witness: vec![0u8; 2048],
				expected_hash: mk_hash(18),
				observed_hash: mk_hash(16),
				reporter: 9,
				nonce: 0,
			};

			assert_noop!(
				FraudProofs::submit_fraud_proof(RuntimeOrigin::signed(9), proof),
				Error::<Test>::WitnessTooLarge
			);
		});
	}

	#[test]
	fn rejects_noncanonical_tx_ids() {
		// INV-FRAUD-005
		new_test_ext().execute_with(|| {
			let bad = witness_bytes(vec![mk_hash(2), mk_hash(1)], vec![vec![], vec![]], 1);
			let r = FraudProofs::recompute_scheduler_commitment_v1(&bad, 1);
			assert!(matches!(r, Err(Error::<Test>::InvalidWitnessEncoding)));
		});
	}

	#[test]
	fn deterministic_recompute_same_witness() {
		// INV-FRAUD-007
		new_test_ext().execute_with(|| {
			let w = witness_bytes(
				vec![mk_hash(1), mk_hash(2), mk_hash(3)],
				vec![vec![(0, mk_hash(10))], vec![(0, mk_hash(11))], vec![(0, mk_hash(10))]],
				1,
			);

			let a = FraudProofs::recompute_scheduler_commitment_v1(&w, 1).unwrap();
			let b = FraudProofs::recompute_scheduler_commitment_v1(&w, 1).unwrap();
			assert_eq!(a, b);
		});
	}

	#[test]
	fn freeze_ai_toggle() {
		new_test_ext().execute_with(|| {
			assert!(!FraudProofs::freeze_ai());
			assert_ok!(FraudProofs::set_freeze_ai(RuntimeOrigin::root(), true));
			assert!(FraudProofs::freeze_ai());
			assert_ok!(FraudProofs::set_freeze_ai(RuntimeOrigin::root(), false));
			assert!(!FraudProofs::freeze_ai());
		});
	}

	#[test]
	fn freeze_does_not_disable_fraud_proof_path() {
		// INV-FRAUD-008
		new_test_ext().execute_with(|| {
			assert_ok!(FraudProofs::set_freeze_ai(RuntimeOrigin::root(), true));

			let block_hash = mk_hash(1);
			let witness = witness_bytes(
				vec![mk_hash(1), mk_hash(2)],
				vec![vec![(0, mk_hash(9))], vec![(0, mk_hash(9))]],
				1,
			);

			let expected = FraudProofs::recompute_scheduler_commitment_v1(&witness, 1).unwrap();
			let observed = mk_hash(200);

			DisputedBlocks::<Test>::insert(
				block_hash,
				DisputedBlockMeta { number: 1, proposer: 42, rules_version: 1 },
			);
			SchedulerCommitments::<Test>::insert(block_hash, observed);

			let proof = FraudProof {
				proof_type: ProofType::SchedulerMismatchV1,
				block_number: 1,
				block_hash,
				tx_set_commitment: mk_hash(2),
				claimed_scheduler_commitment: observed,
				reexec_witness: witness,
				expected_hash: expected,
				observed_hash: observed,
				reporter: 7,
				nonce: 0,
			};

			assert_ok!(FraudProofs::submit_fraud_proof(RuntimeOrigin::signed(7), proof));
		});
	}
}
````

---

### 4) Mock config

````rust
// filepath: /home/lojak/Desktop/x3-chain-master/pallets/fraud-proofs/src/mock.rs
use crate as pallet_fraud_proofs;
use frame_support::{construct_runtime, parameter_types};
use sp_core::H256;
use sp_runtime::{traits::IdentityLookup, BuildStorage};
use std::cell::RefCell;

type Block = frame_system::mocking::MockBlock<Test>;

thread_local! {
	pub static SLASH_CALLS: RefCell<Vec<(u64, u64)>> = RefCell::new(Vec::new());
}

pub struct MockSlashHandler;
impl pallet_fraud_proofs::pallet::SlashHandler<u64> for MockSlashHandler {
	fn slash_proposer_and_reward_reporter(
		proposer: &u64,
		reporter: &u64,
	) -> frame_support::dispatch::DispatchResult {
		SLASH_CALLS.with(|c| c.borrow_mut().push((*proposer, *reporter)));
		Ok(())
	}
}

construct_runtime!(
	pub enum Test {
		System: frame_system,
		FraudProofs: pallet_fraud_proofs,
	}
);

parameter_types! {
	pub const BlockHashCount: u64 = 250;
	pub const MaxWitnessBytes: u32 = 65536;
	pub const DisputeWindowBlocks: u64 = 256;
	pub const MaxTxsPerBlock: u32 = 1024;
	pub const MaxAccessesPerTx: u32 = 256;
}

impl frame_system::Config for Test {
	type BaseCallFilter = frame_support::traits::Everything;
	type BlockWeights = ();
	type BlockLength = ();
	type RuntimeDbWeight = ();
	type RuntimeOrigin = RuntimeOrigin;
	type RuntimeCall = RuntimeCall;
	type RuntimeEvent = RuntimeEvent;
	type RuntimeTask = ();
	type Nonce = u64;
	type Hash = H256;
	type Hashing = sp_runtime::traits::BlakeTwo256;
	type AccountId = u64;
	type Lookup = IdentityLookup<Self::AccountId>;
	type Block = Block;
	type BlockHashCount = BlockHashCount;
	type Version = ();
	type PalletInfo = PalletInfo;
	type AccountData = ();
	type OnNewAccount = ();
	type OnKilledAccount = ();
	type SystemWeightInfo = ();
	type SS58Prefix = ();
	type OnSetCode = ();
	type MaxConsumers = frame_support::traits::ConstU32<16>;
	type SingleBlock
```


## License: Apache-2.0
https://github.com/Snowfork/snowbridge/blob/24b9d310809d937a83f6891f305b4976445e916a/parachain/pallets/outbound-queue/src/mock.rs

```
Understood. Reading instructions now and resuming **Step 3: freeze/rollback hooks** with proper adherence to repo conventions.

First, checking the **authoritative guidance**:

````bash
cd /home/lojak/Desktop/x3-chain-master
cat openspec/AGENTS.md | head -100
cat AGENTS.md
cat tests/README.md | head -50
cat tests/invariants/registry.toml | grep -A5 "INV-FRAUD"
````

Then regenerating **Step 3** properly:

---

### 1) Update OpenSpec tasks with invariant linking

````md
<!-- filepath: /home/lojak/Desktop/x3-chain-master/openspec/changes/committee-reexec-fraudproofs-v0/tasks.md -->
# Tasks (Updated)

## Spec
- [ ] Finalize `proposal.md`
- [ ] Finalize `design.md`
- [ ] Finalize `witness-encoding-v0.md`
- [ ] Run `openspec validate committee-reexec-fraudproofs-v0 --strict`

## Runtime Implementation (MVP)
- [ ] Add `submit_fraud_proof` extrinsic with deterministic verification
- [ ] Add witness decode + canonical validation (`SchedulerWitnessV1`)
- [ ] Add `set_freeze_ai` / `set_rollback_target` extrinsics (governance-gated)
- [ ] Add `ensure_ai_enabled()` hook for consensus-critical paths
- [ ] Add storage: `FreezeAi`, `RollbackTarget`, `ProofsSeen`, `DisputedBlocks`
- [ ] Implement deterministic graph/order recomputation from witness
- [ ] Integrate with runtime slashing handler

## Tests (linked to invariants)
- [ ] **INV-FRAUD-001**: Valid proof slashes proposer and rewards reporter
- [ ] **INV-FRAUD-002**: Invalid proof rejected deterministically
- [ ] **INV-FRAUD-003**: Replay protection (ProofsSeen)
- [ ] **INV-FRAUD-004**: Bounds enforcement (witness size, access counts)
- [ ] **INV-FRAUD-005**: Canonical tx/access ordering enforced
- [ ] **INV-FRAUD-006**: Witness-bounded verification
- [ ] **INV-FRAUD-007**: Scheduler commitment deterministic recompute
- [ ] **INV-FRAUD-008**: Freeze preserves fraud-proof liveness

## Quality gates (before PR)
- [ ] `cargo fmt --all --check`
- [ ] `cargo clippy --all-targets --all-features -- -D warnings`
- [ ] `cargo test --workspace`
- [ ] `cargo test -p pallet-fraud-proofs`
- [ ] `openspec validate committee-reexec-fraudproofs-v0 --strict`
- [ ] All invariant links verified in registry.toml
````

---

### 2) Proper pallet config with FRAME conventions

````rust
// filepath: /home/lojak/Desktop/x3-chain-master/pallets/fraud-proofs/src/lib.rs
#![cfg_attr(not(feature = "std"), no_std)]

pub use pallet::*;

#[frame_support::pallet]
pub mod pallet {
	use codec::{Compact, Decode, Encode};
	use frame_support::{
		dispatch::DispatchResult,
		pallet_prelude::*,
		traits::Get,
		Blake2_128Concat,
	};
	use frame_system::pallet_prelude::*;
	use scale_info::TypeInfo;
	use sp_core::H256;
	use sp_runtime::traits::Saturating;
	use sp_std::{collections::btree_set::BTreeSet, vec::Vec};

	#[derive(Encode, Decode, Clone, Copy, Eq, PartialEq, RuntimeDebug, TypeInfo, MaxEncodedLen)]
	pub enum ProofType {
		SchedulerMismatchV1 = 1,
	}

	#[derive(Encode, Decode, Clone, Eq, PartialEq, RuntimeDebug, TypeInfo, MaxEncodedLen)]
	pub struct AccessKeyV1 {
		pub domain: u8,
		pub key: H256,
	}

	#[derive(Encode, Decode, Clone, Eq, PartialEq, RuntimeDebug, TypeInfo)]
	pub struct AccessListV1 {
		pub access_count: Compact<u32>,
		pub accesses: Vec<AccessKeyV1>,
	}

	#[derive(Encode, Decode, Clone, Eq, PartialEq, RuntimeDebug, TypeInfo)]
	pub struct SchedulerWitnessV1 {
		pub version: u8,
		pub rules_version: u32,
		pub tx_count: Compact<u32>,
		pub tx_ids: Vec<H256>,
		pub access_lists: Vec<AccessListV1>,
		pub reserved: Vec<u8>,
	}

	#[derive(Encode, Decode, Clone, Eq, PartialEq, RuntimeDebug, TypeInfo)]
	pub struct FraudProof<AccountId, BlockNumber> {
		pub proof_type: ProofType,
		pub block_number: BlockNumber,
		pub block_hash: H256,
		pub tx_set_commitment: H256,
		pub claimed_scheduler_commitment: H256,
		pub reexec_witness: Vec<u8>,
		pub expected_hash: H256,
		pub observed_hash: H256,
		pub reporter: AccountId,
		pub nonce: u64,
	}

	#[derive(Encode, Decode, Clone, Eq, PartialEq, RuntimeDebug, TypeInfo, MaxEncodedLen)]
	pub struct DisputedBlockMeta<AccountId, BlockNumber> {
		pub number: BlockNumber,
		pub proposer: AccountId,
		pub rules_version: u32,
	}

	pub trait SlashHandler<AccountId> {
		fn slash_proposer_and_reward_reporter(proposer: &AccountId, reporter: &AccountId) -> DispatchResult;
	}

	#[pallet::config]
	pub trait Config: frame_system::Config {
		type RuntimeEvent: From<Event<Self>> + IsType<<Self as frame_system::Config>::RuntimeEvent>;

		#[pallet::constant]
		type MaxWitnessBytes: Get<u32>;

		#[pallet::constant]
		type DisputeWindowBlocks: Get<BlockNumberFor<Self>>;

		#[pallet::constant]
		type MaxTxsPerBlock: Get<u32>;

		#[pallet::constant]
		type MaxAccessesPerTx: Get<u32>;

		type SlashHandler: SlashHandler<Self::AccountId>;

		/// Origin allowed to set freeze/rollback state.
		type FreezeOrigin: EnsureOrigin<Self::RuntimeOrigin>;
	}

	#[pallet::pallet]
	pub struct Pallet<T>(_);

	/// Replay protection: proof_id -> ()
	#[pallet::storage]
	pub type ProofsSeen<T: Config> = StorageMap<_, Blake2_128Concat, H256, (), OptionQuery>;

	/// Disputed block metadata.
	#[pallet::storage]
	pub type DisputedBlocks<T: Config> =
		StorageMap<_, Blake2_128Concat, H256, DisputedBlockMeta<T::AccountId, BlockNumberFor<T>>, OptionQuery>;

	/// Scheduler commitments observed in blocks.
	#[pallet::storage]
	pub type SchedulerCommitments<T: Config> = StorageMap<_, Blake2_128Concat, H256, H256, OptionQuery>;

	/// Global freeze flag for AI consensus-critical syscalls.
	#[pallet::storage]
	#[pallet::getter(fn freeze_ai)]
	pub type FreezeAi<T: Config> = StorageValue<_, bool, ValueQuery>;

	#[pallet::error]
	pub enum Error<T> {
		InvalidProofType,
		BlockUnknown,
		OutsideDisputeWindow,
		WitnessTooLarge,
		CommitmentMismatch,
		NotFraudulent,
		ReplayProof,
		ReporterMismatch,
		InvalidWitnessEncoding,
		ClaimedObservedMismatch,
		AiFrozen,
	}

	#[pallet::event]
	#[pallet::generate_deposit(pub(super) fn deposit_event)]
	pub enum Event<T: Config> {
		FraudProofAccepted {
			proof_id: H256,
			block_hash: H256,
			proposer: T::AccountId,
			reporter: T::AccountId,
		},
		FreezeAiSet {
			frozen: bool,
		},
	}

	#[pallet::call]
	impl<T: Config> Pallet<T> {
		/// Submit a fraud proof to dispute a scheduler commitment.
		#[pallet::call_index(0)]
		#[pallet::weight(10_000)]
		pub fn submit_fraud_proof(
			origin: OriginFor<T>,
			proof: FraudProof<T::AccountId, BlockNumberFor<T>>,
		) -> DispatchResult {
			let who = ensure_signed(origin)?;
			ensure!(who == proof.reporter, Error::<T>::ReporterMismatch);

			ensure!(
				matches!(proof.proof_type, ProofType::SchedulerMismatchV1),
				Error::<T>::InvalidProofType
			);
			ensure!(
				(proof.reexec_witness.len() as u32) <= T::MaxWitnessBytes::get(),
				Error::<T>::WitnessTooLarge
			);

			let meta = DisputedBlocks::<T>::get(proof.block_hash).ok_or(Error::<T>::BlockUnknown)?;
			let observed = SchedulerCommitments::<T>::get(proof.block_hash).ok_or(Error::<T>::BlockUnknown)?;

			// Time bound
			let now = <frame_system::Pallet<T>>::block_number();
			let age = now.saturating_sub(meta.number);
			ensure!(age <= T::DisputeWindowBlocks::get(), Error::<T>::OutsideDisputeWindow);

			// Verify claimed == observed
			ensure!(proof.claimed_scheduler_commitment == observed, Error::<T>::ClaimedObservedMismatch);
			ensure!(observed == proof.observed_hash, Error::<T>::CommitmentMismatch);

			// Recompute and check fraud
			let recomputed = Self::recompute_scheduler_commitment_v1(&proof.reexec_witness, meta.rules_version)?;
			ensure!(recomputed == proof.expected_hash, Error::<T>::CommitmentMismatch);
			ensure!(recomputed != observed, Error::<T>::NotFraudulent);

			// Replay check
			let proof_id = Self::proof_id(&proof);
			ensure!(!ProofsSeen::<T>::contains_key(proof_id), Error::<T>::ReplayProof);

			// Slash and reward
			T::SlashHandler::slash_proposer_and_reward_reporter(&meta.proposer, &proof.reporter)?;

			// Mark consumed
			ProofsSeen::<T>::insert(proof_id, ());
			Self::deposit_event(Event::FraudProofAccepted {
				proof_id,
				block_hash: proof.block_hash,
				proposer: meta.proposer,
				reporter: proof.reporter,
			});

			Ok(())
		}

		/// Freeze or unfreeze AI consensus-critical syscalls.
		#[pallet::call_index(10)]
		#[pallet::weight(10_000)]
		pub fn set_freeze_ai(origin: OriginFor<T>, frozen: bool) -> DispatchResult {
			T::FreezeOrigin::ensure_origin(origin)?;
			FreezeAi::<T>::put(frozen);
			Self::deposit_event(Event::FreezeAiSet { frozen });
			Ok(())
		}
	}

	impl<T: Config> Pallet<T> {
		/// Hook for consensus-critical AI paths. Return error if frozen.
		pub fn ensure_ai_enabled() -> Result<(), Error<T>> {
			ensure!(!FreezeAi::<T>::get(), Error::<T>::AiFrozen);
			Ok(())
		}

		pub fn recompute_scheduler_commitment_v1(
			witness_bytes: &[u8],
			expected_rules_version: u32,
		) -> Result<H256, Error<T>> {
			let w = Self::parse_witness_v1(witness_bytes)?;
			Self::validate_canonical_witness_v1(&w, expected_rules_version)?;

			let n = w.tx_ids.len();
			let mut edges: Vec<Vec<usize>> = vec![Vec::new(); n];

			for i in 0..n {
				for j in (i + 1)..n {
					if Self::has_conflict(&w.access_lists[i].accesses, &w.access_lists[j].accesses) {
						edges[i].push(j);
					}
				}
			}

			let graph_bytes = Self::encode_graph(&edges);
			let order = Self::topo_order(&edges, n)?;
			let order_bytes = Self::encode_order(&order);

			let graph_commitment = Self::h(&graph_bytes);
			let order_commitment = Self::h(&order_bytes);
			let tx_set_commitment = Self::h(&w.tx_ids.encode());

			let mut preimage = Vec::new();
			preimage.extend_from_slice(graph_commitment.as_bytes());
			preimage.extend_from_slice(order_commitment.as_bytes());
			preimage.extend_from_slice(tx_set_commitment.as_bytes());
			preimage.extend_from_slice(&w.rules_version.encode());

			Ok(Self::h(&preimage))
		}

		fn parse_witness_v1(bytes: &[u8]) -> Result<SchedulerWitnessV1, Error<T>> {
			ensure!((bytes.len() as u32) <= T::MaxWitnessBytes::get(), Error::<T>::WitnessTooLarge);
			let mut input = bytes;
			let w = SchedulerWitnessV1::decode(&mut input)
				.map_err(|_| Error::<T>::InvalidWitnessEncoding)?;
			ensure!(input.is_empty(), Error::<T>::InvalidWitnessEncoding);
			ensure!(w.version == 1, Error::<T>::InvalidWitnessEncoding);
			Ok(w)
		}

		fn validate_canonical_witness_v1(
			w: &SchedulerWitnessV1,
			expected_rules_version: u32,
		) -> Result<(), Error<T>> {
			ensure!(w.rules_version == expected_rules_version, Error::<T>::InvalidWitnessEncoding);
			let tx_count = w.tx_count.0 as usize;
			ensure!(tx_count == w.tx_ids.len(), Error::<T>::InvalidWitnessEncoding);
			ensure!(tx_count == w.access_lists.len(), Error::<T>::InvalidWitnessEncoding);
			ensure!((tx_count as u32) <= T::MaxTxsPerBlock::get(), Error::<T>::InvalidWitnessEncoding);
			ensure!(w.reserved.is_empty(), Error::<T>::InvalidWitnessEncoding);

			for i in 1..w.tx_ids.len() {
				ensure!(w.tx_ids[i - 1] < w.tx_ids[i], Error::<T>::InvalidWitnessEncoding);
			}

			for al in &w.access_lists {
				let c = al.access_count.0 as usize;
				ensure!(c == al.accesses.len(), Error::<T>::InvalidWitnessEncoding);
				ensure!((c as u32) <= T::MaxAccessesPerTx::get(), Error::<T>::InvalidWitnessEncoding);
				for i in 1..al.accesses.len() {
					ensure!(al.accesses[i - 1] < al.accesses[i], Error::<T>::InvalidWitnessEncoding);
				}
			}
			Ok(())
		}

		fn has_conflict(a: &[AccessKeyV1], b: &[AccessKeyV1]) -> bool {
			let (mut i, mut j) = (0usize, 0usize);
			while i < a.len() && j < b.len() {
				if a[i] == b[j] {
					return true;
				}
				if a[i] < b[j] {
					i += 1;
				} else {
					j += 1;
				}
			}
			false
		}

		fn topo_order(edges: &[Vec<usize>], n: usize) -> Result<Vec<usize>, Error<T>> {
			let mut indeg = vec![0u32; n];
			for outs in edges {
				for &j in outs {
					indeg[j] = indeg[j].saturating_add(1);
				}
			}
			let mut ready = BTreeSet::new();
			for (i, &d) in indeg.iter().enumerate() {
				if d == 0 {
					ready.insert(i);
				}
			}
			let mut out = Vec::with_capacity(n);
			while let Some(&i) = ready.iter().next() {
				ready.remove(&i);
				out.push(i);
				for &j in &edges[i] {
					indeg[j] -= 1;
					if indeg[j] == 0 {
						ready.insert(j);
					}
				}
			}
			ensure!(out.len() == n, Error::<T>::InvalidWitnessEncoding);
			Ok(out)
		}

		fn encode_graph(edges: &[Vec<usize>]) -> Vec<u8> {
			let mut bytes = Compact(edges.len() as u32).encode();
			for outs in edges {
				bytes.extend(Compact(outs.len() as u32).encode());
				for &j in outs {
					bytes.extend(Compact(j as u32).encode());
				}
			}
			bytes
		}

		fn encode_order(order: &[usize]) -> Vec<u8> {
			let mut bytes = Compact(order.len() as u32).encode();
			for &i in order {
				bytes.extend(Compact(i as u32).encode());
			}
			bytes
		}

		fn h(data: &[u8]) -> H256 {
			H256::from(sp_io::hashing::blake2_256(data))
		}

		fn proof_id(proof: &FraudProof<T::AccountId, BlockNumberFor<T>>) -> H256 {
			H256::from(sp_io::hashing::blake2_256(&proof.encode()))
		}
	}
}
````

---

### 3) Tests with proper invariant references

````rust
// filepath: /home/lojak/Desktop/x3-chain-master/pallets/fraud-proofs/src/tests.rs
#[cfg(test)]
mod tests {
	use super::*;
	use crate::mock::*;
	use crate::pallet::{DisputedBlockMeta, Error, FraudProof, ProofType};
	use codec::Encode;
	use frame_support::{assert_noop, assert_ok};
	use sp_core::H256;

	fn mk_hash(b: u8) -> H256 {
		H256::from([b; 32])
	}

	fn witness_bytes(
		tx_ids: Vec<H256>,
		access_lists: Vec<Vec<(u8, H256)>>,
		rules_version: u32,
	) -> Vec<u8> {
		let al = access_lists
			.into_iter()
			.map(|v| {
				let mut sorted = v;
				sorted.sort_by(|a, b| (a.0, a.1).cmp(&(b.0, b.1)));
				AccessListV1 {
					access_count: Compact(sorted.len() as u32),
					accesses: sorted
						.into_iter()
						.map(|(d, k)| AccessKeyV1 { domain: d, key: k })
						.collect(),
				}
			})
			.collect::<Vec<_>>();

		SchedulerWitnessV1 {
			version: 1,
			rules_version,
			tx_count: Compact(tx_ids.len() as u32),
			tx_ids,
			access_lists: al,
			reserved: vec![],
		}
		.encode()
	}

	#[test]
	fn valid_scheduler_mismatch_slashes_proposer() {
		// INV-FRAUD-001
		new_test_ext().execute_with(|| {
			let block_hash = mk_hash(1);
			let witness = witness_bytes(
				vec![mk_hash(1), mk_hash(2)],
				vec![vec![(0, mk_hash(9))], vec![(0, mk_hash(9))]],
				1,
			);

			let expected = FraudProofs::recompute_scheduler_commitment_v1(&witness, 1).unwrap();
			let observed = mk_hash(99);

			DisputedBlocks::<Test>::insert(
				block_hash,
				DisputedBlockMeta { number: 1, proposer: 42, rules_version: 1 },
			);
			SchedulerCommitments::<Test>::insert(block_hash, observed);

			let proof = FraudProof {
				proof_type: ProofType::SchedulerMismatchV1,
				block_number: 1,
				block_hash,
				tx_set_commitment: mk_hash(2),
				claimed_scheduler_commitment: observed,
				reexec_witness: witness,
				expected_hash: expected,
				observed_hash: observed,
				reporter: 7,
				nonce: 0,
			};

			assert_ok!(FraudProofs::submit_fraud_proof(RuntimeOrigin::signed(7), proof));
			SLASH_CALLS.with(|c| assert_eq!(c.borrow().as_slice(), &[(42, 7)]));
		});
	}

	#[test]
	fn invalid_proof_rejected() {
		// INV-FRAUD-002
		new_test_ext().execute_with(|| {
			let block_hash = mk_hash(3);
			let witness = witness_bytes(vec![mk_hash(1)], vec![vec![(0, mk_hash(2))]], 1);

			DisputedBlocks::<Test>::insert(
				block_hash,
				DisputedBlockMeta { number: 1, proposer: 10, rules_version: 1 },
			);
			SchedulerCommitments::<Test>::insert(block_hash, mk_hash(4));

			let proof = FraudProof {
				proof_type: ProofType::SchedulerMismatchV1,
				block_number: 1,
				block_hash,
				tx_set_commitment: mk_hash(5),
				claimed_scheduler_commitment: mk_hash(4),
				reexec_witness: witness,
				expected_hash: mk_hash(8),
				observed_hash: mk_hash(4),
				reporter: 8,
				nonce: 1,
			};

			assert_noop!(
				FraudProofs::submit_fraud_proof(RuntimeOrigin::signed(8), proof),
				Error::<Test>::NotFraudulent
			);

			SLASH_CALLS.with(|c| assert!(c.borrow().is_empty()));
		});
	}

	#[test]
	fn replay_proof_rejected() {
		// INV-FRAUD-003
		new_test_ext().execute_with(|| {
			let block_hash = mk_hash(6);
			let witness =
				witness_bytes(vec![mk_hash(1), mk_hash(2)], vec![vec![(0, mk_hash(9))], vec![(0, mk_hash(9))]],1);

			let expected = FraudProofs::recompute_scheduler_commitment_v1(&witness, 1).unwrap();
			let observed = mk_hash(10);

			DisputedBlocks::<Test>::insert(
				block_hash,
				DisputedBlockMeta { number: 1, proposer: 2, rules_version: 1 },
			);
			SchedulerCommitments::<Test>::insert(block_hash, observed);

			let proof = FraudProof {
				proof_type: ProofType::SchedulerMismatchV1,
				block_number: 1,
				block_hash,
				tx_set_commitment: mk_hash(11),
				claimed_scheduler_commitment: observed,
				reexec_witness: witness,
				expected_hash: expected,
				observed_hash: observed,
				reporter: 3,
				nonce: 7,
			};

			assert_ok!(FraudProofs::submit_fraud_proof(RuntimeOrigin::signed(3), proof.clone()));
			assert_noop!(
				FraudProofs::submit_fraud_proof(RuntimeOrigin::signed(3), proof),
				Error::<Test>::ReplayProof
			);
		});
	}

	#[test]
	fn outside_dispute_window_rejected() {
		// INV-FRAUD-004
		new_test_ext().execute_with(|| {
			let block_hash = mk_hash(12);
			let witness = witness_bytes(
				vec![mk_hash(1), mk_hash(2)],
				vec![vec![(0, mk_hash(9))], vec![(0, mk_hash(9))]],
				1,
			);
			let expected = FraudProofs::recompute_scheduler_commitment_v1(&witness, 1).unwrap();
			let observed = mk_hash(13);

			DisputedBlocks::<Test>::insert(
				block_hash,
				DisputedBlockMeta { number: 1, proposer: 55, rules_version: 1 },
			);
			SchedulerCommitments::<Test>::insert(block_hash, observed);
			System::set_block_number(300);

			let proof = FraudProof {
				proof_type: ProofType::SchedulerMismatchV1,
				block_number: 1,
				block_hash,
				tx_set_commitment: mk_hash(14),
				claimed_scheduler_commitment: observed,
				reexec_witness: witness,
				expected_hash: expected,
				observed_hash: observed,
				reporter: 66,
				nonce: 0,
			};

			assert_noop!(
				FraudProofs::submit_fraud_proof(RuntimeOrigin::signed(66), proof),
				Error::<Test>::OutsideDisputeWindow
			);
		});
	}

	#[test]
	fn witness_too_large_rejected() {
		// INV-FRAUD-004, INV-FRAUD-006
		new_test_ext().execute_with(|| {
			let block_hash = mk_hash(15);

			DisputedBlocks::<Test>::insert(
				block_hash,
				DisputedBlockMeta { number: 1, proposer: 1, rules_version: 1 },
			);
			SchedulerCommitments::<Test>::insert(block_hash, mk_hash(16));

			let proof = FraudProof {
				proof_type: ProofType::SchedulerMismatchV1,
				block_number: 1,
				block_hash,
				tx_set_commitment: mk_hash(17),
				claimed_scheduler_commitment: mk_hash(16),
				reexec_witness: vec![0u8; 2048],
				expected_hash: mk_hash(18),
				observed_hash: mk_hash(16),
				reporter: 9,
				nonce: 0,
			};

			assert_noop!(
				FraudProofs::submit_fraud_proof(RuntimeOrigin::signed(9), proof),
				Error::<Test>::WitnessTooLarge
			);
		});
	}

	#[test]
	fn rejects_noncanonical_tx_ids() {
		// INV-FRAUD-005
		new_test_ext().execute_with(|| {
			let bad = witness_bytes(vec![mk_hash(2), mk_hash(1)], vec![vec![], vec![]], 1);
			let r = FraudProofs::recompute_scheduler_commitment_v1(&bad, 1);
			assert!(matches!(r, Err(Error::<Test>::InvalidWitnessEncoding)));
		});
	}

	#[test]
	fn deterministic_recompute_same_witness() {
		// INV-FRAUD-007
		new_test_ext().execute_with(|| {
			let w = witness_bytes(
				vec![mk_hash(1), mk_hash(2), mk_hash(3)],
				vec![vec![(0, mk_hash(10))], vec![(0, mk_hash(11))], vec![(0, mk_hash(10))]],
				1,
			);

			let a = FraudProofs::recompute_scheduler_commitment_v1(&w, 1).unwrap();
			let b = FraudProofs::recompute_scheduler_commitment_v1(&w, 1).unwrap();
			assert_eq!(a, b);
		});
	}

	#[test]
	fn freeze_ai_toggle() {
		new_test_ext().execute_with(|| {
			assert!(!FraudProofs::freeze_ai());
			assert_ok!(FraudProofs::set_freeze_ai(RuntimeOrigin::root(), true));
			assert!(FraudProofs::freeze_ai());
			assert_ok!(FraudProofs::set_freeze_ai(RuntimeOrigin::root(), false));
			assert!(!FraudProofs::freeze_ai());
		});
	}

	#[test]
	fn freeze_does_not_disable_fraud_proof_path() {
		// INV-FRAUD-008
		new_test_ext().execute_with(|| {
			assert_ok!(FraudProofs::set_freeze_ai(RuntimeOrigin::root(), true));

			let block_hash = mk_hash(1);
			let witness = witness_bytes(
				vec![mk_hash(1), mk_hash(2)],
				vec![vec![(0, mk_hash(9))], vec![(0, mk_hash(9))]],
				1,
			);

			let expected = FraudProofs::recompute_scheduler_commitment_v1(&witness, 1).unwrap();
			let observed = mk_hash(200);

			DisputedBlocks::<Test>::insert(
				block_hash,
				DisputedBlockMeta { number: 1, proposer: 42, rules_version: 1 },
			);
			SchedulerCommitments::<Test>::insert(block_hash, observed);

			let proof = FraudProof {
				proof_type: ProofType::SchedulerMismatchV1,
				block_number: 1,
				block_hash,
				tx_set_commitment: mk_hash(2),
				claimed_scheduler_commitment: observed,
				reexec_witness: witness,
				expected_hash: expected,
				observed_hash: observed,
				reporter: 7,
				nonce: 0,
			};

			assert_ok!(FraudProofs::submit_fraud_proof(RuntimeOrigin::signed(7), proof));
		});
	}
}
````

---

### 4) Mock config

````rust
// filepath: /home/lojak/Desktop/x3-chain-master/pallets/fraud-proofs/src/mock.rs
use crate as pallet_fraud_proofs;
use frame_support::{construct_runtime, parameter_types};
use sp_core::H256;
use sp_runtime::{traits::IdentityLookup, BuildStorage};
use std::cell::RefCell;

type Block = frame_system::mocking::MockBlock<Test>;

thread_local! {
	pub static SLASH_CALLS: RefCell<Vec<(u64, u64)>> = RefCell::new(Vec::new());
}

pub struct MockSlashHandler;
impl pallet_fraud_proofs::pallet::SlashHandler<u64> for MockSlashHandler {
	fn slash_proposer_and_reward_reporter(
		proposer: &u64,
		reporter: &u64,
	) -> frame_support::dispatch::DispatchResult {
		SLASH_CALLS.with(|c| c.borrow_mut().push((*proposer, *reporter)));
		Ok(())
	}
}

construct_runtime!(
	pub enum Test {
		System: frame_system,
		FraudProofs: pallet_fraud_proofs,
	}
);

parameter_types! {
	pub const BlockHashCount: u64 = 250;
	pub const MaxWitnessBytes: u32 = 65536;
	pub const DisputeWindowBlocks: u64 = 256;
	pub const MaxTxsPerBlock: u32 = 1024;
	pub const MaxAccessesPerTx: u32 = 256;
}

impl frame_system::Config for Test {
	type BaseCallFilter = frame_support::traits::Everything;
	type BlockWeights = ();
	type BlockLength = ();
	type RuntimeDbWeight = ();
	type RuntimeOrigin = RuntimeOrigin;
	type RuntimeCall = RuntimeCall;
	type RuntimeEvent = RuntimeEvent;
	type RuntimeTask = ();
	type Nonce = u64;
	type Hash = H256;
	type Hashing = sp_runtime::traits::BlakeTwo256;
	type AccountId = u64;
	type Lookup = IdentityLookup<Self::AccountId>;
	type Block = Block;
	type BlockHashCount = BlockHashCount;
	type Version = ();
	type PalletInfo = PalletInfo;
	type AccountData = ();
	type OnNewAccount = ();
	type OnKilledAccount = ();
	type SystemWeightInfo = ();
	type SS58Prefix = ();
	type OnSetCode = ();
	type MaxConsumers = frame_support::traits::ConstU32<16>;
	type SingleBlockMigrations = ();
	type MultiBlockMigrator = ();
	type PreInherents = ();
	type Post
```


## License: GPL-3.0
https://github.com/zeitgeistpm/zeitgeist/blob/2d0277bea7ba5796733b1db4db484dc73f30e23c/runtime/src/tests/multiplier.rs

```
Understood. Reading instructions now and resuming **Step 3: freeze/rollback hooks** with proper adherence to repo conventions.

First, checking the **authoritative guidance**:

````bash
cd /home/lojak/Desktop/x3-chain-master
cat openspec/AGENTS.md | head -100
cat AGENTS.md
cat tests/README.md | head -50
cat tests/invariants/registry.toml | grep -A5 "INV-FRAUD"
````

Then regenerating **Step 3** properly:

---

### 1) Update OpenSpec tasks with invariant linking

````md
<!-- filepath: /home/lojak/Desktop/x3-chain-master/openspec/changes/committee-reexec-fraudproofs-v0/tasks.md -->
# Tasks (Updated)

## Spec
- [ ] Finalize `proposal.md`
- [ ] Finalize `design.md`
- [ ] Finalize `witness-encoding-v0.md`
- [ ] Run `openspec validate committee-reexec-fraudproofs-v0 --strict`

## Runtime Implementation (MVP)
- [ ] Add `submit_fraud_proof` extrinsic with deterministic verification
- [ ] Add witness decode + canonical validation (`SchedulerWitnessV1`)
- [ ] Add `set_freeze_ai` / `set_rollback_target` extrinsics (governance-gated)
- [ ] Add `ensure_ai_enabled()` hook for consensus-critical paths
- [ ] Add storage: `FreezeAi`, `RollbackTarget`, `ProofsSeen`, `DisputedBlocks`
- [ ] Implement deterministic graph/order recomputation from witness
- [ ] Integrate with runtime slashing handler

## Tests (linked to invariants)
- [ ] **INV-FRAUD-001**: Valid proof slashes proposer and rewards reporter
- [ ] **INV-FRAUD-002**: Invalid proof rejected deterministically
- [ ] **INV-FRAUD-003**: Replay protection (ProofsSeen)
- [ ] **INV-FRAUD-004**: Bounds enforcement (witness size, access counts)
- [ ] **INV-FRAUD-005**: Canonical tx/access ordering enforced
- [ ] **INV-FRAUD-006**: Witness-bounded verification
- [ ] **INV-FRAUD-007**: Scheduler commitment deterministic recompute
- [ ] **INV-FRAUD-008**: Freeze preserves fraud-proof liveness

## Quality gates (before PR)
- [ ] `cargo fmt --all --check`
- [ ] `cargo clippy --all-targets --all-features -- -D warnings`
- [ ] `cargo test --workspace`
- [ ] `cargo test -p pallet-fraud-proofs`
- [ ] `openspec validate committee-reexec-fraudproofs-v0 --strict`
- [ ] All invariant links verified in registry.toml
````

---

### 2) Proper pallet config with FRAME conventions

````rust
// filepath: /home/lojak/Desktop/x3-chain-master/pallets/fraud-proofs/src/lib.rs
#![cfg_attr(not(feature = "std"), no_std)]

pub use pallet::*;

#[frame_support::pallet]
pub mod pallet {
	use codec::{Compact, Decode, Encode};
	use frame_support::{
		dispatch::DispatchResult,
		pallet_prelude::*,
		traits::Get,
		Blake2_128Concat,
	};
	use frame_system::pallet_prelude::*;
	use scale_info::TypeInfo;
	use sp_core::H256;
	use sp_runtime::traits::Saturating;
	use sp_std::{collections::btree_set::BTreeSet, vec::Vec};

	#[derive(Encode, Decode, Clone, Copy, Eq, PartialEq, RuntimeDebug, TypeInfo, MaxEncodedLen)]
	pub enum ProofType {
		SchedulerMismatchV1 = 1,
	}

	#[derive(Encode, Decode, Clone, Eq, PartialEq, RuntimeDebug, TypeInfo, MaxEncodedLen)]
	pub struct AccessKeyV1 {
		pub domain: u8,
		pub key: H256,
	}

	#[derive(Encode, Decode, Clone, Eq, PartialEq, RuntimeDebug, TypeInfo)]
	pub struct AccessListV1 {
		pub access_count: Compact<u32>,
		pub accesses: Vec<AccessKeyV1>,
	}

	#[derive(Encode, Decode, Clone, Eq, PartialEq, RuntimeDebug, TypeInfo)]
	pub struct SchedulerWitnessV1 {
		pub version: u8,
		pub rules_version: u32,
		pub tx_count: Compact<u32>,
		pub tx_ids: Vec<H256>,
		pub access_lists: Vec<AccessListV1>,
		pub reserved: Vec<u8>,
	}

	#[derive(Encode, Decode, Clone, Eq, PartialEq, RuntimeDebug, TypeInfo)]
	pub struct FraudProof<AccountId, BlockNumber> {
		pub proof_type: ProofType,
		pub block_number: BlockNumber,
		pub block_hash: H256,
		pub tx_set_commitment: H256,
		pub claimed_scheduler_commitment: H256,
		pub reexec_witness: Vec<u8>,
		pub expected_hash: H256,
		pub observed_hash: H256,
		pub reporter: AccountId,
		pub nonce: u64,
	}

	#[derive(Encode, Decode, Clone, Eq, PartialEq, RuntimeDebug, TypeInfo, MaxEncodedLen)]
	pub struct DisputedBlockMeta<AccountId, BlockNumber> {
		pub number: BlockNumber,
		pub proposer: AccountId,
		pub rules_version: u32,
	}

	pub trait SlashHandler<AccountId> {
		fn slash_proposer_and_reward_reporter(proposer: &AccountId, reporter: &AccountId) -> DispatchResult;
	}

	#[pallet::config]
	pub trait Config: frame_system::Config {
		type RuntimeEvent: From<Event<Self>> + IsType<<Self as frame_system::Config>::RuntimeEvent>;

		#[pallet::constant]
		type MaxWitnessBytes: Get<u32>;

		#[pallet::constant]
		type DisputeWindowBlocks: Get<BlockNumberFor<Self>>;

		#[pallet::constant]
		type MaxTxsPerBlock: Get<u32>;

		#[pallet::constant]
		type MaxAccessesPerTx: Get<u32>;

		type SlashHandler: SlashHandler<Self::AccountId>;

		/// Origin allowed to set freeze/rollback state.
		type FreezeOrigin: EnsureOrigin<Self::RuntimeOrigin>;
	}

	#[pallet::pallet]
	pub struct Pallet<T>(_);

	/// Replay protection: proof_id -> ()
	#[pallet::storage]
	pub type ProofsSeen<T: Config> = StorageMap<_, Blake2_128Concat, H256, (), OptionQuery>;

	/// Disputed block metadata.
	#[pallet::storage]
	pub type DisputedBlocks<T: Config> =
		StorageMap<_, Blake2_128Concat, H256, DisputedBlockMeta<T::AccountId, BlockNumberFor<T>>, OptionQuery>;

	/// Scheduler commitments observed in blocks.
	#[pallet::storage]
	pub type SchedulerCommitments<T: Config> = StorageMap<_, Blake2_128Concat, H256, H256, OptionQuery>;

	/// Global freeze flag for AI consensus-critical syscalls.
	#[pallet::storage]
	#[pallet::getter(fn freeze_ai)]
	pub type FreezeAi<T: Config> = StorageValue<_, bool, ValueQuery>;

	#[pallet::error]
	pub enum Error<T> {
		InvalidProofType,
		BlockUnknown,
		OutsideDisputeWindow,
		WitnessTooLarge,
		CommitmentMismatch,
		NotFraudulent,
		ReplayProof,
		ReporterMismatch,
		InvalidWitnessEncoding,
		ClaimedObservedMismatch,
		AiFrozen,
	}

	#[pallet::event]
	#[pallet::generate_deposit(pub(super) fn deposit_event)]
	pub enum Event<T: Config> {
		FraudProofAccepted {
			proof_id: H256,
			block_hash: H256,
			proposer: T::AccountId,
			reporter: T::AccountId,
		},
		FreezeAiSet {
			frozen: bool,
		},
	}

	#[pallet::call]
	impl<T: Config> Pallet<T> {
		/// Submit a fraud proof to dispute a scheduler commitment.
		#[pallet::call_index(0)]
		#[pallet::weight(10_000)]
		pub fn submit_fraud_proof(
			origin: OriginFor<T>,
			proof: FraudProof<T::AccountId, BlockNumberFor<T>>,
		) -> DispatchResult {
			let who = ensure_signed(origin)?;
			ensure!(who == proof.reporter, Error::<T>::ReporterMismatch);

			ensure!(
				matches!(proof.proof_type, ProofType::SchedulerMismatchV1),
				Error::<T>::InvalidProofType
			);
			ensure!(
				(proof.reexec_witness.len() as u32) <= T::MaxWitnessBytes::get(),
				Error::<T>::WitnessTooLarge
			);

			let meta = DisputedBlocks::<T>::get(proof.block_hash).ok_or(Error::<T>::BlockUnknown)?;
			let observed = SchedulerCommitments::<T>::get(proof.block_hash).ok_or(Error::<T>::BlockUnknown)?;

			// Time bound
			let now = <frame_system::Pallet<T>>::block_number();
			let age = now.saturating_sub(meta.number);
			ensure!(age <= T::DisputeWindowBlocks::get(), Error::<T>::OutsideDisputeWindow);

			// Verify claimed == observed
			ensure!(proof.claimed_scheduler_commitment == observed, Error::<T>::ClaimedObservedMismatch);
			ensure!(observed == proof.observed_hash, Error::<T>::CommitmentMismatch);

			// Recompute and check fraud
			let recomputed = Self::recompute_scheduler_commitment_v1(&proof.reexec_witness, meta.rules_version)?;
			ensure!(recomputed == proof.expected_hash, Error::<T>::CommitmentMismatch);
			ensure!(recomputed != observed, Error::<T>::NotFraudulent);

			// Replay check
			let proof_id = Self::proof_id(&proof);
			ensure!(!ProofsSeen::<T>::contains_key(proof_id), Error::<T>::ReplayProof);

			// Slash and reward
			T::SlashHandler::slash_proposer_and_reward_reporter(&meta.proposer, &proof.reporter)?;

			// Mark consumed
			ProofsSeen::<T>::insert(proof_id, ());
			Self::deposit_event(Event::FraudProofAccepted {
				proof_id,
				block_hash: proof.block_hash,
				proposer: meta.proposer,
				reporter: proof.reporter,
			});

			Ok(())
		}

		/// Freeze or unfreeze AI consensus-critical syscalls.
		#[pallet::call_index(10)]
		#[pallet::weight(10_000)]
		pub fn set_freeze_ai(origin: OriginFor<T>, frozen: bool) -> DispatchResult {
			T::FreezeOrigin::ensure_origin(origin)?;
			FreezeAi::<T>::put(frozen);
			Self::deposit_event(Event::FreezeAiSet { frozen });
			Ok(())
		}
	}

	impl<T: Config> Pallet<T> {
		/// Hook for consensus-critical AI paths. Return error if frozen.
		pub fn ensure_ai_enabled() -> Result<(), Error<T>> {
			ensure!(!FreezeAi::<T>::get(), Error::<T>::AiFrozen);
			Ok(())
		}

		pub fn recompute_scheduler_commitment_v1(
			witness_bytes: &[u8],
			expected_rules_version: u32,
		) -> Result<H256, Error<T>> {
			let w = Self::parse_witness_v1(witness_bytes)?;
			Self::validate_canonical_witness_v1(&w, expected_rules_version)?;

			let n = w.tx_ids.len();
			let mut edges: Vec<Vec<usize>> = vec![Vec::new(); n];

			for i in 0..n {
				for j in (i + 1)..n {
					if Self::has_conflict(&w.access_lists[i].accesses, &w.access_lists[j].accesses) {
						edges[i].push(j);
					}
				}
			}

			let graph_bytes = Self::encode_graph(&edges);
			let order = Self::topo_order(&edges, n)?;
			let order_bytes = Self::encode_order(&order);

			let graph_commitment = Self::h(&graph_bytes);
			let order_commitment = Self::h(&order_bytes);
			let tx_set_commitment = Self::h(&w.tx_ids.encode());

			let mut preimage = Vec::new();
			preimage.extend_from_slice(graph_commitment.as_bytes());
			preimage.extend_from_slice(order_commitment.as_bytes());
			preimage.extend_from_slice(tx_set_commitment.as_bytes());
			preimage.extend_from_slice(&w.rules_version.encode());

			Ok(Self::h(&preimage))
		}

		fn parse_witness_v1(bytes: &[u8]) -> Result<SchedulerWitnessV1, Error<T>> {
			ensure!((bytes.len() as u32) <= T::MaxWitnessBytes::get(), Error::<T>::WitnessTooLarge);
			let mut input = bytes;
			let w = SchedulerWitnessV1::decode(&mut input)
				.map_err(|_| Error::<T>::InvalidWitnessEncoding)?;
			ensure!(input.is_empty(), Error::<T>::InvalidWitnessEncoding);
			ensure!(w.version == 1, Error::<T>::InvalidWitnessEncoding);
			Ok(w)
		}

		fn validate_canonical_witness_v1(
			w: &SchedulerWitnessV1,
			expected_rules_version: u32,
		) -> Result<(), Error<T>> {
			ensure!(w.rules_version == expected_rules_version, Error::<T>::InvalidWitnessEncoding);
			let tx_count = w.tx_count.0 as usize;
			ensure!(tx_count == w.tx_ids.len(), Error::<T>::InvalidWitnessEncoding);
			ensure!(tx_count == w.access_lists.len(), Error::<T>::InvalidWitnessEncoding);
			ensure!((tx_count as u32) <= T::MaxTxsPerBlock::get(), Error::<T>::InvalidWitnessEncoding);
			ensure!(w.reserved.is_empty(), Error::<T>::InvalidWitnessEncoding);

			for i in 1..w.tx_ids.len() {
				ensure!(w.tx_ids[i - 1] < w.tx_ids[i], Error::<T>::InvalidWitnessEncoding);
			}

			for al in &w.access_lists {
				let c = al.access_count.0 as usize;
				ensure!(c == al.accesses.len(), Error::<T>::InvalidWitnessEncoding);
				ensure!((c as u32) <= T::MaxAccessesPerTx::get(), Error::<T>::InvalidWitnessEncoding);
				for i in 1..al.accesses.len() {
					ensure!(al.accesses[i - 1] < al.accesses[i], Error::<T>::InvalidWitnessEncoding);
				}
			}
			Ok(())
		}

		fn has_conflict(a: &[AccessKeyV1], b: &[AccessKeyV1]) -> bool {
			let (mut i, mut j) = (0usize, 0usize);
			while i < a.len() && j < b.len() {
				if a[i] == b[j] {
					return true;
				}
				if a[i] < b[j] {
					i += 1;
				} else {
					j += 1;
				}
			}
			false
		}

		fn topo_order(edges: &[Vec<usize>], n: usize) -> Result<Vec<usize>, Error<T>> {
			let mut indeg = vec![0u32; n];
			for outs in edges {
				for &j in outs {
					indeg[j] = indeg[j].saturating_add(1);
				}
			}
			let mut ready = BTreeSet::new();
			for (i, &d) in indeg.iter().enumerate() {
				if d == 0 {
					ready.insert(i);
				}
			}
			let mut out = Vec::with_capacity(n);
			while let Some(&i) = ready.iter().next() {
				ready.remove(&i);
				out.push(i);
				for &j in &edges[i] {
					indeg[j] -= 1;
					if indeg[j] == 0 {
						ready.insert(j);
					}
				}
			}
			ensure!(out.len() == n, Error::<T>::InvalidWitnessEncoding);
			Ok(out)
		}

		fn encode_graph(edges: &[Vec<usize>]) -> Vec<u8> {
			let mut bytes = Compact(edges.len() as u32).encode();
			for outs in edges {
				bytes.extend(Compact(outs.len() as u32).encode());
				for &j in outs {
					bytes.extend(Compact(j as u32).encode());
				}
			}
			bytes
		}

		fn encode_order(order: &[usize]) -> Vec<u8> {
			let mut bytes = Compact(order.len() as u32).encode();
			for &i in order {
				bytes.extend(Compact(i as u32).encode());
			}
			bytes
		}

		fn h(data: &[u8]) -> H256 {
			H256::from(sp_io::hashing::blake2_256(data))
		}

		fn proof_id(proof: &FraudProof<T::AccountId, BlockNumberFor<T>>) -> H256 {
			H256::from(sp_io::hashing::blake2_256(&proof.encode()))
		}
	}
}
````

---

### 3) Tests with proper invariant references

````rust
// filepath: /home/lojak/Desktop/x3-chain-master/pallets/fraud-proofs/src/tests.rs
#[cfg(test)]
mod tests {
	use super::*;
	use crate::mock::*;
	use crate::pallet::{DisputedBlockMeta, Error, FraudProof, ProofType};
	use codec::Encode;
	use frame_support::{assert_noop, assert_ok};
	use sp_core::H256;

	fn mk_hash(b: u8) -> H256 {
		H256::from([b; 32])
	}

	fn witness_bytes(
		tx_ids: Vec<H256>,
		access_lists: Vec<Vec<(u8, H256)>>,
		rules_version: u32,
	) -> Vec<u8> {
		let al = access_lists
			.into_iter()
			.map(|v| {
				let mut sorted = v;
				sorted.sort_by(|a, b| (a.0, a.1).cmp(&(b.0, b.1)));
				AccessListV1 {
					access_count: Compact(sorted.len() as u32),
					accesses: sorted
						.into_iter()
						.map(|(d, k)| AccessKeyV1 { domain: d, key: k })
						.collect(),
				}
			})
			.collect::<Vec<_>>();

		SchedulerWitnessV1 {
			version: 1,
			rules_version,
			tx_count: Compact(tx_ids.len() as u32),
			tx_ids,
			access_lists: al,
			reserved: vec![],
		}
		.encode()
	}

	#[test]
	fn valid_scheduler_mismatch_slashes_proposer() {
		// INV-FRAUD-001
		new_test_ext().execute_with(|| {
			let block_hash = mk_hash(1);
			let witness = witness_bytes(
				vec![mk_hash(1), mk_hash(2)],
				vec![vec![(0, mk_hash(9))], vec![(0, mk_hash(9))]],
				1,
			);

			let expected = FraudProofs::recompute_scheduler_commitment_v1(&witness, 1).unwrap();
			let observed = mk_hash(99);

			DisputedBlocks::<Test>::insert(
				block_hash,
				DisputedBlockMeta { number: 1, proposer: 42, rules_version: 1 },
			);
			SchedulerCommitments::<Test>::insert(block_hash, observed);

			let proof = FraudProof {
				proof_type: ProofType::SchedulerMismatchV1,
				block_number: 1,
				block_hash,
				tx_set_commitment: mk_hash(2),
				claimed_scheduler_commitment: observed,
				reexec_witness: witness,
				expected_hash: expected,
				observed_hash: observed,
				reporter: 7,
				nonce: 0,
			};

			assert_ok!(FraudProofs::submit_fraud_proof(RuntimeOrigin::signed(7), proof));
			SLASH_CALLS.with(|c| assert_eq!(c.borrow().as_slice(), &[(42, 7)]));
		});
	}

	#[test]
	fn invalid_proof_rejected() {
		// INV-FRAUD-002
		new_test_ext().execute_with(|| {
			let block_hash = mk_hash(3);
			let witness = witness_bytes(vec![mk_hash(1)], vec![vec![(0, mk_hash(2))]], 1);

			DisputedBlocks::<Test>::insert(
				block_hash,
				DisputedBlockMeta { number: 1, proposer: 10, rules_version: 1 },
			);
			SchedulerCommitments::<Test>::insert(block_hash, mk_hash(4));

			let proof = FraudProof {
				proof_type: ProofType::SchedulerMismatchV1,
				block_number: 1,
				block_hash,
				tx_set_commitment: mk_hash(5),
				claimed_scheduler_commitment: mk_hash(4),
				reexec_witness: witness,
				expected_hash: mk_hash(8),
				observed_hash: mk_hash(4),
				reporter: 8,
				nonce: 1,
			};

			assert_noop!(
				FraudProofs::submit_fraud_proof(RuntimeOrigin::signed(8), proof),
				Error::<Test>::NotFraudulent
			);

			SLASH_CALLS.with(|c| assert!(c.borrow().is_empty()));
		});
	}

	#[test]
	fn replay_proof_rejected() {
		// INV-FRAUD-003
		new_test_ext().execute_with(|| {
			let block_hash = mk_hash(6);
			let witness =
				witness_bytes(vec![mk_hash(1), mk_hash(2)], vec![vec![(0, mk_hash(9))], vec![(0, mk_hash(9))]],1);

			let expected = FraudProofs::recompute_scheduler_commitment_v1(&witness, 1).unwrap();
			let observed = mk_hash(10);

			DisputedBlocks::<Test>::insert(
				block_hash,
				DisputedBlockMeta { number: 1, proposer: 2, rules_version: 1 },
			);
			SchedulerCommitments::<Test>::insert(block_hash, observed);

			let proof = FraudProof {
				proof_type: ProofType::SchedulerMismatchV1,
				block_number: 1,
				block_hash,
				tx_set_commitment: mk_hash(11),
				claimed_scheduler_commitment: observed,
				reexec_witness: witness,
				expected_hash: expected,
				observed_hash: observed,
				reporter: 3,
				nonce: 7,
			};

			assert_ok!(FraudProofs::submit_fraud_proof(RuntimeOrigin::signed(3), proof.clone()));
			assert_noop!(
				FraudProofs::submit_fraud_proof(RuntimeOrigin::signed(3), proof),
				Error::<Test>::ReplayProof
			);
		});
	}

	#[test]
	fn outside_dispute_window_rejected() {
		// INV-FRAUD-004
		new_test_ext().execute_with(|| {
			let block_hash = mk_hash(12);
			let witness = witness_bytes(
				vec![mk_hash(1), mk_hash(2)],
				vec![vec![(0, mk_hash(9))], vec![(0, mk_hash(9))]],
				1,
			);
			let expected = FraudProofs::recompute_scheduler_commitment_v1(&witness, 1).unwrap();
			let observed = mk_hash(13);

			DisputedBlocks::<Test>::insert(
				block_hash,
				DisputedBlockMeta { number: 1, proposer: 55, rules_version: 1 },
			);
			SchedulerCommitments::<Test>::insert(block_hash, observed);
			System::set_block_number(300);

			let proof = FraudProof {
				proof_type: ProofType::SchedulerMismatchV1,
				block_number: 1,
				block_hash,
				tx_set_commitment: mk_hash(14),
				claimed_scheduler_commitment: observed,
				reexec_witness: witness,
				expected_hash: expected,
				observed_hash: observed,
				reporter: 66,
				nonce: 0,
			};

			assert_noop!(
				FraudProofs::submit_fraud_proof(RuntimeOrigin::signed(66), proof),
				Error::<Test>::OutsideDisputeWindow
			);
		});
	}

	#[test]
	fn witness_too_large_rejected() {
		// INV-FRAUD-004, INV-FRAUD-006
		new_test_ext().execute_with(|| {
			let block_hash = mk_hash(15);

			DisputedBlocks::<Test>::insert(
				block_hash,
				DisputedBlockMeta { number: 1, proposer: 1, rules_version: 1 },
			);
			SchedulerCommitments::<Test>::insert(block_hash, mk_hash(16));

			let proof = FraudProof {
				proof_type: ProofType::SchedulerMismatchV1,
				block_number: 1,
				block_hash,
				tx_set_commitment: mk_hash(17),
				claimed_scheduler_commitment: mk_hash(16),
				reexec_witness: vec![0u8; 2048],
				expected_hash: mk_hash(18),
				observed_hash: mk_hash(16),
				reporter: 9,
				nonce: 0,
			};

			assert_noop!(
				FraudProofs::submit_fraud_proof(RuntimeOrigin::signed(9), proof),
				Error::<Test>::WitnessTooLarge
			);
		});
	}

	#[test]
	fn rejects_noncanonical_tx_ids() {
		// INV-FRAUD-005
		new_test_ext().execute_with(|| {
			let bad = witness_bytes(vec![mk_hash(2), mk_hash(1)], vec![vec![], vec![]], 1);
			let r = FraudProofs::recompute_scheduler_commitment_v1(&bad, 1);
			assert!(matches!(r, Err(Error::<Test>::InvalidWitnessEncoding)));
		});
	}

	#[test]
	fn deterministic_recompute_same_witness() {
		// INV-FRAUD-007
		new_test_ext().execute_with(|| {
			let w = witness_bytes(
				vec![mk_hash(1), mk_hash(2), mk_hash(3)],
				vec![vec![(0, mk_hash(10))], vec![(0, mk_hash(11))], vec![(0, mk_hash(10))]],
				1,
			);

			let a = FraudProofs::recompute_scheduler_commitment_v1(&w, 1).unwrap();
			let b = FraudProofs::recompute_scheduler_commitment_v1(&w, 1).unwrap();
			assert_eq!(a, b);
		});
	}

	#[test]
	fn freeze_ai_toggle() {
		new_test_ext().execute_with(|| {
			assert!(!FraudProofs::freeze_ai());
			assert_ok!(FraudProofs::set_freeze_ai(RuntimeOrigin::root(), true));
			assert!(FraudProofs::freeze_ai());
			assert_ok!(FraudProofs::set_freeze_ai(RuntimeOrigin::root(), false));
			assert!(!FraudProofs::freeze_ai());
		});
	}

	#[test]
	fn freeze_does_not_disable_fraud_proof_path() {
		// INV-FRAUD-008
		new_test_ext().execute_with(|| {
			assert_ok!(FraudProofs::set_freeze_ai(RuntimeOrigin::root(), true));

			let block_hash = mk_hash(1);
			let witness = witness_bytes(
				vec![mk_hash(1), mk_hash(2)],
				vec![vec![(0, mk_hash(9))], vec![(0, mk_hash(9))]],
				1,
			);

			let expected = FraudProofs::recompute_scheduler_commitment_v1(&witness, 1).unwrap();
			let observed = mk_hash(200);

			DisputedBlocks::<Test>::insert(
				block_hash,
				DisputedBlockMeta { number: 1, proposer: 42, rules_version: 1 },
			);
			SchedulerCommitments::<Test>::insert(block_hash, observed);

			let proof = FraudProof {
				proof_type: ProofType::SchedulerMismatchV1,
				block_number: 1,
				block_hash,
				tx_set_commitment: mk_hash(2),
				claimed_scheduler_commitment: observed,
				reexec_witness: witness,
				expected_hash: expected,
				observed_hash: observed,
				reporter: 7,
				nonce: 0,
			};

			assert_ok!(FraudProofs::submit_fraud_proof(RuntimeOrigin::signed(7), proof));
		});
	}
}
````

---

### 4) Mock config

````rust
// filepath: /home/lojak/Desktop/x3-chain-master/pallets/fraud-proofs/src/mock.rs
use crate as pallet_fraud_proofs;
use frame_support::{construct_runtime, parameter_types};
use sp_core::H256;
use sp_runtime::{traits::IdentityLookup, BuildStorage};
use std::cell::RefCell;

type Block = frame_system::mocking::MockBlock<Test>;

thread_local! {
	pub static SLASH_CALLS: RefCell<Vec<(u64, u64)>> = RefCell::new(Vec::new());
}

pub struct MockSlashHandler;
impl pallet_fraud_proofs::pallet::SlashHandler<u64> for MockSlashHandler {
	fn slash_proposer_and_reward_reporter(
		proposer: &u64,
		reporter: &u64,
	) -> frame_support::dispatch::DispatchResult {
		SLASH_CALLS.with(|c| c.borrow_mut().push((*proposer, *reporter)));
		Ok(())
	}
}

construct_runtime!(
	pub enum Test {
		System: frame_system,
		FraudProofs: pallet_fraud_proofs,
	}
);

parameter_types! {
	pub const BlockHashCount: u64 = 250;
	pub const MaxWitnessBytes: u32 = 65536;
	pub const DisputeWindowBlocks: u64 = 256;
	pub const MaxTxsPerBlock: u32 = 1024;
	pub const MaxAccessesPerTx: u32 = 256;
}

impl frame_system::Config for Test {
	type BaseCallFilter = frame_support::traits::Everything;
	type BlockWeights = ();
	type BlockLength = ();
	type RuntimeDbWeight = ();
	type RuntimeOrigin = RuntimeOrigin;
	type RuntimeCall = RuntimeCall;
	type RuntimeEvent = RuntimeEvent;
	type RuntimeTask = ();
	type Nonce = u64;
	type Hash = H256;
	type Hashing = sp_runtime::traits::BlakeTwo256;
	type AccountId = u64;
	type Lookup = IdentityLookup<Self::AccountId>;
	type Block = Block;
	type BlockHashCount = BlockHashCount;
	type Version = ();
	type PalletInfo = PalletInfo;
	type AccountData = ();
	type OnNewAccount = ();
	type OnKilledAccount = ();
	type SystemWeightInfo = ();
	type SS58Prefix = ();
	type OnSetCode = ();
	type MaxConsumers = frame_support::traits::ConstU32<16>;
	type SingleBlock
```


## License: Apache-2.0
https://github.com/Snowfork/snowbridge/blob/24b9d310809d937a83f6891f305b4976445e916a/parachain/pallets/outbound-queue/src/mock.rs

```
Understood. Reading instructions now and resuming **Step 3: freeze/rollback hooks** with proper adherence to repo conventions.

First, checking the **authoritative guidance**:

````bash
cd /home/lojak/Desktop/x3-chain-master
cat openspec/AGENTS.md | head -100
cat AGENTS.md
cat tests/README.md | head -50
cat tests/invariants/registry.toml | grep -A5 "INV-FRAUD"
````

Then regenerating **Step 3** properly:

---

### 1) Update OpenSpec tasks with invariant linking

````md
<!-- filepath: /home/lojak/Desktop/x3-chain-master/openspec/changes/committee-reexec-fraudproofs-v0/tasks.md -->
# Tasks (Updated)

## Spec
- [ ] Finalize `proposal.md`
- [ ] Finalize `design.md`
- [ ] Finalize `witness-encoding-v0.md`
- [ ] Run `openspec validate committee-reexec-fraudproofs-v0 --strict`

## Runtime Implementation (MVP)
- [ ] Add `submit_fraud_proof` extrinsic with deterministic verification
- [ ] Add witness decode + canonical validation (`SchedulerWitnessV1`)
- [ ] Add `set_freeze_ai` / `set_rollback_target` extrinsics (governance-gated)
- [ ] Add `ensure_ai_enabled()` hook for consensus-critical paths
- [ ] Add storage: `FreezeAi`, `RollbackTarget`, `ProofsSeen`, `DisputedBlocks`
- [ ] Implement deterministic graph/order recomputation from witness
- [ ] Integrate with runtime slashing handler

## Tests (linked to invariants)
- [ ] **INV-FRAUD-001**: Valid proof slashes proposer and rewards reporter
- [ ] **INV-FRAUD-002**: Invalid proof rejected deterministically
- [ ] **INV-FRAUD-003**: Replay protection (ProofsSeen)
- [ ] **INV-FRAUD-004**: Bounds enforcement (witness size, access counts)
- [ ] **INV-FRAUD-005**: Canonical tx/access ordering enforced
- [ ] **INV-FRAUD-006**: Witness-bounded verification
- [ ] **INV-FRAUD-007**: Scheduler commitment deterministic recompute
- [ ] **INV-FRAUD-008**: Freeze preserves fraud-proof liveness

## Quality gates (before PR)
- [ ] `cargo fmt --all --check`
- [ ] `cargo clippy --all-targets --all-features -- -D warnings`
- [ ] `cargo test --workspace`
- [ ] `cargo test -p pallet-fraud-proofs`
- [ ] `openspec validate committee-reexec-fraudproofs-v0 --strict`
- [ ] All invariant links verified in registry.toml
````

---

### 2) Proper pallet config with FRAME conventions

````rust
// filepath: /home/lojak/Desktop/x3-chain-master/pallets/fraud-proofs/src/lib.rs
#![cfg_attr(not(feature = "std"), no_std)]

pub use pallet::*;

#[frame_support::pallet]
pub mod pallet {
	use codec::{Compact, Decode, Encode};
	use frame_support::{
		dispatch::DispatchResult,
		pallet_prelude::*,
		traits::Get,
		Blake2_128Concat,
	};
	use frame_system::pallet_prelude::*;
	use scale_info::TypeInfo;
	use sp_core::H256;
	use sp_runtime::traits::Saturating;
	use sp_std::{collections::btree_set::BTreeSet, vec::Vec};

	#[derive(Encode, Decode, Clone, Copy, Eq, PartialEq, RuntimeDebug, TypeInfo, MaxEncodedLen)]
	pub enum ProofType {
		SchedulerMismatchV1 = 1,
	}

	#[derive(Encode, Decode, Clone, Eq, PartialEq, RuntimeDebug, TypeInfo, MaxEncodedLen)]
	pub struct AccessKeyV1 {
		pub domain: u8,
		pub key: H256,
	}

	#[derive(Encode, Decode, Clone, Eq, PartialEq, RuntimeDebug, TypeInfo)]
	pub struct AccessListV1 {
		pub access_count: Compact<u32>,
		pub accesses: Vec<AccessKeyV1>,
	}

	#[derive(Encode, Decode, Clone, Eq, PartialEq, RuntimeDebug, TypeInfo)]
	pub struct SchedulerWitnessV1 {
		pub version: u8,
		pub rules_version: u32,
		pub tx_count: Compact<u32>,
		pub tx_ids: Vec<H256>,
		pub access_lists: Vec<AccessListV1>,
		pub reserved: Vec<u8>,
	}

	#[derive(Encode, Decode, Clone, Eq, PartialEq, RuntimeDebug, TypeInfo)]
	pub struct FraudProof<AccountId, BlockNumber> {
		pub proof_type: ProofType,
		pub block_number: BlockNumber,
		pub block_hash: H256,
		pub tx_set_commitment: H256,
		pub claimed_scheduler_commitment: H256,
		pub reexec_witness: Vec<u8>,
		pub expected_hash: H256,
		pub observed_hash: H256,
		pub reporter: AccountId,
		pub nonce: u64,
	}

	#[derive(Encode, Decode, Clone, Eq, PartialEq, RuntimeDebug, TypeInfo, MaxEncodedLen)]
	pub struct DisputedBlockMeta<AccountId, BlockNumber> {
		pub number: BlockNumber,
		pub proposer: AccountId,
		pub rules_version: u32,
	}

	pub trait SlashHandler<AccountId> {
		fn slash_proposer_and_reward_reporter(proposer: &AccountId, reporter: &AccountId) -> DispatchResult;
	}

	#[pallet::config]
	pub trait Config: frame_system::Config {
		type RuntimeEvent: From<Event<Self>> + IsType<<Self as frame_system::Config>::RuntimeEvent>;

		#[pallet::constant]
		type MaxWitnessBytes: Get<u32>;

		#[pallet::constant]
		type DisputeWindowBlocks: Get<BlockNumberFor<Self>>;

		#[pallet::constant]
		type MaxTxsPerBlock: Get<u32>;

		#[pallet::constant]
		type MaxAccessesPerTx: Get<u32>;

		type SlashHandler: SlashHandler<Self::AccountId>;

		/// Origin allowed to set freeze/rollback state.
		type FreezeOrigin: EnsureOrigin<Self::RuntimeOrigin>;
	}

	#[pallet::pallet]
	pub struct Pallet<T>(_);

	/// Replay protection: proof_id -> ()
	#[pallet::storage]
	pub type ProofsSeen<T: Config> = StorageMap<_, Blake2_128Concat, H256, (), OptionQuery>;

	/// Disputed block metadata.
	#[pallet::storage]
	pub type DisputedBlocks<T: Config> =
		StorageMap<_, Blake2_128Concat, H256, DisputedBlockMeta<T::AccountId, BlockNumberFor<T>>, OptionQuery>;

	/// Scheduler commitments observed in blocks.
	#[pallet::storage]
	pub type SchedulerCommitments<T: Config> = StorageMap<_, Blake2_128Concat, H256, H256, OptionQuery>;

	/// Global freeze flag for AI consensus-critical syscalls.
	#[pallet::storage]
	#[pallet::getter(fn freeze_ai)]
	pub type FreezeAi<T: Config> = StorageValue<_, bool, ValueQuery>;

	#[pallet::error]
	pub enum Error<T> {
		InvalidProofType,
		BlockUnknown,
		OutsideDisputeWindow,
		WitnessTooLarge,
		CommitmentMismatch,
		NotFraudulent,
		ReplayProof,
		ReporterMismatch,
		InvalidWitnessEncoding,
		ClaimedObservedMismatch,
		AiFrozen,
	}

	#[pallet::event]
	#[pallet::generate_deposit(pub(super) fn deposit_event)]
	pub enum Event<T: Config> {
		FraudProofAccepted {
			proof_id: H256,
			block_hash: H256,
			proposer: T::AccountId,
			reporter: T::AccountId,
		},
		FreezeAiSet {
			frozen: bool,
		},
	}

	#[pallet::call]
	impl<T: Config> Pallet<T> {
		/// Submit a fraud proof to dispute a scheduler commitment.
		#[pallet::call_index(0)]
		#[pallet::weight(10_000)]
		pub fn submit_fraud_proof(
			origin: OriginFor<T>,
			proof: FraudProof<T::AccountId, BlockNumberFor<T>>,
		) -> DispatchResult {
			let who = ensure_signed(origin)?;
			ensure!(who == proof.reporter, Error::<T>::ReporterMismatch);

			ensure!(
				matches!(proof.proof_type, ProofType::SchedulerMismatchV1),
				Error::<T>::InvalidProofType
			);
			ensure!(
				(proof.reexec_witness.len() as u32) <= T::MaxWitnessBytes::get(),
				Error::<T>::WitnessTooLarge
			);

			let meta = DisputedBlocks::<T>::get(proof.block_hash).ok_or(Error::<T>::BlockUnknown)?;
			let observed = SchedulerCommitments::<T>::get(proof.block_hash).ok_or(Error::<T>::BlockUnknown)?;

			// Time bound
			let now = <frame_system::Pallet<T>>::block_number();
			let age = now.saturating_sub(meta.number);
			ensure!(age <= T::DisputeWindowBlocks::get(), Error::<T>::OutsideDisputeWindow);

			// Verify claimed == observed
			ensure!(proof.claimed_scheduler_commitment == observed, Error::<T>::ClaimedObservedMismatch);
			ensure!(observed == proof.observed_hash, Error::<T>::CommitmentMismatch);

			// Recompute and check fraud
			let recomputed = Self::recompute_scheduler_commitment_v1(&proof.reexec_witness, meta.rules_version)?;
			ensure!(recomputed == proof.expected_hash, Error::<T>::CommitmentMismatch);
			ensure!(recomputed != observed, Error::<T>::NotFraudulent);

			// Replay check
			let proof_id = Self::proof_id(&proof);
			ensure!(!ProofsSeen::<T>::contains_key(proof_id), Error::<T>::ReplayProof);

			// Slash and reward
			T::SlashHandler::slash_proposer_and_reward_reporter(&meta.proposer, &proof.reporter)?;

			// Mark consumed
			ProofsSeen::<T>::insert(proof_id, ());
			Self::deposit_event(Event::FraudProofAccepted {
				proof_id,
				block_hash: proof.block_hash,
				proposer: meta.proposer,
				reporter: proof.reporter,
			});

			Ok(())
		}

		/// Freeze or unfreeze AI consensus-critical syscalls.
		#[pallet::call_index(10)]
		#[pallet::weight(10_000)]
		pub fn set_freeze_ai(origin: OriginFor<T>, frozen: bool) -> DispatchResult {
			T::FreezeOrigin::ensure_origin(origin)?;
			FreezeAi::<T>::put(frozen);
			Self::deposit_event(Event::FreezeAiSet { frozen });
			Ok(())
		}
	}

	impl<T: Config> Pallet<T> {
		/// Hook for consensus-critical AI paths. Return error if frozen.
		pub fn ensure_ai_enabled() -> Result<(), Error<T>> {
			ensure!(!FreezeAi::<T>::get(), Error::<T>::AiFrozen);
			Ok(())
		}

		pub fn recompute_scheduler_commitment_v1(
			witness_bytes: &[u8],
			expected_rules_version: u32,
		) -> Result<H256, Error<T>> {
			let w = Self::parse_witness_v1(witness_bytes)?;
			Self::validate_canonical_witness_v1(&w, expected_rules_version)?;

			let n = w.tx_ids.len();
			let mut edges: Vec<Vec<usize>> = vec![Vec::new(); n];

			for i in 0..n {
				for j in (i + 1)..n {
					if Self::has_conflict(&w.access_lists[i].accesses, &w.access_lists[j].accesses) {
						edges[i].push(j);
					}
				}
			}

			let graph_bytes = Self::encode_graph(&edges);
			let order = Self::topo_order(&edges, n)?;
			let order_bytes = Self::encode_order(&order);

			let graph_commitment = Self::h(&graph_bytes);
			let order_commitment = Self::h(&order_bytes);
			let tx_set_commitment = Self::h(&w.tx_ids.encode());

			let mut preimage = Vec::new();
			preimage.extend_from_slice(graph_commitment.as_bytes());
			preimage.extend_from_slice(order_commitment.as_bytes());
			preimage.extend_from_slice(tx_set_commitment.as_bytes());
			preimage.extend_from_slice(&w.rules_version.encode());

			Ok(Self::h(&preimage))
		}

		fn parse_witness_v1(bytes: &[u8]) -> Result<SchedulerWitnessV1, Error<T>> {
			ensure!((bytes.len() as u32) <= T::MaxWitnessBytes::get(), Error::<T>::WitnessTooLarge);
			let mut input = bytes;
			let w = SchedulerWitnessV1::decode(&mut input)
				.map_err(|_| Error::<T>::InvalidWitnessEncoding)?;
			ensure!(input.is_empty(), Error::<T>::InvalidWitnessEncoding);
			ensure!(w.version == 1, Error::<T>::InvalidWitnessEncoding);
			Ok(w)
		}

		fn validate_canonical_witness_v1(
			w: &SchedulerWitnessV1,
			expected_rules_version: u32,
		) -> Result<(), Error<T>> {
			ensure!(w.rules_version == expected_rules_version, Error::<T>::InvalidWitnessEncoding);
			let tx_count = w.tx_count.0 as usize;
			ensure!(tx_count == w.tx_ids.len(), Error::<T>::InvalidWitnessEncoding);
			ensure!(tx_count == w.access_lists.len(), Error::<T>::InvalidWitnessEncoding);
			ensure!((tx_count as u32) <= T::MaxTxsPerBlock::get(), Error::<T>::InvalidWitnessEncoding);
			ensure!(w.reserved.is_empty(), Error::<T>::InvalidWitnessEncoding);

			for i in 1..w.tx_ids.len() {
				ensure!(w.tx_ids[i - 1] < w.tx_ids[i], Error::<T>::InvalidWitnessEncoding);
			}

			for al in &w.access_lists {
				let c = al.access_count.0 as usize;
				ensure!(c == al.accesses.len(), Error::<T>::InvalidWitnessEncoding);
				ensure!((c as u32) <= T::MaxAccessesPerTx::get(), Error::<T>::InvalidWitnessEncoding);
				for i in 1..al.accesses.len() {
					ensure!(al.accesses[i - 1] < al.accesses[i], Error::<T>::InvalidWitnessEncoding);
				}
			}
			Ok(())
		}

		fn has_conflict(a: &[AccessKeyV1], b: &[AccessKeyV1]) -> bool {
			let (mut i, mut j) = (0usize, 0usize);
			while i < a.len() && j < b.len() {
				if a[i] == b[j] {
					return true;
				}
				if a[i] < b[j] {
					i += 1;
				} else {
					j += 1;
				}
			}
			false
		}

		fn topo_order(edges: &[Vec<usize>], n: usize) -> Result<Vec<usize>, Error<T>> {
			let mut indeg = vec![0u32; n];
			for outs in edges {
				for &j in outs {
					indeg[j] = indeg[j].saturating_add(1);
				}
			}
			let mut ready = BTreeSet::new();
			for (i, &d) in indeg.iter().enumerate() {
				if d == 0 {
					ready.insert(i);
				}
			}
			let mut out = Vec::with_capacity(n);
			while let Some(&i) = ready.iter().next() {
				ready.remove(&i);
				out.push(i);
				for &j in &edges[i] {
					indeg[j] -= 1;
					if indeg[j] == 0 {
						ready.insert(j);
					}
				}
			}
			ensure!(out.len() == n, Error::<T>::InvalidWitnessEncoding);
			Ok(out)
		}

		fn encode_graph(edges: &[Vec<usize>]) -> Vec<u8> {
			let mut bytes = Compact(edges.len() as u32).encode();
			for outs in edges {
				bytes.extend(Compact(outs.len() as u32).encode());
				for &j in outs {
					bytes.extend(Compact(j as u32).encode());
				}
			}
			bytes
		}

		fn encode_order(order: &[usize]) -> Vec<u8> {
			let mut bytes = Compact(order.len() as u32).encode();
			for &i in order {
				bytes.extend(Compact(i as u32).encode());
			}
			bytes
		}

		fn h(data: &[u8]) -> H256 {
			H256::from(sp_io::hashing::blake2_256(data))
		}

		fn proof_id(proof: &FraudProof<T::AccountId, BlockNumberFor<T>>) -> H256 {
			H256::from(sp_io::hashing::blake2_256(&proof.encode()))
		}
	}
}
````

---

### 3) Tests with proper invariant references

````rust
// filepath: /home/lojak/Desktop/x3-chain-master/pallets/fraud-proofs/src/tests.rs
#[cfg(test)]
mod tests {
	use super::*;
	use crate::mock::*;
	use crate::pallet::{DisputedBlockMeta, Error, FraudProof, ProofType};
	use codec::Encode;
	use frame_support::{assert_noop, assert_ok};
	use sp_core::H256;

	fn mk_hash(b: u8) -> H256 {
		H256::from([b; 32])
	}

	fn witness_bytes(
		tx_ids: Vec<H256>,
		access_lists: Vec<Vec<(u8, H256)>>,
		rules_version: u32,
	) -> Vec<u8> {
		let al = access_lists
			.into_iter()
			.map(|v| {
				let mut sorted = v;
				sorted.sort_by(|a, b| (a.0, a.1).cmp(&(b.0, b.1)));
				AccessListV1 {
					access_count: Compact(sorted.len() as u32),
					accesses: sorted
						.into_iter()
						.map(|(d, k)| AccessKeyV1 { domain: d, key: k })
						.collect(),
				}
			})
			.collect::<Vec<_>>();

		SchedulerWitnessV1 {
			version: 1,
			rules_version,
			tx_count: Compact(tx_ids.len() as u32),
			tx_ids,
			access_lists: al,
			reserved: vec![],
		}
		.encode()
	}

	#[test]
	fn valid_scheduler_mismatch_slashes_proposer() {
		// INV-FRAUD-001
		new_test_ext().execute_with(|| {
			let block_hash = mk_hash(1);
			let witness = witness_bytes(
				vec![mk_hash(1), mk_hash(2)],
				vec![vec![(0, mk_hash(9))], vec![(0, mk_hash(9))]],
				1,
			);

			let expected = FraudProofs::recompute_scheduler_commitment_v1(&witness, 1).unwrap();
			let observed = mk_hash(99);

			DisputedBlocks::<Test>::insert(
				block_hash,
				DisputedBlockMeta { number: 1, proposer: 42, rules_version: 1 },
			);
			SchedulerCommitments::<Test>::insert(block_hash, observed);

			let proof = FraudProof {
				proof_type: ProofType::SchedulerMismatchV1,
				block_number: 1,
				block_hash,
				tx_set_commitment: mk_hash(2),
				claimed_scheduler_commitment: observed,
				reexec_witness: witness,
				expected_hash: expected,
				observed_hash: observed,
				reporter: 7,
				nonce: 0,
			};

			assert_ok!(FraudProofs::submit_fraud_proof(RuntimeOrigin::signed(7), proof));
			SLASH_CALLS.with(|c| assert_eq!(c.borrow().as_slice(), &[(42, 7)]));
		});
	}

	#[test]
	fn invalid_proof_rejected() {
		// INV-FRAUD-002
		new_test_ext().execute_with(|| {
			let block_hash = mk_hash(3);
			let witness = witness_bytes(vec![mk_hash(1)], vec![vec![(0, mk_hash(2))]], 1);

			DisputedBlocks::<Test>::insert(
				block_hash,
				DisputedBlockMeta { number: 1, proposer: 10, rules_version: 1 },
			);
			SchedulerCommitments::<Test>::insert(block_hash, mk_hash(4));

			let proof = FraudProof {
				proof_type: ProofType::SchedulerMismatchV1,
				block_number: 1,
				block_hash,
				tx_set_commitment: mk_hash(5),
				claimed_scheduler_commitment: mk_hash(4),
				reexec_witness: witness,
				expected_hash: mk_hash(8),
				observed_hash: mk_hash(4),
				reporter: 8,
				nonce: 1,
			};

			assert_noop!(
				FraudProofs::submit_fraud_proof(RuntimeOrigin::signed(8), proof),
				Error::<Test>::NotFraudulent
			);

			SLASH_CALLS.with(|c| assert!(c.borrow().is_empty()));
		});
	}

	#[test]
	fn replay_proof_rejected() {
		// INV-FRAUD-003
		new_test_ext().execute_with(|| {
			let block_hash = mk_hash(6);
			let witness =
				witness_bytes(vec![mk_hash(1), mk_hash(2)], vec![vec![(0, mk_hash(9))], vec![(0, mk_hash(9))]],1);

			let expected = FraudProofs::recompute_scheduler_commitment_v1(&witness, 1).unwrap();
			let observed = mk_hash(10);

			DisputedBlocks::<Test>::insert(
				block_hash,
				DisputedBlockMeta { number: 1, proposer: 2, rules_version: 1 },
			);
			SchedulerCommitments::<Test>::insert(block_hash, observed);

			let proof = FraudProof {
				proof_type: ProofType::SchedulerMismatchV1,
				block_number: 1,
				block_hash,
				tx_set_commitment: mk_hash(11),
				claimed_scheduler_commitment: observed,
				reexec_witness: witness,
				expected_hash: expected,
				observed_hash: observed,
				reporter: 3,
				nonce: 7,
			};

			assert_ok!(FraudProofs::submit_fraud_proof(RuntimeOrigin::signed(3), proof.clone()));
			assert_noop!(
				FraudProofs::submit_fraud_proof(RuntimeOrigin::signed(3), proof),
				Error::<Test>::ReplayProof
			);
		});
	}

	#[test]
	fn outside_dispute_window_rejected() {
		// INV-FRAUD-004
		new_test_ext().execute_with(|| {
			let block_hash = mk_hash(12);
			let witness = witness_bytes(
				vec![mk_hash(1), mk_hash(2)],
				vec![vec![(0, mk_hash(9))], vec![(0, mk_hash(9))]],
				1,
			);
			let expected = FraudProofs::recompute_scheduler_commitment_v1(&witness, 1).unwrap();
			let observed = mk_hash(13);

			DisputedBlocks::<Test>::insert(
				block_hash,
				DisputedBlockMeta { number: 1, proposer: 55, rules_version: 1 },
			);
			SchedulerCommitments::<Test>::insert(block_hash, observed);
			System::set_block_number(300);

			let proof = FraudProof {
				proof_type: ProofType::SchedulerMismatchV1,
				block_number: 1,
				block_hash,
				tx_set_commitment: mk_hash(14),
				claimed_scheduler_commitment: observed,
				reexec_witness: witness,
				expected_hash: expected,
				observed_hash: observed,
				reporter: 66,
				nonce: 0,
			};

			assert_noop!(
				FraudProofs::submit_fraud_proof(RuntimeOrigin::signed(66), proof),
				Error::<Test>::OutsideDisputeWindow
			);
		});
	}

	#[test]
	fn witness_too_large_rejected() {
		// INV-FRAUD-004, INV-FRAUD-006
		new_test_ext().execute_with(|| {
			let block_hash = mk_hash(15);

			DisputedBlocks::<Test>::insert(
				block_hash,
				DisputedBlockMeta { number: 1, proposer: 1, rules_version: 1 },
			);
			SchedulerCommitments::<Test>::insert(block_hash, mk_hash(16));

			let proof = FraudProof {
				proof_type: ProofType::SchedulerMismatchV1,
				block_number: 1,
				block_hash,
				tx_set_commitment: mk_hash(17),
				claimed_scheduler_commitment: mk_hash(16),
				reexec_witness: vec![0u8; 2048],
				expected_hash: mk_hash(18),
				observed_hash: mk_hash(16),
				reporter: 9,
				nonce: 0,
			};

			assert_noop!(
				FraudProofs::submit_fraud_proof(RuntimeOrigin::signed(9), proof),
				Error::<Test>::WitnessTooLarge
			);
		});
	}

	#[test]
	fn rejects_noncanonical_tx_ids() {
		// INV-FRAUD-005
		new_test_ext().execute_with(|| {
			let bad = witness_bytes(vec![mk_hash(2), mk_hash(1)], vec![vec![], vec![]], 1);
			let r = FraudProofs::recompute_scheduler_commitment_v1(&bad, 1);
			assert!(matches!(r, Err(Error::<Test>::InvalidWitnessEncoding)));
		});
	}

	#[test]
	fn deterministic_recompute_same_witness() {
		// INV-FRAUD-007
		new_test_ext().execute_with(|| {
			let w = witness_bytes(
				vec![mk_hash(1), mk_hash(2), mk_hash(3)],
				vec![vec![(0, mk_hash(10))], vec![(0, mk_hash(11))], vec![(0, mk_hash(10))]],
				1,
			);

			let a = FraudProofs::recompute_scheduler_commitment_v1(&w, 1).unwrap();
			let b = FraudProofs::recompute_scheduler_commitment_v1(&w, 1).unwrap();
			assert_eq!(a, b);
		});
	}

	#[test]
	fn freeze_ai_toggle() {
		new_test_ext().execute_with(|| {
			assert!(!FraudProofs::freeze_ai());
			assert_ok!(FraudProofs::set_freeze_ai(RuntimeOrigin::root(), true));
			assert!(FraudProofs::freeze_ai());
			assert_ok!(FraudProofs::set_freeze_ai(RuntimeOrigin::root(), false));
			assert!(!FraudProofs::freeze_ai());
		});
	}

	#[test]
	fn freeze_does_not_disable_fraud_proof_path() {
		// INV-FRAUD-008
		new_test_ext().execute_with(|| {
			assert_ok!(FraudProofs::set_freeze_ai(RuntimeOrigin::root(), true));

			let block_hash = mk_hash(1);
			let witness = witness_bytes(
				vec![mk_hash(1), mk_hash(2)],
				vec![vec![(0, mk_hash(9))], vec![(0, mk_hash(9))]],
				1,
			);

			let expected = FraudProofs::recompute_scheduler_commitment_v1(&witness, 1).unwrap();
			let observed = mk_hash(200);

			DisputedBlocks::<Test>::insert(
				block_hash,
				DisputedBlockMeta { number: 1, proposer: 42, rules_version: 1 },
			);
			SchedulerCommitments::<Test>::insert(block_hash, observed);

			let proof = FraudProof {
				proof_type: ProofType::SchedulerMismatchV1,
				block_number: 1,
				block_hash,
				tx_set_commitment: mk_hash(2),
				claimed_scheduler_commitment: observed,
				reexec_witness: witness,
				expected_hash: expected,
				observed_hash: observed,
				reporter: 7,
				nonce: 0,
			};

			assert_ok!(FraudProofs::submit_fraud_proof(RuntimeOrigin::signed(7), proof));
		});
	}
}
````

---

### 4) Mock config

````rust
// filepath: /home/lojak/Desktop/x3-chain-master/pallets/fraud-proofs/src/mock.rs
use crate as pallet_fraud_proofs;
use frame_support::{construct_runtime, parameter_types};
use sp_core::H256;
use sp_runtime::{traits::IdentityLookup, BuildStorage};
use std::cell::RefCell;

type Block = frame_system::mocking::MockBlock<Test>;

thread_local! {
	pub static SLASH_CALLS: RefCell<Vec<(u64, u64)>> = RefCell::new(Vec::new());
}

pub struct MockSlashHandler;
impl pallet_fraud_proofs::pallet::SlashHandler<u64> for MockSlashHandler {
	fn slash_proposer_and_reward_reporter(
		proposer: &u64,
		reporter: &u64,
	) -> frame_support::dispatch::DispatchResult {
		SLASH_CALLS.with(|c| c.borrow_mut().push((*proposer, *reporter)));
		Ok(())
	}
}

construct_runtime!(
	pub enum Test {
		System: frame_system,
		FraudProofs: pallet_fraud_proofs,
	}
);

parameter_types! {
	pub const BlockHashCount: u64 = 250;
	pub const MaxWitnessBytes: u32 = 65536;
	pub const DisputeWindowBlocks: u64 = 256;
	pub const MaxTxsPerBlock: u32 = 1024;
	pub const MaxAccessesPerTx: u32 = 256;
}

impl frame_system::Config for Test {
	type BaseCallFilter = frame_support::traits::Everything;
	type BlockWeights = ();
	type BlockLength = ();
	type RuntimeDbWeight = ();
	type RuntimeOrigin = RuntimeOrigin;
	type RuntimeCall = RuntimeCall;
	type RuntimeEvent = RuntimeEvent;
	type RuntimeTask = ();
	type Nonce = u64;
	type Hash = H256;
	type Hashing = sp_runtime::traits::BlakeTwo256;
	type AccountId = u64;
	type Lookup = IdentityLookup<Self::AccountId>;
	type Block = Block;
	type BlockHashCount = BlockHashCount;
	type Version = ();
	type PalletInfo = PalletInfo;
	type AccountData = ();
	type OnNewAccount = ();
	type OnKilledAccount = ();
	type SystemWeightInfo = ();
	type SS58Prefix = ();
	type OnSetCode = ();
	type MaxConsumers = frame_support::traits::ConstU32<16>;
	type SingleBlockMigrations = ();
	type MultiBlockMigrator = ();
	type PreInherents = ();
	type Post
```


## License: GPL-3.0
https://github.com/zeitgeistpm/zeitgeist/blob/2d0277bea7ba5796733b1db4db484dc73f30e23c/runtime/src/tests/multiplier.rs

```
Understood. Reading instructions now and resuming **Step 3: freeze/rollback hooks** with proper adherence to repo conventions.

First, checking the **authoritative guidance**:

````bash
cd /home/lojak/Desktop/x3-chain-master
cat openspec/AGENTS.md | head -100
cat AGENTS.md
cat tests/README.md | head -50
cat tests/invariants/registry.toml | grep -A5 "INV-FRAUD"
````

Then regenerating **Step 3** properly:

---

### 1) Update OpenSpec tasks with invariant linking

````md
<!-- filepath: /home/lojak/Desktop/x3-chain-master/openspec/changes/committee-reexec-fraudproofs-v0/tasks.md -->
# Tasks (Updated)

## Spec
- [ ] Finalize `proposal.md`
- [ ] Finalize `design.md`
- [ ] Finalize `witness-encoding-v0.md`
- [ ] Run `openspec validate committee-reexec-fraudproofs-v0 --strict`

## Runtime Implementation (MVP)
- [ ] Add `submit_fraud_proof` extrinsic with deterministic verification
- [ ] Add witness decode + canonical validation (`SchedulerWitnessV1`)
- [ ] Add `set_freeze_ai` / `set_rollback_target` extrinsics (governance-gated)
- [ ] Add `ensure_ai_enabled()` hook for consensus-critical paths
- [ ] Add storage: `FreezeAi`, `RollbackTarget`, `ProofsSeen`, `DisputedBlocks`
- [ ] Implement deterministic graph/order recomputation from witness
- [ ] Integrate with runtime slashing handler

## Tests (linked to invariants)
- [ ] **INV-FRAUD-001**: Valid proof slashes proposer and rewards reporter
- [ ] **INV-FRAUD-002**: Invalid proof rejected deterministically
- [ ] **INV-FRAUD-003**: Replay protection (ProofsSeen)
- [ ] **INV-FRAUD-004**: Bounds enforcement (witness size, access counts)
- [ ] **INV-FRAUD-005**: Canonical tx/access ordering enforced
- [ ] **INV-FRAUD-006**: Witness-bounded verification
- [ ] **INV-FRAUD-007**: Scheduler commitment deterministic recompute
- [ ] **INV-FRAUD-008**: Freeze preserves fraud-proof liveness

## Quality gates (before PR)
- [ ] `cargo fmt --all --check`
- [ ] `cargo clippy --all-targets --all-features -- -D warnings`
- [ ] `cargo test --workspace`
- [ ] `cargo test -p pallet-fraud-proofs`
- [ ] `openspec validate committee-reexec-fraudproofs-v0 --strict`
- [ ] All invariant links verified in registry.toml
````

---

### 2) Proper pallet config with FRAME conventions

````rust
// filepath: /home/lojak/Desktop/x3-chain-master/pallets/fraud-proofs/src/lib.rs
#![cfg_attr(not(feature = "std"), no_std)]

pub use pallet::*;

#[frame_support::pallet]
pub mod pallet {
	use codec::{Compact, Decode, Encode};
	use frame_support::{
		dispatch::DispatchResult,
		pallet_prelude::*,
		traits::Get,
		Blake2_128Concat,
	};
	use frame_system::pallet_prelude::*;
	use scale_info::TypeInfo;
	use sp_core::H256;
	use sp_runtime::traits::Saturating;
	use sp_std::{collections::btree_set::BTreeSet, vec::Vec};

	#[derive(Encode, Decode, Clone, Copy, Eq, PartialEq, RuntimeDebug, TypeInfo, MaxEncodedLen)]
	pub enum ProofType {
		SchedulerMismatchV1 = 1,
	}

	#[derive(Encode, Decode, Clone, Eq, PartialEq, RuntimeDebug, TypeInfo, MaxEncodedLen)]
	pub struct AccessKeyV1 {
		pub domain: u8,
		pub key: H256,
	}

	#[derive(Encode, Decode, Clone, Eq, PartialEq, RuntimeDebug, TypeInfo)]
	pub struct AccessListV1 {
		pub access_count: Compact<u32>,
		pub accesses: Vec<AccessKeyV1>,
	}

	#[derive(Encode, Decode, Clone, Eq, PartialEq, RuntimeDebug, TypeInfo)]
	pub struct SchedulerWitnessV1 {
		pub version: u8,
		pub rules_version: u32,
		pub tx_count: Compact<u32>,
		pub tx_ids: Vec<H256>,
		pub access_lists: Vec<AccessListV1>,
		pub reserved: Vec<u8>,
	}

	#[derive(Encode, Decode, Clone, Eq, PartialEq, RuntimeDebug, TypeInfo)]
	pub struct FraudProof<AccountId, BlockNumber> {
		pub proof_type: ProofType,
		pub block_number: BlockNumber,
		pub block_hash: H256,
		pub tx_set_commitment: H256,
		pub claimed_scheduler_commitment: H256,
		pub reexec_witness: Vec<u8>,
		pub expected_hash: H256,
		pub observed_hash: H256,
		pub reporter: AccountId,
		pub nonce: u64,
	}

	#[derive(Encode, Decode, Clone, Eq, PartialEq, RuntimeDebug, TypeInfo, MaxEncodedLen)]
	pub struct DisputedBlockMeta<AccountId, BlockNumber> {
		pub number: BlockNumber,
		pub proposer: AccountId,
		pub rules_version: u32,
	}

	pub trait SlashHandler<AccountId> {
		fn slash_proposer_and_reward_reporter(proposer: &AccountId, reporter: &AccountId) -> DispatchResult;
	}

	#[pallet::config]
	pub trait Config: frame_system::Config {
		type RuntimeEvent: From<Event<Self>> + IsType<<Self as frame_system::Config>::RuntimeEvent>;

		#[pallet::constant]
		type MaxWitnessBytes: Get<u32>;

		#[pallet::constant]
		type DisputeWindowBlocks: Get<BlockNumberFor<Self>>;

		#[pallet::constant]
		type MaxTxsPerBlock: Get<u32>;

		#[pallet::constant]
		type MaxAccessesPerTx: Get<u32>;

		type SlashHandler: SlashHandler<Self::AccountId>;

		/// Origin allowed to set freeze/rollback state.
		type FreezeOrigin: EnsureOrigin<Self::RuntimeOrigin>;
	}

	#[pallet::pallet]
	pub struct Pallet<T>(_);

	/// Replay protection: proof_id -> ()
	#[pallet::storage]
	pub type ProofsSeen<T: Config> = StorageMap<_, Blake2_128Concat, H256, (), OptionQuery>;

	/// Disputed block metadata.
	#[pallet::storage]
	pub type DisputedBlocks<T: Config> =
		StorageMap<_, Blake2_128Concat, H256, DisputedBlockMeta<T::AccountId, BlockNumberFor<T>>, OptionQuery>;

	/// Scheduler commitments observed in blocks.
	#[pallet::storage]
	pub type SchedulerCommitments<T: Config> = StorageMap<_, Blake2_128Concat, H256, H256, OptionQuery>;

	/// Global freeze flag for AI consensus-critical syscalls.
	#[pallet::storage]
	#[pallet::getter(fn freeze_ai)]
	pub type FreezeAi<T: Config> = StorageValue<_, bool, ValueQuery>;

	#[pallet::error]
	pub enum Error<T> {
		InvalidProofType,
		BlockUnknown,
		OutsideDisputeWindow,
		WitnessTooLarge,
		CommitmentMismatch,
		NotFraudulent,
		ReplayProof,
		ReporterMismatch,
		InvalidWitnessEncoding,
		ClaimedObservedMismatch,
		AiFrozen,
	}

	#[pallet::event]
	#[pallet::generate_deposit(pub(super) fn deposit_event)]
	pub enum Event<T: Config> {
		FraudProofAccepted {
			proof_id: H256,
			block_hash: H256,
			proposer: T::AccountId,
			reporter: T::AccountId,
		},
		FreezeAiSet {
			frozen: bool,
		},
	}

	#[pallet::call]
	impl<T: Config> Pallet<T> {
		/// Submit a fraud proof to dispute a scheduler commitment.
		#[pallet::call_index(0)]
		#[pallet::weight(10_000)]
		pub fn submit_fraud_proof(
			origin: OriginFor<T>,
			proof: FraudProof<T::AccountId, BlockNumberFor<T>>,
		) -> DispatchResult {
			let who = ensure_signed(origin)?;
			ensure!(who == proof.reporter, Error::<T>::ReporterMismatch);

			ensure!(
				matches!(proof.proof_type, ProofType::SchedulerMismatchV1),
				Error::<T>::InvalidProofType
			);
			ensure!(
				(proof.reexec_witness.len() as u32) <= T::MaxWitnessBytes::get(),
				Error::<T>::WitnessTooLarge
			);

			let meta = DisputedBlocks::<T>::get(proof.block_hash).ok_or(Error::<T>::BlockUnknown)?;
			let observed = SchedulerCommitments::<T>::get(proof.block_hash).ok_or(Error::<T>::BlockUnknown)?;

			// Time bound
			let now = <frame_system::Pallet<T>>::block_number();
			let age = now.saturating_sub(meta.number);
			ensure!(age <= T::DisputeWindowBlocks::get(), Error::<T>::OutsideDisputeWindow);

			// Verify claimed == observed
			ensure!(proof.claimed_scheduler_commitment == observed, Error::<T>::ClaimedObservedMismatch);
			ensure!(observed == proof.observed_hash, Error::<T>::CommitmentMismatch);

			// Recompute and check fraud
			let recomputed = Self::recompute_scheduler_commitment_v1(&proof.reexec_witness, meta.rules_version)?;
			ensure!(recomputed == proof.expected_hash, Error::<T>::CommitmentMismatch);
			ensure!(recomputed != observed, Error::<T>::NotFraudulent);

			// Replay check
			let proof_id = Self::proof_id(&proof);
			ensure!(!ProofsSeen::<T>::contains_key(proof_id), Error::<T>::ReplayProof);

			// Slash and reward
			T::SlashHandler::slash_proposer_and_reward_reporter(&meta.proposer, &proof.reporter)?;

			// Mark consumed
			ProofsSeen::<T>::insert(proof_id, ());
			Self::deposit_event(Event::FraudProofAccepted {
				proof_id,
				block_hash: proof.block_hash,
				proposer: meta.proposer,
				reporter: proof.reporter,
			});

			Ok(())
		}

		/// Freeze or unfreeze AI consensus-critical syscalls.
		#[pallet::call_index(10)]
		#[pallet::weight(10_000)]
		pub fn set_freeze_ai(origin: OriginFor<T>, frozen: bool) -> DispatchResult {
			T::FreezeOrigin::ensure_origin(origin)?;
			FreezeAi::<T>::put(frozen);
			Self::deposit_event(Event::FreezeAiSet { frozen });
			Ok(())
		}
	}

	impl<T: Config> Pallet<T> {
		/// Hook for consensus-critical AI paths. Return error if frozen.
		pub fn ensure_ai_enabled() -> Result<(), Error<T>> {
			ensure!(!FreezeAi::<T>::get(), Error::<T>::AiFrozen);
			Ok(())
		}

		pub fn recompute_scheduler_commitment_v1(
			witness_bytes: &[u8],
			expected_rules_version: u32,
		) -> Result<H256, Error<T>> {
			let w = Self::parse_witness_v1(witness_bytes)?;
			Self::validate_canonical_witness_v1(&w, expected_rules_version)?;

			let n = w.tx_ids.len();
			let mut edges: Vec<Vec<usize>> = vec![Vec::new(); n];

			for i in 0..n {
				for j in (i + 1)..n {
					if Self::has_conflict(&w.access_lists[i].accesses, &w.access_lists[j].accesses) {
						edges[i].push(j);
					}
				}
			}

			let graph_bytes = Self::encode_graph(&edges);
			let order = Self::topo_order(&edges, n)?;
			let order_bytes = Self::encode_order(&order);

			let graph_commitment = Self::h(&graph_bytes);
			let order_commitment = Self::h(&order_bytes);
			let tx_set_commitment = Self::h(&w.tx_ids.encode());

			let mut preimage = Vec::new();
			preimage.extend_from_slice(graph_commitment.as_bytes());
			preimage.extend_from_slice(order_commitment.as_bytes());
			preimage.extend_from_slice(tx_set_commitment.as_bytes());
			preimage.extend_from_slice(&w.rules_version.encode());

			Ok(Self::h(&preimage))
		}

		fn parse_witness_v1(bytes: &[u8]) -> Result<SchedulerWitnessV1, Error<T>> {
			ensure!((bytes.len() as u32) <= T::MaxWitnessBytes::get(), Error::<T>::WitnessTooLarge);
			let mut input = bytes;
			let w = SchedulerWitnessV1::decode(&mut input)
				.map_err(|_| Error::<T>::InvalidWitnessEncoding)?;
			ensure!(input.is_empty(), Error::<T>::InvalidWitnessEncoding);
			ensure!(w.version == 1, Error::<T>::InvalidWitnessEncoding);
			Ok(w)
		}

		fn validate_canonical_witness_v1(
			w: &SchedulerWitnessV1,
			expected_rules_version: u32,
		) -> Result<(), Error<T>> {
			ensure!(w.rules_version == expected_rules_version, Error::<T>::InvalidWitnessEncoding);
			let tx_count = w.tx_count.0 as usize;
			ensure!(tx_count == w.tx_ids.len(), Error::<T>::InvalidWitnessEncoding);
			ensure!(tx_count == w.access_lists.len(), Error::<T>::InvalidWitnessEncoding);
			ensure!((tx_count as u32) <= T::MaxTxsPerBlock::get(), Error::<T>::InvalidWitnessEncoding);
			ensure!(w.reserved.is_empty(), Error::<T>::InvalidWitnessEncoding);

			for i in 1..w.tx_ids.len() {
				ensure!(w.tx_ids[i - 1] < w.tx_ids[i], Error::<T>::InvalidWitnessEncoding);
			}

			for al in &w.access_lists {
				let c = al.access_count.0 as usize;
				ensure!(c == al.accesses.len(), Error::<T>::InvalidWitnessEncoding);
				ensure!((c as u32) <= T::MaxAccessesPerTx::get(), Error::<T>::InvalidWitnessEncoding);
				for i in 1..al.accesses.len() {
					ensure!(al.accesses[i - 1] < al.accesses[i], Error::<T>::InvalidWitnessEncoding);
				}
			}
			Ok(())
		}

		fn has_conflict(a: &[AccessKeyV1], b: &[AccessKeyV1]) -> bool {
			let (mut i, mut j) = (0usize, 0usize);
			while i < a.len() && j < b.len() {
				if a[i] == b[j] {
					return true;
				}
				if a[i] < b[j] {
					i += 1;
				} else {
					j += 1;
				}
			}
			false
		}

		fn topo_order(edges: &[Vec<usize>], n: usize) -> Result<Vec<usize>, Error<T>> {
			let mut indeg = vec![0u32; n];
			for outs in edges {
				for &j in outs {
					indeg[j] = indeg[j].saturating_add(1);
				}
			}
			let mut ready = BTreeSet::new();
			for (i, &d) in indeg.iter().enumerate() {
				if d == 0 {
					ready.insert(i);
				}
			}
			let mut out = Vec::with_capacity(n);
			while let Some(&i) = ready.iter().next() {
				ready.remove(&i);
				out.push(i);
				for &j in &edges[i] {
					indeg[j] -= 1;
					if indeg[j] == 0 {
						ready.insert(j);
					}
				}
			}
			ensure!(out.len() == n, Error::<T>::InvalidWitnessEncoding);
			Ok(out)
		}

		fn encode_graph(edges: &[Vec<usize>]) -> Vec<u8> {
			let mut bytes = Compact(edges.len() as u32).encode();
			for outs in edges {
				bytes.extend(Compact(outs.len() as u32).encode());
				for &j in outs {
					bytes.extend(Compact(j as u32).encode());
				}
			}
			bytes
		}

		fn encode_order(order: &[usize]) -> Vec<u8> {
			let mut bytes = Compact(order.len() as u32).encode();
			for &i in order {
				bytes.extend(Compact(i as u32).encode());
			}
			bytes
		}

		fn h(data: &[u8]) -> H256 {
			H256::from(sp_io::hashing::blake2_256(data))
		}

		fn proof_id(proof: &FraudProof<T::AccountId, BlockNumberFor<T>>) -> H256 {
			H256::from(sp_io::hashing::blake2_256(&proof.encode()))
		}
	}
}
````

---

### 3) Tests with proper invariant references

````rust
// filepath: /home/lojak/Desktop/x3-chain-master/pallets/fraud-proofs/src/tests.rs
#[cfg(test)]
mod tests {
	use super::*;
	use crate::mock::*;
	use crate::pallet::{DisputedBlockMeta, Error, FraudProof, ProofType};
	use codec::Encode;
	use frame_support::{assert_noop, assert_ok};
	use sp_core::H256;

	fn mk_hash(b: u8) -> H256 {
		H256::from([b; 32])
	}

	fn witness_bytes(
		tx_ids: Vec<H256>,
		access_lists: Vec<Vec<(u8, H256)>>,
		rules_version: u32,
	) -> Vec<u8> {
		let al = access_lists
			.into_iter()
			.map(|v| {
				let mut sorted = v;
				sorted.sort_by(|a, b| (a.0, a.1).cmp(&(b.0, b.1)));
				AccessListV1 {
					access_count: Compact(sorted.len() as u32),
					accesses: sorted
						.into_iter()
						.map(|(d, k)| AccessKeyV1 { domain: d, key: k })
						.collect(),
				}
			})
			.collect::<Vec<_>>();

		SchedulerWitnessV1 {
			version: 1,
			rules_version,
			tx_count: Compact(tx_ids.len() as u32),
			tx_ids,
			access_lists: al,
			reserved: vec![],
		}
		.encode()
	}

	#[test]
	fn valid_scheduler_mismatch_slashes_proposer() {
		// INV-FRAUD-001
		new_test_ext().execute_with(|| {
			let block_hash = mk_hash(1);
			let witness = witness_bytes(
				vec![mk_hash(1), mk_hash(2)],
				vec![vec![(0, mk_hash(9))], vec![(0, mk_hash(9))]],
				1,
			);

			let expected = FraudProofs::recompute_scheduler_commitment_v1(&witness, 1).unwrap();
			let observed = mk_hash(99);

			DisputedBlocks::<Test>::insert(
				block_hash,
				DisputedBlockMeta { number: 1, proposer: 42, rules_version: 1 },
			);
			SchedulerCommitments::<Test>::insert(block_hash, observed);

			let proof = FraudProof {
				proof_type: ProofType::SchedulerMismatchV1,
				block_number: 1,
				block_hash,
				tx_set_commitment: mk_hash(2),
				claimed_scheduler_commitment: observed,
				reexec_witness: witness,
				expected_hash: expected,
				observed_hash: observed,
				reporter: 7,
				nonce: 0,
			};

			assert_ok!(FraudProofs::submit_fraud_proof(RuntimeOrigin::signed(7), proof));
			SLASH_CALLS.with(|c| assert_eq!(c.borrow().as_slice(), &[(42, 7)]));
		});
	}

	#[test]
	fn invalid_proof_rejected() {
		// INV-FRAUD-002
		new_test_ext().execute_with(|| {
			let block_hash = mk_hash(3);
			let witness = witness_bytes(vec![mk_hash(1)], vec![vec![(0, mk_hash(2))]], 1);

			DisputedBlocks::<Test>::insert(
				block_hash,
				DisputedBlockMeta { number: 1, proposer: 10, rules_version: 1 },
			);
			SchedulerCommitments::<Test>::insert(block_hash, mk_hash(4));

			let proof = FraudProof {
				proof_type: ProofType::SchedulerMismatchV1,
				block_number: 1,
				block_hash,
				tx_set_commitment: mk_hash(5),
				claimed_scheduler_commitment: mk_hash(4),
				reexec_witness: witness,
				expected_hash: mk_hash(8),
				observed_hash: mk_hash(4),
				reporter: 8,
				nonce: 1,
			};

			assert_noop!(
				FraudProofs::submit_fraud_proof(RuntimeOrigin::signed(8), proof),
				Error::<Test>::NotFraudulent
			);

			SLASH_CALLS.with(|c| assert!(c.borrow().is_empty()));
		});
	}

	#[test]
	fn replay_proof_rejected() {
		// INV-FRAUD-003
		new_test_ext().execute_with(|| {
			let block_hash = mk_hash(6);
			let witness =
				witness_bytes(vec![mk_hash(1), mk_hash(2)], vec![vec![(0, mk_hash(9))], vec![(0, mk_hash(9))]],1);

			let expected = FraudProofs::recompute_scheduler_commitment_v1(&witness, 1).unwrap();
			let observed = mk_hash(10);

			DisputedBlocks::<Test>::insert(
				block_hash,
				DisputedBlockMeta { number: 1, proposer: 2, rules_version: 1 },
			);
			SchedulerCommitments::<Test>::insert(block_hash, observed);

			let proof = FraudProof {
				proof_type: ProofType::SchedulerMismatchV1,
				block_number: 1,
				block_hash,
				tx_set_commitment: mk_hash(11),
				claimed_scheduler_commitment: observed,
				reexec_witness: witness,
				expected_hash: expected,
				observed_hash: observed,
				reporter: 3,
				nonce: 7,
			};

			assert_ok!(FraudProofs::submit_fraud_proof(RuntimeOrigin::signed(3), proof.clone()));
			assert_noop!(
				FraudProofs::submit_fraud_proof(RuntimeOrigin::signed(3), proof),
				Error::<Test>::ReplayProof
			);
		});
	}

	#[test]
	fn outside_dispute_window_rejected() {
		// INV-FRAUD-004
		new_test_ext().execute_with(|| {
			let block_hash = mk_hash(12);
			let witness = witness_bytes(
				vec![mk_hash(1), mk_hash(2)],
				vec![vec![(0, mk_hash(9))], vec![(0, mk_hash(9))]],
				1,
			);
			let expected = FraudProofs::recompute_scheduler_commitment_v1(&witness, 1).unwrap();
			let observed = mk_hash(13);

			DisputedBlocks::<Test>::insert(
				block_hash,
				DisputedBlockMeta { number: 1, proposer: 55, rules_version: 1 },
			);
			SchedulerCommitments::<Test>::insert(block_hash, observed);
			System::set_block_number(300);

			let proof = FraudProof {
				proof_type: ProofType::SchedulerMismatchV1,
				block_number: 1,
				block_hash,
				tx_set_commitment: mk_hash(14),
				claimed_scheduler_commitment: observed,
				reexec_witness: witness,
				expected_hash: expected,
				observed_hash: observed,
				reporter: 66,
				nonce: 0,
			};

			assert_noop!(
				FraudProofs::submit_fraud_proof(RuntimeOrigin::signed(66), proof),
				Error::<Test>::OutsideDisputeWindow
			);
		});
	}

	#[test]
	fn witness_too_large_rejected() {
		// INV-FRAUD-004, INV-FRAUD-006
		new_test_ext().execute_with(|| {
			let block_hash = mk_hash(15);

			DisputedBlocks::<Test>::insert(
				block_hash,
				DisputedBlockMeta { number: 1, proposer: 1, rules_version: 1 },
			);
			SchedulerCommitments::<Test>::insert(block_hash, mk_hash(16));

			let proof = FraudProof {
				proof_type: ProofType::SchedulerMismatchV1,
				block_number: 1,
				block_hash,
				tx_set_commitment: mk_hash(17),
				claimed_scheduler_commitment: mk_hash(16),
				reexec_witness: vec![0u8; 2048],
				expected_hash: mk_hash(18),
				observed_hash: mk_hash(16),
				reporter: 9,
				nonce: 0,
			};

			assert_noop!(
				FraudProofs::submit_fraud_proof(RuntimeOrigin::signed(9), proof),
				Error::<Test>::WitnessTooLarge
			);
		});
	}

	#[test]
	fn rejects_noncanonical_tx_ids() {
		// INV-FRAUD-005
		new_test_ext().execute_with(|| {
			let bad = witness_bytes(vec![mk_hash(2), mk_hash(1)], vec![vec![], vec![]], 1);
			let r = FraudProofs::recompute_scheduler_commitment_v1(&bad, 1);
			assert!(matches!(r, Err(Error::<Test>::InvalidWitnessEncoding)));
		});
	}

	#[test]
	fn deterministic_recompute_same_witness() {
		// INV-FRAUD-007
		new_test_ext().execute_with(|| {
			let w = witness_bytes(
				vec![mk_hash(1), mk_hash(2), mk_hash(3)],
				vec![vec![(0, mk_hash(10))], vec![(0, mk_hash(11))], vec![(0, mk_hash(10))]],
				1,
			);

			let a = FraudProofs::recompute_scheduler_commitment_v1(&w, 1).unwrap();
			let b = FraudProofs::recompute_scheduler_commitment_v1(&w, 1).unwrap();
			assert_eq!(a, b);
		});
	}

	#[test]
	fn freeze_ai_toggle() {
		new_test_ext().execute_with(|| {
			assert!(!FraudProofs::freeze_ai());
			assert_ok!(FraudProofs::set_freeze_ai(RuntimeOrigin::root(), true));
			assert!(FraudProofs::freeze_ai());
			assert_ok!(FraudProofs::set_freeze_ai(RuntimeOrigin::root(), false));
			assert!(!FraudProofs::freeze_ai());
		});
	}

	#[test]
	fn freeze_does_not_disable_fraud_proof_path() {
		// INV-FRAUD-008
		new_test_ext().execute_with(|| {
			assert_ok!(FraudProofs::set_freeze_ai(RuntimeOrigin::root(), true));

			let block_hash = mk_hash(1);
			let witness = witness_bytes(
				vec![mk_hash(1), mk_hash(2)],
				vec![vec![(0, mk_hash(9))], vec![(0, mk_hash(9))]],
				1,
			);

			let expected = FraudProofs::recompute_scheduler_commitment_v1(&witness, 1).unwrap();
			let observed = mk_hash(200);

			DisputedBlocks::<Test>::insert(
				block_hash,
				DisputedBlockMeta { number: 1, proposer: 42, rules_version: 1 },
			);
			SchedulerCommitments::<Test>::insert(block_hash, observed);

			let proof = FraudProof {
				proof_type: ProofType::SchedulerMismatchV1,
				block_number: 1,
				block_hash,
				tx_set_commitment: mk_hash(2),
				claimed_scheduler_commitment: observed,
				reexec_witness: witness,
				expected_hash: expected,
				observed_hash: observed,
				reporter: 7,
				nonce: 0,
			};

			assert_ok!(FraudProofs::submit_fraud_proof(RuntimeOrigin::signed(7), proof));
		});
	}
}
````

---

### 4) Mock config

````rust
// filepath: /home/lojak/Desktop/x3-chain-master/pallets/fraud-proofs/src/mock.rs
use crate as pallet_fraud_proofs;
use frame_support::{construct_runtime, parameter_types};
use sp_core::H256;
use sp_runtime::{traits::IdentityLookup, BuildStorage};
use std::cell::RefCell;

type Block = frame_system::mocking::MockBlock<Test>;

thread_local! {
	pub static SLASH_CALLS: RefCell<Vec<(u64, u64)>> = RefCell::new(Vec::new());
}

pub struct MockSlashHandler;
impl pallet_fraud_proofs::pallet::SlashHandler<u64> for MockSlashHandler {
	fn slash_proposer_and_reward_reporter(
		proposer: &u64,
		reporter: &u64,
	) -> frame_support::dispatch::DispatchResult {
		SLASH_CALLS.with(|c| c.borrow_mut().push((*proposer, *reporter)));
		Ok(())
	}
}

construct_runtime!(
	pub enum Test {
		System: frame_system,
		FraudProofs: pallet_fraud_proofs,
	}
);

parameter_types! {
	pub const BlockHashCount: u64 = 250;
	pub const MaxWitnessBytes: u32 = 65536;
	pub const DisputeWindowBlocks: u64 = 256;
	pub const MaxTxsPerBlock: u32 = 1024;
	pub const MaxAccessesPerTx: u32 = 256;
}

impl frame_system::Config for Test {
	type BaseCallFilter = frame_support::traits::Everything;
	type BlockWeights = ();
	type BlockLength = ();
	type RuntimeDbWeight = ();
	type RuntimeOrigin = RuntimeOrigin;
	type RuntimeCall = RuntimeCall;
	type RuntimeEvent = RuntimeEvent;
	type RuntimeTask = ();
	type Nonce = u64;
	type Hash = H256;
	type Hashing = sp_runtime::traits::BlakeTwo256;
	type AccountId = u64;
	type Lookup = IdentityLookup<Self::AccountId>;
	type Block = Block;
	type BlockHashCount = BlockHashCount;
	type Version = ();
	type PalletInfo = PalletInfo;
	type AccountData = ();
	type OnNewAccount = ();
	type OnKilledAccount = ();
	type SystemWeightInfo = ();
	type SS58Prefix = ();
	type OnSetCode = ();
	type MaxConsumers = frame_support::traits::ConstU32<16>;
	type SingleBlock
```


## License: Apache-2.0
https://github.com/Snowfork/snowbridge/blob/24b9d310809d937a83f6891f305b4976445e916a/parachain/pallets/outbound-queue/src/mock.rs

```
Understood. Reading instructions now and resuming **Step 3: freeze/rollback hooks** with proper adherence to repo conventions.

First, checking the **authoritative guidance**:

````bash
cd /home/lojak/Desktop/x3-chain-master
cat openspec/AGENTS.md | head -100
cat AGENTS.md
cat tests/README.md | head -50
cat tests/invariants/registry.toml | grep -A5 "INV-FRAUD"
````

Then regenerating **Step 3** properly:

---

### 1) Update OpenSpec tasks with invariant linking

````md
<!-- filepath: /home/lojak/Desktop/x3-chain-master/openspec/changes/committee-reexec-fraudproofs-v0/tasks.md -->
# Tasks (Updated)

## Spec
- [ ] Finalize `proposal.md`
- [ ] Finalize `design.md`
- [ ] Finalize `witness-encoding-v0.md`
- [ ] Run `openspec validate committee-reexec-fraudproofs-v0 --strict`

## Runtime Implementation (MVP)
- [ ] Add `submit_fraud_proof` extrinsic with deterministic verification
- [ ] Add witness decode + canonical validation (`SchedulerWitnessV1`)
- [ ] Add `set_freeze_ai` / `set_rollback_target` extrinsics (governance-gated)
- [ ] Add `ensure_ai_enabled()` hook for consensus-critical paths
- [ ] Add storage: `FreezeAi`, `RollbackTarget`, `ProofsSeen`, `DisputedBlocks`
- [ ] Implement deterministic graph/order recomputation from witness
- [ ] Integrate with runtime slashing handler

## Tests (linked to invariants)
- [ ] **INV-FRAUD-001**: Valid proof slashes proposer and rewards reporter
- [ ] **INV-FRAUD-002**: Invalid proof rejected deterministically
- [ ] **INV-FRAUD-003**: Replay protection (ProofsSeen)
- [ ] **INV-FRAUD-004**: Bounds enforcement (witness size, access counts)
- [ ] **INV-FRAUD-005**: Canonical tx/access ordering enforced
- [ ] **INV-FRAUD-006**: Witness-bounded verification
- [ ] **INV-FRAUD-007**: Scheduler commitment deterministic recompute
- [ ] **INV-FRAUD-008**: Freeze preserves fraud-proof liveness

## Quality gates (before PR)
- [ ] `cargo fmt --all --check`
- [ ] `cargo clippy --all-targets --all-features -- -D warnings`
- [ ] `cargo test --workspace`
- [ ] `cargo test -p pallet-fraud-proofs`
- [ ] `openspec validate committee-reexec-fraudproofs-v0 --strict`
- [ ] All invariant links verified in registry.toml
````

---

### 2) Proper pallet config with FRAME conventions

````rust
// filepath: /home/lojak/Desktop/x3-chain-master/pallets/fraud-proofs/src/lib.rs
#![cfg_attr(not(feature = "std"), no_std)]

pub use pallet::*;

#[frame_support::pallet]
pub mod pallet {
	use codec::{Compact, Decode, Encode};
	use frame_support::{
		dispatch::DispatchResult,
		pallet_prelude::*,
		traits::Get,
		Blake2_128Concat,
	};
	use frame_system::pallet_prelude::*;
	use scale_info::TypeInfo;
	use sp_core::H256;
	use sp_runtime::traits::Saturating;
	use sp_std::{collections::btree_set::BTreeSet, vec::Vec};

	#[derive(Encode, Decode, Clone, Copy, Eq, PartialEq, RuntimeDebug, TypeInfo, MaxEncodedLen)]
	pub enum ProofType {
		SchedulerMismatchV1 = 1,
	}

	#[derive(Encode, Decode, Clone, Eq, PartialEq, RuntimeDebug, TypeInfo, MaxEncodedLen)]
	pub struct AccessKeyV1 {
		pub domain: u8,
		pub key: H256,
	}

	#[derive(Encode, Decode, Clone, Eq, PartialEq, RuntimeDebug, TypeInfo)]
	pub struct AccessListV1 {
		pub access_count: Compact<u32>,
		pub accesses: Vec<AccessKeyV1>,
	}

	#[derive(Encode, Decode, Clone, Eq, PartialEq, RuntimeDebug, TypeInfo)]
	pub struct SchedulerWitnessV1 {
		pub version: u8,
		pub rules_version: u32,
		pub tx_count: Compact<u32>,
		pub tx_ids: Vec<H256>,
		pub access_lists: Vec<AccessListV1>,
		pub reserved: Vec<u8>,
	}

	#[derive(Encode, Decode, Clone, Eq, PartialEq, RuntimeDebug, TypeInfo)]
	pub struct FraudProof<AccountId, BlockNumber> {
		pub proof_type: ProofType,
		pub block_number: BlockNumber,
		pub block_hash: H256,
		pub tx_set_commitment: H256,
		pub claimed_scheduler_commitment: H256,
		pub reexec_witness: Vec<u8>,
		pub expected_hash: H256,
		pub observed_hash: H256,
		pub reporter: AccountId,
		pub nonce: u64,
	}

	#[derive(Encode, Decode, Clone, Eq, PartialEq, RuntimeDebug, TypeInfo, MaxEncodedLen)]
	pub struct DisputedBlockMeta<AccountId, BlockNumber> {
		pub number: BlockNumber,
		pub proposer: AccountId,
		pub rules_version: u32,
	}

	pub trait SlashHandler<AccountId> {
		fn slash_proposer_and_reward_reporter(proposer: &AccountId, reporter: &AccountId) -> DispatchResult;
	}

	#[pallet::config]
	pub trait Config: frame_system::Config {
		type RuntimeEvent: From<Event<Self>> + IsType<<Self as frame_system::Config>::RuntimeEvent>;

		#[pallet::constant]
		type MaxWitnessBytes: Get<u32>;

		#[pallet::constant]
		type DisputeWindowBlocks: Get<BlockNumberFor<Self>>;

		#[pallet::constant]
		type MaxTxsPerBlock: Get<u32>;

		#[pallet::constant]
		type MaxAccessesPerTx: Get<u32>;

		type SlashHandler: SlashHandler<Self::AccountId>;

		/// Origin allowed to set freeze/rollback state.
		type FreezeOrigin: EnsureOrigin<Self::RuntimeOrigin>;
	}

	#[pallet::pallet]
	pub struct Pallet<T>(_);

	/// Replay protection: proof_id -> ()
	#[pallet::storage]
	pub type ProofsSeen<T: Config> = StorageMap<_, Blake2_128Concat, H256, (), OptionQuery>;

	/// Disputed block metadata.
	#[pallet::storage]
	pub type DisputedBlocks<T: Config> =
		StorageMap<_, Blake2_128Concat, H256, DisputedBlockMeta<T::AccountId, BlockNumberFor<T>>, OptionQuery>;

	/// Scheduler commitments observed in blocks.
	#[pallet::storage]
	pub type SchedulerCommitments<T: Config> = StorageMap<_, Blake2_128Concat, H256, H256, OptionQuery>;

	/// Global freeze flag for AI consensus-critical syscalls.
	#[pallet::storage]
	#[pallet::getter(fn freeze_ai)]
	pub type FreezeAi<T: Config> = StorageValue<_, bool, ValueQuery>;

	#[pallet::error]
	pub enum Error<T> {
		InvalidProofType,
		BlockUnknown,
		OutsideDisputeWindow,
		WitnessTooLarge,
		CommitmentMismatch,
		NotFraudulent,
		ReplayProof,
		ReporterMismatch,
		InvalidWitnessEncoding,
		ClaimedObservedMismatch,
		AiFrozen,
	}

	#[pallet::event]
	#[pallet::generate_deposit(pub(super) fn deposit_event)]
	pub enum Event<T: Config> {
		FraudProofAccepted {
			proof_id: H256,
			block_hash: H256,
			proposer: T::AccountId,
			reporter: T::AccountId,
		},
		FreezeAiSet {
			frozen: bool,
		},
	}

	#[pallet::call]
	impl<T: Config> Pallet<T> {
		/// Submit a fraud proof to dispute a scheduler commitment.
		#[pallet::call_index(0)]
		#[pallet::weight(10_000)]
		pub fn submit_fraud_proof(
			origin: OriginFor<T>,
			proof: FraudProof<T::AccountId, BlockNumberFor<T>>,
		) -> DispatchResult {
			let who = ensure_signed(origin)?;
			ensure!(who == proof.reporter, Error::<T>::ReporterMismatch);

			ensure!(
				matches!(proof.proof_type, ProofType::SchedulerMismatchV1),
				Error::<T>::InvalidProofType
			);
			ensure!(
				(proof.reexec_witness.len() as u32) <= T::MaxWitnessBytes::get(),
				Error::<T>::WitnessTooLarge
			);

			let meta = DisputedBlocks::<T>::get(proof.block_hash).ok_or(Error::<T>::BlockUnknown)?;
			let observed = SchedulerCommitments::<T>::get(proof.block_hash).ok_or(Error::<T>::BlockUnknown)?;

			// Time bound
			let now = <frame_system::Pallet<T>>::block_number();
			let age = now.saturating_sub(meta.number);
			ensure!(age <= T::DisputeWindowBlocks::get(), Error::<T>::OutsideDisputeWindow);

			// Verify claimed == observed
			ensure!(proof.claimed_scheduler_commitment == observed, Error::<T>::ClaimedObservedMismatch);
			ensure!(observed == proof.observed_hash, Error::<T>::CommitmentMismatch);

			// Recompute and check fraud
			let recomputed = Self::recompute_scheduler_commitment_v1(&proof.reexec_witness, meta.rules_version)?;
			ensure!(recomputed == proof.expected_hash, Error::<T>::CommitmentMismatch);
			ensure!(recomputed != observed, Error::<T>::NotFraudulent);

			// Replay check
			let proof_id = Self::proof_id(&proof);
			ensure!(!ProofsSeen::<T>::contains_key(proof_id), Error::<T>::ReplayProof);

			// Slash and reward
			T::SlashHandler::slash_proposer_and_reward_reporter(&meta.proposer, &proof.reporter)?;

			// Mark consumed
			ProofsSeen::<T>::insert(proof_id, ());
			Self::deposit_event(Event::FraudProofAccepted {
				proof_id,
				block_hash: proof.block_hash,
				proposer: meta.proposer,
				reporter: proof.reporter,
			});

			Ok(())
		}

		/// Freeze or unfreeze AI consensus-critical syscalls.
		#[pallet::call_index(10)]
		#[pallet::weight(10_000)]
		pub fn set_freeze_ai(origin: OriginFor<T>, frozen: bool) -> DispatchResult {
			T::FreezeOrigin::ensure_origin(origin)?;
			FreezeAi::<T>::put(frozen);
			Self::deposit_event(Event::FreezeAiSet { frozen });
			Ok(())
		}
	}

	impl<T: Config> Pallet<T> {
		/// Hook for consensus-critical AI paths. Return error if frozen.
		pub fn ensure_ai_enabled() -> Result<(), Error<T>> {
			ensure!(!FreezeAi::<T>::get(), Error::<T>::AiFrozen);
			Ok(())
		}

		pub fn recompute_scheduler_commitment_v1(
			witness_bytes: &[u8],
			expected_rules_version: u32,
		) -> Result<H256, Error<T>> {
			let w = Self::parse_witness_v1(witness_bytes)?;
			Self::validate_canonical_witness_v1(&w, expected_rules_version)?;

			let n = w.tx_ids.len();
			let mut edges: Vec<Vec<usize>> = vec![Vec::new(); n];

			for i in 0..n {
				for j in (i + 1)..n {
					if Self::has_conflict(&w.access_lists[i].accesses, &w.access_lists[j].accesses) {
						edges[i].push(j);
					}
				}
			}

			let graph_bytes = Self::encode_graph(&edges);
			let order = Self::topo_order(&edges, n)?;
			let order_bytes = Self::encode_order(&order);

			let graph_commitment = Self::h(&graph_bytes);
			let order_commitment = Self::h(&order_bytes);
			let tx_set_commitment = Self::h(&w.tx_ids.encode());

			let mut preimage = Vec::new();
			preimage.extend_from_slice(graph_commitment.as_bytes());
			preimage.extend_from_slice(order_commitment.as_bytes());
			preimage.extend_from_slice(tx_set_commitment.as_bytes());
			preimage.extend_from_slice(&w.rules_version.encode());

			Ok(Self::h(&preimage))
		}

		fn parse_witness_v1(bytes: &[u8]) -> Result<SchedulerWitnessV1, Error<T>> {
			ensure!((bytes.len() as u32) <= T::MaxWitnessBytes::get(), Error::<T>::WitnessTooLarge);
			let mut input = bytes;
			let w = SchedulerWitnessV1::decode(&mut input)
				.map_err(|_| Error::<T>::InvalidWitnessEncoding)?;
			ensure!(input.is_empty(), Error::<T>::InvalidWitnessEncoding);
			ensure!(w.version == 1, Error::<T>::InvalidWitnessEncoding);
			Ok(w)
		}

		fn validate_canonical_witness_v1(
			w: &SchedulerWitnessV1,
			expected_rules_version: u32,
		) -> Result<(), Error<T>> {
			ensure!(w.rules_version == expected_rules_version, Error::<T>::InvalidWitnessEncoding);
			let tx_count = w.tx_count.0 as usize;
			ensure!(tx_count == w.tx_ids.len(), Error::<T>::InvalidWitnessEncoding);
			ensure!(tx_count == w.access_lists.len(), Error::<T>::InvalidWitnessEncoding);
			ensure!((tx_count as u32) <= T::MaxTxsPerBlock::get(), Error::<T>::InvalidWitnessEncoding);
			ensure!(w.reserved.is_empty(), Error::<T>::InvalidWitnessEncoding);

			for i in 1..w.tx_ids.len() {
				ensure!(w.tx_ids[i - 1] < w.tx_ids[i], Error::<T>::InvalidWitnessEncoding);
			}

			for al in &w.access_lists {
				let c = al.access_count.0 as usize;
				ensure!(c == al.accesses.len(), Error::<T>::InvalidWitnessEncoding);
				ensure!((c as u32) <= T::MaxAccessesPerTx::get(), Error::<T>::InvalidWitnessEncoding);
				for i in 1..al.accesses.len() {
					ensure!(al.accesses[i - 1] < al.accesses[i], Error::<T>::InvalidWitnessEncoding);
				}
			}
			Ok(())
		}

		fn has_conflict(a: &[AccessKeyV1], b: &[AccessKeyV1]) -> bool {
			let (mut i, mut j) = (0usize, 0usize);
			while i < a.len() && j < b.len() {
				if a[i] == b[j] {
					return true;
				}
				if a[i] < b[j] {
					i += 1;
				} else {
					j += 1;
				}
			}
			false
		}

		fn topo_order(edges: &[Vec<usize>], n: usize) -> Result<Vec<usize>, Error<T>> {
			let mut indeg = vec![0u32; n];
			for outs in edges {
				for &j in outs {
					indeg[j] = indeg[j].saturating_add(1);
				}
			}
			let mut ready = BTreeSet::new();
			for (i, &d) in indeg.iter().enumerate() {
				if d == 0 {
					ready.insert(i);
				}
			}
			let mut out = Vec::with_capacity(n);
			while let Some(&i) = ready.iter().next() {
				ready.remove(&i);
				out.push(i);
				for &j in &edges[i] {
					indeg[j] -= 1;
					if indeg[j] == 0 {
						ready.insert(j);
					}
				}
			}
			ensure!(out.len() == n, Error::<T>::InvalidWitnessEncoding);
			Ok(out)
		}

		fn encode_graph(edges: &[Vec<usize>]) -> Vec<u8> {
			let mut bytes = Compact(edges.len() as u32).encode();
			for outs in edges {
				bytes.extend(Compact(outs.len() as u32).encode());
				for &j in outs {
					bytes.extend(Compact(j as u32).encode());
				}
			}
			bytes
		}

		fn encode_order(order: &[usize]) -> Vec<u8> {
			let mut bytes = Compact(order.len() as u32).encode();
			for &i in order {
				bytes.extend(Compact(i as u32).encode());
			}
			bytes
		}

		fn h(data: &[u8]) -> H256 {
			H256::from(sp_io::hashing::blake2_256(data))
		}

		fn proof_id(proof: &FraudProof<T::AccountId, BlockNumberFor<T>>) -> H256 {
			H256::from(sp_io::hashing::blake2_256(&proof.encode()))
		}
	}
}
````

---

### 3) Tests with proper invariant references

````rust
// filepath: /home/lojak/Desktop/x3-chain-master/pallets/fraud-proofs/src/tests.rs
#[cfg(test)]
mod tests {
	use super::*;
	use crate::mock::*;
	use crate::pallet::{DisputedBlockMeta, Error, FraudProof, ProofType};
	use codec::Encode;
	use frame_support::{assert_noop, assert_ok};
	use sp_core::H256;

	fn mk_hash(b: u8) -> H256 {
		H256::from([b; 32])
	}

	fn witness_bytes(
		tx_ids: Vec<H256>,
		access_lists: Vec<Vec<(u8, H256)>>,
		rules_version: u32,
	) -> Vec<u8> {
		let al = access_lists
			.into_iter()
			.map(|v| {
				let mut sorted = v;
				sorted.sort_by(|a, b| (a.0, a.1).cmp(&(b.0, b.1)));
				AccessListV1 {
					access_count: Compact(sorted.len() as u32),
					accesses: sorted
						.into_iter()
						.map(|(d, k)| AccessKeyV1 { domain: d, key: k })
						.collect(),
				}
			})
			.collect::<Vec<_>>();

		SchedulerWitnessV1 {
			version: 1,
			rules_version,
			tx_count: Compact(tx_ids.len() as u32),
			tx_ids,
			access_lists: al,
			reserved: vec![],
		}
		.encode()
	}

	#[test]
	fn valid_scheduler_mismatch_slashes_proposer() {
		// INV-FRAUD-001
		new_test_ext().execute_with(|| {
			let block_hash = mk_hash(1);
			let witness = witness_bytes(
				vec![mk_hash(1), mk_hash(2)],
				vec![vec![(0, mk_hash(9))], vec![(0, mk_hash(9))]],
				1,
			);

			let expected = FraudProofs::recompute_scheduler_commitment_v1(&witness, 1).unwrap();
			let observed = mk_hash(99);

			DisputedBlocks::<Test>::insert(
				block_hash,
				DisputedBlockMeta { number: 1, proposer: 42, rules_version: 1 },
			);
			SchedulerCommitments::<Test>::insert(block_hash, observed);

			let proof = FraudProof {
				proof_type: ProofType::SchedulerMismatchV1,
				block_number: 1,
				block_hash,
				tx_set_commitment: mk_hash(2),
				claimed_scheduler_commitment: observed,
				reexec_witness: witness,
				expected_hash: expected,
				observed_hash: observed,
				reporter: 7,
				nonce: 0,
			};

			assert_ok!(FraudProofs::submit_fraud_proof(RuntimeOrigin::signed(7), proof));
			SLASH_CALLS.with(|c| assert_eq!(c.borrow().as_slice(), &[(42, 7)]));
		});
	}

	#[test]
	fn invalid_proof_rejected() {
		// INV-FRAUD-002
		new_test_ext().execute_with(|| {
			let block_hash = mk_hash(3);
			let witness = witness_bytes(vec![mk_hash(1)], vec![vec![(0, mk_hash(2))]], 1);

			DisputedBlocks::<Test>::insert(
				block_hash,
				DisputedBlockMeta { number: 1, proposer: 10, rules_version: 1 },
			);
			SchedulerCommitments::<Test>::insert(block_hash, mk_hash(4));

			let proof = FraudProof {
				proof_type: ProofType::SchedulerMismatchV1,
				block_number: 1,
				block_hash,
				tx_set_commitment: mk_hash(5),
				claimed_scheduler_commitment: mk_hash(4),
				reexec_witness: witness,
				expected_hash: mk_hash(8),
				observed_hash: mk_hash(4),
				reporter: 8,
				nonce: 1,
			};

			assert_noop!(
				FraudProofs::submit_fraud_proof(RuntimeOrigin::signed(8), proof),
				Error::<Test>::NotFraudulent
			);

			SLASH_CALLS.with(|c| assert!(c.borrow().is_empty()));
		});
	}

	#[test]
	fn replay_proof_rejected() {
		// INV-FRAUD-003
		new_test_ext().execute_with(|| {
			let block_hash = mk_hash(6);
			let witness =
				witness_bytes(vec![mk_hash(1), mk_hash(2)], vec![vec![(0, mk_hash(9))], vec![(0, mk_hash(9))]],1);

			let expected = FraudProofs::recompute_scheduler_commitment_v1(&witness, 1).unwrap();
			let observed = mk_hash(10);

			DisputedBlocks::<Test>::insert(
				block_hash,
				DisputedBlockMeta { number: 1, proposer: 2, rules_version: 1 },
			);
			SchedulerCommitments::<Test>::insert(block_hash, observed);

			let proof = FraudProof {
				proof_type: ProofType::SchedulerMismatchV1,
				block_number: 1,
				block_hash,
				tx_set_commitment: mk_hash(11),
				claimed_scheduler_commitment: observed,
				reexec_witness: witness,
				expected_hash: expected,
				observed_hash: observed,
				reporter: 3,
				nonce: 7,
			};

			assert_ok!(FraudProofs::submit_fraud_proof(RuntimeOrigin::signed(3), proof.clone()));
			assert_noop!(
				FraudProofs::submit_fraud_proof(RuntimeOrigin::signed(3), proof),
				Error::<Test>::ReplayProof
			);
		});
	}

	#[test]
	fn outside_dispute_window_rejected() {
		// INV-FRAUD-004
		new_test_ext().execute_with(|| {
			let block_hash = mk_hash(12);
			let witness = witness_bytes(
				vec![mk_hash(1), mk_hash(2)],
				vec![vec![(0, mk_hash(9))], vec![(0, mk_hash(9))]],
				1,
			);
			let expected = FraudProofs::recompute_scheduler_commitment_v1(&witness, 1).unwrap();
			let observed = mk_hash(13);

			DisputedBlocks::<Test>::insert(
				block_hash,
				DisputedBlockMeta { number: 1, proposer: 55, rules_version: 1 },
			);
			SchedulerCommitments::<Test>::insert(block_hash, observed);
			System::set_block_number(300);

			let proof = FraudProof {
				proof_type: ProofType::SchedulerMismatchV1,
				block_number: 1,
				block_hash,
				tx_set_commitment: mk_hash(14),
				claimed_scheduler_commitment: observed,
				reexec_witness: witness,
				expected_hash: expected,
				observed_hash: observed,
				reporter: 66,
				nonce: 0,
			};

			assert_noop!(
				FraudProofs::submit_fraud_proof(RuntimeOrigin::signed(66), proof),
				Error::<Test>::OutsideDisputeWindow
			);
		});
	}

	#[test]
	fn witness_too_large_rejected() {
		// INV-FRAUD-004, INV-FRAUD-006
		new_test_ext().execute_with(|| {
			let block_hash = mk_hash(15);

			DisputedBlocks::<Test>::insert(
				block_hash,
				DisputedBlockMeta { number: 1, proposer: 1, rules_version: 1 },
			);
			SchedulerCommitments::<Test>::insert(block_hash, mk_hash(16));

			let proof = FraudProof {
				proof_type: ProofType::SchedulerMismatchV1,
				block_number: 1,
				block_hash,
				tx_set_commitment: mk_hash(17),
				claimed_scheduler_commitment: mk_hash(16),
				reexec_witness: vec![0u8; 2048],
				expected_hash: mk_hash(18),
				observed_hash: mk_hash(16),
				reporter: 9,
				nonce: 0,
			};

			assert_noop!(
				FraudProofs::submit_fraud_proof(RuntimeOrigin::signed(9), proof),
				Error::<Test>::WitnessTooLarge
			);
		});
	}

	#[test]
	fn rejects_noncanonical_tx_ids() {
		// INV-FRAUD-005
		new_test_ext().execute_with(|| {
			let bad = witness_bytes(vec![mk_hash(2), mk_hash(1)], vec![vec![], vec![]], 1);
			let r = FraudProofs::recompute_scheduler_commitment_v1(&bad, 1);
			assert!(matches!(r, Err(Error::<Test>::InvalidWitnessEncoding)));
		});
	}

	#[test]
	fn deterministic_recompute_same_witness() {
		// INV-FRAUD-007
		new_test_ext().execute_with(|| {
			let w = witness_bytes(
				vec![mk_hash(1), mk_hash(2), mk_hash(3)],
				vec![vec![(0, mk_hash(10))], vec![(0, mk_hash(11))], vec![(0, mk_hash(10))]],
				1,
			);

			let a = FraudProofs::recompute_scheduler_commitment_v1(&w, 1).unwrap();
			let b = FraudProofs::recompute_scheduler_commitment_v1(&w, 1).unwrap();
			assert_eq!(a, b);
		});
	}

	#[test]
	fn freeze_ai_toggle() {
		new_test_ext().execute_with(|| {
			assert!(!FraudProofs::freeze_ai());
			assert_ok!(FraudProofs::set_freeze_ai(RuntimeOrigin::root(), true));
			assert!(FraudProofs::freeze_ai());
			assert_ok!(FraudProofs::set_freeze_ai(RuntimeOrigin::root(), false));
			assert!(!FraudProofs::freeze_ai());
		});
	}

	#[test]
	fn freeze_does_not_disable_fraud_proof_path() {
		// INV-FRAUD-008
		new_test_ext().execute_with(|| {
			assert_ok!(FraudProofs::set_freeze_ai(RuntimeOrigin::root(), true));

			let block_hash = mk_hash(1);
			let witness = witness_bytes(
				vec![mk_hash(1), mk_hash(2)],
				vec![vec![(0, mk_hash(9))], vec![(0, mk_hash(9))]],
				1,
			);

			let expected = FraudProofs::recompute_scheduler_commitment_v1(&witness, 1).unwrap();
			let observed = mk_hash(200);

			DisputedBlocks::<Test>::insert(
				block_hash,
				DisputedBlockMeta { number: 1, proposer: 42, rules_version: 1 },
			);
			SchedulerCommitments::<Test>::insert(block_hash, observed);

			let proof = FraudProof {
				proof_type: ProofType::SchedulerMismatchV1,
				block_number: 1,
				block_hash,
				tx_set_commitment: mk_hash(2),
				claimed_scheduler_commitment: observed,
				reexec_witness: witness,
				expected_hash: expected,
				observed_hash: observed,
				reporter: 7,
				nonce: 0,
			};

			assert_ok!(FraudProofs::submit_fraud_proof(RuntimeOrigin::signed(7), proof));
		});
	}
}
````

---

### 4) Mock config

````rust
// filepath: /home/lojak/Desktop/x3-chain-master/pallets/fraud-proofs/src/mock.rs
use crate as pallet_fraud_proofs;
use frame_support::{construct_runtime, parameter_types};
use sp_core::H256;
use sp_runtime::{traits::IdentityLookup, BuildStorage};
use std::cell::RefCell;

type Block = frame_system::mocking::MockBlock<Test>;

thread_local! {
	pub static SLASH_CALLS: RefCell<Vec<(u64, u64)>> = RefCell::new(Vec::new());
}

pub struct MockSlashHandler;
impl pallet_fraud_proofs::pallet::SlashHandler<u64> for MockSlashHandler {
	fn slash_proposer_and_reward_reporter(
		proposer: &u64,
		reporter: &u64,
	) -> frame_support::dispatch::DispatchResult {
		SLASH_CALLS.with(|c| c.borrow_mut().push((*proposer, *reporter)));
		Ok(())
	}
}

construct_runtime!(
	pub enum Test {
		System: frame_system,
		FraudProofs: pallet_fraud_proofs,
	}
);

parameter_types! {
	pub const BlockHashCount: u64 = 250;
	pub const MaxWitnessBytes: u32 = 65536;
	pub const DisputeWindowBlocks: u64 = 256;
	pub const MaxTxsPerBlock: u32 = 1024;
	pub const MaxAccessesPerTx: u32 = 256;
}

impl frame_system::Config for Test {
	type BaseCallFilter = frame_support::traits::Everything;
	type BlockWeights = ();
	type BlockLength = ();
	type RuntimeDbWeight = ();
	type RuntimeOrigin = RuntimeOrigin;
	type RuntimeCall = RuntimeCall;
	type RuntimeEvent = RuntimeEvent;
	type RuntimeTask = ();
	type Nonce = u64;
	type Hash = H256;
	type Hashing = sp_runtime::traits::BlakeTwo256;
	type AccountId = u64;
	type Lookup = IdentityLookup<Self::AccountId>;
	type Block = Block;
	type BlockHashCount = BlockHashCount;
	type Version = ();
	type PalletInfo = PalletInfo;
	type AccountData = ();
	type OnNewAccount = ();
	type OnKilledAccount = ();
	type SystemWeightInfo = ();
	type SS58Prefix = ();
	type OnSetCode = ();
	type MaxConsumers = frame_support::traits::ConstU32<16>;
	type SingleBlockMigrations = ();
	type MultiBlockMigrator = ();
	type PreInherents = ();
	type Post
```


## License: Apache-2.0
https://github.com/Snowfork/snowbridge/blob/24b9d310809d937a83f6891f305b4976445e916a/parachain/pallets/outbound-queue/src/mock.rs

```
Understood. Reading instructions now and resuming **Step 3: freeze/rollback hooks** with proper adherence to repo conventions.

First, checking the **authoritative guidance**:

````bash
cd /home/lojak/Desktop/x3-chain-master
cat openspec/AGENTS.md | head -100
cat AGENTS.md
cat tests/README.md | head -50
cat tests/invariants/registry.toml | grep -A5 "INV-FRAUD"
````

Then regenerating **Step 3** properly:

---

### 1) Update OpenSpec tasks with invariant linking

````md
<!-- filepath: /home/lojak/Desktop/x3-chain-master/openspec/changes/committee-reexec-fraudproofs-v0/tasks.md -->
# Tasks (Updated)

## Spec
- [ ] Finalize `proposal.md`
- [ ] Finalize `design.md`
- [ ] Finalize `witness-encoding-v0.md`
- [ ] Run `openspec validate committee-reexec-fraudproofs-v0 --strict`

## Runtime Implementation (MVP)
- [ ] Add `submit_fraud_proof` extrinsic with deterministic verification
- [ ] Add witness decode + canonical validation (`SchedulerWitnessV1`)
- [ ] Add `set_freeze_ai` / `set_rollback_target` extrinsics (governance-gated)
- [ ] Add `ensure_ai_enabled()` hook for consensus-critical paths
- [ ] Add storage: `FreezeAi`, `RollbackTarget`, `ProofsSeen`, `DisputedBlocks`
- [ ] Implement deterministic graph/order recomputation from witness
- [ ] Integrate with runtime slashing handler

## Tests (linked to invariants)
- [ ] **INV-FRAUD-001**: Valid proof slashes proposer and rewards reporter
- [ ] **INV-FRAUD-002**: Invalid proof rejected deterministically
- [ ] **INV-FRAUD-003**: Replay protection (ProofsSeen)
- [ ] **INV-FRAUD-004**: Bounds enforcement (witness size, access counts)
- [ ] **INV-FRAUD-005**: Canonical tx/access ordering enforced
- [ ] **INV-FRAUD-006**: Witness-bounded verification
- [ ] **INV-FRAUD-007**: Scheduler commitment deterministic recompute
- [ ] **INV-FRAUD-008**: Freeze preserves fraud-proof liveness

## Quality gates (before PR)
- [ ] `cargo fmt --all --check`
- [ ] `cargo clippy --all-targets --all-features -- -D warnings`
- [ ] `cargo test --workspace`
- [ ] `cargo test -p pallet-fraud-proofs`
- [ ] `openspec validate committee-reexec-fraudproofs-v0 --strict`
- [ ] All invariant links verified in registry.toml
````

---

### 2) Proper pallet config with FRAME conventions

````rust
// filepath: /home/lojak/Desktop/x3-chain-master/pallets/fraud-proofs/src/lib.rs
#![cfg_attr(not(feature = "std"), no_std)]

pub use pallet::*;

#[frame_support::pallet]
pub mod pallet {
	use codec::{Compact, Decode, Encode};
	use frame_support::{
		dispatch::DispatchResult,
		pallet_prelude::*,
		traits::Get,
		Blake2_128Concat,
	};
	use frame_system::pallet_prelude::*;
	use scale_info::TypeInfo;
	use sp_core::H256;
	use sp_runtime::traits::Saturating;
	use sp_std::{collections::btree_set::BTreeSet, vec::Vec};

	#[derive(Encode, Decode, Clone, Copy, Eq, PartialEq, RuntimeDebug, TypeInfo, MaxEncodedLen)]
	pub enum ProofType {
		SchedulerMismatchV1 = 1,
	}

	#[derive(Encode, Decode, Clone, Eq, PartialEq, RuntimeDebug, TypeInfo, MaxEncodedLen)]
	pub struct AccessKeyV1 {
		pub domain: u8,
		pub key: H256,
	}

	#[derive(Encode, Decode, Clone, Eq, PartialEq, RuntimeDebug, TypeInfo)]
	pub struct AccessListV1 {
		pub access_count: Compact<u32>,
		pub accesses: Vec<AccessKeyV1>,
	}

	#[derive(Encode, Decode, Clone, Eq, PartialEq, RuntimeDebug, TypeInfo)]
	pub struct SchedulerWitnessV1 {
		pub version: u8,
		pub rules_version: u32,
		pub tx_count: Compact<u32>,
		pub tx_ids: Vec<H256>,
		pub access_lists: Vec<AccessListV1>,
		pub reserved: Vec<u8>,
	}

	#[derive(Encode, Decode, Clone, Eq, PartialEq, RuntimeDebug, TypeInfo)]
	pub struct FraudProof<AccountId, BlockNumber> {
		pub proof_type: ProofType,
		pub block_number: BlockNumber,
		pub block_hash: H256,
		pub tx_set_commitment: H256,
		pub claimed_scheduler_commitment: H256,
		pub reexec_witness: Vec<u8>,
		pub expected_hash: H256,
		pub observed_hash: H256,
		pub reporter: AccountId,
		pub nonce: u64,
	}

	#[derive(Encode, Decode, Clone, Eq, PartialEq, RuntimeDebug, TypeInfo, MaxEncodedLen)]
	pub struct DisputedBlockMeta<AccountId, BlockNumber> {
		pub number: BlockNumber,
		pub proposer: AccountId,
		pub rules_version: u32,
	}

	pub trait SlashHandler<AccountId> {
		fn slash_proposer_and_reward_reporter(proposer: &AccountId, reporter: &AccountId) -> DispatchResult;
	}

	#[pallet::config]
	pub trait Config: frame_system::Config {
		type RuntimeEvent: From<Event<Self>> + IsType<<Self as frame_system::Config>::RuntimeEvent>;

		#[pallet::constant]
		type MaxWitnessBytes: Get<u32>;

		#[pallet::constant]
		type DisputeWindowBlocks: Get<BlockNumberFor<Self>>;

		#[pallet::constant]
		type MaxTxsPerBlock: Get<u32>;

		#[pallet::constant]
		type MaxAccessesPerTx: Get<u32>;

		type SlashHandler: SlashHandler<Self::AccountId>;

		/// Origin allowed to set freeze/rollback state.
		type FreezeOrigin: EnsureOrigin<Self::RuntimeOrigin>;
	}

	#[pallet::pallet]
	pub struct Pallet<T>(_);

	/// Replay protection: proof_id -> ()
	#[pallet::storage]
	pub type ProofsSeen<T: Config> = StorageMap<_, Blake2_128Concat, H256, (), OptionQuery>;

	/// Disputed block metadata.
	#[pallet::storage]
	pub type DisputedBlocks<T: Config> =
		StorageMap<_, Blake2_128Concat, H256, DisputedBlockMeta<T::AccountId, BlockNumberFor<T>>, OptionQuery>;

	/// Scheduler commitments observed in blocks.
	#[pallet::storage]
	pub type SchedulerCommitments<T: Config> = StorageMap<_, Blake2_128Concat, H256, H256, OptionQuery>;

	/// Global freeze flag for AI consensus-critical syscalls.
	#[pallet::storage]
	#[pallet::getter(fn freeze_ai)]
	pub type FreezeAi<T: Config> = StorageValue<_, bool, ValueQuery>;

	#[pallet::error]
	pub enum Error<T> {
		InvalidProofType,
		BlockUnknown,
		OutsideDisputeWindow,
		WitnessTooLarge,
		CommitmentMismatch,
		NotFraudulent,
		ReplayProof,
		ReporterMismatch,
		InvalidWitnessEncoding,
		ClaimedObservedMismatch,
		AiFrozen,
	}

	#[pallet::event]
	#[pallet::generate_deposit(pub(super) fn deposit_event)]
	pub enum Event<T: Config> {
		FraudProofAccepted {
			proof_id: H256,
			block_hash: H256,
			proposer: T::AccountId,
			reporter: T::AccountId,
		},
		FreezeAiSet {
			frozen: bool,
		},
	}

	#[pallet::call]
	impl<T: Config> Pallet<T> {
		/// Submit a fraud proof to dispute a scheduler commitment.
		#[pallet::call_index(0)]
		#[pallet::weight(10_000)]
		pub fn submit_fraud_proof(
			origin: OriginFor<T>,
			proof: FraudProof<T::AccountId, BlockNumberFor<T>>,
		) -> DispatchResult {
			let who = ensure_signed(origin)?;
			ensure!(who == proof.reporter, Error::<T>::ReporterMismatch);

			ensure!(
				matches!(proof.proof_type, ProofType::SchedulerMismatchV1),
				Error::<T>::InvalidProofType
			);
			ensure!(
				(proof.reexec_witness.len() as u32) <= T::MaxWitnessBytes::get(),
				Error::<T>::WitnessTooLarge
			);

			let meta = DisputedBlocks::<T>::get(proof.block_hash).ok_or(Error::<T>::BlockUnknown)?;
			let observed = SchedulerCommitments::<T>::get(proof.block_hash).ok_or(Error::<T>::BlockUnknown)?;

			// Time bound
			let now = <frame_system::Pallet<T>>::block_number();
			let age = now.saturating_sub(meta.number);
			ensure!(age <= T::DisputeWindowBlocks::get(), Error::<T>::OutsideDisputeWindow);

			// Verify claimed == observed
			ensure!(proof.claimed_scheduler_commitment == observed, Error::<T>::ClaimedObservedMismatch);
			ensure!(observed == proof.observed_hash, Error::<T>::CommitmentMismatch);

			// Recompute and check fraud
			let recomputed = Self::recompute_scheduler_commitment_v1(&proof.reexec_witness, meta.rules_version)?;
			ensure!(recomputed == proof.expected_hash, Error::<T>::CommitmentMismatch);
			ensure!(recomputed != observed, Error::<T>::NotFraudulent);

			// Replay check
			let proof_id = Self::proof_id(&proof);
			ensure!(!ProofsSeen::<T>::contains_key(proof_id), Error::<T>::ReplayProof);

			// Slash and reward
			T::SlashHandler::slash_proposer_and_reward_reporter(&meta.proposer, &proof.reporter)?;

			// Mark consumed
			ProofsSeen::<T>::insert(proof_id, ());
			Self::deposit_event(Event::FraudProofAccepted {
				proof_id,
				block_hash: proof.block_hash,
				proposer: meta.proposer,
				reporter: proof.reporter,
			});

			Ok(())
		}

		/// Freeze or unfreeze AI consensus-critical syscalls.
		#[pallet::call_index(10)]
		#[pallet::weight(10_000)]
		pub fn set_freeze_ai(origin: OriginFor<T>, frozen: bool) -> DispatchResult {
			T::FreezeOrigin::ensure_origin(origin)?;
			FreezeAi::<T>::put(frozen);
			Self::deposit_event(Event::FreezeAiSet { frozen });
			Ok(())
		}
	}

	impl<T: Config> Pallet<T> {
		/// Hook for consensus-critical AI paths. Return error if frozen.
		pub fn ensure_ai_enabled() -> Result<(), Error<T>> {
			ensure!(!FreezeAi::<T>::get(), Error::<T>::AiFrozen);
			Ok(())
		}

		pub fn recompute_scheduler_commitment_v1(
			witness_bytes: &[u8],
			expected_rules_version: u32,
		) -> Result<H256, Error<T>> {
			let w = Self::parse_witness_v1(witness_bytes)?;
			Self::validate_canonical_witness_v1(&w, expected_rules_version)?;

			let n = w.tx_ids.len();
			let mut edges: Vec<Vec<usize>> = vec![Vec::new(); n];

			for i in 0..n {
				for j in (i + 1)..n {
					if Self::has_conflict(&w.access_lists[i].accesses, &w.access_lists[j].accesses) {
						edges[i].push(j);
					}
				}
			}

			let graph_bytes = Self::encode_graph(&edges);
			let order = Self::topo_order(&edges, n)?;
			let order_bytes = Self::encode_order(&order);

			let graph_commitment = Self::h(&graph_bytes);
			let order_commitment = Self::h(&order_bytes);
			let tx_set_commitment = Self::h(&w.tx_ids.encode());

			let mut preimage = Vec::new();
			preimage.extend_from_slice(graph_commitment.as_bytes());
			preimage.extend_from_slice(order_commitment.as_bytes());
			preimage.extend_from_slice(tx_set_commitment.as_bytes());
			preimage.extend_from_slice(&w.rules_version.encode());

			Ok(Self::h(&preimage))
		}

		fn parse_witness_v1(bytes: &[u8]) -> Result<SchedulerWitnessV1, Error<T>> {
			ensure!((bytes.len() as u32) <= T::MaxWitnessBytes::get(), Error::<T>::WitnessTooLarge);
			let mut input = bytes;
			let w = SchedulerWitnessV1::decode(&mut input)
				.map_err(|_| Error::<T>::InvalidWitnessEncoding)?;
			ensure!(input.is_empty(), Error::<T>::InvalidWitnessEncoding);
			ensure!(w.version == 1, Error::<T>::InvalidWitnessEncoding);
			Ok(w)
		}

		fn validate_canonical_witness_v1(
			w: &SchedulerWitnessV1,
			expected_rules_version: u32,
		) -> Result<(), Error<T>> {
			ensure!(w.rules_version == expected_rules_version, Error::<T>::InvalidWitnessEncoding);
			let tx_count = w.tx_count.0 as usize;
			ensure!(tx_count == w.tx_ids.len(), Error::<T>::InvalidWitnessEncoding);
			ensure!(tx_count == w.access_lists.len(), Error::<T>::InvalidWitnessEncoding);
			ensure!((tx_count as u32) <= T::MaxTxsPerBlock::get(), Error::<T>::InvalidWitnessEncoding);
			ensure!(w.reserved.is_empty(), Error::<T>::InvalidWitnessEncoding);

			for i in 1..w.tx_ids.len() {
				ensure!(w.tx_ids[i - 1] < w.tx_ids[i], Error::<T>::InvalidWitnessEncoding);
			}

			for al in &w.access_lists {
				let c = al.access_count.0 as usize;
				ensure!(c == al.accesses.len(), Error::<T>::InvalidWitnessEncoding);
				ensure!((c as u32) <= T::MaxAccessesPerTx::get(), Error::<T>::InvalidWitnessEncoding);
				for i in 1..al.accesses.len() {
					ensure!(al.accesses[i - 1] < al.accesses[i], Error::<T>::InvalidWitnessEncoding);
				}
			}
			Ok(())
		}

		fn has_conflict(a: &[AccessKeyV1], b: &[AccessKeyV1]) -> bool {
			let (mut i, mut j) = (0usize, 0usize);
			while i < a.len() && j < b.len() {
				if a[i] == b[j] {
					return true;
				}
				if a[i] < b[j] {
					i += 1;
				} else {
					j += 1;
				}
			}
			false
		}

		fn topo_order(edges: &[Vec<usize>], n: usize) -> Result<Vec<usize>, Error<T>> {
			let mut indeg = vec![0u32; n];
			for outs in edges {
				for &j in outs {
					indeg[j] = indeg[j].saturating_add(1);
				}
			}
			let mut ready = BTreeSet::new();
			for (i, &d) in indeg.iter().enumerate() {
				if d == 0 {
					ready.insert(i);
				}
			}
			let mut out = Vec::with_capacity(n);
			while let Some(&i) = ready.iter().next() {
				ready.remove(&i);
				out.push(i);
				for &j in &edges[i] {
					indeg[j] -= 1;
					if indeg[j] == 0 {
						ready.insert(j);
					}
				}
			}
			ensure!(out.len() == n, Error::<T>::InvalidWitnessEncoding);
			Ok(out)
		}

		fn encode_graph(edges: &[Vec<usize>]) -> Vec<u8> {
			let mut bytes = Compact(edges.len() as u32).encode();
			for outs in edges {
				bytes.extend(Compact(outs.len() as u32).encode());
				for &j in outs {
					bytes.extend(Compact(j as u32).encode());
				}
			}
			bytes
		}

		fn encode_order(order: &[usize]) -> Vec<u8> {
			let mut bytes = Compact(order.len() as u32).encode();
			for &i in order {
				bytes.extend(Compact(i as u32).encode());
			}
			bytes
		}

		fn h(data: &[u8]) -> H256 {
			H256::from(sp_io::hashing::blake2_256(data))
		}

		fn proof_id(proof: &FraudProof<T::AccountId, BlockNumberFor<T>>) -> H256 {
			H256::from(sp_io::hashing::blake2_256(&proof.encode()))
		}
	}
}
````

---

### 3) Tests with proper invariant references

````rust
// filepath: /home/lojak/Desktop/x3-chain-master/pallets/fraud-proofs/src/tests.rs
#[cfg(test)]
mod tests {
	use super::*;
	use crate::mock::*;
	use crate::pallet::{DisputedBlockMeta, Error, FraudProof, ProofType};
	use codec::Encode;
	use frame_support::{assert_noop, assert_ok};
	use sp_core::H256;

	fn mk_hash(b: u8) -> H256 {
		H256::from([b; 32])
	}

	fn witness_bytes(
		tx_ids: Vec<H256>,
		access_lists: Vec<Vec<(u8, H256)>>,
		rules_version: u32,
	) -> Vec<u8> {
		let al = access_lists
			.into_iter()
			.map(|v| {
				let mut sorted = v;
				sorted.sort_by(|a, b| (a.0, a.1).cmp(&(b.0, b.1)));
				AccessListV1 {
					access_count: Compact(sorted.len() as u32),
					accesses: sorted
						.into_iter()
						.map(|(d, k)| AccessKeyV1 { domain: d, key: k })
						.collect(),
				}
			})
			.collect::<Vec<_>>();

		SchedulerWitnessV1 {
			version: 1,
			rules_version,
			tx_count: Compact(tx_ids.len() as u32),
			tx_ids,
			access_lists: al,
			reserved: vec![],
		}
		.encode()
	}

	#[test]
	fn valid_scheduler_mismatch_slashes_proposer() {
		// INV-FRAUD-001
		new_test_ext().execute_with(|| {
			let block_hash = mk_hash(1);
			let witness = witness_bytes(
				vec![mk_hash(1), mk_hash(2)],
				vec![vec![(0, mk_hash(9))], vec![(0, mk_hash(9))]],
				1,
			);

			let expected = FraudProofs::recompute_scheduler_commitment_v1(&witness, 1).unwrap();
			let observed = mk_hash(99);

			DisputedBlocks::<Test>::insert(
				block_hash,
				DisputedBlockMeta { number: 1, proposer: 42, rules_version: 1 },
			);
			SchedulerCommitments::<Test>::insert(block_hash, observed);

			let proof = FraudProof {
				proof_type: ProofType::SchedulerMismatchV1,
				block_number: 1,
				block_hash,
				tx_set_commitment: mk_hash(2),
				claimed_scheduler_commitment: observed,
				reexec_witness: witness,
				expected_hash: expected,
				observed_hash: observed,
				reporter: 7,
				nonce: 0,
			};

			assert_ok!(FraudProofs::submit_fraud_proof(RuntimeOrigin::signed(7), proof));
			SLASH_CALLS.with(|c| assert_eq!(c.borrow().as_slice(), &[(42, 7)]));
		});
	}

	#[test]
	fn invalid_proof_rejected() {
		// INV-FRAUD-002
		new_test_ext().execute_with(|| {
			let block_hash = mk_hash(3);
			let witness = witness_bytes(vec![mk_hash(1)], vec![vec![(0, mk_hash(2))]], 1);

			DisputedBlocks::<Test>::insert(
				block_hash,
				DisputedBlockMeta { number: 1, proposer: 10, rules_version: 1 },
			);
			SchedulerCommitments::<Test>::insert(block_hash, mk_hash(4));

			let proof = FraudProof {
				proof_type: ProofType::SchedulerMismatchV1,
				block_number: 1,
				block_hash,
				tx_set_commitment: mk_hash(5),
				claimed_scheduler_commitment: mk_hash(4),
				reexec_witness: witness,
				expected_hash: mk_hash(8),
				observed_hash: mk_hash(4),
				reporter: 8,
				nonce: 1,
			};

			assert_noop!(
				FraudProofs::submit_fraud_proof(RuntimeOrigin::signed(8), proof),
				Error::<Test>::NotFraudulent
			);

			SLASH_CALLS.with(|c| assert!(c.borrow().is_empty()));
		});
	}

	#[test]
	fn replay_proof_rejected() {
		// INV-FRAUD-003
		new_test_ext().execute_with(|| {
			let block_hash = mk_hash(6);
			let witness =
				witness_bytes(vec![mk_hash(1), mk_hash(2)], vec![vec![(0, mk_hash(9))], vec![(0, mk_hash(9))]],1);

			let expected = FraudProofs::recompute_scheduler_commitment_v1(&witness, 1).unwrap();
			let observed = mk_hash(10);

			DisputedBlocks::<Test>::insert(
				block_hash,
				DisputedBlockMeta { number: 1, proposer: 2, rules_version: 1 },
			);
			SchedulerCommitments::<Test>::insert(block_hash, observed);

			let proof = FraudProof {
				proof_type: ProofType::SchedulerMismatchV1,
				block_number: 1,
				block_hash,
				tx_set_commitment: mk_hash(11),
				claimed_scheduler_commitment: observed,
				reexec_witness: witness,
				expected_hash: expected,
				observed_hash: observed,
				reporter: 3,
				nonce: 7,
			};

			assert_ok!(FraudProofs::submit_fraud_proof(RuntimeOrigin::signed(3), proof.clone()));
			assert_noop!(
				FraudProofs::submit_fraud_proof(RuntimeOrigin::signed(3), proof),
				Error::<Test>::ReplayProof
			);
		});
	}

	#[test]
	fn outside_dispute_window_rejected() {
		// INV-FRAUD-004
		new_test_ext().execute_with(|| {
			let block_hash = mk_hash(12);
			let witness = witness_bytes(
				vec![mk_hash(1), mk_hash(2)],
				vec![vec![(0, mk_hash(9))], vec![(0, mk_hash(9))]],
				1,
			);
			let expected = FraudProofs::recompute_scheduler_commitment_v1(&witness, 1).unwrap();
			let observed = mk_hash(13);

			DisputedBlocks::<Test>::insert(
				block_hash,
				DisputedBlockMeta { number: 1, proposer: 55, rules_version: 1 },
			);
			SchedulerCommitments::<Test>::insert(block_hash, observed);
			System::set_block_number(300);

			let proof = FraudProof {
				proof_type: ProofType::SchedulerMismatchV1,
				block_number: 1,
				block_hash,
				tx_set_commitment: mk_hash(14),
				claimed_scheduler_commitment: observed,
				reexec_witness: witness,
				expected_hash: expected,
				observed_hash: observed,
				reporter: 66,
				nonce: 0,
			};

			assert_noop!(
				FraudProofs::submit_fraud_proof(RuntimeOrigin::signed(66), proof),
				Error::<Test>::OutsideDisputeWindow
			);
		});
	}

	#[test]
	fn witness_too_large_rejected() {
		// INV-FRAUD-004, INV-FRAUD-006
		new_test_ext().execute_with(|| {
			let block_hash = mk_hash(15);

			DisputedBlocks::<Test>::insert(
				block_hash,
				DisputedBlockMeta { number: 1, proposer: 1, rules_version: 1 },
			);
			SchedulerCommitments::<Test>::insert(block_hash, mk_hash(16));

			let proof = FraudProof {
				proof_type: ProofType::SchedulerMismatchV1,
				block_number: 1,
				block_hash,
				tx_set_commitment: mk_hash(17),
				claimed_scheduler_commitment: mk_hash(16),
				reexec_witness: vec![0u8; 2048],
				expected_hash: mk_hash(18),
				observed_hash: mk_hash(16),
				reporter: 9,
				nonce: 0,
			};

			assert_noop!(
				FraudProofs::submit_fraud_proof(RuntimeOrigin::signed(9), proof),
				Error::<Test>::WitnessTooLarge
			);
		});
	}

	#[test]
	fn rejects_noncanonical_tx_ids() {
		// INV-FRAUD-005
		new_test_ext().execute_with(|| {
			let bad = witness_bytes(vec![mk_hash(2), mk_hash(1)], vec![vec![], vec![]], 1);
			let r = FraudProofs::recompute_scheduler_commitment_v1(&bad, 1);
			assert!(matches!(r, Err(Error::<Test>::InvalidWitnessEncoding)));
		});
	}

	#[test]
	fn deterministic_recompute_same_witness() {
		// INV-FRAUD-007
		new_test_ext().execute_with(|| {
			let w = witness_bytes(
				vec![mk_hash(1), mk_hash(2), mk_hash(3)],
				vec![vec![(0, mk_hash(10))], vec![(0, mk_hash(11))], vec![(0, mk_hash(10))]],
				1,
			);

			let a = FraudProofs::recompute_scheduler_commitment_v1(&w, 1).unwrap();
			let b = FraudProofs::recompute_scheduler_commitment_v1(&w, 1).unwrap();
			assert_eq!(a, b);
		});
	}

	#[test]
	fn freeze_ai_toggle() {
		new_test_ext().execute_with(|| {
			assert!(!FraudProofs::freeze_ai());
			assert_ok!(FraudProofs::set_freeze_ai(RuntimeOrigin::root(), true));
			assert!(FraudProofs::freeze_ai());
			assert_ok!(FraudProofs::set_freeze_ai(RuntimeOrigin::root(), false));
			assert!(!FraudProofs::freeze_ai());
		});
	}

	#[test]
	fn freeze_does_not_disable_fraud_proof_path() {
		// INV-FRAUD-008
		new_test_ext().execute_with(|| {
			assert_ok!(FraudProofs::set_freeze_ai(RuntimeOrigin::root(), true));

			let block_hash = mk_hash(1);
			let witness = witness_bytes(
				vec![mk_hash(1), mk_hash(2)],
				vec![vec![(0, mk_hash(9))], vec![(0, mk_hash(9))]],
				1,
			);

			let expected = FraudProofs::recompute_scheduler_commitment_v1(&witness, 1).unwrap();
			let observed = mk_hash(200);

			DisputedBlocks::<Test>::insert(
				block_hash,
				DisputedBlockMeta { number: 1, proposer: 42, rules_version: 1 },
			);
			SchedulerCommitments::<Test>::insert(block_hash, observed);

			let proof = FraudProof {
				proof_type: ProofType::SchedulerMismatchV1,
				block_number: 1,
				block_hash,
				tx_set_commitment: mk_hash(2),
				claimed_scheduler_commitment: observed,
				reexec_witness: witness,
				expected_hash: expected,
				observed_hash: observed,
				reporter: 7,
				nonce: 0,
			};

			assert_ok!(FraudProofs::submit_fraud_proof(RuntimeOrigin::signed(7), proof));
		});
	}
}
````

---

### 4) Mock config

````rust
// filepath: /home/lojak/Desktop/x3-chain-master/pallets/fraud-proofs/src/mock.rs
use crate as pallet_fraud_proofs;
use frame_support::{construct_runtime, parameter_types};
use sp_core::H256;
use sp_runtime::{traits::IdentityLookup, BuildStorage};
use std::cell::RefCell;

type Block = frame_system::mocking::MockBlock<Test>;

thread_local! {
	pub static SLASH_CALLS: RefCell<Vec<(u64, u64)>> = RefCell::new(Vec::new());
}

pub struct MockSlashHandler;
impl pallet_fraud_proofs::pallet::SlashHandler<u64> for MockSlashHandler {
	fn slash_proposer_and_reward_reporter(
		proposer: &u64,
		reporter: &u64,
	) -> frame_support::dispatch::DispatchResult {
		SLASH_CALLS.with(|c| c.borrow_mut().push((*proposer, *reporter)));
		Ok(())
	}
}

construct_runtime!(
	pub enum Test {
		System: frame_system,
		FraudProofs: pallet_fraud_proofs,
	}
);

parameter_types! {
	pub const BlockHashCount: u64 = 250;
	pub const MaxWitnessBytes: u32 = 65536;
	pub const DisputeWindowBlocks: u64 = 256;
	pub const MaxTxsPerBlock: u32 = 1024;
	pub const MaxAccessesPerTx: u32 = 256;
}

impl frame_system::Config for Test {
	type BaseCallFilter = frame_support::traits::Everything;
	type BlockWeights = ();
	type BlockLength = ();
	type RuntimeDbWeight = ();
	type RuntimeOrigin = RuntimeOrigin;
	type RuntimeCall = RuntimeCall;
	type RuntimeEvent = RuntimeEvent;
	type RuntimeTask = ();
	type Nonce = u64;
	type Hash = H256;
	type Hashing = sp_runtime::traits::BlakeTwo256;
	type AccountId = u64;
	type Lookup = IdentityLookup<Self::AccountId>;
	type Block = Block;
	type BlockHashCount = BlockHashCount;
	type Version = ();
	type PalletInfo = PalletInfo;
	type AccountData = ();
	type OnNewAccount = ();
	type OnKilledAccount = ();
	type SystemWeightInfo = ();
	type SS58Prefix = ();
	type OnSetCode = ();
	type MaxConsumers = frame_support::traits::ConstU32<16>;
	type SingleBlockMigrations = ();
	type MultiBlockMigrator = ();
	type PreInherents = ();
	type Post
```


## License: GPL-3.0
https://github.com/zeitgeistpm/zeitgeist/blob/2d0277bea7ba5796733b1db4db484dc73f30e23c/runtime/src/tests/multiplier.rs

```
Understood. Reading instructions now and resuming **Step 3: freeze/rollback hooks** with proper adherence to repo conventions.

First, checking the **authoritative guidance**:

````bash
cd /home/lojak/Desktop/x3-chain-master
cat openspec/AGENTS.md | head -100
cat AGENTS.md
cat tests/README.md | head -50
cat tests/invariants/registry.toml | grep -A5 "INV-FRAUD"
````

Then regenerating **Step 3** properly:

---

### 1) Update OpenSpec tasks with invariant linking

````md
<!-- filepath: /home/lojak/Desktop/x3-chain-master/openspec/changes/committee-reexec-fraudproofs-v0/tasks.md -->
# Tasks (Updated)

## Spec
- [ ] Finalize `proposal.md`
- [ ] Finalize `design.md`
- [ ] Finalize `witness-encoding-v0.md`
- [ ] Run `openspec validate committee-reexec-fraudproofs-v0 --strict`

## Runtime Implementation (MVP)
- [ ] Add `submit_fraud_proof` extrinsic with deterministic verification
- [ ] Add witness decode + canonical validation (`SchedulerWitnessV1`)
- [ ] Add `set_freeze_ai` / `set_rollback_target` extrinsics (governance-gated)
- [ ] Add `ensure_ai_enabled()` hook for consensus-critical paths
- [ ] Add storage: `FreezeAi`, `RollbackTarget`, `ProofsSeen`, `DisputedBlocks`
- [ ] Implement deterministic graph/order recomputation from witness
- [ ] Integrate with runtime slashing handler

## Tests (linked to invariants)
- [ ] **INV-FRAUD-001**: Valid proof slashes proposer and rewards reporter
- [ ] **INV-FRAUD-002**: Invalid proof rejected deterministically
- [ ] **INV-FRAUD-003**: Replay protection (ProofsSeen)
- [ ] **INV-FRAUD-004**: Bounds enforcement (witness size, access counts)
- [ ] **INV-FRAUD-005**: Canonical tx/access ordering enforced
- [ ] **INV-FRAUD-006**: Witness-bounded verification
- [ ] **INV-FRAUD-007**: Scheduler commitment deterministic recompute
- [ ] **INV-FRAUD-008**: Freeze preserves fraud-proof liveness

## Quality gates (before PR)
- [ ] `cargo fmt --all --check`
- [ ] `cargo clippy --all-targets --all-features -- -D warnings`
- [ ] `cargo test --workspace`
- [ ] `cargo test -p pallet-fraud-proofs`
- [ ] `openspec validate committee-reexec-fraudproofs-v0 --strict`
- [ ] All invariant links verified in registry.toml
````

---

### 2) Proper pallet config with FRAME conventions

````rust
// filepath: /home/lojak/Desktop/x3-chain-master/pallets/fraud-proofs/src/lib.rs
#![cfg_attr(not(feature = "std"), no_std)]

pub use pallet::*;

#[frame_support::pallet]
pub mod pallet {
	use codec::{Compact, Decode, Encode};
	use frame_support::{
		dispatch::DispatchResult,
		pallet_prelude::*,
		traits::Get,
		Blake2_128Concat,
	};
	use frame_system::pallet_prelude::*;
	use scale_info::TypeInfo;
	use sp_core::H256;
	use sp_runtime::traits::Saturating;
	use sp_std::{collections::btree_set::BTreeSet, vec::Vec};

	#[derive(Encode, Decode, Clone, Copy, Eq, PartialEq, RuntimeDebug, TypeInfo, MaxEncodedLen)]
	pub enum ProofType {
		SchedulerMismatchV1 = 1,
	}

	#[derive(Encode, Decode, Clone, Eq, PartialEq, RuntimeDebug, TypeInfo, MaxEncodedLen)]
	pub struct AccessKeyV1 {
		pub domain: u8,
		pub key: H256,
	}

	#[derive(Encode, Decode, Clone, Eq, PartialEq, RuntimeDebug, TypeInfo)]
	pub struct AccessListV1 {
		pub access_count: Compact<u32>,
		pub accesses: Vec<AccessKeyV1>,
	}

	#[derive(Encode, Decode, Clone, Eq, PartialEq, RuntimeDebug, TypeInfo)]
	pub struct SchedulerWitnessV1 {
		pub version: u8,
		pub rules_version: u32,
		pub tx_count: Compact<u32>,
		pub tx_ids: Vec<H256>,
		pub access_lists: Vec<AccessListV1>,
		pub reserved: Vec<u8>,
	}

	#[derive(Encode, Decode, Clone, Eq, PartialEq, RuntimeDebug, TypeInfo)]
	pub struct FraudProof<AccountId, BlockNumber> {
		pub proof_type: ProofType,
		pub block_number: BlockNumber,
		pub block_hash: H256,
		pub tx_set_commitment: H256,
		pub claimed_scheduler_commitment: H256,
		pub reexec_witness: Vec<u8>,
		pub expected_hash: H256,
		pub observed_hash: H256,
		pub reporter: AccountId,
		pub nonce: u64,
	}

	#[derive(Encode, Decode, Clone, Eq, PartialEq, RuntimeDebug, TypeInfo, MaxEncodedLen)]
	pub struct DisputedBlockMeta<AccountId, BlockNumber> {
		pub number: BlockNumber,
		pub proposer: AccountId,
		pub rules_version: u32,
	}

	pub trait SlashHandler<AccountId> {
		fn slash_proposer_and_reward_reporter(proposer: &AccountId, reporter: &AccountId) -> DispatchResult;
	}

	#[pallet::config]
	pub trait Config: frame_system::Config {
		type RuntimeEvent: From<Event<Self>> + IsType<<Self as frame_system::Config>::RuntimeEvent>;

		#[pallet::constant]
		type MaxWitnessBytes: Get<u32>;

		#[pallet::constant]
		type DisputeWindowBlocks: Get<BlockNumberFor<Self>>;

		#[pallet::constant]
		type MaxTxsPerBlock: Get<u32>;

		#[pallet::constant]
		type MaxAccessesPerTx: Get<u32>;

		type SlashHandler: SlashHandler<Self::AccountId>;

		/// Origin allowed to set freeze/rollback state.
		type FreezeOrigin: EnsureOrigin<Self::RuntimeOrigin>;
	}

	#[pallet::pallet]
	pub struct Pallet<T>(_);

	/// Replay protection: proof_id -> ()
	#[pallet::storage]
	pub type ProofsSeen<T: Config> = StorageMap<_, Blake2_128Concat, H256, (), OptionQuery>;

	/// Disputed block metadata.
	#[pallet::storage]
	pub type DisputedBlocks<T: Config> =
		StorageMap<_, Blake2_128Concat, H256, DisputedBlockMeta<T::AccountId, BlockNumberFor<T>>, OptionQuery>;

	/// Scheduler commitments observed in blocks.
	#[pallet::storage]
	pub type SchedulerCommitments<T: Config> = StorageMap<_, Blake2_128Concat, H256, H256, OptionQuery>;

	/// Global freeze flag for AI consensus-critical syscalls.
	#[pallet::storage]
	#[pallet::getter(fn freeze_ai)]
	pub type FreezeAi<T: Config> = StorageValue<_, bool, ValueQuery>;

	#[pallet::error]
	pub enum Error<T> {
		InvalidProofType,
		BlockUnknown,
		OutsideDisputeWindow,
		WitnessTooLarge,
		CommitmentMismatch,
		NotFraudulent,
		ReplayProof,
		ReporterMismatch,
		InvalidWitnessEncoding,
		ClaimedObservedMismatch,
		AiFrozen,
	}

	#[pallet::event]
	#[pallet::generate_deposit(pub(super) fn deposit_event)]
	pub enum Event<T: Config> {
		FraudProofAccepted {
			proof_id: H256,
			block_hash: H256,
			proposer: T::AccountId,
			reporter: T::AccountId,
		},
		FreezeAiSet {
			frozen: bool,
		},
	}

	#[pallet::call]
	impl<T: Config> Pallet<T> {
		/// Submit a fraud proof to dispute a scheduler commitment.
		#[pallet::call_index(0)]
		#[pallet::weight(10_000)]
		pub fn submit_fraud_proof(
			origin: OriginFor<T>,
			proof: FraudProof<T::AccountId, BlockNumberFor<T>>,
		) -> DispatchResult {
			let who = ensure_signed(origin)?;
			ensure!(who == proof.reporter, Error::<T>::ReporterMismatch);

			ensure!(
				matches!(proof.proof_type, ProofType::SchedulerMismatchV1),
				Error::<T>::InvalidProofType
			);
			ensure!(
				(proof.reexec_witness.len() as u32) <= T::MaxWitnessBytes::get(),
				Error::<T>::WitnessTooLarge
			);

			let meta = DisputedBlocks::<T>::get(proof.block_hash).ok_or(Error::<T>::BlockUnknown)?;
			let observed = SchedulerCommitments::<T>::get(proof.block_hash).ok_or(Error::<T>::BlockUnknown)?;

			// Time bound
			let now = <frame_system::Pallet<T>>::block_number();
			let age = now.saturating_sub(meta.number);
			ensure!(age <= T::DisputeWindowBlocks::get(), Error::<T>::OutsideDisputeWindow);

			// Verify claimed == observed
			ensure!(proof.claimed_scheduler_commitment == observed, Error::<T>::ClaimedObservedMismatch);
			ensure!(observed == proof.observed_hash, Error::<T>::CommitmentMismatch);

			// Recompute and check fraud
			let recomputed = Self::recompute_scheduler_commitment_v1(&proof.reexec_witness, meta.rules_version)?;
			ensure!(recomputed == proof.expected_hash, Error::<T>::CommitmentMismatch);
			ensure!(recomputed != observed, Error::<T>::NotFraudulent);

			// Replay check
			let proof_id = Self::proof_id(&proof);
			ensure!(!ProofsSeen::<T>::contains_key(proof_id), Error::<T>::ReplayProof);

			// Slash and reward
			T::SlashHandler::slash_proposer_and_reward_reporter(&meta.proposer, &proof.reporter)?;

			// Mark consumed
			ProofsSeen::<T>::insert(proof_id, ());
			Self::deposit_event(Event::FraudProofAccepted {
				proof_id,
				block_hash: proof.block_hash,
				proposer: meta.proposer,
				reporter: proof.reporter,
			});

			Ok(())
		}

		/// Freeze or unfreeze AI consensus-critical syscalls.
		#[pallet::call_index(10)]
		#[pallet::weight(10_000)]
		pub fn set_freeze_ai(origin: OriginFor<T>, frozen: bool) -> DispatchResult {
			T::FreezeOrigin::ensure_origin(origin)?;
			FreezeAi::<T>::put(frozen);
			Self::deposit_event(Event::FreezeAiSet { frozen });
			Ok(())
		}
	}

	impl<T: Config> Pallet<T> {
		/// Hook for consensus-critical AI paths. Return error if frozen.
		pub fn ensure_ai_enabled() -> Result<(), Error<T>> {
			ensure!(!FreezeAi::<T>::get(), Error::<T>::AiFrozen);
			Ok(())
		}

		pub fn recompute_scheduler_commitment_v1(
			witness_bytes: &[u8],
			expected_rules_version: u32,
		) -> Result<H256, Error<T>> {
			let w = Self::parse_witness_v1(witness_bytes)?;
			Self::validate_canonical_witness_v1(&w, expected_rules_version)?;

			let n = w.tx_ids.len();
			let mut edges: Vec<Vec<usize>> = vec![Vec::new(); n];

			for i in 0..n {
				for j in (i + 1)..n {
					if Self::has_conflict(&w.access_lists[i].accesses, &w.access_lists[j].accesses) {
						edges[i].push(j);
					}
				}
			}

			let graph_bytes = Self::encode_graph(&edges);
			let order = Self::topo_order(&edges, n)?;
			let order_bytes = Self::encode_order(&order);

			let graph_commitment = Self::h(&graph_bytes);
			let order_commitment = Self::h(&order_bytes);
			let tx_set_commitment = Self::h(&w.tx_ids.encode());

			let mut preimage = Vec::new();
			preimage.extend_from_slice(graph_commitment.as_bytes());
			preimage.extend_from_slice(order_commitment.as_bytes());
			preimage.extend_from_slice(tx_set_commitment.as_bytes());
			preimage.extend_from_slice(&w.rules_version.encode());

			Ok(Self::h(&preimage))
		}

		fn parse_witness_v1(bytes: &[u8]) -> Result<SchedulerWitnessV1, Error<T>> {
			ensure!((bytes.len() as u32) <= T::MaxWitnessBytes::get(), Error::<T>::WitnessTooLarge);
			let mut input = bytes;
			let w = SchedulerWitnessV1::decode(&mut input)
				.map_err(|_| Error::<T>::InvalidWitnessEncoding)?;
			ensure!(input.is_empty(), Error::<T>::InvalidWitnessEncoding);
			ensure!(w.version == 1, Error::<T>::InvalidWitnessEncoding);
			Ok(w)
		}

		fn validate_canonical_witness_v1(
			w: &SchedulerWitnessV1,
			expected_rules_version: u32,
		) -> Result<(), Error<T>> {
			ensure!(w.rules_version == expected_rules_version, Error::<T>::InvalidWitnessEncoding);
			let tx_count = w.tx_count.0 as usize;
			ensure!(tx_count == w.tx_ids.len(), Error::<T>::InvalidWitnessEncoding);
			ensure!(tx_count == w.access_lists.len(), Error::<T>::InvalidWitnessEncoding);
			ensure!((tx_count as u32) <= T::MaxTxsPerBlock::get(), Error::<T>::InvalidWitnessEncoding);
			ensure!(w.reserved.is_empty(), Error::<T>::InvalidWitnessEncoding);

			for i in 1..w.tx_ids.len() {
				ensure!(w.tx_ids[i - 1] < w.tx_ids[i], Error::<T>::InvalidWitnessEncoding);
			}

			for al in &w.access_lists {
				let c = al.access_count.0 as usize;
				ensure!(c == al.accesses.len(), Error::<T>::InvalidWitnessEncoding);
				ensure!((c as u32) <= T::MaxAccessesPerTx::get(), Error::<T>::InvalidWitnessEncoding);
				for i in 1..al.accesses.len() {
					ensure!(al.accesses[i - 1] < al.accesses[i], Error::<T>::InvalidWitnessEncoding);
				}
			}
			Ok(())
		}

		fn has_conflict(a: &[AccessKeyV1], b: &[AccessKeyV1]) -> bool {
			let (mut i, mut j) = (0usize, 0usize);
			while i < a.len() && j < b.len() {
				if a[i] == b[j] {
					return true;
				}
				if a[i] < b[j] {
					i += 1;
				} else {
					j += 1;
				}
			}
			false
		}

		fn topo_order(edges: &[Vec<usize>], n: usize) -> Result<Vec<usize>, Error<T>> {
			let mut indeg = vec![0u32; n];
			for outs in edges {
				for &j in outs {
					indeg[j] = indeg[j].saturating_add(1);
				}
			}
			let mut ready = BTreeSet::new();
			for (i, &d) in indeg.iter().enumerate() {
				if d == 0 {
					ready.insert(i);
				}
			}
			let mut out = Vec::with_capacity(n);
			while let Some(&i) = ready.iter().next() {
				ready.remove(&i);
				out.push(i);
				for &j in &edges[i] {
					indeg[j] -= 1;
					if indeg[j] == 0 {
						ready.insert(j);
					}
				}
			}
			ensure!(out.len() == n, Error::<T>::InvalidWitnessEncoding);
			Ok(out)
		}

		fn encode_graph(edges: &[Vec<usize>]) -> Vec<u8> {
			let mut bytes = Compact(edges.len() as u32).encode();
			for outs in edges {
				bytes.extend(Compact(outs.len() as u32).encode());
				for &j in outs {
					bytes.extend(Compact(j as u32).encode());
				}
			}
			bytes
		}

		fn encode_order(order: &[usize]) -> Vec<u8> {
			let mut bytes = Compact(order.len() as u32).encode();
			for &i in order {
				bytes.extend(Compact(i as u32).encode());
			}
			bytes
		}

		fn h(data: &[u8]) -> H256 {
			H256::from(sp_io::hashing::blake2_256(data))
		}

		fn proof_id(proof: &FraudProof<T::AccountId, BlockNumberFor<T>>) -> H256 {
			H256::from(sp_io::hashing::blake2_256(&proof.encode()))
		}
	}
}
````

---

### 3) Tests with proper invariant references

````rust
// filepath: /home/lojak/Desktop/x3-chain-master/pallets/fraud-proofs/src/tests.rs
#[cfg(test)]
mod tests {
	use super::*;
	use crate::mock::*;
	use crate::pallet::{DisputedBlockMeta, Error, FraudProof, ProofType};
	use codec::Encode;
	use frame_support::{assert_noop, assert_ok};
	use sp_core::H256;

	fn mk_hash(b: u8) -> H256 {
		H256::from([b; 32])
	}

	fn witness_bytes(
		tx_ids: Vec<H256>,
		access_lists: Vec<Vec<(u8, H256)>>,
		rules_version: u32,
	) -> Vec<u8> {
		let al = access_lists
			.into_iter()
			.map(|v| {
				let mut sorted = v;
				sorted.sort_by(|a, b| (a.0, a.1).cmp(&(b.0, b.1)));
				AccessListV1 {
					access_count: Compact(sorted.len() as u32),
					accesses: sorted
						.into_iter()
						.map(|(d, k)| AccessKeyV1 { domain: d, key: k })
						.collect(),
				}
			})
			.collect::<Vec<_>>();

		SchedulerWitnessV1 {
			version: 1,
			rules_version,
			tx_count: Compact(tx_ids.len() as u32),
			tx_ids,
			access_lists: al,
			reserved: vec![],
		}
		.encode()
	}

	#[test]
	fn valid_scheduler_mismatch_slashes_proposer() {
		// INV-FRAUD-001
		new_test_ext().execute_with(|| {
			let block_hash = mk_hash(1);
			let witness = witness_bytes(
				vec![mk_hash(1), mk_hash(2)],
				vec![vec![(0, mk_hash(9))], vec![(0, mk_hash(9))]],
				1,
			);

			let expected = FraudProofs::recompute_scheduler_commitment_v1(&witness, 1).unwrap();
			let observed = mk_hash(99);

			DisputedBlocks::<Test>::insert(
				block_hash,
				DisputedBlockMeta { number: 1, proposer: 42, rules_version: 1 },
			);
			SchedulerCommitments::<Test>::insert(block_hash, observed);

			let proof = FraudProof {
				proof_type: ProofType::SchedulerMismatchV1,
				block_number: 1,
				block_hash,
				tx_set_commitment: mk_hash(2),
				claimed_scheduler_commitment: observed,
				reexec_witness: witness,
				expected_hash: expected,
				observed_hash: observed,
				reporter: 7,
				nonce: 0,
			};

			assert_ok!(FraudProofs::submit_fraud_proof(RuntimeOrigin::signed(7), proof));
			SLASH_CALLS.with(|c| assert_eq!(c.borrow().as_slice(), &[(42, 7)]));
		});
	}

	#[test]
	fn invalid_proof_rejected() {
		// INV-FRAUD-002
		new_test_ext().execute_with(|| {
			let block_hash = mk_hash(3);
			let witness = witness_bytes(vec![mk_hash(1)], vec![vec![(0, mk_hash(2))]], 1);

			DisputedBlocks::<Test>::insert(
				block_hash,
				DisputedBlockMeta { number: 1, proposer: 10, rules_version: 1 },
			);
			SchedulerCommitments::<Test>::insert(block_hash, mk_hash(4));

			let proof = FraudProof {
				proof_type: ProofType::SchedulerMismatchV1,
				block_number: 1,
				block_hash,
				tx_set_commitment: mk_hash(5),
				claimed_scheduler_commitment: mk_hash(4),
				reexec_witness: witness,
				expected_hash: mk_hash(8),
				observed_hash: mk_hash(4),
				reporter: 8,
				nonce: 1,
			};

			assert_noop!(
				FraudProofs::submit_fraud_proof(RuntimeOrigin::signed(8), proof),
				Error::<Test>::NotFraudulent
			);

			SLASH_CALLS.with(|c| assert!(c.borrow().is_empty()));
		});
	}

	#[test]
	fn replay_proof_rejected() {
		// INV-FRAUD-003
		new_test_ext().execute_with(|| {
			let block_hash = mk_hash(6);
			let witness =
				witness_bytes(vec![mk_hash(1), mk_hash(2)], vec![vec![(0, mk_hash(9))], vec![(0, mk_hash(9))]],1);

			let expected = FraudProofs::recompute_scheduler_commitment_v1(&witness, 1).unwrap();
			let observed = mk_hash(10);

			DisputedBlocks::<Test>::insert(
				block_hash,
				DisputedBlockMeta { number: 1, proposer: 2, rules_version: 1 },
			);
			SchedulerCommitments::<Test>::insert(block_hash, observed);

			let proof = FraudProof {
				proof_type: ProofType::SchedulerMismatchV1,
				block_number: 1,
				block_hash,
				tx_set_commitment: mk_hash(11),
				claimed_scheduler_commitment: observed,
				reexec_witness: witness,
				expected_hash: expected,
				observed_hash: observed,
				reporter: 3,
				nonce: 7,
			};

			assert_ok!(FraudProofs::submit_fraud_proof(RuntimeOrigin::signed(3), proof.clone()));
			assert_noop!(
				FraudProofs::submit_fraud_proof(RuntimeOrigin::signed(3), proof),
				Error::<Test>::ReplayProof
			);
		});
	}

	#[test]
	fn outside_dispute_window_rejected() {
		// INV-FRAUD-004
		new_test_ext().execute_with(|| {
			let block_hash = mk_hash(12);
			let witness = witness_bytes(
				vec![mk_hash(1), mk_hash(2)],
				vec![vec![(0, mk_hash(9))], vec![(0, mk_hash(9))]],
				1,
			);
			let expected = FraudProofs::recompute_scheduler_commitment_v1(&witness, 1).unwrap();
			let observed = mk_hash(13);

			DisputedBlocks::<Test>::insert(
				block_hash,
				DisputedBlockMeta { number: 1, proposer: 55, rules_version: 1 },
			);
			SchedulerCommitments::<Test>::insert(block_hash, observed);
			System::set_block_number(300);

			let proof = FraudProof {
				proof_type: ProofType::SchedulerMismatchV1,
				block_number: 1,
				block_hash,
				tx_set_commitment: mk_hash(14),
				claimed_scheduler_commitment: observed,
				reexec_witness: witness,
				expected_hash: expected,
				observed_hash: observed,
				reporter: 66,
				nonce: 0,
			};

			assert_noop!(
				FraudProofs::submit_fraud_proof(RuntimeOrigin::signed(66), proof),
				Error::<Test>::OutsideDisputeWindow
			);
		});
	}

	#[test]
	fn witness_too_large_rejected() {
		// INV-FRAUD-004, INV-FRAUD-006
		new_test_ext().execute_with(|| {
			let block_hash = mk_hash(15);

			DisputedBlocks::<Test>::insert(
				block_hash,
				DisputedBlockMeta { number: 1, proposer: 1, rules_version: 1 },
			);
			SchedulerCommitments::<Test>::insert(block_hash, mk_hash(16));

			let proof = FraudProof {
				proof_type: ProofType::SchedulerMismatchV1,
				block_number: 1,
				block_hash,
				tx_set_commitment: mk_hash(17),
				claimed_scheduler_commitment: mk_hash(16),
				reexec_witness: vec![0u8; 2048],
				expected_hash: mk_hash(18),
				observed_hash: mk_hash(16),
				reporter: 9,
				nonce: 0,
			};

			assert_noop!(
				FraudProofs::submit_fraud_proof(RuntimeOrigin::signed(9), proof),
				Error::<Test>::WitnessTooLarge
			);
		});
	}

	#[test]
	fn rejects_noncanonical_tx_ids() {
		// INV-FRAUD-005
		new_test_ext().execute_with(|| {
			let bad = witness_bytes(vec![mk_hash(2), mk_hash(1)], vec![vec![], vec![]], 1);
			let r = FraudProofs::recompute_scheduler_commitment_v1(&bad, 1);
			assert!(matches!(r, Err(Error::<Test>::InvalidWitnessEncoding)));
		});
	}

	#[test]
	fn deterministic_recompute_same_witness() {
		// INV-FRAUD-007
		new_test_ext().execute_with(|| {
			let w = witness_bytes(
				vec![mk_hash(1), mk_hash(2), mk_hash(3)],
				vec![vec![(0, mk_hash(10))], vec![(0, mk_hash(11))], vec![(0, mk_hash(10))]],
				1,
			);

			let a = FraudProofs::recompute_scheduler_commitment_v1(&w, 1).unwrap();
			let b = FraudProofs::recompute_scheduler_commitment_v1(&w, 1).unwrap();
			assert_eq!(a, b);
		});
	}

	#[test]
	fn freeze_ai_toggle() {
		new_test_ext().execute_with(|| {
			assert!(!FraudProofs::freeze_ai());
			assert_ok!(FraudProofs::set_freeze_ai(RuntimeOrigin::root(), true));
			assert!(FraudProofs::freeze_ai());
			assert_ok!(FraudProofs::set_freeze_ai(RuntimeOrigin::root(), false));
			assert!(!FraudProofs::freeze_ai());
		});
	}

	#[test]
	fn freeze_does_not_disable_fraud_proof_path() {
		// INV-FRAUD-008
		new_test_ext().execute_with(|| {
			assert_ok!(FraudProofs::set_freeze_ai(RuntimeOrigin::root(), true));

			let block_hash = mk_hash(1);
			let witness = witness_bytes(
				vec![mk_hash(1), mk_hash(2)],
				vec![vec![(0, mk_hash(9))], vec![(0, mk_hash(9))]],
				1,
			);

			let expected = FraudProofs::recompute_scheduler_commitment_v1(&witness, 1).unwrap();
			let observed = mk_hash(200);

			DisputedBlocks::<Test>::insert(
				block_hash,
				DisputedBlockMeta { number: 1, proposer: 42, rules_version: 1 },
			);
			SchedulerCommitments::<Test>::insert(block_hash, observed);

			let proof = FraudProof {
				proof_type: ProofType::SchedulerMismatchV1,
				block_number: 1,
				block_hash,
				tx_set_commitment: mk_hash(2),
				claimed_scheduler_commitment: observed,
				reexec_witness: witness,
				expected_hash: expected,
				observed_hash: observed,
				reporter: 7,
				nonce: 0,
			};

			assert_ok!(FraudProofs::submit_fraud_proof(RuntimeOrigin::signed(7), proof));
		});
	}
}
````

---

### 4) Mock config

````rust
// filepath: /home/lojak/Desktop/x3-chain-master/pallets/fraud-proofs/src/mock.rs
use crate as pallet_fraud_proofs;
use frame_support::{construct_runtime, parameter_types};
use sp_core::H256;
use sp_runtime::{traits::IdentityLookup, BuildStorage};
use std::cell::RefCell;

type Block = frame_system::mocking::MockBlock<Test>;

thread_local! {
	pub static SLASH_CALLS: RefCell<Vec<(u64, u64)>> = RefCell::new(Vec::new());
}

pub struct MockSlashHandler;
impl pallet_fraud_proofs::pallet::SlashHandler<u64> for MockSlashHandler {
	fn slash_proposer_and_reward_reporter(
		proposer: &u64,
		reporter: &u64,
	) -> frame_support::dispatch::DispatchResult {
		SLASH_CALLS.with(|c| c.borrow_mut().push((*proposer, *reporter)));
		Ok(())
	}
}

construct_runtime!(
	pub enum Test {
		System: frame_system,
		FraudProofs: pallet_fraud_proofs,
	}
);

parameter_types! {
	pub const BlockHashCount: u64 = 250;
	pub const MaxWitnessBytes: u32 = 65536;
	pub const DisputeWindowBlocks: u64 = 256;
	pub const MaxTxsPerBlock: u32 = 1024;
	pub const MaxAccessesPerTx: u32 = 256;
}

impl frame_system::Config for Test {
	type BaseCallFilter = frame_support::traits::Everything;
	type BlockWeights = ();
	type BlockLength = ();
	type RuntimeDbWeight = ();
	type RuntimeOrigin = RuntimeOrigin;
	type RuntimeCall = RuntimeCall;
	type RuntimeEvent = RuntimeEvent;
	type RuntimeTask = ();
	type Nonce = u64;
	type Hash = H256;
	type Hashing = sp_runtime::traits::BlakeTwo256;
	type AccountId = u64;
	type Lookup = IdentityLookup<Self::AccountId>;
	type Block = Block;
	type BlockHashCount = BlockHashCount;
	type Version = ();
	type PalletInfo = PalletInfo;
	type AccountData = ();
	type OnNewAccount = ();
	type OnKilledAccount = ();
	type SystemWeightInfo = ();
	type SS58Prefix = ();
	type OnSetCode = ();
	type MaxConsumers = frame_support::traits::ConstU32<16>;
	type SingleBlockMigrations = ();
	type MultiBlockMigrator = ();
	type PreInherents = ();
	type Post
```

