import { EventEmitter } from 'events';
import { SocialPlatform, SocialContent, SocialPostResult, SocialAction, SocialEngagementResult, SocialMonitorQuery, SocialMonitorResult } from '../types';
import { TwitterPlatform } from './platforms/TwitterPlatform';
import { DiscordPlatform } from './platforms/DiscordPlatform';
import { TelegramPlatform } from './platforms/TelegramPlatform';

export type SocialPlatformType = 'twitter' | 'discord' | 'telegram';

/**
 * Unified social media orchestration system
 * Manages posting, engagement, and monitoring across multiple platforms
 */
export class SocialOrchestrator extends EventEmitter {
  private platforms: Map<SocialPlatformType, SocialPlatform> = new Map();
  private postingQueue: SocialQueuedPost[] = [];
  private isProcessing = false;
  private rateLimiters = new Map<SocialPlatformType, RateLimiter>();

  constructor() {
    super();
    this.initializePlatforms();
  }

  /**
   * Initialize social media platforms
   */
  private initializePlatforms(): void {
    this.platforms.set('twitter', new TwitterPlatform());
    this.platforms.set('discord', new DiscordPlatform());
    this.platforms.set('telegram', new TelegramPlatform());

    // Initialize rate limiters
    for (const [platformName] of this.platforms) {
      this.rateLimiters.set(platformName, new RateLimiter(platformName));
    }

    this.emit('platforms_initialized', Array.from(this.platforms.keys()));
  }

  /**
   * Post content to specified platforms
   */
  async postToPlatforms(
    content: SocialContent,
    platforms: SocialPlatformType[] = ['twitter']
  ): Promise<Record<string, SocialPostResult>> {
    const results: Record<string, SocialPostResult> = {};

    for (const platformName of platforms) {
      try {
        const platform = this.platforms.get(platformName);
        if (!platform || platform.status !== 'connected') {
          results[platformName] = {
            success: false,
            post_id: '',
            platform: platformName,
            error: `Platform ${platformName} not available`
          };
          continue;
        }

        // Check rate limits
        await this.checkRateLimit(platformName);

        const result = await platform.post(content);
        results[platformName] = result;

        if (result.success) {
          this.emit('post_successful', {
            platform: platformName,
            post_id: result.post_id,
            content: content.text.substring(0, 100) + '...'
          });
        } else {
          this.emit('post_failed', {
            platform: platformName,
            error: result.error
          });
        }

      } catch (error) {
        console.error(`${platformName} posting failed:`, error);
        results[platformName] = {
          success: false,
          post_id: '',
          platform: platformName,
          error: error instanceof Error ? error.message : 'Unknown error'
        };
      }
    }

    return results;
  }

