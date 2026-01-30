import {
  HealthMonitor as IHealthMonitor,
  LLMProvider,
  ProviderHealth,
  ProviderMetrics,
  LLMProviderType
} from '../types';

export class HealthMonitor implements IHealthMonitor {
  private providerMetrics: Map<LLMProviderType, ProviderMetricsData> = new Map();
  private circuitBreakers: Map<LLMProviderType, CircuitBreaker> = new Map();
  private healthCheckInterval: NodeJS.Timeout | null = null;
  private readonly maxHistorySize = 1000;

  constructor(
    providers: LLMProvider[],
    checkInterval: number = 30000 // 30 seconds
  ) {
    // Initialize metrics for all providers
    providers.forEach(provider => {
      this.providerMetrics.set(provider.name, {
        provider: provider.name,
        requests: [],
        health_checks: [],
        errors: [],
        response_times: []
      });

      // Initialize circuit breaker
      this.circuitBreakers.set(provider.name, {
        state: 'closed',
        failure_count: 0,
        last_failure_time: null,
        success_count: 0
      });
    });

    this.startPeriodicHealthChecks(checkInterval);
  }

  async checkProviderHealth(provider: LLMProvider): Promise<ProviderHealth> {
    const startTime = Date.now();
    const providerType = provider.name;

    try {
      // Perform health check
      const health = await provider.healthCheck();
      const responseTime = Date.now() - startTime;

      // Update metrics
      this.recordMetrics(providerType, responseTime, true);

      // Update circuit breaker on success
      this.updateCircuitBreaker(providerType, true);

      // Store health check result
      const metrics = this.providerMetrics.get(providerType);
      if (metrics) {
        metrics.health_checks.push({
          timestamp: new Date(),
          status: 'healthy',
          response_time: responseTime
        });
      }

      return {
        ...health,
        last_check: new Date(),
        availability_score: this.calculateAvailabilityScore(providerType),
        total_requests: this.getTotalRequests(providerType),
        successful_requests: this.getSuccessfulRequests(providerType),
        average_response_time: this.getAverageResponseTime(providerType)
      };
    } catch (error) {
      const responseTime = Date.now() - startTime;

      // Update metrics for failed health check
      this.recordMetrics(providerType, responseTime, false);

      // Update circuit breaker on failure
      this.updateCircuitBreaker(providerType, false);

      // Store failed health check result
      const metrics = this.providerMetrics.get(providerType);
      if (metrics) {
        metrics.health_checks.push({
          timestamp: new Date(),
          status: 'unavailable',
          response_time: responseTime,
          error: error instanceof Error ? error.message : 'Unknown error'
        });
      }

      return {
        provider: providerType,
        status: 'unavailable',
        response_time: responseTime,
        error_rate: 1.0,
        last_check: new Date(),
        availability_score: 0,
        total_requests: this.getTotalRequests(providerType),
        successful_requests: this.getSuccessfulRequests(providerType),
        average_response_time: this.getAverageResponseTime(providerType)
      };
    }
  }

  async getAllProviderHealth(): Promise<Map<LLMProviderType, ProviderHealth>> {
    const healthMap = new Map<LLMProviderType, ProviderHealth>();

    for (const [providerType, metrics] of this.providerMetrics) {
      const provider = this.getProviderByType(providerType);
      if (provider) {
        const health = await this.checkProviderHealth(provider);
        healthMap.set(providerType, health);
      }
    }

    return healthMap;
  }

  recordMetrics(provider: LLMProviderType, responseTime: number, success: boolean): void {
    const metrics = this.providerMetrics.get(provider);
    if (!metrics) return;

    const record = {
      timestamp: new Date(),
      response_time: responseTime,
      success
    };

    // Add to requests history
    metrics.requests.push(record);

    // Add to response times
    metrics.response_times.push(responseTime);

    // Add to errors if failed
    if (!success) {
      metrics.errors.push({
        timestamp: new Date(),
        error: `Request failed with response time: ${responseTime}ms`
      });
    }

    // Keep history size manageable
    if (metrics.requests.length > this.maxHistorySize) {
      metrics.requests = metrics.requests.slice(-this.maxHistorySize);
    }
    if (metrics.response_times.length > this.maxHistorySize) {
      metrics.response_times = metrics.response_times.slice(-this.maxHistorySize);
    }
    if (metrics.errors.length > this.maxHistorySize) {
      metrics.errors = metrics.errors.slice(-this.maxHistorySize);
    }
  }

