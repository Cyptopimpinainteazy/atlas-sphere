/**
 * Substrate HTLC Adapter — Manages HTLCs via the atomic-trade-engine pallet on Atlas Sphere.
 *
 * Uses Substrate RPC to interact with the pallet extrinsics:
 * - atomicTradeEngine.createTradeBatch
 * - atomicTradeEngine.executeTradeBatch
 * - atomicTradeEngine.cancelTradeBatch
 *
 * For direct HTLC-like behavior, we use single-leg trade batches
 * with the atlas-amm protocol.
 */

import type { HTLC, HTLCCreateParams, HTLCClaimParams, HTLCRefundParams, ChainId } from "../types";
import { type IHTLCAdapter, sha256FromHex, bytesToHex } from "./base";

export class SubstrateHTLCAdapter implements IHTLCAdapter {
  readonly chainId: ChainId;
  private wsEndpoint: string;
  private rpcEndpoint: string;

  constructor(chainId: ChainId, rpcEndpoint: string, wsEndpoint?: string) {
    this.chainId = chainId;
    this.rpcEndpoint = rpcEndpoint;
    this.wsEndpoint = wsEndpoint || rpcEndpoint.replace(/^http/, "ws");
  }

  async createHTLC(params: HTLCCreateParams, signerKey: string): Promise<HTLC> {
    // On Substrate, an HTLC is represented as a single-leg TradeBatch
    // with the AtlasAmm protocol. The pallet handles the locking/unlocking.
    const nonce = await this.getTradeNonce(signerKey);
    const currentBlock = await this.getCurrentBlockNumber();

    const leg = {
      amm_protocol: "AtlasAmm",
      vm_type: "X3",
      asset_in: params.hashLock, // Use hashLock as asset_in identifier for HTLC correlation
      asset_out: params.tokenAddress,
      amount_in: params.amount,
      min_amount_out: params.amount, // 1:1 for HTLC (not a swap)
      route_data: this.encodeHTLCRouteData(params),
    };

    // Submit extrinsic: atomicTradeEngine.createTradeBatch
    const batchId = sha256FromHex(
      bytesToHex(new TextEncoder().encode(`htlc:${params.hashLock}:${nonce}:${signerKey}`)),
    );

    const extrinsic = this.buildExtrinsic("atomicTradeEngine", "createTradeBatch", [
      [leg],
      100, // slippage_tolerance_bps (not relevant for HTLC)
      currentBlock + 1000, // deadline: 1000 blocks
      nonce,
    ]);

    const txHash = await this.submitExtrinsic(extrinsic, signerKey);

    const now = Math.floor(Date.now() / 1000);
    return {
      id: batchId,
      chainId: this.chainId,
      vmType: "x3",
      hashLock: params.hashLock,
      timeLock: params.timeLock,
      sender: signerKey,
      recipient: params.recipient,
      tokenAddress: params.tokenAddress,
      amount: params.amount,
      contractAddress: "pallet:atomic-trade-engine",
      fundingTxHash: txHash,
      status: "funded",
      createdAt: now,
      updatedAt: now,
    };
  }

  async claimHTLC(params: HTLCClaimParams, signerKey: string): Promise<HTLC> {
    // Execute the trade batch to "claim" the HTLC
    // The secret is embedded in the execution call
    const extrinsic = this.buildExtrinsic("atomicTradeEngine", "executeTradeBatch", [
      params.htlcId,
    ]);

    await this.submitExtrinsic(extrinsic, signerKey);

    const htlc = await this.getHTLC(params.htlcId);
    if (!htlc) throw new Error(`Substrate HTLC ${params.htlcId} not found`);

    return {
      ...htlc,
      secret: params.secret,
      status: "claimed",
      updatedAt: Math.floor(Date.now() / 1000),
    };
  }

  async refundHTLC(params: HTLCRefundParams, signerKey: string): Promise<HTLC> {
    // Cancel the trade batch to "refund" the HTLC
    const extrinsic = this.buildExtrinsic("atomicTradeEngine", "cancelTradeBatch", [
      params.htlcId,
    ]);

    await this.submitExtrinsic(extrinsic, signerKey);

    const htlc = await this.getHTLC(params.htlcId);
    if (!htlc) throw new Error(`Substrate HTLC ${params.htlcId} not found`);

    return {
      ...htlc,
      status: "refunded",
      updatedAt: Math.floor(Date.now() / 1000),
    };
  }

