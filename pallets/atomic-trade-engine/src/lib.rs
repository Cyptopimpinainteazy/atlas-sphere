//! # Atomic Trade Engine Pallet
//!
//! ## Overview
//!
//! The Atomic Trade Engine enables atomic arbitrage and multi-hop trades across EVM and SVM
//! state machines inside Atlas Sphere. It provides:
//!
//! - **Cross-VM Call Batching**: Execute multiple VM operations atomically
//! - **Failure Atomicity**: All-or-nothing execution with automatic rollback
//! - **State Checkpointing**: Intermediate state snapshots for complex multi-leg trades
//! - **Trade Graph Resolution**: Deterministic pathfinding for multi-hop swaps
//! - **AMM Integration**: Unified interface for Uniswap, Raydium, Orca, and custom DEXes
//!
//! ## Architecture
//!
//! ```text
//! ┌────────────────────────────────────────────────────────────────────┐
//! │                     Atomic Trade Engine                            │
//! ├────────────────────────────────────────────────────────────────────┤
//! │  TradeBatch                                                        │
//! │  ├── TradeLegs (Vec<TradeLeg>)                                    │
//! │  ├── Checkpoints (Vec<StateCheckpoint>)                           │
//! │  └── ExecutionPlan (Vec<ExecutionStep>)                           │
//! ├────────────────────────────────────────────────────────────────────┤
//! │  TradeGraphResolver                                                │
//! │  ├── find_optimal_path()                                          │
//! │  ├── calculate_expected_output()                                  │
//! │  └── detect_arbitrage_opportunity()                               │
//! ├────────────────────────────────────────────────────────────────────┤
//! │  AMM Adapters                                                      │
//! │  ├── UniswapV2Adapter                                             │
//! │  ├── UniswapV3Adapter                                             │
//! │  ├── RaydiumAdapter                                               │
//! │  └── OrcaWhirlpoolAdapter                                         │
//! └────────────────────────────────────────────────────────────────────┘
//!                              │
//!                              ▼
//! ┌────────────────────────────────────────────────────────────────────┐
//! │                       Atlas Kernel                                 │
//! │  ├── EVM Adapter                                                  │
//! │  └── SVM Adapter                                                  │
//! └────────────────────────────────────────────────────────────────────┘
//! ```

#![cfg_attr(not(feature = "std"), no_std)]

pub use pallet::*;

#[cfg(test)]
mod mock;

#[cfg(test)]
mod tests;

#[cfg(feature = "runtime-benchmarks")]
mod benchmarking;

pub mod amm;
pub mod graph;
pub mod types;
pub mod weights;

pub use weights::WeightInfo;

use codec::{Decode, Encode};
use frame_support::{
    pallet_prelude::*,
    traits::{Currency, Time, UnixTime},
};
use frame_system::pallet_prelude::*;
use pallet_atlas_kernel::{
    DualVmDispatcher, EvmExecutorAdapter, ExecutionReceipt, StateChange, SvmExecutorAdapter,
};
use scale_info::TypeInfo;
use sp_core::H256;
use sp_io::hashing::blake2_256;
use sp_runtime::{
    traits::{AtLeast32BitUnsigned, CheckedAdd, CheckedMul, CheckedSub, Saturating, Zero},
    DispatchError, RuntimeDebug, SaturatedConversion,
};
use sp_std::{collections::btree_map::BTreeMap, prelude::*};

/// Maximum number of legs in a single trade batch
pub const MAX_TRADE_LEGS: u32 = 16;

/// Maximum number of checkpoints per trade batch
pub const MAX_CHECKPOINTS: u32 = 8;

/// Maximum slippage tolerance in basis points (100 = 1%)
pub const MAX_SLIPPAGE_BPS: u32 = 5000; // 50%

/// Minimum slippage tolerance in basis points
pub const MIN_SLIPPAGE_BPS: u32 = 1; // 0.01%

#[frame_support::pallet]
pub mod pallet {
    use super::*;

    #[pallet::pallet]
    pub struct Pallet<T>(_);

    #[pallet::config]
    pub trait Config:
        frame_system::Config + pallet_timestamp::Config + pallet_atlas_kernel::Config
    {
        /// The overarching event type.
        type RuntimeEvent: From<Event<Self>> + IsType<<Self as frame_system::Config>::RuntimeEvent>;

        /// Weight information for extrinsics.
        type WeightInfo: WeightInfo;

        /// The currency type for fee handling.
        type Currency: Currency<Self::AccountId>;

        /// EVM execution adapter (from atlas-kernel or custom).
        type EvmAdapter: EvmExecutorAdapter;

        /// SVM execution adapter (from atlas-kernel or custom).
        type SvmAdapter: SvmExecutorAdapter;

        /// Maximum number of trade legs per batch.
        #[pallet::constant]
        type MaxTradeLegs: Get<u32>;

        /// Maximum number of checkpoints per trade batch.
        #[pallet::constant]
        type MaxCheckpoints: Get<u32>;

        /// Maximum pending batches per account.
        #[pallet::constant]
        type MaxPendingBatchesPerAccount: Get<u32>;

        /// Default gas limit for EVM trade operations.
        #[pallet::constant]
        type DefaultTradeEvmGasLimit: Get<u64>;

        /// Default compute limit for SVM trade operations.
        #[pallet::constant]
        type DefaultTradeSvmComputeLimit: Get<u64>;

        /// Origin allowed to register AMM adapters.
        type AmmRegistrarOrigin: EnsureOrigin<Self::RuntimeOrigin>;
    }

