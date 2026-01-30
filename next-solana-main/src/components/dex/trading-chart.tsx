'use client'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { BarChart3, Maximize2, TrendingDown, TrendingUp, Zap, Eye } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { useTradingBotContext } from '@/components/social/right-bot-sidebar'

export function TradingChart() {
  const chartRef = useRef<HTMLDivElement>(null)
  const [timeframe, setTimeframe] = useState('1H')
  const [currentPrice] = useState(98.42)
  const [priceChange] = useState(5.12)
  const [isPositive] = useState(priceChange >= 0)

  // Bot integration
  const { activeSignals, isMasterBotEnabled, strategies } = useTradingBotContext()

  // Mock price data for demonstration
  const generateMockData = () => {
    const data = []
    const basePrice = 95
    let currentValue = basePrice

    for (let i = 0; i < 100; i++) {
      const change = (Math.random() - 0.5) * 4
      currentValue = Math.max(currentValue + change, basePrice * 0.8)
      data.push({
        time: Date.now() - (100 - i) * 60000,
        price: currentValue,
        volume: Math.random() * 1000000,
      })
    }
    return data
  }

  const [chartData] = useState(generateMockData())

  useEffect(() => {
    // In a real app, this would initialize TradingView or similar charting library
    // For demo purposes, we'll create a simple canvas chart
    if (chartRef.current) {
      const canvas = document.createElement('canvas')
      canvas.width = chartRef.current.offsetWidth
      canvas.height = 400
      canvas.style.width = '100%'
      canvas.style.height = '400px'

      chartRef.current.innerHTML = ''
      chartRef.current.appendChild(canvas)

      const ctx = canvas.getContext('2d')
      if (ctx) {
        drawChart(ctx, canvas.width, canvas.height)
      }
    }
  }, [timeframe, chartData])

  const drawChart = (ctx: CanvasRenderingContext2D, width: number, height: number) => {
    const padding = 40
    const chartWidth = width - padding * 2
    const chartHeight = height - padding * 2

    // Clear canvas
    ctx.clearRect(0, 0, width, height)

    // Find min/max prices
    const prices = chartData.map((d) => d.price)
    const minPrice = Math.min(...prices)
    const maxPrice = Math.max(...prices)
    const priceRange = maxPrice - minPrice

    // Set styles
    ctx.strokeStyle = isPositive ? '#10b981' : '#ef4444'
    ctx.lineWidth = 2
    ctx.lineCap = 'round'
    ctx.lineJoin = 'round'

    // Draw price line
    ctx.beginPath()
    chartData.forEach((point, index) => {
      const x = padding + (index / (chartData.length - 1)) * chartWidth
      const y = padding + ((maxPrice - point.price) / priceRange) * chartHeight

      if (index === 0) {
        ctx.moveTo(x, y)
      } else {
        ctx.lineTo(x, y)
      }
    })
    ctx.stroke()

    // Draw gradient fill
    const gradient = ctx.createLinearGradient(0, padding, 0, height - padding)
    gradient.addColorStop(0, isPositive ? 'rgba(16, 185, 129, 0.2)' : 'rgba(239, 68, 68, 0.2)')
    gradient.addColorStop(1, 'rgba(16, 185, 129, 0)')

    ctx.fillStyle = gradient
    ctx.beginPath()
    ctx.moveTo(padding, height - padding)
    chartData.forEach((point, index) => {
      const x = padding + (index / (chartData.length - 1)) * chartWidth
      const y = padding + ((maxPrice - point.price) / priceRange) * chartHeight
      ctx.lineTo(x, y)
    })
    ctx.lineTo(width - padding, height - padding)
    ctx.closePath()
    ctx.fill()

    // Draw grid lines
    ctx.strokeStyle = 'rgba(156, 163, 175, 0.2)'
    ctx.lineWidth = 1

    // Horizontal grid lines
    for (let i = 0; i <= 5; i++) {
      const y = padding + (i / 5) * chartHeight
      ctx.beginPath()
      ctx.moveTo(padding, y)
      ctx.lineTo(width - padding, y)
      ctx.stroke()
    }

    // Vertical grid lines
    for (let i = 0; i <= 10; i++) {
      const x = padding + (i / 10) * chartWidth
      ctx.beginPath()
      ctx.moveTo(x, padding)
      ctx.lineTo(x, height - padding)
      ctx.stroke()
    }

    // Draw price labels
    ctx.fillStyle = '#6b7280'
    ctx.font = '12px Inter, sans-serif'
    ctx.textAlign = 'right'

    for (let i = 0; i <= 5; i++) {
      const price = maxPrice - (i / 5) * priceRange
      const y = padding + (i / 5) * chartHeight
      ctx.fillText(`$${price.toFixed(2)}`, padding - 10, y + 4)
    }
  }

  const timeframes = ['5M', '15M', '1H', '4H', '1D', '1W']

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-4">
            <CardTitle className="flex items-center gap-2">
              <BarChart3 className="w-5 h-5" />
              SOL/USDC
            </CardTitle>
            <div className="flex items-center space-x-2">
              <span className="text-2xl font-bold">${currentPrice}</span>
              <Badge variant={isPositive ? 'success' : 'destructive'} className="flex items-center gap-1">
                {isPositive ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
                {isPositive ? '+' : ''}
                {priceChange.toFixed(2)}%
              </Badge>
            </div>
          </div>
          <div className="flex items-center space-x-2">
            <div className="flex space-x-1">
              {timeframes.map((tf) => (
                <Button
                  key={tf}
                  variant={timeframe === tf ? 'default' : 'ghost'}
                  size="sm"
                  className="text-xs px-2 py-1"
                  onClick={() => setTimeframe(tf)}
                >
                  {tf}
                </Button>
              ))}
            </div>
            <Button variant="ghost" size="sm">
              <Maximize2 className="w-4 h-4" />
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          {/* Price Stats */}
          <div className="grid grid-cols-4 gap-4 text-sm">
            <div>
              <div className="text-gray-500 dark:text-gray-400">24h High</div>
              <div className="font-semibold">$102.34</div>
            </div>
            <div>
              <div className="text-gray-500 dark:text-gray-400">24h Low</div>
              <div className="font-semibold">$94.12</div>
            </div>
            <div>
              <div className="text-gray-500 dark:text-gray-400">24h Volume</div>
              <div className="font-semibold">$142M</div>
            </div>
            <div>
              <div className="text-gray-500 dark:text-gray-400">Market Cap</div>
              <div className="font-semibold">$45.2B</div>
            </div>
          </div>

          {/* Chart */}
          <div ref={chartRef} className="w-full h-[400px] border rounded-lg bg-gray-50 dark:bg-gray-900" />

          {/* Trading Indicators & Bot Signals */}
          <div className="space-y-3">
            <div className="flex items-center justify-between text-sm">
              <div className="flex space-x-4">
                <span className="text-gray-500">
                  RSI: <span className="text-orange-500 font-semibold">68.4</span>
                </span>
                <span className="text-gray-500">
                  MACD: <span className="text-green-500 font-semibold">+0.34</span>
                </span>
                <span className="text-gray-500">
                  BB: <span className="text-blue-500 font-semibold">Upper</span>
                </span>
                <span className="text-gray-500 flex items-center gap-1">
                  <Zap className="w-3 h-3 text-purple-400" />
                  Bots: <span className={`font-semibold ${isMasterBotEnabled ? 'text-green-400' : 'text-gray-500'}`}>
                    {isMasterBotEnabled ? `${strategies.filter(s => s.enabled).length} Active` : 'Inactive'}
                  </span>
                </span>
              </div>
              <div className="flex space-x-2">
                <Badge variant="outline" className="text-xs">
                  🟢 Bullish Signal
                </Badge>
                <Badge variant="outline" className="text-xs">
                  ⚡ High Volume
                </Badge>
              </div>
            </div>

            {/* Bot Signals */}
            {isMasterBotEnabled && activeSignals.length > 0 && (
              <div className="p-3 bg-gradient-to-r from-purple-900/30 to-blue-900/30 border border-purple-400/30 rounded-lg">
                <div className="flex items-center gap-2 mb-2">
                  <Eye className="w-4 h-4 text-purple-400" />
                  <span className="text-sm font-semibold text-white">Bot Signals ({activeSignals.length})</span>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                  {activeSignals.slice(0, 4).map((signal) => (
                    <div key={signal.id} className={`p-2 rounded text-xs flex items-center gap-2 ${
                      signal.type === 'BUY' ? 'bg-green-500/20 border border-green-500/30' : 'bg-red-500/20 border border-red-500/30'
                    }`}>
                      <span className="text-lg">{signal.icon}</span>
                      <div className="flex-1">
                        <div className="font-medium text-white">{signal.strategyName}</div>
                        <div className="text-gray-300">{signal.type} @ ${signal.price.toFixed(2)} ({signal.confidence}%)</div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  )
}
