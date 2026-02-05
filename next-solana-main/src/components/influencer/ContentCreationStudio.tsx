'use client'

import React, { useState, useEffect, useCallback, useMemo } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Badge } from '@/components/ui/badge'
import { Progress } from '@/components/ui/progress'
import { Slider } from '@/components/ui/slider'
import { Switch } from '@/components/ui/switch'
import { Label } from '@/components/ui/label'
import { Separator } from '@/components/ui/separator'
import { ScrollArea } from '@/components/ui/scroll-area'
import { 
  Sparkles, 
  TrendingUp, 
  Target, 
  Calendar, 
  Image as ImageIcon, 
  Hash, 
  BarChart3, 
  Zap, 
  Eye, 
  Share2, 
  Heart, 
  MessageCircle,
  Copy,
  Download,
  Upload,
  Wand2,
  Palette,
  Type,
  Layout,
  Clock,
  Users,
  Globe,
  Shuffle,
  RefreshCw,
  Play,
  Pause,
  Settings,
  ChevronDown,
  Plus,
  X,
  Check,
  AlertCircle,
  Info
} from 'lucide-react'

interface MemeTemplate {
  id: string
  name: string
  category: string
  thumbnail: string
  viralScore: number
  usage: number
}

interface ContentVariant {
  id: string
  content: string
  platform: string
  viralScore: number
  engagement: {
    likes: number
    shares: number
    comments: number
  }
}

interface TrendData {
  keyword: string
  score: number
  category: string
  momentum: 'rising' | 'peak' | 'declining'
}

interface ViralMetrics {
  overall: number
  emotion: number
  urgency: number
  curiosity: number
  controversy: number
  timing: number
  hashtags: number
}

