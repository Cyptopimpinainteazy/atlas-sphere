# Atlas Sphere Testnet v1 - Deployment Package Ready! 🚀

**Status**: Day -2 Complete, Day -1 In Progress (Bfrontend/uild Running)  
**Date**: November 8, 2025  
**Deployment Team**: Ready to execute

---

## 📦 Deployment Package Created

### ✅ Infrastructure Setup (Day -2) - COMPLETE

**Created Files:**
- ✅ `deployment/infrastructure-setup.sh` - Main setup script
- ✅ `deployment/inventory.yaml` - Infrastructure inventory template
- ✅ `deployment/provision-digitalocean.sh` - DigitalOcean automation
- ✅ `deployment/provision-aws.md` - AWS EC2 gfrontend/uide
- ✅ `deployment/provision-manual.md` - Manual/VPS provider gfrontend/uide
- ✅ `deployment/dns-config.md` - DNS configuration gfrontend/uide
- ✅ `deployment/configure-firewall.sh` - Firewall setup script
- ✅ `~/.ssh/atlas-testnet-deploy` - SSH key generated

**What You Need to Do Next:**
1. Choose your infrastructure provider:
   - **DigitalOcean**: Run `./deployment/provision-digitalocean.sh`
   - **AWS EC2**: Follow `deployment/provision-aws.md`
   - **Manual/VPS**: Follow `deployment/provision-manual.md`

2. Update `deployment/inventory.yaml` with actual IPs after provisioning

3. Configure DNS records using `deployment/dns-config.md`

4. Run firewall setup on each node:
   ```bash
   ssh atlas@NODE_IP 'bash -s' < deployment/configure-firewall.sh validator
   ```

---

### ⏳ Bfrontend/uild & Key Generation (Day -1) - IN PROGRESS

**Currently Running:**
- 🔨 `cargo bfrontend/uild --release` (10-30 minutes)
- Output: `deployment/bfrontend/uild.log`

**Created Files:**
- ✅ `deployment/bfrontend/uild-and-keygen.sh` - Bfrontend/uild and key generation script

**What Will Be Generated (after bfrontend/uild completes):**
- `target/release/atlas-sphere-node` - Release binary (~200MB)
- `deployment/chain-specs/atlas-testnet-raw.json` - Chain specification
- `deployment/keys/validator-0X-summary.txt` - Validator keys (3-5 sets)
- `deployment/keys/bootnode-info.txt` - Bootnode configuration
- `deployment/keys/sudo-key.txt` - Development sudo key

**What You Need to Do After Bfrontend/uild:**
1. Wait for `cargo bfrontend/uild --release` to finish
2. Run `./deployment/bfrontend/uild-and-keygen.sh` to generate keys
3. **CRITICAL**: Backup keys immediately (encrypted!)
   ```bash
   tar czf - deployment/keys | gpg -e -r admin@atlas-sphere.io \
     > atlas-testnet-keys-$(date +%Y%m%d).tar.gz.gpg
   ```

---

### 📋 Node Deployment (Day 1) - READY

**Created Files:**
- ✅ `deployment/deploy-nodes-day1.sh` - Automated deployment script

**What This Script Does:**
1. **Deploy Bootnode** (first!):
   - Copies binary and chain spec
   - Installs systemd service
   - Starts bootnode
   - Extracts peer ID for validators

2. **Deploy Validators** (3-5 nodes):
   - Copies binary and chain spec
   - Installs systemd service
   - Starts validator
   - Inserts Aura + GRANDPA authority keys via RPC
   - Verifies keys loaded

3. **Verify Network**:
   - Checks peer connections
   - Monitors for block production
   - Confirms finalization

**What You Need to Do:**
1. Ensure infrastructure provisioned (Day -2)
2. Ensure bfrontend/uild complete and keys generated (Day -1)
3. Run: `./deployment/deploy-nodes-day1.sh`
4. Follow prompts to enter IPs for each node
5. Monitor logs for first blocks!

---

## 🚀 Qfrontend/uick Start Deployment

### Option 1: Automated (Recommended for DigitalOcean)

