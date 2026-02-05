import { EventEmitter } from 'events'

// Types and Interfaces
export interface MemeTemplate {
  id: string
  name: string
  category: 'crypto-culture' | 'price-action' | 'market-sentiment' | 'community' | 'defi' | 'nft'
  viralScore: number
  format: 'text' | 'image' | 'mixed'
  structure: {
    setup: string
    punchline: string
    tags: string[]
    variables?: string[]
  }
  lastUsed?: number
  successRate?: number
  usageCount?: number
  avgEngagement?: number
  marketConditions?: ('bullish' | 'bearish' | 'neutral')[]
}

export interface MemeContext {
  marketCondition: 'bullish' | 'bearish' | 'neutral'
  recentEvents: string[]
  communityMood: number // -1 to 1 scale
  targetAudience: string[]
  platform: 'twitter' | 'discord' | 'telegram' | 'reddit'
  timeOfDay?: 'morning' | 'afternoon' | 'evening' | 'night'
  trendingTopics?: string[]
  priceAction?: {
    change24h: number
    volume: number
    trend: 'up' | 'down' | 'sideways'
  }
}

export interface GeneratedMeme {
  id: string
  content: string
  template: MemeTemplate
  timestamp: number
  platform: string
  metrics: {
    expectedViralScore: number
    communityRelevance: number
    marketTiming: number
    sentimentAlignment: number
    trendRelevance: number
  }
  metadata: {
    hashtags: string[]
    mentions: string[]
    emojis: string[]
    characterCount: number
  }
  performance?: {
    actualViralScore?: number
    engagement?: number
    reach?: number
    shares?: number
  }
}

export interface LLMService {
  generateResponse(
    prompt: string,
    options?: {
      temperature?: number
      maxTokens?: number
      model?: string
    },
  ): Promise<string>
}

export interface MemeGeneratorConfig {
  maxRecentMemes: number
  minViralScore: number
  templateRotationDays: number
  creativityLevel: number // 0-1 scale
  riskTolerance: number // 0-1 scale for controversial content
  platformOptimization: boolean
  enableLearning: boolean
  model?: string // LLM model for meme generation
}

// Main MemeGenerator Class
export class MemeGenerator extends EventEmitter {
  private llmService: LLMService
  private templates: Map<string, MemeTemplate>
  private recentMemes: GeneratedMeme[] = []
  private config: MemeGeneratorConfig
  private performanceHistory: Map<string, number[]> = new Map()
  private readonly MAX_RECENT_MEMES: number

  constructor(llmService: LLMService, config?: Partial<MemeGeneratorConfig>) {
    super()
    this.llmService = llmService
    this.config = {
      maxRecentMemes: 100,
      minViralScore: 0.6,
      templateRotationDays: 7,
      creativityLevel: 0.8,
      riskTolerance: 0.5,
      platformOptimization: true,
      enableLearning: true,
      model: 'mixtral-8x7b-32768', // Default to concrete model from LLM stack
      ...config,
    }
    this.MAX_RECENT_MEMES = this.config.maxRecentMemes
    this.templates = new Map()
    this.initializeTemplates()
  }

