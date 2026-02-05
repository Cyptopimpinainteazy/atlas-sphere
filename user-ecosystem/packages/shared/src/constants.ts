// Atlas Sphere Constants
export const ATLAS_VERSION = '1.0.0';

// Contract Addresses (Placeholder - Deploy and update)
export const CONTRACT_ADDRESSES = {
  // Atlas Sphere Native
  ATLAS_KERNEL: '0x0000000000000000000000000000000000000001',
  X3_TOKEN: '0x0000000000000000000000000000000000000002',
  WRAPPED_X3: '0x0000000000000000000000000000000000000003',
  TREASURY: '0x0000000000000000000000000000000000000004',
  STAKING: '0x0000000000000000000000000000000000000005',
  GOVERNANCE: '0x0000000000000000000000000000000000000006',
  NFT_LAUNCHPAD: '0x0000000000000000000000000000000000000007',
  TOKEN_LAUNCHPAD: '0x0000000000000000000000000000000000000008',
  SWAP_ROUTER: '0x0000000000000000000000000000000000000009',
  BLOCKSPACE_AUCTION: '0x000000000000000000000000000000000000000A',
  AI_SWARM_REGISTRY: '0x000000000000000000000000000000000000000B',
  GPU_REWARDS: '0x000000000000000000000000000000000000000C',
  PRESALE_MANAGER: '0x000000000000000000000000000000000000000D',
  BRIDGE: '0x000000000000000000000000000000000000000E',
} as const;

// Treasury Wallet Addresses
export const TREASURY_WALLETS = {
  DEV_FUND: '0xDEV0000000000000000000000000000000000001',
  DAO_TREASURY: '0xDA00000000000000000000000000000000000001',
  LP_REWARDS: '0xLP00000000000000000000000000000000000001',
  MARKETING: '0xMKT0000000000000000000000000000000000001',
  AI_SWARM_POOL: '0xAI00000000000000000000000000000000000001',
  VALIDATOR_REWARDS: '0xVAL0000000000000000000000000000000000001',
} as const;

// Fee Configuration (basis points, 10000 = 100%)
export const FEE_CONFIG = {
  SWAP_FEE: 30, // 0.30%
  BRIDGE_FEE: 10, // 0.10%
  NFT_MINT_FEE: 250, // 2.50%
  TOKEN_LAUNCH_FEE: 100, // 1.00%
  PRESALE_FEE: 50, // 0.50%
  STAKING_WITHDRAWAL_FEE: 10, // 0.10%
  AI_SWARM_FEE: 500, // 5.00% of earnings
  GPU_CONTRIBUTION_FEE: 200, // 2.00% of compute rewards
} as const;

// Fee Distribution (basis points, total = 10000)
export const FEE_DISTRIBUTION = {
  DEV_FUND: 2000, // 20%
  DAO_TREASURY: 3000, // 30%
  LP_REWARDS: 2500, // 25%
  MARKETING: 1000, // 10%
  AI_SWARM_POOL: 1000, // 10%
  VALIDATOR_REWARDS: 500, // 5%
} as const;

// Swarm Configuration
export const SWARM_CONFIG = {
  MIN_GPU_VRAM_MB: 4096,
  MIN_CPU_CORES: 4,
  MIN_RAM_GB: 8,
  TASK_TIMEOUT_MS: 300000, // 5 minutes
  HEARTBEAT_INTERVAL_MS: 30000, // 30 seconds
  MAX_CONCURRENT_TASKS: 10,
  REWARD_MULTIPLIER_BASE: 1.0,
  CONTRIBUTION_TIERS: [
    { name: 'Bronze', minHours: 0, multiplier: 1.0 },
    { name: 'Silver', minHours: 100, multiplier: 1.25 },
    { name: 'Gold', minHours: 500, multiplier: 1.5 },
    { name: 'Platinum', minHours: 2000, multiplier: 2.0 },
    { name: 'Diamond', minHours: 10000, multiplier: 3.0 },
  ],
} as const;

// API Endpoints
export const API_ENDPOINTS = {
  SWARM_COORDINATOR: 'https://swarm.atlas-sphere.io',
  PRICE_FEED: 'https://api.atlas-sphere.io/prices',
  GOVERNANCE: 'https://api.atlas-sphere.io/governance',
  ANALYTICS: 'https://api.atlas-sphere.io/analytics',
  NFT_METADATA: 'https://nft.atlas-sphere.io/metadata',
  PRESALE_API: 'https://api.atlas-sphere.io/presales',
  AUCTION_API: 'https://api.atlas-sphere.io/auctions',
} as const;

// WebSocket Endpoints
export const WS_ENDPOINTS = {
  SWARM: 'wss://swarm.atlas-sphere.io/ws',
  PRICE_STREAM: 'wss://stream.atlas-sphere.io/prices',
  NOTIFICATIONS: 'wss://stream.atlas-sphere.io/notifications',
  GOVERNANCE_EVENTS: 'wss://stream.atlas-sphere.io/governance',
} as const;

// Storage Keys
export const STORAGE_KEYS = {
  WALLET: 'atlas_wallet',
  SETTINGS: 'atlas_settings',
  SWARM_CONFIG: 'atlas_swarm_config',
  CACHED_BALANCES: 'atlas_cached_balances',
  NOTIFICATIONS: 'atlas_notifications',
  GPU_STATS: 'atlas_gpu_stats',
  THEME: 'atlas_theme',
} as const;

// NFT Tiers
export const NFT_TIERS = {
  CONTRIBUTOR: { minContribution: 0, benefits: ['Basic rewards', 'Community access'] },
  PIONEER: { minContribution: 1000, benefits: ['2x rewards', 'Early access', 'Pioneer badge'] },
  GUARDIAN: { minContribution: 10000, benefits: ['3x rewards', 'Governance power', 'Guardian badge'] },
  ARCHITECT: { minContribution: 100000, benefits: ['5x rewards', 'DAO voting', 'Architect badge', 'Exclusive NFTs'] },
} as const;
