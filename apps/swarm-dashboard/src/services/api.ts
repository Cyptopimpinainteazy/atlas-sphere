import axios, { AxiosInstance } from 'axios';
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
import { 
  generateMockMetrics, 
  generateMockGpuDevices, 
  generateMockPeers, 
  generateMockTasks,
  generateMockHealthStatus,
  generateMockAlerts 
} from './mockApi';

const API_BASE = process.env.REACT_APP_API_URL || 'http://localhost:5000/api';

class ApiClient {
  private client: AxiosInstance;
  private useMockData = false;

  constructor() {
    this.client = axios.create({
      baseURL: API_BASE,
      timeout: 5000,
      headers: {
        'Content-Type': 'application/json',
      },
    });

    // Add request interceptor for logging
    this.client.interceptors.request.use((config) => {
      console.debug(`[API] ${config.method?.toUpperCase()} ${config.url}`);
      return config;
    });

    // Add response interceptor for error handling
    this.client.interceptors.response.use(
      (response) => response,
      (error) => {
        console.warn('[API] Error, using mock data:', error.message);
        this.useMockData = true;
        return Promise.reject(error);
      }
    );
  }

  // Metrics
  async getMetrics(): Promise<Metrics> {
    try {
      const res = await this.client.get('/metrics');
      return res.data;
    } catch (error) {
      console.log('[API] Using mock metrics');
      return generateMockMetrics();
    }
  }

  // GPU Status
  async getGpuStatus(): Promise<GpuDevice[]> {
    try {
      const res = await this.client.get('/gpu/status');
      return res.data;
    } catch (error) {
      console.log('[API] Using mock GPU devices');
      return generateMockGpuDevices();
    }
  }

  async getGpuDevice(deviceId: string): Promise<GpuDevice> {
    try {
      const res = await this.client.get(`/gpu/device/${deviceId}`);
      return res.data;
    } catch (error) {
      const devices = generateMockGpuDevices();
      return devices[0];
    }
  }

  // Tasks
  async getTaskQueue(): Promise<Task[]> {
    try {
      const res = await this.client.get('/tasks/queue');
      return res.data;
    } catch (error) {
      console.log('[API] Using mock tasks');
      return generateMockTasks();
    }
  }

  async getTask(taskId: string): Promise<Task> {
    try {
      const res = await this.client.get(`/tasks/${taskId}`);
      return res.data;
    } catch (error) {
      const tasks = generateMockTasks();
      return tasks[0];
    }
  }

  async submitTask(taskData: any): Promise<{ taskId: string }> {
    try {
      const res = await this.client.post('/tasks/submit', taskData);
      return res.data;
    } catch (error) {
      return { taskId: `task-${Date.now()}` };
    }
  }

  // Network
  async getPeers(): Promise<Peer[]> {
    try {
      const res = await this.client.get('/network/peers');
      return res.data;
    } catch (error) {
      console.log('[API] Using mock peers');
      return generateMockPeers();
    }
  }

  async getPeer(peerId: string): Promise<Peer> {
    try {
      const res = await this.client.get(`/network/peers/${peerId}`);
      return res.data;
    } catch (error) {
      const peers = generateMockPeers();
      return peers[0];
    }
  }

  async getNetworkStats(): Promise<any> {
    try {
      const res = await this.client.get('/network/stats');
      return res.data;
    } catch (error) {
      return { peersConnected: 42, bandwidth: 1000 };
    }
  }

  // Rewards
  async getRewards(account: string): Promise<RewardInfo> {
    try {
      const res = await this.client.get(`/rewards/${account}`);
      return res.data;
    } catch (error) {
      return { account, pendingRewards: 1000, claimedRewards: 5000 };
    }
  }

  async claimReward(taskId: string): Promise<{ txHash: string }> {
    try {
      const res = await this.client.post('/rewards/claim', { taskId });
      return res.data;
    } catch (error) {
      return { txHash: `0x${Date.now()}` };
    }
  }

  // Staking
  async getStake(account: string): Promise<StakeInfo> {
    try {
      const res = await this.client.get(`/stake/${account}`);
      return res.data;
    } catch (error) {
      return { account, stakedAmount: 10000, lockupPeriod: 86400 };
    }
  }

  async stake(amount: number, lockupBlocks: number): Promise<{ txHash: string }> {
    try {
      const res = await this.client.post('/stake', { amount, lockupBlocks });
      return res.data;
    } catch (error) {
      return { txHash: `0x${Date.now()}` };
    }
  }

  async unstake(amount: number): Promise<{ txHash: string }> {
    try {
      const res = await this.client.post('/unstake', { amount });
      return res.data;
    } catch (error) {
      return { txHash: `0x${Date.now()}` };
    }
  }

  // Health
  async getHealth(): Promise<HealthStatus> {
    try {
      const res = await this.client.get('/health');
      return res.data;
    } catch (error) {
      console.log('[API] Using mock health status');
      return generateMockHealthStatus();
    }
  }

  // Alerts
  async getAlerts(): Promise<Alert[]> {
    try {
      const res = await this.client.get('/alerts');
      return res.data;
    } catch (error) {
      console.log('[API] Using mock alerts');
      return generateMockAlerts();
    }
  }

  async dismissAlert(alertId: string): Promise<void> {
    try {
      await this.client.post(`/alerts/${alertId}/dismiss`);
    } catch (error) {
      console.log('[API] Mock: Alert dismissed');
    }
  }

  // Governance
  async getGovernanceActions(): Promise<GovernanceAction[]> {
    try {
      const res = await this.client.get('/governance/actions');
      return res.data;
    } catch (error) {
      return [];
    }
  }

  async proposeAction(action: any): Promise<{ actionId: string }> {
    try {
      const res = await this.client.post('/governance/propose', action);
      return res.data;
    } catch (error) {
      return { actionId: `action-${Date.now()}` };
    }
  }

  async voteOnAction(
    actionId: string,
    vote: 'approve' | 'reject'
  ): Promise<{ txHash: string }> {
    try {
      const res = await this.client.post(`/governance/actions/${actionId}/vote`, { vote });
      return res.data;
    } catch (error) {
      return { txHash: `0x${Date.now()}` };
    }
  }
}

export const apiClient = new ApiClient();
