import React from 'react';
import WalletProvider from './context/WalletProvider';
import { MainLayout } from './components/MainLayout';

export const WalletApp = () => {
  return (
    <WalletProvider>
      <MainLayout />
    </WalletProvider>
  );
};

export default WalletApp;
