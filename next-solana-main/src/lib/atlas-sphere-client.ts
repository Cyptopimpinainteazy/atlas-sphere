/**
 * Atlas Sphere Chain Client
 *
 * Provides interface for interacting with the Atlas Sphere L1 blockchain,
 * including the Atlas Kernel pallet for atomic cross-VM (EVM/SVM) execution.
 * 
 * Uses HTTP/JSON-RPC for browser compatibility.
 */

// Atlas Sphere RPC endpoints
export const ATLAS_RPC_ENDPOINTS = {
  testnet: process.env.NEXT_PUBLIC_ATLAS_RPC_ENDPOINT || 'http://rpc.testnet.atlas-sphere.io:9944',
  local: process.env.NEXT_PUBLIC_ATLAS_LOCAL_RPC || 'http://127.0.0.1:9944',
  mainnet: process.env.NEXT_PUBLIC_ATLAS_MAINNET_RPC || 'http://rpc.atlas-sphere.io:9944',
} as const;

// Atlas Kernel types for Comit transactions
export interface ComitPayload {
  vm: 'EVM' | 'SVM';
  bytecode: Uint8Array;
  calldata: Uint8Array;
  gasLimit: bigint;
  target?: string; // Contract address for EVM, program ID for SVM
}

export interface ComitTransaction {
  nonce: number;
  evmPayload?: ComitPayload;
  svmPayload?: ComitPayload;
  prepareRoot: Uint8Array; // 32-byte hash of inputs
  atomicFlag: boolean;
}

export interface ExecutionReceipt {
  success: boolean;
  gasUsed: bigint;
  returnData: Uint8Array;
  logs: ComitLog[];
  stateChanges: StateChange[];
}

export interface ComitLog {
  address: string;
  topics: Uint8Array[];
  data: Uint8Array;
}

export interface StateChange {
  account: string;
  assetId: number;
  oldBalance: bigint;
  newBalance: bigint;
}

export interface CanonicalAsset {
  id: number;
  symbol: string;
  decimals: number;
  totalSupply: bigint;
}

interface JsonRpcResponse<T> {
  jsonrpc: string;
  id: number;
  result?: T;
  error?: { code: number; message: string };
}

/**
 * Atlas Sphere Client for interacting with the chain via JSON-RPC
 */
export class AtlasSphereClient {
  private endpoint: string;
  private requestId: number = 0;
  private connected: boolean = false;

  constructor(endpoint: string = ATLAS_RPC_ENDPOINTS.testnet) {
    this.endpoint = endpoint;
  }

