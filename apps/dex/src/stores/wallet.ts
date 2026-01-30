'use client';

import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export interface Token {
  address: string;
  symbol: string;
  name: string;
  decimals: number;
  logoUri?: string;
  vm: 'evm' | 'svm';
  balance?: string;
}

interface WalletState {
  isConnected: boolean;
  address: string | null;
  evmAddress: string | null;
  svmAddress: string | null;
  chainId: number | null;
  balances: Record<string, string>;
  
  // Actions
  connect: (address: string, vm: 'evm' | 'svm') => void;
  disconnect: () => void;
  setBalance: (token: string, balance: string) => void;
  setChainId: (chainId: number) => void;
}

export const useWalletStore = create<WalletState>()(
  persist(
    (set) => ({
      isConnected: false,
      address: null,
      evmAddress: null,
      svmAddress: null,
      chainId: null,
      balances: {},

      connect: (address: string, vm: 'evm' | 'svm') => {
        set({
          isConnected: true,
          address,
          [vm === 'evm' ? 'evmAddress' : 'svmAddress']: address,
        });
      },

      disconnect: () => {
        set({
          isConnected: false,
          address: null,
          evmAddress: null,
          svmAddress: null,
          chainId: null,
          balances: {},
        });
      },

      setBalance: (token: string, balance: string) => {
        set((state) => ({
          balances: { ...state.balances, [token]: balance },
        }));
      },

      setChainId: (chainId: number) => set({ chainId }),
    }),
    {
      name: 'atlas-dex-wallet',
      partialize: (state) => ({
        address: state.address,
        evmAddress: state.evmAddress,
        svmAddress: state.svmAddress,
      }),
    }
  )
);
