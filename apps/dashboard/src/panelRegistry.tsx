import React, { lazy } from 'react';

// Sprint 13 Phase 1: Infrastructure & Optimization (Panels 1-12)
const ChainCoreOptimizationPanel = lazy(() => import('./panels/infrastructure/ChainCoreOptimizationPanel'));
const DynamicFeeMarketPanel = lazy(() => import('./panels/infrastructure/DynamicFeeMarketPanel'));
const CrossChainBridgePanel = lazy(() => import('./panels/infrastructure/CrossChainBridgePanel'));
const SolanaAdapterPanel = lazy(() => import('./panels/adapters/SolanaAdapterPanel'));
const CRMDatabasePanel = lazy(() => import('./panels/backend/CRMDatabasePanel'));
const SocialBackendPanel = lazy(() => import('./panels/backend/SocialBackendPanel'));
const AgentMarketplacePanel = lazy(() => import('./panels/agents/AgentMarketplacePanel'));
const ValidatorAutomationPanel = lazy(() => import('./panels/tools/ValidatorAutomationPanel'));
const TerminalShellPanel = lazy(() => import('./panels/tools/TerminalShellPanel'));
const PriceOraclePanel = lazy(() => import('./panels/integration/PriceOraclePanel'));
const WebWorkerOptimizationPanel = lazy(() => import('./panels/performance/WebWorkerOptimizationPanel'));
const NFTCRMIntegrationPanel = lazy(() => import('./panels/integration/NFTCRMIntegrationPanel'));

export const panelRegistry = {
  // Infrastructure Panels (GPU, Fees, Bridges)
  'gpu-pooling': ChainCoreOptimizationPanel,
  'gpu': ChainCoreOptimizationPanel,
  'gpu-optimization': ChainCoreOptimizationPanel,
  'chain-core-optimization': ChainCoreOptimizationPanel,
  'multi-device-gpu': ChainCoreOptimizationPanel,
  'memory-pool': ChainCoreOptimizationPanel,
  'fallback-chain': ChainCoreOptimizationPanel,
  'kernel-versioning': ChainCoreOptimizationPanel,
  'benchmark-attestation': ChainCoreOptimizationPanel,

  'dynamic-fees': DynamicFeeMarketPanel,
  'eip-1559': DynamicFeeMarketPanel,
  'mev-protection': DynamicFeeMarketPanel,
  'slashing-insurance': DynamicFeeMarketPanel,
  'validator-commission': DynamicFeeMarketPanel,
  'fee-market': DynamicFeeMarketPanel,
  'commit-reveal': DynamicFeeMarketPanel,
  'threshold-encryption': DynamicFeeMarketPanel,
  'dark-pool': DynamicFeeMarketPanel,
  'commission-caps': DynamicFeeMarketPanel,

  'cross-chain': CrossChainBridgePanel,
  'bridges': CrossChainBridgePanel,
  'ethereum-bridge': CrossChainBridgePanel,
  'solana-wormhole': CrossChainBridgePanel,
  'cosmos-ibc': CrossChainBridgePanel,
  'bitcoin-htlc': CrossChainBridgePanel,
  'security-council': CrossChainBridgePanel,
  'multisig': CrossChainBridgePanel,
  'liquidity-bridge': CrossChainBridgePanel,

  // Adapter Panels (Solana)
  'solana': SolanaAdapterPanel,
  'solana-programs': SolanaAdapterPanel,
  'spl-token': SolanaAdapterPanel,
  'anchor': SolanaAdapterPanel,
  'token-program': SolanaAdapterPanel,
  'assoc-token': SolanaAdapterPanel,
  'uniswap-v3': SolanaAdapterPanel,
  'aave-v3': SolanaAdapterPanel,
  'pyth-oracle': SolanaAdapterPanel,

  // Backend Panels (CRM, Social)
  'crm': CRMDatabasePanel,
  'crm-database': CRMDatabasePanel,
  'contacts': CRMDatabasePanel,
  'deals': CRMDatabasePanel,
  'sales-pipeline': CRMDatabasePanel,
  'email-campaigns': CRMDatabasePanel,
  'import-export': CRMDatabasePanel,
  'smtp': CRMDatabasePanel,
  'pipeline-tracking': CRMDatabasePanel,

  'social': SocialBackendPanel,
  'activitypub': SocialBackendPanel,
  'federation': SocialBackendPanel,
  'e2e-encryption': SocialBackendPanel,
  'ipfs-media': SocialBackendPanel,
  'communities': SocialBackendPanel,
  'x3dh': SocialBackendPanel,
  'chacha20': SocialBackendPanel,
  'messaging': SocialBackendPanel,

  // Agent Panels (Marketplace)
  'agents': AgentMarketplacePanel,
  'agent-marketplace': AgentMarketplacePanel,
  'agent-trading': AgentMarketplacePanel,
  'sandboxing': AgentMarketplacePanel,
  'security-audits': AgentMarketplacePanel,
  'multi-agent': AgentMarketplacePanel,
  'agent-coordination': AgentMarketplacePanel,
  'hierarchical-agents': AgentMarketplacePanel,
  'sequential-agents': AgentMarketplacePanel,

  // Tools Panels (Validators, Terminal)
  'validators': ValidatorAutomationPanel,
  'validator-automation': ValidatorAutomationPanel,
  'one-click-setup': ValidatorAutomationPanel,
  'slashing-alerts': ValidatorAutomationPanel,
  'auto-compound': ValidatorAutomationPanel,
  'staking': ValidatorAutomationPanel,
  'network-health': ValidatorAutomationPanel,
  'validator-metrics': ValidatorAutomationPanel,
  'delegation': ValidatorAutomationPanel,

  'terminal': TerminalShellPanel,
  'shell': TerminalShellPanel,
  'pty-terminal': TerminalShellPanel,
  'x3-cli': TerminalShellPanel,
  'command-history': TerminalShellPanel,
  'repl': TerminalShellPanel,
  'x3-lang': TerminalShellPanel,
  'cli-reference': TerminalShellPanel,

  // Integration Panels (Oracle, NFT-CRM)
  'oracle': PriceOraclePanel,
  'price-oracle': PriceOraclePanel,
  'pyth': PriceOraclePanel,
  'chainlink': PriceOraclePanel,
  'twap': PriceOraclePanel,
  'band-protocol': PriceOraclePanel,
  'amm-liquidity': PriceOraclePanel,
  'price-feeds': PriceOraclePanel,

  'nft-crm': NFTCRMIntegrationPanel,
  'wallet-linking': NFTCRMIntegrationPanel,
  'on-chain-deals': NFTCRMIntegrationPanel,
  'token-gated': NFTCRMIntegrationPanel,
  'nft-portfolio': NFTCRMIntegrationPanel,
  'nft-collection': NFTCRMIntegrationPanel,
  'gated-groups': NFTCRMIntegrationPanel,
  'wallet-verification': NFTCRMIntegrationPanel,

  // Performance Panels (Web Workers)
  'web-workers': WebWorkerOptimizationPanel,
  'worker-threads': WebWorkerOptimizationPanel,
  'gpu-compositing': WebWorkerOptimizationPanel,
  'webgl': WebWorkerOptimizationPanel,
  'wgpu': WebWorkerOptimizationPanel,
  'startup-preload': WebWorkerOptimizationPanel,
  'frame-compositing': WebWorkerOptimizationPanel,
  'performance-optimization': WebWorkerOptimizationPanel,
  'page-load': WebWorkerOptimizationPanel,
};

