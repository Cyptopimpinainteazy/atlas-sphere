#!/usr/bin/env node

/**
 * LLM Router for Substreams Skills
 * Routes queries to Ollama (local) or OpenRouter (API)
 * 
 * Usage:
 *   node router.js [--config ./llm-config.json]
 *   PORT=3001 node router.js
 */

const http = require('http');
const https = require('https');
const fs = require('fs');
const path = require('path');

// Configuration loader
class ConfigManager {
  constructor(configPath = './llm-config.json') {
    this.configPath = configPath;
    this.config = this.loadConfig();
    this.validateConfig();
  }

  loadConfig() {
    try {
      const configContent = fs.readFileSync(this.configPath, 'utf8');
      return JSON.parse(configContent);
    } catch (error) {
      console.error(`Failed to load config from ${this.configPath}:`, error.message);
      process.exit(1);
    }
  }

  validateConfig() {
    if (!this.config.providers) {
      throw new Error('Config missing "providers" object');
    }
    if (!this.config.default_provider) {
      throw new Error('Config missing "default_provider"');
    }
  }

  getProvider(name) {
    return this.config.providers[name];
  }

  getSkillContext(skillName) {
    const skill = this.config.skills?.[skillName];
    return skill?.context || 'You are an expert assistant.';
  }
}

// Metrics collector
class MetricsCollector {
  constructor() {
    this.queries = [];
    this.providers = {};
    this.startTime = Date.now();
  }

  recordQuery(provider, model, responseTime, success, tokenEstimate = 0) {
    this.queries.push({
      provider,
      model,
      responseTime,
      success,
      tokenEstimate,
      timestamp: new Date().toISOString(),
    });

    if (!this.providers[provider]) {
      this.providers[provider] = {
        queries: 0,
        failures: 0,
        avgTime: 0,
        totalTokens: 0,
      };
    }

    const p = this.providers[provider];
    p.queries++;
    if (!success) p.failures++;
    p.avgTime = (p.avgTime + responseTime) / 2;
    p.totalTokens += tokenEstimate;
  }

  getMetrics() {
    return {
      uptime_ms: Date.now() - this.startTime,
      total_queries: this.queries.length,
      providers: this.providers,
      recent_queries: this.queries.slice(-10),
    };
  }
}

// LLM providers
class OllamaProvider {
  constructor(config) {
    this.config = config;
    this.endpoint = config.endpoint || 'http://localhost:11434';
  }

  async query(prompt, options = {}) {
    const startTime = Date.now();
    
    const payload = JSON.stringify({
      model: options.model || this.config.model,
      prompt,
      temperature: options.temperature || this.config.temperature,
      top_p: options.top_p || this.config.top_p,
      stream: false,
    });

    return new Promise((resolve, reject) => {
      const url = new URL(`${this.endpoint}/api/generate`);
      const req = http.request(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Content-Length': Buffer.byteLength(payload),
        },
        timeout: this.config.timeout_ms || 30000,
      }, (res) => {
        let data = '';
        res.on('data', chunk => data += chunk);
        res.on('end', () => {
          try {
            const response = JSON.parse(data);
            const responseTime = Date.now() - startTime;
            const tokenEstimate = response.response.split(/\s+/).length;
            
            resolve({
              provider: 'ollama',
              model: options.model || this.config.model,
              response: response.response,
              responseTime,
              tokenEstimate,
              success: true,
              metadata: {
                context: response.context,
                eval_duration: response.eval_duration,
                eval_count: response.eval_count,
                prompt_eval_count: response.prompt_eval_count,
              },
            });
          } catch (error) {
            reject(new Error(`Failed to parse Ollama response: ${error.message}`));
          }
        });
      });

      req.on('error', reject);
      req.on('timeout', () => {
        req.destroy();
        reject(new Error('Ollama request timeout'));
      });
      req.write(payload);
      req.end();
    });
  }

  async healthCheck() {
    return new Promise((resolve) => {
      const url = new URL(`${this.endpoint}/api/tags`);
      const req = http.request(url, { timeout: 5000 }, (res) => {
        resolve(res.statusCode === 200);
      });
      req.on('error', () => resolve(false));
      req.on('timeout', () => resolve(false));
      req.end();
    });
  }
}

class OpenRouterProvider {
  constructor(config) {
    this.config = config;
    this.apiKey = config.api_key.replace('${OPENROUTER_API_KEY}', process.env.OPENROUTER_API_KEY);
    
    if (!this.apiKey || this.apiKey.includes('$')) {
      throw new Error('OPENROUTER_API_KEY environment variable not set');
    }
  }

