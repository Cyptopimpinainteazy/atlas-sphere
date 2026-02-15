use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::sync::{Arc, Mutex};

/// Translation structure
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Translation {
    pub key: String,
    pub value: String,
    pub context: Option<String>,
}

/// Language information
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct LanguageInfo {
    pub code: String,
    pub name: String,
    pub native_name: String,
    pub flag: String,
    pub rtl: bool,
}

/// Internationalization manager
#[derive(Debug)]
pub struct I18nManager {
    current_language: Arc<Mutex<String>>,
    translations: Arc<Mutex<HashMap<String, HashMap<String, String>>>>,
    languages: Arc<Mutex<Vec<LanguageInfo>>>,
}

impl I18nManager {
    pub fn new() -> Self {
        let manager = Self {
            current_language: Arc::new(Mutex::new("en".to_string())),
            translations: Arc::new(Mutex::new(HashMap::new())),
            languages: Arc::new(Mutex::new(Vec::new())),
        };
        
        manager.initialize_languages();
        manager.initialize_translations();
        manager
    }
    
    fn initialize_languages(&self) {
        let languages = vec![
            LanguageInfo {
                code: "en".to_string(),
                name: "English".to_string(),
                native_name: "English".to_string(),
                flag: "🇺🇸".to_string(),
                rtl: false,
            },
            LanguageInfo {
                code: "es".to_string(),
                name: "Spanish".to_string(),
                native_name: "Español".to_string(),
                flag: "🇪🇸".to_string(),
                rtl: false,
            },
            LanguageInfo {
                code: "fr".to_string(),
                name: "French".to_string(),
                native_name: "Français".to_string(),
                flag: "🇫🇷".to_string(),
                rtl: false,
            },
            LanguageInfo {
                code: "de".to_string(),
                name: "German".to_string(),
                native_name: "Deutsch".to_string(),
                flag: "🇩🇪".to_string(),
                rtl: false,
            },
            LanguageInfo {
                code: "it".to_string(),
                name: "Italian".to_string(),
                native_name: "Italiano".to_string(),
                flag: "🇮🇹".to_string(),
                rtl: false,
            },
            LanguageInfo {
                code: "pt".to_string(),
                name: "Portuguese".to_string(),
                native_name: "Português".to_string(),
                flag: "🇵🇹".to_string(),
                rtl: false,
            },
            LanguageInfo {
                code: "ru".to_string(),
                name: "Russian".to_string(),
                native_name: "Русский".to_string(),
                flag: "🇷🇺".to_string(),
                rtl: false,
            },
            LanguageInfo {
                code: "zh".to_string(),
                name: "Chinese".to_string(),
                native_name: "中文".to_string(),
                flag: "🇨🇳".to_string(),
                rtl: false,
            },
            LanguageInfo {
                code: "ja".to_string(),
                name: "Japanese".to_string(),
                native_name: "日本語".to_string(),
                flag: "🇯🇵".to_string(),
                rtl: false,
            },
            LanguageInfo {
                code: "ko".to_string(),
                name: "Korean".to_string(),
                native_name: "한국어".to_string(),
                flag: "🇰🇷".to_string(),
                rtl: false,
            },
            LanguageInfo {
                code: "ar".to_string(),
                name: "Arabic".to_string(),
                native_name: "العربية".to_string(),
                flag: "🇸🇦".to_string(),
                rtl: true,
            },
        ];
        
        *self.languages.lock().unwrap() = languages;
    }
    
