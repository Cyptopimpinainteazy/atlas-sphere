import { EventEmitter } from 'events';
import { LLMOrchestrator } from '../../agent-core/src/llm/LLMOrchestrator';
import { SocialOrchestrator } from '../../agent-core/src/social/SocialOrchestrator';
import { PersonaLoader } from '../../agent-core/src/persona/PersonaLoader';
import { AgentPersona, AgentTask, AgentTaskStatus, MarketData } from '../../agent-core/src/types';

const TASK_TYPES = {
  ANALYSIS: 'analysis',
  TRADING: 'trading',
  SOCIAL_POST: 'social_post',
  MARKET_MONITOR: 'market_monitor',
  EDUCATION: 'education',
  ENGAGEMENT: 'engagement'
} as const;

// Maximum backoff delay in milliseconds to prevent excessive retry delays
const MAX_BACKOFF_MS = 30000; // 30 seconds

interface Agent {
  id: string;
  persona: AgentPersona;
  status: 'idle' | 'busy' | 'error';
  lastActivity: Date;
  metrics: {
    tasksCompleted: number;
    tasksFailed: number;
    averageTaskTime: number;
  };
}

interface CoordinationResult {
  success: boolean;
  agentId: string;
  taskId: string;
  result?: Record<string, unknown>;
  error?: string;
}

// Simple lock implementation for preventing race conditions
class SimpleLock {
  private locked: boolean = false;
  private queue: (() => void)[] = [];

  acquire(): Promise<() => void> {
    return new Promise((resolve) => {
      if (!this.locked) {
        this.locked = true;
        resolve(this.createUnlockFunction());
      } else {
        this.queue.push(() => {
          this.locked = true;
          resolve(this.createUnlockFunction());
        });
      }
    });
  }

  private createUnlockFunction(): () => void {
    return () => {
      this.locked = false;
      const next = this.queue.shift();
      if (next) next();
    };
  }

  release(): void {
    if (!this.locked) {
      throw new Error('Cannot release lock that is not acquired');
    }
    this.locked = false;
    const next = this.queue.shift();
    if (next) {
      next();
    }
  }
}

/**
 * Central coordination service for AI agents
 * Manages agent lifecycle, task assignment, and communication
 */
export class AgentCoordinationService extends EventEmitter {
  private agents: Map<string, Agent> = new Map();
  private activeTasks: Map<string, AgentTask> = new Map();
  private llmOrchestrator: LLMOrchestrator;
  private socialOrchestrator: SocialOrchestrator;
  private personaLoader: PersonaLoader;
  // Lock to prevent race conditions when assigning tasks to agents
  private assignmentLock: SimpleLock = new SimpleLock();
  // Registry of event listeners for cleanup purposes
  private eventListeners: Map<string, { instance: EventEmitter; event: string; handler: (...args: any[]) => void }> = new Map();

  constructor() {
    super();
    this.llmOrchestrator = new LLMOrchestrator();
    this.socialOrchestrator = new SocialOrchestrator();
    this.personaLoader = new PersonaLoader();

    this.setupEventListeners();
  }

  /**
   * Validate task parameters and required fields
   */
  private validateTaskParameters(task: AgentTask, taskType: string): void {
    if (!task.parameters || typeof task.parameters !== 'object' || Array.isArray(task.parameters)) {
      throw new Error(`Task parameters must be a plain object for ${taskType} task`);
    }

    // Ensure only plain objects are accepted, reject arrays explicitly (per comment 2)

    switch (taskType) {
      case TASK_TYPES.ANALYSIS:
      case TASK_TYPES.TRADING:
      case TASK_TYPES.MARKET_MONITOR:
        if (!task.parameters.marketData) {
          throw new Error(`marketData is required for ${taskType} task`);
        }
        break;
      case TASK_TYPES.SOCIAL_POST:
        if (!task.parameters.contentRequest) {
          throw new Error('contentRequest is required for social_post task');
        }
        break;
      case TASK_TYPES.EDUCATION:
        if (!task.parameters.topic || !task.parameters.audience) {
          throw new Error('topic and audience are required for education task');
        }
        break;
      case TASK_TYPES.ENGAGEMENT:
        if (!task.parameters.platform || !task.parameters.postId || !task.parameters.action) {
          throw new Error('platform, postId, and action are required for engagement task');
        }
        break;
      default:
        throw new Error(`Unknown task type: ${taskType}`);
    }
  }