  async query(prompt, options = {}) {
    const startTime = Date.now();
    
    const payload = JSON.stringify({
      model: options.model || this.config.model,
      messages: [
        {
          role: 'system',
          content: options.systemPrompt || this.config.system_prompt,
        },
        {
          role: 'user',
          content: prompt,
        },
      ],
      temperature: options.temperature || this.config.temperature,
      top_p: options.top_p || this.config.top_p,
    });

    return new Promise((resolve, reject) => {
      const reqOptions = {
        hostname: 'openrouter.dev',
        path: '/api/v1/chat/completions',
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Content-Length': Buffer.byteLength(payload),
          'Authorization': `Bearer ${this.apiKey}`,
          'HTTP-Referer': 'https://substreams-skills.local',
        },
        timeout: this.config.timeout_ms || 60000,
      };

      const req = https.request(reqOptions, (res) => {
        let data = '';
        res.on('data', chunk => data += chunk);
        res.on('end', () => {
          try {
            const response = JSON.parse(data);
            
            if (!response.choices || !response.choices[0]) {
              throw new Error('Invalid OpenRouter response structure');
            }

            const responseTime = Date.now() - startTime;
            const responseText = response.choices[0].message.content;
            const tokenEstimate = (response.usage?.completion_tokens) || responseText.split(/\s+/).length;
            
            resolve({
              provider: 'openrouter',
              model: options.model || this.config.model,
              response: responseText,
              responseTime,
              tokenEstimate,
              success: true,
              metadata: {
                usage: response.usage,
                finish_reason: response.choices[0].finish_reason,
              },
            });
          } catch (error) {
            reject(new Error(`Failed to parse OpenRouter response: ${error.message}`));
          }
        });
      });

      req.on('error', reject);
      req.on('timeout', () => {
        req.destroy();
        reject(new Error('OpenRouter request timeout'));
      });
      req.write(payload);
      req.end();
    });
  }

  async healthCheck() {
    return new Promise((resolve) => {
      const reqOptions = {
        hostname: 'openrouter.dev',
        path: '/api/v1/models',
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${this.apiKey}`,
        },
        timeout: 5000,
      };

      const req = https.request(reqOptions, (res) => {
        resolve(res.statusCode === 200);
      });
      req.on('error', () => resolve(false));
      req.on('timeout', () => resolve(false));
      req.end();
    });
  }
}

// Main LLM Router
class LLMRouter {
  constructor(configPath = './llm-config.json') {
    this.configManager = new ConfigManager(configPath);
    this.config = this.configManager.config;
    this.providers = {};
    this.metrics = new MetricsCollector();

    this.initializeProviders();
  }

  initializeProviders() {
    for (const [name, providerConfig] of Object.entries(this.config.providers)) {
      try {
        if (providerConfig.type === 'ollama') {
          this.providers[name] = new OllamaProvider(providerConfig);
        } else if (providerConfig.type === 'openrouter') {
          this.providers[name] = new OpenRouterProvider(providerConfig);
        }
      } catch (error) {
        console.warn(`Failed to initialize provider "${name}":`, error.message);
      }
    }
  }

  async route(query, options = {}) {
    const provider = options.provider || this.config.default_provider;
    const providerInstance = this.providers[provider];

    if (!providerInstance) {
      throw new Error(`Unknown or unavailable provider: ${provider}`);
    }

    const startTime = Date.now();
    
    try {
      const result = await providerInstance.query(query, options);
      this.metrics.recordQuery(provider, options.model || this.config.providers[provider].model, result.responseTime, true, result.tokenEstimate);
      return result;
    } catch (error) {
      const responseTime = Date.now() - startTime;
      this.metrics.recordQuery(provider, options.model || this.config.providers[provider].model, responseTime, false);
      throw error;
    }
  }

  async routeWithFailover(query, options = {}) {
    const chain = this.config.failover_chain || [];
    let lastError = null;

    for (const fallback of chain) {
      try {
        console.log(`[Failover] Attempting ${fallback.provider}/${fallback.model}`);
        return await this.route(query, {
          ...options,
          provider: fallback.provider,
          model: fallback.model,
        });
      } catch (error) {
        console.warn(`[Failover] ${fallback.provider} failed:`, error.message);
        lastError = error;
      }
    }

    throw lastError || new Error('All providers exhausted');
  }

  async getHealthStatus() {
    const status = {};

    for (const [name, provider] of Object.entries(this.providers)) {
      try {
        status[name] = {
          healthy: await provider.healthCheck(),
          type: this.config.providers[name].type,
        };
      } catch (error) {
        status[name] = {
          healthy: false,
          error: error.message,
        };
      }
    }

    return status;
  }
}

// HTTP Server
class HTTPServer {
  constructor(Router, port = 3000) {
    this.router = Router;
    this.port = port;
  }

  start() {
    const server = http.createServer(this.handleRequest.bind(this));

    server.listen(this.port, () => {
      console.log(`\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
      console.log(`  LLM Router Started`);
      console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
      console.log(`  Port:     ${this.port}`);
      console.log(`  Default:  ${this.router.config.default_provider}`);
      console.log(`  Providers: ${Object.keys(this.router.providers).join(', ')}`);
      console.log(`  Config:   ${path.resolve('./llm-config.json')}`);
      console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n`);
      
      console.log('Available endpoints:');
      console.log('  POST   /query          - Query LLM');
      console.log('  GET    /health         - Health check');
      console.log('  GET    /metrics        - Metrics and statistics');
      console.log('  GET    /models         - Available models');
      console.log('  POST   /skill/<name>   - Query a specific skill');
    });

    return server;
  }

  async handleRequest(req, res) {
    // CORS headers
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
    res.setHeader('Content-Type', 'application/json');

    // Handle CORS preflight
    if (req.method === 'OPTIONS') {
      res.writeHead(200);
      res.end();
      return;
    }

    // Routes
    if (req.url === '/health' && req.method === 'GET') {
      return this.handleHealth(res);
    }

    if (req.url === '/metrics' && req.method === 'GET') {
      return this.handleMetrics(res);
    }

    if (req.url === '/models' && req.method === 'GET') {
      return this.handleModels(res);
    }

    if (req.url === '/query' && req.method === 'POST') {
      return this.handleQuery(req, res);
    }

    if (req.url.startsWith('/skill/') && req.method === 'POST') {
      const skillName = req.url.substring(7);
      return this.handleSkillQuery(req, res, skillName);
    }

    // 404
    res.writeHead(404);
    res.end(JSON.stringify({ error: 'Not Found' }));
  }

  handleHealth(res) {
    res.writeHead(200);
    res.end(JSON.stringify({
      status: 'healthy',
      provider: this.router.config.default_provider,
      timestamp: new Date().toISOString(),
    }));
  }

  handleMetrics(res) {
    res.writeHead(200);
    res.end(JSON.stringify(this.router.metrics.getMetrics(), null, 2));
  }

  handleModels(res) {
    const models = {};
    for (const [name, config] of Object.entries(this.router.config.providers)) {
      models[name] = {
        type: config.type,
        endpoint: config.type === 'ollama' ? config.endpoint : 'https://openrouter.dev',
        default_model: config.model,
        available: this.router.providers[name] ? true : false,
      };
    }
    res.writeHead(200);
    res.end(JSON.stringify(models, null, 2));
  }

  async handleQuery(req, res) {
    let body = '';

    req.on('data', chunk => {
      body += chunk;
      if (body.length > 1024 * 1024) { // 1MB limit
        req.destroy();
        res.writeHead(413, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'Payload too large' }));
      }
    });

    req.on('end', async () => {
      try {
        const { query, provider, model, temperature, use_failover } = JSON.parse(body);

        if (!query) {
          res.writeHead(400, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ error: 'Missing "query" field' }));
          return;
        }

        let result;
        if (use_failover) {
          result = await this.router.routeWithFailover(query, { provider, model, temperature });
        } else {
          result = await this.router.route(query, { provider, model, temperature });
        }

        res.writeHead(200);
        res.end(JSON.stringify(result, null, 2));
      } catch (error) {
        console.error('Query error:', error);
        res.writeHead(500);
        res.end(JSON.stringify({
          error: error.message,
          timestamp: new Date().toISOString(),
        }));
      }
    });

    req.on('error', (error) => {
      res.writeHead(400);
      res.end(JSON.stringify({ error: error.message }));
    });
  }

  async handleSkillQuery(req, res, skillName) {
    let body = '';

    req.on('data', chunk => body += chunk);
    req.on('end', async () => {
      try {
        const { question, provider, model, temperature } = JSON.parse(body);

        if (!question) {
          res.writeHead(400);
          res.end(JSON.stringify({ error: 'Missing "question" field' }));
          return;
        }

        const skillContext = this.router.configManager.getSkillContext(skillName);
        const fullQuery = `${skillContext}\n\nQuestion: ${question}`;

        const result = await this.router.route(fullQuery, { provider, model, temperature });

        res.writeHead(200);
        res.end(JSON.stringify({
          skill: skillName,
          question,
          ...result,
        }, null, 2));
      } catch (error) {
        res.writeHead(500);
        res.end(JSON.stringify({ error: error.message }));
      }
    });
  }
}

// Main
if (require.main === module) {
  const configPath = process.argv[2]?.replace('--config=', '') || './llm-config.json';
  const port = process.env.PORT || 3000;

  try {
    const router = new LLMRouter(configPath);
    const server = new HTTPServer(router, port);
    server.start();
  } catch (error) {
    console.error('Failed to start server:', error.message);
    process.exit(1);
  }
}

module.exports = { LLMRouter, HTTPServer, OllamaProvider, OpenRouterProvider };
