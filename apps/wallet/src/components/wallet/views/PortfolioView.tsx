'use client';

import { useWalletStore, Token } from '@/stores/walletStore';
import { useWalletContext } from '@/components/providers/WalletProvider';
import { 
  TrendingUp, 
  TrendingDown, 
  DollarSign,
  PieChart,
  BarChart3,
  ArrowUpRight,
  ArrowDownRight,
  Plus,
  Minus,
  Eye,
  EyeOff,
  RefreshCw,
  Filter,
  Search,
  Star,
  StarOff
} from 'lucide-react';

export function PortfolioView() {
  const { tokens, accounts, activeAccountIndex, setActiveView } = useWalletStore();
  const { refreshBalance, sdkConnected } = useWalletContext();
  const activeAccount = accounts[activeAccountIndex];

  // Calculate portfolio metrics
  const portfolioValue = tokens.reduce((sum: number, token: Token) => {
    const value = parseFloat(token.value.replace(/[$,]/g, ''));
    return sum + value;
  }, 0);

  const totalChange24h = tokens.reduce((sum: number, token: Token) => {
    const value = parseFloat(token.value.replace(/[$,]/g, ''));
    const changePercent = token.change24h / 100;
    return sum + (value * changePercent);
  }, 0);

  const changePercentage = portfolioValue > 0 ? (totalChange24h / (portfolioValue - totalChange24h)) * 100 : 0;

  // Asset allocation by network
  const networkAllocation = tokens.reduce((acc: Record<string, number>, token: Token) => {
    const value = parseFloat(token.value.replace(/[$,]/g, ''));
    acc[token.network] = (acc[token.network] || 0) + value;
    return acc;
  }, {});

  // Top performing assets
  const topPerformers = [...tokens].sort((a, b) => b.change24h - a.change24h).slice(0, 3);
  const worstPerformers = [...tokens].sort((a, b) => a.change24h - b.change24h).slice(0, 3);

  // Portfolio diversification
  const diversification = tokens.map(token => ({
    ...token,
    percentage: portfolioValue > 0 ? (parseFloat(token.value.replace(/[$,]/g, '')) / portfolioValue) * 100 : 0
  }));

  return (
    <div className="max-w-6xl mx-auto">
      {/* Header */}
      <div className="mb-8">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-white mb-1">Portfolio</h1>
            <p className="text-gray-500">Track your multi-chain investments</p>
          </div>
          
          <div className="flex items-center gap-4">
            <button
              onClick={() => refreshBalance()}
              disabled={!sdkConnected}
              className="flex items-center gap-2 px-4 py-2 bg-orange-500/20 hover:bg-orange-500/30 border border-orange-500/30 rounded-lg transition-colors disabled:opacity-50"
            >
              <RefreshCw className="w-4 h-4 text-orange-400" />
              <span className="text-orange-400">Refresh</span>
            </button>
            
            <button
              onClick={() => setActiveView('dashboard')}
              className="px-4 py-2 bg-gray-800 hover:bg-gray-700 border border-gray-700 rounded-lg transition-colors"
            >
              <span className="text-gray-300">Back to Dashboard</span>
            </button>
          </div>
        </div>
      </div>

      {/* Portfolio Overview Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
        {/* Total Value */}
        <div className="glass-card p-6">
          <div className="flex items-center justify-between mb-2">
            <p className="text-gray-400 text-sm">Total Value</p>
            <DollarSign className="w-5 h-5 text-emerald-400" />
          </div>
          <h2 className="text-2xl font-bold text-white mb-1">
            ${portfolioValue.toLocaleString('en-US', { minimumFractionDigits: 2 })}
          </h2>
          <div className="flex items-center gap-2">
            <span className={`flex items-center text-sm ${
              totalChange24h >= 0 ? 'text-emerald-400' : 'text-red-400'
            }`}>
              {totalChange24h >= 0 ? <TrendingUp className="w-4 h-4 mr-1" /> : <TrendingDown className="w-4 h-4 mr-1" />}
              {Math.abs(changePercentage).toFixed(2)}%
            </span>
            <span className="text-gray-500 text-sm">24h</span>
          </div>
        </div>

        {/* Assets Count */}
        <div className="glass-card p-6">
          <div className="flex items-center justify-between mb-2">
            <p className="text-gray-400 text-sm">Assets</p>
            <PieChart className="w-5 h-5 text-blue-400" />
          </div>
          <h2 className="text-2xl font-bold text-white mb-1">{tokens.length}</h2>
          <p className="text-gray-500 text-sm">Different tokens</p>
        </div>

        {/* Best Performer */}
        <div className="glass-card p-6">
          <div className="flex items-center justify-between mb-2">
            <p className="text-gray-400 text-sm">Best Performer</p>
            <ArrowUpRight className="w-5 h-5 text-emerald-400" />
          </div>
          {topPerformers.length > 0 ? (
            <>
              <h2 className="text-lg font-bold text-white mb-1">{topPerformers[0].symbol}</h2>
              <p className="text-emerald-400 text-sm">+{topPerformers[0].change24h}%</p>
            </>
          ) : (
            <>
              <h2 className="text-lg font-bold text-white mb-1">--</h2>
              <p className="text-gray-500 text-sm">No data</p>
            </>
          )}
        </div>

        {/* Worst Performer */}
        <div className="glass-card p-6">
          <div className="flex items-center justify-between mb-2">
            <p className="text-gray-400 text-sm">Worst Performer</p>
            <ArrowDownRight className="w-5 h-5 text-red-400" />
          </div>
          {worstPerformers.length > 0 ? (
            <>
              <h2 className="text-lg font-bold text-white mb-1">{worstPerformers[0].symbol}</h2>
              <p className="text-red-400 text-sm">{worstPerformers[0].change24h}%</p>
            </>
          ) : (
            <>
              <h2 className="text-lg font-bold text-white mb-1">--</h2>
              <p className="text-gray-500 text-sm">No data</p>
            </>
          )}
        </div>
      </div>

      {/* Asset Allocation by Network */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mb-8">
        {/* Network Distribution */}
        <div className="glass-card p-6">
          <div className="flex items-center justify-between mb-6">
            <h3 className="text-lg font-semibold text-white">Network Distribution</h3>
            <BarChart3 className="w-5 h-5 text-gray-400" />
          </div>
          
          <div className="space-y-4">
            {Object.entries(networkAllocation).map(([network, value]) => (
              <div key={network} className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className={`w-3 h-3 rounded-full ${
                    network === 'evm' ? 'bg-blue-500' :
                    network === 'svm' ? 'bg-purple-500' :
                    'bg-orange-500'
                  }`} />
                  <span className="text-white capitalize">{network}</span>
                </div>
                <div className="text-right">
                  <p className="text-white font-medium">${value.toFixed(2)}</p>
                  <p className="text-gray-500 text-sm">
                    {portfolioValue > 0 ? ((value / portfolioValue) * 100).toFixed(1) : 0}%
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Performance Summary */}
        <div className="glass-card p-6">
          <div className="flex items-center justify-between mb-6">
            <h3 className="text-lg font-semibold text-white">Performance Summary</h3>
            <TrendingUp className="w-5 h-5 text-gray-400" />
          </div>
          
          <div className="space-y-4">
            <div className="flex items-center justify-between p-3 bg-emerald-500/10 rounded-lg border border-emerald-500/20">
              <div className="flex items-center gap-3">
                <ArrowUpRight className="w-5 h-5 text-emerald-400" />
                <span className="text-white">Gainers</span>
              </div>
              <span className="text-emerald-400 font-medium">
                {tokens.filter(t => t.change24h > 0).length} assets
              </span>
            </div>
            
            <div className="flex items-center justify-between p-3 bg-red-500/10 rounded-lg border border-red-500/20">
              <div className="flex items-center gap-3">
                <ArrowDownRight className="w-5 h-5 text-red-400" />
                <span className="text-white">Losers</span>
              </div>
              <span className="text-red-400 font-medium">
                {tokens.filter(t => t.change24h < 0).length} assets
              </span>
            </div>
            
            <div className="flex items-center justify-between p-3 bg-gray-500/10 rounded-lg border border-gray-500/20">
              <div className="flex items-center gap-3">
                <BarChart3 className="w-5 h-5 text-gray-400" />
                <span className="text-white">Unchanged</span>
              </div>
              <span className="text-gray-400 font-medium">
                {tokens.filter(t => t.change24h === 0).length} assets
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Detailed Asset List */}
      <div className="glass-card p-6">
        <div className="flex items-center justify-between mb-6">
          <h3 className="text-lg font-semibold text-white">Asset Details</h3>
          <div className="flex items-center gap-2">
            <Search className="w-4 h-4 text-gray-400" />
            <input
              type="text"
              placeholder="Search assets..."
              className="bg-gray-800/50 border border-gray-700 rounded-lg px-3 py-1 text-white text-sm focus:outline-none focus:border-orange-500/50"
            />
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-gray-800">
                <th className="text-left py-3 px-4 text-gray-400 font-medium">Asset</th>
                <th className="text-right py-3 px-4 text-gray-400 font-medium">Balance</th>
                <th className="text-right py-3 px-4 text-gray-400 font-medium">Value</th>
                <th className="text-right py-3 px-4 text-gray-400 font-medium">24h Change</th>
                <th className="text-right py-3 px-4 text-gray-400 font-medium">Allocation</th>
                <th className="text-center py-3 px-4 text-gray-400 font-medium">Network</th>
              </tr>
            </thead>
            <tbody>
              {diversification
                .sort((a, b) => parseFloat(b.value.replace(/[$,]/g, '')) - parseFloat(a.value.replace(/[$,]/g, '')))
                .map((token, index) => (
                <tr key={index} className="border-b border-gray-800/50 hover:bg-gray-800/20 transition-colors">
                  <td className="py-4 px-4">
                    <div className="flex items-center gap-3">
                      <div className={`w-8 h-8 rounded-lg flex items-center justify-center text-sm ${
                        token.network === 'evm' ? 'bg-[#627EEA]/20' :
                        token.network === 'svm' ? 'bg-[#9945FF]/20' :
                        'bg-orange-500/20'
                      }`}>
                        {token.icon}
                      </div>
                      <div>
                        <p className="text-white font-medium">{token.symbol}</p>
                        <p className="text-gray-500 text-sm">{token.name}</p>
                      </div>
                    </div>
                  </td>
                  <td className="py-4 px-4 text-right">
                    <p className="text-white">{token.balance}</p>
                  </td>
                  <td className="py-4 px-4 text-right">
                    <p className="text-white font-medium">{token.value}</p>
                  </td>
                  <td className="py-4 px-4 text-right">
                    <div className="flex items-center justify-end gap-1">
                      <span className={`text-sm font-medium ${
                        token.change24h >= 0 ? 'text-emerald-400' : 'text-red-400'
                      }`}>
                        {token.change24h >= 0 ? '+' : ''}{token.change24h}%
                      </span>
                      {token.change24h >= 0 ? (
                        <TrendingUp className="w-3 h-3 text-emerald-400" />
                      ) : (
                        <TrendingDown className="w-3 h-3 text-red-400" />
                      )}
                    </div>
                  </td>
                  <td className="py-4 px-4 text-right">
                    <div className="flex items-center justify-end gap-2">
                      <div className="w-16 bg-gray-700 rounded-full h-2">
                        <div 
                          className="bg-gradient-to-r from-orange-500 to-red-500 h-2 rounded-full"
                          style={{ width: `${Math.min(token.percentage, 100)}%` }}
                        />
                      </div>
                      <span className="text-gray-400 text-sm">{token.percentage.toFixed(1)}%</span>
                    </div>
                  </td>
                  <td className="py-4 px-4 text-center">
                    <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                      token.network === 'evm' ? 'bg-blue-500/20 text-blue-400' :
                      token.network === 'svm' ? 'bg-purple-500/20 text-purple-400' :
                      'bg-orange-500/20 text-orange-400'
                    }`}>
                      {token.network.toUpperCase()}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
