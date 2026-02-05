/**
 * MintView - Easy Token Minting Interface
 * 
 * Super simple interface for creating new tokens on Atlas Sphere.
 * Supports both EVM (ERC-20) and SVM (SPL) token standards.
 */

'use client';

import { useState, useCallback } from 'react';
import { useWalletStore } from '@/stores/walletStore';
import { 
  Coins,
  Sparkles,
  ChevronDown,
  AlertCircle,
  Loader2,
  Check,
  Copy,
  ExternalLink,
  Image,
  Zap,
  Info,
  Rocket
} from 'lucide-react';

type VMType = 'evm' | 'svm' | 'dual';

interface TokenConfig {
  name: string;
  symbol: string;
  decimals: number;
  totalSupply: string;
  vm: VMType;
  description: string;
  logoUri: string;
  isMintable: boolean;
  isBurnable: boolean;
  maxSupply: string;
}

interface MintResult {
  success: boolean;
  tokenAddress?: string;
  comitId?: string;
  txHash?: string;
  error?: string;
}

const DEFAULT_CONFIG: TokenConfig = {
  name: '',
  symbol: '',
  decimals: 18,
  totalSupply: '1000000',
  vm: 'evm',
  description: '',
  logoUri: '',
  isMintable: false,
  isBurnable: false,
  maxSupply: '',
};

const DECIMALS_OPTIONS = [
  { value: 18, label: '18 (Standard)', description: 'Most common, like ETH' },
  { value: 9, label: '9 (Solana)', description: 'Standard for SPL tokens' },
  { value: 6, label: '6 (Stablecoins)', description: 'Like USDC, USDT' },
  { value: 8, label: '8 (Bitcoin)', description: 'Like BTC' },
  { value: 0, label: '0 (NFT-like)', description: 'Indivisible tokens' },
];

const VM_OPTIONS = [
  { 
    value: 'evm' as VMType, 
    label: 'EVM (Ethereum)', 
    color: 'from-blue-500 to-blue-600',
    description: 'ERC-20 compatible, works with MetaMask'
  },
  { 
    value: 'svm' as VMType, 
    label: 'SVM (Solana)', 
    color: 'from-purple-500 to-purple-600',
    description: 'SPL token, works with Phantom'
  },
  { 
    value: 'dual' as VMType, 
    label: 'Dual VM ⚡', 
    color: 'from-orange-500 to-red-500',
    description: 'Native on both VMs via Comit'
  },
];

const SUPPLY_PRESETS = [
  { label: '1M', value: '1000000' },
  { label: '10M', value: '10000000' },
  { label: '100M', value: '100000000' },
  { label: '1B', value: '1000000000' },
  { label: '21M', value: '21000000' }, // Bitcoin-like
];

