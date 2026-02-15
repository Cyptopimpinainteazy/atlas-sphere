import React, { useState, useEffect } from "react";
import { useWallet } from "../context/WalletContext";
import * as api from "../lib/api";
import {
  Settings,
  Lock,
  Unlock,
  Shield,
  Download,
  Upload,
  Key,
  RefreshCw,
  AlertTriangle,
  CheckCircle,
  Copy,
  Eye,
  EyeOff,
  HardDrive,
  Globe,
  Cpu,
  Clock,
} from "lucide-react";
import { useSecureClipboard } from "../hooks/useSecureClipboard";

export default function SettingsPage() {
  const wallet = useWallet();
  const [walletInfo, setWalletInfo] = useState<api.WalletInfo | null>(null);
  const [networkInfo, setNetworkInfo] = useState<api.NetworkInfo | null>(null);
  const [miningInfo, setMiningInfo] = useState<api.MiningInfo | null>(null);
  const [loading, setLoading] = useState(true);

  // Modal states
  const [showLockModal, setShowLockModal] = useState(false);
  const [showBackupModal, setShowBackupModal] = useState(false);
  const [showExportModal, setShowExportModal] = useState(false);
  const [showImportModal, setShowImportModal] = useState(false);
  const [showTimeoutModal, setShowTimeoutModal] = useState(false);

  // Session timeout setting
  const [sessionTimeout, setSessionTimeout] = useState(() => {
    const saved = localStorage.getItem('mynta_session_timeout');
    return saved ? parseInt(saved, 10) : 10;
  });

  const fetchInfo = async () => {
    setLoading(true);
    try {
      const [wInfo, nInfo, mInfo] = await Promise.all([
        api.getWalletInfo().catch(() => null),
        api.getNetworkInfo().catch(() => null),
        api.getMiningInfo().catch(() => null),
      ]);
      setWalletInfo(wInfo);
      setNetworkInfo(nInfo);
      setMiningInfo(mInfo);
    } catch (err) {
      console.error("Failed to fetch info:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchInfo();
  }, []);

  const handleTimeoutChange = (minutes: number) => {
    setSessionTimeout(minutes);
    localStorage.setItem('mynta_session_timeout', minutes.toString());
  };

  return (
    <div className="max-w-4xl mx-auto animate-fade-in">
      {/* Header */}
      <div className="flex items-center gap-4 mb-8">
        <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-surface-600 to-surface-700 flex items-center justify-center">
          <Settings className="w-6 h-6 text-white" />
        </div>
        <div>
          <h2 className="text-2xl font-bold text-white">Settings</h2>
          <p className="text-surface-400">Wallet configuration and security</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Security Section */}
        <div className="card">
          <h3 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
            <Shield className="w-5 h-5 text-primary-400" />
            Security
          </h3>

          <div className="space-y-4">
            {/* Lock Status */}
            <div className="flex items-center justify-between p-4 bg-surface-800/50 rounded-xl">
              <div className="flex items-center gap-3">
                {wallet.walletLocked ? (
                  <Lock className="w-5 h-5 text-yellow-400" />
                ) : (
                  <Unlock className="w-5 h-5 text-accent-400" />
                )}
                <div>
                  <p className="text-white font-medium">Wallet Status</p>
                  <p className="text-sm text-surface-400">
                    {wallet.walletLocked ? "Locked" : "Unlocked"}
                  </p>
                </div>
              </div>
              <button
                onClick={() => setShowLockModal(true)}
                className="btn-secondary text-sm"
              >
                {wallet.walletLocked ? "Unlock" : "Lock"}
              </button>
            </div>

            {/* Session Timeout */}
            <button
              onClick={() => setShowTimeoutModal(true)}
              className="w-full flex items-center justify-between p-4 bg-surface-800/50 rounded-xl hover:bg-surface-800 transition-colors"
            >
              <div className="flex items-center gap-3">
                <Clock className="w-5 h-5 text-primary-400" />
                <div className="text-left">
                  <p className="text-white font-medium">Auto-Lock Timeout</p>
                  <p className="text-sm text-surface-400">
                    {sessionTimeout === 0 ? "Disabled" : `${sessionTimeout} minutes`}
                  </p>
                </div>
              </div>
            </button>

            {/* Backup */}
            <button
              onClick={() => setShowBackupModal(true)}
              className="w-full flex items-center justify-between p-4 bg-surface-800/50 rounded-xl hover:bg-surface-800 transition-colors"
            >
              <div className="flex items-center gap-3">
                <Download className="w-5 h-5 text-accent-400" />
                <div className="text-left">
                  <p className="text-white font-medium">Backup Wallet</p>
                  <p className="text-sm text-surface-400">Export wallet.dat file</p>
                </div>
              </div>
            </button>

            {/* Export Private Key */}
            <button
              onClick={() => setShowExportModal(true)}
              className="w-full flex items-center justify-between p-4 bg-surface-800/50 rounded-xl hover:bg-surface-800 transition-colors"
            >
              <div className="flex items-center gap-3">
                <Key className="w-5 h-5 text-yellow-400" />
                <div className="text-left">
                  <p className="text-white font-medium">Export Private Key</p>
                  <p className="text-sm text-surface-400">For specific address</p>
                </div>
              </div>
            </button>

            {/* Import Private Key */}
            <button
              onClick={() => setShowImportModal(true)}
              className="w-full flex items-center justify-between p-4 bg-surface-800/50 rounded-xl hover:bg-surface-800 transition-colors"
            >
              <div className="flex items-center gap-3">
                <Upload className="w-5 h-5 text-primary-400" />
                <div className="text-left">
                  <p className="text-white font-medium">Import Private Key</p>
                  <p className="text-sm text-surface-400">Add external keys</p>
                </div>
              </div>
            </button>
          </div>
        </div>

        {/* Wallet Info */}
        <div className="card">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold text-white flex items-center gap-2">
              <HardDrive className="w-5 h-5 text-primary-400" />
              Wallet Info
            </h3>
            <button
              onClick={fetchInfo}
              disabled={loading}
              className="btn-icon"
            >
              <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} />
            </button>
          </div>

          {walletInfo ? (
            <div className="space-y-3 text-sm">
              <InfoRow label="Wallet Name" value={walletInfo.walletname || "default"} />
              <InfoRow label="Wallet Version" value={walletInfo.walletversion.toString()} />
              <InfoRow
                label="Balance"
                value={`${api.formatMYNTA(walletInfo.balance)} MYNTA`}
              />
              <InfoRow
                label="Unconfirmed"
                value={`${api.formatMYNTA(walletInfo.unconfirmed_balance)} MYNTA`}
              />
              <InfoRow
                label="Immature"
                value={`${api.formatMYNTA(walletInfo.immature_balance)} MYNTA`}
              />
              <InfoRow label="Transactions" value={walletInfo.txcount.toString()} />
              <InfoRow label="Keypool Size" value={walletInfo.keypoolsize.toString()} />
              <InfoRow
                label="Pay TX Fee"
                value={`${walletInfo.paytxfee} MYNTA/kB`}
              />
            </div>
          ) : (
            <p className="text-surface-400">Loading wallet info...</p>
          )}
        </div>

        {/* Network Info */}
        <div className="card">
          <h3 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
            <Globe className="w-5 h-5 text-primary-400" />
            Network Info
          </h3>

          {networkInfo ? (
            <div className="space-y-3 text-sm">
              <InfoRow label="Version" value={networkInfo.version.toString()} />
              <InfoRow label="Subversion" value={networkInfo.subversion} />
              <InfoRow label="Protocol" value={networkInfo.protocolversion.toString()} />
              <InfoRow label="Connections" value={networkInfo.connections.toString()} />
              <InfoRow
                label="Relay Fee"
                value={`${networkInfo.relayfee} MYNTA/kB`}
              />
            </div>
          ) : (
            <p className="text-surface-400">Loading network info...</p>
          )}
        </div>

        {/* Mining Info */}
        <div className="card">
          <h3 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
            <Cpu className="w-5 h-5 text-primary-400" />
            Mining Info
          </h3>

          {miningInfo ? (
            <div className="space-y-3 text-sm">
              <InfoRow label="Chain" value={miningInfo.chain} />
              <InfoRow label="Blocks" value={miningInfo.blocks.toLocaleString()} />
              <InfoRow label="Difficulty" value={miningInfo.difficulty.toFixed(4)} />
              <InfoRow
                label="Network Hashrate"
                value={formatHashrate(miningInfo.networkhashps)}
              />
              <InfoRow label="Pooled TX" value={miningInfo.pooledtx.toString()} />
            </div>
          ) : (
            <p className="text-surface-400">Loading mining info...</p>
          )}
        </div>
      </div>

      {/* Modals */}
      {showLockModal && (
        <LockModal
          isLocked={wallet.walletLocked}
          onClose={() => setShowLockModal(false)}
          onSuccess={() => {
            setShowLockModal(false);
            wallet.refresh();
          }}
        />
      )}

      {showBackupModal && (
        <BackupModal onClose={() => setShowBackupModal(false)} />
      )}

      {showExportModal && (
        <SecureExportKeyModal 
          onClose={() => setShowExportModal(false)}
          isWalletLocked={wallet.walletLocked}
        />
      )}

      {showImportModal && (
        <ImportKeyModal
          onClose={() => setShowImportModal(false)}
          onSuccess={() => {
            setShowImportModal(false);
            wallet.refresh();
          }}
        />
      )}

      {showTimeoutModal && (
        <TimeoutSettingsModal
          currentTimeout={sessionTimeout}
          onSave={handleTimeoutChange}
          onClose={() => setShowTimeoutModal(false)}
        />
      )}
    </div>
  );
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between py-2">
      <span className="text-surface-400">{label}</span>
      <span className="text-white font-mono">{value}</span>
    </div>
  );
}

