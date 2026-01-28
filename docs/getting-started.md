# Getting Started with Atlas Sphere

This guide will get you up and running with Atlas Sphere in under 10 minutes. We'll cover local development setup, connecting your wallet, and deploying your first contract.

## Prerequisites

- Node.js 18+ or Rust 1.70+
- Git
- 4GB+ available disk space
- Basic knowledge of Solidity or Rust

## Quick Start (5 minutes)

### 1. Install Atlas CLI

```bash
# Install via npm
npm install -g @atlas-sphere/cli

# Or via curl
curl -sSL https://atlas-sphere.io/install | bash

# Verify installation
atlas --version
```

**Why this matters**: The Atlas CLI provides unified commands for both EVM and SVM development, simplifying your workflow.

### 2. Start Local Node

```bash
# Start development node (creates fresh chain)
atlas node start --dev

# Or with specific configuration
atlas node start --dev --port 9944 --rpc-port 9933
```

The node will:
- Start on `ws://localhost:9944` (WebSocket RPC)
- Expose HTTP RPC on `http://localhost:9933`
- Create a development account with 1000 ATLAS tokens
- Enable both EVM and SVM execution

**Expected output:**
```
2025-12-10 14:00:00 INFO Atlas Sphere Node v1.0.0
2025-12-10 14:00:01 INFO Dual-VM runtime initialized
2025-12-10 14:00:02 INFO EVM adapter: Ready
2025-12-10 14:00:02 INFO SVM adapter: Ready
2025-12-10 14:00:03 INFO RPC server started on ws://localhost:9944
2025-12-10 14:00:03 INFO Development account: 5GrwvaEF5zXb26Fz9rcQpDWS57CtERHpNehXCPcNoHGKutQY
```

### 3. Connect Your Wallet

#### MetaMask Setup
```javascript
// Add Atlas Sphere to MetaMask
await window.ethereum.request({
  method: 'wallet_addEthereumChain',
  params: [{
    chainId: '0x1234', // Replace with actual chain ID
    chainName: 'Atlas Sphere Dev',
    nativeCurrency: {
      name: 'ATLAS',
      symbol: 'ATLAS',
      decimals: 12
    },
    rpcUrls: ['http://localhost:9933'],
    blockExplorerUrls: ['http://localhost:3000']
  }]
});
```

#### Atlas SDK Setup
```bash
npm install @atlas-sphere/sdk
```

```javascript
import { AtlasSphereProvider } from '@atlas-sphere/sdk';

const provider = new AtlasSphereProvider({
  network: 'local',
  rpcUrl: 'ws://localhost:9944',
  timeout: 30000
});

await provider.connect();
console.log('Connected to Atlas Sphere!');
```

**Why this matters**: Atlas Sphere provides both standard Ethereum Web3 compatibility and enhanced dual-VM features through the Atlas SDK.

## Choose Your VM

Atlas Sphere supports three development approaches:

### EVM-Only Development
**Best for**: Existing Ethereum projects, DeFi protocols, familiar tooling

```solidity
// Deploy with standard tools
npx hardhat compile --network atlas
npx hardhat run scripts/deploy.js --network atlas
```

**Use cases**: 
- DeFi protocols (DEX, lending, derivatives)
- DAOs and governance
- NFT marketplaces
- Standard Ethereum patterns

### SVM-Only Development  
**Best for**: High-throughput apps, gaming, microtransactions

```bash
# Anchor project setup
anchor init my-svm-app
cd my-svm-app

# Configure for Atlas Sphere
anchor set provider cluster http://localhost:9933
anchor set provider wallet ~/.config/solana/id.json

# Build and deploy
anchor build
anchor deploy
```

**Use cases**:
- Real-time gaming
- High-frequency trading
- Social media applications
- Microtransaction platforms

### Cross-VM Development
**Best for**: Maximum flexibility, atomic operations, arbitrage

```solidity
// EVM contract calling SVM program
pragma solidity ^0.8.0;

import "@atlas-sphere/contracts/CrossVM.sol";

contract AtomicArb is CrossVM {
    function executeArb(uint256 amount) external {
        // 1. Check EVM balances
        require(balanceOf(msg.sender) > amount, "Insufficient balance");
        
        // 2. Call SVM program atomically
        bytes32 result = crossVMCall(
            SVM_PROGRAM_ID,
            "executeTrade",
            abi.encode(amount)
        );
        
        // 3. Process SVM result in EVM
        uint256 profit = decodeProfit(result);
        if (profit > 0) {
            _settleProfit(profit);
        }
    }
}
```

