/**
 * Atlas SDK Integration for DEX
 * 
 * Provides real SDK integration for swapping, balances, and Comit transactions
 */

'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import {
  AtlasSphereClient,
  ComitBfrontend/uilder,
  evmComit,
  svmComit,
  dualComit,
  formatBalance,
  parseBalance,
  NATIVE_ASSET_ID,
  NATIVE_ASSET_DECIMALS,
  DEFAULT_WS_ENDPOINT,
} from '@atlas-sphere/ts-sdk';
import type { ComitEvent } from '@atlas-sphere/ts-sdk';

// =============================================================================
// Types
// =============================================================================

export interface SDKState {
  isConnected: boolean;
  isConnecting: boolean;
  connectionError: string | null;
  chainInfo: ChainInfo | null;
  currentBlockNumber: number;
}

export interface ChainInfo {
  name: string;
  version: string;
  tokenSymbol: string;
  tokenDecimals: number;
}

export interface BalanceInfo {
  native: bigint;
  formatted: string;
}

export interface ComitResult {
  comitId: string;
  blockHash: string;
  blockNumber: number;
  success: boolean;
  gasUsed?: bigint;
  error?: string;
}

// =============================================================================
// Singleton SDK Client
// =============================================================================

let sdkClient: AtlasSphereClient | null = null;
let connectionPromise: Promise<AtlasSphereClient> | null = null;

function getEndpoint(): string {
  const envEndpoint = process.env.NEXT_PUBLIC_SUBSTRATE_WS_ENDPOINT;
  return envEndpoint && envEndpoint.length > 0 ? envEndpoint : DEFAULT_WS_ENDPOINT;
}

async function getClient(): Promise<AtlasSphereClient> {
  if (sdkClient?.isConnected) {
    return sdkClient;
  }

  if (connectionPromise) {
    return connectionPromise;
  }

  connectionPromise = (async () => {
    const endpoint = getEndpoint();
    console.log(`[DEX SDK] Connecting to ${endpoint}...`);

    sdkClient = new AtlasSphereClient({
      endpoint,
      useWebSocket: endpoint.startsWith('ws'),
      autoReconnect: true,
      rpcTimeoutMs: 30000,
      finalizationTimeoutMs: 60000,
    });

    await sdkClient.connect();
    console.log('[DEX SDK] Connected successfully');
    return sdkClient;
  })();

  try {
    const client = await connectionPromise;
    connectionPromise = null;
    return client;
  } catch (error) {
    connectionPromise = null;
    throw error;
  }
}

// =============================================================================
// Main SDK Hook
// =============================================================================

export function useAtlasSDK(autoConnect = true) {
  const [state, setState] = useState<SDKState>({
    isConnected: false,
    isConnecting: false,
    connectionError: null,
    chainInfo: null,
    currentBlockNumber: 0,
  });

  const blockSubRef = useRef<string | null>(null);
  const mountedRef = useRef(true);

  const safeSetState = useCallback((updates: Partial<SDKState>) => {
    if (mountedRef.current) {
      setState(prev => ({ ...prev, ...updates }));
    }
  }, []);

  const connect = useCallback(async () => {
    if (state.isConnecting || state.isConnected) return;

    safeSetState({ isConnecting: true, connectionError: null });

    try {
      const client = await getClient();
      const chainInfo = await client.getChainInfo();
      const blockNumber = await client.getBlockNumber();

      safeSetState({
        isConnected: true,
        isConnecting: false,
        chainInfo: {
          name: chainInfo.name,
          version: chainInfo.version,
          tokenSymbol: chainInfo.properties.tokenSymbol,
          tokenDecimals: chainInfo.properties.tokenDecimals,
        },
        currentBlockNumber: blockNumber,
      });

      // Subscribe to block updates
      blockSubRef.current = await client.subscribeNewBlocks((blockNum) => {
        safeSetState({ currentBlockNumber: blockNum });
      });
    } catch (error) {
      safeSetState({
        isConnecting: false,
        connectionError: error instanceof Error ? error.message : String(error),
      });
    }
  }, [state.isConnecting, state.isConnected, safeSetState]);

  const disconnect = useCallback(async () => {
    if (blockSubRef.current && sdkClient) {
      await sdkClient.unsubscribe(blockSubRef.current);
      blockSubRef.current = null;
    }
    
    if (sdkClient) {
      await sdkClient.disconnect();
      sdkClient = null;
    }

    safeSetState({
      isConnected: false,
      chainInfo: null,
      currentBlockNumber: 0,
    });
  }, [safeSetState]);

  // Auto-connect
  useEffect(() => {
    mountedRef.current = true;
    if (autoConnect) {
      connect();
    }
    return () => {
      mountedRef.current = false;
      if (blockSubRef.current && sdkClient) {
        sdkClient.unsubscribe(blockSubRef.current).catch(() => {});
      }
    };
  }, [autoConnect, connect]);

  return {
    ...state,
    connect,
    disconnect,
  };
}

