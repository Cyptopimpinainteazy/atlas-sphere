import React, { useState } from 'react';
import { useTasks } from '@/hooks/useQuery';
import { StatCard, Tabs } from '@/components/Common';

interface TaskListProps {
  filter?: 'all' | 'pending' | 'running' | 'completed' | 'failed';
}

export const TaskList: React.FC<TaskListProps> = ({ filter = 'all' }) => {
  const { data: tasks, isLoading } = useTasks();
  const [selectedTask, setSelectedTask] = useState<string | null>(null);
  const [sortBy, setSortBy] = useState<'created' | 'updated' | 'reward'>('created');

  const filteredTasks = tasks?.filter((task) => {
    if (filter === 'all') return true;
    return task.status === filter;
  });

  const sortedTasks = filteredTasks?.sort((a, b) => {
    switch (sortBy) {
      case 'reward':
        return (b.reward || 0) - (a.reward || 0);
      case 'updated':
        return new Date(b.timestamp_updated || b.completedAt || 0).getTime() - new Date(a.timestamp_updated || a.completedAt || 0).getTime();
      case 'created':
      default:
        return new Date(b.timestamp_created || b.submittedAt || 0).getTime() - new Date(a.timestamp_created || a.submittedAt || 0).getTime();
    }
  });

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'pending':
        return 'text-yellow-400';
      case 'running':
        return 'text-blue-400';
      case 'completed':
        return 'text-green-400';
      case 'failed':
        return 'text-red-400';
      default:
        return 'text-slate-400';
    }
  };

  const getStatusBg = (status: string) => {
    switch (status) {
      case 'pending':
        return 'bg-yellow-900/20';
      case 'running':
        return 'bg-blue-900/20';
      case 'completed':
        return 'bg-green-900/20';
      case 'failed':
        return 'bg-red-900/20';
      default:
        return 'bg-slate-800';
    }
  };

  if (isLoading) {
    return <div className="text-slate-400">Loading tasks...</div>;
  }

  return (
    <div className="space-y-4">
      {/* Controls */}
      <div className="flex justify-between items-center">
        <div className="flex gap-2">
          <label className="text-sm text-slate-400">Sort by:</label>
          <select
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value as any)}
            className="bg-slate-700 border border-slate-600 text-white rounded px-3 py-1 text-sm"
          >
            <option value="created">Created</option>
            <option value="updated">Updated</option>
            <option value="reward">Reward</option>
          </select>
        </div>
        <div className="text-sm text-slate-400">
          {sortedTasks?.length || 0} tasks
        </div>
      </div>

      {/* Task List */}
      <div className="space-y-3">
        {sortedTasks && sortedTasks.length > 0 ? (
          sortedTasks.map((task) => (
            <div
              key={task.id}
              onClick={() => setSelectedTask(selectedTask === task.id ? null : task.id)}
              className="bg-slate-800 border border-slate-700 rounded-lg p-4 cursor-pointer hover:border-slate-600 transition"
            >
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <div className="flex items-center gap-3">
                    <h4 className="font-semibold text-white">{task.id.slice(0, 8)}...</h4>
                    <span className={`text-xs px-2 py-1 rounded ${getStatusBg(task.status)} ${getStatusColor(task.status)}`}>
                      {task.status}
                    </span>
                    <span className="text-xs text-slate-400">{task.type}</span>
                  </div>
                  <p className="text-sm text-slate-400 mt-2">
                    GPU Backend: {task.gpuBackend || task.gpu_backend}
                  </p>
                </div>
                <div className="text-right">
                  <p className="font-semibold text-white">
                    {task.reward ? task.reward.toFixed(4) : 0} SWM
                  </p>
                  <p className="text-xs text-slate-400">
                    {new Date(task.timestamp_created || task.submittedAt || 0).toLocaleDateString()}
                  </p>
                </div>
              </div>

              {/* Expanded Details */}
              {selectedTask === task.id && (
                <div className="mt-4 pt-4 border-t border-slate-700 space-y-2">
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <p className="text-xs text-slate-500">Memory Required</p>
                      <p className="text-sm text-slate-300">{((task.memory_required || task.estimatedGpuMemory || 0) / 1024).toFixed(2)} GB</p>
                    </div>
                    <div>
                      <p className="text-xs text-slate-500">Executor</p>
                      <p className="text-sm text-slate-300">{(task.executor || task.executedBy || 'N/A').slice(0, 16)}...</p>
                    </div>
                    <div>
                      <p className="text-xs text-slate-500">Created</p>
                      <p className="text-sm text-slate-300">
                        {new Date(task.timestamp_created || task.submittedAt || 0).toLocaleString()}
                      </p>
                    </div>
                    <div>
                      <p className="text-xs text-slate-500">Updated</p>
                      <p className="text-sm text-slate-300">
                        {new Date(task.timestamp_updated || task.completedAt || 0).toLocaleString()}
                      </p>
                    </div>
                  </div>
                </div>
              )}
            </div>
          ))
        ) : (
          <div className="text-center py-8 text-slate-400">No tasks found</div>
        )}
      </div>
    </div>
  );
};

export const TaskQueue: React.FC = () => {
  const [activeTab, setActiveTab] = useState('all');

  return (
    <div className="space-y-6">
      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <StatCard title="Pending Tasks" value={12} variant="orange" />
        <StatCard title="Running Tasks" value={8} variant="blue" />
        <StatCard title="Completed Today" value={145} variant="green" />
        <StatCard title="Failed Tasks" value={2} variant="orange" />
      </div>

      {/* Task Tabs */}
      <Tabs
        tabs={[
          { label: 'All', value: 'all' },
          { label: 'Pending', value: 'pending' },
          { label: 'Running', value: 'running' },
          { label: 'Completed', value: 'completed' },
          { label: 'Failed', value: 'failed' },
        ]}
        activeTab={activeTab}
        onChangeTab={setActiveTab}
      >
        <TaskList filter={activeTab as any} />
      </Tabs>
    </div>
  );
};
