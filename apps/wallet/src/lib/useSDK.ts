/**
 * React hook for Atlas Sphere SDK integration
 * 
 * Provides a clean React interface for SDK operations with
 * automatic connection management and state tracking.
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import {
  sdkIntegration,
  BalanceInfo,
  ComitSubmissionResult,
  WalletConfig,
} from './sdkIntegration';
import type { ComitEvent } from '@atlas-sphere/ts-sdk';

// =============================================================================
// Types
// =============================================================================

export interface UseSDKState {
  isConnected: boolean;
  isConnecting: boolean;
  connectionError: string | null;
  chainInfo: {
    name: string;
    version: string;
    tokenSymbol: string;
    tokenDecimals: number;
  } | null;
  currentBlockNumber: number;
}

export interface UseSDKActions {
  connect: () => Promise<void>;
  disconnect: () => Promise<void>;
  configure: (config: Partial<WalletConfig>) => void;
  getBalance: (address: string) => Promise<BalanceInfo>;
  getCanonicalBalance: (address: string, assetId?: number) => Promise<BalanceInfo>;
  isAuthorized: (address: string) => Promise<boolean>;
  submitEvmComit: (signer: string, payload: Uint8Array | string, fee?: bigint) => Promise<ComitSubmissionResult>;
  submitSvmComit: (signer: string, payload: Uint8Array | string, fee?: bigint) => Promise<ComitSubmissionResult>;
  submitDualComit: (signer: string, evmPayload: Uint8Array | string, svmPayload: Uint8Array | string, fee?: bigint) => Promise<ComitSubmissionResult>;
  subscribeToBlocks: (callback: (blockNumber: number, blockHash: string) => void) => Promise<string>;
  subscribeToComitEvents: (address: string, callback: (event: ComitEvent) => void) => Promise<string>;
  unsubscribe: (subscriptionId: string) => Promise<boolean>;
}

export type UseSDKReturn = UseSDKState & UseSDKActions;

// =============================================================================
// Hook Implementation
// =============================================================================

export function useSDK(autoConnect: boolean = true): UseSDKReturn {
  const [state, setState] = useState<UseSDKState>({
    isConnected: false,
    isConnecting: false,
    connectionError: null,
    chainInfo: null,
    currentBlockNumber: 0,
  });

  const blockSubRef = useRef<string | null>(null);
  const mountedRef = useRef(true);

  // Safe state update
  const safeSetState = useCallback((updates: Partial<UseSDKState>) => {
    if (mountedRef.current) {
      setState(prev => ({ ...prev, ...updates }));
    }
  }, []);

  // Connect to the SDK
  const connect = useCallback(async () => {
    if (state.isConnecting || state.isConnected) {
      return;
    }

    safeSetState({ isConnecting: true, connectionError: null });

    try {
      await sdkIntegration.connect();
      
      // Get chain info
      const chainInfo = await sdkIntegration.getChainInfo();
      const blockNumber = await sdkIntegration.getBlockNumber();

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
      blockSubRef.current = await sdkIntegration.subscribeToBlocks((blockNumber) => {
        safeSetState({ currentBlockNumber: blockNumber });
      });
    } catch (error) {
      safeSetState({
        isConnecting: false,
        connectionError: error instanceof Error ? error.message : String(error),
      });
    }
  }, [state.isConnecting, state.isConnected, safeSetState]);

  // Disconnect from the SDK
  const disconnect = useCallback(async () => {
    if (blockSubRef.current) {
      await sdkIntegration.unsubscribe(blockSubRef.current);
      blockSubRef.current = null;
    }
    await sdkIntegration.disconnect();
    safeSetState({
      isConnected: false,
      chainInfo: null,
      currentBlockNumber: 0,
    });
  }, [safeSetState]);

  // Configure the SDK
  const configure = useCallback((config: Partial<WalletConfig>) => {
    sdkIntegration.configure(config);
  }, []);

  // Balance operations
  const getBalance = useCallback(async (address: string) => {
    return sdkIntegration.getBalance(address);
  }, []);

  const getCanonicalBalance = useCallback(async (address: string, assetId?: number) => {
    return sdkIntegration.getCanonicalBalance(address, assetId);
  }, []);

  // Authorization check
  const isAuthorized = useCallback(async (address: string) => {
    return sdkIntegration.isAuthorized(address);
  }, []);

  // Comit submission
  const submitEvmComit = useCallback(async (
    signer: string,
    payload: Uint8Array | string,
    fee?: bigint
  ) => {
    return sdkIntegration.submitEvmComit(signer, payload, fee);
  }, []);

  const submitSvmComit = useCallback(async (
    signer: string,
    payload: Uint8Array | string,
    fee?: bigint
  ) => {
    return sdkIntegration.submitSvmComit(signer, payload, fee);
  }, []);

  const submitDualComit = useCallback(async (
    signer: string,
    evmPayload: Uint8Array | string,
    svmPayload: Uint8Array | string,
    fee?: bigint
  ) => {
    return sdkIntegration.submitDualComit(signer, evmPayload, svmPayload, fee);
  }, []);

  // Subscriptions
  const subscribeToBlocks = useCallback(async (
    callback: (blockNumber: number, blockHash: string) => void
  ) => {
    return sdkIntegration.subscribeToBlocks((bn, hash) => callback(bn, hash ?? ''));
  }, []);

  const subscribeToComitEvents = useCallback(async (
    address: string,
    callback: (event: ComitEvent) => void
  ) => {
    return sdkIntegration.subscribeToComitEvents(address, callback);
  }, []);

  const unsubscribe = useCallback(async (subscriptionId: string) => {
    return sdkIntegration.unsubscribe(subscriptionId);
  }, []);

  // Auto-connect on mount
  useEffect(() => {
    mountedRef.current = true;

    if (autoConnect) {
      connect();
    }

    return () => {
      mountedRef.current = false;
      // Clean up subscriptions but don't disconnect (might be used elsewhere)
      if (blockSubRef.current) {
        sdkIntegration.unsubscribe(blockSubRef.current).catch(() => {});
        blockSubRef.current = null;
      }
    };
  }, [autoConnect, connect]);

  return {
    ...state,
    connect,
    disconnect,
    configure,
    getBalance,
    getCanonicalBalance,
    isAuthorized,
    submitEvmComit,
    submitSvmComit,
    submitDualComit,
    subscribeToBlocks,
    subscribeToComitEvents,
    unsubscribe,
  };
}

// =============================================================================
// Specialized Hooks
// =============================================================================

/**
 * Hook for tracking account balance
 */
