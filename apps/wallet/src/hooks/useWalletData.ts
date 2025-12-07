/**
 * useWalletData - Real SDK Data Integration for Wallet
 * 
 * Connects wallet state to real blockchain data via the Atlas Sphere SDK.
 * Provides automatic balance updates, transaction tracking, and authorization status.
 */

'use client';

import { useEffect, useCallback, useRef } from 'react';
import { useWalletStore, type Token, type Transaction } from '@/stores/walletStore';
import { sdkIntegration, formatBalance, NATIVE_ASSET_ID, NATIVE_ASSET_DECIMALS } from '@/lib/sdkIntegration';
import type { ComitEvent } from '@atlas-sphere/ts-sdk';

// =============================================================================
// Types
// =============================================================================

interface UseWalletDataOptions {
  autoConnect?: boolean;
  refreshInterval?: number;
}

// =============================================================================
// Default Tokens Configuration
// =============================================================================

const DEFAULT_TOKENS: Omit<Token, 'balance' | 'value'>[] = [
  {
    symbol: 'ATLAS',
    name: 'Atlas Sphere',
    icon: '⚛',
    network: 'substrate',
    change24h: 0,
    assetId: 0,
  },
  {
    symbol: 'USDC',
    name: 'USD Coin',
    icon: '💵',
    network: 'evm',
    change24h: 0,
    assetId: 1,
    contractAddress: '0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48',
  },
  {
    symbol: 'WETH',
    name: 'Wrapped Ether',
    icon: '♦',
    network: 'evm',
    change24h: 0,
    assetId: 3,
    contractAddress: '0xc02aaa39b223fe8d0a0e5c4f27ead9083c756cc2',
  },
  {
    symbol: 'SOL',
    name: 'Solana',
    icon: '◎',
    network: 'svm',
    change24h: 0,
    assetId: 100,
    contractAddress: 'So11111111111111111111111111111111111111112',
  },
];

// =============================================================================
// Main Hook
// =============================================================================

