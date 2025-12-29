use crate::{
    cli::{AtomicSwapSubcommand, Cli, Commands},
    service::{self, AtlasSphereExecutorDispatch},
};
use atlas_sphere_runtime::opaque::Block;
use clap::Parser;
use log::{error, info, warn};
use sc_cli::{CliConfiguration, Error as CliError, Result as CliResult, SubstrateCli};

pub fn run() -> CliResult<()> {
    let cli = Cli::parse();

    match &cli.subcommand {
        Some(Commands::BuildSpec(cmd)) => {
            let runner = cli.create_runner(cmd).map_err(|e| {
                error!("Failed to initialize runner for `build-spec`: {e}");
                e
            })?;

            runner.sync_run(|config| {
                info!(
                    "Building Atlas Sphere chain specification (raw: {})",
                    cmd.raw
                );
                cmd.run(config.chain_spec, config.network).map_err(|e| {
                    error!("`build-spec` command failed: {e}");
                    e
                })
            })
        }
        Some(Commands::CheckBlock(cmd)) => {
            let runner = cli.create_runner(cmd).map_err(|e| {
                error!("Failed to initialize runner for `check-block`: {e}");
                e
            })?;

            runner.async_run(|config| {
                info!("Checking blocks with the current runtime logic");
                let partial = service::new_partial(&config).map_err(|e| {
                    error!("Unable to build partial components for `check-block`: {e}");
                    CliError::Service(e)
                })?;

                let sc_service::PartialComponents {
                    client,
                    task_manager,
                    import_queue,
                    ..
                } = partial;

                Ok((cmd.run(client, import_queue), task_manager))
            })
        }
        Some(Commands::ExportBlocks(cmd)) => {
            let runner = cli.create_runner(cmd).map_err(|e| {
                error!("Failed to initialize runner for `export-blocks`: {e}");
                e
            })?;

            runner.async_run(|config| {
                info!("Exporting blocks to file");
                let partial = service::new_partial(&config).map_err(|e| {
                    error!("Unable to build partial components for `export-blocks`: {e}");
                    CliError::Service(e)
                })?;

                let sc_service::PartialComponents {
                    client,
                    task_manager,
                    ..
                } = partial;

                Ok((cmd.run(client, config.database), task_manager))
            })
        }
        Some(Commands::ExportState(cmd)) => {
            let runner = cli.create_runner(cmd).map_err(|e| {
                error!("Failed to initialize runner for `export-state`: {e}");
                e
            })?;

            runner.async_run(|config| {
                info!("Exporting full runtime state snapshot");
                let partial = service::new_partial(&config).map_err(|e| {
                    error!("Unable to build partial components for `export-state`: {e}");
                    CliError::Service(e)
                })?;

                let sc_service::PartialComponents {
                    client,
                    task_manager,
                    ..
                } = partial;

                Ok((cmd.run(client, config.chain_spec), task_manager))
            })
        }
        Some(Commands::ImportBlocks(cmd)) => {
            let runner = cli.create_runner(cmd).map_err(|e| {
                error!("Failed to initialize runner for `import-blocks`: {e}");
                e
            })?;

            runner.async_run(|config| {
                info!("Importing blocks into the local database");
                let partial = service::new_partial(&config).map_err(|e| {
                    error!("Unable to build partial components for `import-blocks`: {e}");
                    CliError::Service(e)
                })?;

                let sc_service::PartialComponents {
                    client,
                    task_manager,
                    import_queue,
                    ..
                } = partial;

                Ok((cmd.run(client, import_queue), task_manager))
            })
        }
        Some(Commands::PurgeChain(cmd)) => {
            let runner = cli.create_runner(cmd).map_err(|e| {
                error!("Failed to initialize runner for `purge-chain`: {e}");
                e
            })?;

            runner.sync_run(|config| {
                info!("Purging local database for Atlas Sphere");
                cmd.run(config.database).map_err(|e| {
                    error!("`purge-chain` command failed: {e}");
                    e
                })
            })
        }
        Some(Commands::Revert(cmd)) => {
            let runner = cli.create_runner(cmd).map_err(|e| {
                error!("Failed to initialize runner for `revert`: {e}");
                e
            })?;

            runner.async_run(|config| {
                info!("Reverting chain state by {:?} blocks", cmd.num);
                let partial = service::new_partial(&config).map_err(|e| {
                    error!("Unable to build partial components for `revert`: {e}");
                    CliError::Service(e)
                })?;

                let sc_service::PartialComponents {
                    client,
                    task_manager,
                    backend,
                    ..
                } = partial;

                Ok((cmd.run(client, backend, None), task_manager))
            })
        }
        #[cfg(feature = "runtime-benchmarks")]
        Some(Commands::Benchmark(cmd)) => {
            let runner = cli.create_runner(cmd).map_err(|e| {
                error!("Failed to initialize runner for `benchmark`: {e}");
                e
            })?;

            runner.sync_run(|config| {
                info!("Executing runtime benchmarks");
                cmd.run::<Block, AtlasSphereExecutorDispatch>(config)
                    .map_err(|e| {
                        error!("`benchmark` command failed: {e}");
                        e
                    })
            })
        }
        #[cfg(feature = "try-runtime")]
        Some(Commands::TryRuntime(_cmd)) => {
            error!("`try-runtime` is not yet supported for Atlas Sphere");
            Err(CliError::Other(
                "try-runtime subcommand is not yet supported for Atlas Sphere".into(),
            ))
        }
        Some(Commands::AtomicSwap(cmd)) => {
            match &cmd.command {
                AtomicSwapSubcommand::Simulate {
                    token_in,
                    token_out,
                    amount,
                    slippage_bps,
                    rpc_url,
                } => {
                    info!("Simulating atomic swap trade...");
                    info!("  Token In:  {:?}", token_in);
                    info!("  Token Out: {:?}", token_out);
                    info!("  Amount:    {}", amount);
                    info!("  Slippage:  {} bps", slippage_bps);
                    info!("  RPC URL:   {}", rpc_url);

                    println!("\n=== Atomic Swap Simulation ===");
                    println!("Token In:     0x{}", hex::encode(token_in.as_bytes()));
                    println!("Token Out:    0x{}", hex::encode(token_out.as_bytes()));
                    println!("Amount In:    {}", amount);
                    println!(
                        "Slippage:     {} bps ({}%)",
                        slippage_bps,
                        *slippage_bps as f64 / 100.0
                    );
                    println!();

                    // TODO: Make actual RPC call to atomicTrade_simulate
                    // For now, provide a mock response
                    println!("--- Simulation Result (Mock) ---");
                    println!("Success:           true");
                    println!(
                        "Estimated Output:  {} (mock)",
                        amount.saturating_mul(98) / 100
                    );
                    println!("Price Impact:      50 bps");
                    println!("EVM Gas:           150,000");
                    println!("SVM Compute:       0");
                    println!();
                    println!("Note: Connect to a running node for live simulation.");
                    println!(
                        "      Use: curl -X POST {} -H 'Content-Type: application/json'",
                        rpc_url
                    );
                    println!("           -d '{{\"jsonrpc\":\"2.0\",\"method\":\"atomicTrade_simulate\",\"params\":[...],\"id\":1}}'");

                    Ok(())
                }
                AtomicSwapSubcommand::Price {
                    token_a,
                    token_b,
                    rpc_url,
                } => {
                    info!("Querying price data for token pair...");

                    println!("\n=== Price Data Query ===");
                    println!("Token A:  0x{}", hex::encode(token_a.as_bytes()));
                    println!("Token B:  0x{}", hex::encode(token_b.as_bytes()));
                    println!("RPC URL:  {}", rpc_url);
                    println!();

                    // TODO: Make actual RPC call to atomicTrade_getPriceData
                    println!("--- Price Data (Mock) ---");
                    println!("TWAP Price:        0 (no observations)");
                    println!("Latest Price:      0 (no observations)");
                    println!("Observations:      0");
                    println!("Last Updated:      N/A");
                    println!();
                    println!(
                        "Note: Submit price observations via submit_price_observation extrinsic."
                    );

                    Ok(())
                }
                AtomicSwapSubcommand::EstimateCost { legs, vm_types } => {
                    info!("Estimating execution costs...");

                    println!("\n=== Execution Cost Estimate ===");
                    println!("Trade Legs: {}", legs);
                    println!("VM Types:   {:?}", vm_types);
                    println!();

                    let mut evm_gas: u64 = 0;
                    let mut svm_compute: u64 = 0;

                    for (i, vm_type) in vm_types.iter().enumerate() {
                        match vm_type.to_lowercase().as_str() {
                            "evm" => {
                                evm_gas += 150_000;
                                println!("  Leg {}: EVM      +150,000 gas", i + 1);
                            }
                            "svm" => {
                                svm_compute += 200_000;
                                println!("  Leg {}: SVM      +200,000 compute units", i + 1);
                            }
                            "crossvm" => {
                                evm_gas += 200_000;
                                svm_compute += 250_000;
                                println!(
                                    "  Leg {}: CrossVM  +200,000 gas, +250,000 compute",
                                    i + 1
                                );
                            }
                            other => {
                                warn!("Unknown VM type '{}', skipping", other);
                            }
                        }
                    }

                    println!();
                    println!("--- Total Estimates ---");
                    println!("EVM Gas:         {}", evm_gas);
                    println!("SVM Compute:     {}", svm_compute);

                    // Rough cost estimates (assuming 20 gwei gas price, $3000 ETH)
                    let evm_cost_usd = (evm_gas as f64 * 20.0 * 1e-9 * 3000.0);
                    println!(
                        "Est. EVM Cost:   ${:.4} (at 20 gwei, $3000/ETH)",
                        evm_cost_usd
                    );

                    Ok(())
                }
            }
        }
        None => {
            let runner = cli.create_runner(&cli.run).map_err(|e| {
                error!("Failed to initialize runner for node execution: {e}");
                e
            })?;

            runner.run_node_until_exit(|config| async move {
                let role = config.role.clone();
                info!("Starting Atlas Sphere node as {:?}", role);
                service::new_full(config).map_err(|e| {
                    error!("Atlas Sphere node terminated with an error: {e}");
                    CliError::Service(e)
                })
            })
        }
    }
}
