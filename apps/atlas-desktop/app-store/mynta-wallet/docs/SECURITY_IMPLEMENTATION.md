# Mynta Wallet - Security Implementation Guide

**Agent:** Security Domain (Agent 1)  
**Date:** January 10, 2026  
**Status:** COMPLETE - Ready for Integration

---

## Executive Summary

All 5 security tasks have been implemented with production-ready security practices:

| Task | Description | Status |
|------|-------------|--------|
| 1.1 | BIP39 Seed Phrase Generation | ✅ Complete |
| 1.2 | First-Run Wallet Encryption | ✅ Complete |
| 1.3 | Secure Private Key Export | ✅ Complete |
| 1.4 | Clipboard Security | ✅ Complete |
| 1.5 | Session Timeout | ✅ Complete |

---

## Files Created

### Backend (Rust)
- `src-tauri/src/wallet_keys.rs` - BIP39/BIP44 HD wallet implementation
- `src-tauri/src/seed_commands.rs` - Tauri command wrappers

### Frontend (React/TypeScript)
| File | Purpose |
|------|---------|
| `src/pages/FirstRunWizard.tsx` | Complete onboarding wizard with encryption |
| `src/components/PasswordStrengthMeter.tsx` | Visual password strength indicator |
| `src/components/SeedPhraseDisplay.tsx` | Secure seed phrase display with warnings |
| `src/components/SeedPhraseVerify.tsx` | Verification quiz (3 random words) |
| `src/components/SeedPhraseRestore.tsx` | Restore wallet from seed phrase |
| `src/components/SessionExpiredModal.tsx` | Auto-lock notification and unlock |
| `src/components/SecurityWrapper.tsx` | Easy integration wrapper |
| `src/context/SecurityContext.tsx` | App-wide security state management |
| `src/hooks/useSecureClipboard.ts` | Secure clipboard with auto-clear |
| `src/hooks/useSessionTimeout.ts` | Session timeout with activity tracking |

### Modified Files
| File | Changes |
|------|---------|
| `src/pages/ConnectPage.tsx` | First-run detection, wizard integration |
| `src/pages/SettingsPage.tsx` | Secure export modal, timeout settings |
| `src-tauri/Cargo.toml` | BIP39/BIP32 dependencies |
| `src-tauri/src/lib.rs` | Command registration |

---

## Security Features Implemented

### 1. BIP39 Seed Phrase Generation (Task 1.1)

**Features:**
- 12 or 24 word seed phrases (default: 24 for maximum security)
- Uses system CSPRNG via Rust's `rand` crate
- BIP39 English wordlist with checksum validation
- Secure memory handling with `zeroize` crate in Rust

**Security Measures:**
- Seed phrase hidden by default, revealed on click
- Clear warning about screenshot risks
- Acknowledgment checkbox required before proceeding
- Verification quiz (3 random words) before encryption

**API:**
```typescript
// Generate seed phrase
const seed = await api.generateSeedPhrase(24);
// seed.words: string[] - The 24 words

// Validate seed phrase
const result = await api.validateSeedPhrase(phrase);
// result.valid: boolean
// result.invalid_words: { index, word, suggestions }[]
```

### 2. First-Run Wallet Encryption (Task 1.2)

**Flow:**
1. Welcome screen
2. Create vs Restore choice
3. Seed phrase display (with reveal-on-click)
4. Seed phrase verification quiz
5. Strong password creation
6. Wallet encryption
7. Success confirmation

**Password Requirements:**
- Minimum 8 characters
- At least one lowercase letter
- At least one uppercase letter
- At least one number
- At least one special character
- Common password blacklist check

**Security Measures:**
- Progress saved state prevents accidental navigation
- `beforeunload` warning during critical steps
- Secure memory clearing on component unmount
- Password never stored, only used for encryption

### 3. Secure Private Key Export (Task 1.3)

**Features:**
- Requires passphrase verification before display
- Auto-hide key after 60 seconds
- Clipboard auto-clear after 30 seconds
- Prominent security warnings

**Security Measures:**
- Two-step verification (passphrase then address)
- Visual countdown timer
- "Copied" indicator with clear time
- Key cleared from state after timeout

### 4. Clipboard Security (Task 1.4)

**Hook: `useSecureClipboard`**

```typescript
const { copySecure, clearClipboard, hasPendingClear, timeRemaining } = useSecureClipboard({
  timeout: 30000, // 30 seconds
  onCleared: () => console.log('Clipboard cleared'),
});

// Copy sensitive data (will auto-clear)
await copySecure(privateKey, true);

// Copy normal data (no auto-clear)
await copySecure(address, false);

// Manual clear
await clearClipboard();
```

**Helper Functions:**
```typescript
// Detect if content is sensitive
isSensitiveContent(text); // Returns true for private keys, seed phrases

// Copy with toast notification
copyWithNotification(text, isSensitive, showToast);
```

### 5. Session Timeout (Task 1.5)

