// Copyright (c) 2024 Fuego Private Banking Network
// Distributed under the MIT/X11 software license

//! Performance optimization module
//! 
//! This module provides advanced performance optimization features including
//! memory management, CPU optimization, and resource monitoring.

use std::collections::HashMap;
use std::sync::{Arc, Mutex};
use std::time::{Duration, Instant};
use std::thread;
use std::sync::atomic::{AtomicU64, AtomicUsize, Ordering};

/// Performance metrics for monitoring
#[derive(Debug, Clone, serde::Serialize, serde::Deserialize)]
pub struct PerformanceMetrics {
    pub cpu_usage: f64,
    pub memory_usage: u64,
    pub memory_peak: u64,
    pub operation_count: u64,
    pub average_operation_time: Duration,
    pub cache_hit_rate: f64,
    pub network_latency: Duration,
    pub disk_io_operations: u64,
    pub disk_io_bytes: u64,
}

/// Memory optimization settings
#[derive(Debug, Clone)]
pub struct MemoryOptimization {
    pub max_cache_size: usize,
    pub cache_cleanup_interval: Duration,
    pub memory_threshold: u64,
    pub gc_interval: Duration,
    pub compression_enabled: bool,
    pub lazy_loading: bool,
}

/// CPU optimization settings
#[derive(Debug, Clone)]
pub struct CPUOptimization {
    pub max_threads: usize,
    pub thread_pool_size: usize,
    pub background_processing: bool,
    pub async_operations: bool,
    pub batch_processing: bool,
    pub priority_level: ThreadPriority,
}

#[derive(Debug, Clone)]
pub enum ThreadPriority {
    Low,
    Normal,
    High,
    Critical,
}

/// Resource monitor for tracking system resources
#[derive(Debug)]
pub struct ResourceMonitor {
    metrics: Arc<Mutex<PerformanceMetrics>>,
    memory_optimization: MemoryOptimization,
    cpu_optimization: CPUOptimization,
    operation_times: Arc<Mutex<HashMap<String, Vec<Duration>>>>,
    cache_stats: Arc<Mutex<CacheStats>>,
    is_monitoring: Arc<AtomicUsize>,
}

#[derive(Debug)]
pub struct CacheStats {
    pub hits: AtomicU64,
    pub misses: AtomicU64,
    pub size: AtomicUsize,
    pub max_size: usize,
}

impl CacheStats {
    fn new(max_size: usize) -> Self {
        Self {
            hits: AtomicU64::new(0),
            misses: AtomicU64::new(0),
            size: AtomicUsize::new(0),
            max_size,
        }
    }
    
    pub fn hit_rate(&self) -> f64 {
        let hits = self.hits.load(Ordering::Relaxed);
        let misses = self.misses.load(Ordering::Relaxed);
        let total = hits + misses;
        if total == 0 {
            0.0
        } else {
            hits as f64 / total as f64
        }
    }
}

impl ResourceMonitor {
    /// Create a new resource monitor
    pub fn new(memory_opt: MemoryOptimization, cpu_opt: CPUOptimization) -> Self {
        Self {
            metrics: Arc::new(Mutex::new(PerformanceMetrics {
                cpu_usage: 0.0,
                memory_usage: 0,
                memory_peak: 0,
                operation_count: 0,
                average_operation_time: Duration::from_millis(0),
                cache_hit_rate: 0.0,
                network_latency: Duration::from_millis(0),
                disk_io_operations: 0,
                disk_io_bytes: 0,
            })),
            memory_optimization: memory_opt.clone(),
            cpu_optimization: cpu_opt,
            operation_times: Arc::new(Mutex::new(HashMap::new())),
            cache_stats: Arc::new(Mutex::new(CacheStats::new(memory_opt.max_cache_size))),
            is_monitoring: Arc::new(AtomicUsize::new(0)),
        }
    }
    
