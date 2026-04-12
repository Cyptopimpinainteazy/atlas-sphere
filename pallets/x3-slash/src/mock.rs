//! Test mock runtime.

use crate as pallet_x3_slash;
use frame_support::{
    construct_runtime, parameter_types,
    traits::{Everything, OnInitialize},
};
use frame_system as system;
use pallet_balances as balances;
use sp_core::H256;
use sp_runtime::{
    testing::Header,
    traits::{BlakeTwo256, IdentityLookup},
    AccountId32,
};

type AccountId = AccountId32;
type Balance = u128;
type Block = frame_system::mocking::MockBlock<Test>;

parameter_types! {
    pub const BlockHashCount: u64 = 250;
    pub const SS58Prefix: u8 = 42;
}

impl system::Config for Test {
    type BaseCallFilter = Everything;
    type BlockWeights = ();
    type BlockLength = ();
    type DbWeight = ();
    type RuntimeOrigin = RuntimeOrigin;
    type RuntimeCall = RuntimeCall;
    type Index = u64;
    type BlockNumber = u64;
    type Hash = H256;
    type Hashing = BlakeTwo256;
    type AccountId = AccountId;
    type Lookup = IdentityLookup<Self::AccountId>;
    type Header = Header;
    type RuntimeEvent = RuntimeEvent;
    type BlockHashCount = BlockHashCount;
    type Version = ();
    type PalletInfo = PalletInfo;
    type AccountData = balances::AccountData<Balance>;
    type OnNewAccount = ();
    type OnKilledAccount = ();
    type SystemWeightInfo = ();
    type SS58Prefix = SS58Prefix;
    type OnSetCode = ();
    type MaxConsumers = frame_support::traits::ConstU32<16>;
}

parameter_types! {
    pub const ExistentialDeposit: u128 = 500;
    pub const MaxLocks: u32 = 50;
}

impl balances::Config for Test {
    type MaxLocks = MaxLocks;
    type MaxReserves = ();
    type ReserveIdentifier = [u8; 8];
    type Balance = Balance;
    type RuntimeEvent = RuntimeEvent;
    type DustRemoval = ();
    type ExistentialDeposit = ExistentialDeposit;
    type AccountStore = system::Pallet<Test>;
    type WeightInfo = ();
}

parameter_types! {
    pub const MinBondAmount: u128 = 1_000_000;
    pub const FinalityWindow: u64 = 100;
    pub const ReputationDamageEnabled: bool = true;
}

impl pallet_x3_slash::Config for Test {
    type RuntimeEvent = RuntimeEvent;
    type SlashWeightInfo = pallet_x3_slash::weights::SubstrateWeight<Test>;
    type Currency = balances::Pallet<Test>;
    type MinBondAmount = MinBondAmount;
    type FinalityWindow = FinalityWindow;
    type ReputationDamageEnabled = ReputationDamageEnabled;
    type SlashRecipient = system::Pallet<Test>;
}

construct_runtime!(
    pub enum Test where
        Block = Block,
        NodeBlock = Block,
        UncheckedExtrinsic = frame_system::mocking::MockUncheckedExtrinsic<Test>,
    {
        System: frame_system = 0,
        Balances: balances = 1,
        Slash: pallet_x3_slash = 2,
    }
);

pub fn new_test_ext() -> sp_io::TestExternalities {
    let mut t = system::GenesisConfig::default()
        .build_storage::<Test>()
        .unwrap();

    balances::GenesisConfig::<Test> {
        balances: vec![
            (AccountId32::from([0u8; 32]), 1_000_000_000u128),
            (AccountId32::from([1u8; 32]), 1_000_000_000u128),
        ],
    }
    .assimilate_storage(&mut t)
    .unwrap();

    t.into()
}
