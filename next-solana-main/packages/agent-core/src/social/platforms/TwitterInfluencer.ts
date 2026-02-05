import { TwitterApi, TweetV2PostTweetResult, UserV2 } from 'twitter-api-v2';
import { SocialPlatform, SocialContent, SocialPostResult, SocialAction, SocialEngagementResult, SocialMonitorQuery, SocialMonitorResult } from '../../types';

export interface TwitterInfluencerConfig {
  api_key: string;
  api_secret: string;
  access_token: string;
  access_secret: string;
  bearer_token: string;
  username?: string;
  user_id?: string;
  growth_settings?: {
    daily_follow_limit: number;
    daily_unfollow_limit: number;
    engagement_rate_target: number;
    hashtag_targets: string[];
    competitor_accounts: string[];
  };
  content_settings?: {
    thread_frequency: number;
    quote_tweet_ratio: number;
    viral_threshold: number;
    optimal_posting_times: string[];
  };
}

export interface ViralThread {
  hook: string;
  content: string[];
  cta: string;
  hashtags: string[];
  estimated_viral_score: number;
}

export interface TrendData {
  hashtag: string;
  volume: number;
  sentiment: 'positive' | 'negative' | 'neutral';
  growth_rate: number;
  relevance_score: number;
}

export interface HashtagPerformance {
  hashtag: string;
  impressions: number;
  engagement_rate: number;
  reach: number;
  clicks: number;
  best_performing_time: string;
}

export interface TwitterPresenceMetrics {
  follower_count: number;
  following_count: number;
  tweet_count: number;
  engagement_rate: number;
  reach: number;
  impressions: number;
  mention_count: number;
  viral_tweets: number;
}

export interface OptimalPostingData {
  time: string;
  day_of_week: string;
  expected_engagement: number;
  audience_activity: number;
  competition_level: number;
}

export class TwitterInfluencer implements SocialPlatform {
  id = 'twitter-influencer';
  name = 'twitter' as const;
  status: 'connected' | 'disconnected' | 'error' = 'disconnected';
  config: TwitterInfluencerConfig;
  
  private client: TwitterApi;
  private readOnlyClient: TwitterApi;
  private userId?: string;
  private username?: string;
  
  rate_limits = {
    requests_per_minute: 300,
    posts_per_hour: 50,
    likes_per_hour: 1000,
    follows_per_day: 400,
    unfollows_per_day: 400
  };

  private lastPostTime: number = 0;
  private dailyPostCount: number = 0;
  private dailyFollowCount: number = 0;
  private dailyUnfollowCount: number = 0;
  private lastResetDate: string = new Date().toDateString();

  constructor(config: TwitterInfluencerConfig) {
    this.config = config;
    
    // Initialize Twitter clients
    this.client = new TwitterApi({
      appKey: config.api_key,
      appSecret: config.api_secret,
      accessToken: config.access_token,
      accessSecret: config.access_secret,
    });

    this.readOnlyClient = new TwitterApi(config.bearer_token);
    
    this.initialize();
  }

  private async initialize(): Promise<void> {
    try {
      // Verify credentials and get user info
      const me = await this.client.v2.me();
      this.userId = me.data.id;
      this.username = me.data.username;
      this.status = 'connected';
      
      console.log(`Twitter Influencer initialized for @${this.username}`);
    } catch (error) {
      console.error('Failed to initialize Twitter Influencer:', error);
      this.status = 'error';
    }
  }

  private resetDailyLimits(): void {
    const today = new Date().toDateString();
    if (this.lastResetDate !== today) {
      this.dailyPostCount = 0;
      this.dailyFollowCount = 0;
      this.dailyUnfollowCount = 0;
      this.lastResetDate = today;
    }
  }

