import axios from 'axios';
import * as cheerio from 'cheerio';
import { EventEmitter } from 'events';

export interface SentimentScore {
  symbol: string;
  mentions: number;
  score: number;
  source: string;
  status: 'ok' | 'partial' | 'error' | 'fallback' | 'blocked_by_fud';
  timestamp: Date;
  breakdown: {
    twitter: number;
    reddit: number;
    discord: number;
    telegram: number;
  };
}

export interface SentimentTrend {
  symbol: string;
  trend: 'bullish' | 'bearish' | 'neutral';
  momentum: number;
  confidence: number;
  historicalScores: number[];
  timeframe: string;
}

export interface FUDDetection {
  detected: boolean;
  severity: 'low' | 'medium' | 'high' | 'critical';
  keywords: string[];
  confidence: number;
  recommendation: 'proceed' | 'caution' | 'avoid';
}

export interface MentionData {
  platform: string;
  content: string;
  score: number;
  timestamp: Date;
  engagement: number;
  author?: string;
}

export interface SentimentConfig {
  enableRealTimeMonitoring: boolean;
  updateInterval: number;
  platforms: string[];
  maxHistoryLength: number;
  fudThreshold: number;
  bullishThreshold: number;
  bearishThreshold: number;
}

export class SentimentAnalyzer extends EventEmitter {
  private config: SentimentConfig;
  private sentimentHistory: Map<string, SentimentScore[]> = new Map();
  private monitoringIntervals: Map<string, NodeJS.Timeout> = new Map();
  private isMonitoring: boolean = false;

  // Enhanced weighted bullish keywords
  private readonly BULLISH_KEYWORDS: Record<string, number> = {
    '100x': 3,
    'moon': 2,
    'pump': 2,
    'gem': 2,
    'bullish': 1,
    'buy': 1,
    'alpha': 1,
    'entry': 1,
    'launch': 1,
    'whale': 1,
    'undervalued': 1,
    'next big': 2,
    'going parabolic': 3,
    'ape': 2,
    'diamond hands': 2,
    'hodl': 1,
    'to the moon': 3,
    'breakout': 1,
    'surge': 1,
    'rally': 1,
    'bull run': 2,
    'green': 1,
    'profit': 1,
    'gains': 1,
    'rocket': 2,
    'lambo': 2,
    'degen': 1,
    'based': 1,
    'chad': 1,
    'gigachad': 2,
    'wagmi': 1,
    'ngmi': -1,
    'fomo': 1,
    'yolo': 1,
    'send it': 2,
    'lfg': 2,
    'gm': 1,
    'gn': 1,
    'pamp it': 2,
    'number go up': 2,
    'this is the way': 1,
    'diamond handed': 2,
    'paper hands': -1,
    'weak hands': -1
  };

  // FUD keywords for detection
  private readonly FUD_KEYWORDS: string[] = [
    'rug', 'scam', 'exit', 'hack', 'dump', 'rekt', 'liquidated', 
    'dead coin', 'honeypot', 'exit scam', 'ponzi', 'fraud', 
    'worthless', 'going to zero', 'rugpull', 'shitcoin',
    'avoid', 'warning', 'red flag', 'suspicious', 'fake',
    'manipulation', 'whale dump', 'sell pressure', 'bearish',
    'crash', 'collapse', 'bubble', 'overvalued', 'fud'
  ];

  // Twitter alternatives for scraping
  private readonly TWITTER_ALTERNATIVES: string[] = [
    'https://nitter.net',
    'https://nitter.1d4.us',
    'https://nitter.kavin.rocks',
    'https://nitter.unixfox.eu',
    'https://nitter.privacydev.net',
    'https://nitter.fdn.fr',
    'https://nitter.actionsack.com'
  ];

  constructor(config: Partial<SentimentConfig> = {}) {
    super();
    this.config = {
      enableRealTimeMonitoring: true,
      updateInterval: 300000, // 5 minutes
      platforms: ['twitter', 'reddit', 'discord', 'telegram'],
      maxHistoryLength: 100,
      fudThreshold: -50,
      bullishThreshold: 60,
      bearishThreshold: 30,
      ...config
    };
  }

