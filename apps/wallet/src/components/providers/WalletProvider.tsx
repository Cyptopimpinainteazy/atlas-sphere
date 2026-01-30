'use client';

import React, { createContext, useContext, useEffect, useState, useCallback, useRef, ReactNode } from 'react';
import { useWalletStore, Transaction, Token } from '@/stores/walletStore';
import { 
  sdkIntegration, 
  ComitSubmissionResult,
  NATIVE_ASSET_SYMBOL, 
  NATIVE_ASSET_DECIMALS,
} from '@/lib/sdkIntegration';
import type { ComitEvent } from '@atlas-sphere/ts-sdk';

interface WalletContextType {
  // Connection
  connectEVM: () => Promise<void>;
  connectSolana: () => Promise<void>;
  connectSubstrate: () => Promise<void>;
  createWallet: () => Promise<void>;
  importWallet: (seedPhrase: string) => Promise<void>;
  // SDK State
  sdkConnected: boolean;
  sdkConnecting: boolean;
  currentBlock: number;
  chainInfo: { name: string; version: string; tokenSymbol: string } | null;
  // Comit Operations
  submitEvmComit: (payload: Uint8Array | string) => Promise<ComitSubmissionResult>;
  submitSvmComit: (payload: Uint8Array | string) => Promise<ComitSubmissionResult>;
  submitDualComit: (evmPayload: Uint8Array | string, svmPayload: Uint8Array | string) => Promise<ComitSubmissionResult>;
  // Balance refresh
  refreshBalance: () => Promise<void>;
}

const WalletContext = createContext<WalletContextType | null>(null);

