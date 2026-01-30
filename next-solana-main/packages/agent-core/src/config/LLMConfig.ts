import {
  LLMConfig as ILLMConfig,
  ProviderConfig,
  LLMProviderType,
  TaskType
} from '../types';

export class LLMConfig implements ILLMConfig {
  public providers: {
    [K in LLMProviderType]?: ProviderConfig;
  } = {};

  public routing: {
    primary_providers: Map<TaskType, LLMProviderType[]>;
    fallback_providers: Map<TaskType, LLMProviderType[]>;
    load_balancing: 'round_robin' | 'least_connections' | 'weighted_response_time';
    circuit_breaker_threshold: number;
    retry_attempts: number;
    retry_delay: number;
  };

  public caching: {
    enabled: boolean;
    ttl: number;
    max_size: number;
    strategy: 'memory' | 'redis' | 'file';
  };

  public cost_optimization: {
    enabled: boolean;
    budget_limit?: number;
    provider_priority: LLMProviderType[];
  };

  constructor(config?: Partial<ILLMConfig>) {
    // Initialize with defaults
    this.routing = {
      primary_providers: new Map([
        [TaskType.TECHNICAL_ANALYSIS, ['deepseek', 'groq']],
        [TaskType.TRADING_DECISION, ['groq', 'deepseek']],
        [TaskType.SENTIMENT_ANALYSIS, ['huggingface', 'groq']],
        [TaskType.CONTENT_GENERATION, ['groq', 'deepseek']],
        [TaskType.MARKET_ANALYSIS, ['groq', 'deepseek']],
        [TaskType.CODE_GENERATION, ['deepseek', 'groq']],
        [TaskType.PRIVACY_SENSITIVE, ['ollama', 'deepseek']]
      ]),
      fallback_providers: new Map([
        [TaskType.TECHNICAL_ANALYSIS, ['groq', 'ollama']],
        [TaskType.TRADING_DECISION, ['deepseek', 'huggingface']],
        [TaskType.SENTIMENT_ANALYSIS, ['groq', 'deepseek']],
        [TaskType.CONTENT_GENERATION, ['deepseek', 'huggingface', 'ollama']],
        [TaskType.MARKET_ANALYSIS, ['deepseek', 'huggingface']],
        [TaskType.CODE_GENERATION, ['groq', 'ollama']],
        [TaskType.PRIVACY_SENSITIVE, ['deepseek', 'groq']]
      ]),
      load_balancing: 'weighted_response_time',
      circuit_breaker_threshold: 5,
      retry_attempts: 3,
      retry_delay: 1000
    };

    this.caching = {
      enabled: true,
      ttl: 3600, // 1 hour
      max_size: 1000,
      strategy: 'memory'
    };

    this.cost_optimization = {
      enabled: false,
      budget_limit: undefined,
      provider_priority: ['ollama', 'huggingface', 'groq', 'deepseek'] // Free to most expensive
    };

    // Initialize provider configs with defaults
    this.initializeProviderDefaults();

    // Apply user config
    if (config) {
      this.applyConfig(config);
    }

    // Load from environment variables
    this.loadFromEnvironment();
  }

  private initializeProviderDefaults(): void {
    // DeepSeek defaults
    this.providers.deepseek = {
      enabled: true,
      models: ['deepseek-coder', 'deepseek-chat'],
      rate_limits: {
        requests_per_minute: 60,
        tokens_per_minute: 100000
      },
      retry_policy: {
        max_retries: 3,
        backoff_multiplier: 2,
        initial_delay: 1000
      },
      timeout: 30000
    };

    // Groq defaults
    this.providers.groq = {
      enabled: true,
      models: ['mixtral-8x7b-32768', 'llama2-70b-4096'],
      rate_limits: {
        requests_per_minute: 100,
        tokens_per_minute: 200000
      },
      retry_policy: {
        max_retries: 2,
        backoff_multiplier: 1.5,
        initial_delay: 500
      },
      timeout: 15000
    };

    // Ollama defaults
    this.providers.ollama = {
      enabled: true,
      base_url: 'http://localhost:11434',
      models: ['llama2', 'codellama', 'mistral'],
      rate_limits: {
        requests_per_minute: 30,
        tokens_per_minute: 50000
      },
      retry_policy: {
        max_retries: 2,
        backoff_multiplier: 1.5,
        initial_delay: 1000
      },
      timeout: 60000
    };

    // HuggingFace defaults
    this.providers.huggingface = {
      enabled: true,
      models: [
        'cardiffnlp/twitter-roberta-base-sentiment-latest',
        'microsoft/DialoGPT-medium',
        'gpt2'
      ],
      rate_limits: {
        requests_per_minute: 100,
        tokens_per_minute: 150000
      },
      retry_policy: {
        max_retries: 3,
        backoff_multiplier: 2,
        initial_delay: 1000
      },
      timeout: 30000
    };
  }

