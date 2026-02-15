// Copyright (c) 2024 Fuego Private Banking Network
// Distributed under the MIT/X11 software license

//! Performance optimization module for Fuego Desktop Wallet

use std::collections::HashMap;
use std::sync::{Arc, Mutex};
use std::time::{Duration, Instant, SystemTime, UNIX_EPOCH};
use serde::{Deserialize, Serialize};

/// Performance metrics
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PerformanceMetrics {
    pub operation_name: String,
    pub duration_ms: u64,
    pub memory_usage_mb: f64,
    pub timestamp: u64,
    pub success: bool,
}

/// Performance configuration
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PerformanceConfig {
    pub enable_caching: bool,
    pub cache_ttl_seconds: u64,
    pub max_cache_size: usize,
    pub enable_metrics: bool,
    pub metrics_retention_days: u32,
    pub background_sync_interval_seconds: u64,
    pub batch_size: usize,
}

impl Default for PerformanceConfig {
    fn default() -> Self {
        Self {
            enable_caching: true,
            cache_ttl_seconds: 300, // 5 minutes
            max_cache_size: 1000,
            enable_metrics: true,
            metrics_retention_days: 7,
            background_sync_interval_seconds: 30,
            batch_size: 50,
        }
    }
}

/// Cache entry with TTL
#[derive(Debug, Clone)]
struct CacheEntry<T> {
    data: T,
    created_at: Instant,
    ttl: Duration,
}

impl<T> CacheEntry<T> {
    fn new(data: T, ttl: Duration) -> Self {
        Self {
            data,
            created_at: Instant::now(),
            ttl,
        }
    }
    
    fn is_expired(&self) -> bool {
        self.created_at.elapsed() > self.ttl
    }
}

/// High-performance cache with TTL support
#[derive(Debug)]
pub struct Cache<T> {
    data: Arc<Mutex<HashMap<String, CacheEntry<T>>>>,
    max_size: usize,
    default_ttl: Duration,
}

impl<T: Clone> Cache<T> {
    pub fn new(max_size: usize, default_ttl: Duration) -> Self {
        Self {
            data: Arc::new(Mutex::new(HashMap::new())),
            max_size,
            default_ttl,
        }
    }
    
    /// Get cached value
    pub fn get(&self, key: &str) -> Option<T> {
        let mut cache = self.data.lock().unwrap();
        
        if let Some(entry) = cache.get(key) {
            if entry.is_expired() {
                cache.remove(key);
                return None;
            }
            Some(entry.data.clone())
        } else {
            None
        }
    }
    
    /// Set cached value
    pub fn set(&self, key: String, value: T) {
        self.set_with_ttl(key, value, self.default_ttl);
    }
    
    /// Set cached value with custom TTL
    pub fn set_with_ttl(&self, key: String, value: T, ttl: Duration) {
        let mut cache = self.data.lock().unwrap();
        
        // Remove expired entries
        self.cleanup_expired(&mut cache);
        
        // Check size limit
        if cache.len() >= self.max_size {
            // Remove oldest entry
            if let Some(oldest_key) = cache.keys().next().cloned() {
                cache.remove(&oldest_key);
            }
        }
        
        cache.insert(key, CacheEntry::new(value, ttl));
    }
    
    /// Remove cached value
    pub fn remove(&self, key: &str) {
        let mut cache = self.data.lock().unwrap();
        cache.remove(key);
    }
    
    /// Clear all cached values
    pub fn clear(&self) {
        let mut cache = self.data.lock().unwrap();
        cache.clear();
    }
    
    /// Get cache statistics
    pub fn stats(&self) -> CacheStats {
        let cache = self.data.lock().unwrap();
        let total_entries = cache.len();
        let expired_entries = cache.values().filter(|entry| entry.is_expired()).count();
        
        CacheStats {
            total_entries,
            expired_entries,
            active_entries: total_entries - expired_entries,
            max_size: self.max_size,
        }
    }
    
    /// Cleanup expired entries
    fn cleanup_expired(&self, cache: &mut HashMap<String, CacheEntry<T>>) {
        cache.retain(|_, entry| !entry.is_expired());
    }
}

/// Cache statistics
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CacheStats {
    pub total_entries: usize,
    pub expired_entries: usize,
    pub active_entries: usize,
    pub max_size: usize,
}

/// Performance monitor for tracking operations
#[derive(Debug)]
pub struct PerformanceMonitor {
    metrics: Arc<Mutex<Vec<PerformanceMetrics>>>,
    config: PerformanceConfig,
}

impl PerformanceMonitor {
    pub fn new(config: PerformanceConfig) -> Self {
        Self {
            metrics: Arc::new(Mutex::new(Vec::new())),
            config,
        }
    }
    
