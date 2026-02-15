# Mynta Wallet - Parallel Agent Work Plan

**Document Version:** 2.1  
**Created:** January 9, 2026  
**Last Updated:** January 10, 2026  
**Purpose:** Parallel work coordination for 4 agents updating the wallet simultaneously  
**Usage:** Each agent works ONLY within their assigned section. Check dependencies before starting blocked tasks.

---

## 🔄 SYNC POINT 1 STATUS (January 10, 2026)

| Agent | Critical Task | Status |
|-------|---------------|--------|
| **Security** | Task 1.1 (Seed Phrases) | ✅ COMPLETE |
| **Blockchain** | Task 2.1 (Fee Estimation) | ⏳ Pending |
| **Features** | Task 3.1 (QR Code) | ⏳ Pending |
| **UX** | Task 4.4 (Branding) | ⏳ Pending |

### Security Agent Deliverables:
- `src/hooks/useSecureClipboard.ts` - Ready for other agents
- `src/hooks/useSessionTimeout.ts` - Ready for integration
- `src/context/SecurityContext.tsx` - App-wide security state
- `src/components/SecurityWrapper.tsx` - **UX Agent: Wrap App with this!**
- `src/pages/FirstRunWizard.tsx` - Auto-redirects from ConnectPage
- `docs/SECURITY_IMPLEMENTATION.md` - Full documentation

---

## How to Use This Document

1. **Find your agent section** (AGENT 1-4 below)
2. **Check the File Ownership Matrix** - only modify files you own
3. **Check DEPENDS markers** - wait for blocking agent to complete before starting dependent tasks
4. **Sync at checkpoints** - merge work at defined sync points
5. **Update task status** - mark `[x]` when complete, `[~]` when in progress

---

## Quick Reference - All Tasks by Agent

| Task ID | Name | Priority | Agent | Est. Time | Status |
|---------|------|----------|-------|-----------|--------|
| 1.1 | BIP39 Seed Phrases | CRITICAL | Security | 3 days | [x] ✅ COMPLETE |
| 1.2 | First-Run Encryption | CRITICAL | Security | 2 days | [x] ✅ COMPLETE |
| 1.3 | Secure Key Export | HIGH | Security | 0.5 days | [x] ✅ COMPLETE |
| 1.4 | Clipboard Security | HIGH | Security | 0.5 days | [x] ✅ COMPLETE |
| 1.5 | Session Timeout | MEDIUM | Security | 0.5 days | [x] ✅ COMPLETE |
| 2.1 | Dynamic Fee Estimation | CRITICAL | Blockchain | 1 day | [ ] |
| 2.2 | Send Flow Improvements | HIGH | Blockchain | 0.5 days | [ ] |
| 2.3 | Coin Control | MEDIUM | Blockchain | 1.5 days | [ ] |
| 2.4 | Reorg Detection | LOW | Blockchain | 0.5 days | [ ] |
| 3.1 | QR Code Generation | CRITICAL | Features | 0.5 days | [ ] |
| 3.2 | Address Book | HIGH | Features | 2 days | [ ] |
| 3.3 | Transaction Labels | HIGH | Features | 1 day | [ ] |
| 3.4 | Backup Reminders | MEDIUM | Features | 0.5 days | [ ] |
| 3.5 | TX History Export | MEDIUM | Features | 0.5 days | [ ] |
| 3.6 | Settings Improvements | MEDIUM | Features | 1 day | [ ] |
| 3.7 | DEX Error Handling | MEDIUM | Features | 0.5 days | [ ] |
| 3.8 | Multi-Wallet Support | LOW | Features | 2 days | [ ] |
| 3.9 | Hardware Wallet | LOW | Features | 3 days | [ ] |
| 3.10 | Watch-Only Mode | LOW | Features | 1 day | [ ] |
| 4.1 | Transaction Confirmation | CRITICAL | UX | 0.5 days | [ ] |
| 4.2 | Quick Actions Navigation | HIGH | UX | 0.5 hrs | [ ] |
| 4.3 | Theme Toggle | MEDIUM | UX | 1 day | [ ] |
| 4.4 | Branding Consistency | MEDIUM | UX | 1 hr | [ ] |
| 4.5 | Help Documentation | LOW | UX | 1 day | [ ] |
| 4.6 | Keyboard Shortcuts | LOW | UX | 0.5 days | [ ] |
| 4.7 | Empty State Illustrations | LOW | UX | 0.5 days | [ ] |

---

## File Ownership Matrix

**CRITICAL: Only modify files you own. If you need changes to another agent's file, coordinate at sync points.**

