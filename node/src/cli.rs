use clap::{Parser, Subcommand};
use sc_cli::{
    BuildSyncSpecCmd, ChainSpec, CheckBlockCmd, ExportBlocksCmd, ExportStateCmd, ImportBlocksCmd,
    PurgeChainCmd, RevertCmd, RunCmd, SubstrateCli,
};
use sc_service::RuntimeVersion;
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
    ///
    /// The suite covers the default run pipeline, build{,-sync}-spec generation,
    /// and import/export workflows required for validator and operator tooling.
    #[derive(Debug, Subcommand)]
    pub enum Commands {
        /// Build a chainspec to bootstrap new networks or inspect configuration.
        BuildSpec(sc_cli::BuildSpecCmd),
        /// Build a raw sync chainspec used to distribute full network definitions.
        BuildSyncSpec(BuildSyncSpecCmd),
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
    /// Vanity address generation utilities.
    Vanity(sc_cli::VanityCmd),
    /// Subcommands for account/key management.
    Key(sc_cli::KeySubcommand),
    /// Sign a message, transactions, or arbitrary payloads.
    Sign(sc_cli::SignCmd),
    /// Verify signatures against messages and accounts.
    Verify(sc_cli::VerifyCmd),
    /// Generate or inspect node identity keys.
    Identity(sc_cli::IdentityCmd),
    /// Inspect chain metadata, constants, and storage without spinning up a node.
    ChainInfo(sc_cli::ChainInfoCmd),
    /// Run built-in benchmarking harnesses.
    #[cfg(feature = "runtime-benchmarks")]
    Benchmark(frame_benchmarking_cli::BenchmarkCmd),
    /// Execute try-runtime checks against on-chain state.
    #[cfg(feature = "try-runtime")]
    TryRuntime(sc_cli::TryRuntimeCmd),
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
            "staging" | "staging-net" => crate::chain_spec::staging_network_config(),
            path => crate::chain_spec::ChainSpec::from_json_file(PathBuf::from(path)),
        }?;
        Ok(Box::new(spec))
    }

    fn native_runtime_version(_: &Box<dyn ChainSpec>) -> &'static RuntimeVersion {
        &atlas_sphere_runtime::VERSION
    }
}
