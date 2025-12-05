'use client';

import { useState, useEffect } from 'react';
import { 
  ArrowUpRight, 
  ArrowDownLeft,
  ArrowLeftRight,
  Zap,
  ExternalLink,
  Filter,
  Search
} from 'lucide-react';
import axios from 'axios';
import { useWalletStore, Transaction } from '@/stores/walletStore';

export function HistoryView() {
  const { transactions } = useWalletStore();
  const [filter, setFilter] = useState<'all' | 'send' | 'receive' | 'swap' | 'comit'>('all');
  const [searchQuery, setSearchQuery] = useState('');

  // Analytics tracking
  useEffect(() => {
    const trackHistoryView = async () => {
      try {
        await axios.post('http://localhost:8080/event', {
          event_type: 'history_view',
          timestamp: new Date().toISOString(),
          user_id: null, // Placeholder - implement auth later
          metadata: { filter, searchQuery, transactionCount: transactions.length }
        });
      } catch (error) {
        console.error('Failed to track history view:', error);
      }
    };

    trackHistoryView();
  }, [filter, searchQuery, transactions.length]);

  const filteredTxs = transactions.filter((tx: Transaction) => {
    if (filter !== 'all' && tx.type !== filter) return false;
    if (searchQuery && !tx.hash.toLowerCase().includes(searchQuery.toLowerCase())) return false;
    return true;
  });

  const formatTime = (timestamp: number) => {
    const diff = Date.now() - timestamp;
    if (diff < 3600000) return `${Math.floor(diff / 60000)} min ago`;
    if (diff < 86400000) return `${Math.floor(diff / 3600000)} hours ago`;
    return `${Math.floor(diff / 86400000)} days ago`;
  };

  const getIcon = (type: string) => {
    switch (type) {
      case 'receive': return <ArrowDownLeft className="w-5 h-5" />;
      case 'send': return <ArrowUpRight className="w-5 h-5" />;
      case 'swap': return <ArrowLeftRight className="w-5 h-5" />;
      case 'comit': return <Zap className="w-5 h-5" />;
      default: return null;
    }
  };

  const getIconStyle = (type: string) => {
    switch (type) {
      case 'receive': return 'bg-emerald-500/20 text-emerald-400';
      case 'send': return 'bg-red-500/20 text-red-400';
      case 'swap': return 'bg-purple-500/20 text-purple-400';
      case 'comit': return 'bg-orange-500/20 text-orange-400';
      default: return '';
    }
  };

  return (
    <div className="max-w-3xl">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-white mb-1">History</h1>
        <p className="text-gray-500">Your transaction history across all networks</p>
      </div>

      {/* Filters */}
      <div className="glass-card p-4 mb-6">
        <div className="flex flex-col sm:flex-row gap-4">
          {/* Search */}
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search by hash..."
              className="input-field pl-10"
            />
          </div>

          {/* Filter Buttons */}
          <div className="flex gap-2">
            {['all', 'send', 'receive', 'swap', 'comit'].map((f) => (
              <button
                key={f}
                onClick={() => setFilter(f as any)}
                className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                  filter === f 
                    ? 'bg-orange-500/20 text-orange-400 border border-orange-500/30' 
                    : 'text-gray-400 hover:text-white hover:bg-[#111111]'
                }`}
              >
                {f.charAt(0).toUpperCase() + f.slice(1)}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Transaction List */}
      <div className="space-y-3">
        {filteredTxs.length === 0 ? (
          <div className="glass-card p-12 text-center">
            <Filter className="w-12 h-12 mx-auto mb-4 text-gray-600" />
            <h3 className="text-lg font-medium text-white mb-2">No transactions found</h3>
            <p className="text-gray-500">Try adjusting your filters</p>
          </div>
        ) : (
          filteredTxs.map((tx: Transaction) => (
            <div key={tx.id} className="glass-card p-4 hover:border-orange-500/30 transition-all">
              <div className="flex items-center gap-4">
                <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${getIconStyle(tx.type)}`}>
                  {getIcon(tx.type)}
                </div>
                
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="font-medium text-white capitalize">{tx.type}</span>
                    <span className={`badge ${
                      tx.network === 'evm' ? 'badge-warning' :
                      tx.network === 'svm' ? 'bg-purple-500/20 text-purple-400 border border-purple-500/30' :
                      'badge-success'
                    }`}>
                      {tx.network.toUpperCase()}
                    </span>
                  </div>
                  <div className="text-sm text-gray-500 truncate">
                    {tx.from ? `From ${tx.from}` : tx.to ? `To ${tx.to}` : tx.amount}
                  </div>
                </div>

                <div className="text-right">
                  <div className={`font-medium ${
                    tx.type === 'receive' ? 'text-emerald-400' : 
                    tx.type === 'send' ? 'text-red-400' : 
                    'text-white'
                  }`}>
                    {tx.amount}
                  </div>
                  <div className="text-sm text-gray-500">{formatTime(tx.timestamp)}</div>
                </div>

                <button className="btn-icon">
                  <ExternalLink className="w-4 h-4" />
                </button>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
