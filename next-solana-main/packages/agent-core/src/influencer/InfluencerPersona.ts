import { z } from 'zod'

// Core types for influencer system
export type InfluencerType = 'crypto-native' | 'meme-focused' | 'educational' | 'hype-driven'
export type ContentFormat = 'text' | 'image' | 'mixed' | 'video' | 'thread'
export type Platform = 'twitter' | 'discord' | 'telegram' | 'instagram' | 'tiktok'
export type RiskTolerance = 'conservative' | 'moderate' | 'aggressive' | 'degen'
export type PostingFrequency = 'low' | 'moderate' | 'high' | 'viral-mode'

// Model configuration interface
export interface ModelConfiguration {
  provider: 'groq' | 'deepseek' | 'ollama' | 'huggingface' | 'openrouter'
  model: string
  temperature: number
  maxTokens: number
  topP: number
  frequencyPenalty: number
  presencePenalty: number
}

// Content generation preferences
export interface ContentGenerationPreferences {
  preferredFormats: ContentFormat[]
  toneStyle: 'casual' | 'professional' | 'meme' | 'educational' | 'hype'
  useEmojis: boolean
  useHashtags: boolean
  maxHashtags: number
  includeCallToAction: boolean
  controversialContentTolerance: RiskTolerance
  viralOptimization: boolean
  trendParticipation: boolean
  memeGeneration: boolean
  imageGeneration: boolean
}

// Posting schedule configuration
export interface PostingSchedule {
  frequency: PostingFrequency
  dailyPostCount: {
    min: number
    max: number
  }
  optimalTimes: string[] // UTC times like "14:30"
  timezone: string
  weekendPosting: boolean
  nightPosting: boolean
  adaptToTrends: boolean
  burstPosting: boolean // For viral opportunities
}

// Engagement strategy configuration
export interface EngagementStrategy {
  autoLike: boolean
  autoRetweet: boolean
  autoComment: boolean
  autoFollow: boolean
  engagementRate: number // 0-1 scale
  targetInfluencers: string[]
  targetHashtags: string[]
  targetKeywords: string[]
  communityFocus: boolean
  crossPlatformEngagement: boolean
  responseTime: 'immediate' | 'quick' | 'delayed' | 'strategic'
}

// Follower growth targets and strategies
export interface FollowerGrowthConfig {
  dailyGrowthTarget: number
  monthlyGrowthTarget: number
  qualityOverQuantity: boolean
  targetAudience: {
    demographics: string[]
    interests: string[]
    platforms: Platform[]
  }
  growthStrategies: {
    contentOptimization: boolean
    influencerCollabs: boolean
    trendJacking: boolean
    communityBuilding: boolean
    crossPromotion: boolean
  }
  unfollowStrategy: {
    enabled: boolean
    unfollowAfterDays: number
    keepMutualFollows: boolean
  }
}

// Viral content optimization parameters
export interface ViralOptimizationConfig {
  viralScoreThreshold: number // 0-1 scale
  trendDetectionSensitivity: 'low' | 'medium' | 'high'
  viralTiming: boolean
  crossPlatformAmplification: boolean
  influencerNetworkLeverage: boolean
  contentRemixing: boolean
  hashtagOptimization: boolean
  emotionalTriggers: string[]
  viralFormats: ContentFormat[]
  amplificationBudget: number // For paid promotion
}

// Platform-specific adaptations
export interface PlatformAdaptation {
  platform: Platform
  enabled: boolean
  contentAdaptation: {
    characterLimit?: number
    imageRequirements?: {
      width: number
      height: number
      format: string
    }
    hashtagStrategy: 'minimal' | 'moderate' | 'aggressive'
    mentionStrategy: 'conservative' | 'active' | 'aggressive'
  }
  postingBehavior: {
    frequency: PostingFrequency
    optimalTimes: string[]
    threadSupport: boolean
    storySupport: boolean
  }
  engagementRules: {
    autoEngage: boolean
    engagementTypes: string[]
    dailyEngagementLimit: number
  }
}

