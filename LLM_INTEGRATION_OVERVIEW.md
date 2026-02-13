# Substreams Skills + Ollama + OpenRouter Integration — Complete Solution

This document provides a complete overview of the LLM integration solution for Substreams Skills.

## What's Included

### 📚 Documentation

1. **[QUICK_START_LLM.md](QUICK_START_LLM.md)** — Get running in 2 minutes
2. **[substreams-skills-llm-integration.md](substreams-skills-llm-integration.md)** — Comprehensive guide
3. **[DEPLOYMENT_GUIDE.md](DEPLOYMENT_GUIDE.md)** — Production deployment instructions
4. **[llm-service/README.md](llm-service/README.md)** — Tech reference for LLM service

### 🛠️ Implementation

1. **[llm-service/router.js](llm-service/router.js)** — Main LLM router server
   - Handles requests to both Ollama and OpenRouter
   - Health checks and failover logic
   - Metrics collection and reporting

2. **[llm-service/client.js](llm-service/client.js)** — JavaScript client library
   - Simple API for querying LLMs
   - Helper methods for Substreams skills
   - Built-in error handling and retries

3. **[llm-service/client.py](llm-service/client.py)** — Python client library
   - Same API as JavaScript version
   - Dataclass responses for type safety
   - CLI interface included

4. **[llm-service/examples.js](llm-service/examples.js)** — Usage examples
   - All major features demonstrated
   - Error handling examples
   - Comparison between providers

### ⚙️ Configuration

1. **[llm-config.json](llm-config.json)** — Master configuration
   - Provider settings (Ollama, OpenRouter)
   - Model mappings by use case
   - Failover chain and retry settings
   - Caching and telemetry options

2. **[docker-compose.llm.yml](docker-compose.llm.yml)** — Docker Compose setup
   - Full stack: Ollama + LLM Router
   - Health checks and auto-restart
   - Volume management for model persistence

3. **[Dockerfile.llm-service](Dockerfile.llm-service)** — Container image
   - Minimal Node.js Alpine image
   - Production-ready setup

4. **[k8s-deployment.yaml](k8s-deployment.yaml)** — Kubernetes manifests
   - Ollama StatefulSet with persistent storage
   - LLM Router Deployment with auto-scaling
   - Services, ConfigMaps, and Secrets

### 🚀 Setup Scripts

1. **[setup-llm.sh](setup-llm.sh)** — Interactive setup wizard
   - Checks prerequisites
   - Installs dependencies
   - Configures providers
   - Creates helper scripts

2. **[ollama-init.sh](ollama-init.sh)** — Ollama container initialization
   - Auto-pulls recommended models
   - Waits for service readiness

## Quick Navigation

### I want to...

**Get started immediately**
→ Read [QUICK_START_LLM.md](QUICK_START_LLM.md)

