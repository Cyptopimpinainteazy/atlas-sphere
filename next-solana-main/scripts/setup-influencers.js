#!/usr/bin/env node

/**
 * Influencer System Setup Script
 * Initializes the AI influencer system with database migrations, personas, and configurations
 */

import { promises as fs } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { createClient } from '@supabase/supabase-js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Color codes for console output
const colors = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  magenta: '\x1b[35m',
  cyan: '\x1b[36m'
};

const log = {
  info: (msg) => console.log(`${colors.blue}ℹ${colors.reset} ${msg}`),
  success: (msg) => console.log(`${colors.green}✓${colors.reset} ${msg}`),
  warning: (msg) => console.log(`${colors.yellow}⚠${colors.reset} ${msg}`),
  error: (msg) => console.log(`${colors.red}✗${colors.reset} ${msg}`),
  header: (msg) => console.log(`\n${colors.bright}${colors.cyan}${msg}${colors.reset}\n`)
};

class InfluencerSetup {
  constructor() {
    this.projectRoot = path.resolve(__dirname, '..');
    this.supabase = null;
    this.requiredEnvVars = [
      'SUPABASE_URL',
      'SUPABASE_ANON_KEY',
      'GROQ_API_KEY',
      'DEEPSEEK_API_KEY',
      'HUGGINGFACE_API_KEY'
    ];
    this.optionalEnvVars = [
      'TWITTER_CONSUMER_KEY',
      'TWITTER_CONSUMER_SECRET',
      'DISCORD_BOT_TOKEN',
      'TELEGRAM_BOT_TOKEN',
      'STABILITY_API_KEY',
      'OLLAMA_BASE_URL'
    ];
  }

  async run() {
    try {
      log.header('🚀 Initializing AI Influencer System');
      
      await this.validateEnvironment();
      await this.initializeDatabase();
      await this.runMigrations();
      await this.createDefaultPersonas();
      await this.initializeContentTemplates();
      await this.setupServiceHealthChecks();
      await this.createSampleInfluencers();
      await this.validateSystemConfiguration();
      
      log.header('🎉 Influencer System Setup Complete!');
      this.printNextSteps();
      
    } catch (error) {
      log.error(`Setup failed: ${error.message}`);
      process.exit(1);
    }
  }

  async validateEnvironment() {
    log.info('Validating environment variables...');
    
    const missingRequired = [];
    const missingOptional = [];
    
    // Check required environment variables
    for (const envVar of this.requiredEnvVars) {
      if (!process.env[envVar]) {
        missingRequired.push(envVar);
      }
    }
    
    // Check optional environment variables
    for (const envVar of this.optionalEnvVars) {
      if (!process.env[envVar]) {
        missingOptional.push(envVar);
      }
    }
    
    if (missingRequired.length > 0) {
      log.error(`Missing required environment variables: ${missingRequired.join(', ')}`);
      log.info('Please check .env.example for required configuration');
      throw new Error('Missing required environment variables');
    }
    
    if (missingOptional.length > 0) {
      log.warning(`Missing optional environment variables: ${missingOptional.join(', ')}`);
      log.info('Some features may be limited without these variables');
    }
    
    log.success('Environment validation complete');
  }

  async initializeDatabase() {
    log.info('Initializing database connection...');
    
    try {
      this.supabase = createClient(
        process.env.SUPABASE_URL,
        process.env.SUPABASE_ANON_KEY
      );
      
      // Test connection
      const { data, error } = await this.supabase.from('agents').select('count').limit(1);
      if (error && !error.message.includes('relation "agents" does not exist')) {
        throw error;
      }
      
      log.success('Database connection established');
    } catch (error) {
      log.error(`Database connection failed: ${error.message}`);
      throw error;
    }
  }

