import dynamic from 'next/dynamic'
import { ReactNode } from 'react'
import { createSolanaDevnet, createSolanaLocalnet, createSolanaMainnet, createWalletUiConfig, WalletUi } from '@wallet-ui/react'
import type { WalletUiCluster } from '@wallet-ui/react'

export const WalletButton = dynamic(async () => (await import('@wallet-ui/react')).WalletUiDropdown, {
  ssr: false,
})
export const ClusterButton = dynamic(async () => (await import('@wallet-ui/react')).WalletUiClusterDropdown, {
  ssr: false,
})

// Atlas Sphere Testnet Configuration
export const ATLAS_SPHERE_TESTNET: WalletUiCluster = {
  id: 'atlas-testnet',
  label: 'Atlas Sphere Testnet',
  cluster: 'testnet',
  // Atlas Sphere RPC endpoint (Substrate-based with SVM compatibility)
  endpoint: process.env.NEXT_PUBLIC_ATLAS_RPC_ENDPOINT || 'http://rpc.testnet.atlas-sphere.io:9944',
  // Custom explorer for Atlas Sphere
  explorer: {
    label: 'Atlas Explorer',
    getUrl: (path: string) => `https://explorer.testnet.atlas-sphere.io${path}`,
  },
}

// Atlas Sphere Mainnet Configuration (for future use)
export const ATLAS_SPHERE_MAINNET: WalletUiCluster = {
  id: 'atlas-mainnet',
  label: 'Atlas Sphere',
  cluster: 'mainnet-beta',
  endpoint: process.env.NEXT_PUBLIC_ATLAS_MAINNET_RPC || 'http://rpc.atlas-sphere.io:9944',
  explorer: {
    label: 'Atlas Explorer',
    getUrl: (path: string) => `https://explorer.atlas-sphere.io${path}`,
  },
}

// Atlas Sphere Local Development
export const ATLAS_SPHERE_LOCAL: WalletUiCluster = {
  id: 'atlas-local',
  label: 'Atlas Local',
  cluster: 'custom',
  endpoint: 'http://127.0.0.1:9944',
  explorer: {
    label: 'Local Explorer',
    getUrl: (path: string) => `http://localhost:3001${path}`,
  },
}

const config = createWalletUiConfig({
  clusters: [
    // Atlas Sphere chains (primary)
    ATLAS_SPHERE_TESTNET,
    ATLAS_SPHERE_LOCAL,
    // Solana chains (for cross-chain)
    createSolanaDevnet(),
    createSolanaLocalnet(),
    createSolanaMainnet(),
  ],
})

export function SolanaProvider({ children }: { children: ReactNode }) {
  return <WalletUi config={config}>{children}</WalletUi>
}

// Export cluster configurations for use in other components
export const SUPPORTED_CLUSTERS = {
  atlasTestnet: ATLAS_SPHERE_TESTNET,
  atlasMainnet: ATLAS_SPHERE_MAINNET,
  atlasLocal: ATLAS_SPHERE_LOCAL,
} as const