  private async rateLimitCheck(action: 'post' | 'follow' | 'unfollow'): Promise<boolean> {
    this.resetDailyLimits();
    
    const now = Date.now();
    const timeSinceLastPost = now - this.lastPostTime;
    const minInterval = (60 * 60 * 1000) / this.rate_limits.posts_per_hour; // Convert to milliseconds
    
    switch (action) {
      case 'post':
        if (timeSinceLastPost < minInterval || this.dailyPostCount >= this.rate_limits.posts_per_hour * 24) {
          return false;
        }
        break;
      case 'follow':
        if (this.dailyFollowCount >= this.rate_limits.follows_per_day) {
          return false;
        }
        break;
      case 'unfollow':
        if (this.dailyUnfollowCount >= this.rate_limits.unfollows_per_day) {
          return false;
        }
        break;
    }
    
    return true;
  }

  async post(content: SocialContent): Promise<SocialPostResult> {
    try {
      if (!await this.rateLimitCheck('post')) {
        throw new Error('Rate limit exceeded for posting');
      }

      const tweetOptions: any = {
        text: content.text
      };

      // Add media if provided
      if (content.media && content.media.length > 0) {
        const mediaIds = await Promise.all(
          content.media.slice(0, 4).map(async (mediaUrl) => {
            return await this.client.v1.uploadMedia(mediaUrl);
          })
        );
        tweetOptions.media = { media_ids: mediaIds };
      }

      // Add reply if specified
      if (content.reply_to) {
        tweetOptions.reply = { in_reply_to_tweet_id: content.reply_to };
      }

      // Add quote tweet if specified
      if (content.quote_tweet_id) {
        tweetOptions.quote_tweet_id = content.quote_tweet_id;
      }

      const result = await this.client.v2.tweet(tweetOptions);
      
      this.lastPostTime = Date.now();
      this.dailyPostCount++;

      return {
        success: true,
        post_id: result.data.id,
        platform: 'twitter',
        url: `https://twitter.com/${this.username}/status/${result.data.id}`
      };
    } catch (error) {
      console.error('Failed to post tweet:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
        platform: 'twitter'
      };
    }
  }

  async createViralThread(thread: ViralThread): Promise<SocialPostResult> {
    try {
      if (!await this.rateLimitCheck('post')) {
        throw new Error('Rate limit exceeded for thread creation');
      }

      const tweets = [
        `${thread.hook} 🧵`,
        ...thread.content,
        `${thread.cta} ${thread.hashtags.join(' ')}`
      ];

      const results = await this.client.v2.tweetThread(tweets);
      
      this.lastPostTime = Date.now();
      this.dailyPostCount += tweets.length;

      return {
        success: true,
        post_id: results[0].data.id,
        platform: 'twitter',
        url: `https://twitter.com/${this.username}/status/${results[0].data.id}`,
        thread_ids: results.map(r => r.data.id)
      };
    } catch (error) {
      console.error('Failed to create viral thread:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
        platform: 'twitter'
      };
    }
  }

  async engageWithTrends(trends: TrendData[], engagementCount: number = 5): Promise<SocialEngagementResult[]> {
    const results: SocialEngagementResult[] = [];
    
    try {
      // Sort trends by relevance and growth rate
      const sortedTrends = trends
        .filter(t => t.sentiment !== 'negative')
        .sort((a, b) => (b.relevance_score * b.growth_rate) - (a.relevance_score * a.growth_rate))
        .slice(0, engagementCount);

      for (const trend of sortedTrends) {
        try {
          // Search for recent tweets with the trending hashtag
          const searchResults = await this.readOnlyClient.v2.search(trend.hashtag, {
            max_results: 10,
            'tweet.fields': ['author_id', 'created_at', 'public_metrics'],
            'user.fields': ['verified', 'public_metrics'],
            expansions: ['author_id']
          });

          if (searchResults.data?.data) {
            // Engage with top performing tweets
            for (const tweet of searchResults.data.data.slice(0, 3)) {
              if (this.userId && tweet.id !== this.userId) {
                // Like the tweet
                await this.client.v2.like(this.userId, tweet.id);
                
                // Retweet if it's high quality
                if (tweet.public_metrics?.like_count && tweet.public_metrics.like_count > 100) {
                  await this.client.v2.retweet(this.userId, tweet.id);
                }
                
                // Add small delay to avoid rate limits
                await new Promise(resolve => setTimeout(resolve, 1000));
              }
            }
          }

          results.push({
            success: true,
            engagement_type: 'trend_engagement',
            target: trend.hashtag
          });
        } catch (error) {
          results.push({
            success: false,
            error: error instanceof Error ? error.message : 'Unknown error',
            engagement_type: 'trend_engagement',
            target: trend.hashtag
          });
        }
      }
    } catch (error) {
      console.error('Failed to engage with trends:', error);
    }

    return results;
  }

