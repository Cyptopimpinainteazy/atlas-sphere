/**
 * agentService.ts — Tauri invoke wrappers for the 15-agent surgical swarm CRM backend.
 * 4 Layers: Strategic • Execution • Media • Growth
 * All powered by local Ollama (free, no API keys).
 */
// Use a lazy guarded tauriInvoke helper to avoid browser crashes when Tauri is not present
async function tauriInvoke<T>(cmd: string, args?: any): Promise<T> {
  if (typeof window === 'undefined' || (!(window as any).__TAURI_INTERNALS__ && !(window as any).__TAURI__)) {
    throw new Error('Tauri runtime not available');
  }
  const mod = await import('@tauri-apps/api/core');
  return mod.invoke<T>(cmd, args);
} 

/* ─── Types ──────────────────────────────────────── */

export interface AgentDef {
  id: string;
  name: string;
  role: string;
  layer: string;
  avatar: string;
  color: string;
  model: string;
  system_prompt: string;
  capabilities: string[];
  status: string;
}

export interface AgentTask {
  id: string;
  agent_id: string;
  owner_user_id: string;
  assigned_to_user_id: string;
  task_type: string;
  prompt: string;
  result: string;
  status: string;
  leads_generated: number;
  created_at: string;
  completed_at: string;
}

export interface AgentConversation {
  id: string;
  agent_id: string;
  user_id: string;
  role: string;
  content: string;
  created_at: string;
}

export interface LeadFunnel {
  id: string;
  contact_id: string;
  owner_user_id: string;
  funnel_stage: string;
  agent_id: string;
  score: number;
  notes: string;
  shared_with_king: boolean;
  created_at: string;
  updated_at: string;
}

export interface UserEmailAssignment {
  id: string;
  user_id: string;
  email_address: string;
  smtp_username: string;
  created_at: string;
  active: boolean;
}

export interface UserProxy {
  id: string;
  user_id: string;
  proxy_host: string;
  proxy_port: number;
  proxy_type: string;
  username: string;
  password: string;
  active: boolean;
  created_at: string;
}

export interface FunnelStats {
  total_leads: number;
  funnel: {
    discovered: number;
    contacted: number;
    pitched: number;
    negotiating: number;
    converted: number;
    lost: number;
  };
  tasks: { total: number; completed: number };
  emails_assigned: number;
}

export interface OllamaStatus {
  online: boolean;
  url: string;
  models: Array<{ name: string; size: number }>;
}

/* ─── Agent Roster ───────────────────────────────── */
export const getAgentRoster = () =>
  tauriInvoke<AgentDef[]>("agents_get_roster");

export const checkAgentStatus = () =>
  tauriInvoke<OllamaStatus>("agents_check_status");

/* ─── Agent Tasks ────────────────────────────────── */
export const runAgentTask = (ownerUserId: string, agentId: string, prompt: string) =>
  tauriInvoke<AgentTask>("agents_run_task", { owner_user_id: ownerUserId, agent_id: agentId, prompt });

export const getAgentTasks = (userId: string, isKing: boolean) =>
  tauriInvoke<AgentTask[]>("agents_get_tasks", { user_id: userId, is_king: isKing });

/* ─── Agent Chat ─────────────────────────────────── */
export const chatWithAgent = (userId: string, agentId: string, message: string) =>
  tauriInvoke<AgentConversation>("agents_chat", { user_id: userId, agent_id: agentId, message });

export const getAgentHistory = (userId: string, agentId: string) =>
  tauriInvoke<AgentConversation[]>("agents_get_history", { user_id: userId, agent_id: agentId });

/* ─── Lead Funnel ────────────────────────────────── */
export const createLead = (ownerUserId: string, input: {
  contact_id: string;
  funnel_stage?: string;
  agent_id?: string;
  score?: number;
  notes?: string;
}) => invoke<LeadFunnel>("agents_create_lead", { owner_user_id: ownerUserId, input });

export const updateLead = (leadId: string, funnelStage?: string, score?: number, notes?: string) =>
  invoke<void>("agents_update_lead", { lead_id: leadId, funnel_stage: funnelStage ?? null, score: score ?? null, notes: notes ?? null });

export const getLeads = (userId: string, isKing: boolean) =>
  invoke<LeadFunnel[]>("agents_get_leads", { user_id: userId, is_king: isKing });

/* ─── Email Assignment ───────────────────────────── */
export const assignEmail = (userId: string, username: string) =>
  invoke<UserEmailAssignment>("agents_assign_email", { user_id: userId, username });

export const getUserEmail = (userId: string) =>
  invoke<UserEmailAssignment | null>("agents_get_user_email", { user_id: userId });

/* ─── Proxy Management ───────────────────────────── */
export const assignProxy = (userId: string, input: {
  proxy_host: string;
  proxy_port: number;
  proxy_type?: string;
  username?: string;
  password?: string;
}) => invoke<UserProxy>("agents_assign_proxy", { user_id: userId, input });

export const getProxy = (userId: string) =>
  invoke<UserProxy | null>("agents_get_proxy", { user_id: userId });

export const getAllProxies = () =>
  invoke<UserProxy[]>("agents_get_all_proxies");

/* ─── Funnel Stats (King) ────────────────────────── */
export const getFunnelStats = () =>
  invoke<FunnelStats>("agents_get_funnel_stats");

/* ─── Web Search ─────────────────────────────────── */
export interface SearchResult {
  title: string;
  url: string;
  snippet: string;
}

export interface WebSearchResponse {
  query: string;
  results: SearchResult[];
  analysis: string | null;
  count: number;
}

