import React, { useState } from 'react';
import { useWalletStore, type ActiveView } from '@/stores/walletStore';
import {
  LayoutDashboard, Send, Download, ArrowLeftRight, History, Settings, Zap, Coins,
  LogOut, TrendingUp, ArrowUpRight, ArrowDownLeft, Copy, Check,
  ChevronDown, Loader2, Search, Info,
  ArrowRight, QrCode, Share2, User, Shield, Bell, Globe, Moon,
  ChevronRight, Hexagon, Image, Rocket,
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

// ── Sub-views ───────────────────────────────────────────────────────────────

const DashboardView: React.FC = () => {
  const { totalBalance, tokens, transactions, setActiveView } = useWalletStore();
  return (
    <div className="space-y-6">
      {/* Balance card */}
      <div className="bg-gradient-to-br from-orange-600/20 to-purple-600/20 border border-[#1a1a1a] rounded-2xl p-6">
        <p className="text-gray-400 text-sm mb-1">Total Balance</p>
        <h2 className="text-3xl font-bold text-white">{fmtUSD(totalBalance)}</h2>
        <div className="flex items-center gap-1 mt-1 text-green-400 text-sm"><TrendingUp className="w-3 h-3" /> +3.42% today</div>
      </div>
      {/* Quick actions */}
      <div className="grid grid-cols-4 gap-3">
        {([['send', 'Send', Send], ['receive', 'Receive', Download], ['swap', 'Swap', ArrowLeftRight], ['comit', 'Comit', Zap]] as const).map(([v, l, I]) => (
          <button key={v} onClick={() => setActiveView(v)} className="flex flex-col items-center gap-2 bg-[#111111] border border-[#1a1a1a] rounded-xl p-4 hover:border-orange-500/50 transition-colors">
            <I className="w-5 h-5 text-orange-400" /><span className="text-xs text-gray-300">{l}</span>
          </button>
        ))}
      </div>
      {/* Token list */}
      <div>
        <h3 className="text-sm font-semibold text-gray-300 mb-3">Assets</h3>
        <div className="space-y-2">
          {tokens.map((t) => (
            <div key={t.symbol} className="flex items-center justify-between bg-[#111111] border border-[#1a1a1a] rounded-xl px-4 py-3">
              <div className="flex items-center gap-3">
                <span className="text-xl w-8 text-center">{t.icon}</span>
                <div><p className="text-sm font-medium text-white">{t.symbol}</p><p className="text-xs text-gray-500">{t.name}</p></div>
              </div>
              <div className="text-right">
                <p className="text-sm text-white">{fmt(t.balance)} {t.symbol}</p>
                <div className="flex items-center justify-end gap-1 text-xs">
                  <span className="text-gray-400">{fmtUSD(t.value)}</span>
                  <span className={t.change24h >= 0 ? 'text-green-400' : 'text-red-400'}>{t.change24h >= 0 ? '+' : ''}{t.change24h}%</span>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
      {/* Recent activity */}
      <div>
        <h3 className="text-sm font-semibold text-gray-300 mb-3">Recent Activity</h3>
        <div className="space-y-2">
          {transactions.slice(0, 3).map((tx) => (
            <div key={tx.id} className="flex items-center justify-between bg-[#111111] border border-[#1a1a1a] rounded-xl px-4 py-3">
              <div className="flex items-center gap-3">
                {txIcon(tx.type)}
                <div><p className="text-sm text-white capitalize">{tx.type}</p><p className="text-xs text-gray-500">{timeAgo(tx.timestamp)}</p></div>
              </div>
              <div className="text-right">
                <p className="text-sm text-white">{tx.type === 'receive' ? '+' : '-'}{fmt(tx.amount)} {tx.symbol}</p>
                <p className={`text-xs ${statusColor[tx.status]}`}>{tx.status}</p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

const SendView: React.FC = () => {
  const { tokens } = useWalletStore();
  const [selectedToken, setSelectedToken] = useState(0);
  const [recipient, setRecipient] = useState('');
  const [amount, setAmount] = useState('');
  const [sending, setSending] = useState(false);
  const [showDropdown, setShowDropdown] = useState(false);
  const token = tokens[selectedToken];
  return (
    <div className="space-y-5 max-w-md">
      <h2 className="text-lg font-semibold text-white">Send Tokens</h2>
      {/* Token selector */}
      <div>
        <label className="text-xs text-gray-400 mb-1 block">Token</label>
        <div className="relative">
          <button onClick={() => setShowDropdown(!showDropdown)} className="w-full flex items-center justify-between bg-[#111111] border border-[#1a1a1a] rounded-lg px-4 py-3 text-white">
            <span>{token?.icon} {token?.symbol}</span><ChevronDown className="w-4 h-4 text-gray-500" />
          </button>
          {showDropdown && (
            <div className="absolute z-10 mt-1 w-full bg-[#111111] border border-[#1a1a1a] rounded-lg overflow-hidden">
              {tokens.map((t, i) => (
                <button key={t.symbol} onClick={() => { setSelectedToken(i); setShowDropdown(false); }} className="w-full flex items-center gap-2 px-4 py-2 hover:bg-[#1a1a1a] text-sm text-white">
                  <span>{t.icon}</span>{t.symbol}<span className="ml-auto text-gray-500">{fmt(t.balance)}</span>
                </button>
              ))}
            </div>
          )}
        </div>
      </div>
      {/* Recipient */}
      <div>
        <label className="text-xs text-gray-400 mb-1 block">Recipient Address</label>
        <input value={recipient} onChange={(e) => setRecipient(e.target.value)} placeholder="0x… or 5G…" className="w-full bg-[#111111] border border-[#1a1a1a] rounded-lg px-4 py-3 text-white text-sm placeholder:text-gray-600 focus:border-orange-500/50 outline-none" />
      </div>
      {/* Amount */}
      <div>
        <label className="text-xs text-gray-400 mb-1 block">Amount</label>
        <div className="relative">
          <input value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="0.00" type="number" className="w-full bg-[#111111] border border-[#1a1a1a] rounded-lg px-4 py-3 pr-16 text-white text-sm placeholder:text-gray-600 focus:border-orange-500/50 outline-none" />
          <button onClick={() => setAmount(String(token?.balance ?? 0))} className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-orange-400 hover:text-orange-300">MAX</button>
        </div>
        <p className="text-xs text-gray-500 mt-1">Balance: {fmt(token?.balance ?? 0)} {token?.symbol}</p>
      </div>
      {/* Fee estimate */}
      <div className="bg-[#111111] border border-[#1a1a1a] rounded-lg p-4 space-y-2 text-sm">
        <div className="flex justify-between text-gray-400"><span>Network Fee</span><span className="text-white">~0.002 ETH</span></div>
        <div className="flex justify-between text-gray-400"><span>Estimated Time</span><span className="text-white">~15 sec</span></div>
      </div>
      {/* Send button */}
      <button disabled={sending || !recipient || !amount} onClick={() => { setSending(true); setTimeout(() => setSending(false), 2000); }} className="w-full flex items-center justify-center gap-2 bg-orange-500 hover:bg-orange-600 disabled:opacity-40 text-white font-medium rounded-lg py-3 transition-colors">
        {sending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}{sending ? 'Sending…' : 'Send'}
      </button>
    </div>
  );
};

const ReceiveView: React.FC = () => {
  const { accounts, activeAccountIndex } = useWalletStore();
  const [network, setNetwork] = useState<'evm' | 'svm' | 'substrate'>('evm');
  const [copied, setCopied] = useState(false);
  const addr = accounts[activeAccountIndex]?.address ?? '';
  const copy = () => { navigator.clipboard.writeText(addr).catch(() => {}); setCopied(true); setTimeout(() => setCopied(false), 2000); };
  return (
    <div className="space-y-5 max-w-md">
      <h2 className="text-lg font-semibold text-white">Receive Tokens</h2>
      {/* Network tabs */}
      <div className="flex gap-2">
        {(['evm', 'svm', 'substrate'] as const).map((n) => (
          <button key={n} onClick={() => setNetwork(n)} className={`px-4 py-1.5 rounded-lg text-xs font-medium transition-colors ${network === n ? 'bg-orange-500/20 text-orange-400 border border-orange-500/40' : 'bg-[#111111] text-gray-400 border border-[#1a1a1a] hover:border-[#333]'}`}>{n.toUpperCase()}</button>
        ))}
      </div>
      {/* QR placeholder */}
      <div className="flex items-center justify-center bg-gradient-to-br from-orange-500/10 to-purple-500/10 border border-[#1a1a1a] rounded-2xl h-48">
        <QrCode className="w-16 h-16 text-gray-600" />
      </div>
      {/* Address */}
      <div className="bg-[#111111] border border-[#1a1a1a] rounded-lg p-4">
        <p className="text-xs text-gray-500 mb-1">Your {network.toUpperCase()} Address</p>
        <p className="text-sm text-white font-mono break-all">{addr}</p>
      </div>
      {/* Actions */}
      <div className="flex gap-3">
        <button onClick={copy} className="flex-1 flex items-center justify-center gap-2 bg-[#111111] border border-[#1a1a1a] rounded-lg py-3 text-sm text-white hover:border-orange-500/50 transition-colors">
          {copied ? <Check className="w-4 h-4 text-green-400" /> : <Copy className="w-4 h-4" />}{copied ? 'Copied' : 'Copy'}
        </button>
        <button className="flex-1 flex items-center justify-center gap-2 bg-[#111111] border border-[#1a1a1a] rounded-lg py-3 text-sm text-white hover:border-orange-500/50 transition-colors">
          <Share2 className="w-4 h-4" />Share
        </button>
      </div>
    </div>
  );
};

const SwapView: React.FC = () => {
  const { tokens } = useWalletStore();
  const [fromIdx, setFromIdx] = useState(0);
  const [toIdx, setToIdx] = useState(1);
  const [fromAmt, setFromAmt] = useState('');
  const [slippage, setSlippage] = useState('0.5');
  const [swapping, setSwapping] = useState(false);
  const fromToken = tokens[fromIdx];
  const toToken = tokens[toIdx];
  const flip = () => { setFromIdx(toIdx); setToIdx(fromIdx); };
  return (
    <div className="space-y-4 max-w-md">
      <h2 className="text-lg font-semibold text-white">Swap Tokens</h2>
      {/* From */}
      <div className="bg-[#111111] border border-[#1a1a1a] rounded-xl p-4">
        <div className="flex justify-between text-xs text-gray-500 mb-2"><span>From</span><span>Balance: {fmt(fromToken?.balance ?? 0)}</span></div>
        <div className="flex items-center gap-3">
          <input value={fromAmt} onChange={(e) => setFromAmt(e.target.value)} placeholder="0.00" type="number" className="flex-1 bg-transparent text-xl text-white outline-none placeholder:text-gray-600" />
          <select value={fromIdx} onChange={(e) => setFromIdx(Number(e.target.value))} className="bg-[#1a1a1a] text-white text-sm rounded-lg px-3 py-2 outline-none border border-[#333]">
            {tokens.map((t, i) => <option key={t.symbol} value={i}>{t.icon} {t.symbol}</option>)}
          </select>
        </div>
      </div>
      {/* Flip */}
      <div className="flex justify-center -my-2 relative z-10">
        <button onClick={flip} className="bg-[#111111] border border-[#1a1a1a] rounded-full p-2 hover:border-orange-500/50 transition-colors">
          <ArrowLeftRight className="w-4 h-4 text-orange-400 rotate-90" />
        </button>
      </div>
      {/* To */}
      <div className="bg-[#111111] border border-[#1a1a1a] rounded-xl p-4">
        <div className="flex justify-between text-xs text-gray-500 mb-2"><span>To</span></div>
        <div className="flex items-center gap-3">
          <p className="flex-1 text-xl text-gray-400">{fromAmt ? (parseFloat(fromAmt) * (fromToken?.value ?? 1) / (toToken?.value ?? 1)).toFixed(4) : '0.00'}</p>
          <select value={toIdx} onChange={(e) => setToIdx(Number(e.target.value))} className="bg-[#1a1a1a] text-white text-sm rounded-lg px-3 py-2 outline-none border border-[#333]">
            {tokens.map((t, i) => <option key={t.symbol} value={i}>{t.icon} {t.symbol}</option>)}
          </select>
        </div>
      </div>
      {/* Rate / Slippage */}
      <div className="bg-[#111111] border border-[#1a1a1a] rounded-lg p-4 text-sm space-y-2">
        <div className="flex justify-between text-gray-400"><span>Rate</span><span className="text-white">1 {fromToken?.symbol} ≈ {((fromToken?.value ?? 1) / (toToken?.value ?? 1)).toFixed(4)} {toToken?.symbol}</span></div>
        <div className="flex justify-between text-gray-400 items-center">
          <span>Slippage</span>
          <div className="flex gap-1">
            {['0.1', '0.5', '1.0'].map((s) => (
              <button key={s} onClick={() => setSlippage(s)} className={`px-2 py-0.5 rounded text-xs ${slippage === s ? 'bg-orange-500/20 text-orange-400' : 'bg-[#1a1a1a] text-gray-400'}`}>{s}%</button>
            ))}
          </div>
        </div>
      </div>
      <button disabled={swapping || !fromAmt} onClick={() => { setSwapping(true); setTimeout(() => setSwapping(false), 2000); }} className="w-full flex items-center justify-center gap-2 bg-orange-500 hover:bg-orange-600 disabled:opacity-40 text-white font-medium rounded-lg py-3 transition-colors">
        {swapping ? <Loader2 className="w-4 h-4 animate-spin" /> : <ArrowLeftRight className="w-4 h-4" />}{swapping ? 'Swapping…' : 'Swap'}
      </button>
    </div>
  );
};

const HistoryView: React.FC = () => {
  const { transactions } = useWalletStore();
  const [filter, setFilter] = useState<string>('all');
  const [search, setSearch] = useState('');
  const filters = ['all', 'send', 'receive', 'swap', 'comit'];
  const filtered = transactions.filter((tx) => (filter === 'all' || tx.type === filter) && (!search || tx.hash.toLowerCase().includes(search.toLowerCase())));
  return (
    <div className="space-y-5">
      <h2 className="text-lg font-semibold text-white">Transaction History</h2>
      {/* Filters */}
      <div className="flex gap-2 flex-wrap">
        {filters.map((f) => (
          <button key={f} onClick={() => setFilter(f)} className={`px-3 py-1 rounded-lg text-xs font-medium capitalize transition-colors ${filter === f ? 'bg-orange-500/20 text-orange-400 border border-orange-500/40' : 'bg-[#111111] text-gray-400 border border-[#1a1a1a]'}`}>{f}</button>
        ))}
      </div>
      {/* Search */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
        <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search by hash…" className="w-full bg-[#111111] border border-[#1a1a1a] rounded-lg pl-10 pr-4 py-2.5 text-sm text-white placeholder:text-gray-600 outline-none focus:border-orange-500/50" />
      </div>
      {/* List */}
      <div className="space-y-2">
        {filtered.length === 0 && <p className="text-gray-500 text-sm text-center py-8">No transactions found.</p>}
        {filtered.map((tx) => (
          <div key={tx.id} className="flex items-center justify-between bg-[#111111] border border-[#1a1a1a] rounded-xl px-4 py-3">
            <div className="flex items-center gap-3">
              {txIcon(tx.type)}
              <div>
                <p className="text-sm text-white capitalize">{tx.type}</p>
                <p className="text-xs text-gray-500 font-mono">{shortHash(tx.hash)}</p>
              </div>
            </div>
            <div className="text-right">
              <p className="text-sm text-white">{tx.type === 'receive' ? '+' : '-'}{fmt(tx.amount)} {tx.symbol}</p>
              <div className="flex items-center justify-end gap-2 text-xs">
                <span className={statusColor[tx.status]}>{tx.status}</span>
                <span className="text-gray-600">{timeAgo(tx.timestamp)}</span>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

const SettingsView: React.FC = () => {
  const groups: { title: string; Icon: React.FC<any>; items: { label: string; desc: string; toggle?: boolean }[] }[] = [
    { title: 'Profile', Icon: User, items: [{ label: 'Display Name', desc: 'Demo Wallet' }, { label: 'Default Network', desc: 'EVM' }] },
    { title: 'Security', Icon: Shield, items: [{ label: 'Biometric Lock', desc: 'Enable fingerprint/face unlock', toggle: true }, { label: 'Auto-lock Timer', desc: '5 minutes' }, { label: 'Export Private Key', desc: 'Backup your keys' }] },
    { title: 'Notifications', Icon: Bell, items: [{ label: 'Transaction Alerts', desc: 'Push notifications for txns', toggle: true }, { label: 'Price Alerts', desc: 'Notify on price changes', toggle: true }] },
    { title: 'Network', Icon: Globe, items: [{ label: 'RPC Endpoint', desc: 'wss://rpc.atlas-sphere.io' }, { label: 'Custom Networks', desc: 'Manage custom chains' }] },
    { title: 'Appearance', Icon: Moon, items: [{ label: 'Dark Mode', desc: 'Always on', toggle: true }] },
  ];
  return (
    <div className="space-y-6">
      <h2 className="text-lg font-semibold text-white">Settings</h2>
      {groups.map(({ title, Icon, items }) => (
        <div key={title}>
          <div className="flex items-center gap-2 mb-3"><Icon className="w-4 h-4 text-orange-400" /><h3 className="text-sm font-medium text-gray-300">{title}</h3></div>
          <div className="bg-[#111111] border border-[#1a1a1a] rounded-xl divide-y divide-[#1a1a1a]">
            {items.map((item) => (
              <div key={item.label} className="flex items-center justify-between px-4 py-3">
                <div><p className="text-sm text-white">{item.label}</p><p className="text-xs text-gray-500">{item.desc}</p></div>
                {item.toggle ? (
                  <div className="w-9 h-5 bg-orange-500 rounded-full relative cursor-pointer"><div className="absolute right-0.5 top-0.5 w-4 h-4 bg-white rounded-full" /></div>
                ) : (
                  <ChevronRight className="w-4 h-4 text-gray-600" />
                )}
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
};

const ComitView: React.FC = () => {
  const [evmPayload, setEvmPayload] = useState('');
  const [svmPayload, setSvmPayload] = useState('');
  const [executing, setExecuting] = useState(false);
  return (
    <div className="space-y-5 max-w-lg">
      <h2 className="text-lg font-semibold text-white">Cross-Chain Comit</h2>
      <p className="text-sm text-gray-400">Bridge assets between EVM and SVM chains using Atlas Comit protocol.</p>
      {/* EVM payload */}
      <div>
        <label className="text-xs text-gray-400 mb-1 block">EVM Payload</label>
        <textarea value={evmPayload} onChange={(e) => setEvmPayload(e.target.value)} rows={3} placeholder='{"to":"0x…","value":"1000000","data":"0x…"}' className="w-full bg-[#111111] border border-[#1a1a1a] rounded-lg px-4 py-3 text-sm text-white font-mono placeholder:text-gray-600 outline-none focus:border-orange-500/50 resize-none" />
      </div>
      {/* Flow diagram */}
      <div className="flex items-center justify-center gap-3 py-3">
        <div className="flex items-center gap-2 bg-[#111111] border border-[#1a1a1a] rounded-lg px-4 py-2"><Hexagon className="w-4 h-4 text-blue-400" /><span className="text-xs text-gray-300">EVM</span></div>
        <ArrowRight className="w-4 h-4 text-orange-400" />
        <div className="flex items-center gap-2 bg-orange-500/10 border border-orange-500/30 rounded-lg px-4 py-2"><Zap className="w-4 h-4 text-orange-400" /><span className="text-xs text-orange-300">Comit</span></div>
        <ArrowRight className="w-4 h-4 text-orange-400" />
        <div className="flex items-center gap-2 bg-[#111111] border border-[#1a1a1a] rounded-lg px-4 py-2"><Hexagon className="w-4 h-4 text-purple-400" /><span className="text-xs text-gray-300">SVM</span></div>
      </div>
      {/* SVM payload */}
      <div>
        <label className="text-xs text-gray-400 mb-1 block">SVM Payload</label>
        <textarea value={svmPayload} onChange={(e) => setSvmPayload(e.target.value)} rows={3} placeholder='{"programId":"…","accounts":[],"data":"…"}' className="w-full bg-[#111111] border border-[#1a1a1a] rounded-lg px-4 py-3 text-sm text-white font-mono placeholder:text-gray-600 outline-none focus:border-orange-500/50 resize-none" />
      </div>
      {/* Fee */}
      <div className="bg-[#111111] border border-[#1a1a1a] rounded-lg p-4 text-sm space-y-2">
        <div className="flex justify-between text-gray-400"><span>Bridge Fee</span><span className="text-white">0.1%</span></div>
        <div className="flex justify-between text-gray-400"><span>Estimated Time</span><span className="text-white">~45 sec</span></div>
        <div className="flex items-center gap-1 text-xs text-gray-500"><Info className="w-3 h-3" />Comit verifies both payloads atomically</div>
      </div>
      <button disabled={executing || !evmPayload || !svmPayload} onClick={() => { setExecuting(true); setTimeout(() => setExecuting(false), 3000); }} className="w-full flex items-center justify-center gap-2 bg-orange-500 hover:bg-orange-600 disabled:opacity-40 text-white font-medium rounded-lg py-3 transition-colors">
        {executing ? <Loader2 className="w-4 h-4 animate-spin" /> : <Zap className="w-4 h-4" />}{executing ? 'Executing Comit…' : 'Execute Comit'}
      </button>
    </div>
  );
};

const MintView: React.FC = () => {
  const [name, setName] = useState('');
  const [symbol, setSymbol] = useState('');
  const [decimals, setDecimals] = useState('18');
  const [supply, setSupply] = useState('');
  const [network, setNetwork] = useState<'evm' | 'svm'>('evm');
  const [minting, setMinting] = useState(false);
  return (
    <div className="space-y-5 max-w-md">
      <h2 className="text-lg font-semibold text-white">Create Token</h2>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="text-xs text-gray-400 mb-1 block">Token Name</label>
          <input value={name} onChange={(e) => setName(e.target.value)} placeholder="My Token" className="w-full bg-[#111111] border border-[#1a1a1a] rounded-lg px-4 py-3 text-sm text-white placeholder:text-gray-600 outline-none focus:border-orange-500/50" />
        </div>
        <div>
          <label className="text-xs text-gray-400 mb-1 block">Symbol</label>
          <input value={symbol} onChange={(e) => setSymbol(e.target.value)} placeholder="MTK" className="w-full bg-[#111111] border border-[#1a1a1a] rounded-lg px-4 py-3 text-sm text-white placeholder:text-gray-600 outline-none focus:border-orange-500/50" />
        </div>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="text-xs text-gray-400 mb-1 block">Decimals</label>
          <input value={decimals} onChange={(e) => setDecimals(e.target.value)} type="number" className="w-full bg-[#111111] border border-[#1a1a1a] rounded-lg px-4 py-3 text-sm text-white outline-none focus:border-orange-500/50" />
        </div>
        <div>
          <label className="text-xs text-gray-400 mb-1 block">Total Supply</label>
          <input value={supply} onChange={(e) => setSupply(e.target.value)} placeholder="1,000,000" type="number" className="w-full bg-[#111111] border border-[#1a1a1a] rounded-lg px-4 py-3 text-sm text-white placeholder:text-gray-600 outline-none focus:border-orange-500/50" />
        </div>
      </div>
      {/* Network */}
      <div>
        <label className="text-xs text-gray-400 mb-1 block">Network</label>
        <div className="flex gap-2">
          {(['evm', 'svm'] as const).map((n) => (
            <button key={n} onClick={() => setNetwork(n)} className={`flex-1 py-2 rounded-lg text-sm font-medium transition-colors ${network === n ? 'bg-orange-500/20 text-orange-400 border border-orange-500/40' : 'bg-[#111111] text-gray-400 border border-[#1a1a1a]'}`}>{n.toUpperCase()}</button>
          ))}
        </div>
      </div>
      {/* Icon upload placeholder */}
      <div>
        <label className="text-xs text-gray-400 mb-1 block">Token Icon</label>
        <div className="flex items-center justify-center bg-[#111111] border border-dashed border-[#333] rounded-xl h-24 cursor-pointer hover:border-orange-500/50 transition-colors">
          <div className="text-center"><Image className="w-6 h-6 text-gray-500 mx-auto mb-1" /><p className="text-xs text-gray-500">Click to upload</p></div>
        </div>
      </div>
      <button disabled={minting || !name || !symbol || !supply} onClick={() => { setMinting(true); setTimeout(() => setMinting(false), 2000); }} className="w-full flex items-center justify-center gap-2 bg-orange-500 hover:bg-orange-600 disabled:opacity-40 text-white font-medium rounded-lg py-3 transition-colors">
        {minting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Rocket className="w-4 h-4" />}{minting ? 'Minting…' : 'Mint Token'}
      </button>
    </div>
  );
};

// ── View map ────────────────────────────────────────────────────────────────

const views: Record<ActiveView, React.FC> = {
  dashboard: DashboardView,
  send: SendView,
  receive: ReceiveView,
  swap: SwapView,
  history: HistoryView,
  settings: SettingsView,
  comit: ComitView,
  mint: MintView,
};

// ── Main WalletPanel ────────────────────────────────────────────────────────

const WalletPanel: React.FC = () => {
  const { activeView, setActiveView, disconnect, accounts, activeAccountIndex } = useWalletStore();
  const ActiveComponent = views[activeView];
  const account = accounts[activeAccountIndex];

  return (
    <div className="flex h-full bg-[#0a0a0f] text-white">
      {/* Sidebar */}
      <aside className="w-48 flex flex-col border-r border-[#1a1a1a] bg-[#0a0a0f]">
        {/* Account badge */}
        <div className="p-4 border-b border-[#1a1a1a]">
          <p className="text-sm font-medium text-white truncate">{account?.name ?? 'Wallet'}</p>
          <p className="text-xs text-gray-500 font-mono truncate">{account ? `${account.address.slice(0, 6)}…${account.address.slice(-4)}` : '—'}</p>
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
    </div>
  );
};

export default WalletPanel;
