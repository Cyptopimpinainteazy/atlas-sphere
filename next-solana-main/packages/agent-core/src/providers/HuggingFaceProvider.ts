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

export class HuggingFaceProvider implements LLMProvider {
  public id: string;
  public name: LLMProviderType = 'huggingface';
  public status: 'healthy' | 'degraded' | 'unavailable' = 'healthy';
  public last_health_check: Date = new Date();
  public capabilities = [
    'sentiment_analysis',
    'text_classification',
    'nlp_tasks'
  ];

  public rate_limits = {
    requests_per_minute: 100,
    tokens_per_minute: 150000
  };

  private api_key: string;
  private base_url = 'https://api-inference.huggingface.co/models';
  private default_model = 'cardiffnlp/twitter-roberta-base-sentiment-latest';

  constructor(api_key?: string) {
    this.api_key = api_key || process.env.HUGGINGFACE_API_KEY || '';
    this.id = `huggingface-${Date.now()}`;

    if (!this.api_key) {
      console.warn('HuggingFace API key not provided. Provider will be unavailable.');
      this.status = 'unavailable';
    }
  }

  async chatCompletion(request: ChatCompletionRequest): Promise<ChatCompletionResponse> {
    const startTime = Date.now();

    try {
      if (this.status === 'unavailable') {
        throw new Error('HuggingFace provider is unavailable - no API key configured');
      }

      // For general chat, use a conversational model
      const model = request.model || 'microsoft/DialoGPT-medium';

      const response = await fetch(`${this.base_url}/${model}`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${this.api_key}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          inputs: this.buildPrompt(request.messages),
          parameters: {
            max_length: request.max_tokens || 2048,
            temperature: request.temperature || 0.7,
            top_p: request.top_p || 1,
            do_sample: true,
            return_full_text: false
          },
          options: {
            wait_for_model: true,
            use_cache: false
          }
        })
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(`HuggingFace API error: ${response.status} - ${errorData.error?.message || 'Unknown error'}`);
      }

      const data = await response.json();
      const responseTime = Date.now() - startTime;

      // Handle different response formats
      let content = '';
      let usage = { prompt_tokens: 0, completion_tokens: 0, total_tokens: 0 };

      if (Array.isArray(data)) {
        content = data[0]?.generated_text || data[0]?.text || '';
      } else if (data.generated_text) {
        content = data.generated_text;
      } else if (data.text) {
        content = data.text;
      }

