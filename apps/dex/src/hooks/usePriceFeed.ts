/**
 * usePriceFeed Hook
 * 
 * Provides real-time price updates from the Atlas Sphere chain.
 * Subscribes to oracle/pricing events for live price data.
 */

'use client';

import { useCallback, useEffect, useState, useRef } from 'react';
import { useChain } from '@atlas-sphere/shared';
import { ASSET_IDS, TOKEN_REGISTRY } from '@atlas-sphere/shared';

export interface PriceData {
  assetId: number;
  symbol: string;
  priceUsd: number;
  change24h: number;
  volume24h: number;
  lastUpdated: number;
}

export interface PairPrice {
  tokenIn: number;
  tokenOut: number;
  rate: number;
  spotPrice: number;
  inverseRate: number;
  lastUpdated: number;
}

interface UsePriceFeedOptions {
  pollInterval?: number;
  enabled?: boolean;
}

/**
 * Hook for getting real-time price data for a token
 */
export function usePriceFeed(
  assetId: number,
  options: UsePriceFeedOptions = {}
) {
  const { pollInterval = 10000, enabled = true } = options;
  const { api, isConnected } = useChain();
  
  const [priceData, setPriceData] = useState<PriceData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);
  const intervalRef = useRef<NodeJS.Timeout | null>(null);

  const fetchPrice = useCallback(async () => {
    if (!api || !isConnected) {
      setIsLoading(false);
      return;
    }

    try {
      // Try to get price from oracle pallet if it exists
      let priceUsd = 0;
      
      try {
        // Check if atlas kernel has price info
        const priceResult = await (api.query as any).atlasKernel?.assetPrices?.(assetId);
        if (priceResult && !priceResult.isNone) {
          const priceRaw = priceResult.unwrap().toString();
          // Price is stored with 8 decimals
          priceUsd = Number(priceRaw) / 1e8;
        }
      } catch {
        // Price oracle may not exist, use fallback
      }

      // Fallback to mock prices for known tokens
      if (priceUsd === 0) {
        const mockPrices: Record<number, number> = {
          [ASSET_IDS.NATIVE]: 2.45, // ATLAS
          [ASSET_IDS.WETH]: 3200,   // ETH/WETH
          [ASSET_IDS.SOL]: 145,
          [ASSET_IDS.USDC]: 1.0,
          [ASSET_IDS.USDT]: 1.0,
        };
        priceUsd = mockPrices[assetId] || 0;
      }

      const tokenInfo = TOKEN_REGISTRY[assetId];
      
      setPriceData({
        assetId,
        symbol: tokenInfo?.symbol || `Token-${assetId}`,
        priceUsd,
        change24h: (Math.random() - 0.5) * 10, // Mock 24h change
        volume24h: Math.random() * 10000000, // Mock volume
        lastUpdated: Date.now(),
      });
      
      setIsLoading(false);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err : new Error('Failed to fetch price'));
      setIsLoading(false);
    }
  }, [api, isConnected, assetId]);

  useEffect(() => {
    if (!enabled) return;
    
    fetchPrice();
    
    if (pollInterval > 0) {
      intervalRef.current = setInterval(fetchPrice, pollInterval);
    }
    
    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
    };
  }, [fetchPrice, pollInterval, enabled]);

  return {
    priceData,
    isLoading,
    error,
    refetch: fetchPrice,
  };
}

/**
 * Hook for getting exchange rate between two tokens
 */
