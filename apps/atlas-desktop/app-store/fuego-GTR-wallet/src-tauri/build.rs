// Copyright (c) 2024 Fuego Private Banking Network
// Distributed under the MIT/X11 software license

//! Build script for compiling C++ FFI library

use std::env;
use std::path::Path;

fn main() {
    // Prefer vendored cryptonote if present and ENABLE_VENDORED_CRYPTONOTE is set
    let use_vendored = env::var("ENABLE_VENDORED_CRYPTONOTE").ok().as_deref() == Some("1");
    let vendored_exists = Path::new("cryptonote/include").exists() || Path::new("./src-tauri/cryptonote/include").exists();

    if use_vendored && vendored_exists {
        if build_with_vendored_cryptonote() {
            println!("cargo:warning=Using vendored cryptonote sources");
            return;
        }
    }

    // Try to build real Fuego wallet minimal implementation
    if build_real_fuego_wallet() {
        println!("cargo:warning=Using real Fuego wallet implementation");
        return;
    }
    
    // Fallback to mock implementation
    println!("cargo:warning=Using mock CryptoNote implementation for development");
    build_mock_ffi();
}

fn build_real_fuego_wallet() -> bool {
    // Compile the real Fuego wallet library
    cc::Build::new()
        .cpp(true)
        .std("c++14")
        .file("fuego_wallet_real.cpp")
        .include(".")
        .compile("fuego_wallet_real");
    
    // Link the real Fuego wallet library
    println!("cargo:rustc-link-lib=fuego_wallet_real");
    
    // Compile the C++ FFI library with real Fuego includes
    cc::Build::new()
        .cpp(true)
        .std("c++14")
        .file("crypto_note_ffi.cpp")
        .include(".")
        .include("cryptonote/include")
        .compile("crypto_note_ffi");
    
    // Tell cargo to rerun this build script if files change
    println!("cargo:rerun-if-changed=fuego_wallet_real.cpp");
    println!("cargo:rerun-if-changed=fuego_wallet_real.h");
    println!("cargo:rerun-if-changed=crypto_note_ffi.cpp");
    println!("cargo:rerun-if-changed=crypto_note_ffi.h");
    println!("cargo:rerun-if-changed=cryptonote/");
    
    // Link system libraries
    if cfg!(target_os = "macos") {
        println!("cargo:rustc-link-lib=c++");
    } else if cfg!(target_os = "linux") {
        println!("cargo:rustc-link-lib=stdc++");
        println!("cargo:rustc-link-lib=pthread");
        println!("cargo:rustc-link-lib=resolv");
    } else if cfg!(target_os = "windows") {
        // Windows linking handled by MSVC
    }
    
    true
}

fn build_with_vendored_cryptonote() -> bool {
    // Root for vendored cryptonote
    let include_root = if Path::new("cryptonote/include").exists() { "cryptonote/include" } else { "src-tauri/cryptonote/include" };
    let src_root = if Path::new("cryptonote/src").exists() { "cryptonote/src" } else { "src-tauri/cryptonote/src" };

    // Build fuego wallet shim
    cc::Build::new()
        .cpp(true)
        .std("c++14")
        .file("fuego_wallet_real.cpp")
        .include(".")
        .include(include_root)
        .compile("fuego_wallet_real");
    println!("cargo:rustc-link-lib=fuego_wallet_real");

    // Build ffi layer
    cc::Build::new()
        .cpp(true)
        .std("c++14")
        .file("crypto_note_ffi.cpp")
        .include(".")
        .include(include_root)
        .compile("crypto_note_ffi");

    // Minimal: Ask cargo to rerun when these change
    println!("cargo:rerun-if-changed=fuego_wallet_real.cpp");
    println!("cargo:rerun-if-changed=fuego_wallet_real.h");
    println!("cargo:rerun-if-changed=crypto_note_ffi.cpp");
    println!("cargo:rerun-if-changed=crypto_note_ffi.h");
    println!("cargo:rerun-if-changed={}", include_root);
    println!("cargo:rerun-if-changed={}", src_root);

    // System libs
    if cfg!(target_os = "macos") {
        println!("cargo:rustc-link-lib=c++");
    } else if cfg!(target_os = "linux") {
        println!("cargo:rustc-link-lib=stdc++");
        println!("cargo:rustc-link-lib=pthread");
        println!("cargo:rustc-link-lib=resolv");
    }

    true
}

fn build_mock_ffi() {
    // Fallback to mock implementation
    println!("cargo:rustc-link-lib=crypto_note_ffi");
    
    cc::Build::new()
        .cpp(true)
        .std("c++14")
        .file("crypto_note_ffi.cpp")
        .include(".")
        .compile("crypto_note_ffi");
    
    let out_dir = env::var("OUT_DIR").unwrap();
    println!("cargo:rustc-link-search=native={}", out_dir);
    
    if cfg!(target_os = "macos") {
        println!("cargo:rustc-link-lib=c++");
    } else if cfg!(target_os = "linux") {
        println!("cargo:rustc-link-lib=stdc++");
    }
}