import { useState, useEffect, useRef } from 'react';
import {
  getWorkspaceTree,
  openWorkspaceFile,
  searchCodebase,
  searchWorkspaceFiles,
} from '../lib/api';
import { useIDEStore, type FileTab } from '../store/ideStore';

type BottomTab = 'terminal' | 'output' | 'problems' | 'rag-results';

function getLanguageFromName(name: string): string {
  const ext = name.split('.').pop()?.toLowerCase();
  const map: Record<string, string> = {
    sol: 'sol',
    ts: 'typescript',
    tsx: 'typescriptreact',
    js: 'javascript',
    jsx: 'javascriptreact',
    json: 'json',
    md: 'markdown',
    py: 'python',
    rs: 'rust',
    toml: 'toml',
    yaml: 'yaml',
    yml: 'yaml',
    css: 'css',
    html: 'html',
    sh: 'shell',
  };
  return map[ext || ''] || 'plaintext';
}

function normalizeRoot(value: string): string {
  const trimmed = value.trim();
  if (!trimmed || trimmed === './') {
    return '.';
  }

  const withoutLeading = trimmed.replace(/^\.\//, '');
  const normalized = withoutLeading.replace(/\/+$/, '');
  return normalized || '.';
}

function resolveWorkspacePath(base: string, input: string): string {
  const normalizedBase = normalizeRoot(base);
  const trimmed = input.trim();
  if (!trimmed || trimmed === '.') {
    return normalizedBase;
  }

  const segments =
    normalizedBase === '.' || trimmed.startsWith('/')
      ? []
      : normalizedBase.split('/').filter(Boolean);

  trimmed
    .replace(/^\//, '')
    .split('/')
    .filter(Boolean)
    .forEach((segment) => {
      if (segment === '.') {
        return;
      }
      if (segment === '..') {
        segments.pop();
        return;
      }
      segments.push(segment);
    });

  return segments.length ? segments.join('/') : '.';
}

function buildTerminalBanner(root: string): string[] {
  return [
    'Atlas workspace terminal',
    `Working root: ${root}`,
    'Type `help` for workspace commands.',
    '',
  ];
}

export function BottomPanel() {
  const {
    ragResults,
    openTabs,
    activeTabId,
    workspaceRoot,
    setWorkspaceRoot,
    favoriteWorkspaceRoots,
    pinnedFiles,
    addPinnedFile,
    removePinnedFile,
    availableModels,
    ollamaConnected,
    ollamaUrl,
    chatModel,
    ragSources,
    knowledgeEntries,
    chatMessages,
    openTab,
  } = useIDEStore();
  const [activeTab, setActiveTab] = useState<BottomTab>('terminal');
  const [terminalLines, setTerminalLines] = useState<string[]>(() => buildTerminalBanner(workspaceRoot));
  const [terminalInput, setTerminalInput] = useState('');
  const [commandHistory, setCommandHistory] = useState<string[]>([]);
  const [historyIndex, setHistoryIndex] = useState(-1);
  const terminalRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    terminalRef.current?.scrollTo({ top: terminalRef.current.scrollHeight });
  }, [terminalLines]);

  useEffect(() => {
    setTerminalLines((prev) => {
      if (prev.length === 0) {
        return buildTerminalBanner(workspaceRoot);
      }
      const nextLines = [...prev];
      nextLines[1] = `Working root: ${workspaceRoot}`;
      return nextLines;
    });
  }, [workspaceRoot]);

  const appendTerminalOutput = (lines: string[]) => {
    setTerminalLines((prev) => [...prev, ...lines, '']);
  };

  const openFileTab = async (path: string) => {
    const data = await openWorkspaceFile(path);
    const tab: FileTab = {
      id: path,
      name: path.split('/').pop() || path,
      path,
      language: getLanguageFromName(path),
      content: data.content,
      isDirty: false,
    };
    openTab(tab);
  };

  const runTerminalCommand = async (rawCommand: string): Promise<string[] | null> => {
    const [command, ...rest] = rawCommand.split(' ');
    const argText = rest.join(' ').trim();

    switch (command) {
      case 'help':
        return [
          'Workspace commands:',
          '  help              Show this help',
          '  clear             Reset terminal output',
          '  pwd               Show the current workspace root',
          '  cd <path>         Change the shared workspace root',
          '  ls [path]         List entries under a workspace path',
          '  open <file>       Open a file in the editor',
          '  tabs              List open editor tabs',
          '  search <query>    Search file paths under the current root',
          '  grep <query>      Search code content under the current root',
          '  pin <file>        Pin a file in Explorer',
          '  unpin <file>      Remove a pinned file',
          '  pins              List pinned files',
          '  roots             List favorite workspace roots',
          '  status            Show live IDE status',
          '  models            List discovered chat models',
          '  version           Show current version',
        ];
      case 'clear':
        setTerminalLines(buildTerminalBanner(workspaceRoot));
        return null;
      case 'pwd':
        return [workspaceRoot];
      case 'cd': {
        const nextRoot = resolveWorkspacePath(workspaceRoot, argText || '.');
        setWorkspaceRoot(nextRoot);
        return [`Workspace root set to ${nextRoot}`];
      }
      case 'ls': {
        const targetRoot = resolveWorkspacePath(workspaceRoot, argText || '.');
        const entries = await getWorkspaceTree(targetRoot);
        if (entries.length === 0) {
          return [`No entries under ${targetRoot}`];
        }
        const rendered = entries.slice(0, 40).map((entry) => {
          const prefix = entry.type === 'dir' ? 'd' : 'f';
          return `${prefix} ${entry.name}`;
        });
        if (entries.length > 40) {
          rendered.push(`... ${entries.length - 40} more`);
        }
        return [`Listing ${targetRoot}:`, ...rendered];
      }
      case 'open': {
        if (!argText) {
          return ['Usage: open <file>'];
        }
        const targetPath = resolveWorkspacePath(workspaceRoot, argText);
        await openFileTab(targetPath);
        return [`Opened ${targetPath}`];
      }
      case 'tabs':
        if (openTabs.length === 0) {
          return ['No files open.'];
        }
        return openTabs.map((tab) => `${tab.id === activeTabId ? '*' : ' '} ${tab.path}`);
      case 'search': {
        if (!argText) {
          return ['Usage: search <query>'];
        }
        const results = await searchWorkspaceFiles(argText, workspaceRoot, 8);
        if (results.length === 0) {
          return [`No file matches for "${argText}" under ${workspaceRoot}`];
        }
        return results.map((result) => result.path);
      }
      case 'grep': {
        if (!argText) {
          return ['Usage: grep <query>'];
        }
        const results = await searchCodebase(argText, workspaceRoot, 5);
        if (results.length === 0) {
          return [`No code matches for "${argText}" under ${workspaceRoot}`];
        }
        return results.map((result) => `${result.path}:${result.line} ${result.snippet.trim()}`);
      }
      case 'pin': {
        if (!argText) {
          return ['Usage: pin <file>'];
        }
        const targetPath = resolveWorkspacePath(workspaceRoot, argText);
        addPinnedFile(targetPath);
        return [`Pinned ${targetPath}`];
      }
      case 'unpin': {
        if (!argText) {
          return ['Usage: unpin <file>'];
        }
        const targetPath = resolveWorkspacePath(workspaceRoot, argText);
        removePinnedFile(targetPath);
        return [`Unpinned ${targetPath}`];
      }
      case 'pins':
        return pinnedFiles.length > 0 ? pinnedFiles : ['No pinned files.'];
      case 'roots':
        return favoriteWorkspaceRoots;
      case 'status':
        return [
          `Workspace root: ${workspaceRoot}`,
          `Pinned files: ${pinnedFiles.length}`,
          `Open tabs: ${openTabs.length}`,
          `Ollama: ${ollamaConnected ? 'connected' : 'disconnected'} (${ollamaUrl})`,
          `Models: ${availableModels.length}`,
          `Chat model: ${chatModel}`,
          `RAG sources: ${ragSources.length}`,
          `Knowledge entries: ${knowledgeEntries.length}`,
          `Chat messages: ${chatMessages.length}`,
        ];
      case 'models':
        return availableModels.length > 0
          ? availableModels.map((model) => `${model.name} (${model.size})`)
          : ['No models discovered.'];
      case 'version':
        return ['Atlas SuperIDE v0.1.0'];
      default:
        return [
          `Unknown command: ${command}`,
          'Type `help` to see supported workspace commands.',
        ];
    }
  };

  const handleTerminalCommand = async (cmd: string) => {
    const trimmed = cmd.trim();
    if (!trimmed) {
      return;
    }

    setTerminalLines((prev) => [...prev, `$ ${trimmed}`]);
    setCommandHistory((prev) => [...prev, trimmed]);
    setHistoryIndex(-1);
    setTerminalInput('');

    try {
      const output = await runTerminalCommand(trimmed);
      if (output && output.length > 0) {
        appendTerminalOutput(output);
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Command failed.';
      appendTerminalOutput([`Error: ${message}`]);
    }
  };

  const problems = [
    !ollamaConnected
      ? { severity: 'warning' as const, message: 'Ollama is not connected', file: 'AI runtime' }
      : null,
    availableModels.length === 0
      ? { severity: 'info' as const, message: 'No models discovered yet', file: 'Model discovery' }
      : null,
    openTabs.length === 0
      ? { severity: 'info' as const, message: 'No file open in the editor', file: 'Workspace' }
      : null,
  ].filter(Boolean) as Array<{ severity: 'error' | 'warning' | 'info'; message: string; file: string }>;

  const activeEditorTab = openTabs.find((tab) => tab.id === activeTabId);
  const lastCommand = commandHistory.length > 0 ? commandHistory[commandHistory.length - 1] : null;

  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center bg-ide-surface border-b border-ide-border">
        <div className="flex">
          {([
            { id: 'terminal', label: '⌘ Terminal' },
            { id: 'output', label: '📤 Output' },
            { id: 'problems', label: `⚠️ Problems (${problems.length})` },
            { id: 'rag-results', label: `🔍 RAG (${ragResults.length})` },
          ] as const).map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`tab-btn ${activeTab === tab.id ? 'active' : ''}`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      <div className="flex-1 overflow-y-auto bg-ide-bg">
        {activeTab === 'terminal' && (
          <div className="h-full flex flex-col font-mono text-xs">
            <div ref={terminalRef} className="flex-1 overflow-y-auto p-2 space-y-0">
              {terminalLines.map((line, i) => (
                <div key={`${i}-${line}`} className="text-ide-text whitespace-pre-wrap break-words">
                  {line}
                </div>
              ))}
            </div>
            <div className="flex items-center gap-1 px-2 py-1 border-t border-ide-border">
              <span className="text-green-400">$</span>
              <input
                value={terminalInput}
                onChange={(e) => setTerminalInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    void handleTerminalCommand(terminalInput);
                    return;
                  }

                  if (e.key === 'ArrowUp') {
                    if (commandHistory.length === 0) {
                      return;
                    }
                    e.preventDefault();
                    const nextIndex =
                      historyIndex < 0 ? commandHistory.length - 1 : Math.max(0, historyIndex - 1);
                    setHistoryIndex(nextIndex);
                    setTerminalInput(commandHistory[nextIndex]);
                    return;
                  }

                  if (e.key === 'ArrowDown') {
                    if (historyIndex < 0 || commandHistory.length === 0) {
                      return;
                    }
                    e.preventDefault();
                    const nextIndex = historyIndex + 1;
                    if (nextIndex >= commandHistory.length) {
                      setHistoryIndex(-1);
                      setTerminalInput('');
                      return;
                    }
                    setHistoryIndex(nextIndex);
                    setTerminalInput(commandHistory[nextIndex]);
                  }
                }}
                className="flex-1 bg-transparent border-none outline-none text-ide-text text-xs font-mono"
                placeholder="Type a workspace command..."
                autoFocus
              />
            </div>
          </div>
        )}

        {activeTab === 'output' && (
          <div className="p-3 text-xs text-ide-text-dim font-mono space-y-1">
            <p>[Atlas SuperIDE] Frontend: http://localhost:3420</p>
            <p>[Atlas SuperIDE] Backend: http://localhost:8420</p>
            <p>[Workspace] Root: {workspaceRoot}</p>
            <p>[Workspace] Active file: {activeEditorTab?.path || 'none'}</p>
            <p>[Workspace] Pinned files: {pinnedFiles.length}</p>
            <p>[AI] Ollama: {ollamaConnected ? 'connected' : 'disconnected'}</p>
            <p>[AI] Model count: {availableModels.length}</p>
            {lastCommand && <p>[Terminal] Last command: {lastCommand}</p>}
          </div>
        )}

        {activeTab === 'problems' && (
          <div className="p-2 space-y-1">
            {problems.length === 0 ? (
              <p className="text-xs text-ide-text-dim px-2 py-1">No active problems detected.</p>
            ) : (
              problems.map((problem, i) => (
                <div key={`${problem.file}-${i}`} className="flex items-center gap-2 text-xs px-2 py-1 hover:bg-ide-surface rounded">
                  <span
                    className={
                      problem.severity === 'error'
                        ? 'text-red-400'
                        : problem.severity === 'warning'
                        ? 'text-yellow-400'
                        : 'text-blue-300'
                    }
                  >
                    {problem.severity === 'error'
                      ? '❌'
                      : problem.severity === 'warning'
                      ? '⚠️'
                      : 'ℹ️'}
                  </span>
                  <span className="text-ide-text">{problem.message}</span>
                  <span className="text-ide-text-dim ml-auto">{problem.file}</span>
                </div>
              ))
            )}
          </div>
        )}

        {activeTab === 'rag-results' && (
          <div className="p-2 space-y-2">
            {ragResults.length === 0 ? (
              <p className="text-xs text-ide-text-dim p-2">
                No RAG results. Use the RAG panel to search crawled documentation.
              </p>
            ) : (
              ragResults.map((result, i) => (
                <div key={`${result.source}-${i}`} className="bg-ide-surface rounded border border-ide-border p-2">
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-[10px] text-ide-accent">{result.source}</span>
                    {result.score !== undefined && (
                      <span className="text-[10px] text-ide-text-dim">
                        {(result.score * 100).toFixed(0)}% match
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-ide-text line-clamp-3">{result.content}</p>
                </div>
              ))
            )}
          </div>
        )}
      </div>
    </div>
  );
}
