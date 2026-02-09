import React, { useMemo } from 'react';
import {
  LineChart,
  Line,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
} from 'recharts';
import { usePeers } from '@/hooks/useQuery';
import { StatCard } from '@/components/Common';



export const NetworkTopology: React.FC = () => {
  const { data: peers } = usePeers();

  // Peer reputation distribution
  const reputationData = useMemo(() => {
    if (!peers) return [];
    const buckets = {
      '0-20': 0,
      '21-40': 0,
      '41-60': 0,
      '61-80': 0,
      '81-100': 0,
    };
    peers.forEach((peer) => {
      if (peer.reputation <= 20) buckets['0-20']++;
      else if (peer.reputation <= 40) buckets['21-40']++;
      else if (peer.reputation <= 60) buckets['41-60']++;
      else if (peer.reputation <= 80) buckets['61-80']++;
      else buckets['81-100']++;
    });
    return Object.entries(buckets).map(([range, count]) => ({
      name: range,
      count,
    }));
  }, [peers]);

  // Latency over time (mock)
  const latencyData = useMemo(() => {
    const data = [];
    for (let i = 0; i < 60; i++) {
      data.push({
        time: i,
        avgLatency: 50 + Math.random() * 30,
        p95Latency: 80 + Math.random() * 40,
        p99Latency: 120 + Math.random() * 50,
      });
    }
    return data;
  }, []);

  const blacklistedPeers = peers?.filter((p) => p.isBlacklisted).length || 0;
  const totalPeers = peers?.length || 0;
  const avgReputation =
    peers && peers.length > 0
      ? (peers.reduce((sum, p) => sum + p.reputation, 0) / peers.length).toFixed(1)
      : 0;

  return (
    <div className="space-y-6">
      {/* Network Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <StatCard
          title="Total Peers"
          value={totalPeers}
          variant="blue"
        />
        <StatCard
          title="Avg Reputation"
          value={avgReputation}
          unit="/"
          variant="green"
        />
        <StatCard
          title="Blacklisted"
          value={blacklistedPeers}
          variant="orange"
        />
        <StatCard
          title="Network Health"
          value={((totalPeers - blacklistedPeers) / Math.max(totalPeers, 1) * 100).toFixed(0)}
          unit="%"
          variant="purple"
        />
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Peer Reputation Distribution */}
        <div className="bg-slate-800 rounded-lg p-6 border border-slate-700">
          <h3 className="text-lg font-semibold mb-4">Peer Reputation Distribution</h3>
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={reputationData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
              <XAxis dataKey="name" stroke="#94a3b8" />
              <YAxis stroke="#94a3b8" />
              <Tooltip
                contentStyle={{ backgroundColor: '#1e293b', border: '1px solid #475569' }}
                labelStyle={{ color: '#fff' }}
              />
              <Bar dataKey="count" fill="#3b82f6" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* Peer Status Breakdown */}
        <div className="bg-slate-800 rounded-lg p-6 border border-slate-700">
          <h3 className="text-lg font-semibold mb-4">Peer Status</h3>
          <ResponsiveContainer width="100%" height={300}>
            <PieChart>
              <Pie
                data={[
                  { name: 'Healthy', value: totalPeers - blacklistedPeers },
                  { name: 'Blacklisted', value: blacklistedPeers },
                ]}
                cx="50%"
                cy="50%"
                labelLine={false}
                label={({ name, value }) => `${name}: ${value}`}
                outerRadius={80}
                fill="#8884d8"
                dataKey="value"
              >
                <Cell fill="#10b981" />
                <Cell fill="#ef4444" />
              </Pie>
              <Tooltip
                contentStyle={{ backgroundColor: '#1e293b', border: '1px solid #475569' }}
                labelStyle={{ color: '#fff' }}
              />
            </PieChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Latency Metrics */}
      <div className="bg-slate-800 rounded-lg p-6 border border-slate-700">
        <h3 className="text-lg font-semibold mb-4">Network Latency</h3>
        <ResponsiveContainer width="100%" height={300}>
          <LineChart data={latencyData}>
            <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
            <XAxis dataKey="time" stroke="#94a3b8" />
            <YAxis stroke="#94a3b8" label={{ value: 'ms', angle: -90, position: 'insideLeft' }} />
            <Tooltip
              contentStyle={{ backgroundColor: '#1e293b', border: '1px solid #475569' }}
              labelStyle={{ color: '#fff' }}
            />
            <Legend />
            <Line type="monotone" dataKey="avgLatency" stroke="#3b82f6" strokeWidth={2} dot={false} />
            <Line
              type="monotone"
              dataKey="p95Latency"
              stroke="#f59e0b"
              strokeWidth={2}
              dot={false}
            />
            <Line
              type="monotone"
              dataKey="p99Latency"
              stroke="#ef4444"
              strokeWidth={2}
              dot={false}
            />
          </LineChart>
        </ResponsiveContainer>
      </div>

      {/* Peer List */}
      <div className="bg-slate-800 rounded-lg p-6 border border-slate-700">
        <h3 className="text-lg font-semibold mb-4">Top Peers by Reputation</h3>
        <div className="space-y-3 max-h-96 overflow-y-auto">
          {peers
            ?.sort((a, b) => b.reputation - a.reputation)
            .slice(0, 10)
            .map((peer) => (
              <div key={peer.id} className="flex items-center justify-between p-3 bg-slate-700/50 rounded">
                <div className="flex-1">
                  <p className="font-mono text-sm text-white">{peer.id.slice(0, 16)}...</p>
                  <p className="text-xs text-slate-400">
                    {peer.capabilities.join(', ')} • {peer.latency}ms
                  </p>
                </div>
                <div className="text-right">
                  <p className="font-semibold text-blue-400">{peer.reputation}/100</p>
                  {peer.isBlacklisted && (
                    <p className="text-xs text-red-400">🚫 Blacklisted</p>
                  )}
                </div>
              </div>
            ))}
        </div>
      </div>
    </div>
  );
};
