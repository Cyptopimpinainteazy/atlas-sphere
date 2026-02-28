# AGENTS.md

> **AI Coding Assistant Instructions** - This document guides AI tools (GitHub Copilot, Cursor, Claude, etc.) on how to work with this codebase effectively.

---

## Project Overview

**Description**: [![Build Status](https://github.com/Cyptopimpinainteazy/x3-chain/actions/workflows/ci.yml/badge.svg)](https://github.com/Cyptopimpinainteazy/x3-chain/actions/workflows/ci.yml) [![License](https://img.shields.io/badge/license-Apache%202.0-blue.svg)](./LICENSE)

**Tech Stack**:
- **Framework**: React
- **Language**: JavaScript
- **Build Tool**: Not detected
- **Styling**: CSS Modules
- **State Management**: React Context API
- **Routing**: Not configured
- **Data Fetching**: fetch API
- **Forms**: Native forms
- **Validation**: Manual validation
- **Testing**: Jest
- **Package Manager**: npm

---

## Quick Start

```bash
# Setup
npm install

# Development
npm run dev

# Build
npm run build

# Testing
npm run test

# Linting
npm run lint
```

---

## Project Structure

```
src/
├── components/
├── pages/
└── [Add your structure]
```



---

## Code Conventions

### General Guidelines

- **Language**: Use JavaScript for all files
- **Components**: Use functional components with hooks
- **File Naming**: PascalCase for components, camelCase for utilities

### Component Structure

```tsx
import { useState } from 'react';

export function UserCard({ user, onEdit }) {
  const [isExpanded, setIsExpanded] = useState(false);
  
  return (
    <div>
      {/* Component content */}
    </div>
  );
}
```

### Import Organization

```tsx
// 1. External dependencies
import { useState } from 'react';

// 2. Internal modules (use path aliases)
import { Component } from '../components/Component';

// 3. Types
import type { User } from '@/types';

// 4. Styles (if applicable)
import styles from './Component.module.css';
```

---

## Styling Approach

**Primary Method**: CSS Modules

- One CSS module per component
- Use camelCase for class names
- Leverage composition with `composes`

---

## State Management

**Approach**: React Context API

- Create context providers in `src/context/`
- Separate context by domain
- Use custom hooks to access context

---

## Data Fetching

**Method**: fetch API

- All API calls should be organized in the services layer
- Use proper error handling and loading states
- Leverage fetch API features for caching and optimistic updates

---

## Routing

**Router**: Not configured



---

## Forms & Validation

**Forms**: Native forms
**Validation**: Manual validation



---

## Testing

**Framework**: Jest

### Conventions

- Test file location: Co-located with components
- Naming: `ComponentName.test.tsx`
- Focus on user behavior and integration tests

---

## Environment Variables

**Location**: `.env.local`

```bash
NETWORK=arbitrum
PRIVATE_KEY=480c2f0730a4b305123b759f2a20ceb701643116671b232ffd5cdcbb90d4431a
METAMASK_ADDRESS=0x7f1d163dBe1d42F9813820996e039E6f81D5f62c
METAMASK_PRIVATE_KEY=480c2f0730a4b305123b759f2a20ceb701643116671b232ffd5cdcbb90d4431a
ALCHEMY_API_KEY_NAME=BIG QUANTUM DICK
ALCHEMY_ACCESS_KEY=alcht_DanyPQsXsZC7wQKyklHQjrvh7xuYKp
ALCHEMY_API_KEY=Fe5T2pGsX76ml9kDCwVRZhtmkdixfrDQ
ALCHEMY_ARBITRUM_URL=https://arb-mainnet.g.alchemy.com/v2/Fe5T2pGsX76ml9kDCwVRZhtmkdixfrDQ
ALCHEMY_ARBITRUM_GOERLI_URL=https://arb-goerli.g.alchemy.com/v2/Fe5T2pGsX76ml9kDCwVRZhtmkdixfrDQ
DRPC_USER_ID=cb036e94-646b-4243-b1a0-0af6e332cf34
DRPC_API_KEY=ArgUBy0RzURpos-Jlz1TqLRxbgscV2AR8JXZrqRhf0fE
DRPC_STATISTICS_API_TOKEN=888155ef35ae5fbd5a3c56a2e5c6329dbe338d6a5fb363d03075314da1d495dd
DRPC_KEYS_API_TOKEN=834b4b61b9fcec622084fa65f094de5840488dd8e9ff8cf52a248ca42b09f977
DRPC_BASE_URL=https://lb.drpc.org/base/ArgUBy0RzURpos-Jlz1TqLRxbgscV2AR8JXZrqRhf0fE
DRPC_BASE_WSS=wss://lb.drpc.org/base/ArgUBy0RzURpos-Jlz1TqLRxbgscV2AR8JXZrqRhf0fE
DRPC_ARBITRUM_URL=https://lb.drpc.org/arbitrum/ArgUBy0RzURpos-Jlz1TqLRxbgscV2AR8JXZrqRhf0fE
DRPC_ARBITRUM_WSS=wss://lb.drpc.org/arbitrum/ArgUBy0RzURpos-Jlz1TqLRxbgscV2AR8JXZrqRhf0fE
DRPC_ZKSYNC_ERA_URL=https://lb.drpc.org/zksync-era/ArgUBy0RzURpos-Jlz1TqLRxbgscV2AR8JXZrqRhf0fE
DRPC_ZKSYNC_ERA_WSS=wss://lb.drpc.org/zksync-era/ArgUBy0RzURpos-Jlz1TqLRxbgscV2AR8JXZrqRhf0fE
ANKR_API_KEY=648269110992d35fb12b490f3e9d00e18141ad9212081909344f15ec1c342a3c
ANKR_BASE_URL=https://rpc.ankr.com/base/648269110992d35fb12b490f3e9d00e18141ad9212081909344f15ec1c342a3c
ANKR_BASE_WSS=wss://rpc.ankr.com/base/ws/648269110992d35fb12b490f3e9d00e18141ad9212081909344f15ec1c342a3c
ANKR_ARBITRUM_URL=https://rpc.ankr.com/arbitrum/648269110992d35fb12b490f3e9d00e18141ad9212081909344f15ec1c342a3c
ANKR_ARBITRUM_WSS=wss://rpc.ankr.com/arbitrum/ws/648269110992d35fb12b490f3e9d00e18141ad9212081909344f15ec1c342a3c
ANKR_ZKSYNC_ERA_URL=https://rpc.ankr.com/zksync_era/648269110992d35fb12b490f3e9d00e18141ad9212081909344f15ec1c342a3c
ANKR_ZKSYNC_ERA_WSS=wss://rpc.ankr.com/zksync_era/ws/648269110992d35fb12b490f3e9d00e18141ad9212081909344f15ec1c342a3c
ARBITRUM_GAS_MULTIPLIER=1.1
POLYGON_GAS_MULTIPLIER=1.5
OPTIMISM_GAS_MULTIPLIER=1.1
BASE_GAS_MULTIPLIER=1.2
ZKSYNC_GAS_MULTIPLIER=1.05
LINEA_GAS_MULTIPLIER=1.2
AAVE_V3_POOL_ARBITRUM=0x794a61358D6845594F94dc1DB02A252b5b4814aD
AAVE_V3_POOL_DATA_PROVIDER=0x69FA688f1Dc47d4B5d8029D5a35FB7a548310654
BALANCER_VAULT=0xBA12222222228d8Ba445958a75a0704d566BF2C8
DFORCE_FLASH_LOAN=0x0988f3C0cFd7F0326475fA7fDa7F64e0663B70F0
RADIANT_LENDING_POOL=0xF4B1486DD74D07706052A33d31d7c0AAFD0659E1
UNISWAP_V3_ROUTER_ARBITRUM=0xE592427A0AEce92De3Edee1F18E0157C05861564
UNISWAP_V3_QUOTER=0xb27308f9F90D607463bb33eA1BeBb41C27CE5AB6
UNISWAP_V3_FACTORY=0x1F98431c8aD98523631AE4a59f267346ea31F984
UNISWAP_V2_ROUTER_ARBITRUM=0x7a250d5630B4cF539739dF2C5dAcb4c659F2488D
SUSHI_V2_ROUTER_ARBITRUM=0x1b02dA8Cb0d097eB8D57A175b88c7D8b47997506
CAMELOT_V2_ROUTER=0xc873fEcbd354f5A56E00E710B90EF4201db2448d
CAMELOT_V2_FACTORY=0x6EcCab422D763aC031210895C81787E87B43A652
TRADER_JOE_V2_ROUTER=0xb4315eDB925C2c89bFdE53d243b4db61b5D0a4e2
TRADER_JOE_V2_FACTORY=0x8e42f2F4101563bF679975178e880FD87d3eFd4e
RAMSES_V2_ROUTER=0xAAA87963EFeB6f7E0a2711F397663105Acb1805e
RAMSES_V2_FACTORY=0xAAA20D08e59F6561f242b08513D36266C5A29415
CHRONOS_ROUTER=0xE708aa9E887980750C040a6A2Cb901c37aA63434
CHRONOS_FACTORY=0xCEFb89f8103fC792B03C15d8c722a48A5C049660
FLASHBOTS_MAINNET=https://relay.flashbots.net
FLASHBOTS_GOERLI=https://relay-goerli.flashbots.net
FLASHBOTS_SEPOLIA=https://relay-sepolia.flashbots.net
FLASHBOTS_ARBITRUM=https://arb1.arbitrum.io/rpc
FLASHBOTS_SIGNER_KEY=480c2f0730a4b305123b759f2a20ceb701643116671b232ffd5cdcbb90d4431a
FLASHBOTS_REPUTATION_ADDRESS=0x7f1d163dBe1d42F9813820996e039E6f81D5f62c
PORT=3001
CHECK_INTERVAL=15000
MAX_SLIPPAGE=1
MIN_PROFIT_THRESHOLD=0.5
MAX_GAS_PRICE=100
ONEINCH_API_KEY=Fe5T2pGsX76ml9kDCwVRZhtmkdixfrDQ
ETHERSCAN_API_KEY=59KQ8D4PACXE7IAGVHIMZXGP9R5RWT16P6
ALPHA_VANTAGE_API_KEY=E0C2806UYN2TZ15F
KRAKEN_API_KEY=7NNktdD2+MHWDkCO2tmhj525qHIjzNCP6DtSt8qWgTxozW9ma0XlRF/6
KRAKEN_PRIVATE_KEY=P7J6hzhwgR08u1QKebQdM5wLB1GUBNZToa2o+UR6z0rIPJppvZ9sSC1bSCa/0IEEwT2ig6/OOVBiwGhdtYhMWQ
BINANCE.US_API_KEY=Ex9jB524b654G7yOk6OqFIuLzKNKZCljA5QdXHmCWUM1a5yu8BwJ78wzIapJjvet
BINANCE.US_SECRETE_KEY=OXBXXwflim7OWwLQ3IC0P8exKTkXs3pc9rYMRSTHqWrsjNsUVElIErXZhSgvvXpg
TELEGRAM_API_TOKEN=7622292754:AAGWItLqVBfjliMXPcDWDS0S13HbOhaodyo
TELEGRAM_CHAT_ID=https://t.me/x3star1/5
IBM_QUANTUM_TOKEN=0d28c1c5fdb6115d111c089a768870215de9a343b80d8371809edce4d99992d89eb2f002fdc303d437818c0909279a7d925a1297f025e90be6ded4a4b3ff3569
ENVIRONMENT=development
DEBUG=false
LOG_LEVEL=INFO
Save these credentials securely. They won't be shown again.=[value]
Validator ID=[value]
solana_a19181e3574ca5a9=[value]
API Key=[value]
infra_3JDGhaxUOfLfyuFk-roJiR3FzgdgcipAH3vG5wpMzDo=[value]
API Secret (Save Now!)=[value]
Ur6cNEyS36LMcgypKZJuzdt-xHGhVu-Q7iP079fkA3jcmVC-shpe0bFG34khAWOB=[value]
⚠️ This secret is only shown once. Store it securely!=[value]
SLA TierZ b            b=[value]
```

**Note**: Never commit `.env.local` - use `.env.example` as template

---

## Available Scripts

- `npm run start` - Start production server
- `npm run start:dev` - node llm-service/router.js --config ./llm-config.json
- `npm run test` - Run tests
- `npm run test:open` - cypress open
- `npm run test:polkawallet` - npm test --workspace packages/polkawallet-plugin
- `npm run test:bridge` - npm test --workspace packages/polkawallet-bridge-adapter
- `npm run test:ts-sdk` - npm test --workspace packages/ts-sdk
- `npm run test:all-packages` - npm test --workspaces --if-present
- `npm run build:polkawallet` - npm run build --workspace packages/polkawallet-plugin
- `npm run build:bridge` - npm run build --workspace packages/polkawallet-bridge-adapter
- `npm run build:all-packages` - npm run build --workspaces --if-present
- `npm run bmad:install` - npm --prefix crates/vibe-bmad run install-bmad
- `npm run bmad:status` - npm --prefix crates/vibe-bmad run status
- `npm run bmad:ci-install` - npm --prefix crates/vibe-bmad run ci-install
- `npm run llm:router` - node llm-service/router.js
- `npm run llm:examples` - node llm-service/examples.js
- `npm run llm:verify` - bash verify-llm-integration.sh

---

## Path Aliases

No path aliases configured.

---

## AI Assistant Guidelines

### When Generating Code

1. **Follow existing patterns**: Match the style and structure in the codebase
2. **Use type safety**: Always use JavaScript types
3. **Use path aliases**: Import using configured aliases
4. **Match styling approach**: Use CSS Modules conventions
5. **Follow state management**: Use React Context API patterns

### When Refactoring

1. Preserve functionality
2. Maintain type safety
3. Update related tests
4. Follow established conventions

---

**Last Generated**: 2026-02-13  
**Auto-generated from**: package.json, tsconfig.json, and project structure

> 💡 **Tip**: Use the Agent Automation dashboard to regenerate this file after major changes.