// =============================================================================
// Balance Hook
// =============================================================================

export function useBalance(address: string | null, assetId = NATIVE_ASSET_ID, refreshInterval = 30000) {
  const [balance, setBalance] = useState<BalanceInfo | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchBalance = useCallback(async () => {
    if (!address) return;

    setIsLoading(true);
    setError(null);

    try {
      const client = await getClient();
      const rawBalance = await client.getCanonicalBalance(address, assetId);
      
      setBalance({
        native: rawBalance,
        formatted: formatBalance(rawBalance, NATIVE_ASSET_DECIMALS),
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setIsLoading(false);
    }
  }, [address, assetId]);

  useEffect(() => {
    if (address) {
      fetchBalance();
      const interval = setInterval(fetchBalance, refreshInterval);
      return () => clearInterval(interval);
    }
  }, [address, fetchBalance, refreshInterval]);

  return { balance, isLoading, error, refresh: fetchBalance };
}

// =============================================================================
// Authorization Hook
// =============================================================================

export function useIsAuthorized(address: string | null) {
  const [isAuthorized, setIsAuthorized] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    if (!address) {
      setIsAuthorized(false);
      return;
    }

    const checkAuth = async () => {
      setIsLoading(true);
      try {
        const client = await getClient();
        const authorized = await client.isAuthorized(address);
        setIsAuthorized(authorized);
      } catch {
        setIsAuthorized(false);
      } finally {
        setIsLoading(false);
      }
    };

    checkAuth();
  }, [address]);

  return { isAuthorized, isLoading };
}

// =============================================================================
// Comit Submission Hook
// =============================================================================