    /// Start timing an operation
    pub fn start_timing(&self, operation_name: String) -> PerformanceTimer {
        PerformanceTimer {
            operation_name,
            start_time: Instant::now(),
            monitor: self.metrics.clone(),
            config: self.config.clone(),
        }
    }
    
    /// Get performance metrics
    pub fn get_metrics(&self, operation_name: Option<&str>) -> Vec<PerformanceMetrics> {
        let metrics = self.metrics.lock().unwrap();
        
        if let Some(name) = operation_name {
            metrics.iter()
                .filter(|m| m.operation_name == name)
                .cloned()
                .collect()
        } else {
            metrics.clone()
        }
    }
    
    /// Get average performance for operation
    pub fn get_average_performance(&self, operation_name: &str) -> Option<AveragePerformance> {
        let metrics = self.metrics.lock().unwrap();
        let operation_metrics: Vec<_> = metrics.iter()
            .filter(|m| m.operation_name == operation_name)
            .collect();
        
        if operation_metrics.is_empty() {
            return None;
        }
        
        let total_duration: u64 = operation_metrics.iter().map(|m| m.duration_ms).sum();
        let total_memory: f64 = operation_metrics.iter().map(|m| m.memory_usage_mb).sum();
        let success_count = operation_metrics.iter().filter(|m| m.success).count();
        
        Some(AveragePerformance {
            operation_name: operation_name.to_string(),
            average_duration_ms: total_duration / operation_metrics.len() as u64,
            average_memory_mb: total_memory / operation_metrics.len() as f64,
            success_rate: success_count as f64 / operation_metrics.len() as f64,
            total_calls: operation_metrics.len(),
        })
    }
    
    /// Cleanup old metrics
    pub fn cleanup_old_metrics(&self) {
        let cutoff_time = SystemTime::now()
            .duration_since(UNIX_EPOCH)
            .unwrap()
            .as_secs() - (self.config.metrics_retention_days as u64 * 24 * 60 * 60);
        
        let mut metrics = self.metrics.lock().unwrap();
        metrics.retain(|m| m.timestamp > cutoff_time);
    }
}

/// Performance timer for measuring operation duration
pub struct PerformanceTimer {
    operation_name: String,
    start_time: Instant,
    monitor: Arc<Mutex<Vec<PerformanceMetrics>>>,
    config: PerformanceConfig,
}

impl PerformanceTimer {
    /// Finish timing and record metrics
    pub fn finish(self, success: bool) {
        let duration = self.start_time.elapsed();
        let memory_usage = self.get_memory_usage();
        let operation_name = self.operation_name.clone();
        let config = self.config.clone();
        
        let metric = PerformanceMetrics {
            operation_name,
            duration_ms: duration.as_millis() as u64,
            memory_usage_mb: memory_usage,
            timestamp: SystemTime::now().duration_since(UNIX_EPOCH).unwrap().as_secs(),
            success,
        };
        
        let mut metrics = self.monitor.lock().unwrap();
        metrics.push(metric);
        
        // Cleanup old metrics if enabled
        if config.enable_metrics {
            Self::cleanup_if_needed(&mut metrics, &config);
        }
    }
    
    /// Get current memory usage (RSS in MB)
    fn get_memory_usage(&self) -> f64 {
        use sysinfo::{System, ProcessRefreshKind, RefreshKind, Pid};
        let mut sys = System::new();
        sys.refresh_specifics(RefreshKind::new().with_processes(ProcessRefreshKind::everything()));
        if let Some(proc) = sys.process(sysinfo::get_current_pid().unwrap_or(Pid::from(0))) {
            // memory() returns kB on Linux
            return (proc.memory() as f64) / 1024.0;
        }
        0.0
    }
    
    /// Cleanup old metrics if needed
    fn cleanup_if_needed(metrics: &mut Vec<PerformanceMetrics>, config: &PerformanceConfig) {
        let cutoff_time = SystemTime::now()
            .duration_since(UNIX_EPOCH)
            .unwrap()
            .as_secs() - (config.metrics_retention_days as u64 * 24 * 60 * 60);
        
        metrics.retain(|m| m.timestamp > cutoff_time);
    }
}

/// Average performance metrics
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AveragePerformance {
    pub operation_name: String,
    pub average_duration_ms: u64,
    pub average_memory_mb: f64,
    pub success_rate: f64,
    pub total_calls: usize,
}

/// Background task manager for performance optimization
#[derive(Debug)]
pub struct BackgroundTaskManager {
    tasks: Arc<Mutex<HashMap<String, BackgroundTask>>>,
}

