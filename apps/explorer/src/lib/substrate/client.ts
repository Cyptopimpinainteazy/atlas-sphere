/**
 * Substrate Client for Atlas Sphere
 * 
 * Provides a singleton connection to the Atlas Sphere Substrate node
 * with automatic reconnection and state management.
 */

import { ApiPromise, WsProvider } from '@polkadot/api';
import type { Header, SignedBlock } from '@polkadot/types/interfaces';

// Custom types for Atlas Kernel pallet
const ATLAS_TYPES = {
  Comit: {
    comit_id: 'H256',
    origin: 'AccountId',
    evm_payload: 'Vec<u8>',
    svm_payload: 'Vec<u8>',
    nonce: 'u64',
    fee: 'Balance',
    prepare_root: 'H256',
  },
  ExecutionReceipt: {
    success: 'bool',
    gas_used: 'u64',
    return_data: 'Vec<u8>',
    logs: 'Vec<ExecutionLog>',
    state_changes: 'Vec<StateChange>',
  },
  ExecutionLog: {
    address: 'Vec<u8>',
    topics: 'Vec<H256>',
    data: 'Vec<u8>',
  },
  StateChange: {
    address: 'Vec<u8>',
    key: 'H256',
    value: 'H256',
  },
  ComitFailureReason: {
    _enum: {
      EvmPayloadTooLarge: { code: 'u32', actual_size: 'u32', max_size: 'u32' },
      SvmPayloadTooLarge: { code: 'u32', actual_size: 'u32', max_size: 'u32' },
      CombinedPayloadTooLarge: { code: 'u32', evm_size: 'u32', svm_size: 'u32', max_combined: 'u32' },
      EmptyPayloads: { code: 'u32' },
      InvalidNonce: { code: 'u32', expected: 'u64', provided: 'u64' },
      Verification: { code: 'u32', reason: '[u8; 32]' },
      EvmExecutionFailed: { code: 'u32', evm_error: 'u32', gas_used: 'u64' },
      SvmExecutionFailed: { code: 'u32', svm_error: 'u32', compute_units_used: 'u64' },
    }
  },
  AssetMetadata: {
    symbol: 'Vec<u8>',
    decimals: 'u8',
  },
};

// Custom RPC methods for Atlas Kernel
const ATLAS_RPC = {
  atlasKernel: {
    getCanonicalBalance: {
      description: 'Get canonical balance for account and asset',
      params: [
        { name: 'account', type: 'AccountId' },
        { name: 'assetId', type: 'u32' },
        { name: 'at', type: 'BlockHash', isOptional: true },
      ],
      type: 'Balance',
    },
    getAssetMetadata: {
      description: 'Get asset metadata',
      params: [
        { name: 'assetId', type: 'u32' },
        { name: 'at', type: 'BlockHash', isOptional: true },
      ],
      type: 'Option<(Vec<u8>, u8)>',
    },
    isAuthorized: {
      description: 'Check if account is authorized',
      params: [
        { name: 'account', type: 'AccountId' },
        { name: 'at', type: 'BlockHash', isOptional: true },
      ],
      type: 'bool',
    },
    getAuthorizedAccounts: {
      description: 'Get all authorized accounts',
      params: [
        { name: 'at', type: 'BlockHash', isOptional: true },
      ],
      type: 'Vec<AccountId>',
    },
    getAuthorities: {
      description: 'Get current authority set',
      params: [
        { name: 'at', type: 'BlockHash', isOptional: true },
      ],
      type: 'Vec<AccountId>',
    },
  },
};

// Connection state
let apiInstance: ApiPromise | null = null;
let connectionPromise: Promise<ApiPromise> | null = null;

// Default WebSocket endpoint
const DEFAULT_WS_ENDPOINT = process.env.NEXT_PUBLIC_SUBSTRATE_WS_ENDPOINT || 'ws://127.0.0.1:9944';

export interface SubstrateClientConfig {
  endpoint?: string;
  autoConnect?: boolean;
}

/**
 * Get or create the Substrate API connection
 */
export async function getApi(config?: SubstrateClientConfig): Promise<ApiPromise> {
  const endpoint = config?.endpoint || DEFAULT_WS_ENDPOINT;

  // Return existing instance if connected
  if (apiInstance?.isConnected) {
    return apiInstance;
  }

  // Wait for existing connection attempt
  if (connectionPromise) {
    return connectionPromise;
  }

  // Create new connection
  connectionPromise = createConnection(endpoint);
  
  try {
    apiInstance = await connectionPromise;
    return apiInstance;
  } finally {
    connectionPromise = null;
  }
}

/**
 * Create a new WebSocket connection to the Substrate node
 */
async function createConnection(endpoint: string): Promise<ApiPromise> {
  console.log(`[Substrate] Connecting to ${endpoint}...`);

  const provider = new WsProvider(endpoint);
  
  const api = await ApiPromise.create({
    provider,
    types: ATLAS_TYPES,
    rpc: ATLAS_RPC,
  });

  await api.isReady;
  
  const [chain, nodeName, nodeVersion] = await Promise.all([
    api.rpc.system.chain(),
    api.rpc.system.name(),
    api.rpc.system.version(),
  ]);

  console.log(`[Substrate] Connected to ${chain} via ${nodeName} v${nodeVersion}`);

  // Setup disconnect handler
  api.on('disconnected', () => {
    console.warn('[Substrate] Disconnected from node');
    apiInstance = null;
  });

  api.on('error', (error) => {
    console.error('[Substrate] Connection error:', error);
  });

  return api;
}

/**
 * Disconnect from the Substrate node
 */
export async function disconnect(): Promise<void> {
  if (apiInstance) {
    await apiInstance.disconnect();
    apiInstance = null;
  }
}

/**
 * Check if connected to the Substrate node
 */
export function isConnected(): boolean {
  return apiInstance?.isConnected ?? false;
}

/**
 * Get the current connection status
 */
export function getConnectionStatus(): 'connected' | 'connecting' | 'disconnected' {
  if (apiInstance?.isConnected) return 'connected';
  if (connectionPromise) return 'connecting';
  return 'disconnected';
}

// Type exports for use in other modules
export type { ApiPromise, Header, SignedBlock };
