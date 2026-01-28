#![cfg_attr(not(feature = "std"), no_std)]

pub use pallet::*;

/// Phase 1: Full Consensus Implementation
/// Authority set management, pending changes scheduling, and enactment mechanism
pub mod authority;

// Runtime API trait defined in runtime crate

use frame_support::pallet_prelude::*;
use frame_support::sp_runtime::traits::{AtLeast32BitUnsigned, CheckedAdd, SaturatedConversion};
use frame_support::sp_runtime::DispatchError;
use frame_support::traits::{Currency, ReservableCurrency, UnixTime};
use frame_support::weights::Weight;
use frame_system::pallet_prelude::*;
use parity_scale_codec::Codec;
use sp_core::hashing::blake2_256;
use sp_core::H256;
use sp_std::convert::TryInto;
use sp_std::vec::Vec;

/// Represents a Comit transaction submitted to the Atlas Kernel.
#[derive(Clone, PartialEq, Eq, Encode, Decode, RuntimeDebug, TypeInfo)]
#[scale_info(skip_type_params(AccountId, Balance))]
pub struct Comit<AccountId, Balance> {
	/// Globally unique Comit identifier.
	pub comit_id: H256,
	/// Origin account that submitted the Comit.
	pub origin: AccountId,
	/// Payload destined for the EVM execution environment.
	pub evm_payload: Vec<u8>,
	/// Payload destined for the SVM execution environment.
	pub svm_payload: Vec<u8>,
	/// Sequential nonce scoped to the origin account.
	pub nonce: u64,
	/// Fee charged for processing the Comit.
	pub fee: Balance,
	/// Dual-VM prepare phase commitment root.
	pub prepare_root: H256,
}

/// Execution receipt returned by VM runtimes after transaction execution.
#[derive(Clone, PartialEq, Eq, Encode, Decode, RuntimeDebug, TypeInfo)]
pub struct ExecutionReceipt {
	/// Whether the execution was successful.
	pub success: bool,
	/// Gas used during execution.
	pub gas_used: u64,
	/// Return data from the execution.
	pub return_data: Vec<u8>,
	/// Logs emitted during execution.
	pub logs: Vec<ExecutionLog>,
	/// State changes resulting from execution.
	pub state_changes: Vec<StateChange>,
}

/// Log entry emitted during VM execution.
#[derive(Clone, PartialEq, Eq, Encode, Decode, RuntimeDebug, TypeInfo)]
pub struct ExecutionLog {
	/// Address (EVM H160 or SVM 32-byte key) that emitted the log.
	pub address: Vec<u8>,
	/// Topics for the log entry.
	pub topics: Vec<H256>,
	/// Log data.
	pub data: Vec<u8>,
}

/// State change resulting from VM execution.
#[derive(Clone, PartialEq, Eq, Encode, Decode, RuntimeDebug, TypeInfo)]
pub struct StateChange {
	/// Account/contract address affected (EVM H160 or SVM 32-byte key).
	pub address: Vec<u8>,
	/// Storage slot key.
	pub key: H256,
	/// New value at the storage slot.
	pub value: H256,
}

/// Unified state representation for the Atlas Sphere.
#[derive(Clone, PartialEq, Eq, Encode, Decode, RuntimeDebug, TypeInfo, Default)]
pub struct SphereState {
	/// State root hash representing the entire sphere state.
	pub state_root: H256,
	/// Block number when this state was computed.
	pub block_number: u32,
	/// Timestamp of state computation.
	pub timestamp: u64,
}

/// Dual-VM transaction types that can be executed.
#[derive(Clone, PartialEq, Eq, Encode, Decode, RuntimeDebug, TypeInfo)]
pub enum VmTransaction {
	/// EVM transaction payload.
	Evm(Vec<u8>),
	/// SVM transaction payload.
	Svm(Vec<u8>),
}

/// Reasons describing why a Comit failed verification or execution.
#[derive(Clone, PartialEq, Eq, Encode, Decode, RuntimeDebug, TypeInfo)]
/// Granular error codes for comit execution failures with diagnostic context.
/// Each variant includes an error code and optional diagnostic message (max 256 bytes).
pub enum ComitFailureReason {
	/// The provided EVM payload exceeds runtime defined limits.
	/// Error Code: 0x01
	EvmPayloadTooLarge {
		code: u32,
		actual_size: u32,
		max_size: u32,
	},
	/// The provided SVM payload exceeds runtime defined limits.
	/// Error Code: 0x02
	SvmPayloadTooLarge {
		code: u32,
		actual_size: u32,
		max_size: u32,
	},
	/// Combined payloads exceed the cumulative limit.
	/// Error Code: 0x03
	CombinedPayloadTooLarge {
		code: u32,
		evm_size: u32,
		svm_size: u32,
		max_combined: u32,
	},
	/// Both payloads were empty, leaving nothing to execute.
	/// Error Code: 0x04
	EmptyPayloads { code: u32 },
	/// The supplied nonce was not the one expected by the pallet.
	/// Error Code: 0x05
	InvalidNonce {
		code: u32,
		expected: u64,
		provided: u64,
	},
	/// Prepare-root verification failed or receipts mismatched.
	/// Error Code: 0x06
	Verification {
		code: u32,
		reason: [u8; 32], // Hash of verification failure reason
	},
	/// EVM execution failed with error code.
	/// Error Code: 0x10
	EvmExecutionFailed {
		code: u32,
		evm_error: u32,
		gas_used: u64,
	},
	/// SVM execution failed with error code.
	/// Error Code: 0x11
	SvmExecutionFailed {
		code: u32,
		svm_error: u32,
		compute_units_used: u64,
	},
}

type ComitOf<T> = Comit<<T as frame_system::Config>::AccountId, <T as Config>::Balance>;

/// Dual-VM Dispatcher trait for coordinating execution across EVM and SVM runtimes.
/// This trait defines the interface for executing transactions on both virtual machines
/// and merging their execution results into a unified Sphere State Tree.
pub trait DualVmDispatcher {
	/// AccountId type for authorization checks
	type AccountId;
	/// Balance type for fee accounting
	type Balance;

	/// Execute a transaction on the EVM runtime.
	/// Returns an execution receipt with the results of the transaction.
	fn execute_evm_tx(&self, tx: Vec<u8>) -> Result<ExecutionReceipt, DispatchError>;

	/// Execute a transaction on the SVM runtime.
	/// Returns an execution receipt with the results of the transaction.
	fn execute_svm_tx(&self, tx: Vec<u8>) -> Result<ExecutionReceipt, DispatchError>;

