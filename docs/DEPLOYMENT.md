# Atlas Sphere Deployment Guide

## Overview

This guide covers deployment procedures for Atlas Sphere nodes, from local development to production validators.

---

## Environment Setup

### Prerequisites
- Ubuntu 22.04 LTS (recommended) or compatible Linux
- 8GB+ RAM, 4+ CPU cores
- 500GB+ SSD storage
- Rust toolchain (see below)

### Toolchain Installation
```bash
# Install Rust
curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh
source ~/.cargo/env

# Add WASM target
rustup target add wasm32-unknown-unknown

# Pin to project toolchain
cd atlas-sphere
rustup override set nightly-2024-12-01
```

### Build from Source
```bash
# Clone repository
git clone https://github.com/atlas-sphere/atlas-sphere.git
cd atlas-sphere

# Build release binary
SKIP_WASM_BUILD=1 cargo build --release

# Verify build
./target/release/atlas-sphere-node --version
```

---

## Deployment Options

### 1. Local Development Node
```bash
# Single-node devnet
./run-dev-node.sh

# Or manually
./target/release/atlas-sphere-node \
    --dev \
    --tmp \
    --rpc-cors all
```

### 2. Local Testnet (3 Validators)
```bash
# Deploy local testnet
./deployment/deploy-local-testnet.sh

# This creates:
# - Node 1: ports 9933/9944/30333
# - Node 2: ports 9934/9945/30334
# - Node 3: ports 9935/9946/30335
```

### 3. Multi-Server Deployment
```bash
# Configure servers in deployment/config/servers.json
# Then deploy
./deployment/deploy-multi-server.sh
```

### 4. Docker Deployment
```bash
# Build image
docker build -t atlas-sphere:latest .

# Run container
docker run -d \
    --name atlas-node \
    -p 9933:9933 \
    -p 9944:9944 \
    -p 30333:30333 \
    -v atlas-data:/data \
    atlas-sphere:latest \
    --base-path /data \
    --chain local
```

---

## Validator Setup

### Generate Keys
```bash
# Generate session keys
./target/release/atlas-sphere-node key generate --scheme Sr25519

# Insert keys into keystore
./target/release/atlas-sphere-node key insert \
    --base-path /data \
    --chain local \
    --scheme Sr25519 \
    --suri "<mnemonic>" \
    --key-type aura

./target/release/atlas-sphere-node key insert \
    --base-path /data \
    --chain local \
    --scheme Ed25519 \
    --suri "<mnemonic>" \
    --key-type gran
```

### Validator Node Configuration
```bash
./target/release/atlas-sphere-node \
    --base-path /data/validator \
    --chain mainnet \
    --name "MyValidator" \
    --validator \
    --port 30333 \
    --rpc-port 9933 \
    --ws-port 9944 \
    --rpc-cors all \
    --telemetry-url "wss://telemetry.atlas-sphere.io/submit 0"
```

### Register as Validator
1. Bond tokens to stash account
2. Set session keys via `author_rotateKeys` RPC
3. Submit `session.setKeys` extrinsic
4. Wait for election into validator set

---

## Network Configuration

### Chain Specifications

| Network           | Chain Spec          | Purpose           |
| ----------------- | ------------------- | ----------------- |
| `--dev`           | Built-in            | Local development |
| `--chain local`   | `local-spec.json`   | Local testnet     |
| `--chain testnet` | `testnet-spec.json` | Public testnet    |
| `--chain mainnet` | `mainnet-spec.json` | Production        |

### Genesis Configuration
Key genesis parameters:
- `atlas_kernel.authorized_accounts` - Initial authorized accounts
- `atlas_kernel.registered_assets` - Initial asset registry
- `balances.balances` - Initial token distribution
- `aura.authorities` - Initial block producers
- `grandpa.authorities` - Initial finality voters

### Bootnodes
```bash
# Add bootnodes for network discovery
./target/release/atlas-sphere-node \
    --bootnodes /ip4/10.0.0.1/tcp/30333/p2p/12D3KooW... \
    --bootnodes /ip4/10.0.0.2/tcp/30333/p2p/12D3KooW...
```

---

## Monitoring Setup

