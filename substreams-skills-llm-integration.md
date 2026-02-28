# Substreams Skills + Ollama + OpenRouter Integration

Complete guide to enable the StreamingFast Substreams skills with Ollama (local) and OpenRouter (API) LLM providers.

## Architecture Overview

```
┌─────────────────────────────────────────────────────────────────┐
│                    LLM Router Layer                              │
│  ┌──────────────────────────────────────────────────────────┐   │
│  │ Provider Abstraction (ProviderConfig, LLMClient, etc.)   │   │
│  └──────────┬────────────────────────────────┬─────────────┘   │
│             │                                │                  │
│      ┌──────▼──────┐               ┌────────▼────────┐         │
│      │ Ollama       │               │ OpenRouter      │         │
│      │ (Local)      │               │ (API)           │         │
│      └─────────────┘               └─────────────────┘         │
└─────────────────────────────────────────────────────────────────┘
         │                                  │
         ▼                                  ▼
┌──────────────────────┐      ┌────────────────────────┐
│  Local LLM Host      │      │  OpenRouter API        │
│  - Ollama            │      │  - Claude 3            │
│  - Models            │      │  - GPT-4               │
│  - Embeddings        │      │  - Llama, Mistral      │
│  - Tool use          │      │  - Multiple routing    │
└──────────────────────┘      └────────────────────────┘
```

## Quick Start

### 1. Install Ollama (Local Provider)

**macOS/Linux:**
```bash
curl -fsSL https://ollama.ai/install.sh | sh
```

**Windows:**
Download from https://ollama.ai/download/windows

**Docker:**
```bash
docker run -d --name ollama -p 11434:11434 ollama/ollama
```

**Start Ollama service:**
```bash
ollama serve
```

**Pull a model:**
```bash
ollama pull mistral      # Fast, 7B model
ollama pull neural-chat  # Optimized for coding (7B)
ollama pull codellama    # Code-focused (7B)
ollama pull llama2        # Complete model (7B)
ollama pull openhermes    # Open models with tool use (7B)
```

### 2. Set up OpenRouter (API Provider)

**Get API key:**
1. Visit https://openrouter.ai
2. Sign in or create account
3. Copy API key from settings

**Set environment variable:**
```bash
export OPENROUTER_API_KEY=sk-or-...your-key...
```

### 3. Configure Substreams Skills

Create `llm-config.json` in the `substreams-skills` directory:

```json
{
  "default_provider": "ollama",
  "providers": {
    "ollama": {
      "type": "ollama",
      "endpoint": "http://localhost:11434",
      "model": "mistral",
      "temperature": 0.7,
      "system_prompt": "You are an expert Substreams developer. Provide concise, accurate guidance on Substreams development, Rust modules, protobuf schemas, and performance optimization."
    },
    "openrouter": {
      "type": "openrouter",
      "api_key": "${OPENROUTER_API_KEY}",
      "model": "openai/gpt-4-turbo-preview",
      "temperature": 0.7,
      "system_prompt": "You are an expert Substreams developer. Provide concise, accurate guidance on Substreams development, Rust modules, protobuf schemas, and performance optimization."
    }
  },
  "model_mappings": {
    "coding": {
      "ollama": "codellama",
      "openrouter": "meta-llama/llama-2-70b-chat"
    },
    "fast": {
      "ollama": "neural-chat",
      "openrouter": "mistralai/mistral-7b-instruct"
    },
    "balanced": {
      "ollama": "mistral",
      "openrouter": "openai/gpt-3.5-turbo"
    }
  }
}
```

## Advanced Setup

### Docker Compose Setup (Recommended)

Create `docker-compose.yml`:

```yaml
version: '3.8'

services:
  ollama:
    image: ollama/ollama:latest
    container_name: substreams-ollama
    ports:
      - "11434:11434"
    volumes:
      - ollama_data:/root/.ollama
    environment:
      - OLLAMA_HOST=0.0.0.0:11434
    command: serve
    networks:
      - substreams-llm

  substreams-llm-service:
    image: node:20-alpine
    container_name: substreams-llm-router
    working_dir: /app
    volumes:
      - ./substreams-skills:/app
      - ./llm-service:/app/service
    ports:
      - "3000:3000"
    environment:
      - OLLAMA_ENDPOINT=http://ollama:11434
      - OPENROUTER_API_KEY=${OPENROUTER_API_KEY}
      - DEFAULT_PROVIDER=${DEFAULT_PROVIDER:-ollama}
    command: node service/router.js
    depends_on:
      - ollama
    networks:
      - substreams-llm

volumes:
  ollama_data:

networks:
  substreams-llm:
```

