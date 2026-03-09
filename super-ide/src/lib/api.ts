/**
 * Atlas SuperIDE — Unified API client
 * Talks to both the Python backend and Ollama directly.
 */

const BACKEND_URL = import.meta.env.VITE_BACKEND_URL || 'http://localhost:8420';
const OLLAMA_URL = import.meta.env.VITE_OLLAMA_URL || 'http://localhost:11434';

async function parseJsonResponse(res: Response, fallbackMessage: string) {
  let data: any = null;
  try {
    data = await res.json();
  } catch {
    data = null;
  }

  if (!res.ok) {
    const detail =
      data?.detail ||
      data?.error ||
      data?.message ||
      `${fallbackMessage} (${res.status})`;
    throw new Error(detail);
  }

  return data;
}

export interface WorkspaceFileSearchResult {
  name: string;
  path: string;
  type: 'file';
  score: number;
}

export interface CodeSearchResult {
  name: string;
  path: string;
  line: number;
  snippet: string;
  score: number;
}

export interface WorkspaceFileResponse {
  path: string;
  content: string;
}

export interface WorkspaceTreeNode {
  name: string;
  path: string;
  type: 'file' | 'dir';
  children?: WorkspaceTreeNode[];
}

export interface SkillInputDefinition {
  name: string;
  type: string;
  required: boolean;
  description: string;
}

export interface SkillRegistryEntry {
  id: string;
  name: string;
  description: string;
  category: string;
  inputs: SkillInputDefinition[];
  displayName?: string | null;
  shortDescription?: string | null;
  defaultPrompt?: string | null;
  status?: 'available' | 'installed' | 'planned';
  source?: 'backend' | 'local' | 'local+backend' | 'planned';
  executionMode?: 'backend' | 'package' | 'hybrid' | 'planned';
  recommendedMode?: 'chat' | 'task-plan' | 'context-eng';
  path?: string | null;
  uiMetadataPath?: string | null;
  triggers?: string[];
  notes?: string;
}

export interface TerminalSessionResponse {
  session_id: string;
  cwd: string;
  transport: 'pty' | 'pipe';
}

export interface TerminalExecResponse {
  session_id: string;
  cwd: string;
  stdout: string;
  stderr: string;
  exit_code: number;
}

export interface McpServerConfig {
  name: string;
  transport: 'streamable-http' | 'stdio';
  url?: string | null;
  command?: string | null;
  args?: string[];
  cwd?: string | null;
  env?: Record<string, string>;
  headers?: Record<string, string>;
}

export interface McpToolDefinition {
  name: string;
  description?: string;
  inputSchema?: Record<string, any>;
}

export interface AgentProfilePayload {
  id: string;
  name: string;
  role: string;
  provider: 'ollama' | 'openrouter' | 'ollamafree' | 'gptoss';
  model: string;
  systemPrompt: string;
  openclawTools?: OpenClawToolPolicy;
  enabled: boolean;
}

export interface RalphStatePayload {
  objective: string;
  definitionOfDone: string;
  roleProfile: string;
}

export interface AgentRunPayload {
  objective: string;
  definitionOfDone: string;
  executionMode: 'parallel' | 'sequential';
  workspaceRoot?: string;
  ralphMode?: boolean;
  ralphLoop?: boolean;
  resumeRalph?: boolean;
  maxIterations?: number;
  ralphState?: RalphStatePayload;
  agents: AgentProfilePayload[];
}

export interface AgentRunResponse {
  [key: string]: any;
}

export type OpenClawToolProfile = 'minimal' | 'coding' | 'messaging' | 'full';

export interface OpenClawProviderPolicyOverride {
  profile?: OpenClawToolProfile;
  allow?: string[];
  deny?: string[];
}

export interface OpenClawToolPolicy {
  profile: OpenClawToolProfile;
  allow: string[];
  deny: string[];
  byProvider: Record<string, OpenClawProviderPolicyOverride>;
}

export interface OpenClawConfig {
  baseUrl: string;
  toolEndpoint: string;
  gatewayToken: string;
  defaultProfile: OpenClawToolProfile;
  webProvider: 'brave' | 'perplexity' | 'gemini' | 'grok' | 'kimi';
  loopDetectionEnabled: boolean;
}

export interface OpenClawToolInventoryEntry {
  name: string;
  category: string;
  summary: string;
  commonActions: string[];
}

