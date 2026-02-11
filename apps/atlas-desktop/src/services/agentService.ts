/**
 * agentService.ts — Tauri invoke wrappers for the AI Agent CRM backend.
 * 5 specialist crypto marketing agents powered by local Ollama.
 */
import { invoke } from "@tauri-apps/api/core";

/* ─── Types ──────────────────────────────────────── */

export interface AgentDef {
  id: string;
  name: string;
  role: string;
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
  invoke<AgentDef[]>("agents_get_roster");

export const checkAgentStatus = () =>
  invoke<OllamaStatus>("agents_check_status");

/* ─── Agent Tasks ────────────────────────────────── */
export const runAgentTask = (ownerUserId: string, agentId: string, prompt: string) =>
  invoke<AgentTask>("agents_run_task", { ownerUserId, agentId, prompt });

export const getAgentTasks = (userId: string, isKing: boolean) =>
  invoke<AgentTask[]>("agents_get_tasks", { userId, isKing });

/* ─── Agent Chat ─────────────────────────────────── */
export const chatWithAgent = (userId: string, agentId: string, message: string) =>
  invoke<AgentConversation>("agents_chat", { userId, agentId, message });

export const getAgentHistory = (userId: string, agentId: string) =>
  invoke<AgentConversation[]>("agents_get_history", { userId, agentId });

/* ─── Lead Funnel ────────────────────────────────── */
export const createLead = (ownerUserId: string, input: {
  contact_id: string;
  funnel_stage?: string;
  agent_id?: string;
  score?: number;
  notes?: string;
}) => invoke<LeadFunnel>("agents_create_lead", { ownerUserId, input });

export const updateLead = (leadId: string, funnelStage?: string, score?: number, notes?: string) =>
  invoke<void>("agents_update_lead", { leadId, funnelStage: funnelStage ?? null, score: score ?? null, notes: notes ?? null });

export const getLeads = (userId: string, isKing: boolean) =>
  invoke<LeadFunnel[]>("agents_get_leads", { userId, isKing });

/* ─── Email Assignment ───────────────────────────── */
export const assignEmail = (userId: string, username: string) =>
  invoke<UserEmailAssignment>("agents_assign_email", { userId, username });

export const getUserEmail = (userId: string) =>
  invoke<UserEmailAssignment | null>("agents_get_user_email", { userId });

/* ─── Proxy Management ───────────────────────────── */
export const assignProxy = (userId: string, input: {
  proxy_host: string;
  proxy_port: number;
  proxy_type?: string;
  username?: string;
  password?: string;
}) => invoke<UserProxy>("agents_assign_proxy", { userId, input });

export const getProxy = (userId: string) =>
  invoke<UserProxy | null>("agents_get_proxy", { userId });

export const getAllProxies = () =>
  invoke<UserProxy[]>("agents_get_all_proxies");

/* ─── Funnel Stats (King) ────────────────────────── */
export const getFunnelStats = () =>
  invoke<FunnelStats>("agents_get_funnel_stats");