export function useAccountBalance(address: string | undefined, refreshInterval = 30000) {
  const [balance, setBalance] = useState<BalanceInfo | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    if (!address) return;
    
    setLoading(true);
    setError(null);
    
    try {
      const bal = await sdkIntegration.getCanonicalBalance(address);
      setBalance(bal);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  }, [address]);

  useEffect(() => {
    if (address) {
      refresh();
      const interval = setInterval(refresh, refreshInterval);
      return () => clearInterval(interval);
    }
  }, [address, refresh, refreshInterval]);

  return { balance, loading, error, refresh };
}

/**
 * Hook for tracking Comit events
 */
export function useComitEvents(address: string | undefined) {
  const [events, setEvents] = useState<ComitEvent[]>([]);
  const [subscribed, setSubscribed] = useState(false);
  const subIdRef = useRef<string | null>(null);

  useEffect(() => {
    if (!address) return;

    const subscribe = async () => {
      try {
        subIdRef.current = await sdkIntegration.subscribeToComitEvents(
          address,
          (event) => {
            setEvents(prev => [event, ...prev].slice(0, 100)); // Keep last 100
          }
        );
        setSubscribed(true);
      } catch (err) {
        console.error('Failed to subscribe to Comit events:', err);
      }
    };

    subscribe();

    return () => {
      if (subIdRef.current) {
        sdkIntegration.unsubscribe(subIdRef.current).catch(() => {});
        subIdRef.current = null;
      }
      setSubscribed(false);
    };
  }, [address]);

  const clearEvents = useCallback(() => {
    setEvents([]);
  }, []);

  return { events, subscribed, clearEvents };
}

/**
 * Hook for submitting Comits with status tracking
 */
export function useComitSubmission() {
  const [pending, setPending] = useState(false);
  const [lastResult, setLastResult] = useState<ComitSubmissionResult | null>(null);
  const [history, setHistory] = useState<ComitSubmissionResult[]>([]);

  const submit = useCallback(async (
    type: 'evm' | 'svm' | 'dual',
    signer: string,
    evmPayload?: Uint8Array | string,
    svmPayload?: Uint8Array | string,
    fee?: bigint
  ): Promise<ComitSubmissionResult> => {
    setPending(true);

    try {
      let result: ComitSubmissionResult;

      switch (type) {
        case 'evm':
          if (!evmPayload) throw new Error('EVM payload reqfrontend/uired');
          result = await sdkIntegration.submitEvmComit(signer, evmPayload, fee);
          break;
        case 'svm':
          if (!svmPayload) throw new Error('SVM payload reqfrontend/uired');
          result = await sdkIntegration.submitSvmComit(signer, svmPayload, fee);
          break;
        case 'dual':
          if (!evmPayload || !svmPayload) throw new Error('Both payloads reqfrontend/uired');
          result = await sdkIntegration.submitDualComit(signer, evmPayload, svmPayload, fee);
          break;
      }

      setLastResult(result);
      setHistory(prev => [result, ...prev].slice(0, 50));
      return result;
    } finally {
      setPending(false);
    }
  }, []);

  const clearHistory = useCallback(() => {
    setHistory([]);
    setLastResult(null);
  }, []);

  return {
    submit,
    pending,
    lastResult,
    history,
    clearHistory,
  };
}
