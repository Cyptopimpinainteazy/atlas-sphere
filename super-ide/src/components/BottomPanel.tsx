import { useEffect, useRef, useState } from 'react';
import { Terminal as XTerm } from 'xterm';
import { FitAddon } from 'xterm-addon-fit';
import 'xterm/css/xterm.css';
import {
  getTerminalWebSocketUrl,
  terminalCloseSession,
  terminalCreateSession,
} from '../lib/api';
import { useIDEStore } from '../store/ideStore';

type BottomTab = 'terminal' | 'output' | 'problems' | 'rag-results';

export function BottomPanel() {
  const {
    ragResults,
    openTabs,
    activeTabId,
    workspaceRoot,
    availableModels,
    ollamaConnected,
    ollamaUrl,
    terminalTranscript,
    appendTerminalTranscript,
    clearTerminalTranscript,
    lastBuildOrTestCommand,
    recordTerminalCommand,
  } = useIDEStore();
  const [activeTab, setActiveTab] = useState<BottomTab>('terminal');
  const [terminalSessionId, setTerminalSessionId] = useState<string | null>(null);
  const [terminalCwd, setTerminalCwd] = useState(workspaceRoot);
  const [terminalTransport, setTerminalTransport] = useState<'pty' | 'pipe'>('pipe');
  const [terminalConnected, setTerminalConnected] = useState(false);
  const [terminalError, setTerminalError] = useState<string | null>(null);
  const terminalHostRef = useRef<HTMLDivElement>(null);
  const xtermRef = useRef<XTerm | null>(null);
  const fitAddonRef = useRef<FitAddon | null>(null);
  const socketRef = useRef<WebSocket | null>(null);
  const sessionIdRef = useRef<string | null>(null);
  const pendingCommandRef = useRef('');
  const isUnmountingRef = useRef(false);

  const trackTerminalInput = (data: string) => {
    for (const char of data) {
      if (char === '\r' || char === '\n') {
        const command = pendingCommandRef.current.trim();
        if (command) {
          recordTerminalCommand(command);
        }
        pendingCommandRef.current = '';
        continue;
      }

      if (char === '\u007f') {
        pendingCommandRef.current = pendingCommandRef.current.slice(0, -1);
        continue;
      }

      if (char === '\u0015' || char === '\u001b') {
        pendingCommandRef.current = '';
        continue;
      }

      if (char >= ' ') {
        pendingCommandRef.current += char;
      }
    }
  };

  useEffect(() => {
    if (!terminalHostRef.current || xtermRef.current) {
      return;
    }
    isUnmountingRef.current = false;

    const terminal = new XTerm({
      cursorBlink: true,
      convertEol: true,
      fontSize: 12,
      fontFamily: 'JetBrains Mono, monospace',
      theme: {
        background: '#0f172a',
        foreground: '#e5e7eb',
      },
    });
    const fitAddon = new FitAddon();
    terminal.loadAddon(fitAddon);
    terminal.open(terminalHostRef.current);
    fitAddon.fit();
    if (terminalTranscript) {
      terminal.write(terminalTranscript);
      terminal.writeln('\r\n[restored transcript]');
    }
    terminal.writeln('Connecting to backend shell...');

    xtermRef.current = terminal;
    fitAddonRef.current = fitAddon;

    let resizeHandler: (() => void) | null = null;
    let dataDisposable: { dispose: () => void } | null = null;

    const connect = async () => {
      try {
        const session = await terminalCreateSession(workspaceRoot);
        setTerminalSessionId(session.session_id);
        sessionIdRef.current = session.session_id;
        setTerminalCwd(session.cwd);
        setTerminalTransport(session.transport);

        const socket = new WebSocket(getTerminalWebSocketUrl(session.session_id));
        socketRef.current = socket;

        resizeHandler = () => {
          fitAddon.fit();
          if (socket.readyState === WebSocket.OPEN) {
            socket.send(JSON.stringify({
              type: 'resize',
              cols: terminal.cols,
              rows: terminal.rows,
            }));
          }
        };
        window.addEventListener('resize', resizeHandler);

        socket.addEventListener('open', () => {
          setTerminalConnected(true);
          setTerminalError(null);
          if (resizeHandler) {
            resizeHandler();
          }
        });

        socket.addEventListener('message', (event) => {
          const payload = typeof event.data === 'string' ? event.data : '';
          terminal.write(payload);
          appendTerminalTranscript(payload);
        });

        socket.addEventListener('close', () => {
          setTerminalConnected(false);
          if (isUnmountingRef.current) {
            return;
          }
          const note = '\r\n[terminal disconnected]';
          terminal.writeln(note);
          appendTerminalTranscript(`${note}\n`);
        });

        socket.addEventListener('error', () => {
          setTerminalError('Terminal stream failed.');
          const note = '\r\n[terminal error]';
          terminal.writeln(note);
          appendTerminalTranscript(`${note}\n`);
        });

        dataDisposable = terminal.onData((data) => {
          trackTerminalInput(data);
          if (socket.readyState === WebSocket.OPEN) {
            socket.send(JSON.stringify({ type: 'input', data }));
          }
        });
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Failed to start terminal session.';
        setTerminalError(message);
        terminal.writeln(`\r\n[error] ${message}`);
        appendTerminalTranscript(`\r\n[error] ${message}\n`);
      }
    };

    void connect();

    return () => {
      dataDisposable?.dispose();
      if (resizeHandler) {
        window.removeEventListener('resize', resizeHandler);
      }
      if (socketRef.current) {
        isUnmountingRef.current = true;
        socketRef.current.close();
        socketRef.current = null;
      }
      if (sessionIdRef.current) {
        void terminalCloseSession(sessionIdRef.current).catch(() => undefined);
        sessionIdRef.current = null;
      }
      fitAddonRef.current = null;
      xtermRef.current?.dispose();
      xtermRef.current = null;
    };
  }, []);

  const handleStopTerminal = () => {
    const socket = socketRef.current;
    if (!socket || socket.readyState !== WebSocket.OPEN) {
      return;
    }
    socket.send(JSON.stringify({ type: 'signal', signal: 'INT' }));
  };

  const handleClearTerminal = () => {
    pendingCommandRef.current = '';
    clearTerminalTranscript();
    xtermRef.current?.clear();
  };

  const handleRerunLastBuild = () => {
    const socket = socketRef.current;
    if (!socket || socket.readyState !== WebSocket.OPEN || !lastBuildOrTestCommand) {
      return;
    }

    pendingCommandRef.current = '';
    socket.send(JSON.stringify({ type: 'input', data: `${lastBuildOrTestCommand}\n` }));
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
    terminalError
      ? { severity: 'error' as const, message: terminalError, file: 'Terminal' }
      : null,
    terminalTransport === 'pipe'
      ? { severity: 'warning' as const, message: 'PTY unavailable; terminal is running in pipe fallback mode', file: 'Terminal' }
      : null,
  ].filter(Boolean) as Array<{ severity: 'error' | 'warning' | 'info'; message: string; file: string }>;

  const activeEditorTab = openTabs.find((tab) => tab.id === activeTabId);

  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center justify-between bg-ide-surface border-b border-ide-border">
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

        {activeTab === 'terminal' && (
          <div className="flex items-center gap-2 px-2 text-[10px] text-ide-text-dim">
            <span>{terminalConnected ? `${terminalTransport} shell` : 'connecting'}</span>
            {lastBuildOrTestCommand && (
              <button onClick={handleRerunLastBuild} className="hover:text-emerald-300">
                Rerun
              </button>
            )}
            <button onClick={handleClearTerminal} className="hover:text-ide-text">
              Clear
            </button>
            <button onClick={handleStopTerminal} className="hover:text-red-300">
              Stop
            </button>
          </div>
        )}
      </div>

      <div className="flex-1 overflow-y-auto bg-ide-bg min-h-0">
        {activeTab === 'terminal' && (
          <div className="h-full flex flex-col min-h-0">
            <div className="px-2 py-1 border-b border-ide-border text-[10px] text-ide-text-dim flex items-center justify-between">
              <span>Session: {terminalSessionId || 'starting...'}</span>
              <span>Root: {terminalCwd}</span>
            </div>
            <div ref={terminalHostRef} className="flex-1 min-h-0 p-1" />
          </div>
        )}

        {activeTab === 'output' && (
          <div className="p-3 text-xs text-ide-text-dim font-mono space-y-1">
            <p>[Atlas SuperIDE] Frontend: http://localhost:3421</p>
            <p>[Atlas SuperIDE] Backend: http://localhost:8420</p>
            <p>[Terminal] Session: {terminalSessionId || 'starting...'}</p>
            <p>[Terminal] Mode: {terminalConnected ? `${terminalTransport.toUpperCase()} stream connected` : 'connecting'}</p>
            <p>[Terminal] Root: {terminalCwd}</p>
            <p>[Terminal] Last build/test: {lastBuildOrTestCommand || 'none'}</p>
            <p>[Terminal] Transcript chars: {terminalTranscript.length}</p>
            <p>[Workspace] Root: {workspaceRoot}</p>
            <p>[Workspace] Active file: {activeEditorTab?.path || 'none'}</p>
            <p>[AI] Ollama: {ollamaConnected ? 'connected' : 'disconnected'} ({ollamaUrl})</p>
            <p>[AI] Model count: {availableModels.length}</p>
            {terminalTranscript && (
              <div className="mt-3 rounded border border-ide-border bg-ide-surface p-2">
                <p className="mb-1 text-[10px] uppercase tracking-wider text-ide-text-dim">Recent Transcript</p>
                <pre className="max-h-48 overflow-y-auto whitespace-pre-wrap text-[10px] text-ide-text">
                  {terminalTranscript.slice(-2000)}
                </pre>
              </div>
            )}
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