	/// Execute a dual-VM transaction and merge the results.
	/// This is the primary entry point for Comit execution.
	fn execute_dual_tx(&self, evm_tx: Option<Vec<u8>>, svm_tx: Option<Vec<u8>>) -> Result<SphereState, DispatchError>;

	/// Merge execution receipts from both VMs into a unified state.
	fn merge_receipts(&self, evm_receipt: Option<&ExecutionReceipt>, svm_receipt: Option<&ExecutionReceipt>) -> SphereState;

	/// Check if an account is authorized to execute a specific cross-VM operation.
	/// This enables granular access control beyond simple origin validation.
	/// Returns Ok(()) if authorized, Err(DispatchError) if not.
	fn auth_check(&self, caller: &Self::AccountId, operation: &[u8]) -> Result<(), DispatchError>;

	/// Calculate execution fees for a comit based on gas/compute usage.
	/// Takes the gas used (EVM) and compute units (SVM) and returns the total fee.
	/// This enables accurate fee accounting across heterogeneous runtimes.
	fn fee_accounting(
		&self,
		evm_gas_used: u64,
		svm_compute_units: u64,
		base_fee: Self::Balance,
	) -> Result<Self::Balance, DispatchError>;

	/// Update the canonical ledger with state changes from a successful comit.
	/// This persists cross-VM state into the canonical view, enabling future queries.
	/// Returns Ok(()) on success or Err with diagnostics on failure.
	fn canonical_ledger_update(
		&self,
		comit_id: H256,
		state_changes: &[StateChange],
	) -> Result<(), DispatchError>;
}

#[frame_support::pallet]
pub mod pallet {
	use super::*;

	#[pallet::config]
	pub trait Config: frame_system::Config + pallet_timestamp::Config {
		/// Aggregated runtime event type.
		type RuntimeEvent: From<Event<Self>> + IsType<<Self as frame_system::Config>::RuntimeEvent>;

		/// Currency trait for fee deduction and balance management.
		type Currency: frame_support::traits::ReservableCurrency<Self::AccountId>;

		/// Balance type used within the canonical ledger (same as Currency::Balance).
		type Balance: Parameter + Member + AtLeast32BitUnsigned + Default + Copy + MaxEncodedLen + CheckedAdd + From<<Self::Currency as frame_support::traits::Currency<Self::AccountId>>::Balance> + Into<<Self::Currency as frame_support::traits::Currency<Self::AccountId>>::Balance>;

		/// Identifier type for registered assets.
		type AssetId: Parameter + Member + Ord + Default + Copy + MaxEncodedLen;

		/// Identifier type used to map substrate accounts to Atlas IDs.
		type AtlasId: Parameter + Member + Default + Copy + MaxEncodedLen;

		/// Maximum number of unique assets tracked per account in the canonical ledger.
		#[pallet::constant]
		type MaxAssetsPerAccount: Get<u32>;

		/// Maximum length allowed for asset symbols.
		#[pallet::constant]
		type MaxAssetSymbolLength: Get<u32>;

		/// Maximum length allowed for EVM payloads.
		#[pallet::constant]
		type MaxEvmPayloadLength: Get<u32>;

		/// Maximum length allowed for SVM payloads.
		#[pallet::constant]
		type MaxSvmPayloadLength: Get<u32>;

		/// Maximum combined length of both EVM and SVM payloads.
		#[pallet::constant]
		type MaxCombinedPayloadLength: Get<u32>;

		/// Maximum number of authorities allowed in the authority set.
		#[pallet::constant]
		type MaxAuthorities: Get<u32>;

		/// Minimum number of authorities required in the authority set.
		#[pallet::constant]
		type MinAuthorities: Get<u32>;

		/// Weight information provider for extrinsics.
		type WeightInfo: WeightInfo;

		/// EVM execution adapter (runtime-configurable)
		/// TODO: Implement with real Frontier integration when available
		type EvmAdapter: Default;

		/// SVM execution adapter (runtime-configurable)
		/// TODO: Implement with real SVM integration when available
		type SvmAdapter: Default;

		/// Origin that can execute privileged governance functions.
		/// Typically EnsureRoot or a council-based origin.
		type GovernanceOrigin: EnsureOrigin<Self::RuntimeOrigin>;
	}

	type AssetSymbolOf<T> = BoundedVec<u8, <T as Config>::MaxAssetSymbolLength>;
	type AssetMetadataOf<T> = AssetMetadata<AssetSymbolOf<T>>;

	/// Canonical ledger mapping (account, asset_id) -> balance.
	/// Uses a double-storage map for efficient access without requiring nested collections.
	#[pallet::storage]
	pub type CanonicalLedger<T: Config> = StorageDoubleMap<
		_,
		Blake2_128Concat,
		T::AccountId,
		Blake2_128Concat,
		T::AssetId,
		T::Balance,
		ValueQuery,
	>;

	/// Maps accounts to their Atlas identifiers.
	#[pallet::storage]
	pub type AccountRegistry<T: Config> =
		StorageMap<_, Blake2_128Concat, T::AccountId, T::AtlasId>;

	/// Registry of known assets and their metadata.
	#[pallet::storage]
	pub type AssetRegistry<T: Config> =
		StorageMap<_, Blake2_128Concat, T::AssetId, AssetMetadataOf<T>>;

	/// Nonce tracker for Comit submissions by account.
	#[pallet::storage]
	pub type Nonces<T: Config> = StorageMap<_, Blake2_128Concat, T::AccountId, u64, ValueQuery>;

	/// Accounts authorized to submit Comits.
	/// 
	/// Security: If AuthorizedAccounts is empty, all submissions are rejected (secure by default).
	/// Accounts must be explicitly authorized via `authorize_account` extrinsic.
	/// In development mode with `dev-bypass` feature enabled, authorization checks are bypassed.
	#[pallet::storage]
	pub type AuthorizedAccounts<T: Config> = StorageMap<_, Blake2_128Concat, T::AccountId, (), ValueQuery>;

	/// Current authority set (consensus validators).
	/// Authorities are responsible for block production and finalization.
	#[pallet::storage]
	pub type Authorities<T: Config> = StorageValue<_, BoundedVec<T::AccountId, T::MaxAuthorities>, ValueQuery>;

	/// Pending authority changes to be enacted at the next session.
	/// Changes are scheduled via governance and enacted at session boundaries.
	#[pallet::storage]
	pub type PendingAuthorities<T: Config> = StorageValue<_, Option<BoundedVec<T::AccountId, T::MaxAuthorities>>, ValueQuery>;

