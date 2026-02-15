import React, { useState, useEffect } from "react";
import { useWallet } from "../context/WalletContext";
import { formatMYNTA, getDaemonStatus, stopIntegratedDaemon, DaemonStatus } from "../lib/api";
import { LaunchCountdown } from "./LaunchCountdown";
import {
  LayoutDashboard,
  Send,
  Download,
  Coins,
  Server,
  ArrowLeftRight,
  Settings,
  Globe,
  Lock,
  Unlock,
  RefreshCw,
  LogOut,
  Wifi,
  WifiOff,
  HardDrive,
  Power,
  Loader2,
  Blocks,
  X,
} from "lucide-react";

interface LayoutProps {
  children: React.ReactNode;
  currentPage: string;
  onNavigate: (page: string) => void;
}

const navItems = [
  { id: "dashboard", label: "Dashboard", icon: LayoutDashboard },
  { id: "send", label: "Send", icon: Send },
  { id: "receive", label: "Receive", icon: Download },
  { id: "assets", label: "Assets", icon: Coins },
  { id: "masternodes", label: "Masternodes", icon: Server },
  { id: "dex", label: "DEX", icon: ArrowLeftRight },
  { id: "settings", label: "Settings", icon: Settings },
];

function getDaemonStatusDisplay(status: DaemonStatus): { text: string; color: string; icon: React.ReactNode } {
  if (status === "stopped") {
    return { text: "Stopped", color: "text-surface-400", icon: <Power className="w-4 h-4" /> };
  }
  if (status === "starting") {
    return { text: "Starting...", color: "text-yellow-400", icon: <Loader2 className="w-4 h-4 animate-spin" /> };
  }
  if (status === "running") {
    return { text: "Running", color: "text-accent-400", icon: <HardDrive className="w-4 h-4" /> };
  }
  if (status === "stopping") {
    return { text: "Stopping...", color: "text-yellow-400", icon: <Loader2 className="w-4 h-4 animate-spin" /> };
  }
  if (typeof status === "object") {
    if ("syncing" in status) {
      const progress = Math.round(status.syncing.progress * 100);
      return { text: `Syncing ${progress}%`, color: "text-primary-400", icon: <Loader2 className="w-4 h-4 animate-spin" /> };
    }
    if ("crashed" in status) {
      return { text: "Crashed", color: "text-red-400", icon: <Power className="w-4 h-4" /> };
    }
  }
  return { text: "Unknown", color: "text-surface-400", icon: <Power className="w-4 h-4" /> };
}

