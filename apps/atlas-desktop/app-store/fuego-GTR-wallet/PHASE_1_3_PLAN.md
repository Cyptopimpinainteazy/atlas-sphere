# Phase 1-3: WalletLegacy Integration Implementation Plan

## Overview
This comprehensive plan focuses on leveraging the existing WalletLegacy C++ implementation from the Fuego codebase to replace our current mock implementations with fully functional wallet operations.

## Goals
- Integrate WalletLegacy C++ classes for real wallet functionality
- Implement comprehensive command set using existing battle-tested code
- Enable full blockchain synchronization with progress reporting
- Provide secure key management and transaction processing
- Maintain high performance with responsive UI operations

## WalletLegacy Architecture Integration

### Available Components
The Fuego codebase provides a complete WalletLegacy implementation:

```
src-tauri/cryptonote/src/WalletLegacy/
├── WalletLegacy.h/cpp              # Main wallet implementation (IWalletLegacy)
├── WalletLegacySerializer.h/cpp    # Wallet file serialization/deserialization
├── WalletTransactionSender.h/cpp   # Transaction creation and sending
├── WalletUserTransactionsCache.h/cpp # Transaction history management
├── WalletUnconfirmedTransactions.h/cpp # Pending transaction tracking
├── WalletHelper.h/cpp              # Utility functions and helpers
├── WalletDepositInfo.h             # Term deposit data structures
├── KeysStorage.h/cpp               # Secure key management and encryption
└── WalletUtils.h                   # Common wallet utilities
```

### Integration Strategy
Replace `fuego_wallet_real.cpp` mock implementation with real WalletLegacy calls:

```cpp
#include "WalletLegacy/WalletLegacy.h"
#include "IWalletLegacy.h"
#include "INode.h"

class RealWalletLegacyWrapper {
    std::unique_ptr<CryptoNote::WalletLegacy> wallet;
    std::unique_ptr<CryptoNote::INode> node;
    std::unique_ptr<CryptoNote::Currency> currency;
    
    // Observer for real-time updates
    std::unique_ptr<WalletLegacyObserver> observer;
    
public:
    // Core wallet operations using WalletLegacy
    bool initAndGenerate(const std::string& password, const Crypto::SecretKey& recovery_key);
    bool initAndLoad(const std::string& password, const std::string& path);
    void shutdown();
    
    // Transaction operations using WalletTransactionSender
    CryptoNote::TransactionId sendTransaction(
        const std::vector<CryptoNote::WalletLegacyTransfer>& transfers,
        uint64_t fee, const std::string& extra, uint64_t mixIn);
        
    // Real transaction history from WalletUserTransactionsCache
    std::vector<CryptoNote::WalletLegacyTransaction> getTransactions(
        size_t offset, size_t count);
        
    // Real deposit operations using WalletDepositInfo
    std::vector<DepositInfo> getDeposits();
    TransactionId createDeposit(uint64_t amount, uint32_t term);
    TransactionId withdrawDeposit(DepositId depositId);
};
```

## Phase 1: Core WalletLegacy Integration (Week 1)

### 1.1 FFI Wrapper Implementation
**Target**: Replace all mock wallet operations with WalletLegacy calls

**Key Implementation Areas**:
```cpp
// fuego_wallet_real.cpp - Replace mock with real WalletLegacy
extern "C" FuegoWallet fuego_wallet_create(
    const char* password,
    const char* file_path,
    const char* seed_phrase,
    uint64_t restore_height
) {
    // Use WalletLegacy::initAndGenerate() or initAndLoad()
    auto wallet = std::make_unique<CryptoNote::WalletLegacy>(currency, node);
    
    if (seed_phrase && strlen(seed_phrase) > 0) {
        // Restore from seed using WalletLegacy restoration
        Crypto::SecretKey private_spend_key;
        // Parse seed phrase to private key
        wallet->initAndGenerate(password, private_spend_key);
    } else {
        // Create new wallet
        wallet->initAndGenerate(password);
    }
    
    return wallet.release();
}
```

### 1.2 Transaction System Integration
**Focus**: Implement real transaction operations using WalletTransactionSender

