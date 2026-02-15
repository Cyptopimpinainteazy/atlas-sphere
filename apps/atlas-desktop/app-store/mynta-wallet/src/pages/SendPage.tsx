import React, { useState, useCallback } from "react";
import { useWallet } from "../context/WalletContext";
import * as api from "../lib/api";
import {
  ArrowUpRight,
  AlertCircle,
  CheckCircle,
  Loader2,
  QrCode,
  Wallet,
  Copy,
  Check,
} from "lucide-react";
import FeeSelector, { FeePriority } from "../components/FeeSelector";
import TransactionConfirmModal from "../components/TransactionConfirmModal";

export default function SendPage() {
  const wallet = useWallet();
  const [form, setForm] = useState({
    address: "",
    amount: "",
    comment: "",
  });
  const [sending, setSending] = useState(false);
  const [result, setResult] = useState<{ success: boolean; txid?: string; error?: string } | null>(null);
  const [addressValid, setAddressValid] = useState<boolean | null>(null);
  const [copied, setCopied] = useState(false);
  
  // Fee selection state
  const [feeRate, setFeeRate] = useState(0.0001);
  const [feePriority, setFeePriority] = useState<FeePriority>('normal');
  
  // Confirmation modal state
  const [showConfirmModal, setShowConfirmModal] = useState(false);

  // Handle fee changes from FeeSelector
  const handleFeeChange = useCallback((rate: number, priority: FeePriority) => {
    setFeeRate(rate);
    setFeePriority(priority);
  }, []);

  const handleAddressChange = async (address: string) => {
    setForm({ ...form, address });
    setAddressValid(null);

    if (address.length >= 26) {
      try {
        const info = await api.validateAddress(address);
        setAddressValid(info.isvalid);
      } catch {
        setAddressValid(false);
      }
    }
  };

  // Show confirmation modal instead of direct send
  const handleSendClick = (e: React.FormEvent) => {
    e.preventDefault();
    setResult(null);

    const amount = parseFloat(form.amount);
    if (isNaN(amount) || amount <= 0) {
      setResult({ success: false, error: "Invalid amount" });
      return;
    }

    if (amount > wallet.balance) {
      setResult({ success: false, error: "Insufficient balance" });
      return;
    }

    // Show confirmation modal
    setShowConfirmModal(true);
  };

  // Actually send the transaction after confirmation
  const handleConfirmedSend = async () => {
    setSending(true);
    setResult(null);

    try {
      const amount = parseFloat(form.amount);
      
      const txid = await api.sendToAddress(
        form.address,
        amount,
        form.comment || undefined
      );

      setResult({ success: true, txid });
      setForm({ address: "", amount: "", comment: "" });
      wallet.refresh();
    } catch (err: any) {
      setResult({ success: false, error: err.message || "Transaction failed" });
    } finally {
      setSending(false);
      setShowConfirmModal(false);
    }
  };

  const setMaxAmount = () => {
    // Leave amount for estimated fee
    const max = Math.max(0, wallet.balance - feeRate);
    setForm({ ...form, amount: max.toFixed(8) });
  };

  const copyTxid = async () => {
    if (result?.txid) {
      await navigator.clipboard.writeText(result.txid);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  // Calculate total
  const amount = parseFloat(form.amount) || 0;
  const total = amount + feeRate;

  return (
    <div className="max-w-2xl mx-auto">
      <div className="card">
        {/* Header */}
        <div className="flex items-center gap-4 mb-8">
          <div className="icon-container-lg icon-danger">
            <ArrowUpRight className="w-6 h-6 text-white" />
          </div>
          <div>
            <h2 className="text-2xl font-bold text-white tracking-tight">Send Mynta</h2>
            <p className="text-surface-400">Transfer MYNTA to another address</p>
          </div>
        </div>

        {/* Balance Display */}
        <div className="mb-8 glass-subtle p-5 rounded-xl flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="icon-container">
              <Wallet className="w-5 h-5 text-primary-400" />
            </div>
            <span className="text-surface-300 font-medium">Available Balance</span>
          </div>
          <span className="text-xl font-bold text-white">
            {api.formatMYNTA(wallet.balance)} <span className="text-primary-400">MYNTA</span>
          </span>
        </div>

        {/* Form */}
        <form onSubmit={handleSendClick} className="space-y-6">
          {/* Recipient Address */}
          <div>
            <label className="label">Recipient Address</label>
            <div className="relative">
              <input
                type="text"
                value={form.address}
                onChange={(e) => handleAddressChange(e.target.value)}
                className={`input pr-24 font-mono ${
                  addressValid === true ? "input-success" : ""
                } ${addressValid === false ? "input-error" : ""}`}
                placeholder="Mynta address (starts with A)"
                required
              />
              <div className="absolute right-3 top-1/2 -translate-y-1/2 flex items-center gap-2">
                {addressValid === true && (
                  <CheckCircle className="w-5 h-5 text-accent-400" />
                )}
                {addressValid === false && (
                  <AlertCircle className="w-5 h-5 text-red-400" />
                )}
                <button
                  type="button"
                  className="btn-icon p-1.5"
                  title="Scan QR Code"
                >
                  <QrCode className="w-5 h-5" />
                </button>
              </div>
            </div>
            {addressValid === false && (
              <p className="text-red-400 text-sm mt-2 flex items-center gap-1.5">
                <AlertCircle className="w-4 h-4" />
                Invalid address format
              </p>
            )}
          </div>

          {/* Amount */}
          <div>
            <label className="label">Amount</label>
            <div className="relative">
              <input
                type="number"
                step="0.00000001"
                min="0"
                value={form.amount}
                onChange={(e) => setForm({ ...form, amount: e.target.value })}
                className="input-lg pr-28"
                placeholder="0.00000000"
                required
              />
              <div className="absolute right-3 top-1/2 -translate-y-1/2 flex items-center gap-3">
                <span className="text-surface-400 font-medium">MYNTA</span>
                <button
                  type="button"
                  onClick={setMaxAmount}
                  className="px-3 py-1.5 text-xs font-semibold text-primary-400 hover:text-primary-300 glass-subtle border-primary-500/30 rounded-lg transition-all hover:border-primary-500/50"
                >
                  MAX
                </button>
              </div>
            </div>
          </div>

          {/* Comment (optional) */}
          <div>
            <label className="label">Comment (optional)</label>
            <input
              type="text"
              value={form.comment}
              onChange={(e) => setForm({ ...form, comment: e.target.value })}
              className="input"
              placeholder="Add a note for this transaction"
            />
          </div>

          {/* Fee Selector */}
          <div className="pt-2">
            <FeeSelector
              onFeeChange={handleFeeChange}
              selectedPriority={feePriority}
              disabled={sending}
            />
          </div>

          {/* Transaction Summary */}
          <div className="summary-panel">
            <div className="summary-row">
              <span className="text-surface-400 text-sm">Amount</span>
              <span className="text-white font-medium">{amount.toFixed(8)} MYNTA</span>
            </div>
            <div className="summary-row">
              <span className="text-surface-400 text-sm">Fee ({feePriority})</span>
              <span className="text-surface-300">~{feeRate.toFixed(6)} MYNTA</span>
            </div>
            <div className="summary-total">
              <div className="flex items-center justify-between">
                <span className="text-surface-200 font-medium">Total</span>
                <span className="text-white font-bold text-lg">{total.toFixed(8)} MYNTA</span>
              </div>
            </div>
          </div>

          {/* Result Messages */}
          {result && (
            <div
              className={`p-5 rounded-xl flex items-start gap-4 animate-fade-in ${
                result.success
                  ? "glass-subtle border-accent-500/30"
                  : "glass-subtle border-red-500/30"
              }`}
            >
              {result.success ? (
                <>
                  <div className="icon-container icon-accent flex-shrink-0">
                    <CheckCircle className="w-5 h-5 text-white" />
                  </div>
                  <div className="flex-1">
                    <p className="text-accent-400 font-semibold">Transaction Sent!</p>
                    <div className="flex items-center gap-2 mt-3">
                      <code className="text-xs text-surface-300 font-mono glass-subtle px-3 py-2 rounded-lg">
                        {api.shortenTxid(result.txid!)}
                      </code>
                      <button
                        type="button"
                        onClick={copyTxid}
                        className="btn-icon p-2"
                      >
                        {copied ? (
                          <Check className="w-4 h-4 text-accent-400" />
                        ) : (
                          <Copy className="w-4 h-4" />
                        )}
                      </button>
                    </div>
                  </div>
                </>
              ) : (
                <>
                  <div className="icon-container icon-danger flex-shrink-0">
                    <AlertCircle className="w-5 h-5 text-white" />
                  </div>
                  <div>
                    <p className="text-red-400 font-semibold">Transaction Failed</p>
                    <p className="text-red-400/80 text-sm mt-1">{result.error}</p>
                  </div>
                </>
              )}
            </div>
          )}

          {/* Submit Button */}
          <button
            type="submit"
            disabled={sending || !form.address || !form.amount || addressValid === false}
            className="btn-primary w-full py-4 text-lg"
          >
            {sending ? (
              <span className="flex items-center justify-center gap-3">
                <Loader2 className="w-5 h-5 animate-spin" />
                Sending...
              </span>
            ) : (
              <span className="flex items-center justify-center gap-3">
                <ArrowUpRight className="w-5 h-5" />
                Review & Send
              </span>
            )}
          </button>
        </form>
      </div>

      {/* Transaction Confirmation Modal */}
      <TransactionConfirmModal
        isOpen={showConfirmModal}
        onClose={() => setShowConfirmModal(false)}
        onConfirm={handleConfirmedSend}
        transaction={{
          toAddress: form.address,
          amount: amount,
          fee: feeRate,
          comment: form.comment,
          feePriority: feePriority,
        }}
        balance={wallet.balance}
      />
    </div>
  );
}
