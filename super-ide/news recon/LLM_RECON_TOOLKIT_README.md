# LLM Reconnaissance Toolkit - Free Security Research Tools

## Overview

This toolkit provides comprehensive, free tools for discovering and analyzing Large Language Model (LLM) endpoints exposed on the internet. Built for security researchers, journalists, and AI enthusiasts, these tools demonstrate the current state of LLM security and help raise awareness about exposed AI infrastructure.

## 🛠️ Available Tools

### 1. Basic LLM Recon Tool (`llm_recon_tool.py`)
**Purpose**: Entry-level reconnaissance tool for discovering LLM endpoints

**Features**:
- Synchronous HTTP scanning
- Basic provider fingerprinting
- HTML report generation
- Search query generation for free engines

**Usage**:
```bash
python llm_recon_tool.py 192.168.1.0/24 -o basic_report.html
```

### 2. Enhanced LLM Recon Tool (`enhanced_llm_recon.py`)
**Purpose**: Advanced async reconnaissance with comprehensive features

**Features**:
- Asynchronous HTTP scanning with concurrency control
- 12+ LLM provider support (Ollama, LM Studio, OpenAI Compatible, etc.)
- Vulnerability assessment patterns
- Professional HTML/JSON reporting
- Rate limiting and ethical scanning
- Model enumeration capabilities

**Usage**:
```bash
python enhanced_llm_recon.py 10.0.0.0/8 --output enhanced_report.html --json results.json
```

### 3. Advanced LLM Scanner (`advanced_llm_scanner.py`)
**Purpose**: Professional-grade scanner with network tools integration

**Features**:
- Masscan integration for fast port scanning
- Nmap integration for service detection
- Comprehensive API testing (chat completion, embeddings)
- Model enumeration and capability testing
- Advanced vulnerability assessment
- Multi-stage scanning pipeline

**Usage**:
```bash
# Full advanced scan
python advanced_llm_scanner.py 192.168.0.0/16 -o advanced_report.html --api-test

# Fast masscan-only scan
python advanced_llm_scanner.py target.com --no-nmap --rate 50000
```

## 🔍 Supported LLM Providers

The tools can detect and fingerprint the following LLM providers:

1. **Ollama** - Local LLM server
2. **LM Studio** - Desktop LLM interface
3. **OpenAI Compatible** - Generic OpenAI API format
4. **Anthropic Claude** - Anthropic's API endpoints
5. **Hugging Face** - Model hosting platform
6. **Text Generation WebUI** - Gradio-based interface
7. **KoboldAI** - AI writing assistant
8. **vLLM** - High-performance inference
9. **FastChat** - Multi-model chat platform
10. **Petals** - Distributed LLM inference
11. **LocalAI** - Self-hosted AI API
12. **GPT4ALL** - Local chat interface

## 🕵️ Detection Methods

### Network Scanning
- **Port Scanning**: Targets common LLM ports (11434, 1234, 8000, 5000, etc.)
- **Service Fingerprinting**: HTTP header analysis and response patterns
- **API Endpoint Testing**: Standard OpenAI-compatible API paths

### Search Engine Queries
The tools generate search queries for free search engines:
- **Censys**: Certificate and service discovery
- **ZoomEye**: Global service enumeration
- **Shodan**: IoT and service search

Example queries:
```
censys.io: "ollama" AND port:11434
zoomeye.org: "llm" "api" port:8000
shodan.io: "ollama" port:11434
```

## 🧪 Testing Capabilities

### Basic Testing
- HTTP connectivity verification
- Provider identification via headers/responses
- Basic API availability checks

### Advanced Testing
- Model enumeration (`/v1/models`)
- Chat completion API testing
- Embeddings API testing
- Response time analysis
- Error message analysis

### Vulnerability Assessment
- Authentication bypass detection
- Default credential exposure
- API key leakage patterns
- Misconfiguration identification

## 📊 Reporting Features

### HTML Reports
- Professional styling with CSS
- Interactive statistics dashboard
- Endpoint details with vulnerability flags
- Provider breakdown charts
- Timeline analysis

### JSON Export
- Structured data for further analysis
- Compatible with security tools
- API testing results
- Vulnerability findings

### Key Metrics
- Total endpoints discovered
- Providers detected
- Accessible vs. protected endpoints
- Vulnerability severity levels
- Geographic distribution

## ⚠️ Ethical Guidelines

### Responsible Usage
1. **Permission Required**: Only scan networks you own or have explicit permission to test
2. **Rate Limiting**: Respect server resources with built-in delays
3. **No Exploitation**: Tools identify issues but do not exploit them
4. **Educational Focus**: Built for awareness and research, not malicious activity

### Legal Compliance
- Follow local laws regarding network scanning
- Respect robots.txt and API terms of service
- Do not attempt to access restricted systems
- Report findings responsibly to system owners

## 🏗️ Architecture

### Async Design
- Concurrent scanning with semaphore control
- Non-blocking HTTP requests
- Efficient resource utilization
- Timeout handling for reliability

### Modular Components
- Provider definitions in separate modules
- Extensible fingerprinting system
- Plugin architecture for new providers
- Configurable scanning parameters

### Error Handling
- Graceful failure recovery
- Detailed error logging
- Retry mechanisms for transient failures
- Resource cleanup on termination

## 📈 Performance Optimization

### Scanning Strategies
- **Target Prioritization**: Focus on likely LLM ports first
- **Batch Processing**: Group similar targets for efficiency
- **Caching**: Avoid redundant requests
- **Parallel Execution**: Multiple concurrent scans

### Resource Management
- Memory-efficient data structures
- Connection pooling
- Automatic session cleanup
- Configurable concurrency limits

## 🔧 Installation & Setup

### Requirements
```bash
pip install aiohttp requests ipaddress
```

### Optional Tools (for advanced scanner)
```bash
# Ubuntu/Debian
sudo apt install masscan nmap

# macOS
brew install masscan nmap

# Or use Docker
docker run --rm -it instrumentisto/nmap
```

### Quick Start
```bash
# Clone or download the tools
cd llm-recon-toolkit

# Run basic scan
python llm_recon_tool.py localhost -o report.html

# Run enhanced scan
python enhanced_llm_recon.py 192.168.1.0/24 --output enhanced.html --json results.json

# Run advanced scan with all features
python advanced_llm_scanner.py target.network --api-test -o full_report.html
```

## 📚 Educational Resources

### Understanding LLM Security
- **API Exposure**: Many LLM servers run without authentication
- **Default Configurations**: Common setups leave endpoints accessible
- **Network Discovery**: Exposed services can be found through public scanning
- **Risk Assessment**: Exposed LLMs may leak sensitive data or consume resources

### Research Applications
- **Security Awareness**: Demonstrate real-world exposure risks
- **Configuration Auditing**: Help administrators secure their deployments
- **Academic Research**: Study LLM deployment patterns
- **Policy Development**: Inform security policies for AI infrastructure

## 🤝 Contributing

### Adding New Providers
1. Define provider patterns in `llm_providers.py`
2. Add fingerprinting logic
3. Test against known endpoints
4. Update documentation

### Improving Detection
- Submit new search queries
- Add API testing patterns
- Enhance vulnerability checks
- Improve reporting features

## 📄 License & Usage

This toolkit is provided for educational and research purposes only. Users are responsible for complying with applicable laws and obtaining necessary permissions before scanning any networks.

**Remember**: With great scanning power comes great responsibility. Use these tools ethically and help make the AI ecosystem more secure.

---

*Built for the AI security research community. Free tools for a safer AI future.*