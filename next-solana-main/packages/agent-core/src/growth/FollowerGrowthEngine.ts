import { EventEmitter } from 'events'

// Types and interfaces
interface TargetAudience {
  demographics: {
    ageRange: [number, number]
    interests: string[]
    location?: string[]
    language: string[]
  }
  behaviorPatterns: {
    activeHours: number[]
    engagementTypes: ('likes' | 'retweets' | 'comments' | 'shares')[]
    contentPreferences: string[]
  }
  competitorFollowers: {
    username: string
    platform: string
    relevanceScore: number
  }[]
}

interface FollowStrategy {
  id: string
  name: string
  platform: string
  targetCriteria: {
    minFollowers: number
    maxFollowers: number
    engagementRate: number
    recentActivity: boolean
    keywords: string[]
  }
  actions: {
    follow: boolean
    engage: boolean
    comment: boolean
    like: boolean
  }
  timing: {
    delayBetweenActions: [number, number] // min, max seconds
    dailyLimit: number
    activeHours: number[]
  }
  unfollowStrategy: {
    enabled: boolean
    waitDays: number
    conditions: string[]
  }
}

interface GrowthMetrics {
  platform: string
  timeframe: string
  followers: {
    gained: number
    lost: number
    net: number
    growthRate: number
  }
  engagement: {
    rate: number
    likes: number
    comments: number
    shares: number
    reach: number
  }
  quality: {
    averageFollowerCount: number
    engagementScore: number
    retentionRate: number
    spamScore: number
  }
  actions: {
    follows: number
    unfollows: number
    likes: number
    comments: number
  }
}

interface PlatformLimits {
  follows: {
    perHour: number
    perDay: number
    per15Min: number
  }
  unfollows: {
    perHour: number
    perDay: number
  }
  likes: {
    perHour: number
    perDay: number
  }
  comments: {
    perHour: number
    perDay: number
  }
  maxFollowing: number
  followToFollowerRatio: number
}

interface EngagementAction {
  type: 'follow' | 'unfollow' | 'like' | 'comment' | 'retweet'
  targetUserId: string
  targetUsername: string
  platform: string
  timestamp: Date
  success: boolean
  reason?: string
  content?: string
}

interface FollowerQualityScore {
  userId: string
  username: string
  platform: string
  score: number
  factors: {
    followerCount: number
    followingCount: number
    engagementRate: number
    accountAge: number
    profileCompleteness: number
    activityLevel: number
    spamIndicators: number
  }
  recommendation: 'high_value' | 'medium_value' | 'low_value' | 'spam'
}

// Rate limiting and queue management
class RateLimiter {
  private buckets: Map<string, { tokens: number; lastRefill: number }> = new Map()
  private limits: Map<string, { capacity: number; refillRate: number }> = new Map()

  constructor() {
    // Twitter/X rate limits (conservative estimates)
    this.setLimit('twitter:follow', 50, 15 * 60 * 1000) // 50 per 15 minutes
    this.setLimit('twitter:like', 300, 15 * 60 * 1000) // 300 per 15 minutes
    this.setLimit('twitter:comment', 300, 15 * 60 * 1000) // 300 per 15 minutes

    // Discord rate limits
    this.setLimit('discord:message', 50, 1000) // 50 per second
    this.setLimit('discord:dm', 10, 60 * 1000) // 10 per minute

    // Telegram rate limits
    this.setLimit('telegram:message', 30, 1000) // 30 per second
    this.setLimit('telegram:broadcast', 20, 60 * 1000) // 20 per minute per group
  }

  private setLimit(key: string, capacity: number, refillInterval: number): void {
    this.limits.set(key, { capacity, refillRate: refillInterval })
    this.buckets.set(key, { tokens: capacity, lastRefill: Date.now() })
  }

  async checkLimit(key: string): Promise<boolean> {
    const limit = this.limits.get(key)
    const bucket = this.buckets.get(key)

    if (!limit || !bucket) return false

    const now = Date.now()
    const timePassed = now - bucket.lastRefill

    if (timePassed >= limit.refillRate) {
      bucket.tokens = limit.capacity
      bucket.lastRefill = now
    }

    if (bucket.tokens > 0) {
      bucket.tokens--
      return true
    }

    return false
  }

  async waitForToken(key: string): Promise<void> {
    const limit = this.limits.get(key)
    if (!limit) return

    while (!(await this.checkLimit(key))) {
      await new Promise((resolve) => setTimeout(resolve, 1000))
    }
  }
}

// Main FollowerGrowthEngine class
export class FollowerGrowthEngine extends EventEmitter {
  private rateLimiter: RateLimiter
  private activeStrategies: Map<string, FollowStrategy> = new Map()
  private actionQueue: EngagementAction[] = []
  private metrics: Map<string, GrowthMetrics[]> = new Map()
  private followedUsers: Map<string, { timestamp: Date; platform: string; strategy: string }> = new Map()
  private isRunning: boolean = false
  private platformLimits: Map<string, PlatformLimits> = new Map()

