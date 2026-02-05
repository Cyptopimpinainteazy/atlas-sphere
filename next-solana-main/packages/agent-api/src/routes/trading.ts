/**
 * Trading routes for the agent API
 * Handles trade execution, status checking, and risk management
 */

import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { v4 as uuidv4 } from 'uuid';
import { tradingEngine } from '../../../../src/lib/trading-engine';
import { AgentCoordinationService } from '../AgentCoordinationService';

const router = Router();

// Validation schemas
const ExecuteTradeSchema = z.object({
  tokenAddress: z.string().regex(/^[A-Za-z0-9]{32,44}$/),
  chainId: z.enum(['solana', 'ethereum', 'base', 'polygon', 'bsc', 'arbitrum', 'optimism', 'pulsechain']),
  tradeAmountUsd: z.number().positive(),
  slippageOverride: z.number().min(0).max(100).optional(),
  routePreferences: z.record(z.unknown()).optional(),
  userPublicKey: z.string().optional(),
  strategyOverrides: z.record(z.unknown()).optional(),
});

const TradeStatusSchema = z.object({
  tradeId: z.string().uuid(),
});

const RiskStatusQuerySchema = z.object({
  includeHistory: z.string().transform(val => val === 'true').optional(),
});

// Types
interface AuthenticatedRequest extends Request {
  user?: {
    id: string;
    wallet_address?: string;
  };
}

// Middleware to check authentication
const requireAuth = (req: AuthenticatedRequest, res: Response, next: Function) => {
  if (!req.user?.id) {
    return res.status(401).json({ error: 'Authentication required' });
  }
  next();
};

// Rate limiting for trading endpoints
const rateLimitMap = new Map<string, { count: number; resetTime: number }>();

const checkRateLimit = (req: AuthenticatedRequest, res: Response, next: Function) => {
  const userId = req.user?.id || req.ip;
  const now = Date.now();
  const windowMs = 60 * 1000; // 1 minute
  const maxRequests = 10; // 10 requests per minute

  const userLimit = rateLimitMap.get(userId);

  if (!userLimit || now > userLimit.resetTime) {
    rateLimitMap.set(userId, { count: 1, resetTime: now + windowMs });
    next();
  } else if (userLimit.count < maxRequests) {
    userLimit.count++;
    next();
  } else {
    return res.status(429).json({
      error: 'Rate limit exceeded',
      retryAfter: Math.ceil((userLimit.resetTime - now) / 1000)
    });
  }
};

/**
 * POST /api/trading/execute
 * Execute a new trade
 */
