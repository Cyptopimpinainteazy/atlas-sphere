# Solana Flashloan Arbitrage Bot

A production-ready, high-performance arbitrage trading bot for Solana that leverages flashloans to execute atomic arbitrage across multiple DEXs including Raydium, Orca, Serum, and Jupiter.

## 🚀 Features

### Core Functionality
- **Atomic Flashloan Arbitrage**: Borrow assets via Solend flashloans and repay in the same transaction
- **Multi-DEX Integration**: Supports Raydium (AMM), Orca (Whirlpool), Serum (Orderbook), and Jupiter (Aggregator)
- **Multi-Hop Arbitrage**: Complex arbitrage paths spanning multiple DEXs and token pairs
- **Real-time Price Monitoring**: Continuous price feeds from multiple sources with failover
- **Production-Ready**: Comprehensive error handling, logging, and safety features

### Safety & Risk Management
- **Profit Threshold Validation**: Minimum profit requirements to prevent loss-making trades
- **Slippage Protection**: Configurable slippage limits with dynamic adjustment
- **Circuit Breakers**: Automatic shutdown on repeated losses or system failures
- **Emergency Unwind**: Stop-loss mechanisms to protect capital
- **Position Size Limits**: Maximum exposure controls per trade and token

### MEV Protection
- **Sandwich Detection**: Advanced detection of sandwich attack patterns
- **Transaction Simulation**: Pre-execution simulation to validate trades
- **Randomized Timing**: Anti-pattern timing to avoid front-running
- **Priority Fees**: Dynamic priority fee adjustment for faster inclusion
- **Transaction Bundling**: Bundle multiple transactions for better execution

### Performance & Reliability
- **RPC Failover**: Multiple RPC endpoints with automatic failover
- **Exponential Backoff**: Smart retry logic with progressive delays
- **Transaction Monitoring**: Real-time confirmation tracking with timeouts
- **SQLite Persistence**: Trade history and performance metrics storage
- **Health Monitoring**: Comprehensive system health checks

## 🏗️ Architecture

### On-Chain Components (Anchor/Rust)
- **FlashloanReceiver**: Manages flashloan borrowing/repayment and arbitrage execution
- **ArbEngine**: Handles multi-DEX routing, price discovery, and trade execution

### Off-Chain Components (Python)
- **Arbitrage Daemon**: Main monitoring and execution engine
- **Price Feed Manager**: Aggregates prices from Jupiter, Pyth, and Switchboard
- **DEX Price Manager**: Specialized price fetching for each DEX
- **Transaction Builder**: Constructs atomic flashloan transactions
- **MEV Protector**: Implements anti-MEV measures

## 📋 Prerequisites

### System Requirements
- **Linux/macOS** (Windows via WSL)
- **Rust** 1.70+
- **Anchor CLI** 0.28+
- **Solana CLI** 1.16+
- **Node.js** 18+
- **Python** 3.9+
- **SQLite3**

### Wallet Setup
```bash
# Install Solana CLI
sh -c "$(curl -sSfL https://release.solana.com/v1.16.0/install)"

# Create wallet
solana-keygen new --outfile ~/.config/solana/id.json

# Fund wallet (testnet/devnet)
solana airdrop 2

# Or fund mainnet wallet with SOL
```

## 🚀 Quick Start

### 1. Clone and Setup
```bash
git clone <repository>
cd solana-flashloan-arb-bot

# Make scripts executable
chmod +x deploy.sh stop.sh
```

### 2. Install Dependencies
```bash
# Install Python dependencies
cd python-services
python3 -m venv venv
source venv/bin/activate
pip install -r arb_daemon/requirements.txt

# Install Node.js dependencies (if needed)
cd ../anchor
npm install
```

### 3. Configure Environment
```bash
# Copy and edit configuration
cp python-services/arb_daemon/config.yaml.example python-services/arb_daemon/config.yaml

# Edit wallet private key and other settings
nano python-services/arb_daemon/config.yaml
```

### 4. Deploy to Mainnet
```bash
# Deploy programs and start services
./deploy.sh

# Expected output:
# 🚀 Starting Solana Flashloan Arbitrage Bot Deployment
# ✅ Prerequisites check passed
# ✅ Using wallet: [WALLET_ADDRESS]
# ✅ Programs built successfully
# ✅ Programs deployed successfully
# ✅ Python environment setup complete
# ✅ Configuration files generated
# ✅ Program accounts initialized
# ✅ Services started successfully
# === Deployment Complete! ===
```

