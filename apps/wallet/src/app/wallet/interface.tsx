import React from 'react';
import { WalletProvider, WalletContext } from './WalletContext';
import { MainLayout } from './components/MainLayout';

export const WalletApp = () => {
  return (
    <WalletProvider>
      <MainLayout />
    </WalletProvider>
  );
};

export default WalletApp;
