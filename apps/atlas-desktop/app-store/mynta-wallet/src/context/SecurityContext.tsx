/**
 * SecurityContext - App-wide security state management
 * 
 * Provides:
 * - Session timeout management
 * - Wallet lock state
 * - Secure clipboard operations
 * - Activity tracking
 * 
 * This context should wrap the entire application to ensure
 * security features work consistently across all pages.
 */
import { createContext, useContext, useState, useEffect, useCallback, useRef, ReactNode } from 'react';
import * as api from '../lib/api';

// ============================================================================
// Types
// ============================================================================

interface SecurityState {
  // Wallet lock state
  isLocked: boolean;
  isEncrypted: boolean;
  
  // Session state
  isSessionExpired: boolean;
  isSessionWarning: boolean;
  sessionSecondsRemaining: number;
  sessionTimeoutMinutes: number;
  
  // Last activity
  lastActivityTime: number;
}

interface SecurityContextValue extends SecurityState {
  // Actions
  lockWallet: () => Promise<void>;
  unlockWallet: (passphrase: string, timeout?: number) => Promise<boolean>;
  resetSessionTimer: () => void;
  setSessionTimeout: (minutes: number) => void;
  refreshLockState: () => Promise<void>;
  
  // Clipboard (with security)
  copyToClipboard: (text: string, isSensitive?: boolean) => Promise<boolean>;
  clearClipboard: () => Promise<void>;
  clipboardTimeRemaining: number;
  
  // Session expired modal control
  showSessionExpiredModal: boolean;
  dismissSessionExpiredModal: () => void;
}

const SecurityContext = createContext<SecurityContextValue | null>(null);

// ============================================================================
// Constants
// ============================================================================

const STORAGE_KEY_TIMEOUT = 'mynta_session_timeout';
const DEFAULT_TIMEOUT_MINUTES = 10;
const MIN_TIMEOUT_MINUTES = 1;
const WARNING_SECONDS = 60;
const CLIPBOARD_CLEAR_TIMEOUT = 30000; // 30 seconds

// ============================================================================
// Provider Component
// ============================================================================

interface SecurityProviderProps {
  children: ReactNode;
}

