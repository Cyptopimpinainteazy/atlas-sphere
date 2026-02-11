import React, { useState } from 'react';
import { Plus, Droplets, TrendingUp, Search, Filter } from 'lucide-react';
import clsx from 'clsx';

type PoolFilter = 'all' | 'yours' | 'gainers';

interface Pool {
  id: number;
  tokenA: string;
  tokenB: string;
  iconA: string;
  iconB: string;
  tvl: string;
  apr: number;
  volume24h: string;
  volume7d: string;
  yourLiquidity: string | null;
}

const POOLS: Pool[] = [
  { id: 1, tokenA: 'ATLAS', tokenB: 'USDC', iconA: '🔵', iconB: '💲', tvl: '$32.1M', apr: 24.5, volume24h: '$4.2M', volume7d: '$28.7M', yourLiquidity: '$12,450' },
  { id: 2, tokenA: 'ETH', tokenB: 'ATLAS', iconA: '⟠', iconB: '🔵', tvl: '$18.4M', apr: 18.2, volume24h: '$2.8M', volume7d: '$19.1M', yourLiquidity: '$5,200' },
  { id: 3, tokenA: 'SOL', tokenB: 'ATLAS', iconA: '◎', iconB: '🔵', tvl: '$12.7M', apr: 31.8, volume24h: '$1.9M', volume7d: '$13.4M', yourLiquidity: '$820' },
  { id: 4, tokenA: 'WETH', tokenB: 'USDC', iconA: '⟠', iconB: '💲', tvl: '$8.9M', apr: 12.4, volume24h: '$1.1M', volume7d: '$7.8M', yourLiquidity: null },
  { id: 5, tokenA: 'ATLAS', tokenB: 'ETH', iconA: '🔵', iconB: '⟠', tvl: '$5.6M', apr: 15.7, volume24h: '$890K', volume7d: '$6.2M', yourLiquidity: null },
  { id: 6, tokenA: 'SOL', tokenB: 'USDC', iconA: '◎', iconB: '💲', tvl: '$4.3M', apr: 9.8, volume24h: '$720K', volume7d: '$5.0M', yourLiquidity: null },
  { id: 7, tokenA: 'ETH', tokenB: 'USDC', iconA: '⟠', iconB: '💲', tvl: '$3.8M', apr: 8.1, volume24h: '$540K', volume7d: '$3.8M', yourLiquidity: null },
  { id: 8, tokenA: 'SOL', tokenB: 'ETH', iconA: '◎', iconB: '⟠', tvl: '$1.9M', apr: 22.3, volume24h: '$310K', volume7d: '$2.2M', yourLiquidity: null },
  { id: 9, tokenA: 'ATLAS', tokenB: 'SOL', iconA: '🔵', iconB: '◎', tvl: '$1.2M', apr: 35.6, volume24h: '$198K', volume7d: '$1.4M', yourLiquidity: null },
  { id: 10, tokenA: 'WETH', tokenB: 'ATLAS', iconA: '⟠', iconB: '🔵', tvl: '$340K', apr: 42.1, volume24h: '$52K', volume7d: '$380K', yourLiquidity: null },
];