| File | Owner Agent | Dependent Tasks |
|------|-------------|-----------------|
| `src/pages/SendPage.tsx` | BLOCKCHAIN | FEAT-002 (autocomplete), UX-001 (modal) |
| `src/pages/SettingsPage.tsx` | SECURITY | FEAT-006, UX-003 (theme toggle) |
| `src/App.tsx` | UX | SEC-002 (routing), FEAT-002 (routing) |
| `src/components/Layout.tsx` | UX | FEAT-002 (nav), FEAT-004 (backup indicator) |
| `src/pages/DashboardPage.tsx` | FEATURES | UX-002 (quick actions) |
| `src/lib/api.ts` | BLOCKCHAIN | SEC-002 (isWalletInitialized) |
| `src/pages/ReceivePage.tsx` | FEATURES | - |
| `src/pages/DexPage.tsx` | FEATURES | - |
| `src/pages/AssetsPage.tsx` | FEATURES | - |
| `src/pages/ConnectPage.tsx` | SECURITY | - |
| `src/index.css` | UX | - |
| `src-tauri/src/rpc.rs` | BLOCKCHAIN | - |
| `src-tauri/src/commands.rs` | BLOCKCHAIN | - |
| `src-tauri/src/lib.rs` | SECURITY | - |
| `src-tauri/Cargo.toml` | SECURITY | - |
| All new `src/components/*` | Creator owns | - |
| All new `src/hooks/*` | Creator owns | - |
| All new `src/lib/*` | Creator owns | - |

---

## Cross-Agent Dependency Graph

```
SYNC POINT 1 (Day 3)
        │
        ▼
┌───────────────────────────────────────────────────────────────────────────────┐
│                           PARALLEL WORK PHASE 1                                │
│                                                                               │
│  SECURITY          BLOCKCHAIN         FEATURES           UX                   │
│  ─────────         ──────────         ────────           ──                   │
│  1.1 Seed ────┐    2.1 Fees ─────┐    3.1 QR             4.4 Branding         │
│               │                  │                                            │
│               │                  │    [No deps]          [No deps]            │
│               │                  │                                            │
└───────────────│──────────────────│────────────────────────────────────────────┘
                │                  │
                ▼                  ▼
┌───────────────────────────────────────────────────────────────────────────────┐
│                           PARALLEL WORK PHASE 2                                │
│                                                                               │
│  1.2 First-Run ◄── App.tsx ◄── 4.2 Quick Actions                              │
│  [DEPENDS: UX]     (UX owns)                                                  │
│                                                                               │
│  1.3 Key Export    2.2 Send ──► 4.1 Confirm Modal                             │
│  1.4 Clipboard     [SendPage    [DEPENDS: Blockchain]                         │
│                     owner]                                                    │
│                                 3.2 Address Book ◄── SendPage                 │
│                                 [DEPENDS: Blockchain]                         │
│                                                                               │
│                                 3.3 TX Labels                                 │
│                                 [DashboardPage owner]                         │
│                                                                               │
└───────────────────────────────────────────────────────────────────────────────┘
                │
                ▼
SYNC POINT 2 (Day 5) - Merge all HIGH priority work
                │
                ▼
┌───────────────────────────────────────────────────────────────────────────────┐
│                           PARALLEL WORK PHASE 3                                │
│                                                                               │
│  1.5 Timeout ──► SettingsPage   2.3 Coin Control      3.4 Backup ◄── Layout  │
│  [SECURITY owns]                                      [DEPENDS: UX]           │
│                                                                               │
│                                 2.4 Reorg             3.5 TX Export           │
│                                                                               │
│                                                       3.6 Settings            │
│                                                       [DEPENDS: Security]     │
│                                                                               │
│                                                       3.7 DEX Errors          │
│                                                                               │
│                                                       4.3 Theme               │
│                                                       [DEPENDS: Security]     │
│                                                                               │
└───────────────────────────────────────────────────────────────────────────────┘
                │
                ▼
SYNC POINT 3 (Day 8+) - Final integration
```

---

# AGENT 1: SECURITY DOMAIN

**Agent 1 Owns:**
- `src/pages/SettingsPage.tsx`
- `src/pages/ConnectPage.tsx`
- `src-tauri/src/*.rs` (all Rust backend files)
- `src-tauri/Cargo.toml`

**Total Tasks:** 5  
**Estimated Time:** ~5 days

---

## Task 1.1: BIP39 Seed Phrase Generation
**Priority:** CRITICAL  
**Estimated Time:** 2-3 days  
**Dependencies:** None  
**Status:** [ ] Not Started

**Description:**
Implement full BIP39/BIP44 HD wallet support for seed phrase backup and recovery.