    /// Start monitoring system resources
    pub fn start_monitoring(&self) {
        if self.is_monitoring.compare_exchange(0, 1, Ordering::Relaxed, Ordering::Relaxed).is_ok() {
            let metrics = Arc::clone(&self.metrics);
            let operation_times = Arc::clone(&self.operation_times);
            let cache_stats = Arc::clone(&self.cache_stats);
            let is_monitoring = Arc::clone(&self.is_monitoring);
            
            thread::spawn(move || {
                while is_monitoring.load(Ordering::Relaxed) == 1 {
                    Self::update_metrics(&metrics, &operation_times, &cache_stats);
                    thread::sleep(Duration::from_secs(1));
                }
            });
        }
    }
    
    /// Stop monitoring system resources
    pub fn stop_monitoring(&self) {
        self.is_monitoring.store(0, Ordering::Relaxed);
    }
    
    /// Record operation timing
    pub fn record_operation(&self, operation: &str, duration: Duration) {
        if let Ok(mut times) = self.operation_times.lock() {
            times.entry(operation.to_string()).or_insert_with(Vec::new).push(duration);
            
            // Keep only last 1000 operations for each type
            if let Some(op_times) = times.get_mut(operation) {
                if op_times.len() > 1000 {
                    op_times.drain(0..op_times.len() - 1000);
                }
            }
        }
    }
    
    /// Get current performance metrics
    pub fn get_metrics(&self) -> PerformanceMetrics {
        self.metrics.lock().unwrap().clone()
    }
    
    /// Optimize memory usage
    pub fn optimize_memory(&self) {
        // Force garbage collection
        self.force_garbage_collection();
        
        // Clean up old operation times
        if let Ok(mut times) = self.operation_times.lock() {
            times.retain(|_, v| v.len() > 0);
        }
        
        log::info!("Memory optimization completed");
    }
    
    /// Force garbage collection
    fn force_garbage_collection(&self) {
        // In a real implementation, this would trigger Rust's garbage collector
        // For now, we'll just log the action
        log::debug!("Forcing garbage collection");
    }
    
    /// Update performance metrics
    fn update_metrics(
        metrics: &Arc<Mutex<PerformanceMetrics>>,
        operation_times: &Arc<Mutex<HashMap<String, Vec<Duration>>>>,
        cache_stats: &Arc<Mutex<CacheStats>>,
    ) {
        if let Ok(mut m) = metrics.lock() {
            // Update CPU usage (simplified)
            m.cpu_usage = Self::get_cpu_usage();
            
            // Update memory usage
            m.memory_usage = Self::get_memory_usage();
            if m.memory_usage > m.memory_peak {
                m.memory_peak = m.memory_usage;
            }
            
            // Update operation metrics
            if let Ok(times) = operation_times.lock() {
                m.operation_count = times.values().map(|v| v.len() as u64).sum();
                
                let total_duration: Duration = times.values()
                    .flat_map(|v| v.iter())
                    .sum();
                let total_operations = times.values().map(|v| v.len()).sum::<usize>();
                
                if total_operations > 0 {
                    m.average_operation_time = total_duration / total_operations as u32;
                }
            }
            
            // Update cache metrics
            if let Ok(stats) = cache_stats.lock() {
                m.cache_hit_rate = stats.hit_rate();
            }
            
            // Update network latency (simplified)
            m.network_latency = Self::measure_network_latency();
        }
    }
    
    /// Get current CPU usage (simplified implementation)
    fn get_cpu_usage() -> f64 {
        use sysinfo::System;
        let mut sys = System::new();
        sys.refresh_cpu();
        // global_cpu_info().cpu_usage() returns 0..100
        sys.global_cpu_info().cpu_usage() as f64
    }
    
    /// Get current memory usage
    fn get_memory_usage() -> u64 {
        use sysinfo::System;
        let mut sys = System::new();
        sys.refresh_memory();
        // used memory in bytes (approx)
        (sys.used_memory() as u64) * 1024
    }
    
