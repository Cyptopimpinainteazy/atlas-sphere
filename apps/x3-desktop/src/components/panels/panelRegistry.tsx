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
const MonitoringDashboard = lazy(() => import("@/components/monitoring/MonitoringDashboard"));
const WorldMonitorPanel = lazy(() => import("@/components/panels/WorldMonitorPanel"));
const DocumentationPanel = lazy(() => import("@/components/documentation/Documentation"));

/* Blockchain Connector */
const BlockchainConnectorPanel = lazy(() => import("@/components/panels/BlockchainConnectorPanel"));

/* AGI Substrate panels */
const SelfModelViewer = lazy(() => import("@/components/monitoring/SelfModelViewer"));
const GoalGenomeViewer = lazy(() => import("@/components/monitoring/GoalGenomeViewer"));
const WorldSimViewer = lazy(() => import("@/components/monitoring/WorldSimViewer"));
const SelfImprovementViewer = lazy(() => import("@/components/monitoring/SelfImprovementViewer"));
const TripwireMonitor = lazy(() => import("@/components/monitoring/TripwireMonitor"));

/* ── Explorer Sub-App Panels (ported from apps/explorer) ──── */
const AISwarmPanel       = lazy(() => import("@/components/panels/explorer/AISwarmPanel"));
const BlogPanel          = lazy(() => import("@/components/panels/explorer/BlogPanel"));
const BridgePanel        = lazy(() => import("@/components/panels/explorer/BridgePanel"));
const CommunityPanel     = lazy(() => import("@/components/panels/explorer/CommunityPanel"));
const EarnPanel          = lazy(() => import("@/components/panels/explorer/EarnPanel"));
const EcosystemPanel     = lazy(() => import("@/components/panels/explorer/EcosystemPanel"));
const BlockExplorerPanel = lazy(() => import("@/components/panels/explorer/BlockExplorerPanel"));
const LearnPanel         = lazy(() => import("@/components/panels/explorer/LearnPanel"));
const MetricsPanel       = lazy(() => import("@/components/panels/explorer/MetricsPanel"));
const NetworkPanel2      = lazy(() => import("@/components/panels/explorer/NetworkPanel2"));
const PortfolioPanel     = lazy(() => import("@/components/panels/explorer/PortfolioPanel"));
const QuantumPanel       = lazy(() => import("@/components/panels/explorer/QuantumPanel"));
const SecurityPanel2     = lazy(() => import("@/components/panels/explorer/SecurityPanel2"));
const StakePanel         = lazy(() => import("@/components/panels/explorer/StakePanel"));
const SwapPanel          = lazy(() => import("@/components/panels/explorer/SwapPanel"));
const TreasuryPanel      = lazy(() => import("@/components/panels/explorer/TreasuryPanel"));
const X3ChainPanel       = lazy(() => import("@/components/panels/explorer/X3ChainPanel"));
const X3OSPanel          = lazy(() => import("@/components/panels/explorer/X3OSPanel"));
const X3StarPanel        = lazy(() => import("@/components/panels/explorer/X3StarPanel"));
const PrivacyPanel       = lazy(() => import("@/components/panels/explorer/PrivacyPanel"));
const TermsPanel         = lazy(() => import("@/components/panels/explorer/TermsPanel"));

/* ── Explorer Sub-Pages (deeper routes) ──── */
const DevDocsPanel          = lazy(() => import("@/components/panels/explorer/DevDocsPanel"));
const SolutionsDetailPanel  = lazy(() => import("@/components/panels/explorer/SolutionsDetailPanel"));
const NetworkValidatorsPanel = lazy(() => import("@/components/panels/explorer/NetworkValidatorsPanel"));
const LearnArchitecturePanel = lazy(() => import("@/components/panels/explorer/LearnArchitecturePanel"));
const X3SubPagesPanel       = lazy(() => import("@/components/panels/explorer/X3SubPagesPanel"));
const CommunitySubPanel     = lazy(() => import("@/components/panels/explorer/CommunitySubPanel"));
const QuantumEnhancedPanel  = lazy(() => import("@/components/panels/explorer/QuantumEnhancedPanel"));
const ExplorerHomePanel     = lazy(() => import("@/components/panels/explorer/ExplorerHomePanel"));
const ExplorerDetailPanel   = lazy(() => import("@/components/panels/explorer/ExplorerDetailPanel"));

