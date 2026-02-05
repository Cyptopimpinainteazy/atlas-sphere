import { config, getSupabaseConfig, isMockMode, logger } from './config'

// Real Supabase client (only import when not in mock mode)
let realSupabase: any = null

async function getRealSupabaseClient() {
  if (!realSupabase && !isMockMode()) {
    try {
      // Try to dynamically import Supabase - will fail gracefully if not installed
      let supabaseModule: any = null
      
      try {
        // Use eval to prevent TypeScript from trying to resolve the module at build time
        const moduleName = '@supabase/supabase-js'
        supabaseModule = await eval(`import('${moduleName}')`)
      } catch (importError) {
        logger.warn('Supabase client not available, install @supabase/supabase-js for production use')
        return null
      }
      
      if (!supabaseModule?.createClient) {
        logger.warn('Supabase createClient not available')
        return null
      }
      
      const supabaseConfig = getSupabaseConfig()
      
      if (supabaseConfig.url.includes('your-project') || supabaseConfig.anonKey.includes('your-')) {
        logger.warn('Supabase not properly configured, falling back to mock mode')
        return null
      }
      
      realSupabase = supabaseModule.createClient(supabaseConfig.url, supabaseConfig.anonKey)
      logger.info('Connected to Supabase')
    } catch (error) {
      logger.error('Failed to initialize Supabase client:', error)
      return null
    }
  }
  return realSupabase
}

// Mock client for development/demo
const mockSupabase = {
  from: (table: string) => ({
    select: (columns?: string) => ({
      order: (column: string, options?: any) => ({
        data: getMockData(table),
        error: null,
      }),
      eq: (column: string, value: any) => ({
        order: (column: string, options?: any) => ({
          data: getMockData(table),
          error: null,
        }),
        data: getMockData(table),
        error: null,
      }),
      gte: (column: string, value: any) => ({
        order: (column: string, options?: any) => ({
          data: getMockData(table),
          error: null,
        }),
        data: getMockData(table),
        error: null,
      }),
      limit: (count: number) => ({
        data: getMockData(table),
        error: null,
      }),
      data: getMockData(table),
      error: null,
    }),
    insert: (data: any) => ({
      select: () => ({
        single: () => ({
          data: { id: 'mock-id', ...data, created_at: new Date().toISOString() },
          error: null,
        }),
        data: [{ id: 'mock-id', ...data, created_at: new Date().toISOString() }],
        error: null,
      }),
      data: [{ id: 'mock-id', ...data, created_at: new Date().toISOString() }],
      error: null,
    }),
    update: (data: any) => ({
      eq: (column: string, value: any) => ({
        select: () => ({
          single: () => ({
            data: { id: value, ...data, updated_at: new Date().toISOString() },
            error: null,
          }),
          data: [{ id: value, ...data, updated_at: new Date().toISOString() }],
          error: null,
        }),
        data: [{ id: value, ...data, updated_at: new Date().toISOString() }],
        error: null,
      }),
    }),
  }),
  rpc: (functionName: string, params?: any) => ({
    data: getMockData('rpc_' + functionName),
    error: null,
  }),
}

