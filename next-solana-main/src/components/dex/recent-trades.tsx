'use client'

import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Clock, TrendingDown, TrendingUp } from 'lucide-react'

export function RecentTrades() {
  // Mock recent trades data
  const trades = [
    { time: '14:32:15', price: 98.42, amount: 12.5, total: 1230.25, type: 'buy' },
    { time: '14:32:08', price: 98.4, amount: 8.3, total: 816.72, type: 'sell' },
    { time: '14:31:55', price: 98.45, amount: 25.7, total: 2530.17, type: 'buy' },
    { time: '14:31:42', price: 98.38, amount: 15.2, total: 1495.38, type: 'sell' },
    { time: '14:31:30', price: 98.41, amount: 9.8, total: 964.42, type: 'buy' },
    { time: '14:31:18', price: 98.39, amount: 22.1, total: 2174.42, type: 'buy' },
    { time: '14:31:05', price: 98.35, amount: 18.4, total: 1809.64, type: 'sell' },
    { time: '14:30:52', price: 98.43, amount: 7.6, total: 748.07, type: 'buy' },
    { time: '14:30:39', price: 98.4, amount: 33.2, total: 3266.88, type: 'buy' },
    { time: '14:30:26', price: 98.37, amount: 11.7, total: 1150.93, type: 'sell' },
    { time: '14:30:13', price: 98.41, amount: 14.9, total: 1466.31, type: 'buy' },
    { time: '14:30:00', price: 98.38, amount: 19.3, total: 1898.73, type: 'sell' },
  ]

  const totalVolume = trades.reduce((sum, trade) => sum + trade.total, 0)
  const buyTrades = trades.filter((trade) => trade.type === 'buy')
  const sellTrades = trades.filter((trade) => trade.type === 'sell')
  const buyVolume = buyTrades.reduce((sum, trade) => sum + trade.total, 0)
  const sellVolume = sellTrades.reduce((sum, trade) => sum + trade.total, 0)
  const buyPercentage = (buyVolume / totalVolume) * 100

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Clock className="w-5 h-5" />
            Recent Trades
          </div>
          <Badge variant="outline" className="text-xs">
            Last 15 min
          </Badge>
        </CardTitle>
      </CardHeader>
      <CardContent className="p-0">
        {/* Trade Summary */}
        <div className="px-4 py-3 border-b bg-gray-50/50 dark:bg-gray-800/50">
          <div className="grid grid-cols-2 gap-4 text-xs">
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-gray-500">Buy Volume:</span>
                <div className="flex items-center gap-1">
                  <TrendingUp className="w-3 h-3 text-green-500" />
                  <span className="text-green-600 font-semibold">${buyVolume.toLocaleString()}</span>
                </div>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-gray-500">Buy/Sell Ratio:</span>
                <span className="font-semibold">
                  {buyPercentage.toFixed(1)}% / {(100 - buyPercentage).toFixed(1)}%
                </span>
              </div>
            </div>
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-gray-500">Sell Volume:</span>
                <div className="flex items-center gap-1">
                  <TrendingDown className="w-3 h-3 text-red-500" />
                  <span className="text-red-600 font-semibold">${sellVolume.toLocaleString()}</span>
                </div>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-gray-500">Total Trades:</span>
                <span className="font-semibold">{trades.length}</span>
              </div>
            </div>
          </div>

          {/* Volume Bar */}
          <div className="mt-3">
            <div className="flex items-center justify-between text-xs mb-1">
              <span className="text-green-600">Buy Pressure</span>
              <span className="text-red-600">Sell Pressure</span>
            </div>
            <div className="h-2 bg-red-200 dark:bg-red-900/30 rounded-full overflow-hidden">
              <div className="h-full bg-green-500 transition-all duration-300" style={{ width: `${buyPercentage}%` }} />
            </div>
          </div>
        </div>

        {/* Column Headers */}
        <div className="px-4 py-2 border-b">
          <div className="grid grid-cols-4 gap-4 text-xs font-medium text-gray-500 dark:text-gray-400">
            <div>Time</div>
            <div className="text-right">Price</div>
            <div className="text-right">Amount</div>
            <div className="text-right">Total</div>
          </div>
        </div>

        {/* Trade List */}
        <div className="max-h-[300px] overflow-y-auto">
          {trades.map((trade, index) => (
            <div
              key={index}
              className={`px-4 py-2 hover:bg-opacity-50 cursor-pointer ${
                trade.type === 'buy'
                  ? 'hover:bg-green-50 dark:hover:bg-green-900/10'
                  : 'hover:bg-red-50 dark:hover:bg-red-900/10'
              }`}
            >
              <div className="grid grid-cols-4 gap-4 text-xs">
                <div className="text-gray-600 dark:text-gray-400 font-mono">{trade.time}</div>
                <div
                  className={`text-right font-mono ${
                    trade.type === 'buy' ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'
                  }`}
                >
                  {trade.price.toFixed(2)}
                </div>
                <div className="text-right font-mono">{trade.amount.toFixed(1)}</div>
                <div className="text-right font-mono text-gray-600 dark:text-gray-400">
                  {trade.total.toLocaleString()}
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* Market Sentiment */}
        <div className="px-4 py-3 border-t bg-gray-50/50 dark:bg-gray-800/50">
          <div className="flex items-center justify-between">
            <div className="text-xs text-gray-500">Market Sentiment:</div>
            <div className="flex items-center gap-2">
              {buyPercentage > 60 ? (
                <>
                  <Badge variant="success" className="text-xs">
                    🟢 Bullish
                  </Badge>
                  <span className="text-xs text-green-600">Strong buying pressure</span>
                </>
              ) : buyPercentage > 40 ? (
                <>
                  <Badge variant="outline" className="text-xs">
                    🟡 Neutral
                  </Badge>
                  <span className="text-xs text-gray-600">Balanced trading</span>
                </>
              ) : (
                <>
                  <Badge variant="destructive" className="text-xs">
                    🔴 Bearish
                  </Badge>
                  <span className="text-xs text-red-600">Strong selling pressure</span>
                </>
              )}
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}
