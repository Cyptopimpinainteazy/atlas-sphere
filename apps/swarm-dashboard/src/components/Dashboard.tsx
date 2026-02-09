import React from 'react';
import { useMetrics, useHealth, useAlerts } from '@/hooks/useQuery';
import { StatCard, AlertBox, ProgressBar } from '@/components/Common';
import { AreaChart, Area, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';

// Generate mock time series data
const generateTimeSeriesData = () => {
  const data = [];
  for (let i = 0; i < 24; i++) {
    data.push({
      hour: `${i}:00`,
      tasks: Math.random() * 100 + 50,
      gpuUtil: Math.random() * 100,
      peers: Math.random() * 50 + 20,
    });
  }
  return data;
};

export const DashboardOverview: React.FC = () => {
  const { data: metrics } = useMetrics();
  const { data: health } = useHealth();
  const { data: alerts } = useAlerts();
  const [timeSeriesData] = React.useState(generateTimeSeriesData());

  return (
    <div className="space-y-6">
      {/* Key Metrics Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          title="Tasks Submitted"
          value={metrics?.tasksSubmitted || 0}
          trend={12.5}
          variant="blue"
        />
        <StatCard
          title="Tasks Completed"
          value={metrics?.tasksCompleted || 0}
          trend={8.3}
          variant="green"
        />
        <StatCard
          title="GPU Utilization"
          value={(metrics?.gpuUtilization || 0).toFixed(1)}
          unit="%"
          trend={-2.1}
          variant="purple"
        />
        <StatCard
          title="Network Peers"
          value={metrics?.networkPeersConnected || 0}
          trend={5.0}
          variant="orange"
        />
      </div>

      {/* System Health */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-slate-800 rounded-lg p-6 border border-slate-700">
          <h3 className="text-lg font-semibold mb-4">System Health</h3>
          <div className="space-y-4">
            <div>
              <div className="flex justify-between mb-2">
                <span className="text-slate-400">Coordinator</span>
                <span className="text-green-400 font-semibold">Healthy</span>
              </div>
              <ProgressBar value={98} color="green" />
            </div>

            <div>
              <div className="flex justify-between mb-2">
                <span className="text-slate-400">GPU Nodes</span>
                <span className="text-green-400 font-semibold">
                  {health?.nodes.healthy || 0}/{health?.nodes.total || 0}
                </span>
              </div>
              <ProgressBar
                value={(((health?.nodes.healthy || 0) / (health?.nodes.total || 1)) * 100) as number}
                color="green"
              />
            </div>

            <div>
              <div className="flex justify-between mb-2">
                <span className="text-slate-400">Network Health</span>
                <span className="text-blue-400 font-semibold">Good</span>
              </div>
              <ProgressBar value={85} color="blue" />
            </div>

            <div>
              <div className="flex justify-between mb-2">
                <span className="text-slate-400">Storage</span>
                <span className="text-orange-400 font-semibold">72%</span>
              </div>
              <ProgressBar value={72} color="orange" />
            </div>
          </div>
        </div>

        {/* Active Alerts */}
        <div className="bg-slate-800 rounded-lg p-6 border border-slate-700">
          <h3 className="text-lg font-semibold mb-4">Active Alerts</h3>
          <div className="space-y-3 max-h-80 overflow-y-auto">
            {alerts && alerts.length > 0 ? (
              alerts.slice(0, 5).map((alert) => (
                <AlertBox
                  key={alert.id}
                  level={alert.level}
                  title={alert.title}
                  message={alert.message}
                />
              ))
            ) : (
              <div className="text-slate-400 text-center py-6">No active alerts</div>
            )}
          </div>
        </div>
      </div>

      {/* Time Series Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-slate-800 rounded-lg p-6 border border-slate-700">
          <h3 className="text-lg font-semibold mb-4">Task Throughput (24h)</h3>
          <ResponsiveContainer width="100%" height={300}>
            <AreaChart data={timeSeriesData}>
              <defs>
                <linearGradient id="colorTasks" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.8} />
                  <stop offset="95%" stopColor="#3b82f6" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
              <XAxis dataKey="hour" stroke="#94a3b8" />
              <YAxis stroke="#94a3b8" />
              <Tooltip
                contentStyle={{ backgroundColor: '#1e293b', border: '1px solid #475569' }}
                labelStyle={{ color: '#fff' }}
              />
              <Area
                type="monotone"
                dataKey="tasks"
                stroke="#3b82f6"
                fillOpacity={1}
                fill="url(#colorTasks)"
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>

        <div className="bg-slate-800 rounded-lg p-6 border border-slate-700">
          <h3 className="text-lg font-semibold mb-4">GPU Utilization (24h)</h3>
          <ResponsiveContainer width="100%" height={300}>
            <LineChart data={timeSeriesData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
              <XAxis dataKey="hour" stroke="#94a3b8" />
              <YAxis stroke="#94a3b8" domain={[0, 100]} />
              <Tooltip
                contentStyle={{ backgroundColor: '#1e293b', border: '1px solid #475569' }}
                labelStyle={{ color: '#fff' }}
              />
              <Line
                type="monotone"
                dataKey="gpuUtil"
                stroke="#a855f7"
                strokeWidth={2}
                dot={false}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Recent Activity */}
      <div className="bg-slate-800 rounded-lg p-6 border border-slate-700">
        <h3 className="text-lg font-semibold mb-4">Recent Activity</h3>
        <div className="space-y-3 max-h-64 overflow-y-auto">
          {[
            { type: 'task_completed', msg: 'Task #12345 completed successfully', time: '2 mins ago' },
            { type: 'gpu_online', msg: 'GPU Node 5 came online', time: '5 mins ago' },
            { type: 'alert_dismissed', msg: 'High latency alert resolved', time: '10 mins ago' },
            { type: 'reward_claimed', msg: 'Rewards claimed: 150.25 SWM', time: '15 mins ago' },
          ].map((activity, idx) => (
            <div key={idx} className="flex items-center gap-3 p-3 bg-slate-700/50 rounded">
              <div className="text-lg">
                {activity.type === 'task_completed' && '✓'}
                {activity.type === 'gpu_online' && '💻'}
                {activity.type === 'alert_dismissed' && '🔔'}
                {activity.type === 'reward_claimed' && '💰'}
              </div>
              <div className="flex-1">
                <p className="text-sm text-slate-300">{activity.msg}</p>
                <p className="text-xs text-slate-500">{activity.time}</p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};