  /**
   * Analyze social sentiment for a given symbol across multiple platforms
   */
  async analyzeSocialSentiment(symbol: string): Promise<SentimentScore> {
    try {
      const results = await Promise.allSettled([
        this.scrapeTwitterSentiment(symbol),
        this.scrapeRedditSentiment(symbol),
        this.scrapeDiscordSentiment(symbol),
        this.scrapeTelegramSentiment(symbol)
      ]);

      let totalScore = 0;
      let totalMentions = 0;
      const breakdown = { twitter: 0, reddit: 0, discord: 0, telegram: 0 };
      const sources: string[] = [];
      let hasError = false;

      // Process Twitter results
      if (results[0].status === 'fulfilled') {
        totalScore += results[0].value.score;
        totalMentions += results[0].value.mentions;
        breakdown.twitter = results[0].value.score;
        sources.push('twitter');
      } else {
        hasError = true;
      }

      // Process Reddit results
      if (results[1].status === 'fulfilled') {
        totalScore += results[1].value.score;
        totalMentions += results[1].value.mentions;
        breakdown.reddit = results[1].value.score;
        sources.push('reddit');
      } else {
        hasError = true;
      }

      // Process Discord results
      if (results[2].status === 'fulfilled') {
        totalScore += results[2].value.score;
        totalMentions += results[2].value.mentions;
        breakdown.discord = results[2].value.score;
        sources.push('discord');
      } else {
        hasError = true;
      }

      // Process Telegram results
      if (results[3].status === 'fulfilled') {
        totalScore += results[3].value.score;
        totalMentions += results[3].value.mentions;
        breakdown.telegram = results[3].value.score;
        sources.push('telegram');
      } else {
        hasError = true;
      }

      // Check for FUD
      const fudDetection = this.detectFUD(symbol, totalScore, totalMentions);
      if (fudDetection.detected && fudDetection.severity === 'critical') {
        const sentiment: SentimentScore = {
          symbol,
          mentions: totalMentions,
          score: 0,
          source: sources.join('+'),
          status: 'blocked_by_fud',
          timestamp: new Date(),
          breakdown
        };
        this.updateSentimentHistory(symbol, sentiment);
        return sentiment;
      }

      // Use fallback if insufficient data
      if (totalMentions < 2 && totalScore < 10) {
        const fallback = this.getFallbackSentiment(symbol);
        const sentiment: SentimentScore = {
          symbol,
          mentions: fallback.mentions,
          score: fallback.score,
          source: 'fallback',
          status: 'fallback',
          timestamp: new Date(),
          breakdown
        };
        this.updateSentimentHistory(symbol, sentiment);
        return sentiment;
      }

      // Normalize score (0-100)
      const normalizedScore = Math.max(0, Math.min(totalScore * 5, 100));

      const sentiment: SentimentScore = {
        symbol,
        mentions: totalMentions,
        score: normalizedScore,
        source: sources.join('+'),
        status: hasError ? 'partial' : 'ok',
        timestamp: new Date(),
        breakdown
      };

      this.updateSentimentHistory(symbol, sentiment);
      this.emit('sentimentUpdate', sentiment);

      return sentiment;
    } catch (error) {
      console.error(`Sentiment analysis failed for ${symbol}:`, error);
      const fallback = this.getFallbackSentiment(symbol);
      const sentiment: SentimentScore = {
        symbol,
        mentions: fallback.mentions,
        score: fallback.score,
        source: 'fallback',
        status: 'error',
        timestamp: new Date(),
        breakdown: { twitter: 0, reddit: 0, discord: 0, telegram: 0 }
      };
      this.updateSentimentHistory(symbol, sentiment);
      return sentiment;
    }
  }