**Tasks:**
1. Add `bip39` and `bip32` Rust crates to `Cargo.toml`
2. Create `src-tauri/src/wallet_keys.rs` module with:
   - `generate_mnemonic(word_count: u8) -> String` - Generate 12/24 word seed
   - `validate_mnemonic(mnemonic: &str) -> bool` - Validate seed phrase
   - `derive_master_key(mnemonic: &str, passphrase: Option<&str>) -> Result<ExtendedPrivKey>`
   - `derive_address(master: &ExtendedPrivKey, path: &str) -> Result<Address>`
3. Add Tauri commands:
   - `generate_seed_phrase`
   - `validate_seed_phrase`
   - `restore_from_seed`
4. Create frontend components:
   - `SeedPhraseDisplay.tsx` - Shows words with copy protection
   - `SeedPhraseVerify.tsx` - Verification quiz
   - `SeedPhraseRestore.tsx` - Recovery input

**Acceptance Criteria:**
- [ ] 12 and 24 word seed phrases supported
- [ ] Words from BIP39 English wordlist
- [ ] Entropy from system CSPRNG
- [ ] Verification flow requires user to confirm 3 random words
- [ ] Restore flow validates checksum

**Files to Create:**
- `src-tauri/src/wallet_keys.rs`
- `src/components/SeedPhraseDisplay.tsx`
- `src/components/SeedPhraseVerify.tsx`
- `src/pages/RestoreWalletPage.tsx`

**Files to Modify:**
- `src-tauri/Cargo.toml` - Add dependencies
- `src-tauri/src/lib.rs` - Register module and commands
- `src/pages/ConnectPage.tsx` - Add "Create/Restore" choice

---

## Task 1.2: First-Run Wallet Encryption
**Priority:** CRITICAL  
**Estimated Time:** 1-2 days  
**Dependencies:** Task 1.1  
**DEPENDS:** UX Agent must complete App.tsx routing hooks first  
**Status:** [ ] Not Started

**Description:**
Create mandatory first-run flow that encrypts wallet before use.

**Tasks:**
1. Create `FirstRunWizard.tsx` component with steps:
   - Step 1: Welcome screen
   - Step 2: Create wallet vs Restore wallet
   - Step 3: Seed phrase display (Task 1.1)
   - Step 4: Seed phrase verification
   - Step 5: Set encryption password
   - Step 6: Confirm password
   - Step 7: Success / Begin sync
2. Add persistent storage for `wallet_initialized` flag
3. Modify `ConnectPage.tsx` to check if first run
4. Call `encryptwallet` RPC after password set

**Acceptance Criteria:**
- [ ] New users must complete wizard before using wallet
- [ ] Password must be minimum 8 characters
- [ ] Password confirmation required
- [ ] Cannot skip encryption step
- [ ] Progress saved if user closes mid-wizard

**Files to Create:**
- `src/pages/FirstRunWizard.tsx`
- `src/components/PasswordStrengthMeter.tsx`

**Files to Modify (OWNED):**
- `src/pages/ConnectPage.tsx`

**Files to Modify (COORDINATE WITH UX):**
- `src/App.tsx` - Route to wizard if not initialized (UX OWNS - request change)

**Files to Modify (COORDINATE WITH BLOCKCHAIN):**
- `src/lib/api.ts` - Add `isWalletInitialized()` function (BLOCKCHAIN OWNS - request change)

---

## Task 1.3: Secure Private Key Export
**Priority:** HIGH  
**Estimated Time:** 0.5 days  
**Dependencies:** None  
**Status:** [ ] Not Started

**Description:**
Add security safeguards to private key export.

**Tasks:**
1. Check if wallet is locked before allowing export
2. Require password re-entry to confirm identity
3. Add prominent security warning
4. Auto-clear displayed key after 60 seconds
5. Add "Don't copy to clipboard" option with manual write-down

**Acceptance Criteria:**
- [ ] Password required before key display
- [ ] Warning about key exposure
- [ ] Auto-hide after timeout
- [ ] Clipboard cleared after copy

**Files to Modify (OWNED):**
- `src/pages/SettingsPage.tsx` - ExportKeyModal component

---

## Task 1.4: Clipboard Security
**Priority:** HIGH  
**Estimated Time:** 0.5 days  
**Dependencies:** None  
**Status:** [ ] Not Started

**Description:**
Add clipboard auto-clear and warnings for sensitive data.

**Tasks:**
1. Create `useSecureClipboard` hook:
   ```typescript
   function useSecureClipboard(timeout: number = 30000) {
     const copySecure = async (text: string, isSensitive: boolean) => {
       await navigator.clipboard.writeText(text);
       if (isSensitive) {
         setTimeout(() => navigator.clipboard.writeText(''), timeout);
       }
     };
     return { copySecure };
   }
   ```