  private initializeTemplates(): void {
    const defaultTemplates: MemeTemplate[] = [
      {
        id: 'diamond-hands',
        name: 'Diamond Hands',
        category: 'crypto-culture',
        viralScore: 0.85,
        format: 'text',
        structure: {
          setup: "When {token} dips {percentage}% but you're still",
          punchline: 'Diamond hands baby! 💎🙌 {reason}',
          tags: ['holding', 'diamond-hands', 'dip', 'hodl'],
          variables: ['token', 'percentage', 'reason'],
        },
        successRate: 0.75,
        usageCount: 0,
        avgEngagement: 0,
        marketConditions: ['bearish', 'neutral'],
      },
      {
        id: 'to-the-moon',
        name: 'To The Moon',
        category: 'price-action',
        viralScore: 0.9,
        format: 'mixed',
        structure: {
          setup: '{token} holders watching the chart:',
          punchline: "We're going to the moon! 🚀🌙 {prediction}",
          tags: ['moon', 'bullish', 'gains', 'rocket'],
          variables: ['token', 'prediction'],
        },
        successRate: 0.82,
        usageCount: 0,
        avgEngagement: 0,
        marketConditions: ['bullish'],
      },
      {
        id: 'wojak-panic',
        name: 'Wojak Panic',
        category: 'market-sentiment',
        viralScore: 0.8,
        format: 'mixed',
        structure: {
          setup: 'Me watching {token} {action}:',
          punchline: '*wojak panic intensifies* 😱 {emotion}',
          tags: ['panic', 'dumping', 'fear', 'wojak'],
          variables: ['token', 'action', 'emotion'],
        },
        successRate: 0.78,
        usageCount: 0,
        avgEngagement: 0,
        marketConditions: ['bearish'],
      },
      {
        id: 'this-is-fine',
        name: 'This Is Fine',
        category: 'market-sentiment',
        viralScore: 0.75,
        format: 'mixed',
        structure: {
          setup: 'Portfolio down {percentage}%:',
          punchline: 'This is fine 🔥☕ {coping_mechanism}',
          tags: ['fine', 'cope', 'burning', 'denial'],
          variables: ['percentage', 'coping_mechanism'],
        },
        successRate: 0.7,
        usageCount: 0,
        avgEngagement: 0,
        marketConditions: ['bearish', 'neutral'],
      },
      {
        id: 'ape-together-strong',
        name: 'Apes Together Strong',
        category: 'community',
        viralScore: 0.88,
        format: 'text',
        structure: {
          setup: '{community} when {event}:',
          punchline: 'Apes together strong! 🦍💪 {unity_message}',
          tags: ['apes', 'community', 'strong', 'unity'],
          variables: ['community', 'event', 'unity_message'],
        },
        successRate: 0.8,
        usageCount: 0,
        avgEngagement: 0,
        marketConditions: ['bullish', 'neutral'],
      },
      {
        id: 'gm-wagmi',
        name: 'GM WAGMI',
        category: 'community',
        viralScore: 0.72,
        format: 'text',
        structure: {
          setup: 'GM {community}! ☀️',
          punchline: 'WAGMI! {motivation} 🚀',
          tags: ['gm', 'wagmi', 'morning', 'motivation'],
          variables: ['community', 'motivation'],
        },
        successRate: 0.68,
        usageCount: 0,
        avgEngagement: 0,
        marketConditions: ['bullish', 'neutral'],
      },
      {
        id: 'buy-the-dip',
        name: 'Buy The Dip',
        category: 'price-action',
        viralScore: 0.83,
        format: 'text',
        structure: {
          setup: '{token} dips {percentage}%:',
          punchline: 'Time to buy the dip! 🛒💰 {strategy}',
          tags: ['dip', 'buying', 'opportunity', 'strategy'],
          variables: ['token', 'percentage', 'strategy'],
        },
        successRate: 0.76,
        usageCount: 0,
        avgEngagement: 0,
        marketConditions: ['bearish', 'neutral'],
      },
      {
        id: 'number-go-up',
        name: 'Number Go Up',
        category: 'price-action',
        viralScore: 0.79,
        format: 'text',
        structure: {
          setup: '{token} price action:',
          punchline: 'Number go up! 📈✨ {celebration}',
          tags: ['number', 'up', 'gains', 'simple'],
          variables: ['token', 'celebration'],
        },
        successRate: 0.74,
        usageCount: 0,
        avgEngagement: 0,
        marketConditions: ['bullish'],
      },
    ]

    defaultTemplates.forEach((template) => {
      this.templates.set(template.id, template)
    })

    this.emit('templatesInitialized', this.templates.size)
  }