// Personality traits for different influencer types
export interface InfluencerPersonalityTraits {
  type: InfluencerType
  characteristics: {
    humor: number // 0-1 scale
    authority: number
    relatability: number
    controversy: number
    education: number
    entertainment: number
  }
  communicationStyle: {
    formality: 'casual' | 'semi-formal' | 'formal'
    verbosity: 'concise' | 'moderate' | 'detailed'
    technicality: 'simple' | 'intermediate' | 'advanced'
  }
  contentFocus: {
    marketAnalysis: boolean
    memeContent: boolean
    educational: boolean
    community: boolean
    trading: boolean
    technology: boolean
  }
}

// Main influencer persona configuration
export interface InfluencerPersonaConfig {
  // Basic identity
  identity: {
    id: string
    name: string
    version: string
    description: string
    avatarUrl?: string
  }

  // Model configurations
  modelConfigurations: {
    primary: ModelConfiguration
    fallback: ModelConfiguration
    imageGeneration?: ModelConfiguration
  }

  // Influencer-specific capabilities
  capabilities: {
    contentGeneration: boolean
    viralOptimization: boolean
    trendDetection: boolean
    communityManagement: boolean
    crossPlatformPosting: boolean
    imageGeneration: boolean
    memeGeneration: boolean
    sentimentAnalysis: boolean
    followerGrowth: boolean
  }

  // Core influencer configuration
  influencerConfig: {
    type: InfluencerType
    personalityTraits: InfluencerPersonalityTraits
    contentPreferences: ContentGenerationPreferences
    postingSchedule: PostingSchedule
    engagementStrategy: EngagementStrategy
    followerGrowthConfig: FollowerGrowthConfig
    viralOptimization: ViralOptimizationConfig
    platformAdaptations: PlatformAdaptation[]
  }

  // Content and messaging
  prompts: {
    system: {
      role: 'system'
      content: string
    }
    contentGeneration: {
      role: 'system'
      content: string
    }
    engagement: {
      role: 'system'
      content: string
    }
    viralOptimization: {
      role: 'system'
      content: string
    }
  }

  // Example content for training
  messageExamples: Array<
    {
      user: string
      content: { text: string }
    }[]
  >

  postExamples: string[]

  // Personality descriptors
  bio: string[]
  lore: string[]
  adjectives: string[]
  topics: string[]
  interests: string[]
  values: string[]

  // Style guidelines
  style: {
    all: string[]
    chat: string[]
    post: string[]
    viral: string[]
  }

  // Monitoring and analytics
  monitoring: {
    metrics: string[]
    alerts: {
      channels: string[]
      thresholds: {
        engagementDrop: number
        followerLoss: number
        viralOpportunity: number
        controversyLevel: number
      }
    }
    reporting: {
      daily: boolean
      weekly: boolean
      monthly: boolean
      realTime: boolean
    }
  }

  // Integration settings
  integrations: {
    platforms: Platform[]
    analytics: string[]
    imageGeneration: string[]
    trendDetection: string[]
  }

  // Workflow definitions
  workflows: {
    contentCreation: {
      steps: string[]
      interval: number
    }
    viralCampaign: {
      steps: string[]
      interval: number
    }
    engagement: {
      steps: string[]
      interval: number
    }
    growth: {
      steps: string[]
      interval: number
    }
  }
}