2. Replace all `navigator.clipboard.writeText` calls in owned files
3. Add toast notification: "Copied (will clear in 30s)"
4. Add warning when copying private keys

**Files to Create:**
- `src/hooks/useSecureClipboard.ts`

**Files to Modify (OWNED):**
- `src/pages/SettingsPage.tsx`

**Files to Modify (COORDINATE WITH OTHER AGENTS):**
- `src/pages/ReceivePage.tsx` - Request FEATURES agent to integrate hook
- `src/pages/SendPage.tsx` - Request BLOCKCHAIN agent to integrate hook

---

## Task 1.5: Session Timeout
**Priority:** MEDIUM  
**Estimated Time:** 0.5 days  
**Dependencies:** None  
**Status:** [ ] Not Started

**Description:**
Auto-lock wallet after period of inactivity.

**Tasks:**
1. Track user activity (clicks, key presses)
2. Lock wallet after configurable timeout (default: 10 minutes)
3. Show "Session expired" modal
4. Add timeout setting to Settings page
5. Allow "Stay logged in" option

**Files to Create:**
- `src/hooks/useSessionTimeout.ts`
- `src/components/SessionExpiredModal.tsx`

**Files to Modify (OWNED):**
- `src/pages/SettingsPage.tsx`

**Files to Modify (COORDINATE WITH UX):**
- `src/App.tsx` - Integrate session timeout hook (UX OWNS - request change)

---

# AGENT 2: BLOCKCHAIN DOMAIN

**Agent 2 Owns:**
- `src/pages/SendPage.tsx`
- `src-tauri/src/rpc.rs`
- `src-tauri/src/commands.rs`
- `src/lib/api.ts`

**Total Tasks:** 4  
**Estimated Time:** ~3.5 days

---

## Task 2.1: Dynamic Fee Estimation
**Priority:** CRITICAL  
**Estimated Time:** 1 day  
**Dependencies:** None  
**Status:** [ ] Not Started

**Description:**
Replace hardcoded fee with dynamic estimation from network.

**Tasks:**
1. Add RPC call `estimatesmartfee` to `rpc.rs`:
   ```rust
   pub async fn estimate_smart_fee(&self, conf_target: u32) -> Result<FeeEstimate, RpcError>
   ```
2. Add Tauri command `estimate_fee`
3. Add API wrapper in `api.ts`
4. Create `FeeSelector.tsx` component with options:
   - Economy (20+ blocks)
   - Normal (6 blocks)
   - Priority (2 blocks)
   - Custom (manual input)
5. Integrate into `SendPage.tsx`

**Acceptance Criteria:**
- [ ] Fees fetched from network
- [ ] User can select fee priority
- [ ] Fallback to default if estimation fails
- [ ] Shows estimated confirmation time

**Files to Create:**
- `src/components/FeeSelector.tsx`

**Files to Modify (OWNED):**
- `src-tauri/src/rpc.rs`
- `src-tauri/src/commands.rs`
- `src/lib/api.ts`
- `src/pages/SendPage.tsx`

---

## Task 2.2: Send Flow Improvements
**Priority:** HIGH  
**Estimated Time:** 0.5 days  
**Dependencies:** Task 2.1  
**Status:** [ ] Not Started

**Description:**
Comprehensive improvements to the send transaction flow.

**Tasks:**
1. Add "Send All" button that accounts for fee properly
2. Show warning if sending to an address never used before
3. Validate address format before enabling send button
4. Show estimated USD value (optional, if price feed available)
5. Remember last used addresses

**Acceptance Criteria:**
- [ ] Send All deducts correct fee
- [ ] New address warning displayed
- [ ] Invalid addresses rejected
- [ ] Last addresses remembered

**Files to Modify (OWNED):**
- `src/pages/SendPage.tsx`

---

## Task 2.3: Coin Control (UTXO Selection)
**Priority:** MEDIUM  
**Estimated Time:** 1.5 days  
**Dependencies:** None  
**Status:** [ ] Not Started

**Description:**
Allow advanced users to select specific UTXOs for transactions.

**Tasks:**
1. Create `CoinControlModal.tsx` showing all UTXOs
2. Allow selection/deselection of inputs
3. Show address, amount, confirmations for each
4. Calculate and display selected total
5. Pass selected UTXOs to transaction construction

**Acceptance Criteria:**
- [ ] All UTXOs displayed
- [ ] Selection persists during send flow
- [ ] Total updates on selection
- [ ] Selected UTXOs used in transaction

**Files to Create:**
- `src/components/CoinControlModal.tsx`
- `src/pages/CoinControlPage.tsx`

**Files to Modify (OWNED):**
- `src/pages/SendPage.tsx` - Add "Coin Control" button

---

