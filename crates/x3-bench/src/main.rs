//! X3 Benchmark Runner
//!
//! Compiles source fixtures through the X3 pipeline and compares:
//! - No optimization (baseline)
//! - With optimizer passes enabled
//!
//! Measures: instruction count, simulated gas, bytecode size.

use anyhow::Result;
use chrono::Utc;
use std::fs::{create_dir_all, File};
use std::io::Write;
use std::path::PathBuf;

mod pipeline;
mod runner;
mod samples;

use runner::{run_benchmarks_and_report, BenchConfig};

fn main() -> Result<()> {
    // Initialize logging
    env_logger::Builder::from_env(env_logger::Env::default().default_filter_or("info")).init();

    println!("═══════════════════════════════════════════════════════════════");
    println!("                    X3 Optimizer Benchmark");
    println!("═══════════════════════════════════════════════════════════════");
    println!();

    // Config
    let cfg = BenchConfig {
        max_opt_iters: 6,
        output_dir: PathBuf::from("bench-results"),
        csv_filename: "bench-results.csv".into(),
    };

    // Ensure output dir with timestamp
    let ts = Utc::now().format("%Y%m%dT%H%M%SZ").to_string();
    let outdir = cfg.output_dir.join(&ts);
    create_dir_all(&outdir)?;

    // Run benchmarks
    let results = run_benchmarks_and_report(&cfg, &samples::sample_suite(), &outdir)?;

    // Save CSV
    let csv_path = outdir.join(&cfg.csv_filename);
    let mut wtr = csv::Writer::from_path(&csv_path)?;
    wtr.write_record([
        "name",
        "old_instrs",
        "new_instrs",
        "instr_delta",
        "old_gas",
        "new_gas",
        "gas_delta",
        "old_bytes",
        "new_bytes",
        "bytes_delta",
        "notes",
    ])?;
    for r in &results {
        wtr.serialize(r)?;
    }
    wtr.flush()?;
    println!();
    println!("📄 Saved CSV → {}", csv_path.display());

    // Save raw artifacts (bytecode blobs) for reproducibility
    for r in &results {
        let sub = outdir.join(&r.name);
        create_dir_all(&sub)?;
        // old bytecode
        let mut f = File::create(sub.join("old_bytecode.bin"))?;
        f.write_all(&r.old_bytecode)?;
        // new bytecode
        let mut f2 = File::create(sub.join("new_bytecode.bin"))?;
        f2.write_all(&r.new_bytecode)?;
        // Source
        let mut f3 = File::create(sub.join("source.x3"))?;
        f3.write_all(r.source.as_bytes())?;
    }

    println!("📁 Artifacts saved to: {}/", outdir.display());
    println!();
    println!("═══════════════════════════════════════════════════════════════");
    println!("                     Benchmark Complete");
    println!("═══════════════════════════════════════════════════════════════");

    Ok(())
}