    /// Measure network latency
    fn measure_network_latency() -> Duration {
        use std::net::{TcpStream, ToSocketAddrs};
        let addr = ("fuego.spaceportx.net", 18180)
            .to_socket_addrs()
            .ok()
            .and_then(|mut it| it.next());
        if let Some(sockaddr) = addr {
            let start = std::time::Instant::now();
            let result = TcpStream::connect_timeout(&sockaddr, Duration::from_millis(1000));
            if result.is_ok() {
                return start.elapsed();
            }
        }
        Duration::from_millis(0)
    }
}

/// Advanced caching system with LRU eviction
#[derive(Debug)]
pub struct AdvancedCache<K, V> {
    data: Arc<Mutex<HashMap<K, CacheEntry<V>>>>,
    max_size: usize,
    stats: Arc<Mutex<CacheStats>>,
}

#[derive(Debug, Clone)]
struct CacheEntry<V> {
    value: V,
    last_accessed: Instant,
    access_count: u64,
}

impl<K, V> AdvancedCache<K, V>
where
    K: std::hash::Hash + Eq + Clone + Send + Sync + 'static,
    V: Clone + Send + Sync + 'static,
{
    /// Create a new advanced cache
    pub fn new(max_size: usize) -> Self {
        Self {
            data: Arc::new(Mutex::new(HashMap::new())),
            max_size,
            stats: Arc::new(Mutex::new(CacheStats::new(max_size))),
        }
    }
    
    /// Get a value from the cache
    pub fn get(&self, key: &K) -> Option<V> {
        if let Ok(mut data) = self.data.lock() {
            if let Some(entry) = data.get_mut(key) {
                entry.last_accessed = Instant::now();
                entry.access_count += 1;
                
                if let Ok(stats) = self.stats.lock() {
                    stats.hits.fetch_add(1, Ordering::Relaxed);
                }
                
                return Some(entry.value.clone());
            }
        }
        
        if let Ok(stats) = self.stats.lock() {
            stats.misses.fetch_add(1, Ordering::Relaxed);
        }
        
        None
    }
    
    /// Insert a value into the cache
    pub fn insert(&self, key: K, value: V) {
        if let Ok(mut data) = self.data.lock() {
            // Check if we need to evict entries
            if data.len() >= self.max_size {
                self.evict_lru(&mut data);
            }
            
            let entry = CacheEntry {
                value,
                last_accessed: Instant::now(),
                access_count: 1,
            };
            
            data.insert(key, entry);
            
            if let Ok(stats) = self.stats.lock() {
                stats.size.store(data.len(), Ordering::Relaxed);
            }
        }
    }
    
    /// Evict least recently used entries
    fn evict_lru(&self, data: &mut HashMap<K, CacheEntry<V>>) {
        if data.is_empty() {
            return;
        }
        
        // Find the least recently used entry
        let lru_key = data.iter()
            .min_by_key(|(_, entry)| entry.last_accessed)
            .map(|(key, _)| key.clone());
        
        if let Some(key) = lru_key {
            data.remove(&key);
        }
    }
    
    /// Clear the cache
    pub fn clear(&self) {
        if let Ok(mut data) = self.data.lock() {
            data.clear();
            
            if let Ok(stats) = self.stats.lock() {
                stats.size.store(0, Ordering::Relaxed);
            }
        }
    }
    
    /// Get cache statistics
    pub fn stats(&self) -> CacheStats {
        let stats = self.stats.lock().unwrap();
        CacheStats {
            hits: AtomicU64::new(stats.hits.load(Ordering::Relaxed)),
            misses: AtomicU64::new(stats.misses.load(Ordering::Relaxed)),
            size: AtomicUsize::new(stats.size.load(Ordering::Relaxed)),
            max_size: stats.max_size,
        }
    }
}

/// Thread pool for background processing
#[derive(Debug)]
pub struct ThreadPool {
    workers: Vec<thread::JoinHandle<()>>,
    sender: std::sync::mpsc::Sender<Box<dyn FnOnce() + Send + 'static>>,
}