  /**
   * Make a JSON-RPC call
   */
  private async rpcCall<T>(method: string, params: unknown[] = []): Promise<T> {
    const response = await fetch(this.endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        jsonrpc: '2.0',
        id: ++this.requestId,
        method,
        params,
      }),
    });

    if (!response.ok) {
      throw new Error(`HTTP error: ${response.status}`);
    }

    const data: JsonRpcResponse<T> = await response.json();

    if (data.error) {
      throw new Error(`RPC error: ${data.error.message}`);
    }

    return data.result as T;
  }

  /**
   * Connect to the Atlas Sphere chain
   */
  async connect(): Promise<boolean> {
    try {
      // Test connection with system_health call
      await this.rpcCall('system_health');
      this.connected = true;
      console.log(`Connected to Atlas Sphere: ${this.endpoint}`);
      return true;
    } catch (error) {
      console.error('Failed to connect to Atlas Sphere:', error);
      this.connected = false;
      return false;
    }
  }

  /**
   * Disconnect (no-op for HTTP)
   */
  async disconnect(): Promise<void> {
    this.connected = false;
  }

  /**
   * Check if connected
   */
  isConnected(): boolean {
    return this.connected;
  }

  /**
   * Get canonical balance for an account
   */
  async getCanonicalBalance(account: string, assetId: number = 0): Promise<bigint> {
    try {
      const result = await this.rpcCall<string>('atlasKernel_getCanonicalBalance', [
        account,
        assetId,
      ]);
      return BigInt(result || '0');
    } catch (error) {
      console.error('Failed to get canonical balance:', error);
      return BigInt(0);
    }
  }

  /**
   * Check if an account is authorized for Comit submissions
   */
  async isAuthorized(account: string): Promise<boolean> {
    try {
      const result = await this.rpcCall<boolean>('atlasKernel_isAuthorized', [account]);
      return result ?? false;
    } catch (error) {
      console.error('Failed to check authorization:', error);
      return false;
    }
  }

  /**
   * Get asset metadata
   */
  async getAssetMetadata(assetId: number): Promise<CanonicalAsset | null> {
    try {
      const result = await this.rpcCall<{
        symbol: string;
        decimals: number;
        totalSupply: string;
      }>('atlasKernel_getAssetMetadata', [assetId]);

      if (result) {
        return {
          id: assetId,
          symbol: result.symbol,
          decimals: result.decimals,
          totalSupply: BigInt(result.totalSupply),
        };
      }
      return null;
    } catch (error) {
      console.error('Failed to get asset metadata:', error);
      return null;
    }
  }

  /**
   * Submit a Comit transaction for atomic cross-VM execution
   */
  async submitComit(
    signer: string,
    comit: ComitTransaction
  ): Promise<{ txHash: string; receipt?: ExecutionReceipt }> {
    // Encode the Comit transaction
    const encodedComit = {
      nonce: comit.nonce,
      evmPayload: comit.evmPayload
        ? {
            vm: comit.evmPayload.vm,
            bytecode: Array.from(comit.evmPayload.bytecode),
            calldata: Array.from(comit.evmPayload.calldata),
            gasLimit: comit.evmPayload.gasLimit.toString(),
            target: comit.evmPayload.target,
          }
        : null,
      svmPayload: comit.svmPayload
        ? {
            vm: comit.svmPayload.vm,
            bytecode: Array.from(comit.svmPayload.bytecode),
            calldata: Array.from(comit.svmPayload.calldata),
            gasLimit: comit.svmPayload.gasLimit.toString(),
            target: comit.svmPayload.target,
          }
        : null,
      prepareRoot: Array.from(comit.prepareRoot),
      atomicFlag: comit.atomicFlag,
    };

    try {
      const result = await this.rpcCall<{
        txHash: string;
        receipt?: {
          success: boolean;
          gasUsed: string;
          returnData: number[];
        };
      }>('atlasKernel_submitComit', [signer, encodedComit]);

      return {
        txHash: result.txHash,
        receipt: result.receipt
          ? {
              success: result.receipt.success,
              gasUsed: BigInt(result.receipt.gasUsed),
              returnData: new Uint8Array(result.receipt.returnData),
              logs: [],
              stateChanges: [],
            }
          : undefined,
      };
    } catch (error) {
      throw new Error(`Failed to submit Comit: ${error}`);
    }
  }

  /**
   * Get chain info
   */
  async getChainInfo(): Promise<{
    chain: string;
    nodeName: string;
    nodeVersion: string;
    ss58Format: number;
  }> {
    try {
      const [chain, name, version] = await Promise.all([
        this.rpcCall<string>('system_chain'),
        this.rpcCall<string>('system_name'),
        this.rpcCall<string>('system_version'),
      ]);

      return {
        chain: chain || 'Atlas Sphere',
        nodeName: name || 'Unknown',
        nodeVersion: version || '0.0.0',
        ss58Format: 42,
      };
    } catch (error) {
      // Return defaults if RPC fails
      return {
        chain: 'Atlas Sphere (Offline)',
        nodeName: 'Unknown',
        nodeVersion: '0.0.0',
        ss58Format: 42,
      };
    }
  }

  /**
   * Get latest block number
   */
  async getBlockNumber(): Promise<number> {
    try {
      const header = await this.rpcCall<{ number: string }>('chain_getHeader');
      return parseInt(header.number, 16);
    } catch (error) {
      console.error('Failed to get block number:', error);
      return 0;
    }
  }
}

// Singleton instance for the default endpoint
let defaultClient: AtlasSphereClient | null = null;

export function getAtlasSphereClient(endpoint?: string): AtlasSphereClient {
  if (endpoint) {
    return new AtlasSphereClient(endpoint);
  }

  if (!defaultClient) {
    defaultClient = new AtlasSphereClient();
  }

  return defaultClient;
}

// Helper to compute prepare root hash
export function computePrepareRoot(inputs: Uint8Array[]): Uint8Array {
  // Simple hash of concatenated inputs
  // In production, use proper cryptographic hashing
  const combined = new Uint8Array(inputs.reduce((acc, arr) => acc + arr.length, 0));
  let offset = 0;
  for (const input of inputs) {
    combined.set(input, offset);
    offset += input.length;
  }

  // Return first 32 bytes or pad with zeros
  const result = new Uint8Array(32);
  result.set(combined.slice(0, 32));
  return result;
}
