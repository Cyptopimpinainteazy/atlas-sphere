//! # X3 Slashing Pallet
//!
//! This pallet wraps the x3-slash engine and integrates it with Substrate's pallet_staking.
//! It provides on-chain enforcement of slashing rules and automatic punishment for protocol violations.
//!
//! ## Architecture
//!
//! - **SlashingEngine**: Core library logic for bonds, slashing events, and records
//! - **Pallet**: Substrate integration layer (storage, extrinsics, events, hooks)
//! - **Integration Points**:
//!   - `pallet_staking`: Validator stake deduction on slash
//!   - Settlement pallet: Triggers slashing on executor failure
//!   - Bridge pallet: Triggers slashing on SPV/proof failures
//!
//! ## Invariants
//!
//! 1. Every agent executing must post a bond first
//! 2. Bonds automatically expire after finality window
//! 3. Failed execution → automatic slash (deterministic, no voting)
//! 4. All slash events are permanent and immutable
//! 5. Reputation damage persists across epochs

#![cfg_attr(not(feature = "std"), no_std)]

pub mod types;
pub mod weights;

#[cfg(test)]
mod mock;
#[cfg(test)]
mod tests;

#[cfg(feature = "runtime-benchmarks")]
mod benchmarking;

pub use pallet::*;
pub use types::*;
pub use weights::WeightInfo;

use frame_support::{
    pallet_prelude::*,
    traits::{Currency, ReservableCurrency},
};
use frame_system::pallet_prelude::*;
use sp_core::H256;
use sp_runtime::traits::Hash;
use sp_std::vec::Vec;
use x3_slash::types::{SlashReason, SlashSeverity};

type BalanceOf<T> =
    <<T as Config>::Currency as Currency<<T as frame_system::Config>::AccountId>>::Balance;

#[frame_support::pallet]
pub mod pallet {
    use super::*;

    const STORAGE_VERSION: StorageVersion = StorageVersion::new(1);

    #[pallet::pallet]
    #[pallet::storage_version(STORAGE_VERSION)]
    pub struct Pallet<T>(_);

    #[pallet::config]
    pub trait Config: frame_system::Config {
        /// The overarching event type.
        type RuntimeEvent: From<Event<Self>> + IsType<<Self as frame_system::Config>::RuntimeEvent>;

        /// Weight information for extrinsics.
        type SlashWeightInfo: crate::weights::WeightInfo;

        /// Currency for bond escrow.
        type Currency: Currency<Self::AccountId> + ReservableCurrency<Self::AccountId>;

        /// Minimum bond amount (in native currency).
        #[pallet::constant]
        type MinBondAmount: Get<BalanceOf<Self>>;

        /// Finality window in blocks (bonds must settle within this).
        #[pallet::constant]
        type FinalityWindow: Get<BlockNumberFor<Self>>;

        /// Whether to apply reputation damage on critical slashes.
        #[pallet::constant]
        type ReputationDamageEnabled: Get<bool>;

        /// Slash recipient (typically treasury).
        type SlashRecipient: Get<Self::AccountId>;
    }

    // ========================================================================
    // Storage
    // ========================================================================

    /// Bond ledger: Maps bond_id → BondState
    /// Stores the state of each posted bond.
    #[pallet::storage]
    #[pallet::getter(fn bonds)]
    pub type Bonds<T: Config> =
        StorageMap<_, Blake2_128Concat, H256, BondState<T::AccountId, BalanceOf<T>>, OptionQuery>;

    /// Bonds by agent: Maps agent_account → Vec<bond_id>
    /// For efficient lookup of all bonds posted by an agent.
    #[pallet::storage]
    #[pallet::getter(fn bonds_by_agent)]
    pub type BondsByAgent<T: Config> = StorageMap<
        _,
        Blake2_128Concat,
        T::AccountId,
        BoundedVec<H256, ConstU32<100>>,
        ValueQuery,
    >;

    /// Slash records: Maps slash_id → SlashRecord
    /// Immutable history of all slashing events.
    #[pallet::storage]
    #[pallet::getter(fn slashes)]
    pub type SlashRecords<T: Config> =
        StorageMap<_, Blake2_128Concat, u64, SlashRecord<T::AccountId>, OptionQuery>;