```bash
# Day -2: Provision infrastructure
./deployment/infrastructure-setup.sh
./deployment/provision-digitalocean.sh  # Or follow AWS/manual gfrontend/uide

# Update inventory with actual IPs
vim deployment/inventory.yaml

# Configure DNS
# Follow deployment/dns-config.md

# Day -1: Bfrontend/uild and generate keys (CURRENTLY RUNNING)
# Wait for cargo bfrontend/uild --release to finish...
./deployment/bfrontend/uild-and-keygen.sh

# BACKUP KEYS!
tar czf - deployment/keys | gpg -e -r your@email.com \
  > atlas-keys-backup.tar.gz.gpg

# Day 1: Deploy nodes
./deployment/deploy-nodes-day1.sh

# Days 2-5: Continue with remaining scripts (to be created)
```

### Option 2: Manual Step-by-Step

1. **Provision VMs** (your cloud provider apps/apps/dash-legacy-2-legacy-2board)
   - 3-5 validators (4GB RAM, 2 vCPU)
   - 2+ RPC nodes (8GB RAM, 4 vCPU)
   - 1 bootnode (2GB RAM, 1 vCPU)
   - 1 monitoring (4GB RAM, 2 vCPU)

2. **Configure DNS**
   - Point rpc.testnet.atlas-sphere.io → RPC load balancer
   - Point bootnode.testnet.atlas-sphere.io → Bootnode IP
   - Point faucet.testnet.atlas-sphere.io → Faucet server
   - Point metrics.testnet.atlas-sphere.io → Grafana server

3. **Bfrontend/uild Binary**
   ```bash
   cargo bfrontend/uild --release
   ```

4. **Generate Keys**
   ```bash
   # Install subkey if not present
   cargo install --force --git https://github.com/paritytech/substrate subkey
   
   # Generate validator keys
   subkey generate --scheme Sr25519  # Aura
   subkey generate --scheme Ed25519  # GRANDPA
   # Repeat for each validator
   ```

5. **Generate Chain Spec**
   ```bash
   ./target/release/atlas-sphere-node bfrontend/uild-spec \
     --chain local > atlas-testnet-plain.json
   
   # Edit: name, id, bootnodes, initial authorities
   
   ./target/release/atlas-sphere-node bfrontend/uild-spec \
     --chain atlas-testnet-plain.json --raw \
     > atlas-testnet-raw.json
   ```

6. **Deploy Nodes** (manually SSH to each)
   - Copy binary: `/usr/local/bin/atlas-sphere-node`
   - Copy chain spec: `/etc/atlas/atlas-testnet-raw.json`
   - Create systemd service
   - Start services
   - Insert keys via RPC

---

## 📊 Current Status

| Task | Status | Time Estimate | Notes |
|------|--------|---------------|-------|
| **Day -2: Infrastructure** | ✅ Complete | 2-4 hours | Scripts created, ready to provision |
| **Day -1: Bfrontend/uild & Keys** | ⏳ In Progress | 10-30 min bfrontend/uild | `cargo bfrontend/uild --release` running |
| **Day 1: Deploy Nodes** | 📋 Ready | 2-3 hours | Script ready, pending bfrontend/uild |
| **Day 2: RPC + Faucet** | 📝 Planned | 2-3 hours | Script to be created |
| **Day 3: Monitoring** | 📝 Planned | 2-3 hours | Script to be created |
| **Day 4: Testing** | 📝 Planned | 4-6 hours | Comprehensive testing |
| **Day 5: Launch** | 🎉 Planned | 1-2 hours | Public announcement |

**Total Time to Launch**: 5-7 days (with infrastructure setup)

---

## 🔐 Security Checklist

### Keys Management
- ✅ Keys directory `.gitignored` automatically
- ⏳ Backup keys encrypted (do after generation)
- ⏳ Distribute to validators via encrypted channel
- ⏳ Store backups in 3 locations (cloud + USB + vault)

### Infrastructure Security
- ⏳ SSH keys deployed (do on each node)
- ⏳ Firewall configured (use `configure-firewall.sh`)
- ⏳ Restrict SSH to admin IPs only
- ⏳ RPC ports only accessible via load balancer
- ⏳ Prometheus metrics restricted to monitoring server

### Network Security
- ⏳ DDoS protection (Cloudflare for RPC endpoints)
- ⏳ Rate limiting on public RPC (1000 req/min)
- ⏳ Faucet captcha configured
- ⏳ Faucet rate limits (100 tATLAS per 24h)

---

## 📁 File Structure

