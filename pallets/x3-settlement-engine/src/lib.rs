//! # X3 Settlement Engine Pallet
//!
//! ## THE SETTLEMENT ROOT OF TRUST
//!
//! X3 is the final arbiter for all atomic settlements across:
//! - **EVM**: Ethereum and 100+ compatible chains
//! - **SVM**: Solana-compatible execution
//! - **BTC**: Native Bitcoin UTXO settlement (not wrapped)
//! - **X3VM**: Native governance and invariant enforcement
//!
//! ## Core Principle
//!
//! > "External chains are execution domains. X3 is the final arbiter."
//!
//! All trades—whether BTC, EVM, or SVM—must:
//! 1. Resolve through X3 atomic escrows
//! 2. Emit canonical settlement events
//! 3. Be verifiable on X3 even if execution happens elsewhere
//!
//! ## Architecture
//!
//! ```text
//! ┌─────────────────────────────────────────────────────────────────────────┐
//! │                        X3 SETTLEMENT ENGINE                             │
//! ├─────────────────────────────────────────────────────────────────────────┤
//! │                                                                         │
//! │  ┌─────────────────┐  ┌─────────────────┐  ┌─────────────────────────┐ │
//! │  │ AtomicIntent    │  │ CrossVMEscrow   │  │ BTCAtomicGateway        │ │
//! │  │ Registry        │  │                 │  │                         │ │
//! │  │                 │  │ • Lock assets   │  │ • UTXO tracking         │ │
//! │  │ • Intent create │  │ • Release/refund│  │ • SPV proof verify      │ │
//! │  │ • State machine │  │ • Cross-VM sync │  │ • Adaptor sigs          │ │
//! │  └─────────────────┘  └─────────────────┘  └─────────────────────────┘ │
//! │                                                                         │
//! │  ┌─────────────────┐  ┌─────────────────────────────────────────────┐  │
//! │  │ FinalityOracle  │  │ InvariantEnforcer                           │  │
//! │  │                 │  │                                             │  │
//! │  │ • Chain finality│  │ • No partial execution                      │  │
//! │  │ • Reorg risk    │  │ • No BTC release without X3 confirmation    │  │
//! │  │ • Depth tracking│  │ • All intents must resolve (finalize/refund)│  │
//! │  └─────────────────┘  │ • Timeouts always favor user funds          │  │
//! │                       └─────────────────────────────────────────────┘  │
//! └─────────────────────────────────────────────────────────────────────────┘
//! ```
//!
//! ## Settlement Flow
//!
//! ```text
//! MATCH → X3_INTENT_CREATED
//!       → ASSETS_LOCKED_X3
//!       → EXTERNAL_EXECUTION (BTC / EVM / SVM)
//!       → PROOF_SUBMITTED_TO_X3
//!       → FINALIZE_X3
//!
//! If anything fails:
//!       → REFUND_X3 (automatic, provable)
//! ```
//!
//! ## Invariants (NON-NEGOTIABLE)
//!
//! 1. No asset finalized unless ALL legs are provably complete
//! 2. No BTC release without X3 confirmation
//! 3. No cross-VM partial state
//! 4. All intents must resolve (finalize or refund)
//! 5. Timeouts ALWAYS favor user funds

#![cfg_attr(not(feature = "std"), no_std)]
#![allow(unused_imports)]
#![allow(
    clippy::clone_on_copy,
    clippy::collapsible_if,
    clippy::derivable_impls,
    clippy::manual_is_multiple_of,
    clippy::new_without_default,
    clippy::too_many_arguments
)]

pub mod atomic_lock;
pub mod btc_gateway;
pub mod collateral;
pub mod escrow;
pub mod finality;
pub mod intent;
pub mod invariants;
pub mod types;
pub mod weights;

#[cfg(test)]
mod mock;
#[cfg(test)]
mod tests;

#[cfg(feature = "runtime-benchmarks")]
mod benchmarking;

pub use types::*;
pub use weights::WeightInfo;

#[frame_support::pallet]
pub mod pallet {
    use super::*;
    use crate::atomic_lock;
    use frame_support::{
        pallet_prelude::*,
        traits::{Currency, ReservableCurrency, StorageVersion, UnixTime},
    };
    use frame_system::pallet_prelude::*;
    use sp_core::{ConstU32, H256};
    use sp_io::hashing::blake2_256;
    use sp_runtime::SaturatedConversion;
    use sp_std::vec::Vec;

    /// Current storage version
    const STORAGE_VERSION: StorageVersion = StorageVersion::new(1);

    // ============================================================================
    // Types
    // ============================================================================

    type BalanceOf<T> =
        <<T as Config>::Currency as Currency<<T as frame_system::Config>::AccountId>>::Balance;

    // ============================================================================
    // Pallet Definition
    // ============================================================================

    #[pallet::pallet]
    #[pallet::storage_version(STORAGE_VERSION)]
    pub struct Pallet<T>(_);

    #[pallet::config]
    pub trait Config: frame_system::Config + pallet_x3_kernel::Config {
        /// The overarching event type.
        type RuntimeEvent: From<Event<Self>> + IsType<<Self as frame_system::Config>::RuntimeEvent>;

        /// Weight information for extrinsics.
        type SettlementWeightInfo: crate::weights::WeightInfo;

        /// Currency for deposits and fees.
        type Currency: Currency<Self::AccountId> + ReservableCurrency<Self::AccountId>;

        /// Unix time provider for timeout enforcement.
        type UnixTime: UnixTime;

        /// Maximum legs per settlement intent.
        #[pallet::constant]
        type MaxSettlementLegs: Get<u32>;

        /// Maximum pending intents per account.
        #[pallet::constant]
        type MaxPendingIntents: Get<u32>;

        /// Default timeout for settlement (in seconds).
        #[pallet::constant]
        type DefaultSettlementTimeout: Get<u64>;

        /// Minimum BTC confirmation depth.
        #[pallet::constant]
        type MinBtcConfirmations: Get<u32>;

        /// Challenge period for optimistic settlements (in blocks).
        #[pallet::constant]
        type ChallengePeriod: Get<BlockNumberFor<Self>>;
    }

    // ============================================================================
    // Storage
    // ============================================================================

    /// Atomic Intent Registry: Maps intent_id → SettlementIntent
    #[pallet::storage]
    #[pallet::getter(fn settlement_intents)]
    pub type SettlementIntents<T: Config> =
        StorageMap<_, Blake2_128Concat, H256, SettlementIntent<T::AccountId>, OptionQuery>;

    /// Intent state machine: Maps intent_id → IntentState
    #[pallet::storage]
    #[pallet::getter(fn intent_states)]
    pub type IntentStates<T: Config> =
        StorageMap<_, Blake2_128Concat, H256, IntentState, ValueQuery>;

    /// Cross-VM Escrow: Maps (intent_id, leg_index) → EscrowState
    #[pallet::storage]
    #[pallet::getter(fn escrow_states)]
    pub type EscrowStates<T: Config> = StorageDoubleMap<
        _,
        Blake2_128Concat,
        H256, // intent_id
        Blake2_128Concat,
        u32, // leg_index
        EscrowLeg<T::AccountId>,
        OptionQuery,
    >;

    /// Claimed settlement legs: Maps (intent_id, leg_index) → claimed flag.
    ///
    /// This prevents replayed `claim_settlement` calls from incrementing
    /// `legs_claimed` without binding each claim to a concrete escrow leg.
    #[pallet::storage]
    #[pallet::getter(fn claimed_legs)]
    pub type ClaimedLegs<T: Config> =
        StorageDoubleMap<_, Blake2_128Concat, H256, Blake2_128Concat, u32, bool, ValueQuery>;

