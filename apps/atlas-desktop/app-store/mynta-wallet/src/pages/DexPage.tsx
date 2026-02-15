import { useEffect, useState } from "react";
import * as api from "../lib/api";
import {
  ArrowLeftRight,
  RefreshCw,
  TrendingUp,
  TrendingDown,
  Clock,
  Plus,
  X,
  ArrowDown,
  Check,
} from "lucide-react";

interface Offer {
  hash: string;
  makerAsset: string;
  makerAmount: number;
  takerAsset: string;
  takerAmount: number;
  rate: number;
  expiresHeight: number;
}

export default function DexPage() {
  const [orderBook, setOrderBook] = useState<api.OrderBook | null>(null);
  const [loading, setLoading] = useState(true);
  const [selectedPair, setSelectedPair] = useState<string>("MYNTA/MYNTA");
  const [showCreateOffer, setShowCreateOffer] = useState(false);
  const [assets, setAssets] = useState<string[]>([]);

  // Form state
  const [sellAsset, setSellAsset] = useState("MYNTA");
  const [sellAmount, setSellAmount] = useState("");
  const [buyAsset, setBuyAsset] = useState("");
  const [buyAmount, setBuyAmount] = useState("");
  const [creating, setCreating] = useState(false);
  const [createResult, setCreateResult] = useState<api.CreateOfferResult | null>(null);

  const fetchData = async () => {
    setLoading(true);
    try {
      // Fetch available assets
      const assetList = await api.listMyAssets().catch(() => []);
      setAssets(["MYNTA", ...Object.keys(assetList)]);

      // Fetch order book for selected pair
      const [base, quote] = selectedPair.split("/");
      const book = await api.dexOrderBook(base, quote).catch(() => null);
      setOrderBook(book);
    } catch (err) {
      console.error("Failed to fetch DEX data:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [selectedPair]);

  const handleCreateOffer = async () => {
    if (!sellAmount || !buyAmount || !buyAsset) return;
    
    setCreating(true);
    try {
      const result = await api.dexCreateOffer(
        sellAsset,
        parseFloat(sellAmount),
        buyAsset,
        parseFloat(buyAmount)
      );
      setCreateResult(result);
      setShowCreateOffer(false);
      fetchData();
    } catch (err: any) {
      alert("Failed to create offer: " + err.message);
    } finally {
      setCreating(false);
    }
  };

  const handleCancelOffer = async (hash: string) => {
    try {
      await api.dexCancelOffer(hash);
      fetchData();
    } catch (err: any) {
      alert("Failed to cancel offer: " + err.message);
    }
  };

  const handleTakeOffer = async (hash: string) => {
    try {
      await api.dexTakeOffer(hash);
      fetchData();
    } catch (err: any) {
      alert("Failed to take offer: " + err.message);
    }
  };

  return (
    <div className="animate-fade-in">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-blue-500 to-cyan-500 flex items-center justify-center shadow-lg">
            <ArrowLeftRight className="w-6 h-6 text-white" />
          </div>
          <div>
            <h2 className="text-2xl font-bold text-white">DEX</h2>
            <p className="text-surface-400">Decentralized asset exchange</p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={() => setShowCreateOffer(true)}
            className="btn-primary flex items-center gap-2"
          >
            <Plus className="w-5 h-5" />
            Create Offer
          </button>
          <button
            onClick={fetchData}
            disabled={loading}
            className="btn-secondary flex items-center gap-2"
          >
            <RefreshCw className={`w-5 h-5 ${loading ? "animate-spin" : ""}`} />
          </button>
        </div>
      </div>

      {/* Trading Pair Selector */}
      <div className="card mb-6">
        <div className="flex items-center gap-4">
          <label className="text-surface-400">Trading Pair:</label>
          <select
            value={sellAsset}
            onChange={(e) => {
              setSellAsset(e.target.value);
              setSelectedPair(`${e.target.value}/${buyAsset || "MYNTA"}`);
            }}
            className="input-field w-40"
          >
            {assets.map((asset) => (
              <option key={asset} value={asset}>
                {asset}
              </option>
            ))}
          </select>
          <span className="text-surface-400">/</span>
          <select
            value={buyAsset}
            onChange={(e) => {
              setBuyAsset(e.target.value);
              setSelectedPair(`${sellAsset}/${e.target.value}`);
            }}
            className="input-field w-40"
          >
            <option value="">Select Asset</option>
            {assets
              .filter((a) => a !== sellAsset)
              .map((asset) => (
                <option key={asset} value={asset}>
                  {asset}
                </option>
              ))}
          </select>
        </div>
      </div>

      {/* Order Book */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Bids (Buy Orders) */}
        <div className="card">
          <h3 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
            <TrendingUp className="w-5 h-5 text-green-400" />
            Bids (Buy Orders)
          </h3>

          {loading ? (
            <div className="space-y-2">
              {[...Array(5)].map((_, i) => (
                <div key={i} className="h-12 bg-surface-800 rounded-lg animate-pulse" />
              ))}
            </div>
          ) : orderBook?.bids.length === 0 ? (
            <p className="text-surface-500 text-center py-8">No buy orders</p>
          ) : (
            <div className="space-y-2">
              {orderBook?.bids.map((offer) => (
                <OfferRow
                  key={offer.hash}
                  offer={offer}
                  type="bid"
                  onTake={() => handleTakeOffer(offer.hash)}
                  onCancel={() => handleCancelOffer(offer.hash)}
                />
              ))}
            </div>
          )}
        </div>

        {/* Asks (Sell Orders) */}
        <div className="card">
          <h3 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
            <TrendingDown className="w-5 h-5 text-red-400" />
            Asks (Sell Orders)
          </h3>

          {loading ? (
            <div className="space-y-2">
              {[...Array(5)].map((_, i) => (
                <div key={i} className="h-12 bg-surface-800 rounded-lg animate-pulse" />
              ))}
            </div>
          ) : orderBook?.asks.length === 0 ? (
            <p className="text-surface-500 text-center py-8">No sell orders</p>
          ) : (
            <div className="space-y-2">
              {orderBook?.asks.map((offer) => (
                <OfferRow
                  key={offer.hash}
                  offer={offer}
                  type="ask"
                  onTake={() => handleTakeOffer(offer.hash)}
                  onCancel={() => handleCancelOffer(offer.hash)}
                />
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Create Offer Modal */}
      {showCreateOffer && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="card w-full max-w-md mx-4">
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-xl font-bold text-white">Create Swap Offer</h3>
              <button
                onClick={() => setShowCreateOffer(false)}
                className="p-2 hover:bg-surface-700 rounded-lg transition-colors"
              >
                <X className="w-5 h-5 text-surface-400" />
              </button>
            </div>

            <div className="space-y-4">
              {/* Sell */}
              <div>
                <label className="block text-sm font-medium text-surface-300 mb-2">
                  You Send
                </label>
                <div className="flex gap-3">
                  <select
                    value={sellAsset}
                    onChange={(e) => setSellAsset(e.target.value)}
                    className="input-field w-32"
                  >
                    {assets.map((asset) => (
                      <option key={asset} value={asset}>
                        {asset}
                      </option>
                    ))}
                  </select>
                  <input
                    type="number"
                    value={sellAmount}
                    onChange={(e) => setSellAmount(e.target.value)}
                    placeholder="Amount"
                    className="input-field flex-1"
                  />
                </div>
              </div>

              <div className="flex justify-center">
                <ArrowDown className="w-6 h-6 text-surface-500" />
              </div>

              {/* Buy */}
              <div>
                <label className="block text-sm font-medium text-surface-300 mb-2">
                  You Receive
                </label>
                <div className="flex gap-3">
                  <select
                    value={buyAsset}
                    onChange={(e) => setBuyAsset(e.target.value)}
                    className="input-field w-32"
                  >
                    <option value="">Select</option>
                    {assets
                      .filter((a) => a !== sellAsset)
                      .map((asset) => (
                        <option key={asset} value={asset}>
                          {asset}
                        </option>
                      ))}
                  </select>
                  <input
                    type="number"
                    value={buyAmount}
                    onChange={(e) => setBuyAmount(e.target.value)}
                    placeholder="Amount"
                    className="input-field flex-1"
                  />
                </div>
              </div>

              {/* Rate Display */}
              {sellAmount && buyAmount && (
                <div className="p-3 bg-surface-800 rounded-lg">
                  <p className="text-sm text-surface-400">Exchange Rate</p>
                  <p className="text-white font-mono">
                    1 {sellAsset} = {(parseFloat(buyAmount) / parseFloat(sellAmount)).toFixed(8)} {buyAsset}
                  </p>
                </div>
              )}

              <button
                onClick={handleCreateOffer}
                disabled={creating || !sellAmount || !buyAmount || !buyAsset}
                className="btn-primary w-full mt-4"
              >
                {creating ? "Creating..." : "Create Offer"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Success Modal */}
      {createResult && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="card w-full max-w-md mx-4">
            <div className="text-center mb-6">
              <div className="w-16 h-16 rounded-full bg-green-500/20 flex items-center justify-center mx-auto mb-4">
                <Check className="w-8 h-8 text-green-400" />
              </div>
              <h3 className="text-xl font-bold text-white">Offer Created!</h3>
            </div>

            <div className="space-y-3 mb-6">
              <div className="flex justify-between text-sm">
                <span className="text-surface-400">Offer Hash</span>
                <code className="text-white font-mono text-xs">
                  {api.shortenTxid(createResult.offerHash)}
                </code>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-surface-400">Selling</span>
                <span className="text-white">
                  {createResult.sellAmount} {createResult.sellAsset}
                </span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-surface-400">For</span>
                <span className="text-white">
                  {createResult.buyAmount} {createResult.buyAsset}
                </span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-surface-400">Expires at Block</span>
                <span className="text-white">{createResult.expiresHeight}</span>
              </div>
            </div>

            <div className="p-3 bg-yellow-500/10 border border-yellow-500/20 rounded-lg mb-6">
              <p className="text-sm text-yellow-400">
                <strong>Important:</strong> Save your secret key! You'll need it to complete the swap.
              </p>
              <code className="text-xs text-surface-300 font-mono break-all mt-2 block">
                {createResult.secret}
              </code>
            </div>

            <button
              onClick={() => setCreateResult(null)}
              className="btn-primary w-full"
            >
              Close
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

function OfferRow({
  offer,
  type,
  onTake,
  onCancel: _onCancel,
}: {
  offer: Offer;
  type: "bid" | "ask";
  onTake: () => void;
  onCancel: () => void;
}) {
  void _onCancel; // Reserved for future use
  return (
    <div className="flex items-center justify-between p-3 bg-surface-800/50 rounded-lg hover:bg-surface-800 transition-colors">
      <div className="flex items-center gap-4">
        <div
          className={`w-2 h-8 rounded-full ${
            type === "bid" ? "bg-green-500" : "bg-red-500"
          }`}
        />
        <div>
          <p className="text-white font-medium">
            {offer.makerAmount.toLocaleString()} {offer.makerAsset}
          </p>
          <p className="text-sm text-surface-400">
            for {offer.takerAmount.toLocaleString()} {offer.takerAsset}
          </p>
        </div>
      </div>

      <div className="flex items-center gap-3">
        <div className="text-right">
          <p className="text-sm font-mono text-surface-300">
            {offer.rate.toFixed(8)}
          </p>
          <p className="text-xs text-surface-500 flex items-center gap-1">
            <Clock className="w-3 h-3" />
            Block {offer.expiresHeight}
          </p>
        </div>

        <button
          onClick={onTake}
          className="btn-primary py-2 px-4 text-sm"
        >
          Take
        </button>
      </div>
    </div>
  );
}






