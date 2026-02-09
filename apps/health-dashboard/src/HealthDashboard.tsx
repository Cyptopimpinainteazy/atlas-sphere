/**
 * HealthDashboard.tsx - Real-time system health monitoring
 *
 * Displays:
 * - Service status (8 services)
 * - Real-time metrics (latency, success rate, error rate)
 * - Alert status (15 Prometheus alerts)
 * - Capacity usage (DB pool, cache hit rate, queue depth)
 * - Performance trends (last 1h)
 */

import React, { useState, useEffect, useCallback } from "react";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from "recharts";

interface ServiceStatus {
  name: string;
  status: "up" | "down" | "degraded";
  latency_ms: number;
  uptime_hours: number;
  last_check: string;
  emoji: string;
}

interface MetricPoint {
  timestamp: string;
  rpc_latency: number;
  anchor_latency: number;
  success_rate: number;
  error_rate: number;
  cache_hit_rate: number;
}

interface AlertRule {
  name: string;
  status: "firing" | "resolved";
  severity: "critical" | "warning" | "info";
  value: string;
  threshold: string;
  fired_at: string;
}

interface SystemCapacity {
  db_pool_used: number;
  db_pool_total: number;
  cache_hit_rate: number;
  queue_depth: number;
  memory_usage_percent: number;
  disk_usage_percent: number;
}

