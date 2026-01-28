/**
 * Atlas Sphere VS Code Extension
 * 
 * Provides IDE support for Atlas Sphere blockchain development:
 * - Comit transaction definition language
 * - Substrate pallet development
 * - Cross-VM (EVM + SVM) debugging
 */

import * as vscode from 'vscode';
import * as path from 'path';
import {
    LanguageClient,
    LanguageClientOptions,
    ServerOptions,
    TransportKind,
} from 'vscode-languageclient/node';

let client: LanguageClient | undefined;

// View providers
let chainStatusProvider: ChainStatusProvider;
let accountsProvider: AccountsProvider;
let comitsProvider: ComitsProvider;

export async function activate(context: vscode.ExtensionContext): Promise<void> {
    console.log('Atlas Sphere extension activating...');

    // Initialize LSP client
    await startLanguageClient(context);

    // Register commands
    registerCommands(context);

    // Initialize tree views
    initializeViews(context);

    // Show welcome message on first activation
    const hasShownWelcome = context.globalState.get<boolean>('hasShownWelcome');
    if (!hasShownWelcome) {
        showWelcomeMessage();
        context.globalState.update('hasShownWelcome', true);
    }

    console.log('Atlas Sphere extension activated');
}

export function deactivate(): Thenable<void> | undefined {
    if (client) {
        return client.stop();
    }
    return undefined;
}

async function startLanguageClient(context: vscode.ExtensionContext): Promise<void> {
    const config = vscode.workspace.getConfiguration('atlasSphere');
    
    // Find the LSP server executable
    let serverPath = config.get<string>('lsp.path');
    
    if (!serverPath) {
        // Try to find atlas-lsp in common locations
        const possiblePaths = [
            // Bundled with extension
            path.join(context.extensionPath, 'bin', 'atlas-lsp'),
            // Cargo install location
            path.join(process.env.HOME || '', '.cargo', 'bin', 'atlas-lsp'),
            // Workspace target
            path.join(vscode.workspace.workspaceFolders?.[0]?.uri.fsPath || '', 'target', 'release', 'atlas-lsp'),
            path.join(vscode.workspace.workspaceFolders?.[0]?.uri.fsPath || '', 'target', 'debug', 'atlas-lsp'),
        ];

        for (const p of possiblePaths) {
            try {
                await vscode.workspace.fs.stat(vscode.Uri.file(p));
                serverPath = p;
                break;
            } catch {
                // Path doesn't exist, try next
            }
        }
    }

    if (!serverPath) {
        vscode.window.showWarningMessage(
            'Atlas LSP server not found. Some features will be disabled. ' +
            'Run `cargo install --path crates/atlas-lsp` to install.'
        );
        return;
    }

    const serverOptions: ServerOptions = {
        run: {
            command: serverPath,
            transport: TransportKind.stdio,
        },
        debug: {
            command: serverPath,
            transport: TransportKind.stdio,
            args: ['--log-level', 'debug'],
        },
    };

    const clientOptions: LanguageClientOptions = {
        documentSelector: [
            { scheme: 'file', language: 'comit' },
            { scheme: 'file', language: 'rust' },
            { scheme: 'file', pattern: '**/*.comit' },
            { scheme: 'file', pattern: '**/*.atlas' },
        ],
        synchronize: {
            fileEvents: vscode.workspace.createFileSystemWatcher('**/*.{comit,atlas,rs}'),
        },
        outputChannelName: 'Atlas LSP',
        traceOutputChannel: vscode.window.createOutputChannel('Atlas LSP Trace'),
    };

    client = new LanguageClient(
        'atlasSphere',
        'Atlas Sphere Language Server',
        serverOptions,
        clientOptions
    );

    // Start the client and wait for it to be ready
    await client.start();
    console.log('Atlas LSP client ready');
}

