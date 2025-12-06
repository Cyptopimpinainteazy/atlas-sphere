//! # X3Chain Governance Pallet
//!
//! A comprehensive governance system for the X3 blockchain supporting:
//! - Configurable voting logic (quorum, thresholds, conviction)
//! - Proposal lifecycle management
//! - Delegation with conviction multipliers
//! - Referendum mechanics
//! - Runtime upgrade hooks
//!
//! ## Overview
//!
//! The governance pallet enables decentralized decision-making through proposals
//! and referendums. Token holders can vote directly or delegate their voting power
//! to trusted representatives with configurable conviction levels.
//!
//! ## Conviction Voting
//!
//! Conviction allows voters to lock tokens for longer periods to amplify voting power:
//! - None (0x): 0.1x voting power, no lock
//! - Locked1x: 1x voting power, 1 period lock
//! - Locked2x: 2x voting power, 2 period lock
//! - Locked3x: 3x voting power, 4 period lock
//! - Locked4x: 4x voting power, 8 period lock
//! - Locked5x: 5x voting power, 16 period lock
//! - Locked6x: 6x voting power, 32 period lock

#![cfg_attr(not(feature = "std"), no_std)]

pub use pallet::*;

#[cfg(test)]
mod mock;

#[cfg(test)]
mod tests;

#[cfg(feature = "runtime-benchmarks")]
mod benchmarking;

pub mod weights;
pub use weights::WeightInfo;

pub mod types;
pub use types::*;

pub mod runtime_api;
pub use runtime_api::*;

#[frame_support::pallet]
pub mod pallet {
    use super::*;
    use frame_support::{
        dispatch::{Dispatchable, GetDispatchInfo, PostDispatchInfo},
        pallet_prelude::*,
        traits::{
            schedule::{DispatchTime, Named as ScheduleNamed},
            Currency, LockableCurrency, ReservableCurrency,
        },
        Blake2_128Concat,
    };
    use frame_system::pallet_prelude::*;
    use sp_runtime::{
        traits::{Saturating, Zero},
        DispatchError, Percent,
    };
    use sp_std::prelude::*;

    type BalanceOf<T> =
        <<T as Config>::Currency as Currency<<T as frame_system::Config>::AccountId>>::Balance;

    #[pallet::pallet]
    #[pallet::without_storage_info]
    pub struct Pallet<T>(_);

    #[pallet::config]
    pub trait Config: frame_system::Config {
        /// The overarching event type.
        type RuntimeEvent: From<Event<Self>> + IsType<<Self as frame_system::Config>::RuntimeEvent>;

        /// The overarching call type.
        type RuntimeCall: Parameter
            + From<Call<Self>>
            + GetDispatchInfo
            + IsType<<Self as frame_system::Config>::RuntimeCall>
            + Dispatchable<RuntimeOrigin = Self::RuntimeOrigin, PostInfo = PostDispatchInfo>;

        /// Currency type for voting and deposits.
        type Currency: ReservableCurrency<Self::AccountId>
            + LockableCurrency<Self::AccountId, Moment = BlockNumberFor<Self>>;

        /// Origin that can submit proposals.
        type SubmitOrigin: EnsureOrigin<Self::RuntimeOrigin, Success = Self::AccountId>;

        /// Origin that can fast-track proposals (e.g., technical committee).
        type FastTrackOrigin: EnsureOrigin<Self::RuntimeOrigin>;

        /// Origin that can cancel proposals in emergency.
        type CancelOrigin: EnsureOrigin<Self::RuntimeOrigin>;

        /// Origin for runtime upgrades.
        type RuntimeUpgradeOrigin: EnsureOrigin<Self::RuntimeOrigin>;

        /// Scheduler for enacting approved proposals.
        type Scheduler: ScheduleNamed<
            BlockNumberFor<Self>,
            <Self as Config>::RuntimeCall,
            Self::PalletsOrigin,
        >;