**Understand the architecture**
→ Read [substreams-skills-llm-integration.md](substreams-skills-llm-integration.md#architecture-overview)

**Deploy to production**
→ Read [DEPLOYMENT_GUIDE.md](DEPLOYMENT_GUIDE.md)

**Use the JavaScript client**
→ See [llm-service/client.js](llm-service/client.js) and [examples.js](llm-service/examples.js)

**Use the Python client**
→ See [llm-service/client.py](llm-service/client.py) and read module docstrings

**Query via HTTP API**
→ See [llm-service/README.md](llm-service/README.md#api-endpoints)

**Configure everything**
→ Edit [llm-config.json](llm-config.json) or see [comprehensive guide](substreams-skills-llm-integration.md#advanced-setup)

**Deploy with Docker**
→ Use [docker-compose.llm.yml](docker-compose.llm.yml) or see [Deployment Guide](DEPLOYMENT_GUIDE.md#option-2-docker-compose)

**Deploy to Kubernetes**
→ Use [k8s-deployment.yaml](k8s-deployment.yaml) or see [Deployment Guide](DEPLOYMENT_GUIDE.md#option-3-kubernetes)

**Run examples**
→ Execute [llm-service/examples.js](llm-service/examples.js)

**Troubleshoot issues**
→ Check [DEPLOYMENT_GUIDE.md#troubleshooting-deployment-issues](DEPLOYMENT_GUIDE.md#troubleshooting-deployment-issues)

## Architecture Overview

```
┌─────────────────────────────────────────────────────────────┐
│                    Application Layer                         │
├──────────────────┬──────────────────┬──────────────────────┤
│  JavaScript App  │   Python App     │   HTTP Client        │
└────────┬─────────┴────────┬─────────┴────────────┬─────────┘
         │                  │                      │
         └──────────────────┼──────────────────────┘
                            │
         ┌──────────────────▼──────────────────┐
         │     LLM Router (:3000)              │
         │  (llm-service/router.js)            │
         └──────────────────┬──────────────────┘
                            │
         ┌──────────────────┴──────────────────┐
         │                                     │
    ┌────▼────────┐              ┌────────────▼────┐
    │ Ollama       │              │  OpenRouter     │
    │ (localhost)  │              │  (API)          │
    └─────────────┘              └─────────────────┘
         │                             │
         ├─ mistral (7B)           ├─ GPT-4
         ├─ neural-chat (7B)       ├─ GPT-3.5
         ├─ codellama (7B)         ├─ Mistral 7B
         └─ llama2 (13B)           └─ Claude 3
```

## Key Features

✅ **Dual Provider Support**
- Local: Ollama (no API costs, no internet required)
- Cloud: OpenRouter (access to latest models)

✅ **Intelligent Failover**
- Automatic retry logic
- Fallback to alternative providers
- Configurable failover chain

✅ **Skill-Specific Contexts**
- Substreams development guidance
- SQL database sink expertise
- Testing strategies
- Custom sink implementation
- Rust programming help

✅ **Production Ready**
- Health checks and monitoring
- Metrics collection
- Caching for performance
- Docker and Kubernetes support

✅ **Easy Integration**
- REST API endpoints
- JavaScript client library
- Python client library
- Works with any HTTP client

## System Requirements

### Minimum (Development)
- **CPU**: 2 cores
- **RAM**: 4GB
- **Disk**: 10GB (for Ollama models)

### Recommended (Production)
- **CPU**: 4+ cores
- **RAM**: 16GB
- **Disk**: 50GB+ (for multiple models)
- **GPU**: Optional but recommended (NVIDIA/AMD)

## Model Recommendations

| Model | Size | Speed | Quality | Best For |
|-------|------|-------|---------|----------|
| **phi** | 2.6B | ⚡⚡⚡ | ⭐⭐ | Quick answers |
| **neural-chat** | 3B | ⚡⚡⚡ | ⭐⭐⭐ | Fast development |
| **mistral** | 7B | ⚡⚡ | ⭐⭐⭐⭐ | Balanced (default) |
| **codellama** | 7B | ⚡⚡ | ⭐⭐⭐⭐ | Code generation |
| **llama2:13b** | 13B | ⚡ | ⭐⭐⭐⭐⭐ | Best quality |

## Files Summary

### Documentation Files

| File | Purpose | Read Time |
|------|---------|-----------|
| QUICK_START_LLM.md | Get started in 2 minutes | 5 min |
| substreams-skills-llm-integration.md | Complete technical guide | 30 min |
| DEPLOYMENT_GUIDE.md | Deployment instructions | 20 min |
| llm-service/README.md | API and client reference | 15 min |

### Implementation Files

| File | Lines | Purpose |
|------|-------|---------|
| llm-service/router.js | ~600 | Main server & providers |
| llm-service/client.js | ~250 | JavaScript client |
| llm-service/client.py | ~400 | Python client |
| llm-service/examples.js | ~150 | Usage examples |
| llm-config.json | 100 | Configuration |

### Container & Infrastructure Files

| File | Purpose |
|------|---------|
| docker-compose.llm.yml | Docker Compose stack |
| Dockerfile.llm-service | Container image |
| k8s-deployment.yaml | Kubernetes manifests |
| ollama-init.sh | Ollama initialization |

## Getting Started (3 Steps)

### 1. Run Setup Script
```bash
chmod +x setup-llm.sh && ./setup-llm.sh
```

### 2. Start Services
```bash
# Terminal 1: Ollama
ollama serve

# Terminal 2: LLM Router
npm start
```

### 3. Test
```bash
curl http://localhost:3000/health
```

## Configuration Presets

### Development
- Provider: Ollama (local, fast)
- Model: mistral (balanced)
- Caching: Enabled (600s TTL)
- Retries: 2 attempts

### Staging
- Providers: Ollama primary, OpenRouter fallback
- Models: mistral + GPT-3.5-turbo
- Caching: Enabled (3600s TTL)
- Retries: 3 attempts

### Production
- Providers: Ollama, multiple OpenRouter models
- Caching: Enabled (7200s TTL, 500MB)
- Retries: 5 attempts with exponential backoff
- Health: Continuous monitoring
- Scaling: Auto-scaling enabled (2-10 replicas)

## API Examples

### Direct Query
```bash
curl -X POST http://localhost:3000/query \
  -H "Content-Type: application/json" \
  -d '{
    "query": "How do I optimize a Substreams module?",
    "provider": "ollama"
  }'
```

### Skill Query
```bash
curl -X POST http://localhost/skill/substreams-dev \
  -H "Content-Type: application/json" \
  -d '{"question": "How do store modules work?"}'
```

### Health Check
```bash
curl http://localhost:3000/health
```

## JavaScript Usage
```javascript
const { SubstreamsSkillsClient } = require('./llm-service/client.js');
const client = new SubstreamsSkillsClient();

const result = await client.querySkill(
  'substreams-dev',
  'How do I create a map module?'
);
console.log(result.response);
```

## Python Usage
```python
from llm_service.client import SubstreamsSkillsClient

client = SubstreamsSkillsClient()
result = client.ask_development('How do I optimize a module?')
print(result.response)
```

## Deployment Checklist

Local Development:
- [ ] Node.js 18+ installed
- [ ] Ollama installed and running
- [ ] Dependencies installed with `npm install`
- [ ] LLM Router started with `npm start`
- [ ] Health check passing

Docker:
- [ ] `.env` file created with API keys
- [ ] `docker-compose.llm.yml` configured
- [ ] Services started with `docker-compose up`
- [ ] Health checks passing

Kubernetes:
- [ ] Kubernetes cluster available
- [ ] OpenRouter secret created
- [ ] Manifests applied with `kubectl apply`
- [ ] Pods ready and healthy
- [ ] Service accessible

## Monitoring

### Key Metrics
- Request latency (target: < 5s for Ollama)
- Error rate (target: < 1%)
- Cache hit rate (target: > 50%)
- Model availability (target: 100%)

### Commands
```bash
# Health check
curl http://localhost:3000/health

# Metrics
curl http://localhost:3000/metrics | jq

# Models
curl http://localhost:3000/models | jq
```

## Troubleshooting

### Service won't start
1. Check port 3000 is available
2. Verify Node.js version (18+)
3. Check dependencies installed
4. Review error logs

### Ollama connection failed
1. Verify Ollama is running
2. Check endpoint accessible
3. Ensure model is pulled
4. Restart Ollama

### Slow responses
1. Check system resources
2. Use lighter model (neural-chat)
3. Enable caching
4. Monitor metrics

### High memory usage
1. Reduce model size
2. Limit batch processing
3. Enable caching
4. Monitor with `top`

## Next Steps

1. **Try it**: Run `./setup-llm.sh && npm start`
2. **Test it**: Visit `http://localhost:3000/health`
3. **Use it**: Integrate with your application
4. **Deploy it**: Follow [DEPLOYMENT_GUIDE.md](DEPLOYMENT_GUIDE.md)
5. **Optimize it**: Monitor metrics and tune configuration

## Support Resources

- **Quick Start**: [QUICK_START_LLM.md](QUICK_START_LLM.md)
- **Technical Details**: [substreams-skills-llm-integration.md](substreams-skills-llm-integration.md)
- **Deployment**: [DEPLOYMENT_GUIDE.md](DEPLOYMENT_GUIDE.md)
- **API Reference**: [llm-service/README.md](llm-service/README.md)
- **Examples**: [llm-service/examples.js](llm-service/examples.js)
- **Configuration**: [llm-config.json](llm-config.json)

## License

This integration solution follows the same license as the Substreams project.

---

**Ready to build? Start with [QUICK_START_LLM.md](QUICK_START_LLM.md)! 🚀**