  async getMetrics(timeRange?: number): Promise<ProviderMetrics[]> {
    const cutoffTime = timeRange ? new Date(Date.now() - timeRange) : new Date(0);
    const metrics: ProviderMetrics[] = [];

    for (const [providerType, data] of this.providerMetrics) {
      const recentRequests = data.requests.filter(r => r.timestamp >= cutoffTime);

      if (recentRequests.length === 0) continue;

      const successfulRequests = recentRequests.filter(r => r.success);
      const totalResponseTime = recentRequests.reduce((sum, r) => sum + r.response_time, 0);
      const averageResponseTime = totalResponseTime / recentRequests.length;

      metrics.push({
        provider: providerType,
        time_range: timeRange || 0,
        total_requests: recentRequests.length,
        successful_requests: successfulRequests.length,
        failed_requests: recentRequests.length - successfulRequests.length,
        average_response_time: averageResponseTime,
        error_rate: (recentRequests.length - successfulRequests.length) / recentRequests.length,
        cost: 0, // Would be calculated from usage data
        quota_usage: 0 // Would be populated from provider-specific data
      });
    }

    return metrics;
  }

  enableCircuitBreaker(provider: LLMProviderType): void {
    const breaker = this.circuitBreakers.get(provider);
    if (breaker && breaker.state === 'open') {
      breaker.state = 'half-open';
      console.log(`Circuit breaker for ${provider} changed to half-open`);
    }
  }

  disableCircuitBreaker(provider: LLMProviderType): void {
    const breaker = this.circuitBreakers.get(provider);
    if (breaker) {
      breaker.state = 'closed';
      breaker.failure_count = 0;
      breaker.last_failure_time = null;
      console.log(`Circuit breaker for ${provider} disabled (closed)`);
    }
  }

  isCircuitBreakerEnabled(provider: LLMProviderType): boolean {
    const breaker = this.circuitBreakers.get(provider);
    return breaker?.state === 'open';
  }

  private updateCircuitBreaker(provider: LLMProviderType, success: boolean): void {
    const breaker = this.circuitBreakers.get(provider);
    if (!breaker) return;

    if (success) {
      breaker.success_count++;
      breaker.failure_count = 0;
      breaker.last_failure_time = null;

      // Close circuit breaker if it was half-open
      if (breaker.state === 'half-open') {
        breaker.state = 'closed';
        console.log(`Circuit breaker for ${provider} closed after successful request`);
      }
    } else {
      breaker.failure_count++;
      breaker.last_failure_time = new Date();

      // Open circuit breaker if failure threshold reached
      if (breaker.failure_count >= 5 && breaker.state === 'closed') {
        breaker.state = 'open';
        console.warn(`Circuit breaker for ${provider} opened after ${breaker.failure_count} failures`);
      }
    }
  }

  private calculateAvailabilityScore(provider: LLMProviderType): number {
    const metrics = this.providerMetrics.get(provider);
    if (!metrics || metrics.health_checks.length === 0) return 0;

    const recentChecks = metrics.health_checks.slice(-10); // Last 10 checks
    const successfulChecks = recentChecks.filter(check => check.status === 'healthy').length;

    return successfulChecks / recentChecks.length;
  }

  private getTotalRequests(provider: LLMProviderType): number {
    const metrics = this.providerMetrics.get(provider);
    return metrics?.requests.length || 0;
  }

  private getSuccessfulRequests(provider: LLMProviderType): number {
    const metrics = this.providerMetrics.get(provider);
    return metrics?.requests.filter(r => r.success).length || 0;
  }

  private getAverageResponseTime(provider: LLMProviderType): number {
    const metrics = this.providerMetrics.get(provider);
    if (!metrics || metrics.response_times.length === 0) return 0;

    const sum = metrics.response_times.reduce((acc, time) => acc + time, 0);
    return sum / metrics.response_times.length;
  }

  private getProviderByType(providerType: LLMProviderType): LLMProvider | null {
    // This would need to be implemented with access to the provider instances
    // For now, return null - this should be handled by the orchestrator
    return null;
  }

