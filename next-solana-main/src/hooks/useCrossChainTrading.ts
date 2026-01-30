/**
 * Cross-Chain Trading React Hooks
 *
 * Provides React hooks for atomic cross-chain trading between
 * Solana and Atlas Sphere.
 */

'use client';

import { useState, useCallback, useEffect, useMemo } from 'react';
import { useWalletUi } from '@wallet-ui/react';
import {
  getCrossChainTradingEngine,
  CROSS_CHAIN_ASSETS,
  EVM_DEX_ROUTERS,
  EVM_SWAP_SIGNATURES,
  type CrossChainAsset,
  type CrossChainOrder,
  type SwapQuote,
  type AtomicSwapResult,
  type ChainType,
} from '@/lib/cross-chain-trading';
import { getAtlasSphereClient } from '@/lib/atlas-sphere-client';

// Re-export types and constants
export type { CrossChainAsset, CrossChainOrder, SwapQuote, AtomicSwapResult, ChainType };
export { CROSS_CHAIN_ASSETS, EVM_DEX_ROUTERS, EVM_SWAP_SIGNATURES };

export interface CrossChainState {
  isConnected: boolean;
  chainInfo: {
    chain: string;
    nodeName: string;
    nodeVersion: string;
  } | null;
  isLoading: boolean;
  error: string | null;
}

export interface SwapState {
  inputAsset: CrossChainAsset | null;
  outputAsset: CrossChainAsset | null;
  inputAmount: string;
  quote: SwapQuote | null;
  isQuoting: boolean;
  isSwapping: boolean;
  lastResult: AtomicSwapResult | null;
}

/**
 * Hook for Atlas Sphere chain connection
 */
export function useAtlasSphere() {
  const [state, setState] = useState<CrossChainState>({
    isConnected: false,
    chainInfo: null,
    isLoading: false,
    error: null,
  });

  const client = useMemo(() => getAtlasSphereClient(), []);

  const connect = useCallback(async () => {
    setState((prev) => ({ ...prev, isLoading: true, error: null }));

    try {
      await client.connect();
      const chainInfo = await client.getChainInfo();

      setState({
        isConnected: true,
        chainInfo,
        isLoading: false,
        error: null,
      });

      return chainInfo;
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to connect';
      setState((prev) => ({
        ...prev,
        isConnected: false,
        isLoading: false,
        error: message,
      }));
      return null;
    }
  }, [client]);

  const disconnect = useCallback(async () => {
    await client.disconnect();
    setState({
      isConnected: false,
      chainInfo: null,
      isLoading: false,
      error: null,
    });
  }, [client]);

  // Auto-connect on mount
  useEffect(() => {
    connect();
    return () => {
      disconnect();
    };
  }, []);

  return {
    ...state,
    connect,
    disconnect,
    client,
  };
}

/**
 * Hook for cross-chain swaps
 */
