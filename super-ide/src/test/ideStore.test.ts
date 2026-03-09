import { describe, it, expect, beforeEach, vi } from 'vitest';
import { useIDEStore } from '../store/ideStore';
import type { FileTab, ChatMessage, OllamaModel, RagSource, RagResult, KnowledgeEntry, NotebookSession, TaskPlan, ResearchCard, EditorError } from '../store/ideStore';

// Reset store between tests
function resetStore() {
  useIDEStore.setState({
    activeSidebar: 'explorer',
    activeBottomPanel: 'terminal',
    isSidebarOpen: true,
    isBottomPanelOpen: true,
    activeRightSidebar: 'bolt-chat',
    isRightSidebarOpen: true,
    openTabs: [],
    activeTabId: null,
    chatMessages: [],
    chatModel: '',
    availableModels: [],
    isChatStreaming: false,
    ragSources: [],
    ragResults: [],
    isRagLoading: false,
    knowledgeEntries: [],
    notebookSessions: [],
    activeNotebookId: null,
    taskPlans: [],
    researchCards: [],
    skillHistory: [],
    solidityCompilerVersion: '0.8.24',
    compilationOutput: '',
    editorWordWrap: false,
    editorMinimap: false,
    editorCursorLine: 1,
    editorCursorColumn: 1,
    editorErrors: [],
    testOutput: '',
    testHistory: [],
    aiProvider: 'ollama',
    aiModel: '',
    ollamaUrl: 'http://localhost:11434',
    ollamaConnected: false,
    boltMessages: [],
    isBoltStreaming: false,
  });
}