export function MintView() {
  const { accounts, activeAccountIndex, addTransaction } = useWalletStore();
  const activeAccount = accounts[activeAccountIndex];
  
  const [config, setConfig] = useState<TokenConfig>(DEFAULT_CONFIG);
  const [step, setStep] = useState<'config' | 'review' | 'minting' | 'success'>('config');
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [showDecimalsDropdown, setShowDecimalsDropdown] = useState(false);
  const [mintResult, setMintResult] = useState<MintResult | null>(null);
  const [copied, setCopied] = useState(false);

  const updateConfig = (updates: Partial<TokenConfig>) => {
    setConfig(prev => ({ ...prev, ...updates }));
  };

  const isValidConfig = useCallback(() => {
    return (
      config.name.length >= 2 &&
      config.symbol.length >= 2 &&
      config.symbol.length <= 8 &&
      parseFloat(config.totalSupply) > 0
    );
  }, [config]);

  const formatSupply = (supply: string, decimals: number) => {
    const num = parseFloat(supply);
    if (num >= 1e9) return `${(num / 1e9).toFixed(2)}B`;
    if (num >= 1e6) return `${(num / 1e6).toFixed(2)}M`;
    if (num >= 1e3) return `${(num / 1e3).toFixed(2)}K`;
    return num.toLocaleString();
  };

  const estimateFee = () => {
    if (config.vm === 'dual') return '~0.5 X3';
    if (config.vm === 'evm') return '~0.2 X3';
    return '~0.1 X3';
  };

  const handleMint = async () => {
    setStep('minting');
    
    try {
      // Dynamic import SDK
      const sdk = await import('@atlas-sphere/ts-sdk');
      
      // Build token creation payload
      const payload = buildMintPayload(config);
      
      // For demo, simulate the minting process
      await new Promise(resolve => setTimeout(resolve, 3000));
      
      // Generate mock addresses based on VM
      const tokenAddress = config.vm === 'svm' 
        ? generateSolanaAddress()
        : generateEvmAddress();
      
      const result: MintResult = {
        success: true,
        tokenAddress,
        comitId: config.vm === 'dual' ? `0x${generateRandomHex(64)}` : undefined,
        txHash: `0x${generateRandomHex(64)}`,
      };
      
      setMintResult(result);
      setStep('success');
      
      // Add to transaction history
      addTransaction({
        id: `mint-${Date.now()}`,
        type: 'comit',
        status: 'confirmed',
        amount: config.totalSupply,
        symbol: config.symbol,
        from: activeAccount?.address || '',
        to: tokenAddress,
        timestamp: Date.now(),
        hash: result.txHash!,
        network: config.vm === 'dual' ? 'substrate' : config.vm,
        comitId: result.comitId,
      });
      
    } catch (error) {
      setMintResult({
        success: false,
        error: error instanceof Error ? error.message : 'Minting failed',
      });
      setStep('success');
    }
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const resetForm = () => {
    setConfig(DEFAULT_CONFIG);
    setStep('config');
    setMintResult(null);
    setShowAdvanced(false);
  };

  // Configuration Step
  if (step === 'config') {
    return (
      <div className="max-w-2xl">
        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center gap-3 mb-2">
            <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-orange-500 to-red-500 flex items-center justify-center">
              <Coins className="w-6 h-6 text-white" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-white">Create Token</h1>
              <p className="text-gray-500">Launch your own token in minutes</p>
            </div>
          </div>
        </div>

        <div className="space-y-6">
          {/* VM Selection */}
          <div className="glass-card p-6">
            <label className="block text-sm font-medium text-gray-300 mb-3">
              Select Network
            </label>
            <div className="grid grid-cols-3 gap-3">
              {VM_OPTIONS.map((vm) => (
                <button
                  key={vm.value}
                  onClick={() => updateConfig({ 
                    vm: vm.value,
                    decimals: vm.value === 'svm' ? 9 : 18
                  })}
                  className={`relative p-4 rounded-xl border-2 transition-all ${
                    config.vm === vm.value 
                      ? 'border-orange-500 bg-orange-500/10' 
                      : 'border-[#1a1a1a] hover:border-[#333] bg-[#0a0a0a]'
                  }`}
                >
                  <div className={`w-10 h-10 rounded-lg bg-gradient-to-br ${vm.color} flex items-center justify-center mb-3 mx-auto`}>
                    {vm.value === 'dual' ? (
                      <Zap className="w-5 h-5 text-white" />
                    ) : (
                      <div className="w-5 h-5 rounded-full bg-white/20" />
                    )}
                  </div>
                  <div className="text-sm font-medium text-white text-center">{vm.label}</div>
                  <div className="text-xs text-gray-500 text-center mt-1">{vm.description}</div>
                  {config.vm === vm.value && (
                    <div className="absolute top-2 right-2">
                      <Check className="w-4 h-4 text-orange-400" />
                    </div>
                  )}
                </button>
              ))}
            </div>
          </div>

          {/* Basic Info */}
          <div className="glass-card p-6">
            <h3 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
              <Sparkles className="w-5 h-5 text-orange-400" />
              Token Details
            </h3>
            
            <div className="grid grid-cols-2 gap-4">
              {/* Token Name */}
              <div>
                <label className="block text-sm text-gray-400 mb-2">Token Name</label>
                <input
                  type="text"
                  value={config.name}
                  onChange={(e) => updateConfig({ name: e.target.value })}
                  placeholder="e.g., My Awesome Token"
                  className="input-field"
                  maxLength={32}
                />
              </div>

              {/* Symbol */}
              <div>
                <label className="block text-sm text-gray-400 mb-2">Symbol</label>
                <input
                  type="text"
                  value={config.symbol}
                  onChange={(e) => updateConfig({ symbol: e.target.value.toUpperCase() })}
                  placeholder="e.g., MAT"
                  className="input-field uppercase"
                  maxLength={8}
                />
              </div>
            </div>

            {/* Total Supply */}
            <div className="mt-4">
              <label className="block text-sm text-gray-400 mb-2">Total Supply</label>
              <div className="flex gap-2">
                <input
                  type="text"
                  value={config.totalSupply}
                  onChange={(e) => updateConfig({ totalSupply: e.target.value.replace(/[^0-9]/g, '') })}
                  placeholder="1000000"
                  className="input-field flex-1"
                />
              </div>
              <div className="flex gap-2 mt-2">
                {SUPPLY_PRESETS.map((preset) => (
                  <button
                    key={preset.value}
                    onClick={() => updateConfig({ totalSupply: preset.value })}
                    className={`px-3 py-1 rounded-lg text-sm transition-all ${
                      config.totalSupply === preset.value
                        ? 'bg-orange-500/20 text-orange-400 border border-orange-500/30'
                        : 'bg-[#111] text-gray-400 hover:bg-[#1a1a1a] border border-transparent'
                    }`}
                  >
                    {preset.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Decimals */}
            <div className="mt-4 relative">
              <label className="block text-sm text-gray-400 mb-2">Decimals</label>
              <button
                onClick={() => setShowDecimalsDropdown(!showDecimalsDropdown)}
                className="w-full flex items-center justify-between p-4 rounded-xl bg-[#0a0a0a] border border-[#1a1a1a] hover:border-orange-500/30 transition-all"
              >
                <div>
                  <span className="text-white font-medium">{config.decimals}</span>
                  <span className="text-gray-500 ml-2">
                    {DECIMALS_OPTIONS.find(d => d.value === config.decimals)?.description}
                  </span>
                </div>
                <ChevronDown className={`w-5 h-5 text-gray-400 transition-transform ${showDecimalsDropdown ? 'rotate-180' : ''}`} />
              </button>
              
              {showDecimalsDropdown && (
                <div className="absolute z-10 w-full mt-2 rounded-xl bg-[#0a0a0a] border border-[#1a1a1a] shadow-2xl overflow-hidden">
                  {DECIMALS_OPTIONS.map((option) => (
                    <button
                      key={option.value}
                      onClick={() => {
                        updateConfig({ decimals: option.value });
                        setShowDecimalsDropdown(false);
                      }}
                      className={`w-full flex items-center justify-between p-4 hover:bg-[#111111] transition-colors ${
                        config.decimals === option.value ? 'bg-orange-500/10' : ''
                      }`}
                    >
                      <div>
                        <span className="text-white font-medium">{option.label}</span>
                        <span className="text-gray-500 ml-2 text-sm">{option.description}</span>
                      </div>
                      {config.decimals === option.value && (
                        <Check className="w-4 h-4 text-orange-400" />
                      )}
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Advanced Options */}
          <div className="glass-card overflow-hidden">
            <button
              onClick={() => setShowAdvanced(!showAdvanced)}
              className="w-full p-4 flex items-center justify-between hover:bg-[#0a0a0a] transition-colors"
            >
              <span className="text-sm font-medium text-gray-300">Advanced Options</span>
              <ChevronDown className={`w-5 h-5 text-gray-400 transition-transform ${showAdvanced ? 'rotate-180' : ''}`} />
            </button>
            
            {showAdvanced && (
              <div className="p-6 pt-0 space-y-4 border-t border-[#1a1a1a]">
                {/* Description */}
                <div>
                  <label className="block text-sm text-gray-400 mb-2">Description (optional)</label>
                  <textarea
                    value={config.description}
                    onChange={(e) => updateConfig({ description: e.target.value })}
                    placeholder="Describe your token..."
                    className="input-field min-h-[80px] resize-none"
                    maxLength={200}
                  />
                </div>

                {/* Logo URI */}
                <div>
                  <label className="block text-sm text-gray-400 mb-2">Logo URL (optional)</label>
                  <div className="flex gap-2">
                    <div className="w-12 h-12 rounded-xl bg-[#111] border border-[#1a1a1a] flex items-center justify-center flex-shrink-0">
                      {config.logoUri ? (
                        <img src={config.logoUri} alt="" className="w-8 h-8 rounded-lg object-cover" />
                      ) : (
                        <Image className="w-5 h-5 text-gray-500" />
                      )}
                    </div>
                    <input
                      type="url"
                      value={config.logoUri}
                      onChange={(e) => updateConfig({ logoUri: e.target.value })}
                      placeholder="https://example.com/logo.png"
                      className="input-field flex-1"
                    />
                  </div>
                </div>

                {/* Toggles */}
                <div className="flex gap-4">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={config.isMintable}
                      onChange={(e) => updateConfig({ isMintable: e.target.checked })}
                      className="w-4 h-4 rounded border-gray-600 bg-[#0a0a0a] text-orange-500 focus:ring-orange-500"
                    />
                    <span className="text-sm text-gray-300">Mintable</span>
                    <Info className="w-3 h-3 text-gray-500" />
                  </label>
                  
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={config.isBurnable}
                      onChange={(e) => updateConfig({ isBurnable: e.target.checked })}
                      className="w-4 h-4 rounded border-gray-600 bg-[#0a0a0a] text-orange-500 focus:ring-orange-500"
                    />
                    <span className="text-sm text-gray-300">Burnable</span>
                    <Info className="w-3 h-3 text-gray-500" />
                  </label>
                </div>

                {/* Max Supply */}
                {config.isMintable && (
                  <div>
                    <label className="block text-sm text-gray-400 mb-2">Max Supply (optional)</label>
                    <input
                      type="text"
                      value={config.maxSupply}
                      onChange={(e) => updateConfig({ maxSupply: e.target.value.replace(/[^0-9]/g, '') })}
                      placeholder="Leave empty for unlimited"
                      className="input-field"
                    />
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Preview & Continue */}
          <div className="glass-card p-6">
            <div className="flex items-center justify-between mb-4">
              <span className="text-gray-400">Estimated Fee</span>
              <span className="text-white font-medium">{estimateFee()}</span>
            </div>
            
            {config.name && config.symbol && (
              <div className="p-4 rounded-xl bg-gradient-to-r from-orange-500/10 to-red-500/10 border border-orange-500/20 mb-4">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-gradient-to-br from-orange-500 to-red-500 flex items-center justify-center text-white font-bold">
                    {config.symbol.slice(0, 2)}
                  </div>
                  <div>
                    <div className="font-medium text-white">{config.name}</div>
                    <div className="text-sm text-gray-400">
                      {formatSupply(config.totalSupply, config.decimals)} {config.symbol}
                    </div>
                  </div>
                </div>
              </div>
            )}

            <button
              onClick={() => setStep('review')}
              disabled={!isValidConfig()}
              className="btn-primary w-full flex items-center justify-center gap-2"
            >
              <Rocket className="w-5 h-5" />
              Continue to Review
            </button>
          </div>
        </div>
      </div>
    );
  }

  // Review Step
  if (step === 'review') {
    return (
      <div className="max-w-lg">
        <div className="mb-8">
          <h1 className="text-2xl font-bold text-white mb-1">Review Token</h1>
          <p className="text-gray-500">Confirm your token details before minting</p>
        </div>

        <div className="glass-card p-6 space-y-4">
          {/* Token Preview */}
          <div className="text-center p-6 rounded-xl bg-gradient-to-r from-orange-500/10 to-red-500/10 border border-orange-500/20">
            <div className="w-16 h-16 mx-auto rounded-full bg-gradient-to-br from-orange-500 to-red-500 flex items-center justify-center text-2xl font-bold text-white mb-4">
              {config.symbol.slice(0, 2)}
            </div>
            <h3 className="text-xl font-bold text-white">{config.name}</h3>
            <p className="text-orange-400 font-medium">${config.symbol}</p>
          </div>

          {/* Details */}
          <div className="space-y-3">
            <div className="flex justify-between py-2 border-b border-[#1a1a1a]">
              <span className="text-gray-400">Network</span>
              <span className="text-white font-medium">
                {VM_OPTIONS.find(v => v.value === config.vm)?.label}
              </span>
            </div>
            <div className="flex justify-between py-2 border-b border-[#1a1a1a]">
              <span className="text-gray-400">Total Supply</span>
              <span className="text-white font-medium">
                {formatSupply(config.totalSupply, config.decimals)} {config.symbol}
              </span>
            </div>
            <div className="flex justify-between py-2 border-b border-[#1a1a1a]">
              <span className="text-gray-400">Decimals</span>
              <span className="text-white font-medium">{config.decimals}</span>
            </div>
            <div className="flex justify-between py-2 border-b border-[#1a1a1a]">
              <span className="text-gray-400">Mintable</span>
              <span className={config.isMintable ? 'text-emerald-400' : 'text-gray-500'}>
                {config.isMintable ? 'Yes' : 'No'}
              </span>
            </div>
            <div className="flex justify-between py-2 border-b border-[#1a1a1a]">
              <span className="text-gray-400">Burnable</span>
              <span className={config.isBurnable ? 'text-emerald-400' : 'text-gray-500'}>
                {config.isBurnable ? 'Yes' : 'No'}
              </span>
            </div>
            <div className="flex justify-between py-2">
              <span className="text-gray-400">Estimated Fee</span>
              <span className="text-white font-medium">{estimateFee()}</span>
            </div>
          </div>

          {/* Warning */}
          <div className="flex items-start gap-3 p-4 rounded-xl bg-amber-500/10 border border-amber-500/30">
            <AlertCircle className="w-5 h-5 text-amber-400 flex-shrink-0 mt-0.5" />
            <div className="text-sm text-amber-200">
              <p className="font-medium mb-1">Please verify all details</p>
              <p className="text-amber-400/80">Token parameters cannot be changed after creation.</p>
            </div>
          </div>

          {/* Actions */}
          <div className="flex gap-3 pt-2">
            <button
              onClick={() => setStep('config')}
              className="flex-1 py-3 px-4 rounded-xl border border-[#333] text-gray-300 hover:bg-[#111] transition-colors"
            >
              Back
            </button>
            <button
              onClick={handleMint}
              className="flex-1 btn-primary flex items-center justify-center gap-2"
            >
              <Coins className="w-5 h-5" />
              Create Token
            </button>
          </div>
        </div>
      </div>
    );
  }

  // Minting Step
  if (step === 'minting') {
    return (
      <div className="max-w-lg">
        <div className="glass-card p-8 text-center">
          <div className="w-20 h-20 mx-auto mb-6 rounded-full bg-gradient-to-br from-orange-500/20 to-red-500/20 flex items-center justify-center">
            <Loader2 className="w-10 h-10 text-orange-400 animate-spin" />
          </div>
          <h2 className="text-2xl font-bold text-white mb-2">Creating Your Token</h2>
          <p className="text-gray-400 mb-6">
            {config.vm === 'dual' 
              ? 'Submitting Comit transaction to both VMs...'
              : `Deploying ${config.symbol} to ${config.vm.toUpperCase()}...`
            }
          </p>
          
          <div className="space-y-3">
            <div className="flex items-center gap-3 p-3 rounded-xl bg-[#0a0a0a]">
              <Check className="w-5 h-5 text-emerald-400" />
              <span className="text-gray-300">Configuration validated</span>
            </div>
            <div className="flex items-center gap-3 p-3 rounded-xl bg-[#0a0a0a]">
              <Loader2 className="w-5 h-5 text-orange-400 animate-spin" />
              <span className="text-gray-300">Deploying contract...</span>
            </div>
            <div className="flex items-center gap-3 p-3 rounded-xl bg-[#0a0a0a] opacity-50">
              <div className="w-5 h-5 rounded-full border-2 border-gray-600" />
              <span className="text-gray-500">Waiting for confirmation</span>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Success Step
  if (step === 'success' && mintResult) {
    return (
      <div className="max-w-lg">
        <div className="glass-card p-8 text-center">
          {mintResult.success ? (
            <>
              <div className="w-20 h-20 mx-auto mb-6 rounded-full bg-emerald-500/20 flex items-center justify-center">
                <Check className="w-10 h-10 text-emerald-400" />
              </div>
              <h2 className="text-2xl font-bold text-white mb-2">Token Created! 🎉</h2>
              <p className="text-gray-400 mb-6">
                Your {config.symbol} token is now live on Atlas Sphere
              </p>

              {/* Token Address */}
              <div className="p-4 rounded-xl bg-[#0a0a0a] border border-[#1a1a1a] mb-4">
                <div className="text-sm text-gray-400 mb-2">Token Address</div>
                <div className="flex items-center justify-center gap-2">
                  <code className="text-orange-400 text-sm font-mono break-all">
                    {mintResult.tokenAddress}
                  </code>
                  <button
                    onClick={() => copyToClipboard(mintResult.tokenAddress!)}
                    className="p-1.5 rounded-lg hover:bg-[#1a1a1a] transition-colors"
                  >
                    {copied ? (
                      <Check className="w-4 h-4 text-emerald-400" />
                    ) : (
                      <Copy className="w-4 h-4 text-gray-400" />
                    )}
                  </button>
                </div>
              </div>

              {/* Transaction Info */}
              <div className="space-y-2 mb-6">
                {mintResult.comitId && (
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-400">Comit ID</span>
                    <span className="text-gray-300 font-mono">
                      {mintResult.comitId.slice(0, 10)}...
                    </span>
                  </div>
                )}
                <div className="flex justify-between text-sm">
                  <span className="text-gray-400">Transaction</span>
                  <a 
                    href="#" 
                    className="text-orange-400 hover:text-orange-300 flex items-center gap-1"
                  >
                    View on Explorer
                    <ExternalLink className="w-3 h-3" />
                  </a>
                </div>
              </div>

              {/* Quick Actions */}
              <div className="grid grid-cols-2 gap-3">
                <button
                  onClick={resetForm}
                  className="py-3 px-4 rounded-xl border border-[#333] text-gray-300 hover:bg-[#111] transition-colors"
                >
                  Create Another
                </button>
                <button
                  onClick={() => {
                    // TODO: Add to wallet tokens
                    resetForm();
                  }}
                  className="btn-primary"
                >
                  Add to Wallet
                </button>
              </div>
            </>
          ) : (
            <>
              <div className="w-20 h-20 mx-auto mb-6 rounded-full bg-red-500/20 flex items-center justify-center">
                <AlertCircle className="w-10 h-10 text-red-400" />
              </div>
              <h2 className="text-2xl font-bold text-white mb-2">Minting Failed</h2>
              <p className="text-gray-400 mb-6">{mintResult.error}</p>
              
              <button
                onClick={() => setStep('review')}
                className="btn-primary"
              >
                Try Again
              </button>
            </>
          )}
        </div>
      </div>
    );
  }

  return null;
}

// Helper functions
function buildMintPayload(config: TokenConfig): Uint8Array {
  // Encode token creation parameters
  const encoder = new TextEncoder();
  const nameBytes = encoder.encode(config.name);
  const symbolBytes = encoder.encode(config.symbol);
  
  // Simple encoding for demo
  const payload = new Uint8Array(256);
  payload[0] = 0x01; // CREATE_TOKEN instruction
  payload[1] = config.decimals;
  payload.set(nameBytes, 2);
  payload.set(symbolBytes, 34);
  
  return payload;
}

function generateEvmAddress(): string {
  return '0x' + generateRandomHex(40);
}

function generateSolanaAddress(): string {
  const chars = '123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz';
  let result = '';
  for (let i = 0; i < 44; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
}

function generateRandomHex(length: number): string {
  const chars = '0123456789abcdef';
  let result = '';
  for (let i = 0; i < length; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
}
