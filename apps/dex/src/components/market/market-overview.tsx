'use client';

import { TrendingUp, TrendingDown, Activity } from 'lucide-react';

const MOCK_MARKETS = [
  { pair: 'ATLAS/USDC', price: '1.25', change: 5.2, volume: '1.2M', vm: 'evm' },
  { pair: 'WETH/ATLAS', price: '1,842.50', change: -2.1, volume: '892K', vm: 'evm' },
  { pair: 'SOL/sUSDC', price: '98.45', change: 3.8, volume: '2.1M', vm: 'svm' },
  { pair: 'ATLAS/SOL', price: '0.0127', change: 1.4, volume: '456K', vm: 'cross' },
];

export function MarketOverview() {
  return (
    <div className="glass rounded-xl p-4">
      <div className="flex items-center gap-2 mb-4">
        <Activity className="w-5 h-5 text-primary" />
        <h3 className="font-bold">Markets</h3>
      </div>

      <div className="space-y-3">
        {MOCK_MARKETS.map((market) => (
          <div
            key={market.pair}
            className="flex items-center justify-between p-3 rounded-lg bg-muted/30 hover:bg-muted/50 transition cursor-pointer"
          >
            <div>
              <div className="flex items-center gap-2">
                <span className="font-medium">{market.pair}</span>
                <span className="text-xs px-1.5 py-0.5 rounded bg-muted uppercase text-muted-foreground">
                  {market.vm}
                </span>
              </div>
              <div className="text-sm text-muted-foreground">
                Vol: ${market.volume}
              </div>
            </div>

            <div className="text-right">
              <div className="font-mono">${market.price}</div>
              <div
                className={`flex items-center gap-1 text-sm ${
                  market.change >= 0 ? 'text-success' : 'text-danger'
                }`}
              >
                {market.change >= 0 ? (
                  <TrendingUp className="w-3 h-3" />
                ) : (
                  <TrendingDown className="w-3 h-3" />
                )}
                {Math.abs(market.change)}%
              </div>
            </div>
          </div>
        ))}
      </div>

      <button className="w-full mt-4 py-2 text-sm text-primary hover:underline">
        View All Markets →
      </button>
    </div>
  );
}