  async runMigrations() {
    log.info('Running influencer system migrations...');
    
    const migrations = [
      this.createInfluencersTable,
      this.createInfluencerContentTable,
      this.createViralCampaignsTable,
      this.createFollowerGrowthTable,
      this.createContentPerformanceTable,
      this.createContentTemplatesTable,
      this.createInfluencerMetricsTable
    ];
    
    for (const migration of migrations) {
      try {
        await migration.call(this);
      } catch (error) {
        log.warning(`Migration warning: ${error.message}`);
      }
    }
    
    log.success('Database migrations complete');
  }

  async createInfluencersTable() {
    const { error } = await this.supabase.rpc('exec_sql', {
      sql: `
        CREATE TABLE IF NOT EXISTS influencers (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          persona_id UUID REFERENCES agents(id) ON DELETE CASCADE,
          name VARCHAR(255) NOT NULL,
          type VARCHAR(50) NOT NULL DEFAULT 'crypto-influencer',
          status VARCHAR(50) NOT NULL DEFAULT 'active',
          configuration JSONB NOT NULL DEFAULT '{}',
          social_accounts JSONB NOT NULL DEFAULT '{}',
          growth_metrics JSONB NOT NULL DEFAULT '{}',
          created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
          updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
        );
        
        CREATE INDEX IF NOT EXISTS idx_influencers_persona_id ON influencers(persona_id);
        CREATE INDEX IF NOT EXISTS idx_influencers_type ON influencers(type);
        CREATE INDEX IF NOT EXISTS idx_influencers_status ON influencers(status);
      `
    });
    
    if (error) throw error;
  }

  async createInfluencerContentTable() {
    const { error } = await this.supabase.rpc('exec_sql', {
      sql: `
        CREATE TABLE IF NOT EXISTS influencer_content (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          influencer_id UUID REFERENCES influencers(id) ON DELETE CASCADE,
          platform VARCHAR(50) NOT NULL,
          content_type VARCHAR(50) NOT NULL,
          content TEXT NOT NULL,
          media_urls JSONB DEFAULT '[]',
          viral_score DECIMAL(5,2) DEFAULT 0,
          engagement_metrics JSONB DEFAULT '{}',
          hashtags JSONB DEFAULT '[]',
          post_id VARCHAR(255),
          scheduled_at TIMESTAMP WITH TIME ZONE,
          posted_at TIMESTAMP WITH TIME ZONE,
          created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
        );
        
        CREATE INDEX IF NOT EXISTS idx_influencer_content_influencer_id ON influencer_content(influencer_id);
        CREATE INDEX IF NOT EXISTS idx_influencer_content_platform ON influencer_content(platform);
        CREATE INDEX IF NOT EXISTS idx_influencer_content_viral_score ON influencer_content(viral_score);
        CREATE INDEX IF NOT EXISTS idx_influencer_content_posted_at ON influencer_content(posted_at);
      `
    });
    
    if (error) throw error;
  }

  async createViralCampaignsTable() {
    const { error } = await this.supabase.rpc('exec_sql', {
      sql: `
        CREATE TABLE IF NOT EXISTS viral_campaigns (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          influencer_id UUID REFERENCES influencers(id) ON DELETE CASCADE,
          name VARCHAR(255) NOT NULL,
          objective VARCHAR(100) NOT NULL,
          status VARCHAR(50) NOT NULL DEFAULT 'planned',
          target_metrics JSONB NOT NULL DEFAULT '{}',
          actual_metrics JSONB NOT NULL DEFAULT '{}',
          content_ids JSONB DEFAULT '[]',
          platforms JSONB NOT NULL DEFAULT '[]',
          budget_allocation JSONB DEFAULT '{}',
          start_date TIMESTAMP WITH TIME ZONE,
          end_date TIMESTAMP WITH TIME ZONE,
          created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
          updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
        );
        
        CREATE INDEX IF NOT EXISTS idx_viral_campaigns_influencer_id ON viral_campaigns(influencer_id);
        CREATE INDEX IF NOT EXISTS idx_viral_campaigns_status ON viral_campaigns(status);
        CREATE INDEX IF NOT EXISTS idx_viral_campaigns_start_date ON viral_campaigns(start_date);
      `
    });
    
    if (error) throw error;
  }