## Task 2.4: Reorg Detection UI
**Priority:** LOW  
**Estimated Time:** 0.5 days  
**Dependencies:** None  
**Status:** [ ] Not Started

**Description:**
Warn users if transaction confirmations decrease (chain reorganization).

**Tasks:**
1. Track confirmation counts for recent transactions
2. Detect if confirmations decrease
3. Show warning banner if reorg detected
4. Explain implications to user

**Acceptance Criteria:**
- [ ] Confirmation tracking works
- [ ] Reorg detected correctly
- [ ] User-friendly warning shown

**Files to Create:**
- `src/components/ReorgWarning.tsx`
- `src/hooks/useReorgDetection.ts`

**Files to Modify (OWNED):**
- `src/lib/api.ts` - Add confirmation tracking

---

# AGENT 3: FEATURES DOMAIN

**Agent 3 Owns:**
- `src/pages/ReceivePage.tsx`
- `src/pages/DashboardPage.tsx`
- `src/pages/DexPage.tsx`
- `src/pages/AssetsPage.tsx`

**Total Tasks:** 10  
**Estimated Time:** ~12 days

---

## Task 3.1: QR Code Generation
**Priority:** CRITICAL  
**Estimated Time:** 0.5 days  
**Dependencies:** None  
**Status:** [ ] Not Started

**Description:**
Implement actual QR code generation for receive addresses.

**Tasks:**
1. Add `qrcode.react` package to frontend
2. Replace placeholder in `ReceivePage.tsx` with real QR code
3. Support customizable size
4. Include address text below QR code

**Implementation:**
```tsx
import { QRCodeSVG } from 'qrcode.react';

<QRCodeSVG 
  value={`mynta:${address}`}
  size={192}
  level="M"
  bgColor="#FFFFFF"
  fgColor="#000000"
/>
```

**Acceptance Criteria:**
- [ ] QR code displays address correctly
- [ ] Scannable by standard QR readers
- [ ] Uses `mynta:` URI scheme
- [ ] Proper contrast for scanning

**Files to Modify:**
- `package.json` - Add qrcode.react

**Files to Modify (OWNED):**
- `src/pages/ReceivePage.tsx`

---

## Task 3.2: Address Book
**Priority:** HIGH  
**Estimated Time:** 2 days  
**Dependencies:** None  
**DEPENDS:** BLOCKCHAIN agent must complete SendPage work (Task 2.1, 2.2) before autocomplete integration  
**Status:** [ ] Not Started

**Description:**
Implement contact/address book for saved addresses.

**Tasks:**
1. Create data model:
   ```typescript
   interface Contact {
     id: string;
     name: string;
     address: string;
     notes?: string;
     createdAt: number;
   }
   ```
2. Create `AddressBookPage.tsx` with:
   - List view of contacts
   - Add/Edit/Delete functionality
   - Search/filter
   - Import/Export as JSON
3. Persist to local storage or Tauri store
4. Integrate with SendPage - address autocomplete (AFTER BLOCKCHAIN completes)
5. Add "Add to contacts" button on transaction rows

**Acceptance Criteria:**
- [ ] CRUD operations for contacts
- [ ] Address validation before save
- [ ] Search by name or address
- [ ] Quick-select in send form
- [ ] Data persisted across sessions

**Files to Create:**
- `src/pages/AddressBookPage.tsx`
- `src/components/ContactCard.tsx`
- `src/components/AddContactModal.tsx`
- `src/lib/contacts.ts` - persistence logic

**Files to Modify (COORDINATE WITH UX):**
- `src/App.tsx` - Add route (UX OWNS - request change)
- `src/components/Layout.tsx` - Add nav item (UX OWNS - request change)

**Files to Modify (COORDINATE WITH BLOCKCHAIN):**
- `src/pages/SendPage.tsx` - Autocomplete integration (BLOCKCHAIN OWNS - request change after their work)

---

## Task 3.3: Transaction Labels/Notes
**Priority:** HIGH  
**Estimated Time:** 1 day  
**Dependencies:** None  
**Status:** [ ] Not Started

**Description:**
Allow users to add labels/notes to transactions.

**Tasks:**
1. Store transaction metadata locally:
   ```typescript
   interface TxMeta {
     txid: string;
     label?: string;
     category?: 'payment' | 'exchange' | 'business' | 'personal';
     notes?: string;
   }
   ```
2. Create `TransactionDetailModal.tsx`
3. Add edit capability for labels
4. Display labels in transaction list
5. Add search by label

**Acceptance Criteria:**
- [ ] Labels can be added/edited
- [ ] Categories assignable
- [ ] Labels display in list
- [ ] Search works