  constructor() {
    super()
    this.rateLimiter = new RateLimiter()
    this.initializePlatformLimits()
    this.startProcessingQueue()
  }

  private initializePlatformLimits(): void {
    // Twitter/X limits (conservative for safety)
    this.platformLimits.set('twitter', {
      follows: { perHour: 20, perDay: 300, per15Min: 5 },
      unfollows: { perHour: 20, perDay: 300 },
      likes: { perHour: 100, perDay: 800 },
      comments: { perHour: 50, perDay: 400 },
      maxFollowing: 5000,
      followToFollowerRatio: 1.1,
    })

    // Discord limits (for community engagement)
    this.platformLimits.set('discord', {
      follows: { perHour: 0, perDay: 0, per15Min: 0 }, // No following concept
      unfollows: { perHour: 0, perDay: 0 },
      likes: { perHour: 200, perDay: 1000 }, // Reactions
      comments: { perHour: 100, perDay: 500 }, // Messages
      maxFollowing: 0,
      followToFollowerRatio: 0,
    })

    // Telegram limits
    this.platformLimits.set('telegram', {
      follows: { perHour: 0, perDay: 0, per15Min: 0 }, // No following concept
      unfollows: { perHour: 0, perDay: 0 },
      likes: { perHour: 0, perDay: 0 }, // No likes
      comments: { perHour: 60, perDay: 400 }, // Messages
      maxFollowing: 0,
      followToFollowerRatio: 0,
    })
  }

  // Analyze target audience based on competitor analysis and engagement patterns
  async analyzeTargetAudience(competitorUsernames: string[], platform: string): Promise<TargetAudience> {
    try {
      this.emit('analysis:started', { platform, competitors: competitorUsernames })

      const competitorFollowers = await this.analyzeCompetitorFollowers(competitorUsernames, platform)
      const engagementPatterns = await this.analyzeEngagementPatterns(competitorUsernames, platform)
      const demographics = await this.extractDemographics(competitorFollowers, platform)

      const targetAudience: TargetAudience = {
        demographics: {
          ageRange: demographics.ageRange || [18, 45],
          interests: demographics.interests || ['crypto', 'blockchain', 'defi'],
          location: demographics.locations || ['US', 'EU', 'Global'],
          language: demographics.languages || ['en'],
        },
        behaviorPatterns: {
          activeHours: engagementPatterns.peakHours || [9, 12, 15, 18, 21],
          engagementTypes: engagementPatterns.preferredTypes || ['likes', 'retweets', 'comments'],
          contentPreferences: engagementPatterns.contentTypes || ['memes', 'news', 'analysis'],
        },
        competitorFollowers: competitorFollowers.map((follower) => ({
          username: follower.username,
          platform: platform,
          relevanceScore: this.calculateRelevanceScore(follower),
        })),
      }

      this.emit('analysis:completed', { platform, targetAudience })
      return targetAudience
    } catch (error) {
      const msg = error && typeof error === 'object' && 'message' in error ? (error as any).message : String(error)
      this.emit('analysis:error', { platform, error: msg })
      throw error
    }
  }

  private async analyzeCompetitorFollowers(usernames: string[], platform: string): Promise<any[]> {
    const followers = []

    for (const username of usernames) {
      try {
        // Simulate API call to get follower data
        const followerData = await this.fetchFollowerData(username, platform)
        followers.push(...followerData)

        // Respect rate limits
        await this.rateLimiter.waitForToken(`${platform}:api`)
      } catch (error) {
        console.warn(`Failed to analyze followers for ${username}:`, error.message)
      }
    }

    return this.deduplicateAndScore(followers)
  }

  private async analyzeEngagementPatterns(usernames: string[], platform: string): Promise<any> {
    const patterns = {
      peakHours: [],
      preferredTypes: [],
      contentTypes: [],
    }

    for (const username of usernames) {
      try {
        const engagementData = await this.fetchEngagementData(username, platform)

        // Analyze timing patterns
        patterns.peakHours.push(...this.extractPeakHours(engagementData))
        patterns.preferredTypes.push(...this.extractEngagementTypes(engagementData))
        patterns.contentTypes.push(...this.extractContentTypes(engagementData))
      } catch (error) {
        console.warn(`Failed to analyze engagement for ${username}:`, error.message)
      }
    }

    return {
      peakHours: this.getMostCommon(patterns.peakHours),
      preferredTypes: this.getMostCommon(patterns.preferredTypes),
      contentTypes: this.getMostCommon(patterns.contentTypes),
    }
  }

