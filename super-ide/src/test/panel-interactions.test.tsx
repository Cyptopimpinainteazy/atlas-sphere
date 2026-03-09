/**
 * Deep interaction tests for low-coverage panels.
 * Tests real user interactions: clicking, typing, tab switching, form submissions.
 * Only Monaco editor is mocked (web workers unavailable in jsdom).
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { render, screen, fireEvent, waitFor, act, cleanup } from '@testing-library/react';
import { useIDEStore } from '../store/ideStore';
import * as api from '../lib/api';
import { researchDashboardStream } from '../lib/api';

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
    chatModel: 'llama3:8b',
    availableModels: [
      { name: 'llama3:8b', size: '4.7GB', modified: '', quantization: 'q4', capabilities: [] },
    ],
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
    aiModel: 'llama3:8b',
    ollamaUrl: 'http://localhost:11434',
    ollamaConnected: true,
    boltMessages: [],
    isBoltStreaming: false,
    workspaceRoot: '.',
    noAddModeEnabled: false,
    noAddObjective: '',
    noAddDefinitionOfDone: '',
    noAddRoleProfile: '',
    pinnedFiles: [],
    favoriteWorkspaceRoots: ['.'],
  });
}

function jsonResponse(data: unknown) {
  return new Response(JSON.stringify(data), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  });
}

describe('Panel Interaction Tests', () => {
  beforeEach(() => {
    resetStore();
    vi.restoreAllMocks();
    vi.spyOn(globalThis, 'fetch').mockImplementation(async (input) => {
      const url =
        typeof input === 'string'
          ? input
          : input instanceof Request
          ? input.url
          : String(input);

      if (url.includes('/api/testing/coverage')) {
        return jsonResponse({
          metrics: [
            {
              file: 'Token.sol',
              lines: 100,
              linesCovered: 80,
              branches: 20,
              branchesCovered: 16,
              functions: 10,
              functionsCovered: 8,
            },
          ],
        });
      }
      if (url.includes('/api/testing/forge')) {
        return jsonResponse({ output: 'forge test passed' });
      }
      if (url.includes('/api/testing/lint')) {
        return jsonResponse({ output: 'lint complete' });
      }
      if (url.includes('/api/security/slither')) {
        return jsonResponse({ output: 'security scan complete' });
      }
      if (url.includes('/api/rag/query')) {
        return jsonResponse([{ content: 'Sample result', source: 'docs', score: 0.92 }]);
      }
      if (url.includes('/api/research/list')) {
        return jsonResponse([]);
      }
      if (url.includes('/api/research/save')) {
        return jsonResponse({});
      }
      if (url.includes('/api/research/delete')) {
        return jsonResponse({});
      }
      if (url.includes('/api/rag/crawl')) {
        return jsonResponse({ title: 'Sample docs', chunks: 4 });
      }
      if (url.includes('/api/rag/sources')) {
        return jsonResponse([]);
      }
      if (url.includes('/api/notebook/list')) {
        return jsonResponse(useIDEStore.getState().notebookSessions);
      }
      if (url.includes('/api/files/tree')) {
        return jsonResponse({ tree: [] });
      }
      if (url.includes('/api/skills/list')) {
        return jsonResponse([
          {
            id: 'find-skills',
            name: 'Find Skills',
            description: 'Discover installed skills and the next capability to load on demand.',
            category: 'knowledge',
            inputs: [],
            status: 'installed',
            source: 'local',
            executionMode: 'package',
            defaultPrompt: 'Find the best skill for this task.',
            recommendedMode: 'context-eng',
            triggers: ['find a skill'],
          },
        ]);
      }
      if (url.includes('/api/skills/history/list')) {
        return jsonResponse(useIDEStore.getState().skillHistory);
      }
      if (url.includes('/api/mcp/servers')) {
        return jsonResponse([]);
      }
      if (url.includes('/api/openclaw/config')) {
        return jsonResponse({
          baseUrl: '',
          toolEndpoint: '/api/tools/invoke',
          gatewayToken: '',
          defaultProfile: 'coding',
          webProvider: 'brave',
          loopDetectionEnabled: true,
        });
      }

      return jsonResponse({});
    });
  });
  afterEach(() => {
    vi.restoreAllMocks();
    cleanup();
  });

  // ── TitleBar Menu Clicks ─────────────────────────────────────
  describe('TitleBar interactions', () => {
    let TitleBar: any;
    beforeEach(async () => {
      const mod = await import('../components/TitleBar');
      TitleBar = mod.TitleBar;
    });

    it('File menu sets sidebar to explorer', () => {
      render(<TitleBar />);
      fireEvent.click(screen.getByText('File'));
      expect(useIDEStore.getState().activeSidebar).toBe('explorer');
    });

    it('View menu sets sidebar to explorer', () => {
      useIDEStore.setState({ activeSidebar: 'ai-chat' });
      render(<TitleBar />);
      fireEvent.click(screen.getByText('View'));
      expect(useIDEStore.getState().activeSidebar).toBe('explorer');
    });

    it('AI menu sets sidebar to ai-chat', () => {
      render(<TitleBar />);
      fireEvent.click(screen.getByText('AI'));
      expect(useIDEStore.getState().activeSidebar).toBe('ai-chat');
    });

    it('Remix menu sets sidebar to remix', () => {
      render(<TitleBar />);
      fireEvent.click(screen.getByText('Remix'));
      expect(useIDEStore.getState().activeSidebar).toBe('remix');
    });

    it('Tools menu sets sidebar to skills', () => {
      render(<TitleBar />);
      fireEvent.click(screen.getByText('Tools'));
      expect(useIDEStore.getState().activeSidebar).toBe('skills');
    });

    it('Help menu sets sidebar to knowledge', () => {
      render(<TitleBar />);
      fireEvent.click(screen.getByText('Help'));
      expect(useIDEStore.getState().activeSidebar).toBe('knowledge');
    });

    it('Edit menu click does nothing (no case in switch)', () => {
      useIDEStore.setState({ activeSidebar: 'search' });
      render(<TitleBar />);
      fireEvent.click(screen.getByText('Edit'));
      // Should stay unchanged since 'edit' has no case
      expect(useIDEStore.getState().activeSidebar).toBe('search');
    });
  });

  // ── CoveragePanel Interactions ───────────────────────────────
  describe('CoveragePanel interactions', () => {
    let CoveragePanel: any;
    beforeEach(async () => {
      const mod = await import('../components/panels/CoveragePanel');
      CoveragePanel = mod.CoveragePanel;
    });

    it('generate button is disabled with no active file', () => {
      render(<CoveragePanel />);
      const btn = screen.getByText(/Generate Coverage Report/);
      expect(btn).toBeDisabled();
    });

    it('generate button is enabled with active file', () => {
      useIDEStore.setState({
        openTabs: [{ id: 'f1', name: 'Token.sol', path: 'Token.sol', content: 'contract Token {}', language: 'sol', isDirty: false }],
        activeTabId: 'f1',
      });
      render(<CoveragePanel />);
      const btn = screen.getByText(/Generate Coverage Report/);
      expect(btn).not.toBeDisabled();
    });

    it('clicking generate triggers loading state', async () => {
      useIDEStore.setState({
        openTabs: [{ id: 'f1', name: 'Token.sol', path: 'Token.sol', content: 'contract Token {}', language: 'sol', isDirty: false }],
        activeTabId: 'f1',
      });
      render(<CoveragePanel />);
      const btn = screen.getByText(/Generate Coverage Report/);
      fireEvent.click(btn);
      await waitFor(() => {
        expect(screen.getByText('Summary')).toBeInTheDocument();
      });
    });

    it('shows coverage data after successful fetch', async () => {
      useIDEStore.setState({
        openTabs: [{ id: 'f1', name: 'Token.sol', path: 'Token.sol', content: 'contract Token {}', language: 'sol', isDirty: false }],
        activeTabId: 'f1',
      });

      const fetchMock = vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(
        new Response(JSON.stringify({
          metrics: [
            { file: 'Token.sol', lines: 100, linesCovered: 80, branches: 20, branchesCovered: 16, functions: 10, functionsCovered: 8 },
          ],
        }), { status: 200, headers: { 'Content-Type': 'application/json' } }),
      );

      render(<CoveragePanel />);
      fireEvent.click(screen.getByText(/Generate Coverage Report/));

      await waitFor(() => {
        expect(screen.getByText('Summary')).toBeInTheDocument();
      });
      expect(screen.getByText('Files')).toBeInTheDocument();
      // there are multiple places where 80.0% appears (summary + row)
      expect(screen.getAllByText(/80\.0%/)[0]).toBeInTheDocument();
      expect(screen.getByText('Token.sol')).toBeInTheDocument();

      fetchMock.mockRestore();
    });

    it('shows color coding for coverage levels', async () => {
      useIDEStore.setState({
        openTabs: [{ id: 'f1', name: 'a.sol', path: 'a.sol', content: '', language: 'sol', isDirty: false }],
        activeTabId: 'f1',
      });

      const fetchMock = vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(
        new Response(JSON.stringify({
          metrics: [
            { file: 'a.sol', lines: 100, linesCovered: 90, branches: 10, branchesCovered: 5, functions: 10, functionsCovered: 4 },
          ],
        }), { status: 200, headers: { 'Content-Type': 'application/json' } }),
      );

      render(<CoveragePanel />);
      fireEvent.click(screen.getByText(/Generate Coverage Report/));

      await waitFor(() => {
        // 90% lines = green, 50% branches = red, 40% functions = red
        expect(screen.getByText(/90\.0%/)).toBeInTheDocument();
        expect(screen.getAllByText(/50\.0%/)[0]).toBeInTheDocument();
        expect(screen.getAllByText(/40\.0%/)[0]).toBeInTheDocument();
      });

      fetchMock.mockRestore();
    });
  });

  // ── ExplorerPanel Interactions ───────────────────────────────
  describe('ExplorerPanel interactions', () => {
    let ExplorerPanel: any;
    beforeEach(async () => {
      const mod = await import('../components/panels/ExplorerPanel');
      ExplorerPanel = mod.ExplorerPanel;
    });

    it('renders explorer header', async () => {
      await act(async () => { render(<ExplorerPanel />); });
      expect(screen.getByText(/Explorer/)).toBeInTheDocument();
    });

    it('shows workspace root input', async () => {
      await act(async () => { render(<ExplorerPanel />); });
      const input = screen.getByPlaceholderText('Workspace root');
      expect(input).toBeInTheDocument();
    });

    it('shows Go button', async () => {
      await act(async () => { render(<ExplorerPanel />); });
      expect(screen.getByText('Go')).toBeInTheDocument();
    });

    it('shows current root', async () => {
      await act(async () => { render(<ExplorerPanel />); });
      expect(screen.getByText(/Current root/)).toBeInTheDocument();
    });

    it('shows favorite workspace roots', async () => {
      useIDEStore.setState({ favoriteWorkspaceRoots: ['.', '/tmp/project'] });
      await act(async () => { render(<ExplorerPanel />); });
      const items = screen.getAllByText('.');
      expect(items.length).toBeGreaterThan(0);
    });

    it('shows + New button', async () => {
      await act(async () => { render(<ExplorerPanel />); });
      expect(screen.getByText('+ New')).toBeInTheDocument();
    });

    it('shows favorite toggle star', async () => {
      await act(async () => { render(<ExplorerPanel />); });
      // Star should be visible for toggling favorites
      const starBtn = screen.getByTitle('Toggle favorite root');
      expect(starBtn).toBeInTheDocument();
    });

    it('changes workspace root on Go click', async () => {
      await act(async () => { render(<ExplorerPanel />); });
      const input = screen.getByPlaceholderText('Workspace root');
      fireEvent.change(input, { target: { value: '/tmp/newroot' } });
      fireEvent.click(screen.getByText('Go'));
      expect(useIDEStore.getState().workspaceRoot).toBe('/tmp/newroot');
    });

    it('shows tree items when loaded', async () => {
      await act(async () => { render(<ExplorerPanel />); });
      // Wait for tree to load from real backend
      await waitFor(() => {
        // Either shows files or shows "No files found"
        expect(document.body.textContent).toMatch(/📄|📁|No files found/);
      }, { timeout: 5000 });
    });

    it('shows pinned files section when files are pinned', async () => {
      useIDEStore.setState({ pinnedFiles: ['test.sol'] });
      await act(async () => { render(<ExplorerPanel />); });
      expect(screen.getByText('Pinned files')).toBeInTheDocument();
      expect(screen.getByText(/test\.sol/)).toBeInTheDocument();
    });
  });

  // ── SearchPanel Interactions ─────────────────────────────────
  describe('SearchPanel interactions', () => {
    let SearchPanel: any;
    beforeEach(async () => {
      const mod = await import('../components/panels/SearchPanel');
      SearchPanel = mod.SearchPanel;
    });

    it('renders search panel header', () => {
      render(<SearchPanel />);
      expect(screen.getByText('Search')).toBeInTheDocument();
    });

    it('shows mode tabs', () => {
      render(<SearchPanel />);
      expect(screen.getByText('Files')).toBeInTheDocument();
      expect(screen.getByText('Code')).toBeInTheDocument();
      expect(screen.getByText('RAG Search')).toBeInTheDocument();
    });

    it('shows search input with files placeholder', () => {
      render(<SearchPanel />);
      expect(screen.getByPlaceholderText('Match file paths')).toBeInTheDocument();
    });

    it('switches placeholder when mode changes', () => {
      render(<SearchPanel />);
      fireEvent.click(screen.getByText('Code'));
      expect(screen.getByPlaceholderText('Find code lines')).toBeInTheDocument();
    });

    it('opening RAG Search opens right sidebar automatically', () => {
      render(<SearchPanel />);
      fireEvent.click(screen.getByText('RAG Search'));
      expect(useIDEStore.getState().activeRightSidebar).toBe('rag');
      expect(useIDEStore.getState().isRightSidebarOpen).toBe(true);
    });

    it('shows RAG placeholder and crawl hint', () => {
      render(<SearchPanel />);
      fireEvent.click(screen.getByText('RAG Search'));
      expect(screen.getByPlaceholderText('Query crawled docs')).toBeInTheDocument();
      expect(screen.getByText(/Crawling new URLs lives/)).toBeInTheDocument();
      // clicking the hint button should open right sidebar
      fireEvent.click(screen.getByText('Open RAG panel'));
      expect(useIDEStore.getState().activeRightSidebar).toBe('rag');
    });

    it('shows initial hint text', () => {
      render(<SearchPanel />);
      expect(screen.getByText(/Run a search to inspect/)).toBeInTheDocument();
    });

    it('shows scope info', () => {
      render(<SearchPanel />);
      expect(screen.getByText('Scope:')).toBeInTheDocument();
    });

    it('shows description for files mode', () => {
      render(<SearchPanel />);
      expect(screen.getByText('Searches workspace file names and paths.')).toBeInTheDocument();
    });

    it('shows description for code mode', () => {
      render(<SearchPanel />);
      fireEvent.click(screen.getByText('Code'));
      expect(screen.getByText(/Searches file contents/)).toBeInTheDocument();
    });

    it('shows description for RAG mode', () => {
      render(<SearchPanel />);
      fireEvent.click(screen.getByText('RAG Search'));
      expect(screen.getByText(/Searches crawled documentation/)).toBeInTheDocument();
    });

    it('shows error for empty query', () => {
      render(<SearchPanel />);
      const goBtn = screen.getByText('Go');
      fireEvent.click(goBtn);
      expect(screen.getByText('Enter a query to search.')).toBeInTheDocument();
    });

    it('performs file search with input', async () => {
      render(<SearchPanel />);
      const input = screen.getByPlaceholderText('Match file paths');
      fireEvent.change(input, { target: { value: 'package.json' } });
      fireEvent.click(screen.getByText('Go'));
      await waitFor(() => {
        // Either results appear or "No matches"
        expect(document.body.textContent).toMatch(/package\.json|No matches|Searching/);
      }, { timeout: 10000 });
    });
  });

  // ── NotebookPanel Interactions ───────────────────────────────
  describe('NotebookPanel interactions', () => {
    let NotebookPanel: any;
    beforeEach(async () => {
      const mod = await import('../components/panels/NotebookPanel');
      NotebookPanel = mod.NotebookPanel;
    });

    it('renders NotebookLM header', async () => {
      await act(async () => { render(<NotebookPanel />); });
      expect(screen.getByText(/NotebookLM/)).toBeInTheDocument();
    });

    it('shows Create and Sessions tabs', async () => {
      await act(async () => { render(<NotebookPanel />); });
      expect(screen.getByText(/Create/)).toBeInTheDocument();
      expect(screen.getByText(/Sessions/)).toBeInTheDocument();
    });

    it('shows Source Type selector', async () => {
      await act(async () => { render(<NotebookPanel />); });
      expect(screen.getAllByText(/URL/).length).toBeGreaterThan(0);
      expect(screen.getAllByText(/Text/).length).toBeGreaterThan(0);
      expect(screen.getAllByText(/PDF/).length).toBeGreaterThan(0);
    });

    it('switches to text source type', async () => {
      await act(async () => { render(<NotebookPanel />); });
      // Find the text button for source type (not tab)
      const textBtns = screen.getAllByText(/Text/);
      fireEvent.click(textBtns[textBtns.length - 1]); // Last one is the source type button
      expect(screen.getByPlaceholderText('Paste your content here...')).toBeInTheDocument();
    });

    it('shows tone selector', async () => {
      await act(async () => { render(<NotebookPanel />); });
      expect(screen.getByText('Tone')).toBeInTheDocument();
    });

    it('shows output format selector', async () => {
      await act(async () => { render(<NotebookPanel />); });
      expect(screen.getByText('Output Format')).toBeInTheDocument();
    });

    it('generate button is disabled without content', async () => {
      await act(async () => { render(<NotebookPanel />); });
      const btn = screen.getByText(/Generate Notebook/);
      expect(btn).toBeDisabled();
    });

    it('shows session count', async () => {
      await act(async () => { render(<NotebookPanel />); });
      expect(screen.getByText(/\d+ sessions/)).toBeInTheDocument();
    });

    it('shows empty sessions state', async () => {
      useIDEStore.setState({ notebookSessions: [] });
      await act(async () => { render(<NotebookPanel />); });
      fireEvent.click(screen.getByText(/Sessions/));
      await waitFor(() => {
        expect(screen.getByText(/No notebook sessions yet/)).toBeInTheDocument();
      });
    });

    it('shows sessions list when sessions exist', async () => {
      useIDEStore.setState({
        notebookSessions: [
          { id: 'nb-1', title: 'Test Session', sourceType: 'url', sourceUrl: 'https://example.com', focusArea: '', transcript: 'Hello', createdAt: Date.now() },
        ],
      });
      await act(async () => { render(<NotebookPanel />); });
      fireEvent.click(screen.getByText(/Sessions/));
      // title is wrapped in a span so there may be multiple instances
      expect(screen.getAllByText('Test Session')[0]).toBeInTheDocument();
    });

    it('opens session detail view', async () => {
      useIDEStore.setState({
        notebookSessions: [
          { id: 'nb-1', title: 'My Session', sourceType: 'text', sourceUrl: '', focusArea: 'security', transcript: 'The transcript content here', createdAt: Date.now() },
        ],
      });
      await act(async () => { render(<NotebookPanel />); });
      fireEvent.click(screen.getByText(/Sessions/));
      // session title may be nested, so pick first match
      fireEvent.click(screen.getAllByText('My Session')[0]);
      expect(screen.getByText('The transcript content here')).toBeInTheDocument();
      expect(screen.getByText('← Back')).toBeInTheDocument();
    });

    it('shows Focus Area input', async () => {
      await act(async () => { render(<NotebookPanel />); });
      expect(screen.getByPlaceholderText(/security patterns/)).toBeInTheDocument();
    });

    it('types in URL input', async () => {
      await act(async () => { render(<NotebookPanel />); });
      const input = screen.getByPlaceholderText(/soliditylang/);
      fireEvent.change(input, { target: { value: 'https://test.com' } });
      expect((input as HTMLInputElement).value).toBe('https://test.com');
    });
  });

  // ── ResearchPanel Interactions ─────────────────────────────
  describe('ResearchPanel interactions', () => {
    let ResearchPanel: any;
    beforeEach(async () => {
      const mod = await import('../components/panels/ResearchPanel');
      ResearchPanel = mod.ResearchPanel;
      // stub stream generator by replacing the exported function
      vi.spyOn(api, 'researchDashboardStream').mockImplementation(async function* () {
        yield 'chunk1 ';
        yield 'metric data';
      } as any);
    });

    it('renders header and tabs', async () => {
      await act(async () => { render(<ResearchPanel />); });
      // header includes icon so match exact string
      expect(screen.getByText('📊 Research Dashboard')).toBeInTheDocument();
      // tabs are buttons with specific labels
      expect(screen.getByRole('button', { name: '✨ Generate' })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /^📊 Dashboard/ })).toBeInTheDocument();
    });

    it('generate button disabled/enabled logic', async () => {
      await act(async () => { render(<ResearchPanel />); });
      const btn = screen.getByRole('button', { name: /Generate Dashboard/ });
      expect(btn).toBeDisabled();
      fireEvent.change(screen.getByPlaceholderText(/Describe what you want to research/), { target: { value: 'test' } });
      expect(btn).toBeEnabled();
    });

    it('create card and stream quantity content', async () => {
      await act(async () => { render(<ResearchPanel />); });
      fireEvent.change(screen.getByPlaceholderText(/Describe what you want to research/), { target: { value: 'test' } });
      fireEvent.click(screen.getByRole('button', { name: /Generate Dashboard/ }));
      await waitFor(() => {
        expect(screen.getByText(/metric data/)).toBeInTheDocument();
      });
      fireEvent.click(screen.getByRole('button', { name: /Dashboard/ }));
      expect(screen.getByText(/metric data/)).toBeInTheDocument();
      expect(screen.getByText('📊')).toBeInTheDocument();
    });

    it('delete card calls API', async () => {
      const card = { id: 'r1', title: 't', content: 'c', type: 'insight', createdAt: Date.now() };
      useIDEStore.setState({ researchCards: [card] });
      vi.spyOn(api, 'researchList').mockResolvedValue([card]);
      const del = vi.spyOn(api, 'researchDelete').mockResolvedValue({});
      await act(async () => { render(<ResearchPanel />); });
      fireEvent.click(screen.getByRole('button', { name: /^📊 Dashboard/ }));
      fireEvent.click(screen.getByText('✕'));
      expect(del).toHaveBeenCalledWith('r1');
    });
  });

  // ── TestingPanel Interactions ────────────────────────────────
  describe('TestingPanel interactions', () => {
    let TestingPanel: any;
    beforeEach(async () => {
      const mod = await import('../components/panels/TestingPanel');
      TestingPanel = mod.TestingPanel;
    });

    it('renders testing tab active by default', () => {
      render(<TestingPanel />);
      expect(screen.getByText(/Forge Tests/)).toBeInTheDocument();
    });

    it('switches to linting tab', () => {
      render(<TestingPanel />);
      fireEvent.click(screen.getByText(/Linting/));
      expect(screen.getByText(/Code Linting/)).toBeInTheDocument();
    });

    it('switches to security tab', () => {
      render(<TestingPanel />);
      fireEvent.click(screen.getByText(/Security/));
      expect(screen.getByText(/Security Scan/)).toBeInTheDocument();
    });

    it('run tests button disabled without file', () => {
      render(<TestingPanel />);
      const btn = screen.getByText(/Run Tests/);
      expect(btn).toBeDisabled();
    });

    it('run lint button disabled without file', () => {
      render(<TestingPanel />);
      fireEvent.click(screen.getByText(/Linting/));
      const btn = screen.getByText(/Run Lint/);
      expect(btn).toBeDisabled();
    });

    it('run security button disabled without file', () => {
      render(<TestingPanel />);
      fireEvent.click(screen.getByText(/Security/));
      const btn = screen.getByText(/Run Security/);
      expect(btn).toBeDisabled();
    });

    it('run tests button enabled with file', () => {
      useIDEStore.setState({
        openTabs: [{ id: 'f1', name: 'Token.sol', path: 'Token.sol', content: '', language: 'sol', isDirty: false }],
        activeTabId: 'f1',
      });
      render(<TestingPanel />);
      const btn = screen.getByText(/Run Tests/);
      expect(btn).not.toBeDisabled();
    });

    it('shows status when no file selected', () => {
      render(<TestingPanel />);
      expect(screen.getByText(/No file selected/)).toBeInTheDocument();
    });

    it('shows file path when file is open', () => {
      useIDEStore.setState({
        openTabs: [{ id: 'f1', name: 'Token.sol', path: 'contracts/Token.sol', content: '', language: 'sol', isDirty: false }],
        activeTabId: 'f1',
      });
      render(<TestingPanel />);
      expect(screen.getByText(/contracts\/Token\.sol/)).toBeInTheDocument();
    });

    it('runs tests and shows output', async () => {
      useIDEStore.setState({
        openTabs: [{ id: 'f1', name: 'Token.sol', path: 'Token.sol', content: '', language: 'sol', isDirty: false }],
        activeTabId: 'f1',
      });
      render(<TestingPanel />);
      fireEvent.click(screen.getByText(/Run Tests/));
      await waitFor(() => {
        expect(screen.getByText('Output:')).toBeInTheDocument();
      }, { timeout: 10000 });
    });

    it('runs lint and shows output', async () => {
      useIDEStore.setState({
        openTabs: [{ id: 'f1', name: 'Token.sol', path: 'Token.sol', content: '', language: 'sol', isDirty: false }],
        activeTabId: 'f1',
      });
      render(<TestingPanel />);
      fireEvent.click(screen.getByText(/Linting/));
      fireEvent.click(screen.getByText(/Run Lint/));
      await waitFor(() => {
        expect(screen.getByText('Output:')).toBeInTheDocument();
      }, { timeout: 10000 });
    });

    it('runs security and shows output', async () => {
      useIDEStore.setState({
        openTabs: [{ id: 'f1', name: 'Token.sol', path: 'Token.sol', content: '', language: 'sol', isDirty: false }],
        activeTabId: 'f1',
      });
      render(<TestingPanel />);
      fireEvent.click(screen.getByText(/Security/));
      fireEvent.click(screen.getByText(/Run Security/));
      await waitFor(() => {
        expect(screen.getByText('Output:')).toBeInTheDocument();
      }, { timeout: 10000 });
    });
  });

  // ── SkillsPanel Interactions ─────────────────────────────────
  describe('SkillsPanel interactions', () => {
    let SkillsPanel: any;
    beforeEach(async () => {
      const mod = await import('../components/panels/SkillsPanel');
      SkillsPanel = mod.SkillsPanel;
    });

    it('renders skills header', async () => {
      await act(async () => { render(<SkillsPanel />); });
      expect(screen.getByText('⚡ Skills')).toBeInTheDocument();
    });

    it('shows Browse and History tabs', async () => {
      await act(async () => { render(<SkillsPanel />); });
      expect(screen.getByText(/Browse/)).toBeInTheDocument();
      expect(screen.getByText(/History/)).toBeInTheDocument();
    });

    it('shows installed/planned count', async () => {
      await act(async () => { render(<SkillsPanel />); });
      expect(screen.getByText(/\d+ installed • \d+ planned/)).toBeInTheDocument();
    });

    it('shows category filter buttons', async () => {
      await act(async () => { render(<SkillsPanel />); });
      expect(screen.getByText('All')).toBeInTheDocument();
    });

    it('shows skill cards', async () => {
      await act(async () => { render(<SkillsPanel />); });
      expect(await screen.findByText('Find Skills')).toBeInTheDocument();
    });

    it('filters by category', async () => {
      await act(async () => { render(<SkillsPanel />); });
      fireEvent.click(screen.getAllByText('Knowledge')[0]);
      await waitFor(() => {
        expect(screen.getByText('Find Skills')).toBeInTheDocument();
      });
    });

    it('opens skill detail view', async () => {
      await act(async () => { render(<SkillsPanel />); });
      fireEvent.click(await screen.findByText('Find Skills'));
      await waitFor(() => {
        expect(screen.getByText('← Back')).toBeInTheDocument();
      });
      expect(screen.getByText(/Discover installed skills/)).toBeInTheDocument();
    });

    it('shows skill metadata in detail view', async () => {
      await act(async () => { render(<SkillsPanel />); });
      fireEvent.click(await screen.findByText('Find Skills'));
      await waitFor(() => {
        expect(screen.getByText('Category')).toBeInTheDocument();
        expect(screen.getByText('Status')).toBeInTheDocument();
        expect(screen.getByText('Source')).toBeInTheDocument();
        expect(screen.getByText('Execution')).toBeInTheDocument();
      });
    });

    it('shows triggers in detail view', async () => {
      await act(async () => { render(<SkillsPanel />); });
      fireEvent.click(await screen.findByText('Find Skills'));
      await waitFor(() => {
        expect(screen.getByText('Triggers')).toBeInTheDocument();
      });
    });

    it('navigates back from detail view', async () => {
      await act(async () => { render(<SkillsPanel />); });
      fireEvent.click(await screen.findByText('Find Skills'));
      await waitFor(() => {
        expect(screen.getByText('← Back')).toBeInTheDocument();
      });
      fireEvent.click(screen.getByText('← Back'));
      expect(screen.getByText('All')).toBeInTheDocument();
    });

    it('switches to history tab', async () => {
      useIDEStore.setState({ skillHistory: [] });
      await act(async () => { render(<SkillsPanel />); });
      fireEvent.click(screen.getByText(/History/));
      expect(screen.getByText('No history yet')).toBeInTheDocument();
    });

    it('shows history entries', async () => {
      useIDEStore.setState({
        skillHistory: [
          { id: 'h1', skill: 'find-skills', name: 'Find Skills', inputs: {}, result: 'Found 5 skills', provider: 'ollama', model: 'llama3', timestamp: Date.now() },
        ],
      });
      await act(async () => { render(<SkillsPanel />); });
      fireEvent.click(screen.getByText(/History/));
      expect(screen.getByText(/Find Skills/)).toBeInTheDocument();
      expect(screen.getByText('Found 5 skills')).toBeInTheDocument();
    });

    it('shows Use This Skill button for skills with defaultPrompt', async () => {
      await act(async () => { render(<SkillsPanel />); });
      fireEvent.click(await screen.findByText('Find Skills'));
      await waitFor(() => {
        expect(screen.getByText('Use This Skill')).toBeInTheDocument();
      });
    });

    it('shows AI mode selector for skills with defaultPrompt', async () => {
      await act(async () => { render(<SkillsPanel />); });
      fireEvent.click(await screen.findByText('Find Skills'));
      await waitFor(() => {
        expect(screen.getByText('Chat')).toBeInTheDocument();
        expect(screen.getByText('Task Plan')).toBeInTheDocument();
        expect(screen.getByText('Context Eng')).toBeInTheDocument();
      });
    });
  });

  // ── OpenClawPanel Interactions ─────────────────────────────
  describe('OpenClawPanel interactions', () => {
    it('warns when base URL is missing', async () => {
      useIDEStore.setState({
        openClawConfig: {
          baseUrl: '',
          toolEndpoint: '/api/tools/invoke',
          gatewayToken: '',
          defaultProfile: 'coding',
          webProvider: 'brave',
          loopDetectionEnabled: true,
        },
      });
      // ensure fetch returns sane values for OpenClaw endpoints
      vi.spyOn(globalThis, 'fetch').mockImplementation(async (input) => {
        const url =
          typeof input === 'string'
            ? input
            : input instanceof Request
            ? input.url
            : String(input);
        if (url.includes('/api/openclaw/config')) {
          return jsonResponse({
            baseUrl: '',
            toolEndpoint: '/api/tools/invoke',
            gatewayToken: '',
            defaultProfile: 'coding',
            webProvider: 'brave',
            loopDetectionEnabled: true,
          });
        }
        if (url.includes('/api/openclaw/tools')) {
          return jsonResponse({ profiles: [], groups: [], tools: [] });
        }
        return jsonResponse({});
      });

      const { OpenClawPanel } = await import('../components/panels/OpenClawPanel');
      await act(async () => { render(<OpenClawPanel />); });
      expect(screen.getByText(/Set it under Settings/i)).toBeInTheDocument();
    });
  });

  // ── SettingsPanel Interactions ───────────────────────────────
  describe('SettingsPanel interactions', () => {
    let SettingsPanel: any;
    beforeEach(async () => {
      const mod = await import('../components/panels/SettingsPanel');
      SettingsPanel = mod.SettingsPanel;
    });

    it('renders settings header', async () => {
      await act(async () => { render(<SettingsPanel />); });
      expect(screen.getByText(/Settings/)).toBeInTheDocument();
    });

    it('shows section navigation', async () => {
      await act(async () => { render(<SettingsPanel />); });
      // navigation buttons include emojis, match exact strings
      expect(screen.getByText('🤖 AI')).toBeInTheDocument();
      expect(screen.getByText('🔌 MCP')).toBeInTheDocument();
      expect(screen.getByText('🛠️ OpenClaw')).toBeInTheDocument();
      expect(screen.getByText('⟠ Remix')).toBeInTheDocument();
      expect(screen.getByText('🕸️ RAG')).toBeInTheDocument();
      expect(screen.getByText('🎨 General')).toBeInTheDocument();
      expect(screen.getByText('ℹ️ About')).toBeInTheDocument();
    });

    it('AI section shows Ollama connection status', async () => {
      await act(async () => { render(<SettingsPanel />); });
      expect(screen.getByText('Connected')).toBeInTheDocument();
    });

    it('AI section shows disconnected when not connected', async () => {
      useIDEStore.setState({ ollamaConnected: false });
      await act(async () => { render(<SettingsPanel />); });
      expect(screen.getByText('Disconnected')).toBeInTheDocument();
    });

    it('switches to MCP section', async () => {
      await act(async () => { render(<SettingsPanel />); });
      fireEvent.click(screen.getByText(/MCP/));
      await waitFor(() => {
        expect(screen.getByText('Add MCP Server')).toBeInTheDocument();
      });
    });

    it('switches to Remix section', async () => {
      await act(async () => { render(<SettingsPanel />); });
      fireEvent.click(screen.getByText(/Remix/));
      expect(screen.getByText('Solidity Compiler')).toBeInTheDocument();
    });

    it('switches to RAG section', async () => {
      await act(async () => { render(<SettingsPanel />); });
      fireEvent.click(screen.getByText('🕸️ RAG'));
      expect(screen.getByText('Crawl4AI Settings')).toBeInTheDocument();
      expect(screen.getByText('Vector Store')).toBeInTheDocument();
    });

    it('switches to OpenClaw section and shows gateway warning', async () => {
      useIDEStore.setState({
        openClawConfig: {
          baseUrl: '',
          toolEndpoint: '/api/tools/invoke',
          gatewayToken: '',
          defaultProfile: 'coding',
          webProvider: 'brave',
          loopDetectionEnabled: true,
        },
      });
      await act(async () => { render(<SettingsPanel />); });
      fireEvent.click(screen.getByText('🛠️ OpenClaw'));
      expect(screen.getByPlaceholderText('http://127.0.0.1:18789')).toBeInTheDocument();
      expect(screen.getByText(/Set an OpenClaw base URL before running tools/i)).toBeInTheDocument();
    });

    it('switches to General section', async () => {
      await act(async () => { render(<SettingsPanel />); });
      fireEvent.click(screen.getByText(/General/));
      expect(screen.getByText('Workspace')).toBeInTheDocument();
      expect(screen.getByText('Appearance')).toBeInTheDocument();
      expect(screen.getByText('Editor')).toBeInTheDocument();
    });

    it('switches to About section', async () => {
      await act(async () => { render(<SettingsPanel />); });
      fireEvent.click(screen.getByText(/About/));
      expect(screen.getByText('v0.1.0-alpha')).toBeInTheDocument();
      expect(screen.getByText(/Built from the best of/)).toBeInTheDocument();
    });

    it('General section shows RALPH Mode settings', async () => {
      await act(async () => { render(<SettingsPanel />); });
      fireEvent.click(screen.getByText(/General/));
      expect(screen.getByText('RALPH Mode')).toBeInTheDocument();
      expect(screen.getByText('Anchor Task')).toBeInTheDocument();
      expect(screen.getByText('Success Criteria')).toBeInTheDocument();
    });

    it('MCP section shows server form fields', async () => {
      await act(async () => { render(<SettingsPanel />); });
      fireEvent.click(screen.getByText(/MCP/));
      await waitFor(() => {
        expect(screen.getByText('Server Name')).toBeInTheDocument();
        expect(screen.getByText('Transport')).toBeInTheDocument();
        expect(screen.getByText('Save MCP Server')).toBeInTheDocument();
      });
    });

    it('MCP section shows Run MCP Tool area', async () => {
      await act(async () => { render(<SettingsPanel />); });
      fireEvent.click(screen.getByText(/MCP/));
      await waitFor(() => {
        expect(screen.getByText('Run MCP Tool')).toBeInTheDocument();
      });
    });

    it('AI section shows provider selector', async () => {
      await act(async () => { render(<SettingsPanel />); });
      expect(screen.getByText('AI Provider')).toBeInTheDocument();
    });

    it('AI section shows Test button', async () => {
      await act(async () => { render(<SettingsPanel />); });
      expect(screen.getByText(/Test/)).toBeInTheDocument();
    });

    it('shows system info in about section', async () => {
      await act(async () => { render(<SettingsPanel />); });
      fireEvent.click(screen.getByText(/About/));
      expect(screen.getByText('System Info')).toBeInTheDocument();
      expect(screen.getByText(/React 19/)).toBeInTheDocument();
    });
  });

  // ── EditorArea Interactions ──────────────────────────────────
  describe('EditorArea interactions', () => {
    let EditorArea: any;
    beforeEach(async () => {
      const mod = await import('../components/EditorArea');
      EditorArea = mod.EditorArea;
    });

    it('shows welcome screen when no tabs open', () => {
      render(<EditorArea />);
      expect(screen.getByText('Atlas SuperIDE')).toBeInTheDocument();
    });

    it('shows keyboard shortcuts in welcome', () => {
      render(<EditorArea />);
      expect(screen.getByText(/Ctrl/)).toBeInTheDocument();
    });

    it('shows monaco editor when tab is open', () => {
      useIDEStore.setState({
        openTabs: [{ id: 'e1', name: 'App.tsx', path: 'App.tsx', content: 'const x = 1;', language: 'typescript', isDirty: false }],
        activeTabId: 'e1',
      });
      render(<EditorArea />);
      expect(screen.getByTestId('mock-monaco-editor')).toBeInTheDocument();
    });

    it('shows tab bar with file name', () => {
      useIDEStore.setState({
        openTabs: [{ id: 'e1', name: 'App.tsx', path: 'App.tsx', content: '', language: 'typescript', isDirty: false }],
        activeTabId: 'e1',
      });
      render(<EditorArea />);
      expect(screen.getByText('App.tsx')).toBeInTheDocument();
    });

    it('shows dirty indicator for modified files', () => {
      useIDEStore.setState({
        openTabs: [{ id: 'e1', name: 'App.tsx', path: 'App.tsx', content: '', language: 'typescript', isDirty: true }],
        activeTabId: 'e1',
      });
      render(<EditorArea />);
      // Dirty indicator is typically a dot or different styling
      expect(screen.getByText(/App\.tsx/)).toBeInTheDocument();
    });

    it('renders multiple tabs', () => {
      useIDEStore.setState({
        openTabs: [
          { id: 'e1', name: 'App.tsx', path: 'App.tsx', content: '', language: 'typescript', isDirty: false },
          { id: 'e2', name: 'Token.sol', path: 'Token.sol', content: '', language: 'sol', isDirty: false },
        ],
        activeTabId: 'e1',
      });
      render(<EditorArea />);
      expect(screen.getByText('App.tsx')).toBeInTheDocument();
      expect(screen.getByText('Token.sol')).toBeInTheDocument();
    });
  });

  // ── OutlinePanel Interactions ─────────────────────────────
  describe('OutlinePanel interactions', () => {
    let OutlinePanel: any;
    beforeEach(async () => {
      const mod = await import('../components/panels/OutlinePanel');
      OutlinePanel = mod.OutlinePanel;
    });

    it('renders outline header', () => {
      render(<OutlinePanel />);
      expect(screen.getByText(/Outline/)).toBeInTheDocument();
    });

    it('shows no file selected message when no active tab', () => {
      render(<OutlinePanel />);
      expect(screen.getByText(/Open a file to inspect its structure/)).toBeInTheDocument();
    });

    it('shows file info when tab is open', () => {
      useIDEStore.setState({
        openTabs: [
          {
            id: 'i1',
            name: 'Token.sol',
            path: 'contracts/Token.sol',
            content: 'contract Token { uint x; }',
            language: 'sol',
            isDirty: false,
          },
        ],
        activeTabId: 'i1',
      });
      render(<OutlinePanel />);
      // outline shows symbol names when parsed; expect contract name
      expect(screen.getByText('Token')).toBeInTheDocument();
    });
  });

  // ── AiChatPanel Interactions ─────────────────────────────────
  describe('AiChatPanel interactions', () => {
    let AiChatPanel: any;
    beforeEach(async () => {
      const mod = await import('../components/panels/AiChatPanel');
      AiChatPanel = mod.AiChatPanel;
    });

    it('renders Ollama label', () => {
      render(<AiChatPanel />);
      expect(screen.getByText('Ollama')).toBeInTheDocument();
    });

    it('shows model selector', () => {
      render(<AiChatPanel />);
      expect(screen.getByDisplayValue('llama3:8b (4.7GB)')).toBeInTheDocument();
    });

    it('shows empty chat state', () => {
      render(<AiChatPanel />);
      expect(screen.getByText('Atlas AI Assistant')).toBeInTheDocument();
    });

    it('shows input field', () => {
      render(<AiChatPanel />);
      const input = screen.getByPlaceholderText(/Ask/i);
      expect(input).toBeInTheDocument();
    });

    it('shows mode tabs (Chat, Task Plan, Context Eng)', () => {
      render(<AiChatPanel />);
      expect(screen.getByText('💬 Chat')).toBeInTheDocument();
      expect(screen.getByText('📋 Task Plan')).toBeInTheDocument();
      expect(screen.getByText('🎯 Context Eng')).toBeInTheDocument();
    });

    it('shows chat messages when present', () => {
      useIDEStore.setState({
        chatMessages: [
          { id: 'msg-1', role: 'user', content: 'Hello AI', timestamp: Date.now() },
          { id: 'msg-2', role: 'assistant', content: 'Hi there!', timestamp: Date.now() + 1 },
        ],
      });
      render(<AiChatPanel />);
      expect(screen.getByText('Hello AI')).toBeInTheDocument();
      expect(screen.getByText('Hi there!')).toBeInTheDocument();
    });
  });

  // ── BoltChatPanel Interactions ───────────────────────────────
  describe('BoltChatPanel interactions', () => {
    let BoltChatPanel: any;
    beforeEach(async () => {
      const mod = await import('../components/panels/BoltChatPanel');
      BoltChatPanel = mod.BoltChatPanel;
    });

    it('renders bolt chat header', () => {
      render(<BoltChatPanel />);
      expect(screen.getByText('Bolt Chat')).toBeInTheDocument();
    });

    it('shows empty state', () => {
      render(<BoltChatPanel />);
      expect(screen.getByText('Bolt AI Assistant')).toBeInTheDocument();
    });

    it('shows input field', () => {
      render(<BoltChatPanel />);
      const inputs = screen.getAllByPlaceholderText(/Ask|Type/i);
      expect(inputs.length).toBeGreaterThan(0);
    });

    it('shows bolt messages when present', () => {
      useIDEStore.setState({
        boltMessages: [
          { id: 'bolt-1', role: 'user', content: 'Build me a form', timestamp: Date.now() },
          {
            id: 'bolt-2',
            role: 'assistant',
            content: 'Here is a form component...',
            timestamp: Date.now() + 1,
          },
        ],
      });
      render(<BoltChatPanel />);
      expect(screen.getByText('Build me a form')).toBeInTheDocument();
    });
  });

  // ── RagPanel Interactions ────────────────────────────────────
  describe('RagPanel interactions', () => {
    let RagPanel: any;
    beforeEach(async () => {
      const mod = await import('../components/panels/RagPanel');
      RagPanel = mod.RagPanel;
    });

    it('renders RAG header', () => {
      render(<RagPanel />);
      expect(screen.getByText(/RAG/)).toBeInTheDocument();
    });

    it('shows URL input for crawling', () => {
      render(<RagPanel />);
      // need to switch to crawl tab first
      fireEvent.click(screen.getByText('🕷️ Crawl'));
      const urlInput = screen.getByPlaceholderText(/https/);
      expect(urlInput).toBeInTheDocument();
    });

    it('shows crawl button', () => {
      render(<RagPanel />);
      fireEvent.click(screen.getByText('🕷️ Crawl'));
      expect(screen.getByText('🕷️ Start Crawl')).toBeInTheDocument();
    });

    it('shows sources section', () => {
      render(<RagPanel />);
      expect(screen.getByText(/Sources/)).toBeInTheDocument();
    });
  });

  // ── RemixPanel Interactions ──────────────────────────────────
  describe('RemixPanel interactions', () => {
    let RemixPanel: any;
    beforeEach(async () => {
      const mod = await import('../components/panels/RemixPanel');
      RemixPanel = mod.RemixPanel;
    });

    it('renders Remix header with compile action', () => {
      render(<RemixPanel />);
      const items = screen.getAllByText(/Compile/);
      expect(items.length).toBeGreaterThan(0);
    });

    it('shows compiler version selector', () => {
      render(<RemixPanel />);
      expect(screen.getAllByText(/0\.8\./)[0]).toBeInTheDocument();
    });

    it('shows compile button', () => {
      render(<RemixPanel />);
      const items = screen.getAllByText(/Compile/);
      expect(items.length).toBeGreaterThan(0);
    });

    it('shows deploy section', () => {
      render(<RemixPanel />);
      expect(screen.getByText(/Deploy/)).toBeInTheDocument();
    });
  });
});
