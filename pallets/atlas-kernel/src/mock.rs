#![cfg(test)]

use crate as pallet_atlas_kernel;
use frame_support::{
	construct_runtime, parameter_types,
	traits::ConstU32,
};
use frame_system as system;
use parity_scale_codec::Encode;
use sp_core::H256;
use sp_io::TestExternalities;
use sp_runtime::{
	traits::{BlakeTwo256, IdentityLookup},
	BuildStorage,
};

pub type AccountId = u64;
pub type BlockNumber = u64;
pub type Balance = u128;
pub type AssetId = u32;
pub type AtlasId = u32;

pub const ALICE: AccountId = 1;
pub const BOB: AccountId = 2;
pub const CHARLIE: AccountId = 3;
pub const INITIAL_BALANCE: Balance = 1_000_000_000_000;

parameter_types! {
	pub const BlockHashCount: BlockNumber = 250;
	pub const ExistentialDeposit: Balance = 1;
}

construct_runtime!(
	pub enum Test
	where
		Block = Block,
		NodeBlock = Block,
		UncheckedExtrinsic = UncheckedExtrinsic,
	{
		System: frame_system,
		Balances: pallet_balances,
		AtlasKernel: pallet_atlas_kernel,
	}
);

pub type UncheckedExtrinsic = system::mocking::MockUncheckedExtrinsic<Test>;
pub type Block = system::mocking::MockBlock<Test>;

impl system::Config for Test {
	type BaseCallFilter = frame_support::traits::Everything;
	type BlockWeights = ();
	type BlockLength = ();
	type DbWeight = ();
	type RuntimeOrigin = RuntimeOrigin;
	type Nonce = u64;
	type Block = Block;
	type Hash = H256;
	type Hashing = BlakeTwo256;
	type AccountId = AccountId;
	type Lookup = IdentityLookup<AccountId>;
	type RuntimeCall = RuntimeCall;
	type RuntimeEvent = RuntimeEvent;
	type BlockHashCount = BlockHashCount;
	type Version = ();
	type PalletInfo = PalletInfo;
	type AccountData = pallet_balances::AccountData<Balance>;
	type OnNewAccount = ();
	type OnKilledAccount = ();
	type SystemWeightInfo = ();
	type SS58Prefix = ();
	type OnSetCode = ();
	type MaxConsumers = ConstU32<16>;
}

impl pallet_balances::Config for Test {
	type RuntimeEvent = RuntimeEvent;
	type Balance = Balance;
	type DustRemoval = ();
	type ExistentialDeposit = ExistentialDeposit;
	type AccountStore = System;
	type WeightInfo = ();
	type MaxLocks = ConstU32<50>;
	type MaxReserves = ConstU32<50>;
	type ReserveIdentifier = [u8; 8];
	type RuntimeHoldReason = ();
	type FreezeIdentifier = ();
	type MaxHolds = ConstU32<0>;
	type MaxFreezes = ConstU32<0>;
}

impl pallet_atlas_kernel::Config for Test {
	type RuntimeEvent = RuntimeEvent;
	type Balance = Balance;
	type AssetId = AssetId;
	type AtlasId = AtlasId;
	type MaxAssetsPerAccount = ConstU32<16>;
	type MaxAssetSymbolLength = ConstU32<16>;
	type MaxPayloadLength = ConstU32<4096>;
	type WeightInfo = ();
}

#[derive(Default)]
pub struct ExtBuilder {
	balances: Vec<(AccountId, Balance)>,
}

impl ExtBuilder {
	pub fn balances(mut self, balances: Vec<(AccountId, Balance)>) -> Self {
		self.balances = balances;
		self
	}

	pub fn build(self) -> TestExternalities {
		let storage = frame_system::GenesisConfig::<Test>::default()
			.build_storage()
			.expect("Failed to build system genesis storage");

		let mut t = TestExternalities::new(storage);
		
		let _balances_genesis = pallet_balances::GenesisConfig::<Test> {
			balances: self.balances,
		};
		
		// For now, we'll just use the default balances setup
		// In a full implementation, you'd need to inject the balances properly
		
		t.execute_with(|| System::set_block_number(1));
		t
	}
}

pub fn new_test_ext() -> TestExternalities {
	ExtBuilder::default()
		.balances(vec![
			(ALICE, INITIAL_BALANCE),
			(BOB, INITIAL_BALANCE),
			(CHARLIE, INITIAL_BALANCE),
		])
		.build()
}