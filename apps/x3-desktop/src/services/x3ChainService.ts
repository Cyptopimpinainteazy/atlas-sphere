/**
 * x3ChainService.ts
 *
 * Live connection layer between the X3 Tauri desktop and the X3 blockchain.
 * Uses @polkadot/api to:
 *   - Connect to a running X3 node via WebSocket RPC
 *   - Query the AtomicTradeEngine runtime API (simulate_trade, find_route, get_price_data)
 *   - Submit signed extrinsics (create_trade_batch, execute_trade_batch)
 *   - Subscribe to chain events for real-time trade status
 */

import { ApiPromise, WsProvider, Keyring } from '@polkadot/api';
// @polkadot/extension-inject types imported dynamically via extension-dapp

// ─── Constants ────────────────────────────────────────────────────────────────

/** Default local X3 node RPC endpoint */
const DEFAULT_WS = import.meta.env.VITE_X3_NODE_WS ?? 'ws://127.0.0.1:9944';

/** Well-known token H256 identifiers (keccak256 of ticker) */
export const TOKEN_IDS: Record<string, string> = {
  X3:   '0x' + '58'.repeat(32), // placeholder — replace with genesis token hash
  ETH:  '0x' + 'ef'.repeat(32),
  SOL:  '0x' + '50'.repeat(32),
  USDC: '0x' + 'dc'.repeat(32),
  WETH: '0x' + 'ee'.repeat(32),
};

/** VM type enum matching the Rust pallet */
export enum VmType {
  EVM   = 0,
  SVM   = 1,
  X3    = 2,
  Cross = 3,
}

// ─── Types ────────────────────────────────────────────────────────────────────

export interface SimulationResult {
  success: boolean;
  estimatedOutput: bigint;
  priceImpactBps: number;
  evmGas: bigint;
  svmCompute: bigint;
  route: RouteStep[];
  error?: string;
}

export interface RouteStep {
  poolId: string;
  tokenIn: string;
  tokenOut: string;
  amountIn: bigint;
  amountOut: bigint;
  vmType: VmType;
}

export interface TradeLeg {
  vmType: VmType;
  tokenIn: string;
  tokenOut: string;
  amountIn: bigint;
  minAmountOut: bigint;
  deadline: number;
}

export interface TradeReceipt {
  batchId: string;
  status: 'pending' | 'executing' | 'finalized' | 'rolled_back';
  txHash?: string;
  blockNumber?: number;
  legsExecuted: number;
  error?: string;
}

export type SwapStatus =
  | { type: 'idle' }
  | { type: 'simulating' }
  | { type: 'awaiting_signature' }
  | { type: 'submitting' }
  | { type: 'finalized'; receipt: TradeReceipt }
  | { type: 'failed'; error: string };

// ─── Singleton API connection ─────────────────────────────────────────────────

class X3ChainService {
  private api: ApiPromise | null = null;
  private wsEndpoint: string = DEFAULT_WS;
  private connectionAttempts = 0;
  private connectionListeners: Array<(connected: boolean) => void> = [];

  // ── Connection ──────────────────────────────────────────────────────────────

  async connect(endpoint?: string): Promise<ApiPromise> {
    if (this.api?.isConnected) return this.api;

    this.wsEndpoint = endpoint ?? DEFAULT_WS;
    this.connectionAttempts++;

    const provider = new WsProvider(this.wsEndpoint, 2_500, {}, 30_000);

    provider.on('connected', () => {
      console.log('[X3Chain] Connected to', this.wsEndpoint);
      this.connectionListeners.forEach(fn => fn(true));
    });

    provider.on('disconnected', () => {
      console.warn('[X3Chain] Disconnected from', this.wsEndpoint);
      this.connectionListeners.forEach(fn => fn(false));
    });

    provider.on('error', (err) => {
      console.error('[X3Chain] WS error:', err);
    });

    this.api = await ApiPromise.create({
      provider,
      throwOnConnect: false,
      noInitWarn: true,
    });

    await this.api.isReady;

    const [chain, nodeName, nodeVersion] = await Promise.all([
      this.api.rpc.system.chain(),
      this.api.rpc.system.name(),
      this.api.rpc.system.version(),
    ]);

    console.log(`[X3Chain] 🟢 Connected to ${chain} via ${nodeName} v${nodeVersion}`);
    return this.api;
  }