  async scheduleOptimalPosts(content: SocialContent[], optimalTimes: OptimalPostingData[]): Promise<SocialPostResult[]> {
    const results: SocialPostResult[] = [];
    
    try {
      // Sort optimal times by expected engagement
      const sortedTimes = optimalTimes.sort((a, b) => b.expected_engagement - a.expected_engagement);
      
      for (let i = 0; i < Math.min(content.length, sortedTimes.length); i++) {
        const postContent = content[i];
        const optimalTime = sortedTimes[i];
        
        // Calculate delay until optimal time
        const now = new Date();
        const [hours, minutes] = optimalTime.time.split(':').map(Number);
        const targetTime = new Date();
        targetTime.setHours(hours, minutes, 0, 0);
        
        if (targetTime <= now) {
          targetTime.setDate(targetTime.getDate() + 1);
        }
        
        const delay = targetTime.getTime() - now.getTime();
        
        // Schedule the post
        setTimeout(async () => {
          const result = await this.post(postContent);
          results.push(result);
        }, delay);
      }
    } catch (error) {
      console.error('Failed to schedule optimal posts:', error);
    }

    return results;
  }

  async trackHashtagPerformance(hashtags: string[], timeframe: '24h' | '7d' | '30d' = '24h'): Promise<HashtagPerformance[]> {
    const performances: HashtagPerformance[] = [];
    
    try {
      for (const hashtag of hashtags) {
        try {
          // Search for tweets with the hashtag
          const searchResults = await this.readOnlyClient.v2.search(hashtag, {
            max_results: 100,
            'tweet.fields': ['created_at', 'public_metrics', 'author_id'],
            'user.fields': ['public_metrics']
          });

          if (searchResults.data?.data) {
            const tweets = searchResults.data.data;
            const totalImpressions = tweets.reduce((sum, tweet) => 
              sum + (tweet.public_metrics?.impression_count || 0), 0);
            const totalEngagements = tweets.reduce((sum, tweet) => 
              sum + (tweet.public_metrics?.like_count || 0) + 
              (tweet.public_metrics?.retweet_count || 0) + 
              (tweet.public_metrics?.reply_count || 0), 0);
            
            const engagementRate = totalImpressions > 0 ? (totalEngagements / totalImpressions) * 100 : 0;
            
            // Find best performing time
            const hourCounts: { [hour: string]: number } = {};
            tweets.forEach(tweet => {
              if (tweet.created_at) {
                const hour = new Date(tweet.created_at).getHours();
                hourCounts[hour] = (hourCounts[hour] || 0) + 1;
              }
            });
            
            const bestHour = Object.keys(hourCounts).reduce((a, b) => 
              hourCounts[a] > hourCounts[b] ? a : b, '0');

            performances.push({
              hashtag,
              impressions: totalImpressions,
              engagement_rate: engagementRate,
              reach: tweets.length,
              clicks: 0, // Would need additional API access
              best_performing_time: `${bestHour}:00`
            });
          }
        } catch (error) {
          console.error(`Failed to track performance for ${hashtag}:`, error);
        }
      }
    } catch (error) {
      console.error('Failed to track hashtag performance:', error);
    }

    return performances;
  }

