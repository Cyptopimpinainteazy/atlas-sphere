'use client';

import { useWalletStore } from '@/stores/walletStore';
import { 
  LayoutDashboard, 
  Send, 
  Download, 
  ArrowLeftRight, 
  History, 
  Settings,
  Hexagon,
  LogOut,
  Zap,
  Copy,
  Check,
  Coins
} from 'lucide-react';
import { useState } from 'react';

const navItems = [
  { id: 'apps/dash-legacy-2-legacy-2board', label: 'Dashboard', icon: LayoutDashboard },
  { id: 'send', label: 'Send', icon: Send },
  { id: 'receive', label: 'Receive', icon: Download },
  { id: 'swap', label: 'Swap', icon: ArrowLeftRight },
  { id: 'mint', label: 'Create Token', icon: Coins, badge: '✨' },
  { id: 'comit', label: 'Comit', icon: Zap },
  { id: 'history', label: 'History', icon: History },
  { id: 'settings', label: 'Settings', icon: Settings },
] as const;

export function Sidebar() {
  const { activeView, setActiveView, accounts, activeAccountIndex, disconnect } = useWalletStore();
  const [copied, setCopied] = useState(false);
  
  const activeAccount = accounts[activeAccountIndex];

  const copyAddress = () => {
    if (activeAccount?.address) {
      navigator.clipboard.writeText(activeAccount.address);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const formatAddress = (address: string) => {
    return `${address.slice(0, 6)}...${address.slice(-4)}`;
  };

  return (
    <aside className="fixed left-0 top-0 h-full w-64 bg-[#050505] border-r border-[#1a1a1a] flex flex-col">
      {/* Logo */}
      <div className="p-6 border-b border-[#1a1a1a]">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-orange-500 to-red-500 flex items-center justify-center">
            <Hexagon className="w-5 h-5 text-white" />
          </div>
          <div>
            <div className="font-bold text-white">X3 STAR</div>
            <div className="text-xs text-gray-500">Wallet</div>
          </div>
        </div>
      </div>

      {/* Account */}
      {activeAccount && (
        <div className="p-4 border-b border-[#1a1a1a]">
          <div className="p-3 rounded-xl bg-[#0a0a0a] border border-[#1a1a1a]">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm text-gray-400">{activeAccount.name}</span>
              <span className={`badge ${
                activeAccount.network === 'evm' ? 'badge-warning' :
                activeAccount.network === 'svm' ? 'bg-purple-500/20 text-purple-400 border border-purple-500/30' :
                'badge-success'
              }`}>
                {activeAccount.network.toUpperCase()}
              </span>
            </div>
            <button 
              onClick={copyAddress}
              className="flex items-center gap-2 text-sm text-gray-300 hover:text-white transition-colors"
            >
              <span className="font-mono">{formatAddress(activeAccount.address)}</span>
              {copied ? (
                <Check className="w-3 h-3 text-emerald-400" />
              ) : (
                <Copy className="w-3 h-3" />
              )}
            </button>
          </div>
        </div>
      )}

      {/* Navigation */}
      <nav className="flex-1 p-4 space-y-1">
        {navItems.map((item) => {
          const Icon = item.icon;
          const isActive = activeView === item.id;
          
          return (
            <button
              key={item.id}
              onClick={() => setActiveView(item.id as any)}
              className={isActive ? 'sidebar-item-active w-full' : 'sidebar-item w-full'}
            >
              <Icon className="w-5 h-5" />
              <span>{item.label}</span>
              {item.id === 'comit' && (
                <span className="ml-auto badge bg-orange-500/20 text-orange-400 border border-orange-500/30">
                  NEW
                </span>
              )}
              {item.id === 'mint' && (
                <span className="ml-auto text-sm">✨</span>
              )}
            </button>
          );
        })}
      </nav>

      {/* Footer */}
      <div className="p-4 border-t border-[#1a1a1a]">
        <button 
          onClick={disconnect}
          className="sidebar-item w-full text-red-400 hover:text-red-300 hover:bg-red-500/10"
        >
          <LogOut className="w-5 h-5" />
          <span>Disconnect</span>
        </button>
      </div>
    </aside>
  );
}
