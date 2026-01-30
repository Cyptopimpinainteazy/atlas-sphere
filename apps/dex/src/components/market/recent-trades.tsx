'use client';

import { ArrowUpRight, ArrowDownLeft, Clock } from 'lucide-react';

const MOCK_TRADES = [
  { type: 'buy', pair: 'ATLAS/USDC', amount: '1,000', price: '1.25', time: '2m ago' },
  { type: 'sell', pair: 'WETH/ATLAS', amount: '0.5', price: '1,842.50', time: '5m ago' },
  { type: 'buy', pair: 'SOL/sUSDC', amount: '25', price: '98.45', time: '8m ago' },
  { type: 'sell', pair: 'ATLAS/SOL', amount: '500', price: '0.0127', time: '12m ago' },
  { type: 'buy', pair: 'ATLAS/USDC', amount: '2,500', price: '1.24', time: '15m ago' },
];

export function RecentTrades() {
  return (
    <div className="glass rounded-xl p-4">
      <div className="flex items-center gap-2 mb-4">
        <Clock className="w-5 h-5 text-primary" />
        <h3 className="font-bold">Recent Trades</h3>
      </div>

      <div className="space-y-2">
        {MOCK_TRADES.map((trade, i) => (
          <div
            key={i}
            className="flex items-center justify-between py-2 border-b border-border last:border-0"
          >
            <div className="flex items-center gap-2">
              {trade.type === 'buy' ? (
                <ArrowUpRight className="w-4 h-4 text-success" />
              ) : (
                <ArrowDownLeft className="w-4 h-4 text-danger" />
              )}
              <div>
                <div className="text-sm font-medium">{trade.pair}</div>
                <div className="text-xs text-muted-foreground">{trade.time}</div>
              </div>
            </div>

            <div className="text-right">
              <div className="text-sm font-mono">{trade.amount}</div>
              <div className="text-xs text-muted-foreground">
                @ ${trade.price}
              </div>
            </div>
          </div>
        ))}
      </div>

      <button className="w-full mt-4 py-2 text-sm text-primary hover:underline">
        View Trade History →
      </button>
    </div>
  );
}
