/**
 * SecurityPanel — Key management, attestation, and governance signing.
 *
 * Displays:
 *   - Identity / key inventory
 *   - Hardware attestation status
 *   - Recent signing operations
 *   - Governance signature queue
 *
 * Mock data until tauri-plugin-auth is wired.
 */
import React, { useEffect, useState } from "react";

interface KeyEntry {
  id: string;
  label: string;
  type: "sr25519" | "ed25519" | "ecdsa" | "aes256";
  purpose: "signing" | "encryption" | "attestation" | "governance";
  pubKey: string;
  created: string;
  lastUsed: string;
  status: "active" | "locked" | "revoked";
}

interface AttestationRecord {
  provider: string;
  hardware: string;
  tpm: boolean;
  sgxSupport: boolean;
  lastAttest: string;
  result: "passed" | "pending" | "failed";
}

interface SignOp {
  ts: string;
  action: string;
  signer: string;
  hash: string;
  result: "signed" | "rejected" | "pending";
}

function mockKeys(): KeyEntry[] {
  return [
    { id: "k-1", label: "Provider Identity", type: "sr25519", purpose: "signing", pubKey: "5GrwvaEF...43jS", created: "2026-01-15", lastUsed: "2min ago", status: "active" },
    { id: "k-2", label: "Governance Key", type: "ed25519", purpose: "governance", pubKey: "5FHneW46...8qPm", created: "2026-01-20", lastUsed: "1hr ago", status: "active" },
    { id: "k-3", label: "Storage Encryption", type: "aes256", purpose: "encryption", pubKey: "—", created: "2026-02-01", lastUsed: "45min ago", status: "active" },
    { id: "k-4", label: "Hardware Attestation", type: "ecdsa", purpose: "attestation", pubKey: "0x04a1b2...c3d4", created: "2026-01-10", lastUsed: "12min ago", status: "active" },
    { id: "k-5", label: "Legacy Signing (deprecated)", type: "sr25519", purpose: "signing", pubKey: "5DAAnrj7...7nFc", created: "2025-11-03", lastUsed: "30d ago", status: "revoked" },
  ];
}

function mockAttestations(): AttestationRecord[] {
  return [
    { provider: "atlas-gpu-0", hardware: "RTX 4090 24GB", tpm: true, sgxSupport: true, lastAttest: "3min ago", result: "passed" },
    { provider: "atlas-gpu-1", hardware: "RTX 3090 24GB", tpm: true, sgxSupport: false, lastAttest: "8min ago", result: "passed" },
    { provider: "edge-node-a", hardware: "RTX A6000 48GB", tpm: false, sgxSupport: true, lastAttest: "—", result: "pending" },
    { provider: "cloud-rtx-0", hardware: "A100 80GB", tpm: true, sgxSupport: true, lastAttest: "2hr ago", result: "failed" },
  ];
}

function mockSignOps(): SignOp[] {
  return [
    { ts: "14:32:18", action: "Governance::vote #42", signer: "Governance Key", hash: "0xa3f2...d891", result: "signed" },
    { ts: "14:28:44", action: "Storage::submit_proof", signer: "Provider Identity", hash: "0xb7c1...e442", result: "signed" },
    { ts: "14:25:11", action: "Swarm::register_node", signer: "Hardware Attestation", hash: "0xc9d3...f103", result: "signed" },
    { ts: "14:20:03", action: "Governance::propose #43", signer: "Governance Key", hash: "0xd1e4...a254", result: "pending" },
    { ts: "14:15:28", action: "Balances::transfer 500 ATL", signer: "Provider Identity", hash: "0xe2f5...b315", result: "signed" },
    { ts: "14:10:00", action: "HTLC::create_lock", signer: "Provider Identity", hash: "0xf306...c476", result: "rejected" },
  ];
}

const PURPOSE_COLORS: Record<string, string> = {
  signing: "#ff6b35",
  encryption: "#00b4ff",
  attestation: "#8b5cf6",
  governance: "#ff4488",
};

const RESULT_COLORS: Record<string, string> = {
  passed: "#4caf50",
  pending: "#ff9800",
  failed: "#ef5350",
  signed: "#4caf50",
  rejected: "#ef5350",
  active: "#4caf50",
  locked: "#ff9800",
  revoked: "#ef5350",
};

/* ── Main Component ────────────────────────────────────────── */

