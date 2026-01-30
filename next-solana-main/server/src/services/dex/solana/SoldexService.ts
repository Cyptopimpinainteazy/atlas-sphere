import { Connection, TransactionInstruction } from "@solana/web3.js";
import * as winston from "winston";

import { BaseSolanaDEXService } from "../BaseSolanaDEXService";
import {
  SolanaPool,
  SolanaQuote,
  SwapParams,
  SwapResult,
  DEXError,
} from "../types";

export class SoldexService extends BaseSolanaDEXService {
  public readonly name = "soldex" as const;

  constructor(
    connection: Connection,
    logger: winston.Logger,
    config: any
  ) {
    super(connection, logger, config);
  }

  async initialize(): Promise<void> {
    this.logger?.info("Initializing Soldex DEX service (placeholder - disabled)...");
    // Mark as disabled since program ID is TBD
    this.logger?.warn("Soldex DEX service disabled - program ID research required");
  }

  async discoverPools(): Promise<SolanaPool[]> {
    // Service is disabled/placeholder
    return [];
  }

  async getQuote(inputMint: string, outputMint: string, amount: string): Promise<SolanaQuote> {
    throw new DEXError("Soldex DEX service disabled", "SERVICE_DISABLED", this.name);
  }

  async executeSwap(params: SwapParams, signTransaction: (tx: any) => Promise<any>): Promise<SwapResult> {
    throw new DEXError("Soldex DEX service disabled", "SERVICE_DISABLED", this.name, params);
  }

  async buildSwapInstruction(params: SwapParams): Promise<TransactionInstruction> {
    throw new DEXError("Soldex DEX service disabled", "SERVICE_DISABLED", this.name, params);
  }
}
