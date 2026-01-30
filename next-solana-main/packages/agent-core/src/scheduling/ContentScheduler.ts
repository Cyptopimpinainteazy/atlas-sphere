import { EventEmitter } from 'events'

// Core Types
export interface ContentItem {
  id: string
  content: string
  mediaUrls?: string[]
  hashtags?: string[]
  platform: Platform
  contentType: ContentType
  priority: number
  viralScore?: number
  targetAudience?: string[]
  metadata?: Record<string, any>
  createdAt: Date
  expiresAt?: Date
}

export interface ScheduledContent extends ContentItem {
  scheduledFor: Date
  timezone: string
  campaignId?: string
  abTestVariant?: string
  retryCount: number
  status: ScheduleStatus
}

export interface EngagementMetrics {
  impressions: number
  likes: number
  shares: number
  comments: number
  clicks: number
  saves?: number
  watchTime?: number
  reachRate: number
  engagementRate: number
  viralityScore: number
  // Timestamp when these metrics were recorded (some code expects this)
  timestamp?: Date
}

export interface TimeSlot {
  hour: number
  dayOfWeek: number
  platform: Platform
  timezone: string
  averageEngagement: number
  confidence: number
  sampleSize: number
  lastUpdated: Date
}

export interface PlatformLimits {
  platform: Platform
  maxPostsPerHour: number
  maxPostsPerDay: number
  minIntervalMinutes: number
  optimalFrequency: number
  peakHours: number[]
  restrictions: string[]
}

export interface ABTestConfig {
  enabled: boolean
  variants: string[]
  trafficSplit: number[]
  duration: number
  metric: string
  confidenceThreshold: number
}

export interface TrendData {
  keyword: string
  platform: Platform
  trendScore: number
  velocity: number
  peakTime?: Date
  category: string
  sentiment: number
  relatedTopics: string[]
}

export interface MarketCondition {
  sentiment: 'bullish' | 'bearish' | 'neutral'
  volatility: number
  trendingTopics: string[]
  fearGreedIndex: number
  socialVolume: number
  timestamp: Date
}

export type Platform = 'twitter' | 'discord' | 'telegram' | 'instagram' | 'tiktok' | 'youtube'
export type ContentType = 'text' | 'image' | 'video' | 'meme' | 'thread' | 'poll'
export type ScheduleStatus = 'pending' | 'scheduled' | 'published' | 'failed' | 'cancelled'

// Machine Learning Models
class EngagementPredictor {
  private weights: Map<string, number> = new Map()
  private learningRate = 0.01
  private features: string[] = [
    'hour',
    'dayOfWeek',
    'contentLength',
    'hashtagCount',
    'viralScore',
    'sentiment',
    'trendAlignment',
    'audienceSize',
    'recentEngagement',
  ]

  constructor() {
    // Initialize weights
    this.features.forEach((feature) => {
      this.weights.set(feature, Math.random() * 0.1)
    })
  }

  extractFeatures(content: ContentItem, timeSlot: TimeSlot, trends: TrendData[], market: MarketCondition): number[] {
    const features: number[] = []

    // Time features
    features.push(timeSlot.hour / 24)
    features.push(timeSlot.dayOfWeek / 7)

    // Content features
    features.push(Math.min(content.content.length / 280, 1))
    features.push(Math.min((content.hashtags?.length || 0) / 10, 1))
    features.push(content.viralScore || 0)

    // Market features
    features.push((market.sentiment === 'bullish' ? 1 : market.sentiment === 'bearish' ? -1 : 0) * 0.5 + 0.5)

    // Trend alignment
    const trendAlignment = this.calculateTrendAlignment(content, trends)
    features.push(trendAlignment)

    // Historical performance
    features.push(timeSlot.averageEngagement)
    features.push(timeSlot.confidence)

    return features
  }

  predict(features: number[]): number {
    let prediction = 0
    features.forEach((feature, index) => {
      const weight = this.weights.get(this.features[index]) || 0
      prediction += feature * weight
    })
    return Math.max(0, Math.min(1, prediction))
  }

  train(features: number[], actualEngagement: number) {
    const prediction = this.predict(features)
    const error = actualEngagement - prediction

    // Update weights using gradient descent
    features.forEach((feature, index) => {
      const currentWeight = this.weights.get(this.features[index]) || 0
      const newWeight = currentWeight + this.learningRate * error * feature
      this.weights.set(this.features[index], newWeight)
    })
  }

