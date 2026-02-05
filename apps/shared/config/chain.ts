/**
 * Shared Chain Configuration for Atlas Sphere Frontend Apps
 * 
 * Single source of truth for all chain-related configuration
 */

// =============================================================================
// Environment Detection
// =============================================================================

export const IS_BROWSER = typeof window !== 'undefined';
export const IS_DEV = process.env.NODE_ENV === 'development';

// =============================================================================
// Endpoint Configuration
// =============================================================================

/**
 * RPC Endpoints for Atlas Sphere networks
 */
export const RPC_ENDPOINTS = {
  // Local development
  local: {
    ws: 'ws://127.0.0.1:9944',
    http: 'http://127.0.0.1:9944',
    name: 'Local Development',
  },
  
  // Testnet
  testnet: {
    ws: 'wss://rpc.testnet.atlas-sphere.io:9944',
    http: 'https://rpc.testnet.atlas-sphere.io:9944',
    name: 'Atlas Sphere Testnet',
  },
  
  // Mainnet (future)
  mainnet: {
    ws: 'wss://rpc.atlas-sphere.io',
    http: 'https://rpc.atlas-sphere.io',
    name: 'Atlas Sphere Mainnet',
  },
} as const;

export type NetworkId = keyof typeof RPC_ENDPOINTS;
export type NetworkEnv = NetworkId; // Alias for compatibility

// =============================================================================
// Active Network Configuration
// =============================================================================

/**
 * Get active network from environment or default
 */
export function getActiveNetwork(): NetworkId {
  const envNetwork = process.env.NEXT_PUBLIC_NETWORK as NetworkId | undefined;
  
  if (envNetwork && envNetwork in RPC_ENDPOINTS) {
    return envNetwork;
  }
  
  // Default to local in development, testnet otherwise
  return IS_DEV ? 'local' : 'testnet';
}

/**
 * Get the active RPC endpoints
 */
export function getActiveEndpoints() {
  const network = getActiveNetwork();
  return RPC_ENDPOINTS[network];
}

/**
 * Get the WebSocket endpoint
 */
export function getWsEndpoint(): string {
  const envEndpoint = process.env.NEXT_PUBLIC_SUBSTRATE_WS_ENDPOINT;
  if (envEndpoint && envEndpoint.length > 0) {
    return envEndpoint;
  }
  return getActiveEndpoints().ws;
}

/**
 * Get the HTTP endpoint
 */
export function getHttpEndpoint(): string {
  const envEndpoint = process.env.NEXT_PUBLIC_SUBSTRATE_RPC_ENDPOINT;
  if (envEndpoint && envEndpoint.length > 0) {
    return envEndpoint;
  }
  return getActiveEndpoints().http;
}

// =============================================================================
// Chain Constants
// =============================================================================

export const CHAIN_CONFIG = {
  // Block time in milliseconds
  blockTime: 6000,
  
  // Native token
  nativeToken: {
    symbol: 'ATLAS',
    decimals: 18,
    name: 'Atlas Sphere',
  },
  
  // SS58 address prefix
  ss58Prefix: 42,
  
  // EVM chain ID (for MetaMask etc)
  evmChainId: 2048,
  
  // Supported VMs
  vms: ['evm', 'svm', 'native'] as const,
  
  // Finalization configuration
  finalization: {
    blocks: 2,
    timeoutMs: 30000,
  },
  
  // Payload limits (bytes)
  payloadLimits: {
    maxEvm: 16384,
    maxSvm: 16384,
    maxCombined: 32768,
  },
} as const;

// =============================================================================
// Asset IDs
// =============================================================================

export const ASSET_IDS = {
  NATIVE: 0,
  ATLAS: 0, // Alias for native token
  USDC: 1,
  USDT: 2,
  WETH: 3,
  ETH: 3, // Alias for WETH
  SOL: 100,
  sUSDC: 101,
} as const;

export type AssetId = (typeof ASSET_IDS)[keyof typeof ASSET_IDS];

// =============================================================================
// Token Registry
// =============================================================================

export interface TokenInfo {
  id: AssetId;
  symbol: string;
  name: string;
  decimals: number;
  vm: 'evm' | 'svm' | 'native';
  address?: string;
  logoUri?: string;
}

export const TOKEN_REGISTRY: Record<number, TokenInfo> = {
  [ASSET_IDS.NATIVE]: {
    id: ASSET_IDS.NATIVE,
    symbol: 'ATLAS',
    name: 'Atlas Sphere',
    decimals: 18,
    vm: 'native',
    address: '0x0000000000000000000000000000000000000000',
  },
  [ASSET_IDS.USDC]: {
    id: ASSET_IDS.USDC,
    symbol: 'USDC',
    name: 'USD Coin',
    decimals: 6,
    vm: 'evm',
    address: '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48',
  },
  [ASSET_IDS.USDT]: {
    id: ASSET_IDS.USDT,
    symbol: 'USDT',
    name: 'Tether USD',
    decimals: 6,
    vm: 'evm',
    address: '0xdAC17F958D2ee523a2206206994597C13D831ec7',
  },
  [ASSET_IDS.WETH]: {
    id: ASSET_IDS.WETH,
    symbol: 'WETH',
    name: 'Wrapped Ether',
    decimals: 18,
    vm: 'evm',
    address: '0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2',
  },
  [ASSET_IDS.SOL]: {
    id: ASSET_IDS.SOL,
    symbol: 'SOL',
    name: 'Solana',
    decimals: 9,
    vm: 'svm',
    address: 'So11111111111111111111111111111111111111112',
  },
  [ASSET_IDS.sUSDC]: {
    id: ASSET_IDS.sUSDC,
    symbol: 'sUSDC',
    name: 'Solana USDC',
    decimals: 6,
    vm: 'svm',
    address: 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v',
  },
};

export function getTokenInfo(assetId: AssetId): TokenInfo | undefined {
  return TOKEN_REGISTRY[assetId];
}

export function getTokenBySymbol(symbol: string): TokenInfo | undefined {
  return Object.values(TOKEN_REGISTRY).find(
    (token) => token.symbol.toLowerCase() === symbol.toLowerCase()
  );
}

// =============================================================================
// Explorer URLs
// =============================================================================

export const EXPLORER_URLS = {
  local: 'http://localhost:3000/explorer',
  testnet: 'https://explorer.testnet.atlas-sphere.io',
  mainnet: 'https://explorer.atlas-sphere.io',
} as const;

export function getExplorerUrl(): string {
  return EXPLORER_URLS[getActiveNetwork()];
}

export function getBlockExplorerUrl(blockNumber: number): string {
  return `${getExplorerUrl()}/block/${blockNumber}`;
}

export function getTxExplorerUrl(txHash: string): string {
  return `${getExplorerUrl()}/tx/${txHash}`;
}

export function getAccountExplorerUrl(address: string): string {
  return `${getExplorerUrl()}/account/${address}`;
}

// =============================================================================
// Faucet Configuration
// =============================================================================

export const FAUCET_CONFIG = {
  testnet: {
    url: 'https://faucet.testnet.atlas-sphere.io',
    amount: '1000000000000000000000', // 1000 ATLAS
    cooldown: 86400000, // 24 hours
  },
} as const;

export function getFaucetUrl(): string | undefined {
  const network = getActiveNetwork();
  if (network === 'testnet') {
    return FAUCET_CONFIG.testnet.url;
  }
  return undefined;
}