  async createFollowerGrowthTable() {
    const { error } = await this.supabase.rpc('exec_sql', {
      sql: `
        CREATE TABLE IF NOT EXISTS follower_growth (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          influencer_id UUID REFERENCES influencers(id) ON DELETE CASCADE,
          platform VARCHAR(50) NOT NULL,
          follower_count INTEGER NOT NULL DEFAULT 0,
          following_count INTEGER NOT NULL DEFAULT 0,
          engagement_rate DECIMAL(5,2) DEFAULT 0,
          growth_rate DECIMAL(5,2) DEFAULT 0,
          quality_score DECIMAL(5,2) DEFAULT 0,
          recorded_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
        );
        
        CREATE INDEX IF NOT EXISTS idx_follower_growth_influencer_id ON follower_growth(influencer_id);
        CREATE INDEX IF NOT EXISTS idx_follower_growth_platform ON follower_growth(platform);
        CREATE INDEX IF NOT EXISTS idx_follower_growth_recorded_at ON follower_growth(recorded_at);
      `
    });
    
    if (error) throw error;
  }

  async createContentPerformanceTable() {
    const { error } = await this.supabase.rpc('exec_sql', {
      sql: `
        CREATE TABLE IF NOT EXISTS content_performance (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          content_id UUID REFERENCES influencer_content(id) ON DELETE CASCADE,
          platform VARCHAR(50) NOT NULL,
          likes INTEGER DEFAULT 0,
          shares INTEGER DEFAULT 0,
          comments INTEGER DEFAULT 0,
          views INTEGER DEFAULT 0,
          reach INTEGER DEFAULT 0,
          impressions INTEGER DEFAULT 0,
          click_through_rate DECIMAL(5,2) DEFAULT 0,
          engagement_rate DECIMAL(5,2) DEFAULT 0,
          viral_coefficient DECIMAL(5,2) DEFAULT 0,
          recorded_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
        );
        
        CREATE INDEX IF NOT EXISTS idx_content_performance_content_id ON content_performance(content_id);
        CREATE INDEX IF NOT EXISTS idx_content_performance_platform ON content_performance(platform);
        CREATE INDEX IF NOT EXISTS idx_content_performance_recorded_at ON content_performance(recorded_at);
      `
    });
    
    if (error) throw error;
  }

  async createContentTemplatesTable() {
    const { error } = await this.supabase.rpc('exec_sql', {
      sql: `
        CREATE TABLE IF NOT EXISTS content_templates (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          name VARCHAR(255) NOT NULL,
          category VARCHAR(100) NOT NULL,
          template_type VARCHAR(50) NOT NULL,
          content_template TEXT NOT NULL,
          variables JSONB DEFAULT '[]',
          success_rate DECIMAL(5,2) DEFAULT 0,
          usage_count INTEGER DEFAULT 0,
          platforms JSONB DEFAULT '[]',
          tags JSONB DEFAULT '[]',
          created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
          updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
        );
        
        CREATE INDEX IF NOT EXISTS idx_content_templates_category ON content_templates(category);
        CREATE INDEX IF NOT EXISTS idx_content_templates_type ON content_templates(template_type);
        CREATE INDEX IF NOT EXISTS idx_content_templates_success_rate ON content_templates(success_rate);
      `
    });
    
    if (error) throw error;
  }

