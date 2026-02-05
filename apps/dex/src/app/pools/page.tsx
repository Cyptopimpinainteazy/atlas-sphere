'use client';

import { useState } from 'react';
import { Plus, Droplets, TrendingUp, Search, Filter } from 'lucide-react';
import clsx from 'clsx';

const MOCK_POOLS = [
  {
    id: 1,
    token0: { symbol: 'ATLAS', vm: 'evm' },
    token1: { symbol: 'USDC', vm: 'evm' },
    tvl: 2_450_000,
    apr: 24.5,
    volume24h: 890_000,
    fees24h: 2_670,
    myLiquidity: 0,
  },
  {
    id: 2,
    token0: { symbol: 'WETH', vm: 'evm' },
    token1: { symbol: 'ATLAS', vm: 'evm' },
    tvl: 5_200_000,
    apr: 18.2,
    volume24h: 1_250_000,
    fees24h: 3_750,
    myLiquidity: 0,
  },
  {
    id: 3,
    token0: { symbol: 'SOL', vm: 'svm' },
    token1: { symbol: 'sUSDC', vm: 'svm' },
    tvl: 3_800_000,
    apr: 32.1,
    volume24h: 2_100_000,
    fees24h: 6_300,
    myLiquidity: 0,
  },
  {
    id: 4,
    token0: { symbol: 'ATLAS', vm: 'evm' },
    token1: { symbol: 'SOL', vm: 'svm' },
    tvl: 1_200_000,
    apr: 45.8,
    volume24h: 560_000,
    fees24h: 1_680,
    myLiquidity: 0,
    isCrossVM: true,
  },
];

function formatUsd(value: number): string {
  if (value >= 1_000_000) {
    return `$${(value / 1_000_000).toFixed(2)}M`;
  }
  if (value >= 1_000) {
    return `$${(value / 1_000).toFixed(2)}K`;
  }
  return `$${value.toFixed(2)}`;
}

