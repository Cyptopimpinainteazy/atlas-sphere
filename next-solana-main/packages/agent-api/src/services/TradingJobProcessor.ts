/**
 * Trading Job Processor
 * Handles asynchronous trade execution using Bull queue system
 */

import { Job, DoneCallback } from 'bull';
import { tradingEngine, TradeRequest, TradeResponse } from '../../../lib/trading-engine';
import { AgentCoordinationService } from '../AgentCoordinationService';

export interface TradingJobData {
  tradeId: string;
  userId: string;
  tokenAddress: string;
  chainId: string;
  tradeAmountUsd: number;
  slippageOverride?: number;
  routePreferences?: Record<string, unknown>;
  userPublicKey?: string;
  strategyOverrides?: Record<string, unknown>;
  estimatedSlices: number;
}

export interface PositionCloseJobData {
  positionId: string;
  userId: string;
  closeReason: string;
}

export class TradingJobProcessor {
  private static instance: TradingJobProcessor;
  private agentCoordination: AgentCoordinationService;

  private constructor() {
    this.agentCoordination = AgentCoordinationService.getInstance();
  }

  public static getInstance(): TradingJobProcessor {
    if (!TradingJobProcessor.instance) {
      TradingJobProcessor.instance = new TradingJobProcessor();
    }
    return TradingJobProcessor.instance;
  }

  /**
   * Process trade execution job
   */
  async processTrade(job: Job<TradingJobData>, done: DoneCallback): Promise<void> {
    const startTime = Date.now();
    console.log(`[TradingJobProcessor] Processing trade ${job.data.tradeId}`);

    try {
      // Update job progress
      job.progress(10);

      // Validate job data
      this.validateTradeJobData(job.data);

      // Prepare trade request for Python engine
      const tradeRequest: TradeRequest = {
        tokenAddress: job.data.tokenAddress,
        chainId: job.data.chainId as any,
        tradeAmountUsd: job.data.tradeAmountUsd,
        slippageOverride: job.data.slippageOverride,
        routePreferences: job.data.routePreferences,
        userPublicKey: job.data.userPublicKey,
        strategyOverrides: job.data.strategyOverrides,
      };

      job.progress(30);

      // Execute trade through Python trading engine
      const tradeResult: TradeResponse = await tradingEngine.executeTrade(tradeRequest);

      job.progress(60);

      // Process the result
      await this.processTradeResult(job.data, tradeResult);

      job.progress(90);

      // Update job with final status
      const executionTime = Date.now() - startTime;
      job.progress(100);

      console.log(`[TradingJobProcessor] Trade ${job.data.tradeId} completed in ${executionTime}ms`);

      done(null, {
        success: true,
        tradeId: job.data.tradeId,
        txHashes: tradeResult.txHashes,
        executionTime,
        slices: tradeResult.estimatedSlices
      });

    } catch (error) {
      console.error(`[TradingJobProcessor] Trade ${job.data.tradeId} failed:`, error);

      // Update job with failure status
      await this.handleTradeFailure(job.data, error);

      done(error as Error);
    }
  }

  /**
   * Process position close job
   */
  async processPositionClose(job: Job<PositionCloseJobData>, done: DoneCallback): Promise<void> {
    console.log(`[TradingJobProcessor] Processing position close ${job.data.positionId}`);

    try {
      // Validate position belongs to user
      await this.validatePositionOwnership(job.data);

      // Get current position details
      const position = await this.getPositionDetails(job.data.positionId);

      if (!position) {
        throw new Error(`Position ${job.data.positionId} not found`);
      }

      // Create sell trade for the position
      const sellTradeRequest: TradeRequest = {
        tokenAddress: position.token_address,
        chainId: position.chain_id as any,
        tradeAmountUsd: position.quantity * position.current_price, // Sell entire position
        userPublicKey: job.data.userId, // This would be the user's wallet
        strategyOverrides: {
          action: 'sell',
          reason: job.data.closeReason
        }
      };

      // Execute sell trade
      const sellResult = await tradingEngine.executeTrade(sellTradeRequest);

      // Update position status to closed
      await this.updatePositionStatus(job.data.positionId, 'closed', sellResult.txHashes);

      // Log position close event
      console.log(`[TradingJobProcessor] Position ${job.data.positionId} closed successfully`);

      done(null, {
        success: true,
        positionId: job.data.positionId,
        txHashes: sellResult.txHashes,
        closeReason: job.data.closeReason
      });

    } catch (error) {
      console.error(`[TradingJobProcessor] Position close ${job.data.positionId} failed:`, error);
      done(error as Error);
    }
  }

  /**
   * Process trade result and update database
   */
  private async processTradeResult(jobData: TradingJobData, tradeResult: TradeResponse): Promise<void> {
    // This would typically update the database with trade results
    // For now, we'll simulate the database operations

    console.log(`[TradingJobProcessor] Processing trade result for ${jobData.tradeId}`);

    // Update trade record with completion status
    const tradeUpdate = {
      id: jobData.tradeId,
      status: tradeResult.success ? 'completed' : 'failed',
      tx_hashes: tradeResult.txHashes,
      slices_completed: tradeResult.estimatedSlices,
      total_slices: tradeResult.estimatedSlices,
      updated_at: new Date()
    };

    // If trade successful, create position record
    if (tradeResult.success && tradeResult.txHashes.length > 0) {
      const positionRecord = {
        id: `pos_${jobData.tradeId}`,
        trade_id: jobData.tradeId,
        token_address: jobData.tokenAddress,
        chain_id: jobData.chainId,
        entry_price: 0, // Would be calculated from execution
        current_price: 0, // Would fetch current price
        quantity: jobData.tradeAmountUsd, // Would be calculated from execution
        pnl_usd: 0,
        pnl_percentage: 0,
        status: 'open',
        created_at: new Date(),
        updated_at: new Date()
      };

      // Simulate database operations
      console.log(`[TradingJobProcessor] Created position record: ${positionRecord.id}`);
    }

    // Update daily P&L tracking
    await this.updateDailyPnL(jobData.userId, tradeResult);

    // Check if risk events should be triggered
    await this.checkRiskEvents(jobData, tradeResult);
  }

