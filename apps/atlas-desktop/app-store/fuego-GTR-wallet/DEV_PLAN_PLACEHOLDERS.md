# Development Plan: WalletLegacy Integration & Command Implementation

## Overview
This plan focuses on integrating the existing WalletLegacy C++ implementation from the Fuego codebase to provide real wallet functionality, commands, and features through our Tauri FFI layer.

## Goals
- Replace placeholder implementations with real WalletLegacy integration
- Implement comprehensive wallet commands using existing C++ functionality
- Ensure full compatibility with Fuego blockchain operations
- Maintain security and performance while providing rich wallet features

## WalletLegacy Architecture Analysis

### Core Components Available
```
src-tauri/cryptonote/src/WalletLegacy/
├── WalletLegacy.h/cpp              # Main wallet implementation
├── WalletLegacySerializer.h/cpp    # Wallet serialization
├── WalletTransactionSender.h/cpp   # Transaction handling
├── WalletUserTransactionsCache.h/cpp # Transaction cache management
├── WalletUnconfirmedTransactions.h/cpp # Pending transaction tracking
├── WalletHelper.h/cpp              # Utility functions
├── WalletDepositInfo.h             # Term deposit structures
├── KeysStorage.h/cpp               # Key management
└── WalletUtils.h                   # Common utilities
```

### Key Interfaces
- `IWalletLegacy` - Primary wallet interface
- `IWalletLegacyObserver` - Event handling for sync/balance updates
- `WalletLegacyTransaction` - Transaction data structures
- `WalletLegacyTransfer` - Transfer information
- `DepositId` - Term deposit management

## Phase 1: Core WalletLegacy Integration

### 1.1 FFI Wrapper Implementation
**Target**: Replace mock implementations with real WalletLegacy calls

**Files to Modify**:
- `src-tauri/fuego_wallet_real.cpp`
- `src-tauri/fuego_wallet_real.h`

**Implementation Strategy**:
```cpp
// Replace current mock with real WalletLegacy instance
class RealFuegoWallet {
    std::unique_ptr<CryptoNote::WalletLegacy> wallet;
    std::unique_ptr<CryptoNote::INode> node;
    
public:
    // Real wallet operations
    bool create_wallet(const std::string& path, const std::string& password);
    bool open_wallet(const std::string& path, const std::string& password);
    void close_wallet();
    
    // Real balance and address operations
    uint64_t get_balance();
    uint64_t get_unlocked_balance(); 
    std::string get_address();
    
    // Real transaction operations
    std::string send_transaction(const std::string& address, uint64_t amount, 
                               const std::string& payment_id, uint64_t mixin);
    std::vector<WalletLegacyTransaction> get_transactions(size_t count, size_t offset);
    
    // Real network operations
    bool connect_to_node(const std::string& address, uint16_t port);
    NetworkStatus get_network_status();
    
    // Real deposit operations
    std::vector<DepositInfo> get_deposits();
    std::string create_deposit(uint64_t amount, uint32_t term);
    std::string withdraw_deposit(const std::string& deposit_id);
};
```

### 1.2 Transaction Management
**Focus**: Implement real transaction history and management

**Key WalletLegacy Features to Integrate**:
- `WalletUserTransactionsCache` - for transaction history
- `WalletUnconfirmedTransactions` - for pending transactions
- `WalletTransactionSender` - for sending transactions

**Commands to Implement**:
```rust
// In src-tauri/src/lib.rs
#[tauri::command]
async fn wallet_get_transactions(
    count: Option<u64>,
    offset: Option<u64>
) -> Result<Vec<TransactionInfo>, String> {
    // Use WalletLegacy::getTransactions()
    // Parse WalletLegacyTransaction to TransactionInfo
}

#[tauri::command]
async fn wallet_get_transaction_by_hash(
    hash: String
) -> Result<TransactionInfo, String> {
    // Use WalletLegacy transaction cache lookup
}

#[tauri::command]
async fn wallet_get_unconfirmed_transactions() -> Result<Vec<TransactionInfo>, String> {
    // Use WalletUnconfirmedTransactions
}
```

