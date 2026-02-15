/**
 * Mynta Wallet API - Tauri Command Wrapper
 * With robust error handling and deferred initialization
 */

// Track initialization state
let tauriModule: typeof import("@tauri-apps/api/core") | null = null;
let initPromise: Promise<void> | null = null;
let initError: Error | null = null;

// Debug log helper
function debugLog(msg: string): void {
  console.log(`[API] ${msg}`);
  if (typeof window !== 'undefined' && (window as any).debugLog) {
    (window as any).debugLog(`[API] ${msg}`);
  }
}

// Check if we're running in Tauri (check multiple indicators)
export function isTauri(): boolean {
  if (typeof window === 'undefined') return false;
  
  // Check various Tauri indicators
  const hasInternals = (window as any).__TAURI_INTERNALS__ !== undefined;
  const hasLegacy = (window as any).__TAURI__ !== undefined;
  
  debugLog(`Tauri check: __TAURI_INTERNALS__=${hasInternals}, __TAURI__=${hasLegacy}`);
  
  return hasInternals || hasLegacy;
}

// Lazy initialize Tauri module
async function ensureTauriLoaded(): Promise<typeof import("@tauri-apps/api/core")> {
  if (tauriModule) {
    return tauriModule;
  }
  
  if (initError) {
    throw initError;
  }
  
  if (!initPromise) {
    initPromise = (async () => {
      debugLog("Initializing Tauri module...");
      
      // Wait for Tauri to be available (up to 5 seconds)
      let attempts = 0;
      while (!isTauri() && attempts < 50) {
        debugLog(`Waiting for Tauri... attempt ${attempts + 1}`);
        await new Promise(r => setTimeout(r, 100));
        attempts++;
      }
      
      if (!isTauri()) {
        initError = new Error("Tauri environment not detected after 5 seconds. Please use the desktop app.");
        throw initError;
      }
      
      try {
        debugLog("Importing @tauri-apps/api/core...");
        const mod = await import("@tauri-apps/api/core");
        tauriModule = mod;
        debugLog("Tauri module loaded successfully");
      } catch (e) {
        initError = new Error(`Failed to load Tauri API: ${e}`);
        debugLog(`Failed to load Tauri: ${e}`);
        throw initError;
      }
    })();
  }
  
  await initPromise;
  
  if (!tauriModule) {
    throw new Error("Tauri module failed to initialize");
  }
  
  return tauriModule;
}

// Safe invoke wrapper
async function invoke<T>(command: string, args?: Record<string, unknown>): Promise<T> {
  debugLog(`invoke: ${command}`);
  
  const tauri = await ensureTauriLoaded();
  
  try {
    const result = await tauri.invoke<T>(command, args);
    debugLog(`invoke ${command}: success`);
    return result;
  } catch (e) {
    debugLog(`invoke ${command}: error - ${e}`);
    throw e;
  }
}

// Declare the Tauri internals type
declare global {
  interface Window {
    __TAURI_INTERNALS__?: unknown;
    __TAURI__?: unknown;
    debugLog?: (msg: string) => void;
  }
}

// Types
export interface CommandResult<T> {
  success: boolean;
  data: T | null;
  error: string | null;
}

export interface ConnectParams {
  host: string;
  port: number;
  username: string;
  password: string;
  network: "mainnet" | "testnet" | "regtest";
}

export interface ConnectionConfig {
  host: string;
  port: number;
  username: string;
  password: string;
  network: string;
}

export interface BlockchainInfo {
  chain: string;
  blocks: number;
  headers: number;
  bestblockhash: string;
  difficulty: number;
  mediantime: number;
  verificationprogress: number;
  initialblockdownload: boolean;
  chainwork: string;
  size_on_disk?: number;
  pruned: boolean;
  warnings: string;
  // Mynta launch countdown fields
  chain_start_time?: number;
  chain_start_date?: string;
  chain_started?: boolean;
  seconds_until_launch?: number;
  time_until_launch?: string;
}

export interface NetworkInfo {
  version: number;
  subversion: string;
  protocolversion: number;
  connections: number;
  networks: NetworkDetail[];
  relayfee: number;
  localaddresses: any[];
  warnings: string;
}

export interface NetworkDetail {
  name: string;
  limited: boolean;
  reachable: boolean;
  proxy: string;
}

export interface PeerInfo {
  id: number;
  addr: string;
  addrlocal?: string;
  version: number;
  subver: string;
  startingheight: number;
  synced_headers: number;
  synced_blocks: number;
  conntime: number;
  inbound: boolean;
  banscore?: number;
}

export interface Transaction {
  txid: string;
  address?: string;
  category: string;
  amount: number;
  label?: string;
  confirmations: number;
  blockhash?: string;
  blocktime?: number;
  time: number;
  timereceived: number;
  fee?: number;
}

