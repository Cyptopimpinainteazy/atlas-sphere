'use client'

import React, { useState, useEffect, createContext, useContext } from 'react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Separator } from '@/components/ui/separator'
import { Switch } from '@/components/ui/switch'
import {
  Bot,
  Cpu,
  Settings,
  Zap,
  BarChart3,
  TrendingUp,
  Target,
  Users,
  Brain,
  Activity,
  Clock,
  DollarSign,
  Shield,
  Network,
  Eye,
  Copy,
  Play,
  Pause,
  AlertTriangle
} from 'lucide-react'

// Trading Bot Context for sharing state between components
interface TradingBotContextType {
  strategies: Strategy[]
  isMasterBotEnabled: boolean
  activeSignals: BotSignal[]
  updateStrategies: (strategies: Strategy[]) => void
  toggleMasterBot: (enabled: boolean) => void
  executeBotTrade: (strategyId: string, action: 'buy' | 'sell', amount: number) => void
}

const TradingBotContext = createContext<TradingBotContextType | null>(null)

export const useTradingBotContext = () => {
  const context = useContext(TradingBotContext)
  if (!context) {
    throw new Error('useTradingBotContext must be used within TradingBotProvider')
  }
  return context
}

interface BotSignal {
  id: string
  strategyId: string
  strategyName: string
  type: 'BUY' | 'SELL' | 'HOLD'
  confidence: number
  price: number
  timestamp: number
  reason: string
  icon: string
}



interface RightBotSidebarProps {
  isOpen: boolean
  toggleSidebar: () => void
}

interface Strategy {
  id: string
  name: string
  description: string
  icon: string
  enabled: boolean
  category: string
}

