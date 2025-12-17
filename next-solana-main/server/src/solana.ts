// Main Solana DEX Framework Configuration
// This file demonstrates how the DEX services integrate with the application

// Type definitions
type DEXName = 'jupiter' | 'raydium' | 'aldrin' | 'saber' | 'lifinity' | 'invariant' | 'cropper' | 'soldex' | 'atrix'
type CommitmentLevel = 'confirmed' | 'finalized' | 'processed'
type ConnectionOptions = CommitmentLevel | { commitment?: CommitmentLevel }

import winston from 'winston'
import { Connection } from '@solana/web3.js'

// Placeholder service classes - in real implementation these would be imported
interface DEXService {
  initialize(): Promise<void>
  shutdown?(): Promise<void>
}

// RPC Connection Manager with Automatic Failover
export class SolanaRpcManager {
  private rpcUrls: string[]
  private currentIndex: number
  private connection: Connection | null
  private logger: winston.Logger
  private checkInterval: NodeJS.Timeout | null
  private isSwitching: boolean
  private connectionOptions: ConnectionOptions | undefined

  constructor(rpcUrlsString: string | undefined, logger: winston.Logger, connectionOptions?: ConnectionOptions) {
    this.logger = logger
    this.rpcUrls = this.parseRpcUrls(rpcUrlsString)
    this.currentIndex = 0
    this.connection = null
    this.checkInterval = null
    this.isSwitching = false
    this.connectionOptions = connectionOptions

    // Initialize with first RPC URL
    this.initializeConnection(connectionOptions)
  }

  private parseRpcUrls(rpcUrlsString: string | undefined): string[] {
    const defaultUrl = 'https://api.mainnet-beta.solana.com'

    if (!rpcUrlsString || rpcUrlsString.trim() === '') {
      this.logger.warn('No SOLANA_RPC_URLS provided, using default URL')
      return [defaultUrl]
    }

    try {
      const urls = rpcUrlsString
        .split(',')
        .map((url) => url.trim())
        .filter((url) => url.length > 0)

      // Validate each URL using URL constructor
      const validUrls: string[] = []
      for (const url of urls) {
        try {
          new URL(url)
          validUrls.push(url)
        } catch (error) {
          this.logger.warn(`Invalid URL format: ${url}, excluding from RPC list`)
        }
      }

      // Deduplicate the list
      const uniqueUrls = [...new Set(validUrls)]

      if (uniqueUrls.length === 0) {
        this.logger.warn('No valid RPC URLs provided, using default URL')
        return [defaultUrl]
      }

      return uniqueUrls
    } catch (error) {
      this.logger.error('Error parsing SOLANA_RPC_URLS, using default URL:', error)
      return [defaultUrl]
    }
  }

  private async initializeConnection(options: ConnectionOptions = 'confirmed'): Promise<void> {
    // Store the connection options as a class property for consistency
    this.connectionOptions = options
    const currentUrl = this.rpcUrls[this.currentIndex]
    try {
      // Create connection with proper type handling
      const connectionConfig =
        typeof this.connectionOptions === 'string'
          ? { commitment: this.connectionOptions as CommitmentLevel }
          : this.connectionOptions
      this.connection = new Connection(currentUrl, connectionConfig)
      this.logger.info(`✅ Initialized Solana connection to ${currentUrl}`)

      // Start health checking
      this.startHealthCheck()
    } catch (error) {
      this.logger.error(`Failed to initialize connection to ${currentUrl}:`, error)
      await this.switchToNextRpc()
    }
  }

  private async switchToNextRpc(): Promise<void> {
    // Check if a switch is already in progress
    if (this.isSwitching) {
      this.logger.debug('Switch already in progress, skipping concurrent call')
      return
    }

    // Set flag to prevent overlapping calls
    this.isSwitching = true
    let nextUrl: string = ''

    try {
      this.currentIndex = (this.currentIndex + 1) % this.rpcUrls.length
      nextUrl = this.rpcUrls[this.currentIndex]
      this.logger.warn(`Switching to next RPC URL: ${nextUrl}`)

      // Use stored connection options for consistency with proper type handling
      const connectionConfig = this.connectionOptions
        ? typeof this.connectionOptions === 'string'
          ? { commitment: this.connectionOptions as CommitmentLevel }
          : this.connectionOptions
        : { commitment: 'confirmed' as CommitmentLevel }
      this.connection = new Connection(nextUrl, connectionConfig)
      this.logger.info(`✅ Successfully switched to ${nextUrl}`)
    } catch (error) {
      this.logger.error(`Failed to switch to ${nextUrl}:`, error)
      // If all URLs fail, keep trying with exponential backoff
      setTimeout(() => this.switchToNextRpc(), 5000)
    } finally {
      // Reset flag after switch completes or fails
      this.isSwitching = false
    }
  }