	#[pallet::event]
	#[pallet::generate_deposit(pub(super) fn deposit_event)]
	pub enum Event<T: Config> {
		/// A Comit has been accepted for processing immediately after basic validation.
		ComitSubmitted {
			comit_id: H256,
			origin: T::AccountId,
			nonce: u64,
			fee: T::Balance,
		},
		/// Comit execution has started on both VMs.
		ComitExecutionStarted {
			comit_id: H256,
			timestamp: u64,
		},
		/// Comit execution has completed (may have failed).
		ComitExecutionCompleted {
			comit_id: H256,
			success: bool,
			gas_used: u64,
		},
		/// A Comit was finalized and applied to the canonical ledger.
		ComitFinalized { comit_id: H256 },
		/// Comit submission failed during verification or execution.
		ComitFailed {
			comit_id: H256,
			reason: ComitFailureReason,
		},
		/// An asset was registered with associated metadata.
		AssetRegistered {
			asset_id: T::AssetId,
			symbol: Vec<u8>,
			decimals: u8,
		},
		/// An account was authorized to submit Comits.
		AccountAuthorized { account: T::AccountId },
		/// An account was deauthorized from submitting Comits.
		AccountDeauthorized { account: T::AccountId },
		/// Canonical ledger was updated with state changes from comit execution.
		CanonicalLedgerUpdated {
			comit_id: H256,
			changes_applied: u32,
		},
		/// An authority was added to the current authority set.
		AuthorityAdded { authority: T::AccountId },
		/// An authority was removed from the current authority set.
		AuthorityRemoved { authority: T::AccountId },
		/// Pending authority changes were scheduled.
		AuthorityChangesScheduled { new_authorities: Vec<T::AccountId> },
		/// Pending authority changes were enacted.
		AuthorityChangesEnacted { new_authorities: Vec<T::AccountId> },
	}

	#[pallet::error]
	pub enum Error<T> {
		/// Asset is already present within the registry.
		AssetAlreadyRegistered,
		/// Attempted to modify the ledger with an unknown asset identifier.
		UnknownAsset,
		/// Provided payloads exceeded configured length constraints.
		PayloadTooLarge,
		/// Both payloads were empty, yielding an invalid Comit.
		EmptyPayloads,
		/// Supplied nonce does not match the expected account nonce.
		InvalidNonce,
		/// Nonce increment would overflow.
		NonceOverflow,
		/// Placeholder error signalling dual-VM verification failure.
		ComitVerificationFailed,
		/// Asset symbol exceeds permitted length.
		SymbolTooLong,
		/// Asset decimals exceed maximum allowed value (0-30).
		InvalidDecimals,
		/// Asset symbol contains invalid characters; must be uppercase ASCII, digits, dash, or underscore.
		InvalidSymbolCharset,
		/// Caller is not authorized to perform this operation.
		Unauthorized,
		/// Insufficient balance to cover the transaction fee.
		InsufficientBalance,
		/// Declared fee does not match the expected fee calculated from execution costs.
		IncorrectFee,
		/// Authority already exists in the authority set.
		AuthorityAlreadyExists,
		/// Authority not found in the authority set.
		AuthorityNotFound,
		/// Would violate minimum authorities constraint.
		BelowMinimumAuthorities,
		/// Would exceed maximum authorities constraint.
		ExceedsMaximumAuthorities,
		/// No pending authority changes to enact.
		NoPendingChanges,
		/// Authority set cannot be empty.
		EmptyAuthoritySet,
	}

	#[pallet::pallet]
	pub struct Pallet<T>(_);

