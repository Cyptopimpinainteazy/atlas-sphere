import React, { useState } from 'react';
import {
  BarChart,
  Bar,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from 'recharts';
import { StatCard } from '@/components/Common';

// Mock data
const rewardData: Record<string, unknown>[] = [];
const stakeData: Record<string, unknown>[] = [];
for (let i = 0; i < 30; i++) {
  rewardData.push({
    day: `Day ${i + 1}`,
    rewards: Math.random() * 500 + 100,
    slashing: Math.random() * 50,
  });
  stakeData.push({
    day: `Day ${i + 1}`,
    staked: 1000 + Math.random() * 500,
    locked: 500 + Math.random() * 300,
  });
}

export const Economics: React.FC = () => {
  const [activeTab, setActiveTab] = useState('rewards');

  return (
    <div className="space-y-6">
      {/* Economics KPIs */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <StatCard
          title="Total Rewards"
          value="12,450"
          unit="SWM"
          trend={8.5}
          variant="green"
        />
        <StatCard
          title="Pending Rewards"
          value="2,340"
          unit="SWM"
          trend={-2.3}
          variant="blue"
        />
        <StatCard
          title="Total Staked"
          value="50,000"
          unit="SWM"
          trend={5.2}
          variant="purple"
        />
        <StatCard
          title="Slashing Penalties"
          value="145"
          unit="SWM"
          trend={-1.1}
          variant="orange"
        />
      </div>

      {/* Tab Navigation */}
      <div className="flex gap-2 border-b border-slate-700">
        {[
          { id: 'rewards', label: 'Rewards' },
          { id: 'staking', label: 'Staking' },
          { id: 'slashing', label: 'Slashing' },
        ].map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`px-4 py-3 text-sm font-medium transition-all border-b-2 ${
              activeTab === tab.id
                ? 'border-blue-500 text-blue-400'
                : 'border-transparent text-slate-400 hover:text-slate-300'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Rewards Chart */}
        <div className="bg-slate-800 rounded-lg p-6 border border-slate-700">
          <h3 className="text-lg font-semibold mb-4">Reward History (30 days)</h3>
          <ResponsiveContainer width="100%" height={300}>
            <AreaChart data={rewardData}>
              <defs>
                <linearGradient id="colorRewards" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#10b981" stopOpacity={0.8} />
                  <stop offset="95%" stopColor="#10b981" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
              <XAxis dataKey="day" stroke="#94a3b8" />
              <YAxis stroke="#94a3b8" />
              <Tooltip
                contentStyle={{ backgroundColor: '#1e293b', border: '1px solid #475569' }}
                labelStyle={{ color: '#fff' }}
              />
              <Area
                type="monotone"
                dataKey="rewards"
                stroke="#10b981"
                fillOpacity={1}
                fill="url(#colorRewards)"
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>

        {/* Staking Chart */}
        <div className="bg-slate-800 rounded-lg p-6 border border-slate-700">
          <h3 className="text-lg font-semibold mb-4">Stake Amount (30 days)</h3>
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={stakeData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
              <XAxis dataKey="day" stroke="#94a3b8" />
              <YAxis stroke="#94a3b8" />
              <Tooltip
                contentStyle={{ backgroundColor: '#1e293b', border: '1px solid #475569' }}
                labelStyle={{ color: '#fff' }}
              />
              <Legend />
              <Bar dataKey="staked" fill="#a855f7" radius={[4, 4, 0, 0]} />
              <Bar dataKey="locked" fill="#3b82f6" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* Slashing Events */}
        <div className="bg-slate-800 rounded-lg p-6 border border-slate-700 lg:col-span-2">
          <h3 className="text-lg font-semibold mb-4">Slashing Events</h3>
          <div className="space-y-3 max-h-64 overflow-y-auto">
            {[
              { date: '2024-01-15', reason: 'Double signing', amount: 50 },
              { date: '2024-01-14', reason: 'Downtime', amount: 25 },
              { date: '2024-01-12', reason: 'Invalid attestation', amount: 75 },
            ].map((event, idx) => (
              <div key={idx} className="flex items-center justify-between p-3 bg-slate-700/50 rounded">
                <div>
                  <p className="font-semibold text-white">{event.reason}</p>
                  <p className="text-xs text-slate-400">{event.date}</p>
                </div>
                <p className="font-semibold text-red-400">-{event.amount} SWM</p>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Staking Panel */}
      <div className="bg-slate-800 rounded-lg p-6 border border-slate-700">
        <h3 className="text-lg font-semibold mb-4">Stake Management</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div>
            <label className="text-sm text-slate-400 block mb-2">Available to Stake</label>
            <p className="text-3xl font-bold text-white mb-4">5,000 SWM</p>
            <input
              type="number"
              placeholder="Amount to stake"
              className="w-full bg-slate-700 border border-slate-600 rounded px-4 py-2 text-white mb-3"
            />
            <select className="w-full bg-slate-700 border border-slate-600 rounded px-4 py-2 text-white mb-3">
              <option>Lock for 30 days</option>
              <option>Lock for 91 days</option>
              <option>Lock for 365 days</option>
            </select>
            <button className="w-full bg-blue-600 hover:bg-blue-700 text-white font-semibold py-2 rounded transition">
              Stake Now
            </button>
          </div>

          <div>
            <label className="text-sm text-slate-400 block mb-2">Current Stakes</label>
            <div className="space-y-2">
              {[
                { amount: 10000, lockup: '30 days', unlocks: '2024-02-15' },
                { amount: 5000, lockup: '91 days', unlocks: '2024-04-15' },
              ].map((stake, idx) => (
                <div key={idx} className="p-3 bg-slate-700/50 rounded">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="font-semibold text-white">{stake.amount} SWM</p>
                      <p className="text-xs text-slate-400">{stake.lockup} • Unlocks {stake.unlocks}</p>
                    </div>
                    <button className="text-xs px-3 py-1 bg-slate-600 hover:bg-slate-500 rounded transition">
                      Manage
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