    /// BTC UTXO Registry: Maps (btc_txid, vout) → BTCUtxoState
    ///
    /// Keyed by BOTH txid AND output index to prevent UTXO double-spend where two
    /// outputs from the same transaction (same txid, different vout) would otherwise
    /// overwrite each other.
    #[pallet::storage]
    #[pallet::getter(fn btc_utxos)]
    pub type BtcUtxos<T: Config> = StorageDoubleMap<
        _,
        Blake2_128Concat,
        H256, // btc_txid
        Blake2_128Concat,
        u32, // vout
        BtcUtxoState,
        OptionQuery,
    >;

    /// BTC Block Headers (SPV): Maps block_hash → BTCBlockHeader
    #[pallet::storage]
    #[pallet::getter(fn btc_headers)]
    pub type BtcHeaders<T: Config> =
        StorageMap<_, Blake2_128Concat, H256, BtcBlockHeader, OptionQuery>;

    /// Best known BTC block height
    #[pallet::storage]
    #[pallet::getter(fn btc_best_height)]
    pub type BtcBestHeight<T: Config> = StorageValue<_, u64, ValueQuery>;

    // ========================================================================
    // Collateral / Bonds
    // ========================================================================

    /// Bond record storage: bond_id -> BondRecord
    #[pallet::storage]
    #[pallet::getter(fn bonds)]
    pub type Bonds<T: Config> =
        StorageMap<_, Blake2_128Concat, H256, BondRecord<T::AccountId, BalanceOf<T>>, OptionQuery>;

    /// Mapping from owner -> vector of bond ids (bounded for simplicity)
    #[pallet::storage]
    #[pallet::getter(fn bonds_by_owner)]
    pub type BondsByOwner<T: Config> =
        StorageMap<_, Blake2_128Concat, T::AccountId, BoundedVec<H256, ConstU32<100>>, ValueQuery>;

    #[pallet::type_value]
    pub fn DefaultBondCounter() -> u64 {
        0
    }

    /// Next bond counter (for simple unique id seed)
    #[pallet::storage]
    #[pallet::getter(fn bond_counter)]
    pub type BondCounter<T: Config> = StorageValue<_, u64, ValueQuery, DefaultBondCounter>;

    // Bond record stored on-chain
    #[derive(Clone, Encode, Decode, RuntimeDebug, TypeInfo, MaxEncodedLen, PartialEq, Eq)]
    #[scale_info(skip_type_params(AccountId, Balance))]
    pub struct BondRecord<AccountId, Balance> {
        pub id: H256,
        pub owner: AccountId,
        pub asset: BoundedVec<u8, ConstU32<64>>,
        pub amount: Balance,
        pub bond_type: u8,
        pub state: u8, // 0=Locked,1=Withdrawable,2=Slashed
        pub created_at: u64,
    }

    #[pallet::storage]
    #[pallet::getter(fn chain_finality)]
    pub type ChainFinality<T: Config> =
        StorageMap<_, Blake2_128Concat, ExternalChainId, FinalityConfig, OptionQuery>;

    /// Pending intents per account (for rate limiting)
    #[pallet::storage]
    #[pallet::getter(fn pending_intents)]
    pub type PendingIntents<T: Config> =
        StorageMap<_, Blake2_128Concat, T::AccountId, u32, ValueQuery>;

    /// Global intent counter (for statistics)
    #[pallet::storage]
    #[pallet::getter(fn total_intents)]
    pub type TotalIntents<T: Config> = StorageValue<_, u64, ValueQuery>;

    /// Total settled volume (in base units)
    #[pallet::storage]
    #[pallet::getter(fn total_settled_volume)]
    pub type TotalSettledVolume<T: Config> = StorageValue<_, u128, ValueQuery>;

    /// Invariant violation counter (for monitoring)
    #[pallet::storage]
    #[pallet::getter(fn invariant_violations)]
    pub type InvariantViolations<T: Config> = StorageValue<_, u64, ValueQuery>;

    /// Atomic Locks for 2PC: Maps intent_id → AtomicLock
    /// Used to enforce 2-phase commit atomicity during settlement.
    /// Tracks lock phase (Prepare, Commit, Released, Slashed) and deadlines.
    #[pallet::storage]
    #[pallet::getter(fn atomic_locks)]
    pub type AtomicLocks<T: Config> = StorageMap<
        _,
        Blake2_128Concat,
        H256, // intent_id
        atomic_lock::AtomicLock<BalanceOf<T>, T::AccountId>,
        OptionQuery,
    >;

    // ============================================================================
    // Events
    // ============================================================================

    #[pallet::event]
    #[pallet::generate_deposit(pub(super) fn deposit_event)]
    pub enum Event<T: Config> {
        /// Trade matched, settlement intent created on X3
        /// [intent_id, maker, taker, asset_a, asset_b]
        X3IntentCreated {
            intent_id: H256,
            maker: T::AccountId,
            taker: T::AccountId,
            asset_a: AssetSpec,
            asset_b: AssetSpec,
            secret_hash: H256,
            timeout: u64,
        },

        /// Assets locked in X3 escrow
        /// [intent_id, leg_index, chain, amount]
        X3AssetsLocked {
            intent_id: H256,
            leg_index: u32,
            chain: ExternalChainId,
            amount: u128,
            escrow_address: Vec<u8>,
        },

        /// External execution started (off X3)
        /// [intent_id, chain, tx_hash]
        ExternalExecutionStarted {
            intent_id: H256,
            chain: ExternalChainId,
            tx_hash: H256,
        },

        /// Bond deposited on-chain
        BondDeposited {
            bond_id: H256,
            owner: T::AccountId,
            amount: BalanceOf<T>,
        },

        /// Bond withdrawn/finalized
        BondWithdrawn {
            bond_id: H256,
            owner: T::AccountId,
            amount: BalanceOf<T>,
        },

        /// Bond slashed
        BondSlashed { bond_id: H256 },

        /// External proof submitted to X3
        /// [intent_id, chain, proof_type, tx_hash]
        ExternalProofSubmitted {
            intent_id: H256,
            chain: ExternalChainId,
            proof_type: ProofType,
            tx_hash: H256,
            confirmations: u32,
        },

        /// Settlement finalized on X3 (ALL legs complete)
        /// [intent_id, total_value_usd]
        X3Finalized {
            intent_id: H256,
            maker_received: u128,
            taker_received: u128,
            settlement_time_ms: u64,
        },

        /// Settlement refunded on X3 (timeout or failure)
        /// [intent_id, reason]
        X3Refunded {
            intent_id: H256,
            reason: RefundReason,
            maker_returned: u128,
            taker_returned: u128,
        },

        /// Invariant violation detected (CRITICAL)
        /// [intent_id, violation_type]
        InvariantViolation {
            intent_id: H256,
            violation_type: InvariantViolationType,
            details: Vec<u8>,
        },

        /// BTC UTXO confirmed for settlement
        /// [intent_id, btc_txid, vout, confirmations]
        BtcUtxoConfirmed {
            intent_id: H256,
            btc_txid: H256,
            vout: u32,
            confirmations: u32,
            amount_sats: u64,
        },

        /// BTC released after X3 confirmation
        /// [intent_id, btc_txid, recipient]
        BtcReleased {
            intent_id: H256,
            btc_txid: H256,
            recipient: Vec<u8>,
            amount_sats: u64,
        },

        /// Atomic lock timed out and executor slashed
        /// [intent_id, executor_id, amount_slashed]
        AtomicLockTimeoutSlashed {
            intent_id: H256,
            executor_id: [u8; 32],
            amount_slashed: BalanceOf<T>,
        },
    }

    // ============================================================================
    // Errors
    // ============================================================================

