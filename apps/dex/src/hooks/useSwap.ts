'use client';

import { useState, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Token } from '@/stores/wallet';

interface SwapQuote {
  inputAmount: string;
  outputAmount: string;
  rate: string;
  priceImpact: number;
  route: string[];
  minOutput: string;
  gasEstimate: string;
}

interface UseSwapParams {
  fromToken: Token;
  toToken: Token;
  amount: string;
}

async function fetchQuote(
  fromToken: Token,
  toToken: Token,
  amount: string
): Promise<SwapQuote | null> {
  if (!amount || parseFloat(amount) === 0) {
    return null;
  }

  // In production, this would call the actual DEX router API
  // For now, we simulate a quote
  const inputAmount = parseFloat(amount);
  
  // Mock rate based on token pair
  let rate = 1.0;
  if (fromToken.symbol === 'ATLAS' && toToken.symbol === 'USDC') {
    rate = 1.25;
  } else if (fromToken.symbol === 'USDC' && toToken.symbol === 'ATLAS') {
    rate = 0.8;
  } else if (fromToken.symbol === 'WETH' && toToken.symbol === 'ATLAS') {
    rate = 1842.5;
  } else if (fromToken.symbol === 'SOL' && toToken.symbol === 'sUSDC') {
    rate = 98.45;
  }

  const outputAmount = inputAmount * rate;
  const priceImpact = Math.min(inputAmount * 0.001, 10); // Max 10%
  const slippage = 0.005; // 0.5%
  const minOutput = outputAmount * (1 - slippage);

  // Simulate network delay
  await new Promise((resolve) => setTimeout(resolve, 500));

  return {
    inputAmount: amount,
    outputAmount: outputAmount.toFixed(toToken.decimals > 6 ? 6 : toToken.decimals),
    rate: rate.toFixed(4),
    priceImpact,
    route: [fromToken.symbol, toToken.symbol],
    minOutput: minOutput.toFixed(toToken.decimals > 6 ? 6 : toToken.decimals),
    gasEstimate: fromToken.vm === toToken.vm ? '50000' : '150000',
  };
}

export function useSwap({ fromToken, toToken, amount }: UseSwapParams) {
  const [isSwapping, setIsSwapping] = useState(false);

  const { data: quote, isLoading, error } = useQuery({
    queryKey: ['swap-quote', fromToken.address, toToken.address, amount],
    queryFn: () => fetchQuote(fromToken, toToken, amount),
    enabled: !!amount && parseFloat(amount) > 0,
    refetchInterval: 10000, // Refresh quote every 10s
    staleTime: 5000,
  });

  const executeSwap = async () => {
    if (!quote) {
      throw new Error('No quote available');
    }

    setIsSwapping(true);
    try {
      // In production, this would:
      // 1. Build the swap transaction (or Comit for cross-VM)
      // 2. Sign with wallet
      // 3. Submit to chain
      // 4. Wait for confirmation

      await new Promise((resolve) => setTimeout(resolve, 2000));

      // Return mock result
      return {
        txHash: '0x' + Math.random().toString(16).substring(2, 66),
        inputAmount: quote.inputAmount,
        outputAmount: quote.outputAmount,
      };
    } finally {
      setIsSwapping(false);
    }
  };

  return {
    quote,
    isLoading,
    error: error ? (error as Error).message : null,
    executeSwap,
    isSwapping,
  };
}
