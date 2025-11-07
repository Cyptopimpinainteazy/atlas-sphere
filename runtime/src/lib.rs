#![cfg_attr(not(feature = "std"), no_std)]
#![recursion_limit = "256"]

pub use frame_support::{
	construct_runtime, parameter_types,
	traits::{ConstBool, ConstU16, ConstU32, ConstU64, ConstU8, Everything},
	weights::{
		constants::{
			BlockExecutionWeight, ExtrinsicBaseWeight, RocksDbWeight, WEIGHT_REF_TIME_PER_SECOND,
		},
		ConstantMultiplier, IdentityFee,
	},
};
use frame_support::{traits::Currency, weights::Weight};
use codec::{Encode, Decode};
use scale_info::TypeInfo;
use frame_system::limits;
use pallet_aura;
use pallet_balances;
use pallet_grandpa;
use pallet_timestamp;
use pallet_transaction_payment::CurrencyAdapter;
use pallet_sudo;
use pallet_atlas_kernel;
use sp_api::impl_runtime_apis;
use sp_core::{OpaqueMetadata, H256};
use sp_runtime::{
	create_runtime_str,
	generic,
	impl_opaque_keys,
	traits::{AccountIdLookup, BlakeTwo256, Block as BlockT, IdentifyAccount, Verify},
	transaction_validity::{TransactionSource, TransactionValidity},
	ApplyExtrinsicResult, MultiAddress, MultiSignature, Perbill,
};
use sp_session::{GetValidatorCount, GetSessionNumber};
use sp_std::prelude::*;

#[cfg(any(feature = "std", test))]
pub use sp_runtime::BuildStorage;

// WASM binary build disabled for this development phase
#[cfg(feature = "std")]
pub const WASM_BINARY: Option<&[u8]> = None;

#[cfg(not(feature = "std"))]
pub const WASM_BINARY: Option<&[u8]> = None;

/// Opaque types used by the CLI commands.
pub mod opaque {
	use super::*;

	pub type BlockNumber = super::BlockNumber;
	pub type Header = generic::Header<BlockNumber, BlakeTwo256>;
	pub type UncheckedExtrinsic = sp_runtime::OpaqueExtrinsic;
	pub type Block = generic::Block<Header, UncheckedExtrinsic>;
	pub type BlockId = generic::BlockId<Block>;
}

pub type BlockNumber = u32;
pub type Index = u32;
pub type Signature = MultiSignature;
pub type Hash = H256;
pub type Moment = u64;
pub type Balance = u128;
pub type AssetId = u32;
pub type AtlasId = H256;
pub type Address = MultiAddress<AccountId, ()>;
pub type AccountId = <<Signature as Verify>::Signer as IdentifyAccount>::AccountId;

pub const MILLISECS_PER_BLOCK: u64 = 6_000;

pub struct RuntimeVersion;
impl frame_support::traits::Get<sp_version::RuntimeVersion> for RuntimeVersion {
	fn get() -> sp_version::RuntimeVersion {
		VERSION
	}
}
pub const SLOT_DURATION: u64 = MILLISECS_PER_BLOCK;

pub const NANO_ATLAS: Balance = 1;
pub const MICRO_ATLAS: Balance = 1_000 * NANO_ATLAS;
pub const MILLI_ATLAS: Balance = 1_000 * MICRO_ATLAS;
pub const ATLAS: Balance = 1_000 * MILLI_ATLAS;

pub const VERSION: sp_version::RuntimeVersion = sp_version::RuntimeVersion {
	spec_name: create_runtime_str!("atlas-sphere"),
	impl_name: create_runtime_str!("atlas-sphere"),
	authoring_version: 1,
	spec_version: 1,
	impl_version: 1,
	apis: RUNTIME_API_VERSIONS,
	transaction_version: 1,
	state_version: 1,
};