export function useComitSubmission() {
  const [isPending, setIsPending] = useState(false);
  const [lastResult, setLastResult] = useState<ComitResult | null>(null);
  const [history, setHistory] = useState<ComitResult[]>([]);

  const submitEvmComit = useCallback(async (
    signer: string,
    evmPayload: Uint8Array | string,
    fee?: bigint
  ): Promise<ComitResult> => {
    setIsPending(true);
    
    try {
      const client = await getClient();
      const bfrontend/uilder = evmComit(evmPayload);
      if (fee) {
        bfrontend/uilder.withFee(fee);
      } else {
        bfrontend/uilder.withFee('auto');
      }
      const comitInput = bfrontend/uilder.bfrontend/uild();
      
      const result = await client.submitComit(comitInput, signer);
      
      const comitResult: ComitResult = {
        comitId: result.comit.comitId,
        blockHash: result.blockHash,
        blockNumber: result.blockNumber,
        success: result.evmReceipt?.success ?? true,
        gasUsed: result.evmReceipt?.gasUsed ? BigInt(result.evmReceipt.gasUsed) : undefined,
      };

      setLastResult(comitResult);
      setHistory(prev => [comitResult, ...prev].slice(0, 50));
      return comitResult;
    } catch (error) {
      const errorResult: ComitResult = {
        comitId: '',
        blockHash: '',
        blockNumber: 0,
        success: false,
        error: String(error),
      };
      setLastResult(errorResult);
      throw error;
    } finally {
      setIsPending(false);
    }
  }, []);

  const submitSvmComit = useCallback(async (
    signer: string,
    svmPayload: Uint8Array | string,
    fee?: bigint
  ): Promise<ComitResult> => {
    setIsPending(true);
    
    try {
      const client = await getClient();
      const bfrontend/uilder = svmComit(svmPayload);
      if (fee) {
        bfrontend/uilder.withFee(fee);
      } else {
        bfrontend/uilder.withFee('auto');
      }
      const comitInput = bfrontend/uilder.bfrontend/uild();
      
      const result = await client.submitComit(comitInput, signer);
      
      const comitResult: ComitResult = {
        comitId: result.comit.comitId,
        blockHash: result.blockHash,
        blockNumber: result.blockNumber,
        success: result.svmReceipt?.success ?? true,
        gasUsed: result.svmReceipt?.gasUsed ? BigInt(result.svmReceipt.gasUsed) : undefined,
      };

      setLastResult(comitResult);
      setHistory(prev => [comitResult, ...prev].slice(0, 50));
      return comitResult;
    } catch (error) {
      const errorResult: ComitResult = {
        comitId: '',
        blockHash: '',
        blockNumber: 0,
        success: false,
        error: String(error),
      };
      setLastResult(errorResult);
      throw error;
    } finally {
      setIsPending(false);
    }
  }, []);

  const submitDualComit = useCallback(async (
    signer: string,
    evmPayload: Uint8Array | string,
    svmPayload: Uint8Array | string,
    fee?: bigint
  ): Promise<ComitResult> => {
    setIsPending(true);
    
    try {
      const client = await getClient();
      const bfrontend/uilder = dualComit(evmPayload, svmPayload);
      if (fee) {
        bfrontend/uilder.withFee(fee);
      } else {
        bfrontend/uilder.withFee('auto');
      }
      const comitInput = bfrontend/uilder.bfrontend/uild();
      
      const result = await client.submitComit(comitInput, signer);
      
      const comitResult: ComitResult = {
        comitId: result.comit.comitId,
        blockHash: result.blockHash,
        blockNumber: result.blockNumber,
        success: (result.evmReceipt?.success ?? true) && (result.svmReceipt?.success ?? true),
      };

      setLastResult(comitResult);
      setHistory(prev => [comitResult, ...prev].slice(0, 50));
      return comitResult;
    } catch (error) {
      const errorResult: ComitResult = {
        comitId: '',
        blockHash: '',
        blockNumber: 0,
        success: false,
        error: String(error),
      };
      setLastResult(errorResult);
      throw error;
    } finally {
      setIsPending(false);
    }
  }, []);

  return {
    isPending,
    lastResult,
    history,
    submitEvmComit,
    submitSvmComit,
    submitDualComit,
    clearHistory: () => {
      setHistory([]);
      setLastResult(null);
    },
  };
}

// =============================================================================
// Comit Events Hook
// =============================================================================

export function useComitEvents(address: string | null) {
  const [events, setEvents] = useState<ComitEvent[]>([]);
  const [isSubscribed, setIsSubscribed] = useState(false);
  const subIdRef = useRef<string | null>(null);

  useEffect(() => {
    if (!address) return;

    const subscribe = async () => {
      try {
        const client = await getClient();
        subIdRef.current = await client.subscribeComitEvents(address, (event) => {
          setEvents(prev => [event, ...prev].slice(0, 100));
        });
        setIsSubscribed(true);
      } catch (error) {
        console.error('[DEX SDK] Failed to subscribe to Comit events:', error);
      }
    };

    subscribe();

    return () => {
      if (subIdRef.current && sdkClient) {
        sdkClient.unsubscribe(subIdRef.current).catch(() => {});
        subIdRef.current = null;
      }
      setIsSubscribed(false);
    };
  }, [address]);

  return {
    events,
    isSubscribed,
    clearEvents: () => setEvents([]),
  };
}