/* ── Wallet (ported from apps/wallet) ──── */
const WalletPanel = lazy(() => import("@/components/panels/wallet/WalletPanel"));
const NftGalleryPanel = lazy(() => import("@/components/panels/wallet/NftGalleryPanel"));
const TokenChartsPanel = lazy(() => import("@/components/panels/wallet/TokenChartsPanel"));
const PrivacyModePanel = lazy(() => import("@/components/panels/wallet/PrivacyModePanel"));

/* ── X3 Intelligence (ported from apps/x3-intelligence) ──── */
const X3FloorDashboardPanel = lazy(() => import("@/components/panels/x3intel/X3FloorDashboardPanel"));
const X3AgentsPanel         = lazy(() => import("@/components/panels/x3intel/X3AgentsPanel"));
const X3BondsPanel          = lazy(() => import("@/components/panels/x3intel/X3BondsPanel"));
const X3GuidePanel          = lazy(() => import("@/components/panels/x3intel/X3GuidePanel"));
const X3IntentsPanel        = lazy(() => import("@/components/panels/x3intel/X3IntentsPanel"));
const X3SlashingPanel       = lazy(() => import("@/components/panels/x3intel/X3SlashingPanel"));
const X3WhyPanel            = lazy(() => import("@/components/panels/x3intel/X3WhyPanel"));

/* ── DEX (ported from apps/dex) ──── */
const DexPanel           = lazy(() => import("@/components/panels/dex/DexPanel"));
const DexPoolsPanel      = lazy(() => import("@/components/panels/dex/DexPoolsPanel"));
const DexOrderbookPanel  = lazy(() => import("@/components/panels/dex/DexOrderbookPanel"));
const ConcentratedLiquidityPanel = lazy(() => import("@/components/panels/dex/ConcentratedLiquidityPanel"));
const DexAdvancedOrdersPanel = lazy(() => import("@/components/panels/dex/DexAdvancedOrdersPanel"));
const TransactionSimulatorPanel = lazy(() => import("@/components/panels/dex/TransactionSimulatorPanel"));
const LpNftMarketplacePanel = lazy(() => import("@/components/panels/dex/LpNftMarketplacePanel"));

/* ── DeFi (Vote-Escrow & Liquidity Mining) ──── */
const VeX3Panel = lazy(() => import("@/components/panels/defi/VeX3Panel"));
const LiquidityMiningPanel = lazy(() => import("@/components/panels/defi/LiquidityMiningPanel"));
const TokenLaunchpadPanel = lazy(() => import("@/components/panels/defi/TokenLaunchpadPanel"));

/* ── Social (Social Network & Creator Economy) ──── */
const SocialPanel = lazy(() => import("@/components/panels/social/SocialPanel"));
const CreatorMonetizationPanel = lazy(() => import("@/components/panels/social/CreatorMonetizationPanel"));

/* ── Trading & Bots ──── */
const StrategyBuilderPanel = lazy(() => import("@/components/panels/trading/StrategyBuilderPanel"));
const BacktestingPanel = lazy(() => import("@/components/panels/trading/BacktestingPanel"));
const BotMarketplacePanel = lazy(() => import("@/components/panels/trading/BotMarketplacePanel"));
const MevBotPanel = lazy(() => import("@/components/panels/trading/MevBotPanel"));

/* ── Swarm Dashboard (ported from apps/swarm-dashboard) ──── */
const SwarmDashboardPanel = lazy(() => import("@/components/panels/swarm/SwarmDashboardPanel"));

/* ── Infrastructure Dashboard (ported from apps/inferstructor-dashboard) ──── */
const InfrastructurePanel = lazy(() => import("@/components/panels/infrastructure/InfrastructurePanel"));
const RpcStatsPanel = lazy(() => import("@/components/panels/infrastructure/RpcStatsPanel"));
const AirdropsPanel = lazy(() => import("@/components/panels/infrastructure/AirdropsPanel"));
const WhaleTrackerPanel = lazy(() => import("@/components/panels/infrastructure/WhaleTrackerPanel"));
const BridgeStatusPanel = lazy(() => import("@/components/panels/infrastructure/BridgeStatusPanel"));