export interface OpenClawToolsResponse {
  profiles: OpenClawToolProfile[];
  groups: string[];
  tools: OpenClawToolInventoryEntry[];
}

export interface OpenClawToolRunResponse {
  ok: boolean;
  tool: string;
  endpoint: string;
  result: any;
}

export interface AiWorkspaceContextResponse {
  context: string;
  matches: Array<{
    path: string;
    line: number;
    snippet: string;
    score: number;
  }>;
  files: Array<{
    path: string;
    content: string;
  }>;
}

export interface AiEditFilePayload {
  path: string;
  content: string;
}

export interface RalphTaskState {
  path: string;
  exists: boolean;
  valid: boolean;
  objective: string;
  checklistTotal: number;
  checklistCompleted: number;
  checklistRemaining: number;
  issues: string[];
}

function normalizeWorkspaceRoot(path: string): string {
  const trimmed = path.trim();
  if (!trimmed || trimmed === '.' || trimmed === './') {
    return '.';
  }
  return trimmed.replace(/^\.\//, '').replace(/\/+$/, '') || '.';
}

function buildRalphTaskPath(workspaceRoot: string): string {
  const root = normalizeWorkspaceRoot(workspaceRoot);
  return root === '.' ? '.ralph/ralph_task.md' : `${root}/.ralph/ralph_task.md`;
}

function parseRalphTaskState(content: string, path: string): RalphTaskState {
  const lines = content.split(/\r?\n/);
  let objective = '';
  let inObjective = false;
  let inSuccessCriteria = false;
  let checklistTotal = 0;
  let checklistCompleted = 0;
  const issues: string[] = [];

  for (const rawLine of lines) {
    const line = rawLine.trimEnd();
    const trimmed = line.trim();

    const taskMatch = trimmed.match(/^task:\s*(.+)$/i);
    if (!objective && taskMatch) {
      objective = taskMatch[1].trim();
    }

    if (/^##\s+objective$/i.test(trimmed)) {
      inObjective = true;
      inSuccessCriteria = false;
      continue;
    }

    if (/^##\s+success criteria$/i.test(trimmed)) {
      inObjective = false;
      inSuccessCriteria = true;
      continue;
    }

    if (/^##\s+/.test(trimmed)) {
      inObjective = false;
      inSuccessCriteria = false;
      continue;
    }

    if (inObjective && !objective && trimmed) {
      objective = trimmed;
      continue;
    }

    if (!inSuccessCriteria || !trimmed) {
      continue;
    }

    const checklistMatch = trimmed.match(/^(?:[-*]|\d+\.)\s+\[([ xX])\]\s+(.+)$/);
    if (checklistMatch) {
      checklistTotal += 1;
      if (checklistMatch[1].toLowerCase() === 'x') {
        checklistCompleted += 1;
      }
      continue;
    }

    issues.push(`Invalid checklist line: ${trimmed}`);
  }

  if (!objective) {
    issues.push('Missing task objective.');
  }
  if (!content.match(/^##\s+success criteria$/im)) {
    issues.push('Missing "## success criteria" section.');
  }
  if (checklistTotal === 0) {
    issues.push('No checklist items found.');
  }

  return {
    path,
    exists: true,
    valid: issues.length === 0,
    objective,
    checklistTotal,
    checklistCompleted,
    checklistRemaining: Math.max(0, checklistTotal - checklistCompleted),
    issues,
  };
}

export async function getRalphTaskState(workspaceRoot: string = '.'): Promise<RalphTaskState> {
  const path = buildRalphTaskPath(workspaceRoot);
  const url = new URL(`${BACKEND_URL}/api/file`);
  url.searchParams.set('path', path);
  const res = await fetch(url.toString());

  if (res.status === 404) {
    return {
      path,
      exists: false,
      valid: false,
      objective: '',
      checklistTotal: 0,
      checklistCompleted: 0,
      checklistRemaining: 0,
      issues: ['Missing .ralph/ralph_task.md'],
    };
  }

  const data = await parseJsonResponse(res, `Failed to read ${path}`);
  return parseRalphTaskState(typeof data?.content === 'string' ? data.content : '', path);
}

export async function openclawGetConfig(): Promise<OpenClawConfig> {
  const res = await fetch(`${BACKEND_URL}/api/openclaw/config`);
  return parseJsonResponse(res, 'Failed to load OpenClaw config');
}

export async function openclawSaveConfig(config: OpenClawConfig): Promise<OpenClawConfig> {
  const res = await fetch(`${BACKEND_URL}/api/openclaw/config`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(config),
  });
  return parseJsonResponse(res, 'Failed to save OpenClaw config');
}

export async function openclawListTools(): Promise<OpenClawToolsResponse> {
  const res = await fetch(`${BACKEND_URL}/api/openclaw/tools`);
  return parseJsonResponse(res, 'Failed to load OpenClaw tools');
}

export async function openclawRunTool(
  tool: string,
  input: Record<string, any> = {},
): Promise<OpenClawToolRunResponse> {
  const res = await fetch(`${BACKEND_URL}/api/openclaw/run`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ tool, input }),
  });
  return parseJsonResponse(res, 'Failed to run OpenClaw tool');
}

