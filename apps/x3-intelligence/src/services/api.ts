// X3 Intelligence — API Service
// Communicates with the X3 substrate node / sidecar.

import type {
  ArbIntent,
  Agent,
  SlashEvent,
  Dispute,
  ExecutionProof,
  FloorStats,
  FlashloanRecord,
  PaginatedResponse,
  FeeVector,
} from "../types";

const API_BASE = "/api/v1";

async function fetchJson<T>(path: string): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`);
  if (!res.ok) {
    throw new Error(`API error ${res.status}: ${await res.text()}`);
  }
  return res.json();
}

// ─── Floor Stats ───────────────────────────────────────────────

export function getFloorStats(): Promise<FloorStats> {
  return fetchJson("/floor/stats");
}

// ─── Intents ───────────────────────────────────────────────────

export function getIntents(
  page = 1,
  pageSize = 25
): Promise<PaginatedResponse<ArbIntent>> {
  return fetchJson(`/intents?page=${page}&pageSize=${pageSize}`);
}

export function getIntent(id: string): Promise<ArbIntent> {
  return fetchJson(`/intents/${id}`);
}

// ─── Agents ────────────────────────────────────────────────────

export function getAgents(
  page = 1,
  pageSize = 25
): Promise<PaginatedResponse<Agent>> {
  return fetchJson(`/agents?page=${page}&pageSize=${pageSize}`);
}

export function getAgent(id: string): Promise<Agent> {
  return fetchJson(`/agents/${id}`);
}

// ─── Slashing ──────────────────────────────────────────────────

export function getSlashEvents(
  agentId?: string,
  page = 1,
  pageSize = 25
): Promise<PaginatedResponse<SlashEvent>> {
  const agentParam = agentId ? `&agentId=${agentId}` : "";
  return fetchJson(`/slashes?page=${page}&pageSize=${pageSize}${agentParam}`);
}

// ─── Disputes ──────────────────────────────────────────────────

export function getDisputes(
  page = 1,
  pageSize = 25
): Promise<PaginatedResponse<Dispute>> {
  return fetchJson(`/disputes?page=${page}&pageSize=${pageSize}`);
}

export function getDispute(id: string): Promise<Dispute> {
  return fetchJson(`/disputes/${id}`);
}

// ─── Proofs ────────────────────────────────────────────────────

export function getProof(hash: string): Promise<ExecutionProof> {
  return fetchJson(`/proofs/${hash}`);
}

export function getProofsByIntent(
  intentId: string
): Promise<ExecutionProof[]> {
  return fetchJson(`/proofs?intentId=${intentId}`);
}

// ─── Fees ──────────────────────────────────────────────────────

export function estimateFee(params: {
  legs: number;
  stateTouches: number;
  capitalAmount: number;
  agentId?: string;
  isFlashloan?: boolean;
  isCrossChain?: boolean;
}): Promise<FeeVector> {
  return fetchJson(
    `/fees/estimate?legs=${params.legs}&stateTouches=${params.stateTouches}` +
      `&capital=${params.capitalAmount}` +
      (params.agentId ? `&agentId=${params.agentId}` : "") +
      (params.isFlashloan ? "&flashloan=true" : "") +
      (params.isCrossChain ? "&crossChain=true" : "")
  );
}

// ─── Flashloans ────────────────────────────────────────────────

export function getFlashloans(
  page = 1,
  pageSize = 25
): Promise<PaginatedResponse<FlashloanRecord>> {
  return fetchJson(`/flashloans?page=${page}&pageSize=${pageSize}`);
}
