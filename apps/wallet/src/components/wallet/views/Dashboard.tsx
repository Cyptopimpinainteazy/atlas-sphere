'use client';

import { useWalletStore, Token } from '@/stores/walletStore';
import { 
  TrendingUp, 
  TrendingDown, 
  ArrowUpRight, 
  ArrowDownLeft,
  Send,
  Download,
  ArrowLeftRight,
  Zap,
  ExternalLink
} from 'lucide-react';

export function Dashboard() {
  const { tokens, accounts, activeAccountIndex, setActiveView } = useWalletStore();
  const activeAccount = accounts[activeAccountIndex];

  // Calculate total balance
  const totalBalance = tokens.reduce((sum: number, token: Token) => {
    const value = parseFloat(token.value.replace(/[$,]/g, ''));
    return sum + value;
  }, 0);

  const quickActions = [
    { id: 'send', label: 'Send', icon: Send, color: 'from-orange-500 to-red-500' },
    { id: 'receive', label: 'Receive', icon: Download, color: 'from-emerald-500 to-cyan-500' },
    { id: 'swap', label: 'Swap', icon: ArrowLeftRight, color: 'from-purple-500 to-pink-500' },
    { id: 'comit', label: 'Comit', icon: Zap, color: 'from-amber-500 to-orange-500' },
  ];

  return (
    <div className="max-w-4xl">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-white mb-1">Dashboard</h1>
        <p className="text-gray-500">Manage your multi-chain assets</p>
      </div>

      {/* Balance Card */}
      <div className="glass-card p-8 mb-8">
        <div className="flex items-start justify-between">
          <div>
            <p className="text-gray-400 text-sm mb-2">Total Balance</p>
            <h2 className="text-4xl font-bold text-white mb-2">
              ${totalBalance.toLocaleString('en-US', { minimumFractionDigits: 2 })}
            </h2>
            <div className="flex items-center gap-2">
              <span className="flex items-center text-emerald-400 text-sm">
                <TrendingUp className="w-4 h-4 mr-1" />
                +5.2%
              </span>
              <span className="text-gray-500 text-sm">24h</span>
            </div>
          </div>
          
          {/* Mini chart placeholder */}
          <div className="w-32 h-16 rounded-lg bg-gradient-to-r from-orange-500/20 to-red-500/20 flex items-end p-2">
            <div className="flex items-end gap-1 w-full h-full">
              {[40, 60, 45, 70, 55, 80, 65, 90].map((h, i) => (
                <div 
                  key={i}
                  className="flex-1 bg-gradient-to-t from-orange-500 to-red-500 rounded-t"
                  style={{ height: `${h}%` }}
                />
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Quick Actions */}
      <div className="grid grid-cols-4 gap-4 mb-8">
        {quickActions.map((action) => {
          const Icon = action.icon;
          return (
            <button
              key={action.id}
              onClick={() => setActiveView(action.id as any)}
              className="glass-card p-6 text-center hover:border-orange-500/30 transition-all group"
            >
              <div className={`w-12 h-12 mx-auto mb-3 rounded-xl bg-gradient-to-br ${action.color} flex items-center justify-center`}>
                <Icon className="w-6 h-6 text-white" />
              </div>
              <span className="text-sm font-medium text-gray-300 group-hover:text-white transition-colors">
                {action.label}
              </span>
            </button>
          );
        })}
      </div>

      {/* Tokens */}
      <div className="glass-card p-6">
        <div className="flex items-center justify-between mb-6">
          <h3 className="text-lg font-semibold text-white">Assets</h3>
          <button className="text-sm text-orange-400 hover:text-orange-300 transition-colors">
            View All
          </button>
        </div>

        <div className="space-y-3">
          {tokens.map((token: Token, index: number) => (
            <div key={index} className="token-row">
              <div className="flex items-center gap-4">
                <div className={`w-10 h-10 rounded-xl flex items-center justify-center text-xl ${
                  token.network === 'evm' ? 'bg-[#627EEA]/20' :
                  token.network === 'svm' ? 'bg-[#9945FF]/20' :
                  'bg-orange-500/20'
                }`}>
                  {token.icon}
                </div>
                <div>
                  <div className="font-medium text-white">{token.symbol}</div>
                  <div className="text-sm text-gray-500">{token.name}</div>
                </div>
              </div>
              <div className="text-right">
                <div className="font-medium text-white">{token.balance}</div>
                <div className="flex items-center justify-end gap-2">
                  <span className="text-sm text-gray-400">{token.value}</span>
                  <span className={`text-xs flex items-center ${
                    token.change24h >= 0 ? 'text-emerald-400' : 'text-red-400'
                  }`}>
                    {token.change24h >= 0 ? (
                      <TrendingUp className="w-3 h-3 mr-0.5" />
                    ) : (
                      <TrendingDown className="w-3 h-3 mr-0.5" />
                    )}
                    {Math.abs(token.change24h)}%
                  </span>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Recent Activity */}
      <div className="glass-card p-6 mt-6">
        <div className="flex items-center justify-between mb-6">
          <h3 className="text-lg font-semibold text-white">Recent Activity</h3>
          <button 
            onClick={() => setActiveView('history')}
            className="text-sm text-orange-400 hover:text-orange-300 transition-colors"
          >
            View All
          </button>
        </div>

        <div className="space-y-3">
          {/* Demo transactions */}
          {[
            { type: 'receive', amount: '+0.5 ETH', from: '0x742d...12AB', time: '2 hours ago', status: 'confirmed' },
            { type: 'send', amount: '-100 STAR', to: '5Grwv...utQY', time: '5 hours ago', status: 'confirmed' },
            { type: 'swap', amount: '1 SOL → 45 USDC', time: '1 day ago', status: 'confirmed' },
          ].map((tx, index) => (
            <div key={index} className="activity-row">
              <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${
                tx.type === 'receive' ? 'bg-emerald-500/20 text-emerald-400' :
                tx.type === 'send' ? 'bg-red-500/20 text-red-400' :
                'bg-purple-500/20 text-purple-400'
              }`}>
                {tx.type === 'receive' ? <ArrowDownLeft className="w-5 h-5" /> :
                 tx.type === 'send' ? <ArrowUpRight className="w-5 h-5" /> :
                 <ArrowLeftRight className="w-5 h-5" />}
              </div>
              <div className="flex-1">
                <div className="font-medium text-white capitalize">{tx.type}</div>
                <div className="text-sm text-gray-500">
                  {tx.from ? `From ${tx.from}` : tx.to ? `To ${tx.to}` : tx.amount}
                </div>
              </div>
              <div className="text-right">
                <div className={`font-medium ${
                  tx.type === 'receive' ? 'text-emerald-400' : 
                  tx.type === 'send' ? 'text-red-400' : 'text-white'
                }`}>
                  {tx.type !== 'swap' ? tx.amount : ''}
                </div>
                <div className="text-sm text-gray-500">{tx.time}</div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