export interface TransactionDetail {
  txid: string;
  hash: string;
  amount: number;
  confirmations: number;
  blockhash?: string;
  blocktime?: number;
  time: number;
  timereceived: number;
  details: TxDetailEntry[];
  hex: string;
}

export interface TxDetailEntry {
  address?: string;
  category: string;
  amount: number;
  label?: string;
  vout: number;
}

export interface Utxo {
  txid: string;
  vout: number;
  address: string;
  scriptPubKey: string;
  amount: number;
  confirmations: number;
  spendable: boolean;
  solvable: boolean;
}

export interface WalletInfo {
  walletname: string;
  walletversion: number;
  balance: number;
  unconfirmed_balance: number;
  immature_balance: number;
  txcount: number;
  keypoololdest?: number;
  keypoolsize: number;
  keypoolsize_hd_internal?: number;
  unlocked_until?: number;
  paytxfee: number;
  hdmasterkeyid?: string;
}

export interface AddressInfo {
  isvalid: boolean;
  address?: string;
  ismine?: boolean;
  iswatchonly?: boolean;
  isscript?: boolean;
}

export interface AssetData {
  name: string;
  amount: number;
  units: number;
  reissuable: boolean;
  has_ipfs: boolean;
  ipfs_hash?: string;
}

export interface MasternodeCount {
  total: number;
  enabled: number;
}

export interface MiningInfo {
  blocks: number;
  difficulty: number;
  networkhashps: number;
  pooledtx: number;
  chain: string;
}

export interface DashboardData {
  balance: number;
  unconfirmed_balance: number;
  block_height: number;
  connections: number;
  chain: string;
  synced: boolean;
  recent_transactions: Transaction[];
}

export interface IssueAssetParams {
  name: string;
  qty: number;
  units: number;
  reissuable: boolean;
  has_ipfs: boolean;
  ipfs_hash?: string;
}

// API Functions
async function callCommand<T>(command: string, args?: Record<string, unknown>): Promise<T> {
  const result = await invoke<CommandResult<T>>(command, args);
  if (!result.success) {
    throw new Error(result.error || "Unknown error");
  }
  return result.data as T;
}

// Connection
export const connect = (params: ConnectParams) =>
  callCommand<boolean>("connect", { params });

export const disconnect = () => callCommand<boolean>("disconnect");

export const isConnected = () => invoke<boolean>("is_connected");

export const getConnectionConfig = () =>
  invoke<ConnectionConfig | null>("get_connection_config");

// Blockchain
export const getBlockchainInfo = () =>
  callCommand<BlockchainInfo>("get_blockchain_info");

export const getBlockCount = () => callCommand<number>("get_block_count");

export const getNetworkInfo = () => callCommand<NetworkInfo>("get_network_info");

export const getPeerInfo = () => callCommand<PeerInfo[]>("get_peer_info");

export const getConnectionCount = () =>
  callCommand<number>("get_connection_count");

export const getMiningInfo = () => callCommand<MiningInfo>("get_mining_info");

// Wallet
export const getBalance = (minConf?: number) =>
  callCommand<number>("get_balance", { minConf });

export const getUnconfirmedBalance = () =>
  callCommand<number>("get_unconfirmed_balance");

export const getNewAddress = (label?: string) =>
  callCommand<string>("get_new_address", { label });

export const validateAddress = (address: string) =>
  callCommand<AddressInfo>("validate_address", { address });

export const sendToAddress = (
  address: string,
  amount: number,
  comment?: string
) => callCommand<string>("send_to_address", { address, amount, comment });

export const listTransactions = (count?: number, skip?: number) =>
  callCommand<Transaction[]>("list_transactions", { count, skip });

export const getTransaction = (txid: string) =>
  callCommand<TransactionDetail>("get_transaction", { txid });

export const listUnspent = (minConf?: number, maxConf?: number) =>
  callCommand<Utxo[]>("list_unspent", { minConf, maxConf });

export const getWalletInfo = () => callCommand<WalletInfo>("get_wallet_info");

export const encryptWallet = (passphrase: string) =>
  callCommand<string>("encrypt_wallet", { passphrase });

export const walletLock = () => callCommand<boolean>("wallet_lock");

export const walletUnlock = (passphrase: string, timeout: number) =>
  callCommand<boolean>("wallet_unlock", { passphrase, timeout });

export const backupWallet = (destination: string) =>
  callCommand<boolean>("backup_wallet", { destination });

export const dumpPrivkey = (address: string) =>
  callCommand<string>("dump_privkey", { address });

export const importPrivkey = (
  privkey: string,
  label?: string,
  rescan: boolean = false
) => callCommand<boolean>("import_privkey", { privkey, label, rescan });

// Assets
export const listAssets = () => callCommand<any>("list_assets");

export const listMyAssets = () => callCommand<any>("list_my_assets");