        /// The Scheduler's pallet origin type.
        type PalletsOrigin: From<frame_system::RawOrigin<Self::AccountId>>;

        /// Minimum deposit required to submit a proposal.
        #[pallet::constant]
        type ProposalDeposit: Get<BalanceOf<Self>>;

        /// Duration of the voting period in blocks.
        #[pallet::constant]
        type VotingPeriod: Get<BlockNumberFor<Self>>;

        /// Duration of the enactment delay after approval.
        #[pallet::constant]
        type EnactmentPeriod: Get<BlockNumberFor<Self>>;

        /// Minimum percentage of total issuance that must vote for quorum.
        #[pallet::constant]
        type Quorum: Get<Percent>;

        /// Approval threshold as percentage of votes.
        #[pallet::constant]
        type ApprovalThreshold: Get<Percent>;

        /// Maximum number of proposals that can exist at once.
        #[pallet::constant]
        type MaxProposals: Get<u32>;

        /// Maximum number of votes per account.
        #[pallet::constant]
        type MaxVotes: Get<u32>;

        /// Maximum delegations per account.
        #[pallet::constant]
        type MaxDelegations: Get<u32>;

        /// Lock period multiplier for conviction voting (in blocks).
        #[pallet::constant]
        type ConvictionPeriod: Get<BlockNumberFor<Self>>;

        /// Weight information for extrinsics.
        type WeightInfo: WeightInfo;
    }

    // ========================================================================
    // Storage Items
    // ========================================================================

    /// Counter for proposal IDs.
    #[pallet::storage]
    #[pallet::getter(fn proposal_count)]
    pub type ProposalCount<T> = StorageValue<_, u32, ValueQuery>;

    /// All proposals.
    #[pallet::storage]
    #[pallet::getter(fn proposals)]
    pub type Proposals<T: Config> = StorageMap<
        _,
        Blake2_128Concat,
        u32,
        Proposal<T::AccountId, BalanceOf<T>, BlockNumberFor<T>, <T as Config>::RuntimeCall>,
        OptionQuery,
    >;

    /// Votes for each proposal.
    #[pallet::storage]
    #[pallet::getter(fn proposal_votes)]
    pub type ProposalVotes<T: Config> =
        StorageMap<_, Blake2_128Concat, u32, ProposalTally<BalanceOf<T>>, ValueQuery>;

    /// Individual votes per account per proposal.
    #[pallet::storage]
    #[pallet::getter(fn voting)]
    pub type Voting<T: Config> = StorageDoubleMap<
        _,
        Blake2_128Concat,
        T::AccountId,
        Blake2_128Concat,
        u32,
        Vote<BalanceOf<T>>,
        OptionQuery,
    >;

    /// Delegation relationships.
    #[pallet::storage]
    #[pallet::getter(fn delegations)]
    pub type Delegations<T: Config> = StorageMap<
        _,
        Blake2_128Concat,
        T::AccountId,
        Delegation<T::AccountId, BalanceOf<T>>,
        OptionQuery,
    >;

    /// Accounts that have delegated to a specific target.
    #[pallet::storage]
    #[pallet::getter(fn delegators)]
    pub type Delegators<T: Config> = StorageMap<
        _,
        Blake2_128Concat,
        T::AccountId,
        BoundedVec<T::AccountId, T::MaxDelegations>,
        ValueQuery,
    >;

    /// Token locks for conviction voting.
    #[pallet::storage]
    #[pallet::getter(fn locks)]
    pub type Locks<T: Config> = StorageMap<
        _,
        Blake2_128Concat,
        T::AccountId,
        BoundedVec<VoteLock<BalanceOf<T>, BlockNumberFor<T>>, T::MaxVotes>,
        ValueQuery,
    >;

    /// Approved referendums pending enactment.
    #[pallet::storage]
    #[pallet::getter(fn pending_enactments)]
    pub type PendingEnactments<T: Config> = StorageMap<
        _,
        Blake2_128Concat,
        BlockNumberFor<T>,
        BoundedVec<u32, T::MaxProposals>,
        ValueQuery,
    >;