  /**
   * Register a new agent with the system
   */
  async registerAgent(personaId: string): Promise<{ agentId: string; success: boolean }> {
    try {
      const persona = await this.personaLoader.loadPersona(personaId);

      const agent: Agent = {
        id: `agent_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        persona,
        status: 'idle',
        lastActivity: new Date(),
        metrics: {
          tasksCompleted: 0,
          tasksFailed: 0,
          averageTaskTime: 0
        }
      };

      this.agents.set(agent.id, agent);

      this.emit('agent_registered', {
        agentId: agent.id,
        personaId,
        capabilities: persona.capabilities
      });

      return { agentId: agent.id, success: true };
    } catch (error) {
      console.error('Failed to register agent:', error);
      return {
        agentId: '',
        success: false
      };
    }
  }

  /**
   * Assign a task to an available agent
   */
  async assignTask(
    task: Omit<AgentTask, 'id' | 'status' | 'created_at' | 'agent_id'>
  ): Promise<CoordinationResult> {
    const unlock = await this.assignmentLock.acquire();

    try {
      const availableAgent = this.findAvailableAgent(task.type);

      if (!availableAgent) {
        return {
          success: false,
          agentId: '',
          taskId: '',
          error: 'No available agents for this task type'
        };
      }

      const agentTask: AgentTask = {
        id: `task_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        agent_id: availableAgent.id,
        status: 'running',
        priority: task.priority,
        description: task.description,
        parameters: task.parameters,
        created_at: new Date(),
        type: task.type,
        retry_count: 0,
        max_retries: 3,
        results: {},
        error: undefined,
      };

      availableAgent.status = 'busy';
      this.activeTasks.set(agentTask.id, agentTask);

      this.emit('task_assigned', {
        taskId: agentTask.id,
        agentId: availableAgent.id,
        taskType: task.type
      });

      // Start task execution asynchronously
      this.executeTask(agentTask, availableAgent);

      return {
        success: true,
        agentId: availableAgent.id,
        taskId: agentTask.id
      };
    } finally {
      unlock();
    }
  }

  /**
   * Execute the assigned task
   */
  private async executeTask(task: AgentTask, agent: Agent): Promise<void> {
    const startTime = Date.now();

    try {
      let result: any;

      switch (task.type) {
        case TASK_TYPES.ANALYSIS:
          result = await this.executeAnalysisTask(task, agent);
          break;
        case TASK_TYPES.TRADING:
          result = await this.executeTradingTask(task, agent);
          break;
        case TASK_TYPES.SOCIAL_POST:
          result = await this.executeSocialPostTask(task, agent);
          break;
        case TASK_TYPES.MARKET_MONITOR:
          result = await this.executeMarketMonitorTask(task, agent);
          break;
        case TASK_TYPES.EDUCATION:
          result = await this.executeEducationTask(task, agent);
          break;
        case TASK_TYPES.ENGAGEMENT:
          result = await this.executeEngagementTask(task, agent);
          break;
        default:
          throw new Error(`Unknown task type: ${task.type}`);
      }

      // Update task with success
      task.status = 'completed';
      task.completed_at = new Date();
      task.results = result;

      // Update agent metrics
      agent.metrics.tasksCompleted++;
      agent.lastActivity = new Date();
      agent.status = 'idle';

      this.emit('task_completed', {
        taskId: task.id,
        agentId: agent.id,
        result,
        executionTime: Date.now() - startTime
      });

      this.activeTasks.delete(task.id);

    } catch (error) {
      console.error(`Task ${task.id} failed:`, error);

      // Track each failure attempt
      task.lastAttemptAt = new Date();
      task.lastErrorAt = new Date();
      task.lastErrorMessage = error instanceof Error ? error.message : 'Unknown error';
      task.status = 'failed';
      task.error = task.lastErrorMessage;

      // Check if we should retry
      if (task.retry_count < task.max_retries) {
        task.retry_count++;
        task.status = 'pending';
        agent.status = 'idle'; // Free agent during retry
        this.scheduleRetry(task, agent);
      } else {
        // All retries exhausted, final failure
        // Do not set completed_at prematurely; only set on success
        this.activeTasks.delete(task.id);

        // Update agent metrics for failure
        agent.metrics.tasksFailed++;
        agent.status = 'idle';
        agent.lastActivity = new Date();

        this.emit('task_failed', {
          taskId: task.id,
          agentId: agent.id,
          error: task.error,
          executionTime: Date.now() - startTime
        });
      }
    }
  }

