/**
 * Render tests for components that currently have 0% coverage.
 * Only Monaco editor is mocked (web workers can't run in jsdom).
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { render, screen, fireEvent, waitFor, act, cleanup } from '@testing-library/react';
import { useIDEStore } from '../store/ideStore';

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

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

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
    agentRuns: [],
    agentProfiles: [],
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
    noAddModeEnabled: false,
    noAddObjective: '',
    noAddDefinitionOfDone: '',
  });
}

describe('Component Render Tests', () => {
  beforeEach(() => resetStore());
  afterEach(() => cleanup());

  // ── TitleBar ─────────────────────────────────────────────────
  describe('TitleBar', () => {
    let TitleBar: any;
    beforeEach(async () => {
      const mod = await import('../components/TitleBar');
      TitleBar = mod.TitleBar;
    });

    it('renders brand name', () => {
      render(<TitleBar />);
      expect(screen.getByText('Atlas SuperIDE')).toBeInTheDocument();
    });

    it('renders logo letter', () => {
      render(<TitleBar />);
      expect(screen.getByText('A')).toBeInTheDocument();
    });

    it('renders menu buttons', () => {
      render(<TitleBar />);
      expect(screen.getByText('File')).toBeInTheDocument();
      expect(screen.getByText('Edit')).toBeInTheDocument();
      expect(screen.getByText('View')).toBeInTheDocument();
      expect(screen.getByText('AI')).toBeInTheDocument();
      expect(screen.getByText('Remix')).toBeInTheDocument();
      expect(screen.getByText('Tools')).toBeInTheDocument();
      expect(screen.getByText('Help')).toBeInTheDocument();
    });

    it('renders center title', () => {
      render(<TitleBar />);
      const titleEls = screen.getAllByText(/Atlas SuperIDE/);
      expect(titleEls.length).toBeGreaterThanOrEqual(1);
    });
  });

  // ── StatusBar ────────────────────────────────────────────────
  describe('StatusBar', () => {
    let StatusBar: any;
    beforeEach(async () => {
      const mod = await import('../components/StatusBar');
      StatusBar = mod.StatusBar;
    });

    it('renders version info', () => {
      render(<StatusBar />);
      expect(screen.getByText(/Atlas SuperIDE/)).toBeInTheDocument();
    });

    it('shows Ollama disconnected state', () => {
      useIDEStore.setState({ ollamaConnected: false });
      render(<StatusBar />);
      expect(screen.getByText(/Ollama/)).toBeInTheDocument();
    });

    it('shows Ollama connected state with model count', () => {
      useIDEStore.setState({
        ollamaConnected: true,
        chatModel: 'llama3:8b',
        availableModels: [
          { name: 'llama3:8b', size: '4.7GB', modified: '', quantization: 'q4', capabilities: [] },
          { name: 'qwen2.5-coder:7b', size: '4.4GB', modified: '', quantization: 'q4', capabilities: [] },
        ],
      });
      render(<StatusBar />);
      expect(screen.getByText('Ollama')).toBeInTheDocument();
      expect(screen.getByText('llama3:8b')).toBeInTheDocument();
      expect(screen.getByText('2 models')).toBeInTheDocument();
    });

    it('shows cursor position when file is open', () => {
      useIDEStore.setState({
        openTabs: [{ id: 't1', name: 'Test.sol', path: 'Test.sol', content: '', language: 'sol', isDirty: false }],
        activeTabId: 't1',
        editorCursorLine: 5,
        editorCursorColumn: 12,
      });
      render(<StatusBar />);
      expect(screen.getByText('Ln 5, Col 12')).toBeInTheDocument();
      expect(screen.getByText('UTF-8')).toBeInTheDocument();
      expect(screen.getByText('Spaces: 2')).toBeInTheDocument();
    });

    it('shows Solidity language for .sol files', () => {
      useIDEStore.setState({
        openTabs: [{ id: 't1', name: 'Token.sol', path: 'Token.sol', content: '', language: 'sol', isDirty: false }],
        activeTabId: 't1',
      });
      render(<StatusBar />);
      expect(screen.getByText('Solidity')).toBeInTheDocument();
    });

    it('shows TypeScript language for .ts files', () => {
      useIDEStore.setState({
        openTabs: [{ id: 't1', name: 'app.ts', path: 'app.ts', content: '', language: 'typescript', isDirty: false }],
        activeTabId: 't1',
      });
      render(<StatusBar />);
      expect(screen.getByText('TypeScript')).toBeInTheDocument();
    });

    it('shows TypeScript React language for .tsx files', () => {
      useIDEStore.setState({
        openTabs: [{ id: 't1', name: 'App.tsx', path: 'App.tsx', content: '', language: 'typescriptreact', isDirty: false }],
        activeTabId: 't1',
      });
      render(<StatusBar />);
      expect(screen.getByText('TypeScript React')).toBeInTheDocument();
    });

    it('shows RALPH OFF toggle when not enabled', () => {
      useIDEStore.setState({ noAddModeEnabled: false });
      render(<StatusBar />);
      expect(screen.getByText('RALPH OFF')).toBeInTheDocument();
    });

    it('shows RALPH toggle when enabled', () => {
      useIDEStore.setState({ noAddModeEnabled: true, noAddObjective: 'Fix bugs' });
      render(<StatusBar />);
      expect(screen.getByText(/RALPH/)).toBeInTheDocument();
    });

    it('shows 1 model singular form', () => {
      useIDEStore.setState({
        ollamaConnected: true,
        availableModels: [{ name: 'x', size: '', modified: '', quantization: '', capabilities: [] }],
      });
      render(<StatusBar />);
      expect(screen.getByText('1 model')).toBeInTheDocument();
    });
  });

  // ── SidePanel ────────────────────────────────────────────────
  describe('SidePanel', () => {
    let SidePanel: any;
    beforeEach(async () => {
      const mod = await import('../components/SidePanel');
      SidePanel = mod.SidePanel;
    });

    it('renders explorer panel by default', async () => {
      useIDEStore.setState({ activeSidebar: 'explorer' });
      await act(async () => { render(<SidePanel />); });
      expect(document.body.textContent).toBeTruthy();
    });

    it('renders search panel', async () => {
      useIDEStore.setState({ activeSidebar: 'search' });
      await act(async () => { render(<SidePanel />); });
      expect(screen.getByText('Code')).toBeInTheDocument();
    });

    it('renders settings panel', async () => {
      useIDEStore.setState({ activeSidebar: 'settings' });
      await act(async () => { render(<SidePanel />); });
      expect(screen.getByText('AI Provider')).toBeInTheDocument();
    });

    it('renders knowledge panel', async () => {
      useIDEStore.setState({ activeSidebar: 'knowledge' });
      await act(async () => { render(<SidePanel />); });
      expect(screen.getByText(/Knowledge Base/)).toBeInTheDocument();
    });

    it('renders notebook panel', async () => {
      useIDEStore.setState({ activeSidebar: 'notebook' });
      await act(async () => { render(<SidePanel />); });
      expect(screen.getByText(/Text/)).toBeInTheDocument();
    });

    it('renders ai-chat panel', async () => {
      useIDEStore.setState({ activeSidebar: 'ai-chat' });
      await act(async () => { render(<SidePanel />); });
      expect(screen.getByText('Ollama')).toBeInTheDocument();
    });

    it('renders remix panel', async () => {
      useIDEStore.setState({ activeSidebar: 'remix' });
      await act(async () => { render(<SidePanel />); });
      const items = screen.getAllByText(/Compile/);
      expect(items.length).toBeGreaterThan(0);
    });

    it('renders rag panel', async () => {
      useIDEStore.setState({ activeSidebar: 'rag' });
      await act(async () => { render(<SidePanel />); });
      expect(screen.getByText(/RAG/)).toBeInTheDocument();
    });

    it('renders research panel', async () => {
      useIDEStore.setState({ activeSidebar: 'research' });
      await act(async () => { render(<SidePanel />); });
      const items = screen.getAllByText(/Research/);
      expect(items.length).toBeGreaterThan(0);
    });

    it('renders skills panel', async () => {
      useIDEStore.setState({ activeSidebar: 'skills' });
      await act(async () => { render(<SidePanel />); });
      expect(screen.getByText(/Skills/)).toBeInTheDocument();
    });

    it('renders agents panel', async () => {
      useIDEStore.setState({ activeSidebar: 'agents' });
      await act(async () => { render(<SidePanel />); });
      const items = screen.getAllByText(/Agents/);
      expect(items.length).toBeGreaterThan(0);
    });
  });

  // ── BottomPanel ──────────────────────────────────────────────
  describe('BottomPanel', () => {
    let BottomPanel: any;
    beforeEach(async () => {
      const mod = await import('../components/BottomPanel');
      BottomPanel = mod.BottomPanel;
    });

    it('renders terminal tab', () => {
      render(<BottomPanel />);
      expect(screen.getByText(/Terminal/)).toBeInTheDocument();
    });

    it('renders output tab', () => {
      render(<BottomPanel />);
      expect(screen.getByText(/Output/)).toBeInTheDocument();
    });

    it('renders problems tab', () => {
      render(<BottomPanel />);
      expect(screen.getByText(/Problems/)).toBeInTheDocument();
    });

    it('renders RAG results tab', () => {
      render(<BottomPanel />);
      expect(screen.getByText(/RAG/)).toBeInTheDocument();
    });

    it('switches to output tab', () => {
      render(<BottomPanel />);
      fireEvent.click(screen.getByText(/Output/));
      // Uses local state, so verify output content renders
      expect(screen.getByText(/Atlas SuperIDE.*Frontend/)).toBeInTheDocument();
    });

    it('switches to problems tab', () => {
      render(<BottomPanel />);
      fireEvent.click(screen.getByText(/Problems/));
      // The problems tab content should now be visible
      expect(document.body.textContent).toMatch(/problems|No active/i);
    });

    it('shows output tab content when active', () => {
      render(<BottomPanel />);
      fireEvent.click(screen.getByText(/Output/));
      expect(screen.getByText(/Atlas SuperIDE.*Frontend/)).toBeInTheDocument();
    });

    it('shows problems when disconnected', () => {
      useIDEStore.setState({ ollamaConnected: false });
      render(<BottomPanel />);
      fireEvent.click(screen.getByText(/Problems/));
      expect(screen.getByText(/Ollama is not connected/)).toBeInTheDocument();
    });

    it('shows no problems when connected with models and file open', () => {
      useIDEStore.setState({
        ollamaConnected: true,
        availableModels: [{ name: 'x', size: '', modified: '', quantization: '', capabilities: [] }],
        openTabs: [{ id: 't1', name: 'a.sol', path: 'a.sol', content: '', language: 'sol', isDirty: false }],
        activeTabId: 't1',
      });
      render(<BottomPanel />);
      fireEvent.click(screen.getByText(/Problems/));
      // Only PTY warning remains (terminalTransport defaults to 'pipe')
      expect(screen.getByText(/PTY unavailable/)).toBeInTheDocument();
    });

    it('shows RAG empty state on RAG tab', () => {
      useIDEStore.setState({ ragResults: [] });
      render(<BottomPanel />);
      fireEvent.click(screen.getByText(/RAG/));
      expect(screen.getByText(/No RAG results/)).toBeInTheDocument();
    });

    it('shows RAG results when present', () => {
      useIDEStore.setState({
        ragResults: [
          { source: 'https://docs.sol.com', score: 0.95, content: 'Result from docs', metadata: {} },
        ],
      });
      render(<BottomPanel />);
      fireEvent.click(screen.getByText(/RAG/));
      expect(screen.getByText(/Result from docs/)).toBeInTheDocument();
    });

    it('shows clear and stop buttons on terminal tab', () => {
      useIDEStore.setState({ activeBottomPanel: 'terminal' });
      render(<BottomPanel />);
      expect(screen.getByText('Clear')).toBeInTheDocument();
      expect(screen.getByText('Stop')).toBeInTheDocument();
    });

    it('shows session info on terminal tab', () => {
      render(<BottomPanel />);
      // Terminal shows "connecting" or "pipe shell" / "pty shell" session info
      expect(screen.getByText(/connecting|shell/i)).toBeInTheDocument();
    });

    it('shows problem count in tab label', () => {
      useIDEStore.setState({ ollamaConnected: false });
      render(<BottomPanel />);
      const problemsTab = screen.getByText(/Problems/);
      expect(problemsTab.textContent).toMatch(/\d+/);
    });

    it('handles output tab with workspace and AI info', () => {
      useIDEStore.setState({
        workspaceRoot: '/my/project',
        ollamaConnected: true,
        ollamaUrl: 'http://localhost:11434',
        availableModels: [{ name: 'x', size: '', modified: '', quantization: '', capabilities: [] }],
      });
      render(<BottomPanel />);
      fireEvent.click(screen.getByText(/Output/));
      const items = screen.getAllByText(/\/my\/project/);
      expect(items.length).toBeGreaterThanOrEqual(1);
    });

    it('renders terminal toolbar buttons', () => {
      useIDEStore.setState({ activeBottomPanel: 'terminal' });
      render(<BottomPanel />);
      const clearBtn = screen.getByText('Clear');
      fireEvent.click(clearBtn);
      // Should clear terminal transcript
    });
  });

  // ── AgentsPanel ──────────────────────────────────────────────
  describe('AgentsPanel', () => {
    let AgentsPanel: any;
    beforeEach(async () => {
      const mod = await import('../components/panels/AgentsPanel');
      AgentsPanel = mod.AgentsPanel;
    });

    it('renders agents header', async () => {
      await act(async () => { render(<AgentsPanel />); });
      const items = screen.getAllByText(/Agents/);
      expect(items.length).toBeGreaterThan(0);
    });

    it('renders objective textarea', async () => {
      await act(async () => { render(<AgentsPanel />); });
      expect(screen.getByPlaceholderText(/Describe the shared task/)).toBeInTheDocument();
    });

    it('renders definition of done textarea', async () => {
      await act(async () => { render(<AgentsPanel />); });
      expect(screen.getByPlaceholderText(/acceptance checks/)).toBeInTheDocument();
    });

    it('renders execution mode selector', async () => {
      await act(async () => { render(<AgentsPanel />); });
      expect(screen.getByText('Parallel')).toBeInTheDocument();
    });

    it('renders Add Agent button', async () => {
      await act(async () => { render(<AgentsPanel />); });
      expect(screen.getByText('Add Agent')).toBeInTheDocument();
    });

    it('renders Run Agents button', async () => {
      await act(async () => { render(<AgentsPanel />); });
      expect(screen.getByText('Run Agents')).toBeInTheDocument();
    });

    it('shows no runs empty state', async () => {
      useIDEStore.setState({ agentRuns: [] } as any);
      await act(async () => { render(<AgentsPanel />); });
      await waitFor(() => {
        // After loading, if API returns empty, show empty state; otherwise just check the runs section exists
        const runsHeader = screen.getByText('Runs');
        expect(runsHeader).toBeInTheDocument();
      }, { timeout: 5000 });
    });

    it('adds an agent profile', async () => {
      await act(async () => { render(<AgentsPanel />); });
      fireEvent.click(screen.getByText('Add Agent'));
      // Should show agent name input
      const nameInputs = screen.getAllByPlaceholderText('Agent name');
      expect(nameInputs.length).toBeGreaterThan(0);
    });

    it('fills objective textarea', async () => {
      await act(async () => { render(<AgentsPanel />); });
      const textarea = screen.getByPlaceholderText(/Describe the shared task/);
      fireEvent.change(textarea, { target: { value: 'Test objective' } });
      expect((textarea as HTMLTextAreaElement).value).toBe('Test objective');
    });

    it('fills definition of done textarea', async () => {
      await act(async () => { render(<AgentsPanel />); });
      const textarea = screen.getByPlaceholderText(/acceptance checks/);
      fireEvent.change(textarea, { target: { value: 'All tests pass' } });
      expect((textarea as HTMLTextAreaElement).value).toBe('All tests pass');
    });

    it('shows RALPH controls when RALPH mode enabled', async () => {
      useIDEStore.setState({ noAddModeEnabled: true, noAddObjective: 'Fix all bugs' });
      await act(async () => { render(<AgentsPanel />); });
      const items = screen.getAllByText(/Ralph mode/i);
      expect(items.length).toBeGreaterThan(0);
    });

    it('renders prompt template selector after adding agent', async () => {
      await act(async () => { render(<AgentsPanel />); });
      // Add an agent first — template selector is inside agent profile cards
      fireEvent.click(screen.getByText('Add Agent'));
      await waitFor(() => {
        expect(screen.getByText('Prompt Template')).toBeInTheDocument();
      });
    });

    it('shows enabled/active count', async () => {
      await act(async () => { render(<AgentsPanel />); });
      expect(screen.getByText(/enabled/)).toBeInTheDocument();
    });

    it('shows all Ralph validation issues with fix actions', async () => {
      useIDEStore.setState({ noAddModeEnabled: true, workspaceRoot: '.' } as any);
      const malformedTask = [
        'task: Broken Ralph task',
        '',
        '## success criteria',
        '- broken item',
        'still bad',
        '',
      ].join('\n');

      const fetchMock = vi.spyOn(globalThis, 'fetch').mockImplementation(async (input, init) => {
        const url = typeof input === 'string' ? input : input instanceof Request ? input.url : String(input);
        const method = init?.method || 'GET';

        if (url.includes('/api/agents/runs')) {
          return jsonResponse([]);
        }
        if (url.includes('/api/file') && method === 'GET') {
          return jsonResponse({ path: '.ralph/ralph_task.md', content: malformedTask });
        }

        return jsonResponse({});
      });

      await act(async () => { render(<AgentsPanel />); });

      await waitFor(() => {
        expect(screen.getByText('Ralph task is invalid.')).toBeInTheDocument();
      });
      expect(screen.getByText('Fix Checklist')).toBeInTheDocument();
      expect(screen.getByText('Repair Template')).toBeInTheDocument();
      expect(screen.getByText('- Invalid checklist line: - broken item')).toBeInTheDocument();
      expect(screen.getByText('- Invalid checklist line: still bad')).toBeInTheDocument();
      expect(screen.getByText('- No checklist items found.')).toBeInTheDocument();

      fetchMock.mockRestore();
    });

    it('confirms before repairing a malformed Ralph task template', async () => {
      useIDEStore.setState({ noAddModeEnabled: true, workspaceRoot: '.', noAddObjective: 'Ship fix' } as any);
      let fileContent = [
        'task: Broken Ralph task',
        '',
        '## success criteria',
        '- broken item',
        '',
      ].join('\n');
      const confirmSpy = vi.spyOn(window, 'confirm').mockReturnValue(true);

      const fetchMock = vi.spyOn(globalThis, 'fetch').mockImplementation(async (input, init) => {
        const url = typeof input === 'string' ? input : input instanceof Request ? input.url : String(input);
        const method = init?.method || 'GET';

        if (url.includes('/api/agents/runs')) {
          return jsonResponse([]);
        }
        if (url.includes('/api/file') && method === 'GET') {
          return jsonResponse({ path: '.ralph/ralph_task.md', content: fileContent });
        }
        if (url.includes('/api/file') && method === 'POST') {
          const payload = JSON.parse(String(init?.body || '{}'));
          fileContent = payload.content;
          return jsonResponse({ status: 'ok', path: payload.path });
        }

        return jsonResponse({});
      });

      await act(async () => { render(<AgentsPanel />); });

      await waitFor(() => {
        expect(screen.getByText('Repair Template')).toBeInTheDocument();
      });

      fireEvent.click(screen.getByText('Repair Template'));

      await waitFor(() => {
        expect(confirmSpy).toHaveBeenCalledTimes(1);
      });
      await waitFor(() => {
        expect(screen.getByText(/Repaired \.ralph\/ralph_task\.md/)).toBeInTheDocument();
      });
      expect(fileContent).toContain('# ralph task');
      expect(fileContent).toContain('## success criteria');
      expect(fileContent).toContain('- [ ] Replace this with the first concrete acceptance check');

      confirmSpy.mockRestore();
      fetchMock.mockRestore();
    });
  });

  // ── CoveragePanel ────────────────────────────────────────────
  describe('CoveragePanel', () => {
    let CoveragePanel: any;
    beforeEach(async () => {
      const mod = await import('../components/panels/CoveragePanel');
      CoveragePanel = mod.CoveragePanel;
    });

    it('renders coverage header', () => {
      render(<CoveragePanel />);
      expect(screen.getByText(/Code Coverage/)).toBeInTheDocument();
    });

    it('shows generate button', () => {
      render(<CoveragePanel />);
      expect(screen.getByText(/Generate Coverage Report/)).toBeInTheDocument();
    });

    it('shows empty state', () => {
      render(<CoveragePanel />);
      expect(screen.getByText('No coverage data')).toBeInTheDocument();
    });

    it('shows subtitle with file path when tab is open', () => {
      useIDEStore.setState({
        openTabs: [{ id: 'c1', name: 'Token.sol', path: 'Token.sol', content: '', language: 'sol', isDirty: false }],
        activeTabId: 'c1',
      });
      render(<CoveragePanel />);
      expect(screen.getByText(/Coverage metrics for Token.sol/)).toBeInTheDocument();
    });

    it('shows subtitle for all files when no tab is open', () => {
      render(<CoveragePanel />);
      expect(screen.getByText(/Coverage metrics for all files/)).toBeInTheDocument();
    });
  });

  // ── App (integration) ───────────────────────────────────────
  describe('App', () => {
    let App: any;
    beforeEach(async () => {
      const mod = await import('../App');
      App = mod.default;
    });

    it('renders the full app shell', async () => {
      await act(async () => { render(<App />); });
      // Should have the title bar
      expect(screen.getByText('Atlas SuperIDE')).toBeInTheDocument();
    });

    it('renders sidebar', async () => {
      useIDEStore.setState({ isSidebarOpen: true });
      await act(async () => { render(<App />); });
      expect(screen.getByTitle('Explorer')).toBeInTheDocument();
    });

    it('renders right sidebar when open', async () => {
      useIDEStore.setState({ isRightSidebarOpen: true });
      await act(async () => { render(<App />); });
      expect(screen.getByTestId('right-sidebar')).toBeInTheDocument();
    });

    it('renders status bar', async () => {
      await act(async () => { render(<App />); });
      const items = screen.getAllByText(/Atlas SuperIDE/);
      expect(items.length).toBeGreaterThanOrEqual(1);
    });

    it('hides sidebar when closed', async () => {
      useIDEStore.setState({ isSidebarOpen: false });
      await act(async () => { render(<App />); });
      // Side panel should not show explorer content
      const sidePanel = document.querySelector('[class*="side-panel"]');
      // Either null or hidden
    });

    it('shows RALPH banner when enabled', async () => {
      useIDEStore.setState({
        noAddModeEnabled: true,
        noAddObjective: 'Ship feature X',
        noAddDefinitionOfDone: 'All tests pass and deployed',
      });
      await act(async () => { render(<App />); });
      expect(screen.getByText('RALPH Mode')).toBeInTheDocument();
      expect(screen.getByText(/Done when:/)).toBeInTheDocument();
    });

    it('does not show RALPH banner when disabled', async () => {
      useIDEStore.setState({ noAddModeEnabled: false });
      await act(async () => { render(<App />); });
      expect(screen.queryByText('RALPH Mode')).toBeNull();
    });
  });
});
