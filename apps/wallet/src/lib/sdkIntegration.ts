/**
 * Simplified SDK Integration Layer for Atlas Sphere Wallet
 * 
 * Provides wallet operations without problematic dependencies
 */

import type { ComitEvent } from '@atlas-sphere/ts-sdk';

// =============================================================================
// Types
// =============================================================================

export interface WalletConfig {
  endpoint: string;
  useWebSocket: boolean;
  rpcTimeoutMs?: number;
  finalizationTimeoutMs?: number;
  autoReconnect?: boolean;
}

export interface BalanceInfo {
  native: bigint;
  formatted: string;
  usdValue?: string;
}

export interface ComitSubmissionResult {
  comitId: string;
  blockHash: string;
  blockNumber: number;
  success: boolean;
  gasUsed?: bigint;
  error?: string;
}

export interface TransactionStatus {
  status: 'pending' | 'confirmed' | 'finalized' | 'failed';
  confirmations: number;
  blockNumber?: number;
}

// =============================================================================
// Constants
// =============================================================================

export const NATIVE_ASSET_ID = 0;
export const NATIVE_ASSET_SYMBOL = 'ATLAS';
export const NATIVE_ASSET_DECIMALS = 12;
export const DEFAULT_WS_ENDPOINT = 'ws://localhost:9944';

// =============================================================================
// Simplified SDK Integration
// =============================================================================

/**
 * Simplified SDK integration manager for wallet operations
 */
class SDKIntegration {
  private connected = false;
  private endpoint: string;

  constructor() {
    this.endpoint = process.env.NEXT_PUBLIC_SUBSTRATE_RPC_ENDPOINT || DEFAULT_WS_ENDPOINT;
  }

  /**
   * Connect to the Atlas Sphere node (simplified)
   */
  async connect(): Promise<void> {
    try {
      // Simulate connection
      this.connected = true;
      console.log('[SDK] Connected to Atlas Sphere node');
    } catch (error) {
      console.error('[SDK] Connection failed:', error);
      throw error;
    }
  }

  /**
   * Disconnect from the node
   */
  async disconnect(): Promise<void> {
    this.connected = false;
    console.log('[SDK] Disconnected from Atlas Sphere node');
  }

  /**
   * Check if connected
   */
  isConnected(): boolean {
    return this.connected;
  }

  // ===========================================================================
  // Mock Methods for Development
  // ===========================================================================

  async getCanonicalBalance(address: string, assetId: number = NATIVE_ASSET_ID): Promise<BalanceInfo> {
    if (!this.connected) {
      throw new Error('Not connected to Atlas Sphere');
    }
    
    // Mock balance for development
    const mockBalance = BigInt(Math.floor(Math.random() * 1000000000000));
    return {
      native: mockBalance,
      formatted: '1000.0000',
    };
  }

  async isAuthorized(address: string): Promise<boolean> {
    if (!this.connected) {
      throw new Error('Not connected to Atlas Sphere');
    }
    
    // Mock authorization check
    return address === '5GrwvaEF5zXb26Fz9rcQpDWS57CtERHpNehXCPcNoHGKutQY';
  }

  async getChainInfo() {
    return {
      name: 'Atlas Sphere Dev',
      version: '1.0.0',
      properties: {
        tokenSymbol: NATIVE_ASSET_SYMBOL,
        tokenDecimals: NATIVE_ASSET_DECIMALS,
        ss58Format: 42,
      },
    };
  }

  async getBlockNumber(): Promise<number> {
    return Math.floor(Math.random() * 1000) + 1;
  }

  // Mock Comit methods
  async submitEvmComit(signer: string, evmPayload: Uint8Array | string, fee?: bigint): Promise<ComitSubmissionResult> {
    if (!this.connected) {
      return { comitId: '', blockHash: '', blockNumber: 0, success: false, error: 'Not connected' };
    }
    
    return {
      comitId: '0x' + Array(64).fill(0).map(() => Math.floor(Math.random() * 16).toString(16)).join(''),
      blockHash: '0x' + Array(64).fill(0).map(() => Math.floor(Math.random() * 16).toString(16)).join(''),
      blockNumber: Math.floor(Math.random() * 1000) + 1,
      success: true,
    };
  }

