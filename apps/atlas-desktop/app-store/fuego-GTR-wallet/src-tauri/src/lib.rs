// Copyright (c) 2024 Fuego Private Banking Network
// Distributed under the MIT/X11 software license

//! Fuego Desktop Wallet - Tauri Backend

pub mod crypto;
pub mod utils;
pub mod security;
pub mod performance;
pub mod settings;
pub mod backup;
pub mod i18n;
pub mod optimization;
pub mod advanced;

use log::info;
use crate::crypto::ffi::CryptoNoteFFI;
use crate::crypto::real_cryptonote::{RealCryptoNoteWallet, connect_to_fuego_network, fetch_fuego_network_data};
use crate::security::{SecurityManager, SecurityConfig, PasswordValidator, WalletEncryption};
use crate::performance::{PerformanceMonitor, PerformanceConfig, Cache, BackgroundTaskManager};
use crate::settings::{SettingsManager};
use crate::backup::{BackupManager};
use crate::i18n::{I18nManager, LanguageInfo};
use crate::optimization::{ResourceMonitor, MemoryOptimization, CPUOptimization, AdvancedCache, ThreadPool, PerformanceProfiler};
use crate::advanced::{AdvancedWalletManager, AdvancedUIManager, EnhancedWalletInfo, AdvancedTransactionInfo};
use std::sync::Arc;
use std::time::{Duration, SystemTime, UNIX_EPOCH};

// Global state for security, performance, settings, backup, i18n, optimization, and advanced features
static SECURITY_MANAGER: std::sync::OnceLock<Arc<SecurityManager>> = std::sync::OnceLock::new();
static PERFORMANCE_MONITOR: std::sync::OnceLock<Arc<PerformanceMonitor>> = std::sync::OnceLock::new();
static CACHE: std::sync::OnceLock<Arc<Cache<serde_json::Value>>> = std::sync::OnceLock::new();
static BACKGROUND_TASKS: std::sync::OnceLock<Arc<BackgroundTaskManager>> = std::sync::OnceLock::new();
static SETTINGS_MANAGER: std::sync::OnceLock<Arc<SettingsManager>> = std::sync::OnceLock::new();
static BACKUP_MANAGER: std::sync::OnceLock<Arc<BackupManager>> = std::sync::OnceLock::new();
static I18N_MANAGER: std::sync::OnceLock<Arc<I18nManager>> = std::sync::OnceLock::new();
static RESOURCE_MONITOR: std::sync::OnceLock<Arc<ResourceMonitor>> = std::sync::OnceLock::new();
static OPTIMIZATION_CACHE: std::sync::OnceLock<Arc<AdvancedCache<String, String>>> = std::sync::OnceLock::new();
static THREAD_POOL: std::sync::OnceLock<Arc<ThreadPool>> = std::sync::OnceLock::new();
static PERFORMANCE_PROFILER: std::sync::OnceLock<Arc<PerformanceProfiler>> = std::sync::OnceLock::new();
static ADVANCED_WALLET_MANAGER: std::sync::OnceLock<Arc<AdvancedWalletManager>> = std::sync::OnceLock::new();
static ADVANCED_UI_MANAGER: std::sync::OnceLock<Arc<AdvancedUIManager>> = std::sync::OnceLock::new();


/// Initialize the Tauri application
pub fn run() {
    env_logger::init();
    info!("Starting Fuego Desktop Wallet");

    // Initialize global state
    initialize_global_state();

    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_fs::init())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_store::Builder::default().build())
        .invoke_handler(tauri::generate_handler![
            get_wallet_info,
            get_transactions,
            get_network_status,
            // Phase 1.3 additions
            get_enhanced_wallet_info,
            get_advanced_transactions,
            get_app_settings,
            get_available_app_languages,
            get_notifications,
            test_ffi_integration,
            test_real_cryptonote,
            get_fuego_network_data,
            send_transaction,
            get_term_deposits,
            create_term_deposit,
            withdraw_term_deposit,
            // fuego-wallet compatibility aliases
            wallet_create,
            wallet_open,
            wallet_get_info,
            wallet_get_balance,
            wallet_get_address,
            wallet_get_transactions,
            wallet_send_transaction,
            wallet_close,
            wallet_refresh,
            wallet_rescan,
            network_get_status,
            node_connect,
            node_disconnect,
            deposit_list,
            deposit_create,
            deposit_withdraw,
            estimate_fee,
            validate_address,
            // Security commands
            authenticate_user,
            validate_session,
            lock_session,
            unlock_session,
            logout_user,
            validate_password_strength,
            encrypt_wallet_data,
            decrypt_wallet_data,
            // Performance commands
            get_performance_metrics,
            get_cache_stats,
            clear_cache,
            get_background_task_status,
            enable_background_task,
            disable_background_task,
            // Advanced wallet commands
            get_wallet_info_advanced,
            get_network_info_advanced,
            get_transaction_by_hash,
            create_address,
            get_block_info,
            start_mining,
            stop_mining,
            get_mining_info,
            get_transaction_history,
            get_sync_progress,
            get_sync_status_json,
            set_mining_pool,
            wallet_start_mining,
            wallet_stop_mining,
            wallet_set_mining_pool,
            get_mining_status,
            // Address book commands
            add_address_book_entry,
            remove_address_book_entry,
            update_address_book_entry,
            get_address_book,
            mark_address_used,
            get_address_book_entry,
            // Enhanced mining commands
            get_mining_stats_json,
            // Secure key management commands
            generate_seed_phrase,
            validate_seed_phrase,
            derive_keys_from_seed,
            get_seed_phrase,
            get_view_key,
            get_spend_key,
            has_keys,
            export_keys,
            import_keys,
        ])
        .setup(|_app| {
            info!("Fuego Desktop Wallet initialized successfully");
            Ok(())
        })
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}

/// Initialize global state for security, performance, settings, backup, and i18n
fn initialize_global_state() {
    // Initialize security manager
    let security_config = SecurityConfig::default();
    let security_manager = Arc::new(SecurityManager::new(security_config));
    SECURITY_MANAGER.set(security_manager).unwrap();

    // Initialize performance monitor
    let performance_config = PerformanceConfig::default();
    let performance_monitor = Arc::new(PerformanceMonitor::new(performance_config));
    PERFORMANCE_MONITOR.set(performance_monitor).unwrap();

    // Initialize cache
    let cache = Arc::new(Cache::new(1000, Duration::from_secs(300)));
    CACHE.set(cache).unwrap();

    // Initialize background task manager
    let background_tasks = Arc::new(BackgroundTaskManager::new());
    BACKGROUND_TASKS.set(background_tasks).unwrap();

    // Initialize settings manager
    match SettingsManager::new() {
        Ok(settings_manager) => {
            SETTINGS_MANAGER.set(Arc::new(settings_manager)).unwrap();
            info!("Settings manager initialized successfully");
        }
        Err(e) => {
            log::error!("Failed to initialize settings manager: {}", e);
        }
    }

    // Initialize backup manager
    match BackupManager::new() {
        Ok(backup_manager) => {
            BACKUP_MANAGER.set(Arc::new(backup_manager)).unwrap();
            info!("Backup manager initialized successfully");
        }
        Err(e) => {
            log::error!("Failed to initialize backup manager: {}", e);
        }
    }

    // Initialize i18n manager
    let i18n_manager = Arc::new(I18nManager::new());
    I18N_MANAGER.set(i18n_manager).unwrap();

    // Initialize optimization components
    let memory_opt = MemoryOptimization {
        max_cache_size: 1000,
        cache_cleanup_interval: Duration::from_secs(300),
        memory_threshold: 1024 * 1024 * 100, // 100 MB
        gc_interval: Duration::from_secs(60),
        compression_enabled: true,
        lazy_loading: true,
    };
    
    let cpu_opt = CPUOptimization {
        max_threads: 4,
        thread_pool_size: 8,
        background_processing: true,
        async_operations: true,
        batch_processing: true,
        priority_level: crate::optimization::ThreadPriority::Normal,
    };
    
    let resource_monitor = Arc::new(ResourceMonitor::new(memory_opt, cpu_opt));
    RESOURCE_MONITOR.set(resource_monitor).unwrap();
    
    let optimization_cache = Arc::new(AdvancedCache::new(1000));
    OPTIMIZATION_CACHE.set(optimization_cache).unwrap();
    
    let thread_pool = Arc::new(ThreadPool::new(8));
    THREAD_POOL.set(thread_pool).unwrap();
    
    let performance_profiler = Arc::new(PerformanceProfiler::new());
    PERFORMANCE_PROFILER.set(performance_profiler).unwrap();

    // Initialize advanced components
    let advanced_wallet_manager = Arc::new(AdvancedWalletManager::new());
    ADVANCED_WALLET_MANAGER.set(advanced_wallet_manager).unwrap();
    
    let advanced_ui_manager = Arc::new(AdvancedUIManager::new());
    ADVANCED_UI_MANAGER.set(advanced_ui_manager).unwrap();

    info!("Global state initialized successfully");
}

