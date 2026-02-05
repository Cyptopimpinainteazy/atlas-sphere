/**
 * Multi-Chain Configuration
 * 
 * Comprehensive chain registry supporting 100+ EVM chains, BTC, Solana,
 * and Atlas Sphere (EVM/SVM) for cross-chain atomic swaps.
 */

export type ChainType = 
  | 'solana' 
  | 'bitcoin' 
  | 'atlas-evm' 
  | 'atlas-svm' 
  | 'evm';

export interface ChainConfig {
  id: number | string;
  name: string;
  shortName: string;
  chainType: ChainType;
  nativeCurrency: {
    name: string;
    symbol: string;
    decimals: number;
  };
  rpcUrls: string[];
  wsUrls?: string[];
  blockExplorerUrls?: string[];
  bridgeContract?: string;
  canonicalId?: number; // Atlas Sphere canonical asset ID
  icon?: string;
  testnet?: boolean;
  enabled: boolean;
}

// ============================================
// ATLAS SPHERE CHAINS (Native)
// ============================================
export const ATLAS_CHAINS: ChainConfig[] = [
  {
    id: 'atlas-sphere',
    name: 'Atlas Sphere',
    shortName: 'ATLAS',
    chainType: 'atlas-svm',
    nativeCurrency: { name: 'Atlas', symbol: 'ATLAS', decimals: 9 },
    rpcUrls: ['http://rpc.testnet.atlas-sphere.io:9944'],
    wsUrls: ['ws://rpc.testnet.atlas-sphere.io:9944'],
    blockExplorerUrls: ['https://explorer.atlas-sphere.io'],
    canonicalId: 0,
    icon: '🔷',
    enabled: true,
  },
  {
    id: 'atlas-evm',
    name: 'Atlas Sphere EVM',
    shortName: 'A-EVM',
    chainType: 'atlas-evm',
    nativeCurrency: { name: 'Atlas ETH', symbol: 'aETH', decimals: 18 },
    rpcUrls: ['http://evm.testnet.atlas-sphere.io:8545'],
    wsUrls: ['ws://evm.testnet.atlas-sphere.io:8546'],
    blockExplorerUrls: ['https://evm-explorer.atlas-sphere.io'],
    canonicalId: 1,
    icon: '🔵',
    enabled: true,
  },
];

// ============================================
// BITCOIN CHAINS
// ============================================
export const BITCOIN_CHAINS: ChainConfig[] = [
  {
    id: 'bitcoin-mainnet',
    name: 'Bitcoin Mainnet',
    shortName: 'BTC',
    chainType: 'bitcoin',
    nativeCurrency: { name: 'Bitcoin', symbol: 'BTC', decimals: 8 },
    rpcUrls: ['https://btc-mainnet.atlas-sphere.io'],
    blockExplorerUrls: ['https://blockstream.info'],
    icon: '₿',
    enabled: true,
  },
  {
    id: 'bitcoin-testnet',
    name: 'Bitcoin Testnet',
    shortName: 'tBTC',
    chainType: 'bitcoin',
    nativeCurrency: { name: 'Test Bitcoin', symbol: 'tBTC', decimals: 8 },
    rpcUrls: ['https://btc-testnet.atlas-sphere.io'],
    blockExplorerUrls: ['https://blockstream.info/testnet'],
    icon: '₿',
    testnet: true,
    enabled: true,
  },
  {
    id: 'bitcoin-regtest',
    name: 'Bitcoin Regtest',
    shortName: 'rBTC',
    chainType: 'bitcoin',
    nativeCurrency: { name: 'Regtest Bitcoin', symbol: 'rBTC', decimals: 8 },
    rpcUrls: ['http://localhost:18443'],
    icon: '₿',
    testnet: true,
    enabled: true,
  },
];

// ============================================
// SOLANA CHAINS
// ============================================
export const SOLANA_CHAINS: ChainConfig[] = [
  {
    id: 'solana-mainnet',
    name: 'Solana Mainnet',
    shortName: 'SOL',
    chainType: 'solana',
    nativeCurrency: { name: 'Solana', symbol: 'SOL', decimals: 9 },
    rpcUrls: ['https://api.mainnet-beta.solana.com'],
    wsUrls: ['wss://api.mainnet-beta.solana.com'],
    blockExplorerUrls: ['https://solscan.io'],
    icon: '◎',
    enabled: true,
  },
  {
    id: 'solana-devnet',
    name: 'Solana Devnet',
    shortName: 'dSOL',
    chainType: 'solana',
    nativeCurrency: { name: 'Devnet SOL', symbol: 'SOL', decimals: 9 },
    rpcUrls: ['https://api.devnet.solana.com'],
    wsUrls: ['wss://api.devnet.solana.com'],
    blockExplorerUrls: ['https://solscan.io/?cluster=devnet'],
    icon: '◎',
    testnet: true,
    enabled: true,
  },
];