  private calculateTrendAlignment(content: ContentItem, trends: TrendData[]): number {
    if (!trends.length) return 0

    const contentWords = content.content.toLowerCase().split(/\s+/)
    const hashtags = content.hashtags?.map((h) => h.toLowerCase()) || []
    const allTerms = [...contentWords, ...hashtags]

    let maxAlignment = 0
    trends.forEach((trend) => {
      const trendWords = trend.keyword.toLowerCase().split(/\s+/)
      const overlap = trendWords.filter((word) => allTerms.includes(word)).length
      const alignment = (overlap / trendWords.length) * trend.trendScore
      maxAlignment = Math.max(maxAlignment, alignment)
    })

    return Math.min(maxAlignment, 1)
  }
}

class UCBBandit {
  private arms: Map<string, { pulls: number; totalReward: number; lastUpdated: Date }> = new Map()
  private c = 1.4 // Exploration parameter

  selectArm(availableArms: string[]): string {
    const totalPulls = Array.from(this.arms.values()).reduce((sum, arm) => sum + arm.pulls, 0)

    if (totalPulls === 0) {
      return availableArms[Math.floor(Math.random() * availableArms.length)]
    }

    let bestArm = availableArms[0]
    let bestValue = -Infinity

    availableArms.forEach((arm) => {
      const armData = this.arms.get(arm) || { pulls: 0, totalReward: 0, lastUpdated: new Date() }

      if (armData.pulls === 0) {
        bestArm = arm
        return
      }

      const avgReward = armData.totalReward / armData.pulls
      const confidence = Math.sqrt((this.c * Math.log(totalPulls)) / armData.pulls)
      const ucbValue = avgReward + confidence

      if (ucbValue > bestValue) {
        bestValue = ucbValue
        bestArm = arm
      }
    })

    return bestArm
  }

  updateReward(arm: string, reward: number) {
    const armData = this.arms.get(arm) || { pulls: 0, totalReward: 0, lastUpdated: new Date() }
    armData.pulls += 1
    armData.totalReward += reward
    armData.lastUpdated = new Date()
    this.arms.set(arm, armData)
  }

  getArmStats(): Map<string, { avgReward: number; pulls: number; confidence: number }> {
    const stats = new Map()
    const totalPulls = Array.from(this.arms.values()).reduce((sum, arm) => sum + arm.pulls, 0)

    this.arms.forEach((armData, arm) => {
      const avgReward = armData.pulls > 0 ? armData.totalReward / armData.pulls : 0
      const confidence = armData.pulls > 0 ? Math.sqrt((this.c * Math.log(totalPulls)) / armData.pulls) : 1
      stats.set(arm, { avgReward, pulls: armData.pulls, confidence })
    })

    return stats
  }
}

// Main ContentScheduler Class
export class ContentScheduler extends EventEmitter {
  private contentQueue: ContentItem[] = []
  private scheduledContent: Map<string, ScheduledContent> = new Map()
  private timeSlots: Map<string, TimeSlot> = new Map()
  private platformLimits: Map<Platform, PlatformLimits> = new Map()
  private engagementHistory: Map<string, EngagementMetrics[]> = new Map()
  private abTests: Map<string, ABTestConfig> = new Map()
  private predictor: EngagementPredictor
  private timingBandit: UCBBandit
  private platformBandits: Map<Platform, UCBBandit> = new Map()
  private isRunning = false
  private schedulerInterval?: NodeJS.Timeout

  constructor() {
    super()
    this.predictor = new EngagementPredictor()
    this.timingBandit = new UCBBandit()
    this.initializePlatformLimits()
    this.initializePlatformBandits()
  }

  // Core Scheduling Methods
  async scheduleContent(
    content: ContentItem,
    options?: {
      preferredTime?: Date
      timezone?: string
      campaignId?: string
      abTest?: boolean
    },
  ): Promise<ScheduledContent> {
    const timezone = options?.timezone || 'UTC'
    const optimalTime = await this.findOptimalTime(content, timezone, options?.preferredTime)

    const scheduledContent: ScheduledContent = {
      ...content,
      scheduledFor: optimalTime,
      timezone,
      campaignId: options?.campaignId,
      abTestVariant: options?.abTest ? this.selectABVariant(content) : undefined,
      retryCount: 0,
      status: 'scheduled',
    }

    this.scheduledContent.set(content.id, scheduledContent)
    this.emit('contentScheduled', scheduledContent)

    return scheduledContent
  }

