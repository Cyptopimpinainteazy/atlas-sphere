import { create } from 'zustand';

const STORAGE_KEY = 'atlas-superide:preferences';

interface IDEPreferences {
  workspaceRoot: string;
  favoriteWorkspaceRoots: string[];
  pinnedFiles: string[];
  editorWordWrap: boolean;
  editorMinimap: boolean;
}

const DEFAULT_PREFERENCES: IDEPreferences = {
  workspaceRoot: '.',
  favoriteWorkspaceRoots: ['.', 'apps', 'crates', 'runtime', 'pallets'],
  pinnedFiles: [],
  editorWordWrap: false,
  editorMinimap: false,
};

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
  | 'notebook'
  | 'rag'
  | 'knowledge'
  | 'research'
  | 'skills'
  | 'settings';

export type BottomPanel = 'terminal' | 'output' | 'problems' | 'rag-results' | 'tests';

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

  // Ollama
  ollamaUrl: 'http://localhost:11434',
  ollamaConnected: false,
  setOllamaUrl: (url) => set({ ollamaUrl: url }),
  setOllamaConnected: (v) => set({ ollamaConnected: v }),
}));