// ============================================
// EVM CHAINS (100+ Networks)
// ============================================
export const EVM_CHAINS: ChainConfig[] = [
  // === ETHEREUM ECOSYSTEM ===
  {
    id: 1,
    name: 'Ethereum Mainnet',
    shortName: 'ETH',
    chainType: 'evm',
    nativeCurrency: { name: 'Ether', symbol: 'ETH', decimals: 18 },
    rpcUrls: ['https://eth.llamarpc.com', 'https://rpc.ankr.com/eth'],
    wsUrls: ['wss://eth.llamarpc.com'],
    blockExplorerUrls: ['https://etherscan.io'],
    icon: 'Ξ',
    enabled: true,
  },
  {
    id: 5,
    name: 'Goerli Testnet',
    shortName: 'gETH',
    chainType: 'evm',
    nativeCurrency: { name: 'Goerli Ether', symbol: 'ETH', decimals: 18 },
    rpcUrls: ['https://rpc.ankr.com/eth_goerli'],
    blockExplorerUrls: ['https://goerli.etherscan.io'],
    icon: 'Ξ',
    testnet: true,
    enabled: true,
  },
  {
    id: 11155111,
    name: 'Sepolia Testnet',
    shortName: 'SEP',
    chainType: 'evm',
    nativeCurrency: { name: 'Sepolia Ether', symbol: 'ETH', decimals: 18 },
    rpcUrls: ['https://rpc.sepolia.org', 'https://rpc.ankr.com/eth_sepolia'],
    blockExplorerUrls: ['https://sepolia.etherscan.io'],
    icon: 'Ξ',
    testnet: true,
    enabled: true,
  },
  
  // === LAYER 2 ROLLUPS ===
  {
    id: 42161,
    name: 'Arbitrum One',
    shortName: 'ARB',
    chainType: 'evm',
    nativeCurrency: { name: 'Ether', symbol: 'ETH', decimals: 18 },
    rpcUrls: ['https://arb1.arbitrum.io/rpc', 'https://rpc.ankr.com/arbitrum'],
    blockExplorerUrls: ['https://arbiscan.io'],
    icon: '🔵',
    enabled: true,
  },
  {
    id: 421614,
    name: 'Arbitrum Sepolia',
    shortName: 'ARB-SEP',
    chainType: 'evm',
    nativeCurrency: { name: 'Ether', symbol: 'ETH', decimals: 18 },
    rpcUrls: ['https://sepolia-rollup.arbitrum.io/rpc'],
    blockExplorerUrls: ['https://sepolia.arbiscan.io'],
    icon: '🔵',
    testnet: true,
    enabled: true,
  },
  {
    id: 10,
    name: 'Optimism',
    shortName: 'OP',
    chainType: 'evm',
    nativeCurrency: { name: 'Ether', symbol: 'ETH', decimals: 18 },
    rpcUrls: ['https://mainnet.optimism.io', 'https://rpc.ankr.com/optimism'],
    blockExplorerUrls: ['https://optimistic.etherscan.io'],
    icon: '🔴',
    enabled: true,
  },
  {
    id: 11155420,
    name: 'Optimism Sepolia',
    shortName: 'OP-SEP',
    chainType: 'evm',
    nativeCurrency: { name: 'Ether', symbol: 'ETH', decimals: 18 },
    rpcUrls: ['https://sepolia.optimism.io'],
    blockExplorerUrls: ['https://sepolia-optimism.etherscan.io'],
    icon: '🔴',
    testnet: true,
    enabled: true,
  },
  {
    id: 8453,
    name: 'Base',
    shortName: 'BASE',
    chainType: 'evm',
    nativeCurrency: { name: 'Ether', symbol: 'ETH', decimals: 18 },
    rpcUrls: ['https://mainnet.base.org', 'https://rpc.ankr.com/base'],
    blockExplorerUrls: ['https://basescan.org'],
    icon: '🔵',
    enabled: true,
  },
  {
    id: 84532,
    name: 'Base Sepolia',
    shortName: 'BASE-SEP',
    chainType: 'evm',
    nativeCurrency: { name: 'Ether', symbol: 'ETH', decimals: 18 },
    rpcUrls: ['https://sepolia.base.org'],
    blockExplorerUrls: ['https://sepolia.basescan.org'],
    icon: '🔵',
    testnet: true,
    enabled: true,
  },
  {
    id: 324,
    name: 'zkSync Era',
    shortName: 'ZKSYNC',
    chainType: 'evm',
    nativeCurrency: { name: 'Ether', symbol: 'ETH', decimals: 18 },
    rpcUrls: ['https://mainnet.era.zksync.io'],
    blockExplorerUrls: ['https://explorer.zksync.io'],
    icon: '⚡',
    enabled: true,
  },
  {
    id: 300,
    name: 'zkSync Sepolia',
    shortName: 'ZKSYNC-SEP',
    chainType: 'evm',
    nativeCurrency: { name: 'Ether', symbol: 'ETH', decimals: 18 },
    rpcUrls: ['https://sepolia.era.zksync.dev'],
    blockExplorerUrls: ['https://sepolia.explorer.zksync.io'],
    icon: '⚡',
    testnet: true,
    enabled: true,
  },
  {
    id: 59144,
    name: 'Linea',
    shortName: 'LINEA',
    chainType: 'evm',
    nativeCurrency: { name: 'Ether', symbol: 'ETH', decimals: 18 },
    rpcUrls: ['https://rpc.linea.build'],
    blockExplorerUrls: ['https://lineascan.build'],
    icon: '🟢',
    enabled: true,
  },
  {
    id: 534352,
    name: 'Scroll',
    shortName: 'SCROLL',
    chainType: 'evm',
    nativeCurrency: { name: 'Ether', symbol: 'ETH', decimals: 18 },
    rpcUrls: ['https://rpc.scroll.io'],
    blockExplorerUrls: ['https://scrollscan.com'],
    icon: '📜',
    enabled: true,
  },
  {
    id: 7777777,
    name: 'Zora',
    shortName: 'ZORA',
    chainType: 'evm',
    nativeCurrency: { name: 'Ether', symbol: 'ETH', decimals: 18 },
    rpcUrls: ['https://rpc.zora.energy'],
    blockExplorerUrls: ['https://explorer.zora.energy'],
    icon: '🟣',
    enabled: true,
  },
  {
    id: 34443,
    name: 'Mode',
    shortName: 'MODE',
    chainType: 'evm',
    nativeCurrency: { name: 'Ether', symbol: 'ETH', decimals: 18 },
    rpcUrls: ['https://mainnet.mode.network'],
    blockExplorerUrls: ['https://explorer.mode.network'],
    icon: '🟡',
    enabled: true,
  },
  {
    id: 81457,
    name: 'Blast',
    shortName: 'BLAST',
    chainType: 'evm',
    nativeCurrency: { name: 'Ether', symbol: 'ETH', decimals: 18 },
    rpcUrls: ['https://rpc.blast.io'],
    blockExplorerUrls: ['https://blastscan.io'],
    icon: '💥',
    enabled: true,
  },
  {
    id: 5000,
    name: 'Mantle',
    shortName: 'MNT',
    chainType: 'evm',
    nativeCurrency: { name: 'Mantle', symbol: 'MNT', decimals: 18 },
    rpcUrls: ['https://rpc.mantle.xyz'],
    blockExplorerUrls: ['https://explorer.mantle.xyz'],
    icon: '🟢',
    enabled: true,
  },
  {
    id: 169,
    name: 'Manta Pacific',
    shortName: 'MANTA',
    chainType: 'evm',
    nativeCurrency: { name: 'Ether', symbol: 'ETH', decimals: 18 },
    rpcUrls: ['https://pacific-rpc.manta.network/http'],
    blockExplorerUrls: ['https://pacific-explorer.manta.network'],
    icon: '🐙',
    enabled: true,
  },
  
  // === SIDE CHAINS ===
  {
    id: 137,
    name: 'Polygon',
    shortName: 'MATIC',
    chainType: 'evm',
    nativeCurrency: { name: 'MATIC', symbol: 'MATIC', decimals: 18 },
    rpcUrls: ['https://polygon-rpc.com', 'https://rpc.ankr.com/polygon'],
    blockExplorerUrls: ['https://polygonscan.com'],
    icon: '🟣',
    enabled: true,
  },
  {
    id: 80002,
    name: 'Polygon Amoy',
    shortName: 'AMOY',
    chainType: 'evm',
    nativeCurrency: { name: 'MATIC', symbol: 'MATIC', decimals: 18 },
    rpcUrls: ['https://rpc-amoy.polygon.technology'],
    blockExplorerUrls: ['https://amoy.polygonscan.com'],
    icon: '🟣',
    testnet: true,
    enabled: true,
  },
  {
    id: 1101,
    name: 'Polygon zkEVM',
    shortName: 'zkPOL',
    chainType: 'evm',
    nativeCurrency: { name: 'Ether', symbol: 'ETH', decimals: 18 },
    rpcUrls: ['https://zkevm-rpc.com'],
    blockExplorerUrls: ['https://zkevm.polygonscan.com'],
    icon: '🟣',
    enabled: true,
  },
  
  // === BSC (Binance) ===
  {
    id: 56,
    name: 'BNB Smart Chain',
    shortName: 'BSC',
    chainType: 'evm',
    nativeCurrency: { name: 'BNB', symbol: 'BNB', decimals: 18 },
    rpcUrls: ['https://bsc-dataseed.binance.org', 'https://rpc.ankr.com/bsc'],
    blockExplorerUrls: ['https://bscscan.com'],
    icon: '🟡',
    enabled: true,
  },
  {
    id: 97,
    name: 'BSC Testnet',
    shortName: 'tBSC',
    chainType: 'evm',
    nativeCurrency: { name: 'Test BNB', symbol: 'tBNB', decimals: 18 },
    rpcUrls: ['https://data-seed-prebsc-1-s1.binance.org:8545'],
    blockExplorerUrls: ['https://testnet.bscscan.com'],
    icon: '🟡',
    testnet: true,
    enabled: true,
  },
  {
    id: 204,
    name: 'opBNB',
    shortName: 'opBNB',
    chainType: 'evm',
    nativeCurrency: { name: 'BNB', symbol: 'BNB', decimals: 18 },
    rpcUrls: ['https://opbnb-mainnet-rpc.bnbchain.org'],
    blockExplorerUrls: ['https://opbnbscan.com'],
    icon: '🟡',
    enabled: true,
  },
  
  // === AVALANCHE ===
  {
    id: 43114,
    name: 'Avalanche C-Chain',
    shortName: 'AVAX',
    chainType: 'evm',
    nativeCurrency: { name: 'Avalanche', symbol: 'AVAX', decimals: 18 },
    rpcUrls: ['https://api.avax.network/ext/bc/C/rpc', 'https://rpc.ankr.com/avalanche'],
    blockExplorerUrls: ['https://snowtrace.io'],
    icon: '🔺',
    enabled: true,
  },
  {
    id: 43113,
    name: 'Avalanche Fuji',
    shortName: 'FUJI',
    chainType: 'evm',
    nativeCurrency: { name: 'Avalanche', symbol: 'AVAX', decimals: 18 },
    rpcUrls: ['https://api.avax-test.network/ext/bc/C/rpc'],
    blockExplorerUrls: ['https://testnet.snowtrace.io'],
    icon: '🔺',
    testnet: true,
    enabled: true,
  },
  
  // === FANTOM ===
  {
    id: 250,
    name: 'Fantom Opera',
    shortName: 'FTM',
    chainType: 'evm',
    nativeCurrency: { name: 'Fantom', symbol: 'FTM', decimals: 18 },
    rpcUrls: ['https://rpc.ftm.tools', 'https://rpc.ankr.com/fantom'],
    blockExplorerUrls: ['https://ftmscan.com'],
    icon: '👻',
    enabled: true,
  },
  {
    id: 64240,
    name: 'Fantom Sonic',
    shortName: 'SONIC',
    chainType: 'evm',
    nativeCurrency: { name: 'Fantom', symbol: 'FTM', decimals: 18 },
    rpcUrls: ['https://rpc.sonic.fantom.network'],
    blockExplorerUrls: ['https://sonicscan.io'],
    icon: '👻',
    enabled: true,
  },
  
  // === GNOSIS ===
  {
    id: 100,
    name: 'Gnosis Chain',
    shortName: 'GNO',
    chainType: 'evm',
    nativeCurrency: { name: 'xDai', symbol: 'xDAI', decimals: 18 },
    rpcUrls: ['https://rpc.gnosischain.com', 'https://rpc.ankr.com/gnosis'],
    blockExplorerUrls: ['https://gnosisscan.io'],
    icon: '🦉',
    enabled: true,
  },
  
  // === CELO ===
  {
    id: 42220,
    name: 'Celo',
    shortName: 'CELO',
    chainType: 'evm',
    nativeCurrency: { name: 'Celo', symbol: 'CELO', decimals: 18 },
    rpcUrls: ['https://forno.celo.org'],
    blockExplorerUrls: ['https://celoscan.io'],
    icon: '🟢',
    enabled: true,
  },
  
  // === MOONBEAM / MOONRIVER ===
  {
    id: 1284,
    name: 'Moonbeam',
    shortName: 'GLMR',
    chainType: 'evm',
    nativeCurrency: { name: 'Glimmer', symbol: 'GLMR', decimals: 18 },
    rpcUrls: ['https://rpc.api.moonbeam.network'],
    blockExplorerUrls: ['https://moonscan.io'],
    icon: '🌙',
    enabled: true,
  },
  {
    id: 1285,
    name: 'Moonriver',
    shortName: 'MOVR',
    chainType: 'evm',
    nativeCurrency: { name: 'Moonriver', symbol: 'MOVR', decimals: 18 },
    rpcUrls: ['https://rpc.api.moonriver.moonbeam.network'],
    blockExplorerUrls: ['https://moonriver.moonscan.io'],
    icon: '🌙',
    enabled: true,
  },
  
  // === METIS ===
  {
    id: 1088,
    name: 'Metis Andromeda',
    shortName: 'METIS',
    chainType: 'evm',
    nativeCurrency: { name: 'Metis', symbol: 'METIS', decimals: 18 },
    rpcUrls: ['https://andromeda.metis.io/?owner=1088'],
    blockExplorerUrls: ['https://andromeda-explorer.metis.io'],
    icon: '🟢',
    enabled: true,
  },
  
  // === AURORA (NEAR) ===
  {
    id: 1313161554,
    name: 'Aurora',
    shortName: 'AURORA',
    chainType: 'evm',
    nativeCurrency: { name: 'Ether', symbol: 'ETH', decimals: 18 },
    rpcUrls: ['https://mainnet.aurora.dev'],
    blockExplorerUrls: ['https://explorer.aurora.dev'],
    icon: '🌌',
    enabled: true,
  },
  
  // === CRONOS ===
  {
    id: 25,
    name: 'Cronos',
    shortName: 'CRO',
    chainType: 'evm',
    nativeCurrency: { name: 'Cronos', symbol: 'CRO', decimals: 18 },
    rpcUrls: ['https://evm.cronos.org'],
    blockExplorerUrls: ['https://cronoscan.com'],
    icon: '🔵',
    enabled: true,
  },
  
  // === KAVA ===
  {
    id: 2222,
    name: 'Kava EVM',
    shortName: 'KAVA',
    chainType: 'evm',
    nativeCurrency: { name: 'Kava', symbol: 'KAVA', decimals: 18 },
    rpcUrls: ['https://evm.kava.io'],
    blockExplorerUrls: ['https://kavascan.com'],
    icon: '🔴',
    enabled: true,
  },
  
  // === KLAYTN ===
  {
    id: 8217,
    name: 'Klaytn',
    shortName: 'KLAY',
    chainType: 'evm',
    nativeCurrency: { name: 'Klaytn', symbol: 'KLAY', decimals: 18 },
    rpcUrls: ['https://public-en-cypress.klaytn.net'],
    blockExplorerUrls: ['https://klaytnscope.com'],
    icon: '🟤',
    enabled: true,
  },
  
  // === HARMONY ===
  {
    id: 1666600000,
    name: 'Harmony One',
    shortName: 'ONE',
    chainType: 'evm',
    nativeCurrency: { name: 'ONE', symbol: 'ONE', decimals: 18 },
    rpcUrls: ['https://api.harmony.one'],
    blockExplorerUrls: ['https://explorer.harmony.one'],
    icon: '🔵',
    enabled: true,
  },
  
  // === EVMOS ===
  {
    id: 9001,
    name: 'Evmos',
    shortName: 'EVMOS',
    chainType: 'evm',
    nativeCurrency: { name: 'Evmos', symbol: 'EVMOS', decimals: 18 },
    rpcUrls: ['https://evmos-evm.publicnode.com'],
    blockExplorerUrls: ['https://escan.live'],
    icon: '⚛️',
    enabled: true,
  },
  
  // === FUSE ===
  {
    id: 122,
    name: 'Fuse',
    shortName: 'FUSE',
    chainType: 'evm',
    nativeCurrency: { name: 'Fuse', symbol: 'FUSE', decimals: 18 },
    rpcUrls: ['https://rpc.fuse.io'],
    blockExplorerUrls: ['https://explorer.fuse.io'],
    icon: '🟢',
    enabled: true,
  },
  
  // === BOBA ===
  {
    id: 288,
    name: 'Boba Network',
    shortName: 'BOBA',
    chainType: 'evm',
    nativeCurrency: { name: 'Ether', symbol: 'ETH', decimals: 18 },
    rpcUrls: ['https://mainnet.boba.network'],
    blockExplorerUrls: ['https://bobascan.com'],
    icon: '🟢',
    enabled: true,
  },
  
  // === OASIS ===
  {
    id: 42262,
    name: 'Oasis Emerald',
    shortName: 'ROSE',
    chainType: 'evm',
    nativeCurrency: { name: 'Rose', symbol: 'ROSE', decimals: 18 },
    rpcUrls: ['https://emerald.oasis.dev'],
    blockExplorerUrls: ['https://explorer.emerald.oasis.dev'],
    icon: '🌹',
    enabled: true,
  },
  
  // === TELOS ===
  {
    id: 40,
    name: 'Telos EVM',
    shortName: 'TLOS',
    chainType: 'evm',
    nativeCurrency: { name: 'Telos', symbol: 'TLOS', decimals: 18 },
    rpcUrls: ['https://mainnet.telos.net/evm'],
    blockExplorerUrls: ['https://teloscan.io'],
    icon: '🟢',
    enabled: true,
  },
  
  // === ASTAR ===
  {
    id: 592,
    name: 'Astar',
    shortName: 'ASTR',
    chainType: 'evm',
    nativeCurrency: { name: 'Astar', symbol: 'ASTR', decimals: 18 },
    rpcUrls: ['https://evm.astar.network'],
    blockExplorerUrls: ['https://astar.subscan.io'],
    icon: '⭐',
    enabled: true,
  },
  
  // === SHIDEN ===
  {
    id: 336,
    name: 'Shiden',
    shortName: 'SDN',
    chainType: 'evm',
    nativeCurrency: { name: 'Shiden', symbol: 'SDN', decimals: 18 },
    rpcUrls: ['https://shiden.api.onfinality.io/public'],
    blockExplorerUrls: ['https://shiden.subscan.io'],
    icon: '🟣',
    enabled: true,
  },
  
  // === IOTEX ===
  {
    id: 4689,
    name: 'IoTeX',
    shortName: 'IOTX',
    chainType: 'evm',
    nativeCurrency: { name: 'IoTeX', symbol: 'IOTX', decimals: 18 },
    rpcUrls: ['https://babel-api.mainnet.iotex.io'],
    blockExplorerUrls: ['https://iotexscan.io'],
    icon: '🔵',
    enabled: true,
  },
  
  // === SYSCOIN ===
  {
    id: 57,
    name: 'Syscoin',
    shortName: 'SYS',
    chainType: 'evm',
    nativeCurrency: { name: 'Syscoin', symbol: 'SYS', decimals: 18 },
    rpcUrls: ['https://rpc.syscoin.org'],
    blockExplorerUrls: ['https://explorer.syscoin.org'],
    icon: '🔷',
    enabled: true,
  },
  
  // === MILKOMEDA ===
  {
    id: 2001,
    name: 'Milkomeda C1',
    shortName: 'milkADA',
    chainType: 'evm',
    nativeCurrency: { name: 'milkADA', symbol: 'milkADA', decimals: 18 },
    rpcUrls: ['https://rpc-mainnet-cardano-evm.c1.milkomeda.com'],
    blockExplorerUrls: ['https://explorer-mainnet-cardano-evm.c1.milkomeda.com'],
    icon: '🥛',
    enabled: true,
  },
  
  // === THUNDER CORE ===
  {
    id: 108,
    name: 'ThunderCore',
    shortName: 'TT',
    chainType: 'evm',
    nativeCurrency: { name: 'ThunderCore', symbol: 'TT', decimals: 18 },
    rpcUrls: ['https://mainnet-rpc.thundercore.com'],
    blockExplorerUrls: ['https://viewblock.io/thundercore'],
    icon: '⚡',
    enabled: true,
  },
  
  // === GODWOKEN (NERVOS) ===
  {
    id: 71402,
    name: 'Godwoken',
    shortName: 'CKB',
    chainType: 'evm',
    nativeCurrency: { name: 'CKB', symbol: 'CKB', decimals: 18 },
    rpcUrls: ['https://v1.mainnet.godwoken.io/rpc'],
    blockExplorerUrls: ['https://gwscan.com'],
    icon: '🟢',
    enabled: true,
  },
  
  // === FLARE ===
  {
    id: 14,
    name: 'Flare',
    shortName: 'FLR',
    chainType: 'evm',
    nativeCurrency: { name: 'Flare', symbol: 'FLR', decimals: 18 },
    rpcUrls: ['https://flare-api.flare.network/ext/C/rpc'],
    blockExplorerUrls: ['https://flare-explorer.flare.network'],
    icon: '🔥',
    enabled: true,
  },
  
  // === SONGBIRD ===
  {
    id: 19,
    name: 'Songbird',
    shortName: 'SGB',
    chainType: 'evm',
    nativeCurrency: { name: 'Songbird', symbol: 'SGB', decimals: 18 },
    rpcUrls: ['https://songbird-api.flare.network/ext/C/rpc'],
    blockExplorerUrls: ['https://songbird-explorer.flare.network'],
    icon: '🐦',
    enabled: true,
  },
  
  // === VELAS ===
  {
    id: 106,
    name: 'Velas',
    shortName: 'VLX',
    chainType: 'evm',
    nativeCurrency: { name: 'Velas', symbol: 'VLX', decimals: 18 },
    rpcUrls: ['https://evmexplorer.velas.com/rpc'],
    blockExplorerUrls: ['https://evmexplorer.velas.com'],
    icon: '🔵',
    enabled: true,
  },
  
  // === EOS EVM ===
  {
    id: 17777,
    name: 'EOS EVM',
    shortName: 'EOS',
    chainType: 'evm',
    nativeCurrency: { name: 'EOS', symbol: 'EOS', decimals: 18 },
    rpcUrls: ['https://api.evm.eosnetwork.com'],
    blockExplorerUrls: ['https://explorer.evm.eosnetwork.com'],
    icon: '⚫',
    enabled: true,
  },
  
  // === CANTO ===
  {
    id: 7700,
    name: 'Canto',
    shortName: 'CANTO',
    chainType: 'evm',
    nativeCurrency: { name: 'Canto', symbol: 'CANTO', decimals: 18 },
    rpcUrls: ['https://canto.gravitychain.io'],
    blockExplorerUrls: ['https://tuber.build'],
    icon: '🎵',
    enabled: true,
  },
  
  // === CORE ===
  {
    id: 1116,
    name: 'Core',
    shortName: 'CORE',
    chainType: 'evm',
    nativeCurrency: { name: 'Core', symbol: 'CORE', decimals: 18 },
    rpcUrls: ['https://rpc.coredao.org'],
    blockExplorerUrls: ['https://scan.coredao.org'],
    icon: '🟠',
    enabled: true,
  },
  
  // === PULSE CHAIN ===
  {
    id: 369,
    name: 'PulseChain',
    shortName: 'PLS',
    chainType: 'evm',
    nativeCurrency: { name: 'Pulse', symbol: 'PLS', decimals: 18 },
    rpcUrls: ['https://rpc.pulsechain.com'],
    blockExplorerUrls: ['https://scan.pulsechain.com'],
    icon: '💚',
    enabled: true,
  },
  
  // === FILECOIN ===
  {
    id: 314,
    name: 'Filecoin',
    shortName: 'FIL',
    chainType: 'evm',
    nativeCurrency: { name: 'Filecoin', symbol: 'FIL', decimals: 18 },
    rpcUrls: ['https://api.node.glif.io'],
    blockExplorerUrls: ['https://filfox.info'],
    icon: '📁',
    enabled: true,
  },
  
  // === FRAXTAL ===
  {
    id: 252,
    name: 'Fraxtal',
    shortName: 'FRAX',
    chainType: 'evm',
    nativeCurrency: { name: 'Frax Ether', symbol: 'frxETH', decimals: 18 },
    rpcUrls: ['https://rpc.frax.com'],
    blockExplorerUrls: ['https://fraxscan.com'],
    icon: '⚫',
    enabled: true,
  },
  
  // === ZETA CHAIN ===
  {
    id: 7000,
    name: 'ZetaChain',
    shortName: 'ZETA',
    chainType: 'evm',
    nativeCurrency: { name: 'Zeta', symbol: 'ZETA', decimals: 18 },
    rpcUrls: ['https://zetachain-evm.blockpi.network/v1/rpc/public'],
    blockExplorerUrls: ['https://explorer.zetachain.com'],
    icon: '🟢',
    enabled: true,
  },
  
  // === SEI ===
  {
    id: 1329,
    name: 'Sei',
    shortName: 'SEI',
    chainType: 'evm',
    nativeCurrency: { name: 'Sei', symbol: 'SEI', decimals: 18 },
    rpcUrls: ['https://evm-rpc.sei-apis.com'],
    blockExplorerUrls: ['https://seitrace.com'],
    icon: '🔴',
    enabled: true,
  },
  
  // === TAIKO ===
  {
    id: 167000,
    name: 'Taiko',
    shortName: 'TAIKO',
    chainType: 'evm',
    nativeCurrency: { name: 'Ether', symbol: 'ETH', decimals: 18 },
    rpcUrls: ['https://rpc.mainnet.taiko.xyz'],
    blockExplorerUrls: ['https://taikoscan.io'],
    icon: '🥁',
    enabled: true,
  },
  
  // === WORLD CHAIN ===
  {
    id: 480,
    name: 'World Chain',
    shortName: 'WLD',
    chainType: 'evm',
    nativeCurrency: { name: 'Ether', symbol: 'ETH', decimals: 18 },
    rpcUrls: ['https://worldchain-mainnet.g.alchemy.com/public'],
    blockExplorerUrls: ['https://worldscan.org'],
    icon: '🌍',
    enabled: true,
  },
  
  // === ABSTRACT ===
  {
    id: 2741,
    name: 'Abstract',
    shortName: 'ABS',
    chainType: 'evm',
    nativeCurrency: { name: 'Ether', symbol: 'ETH', decimals: 18 },
    rpcUrls: ['https://api.mainnet.abs.xyz'],
    blockExplorerUrls: ['https://abscan.org'],
    icon: '🔵',
    enabled: true,
  },
  
  // === BERACHAIN ===
  {
    id: 80094,
    name: 'Berachain',
    shortName: 'BERA',
    chainType: 'evm',
    nativeCurrency: { name: 'Bera', symbol: 'BERA', decimals: 18 },
    rpcUrls: ['https://rpc.berachain.com'],
    blockExplorerUrls: ['https://berascan.com'],
    icon: '🐻',
    testnet: true,
    enabled: true,
  },
  
  // === INK ===
  {
    id: 57073,
    name: 'Ink',
    shortName: 'INK',
    chainType: 'evm',
    nativeCurrency: { name: 'Ether', symbol: 'ETH', decimals: 18 },
    rpcUrls: ['https://rpc-gel.inkonchain.com'],
    blockExplorerUrls: ['https://explorer.inkonchain.com'],
    icon: '🖋️',
    enabled: true,
  },
  
  // === ROOTSTOCK (RSK) ===
  {
    id: 30,
    name: 'Rootstock',
    shortName: 'RBTC',
    chainType: 'evm',
    nativeCurrency: { name: 'Smart Bitcoin', symbol: 'RBTC', decimals: 18 },
    rpcUrls: ['https://public-node.rsk.co'],
    blockExplorerUrls: ['https://explorer.rsk.co'],
    icon: '🟠',
    enabled: true,
  },
  
  // === BITLAYER ===
  {
    id: 200901,
    name: 'Bitlayer',
    shortName: 'BTR',
    chainType: 'evm',
    nativeCurrency: { name: 'Bitcoin', symbol: 'BTC', decimals: 18 },
    rpcUrls: ['https://rpc.bitlayer.org'],
    blockExplorerUrls: ['https://www.btrscan.com'],
    icon: '₿',
    enabled: true,
  },
  
  // === BOB (Build on Bitcoin) ===
  {
    id: 60808,
    name: 'BOB',
    shortName: 'BOB',
    chainType: 'evm',
    nativeCurrency: { name: 'Ether', symbol: 'ETH', decimals: 18 },
    rpcUrls: ['https://rpc.gobob.xyz'],
    blockExplorerUrls: ['https://explorer.gobob.xyz'],
    icon: '🟠',
    enabled: true,
  },
  
  // === MERLIN ===
  {
    id: 4200,
    name: 'Merlin',
    shortName: 'MERL',
    chainType: 'evm',
    nativeCurrency: { name: 'Bitcoin', symbol: 'BTC', decimals: 18 },
    rpcUrls: ['https://rpc.merlinchain.io'],
    blockExplorerUrls: ['https://scan.merlinchain.io'],
    icon: '🧙',
    enabled: true,
  },
  
  // === B2 NETWORK ===
  {
    id: 223,
    name: 'B² Network',
    shortName: 'B2',
    chainType: 'evm',
    nativeCurrency: { name: 'Bitcoin', symbol: 'BTC', decimals: 18 },
    rpcUrls: ['https://rpc.bsquared.network'],
    blockExplorerUrls: ['https://explorer.bsquared.network'],
    icon: '🟠',
    enabled: true,
  },
  
  // === BOUNCEBIT ===
  {
    id: 6001,
    name: 'BounceBit',
    shortName: 'BB',
    chainType: 'evm',
    nativeCurrency: { name: 'BounceBit', symbol: 'BB', decimals: 18 },
    rpcUrls: ['https://fullnode-mainnet.bouncebitapi.com'],
    blockExplorerUrls: ['https://bbscan.io'],
    icon: '🟡',
    enabled: true,
  },
];