	#[pallet::call]
	impl<T: Config> Pallet<T> {
		/// Submit a Comit transaction describing dual-VM execution intents.
		#[pallet::call_index(0)]
		#[pallet::weight(<T as Config>::WeightInfo::submit_comit())]
		pub fn submit_comit(
			origin: OriginFor<T>,
			comit_id: H256,
			evm_payload: Vec<u8>,
			svm_payload: Vec<u8>,
			nonce: u64,
			fee: T::Balance,
			prepare_root: H256,
		) -> DispatchResult {
			let who = ensure_signed(origin)?;

			// Early authorization check: verify caller is authorized for dual-VM operations
			let operation_context = Self::encode_submit_comit_context(&who, comit_id);
			Self::auth_check(&who, &operation_context)?;

			// First layer checks on payload sizes and emptiness.
			Self::verify_payloads(&comit_id, &evm_payload, &svm_payload)?;

			let expected_nonce = Nonces::<T>::get(&who);
			if nonce != expected_nonce {
				return Err(Self::fail_with_reason(
					comit_id,
					ComitFailureReason::InvalidNonce {
						code: 0x05,
						expected: expected_nonce,
						provided: nonce,
					},
				));
			}

			let comit = Comit::<T::AccountId, T::Balance> {
				comit_id,
				origin: who.clone(),
				evm_payload: evm_payload.clone(),
				svm_payload: svm_payload.clone(),
				nonce,
				fee,
				prepare_root,
			};

			// Prepare execution: collect receipts before verifying prepare_root
			let evm_tx = if !evm_payload.is_empty() { Some(evm_payload.clone()) } else { None };
			let svm_tx = if !svm_payload.is_empty() { Some(svm_payload.clone()) } else { None };

			// Execute and collect receipts (this is where mock is used until real executors are wired)
			let evm_receipt = if let Some(tx) = evm_tx {
				// TODO: Call real dispatcher when integrated with Frontier/SVM
				let receipt = ExecutionReceipt {
					success: true,
					gas_used: 21000,
					return_data: Vec::new(),
					logs: Vec::new(),
					state_changes: Vec::new(),
				};
				Some(receipt)
			} else {
				None
			};

			let svm_receipt = if let Some(tx) = svm_tx {
				// TODO: Call real dispatcher when integrated with SVM
				let receipt = ExecutionReceipt {
					success: true,
					gas_used: 5000,
					return_data: Vec::new(),
					logs: Vec::new(),
					state_changes: Vec::new(),
				};
				Some(receipt)
			} else {
				None
			};

			// Check for execution failures
			if let Some(ref receipt) = evm_receipt {
				if !receipt.success {
					return Err(Self::fail_with_reason(
						comit_id,
						ComitFailureReason::EvmExecutionFailed {
							code: 0x10,
							evm_error: 1, // Placeholder for actual EVM error
							gas_used: receipt.gas_used,
						},
					));
				}
			}

			if let Some(ref receipt) = svm_receipt {
				if !receipt.success {
					return Err(Self::fail_with_reason(
						comit_id,
						ComitFailureReason::SvmExecutionFailed {
							code: 0x11,
							svm_error: 1, // Placeholder for actual SVM error
							compute_units_used: 0, // Would come from SVM receipt in real impl
						},
					));
				}
			}

			// Fee deduction: Compute required fee before execution
			let evm_gas_used = evm_receipt.as_ref().map(|r| r.gas_used).unwrap_or(0);
			let svm_compute_units = svm_receipt.as_ref().map(|r| r.gas_used).unwrap_or(0);
			let base_fee = T::Balance::default();
			let required_fee = Self::calculate_execution_fee(evm_gas_used, svm_compute_units, base_fee)?;

			// Check if declared fee matches required fee
			ensure!(fee >= required_fee, Error::<T>::IncorrectFee);

			// Check sufficient balance
			let free_balance = T::Currency::free_balance(&who);
			ensure!(free_balance >= required_fee.into(), Error::<T>::InsufficientBalance);

			// Deduct the fee
			let imbalance = T::Currency::withdraw(
				&who,
				required_fee.into(),
				frame_support::traits::WithdrawReasons::FEE,
				frame_support::traits::ExistenceRequirement::KeepAlive,
			)?;
			drop(imbalance); // Burn the fee or handle as needed

			// Verify dual-VM prepare_root against actual receipts
			if let Err(reason) = Self::verify_dual_vm_with_receipts(&comit, evm_receipt.as_ref(), svm_receipt.as_ref()) {
				return Err(Self::fail_with_reason(comit_id, reason));
			}

			// Only increment nonce AFTER successful execution and verification
			let next_nonce = nonce.checked_add(1).ok_or(Error::<T>::NonceOverflow)?;
			Nonces::<T>::insert(&who, next_nonce);

			// Record a default Atlas identifier if none exists yet.
			AccountRegistry::<T>::mutate(&who, |maybe_id| {
				if maybe_id.is_none() {
					*maybe_id = Some(T::AtlasId::default());
				}
			});

			// Emit success events in order: Submitted -> ExecutionStarted -> ExecutionCompleted -> Finalized
			Self::deposit_event(Event::ComitSubmitted {
				comit_id,
				origin: who.clone(),
				nonce,
				fee,
			});

			// Get current timestamp from pallet_timestamp using UnixTime trait
			let current_timestamp = <pallet_timestamp::Pallet<T> as UnixTime>::now()
				.as_secs();

			Self::deposit_event(Event::ComitExecutionStarted {
				comit_id,
				timestamp: current_timestamp,
			});

			// Calculate total gas used from both receipts
			let total_gas_used = evm_receipt.as_ref().map(|r| r.gas_used).unwrap_or(0)
				+ svm_receipt.as_ref().map(|r| r.gas_used).unwrap_or(0);

			Self::deposit_event(Event::ComitExecutionCompleted {
				comit_id,
				success: true,
				gas_used: total_gas_used,
			});

			// Apply state changes from receipts to CanonicalLedger
			let changes_applied = Self::apply_canonical_ledger_update(
				comit_id,
				evm_receipt.as_ref(),
				svm_receipt.as_ref(),
			)?;

			// Emit event for ledger updates
			if changes_applied > 0 {
				Self::deposit_event(Event::CanonicalLedgerUpdated {
					comit_id,
					changes_applied,
				});
			}

			Self::deposit_event(Event::ComitFinalized { comit_id });
			Ok(())
		}

		/// Register a new asset and its metadata within the Atlas Kernel.
		#[pallet::call_index(1)]
		#[pallet::weight(<T as Config>::WeightInfo::register_asset())]
		pub fn register_asset(
			origin: OriginFor<T>,
			asset_id: T::AssetId,
			symbol: Vec<u8>,
			decimals: u8,
		) -> DispatchResult {
			T::GovernanceOrigin::ensure_origin(origin)?;
			ensure!(
				!AssetRegistry::<T>::contains_key(&asset_id),
				Error::<T>::AssetAlreadyRegistered
			);

			// Validate decimals are within reasonable bounds (0-30)
			ensure!(decimals <= 30, Error::<T>::InvalidDecimals);

			// Validate symbol: must be uppercase ASCII, digits, dash, or underscore
			for &byte in &symbol {
				let valid = (byte >= b'A' && byte <= b'Z')  // Uppercase letters
					|| (byte >= b'0' && byte <= b'9')  // Digits
					|| byte == b'-'  // Dash
					|| byte == b'_'; // Underscore
				ensure!(valid, Error::<T>::InvalidSymbolCharset);
			}

			let bounded_symbol: AssetSymbolOf<T> = symbol
				.clone()
				.try_into()
				.map_err(|_| Error::<T>::SymbolTooLong)?;

			let metadata = AssetMetadata { symbol: bounded_symbol, decimals };
			AssetRegistry::<T>::insert(asset_id, metadata);

			Self::deposit_event(Event::AssetRegistered {
				asset_id,
				symbol,
				decimals,
			});
			Ok(())
		}

		/// Update the canonical ledger balance for a specific account and asset.
		/// The optional Comit identifier triggers a finalized event when supplied.
		#[pallet::call_index(2)]
		#[pallet::weight(<T as Config>::WeightInfo::update_canonical_balance())]
		pub fn update_canonical_balance(
			origin: OriginFor<T>,
			account: T::AccountId,
			asset_id: T::AssetId,
			new_balance: T::Balance,
			comit_id: Option<H256>,
		) -> DispatchResult {
			T::GovernanceOrigin::ensure_origin(origin)?;
			ensure!(
				AssetRegistry::<T>::contains_key(&asset_id),
				Error::<T>::UnknownAsset
			);

			CanonicalLedger::<T>::insert(&account, &asset_id, new_balance);

			if let Some(id) = comit_id {
				Self::deposit_event(Event::ComitFinalized { comit_id: id });
			}

			Ok(())
		}

		/// Authorize an account to submit Comits.
		/// Only callable by root/governance.
		#[pallet::call_index(3)]
		#[pallet::weight(<T as Config>::WeightInfo::authorize_account())]
		pub fn authorize_account(
			origin: OriginFor<T>,
			account: T::AccountId,
		) -> DispatchResult {
			T::GovernanceOrigin::ensure_origin(origin)?;

			AuthorizedAccounts::<T>::insert(&account, ());
			Self::deposit_event(Event::AccountAuthorized { account });

			Ok(())
		}