const tradingStrategies: Strategy[] = [
  // Short-Term / Intraday Strategies
  { id: 'scalping', name: 'Scalping', description: 'Quick trades for small profits; high-frequency', icon: '⚡', enabled: false, category: 'short-term' },
  { id: 'sniping', name: 'Sniping', description: 'Precision entry at key levels, using limit orders', icon: '🎯', enabled: false, category: 'short-term' },
  { id: 'momentum', name: 'Momentum Trading', description: 'Riding price action in strong movement direction', icon: '🚀', enabled: false, category: 'short-term' },
  { id: 'news-trading', name: 'News Trading', description: 'Trading based on market-moving news releases', icon: '📰', enabled: false, category: 'short-term' },
  { id: 'breakout', name: 'Breakout Trading', description: 'Entering when price breaks support/resistance', icon: '📈', enabled: false, category: 'short-term' },
  { id: 'pullback', name: 'Pullback Trading', description: 'Entering on retracements within a trend', icon: '🔄', enabled: false, category: 'short-term' },
  { id: 'reversal', name: 'Reversal Trading', description: 'Betting on trend change at extremes', icon: '↩️', enabled: false, category: 'short-term' },

  // Medium-Term / Swing Strategies
  { id: 'mean-reversion', name: 'Mean Reversion', description: 'Trading back to average price (Bollinger Bands, RSI)', icon: '📊', enabled: false, category: 'medium-term' },
  { id: 'trend-following', name: 'Trend Following', description: 'Following established trends (moving averages, MACD)', icon: '📈', enabled: false, category: 'medium-term' },
  { id: 'range-trading', name: 'Range Trading', description: 'Buying support, selling resistance sideways markets', icon: '↔️', enabled: false, category: 'medium-term' },
  { id: 'channel-trading', name: 'Channel Trading', description: 'Using parallel trend lines for entry/exit', icon: '📏', enabled: false, category: 'medium-term' },
  { id: 'volume-profile', name: 'Volume Profile', description: 'Trading based on high-volume price levels', icon: '📊', enabled: false, category: 'medium-term' },
  { id: 'fibonacci', name: 'Fibonacci Retracement', description: 'Entry/exits at key Fib levels', icon: '🌀', enabled: false, category: 'medium-term' },
  { id: 'ichimoku', name: 'Ichimoku Cloud', description: 'Multi-component trend and momentum system', icon: '⛅', enabled: false, category: 'medium-term' },
  { id: 'divergence', name: 'Divergence Trading', description: 'RSI/MACD divergence prediction', icon: '📉', enabled: false, category: 'medium-term' },
  { id: 'swing-structure', name: 'Swing High/Low', description: 'Entry on swing structure confirmation', icon: '📈', enabled: false, category: 'medium-term' },

  // Long-Term / Position Strategies
  { id: 'position-trading', name: 'Position Trading', description: 'Holding trades for weeks/months based on macro trends', icon: '📅', enabled: false, category: 'long-term' },
  { id: 'value-investing', name: 'Value Investing', description: 'Buying undervalued assets (fundamental-based)', icon: '💎', enabled: false, category: 'long-term' },
  { id: 'growth-investing', name: 'Growth Investing', description: 'Investing in high-potential companies', icon: '🌱', enabled: false, category: 'long-term' },
  { id: 'buy-hold', name: 'Buy & Hold', description: 'Passive long-term investment', icon: '🛋️', enabled: false, category: 'long-term' },
  { id: 'dividend-investing', name: 'Dividend Investing', description: 'Focused on yield and reinvestment', icon: '💰', enabled: false, category: 'long-term' },

  // Algorithmic / Systematic Strategies
  { id: 'grid-trading', name: 'Grid Trading', description: 'Buy/sell orders at fixed intervals', icon: '🔗', enabled: false, category: 'algorithmic' },
  { id: 'martingale', name: 'Martingale/Anti-Martingale', description: 'Doubling down trading (use with caution)', icon: '⚠️', enabled: false, category: 'algorithmic' },
  { id: 'stat-arb', name: 'Statistical Arbitrage', description: 'Quantitative models for pair trading', icon: '📊', enabled: false, category: 'algorithmic' },
  { id: 'hft', name: 'High-Frequency Trading', description: 'Ultra-fast automated trading', icon: '💫', enabled: false, category: 'algorithmic' },
  { id: 'ml-models', name: 'Machine Learning Models', description: 'AI/ML price prediction', icon: '🤖', enabled: false, category: 'algorithmic' },
  { id: 'backtest-optimized', name: 'Backtest-Optimized', description: 'Data-driven setups from historical analysis', icon: '🔬', enabled: false, category: 'algorithmic' },

  // Other / Hybrid Strategies
  { id: 'copy-trading', name: 'Copy Trading', description: 'Following other traders automatically', icon: '👥', enabled: false, category: 'hybrid' },
  { id: 'sentiment-analysis', name: 'Sentiment Analysis', description: 'Using social/media sentiment signals', icon: '📱', enabled: false, category: 'hybrid' },
  { id: 'liquidity-hunting', name: 'Liquidity Hunting', description: 'Targeting known liquidity zones', icon: '🎯', enabled: false, category: 'hybrid' },
  { id: 'options-strategies', name: 'Options Strategies', description: 'Iron Condors, Straddles, Covered Calls', icon: '📋', enabled: false, category: 'hybrid' },
  { id: 'hedging', name: 'Hedging', description: 'Using positions to reduce risk exposure', icon: '🛡️', enabled: false, category: 'hybrid' },
  { id: 'arbitrage-triangular', name: 'Triangular Arbitrage', description: 'Exploiting price discrepancies across markets', icon: '📐', enabled: false, category: 'hybrid' },
  { id: 'arbitrage-spatial', name: 'Spatial Arbitrage', description: 'Exploiting price discrepancies across exchanges', icon: '🌍', enabled: false, category: 'hybrid' },
  { id: 'vsa', name: 'Volume Spread Analysis (VSA)', description: 'Analyzing volume in price context', icon: '📊', enabled: false, category: 'hybrid' },
  { id: 'smc', name: 'Smart Money Concepts (SMC)', description: 'Institutional-style trading with order blocks', icon: '🏛️', enabled: false, category: 'hybrid' }
]

const categoryConfig = {
  'short-term': { label: 'Short-Term / Intraday', icon: '⚡', color: 'bg-blue-500/20 text-blue-400 border-blue-400/30' },
  'medium-term': { label: 'Medium-Term / Swing', icon: '📈', color: 'bg-green-500/20 text-green-400 border-green-400/30' },
  'long-term': { label: 'Long-Term / Position', icon: '📅', color: 'bg-purple-500/20 text-purple-400 border-purple-400/30' },
  'algorithmic': { label: 'Algorithmic / Systematic', icon: '🤖', color: 'bg-orange-500/20 text-orange-400 border-orange-400/30' },
  'hybrid': { label: 'Other / Hybrid', icon: '🔗', color: 'bg-pink-500/20 text-pink-400 border-pink-400/30' }
}