    fn initialize_translations(&self) {
        let mut translations = HashMap::new();
        
        // English translations
        let mut en_translations = HashMap::new();
        en_translations.insert("app.title".to_string(), "Fuego Wallet".to_string());
        en_translations.insert("app.subtitle".to_string(), "Secure XFG Wallet".to_string());
        en_translations.insert("wallet.balance".to_string(), "Balance".to_string());
        en_translations.insert("wallet.address".to_string(), "Address".to_string());
        en_translations.insert("wallet.send".to_string(), "Send XFG".to_string());
        en_translations.insert("wallet.receive".to_string(), "Receive XFG".to_string());
        en_translations.insert("wallet.transactions".to_string(), "Transactions".to_string());
        en_translations.insert("wallet.deposits".to_string(), "Term Deposits".to_string());
        en_translations.insert("network.status".to_string(), "Network Status".to_string());
        en_translations.insert("network.syncing".to_string(), "Syncing".to_string());
        en_translations.insert("network.synced".to_string(), "Synced".to_string());
        en_translations.insert("network.peers".to_string(), "Peers".to_string());
        en_translations.insert("settings.title".to_string(), "Settings".to_string());
        en_translations.insert("settings.wallet".to_string(), "Wallet".to_string());
        en_translations.insert("settings.network".to_string(), "Network".to_string());
        en_translations.insert("settings.ui".to_string(), "User Interface".to_string());
        en_translations.insert("settings.security".to_string(), "Security".to_string());
        en_translations.insert("settings.performance".to_string(), "Performance".to_string());
        en_translations.insert("backup.title".to_string(), "Backup & Recovery".to_string());
        en_translations.insert("backup.create".to_string(), "Create Backup".to_string());
        en_translations.insert("backup.restore".to_string(), "Restore Backup".to_string());
        en_translations.insert("backup.export".to_string(), "Export Backup".to_string());
        en_translations.insert("backup.import".to_string(), "Import Backup".to_string());
        en_translations.insert("common.save".to_string(), "Save".to_string());
        en_translations.insert("common.cancel".to_string(), "Cancel".to_string());
        en_translations.insert("common.confirm".to_string(), "Confirm".to_string());
        en_translations.insert("common.delete".to_string(), "Delete".to_string());
        en_translations.insert("common.edit".to_string(), "Edit".to_string());
        en_translations.insert("common.close".to_string(), "Close".to_string());
        en_translations.insert("common.refresh".to_string(), "Refresh".to_string());
        en_translations.insert("common.loading".to_string(), "Loading...".to_string());
        en_translations.insert("common.error".to_string(), "Error".to_string());
        en_translations.insert("common.success".to_string(), "Success".to_string());
        en_translations.insert("common.warning".to_string(), "Warning".to_string());
        en_translations.insert("common.info".to_string(), "Information".to_string());
        translations.insert("en".to_string(), en_translations);
        
        // Spanish translations
        let mut es_translations = HashMap::new();
        es_translations.insert("app.title".to_string(), "Cartera Fuego".to_string());
        es_translations.insert("app.subtitle".to_string(), "Cartera Segura XFG".to_string());
        es_translations.insert("wallet.balance".to_string(), "Saldo".to_string());
        es_translations.insert("wallet.address".to_string(), "Dirección".to_string());
        es_translations.insert("wallet.send".to_string(), "Enviar XFG".to_string());
        es_translations.insert("wallet.receive".to_string(), "Recibir XFG".to_string());
        es_translations.insert("wallet.transactions".to_string(), "Transacciones".to_string());
        es_translations.insert("wallet.deposits".to_string(), "Depósitos a Plazo".to_string());
        es_translations.insert("network.status".to_string(), "Estado de Red".to_string());
        es_translations.insert("network.syncing".to_string(), "Sincronizando".to_string());
        es_translations.insert("network.synced".to_string(), "Sincronizado".to_string());
        es_translations.insert("network.peers".to_string(), "Pares".to_string());
        es_translations.insert("settings.title".to_string(), "Configuración".to_string());
        es_translations.insert("settings.wallet".to_string(), "Cartera".to_string());
        es_translations.insert("settings.network".to_string(), "Red".to_string());
        es_translations.insert("settings.ui".to_string(), "Interfaz de Usuario".to_string());
        es_translations.insert("settings.security".to_string(), "Seguridad".to_string());
        es_translations.insert("settings.performance".to_string(), "Rendimiento".to_string());
        es_translations.insert("backup.title".to_string(), "Respaldo y Recuperación".to_string());
        es_translations.insert("backup.create".to_string(), "Crear Respaldo".to_string());
        es_translations.insert("backup.restore".to_string(), "Restaurar Respaldo".to_string());
        es_translations.insert("backup.export".to_string(), "Exportar Respaldo".to_string());
        es_translations.insert("backup.import".to_string(), "Importar Respaldo".to_string());
        es_translations.insert("common.save".to_string(), "Guardar".to_string());
        es_translations.insert("common.cancel".to_string(), "Cancelar".to_string());
        es_translations.insert("common.confirm".to_string(), "Confirmar".to_string());
        es_translations.insert("common.delete".to_string(), "Eliminar".to_string());
        es_translations.insert("common.edit".to_string(), "Editar".to_string());
        es_translations.insert("common.close".to_string(), "Cerrar".to_string());
        es_translations.insert("common.refresh".to_string(), "Actualizar".to_string());
        es_translations.insert("common.loading".to_string(), "Cargando...".to_string());
        es_translations.insert("common.error".to_string(), "Error".to_string());
        es_translations.insert("common.success".to_string(), "Éxito".to_string());
        es_translations.insert("common.warning".to_string(), "Advertencia".to_string());
        es_translations.insert("common.info".to_string(), "Información".to_string());
        translations.insert("es".to_string(), es_translations);
        
        // French translations
        let mut fr_translations = HashMap::new();
        fr_translations.insert("app.title".to_string(), "Portefeuille Fuego".to_string());
        fr_translations.insert("app.subtitle".to_string(), "Portefeuille Sécurisé XFG".to_string());
        fr_translations.insert("wallet.balance".to_string(), "Solde".to_string());
        fr_translations.insert("wallet.address".to_string(), "Adresse".to_string());
        fr_translations.insert("wallet.send".to_string(), "Envoyer XFG".to_string());
        fr_translations.insert("wallet.receive".to_string(), "Recevoir XFG".to_string());
        fr_translations.insert("wallet.transactions".to_string(), "Transactions".to_string());
        fr_translations.insert("wallet.deposits".to_string(), "Dépôts à Terme".to_string());
        fr_translations.insert("network.status".to_string(), "Statut du Réseau".to_string());
        fr_translations.insert("network.syncing".to_string(), "Synchronisation".to_string());
        fr_translations.insert("network.synced".to_string(), "Synchronisé".to_string());
        fr_translations.insert("network.peers".to_string(), "Pairs".to_string());
        fr_translations.insert("settings.title".to_string(), "Paramètres".to_string());
        fr_translations.insert("settings.wallet".to_string(), "Portefeuille".to_string());
        fr_translations.insert("settings.network".to_string(), "Réseau".to_string());
        fr_translations.insert("settings.ui".to_string(), "Interface Utilisateur".to_string());
        fr_translations.insert("settings.security".to_string(), "Sécurité".to_string());
        fr_translations.insert("settings.performance".to_string(), "Performance".to_string());
        fr_translations.insert("backup.title".to_string(), "Sauvegarde et Récupération".to_string());
        fr_translations.insert("backup.create".to_string(), "Créer Sauvegarde".to_string());
        fr_translations.insert("backup.restore".to_string(), "Restaurer Sauvegarde".to_string());
        fr_translations.insert("backup.export".to_string(), "Exporter Sauvegarde".to_string());
        fr_translations.insert("backup.import".to_string(), "Importer Sauvegarde".to_string());
        fr_translations.insert("common.save".to_string(), "Enregistrer".to_string());
        fr_translations.insert("common.cancel".to_string(), "Annuler".to_string());
        fr_translations.insert("common.confirm".to_string(), "Confirmer".to_string());
        fr_translations.insert("common.delete".to_string(), "Supprimer".to_string());
        fr_translations.insert("common.edit".to_string(), "Modifier".to_string());
        fr_translations.insert("common.close".to_string(), "Fermer".to_string());
        fr_translations.insert("common.refresh".to_string(), "Actualiser".to_string());
        fr_translations.insert("common.loading".to_string(), "Chargement...".to_string());
        fr_translations.insert("common.error".to_string(), "Erreur".to_string());
        fr_translations.insert("common.success".to_string(), "Succès".to_string());
        fr_translations.insert("common.warning".to_string(), "Avertissement".to_string());
        fr_translations.insert("common.info".to_string(), "Information".to_string());
        translations.insert("fr".to_string(), fr_translations);
        
        *self.translations.lock().unwrap() = translations;
    }
    
