'use client';

import { useState, useEffect, useMemo } from 'react';
import { OrderBook, generateOrderBook, PriceSparkline, FlashloanPanel, PriceDifference } from '@/components/x3/ArbitrageComponents';
import { Button } from '@/components/x3/UIComponents';
import { getProviders, estimateFlashloan } from '@/lib/x3/services/flashloans';

const DEFAULT_PROVIDERS = ['Aave', 'DyDx', 'Balancer', 'UniswapV3', 'BProtocol'];

export default function ArbitragePage() {
  const [midA, setMidA] = useState(1842.12);
  const [midB, setMidB] = useState(1842.62);
  const [providers] = useState<string[]>(DEFAULT_PROVIDERS);
  const [enabled, setEnabled] = useState<Record<string, boolean>>(() => {
    const o: Record<string, boolean> = {};
    DEFAULT_PROVIDERS.forEach((p) => (o[p] = true));
    return o;
  });
  const [historyA, setHistoryA] = useState<number[]>([midA]);
  const [historyB, setHistoryB] = useState<number[]>([midB]);

  useEffect(() => {
    const t = setInterval(() => {
      setMidA((m) => +(m + (Math.random() - 0.5) * 0.6).toFixed(4));
      setMidB((m) => +(m + (Math.random() - 0.5) * 0.6).toFixed(4));
      setHistoryA((h) => [...h.slice(-20), +(h[h.length-1] + (Math.random() - 0.5) * 0.6).toFixed(4)]);
      setHistoryB((h) => [...h.slice(-20), +(h[h.length-1] + (Math.random() - 0.5) * 0.6).toFixed(4)]);
    }, 1500);
    return () => clearInterval(t);
  }, []);

  const { bids: bidsA, asks: asksA } = useMemo(() => generateOrderBook(midA, 10, 0.06), [midA]);
  const { bids: bidsB, asks: asksB } = useMemo(() => generateOrderBook(midB, 10, 0.06), [midB]);

  const bestBidA = bidsA[0]?.price ?? 0;
  const bestAskB = asksB[0]?.price ?? 0;

  const spread = useMemo(() => ({ diff: bestAskB - bestBidA, pct: ((bestAskB - bestBidA) / ((bestAskB + bestBidA)/2)) * 100 }), [bestAskB, bestBidA]);

  function toggleProvider(p: string) {
    setEnabled((e) => ({ ...e, [p]: !e[p] }));
  }

  const [estimates, setEstimates] = useState<Record<string, any>>({});

  async function refreshEstimates() {
    const active = Object.keys(enabled).filter((k) => enabled[k]);
    const res: Record<string, any> = {};
    for (const p of active) {
      try {
        const e = await estimateFlashloan(p, Math.abs(spread.diff) * 1000 || 1000);
        res[p] = e;
      } catch (err) {
        res[p] = { error: true };
      }
    }
    setEstimates(res);
  }

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-baseline gap-4">
        <h1 className="text-3xl font-bold">Arbitrage Desk</h1>
        <span className="text-gray-400">Order-book style monitoring & flashloan options</span>
      </div>

      <div className="grid grid-cols-3 gap-4">
        <div className="col-span-2 bg-x3-dark p-4 rounded border border-x3-dark-gray">
          <h2 className="text-lg font-bold mb-4">Order Books</h2>
          <div className="grid grid-cols-3 gap-4">
            <div>
              <h3 className="text-sm font-bold mb-2">Exchange A • Mid {midA.toFixed(4)}</h3>
              <OrderBook bids={bidsA} asks={asksA} />
              <div className="mt-3">
                <PriceSparkline data={historyA.slice(-20)} color="#00d4aa" />
              </div>
            </div>

            <div className="flex flex-col justify-center items-center">
              <h4 className="text-xs font-bold mb-2">Price Difference</h4>
              <PriceDifference priceA={midA} priceB={midB} />
              <div className="mt-4 text-center text-xs">
                <div className="text-gray-400">Best A bid / Best B ask</div>
                <div className="font-bold mt-1">{bestBidA.toFixed(4)} / {bestAskB.toFixed(4)}</div>
              </div>
            </div>

            <div>
              <h3 className="text-sm font-bold mb-2">Exchange B • Mid {midB.toFixed(4)}</h3>
              <OrderBook bids={bidsB} asks={asksB} />
              <div className="mt-3">
                <PriceSparkline data={historyB.slice(-20)} color="#4488ff" />
              </div>
            </div>
          </div>
        </div>

        <div className="space-y-4">
          <div className="bg-x3-dark p-4 rounded border border-x3-dark-gray">
            <h2 className="text-lg font-bold mb-4">Flashloan Options</h2>
            <FlashloanPanel providers={providers} enabled={enabled} onToggle={toggleProvider} />
            <div className="mt-4 space-y-3">
              <div className="text-xs text-gray-400">Estimated cost (simulated)</div>
              <Button variant="secondary" size="sm" onClick={refreshEstimates} className="w-full">
                Refresh Estimates
              </Button>

              <div className="space-y-2 text-xs">
                {Object.keys(estimates).length === 0 && (
                  <div className="text-gray-400">No estimates yet.</div>
                )}
                {Object.entries(estimates).map(([p, e]) => (
                  <div key={p} className="flex justify-between">
                    <div>{p}</div>
                    <div className="font-mono">{e.error ? '—' : `${(e.feePct*100).toFixed(3)}%`}</div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          <div className="bg-x3-dark p-4 rounded border border-x3-dark-gray">
            <h2 className="text-lg font-bold mb-3">Execution</h2>
            <Button variant="primary" className="w-full">
              Simulate Arbitrage
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
