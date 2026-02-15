import { useState, useEffect } from "react";
import * as api from "../lib/api";
import { ArrowDownLeft, Copy, Check, RefreshCw, Plus, Lightbulb } from "lucide-react";
import QRCode from "../components/QRCode";

export default function ReceivePage() {
  const [address, setAddress] = useState("");
  const [label, setLabel] = useState("");
  const [loading, setLoading] = useState(true);
  const [copied, setCopied] = useState(false);
  const [generating, setGenerating] = useState(false);

  const fetchAddress = async () => {
    try {
      setLoading(true);
      const newAddress = await api.getNewAddress("");
      setAddress(newAddress);
    } catch (err) {
      console.error("Failed to get address:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAddress();
  }, []);

  const generateNewAddress = async () => {
    setGenerating(true);
    try {
      const newAddress = await api.getNewAddress(label || undefined);
      setAddress(newAddress);
      setLabel("");
    } catch (err) {
      console.error("Failed to generate address:", err);
    } finally {
      setGenerating(false);
    }
  };

  const copyAddress = async () => {
    await navigator.clipboard.writeText(address);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="max-w-2xl mx-auto">
      <div className="card">
        {/* Header */}
        <div className="flex items-center gap-4 mb-8">
          <div className="icon-container-lg icon-accent">
            <ArrowDownLeft className="w-6 h-6 text-white" />
          </div>
          <div>
            <h2 className="text-2xl font-bold text-white tracking-tight">Receive Mynta</h2>
            <p className="text-surface-400">Share this address to receive MYNTA</p>
          </div>
        </div>

        {/* QR Code & Address Display */}
        <div className="text-center mb-8">
          {/* QR Code Container */}
          <div className="inline-flex items-center justify-center mb-8 mx-auto">
            {loading ? (
              <div className="w-56 h-56 glass-medium rounded-2xl flex items-center justify-center">
                <div className="w-40 h-40 glass-subtle rounded-xl animate-pulse" />
              </div>
            ) : (
              <div className="p-4 bg-white rounded-2xl shadow-glow">
                <QRCode
                  value={address}
                  size={192}
                  showLogo={true}
                  logoText="M"
                  downloadable={true}
                />
              </div>
            )}
          </div>

          {/* Address Display */}
          <div className="space-y-4">
            <div className="relative">
              <div className="p-5 glass-subtle rounded-xl">
                {loading ? (
                  <div className="h-6 glass-subtle rounded animate-pulse" />
                ) : (
                  <code className="text-base font-mono text-white break-all leading-relaxed">
                    {address}
                  </code>
                )}
              </div>
            </div>

            {/* Copy Button */}
            <button
              onClick={copyAddress}
              disabled={loading || !address}
              className={`w-full py-4 text-base flex items-center justify-center gap-3 ${
                copied ? "btn-accent" : "btn-primary"
              }`}
            >
              {copied ? (
                <>
                  <Check className="w-5 h-5" />
                  Copied to Clipboard!
                </>
              ) : (
                <>
                  <Copy className="w-5 h-5" />
                  Copy Address
                </>
              )}
            </button>
          </div>
        </div>

        {/* Generate New Address */}
        <div className="section-divider" />
        
        <div className="pt-4">
          <h3 className="text-lg font-semibold text-white mb-4">
            Generate New Address
          </h3>

          <div className="flex gap-3">
            <input
              type="text"
              value={label}
              onChange={(e) => setLabel(e.target.value)}
              className="input flex-1"
              placeholder="Label (optional)"
            />
            <button
              onClick={generateNewAddress}
              disabled={generating}
              className="btn-secondary flex items-center gap-2.5 px-6"
            >
              {generating ? (
                <RefreshCw className="w-5 h-5 animate-spin" />
              ) : (
                <Plus className="w-5 h-5" />
              )}
              <span className="font-semibold">Generate</span>
            </button>
          </div>
        </div>

        {/* Info Box */}
        <div className="mt-8 p-5 glass-subtle border-primary-500/20 rounded-xl">
          <div className="flex items-start gap-4">
            <div className="icon-container icon-primary flex-shrink-0">
              <Lightbulb className="w-5 h-5 text-white" />
            </div>
            <div>
              <h4 className="text-white font-semibold mb-1.5">Pro Tip</h4>
              <p className="text-surface-300 text-sm leading-relaxed">
                For privacy, generate a new address for each transaction. All addresses
                remain valid and funds sent to any of them will appear in your wallet.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
