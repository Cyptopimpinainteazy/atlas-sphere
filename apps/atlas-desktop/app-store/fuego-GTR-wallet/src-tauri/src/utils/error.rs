// Copyright (c) 2024 Fuego Private Banking Network
// Distributed under the MIT/X11 software license

//! Error handling for the wallet
//! 
//! This module defines error types and result aliases used throughout the application.

use thiserror::Error;

/// Wallet result type alias
pub type WalletResult<T> = Result<T, WalletError>;

/// Wallet error types
#[derive(Error, Debug)]
pub enum WalletError {
    #[error("Wallet is not open")]
    WalletNotOpen,
    
    #[error("Wallet is already open")]
    WalletAlreadyOpen,
    
    #[error("Invalid password")]
    InvalidPassword,
    
    #[error("Wallet file not found: {0}")]
    WalletFileNotFound(String),
    
    #[error("Failed to create wallet: {0}")]
    WalletCreationFailed(String),
    
    #[error("Failed to open wallet: {0}")]
    WalletOpenFailed(String),
    
    #[error("Network error: {0}")]
    NetworkError(String),
    
    #[error("Transaction failed: {0}")]
    TransactionFailed(String),
    
    #[error("Invalid address: {0}")]
    InvalidAddress(String),
    
    #[error("Insufficient funds")]
    InsufficientFunds,
    
    #[error("Synchronization failed: {0}")]
    SyncFailed(String),
    
    #[error("Storage error: {0}")]
    StorageError(String),
    
    #[error("Crypto error: {0}")]
    CryptoError(String),
    
    #[error("IO error: {0}")]
    IoError(#[from] std::io::Error),
    
    #[error("Serialization error: {0}")]
    SerializationError(#[from] serde_json::Error),
    
    #[error("String conversion error: {0}")]
    StringError(#[from] std::ffi::NulError),
    
    #[error("Generic error: {0}")]
    Generic(String),
}

impl From<anyhow::Error> for WalletError {
    fn from(err: anyhow::Error) -> Self {
        WalletError::Generic(err.to_string())
    }
}