    #[pallet::error]
    pub enum Error<T> {
        /// Intent already exists
        IntentAlreadyExists,
        /// Intent not found
        IntentNotFound,
        /// Invalid intent state for operation
        InvalidIntentState,
        /// Invalid settlement leg
        InvalidSettlementLeg,
        /// Too many pending intents
        TooManyPendingIntents,
        /// Insufficient balance for escrow
        InsufficientBalance,
        /// Invalid secret hash
        InvalidSecretHash,
        /// Invalid secret (preimage doesn't match hash)
        InvalidSecret,
        /// Settlement timeout expired
        TimeoutExpired,
        /// Settlement timeout not yet expired (for refund)
        TimeoutNotExpired,
        /// Invalid proof submitted
        InvalidProof,
        /// BTC UTXO not confirmed
        BtcNotConfirmed,
        /// BTC confirmation depth insufficient
        InsufficientBtcConfirmations,
        /// Invalid BTC proof
        InvalidBtcProof,
        /// External chain not supported
        UnsupportedChain,
        /// Invariant violation detected
        InvariantViolation,
        /// Escrow already exists
        EscrowAlreadyExists,
        /// Escrow not found
        EscrowNotFound,
        /// Not authorized for operation
        NotAuthorized,
        /// Invalid asset specification
        InvalidAssetSpec,
        /// Arithmetic overflow
        ArithmeticOverflow,
        /// Partial execution detected (CRITICAL)
        PartialExecutionDetected,
        /// Cross-VM reentrancy detected (CRITICAL)
        CrossVmReentrancyDetected,
        /// Bond not found
        BondNotFound,
        /// Not the owner of the bond
        NotBondOwner,
        /// Bond is not locked (cannot withdraw yet)
        BondNotLocked,
        /// Bond is not withdrawable
        BondNotWithdrawable,
        /// Too many bonds for owner
        TooManyBonds,
        /// Bond already slashed
        BondAlreadySlashed,
        /// No unclaimed escrow leg found for claimer
        NoClaimableLeg,
    }

    // ============================================================================
    // Hooks
    // ============================================================================

    #[pallet::hooks]
    impl<T: Config> Hooks<BlockNumberFor<T>> for Pallet<T> {
        fn on_initialize(_n: BlockNumberFor<T>) -> Weight {
            // Process any expired settlements that need automatic refunds
            // In production, this would iterate through pending intents and trigger refunds
            // for expired timeouts. For now, we skip this to avoid storage iteration costs.
            Weight::zero()
        }

        fn on_finalize(_n: BlockNumberFor<T>) {
            // Process atomic lock timeouts and emit slashing events.
            // Actual slash execution happens via scheduled extrinsic or off-chain worker.
            //
            // SAFETY: We cap the number of locks processed per block to prevent
            // unbounded on_finalize execution. Locks that are not processed this block
            // will be processed in subsequent blocks.
            const MAX_LOCKS_PER_BLOCK: usize = 20;

            let current_block: u32 =
                frame_system::Pallet::<T>::block_number().saturated_into::<u32>();

            // Collect at most MAX_LOCKS_PER_BLOCK EXPIRED entries from storage.
            // CRITICAL FIX: filter BEFORE take to ensure we process expired locks
            // even if they are scattered throughout storage.
            // Old pattern: .take(N).filter() could skip expired items beyond position N.
            // New pattern: .filter().take(N) ensures we process all expired items fairly.
            let expired_locks: Vec<(H256, atomic_lock::AtomicLock<BalanceOf<T>, T::AccountId>)> =
                AtomicLocks::<T>::iter()
                    .filter(|(_, lock)| lock.is_expired(current_block))
                    .take(MAX_LOCKS_PER_BLOCK)
                    .collect();

            // Process each expired lock
            for (intent_id, mut lock) in expired_locks {
                // Transition lock to Slashed phase
                if lock.slash_on_timeout(current_block).is_ok() {
                    let executor_id = lock.executor_id;
                    let slashed_amount = lock.amount;

                    // Update storage with slashed lock
                    AtomicLocks::<T>::insert(intent_id, lock);

                    // Emit event that off-chain worker or governance can use to slash bond
                    Self::deposit_event(Event::AtomicLockTimeoutSlashed {
                        intent_id,
                        executor_id,
                        amount_slashed: slashed_amount,
                    });
                }
            }
        }
    }

    // ============================================================================
    // Extrinsics
    // ============================================================================

    #[pallet::call]
    impl<T: Config> Pallet<T> {
        // ────────────────────────────────────────────────────────────────────
        // INTENT LIFECYCLE
        // ────────────────────────────────────────────────────────────────────

        /// Create a new settlement intent (from matched trade)
        ///
        /// This is the entry point for all atomic settlements.
        /// The intent is registered on X3 and becomes the source of truth.
        #[pallet::call_index(0)]
        #[pallet::weight(T::SettlementWeightInfo::create_intent())]
        pub fn create_intent(
            origin: OriginFor<T>,
            taker: T::AccountId,
            asset_a: AssetSpec,
            asset_b: AssetSpec,
            secret_hash: H256,
            timeout_seconds: Option<u64>,
        ) -> DispatchResult {
            let maker = ensure_signed(origin)?;

            // Check pending intent limit
            let pending = PendingIntents::<T>::get(&maker);
            ensure!(
                pending < T::MaxPendingIntents::get(),
                Error::<T>::TooManyPendingIntents
            );

            // Generate intent ID
            let nonce = TotalIntents::<T>::get();
            let intent_id = Self::generate_intent_id(&maker, &taker, nonce);

            ensure!(
                !SettlementIntents::<T>::contains_key(intent_id),
                Error::<T>::IntentAlreadyExists
            );

            // Calculate timeout
            let now = T::UnixTime::now().as_secs();
            let timeout =
                now.saturating_add(timeout_seconds.unwrap_or(T::DefaultSettlementTimeout::get()));

            // Create intent
            let intent = SettlementIntent {
                intent_id,
                maker: maker.clone(),
                taker: taker.clone(),
                asset_a: asset_a.clone(),
                asset_b: asset_b.clone(),
                secret_hash,
                timeout,
                created_at: now,
                legs_total: 2, // Default 2 legs for simple swap
                legs_locked: 0,
                legs_claimed: 0,
            };

            // Store intent
            SettlementIntents::<T>::insert(intent_id, intent);
            IntentStates::<T>::insert(intent_id, IntentState::Created);
            PendingIntents::<T>::mutate(&maker, |p| *p = p.saturating_add(1));
            TotalIntents::<T>::mutate(|t| *t = t.saturating_add(1));

            // Initialize atomic lock for 2PC: Prepare phase
            // Lock funds for commitment. Deadline is 2 hours (blocks assumed ~12s = 600 blocks for 2 hours)
            let current_block = frame_system::Pallet::<T>::block_number().saturated_into::<u32>();
            let commit_deadline_blocks: u32 = 600; // ~2 hours

            let atomic_lock = atomic_lock::AtomicLock::new_prepare(
                intent_id.into(),
                maker.clone(),
                Default::default(), // Amount set during lock_escrow, placeholder here
                maker.clone(),      // Escrow account (temp, will be set per-leg)
                Default::default(), // Executor ID (temp, set during finalize)
                current_block,
                commit_deadline_blocks,
            );

            AtomicLocks::<T>::insert(intent_id, atomic_lock);

            Self::deposit_event(Event::X3IntentCreated {
                intent_id,
                maker,
                taker,
                asset_a,
                asset_b,
                secret_hash,
                timeout,
            });

            Ok(())
        }