  /**
   * Execute market analysis task
   */
  private async executeAnalysisTask(task: AgentTask, agent: Agent) {
    this.validateTaskParameters(task, 'analysis');
    const marketData = task.parameters.marketData as MarketData;

    if (task.parameters.analysisType === 'sentiment') {
      // Use LLM for text-based analysis
      const analysis = await this.llmOrchestrator.analyzeMarket(marketData, agent.persona);
      return { type: 'sentiment_analysis', data: analysis };
    }

    // Default technical analysis
    const analysis = await this.llmOrchestrator.analyzeMarket(marketData, agent.persona);
    return { type: 'technical_analysis', data: analysis };
  }

  /**
   * Execute trading task
   */
  private async executeTradingTask(task: AgentTask, agent: Agent) {
    this.validateTaskParameters(task, 'trading');
    const marketData = task.parameters.marketData as MarketData;

    // Get trading decision from LLM
    const analysis = await this.llmOrchestrator.analyzeMarket(marketData, agent.persona);

    // Check if agent is configured for trading
    if (!agent.persona.trading.enabled) {
      throw new Error('Agent is not configured for trading operations');
    }

    // Implement risk management based on persona
    const riskAdjustedDecision = this.applyRiskManagement(analysis, agent.persona);

    return {
      type: 'trading_decision',
      analysis,
      decision: riskAdjustedDecision,
      marketData
    };
  }

  /**
   * Execute social media posting task
   */
  private async executeSocialPostTask(task: AgentTask, agent: Agent) {
    this.validateTaskParameters(task, 'social posting');
    const contentRequest = task.parameters.contentRequest as any; // Will be validated by LLM orchestrator

    // Generate content using LLM
    const content = await this.llmOrchestrator.generateContent(contentRequest, agent.persona);

    // Post to specified platforms
    const platforms = Array.isArray(task.parameters.platforms) ? task.parameters.platforms : ['twitter'];
    const results = await this.socialOrchestrator.postToPlatforms({
      text: content.content,
      hashtags: content.hashtags,
      media: []
    }, platforms);

    return {
      type: 'social_post',
      generatedContent: content,
      postingResults: results
    };
  }

  /**
   * Execute market monitoring task
   */
  private async executeMarketMonitorTask(task: AgentTask, agent: Agent) {
    this.validateTaskParameters(task, 'market monitoring');
    const marketData = task.parameters.marketData as MarketData;

    // Continuous monitoring would be implemented here
    // For now, return a monitor setup result
    return {
      type: 'market_monitor',
      status: 'monitoring_started',
      monitoredAsset: marketData.pair,
      thresholds: task.parameters.thresholds
    };
  }

  /**
   * Execute educational content creation task
   */
  private async executeEducationTask(task: AgentTask, agent: Agent) {
    this.validateTaskParameters(task, 'education');
    const topic = task.parameters.topic as string;
    const audience = task.parameters.audience as 'beginners' | 'intermediate' | 'advanced' || 'intermediate';

    const content = await this.llmOrchestrator.generateContent({
      type: 'education',
      topic,
      audience,
      length: 'long'
    }, agent.persona);

    // Schedule for posting if requested
    if ((task.parameters as any).autoPost) {
      this.socialOrchestrator.schedulePost({
        text: content.content,
        hashtags: content.hashtags,
        media: []
      }, ['twitter', 'discord'], 3600000); // Post in 1 hour
    }

    return {
      type: 'educational_content',
      topic,
      content
    };
  }

