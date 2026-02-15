import React, { useEffect, useState } from "react";
import * as api from "../lib/api";
import {
  Coins,
  Plus,
  Send,
  RefreshCw,
  Search,
  ChevronRight,
  FileText,
  Hash,
  Repeat,
} from "lucide-react";

interface Asset {
  name: string;
  balance: number;
  units?: number;
  reissuable?: boolean;
  has_ipfs?: boolean;
}

export default function AssetsPage() {
  const [assets, setAssets] = useState<Asset[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [activeTab, setActiveTab] = useState<"my" | "all">("my");
  const [showIssueModal, setShowIssueModal] = useState(false);
  const [showTransferModal, setShowTransferModal] = useState(false);
  const [selectedAsset, setSelectedAsset] = useState<Asset | null>(null);

  const fetchAssets = async () => {
    setLoading(true);
    try {
      const data = activeTab === "my"
        ? await api.listMyAssets()
        : await api.listAssets();

      // Convert to array format
      const assetList: Asset[] = [];
      if (data && typeof data === "object") {
        for (const [name, value] of Object.entries(data)) {
          if (typeof value === "number") {
            assetList.push({ name, balance: value });
          } else if (typeof value === "object" && value !== null) {
            assetList.push({
              name,
              balance: (value as any).balance || 0,
              ...(value as any),
            });
          }
        }
      }
      setAssets(assetList);
    } catch (err) {
      console.error("Failed to fetch assets:", err);
      setAssets([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAssets();
  }, [activeTab]);

  const filteredAssets = assets.filter((asset) =>
    asset.name.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="animate-fade-in">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-yellow-500 to-orange-500 flex items-center justify-center shadow-lg">
            <Coins className="w-6 h-6 text-white" />
          </div>
          <div>
            <h2 className="text-2xl font-bold text-white">Assets</h2>
            <p className="text-surface-400">Manage your tokens and assets</p>
          </div>
        </div>

        <button
          onClick={() => setShowIssueModal(true)}
          className="btn-primary flex items-center gap-2"
        >
          <Plus className="w-5 h-5" />
          Issue Asset
        </button>
      </div>

      {/* Tabs & Search */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex bg-surface-800 rounded-xl p-1">
          <button
            onClick={() => setActiveTab("my")}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
              activeTab === "my"
                ? "bg-primary-600 text-white"
                : "text-surface-400 hover:text-white"
            }`}
          >
            My Assets
          </button>
          <button
            onClick={() => setActiveTab("all")}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
              activeTab === "all"
                ? "bg-primary-600 text-white"
                : "text-surface-400 hover:text-white"
            }`}
          >
            All Assets
          </button>
        </div>

        <div className="flex items-center gap-4">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-surface-500" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="input pl-10 w-64"
              placeholder="Search assets..."
            />
          </div>

          <button
            onClick={fetchAssets}
            className="btn-icon"
            disabled={loading}
          >
            <RefreshCw className={`w-5 h-5 ${loading ? "animate-spin" : ""}`} />
          </button>
        </div>
      </div>

      {/* Assets Grid */}
      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {[...Array(6)].map((_, i) => (
            <div key={i} className="card h-40 animate-pulse bg-surface-800" />
          ))}
        </div>
      ) : filteredAssets.length === 0 ? (
        <div className="card text-center py-16">
          <Coins className="w-16 h-16 text-surface-600 mx-auto mb-4" />
          <h3 className="text-xl font-semibold text-white mb-2">No Assets Found</h3>
          <p className="text-surface-400 mb-6">
            {activeTab === "my"
              ? "You don't own any assets yet. Issue your first asset!"
              : "No assets match your search criteria."}
          </p>
          {activeTab === "my" && (
            <button
              onClick={() => setShowIssueModal(true)}
              className="btn-primary"
            >
              Issue Asset
            </button>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredAssets.map((asset) => (
            <AssetCard
              key={asset.name}
              asset={asset}
              onTransfer={() => {
                setSelectedAsset(asset);
                setShowTransferModal(true);
              }}
            />
          ))}
        </div>
      )}

      {/* Issue Asset Modal */}
      {showIssueModal && (
        <IssueAssetModal onClose={() => setShowIssueModal(false)} onSuccess={fetchAssets} />
      )}

      {/* Transfer Modal */}
      {showTransferModal && selectedAsset && (
        <TransferAssetModal
          asset={selectedAsset}
          onClose={() => {
            setShowTransferModal(false);
            setSelectedAsset(null);
          }}
          onSuccess={fetchAssets}
        />
      )}
    </div>
  );
}

function AssetCard({
  asset,
  onTransfer,
}: {
  asset: Asset;
  onTransfer: () => void;
}) {
  const isSubAsset = asset.name.includes("/");
  const isUnique = asset.name.includes("#");

  return (
    <div className="card-hover group">
      <div className="flex items-start justify-between mb-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-yellow-500 to-orange-500 flex items-center justify-center">
            {isUnique ? (
              <Hash className="w-5 h-5 text-white" />
            ) : (
              <Coins className="w-5 h-5 text-white" />
            )}
          </div>
          <div>
            <h3 className="text-white font-semibold text-sm truncate max-w-[180px]">
              {asset.name}
            </h3>
            <p className="text-xs text-surface-500">
              {isSubAsset ? "Sub-Asset" : isUnique ? "Unique" : "Root Asset"}
            </p>
          </div>
        </div>

        {asset.reissuable && (
          <span className="badge-info">
            <Repeat className="w-3 h-3 mr-1" />
            Reissuable
          </span>
        )}
      </div>

      <div className="mb-4">
        <p className="text-2xl font-bold text-white">
          {api.formatMYNTA(asset.balance, asset.units || 0)}
        </p>
        {asset.units !== undefined && (
          <p className="text-xs text-surface-500">
            {asset.units} decimal places
          </p>
        )}
      </div>

      {asset.has_ipfs && (
        <div className="flex items-center gap-2 text-xs text-surface-400 mb-4">
          <FileText className="w-4 h-4" />
          <span>Has IPFS metadata</span>
        </div>
      )}

      <div className="flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
        <button onClick={onTransfer} className="btn-secondary flex-1 text-sm py-2">
          <Send className="w-4 h-4 mr-1" />
          Transfer
        </button>
        <button className="btn-ghost py-2">
          <ChevronRight className="w-5 h-5" />
        </button>
      </div>
    </div>
  );
}

function IssueAssetModal({
  onClose,
  onSuccess,
}: {
  onClose: () => void;
  onSuccess: () => void;
}) {
  const [form, setForm] = useState({
    name: "",
    qty: "1000",
    units: 8,
    reissuable: true,
    has_ipfs: false,
    ipfs_hash: "",
  });
  const [issuing, setIssuing] = useState(false);
  const [error, setError] = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIssuing(true);
    setError("");

    try {
      await api.issueAsset({
        name: form.name.toUpperCase(),
        qty: parseFloat(form.qty),
        units: form.units,
        reissuable: form.reissuable,
        has_ipfs: form.has_ipfs,
        ipfs_hash: form.has_ipfs ? form.ipfs_hash : undefined,
      });
      onSuccess();
      onClose();
    } catch (err: any) {
      setError(err.message || "Failed to issue asset");
    } finally {
      setIssuing(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 z-50">
      <div className="glass-card w-full max-w-lg p-6 animate-scale-in">
        <h2 className="text-2xl font-bold text-white mb-6">Issue New Asset</h2>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="label">Asset Name</label>
            <input
              type="text"
              value={form.name}
              onChange={(e) =>
                setForm({ ...form, name: e.target.value.toUpperCase() })
              }
              className="input uppercase"
              placeholder="MY_ASSET"
              pattern="[A-Z][A-Z0-9_.]*"
              required
            />
            <p className="text-xs text-surface-500 mt-1">
              3-12 characters, starts with letter, A-Z, 0-9, _, allowed
            </p>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="label">Quantity</label>
              <input
                type="number"
                value={form.qty}
                onChange={(e) => setForm({ ...form, qty: e.target.value })}
                className="input"
                min="1"
                required
              />
            </div>
            <div>
              <label className="label">Decimal Units</label>
              <select
                value={form.units}
                onChange={(e) =>
                  setForm({ ...form, units: parseInt(e.target.value) })
                }
                className="input"
              >
                {[0, 1, 2, 3, 4, 5, 6, 7, 8].map((n) => (
                  <option key={n} value={n}>
                    {n}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="flex items-center gap-4">
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={form.reissuable}
                onChange={(e) =>
                  setForm({ ...form, reissuable: e.target.checked })
                }
                className="w-4 h-4 rounded border-surface-600 bg-surface-800 text-primary-500 focus:ring-primary-500"
              />
              <span className="text-surface-300">Reissuable</span>
            </label>

            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={form.has_ipfs}
                onChange={(e) =>
                  setForm({ ...form, has_ipfs: e.target.checked })
                }
                className="w-4 h-4 rounded border-surface-600 bg-surface-800 text-primary-500 focus:ring-primary-500"
              />
              <span className="text-surface-300">Has IPFS Data</span>
            </label>
          </div>

          {form.has_ipfs && (
            <div>
              <label className="label">IPFS Hash</label>
              <input
                type="text"
                value={form.ipfs_hash}
                onChange={(e) => setForm({ ...form, ipfs_hash: e.target.value })}
                className="input font-mono"
                placeholder="Qm..."
                required={form.has_ipfs}
              />
            </div>
          )}

          {/* Fee Info */}
          <div className="p-4 bg-surface-800/50 rounded-xl">
            <div className="flex justify-between text-sm">
              <span className="text-surface-400">Issue Fee</span>
              <span className="text-white">500 MYNTA</span>
            </div>
          </div>

          {error && (
            <p className="text-red-400 text-sm">{error}</p>
          )}

          <div className="flex gap-4 pt-4">
            <button type="button" onClick={onClose} className="btn-secondary flex-1">
              Cancel
            </button>
            <button type="submit" disabled={issuing} className="btn-primary flex-1">
              {issuing ? "Issuing..." : "Issue Asset"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

function TransferAssetModal({
  asset,
  onClose,
  onSuccess,
}: {
  asset: Asset;
  onClose: () => void;
  onSuccess: () => void;
}) {
  const [address, setAddress] = useState("");
  const [amount, setAmount] = useState("");
  const [transferring, setTransferring] = useState(false);
  const [error, setError] = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setTransferring(true);
    setError("");

    try {
      await api.transferAsset(asset.name, parseFloat(amount), address);
      onSuccess();
      onClose();
    } catch (err: any) {
      setError(err.message || "Transfer failed");
    } finally {
      setTransferring(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 z-50">
      <div className="glass-card w-full max-w-lg p-6 animate-scale-in">
        <h2 className="text-2xl font-bold text-white mb-2">Transfer Asset</h2>
        <p className="text-surface-400 mb-6">{asset.name}</p>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="label">Recipient Address</label>
            <input
              type="text"
              value={address}
              onChange={(e) => setAddress(e.target.value)}
              className="input font-mono"
              placeholder="Mynta address"
              required
            />
          </div>

          <div>
            <label className="label">
              Amount (Available: {api.formatMYNTA(asset.balance, asset.units || 0)})
            </label>
            <input
              type="number"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              className="input"
              min="0"
              max={asset.balance}
              step={Math.pow(10, -(asset.units || 0))}
              required
            />
          </div>

          {error && <p className="text-red-400 text-sm">{error}</p>}

          <div className="flex gap-4 pt-4">
            <button type="button" onClick={onClose} className="btn-secondary flex-1">
              Cancel
            </button>
            <button type="submit" disabled={transferring} className="btn-primary flex-1">
              {transferring ? "Sending..." : "Send"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}



