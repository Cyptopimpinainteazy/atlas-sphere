import {
  LLMProvider,
  ChatCompletionRequest,
  ChatCompletionResponse,
  ProviderHealth,
  SentimentAnalysisResult,
  LLMProviderType,
  LLMRequest,
  LLMResponse,
  MarketData,
  MarketAnalysis,
  ContentRequest,
  ContentResponse
} from '../types';

// Groq SDK would be imported here if available
// import Groq from 'groq-sdk';

export class GroqProvider implements LLMProvider {
  public id: string;
  public name: LLMProviderType = 'groq';
  public status: 'healthy' | 'degraded' | 'unavailable' = 'healthy';
  public last_health_check: Date = new Date();
  public capabilities = [
    'text_generation',
    'trading_decision',
    'real_time_analysis'
  ];

  public rate_limits = {
    requests_per_minute: 100,
    tokens_per_minute: 200000
  };

  private api_key: string;
  private base_url = 'https://api.groq.com/openai/v1';
  private default_model = 'mixtral-8x7b-32768'; // Fast model optimized for speed

  constructor(api_key?: string) {
    this.api_key = api_key || process.env.GROQ_API_KEY || '';
    this.id = `groq-${Date.now()}`;

    if (!this.api_key) {
      console.warn('Groq API key not provided. Provider will be unavailable.');
      this.status = 'unavailable';
    }
  }