const SecurityPanel: React.FC = () => {
  const [keys, setKeys] = useState<KeyEntry[]>([]);
  const [attestations, setAttestations] = useState<AttestationRecord[]>([]);
  const [signOps, setSignOps] = useState<SignOp[]>([]);
  const [tab, setTab] = useState<"keys" | "attest" | "signing">("keys");

  useEffect(() => {
    setKeys(mockKeys());
    setAttestations(mockAttestations());
    setSignOps(mockSignOps());
  }, []);

  return (
    <div className="h-full flex flex-col bg-[#0a0a0f] text-[#e0e0e0] overflow-hidden">
      {/* Header */}
      <div className="flex items-center gap-4 px-4 py-3 border-b border-[#ef5350]/15 bg-[#0d0d14]">
        <Stat label="KEYS" value={String(keys.filter((k) => k.status === "active").length)} color="#4caf50" />
        <Stat label="ATTESTATIONS" value={`${attestations.filter((a) => a.result === "passed").length}/${attestations.length}`} color="#8b5cf6" />
        <Stat label="SIGNED" value={String(signOps.filter((s) => s.result === "signed").length)} color="#ff6b35" />
        <div className="flex-1" />
        <div className="flex gap-1">
          {(["keys", "attest", "signing"] as const).map((t) => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={`px-2 py-1 text-[10px] font-mono uppercase rounded transition ${
                tab === t ? "bg-[#ef5350]/20 text-[#ef5350]" : "text-[#666] hover:text-[#999]"
              }`}
            >
              {t}
            </button>
          ))}
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto px-3 py-2 scrollbar-thin scrollbar-thumb-[#ef5350]/20">
        {tab === "keys" && (
          <div className="space-y-2">
            {keys.map((key) => (
              <div
                key={key.id}
                className="p-3 rounded-lg border border-white/5 bg-white/[0.02] hover:bg-white/[0.04] transition"
              >
                <div className="flex items-center gap-2 mb-2">
                  <span className="text-lg">🔑</span>
                  <span className="font-bold text-xs text-[#e0e0e0]">{key.label}</span>
                  <span
                    className="text-[8px] px-1.5 py-0.5 rounded uppercase font-mono ml-auto"
                    style={{
                      color: PURPOSE_COLORS[key.purpose],
                      background: `${PURPOSE_COLORS[key.purpose]}15`,
                      border: `1px solid ${PURPOSE_COLORS[key.purpose]}30`,
                    }}
                  >
                    {key.purpose}
                  </span>
                  <span className="text-[8px] px-1.5 py-0.5 rounded uppercase font-mono text-[#888] bg-white/5">
                    {key.type}
                  </span>
                </div>
                <div className="flex items-center gap-4 text-[10px] font-mono text-[#888]">
                  <span>Pub: <span className="text-[#e0e0e0]">{key.pubKey}</span></span>
                  <span>Last: <span className="text-[#e0e0e0]">{key.lastUsed}</span></span>
                  <span className="ml-auto" style={{ color: RESULT_COLORS[key.status] }}>
                    {key.status.toUpperCase()}
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}

        {tab === "attest" && (
          <div className="space-y-2">
            {attestations.map((a, i) => (
              <div
                key={i}
                className="p-3 rounded-lg border border-white/5 bg-white/[0.02]"
              >
                <div className="flex items-center gap-2 mb-2">
                  <span className="text-lg">🛡</span>
                  <span className="font-bold text-xs text-[#8b5cf6]">{a.provider}</span>
                  <span
                    className="text-[9px] uppercase ml-auto px-1.5 py-0.5 rounded font-mono"
                    style={{
                      color: RESULT_COLORS[a.result],
                      background: `${RESULT_COLORS[a.result]}15`,
                    }}
                  >
                    {a.result}
                  </span>
                </div>
                <div className="flex gap-4 text-[10px] font-mono text-[#888]">
                  <span>HW: <span className="text-[#e0e0e0]">{a.hardware}</span></span>
                  <span>TPM: <span style={{ color: a.tpm ? "#4caf50" : "#ef5350" }}>{a.tpm ? "YES" : "NO"}</span></span>
                  <span>SGX: <span style={{ color: a.sgxSupport ? "#4caf50" : "#ef5350" }}>{a.sgxSupport ? "YES" : "NO"}</span></span>
                  <span>Last: {a.lastAttest}</span>
                </div>
              </div>
            ))}
          </div>
        )}

        {tab === "signing" && (
          <div className="space-y-1">
            {signOps.map((op, i) => (
              <div
                key={i}
                className="flex items-center gap-3 px-3 py-2 rounded border border-white/5 bg-white/[0.02] text-[11px] font-mono"
              >
                <span className="text-[#555] shrink-0">{op.ts}</span>
                <span className="text-[#e0e0e0] flex-1 truncate">{op.action}</span>
                <span className="text-[#888] shrink-0">{op.signer}</span>
                <span className="text-[#555] shrink-0">{op.hash}</span>
                <span
                  className="shrink-0 px-1.5 py-0.5 rounded text-[9px] uppercase"
                  style={{
                    color: RESULT_COLORS[op.result],
                    background: `${RESULT_COLORS[op.result]}15`,
                  }}
                >
                  {op.result}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

const Stat: React.FC<{ label: string; value: string; color: string }> = ({ label, value, color }) => (
  <div className="text-center shrink-0">
    <div className="text-[9px] font-mono uppercase tracking-wider text-[#666]">{label}</div>
    <div className="text-sm font-bold font-mono" style={{ color }}>{value}</div>
  </div>
);

export default SecurityPanel;
