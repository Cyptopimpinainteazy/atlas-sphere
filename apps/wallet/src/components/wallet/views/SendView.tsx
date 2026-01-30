'use client';

import { useState } from 'react';
import { useWalletStore, Token } from '@/stores/walletStore';
import { 
  Send as SendIcon, 
  ChevronDown, 
  AlertCircle,
  Loader2,
  Check
} from 'lucide-react';

export function SendView() {
  const { tokens, accounts, activeAccountIndex } = useWalletStore();
  const [selectedToken, setSelectedToken] = useState(tokens[0]);
  const [recipient, setRecipient] = useState('');
  const [amount, setAmount] = useState('');
  const [showTokenDropdown, setShowTokenDropdown] = useState(false);
  const [sending, setSending] = useState(false);
  const [success, setSuccess] = useState(false);

  const handleSend = async () => {
    if (!recipient || !amount) return;
    
    setSending(true);
    // Simulate transaction
    await new Promise((resolve) => setTimeout(resolve, 2000));
    setSending(false);
    setSuccess(true);
    
    setTimeout(() => {
      setSuccess(false);
      setRecipient('');
      setAmount('');
    }, 3000);
  };

  return (
    <div className="max-w-lg">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-white mb-1">Send</h1>
        <p className="text-gray-500">Transfer tokens to another address</p>
      </div>

      {success ? (
        <div className="glass-card p-8 text-center">
          <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-emerald-500/20 flex items-center justify-center">
            <Check className="w-8 h-8 text-emerald-400" />
          </div>
          <h3 className="text-xl font-semibold text-white mb-2">Transaction Sent!</h3>
          <p className="text-gray-400">Your transaction has been submitted to the network.</p>
        </div>
      ) : (
        <div className="glass-card p-6">
          {/* Token Selection */}
          <div className="mb-6">
            <label className="block text-sm text-gray-400 mb-2">Asset</label>
            <div className="relative">
              <button
                onClick={() => setShowTokenDropdown(!showTokenDropdown)}
                className="w-full flex items-center justify-between p-4 rounded-xl bg-[#0a0a0a] border border-[#1a1a1a] hover:border-orange-500/30 transition-all"
              >
                <div className="flex items-center gap-3">
                  <div className={`w-8 h-8 rounded-lg flex items-center justify-center text-lg ${
                    selectedToken?.network === 'evm' ? 'bg-[#627EEA]/20' :
                    selectedToken?.network === 'svm' ? 'bg-[#9945FF]/20' :
                    'bg-orange-500/20'
                  }`}>
                    {selectedToken?.icon}
                  </div>
                  <div className="text-left">
                    <div className="font-medium text-white">{selectedToken?.symbol}</div>
                    <div className="text-xs text-gray-500">Balance: {selectedToken?.balance}</div>
                  </div>
                </div>
                <ChevronDown className="w-5 h-5 text-gray-400" />
              </button>

              {showTokenDropdown && (
                <div className="absolute z-10 w-full mt-2 rounded-xl bg-[#0a0a0a] border border-[#1a1a1a] shadow-2xl overflow-hidden">
                  {tokens.map((token: Token, index: number) => (
                    <button
                      key={index}
                      onClick={() => {
                        setSelectedToken(token);
                        setShowTokenDropdown(false);
                      }}
                      className="w-full flex items-center gap-3 p-4 hover:bg-[#111111] transition-colors"
                    >
                      <div className={`w-8 h-8 rounded-lg flex items-center justify-center text-lg ${
                        token.network === 'evm' ? 'bg-[#627EEA]/20' :
                        token.network === 'svm' ? 'bg-[#9945FF]/20' :
                        'bg-orange-500/20'
                      }`}>
                        {token.icon}
                      </div>
                      <div className="text-left">
                        <div className="font-medium text-white">{token.symbol}</div>
                        <div className="text-xs text-gray-500">{token.balance}</div>
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Recipient */}
          <div className="mb-6">
            <label className="block text-sm text-gray-400 mb-2">Recipient Address</label>
            <input
              type="text"
              value={recipient}
              onChange={(e) => setRecipient(e.target.value)}
              placeholder="Enter address or ENS name"
              className="input-field"
            />
          </div>

          {/* Amount */}
          <div className="mb-6">
            <label className="block text-sm text-gray-400 mb-2">Amount</label>
            <div className="relative">
              <input
                type="text"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                placeholder="0.00"
                className="input-field pr-20"
              />
              <button 
                onClick={() => setAmount(selectedToken?.balance.replace(',', '') || '0')}
                className="absolute right-3 top-1/2 -translate-y-1/2 px-3 py-1 rounded-lg bg-orange-500/20 text-orange-400 text-sm hover:bg-orange-500/30 transition-colors"
              >
                MAX
              </button>
            </div>
            {selectedToken && (
              <p className="mt-2 text-sm text-gray-500">
                ≈ ${(parseFloat(amount || '0') * parseFloat(selectedToken.value.replace(/[$,]/g, '')) / parseFloat(selectedToken.balance.replace(',', ''))).toFixed(2)}
              </p>
            )}
          </div>

          {/* Network Fee */}
          <div className="p-4 rounded-xl bg-[#111111] border border-[#1a1a1a] mb-6">
            <div className="flex items-center justify-between">
              <span className="text-sm text-gray-400">Network Fee</span>
              <span className="text-sm text-white">~$0.50</span>
            </div>
          </div>

          {/* Warning */}
          {recipient && !recipient.match(/^(0x[a-fA-F0-9]{40}|[1-9A-HJ-NP-Za-km-z]{32,44})$/) && (
            <div className="flex items-center gap-2 p-3 rounded-xl bg-amber-500/10 border border-amber-500/30 mb-6">
              <AlertCircle className="w-5 h-5 text-amber-400" />
              <span className="text-sm text-amber-400">Please enter a valid address</span>
            </div>
          )}

          {/* Send Button */}
          <button
            onClick={handleSend}
            disabled={!recipient || !amount || sending}
            className="btn-primary w-full flex items-center justify-center gap-2"
          >
            {sending ? (
              <>
                <Loader2 className="w-5 h-5 animate-spin" />
                Sending...
              </>
            ) : (
              <>
                <SendIcon className="w-5 h-5" />
                Send {selectedToken?.symbol}
              </>
            )}
          </button>
        </div>
      )}
    </div>
  );
}
