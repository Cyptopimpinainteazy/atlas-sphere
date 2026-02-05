/**
 * Cross-Chain Trading Page
 *
 * Atomic cross-chain swaps between Solana, Bitcoin, Atlas Sphere, and 100+ EVM chains.
 */

import { Metadata } from 'next';
import CrossChainSwap, { AtlasConnectionStatus } from '@/components/dex/CrossChainSwap';
import { 
  TOTAL_CHAIN_COUNT, 
  EVM_CHAIN_COUNT,
  getUniqueChains,
} from '@/lib/cross-chain-trading';

export const metadata: Metadata = {
  title: 'Cross-Chain Swap | Atlas Sphere DEX',
  description:
    `Execute atomic cross-chain swaps across ${TOTAL_CHAIN_COUNT}+ chains including Bitcoin, Solana, and ${EVM_CHAIN_COUNT}+ EVM networks`,
};

// Chain categories for display
const CHAIN_CATEGORIES = [
  {
    name: 'Bitcoin',
    icon: '₿',
    color: 'text-orange-500',
    bgColor: 'bg-orange-500/5',
    borderColor: 'border-orange-500/20',
    chains: ['Bitcoin Mainnet', 'Bitcoin Testnet'],
    features: ['HTLC Atomic Swaps', 'Native BTC Support', 'Trustless Exchange'],
  },
  {
    name: 'Solana',
    icon: '◎',
    color: 'text-purple-500',
    bgColor: 'bg-purple-500/5',
    borderColor: 'border-purple-500/20',
    chains: ['Solana Mainnet', 'Solana Devnet'],
    features: ['SPL Token Support', 'High Speed', 'Low Fees'],
  },
  {
    name: 'Atlas Sphere',
    icon: '🔷',
    color: 'text-cyan-500',
    bgColor: 'bg-cyan-500/5',
    borderColor: 'border-cyan-500/20',
    chains: ['Atlas SVM', 'Atlas EVM'],
    features: ['Dual VM Architecture', 'Atomic Comit Tx', 'Canonical Ledger'],
  },
  {
    name: 'Layer 2 Rollups',
    icon: '⚡',
    color: 'text-blue-500',
    bgColor: 'bg-blue-500/5',
    borderColor: 'border-blue-500/20',
    chains: ['Arbitrum', 'Optimism', 'Base', 'zkSync', 'Linea', 'Scroll', 'Blast', 'Mantle', 'Mode', 'Zora'],
    features: ['Low Gas Fees', 'Fast Finality', 'Ethereum Security'],
  },
  {
    name: 'EVM Mainnets',
    icon: 'Ξ',
    color: 'text-indigo-500',
    bgColor: 'bg-indigo-500/5',
    borderColor: 'border-indigo-500/20',
    chains: ['Ethereum', 'Polygon', 'BSC', 'Avalanche', 'Fantom', 'Gnosis', 'Celo'],
    features: ['Battle Tested', 'Deep Liquidity', 'Wide Token Support'],
  },
  {
    name: 'Bitcoin L2s',
    icon: '₿',
    color: 'text-yellow-500',
    bgColor: 'bg-yellow-500/5',
    borderColor: 'border-yellow-500/20',
    chains: ['Rootstock', 'Bitlayer', 'BOB', 'Merlin', 'B² Network'],
    features: ['BTC-Native DeFi', 'Smart Contracts', 'Bitcoin Security'],
  },
];

