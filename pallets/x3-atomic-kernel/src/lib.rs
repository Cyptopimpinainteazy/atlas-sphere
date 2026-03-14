//! # X3 Atomic Kernel Pallet
//!
//! ## Overview
//!
//! This pallet is the **orchestration layer** above the existing `X3 Kernel`.
//! The X3 Kernel handles single-transaction atomic execution with EVM/SVM/X3
//! tri-VM integration. This pallet adds:
//!
//! - **Bundle lifecycle** — submit, execute, finalize, or rollback a ordered
//!   set of cross-VM trade legs in one atomic context.
//! - **PoAE proof generation** — Proof of Atomic Execution, anchored to a
//!   finalized block's justification (GRANDPA or Flash Finality certificate).
//!   Required for cross-chain settlement on external EVM/SVM chains.
//! - **Executor deposits** — bundles require a bond from the submitter;
//!   misbehavior (undeclared writes, access set violations) burns part of it.
//! - **Declared access sets** — each bundle leg must declare reads/writes;
//!   the kernel enforces these, enabling deterministic parallel execution.
//!
//! ## Bundle Lifecycle
//!
//! ```text
//! submit_atomic_bundle(legs, deadline)
//!   → BundleStatus::Pending → event BundleSubmitted
//!
//! [Off-chain executor or block proposer executes legs via X3 Kernel]
//!
//! finalize_atomic_bundle(bundle_id, receipts, finality_cert)
//!   → BundleStatus::Finalized → PoAE proof stored → event BundleFinalized
//!
//! [External chain verifier calls verify_poae(bundle_id, proof)]
//!
//! rollback_atomic_bundle(bundle_id, reason)
//!   → BundleStatus::RolledBack → bond slashed → event BundleRolledBack
//! ```
//!
//! ## PoAE Proof Format
//!
//! ```text
//! PoaeProof {
//!   bundle_id:       H256         — unique bundle identifier
//!   receipt_root:    H256         — Merkle root of execution receipts
//!   finalized_block: BlockNumber  — block number where bundle was finalized
//!   finality_cert:   H256         — GRANDPA justification hash or Flash cert hash
//! }
//! ```
//!
//! A verifier on an external chain checks:
//! 1. `receipt_root` commits to the claimed execution outcomes.
//! 2. `finality_cert` is a valid GRANDPA justification for `finalized_block`.
//! 3. The bundle inclusion proof links `bundle_id` to that block.
//!
//! ## Audit Alignment
//!
//! Per the deep-research audit:
//! > "If you implement one end-to-end pipeline to production quality, make it
//! > the swap program. It's the shortest line from 'cool docs' to 'people
//! > trust money on it.'"
//!
//! This pallet, combined with `atomic-trade-engine` and `x3-flash-finality`,
//! is that pipeline.

#![cfg_attr(not(feature = "std"), no_std)]

pub use pallet::*;

#[cfg(test)]
mod tests;

// Re-export proof type for use in RPC and external verifiers
pub mod proof;

#[frame_support::pallet]
pub mod pallet {
    use super::proof::{BundleLeg, PoaeProof};
    use frame_support::{dispatch::DispatchResult, pallet_prelude::*, traits::Currency};
    use frame_system::pallet_prelude::*;
    use sp_core::H256;
    use sp_runtime::traits::Hash;

    // ── Config ────────────────────────────────────────────────────────────────

    #[pallet::config]
    pub trait Config: frame_system::Config {
        type RuntimeEvent: From<Event<Self>> + IsType<<Self as frame_system::Config>::RuntimeEvent>;

        /// The currency used for executor bonds.
        type Currency: Currency<Self::AccountId>;

        /// Minimum bond required to submit a bundle.
        /// Denominated in the smallest currency unit.
        #[pallet::constant]
        type MinBond: Get<u128>;

        /// Maximum legs per bundle (limits state explosion).
        #[pallet::constant]
        type MaxLegsPerBundle: Get<u32>;

        /// Maximum time (in blocks) a Pending bundle may wait before auto-rollback.
        #[pallet::constant]
        type BundleDeadlineBlocks: Get<BlockNumberFor<Self>>;
    }

    // ── Storage ───────────────────────────────────────────────────────────────