export const getAssetData = (assetName: string) =>
  callCommand<AssetData>("get_asset_data", { assetName });

export const issueAsset = (params: IssueAssetParams) =>
  callCommand<string[]>("issue_asset", { params });

export const transferAsset = (
  assetName: string,
  qty: number,
  toAddress: string
) => callCommand<string>("transfer_asset", { assetName, qty, toAddress });

export const reissueAsset = (
  assetName: string,
  qty: number,
  reissuable: boolean
) => callCommand<string>("reissue_asset", { assetName, qty, reissuable });

// Masternodes
export const masternodeCount = () =>
  callCommand<MasternodeCount>("masternode_count");

export const masternodeList = (mode?: string) =>
  callCommand<any>("masternode_list", { mode });

export const masternodeStatus = () => callCommand<any>("masternode_status");

export const protxList = (detailed: boolean = false) =>
  callCommand<any[]>("protx_list", { detailed });

export const protxInfo = (proTxHash: string) =>
  callCommand<any>("protx_info", { proTxHash });

export const masternodeWinners = (count: number = 10) =>
  callCommand<any[]>("masternode_winners", { count });

// DEX / Atomic Swaps
export interface DexOffer {
  hash: string;
  makerAsset: string;
  makerAmount: number;
  takerAsset: string;
  takerAmount: number;
  rate: number;
  createdHeight: number;
  expiresHeight: number;
}

export interface OrderBook {
  pair: string;
  bids: DexOffer[];
  asks: DexOffer[];
}

export interface CreateOfferResult {
  offerHash: string;
  secret: string;
  hashLock: string;
  sellAsset: string;
  sellAmount: number;
  buyAsset: string;
  buyAmount: number;
  expiresHeight: number;
}

export const dexOrderBook = (baseAsset: string, quoteAsset: string = "MYNTA") =>
  callCommand<OrderBook>("dex_orderbook", { baseAsset, quoteAsset });

export const dexCreateOffer = (
  sellAsset: string,
  sellAmount: number,
  buyAsset: string,
  buyAmount: number,
  timeoutBlocks: number = 1440
) => callCommand<CreateOfferResult>("dex_createoffer", {
  sellAsset, sellAmount, buyAsset, buyAmount, timeoutBlocks
});

export const dexTakeOffer = (offerHash: string) =>
  callCommand<any>("dex_takeoffer", { offerHash });

export const dexCancelOffer = (offerHash: string) =>
  callCommand<any>("dex_canceloffer", { offerHash });

export const htlcCreate = (
  receiverAddress: string,
  amount: number,
  hashLock: string,
  timeoutBlocks: number,
  asset: string = "MYNTA"
) => callCommand<any>("htlc_create", {
  receiverAddress, amount, hashLock, timeoutBlocks, asset
});

export const htlcClaim = (htlcTxid: string, preimage: string) =>
  callCommand<string>("htlc_claim", { htlcTxid, preimage });

export const htlcRefund = (htlcTxid: string) =>
  callCommand<string>("htlc_refund", { htlcTxid });

// Utility
export const rpcHelp = (command?: string) =>
  callCommand<string>("rpc_help", { command });

export const stopDaemon = () => callCommand<string>("stop_daemon");

// Dashboard
export const getDashboardData = () =>
  callCommand<DashboardData>("get_dashboard_data");

// ========== Daemon Management ==========

export interface DaemonInfo {
  available: boolean;
  binary_path: string | null;
  status: DaemonStatus;
  data_dir: string;
  network: string | null;
  rpc_connected: boolean;
}

export type DaemonStatus =
  | "stopped"
  | "starting"
  | "running"
  | "stopping"
  | { syncing: { progress: number } }
  | { crashed: { error: string } };

// getDaemonInfo returns DaemonInfo directly, not wrapped in CommandResult
export const getDaemonInfo = () => invoke<DaemonInfo>("get_daemon_info");

// startDaemon returns CommandResult<boolean>
export const startDaemon = async (network: string): Promise<void> => {
  const result = await invoke<CommandResult<boolean>>("start_daemon", { 
    params: { network } 
  });
  if (!result.success) {
    throw new Error(result.error || "Failed to start daemon");
  }
};

// stopIntegratedDaemon returns CommandResult<boolean>
export const stopIntegratedDaemon = async (): Promise<void> => {
  const result = await invoke<CommandResult<boolean>>("stop_integrated_daemon");
  if (!result.success) {
    throw new Error(result.error || "Failed to stop daemon");
  }
};

export const getDaemonStatus = () => invoke<DaemonStatus>("get_daemon_status");

export const isDaemonRunning = () => invoke<boolean>("is_daemon_running");

export const checkDaemonBinary = async (): Promise<string> => {
  const result = await invoke<CommandResult<string>>("check_daemon_binary");
  if (!result.success) {
    throw new Error(result.error || "Daemon binary not found");
  }
  return result.data as string;
};

