import type {
  Metrics,
  GpuDevice,
  Peer,
  Task,
  RewardInfo,
  StakeInfo,
  HealthStatus,
  Alert,
  GovernanceAction,
} from '@/types/api';

// Mock data generators
export function generateMockMetrics(): Metrics {
  return {
    tasksSubmitted: Math.floor(Math.random() * 2000) + 1000,
    tasksCompleted: Math.floor(Math.random() * 1500) + 800,
    tasksFailed: Math.floor(Math.random() * 100) + 20,
    taskExecutionTime: Math.random() * 300 + 50,
    gpuUtilization: Math.random() * 100,
    gpuMemoryUsed: Math.random() * 12000,
    gpuTemperature: Math.random() * 40 + 50,
    gpuPower: Math.random() * 300 + 100,
    networkPeersConnected: Math.floor(Math.random() * 100) + 20,
    networkLatency: Math.random() * 200,
    verificationConsensusReached: Math.random() * 100,
    rewardsDistributed: Math.random() * 50000,
  };
}

export function generateMockGpuDevices(): GpuDevice[] {
  const backends: Array<'cuda' | 'vulkan' | 'opencl' | 'metal' | 'webgpu'> = [
    'cuda',
    'vulkan',
    'opencl',
  ];

  return Array.from({ length: 4 }, (_, i) => ({
    id: `gpu-${i}`,
    backend: backends[i % backends.length],
    name: `NVIDIA RTX ${3090 + i}`,
    vram: 24000,
    utilization: Math.random() * 100,
    memory: Math.random() * 24000,
    temperature: Math.random() * 40 + 50,
    power: Math.random() * 300 + 100,
    throughput: Math.random() * 100 + 50,
  }));
}

export function generateMockPeers(): Peer[] {
  return Array.from({ length: 10 }, (_, i) => ({
    id: `peer-${i}`,
    reputation: Math.random() * 100,
    isBlacklisted: Math.random() > 0.9,
    capabilities: ['gpu-compute', 'verification', 'storage'],
    lastSeen: Date.now() - Math.random() * 3600000,
    latency: Math.random() * 1000,
  }));
}

export function generateMockTasks(): Task[] {
  const statuses: Array<'pending' | 'running' | 'completed' | 'failed'> = [
    'pending',
    'running',
    'completed',
    'failed',
  ];

  return Array.from({ length: 20 }, (_, i) => ({
    id: `task-${i}`,
    type: ['gpu-compute', 'verification', 'encoding'][Math.floor(Math.random() * 3)],
    status: statuses[Math.floor(Math.random() * statuses.length)],
    submittedAt: Date.now() - Math.random() * 86400000,
    timestamp_created: Date.now() - Math.random() * 86400000,
    timestamp_updated: Date.now() - Math.random() * 3600000,
    startedAt: Date.now() - Math.random() * 7200000,
    completedAt: Date.now(),
    gpuBackend: 'cuda',
    estimatedGpuMemory: Math.random() * 8000 + 2000,
    reward: Math.random() * 100,
    executedBy: `executor-${Math.floor(Math.random() * 10)}`,
    progress: Math.random() * 100,
  }));
}

export function generateMockHealthStatus(): HealthStatus {
  return {
    coordinator: 'healthy',
    nodes: {
      total: 100,
      healthy: Math.floor(Math.random() * 100) + 80,
      degraded: Math.floor(Math.random() * 20),
      offline: Math.floor(Math.random() * 5),
    },
    network: {
      peersConnected: Math.floor(Math.random() * 100) + 20,
      avgLatency: Math.random() * 200,
      bandwidth: Math.random() * 1000,
    },
    uptime: Math.random() * 10000000000,
  };
}

export function generateMockAlerts(): Alert[] {
  const levels: Array<'info' | 'warning' | 'critical'> = ['info', 'warning', 'critical'];

  return Array.from({ length: 5 }, (_, i) => ({
    id: `alert-${i}`,
    level: levels[Math.floor(Math.random() * levels.length)],
    title: ['High GPU Temperature', 'Low Disk Space', 'Node Offline', 'Consensus Failed'][
      Math.floor(Math.random() * 4)
    ],
    message: 'This is a mock alert for testing',
    timestamp: Date.now(),
  }));
}

export const mockData = {
  metrics: generateMockMetrics(),
  gpuDevices: generateMockGpuDevices(),
  peers: generateMockPeers(),
  tasks: generateMockTasks(),
  health: generateMockHealthStatus(),
  alerts: generateMockAlerts(),
};
