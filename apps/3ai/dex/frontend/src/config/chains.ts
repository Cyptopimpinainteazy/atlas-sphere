import { defineChain } from 'viem';

// Get environment variables with fallbacks
const CHAIN_ID = Number(import.meta.env.VITE_CHAIN_ID || '31337');
const RPC_URL = import.meta.env.VITE_RPC_URL || 'http://localhost:8545';
const BLOCK_EXPLORER_URL = import.meta.env.VITE_BLOCK_EXPLORER_URL || '';

export const chain = defineChain({
  id: CHAIN_ID,
  name: '3aiXchange Chain',
  network: '3ai',
  nativeCurrency: {
    decimals: 18,
    name: '3ai',
    symbol: '3AI',
  },
  rpcUrls: {
    default: {
      http: [RPC_URL],
    },
    public: {
      http: [RPC_URL],
    },
  },
  blockExplorers: BLOCK_EXPLORER_URL ? {
    default: {
      name: '3aiXchange Explorer',
      url: BLOCK_EXPLORER_URL,
    },
  } : undefined,
  testnet: false,
});

export const supportedChains = [chain];
