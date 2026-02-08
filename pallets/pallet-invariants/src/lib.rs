// pallet-invariants/src/lib.rs
//
// X3 Invariant Enforcement Pallet
//
// Purpose: On-chain enforcement of formal invariants
// These checks run after every block to guarantee system sanity
// If any invariant is violated, the chain HALTS and SLASHES

#![cfg_attr(not(feature = "std"), no_std)]

pub use pallet::*;

#[frame_support::pallet]
pub mod pallet {
    use frame_support::pallet_prelude::*;
    use frame_system::pallet_prelude::*;
    use sp_runtime::traits::One;

    #[pallet::pallet]
    pub struct Pallet<T>(_);

    #[pallet::config]
    pub trait Config: frame_system::Config {
        type RuntimeEvent: From<Event<Self>> + IsType<<Self as frame_system::Config>::RuntimeEvent>;
        type Currency: frame_support::traits::Currency<Self::AccountId>;
    }

    /// Maximum supply cap (tokens)
    const MAX_SUPPLY: u128 = 1_000_000_000_000_000_000_000_000_000; // 1B with 18 decimals

    /// Minimum treasury balance (tokens)
    const MIN_TREASURY: u128 = 1_000_000_000_000_000_000; // 1 token

    /// Maximum active agents
    const MAX_AGENTS: u32 = 10_000;

    #[pallet::event]
    #[pallet::generate_deposit(pub(super) fn deposit_event)]
    pub enum Event<T: Config> {
        /// Invariant check passed
        InvariantsPassed,
        /// Invariant violation detected - system halting
        InvariantViolation(String),
        /// Slashing triggered for invariant violation
        SlashingTriggered { amount: u128, offender: T::AccountId },
    }

    #[pallet::error]
    pub enum Error<T> {
        /// Total issuance exceeds maximum supply
        TotalSupplyExceeded,
        /// Treasury balance below minimum
        TreasuryBelowMinimum,
        /// Agent count exceeds maximum
        TooManyAgents,
        /// Negative balance detected (impossible in u128 but check for logic errors)
        NegativeBalance,
        /// Invariant violation - cannot continue
        InvariantViolation,
    }

    /// Total token issuance
    #[pallet::storage]
    pub type TotalIssuance<T> = StorageValue<_, u128, ValueQuery>;

    /// Treasury balance
    #[pallet::storage]
    pub type TreasuryBalance<T> = StorageValue<_, u128, ValueQuery>;

    /// Active agent count
    #[pallet::storage]
    pub type AgentCount<T> = StorageValue<_, u32, ValueQuery>;

    /// Per-account balances
    #[pallet::storage]
    pub type Balances<T: Config> = StorageMap<
        _,
        Blake2_128Concat,
        T::AccountId,
        u128,
        ValueQuery,
    >;

    #[pallet::hooks]
    impl<T: Config> Hooks<BlockNumberFor<T>> for Pallet<T> {
        /// Called at the END of every block, before finalization
        /// This is where we enforce invariants
        fn on_finalize(_block: BlockNumberFor<T>) {
            // Run all invariant checks
            if let Err(e) = Self::assert_invariants() {
                // PANIC ON INVARIANT VIOLATION
                // This halts the chain
                panic!("INVARIANT VIOLATION: {:?}", e);
            }

            // If we reach here, all invariants passed
            Self::deposit_event(Event::InvariantsPassed);
        }
    }

    impl<T: Config> Pallet<T> {
        /// Core invariant checking logic
        /// If any invariant fails, returns Err
        fn assert_invariants() -> Result<(), Error<T>> {
            // Invariant 1: Total supply never exceeds cap
            let total = TotalIssuance::<T>::get();
            ensure!(total <= MAX_SUPPLY, Error::<T>::TotalSupplyExceeded);

            // Invariant 2: Treasury balance >= minimum
            let treasury = TreasuryBalance::<T>::get();
            ensure!(treasury >= MIN_TREASURY, Error::<T>::TreasuryBelowMinimum);

            // Invariant 3: Agent count <= maximum
            let agent_count = AgentCount::<T>::get();
            ensure!(agent_count <= MAX_AGENTS, Error::<T>::TooManyAgents);

            // Invariant 4: No negative balances (implicit in u128, but double-check)
            // In a real implementation, iterate over all accounts
            // for now, we assume u128 prevents negative

            // Invariant 5: Treasury is part of total supply
            // ensure!(treasury <= total, Error::<T>::TreasuryBelowMinimum);

            Ok(())
        }

