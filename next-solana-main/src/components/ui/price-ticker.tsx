'use client'

import { Badge } from '@/components/ui/badge'
import { useState, useEffect } from 'react'
import { TrendingUp, TrendingDown } from 'lucide-react'

const useReducedMotion = () => {
  const [prefersReducedMotion, setPrefersReducedMotion] = useState(false)

  useEffect(() => {
    const mediaQuery = window.matchMedia('(prefers-reduced-motion: reduce)')
    setPrefersReducedMotion(mediaQuery.matches)

    const handleChange = (event: MediaQueryListEvent) => {
      setPrefersReducedMotion(event.matches)
    }

    mediaQuery.addEventListener('change', handleChange)
    return () => mediaQuery.removeEventListener('change', handleChange)
  }, [])

  return prefersReducedMotion
}

interface PriceData {
  pair: string
  price: number
  change: number
  volume: number
}

interface PriceTickerProps {
  prices?: PriceData[]
  speed?: number
}

const defaultPrices: PriceData[] = [
  { pair: 'SOL/USDC', price: 142.85, change: 5.2, volume: 145670000 },
  { pair: 'USDC/SOL', price: 0.00701, change: -2.1, volume: 123450000 },
  { pair: 'BTC/USDC', price: 68950.50, change: 3.8, volume: 98750000 },
  { pair: 'ETH/USDC', price: 2847.32, change: 1.2, volume: 87650000 },
  { pair: 'RAY/SOL', price: 0.789, change: 8.7, volume: 67500000 },
  { pair: 'ORCA/USDC', price: 2.34, change: -1.5, volume: 45600000 },
  { pair: 'BONK/USDC', price: 0.0000284, change: 12.3, volume: 34500000 },
  { pair: 'SAMO/USD', price: 0.0108, change: -4.2, volume: 23400000 },
  { pair: 'SRM/USDC', price: 0.1234, change: 6.8, volume: 15600000 },
  { pair: 'PYTH/USDC', price: 0.59, change: 2.1, volume: 12300000 },
  { pair: 'JUP/USDC', price: 1.15, change: -0.8, volume: 8900000 },
  { pair: 'HONEY/USD', price: 12.34, change: 9.5, volume: 7800000 }
]

export function PriceTicker({ prices = defaultPrices, speed = 50 }: PriceTickerProps) {
  const [currentPrices, setCurrentPrices] = useState(prices)
  const [isVisible, setIsVisible] = useState(true)
  const prefersReducedMotion = useReducedMotion()

  // Visibility detection for performance optimization
  useEffect(() => {
    const handleVisibilityChange = () => {
      setIsVisible(document.visibilityState === 'visible')
    }

    document.addEventListener('visibilitychange', handleVisibilityChange)
    return () => document.removeEventListener('visibilitychange', handleVisibilityChange)
  }, [])

  // Simulate price updates with visibility awareness
  useEffect(() => {
    if (prefersReducedMotion) return

    const interval = setInterval(() => {
      if (isVisible) {
        setCurrentPrices(prev => prev.map(price => ({
          ...price,
          price: price.price + (Math.random() - 0.5) * price.price * 0.001, // +/- 0.1% change
          change: price.change + (Math.random() - 0.5) * 2 // +/- 2% change
        })))
      }
    }, 3000) // Update every 3 seconds

    return () => clearInterval(interval)
  }, [isVisible, prefersReducedMotion])

  const formatPrice = (price: number, pair: string) => {
    if (pair.includes('USDC') && pair.startsWith('SOL')) return `$${price.toFixed(2)}`
    if (pair.includes('USDC') && price >= 1) return `$${price.toFixed(2)}`
    if (pair.includes('USDC')) return `$${price.toFixed(6)}`
    if (price >= 1) return `$${price.toFixed(4)}`
    return `$${price.toFixed(6)}`
  }

  const formatChange = (change: number) => {
    const sign = change >= 0 ? '+' : ''
    return `${sign}${change.toFixed(1)}%`
  }

  return (
    <div className="bg-black/50 backdrop-blur-sm border-b border-white/10 py-2 overflow-hidden">
      {/* Screen reader accessible price summary */}
      <div className="sr-only" aria-live="polite" aria-atomic="true">
        Market prices updating: {currentPrices[0]?.pair} at {formatPrice(currentPrices[0]?.price, currentPrices[0]?.pair)}
      </div>

      <div
        className="animate-scroll flex items-center gap-8 whitespace-nowrap"
        style={{
          animation: prefersReducedMotion ? 'none' : `scroll ${Math.max(speed, 30)}s linear infinite`,
          width: 'calc(200vw)'
        }}
        aria-hidden="true"
      >
        {/* Duplicate content for seamless scrolling */}
        {[...currentPrices, ...currentPrices, ...currentPrices].map((price, index) => {
          const isPositive = price.change >= 0
          return (
            <div key={`${price.pair}-${index}`} className="flex items-center gap-2 text-sm px-3">
              <span className="text-white font-medium">{price.pair}</span>
              <span className="text-gray-300">{formatPrice(price.price, price.pair)}</span>
              <Badge
                className={`flex items-center gap-1 ${
                  isPositive
                    ? 'bg-green-500/20 text-green-400 border-green-500/30'
                    : 'bg-red-500/20 text-red-400 border-red-500/30'
                }`}
              >
                {isPositive ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
                {formatChange(price.change)}
              </Badge>
              <span className="text-gray-500 text-xs">
                ${price.volume.toLocaleString()} vol
              </span>
            </div>
          )
        })}
      </div>
    </div>
  )
}