// Zod schema for validation
export const InfluencerPersonaSchema = z.object({
  identity: z.object({
    id: z.string().min(1),
    name: z.string().min(1),
    version: z.string(),
    description: z.string(),
    avatarUrl: z.string().url().optional(),
  }),

  modelConfigurations: z.object({
    primary: z.object({
      provider: z.enum(['groq', 'deepseek', 'ollama', 'huggingface', 'openrouter']),
      model: z.string(),
      temperature: z.number().min(0).max(2),
      maxTokens: z.number().int().positive(),
      topP: z.number().min(0).max(1),
      frequencyPenalty: z.number().min(-2).max(2),
      presencePenalty: z.number().min(-2).max(2),
    }),
    fallback: z.object({
      provider: z.enum(['groq', 'deepseek', 'ollama', 'huggingface', 'openrouter']),
      model: z.string(),
      temperature: z.number().min(0).max(2),
      maxTokens: z.number().int().positive(),
      topP: z.number().min(0).max(1),
      frequencyPenalty: z.number().min(-2).max(2),
      presencePenalty: z.number().min(-2).max(2),
    }),
    imageGeneration: z
      .object({
        provider: z.enum(['groq', 'deepseek', 'ollama', 'huggingface', 'openrouter']),
        model: z.string(),
        temperature: z.number().min(0).max(2),
        maxTokens: z.number().int().positive(),
        topP: z.number().min(0).max(1),
        frequencyPenalty: z.number().min(-2).max(2),
        presencePenalty: z.number().min(-2).max(2),
      })
      .optional(),
  }),

  capabilities: z.object({
    contentGeneration: z.boolean(),
    viralOptimization: z.boolean(),
    trendDetection: z.boolean(),
    communityManagement: z.boolean(),
    crossPlatformPosting: z.boolean(),
    imageGeneration: z.boolean(),
    memeGeneration: z.boolean(),
    sentimentAnalysis: z.boolean(),
    followerGrowth: z.boolean(),
  }),

  influencerConfig: z.object({
    type: z.enum(['crypto-native', 'meme-focused', 'educational', 'hype-driven']),
    personalityTraits: z.object({
      type: z.enum(['crypto-native', 'meme-focused', 'educational', 'hype-driven']),
      characteristics: z.object({
        humor: z.number().min(0).max(1),
        authority: z.number().min(0).max(1),
        relatability: z.number().min(0).max(1),
        controversy: z.number().min(0).max(1),
        education: z.number().min(0).max(1),
        entertainment: z.number().min(0).max(1),
      }),
      communicationStyle: z.object({
        formality: z.enum(['casual', 'semi-formal', 'formal']),
        verbosity: z.enum(['concise', 'moderate', 'detailed']),
        technicality: z.enum(['simple', 'intermediate', 'advanced']),
      }),
      contentFocus: z.object({
        marketAnalysis: z.boolean(),
        memeContent: z.boolean(),
        educational: z.boolean(),
        community: z.boolean(),
        trading: z.boolean(),
        technology: z.boolean(),
      }),
    }),
    contentPreferences: z.object({
      preferredFormats: z.array(z.enum(['text', 'image', 'mixed', 'video', 'thread'])),
      toneStyle: z.enum(['casual', 'professional', 'meme', 'educational', 'hype']),
      useEmojis: z.boolean(),
      useHashtags: z.boolean(),
      maxHashtags: z.number().int().min(0).max(30),
      includeCallToAction: z.boolean(),
      controversialContentTolerance: z.enum(['conservative', 'moderate', 'aggressive', 'degen']),
      viralOptimization: z.boolean(),
      trendParticipation: z.boolean(),
      memeGeneration: z.boolean(),
      imageGeneration: z.boolean(),
    }),
    postingSchedule: z.object({
      frequency: z.enum(['low', 'moderate', 'high', 'viral-mode']),
      dailyPostCount: z.object({
        min: z.number().int().min(0),
        max: z.number().int().min(1),
      }),
      optimalTimes: z.array(z.string()),
      timezone: z.string(),
      weekendPosting: z.boolean(),
      nightPosting: z.boolean(),
      adaptToTrends: z.boolean(),
      burstPosting: z.boolean(),
    }),
    engagementStrategy: z.object({
      autoLike: z.boolean(),
      autoRetweet: z.boolean(),
      autoComment: z.boolean(),
      autoFollow: z.boolean(),
      engagementRate: z.number().min(0).max(1),
      targetInfluencers: z.array(z.string()),
      targetHashtags: z.array(z.string()),
      targetKeywords: z.array(z.string()),
      communityFocus: z.boolean(),
      crossPlatformEngagement: z.boolean(),
      responseTime: z.enum(['immediate', 'quick', 'delayed', 'strategic']),
    }),
    followerGrowthConfig: z.object({
      dailyGrowthTarget: z.number().int().min(0),
      monthlyGrowthTarget: z.number().int().min(0),
      qualityOverQuantity: z.boolean(),
      targetAudience: z.object({
        demographics: z.array(z.string()),
        interests: z.array(z.string()),
        platforms: z.array(z.enum(['twitter', 'discord', 'telegram', 'instagram', 'tiktok'])),
      }),
      growthStrategies: z.object({
        contentOptimization: z.boolean(),
        influencerCollabs: z.boolean(),
        trendJacking: z.boolean(),
        communityBuilding: z.boolean(),
        crossPromotion: z.boolean(),
      }),
      unfollowStrategy: z.object({
        enabled: z.boolean(),
        unfollowAfterDays: z.number().int().min(1),
        keepMutualFollows: z.boolean(),
      }),
    }),
    viralOptimization: z.object({
      viralScoreThreshold: z.number().min(0).max(1),
      trendDetectionSensitivity: z.enum(['low', 'medium', 'high']),
      viralTiming: z.boolean(),
      crossPlatformAmplification: z.boolean(),
      influencerNetworkLeverage: z.boolean(),
      contentRemixing: z.boolean(),
      hashtagOptimization: z.boolean(),
      emotionalTriggers: z.array(z.string()),
      viralFormats: z.array(z.enum(['text', 'image', 'mixed', 'video', 'thread'])),
      amplificationBudget: z.number().min(0),
    }),
    platformAdaptations: z.array(
      z.object({
        platform: z.enum(['twitter', 'discord', 'telegram', 'instagram', 'tiktok']),
        enabled: z.boolean(),
        contentAdaptation: z.object({
          characterLimit: z.number().int().positive().optional(),
          imageRequirements: z
            .object({
              width: z.number().int().positive(),
              height: z.number().int().positive(),
              format: z.string(),
            })
            .optional(),
          hashtagStrategy: z.enum(['minimal', 'moderate', 'aggressive']),
          mentionStrategy: z.enum(['conservative', 'active', 'aggressive']),
        }),
        postingBehavior: z.object({
          frequency: z.enum(['low', 'moderate', 'high', 'viral-mode']),
          optimalTimes: z.array(z.string()),
          threadSupport: z.boolean(),
          storySupport: z.boolean(),
        }),
        engagementRules: z.object({
          autoEngage: z.boolean(),
          engagementTypes: z.array(z.string()),
          dailyEngagementLimit: z.number().int().min(0),
        }),
      }),
    ),
  }),

  prompts: z.object({
    system: z.object({
      role: z.literal('system'),
      content: z.string(),
    }),
    contentGeneration: z.object({
      role: z.literal('system'),
      content: z.string(),
    }),
    engagement: z.object({
      role: z.literal('system'),
      content: z.string(),
    }),
    viralOptimization: z.object({
      role: z.literal('system'),
      content: z.string(),
    }),
  }),

  messageExamples: z.array(
    z.array(
      z.object({
        user: z.string(),
        content: z.object({
          text: z.string(),
        }),
      }),
    ),
  ),

  postExamples: z.array(z.string()),
  bio: z.array(z.string()),
  lore: z.array(z.string()),
  adjectives: z.array(z.string()),
  topics: z.array(z.string()),
  interests: z.array(z.string()),
  values: z.array(z.string()),

  style: z.object({
    all: z.array(z.string()),
    chat: z.array(z.string()),
    post: z.array(z.string()),
    viral: z.array(z.string()),
  }),

  monitoring: z.object({
    metrics: z.array(z.string()),
    alerts: z.object({
      channels: z.array(z.string()),
      thresholds: z.object({
        engagementDrop: z.number().min(0).max(1),
        followerLoss: z.number().min(0),
        viralOpportunity: z.number().min(0).max(1),
        controversyLevel: z.number().min(0).max(1),
      }),
    }),
    reporting: z.object({
      daily: z.boolean(),
      weekly: z.boolean(),
      monthly: z.boolean(),
      realTime: z.boolean(),
    }),
  }),

  integrations: z.object({
    platforms: z.array(z.enum(['twitter', 'discord', 'telegram', 'instagram', 'tiktok'])),
    analytics: z.array(z.string()),
    imageGeneration: z.array(z.string()),
    trendDetection: z.array(z.string()),
  }),

  workflows: z.object({
    contentCreation: z.object({
      steps: z.array(z.string()),
      interval: z.number().int().positive(),
    }),
    viralCampaign: z.object({
      steps: z.array(z.string()),
      interval: z.number().int().positive(),
    }),
    engagement: z.object({
      steps: z.array(z.string()),
      interval: z.number().int().positive(),
    }),
    growth: z.object({
      steps: z.array(z.string()),
      interval: z.number().int().positive(),
    }),
  }),
})

