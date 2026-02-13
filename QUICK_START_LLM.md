# ⚡ Quick Start: Substreams Skills + Ollama + OpenRouter

Get Substreams skills working with local (Ollama) or cloud (OpenRouter) LLM providers in 2 minutes.

## TL;DR — 3 Commands

```bash
# 1. Run setup
chmod +x setup-llm.sh && ./setup-llm.sh

# 2. In terminal 1: Start Ollama
ollama serve

# 3. In terminal 2: Start LLM Router
npm start

# 4. In terminal 3: Test it
node scripts/test-query.js
```

## Full Setup

### Prerequisites

- **Node.js 18+** — https://nodejs.org
- **Ollama** (optional but recommended) — https://ollama.ai
- **OpenRouter API key** (optional) — https://openrouter.ai

### Option 1: Automated Setup (Recommended)

```bash
chmod +x setup-llm.sh
./setup-llm.sh
```

Follow the prompts to select your providers and configure everything automatically.

### Option 2: Manual Setup

#### 1. Install Ollama

**macOS/Linux:**
```bash
curl -fsSL https://ollama.ai/install.sh | sh
```

**Windows:**
Download from https://ollama.ai/download/windows

**Docker:**
```bash
docker pull ollama/ollama
docker run -d -p 11434:11434 ollama/ollama
```

#### 2. Pull a Model

```bash
# Fast, lightweight (recommended)
ollama pull mistral

# Or try others
ollama pull neural-chat      # Ultra-fast
ollama pull codellama        # Code-focused
ollama pull llama2:7b        # Full-featured
```

#### 3. Set OpenRouter API Key (Optional)

```bash
export OPENROUTER_API_KEY=sk-or-...your-key...

# (Or add to ~/.bashrc / ~/.bash_profile for persistence)
```

#### 4. Install Node Dependencies

```bash
npm install
```

#### 5. Start the Services

```bash
# Terminal 1: Ollama
ollama serve

# Terminal 2: LLM Router
npm start

# Terminal 3: Test
node scripts/test-query.js
```

## Using the Services

### CLI Examples

```bash
# Direct query via HTTP
curl -X POST http://localhost:3000/query \
  -H "Content-Type: application/json" \
  -d '{
    "query": "How do I create a Substreams map module?",
    "provider": "ollama"
  }'

# Health check
curl http://localhost:3000/health

# Get available models
curl http://localhost:3000/models

# Get metrics
curl http://localhost:3000/metrics
```

### JavaScript/Node.js

```javascript
const { SubstreamsSkillsClient } = require('./llm-service/client.js');

const client = new SubstreamsSkillsClient({
  endpoint: 'http://localhost:3000'
});

// Query directly
const result = await client.query(
  'How do I create an efficient map module?',
  { provider: 'ollama' }
);
console.log(result.response);

// Use a specific skill
const skillResult = await client.querySkill(
  'substreams-dev',
  'What are store modules?',
  { provider: 'ollama' }
);
console.log(skillResult.response);

// Helper methods
const dev = await client.askDevelopment('How do I optimize performance?');
const sql = await client.askSQL('Set up PostgreSQL sink');
const test = await client.askTesting('Write unit tests');
const sinks = await client.askSinks('Implement a Python sink');
const rust = await client.askRust('Use Arc<Mutex<T>> safely');
```

### Python

```python
from llm_service.client import SubstreamsSkillsClient

client = SubstreamsSkillsClient(
    endpoint='http://localhost:3000'
)

# Query directly
result = client.query(
    'How do I create an efficient map module?',
    provider='ollama'
)
print(result.response)

# Use a specific skill
skill_result = client.query_skill(
    'substreams-dev',
    'What are store modules?',
    provider='ollama'
)
print(skill_result.response)

# Helper methods
dev = client.ask_development('How do I optimize performance?')
sql = client.ask_sql('Set up PostgreSQL sink')
test = client.ask_testing('Write unit tests')
sinks = client.ask_sinks('Implement a Python sink')
rust = client.ask_rust('Use Arc<Mutex<T>> safely')

# Compare providers
comparison = client.compare_providers(
    'Explain Substreams index modules'
)
print("Ollama:", comparison['ollama']['response'][:200])
print("OpenRouter:", comparison['openrouter']['response'][:200])
```

