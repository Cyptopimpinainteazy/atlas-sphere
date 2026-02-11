/**
 * Atlas Sphere Bridge Adapter for Polkawallet
 *
 * Implements the @polkawallet/bridge adapter interface for Atlas Sphere x3chain.
 * Supports:
 * - XCM transfers between Atlas ↔ Polkadot/Kusama parachains
 * - Native x3 settlement engine bridge (Atlas ↔ EVM ↔ Solana ↔ Bitcoin)
 * - Multi-hop routing through intermediate chains
 * - Fee estimation and route optimization
 */

import type { ApiPromise } from '@polkadot/api';
import { EventEmitter } from 'eventemitter3';

// =============================================================================
// Types
// =============================================================================

export type ChainId =
  | 'atlas'
  | 'polkadot'
  | 'kusama'
  | 'acala'
  | 'moonbeam'
  | 'astar'
  | 'ethereum'
  | 'solana'
  | 'bitcoin'
  | 'bsc'
  | 'arbitrum'
  | 'optimism'
  | 'base'
  | 'polygon'
  | 'avalanche'
  | 'cosmos'
  | 'near';

export type BridgeMethod = 'xcm' | 'x3-settlement' | 'x3-atomic' | 'ibc';

export interface BridgeRoute {
  source: ChainId;
  destination: ChainId;
  method: BridgeMethod;
  hops: ChainId[];
  estimatedTime: number; // seconds
  estimatedFee: bigint;
  maxAmount?: bigint;
  minAmount?: bigint;
}

export interface BridgeTransferParams {
  source: ChainId;
  destination: ChainId;
  asset: string;
  amount: bigint;
  recipient: string;
  /** Optional: force a specific bridge method */
  method?: BridgeMethod;
  /** Optional: slippage tolerance in basis points */
  slippageBps?: number;
}

export interface BridgeTransferResult {
  transferId: string;
  source: ChainId;
  destination: ChainId;
  amount: bigint;
  fee: bigint;
  method: BridgeMethod;
  status: BridgeTransferStatus;
  sourceBlockHash?: string;
  sourceTxHash?: string;
}

export type BridgeTransferStatus =
  | 'initiated'
  | 'source_confirmed'
  | 'in_flight'
  | 'destination_confirmed'
  | 'completed'
  | 'failed'
  | 'refunded';

export interface BridgeConfig {
  atlasEndpoint: string;
  /** External chain endpoints for multi-chain routing */
  endpoints?: Partial<Record<ChainId, string>>;
  /** Default slippage tolerance in bps */
  defaultSlippageBps?: number;
}

export interface BridgeEvents {
  transferStarted: (result: BridgeTransferResult) => void;
  transferUpdated: (result: BridgeTransferResult) => void;
  transferCompleted: (result: BridgeTransferResult) => void;
  transferFailed: (result: BridgeTransferResult & { error: string }) => void;
}

// =============================================================================
// Chain Registry — which chains support which bridge methods
// =============================================================================

const CHAIN_REGISTRY: Record<ChainId, { paraId?: number; methods: BridgeMethod[] }> = {
  atlas:     { paraId: 3337, methods: ['xcm', 'x3-settlement', 'x3-atomic'] },
  polkadot:  { paraId: 0,    methods: ['xcm'] },
  kusama:    { paraId: 0,    methods: ['xcm'] },
  acala:     { paraId: 2000, methods: ['xcm'] },
  moonbeam:  { paraId: 2004, methods: ['xcm'] },
  astar:     { paraId: 2006, methods: ['xcm'] },
  ethereum:  { methods: ['x3-settlement', 'x3-atomic'] },
  solana:    { methods: ['x3-settlement', 'x3-atomic'] },
  bitcoin:   { methods: ['x3-settlement'] },
  bsc:       { methods: ['x3-settlement', 'x3-atomic'] },
  arbitrum:  { methods: ['x3-settlement', 'x3-atomic'] },
  optimism:  { methods: ['x3-settlement', 'x3-atomic'] },
  base:      { methods: ['x3-settlement', 'x3-atomic'] },
  polygon:   { methods: ['x3-settlement', 'x3-atomic'] },
  avalanche: { methods: ['x3-settlement', 'x3-atomic'] },
  cosmos:    { methods: ['ibc', 'x3-settlement'] },
  near:      { methods: ['x3-settlement'] },
};

