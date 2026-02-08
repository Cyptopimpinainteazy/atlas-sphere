# Atlas Sphere Testnet v1 - Quick Start Guide

**⚡ Get started with Atlas Sphere Testnet in 5 minutes!**

---

## 🌐 Network Information

| **Parameter**          | **Value**                                  |
|------------------------|--------------------------------------------|
| **Network Name**       | Atlas Sphere Testnet v1                    |
| **Chain ID**           | `atlas-testnet`                            |
| **RPC Endpoint**       | `http://rpc.testnet.atlas-sphere.io:9944`  |
| **WebSocket**          | Coming Soon                                |
| **Faucet**             | `https://faucet.testnet.atlas-sphere.io`   |
| **Block Time**         | ~6 seconds                                 |
| **Consensus**          | Aura + GRANDPA                             |

---

## 💰 Get Test Tokens

### Option 1: Web Faucet (Recommended)
1. Visit: `https://faucet.testnet.atlas-sphere.io`
2. Enter your account address
3. Complete captcha
4. Receive **100 tATLAS** instantly

### Option 2: Discord Bot
```
!faucet <your-address>
```
Join Discord: https://discord.gg/atlas-sphere

**Limits:** 100 tATLAS per request, 1 request per 24 hours per address

---

## 🔌 Connect via RPC

### Health Check
```bash
curl -X POST http://rpc.testnet.atlas-sphere.io:9944 \
  -H "Content-Type: application/json" \
  -d '{
    "id": 1,
    "jsonrpc": "2.0",
    "method": "system_health",
    "params": []
  }'
```

**Expected Response:**
```json
{
  "jsonrpc": "2.0",
  "result": {
    "isSyncing": false,
    "peers": 12,
    "shouldHavePeers": true
  },
  "id": 1
}
```

### Get Chain Info
```bash
curl -X POST http://rpc.testnet.atlas-sphere.io:9944 \
  -H "Content-Type: application/json" \
  -d '{
    "id": 1,
    "jsonrpc": "2.0",
    "method": "system_chain",
    "params": []
  }'
```

---

## 🧪 Try Atlas Kernel RPC Methods

### 1. Get Canonical Balance
```bash
curl -X POST http://rpc.testnet.atlas-sphere.io:9944 \
  -H "Content-Type: application/json" \
  -d '{
    "id": 1,
    "jsonrpc": "2.0",
    "method": "atlasKernel_getCanonicalBalance",
    "params": [
      "5GrwvaEF5zXb26Fz9rcQpDWS57CtERHpNehXCPcNoHGKutQY",
      1,
      null
    ]
  }'
```

**Params:**
- `account` (SS58 address): Account to query
- `asset_id` (number): Asset ID (1 = native token)
- `at` (optional block hash): Query at specific block

### 2. List Authorized Accounts
```bash
curl -X POST http://rpc.testnet.atlas-sphere.io:9944 \
  -H "Content-Type: application/json" \
  -d '{
    "id": 1,
    "jsonrpc": "2.0",
    "method": "atlasKernel_getAuthorizedAccounts",
    "params": [null]
  }'
```

### 3. Check Authorization Status
```bash
curl -X POST http://rpc.testnet.atlas-sphere.io:9944 \
  -H "Content-Type: application/json" \
  -d '{
    "id": 1,
    "jsonrpc": "2.0",
    "method": "atlasKernel_isAuthorized",
    "params": [
      "5GrwvaEF5zXb26Fz9rcQpDWS57CtERHpNehXCPcNoHGKutQY",
      null
    ]
  }'
```

### 4. Get Current Validators
```bash
curl -X POST http://rpc.testnet.atlas-sphere.io:9944 \
  -H "Content-Type: application/json" \
  -d '{
    "id": 1,
    "jsonrpc": "2.0",
    "method": "atlasKernel_getAuthorities",
    "params": [null]
  }'
```

### 5. Get Asset Metadata
```bash
curl -X POST http://rpc.testnet.atlas-sphere.io:9944 \
  -H "Content-Type: application/json" \
  -d '{
    "id": 1,
    "jsonrpc": "2.0",
    "method": "atlasKernel_getAssetMetadata",
    "params": [1, null]
  }'
```

---

## 📦 Submit a Comit (Cross-Domain Transaction)

### Step 1: Create Comit Payload
```json
{
  "nonce": 1,
  "evm_calls": [
    {
      "to": "0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb",
      "value": "1000000000000000000",
      "data": "0x"
    }
  ],
  "svm_instructions": [],
  "fee": 10000,
  "signature": "0x..."
}
```