  async analyzeOptimalTimes(platform: Platform, timezone: string, lookbackDays = 30): Promise<TimeSlot[]> {
    const now = new Date()
    const lookbackStart = new Date(now.getTime() - lookbackDays * 24 * 60 * 60 * 1000)

    const platformHistory = this.engagementHistory.get(platform) || []
    const recentHistory = platformHistory.filter((h) => (h.timestamp ?? new Date(0)) >= lookbackStart)

    // Group by hour and day of week
    const timeSlotMap = new Map<string, { engagements: number[]; count: number }>()

    recentHistory.forEach((engagement) => {
      if (!engagement.timestamp) return // skip entries without timestamp
      const date = new Date(engagement.timestamp)
      const hour = date.getHours()
      const dayOfWeek = date.getDay()
      const key = `${hour}-${dayOfWeek}`

      if (!timeSlotMap.has(key)) {
        timeSlotMap.set(key, { engagements: [], count: 0 })
      }

      const slot = timeSlotMap.get(key)!
      slot.engagements.push(engagement.engagementRate)
      slot.count += 1
    })

    // Convert to TimeSlot objects
    const timeSlots: TimeSlot[] = []
    timeSlotMap.forEach((data, key) => {
      const [hour, dayOfWeek] = key.split('-').map(Number)
      const averageEngagement = data.engagements.reduce((sum, e) => sum + e, 0) / data.engagements.length
      const variance =
        data.engagements.reduce((sum, e) => sum + Math.pow(e - averageEngagement, 2), 0) / data.engagements.length
      const confidence = Math.max(0, 1 - variance / averageEngagement)

      timeSlots.push({
        hour,
        dayOfWeek,
        platform,
        timezone,
        averageEngagement,
        confidence,
        sampleSize: data.count,
        lastUpdated: now,
      })
    })

    return timeSlots.sort((a, b) => b.averageEngagement - a.averageEngagement)
  }

  async adaptToTimezones(content: ContentItem, targetTimezones: string[]): Promise<ScheduledContent[]> {
    const scheduledItems: ScheduledContent[] = []

    for (const timezone of targetTimezones) {
      const adaptedContent = { ...content, id: `${content.id}-${timezone}` }
      const scheduled = await this.scheduleContent(adaptedContent, { timezone })
      scheduledItems.push(scheduled)
    }

    return scheduledItems
  }

  async optimizeFrequency(
    platform: Platform,
    targetEngagement: number,
  ): Promise<{
    optimalFrequency: number
    expectedEngagement: number
    confidence: number
  }> {
    const history = this.engagementHistory.get(platform) || []
    if (history.length < 10) {
      return { optimalFrequency: 4, expectedEngagement: 0.05, confidence: 0.1 }
    }

    // Analyze frequency vs engagement correlation
    const frequencyBuckets = new Map<number, number[]>()

    // Group by posting frequency (posts per day)
    for (let i = 0; i < history.length - 1; i++) {
      const current = history[i]
      const next = history[i + 1]
      if (!current.timestamp || !next.timestamp) continue
      const timeDiff = (next.timestamp.getTime() - current.timestamp.getTime()) / (1000 * 60 * 60 * 24)
      const frequency = Math.round(1 / timeDiff)

      if (!frequencyBuckets.has(frequency)) {
        frequencyBuckets.set(frequency, [])
      }
      frequencyBuckets.get(frequency)!.push(current.engagementRate)
    }

    // Find optimal frequency
    let bestFrequency = 4
    let bestEngagement = 0
    let bestConfidence = 0

    frequencyBuckets.forEach((engagements, frequency) => {
      const avgEngagement = engagements.reduce((sum, e) => sum + e, 0) / engagements.length
      const confidence = Math.min(engagements.length / 10, 1)

      if (avgEngagement >= targetEngagement && confidence > bestConfidence) {
        bestFrequency = frequency
        bestEngagement = avgEngagement
        bestConfidence = confidence
      }
    })

    return {
      optimalFrequency: bestFrequency,
      expectedEngagement: bestEngagement,
      confidence: bestConfidence,
    }
  }