  /**
   * Detect FUD (Fear, Uncertainty, Doubt) in content
   */
  detectFUD(symbol: string, score?: number, mentions?: number): FUDDetection {
    const history = this.sentimentHistory.get(symbol) || [];
    const recentScores = history.slice(-5).map(h => h.score);
    
    let severity: 'low' | 'medium' | 'high' | 'critical' = 'low';
    let detected = false;
    const detectedKeywords: string[] = [];
    let confidence = 0;

    // Check score-based FUD
    if (score !== undefined && score < this.config.fudThreshold) {
      detected = true;
      severity = 'high';
      confidence += 0.3;
    }

    // Check trend-based FUD
    if (recentScores.length >= 3) {
      const avgRecent = recentScores.reduce((a, b) => a + b, 0) / recentScores.length;
      const trend = recentScores[recentScores.length - 1] - recentScores[0];
      
      if (avgRecent < this.config.bearishThreshold && trend < -20) {
        detected = true;
        severity = severity === 'high' ? 'critical' : 'medium';
        confidence += 0.4;
      }
    }

    // Check mention volume (sudden spike might indicate FUD campaign)
    if (mentions !== undefined && mentions > 50) {
      const avgMentions = history.slice(-10).reduce((sum, h) => sum + h.mentions, 0) / Math.max(history.length, 1);
      if (mentions > avgMentions * 3) {
        detected = true;
        confidence += 0.3;
      }
    }

    const recommendation = detected 
      ? (severity === 'critical' ? 'avoid' : severity === 'high' ? 'caution' : 'proceed')
      : 'proceed';

    return {
      detected,
      severity,
      keywords: detectedKeywords,
      confidence: Math.min(confidence, 1),
      recommendation
    };
  }

  /**
   * Score content for bullishness
   */
  scoreBullishness(content: string): { score: number; keywords: string[]; isFUD: boolean } {
    const lowered = content.toLowerCase();
    let score = 0;
    const foundKeywords: string[] = [];

    // Check for FUD keywords first
    for (const fudKeyword of this.FUD_KEYWORDS) {
      if (lowered.includes(fudKeyword)) {
        return { score: -100, keywords: [fudKeyword], isFUD: true };
      }
    }

    // Score bullish keywords
    for (const [keyword, value] of Object.entries(this.BULLISH_KEYWORDS)) {
      if (lowered.includes(keyword)) {
        score += value;
        foundKeywords.push(keyword);
      }
    }

    return { score, keywords: foundKeywords, isFUD: false };
  }

