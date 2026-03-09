import { useState, useRef, useEffect } from 'react';
import { useIDEStore, type AiChatMode, type ChatMessage } from '../../store/ideStore';
import {
  applyAiWorkspaceEdits,
  freeProviderChat,
  getAiWorkspaceContext,
  ollamaChatStream,
  openWorkspaceFile,
} from '../../lib/api';

type StructuredEditFile = {
  path: string;
  content: string;
};

type ParsedDiffHunk = {
  oldStart: number;
  lines: string[];
};

type ParsedDiffFile = {
  path: string;
  hunks: ParsedDiffHunk[];
};

function detectLanguage(path: string): string {
  const ext = path.split('.').pop()?.toLowerCase() || '';
  const byExt: Record<string, string> = {
    ts: 'typescript',
    tsx: 'typescript',
    js: 'javascript',
    jsx: 'javascript',
    py: 'python',
    rs: 'rust',
    sol: 'sol',
    json: 'json',
    md: 'markdown',
    css: 'css',
    html: 'html',
    sh: 'shell',
    yml: 'yaml',
    yaml: 'yaml',
  };
  return byExt[ext] || ext || 'text';
}

function extractStructuredEdits(content: string): StructuredEditFile[] {
  const blocks = [...content.matchAll(/```atlas-edit\s*([\s\S]*?)```/g)];
  const files: StructuredEditFile[] = [];

  for (const block of blocks) {
    const raw = block[1]?.trim();
    if (!raw) {
      continue;
    }

    try {
      const parsed = JSON.parse(raw) as
        | { path?: string; content?: string; files?: Array<{ path?: string; content?: string }> }
        | null;
      if (!parsed || typeof parsed !== 'object') {
        continue;
      }

      if (typeof parsed.path === 'string' && typeof parsed.content === 'string') {
        files.push({ path: parsed.path, content: parsed.content });
      }

      if (Array.isArray(parsed.files)) {
        for (const entry of parsed.files) {
          if (typeof entry?.path === 'string' && typeof entry?.content === 'string') {
            files.push({ path: entry.path, content: entry.content });
          }
        }
      }
    } catch {
      // Ignore malformed edit blocks and keep the rest of the response visible.
    }
  }

  const deduped = new Map<string, StructuredEditFile>();
  for (const file of files) {
    deduped.set(file.path, file);
  }
  return [...deduped.values()];
}

