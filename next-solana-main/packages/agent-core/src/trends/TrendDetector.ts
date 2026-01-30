import { EventEmitter } from 'events'

export enum Platform {
  TWITTER = 'twitter',
  DISCORD = 'discord',
  TELEGRAM = 'telegram',
  REDDIT = 'reddit',
  YOUTUBE = 'youtube',
  TIKTOK = 'tiktok',
}

export enum CryptoTrendCategory {
  MEME_COIN = 'meme_coin',
  DEFI = 'defi',
  NFT = 'nft',
  GAMING = 'gaming',
  AI = 'ai',
  INFRASTRUCTURE = 'infrastructure',
  REGULATION = 'regulation',
  MARKET_SENTIMENT = 'market_sentiment',
  TECHNICAL_ANALYSIS = 'technical_analysis',
  ECOSYSTEM = 'ecosystem',
}

export enum TrendStage {
  EMERGING = 'emerging',
  RISING = 'rising',
  PEAK = 'peak',
  PEAKING = 'peaking',
  DECLINE = 'decline',
  DECLINING = 'declining',
  DEAD = 'dead',
}

export interface MarketData {
  price: number
  volume: number
  marketCap: number
  priceChange24h: number
  volumeChange24h: number
  socialVolume: number
  socialSentiment: number
  timestamp: number
}

export interface TrendSignal {
  id: string
  topic: string
  platform: Platform
  category: CryptoTrendCategory
  strength: number
  velocity: number
  timestamp: number
  sources: string[]
  relatedTopics: string[]
  sentiment: number
  marketData?: MarketData
  hashtags: string[]
  mentions: number
  engagement: number
  viralScore: number
  influencerMentions: string[]
  geographicSpread: string[]
}

export interface TrendAnalysis {
  score: number
  confidence: number
  momentum: number
  peakTime: number
  durability: number
  marketCorrelation: number
  predictedPeak: number
  riskLevel: number
  opportunityScore: number
  recommendedAction: 'engage' | 'monitor' | 'avoid'
}

export interface TrendPrediction {
  topic: string
  predictedStrength: number
  timeToPeak: number
  confidence: number
  factors: string[]
  marketImpact: number
}

export interface CrossPlatformTrend {
  topic: string
  platforms: Platform[]
  aggregatedStrength: number
  dominantPlatform: Platform
  crossPlatformVelocity: number
  synchronization: number
}

export class TrendDetector extends EventEmitter {
  private activeSignals: Map<string, TrendSignal>
  private historicalTrends: Map<string, TrendAnalysis>
  private crossPlatformTrends: Map<string, CrossPlatformTrend>
  private marketDataCache: Map<string, MarketData>
  private trendPredictions: Map<string, TrendPrediction>

  // Configuration constants
  private readonly SIGNAL_THRESHOLD = 0.6
  private readonly TREND_TIMEOUT = 3600000 // 1 hour
  private readonly MINIMUM_SOURCES = 3
  private readonly VIRAL_THRESHOLD = 0.8
  private readonly MARKET_CORRELATION_THRESHOLD = 0.7
  private readonly PREDICTION_WINDOW = 7200000 // 2 hours

  // Crypto-specific weights
  private readonly CRYPTO_CATEGORY_WEIGHTS = {
    [CryptoTrendCategory.MEME_COIN]: 1.2,
    [CryptoTrendCategory.DEFI]: 1.0,
    [CryptoTrendCategory.NFT]: 0.9,
    [CryptoTrendCategory.GAMING]: 0.8,
    [CryptoTrendCategory.AI]: 1.1,
    [CryptoTrendCategory.INFRASTRUCTURE]: 0.7,
    [CryptoTrendCategory.REGULATION]: 1.3,
    [CryptoTrendCategory.MARKET_SENTIMENT]: 1.4,
    [CryptoTrendCategory.TECHNICAL_ANALYSIS]: 0.8,
    [CryptoTrendCategory.ECOSYSTEM]: 0.9,
  }

