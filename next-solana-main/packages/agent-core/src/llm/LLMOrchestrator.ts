import { EventEmitter } from 'events';
import {
  LLMProvider,
  LLMProviderType,
  LLMRequest,
  LLMResponse,
  MarketData,
  MarketAnalysis,
  ContentRequest,
  ContentResponse,
  AgentPersona
} from '../types';
import { DeepSeekProvider } from './providers/DeepSeekProvider';
import { GroqProvider } from './providers/GroqProvider';
import { OllamaProvider } from './providers/OllamaProvider';
import { HuggingFaceProvider } from './providers/HuggingFaceProvider';

/**
 * Multi-model LLM orchestration system with automatic failover and health checking
 */
export class LLMOrchestrator extends EventEmitter {
  private providers: Map<LLMProviderType, LLMProvider> = new Map();
  private healthCheckInterval: NodeJS.Timeout | null = null;
  private readonly healthCheckIntervalMs = 300000; // 5 minutes to reduce cost
  private readonly maxRetries = 3;
  private readonly retryDelayMs = 1000; // 1 second base delay

  constructor() {
    super();
    this.initializeProviders();
    this.startHealthChecks();
  }

  /**
   * Initialize all LLM providers
   */
  private initializeProviders(): void {
    this.providers.set('deepseek', new DeepSeekProvider());
    this.providers.set('groq', new GroqProvider());
    this.providers.set('ollama', new OllamaProvider());
    this.providers.set('huggingface', new HuggingFaceProvider());

    this.emit('providers_initialized', Array.from(this.providers.keys()));
  }

  /**
   * Start periodic health checks for all providers
   */
  private startHealthChecks(): void {
    this.healthCheckInterval = setInterval(async () => {
      await this.checkAllProvidersHealth();
    }, this.healthCheckIntervalMs);
  }

  /**
   * Check health of all providers
   */
  private async checkAllProvidersHealth(): Promise<void> {
    const healthResults = new Map<LLMProviderType, boolean>();

    for (const [providerName, provider] of this.providers) {
      try {
        const isHealthy = await this.checkProviderHealth(provider);
        healthResults.set(providerName, isHealthy);
        provider.status = isHealthy ? 'healthy' : 'unavailable';
        provider.last_health_check = new Date();
      } catch (error) {
        console.warn(`Health check failed for ${providerName}:`, error);
        provider.status = 'unavailable';
        healthResults.set(providerName, false);
      }
    }

    this.emit('health_check_complete', healthResults);
  }

  /**
   * Check individual provider health
   */
  private async checkProviderHealth(provider: LLMProvider): Promise<boolean> {
    try {
      // Simple health check with minimal prompt
      const testRequest: LLMRequest = {
        prompt: 'Hello',
        temperature: 0.1,
        max_tokens: 10
      };

      const response = await provider.generateResponse(testRequest);
      return response.content.length > 0;
    } catch (error) {
      return false;
    }
  }

  /**
   * Generate response using primary provider with fallback
   */
  async generateResponse(
    request: LLMRequest,
    persona?: AgentPersona
  ): Promise<LLMResponse> {
    const providerOrder = this.getProviderOrder(persona?.model?.primary, request.prompt, persona);
    let lastError: Error | null = null;

    for (const providerName of providerOrder) {
      const provider = this.providers.get(providerName);
      if (!provider || provider.status === 'unavailable') {
        continue;
      }

      try {
        // Respect rate limits
        await this.waitForRateLimit(provider);

        const enrichedRequest = this.enrichRequestWithPersona(request, persona);
        const response = await provider.generateResponse(enrichedRequest);

        this.emit('request_successful', {
          provider: providerName,
          usage: response.usage
        });

        return response;
      } catch (error) {
        console.warn(`${providerName} failed:`, error);
        lastError = error as Error;
        provider.status = 'degraded';

        // Exponential backoff before trying next provider
        await this.delay(this.retryDelayMs);
      }
    }

    throw new Error(`All LLM providers failed. Last error: ${lastError?.message}`);
  }

  /**
   * Analyze market data using best available provider
   */
  async analyzeMarket(
    data: MarketData,
    persona?: AgentPersona
  ): Promise<MarketAnalysis> {
    const providers = ['deepseek', 'groq', 'ollama'] as LLMProviderType[]; // Ordered by preference

    for (const providerName of providers) {
      const provider = this.providers.get(providerName);
      if (!provider || provider.status !== 'healthy') {
        continue;
      }

      try {
        await this.waitForRateLimit(provider);
        return await provider.analyzeMarket(data);
      } catch (error) {
        console.warn(`${providerName} market analysis failed:`, error);
        provider.status = 'degraded';
      }
    }

    throw new Error('All LLM providers failed for market analysis');
  }

  /**
   * Generate content using optimized provider
   */
  async generateContent(
    request: ContentRequest,
    persona?: AgentPersona
  ): Promise<ContentResponse> {
    const providers = this.selectProvidersForContent(request.type);

    for (const providerName of providers) {
      const provider = this.providers.get(providerName);
      if (!provider || provider.status !== 'healthy') {
        continue;
      }

      try {
        await this.waitForRateLimit(provider);
        const enrichedRequest = this.enrichContentRequest(request, persona);
        return await provider.generateContent(enrichedRequest);
      } catch (error) {
        console.warn(`${providerName} content generation failed:`, error);
        provider.status = 'degraded';
      }
    }

    throw new Error('All LLM providers failed for content generation');
  }