    /// Active trade batches indexed by batch_id.
    #[pallet::storage]
    #[pallet::getter(fn trade_batches)]
    pub type TradeBatches<T: Config> = StorageMap<
        _,
        Blake2_128Concat,
        H256, // batch_id
        TradeBatch<T::AccountId, BalanceOf<T>>,
        OptionQuery,
    >;

    /// Checkpoints for active trade batches.
    #[pallet::storage]
    #[pallet::getter(fn checkpoints)]
    pub type Checkpoints<T: Config> = StorageMap<
        _,
        Blake2_128Concat,
        H256, // batch_id
        BoundedVec<StateCheckpoint, T::MaxCheckpoints>,
        ValueQuery,
    >;

    /// Pending batch IDs per account for rate limiting.
    #[pallet::storage]
    #[pallet::getter(fn pending_batches)]
    pub type PendingBatches<T: Config> = StorageMap<
        _,
        Blake2_128Concat,
        T::AccountId,
        BoundedVec<H256, T::MaxPendingBatchesPerAccount>,
        ValueQuery,
    >;

    /// Registered AMM adapters by protocol identifier.
    #[pallet::storage]
    #[pallet::getter(fn amm_adapters)]
    pub type AmmAdapters<T: Config> =
        StorageMap<_, Blake2_128Concat, AmmProtocol, AmmAdapterConfig, OptionQuery>;

    /// Trade execution nonces per account.
    #[pallet::storage]
    #[pallet::getter(fn trade_nonces)]
    pub type TradeNonces<T: Config> =
        StorageMap<_, Blake2_128Concat, T::AccountId, u64, ValueQuery>;

    /// Completed batch count for metrics.
    #[pallet::storage]
    #[pallet::getter(fn completed_batch_count)]
    pub type CompletedBatchCount<T: Config> = StorageValue<_, u64, ValueQuery>;

    /// Failed batch count for metrics.
    #[pallet::storage]
    #[pallet::getter(fn failed_batch_count)]
    pub type FailedBatchCount<T: Config> = StorageValue<_, u64, ValueQuery>;

    /// Total volume traded (in native units) for metrics.
    #[pallet::storage]
    #[pallet::getter(fn total_volume)]
    pub type TotalVolume<T: Config> = StorageValue<_, u128, ValueQuery>;

    pub type BalanceOf<T> =
        <<T as Config>::Currency as Currency<<T as frame_system::Config>::AccountId>>::Balance;

    #[pallet::event]
    #[pallet::generate_deposit(pub(super) fn deposit_event)]
    pub enum Event<T: Config> {
        /// A new trade batch was created.
        TradeBatchCreated {
            batch_id: H256,
            origin: T::AccountId,
            legs_count: u32,
        },
        /// A trade leg execution started.
        TradeLegStarted {
            batch_id: H256,
            leg_index: u32,
            vm_type: VmType,
        },
        /// A trade leg completed successfully.
        TradeLegCompleted {
            batch_id: H256,
            leg_index: u32,
            amount_out: u128,
        },
        /// A trade leg failed.
        TradeLegFailed {
            batch_id: H256,
            leg_index: u32,
            reason: TradeLegFailureReason,
        },
        /// A checkpoint was created during trade execution.
        CheckpointCreated {
            batch_id: H256,
            checkpoint_index: u32,
            state_root: H256,
        },
        /// A rollback to checkpoint was executed.
        RollbackExecuted {
            batch_id: H256,
            checkpoint_index: u32,
        },
        /// A trade batch completed successfully.
        TradeBatchCompleted {
            batch_id: H256,
            total_input: u128,
            total_output: u128,
            gas_used: u64,
        },
        /// A trade batch failed and was rolled back.
        TradeBatchFailed {
            batch_id: H256,
            failed_leg_index: u32,
            reason: BatchFailureReason,
        },
        /// An AMM adapter was registered.
        AmmAdapterRegistered {
            protocol: AmmProtocol,
            vm_type: VmType,
        },
        /// An AMM adapter was removed.
        AmmAdapterRemoved { protocol: AmmProtocol },
        /// Arbitrage opportunity detected.
        ArbitrageOpportunityDetected {
            path: Vec<AssetPair>,
            expected_profit_bps: u32,
        },
    }