  constructor() {
    super()
    this.activeSignals = new Map()
    this.historicalTrends = new Map()
    this.crossPlatformTrends = new Map()
    this.marketDataCache = new Map()
    this.trendPredictions = new Map()

    // Start background processes
    this.startTrendMonitoring()
    this.startPredictiveAnalysis()
  }

  public async detectTrends(
    platform: Platform,
    signals: Array<Partial<TrendSignal>>,
  ): Promise<Map<string, TrendSignal>> {
    const detectedTrends = new Map<string, TrendSignal>()

    // Process each signal
    for (const signal of signals) {
      const processedSignal = await this.processSignal(platform, signal)
      if (processedSignal && this.isSignificantTrend(processedSignal)) {
        detectedTrends.set(processedSignal.id, processedSignal)

        // Check for viral potential
        if (processedSignal.viralScore > this.VIRAL_THRESHOLD) {
          this.emit('viralTrendDetected', processedSignal)
        }
      }
    }

    // Update active signals and cross-platform analysis
    this.updateActiveSignals(detectedTrends)
    await this.updateCrossPlatformTrends()

    return detectedTrends
  }

  public async processSignal(platform: Platform, signal: Partial<TrendSignal>): Promise<TrendSignal | null> {
    try {
      const signalId = `${platform}-${signal.topic}-${Date.now()}`

      // Determine crypto category
      const category = this.categorizeTrend(signal.topic || '', signal.hashtags || [])

      // Calculate enhanced metrics
      const strength = this.calculateSignalStrength(signal, category)
      const velocity = this.calculateSignalVelocity(signal)
      const viralScore = this.calculateViralScore(signal)

      if (strength < this.SIGNAL_THRESHOLD) {
        return null
      }

      // Get market data correlation if available
      const marketData = await this.getMarketData(signal.topic || '')

      const processedSignal: TrendSignal = {
        id: signalId,
        topic: signal.topic || '',
        platform,
        category,
        strength,
        velocity,
        timestamp: Date.now(),
        sources: signal.sources || [],
        relatedTopics: signal.relatedTopics || [],
        sentiment: signal.sentiment || 0,
        marketData,
        hashtags: signal.hashtags || [],
        mentions: signal.mentions || 0,
        engagement: signal.engagement || 0,
        viralScore,
        influencerMentions: signal.influencerMentions || [],
        geographicSpread: signal.geographicSpread || [],
      }

      this.emit('signalProcessed', processedSignal)
      return processedSignal
    } catch (error) {
      console.error('Error processing signal:', error)
      return null
    }
  }

  public calculateSignalStrength(signal: Partial<TrendSignal>, category: CryptoTrendCategory): number {
    let strength = 0

    // Base factors from original implementation
    const sourceDiversity = (signal.sources?.length || 0) / this.MINIMUM_SOURCES
    strength += sourceDiversity * 0.2

    const sentimentImpact = Math.abs(signal.sentiment || 0)
    strength += sentimentImpact * 0.15

    const topicRelevance = (signal.relatedTopics?.length || 0) / 5
    strength += topicRelevance * 0.1

    const historicalFactor = this.getHistoricalFactor(signal.topic || '')
    strength += historicalFactor * 0.15

    // Enhanced crypto-specific factors
    const categoryWeight = this.CRYPTO_CATEGORY_WEIGHTS[category] || 1.0
    strength *= categoryWeight

    // Engagement factor
    const engagementFactor = Math.min(1, (signal.engagement || 0) / 1000)
    strength += engagementFactor * 0.15

    // Influencer mention factor
    const influencerFactor = Math.min(1, (signal.influencerMentions?.length || 0) / 5)
    strength += influencerFactor * 0.1

    // Geographic spread factor
    const geoFactor = Math.min(1, (signal.geographicSpread?.length || 0) / 10)
    strength += geoFactor * 0.05

    // Market correlation factor
    const marketFactor = this.calculateMarketCorrelation(signal)
    strength += marketFactor * 0.1

    return Math.min(1, strength)
  }

