use crate::{
    cli::{AtomicSwapSubcommand, Cli, Commands},
    service,
};
use clap::Parser;
#[cfg(feature = "runtime-benchmarks")]
use frame_benchmarking_cli::{BenchmarkCmd, SUBSTRATE_REFERENCE_HARDWARE};
use log::{error, info, warn};
use sc_cli::{Error as CliError, Result as CliResult, SubstrateCli};
#[cfg(feature = "runtime-benchmarks")]
use x3_chain_runtime::opaque::Block;

use crate::logging;

/// Entry point that runs the CLI and dispatches the requested command.
pub fn run() -> CliResult<()> {
    // Initialize colorful logger with emojis
    logging::init();
    let cli = Cli::parse();

    match &cli.subcommand {
        Some(Commands::BuildSpec(cmd)) => {
            let runner = cli.create_runner(cmd).map_err(|e| {
                error!("Failed to initialize runner for `build-spec`: {e}");
                e
            })?;

            runner.sync_run(|config| {
                info!("Building X3 Chain chain specification (raw: {})", cmd.raw);
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
                info!("Purging local database for X3 Chain");
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
                match cmd {
                    BenchmarkCmd::Pallet(cmd) => {
                        if !cfg!(feature = "runtime-benchmarks") {
                            return Err(
                                "Runtime benchmarking wasn't enabled when building the node. \
                                You can enable it with `--features runtime-benchmarks`."
                                    .into(),
                            );
                        }
                        cmd.run::<Block, sp_io::SubstrateHostFunctions>(config)
                    }
                    BenchmarkCmd::Block(cmd) => {
                        let partial = service::new_partial(&config).map_err(|e| {
                            error!("Unable to build partial components for `benchmark block`: {e}");
                            CliError::Service(e)
                        })?;
                        let sc_service::PartialComponents { client, .. } = partial;
                        cmd.run(client)
                    }
                    BenchmarkCmd::Storage(cmd) => {
                        let partial = service::new_partial(&config).map_err(|e| {
                            error!(
                                "Unable to build partial components for `benchmark storage`: {e}"
                            );
                            CliError::Service(e)
                        })?;
                        let sc_service::PartialComponents {
                            client, backend, ..
                        } = partial;
                        let db = backend.expose_db();
                        let storage = backend.expose_storage();
                        cmd.run(config, client, db, storage)
                    }
                    BenchmarkCmd::Machine(cmd) => {
                        cmd.run(&config, SUBSTRATE_REFERENCE_HARDWARE.clone())
                    }
                    BenchmarkCmd::Overhead(_) | BenchmarkCmd::Extrinsic(_) => Err(
                        "Overhead/Extrinsic benchmarking is not wired for x3-chain-node yet."
                            .into(),
                    ),
                }
                .map_err(|e| {
                    error!("`benchmark` command failed: {e}");
                    e
                })
            })
        }
        #[cfg(feature = "try-runtime")]
        Some(Commands::TryRuntime(_)) => {
            error!("`try-runtime` is not yet supported for X3 Chain");
            Err("try-runtime subcommand is not yet supported for X3 Chain".into())
        }
        #[cfg(not(feature = "try-runtime"))]
        Some(Commands::TryRuntime) => Err("TryRuntime wasn't enabled when building the node. \
            You can enable it with `--features try-runtime`."
            .into()),
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

                    // Make RPC call to atomicTrade_simulate
                    match make_rpc_call(
                        rpc_url,
                        "atomicTrade_simulate",
                        serde_json::json!([
                            format!("0x{}", hex::encode(token_in.as_bytes())),
                            format!("0x{}", hex::encode(token_out.as_bytes())),
                            amount.to_string(),
                            slippage_bps
                        ]),
                    ) {
                        Ok(result) => {
                            println!("--- Simulation Result ---");
                            if let Some(obj) = result.as_object() {
                                println!(
                                    "Success:           {}",
                                    obj.get("success")
                                        .and_then(|v| v.as_bool())
                                        .unwrap_or(false)
                                );
                                println!(
                                    "Estimated Output:  {}",
                                    obj.get("estimatedOutput")
                                        .and_then(|v| v.as_str())
                                        .unwrap_or("0")
                                );
                                println!(
                                    "Price Impact:      {} bps",
                                    obj.get("priceImpactBps")
                                        .and_then(|v| v.as_u64())
                                        .unwrap_or(0)
                                );
                                println!(
                                    "EVM Gas:           {}",
                                    obj.get("evmGas").and_then(|v| v.as_u64()).unwrap_or(0)
                                );
                                println!(
                                    "SVM Compute:       {}",
                                    obj.get("svmCompute").and_then(|v| v.as_u64()).unwrap_or(0)
                                );
                            } else {
                                println!("Raw result: {}", result);
                            }
                        }
                        Err(e) => {
                            warn!("RPC call failed: {}. Showing mock data.", e);
                            println!("--- Simulation Result (Mock - RPC unavailable) ---");
                            println!("Success:           true");
                            println!(
                                "Estimated Output:  {} (mock)",
                                amount.saturating_mul(98) / 100
                            );
                            println!("Price Impact:      50 bps");
                            println!("EVM Gas:           150,000");
                            println!("SVM Compute:       0");
                            println!();
                            println!("Note: Start a node to get live simulation results.");
                        }
                    }

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

                    // Make RPC call to atomicTrade_getPriceData
                    match make_rpc_call(
                        rpc_url,
                        "atomicTrade_getPriceData",
                        serde_json::json!([
                            format!("0x{}", hex::encode(token_a.as_bytes())),
                            format!("0x{}", hex::encode(token_b.as_bytes()))
                        ]),
                    ) {
                        Ok(result) => {
                            println!("--- Price Data ---");
                            if let Some(obj) = result.as_object() {
                                println!(
                                    "TWAP Price:        {}",
                                    obj.get("twapPrice").and_then(|v| v.as_str()).unwrap_or("0")
                                );
                                println!(
                                    "Latest Price:      {}",
                                    obj.get("latestPrice")
                                        .and_then(|v| v.as_str())
                                        .unwrap_or("0")
                                );
                                println!(
                                    "Observations:      {}",
                                    obj.get("observationCount")
                                        .and_then(|v| v.as_u64())
                                        .unwrap_or(0)
                                );
                                println!(
                                    "Last Updated:      {}",
                                    obj.get("lastUpdated")
                                        .and_then(|v| v.as_str())
                                        .unwrap_or("N/A")
                                );
                            } else {
                                println!("Raw result: {}", result);
                            }
                        }
                        Err(e) => {
                            warn!("RPC call failed: {}. Showing mock data.", e);
                            println!("--- Price Data (Mock - RPC unavailable) ---");
                            println!("TWAP Price:        0 (no observations)");
                            println!("Latest Price:      0 (no observations)");
                            println!("Observations:      0");
                            println!("Last Updated:      N/A");
                            println!();
                            println!("Note: Start a node and submit price observations first.");
                        }
                    }

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
                    let evm_cost_usd = evm_gas as f64 * 20.0 * 1e-9 * 3000.0;
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
            let feature_flags = service::NodeFeatureFlags {
                enable_parallel_proposer: cli.features.enable_parallel_proposer,
                enable_flash_finality: cli.features.enable_flash_finality,
                enable_poh: cli.features.enable_poh,
                gpu_required: cli.features.gpu_required,
                enable_gpu_validation: cli.features.enable_gpu_validation,
            };

            runner.run_node_until_exit(|config| async move {
                let role = config.role.clone();
                info!("Starting X3 Chain node as {:?}", role);
                service::new_full(config, feature_flags).map_err(|e| {
                    error!("X3 Chain node terminated with an error: {e}");
                    CliError::Service(e)
                })
            })
        }
    }
}