  async disconnect(): Promise<void> {
    if (this.api) {
      await this.api.disconnect();
      this.api = null;
    }
  }

  onConnectionChange(fn: (connected: boolean) => void): () => void {
    this.connectionListeners.push(fn);
    return () => {
      this.connectionListeners = this.connectionListeners.filter(l => l !== fn);
    };
  }

  get isConnected(): boolean {
    return this.api?.isConnected ?? false;
  }

  get endpoint(): string {
    return this.wsEndpoint;
  }

  private async getApi(): Promise<ApiPromise> {
    if (this.api?.isConnected) return this.api;
    return this.connect();
  }

  // ── Chain info ──────────────────────────────────────────────────────────────

  async getChainInfo(): Promise<{ chain: string; blockNumber: number; finalizedBlock: number }> {
    const api = await this.getApi();
    const [chainName, header, finalizedHead] = await Promise.all([
      api.rpc.system.chain(),
      api.rpc.chain.getHeader(),
      api.rpc.chain.getFinalizedHead(),
    ]);
    const finalizedHeader = await api.rpc.chain.getHeader(finalizedHead);

    return {
      chain: chainName.toString(),
      blockNumber: header.number.toNumber(),
      finalizedBlock: finalizedHeader.number.toNumber(),
    };
  }

  // ── Runtime API: Simulate Trade ─────────────────────────────────────────────

  async simulateTrade(
    tokenIn: string,
    tokenOut: string,
    amountIn: bigint,
    slippageBps: number = 50,
  ): Promise<SimulationResult> {
    const api = await this.getApi();

    try {
      // Call the AtomicTradeEngine runtime API
      const result = await (api as any).rpc.atomicTradeEngine.simulateTrade(
        tokenIn,
        tokenOut,
        amountIn.toString(),
        slippageBps,
      );

      return {
        success: result.success.toHuman(),
        estimatedOutput: BigInt(result.estimatedOutput.toString()),
        priceImpactBps: result.priceImpactBps.toNumber(),
        evmGas: BigInt(result.evmGas.toString()),
        svmCompute: BigInt(result.svmCompute.toString()),
        route: result.route.map((step: any) => ({
          poolId: step.poolId.toHex(),
          tokenIn: step.tokenIn.toHex(),
          tokenOut: step.tokenOut.toHex(),
          amountIn: BigInt(step.amountIn.toString()),
          amountOut: BigInt(step.amountOut.toString()),
          vmType: step.vmType.toNumber() as VmType,
        })),
        error: result.error.isSome ? new TextDecoder().decode(result.error.unwrap()) : undefined,
      };
    } catch (err: any) {
      console.warn('[X3Chain] simulateTrade RPC not available, using estimate fallback:', err.message);
      // Graceful degradation: calculate locally when node not connected
      return this._localSimulate(tokenIn, tokenOut, amountIn, slippageBps);
    }
  }

  /** Local fallback estimate when node is offline */
  private _localSimulate(
    tokenIn: string,
    tokenOut: string,
    amountIn: bigint,
    _slippageBps: number,
  ): SimulationResult {
    // Constant-product AMM: output = (amountIn * reserveOut) / (reserveIn + amountIn)
    // Using placeholder reserves; real reserves come from chain storage
    const reserveIn  = BigInt(1_000_000_000_000);
    const reserveOut = BigInt(1_000_000_000_000);
    const amountInWithFee = amountIn * 997n; // 0.3% fee
    const numerator = amountInWithFee * reserveOut;
    const denominator = reserveIn * 1000n + amountInWithFee;
    const estimatedOutput = numerator / denominator;
    const priceImpact = Number((amountIn * 10000n) / reserveIn);

    return {
      success: true,
      estimatedOutput,
      priceImpactBps: Math.min(priceImpact, 10000),
      evmGas: 150_000n,
      svmCompute: 200_000n,
      route: [{
        poolId: '0x0000000000000000000000000000000000000000000000000000000000000001',
        tokenIn,
        tokenOut,
        amountIn,
        amountOut: estimatedOutput,
        vmType: VmType.Cross,
      }],
    };
  }