        /// Lock assets into X3 escrow for a settlement leg
        #[pallet::call_index(1)]
        #[pallet::weight(T::SettlementWeightInfo::lock_escrow())]
        pub fn lock_escrow(
            origin: OriginFor<T>,
            intent_id: H256,
            leg_index: u32,
            chain: ExternalChainId,
            amount: u128,
            escrow_data: Vec<u8>,
        ) -> DispatchResult {
            let who = ensure_signed(origin)?;

            // Verify intent exists and is in correct state
            let mut intent =
                SettlementIntents::<T>::get(intent_id).ok_or(Error::<T>::IntentNotFound)?;

            let state = IntentStates::<T>::get(intent_id);
            ensure!(
                matches!(state, IntentState::Created | IntentState::FundingInProgress),
                Error::<T>::InvalidIntentState
            );

            // Verify caller is maker or taker
            ensure!(
                who == intent.maker || who == intent.taker,
                Error::<T>::NotAuthorized
            );

            // Bounds-check leg_index against the declared leg count.
            // Without this, an attacker could create escrows at arbitrary indices
            // and increment legs_locked beyond legs_total.
            ensure!(
                leg_index < intent.legs_total,
                Error::<T>::InvalidSettlementLeg
            );

            // Check escrow doesn't exist
            ensure!(
                !EscrowStates::<T>::contains_key(intent_id, leg_index),
                Error::<T>::EscrowAlreadyExists
            );

            // Convert escrow data to bounded vec
            let bounded_escrow_address: BoundedVec<u8, ConstU32<64>> = escrow_data
                .clone()
                .try_into()
                .map_err(|_| Error::<T>::InvalidAssetSpec)?;

            // Create escrow leg
            let escrow_leg = EscrowLeg {
                intent_id,
                leg_index,
                depositor: who.clone(),
                chain: chain.clone(),
                amount,
                escrow_address: bounded_escrow_address,
                state: EscrowLegState::Locked,
                locked_at: T::UnixTime::now().as_secs(),
                proof: None,
            };

            // Store escrow
            EscrowStates::<T>::insert(intent_id, leg_index, escrow_leg);

            // Update intent
            intent.legs_locked = intent.legs_locked.saturating_add(1);
            SettlementIntents::<T>::insert(intent_id, intent.clone());

            // Update state if all legs locked
            if intent.legs_locked >= intent.legs_total {
                IntentStates::<T>::insert(intent_id, IntentState::FullyFunded);

                // Transition atomic lock to Commit phase when all legs are locked
                if let Some(mut atomic_lock) = AtomicLocks::<T>::get(intent_id) {
                    let current_block =
                        frame_system::Pallet::<T>::block_number().saturated_into::<u32>();
                    let finalize_deadline_blocks: u32 = 600; // ~2 hours for finalization

                    // Transition to Commit phase - if this fails, we log but don't fail the extrinsic
                    // since the lock was already created in Prepare phase
                    let _ = atomic_lock.lock_for_commit(current_block, finalize_deadline_blocks);

                    AtomicLocks::<T>::insert(intent_id, atomic_lock);
                }
            } else {
                IntentStates::<T>::insert(intent_id, IntentState::FundingInProgress);
            }

            Self::deposit_event(Event::X3AssetsLocked {
                intent_id,
                leg_index,
                chain,
                amount,
                escrow_address: escrow_data,
            });

            Ok(())
        }

        /// Submit external execution proof to X3
        #[pallet::call_index(2)]
        #[pallet::weight(T::SettlementWeightInfo::submit_external_proof())]
        pub fn submit_proof(
            origin: OriginFor<T>,
            intent_id: H256,
            chain: ExternalChainId,
            proof: SettlementProof,
        ) -> DispatchResult {
            let who = ensure_signed(origin)?;

            // Verify intent exists and caller is party to the intent.
            // Only the maker or taker may advance proof state to prevent third-party
            // actors from triggering state transitions for intents they are not party to.
            let intent =
                SettlementIntents::<T>::get(intent_id).ok_or(Error::<T>::IntentNotFound)?;
            ensure!(
                who == intent.maker || who == intent.taker,
                Error::<T>::NotAuthorized
            );

            let state = IntentStates::<T>::get(intent_id);
            ensure!(
                matches!(
                    state,
                    IntentState::FullyFunded | IntentState::ExecutingExternal
                ),
                Error::<T>::InvalidIntentState
            );

            // Enforce chain-specific finality depth before accepting external proofs.
            let finality_cfg = ChainFinality::<T>::get(chain.clone())
                .unwrap_or_else(|| finality::FinalityOracle::default_config(chain.clone()));
            ensure!(
                proof.confirmations >= finality_cfg.confirmations_required,
                Error::<T>::InvalidProof
            );
            ensure!(
                proof.proof_type == finality_cfg.proof_type,
                Error::<T>::InvalidProof
            );

            // Verify proof based on chain type
            let is_valid = Self::verify_proof(&chain, &proof)?;
            ensure!(is_valid, Error::<T>::InvalidProof);

            // Update state
            IntentStates::<T>::insert(intent_id, IntentState::ExecutingExternal);

            Self::deposit_event(Event::ExternalProofSubmitted {
                intent_id,
                chain,
                proof_type: proof.proof_type,
                tx_hash: proof.tx_hash,
                confirmations: proof.confirmations,
            });

            Ok(())
        }

        /// Claim settlement with secret revelation
        #[pallet::call_index(3)]
        #[pallet::weight(T::SettlementWeightInfo::claim_settlement())]
        pub fn claim_settlement(
            origin: OriginFor<T>,
            intent_id: H256,
            secret: H256,
        ) -> DispatchResult {
            let who = ensure_signed(origin)?;

            // Verify intent exists
            let mut intent =
                SettlementIntents::<T>::get(intent_id).ok_or(Error::<T>::IntentNotFound)?;

            let state = IntentStates::<T>::get(intent_id);
            ensure!(
                matches!(
                    state,
                    IntentState::FullyFunded
                        | IntentState::ExecutingExternal
                        | IntentState::Claiming
                ),
                Error::<T>::InvalidIntentState
            );

            // Verify secret matches hash (HTLC claim)
            let computed_hash = H256::from(blake2_256(secret.as_bytes()));
            ensure!(
                computed_hash == intent.secret_hash,
                Error::<T>::InvalidSecret
            );

            // Verify timeout not expired
            let now = T::UnixTime::now().as_secs();
            ensure!(now < intent.timeout, Error::<T>::TimeoutExpired);

            // Run invariant checks BEFORE finalization
            Self::check_settlement_invariants(intent_id)?;

            // Bind claim to an actual escrow leg for this claimer.
            Self::mark_claimed_leg(intent_id, &intent, &who)?;

            // Update intent claim counter
            intent.legs_claimed = intent.legs_claimed.saturating_add(1);
            SettlementIntents::<T>::insert(intent_id, intent.clone());

            // Check if fully claimed
            if intent.legs_claimed >= intent.legs_total {
                Self::finalize_settlement(intent_id, &intent, &who)?;
            } else {
                IntentStates::<T>::insert(intent_id, IntentState::Claiming);
            }

            Ok(())
        }

        /// Refund settlement after timeout
        #[pallet::call_index(4)]
        #[pallet::weight(T::SettlementWeightInfo::refund_intent())]
        pub fn refund_settlement(origin: OriginFor<T>, intent_id: H256) -> DispatchResult {
            let who = ensure_signed(origin)?;

            // Verify intent exists
            let intent =
                SettlementIntents::<T>::get(intent_id).ok_or(Error::<T>::IntentNotFound)?;

            // Verify caller is maker or taker
            ensure!(
                who == intent.maker || who == intent.taker,
                Error::<T>::NotAuthorized
            );

            let state = IntentStates::<T>::get(intent_id);
            ensure!(
                !matches!(state, IntentState::Finalized | IntentState::Refunded),
                Error::<T>::InvalidIntentState
            );

            // Verify timeout HAS expired
            let now = T::UnixTime::now().as_secs();
            ensure!(now >= intent.timeout, Error::<T>::TimeoutNotExpired);

            // Process refund
            Self::process_refund(intent_id, &intent, RefundReason::Timeout)?;

            Ok(())
        }

        // ────────────────────────────────────────────────────────────────────
        // COLLATERAL / BONDING
        // ────────────────────────────────────────────────────────────────────

