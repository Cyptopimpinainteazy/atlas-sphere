import { useEffect, useState } from 'react';
import { useIDEStore } from '../../store/ideStore';
import {
  mcpCallTool,
  mcpDeleteServer,
  mcpListServers,
  mcpListTools,
  mcpSaveServer,
  mcpTestServer,
  openclawGetConfig,
  openclawSaveConfig,
  type McpServerConfig,
  type McpToolDefinition,
} from '../../lib/api';

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
    noAddModeEnabled,
    noAddObjective,
    noAddDefinitionOfDone,
    noAddRoleProfile,
    setNoAddModeEnabled,
    setNoAddObjective,
    setNoAddDefinitionOfDone,
    setNoAddRoleProfile,
    clearNoAddFocus,
    openClawConfig,
    setOpenClawConfig,
  } = useIDEStore();

  const [section, setSection] = useState<'general' | 'ai' | 'mcp' | 'openclaw' | 'remix' | 'rag' | 'about'>('ai');
  const [urlInput, setUrlInput] = useState(ollamaUrl);
  const [workspaceRootInput, setWorkspaceRootInput] = useState(workspaceRoot);
  const [testing, setTesting] = useState(false);
  const [mcpServers, setMcpServers] = useState<McpServerConfig[]>([]);
  const [mcpTools, setMcpTools] = useState<Record<string, McpToolDefinition[]>>({});
  const [mcpStatus, setMcpStatus] = useState('');
  const [mcpSaving, setMcpSaving] = useState(false);
  const [mcpRunning, setMcpRunning] = useState(false);
  const [mcpForm, setMcpForm] = useState<McpServerConfig>({
    name: '',
    transport: 'streamable-http',
    url: '',
    command: '',
    args: [],
    cwd: '.',
    env: {},
    headers: {},
  });
  const [mcpRunnerServer, setMcpRunnerServer] = useState('');
  const [mcpRunnerTool, setMcpRunnerTool] = useState('');
  const [mcpRunnerArgs, setMcpRunnerArgs] = useState('{}');
  const [mcpRunnerOutput, setMcpRunnerOutput] = useState('');
  const [openClawStatus, setOpenClawStatus] = useState('');
  const [openClawSaving, setOpenClawSaving] = useState(false);

  useEffect(() => {
    setWorkspaceRootInput(workspaceRoot);
  }, [workspaceRoot]);

  useEffect(() => {
    if (section !== 'mcp') {
      return;
    }

    void loadMcpServers();
  }, [section]);

  useEffect(() => {
    if (section !== 'openclaw') {
      return;
    }

    let cancelled = false;

    const loadOpenClawConfig = async () => {
      try {
        const config = await openclawGetConfig();
        if (!cancelled) {
          setOpenClawConfig(config);
          setOpenClawStatus('');
        }
      } catch (err) {
        if (!cancelled) {
          setOpenClawStatus(err instanceof Error ? err.message : 'Failed to load OpenClaw config.');
        }
      }
    };

    void loadOpenClawConfig();
    return () => {
      cancelled = true;
    };
  }, [section, setOpenClawConfig]);

  const loadMcpServers = async () => {
    try {
      const servers = await mcpListServers();
      setMcpServers(servers);
      if (servers.length > 0) {
        const defaultServer = servers.some((server) => server.name === mcpRunnerServer)
          ? mcpRunnerServer
          : servers[0].name;
        setMcpRunnerServer(defaultServer);
      } else {
        setMcpRunnerServer('');
        setMcpRunnerTool('');
      }
      setMcpStatus('');
    } catch (err) {
      setMcpStatus(err instanceof Error ? err.message : 'Failed to load MCP servers.');
    }
  };

  const handleSaveMcpServer = async () => {
    if (!mcpForm.name.trim()) {
      setMcpStatus('Name is required.');
      return;
    }
    if (mcpForm.transport === 'streamable-http' && !mcpForm.url?.trim()) {
      setMcpStatus('URL is required for streamable HTTP MCP servers.');
      return;
    }
    if (mcpForm.transport === 'stdio' && !mcpForm.command?.trim()) {
      setMcpStatus('Command is required for stdio MCP servers.');
      return;
    }

    setMcpSaving(true);
    try {
      const payload: McpServerConfig = {
        ...mcpForm,
        name: mcpForm.name.trim(),
        url: mcpForm.url?.trim() || '',
        command: mcpForm.command?.trim() || '',
        cwd: mcpForm.cwd?.trim() || '.',
        args:
          mcpForm.args && Array.isArray(mcpForm.args)
            ? mcpForm.args
            : [],
      };
      await mcpSaveServer(payload);
      setMcpStatus(`Saved MCP server ${payload.name}.`);
      setMcpForm({
        name: '',
        transport: 'streamable-http',
        url: '',
        command: '',
        args: [],
        cwd: '.',
        env: {},
        headers: {},
      });
      await loadMcpServers();
    } catch (err) {
      setMcpStatus(err instanceof Error ? err.message : 'Failed to save MCP server.');
    } finally {
      setMcpSaving(false);
    }
  };

  const handleTestMcpServer = async (name: string) => {
    try {
      await mcpTestServer(name);
      setMcpStatus(`Connected to ${name}.`);
    } catch (err) {
      setMcpStatus(err instanceof Error ? err.message : `Failed to connect to ${name}.`);
    }
  };

  const handleListMcpTools = async (name: string) => {
    try {
      const tools = await mcpListTools(name);
      setMcpTools((prev) => ({ ...prev, [name]: tools }));
      if (name === mcpRunnerServer || !mcpRunnerServer) {
        setMcpRunnerServer(name);
        setMcpRunnerTool((current) =>
          tools.some((tool) => tool.name === current) ? current : (tools[0]?.name || ''),
        );
      }
      setMcpStatus(`Loaded ${tools.length} tool(s) from ${name}.`);
    } catch (err) {
      setMcpStatus(err instanceof Error ? err.message : `Failed to load tools for ${name}.`);
    }
  };

  const handleDeleteMcpServer = async (name: string) => {
    try {
      await mcpDeleteServer(name);
      setMcpTools((prev) => {
        const next = { ...prev };
        delete next[name];
        return next;
      });
      setMcpStatus(`Deleted MCP server ${name}.`);
      await loadMcpServers();
    } catch (err) {
      setMcpStatus(err instanceof Error ? err.message : `Failed to delete ${name}.`);
    }
  };

  const handleRunMcpTool = async () => {
    if (!mcpRunnerServer) {
      setMcpStatus('Choose an MCP server before running a tool.');
      return;
    }
    if (!mcpRunnerTool) {
      setMcpStatus('Choose an MCP tool to run.');
      return;
    }

    let parsedArgs: Record<string, any> = {};
    try {
      parsedArgs = JSON.parse(mcpRunnerArgs || '{}');
      if (!parsedArgs || typeof parsedArgs !== 'object' || Array.isArray(parsedArgs)) {
        setMcpStatus('Tool arguments must be a JSON object.');
        return;
      }
    } catch {
      setMcpStatus('Tool arguments must be valid JSON.');
      return;
    }

    setMcpRunning(true);
    setMcpRunnerOutput('');
    try {
      const result = await mcpCallTool(mcpRunnerServer, mcpRunnerTool, parsedArgs);
      setMcpRunnerOutput(JSON.stringify(result, null, 2));
      setMcpStatus(`Ran ${mcpRunnerTool} on ${mcpRunnerServer}.`);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to run MCP tool.';
      setMcpRunnerOutput(`Error: ${message}`);
      setMcpStatus(message);
    } finally {
      setMcpRunning(false);
    }
  };

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

  const runnerTools = mcpRunnerServer ? (mcpTools[mcpRunnerServer] || []) : [];
  const selectedRunnerTool = runnerTools.find((tool) => tool.name === mcpRunnerTool);

  const handleSaveOpenClaw = async () => {
    setOpenClawSaving(true);
    try {
      const saved = await openclawSaveConfig(openClawConfig);
      setOpenClawConfig(saved);
      setOpenClawStatus('Saved OpenClaw config.');
    } catch (err) {
      setOpenClawStatus(err instanceof Error ? err.message : 'Failed to save OpenClaw config.');
    } finally {
      setOpenClawSaving(false);
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
          { id: 'mcp', label: '🔌 MCP' },
          { id: 'openclaw', label: '🛠️ OpenClaw' },
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

        {section === 'mcp' && (
          <>
            <SettingGroup title="Add MCP Server">
              <div className="space-y-2">
                <div>
                  <label className="block text-[10px] text-ide-text-dim mb-1">Server Name</label>
                  <input
                    value={mcpForm.name}
                    onChange={(e) => setMcpForm((prev) => ({ ...prev, name: e.target.value }))}
                    className="input-field text-xs"
                    placeholder="zapier"
                  />
                </div>

                <div>
                  <label className="block text-[10px] text-ide-text-dim mb-1">Transport</label>
                  <select
                    value={mcpForm.transport}
                    onChange={(e) =>
                      setMcpForm((prev) => ({
                        ...prev,
                        transport: e.target.value as McpServerConfig['transport'],
                      }))
                    }
                    className="input-field text-xs"
                  >
                    <option value="streamable-http">Streamable HTTP</option>
                    <option value="stdio">stdio</option>
                  </select>
                </div>

                {mcpForm.transport === 'streamable-http' ? (
                  <>
                    <div>
                      <label className="block text-[10px] text-ide-text-dim mb-1">URL</label>
                      <input
                        value={mcpForm.url || ''}
                        onChange={(e) => setMcpForm((prev) => ({ ...prev, url: e.target.value }))}
                        className="input-field text-xs"
                        placeholder="https://example.com/mcp"
                      />
                    </div>
                    <div>
                      <label className="block text-[10px] text-ide-text-dim mb-1">Headers (JSON)</label>
                      <textarea
                        value={JSON.stringify(mcpForm.headers || {}, null, 2)}
                        onChange={(e) => {
                          try {
                            const parsed = JSON.parse(e.target.value || '{}');
                            setMcpForm((prev) => ({ ...prev, headers: parsed }));
                            setMcpStatus('');
                          } catch {
                            setMcpStatus('Headers must be valid JSON.');
                          }
                        }}
                        rows={4}
                        className="input-field resize-none font-mono text-xs"
                      />
                    </div>
                  </>
                ) : (
                  <>
                    <div>
                      <label className="block text-[10px] text-ide-text-dim mb-1">Command</label>
                      <input
                        value={mcpForm.command || ''}
                        onChange={(e) => setMcpForm((prev) => ({ ...prev, command: e.target.value }))}
                        className="input-field text-xs"
                        placeholder="npx"
                      />
                    </div>
                    <div>
                      <label className="block text-[10px] text-ide-text-dim mb-1">Args (space separated)</label>
                      <input
                        value={(mcpForm.args || []).join(' ')}
                        onChange={(e) =>
                          setMcpForm((prev) => ({
                            ...prev,
                            args: e.target.value.split(' ').map((part) => part.trim()).filter(Boolean),
                          }))
                        }
                        className="input-field text-xs"
                        placeholder="-y @modelcontextprotocol/server-filesystem ."
                      />
                    </div>
                    <div>
                      <label className="block text-[10px] text-ide-text-dim mb-1">Working Directory</label>
                      <input
                        value={mcpForm.cwd || '.'}
                        onChange={(e) => setMcpForm((prev) => ({ ...prev, cwd: e.target.value }))}
                        className="input-field text-xs"
                        placeholder="."
                      />
                    </div>
                    <div>
                      <label className="block text-[10px] text-ide-text-dim mb-1">Environment (JSON)</label>
                      <textarea
                        value={JSON.stringify(mcpForm.env || {}, null, 2)}
                        onChange={(e) => {
                          try {
                            const parsed = JSON.parse(e.target.value || '{}');
                            setMcpForm((prev) => ({ ...prev, env: parsed }));
                            setMcpStatus('');
                          } catch {
                            setMcpStatus('Environment must be valid JSON.');
                          }
                        }}
                        rows={4}
                        className="input-field resize-none font-mono text-xs"
                      />
                    </div>
                  </>
                )}

                <button
                  onClick={handleSaveMcpServer}
                  className="action-btn text-xs"
                  disabled={mcpSaving}
                >
                  {mcpSaving ? 'Saving...' : 'Save MCP Server'}
                </button>
              </div>
            </SettingGroup>

            <SettingGroup title={`Configured Servers (${mcpServers.length})`}>
              {mcpServers.length === 0 ? (
                <p className="text-[10px] text-ide-text-dim">
                  No MCP servers configured yet.
                </p>
              ) : (
                <div className="space-y-2">
                  {mcpServers.map((server) => (
                    <div key={server.name} className="bg-ide-bg rounded border border-ide-border p-2 space-y-2">
                      <div className="flex items-center justify-between gap-2">
                        <div>
                          <p className="text-xs font-medium">{server.name}</p>
                          <p className="text-[10px] text-ide-text-dim">
                            {server.transport === 'streamable-http'
                              ? server.url
                              : [server.command, ...(server.args || [])].filter(Boolean).join(' ')}
                          </p>
                        </div>
                        <span className="text-[10px] text-ide-text-dim">{server.transport}</span>
                      </div>

                      <div className="flex gap-2">
                        <button onClick={() => void handleTestMcpServer(server.name)} className="action-btn text-xs flex-1">
                          Test
                        </button>
                        <button onClick={() => void handleListMcpTools(server.name)} className="action-btn text-xs flex-1">
                          Tools
                        </button>
                        <button onClick={() => void handleDeleteMcpServer(server.name)} className="action-btn text-xs flex-1">
                          Delete
                        </button>
                      </div>

                      {mcpTools[server.name]?.length ? (
                        <div className="space-y-1">
                          {mcpTools[server.name].map((tool) => (
                            <div key={tool.name} className="text-[10px] rounded bg-ide-surface px-2 py-1">
                              <span className="text-ide-text">{tool.name}</span>
                              {tool.description && (
                                <span className="text-ide-text-dim"> — {tool.description}</span>
                              )}
                            </div>
                          ))}
                        </div>
                      ) : null}
                    </div>
                  ))}
                </div>
              )}

              {mcpStatus && <p className="text-[10px] text-ide-text-dim mt-2">{mcpStatus}</p>}
            </SettingGroup>

            <SettingGroup title="Run MCP Tool">
              {mcpServers.length === 0 ? (
                <p className="text-[10px] text-ide-text-dim">
                  Save a server first, then you can run tools from this panel.
                </p>
              ) : (
                <div className="space-y-2">
                  <div>
                    <label className="block text-[10px] text-ide-text-dim mb-1">Server</label>
                    <div className="flex gap-2">
                      <select
                        value={mcpRunnerServer}
                        onChange={(e) => {
                          const nextServer = e.target.value;
                          setMcpRunnerServer(nextServer);
                          const nextTools = mcpTools[nextServer] || [];
                          setMcpRunnerTool((current) =>
                            nextTools.some((tool) => tool.name === current) ? current : (nextTools[0]?.name || ''),
                          );
                        }}
                        className="input-field text-xs flex-1"
                      >
                        {mcpServers.map((server) => (
                          <option key={server.name} value={server.name}>
                            {server.name}
                          </option>
                        ))}
                      </select>
                      <button
                        onClick={() => void handleListMcpTools(mcpRunnerServer)}
                        className="action-btn text-xs"
                        disabled={!mcpRunnerServer}
                      >
                        Refresh Tools
                      </button>
                    </div>
                  </div>

                  <div>
                    <label className="block text-[10px] text-ide-text-dim mb-1">Tool</label>
                    <select
                      value={mcpRunnerTool}
                      onChange={(e) => setMcpRunnerTool(e.target.value)}
                      className="input-field text-xs"
                      disabled={runnerTools.length === 0}
                    >
                      {runnerTools.length === 0 ? (
                        <option value="">
                          {mcpRunnerServer ? 'Load tools first' : 'Choose a server'}
                        </option>
                      ) : (
                        runnerTools.map((tool) => (
                          <option key={tool.name} value={tool.name}>
                            {tool.name}
                          </option>
                        ))
                      )}
                    </select>
                    {selectedRunnerTool?.description && (
                      <p className="mt-1 text-[10px] text-ide-text-dim">{selectedRunnerTool.description}</p>
                    )}
                  </div>

                  <div>
                    <label className="block text-[10px] text-ide-text-dim mb-1">Arguments (JSON object)</label>
                    <textarea
                      value={mcpRunnerArgs}
                      onChange={(e) => setMcpRunnerArgs(e.target.value)}
                      rows={6}
                      className="input-field resize-none font-mono text-xs"
                      placeholder={JSON.stringify({ key: 'value' }, null, 2)}
                    />
                    {selectedRunnerTool?.inputSchema && (
                      <details className="mt-2 rounded border border-ide-border bg-ide-bg p-2">
                        <summary className="cursor-pointer text-[10px] text-ide-text-dim">
                          Tool Input Schema
                        </summary>
                        <pre className="mt-2 max-h-40 overflow-y-auto whitespace-pre-wrap text-[10px] text-ide-text">
                          {JSON.stringify(selectedRunnerTool.inputSchema, null, 2)}
                        </pre>
                      </details>
                    )}
                  </div>

                  <button
                    onClick={handleRunMcpTool}
                    className="action-btn text-xs"
                    disabled={mcpRunning || !mcpRunnerServer || !mcpRunnerTool}
                  >
                    {mcpRunning ? 'Running...' : 'Run Tool'}
                  </button>

                  {mcpRunnerOutput && (
                    <pre className="max-h-64 overflow-y-auto rounded border border-ide-border bg-ide-bg p-2 whitespace-pre-wrap text-[10px] text-ide-text">
                      {mcpRunnerOutput}
                    </pre>
                  )}
                </div>
              )}
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

            <SettingGroup title="RALPH Mode">
              <SettingToggle
                label="Fresh-context focus lock"
                checked={noAddModeEnabled}
                onChange={setNoAddModeEnabled}
              />
              <div>
                <label className="block text-[10px] text-ide-text-dim mb-1">Anchor Task</label>
                <textarea
                  value={noAddObjective}
                  onChange={(e) => setNoAddObjective(e.target.value)}
                  rows={3}
                  className="input-field resize-none text-xs"
                  placeholder="Define the one task Ralph mode should keep driving toward."
                />
              </div>
              <div>
                <label className="block text-[10px] text-ide-text-dim mb-1">Success Criteria</label>
                <textarea
                  value={noAddDefinitionOfDone}
                  onChange={(e) => setNoAddDefinitionOfDone(e.target.value)}
                  rows={4}
                  className="input-field resize-none text-xs"
                  placeholder="List the exact checks required before this work is considered complete."
                />
              </div>
              <div>
                <label className="block text-[10px] text-ide-text-dim mb-1">Guardrail Profile</label>
                <textarea
                  value={noAddRoleProfile}
                  onChange={(e) => setNoAddRoleProfile(e.target.value)}
                  rows={5}
                  className="input-field resize-none text-xs"
                />
              </div>
              <button
                onClick={clearNoAddFocus}
                className="action-btn text-xs"
                disabled={!noAddModeEnabled && !noAddObjective && !noAddDefinitionOfDone}
              >
                Reset Ralph State
              </button>
            </SettingGroup>

            <SettingGroup title="Layout">
              <SettingToggle label="Show activity bar" defaultChecked />
              <SettingToggle label="Show status bar" defaultChecked />
              <SettingToggle label="Show bottom panel by default" />
            </SettingGroup>
          </>
        )}

        {section === 'openclaw' && (
          <>
            <SettingGroup title="Gateway">
              <div className="space-y-2">
                <input
                  value={openClawConfig.baseUrl}
                  onChange={(e) => setOpenClawConfig({ baseUrl: e.target.value })}
                  placeholder="http://127.0.0.1:18789"
                  className="input-field"
                />
                <input
                  value={openClawConfig.toolEndpoint}
                  onChange={(e) => setOpenClawConfig({ toolEndpoint: e.target.value })}
                  placeholder="/api/tools/invoke"
                  className="input-field"
                />
                <input
                  value={openClawConfig.gatewayToken}
                  onChange={(e) => setOpenClawConfig({ gatewayToken: e.target.value })}
                  placeholder="Gateway token (optional)"
                  className="input-field"
                  type="password"
                />
              </div>
            </SettingGroup>

            <SettingGroup title="Tool Policy Defaults">
              <div className="grid grid-cols-2 gap-2">
                <select
                  value={openClawConfig.defaultProfile}
                  onChange={(e) =>
                    setOpenClawConfig({
                      defaultProfile: e.target.value as typeof openClawConfig.defaultProfile,
                    })
                  }
                  className="input-field text-xs"
                >
                  <option value="minimal">minimal</option>
                  <option value="coding">coding</option>
                  <option value="messaging">messaging</option>
                  <option value="full">full</option>
                </select>
                <select
                  value={openClawConfig.webProvider}
                  onChange={(e) =>
                    setOpenClawConfig({
                      webProvider: e.target.value as typeof openClawConfig.webProvider,
                    })
                  }
                  className="input-field text-xs"
                >
                  <option value="brave">brave</option>
                  <option value="perplexity">perplexity</option>
                  <option value="gemini">gemini</option>
                  <option value="grok">grok</option>
                  <option value="kimi">kimi</option>
                </select>
              </div>
              <label className="flex items-center gap-2 text-xs">
                <input
                  type="checkbox"
                  checked={openClawConfig.loopDetectionEnabled}
                  onChange={(e) => setOpenClawConfig({ loopDetectionEnabled: e.target.checked })}
                />
                Enable loop-detection defaults
              </label>
              <button onClick={() => void handleSaveOpenClaw()} className="action-btn" disabled={openClawSaving}>
                {openClawSaving ? 'Saving...' : 'Save OpenClaw Config'}
              </button>
              <div className="text-xs text-ide-text-dim">
                {openClawConfig.baseUrl
                  ? `OpenClaw proxy target: ${openClawConfig.baseUrl}${openClawConfig.toolEndpoint}`
                  : 'Set an OpenClaw base URL before running tools.'}
              </div>
              {openClawStatus && (
                <div className="rounded bg-ide-surface px-2 py-1 text-xs text-ide-text-dim">
                  {openClawStatus}
                </div>
              )}
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