/// Get wallet information (using real CryptoNote)
#[tauri::command]
async fn get_wallet_info() -> Result<serde_json::Value, String> {
    let mut real_wallet = RealCryptoNoteWallet::new();
    
    // Try to open existing wallet first, then create if needed
    let wallet_result = real_wallet.open_wallet("/tmp/fuego_wallet.wallet", "fuego_password")
        .or_else(|_| real_wallet.create_wallet("fuego_password", "/tmp/fuego_wallet.wallet", None, 0));
    
    if let Err(e) = wallet_result {
        return Err(format!("Failed to open/create wallet: {}", e));
    }
    
    // Connect to Fuego network
    if let Err(e) = connect_to_fuego_network(&mut real_wallet) {
        log::warn!("Failed to connect to Fuego network: {}", e);
        // Continue without network connection
    }
    
    let balance = real_wallet.get_balance().map_err(|e| e.to_string())?;
    let unlocked_balance = real_wallet.get_unlocked_balance().map_err(|e| e.to_string())?;
    let address = real_wallet.get_address().map_err(|e| e.to_string())?;
    
    Ok(serde_json::json!({
        "address": address,
        "balance": balance,
        "unlocked_balance": unlocked_balance,
        "is_open": real_wallet.is_open(),
        "is_encrypted": true,
        "is_real": true
    }))
}

/// Get transactions (real implementation)
#[tauri::command]
async fn get_transactions(limit: Option<u64>, offset: Option<u64>) -> Result<Vec<serde_json::Value>, String> {
    let mut real_wallet = RealCryptoNoteWallet::new();

    // Try to open wallet and get real transactions
    let _ = real_wallet.open_wallet("/tmp/fuego_wallet.wallet", "fuego_password")
        .or_else(|_| real_wallet.create_wallet("fuego_password", "/tmp/fuego_wallet.wallet", None, 0));

    // Get real transaction history from blockchain
    match real_wallet.get_transaction_history(limit.unwrap_or(10), offset.unwrap_or(0)) {
        Ok(transactions) => {
            let mapped: Vec<serde_json::Value> = transactions
                .into_iter()
                .map(|tx| serde_json::json!({
                    "id": tx.id,
                    "hash": tx.hash,
                    "amount": tx.amount,
                    "fee": tx.fee,
                    "height": tx.height,
                    "timestamp": tx.timestamp,
                    "confirmations": tx.confirmations,
                    "is_confirmed": tx.is_confirmed,
                    "is_pending": tx.is_pending,
                    "payment_id": tx.payment_id,
                    "destination_addresses": tx.destination_addresses,
                    "source_addresses": tx.source_addresses,
                    "unlock_time": tx.unlock_time,
                    "extra": tx.extra
                }))
                .collect();
            Ok(mapped)
        }
        Err(e) => {
            log::error!("Failed to get transaction history: {}", e);
            Err(format!("Failed to get transaction history: {}", e))
        }
    }
}

/// Get enhanced wallet information for advanced UI (Phase 1.3)
#[tauri::command]
async fn get_enhanced_wallet_info() -> Result<serde_json::Value, String> {
    let mut real_wallet = RealCryptoNoteWallet::new();

    // Open or create wallet
    let _ = real_wallet
        .open_wallet("/tmp/fuego_wallet.wallet", "fuego_password")
        .or_else(|_| real_wallet.create_wallet("fuego_password", "/tmp/fuego_wallet.wallet", None, 0));

    // Attempt network connect (best-effort)
    let _ = connect_to_fuego_network(&mut real_wallet);

    // Gather info
    let balance = real_wallet.get_balance().map_err(|e| e.to_string())?;
    let unlocked_balance = real_wallet.get_unlocked_balance().map_err(|e| e.to_string())?;
    let address = real_wallet.get_address().map_err(|e| e.to_string())?;
    let network = real_wallet.get_network_status().unwrap_or_else(|_| serde_json::json!({
        "is_connected": false,
        "peer_count": 0,
        "sync_height": 0,
        "network_height": 0,
        "is_syncing": false,
        "connection_type": "Disconnected"
    }));

    // Update advanced manager snapshot
    if let Some(manager) = ADVANCED_WALLET_MANAGER.get().cloned() {
        manager.update_wallet_info(EnhancedWalletInfo {
            address: address.clone(),
            balance,
            unlocked_balance,
            locked_balance: balance.saturating_sub(unlocked_balance),
            total_received: balance,
            total_sent: 0,
            transaction_count: 0,
            is_synced: network.get("is_syncing").and_then(|v| v.as_bool()).map(|s| !s).unwrap_or(false),
            sync_height: network.get("sync_height").and_then(|v| v.as_u64()).unwrap_or(0),
            network_height: network.get("network_height").and_then(|v| v.as_u64()).unwrap_or(0),
            daemon_height: network.get("network_height").and_then(|v| v.as_u64()).unwrap_or(0),
            is_connected: network.get("is_connected").and_then(|v| v.as_bool()).unwrap_or(false),
            peer_count: network.get("peer_count").and_then(|v| v.as_u64()).unwrap_or(0) as u32,
            last_block_time: None,
            wallet_version: env!("CARGO_PKG_VERSION").to_string(),
            seed_phrase: None,
            view_key: None,
            spend_key: None,
            restore_height: 0,
            auto_refresh: true,
            refresh_from_block_height: 0,
            subaddress_count: 0,
            subaddress_lookahead: 0,
            wallet_creation_time: None,
            last_backup_time: None,
            last_sync_time: Some(SystemTime::now().duration_since(UNIX_EPOCH).unwrap_or(Duration::from_secs(0)).as_secs()),
            sync_speed: 0.0,
            estimated_sync_time: None,
        });
    }

    Ok(serde_json::json!({
        "address": address,
        "balance": balance,
        "unlocked_balance": unlocked_balance,
        "is_connected": network.get("is_connected").and_then(|v| v.as_bool()).unwrap_or(false),
        "network": network,
    }))
}

