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
}

export interface Transaction {
  id: string;
  type: 'send' | 'receive' | 'swap' | 'comit';
  status: 'pending' | 'confirmed' | 'failed';
  amount: string;
  symbol: string;
  from: string;
  to: string;
  timestamp: number;
  hash: string;
  network: 'evm' | 'svm' | 'substrate';
}

export interface WalletAccount {
  address: string;
  name: string;
  network: 'evm' | 'svm' | 'substrate';
  balance: string;
}

interface WalletState {
  // Connection state
  isConnected: boolean;
  isLoading: boolean;
  
  // Accounts
  accounts: WalletAccount[];
  activeAccountIndex: number;
  
  // Balances
  totalBalance: string;
  tokens: Token[];
  
  // Transactions
  transactions: Transaction[];
  
  // UI State
  activeView: 'dashboard' | 'send' | 'receive' | 'swap' | 'history' | 'settings' | 'comit';
  
  // Actions
  setConnected: (connected: boolean) => void;
  setLoading: (loading: boolean) => void;
  addAccount: (account: WalletAccount) => void;
  setActiveAccount: (index: number) => void;
  setActiveView: (view: WalletState['activeView']) => void;
  setTokens: (tokens: Token[]) => void;
  addTransaction: (tx: Transaction) => void;
  updateTransaction: (id: string, updates: Partial<Transaction>) => void;
  disconnect: () => void;
}

export const useWalletStore = create<WalletState>()(
  persist(
    (set) => ({
      // Initial state
      isConnected: false,
      isLoading: true,
      accounts: [],
      activeAccountIndex: 0,
      totalBalance: '$0.00',
      tokens: [],
      transactions: [],
      activeView: 'dashboard',

      // Actions
      setConnected: (connected) => set({ isConnected: connected }),
      setLoading: (loading) => set({ isLoading: loading }),
      
      addAccount: (account) => set((state) => ({ 
        accounts: [...state.accounts, account],
        isConnected: true 
      })),
      
      setActiveAccount: (index) => set({ activeAccountIndex: index }),
      setActiveView: (view) => set({ activeView: view }),
      setTokens: (tokens) => set({ tokens }),
      
      addTransaction: (tx) => set((state) => ({
        transactions: [tx, ...state.transactions]
      })),
      
      updateTransaction: (id, updates) => set((state) => ({
        transactions: state.transactions.map((tx) =>
          tx.id === id ? { ...tx, ...updates } : tx
        )
      })),
      
      disconnect: () => set({
        isConnected: false,
        accounts: [],
        activeAccountIndex: 0,
        tokens: [],
        transactions: [],
        totalBalance: '$0.00'
      }),
    }),
    {
      name: 'x3-wallet-storage',
      partialize: (state) => ({
        accounts: state.accounts,
        activeAccountIndex: state.activeAccountIndex,
      }),
    }
  )
);