function getMockData(table: string): any[] {
  const now = new Date().toISOString()
  
  switch (table) {
    case 'trading_pairs':
      return [
        { 
          id: '1', 
          token_a_mint: 'So11111111111111111111111111111111111111112',
          token_b_mint: 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v',
          token_a_symbol: 'SOL', 
          token_b_symbol: 'USDC', 
          fee_rate: 0.3,
          created_at: now,
          updated_at: now,
        },
        { 
          id: '2', 
          token_a_mint: '2FPyTwcZLUg1MDrwsyoP4D6s1tM7hAkHYRjkNb5w6Pxk',
          token_b_mint: 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v',
          token_a_symbol: 'ETH', 
          token_b_symbol: 'USDC', 
          fee_rate: 0.3,
          created_at: now,
          updated_at: now,
        },
      ]
    case 'liquidity_pools':
      return [
        { 
          id: '1', 
          pair_id: '1', 
          tvl: 25400000, 
          volume_24h: 142000000, 
          fees_24h: 426000,
          apy: 12.4,
          utilization: 78,
          created_at: now,
          updated_at: now,
        },
        { 
          id: '2', 
          pair_id: '2', 
          tvl: 18200000, 
          volume_24h: 98000000, 
          fees_24h: 294000,
          apy: 8.7,
          utilization: 65,
          created_at: now,
          updated_at: now,
        },
      ]
    case 'user_trades':
      return [
        { 
          id: '1', 
          user_wallet: 'mock-wallet-address',
          pair_id: '1', 
          trade_type: 'buy', 
          amount_in: 5.23, 
          amount_out: 511.73,
          price: 97.85,
          fee_amount: 1.54,
          slippage: 0.5,
          transaction_signature: 'mock-tx-signature',
          created_at: now,
        },
      ]
    case 'user_positions':
      return [
        {
          id: '1',
          user_wallet: 'mock-wallet-address',
          pool_id: '2',
          liquidity_amount: 1250,
          token_a_amount: 0.5,
          token_b_amount: 1425.67,
          fees_earned: 23.45,
          impermanent_loss: -2.34,
          created_at: now,
          updated_at: now,
        },
      ]
    case 'limit_orders':
      return [
        {
          id: '1',
          user_wallet: 'mock-wallet-address',
          pair_id: '1',
          order_type: 'buy',
          amount: 10.5,
          target_price: 95.0,
          current_price: 98.42,
          status: 'open',
          expiry_date: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
          created_at: now,
          updated_at: now,
        },
      ]
    case 'dca_orders':
      return [
        {
          id: '1',
          user_wallet: 'mock-wallet-address',
          pair_id: '1',
          amount_per_execution: 100,
          frequency: 'weekly',
          next_execution: new Date(Date.now() + 2 * 24 * 60 * 60 * 1000).toISOString(),
          total_invested: 2400,
          average_price: 89.23,
          executions_count: 24,
          status: 'active',
          created_at: now,
          updated_at: now,
        },
      ]
    case 'rpc_get_protocol_stats':
      return [
        {
          total_volume: 2400000000,
          total_tvl: 890000000,
          total_fees: 7200000,
          active_users: 42567,
          total_trades: 1200000,
          avg_trade_size: 2847,
        }
      ]
    case 'rpc_get_top_tokens_by_volume':
      return [
        { symbol: 'SOL', volume: 482000000, change: 8.5, price: 98.42, market_cap: 45200000000 },
        { symbol: 'ETH', volume: 324000000, change: 5.2, price: 2847, market_cap: 342100000000 },
        { symbol: 'BTC', volume: 298000000, change: 3.8, price: 43251, market_cap: 856700000000 },
      ]
    case 'rpc_get_top_pools_by_tvl':
      return [
        { pair: 'SOL/USDC', tvl: 25400000, volume: 142000000, fees: 426000, apy: 12.4, utilization: 78 },
        { pair: 'ETH/USDC', tvl: 18200000, volume: 98000000, fees: 294000, apy: 8.7, utilization: 65 },
      ]
    default:
      return []
  }
}

// Get the appropriate client based on configuration
export async function getSupabaseClient() {
  if (isMockMode()) {
    logger.debug('Using mock Supabase client')
    return mockSupabase
  }
  
  const client = await getRealSupabaseClient()
  if (!client) {
    logger.warn('Real Supabase client not available, falling back to mock')
    return mockSupabase
  }
  
  return client
}

// Export a proxy that automatically selects the right client
export const supabase = new Proxy({} as any, {
  get: (target, prop) => {
    // Return a function that gets the appropriate client and calls the method
    return async (...args: any[]) => {
      const client = await getSupabaseClient()
      const method = client[prop as string]
      if (typeof method === 'function') {
        return method.apply(client, args)
      }
      return method
    }
  },
})

// Database types for TypeScript
export interface TradingPair {
  id: string
  token_a_mint: string
  token_b_mint: string
  token_a_symbol: string
  token_b_symbol: string
  fee_rate: number
  created_at: string
  updated_at: string
}

export interface PriceHistory {
  id: string
  pair_id: string
  price: number
  volume_24h: number
  timestamp: string
}

export interface LiquidityPool {
  id: string
  pair_id: string
  tvl: number
  volume_24h: number
  fees_24h: number
  apy: number
  utilization: number
  created_at: string
  updated_at: string
}

export interface UserTrade {
  id: string
  user_wallet: string
  pair_id: string
  trade_type: 'buy' | 'sell'
  amount_in: number
  amount_out: number
  price: number
  fee_amount: number
  slippage: number
  transaction_signature: string
  created_at: string
}