export function useWalletData(options: UseWalletDataOptions = {}) {
  const { autoConnect = true, refreshInterval = 30000 } = options;

  const {
    accounts,
    activeAccountIndex,
    isConnected,
    setConnected,
    setLoading,
    setConnectionError,
    setChainInfo,
    setTokens,
    updateTokenBalance,
    setTotalBalance,
    updateAccount,
    addTransaction,
    updateTransaction,
    addPendingComit,
    removePendingComit,
  } = useWalletStore();

  const mountedRef = useRef(true);
  const eventSubRef = useRef<string | null>(null);
  const blockSubRef = useRef<string | null>(null);

  const activeAccount = accounts[activeAccountIndex];

  // ==========================================================================
  // Connect to SDK
  // ==========================================================================

  const connectSDK = useCallback(async () => {
    if (!mountedRef.current) return;

    setLoading(true);
    setConnectionError(null);

    try {
      await sdkIntegration.connect();

      // Get chain info
      const chainInfo = await sdkIntegration.getChainInfo();
      const blockNumber = await sdkIntegration.getBlockNumber();

      setChainInfo({
        name: chainInfo.name,
        version: chainInfo.version,
        latestBlock: blockNumber,
        isConnected: true,
      });

      setConnected(true);

      // Subscribe to block updates
      blockSubRef.current = await sdkIntegration.subscribeToBlocks((blockNum) => {
        if (mountedRef.current) {
          setChainInfo({
            name: chainInfo.name,
            version: chainInfo.version,
            latestBlock: blockNum,
            isConnected: true,
          });
        }
      });

      console.log('[useWalletData] Connected to SDK');
    } catch (error) {
      setConnectionError(error instanceof Error ? error.message : String(error));
      setConnected(false);
    } finally {
      setLoading(false);
    }
  }, [setLoading, setConnectionError, setChainInfo, setConnected]);

  // ==========================================================================
  // Fetch Balances
  // ==========================================================================

  const fetchBalances = useCallback(async () => {
    if (!activeAccount || !isConnected) return;

    try {
      // Fetch native balance
      const nativeBalance = await sdkIntegration.getCanonicalBalance(
        activeAccount.address,
        NATIVE_ASSET_ID
      );

      // Update native token
      updateTokenBalance('ATLAS', nativeBalance.formatted);

      // Fetch other asset balances
      const assetIds = [1, 3, 100]; // USDC, WETH, SOL
      const balances = await sdkIntegration.getMultipleBalances(activeAccount.address, assetIds);

      // Update token balances
      for (const [assetId, balanceInfo] of balances) {
        const token = DEFAULT_TOKENS.find(t => t.assetId === assetId);
        if (token) {
          updateTokenBalance(token.symbol, balanceInfo.formatted);
        }
      }

      // Calculate total balance (simplified - just use native for now)
      const totalNative = parseFloat(nativeBalance.formatted.replace(/,/g, ''));
      const atlasPrice = 1.25; // Mock price
      setTotalBalance(`$${(totalNative * atlasPrice).toFixed(2)}`);

      // Update account balance
      updateAccount(activeAccountIndex, { balance: nativeBalance.formatted });
    } catch (error) {
      console.error('[useWalletData] Failed to fetch balances:', error);
    }
  }, [activeAccount, activeAccountIndex, isConnected, updateTokenBalance, setTotalBalance, updateAccount]);

  // ==========================================================================
  // Check Authorization
  // ==========================================================================

  const checkAuthorization = useCallback(async () => {
    if (!activeAccount || !isConnected) return;

    try {
      const authorized = await sdkIntegration.isAuthorized(activeAccount.address);
      updateAccount(activeAccountIndex, { isAuthorized: authorized });
    } catch (error) {
      console.error('[useWalletData] Failed to check authorization:', error);
    }
  }, [activeAccount, activeAccountIndex, isConnected, updateAccount]);

  // ==========================================================================
  // Subscribe to Comit Events
  // ==========================================================================

  const subscribeToEvents = useCallback(async () => {
    if (!activeAccount || !isConnected) return;

    // Unsubscribe from previous subscription
    if (eventSubRef.current) {
      await sdkIntegration.unsubscribe(eventSubRef.current);
      eventSubRef.current = null;
    }

    try {
      eventSubRef.current = await sdkIntegration.subscribeToComitEvents(
        activeAccount.address,
        (event: ComitEvent) => {
          if (!mountedRef.current) return;

          console.log('[useWalletData] Comit event:', event);

          switch (event.type) {
            case 'submitted':
              addPendingComit(event.data.comitId);
              addTransaction({
                id: event.data.comitId,
                type: 'comit',
                status: 'pending',
                amount: event.data.fee?.toString() || '0',
                symbol: 'ATLAS',
                from: event.data.origin,
                to: '',
                timestamp: Date.now(),
                hash: event.data.comitId,
                network: 'substrate',
                comitId: event.data.comitId,
              });
              break;

            case 'executionCompleted':
              updateTransaction(event.data.comitId, {
                status: event.data.success ? 'confirmed' : 'failed',
              });
              break;

            case 'finalized':
              updateTransaction(event.data.comitId, {
                status: 'finalized',
              });
              removePendingComit(event.data.comitId);
              // Refresh balances after finalization
              fetchBalances();
              break;

            case 'failed':
              updateTransaction(event.data.comitId, {
                status: 'failed',
              });
              removePendingComit(event.data.comitId);
              break;
          }
        }
      );
    } catch (error) {
      console.error('[useWalletData] Failed to subscribe to events:', error);
    }
  }, [activeAccount, isConnected, addPendingComit, addTransaction, updateTransaction, removePendingComit, fetchBalances]);

  // ==========================================================================
  // Initialize Tokens
  // ==========================================================================

  const initializeTokens = useCallback(() => {
    const tokens: Token[] = DEFAULT_TOKENS.map(t => ({
      ...t,
      balance: '0',
      value: '$0.00',
    }));
    setTokens(tokens);
  }, [setTokens]);

  // ==========================================================================
  // Effects
  // ==========================================================================

  // Auto-connect on mount
  useEffect(() => {
    mountedRef.current = true;

    if (autoConnect) {
      connectSDK();
      initializeTokens();
    }

    return () => {
      mountedRef.current = false;
      
      // Cleanup subscriptions
      if (eventSubRef.current) {
        sdkIntegration.unsubscribe(eventSubRef.current).catch(() => {});
      }
      if (blockSubRef.current) {
        sdkIntegration.unsubscribe(blockSubRef.current).catch(() => {});
      }
    };
  }, [autoConnect, connectSDK, initializeTokens]);

  // Fetch data when account changes
  useEffect(() => {
    if (isConnected && activeAccount) {
      fetchBalances();
      checkAuthorization();
      subscribeToEvents();
    }
  }, [isConnected, activeAccount, fetchBalances, checkAuthorization, subscribeToEvents]);

  // Periodic balance refresh
  useEffect(() => {
    if (!isConnected || !activeAccount) return;

    const interval = setInterval(fetchBalances, refreshInterval);
    return () => clearInterval(interval);
  }, [isConnected, activeAccount, refreshInterval, fetchBalances]);

  // ==========================================================================
  // Return Values
  // ==========================================================================

  return {
    // State
    isConnected,
    activeAccount,
    
    // Actions
    connect: connectSDK,
    refreshBalances: fetchBalances,
    checkAuthorization,
    
    // SDK access for direct operations
    submitEvmComit: sdkIntegration.submitEvmComit.bind(sdkIntegration),
    submitSvmComit: sdkIntegration.submitSvmComit.bind(sdkIntegration),
    submitDualComit: sdkIntegration.submitDualComit.bind(sdkIntegration),
  };
}

export default useWalletData;