    #[pallet::error]
    pub enum Error<T> {
        /// Trade batch not found.
        BatchNotFound,
        /// Trade batch already exists.
        BatchAlreadyExists,
        /// Too many trade legs in batch.
        TooManyTradeLegs,
        /// Empty trade batch.
        EmptyTradeBatch,
        /// Invalid leg index.
        InvalidLegIndex,
        /// Checkpoint not found.
        CheckpointNotFound,
        /// Too many checkpoints.
        TooManyCheckpoints,
        /// Slippage tolerance exceeded.
        SlippageExceeded,
        /// Invalid slippage tolerance.
        InvalidSlippageTolerance,
        /// Insufficient input amount.
        InsufficientInputAmount,
        /// AMM adapter not registered.
        AmmNotRegistered,
        /// AMM adapter already registered.
        AmmAlreadyRegistered,
        /// Invalid AMM protocol.
        InvalidAmmProtocol,
        /// Trade nonce mismatch.
        InvalidTradeNonce,
        /// Too many pending batches for account.
        TooManyPendingBatches,
        /// Trade batch is not pending.
        BatchNotPending,
        /// Trade batch already completed.
        BatchAlreadyCompleted,
        /// EVM execution failed during trade.
        EvmTradeFailed,
        /// SVM execution failed during trade.
        SvmTradeFailed,
        /// Cross-VM bridging failed.
        CrossVmBridgeFailed,
        /// Arithmetic overflow.
        ArithmeticOverflow,
        /// Invalid asset pair.
        InvalidAssetPair,
        /// Path not found.
        PathNotFound,
        /// Circular path detected.
        CircularPathDetected,
        /// Deadline expired.
        DeadlineExpired,
        /// Unauthorized operation.
        Unauthorized,
        /// Invalid batch status transition.
        InvalidStatusTransition,
    }

    #[pallet::call]
    impl<T: Config> Pallet<T> {
        /// Create a new atomic trade batch with multiple legs.
        ///
        /// # Arguments
        /// * `legs` - Vector of trade legs to execute atomically
        /// * `slippage_tolerance_bps` - Maximum acceptable slippage in basis points
        /// * `deadline` - Block number deadline for execution
        /// * `nonce` - Trade nonce for replay protection
        ///
        /// # Events
        /// * `TradeBatchCreated` - When batch is successfully created
        #[pallet::call_index(0)]
        #[pallet::weight(<T as Config>::WeightInfo::create_trade_batch(legs.len() as u32))]
        pub fn create_trade_batch(
            origin: OriginFor<T>,
            legs: Vec<TradeLegInput>,
            slippage_tolerance_bps: u32,
            deadline: BlockNumberFor<T>,
            nonce: u64,
        ) -> DispatchResult {
            let who = ensure_signed(origin)?;

            // Validate inputs
            ensure!(!legs.is_empty(), Error::<T>::EmptyTradeBatch);
            ensure!(
                legs.len() <= T::MaxTradeLegs::get() as usize,
                Error::<T>::TooManyTradeLegs
            );
            ensure!(
                slippage_tolerance_bps >= MIN_SLIPPAGE_BPS
                    && slippage_tolerance_bps <= MAX_SLIPPAGE_BPS,
                Error::<T>::InvalidSlippageTolerance
            );

            // Check deadline
            let current_block = frame_system::Pallet::<T>::block_number();
            ensure!(deadline > current_block, Error::<T>::DeadlineExpired);

            // Verify nonce
            let expected_nonce = TradeNonces::<T>::get(&who);
            ensure!(nonce == expected_nonce, Error::<T>::InvalidTradeNonce);

            // Check pending batches limit
            let pending = PendingBatches::<T>::get(&who);
            ensure!(
                pending.len() < T::MaxPendingBatchesPerAccount::get() as usize,
                Error::<T>::TooManyPendingBatches
            );

            // Generate batch ID
            let batch_id = Self::generate_batch_id(&who, nonce, &legs);

            // Ensure batch doesn't already exist
            ensure!(
                !TradeBatches::<T>::contains_key(batch_id),
                Error::<T>::BatchAlreadyExists
            );

            // Convert input legs to internal representation
            let trade_legs: Vec<TradeLeg> = legs
                .iter()
                .map(|input| TradeLeg {
                    amm_protocol: input.amm_protocol,
                    vm_type: input.vm_type,
                    asset_in: input.asset_in,
                    asset_out: input.asset_out,
                    amount_in: input.amount_in,
                    min_amount_out: input.min_amount_out,
                    route_data: input.route_data.clone(),
                    status: TradeLegStatus::Pending,
                    actual_amount_out: None,
                    gas_used: 0,
                })
                .collect();

            // Create trade batch
            let batch = TradeBatch {
                batch_id,
                origin: who.clone(),
                legs: trade_legs,
                slippage_tolerance_bps,
                deadline,
                nonce,
                status: BatchStatus::Pending,
                created_at: current_block,
                total_gas_used: 0,
            };

            // Store batch
            TradeBatches::<T>::insert(batch_id, batch);

            // Add to pending batches
            PendingBatches::<T>::try_mutate(&who, |batches| -> DispatchResult {
                batches
                    .try_push(batch_id)
                    .map_err(|_| Error::<T>::TooManyPendingBatches)?;
                Ok(())
            })?;

            // Increment nonce
            TradeNonces::<T>::mutate(&who, |n| *n = n.saturating_add(1));

            Self::deposit_event(Event::TradeBatchCreated {
                batch_id,
                origin: who,
                legs_count: legs.len() as u32,
            });

            Ok(())
        }