  async submitSvmComit(signer: string, svmPayload: Uint8Array | string, fee?: bigint): Promise<ComitSubmissionResult> {
    if (!this.connected) {
      return { comitId: '', blockHash: '', blockNumber: 0, success: false, error: 'Not connected' };
    }
    
    return {
      comitId: '0x' + Array(64).fill(0).map(() => Math.floor(Math.random() * 16).toString(16)).join(''),
      blockHash: '0x' + Array(64).fill(0).map(() => Math.floor(Math.random() * 16).toString(16)).join(''),
      blockNumber: Math.floor(Math.random() * 1000) + 1,
      success: true,
    };
  }

  async submitDualComit(signer: string, evmPayload: Uint8Array | string, svmPayload: Uint8Array | string, fee?: bigint): Promise<ComitSubmissionResult> {
    if (!this.connected) {
      return { comitId: '', blockHash: '', blockNumber: 0, success: false, error: 'Not connected' };
    }
    
    return {
      comitId: '0x' + Array(64).fill(0).map(() => Math.floor(Math.random() * 16).toString(16)).join(''),
      blockHash: '0x' + Array(64).fill(0).map(() => Math.floor(Math.random() * 16).toString(16)).join(''),
      blockNumber: Math.floor(Math.random() * 1000) + 1,
      success: true,
    };
  }

  // Mock subscription methods
  async subscribeToBlocks(callback: (blockNumber: number, blockHash?: string) => void): Promise<string> {
    const interval = setInterval(() => {
      const bn = Math.floor(Math.random() * 1000) + 1;
      const hash = '0x' + Array(64).fill(0).map(() => Math.floor(Math.random() * 16).toString(16)).join('');
      try { callback(bn, hash); } catch { callback(bn); }
    }, 5000);
    
    return 'mock-subscription-id';
  }

  async subscribeToFinalizedBlocks(callback: (blockNumber: number, blockHash?: string) => void): Promise<string> {
    const interval = setInterval(() => {
      const bn = Math.floor(Math.random() * 1000) + 1;
      const hash = '0x' + Array(64).fill(0).map(() => Math.floor(Math.random() * 16).toString(16)).join('');
      try { callback(bn, hash); } catch { callback(bn); }
    }, 8000);
    return 'mock-finalized-sub-id';
  }

  async subscribeToComitEvents(address: string, callback: (event: ComitEvent) => void): Promise<string> {
    // Mock some events
    setTimeout(() => {
      callback({
        type: 'submitted',
        data: {
          comitId: '0x' + Array(64).fill(0).map(() => Math.floor(Math.random() * 16).toString(16)).join(''),
          origin: address,
          nonce: BigInt(0),
          fee: BigInt(0),
        },
      });
    }, 1000);
    
    return 'mock-comit-subscription-id';
  }

  async unsubscribe(subscriptionId: string): Promise<boolean> {
    return true;
  }

  async getFinalizedBlockNumber(): Promise<number> {
    const n = await this.getBlockNumber();
    return Math.max(0, n - 2);
  }

  async getBalance(address: string, assetId: number = NATIVE_ASSET_ID): Promise<BalanceInfo> {
    return this.getCanonicalBalance(address, assetId);
  }

  async getNonce(address: string): Promise<bigint> {
    return BigInt(0);
  }

  async getMultipleBalances(address: string, assetIds: number[]): Promise<BalanceInfo[]> {
    const res: BalanceInfo[] = [];
    for (const id of assetIds) {
      res.push(await this.getCanonicalBalance(address, id));
    }
    return res;
  }

  formatBalance(balance: bigint, decimals: number = NATIVE_ASSET_DECIMALS) {
    // Avoid bigint exponent issues on lower TS targets — use loop
    let factor = BigInt(1);
    for (let i = 0; i < decimals; i++) factor *= BigInt(10);
    const whole = balance / factor;
    const frac = balance % factor;
    const fracStr = String((Number(frac) / Number(factor)).toFixed(4)).slice(1);
    return `${whole.toString()}${fracStr}`;
  }

  parseBalance(str: string, decimals: number = NATIVE_ASSET_DECIMALS) {
    const asFloat = parseFloat(str);
    return BigInt(Math.floor(asFloat * Math.pow(10, decimals)));
  }

  configure(config: Partial<WalletConfig>) {
    if (config.endpoint) this.endpoint = config.endpoint;
  }
}

// =============================================================================
// Singleton Export
// =============================================================================

export const sdkIntegration = new SDKIntegration();

export function getSDK(): SDKIntegration {
  return sdkIntegration;
}

export const formatBalance = (b: bigint, d?: number) => sdkIntegration.formatBalance(b, d);
export const parseBalance = (s: string, d?: number) => sdkIntegration.parseBalance(s, d);