      return {
        content,
        usage,
        model: model,
        provider: 'huggingface',
        finish_reason: 'stop',
        response_time: responseTime,
        cached: false
      };
    } catch (error) {
      this.status = 'degraded';
      const responseTime = Date.now() - startTime;
      throw new Error(`HuggingFace chat completion failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  async analyzeSentiment(text: string): Promise<SentimentAnalysisResult> {
    const startTime = Date.now();

    try {
      if (this.status === 'unavailable') {
        throw new Error('HuggingFace provider is unavailable - no API key configured');
      }

      const model = 'cardiffnlp/twitter-roberta-base-sentiment-latest';

      const response = await fetch(`${this.base_url}/${model}`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${this.api_key}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          inputs: text,
          parameters: {
            truncation: true,
            max_length: 512
          },
          options: {
            wait_for_model: true,
            use_cache: false
          }
        })
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(`HuggingFace sentiment analysis error: ${response.status} - ${errorData.error?.message || 'Unknown error'}`);
      }

      const data = await response.json();
      const responseTime = Date.now() - startTime;

      // Parse HuggingFace sentiment response
      let sentimentResult = {
        score: 0.5,
        label: 'neutral',
        confidence: 0.5
      };

      if (Array.isArray(data) && data[0]) {
        const scores = data[0];

        // Find the highest scoring label
        let maxScore = 0;
        let maxIndex = 0;

        scores.forEach((item: any, index: number) => {
          if (item.score > maxScore) {
            maxScore = item.score;
            maxIndex = index;
          }
        });

        const labels = ['negative', 'neutral', 'positive'];
        sentimentResult = {
          score: maxIndex === 0 ? 0.2 : maxIndex === 1 ? 0.5 : 0.8, // Map to 0-1 scale
          label: labels[maxIndex] as 'negative' | 'neutral' | 'positive',
          confidence: maxScore
        };
      }

      return {
        score: sentimentResult.score,
        label: sentimentResult.label as 'negative' | 'neutral' | 'positive',
        confidence: sentimentResult.confidence,
        provider: 'huggingface',
        model: model,
        processing_time: responseTime
      };
    } catch (error) {
      const responseTime = Date.now() - startTime;
      throw new Error(`HuggingFace sentiment analysis failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
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
        provider: 'huggingface',
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
        provider: 'huggingface',
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

  private buildPrompt(messages: ChatCompletionRequest['messages']): string {
    return messages.map(msg => {
      const role = msg.role === 'user' ? 'Human' : 'Assistant';
      return `${role}: ${msg.content}`;
    }).join('\n\n');
  }

  // Text classification for various NLP tasks
  async textClassification(text: string, model?: string): Promise<Array<{
    label: string;
    score: number;
  }>> {
    try {
      const modelName = model || this.default_model;

      const response = await fetch(`${this.base_url}/${modelName}`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${this.api_key}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          inputs: text,
          options: {
            wait_for_model: true,
            use_cache: false
          }
        })
      });

      if (!response.ok) {
        throw new Error(`HuggingFace classification error: ${response.status}`);
      }

      const data = await response.json();
      return Array.isArray(data) && data[0] ? data[0] : [];
    } catch (error) {
      console.error('HuggingFace text classification failed:', error);
      return [];
    }
  }

  // Named Entity Recognition
  async namedEntityRecognition(text: string): Promise<Array<{
    entity_group: string;
    word: string;
    start: number;
    end: number;
    score: number;
  }>> {
    try {
      const model = 'dbmdz/bert-large-cased-finetuned-conll03-english';

      const response = await fetch(`${this.base_url}/${model}`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${this.api_key}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          inputs: text,
          options: {
            wait_for_model: true,
            use_cache: false
          }
        })
      });

      if (!response.ok) {
        throw new Error(`HuggingFace NER error: ${response.status}`);
      }

      const data = await response.json();
      return Array.isArray(data) && data[0] ? data[0] : [];
    } catch (error) {
      console.error('HuggingFace NER failed:', error);
      return [];
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
      provider: 'huggingface',
      finish_reason: response.finish_reason
    };
  }

  async analyzeMarket(data: MarketData): Promise<MarketAnalysis> {
    // Use sentiment analysis for market sentiment
    const sentimentText = `Token: ${data.pair}, Price: $${data.price}, Volume: $${data.volume_24h}, Change: ${data.price_change_24h}%`;

    const sentiment = await this.analyzeSentiment(sentimentText);

    return {
      sentiment: sentiment.label,
      confidence: sentiment.confidence,
      reasoning: `Market analysis based on price data and sentiment analysis.`,
      key_levels: { support: [], resistance: [] },
      recommendation: sentiment.score > 0.6 ? 'buy' : sentiment.score < 0.4 ? 'sell' : 'hold',
      risk_level: 'medium'
    };
  }

  async generateContent(request: ContentRequest): Promise<ContentResponse> {
    const prompt = `Generate ${request.type} content about: ${request.topic} for ${request.audience} audience. Length: ${request.length}.`;

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

  // Get available models for specific tasks
  getSentimentModels(): string[] {
    return [
      'cardiffnlp/twitter-roberta-base-sentiment-latest',
      'nlptown/bert-base-multilingual-uncased-sentiment',
      'distilbert-base-uncased-finetuned-sst-2-english'
    ];
  }

  getTextGenerationModels(): string[] {
    return [
      'gpt2',
      'distilgpt2',
      'microsoft/DialoGPT-medium',
      'facebook/blenderbot-400M-distill'
    ];
  }

  // Check API quota and usage
  async getUsageInfo(): Promise<{
    monthly_usage?: number;
    quota_limit?: number;
    quota_remaining?: number;
  }> {
    try {
      const response = await fetch('https://huggingface.co/api/whoami-v2', {
        headers: {
          'Authorization': `Bearer ${this.api_key}`
        }
      });

      if (response.ok) {
        const data = await response.json();
        return {
          monthly_usage: data.usage?.monthly || 0,
          quota_limit: 30000, // Default HF quota
          quota_remaining: (data.usage?.monthly || 0) < 30000 ? 30000 - (data.usage?.monthly || 0) : 0
        };
      }
    } catch (error) {
      console.error('Failed to get HuggingFace usage info:', error);
    }

    return {};
  }
}