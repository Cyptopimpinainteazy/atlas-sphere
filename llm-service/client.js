/**
 * Substreams Skills LLM Client
 * Simple interface for querying Substreams skills
 */

class SubstreamsSkillsClient {
  constructor(options = {}) {
    this.routerEndpoint = options.endpoint || 'http://localhost:3000';
    this.defaultProvider = options.defaultProvider || 'ollama';
    this.defaultModel = options.defaultModel || null;
    this.timeout = options.timeout || 30000;
  }

  /**
   * Query a Substreams skill
   * @param {string} skillName - Skill name (substreams-dev, substreams-sql, etc.)
   * @param {string} question - The question to ask
   * @param {object} options - Query options (provider, model, temperature)
   */
  async querySkill(skillName, question, options = {}) {
    const payload = {
      question,
      provider: options.provider || this.defaultProvider,
      model: options.model || this.defaultModel,
      temperature: options.temperature || 0.7,
    };

    try {
      const response = await fetch(
        `${this.routerEndpoint}/skill/${skillName}`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        }
      );

      if (!response.ok) {
        throw new Error(`Router error: ${response.status} ${response.statusText}`);
      }

      return await response.json();
    } catch (error) {
      throw new Error(`Failed to query skill ${skillName}: ${error.message}`);
    }
  }

  /**
   * Query the LLM directly
   * @param {string} query - The query/prompt
   * @param {object} options - Query options
   */
  async query(query, options = {}) {
    const payload = {
      query,
      provider: options.provider || this.defaultProvider,
      model: options.model || this.defaultModel,
      temperature: options.temperature || 0.7,
      use_failover: options.useFailover || false,
    };

    try {
      const response = await fetch(
        `${this.routerEndpoint}/query`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        }
      );

      if (!response.ok) {
        throw new Error(`Router error: ${response.status}`);
      }

      return await response.json();
    } catch (error) {
      throw new Error(`Query failed: ${error.message}`);
    }
  }

  /**
   * Get health status of the router and all providers
   */
  async getHealth() {
    try {
      const response = await fetch(`${this.routerEndpoint}/health`);
      return await response.json();
    } catch (error) {
      throw new Error(`Health check failed: ${error.message}`);
    }
  }

  /**
   * Get available models and providers
   */
  async getModels() {
    try {
      const response = await fetch(`${this.routerEndpoint}/models`);
      return await response.json();
    } catch (error) {
      throw new Error(`Failed to get models: ${error.message}`);
    }
  }

  /**
   * Get metrics and statistics
   */
  async getMetrics() {
    try {
      const response = await fetch(`${this.routerEndpoint}/metrics`);
      return await response.json();
    } catch (error) {
      throw new Error(`Failed to get metrics: ${error.message}`);
    }
  }

  /**
   * Compare responses from multiple providers
   */
  async compareProviders(query, providers = ['ollama', 'openrouter']) {
    const results = {};

    for (const provider of providers) {
      try {
        const result = await this.query(query, { provider });
        results[provider] = {
          success: true,
          ...result,
        };
      } catch (error) {
        results[provider] = {
          success: false,
          error: error.message,
        };
      }
    }

    return results;
  }

  /**
   * Streaming query (simulated for fetch API)
   */
  async queryStreaming(query, onChunk, options = {}) {
    const payload = {
      query,
      provider: options.provider || this.defaultProvider,
      model: options.model || this.defaultModel,
      temperature: options.temperature || 0.7,
    };

    try {
      const response = await fetch(
        `${this.routerEndpoint}/query`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        }
      );

      if (!response.ok) {
        throw new Error(`Router error: ${response.status}`);
      }

      const result = await response.json();
      
      // Simulate streaming by returning response in chunks
      const text = result.response;
      const chunkSize = 50;
      
      for (let i = 0; i < text.length; i += chunkSize) {
        onChunk(text.substring(i, i + chunkSize));
        await new Promise(resolve => setTimeout(resolve, 10));
      }

      return result;
    } catch (error) {
      throw new Error(`Streaming query failed: ${error.message}`);
    }
  }
}

// Skills helper
class SubstreamsSkillsAssistant {
  constructor(client) {
    this.client = client;
  }

  /**
   * Ask about Substreams development
   */
  async askDevelopment(question, options = {}) {
    return this.client.querySkill('substreams-dev', question, options);
  }

  /**
   * Ask about SQL sinks
   */
  async askSQL(question, options = {}) {
    return this.client.querySkill('substreams-sql', question, options);
  }

  /**
   * Ask about testing
   */
  async askTesting(question, options = {}) {
    return this.client.querySkill('substreams-testing', question, options);
  }

  /**
   * Ask about building sinks
   */
  async askSinks(question, options = {}) {
    return this.client.querySkill('substreams-sink', question, options);
  }

  /**
   * Ask about Rust programming
   */
  async askRust(question, options = {}) {
    return this.client.querySkill('rust-expert', question, options);
  }
}

// Example usage
if (typeof window === 'undefined') {
  // Node.js usage
  module.exports = { SubstreamsSkillsClient, SubstreamsSkillsAssistant };
}
