/**
 * Application service — launch, stop, and monitor application processes.
 *
 * Bridges the Zustand application store with the IPC service layer.
 */

import type { Application } from "@/types/application";
import type { LaunchResult } from "@/types/ipc";
import { ipcInvoke, AppError } from "./ipcService";
import { useApplicationStore } from "@/stores/applicationStore";

/* ── Default application registry ──────────────────────────── */

/**
 * Hard-coded registry of known applications from the monorepo.
 * This is the fallback when the backend doesn't provide a registry.
 */
export const DEFAULT_APPLICATIONS: Application[] = [
  /* ── Tier-1: Core X3 Panels ──────────────────────────────── */
  {
    id: "swarm-health",
    name: "Swarm Health",
    description: "GPU provider dashboard — live VRAM, compute, temps, SLA proofs",
    category: "service",
    icon: { type: "file", path: "/assets/icons/swarm-health.svg", color: "#ff6b35" },
    launchCommand: { type: "tauri", target: "launch_swarm_health" },
  },
  {
    id: "network-control",
    name: "Network Control",
    description: "RPC connections, peer nodes, agent dispatch, gossip channels",
    category: "service",
    icon: { type: "file", path: "/assets/icons/network.svg", color: "#00b4ff" },
    launchCommand: { type: "tauri", target: "launch_network_control" },
  },
  {
    id: "storage-manager",
    name: "Storage Manager",
    description: "CID pinning, content-addressed storage, proof submissions",
    category: "blockchain",
    icon: { type: "file", path: "/assets/icons/storage-manager.svg", color: "#8b5cf6" },
    launchCommand: { type: "tauri", target: "launch_storage_manager" },
  },
  {
    id: "dev-tools",
    name: "Dev Tools",
    description: "Build status, contract deploy, replay traces, X3-lang compile",
    category: "development",
    icon: { type: "file", path: "/assets/icons/devtools.svg", color: "#ff4488" },
    launchCommand: { type: "tauri", target: "launch_dev_tools" },
  },
  {
    id: "security-vault",
    name: "Security Vault",
    description: "Key custody, hardware attestation, governance signing",
    category: "security",
    icon: { type: "file", path: "/assets/icons/security.svg", color: "#ef5350" },
    launchCommand: { type: "tauri", target: "launch_security_vault" },
  },
  {
    id: "live-telemetry",
    name: "Live Telemetry",
    description: "Streaming GPU swarm heatmap + storage utilization graph",
    category: "analysis",
    icon: { type: "file", path: "/assets/icons/telemetry.svg", color: "#ff8c42" },
    launchCommand: { type: "tauri", target: "launch_swarm_health" },
  },
  {
    id: "blockchain-connector",
    name: "Blockchain Connector",
    description: "Enterprise multi-chain connector — 40+ networks, benchmarks, GPU testing, billing",
    category: "blockchain",
    icon: { type: "placeholder", category: "blockchain", color: "#ff6b35" },
    launchCommand: { type: "internal", target: "blockchain-connector" },
  },
  /* ── Existing Applications ───────────────────────────────── */
  {
    id: "explorer",
    name: "Block Explorer",
    description: "Browse blocks, transactions, and accounts on-chain",
    category: "blockchain",
    icon: { type: "placeholder", category: "blockchain", color: "#ff6b35" },
    launchCommand: { type: "url", target: "http://localhost:3001" },
  },
  {
    id: "wallet",
    name: "Wallet",
    description: "Manage keys, sign transactions, and transfer funds",
    category: "blockchain",
    icon: { type: "file", path: "/assets/icons/wallet.svg", color: "#00d2ff" },
    launchCommand: { type: "url", target: "http://localhost:3002" },
  },
  {
    id: "dex",
    name: "DEX",
    description: "Decentralised exchange for token swaps and liquidity",
    category: "defi",
    icon: { type: "file", path: "/assets/icons/exchange.svg", color: "#ff6b35" },
    launchCommand: { type: "url", target: "http://localhost:3003" },
  },
  {
    id: "analytics",
    name: "Analytics",
    description: "Chain analytics, metrics, and performance dashboards",
    category: "analysis",
    icon: { type: "file", path: "/assets/icons/metrics.svg", color: "#00bcd4" },
    launchCommand: { type: "url", target: "http://localhost:3004" },
  },
  {
    id: "swarm-dashboard",
    name: "Swarm Dashboard",
    description: "Monitor AI agent swarm status and task assignments",
    category: "service",
    icon: { type: "file", path: "/assets/icons/agent.svg", color: "#11a0dc" },
    launchCommand: { type: "url", target: "http://localhost:3005" },
  },
  {
    id: "admin-command-center",
    name: "Command Center",
    description: "Administrative dashboard for node and network management",
    category: "utility",
    icon: { type: "file", path: "/assets/icons/warroom.svg", color: "#ff1744" },
    launchCommand: { type: "url", target: "http://localhost:3006" },
  },
  {
    id: "funding-automator",
    name: "Funding Automator",
    description: "Automated token distribution and funding workflows",
    category: "defi",
    icon: { type: "placeholder", category: "defi", color: "#ff8c42" },
    launchCommand: { type: "tauri", target: "launch_funding_automator" },
  },
  {
    id: "x3-intelligence",
    name: "X3 Intelligence",
    description: "AI-powered blockchain intelligence and threat analysis",
    category: "security",
    icon: { type: "placeholder", category: "security", color: "#ef5350" },
    launchCommand: { type: "url", target: "http://localhost:3007" },
  },
  {
    id: "dev-dashboard",
    name: "Dev Dashboard",
    description: "Developer tools, contract deployment, and debugging",
    category: "development",
    icon: { type: "file", path: "/assets/icons/plugin.svg", color: "#ffd700" },
    launchCommand: { type: "url", target: "http://localhost:3008" },
  },
  {
    id: "3ai",
    name: "3AI Assistant",
    description: "AI assistant for blockchain operations and queries",
    category: "utility",
    icon: { type: "placeholder", category: "utility", color: "#66bb6a" },
    launchCommand: { type: "tauri", target: "launch_3ai" },
  },
  {
    id: "governance",
    name: "Governance",
    description: "On-chain governance proposals, voting, and delegation",
    category: "blockchain",
    icon: { type: "file", path: "/assets/icons/governance.svg", color: "#ff3366" },
    launchCommand: { type: "url", target: "http://localhost:3009" },
  },
  {
    id: "launchpad",
    name: "Launchpad",
    description: "Token and project launchpad with IDO support",
    category: "defi",
    icon: { type: "placeholder", category: "defi", color: "#ffa726" },
    launchCommand: { type: "url", target: "http://localhost:3010" },
  },
  {
    id: "unified-dashboard",
    name: "Unified Dashboard",
    description: "Single-pane overview of all ecosystem metrics",
    category: "analysis",
    icon: { type: "placeholder", category: "analysis", color: "#42a5f5" },
    launchCommand: { type: "url", target: "http://localhost:3011" },
  },
  {
    id: "quantum-voyager",
    name: "Quantum Voyager",
    description: "3D blockchain visualiser and system explorer",
    category: "utility",
    icon: { type: "file", path: "/assets/icons/quantum.svg", color: "#9d4edd" },
    launchCommand: { type: "tauri", target: "launch_quantum_voyager" },
  },
  {
    id: "phase5-panel",
    name: "Phase 5 Panel",
    description: "Phase 5 deployment control panel",
    category: "service",
    icon: { type: "placeholder", category: "service", color: "#ab47bc" },
    launchCommand: { type: "url", target: "http://localhost:3012" },
  },
  {
    id: "htlc-manager",
    name: "HTLC Manager",
    description: "Hash Time-Lock Contract management and monitoring",
    category: "blockchain",
    icon: { type: "file", path: "/assets/icons/storage.svg", color: "#26c6da" },
    launchCommand: { type: "tauri", target: "launch_htlc_manager" },
  },
  {
    id: "system-monitoring",
    name: "System Monitor",
    description: "Real-time CPU, memory, disk, and IPFS storage metrics",
    category: "service",
    icon: { type: "placeholder", category: "service", color: "#64b5f6" },
    launchCommand: { type: "internal", target: "system-monitoring" },
  },
  {
    id: "documentation",
    name: "Documentation",
    description: "GPU Swarm Dashboard & CI/CD documentation and guides",
    category: "utility",
    icon: { type: "placeholder", category: "utility", color: "#4fc3f7" },
    launchCommand: { type: "internal", target: "documentation" },
  },
  {
    id: "validators",
    name: "Validators",
    description: "Monitor validator network status, performance, and connectivity",
    category: "blockchain",
    icon: { type: "file", path: "/assets/icons/validators.svg", color: "#00d2ff" },
    launchCommand: { type: "url", target: "http://localhost:3013" },
  },
];