export default function PoolsPage() {
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState<'all' | 'evm' | 'svm' | 'cross'>('all');
  const [sortBy, setSortBy] = useState<'tvl' | 'apr' | 'volume'>('tvl');

  const filteredPools = MOCK_POOLS
    .filter((pool) => {
      const matchesSearch =
        pool.token0.symbol.toLowerCase().includes(search.toLowerCase()) ||
        pool.token1.symbol.toLowerCase().includes(search.toLowerCase());
      
      if (filter === 'all') return matchesSearch;
      if (filter === 'cross') return matchesSearch && pool.isCrossVM;
      return matchesSearch && pool.token0.vm === filter && pool.token1.vm === filter;
    })
    .sort((a, b) => {
      if (sortBy === 'tvl') return b.tvl - a.tvl;
      if (sortBy === 'apr') return b.apr - a.apr;
      return b.volume24h - a.volume24h;
    });

  return (
    <div className="max-w-6xl mx-auto">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8">
        <div>
          <h1 className="text-3xl font-bold">Liquidity Pools</h1>
          <p className="text-muted-foreground mt-1">
            Provide liquidity and earn fees from trades
          </p>
        </div>
        <button className="flex items-center gap-2 px-6 py-3 rounded-xl gradient-primary font-medium hover:opacity-90 transition">
          <Plus className="w-5 h-5" />
          Create Pool
        </button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
        <div className="glass rounded-xl p-4">
          <div className="flex items-center gap-2 text-muted-foreground mb-2">
            <Droplets className="w-4 h-4" />
            <span className="text-sm">Total Value Locked</span>
          </div>
          <div className="text-2xl font-bold">$12.65M</div>
        </div>
        <div className="glass rounded-xl p-4">
          <div className="flex items-center gap-2 text-muted-foreground mb-2">
            <TrendingUp className="w-4 h-4" />
            <span className="text-sm">24h Volume</span>
          </div>
          <div className="text-2xl font-bold">$4.8M</div>
        </div>
        <div className="glass rounded-xl p-4">
          <div className="flex items-center gap-2 text-muted-foreground mb-2">
            <Plus className="w-4 h-4" />
            <span className="text-sm">24h Fees</span>
          </div>
          <div className="text-2xl font-bold">$14.4K</div>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-col md:flex-row gap-4 mb-6">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search pools..."
            className="w-full pl-10 pr-4 py-2.5 rounded-xl bg-muted border border-transparent focus:border-primary outline-none transition"
          />
        </div>

        <div className="flex gap-2">
          {(['all', 'evm', 'svm', 'cross'] as const).map((f) => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={clsx(
                'px-4 py-2 rounded-lg text-sm font-medium transition',
                filter === f
                  ? 'bg-primary text-white'
                  : 'bg-muted hover:bg-border'
              )}
            >
              {f === 'all' ? 'All' : f === 'cross' ? 'Cross-VM' : f.toUpperCase()}
            </button>
          ))}
        </div>

        <div className="flex items-center gap-2">
          <Filter className="w-4 h-4 text-muted-foreground" />
          <select
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value as any)}
            className="px-3 py-2 rounded-lg bg-muted border border-transparent focus:border-primary outline-none text-sm"
          >
            <option value="tvl">Sort by TVL</option>
            <option value="apr">Sort by APR</option>
            <option value="volume">Sort by Volume</option>
          </select>
        </div>
      </div>

      {/* Pool List */}
      <div className="glass rounded-xl overflow-hidden">
        <table className="w-full">
          <thead>
            <tr className="border-b border-border">
              <th className="text-left py-4 px-4 text-sm font-medium text-muted-foreground">Pool</th>
              <th className="text-right py-4 px-4 text-sm font-medium text-muted-foreground">TVL</th>
              <th className="text-right py-4 px-4 text-sm font-medium text-muted-foreground">APR</th>
              <th className="text-right py-4 px-4 text-sm font-medium text-muted-foreground hidden md:table-cell">24h Volume</th>
              <th className="text-right py-4 px-4 text-sm font-medium text-muted-foreground hidden md:table-cell">24h Fees</th>
              <th className="text-right py-4 px-4 text-sm font-medium text-muted-foreground">Actions</th>
            </tr>
          </thead>
          <tbody>
            {filteredPools.map((pool) => (
              <tr
                key={pool.id}
                className="border-b border-border last:border-0 hover:bg-muted/30 transition"
              >
                <td className="py-4 px-4">
                  <div className="flex items-center gap-3">
                    <div className="flex -space-x-2">
                      <div className="w-8 h-8 rounded-full bg-gradient-to-br from-primary to-secondary flex items-center justify-center ring-2 ring-card">
                        <span className="text-xs font-bold">{pool.token0.symbol[0]}</span>
                      </div>
                      <div className="w-8 h-8 rounded-full bg-gradient-to-br from-accent to-primary flex items-center justify-center ring-2 ring-card">
                        <span className="text-xs font-bold">{pool.token1.symbol[0]}</span>
                      </div>
                    </div>
                    <div>
                      <div className="font-medium">
                        {pool.token0.symbol}/{pool.token1.symbol}
                      </div>
                      <div className="flex gap-1 mt-0.5">
                        <span className="text-xs px-1.5 py-0.5 rounded bg-muted uppercase text-muted-foreground">
                          {pool.token0.vm}
                        </span>
                        {pool.isCrossVM && (
                          <span className="text-xs px-1.5 py-0.5 rounded bg-primary/20 text-primary">
                            Cross-VM
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                </td>
                <td className="py-4 px-4 text-right font-mono">{formatUsd(pool.tvl)}</td>
                <td className="py-4 px-4 text-right">
                  <span className="text-success font-medium">{pool.apr.toFixed(1)}%</span>
                </td>
                <td className="py-4 px-4 text-right font-mono hidden md:table-cell">
                  {formatUsd(pool.volume24h)}
                </td>
                <td className="py-4 px-4 text-right font-mono hidden md:table-cell">
                  {formatUsd(pool.fees24h)}
                </td>
                <td className="py-4 px-4 text-right">
                  <button className="px-4 py-2 rounded-lg bg-primary/10 text-primary font-medium hover:bg-primary/20 transition">
                    Add Liquidity
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