    pub fn get_current_language(&self) -> Result<String, String> {
        self.current_language.lock()
            .map_err(|e| format!("Failed to lock current language: {}", e))
            .map(|lang| lang.clone())
    }
    
    pub fn set_language(&self, language_code: String) -> Result<(), String> {
        let languages = self.languages.lock()
            .map_err(|e| format!("Failed to lock languages: {}", e))?;
        
        if !languages.iter().any(|lang| lang.code == language_code) {
            return Err(format!("Unsupported language: {}", language_code));
        }
        
        *self.current_language.lock()
            .map_err(|e| format!("Failed to lock current language: {}", e))? = language_code;
        
        Ok(())
    }
    
    pub fn get_available_languages(&self) -> Result<Vec<LanguageInfo>, String> {
        self.languages.lock()
            .map_err(|e| format!("Failed to lock languages: {}", e))
            .map(|langs| langs.clone())
    }
    
    pub fn translate(&self, key: &str) -> Result<String, String> {
        let current_lang = self.get_current_language()?;
        let translations = self.translations.lock()
            .map_err(|e| format!("Failed to lock translations: {}", e))?;
        
        if let Some(lang_translations) = translations.get(&current_lang) {
            if let Some(translation) = lang_translations.get(key) {
                return Ok(translation.clone());
            }
        }
        
        // Fallback to English
        if let Some(en_translations) = translations.get("en") {
            if let Some(translation) = en_translations.get(key) {
                return Ok(translation.clone());
            }
        }
        
        // Return key if no translation found
        Ok(key.to_string())
    }
    
    pub fn translate_with_params(&self, key: &str, params: HashMap<String, String>) -> Result<String, String> {
        let mut translation = self.translate(key)?;
        
        for (param_key, param_value) in params {
            translation = translation.replace(&format!("{{{}}}", param_key), &param_value);
        }
        
        Ok(translation)
    }
    
    pub fn add_translation(&self, language_code: String, key: String, value: String) -> Result<(), String> {
        let mut translations = self.translations.lock()
            .map_err(|e| format!("Failed to lock translations: {}", e))?;
        
        translations.entry(language_code)
            .or_insert_with(HashMap::new)
            .insert(key, value);
        
        Ok(())
    }
    
    pub fn is_rtl(&self) -> Result<bool, String> {
        let current_lang = self.get_current_language()?;
        let languages = self.languages.lock()
            .map_err(|e| format!("Failed to lock languages: {}", e))?;
        
        if let Some(lang_info) = languages.iter().find(|lang| lang.code == current_lang) {
            Ok(lang_info.rtl)
        } else {
            Ok(false)
        }
    }
}

// Tauri commands are defined in lib.rs