**Files to Create:**
- `src/components/TransactionDetailModal.tsx`
- `src/lib/txMetadata.ts`

**Files to Modify (OWNED):**
- `src/pages/DashboardPage.tsx`

---

## Task 3.4: Backup Reminders
**Priority:** MEDIUM  
**Estimated Time:** 0.5 days  
**Dependencies:** Task 1.1 (Security - Seed Phrases)  
**DEPENDS:** UX agent must be ready to accept Layout.tsx changes  
**Status:** [ ] Not Started

**Description:**
Remind users to backup their wallet.

**Tasks:**
1. Track last backup date in local storage
2. Show reminder after 30 days without backup
3. Show reminder if balance increased significantly
4. Allow dismissal for 7 days
5. Add backup status indicator in sidebar

**Acceptance Criteria:**
- [ ] Reminder appears after 30 days
- [ ] Balance-based trigger works
- [ ] Dismissal persists 7 days
- [ ] Sidebar indicator shows status

**Files to Create:**
- `src/components/BackupReminder.tsx`
- `src/lib/backupTracking.ts`

**Files to Modify (COORDINATE WITH UX):**
- `src/components/Layout.tsx` - Add backup indicator (UX OWNS - request change)

---

## Task 3.5: Transaction History Export
**Priority:** MEDIUM  
**Estimated Time:** 0.5 days  
**Dependencies:** None  
**Status:** [ ] Not Started

**Description:**
Allow exporting transaction history for tax/accounting.

**Tasks:**
1. Add export button to dashboard
2. Support formats: CSV, JSON
3. Include: date, txid, type, amount, fee, address, confirmations
4. Date range selection

**Acceptance Criteria:**
- [ ] CSV export works
- [ ] JSON export works
- [ ] Date range filtering works
- [ ] All fields included

**Files to Create:**
- `src/components/ExportTransactionsModal.tsx`
- `src/lib/exportUtils.ts`

**Files to Modify (OWNED):**
- `src/pages/DashboardPage.tsx`

---

## Task 3.6: Improved Settings Page
**Priority:** MEDIUM  
**Estimated Time:** 1 day  
**Dependencies:** None  
**DEPENDS:** SECURITY agent must complete SettingsPage work (Tasks 1.3, 1.4, 1.5) first  
**Status:** [ ] Not Started

**Description:**
Add missing configuration options.

**Tasks:**
1. Add sections:
   - Network settings (testnet/mainnet switch)
   - Display preferences (decimal places, date format)
   - Notification settings
   - Advanced options (rescan, reindex trigger)
2. Add "About" section with version info
3. Add links to documentation/support

**Note:** This task adds NEW sections. Coordinate with SECURITY agent who owns the file.

**Acceptance Criteria:**
- [ ] Network settings work
- [ ] Display preferences save
- [ ] About section shows version
- [ ] Links work

**Files to Modify (COORDINATE WITH SECURITY):**
- `src/pages/SettingsPage.tsx` - Add new sections (SECURITY OWNS - request change)

---

## Task 3.7: DEX Page Error Handling
**Priority:** MEDIUM  
**Estimated Time:** 0.5 days  
**Dependencies:** None  
**Status:** [ ] Not Started

**Description:**
Handle cases where DEX RPCs are not available.

**Tasks:**
1. Gracefully handle RPC errors
2. Show "DEX not available" message if unsupported
3. Add loading states for all operations
4. Validate order parameters before submission

**Acceptance Criteria:**
- [ ] Errors handled gracefully
- [ ] User-friendly messages
- [ ] Loading states work
- [ ] Validation prevents bad orders

**Files to Modify (OWNED):**
- `src/pages/DexPage.tsx`

---

## Task 3.8: Multi-Wallet Support
**Priority:** LOW  
**Estimated Time:** 2-3 days  
**Dependencies:** Tasks 1.1, 1.2 (Security)  
**Status:** [ ] Not Started

**Description:**
Support multiple wallet profiles.

**Tasks:**
1. Design wallet switching UI
2. Implement wallet file management
3. Add wallet selector to header
4. Handle wallet-specific settings

---

## Task 3.9: Hardware Wallet Integration
**Priority:** LOW  
**Estimated Time:** 3-5 days  
**Dependencies:** Task 1.1 (Security)  
**Status:** [ ] Not Started

**Description:**
Support Ledger/Trezor hardware wallets.

**Tasks:**
1. Research HID integration in Tauri
2. Implement Ledger communication
3. Add hardware wallet detection
4. Implement signing flow

---

## Task 3.10: Watch-Only Wallet Mode
**Priority:** LOW  
**Estimated Time:** 1-2 days  
**Dependencies:** None  
**Status:** [ ] Not Started

**Description:**
Import xpub for watch-only monitoring.

