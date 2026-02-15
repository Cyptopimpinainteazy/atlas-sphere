import { useState, useEffect } from "react";
import {
  Shield,
  Eye,
  EyeOff,
  AlertTriangle,
  Copy,
  Check,
  RefreshCw,
} from "lucide-react";

interface SeedPhraseDisplayProps {
  words: string[];
  onContinue: () => void;
  onRegenerate?: () => void;
  showWarning?: boolean;
}

/**
 * SeedPhraseDisplay - Displays the generated seed phrase with security features
 * 
 * Features:
 * - Words hidden by default, revealed on click
 * - Strong security warnings
 * - Copy functionality with auto-clear
 * - Word numbering for easy verification
 */
export function SeedPhraseDisplay({
  words,
  onContinue,
  onRegenerate,
  showWarning = true,
}: SeedPhraseDisplayProps) {
  const [revealed, setRevealed] = useState(false);
  const [copied, setCopied] = useState(false);
  const [acknowledged, setAcknowledged] = useState(false);

  // Reset acknowledgment when words change
  useEffect(() => {
    setAcknowledged(false);
    setRevealed(false);
  }, [words]);

  const handleCopy = async () => {
    const phrase = words.join(" ");
    await navigator.clipboard.writeText(phrase);
    setCopied(true);

    // Clear clipboard after 60 seconds for security
    setTimeout(() => {
      navigator.clipboard.writeText("").catch(() => {});
    }, 60000);

    setTimeout(() => setCopied(false), 3000);
  };

  const canContinue = acknowledged && revealed;

  return (
    <div className="space-y-6">
      {/* Security Warning - Soft gradient style */}
      {showWarning && (
        <div className="alert-soft">
          <div className="flex gap-4">
            <div className="alert-soft-icon">
              <AlertTriangle className="w-5 h-5 text-amber-400" />
            </div>
            <div className="flex-1">
              <h4 className="text-amber-300 font-semibold mb-2">
                Important Security Information
              </h4>
              <ul className="text-sm text-amber-200/70 space-y-1.5">
                <li className="flex items-start gap-2">
                  <span className="text-amber-400 mt-0.5">•</span>
                  Write down these words on paper - never store digitally
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-amber-400 mt-0.5">•</span>
                  Anyone with these words can access your funds
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-amber-400 mt-0.5">•</span>
                  Mynta will NEVER ask for your seed phrase
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-amber-400 mt-0.5">•</span>
                  Store in a secure location (safe, safety deposit box)
                </li>
              </ul>
            </div>
          </div>
        </div>
      )}

      {/* Seed Phrase Display */}
      <div className="relative">
        {/* Blur overlay when hidden */}
        {!revealed && (
          <div
            className="absolute inset-0 z-10 flex items-center justify-center bg-surface-900/90 backdrop-blur-lg rounded-2xl cursor-pointer transition-all hover:bg-surface-900/85"
            onClick={() => setRevealed(true)}
          >
            <div className="text-center p-8">
              <div className="w-16 h-16 rounded-2xl bg-primary-500/20 flex items-center justify-center mx-auto mb-4">
                <Eye className="w-8 h-8 text-primary-400" />
              </div>
              <p className="text-white font-semibold text-lg">Click to reveal seed phrase</p>
              <p className="text-surface-400 text-sm mt-2">
                Make sure no one is watching your screen
              </p>
            </div>
          </div>
        )}

        {/* Word Grid - Polished pills */}
        <div className="p-6 bg-gradient-to-b from-surface-800/80 to-surface-800/40 rounded-2xl">
          <div className="grid grid-cols-3 md:grid-cols-4 gap-2.5">
            {words.map((word, index) => (
              <div
                key={index}
                className="word-pill"
              >
                <span className="word-number">
                  {index + 1}.
                </span>
                <span
                  className={`word-text ${
                    revealed ? "" : "text-transparent select-none"
                  }`}
                >
                  {word}
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Actions - Unified button bar */}
      <div className="button-bar mx-auto">
        {revealed && (
          <>
            <button
              onClick={() => setRevealed(false)}
              className="button-bar-item"
            >
              <EyeOff className="w-4 h-4" />
              Hide
            </button>

            <button
              onClick={handleCopy}
              className={`button-bar-item ${copied ? "text-accent-400" : ""}`}
            >
              {copied ? (
                <>
                  <Check className="w-4 h-4" />
                  Copied!
                </>
              ) : (
                <>
                  <Copy className="w-4 h-4" />
                  Copy
                </>
              )}
            </button>
          </>
        )}

        {onRegenerate && (
          <button
            onClick={onRegenerate}
            className="button-bar-item"
          >
            <RefreshCw className="w-4 h-4" />
            Generate New
          </button>
        )}
      </div>

      {/* Acknowledgment Checkbox - Integrated design */}
      <label className="flex items-start gap-4 cursor-pointer p-5 bg-gradient-to-r from-surface-800/60 to-surface-800/30 rounded-xl hover:from-surface-700/60 hover:to-surface-700/30 transition-all group">
        <div className="relative mt-0.5">
          <input
            type="checkbox"
            checked={acknowledged}
            onChange={(e) => setAcknowledged(e.target.checked)}
            className="w-5 h-5 rounded-md border-surface-600 bg-surface-800 text-primary-500 focus:ring-primary-500/50 focus:ring-offset-0 transition-all"
          />
        </div>
        <div>
          <p className="text-white font-medium group-hover:text-white/90 transition-colors">
            I have written down my seed phrase
          </p>
          <p className="text-sm text-surface-400 mt-1 leading-relaxed">
            I understand that if I lose these words, I will lose access to my funds forever.
            I have stored them securely offline.
          </p>
        </div>
      </label>

      {/* Continue Button */}
      <button
        onClick={onContinue}
        disabled={!canContinue}
        className="btn-primary w-full py-4 text-lg flex items-center justify-center gap-2"
      >
        <Shield className="w-5 h-5" />
        Continue to Verification
      </button>

      {!canContinue && (
        <p className="text-center text-surface-500 text-sm">
          Please reveal your seed phrase and confirm you've written it down
        </p>
      )}
    </div>
  );
}

export default SeedPhraseDisplay;