**Start:**
```bash
docker-compose up -d
```

### Kubernetes Deployment

Create `k8s-deployment.yaml`:

```yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: ollama-server
  labels:
    app: ollama
spec:
  replicas: 1
  selector:
    matchLabels:
      app: ollama
  template:
    metadata:
      labels:
        app: ollama
    spec:
      containers:
      - name: ollama
        image: ollama/ollama:latest
        ports:
        - containerPort: 11434
        resources:
          requests:
            memory: "8Gi"
            cpu: "2"
          limits:
            memory: "16Gi"
            cpu: "4"
        volumeMounts:
        - name: ollama-storage
          mountPath: /root/.ollama
      volumes:
      - name: ollama-storage
        persistentVolumeClaim:
          claimName: ollama-pvc

---
apiVersion: v1
kind: Service
metadata:
  name: ollama-service
spec:
  selector:
    app: ollama
  ports:
  - protocol: TCP
    port: 11434
    targetPort: 11434
  type: ClusterIP
```

## LLM Provider Implementation

### LLM Router TypeScript/Node.js

Create `llm-service/router.js`:

```javascript
const http = require('http');
const https = require('https');
const fs = require('fs');

// Load configuration
const config = JSON.parse(fs.readFileSync('./llm-config.json', 'utf8'));

class LLMRouter {
  constructor(configPath) {
    this.config = require(configPath);
    this.defaultProvider = this.config.default_provider;
  }

  async route(query, options = {}) {
    const provider = options.provider || this.defaultProvider;
    const model = options.model || this.config.providers[provider].model;
    
    console.log(`[LLMRouter] Routing to ${provider}/${model}: ${query.substring(0, 50)}...`);
    
    if (provider === 'ollama') {
      return this.queryOllama(query, model, options);
    } else if (provider === 'openrouter') {
      return this.queryOpenRouter(query, model, options);
    } else {
      throw new Error(`Unknown provider: ${provider}`);
    }
  }

  async queryOllama(query, model, options) {
    const config = this.config.providers.ollama;
    const endpoint = config.endpoint || 'http://localhost:11434';
    
    return new Promise((resolve, reject) => {
      const payload = JSON.stringify({
        model: model || config.model,
        prompt: query,
        temperature: options.temperature || config.temperature,
        stream: false,
      });

      const url = new URL(`${endpoint}/api/generate`);
      const req = http.request(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Content-Length': Buffer.byteLength(payload),
        },
      }, (res) => {
        let data = '';
        res.on('data', chunk => data += chunk);
        res.on('end', () => {
          try {
            const response = JSON.parse(data);
            resolve({
              provider: 'ollama',
              model: model || config.model,
              response: response.response,
              context: response.context,
            });
          } catch (e) {
            reject(new Error(`Failed to parse Ollama response: ${e.message}`));
          }
        });
      });

      req.on('error', reject);
      req.write(payload);
      req.end();
    });
  }

  async queryOpenRouter(query, model, options) {
    const config = this.config.providers.openrouter;
    const apiKey = config.api_key.replace('${OPENROUTER_API_KEY}', process.env.OPENROUTER_API_KEY);
    
    return new Promise((resolve, reject) => {
      const payload = JSON.stringify({
        model: model || config.model,
        messages: [
          {
            role: 'system',
            content: config.system_prompt,
          },
          {
            role: 'user',
            content: query,
          },
        ],
        temperature: options.temperature || config.temperature,
      });

      const options = {
        hostname: 'openrouter.dev',
        path: '/api/v1/chat/completions',
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Content-Length': Buffer.byteLength(payload),
          'Authorization': `Bearer ${apiKey}`,
        },
      };

      const req = https.request(options, (res) => {
        let data = '';
        res.on('data', chunk => data += chunk);
        res.on('end', () => {
          try {
            const response = JSON.parse(data);
            resolve({
              provider: 'openrouter',
              model: model || config.model,
              response: response.choices[0].message.content,
              usage: response.usage,
            });
          } catch (e) {
            reject(new Error(`Failed to parse OpenRouter response: ${e.message}`));
          }
        });
      });

      req.on('error', reject);
      req.write(payload);
      req.end();
    });
  }
}

// HTTP Server
const router = new LLMRouter('./llm-config.json');

const server = http.createServer(async (req, res) => {
  // CORS
  res.setHeader('Access-Control-Allow-*', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    res.writeHead(200);
    res.end();
    return;
  }

  if (req.url === '/health') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ status: 'healthy', provider: router.defaultProvider }));
    return;
  }

  if (req.url === '/query' && req.method === 'POST') {
    let body = '';
    req.on('data', chunk => body += chunk);
    req.on('end', async () => {
      try {
        const { query, provider, model, temperature } = JSON.parse(body);
        const result = await router.route(query, { provider, model, temperature });
        
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify(result));
      } catch (error) {
        res.writeHead(500, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: error.message }));
      }
    });
    return;
  }

  res.writeHead(404);
  res.end('Not Found');
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`LLM Router listening on port ${PORT}`);
  console.log(`Default provider: ${router.defaultProvider}`);
  console.log(`Available providers: ${Object.keys(router.config.providers).join(', ')}`);
});
```