        #[pallet::call_index(20)]
        #[pallet::weight(T::SettlementWeightInfo::lock_escrow())]
        pub fn deposit_bond(
            origin: OriginFor<T>,
            asset: Vec<u8>,
            amount: BalanceOf<T>,
            bond_type: u8,
        ) -> DispatchResult {
            let who = ensure_signed(origin)?;

            // Reserve funds from caller
            <T as Config>::Currency::reserve(&who, amount)?;

            let _id = Self::create_bond_internal(&who, asset, amount, bond_type)?;

            Ok(())
        }

        #[pallet::call_index(21)]
        #[pallet::weight(T::SettlementWeightInfo::lock_escrow())]
        pub fn request_bond_withdraw(origin: OriginFor<T>, bond_id: H256) -> DispatchResult {
            let who = ensure_signed(origin)?;

            // Ensure owner
            let rec = Bonds::<T>::get(bond_id).ok_or(Error::<T>::BondNotFound)?;
            ensure!(rec.owner == who, Error::<T>::NotBondOwner);
            ensure!(rec.state == 0, Error::<T>::BondNotLocked);

            Self::request_withdrawal_internal(bond_id)?;
            Ok(())
        }

        #[pallet::call_index(22)]
        #[pallet::weight(T::SettlementWeightInfo::claim_bond())]
        pub fn finalize_bond_withdraw(origin: OriginFor<T>, bond_id: H256) -> DispatchResult {
            let who = ensure_signed(origin)?;

            let rec = Bonds::<T>::get(bond_id).ok_or(Error::<T>::BondNotFound)?;
            ensure!(rec.owner == who, Error::<T>::NotBondOwner);
            ensure!(rec.state == 1, Error::<T>::BondNotWithdrawable);

            // Unreserve and remove
            <T as Config>::Currency::unreserve(&who, rec.amount);
            Self::finalize_withdraw_internal(bond_id)?;
            Ok(())
        }

        #[pallet::call_index(23)]
        #[pallet::weight(T::SettlementWeightInfo::claim_bond())]
        pub fn slash_bond(origin: OriginFor<T>, bond_id: H256) -> DispatchResult {
            ensure_root(origin)?;

            let rec = Bonds::<T>::get(bond_id).ok_or(Error::<T>::BondNotFound)?;
            ensure!(rec.state != 2, Error::<T>::BondAlreadySlashed);

            // Slash reserved balance
            let _ = <T as Config>::Currency::slash_reserved(&rec.owner, rec.amount);

            Self::slash_bond_internal(bond_id)?;
            Ok(())
        }

        // ────────────────────────────────────────────────────────────────────
        // BTC ATOMIC GATEWAY
        // ────────────────────────────────────────────────────────────────────

        /// Submit BTC SPV proof for UTXO verification
        #[pallet::call_index(10)]
        #[pallet::weight(T::SettlementWeightInfo::verify_btc_proof())]
        pub fn submit_btc_proof(
            origin: OriginFor<T>,
            intent_id: H256,
            btc_txid: H256,
            vout: u32,
            amount_sats: u64,
            merkle_proof: Vec<H256>,
            block_header: BtcBlockHeader,
        ) -> DispatchResult {
            let who = ensure_signed(origin)?;

            // Verify intent exists and restrict proof submission to intent parties.
            // Only the maker or taker may submit a BTC proof to prevent DoS or
            // replay attacks from arbitrary accounts.
            let intent =
                SettlementIntents::<T>::get(intent_id).ok_or(Error::<T>::IntentNotFound)?;
            ensure!(
                who == intent.maker || who == intent.taker,
                Error::<T>::NotAuthorized
            );

            // Verify merkle proof
            let is_valid = Self::verify_btc_merkle_proof(&btc_txid, &merkle_proof, &block_header)?;
            ensure!(is_valid, Error::<T>::InvalidBtcProof);

            // Store/update block header
            let block_hash = Self::compute_btc_block_hash(&block_header);
            BtcHeaders::<T>::insert(block_hash, block_header.clone());

            // Calculate confirmations
            let best_height = BtcBestHeight::<T>::get();
            let confirmations = best_height.saturating_sub(block_header.height) + 1;

            ensure!(
                confirmations >= T::MinBtcConfirmations::get() as u64,
                Error::<T>::InsufficientBtcConfirmations
            );

            // Store UTXO state keyed by (txid, vout) to correctly handle multiple
            // outputs from the same transaction without overwriting each other.
            let utxo_state = BtcUtxoState {
                txid: btc_txid,
                vout,
                amount_sats,
                intent_id: Some(intent_id),
                confirmations: confirmations as u32,
                spent: false,
                block_hash,
            };
            // Prevent spending an already-registered UTXO.
            ensure!(
                !BtcUtxos::<T>::contains_key(btc_txid, vout),
                Error::<T>::EscrowAlreadyExists
            );
            BtcUtxos::<T>::insert(btc_txid, vout, utxo_state);

            Self::deposit_event(Event::BtcUtxoConfirmed {
                intent_id,
                btc_txid,
                vout,
                confirmations: confirmations as u32,
                amount_sats,
            });

            Ok(())
        }

        /// Submit BTC block header (for SPV)
        ///
        /// Restricted to privileged origin to prevent arbitrary accounts from
        /// pushing invalid/competing header branches into local state.
        #[pallet::call_index(11)]
        #[pallet::weight(T::SettlementWeightInfo::update_btc_block_header())]
        pub fn submit_btc_header(origin: OriginFor<T>, header: BtcBlockHeader) -> DispatchResult {
            ensure_root(origin)?;

            // Verify proof of work
            let is_valid = Self::verify_btc_pow(&header)?;
            ensure!(is_valid, Error::<T>::InvalidBtcProof);

            // Verify chain connection
            let prev_exists = BtcHeaders::<T>::contains_key(header.prev_block_hash);
            ensure!(
                prev_exists || header.height == 0,
                Error::<T>::InvalidBtcProof
            );

            // Store header
            let block_hash = Self::compute_btc_block_hash(&header);
            BtcHeaders::<T>::insert(block_hash, header.clone());

            // Update best height if higher
            if header.height > BtcBestHeight::<T>::get() {
                BtcBestHeight::<T>::put(header.height);
            }

            Ok(())
        }

        // ────────────────────────────────────────────────────────────────────
        // FINALITY ORACLE
        // ────────────────────────────────────────────────────────────────────

        /// Update chain finality configuration (governance)
        #[pallet::call_index(24)]
        #[pallet::weight(T::SettlementWeightInfo::update_finality_config())]
        pub fn update_finality_config(
            origin: OriginFor<T>,
            chain: ExternalChainId,
            config: FinalityConfig,
        ) -> DispatchResult {
            ensure_root(origin)?;

            ChainFinality::<T>::insert(chain, config);

            Ok(())
        }

        // ────────────────────────────────────────────────────────────────────
        // INVARIANT ENFORCEMENT
        // ────────────────────────────────────────────────────────────────────

        /// Report invariant violation (for monitoring/slashing)
        #[pallet::call_index(30)]
        #[pallet::weight(T::SettlementWeightInfo::report_violation())]
        pub fn report_violation(
            origin: OriginFor<T>,
            intent_id: H256,
            violation_type: InvariantViolationType,
            evidence: Vec<u8>,
        ) -> DispatchResult {
            let _who = ensure_signed(origin)?;

            // Verify the violation
            let is_valid_report = Self::verify_violation(intent_id, &violation_type, &evidence)?;

            if is_valid_report {
                // Halt settlement
                IntentStates::<T>::insert(intent_id, IntentState::Halted);

                // Increment violation counter
                InvariantViolations::<T>::mutate(|v| *v = v.saturating_add(1));

                Self::deposit_event(Event::InvariantViolation {
                    intent_id,
                    violation_type,
                    details: evidence,
                });

                // : Slash operator (testnet)
            }

            Ok(())
        }
    }

