//! Weight information for X3 Settlement Engine extrinsics

use frame_support::weights::Weight;

/// Weight functions trait
pub trait WeightInfo {
    fn create_intent() -> Weight;
    fn lock_escrow() -> Weight;
    fn submit_proof() -> Weight;
    fn claim_settlement() -> Weight;
    fn refund_settlement() -> Weight;
    fn submit_btc_proof() -> Weight;
    fn submit_btc_header() -> Weight;
    fn update_finality_config() -> Weight;
    fn report_violation() -> Weight;
}

/// Default weights for testing
impl WeightInfo for () {
    fn create_intent() -> Weight {
        Weight::from_parts(50_000_000, 0)
    }
    fn lock_escrow() -> Weight {
        Weight::from_parts(75_000_000, 0)
    }
    fn submit_proof() -> Weight {
        Weight::from_parts(100_000_000, 0)
    }
    fn claim_settlement() -> Weight {
        Weight::from_parts(150_000_000, 0)
    }
    fn refund_settlement() -> Weight {
        Weight::from_parts(100_000_000, 0)
    }
    fn submit_btc_proof() -> Weight {
        Weight::from_parts(200_000_000, 0)
    }
    fn submit_btc_header() -> Weight {
        Weight::from_parts(50_000_000, 0)
    }
    fn update_finality_config() -> Weight {
        Weight::from_parts(25_000_000, 0)
    }
    fn report_violation() -> Weight {
        Weight::from_parts(75_000_000, 0)
    }
}
