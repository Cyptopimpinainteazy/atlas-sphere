import { create } from 'zustand';

const STORAGE_KEY = 'atlas-superide:preferences';

interface IDEPreferences {
  workspaceRoot: string;
  favoriteWorkspaceRoots: string[];
  pinnedFiles: string[];
  editorWordWrap: boolean;
  editorMinimap: boolean;
  terminalTranscript: string;
  lastBuildOrTestCommand: string;
  noAddModeEnabled: boolean;
  noAddObjective: string;
  noAddDefinitionOfDone: string;
  noAddRoleProfile: string;
  openclawBaseUrl: string;
  openclawToolEndpoint: string;
  openclawGatewayToken: string;
  openclawDefaultProfile: OpenClawToolProfile;
  openclawWebProvider: OpenClawConfig['webProvider'];
  openclawLoopDetectionEnabled: boolean;
}

const DEFAULT_PREFERENCES: IDEPreferences = {
  workspaceRoot: '.',
  favoriteWorkspaceRoots: ['.', 'apps', 'crates', 'runtime', 'pallets'],
  pinnedFiles: [],
  editorWordWrap: false,
  editorMinimap: false,
  terminalTranscript: '',
  lastBuildOrTestCommand: '',
  noAddModeEnabled: false,
  noAddObjective: '',
  noAddDefinitionOfDone: '',
  noAddRoleProfile:
    'Operate as a structured principal engineer: product-minded, full-stack, backend, frontend, DevOps, security, QA, and blockchain-aware. Stay on the current objective until it is fully complete.',
  openclawBaseUrl: '',
  openclawToolEndpoint: '/api/tools/invoke',
  openclawGatewayToken: '',
  openclawDefaultProfile: 'coding',
  openclawWebProvider: 'brave',
  openclawLoopDetectionEnabled: true,
};

const MAX_TERMINAL_TRANSCRIPT_CHARS = 120_000;

function loadPreferences(): IDEPreferences {
  if (typeof window === 'undefined') {
    return DEFAULT_PREFERENCES;
  }

  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      return DEFAULT_PREFERENCES;
    }

    const parsed = JSON.parse(raw) as Partial<IDEPreferences>;
    return {
      workspaceRoot: parsed.workspaceRoot || DEFAULT_PREFERENCES.workspaceRoot,
      favoriteWorkspaceRoots:
        parsed.favoriteWorkspaceRoots?.length
          ? Array.from(new Set(parsed.favoriteWorkspaceRoots))
          : DEFAULT_PREFERENCES.favoriteWorkspaceRoots,
      pinnedFiles:
        parsed.pinnedFiles?.length
          ? Array.from(new Set(parsed.pinnedFiles))
          : DEFAULT_PREFERENCES.pinnedFiles,
      editorWordWrap:
        typeof parsed.editorWordWrap === 'boolean'
          ? parsed.editorWordWrap
          : DEFAULT_PREFERENCES.editorWordWrap,
      editorMinimap:
        typeof parsed.editorMinimap === 'boolean'
          ? parsed.editorMinimap
          : DEFAULT_PREFERENCES.editorMinimap,
      terminalTranscript:
        typeof parsed.terminalTranscript === 'string'
          ? parsed.terminalTranscript.slice(-MAX_TERMINAL_TRANSCRIPT_CHARS)
          : DEFAULT_PREFERENCES.terminalTranscript,
      lastBuildOrTestCommand:
        typeof parsed.lastBuildOrTestCommand === 'string'
          ? parsed.lastBuildOrTestCommand
          : DEFAULT_PREFERENCES.lastBuildOrTestCommand,
      noAddModeEnabled:
        typeof parsed.noAddModeEnabled === 'boolean'
          ? parsed.noAddModeEnabled
          : DEFAULT_PREFERENCES.noAddModeEnabled,
      noAddObjective:
        typeof parsed.noAddObjective === 'string'
          ? parsed.noAddObjective
          : DEFAULT_PREFERENCES.noAddObjective,
      noAddDefinitionOfDone:
        typeof parsed.noAddDefinitionOfDone === 'string'
          ? parsed.noAddDefinitionOfDone
          : DEFAULT_PREFERENCES.noAddDefinitionOfDone,
      noAddRoleProfile:
        typeof parsed.noAddRoleProfile === 'string' && parsed.noAddRoleProfile.trim()
          ? parsed.noAddRoleProfile
          : DEFAULT_PREFERENCES.noAddRoleProfile,
      openclawBaseUrl:
        typeof parsed.openclawBaseUrl === 'string'
          ? parsed.openclawBaseUrl
          : DEFAULT_PREFERENCES.openclawBaseUrl,
      openclawToolEndpoint:
        typeof parsed.openclawToolEndpoint === 'string' && parsed.openclawToolEndpoint.trim()
          ? parsed.openclawToolEndpoint
          : DEFAULT_PREFERENCES.openclawToolEndpoint,
      openclawGatewayToken:
        typeof parsed.openclawGatewayToken === 'string'
          ? parsed.openclawGatewayToken
          : DEFAULT_PREFERENCES.openclawGatewayToken,
      openclawDefaultProfile:
        parsed.openclawDefaultProfile === 'minimal' ||
        parsed.openclawDefaultProfile === 'coding' ||
        parsed.openclawDefaultProfile === 'messaging' ||
        parsed.openclawDefaultProfile === 'full'
          ? parsed.openclawDefaultProfile
          : DEFAULT_PREFERENCES.openclawDefaultProfile,
      openclawWebProvider:
        parsed.openclawWebProvider === 'perplexity' ||
        parsed.openclawWebProvider === 'gemini' ||
        parsed.openclawWebProvider === 'grok' ||
        parsed.openclawWebProvider === 'kimi' ||
        parsed.openclawWebProvider === 'brave'
          ? parsed.openclawWebProvider
          : DEFAULT_PREFERENCES.openclawWebProvider,
      openclawLoopDetectionEnabled:
        typeof parsed.openclawLoopDetectionEnabled === 'boolean'
          ? parsed.openclawLoopDetectionEnabled
          : DEFAULT_PREFERENCES.openclawLoopDetectionEnabled,
    };
  } catch {
    return DEFAULT_PREFERENCES;
  }
}