function normalizeDiffPath(path: string): string {
  const trimmed = path.trim();
  if (!trimmed || trimmed === '/dev/null') {
    return '';
  }
  return trimmed.replace(/^[ab]\//, '');
}

function extractDiffPatches(content: string): ParsedDiffFile[] {
  const blocks = [...content.matchAll(/```diff\s*([\s\S]*?)```/g)];
  const patches: ParsedDiffFile[] = [];

  for (const block of blocks) {
    const lines = (block[1] || '').split(/\r?\n/);
    let currentFile: ParsedDiffFile | null = null;
    let currentHunk: ParsedDiffHunk | null = null;

    for (const line of lines) {
      if (line.startsWith('+++ ')) {
        const path = normalizeDiffPath(line.slice(4));
        if (!path) {
          currentFile = null;
          currentHunk = null;
          continue;
        }
        currentFile = { path, hunks: [] };
        patches.push(currentFile);
        currentHunk = null;
        continue;
      }

      const hunkMatch = line.match(/^@@ -(\d+)(?:,\d+)? \+(\d+)(?:,\d+)? @@/);
      if (hunkMatch && currentFile) {
        currentHunk = {
          oldStart: Math.max(1, Number(hunkMatch[1]) || 1),
          lines: [],
        };
        currentFile.hunks.push(currentHunk);
        continue;
      }

      if (
        currentHunk &&
        /^[ +\-]/.test(line) &&
        !line.startsWith('+++') &&
        !line.startsWith('---')
      ) {
        currentHunk.lines.push(line);
      }
    }
  }

  const deduped = new Map<string, ParsedDiffFile>();
  for (const patch of patches) {
    if (!patch.hunks.length) {
      continue;
    }
    const existing = deduped.get(patch.path);
    if (existing) {
      existing.hunks.push(...patch.hunks);
    } else {
      deduped.set(patch.path, patch);
    }
  }
  return [...deduped.values()];
}

function canApplySuggestedDiffs(content: string): boolean {
  return extractStructuredEdits(content).length === 0 && extractDiffPatches(content).length > 0;
}

function applyPatchToContent(currentContent: string, patch: ParsedDiffFile): string {
  const hadTrailingNewline = currentContent.endsWith('\n');
  const sourceLines = currentContent === '' ? [] : currentContent.replace(/\n$/, '').split('\n');
  const result: string[] = [];
  let cursor = 0;

  for (const hunk of patch.hunks) {
    const targetIndex = Math.max(0, hunk.oldStart - 1);
    while (cursor < targetIndex && cursor < sourceLines.length) {
      result.push(sourceLines[cursor]);
      cursor += 1;
    }

    for (const line of hunk.lines) {
      const marker = line[0];
      const text = line.slice(1);

      if (marker === ' ') {
        const currentLine = sourceLines[cursor] ?? '';
        if (currentLine !== text) {
          throw new Error(`Diff context mismatch in ${patch.path}`);
        }
        result.push(currentLine);
        cursor += 1;
      } else if (marker === '-') {
        const currentLine = sourceLines[cursor] ?? '';
        if (currentLine !== text) {
          throw new Error(`Diff removal mismatch in ${patch.path}`);
        }
        cursor += 1;
      } else if (marker === '+') {
        result.push(text);
      }
    }
  }

  while (cursor < sourceLines.length) {
    result.push(sourceLines[cursor]);
    cursor += 1;
  }

  const joined = result.join('\n');
  if (!joined) {
    return '';
  }
  return hadTrailingNewline || currentContent === '' ? `${joined}\n` : joined;
}

export function AiChatPanel() {
  const {
    chatMessages,
    chatModel,
    availableModels,
    isChatStreaming,
    addChatMessage,
    setChatModel,
    setChatStreaming,
    clearChat,
    ollamaConnected,
    aiProvider,
    aiModel,
    setAiProvider,
    setAiModel,
    aiDraftInput,
    aiDraftMode,
    clearAiDraftInput,
    noAddModeEnabled,
    noAddObjective,
    noAddDefinitionOfDone,
    noAddRoleProfile,
    openTabs,
    activeTabId,
    openTab,
    updateTabContent,
    markTabSaved,
    workspaceRoot,
  } = useIDEStore();

  // helper to simulate streaming output
  async function* simulateTextStream(text: string) {
    const chunk = 80;
    for (let i = 0; i < text.length; i += chunk) {
      yield text.slice(i, i + chunk);
      await new Promise((r) => setTimeout(r, 40));
    }
  }
  const [input, setInput] = useState('');
  const [mode, setMode] = useState<AiChatMode>('chat');
  const [codebaseContextEnabled, setCodebaseContextEnabled] = useState(true);
  const [autoApplyEdits, setAutoApplyEdits] = useState(true);
  const [actionStatus, setActionStatus] = useState('');
  const [applyingMessageId, setApplyingMessageId] = useState<string | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const abortRef = useRef<AbortController | null>(null);
  const activeModel = aiProvider === 'ollama' ? chatModel : aiModel;
  const activeTab = openTabs.find((tab) => tab.id === activeTabId) || null;

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' });
  }, [chatMessages]);

  useEffect(() => {
    if (!aiDraftInput) {
      return;
    }

    setMode(aiDraftMode);
    setInput(aiDraftInput);
    clearAiDraftInput();
  }, [aiDraftInput, aiDraftMode, clearAiDraftInput]);

  const buildCodebaseContext = async (query: string) => {
    const response = await getAiWorkspaceContext({
      query,
      workspaceRoot,
      activeFilePath: activeTab?.path || '',
      activeFileContent: activeTab?.content || '',
      openTabs: openTabs.map((tab) => tab.path),
      maxMatches: 4,
      maxFiles: 3,
      maxCharsPerFile: 8000,
    });
    return response.context;
  };

  const applyStructuredEdits = async (assistantMessageId: string, responseText: string) => {
    const edits = extractStructuredEdits(responseText);
    if (!autoApplyEdits || edits.length === 0) {
      if (autoApplyEdits) {
        setActionStatus('Code-aware mode is on. No structured edits were returned.');
      }
      return;
    }

    try {
      await applyAiWorkspaceEdits(edits);
      const store = useIDEStore.getState();

      for (const edit of edits) {
        const existingTab = store.openTabs.find((tab) => tab.path === edit.path || tab.id === edit.path);
        if (existingTab) {
          updateTabContent(existingTab.id, edit.content);
          markTabSaved(existingTab.id);
        } else {
          openTab({
            id: edit.path,
            name: edit.path.split('/').pop() || edit.path,
            path: edit.path,
            language: detectLanguage(edit.path),
            content: edit.content,
            isDirty: false,
          });
        }
      }

      const appliedLabel = edits.map((edit) => edit.path).join(', ');
      useIDEStore.setState((s) => ({
        chatMessages: s.chatMessages.map((msg) =>
          msg.id === assistantMessageId
            ? {
                ...msg,
                content: `${msg.content}\n\nApplied ${edits.length} file change(s): ${appliedLabel}`,
              }
            : msg,
        ),
      }));
      setActionStatus(`Applied ${edits.length} file change(s): ${appliedLabel}`);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unknown save error.';
      useIDEStore.setState((s) => ({
        chatMessages: s.chatMessages.map((msg) =>
          msg.id === assistantMessageId
            ? {
                ...msg,
                content: `${msg.content}\n\nFailed to apply structured edits: ${message}`,
              }
            : msg,
        ),
      }));
      setActionStatus(`Failed to apply structured edits: ${message}`);
    }
  };

  const handleApplySuggestedEdits = async (messageId: string, content: string) => {
    const patches = extractDiffPatches(content);
    if (!patches.length) {
      setActionStatus('No diff patches found to apply.');
      return;
    }

    setApplyingMessageId(messageId);
    try {
      const store = useIDEStore.getState();
      const edits = await Promise.all(
        patches.map(async (patch) => {
          const existing = store.openTabs.find((tab) => tab.path === patch.path || tab.id === patch.path);
          const currentContent = existing?.content ?? (await openWorkspaceFile(patch.path)).content;
          return {
            path: patch.path,
            content: applyPatchToContent(currentContent, patch),
          };
        }),
      );

      await applyAiWorkspaceEdits(edits);

      for (const edit of edits) {
        const currentStore = useIDEStore.getState();
        const existingTab = currentStore.openTabs.find((tab) => tab.path === edit.path || tab.id === edit.path);
        if (existingTab) {
          updateTabContent(existingTab.id, edit.content);
          markTabSaved(existingTab.id);
        } else {
          openTab({
            id: edit.path,
            name: edit.path.split('/').pop() || edit.path,
            path: edit.path,
            language: detectLanguage(edit.path),
            content: edit.content,
            isDirty: false,
          });
        }
      }

      const appliedLabel = edits.map((edit) => edit.path).join(', ');
      setActionStatus(`Applied suggested diff(s): ${appliedLabel}`);
      useIDEStore.setState((s) => ({
        chatMessages: s.chatMessages.map((msg) =>
          msg.id === messageId
            ? {
                ...msg,
                content: `${msg.content}\n\nApplied suggested diff(s): ${appliedLabel}`,
              }
            : msg,
        ),
      }));
    } catch (err) {
      setActionStatus(
        `Failed to apply suggested diff(s): ${err instanceof Error ? err.message : 'unknown error'}`,
      );
    } finally {
      setApplyingMessageId(null);
    }
  };

  const handleSend = async () => {
    if (!input.trim() || isChatStreaming) return;

    if (!activeModel) {
      addChatMessage({
        id: `msg-${Date.now()}-error`,
        role: 'assistant',
        content:
          aiProvider === 'ollama'
            ? 'Error: No Ollama model is available. Pull or select a model first.'
            : 'Error: Set a model name for the selected provider before sending.',
        timestamp: Date.now(),
      });
      return;
    }

    const baseSystemPrompt =
      mode === 'task-plan'
        ? 'You are a codebase analysis and task planning assistant (Traycer-style). When the user describes a task, analyze the codebase structure, identify relevant files, and generate a comprehensive task plan with actionable steps and file modifications.'
        : mode === 'context-eng'
        ? 'You are a context engineering assistant. Help the user create PRPs (Product Requirements Prompts), set up CLAUDE.md rules, organize examples, and implement features using the context engineering workflow: 1) Write INITIAL.md, 2) Generate PRP, 3) Execute PRP with validation gates.'
        : 'You are Atlas SuperIDE AI assistant, powered by Ollama. You help with smart contract development (Solidity/Remix), code analysis, RAG queries, and general programming. You have access to the knowledge base, crawled documentation, and codebase analysis tools.';

    const codeEditPrompt = codebaseContextEnabled
      ? [
          'You are operating with live codebase context.',
          'When the user asks for code changes, read the provided file context carefully and make concrete edits.',
          autoApplyEdits
            ? 'If code should be changed, append a final ```atlas-edit fenced JSON block with either {"path":"relative/path","content":"full new file content"} or {"files":[...]} so the IDE can apply the changes immediately.'
            : 'If code should be changed, describe the exact files and edits precisely.',
          'Never invent files you were not given context for unless the user explicitly asks to create them.',
        ].join(' ')
      : '';

    const noAddPrompt = noAddModeEnabled
      ? [
          'RALPH MODE is active.',
          'Treat each response as a fresh iteration. Do not rely on stale conversational assumptions when durable state should live in files or explicit user-provided context.',
          `Stay locked on the current objective until it is fully complete: ${noAddObjective || 'the active objective set by the user'}.`,
          noAddDefinitionOfDone
            ? `Definition of done: ${noAddDefinitionOfDone}.`
            : 'Do not declare completion until the user-accepted definition of done is satisfied.',
          `Guardrail profile: ${noAddRoleProfile}.`,
          'Do not introduce unrelated ideas, features, or side quests. If a new request is out of scope, call it out and redirect back to the current objective.',
          'Respond as a disciplined principal engineer / project manager: structured, explicit, finish-oriented, and resistant to context drift.',
        ].join(' ')
      : '';

    const userMsg: ChatMessage = {
      id: `msg-${Date.now()}`,
      role: 'user',
      content: input.trim(),
      timestamp: Date.now(),
    };
    addChatMessage(userMsg);
    setInput('');

    // Build message history for Ollama
    const messages = [
      {
        role: 'system',
        content: [baseSystemPrompt, codeEditPrompt, noAddPrompt].filter(Boolean).join(' '),
      },
      ...chatMessages.map((m) => ({ role: m.role, content: m.content })),
    ];

    if (codebaseContextEnabled) {
      const codebaseContext = await buildCodebaseContext(userMsg.content);
      messages.push({
        role: 'system',
        content: `Workspace context for this request:\n\n${codebaseContext}`,
      });
    }

    messages.push({ role: userMsg.role, content: userMsg.content });

    setChatStreaming(true);
    setActionStatus(
      codebaseContextEnabled
        ? 'Reading workspace context before sending request...'
        : '',
    );
    const abortCtrl = new AbortController();
    abortRef.current = abortCtrl;

    const assistantMsg: ChatMessage = {
      id: `msg-${Date.now()}-ai`,
      role: 'assistant',
      content: '',
      timestamp: Date.now(),
      model: activeModel,
    };
    addChatMessage(assistantMsg);

    try {
      let fullContent = '';
      if (aiProvider === 'ollama') {
        for await (const chunk of ollamaChatStream(
          activeModel,
          messages,
          abortCtrl.signal,
        )) {
          fullContent += chunk;
          useIDEStore.setState((s) => ({
            chatMessages: s.chatMessages.map((m) =>
              m.id === assistantMsg.id ? { ...m, content: fullContent } : m,
            ),
          }));
        }
        await applyStructuredEdits(assistantMsg.id, fullContent);
      } else {
        const data = await freeProviderChat(aiProvider, activeModel, messages, abortCtrl.signal);
        let text = '';
        if (data?.choices?.[0]?.message?.content) {
          text = data.choices[0].message.content;
        } else if (data?.text) {
          text = data.text;
        } else {
          text = JSON.stringify(data);
        }
        for await (const chunk of simulateTextStream(text)) {
          fullContent += chunk;
          useIDEStore.setState((s) => ({
            chatMessages: s.chatMessages.map((m) =>
              m.id === assistantMsg.id ? { ...m, content: fullContent } : m,
            ),
          }));
        }
        await applyStructuredEdits(assistantMsg.id, fullContent);
      }
    } catch (err: any) {
      if (err.name !== 'AbortError') {
        useIDEStore.setState((s) => ({
          chatMessages: s.chatMessages.map((m) =>
            m.id === assistantMsg.id
              ? { ...m, content: `Error: ${err.message}.` }
              : m,
          ),
        }));
        setActionStatus(`AI request failed: ${err.message}`);
      }
    } finally {
      setChatStreaming(false);
      abortRef.current = null;
    }
  };

  const handleStop = () => {
    abortRef.current?.abort();
  };

  return (
    <div className="flex flex-col h-full">
      <div className="panel-header flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span>🤖 AI Chat</span>
          <span className="text-[10px] text-ide-text-dim">
            {aiProvider}/{activeModel || 'no-model'}
          </span>
        </div>
        <div className="flex items-center gap-2">
          <span className={`w-2 h-2 rounded-full ${ollamaConnected ? 'bg-green-400' : 'bg-red-400'}`} />
          <button onClick={clearChat} className="text-ide-text-dim hover:text-ide-text text-[10px]">
            Clear
          </button>
        </div>
      </div>

      {/* Mode Selector */}
      <div className="flex border-b border-ide-border">
        {([
          { id: 'chat', label: '💬 Chat' },
          { id: 'task-plan', label: '📋 Task Plan' },
          { id: 'context-eng', label: '🎯 Context Eng' },
        ] as const).map((m) => (
          <button
            key={m.id}
            onClick={() => setMode(m.id)}
            className={`tab-btn flex-1 ${mode === m.id ? 'active' : ''}`}
          >
            {m.label}
          </button>
        ))}
      </div>

      {/* Model Selector */}
      <div className="px-3 py-2 border-b border-ide-border flex items-center gap-2">
        <select
          value={aiProvider}
          onChange={(e) => setAiProvider(e.target.value as typeof aiProvider)}
          className="input-field text-xs w-32"
        >
          <option value="ollama">Ollama</option>
          <option value="openrouter">OpenRouter</option>
          <option value="ollamafree">OllamaFree</option>
          <option value="gptoss">GPTOSS</option>
        </select>
        {aiProvider === 'ollama' && (
          <select
            value={chatModel}
            onChange={(e) => setChatModel(e.target.value)}
            className="input-field text-xs flex-1"
          >
            {availableModels.length > 0 ? (
              availableModels.map((m) => (
                <option key={m.name} value={m.name}>
                  {m.name} ({m.size})
                </option>
              ))
            ) : (
              <option value="">No Ollama models discovered</option>
            )}
          </select>
        )}
        {aiProvider !== 'ollama' && (
          <input
            type="text"
            value={aiModel}
            onChange={(e) => setAiModel(e.target.value)}
            placeholder="model" 
            className="input-field text-xs flex-1"
          />
        )}
      </div>

      <div className="px-3 py-2 border-b border-ide-border flex flex-wrap items-center gap-3 text-[11px] text-ide-text">
        <label className="flex items-center gap-1">
          <input
            type="checkbox"
            checked={codebaseContextEnabled}
            onChange={(e) => setCodebaseContextEnabled(e.target.checked)}
          />
          Read codebase
        </label>
        <label className="flex items-center gap-1">
          <input
            type="checkbox"
            checked={autoApplyEdits}
            onChange={(e) => setAutoApplyEdits(e.target.checked)}
            disabled={!codebaseContextEnabled}
          />
          Auto-apply edits
        </label>
        <span className="text-ide-text-dim">
          {activeTab ? `Active: ${activeTab.path}` : `Scope: ${workspaceRoot}`}
        </span>
      </div>

      {noAddModeEnabled && (
        <div className="border-b border-amber-500/20 bg-amber-500/5 px-3 py-2 text-[11px] text-amber-100 space-y-1">
          <p className="font-medium">RALPH mode is active</p>
          <p>{noAddObjective || 'Set the anchor task in Settings → General.'}</p>
          {noAddDefinitionOfDone && (
            <p className="text-amber-200">Done when: {noAddDefinitionOfDone}</p>
          )}
        </div>
      )}

      {actionStatus && (
        <div className="border-b border-ide-border px-3 py-2 text-[11px] text-ide-text-dim">
          {actionStatus}
        </div>
      )}

      {/* Messages */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto p-3 space-y-3">
        {chatMessages.length === 0 && (
          <div className="text-center text-ide-text-dim text-xs mt-8 space-y-2">
            <p className="text-2xl">🤖</p>
            <p className="font-medium">Atlas AI Assistant</p>
            <p>Powered by Ollama (OpenClaw-compatible)</p>
            <p className="mt-4">Try:</p>
            <div className="space-y-1">
              {[
                'Explain this Solidity contract',
                'Generate a task plan for adding tests',
                'Create a PRP for a new feature',
              ].map((prompt) => (
                <button
                  key={prompt}
                  type="button"
                  onClick={() => setInput(prompt)}
                  className="block w-full text-left text-ide-accent hover:underline"
                >
                  "{prompt}"
                </button>
              ))}
            </div>
          </div>
        )}

        {chatMessages.map((msg) => (
          <div
            key={msg.id}
            className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
          >
            <div
              className={`max-w-[85%] rounded-lg px-3 py-2 text-xs ${
                msg.role === 'user'
                  ? 'bg-ide-accent text-white'
                  : 'bg-ide-panel text-ide-text border border-ide-border'
              }`}
            >
              {msg.model && (
                <div className="text-[10px] text-ide-text-dim mb-1">{msg.model}</div>
              )}
              <div className="whitespace-pre-wrap">{msg.content || '...'}</div>
              {msg.role === 'assistant' && canApplySuggestedDiffs(msg.content) && (
                <button
                  type="button"
                  onClick={() => void handleApplySuggestedEdits(msg.id, msg.content)}
                  disabled={applyingMessageId === msg.id}
                  className="mt-2 rounded border border-ide-border px-2 py-1 text-[10px] text-ide-text-dim hover:text-ide-text"
                >
                  {applyingMessageId === msg.id ? 'Applying…' : 'Apply Suggested Edits'}
                </button>
              )}
            </div>
          </div>
        ))}

        {isChatStreaming && (
          <div className="flex justify-center">
            <button onClick={handleStop} className="text-xs text-red-400 hover:text-red-300">
              ⏹ Stop generating
            </button>
          </div>
        )}
      </div>

      {/* Input */}
      <div className="p-3 border-t border-ide-border">
        <div className="flex gap-2">
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && !e.shiftKey && handleSend()}
            placeholder={
              mode === 'task-plan'
                ? 'Describe the task to plan...'
                : mode === 'context-eng'
                ? 'Describe the feature for PRP...'
                : 'Ask Atlas AI anything...'
            }
            className="input-field flex-1"
            disabled={isChatStreaming}
          />
          <button
            onClick={isChatStreaming ? handleStop : handleSend}
            className="action-btn"
            disabled={!input.trim() && !isChatStreaming}
          >
            {isChatStreaming ? '⏹' : '▶'}
          </button>
        </div>
      </div>
    </div>
  );
}
