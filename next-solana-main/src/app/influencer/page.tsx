'use client'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { 
  Activity, 
  BarChart3, 
  Brain, 
  Crown, 
  Heart, 
  MessageCircle, 
  TrendingUp, 
  Users, 
  Zap,
  Sparkles,
  Target,
  Megaphone,
  Globe
} from 'lucide-react'
import { useState, useEffect } from 'react'
import { InfluencerDashboard } from '@/components/influencer/InfluencerDashboard'
import { ContentCreationStudio } from '@/components/influencer/ContentCreationStudio'
import { ViralCampaignManager } from '@/components/influencer/ViralCampaignManager'
import { CommunityGrowthTracker } from '@/components/influencer/CommunityGrowthTracker'
import { EnhancedThemeToggle } from '@/components/ui/theme-toggle'

const stats = [
  {
    title: 'Active Influencers',
    value: '12',
    change: '+3 this week',
    icon: Crown,
    positive: true,
    gradient: 'from-purple-500/20 to-pink-500/20',
    border: 'border-purple-400/30',
  },
  {
    title: 'Total Followers',
    value: '2.4M',
    change: '+125K this month',
    icon: Users,
    positive: true,
    gradient: 'from-blue-500/20 to-cyan-500/20',
    border: 'border-blue-400/30',
  },
  {
    title: 'Viral Content',
    value: '847',
    change: '+23 today',
    icon: Zap,
    positive: true,
    gradient: 'from-yellow-500/20 to-orange-500/20',
    border: 'border-yellow-400/30',
  },
  {
    title: 'Engagement Rate',
    value: '8.7%',
    change: '+1.2% this week',
    icon: Heart,
    positive: true,
    gradient: 'from-green-500/20 to-emerald-500/20',
    border: 'border-green-400/30',
  },
]

const topInfluencers = [
  { 
    name: 'CryptoMemeKing', 
    persona: 'Meme Lord', 
    followers: '890K', 
    engagement: '12.4%', 
    viralPosts: '156',
    status: 'active',
    platforms: ['Twitter', 'Discord', 'Telegram']
  },
  { 
    name: 'SolanaAlphaBot', 
    persona: 'Educational Alpha', 
    followers: '654K', 
    engagement: '9.8%', 
    viralPosts: '89',
    status: 'active',
    platforms: ['Twitter', 'Discord']
  },
  { 
    name: 'DegenTraderAI', 
    persona: 'Crypto Influencer', 
    followers: '432K', 
    engagement: '15.2%', 
    viralPosts: '234',
    status: 'campaign',
    platforms: ['Twitter', 'Telegram']
  },
  { 
    name: 'MoonShotMaster', 
    persona: 'Meme Lord', 
    followers: '321K', 
    engagement: '11.7%', 
    viralPosts: '178',
    status: 'active',
    platforms: ['Twitter', 'Discord', 'Telegram']
  },
  { 
    name: 'NFTVibesOnly', 
    persona: 'Crypto Influencer', 
    followers: '298K', 
    engagement: '8.9%', 
    viralPosts: '92',
    status: 'paused',
    platforms: ['Twitter', 'Discord']
  },
]

const recentActivity = [
  { type: 'viral', message: 'CryptoMemeKing posted viral meme - 50K+ engagements', time: '2 min ago', icon: Zap },
  { type: 'growth', message: 'SolanaAlphaBot gained 2.5K followers today', time: '15 min ago', icon: TrendingUp },
  { type: 'campaign', message: 'DegenTraderAI launched new viral campaign', time: '1 hour ago', icon: Megaphone },
  { type: 'content', message: 'MoonShotMaster generated 12 new memes', time: '2 hours ago', icon: Sparkles },
  { type: 'community', message: 'NFTVibesOnly Discord reached 10K members', time: '3 hours ago', icon: Users },
]

