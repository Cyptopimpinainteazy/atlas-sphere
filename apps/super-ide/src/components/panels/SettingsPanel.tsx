import { useEffect, useState } from 'react';
import { useIDEStore } from '../../store/ideStore';

export function SettingsPanel() {
  const {
    ollamaUrl,
    ollamaConnected,
    availableModels,
    chatModel,
    setOllamaUrl,
    setChatModel,
    setAvailableModels,
    setOllamaConnected,
    aiProvider,
    aiModel,
    setAiProvider,
    setAiModel,
    workspaceRoot,
    favoriteWorkspaceRoots,
    setWorkspaceRoot,
    addWorkspaceFavorite,
    removeWorkspaceFavorite,
    editorWordWrap,
    editorMinimap,
    setEditorWordWrap,
    setEditorMinimap,
  } = useIDEStore();

  const [section, setSection] = useState<'general' | 'ai' | 'remix' | 'rag' | 'about'>('ai');
  const [urlInput, setUrlInput] = useState(ollamaUrl);
  const [workspaceRootInput, setWorkspaceRootInput] = useState(workspaceRoot);
  const [testing, setTesting] = useState(false);

  useEffect(() => {
    setWorkspaceRootInput(workspaceRoot);
  }, [workspaceRoot]);

  const handleTestConnection = async () => {
    setTesting(true);
    try {
      const resp = await fetch(`${urlInput}/api/tags`);
      if (resp.ok) {
        const data = await resp.json();
        const models = (data.models || []).map((m: any) => ({
          name: m.name,
          size: formatBytes(m.size),
          modified: m.modified_at,
        }));
        setOllamaUrl(urlInput);
        setAvailableModels(models);
        setOllamaConnected(true);
      } else {
        setOllamaConnected(false);
      }
    } catch {
      setOllamaConnected(false);
    } finally {
      setTesting(false);
    }
  };

  return (
    <div className="flex flex-col h-full">
      <div className="panel-header">
        <span>⚙️ Settings</span>
      </div>

      {/* Section nav */}
      <div className="flex border-b border-ide-border overflow-x-auto">
        {([
          { id: 'ai', label: '🤖 AI' },
          { id: 'remix', label: '⟠ Remix' },
          { id: 'rag', label: '🕸️ RAG' },
          { id: 'general', label: '🎨 General' },
          { id: 'about', label: 'ℹ️ About' },
        ] as const).map((s) => (
          <button
            key={s.id}
            onClick={() => setSection(s.id)}
            className={`tab-btn whitespace-nowrap ${section === s.id ? 'active' : ''}`}
          >
            {s.label}
          </button>
        ))}
      </div>

      <div className="flex-1 overflow-y-auto p-3 space-y-4">
        {section === 'ai' && (
          <>
            {/* Ollama Connection */}
            <SettingGroup title="Ollama Connection">
              <div className="flex items-center gap-2 mb-2">
                <span className={`w-2 h-2 rounded-full ${ollamaConnected ? 'bg-green-400' : 'bg-red-400'}`} />
                <span className="text-xs">{ollamaConnected ? 'Connected' : 'Disconnected'}</span>
              </div>
              <div className="flex gap-2">
                <input
                  value={urlInput}
                  onChange={(e) => setUrlInput(e.target.value)}
                  placeholder="http://localhost:11434"
                  className="input-field flex-1"
                />
                <button onClick={handleTestConnection} className="action-btn" disabled={testing}>
                  {testing ? '⏳' : '🔌'} Test
                </button>
              </div>
            </SettingGroup>

            {/* Default Model */}
            <SettingGroup title="Default Model">
              <select
                value={chatModel}
                onChange={(e) => setChatModel(e.target.value)}
                className="input-field text-xs"
              >
                {availableModels.length > 0 ? (
                  availableModels.map((m) => (
                    <option key={m.name} value={m.name}>
                      {m.name} ({m.size})
                    </option>
                  ))
                ) : (
                  <option value={chatModel}>{chatModel}</option>
                )}
              </select>
            </SettingGroup>

            {/* Available Models */}
            <SettingGroup title={`Available Models (${availableModels.length})`}>
              {availableModels.length === 0 ? (
                <p className="text-[10px] text-ide-text-dim">
                  No models found. Connect to Ollama first.
                </p>
              ) : (
                <div className="space-y-1 max-h-48 overflow-y-auto">
                  {availableModels.map((m) => (
                    <div
                      key={m.name}
                      className="flex items-center justify-between text-[10px] px-2 py-1 bg-ide-bg rounded"
                    >
                      <span className="text-ide-text">{m.name}</span>
                      <span className="text-ide-text-dim">{m.size}</span>
                    </div>
                  ))}
                </div>
              )}
            </SettingGroup>

            {/* Chat Settings */}
            <SettingGroup title="Chat Behavior">
              <SettingToggle label="Stream responses" defaultChecked />
              <SettingToggle label="Include RAG context in prompts" />
              <SettingToggle label="Auto-include active file context" defaultChecked />
              <SettingToggle label="Show token usage" />
            </SettingGroup>

            {/* Provider / Model */}
            <SettingGroup title="AI Provider">
              <select
                value={aiProvider}
                onChange={(e) => {
                  const p = e.target.value as any;
                  setAiProvider(p);
                  // keep chat model in sync when provider switches
                  setChatModel(aiModel);
                }}
                className="input-field text-xs mb-2 w-32"
              >
                <option value="ollama">Ollama</option>
                <option value="openrouter">OpenRouter</option>
                <option value="ollamafree">OllamaFree</option>
                <option value="gptoss">GPTOSS</option>
              </select>
              <div>
                <label className="text-[10px] text-ide-text-dim mb-1 block">Default Model</label>
                <input
                  type="text"
                  value={aiModel}
                  onChange={(e) => {
                    const m = e.target.value;
                    setAiModel(m);
                    setChatModel(m);
                  }}
                  className="input-field text-xs"
                  placeholder="model name or id"
                />
              </div>
            </SettingGroup>
          </>
        )}

        {section === 'remix' && (
          <>
            <SettingGroup title="Solidity Compiler">
              <div className="space-y-2">
                <div>
                  <label className="block text-[10px] text-ide-text-dim mb-1">Default Compiler Version</label>
                  <select className="input-field text-xs">
                    <option>0.8.24</option>
                    <option>0.8.23</option>
                    <option>0.8.22</option>
                    <option>0.8.21</option>
                    <option>0.8.20</option>
                  </select>
                </div>
                <SettingToggle label="Auto compile on save" />
                <SettingToggle label="Enable optimization" />
                <div>
                  <label className="block text-[10px] text-ide-text-dim mb-1">Optimization Runs</label>
                  <input type="number" defaultValue={200} className="input-field" />
                </div>
              </div>
            </SettingGroup>

            <SettingGroup title="Deploy Environment">
              <select className="input-field text-xs">
                <option>JavaScript VM (London)</option>
                <option>Injected Provider (MetaMask)</option>
                <option>Atlas Testnet (ws://127.0.0.1:9944)</option>
                <option>Custom RPC</option>
              </select>
            </SettingGroup>

            <SettingGroup title="Debugging">
              <SettingToggle label="Enable step-through debugger" defaultChecked />
              <SettingToggle label="Show gas estimates in gutter" defaultChecked />
              <SettingToggle label="Highlight storage slots" />
            </SettingGroup>
          </>
        )}

        {section === 'rag' && (
          <>
            <SettingGroup title="Crawl4AI Settings">
              <div>
                <label className="block text-[10px] text-ide-text-dim mb-1">Default Crawl Depth</label>
                <select className="input-field text-xs">
                  <option value="1">1 - Single page</option>
                  <option value="2">2 - Follow links</option>
                  <option value="3">3 - Deep crawl</option>
                </select>
              </div>
              <SettingToggle label="Extract structured data (tables, code blocks)" defaultChecked />
              <SettingToggle label="Follow external links" />
            </SettingGroup>

            <SettingGroup title="Vector Store">
              <div>
                <label className="block text-[10px] text-ide-text-dim mb-1">Backend</label>
                <select className="input-field text-xs">
                  <option>SQLite (local)</option>
                  <option>Supabase (remote)</option>
                  <option>ChromaDB (local)</option>
                </select>
              </div>
              <div>
                <label className="block text-[10px] text-ide-text-dim mb-1">Embedding Model</label>
                <select className="input-field text-xs">
                  <option>nomic-embed-text (Ollama)</option>
                  <option>all-MiniLM-L6-v2 (local)</option>
                  <option>text-embedding-3-small (OpenAI)</option>
                </select>
              </div>
              <div>
                <label className="block text-[10px] text-ide-text-dim mb-1">Chunk Size</label>
                <input type="number" defaultValue={512} className="input-field" />
              </div>
              <div>
                <label className="block text-[10px] text-ide-text-dim mb-1">Chunk Overlap</label>
                <input type="number" defaultValue={50} className="input-field" />
              </div>
            </SettingGroup>

            <SettingGroup title="Search Strategy">
              <div>
                <label className="block text-[10px] text-ide-text-dim mb-1">Default Mode</label>
                <select className="input-field text-xs">
                  <option value="hybrid">Hybrid (semantic + keyword)</option>
                  <option value="semantic">Semantic only</option>
                  <option value="keyword">Keyword only</option>
                </select>
              </div>
              <div>
                <label className="block text-[10px] text-ide-text-dim mb-1">Max Results</label>
                <input type="number" defaultValue={10} className="input-field" />
              </div>
              <SettingToggle label="Enable hallucination detection" />
              <SettingToggle label="Knowledge graph linking (Neo4j)" />
            </SettingGroup>
          </>
        )}

        {section === 'general' && (
          <>
            <SettingGroup title="Workspace">
              <div className="flex gap-2">
                <input
                  value={workspaceRootInput}
                  onChange={(e) => setWorkspaceRootInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      setWorkspaceRoot(workspaceRootInput.trim() || '.');
                    }
                  }}
                  className="input-field flex-1"
                  placeholder="."
                />
                <button
                  onClick={() => setWorkspaceRoot(workspaceRootInput.trim() || '.')}
                  className="action-btn text-xs"
                >
                  Apply
                </button>
                <button
                  onClick={() => addWorkspaceFavorite(workspaceRoot)}
                  className="action-btn text-xs"
                  title="Save current root"
                >
                  ☆
                </button>
              </div>
              <div className="flex flex-wrap gap-1">
                {favoriteWorkspaceRoots.map((root) => (
                  <div key={root} className="flex items-center rounded bg-ide-bg border border-ide-border">
                    <button
                      onClick={() => setWorkspaceRoot(root)}
                      className={`px-2 py-1 text-[10px] ${
                        workspaceRoot === root
                          ? 'text-ide-accent'
                          : 'text-ide-text-dim hover:text-ide-text'
                      }`}
                    >
                      {root}
                    </button>
                    {root !== '.' && (
                      <button
                        onClick={() => removeWorkspaceFavorite(root)}
                        className="px-1 text-[10px] text-ide-text-dim hover:text-red-400"
                      >
                        ✕
                      </button>
                    )}
                  </div>
                ))}
              </div>
            </SettingGroup>

            <SettingGroup title="Appearance">
              <div>
                <label className="block text-[10px] text-ide-text-dim mb-1">Theme</label>
                <select className="input-field text-xs">
                  <option>Atlas Dark (default)</option>
                  <option>Atlas Light</option>
                  <option>Monokai</option>
                  <option>Dracula</option>
                  <option>One Dark Pro</option>
                </select>
              </div>
              <div>
                <label className="block text-[10px] text-ide-text-dim mb-1">Editor Font Size</label>
                <input type="number" defaultValue={14} className="input-field" />
              </div>
              <div>
                <label className="block text-[10px] text-ide-text-dim mb-1">Font Family</label>
                <input defaultValue="JetBrains Mono, monospace" className="input-field text-xs" />
              </div>
            </SettingGroup>

            <SettingGroup title="Editor">
              <SettingToggle
                label="Word wrap"
                checked={editorWordWrap}
                onChange={setEditorWordWrap}
              />
              <SettingToggle
                label="Minimap"
                checked={editorMinimap}
                onChange={setEditorMinimap}
              />
              <SettingToggle label="Line numbers" defaultChecked />
              <SettingToggle label="Bracket pair colorization" defaultChecked />
              <SettingToggle label="Format on save" defaultChecked />
            </SettingGroup>

            <SettingGroup title="Layout">
              <SettingToggle label="Show activity bar" defaultChecked />
              <SettingToggle label="Show status bar" defaultChecked />
              <SettingToggle label="Show bottom panel by default" />
            </SettingGroup>
          </>
        )}

        {section === 'about' && (
          <div className="space-y-4">
            <div className="text-center py-4">
              <p className="text-2xl mb-2">🔮</p>
              <h2 className="text-lg font-bold">Atlas SuperIDE</h2>
              <p className="text-xs text-ide-text-dim">v0.1.0-alpha</p>
            </div>

            <div className="bg-ide-bg rounded border border-ide-border p-3 text-xs space-y-2">
              <p className="font-medium">Built from the best of:</p>
              <ul className="list-disc list-inside text-ide-text-dim space-y-0.5">
                <li>Remix IDE — Solidity compiler, deployer, debugger</li>
                <li>OpenClaw — Ollama AI provider integration</li>
                <li>Open NotebookLM — Document → conversation AI</li>
                <li>Traycer — Codebase analysis & task planning</li>
                <li>Chat Ralph — Persistent knowledge base</li>
                <li>Context Engineering — PRP workflow</li>
                <li>Crawl4AI RAG — Web crawling + vector search</li>
                <li>Second Brain Dashboard — Generative UI research</li>
                <li>Second Brain Skills — Extensible skills framework</li>
              </ul>
            </div>

            <div className="bg-ide-bg rounded border border-ide-border p-3 text-xs space-y-1">
              <p className="font-medium">System Info</p>
              <p className="text-ide-text-dim">Frontend: React 19 + Vite 6 + TypeScript</p>
              <p className="text-ide-text-dim">Backend: Python FastAPI</p>
              <p className="text-ide-text-dim">AI Runtime: Ollama (local)</p>
              <p className="text-ide-text-dim">Desktop: Tauri (optional)</p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// Reusable setting components
function SettingGroup({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <h3 className="text-[10px] uppercase tracking-wider text-ide-text-dim mb-2 font-medium">
        {title}
      </h3>
      <div className="space-y-2">{children}</div>
    </div>
  );
}

function SettingToggle({
  label,
  defaultChecked,
  checked: controlledChecked,
  onChange,
}: {
  label: string;
  defaultChecked?: boolean;
  checked?: boolean;
  onChange?: (checked: boolean) => void;
}) {
  const [internalChecked, setInternalChecked] = useState(defaultChecked ?? false);
  const checked = controlledChecked ?? internalChecked;

  const toggle = () => {
    const next = !checked;
    if (controlledChecked === undefined) {
      setInternalChecked(next);
    }
    onChange?.(next);
  };

  return (
    <label className="flex items-center gap-2 cursor-pointer">
      <div
        className={`w-8 h-4 rounded-full relative transition-colors ${
          checked ? 'bg-ide-accent' : 'bg-ide-border'
        }`}
        onClick={toggle}
      >
        <div
          className={`absolute top-0.5 w-3 h-3 rounded-full bg-white transition-transform ${
            checked ? 'translate-x-4' : 'translate-x-0.5'
          }`}
        />
      </div>
      <span className="text-xs text-ide-text">{label}</span>
    </label>
  );
}

function formatBytes(bytes: number): string {
  if (!bytes) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`;
}