**Use cases**:
- Cross-chain arbitrage
- Unified liquidity protocols
- Multi-domain applications
- Atomic swaps and trades

## Deploy Your First Contract

### EVM Contract Example

**contracts/HelloWorld.sol**
```solidity
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

contract HelloWorld {
    string public message;
    uint256 public counter;
    
    event MessageChanged(string oldMessage, string newMessage, uint256 timestamp);
    
    constructor(string memory _message) {
        message = _message;
        counter = 0;
    }
    
    function setMessage(string memory _message) external {
        string memory oldMessage = message;
        message = _message;
        counter++;
        
        emit MessageChanged(oldMessage, _message, block.timestamp);
    }
    
    function getMessage() external view returns (string memory) {
        return message;
    }
    
    function getCounter() external view returns (uint256) {
        return counter;
    }
}
```

**Deploy script (scripts/deploy.js)**
```javascript
const hre = require("hardhat");

async function main() {
    console.log("Deploying HelloWorld contract to Atlas Sphere...");
    
    const HelloWorld = await hre.ethers.getContractFactory("HelloWorld");
    const helloWorld = await HelloWorld.deploy("Hello Atlas Sphere!");
    
    await helloWorld.deployed();
    
    console.log("HelloWorld deployed to:", helloWorld.address);
    
    // Interact with the contract
    const message = await helloWorld.getMessage();
    console.log("Initial message:", message);
    
    const tx = await helloWorld.setMessage("Updated via Atlas Sphere!");
    await tx.wait();
    
    const updatedMessage = await helloWorld.getMessage();
    const counter = await helloWorld.getCounter();
    
    console.log("Updated message:", updatedMessage);
    console.log("Transaction count:", counter.toString());
}

main().catch((error) => {
    console.error(error);
    process.exit(1);
});
```

**Deploy with Hardhat**
```bash
# Install dependencies
npm install --save-dev hardhat @nomiclabs/hardhat-ethers

# Configure Hardhat (hardhat.config.js)
require("@nomiclabs/hardhat-ethers");

module.exports = {
  solidity: "0.8.0",
  networks: {
    atlas: {
      url: "http://localhost:9933",
      chainId: 1234,
      accounts: ["0x..."] // Your private key
    }
  }
};

# Deploy
npx hardhat run scripts/deploy.js --network atlas
```

### SVM Program Example

**programs/hello-world/src/lib.rs**
```rust
use anchor_lang::prelude::*;

declare_id!("YourProgramIDHere");

#[program]
pub mod hello_world {
    use super::*;

    pub fn initialize(ctx: Context<Initialize>, message: String) -> Result<()> {
        let account = &mut ctx.accounts.message_account;
        account.message = message;
        account.counter = 0;
        account.authority = ctx.accounts.authority.key();
        Ok(())
    }

    pub fn update_message(ctx: Context<UpdateMessage>, new_message: String) -> Result<()> {
        let account = &mut ctx.accounts.message_account;
        let old_message = account.message.clone();
        account.message = new_message;
        account.counter += 1;
        
        msg!("Updated message from '{}' to '{}'", old_message, account.message);
        Ok(())
    }

    pub fn get_message(ctx: Context<GetMessage>) -> Result<String> {
        Ok(ctx.accounts.message_account.message.clone())
    }
}

#[derive(Accounts)]
pub struct Initialize<'info> {
    #[account(init, payer = authority, space = 8 + 32 + 8 + 4 + 200)]
    pub message_account: Account<'info, MessageAccount>,
    #[account(mut)]
    pub authority: Signer<'info>,
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct UpdateMessage<'info> {
    #[account(mut, seeds = [b"message", authority.key().as_ref()], bump)]
    pub message_account: Account<'info, MessageAccount>,
    #[account(mut)]
    pub authority: Signer<'info>,
}

#[derive(Accounts)]
pub struct GetMessage<'info> {
    #[account(seeds = [b"message", authority.key().as_ref()], bump)]
    pub message_account: Account<'info, MessageAccount>,
    pub authority: Signer<'info>,
}

#[account]
pub struct MessageAccount {
    pub message: String,
    pub counter: u64,
    pub authority: Pubkey,
}
```