/* ── Desktop Updates & Settings ──── */
const DesktopUpdatesPanel = lazy(() => import("@/components/panels/desktop/DesktopUpdatesPanel"));
const WidgetLayerPanel = lazy(() => import("@/components/panels/desktop/WidgetLayerPanel"));
const WindowLayoutsPanel = lazy(() => import("@/components/panels/desktop/WindowLayoutsPanel"));

/* ── Validators Globe (ported from apps/validators) ──── */
const ValidatorsPanel = lazy(() => import("@/components/panels/validators/ValidatorsPanel"));
const ValidatorSetupWizardPanel = lazy(() => import("@/components/panels/validators/ValidatorSetupWizardPanel"));
const ValidatorLeaderboardPanel = lazy(() => import("@/components/panels/validators/ValidatorLeaderboardPanel"));

/* ── Health Dashboard (ported from apps/health-dashboard) ──── */
const HealthDashboardPanel = lazy(() => import("@/components/panels/health/HealthDashboardPanel"));

/* ── Admin Dashboard ──── */
const AdminPanel = lazy(() => import("@/components/panels/admin/AdminPanel"));

/* ── Analytics (Risk, Heatmap, etc) ──── */
const CryptoHeatmapPanel = lazy(() => import("@/components/panels/analytics/CryptoHeatmapPanel"));
const PortfolioRiskPanel = lazy(() => import("@/components/panels/analytics/PortfolioRiskPanel"));

/* ── Documentation & API ──── */
const ApiReferencePanel = lazy(() => import("@/components/panels/documentation/ApiReferencePanel"));

/* ── Sprint 9: App Store, Multi-Monitor, KYC, Whitelist, Anti-Sniper, Token Audit, Liquidity Lock, Social Recovery, Governance, Analytics Audit ──── */
const AppStorePanel = lazy(() => import("@/components/panels/desktop/AppStorePanel"));
const MultiMonitorPanel = lazy(() => import("@/components/panels/desktop/MultiMonitorPanel"));
const KycGatingPanel = lazy(() => import("@/components/panels/defi/KycGatingPanel"));
const WhitelistPresalePanel = lazy(() => import("@/components/panels/defi/WhitelistPresalePanel"));
const AntisniperPanel = lazy(() => import("@/components/panels/defi/AntisniperPanel"));
const TokenAuditPanel = lazy(() => import("@/components/panels/defi/TokenAuditPanel"));
const LiquidityLockPanel = lazy(() => import("@/components/panels/defi/LiquidityLockPanel"));
const SocialRecoveryPanel = lazy(() => import("@/components/panels/global/SocialRecoveryPanel"));
const GovernancePanel = lazy(() => import("@/components/panels/global/GovernancePanel"));
const AnalyticsAuditPanel = lazy(() => import("@/components/panels/global/AnalyticsAuditPanel"));

/* ── Sprint 10: Content Moderation, Agent Marketplace, Advanced DEX, Infrastructure Automation, Enterprise Security, Cross-Chain Bridge, Compliance Report, Token Vesting, API Gateway, Disaster Recovery ──── */
const ContentModerationPanel = lazy(() => import("@/components/panels/social/ContentModerationPanel"));
const AgentMarketplacePanel = lazy(() => import("@/components/panels/trading/AgentMarketplacePanel"));
const AdvancedDexPanel = lazy(() => import("@/components/panels/dex/AdvancedDexPanel"));
const InfrastructureAutomationPanel = lazy(() => import("@/components/panels/infrastructure/InfrastructureAutomationPanel"));
const EnterpriseSecurityPanel = lazy(() => import("@/components/panels/admin/EnterpriseSecurityPanel"));
const CrossChainBridgePanel = lazy(() => import("@/components/panels/infrastructure/CrossChainBridgePanel"));
const ComplianceReportPanel = lazy(() => import("@/components/panels/admin/ComplianceReportPanel"));
const TokenVestingPanel = lazy(() => import("@/components/panels/trading/TokenVestingPanel"));
const APIGatewayPanel = lazy(() => import("@/components/panels/infrastructure/APIGatewayPanel"));
const DisasterRecoveryPanel = lazy(() => import("@/components/panels/infrastructure/DisasterRecoveryPanel"));