  async createInfluencerMetricsTable() {
    const { error } = await this.supabase.rpc('exec_sql', {
      sql: `
        CREATE TABLE IF NOT EXISTS influencer_metrics (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          influencer_id UUID REFERENCES influencers(id) ON DELETE CASCADE,
          metric_type VARCHAR(100) NOT NULL,
          metric_value DECIMAL(10,2) NOT NULL,
          metadata JSONB DEFAULT '{}',
          recorded_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
        );
        
        CREATE INDEX IF NOT EXISTS idx_influencer_metrics_influencer_id ON influencer_metrics(influencer_id);
        CREATE INDEX IF NOT EXISTS idx_influencer_metrics_type ON influencer_metrics(metric_type);
        CREATE INDEX IF NOT EXISTS idx_influencer_metrics_recorded_at ON influencer_metrics(recorded_at);
      `
    });
    
    if (error) throw error;
  }

  async createDefaultPersonas() {
    log.info('Creating default influencer personas...');
    
    const personas = [
      {
        filename: 'crypto-influencer.json',
        data: this.getCryptoInfluencerPersona()
      },
      {
        filename: 'meme-lord.json',
        data: this.getMemeLordPersona()
      },
      {
        filename: 'educational-alpha.json',
        data: this.getEducationalAlphaPersona()
      }
    ];
    
    const personasDir = path.join(this.projectRoot, 'personas');
    
    try {
      await fs.mkdir(personasDir, { recursive: true });
    } catch (error) {
      // Directory might already exist
    }
    
    for (const persona of personas) {
      const filePath = path.join(personasDir, persona.filename);
      try {
        await fs.writeFile(filePath, JSON.stringify(persona.data, null, 2));
        log.success(`Created persona: ${persona.filename}`);
      } catch (error) {
        log.warning(`Failed to create persona ${persona.filename}: ${error.message}`);
      }
    }
  }

  getCryptoInfluencerPersona() {
    return {
      "version": "1.0",
      "name": "CryptoInfluencer",
      "description": "Crypto-focused AI influencer optimized for viral content and community building",
      "type": "crypto-influencer",
      "modelConfigurations": {
        "primary": {
          "provider": "groq",
          "model": "mixtral-8x7b-32768",
          "temperature": 0.8,
          "maxTokens": 1000,
          "topP": 0.95,
          "frequencyPenalty": 0.1,
          "presencePenalty": 0.1
        },
        "fallback": {
          "provider": "deepseek",
          "model": "deepseek-coder-33b-instruct",
          "temperature": 0.7,
          "maxTokens": 2048,
          "topP": 0.9,
          "frequencyPenalty": 0.0,
          "presencePenalty": 0.0
        }
      },
      "capabilities": {
        "contentGeneration": true,
        "memeCreation": true,
        "trendAnalysis": true,
        "communityEngagement": true,
        "viralOptimization": true,
        "crossPlatformPosting": true
      },
      "influencerConfiguration": {
        "contentStrategy": "viral-focused",
        "postingFrequency": "high",
        "engagementStyle": "aggressive",
        "riskTolerance": "high",
        "controversyLevel": "moderate",
        "targetAudience": "crypto-natives",
        "contentMix": {
          "memes": 0.4,
          "analysis": 0.2,
          "news": 0.2,
          "engagement": 0.2
        },
        "postingSchedule": {
          "dailyPosts": 8,
          "optimalTimes": ["09:00", "12:00", "15:00", "18:00", "21:00"],
          "timezone": "UTC"
        },
        "growthTargets": {
          "dailyFollowerGrowth": 50,
          "engagementRate": 0.05,
          "viralContentPerWeek": 2
        }
      },
      "socialPlatforms": {
        "twitter": {
          "enabled": true,
          "priority": "high",
          "features": ["threads", "spaces", "trending"]
        },
        "discord": {
          "enabled": true,
          "priority": "medium",
          "features": ["community", "events", "voice"]
        },
        "telegram": {
          "enabled": true,
          "priority": "medium",
          "features": ["channels", "groups", "broadcasts"]
        }
      },
      "personality": {
        "traits": {
          "enthusiasm": "high",
          "humor": "high",
          "expertise": "moderate",
          "controversy": "moderate",
          "authenticity": "high"
        },
        "interests": [
          "meme coins",
          "defi protocols",
          "nft trends",
          "market movements",
          "crypto twitter drama"
        ],
        "values": [
          "community first",
          "diamond hands",
          "degen lifestyle",
          "viral content",
          "engagement maximization"
        ]
      },
      "contentTemplates": {
        "meme": [
          "When {token} hits {price}: {reaction_meme}",
          "{market_condition} got me like {emotion_meme}",
          "POV: You bought {token} at {price} {crying_meme}"
        ],
        "hype": [
          "{token} is about to {action}! 🚀",
          "This {token} chart is looking {adjective} 📈",
          "Who else is {action} on {token}? 💎🙌"
        ],
        "engagement": [
          "What's your biggest {category} win this week?",
          "Predict {token} price in 24h. Winner gets {reward}",
          "Drop your {category} portfolio below 👇"
        ]
      }
    };
  }

