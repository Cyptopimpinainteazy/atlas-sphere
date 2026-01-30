'use client';

import { useState } from 'react';
import { useWalletContext } from '@/components/providers/WalletProvider';
import { 
  Wallet, 
  Plus, 
  Download, 
  ChevronRight,
  Hexagon,
  Globe,
  Shield,
  Zap
} from 'lucide-react';

export function ConnectWallet() {
  const [view, setView] = useState<'main' | 'create' | 'import'>('main');
  const [seedPhrase, setSeedPhrase] = useState('');
  const { connectEVM, connectSolana, connectSubstrate, createWallet, importWallet } = useWalletContext();

  if (view === 'create') {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center p-4">
        <div className="w-full max-w-md">
          <button 
            onClick={() => setView('main')}
            className="text-gray-400 hover:text-white mb-8 flex items-center gap-2"
          >
            ← Back
          </button>
          
          <div className="glass-card p-8">
            <div className="w-16 h-16 mx-auto mb-6 rounded-2xl bg-gradient-to-br from-orange-500 to-red-500 flex items-center justify-center">
              <Plus className="w-8 h-8 text-white" />
            </div>
            
            <h2 className="text-2xl font-bold text-white text-center mb-2">Create New Wallet</h2>
            <p className="text-gray-400 text-center mb-8">
              A new wallet will be generated for you
            </p>

            <div className="space-y-4 mb-8">
              <div className="flex items-center gap-3 p-4 rounded-xl bg-[#111111] border border-[#1a1a1a]">
                <Shield className="w-5 h-5 text-emerald-400" />
                <span className="text-sm text-gray-300">Secured with encryption</span>
              </div>
              <div className="flex items-center gap-3 p-4 rounded-xl bg-[#111111] border border-[#1a1a1a]">
                <Zap className="w-5 h-5 text-amber-400" />
                <span className="text-sm text-gray-300">Multi-VM support (EVM + SVM)</span>
              </div>
            </div>

            <button 
              onClick={() => createWallet()}
              className="btn-primary w-full"
            >
              Create Wallet
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (view === 'import') {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center p-4">
        <div className="w-full max-w-md">
          <button 
            onClick={() => setView('main')}
            className="text-gray-400 hover:text-white mb-8 flex items-center gap-2"
          >
            ← Back
          </button>
          
          <div className="glass-card p-8">
            <div className="w-16 h-16 mx-auto mb-6 rounded-2xl bg-gradient-to-br from-cyan-500 to-blue-500 flex items-center justify-center">
              <Download className="w-8 h-8 text-white" />
            </div>
            
            <h2 className="text-2xl font-bold text-white text-center mb-2">Import Wallet</h2>
            <p className="text-gray-400 text-center mb-8">
              Enter your 12 or 24 word recovery phrase
            </p>

            <textarea
              value={seedPhrase}
              onChange={(e) => setSeedPhrase(e.target.value)}
              placeholder="Enter your seed phrase..."
              className="input-field h-32 resize-none mb-6"
            />

            <button 
              onClick={() => importWallet(seedPhrase)}
              disabled={seedPhrase.split(' ').length < 12}
              className="btn-primary w-full"
            >
              Import Wallet
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-black relative overflow-hidden">
      {/* Background effects */}
      <div className="absolute inset-0">
        <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-orange-500/10 rounded-full blur-3xl" />
        <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-red-500/10 rounded-full blur-3xl" />
      </div>

      <div className="relative z-10 min-h-screen flex flex-col items-center justify-center p-4">
        {/* Logo */}
        <div className="mb-12 text-center">
          <div className="w-24 h-24 mx-auto mb-6 rounded-3xl bg-gradient-to-br from-orange-500 via-red-500 to-orange-600 flex items-center justify-center shadow-2xl shadow-orange-500/30">
            <Hexagon className="w-12 h-12 text-white" />
          </div>
          <h1 className="text-4xl font-bold text-white mb-2">X3 STAR Wallet</h1>
          <p className="text-gray-400">Multi-VM Crypto Wallet</p>
        </div>

        {/* Connect Options */}
        <div className="w-full max-w-md space-y-4">
          <div className="glass-card p-6">
            <h2 className="text-lg font-semibold text-white mb-4">Connect Wallet</h2>
            
            <div className="space-y-3">
              <button
                onClick={connectEVM}
                className="w-full flex items-center justify-between p-4 rounded-xl bg-[#111111] hover:bg-[#1a1a1a] border border-[#1a1a1a] hover:border-orange-500/30 transition-all group"
              >
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-[#627EEA]/20 flex items-center justify-center">
                    <span className="text-xl">◆</span>
                  </div>
                  <div className="text-left">
                    <div className="font-medium text-white group-hover:text-orange-400 transition-colors">MetaMask / EVM</div>
                    <div className="text-xs text-gray-500">Ethereum, Polygon, BSC</div>
                  </div>
                </div>
                <ChevronRight className="w-5 h-5 text-gray-600 group-hover:text-orange-400 transition-colors" />
              </button>

              <button
                onClick={connectSolana}
                className="w-full flex items-center justify-between p-4 rounded-xl bg-[#111111] hover:bg-[#1a1a1a] border border-[#1a1a1a] hover:border-orange-500/30 transition-all group"
              >
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-[#9945FF]/20 flex items-center justify-center">
                    <span className="text-xl">◎</span>
                  </div>
                  <div className="text-left">
                    <div className="font-medium text-white group-hover:text-orange-400 transition-colors">Phantom / Solana</div>
                    <div className="text-xs text-gray-500">Solana Mainnet</div>
                  </div>
                </div>
                <ChevronRight className="w-5 h-5 text-gray-600 group-hover:text-orange-400 transition-colors" />
              </button>

              <button
                onClick={connectSubstrate}
                className="w-full flex items-center justify-between p-4 rounded-xl bg-[#111111] hover:bg-[#1a1a1a] border border-[#1a1a1a] hover:border-orange-500/30 transition-all group"
              >
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-orange-500/20 flex items-center justify-center">
                    <span className="text-xl">⭐</span>
                  </div>
                  <div className="text-left">
                    <div className="font-medium text-white group-hover:text-orange-400 transition-colors">X3 STAR Native</div>
                    <div className="text-xs text-gray-500">Substrate Network</div>
                  </div>
                </div>
                <ChevronRight className="w-5 h-5 text-gray-600 group-hover:text-orange-400 transition-colors" />
              </button>
            </div>
          </div>

          <div className="flex gap-4">
            <button
              onClick={() => setView('create')}
              className="flex-1 btn-secondary flex items-center justify-center gap-2"
            >
              <Plus className="w-4 h-4" />
              Create New
            </button>
            <button
              onClick={() => setView('import')}
              className="flex-1 btn-secondary flex items-center justify-center gap-2"
            >
              <Download className="w-4 h-4" />
              Import
            </button>
          </div>
        </div>

        {/* Footer */}
        <div className="mt-12 text-center">
          <p className="text-xs text-gray-600">
            By connecting, you agree to our Terms of Service
          </p>
        </div>
      </div>
    </div>
  );
}
