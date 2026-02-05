'use client'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { 
  Activity, 
  BarChart3, 
  Bot, 
  Calendar, 
  Eye, 
  Heart, 
  MessageCircle, 
  Plus, 
  Settings, 
  Share2, 
  TrendingUp, 
  Users, 
  Zap,
  Target,
  Sparkles,
  Clock,
  Globe,
  Play,
  Pause,
  RotateCcw,
  Filter,
  Download,
  Upload
} from 'lucide-react'
import { useState, useEffect } from 'react'

// Mock data for demonstration
const influencerStats = [
  {
    title: 'Active Influencers',
    value: '12',
    change: '+3',
    icon: Bot,
    positive: true,
  },
  {
    title: 'Total Followers',
    value: '2.4M',
    change: '+125K',
    icon: Users,
    positive: true,
  },
  {
    title: 'Engagement Rate',
    value: '8.7%',
    change: '+1.2%',
    icon: Heart,
    positive: true,
  },
  {
    title: 'Viral Content',
    value: '47',
    change: '+12',
    icon: TrendingUp,
    positive: true,
  },
]

const activeInfluencers = [
  {
    id: 1,
    name: 'CryptoMemeKing',
    persona: 'Meme Lord',
    status: 'active',
    followers: '850K',
    engagement: '12.4%',
    platform: 'Twitter',
    lastPost: '2m ago',
    viralScore: 94,
    campaigns: 3,
    avatar: '🤖',
  },
  {
    id: 2,
    name: 'SolanaAlpha',
    persona: 'Educational Alpha',
    status: 'active',
    followers: '420K',
    engagement: '9.8%',
    platform: 'Discord',
    lastPost: '15m ago',
    viralScore: 87,
    campaigns: 2,
    avatar: '🧠',
  },
  {
    id: 3,
    name: 'DegenTrader',
    persona: 'Crypto Influencer',
    status: 'paused',
    followers: '1.2M',
    engagement: '6.3%',
    platform: 'Telegram',
    lastPost: '2h ago',
    viralScore: 76,
    campaigns: 1,
    avatar: '💎',
  },
]

const recentContent = [
  {
    id: 1,
    influencer: 'CryptoMemeKing',
    content: 'When SOL hits $300 but you sold at $100 😭',
    platform: 'Twitter',
    engagement: '15.2K',
    viralScore: 94,
    timestamp: '2m ago',
    type: 'meme',
    status: 'viral',
  },
  {
    id: 2,
    influencer: 'SolanaAlpha',
    content: 'Deep dive into Jupiter aggregator mechanics...',
    platform: 'Discord',
    engagement: '8.7K',
    viralScore: 87,
    timestamp: '15m ago',
    type: 'educational',
    status: 'trending',
  },
  {
    id: 3,
    influencer: 'DegenTrader',
    content: 'New DeFi protocol launching tomorrow 👀',
    platform: 'Telegram',
    engagement: '12.1K',
    viralScore: 82,
    timestamp: '1h ago',
    type: 'alpha',
    status: 'performing',
  },
]

const campaigns = [
  {
    id: 1,
    name: 'SOL Season Hype',
    influencers: 5,
    reach: '2.1M',
    engagement: '156K',
    budget: '$5,000',
    status: 'active',
    progress: 75,
    endDate: '2024-01-15',
  },
  {
    id: 2,
    name: 'Meme Coin Mania',
    influencers: 3,
    reach: '890K',
    engagement: '89K',
    budget: '$2,500',
    status: 'active',
    progress: 45,
    endDate: '2024-01-20',
  },
  {
    id: 3,
    name: 'DeFi Education',
    influencers: 2,
    reach: '450K',
    engagement: '67K',
    budget: '$1,800',
    status: 'completed',
    progress: 100,
    endDate: '2024-01-10',
  },
]