  // Queue Management
  addToQueue(content: ContentItem, priority?: number): void {
    if (priority !== undefined) {
      content.priority = priority
    }

    this.contentQueue.push(content)
    this.contentQueue.sort((a, b) => b.priority - a.priority)
    this.emit('contentQueued', content)
  }

  removeFromQueue(contentId: string): boolean {
    const index = this.contentQueue.findIndex((c) => c.id === contentId)
    if (index !== -1) {
      const removed = this.contentQueue.splice(index, 1)[0]
      this.emit('contentRemoved', removed)
      return true
    }
    return false
  }

  getQueueStatus(): {
    totalItems: number
    byPlatform: Map<Platform, number>
    byPriority: Map<number, number>
  } {
    const byPlatform = new Map<Platform, number>()
    const byPriority = new Map<number, number>()

    this.contentQueue.forEach((content) => {
      byPlatform.set(content.platform, (byPlatform.get(content.platform) || 0) + 1)
      byPriority.set(content.priority, (byPriority.get(content.priority) || 0) + 1)
    })

    return {
      totalItems: this.contentQueue.length,
      byPlatform,
      byPriority,
    }
  }

  // A/B Testing
  setupABTest(contentId: string, config: ABTestConfig): void {
    this.abTests.set(contentId, config)
    this.emit('abTestCreated', { contentId, config })
  }

  private selectABVariant(content: ContentItem): string {
    const config = this.abTests.get(content.id)
    if (!config || !config.enabled) return 'A'

    const random = Math.random()
    let cumulative = 0

    for (let i = 0; i < config.variants.length; i++) {
      cumulative += config.trafficSplit[i]
      if (random <= cumulative) {
        return config.variants[i]
      }
    }

    return config.variants[0]
  }

  // Cross-Platform Coordination
  async coordinateCrossPlatform(
    content: ContentItem[],
    strategy: 'simultaneous' | 'staggered' | 'cascade',
  ): Promise<ScheduledContent[]> {
    const scheduled: ScheduledContent[] = []

    switch (strategy) {
      case 'simultaneous':
        const baseTime = await this.findOptimalTime(content[0], 'UTC')
        for (const item of content) {
          const scheduledItem = await this.scheduleContent(item, { preferredTime: baseTime })
          scheduled.push(scheduledItem)
        }
        break

      case 'staggered':
        let currentTime = new Date()
        for (const item of content) {
          const scheduledItem = await this.scheduleContent(item, { preferredTime: currentTime })
          scheduled.push(scheduledItem)
          currentTime = new Date(currentTime.getTime() + 30 * 60 * 1000) // 30 min intervals
        }
        break

      case 'cascade':
        // Schedule based on platform reach and engagement potential
        const sortedContent = content.sort((a, b) => {
          const aLimits = this.platformLimits.get(a.platform)
          const bLimits = this.platformLimits.get(b.platform)
          return (bLimits?.optimalFrequency || 0) - (aLimits?.optimalFrequency || 0)
        })

        let cascadeTime = new Date()
        for (const item of sortedContent) {
          const scheduledItem = await this.scheduleContent(item, { preferredTime: cascadeTime })
          scheduled.push(scheduledItem)
          cascadeTime = new Date(cascadeTime.getTime() + 60 * 60 * 1000) // 1 hour intervals
        }
        break
    }

    return scheduled
  }

