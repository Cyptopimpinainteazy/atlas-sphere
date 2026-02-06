'use client';

import { useState } from 'react';
import { useWalletStore } from '@/stores/walletStore';
import { 
  Zap, 
  ChevronDown,
  AlertCircle,
  Loader2,
  Check,
  ArrowRight,
  Info
} from 'lucide-react';

export function ComitView() {
  const { tokens } = useWalletStore();
  const [evmPayload, setEvmPayload] = useState('');
  const [svmPayload, setSvmPayload] = useState('');
  const [executing, setExecuting] = useState(false);
  const [success, setSuccess] = useState(false);
  const [showInfo, setShowInfo] = useState(false);

  const handleExecuteComit = async () => {
    if (!evmPayload && !svmPayload) return;
    
    setExecuting(true);
    await new Promise((resolve) => setTimeout(resolve, 3000));
    setExecuting(false);
    setSuccess(true);
    
    setTimeout(() => {
      setSuccess(false);
      setEvmPayload('');
      setSvmPayload('');
    }, 3000);
  };

  if (success) {
    return (
      <div className="max-w-2xl">
        <div className="mb-8">
          <h1 className="text-2xl font-bold text-white mb-1">Comit Transaction</h1>
          <p className="text-gray-500">Execute atomic cross-VM transactions</p>
        </div>
        
        <div className="glass-card p-8 text-center">
          <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-emerald-500/20 flex items-center justify-center">
            <Check className="w-8 h-8 text-emerald-400" />
          </div>
          <h3 className="text-xl font-semibold text-white mb-2">Comit Executed!</h3>
          <p className="text-gray-400">
            Your cross-VM transaction has been atomically executed on both EVM and SVM.
          </p>
          <div className="mt-4 p-4 rounded-xl bg-[#0a0a0a] border border-[#1a1a1a]">
            <p className="text-sm text-gray-400">Comit ID</p>
            <p className="font-mono text-orange-400">0x{Array(64).fill(0).map(() => Math.floor(Math.random() * 16).toString(16)).join('')}</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-2xl">
      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <h1 className="text-2xl font-bold text-white">Comit Transaction</h1>
            <span className="badge bg-orange-500/20 text-orange-400 border border-orange-500/30">
              X3 STAR
            </span>
          </div>
          <p className="text-gray-500">Execute atomic cross-VM transactions</p>
        </div>
        <button 
          onClick={() => setShowInfo(!showInfo)}
          className="btn-icon"
        >
          <Info className="w-5 h-5" />
        </button>
      </div>

      {/* Info Panel */}
      {showInfo && (
        <div className="glass-card p-6 mb-6 border-orange-500/30">
          <h3 className="font-semibold text-white mb-3">What is a Comit?</h3>
          <p className="text-gray-400 text-sm mb-4">
            Comit transactions are X3 STAR's unique atomic cross-VM operations that execute 
            simultaneously on both EVM and SVM with guaranteed consistency. If either fails, 
            both are rolled back.
          </p>
          <ul className="space-y-2 text-sm text-gray-400">
            <li className="flex items-center gap-2">
              <Check className="w-4 h-4 text-emerald-400" />
              Atomic execution across VMs
            </li>
            <li className="flex items-center gap-2">
              <Check className="w-4 h-4 text-emerald-400" />
              Deterministic ordering
            </li>
            <li className="flex items-center gap-2">
              <Check className="w-4 h-4 text-emerald-400" />
              Rollback on failure
            </li>
          </ul>
        </div>
      )}

      {/* Comit Bfrontend/uilder */}
      <div className="glass-card p-6">
        <div className="grid md:grid-cols-2 gap-6 mb-6">
          {/* EVM Payload */}
          <div>
            <div className="flex items-center gap-2 mb-3">
              <div className="w-8 h-8 rounded-lg bg-[#627EEA]/20 flex items-center justify-center">
                <span className="text-lg">◆</span>
              </div>
              <div>
                <h3 className="font-medium text-white">EVM Payload</h3>
                <p className="text-xs text-gray-500">Ethereum Virtual Machine</p>
              </div>
            </div>
            <textarea
              value={evmPayload}
              onChange={(e) => setEvmPayload(e.target.value)}
              placeholder="Enter EVM transaction data (hex)..."
              className="input-field h-32 resize-none font-mono text-sm"
            />
            <div className="mt-2 flex gap-2">
              <button 
                onClick={() => setEvmPayload('0x095ea7b300000000000000000000000000000000000000000000000000000000')}
                className="text-xs text-orange-400 hover:text-orange-300"
              >
                Approve Token
              </button>
              <button 
                onClick={() => setEvmPayload('0xa9059cbb00000000000000000000000000000000000000000000000000000000')}
                className="text-xs text-orange-400 hover:text-orange-300"
              >
                Transfer
              </button>
            </div>
          </div>

          {/* SVM Payload */}
          <div>
            <div className="flex items-center gap-2 mb-3">
              <div className="w-8 h-8 rounded-lg bg-[#9945FF]/20 flex items-center justify-center">
                <span className="text-lg">◎</span>
              </div>
              <div>
                <h3 className="font-medium text-white">SVM Payload</h3>
                <p className="text-xs text-gray-500">Solana Virtual Machine</p>
              </div>
            </div>
            <textarea
              value={svmPayload}
              onChange={(e) => setSvmPayload(e.target.value)}
              placeholder="Enter SVM transaction data (base58)..."
              className="input-field h-32 resize-none font-mono text-sm"
            />
            <div className="mt-2 flex gap-2">
              <button 
                onClick={() => setSvmPayload('4vJ9JU1bJJE96FwxYa3VnGhEqHxxXHGnxgPhzqL6MiC9')}
                className="text-xs text-orange-400 hover:text-orange-300"
              >
                Token Transfer
              </button>
              <button 
                onClick={() => setSvmPayload('9WzDXwBbmkg8ZTbNMqUxvQRAyrZzDsGYdLVL9zYtAWWM')}
                className="text-xs text-orange-400 hover:text-orange-300"
              >
                Swap
              </button>
            </div>
          </div>
        </div>

        {/* Visual Flow */}
        <div className="flex items-center justify-center gap-4 py-6 mb-6 border-t border-b border-[#1a1a1a]">
          <div className="text-center">
            <div className="w-12 h-12 mx-auto mb-2 rounded-xl bg-[#627EEA]/20 flex items-center justify-center">
              <span className="text-xl">◆</span>
            </div>
            <span className="text-xs text-gray-400">EVM</span>
          </div>
          <div className="flex items-center">
            <div className="w-8 h-px bg-[#1a1a1a]" />
            <ArrowRight className="w-4 h-4 text-orange-400 mx-1" />
            <div className="w-8 h-px bg-[#1a1a1a]" />
          </div>
          <div className="text-center">
            <div className="w-12 h-12 mx-auto mb-2 rounded-xl bg-gradient-to-br from-orange-500 to-red-500 flex items-center justify-center">
              <Zap className="w-6 h-6 text-white" />
            </div>
            <span className="text-xs text-orange-400">Comit</span>
          </div>
          <div className="flex items-center">
            <div className="w-8 h-px bg-[#1a1a1a]" />
            <ArrowRight className="w-4 h-4 text-orange-400 mx-1" />
            <div className="w-8 h-px bg-[#1a1a1a]" />
          </div>
          <div className="text-center">
            <div className="w-12 h-12 mx-auto mb-2 rounded-xl bg-[#9945FF]/20 flex items-center justify-center">
              <span className="text-xl">◎</span>
            </div>
            <span className="text-xs text-gray-400">SVM</span>
          </div>
        </div>

        {/* Fee Estimate */}
        <div className="p-4 rounded-xl bg-[#111111] border border-[#1a1a1a] mb-6 space-y-2">
          <div className="flex items-center justify-between text-sm">
            <span className="text-gray-400">Base Fee</span>
            <span className="text-white">0.001 STAR</span>
          </div>
          <div className="flex items-center justify-between text-sm">
            <span className="text-gray-400">EVM Gas (est.)</span>
            <span className="text-white">{evmPayload ? '~21,000' : '-'}</span>
          </div>
          <div className="flex items-center justify-between text-sm">
            <span className="text-gray-400">SVM Compute (est.)</span>
            <span className="text-white">{svmPayload ? '~200,000 CU' : '-'}</span>
          </div>
          <div className="pt-2 border-t border-[#1a1a1a] flex items-center justify-between text-sm">
            <span className="text-gray-400">Total Fee</span>
            <span className="text-orange-400 font-medium">~0.025 STAR</span>
          </div>
        </div>

        {/* Warning */}
        {(!evmPayload && !svmPayload) && (
          <div className="flex items-center gap-2 p-3 rounded-xl bg-amber-500/10 border border-amber-500/30 mb-6">
            <AlertCircle className="w-5 h-5 text-amber-400" />
            <span className="text-sm text-amber-400">Add at least one payload to create a Comit</span>
          </div>
        )}

        {/* Execute Button */}
        <button
          onClick={handleExecuteComit}
          disabled={(!evmPayload && !svmPayload) || executing}
          className="btn-primary w-full flex items-center justify-center gap-2"
        >
          {executing ? (
            <>
              <Loader2 className="w-5 h-5 animate-spin" />
              Executing Comit...
            </>
          ) : (
            <>
              <Zap className="w-5 h-5" />
              Execute Comit
            </>
          )}
        </button>
      </div>
    </div>
  );
}
