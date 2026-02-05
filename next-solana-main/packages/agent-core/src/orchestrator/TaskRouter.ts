import {
  TaskRouter as ITaskRouter,
  OrchestratorRequest,
  LLMProviderType,
  TaskType,
  ProviderHealth,
  LLMConfig
} from '../types';

export class TaskRouter implements ITaskRouter {
  private routingTable: Map<TaskType, LLMProviderType[]> = new Map();
  private providerHealth: Map<LLMProviderType, ProviderHealth> = new Map();
  private config: LLMConfig;

  constructor(config: LLMConfig) {
    this.config = config;
    this.initializeDefaultRouting();
  }

  private initializeDefaultRouting(): void {
    // Default routing based on provider strengths and use cases

    // DeepSeek: Best for technical analysis and code generation
    this.routingTable.set(TaskType.TECHNICAL_ANALYSIS, ['deepseek', 'groq', 'ollama']);
    this.routingTable.set(TaskType.CODE_GENERATION, ['deepseek', 'groq', 'ollama']);

    // Groq: Fastest for real-time trading decisions
    this.routingTable.set(TaskType.TRADING_DECISION, ['groq', 'deepseek', 'huggingface']);
    this.routingTable.set(TaskType.MARKET_ANALYSIS, ['groq', 'deepseek', 'huggingface']);

    // HuggingFace: Specialized for sentiment analysis
    this.routingTable.set(TaskType.SENTIMENT_ANALYSIS, ['huggingface', 'groq', 'deepseek']);

    // Balanced approach for content generation
    this.routingTable.set(TaskType.CONTENT_GENERATION, ['groq', 'deepseek', 'huggingface', 'ollama']);

    // Privacy-sensitive operations go to local Ollama
    this.routingTable.set(TaskType.PRIVACY_SENSITIVE, ['ollama', 'deepseek', 'groq']);

    // Use config for primary and fallback providers
    if (this.config.routing.primary_providers.size > 0) {
      for (const [taskType, providers] of this.config.routing.primary_providers) {
        this.routingTable.set(taskType, providers);
      }
    }

    if (this.config.routing.fallback_providers.size > 0) {
      for (const [taskType, fallbackProviders] of this.config.routing.fallback_providers) {
        const currentProviders = this.routingTable.get(taskType) || [];
        this.routingTable.set(taskType, [...currentProviders, ...fallbackProviders]);
      }
    }
  }

  async routeTask(request: OrchestratorRequest): Promise<LLMProviderType> {
    const taskType = request.task_type;

    // Get available providers for this task type
    const availableProviders = this.getProviderRecommendations(taskType);

    if (availableProviders.length === 0) {
      throw new Error(`No providers available for task type: ${taskType}`);
    }

    // Filter by healthy providers
    const healthyProviders = availableProviders.filter(providerType => {
      const health = this.providerHealth.get(providerType);
      return health?.status === 'healthy' && health.availability_score > 0.5;
    });

    if (healthyProviders.length === 0) {
      console.warn(`No healthy providers found for ${taskType}, using first available`);
      return availableProviders[0];
    }

    // Apply load balancing strategy
    return this.selectProviderBasedOnStrategy(healthyProviders, request);
  }

  private selectProviderBasedOnStrategy(
    providers: LLMProviderType[],
    request: OrchestratorRequest
  ): LLMProviderType {
    const strategy = this.config.routing.load_balancing;

    switch (strategy) {
      case 'round_robin':
        return this.roundRobinSelection(providers, request.task_type);

      case 'least_connections':
        return this.leastConnectionsSelection(providers);

      case 'weighted_response_time':
        return this.weightedResponseTimeSelection(providers);

      default:
        return providers[0];
    }
  }

  private roundRobinSelection(providers: LLMProviderType[], taskType: TaskType): LLMProviderType {
    // Simple round-robin implementation
    // In a production system, you'd track request counts per provider
    const index = Math.floor(Date.now() / 1000) % providers.length;
    return providers[index];
  }

  private leastConnectionsSelection(providers: LLMProviderType[]): LLMProviderType {
    // Select provider with lowest current load
    // This would require tracking active requests per provider
    let bestProvider = providers[0];
    let lowestLoad = Infinity;

    for (const providerType of providers) {
      const health = this.providerHealth.get(providerType);
      const currentLoad = health?.total_requests || 0;

      if (currentLoad < lowestLoad) {
        lowestLoad = currentLoad;
        bestProvider = providerType;
      }
    }

    return bestProvider;
  }

  private weightedResponseTimeSelection(providers: LLMProviderType[]): LLMProviderType {
    // Select provider with best response time performance
    let bestProvider = providers[0];
    let bestScore = -Infinity;

    for (const providerType of providers) {
      const health = this.providerHealth.get(providerType);
      if (!health) continue;

      // Calculate score based on response time and success rate
      const responseTimeScore = Math.max(0, 1000 - health.average_response_time);
      const successRateScore = health.successful_requests / Math.max(1, health.total_requests);
      const availabilityScore = health.availability_score;

      const totalScore = responseTimeScore * 0.4 + successRateScore * 100 * 0.4 + availabilityScore * 100 * 0.2;

      if (totalScore > bestScore) {
        bestScore = totalScore;
        bestProvider = providerType;
      }
    }

    return bestProvider;
  }

