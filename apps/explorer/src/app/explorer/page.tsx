'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import {
  Search,
  Blocks,
  ArrowRightLeft,
  Users,
  Activity,
  Clock,
  ChevronRight,
  ExternalLink,
  Copy,
  Check,
  TrendingUp,
  Zap,
  Database,
  Shield,
  RefreshCw,
} from 'lucide-react';
import { HexagonCluster } from '../../components/ui/Logo';

// Mock data for demonstration
const mockBlocks = [
  { number: 12847593, hash: '0x8f7e...3d2a', transactions: 24, time: '6s ago', validator: 'Atlas-1' },
  { number: 12847592, hash: '0x2c9b...8e1f', transactions: 18, time: '12s ago', validator: 'Atlas-2' },
  { number: 12847591, hash: '0x6d4a...7c3b', transactions: 31, time: '18s ago', validator: 'Atlas-3' },
  { number: 12847590, hash: '0x1f8c...9a2d', transactions: 15, time: '24s ago', validator: 'Atlas-1' },
  { number: 12847589, hash: '0x9e3f...4b1c', transactions: 22, time: '30s ago', validator: 'Atlas-2' },
];

const mockTransactions = [
  { hash: '0x7a2e...8c4f', type: 'Comit', from: '5Grw...tQY', to: '5FHn...94ty', value: '1,250 ATLAS', time: '3s ago', status: 'success' },
  { hash: '0x3b9d...1e2a', type: 'EVM', from: '0x1234...5678', to: '0x8765...4321', value: '0.5 ETH', time: '8s ago', status: 'success' },
  { hash: '0x5c1f...9d3b', type: 'SVM', from: 'Abc1...xyz2', to: 'Def3...uvw4', value: '100 SOL', time: '15s ago', status: 'success' },
  { hash: '0x2d8a...6f4c', type: 'Transfer', from: '5GrW...TqY', to: '5HnE...J4ty', value: '500 ATLAS', time: '22s ago', status: 'success' },
  { hash: '0x9e4b...2a1d', type: 'Comit', from: '5ABC...DEF', to: 'Multi', value: '2,000 ATLAS', time: '28s ago', status: 'pending' },
];

const networkStats = [
  { label: 'Block Height', value: '12,847,593', icon: <Blocks className="w-5 h-5" />, change: '+126' },
  { label: 'Transactions', value: '48.2M', icon: <ArrowRightLeft className="w-5 h-5" />, change: '+2,341' },
  { label: 'Active Accounts', value: '284,192', icon: <Users className="w-5 h-5" />, change: '+892' },
  { label: 'TPS (Current)', value: '4,281', icon: <Activity className="w-5 h-5" />, change: '+12%' },
];

const vmStats = [
  { vm: 'EVM', txCount: '24.1M', contracts: '12,847', gasUsed: '89.2%' },
  { vm: 'SVM', txCount: '18.3M', programs: '4,291', computeUsed: '72.4%' },
  { vm: 'Cross-VM', txCount: '5.8M', comits: '5,842,193', avgTime: '1.2s' },
];