    /// Next slash ID counter.
    #[pallet::storage]
    pub type SlashIdCounter<T: Config> = StorageValue<_, u64, ValueQuery>;

    /// Next bond ID counter.
    #[pallet::storage]
    pub type BondIdCounter<T: Config> = StorageValue<_, H256, ValueQuery>;

    /// Reputation scores per agent: Maps account → reputation_score
    /// Used for tracking persistent damage across epochs.
    #[pallet::storage]
    #[pallet::getter(fn reputation)]
    pub type ReputationScores<T: Config> =
        StorageMap<_, Blake2_128Concat, T::AccountId, i64, ValueQuery>;

    /// Slashed in current epoch: Maps account → amount_slashed
    /// For statistics and dashboard queries.
    #[pallet::storage]
    #[pallet::getter(fn slashed_this_epoch)]
    pub type SlashedThisEpoch<T: Config> =
        StorageMap<_, Blake2_128Concat, T::AccountId, BalanceOf<T>, ValueQuery>;

    // ========================================================================
    // Events
    // ========================================================================

    #[pallet::event]
    #[pallet::generate_deposit(pub(super) fn deposit_event)]
    pub enum Event<T: Config> {
        /// Bond posted by agent
        /// [bond_id, agent, amount, expires_at]
        BondPosted {
            bond_id: H256,
            agent: T::AccountId,
            amount: BalanceOf<T>,
            expires_at: BlockNumberFor<T>,
        },

        /// Bond released after successful execution
        /// [bond_id, agent, amount]
        BondReleased {
            bond_id: H256,
            agent: T::AccountId,
            amount: BalanceOf<T>,
        },

        /// Slashing executed
        /// [slash_id, agent, bond_id, severity, amount_slashed]
        SlashExecuted {
            slash_id: u64,
            agent: T::AccountId,
            bond_id: H256,
            severity: u8, // 0=Minor, 1=Moderate, 2=Major, 3=Critical
            amount_slashed: BalanceOf<T>,
        },

        /// Reputation damage recorded
        /// [agent, damage_amount]
        ReputationDamaged {
            agent: T::AccountId,
            damage: i64,
        },

        /// Bond expired and was slashed automatically
        /// [bond_id, agent]
        BondExpired {
            bond_id: H256,
            agent: T::AccountId,
        },
    }

    // ========================================================================
    // Errors
    // ========================================================================

    #[pallet::error]
    pub enum Error<T> {
        /// Bond not found.
        BondNotFound,
        /// Agent does not have sufficient funds to post bond.
        InsufficientFunds,
        /// Bond amount is below minimum.
        BondTooSmall,
        /// Invalid bond state for this operation.
        InvalidBondState,
        /// Agent not found or unauthorized.
        NotAuthorized,
        /// Overflow/underflow in calculation.
        ArithmeticError,
        /// Reputation score out of bounds.
        ReputationOutOfBounds,
    }

    // ========================================================================
    // Extrinsics
    // ========================================================================

    #[pallet::call]
    impl<T: Config> Pallet<T> {
        /// Post a bond to participate in execution.
        /// Bond is held in reserve for the finality window.
        #[pallet::call_index(0)]
        #[pallet::weight(T::SlashWeightInfo::post_bond())]
        pub fn post_bond(
            origin: OriginFor<T>,
            amount: BalanceOf<T>,
            intent_id: Option<H256>,
        ) -> DispatchResult {
            let agent = ensure_signed(origin)?;

            // Validate amount
            ensure!(
                amount >= T::MinBondAmount::get(),
                Error::<T>::BondTooSmall
            );

            // Reserve currency
            T::Currency::reserve(&agent, amount)
                .map_err(|_| Error::<T>::InsufficientFunds)?;

            // Generate bond ID
            let bond_counter = BondIdCounter::<T>::get();
            let bond_id = T::Hashing::hash_of(&(agent.clone(), bond_counter));
            BondIdCounter::<T>::set(T::Hashing::hash_of(&(bond_counter, 1u32)));

            // Create bond state
            let now = frame_system::Pallet::<T>::block_number();
            let expires_at = now.saturating_add(T::FinalityWindow::get());

            let bond_state = BondState {
                bond_id,
                agent: agent.clone(),
                amount,
                posted_at: now,
                expires_at,
                intent_id,
                status: BondStatus::Active,
            };

            // Store bond
            Bonds::<T>::insert(bond_id, bond_state);
            BondsByAgent::<T>::mutate(&agent, |bonds| {
                let _ = bonds.try_push(bond_id);
            });

            Self::deposit_event(Event::BondPosted {
                bond_id,
                agent,
                amount,
                expires_at,
            });

            Ok(())
        }