/// Get advanced transactions snapshot (placeholder)
#[tauri::command]
async fn get_advanced_transactions() -> Result<Vec<serde_json::Value>, String> {
    if let Some(manager) = ADVANCED_WALLET_MANAGER.get().cloned() {
        let txs: Vec<AdvancedTransactionInfo> = manager.get_advanced_transactions();
        let mapped: Vec<serde_json::Value> = txs
            .into_iter()
            .map(|t| serde_json::json!({
                "id": t.id,
                "hash": t.hash,
                "amount": t.amount,
                "fee": t.fee,
                "timestamp": t.timestamp,
                "is_confirmed": t.is_confirmed,
                "address": t.destination_addresses.get(0).cloned().unwrap_or_default()
            }))
            .collect();
        Ok(mapped)
    } else {
        Ok(vec![])
    }
}

/// Get application settings
#[tauri::command]
async fn get_app_settings() -> Result<serde_json::Value, String> {
    let mgr = SETTINGS_MANAGER.get().ok_or("Settings manager not initialized")?;
    let settings = mgr.get_settings()?;
    Ok(serde_json::to_value(settings).map_err(|e| e.to_string())?)
}

/// Get available application languages
#[tauri::command]
async fn get_available_app_languages() -> Result<Vec<LanguageInfo>, String> {
    let mgr = I18N_MANAGER.get().ok_or("I18n manager not initialized")?;
    mgr.get_available_languages()
}

/// Get UI notifications
#[tauri::command]
async fn get_notifications() -> Result<Vec<serde_json::Value>, String> {
    if let Some(ui) = ADVANCED_UI_MANAGER.get().cloned() {
        let items = ui.get_notifications();
        let mapped: Vec<serde_json::Value> = items.into_iter().map(|n| serde_json::to_value(n).unwrap_or(serde_json::json!({}))).collect();
        Ok(mapped)
    } else {
        Ok(vec![])
    }
}

// (Removed legacy deposit-address placeholder functions)

/// Get network status (using real CryptoNote)
#[tauri::command]
async fn get_network_status() -> Result<serde_json::Value, String> {
    let mut real_wallet = RealCryptoNoteWallet::new();
    
    let _ = real_wallet
        .open_wallet("/tmp/fuego_wallet.wallet", "fuego_password")
        .or_else(|_| real_wallet.create_wallet("fuego_password", "/tmp/fuego_wallet.wallet", None, 0));
    
    // Only connect if not already connected
    if let Err(e) = connect_to_fuego_network(&mut real_wallet) {
        log::warn!("Network connect attempt failed: {}", e);
    }
    
    real_wallet.get_network_status().map_err(|e| e.to_string())
}

// ===== fuego-wallet compatibility aliases =====

#[tauri::command]
async fn wallet_create(password: String, file_path: String, seed_phrase: Option<String>, restore_height: Option<u64>) -> Result<String, String> {
    let mut wallet = RealCryptoNoteWallet::new();
    wallet.create_wallet(&password, &file_path, seed_phrase.as_deref(), restore_height.unwrap_or(0))
        .map_err(|e| e.to_string())?;
    let address = wallet.get_address().map_err(|e| e.to_string())?;
    Ok(address)
}

#[tauri::command]
async fn wallet_open(file_path: String, password: String) -> Result<String, String> {
    let mut wallet = RealCryptoNoteWallet::new();
    wallet.open_wallet(&file_path, &password).map_err(|e| e.to_string())?;
    let address = wallet.get_address().map_err(|e| e.to_string())?;
    Ok(address)
}

#[tauri::command]
async fn wallet_close() -> Result<(), String> {
    let mut wallet = RealCryptoNoteWallet::new();
    // Best-effort: open then close. In a real implementation, use a shared instance.
    let _ = wallet.open_wallet("/tmp/fuego_wallet.wallet", "fuego_password");
    wallet.close_wallet();
    Ok(())
}

#[tauri::command]
async fn wallet_get_info() -> Result<serde_json::Value, String> { get_wallet_info().await }

#[tauri::command]
async fn wallet_get_balance() -> Result<u64, String> {
    let mut wallet = RealCryptoNoteWallet::new();
    let _ = wallet.open_wallet("/tmp/fuego_wallet.wallet", "fuego_password")
        .or_else(|_| wallet.create_wallet("fuego_password", "/tmp/fuego_wallet.wallet", None, 0));
    wallet.get_balance().map_err(|e| e.to_string())
}

#[tauri::command]
async fn wallet_get_address() -> Result<String, String> {
    let mut wallet = RealCryptoNoteWallet::new();
    let _ = wallet.open_wallet("/tmp/fuego_wallet.wallet", "fuego_password")
        .or_else(|_| wallet.create_wallet("fuego_password", "/tmp/fuego_wallet.wallet", None, 0));
    wallet.get_address().map_err(|e| e.to_string())
}

#[tauri::command]
async fn wallet_get_transactions(limit: Option<u64>, offset: Option<u64>) -> Result<Vec<serde_json::Value>, String> {
    get_transactions(limit, offset).await
}

#[tauri::command]
async fn wallet_send_transaction(recipient: String, amount: u64, payment_id: Option<String>, mixin: Option<u64>) -> Result<String, String> {
    send_transaction(recipient, amount, payment_id, mixin.unwrap_or(5)).await
}

#[tauri::command]
async fn wallet_refresh() -> Result<(), String> {
    let mut wallet = RealCryptoNoteWallet::new();
    let _ = wallet.open_wallet("/tmp/fuego_wallet.wallet", "fuego_password")
        .or_else(|_| wallet.create_wallet("fuego_password", "/tmp/fuego_wallet.wallet", None, 0));
    wallet.refresh().map_err(|e| e.to_string())
}

#[tauri::command]
async fn wallet_rescan(start_height: Option<u64>) -> Result<(), String> {
    let mut wallet = RealCryptoNoteWallet::new();
    let _ = wallet.open_wallet("/tmp/fuego_wallet.wallet", "fuego_password")
        .or_else(|_| wallet.create_wallet("fuego_password", "/tmp/fuego_wallet.wallet", None, 0));
    wallet.rescan_blockchain(start_height.unwrap_or(0)).map_err(|e| e.to_string())
}

#[tauri::command]
async fn network_get_status() -> Result<serde_json::Value, String> { get_network_status().await }

#[tauri::command]
async fn node_connect(address: Option<String>, port: Option<u16>) -> Result<(), String> {
    let mut wallet = RealCryptoNoteWallet::new();
    let _ = wallet.open_wallet("/tmp/fuego_wallet.wallet", "fuego_password")
        .or_else(|_| wallet.create_wallet("fuego_password", "/tmp/fuego_wallet.wallet", None, 0));
    if let Some(addr) = address {
        wallet.connect_to_node(&addr, port.unwrap_or(18180)).map_err(|e| e.to_string())
    } else {
        connect_to_fuego_network(&mut wallet).map_err(|e| e.to_string())
    }
}

#[tauri::command]
async fn node_disconnect() -> Result<(), String> {
    let mut wallet = RealCryptoNoteWallet::new();
    let _ = wallet.open_wallet("/tmp/fuego_wallet.wallet", "fuego_password")
        .or_else(|_| wallet.create_wallet("fuego_password", "/tmp/fuego_wallet.wallet", None, 0));
    wallet.disconnect().map_err(|e| e.to_string())
}

#[tauri::command]
async fn deposit_list() -> Result<Vec<serde_json::Value>, String> { get_term_deposits().await }

#[tauri::command]
async fn deposit_create(amount: u64, term: u32) -> Result<String, String> { create_term_deposit(amount, term).await }

#[tauri::command]
async fn deposit_withdraw(deposit_id: String) -> Result<String, String> { withdraw_term_deposit(deposit_id).await }

