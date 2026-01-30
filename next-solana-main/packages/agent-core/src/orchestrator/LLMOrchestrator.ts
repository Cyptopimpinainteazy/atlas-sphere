import {
  LLMOrchestrator as ILLMOrchestrator,
  LLMProvider,
  OrchestratorRequest,
  OrchestratorResponse,
  LLMProviderType,
  TaskType,
  ProviderHealth,
  OrchestratorMetrics,
  ChatCompletionRequest,
  ChatCompletionResponse,
  SentimentAnalysisResult,
  LLMConfig,
  HealthMonitor,
  TaskRouter,
  ResponseCache
} from '../types';

export class LLMOrchestrator implements ILLMOrchestrator {
  public providers: Map<LLMProviderType, LLMProvider> = new Map();
  public healthMonitor: HealthMonitor;
  public taskRouter: TaskRouter;
  public cache: ResponseCache;
  public config: LLMConfig;

  private requestIdCounter = 0;
  private metrics = {
    total_requests: 0,
    successful_requests: 0,
    failed_requests: 0,
    cache_hits: 0,
    cache_misses: 0
  };

  constructor(
    providers: LLMProvider[],
    healthMonitor: HealthMonitor,
    taskRouter: TaskRouter,
    cache: ResponseCache,
    config: LLMConfig
  ) {
    this.healthMonitor = healthMonitor;
    this.taskRouter = taskRouter;
    this.cache = cache;
    this.config = config;

    // Register all providers
    providers.forEach(provider => {
      this.addProvider(provider);
    });

    // Start periodic health monitoring
    this.startHealthMonitoring();
  }

