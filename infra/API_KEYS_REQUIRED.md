# Required API Keys for Atlas Sphere MCP Services

## 🎯 **IMMEDIATE - Get These First**

### **Blockchain Infrastructure (Required for basic functionality)**

1. **Infura Project ID** - `YOUR_INFURA_PROJECT_ID`
    - Get from [Infura](https://infura.io)
    - Bundler: <https://bundler.infura.io/v3/YOUR_INFURA_PROJECT_ID>
    - Gas API: <https://gas.api.infura.io/v3/YOUR_INFURA_PROJECT_ID>

1. **CoinGecko API Key** - [CoinGecko API](https://www.coingecko.com/en/api)
    - Free tier: 10,000 requests/month
    - Demo key: `CG-1234567890abcdefghijklmnopqrstuvwxyz` (working)

2. **Dune Analytics API Key** - `YOUR_DUNE_API_KEY`
    - Get from [Dune](https://dune.com)
    - Free tier available
    - Required for blockchain data queries

3. **GoPlus Security API Key** - [GoPlus Labs](https://gopluslabs.io)
    - Free tier for security checks

## ⚠️ **HIGH PRIORITY - For Production Services**

### **RPC & Node Services**

1. **Ethereum RPC Key** (for production workloads)
   - Infura, Alchemy, or QuickNode
   - Higher rate limits than free endpoints

2. **Solana RPC Key**
   - Helius, Triton, or GenesysGo
   - Required for Solana integration

### **Wallet & Security**

1. **Wallet Master Keystore**
   - Generate new Ethereum wallet
   - Fund with test ETH for development

2. **Node Operator Key**
   - Generate validator key for Atlas node
   - Keep secure, used for blockchain operations

## 🔧 **OPERATIONAL KEYS**

### **Database & Storage**

1. **PostgreSQL Password**
   - Generate strong password for database
   - Store in Vault for production

### **Git & Development**

1. **Git SSH Key**
    - Generate SSH key pair: `ssh-keygen -t ed25519`
    - Add to GitHub/GitLab for repo access

2. **Git Token**
    - Personal access token for Git operations
    - GitHub: Settings → Developer settings → Personal access tokens

## 🚀 **ADVANCED FEATURES (Optional)**

### **Trading & DeFi**
12. **DEX API Keys**
    - Uniswap, SushiSwap, Jupiter (if needed)
    - Usually free with rate limits

### **Flash Loans**
13. **Flashloan API Keys**
    - Aave, dYdX (for testing/research only)
    - **⚠️ Use only in development with SAFE_MODE=true**

### **MEV Services**
14. **MEV Operator Key**
    - For MEV bundle submission
    - **⚠️ Requires governance approval for production**

### **Bridge Operations**
15. **Bridge Operator Key**
    - For cross-chain bridge operations
    - **⚠️ Requires multi-sig governance**

### **LLM Services**
1. **OpenAI API Key** - [OpenAI Platform](https://platform.openai.com)
    - Required for strategy evolution features
    - Get from the OpenAI platform

2. **Anthropic API Key** - [Anthropic Console](https://console.anthropic.com)
    - Alternative to OpenAI
    - Get from the Anthropic console

## 📋 **QUICK SETUP CHECKLIST**

### **Development Setup (Minimal)**
- [x] Infura Project ID ✅ **COMPLETED**
- [x] CoinGecko API Key ✅ **WORKING** (demo key)
- [x] Dune Analytics API Key ✅ **COMPLETED**
- [x] GoPlus Security API Key ✅ **WORKING**
- [x] Generate wallet keystore  — helper script added: `scripts/generate_keystore.sh` (template; DO NOT use for production keys).
- [ ] PostgreSQL password
- [ ] Git SSH key + token

### **Production Setup (Full)**
- [ ] All development keys
- [ ] Production RPC endpoints
- [ ] Multi-signature wallet setup
- [ ] HSM for sensitive operations
- [ ] Governance approval process
- [ ] Monitoring and alerting setup

## 🔐 **SECURITY NOTES**

- **Never commit API keys to repositories**
- **Use Vault for all secrets in production**
- **Rotate keys regularly**
- **Monitor API usage and costs**
- **Set up rate limiting and abuse detection**

## 💰 **ESTIMATED COSTS**

- **Free Tier Services**: CoinGecko, Dune, GoPlus, Infura (basic)
- **RPC Services**: $20-100/month depending on usage
- **LLM Services**: $10-50/month for development
- **Premium Features**: Additional costs for high-throughput needs

---

**⚠️ Remember**: Some services require real funds for gas fees. Start with testnets (Goerli, Sepolia, Solana Devnet) before moving to mainnet.
