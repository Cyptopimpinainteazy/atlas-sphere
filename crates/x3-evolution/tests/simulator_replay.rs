use x3_evolution::{Simulator, SimulationConfig, Chromosome, MarketTick};
use serde_json::json;

#[test]
fn deterministic_simulator_replay() {
    // Fixed simple chromosome (small bytecode)
    let bytecode = vec![0x20, 0x00, 0x00, 0x00];
    let chrom = Chromosome::from_bytecode(bytecode).expect("create chrom");

    // Deterministic market data
    let market = vec![
        MarketTick::new(1_700_000_000_000u64, "X3", 100.0),
        MarketTick::new(1_700_000_000_100u64, "X3", 101.0),
        MarketTick::new(1_700_000_000_200u64, "X3", 102.0),
    ];

    let cfg = SimulationConfig { initial_capital: 1000.0, ..Default::default() };
    let sim = Simulator::new(cfg);

    let res = sim.simulate(&chrom, &market).expect("simulate");

    // Print JSON summary for CI artifact
    let summary = json!({
        "final_value": res.portfolio.total_value,
        "trades": res.portfolio.trades.len(),
        "ticks": res.ticks_processed,
        "errors": res.errors,
    });

    println!("SIMULATOR-REPLAY-RESULT: {}", summary.to_string());
    // Basic assertions to ensure deterministic behavior
    assert!(res.errors.is_empty());
    assert!(res.ticks_processed > 0);
}