let persistedPreferences = loadPreferences();

function savePreferences(patch: Partial<IDEPreferences>) {
  persistedPreferences = { ...persistedPreferences, ...patch };
  if (typeof window === 'undefined') {
    return;
  }
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(persistedPreferences));
}

// ── Types ──────────────────────────────────────────────────────────────
export type SidebarPanel =
  | 'explorer'
  | 'search'
  | 'remix'
  | 'ai-chat'
  | 'agents'
  | 'openclaw'
  | 'notebook'
  | 'rag'
  | 'knowledge'
  | 'research'
  | 'skills'
  | 'settings';

export type RightSidebarPanel =
  | 'bolt-chat'
  | 'testing'
  | 'coverage'
  | 'outline'
  | 'git';

export type BottomPanel = 'terminal' | 'output' | 'problems' | 'rag-results' | 'tests';
export type AiChatMode = 'chat' | 'task-plan' | 'context-eng';
export type AgentProvider = 'ollama' | 'openrouter' | 'ollamafree' | 'gptoss';
export type AgentExecutionMode = 'parallel' | 'sequential';
export type AgentRunStatus = 'queued' | 'running' | 'completed' | 'failed' | 'cancelled' | 'stalled';
export type OpenClawToolProfile = 'minimal' | 'coding' | 'messaging' | 'full';

export interface OpenClawProviderPolicyOverride {
  profile?: OpenClawToolProfile;
  allow?: string[];
  deny?: string[];
}

export interface OpenClawToolPolicy {
  profile: OpenClawToolProfile;
  allow: string[];
  deny: string[];
  byProvider: Record<string, OpenClawProviderPolicyOverride>;
}

export interface OpenClawConfig {
  baseUrl: string;
  toolEndpoint: string;
  gatewayToken: string;
  defaultProfile: OpenClawToolProfile;
  webProvider: 'brave' | 'perplexity' | 'gemini' | 'grok' | 'kimi';
  loopDetectionEnabled: boolean;
}

export interface FileTab {
  id: string;
  name: string;
  path: string;
  language: string;
  content: string;
  isDirty: boolean;
  cursorLine?: number | null;
}

export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp: number;
  model?: string;
}

export interface OllamaModel {
  name: string;
  size: string;
  quantization: string;
  modified: string;
  capabilities: string[];
}

export interface RagSource {
  id: string;
  url: string;
  title: string;
  domain?: string;
  chunkCount: number;
  crawledAt: number;
  status: 'crawling' | 'ready' | 'error';
  pageCount?: number;
  lastCrawled?: string;
}

export interface RagResult {
  content: string;
  source: string;
  score?: number;
  metadata?: Record<string, unknown>;
}

export interface KnowledgeEntry {
  id: string;
  title: string;
  content: string;
  category: 'pitfall' | 'pattern' | 'config' | 'reference';
  tags: string[];
  path?: string;
  createdAt: number;
  updatedAt: number;
  lastModified?: string;
}

export interface NotebookSession {
  id: string;
  title: string;
  sourceType: 'pdf' | 'url' | 'text';
  sourceUrl?: string;
  source?: string;
  status?: 'idle' | 'generating' | 'complete';
  transcript?: string;
  focusArea?: string;
  audioUrl?: string;
  createdAt: number;
}

export interface TaskPlan {
  id: string;
  description: string;
  status: 'pending' | 'running' | 'complete' | 'failed';
  steps: TaskStep[];
}

export interface TaskStep {
  id: string;
  action: string;
  file?: string;
  lineRange?: [number, number];
  description: string;
  status: 'pending' | 'running' | 'complete' | 'failed';
}