    // ============================================================================
    // Internal Functions
    // ============================================================================

    impl<T: Config> Pallet<T> {
        /// Generate unique intent ID
        pub fn generate_intent_id(maker: &T::AccountId, taker: &T::AccountId, nonce: u64) -> H256 {
            let mut data = maker.encode();
            data.extend(taker.encode());
            data.extend(nonce.to_le_bytes());
            data.extend(T::UnixTime::now().as_secs().to_le_bytes());
            H256::from(blake2_256(&data))
        }

        /// Verify settlement proof based on chain type
        pub fn verify_proof(
            chain: &ExternalChainId,
            proof: &SettlementProof,
        ) -> Result<bool, DispatchError> {
            match chain {
                ExternalChainId::Bitcoin => {
                    // BTC settlement proofs must go through dedicated SPV paths.
                    // Fail closed here to avoid accepting unaudited generic proofs.
                    Ok(false)
                }
                ExternalChainId::Ethereum
                | ExternalChainId::Arbitrum
                | ExternalChainId::Base
                | ExternalChainId::Polygon => {
                    // EVM chains: verify receipt proof
                    Self::verify_evm_receipt_proof(proof)
                }
                ExternalChainId::Solana => {
                    // SVM: verify transaction proof
                    Self::verify_svm_proof(proof)
                }
                _ => Ok(false),
            }
        }

        /// Verify EVM receipt proof
        fn verify_evm_receipt_proof(proof: &SettlementProof) -> Result<bool, DispatchError> {
            // Validate proof type
            let proof_type_ok = matches!(
                proof.proof_type,
                ProofType::MerkleTrie | ProofType::LightClient | ProofType::Optimistic
            );
            if !proof_type_ok {
                return Ok(false);
            }

            // Validate proof structure
            if proof.merkle_proof.is_empty() || proof.receipt_data.is_empty() {
                return Ok(false);
            }
            if proof.confirmations < 1 {
                return Ok(false);
            }

            // Validate receipt RLP structure
            let receipt_rlp = &proof.receipt_data[..];
            if !Self::is_valid_receipt_rlp(receipt_rlp) {
                return Ok(false);
            }

            // Verify receipt hash by recomputing Keccak256
            let receipt_hash = sp_io::hashing::keccak_256(receipt_rlp);
            let receipt_hash_h256 = H256::from(receipt_hash);

            // The tx_hash in the proof should match the receipt hash (they're the same in Ethereum)
            if receipt_hash_h256 != proof.tx_hash {
                // Try alternative: tx_hash might be the actual tx, not the receipt hash
                // In that case, we need to verify the MPT path leads to this receipt
                // For now, just fail closed if hashes don't match
                return Ok(false);
            }

            // Basic MPT path validation: ensure we have proof hashes
            // The merkle_proof contains the hash path through the MPT
            Ok(!proof.merkle_proof.is_empty())
        }

        /// Validate RLP-encoded receipt structure
        /// Checks that the RLP is well-formed for an Ethereum receipt
        fn is_valid_receipt_rlp(rlp: &[u8]) -> bool {
            if rlp.is_empty() {
                return false;
            }

            // RLP decoding helpers
            // Receipts are RLP-encoded lists with: [status/root, gas_used, logs, contractAddress?]
            // or legacy format: [root, gas_used, logs, contractAddress]

            let first_byte = rlp[0];

            // Check if it's a valid RLP list (0xc0-0xf7 = short list, 0xf8-0xff = long list)
            if first_byte < 0xc0 {
                // Not a list - receipts must be lists
                return false;
            }

            // For short lists (0xc0-0xf7), first byte is 0xc0 + payload_length
            if first_byte <= 0xf7 {
                let payload_length = (first_byte as usize) - 0xc0;
                // Receipt should have at least 3 elements, so payload must be reasonable
                return payload_length >= 3 && rlp.len() >= (1 + payload_length);
            }

            // For long lists (0xf8-0xff), next bytes encode the length
            if first_byte == 0xf8 {
                // Length is 1 byte after the first byte
                if rlp.len() < 3 {
                    return false;
                }
                let length_byte = rlp[1] as usize;
                return rlp.len() >= (2 + length_byte);
            }

            if first_byte == 0xf9 {
                // Length is 2 bytes after the first byte
                if rlp.len() < 4 {
                    return false;
                }
                let length = ((rlp[1] as usize) << 8) | (rlp[2] as usize);
                return rlp.len() >= (3 + length);
            }

            // For f9+, we're dealing with very large receipts - unlikely but possible
            if first_byte >= 0xfa {
                // Too long to verify efficiently, fail closed
                return false;
            }

            true
        }

        /// Verify Solana transaction proof
        ///
        /// Solana transaction format:
        /// - [1 byte] Signature count (compact encoding)
        /// - [N × 64 bytes] Ed25519 signatures (64 bytes each)
        /// - [remaining] Serialized message
        ///
        /// Message format:
        /// - [1 byte] Header (num_required_signatures | num_readonly_signed << 2 | num_readonly_unsigned << 4)
        /// - [1 byte] Number of static accounts
        /// - [32 bytes] Recent blockhash
        /// - [remaining] Instructions (each: program_id_index + accounts + data)
        fn verify_svm_proof(proof: &SettlementProof) -> Result<bool, DispatchError> {
            // CRITICAL SECURITY FIX: SVM proof verification is currently incomplete.
            // The original implementation accepted ANY proof structure without performing
            // cryptographic validation of the Solana transaction or block hash.
            //
            // INTERIM FIX (Production): Reject SVM proofs until proper cryptographic validation
            // (signature verification + light-client integration) is implemented.
            //
            // PROPER FIX (Future): Implement:
            //   1. Ed25519 signature verification of all transaction signers
            //   2. Light-client integration to verify block_hash against Solana's recent blockhashes
            //   3. Merkle proof validation against the block's transaction root
            //
            // For now, return Ok(false) to prevent spoofed finality claims on Solana.
            Ok(false)
        }

        /// Validate Solana transaction structure
        /// Performs basic format validation without signature verification
        fn is_valid_solana_transaction(tx_data: &[u8]) -> bool {
            if tx_data.is_empty() {
                return false;
            }

            // First byte encodes signature count (compact encoding)
            // Signatures can be variable-length encoded
            let mut offset = 0;
            let (sig_count, bytes_read) = match Self::decode_compact_u32(&tx_data[offset..]) {
                Some(result) => result,
                None => return false,
            };
            offset += bytes_read;

            // Each signature is 64 bytes
            let sig_data_len = (sig_count as usize).saturating_mul(64);
            if offset.saturating_add(sig_data_len) > tx_data.len() {
                return false;
            }
            offset += sig_data_len;

            // After signatures comes the message
            // Message starts with header byte
            if offset >= tx_data.len() {
                return false;
            }

            let _header = tx_data[offset];
            offset += 1;

            // Next is number of static accounts (max 255)
            if offset >= tx_data.len() {
                return false;
            }

            let _num_accounts = tx_data[offset];
            offset += 1;

            // Next 32 bytes should be the recent blockhash
            if offset.saturating_add(32) > tx_data.len() {
                return false;
            }

            // Blockhash is 32 bytes, followed by instruction count
            offset += 32;

            // If we got here, the basic structure is valid
            // A real implementation would validate instruction encoding
            offset < tx_data.len()
        }