function registerCommands(context: vscode.ExtensionContext): void {
    // Restart LSP
    context.subscriptions.push(
        vscode.commands.registerCommand('atlasSphere.restartLsp', async () => {
            if (client) {
                await client.stop();
                await startLanguageClient(context);
                vscode.window.showInformationMessage('Atlas LSP restarted');
            }
        })
    );

    // Open documentation
    context.subscriptions.push(
        vscode.commands.registerCommand('atlasSphere.openDocs', () => {
            vscode.env.openExternal(vscode.Uri.parse('https://docs.atlas-sphere.io'));
        })
    );

    // New Comit transaction
    context.subscriptions.push(
        vscode.commands.registerCommand('atlasSphere.newComit', async () => {
            const name = await vscode.window.showInputBox({
                prompt: 'Enter Comit transaction name',
                placeHolder: 'my_transaction',
            });

            if (!name) {
                return;
            }

            const type = await vscode.window.showQuickPick(
                [
                    { label: 'Cross-VM (EVM + SVM)', value: 'cross' },
                    { label: 'EVM Only', value: 'evm' },
                    { label: 'SVM Only', value: 'svm' },
                ],
                { placeHolder: 'Select transaction type' }
            );

            if (!type) {
                return;
            }

            const snippet = generateComitSnippet(name, type.value);
            const editor = vscode.window.activeTextEditor;
            
            if (editor) {
                editor.insertSnippet(new vscode.SnippetString(snippet));
            } else {
                // Create new file
                const doc = await vscode.workspace.openTextDocument({
                    language: 'comit',
                    content: snippet.replace(/\$\{\d+:?[^}]*\}/g, ''),
                });
                await vscode.window.showTextDocument(doc);
            }
        })
    );

    // Request faucet tokens
    context.subscriptions.push(
        vscode.commands.registerCommand('atlasSphere.requestFaucet', async () => {
            const address = await vscode.window.showInputBox({
                prompt: 'Enter your wallet address',
                placeHolder: '5GrwvaEF5zXb26Fz9rcQpDWS57CtERHpNehXCPcNoHGKutQY',
            });

            if (!address) {
                return;
            }

            const config = vscode.workspace.getConfiguration('atlasSphere');
            const faucetUrl = config.get<string>('testnet.faucetUrl') || 'https://faucet.testnet.atlas-sphere.io';

            try {
                const response = await fetch(`${faucetUrl}/drip`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ address }),
                });

                if (response.ok) {
                    vscode.window.showInformationMessage(`Tokens requested for ${address}`);
                } else {
                    const error = await response.text();
                    vscode.window.showErrorMessage(`Faucet error: ${error}`);
                }
            } catch (error) {
                vscode.window.showErrorMessage(`Failed to connect to faucet: ${error}`);
            }
        })
    );

    // Show chain status
    context.subscriptions.push(
        vscode.commands.registerCommand('atlasSphere.showStatus', async () => {
            const config = vscode.workspace.getConfiguration('atlasSphere');
            const rpcUrl = config.get<string>('testnet.rpcUrl') || 'http://rpc.testnet.atlas-sphere.io:9944';

            try {
                const response = await fetch(rpcUrl, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        jsonrpc: '2.0',
                        id: 1,
                        method: 'system_health',
                        params: [],
                    }),
                });

                const data = await response.json() as { result?: { peers: number; isSyncing: boolean } };
                
                if (data.result) {
                    vscode.window.showInformationMessage(
                        `Chain Status: ${data.result.peers} peers, ` +
                        `Syncing: ${data.result.isSyncing ? 'Yes' : 'No'}`
                    );
                }
            } catch (error) {
                vscode.window.showErrorMessage(`Failed to get chain status: ${error}`);
            }
        })
    );
}

function generateComitSnippet(name: string, type: string): string {
    switch (type) {
        case 'evm':
            return `comit "${name}" {
    evm {
        contract: "\${1:0x...}",
        method: "\${2:functionName}",
        args: [\${3}],
        gas_limit: \${4:100000},
        value: \${5:0}
    }
}`;
        case 'svm':
            return `comit "${name}" {
    svm {
        program: "\${1:program_id}",
        instruction: \${2:0},
        accounts: [
            { pubkey: "\${3}", is_signer: false, is_writable: true }
        ],
        compute_units: \${4:200000},
        data: [\${5}]
    }
}`;
        default:
            return `comit "${name}" {
    evm {
        contract: "\${1:0x...}",
        method: "\${2:functionName}",
        args: [\${3}],
        gas_limit: \${4:100000}
    }
    svm {
        program: "\${5:program_id}",
        instruction: \${6:0},
        accounts: [
            { pubkey: "\${7}", is_signer: false, is_writable: true }
        ],
        compute_units: \${8:200000}
    }
}`;
    }
}

function initializeViews(context: vscode.ExtensionContext): void {
    chainStatusProvider = new ChainStatusProvider();
    accountsProvider = new AccountsProvider();
    comitsProvider = new ComitsProvider();

    context.subscriptions.push(
        vscode.window.registerTreeDataProvider('atlasSphere.chain', chainStatusProvider),
        vscode.window.registerTreeDataProvider('atlasSphere.accounts', accountsProvider),
        vscode.window.registerTreeDataProvider('atlasSphere.comits', comitsProvider)
    );
}

