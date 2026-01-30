/**
 * TypeScript client for Python Trading Engine
 * Provides interface to the FastAPI trading service
 */

import axios, { AxiosInstance, AxiosResponse } from 'axios';
import { z } from 'zod';

// Types matching Python Pydantic models
export const ChainIdSchema = z.enum([
  'solana', 'ethereum', 'base', 'polygon', 'bsc', 'arbitrum', 'optimism', 'pulsechain'
]);

export const TradeRequestSchema = z.object({
  tokenAddress: z.string().regex(/^[A-Za-z0-9]{32,44}$/, { message: "Invalid token address format" }),
  chainId: ChainIdSchema,
  tradeAmountUsd: z.number().positive(),
  slippageOverride: z.number().min(0).max(100).optional(),
  routePreferences: z.record(z.unknown()).optional(),
  userPublicKey: z.string().optional(),
  strategyOverrides: z.record(z.unknown()).optional(),
});

export const TradeResponseSchema = z.object({
  taskId: z.string(),
  success: z.boolean(),
  message: z.string(),
  txHashes: z.array(z.string()),
  estimatedSlices: z.number().min(1),
});

export const RiskStatusSchema = z.object({
  position_count: z.number().min(0),
  daily_pnl: z.number(),
  circuit_breaker_active: z.boolean(),
  losing_streak: z.number().min(0),
  max_positions: z.number().positive(),
  max_daily_loss: z.number(),
});

export const ChainInfoSchema = z.object({
  chain_id: z.string(),
  name: z.string(),
  native_token: z.string(),
  rpc_url: z.string(),
  status: z.string(),
});

export type ChainId = z.infer<typeof ChainIdSchema>;
export type TradeRequest = z.infer<typeof TradeRequestSchema>;
export type TradeResponse = z.infer<typeof TradeResponseSchema>;
export type RiskStatus = z.infer<typeof RiskStatusSchema>;
export type ChainInfo = z.infer<typeof ChainInfoSchema>;

export interface TradingEngineConfig {
  baseURL: string;
  apiKey?: string;
  timeout?: number;
  retries?: number;
}

export interface RetryConfig {
  maxRetries: number;
  baseDelay: number;
  maxDelay: number;
}

export class TradingEngineError extends Error {
  constructor(
    message: string,
    public statusCode?: number,
    public response?: any
  ) {
    super(message);
    this.name = 'TradingEngineError';
  }
}

export class TradingEngineClient {
  private client: AxiosInstance;
  private config: TradingEngineConfig;
  private retryConfig: RetryConfig;

  constructor(config: TradingEngineConfig) {
    this.config = {
      timeout: 30000,
      retries: 3,
      ...config,
    };

    this.retryConfig = {
      maxRetries: this.config.retries!,
      baseDelay: 1000,
      maxDelay: 10000,
    };

    this.client = axios.create({
      baseURL: this.config.baseURL,
      timeout: this.config.timeout,
      headers: {
        'Content-Type': 'application/json',
        ...(this.config.apiKey && { 'Authorization': `Bearer ${this.config.apiKey}` }),
      },
    });

    this.setupInterceptors();
  }

  private setupInterceptors(): void {
    // Request interceptor for logging
    this.client.interceptors.request.use(
      (config) => {
        console.log(`[TradingEngine] ${config.method?.toUpperCase()} ${config.url}`);
        return config;
      },
      (error) => {
        console.error('[TradingEngine] Request error:', error);
        return Promise.reject(error);
      }
    );

    // Response interceptor for error handling
    this.client.interceptors.response.use(
      (response) => response,
      async (error) => {
        const { config, response } = error;

        if (!config || !response) {
          throw new TradingEngineError('Network error or invalid response');
        }

        const statusCode = response.status;
        const errorMessage = response.data?.detail || response.data?.message || 'Unknown error';

        throw new TradingEngineError(errorMessage, statusCode, response.data);
      }
    );
  }

  private async retryRequest<T>(
    requestFn: () => Promise<AxiosResponse<T>>,
    attempt: number = 1
  ): Promise<T> {
    try {
      const response = await requestFn();
      return response.data;
    } catch (error) {
      if (attempt < this.retryConfig.maxRetries && this.shouldRetry(error)) {
        const delay = Math.min(
          this.retryConfig.baseDelay * Math.pow(2, attempt - 1),
          this.retryConfig.maxDelay
        );

        console.log(`[TradingEngine] Retrying request (attempt ${attempt + 1}/${this.retryConfig.maxRetries}) after ${delay}ms`);
        await new Promise(resolve => setTimeout(resolve, delay));

        return this.retryRequest(requestFn, attempt + 1);
      }
      throw error;
    }
  }

