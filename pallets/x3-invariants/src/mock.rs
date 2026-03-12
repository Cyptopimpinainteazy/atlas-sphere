//! Test mock for pallet-x3-invariants.

use frame_support::{
    derive_impl, parameter_types,
    traits::{ConstU128, ConstU32, ConstU64},
};
use sp_runtime::BuildStorage;

type Block = frame_system::mocking::MockBlock<Test>;

frame_support::construct_runtime!(
    pub enum Test {
        System: frame_system,
        Invariants: crate,
    }
);

#[derive_impl(frame_system::config_preludes::TestDefaultConfig as frame_system::DefaultConfig)]
impl frame_system::Config for Test {
    type Block = Block;
}

parameter_types! {
    pub const DefaultMaxSupply: u128 = 1_000_000_000_000_000_000u128; // 1 billion tokens (18 dec)
    pub const DefaultMaxAgents: u32 = 10_000;
    pub const DefaultMaxProposalDepth: u32 = 100;
}

impl crate::Config for Test {
    type RuntimeEvent = RuntimeEvent;
    type UpdateOrigin = frame_system::EnsureRoot<u64>;
    type DefaultMaxSupply = DefaultMaxSupply;
    type DefaultMaxAgents = DefaultMaxAgents;
    type DefaultMaxProposalDepth = DefaultMaxProposalDepth;
    type WeightInfo = ();
}

pub fn new_test_ext() -> sp_io::TestExternalities {
    let mut t = frame_system::GenesisConfig::<Test>::default()
        .build_storage()
        .unwrap();
    crate::GenesisConfig::<Test> {
        max_supply: 1_000_000_000_000_000_000u128,
        max_agents: 10_000,
        max_proposal_depth: 100,
        halt_on_violation: false,
        constitution_hash: [0u8; 32],
        _phantom: Default::default(),
    }
    .assimilate_storage(&mut t)
    .unwrap();
    t.into()
}
