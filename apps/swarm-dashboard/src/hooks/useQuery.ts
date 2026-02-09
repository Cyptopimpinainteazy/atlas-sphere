import { useQuery, QueryClient } from '@tanstack/react-query';
import { apiClient } from '@/services/api';

export const queryClient = new QueryClient();

export const useMetrics = () => {
  return useQuery({
    queryKey: ['metrics'],
    queryFn: () => apiClient.getMetrics(),
    refetchInterval: 5000, // Refresh every 5 seconds
    staleTime: 3000,
  });
};

export const useGpuStatus = () => {
  return useQuery({
    queryKey: ['gpu-status'],
    queryFn: () => apiClient.getGpuStatus(),
    refetchInterval: 2000, // Refresh every 2 seconds (realtime)
    staleTime: 1000,
  });
};

export const useTasks = () => {
  return useQuery({
    queryKey: ['tasks'],
    queryFn: () => apiClient.getTaskQueue(),
    refetchInterval: 3000,
    staleTime: 2000,
  });
};

export const usePeers = () => {
  return useQuery({
    queryKey: ['peers'],
    queryFn: () => apiClient.getPeers(),
    refetchInterval: 10000,
    staleTime: 5000,
  });
};

export const useHealth = () => {
  return useQuery({
    queryKey: ['health'],
    queryFn: () => apiClient.getHealth(),
    refetchInterval: 5000,
    staleTime: 3000,
  });
};

export const useAlerts = () => {
  return useQuery({
    queryKey: ['alerts'],
    queryFn: () => apiClient.getAlerts(),
    refetchInterval: 2000,
    staleTime: 1000,
  });
};