  // Performance Tracking
  async recordEngagement(contentId: string, metrics: EngagementMetrics): Promise<void> {
    const scheduled = this.scheduledContent.get(contentId)
    if (!scheduled) return

    // Store engagement metrics
    const platformHistory = this.engagementHistory.get(scheduled.platform) || []
    platformHistory.push({ ...metrics, timestamp: new Date() })
    this.engagementHistory.set(scheduled.platform, platformHistory)

    // Update ML models
    const timeSlotKey = this.getTimeSlotKey(scheduled.scheduledFor, scheduled.platform, scheduled.timezone)
    const slot = this.getTimeSlot(timeSlotKey) || {
      hour: scheduled.scheduledFor.getHours(),
      dayOfWeek: scheduled.scheduledFor.getDay(),
      platform: scheduled.platform,
      timezone: scheduled.timezone,
      averageEngagement: 0,
      confidence: 0,
      sampleSize: 0,
      lastUpdated: new Date(),
    }
    const features = this.predictor.extractFeatures(scheduled, slot, [], this.getCurrentMarketCondition())
    this.predictor.train(features, metrics.engagementRate)

    // Update bandits
    const timingArm = `${scheduled.scheduledFor.getHours()}-${scheduled.scheduledFor.getDay()}`
    this.timingBandit.updateReward(timingArm, metrics.engagementRate)

    const platformBandit = this.platformBandits.get(scheduled.platform)
    if (platformBandit) {
      platformBandit.updateReward(contentId, metrics.viralityScore)
    }

    // Update time slot statistics
    this.updateTimeSlotStats(scheduled, metrics)

    this.emit('engagementRecorded', { contentId, metrics })
  }

  // Viral Opportunity Detection
  async detectViralOpportunity(
    trends: TrendData[],
    market: MarketCondition,
  ): Promise<{
    opportunity: boolean
    score: number
    recommendedAction: string
    timing: Date
  }> {
    const now = new Date()
    const viralScore = this.calculateViralOpportunityScore(trends, market)

    if (viralScore > 0.7) {
      // High viral potential - recommend immediate action
      return {
        opportunity: true,
        score: viralScore,
        recommendedAction: 'Create and schedule viral content immediately',
        timing: new Date(now.getTime() + 15 * 60 * 1000), // 15 minutes from now
      }
    } else if (viralScore > 0.5) {
      // Moderate potential - schedule for optimal time
      return {
        opportunity: true,
        score: viralScore,
        recommendedAction: 'Prepare viral content for optimal timing',
        timing: await this.findNextOptimalViralWindow(),
      }
    }

    return {
      opportunity: false,
      score: viralScore,
      recommendedAction: 'Monitor trends and wait for better opportunity',
      timing: now,
    }
  }

  // Scheduler Control
  start(): void {
    if (this.isRunning) return

    this.isRunning = true
    this.schedulerInterval = setInterval(() => {
      this.processScheduledContent()
    }, 60000) // Check every minute

    this.emit('schedulerStarted')
  }

  stop(): void {
    if (!this.isRunning) return

    this.isRunning = false
    if (this.schedulerInterval) {
      clearInterval(this.schedulerInterval)
      this.schedulerInterval = undefined
    }

    this.emit('schedulerStopped')
  }

  // Private Helper Methods
  private async findOptimalTime(content: ContentItem, timezone: string, preferredTime?: Date): Promise<Date> {
    const now = new Date()
    const startTime = preferredTime || now

    // Get optimal time slots for this platform
    const timeSlots = await this.analyzeOptimalTimes(content.platform, timezone)
    const platformLimits = this.platformLimits.get(content.platform)

    if (!timeSlots.length || !platformLimits) {
      return new Date(startTime.getTime() + 60 * 60 * 1000) // Default to 1 hour from now
    }

    // Find next available optimal slot
    const currentHour = startTime.getHours()
    const currentDay = startTime.getDay()

    // Use UCB bandit to select among top time slots
    const topSlots = timeSlots.slice(0, 5)
    const slotArms = topSlots.map((slot) => `${slot.hour}-${slot.dayOfWeek}`)
    const selectedArm = this.timingBandit.selectArm(slotArms)
    const [selectedHour, selectedDay] = selectedArm.split('-').map(Number)

    // Calculate next occurrence of selected time slot
    const targetTime = new Date(startTime)
    targetTime.setHours(selectedHour, 0, 0, 0)

    // Adjust for day of week if needed
    const dayDiff = (selectedDay - currentDay + 7) % 7
    if (dayDiff > 0 || (dayDiff === 0 && selectedHour <= currentHour)) {
      targetTime.setDate(targetTime.getDate() + (dayDiff || 7))
    }

    // Ensure we respect platform limits
    return this.adjustForPlatformLimits(targetTime, content.platform)
  }