    /// Governance configuration (can be updated via governance).
    #[pallet::storage]
    #[pallet::getter(fn config)]
    pub type GovernanceConfig<T: Config> =
        StorageValue<_, GovernanceParams<BalanceOf<T>, BlockNumberFor<T>>, ValueQuery>;

    // ========================================================================
    // Events
    // ========================================================================

    #[pallet::event]
    #[pallet::generate_deposit(pub(super) fn deposit_event)]
    pub enum Event<T: Config> {
        /// A new proposal was submitted.
        ProposalSubmitted {
            proposal_id: u32,
            proposer: T::AccountId,
            deposit: BalanceOf<T>,
        },
        /// A vote was cast.
        Voted {
            voter: T::AccountId,
            proposal_id: u32,
            vote: VoteDirection,
            balance: BalanceOf<T>,
            conviction: Conviction,
        },
        /// A proposal was approved.
        ProposalApproved {
            proposal_id: u32,
            ayes: BalanceOf<T>,
            nays: BalanceOf<T>,
        },
        /// A proposal was rejected.
        ProposalRejected {
            proposal_id: u32,
            ayes: BalanceOf<T>,
            nays: BalanceOf<T>,
        },
        /// A proposal was enacted.
        ProposalEnacted {
            proposal_id: u32,
            result: DispatchResult,
        },
        /// A proposal was cancelled.
        ProposalCancelled { proposal_id: u32 },
        /// Voting delegation was set.
        Delegated {
            delegator: T::AccountId,
            target: T::AccountId,
            conviction: Conviction,
        },
        /// Delegation was removed.
        Undelegated { delegator: T::AccountId },
        /// A proposal was fast-tracked.
        FastTracked {
            proposal_id: u32,
            voting_period: BlockNumberFor<T>,
        },
        /// Governance parameters were updated.
        ConfigUpdated { quorum: Percent, threshold: Percent },
        /// Tokens were unlocked after conviction period.
        TokensUnlocked {
            account: T::AccountId,
            amount: BalanceOf<T>,
        },
    }

    // ========================================================================
    // Errors
    // ========================================================================

    #[pallet::error]
    pub enum Error<T> {
        /// Proposal not found.
        ProposalNotFound,
        /// Proposal already exists.
        ProposalAlreadyExists,
        /// Maximum proposals reached.
        TooManyProposals,
        /// Insufficient deposit for proposal.
        InsufficientDeposit,
        /// Voting period has ended.
        VotingEnded,
        /// Voting period has not ended.
        VotingNotEnded,
        /// Already voted on this proposal.
        AlreadyVoted,
        /// Account has not voted.
        NotVoted,
        /// Account has delegated votes.
        AlreadyDelegated,
        /// Cannot delegate to self.
        SelfDelegation,
        /// Circular delegation detected.
        CircularDelegation,
        /// Maximum delegations reached.
        TooManyDelegations,
        /// Maximum votes reached.
        TooManyVotes,
        /// Proposal not in voting state.
        NotInVoting,
        /// Quorum not reached.
        QuorumNotReached,
        /// Proposal already enacted.
        AlreadyEnacted,
        /// Insufficient balance for vote.
        InsufficientBalance,
        /// Tokens are locked.
        TokensLocked,
        /// Invalid conviction value.
        InvalidConviction,
        /// Proposal is not approved.
        NotApproved,
        /// Cannot cancel active proposal.
        CannotCancel,
        /// Arithmetic overflow.
        ArithmeticOverflow,
    }

    // ========================================================================
    // Genesis Config
    // ========================================================================

    #[pallet::genesis_config]
    #[derive(frame_support::DefaultNoBound)]
    pub struct GenesisConfig<T: Config> {
        pub _phantom: PhantomData<T>,
    }

