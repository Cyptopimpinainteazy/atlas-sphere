//! Mock runtime for testing X3 Coin pallet

use super::*;
use frame_support::{
    construct_runtime, parameter_types,
    traits::{ConstU32, ConstU64, GenesisBuild},
};
use frame_system::EnsureSigned;
use sp_core::H256;
use sp_runtime::{
    testing::Header,
    traits::{BlakeTwo256, IdentityLookup},
    BuildStorage,
};

type UncheckedExtrinsic = frame_system::mocking::MockUncheckedExtrinsic<Test>;
type Block = frame_system::mocking::MockBlock<Test>;

construct_runtime!(
    pub enum Test
    {
        System: frame_system,
        Balances: pallet_balances,
        X3Coin: pallet_x3_coin,
        X3Kernel: pallet_x3_kernel,
    }
);

parameter_types! {
    pub const BlockHashCount: u64 = 250;
    pub BlockWeights: frame_system::limits::BlockWeights =
        frame_system::limits::BlockWeights::simple_max(
            frame_support::weights::Weight::from_parts(1024, 0)
        );
}

impl frame_system::Config for Test {
    type BaseCallFilter = frame_support::traits::Everything;
    type BlockWeights = ();
    type BlockLength = ();
    type DbWeight = ();
    type RuntimeOrigin = RuntimeOrigin;
    type RuntimeCall = RuntimeCall;
    type Nonce = u64;
    type Hash = H256;
    type Hashing = BlakeTwo256;
    type AccountId = u64;
    type Lookup = IdentityLookup<Self::AccountId>;
    type Block = Block;
    type RuntimeEvent = RuntimeEvent;
    type BlockHashCount = BlockHashCount;
    type Version = ();
    type PalletInfo = PalletInfo;
    type AccountData = pallet_balances::AccountData<u64>;
    type OnNewAccount = ();
    type OnKilledAccount = ();
    type SystemWeightInfo = ();
    type SS58Prefix = ();
    type OnSetCode = ();
    type MaxConsumers = frame_support::traits::ConstU32<16>;
}

parameter_types! {
    pub const ExistentialDeposit: u64 = 1;
}

impl pallet_balances::Config for Test {
    type Balance = u64;
    type RuntimeEvent = RuntimeEvent;
    type DustRemoval = ();
    type ExistentialDeposit = ExistentialDeposit;
    type AccountStore = System;
    type WeightInfo = ();
    type MaxLocks = ();
    type MaxReserves = ();
    type ReserveIdentifier = [u8; 8];
}

parameter_types! {
    pub const TreasuryAccount: u64 = 1;
    pub const MaxBonusClaims: u32 = 10;
    pub const TeamVestingBlocks: u64 = 15_768_000;
    pub const TeamVestingCliff: u64 = 7_884_000;
    pub const BonusClaimPeriod: u64 = 3_942_000;
}

impl pallet_x3_kernel::Config for Test {
    type RuntimeEvent = RuntimeEvent;
    type UnixTime = ();
    type WeightInfo = ();
    type MaxAssets = ConstU32<100>;
    type MaxAccounts = ConstU32<1000>;
    type MaxTransfers = ConstU32<1000>;
    type MaxOperations = ConstU32<1000>;
    type MaxProofs = ConstU32<100>;
    type MaxCrossChainOperations = ConstU32<100>;
    type MaxCrossChainProofs = ConstU32<100>;
    type MaxCrossChainTransfers = ConstU32<100>;
    type MaxCrossChainClaims = ConstU32<100>;
    type MaxCrossChainVestingSchedules = ConstU32<100>;
    type MaxCrossChainBonusClaims = ConstU32<100>;
    type MaxCrossChainOperationsPerBlock = ConstU32<100>;
    type MaxCrossChainProofsPerBlock = ConstU32<100>;
    type MaxCrossChainTransfersPerBlock = ConstU32<100>;
    type MaxCrossChainClaimsPerBlock = ConstU32<100>;
    type MaxCrossChainVestingSchedulesPerBlock = ConstU32<100>;
    type MaxCrossChainBonusClaimsPerBlock = ConstU32<100>;
}

impl Config for Test {
    type RuntimeEvent = RuntimeEvent;
    type UnixTime = ();
    type WeightInfo = ();
    type TreasuryAccount = TreasuryAccount;
    type MaxBonusClaims = MaxBonusClaims;
    type TeamVestingBlocks = TeamVestingBlocks;
    type TeamVestingCliff = TeamVestingCliff;
    type BonusClaimPeriod = BonusClaimPeriod;
}

pub fn new_test_ext() -> sp_io::TestExternalities {
    let mut t = frame_system::GenesisConfig::<Test>::default()
        .build_storage()
        .unwrap();

    pallet_balances::GenesisConfig::<Test> {
        balances: vec![
            (1, 1000), // Treasury
            (2, 0),    // Team member
            (3, 0),    // Ecosystem partner
            (4, 0),    // Liquidity provider
            (5, 0),    // Bonus claimer
            (6, 0),    // Cross chain user
        ],
    }
    .assimilate_storage(&mut t)
    .unwrap();

    pallet_x3_kernel::GenesisConfig::<Test> {
        // Empty genesis config for X3 Kernel
    }
    .assimilate_storage(&mut t)
    .unwrap();

    pallet_x3_coin::GenesisConfig::<Test> {
        team_allocations: vec![(2, 300_000_000_000_000_000_000)],
        ecosystem_allocations: vec![(3, 500_000_000_000_000_000_000)],
        liquidity_allocations: vec![(4, 600_000_000_000_000_000_000)],
    }
    .assimilate_storage(&mut t)
    .unwrap();

    let mut ext = sp_io::TestExternalities::new(t);
    ext.execute_with(|| System::set_block_number(1));
    ext
}
