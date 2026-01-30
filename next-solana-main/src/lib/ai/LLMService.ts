import {
  LLMOrchestrator,
  HealthMonitor,
  TaskRouter,
  ResponseCache,
  LLMConfig,
  DeepSeekProvider,
  GroqProvider,
  OllamaProvider,
  HuggingFaceProvider,
  OrchestratorRequest,
  OrchestratorResponse,
  TaskType,
  SentimentAnalysisResult,
  LLMProviderType,
  MarketData,
  MarketAnalysis,
  ContentRequest,
  ContentResponse,
  AgentPersona
} from '../../../packages/agent-core/src/types';

export class LLMService {
  private orchestrator: LLMOrchestrator;
  private isInitialized = false;

  constructor() {
    // Initialize will be called separately to allow for async setup
  }

  async initialize(): Promise<void> {
    if (this.isInitialized) return;

    try {
      // Initialize configuration
      const config = new LLMConfig();

      // Validate configuration
      const validation = config.validate();
      if (!validation.valid) {
        throw new Error(`Invalid LLM configuration: ${validation.errors.join(', ')}`);
      }

      // Initialize providers
      const providers = await this.initializeProviders(config);

      // Initialize components
      const healthMonitor = new HealthMonitor(providers);
      const taskRouter = new TaskRouter(config);
      const cache = new ResponseCache(
        config.caching.max_size,
        config.caching.ttl,
        config.caching.strategy as 'memory' | 'redis' | 'file'
      );

      // Initialize orchestrator
      this.orchestrator = new LLMOrchestrator(
        providers,
        healthMonitor,
        taskRouter,
        cache,
        config
      );

      this.isInitialized = true;
      console.log('LLM Service initialized successfully');
    } catch (error) {
      console.error('Failed to initialize LLM Service:', error);
      throw error;
    }
  }

  private async initializeProviders(config: LLMConfig) {
    const providers = [];

    // Initialize DeepSeek provider
    if (config.isProviderEnabled('deepseek')) {
      const deepseekConfig = config.getProviderConfig('deepseek');
      const provider = new DeepSeekProvider(deepseekConfig?.api_key);
      if (provider.status !== 'unavailable') {
        providers.push(provider);
      }
    }

    // Initialize Groq provider
    if (config.isProviderEnabled('groq')) {
      const groqConfig = config.getProviderConfig('groq');
      const provider = new GroqProvider(groqConfig?.api_key);
      if (provider.status !== 'unavailable') {
        providers.push(provider);
      }
    }

    // Initialize Ollama provider
    if (config.isProviderEnabled('ollama')) {
      const ollamaConfig = config.getProviderConfig('ollama');
      const provider = new OllamaProvider(ollamaConfig?.base_url);
      if (provider.status !== 'unavailable') {
        providers.push(provider);
      }
    }

    // Initialize HuggingFace provider
    if (config.isProviderEnabled('huggingface')) {
      const hfConfig = config.getProviderConfig('huggingface');
      const provider = new HuggingFaceProvider(hfConfig?.api_key);
      if (provider.status !== 'unavailable') {
        providers.push(provider);
      }
    }

    if (providers.length === 0) {
      throw new Error('No LLM providers available. Please check your configuration.');
    }

    return providers;
  }

  // Main generation method
  async generateResponse(
    prompt: string,
    context?: string,
    options?: {
      temperature?: number;
      maxTokens?: number;
      model?: string;
      taskType?: TaskType;
      persona?: AgentPersona;
      priority?: 'low' | 'medium' | 'high';
      bypassCache?: boolean;
    }
  ): Promise<string> {
    await this.ensureInitialized();

    const request: OrchestratorRequest = {
      id: `req_${Date.now()}`,
      task_type: options?.taskType || TaskType.CONTENT_GENERATION,
      content: context ? `${context}\n\n${prompt}` : prompt,
      priority: options?.priority || 'medium',
      bypass_cache: options?.bypassCache || false,
      parameters: {
        temperature: options?.temperature,
        max_tokens: options?.maxTokens,
        model: options?.model
      },
      metadata: {
        persona: options?.persona
      }
    };

    const response = await this.orchestrator.processRequest(request);
    return response.content;
  }

  // Sentiment analysis
  async analyzeSentiment(text: string): Promise<{
    score: number;
    label: 'positive' | 'negative' | 'neutral';
    confidence: number;
  }> {
    await this.ensureInitialized();

    const request: OrchestratorRequest = {
      id: `req_${Date.now()}`,
      task_type: TaskType.SENTIMENT_ANALYSIS,
      content: text,
      priority: 'medium'
    };

    const response = await this.orchestrator.processRequest(request);

    try {
      const analysis = JSON.parse(response.content);
      return {
        score: Math.max(0, Math.min(1, analysis.score || 0.5)),
        label: analysis.label || 'neutral',
        confidence: Math.max(0, Math.min(1, analysis.confidence || 0.5))
      };
    } catch (error) {
      // Fallback if JSON parsing fails
      return {
        score: 0.5,
        label: 'neutral',
        confidence: 0.5
      };
    }
  }