describe('IDEStore', () => {
  beforeEach(() => {
    resetStore();
    vi.clearAllMocks();
  });

  // ── Layout ────────────────────────────────────────────────────
  describe('Layout state', () => {
    it('should have default layout values', () => {
      const state = useIDEStore.getState();
      expect(state.activeSidebar).toBe('explorer');
      expect(state.activeBottomPanel).toBe('terminal');
      expect(state.isSidebarOpen).toBe(true);
      expect(state.isBottomPanelOpen).toBe(true);
    });

    it('setSidebar should set active sidebar and open it', () => {
      useIDEStore.getState().setSidebar('ai-chat');
      const state = useIDEStore.getState();
      expect(state.activeSidebar).toBe('ai-chat');
      expect(state.isSidebarOpen).toBe(true);
    });

    it('setBottomPanel should set active bottom panel and open it', () => {
      useIDEStore.getState().setBottomPanel('output');
      const state = useIDEStore.getState();
      expect(state.activeBottomPanel).toBe('output');
      expect(state.isBottomPanelOpen).toBe(true);
    });

    it('toggleSidebar should toggle sidebar open state', () => {
      expect(useIDEStore.getState().isSidebarOpen).toBe(true);
      useIDEStore.getState().toggleSidebar();
      expect(useIDEStore.getState().isSidebarOpen).toBe(false);
      useIDEStore.getState().toggleSidebar();
      expect(useIDEStore.getState().isSidebarOpen).toBe(true);
    });

    it('toggleBottomPanel should toggle bottom panel open state', () => {
      expect(useIDEStore.getState().isBottomPanelOpen).toBe(true);
      useIDEStore.getState().toggleBottomPanel();
      expect(useIDEStore.getState().isBottomPanelOpen).toBe(false);
      useIDEStore.getState().toggleBottomPanel();
      expect(useIDEStore.getState().isBottomPanelOpen).toBe(true);
    });
  });

  // ── Right Sidebar ────────────────────────────────────────────
  describe('Right Sidebar state', () => {
    it('should have default right sidebar values', () => {
      const state = useIDEStore.getState();
      expect(state.activeRightSidebar).toBe('bolt-chat');
      expect(state.isRightSidebarOpen).toBe(true);
    });

    it('setRightSidebar should set active panel and open it', () => {
      useIDEStore.getState().setRightSidebar('testing');
      const state = useIDEStore.getState();
      expect(state.activeRightSidebar).toBe('testing');
      expect(state.isRightSidebarOpen).toBe(true);
    });

    it('toggleRightSidebar should toggle open state', () => {
      expect(useIDEStore.getState().isRightSidebarOpen).toBe(true);
      useIDEStore.getState().toggleRightSidebar();
      expect(useIDEStore.getState().isRightSidebarOpen).toBe(false);
      useIDEStore.getState().toggleRightSidebar();
      expect(useIDEStore.getState().isRightSidebarOpen).toBe(true);
    });

    it('setRightSidebar opens sidebar if closed', () => {
      useIDEStore.getState().toggleRightSidebar(); // close
      expect(useIDEStore.getState().isRightSidebarOpen).toBe(false);
      useIDEStore.getState().setRightSidebar('coverage');
      expect(useIDEStore.getState().isRightSidebarOpen).toBe(true);
      expect(useIDEStore.getState().activeRightSidebar).toBe('coverage');
    });
  });

  // ── Editor Tabs ──────────────────────────────────────────────
  describe('Editor tabs', () => {
    const sampleTab: FileTab = {
      id: 'test-file',
      name: 'test.ts',
      path: 'test.ts',
      language: 'typescript',
      content: 'const x = 1;',
      isDirty: false,
    };

    it('openTab should add a new tab and set it active', () => {
      useIDEStore.getState().openTab(sampleTab);
      const state = useIDEStore.getState();
      expect(state.openTabs).toHaveLength(1);
      expect(state.openTabs[0].id).toBe('test-file');
      expect(state.activeTabId).toBe('test-file');
    });

    it('openTab should activate existing tab without duplicating', () => {
      useIDEStore.getState().openTab(sampleTab);
      useIDEStore.getState().openTab({ ...sampleTab, id: 'other', name: 'other.ts', path: 'other.ts' });
      useIDEStore.getState().openTab(sampleTab);
      const state = useIDEStore.getState();
      expect(state.openTabs).toHaveLength(2);
      expect(state.activeTabId).toBe('test-file');
    });

    it('openTab should preserve cursorLine from existing tab when not provided in new open', () => {
      useIDEStore.getState().openTab(sampleTab);
      useIDEStore.getState().setTabCursorLine('test-file', 42);
      useIDEStore.getState().openTab({ ...sampleTab }); // re-open same tab without cursorLine
      const tab = useIDEStore.getState().openTabs.find((t) => t.id === 'test-file');
      expect(tab?.cursorLine).toBe(42);
    });

    it('openTab should update cursorLine when provided', () => {
      useIDEStore.getState().openTab(sampleTab);
      useIDEStore.getState().openTab({ ...sampleTab, cursorLine: 10 });
      const tab = useIDEStore.getState().openTabs.find((t) => t.id === 'test-file');
      expect(tab?.cursorLine).toBe(10);
    });

    it('closeTab should remove tab and select the last remaining tab', () => {
      const tab2: FileTab = { ...sampleTab, id: 'file2', name: 'file2.ts', path: 'file2.ts' };
      useIDEStore.getState().openTab(sampleTab);
      useIDEStore.getState().openTab(tab2);
      useIDEStore.getState().closeTab('file2');
      const state = useIDEStore.getState();
      expect(state.openTabs).toHaveLength(1);
      expect(state.activeTabId).toBe('test-file');
    });

    it('closeTab should set activeTabId to null when last tab is closed', () => {
      useIDEStore.getState().openTab(sampleTab);
      useIDEStore.getState().closeTab('test-file');
      expect(useIDEStore.getState().openTabs).toHaveLength(0);
      expect(useIDEStore.getState().activeTabId).toBeNull();
    });

    it('closeTab should not change activeTabId when closing non-active tab', () => {
      const tab2: FileTab = { ...sampleTab, id: 'file2', name: 'file2.ts', path: 'file2.ts' };
      useIDEStore.getState().openTab(sampleTab);
      useIDEStore.getState().openTab(tab2);
      useIDEStore.getState().setActiveTab('test-file');
      useIDEStore.getState().closeTab('file2');
      expect(useIDEStore.getState().activeTabId).toBe('test-file');
    });

    it('setActiveTab should change the active tab', () => {
      useIDEStore.getState().openTab(sampleTab);
      const tab2: FileTab = { ...sampleTab, id: 'file2', name: 'file2.ts', path: 'file2.ts' };
      useIDEStore.getState().openTab(tab2);
      useIDEStore.getState().setActiveTab('test-file');
      expect(useIDEStore.getState().activeTabId).toBe('test-file');
    });

    it('setTabCursorLine should update cursor line on a tab', () => {
      useIDEStore.getState().openTab(sampleTab);
      useIDEStore.getState().setTabCursorLine('test-file', 42);
      const tab = useIDEStore.getState().openTabs.find((t) => t.id === 'test-file');
      expect(tab?.cursorLine).toBe(42);
    });

    it('setTabCursorLine with null should clear cursor line', () => {
      useIDEStore.getState().openTab(sampleTab);
      useIDEStore.getState().setTabCursorLine('test-file', 42);
      useIDEStore.getState().setTabCursorLine('test-file', null);
      const tab = useIDEStore.getState().openTabs.find((t) => t.id === 'test-file');
      expect(tab?.cursorLine).toBeNull();
    });

    it('updateTabContent should update content and mark dirty', () => {
      useIDEStore.getState().openTab(sampleTab);
      useIDEStore.getState().updateTabContent('test-file', 'const y = 2;');
      const tab = useIDEStore.getState().openTabs.find((t) => t.id === 'test-file');
      expect(tab?.content).toBe('const y = 2;');
      expect(tab?.isDirty).toBe(true);
    });

    it('markTabSaved should mark tab as not dirty', () => {
      useIDEStore.getState().openTab(sampleTab);
      useIDEStore.getState().updateTabContent('test-file', 'modified');
      useIDEStore.getState().markTabSaved('test-file');
      const tab = useIDEStore.getState().openTabs.find((t) => t.id === 'test-file');
      expect(tab?.isDirty).toBe(false);
    });
  });

  // ── AI Chat ──────────────────────────────────────────────────
  describe('AI Chat', () => {
    const sampleMessage: ChatMessage = {
      id: 'msg-1',
      role: 'user',
      content: 'Hello',
      timestamp: Date.now(),
    };

    it('addChatMessage should add a message', () => {
      useIDEStore.getState().addChatMessage(sampleMessage);
      expect(useIDEStore.getState().chatMessages).toHaveLength(1);
      expect(useIDEStore.getState().chatMessages[0].content).toBe('Hello');
    });

    it('setChatModel should update chat model', () => {
      useIDEStore.getState().setChatModel('llama3:8b');
      expect(useIDEStore.getState().chatModel).toBe('llama3:8b');
    });

    it('setChatModel should also set aiModel when provider is ollama', () => {
      useIDEStore.getState().setChatModel('llama3:8b');
      expect(useIDEStore.getState().aiModel).toBe('llama3:8b');
    });

    it('setChatModel should not set aiModel when provider is not ollama', () => {
      useIDEStore.getState().setAiProvider('openrouter');
      useIDEStore.getState().setAiModel('gpt-4');
      useIDEStore.getState().setChatModel('llama3:8b');
      expect(useIDEStore.getState().aiModel).toBe('gpt-4');
    });

    it('setAvailableModels should update models list', () => {
      const models: OllamaModel[] = [
        { name: 'llama3:8b', size: '4.7 GB', quantization: 'q4_0', modified: '2024-01-01', capabilities: [] },
      ];
      useIDEStore.getState().setAvailableModels(models);
      expect(useIDEStore.getState().availableModels).toHaveLength(1);
    });

    it('setAvailableModels should select first model if current model not in list', () => {
      const models: OllamaModel[] = [
        { name: 'llama3:8b', size: '4.7 GB', quantization: 'q4_0', modified: '2024-01-01', capabilities: [] },
        { name: 'mistral:7b', size: '4.1 GB', quantization: 'q4_0', modified: '2024-01-01', capabilities: [] },
      ];
      useIDEStore.getState().setAvailableModels(models);
      expect(useIDEStore.getState().chatModel).toBe('llama3:8b');
    });

    it('setAvailableModels should keep current model if it exists in list', () => {
      useIDEStore.getState().setChatModel('mistral:7b');
      const models: OllamaModel[] = [
        { name: 'llama3:8b', size: '4.7 GB', quantization: 'q4_0', modified: '2024-01-01', capabilities: [] },
        { name: 'mistral:7b', size: '4.1 GB', quantization: 'q4_0', modified: '2024-01-01', capabilities: [] },
      ];
      useIDEStore.getState().setAvailableModels(models);
      expect(useIDEStore.getState().chatModel).toBe('mistral:7b');
    });

    it('setAvailableModels with empty list should keep current model', () => {
      useIDEStore.getState().setChatModel('llama3:8b');
      useIDEStore.getState().setAvailableModels([]);
      expect(useIDEStore.getState().chatModel).toBe('llama3:8b');
    });

    it('setChatStreaming should update streaming state', () => {
      useIDEStore.getState().setChatStreaming(true);
      expect(useIDEStore.getState().isChatStreaming).toBe(true);
      useIDEStore.getState().setChatStreaming(false);
      expect(useIDEStore.getState().isChatStreaming).toBe(false);
    });

    it('clearChat should clear all messages', () => {
      useIDEStore.getState().addChatMessage(sampleMessage);
      useIDEStore.getState().clearChat();
      expect(useIDEStore.getState().chatMessages).toHaveLength(0);
    });
  });

  // ── Bolt.diy Chat ──────────────────────────────────────────────
  describe('Bolt Chat', () => {
    const boltMessage: ChatMessage = {
      id: 'bolt-1',
      role: 'user',
      content: 'Debug this code',
      timestamp: Date.now(),
    };

    it('addBoltMessage should add a message', () => {
      useIDEStore.getState().addBoltMessage(boltMessage);
      expect(useIDEStore.getState().boltMessages).toHaveLength(1);
      expect(useIDEStore.getState().boltMessages[0].content).toBe('Debug this code');
    });

    it('setBoltStreaming should update streaming state', () => {
      useIDEStore.getState().setBoltStreaming(true);
      expect(useIDEStore.getState().isBoltStreaming).toBe(true);
    });

    it('clearBoltChat should clear all bolt messages', () => {
      useIDEStore.getState().addBoltMessage(boltMessage);
      useIDEStore.getState().clearBoltChat();
      expect(useIDEStore.getState().boltMessages).toHaveLength(0);
    });
  });

  // ── RAG ──────────────────────────────────────────────────────
  describe('RAG state', () => {
    const sampleSource: RagSource = {
      id: 'src-1',
      url: 'https://example.com',
      title: 'Example',
      chunkCount: 10,
      crawledAt: Date.now(),
      status: 'ready',
    };

    it('setRagSources should set sources', () => {
      useIDEStore.getState().setRagSources([sampleSource]);
      expect(useIDEStore.getState().ragSources).toHaveLength(1);
    });

    it('addRagSource should append a source', () => {
      useIDEStore.getState().addRagSource(sampleSource);
      expect(useIDEStore.getState().ragSources).toHaveLength(1);
    });

    it('setRagResults should set results', () => {
      const result: RagResult = { content: 'test', source: 'example.com' };
      useIDEStore.getState().setRagResults([result]);
      expect(useIDEStore.getState().ragResults).toHaveLength(1);
    });

    it('setRagLoading should update loading state', () => {
      useIDEStore.getState().setRagLoading(true);
      expect(useIDEStore.getState().isRagLoading).toBe(true);
    });
  });

  // ── Knowledge Base ───────────────────────────────────────────
  describe('Knowledge Base', () => {
    const sampleEntry: KnowledgeEntry = {
      id: 'kb-1',
      title: 'Test Pattern',
      content: 'Always use try/catch',
      category: 'pattern',
      tags: ['error-handling'],
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };

    it('setKnowledgeEntries should set entries', () => {
      useIDEStore.getState().setKnowledgeEntries([sampleEntry]);
      expect(useIDEStore.getState().knowledgeEntries).toHaveLength(1);
    });

    it('addKnowledgeEntry should append an entry', () => {
      useIDEStore.getState().addKnowledgeEntry(sampleEntry);
      expect(useIDEStore.getState().knowledgeEntries).toHaveLength(1);
    });

    it('updateKnowledgeEntry should update an entry by id', () => {
      useIDEStore.getState().addKnowledgeEntry(sampleEntry);
      const updated = { ...sampleEntry, title: 'Updated Pattern' };
      useIDEStore.getState().updateKnowledgeEntry('kb-1', updated);
      expect(useIDEStore.getState().knowledgeEntries[0].title).toBe('Updated Pattern');
    });

    it('removeKnowledgeEntry should remove an entry by id', () => {
      useIDEStore.getState().addKnowledgeEntry(sampleEntry);
      useIDEStore.getState().removeKnowledgeEntry('kb-1');
      expect(useIDEStore.getState().knowledgeEntries).toHaveLength(0);
    });
  });

  // ── NotebookLM ──────────────────────────────────────────────
  describe('NotebookLM', () => {
    const sampleSession: NotebookSession = {
      id: 'nb-1',
      title: 'Test Session',
      sourceType: 'url',
      sourceUrl: 'https://example.com',
      createdAt: Date.now(),
    };

    it('setNotebookSessions should set sessions', () => {
      useIDEStore.getState().setNotebookSessions([sampleSession]);
      expect(useIDEStore.getState().notebookSessions).toHaveLength(1);
    });

    it('addNotebookSession should append a session', () => {
      useIDEStore.getState().addNotebookSession(sampleSession);
      expect(useIDEStore.getState().notebookSessions).toHaveLength(1);
    });

    it('updateNotebookSession should update session fields', () => {
      useIDEStore.getState().addNotebookSession(sampleSession);
      useIDEStore.getState().updateNotebookSession('nb-1', { title: 'Updated' });
      expect(useIDEStore.getState().notebookSessions[0].title).toBe('Updated');
    });

    it('removeNotebookSession should remove session', () => {
      useIDEStore.getState().addNotebookSession(sampleSession);
      useIDEStore.getState().removeNotebookSession('nb-1');
      expect(useIDEStore.getState().notebookSessions).toHaveLength(0);
    });

    it('setActiveNotebook should set active notebook id', () => {
      useIDEStore.getState().setActiveNotebook('nb-1');
      expect(useIDEStore.getState().activeNotebookId).toBe('nb-1');
    });

    it('setActiveNotebook with null should clear active notebook', () => {
      useIDEStore.getState().setActiveNotebook('nb-1');
      useIDEStore.getState().setActiveNotebook(null);
      expect(useIDEStore.getState().activeNotebookId).toBeNull();
    });
  });

  // ── Task Planning ────────────────────────────────────────────
  describe('Task Planning', () => {
    const samplePlan: TaskPlan = {
      id: 'plan-1',
      description: 'Refactor auth module',
      status: 'pending',
      steps: [
        { id: 's1', action: 'analyze', description: 'Analyze codebase', status: 'pending' },
        { id: 's2', action: 'modify', description: 'Update auth', status: 'pending' },
      ],
    };

    it('addTaskPlan should add a plan', () => {
      useIDEStore.getState().addTaskPlan(samplePlan);
      expect(useIDEStore.getState().taskPlans).toHaveLength(1);
    });

    it('updateTaskStep should update step status', () => {
      useIDEStore.getState().addTaskPlan(samplePlan);
      useIDEStore.getState().updateTaskStep('plan-1', 's1', 'complete');
      const plan = useIDEStore.getState().taskPlans[0];
      expect(plan.steps[0].status).toBe('complete');
      expect(plan.steps[1].status).toBe('pending');
    });
  });

  // ── Research Dashboard ───────────────────────────────────────
  describe('Research Dashboard', () => {
    const sampleCard: ResearchCard = {
      id: 'rc-1',
      type: 'summary',
      title: 'Test Research',
      content: 'Some research content',
      createdAt: Date.now(),
    };

    it('setResearchCards should set cards', () => {
      useIDEStore.getState().setResearchCards([sampleCard]);
      expect(useIDEStore.getState().researchCards).toHaveLength(1);
    });

    it('addResearchCard should append a card', () => {
      useIDEStore.getState().addResearchCard(sampleCard);
      expect(useIDEStore.getState().researchCards).toHaveLength(1);
    });

    it('removeResearchCard should remove a card by id', () => {
      useIDEStore.getState().addResearchCard(sampleCard);
      useIDEStore.getState().removeResearchCard('rc-1');
      expect(useIDEStore.getState().researchCards).toHaveLength(0);
    });
  });

  // ── Skills History ───────────────────────────────────────────
  describe('Skills History', () => {
    it('setSkillHistory should set history', () => {
      useIDEStore.getState().setSkillHistory([{ id: 's1', data: 'test' }]);
      expect(useIDEStore.getState().skillHistory).toHaveLength(1);
    });

    it('addSkillHistory should append an entry', () => {
      useIDEStore.getState().addSkillHistory({ id: 's1', data: 'test' });
      expect(useIDEStore.getState().skillHistory).toHaveLength(1);
    });

    it('removeSkillHistory should remove an entry', () => {
      useIDEStore.getState().addSkillHistory({ id: 's1', data: 'test' });
      useIDEStore.getState().removeSkillHistory('s1');
      expect(useIDEStore.getState().skillHistory).toHaveLength(0);
    });
  });

  // ── Remix ────────────────────────────────────────────────────
  describe('Remix', () => {
    it('setSolidityCompiler should update compiler version', () => {
      useIDEStore.getState().setSolidityCompiler('0.8.20');
      expect(useIDEStore.getState().solidityCompilerVersion).toBe('0.8.20');
    });

    it('setCompilationOutput should update output', () => {
      useIDEStore.getState().setCompilationOutput('Compiled successfully');
      expect(useIDEStore.getState().compilationOutput).toBe('Compiled successfully');
    });
  });

  // ── Workspace Navigation ────────────────────────────────────
  describe('Workspace Navigation', () => {
    it('setWorkspaceRoot should update the root', () => {
      useIDEStore.getState().setWorkspaceRoot('apps');
      expect(useIDEStore.getState().workspaceRoot).toBe('apps');
    });

    it('setWorkspaceRoot with empty string should default to .', () => {
      useIDEStore.getState().setWorkspaceRoot('');
      expect(useIDEStore.getState().workspaceRoot).toBe('.');
    });

    it('setWorkspaceRoot with whitespace should trim', () => {
      useIDEStore.getState().setWorkspaceRoot('  crates  ');
      expect(useIDEStore.getState().workspaceRoot).toBe('crates');
    });

    it('addWorkspaceFavorite should add a new root', () => {
      const initialCount = useIDEStore.getState().favoriteWorkspaceRoots.length;
      useIDEStore.getState().addWorkspaceFavorite('new-root');
      expect(useIDEStore.getState().favoriteWorkspaceRoots).toHaveLength(initialCount + 1);
    });

    it('addWorkspaceFavorite should not add duplicates', () => {
      useIDEStore.getState().addWorkspaceFavorite('unique-root');
      const count = useIDEStore.getState().favoriteWorkspaceRoots.length;
      useIDEStore.getState().addWorkspaceFavorite('unique-root');
      expect(useIDEStore.getState().favoriteWorkspaceRoots).toHaveLength(count);
    });

    it('removeWorkspaceFavorite should remove a root', () => {
      useIDEStore.getState().addWorkspaceFavorite('temp-root');
      useIDEStore.getState().removeWorkspaceFavorite('temp-root');
      expect(useIDEStore.getState().favoriteWorkspaceRoots).not.toContain('temp-root');
    });

    it('addPinnedFile should add a file', () => {
      useIDEStore.getState().addPinnedFile('src/main.ts');
      expect(useIDEStore.getState().pinnedFiles).toContain('src/main.ts');
    });

    it('addPinnedFile should not add duplicates', () => {
      useIDEStore.getState().addPinnedFile('src/main.ts');
      const count = useIDEStore.getState().pinnedFiles.length;
      useIDEStore.getState().addPinnedFile('src/main.ts');
      expect(useIDEStore.getState().pinnedFiles).toHaveLength(count);
    });

    it('addPinnedFile should not add empty string', () => {
      const count = useIDEStore.getState().pinnedFiles.length;
      useIDEStore.getState().addPinnedFile('');
      expect(useIDEStore.getState().pinnedFiles).toHaveLength(count);
    });

    it('removePinnedFile should remove a file', () => {
      useIDEStore.getState().addPinnedFile('temp-file.ts');
      useIDEStore.getState().removePinnedFile('temp-file.ts');
      expect(useIDEStore.getState().pinnedFiles).not.toContain('temp-file.ts');
    });
  });

  // ── Editor Preferences ──────────────────────────────────────
  describe('Editor Preferences', () => {
    it('setEditorWordWrap should update word wrap', () => {
      useIDEStore.getState().setEditorWordWrap(true);
      expect(useIDEStore.getState().editorWordWrap).toBe(true);
    });

    it('setEditorMinimap should update minimap', () => {
      useIDEStore.getState().setEditorMinimap(true);
      expect(useIDEStore.getState().editorMinimap).toBe(true);
    });

    it('setEditorCursorPosition should update cursor position', () => {
      useIDEStore.getState().setEditorCursorPosition(10, 5);
      expect(useIDEStore.getState().editorCursorLine).toBe(10);
      expect(useIDEStore.getState().editorCursorColumn).toBe(5);
    });

    it('setEditorCursorPosition should clamp to minimum 1', () => {
      useIDEStore.getState().setEditorCursorPosition(0, -5);
      expect(useIDEStore.getState().editorCursorLine).toBe(1);
      expect(useIDEStore.getState().editorCursorColumn).toBe(1);
    });
  });

  // ── Editor Errors ───────────────────────────────────────────
  describe('Editor Errors', () => {
    const sampleError: EditorError = {
      filePath: 'test.sol',
      line: 10,
      column: 5,
      severity: 'error',
      message: 'Syntax error',
      source: 'lint',
    };

    it('setEditorErrors should set errors', () => {
      useIDEStore.getState().setEditorErrors([sampleError]);
      expect(useIDEStore.getState().editorErrors).toHaveLength(1);
    });

    it('clearEditorErrors without source should clear all errors', () => {
      useIDEStore.getState().setEditorErrors([sampleError]);
      useIDEStore.getState().clearEditorErrors();
      expect(useIDEStore.getState().editorErrors).toHaveLength(0);
    });

    it('clearEditorErrors with source should only clear matching errors', () => {
      const testError: EditorError = { ...sampleError, source: 'test' };
      useIDEStore.getState().setEditorErrors([sampleError, testError]);
      useIDEStore.getState().clearEditorErrors('lint');
      expect(useIDEStore.getState().editorErrors).toHaveLength(1);
      expect(useIDEStore.getState().editorErrors[0].source).toBe('test');
    });
  });

  // ── Test Execution Results ──────────────────────────────────
  describe('Test Execution Results', () => {
    it('setTestOutput should set output', () => {
      useIDEStore.getState().setTestOutput('All tests passed');
      expect(useIDEStore.getState().testOutput).toBe('All tests passed');
    });

    it('addTestToHistory should add an entry', () => {
      useIDEStore.getState().addTestToHistory(5, 1, 1234);
      const history = useIDEStore.getState().testHistory;
      expect(history).toHaveLength(1);
      expect(history[0].passed).toBe(5);
      expect(history[0].failed).toBe(1);
      expect(history[0].duration).toBe(1234);
    });

    it('addTestToHistory should keep max 100 entries', () => {
      for (let i = 0; i < 105; i++) {
        useIDEStore.getState().addTestToHistory(i, 0, 100);
      }
      expect(useIDEStore.getState().testHistory.length).toBeLessThanOrEqual(100);
    });
  });

  // ── AI Routing ──────────────────────────────────────────────
  describe('AI Routing', () => {
    it('setAiProvider should update provider', () => {
      useIDEStore.getState().setAiProvider('openrouter');
      expect(useIDEStore.getState().aiProvider).toBe('openrouter');
    });

    it('setAiProvider to ollama should sync aiModel to chatModel', () => {
      useIDEStore.getState().setChatModel('llama3:8b');
      useIDEStore.getState().setAiProvider('ollama');
      expect(useIDEStore.getState().aiModel).toBe('llama3:8b');
    });

    it('setAiModel should update model', () => {
      useIDEStore.getState().setAiModel('gpt-4');
      expect(useIDEStore.getState().aiModel).toBe('gpt-4');
    });
  });

  // ── Ollama Connection ───────────────────────────────────────
  describe('Ollama Connection', () => {
    it('setOllamaUrl should update URL', () => {
      useIDEStore.getState().setOllamaUrl('http://custom:11434');
      expect(useIDEStore.getState().ollamaUrl).toBe('http://custom:11434');
    });

    it('setOllamaConnected should update connection state', () => {
      useIDEStore.getState().setOllamaConnected(true);
      expect(useIDEStore.getState().ollamaConnected).toBe(true);
    });
  });
});
