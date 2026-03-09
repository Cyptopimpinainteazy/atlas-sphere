import { useState, useRef, useEffect } from 'react';
import { useIDEStore, type ChatMessage } from '../../store/ideStore';
import { ollamaChatStream, freeProviderChat } from '../../lib/api';

const BOLT_SYSTEM_PROMPT = `You are Bolt, an AI coding assistant integrated into Atlas SuperIDE.
You help users write, debug, and understand code. You can:
- Generate code snippets and full files
- Debug errors and suggest fixes
- Explain code concepts
- Refactor and optimize code
- Answer questions about the current project

When generating code, use markdown code blocks with language tags.
Be concise but thorough. Focus on actionable, production-ready suggestions.`;

const QUICK_ACTIONS = [
  { label: '🐛 Debug this file', prompt: 'Debug the currently open file and identify potential issues.' },
  { label: '✨ Improve code', prompt: 'Suggest improvements for the currently open code.' },
  { label: '📝 Add comments', prompt: 'Add comprehensive comments to the current code.' },
  { label: '🧪 Generate tests', prompt: 'Generate unit tests for the currently open code.' },
  { label: '🔒 Security check', prompt: 'Perform a security review of the current code.' },
  { label: '📖 Explain', prompt: 'Explain what the currently open code does step by step.' },
];