  // Market analysis
  async analyzeMarket(data: MarketData): Promise<MarketAnalysis> {
    await this.ensureInitialized();

    const request: OrchestratorRequest = {
      id: `req_${Date.now()}`,
      task_type: TaskType.MARKET_ANALYSIS,
      content: JSON.stringify(data),
      priority: 'high'
    };

    const response = await this.orchestrator.processRequest(request);

    try {
      const analysis = JSON.parse(response.content);
      return {
        sentiment: analysis.sentiment || 'neutral',
        confidence: Math.max(0, Math.min(1, analysis.confidence || 0.5)),
        reasoning: analysis.reasoning || 'Analysis based on provided market data.',
        key_levels: {
          support: analysis.key_levels?.support || [],
          resistance: analysis.key_levels?.resistance || []
        },
        recommendation: analysis.recommendation || 'hold',
        risk_level: analysis.risk_level || 'medium'
      };
    } catch (error) {
      return {
        sentiment: 'neutral',
        confidence: 0.5,
        reasoning: response.content,
        key_levels: { support: [], resistance: [] },
        recommendation: 'hold',
        risk_level: 'medium'
      };
    }
  }

  // Content generation
  async generateContent(request: ContentRequest): Promise<ContentResponse> {
    await this.ensureInitialized();

    const requestContent = `
Generate ${request.type} content:
Topic: ${request.topic}
Length: ${request.length}
Audience: ${request.audience}
Context: ${request.context || 'None'}
Persona: ${request.persona ? JSON.stringify(request.persona) : 'Default'}
    `.trim();

    const orchestratorRequest: OrchestratorRequest = {
      id: `req_${Date.now()}`,
      task_type: TaskType.CONTENT_GENERATION,
      content: requestContent,
      priority: 'medium'
    };

    const response = await this.orchestrator.processRequest(orchestratorRequest);

    return {
      content: response.content,
      hashtags: [], // Could be extracted from content
      mentions: [], // Could be extracted from content
      created_at: new Date()
    };
  }

  // Batch processing
  async generateBatchResponses(
    prompts: string[],
    options?: {
      taskType?: TaskType;
      priority?: 'low' | 'medium' | 'high';
    }
  ): Promise<string[]> {
    await this.ensureInitialized();

    const requests: OrchestratorRequest[] = prompts.map((prompt, index) => ({
      id: `req_${Date.now()}_${index}`,
      task_type: options?.taskType || TaskType.CONTENT_GENERATION,
      content: prompt,
      priority: options?.priority || 'medium'
    }));

    const responses = await this.orchestrator.processBatch(requests);
    return responses.map(response => response.content);
  }

  // Provider health and status
  async getProviderHealth(): Promise<Map<LLMProviderType, any>> {
    await this.ensureInitialized();
    return await this.orchestrator.getProviderHealth();
  }

  async getSystemMetrics(): Promise<any> {
    await this.ensureInitialized();
    return await this.orchestrator.getMetrics();
  }

  // Configuration management
  getConfig(): LLMConfig {
    return this.orchestrator.config;
  }

  updateConfig(newConfig: Partial<LLMConfig>): void {
    this.orchestrator.updateConfig(newConfig);
  }

  // Cache management
  async clearCache(): Promise<void> {
    await this.orchestrator.cache.clear();
  }

  async getCacheStats(): Promise<any> {
    return await this.orchestrator.cache.getStats();
  }

  // Utility methods
  private async ensureInitialized(): Promise<void> {
    if (!this.isInitialized) {
      await this.initialize();
    }
  }

  isReady(): boolean {
    return this.isInitialized;
  }

  // Legacy method compatibility
  async generateMemeContent(
    tokenAddress: string,
    priceData: any,
    socialMetrics: any
  ): Promise<string> {
    const prompt = `
Generate viral meme content for token ${tokenAddress}:
Price: ${JSON.stringify(priceData)}
Social Metrics: ${JSON.stringify(socialMetrics)}

Create engaging, humorous content that crypto enthusiasts will love to share.
    `;

    return await this.generateResponse(prompt, undefined, {
      taskType: TaskType.CONTENT_GENERATION,
      temperature: 0.9
    });
  }

  // Advanced features
  async analyzeTradingSignal(
    signalData: {
      token: string;
      action: 'buy' | 'sell' | 'hold';
      confidence: number;
      reasoning: string;
    }
  ): Promise<{
    validated: boolean;
    adjusted_confidence?: number;
    additional_insights?: string;
  }> {
    const prompt = `
Analyze this trading signal:
${JSON.stringify(signalData, null, 2)}

Validate the signal and provide additional insights. Return JSON with:
- validated: boolean
- adjusted_confidence: number (0-1)
- additional_insights: string
    `;

    const response = await this.generateResponse(prompt, undefined, {
      taskType: TaskType.TRADING_DECISION,
      temperature: 0.2
    });

    try {
      return JSON.parse(response);
    } catch {
      return {
        validated: true,
        adjusted_confidence: signalData.confidence,
        additional_insights: response
      };
    }
  }

  // Real-time streaming (placeholder for future implementation)
  async generateStreamingResponse(
    prompt: string,
    onChunk: (chunk: string) => void,
    options?: {
      taskType?: TaskType;
      model?: string;
    }
  ): Promise<void> {
    // For now, return complete response
    // In production, implement streaming with WebSockets or SSE
    const response = await this.generateResponse(prompt, undefined, options);
    onChunk(response);
  }
}

// Singleton instance for global use
let llmServiceInstance: LLMService | null = null;

export const getLLMService = (): LLMService => {
  if (!llmServiceInstance) {
    llmServiceInstance = new LLMService();
  }
  return llmServiceInstance;
};

// Initialize service when module is loaded
const llmService = getLLMService();
llmService.initialize().catch(console.error);