//! Mynta Wallet - Tauri Backend
//!
//! A professional cryptocurrency wallet with integrated daemon management.
//! The daemon is bundled with the wallet and runs as a unified application.

mod chain_params;
mod commands;
mod daemon;
mod daemon_commands;
mod rpc;
mod seed_commands;
mod wallet_keys;

use commands::WalletState;
use daemon_commands::DaemonState;
use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::Arc;
use std::time::Duration;
use tauri::Manager;
use tracing::{info, warn, error};

// Track if UI has reported ready
static UI_READY: AtomicBool = AtomicBool::new(false);

/// Command to receive JS errors from frontend
#[tauri::command]
fn report_js_error(error_type: String, message: String, stack: Option<String>) {
    error!(
        "Frontend JS Error [{}]: {}\nStack: {}",
        error_type,
        message,
        stack.unwrap_or_else(|| "N/A".to_string())
    );
}

/// Command to signal UI is ready
#[tauri::command]
fn ui_ready() {
    info!("Frontend UI reported ready");
    UI_READY.store(true, Ordering::SeqCst);
}

/// Get the log file path
fn get_log_file_path() -> std::path::PathBuf {
    let data_dir = dirs::data_local_dir()
        .or_else(dirs::home_dir)
        .unwrap_or_else(|| std::path::PathBuf::from("."));
    
    data_dir.join("mynta-wallet").join("wallet.log")
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    // Set up panic hook for better error reporting
    std::panic::set_hook(Box::new(|panic_info| {
        let payload = panic_info
            .payload()
            .downcast_ref::<&str>()
            .map(|s| s.to_string())
            .or_else(|| {
                panic_info
                    .payload()
                    .downcast_ref::<String>()
                    .cloned()
            })
            .unwrap_or_else(|| "Unknown panic".to_string());
        
        let location = panic_info
            .location()
            .map(|l| format!("{}:{}:{}", l.file(), l.line(), l.column()))
            .unwrap_or_else(|| "unknown".to_string());
        
        eprintln!("PANIC at {}: {}", location, payload);
        
        // Also try to write to log file
        if let Ok(mut file) = std::fs::OpenOptions::new()
            .create(true)
            .append(true)
            .open(get_log_file_path())
        {
            use std::io::Write;
            let _ = writeln!(file, "PANIC at {}: {}", location, payload);
        }
    }));

    // Initialize logging
    tracing_subscriber::fmt()
        .with_env_filter(
            tracing_subscriber::EnvFilter::from_default_env()
                .add_directive("mynta_wallet=debug".parse().unwrap())
                .add_directive("tauri=info".parse().unwrap())
                .add_directive("wry=debug".parse().unwrap()),
        )
        .init();

    info!("Starting Mynta Wallet v{}", env!("CARGO_PKG_VERSION"));
    info!("Log file: {:?}", get_log_file_path());

    // Log configuration for debugging
    info!("Dev URL: http://localhost:1420");
    info!("Frontend dist: ../dist (relative to src-tauri)");

    // Create shared state
    let daemon_state = DaemonState::new();
    let wallet_state = WalletState {
        rpc: daemon_state.rpc.clone(),
    };

    // Keep a reference to daemon manager for cleanup
    let daemon_manager = daemon_state.manager.clone();

    tauri::Builder::default()
        .plugin(tauri_plugin_shell::init())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_notification::init())
        .plugin(tauri_plugin_clipboard_manager::init())
        .plugin(tauri_plugin_fs::init())
        .plugin(tauri_plugin_process::init())
        .manage(wallet_state)
        .manage(daemon_state)
        .invoke_handler(tauri::generate_handler![
            // Debug/diagnostic commands
            report_js_error,
            ui_ready,
            // Daemon management (integrated - no external option)
            daemon_commands::get_daemon_info,
            daemon_commands::start_daemon,
            daemon_commands::stop_integrated_daemon,
            daemon_commands::get_daemon_status,
            daemon_commands::is_daemon_running,
            daemon_commands::check_daemon_binary,
            // Connection commands (used internally for RPC)
            commands::connect,
            commands::disconnect,
            commands::is_connected,
            commands::get_connection_config,
            // Blockchain
            commands::get_blockchain_info,
            commands::get_block_count,
            commands::get_network_info,
            commands::get_peer_info,
            commands::get_connection_count,
            commands::get_mining_info,
            // Wallet
            commands::get_balance,
            commands::get_unconfirmed_balance,
            commands::get_new_address,
            commands::validate_address,
            commands::send_to_address,
            commands::list_transactions,
            commands::get_transaction,
            commands::list_unspent,
            commands::get_wallet_info,
            commands::encrypt_wallet,
            commands::wallet_lock,
            commands::wallet_unlock,
            commands::backup_wallet,
            commands::dump_privkey,
            commands::import_privkey,
            // Assets
            commands::list_assets,
            commands::list_my_assets,
            commands::get_asset_data,
            commands::issue_asset,
            commands::transfer_asset,
            commands::reissue_asset,
            // Masternodes
            commands::masternode_count,
            commands::masternode_list,
            commands::masternode_status,
            commands::protx_list,
            // Utility
            commands::rpc_help,
            commands::stop_daemon,
            commands::get_dashboard_data,
            // Seed phrase / HD wallet commands
            seed_commands::generate_seed_phrase,
            seed_commands::validate_seed_phrase,
            seed_commands::get_verification_indices,
            seed_commands::get_word_suggestions,
            seed_commands::restore_from_seed,
            seed_commands::derive_address_from_seed,
            seed_commands::get_seed_hex,
            seed_commands::is_wallet_initialized,
            seed_commands::mark_wallet_initialized,
            seed_commands::reset_wallet_initialization,
        ])
        .setup(|app| {
            info!("Tauri setup starting...");
            
            // Get main window
            let window = app.get_webview_window("main").expect("main window not found");
            
            // In debug builds or when MYNTA_DEVTOOLS=1, open devtools
            #[cfg(debug_assertions)]
            {
                info!("Debug build detected - opening devtools");
                window.open_devtools();
            }
            
            #[cfg(not(debug_assertions))]
            {
                if std::env::var("MYNTA_DEVTOOLS").is_ok() {
                    info!("MYNTA_DEVTOOLS set - opening devtools in release build");
                    window.open_devtools();
                }
            }
            
            // Log daemon binary status
            if let Some(binary_path) = daemon::DaemonManager::find_daemon_binary() {
                info!("Daemon binary found at: {:?}", binary_path);
            } else {
                warn!("Daemon binary not found - please ensure myntad is bundled");
            }
            
            // Start a background task to check if UI becomes ready
            let window_clone = window.clone();
            tauri::async_runtime::spawn(async move {
                // Wait up to 10 seconds for UI to report ready
                for i in 0..20 {
                    tokio::time::sleep(Duration::from_millis(500)).await;
                    
                    if UI_READY.load(Ordering::SeqCst) {
                        info!("UI ready signal received after {}ms", (i + 1) * 500);
                        return;
                    }
                }
                
                // UI didn't report ready - something is wrong
                warn!("UI did not report ready within 10 seconds!");
                
                // Try to inject an error message into the page
                let error_js = r#"
                    document.body.innerHTML = `
                        <div style="padding: 40px; font-family: system-ui; background: #1a1a2e; color: white; min-height: 100vh;">
                            <h1 style="color: #ff6b6b;">UI Failed to Load</h1>
                            <p>The wallet UI did not initialize properly.</p>
                            <h3>Troubleshooting:</h3>
                            <ul>
                                <li>Check the browser console (F12) for errors</li>
                                <li>Run with MYNTA_DEVTOOLS=1 environment variable</li>
                                <li>Check ~/.local/share/mynta-wallet/wallet.log</li>
                            </ul>
                            <p style="color: #888; margin-top: 20px;">
                                Press F12 or Ctrl+Shift+I to open developer tools.
                            </p>
                        </div>
                    `;
                "#;
                
                if let Err(e) = window_clone.eval(error_js) {
                    error!("Failed to inject error message: {}", e);
                }
            });
            
            info!("Tauri setup complete - returning immediately");
            Ok(())
        })
        .on_window_event(move |window, event| {
            if let tauri::WindowEvent::CloseRequested { .. } = event {
                info!("Window close requested, stopping integrated daemon...");
                
                // Gracefully stop the daemon
                let manager = daemon_manager.clone();
                tauri::async_runtime::block_on(async {
                    let mgr = manager.lock().await;
                    if let Some(ref m) = *mgr {
                        if m.is_running() {
                            info!("Stopping daemon before exit...");
                            if let Err(e) = m.stop().await {
                                warn!("Error stopping daemon: {}", e);
                            } else {
                                info!("Daemon stopped successfully");
                            }
                        }
                    }
                });
            }
        })
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