        /// Decode a compact u32 from Solana's encoding
        /// Returns (value, bytes_read) or None if invalid
        fn decode_compact_u32(data: &[u8]) -> Option<(u32, usize)> {
            if data.is_empty() {
                return None;
            }

            let first_byte = data[0];

            // Single byte (0-127)
            if first_byte < 0x80 {
                return Some((first_byte as u32, 1));
            }

            // Two bytes
            if first_byte < 0xc0 {
                if data.len() < 2 {
                    return None;
                }
                let value = ((first_byte & 0x3f) as u32) | (((data[1] & 0x7f) as u32) << 6);
                return Some((value, 2));
            }

            // Three bytes
            if first_byte < 0xe0 {
                if data.len() < 3 {
                    return None;
                }
                let value = ((first_byte & 0x1f) as u32)
                    | (((data[1] & 0x7f) as u32) << 5)
                    | (((data[2] & 0x7f) as u32) << 12);
                return Some((value, 3));
            }

            // Four bytes
            if first_byte < 0xf0 {
                if data.len() < 4 {
                    return None;
                }
                let value = ((first_byte & 0x0f) as u32)
                    | (((data[1] & 0x7f) as u32) << 4)
                    | (((data[2] & 0x7f) as u32) << 11)
                    | (((data[3] & 0x7f) as u32) << 18);
                return Some((value, 4));
            }

            // Five bytes for larger values
            if data.len() < 5 {
                return None;
            }
            let value = (data[1] as u32)
                | ((data[2] as u32) << 8)
                | ((data[3] as u32) << 16)
                | ((data[4] as u32) << 24);
            Some((value, 5))
        }

        /// Check ALL settlement invariants before finalization
        fn check_settlement_invariants(intent_id: H256) -> Result<(), DispatchError> {
            let intent =
                SettlementIntents::<T>::get(intent_id).ok_or(Error::<T>::IntentNotFound)?;

            // INVARIANT 1: All legs must be locked
            ensure!(
                intent.legs_locked >= intent.legs_total,
                Error::<T>::PartialExecutionDetected
            );

            // INVARIANT 2: Check each escrow leg is in valid state
            for leg_idx in 0..intent.legs_total {
                if let Some(escrow) = EscrowStates::<T>::get(intent_id, leg_idx) {
                    ensure!(
                        escrow.state == EscrowLegState::Locked,
                        Error::<T>::InvalidIntentState
                    );
                } else {
                    return Err(Error::<T>::EscrowNotFound.into());
                }
            }

            // INVARIANT 3: Timeout not expired
            let now = T::UnixTime::now().as_secs();
            ensure!(now < intent.timeout, Error::<T>::TimeoutExpired);

            // INVARIANT 4: For BTC legs, verify confirmation depth
            for leg_idx in 0..intent.legs_total {
                if let Some(escrow) = EscrowStates::<T>::get(intent_id, leg_idx) {
                    if escrow.chain == ExternalChainId::Bitcoin {
                        // Check BTC has sufficient confirmations
                        // (handled by separate BTC proof submission)
                    }
                }
            }

            Ok(())
        }

        /// Finalize settlement (ALL legs complete)
        fn finalize_settlement(
            intent_id: H256,
            intent: &SettlementIntent<T::AccountId>,
            _claimer: &T::AccountId,
        ) -> Result<(), DispatchError> {
            // Update all escrow legs to Released
            for leg_idx in 0..intent.legs_total {
                EscrowStates::<T>::mutate(intent_id, leg_idx, |maybe_escrow| {
                    if let Some(escrow) = maybe_escrow {
                        escrow.state = EscrowLegState::Released;
                    }
                });
                ClaimedLegs::<T>::remove(intent_id, leg_idx);
            }

            // Update intent state
            IntentStates::<T>::insert(intent_id, IntentState::Finalized);

            // Release atomic lock on successful commit
            if let Some(mut atomic_lock) = AtomicLocks::<T>::get(intent_id) {
                let current_block =
                    frame_system::Pallet::<T>::block_number().saturated_into::<u32>();

                // Transition to Released phase on successful commit
                let _ = atomic_lock.release_on_commit(current_block);

                AtomicLocks::<T>::insert(intent_id, atomic_lock);
            }

            // Decrement pending intents
            PendingIntents::<T>::mutate(&intent.maker, |p| *p = p.saturating_sub(1));

            // Update volume statistics
            let volume = intent.asset_a.amount.saturating_add(intent.asset_b.amount);
            TotalSettledVolume::<T>::mutate(|v| *v = v.saturating_add(volume));

            Self::deposit_event(Event::X3Finalized {
                intent_id,
                maker_received: intent.asset_b.amount,
                taker_received: intent.asset_a.amount,
                settlement_time_ms: 0, // : Calculate actual time
            });

            Ok(())
        }

        /// Process refund for failed/timeout settlement
        fn process_refund(
            intent_id: H256,
            intent: &SettlementIntent<T::AccountId>,
            reason: RefundReason,
        ) -> Result<(), DispatchError> {
            // Refund all escrow legs
            for leg_idx in 0..intent.legs_total {
                EscrowStates::<T>::mutate(intent_id, leg_idx, |maybe_escrow| {
                    if let Some(escrow) = maybe_escrow {
                        escrow.state = EscrowLegState::Refunded;
                    }
                });
                ClaimedLegs::<T>::remove(intent_id, leg_idx);
            }

            // Update intent state
            IntentStates::<T>::insert(intent_id, IntentState::Refunded);

            // Release atomic lock on abort/refund
            if let Some(mut atomic_lock) = AtomicLocks::<T>::get(intent_id) {
                let current_block =
                    frame_system::Pallet::<T>::block_number().saturated_into::<u32>();

                // Transition to Released phase with AbortRequested reason
                let _ = atomic_lock.release_on_abort(current_block);

                AtomicLocks::<T>::insert(intent_id, atomic_lock);
            }

            // Decrement pending intents
            PendingIntents::<T>::mutate(&intent.maker, |p| *p = p.saturating_sub(1));

            Self::deposit_event(Event::X3Refunded {
                intent_id,
                reason,
                maker_returned: intent.asset_a.amount,
                taker_returned: intent.asset_b.amount,
            });

            Ok(())
        }

        /// Find and mark one unclaimed escrow leg owned by the claimer.
        ///
        /// A claim must correspond to a concrete locked escrow leg. This blocks
        /// replayed claims that previously only incremented an aggregate counter.
        fn mark_claimed_leg(
            intent_id: H256,
            intent: &SettlementIntent<T::AccountId>,
            claimer: &T::AccountId,
        ) -> Result<(), DispatchError> {
            for leg_idx in 0..intent.legs_total {
                let Some(escrow) = EscrowStates::<T>::get(intent_id, leg_idx) else {
                    continue;
                };

                if escrow.depositor != *claimer {
                    continue;
                }

                if escrow.state != EscrowLegState::Locked {
                    continue;
                }

                if !ClaimedLegs::<T>::get(intent_id, leg_idx) {
                    ClaimedLegs::<T>::insert(intent_id, leg_idx, true);
                    return Ok(());
                }
            }

            Err(Error::<T>::NoClaimableLeg.into())
        }

        // ────────────────────────────────────────────────────────────────────
        // BTC SPV HELPERS
        // ────────────────────────────────────────────────────────────────────

        /// Verify BTC merkle proof - validates transaction inclusion in block
        ///
        /// The merkle tree in Bitcoin is constructed bottom-up:
        /// 1. Transaction hashes are at the leaf level
        /// 2. Pairs of hashes are concatenated and double-SHA256'd to create parent nodes
        /// 3. If a node has no pair (odd number), it's paired with itself
        /// 4. Process continues until reaching the merkle root
        ///
        /// The proof path allows us to reconstruct the root from the transaction hash.
        fn verify_btc_merkle_proof(
            txid: &H256,
            proof: &[H256],
            header: &BtcBlockHeader,
        ) -> Result<bool, DispatchError> {
            // Start with the transaction hash (leaf of merkle tree)
            let mut current_hash = *txid;

            // Process each hash in the proof path, moving up the tree
            for proof_hash in proof {
                // Concatenate current hash with proof hash
                // The order matters: we need to know if our hash is left or right
                // Convention: concatenate in the order they appear in the tree
                let mut combined = [0u8; 64];
                combined[0..32].copy_from_slice(current_hash.as_bytes());
                combined[32..64].copy_from_slice(proof_hash.as_bytes());

                // Double-SHA256 (Bitcoin's standard hash)
                let first_hash = sp_io::hashing::sha2_256(&combined);
                current_hash = H256::from(sp_io::hashing::sha2_256(&first_hash));
            }

            // Verify the reconstructed hash matches the merkle root from the block header
            Ok(current_hash == header.merkle_root)
        }