/* ── Service functions ─────────────────────────────────────── */

/**
 * Fetch the application registry from the backend.
 * Falls back to the hardcoded default list on failure.
 */
export async function fetchApplicationRegistry(): Promise<Application[]> {
  try {
    const apps = await ipcInvoke<Application[]>("get_app_registry", undefined, {
      retries: 1,
      timeout: 5000,
    });
    return apps && apps.length > 0 ? apps : DEFAULT_APPLICATIONS;
  } catch {
    console.warn("[AppService] Backend unavailable — using default registry");
    return DEFAULT_APPLICATIONS;
  }
}

/**
 * Launch an application.
 *
 * @param app - The application manifest
 * @throws {AppError} if launch fails or times out
 */
export async function launchApplication(app: Application): Promise<void> {
  const store = useApplicationStore.getState();
  const timeout = app.lifecycle?.timeout ?? 10_000;

  // Check dependencies
  if (app.systemRequirements?.dependencies) {
    for (const depId of app.systemRequirements.dependencies) {
      if (!store.isRunning(depId)) {
        throw new AppError(
          "DEPENDENCY_MISSING",
          `Required service "${depId}" is not running`,
          `Start ${depId} before launching ${app.name}`,
        );
      }
    }
  }

  store.startProcess(app.id);

  try {
    switch (app.launchCommand.type) {
      case "tauri": {
        const result = await ipcInvoke<LaunchResult>(
          "launch_app",
          {
            app_id: app.id,
            command: app.launchCommand.target,
            args: app.launchCommand.args ?? [],
            env: app.launchCommand.env ?? {},
          },
          { timeout },
        );

        if (result.status === "error") {
          throw new AppError("LAUNCH_FAILED", result.message ?? "Launch failed");
        }

        store.updateProcessStatus(app.id, "running");
        break;
      }

      case "url": {
        // Open in system browser or embedded webview
        window.open(app.launchCommand.target, "_blank");
        store.updateProcessStatus(app.id, "running");
        break;
      }

      case "internal": {
        // Internal Tauri app launched as a window
        store.updateProcessStatus(app.id, "running");
        break;
      }

      case "process": {
        const result = await ipcInvoke<LaunchResult>(
          "launch_app",
          {
            app_id: app.id,
            command: app.launchCommand.target,
            args: app.launchCommand.args ?? [],
            env: app.launchCommand.env ?? {},
          },
          { timeout },
        );

        if (result.status === "error") {
          throw new AppError("LAUNCH_FAILED", result.message ?? "Launch failed");
        }

        store.updateProcessStatus(app.id, "running");
        break;
      }
    }
  } catch (err) {
    store.updateProcessStatus(app.id, "crashed");
    throw err;
  }
}

/**
 * Stop a running application.
 */
export async function stopApplication(appId: string): Promise<void> {
  const store = useApplicationStore.getState();
  store.updateProcessStatus(appId, "stopping");

  try {
    await ipcInvoke("stop_app", { app_id: appId }, { timeout: 10_000 });
  } catch {
    // Force-remove on failure
  }

  store.removeProcess(appId);
}
