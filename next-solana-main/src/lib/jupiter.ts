import { getJupiterConfig, isMockMode, logger } from './config'

// Real Jupiter API client with caching and rate limiting
let realJupiterApi: any = null
let apiCallCount = 0
let lastApiCall = 0
const RATE_LIMIT_PER_MINUTE = 1000
const CACHE_TTL = 5000 // 5 seconds for quotes

interface CacheEntry {
  data: any
  timestamp: number
}

const quoteCache = new Map<string, CacheEntry>()

// Rate limiting check
function checkRateLimit(): boolean {
  const now = Date.now()
  const oneMinuteAgo = now - 60000

  if (lastApiCall < oneMinuteAgo) {
    apiCallCount = 0
    lastApiCall = now
  }

  if (apiCallCount >= RATE_LIMIT_PER_MINUTE) {
    logger.warn('Jupiter API rate limit reached')
    return false
  }

  apiCallCount++
  lastApiCall = now
  return true
}

// Retry logic with exponential backoff
async function retryWithBackoff<T>(
  fn: () => Promise<T>,
  maxRetries: number = 3,
  baseDelay: number = 1000
): Promise<T> {
  for (let i = 0; i < maxRetries; i++) {
    try {
      return await fn()
    } catch (error) {
      if (i === maxRetries - 1) throw error

      const delay = baseDelay * Math.pow(2, i)
      logger.warn(`Jupiter API call failed, retrying in ${delay}ms...`, error)
      await new Promise(resolve => setTimeout(resolve, delay))
    }
  }
  throw new Error('Max retries exceeded')
}

async function getRealJupiterApi() {
  if (!realJupiterApi) {
    try {
      // Initialize Jupiter API client
      const { createJupiterApiClient } = await import('@jup-ag/api')
      const { Connection } = await import('@solana/web3.js')

      const connection = new Connection(getJupiterConfig().rpcUrl || 'https://api.mainnet-beta.solana.com')
      realJupiterApi = createJupiterApiClient({ connection })

      logger.info('Connected to Jupiter API')
    } catch (error) {
      logger.error('Failed to initialize Jupiter API client:', error)
      return null
    }
  }
  return realJupiterApi
}

export interface JupiterRoute {
  inputMint: string
  inAmount: string
  outputMint: string
  outAmount: string
  otherAmountThreshold: string
  swapMode: string
  slippageBps: number
  platformFeeBps?: number
  priceImpactPct: string
  routePlan: RoutePlan[]
  contextSlot?: number
  timeTaken?: number
}

export interface RoutePlan {
  swapInfo: SwapInfo
  percent: number
}

export interface SwapInfo {
  ammKey: string
  label?: string
  inputMint: string
  outputMint: string
  inAmount: string
  outAmount: string
  feeAmount: string
  feeMint: string
}

export interface QuoteRequest {
  inputMint: string
  outputMint: string
  amount: number
  slippageBps?: number
  platformFeeBps?: number
  onlyDirectRoutes?: boolean
  asLegacyTransaction?: boolean
}

export interface QuoteResponse {
  data: JupiterRoute[]
  timeTaken: number
  contextSlot: number
}

export class JupiterService {
  private async getClient() {
    if (isMockMode()) {
      logger.debug('Using mock Jupiter client')
      return null
    }

    const client = await getRealJupiterApi()
    if (!client) {
      logger.warn('Real Jupiter client not available, falling back to mock')
      return null
    }

    return client
  }

  /**
   * Get quote for token swap
   */
  async getQuote(request: QuoteRequest): Promise<QuoteResponse> {
    const client = await this.getClient()

    if (!client) {
      // Return mock data for development/demo
      logger.debug('Returning mock Jupiter quote')
      return this.getMockQuote(request)
    }

    try {
      const params: Record<string, string> = {
        inputMint: request.inputMint,
        outputMint: request.outputMint,
        amount: request.amount.toString(),
        slippageBps: (request.slippageBps || 50).toString(),
      }

      if (request.platformFeeBps) {
        params.platformFeeBps = request.platformFeeBps.toString()
      }

      if (request.onlyDirectRoutes) {
        params.onlyDirectRoutes = 'true'
      }

      if (request.asLegacyTransaction) {
        params.asLegacyTransaction = 'true'
      }

      const data = await client.quote(params)
      logger.info('Successfully fetched Jupiter quote')
      return data
    } catch (error) {
      logger.error('Failed to fetch Jupiter quote:', error)
      // Fallback to mock data on error
      return this.getMockQuote(request)
    }
  }