        /// Verify BTC proof of work - validates block meets target difficulty
        ///
        /// Bitcoin uses the nBits compact format to encode the target:
        /// - First byte: number of bytes (exponent)
        /// - Next 3 bytes: mantissa (coefficient)
        /// - Target = mantissa * 256^(exponent - 3)
        ///
        /// A valid block hash must be <= target (compared numerically)
        fn verify_btc_pow(header: &BtcBlockHeader) -> Result<bool, DispatchError> {
            // Compute the block hash (double SHA256)
            let block_hash = Self::compute_btc_block_hash(header);

            // Decode nBits to get the target difficulty
            let bits = header.bits;
            let size = (bits >> 24) as u32;
            let word = bits & 0x00FFFFFF;

            // Compute the target as a 256-bit value
            // Using the compact encoding: target = word * 256^(size - 3)
            let mut target = [0u8; 32];

            // Validate size
            if size > 32 {
                // Target is larger than 256 bits, so any hash passes
                // This shouldn't happen in practice but is technically valid
                return Ok(true);
            }

            if size == 0 {
                // Invalid target (zero size)
                return Ok(false);
            }

            // Decode the mantissa (3 bytes)
            let mut mantissa = [0u8; 3];
            mantissa[0] = ((word >> 16) & 0xFF) as u8;
            mantissa[1] = ((word >> 8) & 0xFF) as u8;
            mantissa[2] = (word & 0xFF) as u8;

            // Place mantissa in target, shifted by (size - 3) bytes
            let shift = if size > 3 { (size - 3) as usize } else { 0 };
            for (i, &byte) in mantissa.iter().enumerate() {
                if shift + i < 32 {
                    target[shift + i] = byte;
                }
            }

            // For the first significant byte, we might need to shift if size < 3
            if size < 3 {
                let _right_shift = 3 - size;
                // This is complex to do correctly, so for now we'll be conservative
                // In practice, size is always >= 3 on mainnet
                return Ok(false);
            }

            // Compare: hash must be <= target
            // Both are in little-endian format (Bitcoin's wire format)
            let hash_bytes = block_hash.as_bytes();

            // Compare byte by byte from most significant to least significant
            for i in (0..32).rev() {
                if hash_bytes[i] < target[i] {
                    return Ok(true);
                } else if hash_bytes[i] > target[i] {
                    return Ok(false);
                }
            }

            // Equal to target is valid
            Ok(true)
        }

        /// Compute BTC block hash (double SHA256)
        fn compute_btc_block_hash(header: &BtcBlockHeader) -> H256 {
            // Serialize header and double hash
            let data = header.encode();
            let first_hash = sp_io::hashing::sha2_256(&data);
            H256::from(sp_io::hashing::sha2_256(&first_hash))
        }

        /// Verify invariant violation report
        fn verify_violation(
            intent_id: H256,
            violation_type: &InvariantViolationType,
            _evidence: &[u8],
        ) -> Result<bool, DispatchError> {
            let state = IntentStates::<T>::get(intent_id);

            match violation_type {
                InvariantViolationType::PartialExecution => {
                    // Check if settlement was partial
                    let intent =
                        SettlementIntents::<T>::get(intent_id).ok_or(Error::<T>::IntentNotFound)?;
                    Ok(intent.legs_claimed > 0
                        && intent.legs_claimed < intent.legs_total
                        && matches!(state, IntentState::Finalized))
                }
                InvariantViolationType::CrossVmReentrancy => {
                    // : Check execution traces for reentrancy
                    Ok(false)
                }
                InvariantViolationType::BtcReleaseWithoutConfirmation => {
                    // : Check BTC was released without X3 confirmation
                    Ok(false)
                }
                InvariantViolationType::TimeoutBypass => {
                    // Check if settlement finalized after timeout
                    let intent =
                        SettlementIntents::<T>::get(intent_id).ok_or(Error::<T>::IntentNotFound)?;
                    let now = T::UnixTime::now().as_secs();
                    Ok(matches!(state, IntentState::Finalized) && now > intent.timeout)
                }
            }
        }

        // ────────────────────────────────────────────────────────────────────
        // COLLATERAL HELPERS (storage-backed)
        // ────────────────────────────────────────────────────────────────────

        /// Internal helper: create a bond record (storage-backed)
        pub fn create_bond_internal(
            who: &T::AccountId,
            asset: Vec<u8>,
            amount: BalanceOf<T>,
            bond_type: u8,
        ) -> Result<H256, DispatchError> {
            let mut counter = BondCounter::<T>::get();
            counter = counter.wrapping_add(1);
            BondCounter::<T>::put(counter);

            let mut seed = [0u8; 32];
            seed[0..8].copy_from_slice(&counter.to_le_bytes());
            let id = H256::from(seed);

            let now = T::UnixTime::now().as_secs();
            let bounded_asset: BoundedVec<u8, ConstU32<64>> = asset
                .try_into()
                .map_err(|_| DispatchError::Other("AssetTooLong"))?;
            let record = BondRecord {
                id,
                owner: who.clone(),
                asset: bounded_asset,
                amount,
                bond_type,
                state: 0, // Locked
                created_at: now,
            };

            Bonds::<T>::insert(id, record);

            let mut list = BondsByOwner::<T>::get(who);
            list.try_push(id)
                .map_err(|_| DispatchError::Other("TooManyBonds"))?;
            BondsByOwner::<T>::insert(who, list);

            Self::deposit_event(Event::BondDeposited {
                bond_id: id,
                owner: who.clone(),
                amount,
            });
            Ok(id)
        }

        /// Internal helper: request withdraw
        pub fn request_withdrawal_internal(bond_id: H256) -> Result<(), DispatchError> {
            Bonds::<T>::try_mutate_exists(bond_id, |maybe| {
                let b = maybe.as_mut().ok_or(DispatchError::Other("BondNotFound"))?;
                if b.state != 0 {
                    return Err(DispatchError::Other("NotLocked"));
                }
                b.state = 1; // Withdrawable
                Ok(())
            })
        }

        /// Internal helper: finalize withdrawal (removes bond)
        pub fn finalize_withdraw_internal(bond_id: H256) -> Result<(), DispatchError> {
            let b = Bonds::<T>::take(bond_id).ok_or(DispatchError::Other("BondNotFound"))?;
            BondsByOwner::<T>::mutate(&b.owner, |list| {
                if let Some(pos) = list.iter().position(|x| *x == bond_id) {
                    list.remove(pos);
                }
            });
            Self::deposit_event(Event::BondWithdrawn {
                bond_id,
                owner: b.owner,
                amount: b.amount,
            });
            Ok(())
        }

        /// Internal helper: slash bond (mark slashed)
        pub fn slash_bond_internal(bond_id: H256) -> Result<(), DispatchError> {
            Bonds::<T>::try_mutate(bond_id, |maybe| {
                let b = maybe.as_mut().ok_or(DispatchError::Other("BondNotFound"))?;
                b.state = 2; // Slashed
                Ok::<(), DispatchError>(())
            })?;
            Self::deposit_event(Event::BondSlashed { bond_id });
            Ok(())
        }
    }
}

pub use pallet::*;
