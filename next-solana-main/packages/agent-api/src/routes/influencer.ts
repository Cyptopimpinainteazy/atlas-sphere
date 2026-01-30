import { Router } from 'express'
import { randomUUID } from 'crypto'
import { validate } from '../middleware/validate'
import { requireAuth } from '../middleware/auth'
import { z } from 'zod'
import rateLimit from 'express-rate-limit'
import { INFLUENCER_DEFAULTS } from '../constants/influencer'
import { ContentService } from '../services/contentService'

// Rate limiters for different operations
/**
 * In-memory rate limiter suitable for development or low traffic scenarios.
 * For production environments, consider migrating to a persistent store like Redis.
 *
 * Migration Plan:
 * 1. Install redis client (ioredis or redis)
 * 2. Configure Redis connection settings
 * 3. Replace rateLimit configuration with Redis-backed store
 * 4. Update rate limit persistence during scaling events
 * 5. Implement backup/restore mechanisms for rate limit data
 */
const influencerLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  message: { error: 'Too many requests, please try again later' },
})

const contentLimiter = rateLimit({
  windowMs: 5 * 60 * 1000, // 5 minutes
  max: 20,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  message: { error: 'Content generation rate limit exceeded' },
})

const campaignLimiter = rateLimit({
  windowMs: 10 * 60 * 1000, // 10 minutes
  max: 10,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  message: { error: 'Campaign creation rate limit exceeded' },
})

// Validation schemas
const createInfluencerSchema = z.object({
  body: z.object({
    name: z.string().min(1).max(100),
    persona: z.enum(['crypto-influencer', 'meme-lord', 'educational-alpha']),
    platforms: z.array(z.enum(['twitter', 'discord', 'telegram'])).min(1),
    settings: z
      .object({
        postingFrequency: z.number().min(1).max(24).default(INFLUENCER_DEFAULTS.postingFrequency),
        viralThreshold: z.number().min(0).max(1).default(INFLUENCER_DEFAULTS.viralThreshold),
        riskTolerance: z.enum(['low', 'medium', 'high']).default(INFLUENCER_DEFAULTS.riskTolerance),
        contentTypes: z.array(z.enum(['text', 'image', 'meme', 'thread'])).default(INFLUENCER_DEFAULTS.contentTypes),
        autoFollow: z.boolean().default(INFLUENCER_DEFAULTS.autoFollow),
        communityManagement: z.boolean().default(INFLUENCER_DEFAULTS.communityManagement),
      })
      .optional(),
  }),
})

const influencerIdParam = z.object({
  params: z.object({
    id: z.string().uuid(),
  }),
})

const generateContentSchema = z.object({
  params: z.object({
    id: z.string().uuid(),
  }),
  body: z.object({
    type: z.enum(['text', 'image', 'meme', 'thread']),
    platform: z.enum(['twitter', 'discord', 'telegram']),
    topic: z.string().optional(),
    urgency: z.enum(['low', 'medium', 'high']).default('medium'),
    targetAudience: z.string().optional(),
    includeHashtags: z.boolean().default(true),
    scheduleFor: z.string().datetime().optional(),
  }),
})

const createCampaignSchema = z.object({
  params: z.object({
    id: z.string().uuid(),
  }),
  body: z.object({
    name: z.string().min(1).max(200),
    type: z.enum(['viral-boost', 'follower-growth', 'engagement', 'trend-hijack']),
    platforms: z.array(z.enum(['twitter', 'discord', 'telegram'])).min(1),
    duration: z.number().min(1).max(168), // hours
    budget: z.number().min(0).optional(),
    targetMetrics: z
      .object({
        reach: z.number().optional(),
        engagement: z.number().optional(),
        followers: z.number().optional(),
        viralScore: z.number().min(0).max(1).optional(),
      })
      .optional(),
    content: z
      .object({
        templates: z.array(z.string()).optional(),
        hashtags: z.array(z.string()).optional(),
        mentions: z.array(z.string()).optional(),
      })
      .optional(),
  }),
})

