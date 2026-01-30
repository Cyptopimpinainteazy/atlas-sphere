import Groq from 'groq-sdk';
import { LLMProvider, LLMRequest, LLMResponse, MarketData, MarketAnalysis, ContentRequest, ContentResponse, LLMProviderCapability } from '../../types';

/**
 * Groq Provider - Optimized for fast inference and real-time tasks
 * Based on Groq's Mixtral-8x7B model
 */
export class GroqProvider implements LLMProvider {
  id = 'groq-provider';
  name = 'groq' as const;
  status: 'healthy' | 'degraded' | 'unavailable' = 'unavailable';
  last_health_check = new Date();
  capabilities: LLMProviderCapability[] = [
    'text_generation',
    'analysis',
    'sentiment'
  ];
  rate_limits = {
    requests_per_minute: 30, // Groq's rate limits
    tokens_per_minute: 6000
  };

  private groq: Groq;

  constructor() {
    this.groq = new Groq({
      apiKey: process.env.GROQ_API_KEY,
    });
  }

  /**
   * Generate text response using Groq's Mixtral model
   */
  async generateResponse(request: LLMRequest): Promise<LLMResponse> {
    try {
      const messages: Groq.Chat.ChatCompletionMessageParam[] = [];

      // Add context as system message if provided
      if (request.context) {
        messages.push({
          role: 'system',
          content: request.context
        });
      }

      // Add the main prompt
      messages.push({
        role: 'user',
        content: request.prompt
      });

      const completion = await this.groq.chat.completions.create({
        messages,
        model: 'mixtral-8x7b-32768', // Fast and capable model
        temperature: request.temperature || 0.7,
        max_tokens: Math.min(request.max_tokens || 1000, 32768),
        top_p: 1,
        stream: false,
        stop: null,
      });

      const choice = completion.choices[0];
      if (!choice?.message?.content) {
        throw new Error('No response generated');
      }

      return {
        content: choice.message.content,
        usage: {
          prompt_tokens: completion.usage?.prompt_tokens || 0,
          completion_tokens: completion.usage?.completion_tokens || 0,
          total_tokens: completion.usage?.total_tokens || 0
        },
        model: completion.model,
        provider: 'groq',
        finish_reason: choice.finish_reason || 'stop'
      };
    } catch (error) {
      console.error('Groq API request failed:', error);
      throw error;
    }
  }

  /**
   * Market analysis using Groq's speed for real-time insights
   */
  async analyzeMarket(data: MarketData): Promise<MarketAnalysis> {
    const prompt = `Quick market analysis for ${data.pair}:

Price: $${data.price} (${data.price_change_24h >= 0 ? '+' : ''}${data.price_change_24h}%)
Volume: $${data.volume_24h.toLocaleString()}

Provide concise analysis:
- Sentiment (bullish/bearish/neutral)
- Confidence (0-100)
- Reasoning (brief)
- Recommendation (buy/hold/sell)
- Risk (low/medium/high)

Format: JSON only.`;

    const response = await this.generateResponse({
      prompt,
      temperature: 0.4,
      max_tokens: 500
    });

    try {
      const analysis = JSON.parse(response.content);
      return {
        sentiment: analysis.sentiment || 'neutral',
        confidence: Math.min(100, Math.max(0, analysis.confidence || 70)), // Groq tends to be confident
        reasoning: analysis.reasoning || 'Real-time analysis complete',
        key_levels: { support: [], resistance: [] }, // Groq focuses on quick analysis
        recommendation: analysis.recommendation || 'hold',
        risk_level: analysis.risk_level || 'medium'
      };
    } catch (error) {
      console.error('Failed to parse Groq market analysis:', error);
      throw new Error('Unable to parse market analysis response');
    }
  }

  /**
   * Generate content using Groq's speed for social media posts
   */
  async generateContent(request: ContentRequest): Promise<ContentResponse> {
    const prompt = this.buildContentPrompt(request);

    const response = await this.generateResponse({
      prompt,
      temperature: request.type === 'tweet' ? 0.8 : 0.6, // Higher creativity for tweets
      max_tokens: this.getContentLength(request.length)
    });

    const hashtags = request.topic.toLowerCase().split(' ').slice(0, 3).map(word => `#${word}`);

    return {
      content: response.content,
      hashtags,
      created_at: new Date()
    };
  }

  /**
   * Build content generation prompt for Groq
   */
  private buildContentPrompt(request: ContentRequest): string {
    const basePrompt = `Create engaging ${request.type} about: ${request.topic}

Audience: ${request.audience}
Style: ${request.length}, conversational, engaging

${request.context ? `Context: ${request.context}` : ''}

${request.persona ? `Persona: ${request.persona.name} (${request.persona.personality.tone})` : ''}

Keep it concise and impactful.`;

    return basePrompt;
  }

  /**
   * Get appropriate token limit based on content length
   */
  private getContentLength(length: ContentRequest['length']): number {
    switch (length) {
      case 'short': return 100;
      case 'medium': return 300;
      case 'long': return 800;
      default: return 200;
    }
  }
}