export function BoltChatPanel() {
  const {
    boltMessages,
    isBoltStreaming,
    addBoltMessage,
    setBoltStreaming,
    clearBoltChat,
    chatModel,
    availableModels,
    ollamaConnected,
    aiProvider,
    aiModel,
    activeTabId,
    openTabs,
  } = useIDEStore();

  const [input, setInput] = useState('');
  const [includeContext, setIncludeContext] = useState(true);
  const scrollRef = useRef<HTMLDivElement>(null);
  const abortRef = useRef<AbortController | null>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const activeModel = aiProvider === 'ollama' ? chatModel : aiModel;
  const activeTab = openTabs.find((t) => t.id === activeTabId);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' });
  }, [boltMessages]);

  // helper to simulate streaming output
  async function* simulateTextStream(text: string) {
    const chunk = 80;
    for (let i = 0; i < text.length; i += chunk) {
      yield text.slice(i, i + chunk);
      await new Promise((r) => setTimeout(r, 40));
    }
  }

  const buildContextPrefix = (): string => {
    if (!includeContext || !activeTab) return '';
    return `[Context: File "${activeTab.path}" (${activeTab.language})]\n\`\`\`${activeTab.language}\n${activeTab.content.slice(0, 3000)}\n\`\`\`\n\n`;
  };

  const handleSend = async (overridePrompt?: string) => {
    const messageText = overridePrompt || input.trim();
    if (!messageText || isBoltStreaming) return;

    if (!activeModel) {
      addBoltMessage({
        id: `bolt-${Date.now()}-error`,
        role: 'assistant',
        content: '⚠️ No model available. Connect Ollama or select a provider in Settings.',
        timestamp: Date.now(),
      });
      return;
    }

    const contextPrefix = buildContextPrefix();
    const userMsg: ChatMessage = {
      id: `bolt-${Date.now()}`,
      role: 'user',
      content: messageText,
      timestamp: Date.now(),
    };
    addBoltMessage(userMsg);
    if (!overridePrompt) setInput('');

    const messages = [
      { role: 'system', content: BOLT_SYSTEM_PROMPT },
      ...boltMessages.map((m) => ({ role: m.role, content: m.content })),
      { role: 'user', content: contextPrefix + messageText },
    ];

    setBoltStreaming(true);
    const abortCtrl = new AbortController();
    abortRef.current = abortCtrl;

    const assistantMsg: ChatMessage = {
      id: `bolt-${Date.now()}-ai`,
      role: 'assistant',
      content: '',
      timestamp: Date.now(),
      model: activeModel,
    };
    addBoltMessage(assistantMsg);

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
            boltMessages: s.boltMessages.map((m) =>
              m.id === assistantMsg.id ? { ...m, content: fullContent } : m,
            ),
          }));
        }
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
            boltMessages: s.boltMessages.map((m) =>
              m.id === assistantMsg.id ? { ...m, content: fullContent } : m,
            ),
          }));
        }
      }
    } catch (err: any) {
      if (err.name !== 'AbortError') {
        useIDEStore.setState((s) => ({
          boltMessages: s.boltMessages.map((m) =>
            m.id === assistantMsg.id
              ? { ...m, content: `❌ Error: ${err.message}` }
              : m,
          ),
        }));
      }
    } finally {
      setBoltStreaming(false);
      abortRef.current = null;
    }
  };

  const handleStop = () => {
    abortRef.current?.abort();
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  return (
    <div className="flex flex-col h-full" data-testid="bolt-chat-panel">
      {/* Header */}
      <div className="panel-header flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="text-base">⚡</span>
          <span>Bolt Chat</span>
          {ollamaConnected && (
            <span className="text-[10px] px-1.5 py-0.5 rounded bg-green-500/20 text-green-400">
              {activeModel || 'no model'}
            </span>
          )}
        </div>
        <div className="flex items-center gap-1">
          <button
            onClick={() => setIncludeContext(!includeContext)}
            className={`px-1.5 py-0.5 rounded text-[10px] transition-colors ${
              includeContext
                ? 'bg-ide-accent/30 text-ide-accent'
                : 'text-ide-text-dim hover:text-ide-text'
            }`}
            title={includeContext ? 'Context: ON (sends current file)' : 'Context: OFF'}
          >
            {includeContext ? '📎 CTX' : '📎'}
          </button>
          <button
            onClick={clearBoltChat}
            className="px-1.5 py-0.5 rounded text-[10px] text-ide-text-dim hover:text-ide-text hover:bg-ide-panel transition-colors"
            title="Clear chat"
          >
            🗑
          </button>
        </div>
      </div>

      {/* Messages */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto p-3 space-y-3">
        {boltMessages.length === 0 ? (
          <div className="text-center py-8 space-y-4">
            <div className="text-4xl">⚡</div>
            <div>
              <p className="text-sm font-medium text-ide-text">Bolt AI Assistant</p>
              <p className="text-xs text-ide-text-dim mt-1">
                Your AI coding companion. Ask anything about your code.
              </p>
            </div>

            {/* Quick Actions */}
            <div className="grid grid-cols-2 gap-2 mt-4">
              {QUICK_ACTIONS.map((action) => (
                <button
                  key={action.label}
                  onClick={() => handleSend(action.prompt)}
                  disabled={isBoltStreaming || !activeModel}
                  className="text-left px-2.5 py-2 rounded-lg border border-ide-border hover:border-ide-accent/50 hover:bg-ide-panel/50 transition-colors disabled:opacity-40"
                >
                  <span className="text-xs">{action.label}</span>
                </button>
              ))}
            </div>

            {activeTab && (
              <p className="text-[10px] text-ide-text-dim mt-3">
                📄 Context: <span className="text-ide-accent">{activeTab.path}</span>
              </p>
            )}
          </div>
        ) : (
          boltMessages.map((msg) => (
            <div
              key={msg.id}
              className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
            >
              <div
                className={`max-w-[90%] rounded-lg px-3 py-2 text-xs ${
                  msg.role === 'user'
                    ? 'bg-ide-accent text-white rounded-br-sm'
                    : 'bg-ide-panel text-ide-text rounded-bl-sm border border-ide-border'
                }`}
              >
                {msg.role === 'assistant' && (
                  <div className="flex items-center gap-1 mb-1 text-[10px] text-ide-text-dim">
                    <span>⚡</span>
                    <span>Bolt</span>
                    {msg.model && <span className="opacity-60">· {msg.model}</span>}
                  </div>
                )}
                <div className="whitespace-pre-wrap break-words leading-relaxed">
                  {msg.content || (isBoltStreaming ? '▊' : '')}
                </div>
              </div>
            </div>
          ))
        )}

        {isBoltStreaming && (
          <div className="flex justify-center">
            <button
              onClick={handleStop}
              className="px-3 py-1 rounded-full bg-red-500/20 text-red-400 text-[10px] hover:bg-red-500/30 transition-colors"
            >
              ■ Stop generating
            </button>
          </div>
        )}
      </div>

      {/* Input Area */}
      <div className="border-t border-ide-border p-2 bg-ide-bg">
        <div className="relative">
          <textarea
            ref={inputRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={activeTab ? `Ask about ${activeTab.name}...` : 'Ask Bolt anything...'}
            rows={2}
            className="w-full px-3 py-2 pr-10 bg-ide-surface border border-ide-border rounded-lg text-xs text-ide-text placeholder:text-ide-text-dim focus:outline-none focus:ring-1 focus:ring-ide-accent resize-none"
            disabled={isBoltStreaming}
          />
          <button
            onClick={() => handleSend()}
            disabled={isBoltStreaming || !input.trim()}
            className="absolute right-2 bottom-2 w-6 h-6 flex items-center justify-center rounded bg-ide-accent text-white text-xs hover:bg-ide-accent/80 disabled:opacity-40 transition-colors"
            title="Send"
          >
            ↑
          </button>
        </div>
        {includeContext && activeTab && (
          <p className="text-[10px] text-ide-text-dim mt-1 px-1">
            📎 Sending context from <span className="text-ide-accent">{activeTab.name}</span>
          </p>
        )}
      </div>
    </div>
  );
}
