use serde::{Deserialize, Serialize};
use std::fs;
use std::path::PathBuf;
use std::sync::{Arc, Mutex};

/// Application settings structure
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AppSettings {
    pub wallet: WalletSettings,
    pub network: NetworkSettings,
    pub ui: UISettings,
    pub security: SecuritySettings,
    pub performance: PerformanceSettings,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct WalletSettings {
    pub auto_save: bool,
    pub auto_backup: bool,
    pub backup_interval_hours: u32,
    pub default_mixin: u32,
    pub confirm_transactions: bool,
    pub show_advanced_options: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct NetworkSettings {
    pub node_address: String,
    pub node_port: u16,
    pub auto_connect: bool,
    pub connection_timeout: u32,
    pub max_peers: u32,
    pub sync_threshold: u32,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct UISettings {
    pub theme: String,
    pub language: String,
    pub currency_display: String,
    pub decimal_places: u8,
    pub auto_refresh: bool,
    pub refresh_interval: u32,
    pub show_notifications: bool,
    pub minimize_to_tray: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SecuritySettings {
    pub auto_lock: bool,
    pub lock_timeout_minutes: u32,
    pub require_password_for_send: bool,
    pub encrypt_wallet_file: bool,
    pub session_timeout_minutes: u32,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PerformanceSettings {
    pub enable_caching: bool,
    pub cache_size_mb: u32,
    pub background_sync: bool,
    pub log_level: String,
    pub enable_metrics: bool,
}

impl Default for AppSettings {
    fn default() -> Self {
        Self {
            wallet: WalletSettings {
                auto_save: true,
                auto_backup: true,
                backup_interval_hours: 24,
                default_mixin: 5,
                confirm_transactions: true,
                show_advanced_options: false,
            },
            network: NetworkSettings {
                node_address: "fuego.spaceportx.net".to_string(),
                node_port: 18180,
                auto_connect: true,
                connection_timeout: 30,
                max_peers: 50,
                sync_threshold: 10,
            },
            ui: UISettings {
                theme: "dark".to_string(),
                language: "en".to_string(),
                currency_display: "XFG".to_string(),
                decimal_places: 7,
                auto_refresh: true,
                refresh_interval: 5,
                show_notifications: true,
                minimize_to_tray: true,
            },
            security: SecuritySettings {
                auto_lock: true,
                lock_timeout_minutes: 15,
                require_password_for_send: true,
                encrypt_wallet_file: true,
                session_timeout_minutes: 60,
            },
            performance: PerformanceSettings {
                enable_caching: true,
                cache_size_mb: 100,
                background_sync: true,
                log_level: "info".to_string(),
                enable_metrics: true,
            },
        }
    }
}

/// Settings manager
#[derive(Debug)]
pub struct SettingsManager {
    settings: Arc<Mutex<AppSettings>>,
    config_path: PathBuf,
}

impl SettingsManager {
    pub fn new() -> Result<Self, String> {
        let config_dir = dirs::config_dir()
            .ok_or("Failed to get config directory")?
            .join("fuego-wallet");
        
        fs::create_dir_all(&config_dir)
            .map_err(|e| format!("Failed to create config directory: {}", e))?;
        
        let config_path = config_dir.join("settings.json");
        
        let settings = if config_path.exists() {
            Self::load_from_file(&config_path)?
        } else {
            let default_settings = AppSettings::default();
            Self::save_to_file(&config_path, &default_settings)?;
            default_settings
        };
        
        Ok(Self {
            settings: Arc::new(Mutex::new(settings)),
            config_path,
        })
    }
    
    pub fn get_settings(&self) -> Result<AppSettings, String> {
        self.settings.lock()
            .map_err(|e| format!("Failed to lock settings: {}", e))
            .map(|s| s.clone())
    }
    
    pub fn update_settings(&self, new_settings: AppSettings) -> Result<(), String> {
        Self::save_to_file(&self.config_path, &new_settings)?;
        *self.settings.lock()
            .map_err(|e| format!("Failed to lock settings: {}", e))? = new_settings;
        Ok(())
    }
    
    pub fn update_wallet_settings(&self, wallet_settings: WalletSettings) -> Result<(), String> {
        let mut settings = self.settings.lock()
            .map_err(|e| format!("Failed to lock settings: {}", e))?;
        settings.wallet = wallet_settings;
        Self::save_to_file(&self.config_path, &settings)?;
        Ok(())
    }
    
    pub fn update_network_settings(&self, network_settings: NetworkSettings) -> Result<(), String> {
        let mut settings = self.settings.lock()
            .map_err(|e| format!("Failed to lock settings: {}", e))?;
        settings.network = network_settings;
        Self::save_to_file(&self.config_path, &settings)?;
        Ok(())
    }
    
    pub fn update_ui_settings(&self, ui_settings: UISettings) -> Result<(), String> {
        let mut settings = self.settings.lock()
            .map_err(|e| format!("Failed to lock settings: {}", e))?;
        settings.ui = ui_settings;
        Self::save_to_file(&self.config_path, &settings)?;
        Ok(())
    }
    
    pub fn update_security_settings(&self, security_settings: SecuritySettings) -> Result<(), String> {
        let mut settings = self.settings.lock()
            .map_err(|e| format!("Failed to lock settings: {}", e))?;
        settings.security = security_settings;
        Self::save_to_file(&self.config_path, &settings)?;
        Ok(())
    }
    
    pub fn update_performance_settings(&self, performance_settings: PerformanceSettings) -> Result<(), String> {
        let mut settings = self.settings.lock()
            .map_err(|e| format!("Failed to lock settings: {}", e))?;
        settings.performance = performance_settings;
        Self::save_to_file(&self.config_path, &settings)?;
        Ok(())
    }
    
    pub fn reset_to_defaults(&self) -> Result<(), String> {
        let default_settings = AppSettings::default();
        self.update_settings(default_settings)
    }
    
    fn load_from_file(path: &PathBuf) -> Result<AppSettings, String> {
        let content = fs::read_to_string(path)
            .map_err(|e| format!("Failed to read settings file: {}", e))?;
        serde_json::from_str(&content)
            .map_err(|e| format!("Failed to parse settings: {}", e))
    }
    
    fn save_to_file(path: &PathBuf, settings: &AppSettings) -> Result<(), String> {
        let content = serde_json::to_string_pretty(settings)
            .map_err(|e| format!("Failed to serialize settings: {}", e))?;
        fs::write(path, content)
            .map_err(|e| format!("Failed to write settings file: {}", e))?;
        Ok(())
    }
}

// Tauri commands are defined in lib.rs
