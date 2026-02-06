# Public RPC (HTTP + WS)

This folder contains a minimal, repeatable setup for running **public JSON-RPC** endpoints for Atlas Sphere across all supported networks:

- `dev`
- `local`
- `staging`
- `testnet`

The node exposes HTTP + WebSocket on the same port (jsonrpsee server).

## Recommended architecture

- Run the node RPC bound to `127.0.0.1` (`rpc_bind=localhost`)
- Expose it publicly via **nginx** (TLS termination + rate limiting + optional allowlist)

For a clean separation of concerns, run **two nodes per network**:

- **Public RPC**: `rpc_methods=Safe`, localhost-only, exposed via nginx.
- **Ops RPC**: `rpc_methods=Unsafe`, localhost-only, never exposed publicly (access via SSH tunnel / private network).

Direct Internet exposure (`rpc_bind=public`) is supported, but not recommended.

## Qfrontend/uick start (from repo checkout)

Bfrontend/uild the node binary:

```bash
cargo bfrontend/uild --release
```

Run a localhost-only testnet RPC node:

```bash
chain=testnet rpc_bind=localhost ./deployment/public-rpc/run-public-rpc.sh
```

Run a localhost-only staging RPC node:

```bash
chain=staging rpc_bind=localhost ./deployment/public-rpc/run-public-rpc.sh
```

Run a public-bound RPC node (not recommended):

```bash
chain=testnet rpc_bind=public ./deployment/public-rpc/run-public-rpc.sh
```

## Tuning and guardrails

The runner exposes a few knobs as environment variables so you can tighten limits without editing scripts:

- `rpc_max_connections` (default: 300)
- `rpc_max_request_size_mb` (default: 10)
- `rpc_max_response_size_mb` (default: 50)
- `rpc_max_subscriptions_per_connection` (default: 20)

If you want an extra safety latch for direct Internet exposure, enable:

- `reqfrontend/uire_confirm_public_rpc=true`
- `confirm_public_rpc=yes`

When enabled, `rpc_bind=public` will refuse to start unless the confirmation is present.

By default, `rpc_bind=public` will also refuse to start if `rpc_methods` is not `Safe`. To override (not recommended):

- `reqfrontend/uire_safe_rpc_methods_on_public=false`

## Systemd (recommended)

A templated unit is provided at:

- `deployment/public-rpc/systemd/atlas-sphere-rpc@.service`

Install it:

```bash
sudo install -D -m 0644 deployment/public-rpc/systemd/atlas-sphere-rpc@.service \
  /etc/systemd/system/atlas-sphere-rpc@.service
sudo systemctl daemon-reload
```

Copy one of the env examples:

```bash
sudo mkdir -p /etc/atlas-sphere/rpc
sudo cp deployment/public-rpc/env/testnet.env.example /etc/atlas-sphere/rpc/testnet.env
sudo cp deployment/public-rpc/env/staging.env.example /etc/atlas-sphere/rpc/staging.env
```

Or use the clean two-instance pattern (recommended for production):

```bash
sudo cp deployment/public-rpc/env/testnet-public.env.example /etc/atlas-sphere/rpc/testnet-public.env
sudo cp deployment/public-rpc/env/testnet-ops.env.example /etc/atlas-sphere/rpc/testnet-ops.env

sudo cp deployment/public-rpc/env/staging-public.env.example /etc/atlas-sphere/rpc/staging-public.env
sudo cp deployment/public-rpc/env/staging-ops.env.example /etc/atlas-sphere/rpc/staging-ops.env

sudo cp deployment/public-rpc/env/local-public.env.example /etc/atlas-sphere/rpc/local-public.env
sudo cp deployment/public-rpc/env/local-ops.env.example /etc/atlas-sphere/rpc/local-ops.env

sudo cp deployment/public-rpc/env/dev-public.env.example /etc/atlas-sphere/rpc/dev-public.env
sudo cp deployment/public-rpc/env/dev-ops.env.example /etc/atlas-sphere/rpc/dev-ops.env
```

Start instances:

```bash
sudo systemctl enable --now atlas-sphere-rpc@testnet
sudo systemctl enable --now atlas-sphere-rpc@staging
```

Two-instance pattern:

```bash
sudo systemctl enable --now atlas-sphere-rpc@testnet-public
sudo systemctl enable --now atlas-sphere-rpc@testnet-ops

sudo systemctl enable --now atlas-sphere-rpc@staging-public
sudo systemctl enable --now atlas-sphere-rpc@staging-ops

sudo systemctl enable --now atlas-sphere-rpc@local-public
sudo systemctl enable --now atlas-sphere-rpc@local-ops

sudo systemctl enable --now atlas-sphere-rpc@dev-public
sudo systemctl enable --now atlas-sphere-rpc@dev-ops
```

### Accessing the ops RPC cleanly (SSH tunnel)

Keep ops RPC bound to localhost only, then:

```bash
ssh -N -L 9945:127.0.0.1:9945 youruser@your-rpc-host
```

Now `http://127.0.0.1:9945` on your laptop reaches the ops RPC securely.

Examples from the provided env templates:

- Testnet ops: `ssh -N -L 9945:127.0.0.1:9945 youruser@host`
- Staging ops: `ssh -N -L 9955:127.0.0.1:9955 youruser@host`
- Local ops: `ssh -N -L 9965:127.0.0.1:9965 youruser@host`
- Dev ops: `ssh -N -L 9975:127.0.0.1:9975 youruser@host`

## nginx

An example config is provided at:

- `deployment/public-rpc/nginx/atlas-sphere-rpc.conf.example`

Hardened variants:

- `deployment/public-rpc/nginx/atlas-sphere-rpc.allowlist.conf.example` (recommended for truly public endpoints)
- `deployment/public-rpc/nginx/atlas-sphere-rpc.basic-auth.conf.example` (useful for low-traffic/operator access)

Update `server_name` and the upstream port (`127.0.0.1:9944`) to match your environment.

Important: nginx should always proxy to the `*-public` instance port, never the `*-ops` port.