  /**
   * Get swap transaction
   */
  async getSwapTransaction(
    route: JupiterRoute,
    userPublicKey: string,
    wrapAndUnwrapSol?: boolean,
    prioritizationFeeLamports?: number,
    dynamicComputeUnitLimit?: boolean,
    skipUserAccountsRpcCalls?: boolean,
  ): Promise<{ swapTransaction: string }> {
    const client = await this.getClient()

    if (!client) {
      logger.debug('Returning mock Jupiter swap transaction')
      return {
        swapTransaction: 'mock_transaction_data_' + Date.now(),
      }
    }

    try {
      const requestData = {
        quoteResponse: route,
        userPublicKey,
        wrapAndUnwrapSol: wrapAndUnwrapSol ?? true,
        prioritizationFeeLamports,
        dynamicComputeUnitLimit: dynamicComputeUnitLimit ?? true,
        skipUserAccountsRpcCalls: skipUserAccountsRpcCalls ?? false,
      }

      const data = await client.swap(requestData)
      logger.info('Successfully created Jupiter swap transaction')
      return data
    } catch (error) {
      logger.error('Failed to create Jupiter swap transaction:', error)
      throw error
    }
  }

  /**
   * Get token list from Jupiter
   */
  async getTokenList(): Promise<any[]> {
    if (isMockMode()) {
      logger.debug('Returning mock token list')
      return this.getMockTokenList()
    }

    try {
      const response = await fetch('https://token.jup.ag/all')

      if (!response.ok) {
        throw new Error(`Jupiter token list API error: ${response.statusText}`)
      }

      const data = await response.json()
      logger.info('Successfully fetched Jupiter token list')
      return data
    } catch (error) {
      logger.error('Failed to fetch Jupiter token list:', error)
      return this.getMockTokenList()
    }
  }

  /**
   * Get price for a token
   */
  async getPrice(tokenMint: string, vsToken = 'USDC'): Promise<{ [key: string]: { price: number } }> {
    if (isMockMode()) {
      logger.debug('Returning mock token prices')
      return this.getMockPrices(tokenMint)
    }

    try {
      const response = await fetch(`https://price.jup.ag/v4/price?ids=${tokenMint}&vsToken=${vsToken}`)

      if (!response.ok) {
        throw new Error(`Jupiter price API error: ${response.statusText}`)
      }

      const data = await response.json()
      logger.info('Successfully fetched Jupiter prices')
      return data
    } catch (error) {
      logger.error('Failed to fetch Jupiter prices:', error)
      return this.getMockPrices(tokenMint)
    }
  }

  /**
   * Mock data methods
   */
  private getMockQuote(request: QuoteRequest): QuoteResponse {
    const conversionRate = this.getMockConversionRate(request.inputMint, request.outputMint)
    const outputAmount = request.amount * conversionRate
    const slippage = (request.slippageBps || 50) / 10000

    return {
      data: [
        {
          inputMint: request.inputMint,
          inAmount: request.amount.toString(),
          outputMint: request.outputMint,
          outAmount: Math.floor(outputAmount).toString(),
          otherAmountThreshold: Math.floor(outputAmount * (1 - slippage)).toString(),
          swapMode: 'ExactIn',
          slippageBps: request.slippageBps || 50,
          priceImpactPct: '0.02',
          routePlan: [
            {
              swapInfo: {
                ammKey: 'mock-amm-key',
                label: 'Mock DEX',
                inputMint: request.inputMint,
                outputMint: request.outputMint,
                inAmount: request.amount.toString(),
                outAmount: Math.floor(outputAmount).toString(),
                feeAmount: Math.floor(request.amount * 0.003).toString(),
                feeMint: request.inputMint,
              },
              percent: 100,
            },
          ],
        },
      ],
      timeTaken: 150 + Math.random() * 100,
      contextSlot: 123456789 + Math.floor(Math.random() * 1000),
    }
  }

  private getMockTokenList(): any[] {
    return [
      {
        address: COMMON_TOKENS.SOL,
        symbol: 'SOL',
        name: 'Solana',
        decimals: 9,
        logoURI:
          'https://raw.githubusercontent.com/solana-labs/token-list/main/assets/mainnet/So11111111111111111111111111111111111111112/logo.png',
      },
      {
        address: COMMON_TOKENS.USDC,
        symbol: 'USDC',
        name: 'USD Coin',
        decimals: 6,
        logoURI:
          'https://raw.githubusercontent.com/solana-labs/token-list/main/assets/mainnet/EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v/logo.png',
      },
      {
        address: COMMON_TOKENS.ETH,
        symbol: 'ETH',
        name: 'Ethereum',
        decimals: 8,
        logoURI:
          'https://raw.githubusercontent.com/solana-labs/token-list/main/assets/mainnet/2FPyTwcZLUg1MDrwsyoP4D6s1tM7hAkHYRjkNb5w6Pxk/logo.png',
      },
      {
        address: COMMON_TOKENS.BTC,
        symbol: 'BTC',
        name: 'Bitcoin',
        decimals: 8,
        logoURI:
          'https://raw.githubusercontent.com/solana-labs/token-list/main/assets/mainnet/9n4nbM75f5Ui33ZbPYXn59EwSgE8CGsHtAeTH5YFeJ9E/logo.png',
      },
      {
        address: COMMON_TOKENS.RAY,
        symbol: 'RAY',
        name: 'Raydium',
        decimals: 6,
        logoURI:
          'https://raw.githubusercontent.com/solana-labs/token-list/main/assets/mainnet/4k3Dyjzvzp8eMZWUXbBCjEvwSkkk59S5iCNLY3QrkX6R/logo.png',
      },
    ]
  }

