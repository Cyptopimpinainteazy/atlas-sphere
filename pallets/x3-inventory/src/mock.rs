use crate as pallet_x3_inventory;
use frame_support::{derive_impl, parameter_types};
use sp_runtime::BuildStorage;

type Block = frame_system::mocking::MockBlock<Test>;

frame_support::construct_runtime!(
    pub enum Test {
        System: frame_system,
        X3Inventory: pallet_x3_inventory,
    }
);

#[derive_impl(frame_system::config_preludes::TestDefaultConfig)]
impl frame_system::Config for Test {
    type Block = Block;
}

parameter_types! {
    pub const MaxLiquiditySources: u32 = 8;
}

impl pallet_x3_inventory::Config for Test {
    type RuntimeEvent = RuntimeEvent;
    // u128 satisfies Zero + Add + Sub + PartialOrd + Default + Copy etc.
    type Balance = u128;
    type MaxLiquiditySources = MaxLiquiditySources;
}

pub fn new_test_ext() -> sp_io::TestExternalities {
    frame_system::GenesisConfig::<Test>::default()
        .build_storage()
        .unwrap()
        .into()
}
