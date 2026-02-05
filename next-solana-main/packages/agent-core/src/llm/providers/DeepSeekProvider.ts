import { LLMProvider, LLMRequest, LLMResponse, MarketData, MarketAnalysis, ContentRequest, ContentResponse, LLMProviderCapability } from '../../types';

/**
 * DeepSeek Provider - Optimized for coding and complex analysis tasks
 * Based on DeepSeek's free tier API
 */
export class DeepSeekProvider implements LLMProvider {
  id = 'deepseek-provider';
  name = 'deepseek' as const;
  status: 'healthy' | 'degraded' | 'unavailable' = 'unavailable';
  last_health_check = new Date();
  capabilities: LLMProviderCapability[] = [
    'text_generation',
    'code_generation',
    'analysis'
  ];
  rate_limits = {
    requests_per_minute: 20, // DeepSeek free tier limits
    tokens_per_minute: 40000
  };

  private readonly apiUrl = 'https://api.deepseek.com/v1/chat/completions';
  private apiKey: string;

  constructor() {
    this.apiKey = process.env.DEEPSEEK_API_KEY || '';
  }

  /**
   * Generate text response using DeepSeek API
   */
  async generateResponse(request: LLMRequest): Promise<LLMResponse> {
    if (!this.apiKey) {
      throw new Error('DEEPSEEK_API_KEY environment variable not set');
    }

    try {
      const payload = this.buildRequestPayload(request);

      const response = await fetch(this.apiUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${this.apiKey}`
        },
        body: JSON.stringify(payload)
      });

      if (!response.ok) {
        throw new Error(`DeepSeek API error: ${response.status} ${response.statusText}`);
      }

      const data = await response.json();

      return {
        content: data.choices[0]?.message?.content || '',
        usage: {
          prompt_tokens: data.usage?.prompt_tokens || 0,
          completion_tokens: data.usage?.completion_tokens || 0,
          total_tokens: data.usage?.total_tokens || 0
        },
        model: data.model || 'deepseek/deepseek-coder',
        provider: 'deepseek',
        finish_reason: data.choices[0]?.finish_reason || 'stop'
      };
    } catch (error) {
      console.error('DeepSeek API request failed:', error);
      throw error;
    }
  }

  /**
   * Market analysis using DeepSeek's analytical capabilities
   */
  async analyzeMarket(data: MarketData): Promise<MarketAnalysis> {
    const prompt = `Analyze the following market data and provide insights:

Token: ${data.pair}
Current Price: $${data.price}
24h Volume: $${data.volume_24h.toLocaleString()}
24h Change: ${data.price_change_24h}%
${data.market_cap ? `Market Cap: $${data.market_cap.toLocaleString()}` : ''}

Please provide:
1. Market sentiment (bullish/bearish/neutral)
2. Confidence level (0-100)
3. Key reasoning behind your analysis
4. Support and resistance levels
5. Trading recommendation (buy/hold/sell)
6. Risk level (low/medium/high)

Respond in JSON format.`;

    const response = await this.generateResponse({
      prompt,
      temperature: 0.3,
      max_tokens: 1000
    });

    try {
      const analysis = JSON.parse(response.content);
      return {
        sentiment: analysis.sentiment || 'neutral',
        confidence: Math.min(100, Math.max(0, analysis.confidence || 50)),
        reasoning: analysis.reasoning || 'Analysis unavailable',
        key_levels: analysis.key_levels || { support: [], resistance: [] },
        recommendation: analysis.recommendation || 'hold',
        risk_level: analysis.risk_level || 'medium'
      };
    } catch (error) {
      console.error('Failed to parse DeepSeek market analysis:', error);
      throw new Error('Unable to parse market analysis response');
    }
  }

  /**
   * Generate content optimized for DeepSeek's strengths
   */
  async generateContent(request: ContentRequest): Promise<ContentResponse> {
    const prompt = this.buildContentPrompt(request);

    const response = await this.generateResponse({
      prompt,
      temperature: request.type === 'tweet' ? 0.7 : 0.5, // More creative for tweets
      max_tokens: this.getContentLength(request.length)
    });

    const hashtags = request.topic.toLowerCase().split(' ').map(word => `#${word}`);
    if (request.type === 'tweet') {
      hashtags.length = Math.min(3, hashtags.length); // Limit hashtags for tweets
    }

    return {
      content: response.content,
      hashtags,
      created_at: new Date()
    };
  }

  /**
   * Build request payload for DeepSeek API
   */
  private buildRequestPayload(request: LLMRequest): Record<string, unknown> {
    const messages = [];

    // Add context/prompt as system message if provided
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

    return {
      model: 'deepseek/deepseek-coder', // Most capable model for analysis
      messages,
      temperature: request.temperature || 0.7,
      max_tokens: Math.min(request.max_tokens || 1000, 4000), // Cap at 4000
      top_p: 0.9,
      frequency_penalty: 0.1,
      presence_penalty: 0.1,
      stream: false
    };
  }

  /**
   * Build content generation prompt based on request type
   */
  private buildContentPrompt(request: ContentRequest): string {
    const basePrompt = `Create ${request.type} content about: ${request.topic}

Context: ${request.context || 'General discussion'}
Target audience: ${request.audience}

Length: ${request.length}
Tone: Professional yet engaging
Include relevant hashtags where appropriate.`;

    const personaPrompt = request.persona ? `

Character: ${request.persona.name}
Personality: ${request.persona.personality.tone}, ${request.persona.personality.communication_style}
Expertise: ${request.persona.personality.expertise.join(', ')}
Emoji usage: ${request.persona.personality.emoji_usage}

Write in character as ${request.persona.name}.` : '';

    return basePrompt + personaPrompt;
  }

  /**
   * Get appropriate token limit based on content length
   */
  private getContentLength(length: ContentRequest['length']): number {
    switch (length) {
      case 'short': return 150;
      case 'medium': return 500;
      case 'long': return 1500;
      default: return 300;
    }
  }
}