  private adjustForPlatformLimits(targetTime: Date, platform: Platform): Date {
    const limits = this.platformLimits.get(platform)
    if (!limits) return targetTime

    // Check recent posts to ensure we don't exceed limits
    const recentPosts = Array.from(this.scheduledContent.values())
      .filter((s) => s.platform === platform && s.status === 'scheduled')
      .sort((a, b) => a.scheduledFor.getTime() - b.scheduledFor.getTime())

    let adjustedTime = new Date(targetTime)

    // Ensure minimum interval
    const lastPost = recentPosts[recentPosts.length - 1]
    if (lastPost) {
      const timeDiff = adjustedTime.getTime() - lastPost.scheduledFor.getTime()
      const minInterval = limits.minIntervalMinutes * 60 * 1000

      if (timeDiff < minInterval) {
        adjustedTime = new Date(lastPost.scheduledFor.getTime() + minInterval)
      }
    }

    return adjustedTime
  }

  private calculateViralOpportunityScore(trends: TrendData[], market: MarketCondition): number {
    let score = 0

    // Trend momentum
    const avgTrendScore = trends.reduce((sum, t) => sum + t.trendScore, 0) / trends.length
    score += avgTrendScore * 0.3

    // Market sentiment
    const sentimentScore = market.sentiment === 'bullish' ? 0.8 : market.sentiment === 'bearish' ? 0.6 : 0.4
    score += sentimentScore * 0.2

    // Social volume
    const volumeScore = Math.min(market.socialVolume / 10000, 1)
    score += volumeScore * 0.2

    // Volatility (higher volatility = more viral potential)
    const volatilityScore = Math.min(market.volatility / 100, 1)
    score += volatilityScore * 0.3

    return Math.min(score, 1)
  }

  private async findNextOptimalViralWindow(): Promise<Date> {
    const now = new Date()
    const next24Hours = new Date(now.getTime() + 24 * 60 * 60 * 1000)

    // Find the best time slot in the next 24 hours across all platforms
    let bestTime = now
    let bestScore = 0

    for (let hour = now.getHours(); hour < now.getHours() + 24; hour++) {
      const checkTime = new Date(now)
      checkTime.setHours(hour % 24, 0, 0, 0)
      if (hour >= 24) checkTime.setDate(checkTime.getDate() + 1)

      // Calculate viral potential for this time
      const timeScore = await this.calculateTimeViralPotential(checkTime)

      if (timeScore > bestScore) {
        bestScore = timeScore
        bestTime = checkTime
      }
    }

    return bestTime
  }

  private async calculateTimeViralPotential(time: Date): Promise<number> {
    const hour = time.getHours()
    const dayOfWeek = time.getDay()

    // Base score on historical engagement for this time
    let score = 0

    for (const platform of ['twitter', 'discord', 'telegram'] as Platform[]) {
      const timeSlotKey = this.getTimeSlotKey(time, platform, 'UTC')
      const timeSlot = this.getTimeSlot(timeSlotKey)
      if (timeSlot) {
        score += timeSlot.averageEngagement * timeSlot.confidence
      }
    }

    // Boost for peak hours (typically 9-11 AM and 7-9 PM)
    if ((hour >= 9 && hour <= 11) || (hour >= 19 && hour <= 21)) {
      score *= 1.2
    }

    // Boost for weekdays
    if (dayOfWeek >= 1 && dayOfWeek <= 5) {
      score *= 1.1
    }

    return Math.min(score / 3, 1) // Normalize by number of platforms
  }

  private processScheduledContent(): void {
    const now = new Date()
    const readyToPublish = Array.from(this.scheduledContent.values()).filter(
      (content) => content.status === 'scheduled' && content.scheduledFor <= now,
    )

    readyToPublish.forEach((content) => {
      this.publishContent(content)
    })
  }

  private async publishContent(content: ScheduledContent): Promise<void> {
    try {
      content.status = 'pending'
      this.emit('contentPublishing', content)

      // Here you would integrate with actual platform APIs
      // For now, we'll simulate successful publishing
      await this.simulatePublish(content)

      content.status = 'published'
      this.emit('contentPublished', content)
    } catch (error) {
      content.retryCount += 1
      if (content.retryCount < 3) {
        content.status = 'scheduled'
        content.scheduledFor = new Date(Date.now() + 60 * 60 * 1000) // Retry in 1 hour
      } else {
        content.status = 'failed'
      }
      this.emit('contentPublishError', { content, error })
    }
  }

