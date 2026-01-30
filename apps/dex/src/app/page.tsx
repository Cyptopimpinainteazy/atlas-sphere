'use client';

import { SwapInterface } from '@/components/swap/swap-interface';
import { MarketOverview } from '@/components/market/market-overview';
import { RecentTrades } from '@/components/market/recent-trades';

export default function Home() {
  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
      {/* Main Swap Interface */}
      <div className="lg:col-span-2">
        <SwapInterface />
      </div>
      
      {/* Sidebar */}
      <div className="space-y-6">
        <MarketOverview />
        <RecentTrades />
      </div>
    </div>
  );
}
