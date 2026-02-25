import React, { useState, useEffect } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { useWalletStore, type ActiveView } from '@/stores/walletStore';
import QRCode from 'qrcode';
import {
  LayoutDashboard, Send, Download, ArrowLeftRight, History, Settings, Zap, Coins,
  LogOut, TrendingUp, ArrowUpRight, ArrowDownLeft, Copy, Users, ShieldAlert,
  ChevronDown, Loader2, Rocket, Globe, Hexagon, Fingerprint, Key, Cpu, Layers, BookOpen,
  ChevronRight, Shield, PieChart, LineChart, Search, Sparkles, Activity, AlertTriangle, Gauge,
  Lock, HardDrive, Eye, LifeBuoy
} from 'lucide-react';

const DashboardView = () => {
  const { tokens = [] } = useWalletStore();
  const [viewMode, setViewMode] = React.useState<'list' | 'galaxy'>('galaxy');

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="md:col-span-2 bg-gradient-to-br from-[#111] via-[#151515] to-[#0a0a0f] border border-[#222] p-6 rounded-3xl shadow-2xl relative overflow-hidden group">
          <div className="absolute top-0 right-0 p-8 opacity-20 pointer-events-none group-hover:scale-110 transition-transform duration-1000">
            <Globe className="w-48 h-48 text-blue-500/20 animate-spin-slow" />
          </div>
          <div className="relative z-10 flex justify-between items-start">
            <div>
              <p className="text-gray-400 text-sm font-bold tracking-wide uppercase">Net Worth</p>
              <h2 className="text-5xl font-bold text-white mt-2 mb-2 tracking-tight bg-clip-text text-transparent bg-gradient-to-r from-white to-gray-500">
                ${tokens.reduce((a, b) => a + (b.value || 0), 0).toLocaleString('en-US', { minimumFractionDigits: 2 })}
              </h2>
              <div className="flex items-center gap-2 text-sm">
                <TrendingUp className="w-4 h-4 text-green-400" />
                <span className="text-green-400 font-bold">+2.4%</span>
                <span className="text-gray-500">+$339.42 Last 24h</span>
              </div>
            </div>
            
            <div className="flex bg-[#222] rounded-lg p-1 border border-[#333] z-20">
              <button 
                onClick={() => setViewMode('list')} 
                className={`px-3 py-1.5 rounded-md text-[10px] tracking-widest font-bold uppercase transition-all ${viewMode === 'list' ? 'bg-[#333] text-white shadow' : 'text-gray-500 hover:text-white'}`}
              >
                LIST
              </button>
              <button 
                onClick={() => setViewMode('galaxy')} 
                className={`px-3 py-1.5 rounded-md text-[10px] tracking-widest font-bold transition-all flex items-center gap-1 uppercase ${viewMode === 'galaxy' ? 'bg-gradient-to-r from-purple-500 to-indigo-500 text-white shadow' : 'text-gray-500 hover:text-white'}`}
              >
                <Sparkles className="w-3 h-3" /> GALAXY
              </button>
            </div>
          </div>
        </div>

        <div className="bg-[#111] border border-[#222] p-5 rounded-3xl shadow-xl flex flex-col justify-center relative overflow-hidden">
          <div className="absolute -right-4 -top-4 w-24 h-24 bg-purple-500/10 rounded-full blur-2xl"></div>
          <h3 className="text-gray-400 text-xs font-bold uppercase tracking-wider mb-3 flex items-center gap-2">
            <Activity className="w-4 h-4 text-purple-400" /> AI Insights
          </h3>
          <div className="space-y-3">
             <div className="bg-purple-500/10 border border-purple-500/30 rounded-xl p-3 backdrop-blur-sm cursor-pointer hover:border-purple-400 transition-colors">
               <p className="text-xs text-purple-200">✨ Swap <strong className="text-white">USDC</strong> to <strong className="text-white">ETH</strong> now to save 18% on avg gas fees.</p>
             </div>
             <div className="bg-orange-500/10 border border-orange-500/30 rounded-xl p-3 backdrop-blur-sm cursor-pointer hover:border-orange-400 transition-colors">
               <p className="text-xs text-orange-200">💡 You're heavily exposed to volatile L1s. Consider rotating to Stables.</p>
             </div>
          </div>
        </div>
      </div>

      <div>
        {viewMode === 'list' ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 animate-in fade-in slide-in-from-bottom-4 duration-500">
            {tokens.map((t, i) => (
              <div key={i} className="bg-[#111] border border-[#222] p-5 rounded-2xl flex flex-col hover:border-[#444] hover:bg-[#151515] transition-all cursor-pointer group shadow-lg">
                <div className="flex items-center justify-between mb-4">
                  <div className={`w-12 h-12 rounded-full bg-gradient-to-br ${t.color} flex items-center justify-center text-xl shadow-lg group-hover:scale-110 transition-transform`}>
                    {t.icon}
                  </div>
                  <div className="text-right">
                    <p className="font-bold text-white text-lg">${t.value.toLocaleString()}</p>
                    <p className={`text-xs font-bold ${t.change24h >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                      {t.change24h >= 0 ? '+' : ''}{t.change24h}%
                    </p>
                  </div>
                </div>
                <div>
                   <h4 className="font-bold text-gray-200 text-lg flex items-center gap-2">
                     {t.name}
                     <span className="text-[9px] text-gray-400 uppercase bg-[#222] px-1.5 py-0.5 rounded border border-[#333] tracking-widest">{t.network}</span>
                   </h4>
                   <p className="text-sm text-gray-500 font-medium">{t.balance.toLocaleString()} {t.symbol}</p>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="bg-[#0a0a0f] border border-[#1a1a1a] rounded-3xl h-[450px] flex items-center justify-center relative overflow-hidden animate-in zoom-in-95 duration-700 shadow-[inset_0_0_100px_rgba(0,0,0,1)]">
             <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,rgba(255,255,255,0.03)_0%,transparent_70%)]"></div>
             
             {/* Center Black Hole / Wallet Core */}
             <div className="w-24 h-24 rounded-full bg-gradient-to-tr from-indigo-900 to-black border-4 border-indigo-500/30 shadow-[0_0_100px_rgba(99,102,241,0.5)] z-10 flex items-center justify-center animate-pulse">
               <Shield className="w-8 h-8 text-indigo-400" />
             </div>
             
             {/* Orbiting assets - Absolute positioning to simulate orbits */}
             <div className="absolute inset-0 animate-spin-slow" style={{ animationDuration: '40s' }}>
                <div className="absolute top-[20%] left-[20%] w-32 h-32 rounded-full bg-gradient-to-br from-blue-500 to-indigo-500 shadow-[0_0_50px_rgba(59,130,246,0.6)] flex items-center justify-center text-5xl hover:scale-125 transition-transform cursor-pointer border-4 border-black/50" title="Ethereum: $8,304">
                  ◆
                  <div className="absolute -bottom-8 bg-black/80 backdrop-blur text-gray-300 text-xs px-3 py-1.5 rounded-lg border border-white/10 font-bold whitespace-nowrap shadow-xl" style={{ animation: 'spin 40s linear infinite reverse' }}>
                    ETH <span className="text-white ml-2">$8.3K</span>
                  </div>
                </div>
             </div>

             <div className="absolute inset-0 animate-spin-slow" style={{ animationDuration: '60s', animationDirection: 'reverse' }}>
                <div className="absolute bottom-[20%] right-[30%] w-24 h-24 rounded-full bg-gradient-to-br from-orange-500 to-yellow-500 shadow-[0_0_40px_rgba(249,115,22,0.6)] flex items-center justify-center text-4xl hover:scale-125 transition-transform cursor-pointer border-4 border-black/50" title="X3 Sphere: $3,750">
                  ⭐
                  <div className="absolute -bottom-8 bg-black/80 backdrop-blur text-gray-300 text-xs px-3 py-1.5 rounded-lg border border-white/10 font-bold whitespace-nowrap shadow-xl" style={{ animation: 'spin 60s linear infinite forwards' }}>
                    X3 <span className="text-white ml-2">$3.7K</span>
                  </div>
                </div>
             </div>

             <div className="absolute inset-0 animate-spin-slow" style={{ animationDuration: '25s' }}>
                <div className="absolute top-[30%] right-[20%] w-16 h-16 rounded-full bg-gradient-to-br from-purple-500 to-pink-500 shadow-[0_0_30px_rgba(168,85,247,0.6)] flex items-center justify-center text-2xl hover:scale-125 transition-transform cursor-pointer border-4 border-black/50" title="Solana: $1,580">
                  ◎
                  <div className="absolute -bottom-8 bg-black/80 backdrop-blur text-gray-300 text-[10px] px-2 py-1 rounded-lg border border-white/10 font-bold whitespace-nowrap shadow-xl" style={{ animation: 'spin 25s linear infinite reverse' }}>
                    SOL <span className="text-white ml-1">$1.5K</span>
                  </div>
                </div>
             </div>

             <div className="absolute inset-0 animate-spin-slow" style={{ animationDuration: '50s', animationDirection: 'reverse' }}>
                <div className="absolute bottom-[30%] left-[25%] w-12 h-12 rounded-full bg-gradient-to-br from-green-500 to-emerald-500 shadow-[0_0_20px_rgba(16,185,129,0.6)] flex items-center justify-center text-lg hover:scale-125 transition-transform cursor-pointer border-4 border-black/50" title="USDC: $500">
                  $
                  <div className="absolute -bottom-8 bg-black/80 backdrop-blur text-gray-300 text-[10px] px-2 py-1 rounded-lg border border-white/10 font-bold whitespace-nowrap shadow-xl" style={{ animation: 'spin 50s linear infinite forwards' }}>
                    USDC
                  </div>
                </div>
             </div>

          </div>
        )}
      </div>
    </div>
  );
};

const SendView = () => (
  <div className="max-w-4xl mx-auto mt-8 animate-in slide-in-from-bottom-4 fade-in duration-500">
    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
      <div className="bg-[#111] border border-[#222] rounded-3xl p-6 shadow-2xl">
        <div className="mb-8 flex items-center gap-3">
          <div className="p-3 bg-purple-500/20 rounded-xl"><Send className="w-6 h-6 text-purple-400" /></div>
          <div>
            <h2 className="text-2xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-orange-400 to-purple-500">Transfer Tokens</h2>
            <p className="text-gray-400 text-sm mt-1">Cross-chain visual routing UI.</p>
          </div>
        </div>
        
        <div className="space-y-5">
          <div>
            <label className="text-xs font-bold text-gray-500 mb-2 block uppercase tracking-wider">Recipient Contact</label>
            <input type="text" placeholder="ENS, Address, or Contact..." className="w-full bg-[#1a1a1a] border border-[#333] rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-purple-500 transition-colors text-white shadow-inner" />
          </div>
          
          <div className="flex gap-4">
            <div className="flex-1">
              <label className="text-xs font-bold text-gray-500 mb-2 block uppercase tracking-wider">Asset</label>
              <div className="relative">
                <select className="w-full bg-[#1a1a1a] border border-[#333] rounded-xl pl-10 py-3 text-sm appearance-none focus:outline-none focus:border-purple-500 transition-colors text-white shadow-inner">
                  <option>Ethereum (ETH)</option>
                  <option>X3 (X3)</option>
                </select>
                <Globe className="absolute left-3 top-3 w-4 h-4 text-purple-400 pointer-events-none" />
              </div>
            </div>
            <div className="flex-[0.6]">
              <label className="text-xs font-bold text-gray-500 mb-2 block uppercase tracking-wider">Amount</label>
              <div className="relative">
                <input type="number" placeholder="0.00" className="w-full bg-[#1a1a1a] border border-[#333] rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-purple-500 transition-colors text-white shadow-inner" />
              </div>
            </div>
          </div>

          <div className="pt-2">
            <label className="text-xs font-bold text-gray-500 mb-3 flex items-center justify-between uppercase tracking-wider">
              <span className="flex items-center gap-1"><Gauge className="w-4 h-4 text-gray-400" /> Gas Velocity</span>
              <span className="text-indigo-400 border border-indigo-500/30 bg-indigo-500/10 px-2 py-0.5 rounded">TURBO (~8s)</span>
            </label>
            <input type="range" className="w-full accent-indigo-500 h-2 bg-[#222] rounded-lg appearance-none cursor-pointer" />
            <div className="flex justify-between text-[10px] text-gray-600 font-bold mt-2 uppercase tracking-widest">
               <span className="hover:text-white cursor-pointer transition-colors">Slow</span>
               <span className="hover:text-white cursor-pointer transition-colors">Standard</span>
               <span className="text-indigo-400">Turbo</span>
            </div>
          </div>
        </div>
      </div>

      <div className="bg-gradient-to-b from-[#111] to-[#0a0a0f] border border-[#222] rounded-3xl p-6 shadow-xl flex flex-col justify-between relative overflow-hidden group">
        <div className="absolute top-0 right-[-20%] p-4 opacity-5 pointer-events-none group-hover:scale-110 transition-transform duration-700">
           <Hexagon className="w-96 h-96 text-white rotate-12" />
        </div>
        <div className="relative z-10">
          <h3 className="text-sm font-bold text-gray-400 flex items-center gap-2 mb-4 uppercase tracking-widest">
            <Activity className="w-4 h-4 text-blue-400" /> Pre-Flight Simulation
          </h3>
          
          <div className="p-1.5 bg-[#1a1a1a]/80 rounded-2xl border border-[#333] backdrop-blur space-y-1 shadow-inner">
             <div className="p-3 hover:bg-[#222] rounded-xl transition-colors flex justify-between items-center text-sm">
               <span className="text-gray-400">Action</span>
               <span className="text-white font-bold flex items-center gap-1"><ArrowUpRight className="w-4 h-4 text-red-400"/> Send</span>
             </div>
             <div className="p-3 hover:bg-[#222] rounded-xl transition-colors flex justify-between items-center text-sm">
               <span className="text-gray-400">State Change</span>
               <span className="text-red-400 font-bold">-0.5 ETH</span>
             </div>
             <div className="p-3 hover:bg-[#222] rounded-xl transition-colors flex justify-between items-center text-sm">
               <span className="text-gray-400">Projected Balance</span>
               <span className="text-white font-bold tracking-wider">1.95 ETH</span>
             </div>
             <div className="p-3 hover:bg-[#222] rounded-xl transition-colors flex justify-between items-center text-sm border-t border-[#333]">
               <span className="text-gray-400 flex items-center gap-1"><AlertTriangle className="w-4 h-4 text-orange-400"/> Est. Network Fee</span>
               <span className="text-orange-400 font-mono font-bold">~$2.45</span>
             </div>
          </div>
        </div>

        <div className="mt-8 relative z-10">
           <div className="flex items-center gap-2 mb-4 bg-green-500/10 border border-green-500/20 text-green-400 p-3 rounded-xl text-xs font-bold shadow-inner">
             <Shield className="w-5 h-5" /> Contract scanned visually. No honeypots detected. Safe to execute.
           </div>
           
           <button className="w-full flex items-center justify-center gap-2 bg-gradient-to-r from-indigo-500 to-purple-600 hover:from-indigo-400 hover:to-purple-500 text-white font-bold rounded-xl py-4 transition-all hover:scale-[1.02] active:scale-[0.98] shadow-[0_0_20px_rgba(99,102,241,0.4)] text-lg">
             <Rocket className="w-5 h-5" /> Sign & Execute
           </button>
        </div>
      </div>
    </div>
  </div>
);

const ReceiveView = ({ address, qrCode }: { address?: string, qrCode?: string }) => {
  const displayAddress = address || '0x742d35Cc6634C0532925a3b844Bc9e7595f12ABC';
  return (
    <div className="max-w-md mx-auto mt-8 animate-in zoom-in-95 fade-in duration-500">
      <div className="bg-[#111] border border-[#222] rounded-2xl p-6 text-center shadow-2xl relative overflow-hidden">
        <div className="mb-6 relative z-10">
          <h2 className="text-2xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-green-400 to-blue-500">Receive Token</h2>
          <p className="text-gray-400 text-sm mt-1">Use this address to receive funds globally.</p>
        </div>
        <div className="bg-white p-4 rounded-xl inline-block mb-6 shadow-inner relative z-10 border-4 border-white/10">
          {qrCode ? (
            <img src={qrCode} alt="Wallet QR" className="w-48 h-48" />
          ) : (
            <div className="w-48 h-48 bg-gray-200 flex items-center justify-center text-gray-400 border-2 border-dashed border-gray-300 rounded">
              Generate Wallet First
            </div>
          )}
        </div>
        <div className="bg-[#1a1a1a] rounded-lg p-3 border border-[#333] flex items-center justify-between group hover:border-[#444] transition-colors cursor-pointer relative z-10" onClick={() => navigator.clipboard.writeText(displayAddress)}>
          <span className="font-mono text-xs text-gray-300 truncate w-[250px]">{displayAddress}</span>
          <Copy className="w-4 h-4 text-gray-500 group-hover:text-white transition-colors" />
        </div>
      </div>
    </div>
  );
};

const SwapView = () => (
   <div className="max-w-md mx-auto mt-8 animate-in slide-in-from-right-4 fade-in duration-500">
     <div className="bg-[#111] border border-[#222] rounded-2xl p-6 shadow-2xl relative">
      <div className="mb-6">
        <h2 className="text-2xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-blue-400 to-indigo-500">Cross-Chain Swap</h2>
        <p className="text-gray-400 text-sm mt-1">Zero-slippage swaps via X3 atomic router.</p>
      </div>
      <div className="relative space-y-2">
        <div className="bg-[#1a1a1a] border border-[#333] rounded-xl p-4">
          <label className="text-xs font-medium text-gray-400 mb-2 block">You Pay</label>
          <div className="flex justify-between items-center">
            <input type="number" placeholder="0" className="bg-transparent text-2xl font-bold w-1/2 focus:outline-none placeholder-gray-600 text-white" />
            <div className="bg-[#222] flex items-center gap-2 px-3 py-1.5 rounded-lg border border-[#333] cursor-pointer hover:bg-[#333] transition-colors">
              <span className="text-lg">◆</span>
              <span className="font-bold text-white">ETH</span>
              <ChevronDown className="w-4 h-4 text-gray-400" />
            </div>
          </div>
        </div>
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-10">
          <button className="bg-[#222] border-4 border-[#111] text-indigo-400 p-2 rounded-full hover:bg-indigo-500 hover:text-white transition-colors group">
            <ArrowDownLeft className="w-5 h-5 rotate-45 group-active:rotate-[225deg] transition-transform duration-300" />
          </button>
        </div>
        <div className="bg-[#1a1a1a] border border-[#333] rounded-xl p-4">
          <label className="text-xs font-medium text-gray-400 mb-2 block">You Receive</label>
          <div className="flex justify-between items-center">
            <input type="number" placeholder="0" className="bg-transparent text-2xl font-bold w-1/2 focus:outline-none placeholder-gray-600 text-white" />
            <div className="bg-orange-500/20 text-orange-400 flex items-center gap-2 px-3 py-1.5 rounded-lg border border-orange-500/30 cursor-pointer hover:bg-orange-500/30 transition-colors">
              <span className="text-lg">⭐</span>
              <span className="font-bold text-white">X3</span>
              <ChevronDown className="w-4 h-4 text-orange-400" />
            </div>
          </div>
        </div>
      </div>
      <button className="w-full flex items-center justify-center gap-2 bg-gradient-to-r from-blue-500 to-indigo-600 hover:from-blue-600 hover:to-indigo-700 text-white font-bold rounded-lg py-3.5 mt-6 transition-all hover:scale-[1.02] active:scale-[0.98] shadow-lg shadow-blue-500/20">
        <ArrowLeftRight className="w-4 h-4" /> Review Swap
      </button>
    </div>
  </div>
);

const HistoryView = () => {
  const { transactions } = useWalletStore();
  
  return (
    <div className="animate-in fade-in duration-500 max-w-2xl mx-auto">
      <h2 className="text-2xl font-bold mb-6 flex items-center gap-2"><History className="text-gray-400 w-6 h-6"/> Transaction History</h2>
      <div className="bg-[#111] border border-[#222] rounded-xl overflow-hidden shadow-xl">
        {transactions.map((tx, idx) => (
          <div key={tx.id} className={`flex items-center justify-between p-4 hover:bg-[#151515] transition-colors cursor-pointer ${idx !== transactions.length - 1 ? 'border-b border-[#222]' : ''}`}>
             <div className="flex items-center gap-4">
               <div className="bg-[#222] p-3 rounded-full border border-[#333]">
                 {txIcon(tx.type)}
               </div>
               <div>
                  <h4 className="font-bold text-white capitalize">{tx.type}</h4>
                  <p className="text-xs text-gray-500">{tx.time}</p>
               </div>
             </div>
             <div className="text-right">
                <p className="font-bold text-white tracking-wide">
                  {tx.type === 'send' || tx.type === 'comit' ? '-' : '+'}{tx.amount} {tx.symbol}
                </p>
                <div className="flex items-center justify-end gap-1 mt-0.5">
                  <div className={`w-1.5 h-1.5 rounded-full ${tx.status === 'confirmed' ? 'bg-green-400' : 'bg-yellow-400 animate-pulse'}`}></div>
                  <p className={`text-[10px] font-medium uppercase ${statusColor[tx.status]}`}>{tx.status}</p>
                </div>
             </div>
          </div>
        ))}
      </div>
    </div>
  );
};

const ComitView = () => {
  const { comits } = useWalletStore();

  return (
    <div className="animate-in fade-in slide-in-from-bottom-4 duration-500 max-w-4xl mx-auto">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-orange-400 to-red-500 flex items-center gap-2">
            <Zap className="w-6 h-6 text-orange-500" /> X3 Comits
          </h2>
          <p className="text-gray-400 text-sm mt-1">Manage cross-chain conditional executions.</p>
        </div>
        <button className="bg-orange-500/20 text-orange-400 border border-orange-500/30 px-4 py-2 rounded-lg text-sm font-bold hover:bg-orange-500 hover:text-white transition-all shadow-lg hover:shadow-orange-500/20">
          + New Comit
        </button>
      </div>
      
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {comits.map((c) => (
          <div key={c.id} className={`bg-[#111] border border-[#333] hover:border-${c.color}-500/50 p-5 rounded-2xl transition-colors cursor-pointer group shadow-lg`}>
            <div className="flex justify-between items-start mb-4">
              {c.icon === 'Zap' ? <Zap className={`text-${c.color}-400 w-6 h-6 group-hover:scale-110 transition-transform`} /> : <Shield className={`text-${c.color}-400 w-6 h-6 group-hover:scale-110 transition-transform`} />}
              <span className={`bg-${c.status === 'ACTIVE' ? c.color + '-500/20' : '#222'} border border-${c.status === 'ACTIVE' ? c.color + '-500/30' : '#444'} text-${c.status === 'ACTIVE' ? c.color + '-400' : 'gray-400'} text-[10px] font-bold px-2 py-1 rounded`}>
                {c.status}
              </span>
            </div>
            <h3 className={`font-bold text-lg mb-1 group-hover:text-${c.color}-400 transition-colors text-white`}>{c.title}</h3>
            <p className="text-sm text-gray-400 mb-4">{c.description}</p>
            <div className="flex justify-between text-xs text-gray-500 border-t border-[#222] pt-3">
              <span>Total Value: <strong className="text-white">{c.totalValue}</strong></span>
              <span>Runs: <strong className="text-white">{c.runs}</strong></span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

const MintView = () => (
  <div className="max-w-2xl mx-auto mt-4 animate-in fade-in zoom-in-95 duration-500">
    <div className="bg-gradient-to-br from-[#111] to-[#1a1a1a] border border-[#333] rounded-2xl p-8 shadow-2xl relative overflow-hidden">
      <div className="absolute top-0 right-0 p-8 opacity-10 pointer-events-none">
        <Hexagon className="w-48 h-48 text-purple-400 rotate-12" />
      </div>
      <div className="relative z-10">
        <div className="mb-6">
          <h2 className="text-2xl font-bold text-white flex items-center gap-3">
            <Coins className="text-purple-400 w-7 h-7" />
            Token Factory Builder
          </h2>
          <p className="text-gray-400 text-sm mt-2">Deploy your own omni-chain token natively supported across 59k+ networks.</p>
        </div>

        <div className="space-y-5">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="text-xs font-medium text-gray-400 mb-1.5 block">Token Name</label>
              <input type="text" placeholder="e.g. Pepe Sonic" className="w-full bg-[#222] border border-[#333] rounded-lg px-4 py-3 text-sm focus:outline-none focus:border-purple-500 transition-colors text-white" />
            </div>
            <div>
              <label className="text-xs font-medium text-gray-400 mb-1.5 block">Symbol</label>
              <input type="text" placeholder="PEPSO" className="w-full bg-[#222] border border-[#333] rounded-lg px-4 py-3 text-sm focus:outline-none focus:border-purple-500 transition-colors uppercase text-white" />
            </div>
          </div>
          <div>
            <label className="text-xs font-medium text-gray-400 mb-1.5 block">Total Supply</label>
            <input type="number" placeholder="1000000000" className="w-full bg-[#222] border border-[#333] rounded-lg px-4 py-3 text-sm focus:outline-none focus:border-purple-500 transition-colors text-white" />
          </div>
          <div className="bg-[#222] border border-[#333] rounded-lg p-4 flex items-center justify-between group cursor-pointer hover:border-purple-500/50 transition-colors">
            <div>
              <h4 className="text-sm font-bold text-white group-hover:text-purple-400 transition-colors">Cross-Chain Interoperability</h4>
              <p className="text-xs text-gray-400 mt-1">Automatically bridge token to all active EVM L2s.</p>
            </div>
            <div className="w-12 h-6 bg-purple-500 rounded-full relative shadow-inner">
              <div className="absolute right-1 top-1 w-4 h-4 bg-white rounded-full shadow"></div>
            </div>
          </div>
          <button className="w-full flex items-center justify-center gap-2 bg-gradient-to-r from-purple-500 to-pink-600 hover:from-purple-600 hover:to-pink-700 text-white font-bold rounded-lg py-3.5 mt-4 transition-all hover:scale-[1.02] active:scale-[0.98] shadow-lg shadow-purple-500/20">
            <Coins className="w-4 h-4" /> Deploy Token Contract
          </button>
        </div>
      </div>
    </div>
  </div>
);

const PortfolioView = () => {
  const { portfolioTokens } = useWalletStore();

  return (
    <div className="max-w-4xl mx-auto mt-4 animate-in fade-in duration-500">
      <div className="flex justify-between items-end mb-8">
        <div>
          <h2 className="text-2xl font-bold text-white flex items-center gap-2">
            <PieChart className="text-blue-400 w-6 h-6" /> Deployed Portfolios
          </h2>
          <p className="text-sm text-gray-400 mt-2">Manage your custom X3 omni-chain token deployments and LP yields.</p>
        </div>
        <div className="bg-[#111] border border-[#222] px-4 py-2 rounded-xl text-right">
          <p className="text-xs text-gray-500 uppercase font-bold tracking-wider mb-1">Total TVL Locked</p>
          <p className="text-xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-green-400 to-emerald-500">$17,850,000</p>
        </div>
      </div>
      
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {portfolioTokens.map((t, idx) => (
          <div key={idx} className="bg-[#111] border border-[#333] hover:border-[#555] rounded-2xl p-5 transition-all cursor-pointer group shadow-xl">
            <div className={`w-10 h-10 rounded-full bg-gradient-to-br ${t.color} flex items-center justify-center font-bold text-white mb-4 shadow-lg`}>
              {t.symbol.charAt(0)}
            </div>
            <h3 className="text-lg font-bold text-white group-hover:text-blue-400 transition-colors uppercase">{t.symbol}</h3>
            <p className="text-xs text-gray-400 mb-4">{t.name}</p>
            
            <div className="space-y-3 border-t border-[#222] pt-4">
              <div className="flex justify-between items-center text-sm">
                <span className="text-gray-500 font-medium">Network</span>
                <span className="bg-[#222] text-gray-300 text-[10px] px-2 py-0.5 rounded uppercase font-bold">{t.network}</span>
              </div>
              <div className="flex justify-between items-center text-sm">
                <span className="text-gray-500 font-medium">Supply</span>
                <span className="text-white font-mono">{t.supply}</span>
              </div>
              <div className="flex justify-between items-center text-sm">
                <span className="text-gray-500 font-medium">Holders</span>
                <span className="text-white font-mono">{t.holders.toLocaleString()}</span>
              </div>
            </div>

            <div className="mt-5 p-3 bg-[#1a1a1a] rounded-lg border border-[#222]">
              <div className="flex justify-between items-center mb-1">
                <span className="text-xs text-gray-500 font-bold uppercase">TVL</span>
                <span className="text-sm font-bold text-green-400">${t.tvl.toLocaleString()}</span>
              </div>
              <div className="w-full bg-[#333] h-1.5 rounded-full overflow-hidden">
                <div className={`h-full bg-gradient-to-r ${t.color}`} style={{ width: `${Math.random() * 50 + 50}%` }}></div>
              </div>
              <p className="text-[10px] text-gray-400 mt-2 text-right flex items-center justify-end gap-1">
                <LineChart className="w-3 h-3 text-orange-400" /> {t.apy}% Native APY
              </p>
            </div>
          </div>
        ))}
        
        <div className="bg-[#111] border-2 border-dashed border-[#333] hover:border-blue-500/50 hover:bg-[#151515] rounded-2xl p-5 flex flex-col items-center justify-center transition-colors cursor-pointer group min-h-[300px]">
          <div className="w-12 h-12 rounded-full bg-blue-500/10 flex items-center justify-center group-hover:scale-110 transition-transform mb-3">
            <Coins className="w-6 h-6 text-blue-400" />
          </div>
          <h4 className="font-bold text-white group-hover:text-blue-400 transition-colors">Deploy New Token</h4>
          <p className="text-xs text-center text-gray-500 mt-2 px-4">Launch standard omni-chain implementations on the X3 network.</p>
        </div>
      </div>
    </div>
  );
};

const SettingsView = () => (
  <div className="max-w-xl mx-auto mt-4 animate-in fade-in duration-500">
    <h2 className="text-2xl font-bold mb-6 text-white flex items-center gap-2"><Settings className="w-6 h-6 text-gray-400"/> Security & Preferences</h2>
    <div className="bg-[#111] border border-[#222] rounded-2xl overflow-hidden divide-y divide-[#222] shadow-xl">
      <div className="p-5 flex items-center justify-between hover:bg-[#151515] transition-colors cursor-pointer group">
        <div>
          <h4 className="font-bold text-white text-sm group-hover:text-blue-400 transition-colors">Hardware Wallet</h4>
          <p className="text-xs text-gray-500 mt-1">Connect Ledger or Trezor</p>
        </div>
        <ChevronRight className="w-4 h-4 text-gray-500 group-hover:text-blue-400 group-hover:translate-x-1 transition-all" />
      </div>
      <div className="p-5 flex items-center justify-between hover:bg-[#151515] transition-colors cursor-pointer group">
        <div>
          <h4 className="font-bold text-white text-sm group-hover:text-orange-400 transition-colors">Backup Universal Seed</h4>
          <p className="text-xs text-gray-500 mt-1">Export your encrypted 24-word phrase</p>
        </div>
        <ChevronRight className="w-4 h-4 text-gray-500 group-hover:text-orange-400 group-hover:translate-x-1 transition-all" />
      </div>
      <div className="p-5 flex items-center justify-between hover:bg-[#151515] transition-colors cursor-pointer group">
        <div>
          <h4 className="font-bold text-white text-sm group-hover:text-green-400 transition-colors">Network RPCs</h4>
          <p className="text-xs text-gray-500 mt-1">Manage custom RPC endpoints for 59k chains</p>
        </div>
        <ChevronRight className="w-4 h-4 text-gray-500 group-hover:text-green-400 group-hover:translate-x-1 transition-all" />
      </div>
      <div className="p-5 flex items-center justify-between hover:bg-red-500/10 transition-colors cursor-pointer group">
        <div>
          <h4 className="font-bold text-red-500 text-sm group-hover:text-red-400 transition-colors">Nuke Wallet</h4>
          <p className="text-xs text-red-500/70 mt-1">Wipe all keys from local secure enclave</p>
        </div>
        <LogOut className="w-4 h-4 text-red-500 group-hover:scale-110 transition-transform" />
      </div>
    </div>
  </div>
);

const AddressBookView = () => {
  const { addressBook } = useWalletStore();

  return (
    <div className="max-w-3xl mx-auto mt-4 animate-in fade-in duration-500">
      <div className="flex justify-between items-end mb-6">
        <div>
          <h2 className="text-2xl font-bold text-white flex items-center gap-2">
            <BookOpen className="text-blue-400 w-6 h-6" /> Address Book
          </h2>
          <p className="text-sm text-gray-400 mt-1">Manage ENS domains and whitelisted trusted addresses.</p>
        </div>
        <button className="bg-blue-500/20 text-blue-400 border border-blue-500/30 px-4 py-2 rounded-lg text-sm font-bold hover:bg-blue-500 hover:text-white transition-all shadow-lg hover:shadow-blue-500/20">
          + Add Contact
        </button>
      </div>

      <div className="bg-[#111] border border-[#222] rounded-2xl overflow-hidden shadow-xl">
        {addressBook.map((contact, i) => (
          <div key={i} className={`p-4 flex items-center justify-between hover:bg-[#151515] transition-colors cursor-pointer group ${i !== addressBook.length - 1 ? 'border-b border-[#222]' : ''}`}>
             <div className="flex items-center gap-4">
               <div className={`w-10 h-10 rounded-full flex items-center justify-center font-bold shadow-inner ${contact.color}`}>
                 {contact.name.charAt(0)}
               </div>
               <div>
                  <h4 className="font-bold text-white flex items-center gap-2">{contact.name} <span className="bg-[#222] px-1.5 py-0.5 rounded text-[10px] text-gray-400 uppercase font-bold border border-[#333]">WHITELISTED</span></h4>
                  <p className="text-sm text-gray-400 font-mono mt-0.5">{contact.ens} • {contact.address}</p>
               </div>
             </div>
             <div className="flex items-center gap-3">
               <button className="p-2 hover:bg-[#222] rounded-lg transition-colors text-gray-500 hover:text-white"><Send className="w-4 h-4" /></button>
               <button className="p-2 hover:bg-[#222] rounded-lg transition-colors text-gray-500 hover:text-white"><Copy className="w-4 h-4" /></button>
             </div>
          </div>
        ))}
      </div>
    </div>
  );
};

const SecurityView = () => (
  <div className="max-w-5xl mx-auto mt-4 animate-in slide-in-from-bottom-4 duration-500 space-y-6">
    <div className="mb-6">
       <h2 className="text-2xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-red-400 to-orange-500 flex items-center gap-2">
         <ShieldAlert className="w-6 h-6 text-red-500" /> Advanced Security & Smart Logic
       </h2>
       <p className="text-gray-400 text-sm mt-1">Self-custodial control, account abstraction, and risk protection mechanics.</p>
    </div>

    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
      {/* 1. Key Management & Encryption */}
      <div className="bg-[#111] border border-[#333] rounded-3xl p-6 shadow-xl relative overflow-hidden group">
        <div className="absolute top-0 right-0 p-8 opacity-5 pointer-events-none group-hover:scale-110 transition-transform duration-1000">
           <Lock className="w-48 h-48 text-green-500/20" />
        </div>
        <h3 className="text-lg font-bold text-white flex items-center gap-2 mb-4 border-b border-[#222] pb-3">
          <Key className="w-5 h-5 text-green-400" /> Key Management & Encryption
        </h3>
        <div className="space-y-4 relative z-10">
          <div className="flex justify-between items-center text-sm border-b border-[#222] pb-2">
             <span className="text-gray-400">Standard</span>
             <span className="text-white font-mono bg-green-500/20 text-green-400 px-2 py-0.5 rounded border border-green-500/30 text-[10px] font-bold tracking-widest">BIP-32 / BIP-39 / BIP-44</span>
          </div>
          <div className="flex justify-between items-center text-sm border-b border-[#222] pb-2">
             <span className="text-gray-400">Encryption at Rest</span>
             <span className="text-white font-mono bg-[#222] px-2 py-0.5 rounded border border-[#333] text-[10px] font-bold tracking-widest">AES-256-GCM + Argon2id</span>
          </div>
          <div className="flex justify-between items-center text-sm">
             <span className="text-gray-400">Memory Protection</span>
             <span className="text-white font-mono flex items-center gap-1 bg-[#222] px-2 py-0.5 rounded border border-[#333] text-[10px] font-bold tracking-widest">
                <Shield className="w-3 h-3 text-blue-400"/> ZEROED / ENCLAVE-LOCKED
             </span>
          </div>
        </div>
      </div>

      {/* 2. Hardware Wallet Integration */}
      <div className="bg-[#111] border border-[#333] rounded-3xl p-6 shadow-xl relative overflow-hidden group">
        <div className="absolute top-0 right-0 p-8 opacity-5 pointer-events-none group-hover:scale-110 transition-transform duration-1000">
           <Cpu className="w-48 h-48 text-blue-500/20" />
        </div>
        <h3 className="text-lg font-bold text-white flex items-center gap-2 mb-4 border-b border-[#222] pb-3">
          <Cpu className="w-5 h-5 text-blue-400" /> Hardware Integration
        </h3>
        <div className="space-y-4 relative z-10">
           <p className="text-sm text-gray-400 leading-relaxed mb-4">
             Air-gapped signing. Your wallet never sees the private key.
           </p>
           <div className="flex gap-4">
             <button className="flex-1 bg-[#1a1a1a] border border-[#333] hover:border-blue-500/50 hover:bg-[#222] text-white p-3 rounded-xl transition-colors flex flex-col items-center justify-center gap-2 group/btn">
                <HardDrive className="w-6 h-6 text-gray-400 group-hover/btn:text-blue-400 transition-colors" />
                <span className="text-xs font-bold font-mono">Connect Ledger</span>
             </button>
             <button className="flex-1 bg-[#1a1a1a] border border-[#333] hover:border-blue-500/50 hover:bg-[#222] text-white p-3 rounded-xl transition-colors flex flex-col items-center justify-center gap-2 group/btn">
                <HardDrive className="w-6 h-6 text-gray-400 group-hover/btn:text-blue-400 transition-colors" />
                <span className="text-xs font-bold font-mono">Connect Trezor</span>
             </button>
           </div>
        </div>
      </div>

      {/* 3. Transaction Security & Pre-Flight */}
      <div className="bg-[#111] border border-[#333] rounded-3xl p-6 shadow-xl relative overflow-hidden group">
        <h3 className="text-lg font-bold text-white flex items-center gap-2 mb-4 border-b border-[#222] pb-3">
          <Eye className="w-5 h-5 text-purple-400" /> Transaction Pre-Flight Engine
        </h3>
        <div className="space-y-3 relative z-10">
          <div className="flex items-center gap-3 bg-purple-500/10 border border-purple-500/20 p-3 rounded-xl">
             <Activity className="w-5 h-5 text-purple-400 shrink-0" />
             <p className="text-xs text-purple-200"><strong>eth_call Simulated:</strong> All state changes are dry-run prior to signature prompt.</p>
          </div>
          <div className="flex items-center gap-3 bg-red-500/10 border border-red-500/20 p-3 rounded-xl">
             <AlertTriangle className="w-5 h-5 text-red-400 shrink-0" />
             <p className="text-xs text-red-200"><strong>Allowance Guard:</strong> Unlimited ERC20 setApprovalForAll silently blocked.</p>
          </div>
          <div className="flex items-center gap-3 bg-orange-500/10 border border-orange-500/20 p-3 rounded-xl">
             <ShieldAlert className="w-5 h-5 text-orange-400 shrink-0" />
             <p className="text-xs text-orange-200"><strong>Anti-Phishing:</strong> Domain bounded / Honeypot db checked / RPC headers validated.</p>
          </div>
        </div>
      </div>

      {/* 4. Multi-Sig & Smart Logic */}
      <div className="grid grid-cols-2 gap-4">
        <div className="bg-[#111] border border-[#333] hover:border-red-500/50 p-5 rounded-2xl transition-colors group shadow-lg">
          <div className="flex justify-between items-start mb-4">
            <Fingerprint className="text-red-400 w-6 h-6 group-hover:scale-110 transition-transform" />
            <div className="w-10 h-5 bg-red-500 rounded-full relative shadow-inner cursor-pointer"><div className="absolute right-1 top-1 w-3 h-3 bg-white rounded-full shadow"></div></div>
          </div>
          <h3 className="font-bold text-sm mb-1 text-white">Biometric Lock</h3>
          <p className="text-[10px] text-gray-400 leading-tight">Fingerprint/FaceID via OS Enclave.</p>
        </div>

        <div className="bg-[#111] border border-[#333] hover:border-blue-500/50 p-5 rounded-2xl transition-colors group shadow-lg">
          <div className="flex justify-between items-start mb-4">
            <Users className="text-blue-400 w-6 h-6 group-hover:scale-110 transition-transform" />
            <div className="w-10 h-5 bg-[#333] rounded-full relative shadow-inner cursor-pointer"><div className="absolute left-1 top-1 w-3 h-3 bg-gray-500 rounded-full shadow"></div></div>
          </div>
          <h3 className="font-bold text-sm mb-1 text-white">Multi-Sig Core</h3>
          <p className="text-[10px] text-gray-400 leading-tight">Require co-signers for large TXs.</p>
        </div>

        <div className="bg-[#111] border border-[#333] hover:border-orange-500/50 p-5 rounded-2xl transition-colors group shadow-lg">
          <div className="flex justify-between items-start mb-4">
            <Gauge className="text-orange-400 w-6 h-6 group-hover:scale-110 transition-transform" />
            <div className="w-10 h-5 bg-orange-500 rounded-full relative shadow-inner cursor-pointer"><div className="absolute right-1 top-1 w-3 h-3 bg-white rounded-full shadow"></div></div>
          </div>
          <h3 className="font-bold text-sm mb-1 text-white">Spend Limits</h3>
          <p className="text-[10px] text-gray-400 leading-tight">Daily transfer limits enforced.</p>
        </div>

        <div className="bg-[#111] border border-[#333] hover:border-green-500/50 p-5 rounded-2xl transition-colors group shadow-lg">
          <div className="flex justify-between items-start mb-4">
            <LifeBuoy className="text-green-400 w-6 h-6 group-hover:scale-110 transition-transform" />
            <div className="w-10 h-5 bg-green-500 rounded-full relative shadow-inner cursor-pointer"><div className="absolute right-1 top-1 w-3 h-3 bg-white rounded-full shadow"></div></div>
          </div>
          <h3 className="font-bold text-sm mb-1 text-white">Social Recovery</h3>
          <p className="text-[10px] text-gray-400 leading-tight">EIP-4337 Account Abstraction keys.</p>
        </div>
      </div>
    </div>
  </div>
);

const DappsView = () => {
  const { dapps } = useWalletStore();
  return (
    <div className="max-w-5xl mx-auto mt-4 animate-in fade-in zoom-in-95 duration-500">
      <div className="mb-6 flex justify-between items-end">
        <div>
          <h2 className="text-2xl font-bold text-white flex items-center gap-2">
            <Layers className="text-purple-400 w-6 h-6" /> DApp Browser
          </h2>
          <p className="text-sm text-gray-400 mt-1">One-tap interaction with DeFi protocols, yields, and Web3 services.</p>
        </div>
        <div className="relative">
           <Search className="w-4 h-4 absolute left-3 top-3 text-gray-500"/>
           <input type="text" placeholder="Search dApps or enter URL..." className="bg-[#111] border border-[#333] rounded-lg pl-9 pr-4 py-2 text-sm focus:outline-none focus:border-purple-500 transition-colors w-72 text-white" />
        </div>
      </div>
      
      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 gap-4">
        {dapps.map((app, idx) => (
           <div key={idx} className="bg-[#111] border border-[#222] hover:border-purple-500/50 p-5 rounded-xl flex flex-col items-center justify-center gap-3 cursor-pointer group transition-all shadow-lg hover:-translate-y-1">
             <div className="w-14 h-14 rounded-full bg-[#1a1a1a] flex items-center justify-center group-hover:scale-110 transition-transform border border-[#333] group-hover:border-purple-500 shadow-inner">
               <Globe className="w-6 h-6 text-gray-400 group-hover:text-purple-400 transition-colors" />
             </div>
             <span className="font-bold text-sm text-gray-300 group-hover:text-white transition-colors">{app}</span>
           </div>
        ))}
      </div>
    </div>
  );
};

// ── Helpers ─────────────────────────────────────────────────────────────────

const navItems: { view: ActiveView; label: string; Icon: React.FC<any> }[] = [
  { view: 'dashboard', label: 'Dashboard', Icon: LayoutDashboard },
  { view: 'send', label: 'Send', Icon: Send },
  { view: 'receive', label: 'Receive', Icon: Download },
  { view: 'swap', label: 'Swap', Icon: ArrowLeftRight },
  { view: 'portfolio', label: 'Portfolio', Icon: PieChart },
  { view: 'addressBook', label: 'Address Book', Icon: BookOpen },
  { view: 'dapps', label: 'DApps', Icon: Layers },
  { view: 'comit', label: 'Comit', Icon: Zap },
  { view: 'mint', label: 'Create Token', Icon: Coins },
  { view: 'history', label: 'History', Icon: History },
  { view: 'security', label: 'Security', Icon: ShieldAlert },
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
  substrate_address: string;
  evm_chain_count: number;
  warning: string;
}

const WalletPanel: React.FC = () => {
  const { activeView, setActiveView, disconnect, setAccounts, setActiveAccountIndex } = useWalletStore();
  const [universalWallet, setUniversalWallet] = useState<UniversalWallet | null>(null);
  const [generating, setGenerating] = useState(false);
  const [walletModal, setWalletModal] = useState(false);
  const [evmChainCount, setEvmChainCount] = useState(0);
  const [qrCode, setQrCode] = useState<string>('');

  // Load EVM chain count
  useEffect(() => {
    invoke<number>('get_evm_chain_count').then((count) => {
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
      // Generate QR code
      const qr = await QRCode.toDataURL(wallet.evm_address, { width: 200, margin: 2 });
      setQrCode(qr);
      // Update store
      setAccounts([{
        name: 'X3 Universal Wallet',
        address: wallet.evm_address,
        network: 'universal',
        balance: '0.00',
      }]);
      setActiveAccountIndex(0);
    } catch (error) {
      console.error('Wallet generation failed:', error);
    }
    setGenerating(false);
  };

  const ActiveComponent = () => {
    switch (activeView) {
      case 'dashboard': return <DashboardView />;
      case 'send': return <SendView />;
      case 'receive': return <ReceiveView address={universalWallet?.evm_address} qrCode={qrCode} />;
      case 'swap': return <SwapView />;
      case 'history': return <HistoryView />;
      case 'settings': return <SettingsView />;
      case 'comit': return <ComitView />;
      case 'mint': return <MintView />;
      case 'portfolio': return <PortfolioView />;
      case 'addressBook': return <AddressBookView />;
      case 'security': return <SecurityView />;
      case 'dapps': return <DappsView />;
      default: return <DashboardView />;
    }
  };

  return (
    <div className="flex h-full bg-[#0a0a0f] text-white">
      {/* Sidebar */}
      <aside className="w-48 flex flex-col border-r border-[#1a1a1a] bg-[#0a0a0f]">
        {/* Header with Universal Wallet button */}
        <div className="p-4 border-b border-[#1a1a1a]">
          <div className="flex items-center gap-2 mb-2">
            <Rocket className="w-5 h-5 text-orange-400" />
            <h1 className="text-sm font-bold text-white">X3 Wallet</h1>
          </div>
          <p className="text-xs text-gray-500 mb-3">{evmChainCount ? evmChainCount.toLocaleString() : '59,263'} EVM chains + Solana + Polkadot</p>
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
                <h2 className="text-xl font-bold text-white">X3 Universal Wallet Created</h2>
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
                <div className="flex gap-3">
                  <div className="flex-1 bg-[#111111] border border-[#1a1a1a] rounded-lg p-3 font-mono text-sm break-all">
                    {universalWallet.evm_address}
                  </div>
                  {qrCode && (
                    <div className="bg-[#111111] border border-[#1a1a1a] rounded-lg p-2">
                      <img src={qrCode} alt="QR Code" className="w-20 h-20" />
                    </div>
                  )}
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
                  {universalWallet.substrate_address}
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