/**
 * useSessionTimeout - Auto-lock wallet after period of inactivity
 * 
 * Features:
 * - Tracks user activity (clicks, key presses, mouse movement)
 * - Auto-locks wallet after configurable timeout
 * - Provides warning before lock
 * - Persists timeout preference
 * 
 * Security Notes:
 * - Default timeout is 10 minutes
 * - Minimum timeout is 1 minute
 * - Can be disabled by setting to 0
 */
import { useState, useEffect, useCallback, useRef } from 'react';
import * as api from '../lib/api';

interface SessionTimeoutOptions {
  /** Timeout in minutes (0 to disable, default: 10) */
  timeout?: number;
  /** Show warning before lock (seconds before lock, default: 60) */
  warningTime?: number;
  /** Callback when session expires */
  onExpire?: () => void;
  /** Callback when warning starts */
  onWarning?: (secondsRemaining: number) => void;
  /** Whether the wallet is currently locked */
  isLocked?: boolean;
}

interface SessionTimeoutReturn {
  /** Whether session has expired */
  isExpired: boolean;
  /** Whether warning is showing */
  isWarning: boolean;
  /** Seconds remaining until lock */
  secondsRemaining: number;
  /** Reset the activity timer */
  resetTimer: () => void;
  /** Extend session by specified minutes */
  extendSession: (minutes: number) => void;
  /** Current timeout setting in minutes */
  currentTimeout: number;
  /** Update timeout setting */
  setTimeout: (minutes: number) => void;
  /** Whether auto-lock is enabled */
  isEnabled: boolean;
}

const STORAGE_KEY = 'mynta_session_timeout';
const DEFAULT_TIMEOUT = 10; // minutes
const MIN_TIMEOUT = 1; // minutes
const DEFAULT_WARNING_TIME = 60; // seconds

export function useSessionTimeout(options: SessionTimeoutOptions = {}): SessionTimeoutReturn {
  const {
    timeout: initialTimeout,
    warningTime = DEFAULT_WARNING_TIME,
    onExpire,
    onWarning,
    isLocked = false,
  } = options;

  // Load saved timeout or use default
  const getSavedTimeout = (): number => {
    if (initialTimeout !== undefined) return initialTimeout;
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) {
        const parsed = parseInt(saved, 10);
        if (!isNaN(parsed) && parsed >= 0) return parsed;
      }
    } catch {
      // Ignore storage errors
    }
    return DEFAULT_TIMEOUT;
  };

  const [currentTimeout, setCurrentTimeout] = useState(getSavedTimeout);
  const [isExpired, setIsExpired] = useState(false);
  const [isWarning, setIsWarning] = useState(false);
  const [secondsRemaining, setSecondsRemaining] = useState(0);

  const lastActivityRef = useRef(Date.now());
  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const warningCalledRef = useRef(false);

  const isEnabled = currentTimeout > 0 && !isLocked;

  // Save timeout preference
  const updateTimeout = useCallback((minutes: number) => {
    const validMinutes = minutes === 0 ? 0 : Math.max(MIN_TIMEOUT, minutes);
    setCurrentTimeout(validMinutes);
    try {
      localStorage.setItem(STORAGE_KEY, validMinutes.toString());
    } catch {
      // Ignore storage errors
    }
    lastActivityRef.current = Date.now();
    setIsExpired(false);
    setIsWarning(false);
    warningCalledRef.current = false;
  }, []);

  // Reset timer on activity
  const resetTimer = useCallback(() => {
    lastActivityRef.current = Date.now();
    setIsExpired(false);
    setIsWarning(false);
    warningCalledRef.current = false;
  }, []);

  // Extend session
  const extendSession = useCallback((minutes: number) => {
    lastActivityRef.current = Date.now() + (minutes * 60 * 1000);
    setIsExpired(false);
    setIsWarning(false);
    warningCalledRef.current = false;
  }, []);

  // Lock wallet
  const lockWallet = useCallback(async () => {
    try {
      await api.walletLock();
    } catch (error) {
      console.error('Failed to lock wallet:', error);
    }
    onExpire?.();
    setIsExpired(true);
  }, [onExpire]);

  // Check timer
  useEffect(() => {
    if (!isEnabled) {
      setSecondsRemaining(0);
      setIsWarning(false);
      return;
    }

    const checkTimer = () => {
      const now = Date.now();
      const elapsed = now - lastActivityRef.current;
      const timeoutMs = currentTimeout * 60 * 1000;
      const remaining = Math.max(0, Math.ceil((timeoutMs - elapsed) / 1000));

      setSecondsRemaining(remaining);

      // Check if expired
      if (elapsed >= timeoutMs) {
        lockWallet();
        return;
      }

      // Check if in warning period
      if (remaining <= warningTime && remaining > 0) {
        if (!warningCalledRef.current) {
          onWarning?.(remaining);
          warningCalledRef.current = true;
        }
        setIsWarning(true);
      } else {
        setIsWarning(false);
        warningCalledRef.current = false;
      }
    };

    // Check immediately
    checkTimer();

    // Set up interval
    timerRef.current = setInterval(checkTimer, 1000);

    return () => {
      if (timerRef.current) {
        clearInterval(timerRef.current);
        timerRef.current = null;
      }
    };
  }, [isEnabled, currentTimeout, warningTime, onWarning, lockWallet]);

  // Track user activity
  useEffect(() => {
    if (!isEnabled) return;

    const handleActivity = () => {
      lastActivityRef.current = Date.now();
      if (isWarning) {
        setIsWarning(false);
        warningCalledRef.current = false;
      }
    };

    // Events to track
    const events = ['mousedown', 'keydown', 'touchstart', 'scroll'];
    
    events.forEach(event => {
      document.addEventListener(event, handleActivity, { passive: true });
    });

    return () => {
      events.forEach(event => {
        document.removeEventListener(event, handleActivity);
      });
    };
  }, [isEnabled, isWarning]);

  return {
    isExpired,
    isWarning,
    secondsRemaining,
    resetTimer,
    extendSession,
    currentTimeout,
    setTimeout: updateTimeout,
    isEnabled,
  };
}

export default useSessionTimeout;