const ContentCreationStudio: React.FC = () => {
  // State management
  const [activeTab, setActiveTab] = useState('create')
  const [content, setContent] = useState('')
  const [selectedPlatforms, setSelectedPlatforms] = useState<string[]>(['twitter'])
  const [viralScore, setViralScore] = useState<ViralMetrics>({
    overall: 0,
    emotion: 0,
    urgency: 0,
    curiosity: 0,
    controversy: 0,
    timing: 0,
    hashtags: 0
  })
  const [isGenerating, setIsGenerating] = useState(false)
  const [selectedTemplate, setSelectedTemplate] = useState<MemeTemplate | null>(null)
  const [hashtags, setHashtags] = useState<string[]>([])
  const [suggestedHashtags, setSuggestedHashtags] = useState<string[]>([])
  const [contentVariants, setContentVariants] = useState<ContentVariant[]>([])
  const [trends, setTrends] = useState<TrendData[]>([])
  const [scheduledTime, setScheduledTime] = useState('')
  const [targetAudience, setTargetAudience] = useState('')
  const [contentType, setContentType] = useState('text')
  const [optimizationLevel, setOptimizationLevel] = useState([75])
  const [autoOptimize, setAutoOptimize] = useState(true)
  const [realTimePreview, setRealTimePreview] = useState(true)

  // Mock data
  const memeTemplates: MemeTemplate[] = [
    { id: '1', name: 'Diamond Hands', category: 'crypto', thumbnail: '/templates/diamond-hands.jpg', viralScore: 92, usage: 1250 },
    { id: '2', name: 'To The Moon', category: 'crypto', thumbnail: '/templates/moon.jpg', viralScore: 88, usage: 980 },
    { id: '3', name: 'Wojak Panic', category: 'emotion', thumbnail: '/templates/wojak.jpg', viralScore: 85, usage: 2100 },
    { id: '4', name: 'Chad Yes', category: 'reaction', thumbnail: '/templates/chad.jpg', viralScore: 90, usage: 1800 },
    { id: '5', name: 'This Is Fine', category: 'situation', thumbnail: '/templates/fine.jpg', viralScore: 87, usage: 1600 }
  ]

  const platforms = [
    { id: 'twitter', name: 'Twitter/X', icon: '𝕏', color: 'bg-black' },
    { id: 'discord', name: 'Discord', icon: '💬', color: 'bg-indigo-600' },
    { id: 'telegram', name: 'Telegram', icon: '✈️', color: 'bg-blue-500' },
    { id: 'reddit', name: 'Reddit', icon: '🔴', color: 'bg-orange-600' }
  ]

  // Real-time viral score calculation
  const calculateViralScore = useCallback((text: string) => {
    const words = text.toLowerCase().split(' ')
    
    // Emotion detection
    const emotionWords = ['amazing', 'incredible', 'shocking', 'unbelievable', 'insane', 'crazy', 'wild']
    const emotionScore = Math.min(100, (words.filter(w => emotionWords.includes(w)).length / words.length) * 500)
    
    // Urgency detection
    const urgencyWords = ['now', 'urgent', 'breaking', 'alert', 'immediate', 'quick', 'fast']
    const urgencyScore = Math.min(100, (words.filter(w => urgencyWords.includes(w)).length / words.length) * 400)
    
    // Curiosity detection
    const curiosityWords = ['secret', 'hidden', 'revealed', 'discovered', 'unknown', 'mystery']
    const curiosityScore = Math.min(100, (words.filter(w => curiosityWords.includes(w)).length / words.length) * 300)
    
    // Controversy detection
    const controversyWords = ['controversial', 'banned', 'censored', 'forbidden', 'exposed']
    const controversyScore = Math.min(100, (words.filter(w => controversyWords.includes(w)).length / words.length) * 200)
    
    // Timing score (based on current trends)
    const timingScore = Math.random() * 100 // Would be calculated based on real trend data
    
    // Hashtag score
    const hashtagCount = (text.match(/#\w+/g) || []).length
    const hashtagScore = Math.min(100, hashtagCount * 15)
    
    const overall = (emotionScore + urgencyScore + curiosityScore + controversyScore + timingScore + hashtagScore) / 6
    
    return {
      overall: Math.round(overall),
      emotion: Math.round(emotionScore),
      urgency: Math.round(urgencyScore),
      curiosity: Math.round(curiosityScore),
      controversy: Math.round(controversyScore),
      timing: Math.round(timingScore),
      hashtags: Math.round(hashtagScore)
    }
  }, [])

  // Update viral score when content changes
  useEffect(() => {
    if (content && realTimePreview) {
      const score = calculateViralScore(content)
      setViralScore(score)
      
      // Generate hashtag suggestions
      const words = content.toLowerCase().split(' ')
      const suggestions = ['#crypto', '#solana', '#defi', '#nft', '#web3', '#blockchain']
        .filter(tag => !hashtags.includes(tag))
        .slice(0, 5)
      setSuggestedHashtags(suggestions)
    }
  }, [content, hashtags, realTimePreview, calculateViralScore])

  // Mock trend data
  useEffect(() => {
    setTrends([
      { keyword: 'AI agents', score: 95, category: 'tech', momentum: 'rising' },
      { keyword: 'Solana memes', score: 88, category: 'crypto', momentum: 'peak' },
      { keyword: 'DeFi summer', score: 72, category: 'crypto', momentum: 'declining' },
      { keyword: 'NFT utility', score: 65, category: 'nft', momentum: 'rising' }
    ])
  }, [])

  const generateContent = async () => {
    setIsGenerating(true)
    
    // Simulate AI content generation
    await new Promise(resolve => setTimeout(resolve, 2000))
    
    const generatedContent = `🚀 Just discovered this INSANE AI agent that's making $10k/day trading Solana! 
    
The secret? It uses advanced sentiment analysis to predict market moves before they happen. 

This is the future of crypto trading! 🤖💰

#SolanaAI #CryptoTrading #AIAgent #DeFi #Web3`

    setContent(generatedContent)
    
    // Generate variants for A/B testing
    const variants: ContentVariant[] = [
      {
        id: '1',
        content: generatedContent,
        platform: 'twitter',
        viralScore: 92,
        engagement: { likes: 1250, shares: 340, comments: 89 }
      },
      {
        id: '2',
        content: generatedContent.replace('INSANE', 'AMAZING'),
        platform: 'twitter',
        viralScore: 87,
        engagement: { likes: 980, shares: 280, comments: 65 }
      }
    ]
    
    setContentVariants(variants)
    setIsGenerating(false)
  }

  const optimizeContent = () => {
    // Simulate content optimization
    const optimized = content + '\n\n🔥 Don\'t miss out on this opportunity!'
    setContent(optimized)
  }

  const addHashtag = (tag: string) => {
    if (!hashtags.includes(tag)) {
      setHashtags([...hashtags, tag])
      setSuggestedHashtags(suggestedHashtags.filter(t => t !== tag))
    }
  }

  const removeHashtag = (tag: string) => {
    setHashtags(hashtags.filter(t => t !== tag))
  }

  const togglePlatform = (platformId: string) => {
    setSelectedPlatforms(prev => 
      prev.includes(platformId) 
        ? prev.filter(p => p !== platformId)
        : [...prev, platformId]
    )
  }

  const getViralScoreColor = (score: number) => {
    if (score >= 80) return 'text-green-500'
    if (score >= 60) return 'text-yellow-500'
    return 'text-red-500'
  }

  const getViralScoreBackground = (score: number) => {
    if (score >= 80) return 'bg-green-500'
    if (score >= 60) return 'bg-yellow-500'
    return 'bg-red-500'
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-900/20 via-blue-900/20 to-indigo-900/20 p-6">
      <div className="max-w-7xl mx-auto space-y-6">
        {/* Header */}
        <div className="text-center space-y-2">
          <h1 className="text-4xl font-bold bg-gradient-to-r from-purple-400 to-pink-400 bg-clip-text text-transparent">
            Content Creation Studio
          </h1>
          <p className="text-muted-foreground">
            Create viral content with AI-powered optimization and real-time analytics
          </p>
        </div>

        <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
          <TabsList className="grid w-full grid-cols-4">
            <TabsTrigger value="create" className="flex items-center gap-2">
              <Wand2 className="w-4 h-4" />
              Create
            </TabsTrigger>
            <TabsTrigger value="optimize" className="flex items-center gap-2">
              <Zap className="w-4 h-4" />
              Optimize
            </TabsTrigger>
            <TabsTrigger value="schedule" className="flex items-center gap-2">
              <Calendar className="w-4 h-4" />
              Schedule
            </TabsTrigger>
            <TabsTrigger value="analytics" className="flex items-center gap-2">
              <BarChart3 className="w-4 h-4" />
              Analytics
            </TabsTrigger>
          </TabsList>

          {/* Create Tab */}
          <TabsContent value="create" className="space-y-6">
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              {/* Content Creation Panel */}
              <div className="lg:col-span-2 space-y-6">
                <Card className="backdrop-blur-sm bg-white/5 border-white/10">
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <Type className="w-5 h-5" />
                      Content Creation
                    </CardTitle>
                    <CardDescription>
                      Write your content or generate it with AI
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="flex gap-2">
                      <Select value={contentType} onValueChange={setContentType}>
                        <SelectTrigger className="w-40">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="text">Text Post</SelectItem>
                          <SelectItem value="meme">Meme</SelectItem>
                          <SelectItem value="thread">Thread</SelectItem>
                          <SelectItem value="story">Story</SelectItem>
                        </SelectContent>
                      </Select>
                      <Button 
                        onClick={generateContent} 
                        disabled={isGenerating}
                        className="flex items-center gap-2"
                      >
                        {isGenerating ? (
                          <RefreshCw className="w-4 h-4 animate-spin" />
                        ) : (
                          <Sparkles className="w-4 h-4" />
                        )}
                        {isGenerating ? 'Generating...' : 'Generate AI Content'}
                      </Button>
                    </div>

                    <Textarea
                      placeholder="Write your viral content here..."
                      value={content}
                      onChange={(e) => setContent(e.target.value)}
                      className="min-h-40 resize-none"
                    />

                    {/* Platform Selection */}
                    <div className="space-y-2">
                      <Label>Target Platforms</Label>
                      <div className="flex flex-wrap gap-2">
                        {platforms.map(platform => (
                          <Button
                            key={platform.id}
                            variant={selectedPlatforms.includes(platform.id) ? "default" : "outline"}
                            size="sm"
                            onClick={() => togglePlatform(platform.id)}
                            className="flex items-center gap-2"
                          >
                            <span>{platform.icon}</span>
                            {platform.name}
                          </Button>
                        ))}
                      </div>
                    </div>

                    {/* Hashtag Management */}
                    <div className="space-y-2">
                      <Label>Hashtags</Label>
                      <div className="flex flex-wrap gap-2 mb-2">
                        {hashtags.map(tag => (
                          <Badge key={tag} variant="secondary" className="flex items-center gap-1">
                            {tag}
                            <X 
                              className="w-3 h-3 cursor-pointer" 
                              onClick={() => removeHashtag(tag)}
                            />
                          </Badge>
                        ))}
                      </div>
                      <div className="flex flex-wrap gap-2">
                        {suggestedHashtags.map(tag => (
                          <Button
                            key={tag}
                            variant="outline"
                            size="sm"
                            onClick={() => addHashtag(tag)}
                            className="h-6 text-xs"
                          >
                            <Plus className="w-3 h-3 mr-1" />
                            {tag}
                          </Button>
                        ))}
                      </div>
                    </div>
                  </CardContent>
                </Card>

                {/* Meme Templates */}
                {contentType === 'meme' && (
                  <Card className="backdrop-blur-sm bg-white/5 border-white/10">
                    <CardHeader>
                      <CardTitle className="flex items-center gap-2">
                        <ImageIcon className="w-5 h-5" />
                        Meme Templates
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                        {memeTemplates.map(template => (
                          <div
                            key={template.id}
                            className={`relative cursor-pointer rounded-lg border-2 transition-all ${
                              selectedTemplate?.id === template.id 
                                ? 'border-purple-500 bg-purple-500/10' 
                                : 'border-white/10 hover:border-white/20'
                            }`}
                            onClick={() => setSelectedTemplate(template)}
                          >
                            <div className="aspect-square bg-gradient-to-br from-gray-800 to-gray-900 rounded-lg flex items-center justify-center">
                              <span className="text-2xl">{template.name.split(' ')[0]}</span>
                            </div>
                            <div className="p-2">
                              <p className="text-sm font-medium">{template.name}</p>
                              <div className="flex justify-between text-xs text-muted-foreground">
                                <span>Score: {template.viralScore}</span>
                                <span>{template.usage} uses</span>
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    </CardContent>
                  </Card>
                )}
              </div>

              {/* Viral Score Panel */}
              <div className="space-y-6">
                <Card className="backdrop-blur-sm bg-white/5 border-white/10">
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <TrendingUp className="w-5 h-5" />
                      Viral Score
                      <Badge className={`ml-auto ${getViralScoreBackground(viralScore.overall)} text-white`}>
                        {viralScore.overall}%
                      </Badge>
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="space-y-3">
                      {Object.entries(viralScore).map(([key, value]) => {
                        if (key === 'overall') return null
                        return (
                          <div key={key} className="space-y-1">
                            <div className="flex justify-between text-sm">
                              <span className="capitalize">{key}</span>
                              <span className={getViralScoreColor(value)}>{value}%</span>
                            </div>
                            <Progress value={value} className="h-2" />
                          </div>
                        )
                      })}
                    </div>

                    <Separator />

                    <div className="space-y-2">
                      <div className="flex items-center justify-between">
                        <Label htmlFor="auto-optimize">Auto Optimize</Label>
                        <Switch
                          id="auto-optimize"
                          checked={autoOptimize}
                          onCheckedChange={setAutoOptimize}
                        />
                      </div>
                      <div className="flex items-center justify-between">
                        <Label htmlFor="real-time">Real-time Preview</Label>
                        <Switch
                          id="real-time"
                          checked={realTimePreview}
                          onCheckedChange={setRealTimePreview}
                        />
                      </div>
                    </div>

                    <Button onClick={optimizeContent} className="w-full">
                      <Zap className="w-4 h-4 mr-2" />
                      Optimize Content
                    </Button>
                  </CardContent>
                </Card>

                {/* Trending Topics */}
                <Card className="backdrop-blur-sm bg-white/5 border-white/10">
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <Hash className="w-5 h-5" />
                      Trending Now
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-3">
                      {trends.map((trend, index) => (
                        <div key={index} className="flex items-center justify-between">
                          <div>
                            <p className="text-sm font-medium">{trend.keyword}</p>
                            <p className="text-xs text-muted-foreground">{trend.category}</p>
                          </div>
                          <div className="flex items-center gap-2">
                            <Badge 
                              variant={trend.momentum === 'rising' ? 'default' : 
                                      trend.momentum === 'peak' ? 'secondary' : 'outline'}
                              className="text-xs"
                            >
                              {trend.momentum}
                            </Badge>
                            <span className="text-sm font-medium">{trend.score}</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              </div>
            </div>
          </TabsContent>

          {/* Optimize Tab */}
          <TabsContent value="optimize" className="space-y-6">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <Card className="backdrop-blur-sm bg-white/5 border-white/10">
                <CardHeader>
                  <CardTitle>A/B Testing Variants</CardTitle>
                  <CardDescription>
                    Compare different versions of your content
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    {contentVariants.map(variant => (
                      <div key={variant.id} className="border rounded-lg p-4 space-y-3">
                        <div className="flex justify-between items-start">
                          <Badge>Variant {variant.id}</Badge>
                          <Badge className={getViralScoreBackground(variant.viralScore)}>
                            {variant.viralScore}%
                          </Badge>
                        </div>
                        <p className="text-sm">{variant.content.substring(0, 100)}...</p>
                        <div className="flex gap-4 text-xs text-muted-foreground">
                          <span className="flex items-center gap-1">
                            <Heart className="w-3 h-3" />
                            {variant.engagement.likes}
                          </span>
                          <span className="flex items-center gap-1">
                            <Share2 className="w-3 h-3" />
                            {variant.engagement.shares}
                          </span>
                          <span className="flex items-center gap-1">
                            <MessageCircle className="w-3 h-3" />
                            {variant.engagement.comments}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>

              <Card className="backdrop-blur-sm bg-white/5 border-white/10">
                <CardHeader>
                  <CardTitle>Optimization Settings</CardTitle>
                </CardHeader>
                <CardContent className="space-y-6">
                  <div className="space-y-2">
                    <Label>Optimization Level</Label>
                    <Slider
                      value={optimizationLevel}
                      onValueChange={setOptimizationLevel}
                      max={100}
                      step={1}
                      className="w-full"
                    />
                    <div className="flex justify-between text-xs text-muted-foreground">
                      <span>Conservative</span>
                      <span>Aggressive</span>
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label>Target Audience</Label>
                    <Select value={targetAudience} onValueChange={setTargetAudience}>
                      <SelectTrigger>
                        <SelectValue placeholder="Select audience" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="crypto-natives">Crypto Natives</SelectItem>
                        <SelectItem value="defi-users">DeFi Users</SelectItem>
                        <SelectItem value="nft-collectors">NFT Collectors</SelectItem>
                        <SelectItem value="general-crypto">General Crypto</SelectItem>
                        <SelectItem value="mainstream">Mainstream</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <Button variant="outline" className="flex items-center gap-2">
                      <Shuffle className="w-4 h-4" />
                      Randomize
                    </Button>
                    <Button className="flex items-center gap-2">
                      <Play className="w-4 h-4" />
                      Run Test
                    </Button>
                  </div>
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          {/* Schedule Tab */}
          <TabsContent value="schedule" className="space-y-6">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <Card className="backdrop-blur-sm bg-white/5 border-white/10">
                <CardHeader>
                  <CardTitle>Schedule Content</CardTitle>
                  <CardDescription>
                    Optimize posting times for maximum engagement
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="space-y-2">
                    <Label>Scheduled Time</Label>
                    <Input
                      type="datetime-local"
                      value={scheduledTime}
                      onChange={(e) => setScheduledTime(e.target.value)}
                    />
                  </div>

                  <div className="space-y-2">
                    <Label>Posting Frequency</Label>
                    <Select>
                      <SelectTrigger>
                        <SelectValue placeholder="Select frequency" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="once">One-time</SelectItem>
                        <SelectItem value="daily">Daily</SelectItem>
                        <SelectItem value="weekly">Weekly</SelectItem>
                        <SelectItem value="optimal">Auto-optimal</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="flex gap-2">
                    <Button className="flex-1">
                      <Calendar className="w-4 h-4 mr-2" />
                      Schedule
                    </Button>
                    <Button variant="outline">
                      <Clock className="w-4 h-4 mr-2" />
                      Optimal Time
                    </Button>
                  </div>
                </CardContent>
              </Card>

              <Card className="backdrop-blur-sm bg-white/5 border-white/10">
                <CardHeader>
                  <CardTitle>Platform Preview</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    {selectedPlatforms.map(platformId => {
                      const platform = platforms.find(p => p.id === platformId)
                      return (
                        <div key={platformId} className="border rounded-lg p-4">
                          <div className="flex items-center gap-2 mb-3">
                            <span>{platform?.icon}</span>
                            <span className="font-medium">{platform?.name}</span>
                          </div>
                          <div className="bg-black/20 rounded p-3 text-sm">
                            {content || 'Your content will appear here...'}
                          </div>
                          <div className="flex justify-between mt-2 text-xs text-muted-foreground">
                            <span>Character limit: {content.length}/280</span>
                            <span>Estimated reach: 1.2k</span>
                          </div>
                        </div>
                      )
                    })}
                  </div>
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          {/* Analytics Tab */}
          <TabsContent value="analytics" className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <Card className="backdrop-blur-sm bg-white/5 border-white/10">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Eye className="w-5 h-5" />
                    Reach
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-3xl font-bold">12.5K</div>
                  <p className="text-sm text-green-500">+15% from last week</p>
                </CardContent>
              </Card>

              <Card className="backdrop-blur-sm bg-white/5 border-white/10">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Heart className="w-5 h-5" />
                    Engagement
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-3xl font-bold">8.2%</div>
                  <p className="text-sm text-green-500">+2.1% from last week</p>
                </CardContent>
              </Card>

              <Card className="backdrop-blur-sm bg-white/5 border-white/10">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Users className="w-5 h-5" />
                    Followers
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-3xl font-bold">2.1K</div>
                  <p className="text-sm text-green-500">+127 this week</p>
                </CardContent>
              </Card>
            </div>

            <Card className="backdrop-blur-sm bg-white/5 border-white/10">
              <CardHeader>
                <CardTitle>Performance Insights</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div className="flex items-center gap-3 p-3 bg-green-500/10 border border-green-500/20 rounded-lg">
                    <Check className="w-5 h-5 text-green-500" />
                    <div>
                      <p className="font-medium">High-performing content detected</p>
                      <p className="text-sm text-muted-foreground">
                        Your meme posts are getting 3x more engagement than average
                      </p>
                    </div>
                  </div>
                  
                  <div className="flex items-center gap-3 p-3 bg-yellow-500/10 border border-yellow-500/20 rounded-lg">
                    <AlertCircle className="w-5 h-5 text-yellow-500" />
                    <div>
                      <p className="font-medium">Optimization opportunity</p>
                      <p className="text-sm text-muted-foreground">
                        Consider posting between 2-4 PM for better reach
                      </p>
                    </div>
                  </div>
                  
                  <div className="flex items-center gap-3 p-3 bg-blue-500/10 border border-blue-500/20 rounded-lg">
                    <Info className="w-5 h-5 text-blue-500" />
                    <div>
                      <p className="font-medium">Trending hashtag suggestion</p>
                      <p className="text-sm text-muted-foreground">
                        #SolanaAI is trending - consider including it in your next post
                      </p>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  )
}

export default ContentCreationStudio