// Utility class for managing influencer personas
export class InfluencerPersonaLoader {
  private personas: Map<string, InfluencerPersonaConfig> = new Map()

  /**
   * Load and validate an influencer persona configuration
   */
  async loadPersona(config: unknown): Promise<InfluencerPersonaConfig> {
    try {
      const validatedConfig = InfluencerPersonaSchema.parse(config)
      this.personas.set(validatedConfig.identity.id, validatedConfig)
      return validatedConfig
    } catch (error) {
      throw new Error(`Invalid influencer persona configuration: ${error}`)
    }
  }

  /**
   * Get a loaded persona by ID
   */
  getPersona(id: string): InfluencerPersonaConfig | undefined {
    return this.personas.get(id)
  }

  /**
   * Get all loaded personas
   */
  getAllPersonas(): InfluencerPersonaConfig[] {
    return Array.from(this.personas.values())
  }

  /**
   * Get personas by type
   */
  getPersonasByType(type: InfluencerType): InfluencerPersonaConfig[] {
    return Array.from(this.personas.values()).filter((persona) => persona.influencerConfig.type === type)
  }

  /**
   * Create a system prompt for content generation
   */
  buildContentGenerationPrompt(
    persona: InfluencerPersonaConfig,
    context?: {
      platform?: Platform
      contentType?: ContentFormat
      trend?: string
      viralScore?: number
    },
  ): string {
    const { personalityTraits, contentPreferences } = persona.influencerConfig
    const platformAdaptation = context?.platform
      ? persona.influencerConfig.platformAdaptations.find((p) => p.platform === context.platform)
      : null

    const parts = [
      persona.prompts.contentGeneration.content,
      `Persona: ${persona.identity.name} - ${personalityTraits.type} influencer`,
      `Communication Style: ${personalityTraits.communicationStyle.formality}, ${personalityTraits.communicationStyle.verbosity}`,
      `Content Focus: ${Object.entries(personalityTraits.contentFocus)
        .filter(([_, enabled]) => enabled)
        .map(([focus, _]) => focus)
        .join(', ')}`,
      contentPreferences.useEmojis ? 'Use emojis appropriately' : 'Avoid emojis',
      contentPreferences.useHashtags
        ? `Include up to ${contentPreferences.maxHashtags} relevant hashtags`
        : 'No hashtags',
      context?.platform ? `Platform: ${context.platform}` : '',
      context?.contentType ? `Content Type: ${context.contentType}` : '',
      context?.trend ? `Current Trend: ${context.trend}` : '',
      context?.viralScore ? `Target Viral Score: ${context.viralScore}` : '',
      platformAdaptation?.contentAdaptation.characterLimit
        ? `Character Limit: ${platformAdaptation.contentAdaptation.characterLimit}`
        : '',
    ]

    return parts.filter(Boolean).join('\n')
  }

