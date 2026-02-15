// Copyright (c) 2024 Fuego Private Banking Network
// Distributed under the MIT/X11 software license

//! Cryptographic operations
//! 
//! This module will contain cryptographic utilities and FFI bindings
//! to the existing CryptoNote C++ cryptographic code.

pub mod ffi;
pub mod real_cryptonote;

pub use ffi::CryptoNoteFFI;
pub use real_cryptonote::{RealCryptoNoteWallet, connect_to_fuego_network, fetch_fuego_network_data};
