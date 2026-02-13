# LLM Service for Substreams Skills

Complete LLM provider integration with support for Ollama (local) and OpenRouter (API).

## Directory Structure

```
llm-service/
├── router.js          # Main LLM router server
├── client.js          # JavaScript/Node.js client library
├── client.py          # Python client library
├── examples.js        # Usage examples
└── README.md          # This file
```

## Quick Start

### 1. Start the Router

```bash
npm start
# Or with custom config
node router.js --config ./llm-config.json
```

### 2. Query via HTTP

```bash
curl -X POST http://localhost:3000/query \
  -H "Content-Type: application/json" \
  -d '{
    "query": "What is a Substreams map module?",
    "provider": "ollama"
  }'
```

### 3. Use Client Library

**JavaScript:**
```javascript
const { SubstreamsSkillsClient } = require('./llm-service/client.js');

const client = new SubstreamsSkillsClient();
const result = await client.query('How do I create a Substreams module?');
console.log(result.response);
```

**Python:**
```python
from llm_service.client import SubstreamsSkillsClient

client = SubstreamsSkillsClient()
result = client.query('How do I create a Substreams module?')
print(result.response)
```

## API Endpoints

### POST /query

Query the LLM directly.

**Request:**
```json
{
  "query": "How do I optimize a Substreams module?",
  "provider": "ollama",
  "model": "mistral",
  "temperature": 0.7,
  "use_failover": false
}
```

**Response:**
```json
{
  "provider": "ollama",
  "model": "mistral",
  "response": "To optimize a Substreams module...",
  "responseTime": 2341,
  "tokenEstimate": 245,
  "success": true
}
```

### POST /skill/{skillName}

Query a specific Substreams skill.

**Available Skills:**
- `substreams-dev` — Substreams development guidance
- `substreams-sql` — SQL database sinks
- `substreams-testing` — Testing strategies
- `substreams-sink` — Building custom sinks
- `rust-expert` — Rust programming

**Request:**
```json
{
  "question": "How do I create a store module?",
  "provider": "ollama",
  "temperature": 0.7
}
```

**Response:**
```json
{
  "skill": "substreams-dev",
  "question": "How do I create a store module?",
  "provider": "ollama",
  "model": "mistral",
  "response": "A store module in Substreams...",
  "responseTime": 1856,
  "tokenEstimate": 198,
  "success": true
}
```

### GET /health

Check router and provider health.

**Response:**
```json
{
  "status": "healthy",
  "provider": "ollama",
  "timestamp": "2024-01-10T10:30:00Z"
}
```

### GET /models

Get available models and providers.

**Response:**
```json
{
  "ollama": {
    "type": "ollama",
    "endpoint": "http://localhost:11434",
    "default_model": "mistral",
    "available": true
  },
  "openrouter": {
    "type": "openrouter",
    "endpoint": "https://openrouter.dev",
    "default_model": "openai/gpt-3.5-turbo",
    "available": false
  }
}
```

### GET /metrics

Get performance metrics and statistics.

**Response:**
```json
{
  "uptime_ms": 3600000,
  "total_queries": 142,
  "providers": {
    "ollama": {
      "queries": 140,
      "failures": 2,
      "avgTime": 2156,
      "totalTokens": 28450
    }
  },
  "recent_queries": [...]
}
```

## JavaScript Client

### SubstreamsSkillsClient

```javascript
const { SubstreamsSkillsClient, SubstreamsSkillsAssistant } = require('./client.js');

// Initialize
const client = new SubstreamsSkillsClient({
  endpoint: 'http://localhost:3000',
  defaultProvider: 'ollama',
  timeout: 30000
});

// Direct query
const result = await client.query(
  'How do I create an efficient module?',
  { provider: 'ollama', temperature: 0.7 }
);

// Skill-specific query
const skillResult = await client.querySkill(
  'substreams-dev',
  'How do store modules work?',
  { provider: 'ollama' }
);

// Helper methods
const dev = await client.query('Development question');
const sql = await client.querySkill('substreams-sql', 'SQL question');
const test = await client.querySkill('substreams-testing', 'Testing question');
const sinks = await client.querySkill('substreams-sink', 'Sink question');
const rust = await client.querySkill('rust-expert', 'Rust question');

// Get health
const health = await client.getHealth();

// Get models
const models = await client.getModels();

// Get metrics
const metrics = await client.getMetrics();

// Compare providers
const comparison = await client.compareProviders('Test query');
```

### SubstreamsSkillsAssistant

```javascript
const { SubstreamsSkillsAssistant } = require('./client.js');

const assistant = new SubstreamsSkillsAssistant(client);

// Helper methods for common tasks
const dev = await assistant.askDevelopment('How do I...?');
const sql = await assistant.askSQL('How do I...?');
const test = await assistant.askTesting('How do I...?');
const sinks = await assistant.askSinks('How do I...?');
const rust = await assistant.askRust('How do I...?');
```

## Python Client

### SubstreamsSkillsClient

```python
from llm_service.client import SubstreamsSkillsClient, SubstreamsSkillsAssistant

# Initialize
client = SubstreamsSkillsClient(
    endpoint='http://localhost:3000',
    default_provider='ollama',
    timeout=30
)

# Direct query
result = client.query(
    'How do I create an efficient module?',
    provider='ollama',
    temperature=0.7
)
print(result.response)

# Skill-specific query
skill_result = client.query_skill(
    'substreams-dev',
    'How do store modules work?',
    provider='ollama'
)
print(skill_result.response)

# Helper methods
dev = client.ask_development('Development question')
sql = client.ask_sql('SQL question')
test = client.ask_testing('Testing question')
sinks = client.ask_sinks('Sink question')
rust = client.ask_rust('Rust question')

# Get health
health = client.get_health()

# Get models
models = client.get_models()

# Get metrics
metrics = client.get_metrics()

# Compare providers
comparison = client.compare_providers('Test query')
```

