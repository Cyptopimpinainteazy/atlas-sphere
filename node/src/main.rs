use std::process;

use atlas_sphere_node::{cli::Cli, command};
use clap::Parser;
use log::info;
use sc_cli::{Result as CliResult, VersionInfo};

fn main() {
    if let Err(error) = run() {
        eprintln!("\n[Atlas Sphere] ❌ {}", error);
        let exit_code = match error.error_code() {
            0 => 1,
            code => code,
        };
        process::exit(exit_code);
    }
}

fn run() -> CliResult<()> {
    init_logging()?;

    let version = version_info();

    info!(
        "🌌 Atlas Sphere Node v{} ({})",
        version.version, version.commit
    );
    info!(
        "🔧 Dual-VM execution (EVM + SVM) with native assets & atomic cross-chain operations."
    );
    info!("ℹ️  For full CLI usage details run: atlas-sphere-node --help");

    let cli = Cli::parse();

    command::run(cli, &version)
}

fn init_logging() -> CliResult<()> {
    sc_cli::init_logger("atlas_sphere=info,sc_service=info,sc_cli=warn")
}

fn version_info() -> VersionInfo {
    VersionInfo {
        name: "Atlas Sphere Node",
        commit: option_env!("GIT_COMMIT_HASH").unwrap_or("unknown"),
        version: env!("CARGO_PKG_VERSION"),
        executable_name: "atlas-sphere-node",
        author: "Traycer.AI • 3i Atlas Engineering",
        description:
            "Atlas Sphere L1 — a Substrate-based network delivering dual-VM (EVM + SVM) smart \
             contracts, native asset orchestration, and atomic cross-chain flows.",
        support_url: "https://docs.3i.network/atlas-sphere/support",
    }
}