## 📊 Monitoring & Management

### View Logs
```bash
# Main daemon logs
tail -f logs/arb_daemon.log

# Trading engine logs
tail -f logs/trading_engine.log

# Error logs only
tail -f logs/arb_daemon_error.log
```

### Check Status
```bash
# Health check
curl http://localhost:8001/health

# View daemon statistics
python3 -c "
import sqlite3
conn = sqlite3.connect('arb_history.db')
cursor = conn.cursor()
cursor.execute('SELECT COUNT(*), SUM(actual_profit) FROM trades WHERE status=\"success\"')
result = cursor.fetchone()
print(f'Successful trades: {result[0]}, Total profit: ${result[1] or 0:.2f}')
conn.close()
"
```

### Stop/Restart Services
```bash
# Stop all services
./stop.sh

# Restart services
./deploy.sh restart

# View running processes
ps aux | grep -E "(arb_daemon|main.py)"
```

## ⚙️ Configuration

### Main Configuration (`python-services/arb_daemon/config.yaml`)

```yaml
# Trading Parameters
trading:
  min_profit_usd: 10.0          # Minimum profit per trade
  slippage_bps: 50              # Maximum slippage (0.5%)
  max_hops: 4                   # Maximum DEX hops per arbitrage
  circuit_breaker_threshold: 3  # Stop after N consecutive losses

# Network Configuration
network:
  mainnet_beta:
    rpc_url: "https://api.mainnet-beta.solana.com"
    fallback_rpcs:
      - "https://solana-api.projectserum.com"
      - "https://rpc.ankr.com/solana"

# Risk Management
risk_management:
  max_concurrent_trades: 3      # Max simultaneous trades
  max_daily_loss: -500.0        # Daily loss limit
  position_size_limits:
    min: 1000000               # Min 0.01 SOL
    max: 1000000000            # Max 1 SOL
```

### Environment Variables
```bash
# Required
export WALLET_PRIVATE_KEY="your_private_key_here"

# Optional
export TELEGRAM_BOT_TOKEN="your_bot_token"      # For alerts
export TELEGRAM_CHAT_ID="your_chat_id"          # For alerts
export LOG_LEVEL="INFO"                         # DEBUG, INFO, WARNING, ERROR
```

## 🔧 Advanced Usage

### Custom Token Pairs
Edit `config.yaml` to add more token pairs:

```yaml
token_pairs:
  - "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v_So11111111111111111111111111111111111111112"  # USDC/SOL
  - "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v_EzfgjvkSwB6Pj8heBvM7wi2GSJweJ7xX5J2jS4K7w"  # USDC/USDT
  - "CUSTOM_TOKEN_MINT_SOL"  # Add your pairs here
```

### DEX-Specific Configuration
Each DEX can be individually enabled/disabled and configured:

```yaml
programs:
  raydium: "675kPX9MHTjS2zt1qfr1NYHuzeLXfQM9H24wFSUt1Mp8"
  orca: "9W959DqEETiGZocYWCQPaJ6sBmUzgfxXfqGeTEdp3aQP"
  serum: "9xQeWvG816bUx9EPjHmaT23yvVM2ZWbrrpZb9PusVFin"
  jupiter: "JUP6LkbZbjS1jKKwapdHNy74zcZ3tLUZoi5QNyVTaV4"
```

### Testing Mode
For testing without real funds:

```yaml
testing:
  enabled: true
  mock_prices: true
  simulate_trades: true
  dry_run: true
```

## 📈 Performance Metrics

### Dashboard
The bot provides real-time metrics accessible via:

```bash
# View current statistics
python3 scripts/dashboard.py

# Sample output:
# Arbitrage Bot Dashboard
# =======================
# Uptime: 2h 15m
# Total Trades: 47
# Successful Trades: 42 (89.4%)
# Failed Trades: 5 (10.6%)
# Total Profit: $127.43
# Win Rate: 89.4%
# Average Profit/Trade: $2.71
# Largest Win: $15.20
# Circuit Breaker Status: Normal
```

### Trade History
All trades are logged to SQLite database with full details:

