import { LLMProvider, LLMRequest, LLMResponse, MarketData, MarketAnalysis, ContentRequest, ContentResponse, LLMProviderCapability } from '../../types';

/**
 * HuggingFace Provider - Uses free inference API for sentiment analysis and NLP tasks
 * Optimized for sentiment analysis and text classification
 */
export class HuggingFaceProvider implements LLMProvider {
  id = 'huggingface-provider';
  name = 'huggingface' as const;
  status: 'healthy' | 'degraded' | 'unavailable' = 'unavailable';
  last_health_check = new Date();
  capabilities: LLMProviderCapability[] = [
    'text_generation',
    'sentiment',
    'translation'
  ];
  rate_limits = {
    requests_per_minute: 60, // HuggingFace free tier limits
    tokens_per_minute: 30000
  };

  private readonly apiKey: string;
  private readonly apiUrl = 'https://api-inference.huggingface.co/models/';

  constructor() {
    this.apiKey = process.env.HUGGINGFACE_API_KEY || '';
  }

  /**
   * Generate text response using HuggingFace inference API
   */
  async generateResponse(request: LLMRequest): Promise<LLMResponse> {
    if (!this.apiKey) {
      throw new Error('HUGGINGFACE_API_KEY environment variable not set');
    }

    try {
      const payload = {
        inputs: request.context
          ? `${request.context}\n\n${request.prompt}`
          : request.prompt,
        parameters: {
          max_new_tokens: Math.min(request.max_tokens || 1000, 500),
          temperature: request.temperature || 0.7,
          top_p: 0.9,
          do_sample: true,
          return_full_text: false,
        },
        options: {
          wait_for_model: true,
          use_cache: true,
        }
      };

      const response = await fetch(`${this.apiUrl}microsoft/DialoGPT-medium`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${this.apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload)
      });

      if (!response.ok) {
        throw new Error(`HuggingFace API error: ${response.status} ${response.statusText}`);
      }

      const data = await response.json();

      let content = '';
      if (Array.isArray(data) && data[0]?.generated_text) {
        content = data[0].generated_text;
      } else if (data.generated_text) {
        content = data.generated_text;
      }

      return {
        content,
        usage: {
          prompt_tokens: this.estimateTokens(request.prompt + (request.context || '')),
          completion_tokens: this.estimateTokens(content),
          total_tokens: 0
        },
        model: 'microsoft/DialoGPT-medium',
        provider: 'huggingface',
        finish_reason: 'stop'
      };
    } catch (error) {
      console.error('HuggingFace API request failed:', error);
      throw error;
    }
  }

  /**
   * Market analysis using sentiment-focused models
   */
  async analyzeMarket(data: MarketData): Promise<MarketAnalysis> {
    // Use sentiment analysis to gauge market mood
    const sentimentScore = await this.analyzeSentiment(data.pair);

    // Simple analysis based on sentiment and price movement
    const sentiment = sentimentScore > 0.1 ? 'bullish' : sentimentScore < -0.1 ? 'bearish' : 'neutral';
    const confidence = Math.min(100, Math.abs(sentimentScore) * 50 + 30);

    return {
      sentiment,
      confidence,
      reasoning: `Sentiment analysis indicates ${sentiment} market mood for ${data.pair}`,
      key_levels: { support: [], resistance: [] },
      recommendation: sentiment === 'bullish' ? 'buy' : sentiment === 'bearish' ? 'sell' : 'hold',
      risk_level: sentiment === 'neutral' ? 'low' : 'medium'
    };
  }

  /**
   * Generate content using HuggingFace models
   */
  async generateContent(request: ContentRequest): Promise<ContentResponse> {
    const response = await this.generateResponse({
      prompt: `Create a ${request.length} ${request.type} about ${request.topic} for ${request.audience} audience.`,
      temperature: 0.7,
      max_tokens: this.getContentLength(request.length)
    });

    return {
      content: response.content,
      hashtags: ['#crypto', '#market'],
      created_at: new Date()
    };
  }

  /**
   * Sentiment analysis using HuggingFace models
   */
  private async analyzeSentiment(text: string): Promise<number> {
    try {
      const response = await fetch(`${this.apiUrl}cardiffnlp/twitter-roberta-base-sentiment-latest`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${this.apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          inputs: text,
          options: { wait_for_model: true }
        })
      });

      if (!response.ok) {
        throw new Error(`Sentiment analysis failed: ${response.status}`);
      }

      const data = await response.json();

      // Calculate weighted sentiment score (-1 to 1)
      if (Array.isArray(data) && data[0]) {
        const sentiments = data[0];
        const scores = sentiments.reduce((acc: Record<string, number>, item: Record<string, unknown>) => {
          if (typeof item.label === 'string' && typeof item.score === 'number') {
            acc[item.label] = item.score;
          }
          return acc;
        }, {});

        // Convert to scale: negative, neutral, positive -> -1, 0, 1
        return (scores.POSITIVE || 0) - (scores.NEGATIVE || 0);
      }

      return 0;
    } catch (error) {
      console.error('Sentiment analysis error:', error);
      return 0;
    }
  }

  /**
   * Get appropriate token limit based on content length
   */
  private getContentLength(length: ContentRequest['length']): number {
    switch (length) {
      case 'short': return 100;
      case 'medium': return 250;
      case 'long': return 500;
      default: return 150;
    }
  }

  /**
   * Rough token estimation
   */
  private estimateTokens(text: string): number {
    return Math.ceil(text.length / 4);
  }
}
