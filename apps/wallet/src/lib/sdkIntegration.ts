/**
 * SDK Integration Layer for Atlas Sphere Wallet
 * 
 * Provides production-ready SDK wrappers for wallet operations
 * with proper error handling, caching, and event subscriptions.
 */

import {
  AtlasSphereClient,
  ComitBuilder,
  evmComit,
  svmComit,
  dualComit,
  QueryClient,
  createQueryClient,
  formatBalance,
  parseBalance,
  NATIVE_ASSET_ID,
  NATIVE_ASSET_SYMBOL,
  NATIVE_ASSET_DECIMALS,
  DEFAULT_WS_ENDPOINT,
  ComitEvent,
  ConnectionError,
  RpcError,
} from '@atlas-sphere/ts-sdk';

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
// SDK Integration Class
// =============================================================================

/**
 * Singleton SDK integration manager for wallet operations
 */
class SDKIntegration {
  private client: AtlasSphereClient | null = null;
  private queryClient: QueryClient | null = null;
  private config: WalletConfig;
  private connectionPromise: Promise<void> | null = null;
  private subscriptions: Map<string, () => void> = new Map();

  constructor() {
    this.config = {
      endpoint: process.env.NEXT_PUBLIC_SUBSTRATE_RPC_ENDPOINT || DEFAULT_WS_ENDPOINT,
      useWebSocket: true,
      rpcTimeoutMs: 30000,
      finalizationTimeoutMs: 60000,
      autoReconnect: true,
    };
  }

  /**
   * Configure the SDK with custom options
   */
  configure(config: Partial<WalletConfig>): void {
    this.config = { ...this.config, ...config };
    // Reconnect with new config if already connected
    if (this.client?.isConnected) {
      this.disconnect().then(() => this.connect());
    }
  }

  /**
   * Connect to the Atlas Sphere node
   */
  async connect(): Promise<AtlasSphereClient> {
    if (this.client?.isConnected) {
      return this.client;
    }

    // Prevent multiple simultaneous connection attempts
    if (this.connectionPromise) {
      await this.connectionPromise;
      return this.client!;
    }

    this.connectionPromise = this.performConnect();
    await this.connectionPromise;
    this.connectionPromise = null;

    return this.client!;
  }

  private async performConnect(): Promise<void> {
    try {
      this.client = new AtlasSphereClient({
        endpoint: this.config.endpoint,
        useWebSocket: this.config.useWebSocket,
        rpcTimeoutMs: this.config.rpcTimeoutMs,
        finalizationTimeoutMs: this.config.finalizationTimeoutMs,
        autoReconnect: this.config.autoReconnect,
      });

      await this.client.connect();

      // Initialize query client with caching
      this.queryClient = await createQueryClient({
        endpoint: this.config.endpoint,
        useWebSocket: this.config.useWebSocket,
      });

      console.log('[SDK] Connected to Atlas Sphere node');
    } catch (error) {
      console.error('[SDK] Connection failed:', error);
      throw new ConnectionError(
        this.config.endpoint,
        error instanceof Error ? error : new Error(String(error))
      );
    }
  }

  /**
   * Disconnect from the node
   */
  async disconnect(): Promise<void> {
    // Clear all subscriptions
    for (const [id, unsub] of this.subscriptions) {
      try {
        unsub();
      } catch {
        // Ignore
      }
      this.subscriptions.delete(id);
    }

    if (this.client) {
      await this.client.disconnect();
      this.client = null;
    }
    this.queryClient = null;
    console.log('[SDK] Disconnected from Atlas Sphere node');
  }

  /**
   * Check if connected
   */
  isConnected(): boolean {
    return this.client?.isConnected ?? false;
  }

  /**
   * Get the underlying client
   */
  getClient(): AtlasSphereClient {
    if (!this.client?.isConnected) {
      throw new Error('Not connected to Atlas Sphere. Call connect() first.');
    }
    return this.client;
  }

  // ===========================================================================
  // Balance Operations
  // ===========================================================================

  /**
   * Get native balance for an account
   */
  async getBalance(address: string): Promise<BalanceInfo> {
    const client = await this.connect();
    
    try {
      const balance = await client.getBalance(address);
      return {
        native: balance,
        formatted: formatBalance(balance, NATIVE_ASSET_DECIMALS),
      };
    } catch (error) {
      console.error('[SDK] Failed to get balance:', error);
      throw new RpcError('getBalance', String(error));
    }
  }