// ============================================
// ALL CHAINS COMBINED
// ============================================
export const ALL_CHAINS: ChainConfig[] = [
  ...ATLAS_CHAINS,
  ...BITCOIN_CHAINS,
  ...SOLANA_CHAINS,
  ...EVM_CHAINS,
];

// ============================================
// HELPER FUNCTIONS
// ============================================

/**
 * Get chain by ID
 */
export function getChainById(id: number | string): ChainConfig | undefined {
  return ALL_CHAINS.find((chain) => chain.id === id);
}

/**
 * Get chains by type
 */
export function getChainsByType(type: ChainType): ChainConfig[] {
  return ALL_CHAINS.filter((chain) => chain.chainType === type);
}

/**
 * Get enabled chains only
 */
export function getEnabledChains(): ChainConfig[] {
  return ALL_CHAINS.filter((chain) => chain.enabled);
}

/**
 * Get mainnet chains only
 */
export function getMainnetChains(): ChainConfig[] {
  return ALL_CHAINS.filter((chain) => !chain.testnet && chain.enabled);
}

/**
 * Get testnet chains only
 */
export function getTestnetChains(): ChainConfig[] {
  return ALL_CHAINS.filter((chain) => chain.testnet && chain.enabled);
}

/**
 * Get EVM chains only
 */
export function getEvmChains(): ChainConfig[] {
  return EVM_CHAINS.filter((chain) => chain.enabled);
}

/**
 * Get chain count by type
 */
export function getChainCounts(): Record<ChainType, number> {
  return {
    'solana': SOLANA_CHAINS.length,
    'bitcoin': BITCOIN_CHAINS.length,
    'atlas-evm': ATLAS_CHAINS.filter(c => c.chainType === 'atlas-evm').length,
    'atlas-svm': ATLAS_CHAINS.filter(c => c.chainType === 'atlas-svm').length,
    'evm': EVM_CHAINS.length,
  };
}

// Export chain count
export const TOTAL_CHAIN_COUNT = ALL_CHAINS.length;
export const EVM_CHAIN_COUNT = EVM_CHAINS.length;