impl ThreadPool {
    /// Create a new thread pool
    pub fn new(size: usize) -> Self {
        let (sender, receiver) = std::sync::mpsc::channel::<Box<dyn FnOnce() + Send + 'static>>();
        let receiver = Arc::new(Mutex::new(receiver));
        
        let mut workers = Vec::with_capacity(size);
        
        for _ in 0..size {
            let receiver = Arc::clone(&receiver);
            let worker = thread::spawn(move || {
                while let Ok(job) = receiver.lock().unwrap().recv() {
                    job();
                }
            });
            workers.push(worker);
        }
        
        Self { workers, sender }
    }
    
    /// Execute a job in the thread pool
    pub fn execute<F>(&self, f: F)
    where
        F: FnOnce() + Send + 'static,
    {
        self.sender.send(Box::new(f)).unwrap();
    }
}

/// Performance profiler for operation timing
#[derive(Debug)]
pub struct PerformanceProfiler {
    timers: Arc<Mutex<HashMap<String, Instant>>>,
    results: Arc<Mutex<HashMap<String, Duration>>>,
}

impl PerformanceProfiler {
    /// Create a new performance profiler
    pub fn new() -> Self {
        Self {
            timers: Arc::new(Mutex::new(HashMap::new())),
            results: Arc::new(Mutex::new(HashMap::new())),
        }
    }
    
    /// Start timing an operation
    pub fn start_timer(&self, operation: &str) {
        if let Ok(mut timers) = self.timers.lock() {
            timers.insert(operation.to_string(), Instant::now());
        }
    }
    
    /// End timing an operation
    pub fn end_timer(&self, operation: &str) -> Option<Duration> {
        if let Ok(mut timers) = self.timers.lock() {
            if let Some(start_time) = timers.remove(operation) {
                let duration = start_time.elapsed();
                
                if let Ok(mut results) = self.results.lock() {
                    results.insert(operation.to_string(), duration);
                }
                
                return Some(duration);
            }
        }
        None
    }
    
    /// Get timing results
    pub fn get_results(&self) -> HashMap<String, Duration> {
        self.results.lock().unwrap().clone()
    }
    
    /// Clear all timing data
    pub fn clear(&self) {
        if let Ok(mut timers) = self.timers.lock() {
            timers.clear();
        }
        if let Ok(mut results) = self.results.lock() {
            results.clear();
        }
    }
}

/// Memory pool for efficient allocation
pub struct MemoryPool<T> {
    pool: Arc<Mutex<Vec<T>>>,
    max_size: usize,
}

impl<T> MemoryPool<T> {
    /// Create a new memory pool
    pub fn new(max_size: usize) -> Self {
        Self {
            pool: Arc::new(Mutex::new(Vec::with_capacity(max_size))),
            max_size,
        }
    }
    
    /// Get an item from the pool
    pub fn get(&self) -> Option<T> {
        if let Ok(mut pool) = self.pool.lock() {
            pool.pop()
        } else {
            None
        }
    }
    
    /// Return an item to the pool
    pub fn return_item(&self, item: T) {
        if let Ok(mut pool) = self.pool.lock() {
            if pool.len() < self.max_size {
                pool.push(item);
            }
        }
    }
    
    /// Get pool size
    pub fn size(&self) -> usize {
        self.pool.lock().unwrap().len()
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    
    #[test]
    fn test_cache_operations() {
        let cache = AdvancedCache::new(10);
        
        cache.insert("key1", "value1");
        assert_eq!(cache.get(&"key1"), Some("value1"));
        assert_eq!(cache.get(&"key2"), None);
    }
    
    #[test]
    fn test_performance_profiler() {
        let profiler = PerformanceProfiler::new();
        
        profiler.start_timer("test_operation");
        std::thread::sleep(Duration::from_millis(10));
        let duration = profiler.end_timer("test_operation");
        
        assert!(duration.is_some());
        assert!(duration.unwrap() >= Duration::from_millis(10));
    }
    
    #[test]
    fn test_memory_pool() {
        let pool = MemoryPool::new(5);
        
        pool.return_item("test_item");
        assert_eq!(pool.size(), 1);
        
        let item = pool.get();
        assert_eq!(item, Some("test_item"));
        assert_eq!(pool.size(), 0);
    }
}