  // ── Runtime API: Get Price Data ─────────────────────────────────────────────

  async getPriceData(tokenA: string, tokenB: string): Promise<{
    exists: boolean;
    twapPrice?: bigint;
    latestPrice?: bigint;
    lastUpdated: number;
  }> {
    const api = await this.getApi();

    try {
      const result = await (api as any).rpc.atomicTradeEngine.getPriceData(tokenA, tokenB);
      return {
        exists: result.exists.toHuman(),
        twapPrice: result.twapPrice.isSome ? BigInt(result.twapPrice.unwrap().toString()) : undefined,
        latestPrice: result.latestPrice.isSome ? BigInt(result.latestPrice.unwrap().toString()) : undefined,
        lastUpdated: result.lastUpdated.toNumber(),
      };
    } catch {
      return { exists: false, lastUpdated: 0 };
    }
  }

  // ── Submit: Create + Execute Trade Batch ───────────────────────────────────

  /**
   * Submit a swap as an atomic trade batch to X3 chain.
   *
   * Flow:
   *   1. Build TradeLeg from user inputs
   *   2. Call `atomicTradeEngine.createTradeBatch(legs, deadline)`
   *   3. Wait for `TradeBatchCreated` event to get batch_id
   *   4. Call `atomicTradeEngine.executeTradeBatch(batch_id)` to trigger execution
   *   5. Subscribe to events for `TradeBatchFinalized` or `TradeBatchFailed`
   *
   * @param signer  - Polkadot.js extension signer or dev account
   * @param legs    - Trade legs (usually just 1 for a simple swap)
   * @param onStatus - Callback for status updates
   */
  async submitSwap(
    signerAddress: string,
    legs: TradeLeg[],
    onStatus: (status: SwapStatus) => void,
  ): Promise<TradeReceipt> {
    const api = await this.getApi();

    onStatus({ type: 'awaiting_signature' });

    // Encode legs for the extrinsic
    const encodedLegs = legs.map(leg => ({
      vmType: leg.vmType,
      tokenIn: leg.tokenIn,
      tokenOut: leg.tokenOut,
      amountIn: leg.amountIn.toString(),
      minAmountOut: leg.minAmountOut.toString(),
      deadline: leg.deadline,
    }));

    const deadline = Math.floor(Date.now() / 1000) + 300; // 5 min deadline

    return new Promise<TradeReceipt>(async (resolve, reject) => {
      try {
        onStatus({ type: 'submitting' });

        // Check if we have a browser extension signer
        const injected = await this._getInjectedSigner(signerAddress);

        let unsub: (() => void) | undefined;

        const tx = (api.tx as any).atomicTradeEngine.submitAtomicBatch(encodedLegs, deadline);

        const txOptions = injected
          ? { signer: injected.signer }
          : { nonce: -1 }; // -1 = auto nonce

        unsub = await tx.signAndSend(
          signerAddress,
          txOptions,
          ({ status, events, dispatchError }: any) => {
            if (status.isInBlock) {
              console.log(`[X3Chain] Swap in block: ${status.asInBlock.toHex()}`);
            }

            if (status.isFinalized) {
              const blockHash = status.asFinalized.toHex();
              console.log(`[X3Chain] Swap finalized in block: ${blockHash}`);

              // Check for dispatch errors
              if (dispatchError) {
                const errorMsg = this._decodeDispatchError(api, dispatchError);
                onStatus({ type: 'failed', error: errorMsg });
                unsub?.();
                reject(new Error(errorMsg));
                return;
              }

              // Find TradeBatchFinalized or TradeBatchFailed event
              let batchId = '';
              let failed = false;
              let failReason = '';

              for (const { event } of events) {
                if (api.events.atomicTradeEngine?.TradeBatchFinalized?.is?.(event)) {
                  batchId = event.data[0]?.toHex?.() ?? '';
                }
                if (api.events.atomicTradeEngine?.TradeBatchFailed?.is?.(event)) {
                  failed = true;
                  failReason = event.data[1]?.toString?.() ?? 'Unknown error';
                  batchId = event.data[0]?.toHex?.() ?? '';
                }
              }

              const receipt: TradeReceipt = {
                batchId,
                status: failed ? 'rolled_back' : 'finalized',
                txHash: blockHash,
                blockNumber: undefined,
                legsExecuted: legs.length,
                error: failed ? failReason : undefined,
              };

              if (failed) {
                onStatus({ type: 'failed', error: failReason });
                reject(new Error(failReason));
              } else {
                onStatus({ type: 'finalized', receipt });
                resolve(receipt);
              }

              unsub?.();
            }
          },
        );
      } catch (err: any) {
        const msg = err?.message ?? String(err);
        onStatus({ type: 'failed', error: msg });
        reject(new Error(msg));
      }
    });
  }