  /**
   * Build engagement prompt for responding to community
   */
  buildEngagementPrompt(
    persona: InfluencerPersonaConfig,
    context?: {
      platform?: Platform
      messageType?: 'reply' | 'comment' | 'dm'
      sentiment?: 'positive' | 'negative' | 'neutral'
    },
  ): string {
    const { personalityTraits, engagementStrategy } = persona.influencerConfig

    const parts = [
      persona.prompts.engagement.content,
      `Response Style: ${engagementStrategy.responseTime}`,
      `Personality: ${personalityTraits.characteristics.humor > 0.7 ? 'humorous' : 'serious'}, ${personalityTraits.characteristics.relatability > 0.7 ? 'relatable' : 'authoritative'}`,
      context?.platform ? `Platform: ${context.platform}` : '',
      context?.messageType ? `Message Type: ${context.messageType}` : '',
      context?.sentiment ? `Incoming Sentiment: ${context.sentiment}` : '',
      engagementStrategy.communityFocus ? 'Focus on community building' : '',
    ]

    return parts.filter(Boolean).join('\n')
  }

  /**
   * Calculate optimal posting time based on persona configuration
   */
  getOptimalPostingTime(persona: InfluencerPersonaConfig, platform?: Platform): Date {
    const { postingSchedule } = persona.influencerConfig
    const platformAdaptation = platform
      ? persona.influencerConfig.platformAdaptations.find((p) => p.platform === platform)
      : null

    const optimalTimes = platformAdaptation?.postingBehavior.optimalTimes || postingSchedule.optimalTimes
    const now = new Date()
    const currentHour = now.getUTCHours()
    const currentMinute = now.getUTCMinutes()
    const currentTime = `${currentHour.toString().padStart(2, '0')}:${currentMinute.toString().padStart(2, '0')}`

    // Find the next optimal time
    const nextOptimalTime = optimalTimes.find((time) => time > currentTime) || optimalTimes[0]
    const [hours, minutes] = nextOptimalTime.split(':').map(Number)

    const nextPostTime = new Date(now)
    nextPostTime.setUTCHours(hours, minutes, 0, 0)

    // If the time has passed today, schedule for tomorrow
    if (nextPostTime <= now) {
      nextPostTime.setUTCDate(nextPostTime.getUTCDate() + 1)
    }

    return nextPostTime
  }