  private applyConfig(config: Partial<ILLMConfig>): void {
    // Apply provider configs
    if (config.providers) {
      for (const [providerType, providerConfig] of Object.entries(config.providers)) {
        if (providerConfig) {
          this.providers[providerType as LLMProviderType] = {
            ...this.providers[providerType as LLMProviderType],
            ...providerConfig
          };
        }
      }
    }

    // Apply routing config
    if (config.routing) {
      if (config.routing.primary_providers) {
        this.routing.primary_providers = new Map(config.routing.primary_providers);
      }
      if (config.routing.fallback_providers) {
        this.routing.fallback_providers = new Map(config.routing.fallback_providers);
      }
      if (config.routing.load_balancing) {
        this.routing.load_balancing = config.routing.load_balancing;
      }
      if (config.routing.circuit_breaker_threshold !== undefined) {
        this.routing.circuit_breaker_threshold = config.routing.circuit_breaker_threshold;
      }
      if (config.routing.retry_attempts !== undefined) {
        this.routing.retry_attempts = config.routing.retry_attempts;
      }
      if (config.routing.retry_delay !== undefined) {
        this.routing.retry_delay = config.routing.retry_delay;
      }
    }

    // Apply caching config
    if (config.caching) {
      this.caching = { ...this.caching, ...config.caching };
    }

    // Apply cost optimization config
    if (config.cost_optimization) {
      this.cost_optimization = { ...this.cost_optimization, ...config.cost_optimization };
    }
  }

  private loadFromEnvironment(): void {
    // Load DeepSeek config
    const deepseekApiKey = process.env.DEEPSEEK_API_KEY;
    if (deepseekApiKey) {
      this.providers.deepseek = {
        ...this.providers.deepseek,
        api_key: deepseekApiKey,
        enabled: true
      } as ProviderConfig;
    }

    // Load Groq config
    const groqApiKey = process.env.GROQ_API_KEY;
    if (groqApiKey) {
      this.providers.groq = {
        ...this.providers.groq,
        api_key: groqApiKey,
        enabled: true
      } as ProviderConfig;
    }

    // Load HuggingFace config
    const hfApiKey = process.env.HUGGINGFACE_API_KEY;
    if (hfApiKey) {
      this.providers.huggingface = {
        ...this.providers.huggingface,
        api_key: hfApiKey,
        enabled: true
      } as ProviderConfig;
    }

    // Load Ollama config
    const ollamaUrl = process.env.OLLAMA_SERVER_URL;
    if (ollamaUrl) {
      this.providers.ollama = {
        ...this.providers.ollama,
        base_url: ollamaUrl,
        enabled: true
      } as ProviderConfig;
    }

    // Load routing preferences
    const loadBalancing = process.env.LLM_LOAD_BALANCING as 'round_robin' | 'least_connections' | 'weighted_response_time';
    if (loadBalancing) {
      this.routing.load_balancing = loadBalancing;
    }

    // Load caching preferences
    const cacheEnabled = process.env.LLM_CACHE_ENABLED;
    if (cacheEnabled !== undefined) {
      this.caching.enabled = cacheEnabled === 'true';
    }

    const cacheTtl = process.env.LLM_CACHE_TTL;
    if (cacheTtl) {
      this.caching.ttl = parseInt(cacheTtl);
    }

    // Load cost optimization
    const costOptimizationEnabled = process.env.LLM_COST_OPTIMIZATION;
    if (costOptimizationEnabled !== undefined) {
      this.cost_optimization.enabled = costOptimizationEnabled === 'true';
    }

    const budgetLimit = process.env.LLM_BUDGET_LIMIT;
    if (budgetLimit) {
      this.cost_optimization.budget_limit = parseFloat(budgetLimit);
    }
  }

  // Get configuration for a specific provider
  getProviderConfig(providerType: LLMProviderType): ProviderConfig | undefined {
    return this.providers[providerType];
  }

  // Update provider configuration
  updateProviderConfig(providerType: LLMProviderType, config: Partial<ProviderConfig>): void {
    const currentConfig = this.providers[providerType] || {};
    this.providers[providerType] = { ...currentConfig, ...config };
  }