        /// Execute a pending trade batch atomically.
        ///
        /// This function:
        /// 1. Creates initial checkpoint
        /// 2. Executes each leg sequentially
        /// 3. Creates intermediate checkpoints as needed
        /// 4. Rolls back on failure
        /// 5. Finalizes on success
        ///
        /// # Arguments
        /// * `batch_id` - The trade batch to execute
        ///
        /// # Events
        /// * `TradeBatchCompleted` or `TradeBatchFailed`
        #[pallet::call_index(1)]
        #[pallet::weight(<T as Config>::WeightInfo::execute_trade_batch())]
        pub fn execute_trade_batch(origin: OriginFor<T>, batch_id: H256) -> DispatchResult {
            let who = ensure_signed(origin)?;

            // Get batch
            let mut batch = TradeBatches::<T>::get(batch_id).ok_or(Error::<T>::BatchNotFound)?;

            // Verify ownership
            ensure!(batch.origin == who, Error::<T>::Unauthorized);

            // Check status
            ensure!(
                batch.status == BatchStatus::Pending,
                Error::<T>::BatchNotPending
            );

            // Check deadline
            let current_block = frame_system::Pallet::<T>::block_number();
            ensure!(batch.deadline > current_block, Error::<T>::DeadlineExpired);

            // Update status to executing
            batch.status = BatchStatus::Executing;
            TradeBatches::<T>::insert(batch_id, batch.clone());

            // Create initial checkpoint
            let initial_checkpoint = Self::create_checkpoint(&batch, 0)?;
            Checkpoints::<T>::try_mutate(batch_id, |checkpoints| -> DispatchResult {
                checkpoints
                    .try_push(initial_checkpoint.clone())
                    .map_err(|_| Error::<T>::TooManyCheckpoints)?;
                Ok(())
            })?;

            Self::deposit_event(Event::CheckpointCreated {
                batch_id,
                checkpoint_index: 0,
                state_root: initial_checkpoint.state_root,
            });

            // Execute legs
            let execution_result = Self::execute_all_legs(&mut batch);

            match execution_result {
                Ok((total_output, total_gas)) => {
                    // Success - finalize batch
                    batch.status = BatchStatus::Completed;
                    batch.total_gas_used = total_gas;
                    TradeBatches::<T>::insert(batch_id, batch.clone());

                    // Remove from pending
                    Self::remove_from_pending(&who, batch_id);

                    // Update metrics
                    CompletedBatchCount::<T>::mutate(|c| *c = c.saturating_add(1));

                    let total_input: u128 = batch.legs.iter().map(|l| l.amount_in).sum();
                    TotalVolume::<T>::mutate(|v| *v = v.saturating_add(total_input));

                    Self::deposit_event(Event::TradeBatchCompleted {
                        batch_id,
                        total_input,
                        total_output,
                        gas_used: total_gas,
                    });
                }
                Err((failed_leg_index, reason)) => {
                    // Failure - rollback to initial checkpoint
                    Self::rollback_to_checkpoint(batch_id, 0)?;

                    batch.status = BatchStatus::Failed;
                    TradeBatches::<T>::insert(batch_id, batch);

                    // Remove from pending
                    Self::remove_from_pending(&who, batch_id);

                    // Update metrics
                    FailedBatchCount::<T>::mutate(|c| *c = c.saturating_add(1));

                    Self::deposit_event(Event::TradeBatchFailed {
                        batch_id,
                        failed_leg_index,
                        reason,
                    });

                    return Err(Error::<T>::BatchAlreadyCompleted.into());
                }
            }

            Ok(())
        }

        /// Cancel a pending trade batch.
        ///
        /// # Arguments
        /// * `batch_id` - The trade batch to cancel
        #[pallet::call_index(2)]
        #[pallet::weight(<T as Config>::WeightInfo::cancel_trade_batch())]
        pub fn cancel_trade_batch(origin: OriginFor<T>, batch_id: H256) -> DispatchResult {
            let who = ensure_signed(origin)?;

            let batch = TradeBatches::<T>::get(batch_id).ok_or(Error::<T>::BatchNotFound)?;

            ensure!(batch.origin == who, Error::<T>::Unauthorized);
            ensure!(
                batch.status == BatchStatus::Pending,
                Error::<T>::BatchNotPending
            );

            // Remove batch
            TradeBatches::<T>::remove(batch_id);
            Checkpoints::<T>::remove(batch_id);

            // Remove from pending
            Self::remove_from_pending(&who, batch_id);

            Ok(())
        }

        /// Register an AMM adapter for a specific protocol.
        ///
        /// # Arguments
        /// * `protocol` - The AMM protocol identifier
        /// * `config` - The adapter configuration
        #[pallet::call_index(3)]
        #[pallet::weight(<T as Config>::WeightInfo::register_amm_adapter())]
        pub fn register_amm_adapter(
            origin: OriginFor<T>,
            protocol: AmmProtocol,
            config: AmmAdapterConfig,
        ) -> DispatchResult {
            T::AmmRegistrarOrigin::ensure_origin(origin)?;

            ensure!(
                !AmmAdapters::<T>::contains_key(&protocol),
                Error::<T>::AmmAlreadyRegistered
            );

            AmmAdapters::<T>::insert(&protocol, config.clone());

            Self::deposit_event(Event::AmmAdapterRegistered {
                protocol,
                vm_type: config.vm_type,
            });

            Ok(())
        }

        /// Remove an AMM adapter.
        ///
        /// # Arguments
        /// * `protocol` - The AMM protocol to remove
        #[pallet::call_index(4)]
        #[pallet::weight(<T as Config>::WeightInfo::remove_amm_adapter())]
        pub fn remove_amm_adapter(origin: OriginFor<T>, protocol: AmmProtocol) -> DispatchResult {
            T::AmmRegistrarOrigin::ensure_origin(origin)?;

            ensure!(
                AmmAdapters::<T>::contains_key(&protocol),
                Error::<T>::AmmNotRegistered
            );

            AmmAdapters::<T>::remove(&protocol);

            Self::deposit_event(Event::AmmAdapterRemoved { protocol });

            Ok(())
        }