export interface UserPosition {
  id: string
  user_wallet: string
  pool_id: string
  liquidity_amount: number
  token_a_amount: number
  token_b_amount: number
  fees_earned: number
  impermanent_loss: number
  created_at: string
  updated_at: string
}

export interface LimitOrder {
  id: string
  user_wallet: string
  pair_id: string
  order_type: 'buy' | 'sell'
  amount: number
  target_price: number
  current_price: number
  status: 'open' | 'filled' | 'cancelled' | 'expired'
  expiry_date?: string
  filled_amount?: number
  created_at: string
  updated_at: string
}

export interface DCAOrder {
  id: string
  user_wallet: string
  pair_id: string
  amount_per_execution: number
  frequency: 'daily' | 'weekly' | 'monthly'
  next_execution: string
  total_invested: number
  average_price: number
  executions_count: number
  status: 'active' | 'paused' | 'completed' | 'cancelled'
  created_at: string
  updated_at: string
}

// Service class for database operations
export class DatabaseService {
  private async getClient() {
    return await getSupabaseClient()
  }

  /**
   * Trading Pairs
   */
  async getTradingPairs(): Promise<TradingPair[]> {
    const client = await this.getClient()
    const { data, error } = await client.from('trading_pairs').select('*').order('volume_24h', { ascending: false })

    if (error) throw error
    return data || []
  }

  async createTradingPair(pair: Omit<TradingPair, 'id' | 'created_at' | 'updated_at'>): Promise<TradingPair> {
    const client = await this.getClient()
    const { data, error } = await client.from('trading_pairs').insert(pair).select().single()

    if (error) throw error
    return data
  }

  /**
   * Price History
   */
  async getPriceHistory(pairId: string, timeframe: string = '24h'): Promise<PriceHistory[]> {
    const client = await this.getClient()
    const { data, error } = await client
      .from('price_history')
      .select('*')
      .eq('pair_id', pairId)
      .gte('timestamp', this.getTimeframeStart(timeframe))
      .order('timestamp', { ascending: true })

    if (error) throw error
    return data || []
  }

  async addPricePoint(pricePoint: Omit<PriceHistory, 'id'>): Promise<PriceHistory> {
    const client = await this.getClient()
    const { data, error } = await client.from('price_history').insert(pricePoint).select().single()

    if (error) throw error
    return data
  }

  /**
   * Liquidity Pools
   */
  async getLiquidityPools(): Promise<LiquidityPool[]> {
    const client = await this.getClient()
    const { data, error } = await client
      .from('liquidity_pools')
      .select(
        `
        *,
        trading_pairs (
          token_a_symbol,
          token_b_symbol
        )
      `,
      )
      .order('tvl', { ascending: false })

    if (error) throw error
    return data || []
  }

  async updatePoolMetrics(poolId: string, metrics: Partial<LiquidityPool>): Promise<LiquidityPool> {
    const client = await this.getClient()
    const { data, error } = await client
      .from('liquidity_pools')
      .update({ ...metrics, updated_at: new Date().toISOString() })
      .eq('id', poolId)
      .select()
      .single()

    if (error) throw error
    return data
  }

  /**
   * User Trades
   */
  async getUserTrades(userWallet: string, limit: number = 50): Promise<UserTrade[]> {
    const client = await this.getClient()
    const { data, error } = await client
      .from('user_trades')
      .select(
        `
        *,
        trading_pairs (
          token_a_symbol,
          token_b_symbol
        )
      `,
      )
      .eq('user_wallet', userWallet)
      .order('created_at', { ascending: false })
      .limit(limit)

    if (error) throw error
    return data || []
  }

  async addUserTrade(trade: Omit<UserTrade, 'id' | 'created_at'>): Promise<UserTrade> {
    const client = await this.getClient()
    const { data, error } = await client
      .from('user_trades')
      .insert({ ...trade, created_at: new Date().toISOString() })
      .select()
      .single()

    if (error) throw error
    return data
  }

  /**
   * User Positions
   */
  async getUserPositions(userWallet: string): Promise<UserPosition[]> {
    const client = await this.getClient()
    const { data, error } = await client
      .from('user_positions')
      .select(
        `
        *,
        liquidity_pools (
          *,
          trading_pairs (
            token_a_symbol,
            token_b_symbol
          )
        )
      `,
      )
      .eq('user_wallet', userWallet)

    if (error) throw error
    return data || []
  }

