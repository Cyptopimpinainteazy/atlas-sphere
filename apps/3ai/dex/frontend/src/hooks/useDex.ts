/**
 * useDex — React hook for the X3 DEX SDK.
 *
 * Creates an AtlasDexClient instance and exposes
 * orderbook, quote, order submission, and swap operations
 * as reactive state for the 3ai DEX frontend.
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import type { Order, Orderbook, TradeQuote, TradingPair, ApiResult } from '@x3-chain/atomic-swap-sdk';
import { AtlasDexClient } from '@x3-chain/atomic-swap-sdk';

// Default DEX configuration — connects to local 3ai chain + X3 Substrate
const DEFAULT_CONFIG = {
  substrateRpc: (import.meta.env.VITE_RPC_HTTP as string) || 'https://rpc.x3-chain.io:9944',
  substrateWs: (import.meta.env.VITE_RPC_WS as string) || 'wss://rpc.x3-chain.io:9944',
  chainEndpoints: {
    ethereum: import.meta.env.VITE_ETH_RPC || 'https://eth.llamarpc.com',
    'ethereum-sepolia': 'https://rpc.sepolia.org',
    solana: import.meta.env.VITE_SOL_RPC || 'https://api.mainnet-beta.solana.com',
    bitcoin: import.meta.env.VITE_BTC_API || 'https://blockstream.info/api',
    'x3-substrate': (import.meta.env.VITE_RPC_HTTP as string) || 'https://rpc.x3-chain.io:9944',
    polygon: 'https://polygon-rpc.com',
    arbitrum: 'https://arb1.arbitrum.io/rpc',
    optimism: 'https://mainnet.optimism.io',
    base: 'https://mainnet.base.org',
    bsc: 'https://bsc-dataseed1.binance.org',
    avalanche: 'https://api.avax.network/ext/bc/C/rpc',
  },
  htlcContracts: {
    ethereum: import.meta.env.VITE_HTLC_ETH || '0x0000000000000000000000000000000000000000',
    polygon: import.meta.env.VITE_HTLC_POLYGON || '0x0000000000000000000000000000000000000000',
    arbitrum: import.meta.env.VITE_HTLC_ARBITRUM || '0x0000000000000000000000000000000000000000',
    bsc: import.meta.env.VITE_HTLC_BSC || '0x0000000000000000000000000000000000000000',
  },
  defaultSlippageBps: 50, // 0.5%
  defaultTimeLockInitiator: 7200, // 2 hours
  defaultTimeLockCounterparty: 3600, // 1 hour
  orderbookWsUrl: import.meta.env.VITE_WS_URL || 'ws://localhost:3001',
  apiBaseUrl: import.meta.env.VITE_API_URL || 'http://localhost:3001/api',
};

export interface DexState {
  initialized: boolean;
  loading: boolean;
  error: string | null;
}

export function useDex() {
  const clientRef = useRef<AtlasDexClient | null>(null);
  const [state, setState] = useState<DexState>({
    initialized: false,
    loading: true,
    error: null,
  });

  // Initialize on mount
  useEffect(() => {
    const client = new AtlasDexClient(DEFAULT_CONFIG);
    clientRef.current = client;

    client
      .initialize()
      .then(() => {
        setState({ initialized: true, loading: false, error: null });
      })
      .catch((err: any) => {
        setState({ initialized: false, loading: false, error: err.message });
      });

    return () => {
      client.destroy();
      clientRef.current = null;
    };
  }, []);

  const setSigner = useCallback((key: string) => {
    clientRef.current?.setSigner(key);
  }, []);

  const getOrderbook = useCallback(
    (pair: TradingPair): Orderbook | null => {
      if (!clientRef.current) return null;
      try {
        return clientRef.current.getOrderbook(pair);
      } catch {
        return null;
      }
    },
    [],
  );

  const getQuote = useCallback(
    (fromAsset: string, toAsset: string, amount: string): TradeQuote | null => {
      if (!clientRef.current) return null;
      try {
        return clientRef.current.getQuote(fromAsset, toAsset, amount);
      } catch {
        return null;
      }
    },
    [],
  );

  const submitOrder = useCallback(
    async (params: {
      baseAsset: string;
      quoteAsset: string;
      type: 'market' | 'limit' | 'stop-loss' | 'take-profit';
      side: 'buy' | 'sell';
      price: string;
      amount: string;
      timeInForce?: 'GTC' | 'IOC' | 'FOK';
    }): Promise<ApiResult<Order>> => {
      if (!clientRef.current) return { success: false, error: 'DEX not initialized' };

      return clientRef.current.submitOrder({
        pair: { base: params.baseAsset, quote: params.quoteAsset },
        type: params.type,
        side: params.side,
        price: params.price,
        amount: params.amount,
        timeInForce: params.timeInForce || 'GTC',
      });
    },
    [],
  );

  const cancelOrder = useCallback(
    (pairKey: string, orderId: string): ApiResult<void> => {
      if (!clientRef.current) return { success: false, error: 'DEX not initialized' };
      return clientRef.current.cancelOrder(pairKey, orderId);
    },
    [],
  );

  const getOpenOrders = useCallback(
    (pair: TradingPair): Order[] => {
      if (!clientRef.current) return [];
      return clientRef.current.getOrders(pair);
    },
    [],
  );

  const getTradingPairs = useCallback(() => {
    if (!clientRef.current) return [];
    return clientRef.current.getTradingPairs();
  }, []);

  const initiateSwap = useCallback(
    async (
      sourceChain: string,
      destChain: string,
      sourceToken: string,
      destToken: string,
      amount: string,
      counterparty: string,
    ) => {
      if (!clientRef.current) return { success: false, error: 'DEX not initialized' } as ApiResult<string>;
      return clientRef.current.initiateSwap(
        sourceChain,
        destChain,
        sourceToken,
        destToken,
        amount,
        counterparty,
      );
    },
    [],
  );

  return {
    client: clientRef.current,
    ...state,
    setSigner,
    getOrderbook,
    getQuote,
    submitOrder,
    cancelOrder,
    getOpenOrders,
    getTradingPairs,
    initiateSwap,
  };
}
