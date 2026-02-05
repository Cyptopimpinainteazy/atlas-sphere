import { LLMRequest, LLMResponse, AgentPersona } from '../types';

/**
 * Simple LLM service interface for content optimization
 */
export interface LLMService {
  generateResponse(prompt: string, provider?: string, options?: {
    maxTokens?: number;
    temperature?: number;
  }): Promise<string>;
}

/**
 * Adapter to wrap LLMOrchestrator and provide LLMService interface
 */
export class LLMOrchestratorAdapter implements LLMService {
  constructor(private llmOrchestrator: any) {}

  async generateResponse(
    prompt: string,
    provider?: string,
    options: { maxTokens?: number; temperature?: number } = {}
  ): Promise<string> {
    const request: LLMRequest = {
      prompt,
      max_tokens: options.maxTokens || 200,
      temperature: options.temperature || 0.7,
    };

    try {
      const response: LLMResponse = await this.llmOrchestrator.generateResponse(request);
      return response.content;
    } catch (error) {
      console.error('Error generating response via LLMOrchestrator:', error);
      throw error;
    }
  }
}