  /**
   * Get canonical ledger balance
   */
  async getCanonicalBalance(address: string, assetId: number = NATIVE_ASSET_ID): Promise<BalanceInfo> {
    const client = await this.connect();

    try {
      const balance = await client.getCanonicalBalance(address, assetId);
      return {
        native: balance,
        formatted: formatBalance(balance, NATIVE_ASSET_DECIMALS),
      };
    } catch (error) {
      console.error('[SDK] Failed to get canonical balance:', error);
      throw new RpcError('getCanonicalBalance', String(error));
    }
  }

  /**
   * Get balances for multiple assets
   */
  async getMultipleBalances(
    address: string,
    assetIds: number[]
  ): Promise<Map<number, BalanceInfo>> {
    const client = await this.connect();
    const results = new Map<number, BalanceInfo>();

    await Promise.all(
      assetIds.map(async (assetId) => {
        try {
          const balance = await client.getCanonicalBalance(address, assetId);
          const metadata = await client.getAssetMetadata(assetId);
          const decimals = metadata?.decimals ?? NATIVE_ASSET_DECIMALS;
          
          results.set(assetId, {
            native: balance,
            formatted: formatBalance(balance, decimals),
          });
        } catch (error) {
          console.warn(`[SDK] Failed to get balance for asset ${assetId}:`, error);
        }
      })
    );

    return results;
  }

  // ===========================================================================
  // Comit Operations
  // ===========================================================================

  /**
   * Submit an EVM-only Comit transaction
   */
  async submitEvmComit(
    signer: string,
    evmPayload: Uint8Array | string,
    fee?: bigint
  ): Promise<ComitSubmissionResult> {
    const client = await this.connect();

    try {
      // Build the comit
      const builder = evmComit(evmPayload);
      if (fee) {
        builder.withFee(fee);
      } else {
        builder.withFee('auto');
      }
      const comitInput = builder.build();

      // Submit
      const result = await client.submitComit(comitInput, signer);

      return {
        comitId: result.comit.comitId,
        blockHash: result.blockHash,
        blockNumber: result.blockNumber,
        success: result.evmReceipt?.success ?? true,
        gasUsed: result.evmReceipt?.gasUsed ? BigInt(result.evmReceipt.gasUsed) : undefined,
      };
    } catch (error) {
      console.error('[SDK] EVM Comit submission failed:', error);
      return {
        comitId: '',
        blockHash: '',
        blockNumber: 0,
        success: false,
        error: String(error),
      };
    }
  }

  /**
   * Submit an SVM-only Comit transaction
   */
  async submitSvmComit(
    signer: string,
    svmPayload: Uint8Array | string,
    fee?: bigint
  ): Promise<ComitSubmissionResult> {
    const client = await this.connect();

    try {
      const builder = svmComit(svmPayload);
      if (fee) {
        builder.withFee(fee);
      } else {
        builder.withFee('auto');
      }
      const comitInput = builder.build();

      const result = await client.submitComit(comitInput, signer);

      return {
        comitId: result.comit.comitId,
        blockHash: result.blockHash,
        blockNumber: result.blockNumber,
        success: result.svmReceipt?.success ?? true,
        gasUsed: result.svmReceipt?.gasUsed ? BigInt(result.svmReceipt.gasUsed) : undefined,
      };
    } catch (error) {
      console.error('[SDK] SVM Comit submission failed:', error);
      return {
        comitId: '',
        blockHash: '',
        blockNumber: 0,
        success: false,
        error: String(error),
      };
    }
  }

