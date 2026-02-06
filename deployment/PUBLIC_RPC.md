# Atlas Sphere Public RPC (Dev / Local / Staging / Testnet)

This repo already supports JSON-RPC over HTTP and WebSocket (same port) via `jsonrpsee`.

The safest way to run **public** RPC is:
1. Run a dedicated RPC full node with RPC bound to `127.0.0.1`.
2. Put a reverse proxy (nginx/caddy) in front for TLS + rate limiting + optional IP allowlists.

## 1) Run a public RPC node (per network)

The helper script lives at:
- `deployment/public-rpc/run-public-rpc.sh`

It supports:
- `chain=dev|local|staging|testnet|<path>|<bfrontend/uiltin id>`
- `rpc_bind=localhost|public` (default `localhost`)

### Example: testnet RPC node (localhost-bound)

```bash
cd /opt/atlas-sphere
sudo mkdir -p /var/lib/atlas-sphere/rpc-testnet

chain=testnet \
node_name=atlas-rpc-testnet-01 \
base_path=/var/lib/atlas-sphere/rpc-testnet \
rpc_bind=localhost \
./deployment/public-rpc/run-public-rpc.sh
```

## 2) systemd (recommended)

A systemd unit template is provided:
- `deployment/public-rpc/systemd/atlas-sphere-rpc@.service`

Example env files are provided:
- `deployment/public-rpc/env/dev.env.example`
- `deployment/public-rpc/env/local.env.example`
- `deployment/public-rpc/env/staging.env.example`
- `deployment/public-rpc/env/testnet.env.example`

Install steps (example for testnet):

```bash
sudo useradd --system --home /var/lib/atlas-sphere --shell /usr/sbin/nologin atlas || true
sudo mkdir -p /etc/atlas-sphere/rpc
sudo cp deployment/public-rpc/env/testnet.env.example /etc/atlas-sphere/rpc/testnet.env
sudo cp deployment/public-rpc/systemd/atlas-sphere-rpc@.service /etc/systemd/system/

sudo systemctl daemon-reload
sudo systemctl enable --now atlas-sphere-rpc@testnet
sudo journalctl -u atlas-sphere-rpc@testnet -f
```

## 3) nginx TLS + WebSocket proxy

A starter config is provided:
- `deployment/public-rpc/nginx/atlas-sphere-rpc.conf.example`

Notes:
- WebSocket uses the same endpoint/port; nginx must forward `Upgrade` headers.
- Prefer IP allowlists for admin-only RPC, or strict rate limits for public usage.

## 4) Ports and firewall

At minimum:
- P2P: `30333/tcp` (node-to-node)
- RPC: expose **only** your proxy (443/tcp) publicly
- Prometheus: keep private (or localhost-only)

See `deployment/configure-firewall.sh` for a starting point.