  async updateUserPosition(positionId: string, updates: Partial<UserPosition>): Promise<UserPosition> {
    const client = await this.getClient()
    const { data, error } = await client
      .from('user_positions')
      .update({ ...updates, updated_at: new Date().toISOString() })
      .eq('id', positionId)
      .select()
      .single()

    if (error) throw error
    return data
  }

  /**
   * Limit Orders
   */
  async getUserLimitOrders(userWallet: string, status?: string): Promise<LimitOrder[]> {
    const client = await this.getClient()
    let query = client
      .from('limit_orders')
      .select(
        `
        *,
        trading_pairs (
          token_a_symbol,
          token_b_symbol
        )
      `,
      )
      .eq('user_wallet', userWallet)
      .order('created_at', { ascending: false })

    if (status) {
      query = query.eq('status', status)
    }

    const { data, error } = await query

    if (error) throw error
    return data || []
  }

  async createLimitOrder(order: Omit<LimitOrder, 'id' | 'created_at' | 'updated_at'>): Promise<LimitOrder> {
    const client = await this.getClient()
    const { data, error } = await client
      .from('limit_orders')
      .insert({ ...order, created_at: new Date().toISOString() })
      .select()
      .single()

    if (error) throw error
    return data
  }

  async updateLimitOrder(orderId: string, updates: Partial<LimitOrder>): Promise<LimitOrder> {
    const client = await this.getClient()
    const { data, error } = await client
      .from('limit_orders')
      .update({ ...updates, updated_at: new Date().toISOString() })
      .eq('id', orderId)
      .select()
      .single()

    if (error) throw error
    return data
  }

  /**
   * DCA Orders
   */
  async getUserDCAOrders(userWallet: string, status?: string): Promise<DCAOrder[]> {
    const client = await this.getClient()
    let query = client
      .from('dca_orders')
      .select(
        `
        *,
        trading_pairs (
          token_a_symbol,
          token_b_symbol
        )
      `,
      )
      .eq('user_wallet', userWallet)
      .order('created_at', { ascending: false })

    if (status) {
      query = query.eq('status', status)
    }

    const { data, error } = await query

    if (error) throw error
    return data || []
  }

  async createDCAOrder(order: Omit<DCAOrder, 'id' | 'created_at' | 'updated_at'>): Promise<DCAOrder> {
    const client = await this.getClient()
    const { data, error } = await client
      .from('dca_orders')
      .insert({ ...order, created_at: new Date().toISOString() })
      .select()
      .single()

    if (error) throw error
    return data
  }

  async updateDCAOrder(orderId: string, updates: Partial<DCAOrder>): Promise<DCAOrder> {
    const client = await this.getClient()
    const { data, error } = await client
      .from('dca_orders')
      .update({ ...updates, updated_at: new Date().toISOString() })
      .eq('id', orderId)
      .select()
      .single()

    if (error) throw error
    return data
  }

  /**
   * Analytics
   */
  async getProtocolStats(): Promise<any> {
    const client = await this.getClient()
    const { data, error } = await client.rpc('get_protocol_stats')

    if (error) throw error
    return data
  }

  async getTopTokensByVolume(limit: number = 10): Promise<any[]> {
    const client = await this.getClient()
    const { data, error } = await client.rpc('get_top_tokens_by_volume', { limit_count: limit })

    if (error) throw error
    return data || []
  }

  async getTopPoolsByTVL(limit: number = 10): Promise<any[]> {
    const client = await this.getClient()
    const { data, error } = await client.rpc('get_top_pools_by_tvl', { limit_count: limit })

    if (error) throw error
    return data || []
  }

  /**
   * Utility methods
   */
  private getTimeframeStart(timeframe: string): string {
    const now = new Date()
    switch (timeframe) {
      case '1h':
        return new Date(now.getTime() - 60 * 60 * 1000).toISOString()
      case '24h':
        return new Date(now.getTime() - 24 * 60 * 60 * 1000).toISOString()
      case '7d':
        return new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000).toISOString()
      case '30d':
        return new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000).toISOString()
      default:
        return new Date(now.getTime() - 24 * 60 * 60 * 1000).toISOString()
    }
  }
}

export const dbService = new DatabaseService()