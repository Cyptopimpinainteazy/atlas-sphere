/**
 * Substrate Adapter — minimal implementation using @polkadot/api
 */

import { ApiPromise, WsProvider } from "@polkadot/api";
import type { Block, Transaction, ChainDescriptor } from "../types";
import { BaseChainAdapter } from "./base";

export class SubstrateAdapter extends BaseChainAdapter {
  readonly chain: ChainDescriptor;
  private api?: ApiPromise;

  constructor(chain: ChainDescriptor) {
    super();
    this.chain = chain;
  }

  async connect(endpoint: string): Promise<void> {
    this.endpoint = endpoint;
    const ws = endpoint.startsWith("ws")
      ? endpoint
      : endpoint.replace(/^http/, "ws");

    const provider = new WsProvider(ws);
    this.api = await ApiPromise.create({ provider });
    this.connected = true;
    this.startTime = Date.now();
  }

  async disconnect(): Promise<void> {
    if (this.api) {
      await this.api.disconnect();
      this.api = undefined;
    }
    this.connected = false;
  }

  isConnected(): boolean {
    return this.connected && !!this.api && this.api.isConnected;
  }

  async getLatestBlock(): Promise<Block> {
    if (!this.api) throw new Error("Not connected");
    const header = await this.api.rpc.chain.getHeader();
    const hash = header.hash.toHex();
    const number = header.number.toNumber();
    const timestamp = new Date().toISOString();

    return {
      hash,
      number,
      parentHash: header.parentHash.toHex(),
      timestamp,
      txCount: 0,
      size: 0,
      raw: header.toHex(),
    };
  }

  async getBlock(numberOrHash: string | number): Promise<Block> {
    if (!this.api) throw new Error("Not connected");
    let hash;
    if (typeof numberOrHash === "number") {
      hash = await this.api.rpc.chain.getBlockHash(numberOrHash);
    } else {
      hash = numberOrHash;
    }
    const block = await this.api.rpc.chain.getBlock(hash);
    const header = block.block.header;
    return {
      hash: hash.toString(),
      number: header.number.toNumber(),
      parentHash: header.parentHash.toHex(),
      timestamp: new Date().toISOString(),
      txCount: block.block.extrinsics.length,
      size: 0,
      raw: block.toHex(),
    };
  }

  async getTransaction(hash: string): Promise<Transaction> {
    // Substrate transactions are extrinsics; retrieving by hash is non-trivial
    // Implementing a minimal stub that returns the hash and marks it pending
    return {
      hash,
      from: "",
      value: "0",
      nonce: 0,
      raw: null,
    } as Transaction;
  }
}