		/// Deauthorize an account from submitting Comits.
		/// Only callable by root/governance.
		#[pallet::call_index(4)]
		#[pallet::weight(<T as Config>::WeightInfo::deauthorize_account())]
		pub fn deauthorize_account(
			origin: OriginFor<T>,
			account: T::AccountId,
		) -> DispatchResult {
			T::GovernanceOrigin::ensure_origin(origin)?;

			AuthorizedAccounts::<T>::remove(&account);
			Self::deposit_event(Event::AccountDeauthorized { account });

			Ok(())
		}

		/// Add a new authority to the current authority set.
		/// Only callable by governance (root or collective).
		#[pallet::call_index(5)]
		#[pallet::weight(<T as Config>::WeightInfo::add_authority())]
		pub fn add_authority(
			origin: OriginFor<T>,
			authority: T::AccountId,
		) -> DispatchResult {
			T::GovernanceOrigin::ensure_origin(origin)?;

			Authorities::<T>::try_mutate(|authorities| -> DispatchResult {
				// Check if authority already exists
				ensure!(
					!authorities.contains(&authority),
					Error::<T>::AuthorityAlreadyExists
				);

				// Check max authorities limit
				authorities
					.try_push(authority.clone())
					.map_err(|_| Error::<T>::ExceedsMaximumAuthorities)?;

				Self::deposit_event(Event::AuthorityAdded { authority });
				Ok(())
			})
		}

		/// Remove an authority from the current authority set.
		/// Only callable by governance (root or collective).
		#[pallet::call_index(6)]
		#[pallet::weight(<T as Config>::WeightInfo::remove_authority())]
		pub fn remove_authority(
			origin: OriginFor<T>,
			authority: T::AccountId,
		) -> DispatchResult {
			T::GovernanceOrigin::ensure_origin(origin)?;

			Authorities::<T>::try_mutate(|authorities| -> DispatchResult {
				// Find and remove the authority
				let pos = authorities
					.iter()
					.position(|a| a == &authority)
					.ok_or(Error::<T>::AuthorityNotFound)?;

				// Check minimum authorities constraint
				ensure!(
					authorities.len() > T::MinAuthorities::get() as usize,
					Error::<T>::BelowMinimumAuthorities
				);

				authorities.remove(pos);
				Self::deposit_event(Event::AuthorityRemoved { authority });
				Ok(())
			})
		}

		/// Schedule a complete authority set change for the next session.
		/// Only callable by governance (root or collective).
		#[pallet::call_index(7)]
		#[pallet::weight(<T as Config>::WeightInfo::schedule_authority_change())]
		pub fn schedule_authority_change(
			origin: OriginFor<T>,
			new_authorities: Vec<T::AccountId>,
		) -> DispatchResult {
			T::GovernanceOrigin::ensure_origin(origin)?;

			// Validate authority count bounds (check empty first for better error messages)
			ensure!(!new_authorities.is_empty(), Error::<T>::EmptyAuthoritySet);
			let count = new_authorities.len() as u32;
			ensure!(count >= T::MinAuthorities::get(), Error::<T>::BelowMinimumAuthorities);
			ensure!(count <= T::MaxAuthorities::get(), Error::<T>::ExceedsMaximumAuthorities);

			// Convert to BoundedVec
			let bounded_authorities: BoundedVec<T::AccountId, T::MaxAuthorities> = new_authorities
				.clone()
				.try_into()
				.map_err(|_| Error::<T>::ExceedsMaximumAuthorities)?;

			PendingAuthorities::<T>::put(Some(bounded_authorities));
			Self::deposit_event(Event::AuthorityChangesScheduled { new_authorities });

			Ok(())
		}

		/// Enact pending authority changes.
		/// Should be called at session boundaries. Only callable by governance.
		#[pallet::call_index(8)]
		#[pallet::weight(<T as Config>::WeightInfo::enact_authority_change())]
		pub fn enact_authority_change(origin: OriginFor<T>) -> DispatchResult {
			T::GovernanceOrigin::ensure_origin(origin)?;

			// Get pending changes
			let pending = PendingAuthorities::<T>::take()
				.ok_or(Error::<T>::NoPendingChanges)?;

			// Apply the new authority set
			let new_authorities: Vec<T::AccountId> = pending.into_inner();
			let bounded: BoundedVec<T::AccountId, T::MaxAuthorities> = new_authorities
				.clone()
				.try_into()
				.map_err(|_| Error::<T>::ExceedsMaximumAuthorities)?;

			Authorities::<T>::put(bounded);
			Self::deposit_event(Event::AuthorityChangesEnacted { new_authorities });

			Ok(())
		}
	}

	impl<T: Config> Pallet<T> {
		fn verify_payloads(
			comit_id: &H256,
			evm_payload: &[u8],
			svm_payload: &[u8],
		) -> Result<(), DispatchError> {
			let max_evm = T::MaxEvmPayloadLength::get() as usize;
			let max_svm = T::MaxSvmPayloadLength::get() as usize;
			let max_combined = T::MaxCombinedPayloadLength::get() as usize;
			
			if evm_payload.is_empty() && svm_payload.is_empty() {
				return Err(Self::fail_with_reason(
					*comit_id,
					ComitFailureReason::EmptyPayloads { code: 0x04 },
				));
			}

			if evm_payload.len() > max_evm {
				return Err(Self::fail_with_reason(
					*comit_id,
					ComitFailureReason::EvmPayloadTooLarge {
						code: 0x01,
						actual_size: evm_payload.len() as u32,
						max_size: max_evm as u32,
					},
				));
			}

			if svm_payload.len() > max_svm {
				return Err(Self::fail_with_reason(
					*comit_id,
					ComitFailureReason::SvmPayloadTooLarge {
						code: 0x02,
						actual_size: svm_payload.len() as u32,
						max_size: max_svm as u32,
					},
				));
			}

			if evm_payload.len() + svm_payload.len() > max_combined {
				return Err(Self::fail_with_reason(
					*comit_id,
					ComitFailureReason::CombinedPayloadTooLarge {
						code: 0x03,
						evm_size: evm_payload.len() as u32,
						svm_size: svm_payload.len() as u32,
						max_combined: max_combined as u32,
					},
				));
			}
			Ok(())
		}

		/// Encode operation context for authorization checks
		fn encode_submit_comit_context(caller: &T::AccountId, comit_id: H256) -> Vec<u8> {
			let mut context = Vec::new();
			context.extend_from_slice(b"submit_comit");
			context.extend_from_slice(&caller.encode());
			context.extend_from_slice(comit_id.as_bytes());
			context
		}