export const TradingBotProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [strategies, setStrategies] = useState<Strategy[]>(tradingStrategies)
  const [isMasterBotEnabled, setIsMasterBotEnabled] = useState(false)
  const [activeSignals, setActiveSignals] = useState<BotSignal[]>([])

  // Bot signal generation based on enabled strategies and current market data
  useEffect(() => {
    if (!isMasterBotEnabled) return

    const interval = setInterval(() => {
      const enabledStrategies = strategies.filter(s => s.enabled)
      const newSignals: BotSignal[] = []

      enabledStrategies.forEach(strategy => {
        // Simulate bot analysis based on strategy type
        const confidence = Math.random() * 100
        const signalProbability = Math.random()

        if (signalProbability > 0.7) { // 30% chance to generate signal
          const signalType = Math.random() > 0.5 ? 'BUY' : 'SELL'
          const signal: BotSignal = {
            id: `${strategy.id}-${Date.now()}-${Math.random()}`,
            strategyId: strategy.id,
            strategyName: strategy.name,
            type: signalType,
            confidence: Math.round(confidence),
            price: 95 + Math.random() * 10, // Current market price simulation
            timestamp: Date.now(),
            reason: `${strategy.name} detected ${signalType === 'BUY' ? 'bullish' : 'bearish'} signal`,
            icon: strategy.icon
          }

          newSignals.push(signal)
        }
      })

      if (newSignals.length > 0) {
        setActiveSignals(prev => [...prev, ...newSignals].slice(-10)) // Keep last 10 signals
      }
    }, 30000) // Generate signals every 30 seconds

    return () => clearInterval(interval)
  }, [strategies, isMasterBotEnabled])

  const executeBotTrade = (strategyId: string, action: 'buy' | 'sell', amount: number) => {
    console.log(`${action} ${amount} units via ${strategyId}`)
    // In a real implementation, this would connect to the DEX API
    // For demo, just log the action
  }

  const value: TradingBotContextType = {
    strategies,
    isMasterBotEnabled,
    activeSignals,
    updateStrategies: setStrategies,
    toggleMasterBot: setIsMasterBotEnabled,
    executeBotTrade
  }

  return (
    <TradingBotContext.Provider value={value}>
      {children}
    </TradingBotContext.Provider>
  )
}

