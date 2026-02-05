export interface AgentPersona {
  id: string
  name: string
  description: string
  model: {
    primary: LLMProviderType
    fallback: LLMProviderType[]
    temperature: number
    max_tokens: number
  }
  trading: {
    enabled: boolean
    max_position_size: number
    risk_tolerance: 'low' | 'medium' | 'high'
    strategy: 'conservative' | 'aggressive' | 'balanced'
    stop_loss_percentage: number
    take_profit_percentage: number
    max_concurrent_positions: number
  }
  capabilities: string[]
  personality: {
    tone: 'professional' | 'casual' | 'humorous' | 'analytical'
    expertise: string[]
    communication_style: 'direct' | 'verbose' | 'concise'
    emoji_usage: 'none' | 'minimal' | 'moderate' | 'frequent'
  }
  social: {
    twitter_username?: string
    discord_username?: string
    telegram_username?: string
    posting_schedule: {
      frequency: 'low' | 'medium' | 'high'
      time_restrictions: string[]
    }
    content_focus: ('trading' | 'analysis' | 'education' | 'entertainment')[]
  }
  created_at: Date
  updated_at: Date
}

// Enhanced LLM Provider interfaces for orchestration system
export interface LLMProvider {
  id: string
  name: LLMProviderType
  status: 'healthy' | 'degraded' | 'unavailable'
  last_health_check: Date
  capabilities: LLMProviderCapability[]
  rate_limits: {
    requests_per_minute: number
    tokens_per_minute: number
  }
  generateResponse(request: LLMRequest): Promise<LLMResponse>
  analyzeMarket(data: MarketData): Promise<MarketAnalysis>
  generateContent(request: ContentRequest): Promise<ContentResponse>
  chatCompletion(request: ChatCompletionRequest): Promise<ChatCompletionResponse>
  analyzeSentiment(text: string): Promise<SentimentAnalysisResult>
  healthCheck(): Promise<ProviderHealth>
}

// LLM Orchestrator interfaces
export interface LLMOrchestrator {
  providers: Map<LLMProviderType, LLMProvider>
  healthMonitor: HealthMonitor
  taskRouter: TaskRouter
  cache: ResponseCache
  config: LLMConfig

  processRequest(request: OrchestratorRequest): Promise<OrchestratorResponse>
  getProviderHealth(): Promise<Map<LLMProviderType, ProviderHealth>>
  getMetrics(): Promise<OrchestratorMetrics>
  addProvider(provider: LLMProvider): void
  removeProvider(providerType: LLMProviderType): void
}

// Task routing and types
export enum TaskType {
  TECHNICAL_ANALYSIS = 'technical-analysis',
  TRADING_DECISION = 'trading-decision',
  SENTIMENT_ANALYSIS = 'sentiment-analysis',
  CONTENT_GENERATION = 'content-generation',
  MARKET_ANALYSIS = 'market-analysis',
  CODE_GENERATION = 'code-generation',
  PRIVACY_SENSITIVE = 'privacy-sensitive'
}

export interface ProviderHealth {
  provider: LLMProviderType
  status: 'healthy' | 'degraded' | 'unavailable'
  response_time: number
  error_rate: number
  last_check: Date
  availability_score: number
  total_requests: number
  successful_requests: number
  average_response_time: number
  cost_per_token?: number
  quota_used?: number
  quota_limit?: number
}

export interface LLMConfig {
  providers: {
    [K in LLMProviderType]?: ProviderConfig
  }
  routing: {
    primary_providers: Map<TaskType, LLMProviderType[]>
    fallback_providers: Map<TaskType, LLMProviderType[]>
    load_balancing: 'round_robin' | 'least_connections' | 'weighted_response_time'
    circuit_breaker_threshold: number
    retry_attempts: number
    retry_delay: number
  }
  caching: {
    enabled: boolean
    ttl: number
    max_size: number
    strategy: 'memory' | 'redis' | 'file'
  }
  cost_optimization: {
    enabled: boolean
    budget_limit?: number
    provider_priority: LLMProviderType[]
  }
}

export interface ProviderConfig {
  api_key?: string
  base_url?: string
  models: string[]
  rate_limits: {
    requests_per_minute: number
    tokens_per_minute: number
  }
  retry_policy: {
    max_retries: number
    backoff_multiplier: number
    initial_delay: number
  }
  timeout: number
  enabled: boolean
}

export interface FallbackStrategy {
  task_type: TaskType
  primary_provider: LLMProviderType
  fallback_providers: LLMProviderType[]
  conditions: {
    max_response_time?: number
    max_retries?: number
    required_confidence?: number
  }
}