  /**
   * Get preferred provider order based on task and persona
   */
  private getProviderOrder(
    primaryProvider?: LLMProviderType,
    prompt?: string,
    persona?: AgentPersona
  ): LLMProviderType[] {
    // Use persona-based provider ordering if available
    if (persona?.model?.primary) {
      const primary = persona.model.primary;
      const fallback = persona.model.fallback.length > 0 ? persona.model.fallback : this.getFallbackProviders(primary);
      return [primary, ...fallback];
    }

    if (primaryProvider) {
      return [primaryProvider, ...this.getFallbackProviders(primaryProvider)];
    }

    const isCodeTask = prompt?.includes('code') || prompt?.includes('function') || prompt?.includes('script');
    const isAnalysisTask = prompt?.includes('analyze') || prompt?.includes('market') || prompt?.includes('data');

    // Auto-select based on task type
    if (isCodeTask) {
      return ['deepseek', 'groq', 'ollama', 'huggingface'];
    }
    if (isAnalysisTask) {
      return ['deepseek', 'groq', 'huggingface', 'ollama'];
    }

    // Default preference order
    return ['groq', 'deepseek', 'ollama', 'huggingface'];
  }

  /**
   * Get fallback providers for a given primary provider
   */
  private getFallbackProviders(primaryProvider: LLMProviderType): LLMProviderType[] {
    const fallbackMap: Record<LLMProviderType, LLMProviderType[]> = {
      deepseek: ['groq', 'ollama', 'huggingface'],
      groq: ['deepseek', 'ollama', 'huggingface'],
      ollama: ['groq', 'deepseek', 'huggingface'],
      huggingface: ['groq', 'deepseek', 'ollama']
    };

    return fallbackMap[primaryProvider] || ['groq', 'deepseek', 'ollama'];
  }

  /**
   * Select providers optimized for content type
   */
  private selectProvidersForContent(contentType: ContentRequest['type']): LLMProviderType[] {
    switch (contentType) {
      case 'tweet':
        return ['groq', 'deepseek', 'huggingface', 'ollama']; // Groq for speed
      case 'analysis':
        return ['deepseek', 'groq', 'ollama', 'huggingface']; // DeepSeek for depth
      case 'education':
        return ['deepseek', 'groq', 'ollama', 'huggingface'];
      default:
        return ['groq', 'deepseek', 'ollama', 'huggingface'];
    }
  }

  /**
   * Enrich request with persona-specific context
   */
  private enrichRequestWithPersona(request: LLMRequest, persona?: AgentPersona): LLMRequest {
    if (!persona) return request;

    const systemPrompt = this.generateSystemPromptFromPersona(persona);

    return {
      ...request,
      context: `${systemPrompt}\n\n${request.context || ''}`,
      temperature: persona.model.temperature,
      max_tokens: Math.min(request.max_tokens || 1000, persona.model.max_tokens)
    };
  }

  /**
   * Enrich content request with persona context
   */
  private enrichContentRequest(request: ContentRequest, persona?: AgentPersona): ContentRequest {
    if (!persona) return request;

    return {
      ...request,
      persona
    };
  }

  /**
   * Generate system prompt from persona
   */
  private generateSystemPromptFromPersona(persona: AgentPersona): string {
    return `You are ${persona.name}, ${persona.description}.

Your personality traits:
- Tone: ${persona.personality.tone}
- Communication style: ${persona.personality.communication_style}
- Expertise in: ${persona.personality.expertise.join(', ')}
- Emoji usage: ${persona.personality.emoji_usage}

${persona.trading.enabled ?
  `Trading preferences:
- Risk tolerance: ${persona.trading.risk_tolerance}
- Strategy: ${persona.trading.strategy}
- Max position size: ${persona.trading.max_position_size}%` :
  'You are not configured for trading operations.'}

Capabilities: ${persona.capabilities.join(', ')}

Always respond in character and stay within your defined capabilities.`;
  }

  /**
   * Wait for rate limit if necessary
   */
  private async waitForRateLimit(provider: LLMProvider): Promise<void> {
    // Basic rate limiting - could be enhanced with token bucket algorithm
    const delay = 60000 / provider.rate_limits.requests_per_minute; // ms between requests
    await this.delay(delay);
  }

  /**
   * Utility delay function
   */
  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Get current provider statuses
   */
  getProviderStatuses(): Record<LLMProviderType, { status: string; last_check: Date }> {
    const statuses = {} as Record<LLMProviderType, { status: string; last_check: Date }>;

    for (const [name, provider] of this.providers) {
      statuses[name] = {
        status: provider.status,
        last_check: provider.last_health_check
      };
    }

    return statuses;
  }

  /**
   * Cleanup resources
   */
  destroy(): void {
    if (this.healthCheckInterval) {
      clearInterval(this.healthCheckInterval);
      this.healthCheckInterval = null;
    }
    this.removeAllListeners();
  }
}
