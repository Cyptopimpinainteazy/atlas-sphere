//! Quarantine Manager for X3 GPU Validator Swarm
//!
//! Handles validator isolation on divergence, automatic fallback, and recovery.

use chrono::{DateTime, Utc};
use parking_lot::RwLock;
use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use uuid::Uuid;

/// Reasons for quarantine
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
pub enum QuarantineReason {
    /// GPU output diverged from CPU
    Divergence,
    /// Validator is unresponsive
    Unresponsive,
    /// Validator produced invalid results
    InvalidResults,
    /// Validator exceeded rate limits
    RateLimitExceeded,
    /// Manual quarantine
    Manual,
}

/// Record of a divergence event
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DivergenceRecord {
    /// Unique record ID
    pub record_id: String,
    /// Validator ID
    pub validator_id: String,
    /// Task ID
    pub task_id: String,
    /// GPU output hash
    pub gpu_output: Vec<u8>,
    /// CPU output hash
    pub cpu_output: Vec<u8>,
    /// Whether replay confirmed divergence
    pub replay_confirmed: bool,
    /// Timestamp
    pub timestamp: DateTime<Utc>,
    /// Additional details
    pub details: Option<String>,
}

impl DivergenceRecord {
    /// Create a new divergence record
    pub fn new(
        validator_id: String,
        task_id: String,
        gpu_output: Vec<u8>,
        cpu_output: Vec<u8>,
    ) -> Self {
        Self {
            record_id: Uuid::new_v4().to_string(),
            validator_id,
            task_id,
            gpu_output,
            cpu_output,
            replay_confirmed: false,
            timestamp: Utc::now(),
            details: None,
        }
    }

    /// Mark as replay confirmed
    pub fn mark_replay_confirmed(&mut self) {
        self.replay_confirmed = true;
    }

    /// Add details
    pub fn add_details(&mut self, details: String) {
        self.details = Some(details);
    }
}

/// Quarantine entry
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct QuarantineEntry {
    /// Validator ID
    pub validator_id: String,
    /// Reason for quarantine
    pub reason: QuarantineReason,
    /// When the quarantine started
    pub started_at: DateTime<Utc>,
    /// When the quarantine ends (None = permanent)
    pub ends_at: Option<DateTime<Utc>>,
    /// Number of divergence occurrences
    pub divergence_count: u32,
    /// Is the validator permanently banned
    pub permanent: bool,
    /// Recovery timestamp (when validator can rejoin)
    pub can_rejoin_at: Option<DateTime<Utc>>,
    /// Additional metadata
    pub metadata: HashMap<String, String>,
}

impl QuarantineEntry {
    /// Create a new quarantine entry
    pub fn new(validator_id: String, reason: QuarantineReason, duration_secs: u64) -> Self {
        let now = Utc::now();
        let ends_at = if duration_secs > 0 {
            Some(now + chrono::Duration::seconds(duration_secs as i64))
        } else {
            None
        };

        Self {
            validator_id,
            reason,
            started_at: now,
            ends_at,
            divergence_count: 1,
            permanent: duration_secs == 0,
            can_rejoin_at: ends_at,
            metadata: HashMap::new(),
        }
    }

    /// Check if quarantine has expired
    pub fn is_expired(&self) -> bool {
        if self.permanent {
            return false;
        }
        if let Some(ends_at) = self.ends_at {
            return Utc::now() > ends_at;
        }
        false
    }

    /// Increment divergence count
    pub fn increment_divergence(&mut self) {
        self.divergence_count += 1;
    }
}

/// Quarantine manager
pub struct QuarantineManager {
    /// Quarantined validators
    quarantined: RwLock<HashMap<String, QuarantineEntry>>,
    /// Divergence records
    divergence_records: RwLock<Vec<DivergenceRecord>>,
    /// Maximum divergence count before permanent ban
    max_divergence_count: u32,
    /// Quarantine duration in seconds
    quarantine_duration_secs: u64,
    /// Enable automatic CPU fallback
    auto_fallback_cpu: bool,
}

impl QuarantineManager {
    /// Create a new quarantine manager
    pub fn new(
        max_divergence_count: u32,
        quarantine_duration_secs: u64,
        auto_fallback_cpu: bool,
    ) -> Self {
        Self {
            quarantined: RwLock::new(HashMap::new()),
            divergence_records: RwLock::new(Vec::new()),
            max_divergence_count,
            quarantine_duration_secs,
            auto_fallback_cpu,
        }
    }