router.post('/execute', requireAuth, checkRateLimit, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const validatedData = ExecuteTradeSchema.parse(req.body);

    // Validate trade parameters
    const validation = await tradingEngine.validateTradeParams(validatedData);

    if (!validation.valid) {
      return res.status(400).json({
        error: 'Trade validation failed',
        errors: validation.errors,
        warnings: validation.warnings
      });
    }

    // Get current risk status
    const riskStatus = await tradingEngine.getRiskStatus();

    // Check risk limits
    if (riskStatus.circuit_breaker_active) {
      return res.status(403).json({
        error: 'Trading disabled due to circuit breaker',
        reason: 'Circuit breaker is currently active'
      });
    }

    if (riskStatus.position_count >= riskStatus.max_positions) {
      return res.status(403).json({
        error: 'Maximum positions reached',
        current: riskStatus.position_count,
        maximum: riskStatus.max_positions
      });
    }

    if (riskStatus.daily_pnl <= riskStatus.max_daily_loss) {
      return res.status(403).json({
        error: 'Daily loss limit reached',
        current: riskStatus.daily_pnl,
        limit: riskStatus.max_daily_loss
      });
    }

    // Generate unique trade ID
    const tradeId = uuidv4();

    // Create database record (this would be handled by the job processor)
    // For now, we'll simulate the trade creation
    const tradeRecord = {
      id: tradeId,
      user_id: req.user?.id,
      token_address: validatedData.tokenAddress,
      chain_id: validatedData.chainId,
      trade_amount_usd: validatedData.tradeAmountUsd,
      status: 'pending' as const,
      tx_hashes: [],
      slices_completed: 0,
      total_slices: 1, // Will be updated by job processor
      risk_score: 0.5, // Will be calculated by risk manager
      strategy_used: 'advanced',
      created_at: new Date(),
      updated_at: new Date()
    };

    // Queue the trade job using AgentCoordinationService
    const jobData = {
      tradeId,
      userId: req.user?.id,
      ...validatedData,
      estimatedSlices: 1, // Will be updated by trading engine
    };

    // Add to job queue (this would typically use Bull/Redis)
    await AgentCoordinationService.getInstance().addJob('trading', 'execute-trade', jobData);

    // Log the trade initiation
    console.log(`Trade initiated: ${tradeId} for user ${req.user?.id} on ${validatedData.chainId}`);

    // Return immediate response
    res.status(202).json({
      success: true,
      tradeId,
      message: 'Trade queued for execution',
      estimatedSlices: 1,
      warnings: validation.warnings,
      status: 'pending'
    });

  } catch (error) {
    console.error('Trade execution error:', error);

    if (error instanceof z.ZodError) {
      return res.status(400).json({
        error: 'Invalid request data',
        details: error.errors
      });
    }

    res.status(500).json({
      error: 'Trade execution failed',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

/**
 * GET /api/trading/status/:tradeId
 * Get trade execution status
 */
router.get('/status/:tradeId', async (req: Request, res: Response) => {
  try {
    const { tradeId } = TradeStatusSchema.parse({ tradeId: req.params.tradeId });

    // This would typically query the database for trade status
    // For now, return mock data
    const mockTradeStatus = {
      tradeId,
      status: 'completed',
      tokenAddress: 'So11111111111111111111111111111111111111112',
      chainId: 'solana',
      tradeAmountUsd: 1000,
      slicesCompleted: 1,
      totalSlices: 1,
      txHashes: ['5xKTV...mock'],
      executedAt: new Date().toISOString(),
      pnl: 0, // Would be calculated from current price
      currentPrice: 0, // Would fetch current token price
      entryPrice: 0 // Would be stored during execution
    };

    res.json(mockTradeStatus);

  } catch (error) {
    console.error('Trade status error:', error);

    if (error instanceof z.ZodError) {
      return res.status(400).json({
        error: 'Invalid trade ID format'
      });
    }

    res.status(500).json({
      error: 'Failed to get trade status',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

/**
 * GET /api/trading/risk
 * Get current risk management status
 */
router.get('/risk', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { includeHistory } = RiskStatusQuerySchema.parse(req.query);

    // Get risk status from Python trading engine
    const riskStatus = await tradingEngine.getRiskStatus();

    // This would typically query the database for user's risk events
    const riskData = {
      ...riskStatus,
      userId: req.user?.id,
      timestamp: new Date().toISOString(),
      recommendations: generateRiskRecommendations(riskStatus),
      ...(includeHistory && {
        recentEvents: [] // Would fetch from risk_events table
      })
    };

    res.json(riskData);

  } catch (error) {
    console.error('Risk status error:', error);
    res.status(500).json({
      error: 'Failed to get risk status',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

/**
 * GET /api/trading/positions
 * Get user's open positions
 */
router.get('/positions', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    // This would typically query the positions table
    // For now, return mock data
    const mockPositions = [
      {
        id: 'pos_1',
        tradeId: 'trade_1',
        tokenAddress: 'So11111111111111111111111111111111111111112',
        chainId: 'solana',
        entryPrice: 100,
        currentPrice: 105,
        quantity: 10,
        pnlUsd: 50,
        pnlPercentage: 5,
        status: 'open',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      }
    ];

    res.json({
      positions: mockPositions,
      total: mockPositions.length,
      summary: {
        totalValue: 1050,
        totalPnl: 50,
        totalPnlPercentage: 4.76
      }
    });

  } catch (error) {
    console.error('Positions error:', error);
    res.status(500).json({
      error: 'Failed to get positions',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

/**
 * POST /api/trading/positions/:positionId/close
 * Close a specific position
 */
router.post('/positions/:positionId/close', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { positionId } = req.params;

    // Validate position belongs to user
    // This would check the database

    // Queue position close job
    await AgentCoordinationService.getInstance().addJob('trading', 'close-position', {
      positionId,
      userId: req.user?.id,
      closeReason: req.body.reason || 'manual'
    });

    res.json({
      success: true,
      message: 'Position close queued',
      positionId
    });

  } catch (error) {
    console.error('Position close error:', error);
    res.status(500).json({
      error: 'Failed to close position',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

/**
 * GET /api/trading/history
 * Get trading history with pagination
 */
router.get('/history', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const page = parseInt(req.query.page as string) || 1;
    const limit = Math.min(parseInt(req.query.limit as string) || 20, 100);
    const offset = (page - 1) * limit;

    // This would typically query the trades and positions tables
    // For now, return mock data
    const mockHistory = {
      trades: [],
      pagination: {
        page,
        limit,
        total: 0,
        pages: 0
      },
      summary: {
        totalTrades: 0,
        totalPnl: 0,
        winRate: 0,
        avgTradeSize: 0
      }
    };

    res.json(mockHistory);

  } catch (error) {
    console.error('Trading history error:', error);
    res.status(500).json({
      error: 'Failed to get trading history',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

/**
 * Generate risk management recommendations
 */
function generateRiskRecommendations(riskStatus: any): string[] {
  const recommendations: string[] = [];

  if (riskStatus.circuit_breaker_active) {
    recommendations.push('Circuit breaker is active - trading is disabled');
  }

  if (riskStatus.position_count >= riskStatus.max_positions * 0.8) {
    recommendations.push('Approaching maximum position limit - consider closing some positions');
  }

  if (riskStatus.daily_pnl <= riskStatus.max_daily_loss * 0.5) {
    recommendations.push('Daily losses are mounting - consider reducing position sizes');
  }

  if (riskStatus.losing_streak >= 3) {
    recommendations.push('Multiple consecutive losses detected - consider taking a break');
  }

  if (recommendations.length === 0) {
    recommendations.push('Risk metrics are within acceptable ranges');
  }

  return recommendations;
}

export default router;
