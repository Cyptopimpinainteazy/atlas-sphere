# 🏠 In-House Server Deployment Guide

## Quick Overview
Deploy Atlas Sphere testnet on your own hardware/servers with full control and zero cloud costs.

---

## 📋 Server Requirements

### Minimum Specs (Per Node)
- **CPU**: 4 cores (8+ recommended for validators)
- **RAM**: 8GB (16GB+ recommended)
- **Storage**: 100GB SSD (500GB+ for archive nodes)
- **Network**: Static IP, 100Mbps+ bandwidth
- **OS**: Ubuntu 22.04 LTS (or 20.04)

### Network Setup
```bash
Required Ports:
- 30333: P2P (validator/bootnode)
- 9944: RPC/WebSocket (RPC nodes only)
- 9615: Prometheus metrics (optional)
```

---

## 🚀 FASTEST PATH: Single-Server Testnet (DEV MODE)

Perfect for testing everything locally on ONE machine:

```bash
# Already have the binary built!
cd /home/lojak/Desktop/atlas-sphere

# Run in dev mode (single validator, instant blocks)
./target/release/atlas-sphere-node --dev --tmp

# Or with persistent data:
./target/release/atlas-sphere-node --dev \
  --base-path /var/lib/atlas-sphere/dev \
  --rpc-external --rpc-cors all \
  --port 30333 --rpc-port 9944
```

**That's it!** Your testnet is running at:
- **RPC**: http://localhost:9944
- **Explorer**: Connect Polkadot.js to ws://localhost:9944

---

## 🎯 PRODUCTION PATH: Multi-Node In-House Testnet

### Architecture
```
Your In-House Network:
├── Server 1: Bootnode + Validator-01
├── Server 2: Validator-02  
├── Server 3: Validator-03
└── Server 4: RPC Node + Faucet (optional)
```

Or **single server with multiple processes**:
```
One Beefy Server:
├── Process 1: Bootnode (--validator --name bootnode)
├── Process 2: Validator-01 (--validator --name validator-01)
├── Process 3: Validator-02 (--validator --name validator-02)
└── Process 4: RPC Node (--rpc-external)
```

---

## 📦 Step 1: Distribute Binary to Servers

### Option A: Copy to Remote Servers
```bash
# From your build machine
cd /home/lojak/Desktop/atlas-sphere

# Copy to each server
for server in server1 server2 server3; do
    scp target/release/atlas-sphere-node user@$server:/usr/local/bin/
    ssh user@$server "chmod +x /usr/local/bin/atlas-sphere-node"
done
```

### Option B: Run All on This Machine
```bash
# Just use the existing binary
sudo cp target/release/atlas-sphere-node /usr/local/bin/
sudo chmod +x /usr/local/bin/atlas-sphere-node
```

---

## 🔑 Step 2: Setup Validator Keys

### On This Machine (Already Done!)
You already have keys in `deployment/keys/`:
- validator-01-keys/
- validator-02-keys/
- validator-03-keys/
- bootnode-key.txt

### Deploy Keys to Servers
```bash
cd /home/lojak/Desktop/atlas-sphere/deployment

# For each validator server:
# Copy the ENTIRE keystore folder
scp -r keys/validator-01-keys/keystore user@validator01:/var/lib/atlas-sphere/chains/atlas_testnet/

# Or if running locally, create base directories:
sudo mkdir -p /var/lib/atlas-sphere/chains/atlas_testnet/
sudo cp -r keys/validator-01-keys/keystore /var/lib/atlas-sphere/chains/atlas_testnet/
sudo chown -R $USER:$USER /var/lib/atlas-sphere
```

---

## 🚀 Step 3: Start Bootnode (First!)

### Get Bootnode Key
```bash
cd /home/lojak/Desktop/atlas-sphere/deployment
BOOTNODE_KEY=$(cat keys/bootnode-key.txt)
echo "Bootnode Secret: $BOOTNODE_KEY"
```

### Start Bootnode
```bash
# On bootnode server (or in tmux session)
atlas-sphere-node \
  --chain /path/to/atlas-testnet-raw.json \
  --base-path /var/lib/atlas-sphere/bootnode \
  --name "Atlas-Bootnode" \
  --node-key $BOOTNODE_KEY \
  --port 30333 \
  --rpc-port 9944 \
  --validator \
  --rpc-cors all \
  --rpc-methods Unsafe \
  --pruning archive
```