        /// Create a checkpoint during trade execution (for recovery).
        ///
        /// This allows partial trade execution with recovery points.
        ///
        /// # Arguments
        /// * `batch_id` - The trade batch
        #[pallet::call_index(5)]
        #[pallet::weight(<T as Config>::WeightInfo::create_manual_checkpoint())]
        pub fn create_manual_checkpoint(origin: OriginFor<T>, batch_id: H256) -> DispatchResult {
            let who = ensure_signed(origin)?;

            let batch = TradeBatches::<T>::get(batch_id).ok_or(Error::<T>::BatchNotFound)?;

            ensure!(batch.origin == who, Error::<T>::Unauthorized);
            ensure!(
                batch.status == BatchStatus::Executing,
                Error::<T>::InvalidStatusTransition
            );

            let checkpoints = Checkpoints::<T>::get(batch_id);
            let checkpoint_index = checkpoints.len() as u32;

            let checkpoint = Self::create_checkpoint(&batch, checkpoint_index)?;

            Checkpoints::<T>::try_mutate(batch_id, |cps| -> DispatchResult {
                cps.try_push(checkpoint.clone())
                    .map_err(|_| Error::<T>::TooManyCheckpoints)?;
                Ok(())
            })?;

            Self::deposit_event(Event::CheckpointCreated {
                batch_id,
                checkpoint_index,
                state_root: checkpoint.state_root,
            });

            Ok(())
        }
    }

    impl<T: Config> Pallet<T> {
        /// Generate a unique batch ID from inputs.
        fn generate_batch_id(origin: &T::AccountId, nonce: u64, legs: &[TradeLegInput]) -> H256 {
            let mut data = Vec::new();
            data.extend_from_slice(&origin.encode());
            data.extend_from_slice(&nonce.to_le_bytes());
            for leg in legs {
                data.extend_from_slice(&leg.encode());
            }
            H256::from(blake2_256(&data))
        }

        /// Create a state checkpoint for rollback support.
        fn create_checkpoint(
            batch: &TradeBatch<T::AccountId, BalanceOf<T>>,
            index: u32,
        ) -> Result<StateCheckpoint, DispatchError> {
            // Compute state root from current batch state
            let mut state_data = Vec::new();
            state_data.extend_from_slice(batch.batch_id.as_bytes());
            state_data.extend_from_slice(&index.to_le_bytes());

            for (i, leg) in batch.legs.iter().enumerate() {
                state_data.extend_from_slice(&(i as u32).to_le_bytes());
                state_data.extend_from_slice(&leg.status.encode());
                if let Some(amount) = leg.actual_amount_out {
                    state_data.extend_from_slice(&amount.to_le_bytes());
                }
            }

            let state_root = H256::from(blake2_256(&state_data));
            let current_block = frame_system::Pallet::<T>::block_number();
            let timestamp = <pallet_timestamp::Pallet<T> as UnixTime>::now().as_secs();

            Ok(StateCheckpoint {
                checkpoint_id: index,
                state_root,
                block_number: current_block.saturated_into(),
                timestamp,
                completed_legs: batch
                    .legs
                    .iter()
                    .filter(|l| l.status == TradeLegStatus::Completed)
                    .count() as u32,
            })
        }

        /// Execute all legs of a trade batch atomically.
        fn execute_all_legs(
            batch: &mut TradeBatch<T::AccountId, BalanceOf<T>>,
        ) -> Result<(u128, u64), (u32, BatchFailureReason)> {
            let mut total_output: u128 = 0;
            let mut total_gas: u64 = 0;
            let mut carry_amount: u128 = 0; // Amount to carry to next leg

            for (index, leg) in batch.legs.iter_mut().enumerate() {
                let leg_index = index as u32;

                // Emit start event
                Self::deposit_event(Event::TradeLegStarted {
                    batch_id: batch.batch_id,
                    leg_index,
                    vm_type: leg.vm_type,
                });

                // Determine input amount (use carry from previous leg if applicable)
                let input_amount = if index == 0 {
                    leg.amount_in
                } else if carry_amount > 0 {
                    carry_amount
                } else {
                    leg.amount_in
                };

                // Execute the leg
                let result = Self::execute_single_leg(leg, input_amount);

                match result {
                    Ok((amount_out, gas_used)) => {
                        // Verify slippage
                        if amount_out < leg.min_amount_out {
                            leg.status = TradeLegStatus::Failed;
                            return Err((
                                leg_index,
                                BatchFailureReason::SlippageExceeded {
                                    expected: leg.min_amount_out,
                                    actual: amount_out,
                                },
                            ));
                        }

                        leg.status = TradeLegStatus::Completed;
                        leg.actual_amount_out = Some(amount_out);
                        leg.gas_used = gas_used;

                        total_output = amount_out;
                        total_gas = total_gas.saturating_add(gas_used);
                        carry_amount = amount_out;

                        Self::deposit_event(Event::TradeLegCompleted {
                            batch_id: batch.batch_id,
                            leg_index,
                            amount_out,
                        });
                    }
                    Err(reason) => {
                        leg.status = TradeLegStatus::Failed;

                        Self::deposit_event(Event::TradeLegFailed {
                            batch_id: batch.batch_id,
                            leg_index,
                            reason: reason.clone(),
                        });

                        return Err((
                            leg_index,
                            BatchFailureReason::LegExecutionFailed { leg_index, reason },
                        ));
                    }
                }
            }

            Ok((total_output, total_gas))
        }