  /**
   * Engage with content on specified platforms
   */
  async engageWithContent(
    platform: SocialPlatformType,
    postId: string,
    action: SocialAction
  ): Promise<SocialEngagementResult> {
    try {
      const socialPlatform = this.platforms.get(platform);
      if (!socialPlatform || socialPlatform.status !== 'connected') {
        return {
          success: false,
          error: `Platform ${platform} not available`
        };
      }

      await this.checkRateLimit(platform);
      const result = await socialPlatform.engage(postId, action);

      if (result.success) {
        this.emit('engagement_successful', {
          platform,
          post_id: postId,
          action: action.type
        });
      }

      return result;
    } catch (error) {
      console.error(`${platform} engagement failed:`, error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  /**
   * Monitor social media content
   */
  async monitorPlatforms(
    query: SocialMonitorQuery,
    platforms: SocialPlatformType[] = ['twitter']
  ): Promise<Record<string, SocialMonitorResult>> {
    const results: Record<string, SocialMonitorResult> = {};

    for (const platformName of platforms) {
      try {
        const platform = this.platforms.get(platformName);
        if (!platform || platform.status !== 'connected') {
          results[platformName] = {
            posts: [],
            trends: [],
            engagement_rate: 0
          };
          continue;
        }

        await this.checkRateLimit(platformName);
        const result = await platform.monitor(query);
        results[platformName] = result;

      } catch (error) {
        console.error(`${platformName} monitoring failed:`, error);
        results[platformName] = {
          posts: [],
          trends: [],
          engagement_rate: 0
        };
      }
    }

    return results;
  }

  /**
   * Schedule content for automated posting
   */
  schedulePost(
    content: SocialContent,
    platforms: SocialPlatformType[],
    delayMs: number = 0
  ): void {
    const queuedPost: SocialQueuedPost = {
      id: this.generateId(),
      content,
      platforms,
      scheduledTime: new Date(Date.now() + delayMs),
      createdAt: new Date()
    };

    this.postingQueue.push(queuedPost);
    this.postingQueue.sort((a, b) => a.scheduledTime.getTime() - b.scheduledTime.getTime());

    this.emit('post_scheduled', {
      id: queuedPost.id,
      platforms,
      scheduledTime: queuedPost.scheduledTime
    });

    this.processQueue();
  }

  /**
   * Process the posting queue
   */
  private async processQueue(): Promise<void> {
    if (this.isProcessing || this.postingQueue.length === 0) {
      return;
    }

    this.isProcessing = true;

    try {
      const now = new Date();
      const duePosts = this.postingQueue.filter(post => post.scheduledTime <= now);

      for (const queuedPost of duePosts) {
        try {
          await this.postToPlatforms(queuedPost.content, queuedPost.platforms);
          this.emit('scheduled_post_completed', { id: queuedPost.id });
        } catch (error) {
          console.error(`Scheduled post ${queuedPost.id} failed:`, error);
          this.emit('scheduled_post_failed', { id: queuedPost.id, error });
        }
      }

      // Remove completed posts
      this.postingQueue = this.postingQueue.filter(post => post.scheduledTime > now);

    } finally {
      this.isProcessing = false;

      // If there are still posts in the queue, schedule next processing
      if (this.postingQueue.length > 0) {
        const nextPostDelay = Math.max(0, this.postingQueue[0].scheduledTime.getTime() - Date.now());
        setTimeout(() => this.processQueue(), nextPostDelay);
      }
    }
  }

  /**
   * Configure platform credentials
   */
  async configurePlatform(
    platform: SocialPlatformType,
    config: Record<string, string>
  ): Promise<boolean> {
    try {
      const socialPlatform = this.platforms.get(platform);
      if (!socialPlatform) {
        throw new Error(`Platform ${platform} not found`);
      }

      // Update platform configuration
      socialPlatform.config = { ...socialPlatform.config, ...config };

      // Test connection
      const testResult = await this.testPlatformConnection(platform);

      if (testResult) {
        socialPlatform.status = 'connected';
        this.emit('platform_connected', { platform, config: Object.keys(config) });
      } else {
        socialPlatform.status = 'error';
      }

      return testResult;
    } catch (error) {
      console.error(`Failed to configure ${platform}:`, error);
      return false;
    }
  }

  /**
   * Test platform connection
   */
  private async testPlatformConnection(platform: SocialPlatformType): Promise<boolean> {
    try {
      const socialPlatform = this.platforms.get(platform);
      if (!socialPlatform) return false;

      // Simple test - try to monitor with minimal query
      await socialPlatform.monitor({
        terms: ['test'],
        limit: 1
      });

      return true;
    } catch (error) {
      return false;
    }
  }

  /**
   * Check and enforce rate limits
   */
  private async checkRateLimit(platform: SocialPlatformType): Promise<void> {
    const limiter = this.rateLimiters.get(platform);
    if (limiter) {
      await limiter.checkLimit();
    }
  }

  /**
   * Get platform statuses
   */
  getPlatformStatuses(): Record<SocialPlatformType, { status: string; last_check: Date }> {
    const statuses = {} as Record<SocialPlatformType, { status: string; last_check: Date }>;

    for (const [name, platform] of this.platforms) {
      statuses[name] = {
        status: platform.status,
        last_check: new Date()
      };
    }

    return statuses;
  }

  /**
   * Generate unique ID for queued posts
   */
  private generateId(): string {
    return `post_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }
}

/**
 * Rate limiter for social media platforms
 */
class RateLimiter {
  private requests: number[] = [];

  constructor(
    private platform: SocialPlatformType,
    private maxRequests: number = 300,
    private windowMs: number = 900000 // 15 minutes
  ) {}

  async checkLimit(): Promise<void> {
    const now = Date.now();

    // Remove requests outside the window
    this.requests = this.requests.filter(time => now - time < this.windowMs);

    if (this.requests.length >= this.maxRequests) {
      const oldestRequest = Math.min(...this.requests);
      const waitTime = this.windowMs - (now - oldestRequest);

      throw new Error(`Rate limit exceeded for ${this.platform}. Wait ${Math.ceil(waitTime / 1000)} seconds.`);
    }

    this.requests.push(now);
  }
}

/**
 * Queued post structure
 */
interface SocialQueuedPost {
  id: string;
  content: SocialContent;
  platforms: SocialPlatformType[];
  scheduledTime: Date;
  createdAt: Date;
}
