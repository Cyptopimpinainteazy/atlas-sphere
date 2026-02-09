//! X3 Benchmark Runner
//!
//! Compiles source fixtures through the X3 pipeline and compares:
//! - No optimization (baseline)
//! - With optimizer passes enabled
//!
//! Measures: instruction count, simulated gas, bytecode size.
//!
//! CLI flags (used by `tools/yolo_run.sh`):
//!   --baseline     Run only baseline (no optimizer)
//!   --yolo         Run with optimizer (YOLO pass)
//!   --out <DIR>    Override output directory

use anyhow::Result;
use chrono::Utc;
use std::env;
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

    // Parse simple CLI flags for YOLO harness compatibility
    let args: Vec<String> = env::args().collect();
    let is_baseline = args.iter().any(|a| a == "--baseline");
    let is_yolo = args.iter().any(|a| a == "--yolo");
    let custom_out = args
        .iter()
        .position(|a| a == "--out")
        .and_then(|i| args.get(i + 1))
        .map(PathBuf::from);

    let mode_label = if is_baseline {
        "Baseline"
    } else if is_yolo {
        "YOLO Pass"
    } else {
        "Full (baseline + optimizer)"
    };

    println!("═══════════════════════════════════════════════════════════════");
    println!("                    X3 Optimizer Benchmark");
    println!("  Mode: {}", mode_label);
    println!("═══════════════════════════════════════════════════════════════");
    println!();

    // Config: if --baseline, disable optimizer (0 iters); if --yolo, 6 iters
    let max_opt_iters = if is_baseline { 0 } else { 6 };

    let cfg = BenchConfig {
        max_opt_iters,
        output_dir: PathBuf::from("bench-results"),
        csv_filename: "bench-results.csv".into(),
    };

    // Determine output dir
    let outdir = if let Some(ref p) = custom_out {
        p.clone()
    } else {
        let ts = Utc::now().format("%Y%m%dT%H%M%SZ").to_string();
        cfg.output_dir.join(&ts)
    };
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

    // Emit report.json for YOLO harness consumption
    {
        let total_gas: u64 = results.iter().map(|r| r.new_gas).sum();
        let total_instrs: usize = results.iter().map(|r| r.new_instrs).sum();
        let total_bytes: usize = results.iter().map(|r| r.new_bytes).sum();
        let report = serde_json::json!({
            "global": {
                "gas": total_gas,
                "instr": total_instrs,
                "bytes": total_bytes,
                "samples": results.len(),
                "mode": mode_label,
            }
        });
        let report_path = outdir.join("report.json");
        let mut f = File::create(&report_path)?;
        f.write_all(serde_json::to_string_pretty(&report)?.as_bytes())?;
        println!("📊 Saved report → {}", report_path.display());
    }

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