  private startHealthCheck(): void {
    // Health check every 30 seconds
    this.checkInterval = setInterval(async () => {
      if (this.connection) {
        try {
          // Simple health check - get recent blockhash
          await this.connection.getLatestBlockhash()
        } catch (error) {
          this.logger.warn(`RPC health check failed for ${this.rpcUrls[this.currentIndex]}:`, error)
          await this.switchToNextRpc()
        }
      }
    }, 30000)
  }

  public getConnection(): Connection {
    if (!this.connection) {
      throw new Error('No active Solana connection available')
    }
    return this.connection
  }

  public getCurrentRpcUrl(): string {
    return this.rpcUrls[this.currentIndex]
  }

  public getAllRpcUrls(): string[] {
    return [...this.rpcUrls]
  }

  public async manualFailover(forceSwitch: boolean = false): Promise<boolean> {
    if (this.rpcUrls.length <= 1) {
      this.logger.info('Only one RPC URL configured, no failover possible')
      return false
    }

    if (forceSwitch) {
      await this.switchToNextRpc()
      return true
    } else {
      // Test current connection first
      if (this.connection) {
        try {
          await this.connection.getLatestBlockhash()
          this.logger.info('Current RPC connection is healthy')
          return false
        } catch (error) {
          await this.switchToNextRpc()
          return true
        }
      }
      return false
    }
  }

  public cleanup(): void {
    if (this.checkInterval) {
      clearInterval(this.checkInterval)
      this.checkInterval = null
    }
    this.connection = null
  }
}

// Main Solana configuration
interface SolanaConfig {
  dexes: {
    enabled: boolean
    rpcUrl: string
    defaultDEX: DEXName
    enabledDEXes: DEXName[]
  }
  monitoring: {
    healthChecks: boolean
    metrics: boolean
  }
}

// Default configuration
const defaultSolanaConfig: SolanaConfig = {
  dexes: {
    enabled: true,
    rpcUrl: process.env.SOLANA_RPC_URL || 'https://api.mainnet-beta.solana.com',
    defaultDEX: 'jupiter' as DEXName,
    enabledDEXes: ['jupiter', 'raydium', 'aldrin', 'saber', 'lifinity', 'invariant', 'cropper'] as DEXName[],
  },
  monitoring: {
    healthChecks: true,
    metrics: true,
  },
}

// DEX Service Manager Class - Simplified for RPC management focus
export class SolanaDEXManager {
  private connection: Connection
  private logger: winston.Logger
  private services: Map<DEXName, DEXService> = new Map()
  private config: SolanaConfig

  constructor(connection: Connection, logger: winston.Logger, config: Partial<SolanaConfig> = {}) {
    this.connection = connection
    this.logger = logger
    this.config = { ...defaultSolanaConfig, ...config }
  }

  // Initialize all configured DEX services
  async initialize(): Promise<void> {
    this.logger.info('Initializing Solana DEX services with RPC failover support...')

    // Placeholder for DEX service initialization
    // In a real implementation, this would register actual DEX services
    this.logger.info('✅ DEX services initialization placeholder completed')

    this.logger.info(`✅ Solana DEX Manager initialized with RPC failover support`)
  }

  // Get all registered DEX services
  getAllServices(): DEXService[] {
    return Array.from(this.services.values())
  }

  // Get specific DEX service
  getService(dexName: DEXName): DEXService | undefined {
    return this.services.get(dexName)
  }