**Deploy with Anchor**
```bash
# Build and deploy
anchor build
anchor deploy

# Interact via CLI
anchor run initialize --message "Hello Atlas Sphere!"
anchor run update_message --new_message "Updated via Anchor!"
```

## Test Your Deployment

### EVM Testing
```javascript
// test/hello-world.test.js
const { expect } = require("chai");
const { ethers } = require("hardhat");

describe("HelloWorld", function () {
  it("Should deploy and interact with HelloWorld", async function () {
    const HelloWorld = await ethers.getContractFactory("HelloWorld");
    const helloWorld = await HelloWorld.deploy("Hello Atlas!");
    await helloWorld.deployed();

    expect(await helloWorld.getMessage()).to.equal("Hello Atlas!");
    
    await helloWorld.setMessage("Updated!");
    expect(await helloWorld.getMessage()).to.equal("Updated!");
    expect(await helloWorld.getCounter()).to.equal(1);
  });
});
```

```bash
# Run tests
npx hardhat test --network atlas
```

### SVM Testing
```rust
// tests/hello-world.ts
import * as anchor from "@project-serum/anchor";
import { Program } from "@project-serum/anchor";
import { HelloWorld } from "../target/types/hello_world";
import { expect } from "chai";

describe("hello-world", () => {
  const provider = anchor.AnchorProvider.env();
  anchor.setProvider(provider);
  const program = anchor.workspace.HelloWorld as Program<HelloWorld>;

  it("Initialize message account", async () => {
    const message = "Hello Atlas Sphere!";
    
    await program.methods
      .initialize(message)
      .accounts({
        messageAccount: anchor.web3.Keypair.generate().publicKey,
        authority: provider.wallet.publicKey,
        systemProgram: anchor.web3.SystemProgram.programId,
      })
      .rpc();

    const storedMessage = await program.methods.getMessage().rpc();
    expect(storedMessage).to.equal(message);
  });
});
```

```bash
# Run tests
anchor test
```

## Next Steps

### Explore Examples
- **[Cross-VM Atomic Operations](/docs/tutorials/cross-vm-atomic.md)** - Build apps that use both VMs
- **[DeFi Integration](/docs/examples/evm/defi-integration.js)** - Connect to popular protocols
- **[Gaming Examples](/docs/examples/svm/simple-game.rs)** - Build real-time games

### Advanced Features
- **[RPC API Reference](/docs/rpc.md)** - Detailed API documentation
- **[Cross-VM SDK](/docs/sdk/cross-vm-guide.md)** - Type-safe cross-VM development
- **[Gas Optimization](/docs/gas-optimization.md)** - Minimize transaction costs

### Join the Community
- **[Discord](https://discord.gg/atlas-sphere)** - Get help and share projects
- **[GitHub](https://github.com/atlas-sphere)** - Contribute and report issues
- **[Twitter](https://twitter.com/atlassphere)** - Follow updates

## Troubleshooting

### Common Issues

**Node won't start**
```bash
# Check if port is already in use
lsof -i :9944

# Kill existing processes
pkill -f atlas-sphere-node

# Start with different ports
atlas node start --dev --port 9945 --rpc-port 9934
```

**Wallet connection fails**
```bash
# Verify node is running
curl -X POST http://localhost:9933 \
  -H "Content-Type: application/json" \
  -d '{"jsonrpc":"2.0","method":"eth_blockNumber","params":[],"id":1}'

# Check WebSocket connection
wscat -c ws://localhost:9944
```

**Contract deployment fails**
```bash
# Check gas estimation
atlas node logs --tail 50

# Verify account has funds
curl -X POST http://localhost:9933 \
  -H "Content-Type: application/json" \
  -d '{"jsonrpc":"2.0","method":"eth_getBalance","params":["0xYourAddress","latest"],"id":1}'
```

**Why this matters**: Atlas Sphere provides detailed logging and debugging tools to help you resolve issues quickly and understand what's happening under the hood.

---

*Ready to build something amazing? Check out our [tutorials](/docs/tutorials/) for step-by-step guides to common patterns and use cases.*