**Key Commands**:
- `wallet_send_transaction()` → `WalletLegacy::sendTransaction()`
- `wallet_get_transactions()` → `WalletUserTransactionsCache`
- `wallet_get_transaction_by_hash()` → Transaction cache lookup

### 1.3 Balance and Address Operations
**Focus**: Real balance tracking using WalletLegacy state management

**Implementation**:
```cpp
extern "C" uint64_t fuego_wallet_get_balance(FuegoWallet wallet) {
    auto* w = static_cast<CryptoNote::WalletLegacy*>(wallet);
    return w->getActualBalance();
}

extern "C" uint64_t fuego_wallet_get_unlocked_balance(FuegoWallet wallet) {
    auto* w = static_cast<CryptoNote::WalletLegacy*>(wallet);
    return w->getPendingBalance();
}

extern "C" bool fuego_wallet_get_address(FuegoWallet wallet, char* buffer, size_t buffer_size) {
    auto* w = static_cast<CryptoNote::WalletLegacy*>(wallet);
    std::string address = w->getAddress(0); // Primary address
    // Copy to buffer with safety checks
}
```

## Phase 2: Advanced WalletLegacy Features (Week 2)

### 2.1 Deposit System Integration
**Focus**: Implement real term deposits using WalletLegacy deposit functionality

**Key Features**:
- Real deposit creation using WalletLegacy
- Deposit status tracking and maturity calculation
- Withdrawal processing with proper validation

**Implementation**:
```rust
#[tauri::command]
async fn deposit_create(amount: u64, term: u32) -> Result<String, String> {
    tokio::task::spawn_blocking(move || {
        // Use WalletLegacy deposit creation
        let wallet = get_wallet_instance()?;
        let deposit_tx_id = wallet.create_deposit(amount, term);
        Ok(format!("deposit_{}", deposit_tx_id))
    }).await.map_err(|e| e.to_string())?
}

#[tauri::command]
async fn deposit_list() -> Result<Vec<DepositInfo>, String> {
    tokio::task::spawn_blocking(|| {
        // Use WalletLegacy deposit tracking
        let wallet = get_wallet_instance()?;
        let deposits = wallet.get_deposits();
        
        // Convert to our DepositInfo structure
        deposits.into_iter()
            .map(|d| DepositInfo {
                id: d.depositId.to_string(),
                amount: d.amount,
                term: d.term,
                interest: d.interest,
                status: if d.locked { "locked" } else { "unlocked" }.to_string(),
                unlock_height: d.unlockHeight,
                creating_tx_hash: d.creatingTransactionId.to_string(),
            })
            .collect()
    }).await.map_err(|e| e.to_string())?
}
```

### 2.2 Blockchain Synchronization
**Focus**: Real sync progress using WalletLegacy observers

**Key Components**:
- `IWalletLegacyObserver` for sync progress events
- Real blockchain height tracking
- Sync status reporting with accurate progress

**Implementation**:
```cpp
class WalletSyncObserver : public CryptoNote::IWalletLegacyObserver {
    tauri::AppHandle app_handle;
    
public:
    void synchronizationProgressUpdated(uint32_t current, uint32_t total) override {
        // Emit real-time sync progress to frontend
        SyncProgress progress = { current, total };
        app_handle.emit_all("sync_progress", progress);
    }
    
    void actualBalanceUpdated(uint64_t balance) override {
        // Emit balance updates to frontend
        app_handle.emit_all("balance_updated", balance);
    }
};
```

### 2.3 Key Management and Security
**Focus**: Secure operations using KeysStorage

**Security Features**:
- Encrypted key storage using WalletLegacy encryption
- Password change operations
- Memory-safe key handling
- Backup and restore functionality

## Phase 3: Performance and Reliability (Week 3)

### 3.1 Async Operation Wrapper
**Focus**: Make WalletLegacy operations non-blocking

**Implementation Pattern**:
```rust
use tokio::sync::Mutex;
use std::sync::Arc;

static WALLET_INSTANCE: Arc<Mutex<Option<WalletLegacyWrapper>>> = Arc::new(Mutex::new(None));

#[tauri::command]
async fn wallet_send_transaction_async(
    address: String,
    amount: u64,
    payment_id: Option<String>,
    mixin: Option<u64>
) -> Result<String, String> {
    let wallet = WALLET_INSTANCE.lock().await;
    let wallet_ref = wallet.as_ref().ok_or("Wallet not initialized")?;
    
    // Spawn blocking task for WalletLegacy operations
    let tx_hash = tokio::task::spawn_blocking(move || {
        wallet_ref.send_transaction(address, amount, payment_id.unwrap_or_default(), mixin.unwrap_or(0))
    }).await.map_err(|e| e.to_string())??;
    
    Ok(tx_hash)
}
```

