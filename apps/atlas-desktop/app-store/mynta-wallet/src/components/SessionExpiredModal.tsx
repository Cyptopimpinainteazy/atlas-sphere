/**
 * SessionExpiredModal - Shows when wallet is auto-locked due to inactivity
 * 
 * Features:
 * - Clear explanation of what happened
 * - Quick unlock option
 * - Session timeout info
 */
import { useState } from 'react';
import { Lock, Clock, AlertCircle, Eye, EyeOff, Loader2 } from 'lucide-react';
import * as api from '../lib/api';

interface SessionExpiredModalProps {
  isOpen: boolean;
  onUnlock: () => void;
  onClose?: () => void;
  timeoutMinutes: number;
}

export function SessionExpiredModal({
  isOpen,
  onUnlock,
  onClose,
  timeoutMinutes,
}: SessionExpiredModalProps) {
  const [passphrase, setPassphrase] = useState('');
  const [showPassphrase, setShowPassphrase] = useState(false);
  const [unlocking, setUnlocking] = useState(false);
  const [error, setError] = useState('');

  if (!isOpen) return null;

  const handleUnlock = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!passphrase) {
      setError('Please enter your passphrase');
      return;
    }

    setUnlocking(true);
    setError('');

    try {
      // Unlock for 5 minutes by default
      await api.walletUnlock(passphrase, 300);
      setPassphrase('');
      onUnlock();
    } catch (err: any) {
      setError(err.message || 'Failed to unlock wallet');
    } finally {
      setUnlocking(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Backdrop */}
      <div 
        className="absolute inset-0 bg-black/80 backdrop-blur-sm"
        onClick={onClose}
      />

      {/* Modal */}
      <div className="relative w-full max-w-md glass-card p-8 animate-scale-in">
        {/* Icon */}
        <div className="w-16 h-16 rounded-full bg-yellow-500/20 flex items-center justify-center mx-auto mb-6">
          <Lock className="w-8 h-8 text-yellow-400" />
        </div>

        {/* Title */}
        <h2 className="text-2xl font-bold text-white text-center mb-2">
          Session Expired
        </h2>
        
        <p className="text-surface-400 text-center mb-6">
          Your wallet was locked after {timeoutMinutes} minutes of inactivity
        </p>

        {/* Unlock Form */}
        <form onSubmit={handleUnlock} className="space-y-4">
          <div>
            <label className="label">Wallet Passphrase</label>
            <div className="relative">
              <input
                type={showPassphrase ? 'text' : 'password'}
                value={passphrase}
                onChange={(e) => setPassphrase(e.target.value)}
                className="input pr-12"
                placeholder="Enter your passphrase"
                autoFocus
              />
              <button
                type="button"
                onClick={() => setShowPassphrase(!showPassphrase)}
                className="absolute right-3 top-1/2 -translate-y-1/2 p-1 hover:bg-surface-700 rounded"
              >
                {showPassphrase ? (
                  <EyeOff className="w-5 h-5 text-surface-400" />
                ) : (
                  <Eye className="w-5 h-5 text-surface-400" />
                )}
              </button>
            </div>
          </div>

          {error && (
            <div className="p-3 bg-red-500/10 border border-red-500/50 rounded-lg">
              <p className="text-red-400 text-sm flex items-center gap-2">
                <AlertCircle className="w-4 h-4" />
                {error}
              </p>
            </div>
          )}

          <button
            type="submit"
            disabled={unlocking || !passphrase}
            className="btn-primary w-full py-3 flex items-center justify-center gap-2"
          >
            {unlocking ? (
              <>
                <Loader2 className="w-5 h-5 animate-spin" />
                Unlocking...
              </>
            ) : (
              <>
                <Lock className="w-5 h-5" />
                Unlock Wallet
              </>
            )}
          </button>
        </form>

        {/* Info */}
        <div className="mt-6 p-3 bg-surface-800/50 rounded-lg">
          <p className="text-xs text-surface-500 flex items-center gap-2">
            <Clock className="w-4 h-4" />
            You can adjust the auto-lock timeout in Settings
          </p>
        </div>
      </div>
    </div>
  );
}

/**
 * SessionWarningBanner - Shows warning before session expires
 */
interface SessionWarningBannerProps {
  secondsRemaining: number;
  onExtend: () => void;
  onDismiss?: () => void;
}

export function SessionWarningBanner({
  secondsRemaining,
  onExtend,
  onDismiss,
}: SessionWarningBannerProps) {
  return (
    <div className="fixed bottom-4 right-4 z-40 animate-slide-up">
      <div className="bg-yellow-500/90 backdrop-blur-sm rounded-xl p-4 shadow-xl max-w-sm">
        <div className="flex items-start gap-3">
          <Clock className="w-5 h-5 text-yellow-900 flex-shrink-0 mt-0.5" />
          <div className="flex-1">
            <p className="text-yellow-900 font-medium text-sm">
              Session expiring in {secondsRemaining}s
            </p>
            <p className="text-yellow-800/80 text-xs mt-1">
              Your wallet will be locked for security
            </p>
          </div>
        </div>
        <div className="flex gap-2 mt-3">
          <button
            onClick={onExtend}
            className="flex-1 bg-yellow-600 hover:bg-yellow-700 text-white text-sm py-2 px-3 rounded-lg transition-colors"
          >
            Stay Active
          </button>
          {onDismiss && (
            <button
              onClick={onDismiss}
              className="bg-yellow-400/50 hover:bg-yellow-400/70 text-yellow-900 text-sm py-2 px-3 rounded-lg transition-colors"
            >
              Dismiss
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

export default SessionExpiredModal;