  private calculateSignalVelocity(signal: Partial<TrendSignal>): number {
    const existingSignal = Array.from(this.activeSignals.values()).find((s) => s.topic === signal.topic)

    if (!existingSignal) return 1

    const timeDiff = Date.now() - existingSignal.timestamp
    // Guard against zero or negative time differences which can occur with clock skew or immediate reprocessing
    if (timeDiff <= 0) {
      return 0
    }
    const strengthDiff = (signal.strength || 0) - existingSignal.strength
    const mentionsDiff = (signal.mentions || 0) - existingSignal.mentions
    const engagementDiff = (signal.engagement || 0) - existingSignal.engagement

    // Weighted velocity calculation
    const intervalSec = timeDiff / 1000
    const strengthVelocity = strengthDiff / intervalSec
    const mentionsVelocity = mentionsDiff / intervalSec
    const engagementVelocity = engagementDiff / intervalSec

    return strengthVelocity * 0.5 + mentionsVelocity * 0.3 + engagementVelocity * 0.2
  }

  private calculateViralScore(signal: Partial<TrendSignal>): number {
    let viralScore = 0

    // Engagement rate factor
    const engagementRate = (signal.engagement || 0) / Math.max(1, signal.mentions || 1)
    viralScore += Math.min(1, engagementRate / 10) * 0.3

    // Velocity factor
    const velocity = signal.velocity || 0
    viralScore += Math.min(1, velocity) * 0.25

    // Sentiment extremity (both positive and negative can be viral)
    const sentimentExtremity = Math.abs(signal.sentiment || 0)
    viralScore += sentimentExtremity * 0.2

    // Influencer amplification
    const influencerBoost = Math.min(1, (signal.influencerMentions?.length || 0) / 3)
    viralScore += influencerBoost * 0.15

    // Cross-platform presence
    const crossPlatformBoost = this.getCrossPlatformBoost(signal.topic || '')
    viralScore += crossPlatformBoost * 0.1

    return Math.min(1, viralScore)
  }

  private categorizeTrend(topic: string, hashtags: string[]): CryptoTrendCategory {
    const topicLower = topic.toLowerCase()
    const hashtagsLower = hashtags.map((h) => h.toLowerCase())
    const allText = [topicLower, ...hashtagsLower].join(' ')

    // Meme coin indicators
    if (allText.match(/\b(meme|doge|shib|pepe|wojak|chad|moon|diamond|hands|hodl|ape|rocket)\b/)) {
      return CryptoTrendCategory.MEME_COIN
    }

    // DeFi indicators
    if (allText.match(/\b(defi|yield|farming|liquidity|swap|dex|uniswap|pancake|compound|aave)\b/)) {
      return CryptoTrendCategory.DEFI
    }

    // NFT indicators
    if (allText.match(/\b(nft|opensea|mint|collection|pfp|art|metaverse|avatar)\b/)) {
      return CryptoTrendCategory.NFT
    }

    // AI indicators
    if (allText.match(/\b(ai|artificial|intelligence|machine|learning|neural|gpt|llm)\b/)) {
      return CryptoTrendCategory.AI
    }

    // Regulation indicators
    if (allText.match(/\b(sec|regulation|ban|legal|compliance|government|policy|law)\b/)) {
      return CryptoTrendCategory.REGULATION
    }

    // Market sentiment indicators
    if (allText.match(/\b(bull|bear|crash|pump|dump|fud|fomo|fear|greed|sentiment)\b/)) {
      return CryptoTrendCategory.MARKET_SENTIMENT
    }

    // Technical analysis indicators
    if (allText.match(/\b(support|resistance|breakout|pattern|chart|technical|analysis|rsi|macd)\b/)) {
      return CryptoTrendCategory.TECHNICAL_ANALYSIS
    }

    // Gaming indicators
    if (allText.match(/\b(gaming|game|play|earn|p2e|guild|axie|sandbox|decentraland)\b/)) {
      return CryptoTrendCategory.GAMING
    }

    // Infrastructure indicators
    if (allText.match(/\b(layer|scaling|ethereum|bitcoin|solana|polygon|avalanche|cosmos)\b/)) {
      return CryptoTrendCategory.INFRASTRUCTURE
    }

    // Default to ecosystem
    return CryptoTrendCategory.ECOSYSTEM
  }

