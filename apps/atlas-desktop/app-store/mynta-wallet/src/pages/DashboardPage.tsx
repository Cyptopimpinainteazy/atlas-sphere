import { useEffect, useState } from "react";
import { useWallet } from "../context/WalletContext";
import * as api from "../lib/api";
import {
  ArrowUpRight,
  ArrowDownLeft,
  TrendingUp,
  Users,
  Box,
  Activity,
  Clock,
  ExternalLink,
  Sparkles,
} from "lucide-react";

export default function DashboardPage() {
  const wallet = useWallet();
  const [transactions, setTransactions] = useState<api.Transaction[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const txs = await api.listTransactions(10);
        setTransactions(txs.reverse());
      } catch (err) {
        console.error("Failed to fetch transactions:", err);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
    const interval = setInterval(fetchData, 30000);
    return () => clearInterval(interval);
  }, []);

  const stats = [
    {
      label: "Confirmed Balance",
      value: api.formatMYNTA(wallet.balance),
      suffix: "MYNTA",
      icon: TrendingUp,
      color: "text-accent-400",
      glowColor: "rgb(45 212 179 / 0.15)",
      iconBg: "icon-accent",
    },
    {
      label: "Pending",
      value: api.formatMYNTA(wallet.unconfirmedBalance),
      suffix: "MYNTA",
      icon: Clock,
      color: "text-yellow-400",
      glowColor: "rgb(234 179 8 / 0.15)",
      iconBg: "bg-yellow-500/20 border border-yellow-500/30",
    },
    {
      label: "Block Height",
      value: wallet.blockHeight.toLocaleString(),
      suffix: "",
      icon: Box,
      color: "text-primary-400",
      glowColor: "rgb(92 106 255 / 0.15)",
      iconBg: "icon-primary",
    },
    {
      label: "Connections",
      value: wallet.connections.toString(),
      suffix: "peers",
      icon: Users,
      color: "text-blue-400",
      glowColor: "rgb(59 130 246 / 0.15)",
      iconBg: "bg-blue-500/20 border border-blue-500/30",
    },
  ];

  return (
    <div className="space-y-8">
      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-5">
        {stats.map((stat, index) => {
          const Icon = stat.icon;
          return (
            <div
              key={stat.label}
              className="stat-card group"
              style={{
                animationDelay: `${index * 50}ms`,
                boxShadow: `0 8px 32px rgb(0 0 0 / 0.15), 0 0 40px ${stat.glowColor}`,
              }}
            >
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <p className="stat-label">{stat.label}</p>
                  <p className="mt-3 text-2xl font-bold text-white tracking-tight">
                    {stat.value}
                    {stat.suffix && (
                      <span className={`text-sm ml-2 font-semibold ${stat.color}`}>
                        {stat.suffix}
                      </span>
                    )}
                  </p>
                </div>
                <div className={`icon-container ${stat.iconBg}`}>
                  <Icon className={`w-5 h-5 text-white`} />
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Main Content Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Recent Activity */}
        <div className="lg:col-span-2 card">
          <div className="flex items-center justify-between mb-6">
            <h3 className="text-lg font-semibold text-white flex items-center gap-3">
              <div className="icon-container">
                <Activity className="w-5 h-5 text-primary-400" />
              </div>
              Recent Activity
            </h3>
          </div>

          {loading ? (
            <div className="space-y-3">
              {[...Array(5)].map((_, i) => (
                <div 
                  key={i} 
                  className="h-20 glass-subtle rounded-xl animate-pulse"
                  style={{ animationDelay: `${i * 100}ms` }}
                />
              ))}
            </div>
          ) : transactions.length === 0 ? (
            <div className="text-center py-16 glass-subtle rounded-xl">
              <div className="icon-container-lg mx-auto mb-4">
                <Sparkles className="w-6 h-6 text-surface-400" />
              </div>
              <p className="text-surface-400 font-medium">No transactions yet</p>
              <p className="text-surface-500 text-sm mt-1">Your transaction history will appear here</p>
            </div>
          ) : (
            <div className="space-y-2">
              {transactions.map((tx, index) => (
                <TransactionRow key={tx.txid} tx={tx} index={index} />
              ))}
            </div>
          )}
        </div>

        {/* Quick Actions & Network Info */}
        <div className="space-y-6">
          {/* Quick Actions */}
          <div className="card">
            <h3 className="text-lg font-semibold text-white mb-5">Quick Actions</h3>
            <div className="grid grid-cols-2 gap-3">
              <button className="btn-primary py-5 flex flex-col items-center gap-2.5 text-sm">
                <ArrowUpRight className="w-6 h-6" />
                <span className="font-semibold">Send</span>
              </button>
              <button className="btn-accent py-5 flex flex-col items-center gap-2.5 text-sm">
                <ArrowDownLeft className="w-6 h-6" />
                <span className="font-semibold">Receive</span>
              </button>
            </div>
          </div>

          {/* Network Status */}
          <div className="card">
            <h3 className="text-lg font-semibold text-white mb-5">Network Status</h3>
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <span className="text-surface-400 text-sm">Chain</span>
                <span className="badge-info capitalize">{wallet.chain}</span>
              </div>
              <div className="section-divider my-3" />
              <div className="flex items-center justify-between">
                <span className="text-surface-400 text-sm">Sync Status</span>
                {wallet.synced ? (
                  <span className="badge-success">Synced</span>
                ) : (
                  <span className="badge-warning">Syncing</span>
                )}
              </div>
              <div className="section-divider my-3" />
              <div className="flex items-center justify-between">
                <span className="text-surface-400 text-sm">Peers</span>
                <span className="text-white font-semibold">{wallet.connections}</span>
              </div>
            </div>
          </div>

          {/* Wallet Health */}
          <div className="card">
            <h3 className="text-lg font-semibold text-white mb-5">Wallet Health</h3>
            <div className="relative">
              <div className="flex items-center justify-between mb-3">
                <span className="text-sm text-surface-400">Sync Progress</span>
                <span className="text-sm font-semibold text-accent-400">
                  {wallet.synced ? "100%" : "Syncing..."}
                </span>
              </div>
              <div className="h-2.5 glass-subtle rounded-full overflow-hidden">
                <div
                  className="h-full rounded-full transition-all duration-700 ease-out"
                  style={{
                    width: wallet.synced ? "100%" : "75%",
                    background: "linear-gradient(90deg, var(--color-primary-500), var(--color-accent-500))",
                    boxShadow: "0 0 16px rgb(92 106 255 / 0.4)",
                  }}
                />
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function TransactionRow({ tx, index }: { tx: api.Transaction; index: number }) {
  const isReceive = tx.category === "receive" || tx.amount > 0;
  const isConfirmed = tx.confirmations >= 6;

  return (
    <div 
      className="tx-row group"
      style={{ animationDelay: `${index * 50}ms` }}
    >
      <div className="flex items-center gap-4">
        <div className={`tx-icon ${isReceive ? 'tx-icon-receive' : 'tx-icon-send'}`}>
          {isReceive ? (
            <ArrowDownLeft className="w-5 h-5" />
          ) : (
            <ArrowUpRight className="w-5 h-5" />
          )}
        </div>
        <div>
          <p className="text-white font-semibold">
            {isReceive ? "Received" : "Sent"}
          </p>
          <p className="text-sm text-surface-400 font-mono">
            {tx.address ? api.shortenAddress(tx.address) : "Unknown"}
          </p>
        </div>
      </div>

      <div className="text-right flex items-center gap-4">
        <div>
          <p
            className={`font-bold ${
              isReceive ? "text-accent-400" : "text-red-400"
            }`}
          >
            {isReceive ? "+" : "-"}
            {api.formatMYNTA(Math.abs(tx.amount))} MYNTA
          </p>
          <div className="flex items-center gap-2 justify-end mt-1">
            <span className="text-xs text-surface-500 font-medium">
              {tx.confirmations} conf
            </span>
            {isConfirmed ? (
              <div className="w-2 h-2 rounded-full bg-accent-400 shadow-glow-accent" />
            ) : (
              <div className="w-2 h-2 rounded-full bg-yellow-400 animate-pulse" />
            )}
          </div>
        </div>

        <button className="btn-icon opacity-0 group-hover:opacity-100 transition-opacity">
          <ExternalLink className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
}