export function WalletProvider({ children }: { children: ReactNode }) {
  const { setLoading, addAccount, setTokens, accounts, activeAccountIndex, addTransaction, updateTransaction } = useWalletStore();
  
  // SDK connection state
  const [sdkConnected, setSdkConnected] = useState(false);
  const [sdkConnecting, setSdkConnecting] = useState(false);
  const [currentBlock, setCurrentBlock] = useState(0);
  const [chainInfo, setChainInfo] = useState<{ name: string; version: string; tokenSymbol: string } | null>(null);
  const blockSubIdRef = useRef<string | null>(null);
  const comitSubIdRef = useRef<string | null>(null);

  // Initialize SDK connection
  const initSDK = useCallback(async () => {
    if (sdkConnecting || sdkConnected) return;
    
    setSdkConnecting(true);
    try {
      await sdkIntegration.connect();
      
      const info = await sdkIntegration.getChainInfo();
      setChainInfo({
        name: info.name,
        version: info.version,
        tokenSymbol: info.properties.tokenSymbol,
      });
      
      const block = await sdkIntegration.getBlockNumber();
      setCurrentBlock(block);
      
      // Subscribe to block updates
      blockSubIdRef.current = await sdkIntegration.subscribeToBlocks((blockNumber) => {
        setCurrentBlock(blockNumber);
      });
      
      setSdkConnected(true);
      console.log('[Wallet] SDK connected to', info.name);
    } catch (error) {
      console.error('[Wallet] Failed to connect SDK:', error);
    } finally {
      setSdkConnecting(false);
    }
  }, [sdkConnecting, sdkConnected]);

  // Subscribe to Comit events for current account
  const subscribeComitEvents = useCallback(async (address: string) => {
    // Unsubscribe from previous
    if (comitSubIdRef.current) {
      await sdkIntegration.unsubscribe(comitSubIdRef.current);
    }
    
    comitSubIdRef.current = await sdkIntegration.subscribeToComitEvents(
      address,
      (event: ComitEvent) => {
        console.log('[Wallet] Comit event:', event);
        
        // Update transaction status based on event
        if (event.type === 'submitted') {
          const tx: Transaction = {
            id: event.data.comitId,
            type: 'comit',
            status: 'pending',
            amount: '0',
            symbol: NATIVE_ASSET_SYMBOL,
            from: event.data.origin,
            to: '',
            timestamp: Date.now(),
            hash: event.data.comitId,
            network: 'substrate',
          };
          addTransaction(tx);
        } else if (event.type === 'finalized') {
          updateTransaction(event.data.comitId, { status: 'confirmed' });
        } else if (event.type === 'failed') {
          updateTransaction(event.data.comitId, { status: 'failed' });
        }
      }
    );
  }, [addTransaction, updateTransaction]);

  useEffect(() => {
    // Initialize SDK on mount
    const init = async () => {
      await initSDK();
      setLoading(false);
    };
    init();
    
    return () => {
      // Cleanup subscriptions
      if (blockSubIdRef.current) {
        sdkIntegration.unsubscribe(blockSubIdRef.current).catch(() => {});
      }
      if (comitSubIdRef.current) {
        sdkIntegration.unsubscribe(comitSubIdRef.current).catch(() => {});
      }
    };
  }, [initSDK, setLoading]);

  // Subscribe to events when account changes
  useEffect(() => {
    const currentAccount = accounts[activeAccountIndex];
    if (currentAccount && sdkConnected && currentAccount.network === 'substrate') {
      subscribeComitEvents(currentAccount.address).catch(console.error);
    }
  }, [accounts, activeAccountIndex, sdkConnected, subscribeComitEvents]);

  // Refresh balance for current account
  const refreshBalance = useCallback(async () => {
    const currentAccount = accounts[activeAccountIndex];
    if (!currentAccount || currentAccount.network !== 'substrate') return;
    
    try {
      const balance = await sdkIntegration.getCanonicalBalance(currentAccount.address);
      // Get current tokens and update
      const currentTokens = useWalletStore.getState().tokens;
      const updatedTokens = currentTokens.map((token: Token) => 
        token.network === 'substrate' 
          ? { ...token, balance: balance.formatted }
          : token
      );
      setTokens(updatedTokens);
    } catch (error) {
      console.error('[Wallet] Failed to refresh balance:', error);
    }
  }, [accounts, activeAccountIndex, setTokens]);

  // Submit Comit transactions
  const submitEvmComit = useCallback(async (payload: Uint8Array | string): Promise<ComitSubmissionResult> => {
    const currentAccount = accounts[activeAccountIndex];
    if (!currentAccount) {
      return { comitId: '', blockHash: '', blockNumber: 0, success: false, error: 'No account connected' };
    }
    return sdkIntegration.submitEvmComit(currentAccount.address, payload);
  }, [accounts, activeAccountIndex]);

  const submitSvmComit = useCallback(async (payload: Uint8Array | string): Promise<ComitSubmissionResult> => {
    const currentAccount = accounts[activeAccountIndex];
    if (!currentAccount) {
      return { comitId: '', blockHash: '', blockNumber: 0, success: false, error: 'No account connected' };
    }
    return sdkIntegration.submitSvmComit(currentAccount.address, payload);
  }, [accounts, activeAccountIndex]);

  const submitDualComit = useCallback(async (
    evmPayload: Uint8Array | string, 
    svmPayload: Uint8Array | string
  ): Promise<ComitSubmissionResult> => {
    const currentAccount = accounts[activeAccountIndex];
    if (!currentAccount) {
      return { comitId: '', blockHash: '', blockNumber: 0, success: false, error: 'No account connected' };
    }
    return sdkIntegration.submitDualComit(currentAccount.address, evmPayload, svmPayload);
  }, [accounts, activeAccountIndex]);

  const connectEVM = async () => {
    // Check for MetaMask or other EVM wallets
    if (typeof window !== 'undefined' && (window as any).ethereum) {
      try {
        const ethAccounts = await (window as any).ethereum.request({
          method: 'eth_requestAccounts',
        });
        if (ethAccounts[0]) {
          addAccount({
            address: ethAccounts[0],
            name: 'EVM Wallet',
            network: 'evm',
            balance: '0',
          });
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
      // Ensure SDK is connected
      await initSDK();
      
      const balanceInfo = await sdkIntegration.getCanonicalBalance(address);
      const symbol = NATIVE_ASSET_SYMBOL || 'ATLAS';

      addAccount({
        address,
        name: 'Substrate Wallet',
        network: 'substrate',
        balance: balanceInfo.formatted,
      });

      setTokens([
        {
          symbol,
          name: 'Atlas Token',
          balance: balanceInfo.formatted,
          value: '$0.00',
          change24h: 0,
          icon: '⭐',
          network: 'substrate',
        },
      ]);
    } catch (error) {
      console.error('Failed to connect Substrate wallet:', error);
      // Fall back to demo mode
      addAccount({
        address,
        name: 'Substrate Wallet (Demo)',
        network: 'substrate',
        balance: '1000.0000',
      });
      setTokens([
        {
          symbol: 'ATLAS',
          name: 'Atlas Token',
          balance: '1000.0000',
          value: '$0.00',
          change24h: 0,
          icon: '⭐',
          network: 'substrate',
        },
      ]);
    } finally {
      setLoading(false);
    }
  };

  const createWallet = async () => {
    addAccount({
      address: '0x' + Array(40).fill(0).map(() => Math.floor(Math.random() * 16).toString(16)).join(''),
      name: 'New Wallet',
      network: 'evm',
      balance: '0',
    });
    loadDemoTokens();
  };

  const importWallet = async (seedPhrase: string) => {
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
        symbol: 'ATLAS',
        name: 'Atlas Token',
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
        sdkConnected,
        sdkConnecting,
        currentBlock,
        chainInfo,
        submitEvmComit,
        submitSvmComit,
        submitDualComit,
        refreshBalance,
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
