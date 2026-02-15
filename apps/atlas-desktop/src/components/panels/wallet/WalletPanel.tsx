import React, { useState, useEffect } from 'react';
import { invoke } from '@tauri-apps/api/tauri';
import { useWalletStore, type ActiveView } from '@/stores/walletStore';
import {
  LayoutDashboard, Send, Download, ArrowLeftRight, History, Settings, Zap, Coins,
  LogOut, TrendingUp, ArrowUpRight, ArrowDownLeft, Copy, Check,
  ChevronDown, Loader2, Search, Info, Rocket, Globe, Hexagon,
  ChevronRight, Image, Share2, User, Shield, Bell, Moon,
} from 'lucide-react';

// ── Helpers ─────────────────────────────────────────────────────────────────

const fmt = (n: number) => n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const fmtUSD = (n: number) => `$${fmt(n)}`;
const shortHash = (h: string) => `${h.slice(0, 8)}…${h.slice(-6)}`;
const timeAgo = (ts: number) => {
  const d = Math.floor((Date.now() - ts) / 1000);
  if (d < 60) return `${d}s ago`;
  if (d < 3600) return `${Math.floor(d / 60)}m ago`;
  if (d < 86400) return `${Math.floor(d / 3600)}h ago`;
  return `${Math.floor(d / 86400)}d ago`;
};

const navItems: { view: ActiveView; label: string; Icon: React.FC<any> }[] = [
  { view: 'dashboard', label: 'Dashboard', Icon: LayoutDashboard },
  { view: 'send', label: 'Send', Icon: Send },
  { view: 'receive', label: 'Receive', Icon: Download },
  { view: 'swap', label: 'Swap', Icon: ArrowLeftRight },
  { view: 'mint', label: 'Create Token', Icon: Coins },
  { view: 'comit', label: 'Comit', Icon: Zap },
  { view: 'history', label: 'History', Icon: History },
  { view: 'settings', label: 'Settings', Icon: Settings },
];

const statusColor: Record<string, string> = {
  confirmed: 'text-green-400',
  pending: 'text-yellow-400',
  failed: 'text-red-400',
};

const txIcon = (type: string) => {
  if (type === 'send') return <ArrowUpRight className="w-4 h-4 text-red-400" />;
  if (type === 'receive') return <ArrowDownLeft className="w-4 h-4 text-green-400" />;
  if (type === 'swap') return <ArrowLeftRight className="w-4 h-4 text-blue-400" />;
  if (type === 'comit') return <Zap className="w-4 h-4 text-orange-400" />;
  return <Coins className="w-4 h-4 text-purple-400" />;
};

// ── Universal Wallet State ──────────────────────────────────────────────────

interface UniversalWallet {
  mnemonic: string;
  seed_hex: string;
  evm_address: string;
  evm_private_key: string;
  solana_address: string;
  polkadot_address: string;
  evm_chain_count: number;
  warning: string;
}

