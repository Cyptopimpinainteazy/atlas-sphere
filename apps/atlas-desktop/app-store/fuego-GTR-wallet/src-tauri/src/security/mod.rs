// Copyright (c) 2024 Fuego Private Banking Network
// Distributed under the MIT/X11 software license

//! Security module for Fuego Desktop Wallet

use std::collections::HashMap;
use std::sync::{Arc, Mutex};
use std::time::{SystemTime, UNIX_EPOCH};
use serde::{Deserialize, Serialize};

/// Security configuration
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SecurityConfig {
    pub max_login_attempts: u32,
    pub lockout_duration_seconds: u64,
    pub session_timeout_seconds: u64,
    pub require_password_for_sensitive_ops: bool,
    pub auto_lock_enabled: bool,
}

impl Default for SecurityConfig {
    fn default() -> Self {
        Self {
            max_login_attempts: 5,
            lockout_duration_seconds: 300, // 5 minutes
            session_timeout_seconds: 1800, // 30 minutes
            require_password_for_sensitive_ops: true,
            auto_lock_enabled: true,
        }
    }
}

/// User session information
#[derive(Debug, Clone)]
pub struct UserSession {
    pub user_id: String,
    pub created_at: u64,
    pub last_activity: u64,
    pub is_locked: bool,
}

/// Security manager for handling authentication and session management
#[derive(Debug)]
pub struct SecurityManager {
    config: SecurityConfig,
    sessions: Arc<Mutex<HashMap<String, UserSession>>>,
    failed_attempts: Arc<Mutex<HashMap<String, (u32, u64)>>>, // (attempts, last_attempt_time)
}

impl SecurityManager {
    pub fn new(config: SecurityConfig) -> Self {
        Self {
            config,
            sessions: Arc::new(Mutex::new(HashMap::new())),
            failed_attempts: Arc::new(Mutex::new(HashMap::new())),
        }
    }

    /// Authenticate user with password
    pub fn authenticate(&self, user_id: &str, password: &str) -> Result<String, String> {
        // Check if user is locked out
        if self.is_user_locked_out(user_id) {
            return Err("Account is temporarily locked due to too many failed attempts".to_string());
        }

        // Validate password (in real implementation, this would hash and compare)
        if self.validate_password(password) {
            // Clear failed attempts
            self.clear_failed_attempts(user_id);
            
            // Create session
            let session_id = self.create_session(user_id);
            Ok(session_id)
        } else {
            // Record failed attempt
            self.record_failed_attempt(user_id);
            Err("Invalid password".to_string())
        }
    }

    /// Validate session
    pub fn validate_session(&self, session_id: &str) -> Result<String, String> {
        let sessions = self.sessions.lock().unwrap();
        
        if let Some(session) = sessions.get(session_id) {
            let now = SystemTime::now().duration_since(UNIX_EPOCH).unwrap().as_secs();
            
            if session.is_locked {
                return Err("Session is locked".to_string());
            }
            
            if now - session.last_activity > self.config.session_timeout_seconds {
                return Err("Session expired".to_string());
            }
            
            Ok(session.user_id.clone())
        } else {
            Err("Invalid session".to_string())
        }
    }

    /// Update session activity
    pub fn update_session_activity(&self, session_id: &str) -> Result<(), String> {
        let mut sessions = self.sessions.lock().unwrap();
        
        if let Some(session) = sessions.get_mut(session_id) {
            session.last_activity = SystemTime::now().duration_since(UNIX_EPOCH).unwrap().as_secs();
            Ok(())
        } else {
            Err("Session not found".to_string())
        }
    }

    /// Lock session (for sensitive operations)
    pub fn lock_session(&self, session_id: &str) -> Result<(), String> {
        let mut sessions = self.sessions.lock().unwrap();
        
        if let Some(session) = sessions.get_mut(session_id) {
            session.is_locked = true;
            Ok(())
        } else {
            Err("Session not found".to_string())
        }
    }

    /// Unlock session with password
    pub fn unlock_session(&self, session_id: &str, password: &str) -> Result<(), String> {
        if !self.validate_password(password) {
            return Err("Invalid password".to_string());
        }

        let mut sessions = self.sessions.lock().unwrap();
        
        if let Some(session) = sessions.get_mut(session_id) {
            session.is_locked = false;
            session.last_activity = SystemTime::now().duration_since(UNIX_EPOCH).unwrap().as_secs();
            Ok(())
        } else {
            Err("Session not found".to_string())
        }
    }