  async buildTwitterPresence(strategy: {
    target_accounts: string[];
    engagement_actions: ('like' | 'retweet' | 'reply')[];
    daily_engagement_limit: number;
  }): Promise<TwitterPresenceMetrics> {
    try {
      let engagementCount = 0;
      const maxEngagements = Math.min(strategy.daily_engagement_limit, 100); // Safety limit

      for (const targetAccount of strategy.target_accounts) {
        if (engagementCount >= maxEngagements) break;

        try {
          // Get user by username
          const user = await this.readOnlyClient.v2.userByUsername(targetAccount);
          if (!user.data) continue;

          // Get their recent tweets
          const tweets = await this.readOnlyClient.v2.userTimeline(user.data.id, {
            max_results: 10,
            'tweet.fields': ['created_at', 'public_metrics']
          });

          if (tweets.data?.data) {
            for (const tweet of tweets.data.data.slice(0, 3)) {
              if (engagementCount >= maxEngagements) break;

              // Perform engagement actions
              if (strategy.engagement_actions.includes('like') && this.userId) {
                await this.client.v2.like(this.userId, tweet.id);
                engagementCount++;
                await new Promise(resolve => setTimeout(resolve, 2000)); // Rate limit protection
              }

              if (strategy.engagement_actions.includes('retweet') && 
                  tweet.public_metrics?.like_count && 
                  tweet.public_metrics.like_count > 50 && 
                  this.userId) {
                await this.client.v2.retweet(this.userId, tweet.id);
                engagementCount++;
                await new Promise(resolve => setTimeout(resolve, 2000));
              }
            }
          }
        } catch (error) {
          console.error(`Failed to engage with ${targetAccount}:`, error);
        }
      }

      // Get current metrics
      const metrics = await this.getPresenceMetrics();
      return metrics;
    } catch (error) {
      console.error('Failed to build Twitter presence:', error);
      throw error;
    }
  }

  private async getPresenceMetrics(): Promise<TwitterPresenceMetrics> {
    try {
      if (!this.userId) {
        throw new Error('User ID not available');
      }

      const user = await this.client.v2.me({
        'user.fields': ['public_metrics']
      });

      const metrics = user.data.public_metrics;

      return {
        follower_count: metrics?.followers_count || 0,
        following_count: metrics?.following_count || 0,
        tweet_count: metrics?.tweet_count || 0,
        engagement_rate: 0, // Would need additional calculation
        reach: 0, // Would need analytics API
        impressions: 0, // Would need analytics API
        mention_count: 0, // Would need search API
        viral_tweets: 0 // Would need additional tracking
      };
    } catch (error) {
      console.error('Failed to get presence metrics:', error);
      return {
        follower_count: 0,
        following_count: 0,
        tweet_count: 0,
        engagement_rate: 0,
        reach: 0,
        impressions: 0,
        mention_count: 0,
        viral_tweets: 0
      };
    }
  }

  async engage(postId: string, action: SocialAction): Promise<SocialEngagementResult> {
    try {
      if (!this.userId) {
        throw new Error('User ID not available');
      }

      switch (action.type) {
        case 'like':
          await this.client.v2.like(this.userId, postId);
          break;
        case 'retweet':
          await this.client.v2.retweet(this.userId, postId);
          break;
        case 'reply':
          if (action.content) {
            await this.client.v2.tweet({
              text: action.content,
              reply: { in_reply_to_tweet_id: postId }
            });
          }
          break;
        case 'quote':
          if (action.content) {
            await this.client.v2.tweet({
              text: action.content,
              quote_tweet_id: postId
            });
          }
          break;
        default:
          throw new Error(`Unsupported action type: ${action.type}`);
      }

      return {
        success: true,
        engagement_type: action.type,
        target: postId
      };
    } catch (error) {
      console.error('Failed to engage with post:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
        engagement_type: action.type,
        target: postId
      };
    }
  }

