'use client';

import { useState } from 'react';
import { X, Search } from 'lucide-react';
import { Token } from '@/stores/wallet';
import clsx from 'clsx';

interface TokenSelectorProps {
  selected: Token;
  onSelect: (token: Token) => void;
  onClose: () => void;
}

const POPULAR_TOKENS: Token[] = [
  {
    address: '0x0000000000000000000000000000000000000000',
    symbol: 'ATLAS',
    name: 'Atlas Token',
    decimals: 18,
    vm: 'evm',
  },
  {
    address: '0x1234567890abcdef1234567890abcdef12345678',
    symbol: 'USDC',
    name: 'USD Coin',
    decimals: 6,
    vm: 'evm',
  },
  {
    address: '0xabcdef1234567890abcdef1234567890abcdef12',
    symbol: 'WETH',
    name: 'Wrapped Ether',
    decimals: 18,
    vm: 'evm',
  },
  {
    address: 'So11111111111111111111111111111111111111112',
    symbol: 'SOL',
    name: 'Wrapped SOL',
    decimals: 9,
    vm: 'svm',
  },
  {
    address: 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v',
    symbol: 'sUSDC',
    name: 'Solana USDC',
    decimals: 6,
    vm: 'svm',
  },
];

export function TokenSelector({ selected, onSelect, onClose }: TokenSelectorProps) {
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState<'all' | 'evm' | 'svm'>('all');

  const filteredTokens = POPULAR_TOKENS.filter((token) => {
    const matchesSearch =
      token.symbol.toLowerCase().includes(search.toLowerCase()) ||
      token.name.toLowerCase().includes(search.toLowerCase());
    const matchesFilter = filter === 'all' || token.vm === filter;
    return matchesSearch && matchesFilter;
  });

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
      <div className="w-full max-w-md mx-4 glass rounded-2xl">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-border">
          <h3 className="text-lg font-bold">Select Token</h3>
          <button
            onClick={onClose}
            className="p-2 rounded-lg hover:bg-muted transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Search */}
        <div className="p-4">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search by name or address..."
              className="w-full pl-10 pr-4 py-3 rounded-xl bg-muted border border-transparent focus:border-primary outline-none transition"
            />
          </div>

          {/* VM Filter */}
          <div className="flex gap-2 mt-4">
            {(['all', 'evm', 'svm'] as const).map((f) => (
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
                {f === 'all' ? 'All' : f.toUpperCase()}
              </button>
            ))}
          </div>
        </div>

        {/* Token List */}
        <div className="max-h-80 overflow-y-auto px-4 pb-4">
          {filteredTokens.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              No tokens found
            </div>
          ) : (
            <div className="space-y-1">
              {filteredTokens.map((token) => (
                <button
                  key={token.address}
                  onClick={() => onSelect(token)}
                  disabled={token.address === selected.address}
                  className={clsx(
                    'w-full flex items-center gap-3 p-3 rounded-xl transition',
                    token.address === selected.address
                      ? 'bg-primary/10 border border-primary cursor-default'
                      : 'hover:bg-muted'
                  )}
                >
                  {/* Token Icon Placeholder */}
                  <div className="w-10 h-10 rounded-full bg-gradient-to-br from-primary to-secondary flex items-center justify-center">
                    <span className="text-sm font-bold">{token.symbol[0]}</span>
                  </div>
                  
                  <div className="flex-1 text-left">
                    <div className="flex items-center gap-2">
                      <span className="font-medium">{token.symbol}</span>
                      <span className="text-xs px-1.5 py-0.5 rounded bg-muted uppercase text-muted-foreground">
                        {token.vm}
                      </span>
                    </div>
                    <div className="text-sm text-muted-foreground">{token.name}</div>
                  </div>

                  {token.balance && (
                    <div className="text-right">
                      <div className="font-medium">{token.balance}</div>
                    </div>
                  )}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
