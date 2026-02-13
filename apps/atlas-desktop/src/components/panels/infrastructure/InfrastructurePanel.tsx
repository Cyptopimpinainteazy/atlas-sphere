/**
 * InfrastructurePanel — infrastructure monitoring dashboard integrated into Atlas Desktop.
 *
 * Displays: Validator stats, Bridge status, GPU Lane health, Chain stats, TPS metrics.
 * Connects to the same backend endpoints as the standalone infenstructior-dashboard.
 */
import React, { useState, useEffect, useCallback } from 'react';

/* ── Types ─────────────────────────────────────────── */
interface BridgeStats {
  total_received: number;
  total_forwarded: number;
  total_failed: number;
  uptime_seconds: number;
  current_tps: number;
}

interface GPULane {
  id: number;
  service: string;
  status: string;
  utilization: number;
  memory_used_mb: number;
  temperature_c: number;
  total_requests: number;
  success_rate: number;
  txns_per_second: number;
}

interface ChainStats {
  port: number;
  uptime_seconds: number;
  total_requests: number;
  cached_responses: number;
  gpu_accelerated: number;
  errors: number;
}

/* ── API helpers ───────────────────────────────────── */
const BRIDGE_URL = 'http://localhost:9999';
const RPC_PROXY_URL = 'http://localhost:8899';

async function fetchJSON<T>(url: string): Promise<T | null> {
  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(3000) });
    if (!res.ok) return null;
    return await res.json();
  } catch { return null; }
}