**Features:**
- Configurable timeout (1-60 minutes, or disabled)
- Activity tracking (mouse, keyboard, touch, scroll)
- 60-second warning before lock
- Persistent preference (localStorage)

**Context: `SecurityContext`**

```typescript
const {
  isLocked,
  isSessionExpired,
  isSessionWarning,
  sessionSecondsRemaining,
  sessionTimeoutMinutes,
  lockWallet,
  unlockWallet,
  resetSessionTimer,
  setSessionTimeout,
  copyToClipboard,
  clipboardTimeRemaining,
} = useSecurity();
```

---

## Integration Guide

### For UX Agent (App.tsx)

Wrap `WalletApp` with `SecurityWrapper`:

```tsx
import SecurityWrapper from "./components/SecurityWrapper";

function App() {
  return (
    <ErrorBoundary>
      <WalletProvider>
        <SecurityWrapper>
          <WalletApp />
        </SecurityWrapper>
      </WalletProvider>
    </ErrorBoundary>
  );
}
```

This automatically provides:
- Session timeout with auto-lock
- Warning banner 60 seconds before lock
- Session expired modal with unlock form

### For Blockchain Agent (SendPage.tsx)

Use secure clipboard for addresses:

```tsx
import { useSecureClipboard } from '../hooks/useSecureClipboard';

function SendPage() {
  const { copySecure } = useSecureClipboard();
  
  const handlePasteAddress = async () => {
    // Addresses are not sensitive, no auto-clear needed
    await copySecure(address, false);
  };
}
```

### For Features Agent (ReceivePage.tsx)

Use secure clipboard for QR code data:

```tsx
import { copyWithNotification } from '../hooks/useSecureClipboard';

function ReceivePage() {
  const handleCopyAddress = async () => {
    await copyWithNotification(address, false, showToast);
  };
}
```

---

## Security Best Practices Implemented

### Memory Security
- Sensitive strings cleared from React state on unmount
- Rust uses `zeroize` crate for secure memory clearing
- Passwords never persisted, only used for encryption

### Input Validation
- BIP39 wordlist validation with suggestions
- Password complexity requirements enforced
- Address format validation before operations

### UI Security
- Seed phrases hidden by default
- Private keys hidden with toggle
- Auto-hide timers for sensitive data
- Clear visual warnings for dangerous operations

### Session Security
- Automatic wallet lock after inactivity
- Warning before auto-lock
- Activity tracking on user interactions
- Configurable timeout (can be disabled for power users)

### Clipboard Security
- Auto-clear for sensitive data (30 seconds)
- Manual clear option
- Visual countdown indicator
- Sensitive content detection

---

## Testing Checklist

### Seed Phrase Generation
- [ ] 12-word phrase generates correctly
- [ ] 24-word phrase generates correctly
- [ ] Words are from BIP39 English wordlist
- [ ] Checksum validates correctly
- [ ] Regeneration creates new phrase
- [ ] Verification quiz selects 3 random words
- [ ] Incorrect answers show error
- [ ] All correct answers proceed to password

### Password Flow
- [ ] Cannot proceed with <8 characters
- [ ] Cannot proceed without uppercase
- [ ] Cannot proceed without lowercase
- [ ] Cannot proceed without number
- [ ] Cannot proceed without special char
- [ ] Password mismatch prevents submission
- [ ] Strength meter updates in real-time
- [ ] Wallet encrypts successfully

### Secure Export
- [ ] Locked wallet requires passphrase
- [ ] Invalid passphrase shows error
- [ ] Key displays after unlock
- [ ] Key auto-hides after 60 seconds
- [ ] Copy sets clipboard clear timer
- [ ] Clipboard clears after 30 seconds

### Session Timeout
- [ ] Session timer starts when unlocked
- [ ] Activity resets timer
- [ ] Warning shows at 60 seconds
- [ ] Wallet locks at timeout
- [ ] Modal shows unlock form
- [ ] Unlock resets session
- [ ] Settings save timeout preference

---

## Known Limitations

1. **JavaScript Memory Security**: True secure memory clearing is not possible in JavaScript. The implementation uses best-effort clearing and garbage collection hints.

2. **Clipboard Access**: Some browsers may restrict clipboard access. The implementation falls back gracefully.

3. **Activity Detection**: `mousemove` is throttled to every 5 seconds to avoid performance impact.

4. **Cross-Tab Sessions**: Each browser tab has its own session timer. Locking in one tab does not affect others.

---

## Future Enhancements (Post-MVP)

1. **Hardware Security Module (HSM)** - Integrate with OS keychain
2. **Biometric Unlock** - Fingerprint/Face ID on supported devices
3. **2FA Support** - TOTP for additional security
4. **Security Audit Log** - Track unlock/export events
5. **Remote Lock** - Lock wallet from another device

---

**Document Status:** COMPLETE  
**Ready for Review:** YES  
**Integration Dependencies:** UX Agent must wrap App with SecurityWrapper


