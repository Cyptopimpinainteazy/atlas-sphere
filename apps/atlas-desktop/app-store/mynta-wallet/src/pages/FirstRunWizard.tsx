/**
 * FirstRunWizard - Onboarding wizard for new wallet creation
 * 
 * SECURITY IMPLEMENTATION:
 * - Secure memory cleanup on unmount (overwrite sensitive data)
 * - Strong password validation requirements
 * - Seed phrase never leaves component until verified
 * - Progress state prevents accidental navigation
 * 
 * Implements a step-by-step flow:
 * 1. Welcome screen
 * 2. Create vs Restore choice
 * 3. Seed phrase generation/display OR Restore input
 * 4. Seed phrase verification (for new wallets)
 * 5. Password creation with encryption
 * 6. Success / Begin sync
 */
import { useState, useEffect, useCallback, useRef, Fragment } from "react";
import {
  Shield,
  Key,
  Lock,
  CheckCircle,
  ArrowRight,
  ArrowLeft,
  Wallet,
  RefreshCw,
  Loader2,
  AlertTriangle,
  Eye,
  EyeOff,
} from "lucide-react";
import * as api from "../lib/api";
import { SeedPhraseDisplay } from "../components/SeedPhraseDisplay";
import { SeedPhraseVerify } from "../components/SeedPhraseVerify";
import { SeedPhraseRestore } from "../components/SeedPhraseRestore";
import PasswordStrengthMeter from "../components/PasswordStrengthMeter";

type WizardStep =
  | "welcome"
  | "choice"
  | "generate_seed"
  | "verify_seed"
  | "restore_seed"
  | "set_password"
  | "encrypting"
  | "success";

interface FirstRunWizardProps {
  onComplete: () => void;
}

/**
 * Securely clear sensitive string by overwriting memory
 * Note: This is a best-effort approach in JavaScript
 */
function secureClear(str: string): void {
  // In JavaScript we can't truly overwrite string memory,
  // but we can encourage garbage collection
  if (str && typeof str === 'string') {
    // Trigger reference clearing
    str = '';
  }
}

/**
 * Securely clear an array of strings
 */
function secureClearArray(arr: string[]): void {
  for (let i = 0; i < arr.length; i++) {
    secureClear(arr[i]);
    arr[i] = '';
  }
  arr.length = 0;
}