export interface ChatCompletionRequest {
  messages: ChatMessage[]
  model?: string
  temperature?: number
  max_tokens?: number
  top_p?: number
  frequency_penalty?: number
  presence_penalty?: number
  stop?: string[]
  stream?: boolean
  task_type?: TaskType
  priority?: 'low' | 'medium' | 'high'
  cache_key?: string
}

export interface ChatMessage {
  role: 'system' | 'user' | 'assistant'
  content: string
}

export interface ChatCompletionResponse {
  content: string
  usage: {
    prompt_tokens: number
    completion_tokens: number
    total_tokens: number
  }
  model: string
  provider: LLMProviderType
  finish_reason: string
  response_time: number
  cached?: boolean
}

export interface SentimentAnalysisResult {
  score: number // 0-1 (negative to positive)
  label: 'positive' | 'negative' | 'neutral'
  confidence: number
  provider: LLMProviderType
  model: string
  processing_time: number
}

// Orchestrator request/response
export interface OrchestratorRequest {
  id: string
  task_type: TaskType
  content: string
  parameters?: Record<string, any>
  priority?: 'low' | 'medium' | 'high'
  preferred_providers?: LLMProviderType[]
  bypass_cache?: boolean
  timeout?: number
  metadata?: Record<string, any>
}

export interface OrchestratorResponse {
  id: string
  request_id: string
  content: string
  provider: LLMProviderType
  model: string
  usage: {
    prompt_tokens: number
    completion_tokens: number
    total_tokens: number
  }
  response_time: number
  cached: boolean
  cost?: number
  metadata?: Record<string, any>
  error?: string
}

// Task Router interface
export interface TaskRouter {
  routeTask(request: OrchestratorRequest): Promise<LLMProviderType>
  getRoutingTable(): Map<TaskType, LLMProviderType[]>
  updateRoutingRules(rules: Map<TaskType, LLMProviderType[]>): void
  getProviderRecommendations(taskType: TaskType): LLMProviderType[]
}

// Health Monitor interface
export interface HealthMonitor {
  checkProviderHealth(provider: LLMProvider): Promise<ProviderHealth>
  getAllProviderHealth(): Promise<Map<LLMProviderType, ProviderHealth>>
  recordMetrics(provider: LLMProviderType, responseTime: number, success: boolean): void
  getMetrics(timeRange?: number): Promise<ProviderMetrics[]>
  enableCircuitBreaker(provider: LLMProviderType): void
  disableCircuitBreaker(provider: LLMProviderType): void
  isCircuitBreakerEnabled(provider: LLMProviderType): boolean
}

export interface ProviderMetrics {
  provider: LLMProviderType
  time_range: number
  total_requests: number
  successful_requests: number
  failed_requests: number
  average_response_time: number
  error_rate: number
  cost?: number
  quota_usage?: number
}

export interface OrchestratorMetrics {
  total_requests: number
  successful_requests: number
  failed_requests: number
  cache_hit_rate: number
  average_response_time: number
  provider_usage: Map<LLMProviderType, number>
  cost_breakdown: Map<LLMProviderType, number>
  error_breakdown: Map<LLMProviderType, number>
}

// Response Cache interface
export interface ResponseCache {
  get(key: string): Promise<ChatCompletionResponse | null>
  set(key: string, response: ChatCompletionResponse, ttl?: number): Promise<void>
  delete(key: string): Promise<void>
  clear(): Promise<void>
  size(): Promise<number>
  hitRate(): Promise<number>
}

export interface LLMRequest {
  prompt: string
  context?: string
  temperature?: number
  max_tokens?: number
  model?: string
  persona?: AgentPersona
}

export interface LLMResponse {
  content: string
  usage: {
    prompt_tokens: number
    completion_tokens: number
    total_tokens: number
  }
  model: string
  provider: LLMProviderType
  finish_reason: string
}

export interface MarketData {
  pair: string
  price: number
  volume_24h: number
  price_change_24h: number
  market_cap?: number
  timestamp: Date
}

export interface MarketAnalysis {
  sentiment: 'bullish' | 'bearish' | 'neutral'
  confidence: number
  reasoning: string
  key_levels: {
    support: number[]
    resistance: number[]
  }
  recommendation: 'buy' | 'sell' | 'hold'
  risk_level: 'low' | 'medium' | 'high'
}

