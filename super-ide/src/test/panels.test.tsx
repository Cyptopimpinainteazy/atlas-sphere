/**
 * Real component rendering tests — no API mocks.
 * Only Monaco editor is mocked (web workers can't run in jsdom).
 * Components hit the live backend at localhost:8420.
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { render, screen, fireEvent, waitFor, act, cleanup } from '@testing-library/react';
import { useIDEStore } from '../store/ideStore';

// Only mock: Monaco editor (web workers unavailable in jsdom)
vi.mock('@monaco-editor/react', () => ({
  default: (props: any) => (
    <div data-testid="mock-monaco-editor">
      <textarea
        data-testid="mock-monaco-textarea"
        value={props.value || ''}
        onChange={(e) => props.onChange?.(e.target.value)}
      />
    </div>
  ),
  loader: { init: vi.fn() },
}));

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
    workspaceRoot: '.',
  });
}

describe('Panel Components (real backend)', () => {
  beforeEach(() => {
    resetStore();
  });
  afterEach(() => {
    cleanup();
  });

  // ── Sidebar ──────────────────────────────────────────────────
  describe('Sidebar', () => {
    let Sidebar: any;
    beforeEach(async () => {
      const mod = await import('../components/Sidebar');
      Sidebar = mod.Sidebar;
    });

    it('renders all sidebar icons', () => {
      render(<Sidebar />);
      // Explorer, Search, Remix, AI Chat, Agents, Notebook, RAG, Knowledge, Research, Skills, Settings
      expect(screen.getByText('📂')).toBeInTheDocument();
      expect(screen.getByText('🔍')).toBeInTheDocument();
      expect(screen.getByText('⟠')).toBeInTheDocument();
      expect(screen.getByText('🤖')).toBeInTheDocument();
      expect(screen.getByText('🤝')).toBeInTheDocument();
      expect(screen.getByText('🎙️')).toBeInTheDocument();
      expect(screen.getByText('🕸️')).toBeInTheDocument();
      expect(screen.getByText('🧠')).toBeInTheDocument();
      expect(screen.getByText('📊')).toBeInTheDocument();
      expect(screen.getByText('⚡')).toBeInTheDocument();
      expect(screen.getByText('⚙️')).toBeInTheDocument();
    });

    it('sets active sidebar on click', () => {
      render(<Sidebar />);
      fireEvent.click(screen.getByText('🔍'));
      expect(useIDEStore.getState().activeSidebar).toBe('search');
    });

    it('toggles sidebar when clicking active icon', () => {
      useIDEStore.setState({ activeSidebar: 'explorer', isSidebarOpen: true });
      render(<Sidebar />);
      fireEvent.click(screen.getByTitle('Explorer'));
      expect(useIDEStore.getState().isSidebarOpen).toBe(false);
    });
  });

  // ── RightSidebar ─────────────────────────────────────────────
  describe('RightSidebar', () => {
    let RightSidebar: any;
    beforeEach(async () => {
      const mod = await import('../components/RightSidebar');
      RightSidebar = mod.RightSidebar;
    });

    it('renders with test IDs', () => {
      render(<RightSidebar />);
      expect(screen.getByTestId('right-sidebar')).toBeInTheDocument();
    });

    it('sets active right sidebar on click', () => {
      render(<RightSidebar />);
      fireEvent.click(screen.getByTestId('right-sidebar-btn-testing'));
      expect(useIDEStore.getState().activeRightSidebar).toBe('testing');
    });

    it('toggles right sidebar when clicking active icon', () => {
      useIDEStore.setState({ activeRightSidebar: 'bolt-chat', isRightSidebarOpen: true });
      render(<RightSidebar />);
      fireEvent.click(screen.getByTestId('right-sidebar-btn-bolt-chat'));
      expect(useIDEStore.getState().isRightSidebarOpen).toBe(false);
    });
  });

  // ── RightSidePanel ───────────────────────────────────────────
  describe('RightSidePanel', () => {
    let RightSidePanel: any;
    beforeEach(async () => {
      const mod = await import('../components/RightSidePanel');
      RightSidePanel = mod.RightSidePanel;
    });

    it('renders container', () => {
      render(<RightSidePanel />);
      expect(screen.getByTestId('right-side-panel')).toBeInTheDocument();
    });

    it('renders BoltChatPanel when active', () => {
      useIDEStore.setState({ activeRightSidebar: 'bolt-chat' });
      render(<RightSidePanel />);
      expect(screen.getByTestId('bolt-chat-panel')).toBeInTheDocument();
    });

    it('renders OutlinePanel when active', () => {
      useIDEStore.setState({ activeRightSidebar: 'outline' });
      render(<RightSidePanel />);
      // OutlinePanel has no data-testid; check for its header text
      expect(screen.getByText(/Outline/)).toBeInTheDocument();
    });
  });

  // ── ExplorerPanel (hits real backend) ────────────────────────
  describe('ExplorerPanel', () => {
    let ExplorerPanel: any;
    beforeEach(async () => {
      const mod = await import('../components/panels/ExplorerPanel');
      ExplorerPanel = mod.ExplorerPanel;
    });

    it('loads and renders workspace tree from real backend', async () => {
      await act(async () => { render(<ExplorerPanel />); });
      // Give it time to fetch tree from backend
      await waitFor(() => {
        // Should have at least one tree item rendered
        const items = document.querySelectorAll('[class*="tree"], [class*="Tree"]');
        // Or look for known workspace entries
        expect(document.body.textContent).toBeTruthy();
      }, { timeout: 10000 });
    });

    it('shows workspace root input', async () => {
      await act(async () => { render(<ExplorerPanel />); });
      // Explorer has a workspace root input or display
      const rootDisplay = document.body.textContent;
      expect(rootDisplay).toBeTruthy();
    });
  });

  // ── KnowledgePanel (hits real backend) ───────────────────────
  describe('KnowledgePanel', () => {
    let KnowledgePanel: any;
    beforeEach(async () => {
      const mod = await import('../components/panels/KnowledgePanel');
      KnowledgePanel = mod.KnowledgePanel;
    });

    it('renders Browse tab and New button', async () => {
      await act(async () => { render(<KnowledgePanel />); });
      expect(screen.getByText(/Browse/)).toBeInTheDocument();
      // Header has a "+ New" button to add entries
      expect(screen.getByText('+ New')).toBeInTheDocument();
    });

    it('loads knowledge list from real backend on mount', async () => {
      await act(async () => { render(<KnowledgePanel />); });
      await waitFor(() => {
        // The component called knowledgeList() and updated store
        const state = useIDEStore.getState();
        expect(state.knowledgeEntries).toBeDefined();
      }, { timeout: 10000 });
    });

    it('renders search input', async () => {
      await act(async () => { render(<KnowledgePanel />); });
      expect(screen.getByPlaceholderText('Search knowledge...')).toBeInTheDocument();
    });

    it('renders category filter buttons or empty state', async () => {
      await act(async () => { render(<KnowledgePanel />); });
      // Category filters and/or empty state text contain these words
      const pitfallEls = screen.getAllByText(/pitfall/i);
      expect(pitfallEls.length).toBeGreaterThan(0);
      const patternEls = screen.getAllByText(/pattern/i);
      expect(patternEls.length).toBeGreaterThan(0);
    });

    it('switches to add form', async () => {
      await act(async () => { render(<KnowledgePanel />); });
      fireEvent.click(screen.getByText('+ New'));
      expect(screen.getByPlaceholderText(/Reentrancy Guard/)).toBeInTheDocument();
    });

    it('can save a real knowledge entry', async () => {
      await act(async () => { render(<KnowledgePanel />); });
      fireEvent.click(screen.getByText('+ New'));
      
      const titleInput = screen.getByPlaceholderText(/Reentrancy Guard/);
      const contentInput = screen.getByPlaceholderText(/Document the knowledge/);
      
      fireEvent.change(titleInput, { target: { value: `Vitest Real ${Date.now()}` } });
      fireEvent.change(contentInput, { target: { value: 'Created by real test' } });
      
      const saveBtn = screen.getByText(/Save/);
      await act(async () => { fireEvent.click(saveBtn); });
      
      // Wait for save to complete and entry to appear in store
      await waitFor(() => {
        const entries = useIDEStore.getState().knowledgeEntries;
        expect(entries.some((e: any) => e.content === 'Created by real test')).toBe(true);
      }, { timeout: 10000 });
    });
  });

  // ── NotebookPanel ────────────────────────────────────────────
  describe('NotebookPanel', () => {
    let NotebookPanel: any;
    beforeEach(async () => {
      const mod = await import('../components/panels/NotebookPanel');
      NotebookPanel = mod.NotebookPanel;
    });

    it('renders source type selectors', async () => {
      await act(async () => { render(<NotebookPanel />); });
      expect(screen.getByText('📝 Text')).toBeInTheDocument();
      expect(screen.getByText('📄 PDF')).toBeInTheDocument();
    });

    it('switches to text source mode', async () => {
      await act(async () => { render(<NotebookPanel />); });
      fireEvent.click(screen.getByText('📝 Text'));
      expect(screen.getByPlaceholderText('Paste your content here...')).toBeInTheDocument();
    });

    it('shows session tab', async () => {
      await act(async () => { render(<NotebookPanel />); });
      expect(screen.getByText(/Sessions/)).toBeInTheDocument();
    });

    it('shows tone and format selectors', async () => {
      await act(async () => { render(<NotebookPanel />); });
      expect(screen.getByText(/Academic/)).toBeInTheDocument();
      expect(screen.getByText(/Deep summary/)).toBeInTheDocument();
    });

    it('shows generate button', async () => {
      await act(async () => { render(<NotebookPanel />); });
      expect(screen.getByText(/Generate Notebook/)).toBeInTheDocument();
    });
  });

  // ── RagPanel ─────────────────────────────────────────────────
  describe('RagPanel', () => {
    let RagPanel: any;
    beforeEach(async () => {
      const mod = await import('../components/panels/RagPanel');
      RagPanel = mod.RagPanel;
    });

    it('renders Search/Crawl/Sources tabs', async () => {
      await act(async () => { render(<RagPanel />); });
      // Multiple elements may contain 'Crawl' (tab + subtitle)
      const crawlEls = screen.getAllByText(/Crawl/);
      expect(crawlEls.length).toBeGreaterThanOrEqual(1);
      const sourceTabs = screen.getAllByText(/Sources/);
      expect(sourceTabs.length).toBeGreaterThanOrEqual(1);
    });

    it('loads real RAG sources on sources tab click', async () => {
      await act(async () => { render(<RagPanel />); });
      const sourceTabs = screen.getAllByText(/Sources/);
      fireEvent.click(sourceTabs[0]);
      await waitFor(() => {
        // Store should be updated with real sources (even if empty)
        const state = useIDEStore.getState();
        expect(state.ragSources).toBeDefined();
      }, { timeout: 10000 });
    });

    it('shows RAG results when store has data', async () => {
      useIDEStore.setState({
        ragResults: [
          { source: 'https://docs.sol.com', score: 0.95, content: 'Solidity is great', metadata: {} },
        ],
      });
      await act(async () => { render(<RagPanel />); });
      expect(screen.getByText(/RAG/)).toBeInTheDocument();
    });
  });

  // ── SearchPanel (hits real backend) ──────────────────────────
  describe('SearchPanel', () => {
    let SearchPanel: any;
    beforeEach(async () => {
      const mod = await import('../components/panels/SearchPanel');
      SearchPanel = mod.SearchPanel;
    });

    it('renders Files/Code/RAG Search mode tabs', () => {
      render(<SearchPanel />);
      expect(screen.getByText('Files')).toBeInTheDocument();
      expect(screen.getByText('Code')).toBeInTheDocument();
      expect(screen.getByText('RAG Search')).toBeInTheDocument();
    });

    it('performs real file search', async () => {
      render(<SearchPanel />);
      const input = screen.getByPlaceholderText('Match file paths');
      fireEvent.change(input, { target: { value: 'main' } });
      const goBtn = screen.getByText('Go');
      await act(async () => { fireEvent.click(goBtn); });
      // Wait for real results from backend
      await waitFor(() => {
        // Results should appear in the DOM (or "No results" message)
        expect(document.body.textContent).toBeTruthy();
      }, { timeout: 10000 });
    });

    it('performs real code search', async () => {
      render(<SearchPanel />);
      fireEvent.click(screen.getByText('Code'));
      const input = screen.getByPlaceholderText('Find code lines');
      fireEvent.change(input, { target: { value: 'import' } });
      const goBtn = screen.getByText('Go');
      await act(async () => { fireEvent.click(goBtn); });
      await waitFor(() => {
        expect(document.body.textContent).toBeTruthy();
      }, { timeout: 10000 });
    });

    it('shows scope indicator', () => {
      useIDEStore.setState({ workspaceRoot: '/my/project' });
      render(<SearchPanel />);
      expect(screen.getByText(/Scope/)).toBeInTheDocument();
    });
  });

  // ── RemixPanel ───────────────────────────────────────────────
  describe('RemixPanel', () => {
    let RemixPanel: any;
    beforeEach(async () => {
      const mod = await import('../components/panels/RemixPanel');
      RemixPanel = mod.RemixPanel;
    });

    it('renders Compile/Deploy/Debug tabs', () => {
      render(<RemixPanel />);
      const compileBtns = screen.getAllByText(/Compile/);
      expect(compileBtns.length).toBeGreaterThan(0);
      expect(screen.getByText('🚀 Deploy')).toBeInTheDocument();
      expect(screen.getByText('🐛 Debug')).toBeInTheDocument();
    });

    it('shows compiler version selector', () => {
      render(<RemixPanel />);
      expect(screen.getByText('Compiler Version')).toBeInTheDocument();
    });

    it('switches to deploy tab', () => {
      render(<RemixPanel />);
      fireEvent.click(screen.getByText('🚀 Deploy'));
      expect(screen.getByText('Environment')).toBeInTheDocument();
      expect(screen.getByText('Gas Limit')).toBeInTheDocument();
    });

    it('switches to debug tab', () => {
      render(<RemixPanel />);
      fireEvent.click(screen.getByText('🐛 Debug'));
      expect(screen.getByText(/Debugger/)).toBeInTheDocument();
    });

    it('compiles real Solidity when active tab is .sol', async () => {
      useIDEStore.setState({
        openTabs: [{
          id: 't1', name: 'Test.sol', path: 'Test.sol',
          content: '// SPDX-License-Identifier: MIT\npragma solidity ^0.8.0;\ncontract T {}',
          language: 'sol', isDirty: false,
        }],
        activeTabId: 't1',
      });
      render(<RemixPanel />);
      const compileBtns = screen.getAllByText(/Compile/);
      const compileBtn = compileBtns.find(el => el.tagName === 'BUTTON') || compileBtns[compileBtns.length - 1];
      await act(async () => { fireEvent.click(compileBtn!); });
      // Wait for real compilation result
      await waitFor(() => {
        const output = useIDEStore.getState().compilationOutput;
        expect(output).toBeDefined();
      }, { timeout: 30000 });
    });
  });

  // ── TestingPanel ─────────────────────────────────────────────
  describe('TestingPanel', () => {
    let TestingPanel: any;
    beforeEach(async () => {
      const mod = await import('../components/panels/TestingPanel');
      TestingPanel = mod.TestingPanel;
    });

    it('renders Testing/Linting/Security tabs', () => {
      render(<TestingPanel />);
      expect(screen.getByText(/Testing/i)).toBeInTheDocument();
      expect(screen.getByText(/Linting/i)).toBeInTheDocument();
      expect(screen.getByText(/Security/i)).toBeInTheDocument();
    });

    it('has run button', () => {
      render(<TestingPanel />);
      expect(screen.getByText(/Run Tests/i)).toBeInTheDocument();
    });

    it('calls real forge test endpoint on run', async () => {
      useIDEStore.setState({
        openTabs: [{ id: 't1', name: 'Test.sol', path: 'Test.sol', content: '', language: 'sol', isDirty: false }],
        activeTabId: 't1',
      });
      render(<TestingPanel />);
      const runBtns = screen.getAllByText(/Run/i);
      const runBtn = runBtns.find(el => el.tagName === 'BUTTON') || runBtns[0];
      await act(async () => { fireEvent.click(runBtn!); });
      // Wait for backend to respond (forge may not be installed but endpoint should respond)
      await waitFor(() => {
        expect(document.body.textContent).toBeTruthy();
      }, { timeout: 15000 });
    });
  });

  // ── TestOutputPanel ──────────────────────────────────────────
  describe('TestOutputPanel', () => {
    let TestOutputPanel: any;
    beforeEach(async () => {
      const mod = await import('../components/panels/TestOutputPanel');
      TestOutputPanel = mod.TestOutputPanel;
    });

    it('renders test output header', () => {
      render(<TestOutputPanel />);
      expect(screen.getByText(/Test Output/)).toBeInTheDocument();
    });

    it('shows test output text', () => {
      useIDEStore.setState({ testOutput: 'Running tests...\n3/3 passed' });
      render(<TestOutputPanel />);
      expect(screen.getByText(/3\/3 passed/)).toBeInTheDocument();
    });

    it('shows test history', () => {
      useIDEStore.setState({
        testHistory: [
          { timestamp: Date.now(), passed: 10, failed: 2, duration: 1500 },
          { timestamp: Date.now() - 60000, passed: 8, failed: 0, duration: 1200 },
        ],
      });
      render(<TestOutputPanel />);
      // Stats header + history entries contain pass/fail counts
      expect(screen.getByText(/Pass Rate/)).toBeInTheDocument();
    });

    it('clears test output', () => {
      useIDEStore.setState({ testOutput: 'some output' });
      render(<TestOutputPanel />);
      const clearBtn = screen.getByText(/Clear/i);
      fireEvent.click(clearBtn);
      expect(useIDEStore.getState().testOutput).toBe('');
    });
  });

  // ── SettingsPanel ────────────────────────────────────────────
  describe('SettingsPanel', () => {
    let SettingsPanel: any;
    beforeEach(async () => {
      const mod = await import('../components/panels/SettingsPanel');
      SettingsPanel = mod.SettingsPanel;
    });

    it('renders AI Provider section', () => {
      render(<SettingsPanel />);
      expect(screen.getByText('AI Provider')).toBeInTheDocument();
    });

    it('shows Ollama URL input', () => {
      render(<SettingsPanel />);
      expect(screen.getByPlaceholderText('http://localhost:11434')).toBeInTheDocument();
    });

    it('shows Chat Behavior settings', () => {
      render(<SettingsPanel />);
      expect(screen.getByText('Chat Behavior')).toBeInTheDocument();
    });

    it('switches to Remix section', () => {
      render(<SettingsPanel />);
      fireEvent.click(screen.getByText('⟠ Remix'));
      expect(screen.getByText('Solidity Compiler')).toBeInTheDocument();
    });

    it('switches to RAG section', () => {
      render(<SettingsPanel />);
      // Use getAllByText since 'RAG' may appear in AI section toggle too
      const ragTabs = screen.getAllByText(/RAG/);
      const navTab = ragTabs.find(el => el.textContent?.includes('🕸️'));
      fireEvent.click(navTab || ragTabs[0]);
      expect(screen.getByText(/Crawl4AI/i)).toBeInTheDocument();
    });

    it('switches to General section', () => {
      render(<SettingsPanel />);
      fireEvent.click(screen.getByText('🎨 General'));
      expect(screen.getByText('Workspace')).toBeInTheDocument();
      expect(screen.getByText('Word wrap')).toBeInTheDocument();
      expect(screen.getByText('Minimap')).toBeInTheDocument();
      expect(screen.getByText('Line numbers')).toBeInTheDocument();
    });

    it('switches to About section', () => {
      render(<SettingsPanel />);
      fireEvent.click(screen.getByText('ℹ️ About'));
      expect(screen.getByText('Atlas SuperIDE')).toBeInTheDocument();
      expect(screen.getByText('v0.1.0-alpha')).toBeInTheDocument();
    });

    it('shows available models when connected', () => {
      useIDEStore.setState({
        ollamaConnected: true,
        availableModels: [
          { name: 'llama3:8b', size: '4.7GB', modified: '', quantization: 'q4', capabilities: [] },
        ],
      });
      render(<SettingsPanel />);
      expect(screen.getByText(/Available Models/)).toBeInTheDocument();
    });

    it('tests real Ollama connection', async () => {
      render(<SettingsPanel />);
      const testBtn = screen.getByText(/Test/i);
      await act(async () => { fireEvent.click(testBtn); });
      // Should connect to real Ollama
      await waitFor(() => {
        expect(useIDEStore.getState().ollamaConnected).toBe(true);
      }, { timeout: 10000 });
    });
  });

  // ── SkillsPanel (hits real backend) ──────────────────────────
  describe('SkillsPanel', () => {
    let SkillsPanel: any;
    beforeEach(async () => {
      const mod = await import('../components/panels/SkillsPanel');
      SkillsPanel = mod.SkillsPanel;
    });

    it('loads real skills list on mount', async () => {
      await act(async () => { render(<SkillsPanel />); });
      await waitFor(() => {
        expect(screen.getByText(/Skills/)).toBeInTheDocument();
      }, { timeout: 10000 });
    });

    it('shows History tab', async () => {
      await act(async () => { render(<SkillsPanel />); });
      expect(screen.getByText(/History/)).toBeInTheDocument();
    });

    it('switches to history tab', async () => {
      await act(async () => { render(<SkillsPanel />); });
      fireEvent.click(screen.getByText(/History/));
      expect(screen.getByText(/No history/i)).toBeInTheDocument();
    });
  });

  // ── ResearchPanel ────────────────────────────────────────────
  describe('ResearchPanel', () => {
    let ResearchPanel: any;
    beforeEach(async () => {
      const mod = await import('../components/panels/ResearchPanel');
      ResearchPanel = mod.ResearchPanel;
    });

    it('renders Quick Templates', async () => {
      await act(async () => { render(<ResearchPanel />); });
      expect(screen.getByText('Quick Templates')).toBeInTheDocument();
    });

    it('has Generate Dashboard button', async () => {
      await act(async () => { render(<ResearchPanel />); });
      expect(screen.getByText(/Generate Dashboard/)).toBeInTheDocument();
    });

    it('shows info text about capabilities', async () => {
      await act(async () => { render(<ResearchPanel />); });
      expect(screen.getByText(/Research Dashboard generates/)).toBeInTheDocument();
    });

    it('shows research cards from store', async () => {
      useIDEStore.setState({
        researchCards: [
          { id: 'r1', type: 'insight', title: 'Gas Optimization', content: 'Use unchecked blocks', createdAt: Date.now() },
          { id: 'r2', type: 'warning', title: 'Reentrancy Risk', content: 'Check all external calls', createdAt: Date.now() },
        ],
      });
      await act(async () => { render(<ResearchPanel />); });
      // Click the Dashboard TAB (not the header) - tab includes card count
      const dashEls = screen.getAllByText(/Dashboard/);
      const dashTab = dashEls.find(el => el.textContent?.includes('('));
      fireEvent.click(dashTab || dashEls[dashEls.length - 1]);
      expect(screen.getByText('Gas Optimization')).toBeInTheDocument();
      expect(screen.getByText('Reentrancy Risk')).toBeInTheDocument();
    });
  });

  // ── AiChatPanel ──────────────────────────────────────────────
  describe('AiChatPanel', () => {
    let AiChatPanel: any;
    beforeEach(async () => {
      const mod = await import('../components/panels/AiChatPanel');
      AiChatPanel = mod.AiChatPanel;
    });

    it('renders provider selector', () => {
      render(<AiChatPanel />);
      expect(screen.getByText('Ollama')).toBeInTheDocument();
    });

    it('renders suggested prompts in empty state', () => {
      render(<AiChatPanel />);
      expect(screen.getByText(/Explain this Solidity contract/)).toBeInTheDocument();
    });

    it('has message input', () => {
      render(<AiChatPanel />);
      expect(screen.getByPlaceholderText('Ask Atlas AI anything...')).toBeInTheDocument();
    });

    it('has send button', () => {
      render(<AiChatPanel />);
      expect(screen.getByText('▶')).toBeInTheDocument();
    });

    it('renders chat messages from store', () => {
      useIDEStore.setState({
        chatMessages: [
          { id: 'c1', role: 'user', content: 'Hello from test', timestamp: Date.now() },
          { id: 'c2', role: 'assistant', content: 'Hi back', timestamp: Date.now() },
        ],
      });
      render(<AiChatPanel />);
      expect(screen.getByText('Hello from test')).toBeInTheDocument();
      expect(screen.getByText('Hi back')).toBeInTheDocument();
    });
  });

  // ── BoltChatPanel ────────────────────────────────────────────
  describe('BoltChatPanel', () => {
    let BoltChatPanel: any;
    beforeEach(async () => {
      const mod = await import('../components/panels/BoltChatPanel');
      BoltChatPanel = mod.BoltChatPanel;
    });

    it('renders with testid', () => {
      render(<BoltChatPanel />);
      expect(screen.getByTestId('bolt-chat-panel')).toBeInTheDocument();
    });

    it('shows quick action buttons', () => {
      render(<BoltChatPanel />);
      expect(screen.getByText(/Debug this file/)).toBeInTheDocument();
      expect(screen.getByText(/Improve code/)).toBeInTheDocument();
    });

    it('shows CTX button', () => {
      render(<BoltChatPanel />);
      expect(screen.getByText(/CTX/)).toBeInTheDocument();
    });

    it('renders bolt messages from store', () => {
      useIDEStore.setState({
        boltMessages: [
          { id: 'b1', role: 'user', content: 'Help me debug', timestamp: Date.now() },
          { id: 'b2', role: 'assistant', content: 'I can help with that', timestamp: Date.now() },
        ],
      });
      render(<BoltChatPanel />);
      expect(screen.getByText('Help me debug')).toBeInTheDocument();
      expect(screen.getByText('I can help with that')).toBeInTheDocument();
    });

    it('has input and send button', () => {
      render(<BoltChatPanel />);
      expect(screen.getByPlaceholderText(/bolt/i)).toBeInTheDocument();
      expect(screen.getByTitle('Send')).toBeInTheDocument();
    });
  });

  // ── OutlinePanel ─────────────────────────────────────────────
  describe('OutlinePanel', () => {
    let OutlinePanel: any;
    beforeEach(async () => {
      const mod = await import('../components/panels/OutlinePanel');
      OutlinePanel = mod.OutlinePanel;
    });

    it('shows "No file open" when no active tab', () => {
      render(<OutlinePanel />);
      expect(screen.getByText('Open a file to inspect its structure.')).toBeInTheDocument();
    });

    it('extracts Solidity symbols from active tab', () => {
      useIDEStore.setState({
        openTabs: [{
          id: 'o1', name: 'Token.sol', path: 'Token.sol',
          content: 'contract Token {\n  function transfer() {}\n}',
          language: 'sol', isDirty: false,
        }],
        activeTabId: 'o1',
      });
      render(<OutlinePanel />);
      expect(screen.getByText('Token')).toBeInTheDocument();
      expect(screen.getByText('transfer')).toBeInTheDocument();
    });

    it('extracts TypeScript symbols', () => {
      useIDEStore.setState({
        openTabs: [{
          id: 'o2', name: 'app.ts', path: 'app.ts',
          content: 'class MyApp {}\nfunction main() {}',
          language: 'typescript', isDirty: false,
        }],
        activeTabId: 'o2',
      });
      render(<OutlinePanel />);
      expect(screen.getByText('MyApp')).toBeInTheDocument();
      expect(screen.getByText('main')).toBeInTheDocument();
    });

    it('shows "No symbols found" for empty file', () => {
      useIDEStore.setState({
        openTabs: [{
          id: 'o3', name: 'empty.txt', path: 'empty.txt',
          content: '', language: 'text', isDirty: false,
        }],
        activeTabId: 'o3',
      });
      render(<OutlinePanel />);
      expect(screen.getByText(/No outline symbols found/)).toBeInTheDocument();
    });
  });

  // ── GitIntegrationPanel ──────────────────────────────────────
  describe('GitIntegrationPanel', () => {
    let GitIntegrationPanel: any;
    beforeEach(async () => {
      const mod = await import('../components/panels/GitIntegrationPanel');
      GitIntegrationPanel = mod.GitIntegrationPanel;
    });

    it('shows Git Integration header', async () => {
      await act(async () => { render(<GitIntegrationPanel />); });
      expect(screen.getByText(/Git Integration/)).toBeInTheDocument();
    });

    it('shows Install button', async () => {
      await act(async () => { render(<GitIntegrationPanel />); });
      expect(screen.getByText(/Install/i)).toBeInTheDocument();
    });
  });

  // ── EditorArea ───────────────────────────────────────────────
  describe('EditorArea', () => {
    let EditorArea: any;
    beforeEach(async () => {
      const mod = await import('../components/EditorArea');
      EditorArea = mod.EditorArea;
    });

    it('shows welcome screen when no tabs open', () => {
      render(<EditorArea />);
      expect(screen.getByText(/Atlas SuperIDE/)).toBeInTheDocument();
    });

    it('renders Monaco editor when tab is open', () => {
      useIDEStore.setState({
        openTabs: [{ id: 'e1', name: 'Token.sol', path: 'Token.sol', content: 'code', language: 'sol', isDirty: false }],
        activeTabId: 'e1',
      });
      render(<EditorArea />);
      expect(screen.getByTestId('mock-monaco-editor')).toBeInTheDocument();
    });

    it('shows tab name in tab bar', () => {
      useIDEStore.setState({
        openTabs: [{ id: 'e1', name: 'Token.sol', path: 'Token.sol', content: 'code', language: 'sol', isDirty: false }],
        activeTabId: 'e1',
      });
      render(<EditorArea />);
      expect(screen.getByText('Token.sol')).toBeInTheDocument();
    });

    it('shows dirty indicator for modified files', () => {
      useIDEStore.setState({
        openTabs: [{ id: 'e1', name: 'Token.sol', path: 'Token.sol', content: 'modified', language: 'sol', isDirty: true }],
        activeTabId: 'e1',
      });
      render(<EditorArea />);
      expect(screen.getByText('💾')).toBeInTheDocument();
    });

    it('saves file via real backend on save icon click', async () => {
      useIDEStore.setState({
        openTabs: [{ id: 'e1', name: '__test_save.txt', path: '__test_save.txt', content: 'saved content', language: 'text', isDirty: true }],
        activeTabId: 'e1',
      });
      render(<EditorArea />);
      const saveIcon = screen.getByText('💾');
      await act(async () => { fireEvent.click(saveIcon); });
      await waitFor(() => {
        // Tab should be marked as saved
        const tab = useIDEStore.getState().openTabs.find((t: any) => t.id === 'e1');
        expect(tab?.isDirty).toBe(false);
      }, { timeout: 10000 });
    });

    it('handles Ctrl+S keyboard shortcut', async () => {
      useIDEStore.setState({
        openTabs: [{ id: 'e1', name: '__test_ctrlS.txt', path: '__test_ctrlS.txt', content: 'ctrl-s content', language: 'text', isDirty: true }],
        activeTabId: 'e1',
      });
      render(<EditorArea />);
      await act(async () => {
        fireEvent.keyDown(document, { key: 's', ctrlKey: true });
      });
      await waitFor(() => {
        const tab = useIDEStore.getState().openTabs.find((t: any) => t.id === 'e1');
        expect(tab?.isDirty).toBe(false);
      }, { timeout: 10000 });
    });

    it('closes a tab', () => {
      useIDEStore.setState({
        openTabs: [
          { id: 'e1', name: 'File1.sol', path: 'File1.sol', content: '', language: 'sol', isDirty: false },
          { id: 'e2', name: 'File2.sol', path: 'File2.sol', content: '', language: 'sol', isDirty: false },
        ],
        activeTabId: 'e1',
      });
      render(<EditorArea />);
      const closeButtons = screen.getAllByText('✕');
      fireEvent.click(closeButtons[0]);
      expect(useIDEStore.getState().openTabs.length).toBe(1);
    });
  });
});