  /**
   * Handle trade execution failure
   */
  private async handleTradeFailure(jobData: TradingJobData, error: any): Promise<void> {
    console.log(`[TradingJobProcessor] Handling trade failure for ${jobData.tradeId}`);

    // Update trade record with failure status
    const tradeUpdate = {
      id: jobData.tradeId,
      status: 'failed',
      updated_at: new Date(),
      error_message: error.message || 'Unknown error'
    };

    // Create risk event for failed trade
    await this.createRiskEvent({
      user_id: jobData.userId,
      event_type: 'trade_execution_failed',
      severity: 'medium',
      message: `Trade ${jobData.tradeId} failed: ${error.message}`,
      triggered_by: 'trading_engine',
      event_data: {
        tradeId: jobData.tradeId,
        tokenAddress: jobData.tokenAddress,
        chainId: jobData.chainId,
        amount: jobData.tradeAmountUsd,
        error: error.message
      }
    });
  }

  /**
   * Validate trade job data
   */
  private validateTradeJobData(data: TradingJobData): void {
    if (!data.tradeId) {
      throw new Error('Trade ID is required');
    }
    if (!data.userId) {
      throw new Error('User ID is required');
    }
    if (!data.tokenAddress) {
      throw new Error('Token address is required');
    }
    if (!data.chainId) {
      throw new Error('Chain ID is required');
    }
    if (!data.tradeAmountUsd || data.tradeAmountUsd <= 0) {
      throw new Error('Valid trade amount is required');
    }
  }

  /**
   * Validate position ownership
   */
  private async validatePositionOwnership(data: PositionCloseJobData): Promise<void> {
    // This would query the database to ensure the position belongs to the user
    // For now, we'll simulate this check
    console.log(`[TradingJobProcessor] Validating ownership for position ${data.positionId} by user ${data.userId}`);
  }

  /**
   * Get position details from database
   */
  private async getPositionDetails(positionId: string): Promise<any> {
    // This would query the positions table
    // For now, return mock data
    return {
      id: positionId,
      token_address: 'So11111111111111111111111111111111111111112',
      chain_id: 'solana',
      quantity: 10,
      current_price: 100
    };
  }

  /**
   * Update position status in database
   */
  private async updatePositionStatus(positionId: string, status: string, txHashes: string[]): Promise<void> {
    // This would update the positions table
    console.log(`[TradingJobProcessor] Updated position ${positionId} status to ${status}`);
  }

  /**
   * Update daily P&L tracking
   */
  private async updateDailyPnL(userId: string, tradeResult: TradeResponse): Promise<void> {
    // This would update the daily_pnl table
    console.log(`[TradingJobProcessor] Updated daily P&L for user ${userId}`);
  }

  /**
   * Check if risk events should be triggered
   */
  private async checkRiskEvents(jobData: TradingJobData, tradeResult: TradeResponse): Promise<void> {
    // This would check various risk conditions and create risk events if needed
    console.log(`[TradingJobProcessor] Checking risk events for trade ${jobData.tradeId}`);
  }

  /**
   * Create risk event record
   */
  private async createRiskEvent(eventData: any): Promise<void> {
    // This would insert into the risk_events table
    console.log(`[TradingJobProcessor] Created risk event: ${eventData.event_type}`);
  }

  /**
   * Retry failed job with exponential backoff
   */
  async retryJob(job: Job, done: DoneCallback, maxRetries: number = 3): Promise<void> {
    const attempt = job.attemptsMade + 1;

    if (attempt > maxRetries) {
      console.error(`[TradingJobProcessor] Job ${job.id} failed after ${maxRetries} attempts`);
      done(new Error(`Job failed after ${maxRetries} attempts`));
      return;
    }

    // Calculate delay with exponential backoff
    const delay = Math.min(1000 * Math.pow(2, attempt - 1), 30000); // Max 30 seconds

    console.log(`[TradingJobProcessor] Retrying job ${job.id} in ${delay}ms (attempt ${attempt}/${maxRetries})`);

    setTimeout(() => {
      job.retry();
    }, delay);
  }

  /**
   * Clean up old completed jobs
   */
  async cleanupCompletedJobs(): Promise<void> {
    // This would remove old completed/failed jobs from the queue
    console.log('[TradingJobProcessor] Cleaning up old completed jobs');
  }

  /**
   * Get job statistics
   */
  async getJobStats(): Promise<{
    waiting: number;
    active: number;
    completed: number;
    failed: number;
    delayed: number;
  }> {
    // This would get statistics from the Bull queue
    return {
      waiting: 0,
      active: 0,
      completed: 0,
      failed: 0,
      delayed: 0
    };
  }
}

// Export singleton instance
export const tradingJobProcessor = TradingJobProcessor.getInstance();