export function SecurityProvider({ children }: SecurityProviderProps) {
  // -------------------------------------------------------------------------
  // State
  // -------------------------------------------------------------------------
  
  const [isLocked, setIsLocked] = useState(true);
  const [isEncrypted, setIsEncrypted] = useState(false);
  const [isSessionExpired, setIsSessionExpired] = useState(false);
  const [isSessionWarning, setIsSessionWarning] = useState(false);
  const [sessionSecondsRemaining, setSessionSecondsRemaining] = useState(0);
  const [showSessionExpiredModal, setShowSessionExpiredModal] = useState(false);
  const [clipboardTimeRemaining, setClipboardTimeRemaining] = useState(0);
  
  // Load saved timeout
  const [sessionTimeoutMinutes, setSessionTimeoutMinutes] = useState(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY_TIMEOUT);
      if (saved) {
        const parsed = parseInt(saved, 10);
        if (!isNaN(parsed) && parsed >= 0) return parsed;
      }
    } catch {
      // Ignore
    }
    return DEFAULT_TIMEOUT_MINUTES;
  });
  
  // -------------------------------------------------------------------------
  // Refs
  // -------------------------------------------------------------------------
  
  const lastActivityRef = useRef(Date.now());
  const sessionTimerRef = useRef<NodeJS.Timeout | null>(null);
  const clipboardTimerRef = useRef<NodeJS.Timeout | null>(null);
  const clipboardCountdownRef = useRef<NodeJS.Timeout | null>(null);
  const warningShownRef = useRef(false);
  
  // -------------------------------------------------------------------------
  // Derived State
  // -------------------------------------------------------------------------
  
  const lastActivityTime = lastActivityRef.current;
  const isSessionEnabled = sessionTimeoutMinutes > 0 && !isLocked;
  
  // -------------------------------------------------------------------------
  // Wallet Lock/Unlock
  // -------------------------------------------------------------------------
  
  const refreshLockState = useCallback(async () => {
    try {
      const walletInfo = await api.getWalletInfo();
      // Wallet is locked if unlocked_until is 0 or not present
      const locked = !walletInfo.unlocked_until || walletInfo.unlocked_until === 0;
      setIsLocked(locked);
      // Check if wallet has been encrypted by seeing if it ever had an unlock state
      // A fresh unencrypted wallet won't have the unlocked_until field behavior
      setIsEncrypted(walletInfo.unlocked_until !== undefined);
    } catch (error) {
      // If we can't get wallet info, assume locked for safety
      setIsLocked(true);
    }
  }, []);
  
  const lockWallet = useCallback(async () => {
    try {
      await api.walletLock();
      setIsLocked(true);
      setIsSessionExpired(true);
      setShowSessionExpiredModal(true);
    } catch (error) {
      console.error('Failed to lock wallet:', error);
      // Still mark as expired for safety
      setIsSessionExpired(true);
      setShowSessionExpiredModal(true);
    }
  }, []);
  
  const unlockWallet = useCallback(async (passphrase: string, timeout: number = 300): Promise<boolean> => {
    try {
      await api.walletUnlock(passphrase, timeout);
      setIsLocked(false);
      setIsSessionExpired(false);
      setShowSessionExpiredModal(false);
      lastActivityRef.current = Date.now();
      warningShownRef.current = false;
      return true;
    } catch (error) {
      console.error('Failed to unlock wallet:', error);
      return false;
    }
  }, []);
  
  // -------------------------------------------------------------------------
  // Session Management
  // -------------------------------------------------------------------------
  
  const resetSessionTimer = useCallback(() => {
    lastActivityRef.current = Date.now();
    setIsSessionWarning(false);
    warningShownRef.current = false;
  }, []);
  
  const setSessionTimeout = useCallback((minutes: number) => {
    const validMinutes = minutes === 0 ? 0 : Math.max(MIN_TIMEOUT_MINUTES, minutes);
    setSessionTimeoutMinutes(validMinutes);
    try {
      localStorage.setItem(STORAGE_KEY_TIMEOUT, validMinutes.toString());
    } catch {
      // Ignore storage errors
    }
    resetSessionTimer();
  }, [resetSessionTimer]);
  
  // Session timer effect
  useEffect(() => {
    if (!isSessionEnabled) {
      setSessionSecondsRemaining(0);
      setIsSessionWarning(false);
      if (sessionTimerRef.current) {
        clearInterval(sessionTimerRef.current);
        sessionTimerRef.current = null;
      }
      return;
    }
    
    const checkSession = () => {
      const now = Date.now();
      const elapsed = now - lastActivityRef.current;
      const timeoutMs = sessionTimeoutMinutes * 60 * 1000;
      const remaining = Math.max(0, Math.ceil((timeoutMs - elapsed) / 1000));
      
      setSessionSecondsRemaining(remaining);
      
      // Check expiration
      if (elapsed >= timeoutMs) {
        lockWallet();
        if (sessionTimerRef.current) {
          clearInterval(sessionTimerRef.current);
          sessionTimerRef.current = null;
        }
        return;
      }
      
      // Check warning
      if (remaining <= WARNING_SECONDS && remaining > 0) {
        if (!warningShownRef.current) {
          warningShownRef.current = true;
        }
        setIsSessionWarning(true);
      } else {
        setIsSessionWarning(false);
        warningShownRef.current = false;
      }
    };
    
    // Run immediately
    checkSession();
    
    // Set up interval
    sessionTimerRef.current = setInterval(checkSession, 1000);
    
    return () => {
      if (sessionTimerRef.current) {
        clearInterval(sessionTimerRef.current);
        sessionTimerRef.current = null;
      }
    };
  }, [isSessionEnabled, sessionTimeoutMinutes, lockWallet]);
  
  // Activity tracking
  useEffect(() => {
    if (!isSessionEnabled) return;
    
    const handleActivity = () => {
      lastActivityRef.current = Date.now();
      if (isSessionWarning) {
        setIsSessionWarning(false);
        warningShownRef.current = false;
      }
    };
    
    // Throttle mousemove to avoid excessive updates
    let lastMouseMove = 0;
    const handleMouseMove = () => {
      const now = Date.now();
      if (now - lastMouseMove > 5000) { // Only update every 5 seconds
        lastMouseMove = now;
        handleActivity();
      }
    };
    
    const handlers: { [key: string]: EventListener } = {
      mousedown: handleActivity,
      keydown: handleActivity,
      touchstart: handleActivity,
      scroll: handleActivity,
      mousemove: handleMouseMove,
    };
    
    Object.entries(handlers).forEach(([event, handler]) => {
      document.addEventListener(event, handler, { passive: true });
    });
    
    return () => {
      Object.entries(handlers).forEach(([event, handler]) => {
        document.removeEventListener(event, handler);
      });
    };
  }, [isSessionEnabled, isSessionWarning]);
  
  // -------------------------------------------------------------------------
  // Clipboard Security
  // -------------------------------------------------------------------------
  
  const clearClipboard = useCallback(async () => {
    try {
      await navigator.clipboard.writeText('');
    } catch {
      // Ignore
    }
    
    setClipboardTimeRemaining(0);
    
    if (clipboardTimerRef.current) {
      clearTimeout(clipboardTimerRef.current);
      clipboardTimerRef.current = null;
    }
    if (clipboardCountdownRef.current) {
      clearInterval(clipboardCountdownRef.current);
      clipboardCountdownRef.current = null;
    }
  }, []);
  
  const copyToClipboard = useCallback(async (text: string, isSensitive: boolean = false): Promise<boolean> => {
    try {
      await navigator.clipboard.writeText(text);
      
      // Clear any existing timers
      if (clipboardTimerRef.current) {
        clearTimeout(clipboardTimerRef.current);
      }
      if (clipboardCountdownRef.current) {
        clearInterval(clipboardCountdownRef.current);
      }
      
      if (isSensitive) {
        // Set up auto-clear countdown
        const clearTime = Date.now() + CLIPBOARD_CLEAR_TIMEOUT;
        setClipboardTimeRemaining(Math.ceil(CLIPBOARD_CLEAR_TIMEOUT / 1000));
        
        clipboardCountdownRef.current = setInterval(() => {
          const remaining = Math.max(0, Math.ceil((clearTime - Date.now()) / 1000));
          setClipboardTimeRemaining(remaining);
          if (remaining <= 0 && clipboardCountdownRef.current) {
            clearInterval(clipboardCountdownRef.current);
          }
        }, 1000);
        
        clipboardTimerRef.current = setTimeout(() => {
          clearClipboard();
        }, CLIPBOARD_CLEAR_TIMEOUT);
      } else {
        setClipboardTimeRemaining(0);
      }
      
      return true;
    } catch (error) {
      console.error('Failed to copy to clipboard:', error);
      return false;
    }
  }, [clearClipboard]);
  
  // Cleanup clipboard timers on unmount
  useEffect(() => {
    return () => {
      if (clipboardTimerRef.current) clearTimeout(clipboardTimerRef.current);
      if (clipboardCountdownRef.current) clearInterval(clipboardCountdownRef.current);
    };
  }, []);
  
  // -------------------------------------------------------------------------
  // Initial load
  // -------------------------------------------------------------------------
  
  useEffect(() => {
    refreshLockState();
  }, [refreshLockState]);
  
  // -------------------------------------------------------------------------
  // Context Value
  // -------------------------------------------------------------------------
  
  const value: SecurityContextValue = {
    // State
    isLocked,
    isEncrypted,
    isSessionExpired,
    isSessionWarning,
    sessionSecondsRemaining,
    sessionTimeoutMinutes,
    lastActivityTime,
    
    // Actions
    lockWallet,
    unlockWallet,
    resetSessionTimer,
    setSessionTimeout,
    refreshLockState,
    
    // Clipboard
    copyToClipboard,
    clearClipboard,
    clipboardTimeRemaining,
    
    // Modal
    showSessionExpiredModal,
    dismissSessionExpiredModal: () => setShowSessionExpiredModal(false),
  };
  
  return (
    <SecurityContext.Provider value={value}>
      {children}
    </SecurityContext.Provider>
  );
}

// ============================================================================
// Hook
// ============================================================================

export function useSecurity(): SecurityContextValue {
  const context = useContext(SecurityContext);
  if (!context) {
    throw new Error('useSecurity must be used within a SecurityProvider');
  }
  return context;
}

export default SecurityContext;


