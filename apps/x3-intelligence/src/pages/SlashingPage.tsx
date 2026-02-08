// Slashing Page — slash history and constitution reference

import { useState } from "react";
import { SlashSeverity } from "../types";
import type { SlashEvent } from "../types";

const DEMO_SLASHES: SlashEvent[] = [
  {
    id: "slash-001",
    agentId: "agent-delta",
    severity: SlashSeverity.Critical,
    reason: "Double execution of intent 0xd4c3..9f87",
    amountSlashed: 10_000,
    proofHash: "a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2",
    timestamp: Date.now() - 3_600_000,
  },
  {
    id: "slash-002",
    agentId: "agent-delta",
    severity: SlashSeverity.Major,
    reason: "State divergence during execution replay",
    amountSlashed: 5_000,
    proofHash: "b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3",
    timestamp: Date.now() - 86_400_000,
  },
  {
    id: "slash-003",
    agentId: "agent-bravo",
    severity: SlashSeverity.Moderate,
    reason: "Failed to repay flashloan within deadline",
    amountSlashed: 2_500,
    proofHash: "c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4",
    timestamp: Date.now() - 172_800_000,
  },
  {
    id: "slash-004",
    agentId: "agent-delta",
    severity: SlashSeverity.Minor,
    reason: "Exceeded fee cap by 2.1%",
    amountSlashed: 1_000,
    proofHash: "d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5",
    timestamp: Date.now() - 259_200_000,
  },
  {
    id: "slash-005",
    agentId: "agent-bravo",
    severity: SlashSeverity.Minor,
    reason: "Submitted intent without sufficient bond",
    amountSlashed: 500,
    proofHash: "e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6",
    timestamp: Date.now() - 345_600_000,
  },
];

function severityColor(severity: SlashSeverity): string {
  switch (severity) {
    case SlashSeverity.Critical: return "badge-red";
    case SlashSeverity.Major: return "badge-red";
    case SlashSeverity.Moderate: return "badge-amber";
    case SlashSeverity.Minor: return "badge-muted";
  }
}

function relativeTime(ts: number): string {
  const hours = Math.floor((Date.now() - ts) / 3_600_000);
  if (hours < 1) return "< 1h ago";
  if (hours < 24) return `${hours}h ago`;
  return `${Math.floor(hours / 24)}d ago`;
}

export function SlashingPage() {
  const [slashes] = useState<SlashEvent[]>(DEMO_SLASHES);

  const totalSlashed = slashes.reduce((s, e) => s + e.amountSlashed, 0);

  return (
    <div className="page">
      <div className="page-header">
        <h1>Slashing Ledger</h1>
        <span className="subtitle">Immutable. Deterministic. Automatic.</span>
      </div>

      <div className="stats-grid">
        <div className="stat-card">
          <div className="stat-label">Total Slashes</div>
          <div className="stat-value red">{slashes.length}</div>
        </div>
        <div className="stat-card">
          <div className="stat-label">Total Amount Slashed</div>
          <div className="stat-value red mono">{totalSlashed.toLocaleString()}</div>
        </div>
        <div className="stat-card">
          <div className="stat-label">Critical Events</div>
          <div className="stat-value red">
            {slashes.filter((s) => s.severity === SlashSeverity.Critical).length}
          </div>
        </div>
        <div className="stat-card">
          <div className="stat-label">Unique Agents Slashed</div>
          <div className="stat-value amber">
            {new Set(slashes.map((s) => s.agentId)).size}
          </div>
        </div>
      </div>

      <div className="card">
        <div className="card-header">
          <h2>Slash History</h2>
        </div>
        <div className="table-wrapper">
          <table>
            <thead>
              <tr>
                <th>ID</th>
                <th>Agent</th>
                <th>Severity</th>
                <th>Reason</th>
                <th>Amount</th>
                <th>Proof</th>
                <th>When</th>
              </tr>
            </thead>
            <tbody>
              {slashes.map((slash) => (
                <tr key={slash.id}>
                  <td className="mono" style={{ fontSize: 12 }}>{slash.id}</td>
                  <td className="mono" style={{ fontSize: 12 }}>{slash.agentId}</td>
                  <td>
                    <span className={`badge ${severityColor(slash.severity)}`}>
                      {slash.severity}
                    </span>
                  </td>
                  <td style={{ fontSize: 12, maxWidth: 300 }}>{slash.reason}</td>
                  <td className="mono red">{slash.amountSlashed.toLocaleString()}</td>
                  <td className="hash">{slash.proofHash.slice(0, 16)}...</td>
                  <td className="secondary" style={{ fontSize: 12 }}>
                    {relativeTime(slash.timestamp)}
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
