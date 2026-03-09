import { useIDEStore, type FileTab } from '../store/ideStore';
import { useEffect, useRef } from 'react';
import Editor from '@monaco-editor/react';
import type { editor as MonacoEditor } from 'monaco-editor';
import { saveWorkspaceFile } from '../lib/api';

function getLanguageFromPath(path: string): string {
  const ext = path.split('.').pop()?.toLowerCase();
  const langMap: Record<string, string> = {
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
  return langMap[ext || ''] || 'plaintext';
}

export function EditorArea() {
  const {
    openTabs,
    activeTabId,
    setActiveTab,
    closeTab,
    updateTabContent,
    setTabCursorLine,
    editorWordWrap,
    editorMinimap,
    setEditorCursorPosition,
    editorErrors,
  } = useIDEStore();
  const editorRef = useRef<MonacoEditor.IStandaloneCodeEditor | null>(null);
  const decorationIdsRef = useRef<string[]>([]);
  const cursorListenerRef = useRef<{ dispose: () => void } | null>(null);

  const activeTab = openTabs.find((t) => t.id === activeTabId);

  const syncCursorFromEditor = () => {
    const position = editorRef.current?.getPosition();
    if (!position) {
      return;
    }
    setEditorCursorPosition(position.lineNumber, position.column);
  };

  const applyPendingCursor = (tab: FileTab | undefined) => {
    if (!tab?.cursorLine || !editorRef.current) {
      return;
    }

    const targetLine = Math.max(1, tab.cursorLine);
    editorRef.current.revealLineInCenter(targetLine);
    editorRef.current.setPosition({ lineNumber: targetLine, column: 1 });
    setEditorCursorPosition(targetLine, 1);
    editorRef.current.focus();
    setTabCursorLine(tab.id, null);
  };

  const saveTab = async (tab: FileTab) => {
    try {
      await saveWorkspaceFile(tab.path, tab.content);
      useIDEStore.getState().markTabSaved(tab.id);
    } catch (err) {
      console.error('Save failed', err);
    }
  };

  // ctrl+s save
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 's') {
        e.preventDefault();
        if (activeTab && activeTab.isDirty) {
          saveTab(activeTab);
        }
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [activeTab]);

  useEffect(() => {
    if (activeTab?.cursorLine) {
      applyPendingCursor(activeTab);
      return;
    }
    syncCursorFromEditor();
  }, [activeTab, setEditorCursorPosition, setTabCursorLine]);

  // Apply inline error squiggles from test/lint results
  useEffect(() => {
    if (!editorRef.current || !activeTab) {
      return;
    }

    const relatedErrors = editorErrors.filter((e) => e.filePath === activeTab.path);

    const newDecorations: MonacoEditor.IModelDeltaDecoration[] = relatedErrors.map((error) => ({
      range: {
        startLineNumber: Math.max(1, error.line),
        startColumn: Math.max(1, error.column),
        endLineNumber: Math.max(1, error.line),
        endColumn: Math.max(1, error.column + 10),
      },
      options: {
        isWholeLine: false,
        glyphMarginClassName: `codicon codicon-${
          error.severity === 'error'
            ? 'error'
            : error.severity === 'warning'
            ? 'warning'
            : 'info'
        }`,
        glyphMarginHoverMessage: { value: error.message },
        className: `error-squiggle error-${error.severity}`,
        inlineClassNameAffectsLetterSpacing: true,
      },
    }));

    if (newDecorations.length > 0) {
      try {
        decorationIdsRef.current = editorRef.current.deltaDecorations(
          decorationIdsRef.current,
          newDecorations
        );
      } catch (err) {
        console.warn('Failed to apply editor decorations', err);
      }
    } else {
      // Clear decorations if no errors
      decorationIdsRef.current = editorRef.current.deltaDecorations(decorationIdsRef.current, []);
    }
  }, [editorErrors, activeTab]);

  if (openTabs.length === 0) {
    return (
      <div className="flex-1 flex items-center justify-center bg-ide-bg">
        <div className="text-center space-y-4">
          <p className="text-6xl">🔮</p>
          <h1 className="text-2xl font-bold text-ide-text">Atlas SuperIDE</h1>
          <p className="text-ide-text-dim text-sm max-w-md">
            The unified IDE combining Remix, OpenClaw AI, NotebookLM, RAG Engine,
            Knowledge Base, Research Dashboard, and Skills Framework.
          </p>
          <div className="grid grid-cols-3 gap-3 max-w-lg mx-auto mt-6">
            {[
              { icon: '⟠', label: 'Compile Solidity', desc: 'Remix Panel → Compile' },
              { icon: '🤖', label: 'Chat with AI', desc: 'Ollama-powered assistant' },
              { icon: '🕸️', label: 'Crawl & Search', desc: 'RAG knowledge engine' },
              { icon: '🎙️', label: 'NotebookLM', desc: 'Docs → conversations' },
              { icon: '🧠', label: 'Knowledge Base', desc: 'Persistent patterns' },
              { icon: '⚡', label: 'Run a Skill', desc: 'Extensible tooling' },
            ].map((item) => (
              <div
                key={item.label}
                className="bg-ide-surface rounded-lg p-3 border border-ide-border hover:border-ide-accent transition-colors cursor-pointer"
              >
                <p className="text-2xl mb-1">{item.icon}</p>
                <p className="text-xs font-medium">{item.label}</p>
                <p className="text-[10px] text-ide-text-dim">{item.desc}</p>
              </div>
            ))}
          </div>
          <div className="mt-6 text-xs text-ide-text-dim space-y-1">
            <p>Open a file from the Explorer, or use a panel to get started.</p>
            <p className="text-[10px]">
              Press <kbd className="bg-ide-surface px-1 rounded">Ctrl+Shift+P</kbd> for command palette
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full bg-ide-bg">
      {/* Tab bar */}
      <div className="flex bg-ide-surface border-b border-ide-border overflow-x-auto">
        {openTabs.map((tab) => (
          <div
            key={tab.id}
            className={`flex items-center gap-1 px-3 py-1.5 cursor-pointer border-r border-ide-border text-xs whitespace-nowrap group ${
              tab.id === activeTabId
                ? 'bg-ide-bg text-ide-text border-t-2 border-t-ide-accent'
                : 'text-ide-text-dim hover:bg-ide-bg/50'
            }`}
            onClick={() => setActiveTab(tab.id)}
          >
            <span className="text-[10px]">
              {tab.language === 'sol' ? '⟠' : tab.language === 'markdown' ? '📝' : '📄'}
            </span>
            <span>{tab.path.split('/').pop()}</span>
            {tab.isDirty && (
              <span
                className="text-ide-accent ml-0.5 cursor-pointer"
                title="Save (Ctrl+S)"
                onClick={(e) => {
                  e.stopPropagation();
                  saveTab(tab);
                }}
              >
                💾
              </span>
            )}
            {tab.isDirty && <span className="text-ide-accent ml-0.5">●</span>}
            <button
              onClick={(e) => {
                e.stopPropagation();
                closeTab(tab.id);
              }}
              className="ml-1 text-ide-text-dim hover:text-ide-text opacity-0 group-hover:opacity-100 transition-opacity"
            >
              ✕
            </button>
          </div>
        ))}
      </div>

      {/* Editor */}
      {activeTab && (
        <div className="flex-1">
          <Editor
            height="100%"
            language={activeTab.language || getLanguageFromPath(activeTab.path)}
            value={activeTab.content}
            theme="vs-dark"
            onMount={(editor) => {
              cursorListenerRef.current?.dispose();
              editorRef.current = editor;
              cursorListenerRef.current = editor.onDidChangeCursorPosition((event) => {
                setEditorCursorPosition(event.position.lineNumber, event.position.column);
              });
              syncCursorFromEditor();
              applyPendingCursor(activeTab);
            }}
            onChange={(value) => {
              if (value !== undefined) {
                updateTabContent(activeTab.id, value);
              }
            }}
            options={{
              fontFamily: "'JetBrains Mono', monospace",
              fontSize: 14,
              lineHeight: 22,
              minimap: { enabled: editorMinimap },
              scrollBeyondLastLine: false,
              padding: { top: 8 },
              automaticLayout: true,
              wordWrap: editorWordWrap ? 'on' : 'off',
              bracketPairColorization: { enabled: true },
              guides: { indentation: true, bracketPairs: true },
              renderLineHighlight: 'all',
              cursorBlinking: 'smooth',
              smoothScrolling: true,
            }}
          />
        </div>
      )}
    </div>
  );
}