export function RightBotSidebar({ isOpen, toggleSidebar }: RightBotSidebarProps) {
  const [activeCategory, setActiveCategory] = useState<string>('short-term')

  const { strategies, isMasterBotEnabled, activeSignals, updateStrategies, toggleMasterBot } = useTradingBotContext()

  const setStrategies = updateStrategies

  if (!isOpen) return null

  const enabledStrategies = strategies.filter(s => s.enabled)
  const totalStrategies = strategies.length

  const toggleStrategy = (strategyId: string) => {
    setStrategies(prev =>
      prev.map(strategy =>
        strategy.id === strategyId
          ? { ...strategy, enabled: !strategy.enabled }
          : strategy
      )
    )
  }

  const toggleCategoryStrategies = (category: string, enabled: boolean) => {
    setStrategies(prev =>
      prev.map(strategy =>
        strategy.category === category
          ? { ...strategy, enabled }
          : strategy
      )
    )
  }

  const getCategoryStrategies = (category: string) => {
    return strategies.filter(s => s.category === category)
  }

  const getCategoryEnabledCount = (category: string) => {
    return getCategoryStrategies(category).filter(s => s.enabled).length
  }

  return (
    <aside className="fixed right-0 top-0 h-full w-96 bg-black/95 backdrop-blur-md border-l border-white/10 z-40 overflow-y-auto overflow-x-hidden">
      {/* Sidebar Header */}
      <div className="p-4 border-b border-white/10">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-bold text-white flex items-center gap-2">
            <Bot className="w-5 h-5 text-purple-400" />
            Trading Bots
          </h2>
          <Button
            variant="ghost"
            size="sm"
            onClick={toggleSidebar}
            className="text-white hover:bg-white/10"
          >
            ✕
          </Button>
        </div>

        {/* Master Bot Toggle */}
        <div className="mt-4 flex items-center justify-between p-3 bg-gradient-to-r from-purple-900/30 to-blue-900/30 border border-purple-400/30 rounded-lg">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-purple-500/20 rounded-lg">
              <Bot className="w-5 h-5 text-purple-400" />
            </div>
            <div>
              <h3 className="text-white font-semibold">Master Bot Control</h3>
              <p className="text-gray-400 text-sm">{enabledStrategies.length}/{totalStrategies} strategies active</p>
            </div>
          </div>
          <Switch
            checked={isMasterBotEnabled}
            onCheckedChange={toggleMasterBot}
            className="data-[state=checked]:bg-purple-500"
          />
        </div>
      </div>

      {/* Category Navigation */}
      <div className="px-4 py-3 border-b border-white/10 overflow-x-auto">
        <div className="w-full">
          <div className="flex gap-2 pb-2">
            {Object.entries(categoryConfig).map(([key, config]) => {
              const count = getCategoryEnabledCount(key)
              return (
                <button
                  key={key}
                  onClick={() => setActiveCategory(key)}
                  className={`flex-1 p-2 rounded-lg transition-all duration-200 text-xs ${
                    activeCategory === key
                      ? `${config.color} border`
                      : 'text-gray-400 hover:bg-white/5'
                  }`}
                >
                  <div className="flex flex-col items-center gap-1">
                    <span className="text-sm">{config.icon}</span>
                    <span className="font-medium text-xs">{config.label.split('/')[0]}</span>
                    <Badge
                      variant="outline"
                      className={`text-xs px-1 py-0 ${count > 0 ? 'border-green-400 text-green-400' : 'border-gray-400 text-gray-400'}`}
                    >
                      {count}
                    </Badge>
                  </div>
                </button>
              )
            })}
          </div>
        </div>
      </div>

      {/* Content Area */}
      <div className="flex-1 p-4 overflow-y-auto">

        {/* Current Category Header */}
        <div className="mb-4">
          <div className="flex items-center justify-between">
            <h3 className="text-white font-semibold flex items-center gap-2">
              <span className="text-lg">{categoryConfig[activeCategory as keyof typeof categoryConfig].icon}</span>
              {categoryConfig[activeCategory as keyof typeof categoryConfig].label}
            </h3>
            <div className="flex gap-2">
              <Button
                size="sm"
                variant="outline"
                onClick={() => {const cat = activeCategory; setStrategies(prev => prev.map(s => s.category === cat ? {...s, enabled: false} : s))}}
                className="text-xs border-red-400/50 text-red-400 hover:bg-red-400/10"
              >
                Clear
              </Button>
              <Button
                size="sm"
                variant="outline"
                onClick={() => {const cat = activeCategory; setStrategies(prev => prev.map(s => s.category === cat ? {...s, enabled: true} : s))}}
                className="text-xs border-green-400/50 text-green-400 hover:bg-green-400/10"
              >
                All
              </Button>
            </div>
          </div>
        </div>

        {/* Strategy List */}
        <div className="space-y-3">
          {getCategoryStrategies(activeCategory).map((strategy) => (
            <Card
              key={strategy.id}
              className={`transition-all duration-200 border ${
                strategy.enabled
                  ? 'bg-gradient-to-r from-green-900/30 to-blue-900/30 border-green-400/50'
                  : 'bg-black/50 border-white/10 hover:border-gray-400/30'
              }`}
            >
              <CardContent className="p-4">
                <div className="flex items-start gap-3">
                  <div className={`p-2 rounded-lg ${strategy.enabled ? 'bg-green-500/20' : 'bg-gray-500/20'}`}>
                    <span className="text-lg">{strategy.icon}</span>
                  </div>
                  <div className="flex-1">
                    <div className="flex items-center justify-between mb-1">
                      <h4 className="text-white font-medium text-sm">{strategy.name}</h4>
                      <Switch
                        checked={strategy.enabled}
                        onCheckedChange={() => toggleStrategy(strategy.id)}
                        size="sm"
                        className="data-[state=checked]:bg-green-500"
                      />
                    </div>
                    <p className="text-gray-400 text-xs leading-relaxed">{strategy.description}</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Active Strategies Summary */}
        {enabledStrategies.length > 0 && (
          <Card className="mt-6 bg-gradient-to-r from-blue-900/30 to-purple-900/30 border-blue-400/30">
            <CardHeader className="pb-3">
              <CardTitle className="text-blue-400 text-sm flex items-center gap-2">
                <Activity className="w-4 h-4" />
                Active Strategies ({enabledStrategies.length})
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              {enabledStrategies.slice(0, 5).map((strategy) => (
                <div key={strategy.id} className="flex items-center gap-2">
                  <span className="text-lg">{strategy.icon}</span>
                  <span className="text-white text-sm">{strategy.name}</span>
                </div>
              ))}
              {enabledStrategies.length > 5 && (
                <div className="text-gray-400 text-xs">
                  +{enabledStrategies.length - 5} more...
                </div>
              )}
            </CardContent>
          </Card>
        )}

        {/* Bot Configuration */}
        <Card className="mt-6 bg-gradient-to-r from-orange-900/30 to-red-900/30 border-orange-400/30">
          <CardHeader className="pb-3">
            <CardTitle className="text-orange-400 text-sm flex items-center gap-2">
              <Settings className="w-4 h-4" />
              Bot Configuration
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-white text-sm">Auto-stop Loss</span>
              <Switch defaultChecked />
            </div>
            <div className="flex items-center justify-between">
              <span className="text-white text-sm">Take Profit Alerts</span>
              <Switch defaultChecked />
            </div>
            <div className="flex items-center justify-between">
              <span className="text-white text-sm">Risk Management</span>
              <Switch defaultChecked />
            </div>
            <div className="flex items-center justify-between">
              <span className="text-white text-sm">Performance Logging</span>
              <Switch defaultChecked />
            </div>
          </CardContent>
        </Card>

      </div>
    </aside>
  )
}