export type PanelId = keyof typeof panelRegistry;

export function getPanelComponent(panelId: PanelId): React.ComponentType | undefined {
  return panelRegistry[panelId];
}

export function getAllPanels() {
  return Object.keys(panelRegistry) as PanelId[];
}

export const panelMetadata = {
  'gpu-pooling': {
    name: 'Chain Core Optimization',
    category: 'Infrastructure',
    description: 'GPU pooling, multi-device optimization, memory management, and fallback chains',
    tags: ['gpu', 'performance', 'hardware', 'optimization'],
  },
  'dynamic-fees': {
    name: 'Dynamic Fee Market',
    category: 'Infrastructure',
    description: 'EIP-1559 fee structure, MEV protection, slashing insurance, and validator commission caps',
    tags: ['fees', 'mev', 'validator', 'economics'],
  },
  'cross-chain': {
    name: 'Cross-Chain Bridges',
    category: 'Infrastructure',
    description: 'Multi-chain bridge infrastructure with security council and liquidity pools',
    tags: ['bridges', 'cross-chain', 'security', 'liquidity'],
  },
  'solana': {
    name: 'Solana Adapter',
    category: 'Adapters',
    description: '10 standard Solana programs with Anchor framework and SPL token integration',
    tags: ['solana', 'programs', 'spl', 'anchor'],
  },
  'crm': {
    name: 'CRM Database',
    category: 'Backend',
    description: 'Real contact database with sales pipeline, email campaigns, and import/export',
    tags: ['crm', 'sales', 'contacts', 'database'],
  },
  'social': {
    name: 'Social Backend',
    category: 'Backend',
    description: 'ActivityPub federation, E2E encrypted messaging, IPFS media, and communities',
    tags: ['social', 'federation', 'messaging', 'media'],
  },
  'agents': {
    name: 'Agent Marketplace',
    category: 'Agents',
    description: 'AI agent marketplace with sandboxing, security audits, and multi-agent coordination',
    tags: ['agents', 'marketplace', 'ai', 'automation'],
  },
  'validators': {
    name: 'Validator Automation',
    category: 'Tools',
    description: 'One-click validator setup, metrics, slashing alerts, and auto-compound staking',
    tags: ['validators', 'staking', 'automation', 'monitoring'],
  },
  'terminal': {
    name: 'Terminal Shell',
    category: 'Tools',
    description: 'Real PTY terminal with X3 CLI reference and REPL environment',
    tags: ['terminal', 'cli', 'repl', 'commands'],
  },
  'oracle': {
    name: 'Price Oracle',
    category: 'Integration',
    description: 'Pyth, Chainlink, TWAP aggregation, and AMM liquidity providers',
    tags: ['oracle', 'prices', 'feeds', 'liquidity'],
  },
  'nft-crm': {
    name: 'NFT-CRM Integration',
    category: 'Integration',
    description: 'Wallet linking, on-chain deals, token-gated groups, and NFT portfolio metrics',
    tags: ['nft', 'crm', 'wallet', 'blockchain'],
  },
  'web-workers': {
    name: 'Web Workers & GPU Compositing',
    category: 'Performance',
    description: 'Worker threads, WebGL 2.0, WGPU, and startup preload optimization',
    tags: ['performance', 'workers', 'gpu', 'optimization'],
  },
};

export default panelRegistry;
