// 3aiXchange Configuration
export const APP_NAME = '3aiXchange';
export const APP_DESCRIPTION = 'Decentralized Exchange on 3ai Chain';

// Network configuration
export const NETWORK = {
  chainId: 12345, // 3ai Chain ID
  chainName: '3ai Chain',
  nativeCurrency: {
    name: '3AI',
    symbol: '3AI',
    decimals: 18,
  },
  rpcUrls: [import.meta.env.VITE_RPC_URL || 'http://localhost:8545'],
  blockExplorerUrls: ['https://explorer.3ai/'],
  addChainParams: {
    chainId: '0x' + (12345).toString(16),
    chainName: '3ai Chain',
    nativeCurrency: {
      name: '3AI',
      symbol: '3AI',
      decimals: 18,
    },
    rpcUrls: [import.meta.env.VITE_RPC_URL || 'http://localhost:8545'],
    blockExplorerUrls: ['https://explorer.3ai/'],
  },
};

// Contract addresses
export const CONTRACTS = {
  orderbook: import.meta.env.VITE_ORDERBOOK_CONTRACT_ADDRESS || '0x1234567890123456789012345678901234567890',
  weth: '0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2',
};

// API configuration
export const API = {
  baseUrl: import.meta.env.VITE_API_URL || 'http://localhost:3001/api',
  wsUrl: import.meta.env.VITE_WS_URL || 'ws://localhost:3001',
  endpoints: {
    orderbook: (pairId: string) => `/orderbook/${pairId}`,
    placeOrder: '/orders',
    cancelOrder: (orderId: string) => `/orders/${orderId}`,
    getOrders: (params?: string) => `/orders${params ? `?${params}` : ''}`,
    getTrades: (params?: string) => `/trades${params ? `?${params}` : ''}`,
    getTicker: (pairId: string) => `/ticker/${pairId}`,
    getKlines: (pairId: string, interval = '1m', limit = 1000) => 
      `/klines?symbol=${pairId}&interval=${interval}&limit=${limit}`,
  },
};

// Token configuration
export const TOKENS = {
  native: {
    symbol: '3AI',
    name: '3AI',
    decimals: 18,
    address: '0x0000000000000000000000000000000000000000',
    logo: '/tokens/3ai.png',
  },
  weth: {
    symbol: 'W3AI',
    name: 'Wrapped 3AI',
    decimals: 18,
    address: '0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2',
    logo: '/tokens/w3ai.png',
  },
  usdt: {
    symbol: 'USDT',
    name: 'Tether USD',
    decimals: 6,
    address: '0xdAC17F958D2ee523a2206206994597C13D831ec7',
    logo: '/tokens/usdt.png',
  },
};

// Trading pairs configuration
export const PAIRS = [
  {
    id: '3AI-USDT',
    base: '3AI',
    quote: 'USDT',
    baseToken: '0x0000000000000000000000000000000000000000',
    quoteToken: '0xdAC17F958D2ee523a2206206994597C13D831ec7',
    minOrderSize: '0.1',
    minOrderValue: '10',
    pricePrecision: 6,
    amountPrecision: 4,
    feeTier: 0.001,
    status: 'TRADING',
  },
  {
    id: '3AI-W3AI',
    base: '3AI',
    quote: 'W3AI',
    baseToken: '0x0000000000000000000000000000000000000000',
    quoteToken: '0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2',
    minOrderSize: '0.1',
    minOrderValue: '0.01',
    pricePrecision: 8,
    amountPrecision: 4,
    feeTier: 0.001,
    status: 'TRADING',
  },
  // ─── Cross-chain pairs (atomic swap settled) ────
  {
    id: 'ETH-USDT',
    base: 'ETH',
    quote: 'USDT',
    baseToken: '0x0000000000000000000000000000000000000000',
    quoteToken: '0xdAC17F958D2ee523a2206206994597C13D831ec7',
    minOrderSize: '0.001',
    minOrderValue: '10',
    pricePrecision: 2,
    amountPrecision: 4,
    feeTier: 0.001,
    status: 'TRADING',
  },
  {
    id: 'BTC-USDT',
    base: 'BTC',
    quote: 'USDT',
    baseToken: 'native-btc',
    quoteToken: '0xdAC17F958D2ee523a2206206994597C13D831ec7',
    minOrderSize: '0.0001',
    minOrderValue: '10',
    pricePrecision: 1,
    amountPrecision: 6,
    feeTier: 0.001,
    status: 'TRADING',
  },
  {
    id: 'SOL-USDT',
    base: 'SOL',
    quote: 'USDT',
    baseToken: 'native-sol',
    quoteToken: '0xdAC17F958D2ee523a2206206994597C13D831ec7',
    minOrderSize: '0.01',
    minOrderValue: '10',
    pricePrecision: 3,
    amountPrecision: 4,
    feeTier: 0.001,
    status: 'TRADING',
  },
  {
    id: 'ETH-BTC',
    base: 'ETH',
    quote: 'BTC',
    baseToken: '0x0000000000000000000000000000000000000000',
    quoteToken: 'native-btc',
    minOrderSize: '0.001',
    minOrderValue: '0.0001',
    pricePrecision: 6,
    amountPrecision: 4,
    feeTier: 0.001,
    status: 'TRADING',
  },
  {
    id: 'SOL-ETH',
    base: 'SOL',
    quote: 'ETH',
    baseToken: 'native-sol',
    quoteToken: '0x0000000000000000000000000000000000000000',
    minOrderSize: '0.01',
    minOrderValue: '0.001',
    pricePrecision: 6,
    amountPrecision: 4,
    feeTier: 0.001,
    status: 'TRADING',
  },
  {
    id: 'X3-USDT',
    base: 'X3',
    quote: 'USDT',
    baseToken: 'native-x3',
    quoteToken: '0xdAC17F958D2ee523a2206206994597C13D831ec7',
    minOrderSize: '1',
    minOrderValue: '10',
    pricePrecision: 4,
    amountPrecision: 2,
    feeTier: 0.001,
    status: 'TRADING',
  },
];