  /**
   * Submit a dual-VM Comit transaction
   */
  async submitDualComit(
    signer: string,
    evmPayload: Uint8Array | string,
    svmPayload: Uint8Array | string,
    fee?: bigint
  ): Promise<ComitSubmissionResult> {
    const client = await this.connect();

    try {
      const builder = dualComit(evmPayload, svmPayload);
      if (fee) {
        builder.withFee(fee);
      } else {
        builder.withFee('auto');
      }
      const comitInput = builder.build();

      const result = await client.submitComit(comitInput, signer);

      return {
        comitId: result.comit.comitId,
        blockHash: result.blockHash,
        blockNumber: result.blockNumber,
        success: (result.evmReceipt?.success ?? true) && (result.svmReceipt?.success ?? true),
        gasUsed: result.evmReceipt?.gasUsed ? BigInt(result.evmReceipt.gasUsed) : undefined,
      };
    } catch (error) {
      console.error('[SDK] Dual Comit submission failed:', error);
      return {
        comitId: '',
        blockHash: '',
        blockNumber: 0,
        success: false,
        error: String(error),
      };
    }
  }

  /**
   * Submit a custom Comit transaction using ComitBuilder
   */
  async submitCustomComit(
    signer: string,
    buildFn: (builder: ComitBuilder) => ComitBuilder
  ): Promise<ComitSubmissionResult> {
    const client = await this.connect();

    try {
      const builder = new ComitBuilder();
      const comitInput = buildFn(builder).build();

      const result = await client.submitComit(comitInput, signer);

      return {
        comitId: result.comit.comitId,
        blockHash: result.blockHash,
        blockNumber: result.blockNumber,
        success: true,
      };
    } catch (error) {
      console.error('[SDK] Custom Comit submission failed:', error);
      return {
        comitId: '',
        blockHash: '',
        blockNumber: 0,
        success: false,
        error: String(error),
      };
    }
  }

  // ===========================================================================
  // Account Operations
  // ===========================================================================

  /**
   * Check if an account is authorized to submit Comits
   */
  async isAuthorized(address: string): Promise<boolean> {
    const client = await this.connect();
    return client.isAuthorized(address);
  }

  /**
   * Get the current nonce for an account
   */
  async getNonce(address: string): Promise<bigint> {
    const client = await this.connect();
    return client.getNonce(address);
  }

  // ===========================================================================
  // Chain Information
  // ===========================================================================

  /**
   * Get chain information
   */
  async getChainInfo() {
    const client = await this.connect();
    return client.getChainInfo();
  }

  /**
   * Get current block number
   */
  async getBlockNumber(): Promise<number> {
    const client = await this.connect();
    return client.getBlockNumber();
  }

  /**
   * Get finalized block number
   */
  async getFinalizedBlockNumber(): Promise<number> {
    const client = await this.connect();
    return client.getFinalizedBlockNumber();
  }

  // ===========================================================================
  // Subscriptions
  // ===========================================================================

  /**
   * Subscribe to new blocks
   */
  async subscribeToBlocks(
    callback: (blockNumber: number, blockHash: string) => void
  ): Promise<string> {
    const client = await this.connect();
    const subId = await client.subscribeNewBlocks(callback);
    return subId;
  }

  /**
   * Subscribe to finalized blocks
   */
  async subscribeToFinalizedBlocks(
    callback: (blockNumber: number, blockHash: string) => void
  ): Promise<string> {
    const client = await this.connect();
    const subId = await client.subscribeFinalizedBlocks(callback);
    return subId;
  }

  /**
   * Subscribe to Comit events for an account
   */
  async subscribeToComitEvents(
    address: string,
    callback: (event: ComitEvent) => void
  ): Promise<string> {
    const client = await this.connect();
    const subId = await client.subscribeComitEvents(address, callback);
    return subId;
  }

  /**
   * Unsubscribe from a subscription
   */
  async unsubscribe(subscriptionId: string): Promise<boolean> {
    if (!this.client?.isConnected) {
      return false;
    }
    return this.client.unsubscribe(subscriptionId);
  }
}

// =============================================================================
// Singleton Export
// =============================================================================

/**
 * Singleton SDK integration instance
 */
export const sdkIntegration = new SDKIntegration();

/**
 * Get the SDK integration instance
 */
export function getSDK(): SDKIntegration {
  return sdkIntegration;
}

// Re-export useful SDK types and utilities
export {
  AtlasSphereClient,
  ComitBuilder,
  evmComit,
  svmComit,
  dualComit,
  formatBalance,
  parseBalance,
  NATIVE_ASSET_ID,
  NATIVE_ASSET_SYMBOL,
  NATIVE_ASSET_DECIMALS,
  DEFAULT_WS_ENDPOINT,
};
