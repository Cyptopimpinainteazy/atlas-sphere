import { Cpu } from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from 'recharts';
import type { GPULaneHealth } from '../../api';

interface GPULanesSectionProps {
  gpuLanes: GPULaneHealth[];
}

export function GPULanesSection({ gpuLanes }: GPULanesSectionProps) {
  if (gpuLanes.length === 0) return null;

  const formatNumber = (num: number) => num.toLocaleString();

  return (
    <div className="card mb-8">
      <div className="flex items-center gap-2 mb-6">
        <Cpu className="w-5 h-5 text-green-400" />
        <h2 className="text-xl font-bold text-white">GPU Lanes ({gpuLanes.length} Active)</h2>
      </div>
      
      <div className="grid md:grid-cols-3 gap-4 mb-6">
        {gpuLanes.map((lane) => (
          <div key={lane.service} className="bg-gray-800/50 rounded-lg p-4 border border-gray-700">
            <div className="flex items-center justify-between mb-3">
              <span className="text-white font-semibold capitalize">
                {lane.service.replace('gpu-lane-', '')}
              </span>
              <span 
                className={`px-2 py-0.5 rounded text-xs font-semibold ${
                  lane.gpu.available ? 'bg-green-500/20 text-green-300' : 'bg-red-500/20 text-red-300'
                }`}
                aria-label={`GPU ${lane.gpu.id} - ${lane.gpu.available ? 'Available' : 'Unavailable'}`}
              >
                GPU {lane.gpu.id}
              </span>
            </div>
            <div className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-gray-400">Txns Processed</span>
                <span className="text-white font-mono">{formatNumber(lane.stats.total_txns)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-400">Success Rate</span>
                <span className="text-green-400 font-mono">{(lane.stats.success_rate * 100).toFixed(1)}%</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-400">TPS (avg)</span>
                <span className="text-blue-400 font-mono">{formatNumber(Math.round(lane.stats.txns_per_second))}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-400">VRAM Used</span>
                <span className="text-yellow-400 font-mono">{lane.gpu.memory_used_mb.toFixed(0)} MB</span>
              </div>
            </div>
            {/* Usage bar */}
            <div className="mt-3">
              <div className="w-full bg-gray-700 rounded-full h-1.5" role="progressbar" aria-label="GPU utilization" aria-valuenow={Math.min(lane.gpu.utilization, 100)} aria-valuemin={0} aria-valuemax={100}>
                <div
                  className="bg-blue-500 h-1.5 rounded-full transition-all"
                  style={{ width: `${Math.min(lane.gpu.utilization, 100)}%` }}
                  aria-hidden="true"
                ></div>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* GPU distribution bar chart */}
      <div className="h-48">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={gpuLanes.map(l => ({
            name: l.service.replace('gpu-lane-', '').toUpperCase(),
            txns: l.stats.total_txns,
            tps: Math.round(l.stats.txns_per_second),
          }))}>
            <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
            <XAxis dataKey="name" stroke="#9CA3AF" fontSize={12} />
            <YAxis stroke="#9CA3AF" fontSize={11} tickFormatter={(v) => v >= 1000000 ? `${(v/1000000).toFixed(1)}M` : v >= 1000 ? `${(v/1000).toFixed(0)}K` : v} />
            <Tooltip
              contentStyle={{ backgroundColor: '#1F2937', border: '1px solid #374151', borderRadius: '8px', color: '#fff' }}
              formatter={(value: number | undefined) => [value?.toLocaleString() ?? '0']}
            />
            <Legend />
            <Bar dataKey="txns" fill="#3B82F6" name="Total Txns" radius={[4, 4, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