export interface ResearchCard {
  id: string;
  type: string;
  title: string;
  content: string;
  zone?: string;
  createdAt: number;
}

export interface EditorError {
  filePath: string;
  line: number;
  column: number;
  severity: 'error' | 'warning' | 'info';
  message: string;
  source: 'test' | 'lint' | 'security';
}

export interface AgentProfile {
  id: string;
  name: string;
  role: string;
  provider: AgentProvider;
  model: string;
  systemPrompt: string;
  openclawTools: OpenClawToolPolicy;
  enabled: boolean;
}

export interface AgentRunAgentResult {
  id: string;
  name: string;
  role: string;
  provider: AgentProvider;
  model: string;
  status: AgentRunStatus;
  output?: string;
  error?: string;
}

export interface AgentRun {
  id: string;
  objective: string;
  definitionOfDone: string;
  executionMode: AgentExecutionMode;
  status: AgentRunStatus;
  createdAt: number;
  updatedAt: number;
  summary?: string;
  ralphMode?: boolean;
  ralphLoop?: boolean;
  maxIterations?: number;
  iterationCount?: number;
  checklist?: {
    total: number;
    completed: number;
    remaining: string[];
  };
  agents: AgentRunAgentResult[];
}

export interface AgentPromptPreset {
  id: string;
  label: string;
  role: string;
  prompt: string;
}

export const AGENT_PROMPT_PRESETS: AgentPromptPreset[] = [
  {
    id: 'general',
    label: 'General Specialist',
    role: 'Specialist',
    prompt:
      'Work in a structured, delivery-first way. Stay inside your specialty, surface assumptions, list concrete risks, and end with specific next actions that move the shared objective forward.',
  },
  {
    id: 'planner',
    label: 'Project Manager',
    role: 'Project manager and delivery lead',
    prompt:
      'Break the objective into clear milestones, define acceptance criteria, identify blockers early, and keep the team focused on finishing the current scope before adding new work.',
  },
  {
    id: 'bug-killer',
    label: 'Bug Killer',
    role: 'Defect isolation and debugging specialist',
    prompt:
      'Focus on reproducing failures, narrowing root causes, validating fixes, and calling out regression risk. Prefer evidence, exact failure conditions, and the shortest path to a verified fix.',
  },
  {
    id: 'frontend',
    label: 'Front-End',
    role: 'Front-end developer',
    prompt:
      'Own the user-facing layer. Focus on UI behavior, visual consistency, accessibility, responsiveness, and interaction quality using clean, maintainable frontend patterns.',
  },
  {
    id: 'backend',
    label: 'Back-End',
    role: 'Back-end developer',
    prompt:
      'Own server-side behavior. Focus on APIs, data flow, persistence, reliability, validation, and operational correctness. Call out contract changes and backend edge cases clearly.',
  },
  {
    id: 'fullstack',
    label: 'Full-Stack',
    role: 'Full-stack engineer',
    prompt:
      'Connect frontend and backend concerns into one working delivery. Watch integration seams, state flow, API contracts, and end-to-end user impact.',
  },
  {
    id: 'test',
    label: 'Testing',
    role: 'Testing and QA specialist',
    prompt:
      'Focus on tests, validation, breakpoints, regressions, and acceptance criteria. Define what must be verified, what is still unproven, and which failures would block release.',
  },
  {
    id: 'coding',
    label: 'Coding',
    role: 'Implementation engineer',
    prompt:
      'Focus on implementation details, code changes, refactors, and delivery. Prefer the smallest correct change, preserve existing behavior unless the objective requires otherwise, and note integration touchpoints.',
  },
  {
    id: 'integration',
    label: 'Integration',
    role: 'Integration and systems engineer',
    prompt:
      'Focus on integration risks, API boundaries, data flow, and end-to-end behavior. Check compatibility between components and call out assumptions that could fail in real environments.',
  },
  {
    id: 'security',
    label: 'Security',
    role: 'Security engineer',
    prompt:
      'Focus on security impact, trust boundaries, input validation, auth, secrets handling, and abuse paths. Flag concrete vulnerabilities and recommend practical mitigations.',
  },
  {
    id: 'devops',
    label: 'DevOps',
    role: 'DevOps and delivery engineer',
    prompt:
      'Focus on build pipelines, deployment safety, runtime stability, observability, rollback paths, and environment consistency. Keep operational execution explicit and reproducible.',
  },
  {
    id: 'blockchain-core',
    label: 'Blockchain Core',
    role: 'Core blockchain developer',
    prompt:
      'Focus on protocol logic, consensus assumptions, node behavior, cryptographic boundaries, and network-level safety. Treat correctness and determinism as primary constraints.',
  },
  {
    id: 'smart-contract',
    label: 'Smart Contract',
    role: 'Smart contract developer',
    prompt:
      'Focus on contract logic, state transitions, permission checks, economic risk, and invariant safety. Call out exploit paths, upgrade concerns, and test requirements.',
  },
  {
    id: 'web3-frontend',
    label: 'Web3 Front-End',
    role: 'Web3 frontend developer',
    prompt:
      'Focus on wallet UX, transaction safety, chain state visibility, error handling, and the user path between frontend actions and on-chain results.',
  },
];

