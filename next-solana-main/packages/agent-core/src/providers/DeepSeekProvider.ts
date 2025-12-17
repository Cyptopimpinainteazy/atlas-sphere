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

export class DeepSeekProvider implements LLMProvider {
  public id: string;
  public name: LLMProviderType = 'deepseek';
  public status: 'healthy' | 'degraded' | 'unavailable' = 'healthy';
  public last_health_check: Date = new Date();
  public capabilities = [
    'text_generation',
    'code_generation',
    'analysis',
    'technical_analysis'
  ];

  public rate_limits = {
    requests_per_minute: 60,
    tokens_per_minute: 100000
  };

  private api_key: string;
  private base_url = 'https://api.deepseek.com/v1';
  private default_model = 'deepseek-coder';

  constructor(api_key?: string) {
    this.api_key = api_key || process.env.DEEPSEEK_API_KEY || '';
    this.id = `deepseek-${Date.now()}`;

    if (!this.api_key) {
      console.warn('DeepSeek API key not provided. Provider will be unavailable.');
      this.status = 'unavailable';
    }
  }

  async chatCompletion(request: ChatCompletionRequest): Promise<ChatCompletionResponse> {
    const startTime = Date.now();

    try {
      if (this.status === 'unavailable') {
        throw new Error('DeepSeek provider is unavailable - no API key configured');
      }

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
          temperature: request.temperature ?? 0.7,
          max_tokens: request.max_tokens ?? 2048,
          top_p: request.top_p ?? 1,
          frequency_penalty: request.frequency_penalty ?? 0,
          presence_penalty: request.presence_penalty ?? 0,
          stop: request.stop ?? null,
          stream: request.stream ?? false
        })
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(`DeepSeek API error: ${response.status} - ${errorData.error?.message || 'Unknown error'}`);
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
        provider: 'deepseek',
        finish_reason: data.choices[0]?.finish_reason || 'stop',
        response_time: responseTime,
        cached: false
      };
    } catch (error) {
      this.status = 'degraded';
      const responseTime = Date.now() - startTime;
      throw new Error(`DeepSeek chat completion failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  async analyzeSentiment(text: string): Promise<SentimentAnalysisResult> {
    const startTime = Date.now();

    try {
      const prompt = `Analyze the sentiment of the following text and return a JSON response with score (0-1), label (positive/negative/neutral), and confidence (0-1):

Text: "${text}"

Respond only with valid JSON in this format: {"score": 0.5, "label": "neutral", "confidence": 0.8}`;

      const request: ChatCompletionRequest = {
        messages: [
          { role: 'system', content: 'You are a sentiment analysis expert. Always respond with valid JSON.' },
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
        // Fallback parsing if JSON is malformed
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
        provider: 'deepseek',
        model: response.model,
        processing_time: responseTime
      };
    } catch (error) {
      const responseTime = Date.now() - startTime;
      throw new Error(`DeepSeek sentiment analysis failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
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
        provider: 'deepseek',
        status: 'healthy',
        response_time: responseTime,
        error_rate: 0,
        last_check: this.last_health_check,
        availability_score: 1.0,
        total_requests: 0, // Would be populated by health monitor
        successful_requests: 0,
        average_response_time: responseTime
      };
    } catch (error) {
      const responseTime = Date.now() - startTime;
      this.status = 'unavailable';
      this.last_health_check = new Date();

      return {
        provider: 'deepseek',
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
      provider: 'deepseek',
      finish_reason: response.finish_reason
    };
  }

  async analyzeMarket(data: MarketData): Promise<MarketAnalysis> {
    const prompt = `
Analyze this market data and provide trading insights:
- Pair: ${data.pair}
- Price: $${data.price}
- 24h Volume: $${data.volume_24h}
- 24h Change: ${data.price_change_24h}%
- Market Cap: ${data.market_cap ? '$' + data.market_cap : 'N/A'}

Provide analysis in JSON format with sentiment, confidence, reasoning, key_levels, recommendation, and risk_level.
    `;

    const request: ChatCompletionRequest = {
      messages: [
        { role: 'system', content: 'You are an expert market analyst. Respond only with valid JSON.' },
        { role: 'user', content: prompt }
      ],
      temperature: 0.3,
      max_tokens: 500,
      task_type: 'market-analysis'
    };

    const response = await this.chatCompletion(request);

    try {
      const analysis = JSON.parse(response.content);
      return {
        sentiment: analysis.sentiment || 'neutral',
        confidence: Math.max(0, Math.min(1, analysis.confidence || 0.5)),
        reasoning: analysis.reasoning || 'Analysis based on provided market data.',
        key_levels: {
          support: analysis.key_levels?.support || [],
          resistance: analysis.key_levels?.resistance || []
        },
        recommendation: analysis.recommendation || 'hold',
        risk_level: analysis.risk_level || 'medium'
      };
    } catch (error) {
      // Fallback if JSON parsing fails
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
    const prompt = `
Generate ${request.type} content about: ${request.topic}
Length: ${request.length}
Audience: ${request.audience}
    `;

    const chatRequest: ChatCompletionRequest = {
      messages: [
        { role: 'system', content: 'You are a professional content creator.' },
        { role: 'user', content: prompt }
      ],
      temperature: 0.8,
      max_tokens: 1000,
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
}