    /// Quarantine a validator
    pub fn quarantine(&self, validator_id: String, reason: QuarantineReason) -> bool {
        let mut quarantined = self.quarantined.write();

        if let Some(entry) = quarantined.get_mut(&validator_id) {
            // Already quarantined - increment count
            entry.increment_divergence();

            // Check if should be permanently banned
            if entry.divergence_count >= self.max_divergence_count {
                entry.permanent = true;
                entry.ends_at = None;
            }
            return true;
        }

        // New quarantine
        let entry =
            QuarantineEntry::new(validator_id.clone(), reason, self.quarantine_duration_secs);
        quarantined.insert(validator_id, entry);
        true
    }

    /// Release a validator from quarantine.
    ///
    /// Non-permanently quarantined validators can be released manually immediately.
    /// Permanently banned validators cannot be released through this API.
    pub fn release(&self, validator_id: &str) -> bool {
        let mut quarantined = self.quarantined.write();

        if let Some(entry) = quarantined.get(validator_id) {
            if entry.permanent {
                return false;
            }

            quarantined.remove(validator_id);
            return true;
        }

        false
    }

    /// Check if a validator is quarantined
    pub fn is_quarantined(&self, validator_id: &str) -> bool {
        let quarantined = self.quarantined.read();
        if let Some(entry) = quarantined.get(validator_id) {
            if entry.permanent {
                return true;
            }
            !entry.is_expired()
        } else {
            false
        }
    }

    /// Record a divergence event
    pub fn record_divergence(&self, record: DivergenceRecord) {
        let mut records = self.divergence_records.write();
        records.push(record);

        // Trim old records (keep last 1000)
        if records.len() > 1000 {
            records.drain(0..100);
        }
    }

    /// Get divergence records for a validator
    pub fn get_divergences(&self, validator_id: &str) -> Vec<DivergenceRecord> {
        let records = self.divergence_records.read();
        records
            .iter()
            .filter(|r| r.validator_id == validator_id)
            .cloned()
            .collect()
    }

    /// Get all quarantined validators
    pub fn get_quarantined(&self) -> Vec<QuarantineEntry> {
        let quarantined = self.quarantined.read();
        quarantined.values().cloned().collect()
    }

    /// Check if should auto-fallback to CPU
    pub fn should_auto_fallback(&self) -> bool {
        self.auto_fallback_cpu
    }

    /// Get quarantine status for a validator
    pub fn get_status(&self, validator_id: &str) -> Option<QuarantineStatus> {
        let quarantined = self.quarantined.read();
        quarantined.get(validator_id).map(|entry| QuarantineStatus {
            is_quarantined: !entry.is_expired() || entry.permanent,
            reason: entry.reason,
            divergence_count: entry.divergence_count,
            can_rejoin_at: entry.can_rejoin_at,
            permanent: entry.permanent,
        })
    }

    /// Get statistics
    pub fn get_stats(&self) -> QuarantineStats {
        let quarantined = self.quarantined.read();
        let records = self.divergence_records.read();

        let active = quarantined
            .values()
            .filter(|e| !e.is_expired() && !e.permanent)
            .count();
        let permanent = quarantined.values().filter(|e| e.permanent).count();

        QuarantineStats {
            total_quarantined: quarantined.len(),
            active_quarantines: active,
            permanent_bans: permanent,
            total_divergences: records.len(),
        }
    }
}

/// Quarantine status
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct QuarantineStatus {
    pub is_quarantined: bool,
    pub reason: QuarantineReason,
    pub divergence_count: u32,
    pub can_rejoin_at: Option<DateTime<Utc>>,
    pub permanent: bool,
}

/// Quarantine statistics
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct QuarantineStats {
    pub total_quarantined: usize,
    pub active_quarantines: usize,
    pub permanent_bans: usize,
    pub total_divergences: usize,
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_quarantine() {
        let manager = QuarantineManager::new(3, 60, true);

        assert!(!manager.is_quarantined("validator1"));

        manager.quarantine("validator1".to_string(), QuarantineReason::Divergence);

        assert!(manager.is_quarantined("validator1"));

        let status = manager.get_status("validator1").unwrap();
        assert_eq!(status.divergence_count, 1);
    }

    #[test]
    fn test_divergence_record() {
        let record = DivergenceRecord::new(
            "validator1".to_string(),
            "task1".to_string(),
            vec![1, 2, 3],
            vec![4, 5, 6],
        );

        assert_eq!(record.replay_confirmed, false);
    }

    #[test]
    fn test_quarantine_stats() {
        let manager = QuarantineManager::new(3, 60, true);

        manager.quarantine("v1".to_string(), QuarantineReason::Divergence);
        manager.quarantine("v2".to_string(), QuarantineReason::Unresponsive);

        let stats = manager.get_stats();
        assert_eq!(stats.total_quarantined, 2);
    }
}