const scheduleContentSchema = z.object({
  params: z.object({
    id: z.string().uuid(),
  }),
  body: z.object({
    content: z.string().min(1),
    platform: z.enum(['twitter', 'discord', 'telegram']),
    scheduledFor: z.string().datetime(),
    type: z.enum(['text', 'image', 'meme', 'thread']).default('text'),
    priority: z.enum(['low', 'medium', 'high']).default('medium'),
    viralOptimization: z.boolean().default(true),
    autoHashtags: z.boolean().default(true),
  }),
})

const querySchema = z.object({
  query: z.object({
    page: z.string().regex(/^\d+$/).default('1').transform(Number),
    limit: z.string().regex(/^\d+$/).default('10').transform(Number),
    status: z.enum(['active', 'paused', 'stopped']).optional(),
    platform: z.enum(['twitter', 'discord', 'telegram']).optional(),
    sortBy: z.enum(['created_at', 'followers', 'engagement', 'viral_score']).default('created_at'),
    sortOrder: z.enum(['asc', 'desc']).default('desc'),
  }),
})

// Infer types from zod schemas
type CreateInfluencerRequest = z.infer<typeof createInfluencerSchema>
type CreateInfluencerBody = z.infer<typeof createInfluencerSchema>['body']
type InfluencerIdParam = z.infer<typeof influencerIdParam>
type GenerateContentRequest = z.infer<typeof generateContentSchema>
type CreateCampaignRequest = z.infer<typeof createCampaignSchema>
type ScheduleContentRequest = z.infer<typeof scheduleContentSchema>
type QueryRequest = z.infer<typeof querySchema>

// Type for request body derived from schema
type CreateInfluencerRequestBody = z.infer<typeof createInfluencerSchema>['body']

// Types
interface Influencer {
  id: string
  name: string
  persona: string
  platforms: string[]
  status: 'active' | 'paused' | 'stopped'
  settings: {
    postingFrequency: number
    viralThreshold: number
    riskTolerance: string
    contentTypes: string[]
    autoFollow: boolean
    communityManagement: boolean
  }
  metrics: {
    totalFollowers: number
    totalEngagement: number
    viralContent: number
    avgViralScore: number
  }
  ownerId: string
  createdAt: Date
  updatedAt: Date
}

interface Content {
  id: string
  influencerId: string
  platform: string
  type: string
  content: string
  viralScore: number
  engagement: {
    likes: number
    shares: number
    comments: number
    reach: number
  }
  status: 'draft' | 'scheduled' | 'published' | 'failed'
  scheduledFor?: Date
  publishedAt?: Date
  createdAt: Date
}

interface Campaign {
  id: string
  influencerId: string
  name: string
  type: string
  platforms: string[]
  status: 'active' | 'paused' | 'completed' | 'failed'
  duration: number
  startedAt?: Date
  completedAt?: Date
  metrics: {
    reach: number
    engagement: number
    followers: number
    viralScore: number
    contentGenerated: number
  }
  targetMetrics: {
    reach?: number
    engagement?: number
    followers?: number
    viralScore?: number
  }
  createdAt: Date
}

// In-memory storage (replace with database in production)
const influencers = new Map<string, Influencer>()
const content = new Map<string, Content>()
const campaigns = new Map<string, Campaign>()

// WebSocket publisher type
export type WsPublisher = (event: string, payload: unknown) => void

/**
 * Creates and configures influencer-related routes.
 * Accepts a WsPublisher instance and sets up REST API endpoints for managing influencers,
 * including creation, content generation, campaigns, and analytics.
 * Routes publish WebSocket events for real-time updates with event types like 'influencer:created',
 * 'content:generated', 'campaign:created', and 'content:scheduled'.
 * @param publish WebSocket publisher function for broadcasting events
 * @returns Express router with configured influencer routes
 */
