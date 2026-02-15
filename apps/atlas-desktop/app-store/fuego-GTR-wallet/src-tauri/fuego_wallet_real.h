// Copyright (c) 2024 Fuego Private Banking Network
// Distributed under the MIT/X11 software license

//! Real Fuego wallet implementation
//! 
//! This header provides real CryptoNote wallet operations for the Fuego network.

#ifndef FUEGO_WALLET_REAL_H
#define FUEGO_WALLET_REAL_H

#ifdef __cplusplus
extern "C" {
#endif

#include <stdint.h>
#include <stdbool.h>
#include <stddef.h>

// Forward declarations
typedef void* FuegoWallet;
typedef void* TransactionResult;
typedef void* TransactionList;

// Network status structure
typedef struct {
    bool is_connected;
    uint64_t peer_count;
    uint64_t sync_height;
    uint64_t network_height;
    bool is_syncing;
    char connection_type[256];
} NetworkStatus;

// Advanced data structures for real CryptoNote integration
typedef struct {
    char address[256];
    uint64_t balance;
    uint64_t unlocked_balance;
    uint64_t locked_balance;
    uint64_t total_received;
    uint64_t total_sent;
    uint32_t transaction_count;
    bool is_synced;
    uint64_t sync_height;
    uint64_t network_height;
    uint64_t daemon_height;
    bool is_connected;
    uint32_t peer_count;
    uint64_t last_block_time;
} WalletInfo;

typedef struct {
    char id[256];
    char hash[256];
    int64_t amount;
    uint64_t fee;
    uint64_t height;
    uint64_t timestamp;
    uint32_t confirmations;
    bool is_confirmed;
    bool is_pending;
    char payment_id[256];
    char destination_addresses[1024];
    char source_addresses[1024];
    uint64_t unlock_time;
    char extra[1024];
} TransactionInfo;

typedef struct {
    bool is_connected;
    uint32_t peer_count;
    uint64_t sync_height;
    uint64_t network_height;
    bool is_syncing;
    char connection_type[256];
    uint64_t last_sync_time;
    double sync_speed;
    uint64_t estimated_sync_time;
} NetworkInfo;

typedef struct {
    uint64_t height;
    char hash[256];
    uint64_t timestamp;
    uint64_t difficulty;
    uint64_t reward;
    uint32_t size;
    uint32_t transaction_count;
    bool is_main_chain;
} BlockInfo;

typedef struct {
    bool is_mining;
    double hashrate;
    uint64_t difficulty;
    uint64_t block_reward;
    char pool_address[256];
    char worker_name[256];
    uint32_t threads;
} MiningInfo;

// Sync progress event structure
typedef struct {
    uint64_t current_height;
    uint64_t total_height;
    float progress_percentage;
    uint64_t estimated_time_remaining;
    bool is_syncing;
} SyncProgress;

// Wallet creation and management
FuegoWallet fuego_wallet_create(
    const char* password,
    const char* file_path,
    const char* seed_phrase,
    uint64_t restore_height
);

FuegoWallet fuego_wallet_open(
    const char* file_path,
    const char* password
);

void fuego_wallet_close(FuegoWallet wallet);

bool fuego_wallet_is_open(FuegoWallet wallet);

// Wallet information
uint64_t fuego_wallet_get_balance(FuegoWallet wallet);

uint64_t fuego_wallet_get_unlocked_balance(FuegoWallet wallet);

bool fuego_wallet_get_address(
    FuegoWallet wallet,
    char* buffer,
    size_t buffer_size
);

// Transaction operations
TransactionResult fuego_wallet_send_transaction(
    FuegoWallet wallet,
    const char* address,
    uint64_t amount,
    const char* payment_id,
    uint64_t mixin
);

TransactionList fuego_wallet_get_transactions(
    FuegoWallet wallet,
    uint64_t limit,
    uint64_t offset
);

// Get real transaction history from blockchain
TransactionInfo* fuego_wallet_get_transaction_history(
    FuegoWallet wallet,
    uint64_t limit,
    uint64_t offset
);
void fuego_wallet_free_transaction_history(TransactionInfo* tx);

// Network operations
bool fuego_wallet_connect_node(
    FuegoWallet wallet,
    const char* address,
    uint16_t port
);

NetworkStatus* fuego_wallet_get_network_status(FuegoWallet wallet);

// Memory management for NetworkStatus
void fuego_wallet_free_network_status(NetworkStatus* status);

// Additional network/wallet operations (stubs to satisfy FFI)
bool fuego_wallet_disconnect_node(FuegoWallet wallet);
bool fuego_wallet_refresh(FuegoWallet wallet);
bool fuego_wallet_rescan_blockchain(FuegoWallet wallet, uint64_t start_height);
uint64_t fuego_wallet_estimate_transaction_fee(
    FuegoWallet wallet,
    const char* address,
    uint64_t amount,
    uint64_t mixin
);

// Deposit operations
void* fuego_wallet_get_deposits(FuegoWallet wallet);
void* fuego_wallet_create_deposit(FuegoWallet wallet, uint64_t amount, uint32_t term);
void* fuego_wallet_withdraw_deposit(FuegoWallet wallet, const char* deposit_id);

// ===== PHASE 2: ADVANCED CRYPTONOTE INTEGRATION =====

// Get comprehensive wallet information
WalletInfo* fuego_wallet_get_wallet_info(FuegoWallet wallet);
void fuego_wallet_free_wallet_info(WalletInfo* info);

// Get detailed network information
NetworkInfo* fuego_wallet_get_network_info(FuegoWallet wallet);
void fuego_wallet_free_network_info(NetworkInfo* info);

// Transaction management
TransactionInfo* fuego_wallet_get_transaction_by_hash(FuegoWallet wallet, const char* tx_hash);
TransactionInfo* fuego_wallet_get_transaction_by_id(FuegoWallet wallet, const char* tx_id);
void fuego_wallet_free_transaction_info(TransactionInfo* tx);
bool fuego_wallet_cancel_transaction(FuegoWallet wallet, const char* tx_id);

// Address management
char* fuego_wallet_create_address(FuegoWallet wallet, const char* label);
void* fuego_wallet_get_addresses(FuegoWallet wallet);
void fuego_wallet_free_addresses(void* addresses);
bool fuego_wallet_delete_address(FuegoWallet wallet, const char* address);
bool fuego_wallet_set_address_label(FuegoWallet wallet, const char* address, const char* label);

// Blockchain operations
BlockInfo* fuego_wallet_get_block_info(FuegoWallet wallet, uint64_t height);
BlockInfo* fuego_wallet_get_block_by_hash(FuegoWallet wallet, const char* block_hash);
void fuego_wallet_free_block_info(BlockInfo* block);
uint64_t fuego_wallet_get_current_block_height(FuegoWallet wallet);
uint64_t fuego_wallet_get_block_timestamp(FuegoWallet wallet, uint64_t height);

// Mining operations
bool fuego_wallet_start_mining(FuegoWallet wallet, uint32_t threads, bool background);
bool fuego_wallet_stop_mining(FuegoWallet wallet);
MiningInfo* fuego_wallet_get_mining_info(FuegoWallet wallet);
void fuego_wallet_free_mining_info(MiningInfo* info);
bool fuego_wallet_set_mining_pool(FuegoWallet wallet, const char* pool_address, const char* worker_name);

// Mining statistics functions
char* fuego_wallet_get_mining_stats_json(FuegoWallet wallet);
void fuego_wallet_free_mining_stats_json(char* json_str);

// Secure key management functions
char* fuego_wallet_generate_seed_phrase();
bool fuego_wallet_validate_seed_phrase(const char* seed_phrase);
bool fuego_wallet_derive_keys_from_seed(FuegoWallet wallet, const char* seed_phrase, const char* password);
char* fuego_wallet_get_seed_phrase(FuegoWallet wallet, const char* password);
char* fuego_wallet_get_view_key(FuegoWallet wallet);
char* fuego_wallet_get_spend_key(FuegoWallet wallet);
bool fuego_wallet_has_keys(FuegoWallet wallet);
char* fuego_wallet_export_keys(FuegoWallet wallet);
bool fuego_wallet_import_keys(FuegoWallet wallet, const char* view_key, const char* spend_key, const char* address);
void fuego_wallet_free_key_string(char* key_str);

// Sync progress functions
SyncProgress* fuego_wallet_get_sync_progress(FuegoWallet wallet);
void fuego_wallet_free_sync_progress(SyncProgress* progress);
char* fuego_wallet_get_sync_status_json(FuegoWallet wallet);
void fuego_wallet_free_sync_status_json(char* json_str);

// Address book management
bool fuego_wallet_add_address_book_entry(FuegoWallet wallet, const char* address, const char* label, const char* description);
bool fuego_wallet_remove_address_book_entry(FuegoWallet wallet, const char* address);
bool fuego_wallet_update_address_book_entry(FuegoWallet wallet, const char* address, const char* label, const char* description);
void* fuego_wallet_get_address_book(FuegoWallet wallet);
void fuego_wallet_free_address_book(void* address_book_ptr);
bool fuego_wallet_mark_address_used(FuegoWallet wallet, const char* address);
char* fuego_wallet_get_address_book_entry(FuegoWallet wallet, const char* address);
void fuego_wallet_free_address_book_entry(char* json_str);

// Utility functions
void fuego_wallet_free_string(char* s);
void fuego_wallet_free_transactions(TransactionList txs);
void fuego_wallet_free_network_status(NetworkStatus* status);

#ifdef __cplusplus
}
#endif

#endif // FUEGO_WALLET_REAL_H
