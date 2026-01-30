import { useEffect, useState } from 'react';

export type MetricsPeriod = 'day' | 'week' | 'month' | 'quarter' | 'year';

export interface Contributor {
  id: string;
  name: string;
  recordings: number;
  compensation: number;
}

export interface Summary {
  sessionsScheduled: number;
  sessionsCompleted: number;
  onTimePercentage: number;
  totalAssetsCreated: number;
  assetsPublished: number;
  totalCompensationUsd: number;
}

export interface UseMediaMetricsReturn {
  summary?: Summary;
  contributors?: Contributor[];
  loading: boolean;
  error?: string;
  compareWithPrevious: () => {
    completionChange?: number;
    assetChange?: number;
    onTimeChange?: number;
  };
}

export function useMediaMetrics({ rpcUrl, period }: { rpcUrl: string; period: MetricsPeriod | string; autoRefresh?: boolean }): UseMediaMetricsReturn {
  const [loading, setLoading] = useState<boolean>(true);

  // This hook provides a lightweight mock implementation so the dashboard compiles and demonstrates the API surface.
  useEffect(() => {
    const t = setTimeout(() => setLoading(false), 250);
    return () => clearTimeout(t);
  }, [rpcUrl, period]);

  const summary: Summary = {
    sessionsScheduled: 12,
    sessionsCompleted: 9,
    onTimePercentage: 86.4,
    totalAssetsCreated: 20,
    assetsPublished: 12,
    totalCompensationUsd: 420,
  };

  const contributors: Contributor[] = [
    { id: '1', name: 'Alice', recordings: 5, compensation: 200 },
    { id: '2', name: 'Bob', recordings: 3, compensation: 120 },
  ];

  function compareWithPrevious(): { completionChange?: number; assetChange?: number; onTimeChange?: number } {
    return {
      completionChange: 2.4,
      assetChange: 1.2,
      onTimeChange: -0.8,
    };
  }

  return { summary, contributors, loading, error: undefined, compareWithPrevious };
}