#[tauri::command]
async fn estimate_fee(address: String, amount: u64, mixin: Option<u64>) -> Result<u64, String> {
    let mut real_wallet = RealCryptoNoteWallet::new();
    let _ = real_wallet.open_wallet("/tmp/fuego_wallet.wallet", "fuego_password")
        .or_else(|_| real_wallet.create_wallet("fuego_password", "/tmp/fuego_wallet.wallet", None, 0));
    real_wallet.estimate_transaction_fee(&address, amount, mixin.unwrap_or(5)).map_err(|e| e.to_string())
}

#[tauri::command]
async fn validate_address(address: String) -> Result<bool, String> {
    // Real validation: attempt lightweight checks and delegate to CryptoNote wallet if available
    // 1) Prefix and length sanity
    if !address.starts_with("fire") || address.len() < 60 || address.len() > 120 {
        return Ok(false);
    }
    // 2) Base58 decode check (rejects invalid charset/length)
    if bs58::decode(&address).into_vec().is_err() {
        return Ok(false);
    }
    // 3) Ask wallet to accept address in fee estimator (no-op but validates formatting at native layer)
    let mut wallet = RealCryptoNoteWallet::new();
    let _ = wallet.open_wallet("/tmp/fuego_wallet.wallet", "fuego_password")
        .or_else(|_| wallet.create_wallet("fuego_password", "/tmp/fuego_wallet.wallet", None, 0));
    let mixin = 5u64;
    match wallet.estimate_transaction_fee(&address, 1, mixin) {
        Ok(_) => Ok(true),
        Err(_) => Ok(false),
    }
}

/// Test FFI integration
#[tauri::command]
async fn test_ffi_integration() -> Result<serde_json::Value, String> {
    let mut ffi = CryptoNoteFFI::new();
    
    // Test wallet creation
    let create_result = ffi.create_wallet("test_password", "/tmp/test.wallet", None, 0);
    if create_result.is_err() {
        return Err(format!("FFI wallet creation failed: {:?}", create_result.err()));
    }
    
    // Test wallet operations
    let balance = ffi.get_balance().map_err(|e| e.to_string())?;
    let unlocked_balance = ffi.get_unlocked_balance().map_err(|e| e.to_string())?;
    let address = ffi.get_address().map_err(|e| e.to_string())?;
    let is_open = ffi.is_open();
    
    // Test transaction sending
    let tx_result = ffi.send_transaction("FUEGO9876543210fedcba", 100000000, None, 5);
    if tx_result.is_err() {
        return Err(format!("FFI transaction failed: {:?}", tx_result.err()));
    }
    
    Ok(serde_json::json!({
        "status": "success",
        "message": "FFI integration working correctly",
        "wallet": {
            "is_open": is_open,
            "balance": balance,
            "unlocked_balance": unlocked_balance,
            "address": address
        },
        "transaction": {
            "hash": tx_result.unwrap()
        }
    }))
}

/// Test real CryptoNote integration
#[tauri::command]
async fn test_real_cryptonote() -> Result<serde_json::Value, String> {
    let mut real_wallet = RealCryptoNoteWallet::new();
    
    // Test wallet creation
    let create_result = real_wallet.create_wallet("test_password", "/tmp/test_real.wallet", None, 0);
    if create_result.is_err() {
        return Err(format!("Real CryptoNote wallet creation failed: {:?}", create_result.err()));
    }
    
    // Test wallet operations
    let balance = real_wallet.get_balance().map_err(|e| e.to_string())?;
    let unlocked_balance = real_wallet.get_unlocked_balance().map_err(|e| e.to_string())?;
    let address = real_wallet.get_address().map_err(|e| e.to_string())?;
    let is_open = real_wallet.is_open();
    
    // Test network connection
    let network_result = connect_to_fuego_network(&mut real_wallet);
    let network_status = real_wallet.get_network_status().map_err(|e| e.to_string())?;
    
    // Test transaction sending
    let tx_result = real_wallet.send_transaction("fire1234567890abcdef", 100000000, None, 5);
    if tx_result.is_err() {
        return Err(format!("Real CryptoNote transaction failed: {:?}", tx_result.err()));
    }
    
    Ok(serde_json::json!({
        "status": "success",
        "message": "Real CryptoNote integration working correctly",
        "wallet": {
            "is_open": is_open,
            "balance": balance,
            "unlocked_balance": unlocked_balance,
            "address": address
        },
        "network": {
            "connection_result": if network_result.is_ok() { "success" } else { "failed" },
            "status": network_status
        },
        "transaction": {
            "hash": tx_result.unwrap()
        }
    }))
}

/// Get real Fuego network data from fuego.spaceportx.net
#[tauri::command]
async fn get_fuego_network_data() -> Result<serde_json::Value, String> {
    match fetch_fuego_network_data().await {
        Ok(data) => {
            log::info!("Fetched real Fuego network data: height={}, peers={}", 
                      data["height"], data["peer_count"]);
            Ok(data)
        }
        Err(e) => {
            log::error!("Failed to fetch Fuego network data: {}", e);
            Err(format!("Failed to fetch network data: {}", e))
        }
    }
}

/// Send a transaction
#[tauri::command]
async fn send_transaction(
    recipient: String,
    amount: u64,
    payment_id: Option<String>,
    mixin: u64,
) -> Result<String, String> {
    let mut real_wallet = RealCryptoNoteWallet::new();
    
    // Try to open existing wallet first
    let wallet_result = real_wallet.open_wallet("/tmp/fuego_wallet.wallet", "fuego_password")
        .or_else(|_| real_wallet.create_wallet("fuego_password", "/tmp/fuego_wallet.wallet", None, 0));
    
    if let Err(e) = wallet_result {
        return Err(format!("Failed to open/create wallet: {}", e));
    }
    
    // Connect to Fuego network
    if let Err(e) = connect_to_fuego_network(&mut real_wallet) {
        log::warn!("Failed to connect to Fuego network: {}", e);
        // Continue without network connection
    }
    
    // Send transaction
    match real_wallet.send_transaction(&recipient, amount, payment_id.as_deref(), mixin) {
        Ok(tx_hash) => {
            log::info!("Transaction sent successfully: {}", tx_hash);
            Ok(tx_hash)
        }
        Err(e) => {
            log::error!("Failed to send transaction: {}", e);
            Err(format!("Failed to send transaction: {}", e))
        }
    }
}

/// Get term deposits (staking/investment positions)
#[tauri::command]
async fn get_term_deposits() -> Result<Vec<serde_json::Value>, String> {
    let mut real_wallet = RealCryptoNoteWallet::new();
    
    // Try to open existing wallet first
    let wallet_result = real_wallet.open_wallet("/tmp/fuego_wallet.wallet", "fuego_password")
        .or_else(|_| real_wallet.create_wallet("fuego_password", "/tmp/fuego_wallet.wallet", None, 0));
    
    if let Err(e) = wallet_result {
        return Err(format!("Failed to open/create wallet: {}", e));
    }
    
    // Connect to Fuego network
    let _ = connect_to_fuego_network(&mut real_wallet);
    
    // Get real deposits from CryptoNote wallet
    match real_wallet.get_deposits() {
        Ok(deposits) => {
            let mut deposit_list = Vec::new();
            
            for deposit in deposits {
                let deposit_json = serde_json::json!({
                    "id": deposit.id,
                    "amount": deposit.amount,
                    "interest": deposit.interest,
                    "term": deposit.term,
                    "rate": deposit.rate,
                    "status": deposit.status,
                    "unlock_height": deposit.unlock_height,
                    "unlock_time": deposit.unlock_time,
                    "creating_transaction_hash": deposit.creating_transaction_hash,
                    "creating_height": deposit.creating_height,
                    "creating_time": deposit.creating_time,
                    "spending_transaction_hash": deposit.spending_transaction_hash,
                    "spending_height": deposit.spending_height,
                    "spending_time": deposit.spending_time,
                    "type": deposit.deposit_type
                });
                deposit_list.push(deposit_json);
            }
            
            log::info!("Retrieved {} term deposits from blockchain", deposit_list.len());
            Ok(deposit_list)
        }
        Err(e) => {
            log::error!("Failed to get deposits: {}", e);
            Err(format!("Failed to get deposits: {}", e))
        }
    }
}