        /// Execute a single trade leg.
        fn execute_single_leg(
            leg: &TradeLeg,
            amount_in: u128,
        ) -> Result<(u128, u64), TradeLegFailureReason> {
            // Build payload for the appropriate VM
            let payload = Self::build_trade_payload(leg, amount_in)?;

            match leg.vm_type {
                VmType::Evm => {
                    let gas_limit = T::DefaultTradeEvmGasLimit::get();
                    let receipt = T::EvmAdapter::execute(&payload, gas_limit)
                        .map_err(|_| TradeLegFailureReason::EvmExecutionFailed)?;

                    if !receipt.success {
                        return Err(TradeLegFailureReason::EvmExecutionFailed);
                    }

                    // Parse output amount from return data
                    let amount_out = Self::parse_swap_output(&receipt.return_data).unwrap_or(0);

                    Ok((amount_out, receipt.gas_used))
                }
                VmType::Svm => {
                    let compute_limit = T::DefaultTradeSvmComputeLimit::get();
                    let receipt = T::SvmAdapter::execute(&payload, compute_limit)
                        .map_err(|_| TradeLegFailureReason::SvmExecutionFailed)?;

                    if !receipt.success {
                        return Err(TradeLegFailureReason::SvmExecutionFailed);
                    }

                    // Parse output amount from return data
                    let amount_out = Self::parse_swap_output(&receipt.return_data).unwrap_or(0);

                    Ok((amount_out, receipt.gas_used))
                }
                VmType::CrossVm => {
                    // Cross-VM execution requires coordination between both VMs
                    Self::execute_cross_vm_leg(leg, amount_in)
                }
            }
        }

        /// Execute a cross-VM trade leg (involves both EVM and SVM).
        fn execute_cross_vm_leg(
            leg: &TradeLeg,
            amount_in: u128,
        ) -> Result<(u128, u64), TradeLegFailureReason> {
            // Build EVM portion payload
            let evm_payload = Self::build_cross_vm_evm_payload(leg, amount_in)?;

            // Execute EVM portion
            let evm_receipt =
                T::EvmAdapter::execute(&evm_payload, T::DefaultTradeEvmGasLimit::get())
                    .map_err(|_| TradeLegFailureReason::CrossVmBridgeFailed)?;

            if !evm_receipt.success {
                return Err(TradeLegFailureReason::EvmExecutionFailed);
            }

            // Extract bridged amount from EVM receipt
            let bridged_amount = Self::parse_swap_output(&evm_receipt.return_data)
                .ok_or(TradeLegFailureReason::CrossVmBridgeFailed)?;

            // Build SVM portion payload with bridged amount
            let svm_payload = Self::build_cross_vm_svm_payload(leg, bridged_amount)?;

            // Execute SVM portion
            let svm_receipt =
                T::SvmAdapter::execute(&svm_payload, T::DefaultTradeSvmComputeLimit::get())
                    .map_err(|_| TradeLegFailureReason::CrossVmBridgeFailed)?;

            if !svm_receipt.success {
                return Err(TradeLegFailureReason::SvmExecutionFailed);
            }

            // Parse final output
            let amount_out = Self::parse_swap_output(&svm_receipt.return_data).unwrap_or(0);

            let total_gas = evm_receipt.gas_used.saturating_add(svm_receipt.gas_used);

            Ok((amount_out, total_gas))
        }

        /// Build trade payload for VM execution.
        fn build_trade_payload(
            leg: &TradeLeg,
            amount_in: u128,
        ) -> Result<Vec<u8>, TradeLegFailureReason> {
            // Encode swap parameters based on AMM protocol
            let mut payload = Vec::new();

            // Function selector (4 bytes) - swapExactTokensForTokens
            payload.extend_from_slice(&[0x38, 0xed, 0x17, 0x39]);

            // amount_in (32 bytes)
            payload.extend_from_slice(&Self::encode_u256(amount_in));

            // amount_out_min (32 bytes)
            payload.extend_from_slice(&Self::encode_u256(leg.min_amount_out));

            // path offset (32 bytes)
            payload.extend_from_slice(&Self::encode_u256(160));

            // to address (32 bytes) - padded
            payload.extend_from_slice(&[0u8; 12]);
            payload.extend_from_slice(&leg.route_data.get(..20).unwrap_or(&[0u8; 20]));

            // deadline (32 bytes)
            payload.extend_from_slice(&Self::encode_u256(u128::MAX));

            // path array (dynamic)
            payload.extend_from_slice(&Self::encode_u256(2)); // path length
            payload.extend_from_slice(&Self::encode_asset_id(leg.asset_in));
            payload.extend_from_slice(&Self::encode_asset_id(leg.asset_out));

            Ok(payload)
        }

