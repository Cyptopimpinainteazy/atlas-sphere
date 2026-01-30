import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export interface Token {
  symbol: string;
  name: string;
  balance: string;
  value: string;
  change24h: number;
  icon: string;
  network: 'evm' | 'svm' | 'substrate';
  contractAddress?: string;
  assetId?: number;
}

export interface Transaction {
  id: string;
  type: 'send' | 'receive' | 'swap' | 'comit';
  status: 'pending' | 'confirmed' | 'failed' | 'finalized';
  amount: string;
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
  network: 'evm' | 'svm' | 'substrate';
  balance: string;
  isAuthorized?: boolean;
}

interface WalletState {
  // Connection state
  isConnected: boolean;
  isLoading: boolean;
  connectionError: string | null;
  
  // Chain state
  chainInfo: {
    name: string;
    version: string;
    latestBlock: number;
    isConnected: boolean;
  } | null;
  
  // Accounts
  accounts: WalletAccount[];
  activeAccountIndex: number;
  
  // Balances
  totalBalance: string;
  tokens: Token[];
  
  // Transactions
  transactions: Transaction[];
  pendingComits: string[];
  
  // UI State
  activeView: 'dashboard' | 'send' | 'receive' | 'swap' | 'history' | 'settings' | 'comit' | 'mint';
  
  // Actions
  setConnected: (connected: boolean) => void;
  setLoading: (loading: boolean) => void;
  setConnectionError: (error: string | null) => void;
  setChainInfo: (info: WalletState['chainInfo']) => void;
  addAccount: (account: WalletAccount) => void;
  updateAccount: (index: number, updates: Partial<WalletAccount>) => void;
  setActiveAccount: (index: number) => void;
  setActiveView: (view: WalletState['activeView']) => void;
  setTokens: (tokens: Token[]) => void;
  updateTokenBalance: (symbol: string, balance: string) => void;
  setTotalBalance: (balance: string) => void;
  addTransaction: (tx: Transaction) => void;
  updateTransaction: (id: string, updates: Partial<Transaction>) => void;
  addPendingComit: (comitId: string) => void;
  removePendingComit: (comitId: string) => void;
  disconnect: () => void;
}

export const useWalletStore = create<WalletState>()(
  persist(
    (set, get) => ({
      // Initial state
      isConnected: false,
      isLoading: true,
      connectionError: null,
      chainInfo: null,
      accounts: [],
      activeAccountIndex: 0,
      totalBalance: '$0.00',
      tokens: [],
      transactions: [],
      pendingComits: [],
      activeView: 'dashboard',

      // Actions
      setConnected: (connected) => set({ isConnected: connected }),
      setLoading: (loading) => set({ isLoading: loading }),
      setConnectionError: (error) => set({ connectionError: error }),
      setChainInfo: (info) => set({ chainInfo: info }),
      
      addAccount: (account) => set((state) => ({ 
        accounts: [...state.accounts, account],
        isConnected: true 
      })),
      
      updateAccount: (index, updates) => set((state) => ({
        accounts: state.accounts.map((acc, i) =>
          i === index ? { ...acc, ...updates } : acc
        ),
      })),
      
      setActiveAccount: (index) => set({ activeAccountIndex: index }),
      setActiveView: (view) => set({ activeView: view }),
      setTokens: (tokens) => set({ tokens }),
      
      updateTokenBalance: (symbol, balance) => set((state) => ({
        tokens: state.tokens.map((token) =>
          token.symbol === symbol ? { ...token, balance } : token
        ),
      })),
      
      setTotalBalance: (balance) => set({ totalBalance: balance }),
      
      addTransaction: (tx) => set((state) => ({
        transactions: [tx, ...state.transactions].slice(0, 100), // Keep last 100
      })),
      
      updateTransaction: (id, updates) => set((state) => ({
        transactions: state.transactions.map((tx) =>
          tx.id === id ? { ...tx, ...updates } : tx
        )
      })),
      
      addPendingComit: (comitId) => set((state) => ({
        pendingComits: [...state.pendingComits, comitId],
      })),
      
      removePendingComit: (comitId) => set((state) => ({
        pendingComits: state.pendingComits.filter((id) => id !== comitId),
      })),
      
      disconnect: () => set({
        isConnected: false,
        connectionError: null,
        chainInfo: null,
        accounts: [],
        activeAccountIndex: 0,
        tokens: [],
        transactions: [],
        pendingComits: [],
        totalBalance: '$0.00'
      }),
    }),
    {
      name: 'x3-wallet-storage',
      partialize: (state) => ({
        accounts: state.accounts,
        activeAccountIndex: state.activeAccountIndex,
        transactions: state.transactions.slice(0, 50), // Persist last 50 transactions
      }),
    }
  )
);