### Step 2: Submit via Extrinsic
```bash
# Using polkadot.js CLI
polkadot-js-api tx.atlasKernel.submitComit \
  --seed "//Alice" \
  --params '[{"nonce":1,"evm_calls":[],"svm_instructions":[],"fee":10000}]' \
  --ws ws://rpc.testnet.atlas-sphere.io:9944
```

**Note:** WebSocket support coming soon; use local node for now.

---

## 🛠️ Run Local Node (Connect to Testnet)

### Option 1: Binary Release
```bash
# Download latest release
wget https://github.com/atlas-sphere/atlas-sphere-node/releases/latest/download/atlas-sphere-node-linux-amd64

# Make executable
chmod +x atlas-sphere-node-linux-amd64

# Run testnet sync
./atlas-sphere-node-linux-amd64 \
  --chain testnet \
  --bootnodes /dns/bootnode.testnet.atlas-sphere.io/tcp/30333/p2p/12D3KooWEyoppNCUx8Yx66oV9fJnriXwCcXwDDUA2kj6vnc6iDEp \
  --rpc-port 9944
```

### Option 2: Build from Source
```bash
# Clone repository
git clone https://github.com/atlas-sphere/atlas-sphere-node.git
cd atlas-sphere-node

# Build release
cargo build --release

# Run testnet sync
./target/release/atlas-sphere-node \
  --chain testnet \
  --bootnodes /dns/bootnode.testnet.atlas-sphere.io/tcp/30333/p2p/12D3KooWEyoppNCUx8Yx66oV9fJnriXwCcXwDDUA2kj6vnc6iDEp
```

---

## 📚 Available RPC Methods

### Standard Substrate RPC
- `system_health` - Node health status
- `system_chain` - Chain name
- `system_version` - Node version
- `chain_getBlock` - Get block by hash
- `chain_getBlockHash` - Get block hash by number
- `state_getStorage` - Query storage directly

### Atlas Kernel RPC
- `atlasKernel_getCanonicalBalance` - Query canonical ledger balance
- `atlasKernel_getAssetMetadata` - Get asset symbol and decimals
- `atlasKernel_isAuthorized` - Check authorization status
- `atlasKernel_getAuthorizedAccounts` - List authorized accounts
- `atlasKernel_getAuthorities` - Get current validator set

---

## ⚠️ Important Limitations (Testnet v1)

1. **Mock VM Execution**: EVM and SVM executors use mock receipts; real execution coming in v2
2. **HTTP Only**: WebSocket RPC support coming soon
3. **No Economic Value**: tATLAS tokens have no real-world value
4. **Network Resets**: Testnet may be reset without notice during development
5. **Rate Limits**: Faucet limited to 100 tATLAS per 24 hours
6. **Public RPC Limits**: 1000 requests/minute per IP

---

## 🆘 Troubleshooting

### "Connection refused" Error
- Check RPC endpoint URL (must include port `:9944`)
- Verify network connectivity
- Try fallback RPC: `http://rpc2.testnet.atlas-sphere.io:9944`

### "Insufficient balance" Error
- Request tokens from faucet
- Check balance with `atlasKernel_getCanonicalBalance`
- Wait for faucet cooldown (24 hours)

### Node Won't Sync
- Check bootnodes are reachable
- Ensure firewall allows port 30333
- Try different bootnode from list in `docs/reports/TESTNET_DEPLOYMENT_GUIDE.md`

### RPC Returns "Method not found"
- Verify method name spelling (case-sensitive)
- Check if method is Atlas Kernel-specific (`atlasKernel_` prefix)
- Ensure using JSON-RPC 2.0 format

---

## 🤝 Join the Community

- **Discord**: https://discord.gg/atlas-sphere
- **Telegram**: https://t.me/atlas_sphere
- **GitHub**: https://github.com/atlas-sphere/atlas-sphere-node
- **Twitter**: https://twitter.com/atlas_sphere
- **Forum**: https://forum.atlas-sphere.io

---

## 📖 Additional Resources

- **Full Deployment Guide**: `docs/reports/TESTNET_DEPLOYMENT_GUIDE.md`
- **Technical Architecture**: `docs/ARCHITECTURE.md`
- **API Documentation**: `README.md` (sections 10-13)
- **Testnet Announcement**: `docs/reports/TESTNET_ANNOUNCEMENT.md`

---

## 🚀 Next Steps

1. ✅ Get test tokens from faucet
2. ✅ Try Atlas Kernel RPC methods
3. ✅ Submit your first Comit
4. ✅ Run a local sync node
5. ✅ Join Discord and share feedback
6. ✅ Star the GitHub repo
7. ✅ Build an app on Atlas Sphere!

**Happy Building! 🎉**
