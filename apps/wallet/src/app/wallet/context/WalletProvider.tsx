import React, { useState } from 'react';
import WalletContext, { WalletContextType } from './WalletContext';

export const WalletProvider = ({ children }: { children: React.ReactNode }) => {
  const [walletAddress, setWalletAddress] = useState('');
  const [privateKey, setPrivateKey] = useState('');
  const [isConnected, setIsConnected] = useState(false);

  const connectWallet = () => {
    // Implementation for connecting wallet would go here
    setWalletAddress('0xexampleaddress');
    setPrivateKey('your_private_key_here');
    setIsConnected(true);
  };

  const value: WalletContextType = {
    walletAddress,
    setWalletAddress,
    privateKey,
    setPrivateKey,
    isConnected,
    setIsConnected,
    connectWallet,
  };

  return (
    <WalletContext.Provider value={value}>
      {children}
    </WalletContext.Provider>
  );
};

export default WalletProvider;
