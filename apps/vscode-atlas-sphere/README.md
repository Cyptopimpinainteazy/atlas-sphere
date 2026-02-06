# Atlas Sphere VS Code Extension

VS Code extension for Atlas Sphere blockchain development, providing IDE support for:

- **Comit Transaction Language** - Define atomic cross-VM transactions
- **Substrate Pallet Development** - FRAME macro support and snippets
- **Cross-VM Debugging** - EVM and SVM execution tracing

## Features

### Language Support

- Syntax highlighting for `.comit` and `.atlas` files
- Intelligent autocompletion for Comit and Rust/Substrate
- Real-time diagnostics and error reporting
- Hover documentation for Atlas-specific constructs

### Snippets

#### Comit Transactions
- `comit` - Full cross-VM transaction
- `evm_only` - EVM-only transaction
- `svm_only` - SVM-only transaction
- `atomic_swap` - Cross-VM atomic swap template

#### Substrate Pallets
- `pallet` - Complete FRAME pallet boilerplate
- `storage_value` - StorageValue declaration
- `storage_map` - StorageMap declaration
- `call` - Dispatchable function
- `test_mod` - Test module setup

### Commands

- **Atlas Sphere: Restart LSP Server** - Restart the language server
- **Atlas Sphere: New Comit Transaction** - Create a new Comit file
- **Atlas Sphere: Request Testnet Tokens** - Get tokens from faucet
- **Atlas Sphere: Show Chain Status** - Display network status

### Views

The extension adds an Atlas Sphere activity bar with:
- **Chain Status** - Network connectivity and sync status
- **Accounts** - Development accounts
- **Recent Comits** - Transaction history

## Reqfrontend/uirements

- VS Code 1.85.0 or later
- `atlas-lsp` binary (for full language server features)

## Installation

### From VSIX

```bash
code --install-extension vscode-atlas-sphere-0.1.0.vsix
```

### From Source

```bash
cd apps/vscode-atlas-sphere
npm install
npm run compile
# Press F5 in VS Code to launch extension development host
```

### Installing atlas-lsp

```bash
cargo install --path crates/atlas-lsp
```

Or bfrontend/uild from source:
```bash
cd crates/atlas-lsp
cargo bfrontend/uild --release
# Binary at target/release/atlas-lsp
```

## Configuration

| Setting                          | Default                                     | Description                  |
| -------------------------------- | ------------------------------------------- | ---------------------------- |
| `atlasSphere.lsp.path`           | `""`                                        | Path to atlas-lsp executable |
| `atlasSphere.lsp.trace.server`   | `"off"`                                     | LSP trace level              |
| `atlasSphere.diagnostics.enable` | `true`                                      | Enable diagnostics           |
| `atlasSphere.completion.enable`  | `true`                                      | Enable autocompletion        |
| `atlasSphere.testnet.rpcUrl`     | `"http://rpc.testnet.atlas-sphere.io:9944"` | Testnet RPC URL              |
| `atlasSphere.testnet.faucetUrl`  | `"https://faucet.testnet.atlas-sphere.io"`  | Faucet URL                   |

## Comit Transaction Format

```
comit "transfer_and_mint" {
    // EVM execution (Ethereum-style)
    evm {
        contract: "0x1234...",
        method: "transfer",
        args: ["0xRecipient", 1000],
        gas_limit: 100000,
        value: 0
    }
    
    // SVM execution (Solana-style)
    svm {
        program: "TokenProgram111...",
        instruction: 0,
        accounts: [
            { pubkey: "...", is_signer: true, is_writable: false }
        ],
        compute_units: 200000,
        data: [1, 2, 3]
    }
}
```

## Keyboard Shortcuts

| Command               | Windows/Linux | macOS       |
| --------------------- | ------------- | ----------- |
| New Comit Transaction | `Ctrl+Alt+C`  | `Cmd+Alt+C` |

## Development

```bash
# Install dependencies
npm install

# Compile TypeScript
npm run compile

# Watch mode
npm run watch

# Run tests
npm test

# Package extension
npm run package
```

## License

MIT
