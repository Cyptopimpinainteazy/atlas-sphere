'use client'

import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { BookOpen, TrendingUp } from 'lucide-react'

export function OrderBook() {
  // Mock order book data
  const bids = [
    { price: 98.4, amount: 1250.5, total: 123047.2 },
    { price: 98.35, amount: 890.2, total: 87554.47 },
    { price: 98.3, amount: 2340.8, total: 230201.04 },
    { price: 98.25, amount: 450.3, total: 44242.03 },
    { price: 98.2, amount: 1580.7, total: 155226.74 },
    { price: 98.15, amount: 720.4, total: 70717.06 },
    { price: 98.1, amount: 930.8, total: 91233.48 },
    { price: 98.05, amount: 1120.3, total: 109847.42 },
  ]

  const asks = [
    { price: 98.45, amount: 840.2, total: 82750.89 },
    { price: 98.5, amount: 1230.5, total: 121205.25 },
    { price: 98.55, amount: 670.8, total: 66118.24 },
    { price: 98.6, amount: 1450.3, total: 143039.58 },
    { price: 98.65, amount: 890.7, total: 87864.86 },
    { price: 98.7, amount: 1120.4, total: 110543.48 },
    { price: 98.75, amount: 560.9, total: 55408.88 },
    { price: 98.8, amount: 780.6, total: 77123.28 },
  ]

  const spread = asks[0].price - bids[0].price
  const spreadPercent = (spread / bids[0].price) * 100

  const getDepthPercentage = (total: number, maxTotal: number) => {
    return (total / maxTotal) * 100
  }

  const getNeonGlowColor = (percentage: number, isBid: boolean) => {
    if (isBid) {
      // Green gradient for bids
      if (percentage > 80) return 'shadow-green-500/50 bg-gradient-to-r from-green-400/60 to-emerald-500/60'
      if (percentage > 60) return 'shadow-green-400/30 bg-gradient-to-r from-green-300/40 to-green-400/40'
      return 'shadow-green-300/20 bg-gradient-to-r from-green-200/20 to-green-300/20'
    } else {
      // Red gradient for asks
      if (percentage > 80) return 'shadow-red-500/50 bg-gradient-to-r from-red-400/60 to-rose-500/60'
      if (percentage > 60) return 'shadow-red-400/30 bg-gradient-to-r from-red-300/40 to-red-400/40'
      return 'shadow-red-300/20 bg-gradient-to-r from-red-200/20 to-red-300/20'
    }
  }

  const maxBidTotal = Math.max(...bids.map((b) => b.total))
  const maxAskTotal = Math.max(...asks.map((a) => a.total))

  return (
    <Card className="relative glass-dark glow-cyan group h-full">
      <div className="absolute inset-0 bg-gradient-to-br from-cyan-500/5 via-transparent to-blue-500/5 opacity-0 group-hover:opacity-100 transition-opacity duration-500" />

      <CardHeader className="border-b border-white/10">
        <CardTitle className="flex items-center justify-between text-white">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-gradient-to-r from-cyan-500/20 to-blue-500/20 rounded-lg border border-cyan-400/30">
              <BookOpen className="w-5 h-5 text-cyan-300" />
            </div>
            <div className="text-lg font-bold">Order Book</div>
          </div>
          <Badge className="bg-gradient-to-r from-cyan-500 to-blue-500 hover:from-cyan-600 hover:to-blue-600 text-white font-semibold">
            SOL/USDC
          </Badge>
        </CardTitle>
      </CardHeader>

      <CardContent className="p-0 flex flex-col h-[500px]">
        <div className="px-4 py-3 border-b border-white/10 bg-gradient-to-r from-slate-800/50 to-gray-800/50">
          <div className="grid grid-cols-3 gap-4 text-xs font-semibold text-gray-300">
            <div className="font-mono">Price (USDC)</div>
            <div className="text-right font-mono">Amount (SOL)</div>
            <div className="text-right font-mono">Total (USDC)</div>
          </div>
        </div>

        {/* Asks (Sell Orders) */}
        <div className="flex-1 overflow-y-auto scrollbar-thin scrollbar-thumb-white/10 scrollbar-track-transparent">
          {asks.reverse().map((ask, index) => {
            const depthPercentage = getDepthPercentage(ask.total, maxAskTotal)
            return (
              <div
                key={index}
                className="relative px-4 py-2 hover:bg-white/5 cursor-pointer group transition-all duration-200 hover:scale-[1.02] border-l-2 border-transparent hover:border-red-400/50"
              >
                <div
                  className={`absolute right-0 top-0 h-full transition-all duration-300 ${getNeonGlowColor(depthPercentage, false)} opacity-30 group-hover:opacity-60`}
                  style={{ width: `${depthPercentage}%` }}
                />
                <div className="relative grid grid-cols-3 gap-4 text-xs z-10">
                  <div className="text-red-300 font-mono font-semibold group-hover:text-red-200 transition-colors">
                    {ask.price.toFixed(2)}
                    <div className="absolute -top-1 -right-1 w-1 h-1 bg-red-400 rounded-full animate-ping" />
                  </div>
                  <div className="text-right font-mono text-gray-300 group-hover:text-white transition-colors">
                    {ask.amount.toFixed(1)}
                  </div>
                  <div className="text-right font-mono text-gray-400 group-hover:text-gray-200 transition-colors">
                    ${ask.total.toLocaleString()}
                  </div>
                </div>
              </div>
            )
          })}
        </div>

        {/* Spread Indicator */}
        <div className="px-4 py-3 bg-gradient-to-r from-amber-500/10 via-yellow-500/10 to-orange-500/10 border-y border-amber-400/20 m-1 rounded">
          <div className="flex items-center justify-between text-sm">
            <div className="flex items-center gap-3">
              <div className="w-3 h-3 bg-gradient-to-r from-amber-400 to-orange-400 rounded-full animate-pulse" />
              <span className="text-gray-300 font-medium">Spread:</span>
              <span className="font-mono font-bold text-amber-300">${spread.toFixed(2)}</span>
              <Badge className="bg-gradient-to-r from-orange-500/20 to-red-500/20 border border-orange-400/30 text-orange-200">
                {spreadPercent.toFixed(3)}%
              </Badge>
            </div>
            <div className="flex items-center gap-2 text-emerald-400">
              <TrendingUp className="w-4 h-4 animate-bounce" />
              <span className="text-xs font-semibold">Very Tight</span>
            </div>
          </div>
        </div>

        {/* Bids (Buy Orders) */}
        <div className="flex-1 overflow-y-auto scrollbar-thin scrollbar-thumb-white/10 scrollbar-track-transparent">
          {bids.map((bid, index) => {
            const depthPercentage = getDepthPercentage(bid.total, maxBidTotal)
            return (
              <div
                key={index}
                className="relative px-4 py-2 hover:bg-white/5 cursor-pointer group transition-all duration-200 hover:scale-[1.02] border-l-2 border-transparent hover:border-green-400/50"
              >
                <div
                  className={`absolute right-0 top-0 h-full transition-all duration-300 ${getNeonGlowColor(depthPercentage, true)} opacity-30 group-hover:opacity-60`}
                  style={{ width: `${depthPercentage}%` }}
                />
                <div className="relative grid grid-cols-3 gap-4 text-xs z-10">
                  <div className="text-green-300 font-mono font-semibold group-hover:text-green-200 transition-colors">
                    {bid.price.toFixed(2)}
                    <div className="absolute -top-1 -right-1 w-1 h-1 bg-green-400 rounded-full animate-ping" />
                  </div>
                  <div className="text-right font-mono text-gray-300 group-hover:text-white transition-colors">
                    {bid.amount.toFixed(1)}
                  </div>
                  <div className="text-right font-mono text-gray-400 group-hover:text-gray-200 transition-colors">
                    ${bid.total.toLocaleString()}
                  </div>
                </div>
              </div>
            )
          })}
        </div>

        {/* Enhanced Summary */}
        <div className="px-4 py-4 border-t border-white/10 bg-gradient-to-r from-slate-800/50 to-gray-800/50">
          <div className="grid grid-cols-2 gap-6 text-xs">
            <div className="space-y-2">
              <div className="flex items-center justify-between p-2 bg-green-500/10 rounded border border-green-400/20">
                <span className="text-gray-300">Total Bids:</span>
                <div className="flex items-center gap-2">
                  <div className="w-2 h-2 bg-green-400 rounded-full animate-pulse" />
                  <span className="text-green-300 font-bold font-mono">
                    {bids.reduce((sum, bid) => sum + bid.amount, 0).toFixed(0)} SOL
                  </span>
                </div>
              </div>
              <div className="flex justify-between text-gray-400">
                <span>Bid Volume:</span>
                <span className="font-mono text-white">${bids.reduce((sum, bid) => sum + bid.total, 0).toLocaleString()}</span>
              </div>
            </div>
            <div className="space-y-2">
              <div className="flex items-center justify-between p-2 bg-red-500/10 rounded border border-red-400/20">
                <span className="text-gray-300">Total Asks:</span>
                <div className="flex items-center gap-2">
                  <div className="w-2 h-2 bg-red-400 rounded-full animate-pulse" />
                  <span className="text-red-300 font-bold font-mono">
                    {asks.reduce((sum, ask) => sum + ask.amount, 0).toFixed(0)} SOL
                  </span>
                </div>
              </div>
              <div className="flex justify-between text-gray-400">
                <span>Ask Volume:</span>
                <span className="font-mono text-white">${asks.reduce((sum, ask) => sum + ask.total, 0).toLocaleString()}</span>
              </div>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}