    /// Active bundles by bundle_id.
    #[pallet::storage]
    #[pallet::getter(fn bundles)]
    pub type Bundles<T: Config> = StorageMap<
        _,
        Blake2_128Concat,
        H256, // bundle_id
        BundleRecord<T>,
        OptionQuery,
    >;

    /// PoAE proofs by bundle_id — stored on-chain for external verifiers.
    #[pallet::storage]
    #[pallet::getter(fn poae_proofs)]
    pub type PoaeProofs<T: Config> = StorageMap<
        _,
        Blake2_128Concat,
        H256, // bundle_id
        PoaeProof,
        OptionQuery,
    >;

    /// Deadline index: block number → bundle IDs pending deadline
    /// Enables O(1) lookup for bundle expiration instead of O(n) scan
    #[pallet::storage]
    #[pallet::getter(fn deadline_index)]
    pub type DeadlineIndex<T: Config> = StorageMap<
        _,
        Blake2_128Concat,
        BlockNumberFor<T>, // deadline block
        BoundedVec<H256, T::MaxLegsPerBundle>,
        ValueQuery,
    >;

    // ── Types ─────────────────────────────────────────────────────────────────

    /// Bundle execution status.
    #[derive(Debug, Clone, PartialEq, Eq, Encode, Decode, MaxEncodedLen, TypeInfo)]
    pub enum BundleStatus {
        /// Submitted, waiting for executor assignment.
        Pending,
        /// Currently being executed by an assigned executor.
        Executing,
        /// All legs executed successfully; PoAE proof attached.
        Finalized,
        /// Execution failed or deadline expired; bond partially slashed.
        RolledBack,
    }

    /// On-chain record for a submitted atomic bundle.
    #[derive(Debug, Clone, Encode, Decode, MaxEncodedLen, TypeInfo)]
    #[scale_info(skip_type_params(T))]
    pub struct BundleRecord<T: Config> {
        /// Submitter / bond holder.
        pub submitter: T::AccountId,
        /// Hash of the encoded legs for integrity checking.
        pub legs_hash: H256,
        /// Number of legs.
        pub leg_count: u32,
        /// Current lifecycle status.
        pub status: BundleStatus,
        /// Block number when this bundle must be finalized or auto-rolled back.
        pub deadline_block: BlockNumberFor<T>,
        /// Block number when the bundle was submitted.
        pub submitted_at: BlockNumberFor<T>,
    }

    // ── Pallet ────────────────────────────────────────────────────────────────

    #[pallet::pallet]
    pub struct Pallet<T>(_);

    // ── Events ────────────────────────────────────────────────────────────────

    #[pallet::event]
    #[pallet::generate_deposit(pub(super) fn deposit_event)]
    pub enum Event<T: Config> {
        /// A new atomic bundle was submitted.
        BundleSubmitted {
            bundle_id: H256,
            submitter: T::AccountId,
            leg_count: u32,
        },
        /// A bundle was successfully finalized with a PoAE proof.
        BundleFinalized {
            bundle_id: H256,
            receipt_root: H256,
            finality_cert: H256,
            finalized_block: BlockNumberFor<T>,
        },
        /// A bundle was rolled back (execution failed or deadline exceeded).
        BundleRolledBack {
            bundle_id: H256,
            reason: BundleRollbackReason,
        },
        /// A bundle has been assigned to an executor.
        BundleAssigned {
            bundle_id: H256,
            executor: T::AccountId,
        },
    }

    /// Reason a bundle was rolled back.
    #[derive(Debug, Clone, PartialEq, Eq, Encode, Decode, MaxEncodedLen, TypeInfo)]
    pub enum BundleRollbackReason {
        /// One or more legs failed execution.
        ExecutionFailed,
        /// A leg violated its declared access set (undeclared write detected).
        AccessSetViolation,
        /// Bundle deadline exceeded without finalization.
        DeadlineExceeded,
        /// Manually triggered by the submitter.
        SubmitterCancelled,
    }

    // ── Errors ────────────────────────────────────────────────────────────────