function formatHashrate(hashps: number): string {
  if (hashps >= 1e18) return `${(hashps / 1e18).toFixed(2)} EH/s`;
  if (hashps >= 1e15) return `${(hashps / 1e15).toFixed(2)} PH/s`;
  if (hashps >= 1e12) return `${(hashps / 1e12).toFixed(2)} TH/s`;
  if (hashps >= 1e9) return `${(hashps / 1e9).toFixed(2)} GH/s`;
  if (hashps >= 1e6) return `${(hashps / 1e6).toFixed(2)} MH/s`;
  if (hashps >= 1e3) return `${(hashps / 1e3).toFixed(2)} KH/s`;
  return `${hashps.toFixed(2)} H/s`;
}

function LockModal({
  isLocked,
  onClose,
  onSuccess,
}: {
  isLocked: boolean;
  onClose: () => void;
  onSuccess: () => void;
}) {
  const [passphrase, setPassphrase] = useState("");
  const [timeout, setTimeout] = useState(300);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError("");

    try {
      if (isLocked) {
        await api.walletUnlock(passphrase, timeout);
      } else {
        await api.walletLock();
      }
      onSuccess();
    } catch (err: any) {
      setError(err.message || "Operation failed");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 z-50">
      <div className="glass-card w-full max-w-md p-6 animate-scale-in">
        <h2 className="text-xl font-bold text-white mb-4">
          {isLocked ? "Unlock Wallet" : "Lock Wallet"}
        </h2>

        <form onSubmit={handleSubmit} className="space-y-4">
          {isLocked && (
            <>
              <div>
                <label className="label">Passphrase</label>
                <input
                  type="password"
                  value={passphrase}
                  onChange={(e) => setPassphrase(e.target.value)}
                  className="input"
                  placeholder="Enter wallet passphrase"
                  required
                />
              </div>

              <div>
                <label className="label">Timeout (seconds)</label>
                <input
                  type="number"
                  value={timeout}
                  onChange={(e) => setTimeout(parseInt(e.target.value))}
                  className="input"
                  min="1"
                />
                <p className="text-xs text-surface-500 mt-1">
                  Wallet will auto-lock after this time
                </p>
              </div>
            </>
          )}

          {!isLocked && (
            <p className="text-surface-300">
              Are you sure you want to lock the wallet? You'll need your passphrase to unlock it again.
            </p>
          )}

          {error && <p className="text-red-400 text-sm">{error}</p>}

          <div className="flex gap-4 pt-4">
            <button type="button" onClick={onClose} className="btn-secondary flex-1">
              Cancel
            </button>
            <button type="submit" disabled={loading} className="btn-primary flex-1">
              {loading ? "..." : isLocked ? "Unlock" : "Lock"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

function BackupModal({ onClose }: { onClose: () => void }) {
  const [destination, setDestination] = useState("");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<{ success: boolean; error?: string } | null>(null);

  const handleBackup = async () => {
    if (!destination) return;
    setLoading(true);
    try {
      await api.backupWallet(destination);
      setResult({ success: true });
    } catch (err: any) {
      setResult({ success: false, error: err.message });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 z-50">
      <div className="glass-card w-full max-w-md p-6 animate-scale-in">
        <h2 className="text-xl font-bold text-white mb-4">Backup Wallet</h2>

        <div className="space-y-4">
          <div>
            <label className="label">Backup Destination</label>
            <input
              type="text"
              value={destination}
              onChange={(e) => setDestination(e.target.value)}
              className="input"
              placeholder="/path/to/backup/wallet.dat"
            />
          </div>

          {result && (
            <div
              className={`p-4 rounded-xl ${
                result.success
                  ? "bg-accent-500/10 border border-accent-500/50"
                  : "bg-red-500/10 border border-red-500/50"
              }`}
            >
              {result.success ? (
                <p className="text-accent-400 flex items-center gap-2">
                  <CheckCircle className="w-5 h-5" />
                  Backup created successfully!
                </p>
              ) : (
                <p className="text-red-400">{result.error}</p>
              )}
            </div>
          )}

          <div className="flex gap-4 pt-4">
            <button onClick={onClose} className="btn-secondary flex-1">
              Close
            </button>
            <button
              onClick={handleBackup}
              disabled={loading || !destination}
              className="btn-primary flex-1"
            >
              {loading ? "Backing up..." : "Create Backup"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

/**
 * SecureExportKeyModal - Export private key with security safeguards
 * 
 * Security improvements:
 * - Requires password verification before showing key
 * - Auto-clears displayed key after 60 seconds
 * - Clears clipboard after 30 seconds
 * - Strong security warnings
 */
function SecureExportKeyModal({ 
  onClose,
  isWalletLocked,
}: { 
  onClose: () => void;
  isWalletLocked: boolean;
}) {
  const [step, setStep] = useState<'unlock' | 'address' | 'display'>('unlock');
  const [passphrase, setPassphrase] = useState("");
  const [address, setAddress] = useState("");
  const [privateKey, setPrivateKey] = useState("");
  const [showKey, setShowKey] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [keyTimeout, setKeyTimeout] = useState<NodeJS.Timeout | null>(null);
  const [timeRemaining, setTimeRemaining] = useState(60);
  const [copied, setCopied] = useState(false);
  
  const { copySecure, hasPendingClear, timeRemaining: clipboardTime } = useSecureClipboard({
    timeout: 30000,
    onCleared: () => setCopied(false),
  });

  // Skip unlock step if wallet is already unlocked
  useEffect(() => {
    if (!isWalletLocked) {
      setStep('address');
    }
  }, [isWalletLocked]);

  // Auto-clear key after 60 seconds
  useEffect(() => {
    if (privateKey) {
      const timer = setInterval(() => {
        setTimeRemaining(prev => {
          if (prev <= 1) {
            // Clear the key
            setPrivateKey("");
            setStep('address');
            clearInterval(timer);
            return 60;
          }
          return prev - 1;
        });
      }, 1000);
      setKeyTimeout(timer);
      return () => clearInterval(timer);
    }
  }, [privateKey]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (keyTimeout) clearTimeout(keyTimeout);
      // Clear sensitive data
      setPrivateKey("");
      setPassphrase("");
    };
  }, []);

  const handleUnlock = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError("");

    try {
      // Unlock for 60 seconds just for this operation
      await api.walletUnlock(passphrase, 60);
      setStep('address');
      setPassphrase(""); // Clear passphrase from memory
    } catch (err: any) {
      setError(err.message || "Failed to unlock wallet");
    } finally {
      setLoading(false);
    }
  };

  const handleExport = async () => {
    setLoading(true);
    setError("");
    setPrivateKey("");

    try {
      const key = await api.dumpPrivkey(address);
      setPrivateKey(key);
      setTimeRemaining(60);
      setStep('display');
    } catch (err: any) {
      setError(err.message || "Failed to export key");
    } finally {
      setLoading(false);
    }
  };

  const handleCopy = async () => {
    const success = await copySecure(privateKey, true);
    if (success) {
      setCopied(true);
    }
  };

  const handleClose = () => {
    // Clear all sensitive data
    setPrivateKey("");
    setPassphrase("");
    setAddress("");
    onClose();
  };

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 z-50">
      <div className="glass-card w-full max-w-md p-6 animate-scale-in">
        <h2 className="text-xl font-bold text-white mb-4 flex items-center gap-2">
          <Key className="w-5 h-5 text-yellow-400" />
          Export Private Key
        </h2>

        {/* Security Warning */}
        <div className="p-4 bg-red-500/10 border border-red-500/50 rounded-xl mb-6">
          <div className="flex items-start gap-3">
            <AlertTriangle className="w-6 h-6 text-red-400 flex-shrink-0 mt-0.5" />
            <div>
              <h4 className="text-red-400 font-semibold mb-1">Critical Security Warning</h4>
              <ul className="text-sm text-red-300/80 space-y-1 list-disc list-inside">
                <li>Never share your private key with anyone</li>
                <li>Anyone with this key can steal your funds</li>
                <li>Key will auto-hide after 60 seconds</li>
                <li>Consider using seed phrase backup instead</li>
              </ul>
            </div>
          </div>
        </div>

        <div className="space-y-4">
          {/* Step 1: Unlock wallet */}
          {step === 'unlock' && (
            <form onSubmit={handleUnlock} className="space-y-4">
              <p className="text-surface-400 text-sm">
                Verify your identity by entering your wallet passphrase.
              </p>
              <div>
                <label className="label">Wallet Passphrase</label>
                <input
                  type="password"
                  value={passphrase}
                  onChange={(e) => setPassphrase(e.target.value)}
                  className="input"
                  placeholder="Enter passphrase to continue"
                  autoFocus
                />
              </div>
              {error && <p className="text-red-400 text-sm">{error}</p>}
              <div className="flex gap-4">
                <button type="button" onClick={handleClose} className="btn-secondary flex-1">
                  Cancel
                </button>
                <button 
                  type="submit" 
                  disabled={loading || !passphrase}
                  className="btn-primary flex-1"
                >
                  {loading ? "Verifying..." : "Continue"}
                </button>
              </div>
            </form>
          )}

          {/* Step 2: Enter address */}
          {step === 'address' && (
            <>
              <div>
                <label className="label">Address to Export</label>
                <input
                  type="text"
                  value={address}
                  onChange={(e) => setAddress(e.target.value)}
                  className="input font-mono"
                  placeholder="Enter address"
                  autoFocus
                />
              </div>

              {error && <p className="text-red-400 text-sm">{error}</p>}

              <div className="flex gap-4 pt-4">
                <button onClick={handleClose} className="btn-secondary flex-1">
                  Cancel
                </button>
                <button
                  onClick={handleExport}
                  disabled={loading || !address}
                  className="btn-primary flex-1"
                >
                  {loading ? "Exporting..." : "Export Key"}
                </button>
              </div>
            </>
          )}

          {/* Step 3: Display key */}
          {step === 'display' && privateKey && (
            <>
              {/* Timer warning */}
              <div className="p-3 bg-yellow-500/10 border border-yellow-500/50 rounded-lg">
                <p className="text-yellow-400 text-sm flex items-center gap-2">
                  <Clock className="w-4 h-4" />
                  Key will be hidden in {timeRemaining} seconds
                </p>
              </div>

              <div>
                <label className="label">Private Key (WIF)</label>
                <div className="relative">
                  <input
                    type={showKey ? "text" : "password"}
                    value={privateKey}
                    readOnly
                    className="input font-mono pr-24 text-sm"
                  />
                  <div className="absolute right-2 top-1/2 -translate-y-1/2 flex gap-1">
                    <button
                      onClick={() => setShowKey(!showKey)}
                      className="p-2 hover:bg-surface-700 rounded"
                      title={showKey ? "Hide" : "Show"}
                    >
                      {showKey ? (
                        <EyeOff className="w-4 h-4 text-surface-400" />
                      ) : (
                        <Eye className="w-4 h-4 text-surface-400" />
                      )}
                    </button>
                    <button
                      onClick={handleCopy}
                      className="p-2 hover:bg-surface-700 rounded"
                      title="Copy (will clear in 30s)"
                    >
                      {copied ? (
                        <CheckCircle className="w-4 h-4 text-accent-400" />
                      ) : (
                        <Copy className="w-4 h-4 text-surface-400" />
                      )}
                    </button>
                  </div>
                </div>
                {hasPendingClear && (
                  <p className="text-xs text-yellow-400 mt-1">
                    Clipboard will clear in {clipboardTime}s
                  </p>
                )}
              </div>

              <div className="flex gap-4 pt-4">
                <button onClick={handleClose} className="btn-primary flex-1">
                  Done
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

function ImportKeyModal({
  onClose,
  onSuccess,
}: {
  onClose: () => void;
  onSuccess: () => void;
}) {
  const [privateKey, setPrivateKey] = useState("");
  const [label, setLabel] = useState("");
  const [rescan, setRescan] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const handleImport = async () => {
    setLoading(true);
    setError("");

    try {
      await api.importPrivkey(privateKey, label || undefined, rescan);
      onSuccess();
    } catch (err: any) {
      setError(err.message || "Failed to import key");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 z-50">
      <div className="glass-card w-full max-w-md p-6 animate-scale-in">
        <h2 className="text-xl font-bold text-white mb-4">Import Private Key</h2>

        <div className="space-y-4">
          <div>
            <label className="label">Private Key (WIF)</label>
            <input
              type="password"
              value={privateKey}
              onChange={(e) => setPrivateKey(e.target.value)}
              className="input font-mono"
              placeholder="Enter private key"
            />
          </div>

          <div>
            <label className="label">Label (optional)</label>
            <input
              type="text"
              value={label}
              onChange={(e) => setLabel(e.target.value)}
              className="input"
              placeholder="Account label"
            />
          </div>

          <label className="flex items-center gap-3 cursor-pointer">
            <input
              type="checkbox"
              checked={rescan}
              onChange={(e) => setRescan(e.target.checked)}
              className="w-4 h-4 rounded border-surface-600 bg-surface-800 text-primary-500"
            />
            <div>
              <p className="text-white">Rescan blockchain</p>
              <p className="text-xs text-surface-500">
                Required to find existing transactions (slow)
              </p>
            </div>
          </label>

          {error && <p className="text-red-400 text-sm">{error}</p>}

          <div className="flex gap-4 pt-4">
            <button onClick={onClose} className="btn-secondary flex-1">
              Cancel
            </button>
            <button
              onClick={handleImport}
              disabled={loading || !privateKey}
              className="btn-primary flex-1"
            >
              {loading ? "Importing..." : "Import Key"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

/**
 * TimeoutSettingsModal - Configure auto-lock timeout
 */
function TimeoutSettingsModal({
  currentTimeout,
  onSave,
  onClose,
}: {
  currentTimeout: number;
  onSave: (minutes: number) => void;
  onClose: () => void;
}) {
  const [timeout, setTimeout] = useState(currentTimeout);

  const presets = [
    { value: 0, label: "Disabled" },
    { value: 5, label: "5 minutes" },
    { value: 10, label: "10 minutes" },
    { value: 15, label: "15 minutes" },
    { value: 30, label: "30 minutes" },
    { value: 60, label: "1 hour" },
  ];

  const handleSave = () => {
    onSave(timeout);
    onClose();
  };

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 z-50">
      <div className="glass-card w-full max-w-md p-6 animate-scale-in">
        <h2 className="text-xl font-bold text-white mb-4 flex items-center gap-2">
          <Clock className="w-5 h-5 text-primary-400" />
          Auto-Lock Timeout
        </h2>

        <p className="text-surface-400 text-sm mb-6">
          Automatically lock your wallet after a period of inactivity for security.
        </p>

        <div className="space-y-4">
          <div className="grid grid-cols-3 gap-2">
            {presets.map(preset => (
              <button
                key={preset.value}
                onClick={() => setTimeout(preset.value)}
                className={`p-3 rounded-lg text-sm font-medium transition-all ${
                  timeout === preset.value
                    ? "bg-primary-600 text-white"
                    : "bg-surface-800 text-surface-400 hover:text-white hover:bg-surface-700"
                }`}
              >
                {preset.label}
              </button>
            ))}
          </div>

          <div>
            <label className="label">Custom (minutes)</label>
            <input
              type="number"
              value={timeout}
              onChange={(e) => setTimeout(Math.max(0, parseInt(e.target.value) || 0))}
              className="input"
              min="0"
              placeholder="Enter minutes"
            />
          </div>

          {timeout === 0 && (
            <div className="p-3 bg-yellow-500/10 border border-yellow-500/50 rounded-lg">
              <p className="text-yellow-400 text-sm flex items-center gap-2">
                <AlertTriangle className="w-4 h-4" />
                Auto-lock is disabled. Your wallet won't lock automatically.
              </p>
            </div>
          )}

          <div className="flex gap-4 pt-4">
            <button onClick={onClose} className="btn-secondary flex-1">
              Cancel
            </button>
            <button onClick={handleSave} className="btn-primary flex-1">
              Save
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