        /// Release a bond after successful execution.
        /// Called by settlement engine or bridge upon successful finalization.
        #[pallet::call_index(1)]
        #[pallet::weight(T::SlashWeightInfo::release_bond())]
        pub fn release_bond(origin: OriginFor<T>, bond_id: H256) -> DispatchResult {
            // Only authorized pallets can release bonds
            // In a real implementation, this would use a privileged origin
            let _caller = ensure_signed(origin)?;

            let bond_state = Bonds::<T>::get(bond_id).ok_or(Error::<T>::BondNotFound)?;

            ensure!(
                matches!(bond_state.status, BondStatus::Active),
                Error::<T>::InvalidBondState
            );

            // Unreserve currency
            T::Currency::unreserve(&bond_state.agent, bond_state.amount);

            // Update bond status
            let mut bond_state = bond_state;
            bond_state.status = BondStatus::Released;
            Bonds::<T>::insert(bond_id, bond_state.clone());

            Self::deposit_event(Event::BondReleased {
                bond_id,
                agent: bond_state.agent,
                amount: bond_state.amount,
            });

            Ok(())
        }

        /// Execute a slash on an agent's bond.
        /// Called by settlement or bridge pallet upon detecting protocol violation.
        #[pallet::call_index(2)]
        #[pallet::weight(T::SlashWeightInfo::slash_bond())]
        pub fn slash_bond(
            origin: OriginFor<T>,
            bond_id: H256,
            severity: u8, // 0=Minor, 1=Moderate, 2=Major, 3=Critical
            reason: Vec<u8>,
        ) -> DispatchResult {
            // Privileged origin (settlement/bridge pallet)
            let _caller = ensure_signed(origin)?;

            let bond_state = Bonds::<T>::get(bond_id).ok_or(Error::<T>::BondNotFound)?;

            ensure!(
                matches!(bond_state.status, BondStatus::Active),
                Error::<T>::InvalidBondState
            );

            // Determine slash severity and amount
            let severity_enum = match severity {
                0 => SlashSeverity::Minor,
                1 => SlashSeverity::Moderate,
                2 => SlashSeverity::Major,
                3 => SlashSeverity::Critical,
                _ => SlashSeverity::Major,
            };

            let slash_bps = severity_enum.slash_bps();
            let slash_amount: BalanceOf<T> =
                (bond_state.amount / 10000u32.into()) * (slash_bps as u32).into();

            // Unreserve the slashed amount and send to treasury
            T::Currency::unreserve(&bond_state.agent, bond_state.amount);
            let (unreserved, _) =
                T::Currency::slash(&bond_state.agent, slash_amount);

            // Transfer slashed amount to treasury (could also be burned)
            let recipient = T::SlashRecipient::get();
            let _ = T::Currency::transfer(
                &bond_state.agent,
                &recipient,
                unreserved,
                frame_support::traits::ExistenceRequirement::AllowDeath,
            );

            // Record slash
            let slash_id = SlashIdCounter::<T>::get();
            SlashIdCounter::<T>::set(slash_id.saturating_add(1));

            let slash_record = SlashRecord {
                slash_id,
                agent: bond_state.agent.clone(),
                bond_id,
                severity,
                amount_slashed: unreserved,
                reason,
                slashed_at: frame_system::Pallet::<T>::block_number(),
            };

            SlashRecords::<T>::insert(slash_id, slash_record);

            // Update bond status
            let mut bond_state = bond_state;
            bond_state.status = BondStatus::FullySlashed;
            Bonds::<T>::insert(bond_id, bond_state.clone());

            // Apply reputation damage if critical
            if severity == 3 && T::ReputationDamageEnabled::get() {
                ReputationScores::<T>::mutate(&bond_state.agent, |rep| {
                    *rep = rep.saturating_sub(100); // Critical damage = -100 reputation
                });
                Self::deposit_event(Event::ReputationDamaged {
                    agent: bond_state.agent.clone(),
                    damage: -100,
                });
            }

            // Track slashed amount for epoch
            SlashedThisEpoch::<T>::mutate(&bond_state.agent, |total| {
                *total = total.saturating_add(unreserved);
            });

            Self::deposit_event(Event::SlashExecuted {
                slash_id,
                agent: bond_state.agent,
                bond_id,
                severity,
                amount_slashed: unreserved,
            });

            Ok(())
        }

