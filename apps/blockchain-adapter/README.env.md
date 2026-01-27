# Environment variables (examples)

EVM_RPC_URL=https://lb.drpc.live/ethereum/ArgUBy0RzURpos-Jlz1TqLRxbgscV2AR8JXZrqRhf0fE
EVM_DEPLOYER_PRIVATE_KEY=<hex-private-key>
X3VM_WS_URL=wss://x3vm.node:9944
X3VM_SIGNER_SURI=//Alice  # or mnemonic

Note: In CI, set these as secrets and available in the job environment before running e2e tests.

Recommended GitHub repository secrets for E2E:
- EVM_RPC_URL: RPC endpoint for the EVM testnet
- EVM_DEPLOYER_PRIVATE_KEY: Private key for contract deployment (use ephemeral test account)
- X3VM_WS_URL: WebSocket endpoint for X3VM node (wss://...)
- X3VM_SIGNER_SURI: SURI/mnemonic for signing extrinsics (test SURI)

Security notes:
- Do not store production keys here; use KMS/HSM for production signing and rotate keys frequently.
- For local development, you can spin up a dev X3VM node via `docker-compose -f infra/x3vm/docker-compose.yml up` and set `X3VM_WS_URL=ws://localhost:9944`.