export default function InfluencerPage() {
  const [activeTab, setActiveTab] = useState('dashboard')
  const [isConnected, setIsConnected] = useState(false)
  const [notifications, setNotifications] = useState(0)

  // Simulate WebSocket connection for real-time updates
  useEffect(() => {
    const connectWebSocket = () => {
      setIsConnected(true)
      // Simulate real-time notifications
      const interval = setInterval(() => {
        setNotifications(prev => prev + 1)
      }, 30000) // New notification every 30 seconds

      return () => clearInterval(interval)
    }

    const cleanup = connectWebSocket()
    return cleanup
  }, [])

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-purple-900/80 to-pink-900 dark:from-gray-900 dark:via-gray-800 dark:to-gray-900 relative">
      {/* Enhanced background with influencer theme */}
      <div className="absolute inset-0 overflow-hidden">
        <div className="absolute -top-20 -right-20 md:-top-40 md:-right-40 w-40 h-40 md:w-80 md:h-80 bg-purple-500/20 rounded-full blur-3xl animate-pulse" />
        <div className="absolute -bottom-20 -left-20 md:-bottom-40 md:-left-40 w-40 h-40 md:w-80 md:h-80 bg-pink-500/20 rounded-full blur-3xl animate-pulse delay-1000" />
        <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 w-48 h-48 md:w-96 md:h-96 bg-cyan-400/10 rounded-full blur-3xl animate-ping" />
      </div>

      {/* Particle Background Overlay */}
      <div className="absolute inset-0 opacity-30">
        <div className="hidden md:block absolute top-20 left-20 w-1 h-1 bg-purple-400 rounded-full animate-bounce" />
        <div className="hidden lg:block absolute top-40 right-32 w-1 h-1 bg-pink-400 rounded-full animate-bounce delay-150" />
        <div className="hidden xl:block absolute bottom-32 left-40 w-1 h-1 bg-cyan-400 rounded-full animate-bounce delay-300" />
        <div className="hidden md:block absolute top-60 right-20 w-1 h-1 bg-yellow-400 rounded-full animate-bounce delay-500" />
        <div className="hidden lg:block absolute bottom-20 right-40 w-1 h-1 bg-indigo-400 rounded-full animate-bounce delay-700" />
      </div>

      {/* Hero Section */}
      <div className="relative overflow-hidden">
        {/* Dynamic Gradient Background */}
        <div className="absolute inset-0 bg-gradient-to-r from-purple-600/30 via-pink-600/30 to-cyan-600/30 animate-pulse" />

        <div className="relative max-w-7xl mx-auto px-4 py-20 sm:px-6 lg:px-8">
          <div className="text-center animate-fade-in">
            <h1 className="text-5xl md:text-7xl lg:text-8xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-white via-purple-100 to-pink-200 mb-6 leading-tight drop-shadow-2xl">
              AI Influencer{' '}
              <span className="bg-gradient-to-r from-purple-400 via-pink-400 to-cyan-400 bg-clip-text text-transparent animate-gradient-x">
                Empire
              </span>
            </h1>
            <p className="text-xl md:text-2xl text-gray-300 dark:text-gray-200 mb-12 max-w-4xl mx-auto leading-relaxed font-light tracking-wide">
              Create, manage, and scale AI-powered influencers that generate viral content, grow communities, and dominate social media across all platforms.
            </p>

            {/* Enhanced Feature Badges */}
            <div className="flex flex-wrap justify-center gap-6 mb-16">
              <Badge
                variant="secondary"
                className="px-6 py-3 text-sm bg-gradient-to-r from-purple-600/20 to-pink-600/20 border border-purple-400/30 hover:border-purple-400/50 transform hover:scale-105 transition-all duration-300 backdrop-blur-sm animate-fade-in-up delay-300"
              >
                <Brain className="w-5 h-5 mr-3 text-purple-400 animate-pulse" />
                AI-Powered Content
              </Badge>
              <Badge
                variant="secondary"
                className="px-6 py-3 text-sm bg-gradient-to-r from-pink-600/20 to-cyan-600/20 border border-pink-400/30 hover:border-pink-400/50 transform hover:scale-105 transition-all duration-300 backdrop-blur-sm animate-fade-in-up delay-500"
              >
                <Zap className="w-5 h-5 mr-3 text-pink-400 animate-pulse" />
                Viral Optimization
              </Badge>
              <Badge
                variant="secondary"
                className="px-6 py-3 text-sm bg-gradient-to-r from-cyan-600/20 to-blue-600/20 border border-cyan-400/30 hover:border-cyan-400/50 transform hover:scale-105 transition-all duration-300 backdrop-blur-sm animate-fade-in-up delay-700"
              >
                <Globe className="w-5 h-5 mr-3 text-cyan-400 animate-pulse" />
                Multi-Platform Growth
              </Badge>
            </div>

            {/* Connection Status & CTA */}
            <div className="animate-fade-in-up delay-1000">
              <div className="flex items-center justify-center gap-4 mb-6">
                <div className={`flex items-center gap-2 px-4 py-2 rounded-full ${
                  isConnected 
                    ? 'bg-green-500/20 border border-green-400/30 text-green-400' 
                    : 'bg-red-500/20 border border-red-400/30 text-red-400'
                }`}>
                  <div className={`w-2 h-2 rounded-full ${isConnected ? 'bg-green-400' : 'bg-red-400'} animate-pulse`} />
                  {isConnected ? 'Live Updates Active' : 'Connecting...'}
                </div>
                {notifications > 0 && (
                  <Badge className="bg-gradient-to-r from-orange-500 to-red-500 animate-bounce">
                    {notifications} New Updates
                  </Badge>
                )}
              </div>
              
              <button className="bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-500 hover:to-pink-500 text-white font-semibold px-8 py-4 rounded-full shadow-2xl hover:shadow-purple-500/25 transform hover:scale-105 transition-all duration-300 text-lg">
                Launch New Influencer
              </button>
              <p className="text-sm text-gray-400 mt-4">Automated content generation • Real-time optimization</p>
            </div>
          </div>
        </div>
      </div>

      {/* Header with Theme Toggle */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
        <div className="flex justify-end">
          <EnhancedThemeToggle />
        </div>
      </div>

      {/* Enhanced Stats Dashboard */}
      <div className="max-w-7xl mx-auto px-4 -mt-8 sm:px-6 lg:px-8 mobile-card-stack">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
          {stats.map((stat, index) => (
            <Card
              key={index}
              className={`glass-dark hover:glow-purple transform hover:scale-105 hover:-translate-y-1 transition-all duration-300 cursor-pointer animate-fade-in-up bg-gradient-to-br ${stat.gradient} border ${stat.border}`}
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
                  <div className={`p-3 bg-gradient-to-br ${stat.gradient} rounded-xl border ${stat.border}`}>
                    <stat.icon className="w-7 h-7 text-white" />
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Enhanced Main Interface */}
        <Card className="glass-dark glow-cyan animate-fade-in-up delay-1000">
          <CardHeader>
            <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
              <TabsList className="glass grid w-full grid-cols-4 p-1 gap-1">
                <TabsTrigger
                  value="dashboard"
                  className="font-medium transition-all duration-300 hover:bg-gradient-to-r hover:from-purple-500/20 hover:to-pink-500/20 data-[state=active]:bg-gradient-to-r data-[state=active]:from-purple-500/30 data-[state=active]:to-pink-500/30 data-[state=active]:text-white"
                >
                  👑 Dashboard
                </TabsTrigger>
                <TabsTrigger
                  value="studio"
                  className="font-medium transition-all duration-300 hover:bg-gradient-to-r hover:from-blue-500/20 hover:to-cyan-500/20 data-[state=active]:bg-gradient-to-r data-[state=active]:from-blue-500/30 data-[state=active]:to-cyan-500/30 data-[state=active]:text-white"
                >
                  🎨 Studio
                </TabsTrigger>
                <TabsTrigger
                  value="campaigns"
                  className="font-medium transition-all duration-300 hover:bg-gradient-to-r hover:from-orange-500/20 hover:to-red-500/20 data-[state=active]:bg-gradient-to-r data-[state=active]:from-orange-500/30 data-[state=active]:to-red-500/30 data-[state=active]:text-white"
                >
                  🚀 Campaigns
                </TabsTrigger>
                <TabsTrigger
                  value="growth"
                  className="font-medium transition-all duration-300 hover:bg-gradient-to-r hover:from-green-500/20 hover:to-emerald-500/20 data-[state=active]:bg-gradient-to-r data-[state=active]:from-green-500/30 data-[state=active]:to-emerald-500/30 data-[state=active]:text-white"
                >
                  📈 Growth
                </TabsTrigger>
              </TabsList>
            </Tabs>
          </CardHeader>
          <CardContent>
            <Tabs value={activeTab} className="w-full">
              <TabsContent value="dashboard">
                <InfluencerDashboard />
              </TabsContent>
              <TabsContent value="studio">
                <ContentCreationStudio />
              </TabsContent>
              <TabsContent value="campaigns">
                <ViralCampaignManager />
              </TabsContent>
              <TabsContent value="growth">
                <CommunityGrowthTracker />
              </TabsContent>
            </Tabs>
          </CardContent>
        </Card>

        {/* Enhanced Top Influencers Table */}
        <Card className="mt-8 glass-dark glow-purple animate-fade-in-up delay-1200">
          <CardHeader>
            <CardTitle className="flex items-center gap-3 text-white">
              <div className="p-2 bg-gradient-to-r from-purple-500/20 to-pink-500/20 rounded-lg border border-purple-400/30">
                <Crown className="w-6 h-6 text-purple-300" />
              </div>
              Top Performing Influencers
              <Badge className="ml-auto bg-gradient-to-r from-orange-500 to-red-500 hover:from-orange-600 hover:to-red-600">
                🔥 LIVE
              </Badge>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-white/20">
                    <th className="text-left py-4 px-4 font-semibold text-gray-300">Influencer</th>
                    <th className="text-left py-4 px-4 font-semibold text-gray-300">Persona</th>
                    <th className="text-left py-4 px-4 font-semibold text-gray-300">Followers</th>
                    <th className="text-left py-4 px-4 font-semibold text-gray-300">Engagement</th>
                    <th className="text-left py-4 px-4 font-semibold text-gray-300">Viral Posts</th>
                    <th className="text-left py-4 px-4 font-semibold text-gray-300">Platforms</th>
                    <th className="text-left py-4 px-4 font-semibold text-gray-300">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {topInfluencers.map((influencer, index) => {
                    const statusColors = {
                      active: 'bg-green-500/20 text-green-400 border-green-500/30',
                      campaign: 'bg-orange-500/20 text-orange-400 border-orange-500/30',
                      paused: 'bg-gray-500/20 text-gray-400 border-gray-500/30'
                    }
                    
                    return (
                      <tr
                        key={index}
                        className="border-b border-white/10 hover:bg-white/5 transition-all duration-200 transform hover:scale-[1.02] cursor-pointer"
                      >
                        <td className="py-4 px-4">
                          <div className="flex items-center gap-3">
                            <div className={`w-2 h-2 rounded-full ${
                              influencer.status === 'active' ? 'bg-green-400' : 
                              influencer.status === 'campaign' ? 'bg-orange-400' : 'bg-gray-400'
                            } animate-pulse`} />
                            <div className="font-bold text-white">{influencer.name}</div>
                          </div>
                        </td>
                        <td className="py-4 px-4">
                          <Badge className="bg-gradient-to-r from-purple-500/20 to-pink-500/20 border border-purple-400/30 text-purple-300">
                            {influencer.persona}
                          </Badge>
                        </td>
                        <td className="py-4 px-4 text-gray-300 font-mono">{influencer.followers}</td>
                        <td className="py-4 px-4">
                          <div className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-semibold bg-blue-500/20 text-blue-400 border border-blue-500/30">
                            📊 {influencer.engagement}
                          </div>
                        </td>
                        <td className="py-4 px-4">
                          <Badge className="bg-gradient-to-r from-yellow-500 to-orange-500 hover:from-yellow-600 hover:to-orange-600 text-white font-semibold">
                            ⚡ {influencer.viralPosts}
                          </Badge>
                        </td>
                        <td className="py-4 px-4">
                          <div className="flex gap-1">
                            {influencer.platforms.map((platform, i) => (
                              <Badge key={i} variant="outline" className="text-xs">
                                {platform}
                              </Badge>
                            ))}
                          </div>
                        </td>
                        <td className="py-4 px-4">
                          <div className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-semibold border ${statusColors[influencer.status as keyof typeof statusColors]}`}>
                            {influencer.status.toUpperCase()}
                          </div>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>

        {/* Real-time Activity Feed */}
        <Card className="mt-8 glass-dark glow-cyan animate-fade-in-up delay-1400">
          <CardHeader>
            <CardTitle className="flex items-center gap-3 text-white">
              <div className="p-2 bg-gradient-to-r from-cyan-500/20 to-blue-500/20 rounded-lg border border-cyan-400/30">
                <Activity className="w-6 h-6 text-cyan-300" />
              </div>
              Real-time Activity Feed
              <div className="ml-auto flex items-center gap-2">
                <div className="w-2 h-2 bg-green-400 rounded-full animate-pulse" />
                <span className="text-sm text-green-400">Live</span>
              </div>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {recentActivity.map((activity, index) => (
                <div
                  key={index}
                  className="flex items-center gap-4 p-4 rounded-lg bg-white/5 border border-white/10 hover:bg-white/10 transition-all duration-200"
                >
                  <div className="p-2 bg-gradient-to-r from-purple-500/20 to-pink-500/20 rounded-lg border border-purple-400/30">
                    <activity.icon className="w-5 h-5 text-purple-300" />
                  </div>
                  <div className="flex-1">
                    <p className="text-white font-medium">{activity.message}</p>
                    <p className="text-gray-400 text-sm">{activity.time}</p>
                  </div>
                  <Badge variant="outline" className="text-xs">
                    {activity.type}
                  </Badge>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Contextual Help Section */}
        <Card className="mt-8 glass-dark glow-yellow animate-fade-in-up delay-1600">
          <CardHeader>
            <CardTitle className="flex items-center gap-3 text-white">
              <div className="p-2 bg-gradient-to-r from-yellow-500/20 to-orange-500/20 rounded-lg border border-yellow-400/30">
                <Target className="w-6 h-6 text-yellow-300" />
              </div>
              Optimization Tips
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              <div className="p-4 rounded-lg bg-gradient-to-r from-purple-500/10 to-pink-500/10 border border-purple-400/20">
                <h4 className="font-semibold text-white mb-2">🎯 Content Strategy</h4>
                <p className="text-gray-300 text-sm">Post during peak hours (7-9 PM) for maximum engagement. Use trending hashtags and respond to viral topics quickly.</p>
              </div>
              <div className="p-4 rounded-lg bg-gradient-to-r from-blue-500/10 to-cyan-500/10 border border-blue-400/20">
                <h4 className="font-semibold text-white mb-2">📈 Growth Hacks</h4>
                <p className="text-gray-300 text-sm">Engage with influencers in your niche, cross-promote content across platforms, and maintain consistent posting schedules.</p>
              </div>
              <div className="p-4 rounded-lg bg-gradient-to-r from-green-500/10 to-emerald-500/10 border border-green-400/20">
                <h4 className="font-semibold text-white mb-2">🚀 Viral Tactics</h4>
                <p className="text-gray-300 text-sm">Create controversial but tasteful content, use emotional triggers, and leverage current events for maximum viral potential.</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}