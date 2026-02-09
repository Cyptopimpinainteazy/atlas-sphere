import { useEffect, useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import { ipcListen } from "@/services/ipcService";
import type {
  TelemetrySnapshot,
  SwarmHealthData,
  NetworkControlData,
  StorageMonitorData,
  IdeTelemetryData,
} from "@/types/panelTelemetry";
import { TELEMETRY_EVENT } from "@/types/panelTelemetry";

async function loadSnapshot(): Promise<TelemetrySnapshot> {
  const [swarm, network, storage, ide] = await Promise.all([
    invoke<SwarmHealthData>("launch_swarm_health"),
    invoke<NetworkControlData>("launch_network_control"),
    invoke<StorageMonitorData>("launch_storage_monitor"),
    invoke<IdeTelemetryData>("launch_ide_ipc"),
  ]);

  return {
    swarm,
    network,
    storage,
    ide,
    updatedAt: swarm.updatedAt,
  };
}

export type TelemetryStreamState = {
  data: TelemetrySnapshot | null;
  loading: boolean;
  error: string | null;
};

export function useTelemetryStream(): TelemetryStreamState {
  const [data, setData] = useState<TelemetrySnapshot | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let mounted = true;
    let unlisten: (() => void) | null = null;

    const init = async () => {
      try {
        const snapshot = await loadSnapshot();
        if (!mounted) return;
        setData(snapshot);
        setError(null);
      } catch (err) {
        if (!mounted) return;
        const message = typeof err === "string" ? err : (err as Record<string, string>)?.message ?? "Unknown error";
        setError(message);
      } finally {
        if (mounted) setLoading(false);
      }
    };

    const listen = async () => {
      unlisten = await ipcListen<TelemetrySnapshot>(TELEMETRY_EVENT, (payload) => {
        if (!mounted) return;
        setData(payload);
      });
    };

    init();
    listen();

    return () => {
      mounted = false;
      if (unlisten) unlisten();
    };
  }, []);

  return { data, loading, error };
}