export default (publish: WsPublisher) => {
  const router = Router()

  // Apply rate limiting to all routes
  router.use(influencerLimiter)

  // GET /influencers - List all influencers
  router.get('/', requireAuth, validate(querySchema), (req, res) => {
    try {
      const { page = 1, limit = 10, status, platform, sortBy = 'created_at', sortOrder = 'desc' } = req.query as any

      let userInfluencers = [...influencers.values()].filter((inf) => inf.ownerId === req.user!.id)

      // Apply filters
      if (status) {
        userInfluencers = userInfluencers.filter((inf) => inf.status === status)
      }
      if (platform) {
        userInfluencers = userInfluencers.filter((inf) => inf.platforms.includes(platform))
      }

      // Sort
      userInfluencers.sort((a, b) => {
        let aVal: number, bVal: number
        switch (sortBy) {
          case 'followers':
            aVal = a.metrics.totalFollowers
            bVal = b.metrics.totalFollowers
            break
          case 'engagement':
            aVal = a.metrics.totalEngagement
            bVal = b.metrics.totalEngagement
            break
          case 'viral_score':
            aVal = a.metrics.avgViralScore
            bVal = b.metrics.avgViralScore
            break
          default:
            aVal = a.createdAt.getTime()
            bVal = b.createdAt.getTime()
        }

        if (sortOrder === 'desc') {
          return bVal - aVal
        }
        return aVal - bVal
      })

      // Validate and cap pagination parameters for safety
      const validatedLimit = Math.max(1, Math.min(limit, 100)) // Ensure limit is at least 1, max 100
      const validatedPage = Math.max(1, page) // Ensure page is at least 1

      // Paginate
      const startIndex = (validatedPage - 1) * validatedLimit
      const endIndex = startIndex + validatedLimit
      const paginatedInfluencers = userInfluencers.slice(startIndex, endIndex)

      res.json({
        influencers: paginatedInfluencers,
        pagination: {
          page: validatedPage,
          limit: validatedLimit,
          total: userInfluencers.length,
          totalPages: Math.ceil(userInfluencers.length / validatedLimit),
        },
      })
    } catch (error) {
      console.error('Error listing influencers:', error)
      res.status(500).json({ error: 'Failed to list influencers' })
    }
  })

  // POST /influencers - Create new influencer
  router.post('/', requireAuth, validate(createInfluencerSchema), (req, res) => {
    try {
      const { name, persona, platforms, settings } = req.body as CreateInfluencerBody

      const influencer: Influencer = {
        id: randomUUID(),
        name,
        persona,
        platforms,
        status: 'active',
        settings: {
          postingFrequency: settings?.postingFrequency ?? INFLUENCER_DEFAULTS.postingFrequency,
          viralThreshold: settings?.viralThreshold ?? INFLUENCER_DEFAULTS.viralThreshold,
          riskTolerance: settings?.riskTolerance ?? INFLUENCER_DEFAULTS.riskTolerance,
          contentTypes: settings?.contentTypes ?? [...INFLUENCER_DEFAULTS.contentTypes],
          autoFollow: settings?.autoFollow ?? INFLUENCER_DEFAULTS.autoFollow,
          communityManagement: settings?.communityManagement ?? INFLUENCER_DEFAULTS.communityManagement,
        },
        metrics: {
          totalFollowers: 0,
          totalEngagement: 0,
          viralContent: 0,
          avgViralScore: 0,
        },
        ownerId: req.user!.id,
        createdAt: new Date(),
        updatedAt: new Date(),
      }

      influencers.set(influencer.id, influencer)

      // Broadcast creation event with error handling
      try {
        publish('influencer:created', { influencer })
      } catch (publishError) {
        console.error('Failed to publish influencer creation event:', publishError)
        // Don't fail the request due to publish errors
      }

      res.status(201).json(influencer)
    } catch (error) {
      console.error('Error creating influencer:', error)
      res.status(500).json({ error: 'Failed to create influencer' })
    }
  })

  // GET /influencers/:id - Get specific influencer
  router.get('/:id', requireAuth, validate(influencerIdParam), (req, res) => {
    try {
      const influencer = influencers.get(req.params.id)

      if (!influencer || influencer.ownerId !== req.user!.id) {
        return res.status(404).json({ error: 'Influencer not found' })
      }

      res.json(influencer)
    } catch (error) {
      console.error('Error getting influencer:', error)
      res.status(500).json({ error: 'Failed to get influencer' })
    }
  })

  // POST /influencers/:id/content - Generate content
  router.post('/:id/content', requireAuth, contentLimiter, validate(generateContentSchema), async (req, res) => {
    try {
      const { id } = req.params
      const { type, platform, topic, urgency, targetAudience, includeHashtags, scheduleFor } = req.body as any

      const influencer = influencers.get(id)
      if (!influencer || influencer.ownerId !== req.user!.id) {
        return res.status(404).json({ error: 'Influencer not found' })
      }

      if (!influencer.platforms.includes(platform)) {
        return res.status(400).json({ error: 'Platform not supported by this influencer' })
      }

      // Simulate content generation (replace with actual AI generation)
      const generatedContent = await ContentService.generateAIContent({
        type,
        platform,
        topic,
        urgency,
        targetAudience,
        persona: influencer.persona,
        includeHashtags,
      })

      const contentItem: Content = {
        id: randomUUID(),
        influencerId: id,
        platform,
        type,
        content: generatedContent.text,
        viralScore: generatedContent.viralScore,
        engagement: {
          likes: 0,
          shares: 0,
          comments: 0,
          reach: 0,
        },
        status: scheduleFor ? 'scheduled' : 'draft',
        scheduledFor: scheduleFor ? new Date(scheduleFor) : undefined,
        createdAt: new Date(),
      }

      content.set(contentItem.id, contentItem)

      // Broadcast content generation event
      publish('content:generated', {
        influencerId: id,
        content: contentItem,
      })

      res.status(201).json(contentItem)
    } catch (error) {
      console.error('Error generating content:', error)
      res.status(500).json({ error: 'Failed to generate content' })
    }
  })

  // GET /influencers/:id/content - Get content history
  router.get('/:id/content', requireAuth, validate(influencerIdParam), (req, res) => {
    try {
      const { id } = req.params
      const influencer = influencers.get(id)

      if (!influencer || influencer.ownerId !== req.user!.id) {
        return res.status(404).json({ error: 'Influencer not found' })
      }

      const influencerContent = [...content.values()]
        .filter((c) => c.influencerId === id)
        .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())

      res.json({
        content: influencerContent,
        stats: {
          total: influencerContent.length,
          published: influencerContent.filter((c) => c.status === 'published').length,
          scheduled: influencerContent.filter((c) => c.status === 'scheduled').length,
          avgViralScore: influencerContent.reduce((sum, c) => sum + c.viralScore, 0) / influencerContent.length || 0,
        },
      })
    } catch (error) {
      console.error('Error getting content history:', error)
      res.status(500).json({ error: 'Failed to get content history' })
    }
  })

  // POST /influencers/:id/campaigns - Create viral campaign
  router.post('/:id/campaigns', requireAuth, campaignLimiter, validate(createCampaignSchema), (req, res) => {
    try {
      const { id } = req.params
      const { name, type, platforms, duration, budget, targetMetrics, content: campaignContent } = req.body as any

      const influencer = influencers.get(id)
      if (!influencer || influencer.ownerId !== req.user!.id) {
        return res.status(404).json({ error: 'Influencer not found' })
      }

      // Validate platforms are supported
      const unsupportedPlatforms = platforms.filter((p: string) => !influencer.platforms.includes(p))
      if (unsupportedPlatforms.length > 0) {
        return res.status(400).json({
          error: `Platforms not supported: ${unsupportedPlatforms.join(', ')}`,
        })
      }

      const campaign: Campaign = {
        id: randomUUID(),
        influencerId: id,
        name,
        type,
        platforms,
        status: 'active',
        duration,
        startedAt: new Date(),
        metrics: {
          reach: 0,
          engagement: 0,
          followers: 0,
          viralScore: 0,
          contentGenerated: 0,
        },
        targetMetrics: targetMetrics || {},
        createdAt: new Date(),
      }

      campaigns.set(campaign.id, campaign)

      // Broadcast campaign creation event
      publish('campaign:created', {
        influencerId: id,
        campaign,
      })

      res.status(201).json(campaign)
    } catch (error) {
      console.error('Error creating campaign:', error)
      res.status(500).json({ error: 'Failed to create campaign' })
    }
  })

  // GET /influencers/:id/campaigns - Get campaign status
  router.get('/:id/campaigns', requireAuth, validate(influencerIdParam), (req, res) => {
    try {
      const { id } = req.params
      const influencer = influencers.get(id)

      if (!influencer || influencer.ownerId !== req.user!.id) {
        return res.status(404).json({ error: 'Influencer not found' })
      }

      const influencerCampaigns = [...campaigns.values()]
        .filter((c) => c.influencerId === id)
        .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())

      res.json({
        campaigns: influencerCampaigns,
        stats: {
          total: influencerCampaigns.length,
          active: influencerCampaigns.filter((c) => c.status === 'active').length,
          completed: influencerCampaigns.filter((c) => c.status === 'completed').length,
          totalReach: influencerCampaigns.reduce((sum, c) => sum + c.metrics.reach, 0),
        },
      })
    } catch (error) {
      console.error('Error getting campaigns:', error)
      res.status(500).json({ error: 'Failed to get campaigns' })
    }
  })

  // GET /influencers/:id/analytics - Get performance metrics
  router.get('/:id/analytics', requireAuth, validate(influencerIdParam), (req, res) => {
    try {
      const { id } = req.params
      const influencer = influencers.get(id)

      if (!influencer || influencer.ownerId !== req.user!.id) {
        return res.status(404).json({ error: 'Influencer not found' })
      }

      const influencerContent = [...content.values()].filter((c) => c.influencerId === id)
      const influencerCampaigns = [...campaigns.values()].filter((c) => c.influencerId === id)

      const analytics = {
        overview: {
          totalFollowers: influencer.metrics.totalFollowers,
          totalEngagement: influencer.metrics.totalEngagement,
          viralContent: influencer.metrics.viralContent,
          avgViralScore: influencer.metrics.avgViralScore,
        },
        content: {
          totalPosts: influencerContent.length,
          publishedPosts: influencerContent.filter((c) => c.status === 'published').length,
          avgEngagement:
            influencerContent.reduce(
              (sum, c) => sum + c.engagement.likes + c.engagement.shares + c.engagement.comments,
              0,
            ) / influencerContent.length || 0,
          topPerforming: influencerContent.sort((a, b) => b.viralScore - a.viralScore).slice(0, 5),
        },
        campaigns: {
          totalCampaigns: influencerCampaigns.length,
          activeCampaigns: influencerCampaigns.filter((c) => c.status === 'active').length,
          totalReach: influencerCampaigns.reduce((sum, c) => sum + c.metrics.reach, 0),
          avgCampaignScore:
            influencerCampaigns.reduce((sum, c) => sum + c.metrics.viralScore, 0) / influencerCampaigns.length || 0,
        },
        growth: {
          dailyGrowth: calculateDailyGrowth(influencer),
          engagementRate: calculateEngagementRate(influencer, influencerContent),
          viralSuccessRate:
            influencerContent.filter((c) => c.viralScore > influencer.settings.viralThreshold).length /
              influencerContent.length || 0,
        },
      }

      res.json(analytics)
    } catch (error) {
      console.error('Error getting analytics:', error)
      res.status(500).json({ error: 'Failed to get analytics' })
    }
  })

  // POST /influencers/:id/schedule - Schedule content
  router.post('/:id/schedule', requireAuth, validate(scheduleContentSchema), async (req, res) => {
    try {
      const { id } = req.params
      const {
        content: contentText,
        platform,
        scheduledFor,
        type,
        priority,
        viralOptimization,
        autoHashtags,
      } = req.body as any

      const influencer = influencers.get(id)
      if (!influencer || influencer.ownerId !== req.user!.id) {
        return res.status(404).json({ error: 'Influencer not found' })
      }

      if (!influencer.platforms.includes(platform)) {
        return res.status(400).json({ error: 'Platform not supported by this influencer' })
      }

      const scheduledDate = new Date(scheduledFor)
      if (scheduledDate <= new Date()) {
        return res.status(400).json({ error: 'Scheduled time must be in the future' })
      }

      // Optimize content if requested
      let optimizedContent = contentText
      let viralScore = 0.5

      if (viralOptimization) {
        const optimization = await ContentService.optimizeContentForViral({
          content: contentText,
          platform,
          persona: influencer.persona
        })
        optimizedContent = optimization.content
        viralScore = optimization.viralScore
      }

      const scheduledContent: Content = {
        id: randomUUID(),
        influencerId: id,
        platform,
        type,
        content: optimizedContent,
        viralScore,
        engagement: {
          likes: 0,
          shares: 0,
          comments: 0,
          reach: 0,
        },
        status: 'scheduled',
        scheduledFor: scheduledDate,
        createdAt: new Date(),
      }

      content.set(scheduledContent.id, scheduledContent)

      // Broadcast scheduling event
      publish('content:scheduled', {
        influencerId: id,
        content: scheduledContent,
      })

      res.status(201).json(scheduledContent)
    } catch (error) {
      console.error('Error scheduling content:', error)
      res.status(500).json({ error: 'Failed to schedule content' })
    }
  })

  // GET /influencers/:id/schedule - Get schedule status
  router.get('/:id/schedule', requireAuth, validate(influencerIdParam), (req, res) => {
    try {
      const { id } = req.params
      const influencer = influencers.get(id)

      if (!influencer || influencer.ownerId !== req.user!.id) {
        return res.status(404).json({ error: 'Influencer not found' })
      }

      const scheduledContent = [...content.values()]
        .filter((c) => c.influencerId === id && c.status === 'scheduled')
        .sort((a, b) => a.scheduledFor!.getTime() - b.scheduledFor!.getTime())

      const upcomingContent = scheduledContent.filter((c) => c.scheduledFor! > new Date())

      res.json({
        scheduled: scheduledContent,
        upcoming: upcomingContent,
        stats: {
          totalScheduled: scheduledContent.length,
          nextPost: upcomingContent[0]?.scheduledFor || null,
          avgViralScore: scheduledContent.reduce((sum, c) => sum + c.viralScore, 0) / scheduledContent.length || 0,
        },
      })
    } catch (error) {
      console.error('Error getting schedule:', error)
      res.status(500).json({ error: 'Failed to get schedule' })
    }
  })

  return router
}