// =============================================================================
// AtlasBridgeAdapter
// =============================================================================

export class AtlasBridgeAdapter extends EventEmitter<BridgeEvents> {
  private api: ApiPromise | null = null;
  private config: BridgeConfig;

  constructor(config: BridgeConfig) {
    super();
    this.config = {
      defaultSlippageBps: 50,
      ...config,
    };
  }

  /** Initialize with an existing ApiPromise (from AtlasX3Plugin) */
  setApi(api: ApiPromise): void {
    this.api = api;
  }

  // ---------------------------------------------------------------------------
  // Route Discovery
  // ---------------------------------------------------------------------------

  /** Get available bridge routes between two chains */
  getRoutes(source: ChainId, destination: ChainId): BridgeRoute[] {
    const sourceInfo = CHAIN_REGISTRY[source];
    const destInfo = CHAIN_REGISTRY[destination];
    if (!sourceInfo || !destInfo) return [];

    const routes: BridgeRoute[] = [];

    // Direct routes
    const commonMethods = sourceInfo.methods.filter((m) =>
      destInfo.methods.includes(m),
    );

    for (const method of commonMethods) {
      routes.push({
        source,
        destination,
        method,
        hops: [],
        estimatedTime: this._estimateTime(method),
        estimatedFee: this._estimateFee(method),
      });
    }

    // If no direct route, try routing through Atlas as hub
    if (routes.length === 0 && source !== 'atlas' && destination !== 'atlas') {
      const toAtlas = this.getRoutes(source, 'atlas');
      const fromAtlas = this.getRoutes('atlas', destination);

      if (toAtlas.length > 0 && fromAtlas.length > 0) {
        routes.push({
          source,
          destination,
          method: 'x3-settlement',
          hops: ['atlas'],
          estimatedTime:
            toAtlas[0].estimatedTime + fromAtlas[0].estimatedTime,
          estimatedFee: toAtlas[0].estimatedFee + fromAtlas[0].estimatedFee,
        });
      }
    }

    return routes.sort((a, b) => Number(a.estimatedFee - b.estimatedFee));
  }

  /** Get all chains reachable from a given chain */
  getReachableChains(source: ChainId): ChainId[] {
    return (Object.keys(CHAIN_REGISTRY) as ChainId[]).filter(
      (dest) => dest !== source && this.getRoutes(source, dest).length > 0,
    );
  }

  /** Get supported assets for transfer between two chains */
  async getSupportedAssets(
    source: ChainId,
    destination: ChainId,
  ): Promise<string[]> {
    // Atlas supports all registered assets
    if (source === 'atlas' || destination === 'atlas') {
      if (!this.api) return ['ATLAS', 'USDC', 'USDT', 'ETH', 'SOL', 'BTC'];
      const entries = await this.api.query.atlasKernel.assetRegistry.entries();
      return entries.map(([_key, value]) => {
        const json = (value as any).toJSON?.();
        return json?.symbol
          ? Buffer.from(json.symbol.slice(2), 'hex').toString()
          : 'UNKNOWN';
      });
    }

    return ['ATLAS', 'USDC', 'USDT'];
  }

  // ---------------------------------------------------------------------------
  // Bridge Transfers
  // ---------------------------------------------------------------------------

  /** Initiate a cross-chain transfer */
  async transfer(
    account: string,
    params: BridgeTransferParams,
  ): Promise<BridgeTransferResult> {
    if (!this.api) {
      throw new Error('Bridge adapter not initialized. Call setApi() first.');
    }

    const routes = this.getRoutes(params.source, params.destination);
    if (routes.length === 0) {
      throw new Error(
        `No bridge route found: ${params.source} → ${params.destination}`,
      );
    }

    const route =
      params.method
        ? routes.find((r) => r.method === params.method) ?? routes[0]
        : routes[0];

    let result: BridgeTransferResult;

    switch (route.method) {
      case 'xcm':
        result = await this._transferXcm(account, params, route);
        break;
      case 'x3-settlement':
        result = await this._transferX3Settlement(account, params, route);
        break;
      case 'x3-atomic':
        result = await this._transferX3Atomic(account, params, route);
        break;
      case 'ibc':
        result = await this._transferIbc(account, params, route);
        break;
      default:
        throw new Error(`Unsupported bridge method: ${route.method}`);
    }

    this.emit('transferStarted', result);
    return result;
  }

