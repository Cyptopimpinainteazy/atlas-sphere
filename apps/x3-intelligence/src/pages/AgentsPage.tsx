// Agents Page — registry, reputation, and history

import { useState } from "react";
import { AgentStatus } from "../types";
import type { Agent } from "../types";

const DEMO_AGENTS: Agent[] = [
  {
    id: "agent-alpha",
    status: AgentStatus.Active,
    bondAmount: 50_000,
    reputation: 97.2,
    successRate: 98.1,
    totalExecutions: 4_821,
    totalSlashes: 1,
    registeredAt: Date.now() - 86_400_000 * 30,
  },
  {
    id: "agent-bravo",
    status: AgentStatus.Active,
    bondAmount: 25_000,
    reputation: 88.4,
    successRate: 94.3,
    totalExecutions: 2_150,
    totalSlashes: 3,
    registeredAt: Date.now() - 86_400_000 * 15,
  },
  {
    id: "agent-charlie",
    status: AgentStatus.Active,
    bondAmount: 100_000,
    reputation: 99.1,
    successRate: 99.4,
    totalExecutions: 8_392,
    totalSlashes: 0,
    registeredAt: Date.now() - 86_400_000 * 60,
  },
  {
    id: "agent-delta",
    status: AgentStatus.Suspended,
    bondAmount: 10_000,
    reputation: 42.1,
    successRate: 67.2,
    totalExecutions: 312,
    totalSlashes: 8,
    registeredAt: Date.now() - 86_400_000 * 7,
  },
  {
    id: "agent-echo",
    status: AgentStatus.Deactivated,
    bondAmount: 0,
    reputation: 0.0,
    successRate: 0.0,
    totalExecutions: 14,
    totalSlashes: 14,
    registeredAt: Date.now() - 86_400_000 * 3,
  },
];

function statusColor(status: AgentStatus): string {
  switch (status) {
    case AgentStatus.Active: return "badge-green";
    case AgentStatus.Suspended: return "badge-amber";
    case AgentStatus.Deactivated: return "badge-red";
    case AgentStatus.Deregistered: return "badge-muted";
  }
}

function repColor(rep: number): string {
  if (rep >= 90) return "green";
  if (rep >= 70) return "amber";
  return "red";
}

function daysSince(ts: number): string {
  const days = Math.floor((Date.now() - ts) / 86_400_000);
  return `${days}d`;
}

export function AgentsPage() {
  const [agents] = useState<Agent[]>(DEMO_AGENTS);

  return (
    <div className="page">
      <div className="page-header">
        <h1>Agent Registry</h1>
        <span className="subtitle">{agents.filter((a) => a.status === AgentStatus.Active).length} active</span>
      </div>

      {/* Summary stats */}
      <div className="stats-grid">
        <div className="stat-card">
          <div className="stat-label">Total Agents</div>
          <div className="stat-value">{agents.length}</div>
        </div>
        <div className="stat-card">
          <div className="stat-label">Total Bond Locked</div>
          <div className="stat-value mono">
            {agents.reduce((s, a) => s + a.bondAmount, 0).toLocaleString()}
          </div>
        </div>
        <div className="stat-card">
          <div className="stat-label">Avg Success Rate</div>
          <div className="stat-value green">
            {(agents.filter((a) => a.status === AgentStatus.Active).reduce((s, a) => s + a.successRate, 0) /
              agents.filter((a) => a.status === AgentStatus.Active).length).toFixed(1)}%
          </div>
        </div>
        <div className="stat-card">
          <div className="stat-label">Total Slashes</div>
          <div className="stat-value red">
            {agents.reduce((s, a) => s + a.totalSlashes, 0)}
          </div>
        </div>
      </div>

      <div className="card">
        <div className="table-wrapper">
          <table>
            <thead>
              <tr>
                <th>Agent</th>
                <th>Status</th>
                <th>Bond</th>
                <th>Reputation</th>
                <th>Success Rate</th>
                <th>Executions</th>
                <th>Slashes</th>
                <th>Registered</th>
              </tr>
            </thead>
            <tbody>
              {agents.map((agent) => (
                <tr key={agent.id}>
                  <td className="mono" style={{ fontSize: 12, fontWeight: 600 }}>{agent.id}</td>
                  <td>
                    <span className={`badge ${statusColor(agent.status)}`}>
                      {agent.status}
                    </span>
                  </td>
                  <td className="mono">{agent.bondAmount.toLocaleString()}</td>
                  <td>
                    <span className={`mono ${repColor(agent.reputation)}`}>
                      {agent.reputation.toFixed(1)}
                    </span>
                  </td>
                  <td>
                    <span className={`mono ${repColor(agent.successRate)}`}>
                      {agent.successRate.toFixed(1)}%
                    </span>
                  </td>
                  <td className="mono">{agent.totalExecutions.toLocaleString()}</td>
                  <td className="mono">
                    {agent.totalSlashes > 0 ? (
                      <span className="red">{agent.totalSlashes}</span>
                    ) : (
                      <span className="muted">0</span>
                    )}
                  </td>
                  <td className="secondary" style={{ fontSize: 12 }}>{daysSince(agent.registeredAt)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
