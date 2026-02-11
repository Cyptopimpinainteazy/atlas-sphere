import React, { useState, useCallback } from 'react';
import {
  ArrowDown,
  Settings,
  RefreshCw,
  TrendingUp,
  TrendingDown,
  ArrowUpRight,
  ArrowDownLeft,
  Clock,
  Zap,
} from 'lucide-react';
import clsx from 'clsx';

type Tab = 'swap' | 'market' | 'trades';

interface Token {
  symbol: string;
  name: string;
  network: string;
  price: number;
  icon: string;
}

const TOKENS: Token[] = [
  { symbol: 'ATLAS', name: 'Atlas Sphere', network: 'Atlas', price: 1.25, icon: '🔵' },
  { symbol: 'ETH', name: 'Ethereum', network: 'EVM', price: 3245.8, icon: '⟠' },
  { symbol: 'SOL', name: 'Solana', network: 'SVM', price: 178.42, icon: '◎' },
  { symbol: 'USDC', name: 'USD Coin', network: 'Multi', price: 1.0, icon: '💲' },
  { symbol: 'WETH', name: 'Wrapped ETH', network: 'EVM', price: 3244.1, icon: '⟠' },
];

const MARKET_PAIRS = [
  { pair: 'ATLAS/USDC', price: 1.25, change: 5.2, volume: '4.2M' },
  { pair: 'ETH/ATLAS', price: 2596.64, change: -1.3, volume: '2.8M' },
  { pair: 'SOL/ATLAS', price: 142.74, change: 3.7, volume: '1.9M' },
  { pair: 'WETH/USDC', price: 3244.1, change: -0.8, volume: '1.1M' },
  { pair: 'ATLAS/ETH', price: 0.000385, change: 6.1, volume: '890K' },
  { pair: 'SOL/USDC', price: 178.42, change: 2.1, volume: '720K' },
  { pair: 'ETH/USDC', price: 3245.8, change: -1.1, volume: '540K' },
  { pair: 'SOL/ETH', price: 0.05495, change: 4.9, volume: '310K' },
];

const MOCK_TRADES = [
  { id: 1, type: 'buy' as const, pair: 'ATLAS/USDC', amount: '12,500', price: '1.2512', time: '2s ago' },
  { id: 2, type: 'sell' as const, pair: 'ETH/ATLAS', amount: '0.85', price: '2,596.64', time: '5s ago' },
  { id: 3, type: 'buy' as const, pair: 'SOL/ATLAS', amount: '45.2', price: '142.74', time: '12s ago' },
  { id: 4, type: 'buy' as const, pair: 'ATLAS/USDC', amount: '8,200', price: '1.2508', time: '18s ago' },
  { id: 5, type: 'sell' as const, pair: 'ATLAS/USDC', amount: '3,100', price: '1.2501', time: '25s ago' },
  { id: 6, type: 'buy' as const, pair: 'ETH/ATLAS', amount: '1.2', price: '2,597.10', time: '31s ago' },
  { id: 7, type: 'sell' as const, pair: 'SOL/ATLAS', amount: '22.8', price: '142.68', time: '45s ago' },
  { id: 8, type: 'buy' as const, pair: 'WETH/USDC', amount: '0.5', price: '3,244.10', time: '52s ago' },
  { id: 9, type: 'sell' as const, pair: 'ATLAS/ETH', amount: '5,000', price: '0.000385', time: '1m ago' },
  { id: 10, type: 'buy' as const, pair: 'SOL/USDC', amount: '10.0', price: '178.42', time: '1m ago' },
];