  /** Estimate fees for a bridge transfer */
  async estimateFee(params: BridgeTransferParams): Promise<bigint> {
    const routes = this.getRoutes(params.source, params.destination);
    if (routes.length === 0) return 0n;
    const route = params.method
      ? routes.find((r) => r.method === params.method) ?? routes[0]
      : routes[0];
    return route.estimatedFee;
  }

  // ---------------------------------------------------------------------------
  // XCM Transfer (Polkadot/Kusama parachains)
  // ---------------------------------------------------------------------------

  private async _transferXcm(
    account: string,
    params: BridgeTransferParams,
    route: BridgeRoute,
  ): Promise<BridgeTransferResult> {
    const destParaId = CHAIN_REGISTRY[params.destination]?.paraId;

    // Use xcmPallet.limitedReserveTransferAssets for parachain transfers
    const dest = {
      V3: {
        parents: params.destination === 'polkadot' ? 1 : 0,
        interior: destParaId
          ? { X1: { Parachain: destParaId } }
          : 'Here',
      },
    };

    const beneficiary = {
      V3: {
        parents: 0,
        interior: {
          X1: {
            AccountId32: {
              network: null,
              id: params.recipient,
            },
          },
        },
      },
    };

    const assets = {
      V3: [
        {
          id: { Concrete: { parents: 0, interior: 'Here' } },
          fun: { Fungible: params.amount },
        },
      ],
    };

    const tx = this.api!.tx.xcmPallet.limitedReserveTransferAssets(
      dest,
      beneficiary,
      assets,
      0, // fee asset index
      'Unlimited',
    );

    return new Promise((resolve, reject) => {
      tx.signAndSend(account, (result: any) => {
        if (result.status.isFinalized) {
          resolve({
            transferId: result.txHash.toHex(),
            source: params.source,
            destination: params.destination,
            amount: params.amount,
            fee: route.estimatedFee,
            method: 'xcm',
            status: 'source_confirmed',
            sourceBlockHash: result.status.asFinalized.toHex(),
            sourceTxHash: result.txHash.toHex(),
          });
        }
        if (result.isError) {
          reject(new Error('XCM transfer failed'));
        }
      }).catch(reject);
    });
  }

  // ---------------------------------------------------------------------------
  // X3 Settlement Engine Transfer (EVM/Solana/BTC chains)
  // ---------------------------------------------------------------------------

  private async _transferX3Settlement(
    account: string,
    params: BridgeTransferParams,
    route: BridgeRoute,
  ): Promise<BridgeTransferResult> {
    // Create a settlement intent using the x3-settlement-engine pallet
    const { randomAsHex, blake2AsHex } = await import('@polkadot/util-crypto');
    const secret = randomAsHex(32);
    const secretHash = blake2AsHex(secret, 256);

    const chainMap: Record<string, string> = {
      ethereum: 'Ethereum',
      solana: 'Solana',
      bitcoin: 'Bitcoin',
      bsc: 'Bsc',
      arbitrum: 'Arbitrum',
      optimism: 'Optimism',
      base: 'Base',
      polygon: 'Polygon',
      avalanche: 'Avalanche',
      cosmos: 'Cosmos',
      near: 'Near',
      atlas: 'Atlas',
      polkadot: 'Polkadot',
      kusama: 'Kusama',
    };

    const tx = this.api!.tx.x3SettlementEngine.createIntent(
      params.recipient, // taker
      {
        chain: chainMap[params.source] ?? 'Atlas',
        asset_id: params.asset,
        amount: params.amount,
      },
      {
        chain: chainMap[params.destination] ?? 'Ethereum',
        asset_id: params.asset,
        amount: params.amount,
      },
      secretHash,
      3600, // 1 hour timeout
    );

    return new Promise((resolve, reject) => {
      tx.signAndSend(account, (result: any) => {
        if (result.status.isFinalized) {
          const intentEvent = result.events.find(
            (r: any) =>
              r.event.section === 'x3SettlementEngine' &&
              r.event.method === 'X3IntentCreated',
          );
          const intentId =
            intentEvent?.event?.data?.intent_id?.toHex() ?? secretHash;

          resolve({
            transferId: intentId,
            source: params.source,
            destination: params.destination,
            amount: params.amount,
            fee: route.estimatedFee,
            method: 'x3-settlement',
            status: 'initiated',
            sourceBlockHash: result.status.asFinalized.toHex(),
            sourceTxHash: result.txHash.toHex(),
          });
        }
        if (result.isError) {
          reject(new Error('X3 settlement transfer failed'));
        }
      }).catch(reject);
    });
  }