// Format helpers
export const formatMYNTA = (amount: number, decimals: number = 8): string => {
  return amount.toLocaleString(undefined, {
    minimumFractionDigits: 2,
    maximumFractionDigits: decimals,
  });
};

export const formatTime = (timestamp: number): string => {
  return new Date(timestamp * 1000).toLocaleString();
};

export const shortenAddress = (
  address: string,
  start: number = 8,
  end: number = 6
): string => {
  if (address.length <= start + end) return address;
  return `${address.slice(0, start)}...${address.slice(-end)}`;
};

export const shortenTxid = (txid: string): string => {
  return `${txid.slice(0, 10)}...${txid.slice(-8)}`;
};

// ========== Seed Phrase / HD Wallet ==========

export interface GeneratedSeed {
  mnemonic: string;
  word_count: number;
  words: string[];
}

export interface ValidationResult {
  valid: boolean;
  error: string | null;
  invalid_words: InvalidWordInfo[];
}

export interface InvalidWordInfo {
  index: number;
  word: string;
  suggestions: string[];
}

export interface DerivedAddress {
  path: string;
  address: string;
  public_key: string;
}

export interface RestoreParams {
  mnemonic: string;
  passphrase?: string;
  wallet_password: string;
}

export interface RestoreResult {
  success: boolean;
  first_address: string;
  message: string;
}

/**
 * Generate a new BIP39 seed phrase
 * @param wordCount - Number of words (12 or 24)
 */
export const generateSeedPhrase = async (wordCount: number = 12): Promise<GeneratedSeed> => {
  const result = await invoke<CommandResult<GeneratedSeed>>("generate_seed_phrase", { 
    wordCount 
  });
  if (!result.success || !result.data) {
    throw new Error(result.error || "Failed to generate seed phrase");
  }
  return result.data;
};

/**
 * Validate a seed phrase
 * @param phrase - The mnemonic phrase to validate
 */
export const validateSeedPhrase = (phrase: string): Promise<ValidationResult> =>
  invoke<ValidationResult>("validate_seed_phrase", { phrase });

/**
 * Get random indices for verification quiz
 * @param wordCount - Total number of words
 */
export const getVerificationIndices = (wordCount: number): Promise<number[]> =>
  invoke<number[]>("get_verification_indices", { wordCount });

/**
 * Get word suggestions for autocomplete
 * @param prefix - Word prefix to search
 * @param limit - Maximum number of suggestions
 */
export const getWordSuggestions = (prefix: string, limit: number = 5): Promise<string[]> =>
  invoke<string[]>("get_word_suggestions", { prefix, limit });

/**
 * Restore wallet from seed phrase
 */
export const restoreFromSeed = async (params: RestoreParams): Promise<RestoreResult> => {
  const result = await invoke<CommandResult<RestoreResult>>("restore_from_seed", { params });
  if (!result.success || !result.data) {
    throw new Error(result.error || "Failed to restore wallet");
  }
  return result.data;
};

/**
 * Derive an address from seed phrase
 */
export const deriveAddressFromSeed = async (
  mnemonic: string,
  passphrase: string | null,
  account: number = 0,
  change: number = 0,
  addressIndex: number = 0
): Promise<DerivedAddress> => {
  const result = await invoke<CommandResult<DerivedAddress>>("derive_address_from_seed", {
    mnemonic,
    passphrase,
    account,
    change,
    addressIndex,
  });
  if (!result.success || !result.data) {
    throw new Error(result.error || "Failed to derive address");
  }
  return result.data;
};

/**
 * Get seed as hex (for advanced backup)
 */
export const getSeedHex = async (mnemonic: string, passphrase?: string): Promise<string> => {
  const result = await invoke<CommandResult<string>>("get_seed_hex", {
    mnemonic,
    passphrase: passphrase || null,
  });
  if (!result.success || !result.data) {
    throw new Error(result.error || "Failed to get seed hex");
  }
  return result.data;
};

/**
 * Check if wallet has been initialized
 */
export const isWalletInitialized = (): Promise<boolean> =>
  invoke<boolean>("is_wallet_initialized");

/**
 * Mark wallet as initialized
 */
export const markWalletInitialized = async (): Promise<void> => {
  const result = await invoke<CommandResult<boolean>>("mark_wallet_initialized");
  if (!result.success) {
    throw new Error(result.error || "Failed to mark wallet as initialized");
  }
};

/**
 * Reset wallet initialization (for testing)
 */
export const resetWalletInitialization = async (): Promise<void> => {
  const result = await invoke<CommandResult<boolean>>("reset_wallet_initialization");
  if (!result.success) {
    throw new Error(result.error || "Failed to reset wallet initialization");
  }
};