  private shouldRetry(error: any): boolean {
    // Retry on network errors or 5xx status codes
    if (error.code === 'NETWORK_ERROR' || error.code === 'TIMEOUT') {
      return true;
    }

    if (error.statusCode && error.statusCode >= 500) {
      return true;
    }

    return false;
  }

  /**
   * Execute a trade using the Python trading engine
   */
  async executeTrade(request: TradeRequest): Promise<TradeResponse> {
    const validatedRequest = TradeRequestSchema.parse(request);

    return this.retryRequest(() =>
      this.client.post<TradeResponse>('/trade', validatedRequest)
    );
  }

  /**
   * Get current risk management status
   */
  async getRiskStatus(): Promise<RiskStatus> {
    return this.retryRequest(() =>
      this.client.get<RiskStatus>('/risk/status')
    );
  }

  /**
   * Get list of supported blockchain networks
   */
  async getSupportedChains(): Promise<ChainInfo[]> {
    return this.retryRequest(() =>
      this.client.get<ChainInfo[]>('/chains')
    );
  }

  /**
   * Health check for the trading engine service
   */
  async getHealthStatus(): Promise<any> {
    return this.retryRequest(() =>
      this.client.get('/health')
    );
  }

  /**
   * Validate trade parameters before execution
   */
  async validateTradeParams(request: TradeRequest): Promise<{
    valid: boolean;
    warnings: string[];
    errors: string[];
  }> {
    const warnings: string[] = [];
    const errors: string[] = [];

    try {
      // Validate basic schema
      TradeRequestSchema.parse(request);

      // Get current risk status
      const riskStatus = await this.getRiskStatus();

      // Check risk limits
      if (riskStatus.circuit_breaker_active) {
        errors.push('Circuit breaker is currently active');
      }

      if (riskStatus.position_count >= riskStatus.max_positions) {
        errors.push('Maximum position count reached');
      }

      if (riskStatus.daily_pnl <= riskStatus.max_daily_loss) {
        errors.push('Daily loss limit reached');
      }

      // Check trade amount
      if (request.tradeAmountUsd > 100000) { // Example limit
        warnings.push('Large trade amount detected');
      }

      // Chain-specific validations
      const chains = await this.getSupportedChains();
      const chainExists = chains.some(chain => chain.chain_id === request.chainId);

      if (!chainExists) {
        errors.push(`Unsupported chain: ${request.chainId}`);
      }

    } catch (error) {
      if (error instanceof z.ZodError) {
        errors.push(...error.errors.map(e => e.message));
      } else {
        errors.push('Validation failed');
      }
    }

    return {
      valid: errors.length === 0,
      warnings,
      errors,
    };
  }

  /**
   * Get estimated execution details for a trade
   */
  async getTradeEstimate(request: TradeRequest): Promise<{
    estimatedSlices: number;
    estimatedGas: string;
    estimatedTime: string;
    warnings: string[];
  }> {
    // This would typically call a dedicated estimate endpoint
    // For now, return mock data based on chain and amount
    const baseSlices = request.tradeAmountUsd > 1000 ? 3 : 1;
    const warnings: string[] = [];

    if (request.tradeAmountUsd > 50000) {
      warnings.push('Large trade may require multiple slices');
    }

    return {
      estimatedSlices: baseSlices,
      estimatedGas: '~0.01 ETH',
      estimatedTime: '~30 seconds',
      warnings,
    };
  }
}

// Configuration helper
export function createTradingEngineClient(config?: Partial<TradingEngineConfig>): TradingEngineClient {
  const baseConfig: TradingEngineConfig = {
    baseURL: process.env.NEXT_PUBLIC_TRADING_ENGINE_URL || 'http://localhost:8001',
    apiKey: process.env.TRADING_ENGINE_API_KEY,
    timeout: 30000,
    retries: 3,
    ...config,
  };

  return new TradingEngineClient(baseConfig);
}

// Default instance
export const tradingEngine = createTradingEngineClient();