  private async extractDemographics(followers: any[], platform: string): Promise<any> {
    const demographics = {
      ageRange: [18, 45] as [number, number],
      interests: [],
      locations: [],
      languages: [],
    }

    // Analyze follower profiles for demographic data
    for (const follower of followers.slice(0, 1000)) {
      // Sample for performance
      try {
        const profile = await this.analyzeProfile(follower, platform)

        if (profile.interests) demographics.interests.push(...profile.interests)
        if (profile.location) demographics.locations.push(profile.location)
        if (profile.language) demographics.languages.push(profile.language)
      } catch (error) {
        // Continue with next profile
      }
    }

    return {
      ageRange: demographics.ageRange,
      interests: this.getMostCommon(demographics.interests).slice(0, 10),
      locations: this.getMostCommon(demographics.locations).slice(0, 5),
      languages: this.getMostCommon(demographics.languages).slice(0, 3),
    }
  }

  // Execute follow strategy with smart targeting and rate limiting
  async executeFollowStrategy(strategyId: string): Promise<void> {
    const strategy = this.activeStrategies.get(strategyId)
    if (!strategy) {
      throw new Error(`Strategy ${strategyId} not found`)
    }

    this.emit('strategy:started', { strategyId, strategy })

    try {
      const targets = await this.findTargetUsers(strategy)
      const qualifiedTargets = await this.qualifyTargets(targets, strategy)

      for (const target of qualifiedTargets) {
        if (!this.isRunning) break

        const action = await this.planEngagementAction(target, strategy)
        if (action) {
          this.actionQueue.push(action)
        }

        // Natural delay between target processing
        const delay = this.calculateNaturalDelay(strategy.timing.delayBetweenActions)
        await this.sleep(delay)
      }

      this.emit('strategy:completed', { strategyId, targetsProcessed: qualifiedTargets.length })
    } catch (error) {
      this.emit('strategy:error', { strategyId, error: error.message })
      throw error
    }
  }

  private async findTargetUsers(strategy: FollowStrategy): Promise<any[]> {
    const targets = []

    // Find users from competitor followers
    if (strategy.targetCriteria.keywords.length > 0) {
      for (const keyword of strategy.targetCriteria.keywords) {
        const searchResults = await this.searchUsersByKeyword(keyword, strategy.platform)
        targets.push(...searchResults)
      }
    }

    // Find users from hashtag engagement
    const hashtagUsers = await this.findUsersFromHashtags(strategy)
    targets.push(...hashtagUsers)

    // Find users from similar content engagement
    const contentUsers = await this.findUsersFromContent(strategy)
    targets.push(...contentUsers)

    return this.deduplicateTargets(targets)
  }

  private async qualifyTargets(targets: any[], strategy: FollowStrategy): Promise<any[]> {
    const qualified = []

    for (const target of targets) {
      try {
        const profile = await this.getProfileData(target.id, strategy.platform)

        // Check follower count criteria
        if (
          profile.followerCount < strategy.targetCriteria.minFollowers ||
          profile.followerCount > strategy.targetCriteria.maxFollowers
        ) {
          continue
        }

        // Check engagement rate
        const engagementRate = await this.calculateEngagementRate(profile)
        if (engagementRate < strategy.targetCriteria.engagementRate) {
          continue
        }

        // Check recent activity
        if (strategy.targetCriteria.recentActivity) {
          const isActive = await this.checkRecentActivity(profile)
          if (!isActive) continue
        }

        // Check if already following or recently unfollowed
        if (this.followedUsers.has(target.id)) {
          continue
        }

        qualified.push({ ...target, profile, engagementRate })
      } catch (error) {
        console.warn(`Failed to qualify target ${target.id}:`, error.message)
      }
    }

    return qualified.slice(0, strategy.timing.dailyLimit)
  }

  private async planEngagementAction(target: any, strategy: FollowStrategy): Promise<EngagementAction | null> {
    const actions = []

    // Plan follow action
    if (strategy.actions.follow) {
      actions.push({
        type: 'follow' as const,
        targetUserId: target.id,
        targetUsername: target.username,
        platform: strategy.platform,
        timestamp: new Date(),
        success: false,
      })
    }

    // Plan engagement actions
    if (strategy.actions.like) {
      const recentPosts = await this.getRecentPosts(target.id, strategy.platform)
      for (const post of recentPosts.slice(0, 2)) {
        actions.push({
          type: 'like' as const,
          targetUserId: target.id,
          targetUsername: target.username,
          platform: strategy.platform,
          timestamp: new Date(),
          success: false,
          content: post.id,
        })
      }
    }

    if (strategy.actions.comment) {
      const recentPosts = await this.getRecentPosts(target.id, strategy.platform)
      const commentablePost = recentPosts.find((post) => this.isCommentable(post))

      if (commentablePost) {
        const comment = await this.generateEngagementComment(commentablePost, target)
        actions.push({
          type: 'comment' as const,
          targetUserId: target.id,
          targetUsername: target.username,
          platform: strategy.platform,
          timestamp: new Date(),
          success: false,
          content: comment,
        })
      }
    }

    return actions.length > 0 ? actions[0] : null // Return first action for queue
  }