Create `llm-service/client.js`:

```javascript
class SubstreamsSkillsClient {
  constructor(routerEndpoint = 'http://localhost:3000') {
    this.routerEndpoint = routerEndpoint;
  }

  async querySkill(skillName, query, options = {}) {
    const systemContext = this.getSkillContext(skillName);
    const enhancedQuery = `${systemContext}\n\nUser Query: ${query}`;

    try {
      const response = await fetch(`${this.routerEndpoint}/query`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          query: enhancedQuery,
          provider: options.provider,
          model: options.model,
          temperature: options.temperature || 0.7,
        }),
      });

      if (!response.ok) {
        throw new Error(`Router error: ${response.status}`);
      }

      return await response.json();
    } catch (error) {
      console.error(`Error querying skill ${skillName}:`, error);
      throw error;
    }
  }

  getSkillContext(skillName) {
    const contexts = {
      'substreams-dev': `You are a Substreams development expert. Help with:
        - Building substreams.yaml manifests
        - Writing efficient Rust modules (map, store, index types)
        - Creating protobuf schemas for blockchain data
        - Performance optimization and debugging`,
      
      'substreams-sql': `You are a Substreams SQL expert. Help with:
        - Building SQL database sinks from Substreams data
        - Database Changes (CDC) for real-time consistency
        - Relational mappings and table design
        - PostgreSQL and ClickHouse patterns`,
      
      'substreams-testing': `You are a Substreams testing expert. Help with:
        - Unit testing with real blockchain data
        - Integration testing and end-to-end workflows
        - Performance testing and benchmarking
        - CI/CD integration for automated testing`,
      
      'substreams-sink': `You are a Substreams sink expert. Help with:
        - Building sinks in Python, Go, JavaScript, Rust
        - Cursor management and reorganization handling
        - Error recovery and resilience patterns`,
    };

    return contexts[skillName] || `You are a Substreams expert. Help with Substreams development.`;
  }

  async compareProviders(query) {
    const providers = ['ollama', 'openrouter'];
    const results = {};

    for (const provider of providers) {
      try {
        const result = await this.querySkill('substreams-dev', query, { provider });
        results[provider] = result;
      } catch (error) {
        results[provider] = { error: error.message };
      }
    }

    return results;
  }
}

module.exports = SubstreamsSkillsClient;
```

## Usage Examples

### Direct CLI Usage

```bash
# Query via router
curl -X POST http://localhost:3000/query \
  -H "Content-Type: application/json" \
  -d '{
    "query": "How do I create an efficient map module in Substreams?",
    "provider": "ollama",
    "model": "mistral"
  }'
```

### Node.js Client

```javascript
const SubstreamsSkillsClient = require('./llm-service/client');

const client = new SubstreamsSkillsClient();

// Query Ollama
const result = await client.querySkill('substreams-dev', 
  'How do I create an efficient map module?', 
  { provider: 'ollama' }
);
console.log(result);

// Query OpenRouter
const result2 = await client.querySkill('substreams-dev',
  'Best practices for protobuf schemas?',
  { provider: 'openrouter', model: 'gpt-4' }
);
console.log(result2);

// Compare providers
const comparison = await client.compareProviders(
  'Explain Substreams store modules'
);
console.log('Ollama:', comparison.ollama);
console.log('OpenRouter:', comparison.openrouter);
```

### Python Integration

```python
import requests
import json

class SubstreamsLLMClient:
    def __init__(self, router_url='http://localhost:3000'):
        self.router_url = router_url
    
    def query(self, query, provider='ollama', model=None):
        response = requests.post(
            f'{self.router_url}/query',
            headers={'Content-Type': 'application/json'},
            json={
                'query': query,
                'provider': provider,
                'model': model,
                'temperature': 0.7,
            }
        )
        return response.json()
    
    def get_skill_advice(self, skill_name, question):
        contexts = {
            'substreams-dev': 'You are a Substreams development expert...',
            'substreams-sql': 'You are a Substreams SQL expert...',
            'substreams-testing': 'You are a Substreams testing expert...',
        }
        
        context = contexts.get(skill_name, 'Expert in Substreams.')
        full_query = f'{context}\n\n{question}'
        
        return self.query(full_query)

# Usage
client = SubstreamsLLMClient()
result = client.get_skill_advice(
    'substreams-dev',
    'How do I optimize a map module?'
)
print(result['response'])
```