### 3.2 Event System Implementation
**Focus**: Real-time wallet events using WalletLegacy observers

**Event Types**:
- `balance_updated` - Real balance changes from WalletLegacy
- `transaction_received` - New incoming transactions
- `sync_progress` - Blockchain synchronization progress
- `deposit_matured` - Term deposit maturity notifications

### 3.3 Error Handling and Recovery
**Focus**: Comprehensive error mapping from WalletLegacy exceptions

**Error Categories**:
```rust
#[derive(Debug, thiserror::Error)]
pub enum WalletLegacyError {
    #[error("Wallet initialization failed: {0}")]
    InitializationFailed(String),
    
    #[error("Transaction failed: {reason}")]
    TransactionFailed { reason: String },
    
    #[error("Network error: {0}")]
    NetworkError(String),
    
    #[error("Insufficient funds: need {need}, have {available}")]
    InsufficientFunds { need: u64, available: u64 },
    
    #[error("Wallet locked or encrypted")]
    WalletLocked,
}
```

## Implementation Timeline

### Week 1: Foundation
- [ ] Set up WalletLegacy FFI wrappers in `fuego_wallet_real.cpp`
- [ ] Implement `initAndGenerate()` and `initAndLoad()` integration
- [ ] Add basic balance and address operations using WalletLegacy
- [ ] Test wallet creation and opening with real functionality

### Week 2: Core Features  
- [ ] Implement transaction sending using `WalletTransactionSender`
- [ ] Add transaction history using `WalletUserTransactionsCache`
- [ ] Integrate deposit system using WalletLegacy deposit functionality
- [ ] Add blockchain sync with `IWalletLegacyObserver`

### Week 3: Advanced Integration
- [ ] Implement async wrappers for all WalletLegacy operations
- [ ] Add comprehensive error handling and recovery
- [ ] Implement real-time event system
- [ ] Add key management and security operations

### Week 4: Testing and Optimization
- [ ] Comprehensive integration testing
- [ ] Performance optimization and memory management
- [ ] Security audit of key handling
- [ ] Documentation and final polish

## Testing Strategy

### Integration Tests
```rust
#[cfg(test)]
mod wallet_legacy_tests {
    #[tokio::test]
    async fn test_wallet_lifecycle() {
        // Test create -> open -> operations -> close cycle
        let password = "test_password";
        let path = "/tmp/test_wallet";
        
        // Create wallet using WalletLegacy
        let result = wallet_create(password, path, None, None).await;
        assert!(result.is_ok());
        
        // Test balance retrieval
        let balance = wallet_get_balance().await.unwrap();
        assert_eq!(balance, 0);
        
        // Test address generation
        let address = wallet_get_address().await.unwrap();
        assert!(address.starts_with("fire"));
    }
    
    #[tokio::test]
    async fn test_transaction_operations() {
        // Test real transaction sending using WalletLegacy
    }
    
    #[tokio::test]
    async fn test_deposit_operations() {
        // Test deposit creation and withdrawal
    }
}
```

### Performance Benchmarks
- Wallet creation time: < 2 seconds
- Transaction sending time: < 5 seconds  
- Balance retrieval time: < 100ms
- Sync progress updates: Real-time (< 1 second delay)

## Risk Mitigation

### Technical Risks
- **WalletLegacy Complexity**: Integration with existing C++ code is complex
- **Mitigation**: Start with simple operations, build incrementally, extensive testing

### Performance Risks
- **Blocking Operations**: WalletLegacy operations may block the UI
- **Mitigation**: All operations wrapped in `tokio::task::spawn_blocking`

### Security Risks
- **Key Exposure**: Risk of exposing private keys in memory or logs
- **Mitigation**: Follow WalletLegacy security patterns, audit memory usage

## Success Criteria