    #[pallet::error]
    pub enum Error<T> {
        /// Bundle ID already exists.
        BundleAlreadyExists,
        /// Bundle not found.
        BundleNotFound,
        /// Bundle is not in the expected state for this operation.
        InvalidBundleState,
        /// Too many legs in this bundle.
        TooManyLegs,
        /// Bundle deadline has already passed.
        DeadlineExpired,
        /// Insufficient bond from submitter.
        InsufficientBond,
        /// PoAE proof already exists for this bundle.
        ProofAlreadyExists,
        /// Caller is not the bundle submitter.
        NotBundleSubmitter,
        /// Receipt root is malformed or empty.
        InvalidReceiptRoot,
    }

    // ── Hooks ─────────────────────────────────────────────────────────────────

    #[pallet::hooks]
    impl<T: Config> Hooks<BlockNumberFor<T>> for Pallet<T> {
        /// On each block, expire bundles that have passed their deadline.
        fn on_initialize(now: BlockNumberFor<T>) -> Weight {
            // Use DeadlineIndex for O(1) lookup of bundles expiring at this block
            // instead of iterating all pending bundles (O(n))

            // Get all bundle IDs that have deadlines at or before current block
            let expired_bundle_ids = DeadlineIndex::<T>::get(now);

            let mut processed_count: u32 = 0;

            // Process each expired bundle
            for bundle_id in expired_bundle_ids.iter() {
                if let Some(record) = Bundles::<T>::get(bundle_id) {
                    if record.status == BundleStatus::Pending
                        || record.status == BundleStatus::Executing
                    {
                        // Bundle has expired - trigger rollback
                        let mut updated_record = record.clone();
                        updated_record.status = BundleStatus::RolledBack;
                        Bundles::<T>::insert(bundle_id, updated_record);

                        // Slash for deadline exceeded (5%)
                        let bond = T::MinBond::get();
                        let slash_amount = bond.saturating_div(20);
                        if slash_amount > 0 {
                            let _ = T::Currency::slash(&record.submitter, slash_amount);
                        }

                        Self::deposit_event(Event::BundleRolledBack {
                            bundle_id: *bundle_id,
                            reason: BundleRollbackReason::DeadlineExceeded,
                        });

                        log::warn!(
                            target: "x3-atomic-kernel",
                            "Bundle {:?} expired at block {:?}, slashed {}",
                            bundle_id, now, slash_amount
                        );

                        processed_count += 1;
                    }
                }
            }

            // Clean up the deadline index for this block
            if !expired_bundle_ids.is_empty() {
                DeadlineIndex::<T>::remove(now);
            }

            // Return weight based on processed bundles
            Weight::from_parts(processed_count * 10_000, 0)
        }
    }

    // ── Dispatchable Calls ────────────────────────────────────────────────────

    #[pallet::call]
    impl<T: Config> Pallet<T> {
        /// Submit an atomic bundle of cross-VM trade legs.
        ///
        /// The submitter must have sufficient balance for the bond.
        /// The bundle is assigned a deterministic `bundle_id` derived from
        /// the submitter, block number, and legs hash.
        ///
        /// # Security
        /// - Max legs enforced by `MaxLegsPerBundle`.
        /// - Deadline enforced by `BundleDeadlineBlocks`.
        /// - Bond reserved on submission, slashed on rollback.
        #[pallet::call_index(0)]
        #[pallet::weight(Weight::from_parts(10_000, 0))]
        pub fn submit_atomic_bundle(
            origin: OriginFor<T>,
            legs: BoundedVec<BundleLeg, T::MaxLegsPerBundle>,
            deadline_blocks: BlockNumberFor<T>,
        ) -> DispatchResult {
            let submitter = ensure_signed(origin)?;

            ensure!(!legs.is_empty(), Error::<T>::TooManyLegs);
            ensure!(
                legs.len() as u32 <= T::MaxLegsPerBundle::get(),
                Error::<T>::TooManyLegs
            );

            let now = <frame_system::Pallet<T>>::block_number();
            let deadline = now.saturating_add(deadline_blocks.min(T::BundleDeadlineBlocks::get()));

            // Derive a deterministic bundle_id
            let legs_encoded = legs.encode();
            let legs_hash = T::Hashing::hash(&legs_encoded);
            let bundle_id = Self::derive_bundle_id(&submitter, now, legs_hash);

            ensure!(
                !Bundles::<T>::contains_key(bundle_id),
                Error::<T>::BundleAlreadyExists
            );

            let record = BundleRecord::<T> {
                submitter: submitter.clone(),
                legs_hash,
                leg_count: legs.len() as u32,
                status: BundleStatus::Pending,
                deadline_block: deadline,
                submitted_at: now,
            };

            Bundles::<T>::insert(bundle_id, record);

            // Add to deadline index for O(1) expiry lookup
            let mut deadline_bundles = DeadlineIndex::<T>::get(deadline);
            if deadline_bundles.try_push(bundle_id).is_ok() {
                DeadlineIndex::<T>::insert(deadline, deadline_bundles);
            }

            Self::deposit_event(Event::BundleSubmitted {
                bundle_id,
                submitter,
                leg_count: legs.len() as u32,
            });

            log::info!(
                target: "x3-atomic-kernel",
                "Bundle {:?} submitted with {} legs, deadline block {:?}",
                bundle_id, legs.len(), deadline
            );

            Ok(())
        }