  /**
   * Check if content meets viral optimization criteria
   */
  meetsViralCriteria(
    persona: InfluencerPersonaConfig,
    content: {
      text: string
      viralScore?: number
      emotionalTriggers?: string[]
      format?: ContentFormat
    },
  ): boolean {
    const { viralOptimization } = persona.influencerConfig

    if (!viralOptimization.viralTiming) return true

    // Check viral score threshold
    if (content.viralScore && content.viralScore < viralOptimization.viralScoreThreshold) {
      return false
    }

    // Check if content contains emotional triggers
    if (viralOptimization.emotionalTriggers.length > 0 && content.emotionalTriggers) {
      const hasEmotionalTrigger = viralOptimization.emotionalTriggers.some((trigger) =>
        content.emotionalTriggers!.includes(trigger),
      )
      if (!hasEmotionalTrigger) return false
    }

    // Check if format is optimized for viral content
    if (content.format && !viralOptimization.viralFormats.includes(content.format)) {
      return false
    }

    return true
  }

  /**
   * Generate persona-specific hashtags
   */
  generateHashtags(
    persona: InfluencerPersonaConfig,
    context?: {
      topic?: string
      platform?: Platform
      trending?: string[]
    },
  ): string[] {
    const { contentPreferences, personalityTraits } = persona.influencerConfig
    const platformAdaptation = context?.platform
      ? persona.influencerConfig.platformAdaptations.find((p) => p.platform === context.platform)
      : null

    if (!contentPreferences.useHashtags) return []

    const baseHashtags: string[] = []

    // Add type-specific hashtags
    switch (personalityTraits.type) {
      case 'crypto-native':
        baseHashtags.push('#crypto', '#defi', '#web3', '#blockchain')
        break
      case 'meme-focused':
        baseHashtags.push('#memes', '#memecoin', '#degen', '#wagmi')
        break
      case 'educational':
        baseHashtags.push('#education', '#learn', '#alpha', '#knowledge')
        break
      case 'hype-driven':
        baseHashtags.push('#bullish', '#moon', '#pump', '#gains')
        break
    }

    // Add trending hashtags if available
    if (context?.trending) {
      baseHashtags.push(...context.trending.slice(0, 2))
    }

    // Add topic-specific hashtag
    if (context?.topic) {
      baseHashtags.push(`#${context.topic.replace(/\s+/g, '').toLowerCase()}`)
    }

    // Limit based on platform and preferences
    const maxHashtags = Math.min(
      contentPreferences.maxHashtags,
      platformAdaptation?.contentAdaptation.hashtagStrategy === 'minimal'
        ? 3
        : platformAdaptation?.contentAdaptation.hashtagStrategy === 'moderate'
          ? 7
          : 15,
    )

    return baseHashtags.slice(0, maxHashtags)
  }
}

