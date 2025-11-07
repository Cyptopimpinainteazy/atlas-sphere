#![cfg_attr(not(feature = "std"), no_std)]

pub use pallet::*;

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
	/// Contract address that emitted the log.
	pub address: H256,
	/// Topics for the log entry.
	pub topics: Vec<H256>,
	/// Log data.
	pub data: Vec<u8>,
}

/// State change resulting from VM execution.
#[derive(Clone, PartialEq, Eq, Encode, Decode, RuntimeDebug, TypeInfo)]
pub struct StateChange {
	/// Account/contract address affected.
	pub address: H256,
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
pub enum ComitFailureReason {
	/// The provided payloads exceed runtime defined limits.
	PayloadTooLarge,
	/// Both payloads were empty, leaving nothing to execute.
	EmptyPayloads,
	/// The supplied nonce was not the one expected by the pallet.
	InvalidNonce,
	/// Placeholder for broader dual-VM verification failures.
	Verification,
	/// VM execution failed.
	VmExecutionFailed,
}

type ComitOf<T> = Comit<<T as frame_system::Config>::AccountId, <T as Config>::Balance>;

/// Dual-VM Dispatcher trait for coordinating execution across EVM and SVM runtimes.
/// This trait defines the interface for executing transactions on both virtual machines
/// and merging their execution results into a unified Sphere State Tree.
pub trait DualVmDispatcher {
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

		/// Maximum payload length permitted for Comit payloads.
		#[pallet::constant]
		type MaxPayloadLength: Get<u32>;

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
					ComitFailureReason::InvalidNonce,
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

			if let Err(reason) = Self::verify_dual_vm(&comit) {
				return Err(Self::fail_with_reason(comit_id, reason));
			}

			// Execute dual-VM transactions
			let evm_tx = if !evm_payload.is_empty() { Some(evm_payload.clone()) } else { None };
			let svm_tx = if !svm_payload.is_empty() { Some(svm_payload.clone()) } else { None };

			let _sphere_state = Self::do_execute_dual_tx(evm_tx, svm_tx)?;

			let next_nonce = nonce.checked_add(1).ok_or(Error::<T>::NonceOverflow)?;
			Nonces::<T>::insert(&who, next_nonce);

			// Record a default Atlas identifier if none exists yet.
			AccountRegistry::<T>::mutate(&who, |maybe_id| {
				if maybe_id.is_none() {
					*maybe_id = Some(T::AtlasId::default());
				}
			});

			Self::deposit_event(Event::ComitSubmitted {
				comit_id,
				origin: who,
				nonce,
				fee,
			});
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
			let max_len = T::MaxPayloadLength::get() as usize;
			if evm_payload.is_empty() && svm_payload.is_empty() {
				return Err(Self::fail_with_reason(
					*comit_id,
					ComitFailureReason::EmptyPayloads,
				));
			}

			if evm_payload.len() > max_len || svm_payload.len() > max_len {
				return Err(Self::fail_with_reason(
					*comit_id,
					ComitFailureReason::PayloadTooLarge,
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
				Err(ComitFailureReason::Verification)
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
				ComitFailureReason::PayloadTooLarge => Error::<T>::PayloadTooLarge,
				ComitFailureReason::EmptyPayloads => Error::<T>::EmptyPayloads,
				ComitFailureReason::InvalidNonce => Error::<T>::InvalidNonce,
				ComitFailureReason::Verification => Error::<T>::ComitVerificationFailed,
				ComitFailureReason::VmExecutionFailed => Error::<T>::ComitVerificationFailed,
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
					state_data.extend_from_slice(log.address.as_bytes());
					state_data.extend_from_slice(&log.data);
				}
				for change in &receipt.state_changes {
					state_data.extend_from_slice(change.address.as_bytes());
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
					state_data.extend_from_slice(log.address.as_bytes());
					state_data.extend_from_slice(&log.data);
				}
				for change in &receipt.state_changes {
					state_data.extend_from_slice(change.address.as_bytes());
					state_data.extend_from_slice(change.key.as_bytes());
					state_data.extend_from_slice(change.value.as_bytes());
				}
			}

			// Current block number and timestamp from frame_system
			let current_block = <frame_system::Pallet<T>>::block_number();
			let current_timestamp = <frame_system::Pallet<T>>::block_number().saturated_into::<u64>() * 6000; // Approximate timestamp

			// Generate deterministic state root
			let state_root = H256::from(blake2_256(&state_data));

			SphereState {
				state_root,
				block_number: current_block.saturated_into(),
				timestamp: current_timestamp.saturated_into(),
			}
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
		Weight::from_parts(0, 0)
	}

	fn register_asset() -> Weight {
		Weight::from_parts(0, 0)
	}

	fn update_canonical_balance() -> Weight {
		Weight::from_parts(0, 0)
	}
}

#[cfg(test)]
mod mock;

#[cfg(test)]
mod tests;