import React, { createContext, useContext, useState, useEffect } from 'react';
import WalletProvider from './WalletProvider';

// Wallet Context
export const WalletContext = createContext(null);

// Wallet Provider
export const WalletProvider = ({ children }) => {
  const [walletAddress, setWalletAddress] = useState('');
  const [privateKey, setPrivateKey] = useState('');
  const [isConnected, setIsConnected] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Implement wallet connection logic here
    setLoading(false);
  }, []);

  // If wallet is not connected, show wallet connection UI
  if (loading) return null;
  if (!isConnected) return <WalletConnection />;

  return (
    <WalletContext.Provider value={{ walletAddress, setWalletAddress, privateKey, setPrivateKey, isConnected, setIsConnected }}>
      {children}
    </WalletContext.Provider>
  );
};

export const useWallet = () => {
  return useContext(WalletContext);
};