		/// Apply state changes from execution receipts to the CanonicalLedger.
		/// This aggregates state_changes from EVM and SVM receipts and updates storage.
		fn apply_canonical_ledger_update(
			comit_id: H256,
			evm_receipt: Option<&ExecutionReceipt>,
			svm_receipt: Option<&ExecutionReceipt>,
		) -> Result<u32, DispatchError> {
			let mut changes_applied = 0u32;

			// Aggregate state changes from both receipts
			let mut all_changes = Vec::new();
			if let Some(receipt) = evm_receipt {
				all_changes.extend_from_slice(&receipt.state_changes);
			}
			if let Some(receipt) = svm_receipt {
				all_changes.extend_from_slice(&receipt.state_changes);
			}

			// Apply each state change to CanonicalLedger
			// Note: In production, state_changes would map to account balances or contract storage
			// For now, we interpret the first 32 bytes of address as AccountId and key/value as asset balance
			for change in all_changes.iter() {
				// Skip invalid address sizes
				if change.address.len() < 32 {
					continue;
				}

				// Extract account from address (first 32 bytes)
				let mut account_bytes = [0u8; 32];
				account_bytes.copy_from_slice(&change.address[..32]);
				let account = T::AccountId::decode(&mut &account_bytes[..]).ok();

				if let Some(acc) = account {
					// Use the key as asset_id (convert H256 to AssetId)
					let asset_id_bytes = change.key.as_bytes();
					let asset_id = T::AssetId::decode(&mut &asset_id_bytes[..]).ok();

					if let Some(asset) = asset_id {
						// Use the value as balance (convert H256 to Balance)
						let balance_bytes = change.value.as_bytes();
						let balance = T::Balance::decode(&mut &balance_bytes[..]).ok();

						if let Some(bal) = balance {
							// Update CanonicalLedger with new balance
							CanonicalLedger::<T>::insert(&acc, &asset, bal);
							changes_applied = changes_applied.saturating_add(1);
						}
					}
				}
			}

			Ok(changes_applied)
		}

		/// Calculate the total execution fee for a Comit based on gas/compute usage.
		/// Uses checked arithmetic to prevent overflow.
		pub fn calculate_execution_fee(
			evm_gas_used: u64,
			svm_compute_units: u64,
			base_fee: T::Balance,
		) -> Result<T::Balance, DispatchError> {
			// Gas/compute unit pricing (configurable in production)
			// EVM: 1 unit per 1000 gas
			// SVM: 1 unit per 1000 compute units
			let evm_units_u64 = evm_gas_used.saturating_div(1000);
			let svm_units_u64 = svm_compute_units.saturating_div(1000);
			
			let evm_units = T::Balance::from(evm_units_u64 as u32);
			let svm_units = T::Balance::from(svm_units_u64 as u32);
			
			// Total fee = base + EVM units + SVM units
			// Use checked_add to prevent overflow
			let total_fee = base_fee
				.checked_add(&evm_units)
				.and_then(|t| t.checked_add(&svm_units))
				.ok_or(Error::<T>::NonceOverflow)?; // Reuse NonceOverflow for arithmetic overflow
			
			Ok(total_fee)
		}

			/// Authorization check for dual-VM operations
			/// Enforces allowlist-based access control unless dev-bypass feature is enabled.
			/// 
			/// Authorization Semantics:
			/// - With `dev-bypass` feature: All signed callers are accepted (development only)
			/// - Without `dev-bypass` feature (production):
			///   - Caller MUST be in AuthorizedAccounts storage
			///   - Empty AuthorizedAccounts = No one is authorized (secure by default)
			///   - Use `authorize_account` extrinsic to add accounts to allowlist
			///   
			/// This explicit authorization model prevents unauthorized access and ensures
			/// governance has full control over who can submit Comits.
		fn auth_check(caller: &T::AccountId, _operation_context: &[u8]) -> Result<(), DispatchError> {
			#[cfg(feature = "dev-bypass")]
			{
				// Development bypass: accept all signed callers
				return Ok(());
			}

			#[cfg(not(feature = "dev-bypass"))]
			{
				// Production: check authorization list
				// If no authorized accounts exist, reject (explicit authorization required)
				if AuthorizedAccounts::<T>::contains_key(caller) {
					Ok(())
				} else {
					Err(Error::<T>::Unauthorized.into())
				}
			}
		}	fn verify_dual_vm(comit: &ComitOf<T>) -> Result<(), ComitFailureReason> {
		// Reject zero prepare_root unless explicitly allowed by dev-bypass feature
		#[cfg(not(feature = "dev-bypass"))]
		{
			if comit.prepare_root == H256::zero() {
				return Err(ComitFailureReason::Verification {
					code: 0x06,
					reason: blake2_256(b"zero_prepare_root_not_allowed"),
				});
			}
		}

		let mut data = Vec::new();
		data.extend_from_slice(comit.comit_id.as_bytes());
		data.extend_from_slice(&comit.evm_payload);
		data.extend_from_slice(&comit.svm_payload);
		data.extend_from_slice(&comit.nonce.to_le_bytes());
		data.extend_from_slice(&comit.fee.encode());

		let expected = H256::from(blake2_256(&data));

		if expected == comit.prepare_root {
			Ok(())
		} else {
			let reason_hash = blake2_256(&data);
			Err(ComitFailureReason::Verification {
				code: 0x06,
				reason: reason_hash,
			})
		}
	}		/// Verify prepare_root against actual VM receipts (comprehensive dual-VM commitment)
		fn verify_dual_vm_with_receipts(
			comit: &ComitOf<T>,
			_evm_receipt: Option<&ExecutionReceipt>,
			_svm_receipt: Option<&ExecutionReceipt>,
		) -> Result<(), ComitFailureReason> {
			// Reject zero prepare_root unless explicitly allowed by dev-bypass feature
			#[cfg(not(feature = "dev-bypass"))]
			{
				if comit.prepare_root == H256::zero() {
					return Err(ComitFailureReason::Verification {
						code: 0x06,
						reason: blake2_256(b"zero_prepare_root_not_allowed"),
					});
				}
			}

			// Build canonical dual-VM commitment WITHOUT receipt data.
			// The prepare_root is a commitment to the input payloads and execution parameters,
			// NOT the execution results. This allows clients to compute the prepare_root
			// beforehand and use it to authorize the Comit submission.
			let mut data = Vec::new();
			data.extend_from_slice(comit.comit_id.as_bytes());
			data.extend_from_slice(&comit.evm_payload);
			data.extend_from_slice(&comit.svm_payload);
			data.extend_from_slice(&comit.nonce.to_le_bytes());
			data.extend_from_slice(&comit.fee.encode());

			let computed_root = H256::from(blake2_256(&data));

			if computed_root == comit.prepare_root {
				Ok(())
			} else {
				// Hash the mismatch reason for diagnostic
				let mut reason_data = Vec::new();
				reason_data.extend_from_slice(comit.comit_id.as_bytes());
				reason_data.extend_from_slice(computed_root.as_bytes());
				reason_data.extend_from_slice(comit.prepare_root.as_bytes());
				let reason_hash = blake2_256(&reason_data);
				
				Err(ComitFailureReason::Verification {
					code: 0x06,
					reason: reason_hash,
				})
			}
		}

