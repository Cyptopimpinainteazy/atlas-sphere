/**
 * App Store Configuration
 * 
 * Metadata for all third-party apps integrated into Atlas Desktop.
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

/**
 * All apps available in the Atlas Desktop App Store
 */
export const APP_STORE_APPS: AppStoreApp[] = [
  {
    id: "arbitrage-bot",
    name: "Arbitrage Bot",
    description: "Multi-chain arbitrage trading bot with automatic profit detection. 50% of profits route to X3 Treasury.",
    category: "trading",
    chain: "multi-chain",
    version: "1.0.0",
    author: "Joshua-Medvinsky",
    repositoryUrl: "https://github.com/Joshua-Medvinsky/Arbitrage-Bot",
    icon: "🤖",
    installed: true,
    enabled: true,
    treasuryIntegrated: true,
    features: [
      "Multi-chain arbitrage detection",
      "Automatic trade execution",
      "50% profit sharing to X3 Treasury",
      "Real-time opportunity scanning",
      "Gas optimization"
    ],
    requirements: ["Node.js 18+", "Python 3.10+", "Web3 provider"],
    launchCommand: "python arbitrage_bot.py --treasury-enabled",
    configPath: "app-store/Arbitrage-Bot/config.py",
    size: "45 MB"
  },
  {
    id: "fuego-wallet",
    name: "Fuego GTR Wallet",
    description: "High-performance crypto wallet with X3 integration. Transaction fees route to treasury.",
    category: "wallet",
    chain: "multi-chain",
    version: "2.1.0",
    author: "ColinRitman",
    repositoryUrl: "https://github.com/ColinRitman/fuego-GTR-wallet",
    icon: "🔥",
    installed: true,
    enabled: true,
    treasuryIntegrated: true,
    features: [
      "Multi-chain support",
      "Hardware wallet integration",
      "50% transaction fee to X3 Treasury",
      "Secure key management",
      "DeFi integration"
    ],
    requirements: ["Tauri", "Node.js 18+"],
    launchCommand: "npm run tauri dev",
    configPath: "app-store/fuego-GTR-wallet/src-tauri/tauri.conf.json",
    size: "78 MB"
  },
  {
    id: "pancake-wizard",
    name: "PancakeSwap Wizard",
    description: "Automated PancakeSwap trading bot. 50% of trading profits to X3 Treasury.",
    category: "defi",
    chain: "binance",
    version: "1.5.2",
    author: "modagavr",
    repositoryUrl: "https://github.com/modagavr/pancake-wizard",
    icon: "🥞",
    installed: true,
    enabled: true,
    treasuryIntegrated: true,
    features: [
      "Automated PancakeSwap trading",
      "Liquidity provision management",
      "50% profit to X3 Treasury",
      "Yield farming optimization",
      "Auto-compound strategies"
    ],
    requirements: ["BSC node access", "BNB for gas"],
    launchCommand: "npm run start:treasury",
    configPath: "app-store/pancake-wizard/src/config/treasury.json",
    size: "52 MB"
  },
  {
    id: "meme-bundler",
    name: "Meme Core Bundler",
    description: "Solana meme coin bundler and launcher. 50% of launch fees to treasury.",
    category: "defi",
    chain: "solana",
    version: "2.1.0",
    author: "bogardt",
    repositoryUrl: "https://github.com/bogardt/meme-core-bundler-solana",
    icon: "🎭",
    installed: true,
    enabled: true,
    treasuryIntegrated: true,
    features: [
      "Meme coin bundling",
      "Token launch automation",
      "50% fees to X3 Treasury",
      "Liquidity management",
      "Fair launch tools"
    ],
    requirements: ["Solana CLI", "SOL for fees"],
    launchCommand: "./meme-core_2.1.0.exe --treasury-mode",
    configPath: "app-store/meme-core-bundler-solana/config/treasury.json",
    size: "35 MB"
  },
  {
    id: "hwinfo-plugin",
    name: "Hardware Info Plugin",
    description: "Tauri plugin for hardware monitoring and mining optimization.",
    category: "tools",
    chain: "multi-chain",
    version: "0.1.0",
    author: "nikolchaa",
    repositoryUrl: "https://github.com/nikolchaa/tauri-plugin-hwinfo",
    icon: "⚙️",
    installed: true,
    enabled: true,
    treasuryIntegrated: false, // Utility plugin, no direct treasury integration
    features: [
      "GPU temperature monitoring",
      "Mining performance tracking",
      "System resource optimization",
      "Real-time hardware stats",
      "Power consumption tracking"
    ],
    requirements: ["Tauri 2.0+", "System admin access"],
    launchCommand: "npm run build",
    configPath: "app-store/tauri-plugin-hwinfo/permissions/default.toml",
    size: "8 MB"
  },
  {
    id: "agenc-operator",
    name: "AgenC Operator",
    description: "AI agent orchestration system. Agent earnings split with X3 Treasury.",
    category: "ai",
    chain: "multi-chain",
    version: "1.0.0",
    author: "tetsuo-ai",
    repositoryUrl: "https://github.com/tetsuo-ai/AgenC-Operator",
    icon: "🤖",
    installed: true,
    enabled: true,
    treasuryIntegrated: true,
    features: [
      "Multi-agent orchestration",
      "50% agent earnings to treasury",
      "Autonomous task execution",
      "Cross-chain operations",
      "AI-powered trading agents"
    ],
    requirements: ["Rust", "Docker", "AI API keys"],
    launchCommand: "cargo run -- --treasury-enabled",
    configPath: "app-store/AgenC-Operator/config/treasury.toml",
    size: "125 MB"
  },
  {
    id: "blumtap",
    name: "Blum Tap Clicker",
    description: "Auto-clicker for Blum points. 50% of earned tokens to treasury.",
    category: "gaming",
    chain: "multi-chain",
    version: "1.0.0",
    author: "nhassl3",
    repositoryUrl: "https://github.com/nhassl3/Blumtap",
    icon: "👆",
    installed: true,
    enabled: true,
    treasuryIntegrated: true,
    features: [
      "Automated clicking",
      "50% earned tokens to treasury",
      "Multi-account support",
      "Anti-detection features",
      "Reward optimization"
    ],
    requirements: ["Python 3.10+"],
    launchCommand: "python -m blum_tap_clicker --treasury-wallet",
    configPath: "app-store/Blumtap/config.json",
    size: "12 MB"
  },
  {
    id: "ai-blockchain-assistant",
    name: "AI Blockchain Assistant",
    description: "AI-powered blockchain operations assistant with X3 integration.",
    category: "ai",
    chain: "multi-chain",
    version: "1.0.0",
    author: "topazcoder",
    repositoryUrl: "https://github.com/topazcoder/ai-blockchain-assistant",
    icon: "🧠",
    installed: true,
    enabled: true,
    treasuryIntegrated: true,
    features: [
      "Natural language blockchain ops",
      "Automated trading assistance",
      "50% service fees to treasury",
      "Multi-chain support",
      "Smart contract analysis"
    ],
    requirements: ["Rust", "AI API access"],
    launchCommand: "cargo run --release -- --treasury-mode",
    configPath: "app-store/ai-blockchain-assistant/config/treasury.toml",
    size: "95 MB"
  },
  {
    id: "aera-project",
    name: "AERA Project Suite",
    description: "Complete blockchain ecosystem with miner, wallet, and node. 50% of mining rewards to X3.",
    category: "mining",
    chain: "multi-chain",
    version: "1.0.0",
    author: "AERA-Team",
    repositoryUrl: "https://github.com/AERA-Team/AERA-Project",
    icon: "⛏️",
    installed: true,
    enabled: true,
    treasuryIntegrated: true,
    features: [
  // -----------------------
  // Local development helper: x3-app-store (workspace) — allows launching the monorepo storefront from the Desktop App Store
  {
    id: "x3-app-store",
    name: "X3 App Store (local)",
    description: "Local App Store / marketplace frontend (workspace). Launches local dev server via start.sh",
    category: "tools",
    chain: "multi-chain",
    version: "dev",
    author: "Atlas Devs",
    repositoryUrl: "https://github.com/atlas/x3-app-store",
    icon: "📦",
    installed: true,
    enabled: true,
    treasuryIntegrated: false,
    features: ["Local App Store UI", "Developer playground", "App launch orchestration"],
    requirements: ["Node.js 18+"],
    // prefer bash ./start.sh --dev so the AppLauncher starts the local dev server automatically
    launchCommand: "bash ./start.sh --dev",
    configPath: "x3-app-store/frontend/package.json",
    size: "—"
  },
  // -----------------------

      "Full node operation",
      "50% mining rewards to treasury",
      "Integrated wallet",
      "Blockchain explorer",
      "Validator operations"
    ],
    requirements: ["High-end GPU", "50GB storage"],
    launchCommand: "./aera-miner/start-miner.sh --treasury-split 50",
    configPath: "app-store/AERA-Project/aera-miner/config.json",
    size: "210 MB"
  },
  {
    id: "mynta-wallet",
    name: "Mynta Wallet",
    description: "Modern multi-chain wallet with DeFi integration. Transaction fees route to treasury.",
    category: "wallet",
    chain: "multi-chain",
    version: "1.0.0",
    author: "Slashx124",
    repositoryUrl: "https://github.com/Slashx124/mynta-wallet",
    icon: "💎",
    installed: true,
    enabled: true,
    treasuryIntegrated: true,
    features: [
      "Multi-chain wallet",
      "50% transaction fees to treasury",
      "NFT management",
      "DeFi aggregator",
      "Hardware wallet support"
    ],
    requirements: ["Tauri", "Node.js 18+"],
    launchCommand: "npm run tauri dev",
    configPath: "app-store/mynta-wallet/src-tauri/tauri.conf.json",
    size: "82 MB"
  },
  {
    id: "triangular-arbitrage",
    name: "Triangular Arbitrage",
    description: "OctoBot-powered multi-asset arbitrage detection across cryptocurrency markets. 50% profits to X3 Treasury.",
    category: "trading",
    chain: "multi-chain",
    version: "1.2.2",
    author: "Drakkar-Software",
    repositoryUrl: "https://github.com/Drakkar-Software/Triangular-Arbitrage",
    icon: "🔺",
    installed: true,
    enabled: true,
    treasuryIntegrated: true,
    features: [
      "Multi-asset arbitrage detection",
      "50% profits to X3 Treasury",
      "CCXT library integration",
      "OctoBot powered",
      "Real-time opportunity scanning",
      "Cycle-based trading strategies"
    ],
    requirements: ["Python 3.10+", "CCXT library", "Exchange API keys"],
    launchCommand: "python main.py --treasury-enabled",
    configPath: "app-store/Triangular-Arbitrage/config.json",
    size: "38 MB"
  },
  {
    id: "deep-research",
    name: "Deep Research",
    description: "Research workbench for dataset analysis and model experiments.",
    category: "analysis",
    chain: "multi-chain",
    version: "0.1.0",
    author: "koala73",
    repositoryUrl: "https://github.com/koala73/deep-research.git",
    icon: "🧠",
    installed: true,
    enabled: true,
    treasuryIntegrated: false,
    features: ["Large dataset analysis", "Notebook integration", "Model benchmarking"],
    requirements: ["Tauri", "Node.js 18+"],
    launchCommand: "npm run tauri dev",
    configPath: "app-store/deep-research/tauri.conf.json",
    size: "48 MB"
  },
  {
    id: "world-monitor",
    name: "World Monitor",
    description: "Geospatial telemetry and global event monitoring.",
    category: "analysis",
    chain: "multi-chain",
    version: "0.2.0",
    author: "koala73",
    repositoryUrl: "https://github.com/koala73/worldmonitor.git",
    icon: "🌍",
    installed: true,
    enabled: true,
    treasuryIntegrated: false,
    features: ["Geospatial maps", "Event streams", "Alerts"],
    requirements: ["Tauri", "Node.js 18+"],
    launchCommand: "npm run tauri dev",
    configPath: "app-store/world-monitor/tauri.conf.json",
    size: "55 MB"
  },
  {
    id: "clutch",
    name: "Clutch",
    description: "Lightweight developer process manager and CLI helper.",
    category: "development",
    chain: "multi-chain",
    version: "1.0.0",
    author: "Codesushi-com",
    repositoryUrl: "https://github.com/Codesushi-com/clutch.git",
    icon: "🧰",
    installed: true,
    enabled: true,
    treasuryIntegrated: false,
    features: ["Process supervision", "Dev helpers", "Integrations"],
    requirements: ["Tauri", "Node.js 18+"],
    launchCommand: "npm run tauri dev",
    configPath: "app-store/clutch/tauri.conf.json",
    size: "12 MB"
  },
  {
    id: "nvtop",
    name: "nvtop",
    description: "GPU process monitor (nvtop) integrated into App Store.",
    category: "tools",
    chain: "multi-chain",
    version: "0.8.0",
    author: "Syllo",
    repositoryUrl: "https://github.com/Syllo/nvtop.git",
    icon: "📈",
    installed: true,
    enabled: true,
    treasuryIntegrated: false,
    features: ["GPU usage", "Process view", "Temperature/clock stats"],
    requirements: ["nvtop binary"],
    launchCommand: "nvtop",
    configPath: "app-store/nvtop/README.md",
    size: "1 MB"
  },
  {
    id: "xeepy",
    name: "Xeepy - X/Twitter Automation",
    description: "AI-powered X/Twitter automation toolkit with 500+ methods. Social media earnings split with treasury.",
    category: "tools",
    chain: "multi-chain",
    version: "1.0.0",
    author: "nirholas",
    repositoryUrl: "https://github.com/nirholas/xeepy",
    icon: "🐦",
    installed: true,
    enabled: true,
    treasuryIntegrated: true,
    features: [
      "AI-powered automation",
      "50% social media earnings to treasury",
      "500+ methods and 100+ classes",
      "No API keys required",
      "Follow/unfollow automation",
      "Content scraping and posting",
      "Analytics and monitoring"
    ],
    requirements: ["Python 3.10+", "Async support"],
    launchCommand: "python -m xeepy --treasury-mode",
    configPath: "app-store/xeepy/config.json",
    size: "65 MB"
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
      "Opener — open URLs and files with default apps",
      "OS — platform, arch, locale detection",
      "Process — exit and relaunch the app",
      "Shell — spawn external processes",
      "Single Instance — prevent duplicate launches",
      "Store — persistent key-value settings",
      "Window State — auto-save/restore window geometry"
    ],
    requirements: ["Tauri 2.0+"],
    size: "12 MB"
  }
];

/**
 * Get apps by category
 */
export function getAppsByCategory(category: AppCategory): AppStoreApp[] {
  return APP_STORE_APPS.filter(app => app.category === category);
}

/**
 * Get apps by chain
 */
export function getAppsByChain(chain: AppChain): AppStoreApp[] {
  return APP_STORE_APPS.filter(app => app.chain === chain || app.chain === "multi-chain");
}

/**
 * Get installed apps
 */
export function getInstalledApps(): AppStoreApp[] {
  return APP_STORE_APPS.filter(app => app.installed);
}

/**
 * Get apps with treasury integration
 */
export function getTreasuryIntegratedApps(): AppStoreApp[] {
  return APP_STORE_APPS.filter(app => app.treasuryIntegrated);
}

/**
 * Get app by ID
 */
export function getAppById(id: string): AppStoreApp | undefined {
  return APP_STORE_APPS.find(app => app.id === id);
}