export function useCrossChainSwap() {
  const { account } = useWalletUi();
  const { client: atlasClient, isConnected: atlasConnected } = useAtlasSphere();

  const [state, setState] = useState<SwapState>({
    inputAsset: CROSS_CHAIN_ASSETS[0], // Default to SOL
    outputAsset: CROSS_CHAIN_ASSETS[2], // Default to ATLAS
    inputAmount: '',
    quote: null,
    isQuoting: false,
    isSwapping: false,
    lastResult: null,
  });

  const engine = useMemo(() => getCrossChainTradingEngine(), []);

  const setInputAsset = useCallback((asset: CrossChainAsset) => {
    setState((prev) => ({ ...prev, inputAsset: asset, quote: null }));
  }, []);

  const setOutputAsset = useCallback((asset: CrossChainAsset) => {
    setState((prev) => ({ ...prev, outputAsset: asset, quote: null }));
  }, []);

  const setInputAmount = useCallback((amount: string) => {
    setState((prev) => ({ ...prev, inputAmount: amount, quote: null }));
  }, []);

  const getQuote = useCallback(async () => {
    if (!state.inputAsset || !state.outputAsset || !state.inputAmount) {
      return null;
    }

    setState((prev) => ({ ...prev, isQuoting: true }));

    try {
      const inputAmountBigInt = BigInt(
        Math.floor(parseFloat(state.inputAmount) * 10 ** state.inputAsset.decimals)
      );

      const quote = await engine.getSwapQuote(
        state.inputAsset,
        state.outputAsset,
        inputAmountBigInt
      );

      setState((prev) => ({ ...prev, quote, isQuoting: false }));
      return quote;
    } catch (error) {
      console.error('Failed to get quote:', error);
      setState((prev) => ({ ...prev, isQuoting: false }));
      return null;
    }
  }, [state.inputAsset, state.outputAsset, state.inputAmount, engine]);

  const executeSwap = useCallback(
    async (signerMnemonic: string): Promise<AtomicSwapResult | null> => {
      if (!state.quote || !account?.address) {
        return null;
      }

      setState((prev) => ({ ...prev, isSwapping: true }));

      try {
        const result = await engine.executeAtomicSwap(
          state.quote,
          account.address,
          signerMnemonic
        );

        setState((prev) => ({
          ...prev,
          isSwapping: false,
          lastResult: result,
        }));

        return result;
      } catch (error) {
        const errorResult: AtomicSwapResult = {
          success: false,
          txHash: '',
          actualInputAmount: BigInt(0),
          actualOutputAmount: BigInt(0),
          gasUsed: BigInt(0),
          error: error instanceof Error ? error.message : 'Swap failed',
        };

        setState((prev) => ({
          ...prev,
          isSwapping: false,
          lastResult: errorResult,
        }));

        return errorResult;
      }
    },
    [state.quote, account?.address, engine]
  );

  const switchAssets = useCallback(() => {
    setState((prev) => ({
      ...prev,
      inputAsset: prev.outputAsset,
      outputAsset: prev.inputAsset,
      quote: null,
    }));
  }, []);

  // Auto-refresh quote when amount changes (debounced)
  useEffect(() => {
    if (!state.inputAmount || parseFloat(state.inputAmount) <= 0) {
      return;
    }

    const timeout = setTimeout(() => {
      getQuote();
    }, 500);

    return () => clearTimeout(timeout);
  }, [state.inputAmount, state.inputAsset, state.outputAsset]);

  return {
    ...state,
    setInputAsset,
    setOutputAsset,
    setInputAmount,
    switchAssets,
    getQuote,
    executeSwap,
    atlasConnected,
    availableAssets: CROSS_CHAIN_ASSETS,
  };
}

/**
 * Hook for cross-chain limit orders
 */