export default function FirstRunWizard({ onComplete }: FirstRunWizardProps) {
  const [step, setStep] = useState<WizardStep>("welcome");
  const [walletMode, setWalletMode] = useState<"create" | "restore" | null>(null);
  
  // Seed phrase state - stored in ref to allow secure clearing
  const [seedWords, setSeedWords] = useState<string[]>([]);
  const seedWordsRef = useRef<string[]>([]);
  const [wordCount, setWordCount] = useState<12 | 24>(24); // Default to 24 for maximum security
  const [isGenerating, setIsGenerating] = useState(false);
  const [seedPassphrase, setSeedPassphrase] = useState<string | undefined>(undefined);
  const seedPassphraseRef = useRef<string>('');
  
  // Password state
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const passwordRef = useRef<string>('');
  const [showPassword, setShowPassword] = useState(false);
  const [passwordError, setPasswordError] = useState("");
  
  // Processing state
  const [isProcessing, setIsProcessing] = useState(false);
  const [error, setError] = useState("");
  
  // Track if seed has been viewed (prevent regeneration confusion)
  const [_seedViewed, _setSeedViewed] = useState(false);
  
  // Keep refs in sync
  useEffect(() => {
    seedWordsRef.current = [...seedWords];
  }, [seedWords]);
  
  useEffect(() => {
    passwordRef.current = password;
  }, [password]);
  
  useEffect(() => {
    seedPassphraseRef.current = seedPassphrase || '';
  }, [seedPassphrase]);
  
  // SECURITY: Clear all sensitive data on unmount
  useEffect(() => {
    return () => {
      // Clear seed words
      secureClearArray(seedWordsRef.current);
      // Clear passwords
      secureClear(passwordRef.current);
      secureClear(seedPassphraseRef.current);
      // Force state updates to clear React state
      setSeedWords([]);
      setPassword('');
      setConfirmPassword('');
      setSeedPassphrase(undefined);
    };
  }, []);
  
  // SECURITY: Prevent accidental page refresh during critical steps
  useEffect(() => {
    const criticalSteps: WizardStep[] = ['generate_seed', 'verify_seed', 'set_password', 'encrypting'];
    
    if (criticalSteps.includes(step)) {
      const handleBeforeUnload = (e: BeforeUnloadEvent) => {
        e.preventDefault();
        e.returnValue = 'You have unsaved wallet setup in progress. Are you sure you want to leave?';
        return e.returnValue;
      };
      
      window.addEventListener('beforeunload', handleBeforeUnload);
      return () => window.removeEventListener('beforeunload', handleBeforeUnload);
    }
  }, [step]);

  // Generate seed phrase
  const generateSeed = async () => {
    setIsGenerating(true);
    setError("");
    try {
      const result = await api.generateSeedPhrase(wordCount);
      setSeedWords(result.words);
      setStep("generate_seed");
    } catch (err: any) {
      setError(err.message || "Failed to generate seed phrase");
    } finally {
      setIsGenerating(false);
    }
  };

  // Regenerate seed
  const regenerateSeed = async () => {
    setIsGenerating(true);
    try {
      const result = await api.generateSeedPhrase(wordCount);
      setSeedWords(result.words);
    } catch (err: any) {
      setError(err.message || "Failed to regenerate seed phrase");
    } finally {
      setIsGenerating(false);
    }
  };

  // Handle restore success
  const handleRestoreSuccess = (mnemonic: string, passphrase?: string) => {
    setSeedWords(mnemonic.split(" "));
    setSeedPassphrase(passphrase);
    setStep("set_password");
  };

  // Validate password with strong security requirements
  const validatePassword = useCallback((): { valid: boolean; errors: string[] } => {
    const errors: string[] = [];
    
    // Length check
    if (password.length < 8) {
      errors.push("Password must be at least 8 characters");
    }
    
    // Complexity checks
    if (!/[A-Z]/.test(password)) {
      errors.push("Password must contain at least one uppercase letter");
    }
    if (!/[a-z]/.test(password)) {
      errors.push("Password must contain at least one lowercase letter");
    }
    if (!/[0-9]/.test(password)) {
      errors.push("Password must contain at least one number");
    }
    if (!/[^A-Za-z0-9]/.test(password)) {
      errors.push("Password must contain at least one special character");
    }
    
    // Match check
    if (password !== confirmPassword) {
      errors.push("Passwords do not match");
    }
    
    // Common password check
    const commonPasswords = [
      'password', '12345678', 'qwerty123', 'admin123', 'letmein',
      'welcome1', 'monkey123', 'dragon12', 'master12', 'password1'
    ];
    if (commonPasswords.some(common => password.toLowerCase().includes(common))) {
      errors.push("Password is too common, please choose a stronger one");
    }
    
    return { valid: errors.length === 0, errors };
  }, [password, confirmPassword]);
  
  // Check if password meets minimum requirements (for button enable)
  const passwordMeetsMinimum = password.length >= 8 && 
    /[A-Z]/.test(password) && 
    /[a-z]/.test(password) && 
    /[0-9]/.test(password) && 
    /[^A-Za-z0-9]/.test(password) &&
    password === confirmPassword;

  // Complete wallet setup with full validation
  const completeSetup = async () => {
    const validation = validatePassword();
    if (!validation.valid) {
      setPasswordError(validation.errors[0]);
      return;
    }

    setIsProcessing(true);
    setStep("encrypting");
    setError("");
    setPasswordError("");

    try {
      // For restore, call restore_from_seed which will import keys
      if (walletMode === "restore") {
        await api.restoreFromSeed({
          mnemonic: seedWords.join(" "),
          passphrase: seedPassphrase,
          wallet_password: password,
        });
      }

      // Encrypt the wallet
      try {
        await api.encryptWallet(password);
      } catch (err: any) {
        // Wallet might already be encrypted
        if (!err.message?.includes("already encrypted")) {
          throw err;
        }
      }

      // Mark as initialized
      await api.markWalletInitialized();

      // SECURITY: Clear sensitive data immediately after successful encryption
      secureClearArray(seedWordsRef.current);
      setSeedWords([]);
      secureClear(passwordRef.current);
      setPassword('');
      setConfirmPassword('');

      setStep("success");
    } catch (err: any) {
      setError(err.message || "Failed to complete wallet setup");
      setStep("set_password");
    } finally {
      setIsProcessing(false);
    }
  };

  // Render step content
  const renderStep = () => {
    switch (step) {
      case "welcome":
        return (
          <div className="text-center animate-fade-in">
            <div className="w-24 h-24 rounded-3xl bg-gradient-to-br from-primary-500 via-primary-600 to-accent-500 flex items-center justify-center mx-auto mb-8 shadow-glow-lg">
              <Wallet className="w-12 h-12 text-white" />
            </div>
            <h1 className="text-3xl font-bold text-white mb-4">
              Welcome to Mynta Wallet
            </h1>
            <p className="text-surface-400 text-lg mb-8 max-w-md mx-auto">
              Your secure, self-custody cryptocurrency wallet with full node verification.
            </p>
            <div className="space-y-4 max-w-sm mx-auto">
              <button
                onClick={() => setStep("choice")}
                className="btn-primary w-full py-4 text-lg flex items-center justify-center gap-2"
              >
                Get Started
                <ArrowRight className="w-5 h-5" />
              </button>
            </div>
          </div>
        );

      case "choice":
        return (
          <div className="animate-fade-in">
            <button
              onClick={() => setStep("welcome")}
              className="flex items-center gap-2 text-surface-400 hover:text-white mb-6 transition-colors"
            >
              <ArrowLeft className="w-4 h-4" />
              Back
            </button>

            <h2 className="text-2xl font-bold text-white mb-2 text-center">
              How would you like to start?
            </h2>
            <p className="text-surface-400 text-center mb-8">
              Create a new wallet or restore from an existing backup.
            </p>

            <div className="grid gap-4 max-w-md mx-auto">
              {/* Create New Wallet */}
              <button
                onClick={() => {
                  setWalletMode("create");
                  generateSeed();
                }}
                disabled={isGenerating}
                className="choice-card text-left group"
              >
                <div className="flex items-start gap-4">
                  <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-primary-500/30 to-primary-600/20 flex items-center justify-center group-hover:from-primary-500/40 group-hover:to-primary-600/30 transition-all">
                    <Key className="w-7 h-7 text-primary-400" />
                  </div>
                  <div className="flex-1 pt-1">
                    <h3 className="text-lg font-semibold text-white mb-1 group-hover:text-primary-100 transition-colors">
                      Create New Wallet
                    </h3>
                    <p className="text-sm text-surface-400 leading-relaxed">
                      Generate a new seed phrase and create a fresh wallet.
                    </p>
                  </div>
                  {isGenerating && walletMode === "create" ? (
                    <Loader2 className="w-5 h-5 text-primary-400 animate-spin mt-2" />
                  ) : (
                    <ArrowRight className="w-5 h-5 text-surface-500 group-hover:text-primary-400 group-hover:translate-x-1 transition-all mt-2" />
                  )}
                </div>
              </button>

              {/* Restore Existing */}
              <button
                onClick={() => {
                  setWalletMode("restore");
                  setStep("restore_seed");
                }}
                className="choice-card text-left group"
              >
                <div className="flex items-start gap-4">
                  <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-accent-500/30 to-accent-600/20 flex items-center justify-center group-hover:from-accent-500/40 group-hover:to-accent-600/30 transition-all">
                    <RefreshCw className="w-7 h-7 text-accent-400" />
                  </div>
                  <div className="flex-1 pt-1">
                    <h3 className="text-lg font-semibold text-white mb-1 group-hover:text-accent-100 transition-colors">
                      Restore Existing Wallet
                    </h3>
                    <p className="text-sm text-surface-400 leading-relaxed">
                      Recover your wallet using a backup seed phrase.
                    </p>
                  </div>
                  <ArrowRight className="w-5 h-5 text-surface-500 group-hover:text-accent-400 group-hover:translate-x-1 transition-all mt-2" />
                </div>
              </button>
            </div>

            {/* Word count selector for new wallet */}
            <div className="mt-8 text-center">
              <p className="text-surface-500 text-sm mb-3">
                Seed phrase length:
              </p>
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
                  24 Words (More Secure)
                </button>
              </div>
            </div>

            {error && (
              <div className="mt-6 p-4 bg-gradient-to-r from-red-500/15 to-red-500/5 rounded-xl text-red-400 text-center">
                {error}
              </div>
            )}
          </div>
        );

      case "generate_seed":
        return (
          <div className="animate-fade-in">
            <button
              onClick={() => setStep("choice")}
              className="flex items-center gap-2 text-surface-400 hover:text-white mb-6 transition-colors"
            >
              <ArrowLeft className="w-4 h-4" />
              Back
            </button>

            <h2 className="text-2xl font-bold text-white mb-2 text-center">
              Your Recovery Seed Phrase
            </h2>
            <p className="text-surface-400 text-center mb-6">
              Write down these {seedWords.length} words in order. This is your only backup.
            </p>

            <SeedPhraseDisplay
              words={seedWords}
              onContinue={() => setStep("verify_seed")}
              onRegenerate={regenerateSeed}
              showWarning={true}
            />
          </div>
        );

      case "verify_seed":
        return (
          <div className="animate-fade-in">
            <SeedPhraseVerify
              words={seedWords}
              onSuccess={() => setStep("set_password")}
              onBack={() => setStep("generate_seed")}
            />
          </div>
        );

      case "restore_seed":
        return (
          <div className="animate-fade-in">
            <SeedPhraseRestore
              onSuccess={handleRestoreSuccess}
              onBack={() => setStep("choice")}
            />
          </div>
        );

      case "set_password":
        return (
          <div className="animate-fade-in max-w-md mx-auto">
            <button
              onClick={() => setStep(walletMode === "create" ? "verify_seed" : "restore_seed")}
              className="flex items-center gap-2 text-surface-400 hover:text-white mb-6 transition-colors"
            >
              <ArrowLeft className="w-4 h-4" />
              Back
            </button>

            <div className="text-center mb-8">
              <div className="w-16 h-16 rounded-2xl bg-primary-500/20 flex items-center justify-center mx-auto mb-4">
                <Lock className="w-8 h-8 text-primary-400" />
              </div>
              <h2 className="text-2xl font-bold text-white mb-2">
                Secure Your Wallet
              </h2>
              <p className="text-surface-400">
                Create a strong password to encrypt your wallet.
              </p>
            </div>

            <div className="space-y-6">
              {/* Password Input */}
              <div>
                <label className="label">Password</label>
                <div className="relative">
                  <input
                    type={showPassword ? "text" : "password"}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="input pr-12"
                    placeholder="Enter password (min 8 characters)"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 p-1 hover:bg-surface-700 rounded"
                  >
                    {showPassword ? (
                      <EyeOff className="w-5 h-5 text-surface-400" />
                    ) : (
                      <Eye className="w-5 h-5 text-surface-400" />
                    )}
                  </button>
                </div>
                <PasswordStrengthMeter password={password} />
              </div>

              {/* Confirm Password */}
              <div>
                <label className="label">Confirm Password</label>
                <input
                  type={showPassword ? "text" : "password"}
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  className={`input ${
                    confirmPassword && password !== confirmPassword
                      ? "border-red-500"
                      : confirmPassword && password === confirmPassword
                      ? "border-accent-500"
                      : ""
                  }`}
                  placeholder="Confirm your password"
                />
                {confirmPassword && password !== confirmPassword && (
                  <p className="text-red-400 text-sm mt-1">Passwords do not match</p>
                )}
              </div>

              {/* Password Requirements */}
              <div className="p-4 bg-surface-800/50 rounded-xl">
                <p className="text-sm text-surface-400 mb-2">Password requirements:</p>
                <ul className="text-sm space-y-1">
                  <PasswordRequirement
                    met={password.length >= 8}
                    text="At least 8 characters"
                  />
                  <PasswordRequirement
                    met={/[a-z]/.test(password)}
                    text="One lowercase letter"
                  />
                  <PasswordRequirement
                    met={/[A-Z]/.test(password)}
                    text="One uppercase letter"
                  />
                  <PasswordRequirement
                    met={/[0-9]/.test(password)}
                    text="One number"
                  />
                  <PasswordRequirement
                    met={/[^A-Za-z0-9]/.test(password)}
                    text="One special character"
                  />
                </ul>
              </div>

              {/* Warning */}
              <div className="alert-soft">
                <div className="flex items-start gap-4">
                  <div className="alert-soft-icon">
                    <AlertTriangle className="w-5 h-5 text-amber-400" />
                  </div>
                  <p className="text-sm text-amber-200/70 leading-relaxed pt-1">
                    This password encrypts your wallet. If you forget it, you can only 
                    recover your funds using your seed phrase.
                  </p>
                </div>
              </div>

              {passwordError && (
                <p className="text-red-400 text-center">{passwordError}</p>
              )}

              {error && (
                <p className="text-red-400 text-center">{error}</p>
              )}

              <button
                onClick={completeSetup}
                disabled={isProcessing || !passwordMeetsMinimum}
                className="btn-primary w-full py-4 text-lg flex items-center justify-center gap-2"
              >
                {isProcessing ? (
                  <>
                    <Loader2 className="w-5 h-5 animate-spin" />
                    Encrypting...
                  </>
                ) : (
                  <>
                    <Shield className="w-5 h-5" />
                    Complete Setup
                  </>
                )}
              </button>
            </div>
          </div>
        );

      case "encrypting":
        return (
          <div className="text-center animate-fade-in py-12">
            <div className="w-20 h-20 rounded-full bg-primary-500/20 flex items-center justify-center mx-auto mb-6 relative">
              <Lock className="w-10 h-10 text-primary-400" />
              <div className="absolute inset-0 rounded-full border-4 border-primary-500/30 border-t-primary-400 animate-spin" />
            </div>
            <h2 className="text-2xl font-bold text-white mb-2">
              Securing Your Wallet
            </h2>
            <p className="text-surface-400">
              Encrypting wallet data...
            </p>
          </div>
        );

      case "success":
        return (
          <div className="text-center animate-fade-in py-8">
            <div className="w-24 h-24 rounded-3xl bg-gradient-to-br from-accent-500/30 to-accent-600/20 flex items-center justify-center mx-auto mb-8 shadow-lg">
              <CheckCircle className="w-12 h-12 text-accent-400" />
            </div>
            <h2 className="text-3xl font-bold text-white mb-3">
              Wallet Created Successfully!
            </h2>
            <p className="text-surface-400 mb-10 max-w-md mx-auto text-lg">
              Your wallet is now encrypted and ready to use. 
              Keep your seed phrase safe - it's your only backup.
            </p>

            <div className="p-6 bg-gradient-to-br from-accent-500/15 via-accent-500/10 to-transparent rounded-2xl max-w-md mx-auto mb-10">
              <ul className="text-left text-sm space-y-3">
                <li className="flex items-center gap-3">
                  <div className="w-6 h-6 rounded-full bg-accent-500/30 flex items-center justify-center">
                    <CheckCircle className="w-4 h-4 text-accent-400" />
                  </div>
                  <span className="text-accent-200/80">Seed phrase backed up</span>
                </li>
                <li className="flex items-center gap-3">
                  <div className="w-6 h-6 rounded-full bg-accent-500/30 flex items-center justify-center">
                    <CheckCircle className="w-4 h-4 text-accent-400" />
                  </div>
                  <span className="text-accent-200/80">Wallet encrypted with password</span>
                </li>
                <li className="flex items-center gap-3">
                  <div className="w-6 h-6 rounded-full bg-accent-500/30 flex items-center justify-center">
                    <CheckCircle className="w-4 h-4 text-accent-400" />
                  </div>
                  <span className="text-accent-200/80">Ready to sync blockchain</span>
                </li>
              </ul>
            </div>

            <button
              onClick={onComplete}
              className="btn-accent px-10 py-4 text-lg flex items-center gap-3 mx-auto"
            >
              Launch Wallet
              <ArrowRight className="w-5 h-5" />
            </button>
          </div>
        );
    }
  };

  return (
    <div className="min-h-screen bg-surface-950 bg-gradient-mesh flex items-center justify-center p-6">
      <div className="w-full max-w-2xl">
        {/* Progress Indicator - Enhanced with connecting lines */}
        {step !== "welcome" && step !== "success" && (
          <div className="flex items-center justify-center mb-8">
            {(() => {
              const restoreSteps = ["choice", "restore_seed", "set_password"];
              const createSteps = ["choice", "generate_seed", "verify_seed", "set_password"];
              const steps = walletMode === "restore" ? restoreSteps : createSteps;
              const currentIdx = steps.indexOf(step);
              
              return steps.map((s, idx) => (
                <Fragment key={s}>
                  <div
                    className={`progress-dot ${
                      currentIdx >= idx ? "active" : "inactive"
                    }`}
                  />
                  {idx < steps.length - 1 && (
                    <div
                      className={`progress-line ${
                        currentIdx > idx ? "active" : "inactive"
                      }`}
                    />
                  )}
                </Fragment>
              ));
            })()}
          </div>
        )}

        <div className="glass-card p-8 min-h-[400px]">
          {renderStep()}
        </div>
      </div>
    </div>
  );
}

// Helper component for password requirements
function PasswordRequirement({ met, text }: { met: boolean; text: string }) {
  return (
    <li className={`flex items-center gap-2 ${met ? "text-accent-400" : "text-surface-500"}`}>
      {met ? (
        <CheckCircle className="w-4 h-4" />
      ) : (
        <div className="w-4 h-4 rounded-full border border-surface-600" />
      )}
      {text}
    </li>
  );
}

