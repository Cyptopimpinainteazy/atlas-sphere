import { useState, useEffect, useCallback } from "react";
import { useWallet } from "../context/WalletContext";
import * as api from "../lib/api";
import { Loader2, Shield, Zap, Server, AlertCircle, CheckCircle, HardDrive, RefreshCw } from "lucide-react";
import FirstRunWizard from "./FirstRunWizard";

type StartupPhase = 
  | "checking_init"
  | "first_run"
  | "initializing"
  | "checking"
  | "starting_daemon"
  | "waiting_rpc"
  | "syncing"
  | "ready"
  | "error";

// Debug logging
function debugLog(msg: string): void {
  console.log(`[ConnectPage] ${msg}`);
  if (typeof window !== 'undefined' && (window as any).debugLog) {
    (window as any).debugLog(`[ConnectPage] ${msg}`);
  }
}

export default function ConnectPage() {
  const wallet = useWallet();
  const [phase, setPhase] = useState<StartupPhase>("checking_init");
  const [error, setError] = useState("");
  const [statusMessage, setStatusMessage] = useState("Initializing...");
  const [syncProgress, setSyncProgress] = useState(0);
  const [retrying, setRetrying] = useState(false);
  const [tauriReady, setTauriReady] = useState(false);
  const [isFirstRun, setIsFirstRun] = useState<boolean | null>(null);

  // Check if wallet is initialized (first run check)
  const checkWalletInitialized = useCallback(async () => {
    debugLog("Checking if wallet is initialized...");
    try {
      const initialized = await api.isWalletInitialized();
      debugLog(`Wallet initialized: ${initialized}`);
      setIsFirstRun(!initialized);
      if (initialized) {
        setPhase("initializing");
      } else {
        setPhase("first_run");
      }
    } catch (err) {
      debugLog(`Error checking initialization: ${err}`);
      // Assume first run if we can't check
      setIsFirstRun(true);
      setPhase("first_run");
    }
  }, []);

  const startIntegratedDaemon = useCallback(async () => {
    debugLog("startIntegratedDaemon called");
    setError("");
    setRetrying(false);

    try {
      // Phase 1: Check for daemon binary
      setPhase("checking");
      setStatusMessage("Checking for Mynta daemon...");
      
      let info;
      try {
        debugLog("Calling getDaemonInfo...");
        info = await api.getDaemonInfo();
        debugLog(`getDaemonInfo returned: ${JSON.stringify(info)}`);
      } catch (e) {
        debugLog(`getDaemonInfo error: ${e}`);
        throw new Error("Failed to get daemon info: " + String(e));
      }
      
      if (!info.available) {
        throw new Error("Mynta daemon binary not found. Please ensure myntad is bundled with the wallet.");
      }

      // Check if already running
      if (info.status === "running") {
        setPhase("syncing");
        setStatusMessage("Node already running, checking sync...");
      } else {
        // Phase 2: Start daemon
        setPhase("starting_daemon");
        setStatusMessage("Starting Mynta node...");
        
        try {
          debugLog("Calling startDaemon...");
          await api.startDaemon("mainnet");
          debugLog("startDaemon returned successfully");
        } catch (e) {
          debugLog(`startDaemon error: ${e}`);
          throw new Error("Failed to start daemon: " + String(e));
        }
      }

      // Phase 3: Wait for RPC
      setPhase("waiting_rpc");
      setStatusMessage("Connecting to node...");

      // Poll for connection - give it more time
      let connected = false;
      for (let i = 0; i < 90 && !connected; i++) {
        try {
          // Check daemon status
          const status = await api.getDaemonStatus();
          debugLog(`getDaemonStatus: ${JSON.stringify(status)}`);
          if (status === "running" || (typeof status === "object" && "syncing" in status)) {
            connected = true;
            break;
          }
          await new Promise(resolve => setTimeout(resolve, 1000));
        } catch {
          await new Promise(resolve => setTimeout(resolve, 1000));
        }
      }

      if (!connected) {
        throw new Error("Timed out waiting for node to start. Please check if myntad is running correctly.");
      }

      // Phase 4: Mark as connected
      setPhase("syncing");
      setStatusMessage("Loading wallet data...");
      
      // The daemon manager already connected the RPC with correct credentials
      // Just mark the wallet context as connected (don't call connect() which would override)
      await wallet.setConnected(true);

    } catch (err: any) {
      debugLog(`Startup error: ${err}`);
      setPhase("error");
      // Extract error message from various formats
      let errorMsg = "Unknown error";
      if (typeof err === "string") {
        errorMsg = err;
      } else if (err?.message) {
        errorMsg = err.message;
      } else if (err?.error) {
        errorMsg = err.error;
      } else if (err?.err) {
        errorMsg = err.err;
      } else {
        try {
          errorMsg = JSON.stringify(err);
        } catch {
          errorMsg = String(err);
        }
      }
      setError(errorMsg);
    }
  }, [wallet]);

  // Check for Tauri environment on mount
  useEffect(() => {
    debugLog("ConnectPage mounted, checking Tauri environment...");
    
    // Check immediately
    if (api.isTauri()) {
      debugLog("Tauri detected immediately");
      setTauriReady(true);
      return;
    }
    
    debugLog("Tauri not ready, waiting...");
    
    // Poll for Tauri (it may initialize after React)
    let attempts = 0;
    const checkTauri = setInterval(() => {
      attempts++;
      debugLog(`Checking for Tauri, attempt ${attempts}...`);
      
      if (api.isTauri()) {
        debugLog("Tauri now available!");
        clearInterval(checkTauri);
        setTauriReady(true);
      } else if (attempts >= 30) {
        debugLog("Tauri not available after 30 attempts");
        clearInterval(checkTauri);
        setPhase("error");
        setError("Tauri environment not detected. Please use the desktop app window, not a browser.\n\nIf you're seeing this in the app, try restarting.");
      }
    }, 200);
    
    return () => clearInterval(checkTauri);
  }, []);

  // Check wallet initialization once Tauri is ready
  useEffect(() => {
    if (!tauriReady) {
      return;
    }
    
    debugLog("Tauri ready, checking wallet initialization...");
    const timer = setTimeout(() => {
      checkWalletInitialized();
    }, 300);
    return () => clearTimeout(timer);
  }, [tauriReady, checkWalletInitialized]);

  // Start daemon once initialization is confirmed
  useEffect(() => {
    if (phase !== "initializing") {
      return;
    }
    
    debugLog("Wallet initialized, starting daemon...");
    const timer = setTimeout(() => {
      startIntegratedDaemon();
    }, 100);
    return () => clearTimeout(timer);
  }, [phase, startIntegratedDaemon]);

  // Poll sync status when syncing
  useEffect(() => {
    if (phase !== "syncing") return;

    const interval = setInterval(async () => {
      try {
        const status = await api.getDaemonStatus();
        if (typeof status === "object" && "syncing" in status) {
          setSyncProgress(Math.round(status.syncing.progress * 100));
        } else if (status === "running") {
          setSyncProgress(100);
          setPhase("ready");
        }
      } catch {
        // Ignore polling errors
      }
    }, 2000);

    return () => clearInterval(interval);
  }, [phase]);

  const handleRetry = () => {
    setRetrying(true);
    startIntegratedDaemon();
  };

  // Handle first-run wizard completion
  const handleWizardComplete = () => {
    debugLog("First-run wizard completed, starting daemon...");
    setIsFirstRun(false);
    setPhase("initializing");
  };

  // Show first-run wizard
  if (phase === "first_run" || isFirstRun === true) {
    return <FirstRunWizard onComplete={handleWizardComplete} />;
  }

  return (
    <div className="min-h-screen bg-surface-950 bg-gradient-mesh flex items-center justify-center p-6">
      <div className="w-full max-w-md">
        {/* Logo & Title */}
        <div className="text-center mb-12">
          <div className="inline-flex items-center justify-center w-24 h-24 rounded-3xl bg-gradient-to-br from-primary-500 via-primary-600 to-accent-500 shadow-glow-lg mb-8 relative">
            <span className="text-white font-bold text-4xl">M</span>
            {/* Animated ring */}
            <div className="absolute inset-0 rounded-3xl border-2 border-primary-400/30 animate-pulse" />
          </div>
          <h1 className="text-4xl font-bold text-white mb-3">Mynta Wallet</h1>
          <p className="text-surface-400 text-lg">Full Node Desktop Wallet</p>
        </div>

        {/* Status Card */}
        <div className="glass-card p-8">
          {phase === "error" ? (
            /* Error State */
            <div className="text-center">
              <div className="w-16 h-16 rounded-full bg-red-500/20 flex items-center justify-center mx-auto mb-6">
                <AlertCircle className="w-8 h-8 text-red-400" />
              </div>
              <h3 className="text-xl font-semibold text-white mb-2">Startup Failed</h3>
              <p className="text-red-400 mb-6 whitespace-pre-wrap">{error}</p>
              <button
                onClick={handleRetry}
                disabled={retrying}
                className="btn-primary w-full flex items-center justify-center gap-2"
              >
                {retrying ? (
                  <>
                    <Loader2 className="w-5 h-5 animate-spin" />
                    Retrying...
                  </>
                ) : (
                  <>
                    <RefreshCw className="w-5 h-5" />
                    Retry
                  </>
                )}
              </button>
            </div>
          ) : (
            /* Loading States */
            <div className="text-center">
              {/* Animated Icon */}
              <div className="w-16 h-16 rounded-full bg-primary-500/20 flex items-center justify-center mx-auto mb-6 relative">
                <HardDrive className="w-8 h-8 text-primary-400" />
                <div className="absolute inset-0 rounded-full border-2 border-primary-500/50 border-t-primary-400 animate-spin" />
              </div>

              {/* Status Message */}
              <h3 className="text-xl font-semibold text-white mb-2">
                {phase === "checking_init" && "Checking Wallet"}
                {phase === "initializing" && "Initializing"}
                {phase === "checking" && "Checking System"}
                {phase === "starting_daemon" && "Starting Node"}
                {phase === "waiting_rpc" && "Connecting"}
                {phase === "syncing" && "Synchronizing"}
                {phase === "ready" && "Ready"}
              </h3>
              <p className="text-surface-400 mb-6">{statusMessage}</p>

              {/* Progress Bar for Syncing */}
              {phase === "syncing" && (
                <div className="mb-6">
                  <div className="flex justify-between text-sm text-surface-400 mb-2">
                    <span>Blockchain Sync</span>
                    <span>{syncProgress}%</span>
                  </div>
                  <div className="h-2 bg-surface-800 rounded-full overflow-hidden">
                    <div 
                      className="h-full bg-gradient-to-r from-primary-500 to-accent-500 transition-all duration-500"
                      style={{ width: `${syncProgress}%` }}
                    />
                  </div>
                </div>
              )}

              {/* Phase Indicators */}
              <div className="flex justify-center gap-8 mt-8">
                <PhaseIndicator 
                  icon={<HardDrive className="w-4 h-4" />}
                  label="Node"
                  status={getPhaseStatus("checking", phase)}
                />
                <PhaseIndicator 
                  icon={<Server className="w-4 h-4" />}
                  label="Connect"
                  status={getPhaseStatus("waiting_rpc", phase)}
                />
                <PhaseIndicator 
                  icon={<Shield className="w-4 h-4" />}
                  label="Sync"
                  status={getPhaseStatus("syncing", phase)}
                />
              </div>
            </div>
          )}
        </div>

        {/* Features Footer */}
        <div className="grid grid-cols-3 gap-4 mt-8">
          <div className="text-center">
            <Shield className="w-6 h-6 text-primary-400 mx-auto mb-2" />
            <p className="text-xs text-surface-500">Full Node Security</p>
          </div>
          <div className="text-center">
            <Zap className="w-6 h-6 text-accent-400 mx-auto mb-2" />
            <p className="text-xs text-surface-500">Fast Transactions</p>
          </div>
          <div className="text-center">
            <HardDrive className="w-6 h-6 text-primary-400 mx-auto mb-2" />
            <p className="text-xs text-surface-500">Self Custody</p>
          </div>
        </div>

        <p className="text-center text-surface-600 text-sm mt-8">
          First sync may take several hours
        </p>
      </div>
    </div>
  );
}