const DexPanel: React.FC = () => {
  const [tab, setTab] = useState<Tab>('swap');
  const [payToken, setPayToken] = useState(TOKENS[0]);
  const [receiveToken, setReceiveToken] = useState(TOKENS[3]);
  const [payAmount, setPayAmount] = useState('');
  const [showTokenList, setShowTokenList] = useState<'pay' | 'receive' | null>(null);
  const [slippage, setSlippage] = useState(0.5);

  const receiveAmount = payAmount
    ? ((parseFloat(payAmount) * payToken.price) / receiveToken.price).toFixed(6)
    : '';

  const handleSwapDirection = useCallback(() => {
    setPayToken(receiveToken);
    setReceiveToken(payToken);
    setPayAmount('');
  }, [payToken, receiveToken]);

  const selectToken = useCallback(
    (token: Token) => {
      if (showTokenList === 'pay') setPayToken(token);
      else setReceiveToken(token);
      setShowTokenList(null);
    },
    [showTokenList],
  );

  const renderTokenList = () => (
    <div className="absolute z-50 top-full left-0 right-0 mt-2 bg-[#111111] border border-[#1a1a1a] rounded-xl p-2 shadow-2xl">
      {TOKENS.map((t) => (
        <button
          key={t.symbol}
          onClick={() => selectToken(t)}
          className="w-full flex items-center gap-3 p-3 rounded-lg hover:bg-[#1a1a1a] transition-colors"
        >
          <span className="text-xl">{t.icon}</span>
          <div className="text-left flex-1">
            <div className="text-sm font-semibold text-white">{t.symbol}</div>
            <div className="text-xs text-gray-500">{t.name}</div>
          </div>
          <span className="text-[10px] px-1.5 py-0.5 rounded bg-[#0a0a0f] text-gray-400 border border-[#1a1a1a]">
            {t.network}
          </span>
        </button>
      ))}
    </div>
  );

  const renderSwap = () => (
    <div className="max-w-md mx-auto space-y-2">
      {/* You Pay */}
      <div className="relative bg-[#111111] rounded-xl p-4 border border-[#1a1a1a]">
        <div className="text-xs text-gray-500 mb-2">You Pay</div>
        <div className="flex items-center gap-3">
          <button
            onClick={() => setShowTokenList(showTokenList === 'pay' ? null : 'pay')}
            className="flex items-center gap-2 bg-[#0a0a0f] px-3 py-2 rounded-lg border border-[#1a1a1a] hover:border-orange-500/40 transition-colors"
          >
            <span>{payToken.icon}</span>
            <span className="text-sm font-semibold text-white">{payToken.symbol}</span>
            <ArrowDown size={12} className="text-gray-400" />
          </button>
          <input
            type="number"
            placeholder="0.00"
            value={payAmount}
            onChange={(e) => setPayAmount(e.target.value)}
            className="flex-1 bg-transparent text-right text-2xl font-semibold text-white outline-none placeholder-gray-600"
          />
        </div>
        {payAmount && (
          <div className="text-right text-xs text-gray-500 mt-1">
            ≈ ${(parseFloat(payAmount) * payToken.price).toFixed(2)}
          </div>
        )}
        {showTokenList === 'pay' && renderTokenList()}
      </div>

      {/* Swap direction */}
      <div className="flex justify-center -my-1 relative z-10">
        <button
          onClick={handleSwapDirection}
          className="bg-[#111111] border border-[#1a1a1a] rounded-lg p-2 hover:border-orange-500/40 transition-colors"
        >
          <ArrowDown size={16} className="text-orange-400" />
        </button>
      </div>

      {/* You Receive */}
      <div className="relative bg-[#111111] rounded-xl p-4 border border-[#1a1a1a]">
        <div className="text-xs text-gray-500 mb-2">You Receive</div>
        <div className="flex items-center gap-3">
          <button
            onClick={() => setShowTokenList(showTokenList === 'receive' ? null : 'receive')}
            className="flex items-center gap-2 bg-[#0a0a0f] px-3 py-2 rounded-lg border border-[#1a1a1a] hover:border-orange-500/40 transition-colors"
          >
            <span>{receiveToken.icon}</span>
            <span className="text-sm font-semibold text-white">{receiveToken.symbol}</span>
            <ArrowDown size={12} className="text-gray-400" />
          </button>
          <div className="flex-1 text-right text-2xl font-semibold text-white">
            {receiveAmount || '0.00'}
          </div>
        </div>
        {receiveAmount && (
          <div className="text-right text-xs text-gray-500 mt-1">
            ≈ ${(parseFloat(receiveAmount) * receiveToken.price).toFixed(2)}
          </div>
        )}
        {showTokenList === 'receive' && renderTokenList()}
      </div>

      {/* Rate & Info */}
      {payAmount && (
        <div className="bg-[#111111] rounded-xl p-3 border border-[#1a1a1a] text-xs space-y-1.5">
          <div className="flex justify-between text-gray-400">
            <span>Rate</span>
            <span className="text-white">
              1 {payToken.symbol} = {(payToken.price / receiveToken.price).toFixed(6)}{' '}
              {receiveToken.symbol}
            </span>
          </div>
          <div className="flex justify-between text-gray-400">
            <span>Price Impact</span>
            <span className="text-green-400">{'<0.01%'}</span>
          </div>
          <div className="flex justify-between text-gray-400">
            <span>Min Received</span>
            <span className="text-white">
              {(parseFloat(receiveAmount) * (1 - slippage / 100)).toFixed(6)} {receiveToken.symbol}
            </span>
          </div>
          <div className="flex justify-between text-gray-400">
            <span>Execution</span>
            <span className="text-white flex items-center gap-1">
              <Zap size={10} className="text-orange-400" /> Atomic
            </span>
          </div>
        </div>
      )}

      {/* Slippage */}
      <div className="flex items-center gap-2">
        <Settings size={12} className="text-gray-500" />
        <span className="text-xs text-gray-500">Slippage:</span>
        {[0.1, 0.5, 1.0].map((s) => (
          <button
            key={s}
            onClick={() => setSlippage(s)}
            className={clsx(
              'text-xs px-2.5 py-1 rounded-md border transition-colors',
              slippage === s
                ? 'bg-orange-500/20 border-orange-500/40 text-orange-400'
                : 'border-[#1a1a1a] text-gray-500 hover:text-white',
            )}
          >
            {s}%
          </button>
        ))}
      </div>

      {/* Swap button */}
      <button className="w-full py-3 rounded-xl font-semibold text-white bg-gradient-to-r from-orange-500 to-orange-600 hover:from-orange-400 hover:to-orange-500 transition-all shadow-lg shadow-orange-500/20">
        Swap
      </button>
    </div>
  );

  const renderMarket = () => (
    <div className="space-y-4">
      <div className="grid grid-cols-4 gap-3">
        {[
          { label: 'ATLAS Price', value: '$1.25', change: '+5.2%', up: true },
          { label: '24h Volume', value: '$12.4M', change: '+8.1%', up: true },
          { label: 'TVL', value: '$89.2M', change: '+2.4%', up: true },
          { label: 'Active Pairs', value: '47', change: '+3', up: true },
        ].map((s) => (
          <div key={s.label} className="bg-[#111111] rounded-xl p-3 border border-[#1a1a1a]">
            <div className="text-xs text-gray-500 mb-1">{s.label}</div>
            <div className="text-lg font-bold text-white">{s.value}</div>
            <div className={clsx('text-xs mt-0.5', s.up ? 'text-green-400' : 'text-red-400')}>
              {s.change}
            </div>
          </div>
        ))}
      </div>
      <div className="bg-[#111111] rounded-xl border border-[#1a1a1a] overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-[#1a1a1a] text-gray-500 text-xs">
              <th className="text-left p-3">Pair</th>
              <th className="text-right p-3">Price</th>
              <th className="text-right p-3">24h Change</th>
              <th className="text-right p-3">Volume</th>
            </tr>
          </thead>
          <tbody>
            {MARKET_PAIRS.map((m) => (
              <tr
                key={m.pair}
                className="border-b border-[#1a1a1a] last:border-0 hover:bg-[#0f0f14] transition-colors cursor-pointer"
              >
                <td className="p-3 font-medium text-white">{m.pair}</td>
                <td className="p-3 text-right text-white">${m.price.toLocaleString()}</td>
                <td
                  className={clsx(
                    'p-3 text-right flex items-center justify-end gap-1',
                    m.change >= 0 ? 'text-green-400' : 'text-red-400',
                  )}
                >
                  {m.change >= 0 ? <TrendingUp size={12} /> : <TrendingDown size={12} />}
                  {m.change >= 0 ? '+' : ''}
                  {m.change}%
                </td>
                <td className="p-3 text-right text-gray-400">${m.volume}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );

  const renderTrades = () => (
    <div className="bg-[#111111] rounded-xl border border-[#1a1a1a] overflow-hidden">
      <div className="p-3 border-b border-[#1a1a1a] flex items-center gap-2 text-xs text-gray-500">
        <Clock size={12} /> Recent Trades
      </div>
      <div className="divide-y divide-[#1a1a1a]">
        {MOCK_TRADES.map((t) => (
          <div key={t.id} className="flex items-center gap-3 p-3 hover:bg-[#0f0f14] transition-colors">
            <div
              className={clsx(
                'w-7 h-7 rounded-full flex items-center justify-center text-xs',
                t.type === 'buy' ? 'bg-green-500/10 text-green-400' : 'bg-red-500/10 text-red-400',
              )}
            >
              {t.type === 'buy' ? <ArrowUpRight size={14} /> : <ArrowDownLeft size={14} />}
            </div>
            <div className="flex-1">
              <div className="text-sm text-white font-medium">{t.pair}</div>
              <div className="text-xs text-gray-500">
                {t.amount} @ ${t.price}
              </div>
            </div>
            <div className="text-right">
              <span
                className={clsx(
                  'text-xs font-medium',
                  t.type === 'buy' ? 'text-green-400' : 'text-red-400',
                )}
              >
                {t.type.toUpperCase()}
              </span>
              <div className="text-[10px] text-gray-600">{t.time}</div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );

  return (
    <div className="h-full flex flex-col bg-[#0a0a0f] text-white overflow-auto">
      {/* Header */}
      <div className="flex items-center justify-between px-5 py-4 border-b border-[#1a1a1a]">
        <div className="flex items-center gap-3">
          <Zap size={18} className="text-orange-400" />
          <h1 className="text-lg font-bold">Atlas DEX</h1>
        </div>
        <div className="flex items-center gap-1 bg-[#111111] rounded-lg p-1 border border-[#1a1a1a]">
          {(['swap', 'market', 'trades'] as Tab[]).map((t) => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={clsx(
                'px-3 py-1.5 rounded-md text-xs font-medium transition-colors capitalize',
                tab === t
                  ? 'bg-orange-500/20 text-orange-400'
                  : 'text-gray-500 hover:text-white',
              )}
            >
              {t}
            </button>
          ))}
        </div>
        <button className="p-2 rounded-lg hover:bg-[#111111] transition-colors text-gray-500 hover:text-white">
          <RefreshCw size={14} />
        </button>
      </div>

      {/* Content */}
      <div className="flex-1 p-5 overflow-auto">
        {tab === 'swap' && renderSwap()}
        {tab === 'market' && renderMarket()}
        {tab === 'trades' && renderTrades()}
      </div>
    </div>
  );
};

export default DexPanel;