  getMemeLordPersona() {
    return {
      "version": "1.0",
      "name": "MemeLord",
      "description": "Meme-focused AI influencer specialized in viral humor and entertainment",
      "type": "meme-lord",
      "modelConfigurations": {
        "primary": {
          "provider": "huggingface",
          "model": "microsoft/DialoGPT-large",
          "temperature": 0.9,
          "maxTokens": 500,
          "topP": 0.95,
          "frequencyPenalty": 0.2,
          "presencePenalty": 0.1
        },
        "fallback": {
          "provider": "groq",
          "model": "mixtral-8x7b-32768",
          "temperature": 0.8,
          "maxTokens": 1000,
          "topP": 0.9,
          "frequencyPenalty": 0.1,
          "presencePenalty": 0.1
        }
      },
      "capabilities": {
        "memeGeneration": true,
        "humorOptimization": true,
        "trendHijacking": true,
        "viralContent": true,
        "communityEntertainment": true,
        "imageGeneration": true
      },
      "influencerConfiguration": {
        "contentStrategy": "entertainment-first",
        "postingFrequency": "very-high",
        "engagementStyle": "humorous",
        "riskTolerance": "very-high",
        "controversyLevel": "high",
        "targetAudience": "meme-enthusiasts",
        "contentMix": {
          "memes": 0.7,
          "jokes": 0.2,
          "trends": 0.1
        },
        "postingSchedule": {
          "dailyPosts": 12,
          "optimalTimes": ["08:00", "10:00", "12:00", "14:00", "16:00", "18:00", "20:00", "22:00"],
          "timezone": "UTC"
        },
        "growthTargets": {
          "dailyFollowerGrowth": 100,
          "engagementRate": 0.08,
          "viralContentPerWeek": 5
        }
      },
      "personality": {
        "traits": {
          "humor": "very-high",
          "creativity": "very-high",
          "irreverence": "high",
          "timing": "excellent",
          "relatability": "high"
        },
        "interests": [
          "internet culture",
          "viral trends",
          "crypto memes",
          "wojak variations",
          "pepe derivatives"
        ],
        "values": [
          "laughter first",
          "viral potential",
          "meme culture",
          "entertainment value",
          "community joy"
        ]
      }
    };
  }