    #[pallet::genesis_build]
    impl<T: Config> BuildGenesisConfig for GenesisConfig<T> {
        fn build(&self) {
            // Initialize default governance config
            GovernanceConfig::<T>::put(GovernanceParams {
                quorum: T::Quorum::get(),
                approval_threshold: T::ApprovalThreshold::get(),
                voting_period: T::VotingPeriod::get(),
                enactment_period: T::EnactmentPeriod::get(),
                proposal_deposit: T::ProposalDeposit::get(),
            });
        }
    }

    // ========================================================================
    // Hooks
    // ========================================================================

    #[pallet::hooks]
    impl<T: Config> Hooks<BlockNumberFor<T>> for Pallet<T> {
        fn on_initialize(n: BlockNumberFor<T>) -> Weight {
            let mut weight = Weight::zero();

            // Process pending enactments
            let enactments = PendingEnactments::<T>::take(n);
            for proposal_id in enactments.iter() {
                weight = weight.saturating_add(Self::enact_proposal(*proposal_id));
            }

            // Process expired proposals
            weight = weight.saturating_add(Self::process_expired_proposals(n));

            weight
        }
    }

    // ========================================================================
    // Extrinsics
    // ========================================================================

    #[pallet::call]
    impl<T: Config> Pallet<T> {
        /// Submit a new governance proposal.
        ///
        /// The proposer must deposit `ProposalDeposit` which is returned if the
        /// proposal is approved or slashed if rejected.
        #[pallet::call_index(0)]
        #[pallet::weight(T::WeightInfo::submit_proposal())]
        pub fn submit_proposal(
            origin: OriginFor<T>,
            call: Box<<T as Config>::RuntimeCall>,
            title: BoundedVec<u8, ConstU32<256>>,
            description: BoundedVec<u8, ConstU32<4096>>,
        ) -> DispatchResult {
            let proposer = T::SubmitOrigin::ensure_origin(origin)?;

            let config = GovernanceConfig::<T>::get();
            let deposit = config.proposal_deposit;

            // Reserve deposit
            T::Currency::reserve(&proposer, deposit)?;

            let proposal_id = ProposalCount::<T>::get();
            ensure!(
                proposal_id < T::MaxProposals::get(),
                Error::<T>::TooManyProposals
            );

            let current_block = frame_system::Pallet::<T>::block_number();
            let voting_end = current_block.saturating_add(config.voting_period);

            let proposal = Proposal {
                id: proposal_id,
                proposer: proposer.clone(),
                call: *call,
                title,
                description,
                deposit,
                status: ProposalStatus::Voting,
                submitted_at: current_block,
                voting_end,
                enacted_at: None,
            };

            Proposals::<T>::insert(proposal_id, proposal);
            ProposalVotes::<T>::insert(proposal_id, ProposalTally::default());
            ProposalCount::<T>::put(proposal_id.saturating_add(1));

            Self::deposit_event(Event::ProposalSubmitted {
                proposal_id,
                proposer,
                deposit,
            });

            Ok(())
        }

