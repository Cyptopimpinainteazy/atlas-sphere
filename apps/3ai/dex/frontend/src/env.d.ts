/// <reference types="vite/client" />

interface ImportMetaEnv {
  // App Info
  readonly VITE_APP_NAME: string;
  readonly VITE_APP_VERSION: string;
  
  // Network Configuration
  readonly VITE_CHAIN_ID: string;
  readonly VITE_RPC_URL: string;
  readonly VITE_WALLETCONNECT_PROJECT_ID: string;
  readonly VITE_BLOCK_EXPLORER_URL: string;
  
  // API Configuration
  readonly VITE_API_URL: string;
  readonly VITE_WS_URL: string;
  
  // Contract Addresses
  readonly VITE_ORDERBOOK_CONTRACT_ADDRESS: string;
  readonly VITE_TOKEN_CONTRACT_ADDRESS: string;
  readonly VITE_3AI_TOKEN_ADDRESS: string;
  readonly VITE_ORDERBOOK_ADDRESS: string;
  readonly VITE_EXCHANGE_ADDRESS: string;
  
  // Add other environment variables below
  // readonly VITE_ANOTHER_VARIABLE: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