  private async simulatePublish(content: ScheduledContent): Promise<void> {
    // Simulate API call delay
    await new Promise((resolve) => setTimeout(resolve, 1000))

    // Simulate random failures (5% chance)
    if (Math.random() < 0.05) {
      throw new Error('Simulated publish failure')
    }
  }

  private initializePlatformLimits(): void {
    const limits: PlatformLimits[] = [
      {
        platform: 'twitter',
        maxPostsPerHour: 5,
        maxPostsPerDay: 50,
        minIntervalMinutes: 15,
        optimalFrequency: 8,
        peakHours: [9, 12, 17, 20],
        restrictions: ['character_limit_280', 'media_limit_4'],
      },
      {
        platform: 'discord',
        maxPostsPerHour: 10,
        maxPostsPerDay: 100,
        minIntervalMinutes: 5,
        optimalFrequency: 12,
        peakHours: [14, 18, 21],
        restrictions: ['message_limit_2000', 'embed_limit_10'],
      },
      {
        platform: 'telegram',
        maxPostsPerHour: 20,
        maxPostsPerDay: 200,
        minIntervalMinutes: 3,
        optimalFrequency: 16,
        peakHours: [8, 13, 19, 22],
        restrictions: ['message_limit_4096', 'media_limit_50mb'],
      },
    ]

    limits.forEach((limit) => {
      this.platformLimits.set(limit.platform, limit)
    })
  }

  private initializePlatformBandits(): void {
    const platforms: Platform[] = ['twitter', 'discord', 'telegram', 'instagram', 'tiktok', 'youtube']
    platforms.forEach((platform) => {
      this.platformBandits.set(platform, new UCBBandit())
    })
  }

  private getTimeSlotKey(time: Date, platform: Platform, timezone: string): string {
    return `${platform}-${timezone}-${time.getHours()}-${time.getDay()}`
  }

  private getTimeSlot(key: string): TimeSlot | undefined {
    return this.timeSlots.get(key)
  }

  private updateTimeSlotStats(content: ScheduledContent, metrics: EngagementMetrics): void {
    const key = this.getTimeSlotKey(content.scheduledFor, content.platform, content.timezone)
    const existing = this.timeSlots.get(key)

    if (existing) {
      // Update existing slot with exponential moving average
      const alpha = 0.3
      existing.averageEngagement = alpha * metrics.engagementRate + (1 - alpha) * existing.averageEngagement
      existing.sampleSize += 1
      existing.lastUpdated = new Date()
    } else {
      // Create new time slot
      this.timeSlots.set(key, {
        hour: content.scheduledFor.getHours(),
        dayOfWeek: content.scheduledFor.getDay(),
        platform: content.platform,
        timezone: content.timezone,
        averageEngagement: metrics.engagementRate,
        confidence: 0.1,
        sampleSize: 1,
        lastUpdated: new Date(),
      })
    }
  }

  private getCurrentMarketCondition(): MarketCondition {
    // This would typically fetch real market data
    return {
      sentiment: 'neutral',
      volatility: 50,
      trendingTopics: ['crypto', 'defi', 'nft'],
      fearGreedIndex: 50,
      socialVolume: 5000,
      timestamp: new Date(),
    }
  }

  // Public Getters
  getScheduledContent(): ScheduledContent[] {
    return Array.from(this.scheduledContent.values())
  }

  getEngagementHistory(platform?: Platform): EngagementMetrics[] {
    if (platform) {
      return this.engagementHistory.get(platform) || []
    }

    const allHistory: EngagementMetrics[] = []
    this.engagementHistory.forEach((history) => {
      allHistory.push(...history)
    })

    return allHistory.sort((a, b) => (b.timestamp?.getTime() ?? 0) - (a.timestamp?.getTime() ?? 0))
  }

  getBanditStats(): Map<string, any> {
    const stats = new Map()
    stats.set('timing', this.timingBandit.getArmStats())

    this.platformBandits.forEach((bandit, platform) => {
      stats.set(platform, bandit.getArmStats())
    })

    return stats
  }

  getOptimalTimeSlots(platform: Platform, limit = 10): TimeSlot[] {
    const platformSlots = Array.from(this.timeSlots.values())
      .filter((slot) => slot.platform === platform)
      .sort((a, b) => b.averageEngagement - a.averageEngagement)

    return platformSlots.slice(0, limit)
  }
}

export default ContentScheduler
