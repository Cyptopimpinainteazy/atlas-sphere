import { Clock } from 'lucide-react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { TIME_RANGE_MS, LARGE_NUMBER_THRESHOLD } from '../../constants';

interface TpsPoint {
  time: string;
  ts: number;
  tps: number;
  forwarded: number;
  received: number;
}

interface TpsChartProps {
  tpsHistory: TpsPoint[];
  timeRange: '1m' | '5m' | '15m' | '30m' | '1h' | 'all';
  onTimeRangeChange: (range: '1m' | '5m' | '15m' | '30m' | '1h' | 'all') => void;
}

export function TpsChart({ tpsHistory, timeRange, onTimeRangeChange }: TpsChartProps) {
  const filteredHistory = timeRange === 'all'
    ? tpsHistory
    : tpsHistory.filter(p => p.ts >= Date.now() - TIME_RANGE_MS[timeRange]);

  const timeRangeOptions = [
    { key: '1m' as const, label: '1m' },
    { key: '5m' as const, label: '5m' },
    { key: '15m' as const, label: '15m' },
    { key: '30m' as const, label: '30m' },
    { key: '1h' as const, label: '1H' },
    { key: 'all' as const, label: 'ALL' },
  ];

  return (
    <div className="card mb-8">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-xl font-bold text-white">Real-Time TPS Performance</h2>
        <div className="flex items-center gap-3 text-sm">
          {filteredHistory.length > 0 && (
            <span className="text-blue-400 font-mono">
              Peak: {Math.max(...filteredHistory.map(h => h.tps)).toLocaleString()} TPS
            </span>
          )}
          <span className="flex items-center gap-1 text-gray-500">
            <Clock className="w-3.5 h-3.5" />
            2s
          </span>
        </div>
      </div>

      {/* TradingView-style time range bar */}
      <div className="flex items-center gap-1 mb-4 bg-gray-900/60 rounded-lg p-1 w-fit">
        {timeRangeOptions.map(opt => (
          <button
            key={opt.key}
            onClick={() => onTimeRangeChange(opt.key)}
            className={`px-3 py-1 rounded text-xs font-semibold transition-all ${
              timeRange === opt.key
                ? 'bg-blue-600 text-white shadow-sm'
                : 'text-gray-400 hover:text-white hover:bg-gray-700/50'
            }`}
          >
            {opt.label}
          </button>
        ))}
        <span className="text-gray-600 text-xs ml-2 font-mono">
          {filteredHistory.length} pts
        </span>
      </div>
      
      <div className="h-72">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={filteredHistory}>
            <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
            <XAxis dataKey="time" stroke="#9CA3AF" fontSize={11} />
            <YAxis stroke="#9CA3AF" fontSize={11} tickFormatter={(v) => v >= LARGE_NUMBER_THRESHOLD ? `${(v/LARGE_NUMBER_THRESHOLD).toFixed(0)}K` : v} />
            <Tooltip
              contentStyle={{
                backgroundColor: '#1F2937',
                border: '1px solid #374151',
                borderRadius: '8px',
                color: '#fff',
              }}
              formatter={(value: number | undefined) => [value?.toLocaleString() ?? '0', 'TPS']}
            />
            <Line
              type="monotone"
              dataKey="tps"
              stroke="#3B82F6"
              strokeWidth={2}
              dot={false}
              name="TPS"
              isAnimationActive={false}
            />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
