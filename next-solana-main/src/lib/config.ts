/**
 * Application configuration management
 * Handles environment variables and feature flags
 */

export interface AppConfig {
  // Environment
  isDevelopment: boolean
  isProduction: boolean

  // Solana
  solana: {
    network: 'devnet' | 'testnet' | 'mainnet-beta'
    rpcEndpoint: string
    commitment: 'processed' | 'confirmed' | 'finalized'
    programId: string
  }

  // Supabase
  supabase: {
    url: string
    anonKey: string
    serviceRoleKey?: string
  }

  // Jupiter
  jupiter: {
    apiUrl: string
    apiKey?: string
  }

  // Feature Flags
  features: {
    useMockData: boolean
    enableAnalytics: boolean
    enableLimitOrders: boolean
    enableDCA: boolean
    showDebugInfo: boolean
  }

  // Logging
  logLevel: 'debug' | 'info' | 'warn' | 'error'
}

function getEnvVar(key: string, defaultValue?: string): string {
  const value = process.env[key] || defaultValue
  if (!value) {
    throw new Error(`Missing required environment variable: ${key}`)
  }
  return value
}

function getBooleanEnv(key: string, defaultValue: boolean = false): boolean {
  const value = process.env[key]
  if (!value) return defaultValue
  return value.toLowerCase() === 'true'
}

// Validate critical environment variables
function validateConfig(): void {
  const isDev = process.env.NODE_ENV === 'development'
  const useMockData = getBooleanEnv('NEXT_PUBLIC_USE_MOCK_DATA', isDev)

  // In production, ensure real services are configured
  if (!isDev && !useMockData) {
    // Validate Supabase config for production
    if (!process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL.includes('your_')) {
      console.warn('⚠️  Supabase not configured for production. Using mock data.')
    }

    // Validate Solana config for production
    if (!process.env.NEXT_PUBLIC_RPC_ENDPOINT || process.env.NEXT_PUBLIC_RPC_ENDPOINT.includes('devnet')) {
      console.warn('⚠️  Using devnet RPC in production environment.')
    }
  }
}

// Initialize configuration
export const config: AppConfig = (() => {
  validateConfig()

  const isDevelopment = process.env.NODE_ENV === 'development'
  const isProduction = process.env.NODE_ENV === 'production'

  return {
    isDevelopment,
    isProduction,

    solana: {
      network: (process.env.NEXT_PUBLIC_SOLANA_NETWORK as any) || 'devnet',
      rpcEndpoint: getEnvVar('NEXT_PUBLIC_RPC_ENDPOINT', 'https://api.devnet.solana.com'),
      commitment: (process.env.NEXT_PUBLIC_SOLANA_COMMITMENT as any) || 'confirmed',
      programId: getEnvVar('NEXT_PUBLIC_DEX_PROGRAM_ID', 'A2NKHo8dGdRmNgFfaxmqLmmDVJyeoxhYRyuC7WouMW47'),
    },

    supabase: {
      url: process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://your-project.supabase.co',
      anonKey: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'your-anon-key',
      serviceRoleKey: process.env.SUPABASE_SERVICE_ROLE_KEY,
    },

    jupiter: {
      apiUrl: getEnvVar('NEXT_PUBLIC_JUPITER_API_URL', 'https://quote-api.jup.ag/v6'),
      apiKey: process.env.JUPITER_API_KEY,
    },

    features: {
      useMockData: getBooleanEnv('NEXT_PUBLIC_USE_MOCK_DATA', isDevelopment),
      enableAnalytics: getBooleanEnv('NEXT_PUBLIC_ENABLE_ANALYTICS', true),
      enableLimitOrders: getBooleanEnv('NEXT_PUBLIC_ENABLE_LIMIT_ORDERS', true),
      enableDCA: getBooleanEnv('NEXT_PUBLIC_ENABLE_DCA', true),
      showDebugInfo: getBooleanEnv('NEXT_PUBLIC_SHOW_DEBUG_INFO', isDevelopment),
    },

    logLevel: (process.env.NEXT_PUBLIC_LOG_LEVEL as any) || (isDevelopment ? 'debug' : 'error'),
  }
})()

// Utility functions
export const isMockMode = () => config.features.useMockData
export const isDemoMode = () => config.features.useMockData
export const isFeatureEnabled = (feature: keyof AppConfig['features']) => config.features[feature]
export const getSolanaConfig = () => config.solana
export const getSupabaseConfig = () => config.supabase
export const getJupiterConfig = () => config.jupiter

// Demo mode utilities
export const shouldShowDemoBanner = () => {
  return config.features.useMockData && config.features.showDebugInfo
}

// Logger utility
export const logger = {
  debug: (message: string, ...args: any[]) => {
    if (['debug'].includes(config.logLevel)) {
      console.log(`[DEBUG] ${message}`, ...args)
    }
  },
  info: (message: string, ...args: any[]) => {
    if (['debug', 'info'].includes(config.logLevel)) {
      console.info(`[INFO] ${message}`, ...args)
    }
  },
  warn: (message: string, ...args: any[]) => {
    if (['debug', 'info', 'warn'].includes(config.logLevel)) {
      console.warn(`[WARN] ${message}`, ...args)
    }
  },
  error: (message: string, ...args: any[]) => {
    console.error(`[ERROR] ${message}`, ...args)
  },
}

// Export for debugging in development
if (config.features.showDebugInfo) {
  console.log('🔧 App Configuration:', {
    environment: process.env.NODE_ENV,
    mockMode: config.features.useMockData,
    solanaNetwork: config.solana.network,
    features: config.features,
  })
}