parameter_types! {
	pub const BlockHashCount: BlockNumber = 2_400;
	pub const SS58Prefix: u16 = 42;
	pub const MinimumPeriod: Moment = (MILLISECS_PER_BLOCK / 2) as Moment;
	pub const ExistentialDeposit: Balance = 100 * MICRO_ATLAS;
	pub const TransactionByteFee: Balance = 10 * MICRO_ATLAS;
	pub const MaxAssetsPerAccount: u32 = 32;
	pub const MaxAssetSymbolLength: u32 = 16;
	pub const MaxPayloadLength: u32 = 32 * 1024;
	pub BlockWeights: limits::BlockWeights = limits::BlockWeights::with_sensible_defaults(
		Weight::from_parts(12 * WEIGHT_REF_TIME_PER_SECOND, 5 * 1024 * 1024),
		Perbill::from_percent(75),
	);
	pub BlockLength: limits::BlockLength = limits::BlockLength::max_with_normal_ratio(
		5 * 1024 * 1024,
		Perbill::from_percent(75),
	);
}

#[cfg(feature = "std")]
pub fn native_version() -> sp_version::NativeVersion {
	sp_version::NativeVersion {
		runtime_version: VERSION,
		can_author_with: Default::default(),
	}
}

parameter_types! {
	pub const MaxAuthorities: u32 = 32;
	pub const MaxSetIdSessionEntries: u64 = 0;
	pub const OperationalFeeMultiplier: u8 = 5;
}

construct_runtime!(
	pub enum Runtime where
		Block = Block,
		NodeBlock = Block,
		UncheckedExtrinsic = UncheckedExtrinsic,
	{
		System: frame_system,
		Timestamp: pallet_timestamp,
		Aura: pallet_aura,
		Grandpa: pallet_grandpa,
		Balances: pallet_balances,
		TransactionPayment: pallet_transaction_payment,
		AtlasKernel: pallet_atlas_kernel,
		Sudo: pallet_sudo,
	}
);

pub type Header = generic::Header<BlockNumber, BlakeTwo256>;
pub type UncheckedExtrinsic = generic::UncheckedExtrinsic<Address, RuntimeCall, Signature, SignedExtra>;
pub type Block = generic::Block<Header, UncheckedExtrinsic>;
pub type Executive = frame_executive::Executive<
	Runtime,
	Block,
	frame_system::ChainContext<Runtime>,
	Runtime,
	AllPalletsWithSystem,
>;

impl_opaque_keys! {
	pub struct SessionKeys {
		pub aura: Aura,
	}
}

pub type SignedExtra = (
	frame_system::CheckNonZeroSender<Runtime>,
	frame_system::CheckSpecVersion<Runtime>,
	frame_system::CheckTxVersion<Runtime>,
	frame_system::CheckGenesis<Runtime>,
	frame_system::CheckEra<Runtime>,
	frame_system::CheckNonce<Runtime>,
	frame_system::CheckWeight<Runtime>,
	pallet_transaction_payment::ChargeTransactionPayment<Runtime>,
);

pub type SignedPayload = generic::SignedPayload<RuntimeCall, SignedExtra>;

// ===== Config Impls (after construct_runtime!) =====

type NegativeImbalance = <Balances as Currency<AccountId>>::NegativeImbalance;

pub struct DealWithFees;
impl frame_support::traits::OnUnbalanced<NegativeImbalance> for DealWithFees {
	fn on_unbalanced(amount: NegativeImbalance) {
		drop(amount);
	}
}

impl frame_system::Config for Runtime {
	type BaseCallFilter = Everything;
	type Block = Block;
	type BlockWeights = BlockWeights;
	type BlockLength = BlockLength;
	type DbWeight = RocksDbWeight;
	type RuntimeOrigin = RuntimeOrigin;
	type RuntimeCall = RuntimeCall;
	type Hash = Hash;
	type Hashing = BlakeTwo256;
	type AccountId = AccountId;
	type Lookup = AccountIdLookup<AccountId, ()>;
	type RuntimeEvent = RuntimeEvent;
	type BlockHashCount = BlockHashCount;
	type Version = RuntimeVersion;
	type PalletInfo = PalletInfo;
	type AccountData = pallet_balances::AccountData<Balance>;
	type OnNewAccount = ();
	type OnKilledAccount = ();
	type SystemWeightInfo = frame_system::weights::SubstrateWeight<Runtime>;
	type SS58Prefix = ConstU16<42>;
	type OnSetCode = ();
	type MaxConsumers = ConstU32<16>;
	type Nonce = Index;
}

impl pallet_timestamp::Config for Runtime {
	type Moment = Moment;
	type OnTimestampSet = ();
	type MinimumPeriod = MinimumPeriod;
	type WeightInfo = ();
}