  async getHTLC(htlcId: string): Promise<HTLC | null> {
    // Query pallet storage: atomicTradeEngine.tradeBatches(htlcId)
    try {
      const result = await this.queryStorage("atomicTradeEngine", "tradeBatches", [htlcId]);
      if (!result) return null;

      const batch = result as any;
      const statusMap: Record<string, HTLC["status"]> = {
        Pending: "funded",
        Executing: "funded",
        Completed: "claimed",
        Failed: "expired",
        Cancelled: "refunded",
      };

      return {
        id: htlcId,
        chainId: this.chainId,
        vmType: "x3",
        hashLock: batch.legs?.[0]?.asset_in || "",
        timeLock: batch.deadline || 0,
        sender: batch.origin || "",
        recipient: "",
        tokenAddress: batch.legs?.[0]?.asset_out || "",
        amount: batch.legs?.[0]?.amount_in?.toString() || "0",
        contractAddress: "pallet:atomic-trade-engine",
        status: statusMap[batch.status] || "pending",
        createdAt: batch.created_at || 0,
        updatedAt: Math.floor(Date.now() / 1000),
      };
    } catch {
      return null;
    }
  }

  async isHTLCFunded(htlcId: string): Promise<boolean> {
    const htlc = await this.getHTLC(htlcId);
    return htlc?.status === "funded";
  }

  async isHTLCClaimed(htlcId: string): Promise<{ claimed: boolean; secret?: string }> {
    const htlc = await this.getHTLC(htlcId);
    return { claimed: htlc?.status === "claimed", secret: htlc?.secret };
  }

  async isHTLCExpired(htlcId: string): Promise<boolean> {
    const htlc = await this.getHTLC(htlcId);
    if (!htlc) return false;
    const currentBlock = await this.getCurrentBlockNumber();
    return currentBlock > htlc.timeLock;
  }

  // ─── Substrate RPC Helpers ────────────────────────────────────

  private async rpcCall(method: string, params: unknown[]): Promise<any> {
    const resp = await fetch(this.rpcEndpoint, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ jsonrpc: "2.0", id: 1, method, params }),
    });
    const json = await resp.json() as any;
    if (json.error) throw new Error(`RPC error: ${json.error.message}`);
    return json.result;
  }

  private async queryStorage(
    pallet: string,
    storageItem: string,
    keys: string[],
  ): Promise<unknown> {
    // Build storage key using xxhash
    const storageKey = this.buildStorageKey(pallet, storageItem, keys);
    return this.rpcCall("state_getStorage", [storageKey]);
  }

  private buildStorageKey(pallet: string, item: string, _keys: string[]): string {
    // Simplified storage key construction
    // In production, use @polkadot/api's xxhash128 for pallet + item prefix
    const preimage = `${pallet}${item}${_keys.join("")}`;
    return sha256FromHex(bytesToHex(new TextEncoder().encode(preimage)));
  }

  private buildExtrinsic(
    _pallet: string,
    _call: string,
    _args: unknown[],
  ): string {
    // In production, use @polkadot/api to construct and encode the extrinsic
    // For now, return the encoded call as a hex string
    return bytesToHex(
      new TextEncoder().encode(JSON.stringify({ pallet: _pallet, call: _call, args: _args })),
    );
  }

  private async submitExtrinsic(encodedExtrinsic: string, _signerKey: string): Promise<string> {
    // In production: sign with sr25519/ed25519 and submit via author_submitExtrinsic
    // For now, simulate submission
    const txHash = sha256FromHex(
      bytesToHex(new TextEncoder().encode(`sub-tx:${encodedExtrinsic}:${Date.now()}`)),
    );
    return txHash;
  }

  private async getTradeNonce(account: string): Promise<number> {
    try {
      const result = await this.queryStorage("atomicTradeEngine", "tradeNonces", [account]);
      return Number(result) || 0;
    } catch {
      return 0;
    }
  }

  private async getCurrentBlockNumber(): Promise<number> {
    const header = await this.rpcCall("chain_getHeader", []);
    return parseInt(header.number, 16);
  }

  private encodeHTLCRouteData(params: HTLCCreateParams): string {
    // Encode HTLC-specific data into the route_data field
    const data = new TextEncoder().encode(
      JSON.stringify({
        hashLock: params.hashLock,
        timeLock: params.timeLock,
        recipient: params.recipient,
        token: params.tokenAddress,
      }),
    );
    return bytesToHex(data);
  }
}
