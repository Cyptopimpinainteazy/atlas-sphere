import { useState, useEffect, useRef } from "react";

// ── palette & tokens ──────────────────────────────────────────────────────────
const C = {
  bg0: "#080C10",
  bg1: "#0D1117",
  bg2: "#141B24",
  bg3: "#1C2633",
  border: "#1E2D3D",
  amber: "#F0A500",
  amberDim: "#A06C00",
  green: "#22C55E",
  greenDim: "#166534",
  red: "#EF4444",
  redDim: "#7F1D1D",
  yellow: "#EAB308",
  blue: "#3B82F6",
  purple: "#A855F7",
  text: "#CBD5E1",
  textDim: "#64748B",
  textBright: "#F1F5F9",
};

// ── mock data ─────────────────────────────────────────────────────────────────
const MOCK = {
  globalStats: {
    tvl: "847,293,441",
    unsettledExposure: "12,844,002",
    activeRoutes: 1247,
    failedRoutes: 23,
    frozenLanes: 3,
    degradedChains: 2,
    activeIncidents: 4,
    rebalanceJobs: 7,
    treasuryAtRisk: "2,100,000",
  },
  incidents: [
    { id: "INC-0091", sev: "CRITICAL", desc: "ETH→SOL USDC lane frozen — inventory < critical min", chain: "ETH→SOL", age: "4m" },
    { id: "INC-0090", sev: "HIGH", desc: "ARB RPC fallback active — primary endpoint latency 4800ms", chain: "ARB", age: "12m" },
    { id: "INC-0089", sev: "MEDIUM", desc: "Partner MM-02 unresponsive — 3 quote timeouts", chain: "BASE→OP", age: "31m" },
    { id: "INC-0088", sev: "LOW", desc: "MATIC settlement delayed — block reorg detected", chain: "MATIC", age: "1h 4m" },
  ],
  partners: [
    { id: "MM-01", name: "Wintermute", status: "NORMAL", routes: 312, uptime: "99.8%" },
    { id: "MM-02", name: "Citadel LP", status: "DEGRAD