  private async getMarketData(topic: string): Promise<MarketData | undefined> {
    // Check cache first
    const cached = this.marketDataCache.get(topic)
    if (cached && Date.now() - cached.timestamp < 300000) {
      // 5 minutes cache
      return cached
    }

    try {
      // In a real implementation, this would call external APIs
      // For now, return mock data structure
      const marketData: MarketData = {
        price: 0,
        volume: 0,
        marketCap: 0,
        priceChange24h: 0,
        volumeChange24h: 0,
        socialVolume: 0,
        socialSentiment: 0,
        timestamp: Date.now(),
      }

      this.marketDataCache.set(topic, marketData)
      return marketData
    } catch (error) {
      console.error('Error fetching market data:', error)
      return undefined
    }
  }

  private calculateMarketCorrelation(signal: Partial<TrendSignal>): number {
    if (!signal.marketData) return 0

    const marketData = signal.marketData
    let correlation = 0

    // Price correlation with social sentiment
    const priceChange = marketData.priceChange24h
    const sentiment = signal.sentiment || 0
    if ((priceChange > 0 && sentiment > 0) || (priceChange < 0 && sentiment < 0)) {
      correlation += 0.3
    }

    // Volume correlation with social volume
    const volumeChange = marketData.volumeChange24h
    const socialVolume = marketData.socialVolume
    if (volumeChange > 0 && socialVolume > 100) {
      correlation += 0.3
    }

    // Social sentiment alignment
    const socialSentiment = marketData.socialSentiment
    if (Math.abs(sentiment - socialSentiment) < 0.2) {
      correlation += 0.4
    }

    return Math.min(1, correlation)
  }

  private getCrossPlatformBoost(topic: string): number {
    const crossPlatformTrend = this.crossPlatformTrends.get(topic)
    if (!crossPlatformTrend) return 0

    const platformCount = crossPlatformTrend.platforms.length
    const synchronization = crossPlatformTrend.synchronization

    return Math.min(1, (platformCount / 6) * synchronization)
  }

  private isSignificantTrend(signal: TrendSignal): boolean {
    return (
      signal.strength >= this.SIGNAL_THRESHOLD &&
      signal.sources.length >= this.MINIMUM_SOURCES &&
      signal.velocity > 0 &&
      (signal.viralScore > 0.5 || signal.category === CryptoTrendCategory.MEME_COIN)
    )
  }

  private updateActiveSignals(newSignals: Map<string, TrendSignal>): void {
    const now = Date.now()

    // Remove expired signals
    for (const [id, signal] of this.activeSignals) {
      if (now - signal.timestamp > this.TREND_TIMEOUT) {
        this.activeSignals.delete(id)
        this.archiveTrend(signal)
      }
    }

    // Add or update new signals
    for (const [id, signal] of newSignals) {
      this.activeSignals.set(id, signal)
    }

    this.emit('signalsUpdated', this.activeSignals)
  }