## Docker Compose (Recommended for Production)

```bash
# Start both Ollama and LLM Router
docker-compose -f docker-compose.llm.yml up

# Or with custom OpenRouter key
OPENROUTER_API_KEY=sk-or-... docker-compose -f docker-compose.llm.yml up

# Stop services
docker-compose -f docker-compose.llm.yml down
```

## Configuration

Edit `llm-config.json` to customize:

```json
{
  "default_provider": "ollama",
  "providers": {
    "ollama": {
      "endpoint": "http://localhost:11434",
      "model": "mistral",
      "temperature": 0.7
    },
    "openrouter": {
      "api_key": "${OPENROUTER_API_KEY}",
      "model": "openai/gpt-3.5-turbo",
      "temperature": 0.7
    }
  }
}
```

## Troubleshooting

### "Connection refused" on port 3000

```bash
# Make sure LLM Router is running
npm start

# Or check if port is already in use
lsof -i :3000
```

### "Failed to connect to Ollama"

```bash
# Make sure Ollama is running
ollama serve

# Check Ollama is accessible
curl http://localhost:11434/api/tags

# Verify model is loaded
ollama list
```

### "OpenRouter API key not set"

```bash
export OPENROUTER_API_KEY=sk-or-...your-key...

# Verify it's set
echo $OPENROUTER_API_KEY
```

### Slow responses

```bash
# Check available models
ollama list

# Try a lighter model
# Instead of: mistral (4GB)
# Use: neural-chat (3GB, faster)

ollama pull neural-chat
```

### High CPU/memory usage

- Use a smaller model (neural-chat, phi)
- Reduce `temperature` in config
- Limit `max_tokens` in requests

## Model Recommendations

### By Speed/Quality Trade-off

| Model | Size | Speed | Quality | Use Case |
|-------|------|-------|---------|----------|
| **phi** | 2.6B | ⚡⚡⚡ | ⭐⭐ | Quick questions |
| **neural-chat** | 3B | ⚡⚡⚡ | ⭐⭐⭐ | Fast answers |
| **mistral** | 7B | ⚡⚡ | ⭐⭐⭐⭐ | Balanced (default) |
| **codellama** | 7B | ⚡⚡ | ⭐⭐⭐⭐ | Code generation |
| **llama2:13b** | 13B | ⚡ | ⭐⭐⭐⭐⭐ | Best quality |

### By Memory Requirements

```
<4GB:   phi, neural-chat
4-6GB:  mistral, codellama, openhermes
6-8GB:  llama2:13b, mistral:13b
8GB+:   Larger models
```

## Architecture

```
Your Code
   │
   ├─► JavaScript Client
   │   └─► llm-service/client.js
   │
   ├─► Python Client
   │   └─► llm-service/client.py
   │
   └─► HTTP API
       └─► http://localhost:3000
           │
           ├─► POST /query
           ├─► POST /skill/<name>
           ├─► GET /health
           ├─► GET /models
           └─► GET /metrics
           │
           ├─► Ollama Provider
           │   └─► http://localhost:11434
           │
           └─► OpenRouter Provider
               └─► https://openrouter.dev/api/v1
```

## Performance Tips

1. **Use local Ollama first** — Faster, no API costs
2. **Cache responses** — Enable caching in config
3. **Use appropriate models** — Don't use GPT-4 for simple questions
4. **Batch queries** — Group related requests
5. **Monitor metrics** — Check `/metrics` endpoint

## Next Steps

- 📖 Read [Comprehensive Guide](substreams-skills-llm-integration.md)
- 🔧 Configure [Advanced Settings](llm-config.json)
- 📊 Monitor [Metrics & Health](http://localhost:3000/metrics)
- 🚀 Deploy to [Production](). (See Docker Compose setup)

## Support

- **Issues?** Check [Troubleshooting](#troubleshooting) above
- **Questions?** See [Comprehensive Guide](substreams-skills-llm-integration.md#advanced-setup)
- **Feedback?** Open an issue or PR

---

**Happy learning! 🚀**
