// Application constants
export const APP_NAME = '3aiXchange DEX';
export const APP_DESCRIPTION = 'Decentralized exchange bfrontend/uilt on the 3ai blockchain';

// Default network configuration
export const DEFAULT_CHAIN_ID = 3333;
export const DEFAULT_RPC_URL = 'http://localhost:8545';
export const DEFAULT_BLOCK_EXPLORER_URL = 'https://explorer.3ai.dev';

// Contract addresses
export const CONTRACT_ADDRESSES = {
  OrderBook: '0x...', // Replace with actual contract address
  Token: '0x...',     // Replace with actual token address
} as const;

// ABBY Configuration
export const ABBY_CONFIG = {
  MODEL_PATH: '/models/abby/abby.glb',
  ANIMATIONS: {
    IDLE: 'idle',
    TALKING: 'talking',
    THINKING: 'thinking',
    SUCCESS: 'success',
    ERROR: 'error',
  },
  POSITION: [2, -1, 0],
  SCALE: 0.5,
};

// Token information
export const NATIVE_TOKEN = {
  name: '3AI',
  symbol: '3AI',
  decimals: 18,
} as const;

// API endpoints
export const API_ENDPOINTS = {
  BASE: import.meta.env.VITE_API_URL || 'http://localhost:3000/api',
  MARKETS: '/markets',
  TOKENS: '/tokens',
  ORDERS: '/orders',
  TRADES: '/trades',
} as const;

// Local storage keys
export const STORAGE_KEYS = {
  THEME_MODE: '3aixchange-theme-mode',
  CONNECTED_WALLET: '3aixchange-connected-wallet',
  LAST_ACCOUNT: '3aixchange-last-account',
} as const;

// Routes
export const ROUTES = {
  HOME: '/',
  MARKETS: '/markets',
  TRADE: '/trade',
  PORTFOLIO: '/portfolio',
  SETTINGS: '/settings',
  DOCS: 'https://docs.3aixchange.com',
  GITHUB: 'https://github.com/3aixchange/dex',
} as const;

// UI constants
export const UI = {
  MAX_WIDTH: 'container.xl',
  HEADER_HEIGHT: '60px',
  SIDEBAR_WIDTH: '250px',
  FOOTER_HEIGHT: '60px',
  TRANSITION_DURATION: '0.2s',
  BORDER_RADIUS: 'md',
} as const;