  /**
   * Generate a meme based on context and market conditions
   */
  public async generateMeme(context: MemeContext): Promise<GeneratedMeme> {
    try {
      this.emit('memeGenerationStarted', context)

      // Select the best template for current context
      const template = this.selectBestTemplate(context)

      // Build AI prompt for content generation
      const prompt = this.buildMemePrompt(template, context)

      // Generate content using LLM
      const aiResponse = await this.llmService.generateResponse(prompt, {
        temperature: this.config.creativityLevel,
        maxTokens: 200,
        model: this.config.model, // Use configured model for meme generation
      })

      // Process and format the generated content
      const content = this.processGeneratedContent(aiResponse, template, context)

      // Calculate metrics
      const metrics = {
        expectedViralScore: this.calculateViralScore(template, context),
        communityRelevance: this.calculateCommunityRelevance(context),
        marketTiming: this.calculateMarketTiming(context),
        sentimentAlignment: this.calculateSentimentAlignment(template, context),
        trendRelevance: this.calculateTrendRelevance(context),
      }

      // Generate metadata
      const metadata = this.generateMetadata(content, context)

      const generatedMeme: GeneratedMeme = {
        id: `meme-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
        content,
        template,
        timestamp: Date.now(),
        platform: context.platform,
        metrics,
        metadata,
      }

      // Add to recent memes and update metrics
      this.addToRecentMemes(generatedMeme)
      this.updateTemplateMetrics(template.id, metrics.expectedViralScore)

      this.emit('memeGenerated', generatedMeme)
      return generatedMeme
    } catch (error) {
      this.emit('memeGenerationError', error)
      throw new Error(`Failed to generate meme: ${error instanceof Error ? error.message : 'Unknown error'}`)
    }
  }

  /**
   * Select the best template based on context and performance history
   */
  public selectBestTemplate(context: MemeContext): MemeTemplate {
    const availableTemplates = Array.from(this.templates.values())
      .filter((template) => this.isTemplateRelevant(template, context))
      .filter((template) => this.shouldUseTemplate(template))

    if (availableTemplates.length === 0) {
      // Fallback to most versatile template
      return this.templates.get('diamond-hands')!
    }

    // Score templates based on multiple factors
    const scoredTemplates = availableTemplates.map((template) => ({
      template,
      score: this.calculateTemplateScore(template, context),
    }))

    // Sort by score and add some randomness to avoid repetition
    scoredTemplates.sort((a, b) => {
      const scoreDiff = b.score - a.score
      const randomFactor = (Math.random() - 0.5) * 0.1 // Small random adjustment
      return scoreDiff + randomFactor
    })

    return scoredTemplates[0].template
  }

  /**
   * Calculate viral score for a template in given context
   */
  public calculateViralScore(template: MemeTemplate, context: MemeContext): number {
    let score = template.viralScore

    // Market condition alignment
    if (template.marketConditions?.includes(context.marketCondition)) {
      score += 0.1
    }

    // Community mood alignment
    const moodBonus = Math.abs(context.communityMood) * 0.05
    score += moodBonus

    // Platform optimization
    if (this.config.platformOptimization) {
      score += this.getPlatformBonus(template, context.platform)
    }

    // Time of day bonus
    if (context.timeOfDay) {
      score += this.getTimeBonus(template, context.timeOfDay)
    }

    // Trending topics relevance
    if (context.trendingTopics?.length) {
      const relevance = this.calculateTopicRelevance(template, context.trendingTopics)
      score += relevance * 0.15
    }

    // Historical performance
    const historicalScore = this.getHistoricalPerformance(template.id)
    score = score * 0.7 + historicalScore * 0.3

    return Math.min(Math.max(score, 0), 1)
  }

  /**
   * Update template metrics based on performance
   */
  public updateTemplateMetrics(templateId: string, performanceScore: number): void {
    const template = this.templates.get(templateId)
    if (!template) return

    // Update usage count
    template.usageCount = (template.usageCount || 0) + 1
    template.lastUsed = Date.now()

    // Update average engagement (exponential moving average)
    const alpha = 0.3 // Learning rate
    template.avgEngagement = template.avgEngagement
      ? template.avgEngagement * (1 - alpha) + performanceScore * alpha
      : performanceScore

    // Update success rate
    const isSuccess = performanceScore >= this.config.minViralScore
    const currentSuccessRate = template.successRate || 0
    const totalUsage = template.usageCount
    template.successRate = (currentSuccessRate * (totalUsage - 1) + (isSuccess ? 1 : 0)) / totalUsage

    // Store performance history
    if (!this.performanceHistory.has(templateId)) {
      this.performanceHistory.set(templateId, [])
    }
    const history = this.performanceHistory.get(templateId)!
    history.push(performanceScore)

    // Keep only recent history
    if (history.length > 50) {
      history.shift()
    }

    this.emit('templateMetricsUpdated', { templateId, metrics: template })
  }

  /**
   * Get recent memes for analysis
   */
  public getRecentMemes(limit?: number): GeneratedMeme[] {
    return this.recentMemes.slice(0, limit || this.recentMemes.length)
  }

  /**
   * Get template performance statistics
   */
  public getTemplateStats(templateId?: string): any {
    if (templateId) {
      const template = this.templates.get(templateId)
      const history = this.performanceHistory.get(templateId) || []
      return {
        template,
        history,
        avgPerformance: history.length > 0 ? history.reduce((a, b) => a + b, 0) / history.length : 0,
      }
    }

    // Return stats for all templates
    const stats = Array.from(this.templates.entries()).map(([id, template]) => {
      const history = this.performanceHistory.get(id) || []
      return {
        id,
        template,
        avgPerformance: history.length > 0 ? history.reduce((a, b) => a + b, 0) / history.length : 0,
        usageCount: template.usageCount || 0,
        successRate: template.successRate || 0,
      }
    })

    return stats.sort((a, b) => b.avgPerformance - a.avgPerformance)
  }

  /**
   * Add custom template
   */
  public addTemplate(template: MemeTemplate): void {
    this.templates.set(template.id, template)
    this.emit('templateAdded', template)
  }

  /**
   * Remove template
   */
  public removeTemplate(templateId: string): boolean {
    const removed = this.templates.delete(templateId)
    if (removed) {
      this.performanceHistory.delete(templateId)
      this.emit('templateRemoved', templateId)
    }
    return removed
  }

  // Private helper methods

  private buildMemePrompt(template: MemeTemplate, context: MemeContext): string {
    const { setup, punchline, variables = [] } = template.structure

    let prompt = `Generate a viral crypto meme using this template:
Setup: "${setup}"
Punchline: "${punchline}"

Context:
- Market condition: ${context.marketCondition}
- Community mood: ${context.communityMood > 0 ? 'positive' : context.communityMood < 0 ? 'negative' : 'neutral'}
- Platform: ${context.platform}
- Recent events: ${context.recentEvents.join(', ')}`

    if (context.trendingTopics?.length) {
      prompt += `\n- Trending topics: ${context.trendingTopics.join(', ')}`
    }

    if (context.priceAction) {
      prompt += `\n- Price action: ${context.priceAction.change24h > 0 ? 'up' : 'down'} ${Math.abs(context.priceAction.change24h)}%`
    }

    prompt += `\n\nVariables to fill: ${variables.join(', ')}
Generate engaging, humorous content that fits the template. Keep it concise and viral-worthy.
Return only the final meme text, properly formatted for ${context.platform}.`

    return prompt
  }

  private processGeneratedContent(aiResponse: string, template: MemeTemplate, context: MemeContext): string {
    let content = aiResponse.trim()

    // Platform-specific formatting
    if (context.platform === 'twitter' && content.length > 280) {
      content = content.substring(0, 277) + '...'
    }

    // Add platform-specific elements
    if (context.platform === 'discord' && !content.includes('```')) {
      // Discord users like code blocks for emphasis
      if (Math.random() < 0.3) {
        content = '```\n' + content + '\n```'
      }
    }

    return content
  }

  private isTemplateRelevant(template: MemeTemplate, context: MemeContext): boolean {
    // Check market condition compatibility
    if (template.marketConditions && !template.marketConditions.includes(context.marketCondition)) {
      return false
    }

    // Check if template was used too recently
    const daysSinceLastUse = template.lastUsed ? (Date.now() - template.lastUsed) / (1000 * 60 * 60 * 24) : Infinity

    if (daysSinceLastUse < this.config.templateRotationDays) {
      return false
    }

    return true
  }

  private shouldUseTemplate(template: MemeTemplate): boolean {
    // Don't use templates with consistently poor performance
    if (template.successRate !== undefined && template.successRate < 0.3 && (template.usageCount || 0) > 5) {
      return false
    }

    return true
  }

  private calculateTemplateScore(template: MemeTemplate, context: MemeContext): number {
    let score = template.viralScore

    // Historical performance weight
    const historicalScore = this.getHistoricalPerformance(template.id)
    score = score * 0.6 + historicalScore * 0.4

    // Recency penalty (avoid overusing same templates)
    const daysSinceLastUse = template.lastUsed ? (Date.now() - template.lastUsed) / (1000 * 60 * 60 * 24) : 30
    const recencyBonus = Math.min(daysSinceLastUse / 7, 1) * 0.2
    score += recencyBonus

    // Context relevance
    score += this.calculateContextRelevance(template, context) * 0.3

    return score
  }

  private calculateCommunityRelevance(context: MemeContext): number {
    let relevance = 0.5 // Base relevance

    // Community mood alignment
    relevance += Math.abs(context.communityMood) * 0.3

    // Target audience size
    relevance += Math.min(context.targetAudience.length / 10, 0.2)

    return Math.min(relevance, 1)
  }

  private calculateMarketTiming(context: MemeContext): number {
    let timing = 0.5 // Base timing

    // Price action timing
    if (context.priceAction) {
      const volatility = Math.abs(context.priceAction.change24h)
      timing += Math.min(volatility / 20, 0.3) // Higher volatility = better timing
    }

    // Time of day bonus
    if (context.timeOfDay) {
      const timeBonus = {
        morning: 0.8,
        afternoon: 0.6,
        evening: 0.9,
        night: 0.4,
      }
      timing *= timeBonus[context.timeOfDay]
    }

    return Math.min(timing, 1)
  }

  private calculateSentimentAlignment(template: MemeTemplate, context: MemeContext): number {
    const templateSentiment = this.getTemplateSentiment(template)
    const contextSentiment = context.communityMood

    // Calculate alignment (-1 to 1 scale)
    const alignment = 1 - Math.abs(templateSentiment - contextSentiment) / 2
    return Math.max(alignment, 0)
  }

  private calculateTrendRelevance(context: MemeContext): number {
    if (!context.trendingTopics?.length) return 0.5

    // Simple keyword matching for now
    // In a real implementation, this would use more sophisticated NLP
    const relevantTopics = context.trendingTopics.filter(
      (topic) =>
        topic.toLowerCase().includes('crypto') ||
        topic.toLowerCase().includes('bitcoin') ||
        topic.toLowerCase().includes('eth') ||
        topic.toLowerCase().includes('solana'),
    )

    return Math.min(relevantTopics.length / context.trendingTopics.length + 0.3, 1)
  }

  private calculateTopicRelevance(template: MemeTemplate, trendingTopics: string[]): number {
    const templateTags = template.structure.tags.join(' ').toLowerCase()
    const relevantTopics = trendingTopics.filter((topic) => templateTags.includes(topic.toLowerCase()))
    return relevantTopics.length / trendingTopics.length
  }

  private calculateContextRelevance(template: MemeTemplate, context: MemeContext): number {
    let relevance = 0

    // Market condition match
    if (template.marketConditions?.includes(context.marketCondition)) {
      relevance += 0.4
    }

    // Category relevance based on recent events
    const eventKeywords = context.recentEvents.join(' ').toLowerCase()
    const categoryRelevance = {
      'crypto-culture': eventKeywords.includes('community') || eventKeywords.includes('culture'),
      'price-action':
        eventKeywords.includes('price') || eventKeywords.includes('pump') || eventKeywords.includes('dump'),
      'market-sentiment':
        eventKeywords.includes('fear') || eventKeywords.includes('greed') || eventKeywords.includes('sentiment'),
      community: eventKeywords.includes('community') || eventKeywords.includes('together'),
      defi: eventKeywords.includes('defi') || eventKeywords.includes('yield'),
      nft: eventKeywords.includes('nft') || eventKeywords.includes('art'),
    }

    if (categoryRelevance[template.category]) {
      relevance += 0.3
    }

    return relevance
  }

  private getPlatformBonus(template: MemeTemplate, platform: string): number {
    const platformBonuses = {
      twitter: {
        text: 0.1,
        image: 0.05,
        mixed: 0.08,
      },
      discord: {
        text: 0.08,
        image: 0.1,
        mixed: 0.12,
      },
      telegram: {
        text: 0.06,
        image: 0.08,
        mixed: 0.1,
      },
      reddit: {
        text: 0.05,
        image: 0.12,
        mixed: 0.08,
      },
    }

    return platformBonuses[platform as keyof typeof platformBonuses]?.[template.format] || 0
  }

  private getTimeBonus(template: MemeTemplate, timeOfDay: string): number {
    // Different templates perform better at different times
    const timeBonuses = {
      'gm-wagmi': { morning: 0.2, afternoon: 0.05, evening: 0.02, night: 0.01 },
      'diamond-hands': { morning: 0.05, afternoon: 0.1, evening: 0.15, night: 0.08 },
      'to-the-moon': { morning: 0.1, afternoon: 0.15, evening: 0.12, night: 0.05 },
    }

    return (
      timeBonuses[template.id as keyof typeof timeBonuses]?.[timeOfDay as keyof (typeof timeBonuses)['gm-wagmi']] ||
      0.05
    )
  }

  private getHistoricalPerformance(templateId: string): number {
    const history = this.performanceHistory.get(templateId)
    if (!history || history.length === 0) return 0.5 // Default for new templates

    // Calculate weighted average with more weight on recent performance
    let weightedSum = 0
    let totalWeight = 0

    history.forEach((score, index) => {
      const weight = Math.pow(0.9, history.length - index - 1) // Exponential decay
      weightedSum += score * weight
      totalWeight += weight
    })

    return weightedSum / totalWeight
  }

  private getTemplateSentiment(template: MemeTemplate): number {
    // Simple sentiment mapping based on template category and tags
    const sentimentMap = {
      'crypto-culture': 0.2,
      'price-action': 0.1,
      'market-sentiment': -0.1,
      community: 0.4,
      defi: 0.1,
      nft: 0.0,
    }

    let sentiment = sentimentMap[template.category] || 0

    // Adjust based on tags
    const positiveTags = ['moon', 'gains', 'strong', 'wagmi', 'gm']
    const negativeTags = ['panic', 'dump', 'fear', 'rekt']

    const tags = template.structure.tags
    const positiveCount = tags.filter((tag) => positiveTags.includes(tag)).length
    const negativeCount = tags.filter((tag) => negativeTags.includes(tag)).length

    sentiment += (positiveCount - negativeCount) * 0.1

    return Math.max(-1, Math.min(1, sentiment))
  }

  private generateMetadata(content: string, context: MemeContext): GeneratedMeme['metadata'] {
    // Extract hashtags
    const hashtags = (content.match(/#\w+/g) || []).map((tag) => tag.toLowerCase())

    // Extract mentions
    const mentions = (content.match(/@\w+/g) || []).map((mention) => mention.toLowerCase())

    // Extract emojis
    const emojis =
      content.match(
        /[\u{1F600}-\u{1F64F}]|[\u{1F300}-\u{1F5FF}]|[\u{1F680}-\u{1F6FF}]|[\u{1F1E0}-\u{1F1FF}]|[\u{2600}-\u{26FF}]|[\u{2700}-\u{27BF}]/gu,
      ) || []

    return {
      hashtags,
      mentions,
      emojis,
      characterCount: content.length,
    }
  }

  private addToRecentMemes(meme: GeneratedMeme): void {
    this.recentMemes.unshift(meme)

    // Keep only recent memes
    if (this.recentMemes.length > this.MAX_RECENT_MEMES) {
      this.recentMemes = this.recentMemes.slice(0, this.MAX_RECENT_MEMES)
    }
  }

  /**
   * Update meme performance with actual metrics
   */
  public updateMemePerformance(memeId: string, performance: GeneratedMeme['performance']): void {
    const meme = this.recentMemes.find((m) => m.id === memeId)
    if (meme) {
      meme.performance = performance

      // Update template metrics based on actual performance
      if (performance && performance.actualViralScore !== undefined) {
        this.updateTemplateMetrics(meme.template.id, performance.actualViralScore)
      }

      this.emit('memePerformanceUpdated', { memeId, performance })
    }
  }

  /**
   * Get configuration
   */
  public getConfig(): MemeGeneratorConfig {
    return { ...this.config }
  }

  /**
   * Update configuration
   */
  public updateConfig(newConfig: Partial<MemeGeneratorConfig>): void {
    this.config = { ...this.config, ...newConfig }
    this.emit('configUpdated', this.config)
  }
}

export default MemeGenerator