  private startPeriodicHealthChecks(interval: number): void {
    if (this.healthCheckInterval) {
      clearInterval(this.healthCheckInterval);
    }

    this.healthCheckInterval = setInterval(async () => {
      for (const [providerType] of this.providerMetrics) {
        const provider = this.getProviderByType(providerType);
        if (provider) {
          await this.checkProviderHealth(provider);
        }
      }
    }, interval);
  }

  // Get circuit breaker status for all providers
  getCircuitBreakerStatus(): Map<LLMProviderType, 'open' | 'closed' | 'half-open'> {
    const status = new Map<LLMProviderType, 'open' | 'closed' | 'half-open'>();
    for (const [providerType, breaker] of this.circuitBreakers) {
      status.set(providerType, breaker.state);
    }
    return status;
  }

  // Reset metrics for a provider
  resetMetrics(provider: LLMProviderType): void {
    this.providerMetrics.set(provider, {
      provider,
      requests: [],
      health_checks: [],
      errors: [],
      response_times: []
    });
    console.log(`Metrics reset for provider: ${provider}`);
  }

  // Get detailed error analysis
  getErrorAnalysis(provider: LLMProviderType, timeRange?: number): {
    total_errors: number;
    error_rate: number;
    common_errors: Array<{ error: string; count: number }>;
    recent_errors: Array<{ timestamp: Date; error: string }>;
  } {
    const metrics = this.providerMetrics.get(provider);
    if (!metrics) {
      return {
        total_errors: 0,
        error_rate: 0,
        common_errors: [],
        recent_errors: []
      };
    }

    const cutoffTime = timeRange ? new Date(Date.now() - timeRange) : new Date(0);
    const recentErrors = metrics.errors.filter(e => e.timestamp >= cutoffTime);

    // Count error types
    const errorCounts = new Map<string, number>();
    recentErrors.forEach(error => {
      const count = errorCounts.get(error.error) || 0;
      errorCounts.set(error.error, count + 1);
    });

    const commonErrors = Array.from(errorCounts.entries())
      .map(([error, count]) => ({ error, count }))
      .sort((a, b) => b.count - a.count);

    return {
      total_errors: recentErrors.length,
      error_rate: metrics.requests.length > 0
        ? recentErrors.length / metrics.requests.filter(r => r.timestamp >= cutoffTime).length
        : 0,
      common_errors: commonErrors,
      recent_errors: recentErrors.slice(-10) // Last 10 errors
    };
  }

  // Cleanup old metrics
  cleanupOldMetrics(maxAge: number = 24 * 60 * 60 * 1000): void { // 24 hours default
    const cutoffTime = new Date(Date.now() - maxAge);

    for (const [providerType, metrics] of this.providerMetrics) {
      metrics.requests = metrics.requests.filter(r => r.timestamp >= cutoffTime);
      metrics.health_checks = metrics.health_checks.filter(h => h.timestamp >= cutoffTime);
      metrics.errors = metrics.errors.filter(e => e.timestamp >= cutoffTime);
      metrics.response_times = metrics.response_times.filter((_, index) => {
        const requestIndex = Math.floor(index / metrics.requests.length * metrics.requests.length);
        return requestIndex < metrics.requests.length && metrics.requests[requestIndex].timestamp >= cutoffTime;
      });
    }

    console.log('Old metrics cleaned up');
  }

  // Stop periodic health checks
  stopHealthMonitoring(): void {
    if (this.healthCheckInterval) {
      clearInterval(this.healthCheckInterval);
      this.healthCheckInterval = null;
      console.log('Health monitoring stopped');
    }
  }
}

// Internal types for tracking metrics
interface ProviderMetricsData {
  provider: LLMProviderType;
  requests: Array<{
    timestamp: Date;
    response_time: number;
    success: boolean;
  }>;
  health_checks: Array<{
    timestamp: Date;
    status: 'healthy' | 'unavailable';
    response_time: number;
    error?: string;
  }>;
  errors: Array<{
    timestamp: Date;
    error: string;
  }>;
  response_times: number[];
}

interface CircuitBreaker {
  state: 'closed' | 'open' | 'half-open';
  failure_count: number;
  success_count: number;
  last_failure_time: Date | null;
}