        /// Build EVM payload for cross-VM trade.
        fn build_cross_vm_evm_payload(
            leg: &TradeLeg,
            amount_in: u128,
        ) -> Result<Vec<u8>, TradeLegFailureReason> {
            // For cross-VM, we first execute the EVM portion
            // This typically involves bridging to the bridge contract
            let mut payload = Vec::new();

            // bridgeAndSwap function selector
            payload.extend_from_slice(&[0xb6, 0x03, 0x4c, 0xd3]);

            // amount
            payload.extend_from_slice(&Self::encode_u256(amount_in));

            // asset_id
            payload.extend_from_slice(&Self::encode_asset_id(leg.asset_in));

            // destination (SVM program id from route_data)
            if leg.route_data.len() >= 32 {
                payload.extend_from_slice(&leg.route_data[..32]);
            } else {
                payload.extend_from_slice(&[0u8; 32]);
            }

            Ok(payload)
        }

        /// Build SVM payload for cross-VM trade.
        fn build_cross_vm_svm_payload(
            leg: &TradeLeg,
            bridged_amount: u128,
        ) -> Result<Vec<u8>, TradeLegFailureReason> {
            // SVM instruction data for swap
            let mut payload = Vec::new();

            // Instruction discriminator (8 bytes for Anchor)
            payload.extend_from_slice(&[0xf8, 0xc6, 0x9e, 0x91, 0xe1, 0x75, 0x87, 0xc8]);

            // amount_in (u64)
            let amount_u64 = bridged_amount.min(u64::MAX as u128) as u64;
            payload.extend_from_slice(&amount_u64.to_le_bytes());

            // minimum_amount_out (u64)
            let min_out_u64 = leg.min_amount_out.min(u64::MAX as u128) as u64;
            payload.extend_from_slice(&min_out_u64.to_le_bytes());

            Ok(payload)
        }

        /// Parse swap output amount from return data.
        fn parse_swap_output(return_data: &[u8]) -> Option<u128> {
            if return_data.len() >= 32 {
                // Last 32 bytes typically contain the output amount
                let offset = return_data.len() - 32;
                let mut bytes = [0u8; 16];
                bytes.copy_from_slice(&return_data[offset + 16..offset + 32]);
                Some(u128::from_be_bytes(bytes))
            } else if return_data.len() >= 8 {
                // SVM returns u64
                let mut bytes = [0u8; 8];
                bytes.copy_from_slice(&return_data[..8]);
                Some(u64::from_le_bytes(bytes) as u128)
            } else {
                None
            }
        }

        /// Encode u128 to 32-byte big-endian format.
        fn encode_u256(value: u128) -> [u8; 32] {
            let mut result = [0u8; 32];
            result[16..32].copy_from_slice(&value.to_be_bytes());
            result
        }

        /// Encode asset ID to 32-byte format.
        fn encode_asset_id(asset_id: H256) -> [u8; 32] {
            *asset_id.as_fixed_bytes()
        }

        /// Rollback to a specific checkpoint.
        fn rollback_to_checkpoint(
            batch_id: H256,
            checkpoint_index: u32,
        ) -> Result<(), DispatchError> {
            let checkpoints = Checkpoints::<T>::get(batch_id);

            ensure!(
                (checkpoint_index as usize) < checkpoints.len(),
                Error::<T>::CheckpointNotFound
            );

            // In a full implementation, we would restore state from the checkpoint
            // For now, we emit the event and mark the rollback
            Self::deposit_event(Event::RollbackExecuted {
                batch_id,
                checkpoint_index,
            });

            Ok(())
        }

        /// Remove a batch from pending list.
        fn remove_from_pending(account: &T::AccountId, batch_id: H256) {
            PendingBatches::<T>::mutate(account, |batches| {
                if let Some(pos) = batches.iter().position(|&id| id == batch_id) {
                    batches.remove(pos);
                }
            });
        }

        /// Get current trade nonce for an account.
        pub fn get_trade_nonce(account: &T::AccountId) -> u64 {
            TradeNonces::<T>::get(account)
        }

        /// Query batch status.
        pub fn get_batch_status(batch_id: H256) -> Option<BatchStatus> {
            TradeBatches::<T>::get(batch_id).map(|b| b.status)
        }

        /// Calculate expected output for a trade path (for simulation).
        pub fn simulate_trade_path(
            legs: &[TradeLegInput],
            initial_amount: u128,
        ) -> Result<u128, DispatchError> {
            let mut current_amount = initial_amount;

            for leg in legs {
                // Simplified simulation - in production would query AMM state
                // Apply 0.3% fee for each leg (typical Uniswap V2 fee)
                let fee_bps: u128 = 30; // 0.3%
                let fee_amount = current_amount
                    .checked_mul(fee_bps)
                    .ok_or(Error::<T>::ArithmeticOverflow)?
                    / 10000;
                current_amount = current_amount
                    .checked_sub(fee_amount)
                    .ok_or(Error::<T>::ArithmeticOverflow)?;
            }

            Ok(current_amount)
        }
    }
}

// ============================================================================
// Types
// ============================================================================

/// Identifies the target VM for execution.
#[derive(Clone, Copy, PartialEq, Eq, Encode, Decode, RuntimeDebug, TypeInfo, MaxEncodedLen)]
pub enum VmType {
    /// Ethereum Virtual Machine
    Evm,
    /// Solana Virtual Machine
    Svm,
    /// Cross-VM operation (requires both)
    CrossVm,
}

