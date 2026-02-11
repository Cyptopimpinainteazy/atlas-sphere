import React, { useState, useEffect, useRef, useCallback } from "react";
import { useSocialStore } from "@/stores/socialStore";
import * as agentSvc from "@/services/agentService";
import type { AgentDef, AgentTask, AgentConversation, LeadFunnel, FunnelStats, OllamaStatus, UserEmailAssignment, UserProxy } from "@/services/agentService";

/* ════════════════════════════════════════════════════════
   CRM AGENTS PAGE — 5 AI Marketing Agents + Lead Funnel
   ════════════════════════════════════════════════════════ */

type Tab = "agents" | "tasks" | "funnel" | "chat" | "settings";

const STAGE_COLORS: Record<string, string> = {
  discovered: "#11a0dc", contacted: "#ff6b35", pitched: "#a855f7",
  negotiating: "#ffd740", converted: "#4caf50", lost: "#ef5350",
};
const STAGE_ORDER = ["discovered", "contacted", "pitched", "negotiating", "converted", "lost"];

const AgentsPage: React.FC = () => {
  const { session, currentUser } = useSocialStore();
  const userId = session?.user_id ?? "";
  const isKing = currentUser?.username === "King" && currentUser?.role === "admin";

  const [tab, setTab] = useState<Tab>("agents");
  const [roster, setRoster] = useState<AgentDef[]>([]);
  const [ollamaStatus, setOllamaStatus] = useState<OllamaStatus | null>(null);
  const [tasks, setTasks] = useState<AgentTask[]>([]);
  const [leads, setLeads] = useState<LeadFunnel[]>([]);
  const [funnelStats, setFunnelStats] = useState<FunnelStats | null>(null);
  const [selectedAgent, setSelectedAgent] = useState<AgentDef | null>(null);
  const [chatHistory, setChatHistory] = useState<AgentConversation[]>([]);
  const [chatInput, setChatInput] = useState("");
  const [chatLoading, setChatLoading] = useState(false);
  const [taskPrompt, setTaskPrompt] = useState("");
  const [taskLoading, setTaskLoading] = useState(false);
  const [taskResult, setTaskResult] = useState<AgentTask | null>(null);
  const [userEmail, setUserEmail] = useState<UserEmailAssignment | null>(null);
  const [userProxy, setUserProxy] = useState<UserProxy | null>(null);
  const [loading, setLoading] = useState(true);
  const chatEndRef = useRef<HTMLDivElement>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [r, s] = await Promise.all([agentSvc.getAgentRoster(), agentSvc.checkAgentStatus()]);
      setRoster(r);
      setOllamaStatus(s);
      if (userId) {
        const [t, l, e, p] = await Promise.all([
          agentSvc.getAgentTasks(userId, isKing),
          agentSvc.getLeads(userId, isKing),
          agentSvc.getUserEmail(userId),
          agentSvc.getProxy(userId),
        ]);
        setTasks(t);
        setLeads(l);
        setUserEmail(e);
        setUserProxy(p);
        if (isKing) {
          const fs = await agentSvc.getFunnelStats();
          setFunnelStats(fs);
        }
      }
    } catch (err) { console.error("Agent load error:", err); }
    setLoading(false);
  }, [userId, isKing]);

  useEffect(() => { load(); }, [load]);

  useEffect(() => { chatEndRef.current?.scrollIntoView({ behavior: "smooth" }); }, [chatHistory]);

  const openChat = async (agent: AgentDef) => {
    setSelectedAgent(agent);
    setTab("chat");
    try {
      const h = await agentSvc.getAgentHistory(userId, agent.id);
      setChatHistory(h);
    } catch { setChatHistory([]); }
  };

  const sendChat = async () => {
    if (!chatInput.trim() || !selectedAgent || chatLoading) return;
    const msg = chatInput.trim();
    setChatInput("");
    setChatLoading(true);
    setChatHistory(prev => [...prev, { id: "temp", agent_id: selectedAgent.id, user_id: userId, role: "user", content: msg, created_at: new Date().toISOString() }]);
    try {
      const resp = await agentSvc.chatWithAgent(userId, selectedAgent.id, msg);
      setChatHistory(prev => [...prev.filter(m => m.id !== "temp" || m.role !== "user"), { id: "sent", agent_id: selectedAgent.id, user_id: userId, role: "user", content: msg, created_at: new Date().toISOString() }, resp]);
    } catch (err: any) {
      setChatHistory(prev => [...prev, { id: "err", agent_id: selectedAgent.id, user_id: userId, role: "assistant", content: `Error: ${err?.message ?? err}`, created_at: new Date().toISOString() }]);
    }
    setChatLoading(false);
  };

  const runTask = async (agentId: string) => {
    if (!taskPrompt.trim() || taskLoading) return;
    setTaskLoading(true);
    setTaskResult(null);
    try {
      const result = await agentSvc.runAgentTask(userId, agentId, taskPrompt.trim());
      setTaskResult(result);
      setTasks(prev => [result, ...prev]);
    } catch (err: any) {
      setTaskResult({ id: "", agent_id: agentId, owner_user_id: userId, assigned_to_user_id: userId, task_type: "", prompt: taskPrompt, result: `Error: ${err?.message ?? err}`, status: "failed", leads_generated: 0, created_at: "", completed_at: "" });
    }
    setTaskLoading(false);
  };

  const assignMyEmail = async () => {
    if (!userId || !currentUser?.username) return;
    try {
      const e = await agentSvc.assignEmail(userId, currentUser.username);
      setUserEmail(e);
    } catch (err) { console.error(err); }
  };

  if (loading) return <div style={{ padding: 40, textAlign: "center", color: "#888" }}>Loading agents...</div>;

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%", background: "#0d0d0d", color: "#e0e0e0" }}>
      {/* Header */}
      <div style={{ padding: "16px 24px", borderBottom: "1px solid #222", display: "flex", alignItems: "center", gap: 16 }}>
        <h1 style={{ margin: 0, fontSize: 20, fontWeight: 700 }}>🤖 AI Agent Team</h1>
        <span style={{ fontSize: 11, color: ollamaStatus?.online ? "#4caf50" : "#ef5350", fontWeight: 600 }}>
          {ollamaStatus?.online ? "● Ollama Online" : "● Ollama Offline"}
        </span>
        {ollamaStatus?.online && <span style={{ fontSize: 10, color: "#666" }}>{ollamaStatus.models?.length ?? 0} models loaded</span>}
        {userEmail && <span style={{ fontSize: 11, color: "#11a0dc", marginLeft: "auto" }}>📧 {userEmail.email_address}</span>}
        {!userEmail && <button onClick={assignMyEmail} style={{ marginLeft: "auto", fontSize: 11, background: "#11a0dc", color: "#fff", border: "none", borderRadius: 6, padding: "4px 12px", cursor: "pointer" }}>Get x3star.net Email</button>}
        {isKing && <span style={{ background: "#ffd740", color: "#000", padding: "2px 10px", borderRadius: 8, fontSize: 10, fontWeight: 800 }}>👑 KING VIEW</span>}
      </div>

      {/* Tabs */}
      <div style={{ display: "flex", gap: 0, borderBottom: "1px solid #222" }}>
        {(["agents", "tasks", "funnel", "chat", "settings"] as Tab[]).map(t => (
          <button key={t} onClick={() => setTab(t)} style={{
            padding: "10px 20px", background: tab === t ? "#1a1a1a" : "transparent", color: tab === t ? "#ff6b35" : "#888",
            border: "none", borderBottom: tab === t ? "2px solid #ff6b35" : "2px solid transparent",
            fontWeight: tab === t ? 700 : 400, cursor: "pointer", fontSize: 13, textTransform: "capitalize",
          }}>{t}</button>
        ))}
      </div>

      {/* Content */}
      <div style={{ flex: 1, overflow: "auto", padding: 20 }}>

        {/* ── AGENTS TAB ── */}
        {tab === "agents" && (
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(300px, 1fr))", gap: 16 }}>
            {roster.map(agent => (
              <div key={agent.id} style={{ background: "#1a1a1a", borderRadius: 12, padding: 20, border: `1px solid ${agent.color}33` }}>
                <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 12 }}>
                  <span style={{ fontSize: 32 }}>{agent.avatar}</span>
                  <div>
                    <div style={{ fontWeight: 700, color: agent.color, fontSize: 16 }}>{agent.name}</div>
                    <div style={{ fontSize: 11, color: "#888" }}>{agent.role.replace(/_/g, " ")}</div>
                  </div>
                </div>
                <div style={{ fontSize: 12, color: "#aaa", marginBottom: 12, lineHeight: 1.5 }}>
                  {agent.system_prompt.slice(0, 150)}...
                </div>
                <div style={{ display: "flex", flexWrap: "wrap", gap: 4, marginBottom: 12 }}>
                  {agent.capabilities.map(c => (
                    <span key={c} style={{ fontSize: 9, background: `${agent.color}22`, color: agent.color, padding: "2px 8px", borderRadius: 8 }}>
                      {c.replace(/_/g, " ")}
                    </span>
                  ))}
                </div>
                <div style={{ display: "flex", gap: 8 }}>
                  <button onClick={() => openChat(agent)} style={{ flex: 1, padding: "8px 0", background: agent.color, color: "#fff", border: "none", borderRadius: 8, fontWeight: 600, cursor: "pointer", fontSize: 12 }}>
                    💬 Chat
                  </button>
                  <button onClick={() => { setSelectedAgent(agent); setTab("tasks"); }} style={{ flex: 1, padding: "8px 0", background: "#333", color: "#fff", border: "none", borderRadius: 8, fontWeight: 600, cursor: "pointer", fontSize: 12 }}>
                    ⚡ Run Task
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* ── TASKS TAB ── */}
        {tab === "tasks" && (
          <div>
            {/* Task runner */}
            {selectedAgent && (
              <div style={{ background: "#1a1a1a", borderRadius: 12, padding: 20, marginBottom: 20, border: `1px solid ${selectedAgent.color}33` }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 12 }}>
                  <span style={{ fontSize: 24 }}>{selectedAgent.avatar}</span>
                  <span style={{ fontWeight: 700, color: selectedAgent.color }}>{selectedAgent.name}</span>
                  <span style={{ fontSize: 11, color: "#888" }}>— {selectedAgent.role.replace(/_/g, " ")}</span>
                </div>
                <textarea value={taskPrompt} onChange={e => setTaskPrompt(e.target.value)} placeholder={`Give ${selectedAgent.name} a task...`}
                  style={{ width: "100%", minHeight: 80, background: "#111", color: "#e0e0e0", border: "1px solid #333", borderRadius: 8, padding: 12, fontSize: 13, resize: "vertical" }} />
                <button onClick={() => runTask(selectedAgent.id)} disabled={taskLoading || !taskPrompt.trim()}
                  style={{ marginTop: 8, padding: "10px 24px", background: taskLoading ? "#555" : selectedAgent.color, color: "#fff", border: "none", borderRadius: 8, fontWeight: 700, cursor: taskLoading ? "wait" : "pointer", fontSize: 13 }}>
                  {taskLoading ? "⏳ Agent working..." : "⚡ Run Task"}
                </button>
                {taskResult && (
                  <div style={{ marginTop: 16, background: "#111", borderRadius: 8, padding: 16, maxHeight: 400, overflow: "auto" }}>
                    <div style={{ fontSize: 11, color: taskResult.status === "completed" ? "#4caf50" : "#ef5350", marginBottom: 8 }}>
                      {taskResult.status === "completed" ? "✅ Completed" : "❌ Failed"}
                    </div>
                    <pre style={{ whiteSpace: "pre-wrap", fontSize: 12, color: "#ccc", lineHeight: 1.6, margin: 0 }}>{taskResult.result}</pre>
                  </div>
                )}
              </div>
            )}
            {!selectedAgent && <p style={{ color: "#888" }}>Select an agent from the Agents tab to run tasks.</p>}

            {/* Task history */}
            <h3 style={{ color: "#ff6b35", marginBottom: 12 }}>{isKing ? "All Team Tasks" : "My Tasks"} ({tasks.length})</h3>
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {tasks.map(t => {
                const agent = roster.find(a => a.id === t.agent_id);
                return (
                  <div key={t.id} style={{ background: "#1a1a1a", borderRadius: 8, padding: 12, borderLeft: `3px solid ${agent?.color ?? "#555"}` }}>
                    <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 4 }}>
                      <span style={{ fontWeight: 600, color: agent?.color ?? "#888" }}>{agent?.avatar} {agent?.name ?? t.agent_id}</span>
                      <span style={{ fontSize: 10, color: t.status === "completed" ? "#4caf50" : t.status === "failed" ? "#ef5350" : "#ffd740" }}>{t.status}</span>
                    </div>
                    <div style={{ fontSize: 12, color: "#aaa", marginBottom: 4 }}>{t.prompt.slice(0, 100)}{t.prompt.length > 100 ? "..." : ""}</div>
                    {isKing && <div style={{ fontSize: 10, color: "#666" }}>User: {t.owner_user_id.slice(0, 8)}...</div>}
                    <div style={{ fontSize: 10, color: "#555" }}>{new Date(t.created_at).toLocaleString()}</div>
                  </div>
                );
              })}
              {tasks.length === 0 && <p style={{ color: "#555", fontSize: 13 }}>No tasks yet. Select an agent and give it something to do.</p>}
            </div>
          </div>
        )}

        {/* ── FUNNEL TAB ── */}
        {tab === "funnel" && (
          <div>
            {/* King funnel stats */}
            {isKing && funnelStats && (
              <div style={{ display: "grid", gridTemplateColumns: "repeat(6, 1fr)", gap: 8, marginBottom: 20 }}>
                {STAGE_ORDER.map(stage => (
                  <div key={stage} style={{ background: "#1a1a1a", borderRadius: 8, padding: 12, textAlign: "center", borderTop: `3px solid ${STAGE_COLORS[stage]}` }}>
                    <div style={{ fontSize: 24, fontWeight: 800, color: STAGE_COLORS[stage] }}>
                      {(funnelStats.funnel as any)[stage] ?? 0}
                    </div>
                    <div style={{ fontSize: 10, color: "#888", textTransform: "capitalize" }}>{stage}</div>
                  </div>
                ))}
              </div>
            )}

            {/* Funnel visual */}
            <div style={{ display: "flex", gap: 12, minHeight: 400 }}>
              {STAGE_ORDER.map(stage => {
                const stageLeads = leads.filter(l => l.funnel_stage === stage);
                return (
                  <div key={stage} style={{ flex: 1, background: "#111", borderRadius: 8, padding: 8, minWidth: 0 }}>
                    <div style={{ textAlign: "center", padding: "8px 0", borderBottom: `2px solid ${STAGE_COLORS[stage]}`, marginBottom: 8 }}>
                      <span style={{ fontSize: 12, fontWeight: 700, color: STAGE_COLORS[stage], textTransform: "capitalize" }}>{stage}</span>
                      <span style={{ fontSize: 10, color: "#666", marginLeft: 4 }}>({stageLeads.length})</span>
                    </div>
                    {stageLeads.map(lead => (
                      <div key={lead.id} style={{ background: "#1a1a1a", borderRadius: 6, padding: 8, marginBottom: 6, fontSize: 11 }}>
                        <div style={{ fontWeight: 600, color: "#e0e0e0" }}>Score: {lead.score}</div>
                        {lead.notes && <div style={{ color: "#888", marginTop: 2 }}>{lead.notes.slice(0, 60)}</div>}
                        {isKing && <div style={{ color: "#555", fontSize: 9, marginTop: 2 }}>Owner: {lead.owner_user_id.slice(0, 8)}...</div>}
                      </div>
                    ))}
                    {stageLeads.length === 0 && <div style={{ color: "#333", textAlign: "center", fontSize: 10, padding: 20 }}>Empty</div>}
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* ── CHAT TAB ── */}
        {tab === "chat" && (
          <div style={{ display: "flex", flexDirection: "column", height: "calc(100vh - 200px)" }}>
            {/* Agent selector */}
            <div style={{ display: "flex", gap: 8, marginBottom: 12, flexWrap: "wrap" }}>
              {roster.map(a => (
                <button key={a.id} onClick={() => openChat(a)} style={{
                  padding: "6px 14px", borderRadius: 8, border: selectedAgent?.id === a.id ? `2px solid ${a.color}` : "1px solid #333",
                  background: selectedAgent?.id === a.id ? `${a.color}22` : "#1a1a1a", color: a.color, fontSize: 12, fontWeight: 600, cursor: "pointer",
                }}>{a.avatar} {a.name}</button>
              ))}
            </div>

            {selectedAgent ? (
              <>
                {/* Messages */}
                <div style={{ flex: 1, overflow: "auto", background: "#111", borderRadius: 8, padding: 12 }}>
                  {chatHistory.map((msg, i) => (
                    <div key={i} style={{ marginBottom: 12, display: "flex", flexDirection: "column", alignItems: msg.role === "user" ? "flex-end" : "flex-start" }}>
                      <div style={{
                        maxWidth: "80%", padding: "10px 14px", borderRadius: 12,
                        background: msg.role === "user" ? "#1e3a5f" : "#1a1a1a",
                        border: msg.role === "user" ? "1px solid #2d5a8e" : `1px solid ${selectedAgent.color}33`,
                      }}>
                        {msg.role === "assistant" && <div style={{ fontSize: 10, color: selectedAgent.color, marginBottom: 4, fontWeight: 700 }}>{selectedAgent.avatar} {selectedAgent.name}</div>}
                        <pre style={{ whiteSpace: "pre-wrap", fontSize: 12, color: "#ddd", margin: 0, lineHeight: 1.5, fontFamily: "inherit" }}>{msg.content}</pre>
                      </div>
                      <span style={{ fontSize: 9, color: "#444", marginTop: 2 }}>{new Date(msg.created_at).toLocaleTimeString()}</span>
                    </div>
                  ))}
                  {chatLoading && (
                    <div style={{ color: selectedAgent.color, fontSize: 12, padding: 8 }}>
                      {selectedAgent.avatar} {selectedAgent.name} is thinking...
                    </div>
                  )}
                  <div ref={chatEndRef} />
                </div>

                {/* Input */}
                <div style={{ display: "flex", gap: 8, marginTop: 8 }}>
                  <input value={chatInput} onChange={e => setChatInput(e.target.value)}
                    onKeyDown={e => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); sendChat(); } }}
                    placeholder={`Ask ${selectedAgent.name}...`}
                    style={{ flex: 1, padding: "10px 14px", background: "#1a1a1a", color: "#e0e0e0", border: "1px solid #333", borderRadius: 8, fontSize: 13 }} />
                  <button onClick={sendChat} disabled={chatLoading || !chatInput.trim()}
                    style={{ padding: "10px 20px", background: chatLoading ? "#555" : selectedAgent.color, color: "#fff", border: "none", borderRadius: 8, fontWeight: 700, cursor: chatLoading ? "wait" : "pointer" }}>
                    Send
                  </button>
                </div>
              </>
            ) : (
              <div style={{ textAlign: "center", padding: 40, color: "#555" }}>Select an agent above to start chatting.</div>
            )}
          </div>
        )}

        {/* ── SETTINGS TAB ── */}
        {tab === "settings" && (
          <div style={{ maxWidth: 600 }}>
            <h3 style={{ color: "#ff6b35", marginBottom: 16 }}>Agent Settings</h3>

            {/* Email assignment */}
            <div style={{ background: "#1a1a1a", borderRadius: 12, padding: 20, marginBottom: 16 }}>
              <h4 style={{ color: "#11a0dc", margin: "0 0 8px" }}>📧 x3star.net Email</h4>
              {userEmail ? (
                <div>
                  <div style={{ fontSize: 14, fontWeight: 600, color: "#4caf50" }}>{userEmail.email_address}</div>
                  <div style={{ fontSize: 11, color: "#888", marginTop: 4 }}>SMTP user: {userEmail.smtp_username}</div>
                </div>
              ) : (
                <div>
                  <p style={{ color: "#888", fontSize: 13 }}>Get your personal @x3star.net email address for outreach.</p>
                  <button onClick={assignMyEmail} style={{ padding: "8px 20px", background: "#11a0dc", color: "#fff", border: "none", borderRadius: 8, fontWeight: 600, cursor: "pointer" }}>
                    Assign Email
                  </button>
                </div>
              )}
            </div>

            {/* Proxy */}
            <div style={{ background: "#1a1a1a", borderRadius: 12, padding: 20, marginBottom: 16 }}>
              <h4 style={{ color: "#a855f7", margin: "0 0 8px" }}>🔒 Proxy</h4>
              {userProxy ? (
                <div>
                  <div style={{ fontSize: 13, color: "#e0e0e0" }}>{userProxy.proxy_type}://{userProxy.proxy_host}:{userProxy.proxy_port}</div>
                  <div style={{ fontSize: 11, color: "#888", marginTop: 4 }}>Active: {userProxy.active ? "Yes" : "No"}</div>
                </div>
              ) : (
                <p style={{ color: "#888", fontSize: 13 }}>No proxy assigned. King can assign proxies from the admin panel.</p>
              )}
            </div>

            {/* Ollama status */}
            <div style={{ background: "#1a1a1a", borderRadius: 12, padding: 20 }}>
              <h4 style={{ color: "#ff6b35", margin: "0 0 8px" }}>🤖 Ollama Status</h4>
              <div style={{ fontSize: 13 }}>
                <div>Status: <span style={{ color: ollamaStatus?.online ? "#4caf50" : "#ef5350" }}>{ollamaStatus?.online ? "Online" : "Offline"}</span></div>
                <div>URL: {ollamaStatus?.url ?? "N/A"}</div>
                <div style={{ marginTop: 8 }}>Models loaded:</div>
                {ollamaStatus?.models?.map((m: any, i: number) => (
                  <div key={i} style={{ fontSize: 11, color: "#888", marginLeft: 12 }}>• {m.name}</div>
                ))}
                {(!ollamaStatus?.models || ollamaStatus.models.length === 0) && <div style={{ fontSize: 11, color: "#555", marginLeft: 12 }}>None found</div>}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default AgentsPage;