  private async updateCrossPlatformTrends(): Promise<void> {
    const topicGroups = new Map<string, TrendSignal[]>()

    // Group signals by topic
    for (const signal of this.activeSignals.values()) {
      if (!topicGroups.has(signal.topic)) {
        topicGroups.set(signal.topic, [])
      }
      topicGroups.get(signal.topic)!.push(signal)
    }

    // Analyze cross-platform trends
    for (const [topic, signals] of topicGroups) {
      if (signals.length > 1) {
        const platforms = [...new Set(signals.map((s) => s.platform))]
        const aggregatedStrength = signals.reduce((sum, s) => sum + s.strength, 0) / signals.length
        const dominantPlatform = signals.reduce((prev, current) =>
          prev.strength > current.strength ? prev : current,
        ).platform

        const crossPlatformVelocity = signals.reduce((sum, s) => sum + s.velocity, 0) / signals.length
        const synchronization = this.calculateSynchronization(signals)

        const crossPlatformTrend: CrossPlatformTrend = {
          topic,
          platforms,
          aggregatedStrength,
          dominantPlatform,
          crossPlatformVelocity,
          synchronization,
        }

        this.crossPlatformTrends.set(topic, crossPlatformTrend)
        this.emit('crossPlatformTrendDetected', crossPlatformTrend)
      }
    }
  }

  private calculateSynchronization(signals: TrendSignal[]): number {
    if (signals.length < 2) return 1

    const timestamps = signals.map((s) => s.timestamp)
    const maxTimeDiff = Math.max(...timestamps) - Math.min(...timestamps)
    const maxAllowedDiff = 1800000 // 30 minutes

    return Math.max(0, 1 - maxTimeDiff / maxAllowedDiff)
  }

  private archiveTrend(signal: TrendSignal): void {
    const analysis = this.analyzeTrend(signal)
    this.historicalTrends.set(signal.id, analysis)
    this.emit('trendArchived', { signal, analysis })
  }

  private analyzeTrend(signal: TrendSignal): TrendAnalysis {
    const marketCorrelation = this.calculateMarketCorrelation(signal)
    const predictedPeak = this.predictPeakTime(signal)
    const riskLevel = this.calculateRiskLevel(signal)
    const opportunityScore = this.calculateOpportunityScore(signal)
    const recommendedAction = this.getRecommendedAction(signal, riskLevel, opportunityScore)

    return {
      score: signal.strength,
      confidence: signal.sources.length / this.MINIMUM_SOURCES,
      momentum: signal.velocity,
      peakTime: signal.timestamp,
      durability: signal.strength * signal.velocity,
      marketCorrelation,
      predictedPeak,
      riskLevel,
      opportunityScore,
      recommendedAction,
    }
  }

  private predictPeakTime(signal: TrendSignal): number {
    const baseTime = signal.timestamp
    const velocity = signal.velocity
    const category = signal.category

    // Different categories have different peak patterns
    let peakMultiplier = 1
    switch (category) {
      case CryptoTrendCategory.MEME_COIN:
        peakMultiplier = 0.5 // Fast peaks
        break
      case CryptoTrendCategory.REGULATION:
        peakMultiplier = 2 // Slower development
        break
      case CryptoTrendCategory.MARKET_SENTIMENT:
        peakMultiplier = 0.3 // Very fast
        break
      default:
        peakMultiplier = 1
    }

    const timeToPeak = (1 / Math.max(0.1, velocity)) * 3600000 * peakMultiplier
    return baseTime + timeToPeak
  }

  private calculateRiskLevel(signal: TrendSignal): number {
    let risk = 0

    // Volatility risk
    if (signal.velocity > 2) risk += 0.3

    // Category risk
    if (signal.category === CryptoTrendCategory.MEME_COIN) risk += 0.4
    if (signal.category === CryptoTrendCategory.REGULATION) risk += 0.2

    // Sentiment extremity risk
    const sentimentRisk = Math.abs(signal.sentiment) > 0.8 ? 0.2 : 0
    risk += sentimentRisk

    // Market correlation risk
    if (signal.marketData && Math.abs(signal.marketData.priceChange24h) > 20) {
      risk += 0.1
    }

    return Math.min(1, risk)
  }