## Model Recommendations

### By Use Case

| Use Case | Ollama Model | OpenRouter Model | Speed | Quality |
|----------|-------------|------------------|-------|---------|
| **Quick answers** | neural-chat (7B) | mistral-7b-instruct | ⚡⚡⚡ | ⭐⭐⭐ |
| **Code examples** | codellama (7B) | meta-llama/llama-2-70b-chat | ⚡⚡ | ⭐⭐⭐⭐ |
| **Complex logic** | mistral (7B) | openai/gpt-4-turbo | ⚡ | ⭐⭐⭐⭐⭐ |
| **Production** | openhermes (7B) | anthropic/claude-3-opus | ⚡⚡ | ⭐⭐⭐⭐⭐ |

### Local Ollama Models

```bash
# Ultra-fast (3B)
ollama pull phi

# Balanced (7B, recommended)
ollama pull mistral
ollama pull neural-chat
ollama pull codellama

# Powerful (13B+, requires 8GB+ VRAM)
ollama pull llama2:13b
ollama pull mistral:13b
```

## Performance Metrics

### Ollama (Local)

```
Model: mistral (7B)
Endpoint: http://localhost:11434
First token: ~100-200ms
Full response (500 tokens): 2-5s
Memory: 4-6GB

Model: codellama (7B)
First token: ~150-250ms
Full response (500 tokens): 3-7s
Memory: 5-7GB
```

### OpenRouter (API)

```
Model: gpt-4-turbo
First token: 500ms-2s (network latency)
Full response (500 tokens): 5-15s
Cost: $0.01-0.03 per query
Tokens/sec: 10-50

Model: mistral-7b-instruct
First token: 200-500ms
Full response (500 tokens): 2-8s
Cost: $0.0001-0.0007 per query
Tokens/sec: 50-100
```

## Fallback & Failover Strategy

```json
{
  "failover_chain": [
    { "provider": "ollama",    "model": "mistral" },
    { "provider": "ollama",    "model": "neural-chat" },
    { "provider": "openrouter", "model": "mistral-7b-instruct" },
    { "provider": "openrouter", "model": "gpt-3.5-turbo" }
  ],
  "retry_config": {
    "max_retries": 3,
    "backoff_multiplier": 1.5,
    "timeout_ms": 30000
  }
}
```

## Troubleshooting

### Ollama Connection Failed

```bash
# Check if Ollama is running
curl http://localhost:11434/api/tags

# Restart Ollama
killall ollama
ollama serve

# Check model is loaded
ollama list
```

### OpenRouter Authentication Errors

```bash
# Verify API key
echo $OPENROUTER_API_KEY

# Test API key
curl https://openrouter.dev/api/v1/auth/key \
  -H "Authorization: Bearer $OPENROUTER_API_KEY"
```

### Slow Response Times

```bash
# Check Ollama memory
ollama ps

# Monitor system resources
top -p $(pgrep ollama)

# Try smaller model
ollama pull neural-chat  # 5GB
# Instead of
ollama pull mistral  # 4GB but slower GPU offload
```

## Integration Checklist

- [ ] Ollama installed and running (`ollama serve`)
- [ ] Model pulled (`ollama pull mistral`)
- [ ] OpenRouter API key obtained
- [ ] `llm-config.json` created with configuration
- [ ] LLM router service running (`node llm-service/router.js`)
- [ ] Health check passes (`curl http://localhost:3000/health`)
- [ ] Query endpoint responds (`curl -X POST http://localhost:3000/query`)
- [ ] Skills accessible via client library
- [ ] Failover chain configured
- [ ] Tests passing with both providers

## Next Steps

1. **Start with Ollama** — Local, no API costs, good for experimentation
2. **Add OpenRouter** — For production-grade quality and resilience
3. **Monitor usage** — Track model selection, execution times, costs
4. **Optimize prompts** — Refine system prompts for better skill responses
5. **Implement caching** — Cache responses for common queries
6. **Add telemetry** — Log provider selection, model performance

## References

- Ollama: https://ollama.ai
- OpenRouter: https://openrouter.ai
- Substreams: https://substreams.streamingfast.io
- Substreams Skills: https://github.com/streamingfast/substreams-skills