### Functional Requirements
- ✅ Real wallet creation and file management using WalletLegacy
- ✅ Actual transaction sending and receiving with proper validation
- ✅ Real blockchain synchronization with progress reporting
- ✅ Working term deposit system with maturity tracking
- ✅ Comprehensive transaction history and search

### Performance Requirements
- ✅ All wallet operations complete within acceptable time limits
- ✅ UI remains responsive during all operations
- ✅ Memory usage stays under 100MB for typical operations
- ✅ Real-time sync progress and event updates

### Security Requirements
- ✅ Keys encrypted and stored securely using WalletLegacy encryption
- ✅ No sensitive data exposure in memory after operations
- ✅ All input validation to prevent attacks
- ✅ Secure transaction construction and validation

---

# WalletLegacy Command Implementation Plan

## Command Mapping Strategy
Map all existing Tauri commands to use WalletLegacy C++ implementation instead of mocks, ensuring full compatibility and enhanced functionality.

## Core Command Implementation Using WalletLegacy

### Wallet Lifecycle Commands
```rust
// Replace mock implementations with WalletLegacy calls
#[tauri::command]
async fn wallet_create(
    password: String,
    file_path: String,
    seed_phrase: Option<String>,
    restore_height: Option<u64>
) -> Result<String, String> {
    tokio::task::spawn_blocking(move || {
        // Use WalletLegacy::initAndGenerate() or restore from seed
        let wallet = create_wallet_legacy_instance();
        if let Some(seed) = seed_phrase {
            wallet.init_and_load_from_seed(password, seed, restore_height.unwrap_or(0))
        } else {
            wallet.init_and_generate(password, file_path)
        }
        // Return primary address from WalletLegacy
    }).await.map_err(|e| e.to_string())?
}

#[tauri::command]
async fn wallet_open(file_path: String, password: String) -> Result<String, String> {
    tokio::task::spawn_blocking(move || {
        // Use WalletLegacy::initAndLoad()
        let wallet = get_wallet_legacy_instance();
        wallet.init_and_load(file_path, password)?;
        Ok(wallet.get_address(0)) // Primary address
    }).await.map_err(|e| e.to_string())?
}

#[tauri::command]
async fn wallet_close() -> Result<(), String> {
    tokio::task::spawn_blocking(|| {
        // Use WalletLegacy::shutdown()
        let wallet = get_wallet_legacy_instance();
        wallet.shutdown();
        Ok(())
    }).await.map_err(|e| e.to_string())?
}
```

### Transaction Commands Using WalletLegacy
```rust
#[tauri::command]
async fn wallet_send_transaction(
    recipient: String,
    amount: u64,
    payment_id: Option<String>,
    mixin: Option<u64>
) -> Result<String, String> {
    tokio::task::spawn_blocking(move || {
        // Use WalletLegacy::sendTransaction() with real validation
        let wallet = get_wallet_legacy_instance();
        
        let transfers = vec![WalletLegacyTransfer {
            address: recipient,
            amount: amount as i64,
        }];
        
        let tx_id = wallet.send_transaction(
            transfers,
            0, // fee (auto-calculated)
            payment_id.unwrap_or_default(),
            mixin.unwrap_or(0)
        )?;
        
        // Get transaction hash from WalletLegacy
        let tx_hash = wallet.get_transaction(tx_id).hash;
        Ok(format!("{:?}", tx_hash))
    }).await.map_err(|e| e.to_string())?
}

#[tauri::command]
async fn wallet_get_transactions(
    limit: Option<u64>,
    offset: Option<u64>
) -> Result<Vec<TransactionInfo>, String> {
    tokio::task::spawn_blocking(move || {
        // Use WalletUserTransactionsCache for real transaction history
        let wallet = get_wallet_legacy_instance();
        let transactions = wallet.get_transactions(
            offset.unwrap_or(0) as usize,
            limit.unwrap_or(50) as usize
        );
        
        // Convert WalletLegacyTransaction to our TransactionInfo
        transactions.into_iter()
            .map(|tx| TransactionInfo {
                id: format!("{}", tx.firstTransferId),
                hash: format!("{:?}", tx.hash),
                amount: tx.totalAmount as u64,
                fee: tx.fee,
                timestamp: tx.timestamp,
                height: tx.blockHeight,
                is_confirmed: tx.
