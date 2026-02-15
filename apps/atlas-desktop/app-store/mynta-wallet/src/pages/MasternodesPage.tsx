import { useEffect, useState } from "react";
import * as api from "../lib/api";
import {
  Server,
  RefreshCw,
  CheckCircle,
  XCircle,
  Clock,
  Globe,
  Shield,
  Zap,
  ChevronDown,
  ChevronUp,
  Copy,
} from "lucide-react";

interface Masternode {
  proTxHash: string;
  address: string;
  payee: string;
  status: string;
  confirmedHash: string;
  service: string;
  pubKeyOperator: string;
  votingAddress: string;
  collateralHash: string;
  collateralIndex: number;
}

export default function MasternodesPage() {
  const [masternodes, setMasternodes] = useState<Masternode[]>([]);
  const [count, setCount] = useState<api.MasternodeCount | null>(null);
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState<string | null>(null);
  const [myStatus, setMyStatus] = useState<any>(null);

  const fetchData = async () => {
    setLoading(true);
    try {
      const [countData, listData, statusData] = await Promise.all([
        api.masternodeCount().catch(() => null),
        api.protxList(true).catch(() => []),
        api.masternodeStatus().catch(() => null),
      ]);

      setCount(countData);
      setMyStatus(statusData);

      // Parse masternode list
      const mnList: Masternode[] = listData.map((mn: any) => ({
        proTxHash: mn.proTxHash || "",
        address: mn.collateralAddress || "",
        payee: mn.state?.payoutAddress || "",
        status: mn.state?.status || "UNKNOWN",
        confirmedHash: mn.confirmedHash || "",
        service: mn.state?.service || "",
        pubKeyOperator: mn.state?.pubKeyOperator || "",
        votingAddress: mn.state?.votingAddress || "",
        collateralHash: mn.collateralHash || "",
        collateralIndex: mn.collateralIndex || 0,
      }));

      setMasternodes(mnList);
    } catch (err) {
      console.error("Failed to fetch masternodes:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const enabledCount = count?.enabled || 0;
  const totalCount = count?.total || masternodes.length;

  return (
    <div className="animate-fade-in">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-purple-500 to-pink-500 flex items-center justify-center shadow-lg">
            <Server className="w-6 h-6 text-white" />
          </div>
          <div>
            <h2 className="text-2xl font-bold text-white">Masternodes</h2>
            <p className="text-surface-400">Network masternode status</p>
          </div>
        </div>

        <button
          onClick={fetchData}
          disabled={loading}
          className="btn-secondary flex items-center gap-2"
        >
          <RefreshCw className={`w-5 h-5 ${loading ? "animate-spin" : ""}`} />
          Refresh
        </button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
        <div className="card bg-gradient-to-br from-accent-500/20 to-accent-500/5">
          <div className="flex items-center gap-3">
            <CheckCircle className="w-8 h-8 text-accent-400" />
            <div>
              <p className="stat-label">Enabled</p>
              <p className="text-2xl font-bold text-white">{enabledCount}</p>
            </div>
          </div>
        </div>

        <div className="card bg-gradient-to-br from-primary-500/20 to-primary-500/5">
          <div className="flex items-center gap-3">
            <Server className="w-8 h-8 text-primary-400" />
            <div>
              <p className="stat-label">Total</p>
              <p className="text-2xl font-bold text-white">{totalCount}</p>
            </div>
          </div>
        </div>

        <div className="card bg-gradient-to-br from-yellow-500/20 to-yellow-500/5">
          <div className="flex items-center gap-3">
            <Clock className="w-8 h-8 text-yellow-400" />
            <div>
              <p className="stat-label">Starting</p>
              <p className="text-2xl font-bold text-white">
                {masternodes.filter((mn) => mn.status === "POSE_BAN").length}
              </p>
            </div>
          </div>
        </div>

        <div className="card bg-gradient-to-br from-red-500/20 to-red-500/5">
          <div className="flex items-center gap-3">
            <XCircle className="w-8 h-8 text-red-400" />
            <div>
              <p className="stat-label">Banned</p>
              <p className="text-2xl font-bold text-white">
                {totalCount - enabledCount}
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* My Masternode Status */}
      {myStatus && myStatus.proTxHash && (
        <div className="card mb-6 gradient-border">
          <div className="flex items-center gap-4 mb-4">
            <div className="w-10 h-10 rounded-xl bg-accent-500/20 flex items-center justify-center">
              <Shield className="w-5 h-5 text-accent-400" />
            </div>
            <div>
              <h3 className="text-lg font-semibold text-white">Your Masternode</h3>
              <p className="text-sm text-surface-400">Active and earning rewards</p>
            </div>
            <span className="badge-success ml-auto">
              <Zap className="w-3 h-3 mr-1" />
              {myStatus.state || "ENABLED"}
            </span>
          </div>

          <div className="grid grid-cols-2 gap-4 text-sm">
            <div>
              <p className="text-surface-400">ProTx Hash</p>
              <code className="text-white font-mono text-xs">
                {api.shortenTxid(myStatus.proTxHash)}
              </code>
            </div>
            <div>
              <p className="text-surface-400">Service</p>
              <p className="text-white">{myStatus.service || "N/A"}</p>
            </div>
          </div>
        </div>
      )}

      {/* Masternode List */}
      <div className="card">
        <h3 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
          <Globe className="w-5 h-5 text-primary-400" />
          Network Masternodes
        </h3>

        {loading ? (
          <div className="space-y-3">
            {[...Array(5)].map((_, i) => (
              <div key={i} className="h-16 bg-surface-800 rounded-xl animate-pulse" />
            ))}
          </div>
        ) : masternodes.length === 0 ? (
          <div className="text-center py-12">
            <Server className="w-12 h-12 text-surface-600 mx-auto mb-4" />
            <p className="text-surface-400">No masternodes found</p>
          </div>
        ) : (
          <div className="space-y-2">
            {masternodes.slice(0, 50).map((mn) => (
              <MasternodeRow
                key={mn.proTxHash}
                mn={mn}
                expanded={expanded === mn.proTxHash}
                onToggle={() =>
                  setExpanded(expanded === mn.proTxHash ? null : mn.proTxHash)
                }
              />
            ))}
            {masternodes.length > 50 && (
              <p className="text-center text-surface-500 py-4">
                Showing 50 of {masternodes.length} masternodes
              </p>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

function MasternodeRow({
  mn,
  expanded,
  onToggle,
}: {
  mn: Masternode;
  expanded: boolean;
  onToggle: () => void;
}) {
  const isEnabled = mn.status === "ENABLED" || mn.status === "READY";

  return (
    <div className="bg-surface-800/50 rounded-xl overflow-hidden">
      <button
        onClick={onToggle}
        className="w-full p-4 flex items-center justify-between hover:bg-surface-800 transition-colors"
      >
        <div className="flex items-center gap-4">
          <div
            className={`w-10 h-10 rounded-xl flex items-center justify-center ${
              isEnabled ? "bg-accent-500/20" : "bg-red-500/20"
            }`}
          >
            <Server
              className={`w-5 h-5 ${isEnabled ? "text-accent-400" : "text-red-400"}`}
            />
          </div>
          <div className="text-left">
            <code className="text-white font-mono text-sm">
              {api.shortenTxid(mn.proTxHash)}
            </code>
            <p className="text-sm text-surface-400">{mn.service || "No service"}</p>
          </div>
        </div>

        <div className="flex items-center gap-4">
          <span
            className={
              isEnabled ? "badge-success" : "badge-error"
            }
          >
            {mn.status}
          </span>
          {expanded ? (
            <ChevronUp className="w-5 h-5 text-surface-400" />
          ) : (
            <ChevronDown className="w-5 h-5 text-surface-400" />
          )}
        </div>
      </button>

      {expanded && (
        <div className="px-4 pb-4 pt-2 space-y-3 animate-slide-down">
          <DetailRow label="ProTx Hash" value={mn.proTxHash} copyable />
          <DetailRow label="Service" value={mn.service} />
          <DetailRow label="Payee" value={mn.payee} copyable />
          <DetailRow label="Voting Address" value={mn.votingAddress} copyable />
          <DetailRow label="Collateral" value={`${mn.collateralHash}:${mn.collateralIndex}`} />
          <DetailRow
            label="Operator Key"
            value={mn.pubKeyOperator ? api.shortenTxid(mn.pubKeyOperator) : "N/A"}
          />
        </div>
      )}
    </div>
  );
}

function DetailRow({
  label,
  value,
  copyable = false,
}: {
  label: string;
  value: string;
  copyable?: boolean;
}) {
  const [copied, setCopied] = useState(false);

  const copy = async () => {
    await navigator.clipboard.writeText(value);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="flex items-center justify-between text-sm">
      <span className="text-surface-400">{label}</span>
      <div className="flex items-center gap-2">
        <code className="text-surface-200 font-mono text-xs max-w-[300px] truncate">
          {value || "N/A"}
        </code>
        {copyable && value && (
          <button
            onClick={copy}
            className="p-1 hover:bg-surface-700 rounded transition-colors"
          >
            {copied ? (
              <CheckCircle className="w-4 h-4 text-accent-400" />
            ) : (
              <Copy className="w-4 h-4 text-surface-500" />
            )}
          </button>
        )}
      </div>
    </div>
  );
}