export function useCrossChainOrders() {
  const { account } = useWalletUi();
  const [orders, setOrders] = useState<CrossChainOrder[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  const engine = useMemo(() => getCrossChainTradingEngine(), []);

  const createOrder = useCallback(
    (
      sellAsset: CrossChainAsset,
      sellAmount: bigint,
      buyAsset: CrossChainAsset,
      buyAmount: bigint,
      expiryHours: number = 24
    ): CrossChainOrder | null => {
      if (!account?.address) {
        return null;
      }

      const expiry = Date.now() + expiryHours * 60 * 60 * 1000;
      const order = engine.createLimitOrder(
        account.address,
        sellAsset,
        sellAmount,
        buyAsset,
        buyAmount,
        expiry
      );

      setOrders((prev) => [...prev, order]);
      return order;
    },
    [account?.address, engine]
  );

  const cancelOrder = useCallback(
    (orderId: string): boolean => {
      if (!account?.address) {
        return false;
      }

      const success = engine.cancelOrder(orderId, account.address);
      if (success) {
        setOrders((prev) =>
          prev.map((o) => (o.id === orderId ? { ...o, status: 'cancelled' as const } : o))
        );
      }
      return success;
    },
    [account?.address, engine]
  );

  const fillOrder = useCallback(
    async (orderId: string, signerMnemonic: string): Promise<AtomicSwapResult | null> => {
      if (!account?.address) {
        return null;
      }

      setIsLoading(true);
      try {
        const result = await engine.fillOrder(orderId, account.address, signerMnemonic);
        if (result.success) {
          setOrders((prev) =>
            prev.map((o) =>
              o.id === orderId ? { ...o, status: 'filled' as const, filledAt: Date.now() } : o
            )
          );
        }
        return result;
      } finally {
        setIsLoading(false);
      }
    },
    [account?.address, engine]
  );

  const refreshOrders = useCallback(() => {
    if (!account?.address) {
      return;
    }
    const openOrders = engine.getOpenOrders(account.address);
    setOrders(openOrders);
  }, [account?.address, engine]);

  // Refresh orders on mount and when account changes
  useEffect(() => {
    refreshOrders();
  }, [refreshOrders]);

  return {
    orders,
    isLoading,
    createOrder,
    cancelOrder,
    fillOrder,
    refreshOrders,
    openOrders: orders.filter((o) => o.status === 'open'),
    filledOrders: orders.filter((o) => o.status === 'filled'),
  };
}

/**
 * Hook for canonical balances on Atlas Sphere
 */
export function useCanonicalBalances() {
  const { account } = useWalletUi();
  const { client, isConnected } = useAtlasSphere();
  const [balances, setBalances] = useState<Map<number, bigint>>(new Map());
  const [isLoading, setIsLoading] = useState(false);

  const refreshBalances = useCallback(async () => {
    if (!account?.address || !isConnected) {
      return;
    }

    setIsLoading(true);
    try {
      const newBalances = new Map<number, bigint>();

      // Fetch balances for all canonical assets
      for (const asset of CROSS_CHAIN_ASSETS) {
        if (asset.canonicalId !== undefined) {
          const balance = await client.getCanonicalBalance(
            account.address,
            asset.canonicalId
          );
          newBalances.set(asset.canonicalId, balance);
        }
      }

      setBalances(newBalances);
    } catch (error) {
      console.error('Failed to fetch balances:', error);
    } finally {
      setIsLoading(false);
    }
  }, [account?.address, client, isConnected]);

  // Auto-refresh on mount and periodically
  useEffect(() => {
    if (!isConnected) return;

    refreshBalances();
    const interval = setInterval(refreshBalances, 30000); // Every 30 seconds

    return () => clearInterval(interval);
  }, [refreshBalances, isConnected]);

  const getBalance = useCallback(
    (assetId: number): bigint => {
      return balances.get(assetId) ?? BigInt(0);
    },
    [balances]
  );

  const getFormattedBalance = useCallback(
    (assetId: number, decimals: number): string => {
      const balance = getBalance(assetId);
      return (Number(balance) / 10 ** decimals).toFixed(decimals > 6 ? 6 : decimals);
    },
    [getBalance]
  );

  return {
    balances,
    isLoading,
    refreshBalances,
    getBalance,
    getFormattedBalance,
  };
}

/**
 * Hook for EVM-specific swaps on Atlas Sphere
 */
export function useEvmSwap() {
  const { client, isConnected } = useAtlasSphere();
  const [isSwapping, setIsSwapping] = useState(false);
  const [lastTxHash, setLastTxHash] = useState<string | null>(null);

  // Get EVM-only assets
  const evmAssets = useMemo(
    () => CROSS_CHAIN_ASSETS.filter((asset) => asset.chain === 'atlas-evm'),
    []
  );

  const executeEvmSwap = useCallback(
    async (
      inputAsset: CrossChainAsset,
      outputAsset: CrossChainAsset,
      inputAmount: bigint,
      signer: string
    ): Promise<AtomicSwapResult> => {
      if (!isConnected) {
        return {
          success: false,
          txHash: '',
          actualInputAmount: BigInt(0),
          actualOutputAmount: BigInt(0),
          gasUsed: BigInt(0),
          error: 'Not connected to Atlas Sphere',
        };
      }

      setIsSwapping(true);
      try {
        const engine = getCrossChainTradingEngine();
        const quote = await engine.getSwapQuote(inputAsset, outputAsset, inputAmount);
        const result = await engine.executeAtomicSwap(quote, signer, signer);
        
        if (result.success) {
          setLastTxHash(result.txHash);
        }
        
        return result;
      } catch (error) {
        return {
          success: false,
          txHash: '',
          actualInputAmount: BigInt(0),
          actualOutputAmount: BigInt(0),
          gasUsed: BigInt(0),
          error: error instanceof Error ? error.message : 'EVM swap failed',
        };
      } finally {
        setIsSwapping(false);
      }
    },
    [isConnected]
  );

  return {
    evmAssets,
    isSwapping,
    lastTxHash,
    executeEvmSwap,
    isConnected,
  };
}

/**
 * Hook to filter assets by chain
 */
export function useAssetsByChain(chain?: ChainType) {
  return useMemo(() => {
    if (!chain) return CROSS_CHAIN_ASSETS;
    return CROSS_CHAIN_ASSETS.filter((asset) => asset.chain === chain);
  }, [chain]);
}