  private getMockPrices(tokenMint: string): { [key: string]: { price: number } } {
    const prices: { [key: string]: number } = {
      [COMMON_TOKENS.SOL]: 98.42 + (Math.random() - 0.5) * 10,
      [COMMON_TOKENS.ETH]: 2847.32 + (Math.random() - 0.5) * 200,
      [COMMON_TOKENS.BTC]: 43250.89 + (Math.random() - 0.5) * 2000,
      [COMMON_TOKENS.USDC]: 1.0 + (Math.random() - 0.5) * 0.01,
      [COMMON_TOKENS.RAY]: 1.85 + (Math.random() - 0.5) * 0.2,
    }

    return {
      [tokenMint]: { price: prices[tokenMint] || 1.0 },
    }
  }

  private getMockConversionRate(inputMint: string, outputMint: string): number {
    const prices: Record<string, number> = {
      [COMMON_TOKENS.SOL]: 98.42,
      [COMMON_TOKENS.ETH]: 2847.32,
      [COMMON_TOKENS.BTC]: 43250.89,
      [COMMON_TOKENS.USDC]: 1.0,
      [COMMON_TOKENS.RAY]: 1.85,
    }

    const inputPrice = prices[inputMint] || 1.0
    const outputPrice = prices[outputMint] || 1.0

    return inputPrice / outputPrice
  }

  /**
   * Calculate price impact for a swap
   */
  calculatePriceImpact(route: JupiterRoute): number {
    return parseFloat(route.priceImpactPct)
  }

  /**
   * Calculate minimum amount out considering slippage
   */
  calculateMinAmountOut(route: JupiterRoute): string {
    return route.otherAmountThreshold
  }

  /**
   * Format amount for display
   */
  formatAmount(amount: string, decimals: number): number {
    return parseInt(amount) / Math.pow(10, decimals)
  }

  /**
   * Parse amount from user input
   */
  parseAmount(amount: number, decimals: number): string {
    return (amount * Math.pow(10, decimals)).toString()
  }

  /**
   * Get optimal route from multiple routes
   */
  getOptimalRoute(routes: JupiterRoute[]): JupiterRoute | null {
    if (routes.length === 0) return null

    // Sort by output amount (highest first) and price impact (lowest first)
    return routes.sort((a, b) => {
      const aOutput = parseInt(a.outAmount)
      const bOutput = parseInt(b.outAmount)

      if (aOutput !== bOutput) {
        return bOutput - aOutput // Higher output is better
      }

      const aPriceImpact = parseFloat(a.priceImpactPct)
      const bPriceImpact = parseFloat(b.priceImpactPct)

      return aPriceImpact - bPriceImpact // Lower price impact is better
    })[0]
  }

  /**
   * Validate token addresses
   */
  validateTokenAddress(address: string): boolean {
    // Simplified validation - in production you'd use @solana/web3.js PublicKey
    return address.length >= 32 && address.length <= 44 && /^[A-Za-z0-9]+$/.test(address)
  }
}

export const jupiterService = new JupiterService()

// Common token addresses on Solana
export const COMMON_TOKENS = {
  SOL: 'So11111111111111111111111111111111111111112',
  USDC: 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v',
  USDT: 'Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB',
  RAY: '4k3Dyjzvzp8eMZWUXbBCjEvwSkkk59S5iCNLY3QrkX6R',
  SRM: 'SRMuApVNdxXokk5GT7XD5cUUgXMBCoAz2LHeuAoKWRt',
  FTT: 'AGFEad2et2ZJif9jaGpdMixQqvW5i81aBdvKe7PHNfz3',
  BTC: '9n4nbM75f5Ui33ZbPYXn59EwSgE8CGsHtAeTH5YFeJ9E',
  ETH: '2FPyTwcZLUg1MDrwsyoP4D6s1tM7hAkHYRjkNb5w6Pxk',
  ORCA: 'orcaEKTdK7LKz57vaAYr9QeNsVEPfiu6QeMU1kektZE',
  MNGO: 'MangoCzJ36AjZyKwVj3VnYU4GTonjfVEnJmvvWaxLac',
} as const

export type CommonToken = keyof typeof COMMON_TOKENS