  private calculateOpportunityScore(signal: TrendSignal): number {
    let opportunity = 0

    // Viral potential
    opportunity += signal.viralScore * 0.4

    // Early stage bonus
    const stage = this.getTrendStage(signal.id)
    if (stage === TrendStage.EMERGING || stage === TrendStage.RISING) {
      opportunity += 0.3
    }

    // Cross-platform presence
    const crossPlatformBoost = this.getCrossPlatformBoost(signal.topic)
    opportunity += crossPlatformBoost * 0.2

    // Market alignment
    const marketCorrelation = this.calculateMarketCorrelation(signal)
    opportunity += marketCorrelation * 0.1

    return Math.min(1, opportunity)
  }

  private getRecommendedAction(
    signal: TrendSignal,
    riskLevel: number,
    opportunityScore: number,
  ): 'engage' | 'monitor' | 'avoid' {
    if (riskLevel > 0.7) return 'avoid'
    if (opportunityScore > 0.7 && riskLevel < 0.4) return 'engage'
    return 'monitor'
  }

  public getTrendStage(signalId: string): TrendStage {
    const signal = this.activeSignals.get(signalId)
    if (!signal) return TrendStage.DEAD

    const velocity = signal.velocity
    const age = (Date.now() - signal.timestamp) / this.TREND_TIMEOUT
    const viralScore = signal.viralScore

    // Enhanced stage detection with viral score
    if (age < 0.1 && velocity > 1.5 && viralScore > 0.7) return TrendStage.EMERGING
    if (age < 0.3 && velocity > 1.0) return TrendStage.RISING
    if (age < 0.5 && velocity > 0.5 && viralScore > 0.8) return TrendStage.PEAK
    if (age < 0.7 && velocity > 0.2) return TrendStage.PEAKING
    if (velocity > 0) return TrendStage.DECLINING
    if (age > 0.8) return TrendStage.DECLINE

    return TrendStage.DEAD
  }

  public getTrendMetrics(signalId: string): {
    stage: TrendStage
    timeToLive: number
    engagement: number
    potential: number
    viralScore: number
    marketCorrelation: number
    riskLevel: number
    opportunityScore: number
    recommendedAction: string
  } {
    const signal = this.activeSignals.get(signalId)
    if (!signal) {
      throw new Error(`Trend signal not found: ${signalId}`)
    }

    const stage = this.getTrendStage(signalId)
    const timeToLive = Math.max(0, this.TREND_TIMEOUT - (Date.now() - signal.timestamp))
    const engagement = signal.strength * signal.velocity
    const potential = this.calculateTrendPotential(signal)
    const marketCorrelation = this.calculateMarketCorrelation(signal)
    const riskLevel = this.calculateRiskLevel(signal)
    const opportunityScore = this.calculateOpportunityScore(signal)
    const recommendedAction = this.getRecommendedAction(signal, riskLevel, opportunityScore)

    return {
      stage,
      timeToLive,
      engagement,
      potential,
      viralScore: signal.viralScore,
      marketCorrelation,
      riskLevel,
      opportunityScore,
      recommendedAction,
    }
  }

  private calculateTrendPotential(signal: TrendSignal): number {
    const stage = this.getTrendStage(signal.id)
    const historicalFactor = this.getHistoricalFactor(signal.topic)
    const momentumFactor = Math.max(0, Math.min(1, signal.velocity))
    const sourceFactor = Math.min(1, signal.sources.length / (this.MINIMUM_SOURCES * 2))
    const viralFactor = signal.viralScore
    const categoryFactor = this.CRYPTO_CATEGORY_WEIGHTS[signal.category] || 1.0

    let potential = 0
    switch (stage) {
      case TrendStage.EMERGING:
        potential = 0.6 * viralFactor + 0.2 * historicalFactor + 0.2 * momentumFactor
        break
      case TrendStage.RISING:
        potential = 0.4 * momentumFactor + 0.3 * viralFactor + 0.3 * sourceFactor
        break
      case TrendStage.PEAK:
      case TrendStage.PEAKING:
        potential = 0.3 * momentumFactor + 0.4 * sourceFactor + 0.3 * viralFactor
        break
      default:
        potential = 0.2 * sourceFactor + 0.1 * viralFactor
    }

    return Math.min(1, potential * categoryFactor)
  }

