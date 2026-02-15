# Building Mynta Wallet

This document describes how to build the Mynta Wallet from source on a clean Linux machine.

## Prerequisites

### System Dependencies (Debian/Ubuntu)

```bash
# Core build tools
sudo apt-get update
sudo apt-get install -y build-essential libtool autotools-dev automake pkg-config bsdmainutils python3

# Mynta Core dependencies
sudo apt-get install -y libssl-dev libevent-dev libboost-system-dev libboost-filesystem-dev \
    libboost-chrono-dev libboost-test-dev libboost-thread-dev libdb5.3-dev libdb5.3++-dev

# Tauri/Rust dependencies
sudo apt-get install -y libwebkit2gtk-4.1-dev libappindicator3-dev librsvg2-dev patchelf

# Install Rust (if not already installed)
curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh -s -- -y
source ~/.cargo/env

# Install Node.js (v18+ recommended)
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt-get install -y nodejs
```

## Build Steps

### 1. Build Mynta Core Daemon

```bash
cd mynta-core

# Generate build system
./autogen.sh

# Configure (adjust options as needed)
./configure --without-gui --without-miniupnpc

# Build
make -j$(nproc)

# Verify daemon branding
./src/myntad --version
# Should output: "Mynta Core Daemon version v4.x.x"
```

### 2. Copy Daemon to Wallet Sidecar Location

```bash
# Copy the daemon binary to the wallet's sidecar location
# The filename must include the target triple
TARGET=$(rustc -vV | grep host | awk '{print $2}')
cp mynta-core/src/myntad mynta-wallet/src-tauri/binaries/myntad-$TARGET
cp mynta-core/src/mynta-cli mynta-wallet/src-tauri/binaries/mynta-cli-$TARGET

# Make executable
chmod +x mynta-wallet/src-tauri/binaries/*
```

### 3. Build Mynta Wallet

```bash
cd mynta-wallet

# Install npm dependencies
npm install

# Build the Tauri application
npm run tauri build
```

The built application will be in `mynta-wallet/src-tauri/target/release/bundle/`:
- `deb/` - Debian package
- `appimage/` - AppImage (portable Linux)

## Verification

### Verify Sidecar Branding

```bash
mynta-wallet/src-tauri/binaries/myntad-$(rustc -vV | grep host | awk '{print $2}') --version
```

Expected output should contain "Mynta" and NOT "Raven".

### Verify Default Datadir

```bash
mkdir -p /tmp/mynta-test
mynta-core/src/myntad -datadir=/tmp/mynta-test -printtoconsole=1 2>&1 | grep -E "(data directory|config file)"
```

Expected output:
- Default data directory: `~/.mynta`
- Config file: `mynta.conf`

### Verify Ports

Expected default ports:
- **Mainnet P2P**: 8770
- **Mainnet RPC**: 8766
- **Testnet P2P**: 18770
- **Testnet RPC**: 18766
- **Regtest P2P**: 18444
- **Regtest RPC**: 18443

## Development Mode

For development with hot-reload:

```bash
cd mynta-wallet
npm run tauri dev
```

## Troubleshooting

### Build-time Sidecar Verification Fails

If the build fails with "SIDECAR BRANDING ERROR", the bundled daemon binary still contains "Raven" branding. Rebuild the core daemon and copy the fresh binary.

### Daemon Crashes on Start

1. Check `~/.mynta/debug.log` for error messages
2. Ensure the data directory exists and is writable
3. Verify no other daemon is using the same ports

### Cookie Authentication Issues

The wallet uses cookie authentication. The daemon creates a `.cookie` file in the data directory. Ensure the wallet has read access to this file.

## Platform-Specific Notes

### Windows

Use the MSVC toolchain and adjust paths:
- Data directory: `%APPDATA%\Mynta`
- Binary name: `myntad.exe`

### macOS

Data directory: `~/Library/Application Support/Mynta`

## CI Integration

See `.github/workflows/build.yml` for automated build configuration.