  // Engage with influencers and high-value accounts
  async engageWithInfluencers(influencerList: string[], platform: string): Promise<void> {
    this.emit('influencer:engagement:started', { platform, count: influencerList.length })

    for (const influencer of influencerList) {
      try {
        const profile = await this.getProfileData(influencer, platform)
        const qualityScore = await this.calculateInfluencerValue(profile)

        if (qualityScore.score > 0.7) {
          // High-value threshold
          await this.executeInfluencerEngagement(profile, platform)
        }

        // Respectful delay between influencer interactions
        await this.sleep(this.randomDelay(30000, 60000)) // 30-60 seconds
      } catch (error) {
        console.warn(`Failed to engage with influencer ${influencer}:`, error.message)
      }
    }

    this.emit('influencer:engagement:completed', { platform })
  }

  private async executeInfluencerEngagement(profile: any, platform: string): Promise<void> {
    const recentPosts = await this.getRecentPosts(profile.id, platform)

    for (const post of recentPosts.slice(0, 3)) {
      // Like high-quality content
      if (this.isHighQualityContent(post)) {
        this.actionQueue.push({
          type: 'like',
          targetUserId: profile.id,
          targetUsername: profile.username,
          platform: platform,
          timestamp: new Date(),
          success: false,
          content: post.id,
        })
      }

      // Comment on engaging content
      if (this.isEngagingContent(post) && Math.random() < 0.3) {
        // 30% chance
        const comment = await this.generateThoughtfulComment(post, profile)
        this.actionQueue.push({
          type: 'comment',
          targetUserId: profile.id,
          targetUsername: profile.username,
          platform: platform,
          timestamp: new Date(),
          success: false,
          content: comment,
        })
      }

      await this.sleep(this.randomDelay(5000, 15000)) // 5-15 seconds between actions
    }
  }

  // Track growth metrics and analyze performance
  async trackGrowthMetrics(platform: string, timeframe: string = '24h'): Promise<GrowthMetrics> {
    try {
      const currentMetrics = await this.getCurrentMetrics(platform)
      const previousMetrics = await this.getPreviousMetrics(platform, timeframe)

      const metrics: GrowthMetrics = {
        platform,
        timeframe,
        followers: {
          gained: currentMetrics.followers - previousMetrics.followers,
          lost: this.calculateFollowerLoss(platform, timeframe),
          net: currentMetrics.followers - previousMetrics.followers,
          growthRate: this.calculateGrowthRate(currentMetrics.followers, previousMetrics.followers, timeframe),
        },
        engagement: {
          rate: await this.calculateCurrentEngagementRate(platform),
          likes: currentMetrics.likes - previousMetrics.likes,
          comments: currentMetrics.comments - previousMetrics.comments,
          shares: currentMetrics.shares - previousMetrics.shares,
          reach: currentMetrics.reach,
        },
        quality: {
          averageFollowerCount: await this.calculateAverageFollowerCount(platform),
          engagementScore: await this.calculateEngagementScore(platform),
          retentionRate: await this.calculateRetentionRate(platform, timeframe),
          spamScore: await this.calculateSpamScore(platform),
        },
        actions: {
          follows: this.getActionCount('follow', platform, timeframe),
          unfollows: this.getActionCount('unfollow', platform, timeframe),
          likes: this.getActionCount('like', platform, timeframe),
          comments: this.getActionCount('comment', platform, timeframe),
        },
      }

      // Store metrics for historical analysis
      if (!this.metrics.has(platform)) {
        this.metrics.set(platform, [])
      }
      this.metrics.get(platform)!.push(metrics)

      this.emit('metrics:updated', { platform, metrics })
      return metrics
    } catch (error) {
      this.emit('metrics:error', { platform, error: error.message })
      throw error
    }
  }