  private getHistoricalFactor(topic: string): number {
    const history = Array.from(this.historicalTrends.values()).filter((trend) => trend.score > this.SIGNAL_THRESHOLD)

    if (history.length === 0) return 0.5

    const averageScore = history.reduce((acc, trend) => acc + trend.score, 0) / history.length
    return Math.min(1, averageScore)
  }

  private startTrendMonitoring(): void {
    setInterval(() => {
      this.cleanupExpiredTrends()
      this.updatePredictions()
    }, 60000) // Every minute
  }

  private startPredictiveAnalysis(): void {
    setInterval(() => {
      this.generateTrendPredictions()
    }, 300000) // Every 5 minutes
  }

  private cleanupExpiredTrends(): void {
    const now = Date.now()

    // Clean up expired cross-platform trends
    for (const [topic, trend] of this.crossPlatformTrends) {
      const hasActiveSignals = Array.from(this.activeSignals.values()).some((signal) => signal.topic === topic)

      if (!hasActiveSignals) {
        this.crossPlatformTrends.delete(topic)
      }
    }

    // Clean up old market data
    for (const [topic, data] of this.marketDataCache) {
      if (now - data.timestamp > 1800000) {
        // 30 minutes
        this.marketDataCache.delete(topic)
      }
    }
  }

  private updatePredictions(): void {
    for (const signal of this.activeSignals.values()) {
      const prediction = this.generatePrediction(signal)
      this.trendPredictions.set(signal.topic, prediction)
    }
  }

  private generatePrediction(signal: TrendSignal): TrendPrediction {
    const timeToPeak = this.predictPeakTime(signal) - Date.now()
    const predictedStrength = Math.min(1, signal.strength * (1 + signal.velocity * 0.5))
    const confidence = this.calculatePredictionConfidence(signal)
    const factors = this.identifyPredictionFactors(signal)
    const marketImpact = this.calculateMarketImpact(signal)

    return {
      topic: signal.topic,
      predictedStrength,
      timeToPeak: Math.max(0, timeToPeak),
      confidence,
      factors,
      marketImpact,
    }
  }

  // Helper to return unified trend objects used by ContentAmplifier
  public async getUnifiedTrends(): Promise<TrendSignal[]> {
    // Return a shallow copy of active signals so callers can inspect full trend data
    return Array.from(this.activeSignals.values()).map((s) => ({ ...s }))
  }

  private calculatePredictionConfidence(signal: TrendSignal): number {
    let confidence = 0

    // Historical data availability
    const historicalFactor = this.getHistoricalFactor(signal.topic)
    confidence += historicalFactor * 0.3

    // Source reliability
    const sourceFactor = Math.min(1, signal.sources.length / 10)
    confidence += sourceFactor * 0.2

    // Market data availability
    if (signal.marketData) confidence += 0.2

    // Cross-platform presence
    const crossPlatformFactor = this.getCrossPlatformBoost(signal.topic)
    confidence += crossPlatformFactor * 0.2

    // Signal stability
    const stabilityFactor = Math.min(1, 1 / Math.max(0.1, Math.abs(signal.velocity)))
    confidence += stabilityFactor * 0.1

    return Math.min(1, confidence)
  }

  private identifyPredictionFactors(signal: TrendSignal): string[] {
    const factors: string[] = []

    if (signal.viralScore > 0.7) factors.push('High viral potential')
    if (signal.velocity > 1.5) factors.push('Rapid momentum')
    if (signal.influencerMentions.length > 3) factors.push('Influencer amplification')
    if (this.getCrossPlatformBoost(signal.topic) > 0.5) factors.push('Cross-platform presence')
    if (signal.marketData && Math.abs(signal.marketData.priceChange24h) > 10) {
      factors.push('Market volatility')
    }
    if (signal.category === CryptoTrendCategory.MEME_COIN) factors.push('Meme coin dynamics')
    if (signal.sentiment > 0.7) factors.push('Positive sentiment')
    if (signal.sentiment < -0.7) factors.push('Negative sentiment')

    return factors
  }

