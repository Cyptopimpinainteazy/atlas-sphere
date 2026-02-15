/**
 * TransactionConfirmModal - Confirmation dialog before sending
 * Features:
 * - Glassmorphism design with frosted glass panels
 * - Shows transaction details clearly
 * - Requires explicit confirmation
 * - Shows fee breakdown
 * - Warning for large amounts
 */
import { useState } from 'react';
import {
  X,
  ArrowUpRight,
  AlertTriangle,
  Shield,
  Check,
  Loader2,
  Copy,
} from 'lucide-react';
import * as api from '../lib/api';

interface TransactionDetails {
  toAddress: string;
  amount: number;
  fee: number;
  comment?: string;
  feePriority?: string;
}

interface TransactionConfirmModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => Promise<void>;
  transaction: TransactionDetails;
  balance: number;
}

export function TransactionConfirmModal({
  isOpen,
  onClose,
  onConfirm,
  transaction,
  balance,
}: TransactionConfirmModalProps) {
  const [confirming, setConfirming] = useState(false);
  const [acknowledged, setAcknowledged] = useState(false);
  const [copied, setCopied] = useState(false);

  if (!isOpen) return null;

  const total = transaction.amount + transaction.fee;
  const remainingBalance = balance - total;
  const isLargeAmount = transaction.amount > balance * 0.5;
  const isAlmostAll = remainingBalance < 1;

  const handleConfirm = async () => {
    if (!acknowledged && (isLargeAmount || isAlmostAll)) {
      return;
    }

    setConfirming(true);
    try {
      await onConfirm();
      onClose();
    } catch (error) {
      console.error('Transaction failed:', error);
    } finally {
      setConfirming(false);
    }
  };

  const copyAddress = async () => {
    await navigator.clipboard.writeText(transaction.toAddress);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const shortenAddress = (addr: string) => {
    if (addr.length <= 20) return addr;
    return `${addr.slice(0, 12)}...${addr.slice(-8)}`;
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Backdrop with heavy blur */}
      <div
        className="absolute inset-0 modal-backdrop"
        onClick={onClose}
      />

      {/* Modal Panel - Glass Effect */}
      <div className="relative modal-panel w-full max-w-md animate-scale-in">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-white/[0.06]">
          <div className="flex items-center gap-4">
            <div className="icon-container-lg icon-danger">
              <ArrowUpRight className="w-6 h-6 text-white" />
            </div>
            <div>
              <h3 className="text-lg font-bold text-white tracking-tight">Confirm Transaction</h3>
              <p className="text-sm text-surface-400">Review before sending</p>
            </div>
          </div>
          <button
            onClick={onClose}
            disabled={confirming}
            className="btn-icon"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 space-y-6">
          {/* Amount - Hero Display */}
          <div className="text-center py-6 glass-subtle rounded-xl">
            <div className="text-4xl font-bold text-white tracking-tight mb-1">
              {api.formatMYNTA(transaction.amount)}
            </div>
            <div className="text-xl text-primary-400 font-semibold">MYNTA</div>
          </div>

          {/* Transaction Details */}
          <div className="summary-panel">
            {/* Recipient */}
            <div className="summary-row">
              <span className="text-surface-400 text-sm">To</span>
              <div className="flex items-center gap-2">
                <code className="text-white font-mono text-xs glass-subtle px-2.5 py-1.5 rounded-lg">
                  {shortenAddress(transaction.toAddress)}
                </code>
                <button
                  onClick={copyAddress}
                  className="btn-icon p-1.5"
                  title="Copy address"
                >
                  {copied ? (
                    <Check className="w-4 h-4 text-accent-400" />
                  ) : (
                    <Copy className="w-4 h-4" />
                  )}
                </button>
              </div>
            </div>

            {/* Amount */}
            <div className="summary-row">
              <span className="text-surface-400 text-sm">Amount</span>
              <span className="text-white font-medium">{api.formatMYNTA(transaction.amount)} MYNTA</span>
            </div>

            {/* Fee */}
            <div className="summary-row">
              <span className="text-surface-400 text-sm">
                Network Fee
                {transaction.feePriority && (
                  <span className="text-surface-500 ml-1.5">({transaction.feePriority})</span>
                )}
              </span>
              <span className="text-surface-300">{transaction.fee.toFixed(8)} MYNTA</span>
            </div>

            {/* Total */}
            <div className="summary-total">
              <div className="flex items-center justify-between">
                <span className="text-surface-200 font-medium">Total</span>
                <span className="text-white font-bold text-lg">{total.toFixed(8)} MYNTA</span>
              </div>
            </div>

            {/* Comment */}
            {transaction.comment && (
              <div className="pt-4 mt-4 border-t border-white/[0.06]">
                <span className="text-surface-400 text-sm">Note: </span>
                <span className="text-surface-200 text-sm">{transaction.comment}</span>
              </div>
            )}
          </div>

          {/* Warnings */}
          {(isLargeAmount || isAlmostAll) && (
            <div className="alert-soft">
              <div className="flex items-start gap-3">
                <div className="alert-soft-icon">
                  <AlertTriangle className="w-5 h-5 text-yellow-400" />
                </div>
                <div className="flex-1">
                  <p className="text-yellow-400 font-semibold text-sm">
                    {isAlmostAll
                      ? 'This will send almost your entire balance'
                      : 'This is a large transaction'}
                  </p>
                  <p className="text-yellow-400/70 text-sm mt-1">
                    Remaining balance: {remainingBalance.toFixed(8)} MYNTA
                  </p>
                </div>
              </div>

              {/* Acknowledgment checkbox */}
              <label className="flex items-center gap-3 mt-4 cursor-pointer group">
                <div className="relative">
                  <input
                    type="checkbox"
                    checked={acknowledged}
                    onChange={(e) => setAcknowledged(e.target.checked)}
                    className="peer sr-only"
                  />
                  <div className="w-5 h-5 rounded-md glass-subtle border-yellow-500/30 peer-checked:bg-yellow-500/20 peer-checked:border-yellow-500/50 transition-all flex items-center justify-center">
                    {acknowledged && <Check className="w-3.5 h-3.5 text-yellow-400" />}
                  </div>
                </div>
                <span className="text-sm text-yellow-400/80 group-hover:text-yellow-400 transition-colors">
                  I understand and want to proceed
                </span>
              </label>
            </div>
          )}

          {/* Security note */}
          <div className="flex items-center gap-2.5 text-xs text-surface-500">
            <Shield className="w-4 h-4" />
            <span>Transactions are irreversible. Please verify all details.</span>
          </div>
        </div>

        {/* Footer */}
        <div className="p-6 pt-0 flex gap-3">
          <button
            onClick={onClose}
            disabled={confirming}
            className="btn-secondary flex-1 py-3.5"
          >
            Cancel
          </button>
          <button
            onClick={handleConfirm}
            disabled={confirming || ((isLargeAmount || isAlmostAll) && !acknowledged)}
            className="btn-danger flex-1 py-3.5 flex items-center justify-center gap-2"
          >
            {confirming ? (
              <>
                <Loader2 className="w-5 h-5 animate-spin" />
                Sending...
              </>
            ) : (
              <>
                <ArrowUpRight className="w-5 h-5" />
                Send Now
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}

export default TransactionConfirmModal;