/* ── Component ─────────────────────────────────────── */
const InfrastructurePanel: React.FC = () => {
  const [bridge, setBridge] = useState<BridgeStats | null>(null);
  const [gpuLanes, setGpuLanes] = useState<GPULane[]>([]);
  const [chain, setChain] = useState<ChainStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [lastUpdate, setLastUpdate] = useState<string>('');
  const [tpsHistory, setTpsHistory] = useState<number[]>([]);
  const [connectionStatus, setConnectionStatus] = useState<'connected' | 'partial' | 'offline'>('offline');

  const loadStats = useCallback(async () => {
    const [bridgeData, gpuData, chainData] = await Promise.all([
      fetchJSON<BridgeStats>(`${BRIDGE_URL}/stats`),
      fetchJSON<{ lanes: GPULane[] }>(`${BRIDGE_URL}/gpu/health`).then(d => {
        if (d && Array.isArray((d as any))) return d as unknown as GPULane[];
        if (d && 'lanes' in d) return d.lanes;
        return [];
      }).catch(() => [] as GPULane[]),
      fetchJSON<{ proxy: ChainStats }>(`${RPC_PROXY_URL}/stats`).then(d => d?.proxy ?? null).catch(() => null),
    ]);

    const hasAny = bridgeData || gpuData.length > 0 || chainData;
    setConnectionStatus(
      bridgeData && chainData ? 'connected' :
      hasAny ? 'partial' : 'offline'
    );

    if (bridgeData) {
      setBridge(bridgeData);
      setTpsHistory(prev => [...prev.slice(-60), Math.round(bridgeData.current_tps)]);
    }
    if (gpuData.length > 0) setGpuLanes(gpuData);
    if (chainData) setChain(chainData);
    setLastUpdate(new Date().toLocaleTimeString());
    setLoading(false);
  }, []);

  useEffect(() => {
    loadStats();
    const iv = setInterval(loadStats, 3000);
    return () => clearInterval(iv);
  }, [loadStats]);

  const formatUptime = (s: number) => {
    const h = Math.floor(s / 3600);
    const m = Math.floor((s % 3600) / 60);
    return `${h}h ${m}m`;
  };

  const formatNum = (n: number) => n.toLocaleString();

  /* ── Inline TPS sparkline (ASCII-style bar chart) ── */
  const maxTps = Math.max(...tpsHistory, 1);
  const sparkBars = tpsHistory.slice(-30);

  /* ── Styles ── */
  const c = {
    root: { display: 'flex', flexDirection: 'column' as const, height: '100%', background: '#0a0e17', color: '#e0e0e0', fontFamily: '-apple-system, BlinkMacSystemFont, monospace', fontSize: '0.8rem', overflow: 'auto' },
    header: { display: 'flex', alignItems: 'center', gap: 8, padding: '10px 14px', borderBottom: '1px solid #1a1f2e', flexShrink: 0 },
    grid: { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 10, padding: 14 },
    card: { background: '#111827', border: '1px solid #1f2937', borderRadius: 10, padding: '12px 14px' },
    cardTitle: { fontSize: '0.7rem', color: '#9ca3af', textTransform: 'uppercase' as const, letterSpacing: 1, marginBottom: 6, display: 'flex', alignItems: 'center', gap: 4 },
    bigNum: { fontSize: '1.3rem', fontWeight: 700, marginBottom: 2 },
    sub: { fontSize: '0.7rem', color: '#6b7280' },
    statusDot: (ok: boolean) => ({ display: 'inline-block', width: 8, height: 8, borderRadius: '50%', background: ok ? '#10b981' : '#ef4444', marginRight: 4 }),
    gpuRow: { display: 'flex', alignItems: 'center', gap: 8, padding: '6px 0', borderBottom: '1px solid #1f2937' },
    bar: (_pct: number, _color: string) => ({ width: 60, height: 6, background: '#1f2937', borderRadius: 3, overflow: 'hidden' as const, display: 'inline-block' }),
    barFill: (pct: number, color: string) => ({ width: `${pct}%`, height: '100%', background: color, borderRadius: 3 }),
  };

  const statusColors = { connected: '#10b981', partial: '#f59e0b', offline: '#ef4444' };
  const statusLabel = { connected: 'All Systems', partial: 'Partial', offline: 'Offline' };

  return (
    <div style={c.root}>
      {/* Header */}
      <div style={c.header}>
        <span style={{ fontSize: '1.1rem' }}>🏗️</span>
        <span style={{ fontWeight: 700, fontSize: '0.95rem' }}>Infrastructure Monitor</span>
        <div style={{ flex: 1 }} />
        <span style={{ ...c.statusDot(connectionStatus === 'connected') as any, background: statusColors[connectionStatus] }} />
        <span style={{ fontSize: '0.72rem', color: statusColors[connectionStatus] }}>{statusLabel[connectionStatus]}</span>
        <span style={{ fontSize: '0.65rem', color: '#555', marginLeft: 8 }}>{lastUpdate}</span>
        <button onClick={loadStats} style={{ background: 'transparent', border: '1px solid #2a2f3e', borderRadius: 6, padding: '3px 8px', color: '#999', cursor: 'pointer', fontSize: '0.72rem', marginLeft: 4 }}>
          ↻ Refresh
        </button>
      </div>

      {loading ? (
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', flex: 1, color: '#666' }}>
          Loading infrastructure data…
        </div>
      ) : (
        <>
          {/* Top metric cards */}
          <div style={c.grid}>
            {/* Bridge Status */}
            <div style={c.card}>
              <div style={c.cardTitle as React.CSSProperties}>🌉 Bridge</div>
              <div style={{ ...c.bigNum, color: bridge ? '#10b981' : '#ef4444' }}>
                {bridge ? `${bridge.current_tps.toFixed(0)} TPS` : 'Offline'}
              </div>
              {bridge && (
                <>
                  <div style={c.sub}>Received: {formatNum(bridge.total_received)}</div>
                  <div style={c.sub}>Forwarded: {formatNum(bridge.total_forwarded)}</div>
                  <div style={c.sub}>Failed: {formatNum(bridge.total_failed)}</div>
                  <div style={c.sub}>Uptime: {formatUptime(bridge.uptime_seconds)}</div>
                </>
              )}
            </div>

            {/* Chain / RPC Proxy */}
            <div style={c.card}>
              <div style={c.cardTitle as React.CSSProperties}>⛓️ RPC Proxy</div>
              <div style={{ ...c.bigNum, color: chain ? '#3b82f6' : '#ef4444' }}>
                {chain ? formatNum(chain.total_requests) : 'Offline'}
              </div>
              {chain && (
                <>
                  <div style={c.sub}>Port: {chain.port}</div>
                  <div style={c.sub}>Cached: {formatNum(chain.cached_responses)}</div>
                  <div style={c.sub}>GPU Accel: {formatNum(chain.gpu_accelerated)}</div>
                  <div style={c.sub}>Errors: {formatNum(chain.errors)}</div>
                  <div style={c.sub}>Uptime: {formatUptime(chain.uptime_seconds)}</div>
                </>
              )}
            </div>

            {/* GPU Summary */}
            <div style={c.card}>
              <div style={c.cardTitle as React.CSSProperties}>🎮 GPU Lanes</div>
              <div style={{ ...c.bigNum, color: gpuLanes.length > 0 ? '#a78bfa' : '#666' }}>
                {gpuLanes.length > 0 ? `${gpuLanes.length} Active` : 'No Lanes'}
              </div>
              {gpuLanes.length > 0 && (
                <>
                  <div style={c.sub}>Avg Util: {(gpuLanes.reduce((s, g) => s + g.utilization, 0) / gpuLanes.length).toFixed(0)}%</div>
                  <div style={c.sub}>Success Rate: {(gpuLanes.reduce((s, g) => s + g.success_rate, 0) / gpuLanes.length).toFixed(1)}%</div>
                  <div style={c.sub}>Total Req: {formatNum(gpuLanes.reduce((s, g) => s + g.total_requests, 0))}</div>
                </>
              )}
            </div>

            {/* TPS Sparkline */}
            <div style={c.card}>
              <div style={c.cardTitle as React.CSSProperties}>📈 TPS History</div>
              {sparkBars.length > 0 ? (
                <div style={{ display: 'flex', alignItems: 'flex-end', gap: 1, height: 48, marginTop: 4 }}>
                  {sparkBars.map((v, i) => (
                    <div key={i} style={{
                      flex: 1,
                      height: `${Math.max(2, (v / maxTps) * 100)}%`,
                      background: v > maxTps * 0.8 ? '#ef4444' : v > maxTps * 0.5 ? '#f59e0b' : '#10b981',
                      borderRadius: 2,
                      minWidth: 2,
                    }} />
                  ))}
                </div>
              ) : (
                <div style={{ color: '#555', fontSize: '0.72rem', marginTop: 8 }}>Waiting for data…</div>
              )}
              {sparkBars.length > 0 && (
                <div style={{ ...c.sub, marginTop: 4 }}>
                  Peak: {Math.max(...sparkBars)} TPS &nbsp;|&nbsp; Current: {sparkBars[sparkBars.length - 1] ?? 0} TPS
                </div>
              )}
            </div>
          </div>

          {/* GPU Lane Details */}
          {gpuLanes.length > 0 && (
            <div style={{ padding: '0 14px 14px' }}>
              <div style={{ ...c.card }}>
                <div style={c.cardTitle as React.CSSProperties}>🎮 GPU Lane Details</div>
                <div style={{ fontSize: '0.7rem' }}>
                  <div style={{ display: 'flex', padding: '4px 0', color: '#555', fontWeight: 600, borderBottom: '1px solid #1f2937' }}>
                    <span style={{ width: 40 }}>ID</span>
                    <span style={{ flex: 1 }}>Service</span>
                    <span style={{ width: 60 }}>Status</span>
                    <span style={{ width: 80 }}>Utilization</span>
                    <span style={{ width: 70 }}>Memory</span>
                    <span style={{ width: 50 }}>Temp</span>
                    <span style={{ width: 70, textAlign: 'right' }}>TPS</span>
                  </div>
                  {gpuLanes.map((lane, i) => (
                    <div key={i} style={c.gpuRow}>
                      <span style={{ width: 40, color: '#9ca3af' }}>#{lane.id}</span>
                      <span style={{ flex: 1 }}>{lane.service}</span>
                      <span style={{ width: 60 }}>
                        <span style={c.statusDot(lane.status === 'healthy')} />
                        <span style={{ color: lane.status === 'healthy' ? '#10b981' : '#f59e0b', fontSize: '0.65rem' }}>
                          {lane.status}
                        </span>
                      </span>
                      <span style={{ width: 80, display: 'flex', alignItems: 'center', gap: 4 }}>
                        <div style={c.bar(lane.utilization, '')}>
                          <div style={c.barFill(lane.utilization, lane.utilization > 80 ? '#ef4444' : lane.utilization > 50 ? '#f59e0b' : '#10b981')} />
                        </div>
                        <span style={{ fontSize: '0.65rem', color: '#9ca3af' }}>{lane.utilization}%</span>
                      </span>
                      <span style={{ width: 70, fontSize: '0.7rem', color: '#9ca3af' }}>{lane.memory_used_mb}MB</span>
                      <span style={{ width: 50, fontSize: '0.7rem', color: lane.temperature_c > 80 ? '#ef4444' : '#9ca3af' }}>{lane.temperature_c}°C</span>
                      <span style={{ width: 70, textAlign: 'right', fontWeight: 600, color: '#3b82f6' }}>{lane.txns_per_second.toFixed(1)}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* Offline notice */}
          {connectionStatus === 'offline' && (
            <div style={{ margin: '0 14px 14px', padding: 20, background: '#1f1215', border: '1px solid #7f1d1d', borderRadius: 10, textAlign: 'center' }}>
              <div style={{ fontSize: '1.5rem', marginBottom: 8 }}>🔌</div>
              <div style={{ fontWeight: 700, color: '#fca5a5', marginBottom: 4 }}>Infrastructure Offline</div>
              <div style={{ color: '#9ca3af', fontSize: '0.75rem' }}>
                Could not connect to Bridge ({BRIDGE_URL}) or RPC Proxy ({RPC_PROXY_URL}).
                <br />Start the infrastructure services and this panel will auto-connect.
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
};

export default InfrastructurePanel;