  private calculateMarketImpact(signal: TrendSignal): number {
    let impact = 0

    // Category impact weights
    const categoryImpacts = {
      [CryptoTrendCategory.REGULATION]: 0.9,
      [CryptoTrendCategory.MARKET_SENTIMENT]: 0.8,
      [CryptoTrendCategory.MEME_COIN]: 0.6,
      [CryptoTrendCategory.DEFI]: 0.7,
      [CryptoTrendCategory.AI]: 0.5,
      [CryptoTrendCategory.NFT]: 0.4,
      [CryptoTrendCategory.GAMING]: 0.3,
      [CryptoTrendCategory.INFRASTRUCTURE]: 0.8,
      [CryptoTrendCategory.TECHNICAL_ANALYSIS]: 0.2,
      [CryptoTrendCategory.ECOSYSTEM]: 0.5,
    }

    impact += (categoryImpacts[signal.category] || 0.3) * 0.4

    // Viral score impact
    impact += signal.viralScore * 0.3

    // Cross-platform impact
    const crossPlatformFactor = this.getCrossPlatformBoost(signal.topic)
    impact += crossPlatformFactor * 0.2

    // Market correlation impact
    const marketCorrelation = this.calculateMarketCorrelation(signal)
    impact += marketCorrelation * 0.1

    return Math.min(1, impact)
  }

  private generateTrendPredictions(): void {
    const predictions: TrendPrediction[] = []

    for (const signal of this.activeSignals.values()) {
      const prediction = this.generatePrediction(signal)
      predictions.push(prediction)
    }

    // Sort by potential impact
    predictions.sort((a, b) => b.predictedStrength * b.confidence - a.predictedStrength * a.confidence)

    this.emit('predictionsUpdated', predictions.slice(0, 20)) // Top 20 predictions
  }

  // Public API methods
  public getActiveTrends(): Map<string, TrendSignal> {
    return new Map(this.activeSignals)
  }

  public getTopTrends(limit: number = 10): TrendSignal[] {
    return Array.from(this.activeSignals.values())
      .sort((a, b) => b.strength * b.viralScore - a.strength * a.viralScore)
      .slice(0, limit)
  }

  public getTrendsByCategory(category: CryptoTrendCategory): TrendSignal[] {
    return Array.from(this.activeSignals.values())
      .filter((signal) => signal.category === category)
      .sort((a, b) => b.strength - a.strength)
  }

  public getViralTrends(threshold: number = 0.8): TrendSignal[] {
    return Array.from(this.activeSignals.values())
      .filter((signal) => signal.viralScore >= threshold)
      .sort((a, b) => b.viralScore - a.viralScore)
  }

  public getCrossPlatformTrends(): Map<string, CrossPlatformTrend> {
    return new Map(this.crossPlatformTrends)
  }

  public getTrendPredictions(): Map<string, TrendPrediction> {
    return new Map(this.trendPredictions)
  }

  public getRelatedTrends(topic: string): TrendSignal[] {
    return Array.from(this.activeSignals.values()).filter(
      (signal) =>
        signal.topic === topic ||
        signal.relatedTopics.includes(topic) ||
        signal.hashtags.some((tag) => topic.toLowerCase().includes(tag.toLowerCase())),
    )
  }

  public getHistoricalAnalysis(): Map<string, TrendAnalysis> {
    return new Map(this.historicalTrends)
  }

  public async refreshMarketData(topics: string[]): Promise<void> {
    for (const topic of topics) {
      await this.getMarketData(topic)
    }
  }
}