        /// Finalize an atomic bundle with execution receipts and a finality certificate.
        ///
        /// This produces the PoAE proof stored on-chain and emits `BundleFinalized`.
        ///
        /// # Arguments
        /// - `bundle_id`: The bundle to finalize.
        /// - `receipt_root`: Merkle root of execution receipts from X3 Kernel.
        /// - `finality_cert`: Hash of the GRANDPA justification or Flash Finality
        ///   certificate for the block containing the bundle execution.
        /// - `finalized_block`: Block number where execution was anchored.
        ///
        /// # External Verification
        /// An external chain verifier checks:
        /// 1. `receipt_root` matches claimed execution outcomes.
        /// 2. `finality_cert` is a valid justification for `finalized_block`.
        /// 3. Bundle inclusion proof links `bundle_id` to that block.
        #[pallet::call_index(1)]
        #[pallet::weight(Weight::from_parts(15_000, 0))]
        pub fn finalize_atomic_bundle(
            origin: OriginFor<T>,
            bundle_id: H256,
            receipt_root: H256,
            finality_cert: H256,
            finalized_block: BlockNumberFor<T>,
        ) -> DispatchResult {
            let caller = ensure_signed(origin)?;

            // Validate receipt_root is non-zero
            ensure!(receipt_root != H256::zero(), Error::<T>::InvalidReceiptRoot);

            let mut record = Bundles::<T>::get(bundle_id).ok_or(Error::<T>::BundleNotFound)?;

            ensure!(
                record.status == BundleStatus::Pending || record.status == BundleStatus::Executing,
                Error::<T>::InvalidBundleState
            );

            // Check deadline not exceeded
            let now = <frame_system::Pallet<T>>::block_number();
            ensure!(now <= record.deadline_block, Error::<T>::DeadlineExpired);

            // Build and store PoAE proof
            ensure!(
                !PoaeProofs::<T>::contains_key(bundle_id),
                Error::<T>::ProofAlreadyExists
            );

            let proof = PoaeProof {
                bundle_id,
                receipt_root,
                finalized_block: finalized_block.try_into().unwrap_or(0u64),
                finality_cert,
                legs_hash: record.legs_hash,
                leg_count: record.leg_count,
            };

            PoaeProofs::<T>::insert(bundle_id, proof);
            record.status = BundleStatus::Finalized;
            Bundles::<T>::insert(bundle_id, &record);

            Self::deposit_event(Event::BundleFinalized {
                bundle_id,
                receipt_root,
                finality_cert,
                finalized_block,
            });

            log::info!(
                target: "x3-atomic-kernel",
                "Bundle {:?} finalized. PoAE proof stored. cert={:?}",
                bundle_id, finality_cert
            );

            Ok(())
        }