  async processRequest(request: OrchestratorRequest): Promise<OrchestratorResponse> {
    const startTime = Date.now();
    this.metrics.total_requests++;

    try {
      // Generate unique request ID
      const requestId = `req_${Date.now()}_${this.requestIdCounter++}`;

      // Check cache first if not bypassed
      if (!request.bypass_cache && this.config.caching.enabled) {
        const cacheKey = this.generateCacheKey(request);
        const cachedResponse = await this.cache.get(cacheKey);

        if (cachedResponse) {
          this.metrics.cache_hits++;
          return {
            id: `resp_${requestId}`,
            request_id: requestId,
            content: cachedResponse.content,
            provider: cachedResponse.provider,
            model: cachedResponse.model,
            usage: cachedResponse.usage,
            response_time: Date.now() - startTime,
            cached: true,
            cost: this.calculateCost(cachedResponse.provider, cachedResponse.usage.total_tokens)
          };
        }
        this.metrics.cache_misses++;
      }

      // Route to appropriate provider
      const selectedProviderType = await this.taskRouter.routeTask(request);

      if (!this.providers.has(selectedProviderType)) {
        throw new Error(`No provider available for type: ${selectedProviderType}`);
      }

      const provider = this.providers.get(selectedProviderType)!;

      // Execute request with fallback logic
      const response = await this.executeWithFallback(request, provider);

      // Cache successful responses
      if (this.config.caching.enabled && response.content) {
        const cacheKey = this.generateCacheKey(request);
        await this.cache.set(cacheKey, {
          content: response.content,
          usage: response.usage,
          model: response.model,
          provider: response.provider,
          finish_reason: 'stop',
          response_time: response.response_time,
          cached: false
        });
      }

      // Record metrics
      this.healthMonitor.recordMetrics(selectedProviderType, response.response_time, true);
      this.metrics.successful_requests++;

      return {
        id: `resp_${requestId}`,
        request_id: requestId,
        content: response.content,
        provider: response.provider,
        model: response.model,
        usage: response.usage,
        response_time: response.response_time,
        cached: false,
        cost: this.calculateCost(response.provider, response.usage.total_tokens),
        metadata: {
          original_provider: selectedProviderType,
          fallback_used: response.metadata?.fallback_used || false
        }
      };

    } catch (error) {
      const responseTime = Date.now() - startTime;
      this.metrics.failed_requests++;

      return {
        id: `resp_${Date.now()}_${this.requestIdCounter++}`,
        request_id: request.id,
        content: '',
        provider: 'unknown' as LLMProviderType,
        model: 'unknown',
        usage: { prompt_tokens: 0, completion_tokens: 0, total_tokens: 0 },
        response_time: responseTime,
        cached: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  private async executeWithFallback(
    request: OrchestratorRequest,
    primaryProvider: LLMProvider
  ): Promise<ChatCompletionResponse & { metadata?: any }> {
    const providerType = primaryProvider.name;
    let lastError: Error | null = null;

    // Try primary provider first
    try {
      const response = await this.executeProviderRequest(request, primaryProvider);
      return { ...response, metadata: { fallback_used: false } };
    } catch (error) {
      lastError = error instanceof Error ? error : new Error('Unknown error');
      console.warn(`Primary provider ${providerType} failed:`, lastError.message);
    }

    // Try fallback providers if configured
    const fallbackProviders = this.taskRouter.getProviderRecommendations(request.task_type)
      .filter(type => type !== providerType);

    for (const fallbackType of fallbackProviders) {
      if (!this.providers.has(fallbackType)) continue;

      const fallbackProvider = this.providers.get(fallbackType)!;

      try {
        const response = await this.executeProviderRequest(request, fallbackProvider);
        console.info(`Successfully used fallback provider ${fallbackType} for task ${request.task_type}`);
        return {
          ...response,
          metadata: {
            fallback_used: true,
            original_provider: providerType
          }
        };
      } catch (error) {
        lastError = error instanceof Error ? error : new Error('Unknown error');
        console.warn(`Fallback provider ${fallbackType} also failed:`, lastError.message);
      }
    }

    // All providers failed
    throw lastError || new Error('All providers failed to process request');
  }

  private async executeProviderRequest(
    request: OrchestratorRequest,
    provider: LLMProvider
  ): Promise<ChatCompletionResponse> {
    const chatRequest: ChatCompletionRequest = {
      messages: [{ role: 'user', content: request.content }],
      temperature: request.parameters?.temperature || 0.7,
      max_tokens: request.parameters?.max_tokens || 2048,
      task_type: request.task_type,
      priority: request.priority
    };

    // Route to appropriate method based on task type
    switch (request.task_type) {
      case TaskType.SENTIMENT_ANALYSIS:
        const sentimentResult = await provider.analyzeSentiment(request.content);
        return {
          content: JSON.stringify({
            score: sentimentResult.score,
            label: sentimentResult.label,
            confidence: sentimentResult.confidence
          }),
          usage: { prompt_tokens: 0, completion_tokens: 0, total_tokens: 0 },
          model: sentimentResult.model,
          provider: sentimentResult.provider,
          finish_reason: 'stop',
          response_time: sentimentResult.processing_time
        };

      case TaskType.TECHNICAL_ANALYSIS:
      case TaskType.MARKET_ANALYSIS:
      case TaskType.TRADING_DECISION:
        return await provider.chatCompletion(chatRequest);

      case TaskType.CONTENT_GENERATION:
        return await provider.chatCompletion(chatRequest);

      default:
        return await provider.chatCompletion(chatRequest);
    }
  }

  async getProviderHealth(): Promise<Map<LLMProviderType, ProviderHealth>> {
    return await this.healthMonitor.getAllProviderHealth();
  }

  async getMetrics(): Promise<OrchestratorMetrics> {
    const providerMetrics = await this.healthMonitor.getMetrics();
    const cacheHitRate = this.metrics.total_requests > 0
      ? (this.metrics.cache_hits / this.metrics.total_requests) * 100
      : 0;

    return {
      total_requests: this.metrics.total_requests,
      successful_requests: this.metrics.successful_requests,
      failed_requests: this.metrics.failed_requests,
      cache_hit_rate: cacheHitRate,
      average_response_time: 0, // Would be calculated from provider metrics
      provider_usage: new Map(), // Would be populated from health monitor
      cost_breakdown: new Map(), // Would be calculated from usage
      error_breakdown: new Map() // Would be populated from errors
    };
  }

  addProvider(provider: LLMProvider): void {
    this.providers.set(provider.name, provider);
    console.log(`Added provider: ${provider.name}`);
  }

  removeProvider(providerType: LLMProviderType): void {
    this.providers.delete(providerType);
    console.log(`Removed provider: ${providerType}`);
  }

  private generateCacheKey(request: OrchestratorRequest): string {
    // Create a hash of the request content and parameters for caching
    const contentHash = Buffer.from(request.content).toString('base64').slice(0, 16);
    const taskHash = Buffer.from(request.task_type).toString('base64').slice(0, 8);
    return `llm_${taskHash}_${contentHash}`;
  }

  private calculateCost(providerType: LLMProviderType, tokens: number): number {
    // Cost calculation would depend on provider pricing
    // This is a simplified example
    const costPerToken: Record<LLMProviderType, number> = {
      deepseek: 0.0001 / 1000, // $0.0001 per 1K tokens
      groq: 0.0000 / 1000,     // Free tier
      ollama: 0.0000 / 1000,   // Local, no cost
      huggingface: 0.0000 / 1000 // Free tier
    };

    return tokens * (costPerToken[providerType] || 0);
  }

  private startHealthMonitoring(): void {
    // Check provider health every 30 seconds
    setInterval(async () => {
      for (const [providerType, provider] of this.providers) {
        try {
          const health = await this.healthMonitor.checkProviderHealth(provider);

          // Update provider status based on health check
          if (health.status !== 'healthy') {
            console.warn(`Provider ${providerType} health check failed: ${health.status}`);
          }
        } catch (error) {
          console.error(`Failed to check health for provider ${providerType}:`, error);
        }
      }
    }, 30000);
  }

  // Batch processing for multiple requests
  async processBatch(requests: OrchestratorRequest[]): Promise<OrchestratorResponse[]> {
    const promises = requests.map(request => this.processRequest(request));
    return Promise.all(promises);
  }

  // Get optimal provider for a specific task
  getOptimalProvider(taskType: TaskType): LLMProvider | null {
    const recommendations = this.taskRouter.getProviderRecommendations(taskType);
    const availableProviders = recommendations.filter(type => {
      const provider = this.providers.get(type);
      return provider && provider.status === 'healthy';
    });

    return availableProviders.length > 0
      ? this.providers.get(availableProviders[0]) || null
      : null;
  }

  // Update configuration
  updateConfig(newConfig: Partial<LLMConfig>): void {
    this.config = { ...this.config, ...newConfig };
    console.log('LLM Orchestrator configuration updated');
  }

  // Get system status
  getSystemStatus(): {
    total_providers: number;
    healthy_providers: number;
    total_requests: number;
    success_rate: number;
    cache_enabled: boolean;
  } {
    const healthyProviders = Array.from(this.providers.values())
      .filter(p => p.status === 'healthy').length;

    const successRate = this.metrics.total_requests > 0
      ? (this.metrics.successful_requests / this.metrics.total_requests) * 100
      : 0;

    return {
      total_providers: this.providers.size,
      healthy_providers: healthyProviders,
      total_requests: this.metrics.total_requests,
      success_rate: successRate,
      cache_enabled: this.config.caching.enabled
    };
  }
}