  // Follower quality scoring system
  async scoreFollowerQuality(userId: string, platform: string): Promise<FollowerQualityScore> {
    try {
      const profile = await this.getProfileData(userId, platform)
      const engagementRate = await this.calculateEngagementRate(profile)

      const factors = {
        followerCount: this.scoreFollowerCount(profile.followerCount),
        followingCount: this.scoreFollowingRatio(profile.followerCount, profile.followingCount),
        engagementRate: this.scoreEngagementRate(engagementRate),
        accountAge: this.scoreAccountAge(profile.createdAt),
        profileCompleteness: this.scoreProfileCompleteness(profile),
        activityLevel: await this.scoreActivityLevel(profile),
        spamIndicators: await this.detectSpamIndicators(profile),
      }

      const score = this.calculateOverallQualityScore(factors)
      const recommendation = this.getQualityRecommendation(score, factors)

      return {
        userId,
        username: profile.username,
        platform,
        score,
        factors,
        recommendation,
      }
    } catch (error) {
      console.warn(`Failed to score follower quality for ${userId}:`, error.message)
      return {
        userId,
        username: 'unknown',
        platform,
        score: 0,
        factors: {
          followerCount: 0,
          followingCount: 0,
          engagementRate: 0,
          accountAge: 0,
          profileCompleteness: 0,
          activityLevel: 0,
          spamIndicators: 1,
        },
        recommendation: 'spam',
      }
    }
  }

  // Unfollow strategy for non-reciprocal follows
  async executeUnfollowStrategy(platform: string): Promise<void> {
    this.emit('unfollow:started', { platform })

    const strategy = Array.from(this.activeStrategies.values()).find(
      (s) => s.platform === platform && s.unfollowStrategy.enabled,
    )

    if (!strategy) {
      this.emit('unfollow:skipped', { platform, reason: 'No unfollow strategy enabled' })
      return
    }

    const unfollowCandidates = await this.findUnfollowCandidates(platform, strategy)

    for (const candidate of unfollowCandidates) {
      try {
        const shouldUnfollow = await this.evaluateUnfollowCandidate(candidate, strategy)

        if (shouldUnfollow) {
          this.actionQueue.push({
            type: 'unfollow',
            targetUserId: candidate.userId,
            targetUsername: candidate.username,
            platform: platform,
            timestamp: new Date(),
            success: false,
            reason: candidate.reason,
          })

          // Remove from followed users tracking
          this.followedUsers.delete(candidate.userId)
        }

        // Delay between unfollow evaluations
        await this.sleep(this.randomDelay(10000, 30000))
      } catch (error) {
        console.warn(`Failed to process unfollow candidate ${candidate.userId}:`, error.message)
      }
    }

    this.emit('unfollow:completed', { platform, processed: unfollowCandidates.length })
  }

  private async findUnfollowCandidates(platform: string, strategy: FollowStrategy): Promise<any[]> {
    const candidates = []
    const cutoffDate = new Date(Date.now() - strategy.unfollowStrategy.waitDays * 24 * 60 * 60 * 1000)

    for (const [userId, followData] of this.followedUsers.entries()) {
      if (followData.platform === platform && followData.timestamp < cutoffDate) {
        const isFollowingBack = await this.checkIfFollowingBack(userId, platform)

        if (!isFollowingBack) {
          candidates.push({
            userId,
            username: await this.getUsernameById(userId, platform),
            followedAt: followData.timestamp,
            reason: 'not_following_back',
          })
        }
      }
    }

    return candidates
  }

  private async evaluateUnfollowCandidate(candidate: any, strategy: FollowStrategy): Promise<boolean> {
    // Check strategy conditions
    for (const condition of strategy.unfollowStrategy.conditions) {
      switch (condition) {
        case 'not_following_back':
          return candidate.reason === 'not_following_back'
        case 'low_engagement':
          const engagementRate = await this.calculateEngagementRate(candidate)
          return engagementRate < 0.01 // Less than 1%
        case 'inactive_account':
          const isActive = await this.checkRecentActivity(candidate)
          return !isActive
        default:
          continue
      }
    }

    return false
  }

  // Action queue processing
  private async startProcessingQueue(): Promise<void> {
    setInterval(async () => {
      if (!this.isRunning || this.actionQueue.length === 0) return

      const action = this.actionQueue.shift()
      if (!action) return

      try {
        await this.executeAction(action)
      } catch (error) {
        console.error('Failed to execute action:', error)
        action.success = false
        // error may be unknown; defensively extract message
        if (error && typeof error === 'object' && 'message' in error) {
          // @ts-ignore - runtime check above ensures message exists
          action.reason = (error as any).message
        } else {
          action.reason = String(error)
        }
      }

      // Store action for analytics
      this.storeActionResult(action)
    }, 5000) // Process every 5 seconds
  }

  private async executeAction(action: EngagementAction): Promise<void> {
    const rateLimitKey = `${action.platform}:${action.type}`

    // Wait for rate limit clearance
    await this.rateLimiter.waitForToken(rateLimitKey)

    // Check platform-specific limits
    const canExecute = await this.checkPlatformLimits(action)
    if (!canExecute) {
      throw new Error('Platform limits exceeded')
    }

    // Execute the action based on type
    switch (action.type) {
      case 'follow':
        await this.executeFollow(action)
        break
      case 'unfollow':
        await this.executeUnfollow(action)
        break
      case 'like':
        await this.executeLike(action)
        break
      case 'comment':
        await this.executeComment(action)
        break
      case 'retweet':
        await this.executeRetweet(action)
        break
    }

    action.success = true
    this.emit('action:executed', action)
  }

