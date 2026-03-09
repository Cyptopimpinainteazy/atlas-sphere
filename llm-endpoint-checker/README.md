# LLM Endpoint Checker

A GUI application for checking LLM API endpoints using Fyne.

## Requirements

- Go 1.18+
- Python 3.10+
- Linux with GUI support (or X11 forwarding)

## Building

```bash
go mod tidy
go build -o llm-endpoint-checker main.go proxy.go
```

## Running

```bash
./llm-endpoint-checker
```

## Features

- GUI interface for LLM endpoint checking
- Proxy support for anonymous scanning
- Multi-threaded scanning
- **NEW**: Search for LLM endpoints with real-time parsing
- **NEW**: Find exposed Ollama & LM Studio endpoints on local networks
- **NEW**: Web reconnaissance for exposed endpoints on the internet
- **NEW**: GPU resource discovery (miners, data centers, gaming rigs)
- **NEW**: Structured endpoint list display below search log
- Results saved to JSON files

## Search Modes

### 1. General LLM Search
- Searches for public LLM APIs (OpenAI, Anthropic, Google, etc.)
- Uses `scripts/llm_recon.py`
- Button: "Search for Free LLMs (All Types)"

### 2. Ollama & LM Studio Local Discovery
- Scans local network for exposed Ollama (port 11434) and LM Studio (port 1234) instances
- Network scanning with multithreading
- Uses `scripts/ollama_recon.py --search-all`
- Button: "Find Exposed Ollama & LM Studio"

### 3. Web Reconnaissance
- Searches for exposed Ollama and LM Studio endpoints on the internet
- Checks common hosting patterns, cloud providers, domain patterns, and search-engine dorks
- Simulates Shodan-like exposed endpoint discovery
- Uses `scripts/ollama_recon.py --web-only --shodan-sim --cloud-check --domain-patterns`
- `--targets-file <path>` can be supplied to scan a list of known URLs (one per line) obtained from other tools such as Shodan or Onsint
- `--shodan-api-key <key>` will automatically query the Shodan API for exposed LLM hosts (ports 11434/1234) and include them in the scan
- `--osint` enables additional reconnaissance techniques (Wayback Machine URL harvesting, JavaScript scraping, and dork queries) to uncover hidden or deprecated endpoints
- `--github-query` and `--github-token` allow you to run a GitHub code‑search dork straight from the tool; results are scanned automatically
  - **Output parsing**: the tool will fetch each file returned by GitHub and grep for common secret patterns (api_key, bearer tokens, AWS keys, etc.), printing any matches prefixed with `[GH-SECRET]`.
  - You can also dump results to a file and hook up a Flask/HTML dashboard later; the script now outputs raw URLs and matches to stdout for easy consumption.
- The mining scan now also checks for misconfigured Docker (2375/2376) and Kubernetes (10250) management APIs, which frequently denote exposed miner infrastructure or compromised hosts
- Button: "Web Recon for Exposed Endpoints"

_Domain pattern scanning generates likely hostnames and can optionally query search engines (e.g., Bing/Google) with `site:` dorks to discover new targets._

### 4. GPU Resource Discovery
- Finds exposed GPU resources (mining rigs, data centers, gaming PCs)
- Scans mining pools, cloud GPU instances, and gaming/streaming setups
- Detects GPU types, counts, and models where available
- Uses `scripts/ollama_recon.py --gpu-only --mining-only --datacenter-only --gaming-only`
- Button: "Find GPU Resources (Miners/Data Centers/Gamers)"

## Python Scripts

The application uses Python scripts for reconnaissance:

- `scripts/llm_recon.py` - Searches for public LLM API endpoints
- `scripts/ollama_recon.py` - Scans for exposed Ollama/LM Studio instances (local + web)

### ollama_recon.py Options

```bash
# Local network scanning only
python3 scripts/ollama_recon.py --local-only

# Web reconnaissance only (LLM endpoints)  
python3 scripts/ollama_recon.py --web-only --shodan-sim --cloud-check --domain-patterns

# GPU resource discovery only
python3 scripts/ollama_recon.py --gpu-only

# Specific GPU categories
python3 scripts/ollama_recon.py --mining-only      # Mining rigs and pools
python3 scripts/ollama_recon.py --datacenter-only  # Data center GPUs
python3 scripts/ollama_recon.py --gaming-only      # Gaming PCs and streaming rigs

# Combined local + web scanning
python3 scripts/ollama_recon.py --search-all

# Custom options
python3 scripts/ollama_recon.py --range 192.168.1.0/24 --timeout 3 --threads 10
```

**Web Reconnaissance Features:**
- Common hosting patterns (localhost, ollama.local, etc.)
- Cloud provider patterns (AWS, GCP, Azure, DigitalOcean)
- Domain pattern enumeration (ollama.*, ai.*, llm.*, etc.)
- Shodan-like exposed endpoint simulation
- Multi-threaded HTTP verification
- User-agent spoofing for reconnaissance

