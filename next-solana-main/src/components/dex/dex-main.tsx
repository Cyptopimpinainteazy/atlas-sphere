'use client'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Skeleton } from '@/components/ui/skeleton'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Activity, BarChart3, Coins, DollarSign, TrendingUp, Zap, AlertCircle, RefreshCw } from 'lucide-react'
import { useState, useEffect } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Analytics } from './analytics'
import { LiquidityPools } from './liquidity-pools'
import { Portfolio } from './portfolio'
import { TradingInterface } from './trading-interface'
import { solanaMCPClient, type SolanaPair } from '@/lib/solana-mcp-client'

const formatCurrency = (value: number): string => {
  if (value >= 1e9) return `$${(value / 1e9).toFixed(1)}B`
  if (value >= 1e6) return `$${(value / 1e6).toFixed(1)}M`
  if (value >= 1e3) return `$${(value / 1e3).toFixed(1)}K`
  return `$${value.toFixed(2)}`
}

const formatNumber = (value: number): string => {
  if (value >= 1e9) return `${(value / 1e9).toFixed(1)}B`
  if (value >= 1e6) return `${(value / 1e6).toFixed(1)}M`
  if (value >= 1e3) return `${(value / 1e3).toFixed(1)}K`
  return value.toFixed(0)
}

export function DexMain() {
  const [activeTab, setActiveTab] = useState('trade')

  // Use React Query for data fetching with proper loading and error states
  const { data: pairs = [], isLoading, error, refetch } = useQuery({
    queryKey: ['trading-pairs', 'raydium'],
    queryFn: () => solanaMCPClient.getTradingPairs('raydium', 20),
    refetchInterval: 300000, // 5 minutes
    refetchOnWindowFocus: true,
    staleTime: 60000 // 1 minute
  })

  // Calculate stats from pairs data
  const stats = pairs.length > 0 ? [
    {
      title: 'Total Volume (24h)',
      value: formatCurrency(pairs.reduce((sum, pair) => sum + pair.volume_24h, 0)),
      change: '+12.3%',
      icon: DollarSign,
      positive: true,
    },
    {
      title: 'Total Value Locked',
      value: formatCurrency(pairs.reduce((sum, pair) => sum + (pair.liquidity_usd || 0), 0)),
      change: '+5.7%',
      icon: Coins,
      positive: true,
    },
    {
      title: 'Active Pools',
      value: formatNumber(pairs.length),
      change: `+${Math.floor(Math.random() * 50)}`,
      icon: Activity,
      positive: true,
    },
    {
      title: 'Fees Earned (24h)',
      value: formatCurrency(pairs.reduce((sum, pair) => sum + pair.volume_24h, 0) * 0.0025),
      change: '+8.9%',
      icon: TrendingUp,
      positive: true,
    },
  ] : [
    {
      title: 'Total Volume (24h)',
      value: '$2.4B',
      change: '+12.3%',
      icon: DollarSign,
      positive: true,
    },
    {
      title: 'Total Value Locked',
      value: '$890M',
      change: '+5.7%',
      icon: Coins,
      positive: true,
    },
    {
      title: 'Active Pools',
      value: '1,247',
      change: '+23',
      icon: Activity,
      positive: true,
    },
    {
      title: 'Fees Earned (24h)',
      value: '$125K',
      change: '+8.9%',
      icon: TrendingUp,
      positive: true,
    },
  ]

  // Convert pairs to display format
  const topPairs = pairs.slice(0, 8).map(pair => ({
    pair: `${pair.base_symbol}/${pair.quote_symbol}`,
    volume: formatCurrency(pair.volume_24h),
    change: `${pair.price_change_24h >= 0 ? '+' : ''}${pair.price_change_24h.toFixed(1)}%`,
    tvl: formatCurrency(pair.liquidity_usd || 0),
    apy: `${(Math.random() * 20 + 5).toFixed(1)}%`, // Mock APY data
    price: pair.price,
    poolAddress: pair.pool_address
  }))

  return (
    <div className="h-full bg-gradient-to-br from-slate-900 via-blue-900/80 to-indigo-900 dark:from-gray-900 dark:via-gray-800 dark:to-gray-900 relative">
      {/* Enhanced background with mobile considerations */}
      <div className="absolute inset-0 overflow-hidden">
        <div className="absolute -top-20 -right-20 md:-top-40 md:-right-40 w-40 h-40 md:w-80 md:h-80 bg-blue-500/20 rounded-full blur-3xl animate-pulse" />
        <div className="absolute -bottom-20 -left-20 md:-bottom-40 md:-left-40 w-40 h-40 md:w-80 md:h-80 bg-purple-500/20 rounded-full blur-3xl animate-pulse delay-1000" />
        <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 w-48 h-48 md:w-96 md:h-96 bg-cyan-400/10 rounded-full blur-3xl animate-ping" />
      </div>

      {/* Particle Background Overlay - Responsive */}
      <div className="absolute inset-0 opacity-30">
        <div className="hidden md:block absolute top-20 left-20 w-1 h-1 bg-blue-400 rounded-full animate-bounce" />
        <div className="hidden lg:block absolute top-40 right-32 w-1 h-1 bg-purple-400 rounded-full animate-bounce delay-150" />
        <div className="hidden xl:block absolute bottom-32 left-40 w-1 h-1 bg-cyan-400 rounded-full animate-bounce delay-300" />
        <div className="hidden md:block absolute top-60 right-20 w-1 h-1 bg-pink-400 rounded-full animate-bounce delay-500" />
        <div className="hidden lg:block absolute bottom-20 right-40 w-1 h-1 bg-indigo-400 rounded-full animate-bounce delay-700" />
      </div>

      {/* Header with Theme Toggle - Moved to the new layout */}
      {/* This content is now handled by the SocialTradingLayout component */}

      <div className="h-full pt-4 overflow-y-auto">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          {/* Enhanced Stats Dashboard */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
            {isLoading ? (
              // Loading state with skeleton cards
              Array.from({ length: 4 }).map((_, index) => (
                <Card key={index} className="glass-dark animate-fade-in-up" style={{ animationDelay: `${index * 0.1}s` }}>
                  <CardContent className="p-6">
                    <div className="flex items-center justify-between">
                      <div className="space-y-2">
                        <Skeleton className="h-4 w-32 bg-white/10" />
                        <Skeleton className="h-8 w-20 bg-white/10" />
                        <Skeleton className="h-6 w-16 bg-white/10" />
                      </div>
                      <Skeleton className="h-12 w-12 rounded-xl bg-white/10" />
                    </div>
                  </CardContent>
                </Card>
              ))
            ) : error ? (
              // Error state with retry button
              <div className="col-span-full">
                <Alert className="glass-dark border-red-500/30 bg-red-500/10">
                  <AlertCircle className="h-4 w-4 text-red-400" />
                  <AlertDescription className="text-red-300">
                    Failed to load trading data. This might be due to network issues or API limitations.
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => refetch()}
                      className="ml-2 border-red-500/30 text-red-300 hover:bg-red-500/20"
                    >
                      <RefreshCw className="w-4 h-4 mr-2" />
                      Retry
                    </Button>
                  </AlertDescription>
                </Alert>
              </div>
            ) : (
              stats.map((stat, index) => (
                <Card
                  key={index}
                  className="glass-dark hover:glow-blue transform hover:scale-105 hover:-translate-y-1 transition-all duration-300 cursor-pointer animate-fade-in-up"
                  style={{ animationDelay: `${index * 0.1}s` }}
                >
                  <CardContent className="p-6">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-sm font-medium text-gray-300 mb-1">{stat.title}</p>
                        <p className="text-3xl font-bold text-white mb-2">{stat.value}</p>
                        <div className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium ${
                          stat.positive
                            ? 'bg-green-500/20 text-green-400 border border-green-500/30'
                            : 'bg-red-500/20 text-red-400 border border-red-500/30'
                        }`}>
                          <span className={stat.positive ? 'text-green-400' : 'text-red-400'}>
                            {stat.change}
                          </span>
                        </div>
                      </div>
                      <div className="p-3 bg-gradient-to-br from-blue-500/20 to-purple-500/20 rounded-xl border border-blue-400/30">
                        <stat.icon className="w-7 h-7 text-blue-300" />
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))
            )}
          </div>

          {/* Enhanced Main Interface */}
          <Card className="glass-dark glow-cyan animate-fade-in-up delay-1000 mb-8">
            <CardHeader>
              <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
                <TabsList className="glass grid w-full grid-cols-4 p-1 gap-1">
                  <TabsTrigger
                    value="trade"
                    className="font-medium transition-all duration-300 hover:bg-gradient-to-r hover:from-blue-500/20 hover:to-cyan-500/20 data-[state=active]:bg-gradient-to-r data-[state=active]:from-blue-500/30 data-[state=active]:to-cyan-500/30 data-[state=active]:text-white"
                  >
                    🎯 Trade
                  </TabsTrigger>
                  <TabsTrigger
                    value="pools"
                    className="font-medium transition-all duration-300 hover:bg-gradient-to-r hover:from-purple-500/20 hover:to-pink-500/20 data-[state=active]:bg-gradient-to-r data-[state=active]:from-purple-500/30 data-[state=active]:to-pink-500/30 data-[state=active]:text-white"
                  >
                    💧 Liquidity
                  </TabsTrigger>
                  <TabsTrigger
                    value="portfolio"
                    className="font-medium transition-all duration-300 hover:bg-gradient-to-r hover:from-green-500/20 hover:to-emerald-500/20 data-[state=active]:bg-gradient-to-r data-[state=active]:from-green-500/30 data-[state=active]:to-emerald-500/30 data-[state=active]:text-white"
                  >
                    📊 Portfolio
                  </TabsTrigger>
                  <TabsTrigger
                    value="analytics"
                    className="font-medium transition-all duration-300 hover:bg-gradient-to-r hover:from-orange-500/20 hover:to-red-500/20 data-[state=active]:bg-gradient-to-r data-[state=active]:from-orange-500/30 data-[state=active]:to-red-500/30 data-[state=active]:text-white"
                  >
                    📈 Analytics
                  </TabsTrigger>
                </TabsList>
              </Tabs>
            </CardHeader>
            <CardContent>
              <Tabs value={activeTab} className="w-full">
                <TabsContent value="trade">
                  <TradingInterface />
                </TabsContent>
                <TabsContent value="pools">
                  <LiquidityPools />
                </TabsContent>
                <TabsContent value="portfolio">
                  <Portfolio />
                </TabsContent>
                <TabsContent value="analytics">
                  <Analytics />
                </TabsContent>
              </Tabs>
            </CardContent>
          </Card>

          {/* Enhanced Top Trading Pairs */}
          <Card className="glass-dark glow-purple animate-fade-in-up delay-1200 mb-12">
            <CardHeader>
              <CardTitle className="flex items-center gap-3 text-white">
                <div className="p-2 bg-gradient-to-r from-purple-500/20 to-pink-500/20 rounded-lg border border-purple-400/30">
                  <TrendingUp className="w-6 h-6 text-purple-300" />
                </div>
                Top Trading Pairs
                <Badge className="ml-auto bg-gradient-to-r from-orange-500 to-red-500 hover:from-orange-600 hover:to-red-600">
                  🔥 HOT
                </Badge>
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-white/20">
                      <th scope="col" className="text-left py-4 px-4 font-semibold text-gray-300">Trading Pair</th>
                      <th scope="col" className="text-right py-4 px-4 font-semibold text-gray-300">Volume (24h)</th>
                      <th scope="col" className="text-right py-4 px-4 font-semibold text-gray-300">24h Change</th>
                      <th scope="col" className="text-right py-4 px-4 font-semibold text-gray-300">TVL</th>
                      <th scope="col" className="text-right py-4 px-4 font-semibold text-gray-300">APY</th>
                      <th scope="col" className="text-left py-4 px-4 font-semibold text-gray-300">Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {topPairs.length === 0 ? (
                      <tr>
                        <td colSpan={6} className="py-8 px-4 text-center text-gray-400">
                          <div className="flex flex-col items-center gap-2">
                            <div className="w-12 h-12 bg-gray-500/20 rounded-full flex items-center justify-center">
                              <TrendingUp className="w-6 h-6 text-gray-400" />
                            </div>
                            <p>No trading pairs available</p>
                            <p className="text-sm">Trading pairs will appear here once loaded</p>
                          </div>
                        </td>
                      </tr>
                    ) : (
                      topPairs.map((pair, index) => {
                        const isPositive = pair.change.includes('+')
                        return (
                          <tr
                            key={index}
                            className="border-b border-white/10 hover:bg-white/5 transition-all duration-200 transform hover:scale-[1.02] cursor-pointer"
                          >
                            <td className="py-4 px-4">
                              <div className="flex items-center gap-3">
                                <div className={`w-2 h-2 rounded-full ${isPositive ? 'bg-green-400' : 'bg-red-400'} animate-pulse`} />
                                <div className="font-bold text-white">{pair.pair}</div>
                              </div>
                            </td>
                            <td className="py-4 px-4 text-gray-300 font-mono text-right">
                              <span className="font-mono">{pair.volume}</span>
                            </td>
                            <td className="py-4 px-4 text-right">
                              <div className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-semibold ${
                                isPositive
                                  ? 'bg-green-500/20 text-green-400 border border-green-500/30'
                                  : 'bg-red-500/20 text-red-400 border border-red-500/30'
                              }`}>
                                {isPositive ? '📈' : '📉'}
                                {pair.change}
                              </div>
                            </td>
                            <td className="py-4 px-4 text-gray-300 font-mono text-right">
                              <span className="font-mono">{pair.tvl}</span>
                            </td>
                            <td className="py-4 px-4 text-right">
                              <Badge className="bg-gradient-to-r from-yellow-500 to-orange-500 hover:from-yellow-600 hover:to-orange-600 text-white font-semibold">
                                🔥 <span className="font-mono">{pair.apy}</span>
                              </Badge>
                            </td>
                            <td className="py-4 px-4">
                              <Button
                                size="sm"
                                className="bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-500 hover:to-purple-500 text-white font-semibold shadow-lg hover:shadow-blue-500/25 transform hover:scale-105 transition-all duration-200"
                                onClick={() => setActiveTab('trade')}
                              >
                                🚀 Trade
                              </Button>
                            </td>
                          </tr>
                        )
                      })
                    )}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Social Features Section - Now integrated into sidebars */}
      {/* The User Profile, Notifications, and Social Feed are now in the left sidebar */}
      {/* The Automated Trading Bots are in the right sidebar */}
    </div>
  )
}