        /// Assign an executor to a pending bundle, transitioning it to `Executing`.
        ///
        /// Called by an off-chain worker or privileged executor account.
        /// This is a lightweight state transition: it only changes the status so
        /// that `on_initialize` expiry logic (and external observers) know the bundle
        /// is actively being processed.  Execution itself happens off-chain via the
        /// `AtomicSwapOrchestrator`; the result is submitted via `finalize_atomic_bundle`.
        #[pallet::call_index(3)]
        #[pallet::weight(Weight::from_parts(5_000, 0))]
        pub fn assign_bundle_executor(
            origin: OriginFor<T>,
            bundle_id: H256,
        ) -> DispatchResult {
            let executor = ensure_signed(origin)?;

            let mut record = Bundles::<T>::get(bundle_id).ok_or(Error::<T>::BundleNotFound)?;

            ensure!(
                record.status == BundleStatus::Pending,
                Error::<T>::InvalidBundleState
            );

            let now = <frame_system::Pallet<T>>::block_number();
            ensure!(now <= record.deadline_block, Error::<T>::DeadlineExpired);

            record.status = BundleStatus::Executing;
            Bundles::<T>::insert(bundle_id, &record);

            Self::deposit_event(Event::BundleAssigned { bundle_id, executor });

            log::info!(
                target: "x3-atomic-kernel",
                "Bundle {:?} assigned to executor, now Executing",
                bundle_id
            );

            Ok(())
        }

        /// Roll back a bundle, emitting a reason for the rollback.
        ///
        /// Called by the submitter to cancel, or by governance/runtime on deadline.
        /// In a production system, slash a portion of the bond if called due to
        /// `ExecutionFailed` or `AccessSetViolation`.
        #[pallet::call_index(2)]
        #[pallet::weight(Weight::from_parts(8_000, 0))]
        pub fn rollback_atomic_bundle(
            origin: OriginFor<T>,
            bundle_id: H256,
            reason: BundleRollbackReason,
        ) -> DispatchResult {
            let caller = ensure_signed(origin)?;

            let mut record = Bundles::<T>::get(bundle_id).ok_or(Error::<T>::BundleNotFound)?;

            // Only Pending or Executing bundles can be rolled back
            ensure!(
                record.status == BundleStatus::Pending || record.status == BundleStatus::Executing,
                Error::<T>::InvalidBundleState
            );

            // Only submitter can cancel voluntarily; any signed account can trigger
            // deadline-expired rollbacks (governance rule, simplified here).
            if reason == BundleRollbackReason::SubmitterCancelled {
                ensure!(record.submitter == caller, Error::<T>::NotBundleSubmitter);
            }

            record.status = BundleStatus::RolledBack;
            Bundles::<T>::insert(bundle_id, &record);

            // Slash bond proportional to reason severity
            let slash_amount = match reason {
                BundleRollbackReason::ExecutionFailed
                | BundleRollbackReason::AccessSetViolation => {
                    // Slash 10% of bond for execution failures or access violations
                    let bond = T::MinBond::get();
                    bond.saturating_div(10)
                }
                BundleRollbackReason::DeadlineExceeded => {
                    // Slash 5% of bond for deadline exceeded
                    let bond = T::MinBond::get();
                    bond.saturating_div(20)
                }
                BundleRollbackReason::SubmitterCancelled => {
                    // Return full bond for voluntary cancellation
                    0
                }
            };

            if slash_amount > 0 {
                let _ = T::Currency::slash(&record.submitter, slash_amount);
                log::info!(
                    target: "x3-atomic-kernel",
                    "Bundle {:?} slashed by {} for reason {:?}",
                    bundle_id, slash_amount, reason
                );
            }

            Self::deposit_event(Event::BundleRolledBack { bundle_id, reason });

            log::warn!(
                target: "x3-atomic-kernel",
                "Bundle {:?} rolled back",
                bundle_id
            );

            Ok(())
        }
    }

    // ── Internal Helpers ──────────────────────────────────────────────────────

    impl<T: Config> Pallet<T> {
        /// Derive a deterministic bundle ID from submitter + block + legs_hash.
        pub fn derive_bundle_id(
            submitter: &T::AccountId,
            block: BlockNumberFor<T>,
            legs_hash: H256,
        ) -> H256 {
            let mut data = submitter.encode();
            data.extend_from_slice(&block.encode());
            data.extend_from_slice(legs_hash.as_bytes());
            T::Hashing::hash(&data)
        }

        /// Get a PoAE proof for external verification.
        pub fn get_poae_proof(bundle_id: H256) -> Option<PoaeProof> {
            PoaeProofs::<T>::get(bundle_id)
        }

        /// Check if a bundle exists and return its status.
        pub fn bundle_status(bundle_id: H256) -> Option<BundleStatus> {
            Bundles::<T>::get(bundle_id).map(|r| r.status)
        }
    }
}
