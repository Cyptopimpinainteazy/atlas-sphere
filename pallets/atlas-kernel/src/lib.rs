#![cfg_attr(not(feature = "std"), no_std)]

pub use pallet::*;

/// Phase 1: Full Consensus Implementation
/// Authority set management, pending changes scheduling, and enactment mechanism
pub mod authority;

use frame_support::pallet_prelude::*;
use frame_support::sp_runtime::traits::{AtLeast32BitUnsigned, SaturatedConversion};
use frame_support::sp_runtime::DispatchError;
use frame_support::weights::Weight;
use frame_system::pallet_prelude::*;
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
	pub trait Config: frame_system::Config {
		/// Aggregated runtime event type.
		type RuntimeEvent: From<Event<Self>> + IsType<<Self as frame_system::Config>::RuntimeEvent>;

		/// Balance type used within the canonical ledger.
		type Balance: Parameter + Member + AtLeast32BitUnsigned + Default + Copy + MaxEncodedLen;

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

		/// Weight information provider for extrinsics.
		type WeightInfo: WeightInfo;
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

	#[pallet::event]
	#[pallet::generate_deposit(pub(super) fn deposit_event)]
	pub enum Event<T: Config> {
		/// A Comit has been accepted for processing.
		ComitSubmitted {
			comit_id: H256,
			origin: T::AccountId,
			nonce: u64,
			fee: T::Balance,
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
	}

	#[pallet::pallet]
	pub struct Pallet<T>(_);

	#[pallet::call]
	impl<T: Config> Pallet<T> {
		/// Submit a Comit transaction describing dual-VM execution intents.
		#[pallet::call_index(0)]
		#[pallet::weight(T::WeightInfo::submit_comit())]
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

			// Emit success events
			Self::deposit_event(Event::ComitSubmitted {
				comit_id,
				origin: who,
				nonce,
				fee,
			});

			Self::deposit_event(Event::ComitFinalized { comit_id });
			Ok(())
		}

		/// Register a new asset and its metadata within the Atlas Kernel.
		#[pallet::call_index(1)]
		#[pallet::weight(T::WeightInfo::register_asset())]
		pub fn register_asset(
			origin: OriginFor<T>,
			asset_id: T::AssetId,
			symbol: Vec<u8>,
			decimals: u8,
		) -> DispatchResult {
			ensure_root(origin)?;
			ensure!(
				!AssetRegistry::<T>::contains_key(&asset_id),
				Error::<T>::AssetAlreadyRegistered
			);

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
		#[pallet::weight(T::WeightInfo::update_canonical_balance())]
		pub fn update_canonical_balance(
			origin: OriginFor<T>,
			account: T::AccountId,
			asset_id: T::AssetId,
			new_balance: T::Balance,
			comit_id: Option<H256>,
		) -> DispatchResult {
			ensure_root(origin)?;
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

	fn verify_dual_vm(comit: &ComitOf<T>) -> Result<(), ComitFailureReason> {
		if comit.prepare_root == H256::zero() {
			return Ok(());
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
			evm_receipt: Option<&ExecutionReceipt>,
			svm_receipt: Option<&ExecutionReceipt>,
		) -> Result<(), ComitFailureReason> {
			if comit.prepare_root == H256::zero() {
				return Ok(());
			}

			// Build canonical dual-VM commitment including receipt data
			let mut data = Vec::new();
			data.extend_from_slice(comit.comit_id.as_bytes());
			data.extend_from_slice(&comit.evm_payload);
			data.extend_from_slice(&comit.svm_payload);
			data.extend_from_slice(&comit.nonce.to_le_bytes());
			data.extend_from_slice(&comit.fee.encode());

			// Include EVM receipt state in commitment
			if let Some(receipt) = evm_receipt {
				data.extend_from_slice(&receipt.success.encode());
				data.extend_from_slice(&receipt.gas_used.encode());
				for log in &receipt.logs {
					data.extend_from_slice(&log.address);
					data.extend_from_slice(&log.data);
				}
				for change in &receipt.state_changes {
					data.extend_from_slice(&change.address);
					data.extend_from_slice(change.key.as_bytes());
					data.extend_from_slice(change.value.as_bytes());
				}
			}

			// Include SVM receipt state in commitment
			if let Some(receipt) = svm_receipt {
				data.extend_from_slice(&receipt.success.encode());
				data.extend_from_slice(&receipt.gas_used.encode());
				for log in &receipt.logs {
					data.extend_from_slice(&log.address);
					data.extend_from_slice(&log.data);
				}
				for change in &receipt.state_changes {
					data.extend_from_slice(&change.address);
					data.extend_from_slice(change.key.as_bytes());
					data.extend_from_slice(change.value.as_bytes());
				}
			}

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
			comit_id: H256,
			reason: ComitFailureReason,
		) -> DispatchError {
			let error = Self::reason_to_error(&reason);
			Self::deposit_event(Event::ComitFailed { comit_id, reason });
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

			// Current block number and timestamp from pallet_timestamp
			let current_block = <frame_system::Pallet<T>>::block_number();
			// Access timestamp through indirect method available to any pallet
			let current_timestamp = <frame_system::Pallet<T>>::block_number()
				.saturated_into::<u64>() * 12_000u64; // ~12 second blocks typical

			// Generate deterministic state root
			let state_root = H256::from(blake2_256(&state_data));

			SphereState {
				state_root,
				block_number: current_block.saturated_into(),
				timestamp: current_timestamp.saturated_into(),
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
		fn fee_accounting(
			&self,
			evm_gas_used: u64,
			svm_compute_units: u64,
			base_fee: Self::Balance,
		) -> Result<Self::Balance, DispatchError> {
			// Gas/compute unit pricing: These rates are configurable in production
			// EVM: 1 unit per 1000 gas (21000 gas ≈ 21 units)
			// SVM: 1 unit per 1000 compute units

			let evm_units_u64 = evm_gas_used / 1000;
			let svm_units_u64 = svm_compute_units / 1000;
			
			let evm_units = T::Balance::from(evm_units_u64 as u32);
			let svm_units = T::Balance::from(svm_units_u64 as u32);
			
			// Total fee = base + EVM units + SVM units
			// Using From trait to safely add components
			let total_fee = base_fee + evm_units + svm_units;
			
			Ok(total_fee)
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
}

#[cfg(test)]
mod mock;

#[cfg(test)]
mod tests;