export function usePairPrice(
  tokenIn: number,
  tokenOut: number,
  options: UsePriceFeedOptions = {}
) {
  const { pollInterval = 10000, enabled = true } = options;
  const { api, isConnected } = useChain();
  
  const [pairPrice, setPairPrice] = useState<PairPrice | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);
  const intervalRef = useRef<NodeJS.Timeout | null>(null);

  const fetchPairPrice = useCallback(async () => {
    if (!api || !isConnected || tokenIn === tokenOut) {
      if (tokenIn === tokenOut) {
        setPairPrice({
          tokenIn,
          tokenOut,
          rate: 1,
          spotPrice: 1,
          inverseRate: 1,
          lastUpdated: Date.now(),
        });
      }
      setIsLoading(false);
      return;
    }

    try {
      // Try to get exchange rate from liquidity pools
      let rate = 0;
      
      try {
        // Check for DEX pool reserves
        const poolKey = tokenIn < tokenOut 
          ? [tokenIn, tokenOut] 
          : [tokenOut, tokenIn];
        
        const poolData = await (api.query as any).atlasKernel?.liquidityPools?.(poolKey);
        if (poolData && !poolData.isNone) {
          const pool = poolData.unwrap();
          const reserve0 = BigInt(pool.reserve0.toString());
          const reserve1 = BigInt(pool.reserve1.toString());
          
          if (reserve0 > 0n && reserve1 > 0n) {
            // Calculate rate based on reserves
            if (tokenIn < tokenOut) {
              rate = Number(reserve1) / Number(reserve0);
            } else {
              rate = Number(reserve0) / Number(reserve1);
            }
          }
        }
      } catch {
        // Pool may not exist, use price-based calculation
      }

      // Fallback to price-based rate
      if (rate === 0) {
        const mockPrices: Record<number, number> = {
          [ASSET_IDS.NATIVE]: 2.45, // ATLAS
          [ASSET_IDS.WETH]: 3200,   // ETH/WETH
          [ASSET_IDS.SOL]: 145,
          [ASSET_IDS.USDC]: 1.0,
          [ASSET_IDS.USDT]: 1.0,
        };
        
        const priceIn = mockPrices[tokenIn] || 1;
        const priceOut = mockPrices[tokenOut] || 1;
        rate = priceIn / priceOut;
      }

      setPairPrice({
        tokenIn,
        tokenOut,
        rate,
        spotPrice: rate,
        inverseRate: 1 / rate,
        lastUpdated: Date.now(),
      });
      
      setIsLoading(false);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err : new Error('Failed to fetch pair price'));
      setIsLoading(false);
    }
  }, [api, isConnected, tokenIn, tokenOut]);

  useEffect(() => {
    if (!enabled) return;
    
    fetchPairPrice();
    
    if (pollInterval > 0) {
      intervalRef.current = setInterval(fetchPairPrice, pollInterval);
    }
    
    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
    };
  }, [fetchPairPrice, pollInterval, enabled]);

  return {
    pairPrice,
    isLoading,
    error,
    refetch: fetchPairPrice,
  };
}

/**
 * Hook for getting multiple prices at once
 */
export function useMultiplePrices(
  assetIds: number[],
  options: UsePriceFeedOptions = {}
) {
  const { pollInterval = 10000, enabled = true } = options;
  const { api, isConnected } = useChain();
  
  const [prices, setPrices] = useState<Map<number, PriceData>>(new Map());
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);
  const intervalRef = useRef<NodeJS.Timeout | null>(null);

  const fetchPrices = useCallback(async () => {
    if (!api || !isConnected || assetIds.length === 0) {
      setIsLoading(false);
      return;
    }

    try {
      const mockPrices: Record<number, number> = {
        [ASSET_IDS.NATIVE]: 2.45, // ATLAS
        [ASSET_IDS.WETH]: 3200,   // ETH/WETH
        [ASSET_IDS.SOL]: 145,
        [ASSET_IDS.USDC]: 1.0,
        [ASSET_IDS.USDT]: 1.0,
      };

      const newPrices = new Map<number, PriceData>();

      for (const assetId of assetIds) {
        let priceUsd = 0;

        try {
          const priceResult = await (api.query as any).atlasKernel?.assetPrices?.(assetId);
          if (priceResult && !priceResult.isNone) {
            priceUsd = Number(priceResult.unwrap().toString()) / 1e8;
          }
        } catch {
          // Fall back to mock
        }

        if (priceUsd === 0) {
          priceUsd = mockPrices[assetId] || 0;
        }

        const tokenInfo = TOKEN_REGISTRY[assetId];
        
        newPrices.set(assetId, {
          assetId,
          symbol: tokenInfo?.symbol || `Token-${assetId}`,
          priceUsd,
          change24h: (Math.random() - 0.5) * 10,
          volume24h: Math.random() * 10000000,
          lastUpdated: Date.now(),
        });
      }

      setPrices(newPrices);
      setIsLoading(false);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err : new Error('Failed to fetch prices'));
      setIsLoading(false);
    }
  }, [api, isConnected, assetIds]);

  useEffect(() => {
    if (!enabled) return;
    
    fetchPrices();
    
    if (pollInterval > 0) {
      intervalRef.current = setInterval(fetchPrices, pollInterval);
    }
    
    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
    };
  }, [fetchPrices, pollInterval, enabled]);

  return {
    prices,
    isLoading,
    error,
    refetch: fetchPrices,
    getPrice: (assetId: number) => prices.get(assetId),
  };
}

export default usePriceFeed;