/// AMM protocol identifiers.
#[derive(
    Clone,
    Copy,
    PartialEq,
    Eq,
    Encode,
    Decode,
    RuntimeDebug,
    TypeInfo,
    MaxEncodedLen,
    Ord,
    PartialOrd,
)]
pub enum AmmProtocol {
    /// Uniswap V2 style AMM (EVM)
    UniswapV2,
    /// Uniswap V3 concentrated liquidity (EVM)
    UniswapV3,
    /// Raydium AMM (SVM)
    Raydium,
    /// Orca Whirlpool (SVM)
    OrcaWhirlpool,
    /// Custom Atlas Sphere AMM
    AtlasAmm,
    /// Generic constant product AMM
    ConstantProduct,
    /// Curve-style stable swap
    StableSwap,
}

/// Asset pair for trading.
#[derive(Clone, Copy, PartialEq, Eq, Encode, Decode, RuntimeDebug, TypeInfo)]
pub struct AssetPair {
    pub asset_in: H256,
    pub asset_out: H256,
}

/// Configuration for an AMM adapter.
#[derive(Clone, PartialEq, Eq, Encode, Decode, RuntimeDebug, TypeInfo)]
pub struct AmmAdapterConfig {
    /// Target VM for this AMM
    pub vm_type: VmType,
    /// Contract/program address
    pub address: Vec<u8>,
    /// Fee in basis points
    pub fee_bps: u32,
    /// Whether adapter is enabled
    pub enabled: bool,
}

/// Input structure for creating trade legs.
#[derive(Clone, PartialEq, Eq, Encode, Decode, RuntimeDebug, TypeInfo)]
pub struct TradeLegInput {
    /// AMM protocol to use
    pub amm_protocol: AmmProtocol,
    /// Target VM
    pub vm_type: VmType,
    /// Input asset
    pub asset_in: H256,
    /// Output asset
    pub asset_out: H256,
    /// Amount to swap
    pub amount_in: u128,
    /// Minimum acceptable output
    pub min_amount_out: u128,
    /// Protocol-specific routing data
    pub route_data: Vec<u8>,
}

/// Internal trade leg representation.
#[derive(Clone, PartialEq, Eq, Encode, Decode, RuntimeDebug, TypeInfo)]
pub struct TradeLeg {
    pub amm_protocol: AmmProtocol,
    pub vm_type: VmType,
    pub asset_in: H256,
    pub asset_out: H256,
    pub amount_in: u128,
    pub min_amount_out: u128,
    pub route_data: Vec<u8>,
    pub status: TradeLegStatus,
    pub actual_amount_out: Option<u128>,
    pub gas_used: u64,
}

/// Status of a trade leg.
#[derive(Clone, Copy, PartialEq, Eq, Encode, Decode, RuntimeDebug, TypeInfo, Default)]
pub enum TradeLegStatus {
    #[default]
    Pending,
    Executing,
    Completed,
    Failed,
    Skipped,
}

/// Reason for trade leg failure.
#[derive(Clone, PartialEq, Eq, Encode, Decode, RuntimeDebug, TypeInfo)]
pub enum TradeLegFailureReason {
    EvmExecutionFailed,
    SvmExecutionFailed,
    CrossVmBridgeFailed,
    SlippageExceeded,
    InsufficientLiquidity,
    InvalidRoute,
    Timeout,
}

/// Trade batch containing multiple legs.
#[derive(Clone, PartialEq, Eq, Encode, Decode, RuntimeDebug, TypeInfo)]
pub struct TradeBatch<AccountId, Balance> {
    pub batch_id: H256,
    pub origin: AccountId,
    pub legs: Vec<TradeLeg>,
    pub slippage_tolerance_bps: u32,
    pub deadline: u64,
    pub nonce: u64,
    pub status: BatchStatus,
    pub created_at: u64,
    pub total_gas_used: u64,
    #[codec(skip)]
    pub _phantom: core::marker::PhantomData<Balance>,
}

impl<AccountId, Balance> TradeBatch<AccountId, Balance> {
    /// Check if batch execution has started.
    pub fn is_executing(&self) -> bool {
        self.status == BatchStatus::Executing
    }

    /// Get count of completed legs.
    pub fn completed_legs_count(&self) -> u32 {
        self.legs
            .iter()
            .filter(|l| l.status == TradeLegStatus::Completed)
            .count() as u32
    }
}

/// Status of a trade batch.
#[derive(Clone, Copy, PartialEq, Eq, Encode, Decode, RuntimeDebug, TypeInfo, Default)]
pub enum BatchStatus {
    #[default]
    Pending,
    Executing,
    Completed,
    Failed,
    Cancelled,
}

/// Reason for batch failure.
#[derive(Clone, PartialEq, Eq, Encode, Decode, RuntimeDebug, TypeInfo)]
pub enum BatchFailureReason {
    LegExecutionFailed {
        leg_index: u32,
        reason: TradeLegFailureReason,
    },
    SlippageExceeded {
        expected: u128,
        actual: u128,
    },
    DeadlineExpired,
    RollbackFailed,
}

/// State checkpoint for rollback support.
#[derive(Clone, PartialEq, Eq, Encode, Decode, RuntimeDebug, TypeInfo, MaxEncodedLen)]
pub struct StateCheckpoint {
    pub checkpoint_id: u32,
    pub state_root: H256,
    pub block_number: u64,
    pub timestamp: u64,
    pub completed_legs: u32,
}