  // Get DEX statistics
  getStatistics(): {
    totalServices: number
    enabledServices: DEXName[]
    enabledDEXes: DEXName[]
    defaultDEX: DEXName
    rpcUrl: string
    monitoring: { healthChecks: boolean; metrics: boolean }
  } {
    const stats = {
      totalServices: this.services.size,
      enabledServices: Array.from(this.services.keys()),
      enabledDEXes: this.config.dexes.enabledDEXes,
      defaultDEX: this.config.dexes.defaultDEX,
      rpcUrl: this.config.dexes.rpcUrl,
      monitoring: this.config.monitoring,
    }
    return stats
  }

  // Cleanup all services
  async cleanup(): Promise<void> {
    this.logger.info('Cleaning up DEX services...')

    for (const [name, service] of this.services) {
      try {
        if (service.shutdown) {
          await service.shutdown()
        }
        this.logger.debug(`Cleaned up ${name} DEX service`)
      } catch (error) {
        this.logger.warn(`Failed to cleanup ${name} DEX service:`, error)
      }
    }

    this.services.clear()
    this.logger.info('✅ All DEX services cleaned up')
  }
}

// Export individual service references for backward compatibility
export let aldrinService: DEXService | undefined
export let saberService: DEXService | undefined
export let lifinityService: DEXService | undefined
export let invariantService: DEXService | undefined
export let cropperService: DEXService | undefined
export let soldexService: DEXService | undefined
export let atrixService: DEXService | undefined

// Global DEX manager instance
let globalDEXManager: SolanaDEXManager | undefined

// Initialize the Solana DEX framework
export async function initializeSolanaDEX(config: Partial<SolanaConfig> = {}): Promise<SolanaDEXManager> {
  const logger = winston.createLogger({
    level: 'info',
    format: winston.format.simple(),
    transports: [new winston.transports.Console()],
  })

  // Initialize RPC manager with failover support
  const rpcManager = new SolanaRpcManager(
    process.env.SOLANA_RPC_URLS || process.env.SOLANA_RPC_URL,
    logger,
    'confirmed',
  )

  // Wait a moment for initialization
  await new Promise((resolve) => setTimeout(resolve, 100))

  const connection = rpcManager.getConnection()

  globalDEXManager = new SolanaDEXManager(connection, logger, config)
  await globalDEXManager.initialize()

  // Set individual service references
  aldrinService = globalDEXManager.getService('aldrin')
  saberService = globalDEXManager.getService('saber')
  lifinityService = globalDEXManager.getService('lifinity')
  invariantService = globalDEXManager.getService('invariant')
  cropperService = globalDEXManager.getService('cropper')
  soldexService = globalDEXManager.getService('soldex')
  atrixService = globalDEXManager.getService('atrix')

  return globalDEXManager
}

// Get the global DEX manager instance
export function getSolanaDEXManager(): SolanaDEXManager | undefined {
  return globalDEXManager
}

// Cleanup function
export async function cleanupSolanaDEX(): Promise<void> {
  if (globalDEXManager) {
    await globalDEXManager.cleanup()
    globalDEXManager = undefined

    // Clear service references
    aldrinService = undefined
    saberService = undefined
    lifinityService = undefined
    invariantService = undefined
    cropperService = undefined
    soldexService = undefined
    atrixService = undefined
  }
}

// Configuration logging
export function logDEXConfiguration(logger: winston.Logger): void {
  logger.info('🔧 Solana DEX Framework Configuration:', {
    rpcUrl: defaultSolanaConfig.dexes.rpcUrl,
    defaultDEX: defaultSolanaConfig.dexes.defaultDEX,
    enabledDEXes: defaultSolanaConfig.dexes.enabledDEXes,
    healthChecks: defaultSolanaConfig.monitoring.healthChecks,
    metrics: defaultSolanaConfig.monitoring.metrics,
  })

  // Log environment configuration status
  logger.info('🔐 Environment Variables Status:', {
    aldrinEnabled: process.env.ALDRIN_ENABLED !== 'false',
    saberEnabled: process.env.SABER_ENABLED !== 'false',
    lifinityEnabled: process.env.LIFINITY_ENABLED !== 'false',
    invariantEnabled: process.env.INVARIANT_ENABLED !== 'false',
    cropperEnabled: process.env.CROPPER_ENABLED !== 'false',
    soldexEnabled: process.env.SOLDEX_ENABLED !== 'false', // placeholder
    atrixEnabled: process.env.ATRIX_ENABLED !== 'false', // placeholder
  })
}
