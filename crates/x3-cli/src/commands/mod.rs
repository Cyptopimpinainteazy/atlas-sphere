//! CLI commands for x3.

use clap::{Parser, Subcommand};

pub mod init;
pub mod build;
pub mod deploy;
pub mod test;
pub mod trace;
pub mod simulate;
pub mod docgen;
pub mod account;
pub mod query;
pub mod tx;

/// x3 - Atlas Sphere CLI
#[derive(Parser)]
#[command(name = "x3")]
#[command(author = "Atlas Sphere Team")]
#[command(version)]
#[command(about = "CLI for Atlas Sphere blockchain development", long_about = None)]
pub struct Cli {
    #[command(subcommand)]
    pub command: Commands,
}

/// Available commands
#[derive(Subcommand)]
pub enum Commands {
    /// Initialize a new Atlas Sphere project
    Init(init::InitArgs),
    
    /// Build contracts and programs
    Build(build::BuildArgs),
    
    /// Deploy contracts to the network
    Deploy(deploy::DeployArgs),
    
    /// Run tests
    Test(test::TestArgs),
    
    /// Trace a transaction
    Trace(trace::TraceArgs),
    
    /// Simulate a Comit transaction
    Simulate(simulate::SimulateArgs),
    
    /// Generate documentation
    Docgen(docgen::DocgenArgs),
    
    /// Account management
    Account(account::AccountArgs),
    
    /// Query blockchain state
    Query(query::QueryArgs),
    
    /// Send transactions
    Tx(tx::TxArgs),
}