  async chatCompletion(request: ChatCompletionRequest): Promise<ChatCompletionResponse> {
    const startTime = Date.now();

    try {
      if (this.status === 'unavailable') {
        throw new Error('Groq provider is unavailable - no API key configured');
      }

      // Use low temperature for trading decisions, higher for creative tasks
      const temperature = request.task_type === 'trading-decision' ? 0.2 : (request.temperature ?? 0.7);
      const model = request.model || this.default_model;

      const response = await fetch(`${this.base_url}/chat/completions`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${this.api_key}`
        },
        body: JSON.stringify({
          model,
          messages: request.messages,
          temperature,
          max_tokens: request.max_tokens ?? 4096,
          top_p: request.top_p ?? 1,
          frequency_penalty: request.frequency_penalty ?? 0,
          presence_penalty: request.presence_penalty ?? 0,
          stop: request.stop ?? null,
          stream: request.stream ?? false
        })
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(`Groq API error: ${response.status} - ${errorData.error?.message || 'Unknown error'}`);
      }

      const data = await response.json();
      const responseTime = Date.now() - startTime;

      return {
        content: data.choices[0]?.message?.content || '',
        usage: {
          prompt_tokens: data.usage?.prompt_tokens || 0,
          completion_tokens: data.usage?.completion_tokens || 0,
          total_tokens: data.usage?.total_tokens || 0
        },
        model: data.model || model,
        provider: 'groq',
        finish_reason: data.choices[0]?.finish_reason || 'stop',
        response_time: responseTime,
        cached: false
      };
    } catch (error) {
      this.status = 'degraded';
      const responseTime = Date.now() - startTime;
      throw new Error(`Groq chat completion failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  async analyzeSentiment(text: string): Promise<SentimentAnalysisResult> {
    const startTime = Date.now();

    try {
      const prompt = `Analyze the sentiment of this text and return ONLY a JSON object with "score" (0-1, where 1 is very positive), "label" (positive/negative/neutral), and "confidence" (0-1):

Text: "${text}"

Response format: {"score": 0.7, "label": "positive", "confidence": 0.85}`;

      const request: ChatCompletionRequest = {
        messages: [
          {
            role: 'system',
            content: 'You are a sentiment analysis expert. Respond only with valid JSON in the exact format specified.'
          },
          { role: 'user', content: prompt }
        ],
        temperature: 0.1,
        max_tokens: 100,
        task_type: 'sentiment-analysis'
      };

      const response = await this.chatCompletion(request);
      const responseTime = Date.now() - startTime;

      // Parse JSON response
      let analysis;
      try {
        analysis = JSON.parse(response.content);
      } catch (parseError) {
        // Fallback parsing
        const scoreMatch = response.content.match(/score["\s]*:[\s]*([0-9.]+)/);
        const labelMatch = response.content.match(/label["\s]*:[\s]*["']([^"']+)/);
        const confidenceMatch = response.content.match(/confidence["\s]*:[\s]*([0-9.]+)/);

        analysis = {
          score: scoreMatch ? parseFloat(scoreMatch[1]) : 0.5,
          label: labelMatch ? labelMatch[1] : 'neutral',
          confidence: confidenceMatch ? parseFloat(confidenceMatch[1]) : 0.5
        };
      }

      return {
        score: Math.max(0, Math.min(1, analysis.score || 0.5)),
        label: analysis.label || 'neutral',
        confidence: Math.max(0, Math.min(1, analysis.confidence || 0.5)),
        provider: 'groq',
        model: response.model,
        processing_time: responseTime
      };
    } catch (error) {
      const responseTime = Date.now() - startTime;
      throw new Error(`Groq sentiment analysis failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  async healthCheck(): Promise<ProviderHealth> {
    const startTime = Date.now();

    try {
      const request: ChatCompletionRequest = {
        messages: [{ role: 'user', content: 'Hello' }],
        max_tokens: 10,
        temperature: 0
      };

      await this.chatCompletion(request);
      const responseTime = Date.now() - startTime;

      this.status = 'healthy';
      this.last_health_check = new Date();

      return {
        provider: 'groq',
        status: 'healthy',
        response_time: responseTime,
        error_rate: 0,
        last_check: this.last_health_check,
        availability_score: 1.0,
        total_requests: 0,
        successful_requests: 0,
        average_response_time: responseTime
      };
    } catch (error) {
      const responseTime = Date.now() - startTime;
      this.status = 'unavailable';
      this.last_health_check = new Date();

      return {
        provider: 'groq',
        status: 'unavailable',
        response_time: responseTime,
        error_rate: 1.0,
        last_check: this.last_health_check,
        availability_score: 0,
        total_requests: 0,
        successful_requests: 0,
        average_response_time: responseTime
      };
    }
  }

  // Implement existing interface methods for backward compatibility
  async generateResponse(request: LLMRequest): Promise<LLMResponse> {
    const chatRequest: ChatCompletionRequest = {
      messages: [
        { role: 'system', content: request.context || 'You are a helpful AI assistant.' },
        { role: 'user', content: request.prompt }
      ],
      temperature: request.temperature,
      max_tokens: request.max_tokens,
      model: request.model
    };

    const response = await this.chatCompletion(chatRequest);

    return {
      content: response.content,
      usage: response.usage,
      model: response.model,
      provider: 'groq',
      finish_reason: response.finish_reason
    };
  }

  async analyzeMarket(data: MarketData): Promise<MarketAnalysis> {
    const prompt = `
URGENT MARKET ANALYSIS REQUIRED:
- Token: ${data.pair}
- Current Price: $${data.price}
- 24h Volume: $${data.volume_24h.toLocaleString()}
- 24h Change: ${data.price_change_24h.toFixed(2)}%
${data.market_cap ? `- Market Cap: $${data.market_cap.toLocaleString()}` : ''}

Provide IMMEDIATE trading decision in JSON format:
{
  "sentiment": "bullish/bearish/neutral",
  "confidence": 0.0-1.0,
  "reasoning": "brief explanation",
  "key_levels": {"support": [array], "resistance": [array]},
  "recommendation": "buy/sell/hold",
  "risk_level": "low/medium/high"
}
    `;

    const request: ChatCompletionRequest = {
      messages: [
        {
          role: 'system',
          content: 'You are an elite trading analyst. Provide immediate, data-driven decisions. Respond only with valid JSON.'
        },
        { role: 'user', content: prompt }
      ],
      temperature: 0.2, // Low temperature for consistent trading decisions
      max_tokens: 500,
      task_type: 'trading-decision'
    };

    const response = await this.chatCompletion(request);

    try {
      const analysis = JSON.parse(response.content);
      return {
        sentiment: analysis.sentiment || 'neutral',
        confidence: Math.max(0, Math.min(1, analysis.confidence || 0.5)),
        reasoning: analysis.reasoning || 'Analysis based on provided market data.',
        key_levels: {
          support: Array.isArray(analysis.key_levels?.support) ? analysis.key_levels.support : [],
          resistance: Array.isArray(analysis.key_levels?.resistance) ? analysis.key_levels.resistance : []
        },
        recommendation: analysis.recommendation || 'hold',
        risk_level: analysis.risk_level || 'medium'
      };
    } catch (error) {
      return {
        sentiment: 'neutral',
        confidence: 0.5,
        reasoning: response.content,
        key_levels: { support: [], resistance: [] },
        recommendation: 'hold',
        risk_level: 'medium'
      };
    }
  }

  async generateContent(request: ContentRequest): Promise<ContentResponse> {
    const systemPrompts = {
      tweet: 'You are a crypto expert creating engaging tweets. Keep it under 280 characters.',
      post: 'You are a professional content creator writing detailed posts about crypto.',
      analysis: 'You are a market analyst providing technical analysis.',
      education: 'You are a crypto educator explaining concepts clearly.'
    };

    const prompt = `
Content Type: ${request.type}
Topic: ${request.topic}
Length: ${request.length}
Audience: ${request.audience}

Generate content following these guidelines.
    `;

    const chatRequest: ChatCompletionRequest = {
      messages: [
        { role: 'system', content: systemPrompts[request.type as keyof typeof systemPrompts] || systemPrompts.post },
        { role: 'user', content: prompt }
      ],
      temperature: 0.8,
      max_tokens: request.length === 'short' ? 200 : request.length === 'medium' ? 500 : 1000,
      task_type: 'content-generation'
    };

    const response = await this.chatCompletion(request);

    return {
      content: response.content,
      hashtags: [], // Could be extracted from content
      mentions: [], // Could be extracted from content
      created_at: new Date()
    };
  }

  // Groq-specific optimizations for speed
  getOptimizedModel(taskType: string): string {
    switch (taskType) {
      case 'trading-decision':
      case 'real_time_analysis':
        return 'mixtral-8x7b-32768'; // Fastest model
      case 'content-generation':
        return 'llama2-70b-4096'; // Good balance of speed and quality
      case 'sentiment-analysis':
        return 'mixtral-8x7b-32768'; // Fast processing
      default:
        return this.default_model;
    }
  }

  // Get real-time performance metrics
  getPerformanceMetrics(): { averageResponseTime: number; successRate: number } {
    // This would be populated by the health monitor
    return {
      averageResponseTime: 150, // milliseconds
      successRate: 0.98
    };
  }
}