'use client';

import { useState, useEffect } from 'react';
import { ArrowDown, Settings, RefreshCw, Info, Loader2 } from 'lucide-react';
import { useWalletStore } from '@/stores/wallet';
import { TokenSelector } from './token-selector';
import { useSwap } from '@/hooks/useSwap';
import { formatAmount } from '@/lib/format';
import clsx from 'clsx';
import toast from 'react-hot-toast';

const DEFAULT_TOKENS = {
  from: {
    address: '0x0000000000000000000000000000000000000000',
    symbol: 'ATLAS',
    name: 'Atlas Token',
    decimals: 18,
    vm: 'evm' as const,
  },
  to: {
    address: '0x1234567890abcdef1234567890abcdef12345678',
    symbol: 'USDC',
    name: 'USD Coin',
    decimals: 6,
    vm: 'evm' as const,
  },
};

export function SwapInterface() {
  const { isConnected, address } = useWalletStore();
  const [fromToken, setFromToken] = useState(DEFAULT_TOKENS.from);
  const [toToken, setToToken] = useState(DEFAULT_TOKENS.to);
  const [fromAmount, setFromAmount] = useState('');
  const [toAmount, setToAmount] = useState('');
  const [slippage, setSlippage] = useState(0.5);
  const [showSettings, setShowSettings] = useState(false);
  const [showFromSelector, setShowFromSelector] = useState(false);
  const [showToSelector, setShowToSelector] = useState(false);

  const { quote, isLoading, error, executeSwap, isSwapping } = useSwap({
    fromToken,
    toToken,
    amount: fromAmount,
  });

  // Update toAmount when quote changes
  useEffect(() => {
    if (quote) {
      setToAmount(quote.outputAmount);
    } else {
      setToAmount('');
    }
  }, [quote]);

  const handleSwapTokens = () => {
    setFromToken(toToken);
    setToToken(fromToken);
    setFromAmount(toAmount);
    setToAmount(fromAmount);
  };

  const handleSwap = async () => {
    if (!isConnected) {
      toast.error('Please connect your wallet');
      return;
    }

    try {
      await executeSwap();
      toast.success('Swap executed successfully!');
      setFromAmount('');
      setToAmount('');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Swap failed');
    }
  };

  const priceImpact = quote?.priceImpact ?? 0;
  const isHighImpact = priceImpact > 5;

  return (
    <div className="glass rounded-2xl p-6 max-w-lg mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-xl font-bold">Swap</h2>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowSettings(!showSettings)}
            className={clsx(
              'p-2 rounded-lg hover:bg-muted transition',
              showSettings && 'bg-muted'
            )}
          >
            <Settings className="w-5 h-5" />
          </button>
        </div>
      </div>

      {/* Settings Panel */}
      {showSettings && (
        <div className="mb-4 p-4 rounded-lg bg-muted/50">
          <label className="text-sm text-muted-foreground">Slippage Tolerance</label>
          <div className="flex gap-2 mt-2">
            {[0.1, 0.5, 1.0].map((value) => (
              <button
                key={value}
                onClick={() => setSlippage(value)}
                className={clsx(
                  'px-3 py-1.5 rounded-lg text-sm transition',
                  slippage === value
                    ? 'bg-primary text-white'
                    : 'bg-card hover:bg-border'
                )}
              >
                {value}%
              </button>
            ))}
            <input
              type="number"
              value={slippage}
              onChange={(e) => setSlippage(parseFloat(e.target.value) || 0)}
              className="w-20 px-3 py-1.5 rounded-lg bg-card border border-border text-sm"
              placeholder="Custom"
            />
          </div>
        </div>
      )}

      {/* From Token */}
      <div className="p-4 rounded-xl bg-muted/30 border border-transparent focus-within:border-primary transition">
        <div className="flex justify-between text-sm text-muted-foreground mb-2">
          <span>You Pay</span>
          <span>Balance: {formatAmount('0', fromToken.decimals)}</span>
        </div>
        <div className="flex items-center gap-3">
          <input
            type="text"
            value={fromAmount}
            onChange={(e) => setFromAmount(e.target.value)}
            placeholder="0.0"
            className="flex-1 bg-transparent text-2xl font-medium outline-none"
          />
          <button
            onClick={() => setShowFromSelector(true)}
            className="flex items-center gap-2 px-3 py-2 rounded-xl bg-card hover:bg-border transition"
          >
            <span className="font-medium">{fromToken.symbol}</span>
            <span className="text-xs px-1.5 py-0.5 rounded bg-muted uppercase">
              {fromToken.vm}
            </span>
          </button>
        </div>
      </div>

      {/* Swap Direction Button */}
      <div className="flex justify-center -my-2 relative z-10">
        <button
          onClick={handleSwapTokens}
          className="p-2 rounded-xl bg-card border border-border hover:border-primary hover:bg-muted transition"
        >
          <ArrowDown className="w-5 h-5" />
        </button>
      </div>

      {/* To Token */}
      <div className="p-4 rounded-xl bg-muted/30 border border-transparent focus-within:border-primary transition">
        <div className="flex justify-between text-sm text-muted-foreground mb-2">
          <span>You Receive</span>
          <span>Balance: {formatAmount('0', toToken.decimals)}</span>
        </div>
        <div className="flex items-center gap-3">
          <input
            type="text"
            value={toAmount}
            readOnly
            placeholder="0.0"
            className="flex-1 bg-transparent text-2xl font-medium outline-none"
          />
          <button
            onClick={() => setShowToSelector(true)}
            className="flex items-center gap-2 px-3 py-2 rounded-xl bg-card hover:bg-border transition"
          >
            <span className="font-medium">{toToken.symbol}</span>
            <span className="text-xs px-1.5 py-0.5 rounded bg-muted uppercase">
              {toToken.vm}
            </span>
          </button>
        </div>
      </div>

      {/* Quote Info */}
      {quote && fromAmount && (
        <div className="mt-4 p-3 rounded-lg bg-muted/30 text-sm space-y-2">
          <div className="flex justify-between">
            <span className="text-muted-foreground">Rate</span>
            <span>
              1 {fromToken.symbol} = {quote.rate} {toToken.symbol}
            </span>
          </div>
          <div className="flex justify-between">
            <span className="text-muted-foreground">Price Impact</span>
            <span className={isHighImpact ? 'text-danger' : ''}>
              {priceImpact.toFixed(2)}%
            </span>
          </div>
          <div className="flex justify-between">
            <span className="text-muted-foreground">Execution</span>
            <span className="capitalize">
              {fromToken.vm === toToken.vm ? 'Single-VM' : 'Cross-VM (Comit)'}
            </span>
          </div>
          {fromToken.vm !== toToken.vm && (
            <div className="flex items-center gap-2 pt-2 border-t border-border text-primary">
              <Info className="w-4 h-4" />
              <span>This swap uses Atlas Kernel atomic cross-VM execution</span>
            </div>
          )}
        </div>
      )}

      {/* Error */}
      {error && (
        <div className="mt-4 p-3 rounded-lg bg-danger/10 text-danger text-sm">
          {error}
        </div>
      )}

      {/* Swap Button */}
      <button
        onClick={handleSwap}
        disabled={!fromAmount || isLoading || isSwapping || !quote}
        className={clsx(
          'w-full mt-6 py-4 rounded-xl font-bold text-lg transition',
          isConnected && fromAmount && quote
            ? 'gradient-primary hover:opacity-90'
            : 'bg-muted text-muted-foreground cursor-not-allowed'
        )}
      >
        {!isConnected ? (
          'Connect Wallet'
        ) : isSwapping ? (
          <span className="flex items-center justify-center gap-2">
            <Loader2 className="w-5 h-5 animate-spin" />
            Swapping...
          </span>
        ) : isLoading ? (
          <span className="flex items-center justify-center gap-2">
            <RefreshCw className="w-5 h-5 animate-spin" />
            Getting Quote...
          </span>
        ) : !fromAmount ? (
          'Enter Amount'
        ) : !quote ? (
          'No Route Found'
        ) : isHighImpact ? (
          'Swap Anyway (High Impact)'
        ) : (
          'Swap'
        )}
      </button>

      {/* Token Selectors */}
      {showFromSelector && (
        <TokenSelector
          selected={fromToken}
          onSelect={(token) => {
            setFromToken(token);
            setShowFromSelector(false);
          }}
          onClose={() => setShowFromSelector(false)}
        />
      )}
      {showToSelector && (
        <TokenSelector
          selected={toToken}
          onSelect={(token) => {
            setToToken(token);
            setShowToSelector(false);
          }}
          onClose={() => setShowToSelector(false)}
        />
      )}
    </div>
  );
}
