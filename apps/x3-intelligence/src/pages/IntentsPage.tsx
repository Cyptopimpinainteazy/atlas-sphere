// Intents Page — ArbIntent submission and tracking

import { useState } from "react";
import { IntentState } from "../types";
import type { ArbIntent } from "../types";

const DEMO_INTENTS: ArbIntent[] = [
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
    createdAt: Date.now() - 120_000,
    executedAt: Date.now() - 116_000,
    proofHash: "e9c1a2b3d4f56789abcdef0123456789e9c1a2b3d4f56789abcdef0123456789",
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
    id: "0xc1d4..2b3e",
    agentId: "agent-charlie",
    state: IntentState.Submitted,
    legs: [
      { chain: "POLY", protocol: "QuickSwap", tokenIn: "MATIC", tokenOut: "USDC", amountIn: "10000", expectedOut: "8,932.00" },
    ],
    feeCap: 18.5,
    feeActual: null,
    createdAt: Date.now() - 1000,
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
    createdAt: Date.now() - 300_000,
    executedAt: null,
    proofHash: "f8a1b2c3d4e56789",
  },
  {
    id: "0xe5f6..3c4d",
    agentId: "agent-alpha",
    state: IntentState.Expired,
    legs: [
      { chain: "ETH", protocol: "Curve", tokenIn: "USDT", tokenOut: "USDC", amountIn: "100,000", expectedOut: "99,980" },
    ],
    feeCap: 8.0,
    feeActual: null,
    createdAt: Date.now() - 600_000,
    executedAt: null,
    proofHash: null,
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

export function IntentsPage() {
  const [intents] = useState<ArbIntent[]>(DEMO_INTENTS);
  const [filter, setFilter] = useState<IntentState | "all">("all");

  const filtered =
    filter === "all" ? intents : intents.filter((i) => i.state === filter);

  return (
    <div className="page">
      <div className="page-header">
        <h1>Arb Intents</h1>
        <span className="subtitle">{intents.length} total</span>
      </div>

      {/* Filter bar */}
      <div style={{ display: "flex", gap: 8, marginBottom: 16 }}>
        {["all", ...Object.values(IntentState)].map((s) => (
          <button
            key={s}
            onClick={() => setFilter(s as IntentState | "all")}
            style={{
              padding: "4px 12px",
              fontSize: 12,
              fontFamily: "var(--font-mono)",
              background: filter === s ? "var(--bg-tertiary)" : "transparent",
              color: filter === s ? "var(--text-primary)" : "var(--text-muted)",
              border: `1px solid ${filter === s ? "var(--border-active)" : "var(--border)"}`,
              borderRadius: "var(--radius-sm)",
              cursor: "pointer",
              textTransform: "uppercase",
              letterSpacing: "0.04em",
            }}
          >
            {s}
          </button>
        ))}
      </div>

      <div className="card">
        <div className="table-wrapper">
          <table>
            <thead>
              <tr>
                <th>ID</th>
                <th>Agent</th>
                <th>State</th>
                <th>Route</th>
                <th>Fee Cap</th>
                <th>Fee Actual</th>
                <th>Proof</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((intent) => (
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
                      <div key={i} style={{ whiteSpace: "nowrap" }}>
                        <span className="secondary">[{leg.chain}]</span>{" "}
                        {leg.tokenIn} → {leg.tokenOut}{" "}
                        <span className="muted">
                          ({leg.amountIn} → {leg.expectedOut})
                        </span>
                      </div>
                    ))}
                  </td>
                  <td className="mono">{intent.feeCap.toFixed(1)}</td>
                  <td className="mono">
                    {intent.feeActual !== null ? (
                      <span className="green">{intent.feeActual.toFixed(1)}</span>
                    ) : (
                      <span className="muted">—</span>
                    )}
                  </td>
                  <td className="hash">{intent.proofHash ?? "—"}</td>
                </tr>
              ))}
              {filtered.length === 0 && (
                <tr>
                  <td colSpan={7} style={{ textAlign: "center", color: "var(--text-muted)", padding: 32 }}>
                    No intents matching filter.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