const HealthDashboard: React.FC = () => {
  const [services, setServices] = useState<ServiceStatus[]>([]);
  const [metrics, setMetrics] = useState<MetricPoint[]>([]);
  const [alerts, setAlerts] = useState<AlertRule[]>([]);
  const [capacity, setCapacity] = useState<SystemCapacity | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [lastUpdate, setLastUpdate] = useState<string>("");

  // Fetch health data from API
  const fetchHealthData = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      // In production: Replace with actual API endpoints
      const mockServices: ServiceStatus[] = [
        {
          name: "PostgreSQL",
          status: "up",
          latency_ms: 2,
          uptime_hours: 720,
          last_check: new Date().toISOString(),
          emoji: "🗄️",
        },
        {
          name: "Redis",
          status: "up",
          latency_ms: 1,
          uptime_hours: 720,
          last_check: new Date().toISOString(),
          emoji: "⚡",
        },
        {
          name: "Blockchain Node",
          status: "up",
          latency_ms: 125,
          uptime_hours: 48,
          last_check: new Date().toISOString(),
          emoji: "⛓️",
        },
        {
          name: "Jury Service",
          status: "up",
          latency_ms: 45,
          uptime_hours: 720,
          last_check: new Date().toISOString(),
          emoji: "👥",
        },
        {
          name: "Jury Anchorer",
          status: "up",
          latency_ms: 450,
          uptime_hours: 720,
          last_check: new Date().toISOString(),
          emoji: "⚓",
        },
        {
          name: "Prometheus",
          status: "up",
          latency_ms: 15,
          uptime_hours: 720,
          last_check: new Date().toISOString(),
          emoji: "📊",
        },
        {
          name: "Grafana",
          status: "up",
          latency_ms: 80,
          uptime_hours: 720,
          last_check: new Date().toISOString(),
          emoji: "📈",
        },
        {
          name: "AlertManager",
          status: "up",
          latency_ms: 5,
          uptime_hours: 720,
          last_check: new Date().toISOString(),
          emoji: "🚨",
        },
      ];

      const mockMetrics: MetricPoint[] = Array.from({ length: 60 }, (_, i) => ({
        timestamp: new Date(Date.now() - (59 - i) * 60000).toLocaleTimeString(),
        rpc_latency: 80 + Math.random() * 40,
        anchor_latency: 450 + Math.random() * 100,
        success_rate: 99.2 + Math.random() * 0.7,
        error_rate: 0.001 + Math.random() * 0.002,
        cache_hit_rate: 75 + Math.random() * 15,
      }));

      const mockAlerts: AlertRule[] = [
        {
          name: "HighAnchorLatency",
          status: "resolved",
          severity: "warning",
          value: "450ms",
          threshold: ">10s",
          fired_at: "Never",
        },
        {
          name: "LowSuccessRate",
          status: "resolved",
          severity: "warning",
          value: "99.5%",
          threshold: "<99%",
          fired_at: "Never",
        },
        {
          name: "DbPoolExhausted",
          status: "resolved",
          severity: "critical",
          value: "18/50 connections",
          threshold: ">45",
          fired_at: "Never",
        },
        {
          name: "HighMemoryUsage",
          status: "resolved",
          severity: "warning",
          value: "62%",
          threshold: ">85%",
          fired_at: "Never",
        },
      ];

      const mockCapacity: SystemCapacity = {
        db_pool_used: 18,
        db_pool_total: 50,
        cache_hit_rate: 78.5,
        queue_depth: 3,
        memory_usage_percent: 62,
        disk_usage_percent: 45,
      };

      setServices(mockServices);
      setMetrics(mockMetrics);
      setAlerts(mockAlerts);
      setCapacity(mockCapacity);
      setLastUpdate(new Date().toLocaleTimeString());
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unknown error");
    } finally {
      setLoading(false);
    }
  }, []);

  // Fetch on mount and set up polling
  useEffect(() => {
    fetchHealthData();
    const interval = setInterval(fetchHealthData, 10000); // Update every 10s
    return () => clearInterval(interval);
  }, [fetchHealthData]);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen bg-slate-900">
        <div className="text-white text-center">
          <div className="animate-spin text-4xl mb-4">⌛</div>
          <p>Loading health dashboard...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center justify-center h-screen bg-slate-900">
        <div className="text-red-400 text-center">
          <div className="text-4xl mb-4">❌</div>
          <p>Error: {error}</p>
          <button
            onClick={fetchHealthData}
            className="mt-4 px-4 py-2 bg-red-600 hover:bg-red-700 rounded"
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  const up_services = services.filter((s) => s.status === "up").length;
  const total_services = services.length;
  const critical_alerts = alerts.filter((a) => a.severity === "critical" && a.status === "firing").length;

  return (
    <div className="min-h-screen bg-slate-900 text-white p-6 space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <h1 className="text-4xl font-bold">🏥 System Health Dashboard</h1>
        <div className="text-right">
          <p className="text-xl font-semibold">
            {up_services}/{total_services} Services Up
          </p>
          <p className="text-sm text-gray-400">Last updated: {lastUpdate}</p>
        </div>
      </div>

      {/* Quick Stats */}
      <div className="grid grid-cols-4 gap-4">
        <div className="bg-green-900/30 rounded-lg p-4 border border-green-600">
          <p className="text-gray-300 text-sm">Services Healthy</p>
          <p className="text-3xl font-bold text-green-400">{up_services}/{total_services}</p>
        </div>
        <div className={`rounded-lg p-4 border ${critical_alerts > 0 ? "bg-red-900/30 border-red-600" : "bg-gray-800/30 border-gray-600"}`}>
          <p className="text-gray-300 text-sm">Critical Alerts</p>
          <p className={`text-3xl font-bold ${critical_alerts > 0 ? "text-red-400" : "text-gray-400"}`}>
            {critical_alerts}
          </p>
        </div>
        <div className="bg-blue-900/30 rounded-lg p-4 border border-blue-600">
          <p className="text-gray-300 text-sm">Cache Hit Rate</p>
          <p className="text-3xl font-bold text-blue-400">{capacity?.cache_hit_rate.toFixed(1)}%</p>
        </div>
        <div className="bg-purple-900/30 rounded-lg p-4 border border-purple-600">
          <p className="text-gray-300 text-sm">Queue Depth</p>
          <p className="text-3xl font-bold text-purple-400">{capacity?.queue_depth}</p>
        </div>
      </div>

      {/* Services Grid */}
      <div>
        <h2 className="text-2xl font-bold mb-4">Services Status</h2>
        <div className="grid grid-cols-2 gap-4">
          {services.map((svc) => (
            <div
              key={svc.name}
              className={`rounded-lg p-4 border ${
                svc.status === "up"
                  ? "bg-green-900/20 border-green-600"
                  : "bg-red-900/20 border-red-600"
              }`}
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <span className="text-2xl">{svc.emoji}</span>
                  <div>
                    <p className="font-semibold">{svc.name}</p>
                    <p className="text-xs text-gray-400">Latency: {svc.latency_ms}ms</p>
                  </div>
                </div>
                <div className="text-right">
                  <p className={svc.status === "up" ? "text-green-400" : "text-red-400"}>
                    {svc.status.toUpperCase()}
                  </p>
                  <p className="text-xs text-gray-400">{svc.uptime_hours}h uptime</p>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Metrics Graph */}
      <div>
        <h2 className="text-2xl font-bold mb-4">Performance Metrics (Last 60 Minutes)</h2>
        <div className="bg-gray-800/50 rounded-lg p-4 border border-gray-700">
          <ResponsiveContainer width="100%" height={300}>
            <LineChart data={metrics}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="timestamp" />
              <YAxis yAxisId="left" label={{ value: "Latency (ms)", angle: -90, position: "insideLeft" }} />
              <YAxis yAxisId="right" orientation="right" />
              <Tooltip />
              <Legend />
              <Line yAxisId="left" type="monotone" dataKey="rpc_latency" stroke="#8b5cf6" />
              <Line yAxisId="left" type="monotone" dataKey="anchor_latency" stroke="#ef4444" />
              <Line yAxisId="right" type="monotone" dataKey="success_rate" stroke="#22c55e" />
              <Line yAxisId="right" type="monotone" dataKey="cache_hit_rate" stroke="#3b82f6" />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Alerts */}
      <div>
        <h2 className="text-2xl font-bold mb-4">Alert Status</h2>
        <div className="space-y-2">
          {alerts.map((alert) => (
            <div
              key={alert.name}
              className={`rounded-lg p-3 border ${
                alert.status === "firing"
                  ? alert.severity === "critical"
                    ? "bg-red-900/30 border-red-600"
                    : "bg-yellow-900/30 border-yellow-600"
                  : "bg-gray-800/30 border-gray-600"
              }`}
            >
              <div className="flex justify-between items-center">
                <div>
                  <p className="font-semibold">{alert.name}</p>
                  <p className="text-sm text-gray-400">
                    {alert.value} (threshold: {alert.threshold})
                  </p>
                </div>
                <div className="text-right">
                  <p
                    className={`font-semibold ${
                      alert.status === "firing"
                        ? alert.severity === "critical"
                          ? "text-red-400"
                          : "text-yellow-400"
                        : "text-green-400"
                    }`}
                  >
                    {alert.status.toUpperCase()}
                  </p>
                  <p className="text-xs text-gray-400">{alert.fired_at}</p>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Capacity Utilization */}
      <div>
        <h2 className="text-2xl font-bold mb-4">Resource Utilization</h2>
        <div className="grid grid-cols-3 gap-4">
          <div className="bg-gray-800/50 rounded-lg p-4 border border-gray-700">
            <p className="text-gray-300 mb-2">Database Connection Pool</p>
            <div className="w-full bg-gray-700 rounded-full h-2 mb-2">
              <div
                className="bg-blue-500 h-2 rounded-full"
                style={{
                  width: `${(capacity ? (capacity.db_pool_used / capacity.db_pool_total) * 100 : 0).toFixed(0)}%`,
                }}
              />
            </div>
            <p className="text-sm text-gray-400">
              {capacity?.db_pool_used}/{capacity?.db_pool_total} connections
            </p>
          </div>

          <div className="bg-gray-800/50 rounded-lg p-4 border border-gray-700">
            <p className="text-gray-300 mb-2">Memory Usage</p>
            <div className="w-full bg-gray-700 rounded-full h-2 mb-2">
              <div
                className={`h-2 rounded-full ${capacity && capacity.memory_usage_percent > 85 ? "bg-red-500" : "bg-green-500"}`}
                style={{
                  width: `${capacity?.memory_usage_percent || 0}%`,
                }}
              />
            </div>
            <p className="text-sm text-gray-400">{capacity?.memory_usage_percent}% used</p>
          </div>

          <div className="bg-gray-800/50 rounded-lg p-4 border border-gray-700">
            <p className="text-gray-300 mb-2">Disk Space</p>
            <div className="w-full bg-gray-700 rounded-full h-2 mb-2">
              <div
                className={`h-2 rounded-full ${capacity && capacity.disk_usage_percent > 90 ? "bg-red-500" : "bg-green-500"}`}
                style={{
                  width: `${capacity?.disk_usage_percent || 0}%`,
                }}
              />
            </div>
            <p className="text-sm text-gray-400">{capacity?.disk_usage_percent}% used</p>
          </div>
        </div>
      </div>

      {/* Footer */}
      <div className="text-center text-gray-400 text-sm border-t border-gray-700 pt-4">
        <p>Health Dashboard • Polls every 10 seconds</p>
        <p className="text-xs">Phase 5: Jury Blockchain Anchoring</p>
      </div>
    </div>
  );
};

export default HealthDashboard;
