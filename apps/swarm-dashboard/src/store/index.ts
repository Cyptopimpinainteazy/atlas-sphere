import { create } from 'zustand';
import { Metrics } from '@/types/api';

interface MetricsStore {
  metrics: Metrics | null;
  setMetrics: (metrics: Metrics) => void;
  updateMetric: <K extends keyof Metrics>(key: K, value: Metrics[K]) => void;
}

export const useMetricsStore = create<MetricsStore>((set) => ({
  metrics: null,
  setMetrics: (metrics) => set({ metrics }),
  updateMetric: (key, value) =>
    set((state) => ({
      metrics: state.metrics ? { ...state.metrics, [key]: value } : null,
    })),
}));

import { GpuDevice } from '@/types/api';

interface GpuStore {
  devices: GpuDevice[];
  selectedDeviceId: string | null;
  setDevices: (devices: GpuDevice[]) => void;
  selectDevice: (deviceId: string) => void;
  updateDevice: (deviceId: string, device: Partial<GpuDevice>) => void;
}

export const useGpuStore = create<GpuStore>((set) => ({
  devices: [],
  selectedDeviceId: null,
  setDevices: (devices) => set({ devices }),
  selectDevice: (deviceId) => set({ selectedDeviceId: deviceId }),
  updateDevice: (deviceId, deviceUpdates) =>
    set((state) => ({
      devices: state.devices.map((d) =>
        d.id === deviceId ? { ...d, ...deviceUpdates } : d
      ),
    })),
}));

import { Task } from '@/types/api';

interface TaskStore {
  tasks: Task[];
  selectedTaskId: string | null;
  setTasks: (tasks: Task[]) => void;
  selectTask: (taskId: string | null) => void;
  updateTask: (taskId: string, task: Partial<Task>) => void;
  removeTask: (taskId: string) => void;
}

export const useTaskStore = create<TaskStore>((set) => ({
  tasks: [],
  selectedTaskId: null,
  setTasks: (tasks) => set({ tasks }),
  selectTask: (taskId) => set({ selectedTaskId: taskId }),
  updateTask: (taskId, taskUpdates) =>
    set((state) => ({
      tasks: state.tasks.map((t) =>
        t.id === taskId ? { ...t, ...taskUpdates } : t
      ),
    })),
  removeTask: (taskId) =>
    set((state) => ({
      tasks: state.tasks.filter((t) => t.id !== taskId),
    })),
}));

import { Peer } from '@/types/api';

interface NetworkStore {
  peers: Peer[];
  selectedPeerId: string | null;
  setPeers: (peers: Peer[]) => void;
  selectPeer: (peerId: string | null) => void;
  updatePeer: (peerId: string, peer: Partial<Peer>) => void;
}

export const useNetworkStore = create<NetworkStore>((set) => ({
  peers: [],
  selectedPeerId: null,
  setPeers: (peers) => set({ peers }),
  selectPeer: (peerId) => set({ selectedPeerId: peerId }),
  updatePeer: (peerId, peerUpdates) =>
    set((state) => ({
      peers: state.peers.map((p) =>
        p.id === peerId ? { ...p, ...peerUpdates } : p
      ),
    })),
}));

interface UserStore {
  account: string | null;
  theme: 'dark' | 'light' | 'auto';
  refreshInterval: number;
  advancedMode: boolean;
  setAccount: (account: string) => void;
  setTheme: (theme: 'dark' | 'light' | 'auto') => void;
  setRefreshInterval: (interval: number) => void;
  setAdvancedMode: (enabled: boolean) => void;
}

export const useUserStore = create<UserStore>((set) => ({
  account: null,
  theme: 'dark',
  refreshInterval: 5,
  advancedMode: false,
  setAccount: (account) => set({ account }),
  setTheme: (theme) => set({ theme }),
  setRefreshInterval: (interval) => set({ refreshInterval: interval }),
  setAdvancedMode: (enabled) => set({ advancedMode: enabled }),
}));