    /// Logout and destroy session
    pub fn logout(&self, session_id: &str) -> Result<(), String> {
        let mut sessions = self.sessions.lock().unwrap();
        sessions.remove(session_id);
        Ok(())
    }

    /// Check if user is locked out
    fn is_user_locked_out(&self, user_id: &str) -> bool {
        let failed_attempts = self.failed_attempts.lock().unwrap();
        
        if let Some((attempts, last_attempt)) = failed_attempts.get(user_id) {
            let now = SystemTime::now().duration_since(UNIX_EPOCH).unwrap().as_secs();
            
            if *attempts >= self.config.max_login_attempts {
                if now - last_attempt < self.config.lockout_duration_seconds {
                    return true;
                }
            }
        }
        
        false
    }

    /// Record failed login attempt
    fn record_failed_attempt(&self, user_id: &str) {
        let mut failed_attempts = self.failed_attempts.lock().unwrap();
        let now = SystemTime::now().duration_since(UNIX_EPOCH).unwrap().as_secs();
        
        let attempts = failed_attempts.get(user_id).map(|(a, _)| *a).unwrap_or(0);
        failed_attempts.insert(user_id.to_string(), (attempts + 1, now));
    }

    /// Clear failed attempts for user
    fn clear_failed_attempts(&self, user_id: &str) {
        let mut failed_attempts = self.failed_attempts.lock().unwrap();
        failed_attempts.remove(user_id);
    }

    /// Create new session
    fn create_session(&self, user_id: &str) -> String {
        let session_id = format!("session_{}_{}", user_id, SystemTime::now().duration_since(UNIX_EPOCH).unwrap().as_secs());
        let now = SystemTime::now().duration_since(UNIX_EPOCH).unwrap().as_secs();
        
        let session = UserSession {
            user_id: user_id.to_string(),
            created_at: now,
            last_activity: now,
            is_locked: false,
        };
        
        let mut sessions = self.sessions.lock().unwrap();
        sessions.insert(session_id.clone(), session);
        
        session_id
    }

    /// Validate password (placeholder - in real implementation, this would use proper hashing)
    fn validate_password(&self, password: &str) -> bool {
        // For demo purposes, accept "fuego_password" as valid
        // In production, this would use proper password hashing (bcrypt, Argon2, etc.)
        password == "fuego_password"
    }
}

/// Password strength validator
pub struct PasswordValidator;

impl PasswordValidator {
    /// Check password strength
    pub fn validate_strength(password: &str) -> Result<(), String> {
        if password.len() < 8 {
            return Err("Password must be at least 8 characters long".to_string());
        }
        
        if !password.chars().any(|c| c.is_uppercase()) {
            return Err("Password must contain at least one uppercase letter".to_string());
        }
        
        if !password.chars().any(|c| c.is_lowercase()) {
            return Err("Password must contain at least one lowercase letter".to_string());
        }
        
        if !password.chars().any(|c| c.is_numeric()) {
            return Err("Password must contain at least one number".to_string());
        }
        
        if !password.chars().any(|c| "!@#$%^&*()_+-=[]{}|;:,.<>?".contains(c)) {
            return Err("Password must contain at least one special character".to_string());
        }
        
        Ok(())
    }
    
    /// Calculate password strength score (0-100)
    pub fn calculate_strength_score(password: &str) -> u8 {
        let mut score = 0;
        
        // Length bonus
        if password.len() >= 8 { score += 20; }
        if password.len() >= 12 { score += 10; }
        if password.len() >= 16 { score += 10; }
        
        // Character variety bonus
        if password.chars().any(|c| c.is_uppercase()) { score += 15; }
        if password.chars().any(|c| c.is_lowercase()) { score += 15; }
        if password.chars().any(|c| c.is_numeric()) { score += 15; }
        if password.chars().any(|c| "!@#$%^&*()_+-=[]{}|;:,.<>?".contains(c)) { score += 15; }
        
        score.min(100)
    }
}

/// Wallet encryption utilities
pub struct WalletEncryption;