        /// Cast a vote on an active proposal.
        #[pallet::call_index(1)]
        #[pallet::weight(T::WeightInfo::vote())]
        pub fn vote(
            origin: OriginFor<T>,
            proposal_id: u32,
            direction: VoteDirection,
            balance: BalanceOf<T>,
            conviction: Conviction,
        ) -> DispatchResult {
            let voter = ensure_signed(origin)?;

            // Check voter is not delegating
            ensure!(
                !Delegations::<T>::contains_key(&voter),
                Error::<T>::AlreadyDelegated
            );

            let proposal = Proposals::<T>::get(proposal_id).ok_or(Error::<T>::ProposalNotFound)?;

            ensure!(
                proposal.status == ProposalStatus::Voting,
                Error::<T>::NotInVoting
            );

            let current_block = frame_system::Pallet::<T>::block_number();
            ensure!(
                current_block <= proposal.voting_end,
                Error::<T>::VotingEnded
            );

            // Check balance
            let free_balance = T::Currency::free_balance(&voter);
            ensure!(balance <= free_balance, Error::<T>::InsufficientBalance);

            // Calculate voting power with conviction
            let (mul_num, mul_denom) = conviction.multiplier();
            let voting_power = balance.saturating_mul(mul_num.into()) / mul_denom.into();

            // Add delegated voting power
            let delegated_power = Self::get_delegated_power(&voter, balance, conviction)?;
            let total_power = voting_power.saturating_add(delegated_power);

            // Remove previous vote if exists
            if let Some(prev_vote) = Voting::<T>::get(&voter, proposal_id) {
                Self::remove_vote_from_tally(proposal_id, &prev_vote)?;
            }

            // Record vote
            let vote = Vote {
                direction,
                balance,
                conviction,
                voting_power: total_power,
            };
            Voting::<T>::insert(&voter, proposal_id, vote.clone());

            // Update tally
            ProposalVotes::<T>::try_mutate(proposal_id, |tally| -> DispatchResult {
                match direction {
                    VoteDirection::Aye => {
                        tally.ayes = tally.ayes.saturating_add(total_power);
                        tally.aye_voters = tally.aye_voters.saturating_add(1);
                    }
                    VoteDirection::Nay => {
                        tally.nays = tally.nays.saturating_add(total_power);
                        tally.nay_voters = tally.nay_voters.saturating_add(1);
                    }
                    VoteDirection::Abstain => {
                        tally.abstains = tally.abstains.saturating_add(total_power);
                    }
                }
                tally.turnout = tally.turnout.saturating_add(balance);
                Ok(())
            })?;

            // Create conviction lock if needed
            if conviction != Conviction::None {
                Self::create_conviction_lock(&voter, balance, conviction)?;
            }

            Self::deposit_event(Event::Voted {
                voter,
                proposal_id,
                vote: direction,
                balance,
                conviction,
            });

            Ok(())
        }

        /// Delegate voting power to another account.
        #[pallet::call_index(2)]
        #[pallet::weight(T::WeightInfo::delegate())]
        pub fn delegate(
            origin: OriginFor<T>,
            target: T::AccountId,
            conviction: Conviction,
        ) -> DispatchResult {
            let delegator = ensure_signed(origin)?;

            ensure!(delegator != target, Error::<T>::SelfDelegation);

            // Check for circular delegation
            ensure!(
                !Self::would_create_cycle(&delegator, &target),
                Error::<T>::CircularDelegation
            );

            // Remove existing delegation
            if Delegations::<T>::contains_key(&delegator) {
                Self::remove_delegation(&delegator)?;
            }

            let balance = T::Currency::free_balance(&delegator);

            let delegation = Delegation {
                target: target.clone(),
                conviction,
                balance,
            };

            Delegations::<T>::insert(&delegator, delegation);

            // Add to target's delegators list
            Delegators::<T>::try_mutate(&target, |delegators| -> DispatchResult {
                delegators
                    .try_push(delegator.clone())
                    .map_err(|_| Error::<T>::TooManyDelegations)?;
                Ok(())
            })?;

            Self::deposit_event(Event::Delegated {
                delegator,
                target,
                conviction,
            });

            Ok(())
        }

        /// Remove delegation.
        #[pallet::call_index(3)]
        #[pallet::weight(T::WeightInfo::undelegate())]
        pub fn undelegate(origin: OriginFor<T>) -> DispatchResult {
            let delegator = ensure_signed(origin)?;

            Self::remove_delegation(&delegator)?;

            Self::deposit_event(Event::Undelegated { delegator });

            Ok(())
        }