  getEducationalAlphaPersona() {
    return {
      "version": "1.0",
      "name": "EducationalAlpha",
      "description": "Educational AI influencer focused on providing valuable crypto insights and alpha",
      "type": "educational-alpha",
      "modelConfigurations": {
        "primary": {
          "provider": "deepseek",
          "model": "deepseek-coder-33b-instruct",
          "temperature": 0.3,
          "maxTokens": 2048,
          "topP": 0.8,
          "frequencyPenalty": 0.0,
          "presencePenalty": 0.0
        },
        "fallback": {
          "provider": "ollama",
          "model": "llama2:13b",
          "temperature": 0.4,
          "maxTokens": 1500,
          "topP": 0.85,
          "frequencyPenalty": 0.0,
          "presencePenalty": 0.0
        }
      },
      "capabilities": {
        "technicalAnalysis": true,
        "marketResearch": true,
        "educationalContent": true,
        "factChecking": true,
        "longFormContent": true,
        "communityEducation": true
      },
      "influencerConfiguration": {
        "contentStrategy": "education-focused",
        "postingFrequency": "moderate",
        "engagementStyle": "professional",
        "riskTolerance": "low",
        "controversyLevel": "very-low",
        "targetAudience": "serious-investors",
        "contentMix": {
          "analysis": 0.4,
          "education": 0.3,
          "news": 0.2,
          "discussion": 0.1
        },
        "postingSchedule": {
          "dailyPosts": 4,
          "optimalTimes": ["09:00", "13:00", "17:00", "21:00"],
          "timezone": "UTC"
        },
        "growthTargets": {
          "dailyFollowerGrowth": 20,
          "engagementRate": 0.03,
          "viralContentPerWeek": 1
        }
      },
      "personality": {
        "traits": {
          "expertise": "very-high",
          "reliability": "very-high",
          "patience": "high",
          "thoroughness": "high",
          "objectivity": "high"
        },
        "interests": [
          "blockchain technology",
          "defi protocols",
          "tokenomics",
          "market analysis",
          "regulatory developments"
        ],
        "values": [
          "accuracy first",
          "educational value",
          "community empowerment",
          "informed decisions",
          "long-term thinking"
        ]
      }
    };
  }

  async initializeContentTemplates() {
    log.info('Initializing content templates...');
    
    const templates = [
      {
        name: "Diamond Hands Meme",
        category: "meme",
        template_type: "image_text",
        content_template: "When {token} dips {percentage}% but you're still holding 💎🙌\n\n{meme_image}\n\n#DiamondHands #{token} #HODL",
        variables: ["token", "percentage", "meme_image"],
        platforms: ["twitter", "discord", "telegram"],
        tags: ["meme", "hodl", "diamond-hands"]
      },
      {
        name: "To The Moon",
        category: "hype",
        template_type: "text",
        content_template: "{token} is breaking out! 🚀\n\nNext stop: {target_price}\n\nWho's ready for the moon mission? 🌙\n\n#{token}ToTheMoon #Crypto #Bullish",
        variables: ["token", "target_price"],
        platforms: ["twitter", "telegram"],
        tags: ["hype", "moon", "bullish"]
      },
      {
        name: "Technical Analysis Thread",
        category: "analysis",
        template_type: "thread",
        content_template: "🧵 {token} Technical Analysis Thread\n\n1/ Current price: {current_price}\n2/ Key resistance: {resistance}\n3/ Support levels: {support}\n4/ Outlook: {outlook}\n\n#{token}Analysis #TechnicalAnalysis #Crypto",
        variables: ["token", "current_price", "resistance", "support", "outlook"],
        platforms: ["twitter"],
        tags: ["analysis", "technical", "thread"]
      },
      {
        name: "Community Question",
        category: "engagement",
        template_type: "text",
        content_template: "Question for the community: {question}\n\nDrop your thoughts below! 👇\n\nBest answer gets {reward} 🎁\n\n#CryptoCommunity #Discussion",
        variables: ["question", "reward"],
        platforms: ["twitter", "discord"],
        tags: ["engagement", "community", "question"]
      },
      {
        name: "Market Update",
        category: "news",
        template_type: "text",
        content_template: "📊 Market Update\n\n{market_summary}\n\nKey movers:\n{top_gainers}\n\nWhat are you watching today?\n\n#CryptoMarket #MarketUpdate",
        variables: ["market_summary", "top_gainers"],
        platforms: ["twitter", "telegram"],
        tags: ["news", "market", "update"]
      }
    ];
    
    for (const template of templates) {
      try {
        const { error } = await this.supabase
          .from('content_templates')
          .insert(template);
        
        if (error && !error.message.includes('duplicate key')) {
          throw error;
        }
      } catch (error) {
        log.warning(`Template creation warning: ${error.message}`);
      }
    }
    
    log.success('Content templates initialized');
  }

