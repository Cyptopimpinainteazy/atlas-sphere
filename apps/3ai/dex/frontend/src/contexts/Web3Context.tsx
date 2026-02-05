import React, { createContext, useContext, useEffect, useMemo, useState } from 'react';
import { Web3Provider } from '@ethersproject/providers';
import { InjectedConnector } from '@web3-react/injected-connector';
import { useWeb3React } from '@web3-react/core';
import { Web3ReactProvider } from '@web3-react/core';
import { ethers } from 'ethers';

export const injectedConnector = new InjectedConnector({
  supportedChainIds: [1, 3, 4, 5, 42, 31337], // Add your chain ID
});

interface GlobalState {
  orders: Array<{id: string; pair: string; price: number; amount: number}>;
  balances: Record<string, {balance: string; allowance: string}>;
  markets: Array<{symbol: string; baseToken: string; quoteToken: string}>;
}

interface StateActions {
  updateOrders: (orders: GlobalState['orders']) => void;
  updateBalances: (balances: GlobalState['balances']) => void;
  updateMarkets: (markets: GlobalState['markets']) => void;
}

type Web3ContextType = ReturnType<typeof useWeb3React<Web3Provider>> & {
  connect: () => Promise<void>;
  disconnect: () => void;
  globalState: GlobalState;
  stateActions: StateActions;
};

const Web3Context = createContext<Web3ContextType | undefined>(undefined);

export const useWeb3 = () => {
  const context = useContext(Web3Context);
  if (context === undefined) {
    throw new Error('useWeb3 must be used within a Web3Provider');
  }
  return context;
};

export const Web3ContextProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { active, account, library, activate, deactivate, chainId } = useWeb3React<Web3Provider>();
  const [isLoading, setIsLoading] = useState(true);
  const [globalState, setGlobalState] = useState({
    orders: [],
    balances: {},
    markets: []
  });
  
  const stateActions = useMemo(() => ({
    updateOrders: (orders) => setGlobalState(prev => ({...prev, orders})),
    updateBalances: (balances) => setGlobalState(prev => ({...prev, balances})),
    updateMarkets: (markets) => setGlobalState(prev => ({...prev, markets}))
  }), []);

  const connect = async () => {
    try {
      await activate(injectedConnector);
    } catch (error) {
      console.error('Error connecting to wallet:', error);
    }
  };

  const disconnect = () => {
    deactivate();
  };

  // Try to connect on mount
  useEffect(() => {
    const tryConnect = async () => {
      try {
        const isAuthorized = await injectedConnector.isAuthorized();
        if (isAuthorized) {
          await activate(injectedConnector);
        }
      } catch (error) {
        console.error('Error connecting to wallet:', error);
      } finally {
        setIsLoading(false);
      }
    };

    tryConnect();
  }, [activate]);

  if (isLoading) {
    return <div>Loading Web3...</div>;
  }

  return (
    <Web3Context.Provider
      value={{
        // Web3React props
        connector: undefined,
        isActive: active,
        isActivating: false,
        account: account || undefined,
        provider: library,
        chainId,
        // Custom implementation
        connect,
        disconnect,
        globalState,
        stateActions,
      }}
    >
      {children}
    </Web3Context.Provider>
  );
};

// Web3 provider wrapper
export const getLibrary = (provider: any): Web3Provider => {
  const library = new Web3Provider(provider);
  library.pollingInterval = 12000;
  return library;
};

export const Web3ProviderWrapper: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  return (
    <Web3ReactProvider getLibrary={getLibrary}>
      <Web3ContextProvider>{children}</Web3ContextProvider>
    </Web3ReactProvider>
  );
};
