import {
  ResponseCache as IResponseCache,
  ChatCompletionResponse
} from '../types';

export class ResponseCache implements IResponseCache {
  private cache: Map<string, CacheEntry> = new Map();
  private maxSize: number;
  private defaultTTL: number;
  private strategy: 'memory' | 'redis' | 'file';

  constructor(
    maxSize: number = 1000,
    defaultTTL: number = 3600, // 1 hour
    strategy: 'memory' | 'redis' | 'file' = 'memory'
  ) {
    this.maxSize = maxSize;
    this.defaultTTL = defaultTTL;
    this.strategy = strategy;
  }

  async get(key: string): Promise<ChatCompletionResponse | null> {
    const entry = this.cache.get(key);

    if (!entry) {
      return null;
    }

    // Check if entry has expired
    if (this.isExpired(entry)) {
      this.cache.delete(key);
      return null;
    }

    // Update access statistics
    entry.access_count++;
    entry.last_accessed = new Date();

    return entry.response;
  }

  async set(key: string, response: ChatCompletionResponse, ttl?: number): Promise<void> {
    const expiry = new Date(Date.now() + (ttl || this.defaultTTL) * 1000);

    const entry: CacheEntry = {
      key,
      response,
      created_at: new Date(),
      expires_at: expiry,
      access_count: 0,
      last_accessed: new Date()
    };

    // If cache is full, remove least recently used items
    if (this.cache.size >= this.maxSize) {
      this.evictLRU();
    }

    this.cache.set(key, entry);
  }

  async delete(key: string): Promise<void> {
    this.cache.delete(key);
  }

  async clear(): Promise<void> {
    this.cache.clear();
  }

  async size(): Promise<number> {
    return this.cache.size;
  }

  async hitRate(): Promise<number> {
    const totalRequests = this.getTotalRequests();
    const totalHits = this.getTotalHits();

    return totalRequests > 0 ? (totalHits / totalRequests) * 100 : 0;
  }

  private isExpired(entry: CacheEntry): boolean {
    return new Date() > entry.expires_at;
  }

  private evictLRU(): void {
    let oldestKey: string | null = null;
    let oldestAccess: Date | null = null;

    for (const [key, entry] of this.cache) {
      if (!oldestAccess || entry.last_accessed < oldestAccess) {
        oldestAccess = entry.last_accessed;
        oldestKey = key;
      }
    }

    if (oldestKey) {
      this.cache.delete(oldestKey);
    }
  }

  private getTotalRequests(): number {
    let total = 0;
    for (const entry of this.cache.values()) {
      total += entry.access_count;
    }
    return total;
  }

  private getTotalHits(): number {
    let hits = 0;
    for (const entry of this.cache.values()) {
      hits += entry.access_count;
    }
    return hits;
  }

  // Get cache statistics
  async getStats(): Promise<CacheStats> {
    const entries = Array.from(this.cache.values());
    const now = new Date();

    const expiredEntries = entries.filter(entry => this.isExpired(entry)).length;
    const validEntries = entries.length - expiredEntries;

    const totalAccessCount = entries.reduce((sum, entry) => sum + entry.access_count, 0);
    const totalRequests = this.getTotalRequests();
    const hitRate = totalRequests > 0 ? (totalAccessCount / totalRequests) * 100 : 0;

    // Calculate average response time for cached responses
    const totalResponseTime = entries.reduce((sum, entry) => sum + entry.response.response_time, 0);
    const averageResponseTime = entries.length > 0 ? totalResponseTime / entries.length : 0;

    // Find most accessed entries
    const mostAccessed = entries
      .sort((a, b) => b.access_count - a.access_count)
      .slice(0, 10)
      .map(entry => ({
        key: entry.key,
        access_count: entry.access_count,
        provider: entry.response.provider,
        model: entry.response.model
      }));

    return {
      total_entries: entries.length,
      valid_entries: validEntries,
      expired_entries: expiredEntries,
      hit_rate: hitRate,
      average_response_time: averageResponseTime,
      most_accessed: mostAccessed,
      memory_usage: this.estimateMemoryUsage()
    };
  }

  private estimateMemoryUsage(): number {
    // Rough estimation of memory usage
    let totalSize = 0;

    for (const entry of this.cache.values()) {
      // Estimate size of response content
      totalSize += entry.response.content.length * 2; // UTF-16 characters
      totalSize += entry.response.model.length * 2;
      totalSize += JSON.stringify(entry.response.usage).length * 2;
      totalSize += 100; // Overhead for metadata
    }

    return totalSize;
  }

