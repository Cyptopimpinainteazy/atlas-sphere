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

export class OllamaProvider implements LLMProvider {
  public id: string;
  public name: LLMProviderType = 'ollama';
  public status: 'healthy' | 'degraded' | 'unavailable' = 'healthy';
  public last_health_check: Date = new Date();
  public capabilities = [
    'text_generation',
    'code_generation',
    'privacy_sensitive',
    'local_processing'
  ];

  public rate_limits = {
    requests_per_minute: 30, // Lower due to local processing
    tokens_per_minute: 50000
  };

  private base_url: string;
  private default_model = 'llama2';
  private available_models: string[] = [];

  constructor(base_url?: string) {
    this.base_url = base_url || process.env.OLLAMA_SERVER_URL || 'http://localhost:11434';
    this.id = `ollama-${Date.now()}`;

    this.checkServerAvailability();
  }

  private async checkServerAvailability(): Promise<void> {
    try {
      const response = await fetch(`${this.base_url}/api/tags`);
      if (response.ok) {
        const data = await response.json();
        this.available_models = data.models?.map((m: any) => m.name) || [];
        if (this.available_models.length === 0) {
          console.warn('Ollama server is running but no models are available');
          this.status = 'degraded';
        }
      } else {
        console.warn('Ollama server is not available. Provider will be unavailable.');
        this.status = 'unavailable';
      }
    } catch (error) {
      console.warn('Failed to connect to Ollama server. Provider will be unavailable:', error);
      this.status = 'unavailable';
    }
  }

  async chatCompletion(request: ChatCompletionRequest): Promise<ChatCompletionResponse> {
    const startTime = Date.now();

    try {
      if (this.status === 'unavailable') {
        throw new Error('Ollama provider is unavailable - server not accessible');
      }

      const model = request.model || this.default_model;

      // Check if model is available
      if (!this.available_models.includes(model)) {
        console.warn(`Model ${model} not available locally. Using ${this.default_model}`);
      }

      const response = await fetch(`${this.base_url}/api/chat`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          model,
          messages: request.messages,
          options: {
            temperature: request.temperature ?? 0.7,
            top_p: request.top_p ?? 1,
            num_predict: request.max_tokens ?? 2048,
            frequency_penalty: request.frequency_penalty ?? 0,
            presence_penalty: request.presence_penalty ?? 0,
            stop: request.stop ?? []
          },
          stream: false
        })
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(`Ollama API error: ${response.status} - ${errorData.error?.message || 'Unknown error'}`);
      }

      const data = await response.json();
      const responseTime = Date.now() - startTime;

      return {
        content: data.message?.content || data.response || '',
        usage: {
          prompt_tokens: data.prompt_eval_count || 0,
          completion_tokens: data.eval_count || 0,
          total_tokens: (data.prompt_eval_count || 0) + (data.eval_count || 0)
        },
        model: data.model || model,
        provider: 'ollama',
        finish_reason: data.done_reason || 'stop',
        response_time: responseTime,
        cached: false
      };
    } catch (error) {
      this.status = 'degraded';
      const responseTime = Date.now() - startTime;
      throw new Error(`Ollama chat completion failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
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
        provider: 'ollama',
        model: response.model,
        processing_time: responseTime
      };
    } catch (error) {
      const responseTime = Date.now() - startTime;
      throw new Error(`Ollama sentiment analysis failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  async healthCheck(): Promise<ProviderHealth> {
    const startTime = Date.now();

    try {
      await this.checkServerAvailability();

      if (this.status === 'unavailable') {
        return {
          provider: 'ollama',
          status: 'unavailable',
          response_time: Date.now() - startTime,
          error_rate: 1.0,
          last_check: new Date(),
          availability_score: 0,
          total_requests: 0,
          successful_requests: 0,
          average_response_time: 0
        };
      }

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
        provider: 'ollama',
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
        provider: 'ollama',
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

  async listModels(): Promise<string[]> {
    try {
      const response = await fetch(`${this.base_url}/api/tags`);
      if (response.ok) {
        const data = await response.json();
        this.available_models = data.models?.map((m: any) => m.name) || [];
        return this.available_models;
      }
      return [];
    } catch (error) {
      console.error('Failed to list Ollama models:', error);
      return [];
    }
  }

  async pullModel(modelName: string): Promise<boolean> {
    try {
      const response = await fetch(`${this.base_url}/api/pull`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          name: modelName
        })
      });

      return response.ok;
    } catch (error) {
      console.error('Failed to pull model:', error);
      return false;
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
      provider: 'ollama',
      finish_reason: response.finish_reason
    };
  }

  async analyzeMarket(data: MarketData): Promise<MarketAnalysis> {
    const prompt = `
Analyze this market data for local/private processing:
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
        reasoning: analysis.reasoning || 'Local analysis based on provided market data.',
        key_levels: {
          support: analysis.key_levels?.support || [],
          resistance: analysis.key_levels?.resistance || []
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

  // Get resource usage for local models
  async getResourceUsage(): Promise<{
    cpu_percent?: number;
    memory_percent?: number;
    gpu_memory_percent?: number;
  }> {
    // This would require additional system monitoring
    // For now, return basic info
    return {};
  }

  // Check if server is running locally
  async isServerRunning(): Promise<boolean> {
    try {
      const response = await fetch(`${this.base_url}/api/version`, {
        timeout: 5000
      });
      return response.ok;
    } catch {
      return false;
    }
  }
}