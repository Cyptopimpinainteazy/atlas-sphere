import { invoke } from "@tauri-apps/api/core";
import { useCallback, useEffect, useRef, useState } from "react";

export type UseTauriPollingResult<T> = {
  data: T | null;
  loading: boolean;
  error: string | null;
  refresh: () => Promise<void>;
};

export function useTauriPolling<T>(command: string, intervalMs = 5000): UseTauriPollingResult<T> {
  const [data, setData] = useState<T | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const mounted = useRef(true);
  const firstLoad = useRef(true);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const fetchData = useCallback(async () => {
    if (!mounted.current) return;
    if (firstLoad.current) {
      setLoading(true);
    }

    try {
      const payload = await invoke<T>(command);
      if (!mounted.current) return;
      setData(payload);
      setError(null);
    } catch (err: unknown) {
      if (!mounted.current) return;
      const message = typeof err === "string" ? err : (err as Record<string, string>)?.message ?? "Unknown error";
      setError(message);
    } finally {
      if (!mounted.current) return;
      setLoading(false);
      firstLoad.current = false;
    }
  }, [command]);

  useEffect(() => {
    mounted.current = true;
    fetchData();

    if (intervalMs > 0) {
      intervalRef.current = setInterval(fetchData, intervalMs);
    }

    return () => {
      mounted.current = false;
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    };
  }, [fetchData, intervalMs]);

  const refresh = useCallback(async () => {
    await fetchData();
  }, [fetchData]);

  return { data, loading, error, refresh };
}