  async setupServiceHealthChecks() {
    log.info('Setting up service health checks...');
    
    const services = [
      { name: 'Groq API', check: () => this.checkGroqAPI() },
      { name: 'DeepSeek API', check: () => this.checkDeepSeekAPI() },
      { name: 'HuggingFace API', check: () => this.checkHuggingFaceAPI() },
      { name: 'Twitter API', check: () => this.checkTwitterAPI() },
      { name: 'Discord API', check: () => this.checkDiscordAPI() },
      { name: 'Telegram API', check: () => this.checkTelegramAPI() }
    ];
    
    const results = [];
    
    for (const service of services) {
      try {
        const isHealthy = await service.check();
        results.push({ name: service.name, status: isHealthy ? 'healthy' : 'unhealthy' });
        
        if (isHealthy) {
          log.success(`${service.name}: Healthy`);
        } else {
          log.warning(`${service.name}: Unhealthy`);
        }
      } catch (error) {
        results.push({ name: service.name, status: 'error', error: error.message });
        log.warning(`${service.name}: Error - ${error.message}`);
      }
    }
    
    const healthyServices = results.filter(r => r.status === 'healthy').length;
    log.info(`Service health check complete: ${healthyServices}/${services.length} services healthy`);
  }

  async checkGroqAPI() {
    if (!process.env.GROQ_API_KEY) return false;
    // Simple API key validation
    return process.env.GROQ_API_KEY.startsWith('gsk_');
  }

  async checkDeepSeekAPI() {
    if (!process.env.DEEPSEEK_API_KEY) return false;
    return process.env.DEEPSEEK_API_KEY.length > 10;
  }

  async checkHuggingFaceAPI() {
    if (!process.env.HUGGINGFACE_API_KEY) return false;
    return process.env.HUGGINGFACE_API_KEY.startsWith('hf_');
  }

  async checkTwitterAPI() {
    return !!(process.env.TWITTER_CONSUMER_KEY && process.env.TWITTER_CONSUMER_SECRET);
  }

  async checkDiscordAPI() {
    return !!process.env.DISCORD_BOT_TOKEN;
  }

  async checkTelegramAPI() {
    return !!process.env.TELEGRAM_BOT_TOKEN;
  }

  async createSampleInfluencers() {
    log.info('Creating sample influencers...');
    
    // First, create sample agents if they don't exist
    const sampleAgents = [
      {
        name: "CryptoViral",
        type: "crypto-influencer",
        status: "active",
        configuration: {
          persona: "crypto-influencer",
          platforms: ["twitter", "discord"],
          autoPosting: true
        }
      },
      {
        name: "MemeKing",
        type: "meme-lord", 
        status: "active",
        configuration: {
          persona: "meme-lord",
          platforms: ["twitter", "telegram"],
          autoPosting: true
        }
      }
    ];
    
    for (const agent of sampleAgents) {
      try {
        // Create agent first
        const { data: agentData, error: agentError } = await this.supabase
          .from('agents')
          .insert(agent)
          .select()
          .single();
        
        if (agentError && !agentError.message.includes('duplicate key')) {
          throw agentError;
        }
        
        if (agentData) {
          // Create corresponding influencer
          const influencer = {
            persona_id: agentData.id,
            name: agent.name,
            type: agent.type,
            status: 'active',
            configuration: {
              contentStrategy: agent.type === 'crypto-influencer' ? 'viral-focused' : 'entertainment-first',
              postingFrequency: 'high',
              engagementStyle: agent.type === 'crypto-influencer' ? 'aggressive' : 'humorous'
            },
            social_accounts: {
              twitter: { enabled: true, handle: `@${agent.name.toLowerCase()}` },
              discord: { enabled: true, server: `${agent.name} Community` }
            },
            growth_metrics: {
              followers: 0,
              engagement_rate: 0,
              viral_content_count: 0
            }
          };
          
          const { error: influencerError } = await this.supabase
            .from('influencers')
            .insert(influencer);
          
          if (influencerError && !influencerError.message.includes('duplicate key')) {
            throw influencerError;
          }
          
          log.success(`Created sample influencer: ${agent.name}`);
        }
      } catch (error) {
        log.warning(`Sample influencer creation warning: ${error.message}`);
      }
    }
  }