  // ---------------------------------------------------------------------------
  // X3 Atomic Transfer (via atomic-trade-engine for DEX-routed transfers)
  // ---------------------------------------------------------------------------

  private async _transferX3Atomic(
    account: string,
    params: BridgeTransferParams,
    route: BridgeRoute,
  ): Promise<BridgeTransferResult> {
    // Use atomic trade engine with a CrossVm leg
    const vmTypeMap: Record<string, string> = {
      ethereum: 'Evm',
      bsc: 'Evm',
      arbitrum: 'Evm',
      optimism: 'Evm',
      base: 'Evm',
      polygon: 'Evm',
      solana: 'Svm',
      atlas: 'X3',
    };

    const destVm = vmTypeMap[params.destination] ?? 'CrossVm';

    const tx = this.api!.tx.atomicTradeEngine.createTradeBatch(
      [
        {
          amm_protocol: 'AtlasNative',
          vm_type: destVm,
          asset_in: params.asset,
          asset_out: params.asset,
          amount_in: params.amount,
          min_amount_out:
            params.amount -
            (params.amount * BigInt(params.slippageBps ?? 50)) / 10000n,
          route_data: [],
        },
      ],
      params.slippageBps ?? 50,
      0, // deadline: auto
      0, // nonce: auto
    );

    return new Promise((resolve, reject) => {
      tx.signAndSend(account, (result: any) => {
        if (result.status.isFinalized) {
          resolve({
            transferId: result.txHash.toHex(),
            source: params.source,
            destination: params.destination,
            amount: params.amount,
            fee: route.estimatedFee,
            method: 'x3-atomic',
            status: 'source_confirmed',
            sourceBlockHash: result.status.asFinalized.toHex(),
            sourceTxHash: result.txHash.toHex(),
          });
        }
        if (result.isError) {
          reject(new Error('X3 atomic transfer failed'));
        }
      }).catch(reject);
    });
  }

  // ---------------------------------------------------------------------------
  // IBC Transfer (Cosmos ecosystem)
  // ---------------------------------------------------------------------------

  private async _transferIbc(
    _account: string,
    params: BridgeTransferParams,
    route: BridgeRoute,
  ): Promise<BridgeTransferResult> {
    // IBC transfers routed through x3-settlement with Cosmos proof type
    throw new Error(
      `IBC transfer ${params.source} → ${params.destination} not yet implemented. Use x3-settlement method.`,
    );
  }

  // ---------------------------------------------------------------------------
  // Fee Estimation Helpers
  // ---------------------------------------------------------------------------

  private _estimateTime(method: BridgeMethod): number {
    switch (method) {
      case 'xcm':
        return 30; // ~30 seconds for XCM
      case 'x3-settlement':
        return 120; // ~2 minutes for HTLC settlement
      case 'x3-atomic':
        return 12; // ~12 seconds (1 block)
      case 'ibc':
        return 60; // ~1 minute for IBC
    }
  }

  private _estimateFee(method: BridgeMethod): bigint {
    switch (method) {
      case 'xcm':
        return 100_000_000n; // 0.1 ATLAS
      case 'x3-settlement':
        return 500_000_000n; // 0.5 ATLAS
      case 'x3-atomic':
        return 200_000_000n; // 0.2 ATLAS
      case 'ibc':
        return 300_000_000n; // 0.3 ATLAS
    }
  }
}

// =============================================================================
// Factory
// =============================================================================

export function createBridgeAdapter(config: BridgeConfig): AtlasBridgeAdapter {
  return new AtlasBridgeAdapter(config);
}
