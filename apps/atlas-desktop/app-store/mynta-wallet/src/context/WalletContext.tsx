import { createContext, useContext, useState, useEffect, useCallback, ReactNode } from "react";
import * as api from "../lib/api";

// Debug logging
function debugLog(msg: string): void {
  console.log(`[WalletContext] ${msg}`);
  if (typeof window !== 'undefined' && (window as any).debugLog) {
    (window as any).debugLog(`[WalletContext] ${msg}`);
  }
}

interface WalletState {
  connected: boolean;
  connecting: boolean;
  balance: number;
  unconfirmedBalance: number;
  blockHeight: number;
  connections: number;
  chain: string;
  synced: boolean;
  walletLocked: boolean;
  error: string | null;
  initialized: boolean;
}

interface WalletContextType extends WalletState {
  connect: (params: api.ConnectParams) => Promise<void>;
  disconnect: () => Promise<void>;
  refresh: (forceRefresh?: boolean) => Promise<void>;
  clearError: () => void;
  setConnected: (connected: boolean) => Promise<void>;
}

const initialState: WalletState = {
  connected: false,
  connecting: false,
  balance: 0,
  unconfirmedBalance: 0,
  blockHeight: 0,
  connections: 0,
  chain: "main",
  synced: false,
  walletLocked: true,
  error: null,
  initialized: false,
};

const WalletContext = createContext<WalletContextType | undefined>(undefined);

export function WalletProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<WalletState>(initialState);

  const updateState = (updates: Partial<WalletState>) => {
    setState((prev) => ({ ...prev, ...updates }));
  };

  const refresh = useCallback(async (forceRefresh = false) => {
    if (!state.connected && !forceRefresh) return;

    try {
      debugLog("Refreshing wallet data...");
      const data = await api.getDashboardData();
      updateState({
        balance: data.balance,
        unconfirmedBalance: data.unconfirmed_balance,
        blockHeight: data.block_height,
        connections: data.connections,
        chain: data.chain,
        synced: data.synced,
      });

      // Check wallet lock status
      try {
        const walletInfo = await api.getWalletInfo();
        updateState({
          walletLocked: walletInfo.unlocked_until === undefined || walletInfo.unlocked_until === 0,
        });
      } catch {
        // Wallet might not be encrypted
        updateState({ walletLocked: false });
      }
    } catch (err: any) {
      debugLog(`Refresh failed: ${err}`);
      // Only disconnect if this is clearly a connection failure
      // and we've been connected before (not just trying to connect)
      if (!forceRefresh && (err.message?.includes("Connection") || err.message?.includes("not connected"))) {
        updateState({ connected: false, error: "Connection lost" });
      }
    }
  }, [state.connected]);

  const connect = async (params: api.ConnectParams) => {
    updateState({ connecting: true, error: null });

    try {
      await api.connect(params);
      updateState({ connected: true, connecting: false });
      await refresh();
    } catch (err: any) {
      updateState({
        connected: false,
        connecting: false,
        error: err.message || "Connection failed",
      });
      throw err;
    }
  };

  const disconnect = async () => {
    try {
      await api.disconnect();
    } finally {
      setState(initialState);
    }
  };

  const clearError = () => updateState({ error: null });

  // Set connected state directly (used when daemon manager handles connection)
  const setConnected = async (connected: boolean) => {
    debugLog(`setConnected(${connected})`);
    updateState({ connected });
    if (connected) {
      // Force refresh since state might not have updated yet
      try {
        await refresh(true);
      } catch (err) {
        debugLog(`Initial refresh failed: ${err}`);
      }
    }
  };

  // Auto-refresh every 10 seconds
  useEffect(() => {
    if (!state.connected) return;

    const interval = setInterval(refresh, 10000);
    return () => clearInterval(interval);
  }, [state.connected, refresh]);

  // Check initial connection status - but only when Tauri is ready
  useEffect(() => {
    debugLog("WalletProvider mounted");
    
    // Mark as initialized (we don't need to wait for Tauri here)
    // The ConnectPage will handle waiting for Tauri
    updateState({ initialized: true });
    
    // Only attempt connection check if Tauri appears to be available
    // This check is lenient - if Tauri isn't ready, the API will handle it gracefully
    const checkConnection = async () => {
      // Wait a moment for Tauri to initialize
      await new Promise(r => setTimeout(r, 500));
      
      if (!api.isTauri()) {
        debugLog("Tauri not available, skipping initial connection check");
        return;
      }
      
      try {
        debugLog("Checking initial connection status...");
        const connected = await api.isConnected();
        if (connected) {
          debugLog("Already connected!");
          updateState({ connected: true });
          await refresh();
        } else {
          debugLog("Not connected");
        }
      } catch (err) {
        debugLog(`Initial connection check failed: ${err}`);
        // This is expected if Tauri isn't ready or we're not connected
      }
    };

    checkConnection();
  }, []);

  return (
    <WalletContext.Provider
      value={{
        ...state,
        connect,
        disconnect,
        refresh,
        clearError,
        setConnected,
      }}
    >
      {children}
    </WalletContext.Provider>
  );
}

export function useWallet() {
  const context = useContext(WalletContext);
  if (context === undefined) {
    throw new Error("useWallet must be used within a WalletProvider");
  }
  return context;
}