  // Platform-specific action implementations
  private async executeFollow(action: EngagementAction): Promise<void> {
    // Simulate API call - replace with actual platform API
    console.log(`Following ${action.targetUsername} on ${action.platform}`)

    // Track the follow
    this.followedUsers.set(action.targetUserId, {
      timestamp: new Date(),
      platform: action.platform,
      strategy: 'current', // Could be enhanced to track specific strategy
    })

    // Simulate API delay
    await this.sleep(this.randomDelay(1000, 3000))
  }

  private async executeUnfollow(action: EngagementAction): Promise<void> {
    console.log(`Unfollowing ${action.targetUsername} on ${action.platform}`)
    await this.sleep(this.randomDelay(1000, 3000))
  }

  private async executeLike(action: EngagementAction): Promise<void> {
    console.log(`Liking content from ${action.targetUsername} on ${action.platform}`)
    await this.sleep(this.randomDelay(500, 2000))
  }

  private async executeComment(action: EngagementAction): Promise<void> {
    console.log(`Commenting on ${action.targetUsername}'s post: ${action.content}`)
    await this.sleep(this.randomDelay(2000, 5000))
  }

  private async executeRetweet(action: EngagementAction): Promise<void> {
    console.log(`Retweeting ${action.targetUsername}'s content on ${action.platform}`)
    await this.sleep(this.randomDelay(1000, 3000))
  }

  // Utility methods
  private calculateRelevanceScore(follower: any): number {
    // Implement relevance scoring based on profile analysis
    let score = 0.5 // Base score

    // Boost for crypto-related keywords in bio
    const cryptoKeywords = ['crypto', 'bitcoin', 'ethereum', 'defi', 'nft', 'blockchain']
    const bio = (follower.bio || '').toLowerCase()
    const keywordMatches = cryptoKeywords.filter((keyword) => bio.includes(keyword)).length
    score += keywordMatches * 0.1

    // Boost for engagement rate
    if (follower.engagementRate > 0.03) score += 0.2
    if (follower.engagementRate > 0.05) score += 0.1

    // Penalty for very high following count (potential spam)
    if (follower.followingCount > follower.followerCount * 2) score -= 0.2

    return Math.max(0, Math.min(1, score))
  }

  private deduplicateAndScore(followers: any[]): any[] {
    const unique = new Map()

    for (const follower of followers) {
      if (!unique.has(follower.id)) {
        unique.set(follower.id, {
          ...follower,
          relevanceScore: this.calculateRelevanceScore(follower),
        })
      }
    }

    return Array.from(unique.values())
      .sort((a, b) => b.relevanceScore - a.relevanceScore)
      .slice(0, 1000) // Limit for performance
  }

  private getMostCommon<T>(array: T[]): T[] {
    const frequency = new Map<T, number>()

    for (const item of array) {
      frequency.set(item, (frequency.get(item) || 0) + 1)
    }

    return Array.from(frequency.entries())
      .sort((a, b) => b[1] - a[1])
      .map(([item]) => item)
      .slice(0, 10)
  }

  private calculateNaturalDelay(range: [number, number]): number {
    const [min, max] = range
    return Math.floor(Math.random() * (max - min + 1)) + min
  }

  private randomDelay(min: number, max: number): number {
    return Math.floor(Math.random() * (max - min + 1)) + min
  }