// Helper functions (replace with actual implementations)
async function generateAIContent(params: any): Promise<{ text: string; viralScore: number }> {
  // Simulate AI content generation
  const templates = {
    text: [
      "🚀 The future of crypto is here! {topic} is about to change everything. Who's ready for the ride? #crypto #blockchain",
      '💎 Diamond hands only! {topic} showing incredible potential. This is not financial advice, but... 👀 #HODL',
      "🔥 Hot take: {topic} is undervalued right now. The smart money is already moving. Don't sleep on this! #alpha",
    ],
    meme: [
      'When you see {topic} pumping but you already sold 📉😭 #cryptomemes #FOMO',
      'Me explaining {topic} to my friends vs them actually listening 🤡 #crypto #memes',
      'POV: You bought {topic} at the top 🤡💸 #cryptolife #rekt',
    ],
  }

  const typeTemplates = templates[params.type as keyof typeof templates] || templates.text
  const template = typeTemplates[Math.floor(Math.random() * typeTemplates.length)]
  const content = template.replace('{topic}', params.topic || 'crypto')

  return {
    text: content,
    viralScore: Math.random() * 0.4 + 0.6, // Random score between 0.6-1.0
  }
}

async function optimizeContentForViral(
  content: string,
  platform: string,
  persona: string,
): Promise<{ content: string; viralScore: number }> {
  // Simulate viral optimization
  let optimized = content

  // Add platform-specific optimizations
  if (platform === 'twitter' && !content.includes('#')) {
    optimized += ' #crypto #viral'
  }

  // Add urgency words for higher viral score
  const urgencyWords = ['🚀', '🔥', '💎', 'BREAKING:', 'URGENT:', "Don't miss out!"]
  if (!urgencyWords.some((word) => content.includes(word))) {
    optimized = '🚀 ' + optimized
  }

  return {
    content: optimized,
    viralScore: Math.random() * 0.3 + 0.7, // Higher score for optimized content
  }
}

function calculateDailyGrowth(influencer: Influencer): number {
  // Simulate daily growth calculation
  return Math.random() * 100 + 10 // Random growth between 10-110
}

function calculateEngagementRate(influencer: Influencer, content: Content[]): number {
  if (content.length === 0) return 0

  const totalEngagement = content.reduce(
    (sum, c) => sum + c.engagement.likes + c.engagement.shares + c.engagement.comments,
    0,
  )

  return (totalEngagement / (influencer.metrics.totalFollowers || 1)) * 100
}