export interface ContentRequest {
  type: 'tweet' | 'post' | 'analysis' | 'education'
  topic: string
  context?: string
  length: 'short' | 'medium' | 'long'
  audience: 'beginners' | 'intermediate' | 'advanced'
  persona?: AgentPersona
}

export interface ContentResponse {
  content: string
  hashtags?: string[]
  mentions?: string[]
  created_at: Date
}

export type LLMProviderType = 'deepseek' | 'groq' | 'ollama' | 'huggingface'

export type LLMProviderCapability = 'text_generation' | 'code_generation' | 'analysis' | 'sentiment' | 'translation'

export interface SocialPlatform {
  id: string
  name: 'twitter' | 'discord' | 'telegram'
  status: 'connected' | 'disconnected' | 'error'
  config: {
    api_key?: string
    api_secret?: string
    bearer_token?: string
    bot_token?: string
    webhook_url?: string
  }
  rate_limits: {
    requests_per_minute: number
    posts_per_hour: number
  }
  post(content: SocialContent): Promise<SocialPostResult>
  engage(postId: string, action: SocialAction): Promise<SocialEngagementResult>
  monitor(query: SocialMonitorQuery): Promise<SocialMonitorResult>
}

export interface SocialContent {
  text: string
  media?: {
    type: 'image' | 'video' | 'gif'
    url: string
    alt_text?: string
  }[]
  hashtags?: string[]
  mentions?: string[]
  link?: string
  thread?: string[]
  // Optional platform-specific fields
  reply_to?: string
  quote_tweet_id?: string
  // Arbitrary metadata used by optimizers and generators
  metadata?: Record<string, any>
}

export interface SocialPostResult {
  success: boolean
  // Many implementations return early errors without a post id; make optional
  post_id?: string
  platform: string
  metrics?: {
    likes: number
    shares: number
    comments: number
  }
  error?: string
  url?: string
  // Optional fields used by some platform implementations
  thread_ids?: string[]
  engagement_score?: number
  community_metrics?: Record<string, any>
}

export interface SocialAction {
  type: 'like' | 'retweet' | 'reply' | 'follow' | 'react' | 'comment' | 'share' | 'quote'
  content?: string
}

export interface SocialEngagementResult {
  success: boolean
  error?: string
}

export interface SocialMonitorQuery {
  terms?: string[]
  hashtags?: string[]
  mentions?: string[]
  // Some implementations use 'keywords' naming
  keywords?: string[]
  since?: Date
  limit?: number
}

export interface SocialMonitorResult {
  // Some providers return lightweight posts or different shapes; allow any[] to ease integration
  posts: SocialPost[] | any[]
  // Some implementations return strings for trends
  trends: SocialTrend[] | string[]
  engagement_rate: number
  // Optional metrics bag for some implementations
  metrics?: Record<string, number>
}

export interface SocialPost {
  id: string
  platform: string
  author: string
  content: string
  timestamp: Date
  metrics: {
    likes: number
    shares: number
    comments: number
  }
  sentiment?: 'positive' | 'negative' | 'neutral'
}

export interface SocialTrend {
  term: string
  volume: number
  sentiment: 'positive' | 'negative' | 'neutral'
  trend_direction: 'rising' | 'falling' | 'stable'
}

export interface AgentTask {
  id: string
  agent_id: string
  type: AgentTaskType
  status: AgentTaskStatus
  priority: 'low' | 'medium' | 'high' | 'critical'
  description: string
  parameters: Record<string, unknown>
  created_at: Date
  started_at?: Date
  completed_at?: Date
  deadline?: Date
  results?: Record<string, unknown>
  error?: string
  retry_count: number
  max_retries: number
  lastErrorAt?: Date
  lastErrorMessage?: string
  lastAttemptAt?: Date
}

export type AgentTaskType = 'trading' | 'analysis' | 'social_post' | 'market_monitor' | 'education' | 'engagement'

export type AgentTaskStatus = 'pending' | 'running' | 'completed' | 'failed' | 'cancelled'

export interface AgentMetrics {
  agent_id: string
  timestamp: Date
  success_rate: number
  total_tasks: number
  completed_tasks: number
  failed_tasks: number
  average_response_time: number // in milliseconds
  llm_usage: {
    provider: LLMProviderType
    total_tokens: number
    cost?: number
  }[]
  social_metrics: {
    platform: string
    posts_count: number
    engagement_rate: number
    follower_growth?: number
  }[]
  trading_performance?: {
    total_trades: number
    win_rate: number
    profit_loss: number
    risk_adjusted_return: number
  }
}