**Tasks:**
1. Add xpub import UI
2. Disable send functionality for watch-only
3. Show clear "Watch Only" indicator
4. Track addresses derived from xpub

---

# AGENT 4: UX DOMAIN

**Agent 4 Owns:**
- `src/App.tsx`
- `src/components/Layout.tsx`
- `src/index.css`

**Total Tasks:** 7  
**Estimated Time:** ~4 days

---

## Task 4.1: Transaction Confirmation Dialog
**Priority:** CRITICAL  
**Estimated Time:** 0.5 days  
**Dependencies:** None  
**DEPENDS:** BLOCKCHAIN agent must complete SendPage base work before modal integration  
**Status:** [ ] Not Started

**Description:**
Add confirmation step before broadcasting transactions.

**Tasks:**
1. Create `ConfirmTransactionModal.tsx` component showing:
   - Recipient address (full, with copy button)
   - Amount being sent
   - Network fee
   - Total deducted
   - Warning if sending to new address
2. Coordinate with BLOCKCHAIN agent to integrate into SendPage
3. Add 3-second countdown or checkbox confirmation
4. Log transaction attempt before broadcast

**Acceptance Criteria:**
- [ ] Modal appears after clicking "Send"
- [ ] Shows all transaction details
- [ ] Requires explicit confirmation
- [ ] Can cancel and go back
- [ ] Clear success/failure state after

**Files to Create:**
- `src/components/ConfirmTransactionModal.tsx`

**Files to Modify (COORDINATE WITH BLOCKCHAIN):**
- `src/pages/SendPage.tsx` - Integrate modal (BLOCKCHAIN OWNS - request integration)

---

## Task 4.2: Quick Actions Navigation
**Priority:** HIGH  
**Estimated Time:** 0.5 hours  
**Dependencies:** None  
**DEPENDS:** FEATURES agent's DashboardPage changes may need coordination  
**Status:** [ ] Not Started

**Description:**
Connect Quick Actions buttons on dashboard to actual navigation.

**Tasks:**
1. Pass `onNavigate` prop to DashboardPage
2. Connect buttons to navigation

**Files to Modify (OWNED):**
- `src/App.tsx` - Pass onNavigate prop

**Files to Modify (COORDINATE WITH FEATURES):**
- `src/pages/DashboardPage.tsx` - Accept and use onNavigate (FEATURES OWNS - request change)

---

## Task 4.3: Theme Toggle (Light/Dark)
**Priority:** MEDIUM  
**Estimated Time:** 1 day  
**Dependencies:** None  
**DEPENDS:** SECURITY agent must complete SettingsPage work for theme toggle placement  
**Status:** [ ] Not Started

**Description:**
Add light mode option for accessibility.

**Tasks:**
1. Create CSS variables for both themes
2. Add theme toggle to settings
3. Persist preference in local storage
4. Respect system preference by default
5. Transition animations

**Files to Create:**
- `src/lib/theme.ts`

**Files to Modify (OWNED):**
- `src/index.css`
- `src/App.tsx`

**Files to Modify (COORDINATE WITH SECURITY):**
- `src/pages/SettingsPage.tsx` - Add theme toggle UI (SECURITY OWNS - request change)

---

## Task 4.4: Branding Consistency Fix
**Priority:** MEDIUM  
**Estimated Time:** 1 hour  
**Dependencies:** None  
**Status:** [ ] Not Started

**Description:**
Fix remaining AiCoin branding to Mynta.

**Tasks:**
1. Change "Ai" logo text to "M" in Layout.tsx
2. Update ReceivePage QR placeholder icon (coordinate with FEATURES)
3. Review all text strings for old branding
4. Verify all icons and images are Mynta branded

**Files to Modify (OWNED):**
- `src/components/Layout.tsx`

**Files to Modify (COORDINATE WITH FEATURES):**
- `src/pages/ReceivePage.tsx` - Update branding (FEATURES OWNS - request change)

**Files to Modify (COORDINATE WITH SECURITY):**
- `src/pages/ConnectPage.tsx` - Update branding (SECURITY OWNS - request change)

---

## Task 4.5: Help Documentation
**Priority:** LOW  
**Estimated Time:** 1 day  
**Dependencies:** None  
**Status:** [ ] Not Started

**Description:**
Add help/documentation section with FAQs.

**Tasks:**
1. Create Help page with FAQ
2. Add contextual help tooltips
3. Link to external documentation
4. Add "What's New" section

**Files to Create:**
- `src/pages/HelpPage.tsx`
- `src/components/HelpTooltip.tsx`

**Files to Modify (OWNED):**
- `src/App.tsx` - Add route
- `src/components/Layout.tsx` - Add nav item