```
deployment/
├── infrastructure-setup.sh          ✅ Created
├── inventory.yaml                   ✅ Created (needs IPs)
├── provision-digitalocean.sh        ✅ Created
├── provision-aws.md                 ✅ Created
├── provision-manual.md              ✅ Created
├── dns-config.md                    ✅ Created
├── configure-firewall.sh            ✅ Created
├── bfrontend/uild-and-keygen.sh              ✅ Created
├── deploy-nodes-day1.sh             ✅ Created
├── bfrontend/uild.log                        ⏳ In progress
├── chain-specs/
│   ├── atlas-dev-plain.json         ⏳ Will be generated
│   ├── atlas-testnet-plain.json     ⏳ Will be generated
│   ├── atlas-testnet-raw.json       ⏳ Will be generated (deploy this)
│   └── atlas-staging-plain.json     ⏳ Will be generated
├── keys/
│   ├── .gitignore                   ⏳ Will be generated
│   ├── KEYS_MANIFEST.md             ⏳ Will be generated
│   ├── validator-01-summary.txt     ⏳ Will be generated
│   ├── validator-02-summary.txt     ⏳ Will be generated
│   ├── validator-03-summary.txt     ⏳ Will be generated
│   ├── bootnode-info.txt            ⏳ Will be generated
│   └── sudo-key.txt                 ⏳ Will be generated
└── atlas-sphere-node                ⏳ Will be copied from target/release/
```

---

## ⚡ Next Actions (Priority Order)

### Immediate (Now)
1. ✅ Wait for `cargo bfrontend/uild --release` to complete (check with: `tail -f deployment/bfrontend/uild.log`)
2. Provision VMs using your preferred method:
   - DigitalOcean: `./deployment/provision-digitalocean.sh`
   - AWS: Follow `deployment/provision-aws.md`
   - Manual: Follow `deployment/provision-manual.md`

### After Bfrontend/uild Completes
3. Run `./deployment/bfrontend/uild-and-keygen.sh`
4. **IMMEDIATELY backup keys** (encrypted!)
5. Update `deployment/inventory.yaml` with actual IPs

### Day 1 (After Infrastructure Ready)
6. Configure DNS records
7. Run firewall setup on each node
8. Run `./deployment/deploy-nodes-day1.sh`
9. Monitor logs for first blocks!

---

## 🆘 Troubleshooting

### Bfrontend/uild Taking Too Long
```bash
# Check bfrontend/uild progress
tail -f deployment/bfrontend/uild.log

# Typical times:
# - Fast machine (16+ cores): 5-10 min
# - Medium machine (4-8 cores): 10-20 min
# - Slow machine (2 cores): 20-30 min
```

### Bfrontend/uild Fails
```bash
# Common fixes:
# 1. Update Rust
rustup update stable

# 2. Clean and retry
cargo clean
cargo bfrontend/uild --release
```

### Can't SSH to VMs
```bash
# Check SSH key
ssh -i ~/.ssh/atlas-testnet-deploy atlas@VM_IP

# Add key to agent if needed
ssh-add ~/.ssh/atlas-testnet-deploy
```

### Firewall Blocks Deployment
```bash
# Temporarily disable for setup (re-enable after!)
ssh atlas@VM_IP 'sudo ufw disable'

# Deploy, then re-enable
ssh atlas@VM_IP 'sudo ufw enable'
```

---

## 📞 Support Channels

**During Deployment:**
- **Technical Issues**: Check TESTNET_DEPLOYMENT_GUIDE.md troubleshooting section
- **Script Errors**: Review script output, check prereqfrontend/uisites
- **Infrastructure**: Consult your cloud provider docs

**After Launch:**
- **Developer Support**: Discord #testnet-support
- **Bug Reports**: GitHub issues
- **Security Issues**: security@atlas-sphere.io (private)

---

## 🎉 Ready to Deploy!

All infrastructure scripts are created and ready. Bfrontend/uild is currently running.

**Estimated Time to Public Launch**: 5-7 days

**Next Milestone**: Complete Day -1 (bfrontend/uild + keys) → Proceed to Day 1 (node deployment)

---

**Status**: 🟢 ON TRACK  
**Bfrontend/uild Progress**: Check `deployment/bfrontend/uild.log`  
**Last Updated**: November 8, 2025

**Let's launch Atlas Sphere Testnet v1! 🚀**