function presetById(id: string) {
  return AGENT_PROMPT_PRESETS.find((preset) => preset.id === id) || AGENT_PROMPT_PRESETS[0];
}

function createDefaultOpenClawToolPolicy(
  profile: OpenClawToolProfile = persistedPreferences.openclawDefaultProfile,
): OpenClawToolPolicy {
  return {
    profile,
    allow: [],
    deny: [],
    byProvider: {},
  };
}

function createDefaultOpenClawConfig(): OpenClawConfig {
  return {
    baseUrl: persistedPreferences.openclawBaseUrl,
    toolEndpoint: persistedPreferences.openclawToolEndpoint,
    gatewayToken: persistedPreferences.openclawGatewayToken,
    defaultProfile: persistedPreferences.openclawDefaultProfile,
    webProvider: persistedPreferences.openclawWebProvider,
    loopDetectionEnabled: persistedPreferences.openclawLoopDetectionEnabled,
  };
}

const DEFAULT_AGENT_PROFILES: AgentProfile[] = [
  {
    id: 'agent-test',
    name: 'Test Agent',
    role: presetById('test').role,
    provider: 'ollamafree',
    model: '',
    systemPrompt: presetById('test').prompt,
    openclawTools: createDefaultOpenClawToolPolicy('coding'),
    enabled: true,
  },
  {
    id: 'agent-code',
    name: 'Coding Agent',
    role: presetById('coding').role,
    provider: 'ollama',
    model: '',
    systemPrompt: presetById('coding').prompt,
    openclawTools: createDefaultOpenClawToolPolicy('coding'),
    enabled: true,
  },
  {
    id: 'agent-integration',
    name: 'Integration Agent',
    role: presetById('integration').role,
    provider: 'gptoss',
    model: '',
    systemPrompt: presetById('integration').prompt,
    openclawTools: createDefaultOpenClawToolPolicy('full'),
    enabled: true,
  },
];

// ── Store ──────────────────────────────────────────────────────────────
interface IDEStore {
  // Layout
  activeSidebar: SidebarPanel;
  activeBottomPanel: BottomPanel;
  isSidebarOpen: boolean;
  isBottomPanelOpen: boolean;
  setSidebar: (panel: SidebarPanel) => void;
  setBottomPanel: (panel: BottomPanel) => void;
  toggleSidebar: () => void;
  toggleBottomPanel: () => void;

  // Right Sidebar
  activeRightSidebar: RightSidebarPanel;
  isRightSidebarOpen: boolean;
  setRightSidebar: (panel: RightSidebarPanel) => void;
  toggleRightSidebar: () => void;

  // Bolt.diy Chat
  boltMessages: ChatMessage[];
  isBoltStreaming: boolean;
  addBoltMessage: (msg: ChatMessage) => void;
  setBoltStreaming: (v: boolean) => void;
  clearBoltChat: () => void;

  // Editor tabs
  openTabs: FileTab[];
  activeTabId: string | null;
  openTab: (tab: FileTab) => void;
  closeTab: (id: string) => void;
  setActiveTab: (id: string) => void;
  setTabCursorLine: (id: string, line: number | null) => void;
  updateTabContent: (id: string, content: string) => void;
  markTabSaved: (id: string) => void;

  // AI Chat (OpenClaw + Ollama)
  chatMessages: ChatMessage[];
  chatModel: string;
  availableModels: OllamaModel[];
  isChatStreaming: boolean;
  addChatMessage: (msg: ChatMessage) => void;
  setChatModel: (model: string) => void;
  setAvailableModels: (models: OllamaModel[]) => void;
  setChatStreaming: (v: boolean) => void;
  aiDraftInput: string;
  aiDraftMode: AiChatMode;
  seedAiChatInput: (prompt: string, mode?: AiChatMode) => void;
  clearAiDraftInput: () => void;
  clearChat: () => void;

  // RAG (Crawl4AI)
  ragSources: RagSource[];
  ragResults: RagResult[];
  isRagLoading: boolean;
  setRagSources: (sources: RagSource[]) => void;
  addRagSource: (source: RagSource) => void;
  setRagResults: (results: RagResult[]) => void;
  setRagLoading: (v: boolean) => void;

  // Knowledge Base (Chat Ralph)
  knowledgeEntries: KnowledgeEntry[];
  setKnowledgeEntries: (entries: KnowledgeEntry[]) => void;
  addKnowledgeEntry: (entry: KnowledgeEntry) => void;
  updateKnowledgeEntry: (id: string, entry: KnowledgeEntry) => void;
  removeKnowledgeEntry: (id: string) => void;