export const DEFAULT_PAIR = PAIRS[0];

// Order types
export const ORDER_TYPES = [
  { value: 'LIMIT', label: 'Limit' },
  { value: 'MARKET', label: 'Market' },
  { value: 'STOP_LOSS', label: 'Stop Loss' },
  { value: 'TAKE_PROFIT', label: 'Take Profit' },
];

// Order sides
export const ORDER_SIDES = [
  { value: 'BUY', label: 'Buy', color: 'green.400' },
  { value: 'SELL', label: 'Sell', color: 'red.400' },
];

// Order statuses
export const ORDER_STATUS = {
  NEW: 'NEW',
  PARTIALLY_FILLED: 'PARTIALLY_FILLED',
  FILLED: 'FILLED',
  CANCELED: 'CANCELED',
  REJECTED: 'REJECTED',
  EXPIRED: 'EXPIRED',
};

// Time in force options
export const TIME_IN_FORCE_OPTIONS = [
  { value: 'GTC', label: 'Good Till Cancel' },
  { value: 'IOC', label: 'Immediate or Cancel' },
  { value: 'FOK', label: 'Fill or Kill' },
];

// Default settings
export const DEFAULT_SETTINGS = {
  slippageTolerance: 0.5, // 0.5%
  transactionDeadline: 20, // 20 minutes
  gasPrice: '5', // 5 Gwei
  gasLimit: '200000',
  theme: 'dark',
  language: 'en',
  notifications: true,
  sounds: true,
  animations: true,
  orderBookZoom: 1,
  chartInterval: '1h',
  chartType: 'candlestick',
  chartTheme: 'dark',
};

// Error messages
export const ERROR_MESSAGES = {
  INSUFFICIENT_BALANCE: 'Insufficient balance',
  NETWORK_ERROR: 'Network error. Please check your connection.',
  INSUFFICIENT_FUNDS: 'Insufficient funds for gas',
  TRANSACTION_REJECTED: 'Transaction rejected',
  UNKNOWN_ERROR: 'An unknown error occurred',
};

// Success messages
export const SUCCESS_MESSAGES = {
  ORDER_PLACED: 'Order placed successfully',
  ORDER_CANCELLED: 'Order cancelled successfully',
  TRANSACTION_SENT: 'Transaction sent',
  TRANSACTION_CONFIRMED: 'Transaction confirmed',
};

// Supported chains for atomic swaps
export const CHAINS = [
  { id: 'ethereum', name: 'Ethereum', symbol: 'ETH', color: '#627EEA', explorerUrl: 'https://etherscan.io' },
  { id: 'polygon', name: 'Polygon', symbol: 'MATIC', color: '#8247E5', explorerUrl: 'https://polygonscan.com' },
  { id: 'arbitrum', name: 'Arbitrum', symbol: 'ARB', color: '#28A0F0', explorerUrl: 'https://arbiscan.io' },
  { id: 'optimism', name: 'Optimism', symbol: 'OP', color: '#FF0420', explorerUrl: 'https://optimistic.etherscan.io' },
  { id: 'base', name: 'Base', symbol: 'BASE', color: '#0052FF', explorerUrl: 'https://basescan.org' },
  { id: 'bsc', name: 'BNB Chain', symbol: 'BNB', color: '#F3BA2F', explorerUrl: 'https://bscscan.com' },
  { id: 'avalanche', name: 'Avalanche', symbol: 'AVAX', color: '#E84142', explorerUrl: 'https://snowtrace.io' },
  { id: 'solana', name: 'Solana', symbol: 'SOL', color: '#14F195', explorerUrl: 'https://solscan.io' },
  { id: 'bitcoin', name: 'Bitcoin', symbol: 'BTC', color: '#F7931A', explorerUrl: 'https://blockstream.info' },
  { id: 'x3-substrate', name: 'X3', symbol: 'X3', color: '#4A90D9', explorerUrl: 'http://localhost:9944' },
];