  // ── Dev Mode: Submit with Alice (local testnet) ────────────────────────────

  async submitSwapDevMode(
    legs: TradeLeg[],
    onStatus: (status: SwapStatus) => void,
  ): Promise<TradeReceipt> {
    const keyring = new Keyring({ type: 'sr25519' });
    const alice = keyring.addFromUri('//Alice');
    return this.submitSwap(alice.address, legs, onStatus);
  }

  // ── Query: Batch Status ─────────────────────────────────────────────────────

  async getBatchStatus(batchId: string): Promise<TradeReceipt | null> {
    try {
      const api = await this.getApi();
      const result = await (api as any).rpc.atomicTradeEngine.getBatchStatus(batchId);
      if (!result.exists.toHuman()) return null;

      const statusMap: Record<number, TradeReceipt['status']> = {
        0: 'pending',
        1: 'executing',
        2: 'finalized',
        3: 'rolled_back',
      };

      return {
        batchId,
        status: statusMap[result.status.toNumber()] ?? 'pending',
        txHash: undefined,
        blockNumber: result.finalizedAt.isSome ? result.finalizedAt.unwrap().toNumber() : undefined,
        legsExecuted: result.legsExecuted.toNumber(),
      };
    } catch {
      return null;
    }
  }

  // ── Subscribe to new blocks ─────────────────────────────────────────────────

  async subscribeNewBlocks(callback: (blockNumber: number, blockHash: string) => void): Promise<() => void> {
    const api = await this.getApi();
    const unsub = await api.rpc.chain.subscribeNewHeads((header) => {
      callback(header.number.toNumber(), header.hash.toHex());
    });
    return unsub;
  }

  // ── Helpers ─────────────────────────────────────────────────────────────────

  private async _getInjectedSigner(address: string): Promise<{ signer: any } | null> {
    try {
      const { web3Enable, web3FromAddress } = await import('@polkadot/extension-dapp');
      const extensions = await web3Enable('X3 Desktop');
      if (!extensions.length) return null;
      return web3FromAddress(address);
    } catch {
      return null;
    }
  }

  private _decodeDispatchError(api: ApiPromise, dispatchError: any): string {
    if (dispatchError.isModule) {
      try {
        const decoded = api.registry.findMetaError(dispatchError.asModule);
        return `${decoded.section}.${decoded.name}: ${decoded.docs.join(' ')}`;
      } catch {
        return dispatchError.toString();
      }
    }
    return dispatchError.toString();
  }

  /** Convert a human-readable decimal amount to chain units (12 decimals) */
  toChainUnits(amount: number | string, decimals = 12): bigint {
    const parsed = typeof amount === 'string' ? parseFloat(amount) : amount;
    if (isNaN(parsed) || parsed <= 0) return 0n;
    return BigInt(Math.floor(parsed * 10 ** decimals));
  }

  /** Convert chain units back to human-readable */
  fromChainUnits(amount: bigint, decimals = 12): string {
    if (amount === 0n) return '0';
    const divisor = BigInt(10 ** decimals);
    const whole = amount / divisor;
    const frac = amount % divisor;
    const fracStr = frac.toString().padStart(decimals, '0').replace(/0+$/, '');
    return fracStr ? `${whole}.${fracStr}` : whole.toString();
  }
}

// ─── Export singleton ─────────────────────────────────────────────────────────

export const x3Chain = new X3ChainService();
export default x3Chain;
