import { LLMService } from '../llm/LLMService'

export interface ViralScore {
  total: number
  components: {
    timing: number
    content: number
    engagement: number
    momentum: number
    audience: number
    platform: number
  }
  metadata: {
    timestamp: number
    confidence: number
    suggestions: string[]
    platform: string
    contentType: string
  }
}

export interface ContentOptimization {
  originalContent: string
  optimizedContent: string
  changes: ContentChange[]
  predictedImpact: number
  viralScore: ViralScore
  abTestVariations?: ContentVariation[]
}

export interface ContentChange {
  type: 'addition' | 'removal' | 'modification' | 'reorder'
  location: 'start' | 'middle' | 'end' | 'hashtags' | 'mentions'
  reason: string
  impact: number
  originalText?: string
  newText?: string
}

export interface ContentVariation {
  id: string
  content: string
  viralScore: number
  testingStrategy: 'timing' | 'hashtags' | 'tone' | 'length' | 'cta'
  expectedPerformance: number
}

export interface PlatformOptimizationRules {
  maxLength: number
  optimalLength: number
  hashtagLimit: number
  mentionLimit: number
  preferredTone: 'casual' | 'professional' | 'humorous' | 'urgent'
  peakHours: number[][]
  engagementFactors: string[]
  contentTypes: string[]
}

export interface SentimentAnalysis {
  score: number // -1 to 1
  magnitude: number // 0 to 1
  emotions: {
    joy: number
    anger: number
    fear: number
    surprise: number
    sadness: number
    excitement: number
  }
  toxicity: number
  confidence: number
}

export class ViralContentOptimizer {
  private llmService: LLMService
  private readonly VIRAL_THRESHOLD = 0.7
  private readonly BOOST_PATTERNS = new Map<string, number>([
    ['emotion', 0.25],
    ['urgency', 0.2],
    ['curiosity', 0.2],
    ['controversy', 0.15],
    ['trending', 0.25],
    ['social_proof', 0.2],
    ['scarcity', 0.15],
    ['humor', 0.2],
    ['call_to_action', 0.15],
    ['personal_story', 0.1],
  ])

  private readonly PLATFORM_RULES: Record<string, PlatformOptimizationRules> = {
    twitter: {
      maxLength: 280,
      optimalLength: 120,
      hashtagLimit: 3,
      mentionLimit: 5,
      preferredTone: 'casual',
      peakHours: [
        [8, 10],
        [12, 14],
        [17, 19],
        [20, 22],
      ],
      engagementFactors: ['retweets', 'replies', 'likes', 'quotes'],
      contentTypes: ['text', 'image', 'video', 'thread'],
    },
    discord: {
      maxLength: 2000,
      optimalLength: 300,
      hashtagLimit: 0,
      mentionLimit: 10,
      preferredTone: 'casual',
      peakHours: [
        [14, 16],
        [19, 23],
      ],
      engagementFactors: ['reactions', 'replies', 'mentions'],
      contentTypes: ['text', 'image', 'embed'],
    },
    telegram: {
      maxLength: 4096,
      optimalLength: 500,
      hashtagLimit: 5,
      mentionLimit: 15,
      preferredTone: 'professional',
      peakHours: [
        [9, 11],
        [15, 17],
        [20, 22],
      ],
      engagementFactors: ['views', 'forwards', 'reactions'],
      contentTypes: ['text', 'image', 'video', 'poll'],
    },
  }

  private readonly CRYPTO_KEYWORDS = [
    'moon',
    'diamond hands',
    'hodl',
    'ape',
    'degen',
    'alpha',
    'fud',
    'fomo',
    'pump',
    'dump',
    'bullish',
    'bearish',
    'rekt',
    'wagmi',
    'ngmi',
    'gm',
    'gn',
    'ser',
    'anon',
    'based',
    'cope',
    'seethe',
    'mald',
    'hopium',
    'copium',
  ]

