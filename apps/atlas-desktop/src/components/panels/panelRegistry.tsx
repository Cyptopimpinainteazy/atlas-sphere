/**
 * Panel registry — maps application IDs to their React panel components.
 *
 * When a window is opened for a registered app, WindowManager renders
 * the real panel instead of a placeholder letter.
 */
import React, { lazy, Suspense, type ComponentType } from "react";

/* Lazy-load panels to keep initial bundle lean */
const SwarmHealthPanel = lazy(() => import("@/components/panels/SwarmHealthPanel"));
const NetworkPanel     = lazy(() => import("@/components/panels/NetworkPanel"));
const StoragePanel     = lazy(() => import("@/components/panels/StoragePanel"));
const DevToolsPanel    = lazy(() => import("@/components/panels/DevToolsPanel"));
const SecurityPanel    = lazy(() => import("@/components/panels/SecurityPanel"));
const LiveTelemetryPanel = lazy(() => import("@/components/panels/LiveTelemetryPanel"));

/**
 * Map of appId → lazy-loaded panel component.
 * Add new panels here as they are created.
 */
const PANEL_MAP: Record<string, ComponentType> = {
  "swarm-health":   SwarmHealthPanel,
  "network-control": NetworkPanel,
  "storage-manager": StoragePanel,
  "dev-tools":       DevToolsPanel,
  "security-vault":  SecurityPanel,
  "live-telemetry":  LiveTelemetryPanel,

  // Aliases: existing apps can also route to panels
  "swarm-dashboard":        SwarmHealthPanel,
  "admin-command-center":   NetworkPanel,
  "htlc-manager":           StoragePanel,
  "dev-dashboard":          DevToolsPanel,
  "x3-intelligence":        SecurityPanel,
};

/**
 * Loading spinner shown while a panel chunk is fetched.
 */
const PanelLoader: React.FC = () => (
  <div className="flex items-center justify-center h-full bg-[#0a0a0f]">
    <div className="text-center">
      <div className="inline-block w-5 h-5 border-2 border-[#ff6b35]/30 border-t-[#ff6b35] rounded-full animate-spin mb-2" />
      <div className="text-[10px] font-mono text-[#666]">Loading panel...</div>
    </div>
  </div>
);

/**
 * Look up the panel component for a given app ID.
 * Returns null if no dedicated panel exists (WindowManager will show its default placeholder).
 */
export function getPanelForApp(appId: string): React.ReactNode | null {
  const Panel = PANEL_MAP[appId];
  if (!Panel) return null;

  return (
    <Suspense fallback={<PanelLoader />}>
      <Panel />
    </Suspense>
  );
}

/**
 * Check if an app has a dedicated panel registered.
 */
export function hasPanel(appId: string): boolean {
  return appId in PANEL_MAP;
}