export async function getAiWorkspaceContext(payload: {
  query: string;
  workspaceRoot?: string;
  activeFilePath?: string;
  activeFileContent?: string;
  openTabs?: string[];
  maxMatches?: number;
  maxFiles?: number;
  maxCharsPerFile?: number;
}): Promise<AiWorkspaceContextResponse> {
  const res = await fetch(`${BACKEND_URL}/api/analyze/workspace-context`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  return parseJsonResponse(res, 'Failed to build workspace context');
}

export async function applyAiWorkspaceEdits(files: AiEditFilePayload[]) {
  const res = await fetch(`${BACKEND_URL}/api/analyze/apply-edits`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ files }),
  });
  return parseJsonResponse(res, 'Failed to apply AI edits');
}

// ── Ollama (OpenClaw-style auto-discovery) ─────────────────────────────
export async function ollamaListModels() {
  const res = await fetch(`${OLLAMA_URL}/api/tags`);
  if (!res.ok) throw new Error('Ollama not reachable');
  const data = await res.json();
  return (data.models || []).map((m: any) => ({
    name: m.name,
    size: formatBytes(m.size),
    quantization: m.details?.quantization_level || 'unknown',
    modified: m.modified_at,
    capabilities: m.details?.families || [],
  }));
}

export async function ollamaShowModel(name: string) {
  const res = await fetch(`${OLLAMA_URL}/api/show`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name }),
  });
  return res.json();
}

export async function openWorkspaceFile(path: string): Promise<WorkspaceFileResponse> {
  const url = new URL(`${BACKEND_URL}/api/file`);
  url.searchParams.set('path', path);
  const res = await fetch(url.toString());
  if (!res.ok) throw new Error(`Failed to open ${path}`);
  return res.json();
}

export async function saveWorkspaceFile(path: string, content: string) {
  const res = await fetch(`${BACKEND_URL}/api/file`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ path, content }),
  });
  if (!res.ok) throw new Error(`Failed to save ${path}`);
  return res.json();
}

export async function getWorkspaceTree(path: string = '.'): Promise<WorkspaceTreeNode[]> {
  const url = new URL(`${BACKEND_URL}/api/files/tree`);
  url.searchParams.set('path', path);
  const res = await fetch(url.toString());
  if (!res.ok) throw new Error(`Failed to load workspace tree for ${path}`);
  const data = await res.json();
  return data.tree || [];
}

export async function searchWorkspaceFiles(
  query: string,
  path: string = '.',
  limit: number = 50,
): Promise<WorkspaceFileSearchResult[]> {
  const url = new URL(`${BACKEND_URL}/api/search/files`);
  url.searchParams.set('q', query);
  url.searchParams.set('path', path);
  url.searchParams.set('limit', String(limit));
  const res = await fetch(url.toString());
  if (!res.ok) throw new Error('File search failed');
  const data = await res.json();
  return data.results || [];
}

export async function searchCodebase(
  query: string,
  path: string = '.',
  limit: number = 25,
): Promise<CodeSearchResult[]> {
  const url = new URL(`${BACKEND_URL}/api/search/codebase`);
  url.searchParams.set('q', query);
  url.searchParams.set('path', path);
  url.searchParams.set('limit', String(limit));
  const res = await fetch(url.toString());
  if (!res.ok) throw new Error('Code search failed');
  const data = await res.json();
  return data.results || [];
}