  private readonly VIRAL_TRIGGERS = [
    'breaking:',
    'urgent:',
    'exclusive:',
    'leaked:',
    'confirmed:',
    'rumor:',
    'just in:',
    'developing:',
    'alert:',
    'update:',
    'thread:',
    'mega thread:',
  ]

  constructor(llmService: LLMService) {
    this.llmService = llmService
  }

  public async calculateViralPotential(
    content: string,
    context: {
      platform: string
      audience: string[]
      timeOfDay: number
      recentTrends: string[]
      marketCondition?: 'bull' | 'bear' | 'crab'
      contentType?: string
    },
  ): Promise<ViralScore> {
    try {
      const components = {
        timing: await this.calculateTimingScore(context.timeOfDay, context.platform),
        content: await this.calculateContentScore(content, context.platform),
        engagement: await this.calculateEngagementPotential(content, context),
        momentum: await this.calculateMomentumScore(context.recentTrends, content),
        audience: await this.calculateAudienceScore(context.audience, content),
        platform: await this.calculatePlatformScore(content, context.platform),
      }

      const total = this.calculateTotalScore(components)
      const suggestions = await this.generateOptimizationSuggestions(content, components, total, context.platform)

      return {
        total,
        components,
        metadata: {
          timestamp: Date.now(),
          confidence: this.calculateConfidence(components),
          suggestions,
          platform: context.platform,
          contentType: context.contentType || 'text',
        },
      }
    } catch (error) {
      console.error('Error calculating viral potential:', error)
      throw error
    }
  }

  public async optimizeContent(
    content: string,
    platform: string,
    targetScore: number = 0.8,
    options: {
      preserveCore?: boolean
      maxIterations?: number
      generateVariations?: boolean
    } = {},
  ): Promise<ContentOptimization> {
    try {
      const { preserveCore = true, maxIterations = 5, generateVariations = false } = options
      const changes: ContentChange[] = []
      let currentContent = content
      let iterations = 0

      // Get initial score
      const initialScore = await this.calculateContentScore(content, platform)
      let currentScore = initialScore

      while (currentScore < targetScore && iterations < maxIterations) {
        const optimizations = await this.identifyOptimizations(
          currentContent,
          currentScore,
          targetScore,
          platform,
          preserveCore,
        )

        if (optimizations.length === 0) break

        // Apply optimizations in order of impact
        for (const optimization of optimizations.slice(0, 3)) {
          currentContent = await this.applyOptimization(currentContent, optimization)
          changes.push(optimization)
        }

        currentScore = await this.calculateContentScore(currentContent, platform)
        iterations++
      }

      // Calculate final viral score
      const viralScore = await this.calculateViralPotential(currentContent, {
        platform,
        audience: ['crypto', 'defi', 'trading'],
        timeOfDay: Date.now(),
        recentTrends: [],
      })

      // Generate A/B test variations if requested
      let abTestVariations: ContentVariation[] | undefined
      if (generateVariations) {
        abTestVariations = await this.generateABTestVariations(currentContent, platform)
      }

      return {
        originalContent: content,
        optimizedContent: currentContent,
        changes,
        predictedImpact: currentScore - initialScore,
        viralScore,
        abTestVariations,
      }
    } catch (error) {
      console.error('Error optimizing content:', error)
      throw error
    }
  }