#[derive(Debug, Clone)]
struct BackgroundTask {
    name: String,
    interval: Duration,
    last_run: Instant,
    enabled: bool,
}

impl BackgroundTaskManager {
    pub fn new() -> Self {
        Self {
            tasks: Arc::new(Mutex::new(HashMap::new())),
        }
    }
    
    /// Register a background task
    pub fn register_task(&self, name: String, interval: Duration) {
        let mut tasks = self.tasks.lock().unwrap();
        tasks.insert(name.clone(), BackgroundTask {
            name,
            interval,
            last_run: Instant::now(),
            enabled: true,
        });
    }
    
    /// Check if task should run
    pub fn should_run(&self, task_name: &str) -> bool {
        let tasks = self.tasks.lock().unwrap();
        
        if let Some(task) = tasks.get(task_name) {
            task.enabled && task.last_run.elapsed() >= task.interval
        } else {
            false
        }
    }
    
    /// Mark task as completed
    pub fn mark_completed(&self, task_name: &str) {
        let mut tasks = self.tasks.lock().unwrap();
        
        if let Some(task) = tasks.get_mut(task_name) {
            task.last_run = Instant::now();
        }
    }
    
    /// Enable/disable task
    pub fn set_task_enabled(&self, task_name: &str, enabled: bool) {
        let mut tasks = self.tasks.lock().unwrap();
        
        if let Some(task) = tasks.get_mut(task_name) {
            task.enabled = enabled;
        }
    }
    
    /// Get task status
    pub fn get_task_status(&self, task_name: &str) -> Option<TaskStatus> {
        let tasks = self.tasks.lock().unwrap();
        
        if let Some(task) = tasks.get(task_name) {
            Some(TaskStatus {
                name: task.name.clone(),
                enabled: task.enabled,
                last_run: task.last_run,
                next_run_in: task.interval.saturating_sub(task.last_run.elapsed()),
            })
        } else {
            None
        }
    }
}

/// Task status information
#[derive(Debug, Clone)]
pub struct TaskStatus {
    pub name: String,
    pub enabled: bool,
    pub last_run: Instant,
    pub next_run_in: Duration,
}

/// Batch processor for efficient data handling
pub struct BatchProcessor<T> {
    batch_size: usize,
    buffer: Arc<Mutex<Vec<T>>>,
}

impl<T> BatchProcessor<T> {
    pub fn new(batch_size: usize) -> Self {
        Self {
            batch_size,
            buffer: Arc::new(Mutex::new(Vec::new())),
        }
    }
    
    /// Add item to batch
    pub fn add_item(&self, item: T) -> Option<Vec<T>> {
        let mut buffer = self.buffer.lock().unwrap();
        buffer.push(item);
        
        if buffer.len() >= self.batch_size {
            Some(buffer.drain(..).collect())
        } else {
            None
        }
    }
    
    /// Get current batch
    pub fn get_batch(&self) -> Vec<T> {
        let mut buffer = self.buffer.lock().unwrap();
        buffer.drain(..).collect()
    }
    
    /// Check if batch is ready
    pub fn is_batch_ready(&self) -> bool {
        let buffer = self.buffer.lock().unwrap();
        buffer.len() >= self.batch_size
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::thread;
    use std::time::Duration;

    #[test]
    fn test_cache_basic_operations() {
        let cache = Cache::new(10, Duration::from_secs(1));
        
        // Test set and get
        cache.set("key1".to_string(), "value1".to_string());
        assert_eq!(cache.get("key1"), Some("value1".to_string()));
        
        // Test expiration
        thread::sleep(Duration::from_millis(1100));
        assert_eq!(cache.get("key1"), None);
    }
    
    #[test]
    fn test_performance_monitor() {
        let monitor = PerformanceMonitor::new(PerformanceConfig::default());
        
        let timer = monitor.start_timing("test_operation".to_string());
        thread::sleep(Duration::from_millis(100));
        timer.finish(true);
        
        let metrics = monitor.get_metrics(Some("test_operation"));
        assert_eq!(metrics.len(), 1);
        assert!(metrics[0].duration_ms >= 100);
        assert!(metrics[0].success);
    }
    
    #[test]
    fn test_batch_processor() {
        let processor = BatchProcessor::new(3);
        
        // Add items one by one
        assert_eq!(processor.add_item(1), None);
        assert_eq!(processor.add_item(2), None);
        assert_eq!(processor.add_item(3), Some(vec![1, 2, 3]));
        
        // Add more items
        assert_eq!(processor.add_item(4), None);
        assert_eq!(processor.add_item(5), None);
        assert_eq!(processor.add_item(6), Some(vec![4, 5, 6]));
    }
}