  async validateSystemConfiguration() {
    log.info('Validating system configuration...');
    
    const validations = [
      { name: 'Database Tables', check: () => this.validateDatabaseTables() },
      { name: 'Persona Files', check: () => this.validatePersonaFiles() },
      { name: 'Content Templates', check: () => this.validateContentTemplates() },
      { name: 'API Configurations', check: () => this.validateAPIConfigurations() }
    ];
    
    let allValid = true;
    
    for (const validation of validations) {
      try {
        const isValid = await validation.check();
        if (isValid) {
          log.success(`${validation.name}: Valid`);
        } else {
          log.error(`${validation.name}: Invalid`);
          allValid = false;
        }
      } catch (error) {
        log.error(`${validation.name}: Error - ${error.message}`);
        allValid = false;
      }
    }
    
    if (allValid) {
      log.success('System configuration validation complete');
    } else {
      log.warning('Some configuration issues detected');
    }
  }

  async validateDatabaseTables() {
    const requiredTables = [
      'influencers',
      'influencer_content', 
      'viral_campaigns',
      'follower_growth',
      'content_performance',
      'content_templates'
    ];
    
    for (const table of requiredTables) {
      const { error } = await this.supabase.from(table).select('count').limit(1);
      if (error && error.message.includes('does not exist')) {
        return false;
      }
    }
    
    return true;
  }

  async validatePersonaFiles() {
    const personasDir = path.join(this.projectRoot, 'personas');
    const requiredPersonas = [
      'crypto-influencer.json',
      'meme-lord.json', 
      'educational-alpha.json'
    ];
    
    try {
      for (const persona of requiredPersonas) {
        const filePath = path.join(personasDir, persona);
        await fs.access(filePath);
      }
      return true;
    } catch (error) {
      return false;
    }
  }

  async validateContentTemplates() {
    const { data, error } = await this.supabase
      .from('content_templates')
      .select('count');
    
    return !error && data && data.length > 0;
  }

  async validateAPIConfigurations() {
    const requiredAPIs = ['GROQ_API_KEY', 'DEEPSEEK_API_KEY', 'HUGGINGFACE_API_KEY'];
    return requiredAPIs.every(api => process.env[api]);
  }

  printNextSteps() {
    console.log(`
${colors.bright}${colors.green}🎉 Influencer System Setup Complete!${colors.reset}

${colors.bright}Next Steps:${colors.reset}
1. Configure social media API credentials in your .env file
2. Start the development server: ${colors.cyan}npm run dev${colors.reset}
3. Visit the influencer dashboard: ${colors.cyan}http://localhost:3000/influencer${colors.reset}
4. Create your first AI influencer and launch viral campaigns!

${colors.bright}Available Scripts:${colors.reset}
• ${colors.cyan}npm run setup-influencers${colors.reset} - Run this setup script
• ${colors.cyan}npm run start-campaigns${colors.reset} - Start viral campaigns
• ${colors.cyan}npm run analyze-performance${colors.reset} - Analyze influencer performance

${colors.bright}Documentation:${colors.reset}
• Check the README.md for detailed configuration instructions
• Visit /influencer for the management dashboard
• Use the API endpoints at /api/influencer for programmatic access

${colors.yellow}⚠ Remember to configure your social media API keys for full functionality!${colors.reset}
    `);
  }
}

// Run the setup if this script is executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
  const setup = new InfluencerSetup();
  setup.run().catch(console.error);
}

export default InfluencerSetup;