### 1.3 Address Management
**Focus**: Implement comprehensive address operations

**WalletLegacy Address Features**:
- Primary address generation
- Address validation
- Multiple address support (if available)

**Commands to Implement**:
```rust
#[tauri::command]
async fn wallet_validate_address(address: String) -> Result<bool, String> {
    // Use CryptoNote address validation functions
}

#[tauri::command]
async fn wallet_get_address_info() -> Result<AddressInfo, String> {
    // Return comprehensive address information
}
```

## Phase 2: Advanced WalletLegacy Features

### 2.1 Deposit System Integration
**Focus**: Implement real term deposit functionality using WalletLegacy

**Key Components**:
- `WalletDepositInfo.h` structures
- Deposit creation and withdrawal through WalletLegacy
- Deposit status tracking

**Enhanced Commands**:
```rust
#[tauri::command]
async fn deposit_get_available_terms() -> Result<Vec<DepositTerm>, String> {
    // Return available deposit terms from network
}

#[tauri::command]
async fn deposit_calculate_interest(
    amount: u64, 
    term: u32
) -> Result<DepositCalculation, String> {
    // Calculate expected returns
}

#[tauri::command]
async fn deposit_get_history() -> Result<Vec<DepositInfo>, String> {
    // Get complete deposit transaction history
}
```

### 2.2 Wallet Synchronization
**Focus**: Implement real blockchain sync using WalletLegacy observers

**Key Features**:
- `IWalletLegacyObserver` for sync progress
- Real blockchain synchronization status
- Sync progress reporting

**Commands to Implement**:
```rust
#[tauri::command]
async fn wallet_get_sync_status() -> Result<SyncStatus, String> {
    // Real sync progress from WalletLegacy
}

#[tauri::command]
async fn wallet_start_sync() -> Result<(), String> {
    // Start blockchain synchronization
}

#[tauri::command]
async fn wallet_rescan_from_height(height: u64) -> Result<(), String> {
    // Rescan blockchain from specific height
}
```

### 2.3 Key Management
**Focus**: Secure key operations using WalletLegacy key storage

**Key Components**:
- `KeysStorage` for secure key management
- Wallet encryption/decryption
- Backup and restore operations

**Security Commands**:
```rust
#[tauri::command]
async fn wallet_change_password(
    old_password: String,
    new_password: String
) -> Result<(), String> {
    // Change wallet password using WalletLegacy
}

#[tauri::command]
async fn wallet_export_keys() -> Result<KeyExport, String> {
    // Export wallet keys securely
}

#[tauri::command]
async fn wallet_get_mnemonic() -> Result<String, String> {
    // Get mnemonic seed phrase if available
}
```

## Phase 3: Performance & Reliability

### 3.1 Async Operations
**Focus**: Make WalletLegacy operations non-blocking

**Implementation**:
```rust
// Wrap WalletLegacy calls in tokio tasks
use tokio::task;

#[tauri::command]
async fn wallet_send_transaction_async(
    address: String,
    amount: u64,
    payment_id: Option<String>,
    mixin: Option<u64>
) -> Result<String, String> {
    task::spawn_blocking(move || {
        // Call WalletLegacy send transaction
        // Return transaction hash
    }).await.map_err(|e| e.to_string())?
}
```

### 3.2 Error Handling
**Focus**: Map WalletLegacy exceptions to user-friendly errors

**Error Categories**:
- Network errors (connection failed, sync failed)
- Wallet errors (insufficient funds, invalid address)
- System errors (file access, permissions)

**Implementation**:
```rust
#[derive(Debug, thiserror::Error)]
pub enum WalletLegacyError {
    #[error("Network error: {0}")]
    Network(String),
    
    #[error("Insufficient funds: need {need}, have {available}")]
    InsufficientFunds { need: u64, available: u64 },
    
    #[error("Invalid address: {0}")]
    InvalidAddress(String),
    
    #[error("Wallet is locked or corrupted")]
    WalletLocked,
}
```

### 3.3 Event System
**Focus**: Implement real-time wallet events using WalletLegacy observers

