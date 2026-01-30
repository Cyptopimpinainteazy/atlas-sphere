'use client'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { 
  Activity, 
  BarChart3, 
  Calendar, 
  DollarSign, 
  Eye, 
  Heart, 
  MessageCircle, 
  Play, 
  Plus, 
  Repeat2, 
  Settings, 
  Target, 
  TrendingUp, 
  Users, 
  Zap,
  AlertTriangle,
  CheckCircle,
  Clock,
  Pause,
  RotateCcw,
  Share2,
  Sparkles
} from 'lucide-react'
import { useState } from 'react'

interface Campaign {
  id: string
  name: string
  objective: 'follower_growth' | 'engagement_boost' | 'trend_participation'
  status: 'active' | 'paused' | 'completed' | 'draft'
  platforms: string[]
  budget: number
  spent: number
  startDate: string
  endDate: string
  metrics: {
    reach: number
    impressions: number
    engagement: number
    clicks: number
    conversions: number
    roi: number
  }
  performance: {
    viralScore: number
    engagementRate: number
    growthRate: number
  }
}

const mockCampaigns: Campaign[] = [
  {
    id: '1',
    name: 'Solana Summer Meme Blitz',
    objective: 'engagement_boost',
    status: 'active',
    platforms: ['Twitter', 'Discord', 'Telegram'],
    budget: 5000,
    spent: 2340,
    startDate: '2024-01-15',
    endDate: '2024-02-15',
    metrics: {
      reach: 125000,
      impressions: 450000,
      engagement: 18500,
      clicks: 8200,
      conversions: 1240,
      roi: 2.8
    },
    performance: {
      viralScore: 8.7,
      engagementRate: 4.1,
      growthRate: 12.5
    }
  },
  {
    id: '2',
    name: 'DeFi Education Series',
    objective: 'follower_growth',
    status: 'active',
    platforms: ['Twitter', 'Discord'],
    budget: 3000,
    spent: 890,
    startDate: '2024-01-20',
    endDate: '2024-03-20',
    metrics: {
      reach: 85000,
      impressions: 280000,
      engagement: 12300,
      clicks: 5600,
      conversions: 890,
      roi: 1.9
    },
    performance: {
      viralScore: 6.4,
      engagementRate: 4.4,
      growthRate: 8.2
    }
  },
  {
    id: '3',
    name: 'Trending Hashtag Takeover',
    objective: 'trend_participation',
    status: 'paused',
    platforms: ['Twitter'],
    budget: 2000,
    spent: 1200,
    startDate: '2024-01-10',
    endDate: '2024-01-25',
    metrics: {
      reach: 95000,
      impressions: 320000,
      engagement: 15600,
      clicks: 7200,
      conversions: 980,
      roi: 2.1
    },
    performance: {
      viralScore: 7.8,
      engagementRate: 4.9,
      growthRate: 15.3
    }
  }
]

const campaignTemplates = [
  {
    id: 'meme_viral',
    name: 'Meme Viral Boost',
    objective: 'engagement_boost',
    description: 'High-frequency meme posting with viral optimization',
    estimatedReach: '50K-200K',
    duration: '7-14 days',
    platforms: ['Twitter', 'Discord', 'Telegram'],
    features: ['AI Meme Generation', 'Trend Hijacking', 'Cross-platform Sync']
  },
  {
    id: 'follower_magnet',
    name: 'Follower Magnet',
    objective: 'follower_growth',
    description: 'Targeted engagement and follow-back strategies',
    estimatedReach: '30K-100K',
    duration: '14-30 days',
    platforms: ['Twitter', 'Discord'],
    features: ['Smart Following', 'Engagement Automation', 'Community Building']
  },
  {
    id: 'trend_rider',
    name: 'Trend Rider',
    objective: 'trend_participation',
    description: 'Real-time trend detection and participation',
    estimatedReach: '100K-500K',
    duration: '3-7 days',
    platforms: ['Twitter'],
    features: ['Trend Detection', 'Rapid Response', 'Hashtag Optimization']
  }
]

