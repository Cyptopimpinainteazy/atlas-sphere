'use client';

import { useState } from 'react';
import { useWalletStore } from '@/stores/walletStore';
import { 
  Copy, 
  Check, 
  QrCode,
  ChevronDown,
  Share2
} from 'lucide-react';

export function ReceiveView() {
  const { accounts, activeAccountIndex, tokens } = useWalletStore();
  const [copied, setCopied] = useState(false);
  const [selectedNetwork, setSelectedNetwork] = useState<'evm' | 'svm' | 'substrate'>('evm');
  const [showDropdown, setShowDropdown] = useState(false);

  const activeAccount = accounts[activeAccountIndex];

  // Demo addresses for different networks
  const addresses = {
    evm: activeAccount?.address || '0x742d35Cc6634C0532925a3b844Bc9e7595f12ABC',
    svm: '7xKXtg2CW87d97TXJSDpbD5jBkheTqA83TZRuJosgAsU',
    substrate: '5GrwvaEF5zXb26Fz9rcQpDWS57CtERHpNehXCPcNoHGKutQY',
  };

  const networkInfo = {
    evm: { name: 'Ethereum / EVM', icon: '◆', color: 'bg-[#627EEA]/20 text-[#627EEA]' },
    svm: { name: 'Solana / SVM', icon: '◎', color: 'bg-[#9945FF]/20 text-[#9945FF]' },
    substrate: { name: 'X3 STAR Native', icon: '⭐', color: 'bg-orange-500/20 text-orange-400' },
  };

  const copyAddress = () => {
    navigator.clipboard.writeText(addresses[selectedNetwork]);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="max-w-lg">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-white mb-1">Receive</h1>
        <p className="text-gray-500">Share your address to receive tokens</p>
      </div>

      <div className="glass-card p-6">
        {/* Network Selection */}
        <div className="mb-6">
          <label className="block text-sm text-gray-400 mb-2">Network</label>
          <div className="relative">
            <button
              onClick={() => setShowDropdown(!showDropdown)}
              className="w-full flex items-center justify-between p-4 rounded-xl bg-[#0a0a0a] border border-[#1a1a1a] hover:border-orange-500/30 transition-all"
            >
              <div className="flex items-center gap-3">
                <div className={`w-8 h-8 rounded-lg flex items-center justify-center text-lg ${networkInfo[selectedNetwork].color}`}>
                  {networkInfo[selectedNetwork].icon}
                </div>
                <span className="font-medium text-white">{networkInfo[selectedNetwork].name}</span>
              </div>
              <ChevronDown className="w-5 h-5 text-gray-400" />
            </button>

            {showDropdown && (
              <div className="absolute z-10 w-full mt-2 rounded-xl bg-[#0a0a0a] border border-[#1a1a1a] shadow-2xl overflow-hidden">
                {Object.entries(networkInfo).map(([key, info]) => (
                  <button
                    key={key}
                    onClick={() => {
                      setSelectedNetwork(key as any);
                      setShowDropdown(false);
                    }}
                    className="w-full flex items-center gap-3 p-4 hover:bg-[#111111] transition-colors"
                  >
                    <div className={`w-8 h-8 rounded-lg flex items-center justify-center text-lg ${info.color}`}>
                      {info.icon}
                    </div>
                    <span className="font-medium text-white">{info.name}</span>
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* QR Code */}
        <div className="flex justify-center mb-6">
          <div className="p-4 rounded-2xl bg-white">
            {/* Placeholder QR code */}
            <div className="w-48 h-48 relative">
              <div className="absolute inset-0 grid grid-cols-8 gap-0.5">
                {Array(64).fill(0).map((_, i) => (
                  <div 
                    key={i}
                    className={`aspect-square ${Math.random() > 0.5 ? 'bg-black' : 'bg-white'}`}
                  />
                ))}
              </div>
              <div className="absolute inset-0 flex items-center justify-center">
                <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-orange-500 to-red-500 flex items-center justify-center">
                  <span className="text-white text-xl">{networkInfo[selectedNetwork].icon}</span>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Address */}
        <div className="mb-6">
          <label className="block text-sm text-gray-400 mb-2">Your Address</label>
          <div className="flex items-center gap-2">
            <div className="flex-1 p-4 rounded-xl bg-[#0a0a0a] border border-[#1a1a1a]">
              <p className="font-mono text-sm text-white break-all">
                {addresses[selectedNetwork]}
              </p>
            </div>
          </div>
        </div>

        {/* Actions */}
        <div className="flex gap-3">
          <button
            onClick={copyAddress}
            className="flex-1 btn-primary flex items-center justify-center gap-2"
          >
            {copied ? (
              <>
                <Check className="w-5 h-5" />
                Copied!
              </>
            ) : (
              <>
                <Copy className="w-5 h-5" />
                Copy Address
              </>
            )}
          </button>
          <button className="btn-secondary flex items-center justify-center gap-2">
            <Share2 className="w-5 h-5" />
            Share
          </button>
        </div>

        {/* Warning */}
        <div className="mt-6 p-4 rounded-xl bg-amber-500/10 border border-amber-500/30">
          <p className="text-sm text-amber-400">
            Only send {networkInfo[selectedNetwork].name} compatible tokens to this address.
          </p>
        </div>
      </div>
    </div>
  );
}