### SubstreamsSkillsAssistant

```python
assistant = SubstreamsSkillsAssistant(client)

# Helper methods for common tasks
dev = assistant.help_with_manifest('How do I...?')
rust = assistant.help_with_rust_module('How do I...?')
protobuf = assistant.help_with_protobuf('How do I...?')
sql = assistant.help_with_sql_sink('How do I...?')
test = assistant.help_with_testing('How do I...?')
comparison = assistant.compare_models('Test query')
```

## Configuration

Edit `llm-config.json` to customize providers, models, and settings.

### Key Parameters

| Parameter | Type | Example | Description |
|-----------|------|---------|-------------|
| `default_provider` | string | `ollama` | Default LLM provider |
| `providers[].endpoint` | string | `http://localhost:11434` | Provider endpoint URL |
| `providers[].model` | string | `mistral` | Default model name |
| `providers[].temperature` | number | `0.7` | Sampling temperature (0-1) |
| `providers[].timeout_ms` | number | `30000` | Request timeout in ms |
| `model_mappings` | object | {...} | Model aliases for different use cases |
| `failover_chain` | array | [...] | Fallback providers if primary fails |
| `retry_config.max_retries` | number | `3` | Max retry attempts |
| `caching.enabled` | boolean | `true` | Enable response caching |

## Error Handling

### Client Error Handling

```javascript
try {
  const result = await client.query('Question');
  console.log(result.response);
} catch (error) {
  console.error('Failed:', error.message);
  // Fallback or retry logic
}
```

### Server Error Handling

The router automatically:
- Retries failed requests (configurable)
- Falls back to alternative providers
- Returns detailed error messages
- Logs errors for debugging

## Performance Optimization

### Tips

1. **Use appropriate models** — Don't use GPT-4 for simple questions
2. **Enable caching** — Cache repeated queries
3. **Batch requests** — Group related queries
4. **Monitor metrics** — Review `/metrics` endpoint
5. **Use failover** — Improve reliability with multiple providers

### Response Time Targets

| Provider | Model | Avg First Token | Avg Total Time |
|----------|-------|-----------------|----------------|
| Ollama | mistral (7B) | 100-200ms | 2-5s |
| Ollama | neural-chat (7B) | 80-150ms | 1-3s |
| OpenRouter | GPT-3.5 | 500-1000ms | 5-15s |
| OpenRouter | Mistral 7B | 200-500ms | 2-8s |

## Monitoring

### Health Checks

```bash
# Check router
curl http://localhost:3000/health

# Check Ollama
curl http://localhost:11434/api/tags

# Check OpenRouter
curl -H "Authorization: Bearer $OPENROUTER_API_KEY" \
  https://openrouter.dev/api/v1/auth/key
```

### Metrics

```bash
curl http://localhost:3000/metrics | jq
```

### Logs

```bash
# Check Node.js process
ps aux | grep node

# Check Ollama process
ps aux | grep ollama
```

## Troubleshooting

### "Connection refused" on port 3000

The router process is not running.

```bash
npm start
```

### "Failed to connect to Ollama"

Ollama is not running or accessible.

```bash
# Start Ollama
ollama serve

# Verify connectivity
curl http://localhost:11434/api/tags
```

### "OpenRouter API key not set"

API key is missing or invalid.

```bash
export OPENROUTER_API_KEY=sk-or-...
echo $OPENROUTER_API_KEY  # Verify
```

### Slow Responses

Try:
1. Use a faster model (neural-chat instead of mistral)
2. Check system resources (CPU, memory, GPU)
3. Check network latency (for OpenRouter)
4. Monitor with `top` or system tools

### High Memory Usage

1. Use a smaller model
2. Reduce batch size
3. Enable caching to reduce redundant queries
4. Restart the service

## Examples

See `examples.js` for comprehensive usage examples:

```bash
node llm-service/examples.js
```

## Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `PORT` | 3000 | HTTP server port |
| `OLLAMA_ENDPOINT` | http://localhost:11434 | Ollama endpoint |
| `OPENROUTER_API_KEY` | (none) | OpenRouter API key |
| `DEFAULT_PROVIDER` | ollama | Default provider |
| `LOG_LEVEL` | info | Logging level |

## Deployment

### Docker

```bash
# Single container
docker build -t llm-router -f Dockerfile.llm-service .
docker run -p 3000:3000 llm-router

# With Ollama
docker-compose -f docker-compose.llm.yml up
```

### Kubernetes

```bash
kubectl apply -f k8s-deployment.yaml
kubectl port-forward svc/llm-router 3000:3000 -n substreams-llm
```

## Development

### Adding New Providers

1. Create provider class in `router.js`:

```javascript
class NewProvider {
  async query(prompt, options) {
    // Implementation
  }
  
  async healthCheck() {
    // Health check
  }
}
```

2. Register in `LLMRouter.initializeProviders()`

### Adding New Skills

1. Update `skills` in `llm-config.json`
2. Edit skill context
3. Test via `/skill/<name>` endpoint

## References

- **Ollama** — https://ollama.ai
- **OpenRouter** — https://openrouter.ai
- **Substreams** — https://substreams.streamingfast.io

## Support

- Check [README](../QUICK_START_LLM.md) for quick start
- Read [Comprehensive Guide](../substreams-skills-llm-integration.md)
- Review [Configuration](../llm-config.json)
- Run [Examples](./examples.js)

---

**Happy coding! 🚀**