export function ViralCampaignManager() {
  const [activeTab, setActiveTab] = useState('overview')
  const [selectedCampaign, setSelectedCampaign] = useState<Campaign | null>(null)

  const getStatusColor = (status: Campaign['status']) => {
    switch (status) {
      case 'active':
        return 'bg-green-500/20 text-green-400 border-green-500/30'
      case 'paused':
        return 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30'
      case 'completed':
        return 'bg-blue-500/20 text-blue-400 border-blue-500/30'
      case 'draft':
        return 'bg-gray-500/20 text-gray-400 border-gray-500/30'
      default:
        return 'bg-gray-500/20 text-gray-400 border-gray-500/30'
    }
  }

  const getObjectiveIcon = (objective: Campaign['objective']) => {
    switch (objective) {
      case 'follower_growth':
        return <Users className="w-4 h-4" />
      case 'engagement_boost':
        return <Heart className="w-4 h-4" />
      case 'trend_participation':
        return <TrendingUp className="w-4 h-4" />
      default:
        return <Target className="w-4 h-4" />
    }
  }

  const formatNumber = (num: number) => {
    if (num >= 1000000) return `${(num / 1000000).toFixed(1)}M`
    if (num >= 1000) return `${(num / 1000).toFixed(1)}K`
    return num.toString()
  }

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(amount)
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-3xl font-bold text-white mb-2">Viral Campaign Manager</h2>
          <p className="text-gray-400">Create, monitor, and optimize multi-platform viral campaigns</p>
        </div>
        <Button className="bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-500 hover:to-pink-500">
          <Plus className="w-4 h-4 mr-2" />
          New Campaign
        </Button>
      </div>

      {/* Quick Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card className="glass-dark">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-400">Active Campaigns</p>
                <p className="text-2xl font-bold text-white">
                  {mockCampaigns.filter(c => c.status === 'active').length}
                </p>
              </div>
              <div className="p-3 bg-green-500/20 rounded-lg">
                <Play className="w-6 h-6 text-green-400" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="glass-dark">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-400">Total Reach</p>
                <p className="text-2xl font-bold text-white">
                  {formatNumber(mockCampaigns.reduce((sum, c) => sum + c.metrics.reach, 0))}
                </p>
              </div>
              <div className="p-3 bg-blue-500/20 rounded-lg">
                <Eye className="w-6 h-6 text-blue-400" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="glass-dark">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-400">Avg. Engagement</p>
                <p className="text-2xl font-bold text-white">
                  {(mockCampaigns.reduce((sum, c) => sum + c.performance.engagementRate, 0) / mockCampaigns.length).toFixed(1)}%
                </p>
              </div>
              <div className="p-3 bg-purple-500/20 rounded-lg">
                <Heart className="w-6 h-6 text-purple-400" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="glass-dark">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-400">Total ROI</p>
                <p className="text-2xl font-bold text-white">
                  {(mockCampaigns.reduce((sum, c) => sum + c.metrics.roi, 0) / mockCampaigns.length).toFixed(1)}x
                </p>
              </div>
              <div className="p-3 bg-yellow-500/20 rounded-lg">
                <DollarSign className="w-6 h-6 text-yellow-400" />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Main Content */}
      <Card className="glass-dark">
        <CardHeader>
          <Tabs value={activeTab} onValueChange={setActiveTab}>
            <TabsList className="glass grid w-full grid-cols-4">
              <TabsTrigger value="overview">📊 Overview</TabsTrigger>
              <TabsTrigger value="templates">🎯 Templates</TabsTrigger>
              <TabsTrigger value="analytics">📈 Analytics</TabsTrigger>
              <TabsTrigger value="optimization">⚡ Optimization</TabsTrigger>
            </TabsList>
          </Tabs>
        </CardHeader>

        <CardContent>
          <Tabs value={activeTab}>
            {/* Overview Tab */}
            <TabsContent value="overview" className="space-y-6">
              <div className="flex items-center justify-between">
                <h3 className="text-xl font-semibold text-white">Active Campaigns</h3>
                <div className="flex gap-2">
                  <Button variant="outline" size="sm">
                    <Settings className="w-4 h-4 mr-2" />
                    Bulk Actions
                  </Button>
                </div>
              </div>

              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Campaign</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Platforms</TableHead>
                    <TableHead>Budget</TableHead>
                    <TableHead>Performance</TableHead>
                    <TableHead>Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {mockCampaigns.map((campaign) => (
                    <TableRow key={campaign.id} className="hover:bg-white/5">
                      <TableCell>
                        <div>
                          <div className="flex items-center gap-2">
                            {getObjectiveIcon(campaign.objective)}
                            <span className="font-medium text-white">{campaign.name}</span>
                          </div>
                          <div className="text-sm text-gray-400 mt-1">
                            {campaign.startDate} - {campaign.endDate}
                          </div>
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge className={getStatusColor(campaign.status)}>
                          {campaign.status === 'active' && <Play className="w-3 h-3 mr-1" />}
                          {campaign.status === 'paused' && <Pause className="w-3 h-3 mr-1" />}
                          {campaign.status === 'completed' && <CheckCircle className="w-3 h-3 mr-1" />}
                          {campaign.status === 'draft' && <Clock className="w-3 h-3 mr-1" />}
                          {campaign.status}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <div className="flex gap-1">
                          {campaign.platforms.map((platform) => (
                            <Badge key={platform} variant="outline" className="text-xs">
                              {platform}
                            </Badge>
                          ))}
                        </div>
                      </TableCell>
                      <TableCell>
                        <div>
                          <div className="text-white font-medium">
                            {formatCurrency(campaign.spent)} / {formatCurrency(campaign.budget)}
                          </div>
                          <div className="w-full bg-gray-700 rounded-full h-2 mt-1">
                            <div 
                              className="bg-gradient-to-r from-blue-500 to-purple-500 h-2 rounded-full"
                              style={{ width: `${(campaign.spent / campaign.budget) * 100}%` }}
                            />
                          </div>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="space-y-1">
                          <div className="flex items-center gap-2">
                            <Sparkles className="w-3 h-3 text-yellow-400" />
                            <span className="text-sm text-white">Viral: {campaign.performance.viralScore}/10</span>
                          </div>
                          <div className="flex items-center gap-2">
                            <Heart className="w-3 h-3 text-pink-400" />
                            <span className="text-sm text-white">{campaign.performance.engagementRate}%</span>
                          </div>
                          <div className="flex items-center gap-2">
                            <TrendingUp className="w-3 h-3 text-green-400" />
                            <span className="text-sm text-white">+{campaign.performance.growthRate}%</span>
                          </div>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex gap-2">
                          <Button variant="outline" size="sm">
                            <BarChart3 className="w-4 h-4" />
                          </Button>
                          <Button variant="outline" size="sm">
                            <Settings className="w-4 h-4" />
                          </Button>
                          {campaign.status === 'active' ? (
                            <Button variant="outline" size="sm">
                              <Pause className="w-4 h-4" />
                            </Button>
                          ) : (
                            <Button variant="outline" size="sm">
                              <Play className="w-4 h-4" />
                            </Button>
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </TabsContent>

            {/* Templates Tab */}
            <TabsContent value="templates" className="space-y-6">
              <div>
                <h3 className="text-xl font-semibold text-white mb-4">Campaign Templates</h3>
                <p className="text-gray-400 mb-6">Choose from pre-configured campaign templates optimized for different objectives</p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                {campaignTemplates.map((template) => (
                  <Card key={template.id} className="glass-dark hover:glow-purple transition-all duration-300 cursor-pointer">
                    <CardHeader>
                      <div className="flex items-center justify-between">
                        <CardTitle className="text-lg text-white">{template.name}</CardTitle>
                        {getObjectiveIcon(template.objective)}
                      </div>
                      <CardDescription className="text-gray-400">
                        {template.description}
                      </CardDescription>
                    </CardHeader>
                    <CardContent>
                      <div className="space-y-4">
                        <div className="grid grid-cols-2 gap-4 text-sm">
                          <div>
                            <span className="text-gray-400">Est. Reach:</span>
                            <div className="text-white font-medium">{template.estimatedReach}</div>
                          </div>
                          <div>
                            <span className="text-gray-400">Duration:</span>
                            <div className="text-white font-medium">{template.duration}</div>
                          </div>
                        </div>

                        <div>
                          <span className="text-gray-400 text-sm">Platforms:</span>
                          <div className="flex gap-1 mt-1">
                            {template.platforms.map((platform) => (
                              <Badge key={platform} variant="outline" className="text-xs">
                                {platform}
                              </Badge>
                            ))}
                          </div>
                        </div>

                        <div>
                          <span className="text-gray-400 text-sm">Features:</span>
                          <ul className="mt-1 space-y-1">
                            {template.features.map((feature, index) => (
                              <li key={index} className="text-sm text-white flex items-center gap-2">
                                <CheckCircle className="w-3 h-3 text-green-400" />
                                {feature}
                              </li>
                            ))}
                          </ul>
                        </div>

                        <Button className="w-full bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-500 hover:to-pink-500">
                          Use Template
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </TabsContent>

            {/* Analytics Tab */}
            <TabsContent value="analytics" className="space-y-6">
              <div>
                <h3 className="text-xl font-semibold text-white mb-4">Campaign Analytics</h3>
                <p className="text-gray-400 mb-6">Detailed performance metrics and insights</p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <Card className="glass-dark">
                  <CardHeader>
                    <CardTitle className="text-white">Reach & Impressions</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-4">
                      <div className="flex justify-between items-center">
                        <span className="text-gray-400">Total Reach</span>
                        <span className="text-white font-bold">
                          {formatNumber(mockCampaigns.reduce((sum, c) => sum + c.metrics.reach, 0))}
                        </span>
                      </div>
                      <div className="flex justify-between items-center">
                        <span className="text-gray-400">Total Impressions</span>
                        <span className="text-white font-bold">
                          {formatNumber(mockCampaigns.reduce((sum, c) => sum + c.metrics.impressions, 0))}
                        </span>
                      </div>
                      <div className="flex justify-between items-center">
                        <span className="text-gray-400">Impression Rate</span>
                        <span className="text-green-400 font-bold">
                          {((mockCampaigns.reduce((sum, c) => sum + c.metrics.impressions, 0) / 
                             mockCampaigns.reduce((sum, c) => sum + c.metrics.reach, 0)) * 100).toFixed(1)}%
                        </span>
                      </div>
                    </div>
                  </CardContent>
                </Card>

                <Card className="glass-dark">
                  <CardHeader>
                    <CardTitle className="text-white">Engagement Metrics</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-4">
                      <div className="flex justify-between items-center">
                        <span className="text-gray-400">Total Engagement</span>
                        <span className="text-white font-bold">
                          {formatNumber(mockCampaigns.reduce((sum, c) => sum + c.metrics.engagement, 0))}
                        </span>
                      </div>
                      <div className="flex justify-between items-center">
                        <span className="text-gray-400">Avg. Engagement Rate</span>
                        <span className="text-purple-400 font-bold">
                          {(mockCampaigns.reduce((sum, c) => sum + c.performance.engagementRate, 0) / mockCampaigns.length).toFixed(1)}%
                        </span>
                      </div>
                      <div className="flex justify-between items-center">
                        <span className="text-gray-400">Click-through Rate</span>
                        <span className="text-blue-400 font-bold">
                          {((mockCampaigns.reduce((sum, c) => sum + c.metrics.clicks, 0) / 
                             mockCampaigns.reduce((sum, c) => sum + c.metrics.impressions, 0)) * 100).toFixed(2)}%
                        </span>
                      </div>
                    </div>
                  </CardContent>
                </Card>

                <Card className="glass-dark">
                  <CardHeader>
                    <CardTitle className="text-white">ROI & Conversions</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-4">
                      <div className="flex justify-between items-center">
                        <span className="text-gray-400">Total Conversions</span>
                        <span className="text-white font-bold">
                          {formatNumber(mockCampaigns.reduce((sum, c) => sum + c.metrics.conversions, 0))}
                        </span>
                      </div>
                      <div className="flex justify-between items-center">
                        <span className="text-gray-400">Conversion Rate</span>
                        <span className="text-green-400 font-bold">
                          {((mockCampaigns.reduce((sum, c) => sum + c.metrics.conversions, 0) / 
                             mockCampaigns.reduce((sum, c) => sum + c.metrics.clicks, 0)) * 100).toFixed(2)}%
                        </span>
                      </div>
                      <div className="flex justify-between items-center">
                        <span className="text-gray-400">Average ROI</span>
                        <span className="text-yellow-400 font-bold">
                          {(mockCampaigns.reduce((sum, c) => sum + c.metrics.roi, 0) / mockCampaigns.length).toFixed(1)}x
                        </span>
                      </div>
                    </div>
                  </CardContent>
                </Card>

                <Card className="glass-dark">
                  <CardHeader>
                    <CardTitle className="text-white">Platform Performance</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-4">
                      <div className="flex justify-between items-center">
                        <span className="text-gray-400">Twitter</span>
                        <div className="flex items-center gap-2">
                          <div className="w-16 bg-gray-700 rounded-full h-2">
                            <div className="bg-blue-500 h-2 rounded-full" style={{ width: '85%' }} />
                          </div>
                          <span className="text-white text-sm">85%</span>
                        </div>
                      </div>
                      <div className="flex justify-between items-center">
                        <span className="text-gray-400">Discord</span>
                        <div className="flex items-center gap-2">
                          <div className="w-16 bg-gray-700 rounded-full h-2">
                            <div className="bg-purple-500 h-2 rounded-full" style={{ width: '72%' }} />
                          </div>
                          <span className="text-white text-sm">72%</span>
                        </div>
                      </div>
                      <div className="flex justify-between items-center">
                        <span className="text-gray-400">Telegram</span>
                        <div className="flex items-center gap-2">
                          <div className="w-16 bg-gray-700 rounded-full h-2">
                            <div className="bg-cyan-500 h-2 rounded-full" style={{ width: '68%' }} />
                          </div>
                          <span className="text-white text-sm">68%</span>
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </div>
            </TabsContent>

            {/* Optimization Tab */}
            <TabsContent value="optimization" className="space-y-6">
              <div>
                <h3 className="text-xl font-semibold text-white mb-4">Campaign Optimization</h3>
                <p className="text-gray-400 mb-6">AI-powered insights and recommendations for improving campaign performance</p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <Card className="glass-dark">
                  <CardHeader>
                    <CardTitle className="text-white flex items-center gap-2">
                      <AlertTriangle className="w-5 h-5 text-yellow-400" />
                      Performance Alerts
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-4">
                      <div className="p-3 bg-yellow-500/20 border border-yellow-500/30 rounded-lg">
                        <div className="flex items-center gap-2 mb-2">
                          <AlertTriangle className="w-4 h-4 text-yellow-400" />
                          <span className="text-yellow-400 font-medium">Low Engagement</span>
                        </div>
                        <p className="text-sm text-gray-300">
                          "DeFi Education Series" engagement rate dropped 15% in the last 24h
                        </p>
                        <Button size="sm" className="mt-2 bg-yellow-600 hover:bg-yellow-500">
                          Optimize Content
                        </Button>
                      </div>

                      <div className="p-3 bg-red-500/20 border border-red-500/30 rounded-lg">
                        <div className="flex items-center gap-2 mb-2">
                          <AlertTriangle className="w-4 h-4 text-red-400" />
                          <span className="text-red-400 font-medium">Budget Alert</span>
                        </div>
                        <p className="text-sm text-gray-300">
                          "Trending Hashtag Takeover" is 60% through budget with 40% time remaining
                        </p>
                        <Button size="sm" className="mt-2 bg-red-600 hover:bg-red-500">
                          Adjust Budget
                        </Button>
                      </div>

                      <div className="p-3 bg-green-500/20 border border-green-500/30 rounded-lg">
                        <div className="flex items-center gap-2 mb-2">
                          <CheckCircle className="w-4 h-4 text-green-400" />
                          <span className="text-green-400 font-medium">Viral Opportunity</span>
                        </div>
                        <p className="text-sm text-gray-300">
                          Trending topic "#SolanaWinter" detected - perfect for meme campaign
                        </p>
                        <Button size="sm" className="mt-2 bg-green-600 hover:bg-green-500">
                          Create Content
                        </Button>
                      </div>
                    </div>
                  </CardContent>
                </Card>

                <Card className="glass-dark">
                  <CardHeader>
                    <CardTitle className="text-white flex items-center gap-2">
                      <Zap className="w-5 h-5 text-blue-400" />
                      AI Recommendations
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-4">
                      <div className="p-3 bg-blue-500/20 border border-blue-500/30 rounded-lg">
                        <div className="flex items-center gap-2 mb-2">
                          <Clock className="w-4 h-4 text-blue-400" />
                          <span className="text-blue-400 font-medium">Optimal Timing</span>
                        </div>
                        <p className="text-sm text-gray-300">
                          Post between 2-4 PM EST for 23% higher engagement
                        </p>
                      </div>

                      <div className="p-3 bg-purple-500/20 border border-purple-500/30 rounded-lg">
                        <div className="flex items-center gap-2 mb-2">
                          <Share2 className="w-4 h-4 text-purple-400" />
                          <span className="text-purple-400 font-medium">Cross-Platform</span>
                        </div>
                        <p className="text-sm text-gray-300">
                          Adapt Twitter content for Discord to increase reach by 35%
                        </p>
                      </div>

                      <div className="p-3 bg-cyan-500/20 border border-cyan-500/30 rounded-lg">
                        <div className="flex items-center gap-2 mb-2">
                          <Sparkles className="w-4 h-4 text-cyan-400" />
                          <span className="text-cyan-400 font-medium">Content Mix</span>
                        </div>
                        <p className="text-sm text-gray-300">
                          Increase meme content by 20% and reduce text posts by 10%
                        </p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </div>

              <Card className="glass-dark">
                <CardHeader>
                  <CardTitle className="text-white">Automated Optimization Controls</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div className="p-4 bg-gradient-to-r from-blue-500/20 to-purple-500/20 rounded-lg border border-blue-400/30">
                      <div className="flex items-center gap-2 mb-2">
                        <RotateCcw className="w-5 h-5 text-blue-400" />
                        <span className="text-white font-medium">Auto-Optimization</span>
                      </div>
                      <p className="text-sm text-gray-300 mb-3">
                        Automatically adjust posting times and content mix based on performance
                      </p>
                      <Button size="sm" className="w-full bg-blue-600 hover:bg-blue-500">
                        Enable
                      </Button>
                    </div>

                    <div className="p-4 bg-gradient-to-r from-green-500/20 to-emerald-500/20 rounded-lg border border-green-400/30">
                      <div className="flex items-center gap-2 mb-2">
                        <Target className="w-5 h-5 text-green-400" />
                        <span className="text-white font-medium">Smart Targeting</span>
                      </div>
                      <p className="text-sm text-gray-300 mb-3">
                        AI-powered audience targeting and engagement optimization
                      </p>
                      <Button size="sm" className="w-full bg-green-600 hover:bg-green-500">
                        Configure
                      </Button>
                    </div>

                    <div className="p-4 bg-gradient-to-r from-yellow-500/20 to-orange-500/20 rounded-lg border border-yellow-400/30">
                      <div className="flex items-center gap-2 mb-2">
                        <DollarSign className="w-5 h-5 text-yellow-400" />
                        <span className="text-white font-medium">Budget Optimization</span>
                      </div>
                      <p className="text-sm text-gray-300 mb-3">
                        Automatically reallocate budget based on platform performance
                      </p>
                      <Button size="sm" className="w-full bg-yellow-600 hover:bg-yellow-500">
                        Setup
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>
    </div>
  )
}