  // NotebookLM
  notebookSessions: NotebookSession[];
  setNotebookSessions: (sessions: NotebookSession[]) => void;
  activeNotebookId: string | null;
  addNotebookSession: (session: NotebookSession) => void;
  updateNotebookSession: (id: string, updates: Partial<NotebookSession>) => void;
  removeNotebookSession: (id: string) => void;
  setActiveNotebook: (id: string | null) => void;

  // Task Planning (Traycer)
  taskPlans: TaskPlan[];
  addTaskPlan: (plan: TaskPlan) => void;
  updateTaskStep: (planId: string, stepId: string, status: TaskStep['status']) => void;

  // Research Dashboard
  researchCards: ResearchCard[];
  setResearchCards: (cards: ResearchCard[]) => void;
  addResearchCard: (card: ResearchCard) => void;
  removeResearchCard: (id: string) => void;

  // Skills history
  skillHistory: any[];
  setSkillHistory: (history: any[]) => void;
  addSkillHistory: (entry: any) => void;
  removeSkillHistory: (id: string) => void;

  // Remix
  solidityCompilerVersion: string;
  compilationOutput: string;
  setSolidityCompiler: (version: string) => void;
  setCompilationOutput: (output: string) => void;

  // Workspace navigation
  workspaceRoot: string;
  favoriteWorkspaceRoots: string[];
  setWorkspaceRoot: (root: string) => void;
  addWorkspaceFavorite: (root: string) => void;
  removeWorkspaceFavorite: (root: string) => void;
  pinnedFiles: string[];
  addPinnedFile: (path: string) => void;
  removePinnedFile: (path: string) => void;

  // Editor preferences
  editorWordWrap: boolean;
  editorMinimap: boolean;
  setEditorWordWrap: (enabled: boolean) => void;
  setEditorMinimap: (enabled: boolean) => void;
  editorCursorLine: number;
  editorCursorColumn: number;
  setEditorCursorPosition: (line: number, column: number) => void;

  // Test & Lint errors (for inline squiggles)
  editorErrors: EditorError[];
  setEditorErrors: (errors: EditorError[]) => void;
  clearEditorErrors: (source?: EditorError['source']) => void;

  // Test execution results (for bottom panel)
  testOutput: string;
  testHistory: { timestamp: number; passed: number; failed: number; duration: number }[];
  setTestOutput: (output: string) => void;
  addTestToHistory: (passed: number, failed: number, duration: number) => void;
  openClawConfig: OpenClawConfig;
  setOpenClawConfig: (updates: Partial<OpenClawConfig>) => void;
  agentProfiles: AgentProfile[];
  setAgentProfiles: (profiles: AgentProfile[]) => void;
  addAgentProfile: () => void;
  updateAgentProfile: (id: string, updates: Partial<AgentProfile>) => void;
  removeAgentProfile: (id: string) => void;
  agentRuns: AgentRun[];
  setAgentRuns: (runs: AgentRun[]) => void;
  upsertAgentRun: (run: AgentRun) => void;
  terminalTranscript: string;
  appendTerminalTranscript: (chunk: string) => void;
  clearTerminalTranscript: () => void;
  lastBuildOrTestCommand: string;
  recordTerminalCommand: (command: string) => void;
  noAddModeEnabled: boolean;
  noAddObjective: string;
  noAddDefinitionOfDone: string;
  noAddRoleProfile: string;
  setNoAddModeEnabled: (enabled: boolean) => void;
  setNoAddObjective: (objective: string) => void;
  setNoAddDefinitionOfDone: (definition: string) => void;
  setNoAddRoleProfile: (profile: string) => void;
  clearNoAddFocus: () => void;

  // AI routing
  aiProvider: 'ollama' | 'openrouter' | 'ollamafree' | 'gptoss';
  aiModel: string;
  setAiProvider: (p: 'ollama' | 'openrouter' | 'ollamafree' | 'gptoss') => void;
  setAiModel: (m: string) => void;

  // Ollama connection (used when provider=ollama)
  ollamaUrl: string;
  ollamaConnected: boolean;
  setOllamaUrl: (url: string) => void;
  setOllamaConnected: (v: boolean) => void;
}

