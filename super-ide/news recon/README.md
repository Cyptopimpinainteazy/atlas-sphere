# News Recon - LLM Reconnaissance Toolkit

## 📁 Organized for Newspaper Article Research

This folder contains the complete LLM (Large Language Model) reconnaissance toolkit developed for investigating AI infrastructure security and exposure.

## 🛠️ Contents

### **Core Tools:**
- `llm_recon_tool.py` - Basic synchronous scanner
- `enhanced_llm_recon.py` - Advanced async scanner with 12+ providers
- `advanced_llm_scanner.py` - Professional scanner with masscan/nmap integration
- `demo_llm_recon.py` - Educational demonstration script
- `llm_providers.py` - Provider definitions and configurations

### **Documentation:**
- `LLM_RECON_TOOLKIT_README.md` - Complete toolkit documentation
- `README_LLM_RECON.md` - Detailed usage guide

### **Generated Reports:**
- `basic_scan.html` - Results from basic scanner
- `enhanced_scan.html` - Results from enhanced scanner
- `advanced_scan.html` - Results from advanced scanner
- `enhanced_scan.json` - JSON export from enhanced scanner
- `test_advanced_report.html` - Test report from advanced scanner

## 🚀 Quick Start

```bash
cd "news recon"

# Run the educational demo
python demo_llm_recon.py

# Run basic scan
python llm_recon_tool.py target.network -o report.html

# Run enhanced scan with JSON export
python enhanced_llm_recon.py target.network -o report.html --json results.json

# Run advanced scan (requires masscan/nmap for full features)
python advanced_llm_scanner.py target.network -o full_report.html --api-test
```

## 🎯 For Newspaper Article

This toolkit demonstrates:
- How LLM infrastructure can be discovered using free tools
- Security risks of exposed AI endpoints
- Importance of AI infrastructure security
- Ethical security research methodologies

## ⚠️ Ethical Usage

- Only scan networks you own or have explicit permission to test
- Respect rate limits and server resources
- Report findings responsibly to system owners
- Use for educational and security awareness purposes

## 📊 Proven Results

All tools successfully tested on real infrastructure, discovering:
- Ollama servers running locally
- API endpoints without authentication
- Model enumeration capabilities
- Service fingerprinting details

---

*Developed for AI security awareness and responsible disclosure journalism*</content>
<parameter name="filePath">/home/lojak/Desktop/super-ide/news recon/README.md