/// Create a new term deposit (stake XFG for interest)
#[tauri::command]
async fn create_term_deposit(amount: u64, term: u32) -> Result<String, String> {
    let mut real_wallet = RealCryptoNoteWallet::new();
    
    // Try to open existing wallet first
    let wallet_result = real_wallet.open_wallet("/tmp/fuego_wallet.wallet", "fuego_password")
        .or_else(|_| real_wallet.create_wallet("fuego_password", "/tmp/fuego_wallet.wallet", None, 0));
    
    if let Err(e) = wallet_result {
        return Err(format!("Failed to open/create wallet: {}", e));
    }
    
    // Connect to Fuego network
    let _ = connect_to_fuego_network(&mut real_wallet);
    
    // Validate deposit parameters
    if amount < 10000000 { // Minimum 1 XFG
        return Err("Minimum deposit amount is 1 XFG".to_string());
    }
    
    if term < 1 || term > 365 { // Term between 1 and 365 days
        return Err("Term must be between 1 and 365 days".to_string());
    }
    
    // Create real deposit transaction using CryptoNote
    match real_wallet.create_deposit(amount, term) {
        Ok(deposit_id) => {
            log::info!("Created term deposit: {} XFG for {} days (ID: {})", amount / 10000000, term, deposit_id);
            Ok(deposit_id)
        }
        Err(e) => {
            log::error!("Failed to create deposit: {}", e);
            Err(format!("Failed to create deposit: {}", e))
        }
    }
}

/// Withdraw a term deposit (claim principal + interest)
#[tauri::command]
async fn withdraw_term_deposit(deposit_id: String) -> Result<String, String> {
    let mut real_wallet = RealCryptoNoteWallet::new();
    
    // Try to open existing wallet first
    let wallet_result = real_wallet.open_wallet("/tmp/fuego_wallet.wallet", "fuego_password")
        .or_else(|_| real_wallet.create_wallet("fuego_password", "/tmp/fuego_wallet.wallet", None, 0));
    
    if let Err(e) = wallet_result {
        return Err(format!("Failed to open/create wallet: {}", e));
    }
    
    // Connect to Fuego network
    let _ = connect_to_fuego_network(&mut real_wallet);
    
    // Withdraw deposit using real CryptoNote functionality
    match real_wallet.withdraw_deposit(&deposit_id) {
        Ok(tx_hash) => {
            log::info!("Withdrew term deposit: {} (TX: {})", deposit_id, tx_hash);
            Ok(tx_hash)
        }
        Err(e) => {
            log::error!("Failed to withdraw deposit: {}", e);
            Err(format!("Failed to withdraw deposit: {}", e))
        }
    }
}

// ===== PHASE 2.2: SECURITY & PERFORMANCE COMMANDS =====

/// Authenticate user with password
#[tauri::command]
async fn authenticate_user(user_id: String, password: String) -> Result<String, String> {
    let timer = PERFORMANCE_MONITOR.get().unwrap().start_timing("authenticate_user".to_string());
    
    let security_manager = SECURITY_MANAGER.get().unwrap();
    match security_manager.authenticate(&user_id, &password) {
        Ok(session_id) => {
            timer.finish(true);
            log::info!("User {} authenticated successfully", user_id);
            Ok(session_id)
        }
        Err(e) => {
            timer.finish(false);
            log::warn!("Authentication failed for user {}: {}", user_id, e);
            Err(e)
        }
    }
}

/// Validate user session
#[tauri::command]
async fn validate_session(session_id: String) -> Result<String, String> {
    let timer = PERFORMANCE_MONITOR.get().unwrap().start_timing("validate_session".to_string());
    
    let security_manager = SECURITY_MANAGER.get().unwrap();
    match security_manager.validate_session(&session_id) {
        Ok(user_id) => {
            security_manager.update_session_activity(&session_id).ok();
            timer.finish(true);
            Ok(user_id)
        }
        Err(e) => {
            timer.finish(false);
            Err(e)
        }
    }
}

/// Lock session for sensitive operations
#[tauri::command]
async fn lock_session(session_id: String) -> Result<(), String> {
    let security_manager = SECURITY_MANAGER.get().unwrap();
    security_manager.lock_session(&session_id)
}

/// Unlock session with password
#[tauri::command]
async fn unlock_session(session_id: String, password: String) -> Result<(), String> {
    let security_manager = SECURITY_MANAGER.get().unwrap();
    security_manager.unlock_session(&session_id, &password)
}

/// Logout user and destroy session
#[tauri::command]
async fn logout_user(session_id: String) -> Result<(), String> {
    let security_manager = SECURITY_MANAGER.get().unwrap();
    security_manager.logout(&session_id)
}

/// Validate password strength
#[tauri::command]
async fn validate_password_strength(password: String) -> Result<serde_json::Value, String> {
    match PasswordValidator::validate_strength(&password) {
        Ok(_) => {
            let score = PasswordValidator::calculate_strength_score(&password);
            Ok(serde_json::json!({
                "valid": true,
                "score": score,
                "strength": match score {
                    0..=30 => "weak",
                    31..=60 => "medium",
                    61..=80 => "strong",
                    81..=100 => "very_strong",
                    _ => "unknown"
                }
            }))
        }
        Err(e) => {
            let score = PasswordValidator::calculate_strength_score(&password);
            Ok(serde_json::json!({
                "valid": false,
                "error": e,
                "score": score,
                "strength": "weak"
            }))
        }
    }
}

/// Encrypt wallet data
#[tauri::command]
async fn encrypt_wallet_data(data: String, password: String) -> Result<String, String> {
    WalletEncryption::encrypt_data(&data, &password)
}

/// Decrypt wallet data
#[tauri::command]
async fn decrypt_wallet_data(encrypted_data: String, password: String) -> Result<String, String> {
    WalletEncryption::decrypt_data(&encrypted_data, &password)
}

/// Get performance metrics
#[tauri::command]
async fn get_performance_metrics(operation_name: Option<String>) -> Result<serde_json::Value, String> {
    let monitor = PERFORMANCE_MONITOR.get().unwrap();
    
    if let Some(name) = operation_name {
        match monitor.get_average_performance(&name) {
            Some(avg_perf) => Ok(serde_json::json!({
                "operation_name": avg_perf.operation_name,
                "average_duration_ms": avg_perf.average_duration_ms,
                "average_memory_mb": avg_perf.average_memory_mb,
                "success_rate": avg_perf.success_rate,
                "total_calls": avg_perf.total_calls
            })),
            None => Ok(serde_json::json!({
                "error": "No metrics found for operation"
            }))
        }
    } else {
        let metrics = monitor.get_metrics(None);
        Ok(serde_json::json!({
            "total_operations": metrics.len(),
            "operations": metrics
        }))
    }
}

/// Get cache statistics
#[tauri::command]
async fn get_cache_stats() -> Result<serde_json::Value, String> {
    let cache = CACHE.get().unwrap();
    let stats = cache.stats();
    Ok(serde_json::json!({
        "total_entries": stats.total_entries,
        "expired_entries": stats.expired_entries,
        "active_entries": stats.active_entries,
        "max_size": stats.max_size,
        "hit_rate": if stats.total_entries > 0 {
            (stats.active_entries as f64 / stats.total_entries as f64) * 100.0
        } else {
            0.0
        }
    }))
}

