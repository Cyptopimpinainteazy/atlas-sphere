'use client';

import React, { createContext, useContext, useEffect, ReactNode } from 'react';
import { useWalletStore } from '@/stores/walletStore';
import { getAtlasClient } from '@/lib/atlasClient';
import { NATIVE_ASSET_SYMBOL, NATIVE_ASSET_DECIMALS } from '@atlas-sphere/ts-sdk';

interface WalletContextType {
  connectEVM: () => Promise<void>;
  connectSolana: () => Promise<void>;
  connectSubstrate: () => Promise<void>;
  createWallet: () => Promise<void>;
  importWallet: (seedPhrase: string) => Promise<void>;
}

const WalletContext = createContext<WalletContextType | null>(null);

export function WalletProvider({ children }: { children: ReactNode }) {
  const { setLoading, addAccount, setTokens } = useWalletStore();

  useEffect(() => {
    // Initialize wallet on mount
    const initWallet = async () => {
      // Check for existing connections
      await new Promise((resolve) => setTimeout(resolve, 500));
      setLoading(false);
    };
    initWallet();
  }, [setLoading]);

  const connectEVM = async () => {
    // Check for MetaMask or other EVM wallets
    if (typeof window !== 'undefined' && (window as any).ethereum) {
      try {
        const accounts = await (window as any).ethereum.request({
          method: 'eth_requestAccounts',
        });
        if (accounts[0]) {
          addAccount({
            address: accounts[0],
            name: 'EVM Wallet',
            network: 'evm',
            balance: '0',
          });
          // Load demo tokens
          loadDemoTokens();
        }
      } catch (error) {
        console.error('Failed to connect EVM wallet:', error);
      }
    } else {
      // Demo mode - create mock account
      addAccount({
        address: '0x742d35Cc6634C0532925a3b844Bc9e7595f12ABC',
        name: 'EVM Wallet',
        network: 'evm',
        balance: '2.45',
      });
      loadDemoTokens();
    }
  };

  const connectSolana = async () => {
    // Check for Phantom or other Solana wallets
    if (typeof window !== 'undefined' && (window as any).solana?.isPhantom) {
      try {
        const response = await (window as any).solana.connect();
        addAccount({
          address: response.publicKey.toString(),
          name: 'Solana Wallet',
          network: 'svm',
          balance: '0',
        });
        loadDemoTokens();
      } catch (error) {
        console.error('Failed to connect Solana wallet:', error);
      }
    } else {
      // Demo mode
      addAccount({
        address: '7xKXtg2CW87d97TXJSDpbD5jBkheTqA83TZRuJosgAsU',
        name: 'Solana Wallet',
        network: 'svm',
        balance: '15.8',
      });
      loadDemoTokens();
    }
  };

  const connectSubstrate = async () => {
    const address = '5GrwvaEF5zXb26Fz9rcQpDWS57CtERHpNehXCPcNoHGKutQY';

    setLoading(true);
    try {
      const client = await getAtlasClient();
      const canonicalBalance = await client.getCanonicalBalance(address as any);

      const decimals = NATIVE_ASSET_DECIMALS;
      const symbol = NATIVE_ASSET_SYMBOL || 'STAR';

      const divisor = 10 ** decimals;
      const humanBalanceNumber = Number(canonicalBalance) / divisor;
      const humanBalance = humanBalanceNumber.toLocaleString('en-US', {
        minimumFractionDigits: 4,
        maximumFractionDigits: 4,
      });

      addAccount({
        address,
        name: 'Substrate Wallet',
        network: 'substrate',
        balance: humanBalance,
      });

      setTokens([
        {
          symbol,
          name: 'X3 STAR',
          balance: humanBalance,
          value: '$0.00',
          change24h: 0,
          icon: '⭐',
          network: 'substrate',
        },
      ]);
    } catch (error) {
      console.error('Failed to connect Substrate wallet:', error);
    } finally {
      setLoading(false);
    }
  };

  const createWallet = async () => {
    // Generate new wallet (demo)
    addAccount({
      address: '0x' + Array(40).fill(0).map(() => Math.floor(Math.random() * 16).toString(16)).join(''),
      name: 'New Wallet',
      network: 'evm',
      balance: '0',
    });
    loadDemoTokens();
  };

  const importWallet = async (seedPhrase: string) => {
    // Import from seed phrase (demo)
    if (seedPhrase.split(' ').length >= 12) {
      addAccount({
        address: '0x' + Array(40).fill(0).map(() => Math.floor(Math.random() * 16).toString(16)).join(''),
        name: 'Imported Wallet',
        network: 'evm',
        balance: '0',
      });
      loadDemoTokens();
    }
  };

  const loadDemoTokens = () => {
    setTokens([
      {
        symbol: 'STAR',
        name: 'X3 STAR',
        balance: '1,250.00',
        value: '$3,750.00',
        change24h: 5.2,
        icon: '⭐',
        network: 'substrate',
      },
      {
        symbol: 'ETH',
        name: 'Ethereum',
        balance: '2.45',
        value: '$4,900.00',
        change24h: -1.3,
        icon: '◆',
        network: 'evm',
      },
      {
        symbol: 'SOL',
        name: 'Solana',
        balance: '15.80',
        value: '$1,580.00',
        change24h: 3.8,
        icon: '◎',
        network: 'svm',
      },
      {
        symbol: 'USDC',
        name: 'USD Coin',
        balance: '500.00',
        value: '$500.00',
        change24h: 0.01,
        icon: '$',
        network: 'evm',
      },
    ]);
  };

  return (
    <WalletContext.Provider
      value={{
        connectEVM,
        connectSolana,
        connectSubstrate,
        createWallet,
        importWallet,
      }}
    >
      {children}
    </WalletContext.Provider>
  );
}

export function useWalletContext() {
  const context = useContext(WalletContext);
  if (!context) {
    throw new Error('useWalletContext must be used within WalletProvider');
  }
  return context;
}
