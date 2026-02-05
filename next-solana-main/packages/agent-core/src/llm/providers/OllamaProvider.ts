import { LLMProvider, LLMRequest, LLMResponse, MarketData, MarketAnalysis, ContentRequest, ContentResponse, LLMProviderCapability } from '../../types';

/**
 * Ollama Provider - Local LLM deployment for privacy-sensitive operations
 * Supports various local models like Llama 2, Code Llama, Mistral
 */
export class OllamaProvider implements LLMProvider {
  id = 'ollama-provider';
  name = 'ollama' as const;
  status: 'healthy' | 'degraded' | 'unavailable' = 'unavailable';
  last_health_check = new Date();
  capabilities: LLMProviderCapability[] = [
    'text_generation',
    'code_generation',
    'analysis'
  ];
  rate_limits = {
    requests_per_minute: 60, // Local model, faster than API calls
    tokens_per_minute: 40000
  };

  private readonly apiUrl: string;
  private readonly defaultModel: string;

  constructor() {
    this.apiUrl = process.env.OLLAMA_API_URL || 'http://localhost:11434';
    this.defaultModel = process.env.OLLAMA_MODEL || 'llama2';
  }

  /**
   * Generate text response using local Ollama API
   */
  async generateResponse(request: LLMRequest): Promise<LLMResponse> {
    try {
      const payload = this.buildRequestPayload(request);

      const response = await fetch(`${this.apiUrl}/api/generate`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload)
      });

      if (!response.ok) {
        throw new Error(`Ollama API error: ${response.status} ${response.statusText}`);
      }

      const data = await response.json();

      return {
        content: data.response || '',
        usage: {
          prompt_tokens: this.estimateTokens(request.prompt + (request.context || '')),
          completion_tokens: this.estimateTokens(data.response || ''),
          total_tokens: 0 // Ollama doesn't provide token counts in basic mode
        },
        model: data.model || this.defaultModel,
        provider: 'ollama',
        finish_reason: data.done ? 'stop' : 'length'
      };
    } catch (error) {
      console.error('Ollama API request failed:', error);
      throw error;
    }
  }

  /**
   * Market analysis using local models for privacy
   */
  async analyzeMarket(data: MarketData): Promise<MarketAnalysis> {
    const prompt = `You are a crypto market analyst. Analyze this data:

Token: ${data.pair}
Price: $${data.price} (${data.price_change_24h}%)
24h Volume: $${data.volume_24h.toLocaleString()}
${data.market_cap ? `Market Cap: $${data.market_cap.toLocaleString()}` : ''}

Provide your analysis in this exact JSON format:
{
  "sentiment": "bullish|bearish|neutral",
  "confidence": 0-100,
  "reasoning": "brief explanation",
  "key_levels": {"support": [prices], "resistance": [prices]},
  "recommendation": "buy|hold|sell",
  "risk_level": "low|medium|high"
}`;

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
        reasoning: analysis.reasoning || 'Local analysis complete',
        key_levels: analysis.key_levels || { support: [], resistance: [] },
        recommendation: analysis.recommendation || 'hold',
        risk_level: analysis.risk_level || 'medium'
      };
    } catch (error) {
      console.error('Failed to parse Ollama market analysis:', error);
      // Fallback analysis
      return {
        sentiment: data.price_change_24h > 0 ? 'bullish' : data.price_change_24h < -5 ? 'bearish' : 'neutral',
        confidence: Math.min(100, Math.abs(data.price_change_24h) * 2),
        reasoning: `Price movement of ${data.price_change_24h}% suggests ${data.price_change_24h > 0 ? 'upward' : 'downward'} momentum`,
        key_levels: { support: [], resistance: [] },
        recommendation: data.price_change_24h > 2 ? 'buy' : data.price_change_24h < -2 ? 'sell' : 'hold',
        risk_level: 'medium'
      };
    }
  }

  /**
   * Generate content using local models
   */
  async generateContent(request: ContentRequest): Promise<ContentResponse> {
    const prompt = this.buildContentPrompt(request);

    const response = await this.generateResponse({
      prompt,
      temperature: request.type === 'tweet' ? 0.7 : 0.5,
      max_tokens: this.getContentLength(request.length)
    });

    const hashtags = request.topic.toLowerCase().split(' ').map(word => `#${word}`);
    if (request.type === 'tweet') {
      hashtags.length = Math.min(3, hashtags.length);
    }

    return {
      content: response.content,
      hashtags,
      created_at: new Date()
    };
  }

  /**
   * Build request payload for Ollama API
   */
  private buildRequestPayload(request: LLMRequest): Record<string, unknown> {
    const fullPrompt = request.context
      ? `${request.context}\n\n${request.prompt}`
      : request.prompt;

    return {
      model: this.defaultModel,
      prompt: fullPrompt,
      stream: false,
      options: {
        temperature: request.temperature || 0.7,
        num_predict: Math.min(request.max_tokens || 1000, 2048),
        top_p: 0.9,
        top_k: 40,
      }
    };
  }

  /**
   * Build content generation prompt for Ollama
   */
  private buildContentPrompt(request: ContentRequest): string {
    return `Create ${request.type} content about: ${request.topic}

Context: ${request.context || 'General topic'}
Audience: ${request.audience}
Length: ${request.length}
Style: Professional and engaging

${request.persona ? `Write as ${request.persona.name}: ${request.persona.personality.tone}, ${request.persona.personality.communication_style}` : ''}

Generate content that would perform well on social media. Include relevant hashtags naturally.`;
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

  /**
   * Rough token estimation (not accurate but good enough for basic usage tracking)
   */
  private estimateTokens(text: string): number {
    return Math.ceil(text.length / 4); // Rough estimate: 1 token ≈ 4 characters
  }
}