impl pallet_aura::Config for Runtime {
	type AuthorityId = sp_consensus_aura::sr25519::AuthorityId;
	type MaxAuthorities = MaxAuthorities;
	type DisabledValidators = ();
	type AllowMultipleBlocksPerSlot = ConstBool<false>;
}

impl pallet_grandpa::Config for Runtime {
	type RuntimeEvent = RuntimeEvent;
	type KeyOwnerProof = SessionHandler;
	type EquivocationReportSystem = ();
	type WeightInfo = ();
	type MaxAuthorities = MaxAuthorities;
	type MaxSetIdSessionEntries = MaxSetIdSessionEntries;
}

impl pallet_balances::Config for Runtime {
	type Balance = Balance;
	type DustRemoval = ();
	type RuntimeEvent = RuntimeEvent;
	type ExistentialDeposit = ExistentialDeposit;
	type AccountStore = System;
	type MaxLocks = ConstU32<50>;
	type MaxReserves = ConstU32<50>;
	type MaxHolds = ConstU32<0>;
	type MaxFreezes = ConstU32<0>;
	type ReserveIdentifier = [u8; 8];
	type FreezeIdentifier = ();
	type WeightInfo = pallet_balances::weights::SubstrateWeight<Runtime>;
	type RuntimeHoldReason = ();
}

impl pallet_transaction_payment::Config for Runtime {
	type RuntimeEvent = RuntimeEvent;
	type OnChargeTransaction = CurrencyAdapter<Balances, DealWithFees>;
	type OperationalFeeMultiplier = OperationalFeeMultiplier;
	type WeightToFee = IdentityFee<Balance>;
	type LengthToFee = ConstantMultiplier<Balance, TransactionByteFee>;
	type FeeMultiplierUpdate = ();
}

impl pallet_sudo::Config for Runtime {
	type RuntimeEvent = RuntimeEvent;
	type RuntimeCall = RuntimeCall;
	type WeightInfo = pallet_sudo::weights::SubstrateWeight<Runtime>;
}

impl pallet_atlas_kernel::Config for Runtime {
	type RuntimeEvent = RuntimeEvent;
	type Balance = Balance;
	type AssetId = AssetId;
	type AtlasId = AtlasId;
	type MaxAssetsPerAccount = MaxAssetsPerAccount;
	type MaxAssetSymbolLength = MaxAssetSymbolLength;
	type MaxPayloadLength = MaxPayloadLength;
	type WeightInfo = ();
}

// Session trait implementations for minimal runtime
#[derive(Debug, Clone, Copy, PartialEq, Eq, Encode, Decode, TypeInfo)]
pub struct SessionHandler;

impl GetValidatorCount for SessionHandler {
	fn validator_count(&self) -> u32 {
		0
	}
}

impl GetSessionNumber for SessionHandler {
	fn session(&self) -> u32 {
		0
	}
}

// sp_session::Config not available in polkadot-v1.0.0
// impl sp_session::Config for Runtime {}

// sp_session::SessionKeys trait has incompatible signatures in polkadot-v1.0.0
/*
impl sp_session::SessionKeys<Block> for Runtime {
	fn generate_session_keys(seed: Option<Vec<u8>>) -> Vec<u8> {
		SessionKeys::generate(seed)
	}

	fn decode_session_keys(encoded: Vec<u8>) -> Option<Vec<(Vec<u8>, sp_core::crypto::KeyTypeId)>> {
		SessionKeys::decode_into_raw_public_keys(&encoded)
	}
}
*/

impl_runtime_apis! {
	impl sp_api::Core<Block> for Runtime {
		fn version() -> sp_version::RuntimeVersion {
			VERSION
		}

		fn execute_block(block: Block) {
			Executive::execute_block(block);
		}

		fn initialize_block(header: &<Block as BlockT>::Header) {
			Executive::initialize_block(header);
		}
	}
}

#[cfg(feature = "std")]
pub fn atlas_kernel_default_assets() -> Vec<(AssetId, Vec<u8>, u8)> {
	vec![
		(0, b"ATLAS".to_vec(), 12),
		(1, b"ETH".to_vec(), 18),
		(2, b"SOL".to_vec(), 9),
		(3, b"USDC".to_vec(), 6),
	]
}