/* ── Global Search ──── */
const GlobalSearchPanel = lazy(() => import("@/components/panels/global/GlobalSearchPanel"));
const CrashReporterPanel = lazy(() => import("@/components/panels/global/CrashReporterPanel"));

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
  "system-monitoring": MonitoringDashboard,
  "world-monitor":    WorldMonitorPanel,
  "documentation":   DocumentationPanel,

  // Aliases: existing apps can also route to panels
  "admin-command-center":   NetworkPanel,
  "htlc-manager":           StoragePanel,
  "dev-dashboard":          DevToolsPanel,

  // AGI Substrate panels
  "self-model":             SelfModelViewer,
  "goal-genome":            GoalGenomeViewer,
  "world-sim":              WorldSimViewer,
  "self-improvement":       SelfImprovementViewer,
  "tripwire-monitor":       TripwireMonitor,

  // Enterprise Blockchain Connector
  "blockchain-connector":   BlockchainConnectorPanel,

  /* ── Explorer Sub-Apps (native panels, no iframe needed) ── */
  "ai-swarm":               AISwarmPanel,
  "blog":                   BlogPanel,
  "bridge":                 BridgePanel,
  "community":              CommunityPanel,
  "earn":                   EarnPanel,
  "ecosystem":              EcosystemPanel,
  "block-explorer":         BlockExplorerPanel,
  "learn":                  LearnPanel,
  "defi-metrics":           MetricsPanel,
  "network-status":         NetworkPanel2,
  "portfolio":              PortfolioPanel,
  "quantum-landing":        QuantumPanel,
  "security-page":          SecurityPanel2,
  "stake":                  StakePanel,
  "atomic-swap":            SwapPanel,
  "treasury":               TreasuryPanel,
  "x3-chain":               X3ChainPanel,
  "x3os":                   X3OSPanel,
  "x3star":                 X3StarPanel,
  "privacy-policy":         PrivacyPanel,
  "terms-of-service":       TermsPanel,
  "developers-portal":      DevDocsPanel,       // full developer docs portal
  "prometheus-metrics":     MetricsPanel,       // shares the metrics panel
  "solutions":              SolutionsDetailPanel, // full solutions detail panel

  /* ── Explorer Sub-Pages (deeper routes) ── */
  "dev-docs":               DevDocsPanel,
  "solutions-detail":       SolutionsDetailPanel,
  "network-validators":     NetworkValidatorsPanel,
  "learn-architecture":     LearnArchitecturePanel,
  "x3-sub-pages":           X3SubPagesPanel,
  "community-hub":          CommunitySubPanel,
  "quantum-enhanced":       QuantumEnhancedPanel,
  "explorer-home":          ExplorerHomePanel,
  "explorer-detail":        ExplorerDetailPanel,

  /* ── Wallet (ported from apps/wallet) ── */
  "wallet":                 WalletPanel,
  "wallet-dashboard":       WalletPanel,
  "wallet-send":            WalletPanel,
  "wallet-receive":         WalletPanel,
  "wallet-swap":            WalletPanel,

  /* ── X3 Intelligence (ported from apps/x3-intelligence) ── */
  "x3-floor-dashboard":     X3FloorDashboardPanel,
  "x3-agents":              X3AgentsPanel,
  "x3-bonds":               X3BondsPanel,
  "x3-guide":               X3GuidePanel,
  "x3-intents":             X3IntentsPanel,
  "x3-slashing":            X3SlashingPanel,
  "x3-why":                 X3WhyPanel,
  "x3-intelligence":        X3FloorDashboardPanel, // override old alias

  /* ── DEX (ported from apps/dex) ── */
  "dex":                    DexPanel,
  "dex-swap":               DexPanel,
  "dex-pools":              DexPoolsPanel,
  "dex-orderbook":          DexOrderbookPanel,

  /* ── DeFi (Vote-Escrow & Liquidity Mining) ── */
  "vex3":                   VeX3Panel,
  "ve-tokenomics":          VeX3Panel,
  "liquidity-mining":       VeX3Panel,

  /* ── Social (Social Network & Creator Economy) ── */
  "social":                 SocialPanel,
  "social-feed":            SocialPanel,
  "creator-economy":        SocialPanel,
  "tipping":                SocialPanel,

  /* ── Validators (ported from apps/validators) ── */
  "validators":             ValidatorsPanel,

  /* ── Swarm Dashboard (ported from apps/swarm-dashboard) ── */
  "swarm-dashboard":        SwarmDashboardPanel,   // override old alias
  "gpu-swarm-dashboard":    SwarmDashboardPanel,

  /* ── Infrastructure Dashboard (ported from apps/inferstructor-dashboard) ── */
  "infrastructure":         InfrastructurePanel,
  "infra-dashboard":        InfrastructurePanel,
  "rpc-stats":              RpcStatsPanel,
  "rpc-pool":               RpcStatsPanel,
  "airdrops":               AirdropsPanel,
  "airdrops-faucets":       AirdropsPanel,
  "whale-tracker":          WhaleTrackerPanel,
  "whale-alerts":           WhaleTrackerPanel,

  /* ── Desktop Updates & Settings ── */
  "desktop-updates":        DesktopUpdatesPanel,
  "updates":                DesktopUpdatesPanel,
  "changelog":              DesktopUpdatesPanel,

  /* ── Health Dashboard (ported from apps/health-dashboard) ── */
  "health-dashboard":       HealthDashboardPanel,
  "system-health":          HealthDashboardPanel,

  /* ── Admin Dashboard ── */
  "admin-dashboard":        AdminPanel,
  "admin-panel":            AdminPanel,

  /* ── Sprint 6: Validator Setup, NFT Gallery, Concentrated Liquidity, Widgets ── */
  "validator-setup":        ValidatorSetupWizardPanel,
  "setup-wizard":           ValidatorSetupWizardPanel,
  "nft-gallery":            NftGalleryPanel,
  "nft-explorer":           NftGalleryPanel,
  "concentrated-liquidity": ConcentratedLiquidityPanel,
  "v3":                     ConcentratedLiquidityPanel,
  "widget-layer":           WidgetLayerPanel,
  "widgets":                WidgetLayerPanel,
  "floating-widgets":       WidgetLayerPanel,

  /* ── Sprint 7: Advanced Orders, Token Charts, Bridge, Creator Monetization, Leaderboard, API, Heatmap, Simulator, Risk, Search ── */
  "advanced-orders":        DexAdvancedOrdersPanel,
  "limit-orders":           DexAdvancedOrdersPanel,
  "stop-loss":              DexAdvancedOrdersPanel,
  "token-charts":           TokenChartsPanel,
  "price-charts":           TokenChartsPanel,
  "bridge-status":          BridgeStatusPanel,
  "cross-chain-bridge":     BridgeStatusPanel,
  "creator-monetization":   CreatorMonetizationPanel,
  "creator-earnings":       CreatorMonetizationPanel,
  "tipping":                CreatorMonetizationPanel,
  "validator-leaderboard":  ValidatorLeaderboardPanel,
  "validator-ranking":      ValidatorLeaderboardPanel,
  "api-reference":          ApiReferencePanel,
  "api-docs":               ApiReferencePanel,
  "crypto-heatmap":         CryptoHeatmapPanel,
  "market-heatmap":         CryptoHeatmapPanel,
  "transaction-simulator":  TransactionSimulatorPanel,
  "swap-preview":           TransactionSimulatorPanel,
  "portfolio-risk":         PortfolioRiskPanel,
  "portfolio-analytics":    PortfolioRiskPanel,
  "risk-analysis":          PortfolioRiskPanel,
  "global-search":          GlobalSearchPanel,
  "search":                 GlobalSearchPanel,
  "command-palette":        GlobalSearchPanel,

  /* ── Sprint 8: Liquidity Mining, Strategy Builder, Backtesting, Bot Marketplace, Token Launchpad, Privacy Mode, Window Layouts, LP NFT Marketplace, MEV Bot, Crash Reporter ── */
  "liquidity-mining":       LiquidityMiningPanel,
  "lm-rewards":             LiquidityMiningPanel,
  "strategy-builder":       StrategyBuilderPanel,
  "bot-strategy-composer":  StrategyBuilderPanel,
  "backtesting":            BacktestingPanel,
  "backtest-engine":        BacktestingPanel,
  "bot-marketplace":        BotMarketplacePanel,
  "strategy-marketplace":   BotMarketplacePanel,
  "token-launchpad":        TokenLaunchpadPanel,
  "tokenomics-designer":    TokenLaunchpadPanel,
  "presale":                TokenLaunchpadPanel,
  "privacy-mode":           PrivacyModePanel,
  "stealth-mode":           PrivacyModePanel,
  "transaction-mixer":      PrivacyModePanel,
  "window-layouts":         WindowLayoutsPanel,
  "snap-layouts":           WindowLayoutsPanel,
  "layout-manager":         WindowLayoutsPanel,
  "lp-nft-marketplace":     LpNftMarketplacePanel,
  "lp-position-nfts":       LpNftMarketplacePanel,
  "liquidity-nft-market":   LpNftMarketplacePanel,
  "mev-bot":                MevBotPanel,
  "mev-capture":            MevBotPanel,
  "sandwich-protection":    MevBotPanel,
  "crash-reporter":         CrashReporterPanel,
  "bug-reporter":           CrashReporterPanel,
  "error-report":           CrashReporterPanel,

  /* ── Sprint 9: App Store, Multi-Monitor, KYC, Whitelist Presales, Anti-Sniper, Token Audit, Liquidity Lock, Social Recovery, Governance, Analytics Audit ── */
  // Desktop
  "app-store":              AppStorePanel,
  "plugin-marketplace":     AppStorePanel,
  "extensions-store":       AppStorePanel,
  "desktop-apps":           AppStorePanel,
  "multi-monitor":          MultiMonitorPanel,
  "multi-display":          MultiMonitorPanel,
  "display-settings":       MultiMonitorPanel,
  "screen-arrangement":     MultiMonitorPanel,

  // DeFi - KYC & Compliance
  "kyc-gating":             KycGatingPanel,
  "kyc-verification":       KycGatingPanel,
  "aml-compliance":         KycGatingPanel,
  "identity-verification":  KycGatingPanel,
  "tier-limits":            KycGatingPanel,

  // DeFi - Whitelist Presales
  "whitelist-presale":      WhitelistPresalePanel,
  "presale-whitelist":      WhitelistPresalePanel,
  "whitelist-tiers":        WhitelistPresalePanel,
  "presale-rounds":         WhitelistPresalePanel,
  "presale-claims":         WhitelistPresalePanel,
  "token-allocation":       WhitelistPresalePanel,

  // DeFi - Anti-Sniper
  "anti-sniper":            AntisniperPanel,
  "antidump":               AntisniperPanel,
  "bot-protection":         AntisniperPanel,
  "sniper-defense":         AntisniperPanel,
  "launch-protection":      AntisniperPanel,

  // DeFi - Token Audit
  "token-audit":            TokenAuditPanel,
  "audit-badge":            TokenAuditPanel,
  "smart-contract-audit":   TokenAuditPanel,
  "security-audit":         TokenAuditPanel,
  "certik-audit":           TokenAuditPanel,

  // DeFi - Liquidity Lock
  "liquidity-lock":         LiquidityLockPanel,
  "lp-lock":                LiquidityLockPanel,
  "lock-lp":                LiquidityLockPanel,
  "lock-schedule":          LiquidityLockPanel,
  "unlock-schedule":        LiquidityLockPanel,

  // Global - Social Recovery
  "social-recovery":        SocialRecoveryPanel,
  "guardian-recovery":      SocialRecoveryPanel,
  "wallet-recovery":        SocialRecoveryPanel,
  "key-recovery":           SocialRecoveryPanel,
  "guardians":              SocialRecoveryPanel,

  // Global - Governance
  "governance":             GovernancePanel,
  "dao-governance":         GovernancePanel,
  "proposals":              GovernancePanel,
  "voting":                 GovernancePanel,
  "dao-voting":             GovernancePanel,
  "quorum":                 GovernancePanel,

  // Global - Analytics Audit
  "analytics-audit":        AnalyticsAuditPanel,
  "audit-analytics":        AnalyticsAuditPanel,
  "audit-history":          AnalyticsAuditPanel,
  "security-score":         AnalyticsAuditPanel,
  "vulnerability-timeline": AnalyticsAuditPanel,
  "audit-report":           AnalyticsAuditPanel,

  /* ── Sprint 10: Content Moderation, Agent Marketplace, Advanced DEX, Infrastructure Automation, Enterprise Security, Cross-Chain Bridge, Compliance Report, Token Vesting, API Gateway, Disaster Recovery ── */
  
  // Social - Content Moderation
  "content-moderation":     ContentModerationPanel,
  "moderation":             ContentModerationPanel,
  "community-moderation":   ContentModerationPanel,
  "content-flags":          ContentModerationPanel,
  "content-voting":         ContentModerationPanel,
  "audit-logs":             ContentModerationPanel,
  "moderation-dashboard":   ContentModerationPanel,

  // Trading - Agent Marketplace
  "agent-marketplace":      AgentMarketplacePanel,
  "bot-marketplace":        AgentMarketplacePanel,
  "strategy-marketplace":   AgentMarketplacePanel,
  "trading-bots":           AgentMarketplacePanel,
  "copy-trading":           AgentMarketplacePanel,
  "bot-subscription":       AgentMarketplacePanel,
  "ai-agents":              AgentMarketplacePanel,

  // DEX - Advanced Routing
  "advanced-dex":           AdvancedDexPanel,
  "dex-routing":            AdvancedDexPanel,
  "amm-routing":            AdvancedDexPanel,
  "intelligent-routing":    AdvancedDexPanel,
  "mev-protection":         AdvancedDexPanel,
  "route-optimization":     AdvancedDexPanel,
  "slippage-control":       AdvancedDexPanel,

  // Infrastructure - Automation
  "infrastructure-automation": InfrastructureAutomationPanel,
  "validator-automation":   InfrastructureAutomationPanel,
  "node-deployment":        InfrastructureAutomationPanel,
  "automation-tasks":       InfrastructureAutomationPanel,
  "validator-nodes":        InfrastructureAutomationPanel,
  "geo-nodes":              InfrastructureAutomationPanel,
  "deployment-manager":     InfrastructureAutomationPanel,

  // Admin - Enterprise Security
  "enterprise-security":    EnterpriseSecurityPanel,
  "access-control":         EnterpriseSecurityPanel,
  "rbac":                   EnterpriseSecurityPanel,
  "hsm-keys":               EnterpriseSecurityPanel,
  "key-management":         EnterpriseSecurityPanel,
  "audit-trail":            EnterpriseSecurityPanel,
  "access-logs":            EnterpriseSecurityPanel,

  // Infrastructure - Cross-Chain Bridge
  "cross-chain-bridge":     CrossChainBridgePanel,
  "bridge":                 CrossChainBridgePanel,
  "atomic-swap":            CrossChainBridgePanel,
  "bridge-liquidity":       CrossChainBridgePanel,
  "bridge-transfers":       CrossChainBridgePanel,
  "bridging":               CrossChainBridgePanel,
  "liquidity-pools-bridge": CrossChainBridgePanel,

  // Admin - Compliance Report
  "compliance-report":      ComplianceReportPanel,
  "compliance-dashboard":   ComplianceReportPanel,
  "soc2-compliance":        ComplianceReportPanel,
  "gdpr-compliance":        ComplianceReportPanel,
  "iso-compliance":         ComplianceReportPanel,
  "regulatory-dashboard":   ComplianceReportPanel,
  "audit-compliance":       ComplianceReportPanel,

  // Trading - Token Vesting
  "token-vesting":          TokenVestingPanel,
  "vesting-schedule":       TokenVestingPanel,
  "unlock-schedule":        TokenVestingPanel,
  "vesting-timeline":       TokenVestingPanel,
  "cliff-release":          TokenVestingPanel,
  "token-release":          TokenVestingPanel,
  "vesting-dashboard":      TokenVestingPanel,

  // Infrastructure - API Gateway
  "api-gateway":            APIGatewayPanel,
  "rate-limiting":          APIGatewayPanel,
  "quota-management":       APIGatewayPanel,
  "api-keys":               APIGatewayPanel,
  "api-quota":              APIGatewayPanel,
  "rate-limits":            APIGatewayPanel,
  "api-analytics":          APIGatewayPanel,

  // Infrastructure - Disaster Recovery
  "disaster-recovery":      DisasterRecoveryPanel,
  "backup-recovery":        DisasterRecoveryPanel,
  "backup-snapshots":       DisasterRecoveryPanel,
  "restore-points":         DisasterRecoveryPanel,
  "recovery-testing":       DisasterRecoveryPanel,
  "backup-management":      DisasterRecoveryPanel,
  "rto-rpo":                DisasterRecoveryPanel,
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
