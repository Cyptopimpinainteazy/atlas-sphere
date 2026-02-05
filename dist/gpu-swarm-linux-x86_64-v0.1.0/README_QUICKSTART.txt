# Quickstart

1. Extract and run coordinator: ./swarm-coordinator --config coordinator-config.toml
2. Start node: ./swarm-node --config node-config.toml


Systemd:
1. Copy binaries to /usr/local/bin
2. Copy configs to /etc/gpu-swarm/
3. Copy services to /etc/systemd/system/ and run `sudo systemctl daemon-reload`
4. `sudo systemctl enable --now swarm-coordinator`
5. `sudo systemctl enable --now swarm-node`