const WalletPanel: React.FC = () => {
  const { activeView, setActiveView, disconnect, accounts, activeAccountIndex, setAccounts, setActiveAccountIndex } = useWalletStore();
  const [universalWallet, setUniversalWallet] = useState<UniversalWallet | null>(null);
  const [generating, setGenerating] = useState(false);
  const [walletModal, setWalletModal] = useState(false);
  const [evmChainCount, setEvmChainCount] = useState(0);

  // Load EVM chain count
  useEffect(() => {
    invoke('get_evm_chain_count').then((count: number) => {
      setEvmChainCount(count);
    }).catch(console.error);
  }, []);

  // Generate Universal Wallet
  const generateUniversalWallet = async () => {
    setGenerating(true);
    try {
      const wallet = await invoke<UniversalWallet>('generate_universal_wallet');
      setUniversalWallet(wallet);
      setWalletModal(true);
      // Update store
      setAccounts([{
        name: 'Atlas Universal Wallet',
        address: wallet.evm_address,
        network: 'universal',
      }]);
      setActiveAccountIndex(0);
    } catch (error) {
      console.error('Wallet generation failed:', error);
    }
    setGenerating(false);
  };

  const ActiveComponent = {
    dashboard: DashboardView,
    send: SendView,
    receive: ReceiveView,
    swap: SwapView,
    history: HistoryView,
    settings: SettingsView,
    comit: ComitView,
    mint: MintView,
  }[activeView] as React.FC;

  return (
    <div className="flex h-full bg-[#0a0a0f] text-white">
      {/* Sidebar */}
      <aside className="w-48 flex flex-col border-r border-[#1a1a1a] bg-[#0a0a0f]">
        {/* Header with Universal Wallet button */}
        <div className="p-4 border-b border-[#1a1a1a]">
          <div className="flex items-center gap-2 mb-2">
            <Rocket className="w-5 h-5 text-orange-400" />
            <h1 className="text-sm font-bold text-white">Atlas Wallet</h1>
          </div>
          <p className="text-xs text-gray-500 mb-3">59,263 EVM chains + Solana + Polkadot</p>
          <button 
            onClick={generateUniversalWallet} 
            disabled={generating}
            className="w-full flex items-center gap-2 bg-gradient-to-r from-orange-500 to-purple-600 hover:from-orange-600 hover:to-purple-700 disabled:opacity-50 text-white text-xs font-medium rounded-lg py-2 transition-all"
          >
            {generating ? <Loader2 className="w-4 h-4 animate-spin" /> : <Globe className="w-4 h-4" />}
            Generate Universal Wallet
          </button>
        </div>
        {/* Navigation */}
        <nav className="flex-1 py-2 space-y-0.5 px-2">
          {navItems.map(({ view, label, Icon }) => (
            <button key={view} onClick={() => setActiveView(view)} className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm transition-colors ${activeView === view ? 'bg-orange-500/10 text-orange-400' : 'text-gray-400 hover:text-white hover:bg-white/5'}`}>
              <Icon className="w-4 h-4" />{label}
            </button>
          ))}
        </nav>
        {/* Disconnect */}
        <div className="p-2 border-t border-[#1a1a1a]">
          <button onClick={disconnect} className="w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm text-red-400 hover:bg-red-500/10 transition-colors">
            <LogOut className="w-4 h-4" />Disconnect
          </button>
        </div>
      </aside>
      {/* Content */}
      <main className="flex-1 overflow-y-auto p-6">
        <ActiveComponent />
      </main>

      {/* Universal Wallet Modal */}
      {walletModal && universalWallet && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-[#0a0a0f] border border-[#1a1a1a] rounded-2xl max-w-2xl max-h-[90vh] overflow-y-auto w-full mx-4">
            <div className="p-6 border-b border-[#1a1a1a]">
              <div className="flex items-center gap-3 mb-4">
                <Rocket className="w-6 h-6 text-orange-400" />
                <h2 className="text-xl font-bold text-white">Atlas Universal Wallet Created</h2>
              </div>
              <p className="text-sm text-gray-400 mb-4">Your wallet works on <strong>{universalWallet.evm_chain_count.toLocaleString()}</strong> EVM chains + Solana + Polkadot</p>
              <div className="flex gap-2 text-xs text-orange-400 bg-orange-500/10 p-2 rounded-lg">
                <Shield className="w-3 h-3" />
                <span>{universalWallet.warning}</span>
              </div>
            </div>
            <div className="p-6 space-y-4">
              {/* EVM */}
              <div>
                <h3 className="text-sm font-semibold text-gray-300 mb-2 flex items-center gap-2">
                  <Globe className="w-4 h-4" />
                  EVM Address (59k+ chains)
                </h3>
                <div className="bg-[#111111] border border-[#1a1a1a] rounded-lg p-3 font-mono text-sm break-all">
                  {universalWallet.evm_address}
                </div>
              </div>
              {/* Solana */}
              <div>
                <h3 className="text-sm font-semibold text-gray-300 mb-2 flex items-center gap-2">
                  Solana Address
                </h3>
                <div className="bg-[#111111] border border-[#1a1a1a] rounded-lg p-3 font-mono text-sm break-all">
                  {universalWallet.solana_address}
                </div>
              </div>
              {/* Polkadot */}
              <div>
                <h3 className="text-sm font-semibold text-gray-300 mb-2 flex items-center gap-2">
                  Polkadot Address
                </h3>
                <div className="bg-[#111111] border border-[#1a1a1a] rounded-lg p-3 font-mono text-sm break-all">
                  {universalWallet.polkadot_address}
                </div>
              </div>
              {/* Mnemonic (hidden by default) */}
              <details className="group">
                <summary className="text-sm font-medium text-gray-300 cursor-pointer flex items-center gap-2 hover:text-white transition-colors">
                  Show Mnemonic (24 words) <ChevronDown className="w-4 h-4 group-open:rotate-180 transition-transform" />
                </summary>
                <div className="mt-2 bg-orange-500/10 border border-orange-500/30 rounded-lg p-3">
                  <p className="text-xs text-orange-300 mb-2 font-mono break-words">{universalWallet.mnemonic}</p>
                  <p className="text-xs text-orange-400">Backup this securely - controls ALL chains!</p>
                </div>
              </details>
              {/* Actions */}
              <div className="flex gap-3 pt-4">
                <button onClick={() => {
                  navigator.clipboard.writeText(JSON.stringify(universalWallet, null, 2));
                  setWalletModal(false);
                }} className="flex-1 flex items-center justify-center gap-2 bg-green-500/90 hover:bg-green-600 text-white font-medium rounded-lg py-3 transition-colors">
                  <Download className="w-4 h-4" /> Export JSON
                </button>
                <button onClick={() => setWalletModal(false)} className="flex-1 bg-[#111111] border border-[#1a1a1a] hover:border-orange-500/50 text-white font-medium rounded-lg py-3 transition-colors">
                  Close
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default WalletPanel;