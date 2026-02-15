import { useState, useRef, useEffect } from "react";
import {
  Upload,
  CheckCircle,
  XCircle,
  AlertCircle,
  Loader2,
  ArrowRight,
} from "lucide-react";
import * as api from "../lib/api";

interface SeedPhraseRestoreProps {
  onSuccess: (mnemonic: string, passphrase?: string) => void;
  onBack: () => void;
}

/**
 * SeedPhraseRestore - Restore wallet from existing seed phrase
 * 
 * Features:
 * - 12 or 24 word input with individual word fields
 * - Autocomplete suggestions from BIP39 wordlist
 * - Real-time validation
 * - Optional passphrase (25th word) support
 */
export function SeedPhraseRestore({
  onSuccess,
  onBack,
}: SeedPhraseRestoreProps) {
  const [wordCount, setWordCount] = useState<12 | 24>(12);
  const [words, setWords] = useState<string[]>(Array(12).fill(""));
  const [passphrase, setPassphrase] = useState("");
  const [showPassphrase, setShowPassphrase] = useState(false);
  const [validating, setValidating] = useState(false);
  const [validation, setValidation] = useState<api.ValidationResult | null>(null);
  const [focusedIndex, setFocusedIndex] = useState<number | null>(null);
  const [suggestions, setSuggestions] = useState<string[]>([]);
  
  const inputRefs = useRef<(HTMLInputElement | null)[]>([]);

  // Update words array when word count changes
  useEffect(() => {
    setWords((prev) => {
      if (wordCount > prev.length) {
        return [...prev, ...Array(wordCount - prev.length).fill("")];
      }
      return prev.slice(0, wordCount);
    });
    setValidation(null);
  }, [wordCount]);

  const handleWordChange = async (index: number, value: string) => {
    const newWords = [...words];
    newWords[index] = value.toLowerCase().trim();
    setWords(newWords);
    setValidation(null);

    // Get suggestions for autocomplete
    if (value.length >= 2) {
      try {
        const sug = await api.getWordSuggestions(value, 5);
        setSuggestions(sug);
      } catch {
        setSuggestions([]);
      }
    } else {
      setSuggestions([]);
    }
  };

  const handleSelectSuggestion = (word: string) => {
    if (focusedIndex === null) return;
    
    const newWords = [...words];
    newWords[focusedIndex] = word;
    setWords(newWords);
    setSuggestions([]);

    // Move to next input
    if (focusedIndex < wordCount - 1) {
      inputRefs.current[focusedIndex + 1]?.focus();
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent, index: number) => {
    if (e.key === "Tab" && suggestions.length > 0) {
      e.preventDefault();
      handleSelectSuggestion(suggestions[0]);
    } else if (e.key === "Enter") {
      if (suggestions.length > 0) {
        e.preventDefault();
        handleSelectSuggestion(suggestions[0]);
      }
    } else if (e.key === " " || e.key === "Spacebar") {
      // Space moves to next word
      e.preventDefault();
      if (index < wordCount - 1) {
        inputRefs.current[index + 1]?.focus();
      }
    } else if (e.key === "Backspace" && words[index] === "" && index > 0) {
      // Backspace on empty field goes to previous
      inputRefs.current[index - 1]?.focus();
    }
  };

  const handlePaste = (e: React.ClipboardEvent) => {
    const pasted = e.clipboardData.getData("text");
    const pastedWords = pasted.trim().toLowerCase().split(/\s+/);

    if (pastedWords.length >= 12) {
      e.preventDefault();
      
      // Detect word count from pasted content
      const targetCount = pastedWords.length >= 24 ? 24 : 12;
      setWordCount(targetCount);
      
      const newWords = Array(targetCount).fill("");
      pastedWords.slice(0, targetCount).forEach((word, idx) => {
        newWords[idx] = word;
      });
      setWords(newWords);
    }
  };

  const handleValidate = async () => {
    setValidating(true);
    try {
      const phrase = words.join(" ");
      const result = await api.validateSeedPhrase(phrase);
      setValidation(result);
    } catch (error) {
      setValidation({
        valid: false,
        error: "Failed to validate seed phrase",
        invalid_words: [],
      });
    } finally {
      setValidating(false);
    }
  };

  const handleRestore = () => {
    if (!validation?.valid) return;
    const phrase = words.join(" ");
    onSuccess(phrase, passphrase || undefined);
  };

  const filledWords = words.filter((w) => w.length > 0).length;
  const canValidate = filledWords === wordCount;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="text-center">
        <div className="w-20 h-20 rounded-3xl bg-gradient-to-br from-primary-500/30 to-primary-600/20 flex items-center justify-center mx-auto mb-5">
          <Upload className="w-10 h-10 text-primary-400" />
        </div>
        <h3 className="text-2xl font-bold text-white mb-3">
          Restore from Seed Phrase
        </h3>
        <p className="text-surface-400 leading-relaxed">
          Enter your backup seed phrase to restore your wallet
        </p>
      </div>

      {/* Word Count Selector - Button bar */}
      <div className="button-bar mx-auto">
        <button
          onClick={() => setWordCount(12)}
          className={`button-bar-item ${wordCount === 12 ? "active" : ""}`}
        >
          12 Words
        </button>
        <button
          onClick={() => setWordCount(24)}
          className={`button-bar-item ${wordCount === 24 ? "active" : ""}`}
        >
          24 Words
        </button>
      </div>

      {/* Word Input Grid - Polished */}
      <div className="relative p-6 bg-gradient-to-b from-surface-800/60 to-surface-800/30 rounded-2xl">
        <div
          className="grid grid-cols-3 md:grid-cols-4 gap-2.5"
          onPaste={handlePaste}
        >
          {words.map((word, index) => {
            const isInvalid = validation?.invalid_words.some(
              (iw) => iw.index === index + 1
            );
            
            return (
              <div key={index} className="relative">
                <div className="word-pill">
                  <span className="word-number">
                    {index + 1}.
                  </span>
                  <input
                    ref={(el) => { inputRefs.current[index] = el; }}
                    type="text"
                    value={word}
                    onChange={(e) => handleWordChange(index, e.target.value)}
                    onKeyDown={(e) => handleKeyDown(e, index)}
                    onFocus={() => setFocusedIndex(index)}
                    onBlur={() => setTimeout(() => {
                      if (focusedIndex === index) {
                        setFocusedIndex(null);
                        setSuggestions([]);
                      }
                    }, 200)}
                    className={`bg-transparent border-none outline-none text-sm font-mono flex-1 text-white/90 placeholder-surface-500 ${
                      isInvalid ? "text-red-400" : word && !isInvalid ? "text-accent-300" : ""
                    }`}
                    placeholder={`Word ${index + 1}`}
                    autoComplete="off"
                    autoCapitalize="off"
                    spellCheck={false}
                  />
                </div>

                {/* Suggestions dropdown for focused input */}
                {focusedIndex === index && suggestions.length > 0 && (
                  <div className="absolute z-20 w-full mt-1 bg-surface-800/95 backdrop-blur-sm rounded-xl shadow-2xl overflow-hidden">
                    {suggestions.map((sug, idx) => (
                      <button
                        key={idx}
                        onMouseDown={(e) => {
                          e.preventDefault();
                          handleSelectSuggestion(sug);
                        }}
                        className="w-full px-4 py-2.5 text-left text-sm font-mono text-white hover:bg-surface-700/70 transition-colors"
                      >
                        {sug}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </div>
        
        {/* Paste Hint - Inline */}
        <p className="text-center text-surface-500 text-sm mt-4">
          Tip: You can paste your entire seed phrase at once
        </p>
      </div>

      {/* Optional Passphrase */}
      <div className="p-5 bg-gradient-to-r from-surface-800/50 to-surface-800/20 rounded-xl">
        <button
          onClick={() => setShowPassphrase(!showPassphrase)}
          className="text-sm text-primary-400 hover:text-primary-300 transition-colors font-medium"
        >
          {showPassphrase ? "− Hide" : "+ Add"} optional passphrase (advanced)
        </button>

        {showPassphrase && (
          <div className="mt-4">
            <label className="label">
              Passphrase (BIP39 "25th word")
            </label>
            <input
              type="password"
              value={passphrase}
              onChange={(e) => setPassphrase(e.target.value)}
              className="input"
              placeholder="Optional passphrase"
            />
            <p className="text-xs text-surface-500 mt-2">
              Only enter this if you created your wallet with a passphrase
            </p>
          </div>
        )}
      </div>

      {/* Validation Result - Polished */}
      {validation && (
        <div
          className={`p-5 rounded-2xl ${
            validation.valid
              ? "bg-gradient-to-br from-accent-500/15 via-accent-500/10 to-transparent"
              : "bg-gradient-to-br from-red-500/15 via-red-500/10 to-transparent"
          }`}
        >
          <div className="flex items-start gap-4">
            <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${
              validation.valid ? "bg-accent-500/20" : "bg-red-500/20"
            }`}>
              {validation.valid ? (
                <CheckCircle className="w-5 h-5 text-accent-400" />
              ) : (
                <XCircle className="w-5 h-5 text-red-400" />
              )}
            </div>
            <div>
              <p
                className={`font-semibold ${
                  validation.valid ? "text-accent-300" : "text-red-300"
                }`}
              >
                {validation.valid
                  ? "Valid seed phrase!"
                  : validation.error || "Invalid seed phrase"}
              </p>

              {validation.invalid_words.length > 0 && (
                <ul className="mt-3 space-y-1.5 text-sm text-red-300/80">
                  {validation.invalid_words.map((iw) => (
                    <li key={iw.index}>
                      Word #{iw.index} "{iw.word}" is not valid
                      {iw.suggestions.length > 0 && (
                        <span className="text-surface-400">
                          {" "}— Did you mean: {iw.suggestions.slice(0, 3).join(", ")}?
                        </span>
                      )}
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Security Notice - Soft alert */}
      <div className="alert-soft">
        <div className="flex items-start gap-4">
          <div className="alert-soft-icon">
            <AlertCircle className="w-5 h-5 text-amber-400" />
          </div>
          <p className="text-sm text-amber-200/70 leading-relaxed pt-1">
            Only enter your seed phrase in this official Mynta Wallet application.
            Never share it with anyone or enter it on websites.
          </p>
        </div>
      </div>

      {/* Actions */}
      <div className="flex gap-4">
        <button onClick={onBack} className="btn-secondary flex-1 py-3">
          Back
        </button>
        
        {!validation?.valid ? (
          <button
            onClick={handleValidate}
            disabled={!canValidate || validating}
            className="btn-primary flex-1 py-3 flex items-center justify-center gap-2"
          >
            {validating ? (
              <>
                <Loader2 className="w-5 h-5 animate-spin" />
                Validating...
              </>
            ) : (
              <>
                <CheckCircle className="w-5 h-5" />
                Validate ({filledWords}/{wordCount})
              </>
            )}
          </button>
        ) : (
          <button
            onClick={handleRestore}
            className="btn-accent flex-1 py-3 flex items-center justify-center gap-2"
          >
            <ArrowRight className="w-5 h-5" />
            Continue
          </button>
        )}
      </div>
    </div>
  );
}

export default SeedPhraseRestore;

