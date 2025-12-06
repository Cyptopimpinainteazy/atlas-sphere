//! Build command.

use clap::Args;
use colored::Colorize;
use indicatif::{ProgressBar, ProgressStyle};
use crate::error::{CliError, Result};
use crate::project::Project;
use std::process::Command;

#[derive(Args)]
pub struct BuildArgs {
    /// Build only EVM contracts
    #[arg(long)]
    pub evm_only: bool,
    
    /// Build only SVM programs
    #[arg(long)]
    pub svm_only: bool,
    
    /// Optimization level (0-3)
    #[arg(short, long)]
    pub optimization: Option<u8>,
    
    /// Skip compilation, only generate ABIs
    #[arg(long)]
    pub abi_only: bool,
    
    /// Verbose output
    #[arg(short, long)]
    pub verbose: bool,
}

pub async fn execute(args: BuildArgs) -> Result<()> {
    let project = Project::load_current()?;
    
    println!("{} Building project: {}", "→".blue(), project.config.name);
    
    // Create output directory
    std::fs::create_dir_all(project.out_dir())?;
    
    let pb = ProgressBar::new_spinner();
    pb.set_style(
        ProgressStyle::default_spinner()
            .template("{spinner:.blue} {msg}")
            .unwrap()
    );
    
    let build_evm = !args.svm_only;
    let build_svm = !args.evm_only;
    
    // Build EVM contracts
    if build_evm {
        pb.set_message("Compiling EVM contracts...");
        build_evm_contracts(&project, &args)?;
        pb.set_message("EVM contracts compiled");
    }
    
    // Build SVM programs  
    if build_svm {
        pb.set_message("Compiling SVM programs...");
        build_svm_programs(&project, &args)?;
        pb.set_message("SVM programs compiled");
    }
    
    pb.finish_with_message("Build complete");
    
    println!("{} Build artifacts written to: {}", "✓".green(), project.out_dir().display());
    
    Ok(())
}

fn build_evm_contracts(project: &Project, args: &BuildArgs) -> Result<()> {
    let sol_files = project.find_solidity_files()?;
    
    if sol_files.is_empty() {
        println!("  {} No Solidity files found", "○".yellow());
        return Ok(());
    }
    
    println!("  {} Found {} Solidity file(s)", "→".blue(), sol_files.len());
    
    // Check for forge/solc
    let compiler = &project.config.build.evm_compiler;
    
    match compiler.as_str() {
        "forge" => build_with_forge(project, args)?,
        "solc" | _ => build_with_solc(project, &sol_files, args)?,
    }
    
    Ok(())
}

fn build_with_forge(project: &Project, args: &BuildArgs) -> Result<()> {
    let mut cmd = Command::new("forge");
    cmd.arg("build");
    cmd.arg("--out").arg(project.out_dir());
    
    if let Some(opt) = args.optimization {
        cmd.arg("--optimize");
        cmd.arg("--optimizer-runs").arg(opt.to_string());
    }
    
    cmd.current_dir(&project.root);
    
    let output = cmd.output()?;
    
    if !output.status.success() {
        let stderr = String::from_utf8_lossy(&output.stderr);
        return Err(CliError::Build(format!("Forge build failed: {}", stderr)));
    }
    
    if args.verbose {
        let stdout = String::from_utf8_lossy(&output.stdout);
        println!("{}", stdout);
    }
    
    Ok(())
}

fn build_with_solc(project: &Project, files: &[std::path::PathBuf], args: &BuildArgs) -> Result<()> {
    for file in files {
        let mut cmd = Command::new("solc");
        
        // Output options
        if args.abi_only {
            cmd.arg("--abi");
        } else {
            cmd.arg("--combined-json").arg("abi,bin,bin-runtime");
        }
        
        // Optimization
        if let Some(opt) = args.optimization {
            if opt > 0 {
                cmd.arg("--optimize");
                cmd.arg("--optimize-runs").arg((200 * opt as u32).to_string());
            }
        }
        
        // Output directory
        cmd.arg("-o").arg(project.out_dir());
        cmd.arg("--overwrite");
        
        // Input file
        cmd.arg(file);
        
        cmd.current_dir(&project.root);
        
        let output = cmd.output()?;
        
        if !output.status.success() {
            let stderr = String::from_utf8_lossy(&output.stderr);
            return Err(CliError::Build(format!(
                "Solc compilation failed for {}: {}",
                file.display(),
                stderr
            )));
        }
        
        println!("  {} Compiled: {}", "✓".green(), file.display());
    }
    
    Ok(())
}

fn build_svm_programs(project: &Project, args: &BuildArgs) -> Result<()> {
    let svm_src = project.svm_src();
    
    if !svm_src.exists() {
        println!("  {} No SVM programs found", "○".yellow());
        return Ok(());
    }
    
    // Check for Cargo.toml in SVM directory
    let cargo_toml = svm_src.join("Cargo.toml");
    if !cargo_toml.exists() {
        println!("  {} No Cargo.toml in SVM directory", "○".yellow());
        return Ok(());
    }
    
    println!("  {} Building SVM programs with Cargo", "→".blue());
    
    let mut cmd = Command::new("cargo");
    cmd.arg("build-sbf");
    
    if !args.verbose {
        cmd.arg("--quiet");
    }
    
    cmd.current_dir(&svm_src);
    
    let output = cmd.output();
    
    match output {
        Ok(output) if output.status.success() => {
            println!("  {} SVM programs built", "✓".green());
        }
        Ok(output) => {
            let stderr = String::from_utf8_lossy(&output.stderr);
            // cargo build-sbf might not be installed, that's ok
            if stderr.contains("no such subcommand") {
                println!("  {} cargo build-sbf not available, skipping SVM build", "○".yellow());
            } else {
                return Err(CliError::Build(format!("SVM build failed: {}", stderr)));
            }
        }
        Err(e) => {
            println!("  {} Could not run cargo: {}", "○".yellow(), e);
        }
    }
    
    Ok(())
}