**Event Types**:
- Balance updates
- New transactions
- Sync progress
- Network status changes

**Implementation**:
```rust
// WebSocket or event emission to frontend
use tauri::Manager;

struct WalletEventHandler {
    app: tauri::AppHandle,
}

impl IWalletLegacyObserver for WalletEventHandler {
    fn actualBalanceUpdated(&self, balance: u64) {
        self.app.emit_all("balance_updated", balance).unwrap();
    }
    
    fn synchronizationProgressUpdated(&self, current: u32, total: u32) {
        self.app.emit_all("sync_progress", SyncProgress { current, total }).unwrap();
    }
}
```

## Phase 4: Testing & Validation

### 4.1 Integration Tests
**Focus**: Test WalletLegacy integration thoroughly

**Test Categories**:
```rust
#[cfg(test)]
mod tests {
    #[tokio::test]
    async fn test_wallet_creation() {
        // Test real wallet creation with WalletLegacy
    }
    
    #[tokio::test]
    async fn test_transaction_sending() {
        // Test real transaction operations
    }
    
    #[tokio::test]
    async fn test_deposit_operations() {
        // Test term deposit creation and withdrawal
    }
    
    #[tokio::test]
    async fn test_sync_operations() {
        // Test blockchain synchronization
    }
}
```

### 4.2 Performance Testing
**Metrics to Track**:
- Wallet opening time
- Transaction creation time
- Sync speed
- Memory usage
- Response times for commands

### 4.3 Security Validation
**Security Checks**:
- Key storage encryption
- Memory cleanup
- Network communication security
- Input validation

## Implementation Timeline

### Week 1: Foundation
- [ ] Set up WalletLegacy FFI wrappers
- [ ] Implement basic wallet operations (create, open, close)
- [ ] Test basic functionality

### Week 2: Core Features
- [ ] Implement transaction operations
- [ ] Add address management
- [ ] Implement network operations

### Week 3: Advanced Features
- [ ] Add deposit system
- [ ] Implement sync operations
- [ ] Add key management

### Week 4: Polish & Testing
- [ ] Async operations
- [ ] Error handling
- [ ] Event system
- [ ] Performance optimization

## Success Criteria

### Functional Requirements
- ✅ Real wallet creation and management using WalletLegacy
- ✅ Actual transaction sending and receiving
- ✅ Real blockchain synchronization
- ✅ Working term deposit system
- ✅ Comprehensive address management

### Performance Requirements
- ✅ Wallet operations complete within 2 seconds
- ✅ UI remains responsive during operations
- ✅ Memory usage stays under 100MB
- ✅ Sync progress updates in real-time

### Security Requirements
- ✅ Keys are encrypted and secure
- ✅ No sensitive data in memory after operations
- ✅ Network communications are secure
- ✅ Input validation prevents attacks

## Migration Strategy

### From Current Mock Implementation
1. **Gradual Replacement**: Replace one component at a time
2. **Fallback Support**: Keep mock implementations as fallback
3. **Feature Flags**: Use feature flags to toggle implementations
4. **Testing**: Extensive testing at each step

### Compatibility
- **Maintain API**: Keep existing Tauri command signatures
- **Data Migration**: Migrate any existing wallet files
- **Configuration**: Update configuration for WalletLegacy requirements

## Risk Mitigation

### Technical Risks
- **Complexity**: WalletLegacy integration is complex
- **Mitigation**: Start with simple operations, build incrementally

### Security Risks
- **Key Exposure**: Risk of exposing private keys
- **Mitigation**: Follow WalletLegacy security patterns, audit code

### Performance Risks
- **Blocking Operations**: WalletLegacy operations may block
- **Mitigation**: Use async wrappers and progress reporting

## Conclusion

This plan transforms the Fuego GTR Wallet from a mock implementation to a fully functional wallet using the proven WalletLegacy codebase. By leveraging existing, battle-tested code, we ensure reliability and security while providing comprehensive wallet functionality.

The phased approach allows for incremental development and testing, reducing risk while building towards a complete wallet solution that matches or exceeds the capabilities of existing Fuego wallet implementations.