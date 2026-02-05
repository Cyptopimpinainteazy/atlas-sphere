# 3aiXchange - Decentralized Exchange on 3ai Chain

3aiXchange is a high-performance decentralized exchange (DEX) built on the 3ai blockchain, featuring an on-chain order book, low-latency trading, and seamless cross-chain asset transfers.

## 🚀 Quick Start

### 1. Launch Your OP Stack Chain

Run locally:
```bash
npx @eth-optimism/bundle dev
```

Or deploy to production with [Conduit](https://conduit.xyz/) or [Caldera](https://caldera.xyz/).

### 2. Install Dependencies

```bash
npm install --save-dev hardhat @openzeppelin/contracts
pip install web3 eth-account python-dotenv
```

### 3. Configure Environment

Copy and update the environment variables:
```bash
cp .env.example .env
# Edit .env with your RPC URLs, private key, and contract addresses
```

### 4. Deploy Orderbook Contract

```bash
npx hardhat run deploy/deploy.js --network optimism-goerli
```

Copy the deployed contract address to your `.env` file as `CONTRACT_ADDRESS`.

### 5. Run the Trading Bot

```bash
python bot/orderbook_bot.py
```

### 6. Bridge Assets (Optional)

Bridge ETH/ERC20 from L1 to your L2:
```bash
node scripts/bridge_deposit.js
```

## 📁 Project Structure

```
3ai/
├── contracts/           # Solidity contracts
│   └── Orderbook.sol    # Main orderbook DEX contract
├── deploy/              # Deployment scripts
│   └── deploy.js        # Hardhat deployment
├── bot/                 # Trading bots
│   └── orderbook_bot.py # Python automated trader
├── scripts/             # Utility scripts
│   └── bridge_deposit.js # Cross-chain bridge depositor
├── .env.example         # Environment configuration template
└── README.md            # This file
```

## 🏗️ Contracts

### Orderbook.sol

Core DEX functionality:

- **Place Orders**: Buy/sell limit orders with ETH or ERC20 tokens
- **Match Orders**: Automated order matching and settlement
- **Cancel Orders**: Refund unmatched orders
- **Price Tracking**: Maintain best bid/ask prices

**Key Features:**
- Reentrancy protection
- Support for ETH and ERC20 pairs
- Event logging for order lifecycle
- Gas-efficient order management

## 🤖 Bot Features

The Python trading bot provides:

- Real-time orderbook monitoring
- Automated limit order placement
- Token approval handling
- Configurable trading strategies
- Gas estimation and error handling
- ETH and ERC20 support

### Bot Strategy

The sample bot implements a basic market making strategy:
- Places buy orders 1% below current best bid
- Places sell orders 1% above current best ask
- Continuously monitors and adjusts positions

## 🌉 Bridge Integration

The bridge script enables seamless cross-chain transfers:

- **ETH Deposits**: Bridge native ETH from L1 to L2
- **ERC20 Deposits**: Bridge tokens across chains
- **Auto-approval**: Handle token approvals automatically
- **Balance Checking**: Verify successful transfers

## 🔧 Configuration

### Environment Variables

| Variable | Description | Example |
|----------|-------------|---------|
| `RPC_URL` | Your chain's RPC endpoint | `http://localhost:8545` |
| `PRIVATE_KEY` | Account private key | `0x1234...` |
| `CONTRACT_ADDRESS` | Deployed orderbook address | `0xabcd...` |
| `BASE_TOKEN` | Base token address (0x0 for ETH) | `0x000...000` |
| `QUOTE_TOKEN` | Quote token address (0x0 for ETH) | `0x000...000` |
| `L1_RPC_URL` | L1 RPC for bridging | `https://eth-mainnet.g.alchemy.com/v2/...` |
| `L2_RPC_URL` | L2 RPC for bridging | `http://localhost:8545` |

## 🧪 Testing

Deploy to a testnet first:

```bash
# Setup Hardhat network
npx hardhat node

# In another terminal
npx hardhat run deploy/deploy.js --network localhost
```

## 🛠️ Extending

### Add Liquidity Mining

Add farming rewards by creating an `OrderbookFarming` contract that distributes tokens based on trading volume.

### Governance Module

Implement voting mechanisms to adjust:
- Trading fees
- Order limits
- Bot permissions

### Advanced Bot Strategies

Enhance the bot with:
- Price prediction algorithms
- Arbitrage detection
- Risk management controls
- Multi-token portfolio balancing

## 🔐 Security

- **Audits**: Consider formal audits for production deployment
- **Access Control**: Add role-based permissions for admin functions
- **Circuit Breakers**: Implement emergency pause mechanisms
- **Rate Limiting**: Prevent transaction spam

## 📚 Resources

- [OP Stack Documentation](https://stack.optimism.io/)
- [Hardhat Documentation](https://hardhat.org/)
- [Web3.py Documentation](https://web3py.readthedocs.io/)
- [OpenZeppelin Contracts](https://docs.openzeppelin.com/contracts/)

## 🤝 Contributing

This is a foundation - customize and extend for your specific use case. The modular design allows easy integration of additional features like governance, staking, or prediction markets.

---

**Built for the decentralized future. 🚀**
