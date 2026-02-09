// API Response Types
export interface ApiResponse<T> {
  success: boolean;
  data: T;
  error?: string;
  timestamp: number;
}

// Metrics
export interface Metrics {
  tasksSubmitted: number;
  tasksCompleted: number;
  tasksFailed: number;
  taskExecutionTime: number;
  gpuUtilization: number;
  gpuMemoryUsed: number;
  gpuTemperature: number;
  gpuPower: number;
  networkPeersConnected: number;
  networkLatency: number;
  verificationConsensusReached: number;
  rewardsDistributed: number;
}

// GPU Device
export interface GpuDevice {
  id: string;
  backend: 'cuda' | 'vulkan' | 'opencl' | 'metal' | 'webgpu';
  name: string;
  vram: number; // MB
  utilization: number; // 0-100
  memory: number; // MB used
  temperature: number; // Celsius
  power: number; // Watts
  throughput: number; // GFLOPS
}

// Peer
export interface Peer {
  id: string;
  reputation: number; // 0-100
  isBlacklisted: boolean;
  capabilities: string[];
  lastSeen: number;
  latency: number; // ms
}

// Task
export interface Task {
  id: string;
  type: string;
  status: 'pending' | 'running' | 'completed' | 'failed';
  submittedAt: number;
  timestamp_created: number;
  timestamp_updated: number;
  startedAt?: number;
  completedAt?: number;
  gpuBackend: string;
  gpu_backend?: string;
  estimatedGpuMemory: number;
  memory_required?: number;
  reward: number;
  executor?: string;
  executedBy?: string;
  progress?: number;
}

// Reward Info
export interface RewardInfo {
  account: string;
  pendingRewards: number;
  claimedRewards: number;
  lastClaim?: number;
}

// Stake Info
export interface StakeInfo {
  account: string;
  stakedAmount: number;
  lockupPeriod: number;
  lockupExpires?: number;
}

// Health Check
export interface HealthStatus {
  coordinator: 'healthy' | 'degraded' | 'unhealthy';
  nodes: {
    total: number;
    healthy: number;
    degraded: number;
    offline: number;
  };
  network: {
    peersConnected: number;
    avgLatency: number;
    bandwidth: number;
  };
  uptime: number;
}

// Alert
export interface Alert {
  id: string;
  level: 'info' | 'warning' | 'critical';
  title: string;
  message: string;
  timestamp: number;
  resolved?: boolean;
}

// Governance Action
export interface GovernanceAction {
  id: string;
  type: string;
  status: 'pending' | 'approved' | 'executed' | 'rejected';
  description: string;
  proposedAt: number;
  executedAt?: number;
}