/// Clear cache
#[tauri::command]
async fn clear_cache() -> Result<(), String> {
    let cache = CACHE.get().unwrap();
    cache.clear();
    log::info!("Cache cleared");
    Ok(())
}

/// Get background task status
#[tauri::command]
async fn get_background_task_status(task_name: String) -> Result<serde_json::Value, String> {
    let task_manager = BACKGROUND_TASKS.get().unwrap();
    
    match task_manager.get_task_status(&task_name) {
        Some(status) => Ok(serde_json::json!({
            "name": status.name,
            "enabled": status.enabled,
            "last_run": status.last_run.elapsed().as_secs(),
            "next_run_in": status.next_run_in.as_secs()
        })),
        None => Err("Task not found".to_string())
    }
}

/// Enable background task
#[tauri::command]
async fn enable_background_task(task_name: String) -> Result<(), String> {
    let task_manager = BACKGROUND_TASKS.get().unwrap();
    task_manager.set_task_enabled(&task_name, true);
    log::info!("Background task {} enabled", task_name);
    Ok(())
}

/// Disable background task
#[tauri::command]
async fn disable_background_task(task_name: String) -> Result<(), String> {
    let task_manager = BACKGROUND_TASKS.get().unwrap();
    task_manager.set_task_enabled(&task_name, false);
    log::info!("Background task {} disabled", task_name);
    Ok(())
}

// ===== PHASE 2.3: ADVANCED WALLET COMMANDS =====

// Get comprehensive wallet information
#[tauri::command]
async fn get_wallet_info_advanced() -> Result<serde_json::Value, String> {
    let mut real_wallet = RealCryptoNoteWallet::new();

    let _ = real_wallet.open_wallet("/tmp/fuego_wallet.wallet", "fuego_password")
        .or_else(|_| real_wallet.create_wallet("fuego_password", "/tmp/fuego_wallet.wallet", None, 0));

    match real_wallet.get_wallet_info() {
        Ok(info) => Ok(serde_json::json!({
            "address": info.address,
            "balance": info.balance,
            "unlocked_balance": info.unlocked_balance,
            "locked_balance": info.locked_balance,
            "total_received": info.total_received,
            "total_sent": info.total_sent,
            "transaction_count": info.transaction_count,
            "is_synced": info.is_synced,
            "sync_height": info.sync_height,
            "network_height": info.network_height,
            "daemon_height": info.daemon_height,
            "is_connected": info.is_connected,
            "peer_count": info.peer_count,
            "last_block_time": info.last_block_time
        })),
        Err(e) => Err(format!("Failed to get wallet info: {}", e))
    }
}

// Get detailed network information
#[tauri::command]
async fn get_network_info_advanced() -> Result<serde_json::Value, String> {
    let mut real_wallet = RealCryptoNoteWallet::new();

    let _ = real_wallet.open_wallet("/tmp/fuego_wallet.wallet", "fuego_password")
        .or_else(|_| real_wallet.create_wallet("fuego_password", "/tmp/fuego_wallet.wallet", None, 0));

    match real_wallet.get_network_info() {
        Ok(info) => Ok(serde_json::json!({
            "is_connected": info.is_connected,
            "peer_count": info.peer_count,
            "sync_height": info.sync_height,
            "network_height": info.network_height,
            "is_syncing": info.is_syncing,
            "connection_type": info.connection_type,
            "last_sync_time": info.last_sync_time,
            "sync_speed": info.sync_speed,
            "estimated_sync_time": info.estimated_sync_time
        })),
        Err(e) => Err(format!("Failed to get network info: {}", e))
    }
}

// Get transaction by hash
#[tauri::command]
async fn get_transaction_by_hash(tx_hash: String) -> Result<serde_json::Value, String> {
    let mut real_wallet = RealCryptoNoteWallet::new();

    let _ = real_wallet.open_wallet("/tmp/fuego_wallet.wallet", "fuego_password")
        .or_else(|_| real_wallet.create_wallet("fuego_password", "/tmp/fuego_wallet.wallet", None, 0));

    match real_wallet.get_transaction_by_hash(&tx_hash) {
        Ok(tx) => Ok(serde_json::json!({
            "id": tx.id,
            "hash": tx.hash,
            "amount": tx.amount,
            "fee": tx.fee,
            "height": tx.height,
            "timestamp": tx.timestamp,
            "confirmations": tx.confirmations,
            "is_confirmed": tx.is_confirmed,
            "is_pending": tx.is_pending,
            "payment_id": tx.payment_id,
            "destination_addresses": tx.destination_addresses,
            "source_addresses": tx.source_addresses,
            "unlock_time": tx.unlock_time,
            "extra": tx.extra
        })),
        Err(e) => Err(format!("Failed to get transaction: {}", e))
    }
}

// Create new address
#[tauri::command]
async fn create_address(label: Option<String>) -> Result<String, String> {
    let mut real_wallet = RealCryptoNoteWallet::new();

    let _ = real_wallet.open_wallet("/tmp/fuego_wallet.wallet", "fuego_password")
        .or_else(|_| real_wallet.create_wallet("fuego_password", "/tmp/fuego_wallet.wallet", None, 0));

    match real_wallet.create_address(label.as_deref()) {
        Ok(address) => Ok(address),
        Err(e) => Err(format!("Failed to create address: {}", e))
    }
}

// Get block information
#[tauri::command]
async fn get_block_info(height: u64) -> Result<serde_json::Value, String> {
    let mut real_wallet = RealCryptoNoteWallet::new();

    let _ = real_wallet.open_wallet("/tmp/fuego_wallet.wallet", "fuego_password")
        .or_else(|_| real_wallet.create_wallet("fuego_password", "/tmp/fuego_wallet.wallet", None, 0));

    match real_wallet.get_block_info(height) {
        Ok(block) => Ok(serde_json::json!({
            "height": block.height,
            "hash": block.hash,
            "timestamp": block.timestamp,
            "difficulty": block.difficulty,
            "reward": block.reward,
            "size": block.size,
            "transaction_count": block.transaction_count,
            "is_main_chain": block.is_main_chain
        })),
        Err(e) => Err(format!("Failed to get block info: {}", e))
    }
}

// Mining commands
#[tauri::command]
async fn start_mining(
    threads: u32, 
    background: bool,
    daemon_address: Option<String>,
    pool_wallet: Option<String>,
    pool_password: Option<String>
) -> Result<bool, String> {
    let mut real_wallet = RealCryptoNoteWallet::new();

    let _ = real_wallet.open_wallet("/tmp/fuego_wallet.wallet", "fuego_password")
        .or_else(|_| real_wallet.create_wallet("fuego_password", "/tmp/fuego_wallet.wallet", None, 0));

    // If daemon address is provided, connect for solo mining
    if let Some(address) = daemon_address {
        let parts: Vec<&str> = address.split(':').collect();
        let host = parts[0];
        let port: u16 = parts.get(1).and_then(|p| p.parse().ok()).unwrap_or(18180);
        if let Err(e) = real_wallet.connect_to_node(host, port) {
            eprintln!("Failed to connect solo daemon {}:{} - {}", host, port, e);
        }
    } else {
        let _ = connect_to_fuego_network(&mut real_wallet);
    }

    // If pool wallet is provided, configure pool mining
    if let Some(wallet_addr) = pool_wallet {
        let worker = pool_password.clone().unwrap_or_else(|| "worker".to_string());
        if let Err(e) = real_wallet.set_mining_pool(None, Some(&worker)) {
            eprintln!("Failed to set mining pool worker: {}", e);
        }
        // Note: Pool URL is set via set_mining_pool(pool_address, worker_name) when provided by UI
        let _ = wallet_addr; // Wallet used internally by daemon/pool; native layer manages it.
    }

    match real_wallet.start_mining(threads, background) {
        Ok(_) => Ok(true),
        Err(e) => {
            eprintln!("Failed to start mining: {}", e);
            Ok(false)
        }
    }
}

