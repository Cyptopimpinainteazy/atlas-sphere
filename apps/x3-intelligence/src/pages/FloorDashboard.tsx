// Floor Dashboard — live stats and execution feed

import { useState, useEffect } from "react";
import type { FloorStats, ArbIntent } from "../types";
import { IntentState } from "../types";

// Demo data for static rendering — replaced by API in production.
const DEMO_STATS: FloorStats = {
  activeAgents: 47,
  totalIntents: 12_849,
  totalVolume: "84,291,003.21",
  totalSlashes: 23,
  totalDisputes: 7,
  avgSuccessRate: 94.7,
  activeFlashloans: 3,
};

const DEMO_FEED: ArbIntent[] = [
  {
    id: "0xa3f1..8c02",
    agentId: "agent-alpha",
    state: IntentState.Finalized,
    legs: [
      { chain: "ETH", protocol: "UniV3", tokenIn: "WETH", tokenOut: "USDC", amountIn: "10.0", expectedOut: "18,421.50" },
      { chain: "ARB", protocol: "Camelot", tokenIn: "USDC", tokenOut: "WETH", amountIn: "18,421.50", expectedOut: "10.04" },
    ],
    feeCap: 42.0,
    feeActual: 38.2,
    createdAt: Date.now() - 12000,
    executedAt: Date.now() - 8000,
    proofHash: "e9c1a2b3d4f5...",
  },
  {
    id: "0xb7e2..1a4f",
    agentId: "agent-bravo",
    state: IntentState.Executing,
    legs: [
      { chain: "SOL", protocol: "Raydium", tokenIn: "SOL", tokenOut: "USDC", amountIn: "500", expectedOut: "48,250.00" },
    ],
    feeCap: 25.0,
    feeActual: null,
    createdAt: Date.now() - 3000,
    executedAt: null,
    proofHash: null,
  },
  {
    id: "0xd4c3..9f87",
    agentId: "agent-delta",
    state: IntentState.Slashed,
    legs: [
      { chain: "ETH", protocol: "UniV3", tokenIn: "USDC", tokenOut: "DAI", amountIn: "50,000", expectedOut: "49,995" },
    ],
    feeCap: 12.0,
    feeActual: null,
    createdAt: Date.now() - 60000,
    executedAt: null,
    proofHash: "f8a1b2c3d4e5...",
  },
];

function stateColor(state: IntentState): string {
  switch (state) {
    case IntentState.Finalized: return "badge-green";
    case IntentState.Executing:
    case IntentState.Executed: return "badge-blue";
    case IntentState.Slashed: return "badge-red";
    case IntentState.Expired:
    case IntentState.Cancelled: return "badge-muted";
    default: return "badge-amber";
  }
}

function timeSince(ts: number): string {
  const seconds = Math.floor((Date.now() - ts) / 1000);
  if (seconds < 60) return `${seconds}s ago`;
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
  return `${Math.floor(seconds / 3600)}h ago`;
}

export function FloorDashboard() {
  const [stats] = useState<FloorStats>(DEMO_STATS);
  const [feed] = useState<ArbIntent[]>(DEMO_FEED);
  const [_tick, setTick] = useState(0);

  // Re-render every second for relative timestamps
  useEffect(() => {
    const interval = setInterval(() => setTick((t) => t + 1), 1000);
    return () => clearInterval(interval);
  }, []);

  return (
    <div className="page">
      <div className="page-header">
        <h1>X3 Floor</h1>
        <span className="subtitle">Arbitrage jurisdiction — live</span>
      </div>

      {/* Stats */}
      <div className="stats-grid">
        <div className="stat-card">
          <div className="stat-label">Active Agents</div>
          <div className="stat-value green">{stats.activeAgents}</div>
        </div>
        <div className="stat-card">
          <div className="stat-label">Total Intents</div>
          <div className="stat-value">{stats.totalIntents.toLocaleString()}</div>
        </div>
        <div className="stat-card">
          <div className="stat-label">Volume (USDC)</div>
          <div className="stat-value">{stats.totalVolume}</div>
        </div>
        <div className="stat-card">
          <div className="stat-label">Success Rate</div>
          <div className="stat-value green">{stats.avgSuccessRate}%</div>
        </div>
        <div className="stat-card">
          <div className="stat-label">Total Slashes</div>
          <div className="stat-value red">{stats.totalSlashes}</div>
        </div>
        <div className="stat-card">
          <div className="stat-label">Disputes</div>
          <div className="stat-value amber">{stats.totalDisputes}</div>
        </div>
        <div className="stat-card">
          <div className="stat-label">Active Flashloans</div>
          <div className="stat-value blue">{stats.activeFlashloans}</div>
        </div>
      </div>

      {/* Live Execution Feed */}
      <div className="card">
        <div className="card-header">
          <h2>Execution Feed</h2>
          <span className="secondary mono" style={{ fontSize: 11 }}>LIVE</span>
        </div>
        <div className="table-wrapper">
          <table>
            <thead>
              <tr>
                <th>Intent</th>
                <th>Agent</th>
                <th>State</th>
                <th>Route</th>
                <th>Fee</th>
                <th>Proof</th>
                <th>Time</th>
              </tr>
            </thead>
            <tbody>
              {feed.map((intent) => (
                <tr key={intent.id}>
                  <td className="mono hash">{intent.id}</td>
                  <td className="mono" style={{ fontSize: 12 }}>{intent.agentId}</td>
                  <td>
                    <span className={`badge ${stateColor(intent.state)}`}>
                      {intent.state}
                    </span>
                  </td>
                  <td style={{ fontSize: 12 }}>
                    {intent.legs.map((leg, i) => (
                      <span key={i}>
                        {i > 0 && " → "}
                        <span className="secondary">{leg.chain}</span>:{leg.tokenIn}→{leg.tokenOut}
                      </span>
                    ))}
                  </td>
                  <td className="mono">
                    {intent.feeActual !== null ? (
                      <span className="green">{intent.feeActual.toFixed(1)}</span>
                    ) : (
                      <span className="muted">—</span>
                    )}
                    <span className="muted"> / {intent.feeCap.toFixed(1)}</span>
                  </td>
                  <td className="hash">{intent.proofHash ?? "—"}</td>
                  <td className="secondary" style={{ fontSize: 12 }}>
                    {timeSince(intent.createdAt)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