const DexPoolsPanel: React.FC = () => {
  const [filter, setFilter] = useState<PoolFilter>('all');
  const [searchQuery, setSearchQuery] = useState('');

  const filteredPools = POOLS.filter((pool) => {
    const matchesSearch =
      !searchQuery ||
      `${pool.tokenA}/${pool.tokenB}`.toLowerCase().includes(searchQuery.toLowerCase());
    if (filter === 'yours') return matchesSearch && pool.yourLiquidity !== null;
    if (filter === 'gainers') return matchesSearch && pool.apr > 20;
    return matchesSearch;
  });

  const aprColor = (apr: number) => {
    if (apr > 20) return 'text-green-400';
    if (apr > 10) return 'text-blue-400';
    return 'text-white';
  };

  return (
    <div className="h-full flex flex-col bg-[#0a0a0f] text-white overflow-auto">
      {/* Header */}
      <div className="flex items-center justify-between px-5 py-4 border-b border-[#1a1a1a]">
        <div className="flex items-center gap-3">
          <Droplets size={18} className="text-blue-400" />
          <h1 className="text-lg font-bold">Liquidity Pools</h1>
        </div>
        <div className="flex items-center gap-3">
          <div className="relative">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" />
            <input
              type="text"
              placeholder="Search pools..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="bg-[#111111] border border-[#1a1a1a] rounded-lg pl-9 pr-3 py-2 text-xs text-white placeholder-gray-600 outline-none focus:border-blue-500/40 w-48"
            />
          </div>
          <button className="flex items-center gap-2 bg-gradient-to-r from-blue-500 to-blue-600 hover:from-blue-400 hover:to-blue-500 text-white text-xs font-semibold px-4 py-2 rounded-lg transition-all">
            <Plus size={14} /> New Position
          </button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-4 gap-3 px-5 py-4">
        {[
          { label: 'Total TVL', value: '$89.2M' },
          { label: '24h Volume', value: '$12.4M' },
          { label: 'Active Pools', value: '47' },
          { label: 'Your Positions', value: '3' },
        ].map((s) => (
          <div key={s.label} className="bg-[#111111] rounded-xl p-3 border border-[#1a1a1a]">
            <div className="text-xs text-gray-500">{s.label}</div>
            <div className="text-lg font-bold text-white mt-0.5">{s.value}</div>
          </div>
        ))}
      </div>

      {/* Filter tabs */}
      <div className="px-5 flex items-center gap-1 mb-3">
        <Filter size={12} className="text-gray-500 mr-1" />
        {([
          ['all', 'All Pools'],
          ['yours', 'Your Positions'],
          ['gainers', 'Top Gainers'],
        ] as const).map(([key, label]) => (
          <button
            key={key}
            onClick={() => setFilter(key)}
            className={clsx(
              'px-3 py-1.5 rounded-md text-xs font-medium transition-colors',
              filter === key
                ? 'bg-blue-500/20 text-blue-400'
                : 'text-gray-500 hover:text-white',
            )}
          >
            {label}
          </button>
        ))}
      </div>

      {/* Pool table */}
      <div className="flex-1 px-5 pb-5 overflow-auto">
        <div className="bg-[#111111] rounded-xl border border-[#1a1a1a] overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-[#1a1a1a] text-gray-500 text-xs">
                <th className="text-left p-3">Pool</th>
                <th className="text-right p-3">TVL</th>
                <th className="text-right p-3">APR</th>
                <th className="text-right p-3">24h Volume</th>
                <th className="text-right p-3">7d Volume</th>
                <th className="text-right p-3">Your Liquidity</th>
              </tr>
            </thead>
            <tbody>
              {filteredPools.map((pool) => (
                <tr
                  key={pool.id}
                  className="border-b border-[#1a1a1a] last:border-0 hover:bg-[#0f0f14] transition-colors cursor-pointer"
                >
                  <td className="p-3">
                    <div className="flex items-center gap-2">
                      <div className="flex -space-x-1">
                        <span className="text-base">{pool.iconA}</span>
                        <span className="text-base">{pool.iconB}</span>
                      </div>
                      <span className="font-medium text-white">
                        {pool.tokenA}/{pool.tokenB}
                      </span>
                    </div>
                  </td>
                  <td className="p-3 text-right text-white">{pool.tvl}</td>
                  <td className={clsx('p-3 text-right font-medium', aprColor(pool.apr))}>
                    <div className="flex items-center justify-end gap-1">
                      <TrendingUp size={12} />
                      {pool.apr}%
                    </div>
                  </td>
                  <td className="p-3 text-right text-gray-400">{pool.volume24h}</td>
                  <td className="p-3 text-right text-gray-400">{pool.volume7d}</td>
                  <td className="p-3 text-right">
                    {pool.yourLiquidity ? (
                      <span className="text-white font-medium">{pool.yourLiquidity}</span>
                    ) : (
                      <span className="text-gray-600">—</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {filteredPools.length === 0 && (
            <div className="p-8 text-center text-gray-500 text-sm">No pools found</div>
          )}
        </div>
      </div>
    </div>
  );
};

export default DexPoolsPanel;