// Helper component for phase indicators
function PhaseIndicator({ 
  icon, 
  label, 
  status 
}: { 
  icon: React.ReactNode; 
  label: string; 
  status: "pending" | "active" | "complete" 
}) {
  return (
    <div className="flex flex-col items-center gap-2">
      <div className={`
        w-10 h-10 rounded-full flex items-center justify-center transition-all
        ${status === "complete" ? "bg-accent-500/20 text-accent-400" : ""}
        ${status === "active" ? "bg-primary-500/20 text-primary-400" : ""}
        ${status === "pending" ? "bg-surface-800 text-surface-500" : ""}
      `}>
        {status === "complete" ? (
          <CheckCircle className="w-5 h-5" />
        ) : status === "active" ? (
          <Loader2 className="w-5 h-5 animate-spin" />
        ) : (
          icon
        )}
      </div>
      <span className={`text-xs ${status === "pending" ? "text-surface-500" : "text-surface-300"}`}>
        {label}
      </span>
    </div>
  );
}

function getPhaseStatus(
  checkPhase: StartupPhase, 
  currentPhase: StartupPhase
): "pending" | "active" | "complete" {
  const order: StartupPhase[] = ["checking_init", "first_run", "initializing", "checking", "starting_daemon", "waiting_rpc", "syncing", "ready"];
  const checkIndex = order.indexOf(checkPhase);
  const currentIndex = order.indexOf(currentPhase);
  
  if (currentIndex > checkIndex) return "complete";
  if (currentIndex === checkIndex) return "active";
  return "pending";
}