/// Make an HTTP JSON-RPC call to a running node.
///
/// Returns the result field from the JSON-RPC response, or an error if the call fails.
fn make_rpc_call(
    url: &str,
    method: &str,
    params: serde_json::Value,
) -> Result<serde_json::Value, String> {
    use std::io::{Read, Write};
    use std::net::TcpStream;
    use std::time::Duration;

    // Parse URL to extract host, port, and path
    let url = url
        .trim_start_matches("http://")
        .trim_start_matches("https://");
    let (host_port, path) = if let Some(idx) = url.find('/') {
        (&url[..idx], &url[idx..])
    } else {
        (url, "/")
    };

    let (host, port) = if let Some(idx) = host_port.find(':') {
        (
            &host_port[..idx],
            host_port[idx + 1..].parse::<u16>().unwrap_or(9944),
        )
    } else {
        (host_port, 9944u16)
    };

    // Build JSON-RPC request
    let request_body = serde_json::json!({
        "jsonrpc": "2.0",
        "method": method,
        "params": params,
        "id": 1
    });
    let body = request_body.to_string();

    // Build HTTP request
    let http_request = format!(
        "POST {} HTTP/1.1\r\n\
         Host: {}:{}\r\n\
         Content-Type: application/json\r\n\
         Content-Length: {}\r\n\
         Connection: close\r\n\
         \r\n\
         {}",
        path,
        host,
        port,
        body.len(),
        body
    );

    // Connect and send request
    let addr = format!("{}:{}", host, port);
    let mut stream = TcpStream::connect_timeout(
        &addr
            .parse()
            .map_err(|e| format!("Invalid address: {}", e))?,
        Duration::from_secs(5),
    )
    .map_err(|e| format!("Connection failed: {}", e))?;

    stream
        .set_read_timeout(Some(Duration::from_secs(10)))
        .map_err(|e| format!("Failed to set timeout: {}", e))?;

    stream
        .write_all(http_request.as_bytes())
        .map_err(|e| format!("Failed to send request: {}", e))?;

    // Read response
    let mut response = String::new();
    stream
        .read_to_string(&mut response)
        .map_err(|e| format!("Failed to read response: {}", e))?;

    // Parse HTTP response - find JSON body after headers
    let body_start = response
        .find("\r\n\r\n")
        .ok_or("Invalid HTTP response: no body separator")?;
    let json_body = &response[body_start + 4..];

    // Parse JSON-RPC response
    let rpc_response: serde_json::Value =
        serde_json::from_str(json_body).map_err(|e| format!("Invalid JSON response: {}", e))?;

    // Check for error
    if let Some(error) = rpc_response.get("error") {
        return Err(format!(
            "RPC error: {}",
            error
                .get("message")
                .and_then(|m| m.as_str())
                .unwrap_or("Unknown error")
        ));
    }

    // Return result
    rpc_response
        .get("result")
        .cloned()
        .ok_or_else(|| "No result in response".to_string())
}