---

## Task 4.6: Keyboard Shortcuts
**Priority:** LOW  
**Estimated Time:** 0.5 days  
**Dependencies:** None  
**Status:** [ ] Not Started

**Description:**
Add keyboard navigation (Ctrl+S for send, etc.).

**Tasks:**
1. Define shortcut mappings
2. Implement keyboard event handlers
3. Add shortcuts help modal
4. Ensure no conflicts with system shortcuts

**Files to Create:**
- `src/hooks/useKeyboardShortcuts.ts`
- `src/components/ShortcutsHelpModal.tsx`

**Files to Modify (OWNED):**
- `src/App.tsx` - Integrate keyboard handler

---

## Task 4.7: Empty State Illustrations
**Priority:** LOW  
**Estimated Time:** 0.5 days  
**Dependencies:** None  
**Status:** [ ] Not Started

**Description:**
Add illustrations for empty states (no transactions, no assets).

**Tasks:**
1. Design or source empty state illustrations
2. Create EmptyState component
3. Add to Dashboard (no transactions)
4. Add to Assets (no assets)

**Files to Create:**
- `src/components/EmptyState.tsx`
- `src/assets/empty-*.svg` - Illustrations

**Files to Modify (COORDINATE WITH FEATURES):**
- `src/pages/DashboardPage.tsx` - Use EmptyState (FEATURES OWNS - request change)
- `src/pages/AssetsPage.tsx` - Use EmptyState (FEATURES OWNS - request change)

---

# SYNCHRONIZATION PROTOCOL

## Sync Point 1: After Critical Tasks (Day 3)

**Required Completions:**
- [x] Security: Task 1.1 (Seed Phrases) complete ✅ **DONE - Jan 10, 2026**
- [ ] Blockchain: Task 2.1 (Fee Estimation) complete
- [ ] Features: Task 3.1 (QR Code) complete
- [ ] UX: Task 4.4 (Branding) complete

**Actions:**
1. All agents push/commit their work
2. Review each other's interfaces
3. Resolve any file conflicts
4. Update dependency status

### Security Agent Sync Notes (Agent 1):
**Files ready for integration:**
- `SecurityWrapper.tsx` - UX Agent should wrap `<WalletApp>` with this
- `useSecureClipboard.ts` - Blockchain/Features agents can use for copy operations
- `SecurityContext.tsx` - Provides `useSecurity()` hook for lock state

**API changes in `src/lib/api.ts`:**
- `isWalletInitialized()` - Checks first-run status
- `generateSeedPhrase(wordCount)` - Generates 12/24 word seed
- `validateSeedPhrase(phrase)` - Validates with suggestions
- `encryptWallet(passphrase)` - Encrypts wallet

---

## Sync Point 2: After High Priority (Day 5)

**Required Completions:**
- [ ] All CRITICAL tasks complete
- [ ] All HIGH priority tasks complete or unblocked
- [ ] Security: Tasks 1.3, 1.4 complete
- [ ] Blockchain: Task 2.2 complete
- [ ] Features: Tasks 3.2, 3.3 (core functionality, not integrations)
- [ ] UX: Tasks 4.1, 4.2 complete

**Actions:**
1. Merge all agent branches
2. Integration testing
3. Fix any interface mismatches
4. Unblock dependent tasks

---

## Sync Point 3: Final Integration (Day 8+)

**Required Completions:**
- [ ] All MEDIUM priority tasks complete
- [ ] LOW priority tasks as time permits
- [ ] All cross-agent integrations complete

**Actions:**
1. Final merge
2. End-to-end testing
3. Documentation update
4. Prepare for release

---

# INTEGRATION CHECKLIST

Before each sync point, verify:

- [ ] No merge conflicts in owned files
- [ ] All created components export correctly
- [ ] Shared hooks are properly typed
- [ ] API changes are backwards compatible
- [ ] New routes are registered in App.tsx
- [ ] New nav items are added to Layout.tsx
- [ ] All acceptance criteria marked

---

# NOTES FOR FUTURE ITERATIONS

1. **Testing Requirements**
   - All security features need unit tests
   - Seed phrase generation needs cryptographic audit
   - End-to-end tests for critical flows

2. **Performance Considerations**
   - Transaction list pagination for large histories
   - Lazy loading for asset lists
   - Caching of blockchain info

3. **Accessibility**
   - Screen reader support
   - High contrast mode
   - Keyboard navigation

4. **Localization**
   - Prepare strings for i18n
   - RTL language support
   - Multiple wordlists for seed phrases

---

**Document Status:** PARALLEL WORK ENABLED  
**Last Updated:** January 9, 2026  
**Next Sync Point:** Day 3 (After Critical Tasks)
