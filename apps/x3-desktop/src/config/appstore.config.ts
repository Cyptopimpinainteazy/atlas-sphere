/**
 * App Store Configuration
 * 
 * Metadata for all third-party apps integrated into X3 Desktop.
 * Each app is configured for seamless X3 integration with treasury routing.
 */

export type AppCategory = 
  | "trading" 
  | "wallet" 
  | "mining" 
  | "defi" 
  | "gaming" 
  | "tools" 
  | "ai"
  | "agent";

export type AppChain = 
  | "ethereum" 
  | "solana" 
  | "binance" 
  | "polygon" 
  | "arbitrum" 
  | "avalanche"
  | "multi-chain";

export interface AppStoreApp {
  id: string;
  name: string;
  description: string;
  category: AppCategory;
  chain: AppChain;
  version: string;
  author: string;
  repositoryUrl: string;
  icon?: string;
  banner?: string;
  installed: boolean;
  enabled: boolean;
  treasuryIntegrated: boolean;
  features: string[];
  requirements: string[];
  launchCommand?: string;
  configPath?: string;
  size: string;
}

export const APP_STORE_APPS: AppStoreApp[] = [
  {
    id: "x3-app-store",
    name: "X3 App Store (local)",
    description: "Local App Store / marketplace frontend (workspace). Launches local dev server via start.sh",
    category: "tools",
    chain: "multi-chain",
    version: "dev",
    author: "X3 Devs",
    repositoryUrl: "https://github.com/x3/x3-app-store",
    icon: "📦",
    installed: true,
    enabled: true,
    treasuryIntegrated: false,
    features: ["Local App Store UI", "Developer playground", "App launch orchestration"],
    requirements: ["Node.js 18+"],
    launchCommand: "bash ./start.sh --dev",
    configPath: "x3-app-store/frontend/package.json",
    size: "—"
  },
  {
    id: "tauri-plugin-suite",
    name: "Tauri Plugin Suite",
    description: "Official Tauri v2 plugin ecosystem — 14 platform plugins providing autostart, clipboard, dialogs, filesystem, global shortcuts, logging, notifications, opener, OS info, process control, shell, single-instance guard, persistent store, and window-state restoration.",
    category: "tools",
    chain: "multi-chain",
    version: "2.0.0",
    author: "tauri-apps",
    repositoryUrl: "https://github.com/tauri-apps/plugins-workspace",
    icon: "🔌",
    installed: true,
    enabled: true,
    treasuryIntegrated: false,
    features: [
      "Autostart — launch at system boot",
      "Clipboard — read/write system clipboard",
      "Dialog — native open/save/message dialogs",
      "Filesystem — read/write files securely",
      "Global Shortcut — app-wide keyboard shortcuts",
      "Log — structured log output",
      "Notification — native OS notifications",
      "Opener — open URLs and files with default apps"
    ],
    requirements: ["Tauri 2.0+"],
    size: "12 MB"
  }
];

export function getAppsByCategory(category: AppCategory): AppStoreApp[] {
  return APP_STORE_APPS.filter(app => app.category === category);
}
export function getAppsByChain(chain: AppChain): AppStoreApp[] {
  return APP_STORE_APPS.filter(app => app.chain === chain || app.chain === "multi-chain");
}
export function getInstalledApps(): AppStoreApp[] {
  return APP_STORE_APPS.filter(app => app.installed);
}
export function getTreasuryIntegratedApps(): AppStoreApp[] {
  return APP_STORE_APPS.filter(app => app.treasuryIntegrated);
}
export function getAppById(id: string): AppStoreApp | undefined {
  return APP_STORE_APPS.find(app => app.id === id);
}