export const useIDEStore = create<IDEStore>((set) => ({
  // Layout
  activeSidebar: 'explorer',
  activeBottomPanel: 'terminal',
  isSidebarOpen: true,
  isBottomPanelOpen: true,
  setSidebar: (panel) => set({ activeSidebar: panel, isSidebarOpen: true }),
  setBottomPanel: (panel) => set({ activeBottomPanel: panel, isBottomPanelOpen: true }),
  toggleSidebar: () => set((s) => ({ isSidebarOpen: !s.isSidebarOpen })),
  toggleBottomPanel: () => set((s) => ({ isBottomPanelOpen: !s.isBottomPanelOpen })),

  // Right Sidebar
  activeRightSidebar: 'bolt-chat',
  isRightSidebarOpen: true,
  setRightSidebar: (panel) => set({ activeRightSidebar: panel, isRightSidebarOpen: true }),
  toggleRightSidebar: () => set((s) => ({ isRightSidebarOpen: !s.isRightSidebarOpen })),

  // Bolt.diy Chat
  boltMessages: [],
  isBoltStreaming: false,
  addBoltMessage: (msg) => set((s) => ({ boltMessages: [...s.boltMessages, msg] })),
  setBoltStreaming: (v) => set({ isBoltStreaming: v }),
  clearBoltChat: () => set({ boltMessages: [] }),

  // Editor tabs
  openTabs: [],
  activeTabId: null,
  openTab: (tab) =>
    set((s) => {
      const exists = s.openTabs.find((t) => t.id === tab.id);
      if (exists) {
        return {
          openTabs: s.openTabs.map((t) =>
            t.id === tab.id
              ? { ...t, cursorLine: tab.cursorLine ?? t.cursorLine ?? null }
              : t,
          ),
          activeTabId: tab.id,
        };
      }
      return { openTabs: [...s.openTabs, tab], activeTabId: tab.id };
    }),
  closeTab: (id) =>
    set((s) => {
      const newTabs = s.openTabs.filter((t) => t.id !== id);
      const newActive =
        s.activeTabId === id
          ? newTabs.length > 0
            ? newTabs[newTabs.length - 1].id
            : null
          : s.activeTabId;
      return { openTabs: newTabs, activeTabId: newActive };
    }),
  setActiveTab: (id) => set({ activeTabId: id }),
  setTabCursorLine: (id, line) =>
    set((s) => ({
      openTabs: s.openTabs.map((t) => (t.id === id ? { ...t, cursorLine: line } : t)),
    })),
  updateTabContent: (id, content) =>
    set((s) => ({
      openTabs: s.openTabs.map((t) => (t.id === id ? { ...t, content, isDirty: true } : t)),
    })),
  markTabSaved: (id) =>
    set((s) => ({
      openTabs: s.openTabs.map((t) => (t.id === id ? { ...t, isDirty: false } : t)),
    })),

  // AI routing defaults
  aiProvider: 'ollama',
  aiModel: '',
  setAiProvider: (p) =>
    set((s) => ({
      aiProvider: p,
      aiModel: p === 'ollama' ? s.chatModel : s.aiModel,
    })),
  setAiModel: (m) => set({ aiModel: m }),

  // AI Chat
  chatMessages: [],
  chatModel: '',
  availableModels: [],
  isChatStreaming: false,
  addChatMessage: (msg) => set((s) => ({ chatMessages: [...s.chatMessages, msg] })),
  setChatModel: (model) =>
    set((s) => ({
      chatModel: model,
      aiModel: s.aiProvider === 'ollama' ? model : s.aiModel,
    })),
  setAvailableModels: (models) =>
    set((s) => {
      const nextChatModel =
        models.length === 0
          ? s.chatModel
          : models.some((model) => model.name === s.chatModel)
          ? s.chatModel
          : models[0].name;

      return {
        availableModels: models,
        chatModel: nextChatModel,
        aiModel: s.aiProvider === 'ollama' ? nextChatModel : s.aiModel,
      };
    }),
  setChatStreaming: (v) => set({ isChatStreaming: v }),
  aiDraftInput: '',
  aiDraftMode: 'chat',
  seedAiChatInput: (prompt, mode = 'chat') =>
    set({
      aiDraftInput: prompt,
      aiDraftMode: mode,
      activeSidebar: 'ai-chat',
      isSidebarOpen: true,
    }),
  clearAiDraftInput: () => set({ aiDraftInput: '', aiDraftMode: 'chat' }),
  clearChat: () => set({ chatMessages: [] }),

  // RAG
  ragSources: [],
  ragResults: [],
  isRagLoading: false,
  setRagSources: (sources) => set({ ragSources: sources }),
  addRagSource: (source) =>
    set((s) => ({ ragSources: [...s.ragSources, source] })),
  setRagResults: (results) => set({ ragResults: results }),
  setRagLoading: (v) => set({ isRagLoading: v }),

  // Knowledge Base
  knowledgeEntries: [],
  setKnowledgeEntries: (entries) => set({ knowledgeEntries: entries }),
  addKnowledgeEntry: (entry) =>
    set((s) => ({ knowledgeEntries: [...s.knowledgeEntries, entry] })),
  updateKnowledgeEntry: (id, entry) =>
    set((s) => ({
      knowledgeEntries: s.knowledgeEntries.map((e) => (e.id === id ? entry : e)),
    })),
  removeKnowledgeEntry: (id) =>
    set((s) => ({
      knowledgeEntries: s.knowledgeEntries.filter((e) => e.id !== id),
    })),

  // NotebookLM
  notebookSessions: [],
  setNotebookSessions: (sessions) => set({ notebookSessions: sessions }),
  activeNotebookId: null,
  addNotebookSession: (session) =>
    set((s) => ({ notebookSessions: [...s.notebookSessions, session] })),
  updateNotebookSession: (id, updates) =>
    set((s) => ({
      notebookSessions: s.notebookSessions.map((n) =>
        n.id === id ? { ...n, ...updates } : n,
      ),
    })),
  removeNotebookSession: (id) =>
    set((s) => ({
      notebookSessions: s.notebookSessions.filter((n) => n.id !== id),
    })),
  setActiveNotebook: (id) => set({ activeNotebookId: id }),

  // Task Planning
  taskPlans: [],
  addTaskPlan: (plan) => set((s) => ({ taskPlans: [...s.taskPlans, plan] })),
  updateTaskStep: (planId, stepId, status) =>
    set((s) => ({
      taskPlans: s.taskPlans.map((p) =>
        p.id === planId
          ? {
              ...p,
              steps: p.steps.map((step) =>
                step.id === stepId ? { ...step, status } : step,
              ),
            }
          : p,
      ),
    })),

  // Research Dashboard
  researchCards: [],
  setResearchCards: (cards) => set({ researchCards: cards }),
  addResearchCard: (card) =>
    set((s) => ({ researchCards: [...s.researchCards, card] })),
  removeResearchCard: (id) =>
    set((s) => ({
      researchCards: s.researchCards.filter((c) => c.id !== id),
    })),

  // Skills history
  skillHistory: [],
  setSkillHistory: (history) => set({ skillHistory: history }),
  addSkillHistory: (entry) =>
    set((s) => ({ skillHistory: [...s.skillHistory, entry] })),
  removeSkillHistory: (id) =>
    set((s) => ({ skillHistory: s.skillHistory.filter((h) => h.id !== id) })),

  // Remix
  solidityCompilerVersion: '0.8.24',
  compilationOutput: '',
  setSolidityCompiler: (version) => set({ solidityCompilerVersion: version }),
  setCompilationOutput: (output) => set({ compilationOutput: output }),

  // Workspace navigation
  workspaceRoot: persistedPreferences.workspaceRoot,
  favoriteWorkspaceRoots: persistedPreferences.favoriteWorkspaceRoots,
  setWorkspaceRoot: (root) => {
    const nextRoot = root.trim() || '.';
    savePreferences({ workspaceRoot: nextRoot });
    set({ workspaceRoot: nextRoot });
  },
  addWorkspaceFavorite: (root) =>
    set((s) => {
      const normalized = root.trim() || '.';
      if (s.favoriteWorkspaceRoots.includes(normalized)) {
        return {};
      }
      const favoriteWorkspaceRoots = [...s.favoriteWorkspaceRoots, normalized];
      savePreferences({ favoriteWorkspaceRoots });
      return { favoriteWorkspaceRoots };
    }),
  pinnedFiles: persistedPreferences.pinnedFiles,
  addPinnedFile: (path) =>
    set((s) => {
      const normalized = path.trim();
      if (!normalized || s.pinnedFiles.includes(normalized)) {
        return {};
      }
      const pinnedFiles = [...s.pinnedFiles, normalized];
      savePreferences({ pinnedFiles });
      return { pinnedFiles };
    }),
  removePinnedFile: (path) =>
    set((s) => {
      const pinnedFiles = s.pinnedFiles.filter((item) => item !== path);
      savePreferences({ pinnedFiles });
      return { pinnedFiles };
    }),
  removeWorkspaceFavorite: (root) =>
    set((s) => {
      const favoriteWorkspaceRoots = s.favoriteWorkspaceRoots.filter((item) => item !== root);
      savePreferences({ favoriteWorkspaceRoots });
      return { favoriteWorkspaceRoots };
    }),

  // Editor preferences
  editorWordWrap: persistedPreferences.editorWordWrap,
  editorMinimap: persistedPreferences.editorMinimap,
  setEditorWordWrap: (enabled) => {
    savePreferences({ editorWordWrap: enabled });
    set({ editorWordWrap: enabled });
  },
  setEditorMinimap: (enabled) => {
    savePreferences({ editorMinimap: enabled });
    set({ editorMinimap: enabled });
  },
  editorCursorLine: 1,
  editorCursorColumn: 1,
  setEditorCursorPosition: (line, column) =>
    set({
      editorCursorLine: Math.max(1, line),
      editorCursorColumn: Math.max(1, column),
    }),

  // Test & Lint errors
  editorErrors: [],
  setEditorErrors: (errors) => set({ editorErrors: errors }),
  clearEditorErrors: (source) => {
    set((s) => ({
      editorErrors: source
        ? s.editorErrors.filter((e) => e.source !== source)
        : [],
    }));
  },

  // Test execution results
  testOutput: '',
  testHistory: [],
  setTestOutput: (output) => set({ testOutput: output }),
  addTestToHistory: (passed, failed, duration) => {
    set((s) => ({
      testHistory: [
        { timestamp: Date.now(), passed, failed, duration },
        ...s.testHistory.slice(0, 99), // Keep last 100
      ],
    }));
  },
  openClawConfig: createDefaultOpenClawConfig(),
  setOpenClawConfig: (updates) =>
    set((s) => {
      const openClawConfig = { ...s.openClawConfig, ...updates };
      savePreferences({
        openclawBaseUrl: openClawConfig.baseUrl,
        openclawToolEndpoint: openClawConfig.toolEndpoint,
        openclawGatewayToken: openClawConfig.gatewayToken,
        openclawDefaultProfile: openClawConfig.defaultProfile,
        openclawWebProvider: openClawConfig.webProvider,
        openclawLoopDetectionEnabled: openClawConfig.loopDetectionEnabled,
      });
      return { openClawConfig };
    }),
  agentProfiles: DEFAULT_AGENT_PROFILES,
  setAgentProfiles: (profiles) => set({ agentProfiles: profiles }),
  addAgentProfile: () =>
    set((s) => {
      const defaultPreset = presetById('general');
      return {
        agentProfiles: [
          ...s.agentProfiles,
          {
            id: `agent-${Date.now()}`,
            name: `Agent ${s.agentProfiles.length + 1}`,
            role: defaultPreset.role,
            provider: 'ollama',
            model: '',
            systemPrompt: defaultPreset.prompt,
            openclawTools: createDefaultOpenClawToolPolicy(s.openClawConfig.defaultProfile),
            enabled: true,
          },
        ],
      };
    }),
  updateAgentProfile: (id, updates) =>
    set((s) => ({
      agentProfiles: s.agentProfiles.map((profile) =>
        profile.id === id ? { ...profile, ...updates } : profile,
      ),
    })),
  removeAgentProfile: (id) =>
    set((s) => ({
      agentProfiles:
        s.agentProfiles.length > 1
          ? s.agentProfiles.filter((profile) => profile.id !== id)
          : s.agentProfiles,
    })),
  agentRuns: [],
  setAgentRuns: (runs) => set({ agentRuns: runs }),
  upsertAgentRun: (run) =>
    set((s) => {
      const existing = s.agentRuns.find((item) => item.id === run.id);
      if (!existing) {
        return { agentRuns: [run, ...s.agentRuns] };
      }
      return {
        agentRuns: s.agentRuns.map((item) => (item.id === run.id ? run : item)),
      };
    }),
  terminalTranscript: persistedPreferences.terminalTranscript,
  appendTerminalTranscript: (chunk) =>
    set((s) => {
      if (!chunk) {
        return {};
      }
      const terminalTranscript = `${s.terminalTranscript}${chunk}`.slice(-MAX_TERMINAL_TRANSCRIPT_CHARS);
      savePreferences({ terminalTranscript });
      return { terminalTranscript };
    }),
  clearTerminalTranscript: () => {
    savePreferences({ terminalTranscript: '' });
    set({ terminalTranscript: '' });
  },
  lastBuildOrTestCommand: persistedPreferences.lastBuildOrTestCommand,
  recordTerminalCommand: (command) => {
    const normalized = command.trim();
    if (!normalized) {
      return;
    }

    const looksLikeBuildOrTest =
      /(^|[\s;&|])(npm|pnpm|yarn|bun|cargo|forge|vitest|pytest|make|just)\b/i.test(normalized) &&
      /\b(build|test|check|lint|compile)\b/i.test(normalized);

    if (!looksLikeBuildOrTest) {
      return;
    }

    savePreferences({ lastBuildOrTestCommand: normalized });
    set({ lastBuildOrTestCommand: normalized });
  },
  noAddModeEnabled: persistedPreferences.noAddModeEnabled,
  noAddObjective: persistedPreferences.noAddObjective,
  noAddDefinitionOfDone: persistedPreferences.noAddDefinitionOfDone,
  noAddRoleProfile: persistedPreferences.noAddRoleProfile,
  setNoAddModeEnabled: (enabled) => {
    savePreferences({ noAddModeEnabled: enabled });
    set({ noAddModeEnabled: enabled });
  },
  setNoAddObjective: (objective) => {
    savePreferences({ noAddObjective: objective });
    set({ noAddObjective: objective });
  },
  setNoAddDefinitionOfDone: (definition) => {
    savePreferences({ noAddDefinitionOfDone: definition });
    set({ noAddDefinitionOfDone: definition });
  },
  setNoAddRoleProfile: (profile) => {
    const nextProfile = profile || DEFAULT_PREFERENCES.noAddRoleProfile;
    savePreferences({ noAddRoleProfile: nextProfile });
    set({ noAddRoleProfile: nextProfile });
  },
  clearNoAddFocus: () => {
    savePreferences({
      noAddModeEnabled: false,
      noAddObjective: '',
      noAddDefinitionOfDone: '',
    });
    set({
      noAddModeEnabled: false,
      noAddObjective: '',
      noAddDefinitionOfDone: '',
    });
  },

  // Ollama
  ollamaUrl: 'http://localhost:11434',
  ollamaConnected: false,
  setOllamaUrl: (url) => set({ ollamaUrl: url }),
  setOllamaConnected: (v) => set({ ollamaConnected: v }),
}));