        /// Fast-track a proposal (requires FastTrackOrigin).
        #[pallet::call_index(4)]
        #[pallet::weight(T::WeightInfo::fast_track())]
        pub fn fast_track(
            origin: OriginFor<T>,
            proposal_id: u32,
            voting_period: BlockNumberFor<T>,
        ) -> DispatchResult {
            T::FastTrackOrigin::ensure_origin(origin)?;

            Proposals::<T>::try_mutate(proposal_id, |maybe_proposal| -> DispatchResult {
                let proposal = maybe_proposal
                    .as_mut()
                    .ok_or(Error::<T>::ProposalNotFound)?;
                ensure!(
                    proposal.status == ProposalStatus::Voting,
                    Error::<T>::NotInVoting
                );

                let current_block = frame_system::Pallet::<T>::block_number();
                proposal.voting_end = current_block.saturating_add(voting_period);

                Ok(())
            })?;

            Self::deposit_event(Event::FastTracked {
                proposal_id,
                voting_period,
            });

            Ok(())
        }

        /// Cancel a proposal (requires CancelOrigin).
        #[pallet::call_index(5)]
        #[pallet::weight(T::WeightInfo::cancel_proposal())]
        pub fn cancel_proposal(origin: OriginFor<T>, proposal_id: u32) -> DispatchResult {
            T::CancelOrigin::ensure_origin(origin)?;

            let proposal = Proposals::<T>::get(proposal_id).ok_or(Error::<T>::ProposalNotFound)?;

            // Slash deposit
            T::Currency::slash_reserved(&proposal.proposer, proposal.deposit);

            // Clean up
            Proposals::<T>::remove(proposal_id);
            ProposalVotes::<T>::remove(proposal_id);

            Self::deposit_event(Event::ProposalCancelled { proposal_id });

            Ok(())
        }

        /// Finalize voting and determine outcome.
        #[pallet::call_index(6)]
        #[pallet::weight(T::WeightInfo::finalize_proposal())]
        pub fn finalize_proposal(origin: OriginFor<T>, proposal_id: u32) -> DispatchResult {
            ensure_signed(origin)?;

            let mut proposal =
                Proposals::<T>::get(proposal_id).ok_or(Error::<T>::ProposalNotFound)?;

            ensure!(
                proposal.status == ProposalStatus::Voting,
                Error::<T>::NotInVoting
            );

            let current_block = frame_system::Pallet::<T>::block_number();
            ensure!(
                current_block > proposal.voting_end,
                Error::<T>::VotingNotEnded
            );

            let tally = ProposalVotes::<T>::get(proposal_id);
            let config = GovernanceConfig::<T>::get();

            // Check quorum
            let total_issuance = T::Currency::total_issuance();
            let quorum_threshold = config.quorum.mul_floor(total_issuance);
            let quorum_met = tally.turnout >= quorum_threshold;

            // Check approval threshold
            let total_votes = tally.ayes.saturating_add(tally.nays);
            let approved = if total_votes > Zero::zero() && quorum_met {
                let approval_ratio = Percent::from_rational(tally.ayes, total_votes);
                approval_ratio >= config.approval_threshold
            } else {
                false
            };

            if approved {
                proposal.status = ProposalStatus::Approved;

                // Schedule enactment
                let enact_at = current_block.saturating_add(config.enactment_period);
                PendingEnactments::<T>::try_mutate(enact_at, |proposals| -> DispatchResult {
                    proposals
                        .try_push(proposal_id)
                        .map_err(|_| Error::<T>::TooManyProposals)?;
                    Ok(())
                })?;

                // Return deposit
                T::Currency::unreserve(&proposal.proposer, proposal.deposit);

                Self::deposit_event(Event::ProposalApproved {
                    proposal_id,
                    ayes: tally.ayes,
                    nays: tally.nays,
                });
            } else {
                proposal.status = ProposalStatus::Rejected;

                // Slash deposit (or return partial based on participation)
                if quorum_met {
                    // Full slash if quorum met but rejected
                    T::Currency::slash_reserved(&proposal.proposer, proposal.deposit);
                } else {
                    // Return deposit if quorum not met
                    T::Currency::unreserve(&proposal.proposer, proposal.deposit);
                }

                Self::deposit_event(Event::ProposalRejected {
                    proposal_id,
                    ayes: tally.ayes,
                    nays: tally.nays,
                });
            }

            Proposals::<T>::insert(proposal_id, proposal);

            Ok(())
        }