  getRoutingTable(): Map<TaskType, LLMProviderType[]> {
    return new Map(this.routingTable);
  }

  updateRoutingRules(rules: Map<TaskType, LLMProviderType[]>): void {
    for (const [taskType, providers] of rules) {
      this.routingTable.set(taskType, providers);
    }
    console.log('Task routing rules updated');
  }

  getProviderRecommendations(taskType: TaskType): LLMProviderType[] {
    return this.routingTable.get(taskType) || [];
  }

  // Update provider health information
  updateProviderHealth(providerType: LLMProviderType, health: ProviderHealth): void {
    this.providerHealth.set(providerType, health);
  }

  // Get all healthy providers
  getHealthyProviders(): LLMProviderType[] {
    return Array.from(this.providerHealth.entries())
      .filter(([_, health]) => health.status === 'healthy' && health.availability_score > 0.5)
      .map(([providerType, _]) => providerType);
  }

  // Analyze content to determine optimal task type
  analyzeContent(content: string): TaskType {
    const lowerContent = content.toLowerCase();

    // Simple content analysis to determine task type
    if (lowerContent.includes('sentiment') || lowerContent.includes('feeling') || lowerContent.includes('emotion')) {
      return TaskType.SENTIMENT_ANALYSIS;
    }

    if (lowerContent.includes('technical') || lowerContent.includes('analysis') || lowerContent.includes('code')) {
      return TaskType.TECHNICAL_ANALYSIS;
    }

    if (lowerContent.includes('trade') || lowerContent.includes('buy') || lowerContent.includes('sell')) {
      return TaskType.TRADING_DECISION;
    }

    if (lowerContent.includes('market') || lowerContent.includes('price') || lowerContent.includes('volume')) {
      return TaskType.MARKET_ANALYSIS;
    }

    if (lowerContent.includes('content') || lowerContent.includes('post') || lowerContent.includes('tweet')) {
      return TaskType.CONTENT_GENERATION;
    }

    if (lowerContent.includes('private') || lowerContent.includes('local') || lowerContent.includes('sensitive')) {
      return TaskType.PRIVACY_SENSITIVE;
    }

    // Default to content generation
    return TaskType.CONTENT_GENERATION;
  }

  // Get routing statistics
  getRoutingStatistics(): {
    total_routes: number;
    healthy_routes: number;
    degraded_routes: number;
    unavailable_routes: number;
    routes_by_task_type: Record<TaskType, number>;
  } {
    const totalRoutes = this.routingTable.size;
    const healthyRoutes = Array.from(this.providerHealth.values())
      .filter(h => h.status === 'healthy').length;
    const degradedRoutes = Array.from(this.providerHealth.values())
      .filter(h => h.status === 'degraded').length;
    const unavailableRoutes = Array.from(this.providerHealth.values())
      .filter(h => h.status === 'unavailable').length;

    const routesByTaskType: Record<string, number> = {};
    for (const [taskType, providers] of this.routingTable) {
      routesByTaskType[taskType] = providers.filter(p => {
        const health = this.providerHealth.get(p);
        return health?.status === 'healthy';
      }).length;
    }

    return {
      total_routes: totalRoutes,
      healthy_routes: healthyRoutes,
      degraded_routes: degradedRoutes,
      unavailable_routes: unavailableRoutes,
      routes_by_task_type: routesByTaskType as Record<TaskType, number>
    };
  }

  // Optimize routing based on performance data
  optimizeRouting(): void {
    // Analyze performance and adjust routing rules
    const stats = this.getRoutingStatistics();

    // If a task type has no healthy providers, adjust routing
    for (const [taskType, healthyCount] of Object.entries(stats.routes_by_task_type)) {
      if (healthyCount === 0) {
        console.warn(`No healthy providers for task type: ${taskType}, adjusting routing...`);
        // Could implement automatic fallback provider assignment
      }
    }
  }

  // Get recommended provider for specific content
  getRecommendedProviderForContent(content: string, preferredTaskType?: TaskType): LLMProviderType {
    const taskType = preferredTaskType || this.analyzeContent(content);
    const recommendations = this.getProviderRecommendations(taskType);

    // Filter by healthy providers
    const healthyProviders = recommendations.filter(providerType => {
      const health = this.providerHealth.get(providerType);
      return health?.status === 'healthy';
    });

    return healthyProviders.length > 0 ? healthyProviders[0] : recommendations[0];
  }

  // Validate routing configuration
  validateConfiguration(): { valid: boolean; errors: string[] } {
    const errors: string[] = [];

    // Check if all task types have providers
    for (const taskType of Object.values(TaskType)) {
      const providers = this.routingTable.get(taskType);
      if (!providers || providers.length === 0) {
        errors.push(`No providers configured for task type: ${taskType}`);
      }
    }

    // Check if configured providers exist
    for (const providers of this.routingTable.values()) {
      for (const providerType of providers) {
        if (!Object.values(LLMProviderType).includes(providerType as LLMProviderType)) {
          errors.push(`Unknown provider type: ${providerType}`);
        }
      }
    }

    return {
      valid: errors.length === 0,
      errors
    };
  }
}