  private async sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms))
  }

  // Mock API methods (replace with actual implementations)
  private async fetchFollowerData(username: string, platform: string): Promise<any[]> {
    // Mock implementation - replace with actual API calls
    return []
  }

  private async fetchEngagementData(username: string, platform: string): Promise<any> {
    // Mock implementation
    return {}
  }

  private async analyzeProfile(follower: any, platform: string): Promise<any> {
    // Mock implementation
    return {}
  }

  private extractPeakHours(engagementData: any): number[] {
    // Mock implementation
    return [9, 12, 15, 18, 21]
  }

  private extractEngagementTypes(engagementData: any): string[] {
    // Mock implementation
    return ['likes', 'retweets', 'comments']
  }

  private extractContentTypes(engagementData: any): string[] {
    // Mock implementation
    return ['memes', 'news', 'analysis']
  }

  private async searchUsersByKeyword(keyword: string, platform: string): Promise<any[]> {
    // Mock implementation
    return []
  }

  private async findUsersFromHashtags(strategy: FollowStrategy): Promise<any[]> {
    // Mock implementation
    return []
  }

  private async findUsersFromContent(strategy: FollowStrategy): Promise<any[]> {
    // Mock implementation
    return []
  }

  private deduplicateTargets(targets: any[]): any[] {
    const unique = new Map()
    for (const target of targets) {
      unique.set(target.id, target)
    }
    return Array.from(unique.values())
  }

  private async getProfileData(userId: string, platform: string): Promise<any> {
    // Mock implementation
    return {
      id: userId,
      username: `user_${userId}`,
      followerCount: Math.floor(Math.random() * 10000),
      followingCount: Math.floor(Math.random() * 5000),
      createdAt: new Date(Date.now() - Math.random() * 365 * 24 * 60 * 60 * 1000),
    }
  }

  private async calculateEngagementRate(profile: any): Promise<number> {
    // Mock implementation
    return Math.random() * 0.1 // 0-10%
  }

  private async checkRecentActivity(profile: any): Promise<boolean> {
    // Mock implementation
    return Math.random() > 0.3 // 70% chance of being active
  }

  private async getRecentPosts(userId: string, platform: string): Promise<any[]> {
    // Mock implementation
    return [
      { id: 'post1', content: 'Sample post content' },
      { id: 'post2', content: 'Another post' },
    ]
  }

  private isCommentable(post: any): boolean {
    // Mock implementation
    return Math.random() > 0.5
  }

  private async generateEngagementComment(post: any, target: any): Promise<string> {
    const comments = [
      'Great insight!',
      'Thanks for sharing this!',
      'Interesting perspective 🤔',
      'This is valuable content',
      'Love this take!',
    ]
    return comments[Math.floor(Math.random() * comments.length)]
  }

  private async calculateInfluencerValue(profile: any): Promise<{ score: number }> {
    // Mock implementation
    return { score: Math.random() }
  }

  private isHighQualityContent(post: any): boolean {
    // Mock implementation
    return Math.random() > 0.6
  }

  private isEngagingContent(post: any): boolean {
    // Mock implementation
    return Math.random() > 0.4
  }

  private async generateThoughtfulComment(post: any, profile: any): Promise<string> {
    const comments = [
      'This really resonates with me. Thanks for the insights!',
      'Great point about this topic. Have you considered...?',
      'Your perspective on this is really valuable.',
      'This is exactly what the community needs to hear.',
      'Appreciate you sharing your expertise on this!',
    ]
    return comments[Math.floor(Math.random() * comments.length)]
  }

  private async getCurrentMetrics(platform: string): Promise<any> {
    // Mock implementation
    return {
      followers: Math.floor(Math.random() * 10000),
      likes: Math.floor(Math.random() * 1000),
      comments: Math.floor(Math.random() * 500),
      shares: Math.floor(Math.random() * 200),
      reach: Math.floor(Math.random() * 50000),
    }
  }

  private async getPreviousMetrics(platform: string, timeframe: string): Promise<any> {
    // Mock implementation
    return {
      followers: Math.floor(Math.random() * 9000),
      likes: Math.floor(Math.random() * 900),
      comments: Math.floor(Math.random() * 450),
      shares: Math.floor(Math.random() * 180),
      reach: Math.floor(Math.random() * 45000),
    }
  }

  private calculateFollowerLoss(platform: string, timeframe: string): number {
    // Mock implementation
    return Math.floor(Math.random() * 50)
  }

  private calculateGrowthRate(current: number, previous: number, timeframe: string): number {
    if (previous === 0) return 0
    return ((current - previous) / previous) * 100
  }

  private async calculateCurrentEngagementRate(platform: string): Promise<number> {
    // Mock implementation
    return Math.random() * 0.1
  }

  private async calculateAverageFollowerCount(platform: string): Promise<number> {
    // Mock implementation
    return Math.floor(Math.random() * 5000)
  }

  private async calculateEngagementScore(platform: string): Promise<number> {
    // Mock implementation
    return Math.random()
  }

  private async calculateRetentionRate(platform: string, timeframe: string): Promise<number> {
    // Mock implementation
    return 0.8 + Math.random() * 0.2 // 80-100%
  }

  private async calculateSpamScore(platform: string): Promise<number> {
    // Mock implementation
    return Math.random() * 0.1 // Low spam score
  }

  private getActionCount(actionType: string, platform: string, timeframe: string): number {
    // Mock implementation
    return Math.floor(Math.random() * 100)
  }

  private scoreFollowerCount(count: number): number {
    // Score based on follower count (sweet spot around 1k-10k)
    if (count < 100) return 0.2
    if (count < 1000) return 0.6
    if (count < 10000) return 1.0
    if (count < 100000) return 0.8
    return 0.4 // Very high follower counts might be less valuable
  }

  private scoreFollowingRatio(followers: number, following: number): number {
    if (following === 0) return 1.0
    const ratio = followers / following
    if (ratio > 2) return 1.0 // Good ratio
    if (ratio > 1) return 0.8
    if (ratio > 0.5) return 0.6
    return 0.2 // Following too many people
  }

  private scoreEngagementRate(rate: number): number {
    if (rate > 0.05) return 1.0 // Excellent engagement
    if (rate > 0.03) return 0.8
    if (rate > 0.01) return 0.6
    return 0.2 // Low engagement
  }

  private scoreAccountAge(createdAt: Date): number {
    const ageInDays = (Date.now() - createdAt.getTime()) / (24 * 60 * 60 * 1000)
    if (ageInDays > 365) return 1.0 // Established account
    if (ageInDays > 180) return 0.8
    if (ageInDays > 30) return 0.6
    return 0.2 // Very new account
  }

  private scoreProfileCompleteness(profile: any): number {
    let score = 0
    if (profile.bio) score += 0.3
    if (profile.profileImage) score += 0.2
    if (profile.location) score += 0.2
    if (profile.website) score += 0.3
    return score
  }

  private async scoreActivityLevel(profile: any): Promise<number> {
    // Mock implementation - would check recent posting frequency
    return Math.random()
  }

  private async detectSpamIndicators(profile: any): Promise<number> {
    let spamScore = 0

    // Check for spam patterns in bio
    const spamKeywords = ['follow back', 'dm for promo', 'buy followers', 'guaranteed followers']
    const bio = (profile.bio || '').toLowerCase()
    spamScore += spamKeywords.filter((keyword) => bio.includes(keyword)).length * 0.3

    // Check for suspicious follower patterns
    if (profile.followingCount > profile.followerCount * 3) spamScore += 0.4

    return Math.min(1, spamScore)
  }

  private calculateOverallQualityScore(factors: any): number {
    const weights = {
      followerCount: 0.15,
      followingCount: 0.15,
      engagementRate: 0.25,
      accountAge: 0.15,
      profileCompleteness: 0.1,
      activityLevel: 0.15,
      spamIndicators: -0.05, // Negative weight
    }

    let score = 0
    for (const [factor, value] of Object.entries(factors)) {
      score += (value as number) * (weights[factor as keyof typeof weights] || 0)
    }

    return Math.max(0, Math.min(1, score))
  }

  private getQualityRecommendation(score: number, factors: any): 'high_value' | 'medium_value' | 'low_value' | 'spam' {
    if (factors.spamIndicators > 0.5) return 'spam'
    if (score > 0.8) return 'high_value'
    if (score > 0.6) return 'medium_value'
    return 'low_value'
  }

  private async checkIfFollowingBack(userId: string, platform: string): Promise<boolean> {
    // Mock implementation
    return Math.random() > 0.6 // 40% follow back rate
  }

  private async getUsernameById(userId: string, platform: string): Promise<string> {
    // Mock implementation
    return `user_${userId}`
  }

  private async checkPlatformLimits(action: EngagementAction): Promise<boolean> {
    const limits = this.platformLimits.get(action.platform)
    if (!limits) return true

    // Check daily limits for the action type
    const dailyCount = this.getActionCount(action.type, action.platform, '24h')

    switch (action.type) {
      case 'follow':
        return dailyCount < limits.follows.perDay
      case 'unfollow':
        return dailyCount < limits.unfollows.perDay
      case 'like':
        return dailyCount < limits.likes.perDay
      case 'comment':
        return dailyCount < limits.comments.perDay
      default:
        return true
    }
  }

  private storeActionResult(action: EngagementAction): void {
    // Store action result for analytics and rate limiting
    // This would typically go to a database
    console.log('Action stored:', action)
  }

  // Public control methods
  start(): void {
    this.isRunning = true
    this.emit('engine:started')
  }

  stop(): void {
    this.isRunning = false
    this.emit('engine:stopped')
  }

  addStrategy(strategy: FollowStrategy): void {
    this.activeStrategies.set(strategy.id, strategy)
    this.emit('strategy:added', { strategyId: strategy.id })
  }

  removeStrategy(strategyId: string): void {
    this.activeStrategies.delete(strategyId)
    this.emit('strategy:removed', { strategyId })
  }

  getMetrics(platform: string): GrowthMetrics[] {
    return this.metrics.get(platform) || []
  }

  getActiveStrategies(): FollowStrategy[] {
    return Array.from(this.activeStrategies.values())
  }

  getQueueLength(): number {
    return this.actionQueue.length
  }

  getFollowedUsersCount(platform?: string): number {
    if (platform) {
      return Array.from(this.followedUsers.values()).filter((data) => data.platform === platform).length
    }
    return this.followedUsers.size
  }
}