  /**
   * Execute social media engagement task
   */
  private async executeEngagementTask(task: AgentTask, agent: Agent) {
    this.validateTaskParameters(task, 'engagement');

    const platform = task.parameters.platform as any;
    const postId = task.parameters.postId as string;
    const action = task.parameters.action as any;

    const result = await this.socialOrchestrator.engageWithContent(platform, postId, action);

    return {
      type: 'social_engagement',
      platform,
      postId,
      action: action.type,
      result
    };
  }

  /**
   * Apply risk management to trading decisions
   */
  private applyRiskManagement(analysis: any, persona: AgentPersona) {
    // Apply persona-specific risk management
    const baseDecision = analysis.recommendation;
    let finalDecision = baseDecision;
    let modifiedRisk = analysis.risk_level;

    if (persona.trading.risk_tolerance === 'low') {
      if ((analysis?.confidence ?? 0) < 70) {
        finalDecision = 'hold';
      }
      if (analysis?.risk_level === 'high') {
        finalDecision = 'hold';
      }
      modifiedRisk = analysis?.risk_level === 'high' ? 'medium' : analysis?.risk_level;
    }

    if (persona.trading.strategy === 'conservative') {
      if (finalDecision === 'buy' && analysis?.recommendation !== 'hold') {
        // Additional checks for conservative strategy
        if ((analysis?.key_levels?.support ?? []).length === 0) {
          finalDecision = 'hold';
        }
      }
    }

    return {
      originalDecision: baseDecision,
      finalDecision,
      riskLevel: modifiedRisk,
      riskAdjustments: persona.trading
    };
  }

  /**
   * Find an available agent for a task type
   */
  private findAvailableAgent(taskType: string): Agent | null {
    for (const agent of this.agents.values()) {
      if (agent.status === 'idle' && agent.persona.capabilities.includes(taskType)) {
        return agent;
      }
    }
    return null;
  }

  /**
   * Schedule a retry for failed tasks
   */
  private scheduleRetry(task: AgentTask, agent: Agent): void {
    const baseBackoff = Math.pow(2, task.retry_count) * 1000; // Exponential backoff in milliseconds
    const jitter = Math.random() * 500; // Random jitter between 0-500ms
    const delay = Math.min(baseBackoff + jitter, MAX_BACKOFF_MS);

    setTimeout(() => {
      this.executeTask(task, agent);
    }, delay);
  }

  /**
   * Setup event listeners for subprocess communication
   */
  private setupEventListeners(): void {
    const llmHandler = (data: any) => this.emit('llm_request_successful', data);
    this.eventListeners.set('llm_request_successful', {
      instance: this.llmOrchestrator,
      event: 'request_successful',
      handler: llmHandler
    });
    this.llmOrchestrator.on('request_successful', llmHandler);

    const socialHandler = (data: any) => this.emit('social_post_successful', data);
    this.eventListeners.set('social_post_successful', {
      instance: this.socialOrchestrator,
      event: 'post_successful',
      handler: socialHandler
    });
    this.socialOrchestrator.on('post_successful', socialHandler);

    this.personaLoader.watchPersonaChanges();
  }

  /**
   * Get all agent statuses
   */
  getAgentStatuses(): Record<string, { status: string; lastActivity: Date; metrics: any }> {
    const statuses: Record<string, { status: string; lastActivity: Date; metrics: any }> = {};

    for (const [agentId, agent] of this.agents) {
      statuses[agentId] = {
        status: agent.status,
        lastActivity: agent.lastActivity,
        metrics: agent.metrics
      };
    }

    return statuses;
  }

  /**
   * Get active tasks
   */
  getActiveTasks(): AgentTask[] {
    return Array.from(this.activeTasks.values());
  }

  /**
   * Shutdown the coordination service
   */
  shutdown(): void {
    this.eventListeners.forEach(({ instance, event, handler }) => {
      instance.removeListener(event, handler);
    });
    this.eventListeners.clear();

    this.llmOrchestrator.destroy();
    this.personaLoader.stopWatching();
    this.removeAllListeners();
  }
}
