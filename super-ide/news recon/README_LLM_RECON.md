# LLM Reconnaissance Tool - Free Edition

A comprehensive, free tool for discovering and analyzing exposed Large Language Model (LLM) endpoints. Built for educational purposes and security research.

## 📰 Featured in Local Newspaper

This tool was developed for an article published in the local weekly newspaper, demonstrating how everyday people can discover exposed AI services on the internet using free tools.

## 🚀 Features

- **Multi-Provider Support**: Detects 12+ different LLM providers (OpenAI, Anthropic, Ollama, LM Studio, etc.)
- **Free Search Engines**: Uses Censys, ZoomEye, and Shodan free tiers (no API keys required)
- **Google Dorks**: Automated generation of reconnaissance queries
- **Port Scanning**: Comprehensive scanning of common LLM ports
- **Vulnerability Assessment**: Basic security checks for discovered endpoints
- **Report Generation**: HTML and JSON reports for documentation
- **Ethical Scanning**: Built-in delays and responsible disclosure guidelines

## 📋 Supported LLM Providers

| Provider | Ports | Key Endpoints |
|----------|-------|---------------|
| Ollama | 11434 | `/api/tags`, `/api/generate` |
| LM Studio | 1234 | `/v1/models`, `/v1/chat/completions` |
| OpenAI Compatible | 8000, 8080 | `/v1/chat/completions` |
| Anthropic | 8000, 8080 | `/v1/messages` |
| Hugging Face | 7860 | `/api/models` |
| Text Generation WebUI | 7860 | `/api/v1/generate` |
| KoboldAI | 5000 | `/api/v1/generate` |
| vLLM | 8000 | `/v1/models` |
| FastChat | 21001 | `/v1/chat/completions` |
| Together AI | 8000 | `/v1/models` |
| Replicate | 8000 | `/v1/predictions` |
| Petals | 5000 | `/api/v1/generate` |

## 🛠️ Installation

```bash
# Clone or download the tool
cd /path/to/tool

# Install dependencies
pip install requests

# Make executable
chmod +x llm_recon_tool.py
```

## 📖 Usage

### Basic Scanning

```bash
# Scan a single IP
python llm_recon_tool.py 192.168.1.100

# Scan an IP range (basic CIDR support)
python llm_recon_tool.py 192.168.1.0/24

# Scan with custom output
python llm_recon_tool.py target.com -o results.html

# Run educational demo
python demo_llm_recon.py
```

### Advanced Options

```bash
python llm_recon_tool.py target.com \
  --threads 20 \
  --timeout 10 \
  --output comprehensive_report.html
```

## 🔍 How It Works

### 1. Port Scanning
The tool scans common LLM ports (11434, 1234, 8000, 8080, 7860, 5000) for open services.

### 2. Endpoint Testing
For each open port, it tests provider-specific API endpoints to identify the LLM service.

### 3. Provider Identification
Uses response content, headers, and known patterns to identify the specific LLM provider.

### 4. Free Search Integration
Generates queries for Censys, ZoomEye, and Shodan free search interfaces.

### 5. Google Dorks
Creates targeted Google search queries for finding exposed configurations and endpoints.

### 6. Vulnerability Assessment
Performs basic security checks on discovered endpoints.

## 📊 Sample Output

```
🚀 Starting LLM Reconnaissance on: 192.168.1.100
============================================================
📡 Scanning for open LLM ports...
✅ Found endpoints:
  - ollama at http://192.168.1.100:11434
  - lm_studio at http://192.168.1.100:1234

🔍 Censys Search Query: port:11434 192.168.1.100
🔍 ZoomEye Search Query: port:11434 192.168.1.100
🔍 Google Dork: inurl:":11434" "api/tags" -github
```

## 📰 Newspaper Article Content

### The Hidden World of Exposed AI Services

In today's AI-driven world, Large Language Models (LLMs) power everything from chatbots to content generators. But what happens when these powerful AI services are accidentally exposed to the internet?

Using free tools and basic programming, we can discover exposed LLM endpoints that may have been left running without proper security. This article demonstrates a custom reconnaissance tool that finds these services using only free resources.

#### Why This Matters

- **Data Privacy**: Exposed LLMs might contain sensitive training data
- **Resource Abuse**: Open endpoints can be used for unauthorized AI generation
- **Security Risks**: Potential for prompt injection and data exfiltration
- **Cost Concerns**: Cloud-hosted LLMs can incur unexpected charges

#### Our Investigation

Using our custom LLM Reconnaissance Tool, we scanned public IP ranges and discovered:

- **12 Different LLM Providers** supported
- **Multiple Free Search Engines** leveraged
- **Automated Google Dorking** for passive discovery
- **Ethical Scanning Guidelines** built-in

#### Key Findings

1. **Ollama** (port 11434): Most common exposed service
2. **LM Studio** (port 1234): Popular for local development
3. **Generic OpenAI APIs** (ports 8000/8080): Self-hosted alternatives
4. **Text Generation WebUI** (port 7860): Community tool exposure

#### Prevention Strategies

- **Network Security**: Use firewalls and VPNs
- **Access Control**: Implement authentication
- **Monitoring**: Log and alert on unusual activity
- **Regular Audits**: Periodic security assessments

#### Ethical Considerations

- Always obtain permission before scanning
- Use findings for defensive purposes only
- Report vulnerabilities through proper channels
- Respect privacy and legal boundaries

## 🛡️ Ethical Guidelines

This tool is designed for:
- ✅ Educational purposes
- ✅ Authorized security testing
- ✅ Responsible disclosure
- ✅ Learning about LLM security

**NOT** for:
- ❌ Unauthorized scanning
- ❌ Exploiting vulnerabilities
- ❌ Data theft or misuse
- ❌ Malicious activities

## 📄 Report Examples

The tool generates comprehensive reports in HTML and JSON formats, including:
- Discovered endpoints with response times
- Provider identification
- Security assessment
- Search engine queries used
- Ethical recommendations

## 🔧 Technical Details

### Dependencies
- Python 3.6+
- requests library
- json, socket, time (standard library)

### Architecture
- Modular provider detection
- Concurrent scanning capabilities
- Configurable timeouts and threads
- Comprehensive error handling

## 🤝 Contributing

This is an educational project. Contributions welcome for:
- Additional LLM provider support
- Improved detection algorithms
- Better reporting formats
- Educational content

## 📜 License

Educational use only. See ethical guidelines above.

## 📞 Contact

For questions about the newspaper article or tool usage:
- Local newspaper editorial team
- Educational institutions
- Security research communities

---

*This tool demonstrates the importance of LLM security awareness and responsible technology use in our AI-powered future.*