        /// Unlock tokens after conviction period expires.
        #[pallet::call_index(7)]
        #[pallet::weight(T::WeightInfo::unlock())]
        pub fn unlock(origin: OriginFor<T>, account: T::AccountId) -> DispatchResult {
            ensure_signed(origin)?;

            let current_block = frame_system::Pallet::<T>::block_number();
            let mut unlocked_amount = BalanceOf::<T>::zero();

            Locks::<T>::try_mutate(&account, |locks| -> DispatchResult {
                locks.retain(|lock| {
                    if current_block >= lock.unlock_at {
                        unlocked_amount = unlocked_amount.saturating_add(lock.amount);
                        false
                    } else {
                        true
                    }
                });
                Ok(())
            })?;

            if unlocked_amount > Zero::zero() {
                Self::deposit_event(Event::TokensUnlocked {
                    account,
                    amount: unlocked_amount,
                });
            }

            Ok(())
        }

        /// Update governance configuration (via governance).
        #[pallet::call_index(8)]
        #[pallet::weight(T::WeightInfo::update_config())]
        pub fn update_config(
            origin: OriginFor<T>,
            new_quorum: Option<Percent>,
            new_threshold: Option<Percent>,
            new_voting_period: Option<BlockNumberFor<T>>,
            new_enactment_period: Option<BlockNumberFor<T>>,
        ) -> DispatchResult {
            T::RuntimeUpgradeOrigin::ensure_origin(origin)?;

            GovernanceConfig::<T>::mutate(|config| {
                if let Some(q) = new_quorum {
                    config.quorum = q;
                }
                if let Some(t) = new_threshold {
                    config.approval_threshold = t;
                }
                if let Some(v) = new_voting_period {
                    config.voting_period = v;
                }
                if let Some(e) = new_enactment_period {
                    config.enactment_period = e;
                }
            });

            let config = GovernanceConfig::<T>::get();
            Self::deposit_event(Event::ConfigUpdated {
                quorum: config.quorum,
                threshold: config.approval_threshold,
            });

            Ok(())
        }
    }

    // ========================================================================
    // Helper Functions
    // ========================================================================

    impl<T: Config> Pallet<T> {
        /// Enact an approved proposal.
        fn enact_proposal(proposal_id: u32) -> Weight {
            let mut weight = T::DbWeight::get().reads(1);

            if let Some(mut proposal) = Proposals::<T>::get(proposal_id) {
                if proposal.status == ProposalStatus::Approved {
                    let result = proposal
                        .call
                        .clone()
                        .dispatch(frame_system::RawOrigin::Root.into());

                    let dispatch_result = result.map(|_| ()).map_err(|e| e.error);

                    proposal.status = ProposalStatus::Enacted;
                    proposal.enacted_at = Some(frame_system::Pallet::<T>::block_number());
                    Proposals::<T>::insert(proposal_id, proposal);

                    Self::deposit_event(Event::ProposalEnacted {
                        proposal_id,
                        result: dispatch_result,
                    });

                    weight = weight.saturating_add(T::DbWeight::get().writes(1));
                }
            }

            weight
        }

        /// Process expired proposals that weren't finalized.
        fn process_expired_proposals(current_block: BlockNumberFor<T>) -> Weight {
            let mut weight = Weight::zero();

            // This would iterate through proposals and auto-finalize expired ones
            // For efficiency, we rely on users calling finalize_proposal

            weight
        }

        /// Calculate delegated voting power for an account.
        fn get_delegated_power(
            account: &T::AccountId,
            _balance: BalanceOf<T>,
            _conviction: Conviction,
        ) -> Result<BalanceOf<T>, DispatchError> {
            let delegators = Delegators::<T>::get(account);
            let mut total_power = BalanceOf::<T>::zero();

            for delegator in delegators.iter() {
                if let Some(delegation) = Delegations::<T>::get(delegator) {
                    let (mul_num, mul_denom) = delegation.conviction.multiplier();
                    let power =
                        delegation.balance.saturating_mul(mul_num.into()) / mul_denom.into();
                    total_power = total_power.saturating_add(power);
                }
            }

            Ok(total_power)
        }

