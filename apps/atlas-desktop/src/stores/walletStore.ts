import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { invoke } from '@tauri-apps/api/tauri';

// ── Interfaces ──────────────────────────────────────────────────────────────

export interface Token {
  symbol: string;
  name: string;
  balance: number;
  value: number;
  change24h: number;
  icon: string;
  network: 'evm' | 'svm' | 'substrate';
}

export interface Transaction {
  id: string;
  type: 'send' | 'receive' | 'swap' | 'comit' | 'mint';
  status: 'confirmed' | 'pending' | 'failed';
  amount: number;
  symbol: string;
  from: string;
  to: string;
  timestamp: number;
  hash: string;
  network: 'evm' | 'svm' | 'substrate';
  comitId?: string;
  blockNumber?: number;
}

export interface WalletAccount {
  address: string;
  name: string;
  network: 'evm' | 'svm' | 'substrate' | 'universal';
  balance: string;
  isAuthorized?: boolean;
}

export type ActiveView =
  | 'dashboard'
  | 'send'
  | 'receive'
  | 'swap'
  | 'history'
  | 'settings'
  | 'comit'
  | 'mint';

export interface UniversalWallet {
  mnemonic: string;
  seed_hex: string;
  evm_address: string;
  evm_private_key: string;
  solana_address: string;
  polkadot_address: string;
  evm_chain_count: number;
  warning: string;
}

export interface WalletState {
  isConnected: boolean;
  isLoading: boolean;
  accounts: WalletAccount[];
  activeAccountIndex: number;
  totalBalance: number;
  tokens: Token[];
  transactions: Transaction[];
  pendingComits: string[];
  activeView: ActiveView;
  evmChainCount: number;
  universalWallet: UniversalWallet | null;
}

export interface WalletActions {
  setConnected: (connected: boolean) => void;
  setLoading: (loading: boolean) => void;
  addAccount: (account: WalletAccount) => void;
  setAccounts: (accounts: WalletAccount[]) => void;
  setActiveAccountIndex: (index: number) => void;
  setActiveView: (view: ActiveView) => void;
  setTokens: (tokens: Token[]) => void;
  addTransaction: (tx: Transaction) => void;
  disconnect: () => void;
  setUniversalWallet: (wallet: UniversalWallet | null) => void;
  setEvmChainCount: (count: number) => void;
}

// ── Demo data ───────────────────────────────────────────────────────────────

const DEMO_TOKENS: Token[] = [
  { symbol: 'ATLAS', name: 'Atlas Sphere', balance: 1250.0, value: 3750.0, change24h: 5.2, icon: '⭐', network: 'substrate' },
  { symbol: 'ETH', name: 'Ethereum', balance: 2.45, value: 4900.0, change24h: -1.3, icon: '◆', network: 'evm' },
  { symbol: 'SOL', name: 'Solana', balance: 15.8, value: 1580.0, change24h: 3.8, icon: '◎', network: 'svm' },
  { symbol: 'USDC', name: 'USD Coin', balance: 500.0, value: 500.0, change24h: 0.01, icon: '$', network: 'evm' },
];

const DEMO_ACCOUNTS: WalletAccount[] = [
  { address: '0x742d35Cc6634C0532925a3b844Bc9e7595f12ABC', name: 'Demo Wallet', network: 'evm', balance: '2.45' },
];

const DEMO_TRANSACTIONS: Transaction[] = [
  {
    id: 'tx-001',
    type: 'receive',
    status: 'confirmed',
    amount: 0.5,
    symbol: 'ETH',
    from: '0xAbC123...9eF0',
    to: '0x742d35...2ABC',
    timestamp: Date.now() - 3600_000,
    hash: '0xabc123def456789012345678901234567890abcdef1234567890abcdef123456',
    network: 'evm',
    blockNumber: 19_421_003,
  },
  {
    id: 'tx-002',
    type: 'send',
    status: 'confirmed',
    amount: 25.0,
    symbol: 'ATLAS',
    from: '0x742d35...2ABC',
    to: '5GrwvaEF...utQY',
    timestamp: Date.now() - 86_400_000,
    hash: '0xdef789abc012345678901234567890123456789012345678901234567890abcd',
    network: 'substrate',
    blockNumber: 1_423_881,
  },
  {
    id: 'tx-003',
    type: 'swap',
    status: 'pending',
    amount: 100.0,
    symbol: 'USDC',
    from: '0x742d35...2ABC',
    to: '0x742d35...2ABC',
    timestamp: Date.now() - 600_000,
    hash: '0x123456abcdef7890abcdef1234567890abcdef1234567890abcdef1234567890',
    network: 'evm',
  },
];

// ── Initial state ───────────────────────────────────────────────────────────

const initialState: WalletState = {
  isConnected: false,
  isLoading: false,
  accounts: [],
  activeAccountIndex: 0,
  totalBalance: 0,
  tokens: [],
  transactions: [],
  pendingComits: [],
  activeView: 'dashboard',
  evmChainCount: 0,
  universalWallet: null,
};

// ── Store ───────────────────────────────────────────────────────────────────

export const useWalletStore = create<WalletState & WalletActions>()(
  persist(
    (set, get) => ({
      ...initialState,

      setConnected: (connected) => set({ isConnected: connected }),
      setLoading: (loading) => set({ isLoading: loading }),

      addAccount: (account) =>
        set((state) => ({ accounts: [...state.accounts, account] })),

      setAccounts: (accounts) => set({ accounts }),

      setActiveAccountIndex: (index) => set({ activeAccountIndex: index }),

      setActiveView: (view) => set({ activeView: view }),

      setTokens: (tokens) =>
        set({ tokens, totalBalance: tokens.reduce((s, t) => s + t.value, 0) }),

      addTransaction: (tx) =>
        set((state) => ({ transactions: [tx, ...state.transactions] })),

      disconnect: () =>
        set({
          isConnected: false,
          accounts: [],
          activeAccountIndex: 0,
          totalBalance: 0,
          tokens: [],
          transactions: [],
          pendingComits: [],
          activeView: 'dashboard',
          universalWallet: null,
        }),

      setUniversalWallet: (wallet) => set({ universalWallet: wallet }),

      setEvmChainCount: (count) => set({ evmChainCount: count }),
    }),
    { name: 'atlas-universal-wallet' },
  ),
);