  // Clean up expired entries
  async cleanup(): Promise<number> {
    const initialSize = this.cache.size;
    const now = new Date();

    for (const [key, entry] of this.cache) {
      if (now > entry.expires_at) {
        this.cache.delete(key);
      }
    }

    const cleanedCount = initialSize - this.cache.size;
    return cleanedCount;
  }

  // Get entries by provider
  async getByProvider(provider: string): Promise<CacheEntry[]> {
    return Array.from(this.cache.values())
      .filter(entry => entry.response.provider === provider && !this.isExpired(entry));
  }

  // Get entries by model
  async getByModel(model: string): Promise<CacheEntry[]> {
    return Array.from(this.cache.values())
      .filter(entry => entry.response.model === model && !this.isExpired(entry));
  }

  // Batch operations
  async setMultiple(entries: Array<{ key: string; response: ChatCompletionResponse; ttl?: number }>): Promise<void> {
    for (const entry of entries) {
      await this.set(entry.key, entry.response, entry.ttl);
    }
  }

  async getMultiple(keys: string[]): Promise<Map<string, ChatCompletionResponse | null>> {
    const results = new Map<string, ChatCompletionResponse | null>();

    for (const key of keys) {
      results.set(key, await this.get(key));
    }

    return results;
  }

  // Advanced caching strategies

  // Get cache key for content similarity (semantic caching)
  generateSemanticKey(content: string, threshold: number = 0.8): string {
    // Simple hash-based approach - in production, use embeddings
    const hash = Buffer.from(content).toString('base64');
    return `semantic_${hash}`;
  }

  // Check for similar content in cache
  async findSimilar(content: string, threshold: number = 0.8): Promise<ChatCompletionResponse | null> {
    // Simple implementation - in production, use vector similarity
    const contentHash = this.generateSemanticKey(content);

    // Look for exact matches first
    const exactMatch = await this.get(contentHash);
    if (exactMatch) {
      return exactMatch;
    }

    // For now, return null - would implement semantic similarity in production
    return null;
  }

  // Warm up cache with common queries
  async warmUp(commonQueries: Array<{ key: string; response: ChatCompletionResponse; ttl?: number }>): Promise<void> {
    await this.setMultiple(commonQueries);
    console.log(`Cache warmed up with ${commonQueries.length} entries`);
  }

  // Export cache for backup
  async export(): Promise<CacheEntry[]> {
    return Array.from(this.cache.values())
      .filter(entry => !this.isExpired(entry));
  }

  // Import cache from backup
  async import(entries: CacheEntry[]): Promise<void> {
    for (const entry of entries) {
      if (!this.isExpired(entry)) {
        this.cache.set(entry.key, entry);
      }
    }
    console.log(`Imported ${entries.length} cache entries`);
  }

  // Get cache performance metrics
  async getPerformanceMetrics(): Promise<CachePerformanceMetrics> {
    const stats = await this.getStats();
    const now = new Date();

    // Calculate cache efficiency
    const efficiency = stats.hit_rate > 0 ? (stats.average_response_time / 100) * stats.hit_rate : 0;

    // Get recent activity (last hour)
    const oneHourAgo = new Date(now.getTime() - 60 * 60 * 1000);
    const recentEntries = Array.from(this.cache.values())
      .filter(entry => entry.created_at >= oneHourAgo);

    return {
      ...stats,
      efficiency,
      recent_activity: recentEntries.length,
      cache_strategy: this.strategy,
      memory_efficiency: this.calculateMemoryEfficiency()
    };
  }

  private calculateMemoryEfficiency(): number {
    const totalMemory = this.estimateMemoryUsage();
    const validEntries = Array.from(this.cache.values())
      .filter(entry => !this.isExpired(entry)).length;

    return validEntries > 0 ? totalMemory / validEntries : 0;
  }
}

// Internal types
interface CacheEntry {
  key: string;
  response: ChatCompletionResponse;
  created_at: Date;
  expires_at: Date;
  access_count: number;
  last_accessed: Date;
}

interface CacheStats {
  total_entries: number;
  valid_entries: number;
  expired_entries: number;
  hit_rate: number;
  average_response_time: number;
  most_accessed: Array<{
    key: string;
    access_count: number;
    provider: string;
    model: string;
  }>;
  memory_usage: number;
}

interface CachePerformanceMetrics extends CacheStats {
  efficiency: number;
  recent_activity: number;
  cache_strategy: 'memory' | 'redis' | 'file';
  memory_efficiency: number;
}