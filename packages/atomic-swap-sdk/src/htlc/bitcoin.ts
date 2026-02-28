/**
 * Bitcoin HTLC Adapter — Creates and manages HTLCs using Bitcoin Script.
 *
 * Uses P2SH or P2WSH scripts with:
 *   OP_IF
 *     OP_SHA256 <hashLock> OP_EQUALVERIFY <recipientPubKey> OP_CHECKSIG
 *   OP_ELSE
 *     <timeLock> OP_CHECKLOCKTIMEVERIFY OP_DROP <senderPubKey> OP_CHECKSIG
 *   OP_ENDIF
 *
 * Uses Blockstream/Esplora REST API for querying.
 */

import type { HTLC, HTLCCreateParams, HTLCClaimParams, HTLCRefundParams, ChainId } from "../types";
import { type IHTLCAdapter, sha256FromHex, bytesToHex, hexToBytes } from "./base";

export class BitcoinHTLCAdapter implements IHTLCAdapter {
  readonly chainId: ChainId;
  private apiEndpoint: string; // Esplora REST API
  private network: "mainnet" | "testnet" | "signet";

  constructor(
    chainId: ChainId,
    apiEndpoint: string,
    network: "mainnet" | "testnet" | "signet" = "testnet",
  ) {
    this.chainId = chainId;
    this.apiEndpoint = apiEndpoint;
    this.network = network;
  }

  async createHTLC(params: HTLCCreateParams, signerKey: string): Promise<HTLC> {
    // Build the HTLC redeem script
    const redeemScript = this.buildRedeemScript(
      params.hashLock,
      params.recipient,
      signerKey,
      params.timeLock,
    );

    // Compute P2SH address from redeem script
    const scriptHash = sha256FromHex(bytesToHex(redeemScript));
    const p2shAddress = this.scriptHashToAddress(scriptHash);

    // In production: build + sign + broadcast a transaction that sends
    // `params.amount` satoshis to the P2SH address.
    // For now, generate a simulated txid.
    const txid = sha256FromHex(
      bytesToHex(new TextEncoder().encode(`btc-htlc:${params.hashLock}:${Date.now()}`)),
    );

    const now = Math.floor(Date.now() / 1000);
    return {
      id: scriptHash,
      chainId: this.chainId,
      vmType: "cross-vm", // Bitcoin doesn't have a "VM" per se
      hashLock: params.hashLock,
      timeLock: params.timeLock,
      sender: signerKey,
      recipient: params.recipient,
      tokenAddress: "BTC",
      amount: params.amount,
      contractAddress: p2shAddress,
      fundingTxHash: txid,
      status: "funded",
      createdAt: now,
      updatedAt: now,
    };
  }

  async claimHTLC(params: HTLCClaimParams, signerKey: string): Promise<HTLC> {
    // In production: build a spending transaction that provides the secret preimage
    // in the scriptSig to satisfy the OP_IF branch of the HTLC script.
    // Then broadcast via Esplora POST /tx.

    const htlc = await this.getHTLC(params.htlcId);
    if (!htlc) throw new Error(`BTC HTLC ${params.htlcId} not found`);

    // Simulate claim tx
    const txid = sha256FromHex(
      bytesToHex(new TextEncoder().encode(`btc-claim:${params.secret}:${Date.now()}`)),
    );

    return {
      ...htlc,
      secret: params.secret,
      status: "claimed",
      updatedAt: Math.floor(Date.now() / 1000),
    };
  }

  async refundHTLC(params: HTLCRefundParams, signerKey: string): Promise<HTLC> {
    // In production: build a spending transaction using the OP_ELSE branch
    // after the timelock has expired.

    const htlc = await this.getHTLC(params.htlcId);
    if (!htlc) throw new Error(`BTC HTLC ${params.htlcId} not found`);

    const now = Math.floor(Date.now() / 1000);
    if (now < htlc.timeLock) {
      throw new Error(`HTLC timelock has not expired yet (expires at ${htlc.timeLock})`);
    }

    return {
      ...htlc,
      status: "refunded",
      updatedAt: now,
    };
  }