### Prometheus Metrics
```bash
# Enable metrics endpoint
./target/release/atlas-sphere-node \
    --prometheus-port 9615 \
    --prometheus-external
```

### Grafana Dashboard
1. Import Substrate dashboard template
2. Add Atlas Sphere custom panels:
   - Comit submission rate
   - Atomic failure rate
   - Canonical ledger updates
   - Fee distribution

### Log Aggregation
```bash
# Configure journald
sudo systemctl enable atlas-sphere
sudo journalctl -u atlas-sphere -f

# Or use file logging
./target/release/atlas-sphere-node \
    --log-dir /var/log/atlas-sphere
```

---

## Backup & Recovery

### State Backup
```bash
# Stop node first
sudo systemctl stop atlas-sphere

# Backup chain data
tar -czvf backup-$(date +%Y%m%d).tar.gz /data/chains/

# Restart node
sudo systemctl start atlas-sphere
```

### Key Backup
```bash
# Export keystore
cp -r /data/chains/atlas-sphere/keystore ./keystore-backup/

# Encrypt backup
gpg --symmetric --cipher-algo AES256 keystore-backup.tar.gz
```

### Recovery Procedure
1. Stop affected node
2. Clear corrupted data: `rm -rf /data/chains/atlas-sphere/db`
3. Restore from backup or sync from network
4. Restore keystore if needed
5. Start node and verify sync

---

## Security Hardening

### Firewall Rules
```bash
# UFW example
sudo ufw allow 30333/tcp  # P2P
sudo ufw allow 9933/tcp   # RPC (restrict to trusted IPs)
sudo ufw allow 9944/tcp   # WebSocket (restrict to trusted IPs)
sudo ufw enable
```

### Systemd Service
```ini
# /etc/systemd/system/atlas-sphere.service
[Unit]
Description=Atlas Sphere Node
After=network.target

[Service]
Type=simple
User=atlas
ExecStart=/opt/atlas-sphere/atlas-sphere-node \
    --base-path /data \
    --chain mainnet \
    --validator
Restart=always
RestartSec=10

[Install]
WantedBy=multi-user.target
```

### Non-Root User
```bash
# Create dedicated user
sudo useradd -m -s /bin/bash atlas
sudo chown -R atlas:atlas /data /opt/atlas-sphere
```

---

## Troubleshooting

### Common Issues

| Issue             | Solution                              |
| ----------------- | ------------------------------------- |
| Node won't sync   | Check bootnodes, firewall, clock sync |
| Out of memory     | Increase swap, check for memory leaks |
| Consensus failure | Verify session keys, check logs       |
| RPC timeout       | Check rate limits, increase timeout   |
| WASM build fails  | Verify nightly toolchain, clear cache |

### Debug Commands
```bash
# Check peer connections
curl -s localhost:9933 -d '{"id":1,"jsonrpc":"2.0","method":"system_peers","params":[]}'

# Get sync state
curl -s localhost:9933 -d '{"id":1,"jsonrpc":"2.0","method":"system_syncState","params":[]}'

# Get runtime version
curl -s localhost:9933 -d '{"id":1,"jsonrpc":"2.0","method":"state_getRuntimeVersion","params":[]}'
```

---

## Release Process

### Building Release Artifacts
```bash
# Clean build
cargo clean
SKIP_WASM_BUILD=1 cargo build --release

# Build runtime WASM
cargo +nightly build -p atlas-sphere-runtime --release

# Package artifacts
mkdir -p release
cp target/release/atlas-sphere-node release/
cp target/release/wbuild/atlas-sphere-runtime/*.wasm release/
```

### Signing Releases
```bash
# Sign binary
gpg --armor --detach-sign release/atlas-sphere-node

# Generate checksums
sha256sum release/* > release/SHA256SUMS
gpg --armor --detach-sign release/SHA256SUMS
```

### Reproducible Builds
- Use pinned Rust toolchain (`rust-toolchain.toml`)
- Use exact dependency versions (`Cargo.lock`)
- Build in containerized environment
- Verify binary hash matches CI build

---

## References

- [Architecture Document](./ARCHITECTURE.md)
- [Owner Runbook](./OWNER_RUNBOOK.md)
- [Substrate Documentation](https://docs.substrate.io/)