  async monitor(query: SocialMonitorQuery): Promise<SocialMonitorResult> {
    try {
      const searchResults = await this.readOnlyClient.v2.search(query.keywords.join(' OR '), {
        max_results: query.limit || 100,
        'tweet.fields': ['created_at', 'public_metrics', 'author_id', 'context_annotations'],
        'user.fields': ['verified', 'public_metrics'],
        expansions: ['author_id']
      });

      const posts = searchResults.data?.data?.map(tweet => ({
        id: tweet.id,
        text: tweet.text || '',
        author: tweet.author_id || '',
        created_at: tweet.created_at || '',
        metrics: {
          likes: tweet.public_metrics?.like_count || 0,
          shares: tweet.public_metrics?.retweet_count || 0,
          comments: tweet.public_metrics?.reply_count || 0,
          views: tweet.public_metrics?.impression_count || 0
        }
      })) || [];

      // Extract trends from context annotations
      const trends = searchResults.data?.data?.flatMap(tweet => 
        tweet.context_annotations?.map(annotation => annotation.entity.name) || []
      ).filter((value, index, self) => self.indexOf(value) === index) || [];

      // Calculate engagement rate
      const totalEngagements = posts.reduce((sum, post) => 
        sum + post.metrics.likes + post.metrics.shares + post.metrics.comments, 0);
      const totalViews = posts.reduce((sum, post) => sum + post.metrics.views, 0);
      const engagementRate = totalViews > 0 ? (totalEngagements / totalViews) * 100 : 0;

      return {
        posts,
        trends,
        engagement_rate: engagementRate
      };
    } catch (error) {
      console.error('Failed to monitor Twitter:', error);
      return {
        posts: [],
        trends: [],
        engagement_rate: 0
      };
    }
  }

  // Additional influencer-specific methods

  async getOptimalPostingTimes(): Promise<OptimalPostingData[]> {
    // This would typically analyze historical data
    // For now, return common optimal times for crypto Twitter
    return [
      {
        time: '09:00',
        day_of_week: 'Monday',
        expected_engagement: 85,
        audience_activity: 90,
        competition_level: 60
      },
      {
        time: '13:00',
        day_of_week: 'Tuesday',
        expected_engagement: 80,
        audience_activity: 85,
        competition_level: 70
      },
      {
        time: '15:00',
        day_of_week: 'Wednesday',
        expected_engagement: 75,
        audience_activity: 80,
        competition_level: 75
      },
      {
        time: '11:00',
        day_of_week: 'Thursday',
        expected_engagement: 82,
        audience_activity: 88,
        competition_level: 65
      },
      {
        time: '10:00',
        day_of_week: 'Friday',
        expected_engagement: 78,
        audience_activity: 82,
        competition_level: 80
      }
    ];
  }

  async getTrendingHashtags(category: 'crypto' | 'general' = 'crypto'): Promise<TrendData[]> {
    try {
      // Get trending topics (this would need Twitter API v1.1 or trends endpoint)
      // For now, return common crypto trending hashtags
      const cryptoTrends = [
        { hashtag: '#Bitcoin', volume: 50000, sentiment: 'positive' as const, growth_rate: 15, relevance_score: 95 },
        { hashtag: '#Ethereum', volume: 35000, sentiment: 'positive' as const, growth_rate: 12, relevance_score: 90 },
        { hashtag: '#Solana', volume: 25000, sentiment: 'positive' as const, growth_rate: 20, relevance_score: 85 },
        { hashtag: '#DeFi', volume: 20000, sentiment: 'neutral' as const, growth_rate: 8, relevance_score: 80 },
        { hashtag: '#NFT', volume: 18000, sentiment: 'neutral' as const, growth_rate: 5, relevance_score: 75 }
      ];

      return cryptoTrends;
    } catch (error) {
      console.error('Failed to get trending hashtags:', error);
      return [];
    }
  }