impl WalletEncryption {
    /// Encrypt sensitive data with AES-256-GCM using Argon2-derived key
    pub fn encrypt_data(data: &str, password: &str) -> Result<String, String> {
        use aes_gcm::{Aes256Gcm, Key, Nonce, KeyInit};
        use aes_gcm::aead::{Aead, OsRng};
        use rand::RngCore;
        use argon2::{Argon2, PasswordHasher};
        use argon2::password_hash::{SaltString, PasswordHasher as _};
        use base64::{Engine as _, engine::general_purpose};

        // Derive key with Argon2id
        let salt = SaltString::generate(&mut OsRng);
        let argon2 = Argon2::default();
        let hash = argon2.hash_password(password.as_bytes(), &salt)
            .map_err(|e| format!("Argon2 error: {}", e))?;
        // Use the hash bytes (truncate/expand) for 32-byte key
        let key_bytes = blake3::hash(hash.hash.ok_or("Missing Argon2 hash")?.as_bytes()).as_bytes().clone();
        let key = Key::<Aes256Gcm>::from_slice(&key_bytes);
        let cipher = Aes256Gcm::new(key);

        // Random nonce
        let mut nonce_bytes = [0u8; 12];
        OsRng.fill_bytes(&mut nonce_bytes);
        let nonce = Nonce::from_slice(&nonce_bytes);

        let ciphertext = cipher.encrypt(nonce, data.as_bytes())
            .map_err(|e| format!("Encrypt error: {}", e))?;

        // Pack salt | nonce | ciphertext (all base64)
        let out = serde_json::json!({
            "s": salt.as_str(),
            "n": general_purpose::STANDARD.encode(nonce_bytes),
            "c": general_purpose::STANDARD.encode(ciphertext),
        });
        Ok(out.to_string())
    }
    
    /// Decrypt sensitive data with AES-256-GCM using Argon2-derived key
    pub fn decrypt_data(encrypted_data: &str, password: &str) -> Result<String, String> {
        use aes_gcm::{Aes256Gcm, Key, Nonce, KeyInit};
        use aes_gcm::aead::{Aead};
        use argon2::{Argon2, PasswordHasher};
        use argon2::password_hash::{SaltString, PasswordHasher as _};
        use base64::{Engine as _, engine::general_purpose};

        let v: serde_json::Value = serde_json::from_str(encrypted_data).map_err(|e| format!("JSON error: {}", e))?;
        let s = v.get("s").and_then(|x| x.as_str()).ok_or("Missing salt")?;
        let n_b64 = v.get("n").and_then(|x| x.as_str()).ok_or("Missing nonce")?;
        let c_b64 = v.get("c").and_then(|x| x.as_str()).ok_or("Missing ciphertext")?;

        let salt = SaltString::from_b64(s).map_err(|e| format!("Salt error: {}", e))?;
        let argon2 = Argon2::default();
        // Derive same key
        let hash = argon2.hash_password(password.as_bytes(), &salt)
            .map_err(|e| format!("Argon2 error: {}", e))?;
        let key_bytes = blake3::hash(hash.hash.ok_or("Missing Argon2 hash")?.as_bytes()).as_bytes().clone();
        let key = Key::<Aes256Gcm>::from_slice(&key_bytes);
        let cipher = Aes256Gcm::new(key);

        let nonce_bytes = general_purpose::STANDARD.decode(n_b64).map_err(|e| format!("Nonce decode: {}", e))?;
        let nonce = Nonce::from_slice(&nonce_bytes);
        let ciphertext = general_purpose::STANDARD.decode(c_b64).map_err(|e| format!("Ciphertext decode: {}", e))?;
        let plaintext = cipher.decrypt(nonce, ciphertext.as_ref()).map_err(|e| format!("Decrypt error: {}", e))?;
        String::from_utf8(plaintext).map_err(|e| format!("UTF-8 error: {}", e))
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_password_validation() {
        assert!(PasswordValidator::validate_strength("Password123!").is_ok());
        assert!(PasswordValidator::validate_strength("weak").is_err());
        assert!(PasswordValidator::validate_strength("NoNumbers!").is_err());
    }

    #[test]
    fn test_password_strength_score() {
        assert_eq!(PasswordValidator::calculate_strength_score("Password123!"), 100);
        assert_eq!(PasswordValidator::calculate_strength_score("weak"), 0);
        assert_eq!(PasswordValidator::calculate_strength_score("Password"), 50);
    }

    #[test]
    fn test_security_manager() {
        let config = SecurityConfig::default();
        let manager = SecurityManager::new(config);
        
        // Test authentication
        let result = manager.authenticate("test_user", "fuego_password");
        assert!(result.is_ok());
        
        let session_id = result.unwrap();
        
        // Test session validation
        let user_id = manager.validate_session(&session_id);
        assert!(user_id.is_ok());
        assert_eq!(user_id.unwrap(), "test_user");
    }
}