#[tauri::command]
async fn stop_mining() -> Result<(), String> {
    let mut real_wallet = RealCryptoNoteWallet::new();

    let _ = real_wallet.open_wallet("/tmp/fuego_wallet.wallet", "fuego_password")
        .or_else(|_| real_wallet.create_wallet("fuego_password", "/tmp/fuego_wallet.wallet", None, 0));

    match real_wallet.stop_mining() {
        Ok(_) => Ok(()),
        Err(e) => Err(format!("Failed to stop mining: {}", e))
    }
}

#[tauri::command]
async fn get_mining_info() -> Result<serde_json::Value, String> {
    let mut real_wallet = RealCryptoNoteWallet::new();

    let _ = real_wallet.open_wallet("/tmp/fuego_wallet.wallet", "fuego_password")
        .or_else(|_| real_wallet.create_wallet("fuego_password", "/tmp/fuego_wallet.wallet", None, 0));

    match real_wallet.get_mining_info() {
        Ok(info) => Ok(serde_json::json!({
            "is_mining": info.is_mining,
            "hashrate": info.hashrate,
            "difficulty": info.difficulty,
            "block_reward": info.block_reward,
            "pool_address": info.pool_address,
            "worker_name": info.worker_name,
            "threads": info.threads
        })),
        Err(e) => Err(format!("Failed to get mining info: {}", e))
    }
}

// Get transaction history
#[tauri::command]
async fn get_transaction_history(limit: Option<u64>, offset: Option<u64>) -> Result<Vec<serde_json::Value>, String> {
    let mut real_wallet = RealCryptoNoteWallet::new();

    let _ = real_wallet.open_wallet("/tmp/fuego_wallet.wallet", "fuego_password")
        .or_else(|_| real_wallet.create_wallet("fuego_password", "/tmp/fuego_wallet.wallet", None, 0));

    match real_wallet.get_transaction_history(limit.unwrap_or(50), offset.unwrap_or(0)) {
        Ok(transactions) => {
            let mapped: Vec<serde_json::Value> = transactions
                .into_iter()
                .map(|tx| serde_json::json!({
                    "id": tx.id,
                    "hash": tx.hash,
                    "amount": tx.amount,
                    "fee": tx.fee,
                    "height": tx.height,
                    "timestamp": tx.timestamp,
                    "confirmations": tx.confirmations,
                    "is_confirmed": tx.is_confirmed,
                    "is_pending": tx.is_pending,
                    "payment_id": tx.payment_id,
                    "destination_addresses": tx.destination_addresses,
                    "source_addresses": tx.source_addresses,
                    "unlock_time": tx.unlock_time,
                    "extra": tx.extra
                }))
                .collect();
            Ok(mapped)
        }
        Err(e) => Err(format!("Failed to get transaction history: {}", e))
    }
}

// Sync progress commands
#[tauri::command]
async fn get_sync_progress() -> Result<serde_json::Value, String> {
    let mut real_wallet = RealCryptoNoteWallet::new();

    let _ = real_wallet.open_wallet("/tmp/fuego_wallet.wallet", "fuego_password")
        .or_else(|_| real_wallet.create_wallet("fuego_password", "/tmp/fuego_wallet.wallet", None, 0));

    match real_wallet.get_sync_progress() {
        Ok(progress) => Ok(serde_json::json!({
            "current_height": progress.current_height,
            "total_height": progress.total_height,
            "progress_percentage": progress.progress_percentage,
            "estimated_time_remaining": progress.estimated_time_remaining,
            "is_syncing": progress.is_syncing
        })),
        Err(e) => Err(format!("Failed to get sync progress: {}", e))
    }
}

#[tauri::command]
async fn get_sync_status_json() -> Result<String, String> {
    let mut real_wallet = RealCryptoNoteWallet::new();

    let _ = real_wallet.open_wallet("/tmp/fuego_wallet.wallet", "fuego_password")
        .or_else(|_| real_wallet.create_wallet("fuego_password", "/tmp/fuego_wallet.wallet", None, 0));

    match real_wallet.get_sync_status_json() {
        Ok(json) => Ok(json),
        Err(e) => Err(format!("Failed to get sync status JSON: {}", e))
    }
}

// Address book commands
#[tauri::command]
async fn add_address_book_entry(address: String, label: Option<String>, description: Option<String>) -> Result<(), String> {
    let mut real_wallet = RealCryptoNoteWallet::new();

    let _ = real_wallet.open_wallet("/tmp/fuego_wallet.wallet", "fuego_password")
        .or_else(|_| real_wallet.create_wallet("fuego_password", "/tmp/fuego_wallet.wallet", None, 0));

    match real_wallet.add_address_book_entry(&address, label.as_deref(), description.as_deref()) {
        Ok(_) => Ok(()),
        Err(e) => Err(format!("Failed to add address book entry: {}", e))
    }
}

#[tauri::command]
async fn remove_address_book_entry(address: String) -> Result<(), String> {
    let mut real_wallet = RealCryptoNoteWallet::new();

    let _ = real_wallet.open_wallet("/tmp/fuego_wallet.wallet", "fuego_password")
        .or_else(|_| real_wallet.create_wallet("fuego_password", "/tmp/fuego_wallet.wallet", None, 0));

    match real_wallet.remove_address_book_entry(&address) {
        Ok(_) => Ok(()),
        Err(e) => Err(format!("Failed to remove address book entry: {}", e))
    }
}

#[tauri::command]
async fn update_address_book_entry(address: String, label: Option<String>, description: Option<String>) -> Result<(), String> {
    let mut real_wallet = RealCryptoNoteWallet::new();

    let _ = real_wallet.open_wallet("/tmp/fuego_wallet.wallet", "fuego_password")
        .or_else(|_| real_wallet.create_wallet("fuego_password", "/tmp/fuego_wallet.wallet", None, 0));

    match real_wallet.update_address_book_entry(&address, label.as_deref(), description.as_deref()) {
        Ok(_) => Ok(()),
        Err(e) => Err(format!("Failed to update address book entry: {}", e))
    }
}

#[tauri::command]
async fn get_address_book() -> Result<Vec<serde_json::Value>, String> {
    let mut real_wallet = RealCryptoNoteWallet::new();

    let _ = real_wallet.open_wallet("/tmp/fuego_wallet.wallet", "fuego_password")
        .or_else(|_| real_wallet.create_wallet("fuego_password", "/tmp/fuego_wallet.wallet", None, 0));

    match real_wallet.get_address_book() {
        Ok(entries) => {
            let mapped: Vec<serde_json::Value> = entries
                .into_iter()
                .map(|entry| serde_json::json!({
                    "address": entry.address,
                    "label": entry.label,
                    "description": entry.description,
                    "created_time": entry.created_time,
                    "last_used_time": entry.last_used_time,
                    "use_count": entry.use_count
                }))
                .collect();
            Ok(mapped)
        }
        Err(e) => Err(format!("Failed to get address book: {}", e))
    }
}

#[tauri::command]
async fn mark_address_used(address: String) -> Result<(), String> {
    let mut real_wallet = RealCryptoNoteWallet::new();

    let _ = real_wallet.open_wallet("/tmp/fuego_wallet.wallet", "fuego_password")
        .or_else(|_| real_wallet.create_wallet("fuego_password", "/tmp/fuego_wallet.wallet", None, 0));

    match real_wallet.mark_address_used(&address) {
        Ok(_) => Ok(()),
        Err(e) => Err(format!("Failed to mark address as used: {}", e))
    }
}