export default function Layout({ children, currentPage, onNavigate }: LayoutProps) {
  const wallet = useWallet();
  const [daemonStatus, setDaemonStatus] = useState<DaemonStatus>("stopped");
  const [stoppingDaemon, setStoppingDaemon] = useState(false);

  // Poll daemon status
  useEffect(() => {
    const fetchStatus = async () => {
      try {
        const status = await getDaemonStatus();
        setDaemonStatus(status);
      } catch {
        // Ignore errors
      }
    };

    fetchStatus();
    const interval = setInterval(fetchStatus, 5000);
    return () => clearInterval(interval);
  }, []);

  const handleStopDaemon = async () => {
    setStoppingDaemon(true);
    try {
      await stopIntegratedDaemon();
      setDaemonStatus("stopped");
    } finally {
      setStoppingDaemon(false);
    }
  };

  const daemonDisplay = getDaemonStatusDisplay(daemonStatus);

  return (
    <div className="flex h-screen overflow-hidden bg-surface-950">
      {/* Sidebar - Glass Panel */}
      <aside className="w-72 flex flex-col glass-panel">
        {/* Logo */}
        <div className="p-6 pb-4">
          <div className="flex items-center gap-3">
            <div className="icon-container-lg icon-primary">
              <span className="text-white font-bold text-lg">Ai</span>
            </div>
            <div>
              <h1 className="text-xl font-bold text-white tracking-tight">Mynta</h1>
              <p className="text-xs text-surface-400 font-medium">Wallet v1.0</p>
            </div>
          </div>
        </div>

        {/* Balance Card */}
        <div className="px-4 pb-4">
          <div className="glass-card p-5">
            <p className="stat-label mb-2">
              Total Balance
            </p>
            <p className="text-2xl font-bold text-white tracking-tight">
              {formatMYNTA(wallet.balance)}
              <span className="text-primary-400 text-lg ml-2">MYNTA</span>
            </p>
            {wallet.unconfirmedBalance > 0 && (
              <div className="mt-3 pt-3 border-t border-white/[0.06]">
                <p className="text-sm text-yellow-400 flex items-center gap-2">
                  <span className="w-1.5 h-1.5 rounded-full bg-yellow-400 animate-pulse" />
                  +{formatMYNTA(wallet.unconfirmedBalance)} pending
                </p>
              </div>
            )}
          </div>
        </div>

        {/* Navigation */}
        <nav className="flex-1 px-3 py-2 space-y-1 overflow-y-auto">
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = currentPage === item.id;
            return (
              <button
                key={item.id}
                onClick={() => onNavigate(item.id)}
                className={`sidebar-link w-full relative ${isActive ? "active" : ""}`}
              >
                <Icon className="w-5 h-5" />
                <span className="font-medium">{item.label}</span>
              </button>
            );
          })}
        </nav>

        {/* Status Bar */}
        <div className="p-4 space-y-3 glass-surface border-t-0 border-l-0 border-r-0">
          {/* Daemon Status */}
          <div className="flex items-center justify-between text-sm">
            <div className="flex items-center gap-2">
              <span className={daemonDisplay.color}>{daemonDisplay.icon}</span>
              <span className={`${daemonDisplay.color} font-medium`}>Node: {daemonDisplay.text}</span>
            </div>
            {daemonStatus === "running" && (
              <button
                onClick={handleStopDaemon}
                disabled={stoppingDaemon}
                className="btn-icon p-1.5"
                title="Stop daemon"
              >
                <Power className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          {/* Connection Status */}
          <div className="flex items-center justify-between text-sm">
            <div className="flex items-center gap-2">
              {wallet.connected ? (
                <>
                  <Wifi className="w-4 h-4 text-accent-400" />
                  <span className="text-surface-300 font-medium">RPC Connected</span>
                </>
              ) : (
                <>
                  <WifiOff className="w-4 h-4 text-red-400" />
                  <span className="text-surface-400">RPC Disconnected</span>
                </>
              )}
            </div>
            <div className="flex items-center gap-1.5 text-surface-400">
              <Globe className="w-3.5 h-3.5" />
              <span className="font-mono text-xs">{wallet.connections}</span>
            </div>
          </div>

          {/* Block Height & Sync Status */}
          <div className="flex items-center justify-between text-sm">
            <div className="flex items-center gap-2 text-surface-400">
              <Blocks className="w-4 h-4" />
              <span className="font-mono text-xs">{wallet.blockHeight.toLocaleString()}</span>
            </div>
            {wallet.synced ? (
              <span className="badge-success">Synced</span>
            ) : (
              <span className="badge-warning">Syncing...</span>
            )}
          </div>

          {/* Actions */}
          <div className="flex items-center gap-2 pt-2 border-t border-white/[0.06]">
            <button
              onClick={() => wallet.refresh()}
              className="btn-icon flex-1 flex items-center justify-center"
              title="Refresh"
            >
              <RefreshCw className="w-4 h-4" />
            </button>
            <button
              onClick={() => onNavigate("settings")}
              className="btn-icon flex-1 flex items-center justify-center"
              title={wallet.walletLocked ? "Unlock Wallet" : "Lock Wallet"}
            >
              {wallet.walletLocked ? (
                <Lock className="w-4 h-4" />
              ) : (
                <Unlock className="w-4 h-4" />
              )}
            </button>
            {wallet.connected && (
              <button
                onClick={wallet.disconnect}
                className="btn-icon flex-1 flex items-center justify-center hover:text-red-400"
                title="Disconnect"
              >
                <LogOut className="w-4 h-4" />
              </button>
            )}
          </div>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 overflow-hidden flex flex-col">
        {/* Top Bar - Glass Surface */}
        <header className="h-20 flex items-center justify-between px-8 glass-surface border-l-0 border-r-0 border-t-0">
          <div>
            <h2 className="text-xl font-semibold text-white capitalize tracking-tight">
              {currentPage}
            </h2>
            <p className="text-sm text-surface-400 font-medium">
              {wallet.chain === "main" ? "Mainnet" : wallet.chain === "test" ? "Testnet" : "Regtest"}
            </p>
          </div>

          <div className="flex items-center gap-4">
            {/* Launch Countdown */}
            <LaunchCountdown />
            
            {!wallet.synced && (
              <div className="flex items-center gap-2.5 px-4 py-2 rounded-full glass-subtle">
                <div className="w-2 h-2 rounded-full bg-yellow-400 animate-pulse" />
                <span className="text-sm text-yellow-400 font-medium">Syncing blockchain...</span>
              </div>
            )}
          </div>
        </header>

        {/* Page Content */}
        <div className="flex-1 overflow-y-auto p-8 bg-gradient-mesh">
          {wallet.error && (
            <div className="mb-6 p-4 glass-subtle border-red-500/30 rounded-xl flex items-center justify-between animate-fade-in">
              <p className="text-red-400 font-medium">{wallet.error}</p>
              <button
                onClick={wallet.clearError}
                className="btn-icon p-1.5 hover:text-red-400"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          )}
          <div className="animate-fade-in">
            {children}
          </div>
        </div>
      </main>
    </div>
  );
}