  public async calculateTimingScore(timeOfDay: number, platform: string): Promise<number> {
    const rules = this.PLATFORM_RULES[platform] || this.PLATFORM_RULES.twitter
    const hour = new Date(timeOfDay).getHours()
    const dayOfWeek = new Date(timeOfDay).getDay()

    let score = 0

    // Check peak hours
    for (const [start, end] of rules.peakHours) {
      if (hour >= start && hour <= end) {
        score = 1
        break
      }

      // Calculate distance penalty
      const distanceToStart = Math.abs(hour - start)
      const distanceToEnd = Math.abs(hour - end)
      const minDistance = Math.min(distanceToStart, distanceToEnd)
      score = Math.max(score, Math.max(0, 1 - minDistance * 0.15))
    }

    // Weekend penalty for professional content
    if ((dayOfWeek === 0 || dayOfWeek === 6) && rules.preferredTone === 'professional') {
      score *= 0.8
    }

    // Weekday bonus for casual content
    if (dayOfWeek >= 1 && dayOfWeek <= 5 && rules.preferredTone === 'casual') {
      score *= 1.1
    }

    return Math.min(1, score)
  }

  public async generateOptimizationSuggestions(
    content: string,
    components: Record<string, number>,
    totalScore: number,
    platform: string,
  ): Promise<string[]> {
    const suggestions: string[] = []
    const rules = this.PLATFORM_RULES[platform] || this.PLATFORM_RULES.twitter

    // Content length optimization
    if (content.length > rules.maxLength) {
      suggestions.push(`Content is too long (${content.length}/${rules.maxLength}). Consider shortening.`)
    } else if (content.length < rules.optimalLength * 0.5) {
      suggestions.push(`Content might be too short. Consider adding more context or details.`)
    }

    // Hashtag optimization
    const hashtagCount = (content.match(/#\w+/g) || []).length
    if (hashtagCount > rules.hashtagLimit) {
      suggestions.push(`Too many hashtags (${hashtagCount}/${rules.hashtagLimit}). Remove some for better readability.`)
    } else if (hashtagCount === 0 && rules.hashtagLimit > 0) {
      suggestions.push('Consider adding relevant hashtags to increase discoverability.')
    }

    // Component-specific suggestions
    if (components.timing < 0.5) {
      suggestions.push('Consider posting during peak hours for better engagement.')
    }

    if (components.engagement < 0.4) {
      suggestions.push('Add a call-to-action or question to encourage engagement.')
    }

    if (components.content < 0.6) {
      suggestions.push('Consider adding emotional triggers or trending keywords.')
    }

    // AI-generated suggestions
    try {
      const prompt = `
        Analyze this ${platform} content and provide 3 specific optimization suggestions:
        Content: "${content}"
        Current viral score: ${totalScore.toFixed(2)}
        Platform: ${platform}
        
        Focus on:
        - Emotional impact
        - Engagement triggers
        - Platform-specific best practices
        - Trending elements
        
        Provide actionable, specific suggestions.
      `

      const aiSuggestions = await this.llmService.generateResponse(prompt, 'groq', {
        maxTokens: 200,
        temperature: 0.7,
      })

      if (aiSuggestions) {
        const parsedSuggestions = aiSuggestions
          .split('\n')
          .filter((s) => s.trim().length > 0)
          .slice(0, 3)
        suggestions.push(...parsedSuggestions)
      }
    } catch (error) {
      console.error('Error generating AI suggestions:', error)
    }

    return suggestions.slice(0, 8) // Limit to 8 suggestions
  }

  private async calculateContentScore(content: string, platform: string): Promise<number> {
    let score = 0
    const rules = this.PLATFORM_RULES[platform] || this.PLATFORM_RULES.twitter

    // Check for viral patterns
    for (const [pattern, weight] of this.BOOST_PATTERNS.entries()) {
      if (await this.containsPattern(content, pattern)) {
        score += weight
      }
    }

    // Crypto-specific keywords bonus
    const cryptoKeywordCount = this.CRYPTO_KEYWORDS.filter((keyword) => content.toLowerCase().includes(keyword)).length
    score += Math.min(0.2, cryptoKeywordCount * 0.05)

    // Viral triggers bonus
    const viralTriggerCount = this.VIRAL_TRIGGERS.filter((trigger) => content.toLowerCase().includes(trigger)).length
    score += Math.min(0.15, viralTriggerCount * 0.1)

    // Sentiment analysis
    const sentiment = await this.analyzeSentiment(content)
    score += Math.abs(sentiment.score) * 0.15 // Strong emotions (positive or negative)
    score += sentiment.emotions.excitement * 0.1
    score += sentiment.emotions.joy * 0.08

    // Toxicity penalty
    score -= sentiment.toxicity * 0.3

    // Readability score
    const readability = this.calculateReadability(content)
    score += (1 - readability) * 0.1 // Easier to read = higher score

    // Length optimization
    const lengthRatio = content.length / rules.optimalLength
    if (lengthRatio >= 0.5 && lengthRatio <= 1.5) {
      score += 0.1 // Optimal length bonus
    } else if (lengthRatio > 2) {
      score -= 0.15 // Too long penalty
    }

    // Hashtag optimization
    const hashtagCount = (content.match(/#\w+/g) || []).length
    if (hashtagCount > 0 && hashtagCount <= rules.hashtagLimit) {
      score += 0.05
    }

    // Mention optimization
    const mentionCount = (content.match(/@\w+/g) || []).length
    if (mentionCount > 0 && mentionCount <= rules.mentionLimit) {
      score += 0.03
    }

    return Math.min(1, Math.max(0, score))
  }

  private async containsPattern(content: string, pattern: string): Promise<boolean> {
    const contentLower = content.toLowerCase()

    // Rule-based pattern detection for performance
    switch (pattern) {
      case 'emotion':
        const emotionWords = [
          'amazing',
          'incredible',
          'shocking',
          'unbelievable',
          'insane',
          'crazy',
          'wild',
          'epic',
          'legendary',
          'mind-blowing',
        ]
        return emotionWords.some((word) => contentLower.includes(word))

      case 'urgency':
        const urgencyWords = [
          'now',
          'urgent',
          'breaking',
          'alert',
          'immediate',
          'asap',
          'quickly',
          'hurry',
          'limited time',
          'ending soon',
        ]
        return urgencyWords.some((word) => contentLower.includes(word))

      case 'curiosity':
        return (
          contentLower.includes('?') ||
          contentLower.includes('what if') ||
          contentLower.includes("you won't believe") ||
          contentLower.includes('secret') ||
          contentLower.includes('hidden')
        )

      case 'controversy':
        const controversyWords = ['controversial', 'debate', 'argue', 'disagree', 'unpopular opinion', 'hot take']
        return controversyWords.some((word) => contentLower.includes(word))

      case 'social_proof':
        const proofWords = ['everyone', 'trending', 'viral', 'popular', 'thousands', 'millions', 'community']
        return proofWords.some((word) => contentLower.includes(word))

      case 'scarcity':
        const scarcityWords = ['limited', 'exclusive', 'rare', 'only', 'last chance', 'few left', 'running out']
        return scarcityWords.some((word) => contentLower.includes(word))

      case 'humor':
        const humorWords = ['lol', 'lmao', 'haha', 'funny', 'hilarious', '😂', '🤣', 'joke', 'meme']
        return humorWords.some((word) => contentLower.includes(word))

      case 'call_to_action':
        return this.hasCallToAction(content)

      case 'personal_story':
        const storyWords = ['i', 'my', 'me', 'personal', 'story', 'experience', 'happened to me']
        return storyWords.some((word) => contentLower.includes(word))

      default:
        // Fallback to AI analysis for complex patterns
        try {
          const prompt = `Does this content contain ${pattern}? Answer only "yes" or "no": "${content}"`
          const response = await this.llmService.generateResponse(prompt, 'groq', { maxTokens: 10 })
          return response?.toLowerCase().includes('yes') || false
        } catch {
          return false
        }
    }
  }

  private calculateReadability(content: string): number {
    const words = content.split(/\s+/).filter((word) => word.length > 0)
    const sentences = content.split(/[.!?]+/).filter((s) => s.trim().length > 0)

    if (words.length === 0 || sentences.length === 0) return 1

    const avgWordsPerSentence = words.length / sentences.length
    const avgSyllablesPerWord = words.reduce((sum, word) => sum + this.countSyllables(word), 0) / words.length

    // Flesch Reading Ease Score
    const score = 206.835 - 1.015 * avgWordsPerSentence - 84.6 * avgSyllablesPerWord

    // Convert to 0-1 scale (higher = more readable)
    return Math.max(0, Math.min(1, score / 100))
  }

  private countSyllables(word: string): number {
    word = word.toLowerCase().replace(/[^a-z]/g, '')
    if (word.length === 0) return 0

    const vowels = 'aeiouy'
    let count = 0
    let previousWasVowel = false

    for (let i = 0; i < word.length; i++) {
      const isVowel = vowels.includes(word[i])
      if (isVowel && !previousWasVowel) {
        count++
      }
      previousWasVowel = isVowel
    }

    // Handle silent 'e'
    if (word.endsWith('e') && count > 1) {
      count--
    }

    return Math.max(1, count)
  }

  private async calculateEngagementPotential(content: string, context: any): Promise<number> {
    let score = 0

    // Basic engagement factors
    const factors = {
      callToAction: this.hasCallToAction(content) ? 0.2 : 0,
      questionPrompt: content.includes('?') ? 0.15 : 0,
      mentionsUsers: content.includes('@') ? 0.1 : 0,
      hasHashtags: content.includes('#') ? 0.1 : 0,
      hasEmojis: /[\u{1F600}-\u{1F64F}]|[\u{1F300}-\u{1F5FF}]|[\u{1F680}-\u{1F6FF}]|[\u{1F1E0}-\u{1F1FF}]/u.test(
        content,
      )
        ? 0.05
        : 0,
    }

    score = Object.values(factors).reduce((sum, value) => sum + value, 0)

    // Platform-specific engagement factors
    const platform = context.platform || 'twitter'
    const rules = this.PLATFORM_RULES[platform]

    if (rules) {
      // Length optimization for engagement
      const lengthRatio = content.length / rules.optimalLength
      if (lengthRatio >= 0.7 && lengthRatio <= 1.3) {
        score += 0.1
      }

      // Tone matching
      const detectedTone = await this.detectTone(content)
      if (detectedTone === rules.preferredTone) {
        score += 0.15
      }
    }

    // Audience relevance
    if (context.audience && context.audience.length > 0) {
      const relevance = await this.checkAudienceRelevance(content, context.audience)
      score += relevance ? 0.2 : 0
    }

    return Math.min(1, score)
  }

  private hasCallToAction(content: string): boolean {
    const ctaPatterns = [
      'like',
      'share',
      'follow',
      'retweet',
      'comment',
      'reply',
      'dm',
      'tell us',
      'what do you think',
      'thoughts?',
      'agree?',
      'disagree?',
      'tag someone',
      'share this',
      'rt if',
      'like if',
      'comment below',
      'let me know',
      'drop a',
      'sound off',
      'weigh in',
    ]

    const contentLower = content.toLowerCase()
    return ctaPatterns.some((pattern) => contentLower.includes(pattern))
  }

  private async detectTone(content: string): Promise<'casual' | 'professional' | 'humorous' | 'urgent'> {
    const contentLower = content.toLowerCase()

    // Rule-based tone detection
    const urgentWords = ['urgent', 'breaking', 'alert', 'now', 'immediately', 'asap']
    const humorWords = ['lol', 'haha', 'funny', '😂', '🤣', 'joke', 'meme']
    const professionalWords = ['analysis', 'research', 'data', 'study', 'report', 'findings']
    const casualWords = ['hey', 'yo', 'sup', 'gonna', 'wanna', 'btw', 'tbh']

    if (urgentWords.some((word) => contentLower.includes(word))) return 'urgent'
    if (humorWords.some((word) => contentLower.includes(word))) return 'humorous'
    if (professionalWords.some((word) => contentLower.includes(word))) return 'professional'
    if (casualWords.some((word) => contentLower.includes(word))) return 'casual'

    // Default based on content characteristics
    if (content.includes('!') || content.includes('?')) return 'casual'
    if (content.length > 200) return 'professional'

    return 'casual'
  }

  private async checkAudienceRelevance(content: string, audience: string[]): Promise<boolean> {
    const contentLower = content.toLowerCase()

    // Check for audience-specific keywords
    const audienceKeywords = {
      crypto: ['crypto', 'bitcoin', 'ethereum', 'defi', 'nft', 'blockchain', 'token', 'coin'],
      trading: ['trade', 'buy', 'sell', 'pump', 'dump', 'chart', 'analysis', 'market'],
      tech: ['technology', 'ai', 'ml', 'software', 'code', 'development', 'innovation'],
      finance: ['money', 'investment', 'portfolio', 'returns', 'profit', 'loss', 'financial'],
    }

    for (const audienceType of audience) {
      const keywords = audienceKeywords[audienceType as keyof typeof audienceKeywords] || []
      if (keywords.some((keyword) => contentLower.includes(keyword))) {
        return true
      }
    }

    return false
  }

  private async calculateMomentumScore(recentTrends: string[], content: string): Promise<number> {
    if (!recentTrends.length) return 0

    let score = 0
    const contentLower = content.toLowerCase()

    // Check trend relevance with decay
    const weights = [0.4, 0.3, 0.2, 0.1] // Weights for trend recency

    for (let i = 0; i < Math.min(recentTrends.length, 4); i++) {
      const trend = recentTrends[i].toLowerCase()
      if (contentLower.includes(trend)) {
        score += weights[i]
      }
    }

    // Bonus for multiple trend mentions
    const trendMentions = recentTrends.filter((trend) => contentLower.includes(trend.toLowerCase())).length

    if (trendMentions > 1) {
      score += 0.1 * (trendMentions - 1)
    }

    return Math.min(1, score)
  }

  private async calculateAudienceScore(audience: string[], content: string): Promise<number> {
    if (!audience.length) return 0.5

    let score = 0
    const relevanceScore = (await this.checkAudienceRelevance(content, audience)) ? 0.5 : 0

    // Audience size factor (more diverse audience = higher potential reach)
    const diversityBonus = Math.min(0.3, audience.length * 0.1)

    // Content complexity matching
    const readability = this.calculateReadability(content)
    const complexityMatch = audience.includes('professional') ? (1 - readability) * 0.2 : readability * 0.2

    score = relevanceScore + diversityBonus + complexityMatch

    return Math.min(1, score)
  }

  private async calculatePlatformScore(content: string, platform: string): Promise<number> {
    const rules = this.PLATFORM_RULES[platform]
    if (!rules) return 0.5

    let score = 0

    // Length optimization
    const lengthRatio = content.length / rules.optimalLength
    if (lengthRatio >= 0.5 && lengthRatio <= 1.5) {
      score += 0.3
    } else if (lengthRatio > 2) {
      score -= 0.2
    }

    // Hashtag compliance
    const hashtagCount = (content.match(/#\w+/g) || []).length
    if (hashtagCount <= rules.hashtagLimit) {
      score += 0.2
    } else {
      score -= 0.1
    }

    // Mention compliance
    const mentionCount = (content.match(/@\w+/g) || []).length
    if (mentionCount <= rules.mentionLimit) {
      score += 0.1
    }

    // Tone matching
    const detectedTone = await this.detectTone(content)
    if (detectedTone === rules.preferredTone) {
      score += 0.2
    }

    // Platform-specific features
    if (platform === 'twitter' && content.includes('🧵')) {
      score += 0.1 // Thread indicator
    }

    if (platform === 'discord' && content.includes('||')) {
      score += 0.05 // Spoiler tags
    }

    return Math.min(1, Math.max(0, score))
  }

  private calculateTotalScore(components: Record<string, number>): number {
    const weights = {
      timing: 0.15,
      content: 0.25,
      engagement: 0.2,
      momentum: 0.15,
      audience: 0.15,
      platform: 0.1,
    }

    return Object.entries(components).reduce(
      (total, [component, score]) => total + score * (weights[component as keyof typeof weights] || 0),
      0,
    )
  }

  private calculateConfidence(components: Record<string, number>): number {
    const values = Object.values(components)
    const mean = values.reduce((sum, val) => sum + val, 0) / values.length
    const variance = values.reduce((sum, val) => sum + Math.pow(val - mean, 2), 0) / values.length
    const standardDeviation = Math.sqrt(variance)

    // Lower standard deviation = higher confidence
    return Math.max(0, 1 - standardDeviation)
  }

  private async identifyOptimizations(
    content: string,
    currentScore: number,
    targetScore: number,
    platform: string,
    preserveCore: boolean,
  ): Promise<ContentChange[]> {
    const optimizations: ContentChange[] = []
    const rules = this.PLATFORM_RULES[platform] || this.PLATFORM_RULES.twitter

    // Length optimization
    if (content.length > rules.maxLength) {
      optimizations.push({
        type: 'modification',
        location: 'end',
        reason: 'Content exceeds platform limit',
        impact: 0.2,
        originalText: content.slice(rules.maxLength),
        newText: '',
      })
    }

    // Add hashtags if missing
    const hashtagCount = (content.match(/#\w+/g) || []).length
    if (hashtagCount === 0 && rules.hashtagLimit > 0) {
      optimizations.push({
        type: 'addition',
        location: 'end',
        reason: 'Add relevant hashtags for discoverability',
        impact: 0.15,
        newText: ' #crypto #defi',
      })
    }

    // Add call-to-action if missing
    if (!this.hasCallToAction(content)) {
      optimizations.push({
        type: 'addition',
        location: 'end',
        reason: 'Add call-to-action to increase engagement',
        impact: 0.2,
        newText: '\n\nWhat do you think?',
      })
    }

    // Add emotional triggers
    const hasEmotion = await this.containsPattern(content, 'emotion')
    if (!hasEmotion && !preserveCore) {
      optimizations.push({
        type: 'modification',
        location: 'start',
        reason: 'Add emotional trigger for viral potential',
        impact: 0.25,
        newText: '🚨 BREAKING: ',
      })
    }

    // Add urgency if appropriate
    const hasUrgency = await this.containsPattern(content, 'urgency')
    if (!hasUrgency && currentScore < 0.6) {
      optimizations.push({
        type: 'addition',
        location: 'start',
        reason: 'Add urgency to increase engagement',
        impact: 0.2,
        newText: 'URGENT: ',
      })
    }

    // Sort by impact (highest first)
    return optimizations.sort((a, b) => b.impact - a.impact)
  }

  private async applyOptimization(content: string, optimization: ContentChange): Promise<string> {
    switch (optimization.type) {
      case 'addition':
        if (optimization.location === 'start') {
          return (optimization.newText || '') + content
        } else if (optimization.location === 'end') {
          return content + (optimization.newText || '')
        } else {
          // Middle insertion
          const midPoint = Math.floor(content.length / 2)
          return content.slice(0, midPoint) + (optimization.newText || '') + content.slice(midPoint)
        }

      case 'removal':
        if (optimization.originalText) {
          return content.replace(optimization.originalText, '')
        }
        return content

      case 'modification':
        if (optimization.originalText && optimization.newText) {
          return content.replace(optimization.originalText, optimization.newText)
        } else if (optimization.location === 'start' && optimization.newText) {
          return optimization.newText + content
        } else if (optimization.location === 'end' && optimization.originalText) {
          return content.replace(optimization.originalText, '')
        }
        return content

      case 'reorder':
        // Simple reordering logic - move sentences around
        const sentences = content.split(/[.!?]+/).filter((s) => s.trim())
        if (sentences.length > 1) {
          // Move most impactful sentence to front
          return sentences.reverse().join('. ') + '.'
        }
        return content

      default:
        return content
    }
  }

  private async generateABTestVariations(content: string, platform: string): Promise<ContentVariation[]> {
    const variations: ContentVariation[] = []

    try {
      // Timing variation
      variations.push({
        id: 'timing-peak',
        content,
        viralScore: await this.calculateContentScore(content, platform),
        testingStrategy: 'timing',
        expectedPerformance: 0.8,
      })

      // Hashtag variation
      const hashtagVariation = content + ' #trending #viral'
      variations.push({
        id: 'hashtag-boost',
        content: hashtagVariation,
        viralScore: await this.calculateContentScore(hashtagVariation, platform),
        testingStrategy: 'hashtags',
        expectedPerformance: 0.75,
      })

      // Tone variation (more casual)
      const casualPrompt = `Rewrite this content in a more casual, engaging tone for ${platform}: "${content}"`
      const casualVariation = await this.llmService.generateResponse(casualPrompt, 'groq', {
        maxTokens: 200,
        temperature: 0.8,
      })

      if (casualVariation) {
        variations.push({
          id: 'tone-casual',
          content: casualVariation,
          viralScore: await this.calculateContentScore(casualVariation, platform),
          testingStrategy: 'tone',
          expectedPerformance: 0.7,
        })
      }

      // Length variation (shorter)
      const shortPrompt = `Make this content shorter and punchier for ${platform}: "${content}"`
      const shortVariation = await this.llmService.generateResponse(shortPrompt, 'groq', {
        maxTokens: 100,
        temperature: 0.6,
      })

      if (shortVariation) {
        variations.push({
          id: 'length-short',
          content: shortVariation,
          viralScore: await this.calculateContentScore(shortVariation, platform),
          testingStrategy: 'length',
          expectedPerformance: 0.65,
        })
      }

      // CTA variation
      const ctaVariation = content + '\n\nDrop your thoughts below! 👇'
      variations.push({
        id: 'cta-strong',
        content: ctaVariation,
        viralScore: await this.calculateContentScore(ctaVariation, platform),
        testingStrategy: 'cta',
        expectedPerformance: 0.72,
      })
    } catch (error) {
      console.error('Error generating A/B test variations:', error)
    }

    return variations.sort((a, b) => b.expectedPerformance - a.expectedPerformance)
  }

  private async analyzeSentiment(content: string): Promise<SentimentAnalysis> {
    try {
      const prompt = `
        Analyze the sentiment and emotions in this content. Return JSON only:
        "${content}"
        
        Format: {
          "score": number (-1 to 1),
          "magnitude": number (0 to 1),
          "emotions": {
            "joy": number (0 to 1),
            "anger": number (0 to 1),
            "fear": number (0 to 1),
            "surprise": number (0 to 1),
            "sadness": number (0 to 1),
            "excitement": number (0 to 1)
          },
          "toxicity": number (0 to 1),
          "confidence": number (0 to 1)
        }
      `

      const response = await this.llmService.generateResponse(prompt, 'groq', { maxTokens: 300, temperature: 0.3 })

      if (response) {
        const parsed = JSON.parse(response)
        return parsed
      }
    } catch (error) {
      console.error('Error analyzing sentiment:', error)
    }

    // Fallback to basic sentiment analysis
    return {
      score: 0,
      magnitude: 0.5,
      emotions: {
        joy: 0,
        anger: 0,
        fear: 0,
        surprise: 0,
        sadness: 0,
        excitement: 0,
      },
      toxicity: 0,
      confidence: 0.5,
    }
  }
}