**GPU Reconnaissance Features:**
- Mining rigs: NiceHash, Ethermine, SparkPool, F2Pool, AntPool
- Data centers: AWS, GCP, Azure GPU instances (simulated)
- Gaming PCs: RTX/GeForce systems, streaming setups
- GPU detection: NVIDIA, AMD, model identification
- Port scanning: Common mining (3333, 4000), monitoring (8080, 9090), gaming (3000-5000)
- Multi-threaded HTTP verification
- User-agent spoofing for reconnaissance

## Network Scanning

The Ollama/LM Studio scanner:
- Scans common local network ranges (192.168.1.0/24, 10.0.0.0/24, etc.)
- Checks default ports (11434 for Ollama, 1234 for LM Studio)
- Uses multithreaded scanning for performance
- Verifies endpoints by making actual API calls
- Supports custom IP ranges with `--range` parameter

## UI Layout

```
[LLM Endpoint Checker Title]
[File Entry] [Order Select]
[Proxy Toggle] [Rotate Proxy]
[Go Button] [Search LLMs] [Find Ollama/LM Studio] [Web Recon] [Find GPUs]
[Status] [Proxy Status]
Search Log:
[Multi-line text area showing real-time search output]
Found Endpoints:
[List widget showing structured endpoint data]
```

- **File Entry**: Path to results JSON file
- **Order Select**: Sort results by Platform/Host/Live/URL
- **Proxy Controls**: Enable proxy mode and rotate proxies
- **Go Button**: Check endpoints from JSON file
- **Search LLMs Button**: Run live search for public LLM endpoints
- **Find Ollama/LM Studio Button**: Scan network for exposed local LLM instances
- **Web Recon Button**: Perform web reconnaissance for exposed endpoints on the internet
- **Find GPUs Button**: Discover GPU resources (miners, data centers, gaming rigs)
- **Search Log**: Real-time output from the search process
- **Found Endpoints**: Structured list of discovered endpoints (Platform - Host - URL)

## Files

- `llm_recon_results.json` - Output from LLM scanning
- `ollama_recon_results.json` - Output from Ollama scanning
- `proxylist.txt` - List of proxy servers

## Security Considerations & Ethical Use

**⚠️ WARNING: This tool is for SECURITY RESEARCH and PENETRATION TESTING only. Unauthorized scanning of networks or systems you do not own may be illegal.**

### Research Findings on LLM Endpoint Exposure

Recent security research has revealed significant vulnerabilities in LLM deployments:

- **Over 1,100 exposed Ollama servers** identified globally, with ~20% actively hosting models
- **No authentication required** on most discovered endpoints, enabling:
  - Unauthorized API access and prompt injection
  - Model extraction attacks (reconstructing model parameters)
  - Jailbreaking and content abuse (generating restricted content)
  - Resource hijacking (free computation at host expense)
  - Backdoor injection and model poisoning

- **Geographic distribution**: US (36.6%), China (22.5%), Germany (8.9%)
- **88.89% use OpenAI-compatible APIs**, enabling automated attack frameworks
- **Uvicorn ASGI server** commonly used, providing secondary fingerprinting indicators

### GPU Resource Security Risks

GPU reconnaissance capabilities reveal additional attack surfaces:

- **Nvidia GPU driver vulnerabilities** (CVE-2025-33217/18/19/20) enable privilege escalation
- **Virtual GPU Manager flaws** allow VM escape in cloud gaming/virtualization platforms
- **Memory safety issues** (use-after-free, integer overflow) in kernel-mode drivers
- **Cross-platform impact** on Windows, Linux, VMware, XenServer, KVM

### AI Agent Security Vulnerabilities

Recent discoveries show AI agents are susceptible to:

- **Prompt injection attacks** via calendar invites, documents, or web content
- **Local file system access** bypassing security controls
- **Command injection** in automation frameworks (MS-Agent CVE-2026-2256)
- **Zero-click exploitation** without user interaction

### Ethical Guidelines

1. **Obtain explicit permission** before scanning any network or system
2. **Use for defensive security** - identify and secure your own exposed endpoints
3. **Report vulnerabilities responsibly** through proper disclosure channels
4. **Avoid resource exhaustion** - respect rate limits and system performance
5. **Protect discovered data** - do not store or share sensitive information
6. **Comply with laws** - unauthorized access is illegal under CFAA and similar laws

### Mitigation Recommendations

For securing LLM deployments:

- **Enforce authentication** - API keys, OAuth2, RBAC
- **Network segmentation** - Firewalls, VPCs, private subnets
- **Rate limiting** - API gateways, abuse detection
- **Disable default ports** - Change from 11434, obfuscate banners
- **Secure model pipelines** - Validate uploads, use signatures
- **Continuous monitoring** - Automated exposure audits

For GPU security:

- **Apply driver patches** immediately for all Nvidia vulnerabilities
- **Isolate virtualized GPUs** - Reduce shared density, strengthen hypervisor controls
- **Monitor kernel activity** - Detect privilege escalation attempts
- **Limit local permissions** - Least privilege on GPU-enabled systems

### Responsible Disclosure

If you discover exposed endpoints:
- Contact the owner through appropriate channels
- Do not attempt to access or modify the systems
- Report to vulnerability disclosure programs
- Consider the impact on system owners and users

**Remember: With great power comes great responsibility. Use this tool ethically and legally.**