export default function ExplorerPage() {
  const [activeTab, setActiveTab] = useState<'overview' | 'blocks' | 'transactions' | 'accounts'>('overview');
  const [searchQuery, setSearchQuery] = useState('');
  const [copiedHash, setCopiedHash] = useState<string | null>(null);
  const [isLive, setIsLive] = useState(true);

  const copyToClipboard = (hash: string) => {
    navigator.clipboard.writeText(hash);
    setCopiedHash(hash);
    setTimeout(() => setCopiedHash(null), 2000);
  };

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    // Handle search
    console.log('Searching for:', searchQuery);
  };

  return (
    <div className="min-h-screen pt-20">
      {/* Hero / Search Section */}
      <section className="py-12 relative overflow-hidden border-b border-white/10">
        <div className="absolute inset-0 mesh-gradient opacity-20" />
        <div className="absolute right-0 top-0 w-96 h-96 opacity-20">
          <HexagonCluster className="w-full h-full" />
        </div>
        
        <div className="relative z-10 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between mb-6">
            <div>
              <h1 className="text-3xl md:text-4xl font-bold text-white mb-2">
                X3scan Explorer
              </h1>
              <p className="text-gray-400">
                Explore the X3 STAR Atlas Sphere blockchain in real-time
              </p>
            </div>
            <div className="flex items-center space-x-2">
              <span className={`w-2 h-2 rounded-full ${isLive ? 'bg-emerald-500 animate-pulse' : 'bg-gray-500'}`} />
              <span className="text-sm text-gray-400">{isLive ? 'Live' : 'Paused'}</span>
              <button
                onClick={() => setIsLive(!isLive)}
                className="p-2 rounded-lg hover:bg-white/10 transition-colors"
              >
                <RefreshCw className={`w-4 h-4 text-gray-400 ${isLive ? 'animate-spin' : ''}`} style={{ animationDuration: '3s' }} />
              </button>
            </div>
          </div>

          {/* Search */}
          <form onSubmit={handleSearch} className="relative max-w-3xl">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-500" />
            <input
              type="text"
              placeholder="Search by Address / Tx Hash / Block / Token"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-12 pr-4 py-4 rounded-xl bg-white/5 border border-white/10 text-white placeholder-gray-500 focus:outline-none focus:border-orange-500 focus:ring-2 focus:ring-orange-500/20 transition-all"
            />
            <button
              type="submit"
              className="absolute right-2 top-1/2 -translate-y-1/2 px-4 py-2 bg-orange-500 hover:bg-orange-600 text-white rounded-lg font-medium transition-colors"
            >
              Search
            </button>
          </form>
        </div>
      </section>

      {/* Stats */}
      <section className="py-8 border-b border-white/10">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {networkStats.map((stat) => (
              <div key={stat.label} className="glass-card p-4">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-orange-400">{stat.icon}</span>
                  <span className="text-xs text-emerald-400">{stat.change}</span>
                </div>
                <div className="text-2xl font-bold text-white">{stat.value}</div>
                <div className="text-sm text-gray-400">{stat.label}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Tabs */}
      <section className="border-b border-white/10">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex space-x-1">
            {[
              { id: 'overview', label: 'Overview', icon: <Activity className="w-4 h-4" /> },
              { id: 'blocks', label: 'Blocks', icon: <Blocks className="w-4 h-4" /> },
              { id: 'transactions', label: 'Transactions', icon: <ArrowRightLeft className="w-4 h-4" /> },
              { id: 'accounts', label: 'Accounts', icon: <Users className="w-4 h-4" /> },
            ].map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id as any)}
                className={`flex items-center px-4 py-4 border-b-2 font-medium text-sm transition-colors ${
                  activeTab === tab.id
                    ? 'border-orange-500 text-orange-400'
                    : 'border-transparent text-gray-400 hover:text-white hover:border-gray-600'
                }`}
              >
                <span className="mr-2">{tab.icon}</span>
                {tab.label}
              </button>
            ))}
          </div>
        </div>
      </section>

      {/* Content */}
      <section className="py-8">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          {activeTab === 'overview' && (
            <div className="grid lg:grid-cols-2 gap-8">
              {/* Latest Blocks */}
              <div className="glass-card overflow-hidden">
                <div className="p-4 border-b border-white/10 flex items-center justify-between">
                  <h3 className="font-semibold text-white flex items-center">
                    <Blocks className="w-5 h-5 mr-2 text-orange-400" />
                    Latest Blocks
                  </h3>
                  <Link href="/explorer?tab=blocks" className="text-sm text-orange-400 hover:text-orange-300">
                    View All
                  </Link>
                </div>
                <div className="divide-y divide-white/5">
                  {mockBlocks.map((block) => (
                    <div key={block.number} className="p-4 hover:bg-white/5 transition-colors">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center space-x-3">
                          <div className="w-10 h-10 rounded-lg bg-orange-500/20 flex items-center justify-center">
                            <Blocks className="w-5 h-5 text-orange-400" />
                          </div>
                          <div>
                            <Link href={`/explorer/block/${block.number}`} className="font-mono text-white hover:text-orange-400">
                              #{block.number.toLocaleString()}
                            </Link>
                            <div className="text-xs text-gray-500">{block.time}</div>
                          </div>
                        </div>
                        <div className="text-right">
                          <div className="text-sm text-gray-300">{block.transactions} txns</div>
                          <div className="text-xs text-gray-500">By {block.validator}</div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Latest Transactions */}
              <div className="glass-card overflow-hidden">
                <div className="p-4 border-b border-white/10 flex items-center justify-between">
                  <h3 className="font-semibold text-white flex items-center">
                    <ArrowRightLeft className="w-5 h-5 mr-2 text-cyan-400" />
                    Latest Transactions
                  </h3>
                  <Link href="/explorer?tab=transactions" className="text-sm text-cyan-400 hover:text-cyan-300">
                    View All
                  </Link>
                </div>
                <div className="divide-y divide-white/5">
                  {mockTransactions.map((tx) => (
                    <div key={tx.hash} className="p-4 hover:bg-white/5 transition-colors">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center space-x-3">
                          <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${
                            tx.type === 'Comit' ? 'bg-purple-500/20' :
                            tx.type === 'EVM' ? 'bg-blue-500/20' :
                            tx.type === 'SVM' ? 'bg-emerald-500/20' :
                            'bg-gray-500/20'
                          }`}>
                            <span className={`text-xs font-bold ${
                              tx.type === 'Comit' ? 'text-purple-400' :
                              tx.type === 'EVM' ? 'text-blue-400' :
                              tx.type === 'SVM' ? 'text-emerald-400' :
                              'text-gray-400'
                            }`}>
                              {tx.type === 'Comit' ? 'C' : tx.type[0]}
                            </span>
                          </div>
                          <div>
                            <div className="flex items-center space-x-2">
                              <Link href={`/explorer/tx/${tx.hash}`} className="font-mono text-sm text-white hover:text-cyan-400">
                                {tx.hash}
                              </Link>
                              <span className={`badge text-xs ${
                                tx.type === 'Comit' ? 'badge-purple' :
                                tx.type === 'EVM' ? 'badge-info' :
                                tx.type === 'SVM' ? 'badge-success' :
                                'bg-gray-500/20 text-gray-400'
                              }`}>
                                {tx.type}
                              </span>
                            </div>
                            <div className="text-xs text-gray-500">
                              {tx.from} → {tx.to}
                            </div>
                          </div>
                        </div>
                        <div className="text-right">
                          <div className="text-sm text-gray-300">{tx.value}</div>
                          <div className="text-xs text-gray-500">{tx.time}</div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* VM Statistics */}
              <div className="lg:col-span-2">
                <h3 className="font-semibold text-white mb-4">Virtual Machine Statistics</h3>
                <div className="grid md:grid-cols-3 gap-4">
                  {vmStats.map((vm) => (
                    <div key={vm.vm} className={`glass-card p-6 border-l-4 ${
                      vm.vm === 'EVM' ? 'border-l-blue-500' :
                      vm.vm === 'SVM' ? 'border-l-emerald-500' :
                      'border-l-purple-500'
                    }`}>
                      <div className="flex items-center justify-between mb-4">
                        <h4 className={`text-lg font-bold ${
                          vm.vm === 'EVM' ? 'text-blue-400' :
                          vm.vm === 'SVM' ? 'text-emerald-400' :
                          'text-purple-400'
                        }`}>
                          {vm.vm}
                        </h4>
                        <span className="badge badge-info">{vm.txCount} txns</span>
                      </div>
                      <div className="space-y-2 text-sm">
                        {vm.vm === 'EVM' && (
                          <>
                            <div className="flex justify-between">
                              <span className="text-gray-400">Contracts</span>
                              <span className="text-white">{vm.contracts}</span>
                            </div>
                            <div className="flex justify-between">
                              <span className="text-gray-400">Gas Used</span>
                              <span className="text-white">{vm.gasUsed}</span>
                            </div>
                          </>
                        )}
                        {vm.vm === 'SVM' && (
                          <>
                            <div className="flex justify-between">
                              <span className="text-gray-400">Programs</span>
                              <span className="text-white">{vm.programs}</span>
                            </div>
                            <div className="flex justify-between">
                              <span className="text-gray-400">Compute Used</span>
                              <span className="text-white">{vm.computeUsed}</span>
                            </div>
                          </>
                        )}
                        {vm.vm === 'Cross-VM' && (
                          <>
                            <div className="flex justify-between">
                              <span className="text-gray-400">Total Comits</span>
                              <span className="text-white">{vm.comits}</span>
                            </div>
                            <div className="flex justify-between">
                              <span className="text-gray-400">Avg Execution</span>
                              <span className="text-white">{vm.avgTime}</span>
                            </div>
                          </>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {activeTab === 'blocks' && (
            <div className="glass-card overflow-hidden">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-white/10">
                    <th className="table-header">Block</th>
                    <th className="table-header">Hash</th>
                    <th className="table-header">Txns</th>
                    <th className="table-header">Validator</th>
                    <th className="table-header">Time</th>
                  </tr>
                </thead>
                <tbody>
                  {[...mockBlocks, ...mockBlocks].map((block, i) => (
                    <tr key={i} className="border-b border-white/5 hover:bg-white/5">
                      <td className="table-cell">
                        <Link href={`/explorer/block/${block.number - i}`} className="text-orange-400 hover:text-orange-300 font-mono">
                          #{(block.number - i).toLocaleString()}
                        </Link>
                      </td>
                      <td className="table-cell font-mono text-gray-400">{block.hash}</td>
                      <td className="table-cell text-white">{block.transactions}</td>
                      <td className="table-cell text-gray-400">{block.validator}</td>
                      <td className="table-cell text-gray-500">{block.time}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {activeTab === 'transactions' && (
            <div className="glass-card overflow-hidden">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-white/10">
                    <th className="table-header">Tx Hash</th>
                    <th className="table-header">Type</th>
                    <th className="table-header">From</th>
                    <th className="table-header">To</th>
                    <th className="table-header">Value</th>
                    <th className="table-header">Time</th>
                  </tr>
                </thead>
                <tbody>
                  {[...mockTransactions, ...mockTransactions].map((tx, i) => (
                    <tr key={i} className="border-b border-white/5 hover:bg-white/5">
                      <td className="table-cell">
                        <Link href={`/explorer/tx/${tx.hash}`} className="text-cyan-400 hover:text-cyan-300 font-mono">
                          {tx.hash}
                        </Link>
                      </td>
                      <td className="table-cell">
                        <span className={`badge text-xs ${
                          tx.type === 'Comit' ? 'badge-purple' :
                          tx.type === 'EVM' ? 'badge-info' :
                          tx.type === 'SVM' ? 'badge-success' :
                          'bg-gray-500/20 text-gray-400'
                        }`}>
                          {tx.type}
                        </span>
                      </td>
                      <td className="table-cell font-mono text-gray-400">{tx.from}</td>
                      <td className="table-cell font-mono text-gray-400">{tx.to}</td>
                      <td className="table-cell text-white">{tx.value}</td>
                      <td className="table-cell text-gray-500">{tx.time}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {activeTab === 'accounts' && (
            <div className="text-center py-16">
              <Users className="w-16 h-16 text-gray-600 mx-auto mb-4" />
              <h3 className="text-xl font-semibold text-white mb-2">Account Explorer</h3>
              <p className="text-gray-400 mb-6">Search for an account address to view details</p>
              <div className="max-w-md mx-auto">
                <input
                  type="text"
                  placeholder="Enter account address..."
                  className="input-search"
                />
              </div>
            </div>
          )}
        </div>
      </section>
    </div>
  );
}