        /// Process expired bonds.
        /// Called automatically in on_finalize() to slash expired bonds.
        #[pallet::call_index(3)]
        #[pallet::weight(T::SlashWeightInfo::process_expirations())]
        pub fn process_expirations(origin: OriginFor<T>) -> DispatchResult {
            ensure_root(origin)?;

            let now = frame_system::Pallet::<T>::block_number();

            // Find all active bonds that have expired
            let mut expired_bonds = Vec::new();
            Bonds::<T>::iter().for_each(|(bond_id, bond_state)| {
                if matches!(bond_state.status, BondStatus::Active) && bond_state.expires_at <= now {
                    expired_bonds.push((bond_id, bond_state));
                }
            });

            // Slash expired bonds
            for (bond_id, bond_state) in expired_bonds {
                // Unreserve and slash
                T::Currency::unreserve(&bond_state.agent, bond_state.amount);
                let (slashed, _) = T::Currency::slash(&bond_state.agent, bond_state.amount);

                // Transfer to treasury
                let recipient = T::SlashRecipient::get();
                let _ = T::Currency::transfer(
                    &bond_state.agent,
                    &recipient,
                    slashed,
                    frame_support::traits::ExistenceRequirement::AllowDeath,
                );

                // Update bond status
                let mut bond_state = bond_state;
                bond_state.status = BondStatus::Expired;
                Bonds::<T>::insert(bond_id, bond_state.clone());

                Self::deposit_event(Event::BondExpired {
                    bond_id,
                    agent: bond_state.agent,
                });
            }

            Ok(())
        }
    }

    // ========================================================================
    // Hooks
    // ========================================================================

    #[pallet::hooks]
    impl<T: Config> Hooks<BlockNumberFor<T>> for Pallet<T> {
        /// Process expired bonds at the end of every block.
        fn on_finalize(_block: BlockNumberFor<T>) {
            // In production, this would be more efficient by iterating
            // only bonds that are close to expiration, using an index.
            let now = frame_system::Pallet::<T>::block_number();

            let mut expired_bonds = Vec::new();
            Bonds::<T>::iter().for_each(|(bond_id, bond_state)| {
                if matches!(bond_state.status, BondStatus::Active) && bond_state.expires_at <= now {
                    expired_bonds.push((bond_id, bond_state));
                }
            });

            for (bond_id, bond_state) in expired_bonds {
                // Unreserve and slash
                T::Currency::unreserve(&bond_state.agent, bond_state.amount);
                let (slashed, _) = T::Currency::slash(&bond_state.agent, bond_state.amount);

                // Transfer to treasury
                let recipient = T::SlashRecipient::get();
                let _ = T::Currency::transfer(
                    &bond_state.agent,
                    &recipient,
                    slashed,
                    frame_support::traits::ExistenceRequirement::AllowDeath,
                );

                // Update bond status
                let mut bond_state = bond_state;
                bond_state.status = BondStatus::Expired;
                Bonds::<T>::insert(bond_id, bond_state.clone());

                Self::deposit_event(Event::BondExpired {
                    bond_id,
                    agent: bond_state.agent,
                });
            }
        }
    }
}
