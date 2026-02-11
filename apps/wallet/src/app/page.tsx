'use client';

import Link from 'next/link';
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

  return (
    <div>
      {/* Top Navigation */}
      <nav className="bg-x3-darker border-b border-x3-dark-gray p-4">
        <div className="max-w-7xl mx-auto flex items-center gap-6">
          <h1 className="text-lg font-bold">X3 STAR Wallet</h1>
          <div className="flex gap-4 ml-auto">
            <Link
              href="/trading/floor"
              className="px-4 py-2 bg-x3-orange hover:bg-orange-600 text-white rounded font-medium transition-colors flex items-center gap-2"
            >
              📊 X3 Trading
            </Link>
            <Link
              href="/polkadex/trading"
              className="px-4 py-2 bg-x3-orange hover:bg-orange-600 text-white rounded font-medium transition-colors flex items-center gap-2"
            >
              🔄 POLKADEX
            </Link>
          </div>
        </div>
      </nav>
      <WalletDashboard />
    </div>
  );
}

export default function Home() {
  return (
    <WalletProvider>
      <WalletApp />
    </WalletProvider>
  );
}