export default function CrossChainPage() {
  const uniqueChains = getUniqueChains();

  return (
    <main className="container mx-auto px-4 py-8 max-w-6xl">
      <div className="space-y-8">
        {/* Header */}
        <div className="text-center space-y-2">
          <h1 className="text-4xl font-bold">⚡ Multi-Chain Atomic Swaps</h1>
          <p className="text-muted-foreground max-w-3xl mx-auto">
            Trade assets atomically across <span className="font-semibold text-primary">{TOTAL_CHAIN_COUNT}+ chains</span> including 
            Bitcoin, Solana, Atlas Sphere, and <span className="font-semibold text-blue-500">{EVM_CHAIN_COUNT}+ EVM networks</span>.
            All swaps execute through the Atlas Kernel for guaranteed atomic settlement.
          </p>
        </div>

        {/* Stats Bar */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="rounded-lg border bg-card p-4 text-center">
            <div className="text-3xl font-bold text-primary">{TOTAL_CHAIN_COUNT}+</div>
            <div className="text-sm text-muted-foreground">Supported Chains</div>
          </div>
          <div className="rounded-lg border bg-card p-4 text-center">
            <div className="text-3xl font-bold text-blue-500">{EVM_CHAIN_COUNT}+</div>
            <div className="text-sm text-muted-foreground">EVM Networks</div>
          </div>
          <div className="rounded-lg border bg-card p-4 text-center">
            <div className="text-3xl font-bold text-orange-500">₿</div>
            <div className="text-sm text-muted-foreground">Bitcoin Native</div>
          </div>
          <div className="rounded-lg border bg-card p-4 text-center">
            <div className="text-3xl font-bold text-green-500">100%</div>
            <div className="text-sm text-muted-foreground">Atomic Execution</div>
          </div>
        </div>

        {/* Main content */}
        <div className="grid lg:grid-cols-5 gap-6">
          {/* Swap interface - 3 columns */}
          <div className="lg:col-span-3 space-y-6">
            <CrossChainSwap />
            <AtlasConnectionStatus />
          </div>

          {/* Sidebar - 2 columns */}
          <div className="lg:col-span-2 space-y-4">
            {/* How it works */}
            <div className="rounded-lg border bg-card p-4 space-y-3">
              <h3 className="font-semibold">How it works</h3>
              <ul className="text-sm text-muted-foreground space-y-2">
                <li className="flex items-start gap-2">
                  <span className="font-medium text-primary">1.</span>
                  Select source and destination chains
                </li>
                <li className="flex items-start gap-2">
                  <span className="font-medium text-primary">2.</span>
                  Choose tokens and enter amount
                </li>
                <li className="flex items-start gap-2">
                  <span className="font-medium text-primary">3.</span>
                  Review route and execute atomic swap
                </li>
                <li className="flex items-start gap-2">
                  <span className="font-medium text-primary">4.</span>
                  Both sides complete or neither does
                </li>
              </ul>
            </div>

            {/* Chain Categories */}
            {CHAIN_CATEGORIES.map((category) => (
              <div 
                key={category.name}
                className={`rounded-lg border ${category.bgColor} ${category.borderColor} p-4 space-y-2`}
              >
                <h3 className={`font-semibold ${category.color} flex items-center gap-2`}>
                  <span>{category.icon}</span> {category.name}
                </h3>
                <div className="flex flex-wrap gap-1">
                  {category.chains.slice(0, 5).map((chain) => (
                    <span 
                      key={chain}
                      className="px-2 py-0.5 rounded text-xs bg-background/50 text-muted-foreground"
                    >
                      {chain}
                    </span>
                  ))}
                  {category.chains.length > 5 && (
                    <span className="px-2 py-0.5 rounded text-xs bg-background/50 text-muted-foreground">
                      +{category.chains.length - 5} more
                    </span>
                  )}
                </div>
                <ul className="text-xs text-muted-foreground space-y-0.5 mt-2">
                  {category.features.map((feature) => (
                    <li key={feature}>• {feature}</li>
                  ))}
                </ul>
              </div>
            ))}

            {/* Testnet Warning */}
            <div className="rounded-lg border bg-amber-500/10 border-amber-500/20 p-4">
              <h3 className="font-semibold text-amber-500">⚠️ Testnet Mode</h3>
              <p className="text-sm text-muted-foreground mt-1">
                Connected to Atlas Sphere Testnet. Get test tokens from the{' '}
                <a
                  href="https://faucet.testnet.atlas-sphere.io"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-primary underline"
                >
                  Atlas Faucet
                </a>
                .
              </p>
            </div>
          </div>
        </div>

        {/* Full Chain List (Collapsed) */}
        <details className="rounded-lg border bg-card">
          <summary className="p-4 cursor-pointer font-semibold">
            📋 View All {TOTAL_CHAIN_COUNT}+ Supported Chains
          </summary>
          <div className="p-4 pt-0 grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-2">
            {uniqueChains.map((chain) => (
              <div 
                key={`${chain.chainType}-${chain.chainId}`}
                className="px-2 py-1 rounded text-xs bg-muted/50 text-muted-foreground truncate"
                title={chain.name}
              >
                {chain.name}
              </div>
            ))}
          </div>
        </details>
      </div>
    </main>
  );
}