export const webSearch = (query: string, agentId?: string) =>
  invoke<WebSearchResponse>("agents_web_search", { query, agent_id: agentId ?? null });

export const fetchWebsite = (url: string, agentId: string) =>
  invoke<{ url: string; page_text_length: number; analysis: string }>("agents_fetch_website", { url, agent_id: agentId });

/* ─── RAG System ─────────────────────────────────── */
export interface RagStats {
  total_docs: number;
  total_tokens: number;
  files: Array<{ path: string; tokens: number; indexed_at: string }>;
}

export const ragIndex = (folderPath: string) =>
  invoke<{ folder: string; files_found: number; files_indexed: number; total_tokens: number }>("agents_rag_index", { folder_path: folderPath });

export const ragQuery = (query: string, agentId: string) =>
  invoke<{ query: string; answer: string; sources: string[]; docs_searched: number }>("agents_rag_query", { query, agent_id: agentId });

export const ragStats = () =>
  invoke<RagStats>("agents_rag_stats");

/* ─── Contact Import & Sorting ───────────────────── */
export interface ParsedContact {
  first_name: string;
  last_name: string;
  email: string;
  phone: string;
  company: string;
  job_title: string;
  country: string;
  network: string;
  ranking: number;
  website: string;
  notes: string;
  source: string;
}

export const importContacts = (ownerUserId: string, rawText: string) =>
  invoke<{ raw_length: number; contacts_parsed: number; contacts_imported: number; contacts: ParsedContact[] }>(
    "agents_import_contacts", { owner_user_id: ownerUserId, raw_text: rawText }
  );

export const getContactsSorted = (ownerUserId: string, sortBy: string, filterNetwork?: string, filterCountry?: string) =>
  invoke<any[]>("agents_get_contacts_sorted", {
    owner_user_id: ownerUserId, sort_by: sortBy,
    filter_network: filterNetwork ?? null, filter_country: filterCountry ?? null,
  });

export const getContactFilters = (ownerUserId: string) =>
  invoke<{ networks: string[]; countries: string[] }>("agents_get_contact_filters", { owner_user_id: ownerUserId });

/* ─── Proxy/VPN Toggle ───────────────────────────── */
export const toggleProxy = (userId: string, active: boolean) =>
  invoke<{ user_id: string; proxy_active: boolean }>("agents_toggle_proxy", { user_id: userId, active });

/* ─── Media Folder ───────────────────────────────── */
export interface MediaFile {
  id: string;
  file_name: string;
  file_path: string;
  file_type: string;
  file_size: number;
}

export const scanMedia = (folderPath: string) =>
  invoke<{ folder: string; files_found: number; files: MediaFile[] }>("agents_scan_media", { folder_path: folderPath });

export const getMedia = () =>
  invoke<any[]>("agents_get_media");

/* ─── Personalized Messages ──────────────────────── */
export const generatePersonalizedMessage = (contactId: string, agentId: string, messageType: string) =>
  invoke<{ contact_id: string; contact_name: string; message_type: string; message: string; used_website: boolean }>(
    "agents_personalized_message", { contact_id: contactId, agent_id: agentId, message_type: messageType }
  );

/* ─── 90-Day Rollout ─────────────────────────────── */
export interface RolloutPhase {
  id: string;
  phase_num: number;
  title: string;
  description: string;
  start_day: number;
  end_day: number;
  status: string;
  milestones: string;
  progress: number;
  created_at: string;
  updated_at: string;
}

export const seedRollout = () =>
  invoke<{ phases_seeded: number }>("agents_seed_rollout");

export const getRollout = () =>
  invoke<RolloutPhase[]>("agents_get_rollout");

export const updateRollout = (phaseId: string, status?: string, progress?: number, milestones?: string) =>
  invoke<{ phase_id: string; updated: boolean }>("agents_update_rollout", {
    phase_id: phaseId,
    status: status ?? null,
    progress: progress ?? null,
    milestones: milestones ?? null,
  });

/* ─── Page Builder ───────────────────────────────── */
export interface GeneratedPage {
  id: string;
  slug: string;
  title: string;
  page_type: string;
  meta_title: string;
  meta_desc: string;
  seo_keywords: string;
  status: string;
  agent_id: string;
  created_at: string;
  updated_at: string;
}

export interface PageContent extends GeneratedPage {
  html_content: string;
}

export const generatePage = (slug: string, title: string, pageType: string, prompt: string, agentId?: string) =>
  invoke<{ id: string; slug: string; title: string; page_type: string; meta_title: string; meta_desc: string; seo_keywords: string; html_length: number; status: string; agent_id: string }>(
    "agents_generate_page", { slug, title, page_type: pageType, prompt, agent_id: agentId ?? null }
  );

export const getPages = () =>
  invoke<GeneratedPage[]>("agents_get_pages");

export const getPageContent = (pageId: string) =>
  invoke<PageContent>("agents_get_page_content", { page_id: pageId });

export const updatePageStatus = (pageId: string, status: string) =>
  invoke<{ page_id: string; status: string }>("agents_update_page_status", { page_id: pageId, status });

export const deletePage = (pageId: string) =>
  invoke<{ page_id: string; deleted: boolean }>("agents_delete_page", { page_id: pageId });

/* ─── Agent Hierarchy ────────────────────────────── */
export interface AgentHierarchy {
  layers: string[];
  agents_by_layer: Record<string, Array<{
    id: string;
    name: string;
    role: string;
    avatar: string;
    color: string;
    capabilities: string[];
    status: string;
  }>>;
  total_agents: number;
}

export const getAgentHierarchy = () =>
  invoke<AgentHierarchy>("agents_get_hierarchy");
