'use client';

import { X, Wallet, ExternalLink } from 'lucide-react';
import { useWalletStore } from '@/stores/wallet';

interface ConnectWalletModalProps {
  onClose: () => void;
}

const WALLETS = [
  {
    id: 'metamask',
    name: 'MetaMask',
    icon: '🦊',
    vm: 'evm' as const,
    description: 'Connect using MetaMask browser extension',
  },
  {
    id: 'walletconnect',
    name: 'WalletConnect',
    icon: '🔗',
    vm: 'evm' as const,
    description: 'Scan QR code with mobile wallet',
  },
  {
    id: 'phantom',
    name: 'Phantom',
    icon: '👻',
    vm: 'svm' as const,
    description: 'Connect using Phantom wallet',
  },
  {
    id: 'solflare',
    name: 'Solflare',
    icon: '☀️',
    vm: 'svm' as const,
    description: 'Connect using Solflare wallet',
  },
];

export function ConnectWalletModal({ onClose }: ConnectWalletModalProps) {
  const { connect } = useWalletStore();

  const handleConnect = async (walletId: string, vm: 'evm' | 'svm') => {
    // In production, this would use actual wallet connection logic
    // For now, we'll mock it
    try {
      if (vm === 'evm' && typeof window !== 'undefined' && (window as any).ethereum) {
        const accounts = await (window as any).ethereum.request({
          method: 'eth_requestAccounts',
        });
        if (accounts[0]) {
          connect(accounts[0], vm);
          onClose();
          return;
        }
      }
      
      // Mock connection for demo
      const mockAddress = vm === 'evm'
        ? '0x742d35Cc6634C0532925a3b844Bc9e7595f2bD34'
        : '5GrwvaEF5zXb26Fz9rcQpDWS57CtERHpNehXCPcNoHGKutQY';
      
      connect(mockAddress, vm);
      onClose();
    } catch (error) {
      console.error('Failed to connect:', error);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
      <div className="w-full max-w-md mx-4 glass rounded-2xl">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-border">
          <div className="flex items-center gap-2">
            <Wallet className="w-5 h-5 text-primary" />
            <h3 className="text-lg font-bold">Connect Wallet</h3>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-lg hover:bg-muted transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Wallet List */}
        <div className="p-4 space-y-2">
          {WALLETS.map((wallet) => (
            <button
              key={wallet.id}
              onClick={() => handleConnect(wallet.id, wallet.vm)}
              className="w-full flex items-center gap-4 p-4 rounded-xl bg-muted/30 hover:bg-muted/50 transition group"
            >
              <div className="text-3xl">{wallet.icon}</div>
              <div className="flex-1 text-left">
                <div className="flex items-center gap-2">
                  <span className="font-medium">{wallet.name}</span>
                  <span className="text-xs px-1.5 py-0.5 rounded bg-muted uppercase text-muted-foreground">
                    {wallet.vm}
                  </span>
                </div>
                <div className="text-sm text-muted-foreground">
                  {wallet.description}
                </div>
              </div>
              <ExternalLink className="w-5 h-5 text-muted-foreground group-hover:text-primary transition" />
            </button>
          ))}
        </div>

        {/* Info */}
        <div className="px-4 pb-4">
          <div className="p-3 rounded-lg bg-primary/10 text-sm text-primary">
            <strong>Dual-VM Support:</strong> Connect an EVM wallet (MetaMask) for Ethereum assets
            or an SVM wallet (Phantom) for Solana assets. Atlas DEX supports atomic cross-VM swaps.
          </div>
        </div>
      </div>
    </div>
  );
}