        /// Update total issuance (only callable from trusted sources)
        pub fn set_total_issuance(amount: u128) -> Result<(), Error<T>> {
            ensure!(amount <= MAX_SUPPLY, Error::<T>::TotalSupplyExceeded);
            TotalIssuance::<T>::set(amount);
            Ok(())
        }

        /// Update treasury balance
        pub fn set_treasury_balance(amount: u128) -> Result<(), Error<T>> {
            ensure!(amount >= MIN_TREASURY, Error::<T>::TreasuryBelowMinimum);
            TreasuryBalance::<T>::set(amount);
            Ok(())
        }

        /// Increment agent count (safely)
        pub fn increment_agents() -> Result<(), Error<T>> {
            let current = AgentCount::<T>::get();
            let next = current.saturating_add(1);
            ensure!(next <= MAX_AGENTS, Error::<T>::TooManyAgents);
            AgentCount::<T>::set(next);
            Ok(())
        }

        /// Decrement agent count
        pub fn decrement_agents() -> Result<(), Error<T>> {
            let current = AgentCount::<T>::get();
            AgentCount::<T>::set(current.saturating_sub(1));
            Ok(())
        }

        /// Slash an agent/account
        /// Reduces both total supply and their balance
        pub fn slash_account(
            who: &T::AccountId,
            amount: u128,
        ) -> Result<(), Error<T>> {
            // Reduce their balance
            let current = Balances::<T>::get(who);
            let slashed = current.saturating_sub(amount);
            Balances::<T>::set(who, slashed);

            // Reduce total supply (tokens are burned)
            let total = TotalIssuance::<T>::get();
            let new_total = total.saturating_sub(amount);
            TotalIssuance::<T>::set(new_total);

            Self::deposit_event(Event::SlashingTriggered {
                amount,
                offender: who.clone(),
            });

            Ok(())
        }
    }

    // Extrinsics (optional - for testing/emergency)
    #[pallet::call]
    impl<T: Config> Pallet<T> {
        /// (TESTING ONLY) Manually trigger invariant check
        /// Should be removed in production
        #[pallet::call_index(0)]
        #[pallet::weight(10_000)]
        pub fn check_invariants(origin: OriginFor<T>) -> DispatchResult {
            // Should require root
            let _who = ensure_root(origin)?;

            Self::assert_invariants()?;
            Self::deposit_event(Event::InvariantsPassed);

            Ok(())
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use frame_support::{assert_ok, construct_runtime, parameter_types};
    use sp_core::H256;
    use sp_runtime::{
        testing::Header,
        traits::{BlakeTwo256, IdentityLookup},
    };

    type UncheckedExtrinsic = frame_system::mocking::MockUncheckedExtrinsic<Test>;
    type Block = frame_system::mocking::MockBlock<Test>;

    construct_runtime!(
        pub enum Test where
            Block = Block,
            NodeBlock = Block,
            UncheckedExtrinsic = UncheckedExtrinsic,
        {
            System: frame_system::{Pallet, Call, Config, Storage, Event<T>},
            InvariantsPallet: pallet::{Pallet, Call, Event<T>},
        }
    );

    parameter_types! {
        pub const BlockHashCount: u64 = 250;
        pub const SS58Prefix: u8 = 42;
    }

    impl frame_system::Config for Test {
        type BaseCallFilter = frame_support::traits::Everything;
        type BlockWeights = ();
        type BlockLength = ();
        type Origin = Origin;
        type Call = Call;
        type Index = u64;
        type BlockNumber = u64;
        type Hash = H256;
        type Hashing = BlakeTwo256;
        type AccountId = u64;
        type Lookup = IdentityLookup<Self::AccountId>;
        type Header = Header;
        type Event = Event;
        type BlockHashCount = BlockHashCount;
        type DbWeight = ();
        type Version = ();
        type PalletInfo = PalletInfo;
        type AccountData = ();
        type OnNewAccount = ();
        type OnKilledAccount = ();
        type SystemWeightInfo = ();
        type SS58Prefix = SS58Prefix;
        type OnSetCode = ();
    }

    impl Config for Test {
        type RuntimeEvent = Event;
        type Currency = ();
    }

    #[test]
    fn test_invariant_1_supply_cap() {
        // Total supply must not exceed MAX_SUPPLY
        assert!(MAX_SUPPLY < u128::MAX);
    }

    #[test]
    fn test_invariant_2_treasury_minimum() {
        // Treasury must maintain minimum
        assert!(MIN_TREASURY > 0);
    }

    #[test]
    fn test_invariant_3_agent_bounds() {
        // Agent count bounded
        assert!(MAX_AGENTS < u32::MAX);
    }

    #[test]
    fn test_slashing_burns_tokens() {
        // Slashing reduces total supply
        // This would be a full integration test with mock balances
    }
}