export async function* ollamaChatStream(
  model: string,
  messages: { role: string; content: string }[],
  signal?: AbortSignal,
) {
  let mode: 'chat' | 'generate' = 'chat';
  let res = await fetch(`${OLLAMA_URL}/api/chat`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ model, messages, stream: true }),
    signal,
  });

  if (res.status === 404) {
    mode = 'generate';
    res = await fetch(`${OLLAMA_URL}/api/generate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model,
        prompt: buildOllamaPrompt(messages),
        stream: true,
      }),
      signal,
    });
  }

  if (!res.ok) throw new Error(`Ollama error: ${res.status}`);
  const reader = res.body!.getReader();
  const decoder = new TextDecoder();
  let buffer = '';

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split('\n');
    buffer = lines.pop() || '';
    for (const line of lines) {
      if (!line.trim()) continue;
      try {
        const data = JSON.parse(line);
        if (mode === 'chat' && data.message?.content) {
          yield data.message.content;
        }
        if (mode === 'generate' && data.response) {
          yield data.response;
        }
        if (data.done) return;
      } catch {
        // partial line, will be completed next chunk
      }
    }
  }
}

// ── RAG (Crawl4AI MCP style) ──────────────────────────────────────────
export async function ragCrawlUrl(url: string, depth?: number) {
  const res = await fetch(`${BACKEND_URL}/api/rag/crawl`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ url, depth }),
  });
  return res.json();
}

export async function ragQuery(query: string, strategy?: string) {
  const res = await fetch(`${BACKEND_URL}/api/rag/query`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ query, strategy }),
  });
  return res.json();
}

export async function ragGetSources() {
  const res = await fetch(`${BACKEND_URL}/api/rag/sources`);
  return res.json();
}

// ── NotebookLM ────────────────────────────────────────────────────────
export async function notebookGenerate(params: {
  sourceType: 'pdf' | 'url' | 'text';
  sourceUrl?: string;
  sourceText?: string;
  sourceFileName?: string;
  sourceFileData?: string;
  focusArea?: string;
  tone?: string;
  format?: string;
  provider?: string;
  model?: string;
}) {
  const res = await fetch(`${BACKEND_URL}/api/notebook/generate`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(params),
  });
  return parseJsonResponse(res, 'Notebook generation failed');
}

export async function freeProviderChat(
  provider: string,
  model: string,
  messages: { role: string; content: string }[],
  signal?: AbortSignal,
) {
  const res = await fetch(`${BACKEND_URL}/api/free/chat`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ provider, body: { model, messages } }),
    signal,
  });
  return parseJsonResponse(res, 'Provider chat failed');
}

// notebook persistence
export async function notebookList() {
  const res = await fetch(`${BACKEND_URL}/api/notebook/list`);
  return res.json();
}
export async function notebookSave(session: any) {
  const res = await fetch(`${BACKEND_URL}/api/notebook/save`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(session),
  });
  return res.json();
}
export async function notebookDelete(id: string) {
  const res = await fetch(`${BACKEND_URL}/api/notebook/delete/${id}`, {
    method: 'DELETE',
  });
  return res.json();
}

// ── Codebase Analysis (Traycer-style) ─────────────────────────────────
export async function analyzeCodebase(taskDescription: string, directory?: string) {
  const res = await fetch(`${BACKEND_URL}/api/analyze/codebase`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ task: taskDescription, directory }),
  });
  return res.json();
}

export async function generateTaskPlan(taskDescription: string, fileData: any[], provider?: string, model?: string) {
  const res = await fetch(`${BACKEND_URL}/api/analyze/task-plan`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ task: taskDescription, files: fileData, provider, model }),
  });
  return res.json();
}

// ── Knowledge Base (Chat Ralph style) ─────────────────────────────────
export async function knowledgeList(category?: string) {
  const url = new URL(`${BACKEND_URL}/api/knowledge/list`);
  if (category) url.searchParams.set('category', category);
  const res = await fetch(url.toString());
  return res.json();
}

export async function knowledgeGet(id: string) {
  const res = await fetch(`${BACKEND_URL}/api/knowledge/get/${id}`);
  return res.json();
}

export async function knowledgeSave(entry: object) {
  const res = await fetch(`${BACKEND_URL}/api/knowledge/save`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(entry),
  });
  return res.json();
}

export async function knowledgeDelete(id: string) {
  const res = await fetch(`${BACKEND_URL}/api/knowledge/delete/${id}`, {
    method: 'DELETE',
  });
  return res.json();
}

export async function knowledgeSearch(q: string, category?: string) {
  const url = new URL(`${BACKEND_URL}/api/knowledge/search`);
  if (q) url.searchParams.set('q', q);
  if (category) url.searchParams.set('category', category);
  const res = await fetch(url.toString());
  return res.json();
}

// research persistence
export async function researchList() {
  const res = await fetch(`${BACKEND_URL}/api/research/list`);
  return res.json();
}
export async function researchSave(card: any) {
  const res = await fetch(`${BACKEND_URL}/api/research/save`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(card),
  });
  return res.json();
}
export async function researchDelete(id: string) {
  const res = await fetch(`${BACKEND_URL}/api/research/delete/${id}`, {
    method: 'DELETE',
  });
  return res.json();
}

// skills history
export async function skillHistoryList() {
  const res = await fetch(`${BACKEND_URL}/api/skills/history/list`);
  return res.json();
}
export async function skillHistorySave(entry: any) {
  const res = await fetch(`${BACKEND_URL}/api/skills/history/save`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(entry),
  });
  return res.json();
}
export async function skillHistoryDelete(id: string) {
  const res = await fetch(`${BACKEND_URL}/api/skills/history/delete/${id}`, {
    method: 'DELETE',
  });
  return res.json();
}

// ── Research Dashboard ────────────────────────────────────────────────
// helper to simulate streaming for providers without native support
async function* simulateStream(text: string) {
  const chunkSize = 100;
  for (let i = 0; i < text.length; i += chunkSize) {
    yield text.slice(i, i + chunkSize);
    await new Promise((r) => setTimeout(r, 50));
  }
}

export async function* researchDashboardStream(
  prompt: string,
  provider: string = 'ollama',
  model?: string,
  signal?: AbortSignal,
) {
  if (provider === 'ollama') {
    const res = await fetch(`${BACKEND_URL}/api/research/generate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ prompt, provider, model }),
      signal,
    });

    const reader = res.body!.getReader();
    const decoder = new TextDecoder();
    let buffer = '';

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split('\n\n');
      buffer = lines.pop() || '';
      for (const line of lines) {
        if (line.startsWith('data: ')) {
          try {
            yield JSON.parse(line.slice(6));
          } catch { /* skip */ }
        }
      }
    }
  } else {
    // fetch full text then simulate
    const res = await fetch(`${BACKEND_URL}/api/research/generate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ prompt, provider, model }),
      signal,
    });
    const data = await res.json();
    const text =
      data?.choices?.[0]?.message?.content || data?.text || '';
    let full = '';
    for await (const chunk of simulateStream(text)) {
      full += chunk;
      yield { content: full };
    }
  }
}

// ── Remix (Solidity Compilation) ──────────────────────────────────────
export async function compileSolidity(source: string, version: string) {
  const res = await fetch(`${BACKEND_URL}/api/remix/compile`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ source, compilerVersion: version }),
  });
  return res.json();
}

export async function deploySolidity(abi: any, bytecode: string, constructorArgs: any[]) {
  const res = await fetch(`${BACKEND_URL}/api/remix/deploy`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ abi, bytecode, constructorArgs }),
  });
  return res.json();
}

// ── Skills ────────────────────────────────────────────────────────────
export async function skillsList() {
  const res = await fetch(`${BACKEND_URL}/api/skills/list`);
  return parseJsonResponse(res, 'Failed to load skills registry') as Promise<SkillRegistryEntry[]>;
}

export async function skillExecute(skillId: string, params: Record<string, any>, provider?: string, model?: string) {
  const res = await fetch(`${BACKEND_URL}/api/skills/execute`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      skill_id: skillId,
      inputs: params,
      provider,
      model,
    }),
  });
  return parseJsonResponse(res, 'Skill execution failed');
}

export async function terminalCreateSession(cwd: string = '.'): Promise<TerminalSessionResponse> {
  const res = await fetch(`${BACKEND_URL}/api/terminal/session`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ cwd }),
  });
  return parseJsonResponse(res, 'Failed to create terminal session');
}

export async function terminalCloseSession(sessionId: string) {
  const res = await fetch(`${BACKEND_URL}/api/terminal/session/${sessionId}`, {
    method: 'DELETE',
  });
  return parseJsonResponse(res, 'Failed to close terminal session');
}

export async function terminalExecute(
  sessionId: string,
  command: string,
): Promise<TerminalExecResponse> {
  const res = await fetch(`${BACKEND_URL}/api/terminal/execute`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      session_id: sessionId,
      command,
    }),
  });
  return parseJsonResponse(res, 'Terminal command failed');
}

export function getTerminalWebSocketUrl(sessionId: string) {
  const url = new URL(`${BACKEND_URL}/api/terminal/ws/${sessionId}`);
  url.protocol = url.protocol === 'https:' ? 'wss:' : 'ws:';
  return url.toString();
}

export async function mcpListServers(): Promise<McpServerConfig[]> {
  const res = await fetch(`${BACKEND_URL}/api/mcp/servers`);
  return parseJsonResponse(res, 'Failed to load MCP servers');
}

export async function mcpSaveServer(config: McpServerConfig) {
  const res = await fetch(`${BACKEND_URL}/api/mcp/servers`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(config),
  });
  return parseJsonResponse(res, 'Failed to save MCP server');
}

export async function mcpDeleteServer(name: string) {
  const res = await fetch(`${BACKEND_URL}/api/mcp/servers/${encodeURIComponent(name)}`, {
    method: 'DELETE',
  });
  return parseJsonResponse(res, 'Failed to delete MCP server');
}

export async function mcpTestServer(name: string) {
  const res = await fetch(`${BACKEND_URL}/api/mcp/test/${encodeURIComponent(name)}`, {
    method: 'POST',
  });
  return parseJsonResponse(res, 'Failed to test MCP server');
}

export async function mcpListTools(name: string): Promise<McpToolDefinition[]> {
  const res = await fetch(`${BACKEND_URL}/api/mcp/tools/${encodeURIComponent(name)}`);
  return parseJsonResponse(res, 'Failed to list MCP tools');
}

export async function mcpCallTool(
  server: string,
  tool: string,
  arguments_: Record<string, any> = {},
) {
  const res = await fetch(`${BACKEND_URL}/api/mcp/call`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      server,
      tool,
      arguments: arguments_,
    }),
  });
  return parseJsonResponse(res, 'Failed to call MCP tool');
}

export async function agentRunsList(): Promise<AgentRunResponse[]> {
  const res = await fetch(`${BACKEND_URL}/api/agents/runs`);
  return parseJsonResponse(res, 'Failed to load agent runs');
}

export async function agentRunCreate(payload: AgentRunPayload): Promise<AgentRunResponse> {
  const res = await fetch(`${BACKEND_URL}/api/agents/run`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  return parseJsonResponse(res, 'Failed to start agent run');
}

export async function agentRunCancel(runId: string): Promise<AgentRunResponse> {
  const res = await fetch(`${BACKEND_URL}/api/agents/cancel`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ run_id: runId }),
  });
  return parseJsonResponse(res, 'Failed to cancel agent run');
}

// ── Testing & Security ────────────────────────────────────────────────
export async function runForgeTests() {
  const res = await fetch(`${BACKEND_URL}/api/testing/forge`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({}),
  });
  return res.json();
}

export async function runSolhintLinting(filePath: string) {
  const res = await fetch(`${BACKEND_URL}/api/testing/lint`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ filePath }),
  });
  return res.json();
}

export async function runSlitherSecurity(filePath: string) {
  const res = await fetch(`${BACKEND_URL}/api/security/slither`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ filePath }),
  });
  return res.json();
}

// ── Health Check ──────────────────────────────────────────────────────
export async function healthCheck() {
  const [backendOk, ollamaOk] = await Promise.allSettled([
    fetch(`${BACKEND_URL}/api/health`).then((r) => r.ok),
    fetch(`${OLLAMA_URL}/api/tags`).then((r) => r.ok),
  ]);
  return {
    backend: backendOk.status === 'fulfilled' && backendOk.value,
    ollama: ollamaOk.status === 'fulfilled' && ollamaOk.value,
  };
}

// ── Helpers ───────────────────────────────────────────────────────────
function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${(bytes / Math.pow(k, i)).toFixed(1)} ${sizes[i]}`;
}

function buildOllamaPrompt(messages: { role: string; content: string }[]) {
  return messages
    .map((message) => `${message.role.toUpperCase()}:\n${message.content}`)
    .join('\n\n');
}
