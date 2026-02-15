// Copyright (c) 2024 Fuego Private Banking Network
// Distributed under the MIT/X11 software license

//! C FFI wrapper for CryptoNote C++ wallet
//! 
//! This header provides C-compatible functions to interface with the CryptoNote C++ wallet.

#ifndef CRYPTO_NOTE_FFI_H
#define CRYPTO_NOTE_FFI_H

#ifdef __cplusplus
extern "C" {
#endif

#include <stdint.h>
#include <stdbool.h>
#include <stddef.h>

// Forward declarations
typedef void* CryptoNoteWallet;
typedef void* TransactionResult;
typedef void* TransactionList;
typedef void* NetworkStatus;

// Wallet creation and management
CryptoNoteWallet crypto_note_wallet_create(
    const char* password,
    const char* file_path,
    const char* seed_phrase,
    uint64_t restore_height
);

CryptoNoteWallet crypto_note_wallet_open(
    const char* file_path,
    const char* password
);

void crypto_note_wallet_close(CryptoNoteWallet wallet);

bool crypto_note_wallet_is_open(CryptoNoteWallet wallet);

// Wallet information
uint64_t crypto_note_wallet_get_balance(CryptoNoteWallet wallet);

uint64_t crypto_note_wallet_get_unlocked_balance(CryptoNoteWallet wallet);

bool crypto_note_wallet_get_address(
    CryptoNoteWallet wallet,
    char* buffer,
    size_t buffer_size
);

// Transaction operations
TransactionResult crypto_note_wallet_send_transaction(
    CryptoNoteWallet wallet,
    const char* address,
    uint64_t amount,
    const char* payment_id,
    uint64_t mixin
);

TransactionList crypto_note_wallet_get_transactions(
    CryptoNoteWallet wallet,
    uint64_t limit,
    uint64_t offset
);

// Network operations
bool crypto_note_wallet_connect_node(
    CryptoNoteWallet wallet,
    const char* address,
    uint16_t port
);

NetworkStatus crypto_note_wallet_get_network_status(CryptoNoteWallet wallet);

// Utility functions
void crypto_note_wallet_free_string(char* s);
void crypto_note_wallet_free_transactions(TransactionList txs);
void crypto_note_wallet_free_network_status(NetworkStatus status);

#ifdef __cplusplus
}
#endif

#endif // CRYPTO_NOTE_FFI_H