		fn fail_with_reason(
			_comit_id: H256,
			reason: ComitFailureReason,
		) -> DispatchError {
			let error = Self::reason_to_error(&reason);
			// Note: We do NOT emit ComitFailed event here because:
			// In Substrate, when an extrinsic returns Err, all state changes (including events)
			// are rolled back automatically. Therefore, emitting an event before returning an
			// error is futile - it will never appear in the final block.
			// Failure information is instead conveyed through the error code itself.
			error.into()
		}

		fn reason_to_error(reason: &ComitFailureReason) -> Error<T> {
			match reason {
				ComitFailureReason::EvmPayloadTooLarge { .. } => Error::<T>::PayloadTooLarge,
				ComitFailureReason::SvmPayloadTooLarge { .. } => Error::<T>::PayloadTooLarge,
				ComitFailureReason::CombinedPayloadTooLarge { .. } => Error::<T>::PayloadTooLarge,
				ComitFailureReason::EmptyPayloads { .. } => Error::<T>::EmptyPayloads,
				ComitFailureReason::InvalidNonce { .. } => Error::<T>::InvalidNonce,
				ComitFailureReason::Verification { .. } => Error::<T>::ComitVerificationFailed,
				ComitFailureReason::EvmExecutionFailed { .. } => Error::<T>::ComitVerificationFailed,
				ComitFailureReason::SvmExecutionFailed { .. } => Error::<T>::ComitVerificationFailed,
			}
		}

		/// Execute dual-VM transactions and return the unified state
		fn do_execute_dual_tx(evm_tx: Option<Vec<u8>>, svm_tx: Option<Vec<u8>>) -> Result<SphereState, DispatchError> {
			// Execute transactions on both VMs in parallel (when implemented)
			let _evm_receipt = if let Some(_tx) = evm_tx {
				Some(ExecutionReceipt {
					success: true,
					gas_used: 21000,
					return_data: Vec::new(),
					logs: Vec::new(),
					state_changes: Vec::new(),
				})
			} else {
				None
			};

			let _svm_receipt = if let Some(_tx) = svm_tx {
				Some(ExecutionReceipt {
					success: true,
					gas_used: 5000,
					return_data: Vec::new(),
					logs: Vec::new(),
					state_changes: Vec::new(),
				})
			} else {
				None
			};

			// Merge receipts into unified state
			Ok(SphereState {
				state_root: H256::default(),
				block_number: 0,
				timestamp: 0,
			})
		}
	}

	/// Implementation of the DualVmDispatcher trait for the Atlas Kernel pallet.
	/// This provides the core coordination logic for executing transactions across
	/// both EVM and SVM runtimes and merging their execution results.
	impl<T: Config> DualVmDispatcher for Pallet<T> {
		type AccountId = T::AccountId;
		type Balance = T::Balance;

		fn execute_evm_tx(&self, _tx: Vec<u8>) -> Result<ExecutionReceipt, DispatchError> {
			// TODO: Integrate with Frontier/EVM pallet for actual execution
			// For now, return a mock successful receipt
			Ok(ExecutionReceipt {
				success: true,
				gas_used: 21000, // Base gas for simple transfer
				return_data: Vec::new(),
				logs: Vec::new(),
				state_changes: Vec::new(),
			})
		}

		fn execute_svm_tx(&self, _tx: Vec<u8>) -> Result<ExecutionReceipt, DispatchError> {
			// TODO: Integrate with SVM pallet for actual execution
			// For now, return a mock successful receipt
			Ok(ExecutionReceipt {
				success: true,
				gas_used: 5000, // SVM compute units
				return_data: Vec::new(),
				logs: Vec::new(),
				state_changes: Vec::new(),
			})
		}

		fn execute_dual_tx(&self, evm_tx: Option<Vec<u8>>, svm_tx: Option<Vec<u8>>) -> Result<SphereState, DispatchError> {
			// Execute transactions on both VMs in parallel (when implemented)
			let evm_receipt = if let Some(tx) = evm_tx {
				Some(self.execute_evm_tx(tx)?)
			} else {
				None
			};

			let svm_receipt = if let Some(tx) = svm_tx {
				Some(self.execute_svm_tx(tx)?)
			} else {
				None
			};

			// Merge execution results into unified sphere state
			Ok(self.merge_receipts(evm_receipt.as_ref(), svm_receipt.as_ref()))
		}

		fn merge_receipts(&self, evm_receipt: Option<&ExecutionReceipt>, svm_receipt: Option<&ExecutionReceipt>) -> SphereState {
			// TODO: Implement proper state merging logic
			// For now, create a deterministic state root based on receipts

			let mut state_data = Vec::new();

			// Include EVM receipt data
			if let Some(receipt) = evm_receipt {
				state_data.extend_from_slice(&receipt.success.encode());
				state_data.extend_from_slice(&receipt.gas_used.encode());
				state_data.extend_from_slice(&receipt.return_data);
				for log in &receipt.logs {
					state_data.extend_from_slice(&log.address);
					state_data.extend_from_slice(&log.data);
				}
				for change in &receipt.state_changes {
					state_data.extend_from_slice(&change.address);
					state_data.extend_from_slice(change.key.as_bytes());
					state_data.extend_from_slice(change.value.as_bytes());
				}
			}

			// Include SVM receipt data
			if let Some(receipt) = svm_receipt {
				state_data.extend_from_slice(&receipt.success.encode());
				state_data.extend_from_slice(&receipt.gas_used.encode());
				state_data.extend_from_slice(&receipt.return_data);
				for log in &receipt.logs {
					state_data.extend_from_slice(&log.address);
					state_data.extend_from_slice(&log.data);
				}
				for change in &receipt.state_changes {
					state_data.extend_from_slice(&change.address);
					state_data.extend_from_slice(change.key.as_bytes());
					state_data.extend_from_slice(change.value.as_bytes());
				}
			}

			// Get current block number from frame_system
			let current_block = <frame_system::Pallet<T>>::block_number();
			// Get current timestamp from pallet_timestamp using UnixTime trait
			let current_timestamp = <pallet_timestamp::Pallet<T> as UnixTime>::now()
				.as_secs();
			// Generate deterministic state root
			let state_root = H256::from(blake2_256(&state_data));

			SphereState {
				state_root,
				block_number: current_block.saturated_into(),
				timestamp: current_timestamp,
			}
		}