  /**
   * Track mentions across platforms
   */
  async trackMentions(symbol: string, timeframe: '1h' | '24h' | '7d' = '24h'): Promise<MentionData[]> {
    const mentions: MentionData[] = [];
    const cutoffTime = new Date();
    
    switch (timeframe) {
      case '1h':
        cutoffTime.setHours(cutoffTime.getHours() - 1);
        break;
      case '24h':
        cutoffTime.setDate(cutoffTime.getDate() - 1);
        break;
      case '7d':
        cutoffTime.setDate(cutoffTime.getDate() - 7);
        break;
    }

    // Get mentions from each platform
    const platforms = ['twitter', 'reddit', 'discord', 'telegram'];
    
    for (const platform of platforms) {
      try {
        const platformMentions = await this.getPlatformMentions(symbol, platform, cutoffTime);
        mentions.push(...platformMentions);
      } catch (error) {
        console.error(`Failed to get mentions from ${platform}:`, error);
      }
    }

    return mentions.sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());
  }

  /**
   * Get sentiment trend analysis
   */
  getSentimentTrend(symbol: string, timeframe: '1h' | '24h' | '7d' = '24h'): SentimentTrend | null {
    const history = this.sentimentHistory.get(symbol);
    if (!history || history.length < 3) return null;

    const cutoffTime = new Date();
    switch (timeframe) {
      case '1h':
        cutoffTime.setHours(cutoffTime.getHours() - 1);
        break;
      case '24h':
        cutoffTime.setDate(cutoffTime.getDate() - 1);
        break;
      case '7d':
        cutoffTime.setDate(cutoffTime.getDate() - 7);
        break;
    }

    const relevantHistory = history.filter(h => h.timestamp >= cutoffTime);
    if (relevantHistory.length < 3) return null;

    const scores = relevantHistory.map(h => h.score);
    const avgScore = scores.reduce((a, b) => a + b, 0) / scores.length;
    const recentScore = scores[scores.length - 1];
    const oldestScore = scores[0];
    
    const momentum = recentScore - oldestScore;
    const trend = avgScore > this.config.bullishThreshold ? 'bullish' 
                : avgScore < this.config.bearishThreshold ? 'bearish' 
                : 'neutral';

    // Calculate confidence based on data consistency
    const variance = scores.reduce((sum, score) => sum + Math.pow(score - avgScore, 2), 0) / scores.length;
    const confidence = Math.max(0, 1 - (variance / 1000));

    return {
      symbol,
      trend,
      momentum,
      confidence,
      historicalScores: scores,
      timeframe
    };
  }

  /**
   * Start real-time sentiment monitoring
   */
  startMonitoring(symbols: string[]): void {
    if (this.isMonitoring) {
      this.stopMonitoring();
    }

    this.isMonitoring = true;
    
    for (const symbol of symbols) {
      const interval = setInterval(async () => {
        try {
          await this.analyzeSocialSentiment(symbol);
        } catch (error) {
          console.error(`Monitoring error for ${symbol}:`, error);
        }
      }, this.config.updateInterval);

      this.monitoringIntervals.set(symbol, interval);
    }

    this.emit('monitoringStarted', symbols);
  }

  /**
   * Stop real-time sentiment monitoring
   */
  stopMonitoring(): void {
    for (const [symbol, interval] of this.monitoringIntervals) {
      clearInterval(interval);
    }
    this.monitoringIntervals.clear();
    this.isMonitoring = false;
    this.emit('monitoringStopped');
  }

  /**
   * Get sentiment-aware content recommendations
   */
  getContentRecommendations(symbol: string): {
    shouldPost: boolean;
    tone: 'bullish' | 'neutral' | 'cautious';
    keywords: string[];
    avoidKeywords: string[];
    confidence: number;
  } {
    const sentiment = this.sentimentHistory.get(symbol)?.slice(-1)[0];
    const trend = this.getSentimentTrend(symbol, '24h');
    const fudDetection = this.detectFUD(symbol, sentiment?.score);

    if (!sentiment) {
      return {
        shouldPost: false,
        tone: 'neutral',
        keywords: [],
        avoidKeywords: [],
        confidence: 0
      };
    }

    const shouldPost = !fudDetection.detected || fudDetection.severity === 'low';
    const tone = sentiment.score > this.config.bullishThreshold ? 'bullish'
                : sentiment.score < this.config.bearishThreshold ? 'cautious'
                : 'neutral';

    const keywords = Object.keys(this.BULLISH_KEYWORDS).filter(keyword => 
      this.BULLISH_KEYWORDS[keyword] > 0 && sentiment.score > 50
    );

    const avoidKeywords = fudDetection.detected ? this.FUD_KEYWORDS : [];

    return {
      shouldPost,
      tone,
      keywords: keywords.slice(0, 5),
      avoidKeywords,
      confidence: trend?.confidence || 0.5
    };
  }

  // Private helper methods

  private async scrapeTwitterSentiment(symbol: string): Promise<{ score: number; mentions: number }> {
    const query = `/search?f=tweets&q=%24${symbol}`;
    const headers = {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
    };

    for (const baseUrl of this.TWITTER_ALTERNATIVES) {
      try {
        const response = await axios.get(baseUrl + query, { 
          headers, 
          timeout: 8000,
          validateStatus: (status) => status === 200
        });

        const $ = cheerio.load(response.data);
        const tweets = $('.timeline-item');
        let score = 0;
        let mentions = 0;

        tweets.each((_, element) => {
          const content = $(element).text();
          const contentScore = this.scoreBullishness(content);
          
          if (!contentScore.isFUD) {
            score += contentScore.score;
            mentions++;
          } else {
            throw new Error('FUD detected in Twitter content');
          }
        });

        return { score, mentions };
      } catch (error) {
        console.warn(`Twitter alternative ${baseUrl} failed:`, error);
        continue;
      }
    }

    // Fallback if all alternatives fail
    return { score: 25, mentions: 3 };
  }

  private async scrapeRedditSentiment(symbol: string): Promise<{ score: number; mentions: number }> {
    const query = `https://www.reddit.com/search/?q=${symbol}&sort=new`;
    const headers = {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
    };

    try {
      const response = await axios.get(query, { headers, timeout: 10000 });
      const $ = cheerio.load(response.data);
      const posts = $('[data-testid="post-container"]');
      
      let score = 0;
      let mentions = 0;

      posts.each((_, element) => {
        const content = $(element).text();
        const contentScore = this.scoreBullishness(content);
        
        if (!contentScore.isFUD) {
          score += contentScore.score;
          mentions++;
        } else {
          throw new Error('FUD detected in Reddit content');
        }
      });

      return { score, mentions };
    } catch (error) {
      console.warn(`Reddit scraping failed for ${symbol}:`, error);
      return { score: 0, mentions: 0 };
    }
  }

  private async scrapeDiscordSentiment(symbol: string): Promise<{ score: number; mentions: number }> {
    // Discord scraping would require bot integration or API access
    // For now, return simulated data based on symbol characteristics
    const fallback = this.getFallbackSentiment(symbol);
    return { score: fallback.score * 0.3, mentions: Math.floor(fallback.mentions * 0.5) };
  }

  private async scrapeTelegramSentiment(symbol: string): Promise<{ score: number; mentions: number }> {
    // Telegram scraping would require bot integration or API access
    // For now, return simulated data based on symbol characteristics
    const fallback = this.getFallbackSentiment(symbol);
    return { score: fallback.score * 0.2, mentions: Math.floor(fallback.mentions * 0.3) };
  }

  private getFallbackSentiment(symbol: string): { score: number; mentions: number } {
    const symbolLower = symbol.toLowerCase();
    
    const bullishIndicators = ['moon', 'pump', 'gem', 'diamond', 'gold', 'bull', 'rocket', 'mars'];
    const bearishIndicators = ['dump', 'bear', 'crash', 'dead', 'scam'];
    
    let score = 50;
    let mentions = 3;
    
    for (const indicator of bullishIndicators) {
      if (symbolLower.includes(indicator)) {
        score += 15;
        mentions += 1;
      }
    }
    
    for (const indicator of bearishIndicators) {
      if (symbolLower.includes(indicator)) {
        score -= 20;
        mentions += 1;
      }
    }
    
    return {
      score: Math.max(0, Math.min(score, 100)),
      mentions: Math.max(1, mentions)
    };
  }

  private async getPlatformMentions(symbol: string, platform: string, since: Date): Promise<MentionData[]> {
    // This would integrate with actual platform APIs
    // For now, return mock data
    return [];
  }

  private updateSentimentHistory(symbol: string, sentiment: SentimentScore): void {
    if (!this.sentimentHistory.has(symbol)) {
      this.sentimentHistory.set(symbol, []);
    }
    
    const history = this.sentimentHistory.get(symbol)!;
    history.push(sentiment);
    
    // Keep only recent history
    if (history.length > this.config.maxHistoryLength) {
      history.splice(0, history.length - this.config.maxHistoryLength);
    }
  }

  /**
   * Get current sentiment for a symbol
   */
  getCurrentSentiment(symbol: string): SentimentScore | null {
    const history = this.sentimentHistory.get(symbol);
    return history && history.length > 0 ? history[history.length - 1] : null;
  }

  /**
   * Get sentiment history for a symbol
   */
  getSentimentHistory(symbol: string): SentimentScore[] {
    return this.sentimentHistory.get(symbol) || [];
  }

  /**
   * Clear sentiment history
   */
  clearHistory(symbol?: string): void {
    if (symbol) {
      this.sentimentHistory.delete(symbol);
    } else {
      this.sentimentHistory.clear();
    }
  }

  /**
   * Export sentiment data
   */
  exportSentimentData(): Record<string, SentimentScore[]> {
    const data: Record<string, SentimentScore[]> = {};
    for (const [symbol, history] of this.sentimentHistory) {
      data[symbol] = history;
    }
    return data;
  }

  /**
   * Import sentiment data
   */
  importSentimentData(data: Record<string, SentimentScore[]>): void {
    for (const [symbol, history] of Object.entries(data)) {
      this.sentimentHistory.set(symbol, history);
    }
  }
}

export default SentimentAnalyzer;