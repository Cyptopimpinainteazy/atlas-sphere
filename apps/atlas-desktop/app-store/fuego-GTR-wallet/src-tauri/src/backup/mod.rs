use serde::{Deserialize, Serialize};
use std::fs;
use std::path::{Path, PathBuf};
use std::sync::{Arc, Mutex};
use std::time::{SystemTime, UNIX_EPOCH};
use zip::{write::FileOptions, CompressionMethod, ZipWriter};
use std::io::Write;

/// Backup information structure
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct BackupInfo {
    pub id: String,
    pub name: String,
    pub created_at: u64,
    pub size_bytes: u64,
    pub backup_type: BackupType,
    pub description: String,
    pub file_path: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum BackupType {
    Full,
    WalletOnly,
    SettingsOnly,
    TransactionsOnly,
}

/// Backup data structure
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct BackupData {
    pub wallet_info: Option<serde_json::Value>,
    pub transactions: Option<Vec<serde_json::Value>>,
    pub settings: Option<serde_json::Value>,
    pub network_status: Option<serde_json::Value>,
    pub metadata: BackupMetadata,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct BackupMetadata {
    pub version: String,
    pub created_at: u64,
    pub backup_type: BackupType,
    pub fuego_version: String,
    pub platform: String,
}

/// Backup manager
#[derive(Debug)]
pub struct BackupManager {
    backups: Arc<Mutex<Vec<BackupInfo>>>,
    backup_dir: PathBuf,
}

impl BackupManager {
    pub fn new() -> Result<Self, String> {
        let backup_dir = dirs::data_dir()
            .ok_or("Failed to get data directory")?
            .join("fuego-wallet")
            .join("backups");
        
        fs::create_dir_all(&backup_dir)
            .map_err(|e| format!("Failed to create backup directory: {}", e))?;
        
        let manager = Self {
            backups: Arc::new(Mutex::new(Vec::new())),
            backup_dir,
        };
        
        manager.scan_existing_backups()?;
        Ok(manager)
    }
    
    pub fn create_backup(
        &self,
        name: String,
        description: String,
        backup_type: BackupType,
        data: BackupData,
    ) -> Result<BackupInfo, String> {
        let timestamp = SystemTime::now()
            .duration_since(UNIX_EPOCH)
            .map_err(|e| format!("Failed to get timestamp: {}", e))?
            .as_secs();
        
        let backup_id = format!("backup_{}_{}", timestamp, uuid::Uuid::new_v4().to_string()[..8].to_string());
        let filename = format!("{}.zip", backup_id);
        let file_path = self.backup_dir.join(&filename);
        
        // Create backup file
        self.write_backup_file(&file_path, &data)?;
        
        // Get file size
        let size_bytes = fs::metadata(&file_path)
            .map_err(|e| format!("Failed to get file metadata: {}", e))?
            .len();
        
        let backup_info = BackupInfo {
            id: backup_id,
            name,
            created_at: timestamp,
            size_bytes,
            backup_type,
            description,
            file_path: file_path.to_string_lossy().to_string(),
        };
        
        // Add to backups list
        let mut backups = self.backups.lock()
            .map_err(|e| format!("Failed to lock backups: {}", e))?;
        backups.push(backup_info.clone());
        
        // Save backups index
        self.save_backups_index()?;
        
        Ok(backup_info)
    }
    
    pub fn restore_backup(&self, backup_id: String) -> Result<BackupData, String> {
        let backups = self.backups.lock()
            .map_err(|e| format!("Failed to lock backups: {}", e))?;
        
        let backup_info = backups.iter()
            .find(|b| b.id == backup_id)
            .ok_or("Backup not found")?
            .clone();
        
        let file_path = Path::new(&backup_info.file_path);
        self.read_backup_file(file_path)
    }
    
    pub fn list_backups(&self) -> Result<Vec<BackupInfo>, String> {
        let backups = self.backups.lock()
            .map_err(|e| format!("Failed to lock backups: {}", e))?;
        Ok(backups.clone())
    }
    
    pub fn delete_backup(&self, backup_id: String) -> Result<(), String> {
        let mut backups = self.backups.lock()
            .map_err(|e| format!("Failed to lock backups: {}", e))?;
        
        let backup_info = backups.iter()
            .find(|b| b.id == backup_id)
            .ok_or("Backup not found")?
            .clone();
        
        // Remove file
        fs::remove_file(&backup_info.file_path)
            .map_err(|e| format!("Failed to delete backup file: {}", e))?;
        
        // Remove from list
        backups.retain(|b| b.id != backup_id);
        
        // Save backups index
        self.save_backups_index()?;
        
        Ok(())
    }
    
    pub fn export_backup(&self, backup_id: String, export_path: String) -> Result<(), String> {
        let backups = self.backups.lock()
            .map_err(|e| format!("Failed to lock backups: {}", e))?;
        
        let backup_info = backups.iter()
            .find(|b| b.id == backup_id)
            .ok_or("Backup not found")?
            .clone();
        
        let source_path = Path::new(&backup_info.file_path);
        let dest_path = Path::new(&export_path);
        
        fs::copy(source_path, dest_path)
            .map_err(|e| format!("Failed to copy backup file: {}", e))?;
        
        Ok(())
    }
    
    fn write_backup_file(&self, file_path: &PathBuf, data: &BackupData) -> Result<(), String> {
        let file = fs::File::create(file_path)
            .map_err(|e| format!("Failed to create backup file: {}", e))?;
        
        let mut zip = ZipWriter::new(file);
        let options = FileOptions::default()
            .compression_method(CompressionMethod::Deflated)
            .unix_permissions(0o755);
        
        // Write wallet data
        if let Some(ref wallet_info) = data.wallet_info {
            zip.start_file("wallet.json", options)
                .map_err(|e| format!("Failed to start wallet file: {}", e))?;
            let wallet_json = serde_json::to_string_pretty(wallet_info)
                .map_err(|e| format!("Failed to serialize wallet: {}", e))?;
            zip.write_all(wallet_json.as_bytes())
                .map_err(|e| format!("Failed to write wallet data: {}", e))?;
        }
        
        // Write transactions
        if let Some(ref transactions) = data.transactions {
            zip.start_file("transactions.json", options)
                .map_err(|e| format!("Failed to start transactions file: {}", e))?;
            let transactions_json = serde_json::to_string_pretty(transactions)
                .map_err(|e| format!("Failed to serialize transactions: {}", e))?;
            zip.write_all(transactions_json.as_bytes())
                .map_err(|e| format!("Failed to write transactions data: {}", e))?;
        }
        
        // Write settings
        if let Some(ref settings) = data.settings {
            zip.start_file("settings.json", options)
                .map_err(|e| format!("Failed to start settings file: {}", e))?;
            let settings_json = serde_json::to_string_pretty(settings)
                .map_err(|e| format!("Failed to serialize settings: {}", e))?;
            zip.write_all(settings_json.as_bytes())
                .map_err(|e| format!("Failed to write settings data: {}", e))?;
        }
        
        // Write network status
        if let Some(ref network_status) = data.network_status {
            zip.start_file("network_status.json", options)
                .map_err(|e| format!("Failed to start network status file: {}", e))?;
            let network_json = serde_json::to_string_pretty(network_status)
                .map_err(|e| format!("Failed to serialize network status: {}", e))?;
            zip.write_all(network_json.as_bytes())
                .map_err(|e| format!("Failed to write network status data: {}", e))?;
        }
        
        // Write metadata
        zip.start_file("metadata.json", options)
            .map_err(|e| format!("Failed to start metadata file: {}", e))?;
        let metadata_json = serde_json::to_string_pretty(&data.metadata)
            .map_err(|e| format!("Failed to serialize metadata: {}", e))?;
        zip.write_all(metadata_json.as_bytes())
            .map_err(|e| format!("Failed to write metadata: {}", e))?;
        
        zip.finish()
            .map_err(|e| format!("Failed to finish zip file: {}", e))?;
        
        Ok(())
    }
    
    fn read_backup_file(&self, file_path: &Path) -> Result<BackupData, String> {
        let file = fs::File::open(file_path)
            .map_err(|e| format!("Failed to open backup file: {}", e))?;
        
        let mut archive = zip::ZipArchive::new(file)
            .map_err(|e| format!("Failed to read zip archive: {}", e))?;
        
        let mut backup_data = BackupData {
            wallet_info: None,
            transactions: None,
            settings: None,
            network_status: None,
            metadata: BackupMetadata {
                version: "1.0.0".to_string(),
                created_at: 0,
                backup_type: BackupType::Full,
                fuego_version: "1.0.0".to_string(),
                platform: std::env::consts::OS.to_string(),
            },
        };
        
        // Read metadata
        if let Ok(mut metadata_file) = archive.by_name("metadata.json") {
            let mut metadata_content = String::new();
            std::io::Read::read_to_string(&mut metadata_file, &mut metadata_content)
                .map_err(|e| format!("Failed to read metadata: {}", e))?;
            backup_data.metadata = serde_json::from_str(&metadata_content)
                .map_err(|e| format!("Failed to parse metadata: {}", e))?;
        }
        
        // Read wallet data
        if let Ok(mut wallet_file) = archive.by_name("wallet.json") {
            let mut wallet_content = String::new();
            std::io::Read::read_to_string(&mut wallet_file, &mut wallet_content)
                .map_err(|e| format!("Failed to read wallet data: {}", e))?;
            backup_data.wallet_info = Some(serde_json::from_str(&wallet_content)
                .map_err(|e| format!("Failed to parse wallet data: {}", e))?);
        }
        
        // Read transactions
        if let Ok(mut transactions_file) = archive.by_name("transactions.json") {
            let mut transactions_content = String::new();
            std::io::Read::read_to_string(&mut transactions_file, &mut transactions_content)
                .map_err(|e| format!("Failed to read transactions: {}", e))?;
            backup_data.transactions = Some(serde_json::from_str(&transactions_content)
                .map_err(|e| format!("Failed to parse transactions: {}", e))?);
        }
        
        // Read settings
        if let Ok(mut settings_file) = archive.by_name("settings.json") {
            let mut settings_content = String::new();
            std::io::Read::read_to_string(&mut settings_file, &mut settings_content)
                .map_err(|e| format!("Failed to read settings: {}", e))?;
            backup_data.settings = Some(serde_json::from_str(&settings_content)
                .map_err(|e| format!("Failed to parse settings: {}", e))?);
        }
        
        // Read network status
        if let Ok(mut network_file) = archive.by_name("network_status.json") {
            let mut network_content = String::new();
            std::io::Read::read_to_string(&mut network_file, &mut network_content)
                .map_err(|e| format!("Failed to read network status: {}", e))?;
            backup_data.network_status = Some(serde_json::from_str(&network_content)
                .map_err(|e| format!("Failed to parse network status: {}", e))?);
        }
        
        Ok(backup_data)
    }
    
    fn scan_existing_backups(&self) -> Result<(), String> {
        let mut backups = Vec::new();
        
        for entry in fs::read_dir(&self.backup_dir)
            .map_err(|e| format!("Failed to read backup directory: {}", e))? {
            let entry = entry.map_err(|e| format!("Failed to read directory entry: {}", e))?;
            let path = entry.path();
            
            if path.extension().and_then(|s| s.to_str()) == Some("zip") {
                if let Ok(metadata) = fs::metadata(&path) {
                    let filename = path.file_stem()
                        .and_then(|s| s.to_str())
                        .ok_or("Invalid filename")?;
                    
                    let backup_info = BackupInfo {
                        id: filename.to_string(),
                        name: format!("Backup {}", filename),
                        created_at: metadata.modified()
                            .map_err(|e| format!("Failed to get file modification time: {}", e))?
                            .duration_since(UNIX_EPOCH)
                            .map_err(|e| format!("Failed to get timestamp: {}", e))?
                            .as_secs(),
                        size_bytes: metadata.len(),
                        backup_type: BackupType::Full,
                        description: "Imported backup".to_string(),
                        file_path: path.to_string_lossy().to_string(),
                    };
                    
                    backups.push(backup_info);
                }
            }
        }
        
        *self.backups.lock()
            .map_err(|e| format!("Failed to lock backups: {}", e))? = backups;
        
        Ok(())
    }
    
    fn save_backups_index(&self) -> Result<(), String> {
        let backups = self.backups.lock()
            .map_err(|e| format!("Failed to lock backups: {}", e))?;
        
        let index_path = self.backup_dir.join("backups_index.json");
        let content = serde_json::to_string_pretty(&*backups)
            .map_err(|e| format!("Failed to serialize backups index: {}", e))?;
        
        fs::write(index_path, content)
            .map_err(|e| format!("Failed to write backups index: {}", e))?;
        
        Ok(())
    }
}

// Tauri commands are defined in lib.rs
