import { useMediaMetrics } from '../useMediaMetrics';
import { renderHook, waitFor } from '@testing-library/react';

describe('useMediaMetrics', () => {
  describe('initialization', () => {
    it('initializes with correct default values', () => {
      const { result } = renderHook(() =>
        useMediaMetrics({
          rpcUrl: 'http://localhost:9944',
          period: 'week',
        }),
      );

      expect(result.current.loading).toBe(true);
      expect(result.current.error).toBeUndefined();
    });
  });

  describe('loading state', () => {
    it('sets loading to true initially', () => {
      const { result } = renderHook(() =>
        useMediaMetrics({
          rpcUrl: 'http://localhost:9944',
          period: 'week',
        }),
      );

      expect(result.current.loading).toBe(true);
    });

    it('sets loading to false after data is fetched', async () => {
      const { result } = renderHook(() =>
        useMediaMetrics({
          rpcUrl: 'http://localhost:9944',
          period: 'week',
        }),
      );

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });
    });
  });

  describe('summary data', () => {
    it('provides summary data when loaded', async () => {
      const { result } = renderHook(() =>
        useMediaMetrics({
          rpcUrl: 'http://localhost:9944',
          period: 'week',
          autoRefresh: false,
        }),
      );

      await waitFor(() => {
        expect(result.current.summary).toBeDefined();
      });

      expect(result.current.summary?.sessionsScheduled).toBe(12);
      expect(result.current.summary?.sessionsCompleted).toBe(9);
      expect(result.current.summary?.onTimePercentage).toBe(86.4);
      expect(result.current.summary?.totalAssetsCreated).toBe(20);
      expect(result.current.summary?.assetsPublished).toBe(12);
      expect(result.current.summary?.totalCompensationUsd).toBe(420);
    });
  });

  describe('contributors data', () => {
    it('provides contributors data', async () => {
      const { result } = renderHook(() =>
        useMediaMetrics({
          rpcUrl: 'http://localhost:9944',
          period: 'week',
          autoRefresh: false,
        }),
      );

      await waitFor(() => {
        expect(result.current.contributors).toBeDefined();
      });

      expect(result.current.contributors?.length).toBe(2);
      expect(result.current.contributors?.[0].name).toBe('Alice');
      expect(result.current.contributors?.[1].name).toBe('Bob');
    });
  });

  describe('compareWithPrevious', () => {
    it('provides comparison function', async () => {
      const { result } = renderHook(() =>
        useMediaMetrics({
          rpcUrl: 'http://localhost:9944',
          period: 'week',
          autoRefresh: false,
        }),
      );

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      const comparison = result.current.compareWithPrevious();
      expect(comparison.completionChange).toBe(2.4);
      expect(comparison.assetChange).toBe(1.2);
      expect(comparison.onTimeChange).toBe(-0.8);
    });
  });

  describe('period parameter', () => {
    it('accepts different period values', async () => {
      const periods = ['day', 'week', 'month', 'quarter', 'year'] as const;

      for (const period of periods) {
        const { result } = renderHook(() =>
          useMediaMetrics({
            rpcUrl: 'http://localhost:9944',
            period,
            autoRefresh: false,
          }),
        );

        await waitFor(() => {
          expect(result.current.loading).toBe(false);
        });

        expect(result.current.summary).toBeDefined();
      }
    });
  });

  describe('rpcUrl handling', () => {
    it('uses provided rpcUrl', () => {
      const rpcUrl = 'http://custom-rpc:9944';
      const { result } = renderHook(() =>
        useMediaMetrics({
          rpcUrl,
          period: 'week',
          autoRefresh: false,
        }),
      );

      expect(result.current).toBeDefined();
    });

    it('responds to rpcUrl changes', async () => {
      const { result, rerender } = renderHook(
        ({ rpcUrl }: { rpcUrl: string }) =>
          useMediaMetrics({
            rpcUrl,
            period: 'week',
            autoRefresh: false,
          }),
        { initialProps: { rpcUrl: 'http://localhost:9944' } },
      );

      rerender({ rpcUrl: 'http://new-rpc:9944' });

      await waitFor(() => {
        expect(result.current.summary).toBeDefined();
      });
    });
  });

  describe('autoRefresh option', () => {
    it('can be disabled', async () => {
      const { result } = renderHook(() =>
        useMediaMetrics({
          rpcUrl: 'http://localhost:9944',
          period: 'week',
          autoRefresh: false,
        }),
      );

      await waitFor(() => {
        expect(result.current.summary).toBeDefined();
      });
    });
  });

  describe('type safety', () => {
    it('returns properly typed summary object', async () => {
      const { result } = renderHook(() =>
        useMediaMetrics({
          rpcUrl: 'http://localhost:9944',
          period: 'week',
          autoRefresh: false,
        }),
      );

      await waitFor(() => {
        expect(result.current.summary).toBeDefined();
      });

      const summary = result.current.summary!;
      expect(typeof summary.sessionsScheduled).toBe('number');
      expect(typeof summary.sessionsCompleted).toBe('number');
      expect(typeof summary.onTimePercentage).toBe('number');
      expect(typeof summary.totalAssetsCreated).toBe('number');
      expect(typeof summary.assetsPublished).toBe('number');
      expect(typeof summary.totalCompensationUsd).toBe('number');
    });

    it('returns properly typed contributor objects', async () => {
      const { result } = renderHook(() =>
        useMediaMetrics({
          rpcUrl: 'http://localhost:9944',
          period: 'week',
          autoRefresh: false,
        }),
      );

      await waitFor(() => {
        expect(result.current.contributors).toBeDefined();
      });

      const contributor = result.current.contributors![0];
      expect(typeof contributor.id).toBe('string');
      expect(typeof contributor.name).toBe('string');
      expect(typeof contributor.recordings).toBe('number');
      expect(typeof contributor.compensation).toBe('number');
    });
  });
});