// Export the validated type
export type ValidatedInfluencerPersona = z.infer<typeof InfluencerPersonaSchema>

// Default persona configurations for different types
export const DEFAULT_CRYPTO_NATIVE_TRAITS: InfluencerPersonalityTraits = {
  type: 'crypto-native',
  characteristics: {
    humor: 0.7,
    authority: 0.8,
    relatability: 0.6,
    controversy: 0.5,
    education: 0.7,
    entertainment: 0.6,
  },
  communicationStyle: {
    formality: 'casual',
    verbosity: 'moderate',
    technicality: 'intermediate',
  },
  contentFocus: {
    marketAnalysis: true,
    memeContent: true,
    educational: true,
    community: true,
    trading: true,
    technology: true,
  },
}

export const DEFAULT_MEME_FOCUSED_TRAITS: InfluencerPersonalityTraits = {
  type: 'meme-focused',
  characteristics: {
    humor: 0.9,
    authority: 0.4,
    relatability: 0.9,
    controversy: 0.7,
    education: 0.3,
    entertainment: 0.9,
  },
  communicationStyle: {
    formality: 'casual',
    verbosity: 'concise',
    technicality: 'simple',
  },
  contentFocus: {
    marketAnalysis: false,
    memeContent: true,
    educational: false,
    community: true,
    trading: false,
    technology: false,
  },
}

export const DEFAULT_EDUCATIONAL_TRAITS: InfluencerPersonalityTraits = {
  type: 'educational',
  characteristics: {
    humor: 0.4,
    authority: 0.9,
    relatability: 0.7,
    controversy: 0.2,
    education: 0.9,
    entertainment: 0.4,
  },
  communicationStyle: {
    formality: 'semi-formal',
    verbosity: 'detailed',
    technicality: 'advanced',
  },
  contentFocus: {
    marketAnalysis: true,
    memeContent: false,
    educational: true,
    community: true,
    trading: true,
    technology: true,
  },
}

export const DEFAULT_HYPE_DRIVEN_TRAITS: InfluencerPersonalityTraits = {
  type: 'hype-driven',
  characteristics: {
    humor: 0.6,
    authority: 0.6,
    relatability: 0.8,
    controversy: 0.8,
    education: 0.4,
    entertainment: 0.8,
  },
  communicationStyle: {
    formality: 'casual',
    verbosity: 'concise',
    technicality: 'simple',
  },
  contentFocus: {
    marketAnalysis: false,
    memeContent: true,
    educational: false,
    community: true,
    trading: true,
    technology: false,
  },
}
