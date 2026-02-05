'use client';

import { useState, useEffect } from 'react';
import { WalletProvider } from '@/components/providers/WalletProvider';
import { WalletDashboard } from '@/components/wallet/WalletDashboard';
import { ConnectWallet } from '@/components/wallet/ConnectWallet';
import { useWalletStore } from '@/stores/walletStore';

function WalletApp() {
  const { isConnected, isLoading } = useWalletStore();

  if (isLoading) {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center">
        <div className="text-center">
          <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-gradient-to-r from-orange-500 to-red-500 animate-pulse" />
          <p className="text-gray-400">Loading wallet...</p>
        </div>
      </div>
    );
  }

  if (!isConnected) {
    return <ConnectWallet />;
  }

  return <WalletDashboard />;
}

export default function Home() {
  return (
    <WalletProvider>
      <WalletApp />
    </WalletProvider>
  );
}