```sql
-- Query recent trades
SELECT timestamp, simulated_profit, actual_profit, status, tx_signature
FROM trades
WHERE timestamp >= datetime('now', '-1 hour')
ORDER BY timestamp DESC;

-- View profit summary
SELECT
    COUNT(*) as total_trades,
    SUM(CASE WHEN status = 'success' THEN 1 ELSE 0 END) as successful_trades,
    SUM(CASE WHEN status = 'success' THEN actual_profit ELSE 0 END) as total_profit,
    AVG(CASE WHEN status = 'success' THEN actual_profit ELSE NULL END) as avg_profit
FROM trades
WHERE timestamp >= datetime('now', '-24 hours');
```

## 🚨 Safety & Risk Management

### Circuit Breakers
- **Loss Circuit Breaker**: Stops trading after 3 consecutive losses
- **Daily Loss Limit**: Stops when daily loss exceeds threshold
- **Exposure Limits**: Maximum position sizes and token concentrations
- **Emergency Stop**: Manual kill switch via `stop.sh`

### Monitoring Alerts
Configure alerts for critical events:

```yaml
health:
  alerts:
    enabled: true
    telegram_bot_token: "YOUR_BOT_TOKEN"
    telegram_chat_id: "YOUR_CHAT_ID"
    email_smtp: "smtp.gmail.com"
    email_recipients: ["admin@example.com"]
```

### Backup & Recovery
```bash
# Backup database and logs
./scripts/backup.sh

# Restore from backup
./scripts/restore.sh backup_20231201.tar.gz
```

## 🔍 Troubleshooting

### Import Errors After Adding New Instructions

If you encounter import errors like "Export doesn't exist in target module" after adding new instructions to your Anchor program:

1. **Rebuild the Anchor program**:
   ```bash
   npm run anchor-build
   ```

2. **Regenerate the TypeScript client**:
   ```bash
   npm run codama:js
   ```

3. **Clear Next.js cache**:
   ```bash
   rm -rf .next
   ```

4. **Restart the dev server**:
   ```bash
   npm run dev
   ```

### Common Issues

**Programs won't deploy**
```bash
# Check wallet balance
solana balance

# Verify network
solana config get

# Check program sizes
du -h anchor/target/deploy/*.so
```

**RPC connection failures**
```bash
# Test RPC endpoints
curl -s https://api.mainnet-beta.solana.com -X POST -H "Content-Type: application/json" -d '{"jsonrpc":"2.0","id":1,"method":"getVersion"}'

# Switch RPC in config if needed
nano python-services/arb_daemon/config.yaml
```

**No arbitrage opportunities**
- Check token pairs configuration
- Verify DEX program IDs are current
- Monitor logs for price feed issues
- Check if competing bots are active

**High failure rate**
- Increase slippage tolerance
- Reduce minimum profit threshold
- Check for MEV competition
- Verify gas priority fees

### Debug Mode
Enable detailed logging:

```bash
export LOG_LEVEL=DEBUG
./deploy.sh restart
tail -f logs/arb_daemon.log
```

## 🤝 Contributing

### Development Setup
```bash
# Install development dependencies
cd anchor && npm install
cd ../python-services && pip install -r requirements-dev.txt

# Run tests
cd anchor && anchor test
cd ../python-services && python -m pytest

# Format code
cargo fmt  # Rust
black .    # Python
```

### Code Structure
```
├── anchor/                 # On-chain programs
│   ├── programs/
│   │   ├── FlashloanReceiver/  # Flashloan logic
│   │   └── ArbEngine/          # Arbitrage execution
│   └── tests/                  # Program tests
├── python-services/       # Off-chain services
│   ├── arb_daemon/        # Main arbitrage daemon
│   └── trading-engine/    # API server
├── deploy.sh              # Deployment script
├── stop.sh               # Stop script
└── README.md             # This file
```

## 📄 License

This project is licensed under the MIT License - see the LICENSE file for details.

## ⚠️ Disclaimer

This software is for educational and research purposes. Trading cryptocurrencies involves substantial risk of loss. The authors are not responsible for any financial losses incurred through the use of this software. Always test thoroughly on devnet before deploying to mainnet, and never risk more than you can afford to lose.

## 📞 Support

For issues and questions:
- Check the troubleshooting section above
- Review logs for error messages
- Test on devnet first
- Ensure all prerequisites are met

---

**Happy Arbitraging! 🚀**