export function InfluencerDashboard() {
  const [activeTab, setActiveTab] = useState('overview')
  const [selectedInfluencer, setSelectedInfluencer] = useState<number | null>(null)
  const [realTimeData, setRealTimeData] = useState({
    totalEngagement: 0,
    activeUsers: 0,
    viralContent: 0,
  })

  // Simulate real-time updates
  useEffect(() => {
    const interval = setInterval(() => {
      setRealTimeData(prev => ({
        totalEngagement: prev.totalEngagement + Math.floor(Math.random() * 100),
        activeUsers: Math.floor(Math.random() * 1000) + 5000,
        viralContent: prev.viralContent + Math.floor(Math.random() * 5),
      }))
    }, 3000)

    return () => clearInterval(interval)
  }, [])

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'active': return 'bg-green-500/20 text-green-400 border-green-500/30'
      case 'paused': return 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30'
      case 'viral': return 'bg-purple-500/20 text-purple-400 border-purple-500/30'
      case 'trending': return 'bg-blue-500/20 text-blue-400 border-blue-500/30'
      case 'performing': return 'bg-cyan-500/20 text-cyan-400 border-cyan-500/30'
      case 'completed': return 'bg-gray-500/20 text-gray-400 border-gray-500/30'
      default: return 'bg-gray-500/20 text-gray-400 border-gray-500/30'
    }
  }

  const getViralScoreColor = (score: number) => {
    if (score >= 90) return 'text-purple-400'
    if (score >= 80) return 'text-blue-400'
    if (score >= 70) return 'text-green-400'
    if (score >= 60) return 'text-yellow-400'
    return 'text-red-400'
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-blue-900/80 to-indigo-900 dark:from-gray-900 dark:via-gray-800 dark:to-gray-900 relative">
      {/* Enhanced background */}
      <div className="absolute inset-0 overflow-hidden">
        <div className="absolute -top-20 -right-20 md:-top-40 md:-right-40 w-40 h-40 md:w-80 md:h-80 bg-purple-500/20 rounded-full blur-3xl animate-pulse" />
        <div className="absolute -bottom-20 -left-20 md:-bottom-40 md:-left-40 w-40 h-40 md:w-80 md:h-80 bg-cyan-500/20 rounded-full blur-3xl animate-pulse delay-1000" />
        <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 w-48 h-48 md:w-96 md:h-96 bg-blue-400/10 rounded-full blur-3xl animate-ping" />
      </div>

      {/* Header */}
      <div className="relative max-w-7xl mx-auto px-4 py-8 sm:px-6 lg:px-8">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-8">
          <div>
            <h1 className="text-4xl md:text-5xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-white via-purple-100 to-cyan-200 mb-2">
              AI Influencer Dashboard
            </h1>
            <p className="text-lg text-gray-300">Manage your AI influencers, campaigns, and viral content</p>
          </div>
          <div className="flex gap-3">
            <Button className="bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-500 hover:to-pink-500 text-white">
              <Plus className="w-4 h-4 mr-2" />
              Create Influencer
            </Button>
            <Button className="bg-gradient-to-r from-blue-600 to-cyan-600 hover:from-blue-500 hover:to-cyan-500 text-white">
              <Sparkles className="w-4 h-4 mr-2" />
              Launch Campaign
            </Button>
          </div>
        </div>

        {/* Stats Dashboard */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
          {influencerStats.map((stat, index) => (
            <Card
              key={index}
              className="glass-dark hover:glow-purple transform hover:scale-105 hover:-translate-y-1 transition-all duration-300 cursor-pointer animate-fade-in-up"
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
                  <div className="p-3 bg-gradient-to-br from-purple-500/20 to-pink-500/20 rounded-xl border border-purple-400/30">
                    <stat.icon className="w-7 h-7 text-purple-300" />
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Main Content Tabs */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Active Influencers */}
          <div className="lg:col-span-2">
            <Card className="glass-dark glow-cyan animate-fade-in-up delay-500">
              <CardHeader>
                <CardTitle className="flex items-center gap-3 text-white">
                  <div className="p-2 bg-gradient-to-r from-cyan-500/20 to-blue-500/20 rounded-lg border border-cyan-400/30">
                    <Bot className="w-6 h-6 text-cyan-300" />
                  </div>
                  Active Influencers
                  <Badge className="ml-auto bg-gradient-to-r from-green-500 to-emerald-500">
                    {activeInfluencers.filter(i => i.status === 'active').length} Active
                  </Badge>
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {activeInfluencers.map((influencer) => (
                    <div
                      key={influencer.id}
                      className="p-4 rounded-lg bg-white/5 border border-white/10 hover:bg-white/10 transition-all duration-200 cursor-pointer"
                      onClick={() => setSelectedInfluencer(influencer.id)}
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-4">
                          <div className="text-3xl">{influencer.avatar}</div>
                          <div>
                            <h3 className="font-bold text-white">{influencer.name}</h3>
                            <p className="text-sm text-gray-300">{influencer.persona}</p>
                            <div className="flex items-center gap-2 mt-1">
                              <Badge variant="outline" className="text-xs">
                                {influencer.platform}
                              </Badge>
                              <span className="text-xs text-gray-400">{influencer.lastPost}</span>
                            </div>
                          </div>
                        </div>
                        <div className="text-right">
                          <div className="flex items-center gap-4">
                            <div>
                              <p className="text-sm text-gray-300">Followers</p>
                              <p className="font-bold text-white">{influencer.followers}</p>
                            </div>
                            <div>
                              <p className="text-sm text-gray-300">Engagement</p>
                              <p className="font-bold text-green-400">{influencer.engagement}</p>
                            </div>
                            <div>
                              <p className="text-sm text-gray-300">Viral Score</p>
                              <p className={`font-bold ${getViralScoreColor(influencer.viralScore)}`}>
                                {influencer.viralScore}
                              </p>
                            </div>
                          </div>
                          <div className="flex items-center gap-2 mt-2">
                            <Badge className={getStatusColor(influencer.status)}>
                              {influencer.status}
                            </Badge>
                            <Button size="sm" variant="outline">
                              <Settings className="w-3 h-3" />
                            </Button>
                            <Button size="sm" variant="outline">
                              {influencer.status === 'active' ? <Pause className="w-3 h-3" /> : <Play className="w-3 h-3" />}
                            </Button>
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Real-time Analytics */}
          <div className="space-y-6">
            <Card className="glass-dark glow-purple animate-fade-in-up delay-700">
              <CardHeader>
                <CardTitle className="flex items-center gap-3 text-white">
                  <div className="p-2 bg-gradient-to-r from-purple-500/20 to-pink-500/20 rounded-lg border border-purple-400/30">
                    <Activity className="w-6 h-6 text-purple-300" />
                  </div>
                  Live Metrics
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div className="p-3 rounded-lg bg-gradient-to-r from-green-500/10 to-emerald-500/10 border border-green-500/20">
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-gray-300">Total Engagement</span>
                      <span className="text-lg font-bold text-green-400">
                        {realTimeData.totalEngagement.toLocaleString()}
                      </span>
                    </div>
                  </div>
                  <div className="p-3 rounded-lg bg-gradient-to-r from-blue-500/10 to-cyan-500/10 border border-blue-500/20">
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-gray-300">Active Users</span>
                      <span className="text-lg font-bold text-blue-400">
                        {realTimeData.activeUsers.toLocaleString()}
                      </span>
                    </div>
                  </div>
                  <div className="p-3 rounded-lg bg-gradient-to-r from-purple-500/10 to-pink-500/10 border border-purple-500/20">
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-gray-300">Viral Content</span>
                      <span className="text-lg font-bold text-purple-400">
                        {realTimeData.viralContent}
                      </span>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card className="glass-dark glow-blue animate-fade-in-up delay-900">
              <CardHeader>
                <CardTitle className="flex items-center gap-3 text-white">
                  <div className="p-2 bg-gradient-to-r from-blue-500/20 to-cyan-500/20 rounded-lg border border-blue-400/30">
                    <Target className="w-6 h-6 text-blue-300" />
                  </div>
                  Quick Actions
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  <Button className="w-full bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-500 hover:to-pink-500 text-white">
                    <Sparkles className="w-4 h-4 mr-2" />
                    Generate Viral Content
                  </Button>
                  <Button className="w-full bg-gradient-to-r from-blue-600 to-cyan-600 hover:from-blue-500 hover:to-cyan-500 text-white">
                    <Calendar className="w-4 h-4 mr-2" />
                    Schedule Posts
                  </Button>
                  <Button className="w-full bg-gradient-to-r from-green-600 to-emerald-600 hover:from-green-500 hover:to-emerald-500 text-white">
                    <BarChart3 className="w-4 h-4 mr-2" />
                    View Analytics
                  </Button>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>

        {/* Recent Content & Campaigns */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mt-8">
          {/* Recent Content */}
          <Card className="glass-dark glow-green animate-fade-in-up delay-1100">
            <CardHeader>
              <CardTitle className="flex items-center gap-3 text-white">
                <div className="p-2 bg-gradient-to-r from-green-500/20 to-emerald-500/20 rounded-lg border border-green-400/30">
                  <MessageCircle className="w-6 h-6 text-green-300" />
                </div>
                Recent Content
                <Button size="sm" variant="outline" className="ml-auto">
                  <Filter className="w-3 h-3 mr-1" />
                  Filter
                </Button>
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {recentContent.map((content) => (
                  <div
                    key={content.id}
                    className="p-4 rounded-lg bg-white/5 border border-white/10 hover:bg-white/10 transition-all duration-200"
                  >
                    <div className="flex items-start justify-between mb-2">
                      <div className="flex items-center gap-2">
                        <span className="font-medium text-white">{content.influencer}</span>
                        <Badge variant="outline" className="text-xs">
                          {content.platform}
                        </Badge>
                        <Badge className={getStatusColor(content.status)}>
                          {content.status}
                        </Badge>
                      </div>
                      <span className="text-xs text-gray-400">{content.timestamp}</span>
                    </div>
                    <p className="text-sm text-gray-300 mb-3">{content.content}</p>
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-4">
                        <div className="flex items-center gap-1">
                          <Heart className="w-4 h-4 text-red-400" />
                          <span className="text-sm text-gray-300">{content.engagement}</span>
                        </div>
                        <div className="flex items-center gap-1">
                          <TrendingUp className="w-4 h-4 text-purple-400" />
                          <span className={`text-sm ${getViralScoreColor(content.viralScore)}`}>
                            {content.viralScore}
                          </span>
                        </div>
                      </div>
                      <div className="flex gap-1">
                        <Button size="sm" variant="outline">
                          <Share2 className="w-3 h-3" />
                        </Button>
                        <Button size="sm" variant="outline">
                          <RotateCcw className="w-3 h-3" />
                        </Button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          {/* Active Campaigns */}
          <Card className="glass-dark glow-orange animate-fade-in-up delay-1300">
            <CardHeader>
              <CardTitle className="flex items-center gap-3 text-white">
                <div className="p-2 bg-gradient-to-r from-orange-500/20 to-red-500/20 rounded-lg border border-orange-400/30">
                  <Zap className="w-6 h-6 text-orange-300" />
                </div>
                Active Campaigns
                <Button size="sm" variant="outline" className="ml-auto">
                  <Download className="w-3 h-3 mr-1" />
                  Export
                </Button>
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {campaigns.map((campaign) => (
                  <div
                    key={campaign.id}
                    className="p-4 rounded-lg bg-white/5 border border-white/10 hover:bg-white/10 transition-all duration-200"
                  >
                    <div className="flex items-start justify-between mb-3">
                      <div>
                        <h3 className="font-bold text-white">{campaign.name}</h3>
                        <p className="text-sm text-gray-300">{campaign.influencers} influencers</p>
                      </div>
                      <Badge className={getStatusColor(campaign.status)}>
                        {campaign.status}
                      </Badge>
                    </div>
                    <div className="grid grid-cols-3 gap-4 mb-3">
                      <div>
                        <p className="text-xs text-gray-400">Reach</p>
                        <p className="font-medium text-white">{campaign.reach}</p>
                      </div>
                      <div>
                        <p className="text-xs text-gray-400">Engagement</p>
                        <p className="font-medium text-green-400">{campaign.engagement}</p>
                      </div>
                      <div>
                        <p className="text-xs text-gray-400">Budget</p>
                        <p className="font-medium text-blue-400">{campaign.budget}</p>
                      </div>
                    </div>
                    <div className="mb-3">
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-xs text-gray-400">Progress</span>
                        <span className="text-xs text-gray-400">{campaign.progress}%</span>
                      </div>
                      <div className="w-full bg-gray-700 rounded-full h-2">
                        <div
                          className="bg-gradient-to-r from-blue-500 to-purple-500 h-2 rounded-full transition-all duration-300"
                          style={{ width: `${campaign.progress}%` }}
                        />
                      </div>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-xs text-gray-400">Ends: {campaign.endDate}</span>
                      <div className="flex gap-1">
                        <Button size="sm" variant="outline">
                          <Eye className="w-3 h-3" />
                        </Button>
                        <Button size="sm" variant="outline">
                          <Settings className="w-3 h-3" />
                        </Button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}