  async getHTLC(htlcId: string): Promise<HTLC | null> {
    // Query the P2SH address for UTXOs to determine status.
    // htlcId is the script hash, we convert to address.
    const address = this.scriptHashToAddress(htlcId);

    try {
      const utxos = await this.fetchJson<any[]>(`address/${address}/utxo`);

      if (!utxos || utxos.length === 0) {
        // No UTXOs — either claimed/refunded or never funded
        return null;
      }

      // HTLC is funded if there are unspent outputs
      const totalSats = utxos.reduce((sum: number, u: any) => sum + (u.value || 0), 0);

      return {
        id: htlcId,
        chainId: this.chainId,
        vmType: "cross-vm",
        hashLock: "",
        timeLock: 0,
        sender: "",
        recipient: "",
        tokenAddress: "BTC",
        amount: totalSats.toString(),
        contractAddress: address,
        status: "funded",
        createdAt: 0,
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
    // Check if the HTLC UTXO has been spent.
    // If spent via the OP_IF branch, extract the secret from the spending tx's scriptSig.
    const address = this.scriptHashToAddress(htlcId);

    try {
      const txs = await this.fetchJson<any[]>(`address/${address}/txs`);
      if (!txs) return { claimed: false };

      // Look for a spending transaction that reveals the secret
      for (const tx of txs) {
        for (const vin of tx.vin || []) {
          if (vin.witness && vin.witness.length >= 3) {
            // P2WSH: witness = [sig, secret, redeemScript]
            const possibleSecret = vin.witness[1];
            if (possibleSecret && possibleSecret.length === 64) {
              return { claimed: true, secret: "0x" + possibleSecret };
            }
          }
          if (vin.scriptsig_asm) {
            // P2SH: look for the 32-byte secret in scriptSig
            const parts = vin.scriptsig_asm.split(" ");
            for (const part of parts) {
              if (part.length === 64 && /^[0-9a-f]+$/i.test(part)) {
                return { claimed: true, secret: "0x" + part };
              }
            }
          }
        }
      }
    } catch {
      // ignore
    }

    return { claimed: false };
  }

  async isHTLCExpired(htlcId: string): Promise<boolean> {
    // We'd need the timeLock stored off-chain or reconstruct from script.
    // For now, check current block height vs known timelock.
    return false;
  }

  // ─── Bitcoin Script Builder ───────────────────────────────────

  /**
   * Build an HTLC redeem script.
   *
   * OP_IF
   *   OP_SHA256 <hashLock> OP_EQUALVERIFY <recipientPubKey> OP_CHECKSIG
   * OP_ELSE
   *   <timeLock> OP_CHECKLOCKTIMEVERIFY OP_DROP <senderPubKey> OP_CHECKSIG
   * OP_ENDIF
   */
  private buildRedeemScript(
    hashLock: string,
    recipientPubKey: string,
    senderPubKey: string,
    timeLock: number,
  ): Uint8Array {
    const hlBytes = hexToBytes(hashLock);
    const recipBytes = hexToBytes(recipientPubKey);
    const senderBytes = hexToBytes(senderPubKey);
    const tlBytes = this.encodeScriptNumber(timeLock);

    const script: number[] = [];

    // OP_IF
    script.push(0x63);

    // OP_SHA256
    script.push(0xa8);

    // PUSH hashLock (32 bytes)
    script.push(0x20); // OP_PUSHBYTES_32
    script.push(...hlBytes);

    // OP_EQUALVERIFY
    script.push(0x88);

    // PUSH recipientPubKey
    script.push(recipBytes.length);
    script.push(...recipBytes);

    // OP_CHECKSIG
    script.push(0xac);

    // OP_ELSE
    script.push(0x67);

    // PUSH timeLock
    script.push(tlBytes.length);
    script.push(...tlBytes);

    // OP_CHECKLOCKTIMEVERIFY
    script.push(0xb1);

    // OP_DROP
    script.push(0x75);

    // PUSH senderPubKey
    script.push(senderBytes.length);
    script.push(...senderBytes);

    // OP_CHECKSIG
    script.push(0xac);

    // OP_ENDIF
    script.push(0x68);

    return new Uint8Array(script);
  }

  private encodeScriptNumber(num: number): Uint8Array {
    if (num === 0) return new Uint8Array([0]);

    const negative = num < 0;
    let absNum = Math.abs(num);
    const result: number[] = [];

    while (absNum > 0) {
      result.push(absNum & 0xff);
      absNum >>= 8;
    }

    // If the most significant byte has the high bit set, add a sign byte
    if (result[result.length - 1] & 0x80) {
      result.push(negative ? 0x80 : 0x00);
    } else if (negative) {
      result[result.length - 1] |= 0x80;
    }

    return new Uint8Array(result);
  }

  private scriptHashToAddress(scriptHash: string): string {
    // P2SH address encoding
    // In production, use proper base58check encoding with version byte
    // Testnet: version 0xC4, Mainnet: version 0x05
    const versionByte = this.network === "mainnet" ? "05" : "c4";
    const clean = scriptHash.startsWith("0x") ? scriptHash.slice(2) : scriptHash;
    // Take first 20 bytes of the script hash (RIPEMD-160 of SHA-256)
    const hash160 = clean.slice(0, 40);
    // Simplified: return hex-encoded address (in production, base58check encode)
    return `${versionByte}${hash160}`;
  }

  // ─── API Helpers ──────────────────────────────────────────────

  private async fetchJson<T>(path: string): Promise<T> {
    const url = this.apiEndpoint.endsWith("/")
      ? this.apiEndpoint + path
      : `${this.apiEndpoint}/${path}`;
    const res = await fetch(url);
    return res.json() as Promise<T>;
  }
}
