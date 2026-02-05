'use client';

import Link from 'next/link';
import { useWalletStore } from '@/stores/wallet';
import { Wallet, ChevronDown, Activity } from 'lucide-react';
import { useState } from 'react';
import { ConnectWalletModal } from '@/components/wallet/connect-modal';

export function Header() {
  const { isConnected, address, disconnect } = useWalletStore();
  const [showConnectModal, setShowConnectModal] = useState(false);

  return (
    <header className="border-b border-border bg-card/50 backdrop-blur sticky top-0 z-50">
      <div className="container mx-auto px-4">
        <div className="flex items-center justify-between h-16">
          {/* Logo */}
          <Link href="/" className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg gradient-primary flex items-center justify-center">
              <span className="font-bold text-white">A</span>
            </div>
            <span className="font-bold text-xl">Atlas DEX</span>
          </Link>

          {/* Navigation */}
          <nav className="hidden md:flex items-center gap-6">
            <Link href="/" className="text-foreground font-medium hover:text-primary transition">
              Swap
            </Link>
            <Link href="/pools" className="text-muted-foreground hover:text-foreground transition">
              Pools
            </Link>
            <Link href="/bridge" className="text-muted-foreground hover:text-foreground transition">
              Bridge
            </Link>
            <Link href="/portfolio" className="text-muted-foreground hover:text-foreground transition">
              Portfolio
            </Link>
          </nav>

          {/* Right Side */}
          <div className="flex items-center gap-4">
            {/* Network Status */}
            <div className="hidden md:flex items-center gap-2 px-3 py-1.5 rounded-lg bg-muted text-sm">
              <Activity className="w-4 h-4 text-success" />
              <span>Atlas Testnet</span>
            </div>

            {/* Wallet */}
            {isConnected && address ? (
              <button
                onClick={disconnect}
                className="flex items-center gap-2 px-4 py-2 rounded-lg bg-card border border-border hover:border-primary transition"
              >
                <Wallet className="w-4 h-4" />
                <span className="font-mono text-sm">
                  {address.slice(0, 6)}...{address.slice(-4)}
                </span>
                <ChevronDown className="w-4 h-4" />
              </button>
            ) : (
              <button
                onClick={() => setShowConnectModal(true)}
                className="px-4 py-2 rounded-lg gradient-primary font-medium hover:opacity-90 transition"
              >
                Connect Wallet
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Connect Modal */}
      {showConnectModal && (
        <ConnectWalletModal onClose={() => setShowConnectModal(false)} />
      )}
    </header>
  );
}
