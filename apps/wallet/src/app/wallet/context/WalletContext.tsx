import React, { createContext, useContext } from 'react';

export interface WalletContextType {
  walletAddress?: string;
  setWalletAddress?: (addr: string) => void;
  privateKey?: string;
  setPrivateKey?: (k: string) => void;
  isConnected?: boolean;
  setIsConnected?: (b: boolean) => void;
  connectWallet?: () => void;
}

// Wallet Context
export const WalletContext = createContext<WalletContextType | null>(null);
export default WalletContext;

export const useWallet = () => {
  return useContext(WalletContext);
};
