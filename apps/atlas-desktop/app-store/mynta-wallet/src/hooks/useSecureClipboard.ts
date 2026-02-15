/**
 * useSecureClipboard - Secure clipboard hook with auto-clear functionality
 * 
 * Features:
 * - Automatic clipboard clearing after timeout
 * - Warning notifications for sensitive data
 * - Tracks clipboard state
 * 
 * Security Notes:
 * - Sensitive data (private keys, seed phrases) are automatically cleared
 * - Default timeout is 30 seconds for sensitive data
 * - Non-sensitive data (addresses, txids) remain in clipboard
 */
import { useState, useCallback, useRef, useEffect } from 'react';

interface SecureClipboardOptions {
  /** Timeout in milliseconds before clearing clipboard (default: 30000) */
  timeout?: number;
  /** Callback when clipboard is cleared */
  onCleared?: () => void;
  /** Callback when copy is successful */
  onCopied?: (isSensitive: boolean) => void;
}

interface SecureClipboardReturn {
  /** Copy text to clipboard */
  copySecure: (text: string, isSensitive?: boolean) => Promise<boolean>;
  /** Clear clipboard immediately */
  clearClipboard: () => Promise<void>;
  /** Whether clipboard currently has secure content pending clear */
  hasPendingClear: boolean;
  /** Time remaining until clear (in seconds) */
  timeRemaining: number;
  /** Last copied content type */
  lastCopyType: 'sensitive' | 'normal' | null;
}

const DEFAULT_SENSITIVE_TIMEOUT = 30000; // 30 seconds

export function useSecureClipboard(options: SecureClipboardOptions = {}): SecureClipboardReturn {
  const {
    timeout = DEFAULT_SENSITIVE_TIMEOUT,
    onCleared,
    onCopied,
  } = options;

  const [hasPendingClear, setHasPendingClear] = useState(false);
  const [timeRemaining, setTimeRemaining] = useState(0);
  const [lastCopyType, setLastCopyType] = useState<'sensitive' | 'normal' | null>(null);
  
  const clearTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const countdownRef = useRef<NodeJS.Timeout | null>(null);
  const clearTimeRef = useRef<number>(0);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (clearTimeoutRef.current) clearTimeout(clearTimeoutRef.current);
      if (countdownRef.current) clearInterval(countdownRef.current);
    };
  }, []);

  const clearClipboard = useCallback(async () => {
    try {
      await navigator.clipboard.writeText('');
    } catch (error) {
      console.warn('Failed to clear clipboard:', error);
    }
    
    setHasPendingClear(false);
    setTimeRemaining(0);
    setLastCopyType(null);
    
    if (clearTimeoutRef.current) {
      clearTimeout(clearTimeoutRef.current);
      clearTimeoutRef.current = null;
    }
    if (countdownRef.current) {
      clearInterval(countdownRef.current);
      countdownRef.current = null;
    }
    
    onCleared?.();
  }, [onCleared]);

  const copySecure = useCallback(async (text: string, isSensitive: boolean = false): Promise<boolean> => {
    try {
      await navigator.clipboard.writeText(text);
      
      setLastCopyType(isSensitive ? 'sensitive' : 'normal');
      onCopied?.(isSensitive);

      // Clear any existing timeouts
      if (clearTimeoutRef.current) {
        clearTimeout(clearTimeoutRef.current);
        clearTimeoutRef.current = null;
      }
      if (countdownRef.current) {
        clearInterval(countdownRef.current);
        countdownRef.current = null;
      }

      // Set up auto-clear for sensitive data
      if (isSensitive && timeout > 0) {
        setHasPendingClear(true);
        clearTimeRef.current = Date.now() + timeout;
        setTimeRemaining(Math.ceil(timeout / 1000));

        // Update countdown every second
        countdownRef.current = setInterval(() => {
          const remaining = Math.max(0, Math.ceil((clearTimeRef.current - Date.now()) / 1000));
          setTimeRemaining(remaining);
          
          if (remaining <= 0) {
            if (countdownRef.current) clearInterval(countdownRef.current);
          }
        }, 1000);

        // Set up actual clear
        clearTimeoutRef.current = setTimeout(() => {
          clearClipboard();
        }, timeout);
      } else {
        setHasPendingClear(false);
        setTimeRemaining(0);
      }

      return true;
    } catch (error) {
      console.error('Failed to copy to clipboard:', error);
      return false;
    }
  }, [timeout, clearClipboard, onCopied]);

  return {
    copySecure,
    clearClipboard,
    hasPendingClear,
    timeRemaining,
    lastCopyType,
  };
}

/**
 * Helper to detect if content is likely sensitive
 */
export function isSensitiveContent(content: string): boolean {
  // Private key patterns (WIF format)
  if (/^[5KL][1-9A-HJ-NP-Za-km-z]{50,51}$/.test(content)) return true;
  
  // Seed phrase (12 or 24 words)
  const words = content.trim().split(/\s+/);
  if (words.length === 12 || words.length === 24) {
    // Check if all words are lowercase letters only (BIP39 wordlist)
    if (words.every(w => /^[a-z]+$/.test(w))) return true;
  }
  
  // Hex encoded private key (64 chars)
  if (/^[0-9a-fA-F]{64}$/.test(content)) return true;
  
  return false;
}

/**
 * Commonly used clipboard copy with notifications
 */
export async function copyWithNotification(
  text: string,
  isSensitive: boolean = false,
  showToast?: (message: string, type: 'success' | 'warning') => void
): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text);
    
    if (isSensitive) {
      // Schedule clipboard clear
      setTimeout(() => {
        navigator.clipboard.writeText('').catch(() => {});
      }, 30000);
      
      showToast?.('Copied! Will clear in 30 seconds', 'warning');
    } else {
      showToast?.('Copied to clipboard', 'success');
    }
    
    return true;
  } catch (error) {
    showToast?.('Failed to copy', 'warning');
    return false;
  }
}

export default useSecureClipboard;


