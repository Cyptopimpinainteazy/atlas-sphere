'use client';

import { useState } from 'react';
import { useWalletStore, Token } from '@/stores/walletStore';
import { 
  ArrowLeftRight, 
  ChevronDown,
  Settings,
  Loader2,
  Check,
  AlertCircle
} from 'lucide-react';

export function SwapView() {
  const { tokens } = useWalletStore();
  const [fromToken, setFromToken] = useState(tokens[0]);
  const [toToken, setToToken] = useState(tokens[1]);
  const [fromAmount, setFromAmount] = useState('');
  const [showFromDropdown, setShowFromDropdown] = useState(false);
  const [showToDropdown, setShowToDropdown] = useState(false);
  const [swapping, setSwapping] = useState(false);
  const [success, setSuccess] = useState(false);

  // Mock exchange rate
  const getExchangeRate = () => {
    const rates: Record<string, Record<string, number>> = {
      'ETH': { 'SOL': 20, 'USDC': 2000, 'STAR': 650 },
      'SOL': { 'ETH': 0.05, 'USDC': 100, 'STAR': 32 },
      'USDC': { 'ETH': 0.0005, 'SOL': 0.01, 'STAR': 0.33 },
      'STAR': { 'ETH': 0.0015, 'SOL': 0.031, 'USDC': 3 },
    };
    return rates[fromToken?.symbol]?.[toToken?.symbol] || 1;
  };

  const toAmount = fromAmount ? (parseFloat(fromAmount) * getExchangeRate()).toFixed(6) : '';

  const handleSwap = async () => {
    if (!fromAmount) return;
    
    setSwapping(true);
    await new Promise((resolve) => setTimeout(resolve, 2500));
    setSwapping(false);
    setSuccess(true);
    
    setTimeout(() => {
      setSuccess(false);
      setFromAmount('');
    }, 3000);
  };

  const switchTokens = () => {
    const temp = fromToken;
    setFromToken(toToken);
    setToToken(temp);
    setFromAmount('');
  };

  if (success) {
    return (
      <div className="max-w-lg">
        <div className="mb-8">
          <h1 className="text-2xl font-bold text-white mb-1">Swap</h1>
          <p className="text-gray-500">Exchange tokens instantly</p>
        </div>
        
        <div className="glass-card p-8 text-center">
          <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-emerald-500/20 flex items-center justify-center">
            <Check className="w-8 h-8 text-emerald-400" />
          </div>
          <h3 className="text-xl font-semibold text-white mb-2">Swap Complete!</h3>
          <p className="text-gray-400">
            Swapped {fromAmount} {fromToken?.symbol} for {toAmount} {toToken?.symbol}
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-lg">
      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold text-white mb-1">Swap</h1>
          <p className="text-gray-500">Exchange tokens instantly</p>
        </div>
        <button className="btn-icon">
          <Settings className="w-5 h-5" />
        </button>
      </div>

      <div className="glass-card p-6">
        {/* From */}
        <div className="mb-2">
          <div className="flex items-center justify-between mb-2">
            <label className="text-sm text-gray-400">From</label>
            <span className="text-sm text-gray-500">Balance: {fromToken?.balance}</span>
          </div>
          <div className="flex items-center gap-3 p-4 rounded-xl bg-[#0a0a0a] border border-[#1a1a1a]">
            <div className="relative">
              <button
                onClick={() => setShowFromDropdown(!showFromDropdown)}
                className="flex items-center gap-2 px-3 py-2 rounded-lg bg-[#111111] hover:bg-[#1a1a1a] transition-colors"
              >
                <span className="text-lg">{fromToken?.icon}</span>
                <span className="font-medium text-white">{fromToken?.symbol}</span>
                <ChevronDown className="w-4 h-4 text-gray-400" />
              </button>

              {showFromDropdown && (
                <div className="absolute z-10 w-40 mt-2 rounded-xl bg-[#0a0a0a] border border-[#1a1a1a] shadow-2xl overflow-hidden">
                  {tokens.filter((t: Token) => t.symbol !== toToken?.symbol).map((token: Token, index: number) => (
                    <button
                      key={index}
                      onClick={() => {
                        setFromToken(token);
                        setShowFromDropdown(false);
                      }}
                      className="w-full flex items-center gap-2 p-3 hover:bg-[#111111] transition-colors"
                    >
                      <span className="text-lg">{token.icon}</span>
                      <span className="font-medium text-white">{token.symbol}</span>
                    </button>
                  ))}
                </div>
              )}
            </div>
            <input
              type="text"
              value={fromAmount}
              onChange={(e) => setFromAmount(e.target.value)}
              placeholder="0.00"
              className="flex-1 bg-transparent text-right text-2xl text-white placeholder-gray-600 focus:outline-none"
            />
          </div>
        </div>

        {/* Switch Button */}
        <div className="flex justify-center -my-3 relative z-10">
          <button
            onClick={switchTokens}
            className="w-10 h-10 rounded-xl bg-[#111111] border border-[#1a1a1a] flex items-center justify-center hover:border-orange-500/30 hover:bg-[#1a1a1a] transition-all"
          >
            <ArrowLeftRight className="w-5 h-5 text-gray-400 rotate-90" />
          </button>
        </div>

        {/* To */}
        <div className="mb-6">
          <div className="flex items-center justify-between mb-2">
            <label className="text-sm text-gray-400">To</label>
            <span className="text-sm text-gray-500">Balance: {toToken?.balance}</span>
          </div>
          <div className="flex items-center gap-3 p-4 rounded-xl bg-[#0a0a0a] border border-[#1a1a1a]">
            <div className="relative">
              <button
                onClick={() => setShowToDropdown(!showToDropdown)}
                className="flex items-center gap-2 px-3 py-2 rounded-lg bg-[#111111] hover:bg-[#1a1a1a] transition-colors"
              >
                <span className="text-lg">{toToken?.icon}</span>
                <span className="font-medium text-white">{toToken?.symbol}</span>
                <ChevronDown className="w-4 h-4 text-gray-400" />
              </button>

              {showToDropdown && (
                <div className="absolute z-10 w-40 mt-2 rounded-xl bg-[#0a0a0a] border border-[#1a1a1a] shadow-2xl overflow-hidden">
                  {tokens.filter((t: Token) => t.symbol !== fromToken?.symbol).map((token: Token, index: number) => (
                    <button
                      key={index}
                      onClick={() => {
                        setToToken(token);
                        setShowToDropdown(false);
                      }}
                      className="w-full flex items-center gap-2 p-3 hover:bg-[#111111] transition-colors"
                    >
                      <span className="text-lg">{token.icon}</span>
                      <span className="font-medium text-white">{token.symbol}</span>
                    </button>
                  ))}
                </div>
              )}
            </div>
            <div className="flex-1 text-right text-2xl text-gray-400">
              {toAmount || '0.00'}
            </div>
          </div>
        </div>

        {/* Rate Info */}
        {fromAmount && (
          <div className="p-4 rounded-xl bg-[#111111] border border-[#1a1a1a] mb-6 space-y-2">
            <div className="flex items-center justify-between text-sm">
              <span className="text-gray-400">Rate</span>
              <span className="text-white">1 {fromToken?.symbol} = {getExchangeRate()} {toToken?.symbol}</span>
            </div>
            <div className="flex items-center justify-between text-sm">
              <span className="text-gray-400">Price Impact</span>
              <span className="text-emerald-400">&lt;0.01%</span>
            </div>
            <div className="flex items-center justify-between text-sm">
              <span className="text-gray-400">Network Fee</span>
              <span className="text-white">~$0.50</span>
            </div>
          </div>
        )}

        {/* Swap Button */}
        <button
          onClick={handleSwap}
          disabled={!fromAmount || swapping}
          className="btn-primary w-full flex items-center justify-center gap-2"
        >
          {swapping ? (
            <>
              <Loader2 className="w-5 h-5 animate-spin" />
              Swapping...
            </>
          ) : (
            <>
              <ArrowLeftRight className="w-5 h-5" />
              Swap
            </>
          )}
        </button>
      </div>
    </div>
  );
}