  async analyzeCompetitors(competitorUsernames: string[]): Promise<any[]> {
    const analyses = [];

    for (const username of competitorUsernames) {
      try {
        const user = await this.readOnlyClient.v2.userByUsername(username, {
          'user.fields': ['public_metrics', 'verified', 'created_at']
        });

        if (user.data) {
          const tweets = await this.readOnlyClient.v2.userTimeline(user.data.id, {
            max_results: 50,
            'tweet.fields': ['created_at', 'public_metrics']
          });

          const avgEngagement = tweets.data?.data?.reduce((sum, tweet) => {
            const engagement = (tweet.public_metrics?.like_count || 0) + 
                            (tweet.public_metrics?.retweet_count || 0) + 
                            (tweet.public_metrics?.reply_count || 0);
            return sum + engagement;
          }, 0) / (tweets.data?.data?.length || 1) || 0;

          analyses.push({
            username,
            follower_count: user.data.public_metrics?.followers_count || 0,
            following_count: user.data.public_metrics?.following_count || 0,
            tweet_count: user.data.public_metrics?.tweet_count || 0,
            verified: user.data.verified || false,
            avg_engagement: avgEngagement,
            engagement_rate: user.data.public_metrics?.followers_count ? 
              (avgEngagement / user.data.public_metrics.followers_count) * 100 : 0
          });
        }
      } catch (error) {
        console.error(`Failed to analyze competitor ${username}:`, error);
      }
    }

    return analyses;
  }

  async generateViralContent(topic: string, style: 'educational' | 'humorous' | 'controversial' = 'educational'): Promise<ViralThread> {
    // This would typically use AI to generate content
    // For now, return a template-based viral thread
    const templates = {
      educational: {
        hook: `🧵 THREAD: Everything you need to know about ${topic}`,
        content: [
          `1/ ${topic} is revolutionizing the crypto space. Here's why you should pay attention...`,
          `2/ The technology behind ${topic} solves key problems in the industry:`,
          `3/ Key benefits include: ✅ Scalability ✅ Security ✅ Decentralization`,
          `4/ Major players are already adopting this technology...`,
          `5/ What this means for the future of crypto:`
        ],
        cta: `That's a wrap! If you found this helpful, please RT the first tweet and follow for more crypto insights.`,
        hashtags: ['#Crypto', '#Blockchain', '#DeFi']
      },
      humorous: {
        hook: `POV: You're trying to explain ${topic} to your friends 😂`,
        content: [
          `1/ Friend: "So what's this crypto thing you're always talking about?"`,
          `2/ Me: *takes deep breath* "Well, it all started with this thing called ${topic}..."`,
          `3/ Friend: "Is this like Bitcoin?"`,
          `4/ Me: *eye twitches* "Let me explain the difference..."`,
          `5/ Friend: "So... should I buy some?"`,
          `6/ Me: "DYOR but..." *proceeds to give financial advice anyway* 🤡`
        ],
        cta: `Tag a friend who needs to learn about ${topic}! 😄`,
        hashtags: ['#CryptoMemes', '#Crypto', '#DYOR']
      },
      controversial: {
        hook: `🚨 Unpopular opinion: ${topic} is overhyped. Here's why...`,
        content: [
          `1/ Everyone's talking about ${topic}, but let's look at the facts:`,
          `2/ The technology has serious limitations that nobody wants to discuss:`,
          `3/ Adoption is slower than promised, and here's the data:`,
          `4/ Competitors are already solving these problems better:`,
          `5/ Don't get me wrong - there's potential, but the hype is dangerous`
        ],
        cta: `Agree or disagree? Let me know your thoughts below. 👇`,
        hashtags: ['#CryptoReality', '#Crypto', '#UnpopularOpinion']
      }
    };

    const template = templates[style];
    
    return {
      hook: template.hook,
      content: template.content,
      cta: template.cta,
      hashtags: template.hashtags,
      estimated_viral_score: Math.floor(Math.random() * 40) + 60 // 60-100
    };
  }
}