### Get Bootnode Peer ID
```bash
# Watch the startup logs for:
# 🏷  Local node identity is: 12D3KooW...
# Save this entire peer ID!

# Or generate it:
atlas-sphere-node key inspect-node-key --file keys/bootnode-key.txt
```

---

## ⚙️ Step 4: Start Validators

### Validator 01
```bash
# Replace BOOTNODE_PEER_ID with value from step 3
# Replace BOOTNODE_IP with your bootnode's IP (or 127.0.0.1 if same machine)

atlas-sphere-node \
  --chain /home/lojak/Desktop/atlas-sphere/deployment/chain-specs/atlas-testnet-raw.json \
  --base-path /var/lib/atlas-sphere/validator-01 \
  --name "Validator-01" \
  --validator \
  --port 30334 \
  --rpc-port 9945 \
  --bootnodes /ip4/BOOTNODE_IP/tcp/30333/p2p/BOOTNODE_PEER_ID \
  --pruning archive

# Example with localhost:
# --bootnodes /ip4/127.0.0.1/tcp/30333/p2p/12D3KooWExamplePeerId...
```

### Validator 02
```bash
atlas-sphere-node \
  --chain /home/lojak/Desktop/atlas-sphere/deployment/chain-specs/atlas-testnet-raw.json \
  --base-path /var/lib/atlas-sphere/validator-02 \
  --name "Validator-02" \
  --validator \
  --port 30335 \
  --rpc-port 9946 \
  --bootnodes /ip4/BOOTNODE_IP/tcp/30333/p2p/BOOTNODE_PEER_ID \
  --pruning archive
```

### Validator 03
```bash
atlas-sphere-node \
  --chain /home/lojak/Desktop/atlas-sphere/deployment/chain-specs/atlas-testnet-raw.json \
  --base-path /var/lib/atlas-sphere/validator-03 \
  --name "Validator-03" \
  --validator \
  --port 30336 \
  --rpc-port 9947 \
  --bootnodes /ip4/BOOTNODE_IP/tcp/30333/p2p/BOOTNODE_PEER_ID \
  --pruning archive
```

---

## 🔐 Step 5: Insert Session Keys

### Check Keys Are Loaded
```bash
# For each validator (adjust port 9944/9945/9946):
curl -H "Content-Type: application/json" \
  -d '{"id":1, "jsonrpc":"2.0", "method": "author_hasSessionKeys", "params":["YOUR_PUBLIC_KEY"]}' \
  http://localhost:9944
```

### Or Insert via RPC (if not pre-loaded)
```bash
# Get the session keys for each validator from deployment/keys/validator-0X-keys/

# Insert for Validator 01:
curl -H "Content-Type: application/json" \
  -d '{"id":1, "jsonrpc":"2.0", "method": "author_insertKey", "params":["aura","YOUR_SEED_PHRASE","YOUR_PUBLIC_KEY"]}' \
  http://localhost:9945

curl -H "Content-Type: application/json" \
  -d '{"id":1, "jsonrpc":"2.0", "method": "author_insertKey", "params":["gran","YOUR_SEED_PHRASE","YOUR_PUBLIC_KEY"]}' \
  http://localhost:9945
```

---

## ✅ Step 6: Verify Block Production

### Watch Logs
```bash
# You should see:
✨ Imported #1 (0x1234...)
🎁 Prepared block for proposing at 2 (3 ms)
🔖 Pre-sealed block for proposal at 2. Hash now 0x5678...
✨ Imported #2 (0x5678...)

# And GRANDPA finalization:
♻️  Reorg on #1,0x1234... to #2,0x5678..., common ancestor #0,0xabcd...
✅ Finalized block #1
```

### Check via RPC
```bash
# Get latest block
curl -H "Content-Type: application/json" \
  -d '{"id":1, "jsonrpc":"2.0", "method": "chain_getBlock"}' \
  http://localhost:9944 | jq

# Check peer count (should be 3+)
curl -H "Content-Type: application/json" \
  -d '{"id":1, "jsonrpc":"2.0", "method": "system_health"}' \
  http://localhost:9944 | jq
```

---

## 🎮 EASY MODE: Use Systemd Services