		/// Check if an account is authorized to execute a specific cross-VM operation.
		fn auth_check(&self, caller: &Self::AccountId, _operation: &[u8]) -> Result<(), DispatchError> {
			// For now, accept all signed origins. In production, this would check:
			// - Whitelist status
			// - Fee balance
			// - Rate limits
			// - KYC requirements (optional)
			// This is a placeholder for integration with authority/permission systems.
			
			// TODO: Integrate with authority pallet for granular access control
			let _ = caller;
			Ok(())
		}

		/// Calculate execution fees based on gas and compute unit consumption.
		/// 
		/// Uses checked arithmetic to prevent overflow in fee calculations.
		/// Returns the total fee required for the transaction.
		fn fee_accounting(
			&self,
			evm_gas_used: u64,
			svm_compute_units: u64,
			base_fee: Self::Balance,
		) -> Result<Self::Balance, DispatchError> {
			// Gas/compute unit pricing: These rates are configurable in production
			// EVM: 1 unit per 1000 gas (21000 gas ≈ 21 units)
			// SVM: 1 unit per 1000 compute units

			let evm_units_u64 = evm_gas_used.saturating_div(1000);
			let svm_units_u64 = svm_compute_units.saturating_div(1000);
			
			let evm_units = T::Balance::from(evm_units_u64 as u32);
			let svm_units = T::Balance::from(svm_units_u64 as u32);
			
			// Total fee = base + EVM units + SVM units
			// Using checked arithmetic to prevent overflow
			let total_fee = base_fee
			.checked_add(&evm_units)
			.and_then(|t| t.checked_add(&svm_units))
			.ok_or(sp_runtime::DispatchError::Arithmetic(
				sp_runtime::ArithmeticError::Overflow
			))?;			Ok(total_fee)
		}

		/// Update the canonical ledger with state changes from a successful comit.
		fn canonical_ledger_update(
			&self,
			_comit_id: H256,
			state_changes: &[StateChange],
		) -> Result<(), DispatchError> {
			// Persist cross-VM state changes into the canonical ledger.
			// This enables future queries to see the unified state across both VMs.
			
			// TODO: Implement actual state persistence
			// In a full implementation, this would:
			// 1. Validate all state changes are well-formed
			// 2. Apply changes to CanonicalLedger storage
			// 3. Update indices for efficient queries
			// 4. Emit diagnostic events
			
			// For now, just verify state changes are valid
			for change in state_changes {
				if change.address.is_empty() {
					return Err(DispatchError::Other("Invalid state change address"));
				}
			}
			Ok(())
		}
	}

	/// Asset metadata stored alongside each asset id.
	#[derive(Clone, PartialEq, Eq, Encode, Decode, RuntimeDebug, TypeInfo, MaxEncodedLen)]
	#[scale_info(skip_type_params(Symbol))]
	pub struct AssetMetadata<Symbol: MaxEncodedLen> {
		pub symbol: Symbol,
		pub decimals: u8,
	}
}

/// Weight information trait for the Atlas Kernel pallet.
pub trait WeightInfo {
	fn submit_comit() -> Weight;
	fn register_asset() -> Weight;
	fn update_canonical_balance() -> Weight;
	fn authorize_account() -> Weight;
	fn deauthorize_account() -> Weight;
	fn add_authority() -> Weight;
	fn remove_authority() -> Weight;
	fn schedule_authority_change() -> Weight;
	fn enact_authority_change() -> Weight;
}

impl WeightInfo for () {
	fn submit_comit() -> Weight {
		// submit_comit involves dual-VM execution, receipt merging, and canonical ledger updates
		// Base cost: 50_000_000 + scaled with payload size
		Weight::from_parts(50_000_000, 128_000)
	}

	fn register_asset() -> Weight {
		// register_asset stores asset metadata in canonical ledger
		// Fixed cost for storage write and index updates
		Weight::from_parts(5_000_000, 32_000)
	}

	fn update_canonical_balance() -> Weight {
		// update_canonical_balance writes to double-map storage and may emit finalization event
		// Fixed cost with potential event emission overhead
		Weight::from_parts(10_000_000, 48_000)
	}

	fn authorize_account() -> Weight {
		// authorize_account writes to storage map
		Weight::from_parts(5_000_000, 32_000)
	}

	fn deauthorize_account() -> Weight {
		// deauthorize_account removes from storage map
		Weight::from_parts(5_000_000, 32_000)
	}

	fn add_authority() -> Weight {
		// add_authority checks storage and pushes to bounded vec
		Weight::from_parts(10_000_000, 64_000)
	}

	fn remove_authority() -> Weight {
		// remove_authority searches and removes from bounded vec
		Weight::from_parts(15_000_000, 64_000)
	}

	fn schedule_authority_change() -> Weight {
		// schedule_authority_change validates and stores bounded vec
		Weight::from_parts(20_000_000, 128_000)
	}

	fn enact_authority_change() -> Weight {
		// enact_authority_change replaces storage and clears pending
		Weight::from_parts(15_000_000, 64_000)
	}
}

// Runtime API definitions for querying Atlas Kernel state
sp_api::decl_runtime_apis! {
	/// Runtime API for querying Atlas Kernel pallet state
	pub trait AtlasKernelRuntimeApi<AccountId, Balance, AssetId> where
		AccountId: Codec,
		Balance: Codec,
		AssetId: Codec,
	{
		/// Get the canonical balance for a specific account and asset
		fn get_canonical_balance(account: AccountId, asset_id: AssetId) -> Balance;

		/// Get asset metadata (symbol, decimals) for a specific asset
		fn get_asset_metadata(asset_id: AssetId) -> Option<(Vec<u8>, u8)>;

		/// Check if an account is authorized to submit Comits
		fn is_authorized(account: AccountId) -> bool;

		/// Get all authorized accounts
		fn get_authorized_accounts() -> Vec<AccountId>;

		/// Get the current authority set
		fn get_authorities() -> Vec<AccountId>;
	}
}

#[cfg(test)]
mod mock;

#[cfg(test)]
mod tests;
