'use client'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { ArrowUpDown, BarChart3, Calendar, Settings, Target, Zap, Bot, TrendingUp, AlertCircle } from 'lucide-react'
import { useState } from 'react'
import { OrderBook } from './order-book'
import { RecentTrades } from './recent-trades'
import { TradingChart } from './trading-chart'
import { useTradingBotContext } from '@/components/social/right-bot-sidebar'

export function TradingInterface() {
  const [orderType, setOrderType] = useState<'market' | 'limit' | 'dca'>('market')
  const [tradeDirection, setTradeDirection] = useState<'buy' | 'sell'>('buy')
  const [fromAmount, setFromAmount] = useState('')
  const [toAmount, setToAmount] = useState('')
  const [limitPrice, setLimitPrice] = useState('')
  const [slippage, setSlippage] = useState('0.5')

  // Bot integration
  const { activeSignals, executeBotTrade } = useTradingBotContext()

  const mockTokens = [
    { symbol: 'SOL', name: 'Solana', price: 98.42, change: '+5.2%', icon: '◎' },
    { symbol: 'USDC', name: 'USD Coin', price: 1.0, change: '+0.0%', icon: '$' },
    { symbol: 'ETH', name: 'Ethereum', price: 2847.32, change: '+3.1%', icon: 'Ξ' },
    { symbol: 'BTC', name: 'Bitcoin', price: 43250.89, change: '+2.8%', icon: '₿' },
  ]

  const [fromToken, setFromToken] = useState(mockTokens[0])
  const [toToken, setToToken] = useState(mockTokens[1])

  const handleSwapTokens = () => {
    setFromToken(toToken)
    setToToken(fromToken)
    setFromAmount(toAmount)
    setToAmount(fromAmount)
  }

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
      {/* Enhanced Trading Form */}
      <div className="lg:col-span-1">
        <Card className="relative glass-dark glow-blue group h-fit">
          <div className="absolute inset-0 bg-gradient-to-br from-blue-500/5 via-transparent to-purple-500/5 opacity-0 group-hover:opacity-100 transition-opacity duration-500" />

          <CardHeader className="border-b border-white/10">
            <div className="flex items-center justify-between text-white">
              <CardTitle className="flex items-center gap-3">
                <div className="p-2 bg-gradient-to-r from-blue-500/20 to-purple-500/20 rounded-lg border border-blue-400/30">
                  <ArrowUpDown className="w-5 h-5 text-blue-300" />
                </div>
                <div className="text-lg font-bold">Swap Tokens</div>
              </CardTitle>
              <Button className="hover:bg-white/10 p-2 rounded-lg transition-colors" variant="ghost" size="sm">
                <Settings className="w-5 h-5 text-gray-400 hover:text-white transition-colors" />
              </Button>
            </div>

            <Tabs
              value={orderType}
              onValueChange={(value: string) => setOrderType(value as 'market' | 'limit' | 'dca')}
            >
              <TabsList className="glass grid w-full grid-cols-3 p-1 gap-1 bg-gray-800/50">
                <TabsTrigger
                  value="market"
                  className="text-xs font-medium transition-all duration-200 hover:bg-gradient-to-r hover:from-yellow-500/20 hover:to-orange-500/20 data-[state=active]:bg-gradient-to-r data-[state=active]:from-yellow-500/30 data-[state=active]:to-orange-500/30 data-[state=active]:text-white"
                >
                  <Zap className="w-3 h-3 mr-1" />
                  Market
                </TabsTrigger>
                <TabsTrigger
                  value="limit"
                  className="text-xs font-medium transition-all duration-200 hover:bg-gradient-to-r hover:from-blue-500/20 hover:to-cyan-500/20 data-[state=active]:bg-gradient-to-r data-[state=active]:from-blue-500/30 data-[state=active]:to-cyan-500/30 data-[state=active]:text-white"
                >
                  <Target className="w-3 h-3 mr-1" />
                  Limit
                </TabsTrigger>
                <TabsTrigger
                  value="dca"
                  className="text-xs font-medium transition-all duration-200 hover:bg-gradient-to-r hover:from-purple-500/20 hover:to-pink-500/20 data-[state=active]:bg-gradient-to-r data-[state=active]:from-purple-500/30 data-[state=active]:to-pink-500/30 data-[state=active]:text-white"
                >
                  <BarChart3 className="w-3 h-3 mr-1" />
                  DCA
                </TabsTrigger>
              </TabsList>
            </Tabs>
          </CardHeader>
          <CardContent className="space-y-6">
            {/* From Token */}
            <div className="space-y-2">
              <Label className="text-sm font-semibold text-gray-200">From Token</Label>
              <div className="relative group">
                <div className="flex items-center space-x-3 p-4 border border-white/10 rounded-xl bg-gradient-to-r from-white/5 to-white/10 hover:border-blue-400/50 transition-all duration-300 cursor-pointer">
                  <div className="flex items-center space-x-3 min-w-0 flex-1">
                    <div className="p-2 bg-gradient-to-r from-blue-500/20 to-purple-500/20 rounded-lg border border-blue-400/30">
                      <span className="text-2xl">{fromToken.icon}</span>
                    </div>
                    <div className="min-w-0">
                      <div className="font-bold text-white text-lg">{fromToken.symbol}</div>
                      <div className="text-xs text-gray-400">{fromToken.name}</div>
                    </div>
                  </div>
                  <div className="text-right flex-1">
                    <Input
                      type="number"
                      placeholder="0.00"
                      value={fromAmount}
                      onChange={(e) => setFromAmount(e.target.value)}
                      className="text-right border-0 bg-transparent p-0 text-xl font-bold text-white placeholder-gray-500 focus:ring-0 focus:outline-none"
                    />
                    <div className="text-xs text-gray-400 mt-1">
                      ≈ ${parseFloat(fromAmount || '0') * fromToken.price > 0 ? (parseFloat(fromAmount || '0') * fromToken.price).toFixed(2) : '0.00'}
                    </div>
                  </div>
                </div>
                <div className="flex items-center justify-between mt-3 px-1">
                  <div className="text-xs text-gray-400">Available Balance</div>
                  <div className="text-xs text-green-300 font-semibold">12.45 {fromToken.symbol}</div>
                </div>
              </div>
            </div>

            {/* Enhanced Swap Button */}
            <div className="flex justify-center">
              <Button
                variant="ghost"
                size="sm"
                onClick={handleSwapTokens}
                className="group relative w-12 h-12 rounded-full bg-gradient-to-r from-blue-600/20 to-purple-600/20 border border-blue-400/30 hover:border-blue-400/50 hover:scale-110 transition-all duration-300 hover:shadow-lg hover:shadow-blue-500/25"
              >
                <ArrowUpDown className="w-5 h-5 text-blue-300 group-hover:text-white transition-colors" />
                <div className="absolute inset-0 rounded-full bg-gradient-to-r from-blue-500/0 to-purple-500/0 group-hover:from-blue-500/20 group-hover:to-purple-500/20 transition-all duration-300" />
              </Button>
            </div>

            {/* To Token */}
            <div className="space-y-2">
              <Label className="text-sm font-semibold text-gray-200">To Token</Label>
              <div className="relative group">
                <div className="flex items-center space-x-3 p-4 border border-white/10 rounded-xl bg-gradient-to-r from-white/5 to-white/10 hover:border-purple-400/50 transition-all duration-300 cursor-pointer">
                  <div className="flex items-center space-x-3 min-w-0 flex-1">
                    <div className="p-2 bg-gradient-to-r from-purple-500/20 to-pink-500/20 rounded-lg border border-purple-400/30">
                      <span className="text-2xl">{toToken.icon}</span>
                    </div>
                    <div className="min-w-0">
                      <div className="font-bold text-white text-lg">{toToken.symbol}</div>
                      <div className="text-xs text-gray-400">{toToken.name}</div>
                    </div>
                  </div>
                  <div className="text-right flex-1">
                    <Input
                      type="number"
                      placeholder="0.00"
                      value={toAmount}
                      onChange={(e) => setToAmount(e.target.value)}
                      className="text-right border-0 bg-transparent p-0 text-xl font-bold text-white placeholder-gray-500 focus:ring-0 focus:outline-none"
                    />
                    <div className="text-xs text-gray-400 mt-1">
                      ≈ ${parseFloat(toAmount || '0') * toToken.price > 0 ? (parseFloat(toAmount || '0') * toToken.price).toFixed(2) : '0.00'}
                    </div>
                  </div>
                </div>
                <div className="flex items-center justify-between mt-3 px-1">
                  <div className="text-xs text-gray-400">Available Balance</div>
                  <div className="text-xs text-green-300 font-semibold">245.67 {toToken.symbol}</div>
                </div>
              </div>
            </div>

            {/* Limit Price (only for limit orders) */}
            {orderType === 'limit' && (
              <div className="space-y-2">
                <Label className="text-sm font-medium">Limit Price</Label>
                <Input
                  type="number"
                  placeholder="0.00"
                  value={limitPrice}
                  onChange={(e) => setLimitPrice(e.target.value)}
                />
                <div className="text-xs text-gray-500">
                  Current price: {(fromToken.price / toToken.price).toFixed(6)} {toToken.symbol}/{fromToken.symbol}
                </div>
              </div>
            )}

            {/* DCA Settings */}
            {orderType === 'dca' && (
              <div className="space-y-4 p-4 bg-gradient-to-r from-purple-500/10 via-pink-500/10 to-cyan-500/10 border border-purple-400/20 rounded-xl backdrop-blur-sm">
                <div className="flex items-center gap-3 text-sm font-bold text-white">
                  <div className="p-1 bg-gradient-to-r from-purple-500/20 to-pink-500/20 rounded border border-purple-400/30">
                    <Calendar className="w-4 h-4 text-purple-300" />
                  </div>
                  Dollar Cost Averaging
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label className="text-xs font-medium text-gray-200">Frequency</Label>
                    <select className="w-full p-3 border border-white/20 rounded-lg bg-white/5 text-white text-sm backdrop-blur-sm focus:border-purple-400/50">
                      <option className="bg-gray-800">Daily</option>
                      <option className="bg-gray-800">Weekly</option>
                      <option className="bg-gray-800">Monthly</option>
                    </select>
                  </div>
                  <div className="space-y-2">
                    <Label className="text-xs font-medium text-gray-200">Duration</Label>
                    <select className="w-full p-3 border border-white/20 rounded-lg bg-white/5 text-white text-sm backdrop-blur-sm focus:border-purple-400/50">
                      <option className="bg-gray-800">1 month</option>
                      <option className="bg-gray-800">3 months</option>
                      <option className="bg-gray-800">6 months</option>
                      <option className="bg-gray-800">1 year</option>
                    </select>
                  </div>
                </div>
              </div>
            )}

            {/* Enhanced Slippage Settings */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <Label className="text-sm font-semibold text-gray-200">Slippage Tolerance</Label>
                <div className="flex space-x-2">
                  {['0.1', '0.5', '1.0'].map((value) => (
                    <button
                      key={value}
                      className={`px-3 py-1 text-xs font-medium rounded-lg transition-all duration-200 ${
                        slippage === value
                          ? 'bg-gradient-to-r from-blue-600 to-purple-600 text-white shadow-lg'
                          : 'bg-white/10 text-gray-300 hover:bg-white/20 border border-white/20'
                      }`}
                      onClick={() => setSlippage(value)}
                    >
                      {value}%
                    </button>
                  ))}
                </div>
              </div>
              <Input
                type="number"
                placeholder="Custom %"
                value={slippage}
                onChange={(e) => setSlippage(e.target.value)}
                className="w-full p-3 border border-white/20 rounded-lg bg-white/5 text-white placeholder-gray-400 focus:border-blue-400/50 backdrop-blur-sm"
              />
            </div>

            {/* Enhanced Trade Info */}
            <div className="space-y-3 p-4 bg-gradient-to-r from-white/5 to-white/10 border border-white/10 rounded-xl backdrop-blur-sm">
              <div className="text-sm font-semibold text-white mb-3">Trade Summary</div>
              <div className="space-y-3">
                <div className="flex justify-between items-center">
                  <span className="text-gray-300">Price Impact</span>
                  <div className="text-green-400 font-semibold">
                    <span className="inline-block w-2 h-2 bg-green-400 rounded-full mr-2 animate-pulse"></span>
                    0.02%
                  </div>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-gray-300">Minimum Received</span>
                  <span className="font-mono text-white text-sm">
                    {(parseFloat(toAmount || '0') * 0.995).toFixed(6)} {toToken.symbol}
                  </span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-gray-300">Network Fee</span>
                  <span className="text-yellow-400 font-semibold">0.3%</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-gray-300">Route</span>
                  <Badge className="bg-gradient-to-r from-cyan-500 to-blue-500 hover:from-cyan-600 hover:to-blue-600 text-white font-bold">
                    ⚡ Jupiter
                  </Badge>
                </div>
              </div>
            </div>

            {/* Bot Recommendations & Auto-Trading */}
            {activeSignals.length > 0 && (
              <div className="space-y-4 p-4 bg-gradient-to-r from-purple-900/30 via-blue-900/30 to-cyan-900/30 border border-purple-400/30 rounded-xl backdrop-blur-sm">
                <div className="flex items-center gap-3 text-sm font-bold text-white">
                  <div className="p-1 bg-gradient-to-r from-purple-500/20 to-pink-500/20 rounded border border-purple-400/30">
                    <Bot className="w-4 h-4 text-purple-300" />
                  </div>
                  AI Bot Recommendations ({activeSignals.length})
                </div>

                <div className="space-y-2">
                  {activeSignals.slice(0, 2).map((signal, index) => (
                    <div key={signal.id} className={`p-3 rounded-lg border backdrop-blur-sm ${
                      signal.type === 'BUY'
                        ? 'bg-green-500/10 border-green-500/30'
                        : 'bg-red-500/10 border-red-500/30'
                    }`}>
                      <div className="flex items-center justify-between mb-2">
                        <div className="flex items-center gap-2">
                          <span className="text-lg">{signal.icon}</span>
                          <div>
                            <span className="text-white font-semibold text-sm">{signal.strategyName}</span>
                            <div className="text-xs text-gray-400">{signal.confidence}% confidence</div>
                          </div>
                        </div>
                        <Badge className={`text-xs ${
                          signal.type === 'BUY'
                            ? 'bg-green-500/20 text-green-400 border border-green-500/30'
                            : 'bg-red-500/20 text-red-400 border border-red-500/30'
                        }`}>
                          {signal.type === 'BUY' ? '🔥 BUY' : '📈 SELL'} @ ${signal.price.toFixed(2)}
                        </Badge>
                      </div>

                      <Button
                        size="sm"
                        className={`w-full mt-2 ${
                          signal.type === 'BUY'
                            ? 'bg-green-600 hover:bg-green-500'
                            : 'bg-red-600 hover:bg-red-500'
                        }`}
                        onClick={() => {
                          const amount = signal.type === 'BUY' ? 0.1 : 0.05; // Mock amount
                          executeBotTrade(signal.strategyId, signal.type.toLowerCase() as 'buy' | 'sell', amount)
                        }}
                      >
                        <Bot className="w-3 h-3 mr-1" />
                        Execute Bot Trade
                      </Button>
                    </div>
                  ))}

                  {activeSignals.length > 2 && (
                    <div className="text-center text-xs text-gray-400">
                      +{activeSignals.length - 2} more recommendations...
                    </div>
                  )}
                </div>

                <div className="flex gap-2 pt-2 border-t border-white/10">
                  <Button
                    variant="outline"
                    size="sm"
                    className="flex-1 border-blue-400/30 text-blue-400 hover:bg-blue-500/10"
                    onClick={() => {
                      // Auto fill with bot recommendation
                      const bestBuySignal = activeSignals.find(s => s.type === 'BUY' && s.confidence > 75)
                      if (bestBuySignal) {
                        setFromAmount('0.1')
                      }
                    }}
                  >
                    <TrendingUp className="w-3 h-3 mr-1" />
                    Auto Buy
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    className="flex-1 border-red-400/30 text-red-400 hover:bg-red-500/10"
                    onClick={() => {
                      // Auto fill with bot recommendation
                      const bestSellSignal = activeSignals.find(s => s.type === 'SELL' && s.confidence > 75)
                      if (bestSellSignal) {
                        setFromAmount('0.05')
                      }
                    }}
                  >
                    <AlertCircle className="w-3 h-3 mr-1" />
                    Auto Sell
                  </Button>
                </div>
              </div>
            )}

            {/* Enhanced Action Button */}
            <Button
              className="w-full bg-gradient-to-r from-green-600 via-blue-600 to-purple-600 hover:from-green-500 hover:via-blue-500 hover:to-purple-500 text-white font-bold text-lg py-4 rounded-xl shadow-2xl hover:shadow-green-500/25 transform hover:scale-105 transition-all duration-300 border-0"
              size="lg"
            >
              <div className="flex items-center gap-3">
                <Zap className="w-5 h-5 animate-pulse" />
                {orderType === 'market' ? '🚀 Swap Now' : orderType === 'limit' ? '🎯 Place Limit Order' : '📈 Setup DCA'}
              </div>
            </Button>

            {/* Enhanced Quick Actions */}
            <div className="pt-2">
              <div className="text-xs text-gray-400 mb-3">Quick Amount</div>
              <div className="grid grid-cols-4 gap-3">
                {['25%', '50%', '75%', 'MAX'].map((percentage) => (
                  <button
                    key={percentage}
                    className="p-2 bg-gradient-to-r from-gray-600/20 to-gray-700/20 hover:from-blue-500/20 hover:to-purple-500/20 border border-white/10 hover:border-blue-400/30 rounded-lg text-xs font-semibold text-gray-200 hover:text-white transition-all duration-200 hover:scale-105 backdrop-blur-sm"
                    onClick={() => {
                      const balance = 12.45 // Mock balance
                      const amount = percentage === 'MAX' ? balance : balance * (parseInt(percentage) / 100)
                      setFromAmount(amount.toString())
                    }}
                  >
                    {percentage}
                  </button>
                ))}
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Chart and Market Data */}
      <div className="lg:col-span-2 space-y-6">
        <TradingChart />

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <OrderBook />
          <RecentTrades />
        </div>
      </div>
    </div>
  )
}
