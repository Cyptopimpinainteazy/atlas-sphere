#!/bin/bash

# Create necessary directories
mkdir -p data/docs/uniswap-v2
mkdir -p data/docs/uniswap-v3
mkdir -p data/docs/contracts

# Download Uniswap V2 documentation
echo "Downloading Uniswap V2 documentation..."
curl -s https://raw.githubusercontent.com/Uniswap/v2-core/master/README.md > data/docs/uniswap-v2/README.md
curl -s https://raw.githubusercontent.com/Uniswap/v2-core/master/contracts/UniswapV2Pair.sol > data/docs/uniswap-v2/UniswapV2Pair.sol
curl -s https://raw.githubusercontent.com/Uniswap/v2-core/master/contracts/UniswapV2Factory.sol > data/docs/uniswap-v2/UniswapV2Factory.sol
curl -s https://raw.githubusercontent.com/Uniswap/v2-periphery/master/contracts/UniswapV2Router02.sol > data/docs/uniswap-v2/UniswapV2Router02.sol

# Download Uniswap V3 documentation
echo "Downloading Uniswap V3 documentation..."
curl -s https://raw.githubusercontent.com/Uniswap/v3-core/main/README.md > data/docs/uniswap-v3/README.md
curl -s https://raw.githubusercontent.com/Uniswap/v3-core/main/contracts/UniswapV3Pool.sol > data/docs/uniswap-v3/UniswapV3Pool.sol
curl -s https://raw.githubusercontent.com/Uniswap/v3-core/main/contracts/UniswapV3Factory.sol > data/docs/uniswap-v3/UniswapV3Factory.sol

# Download common contract interfaces
echo "Downloading common contract interfaces..."
curl -s https://raw.githubusercontent.com/OpenZeppelin/openzeppelin-contracts/master/contracts/token/ERC20/IERC20.sol > data/docs/contracts/IERC20.sol
curl -s https://raw.githubusercontent.com/OpenZeppelin/openzeppelin-contracts/master/contracts/token/ERC721/IERC721.sol > data/docs/contracts/IERC721.sol

# Create some custom documentation
echo "Creating custom documentation..."

cat > data/docs/contracts/EthereumBasics.md << EOL
# Ethereum Basics

Ethereum is a decentralized, open-source blockchain with smart contract functionality. Ether (ETH) is the native cryptocurrency of the platform.

## Key Concepts

- **Accounts**: There are two types of accounts in Ethereum:
- Externally Owned Accounts (EOAs): Controlled by private keys
- Contract Accounts: Controlled by their code

- **Transactions**: Operations that change the state of the Ethereum blockchain
- From: Sender address
- To: Recipient address
- Value: Amount of ETH to transfer
- Data: Optional data payload
- Gas Limit: Maximum gas to use
- Gas Price: Price per unit of gas

- **Gas**: Unit that measures computational effort required to execute operations
- Gas Limit: Maximum amount of gas you're willing to use
- Gas Price: Amount of ETH you're willing to pay per unit of gas

- **Smart Contracts**: Programs that run on the Ethereum blockchain
- Self-executing with specific conditions written into code
- Automatically enforce agreements between parties

## Common Operations

- Sending ETH: Transfer value from one account to another
- Deploying Contracts: Upload contract code to the blockchain
- Calling Contract Functions: Interact with deployed contracts
EOL

cat > data/docs/contracts/TokenStandards.md << EOL
# Ethereum Token Standards

## ERC-20

The most widely used token standard for fungible tokens.

### Key Functions

- **totalSupply()**: Returns the total token supply
- **balanceOf(address)**: Returns the account balance of an address
- **transfer(address, uint256)**: Transfers tokens to a specified address
- **transferFrom(address, address, uint256)**: Transfers tokens from one address to another
- **approve(address, uint256)**: Allows spender to withdraw from your account
- **allowance(address, address)**: Returns the amount which spender is allowed to withdraw

## ERC-721

Standard for non-fungible tokens (NFTs).

### Key Functions

- **balanceOf(address)**: Returns the number of NFTs owned by an address
- **ownerOf(uint256)**: Returns the owner of a specific NFT
- **safeTransferFrom(address, address, uint256)**: Transfers ownership of an NFT
- **approve(address, uint256)**: Grants permission to transfer a specific NFT
- **getApproved(uint256)**: Returns the approved address for a specific NFT
- **setApprovalForAll(address, bool)**: Enables or disables approval for a third party to manage all of the caller's NFTs
- **isApprovedForAll(address, address)**: Returns if an operator is approved by a given owner
EOL

cat > data/docs/uniswap-v2/UniswapV2Overview.md << EOL
# Uniswap V2 Overview

Uniswap V2 is an automated market maker (AMM) protocol that facilitates token swaps on Ethereum.

## Key Components

- **UniswapV2Factory**: Creates and manages Uniswap pairs
- **UniswapV2Pair**: Implements the core AMM logic and holds reserves
- **UniswapV2Router02**: Provides user-friendly functions for interacting with pairs

## Core Concepts

### Constant Product Formula

Uniswap V2 uses the constant product formula: x * y = k

Where:
- x is the reserve of token A
- y is the reserve of token B
- k is a constant value

This formula ensures that the product of the reserves remains constant after trades.

### Liquidity Provision

Users can provide liquidity by depositing both tokens in the correct ratio.
In return, they receive LP tokens representing their share of the pool.

### Swapping

When users swap tokens, they pay a 0.3% fee that goes to liquidity providers.
The price impact depends on the size of the swap relative to the pool reserves.

### Price Oracle

Uniswap V2 includes a time-weighted average price (TWAP) oracle that can be used
to determine the average price of a token over time.
EOL

echo "RAG system populated with documentation!"