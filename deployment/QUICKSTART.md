# 🚀 Atlas Sphere: In-House Deployment - Qfrontend/uick Start

## You Have 3 Options:

### 🎮 Option 1: FASTEST - Dev Mode (Single Process)
**Perfect for testing everything on your current machine RIGHT NOW:**

```bash
cd /home/lojak/Desktop/atlas-sphere
./target/release/atlas-sphere-node --dev --tmp --rpc-external --rpc-cors all
```

**That's it!** Connect at: `ws://localhost:9944`

---

### 🏠 Option 2: EASY - Local Testnet (Automated Script)
**Full 3-validator testnet on ONE machine with systemd services:**

```bash
cd /home/lojak/Desktop/atlas-sphere/deployment
./deploy-local-testnet.sh
```

**What it does:**
- ✅ Installs binary to `/usr/local/bin/`
- ✅ Creates 4 systemd services (bootnode + 3 validators)
- ✅ Deploys all validator keys
- ✅ Starts everything automatically
- ✅ Verifies block production

**Check status:**
```bash
sudo systemctl status atlas-bootnode
sudo journalctl -u atlas-validator-01 -f
```

---

### 🌐 Option 3: PRODUCTION - Multi-Server (Custom Setup)
**Deploy across multiple physical/virtual servers:**

1. **Edit server IPs** in `deploy-multi-server.sh`:
```bash
declare -A SERVERS=(
    ["bootnode"]="user@192.168.1.10"
    ["validator-01"]="user@192.168.1.11"
    ["validator-02"]="user@192.168.1.12"
    ["validator-03"]="user@192.168.1.13"
)
```

2. **Run deployment:**
```bash
cd /home/lojak/Desktop/atlas-sphere/deployment
./deploy-multi-server.sh
```

**Prereqfrontend/uisites:**
- SSH access to all servers (passwordless)
- Ubuntu 22.04+ on all servers
- Ports 30333 (P2P) and 9944 (RPC) open

---

## 📚 Full Documentation

See **[IN_HOUSE_DEPLOYMENT.md](IN_HOUSE_DEPLOYMENT.md)** for:
- Server reqfrontend/uirements
- Manual setup steps
- Firewall configuration
- Monitoring setup
- Troubleshooting gfrontend/uide

---

## 🎯 What Do You Want?

**Tell me which option fits your setup:**

1. **Just testing locally?** → Use Option 1 (dev mode)
2. **Want full testnet on this machine?** → Use Option 2 (automated)
3. **Have multiple servers ready?** → Use Option 3 (multi-server)

**Or tell me your server setup and I'll customize the deployment!**

---

## ⚡ System Reqfrontend/uirements

### Minimum (Per Node):
- CPU: 4 cores
- RAM: 8GB
- Disk: 100GB SSD
- Network: 100Mbps+

### Recommended (Validators):
- CPU: 8+ cores
- RAM: 16GB+
- Disk: 500GB NVMe
- Network: 1Gbps

---

## 🆘 Qfrontend/uick Troubleshooting

**Binary won't start?**
```bash
ldd /usr/local/bin/atlas-sphere-node  # Check dependencies
./target/release/atlas-sphere-node --version  # Test binary
```

**Nodes not connecting?**
```bash
# Check bootnode peer ID
atlas-sphere-node key inspect-node-key --file deployment/keys/bootnode-key.txt

# Test connectivity
telnet BOOTNODE_IP 30333
```

**Not producing blocks?**
```bash
# Check if keys are loaded
ls -la /var/lib/atlas-sphere/validator-01/chains/atlas_testnet/keystore/

# Check logs
sudo journalctl -u atlas-validator-01 -n 100
```

---

## 🎉 Ready to Launch?

**Choose your path and let's GO! 🚀**