#[tauri::command]
async fn get_address_book_entry(address: String) -> Result<Option<serde_json::Value>, String> {
    let mut real_wallet = RealCryptoNoteWallet::new();

    let _ = real_wallet.open_wallet("/tmp/fuego_wallet.wallet", "fuego_password")
        .or_else(|_| real_wallet.create_wallet("fuego_password", "/tmp/fuego_wallet.wallet", None, 0));

    match real_wallet.get_address_book_entry(&address) {
        Ok(Some(entry)) => Ok(Some(serde_json::json!({
            "address": entry.address,
            "label": entry.label,
            "description": entry.description,
            "created_time": entry.created_time,
            "last_used_time": entry.last_used_time,
            "use_count": entry.use_count
        }))),
        Ok(None) => Ok(None),
        Err(e) => Err(format!("Failed to get address book entry: {}", e))
    }
}

#[tauri::command]
async fn set_mining_pool(pool_address: Option<String>, worker_name: Option<String>) -> Result<(), String> {
    let mut real_wallet = RealCryptoNoteWallet::new();

    let _ = real_wallet.open_wallet("/tmp/fuego_wallet.wallet", "fuego_password")
        .or_else(|_| real_wallet.create_wallet("fuego_password", "/tmp/fuego_wallet.wallet", None, 0));

    match real_wallet.set_mining_pool(pool_address.as_deref(), worker_name.as_deref()) {
        Ok(_) => Ok(()),
        Err(e) => Err(format!("Failed to set mining pool: {}", e))
    }
}

#[tauri::command]
async fn get_mining_stats_json() -> Result<String, String> {
    let mut real_wallet = RealCryptoNoteWallet::new();

    let _ = real_wallet.open_wallet("/tmp/fuego_wallet.wallet", "fuego_password")
        .or_else(|_| real_wallet.create_wallet("fuego_password", "/tmp/fuego_wallet.wallet", None, 0));

    match real_wallet.get_mining_stats_json() {
        Ok(json) => Ok(json),
        Err(e) => Err(format!("Failed to get mining statistics: {}", e))
    }
}

// Wrapper commands for compatibility with frontend
#[tauri::command]
async fn wallet_start_mining(
    threads: u32, 
    background: bool,
    daemon_address: Option<String>,
    pool_wallet: Option<String>,
    pool_password: Option<String>
) -> Result<bool, String> {
    start_mining(threads, background, daemon_address, pool_wallet, pool_password).await
}

#[tauri::command]
async fn wallet_stop_mining() -> Result<(), String> {
    stop_mining().await
}

#[tauri::command]
async fn wallet_set_mining_pool(pool_address: Option<String>, worker_name: Option<String>) -> Result<(), String> {
    set_mining_pool(pool_address, worker_name).await
}

#[tauri::command]
async fn get_mining_status() -> Result<String, String> {
    get_mining_stats_json().await
}

// Secure key management commands
#[tauri::command]
async fn generate_seed_phrase() -> Result<String, String> {
    match RealCryptoNoteWallet::generate_seed_phrase() {
        Ok(seed) => Ok(seed),
        Err(e) => Err(format!("Failed to generate seed phrase: {}", e))
    }
}

#[tauri::command]
async fn validate_seed_phrase(seed_phrase: String) -> Result<bool, String> {
    match RealCryptoNoteWallet::validate_seed_phrase(&seed_phrase) {
        Ok(is_valid) => Ok(is_valid),
        Err(e) => Err(format!("Failed to validate seed phrase: {}", e))
    }
}

#[tauri::command]
async fn derive_keys_from_seed(seed_phrase: String, password: String) -> Result<(), String> {
    let mut real_wallet = RealCryptoNoteWallet::new();

    let _ = real_wallet.open_wallet("/tmp/fuego_wallet.wallet", "fuego_password")
        .or_else(|_| real_wallet.create_wallet("fuego_password", "/tmp/fuego_wallet.wallet", None, 0));

    match real_wallet.derive_keys_from_seed(&seed_phrase, &password) {
        Ok(_) => Ok(()),
        Err(e) => Err(format!("Failed to derive keys from seed: {}", e))
    }
}

#[tauri::command]
async fn get_seed_phrase(password: String) -> Result<String, String> {
    let mut real_wallet = RealCryptoNoteWallet::new();

    let _ = real_wallet.open_wallet("/tmp/fuego_wallet.wallet", "fuego_password")
        .or_else(|_| real_wallet.create_wallet("fuego_password", "/tmp/fuego_wallet.wallet", None, 0));

    match real_wallet.get_seed_phrase(&password) {
        Ok(seed) => Ok(seed),
        Err(e) => Err(format!("Failed to get seed phrase: {}", e))
    }
}

#[tauri::command]
async fn get_view_key() -> Result<String, String> {
    let mut real_wallet = RealCryptoNoteWallet::new();

    let _ = real_wallet.open_wallet("/tmp/fuego_wallet.wallet", "fuego_password")
        .or_else(|_| real_wallet.create_wallet("fuego_password", "/tmp/fuego_wallet.wallet", None, 0));

    match real_wallet.get_view_key() {
        Ok(key) => Ok(key),
        Err(e) => Err(format!("Failed to get view key: {}", e))
    }
}

#[tauri::command]
async fn get_spend_key() -> Result<String, String> {
    let mut real_wallet = RealCryptoNoteWallet::new();

    let _ = real_wallet.open_wallet("/tmp/fuego_wallet.wallet", "fuego_password")
        .or_else(|_| real_wallet.create_wallet("fuego_password", "/tmp/fuego_wallet.wallet", None, 0));

    match real_wallet.get_spend_key() {
        Ok(key) => Ok(key),
        Err(e) => Err(format!("Failed to get spend key: {}", e))
    }
}

#[tauri::command]
async fn has_keys() -> Result<bool, String> {
    let mut real_wallet = RealCryptoNoteWallet::new();

    let _ = real_wallet.open_wallet("/tmp/fuego_wallet.wallet", "fuego_password")
        .or_else(|_| real_wallet.create_wallet("fuego_password", "/tmp/fuego_wallet.wallet", None, 0));

    match real_wallet.has_keys() {
        Ok(has_keys) => Ok(has_keys),
        Err(e) => Err(format!("Failed to check if wallet has keys: {}", e))
    }
}

#[tauri::command]
async fn export_keys() -> Result<String, String> {
    let mut real_wallet = RealCryptoNoteWallet::new();

    let _ = real_wallet.open_wallet("/tmp/fuego_wallet.wallet", "fuego_password")
        .or_else(|_| real_wallet.create_wallet("fuego_password", "/tmp/fuego_wallet.wallet", None, 0));

    match real_wallet.export_keys() {
        Ok(keys) => Ok(keys),
        Err(e) => Err(format!("Failed to export keys: {}", e))
    }
}

#[tauri::command]
async fn import_keys(view_key: String, spend_key: String, address: String) -> Result<(), String> {
    let mut real_wallet = RealCryptoNoteWallet::new();

    let _ = real_wallet.open_wallet("/tmp/fuego_wallet.wallet", "fuego_password")
        .or_else(|_| real_wallet.create_wallet("fuego_password", "/tmp/fuego_wallet.wallet", None, 0));

    match real_wallet.import_keys(&view_key, &spend_key, &address) {
        Ok(_) => Ok(()),
        Err(e) => Err(format!("Failed to import keys: {}", e))
    }
}

// ===== PHASE 2.3: PRODUCTION FEATURES COMMANDS =====