### Create Service File
```bash
sudo tee /etc/systemd/system/atlas-validator-01.service > /dev/null <<EOF
[Unit]
Description=Atlas Sphere Validator 01
After=network.target

[Service]
Type=simple
User=$USER
WorkingDirectory=/home/$USER
ExecStart=/usr/local/bin/atlas-sphere-node \\
  --chain /home/lojak/Desktop/atlas-sphere/deployment/chain-specs/atlas-testnet-raw.json \\
  --base-path /var/lib/atlas-sphere/validator-01 \\
  --name "Validator-01" \\
  --validator \\
  --port 30334 \\
  --rpc-port 9945 \\
  --bootnodes /ip4/127.0.0.1/tcp/30333/p2p/BOOTNODE_PEER_ID \\
  --pruning archive
Restart=always
RestartSec=10

[Install]
WantedBy=multi-user.target
EOF

# Enable and start
sudo systemctl daemon-reload
sudo systemctl enable atlas-validator-01
sudo systemctl start atlas-validator-01

# Check status
sudo systemctl status atlas-validator-01
sudo journalctl -u atlas-validator-01 -f
```

---

## 🛠️ USE THE AUTOMATED SCRIPT!

### Super Easy Local Deploy
```bash
cd /home/lojak/Desktop/atlas-sphere/deployment

# This will:
# 1. Copy binary to /usr/local/bin
# 2. Create all data directories
# 3. Copy keys to correct locations
# 4. Create systemd services
# 5. Start all nodes
./deploy-local-testnet.sh
```

Let me create that script now! ⚡

---

## 🔥 Firewall Rules (If Using Multiple Servers)

### Ubuntu UFW
```bash
# Allow P2P
sudo ufw allow 30333/tcp comment 'Atlas P2P'

# Allow RPC (only on RPC nodes, restrict to trusted IPs)
sudo ufw allow from YOUR_IP to any port 9944 comment 'Atlas RPC'

# Enable firewall
sudo ufw enable
```

### iptables
```bash
# P2P
sudo iptables -A INPUT -p tcp --dport 30333 -j ACCEPT

# RPC (restrict to your IP)
sudo iptables -A INPUT -p tcp --dport 9944 -s YOUR_IP -j ACCEPT
```

---

## 📊 Monitoring Your Testnet

### Quick Health Check
```bash
# Check if nodes are running
ps aux | grep atlas-sphere-node

# Check connectivity
curl http://localhost:9944
curl http://localhost:9945
curl http://localhost:9946

# Check block height
curl -s -H "Content-Type: application/json" \
  -d '{"id":1, "jsonrpc":"2.0", "method": "chain_getBlock"}' \
  http://localhost:9944 | jq -r '.result.block.header.number'
```

### Connect Polkadot.js Apps
1. Go to https://polkadot.js.org/apps/
2. Click top-left corner
3. Development → Custom → ws://YOUR_SERVER_IP:9944
4. Save & Connect

---

## 🎯 SUCCESS CRITERIA

Your testnet is working when you see:
- ✅ All 3 validators connected (check `system_peers` RPC)
- ✅ New blocks every 6 seconds
- ✅ Block finalization (GRANDPA) working
- ✅ No error logs about keys or connectivity
- ✅ Can connect via Polkadot.js Apps

---

## 🆘 Troubleshooting

### Nodes Not Connecting
```bash
# Check bootnode peer ID is correct
atlas-sphere-node key inspect-node-key --file deployment/keys/bootnode-key.txt

# Check firewall
sudo ufw status

# Check if bootnode is reachable
telnet BOOTNODE_IP 30333
```

### Keys Not Loading
```bash
# Verify keystore exists
ls -la /var/lib/atlas-sphere/validator-01/chains/atlas_testnet/keystore/

# Check permissions
sudo chown -R $USER:$USER /var/lib/atlas-sphere
```

### Not Producing Blocks
```bash
# Verify keys are inserted
curl -s http://localhost:9945 -H "Content-Type: application/json" \
  -d '{"id":1, "jsonrpc":"2.0", "method": "author_hasSessionKeys", "params":[]}' | jq

# Check validator is in session
curl -s http://localhost:9945 -H "Content-Type: application/json" \
  -d '{"id":1, "jsonrpc":"2.0", "method": "session_validators"}' | jq
```

---

## 🚀 NEXT: I'll Create the Automated Deploy Script!

Ready to run? I'll make a one-command deploy script for your in-house setup!
