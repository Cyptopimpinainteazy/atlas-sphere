import { useState, useEffect, useRef } from "react";
import {
  CheckCircle,
  XCircle,
  AlertCircle,
  ArrowRight,
  RotateCcw,
} from "lucide-react";
import * as api from "../lib/api";

interface SeedPhraseVerifyProps {
  words: string[];
  onSuccess: () => void;
  onBack: () => void;
}

interface VerificationWord {
  index: number; // 1-indexed word position
  word: string; // The correct word
  userInput: string;
  status: "pending" | "correct" | "incorrect";
}

/**
 * SeedPhraseVerify - Verification quiz for seed phrase backup
 * 
 * Features:
 * - Randomly selects 3 words to verify
 * - Autocomplete suggestions from BIP39 wordlist
 * - Clear feedback on correct/incorrect answers
 * - Must get all 3 correct to continue
 */
export function SeedPhraseVerify({
  words,
  onSuccess,
  onBack,
}: SeedPhraseVerifyProps) {
  const [verificationWords, setVerificationWords] = useState<VerificationWord[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [attempts, setAttempts] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);

  // Initialize verification words on mount
  useEffect(() => {
    const initVerification = async () => {
      try {
        const indices = await api.getVerificationIndices(words.length);
        const verifyWords: VerificationWord[] = indices.map((idx) => ({
          index: idx,
          word: words[idx - 1], // Convert 1-indexed to 0-indexed
          userInput: "",
          status: "pending" as const,
        }));
        setVerificationWords(verifyWords);
      } catch (error) {
        console.error("Failed to get verification indices:", error);
        // Fallback to first 3 random positions
        const fallbackIndices = [3, 7, 11].slice(0, Math.min(3, words.length));
        const verifyWords: VerificationWord[] = fallbackIndices.map((idx) => ({
          index: idx,
          word: words[idx - 1],
          userInput: "",
          status: "pending" as const,
        }));
        setVerificationWords(verifyWords);
      }
    };

    initVerification();
  }, [words]);

  // Focus input when current word changes
  useEffect(() => {
    if (inputRef.current) {
      inputRef.current.focus();
    }
  }, [currentIndex]);

  const currentWord = verificationWords[currentIndex];
  const allCorrect = verificationWords.every((w) => w.status === "correct");
  const hasIncorrect = verificationWords.some((w) => w.status === "incorrect");

  const handleInputChange = async (value: string) => {
    const updated = [...verificationWords];
    updated[currentIndex] = {
      ...updated[currentIndex],
      userInput: value.toLowerCase().trim(),
      status: "pending",
    };
    setVerificationWords(updated);

    // Get suggestions
    if (value.length >= 2) {
      try {
        const sug = await api.getWordSuggestions(value, 5);
        setSuggestions(sug);
        setShowSuggestions(sug.length > 0);
      } catch {
        setSuggestions([]);
        setShowSuggestions(false);
      }
    } else {
      setSuggestions([]);
      setShowSuggestions(false);
    }
  };

  const handleSelectSuggestion = (word: string) => {
    const updated = [...verificationWords];
    updated[currentIndex] = {
      ...updated[currentIndex],
      userInput: word,
      status: "pending",
    };
    setVerificationWords(updated);
    setSuggestions([]);
    setShowSuggestions(false);
    if (inputRef.current) {
      inputRef.current.focus();
    }
  };

  const handleVerify = () => {
    const updated = [...verificationWords];
    const current = updated[currentIndex];
    
    if (current.userInput.toLowerCase() === current.word.toLowerCase()) {
      updated[currentIndex] = { ...current, status: "correct" };
      
      // Move to next word if available
      if (currentIndex < verificationWords.length - 1) {
        setCurrentIndex(currentIndex + 1);
      }
    } else {
      updated[currentIndex] = { ...current, status: "incorrect" };
      setAttempts(attempts + 1);
    }
    
    setVerificationWords(updated);
    setShowSuggestions(false);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") {
      if (showSuggestions && suggestions.length > 0) {
        handleSelectSuggestion(suggestions[0]);
      } else {
        handleVerify();
      }
    } else if (e.key === "Escape") {
      setShowSuggestions(false);
    }
  };

  const handleRetry = () => {
    const reset = verificationWords.map((w) => ({
      ...w,
      userInput: "",
      status: "pending" as const,
    }));
    setVerificationWords(reset);
    setCurrentIndex(0);
    setAttempts(0);
  };

  if (verificationWords.length === 0) {
    return (
      <div className="text-center py-12">
        <div className="w-12 h-12 rounded-full border-4 border-primary-500 border-t-transparent animate-spin mx-auto mb-4" />
        <p className="text-surface-400">Preparing verification...</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="text-center">
        <h3 className="text-2xl font-bold text-white mb-3">
          Verify Your Seed Phrase
        </h3>
        <p className="text-surface-400 leading-relaxed">
          Enter the words at the specified positions to confirm you've backed up your seed phrase correctly.
        </p>
      </div>

      {/* Progress Indicators - Polished pills */}
      <div className="flex justify-center gap-3">
        {verificationWords.map((word, idx) => (
          <div
            key={idx}
            className={`flex items-center gap-2.5 px-5 py-2.5 rounded-xl transition-all ${
              idx === currentIndex
                ? "bg-gradient-to-r from-primary-500/30 to-primary-600/20 shadow-lg"
                : word.status === "correct"
                ? "bg-gradient-to-r from-accent-500/30 to-accent-600/20"
                : word.status === "incorrect"
                ? "bg-gradient-to-r from-red-500/30 to-red-600/20"
                : "bg-surface-800/60"
            }`}
          >
            <span className="text-sm font-mono text-surface-300">#{word.index}</span>
            {word.status === "correct" && (
              <CheckCircle className="w-4 h-4 text-accent-400" />
            )}
            {word.status === "incorrect" && (
              <XCircle className="w-4 h-4 text-red-400" />
            )}
          </div>
        ))}
      </div>

      {/* Current Word Input - Polished card */}
      {!allCorrect && currentWord && (
        <div className="p-8 bg-gradient-to-b from-surface-800/80 to-surface-800/40 rounded-2xl">
          <label className="block text-center mb-6">
            <span className="text-surface-400">Enter word</span>
            <span className="text-3xl font-bold text-primary-400 mx-3">
              #{currentWord.index}
            </span>
            <span className="text-surface-400">from your seed phrase</span>
          </label>

          <div className="relative max-w-md mx-auto">
            <input
              ref={inputRef}
              type="text"
              value={currentWord.userInput}
              onChange={(e) => handleInputChange(e.target.value)}
              onKeyDown={handleKeyDown}
              onBlur={() => setTimeout(() => setShowSuggestions(false), 200)}
              onFocus={() => suggestions.length > 0 && setShowSuggestions(true)}
              className={`input text-center text-xl font-mono py-4 ${
                currentWord.status === "incorrect"
                  ? "ring-2 ring-red-500/50"
                  : ""
              }`}
              placeholder="Type the word..."
              autoComplete="off"
              autoCapitalize="off"
              spellCheck={false}
            />

            {/* Suggestions Dropdown - Enhanced */}
            {showSuggestions && suggestions.length > 0 && (
              <div className="absolute z-20 w-full mt-2 bg-surface-800/95 backdrop-blur-sm rounded-xl shadow-2xl overflow-hidden">
                {suggestions.map((sug, idx) => (
                  <button
                    key={idx}
                    onClick={() => handleSelectSuggestion(sug)}
                    className="w-full px-5 py-3 text-left font-mono text-white hover:bg-surface-700/70 transition-colors"
                  >
                    {sug}
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Error Message - Softer */}
          {currentWord.status === "incorrect" && (
            <div className="mt-5 p-4 bg-gradient-to-r from-red-500/15 to-red-500/5 rounded-xl text-center">
              <p className="text-red-400 flex items-center justify-center gap-2">
                <XCircle className="w-4 h-4" />
                Incorrect word. Please check your backup and try again.
              </p>
            </div>
          )}

          {/* Verify Button */}
          <button
            onClick={handleVerify}
            disabled={!currentWord.userInput}
            className="btn-primary w-full mt-6 py-4 text-lg"
          >
            Verify Word
          </button>
        </div>
      )}

      {/* Success State - Polished */}
      {allCorrect && (
        <div className="p-10 bg-gradient-to-br from-accent-500/15 via-accent-500/10 to-transparent rounded-2xl text-center">
          <div className="w-20 h-20 rounded-2xl bg-gradient-to-br from-accent-500/30 to-accent-600/20 flex items-center justify-center mx-auto mb-6">
            <CheckCircle className="w-10 h-10 text-accent-400" />
          </div>
          <h3 className="text-2xl font-bold text-white mb-3">
            Verification Successful!
          </h3>
          <p className="text-surface-400 mb-8 text-lg">
            Your seed phrase has been backed up correctly. Keep it safe!
          </p>
          <button
            onClick={onSuccess}
            className="btn-accent px-10 py-4 text-lg flex items-center gap-3 mx-auto"
          >
            Continue
            <ArrowRight className="w-5 h-5" />
          </button>
        </div>
      )}

      {/* Too Many Attempts Warning - Soft alert */}
      {attempts >= 3 && !allCorrect && (
        <div className="alert-soft">
          <div className="flex items-start gap-4">
            <div className="alert-soft-icon">
              <AlertCircle className="w-5 h-5 text-amber-400" />
            </div>
            <div>
              <p className="text-amber-300 font-medium">
                Having trouble?
              </p>
              <p className="text-sm text-amber-200/70 mt-1 leading-relaxed">
                Make sure you wrote down the words in the correct order. 
                You can go back to view your seed phrase again.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Action Buttons */}
      <div className="flex gap-4">
        <button onClick={onBack} className="btn-secondary flex-1 py-3">
          Back to Seed Phrase
        </button>
        {hasIncorrect && (
          <button
            onClick={handleRetry}
            className="btn-secondary flex-1 py-3 flex items-center justify-center gap-2"
          >
            <RotateCcw className="w-4 h-4" />
            Start Over
          </button>
        )}
      </div>
    </div>
  );
}

export default SeedPhraseVerify;