function showWelcomeMessage(): void {
    vscode.window.showInformationMessage(
        'Welcome to Atlas Sphere! Get started with cross-VM blockchain development.',
        'Open Docs',
        'Create Comit'
    ).then((selection) => {
        if (selection === 'Open Docs') {
            vscode.commands.executeCommand('atlasSphere.openDocs');
        } else if (selection === 'Create Comit') {
            vscode.commands.executeCommand('atlasSphere.newComit');
        }
    });
}

// Tree View Providers

class ChainStatusProvider implements vscode.TreeDataProvider<ChainItem> {
    private _onDidChangeTreeData = new vscode.EventEmitter<ChainItem | undefined | null | void>();
    readonly onDidChangeTreeData = this._onDidChangeTreeData.event;

    refresh(): void {
        this._onDidChangeTreeData.fire();
    }

    getTreeItem(element: ChainItem): vscode.TreeItem {
        return element;
    }

    async getChildren(): Promise<ChainItem[]> {
        const config = vscode.workspace.getConfiguration('atlasSphere');
        const rpcUrl = config.get<string>('testnet.rpcUrl') || 'http://rpc.testnet.atlas-sphere.io:9944';

        try {
            const response = await fetch(rpcUrl, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    jsonrpc: '2.0',
                    id: 1,
                    method: 'system_health',
                    params: [],
                }),
            });

            const data = await response.json() as { result?: { peers: number; isSyncing: boolean } };

            if (data.result) {
                return [
                    new ChainItem('Status', 'Connected', vscode.TreeItemCollapsibleState.None),
                    new ChainItem('Peers', `${data.result.peers}`, vscode.TreeItemCollapsibleState.None),
                    new ChainItem('Syncing', data.result.isSyncing ? 'Yes' : 'No', vscode.TreeItemCollapsibleState.None),
                ];
            }
        } catch {
            return [
                new ChainItem('Status', 'Disconnected', vscode.TreeItemCollapsibleState.None),
            ];
        }

        return [];
    }
}

class AccountsProvider implements vscode.TreeDataProvider<AccountItem> {
    private _onDidChangeTreeData = new vscode.EventEmitter<AccountItem | undefined | null | void>();
    readonly onDidChangeTreeData = this._onDidChangeTreeData.event;

    refresh(): void {
        this._onDidChangeTreeData.fire();
    }

    getTreeItem(element: AccountItem): vscode.TreeItem {
        return element;
    }

    getChildren(): AccountItem[] {
        // Return dev accounts for now
        return [
            new AccountItem('Alice', '5GrwvaEF5zXb26Fz9rcQpDWS57CtERHpNehXCPcNoHGKutQY'),
            new AccountItem('Bob', '5FHneW46xGXgs5mUiveU4sbTyGBzmstUspZC92UhjJM694ty'),
            new AccountItem('Charlie', '5FLSigC9HGRKVhB9FiEo4Y3koPsNmBmLJbpXg2mp1hXcS59Y'),
        ];
    }
}

class ComitsProvider implements vscode.TreeDataProvider<ComitItem> {
    private _onDidChangeTreeData = new vscode.EventEmitter<ComitItem | undefined | null | void>();
    readonly onDidChangeTreeData = this._onDidChangeTreeData.event;

    refresh(): void {
        this._onDidChangeTreeData.fire();
    }

    getTreeItem(element: ComitItem): vscode.TreeItem {
        return element;
    }

    getChildren(): ComitItem[] {
        // Placeholder - would fetch from indexer
        return [
            new ComitItem('No recent Comits', '', 'pending'),
        ];
    }
}

class ChainItem extends vscode.TreeItem {
    constructor(
        public readonly label: string,
        public readonly value: string,
        public readonly collapsibleState: vscode.TreeItemCollapsibleState
    ) {
        super(label, collapsibleState);
        this.description = value;
    }
}

class AccountItem extends vscode.TreeItem {
    constructor(
        public readonly name: string,
        public readonly address: string
    ) {
        super(name, vscode.TreeItemCollapsibleState.None);
        this.description = `${address.slice(0, 8)}...${address.slice(-8)}`;
        this.tooltip = address;
        this.contextValue = 'account';
    }
}

class ComitItem extends vscode.TreeItem {
    constructor(
        public readonly name: string,
        public readonly hash: string,
        public readonly status: 'pending' | 'finalized' | 'failed'
    ) {
        super(name, vscode.TreeItemCollapsibleState.None);
        this.description = hash ? `${hash.slice(0, 10)}...` : '';
        this.iconPath = new vscode.ThemeIcon(
            status === 'finalized' ? 'check' : status === 'failed' ? 'error' : 'clock'
        );
    }
}