        /// Remove a vote from the tally.
        fn remove_vote_from_tally(proposal_id: u32, vote: &Vote<BalanceOf<T>>) -> DispatchResult {
            ProposalVotes::<T>::try_mutate(proposal_id, |tally| -> DispatchResult {
                match vote.direction {
                    VoteDirection::Aye => {
                        tally.ayes = tally.ayes.saturating_sub(vote.voting_power);
                        tally.aye_voters = tally.aye_voters.saturating_sub(1);
                    }
                    VoteDirection::Nay => {
                        tally.nays = tally.nays.saturating_sub(vote.voting_power);
                        tally.nay_voters = tally.nay_voters.saturating_sub(1);
                    }
                    VoteDirection::Abstain => {
                        tally.abstains = tally.abstains.saturating_sub(vote.voting_power);
                    }
                }
                tally.turnout = tally.turnout.saturating_sub(vote.balance);
                Ok(())
            })
        }

        /// Check if delegation would create a cycle.
        fn would_create_cycle(delegator: &T::AccountId, target: &T::AccountId) -> bool {
            let mut current = target.clone();
            let max_depth = 10u32;

            for _ in 0..max_depth {
                if let Some(delegation) = Delegations::<T>::get(&current) {
                    if &delegation.target == delegator {
                        return true;
                    }
                    current = delegation.target;
                } else {
                    return false;
                }
            }

            false
        }

        /// Remove delegation from an account.
        fn remove_delegation(delegator: &T::AccountId) -> DispatchResult {
            if let Some(delegation) = Delegations::<T>::take(delegator) {
                Delegators::<T>::mutate(&delegation.target, |delegators| {
                    delegators.retain(|d| d != delegator);
                });
            }
            Ok(())
        }

        /// Create a conviction lock for tokens.
        fn create_conviction_lock(
            account: &T::AccountId,
            amount: BalanceOf<T>,
            conviction: Conviction,
        ) -> DispatchResult {
            let current_block = frame_system::Pallet::<T>::block_number();
            let lock_periods = conviction.lock_periods();
            let unlock_at = current_block
                .saturating_add(T::ConvictionPeriod::get().saturating_mul(lock_periods.into()));

            let lock = VoteLock {
                amount,
                unlock_at,
                conviction,
            };

            Locks::<T>::try_mutate(account, |locks| -> DispatchResult {
                locks.try_push(lock).map_err(|_| Error::<T>::TooManyVotes)?;
                Ok(())
            })
        }

        // ====================================================================
        // Runtime API helpers
        // ====================================================================

        /// Get a snapshot of governance state for offchain consumers.
        pub fn get_governance_snapshot(
        ) -> GovernanceSnapshot<T::AccountId, BalanceOf<T>, BlockNumberFor<T>> {
            let config = GovernanceConfig::<T>::get();
            let proposal_count = ProposalCount::<T>::get();

            let mut active_proposals = Vec::new();
            let mut pending_enactments = Vec::new();

            for id in 0..proposal_count {
                if let Some(proposal) = Proposals::<T>::get(id) {
                    if proposal.status == ProposalStatus::Voting {
                        let tally = ProposalVotes::<T>::get(id);
                        active_proposals.push(ProposalSummary {
                            id,
                            proposer: proposal.proposer,
                            status: proposal.status,
                            voting_end: proposal.voting_end,
                            ayes: tally.ayes,
                            nays: tally.nays,
                            turnout: tally.turnout,
                        });
                    } else if proposal.status == ProposalStatus::Approved {
                        pending_enactments.push(id);
                    }
                }
            }

            GovernanceSnapshot {
                proposal_count,
                active_proposals,
                pending_enactments,
                config,
            }
        }
    }
}
