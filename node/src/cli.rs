use clap::{Args, Parser, Subcommand};
use sc_cli::{
    ChainSpec, CheckBlockCmd, ExportBlocksCmd, ExportStateCmd, ImportBlocksCmd, PurgeChainCmd,
    RevertCmd, RunCmd, SubstrateCli,
};
use sp_core::H256;
use std::path::PathBuf;

/// Command line options for the Atlas Sphere node binary.
///
/// This CLI mirrors the ergonomics of other Substrate-based chains while
/// highlighting the dual-VM Atlas Sphere architecture.
#[derive(Debug, Parser)]
#[command(
    name = "Atlas Sphere Node",
    bin_name = "atlas-sphere-node",
    author,
    version,
    about = "Run and manage the 3i Atlas Sphere L1 blockchain node",
    long_about = "Atlas Sphere is a dual-VM (EVM + SVM) Layer-1 built \
    for atomic cross-chain operations and native asset orchestration. \
    Use this CLI to operate validator, collator, and archival nodes, or \
    to inspect and craft chain specifications.",
    propagate_version = true,
    disable_help_subcommand = true,
    next_display_order = None
)]
pub struct Cli {
    /// Subcommand invoked by the user.
    #[command(subcommand)]
    pub subcommand: Option<Commands>,

    /// Run command parameters shared with most subcommands.
    #[command(flatten)]
    pub run: RunCmd,
}

/// Atlas Sphere node subcommands.
///
/// These commands provide access to node lifecycle management, chain
/// specification authoring, and runtime state inspection routines.
#[derive(Debug, Subcommand)]
pub enum Commands {
    /// Build a chainspec to bootstrap new networks or inspect configuration.
    BuildSpec(sc_cli::BuildSpecCmd),
    /// Validate blocks against the runtime execution logic.
    CheckBlock(CheckBlockCmd),
    /// Export blocks to a file for archival or debugging purposes.
    ExportBlocks(ExportBlocksCmd),
    /// Export full runtime state at a given block into a snapshot file.
    ExportState(ExportStateCmd),
    /// Import blocks from a file into the local database.
    ImportBlocks(ImportBlocksCmd),
    /// Remove the local database (be careful!).
    PurgeChain(PurgeChainCmd),
    /// Revert the chain to a previous state.
    Revert(RevertCmd),
    /// Run built-in benchmarking harnesses.
    #[cfg(feature = "runtime-benchmarks")]
    Benchmark(frame_benchmarking_cli::BenchmarkCmd),
    /// Execute try-runtime checks against on-chain state.
    #[cfg(feature = "try-runtime")]
    TryRuntime(sc_cli::TryRuntimeCmd),
    /// Atomic swap simulation and execution commands.
    AtomicSwap(AtomicSwapCmd),
}

/// Atomic swap CLI commands for simulating and executing cross-VM trades.
///
/// These commands provide offline simulation capabilities for AI agents
/// and frontends to preview trade execution before submitting transactions.
#[derive(Debug, Args)]
pub struct AtomicSwapCmd {
    #[command(subcommand)]
    pub command: AtomicSwapSubcommand,
}

/// Atomic swap subcommands
#[derive(Debug, Subcommand)]
pub enum AtomicSwapSubcommand {
    /// Simulate a trade path without execution.
    ///
    /// Returns estimated output, gas costs, price impact, and optimal route.
    /// Use this before submitting transactions to verify expected outcomes.
    Simulate {
        /// Input token (H256 hex string, e.g., 0x0001...0000)
        #[arg(long, value_parser = parse_h256)]
        token_in: H256,

        /// Output token (H256 hex string)
        #[arg(long, value_parser = parse_h256)]
        token_out: H256,

        /// Amount of input tokens (in smallest unit)
        #[arg(long)]
        amount: u128,

        /// Maximum slippage tolerance in basis points (default: 100 = 1%)
        #[arg(long, default_value = "100")]
        slippage_bps: u32,

        /// RPC endpoint URL
        #[arg(long, default_value = "http://127.0.0.1:9944")]
        rpc_url: String,
    },

    /// Get current price data for a token pair.
    Price {
        /// First token (H256 hex string)
        #[arg(long, value_parser = parse_h256)]
        token_a: H256,

        /// Second token (H256 hex string)
        #[arg(long, value_parser = parse_h256)]
        token_b: H256,

        /// RPC endpoint URL
        #[arg(long, default_value = "http://127.0.0.1:9944")]
        rpc_url: String,
    },

    /// Estimate execution costs for a multi-leg trade.
    EstimateCost {
        /// Number of trade legs
        #[arg(long)]
        legs: u32,

        /// VM types for each leg (comma-separated: evm,svm,crossvm)
        #[arg(long, value_delimiter = ',')]
        vm_types: Vec<String>,
    },
}

/// Parse H256 from hex string
fn parse_h256(s: &str) -> Result<H256, String> {
    let s = s.strip_prefix("0x").unwrap_or(s);
    let bytes = hex::decode(s).map_err(|e| format!("Invalid hex: {}", e))?;
    if bytes.len() != 32 {
        return Err(format!("Expected 32 bytes, got {}", bytes.len()));
    }
    let mut arr = [0u8; 32];
    arr.copy_from_slice(&bytes);
    Ok(H256::from(arr))
}

impl SubstrateCli for Cli {
    fn impl_name() -> String {
        "Atlas Sphere Node".into()
    }

    fn impl_version() -> String {
        env!("CARGO_PKG_VERSION").into()
    }

    fn description() -> String {
        "Atlas Sphere: Dual-VM (EVM + SVM) Layer-1 with atomic cross-chain primitives.".into()
    }

    fn author() -> String {
        env!("CARGO_PKG_AUTHORS").replace(':', ", ")
    }

    fn support_url() -> String {
        "https://atlas-sphere.io/support".into()
    }

    fn copyright_start_year() -> i32 {
        2024
    }

    fn executable_name() -> String {
        "atlas-sphere-node".into()
    }

    fn load_spec(&self, id: &str) -> Result<Box<dyn ChainSpec>, String> {
        let spec = match id {
            "" | "dev" => crate::chain_spec::development_config(),
            "local" => crate::chain_spec::local_testnet_config(),
            "staging" | "staging-net" => crate::chain_spec::staging_config(),
            path => crate::chain_spec::ChainSpec::from_json_file(PathBuf::from(path)),
        }?;
        Ok(Box::new(spec))
    }
}
