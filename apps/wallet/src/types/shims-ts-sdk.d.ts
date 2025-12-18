// Minimal module shims for @atlas-sphere/ts-sdk used during IDE/type-check in apps
declare module '@atlas-sphere/ts-sdk' {
  export type BalanceInfo = { native: bigint; formatted: string; usdValue?: string };
  export type ComitSubmissionResult = { comitId: string; blockHash: string; blockNumber: number; success: boolean; error?: string };
  export type ComitEvent = { type: string; data: any };

  export class AtlasSphereClient {
    constructor(config?: any);
    connect(): Promise<void>;
    disconnect(): Promise<void>;
    isConnected: boolean;
    getBalance(address: string): Promise<BalanceInfo>;
    getCanonicalBalance(address: string, assetId?: number): Promise<BalanceInfo>;
    getMultipleBalances(address: string, assetIds: number[]): Promise<BalanceInfo[]>;
    getNonce(address: string): Promise<bigint>;
    getChainInfo(): Promise<{ name: string; version: string; properties: { tokenSymbol: string; tokenDecimals?: number; ss58Format?: number } }>;
    getBlockNumber(): Promise<number>;
    getFinalizedBlockNumber(): Promise<number>;
    submitComit(signer: string, payload: any, fee?: bigint): Promise<ComitSubmissionResult>;
    subscribeNewBlocks(cb: (n: number, h?: string)=>void): Promise<string>;
    subscribeFinalizedBlocks(cb: (n: number, h?: string)=>void): Promise<string>;
    subscribeComitEvents(address: string, cb: (e: ComitEvent)=>void): Promise<string>;
    unsubscribe(id: string): Promise<boolean>;
  }

  export function formatBalance(balance: bigint, decimals?: number): string;
  export function parseBalance(str: string, decimals?: number): bigint;

  export const NATIVE_ASSET_ID: number;
  export const NATIVE_ASSET_SYMBOL: string;
  export const NATIVE_ASSET_DECIMALS: number;
  export const DEFAULT_WS_ENDPOINT: string;

  export function createQueryClient(): Promise<any>;
}