  // Get routing configuration for a task type
  getRoutingForTask(taskType: TaskType): {
    primary: LLMProviderType[];
    fallback: LLMProviderType[];
  } {
    return {
      primary: this.routing.primary_providers.get(taskType) || [],
      fallback: this.routing.fallback_providers.get(taskType) || []
    };
  }

  // Update routing for a task type
  updateTaskRouting(
    taskType: TaskType,
    primary: LLMProviderType[],
    fallback: LLMProviderType[]
  ): void {
    this.routing.primary_providers.set(taskType, primary);
    this.routing.fallback_providers.set(taskType, fallback);
  }

  // Get all enabled providers
  getEnabledProviders(): LLMProviderType[] {
    return Object.entries(this.providers)
      .filter(([_, config]) => config?.enabled)
      .map(([providerType, _]) => providerType as LLMProviderType);
  }

  // Check if provider is enabled
  isProviderEnabled(providerType: LLMProviderType): boolean {
    return this.providers[providerType]?.enabled || false;
  }

  // Get cost optimization settings
  getCostOptimizationSettings(): {
    enabled: boolean;
    budget_limit?: number;
    provider_priority: LLMProviderType[];
  } {
    return { ...this.cost_optimization };
  }

  // Update cost optimization settings
  updateCostOptimization(settings: Partial<typeof this.cost_optimization>): void {
    this.cost_optimization = { ...this.cost_optimization, ...settings };
  }

  // Export configuration as JSON (for saving/loading)
  exportConfig(): ILLMConfig {
    return {
      providers: { ...this.providers },
      routing: {
        primary_providers: new Map(this.routing.primary_providers),
        fallback_providers: new Map(this.routing.fallback_providers),
        load_balancing: this.routing.load_balancing,
        circuit_breaker_threshold: this.routing.circuit_breaker_threshold,
        retry_attempts: this.routing.retry_attempts,
        retry_delay: this.routing.retry_delay
      },
      caching: { ...this.caching },
      cost_optimization: { ...this.cost_optimization }
    };
  }

  // Import configuration from JSON
  importConfig(config: ILLMConfig): void {
    this.applyConfig(config);
  }

  // Validate configuration
  validate(): { valid: boolean; errors: string[] } {
    const errors: string[] = [];

    // Check if at least one provider is enabled
    const enabledProviders = this.getEnabledProviders();
    if (enabledProviders.length === 0) {
      errors.push('At least one LLM provider must be enabled');
    }

    // Check provider configurations
    for (const [providerType, config] of Object.entries(this.providers)) {
      if (config?.enabled) {
        if (!config.api_key && providerType !== 'ollama') {
          errors.push(`${providerType} provider is enabled but no API key is configured`);
        }

        if (config.models.length === 0) {
          errors.push(`${providerType} provider has no models configured`);
        }

        if (config.rate_limits.requests_per_minute <= 0) {
          errors.push(`${providerType} provider has invalid rate limit configuration`);
        }
      }
    }

    // Check routing configuration
    for (const taskType of Object.values(TaskType)) {
      const routing = this.getRoutingForTask(taskType);
      if (routing.primary.length === 0) {
        errors.push(`No primary providers configured for task type: ${taskType}`);
      }
    }

    // Check caching configuration
    if (this.caching.enabled) {
      if (this.caching.ttl <= 0) {
        errors.push('Cache TTL must be positive');
      }
      if (this.caching.max_size <= 0) {
        errors.push('Cache max size must be positive');
      }
    }

    return {
      valid: errors.length === 0,
      errors
    };
  }

  // Get configuration summary
  getSummary(): {
    enabled_providers: LLMProviderType[];
    total_tasks_with_routing: number;
    caching_enabled: boolean;
    cost_optimization_enabled: boolean;
  } {
    const enabledProviders = this.getEnabledProviders();
    const tasksWithRouting = this.routing.primary_providers.size;

    return {
      enabled_providers: enabledProviders,
      total_tasks_with_routing: tasksWithRouting,
      caching_enabled: this.caching.enabled,
      cost_optimization_enabled: this.cost_optimization.enabled
    };
  }

  // Reset to defaults
  resetToDefaults(): void {
    this.providers = {};
    this.initializeProviderDefaults();
    this.loadFromEnvironment();
    console.log('Configuration reset to defaults');
  }

  // Clone configuration
  clone(): LLMConfig {
    return new LLMConfig(this.exportConfig());
  }
}