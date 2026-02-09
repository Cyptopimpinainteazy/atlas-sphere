import React, { useState } from 'react';
import {
  LineChart,
  Line,
  AreaChart,
  Area,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from 'recharts';
import { useWebSocket } from '@/hooks/useWebSocket';
import { useGpuStatus } from '@/hooks/useQuery';
import { StatCard } from '@/components/Common';

// Mock data for demonstration
const generateMockData = (count: number) => {
  const data = [];
  for (let i = 0; i < count; i++) {
    data.push({
      timestamp: new Date(Date.now() - (60 - i) * 5000).toLocaleTimeString(),
      utilization: Math.random() * 100,
      memory: Math.random() * 24000,
      temperature: 40 + Math.random() * 40,
      power: 100 + Math.random() * 200,
      throughput: 100 + Math.random() * 400,
    });
  }
  return data;
};

interface GpuMonitoringProps {
  selectedDevice?: string;
}

export const GpuMonitoring: React.FC<GpuMonitoringProps> = ({ selectedDevice = 'cuda:0' }) => {
  const [timeRange, setTimeRange] = useState<'5m' | '1h' | '24h'>('5m');
  const { data: devices } = useGpuStatus();
  const { message } = useWebSocket('/ws/metrics/gpu');
  const [chartData, setChartData] = useState(() => generateMockData(12));

  // Update chart with real-time data
  React.useEffect(() => {
    if (message?.type === 'gpu_metrics') {
      setChartData((prev) => {
        const updated = [...prev, message.data];
        // Keep only last 60 points (5 minutes at 5s intervals)
        return updated.slice(-60);
      });
    }
  }, [message]);

  const currentMetrics = chartData[chartData.length - 1];
  const device = devices?.find((d) => d.id === selectedDevice);

  return (
    <div className="space-y-6">
      {/* KPI Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <StatCard
          title="GPU Utilization"
          value={currentMetrics?.utilization.toFixed(1) || 0}
          unit="%"
          variant="blue"
        />
        <StatCard
          title="Memory Used"
          value={(currentMetrics?.memory / 1024).toFixed(1) || 0}
          unit="GB"
          variant="purple"
        />
        <StatCard
          title="Temperature"
          value={currentMetrics?.temperature.toFixed(0) || 0}
          unit="°C"
          variant="orange"
        />
        <StatCard
          title="Power Draw"
          value={currentMetrics?.power.toFixed(0) || 0}
          unit="W"
          variant="green"
        />
      </div>

      {/* Device Selector and Time Range */}
      <div className="flex justify-between items-center">
        <div>
          <label className="text-sm text-slate-400 mr-3">GPU Device:</label>
          <select className="bg-slate-800 border border-slate-700 text-white rounded px-3 py-2 text-sm">
            {devices?.map((d) => (
              <option key={d.id} value={d.id}>
                {d.name} ({d.backend.toUpperCase()})
              </option>
            ))}
          </select>
        </div>

        <div className="flex gap-2">
          {(['5m', '1h', '24h'] as const).map((range) => (
            <button
              key={range}
              onClick={() => setTimeRange(range)}
              className={clsx(
                'px-3 py-1 text-xs rounded transition',
                timeRange === range
                  ? 'bg-blue-600 text-white'
                  : 'bg-slate-700 text-slate-300 hover:bg-slate-600'
              )}
            >
              {range}
            </button>
          ))}
        </div>
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Utilization */}
        <div className="bg-slate-800 rounded-lg p-6 border border-slate-700">
          <h3 className="text-lg font-semibold mb-4">Utilization (%)</h3>
          <ResponsiveContainer width="100%" height={300}>
            <AreaChart data={chartData}>
              <defs>
                <linearGradient id="colorUtil" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.8} />
                  <stop offset="95%" stopColor="#3b82f6" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
              <XAxis dataKey="timestamp" stroke="#94a3b8" />
              <YAxis stroke="#94a3b8" domain={[0, 100]} />
              <Tooltip
                contentStyle={{ backgroundColor: '#1e293b', border: '1px solid #475569' }}
                labelStyle={{ color: '#fff' }}
              />
              <Area
                type="monotone"
                dataKey="utilization"
                stroke="#3b82f6"
                fillOpacity={1}
                fill="url(#colorUtil)"
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>

        {/* Memory */}
        <div className="bg-slate-800 rounded-lg p-6 border border-slate-700">
          <h3 className="text-lg font-semibold mb-4">Memory Usage (GB)</h3>
          <ResponsiveContainer width="100%" height={300}>
            <LineChart data={chartData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
              <XAxis dataKey="timestamp" stroke="#94a3b8" />
              <YAxis stroke="#94a3b8" />
              <Tooltip
                contentStyle={{ backgroundColor: '#1e293b', border: '1px solid #475569' }}
                labelStyle={{ color: '#fff' }}
              />
              <Line
                type="monotone"
                dataKey={(d) => (d.memory / 1024).toFixed(2)}
                stroke="#a855f7"
                strokeWidth={2}
                dot={false}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>

        {/* Temperature & Power */}
        <div className="bg-slate-800 rounded-lg p-6 border border-slate-700">
          <h3 className="text-lg font-semibold mb-4">Temperature (°C)</h3>
          <ResponsiveContainer width="100%" height={250}>
            <BarChart data={chartData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
              <XAxis dataKey="timestamp" stroke="#94a3b8" />
              <YAxis stroke="#94a3b8" />
              <Tooltip
                contentStyle={{ backgroundColor: '#1e293b', border: '1px solid #475569' }}
                labelStyle={{ color: '#fff' }}
              />
              <Bar dataKey="temperature" fill="#f59e0b" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>

        <div className="bg-slate-800 rounded-lg p-6 border border-slate-700">
          <h3 className="text-lg font-semibold mb-4">Power Draw (W)</h3>
          <ResponsiveContainer width="100%" height={250}>
            <BarChart data={chartData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
              <XAxis dataKey="timestamp" stroke="#94a3b8" />
              <YAxis stroke="#94a3b8" />
              <Tooltip
                contentStyle={{ backgroundColor: '#1e293b', border: '1px solid #475569' }}
                labelStyle={{ color: '#fff' }}
              />
              <Bar dataKey="power" fill="#ef4444" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Device Details */}
      {device && (
        <div className="bg-slate-800 rounded-lg p-6 border border-slate-700">
          <h3 className="text-lg font-semibold mb-4">Device Details</h3>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div>
              <p className="text-sm text-slate-400">Backend</p>
              <p className="text-lg font-semibold">{device.backend.toUpperCase()}</p>
            </div>
            <div>
              <p className="text-sm text-slate-400">Total VRAM</p>
              <p className="text-lg font-semibold">{(device.vram / 1024).toFixed(1)} GB</p>
            </div>
            <div>
              <p className="text-sm text-slate-400">Throughput</p>
              <p className="text-lg font-semibold">{device.throughput.toFixed(0)} GFLOPS</p>
            </div>
            <div>
              <p className="text-sm text-slate-400">Status</p>
              <p className="text-lg font-semibold text-green-400">Online</p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

import clsx from 'clsx';
