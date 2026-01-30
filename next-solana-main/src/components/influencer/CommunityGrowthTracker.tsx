'use client'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Switch } from '@/components/ui/switch'
import { Progress } from '@/components/ui/progress'
import { 
  Users, 
  TrendingUp, 
  TrendingDown, 
  Heart, 
  MessageCircle, 
  Share2, 
  Target, 
  Shield, 
  Zap, 
  BarChart3,
  Activity,
  Eye,
  UserPlus,
  UserMinus,
  AlertTriangle,
  CheckCircle,
  Clock,
  Star,
  Filter,
  Settings,
  Play,
  Pause,
  RotateCcw
} from 'lucide-react'

export function CommunityGrowthTracker() {
  const platformStats = {
    twitter: {
      followers: 45672,
      growth: '+12.3%',
      engagement: '4.2%',
      quality: 87,
      active: true
    },
    discord: {
      members: 8934,
      growth: '+8.7%',
      engagement: '23.1%',
      quality: 92,
      active: true
    },
    telegram: {
      subscribers: 12456,
      growth: '+15.2%',
      engagement: '18.5%',
      quality: 89,
      active: true
    },
    instagram: {
      followers: 23891,
      growth: '+6.4%',
      engagement: '7.8%',
      quality: 84,
      active: false
    }
  }

  const growthMetrics = [
    { name: 'Total Followers', value: '90,953', change: '+11.2%', positive: true },
    { name: 'Avg Engagement Rate', value: '13.4%', change: '+2.1%', positive: true },
    { name: 'Community Health Score', value: '88/100', change: '+5', positive: true },
    { name: 'Growth Velocity', value: '+1,247/day', change: '+18.3%', positive: true },
    { name: 'Follower Quality Score', value: '87.5%', change: '+3.2%', positive: true },
    { name: 'Churn Rate', value: '2.1%', change: '-0.8%', positive: true },
  ]

  const automationTools = [
    { name: 'Auto Follow Back', enabled: true, performance: '94%' },
    { name: 'Smart Engagement', enabled: true, performance: '87%' },
    { name: 'Content Amplification', enabled: true, performance: '91%' },
    { name: 'Trend Participation', enabled: false, performance: '76%' },
    { name: 'Community Moderation', enabled: true, performance: '98%' },
    { name: 'Welcome Messages', enabled: true, performance: '89%' },
  ]

  const competitorData = [
    { name: 'CryptoInfluencer1', followers: 67234, growth: '+8.9%', engagement: '3.1%' },
    { name: 'MemeKing2023', followers: 89123, growth: '+15.7%', engagement: '6.2%' },
    { name: 'AlphaTrader', followers: 45678, growth: '+4.3%', engagement: '2.8%' },
    { name: 'DeFiGuru', followers: 123456, growth: '+12.1%', engagement: '4.7%' },
  ]

  const recentActivities = [
    { 
      type: 'growth', 
      platform: 'Twitter', 
      message: '+127 new followers from viral tweet', 
      time: '2 hours ago',
      impact: 'high'
    },
    { 
      type: 'engagement', 
      platform: 'Discord', 
      message: 'Community event generated 89% participation', 
      time: '4 hours ago',
      impact: 'high'
    },
    { 
      type: 'moderation', 
      platform: 'Telegram', 
      message: 'Auto-moderated 12 spam messages', 
      time: '6 hours ago',
      impact: 'medium'
    },
    { 
      type: 'quality', 
      platform: 'Twitter', 
      message: 'Follower quality score improved to 87%', 
      time: '8 hours ago',
      impact: 'medium'
    },
    { 
      type: 'warning', 
      platform: 'Instagram', 
      message: 'Growth rate below target (-2.3%)', 
      time: '12 hours ago',
      impact: 'low'
    },
  ]

  const growthStrategies = [
    { 
      name: 'Viral Content Push', 
      status: 'active', 
      performance: '+23% engagement',
      nextAction: 'Launch meme campaign',
      timeRemaining: '2 days'
    },
    { 
      name: 'Influencer Collaboration', 
      status: 'pending', 
      performance: 'Awaiting response',
      nextAction: 'Follow up with @CryptoKing',
      timeRemaining: '1 day'
    },
    { 
      name: 'Community Events', 
      status: 'active', 
      performance: '+15% retention',
      nextAction: 'Schedule AMA session',
      timeRemaining: '5 days'
    },
    { 
      name: 'Cross-Platform Promotion', 
      status: 'completed', 
      performance: '+8% cross-follow',
      nextAction: 'Analyze results',
      timeRemaining: 'Complete'
    },
  ]

  const getActivityIcon = (type: string) => {
    switch (type) {
      case 'growth': return <UserPlus className="w-4 h-4 text-green-500" />
      case 'engagement': return <Heart className="w-4 h-4 text-red-500" />
      case 'moderation': return <Shield className="w-4 h-4 text-blue-500" />
      case 'quality': return <Star className="w-4 h-4 text-yellow-500" />
      case 'warning': return <AlertTriangle className="w-4 h-4 text-orange-500" />
      default: return <Activity className="w-4 h-4 text-gray-500" />
    }
  }

  const getImpactColor = (impact: string) => {
    switch (impact) {
      case 'high': return 'text-green-600'
      case 'medium': return 'text-yellow-600'
      case 'low': return 'text-red-600'
      default: return 'text-gray-600'
    }
  }

  return (
    <div className="space-y-6">
      {/* Growth Overview */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {Object.entries(platformStats).map(([platform, stats]) => (
          <Card key={platform}>
            <CardContent className="p-6">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center space-x-2">
                  <div className="w-8 h-8 bg-gradient-to-br from-purple-500 to-blue-500 rounded-full flex items-center justify-center text-white font-bold text-sm">
                    {platform[0].toUpperCase()}
                  </div>
                  <span className="font-semibold capitalize">{platform}</span>
                  {stats.active && <Badge variant="success" className="text-xs">Active</Badge>}
                </div>
                <Switch checked={stats.active} />
              </div>
              <div className="space-y-2">
                <div className="flex justify-between">
                  <span className="text-sm text-gray-600">Followers</span>
                  <span className="font-semibold">{stats.followers.toLocaleString()}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-sm text-gray-600">Growth</span>
                  <Badge variant={stats.growth.startsWith('+') ? 'success' : 'destructive'}>
                    {stats.growth}
                  </Badge>
                </div>
                <div className="flex justify-between">
                  <span className="text-sm text-gray-600">Engagement</span>
                  <span className="font-semibold">{stats.engagement}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-sm text-gray-600">Quality</span>
                  <div className="flex items-center space-x-2">
                    <Progress value={stats.quality} className="w-16 h-2" />
                    <span className="text-sm font-semibold">{stats.quality}%</span>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Key Metrics */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {growthMetrics.map((metric, index) => (
          <Card key={index}>
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-600 dark:text-gray-400">{metric.name}</p>
                  <p className="text-2xl font-bold">{metric.value}</p>
                  <div className={`flex items-center mt-1 ${metric.positive ? 'text-green-600' : 'text-red-600'}`}>
                    {metric.positive ? (
                      <TrendingUp className="w-3 h-3 mr-1" />
                    ) : (
                      <TrendingDown className="w-3 h-3 mr-1" />
                    )}
                    <span className="text-sm">{metric.change}</span>
                  </div>
                </div>
                <Users className="w-8 h-8 text-blue-500" />
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <Tabs defaultValue="automation" className="w-full">
        <TabsList className="grid w-full grid-cols-5">
          <TabsTrigger value="automation">Automation</TabsTrigger>
          <TabsTrigger value="strategies">Strategies</TabsTrigger>
          <TabsTrigger value="competitors">Competitors</TabsTrigger>
          <TabsTrigger value="activities">Activities</TabsTrigger>
          <TabsTrigger value="analytics">Analytics</TabsTrigger>
        </TabsList>

        <TabsContent value="automation">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <Card>
              <CardHeader>
                <CardTitle>Growth Automation Tools</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {automationTools.map((tool, index) => (
                    <div key={index} className="flex items-center justify-between p-4 border rounded-lg">
                      <div className="flex items-center space-x-3">
                        <Switch checked={tool.enabled} />
                        <div>
                          <p className="font-semibold">{tool.name}</p>
                          <p className="text-sm text-gray-600">Performance: {tool.performance}</p>
                        </div>
                      </div>
                      <div className="flex space-x-2">
                        <Button size="sm" variant="outline">
                          <Settings className="w-4 h-4" />
                        </Button>
                        <Button size="sm" variant="outline">
                          {tool.enabled ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4" />}
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Quick Actions</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-2 gap-4">
                  <Button className="h-20 flex flex-col items-center justify-center">
                    <Zap className="w-6 h-6 mb-2" />
                    <span>Boost Campaign</span>
                  </Button>
                  <Button variant="outline" className="h-20 flex flex-col items-center justify-center">
                    <Target className="w-6 h-6 mb-2" />
                    <span>Target Audience</span>
                  </Button>
                  <Button variant="outline" className="h-20 flex flex-col items-center justify-center">
                    <Share2 className="w-6 h-6 mb-2" />
                    <span>Cross Promote</span>
                  </Button>
                  <Button variant="outline" className="h-20 flex flex-col items-center justify-center">
                    <BarChart3 className="w-6 h-6 mb-2" />
                    <span>Analyze Growth</span>
                  </Button>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="strategies">
          <Card>
            <CardHeader>
              <CardTitle>Active Growth Strategies</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {growthStrategies.map((strategy, index) => (
                  <div key={index} className="p-4 border rounded-lg">
                    <div className="flex items-center justify-between mb-3">
                      <div className="flex items-center space-x-3">
                        <h3 className="font-semibold">{strategy.name}</h3>
                        <Badge 
                          variant={
                            strategy.status === 'active' ? 'success' : 
                            strategy.status === 'pending' ? 'warning' : 'default'
                          }
                        >
                          {strategy.status}
                        </Badge>
                      </div>
                      <div className="flex space-x-2">
                        <Button size="sm" variant="outline">
                          <Eye className="w-4 h-4" />
                        </Button>
                        <Button size="sm" variant="outline">
                          <Settings className="w-4 h-4" />
                        </Button>
                      </div>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
                      <div>
                        <span className="text-gray-600">Performance:</span>
                        <p className="font-semibold">{strategy.performance}</p>
                      </div>
                      <div>
                        <span className="text-gray-600">Next Action:</span>
                        <p className="font-semibold">{strategy.nextAction}</p>
                      </div>
                      <div>
                        <span className="text-gray-600">Time Remaining:</span>
                        <p className="font-semibold">{strategy.timeRemaining}</p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="competitors">
          <Card>
            <CardHeader>
              <CardTitle>Competitor Analysis</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b">
                      <th className="text-left py-3">Competitor</th>
                      <th className="text-left py-3">Followers</th>
                      <th className="text-left py-3">Growth Rate</th>
                      <th className="text-left py-3">Engagement</th>
                      <th className="text-left py-3">Gap Analysis</th>
                      <th className="text-left py-3">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {competitorData.map((competitor, index) => (
                      <tr key={index} className="border-b hover:bg-gray-50 dark:hover:bg-gray-800">
                        <td className="py-4">
                          <div className="flex items-center space-x-3">
                            <div className="w-8 h-8 bg-gradient-to-br from-red-500 to-pink-500 rounded-full flex items-center justify-center text-white font-bold text-sm">
                              {competitor.name[0]}
                            </div>
                            <span className="font-semibold">{competitor.name}</span>
                          </div>
                        </td>
                        <td className="py-4 font-semibold">{competitor.followers.toLocaleString()}</td>
                        <td className="py-4">
                          <Badge variant={competitor.growth.startsWith('+') ? 'success' : 'destructive'}>
                            {competitor.growth}
                          </Badge>
                        </td>
                        <td className="py-4">{competitor.engagement}</td>
                        <td className="py-4">
                          <div className="flex items-center space-x-2">
                            {competitor.followers > 90953 ? (
                              <Badge variant="destructive">Behind</Badge>
                            ) : (
                              <Badge variant="success">Ahead</Badge>
                            )}
                          </div>
                        </td>
                        <td className="py-4">
                          <div className="flex space-x-2">
                            <Button size="sm" variant="outline">
                              <Eye className="w-4 h-4" />
                            </Button>
                            <Button size="sm" variant="outline">
                              <Target className="w-4 h-4" />
                            </Button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="activities">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle>Recent Community Activities</CardTitle>
                <div className="flex space-x-2">
                  <Button size="sm" variant="outline">
                    <Filter className="w-4 h-4 mr-2" />
                    Filter
                  </Button>
                  <Button size="sm" variant="outline">
                    <RotateCcw className="w-4 h-4" />
                  </Button>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {recentActivities.map((activity, index) => (
                  <div key={index} className="flex items-start space-x-4 p-4 border rounded-lg">
                    <div className="flex-shrink-0 mt-1">
                      {getActivityIcon(activity.type)}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between">
                        <p className="font-semibold text-sm">{activity.platform}</p>
                        <div className="flex items-center space-x-2">
                          <Badge 
                            variant="outline" 
                            className={getImpactColor(activity.impact)}
                          >
                            {activity.impact} impact
                          </Badge>
                          <span className="text-xs text-gray-500">{activity.time}</span>
                        </div>
                      </div>
                      <p className="text-sm text-gray-600 mt-1">{activity.message}</p>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="analytics">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <Card>
              <CardHeader>
                <CardTitle>Growth Projections</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="h-64 bg-gray-100 dark:bg-gray-800 rounded-lg flex items-center justify-center">
                  <div className="text-center">
                    <BarChart3 className="w-12 h-12 text-gray-400 mx-auto mb-2" />
                    <div className="text-gray-500">Growth projection chart</div>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Engagement Trends</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="h-64 bg-gray-100 dark:bg-gray-800 rounded-lg flex items-center justify-center">
                  <div className="text-center">
                    <Activity className="w-12 h-12 text-gray-400 mx-auto mb-2" />
                    <div className="text-gray-500">Engagement trends chart</div>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Follower Quality Analysis</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div className="flex justify-between items-center">
                    <span className="text-sm">Real Users</span>
                    <div className="flex items-center space-x-2">
                      <Progress value={87} className="w-24 h-2" />
                      <span className="text-sm font-semibold">87%</span>
                    </div>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-sm">Active Followers</span>
                    <div className="flex items-center space-x-2">
                      <Progress value={73} className="w-24 h-2" />
                      <span className="text-sm font-semibold">73%</span>
                    </div>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-sm">Engaged Users</span>
                    <div className="flex items-center space-x-2">
                      <Progress value={45} className="w-24 h-2" />
                      <span className="text-sm font-semibold">45%</span>
                    </div>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-sm">Potential Influencers</span>
                    <div className="flex items-center space-x-2">
                      <Progress value={12} className="w-24 h-2" />
                      <span className="text-sm font-semibold">12%</span>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Community Health Score</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-center">
                  <div className="text-4xl font-bold text-green-600 mb-2">88/100</div>
                  <div className="text-sm text-gray-600 mb-4">Excellent Community Health</div>
                  <div className="space-y-2 text-left">
                    <div className="flex items-center justify-between">
                      <span className="text-sm">Activity Level</span>
                      <Badge variant="success">High</Badge>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-sm">Sentiment</span>
                      <Badge variant="success">Positive</Badge>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-sm">Growth Rate</span>
                      <Badge variant="success">Healthy</Badge>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-sm">Retention</span>
                      <Badge variant="warning">Moderate</Badge>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  )
}