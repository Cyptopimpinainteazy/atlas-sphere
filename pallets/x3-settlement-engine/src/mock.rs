//! Mock runtime for x3-settlement-engine pallet tests.

use crate as pallet_x3_settlement_engine;
use frame_support::{derive_impl, parameter_types, traits::ConstU32};
use frame_system::EnsureRoot;
use sp_runtime::{traits::{BlakeTwo256, IdentityLookup}, BuildStorage};
use sp_core::H256;

type Block = frame_system::mocking::MockBlock<Test>;

frame_support::construct_runtime!(
    pub enum Test {
        System: frame_system,
        Balances: pallet_balances,
        Timestamp: pallet_timestamp,
        X3SettlementEngine: pallet_x3_settlement_engine,
    }
);

#[derive_impl(frame_system::config_preludes::TestDefaultConfig)]
impl frame_system::Config for Test {
    type BaseCallFilter = frame_support::traits::Everything;
    type BlockWeights = ();
    type BlockLength = ();
    type DbWeight = ();
    type RuntimeOrigin = RuntimeOrigin;
    type RuntimeCall = RuntimeCall;
    type Nonce = u64;
    type Hash = sp_core::H256;
    type Hashing = BlakeTwo256;
    type AccountId = u64;
    type Lookup = IdentityLookup<Self::AccountId>;
    type Block = Block;
    type RuntimeEvent = RuntimeEvent;
    type BlockHashCount = frame_support::traits::ConstU64<250>;
    type Version = ();
    type PalletInfo = PalletInfo;
    type AccountData = pallet_balances::AccountData<u128>;
    type OnNewAccount = ();
    type OnKilledAccount = ();
    type SystemWeightInfo = ();
    type SS58Prefix = ();
    type OnSetCode = ();
    type MaxConsumers = frame_support::traits::ConstU32<16>;
}

impl pallet_balances::Config for Test {
    type MaxLocks = frame_support::traits::ConstU32<50>;
    type MaxReserves = frame_support::traits::ConstU32<50>;
    type ReserveIdentifier = [u8; 8];
    type Balance = u128;
    type RuntimeEvent = RuntimeEvent;
    type DustRemoval = ();
    type ExistentialDeposit = frame_support::traits::ConstU128<1>;
    type AccountStore = System;
    type WeightInfo = ();
    type FreezeIdentifier = ();
    type MaxFreezes = frame_support::traits::ConstU32<0>;
    type MaxHolds = frame_support::traits::ConstU32<0>;
    type RuntimeHoldReason = ();
}

impl pallet_timestamp::Config for Test {
    type Moment = u64;
    type OnTimestampSet = ();
    type MinimumPeriod = frame_support::traits::ConstU64<1>;
    type WeightInfo = ();
}

parameter_types! {
    pub const SomeDeposit: u128 = 1000;
}

impl pallet_x3_settlement_engine::Config for Test {
    type RuntimeEvent = RuntimeEvent;
    type SettlementWeightInfo = ();
    type Currency = Balances;
    type UnixTime = pallet_timestamp::Pallet<Test>;
    type MaxSettlementLegs = frame_support::traits::ConstU32<4>;
    type MaxPendingIntents = frame_support::traits::ConstU32<10>;
    type DefaultSettlementTimeout = frame_support::traits::ConstU64<60>;
    type MinBtcConfirmations = frame_support::traits::ConstU32<1>;
    type ChallengePeriod = frame_support::traits::ConstU64<10>;
    type WeightInfo = ();
}

// Test accounts
pub const ALICE: u64 = 1;
pub const BOB: u64 = 2;

/// Build test externalities.
pub fn new_test_ext() -> sp_io::TestExternalities {
    let mut t = frame_system::GenesisConfig::<Test>::default()
        .build_storage()
        .unwrap();

    pallet_balances::GenesisConfig::<Test> {
        balances: vec![(ALICE, 1_000_000), (BOB, 1_000_000)],
    }
    .assimilate_storage(&mut t)
    .unwrap();

    let mut ext = sp_io::TestExternalities::new(t);
    ext.execute_with(|| System::set_block_number(1));
    ext
}

