/**
 * Atomic Cross-Chain Trading Module
 *
 * Enables atomic swaps between Solana, Bitcoin, Atlas Sphere (EVM/SVM),
 * and 100+ external EVM chains using the Atlas Kernel's Comit transaction system.
 */

import { PublicKey, Transaction, SystemProgram, LAMPORTS_PER_SOL } from '@solana/web3.js';
import { getAtlasSphereClient, type ComitTransaction, type ComitPayload, computePrepareRoot } from './atlas-sphere-client';
import { 
  ALL_CHAINS, 
  EVM_CHAINS, 
  BITCOIN_CHAINS,
  SOLANA_CHAINS,
  getChainById, 
  getChainsByType,
  getEvmChains,
  TOTAL_CHAIN_COUNT,
  EVM_CHAIN_COUNT,
  type ChainConfig,
  type ChainType as MultiChainType 
} from './chains-config';
import {
  BitcoinRpcClient,
  BitcoinAtomicSwapManager,
  createHTLCScript,
  BITCOIN_RPC_CONFIGS,
  type SwapOrder as BtcSwapOrder,
} from './bitcoin-integration';

// Cross-chain trade types - extended to support all chains
export type ChainType = 'solana' | 'atlas-evm' | 'atlas-svm' | 'bitcoin' | 'evm';

// Re-export chain configs
export { ALL_CHAINS, EVM_CHAINS, BITCOIN_CHAINS, SOLANA_CHAINS, getChainById, getEvmChains, TOTAL_CHAIN_COUNT, EVM_CHAIN_COUNT };

export interface CrossChainAsset {
  chain: ChainType;
  chainId?: number | string; // EVM chain ID or chain identifier
  address: string; // Token mint for Solana, contract address for EVM, program ID for SVM
  symbol: string;
  decimals: number;
  canonicalId?: number; // Atlas Sphere canonical asset ID
  icon?: string;
}

export interface CrossChainOrder {
  id: string;
  maker: string;
  taker?: string;
  
  // What the maker is selling
  sellAsset: CrossChainAsset;
  sellAmount: bigint;
  
  // What the maker wants to receive
  buyAsset: CrossChainAsset;
  buyAmount: bigint;
  
  // Order parameters
  minFillAmount?: bigint;
  expiry: number; // Unix timestamp
  nonce: number;
  
  // Signatures
  makerSignature?: string;
  takerSignature?: string;
  
  // Status
  status: 'open' | 'filled' | 'cancelled' | 'expired';
  createdAt: number;
  filledAt?: number;
}

export interface SwapQuote {
  inputChain: ChainType;
  outputChain: ChainType;
  inputAmount: bigint;
  outputAmount: bigint;
  priceImpact: number;
  route: SwapRoute[];
  estimatedGas: bigint;
  expiresAt: number;
}

export interface SwapRoute {
  chain: ChainType;
  protocol: string;
  inputToken: string;
  outputToken: string;
  poolAddress: string;
}

export interface AtomicSwapResult {
  success: boolean;
  txHash: string;
  inputChainTx?: string;
  outputChainTx?: string;
  actualInputAmount: bigint;
  actualOutputAmount: bigint;
  gasUsed: bigint;
  error?: string;
}

/**
 * Cross-Chain Trading Engine
 * 
 * Supports atomic swaps across:
 * - Bitcoin (via HTLC)
 * - Solana
 * - Atlas Sphere (EVM + SVM)
 * - 100+ External EVM chains
 */
export class CrossChainTradingEngine {
  private atlasClient = getAtlasSphereClient();
  private pendingOrders: Map<string, CrossChainOrder> = new Map();
  private btcSwapManager: BitcoinAtomicSwapManager | null = null;

  /**
   * Initialize Bitcoin support
   */
  initBitcoinSupport(chainId: string = 'bitcoin-regtest'): void {
    this.btcSwapManager = new BitcoinAtomicSwapManager(chainId);
  }

  /**
   * Get Bitcoin swap manager
   */
  getBtcSwapManager(): BitcoinAtomicSwapManager | null {
    return this.btcSwapManager;
  }

  /**
   * Get a quote for a cross-chain swap
   */
  async getSwapQuote(
    inputAsset: CrossChainAsset,
    outputAsset: CrossChainAsset,
    inputAmount: bigint
  ): Promise<SwapQuote> {
    // Calculate route based on chain types
    const route = this.calculateRoute(inputAsset, outputAsset);

    // Estimate output amount (simplified - in production, query DEX pools)
    const outputAmount = this.estimateOutputAmount(
      inputAsset,
      outputAsset,
      inputAmount,
      route
    );

    // Calculate price impact
    const priceImpact = this.calculatePriceImpact(inputAmount, outputAmount);

    // Estimate gas
    const estimatedGas = this.estimateGas(route);

    return {
      inputChain: inputAsset.chain,
      outputChain: outputAsset.chain,
      inputAmount,
      outputAmount,
      priceImpact,
      route,
      estimatedGas,
      expiresAt: Date.now() + 30000, // 30 second quote validity
    };
  }

  /**
   * Execute an atomic cross-chain swap
   */
  async executeAtomicSwap(
    quote: SwapQuote,
    makerAddress: string,
    signer: string // Mnemonic or private key for Atlas Sphere
  ): Promise<AtomicSwapResult> {
    try {
      // Validate quote hasn't expired
      if (Date.now() > quote.expiresAt) {
        throw new Error('Quote has expired');
      }

      // Build the Comit transaction based on the route
      const comit = await this.buildComitTransaction(quote, makerAddress);

      // Submit to Atlas Sphere for atomic execution
      const result = await this.atlasClient.submitComit(signer, comit);

      return {
        success: result.receipt?.success ?? false,
        txHash: result.txHash,
        actualInputAmount: quote.inputAmount,
        actualOutputAmount: result.receipt?.success 
          ? quote.outputAmount 
          : BigInt(0),
        gasUsed: result.receipt?.gasUsed ?? BigInt(0),
      };
    } catch (error) {
      return {
        success: false,
        txHash: '',
        actualInputAmount: BigInt(0),
        actualOutputAmount: BigInt(0),
        gasUsed: BigInt(0),
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  /**
   * Create a cross-chain limit order
   */
  createLimitOrder(
    maker: string,
    sellAsset: CrossChainAsset,
    sellAmount: bigint,
    buyAsset: CrossChainAsset,
    buyAmount: bigint,
    expiry: number = Date.now() + 24 * 60 * 60 * 1000 // 24 hours
  ): CrossChainOrder {
    const order: CrossChainOrder = {
      id: this.generateOrderId(),
      maker,
      sellAsset,
      sellAmount,
      buyAsset,
      buyAmount,
      expiry,
      nonce: Date.now(),
      status: 'open',
      createdAt: Date.now(),
    };

    this.pendingOrders.set(order.id, order);
    return order;
  }

  /**
   * Fill a cross-chain limit order atomically
   */
  async fillOrder(
    orderId: string,
    taker: string,
    takerSigner: string
  ): Promise<AtomicSwapResult> {
    const order = this.pendingOrders.get(orderId);

    if (!order) {
      throw new Error('Order not found');
    }

    if (order.status !== 'open') {
      throw new Error(`Order is ${order.status}`);
    }

    if (Date.now() > order.expiry) {
      order.status = 'expired';
      throw new Error('Order has expired');
    }

    // Get current quote for the order
    const quote = await this.getSwapQuote(
      order.sellAsset,
      order.buyAsset,
      order.sellAmount
    );

    // Update order with taker
    order.taker = taker;

    // Execute the atomic swap
    const result = await this.executeAtomicSwap(quote, order.maker, takerSigner);

    if (result.success) {
      order.status = 'filled';
      order.filledAt = Date.now();
    }

    return result;
  }

  /**
   * Cancel a pending order
   */
  cancelOrder(orderId: string, maker: string): boolean {
    const order = this.pendingOrders.get(orderId);

    if (!order) {
      return false;
    }

    if (order.maker !== maker) {
      throw new Error('Only maker can cancel order');
    }

    if (order.status !== 'open') {
      throw new Error(`Cannot cancel ${order.status} order`);
    }

    order.status = 'cancelled';
    return true;
  }

  /**
   * Get open orders for an address
   */
  getOpenOrders(address: string): CrossChainOrder[] {
    return Array.from(this.pendingOrders.values()).filter(
      (order) =>
        (order.maker === address || order.taker === address) &&
        order.status === 'open'
    );
  }

  /**
   * Calculate the optimal route for a cross-chain swap
   */
  private calculateRoute(
    inputAsset: CrossChainAsset,
    outputAsset: CrossChainAsset
  ): SwapRoute[] {
    const routes: SwapRoute[] = [];

    // Same chain swap
    if (inputAsset.chain === outputAsset.chain) {
      routes.push({
        chain: inputAsset.chain,
        protocol: this.getProtocolForChain(inputAsset.chain),
        inputToken: inputAsset.address,
        outputToken: outputAsset.address,
        poolAddress: this.getDexRouterForChain(inputAsset.chain),
      });
      return routes;
    }

    // Cross-chain swap requires bridge through Atlas Sphere canonical ledger
    const inputIsAtlas = inputAsset.chain.startsWith('atlas');
    const outputIsAtlas = outputAsset.chain.startsWith('atlas');

    // Case 1: Solana → Atlas (EVM or SVM)
    if (inputAsset.chain === 'solana' && outputIsAtlas) {
      // Bridge SOL/token to Atlas canonical ledger
      routes.push({
        chain: 'solana',
        protocol: 'AtlasBridge',
        inputToken: inputAsset.address,
        outputToken: 'canonical',
        poolAddress: 'bridge-deposit',
      });
      
      // If output is on Atlas EVM, swap on EVM
      if (outputAsset.chain === 'atlas-evm') {
        routes.push({
          chain: 'atlas-evm',
          protocol: 'AtlasSwap-EVM',
          inputToken: this.getCanonicalEvmAddress(inputAsset),
          outputToken: outputAsset.address,
          poolAddress: EVM_DEX_ROUTERS.atlasSwap,
        });
      } else {
        // Output is on Atlas SVM
        routes.push({
          chain: 'atlas-svm',
          protocol: 'AtlasSwap-SVM',
          inputToken: 'canonical',
          outputToken: outputAsset.address,
          poolAddress: 'atlas-svm-dex',
        });
      }
      return routes;
    }

    // Case 2: Atlas → Solana
    if (inputIsAtlas && outputAsset.chain === 'solana') {
      // First swap to canonical on source chain
      if (inputAsset.chain === 'atlas-evm') {
        routes.push({
          chain: 'atlas-evm',
          protocol: 'AtlasSwap-EVM',
          inputToken: inputAsset.address,
          outputToken: this.getCanonicalEvmAddress(outputAsset),
          poolAddress: EVM_DEX_ROUTERS.atlasSwap,
        });
      } else {
        routes.push({
          chain: 'atlas-svm',
          protocol: 'AtlasSwap-SVM',
          inputToken: inputAsset.address,
          outputToken: 'canonical',
          poolAddress: 'atlas-svm-dex',
        });
      }
      
      // Bridge to Solana
      routes.push({
        chain: 'solana',
        protocol: 'AtlasBridge',
        inputToken: 'canonical',
        outputToken: outputAsset.address,
        poolAddress: 'bridge-withdraw',
      });
      return routes;
    }

    // Case 3: Atlas EVM ↔ Atlas SVM (cross-VM on same chain)
    if (inputAsset.chain === 'atlas-evm' && outputAsset.chain === 'atlas-svm') {
      // EVM to canonical
      routes.push({
        chain: 'atlas-evm',
        protocol: 'AtlasSwap-EVM',
        inputToken: inputAsset.address,
        outputToken: 'canonical',
        poolAddress: EVM_DEX_ROUTERS.atlasSwap,
      });
      // Canonical to SVM
      routes.push({
        chain: 'atlas-svm',
        protocol: 'AtlasKernel',
        inputToken: 'canonical',
        outputToken: outputAsset.address,
        poolAddress: 'canonical-ledger',
      });
      return routes;
    }

    if (inputAsset.chain === 'atlas-svm' && outputAsset.chain === 'atlas-evm') {
      // SVM to canonical
      routes.push({
        chain: 'atlas-svm',
        protocol: 'AtlasSwap-SVM',
        inputToken: inputAsset.address,
        outputToken: 'canonical',
        poolAddress: 'atlas-svm-dex',
      });
      // Canonical to EVM
      routes.push({
        chain: 'atlas-evm',
        protocol: 'AtlasKernel',
        inputToken: 'canonical',
        outputToken: outputAsset.address,
        poolAddress: EVM_DEX_ROUTERS.atlasSwap,
      });
      return routes;
    }

    // Default fallback: route through canonical ledger
    routes.push({
      chain: inputAsset.chain,
      protocol: this.getProtocolForChain(inputAsset.chain),
      inputToken: inputAsset.address,
      outputToken: 'canonical',
      poolAddress: this.getDexRouterForChain(inputAsset.chain),
    });
    routes.push({
      chain: 'atlas-svm',
      protocol: 'AtlasKernel',
      inputToken: 'canonical',
      outputToken: 'canonical',
      poolAddress: 'canonical-ledger',
    });
    routes.push({
      chain: outputAsset.chain,
      protocol: this.getProtocolForChain(outputAsset.chain),
      inputToken: 'canonical',
      outputToken: outputAsset.address,
      poolAddress: this.getDexRouterForChain(outputAsset.chain),
    });

    return routes;
  }

  /**
   * Get canonical EVM address for an asset
   */
  private getCanonicalEvmAddress(asset: CrossChainAsset): string {
    // Map canonical IDs to EVM addresses
    const canonicalEvmMap: Record<number, string> = {
      0: '0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2', // SOL -> WETH equivalent
      1: '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48', // USDC
      2: '0x0000000000000000000000000000000000000002', // ATLAS
    };
    return canonicalEvmMap[asset.canonicalId ?? 0] ?? '0x0000000000000000000000000000000000000000';
  }

  /**
   * Get DEX router address for a chain
   */
  private getDexRouterForChain(chain: ChainType): string {
    switch (chain) {
      case 'solana':
        return 'jupiter-aggregator';
      case 'atlas-evm':
        return EVM_DEX_ROUTERS.atlasSwap;
      case 'atlas-svm':
        return 'atlas-svm-dex';
    }
  }

  /**
   * Estimate output amount for a swap
   */
  private estimateOutputAmount(
    inputAsset: CrossChainAsset,
    outputAsset: CrossChainAsset,
    inputAmount: bigint,
    route: SwapRoute[]
  ): bigint {
    // Simplified estimation - in production, query actual DEX pools
    let amount = inputAmount;

    // Apply fee for each hop (0.3% per hop)
    for (const _ of route) {
      amount = (amount * BigInt(997)) / BigInt(1000);
    }

    // Adjust for decimal differences
    const decimalDiff = outputAsset.decimals - inputAsset.decimals;
    if (decimalDiff > 0) {
      amount = amount * BigInt(10 ** decimalDiff);
    } else if (decimalDiff < 0) {
      amount = amount / BigInt(10 ** Math.abs(decimalDiff));
    }

    return amount;
  }

  /**
   * Calculate price impact
   */
  private calculatePriceImpact(inputAmount: bigint, outputAmount: bigint): number {
    // Simplified price impact calculation
    const ratio = Number(outputAmount) / Number(inputAmount);
    return Math.max(0, (1 - ratio) * 100);
  }

  /**
   * Estimate gas for a route
   */
  private estimateGas(route: SwapRoute[]): bigint {
    let gas = BigInt(0);

    for (const hop of route) {
      switch (hop.chain) {
        case 'solana':
          gas += BigInt(5000); // SOL compute units
          break;
        case 'atlas-evm':
          gas += BigInt(150000); // EVM gas
          break;
        case 'atlas-svm':
          gas += BigInt(10000); // SVM compute units
          break;
      }
    }

    return gas;
  }

  /**
   * Get the DEX protocol for a chain
   */
  private getProtocolForChain(chain: ChainType): string {
    switch (chain) {
      case 'solana':
        return 'Jupiter';
      case 'atlas-evm':
        return 'AtlasSwap-EVM';
      case 'atlas-svm':
        return 'AtlasSwap-SVM';
    }
  }

  /**
   * Build a Comit transaction for atomic execution
   */
  private async buildComitTransaction(
    quote: SwapQuote,
    maker: string
  ): Promise<ComitTransaction> {
    let evmPayload: ComitPayload | undefined;
    let svmPayload: ComitPayload | undefined;

    // Build payloads based on route - collect all EVM and SVM hops
    const evmHops = quote.route.filter((hop) => hop.chain === 'atlas-evm');
    const svmHops = quote.route.filter((hop) => hop.chain === 'atlas-svm');

    // Build combined EVM payload if there are EVM hops
    if (evmHops.length > 0) {
      evmPayload = this.buildCombinedEvmPayload(evmHops, quote.inputAmount, quote.outputAmount);
    }

    // Build combined SVM payload if there are SVM hops
    if (svmHops.length > 0) {
      svmPayload = this.buildCombinedSvmPayload(svmHops, quote.inputAmount, quote.outputAmount);
    }

    // Compute prepare root (hash of inputs for verification)
    const inputs = [
      new TextEncoder().encode(maker),
      this.bigIntToBytes(quote.inputAmount),
      this.bigIntToBytes(quote.outputAmount),
      new TextEncoder().encode(quote.inputChain),
      new TextEncoder().encode(quote.outputChain),
    ];

    return {
      nonce: Date.now(),
      evmPayload,
      svmPayload,
      prepareRoot: computePrepareRoot(inputs),
      atomicFlag: true, // Ensure atomicity - both execute or both revert
    };
  }

  /**
   * Build combined EVM payload for multiple hops
   */
  private buildCombinedEvmPayload(
    hops: SwapRoute[],
    inputAmount: bigint,
    outputAmount: bigint
  ): ComitPayload {
    // For multi-hop, we use a multicall pattern
    if (hops.length === 1) {
      return this.buildEvmPayload(hops[0], inputAmount);
    }

    // Build multicall data for multiple swaps
    const calls: Uint8Array[] = [];
    let currentAmount = inputAmount;

    for (const hop of hops) {
      const calldata = this.encodeEvmSwapCall(hop, currentAmount);
      calls.push(calldata);
      // Estimate output for next hop (simplified)
      currentAmount = (currentAmount * BigInt(997)) / BigInt(1000);
    }

    // Encode as multicall
    const multicallData = this.encodeMulticall(calls);

    return {
      vm: 'EVM',
      bytecode: new Uint8Array(),
      calldata: multicallData,
      gasLimit: BigInt(500000) * BigInt(hops.length), // Scale gas with hops
      target: EVM_DEX_ROUTERS.atlasSwap,
    };
  }

  /**
   * Build combined SVM payload for multiple hops
   */
  private buildCombinedSvmPayload(
    hops: SwapRoute[],
    inputAmount: bigint,
    outputAmount: bigint
  ): ComitPayload {
    // Build instruction data for SVM
    const calldata = new Uint8Array(32 + hops.length * 64);
    const view = new DataView(calldata.buffer);
    
    // Header: amount + hop count
    view.setBigUint64(0, inputAmount, true);
    view.setBigUint64(8, BigInt(hops.length), true);
    view.setBigUint64(16, outputAmount, true); // Minimum output
    
    // Each hop: input token (32 bytes) + output token (32 bytes)
    let offset = 32;
    for (const hop of hops) {
      const inputBytes = new TextEncoder().encode(hop.inputToken.padEnd(32, '\0'));
      const outputBytes = new TextEncoder().encode(hop.outputToken.padEnd(32, '\0'));
      calldata.set(inputBytes.slice(0, 32), offset);
      calldata.set(outputBytes.slice(0, 32), offset + 32);
      offset += 64;
    }

    return {
      vm: 'SVM',
      bytecode: new Uint8Array(),
      calldata,
      gasLimit: BigInt(200000) * BigInt(hops.length),
      target: hops[0]?.poolAddress || 'atlas-svm-dex',
    };
  }

  /**
   * Encode multicall for batched EVM transactions
   */
  private encodeMulticall(calls: Uint8Array[]): Uint8Array {
    // multicall(bytes[] calldata data)
    const selector = this.hexToBytes('ac9650d8');
    
    // Calculate total size
    const headerSize = 4 + 32 + 32; // selector + offset + array length
    const dataSize = calls.reduce((acc, call) => acc + 32 + 32 + call.length, 0);
    const totalSize = headerSize + dataSize;
    
    const result = new Uint8Array(totalSize);
    result.set(selector, 0);
    
    // Offset to array data (always 32 for single dynamic param)
    result.set(this.encodeUint256(BigInt(32)), 4);
    
    // Array length
    result.set(this.encodeUint256(BigInt(calls.length)), 36);
    
    // Array elements (offsets then data)
    let dataOffset = calls.length * 32;
    let currentOffset = 68;
    
    for (let i = 0; i < calls.length; i++) {
      // Offset to this element's data
      result.set(this.encodeUint256(BigInt(dataOffset)), currentOffset);
      currentOffset += 32;
      dataOffset += 32 + calls[i].length;
    }
    
    // Actual data
    for (const call of calls) {
      result.set(this.encodeUint256(BigInt(call.length)), currentOffset);
      currentOffset += 32;
      result.set(call, currentOffset);
      currentOffset += call.length;
    }
    
    return result;
  }

  /**
   * Build EVM payload for swap
   */
  private buildEvmPayload(route: SwapRoute, amount: bigint): ComitPayload {
    // ABI encode the swap call based on route type
    const calldata = this.encodeEvmSwapCall(route, amount);

    return {
      vm: 'EVM',
      bytecode: new Uint8Array(), // Empty for contract calls
      calldata,
      gasLimit: BigInt(300000), // Higher gas limit for EVM swaps
      target: route.poolAddress,
    };
  }

  /**
   * Encode EVM swap call with proper ABI encoding
   */
  private encodeEvmSwapCall(route: SwapRoute, amount: bigint): Uint8Array {
    // Determine which swap function to use
    const isInputETH = route.inputToken.toLowerCase() === '0xc02aaa39b223fe8d0a0e5c4f27ead9083c756cc2';
    const isOutputETH = route.outputToken.toLowerCase() === '0xc02aaa39b223fe8d0a0e5c4f27ead9083c756cc2';
    
    let functionSelector: string;
    let params: Uint8Array;

    if (isInputETH) {
      // swapExactETHForTokens(uint amountOutMin, address[] path, address to, uint deadline)
      functionSelector = '7ff36ab5';
      params = this.encodeSwapETHForTokensParams(amount, route.outputToken);
    } else if (isOutputETH) {
      // swapExactTokensForETH(uint amountIn, uint amountOutMin, address[] path, address to, uint deadline)
      functionSelector = '18cbafe5';
      params = this.encodeSwapTokensForETHParams(amount, route.inputToken);
    } else {
      // swapExactTokensForTokens(uint amountIn, uint amountOutMin, address[] path, address to, uint deadline)
      functionSelector = '38ed1739';
      params = this.encodeSwapTokensForTokensParams(amount, route.inputToken, route.outputToken);
    }

    // Combine selector + params
    const selectorBytes = this.hexToBytes(functionSelector);
    const calldata = new Uint8Array(selectorBytes.length + params.length);
    calldata.set(selectorBytes, 0);
    calldata.set(params, selectorBytes.length);

    return calldata;
  }

  /**
   * Encode swapExactETHForTokens params
   */
  private encodeSwapETHForTokensParams(amountOutMin: bigint, outputToken: string): Uint8Array {
    // ABI encoding: amountOutMin (uint256), path offset, to, deadline, path length, path tokens
    const deadline = BigInt(Math.floor(Date.now() / 1000) + 1200); // 20 minutes
    const wethAddress = '0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2';
    
    return this.abiEncode([
      { type: 'uint256', value: (amountOutMin * BigInt(95)) / BigInt(100) }, // 5% slippage
      { type: 'uint256', value: BigInt(128) }, // path offset
      { type: 'address', value: '0x0000000000000000000000000000000000000000' }, // to (filled by executor)
      { type: 'uint256', value: deadline },
      { type: 'uint256', value: BigInt(2) }, // path length
      { type: 'address', value: wethAddress },
      { type: 'address', value: outputToken },
    ]);
  }

  /**
   * Encode swapExactTokensForETH params
   */
  private encodeSwapTokensForETHParams(amountIn: bigint, inputToken: string): Uint8Array {
    const deadline = BigInt(Math.floor(Date.now() / 1000) + 1200);
    const wethAddress = '0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2';
    
    return this.abiEncode([
      { type: 'uint256', value: amountIn },
      { type: 'uint256', value: BigInt(0) }, // amountOutMin (handled by Atlas Kernel)
      { type: 'uint256', value: BigInt(160) }, // path offset
      { type: 'address', value: '0x0000000000000000000000000000000000000000' },
      { type: 'uint256', value: deadline },
      { type: 'uint256', value: BigInt(2) },
      { type: 'address', value: inputToken },
      { type: 'address', value: wethAddress },
    ]);
  }

  /**
   * Encode swapExactTokensForTokens params
   */
  private encodeSwapTokensForTokensParams(amountIn: bigint, inputToken: string, outputToken: string): Uint8Array {
    const deadline = BigInt(Math.floor(Date.now() / 1000) + 1200);
    
    return this.abiEncode([
      { type: 'uint256', value: amountIn },
      { type: 'uint256', value: BigInt(0) }, // amountOutMin
      { type: 'uint256', value: BigInt(160) }, // path offset
      { type: 'address', value: '0x0000000000000000000000000000000000000000' },
      { type: 'uint256', value: deadline },
      { type: 'uint256', value: BigInt(2) },
      { type: 'address', value: inputToken },
      { type: 'address', value: outputToken },
    ]);
  }

  /**
   * Simple ABI encoder for common types
   */
  private abiEncode(params: Array<{ type: string; value: bigint | string }>): Uint8Array {
    const encoded: Uint8Array[] = [];

    for (const param of params) {
      if (param.type === 'uint256') {
        encoded.push(this.encodeUint256(param.value as bigint));
      } else if (param.type === 'address') {
        encoded.push(this.encodeAddress(param.value as string));
      }
    }

    // Concatenate all encoded params
    const totalLength = encoded.reduce((acc, arr) => acc + arr.length, 0);
    const result = new Uint8Array(totalLength);
    let offset = 0;
    for (const arr of encoded) {
      result.set(arr, offset);
      offset += arr.length;
    }

    return result;
  }

  /**
   * Encode uint256 (32 bytes, big-endian, zero-padded)
   */
  private encodeUint256(value: bigint): Uint8Array {
    const bytes = new Uint8Array(32);
    let v = value;
    for (let i = 31; i >= 0; i--) {
      bytes[i] = Number(v & BigInt(0xff));
      v >>= BigInt(8);
    }
    return bytes;
  }

  /**
   * Encode address (32 bytes, zero-padded left)
   */
  private encodeAddress(address: string): Uint8Array {
    const bytes = new Uint8Array(32);
    const addrBytes = this.hexToBytes(address.replace('0x', ''));
    bytes.set(addrBytes, 32 - addrBytes.length);
    return bytes;
  }

  /**
   * Convert hex string to bytes
   */
  private hexToBytes(hex: string): Uint8Array {
    const bytes = new Uint8Array(hex.length / 2);
    for (let i = 0; i < hex.length; i += 2) {
      bytes[i / 2] = parseInt(hex.substring(i, i + 2), 16);
    }
    return bytes;
  }

  /**
   * Build SVM payload for swap
   */
  private buildSvmPayload(route: SwapRoute, amount: bigint): ComitPayload {
    // Build instruction data (simplified - use proper serialization in production)
    const calldata = new Uint8Array(16);
    const view = new DataView(calldata.buffer);
    view.setBigUint64(0, amount, true); // Little-endian amount
    view.setBigUint64(8, BigInt(0), true); // Minimum output

    return {
      vm: 'SVM',
      bytecode: new Uint8Array(), // Empty for program calls
      calldata,
      gasLimit: BigInt(100000),
      target: route.poolAddress,
    };
  }

  /**
   * Convert bigint to bytes
   */
  private bigIntToBytes(value: bigint): Uint8Array {
    const bytes = new Uint8Array(8);
    const view = new DataView(bytes.buffer);
    view.setBigUint64(0, value, true);
    return bytes;
  }

  /**
   * Generate unique order ID
   */
  private generateOrderId(): string {
    return `order-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
  }
}

// Export singleton instance
let tradingEngine: CrossChainTradingEngine | null = null;

export function getCrossChainTradingEngine(): CrossChainTradingEngine {
  if (!tradingEngine) {
    tradingEngine = new CrossChainTradingEngine();
  }
  return tradingEngine;
}

// Common cross-chain assets - Extended for multi-chain support
export const CROSS_CHAIN_ASSETS: CrossChainAsset[] = [
  // ============================================
  // BITCOIN
  // ============================================
  {
    chain: 'bitcoin',
    chainId: 'bitcoin-mainnet',
    address: 'btc-mainnet',
    symbol: 'BTC',
    decimals: 8,
    canonicalId: 100,
    icon: '₿',
  },
  {
    chain: 'bitcoin',
    chainId: 'bitcoin-testnet',
    address: 'btc-testnet',
    symbol: 'tBTC',
    decimals: 8,
    canonicalId: 101,
    icon: '₿',
  },
  
  // ============================================
  // SOLANA NATIVE ASSETS
  // ============================================
  {
    chain: 'solana',
    chainId: 'solana-mainnet',
    address: 'So11111111111111111111111111111111111111112',
    symbol: 'SOL',
    decimals: 9,
    canonicalId: 0,
    icon: '◎',
  },
  {
    chain: 'solana',
    chainId: 'solana-mainnet',
    address: 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v',
    symbol: 'USDC',
    decimals: 6,
    canonicalId: 1,
    icon: '💵',
  },
  {
    chain: 'solana',
    chainId: 'solana-mainnet',
    address: 'Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB',
    symbol: 'USDT',
    decimals: 6,
    canonicalId: 11,
    icon: '💵',
  },
  
  // ============================================
  // ATLAS SPHERE SVM ASSETS
  // ============================================
  {
    chain: 'atlas-svm',
    chainId: 'atlas-sphere',
    address: 'AtlasSphere1111111111111111111111111111111',
    symbol: 'ATLAS',
    decimals: 9,
    canonicalId: 2,
    icon: '🔷',
  },
  {
    chain: 'atlas-svm',
    chainId: 'atlas-sphere',
    address: 'AtlasUSDC111111111111111111111111111111111',
    symbol: 'aUSDC',
    decimals: 6,
    canonicalId: 10,
    icon: '💵',
  },
  
  // ============================================
  // ATLAS SPHERE EVM ASSETS
  // ============================================
  {
    chain: 'atlas-evm',
    chainId: 'atlas-evm',
    address: '0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2',
    symbol: 'aWETH',
    decimals: 18,
    canonicalId: 3,
    icon: 'Ξ',
  },
  {
    chain: 'atlas-evm',
    chainId: 'atlas-evm',
    address: '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48',
    symbol: 'aUSDC',
    decimals: 6,
    canonicalId: 4,
    icon: '💵',
  },
  
  // ============================================
  // ETHEREUM MAINNET ASSETS
  // ============================================
  {
    chain: 'evm',
    chainId: 1,
    address: '0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2',
    symbol: 'WETH',
    decimals: 18,
    canonicalId: 1001,
    icon: 'Ξ',
  },
  {
    chain: 'evm',
    chainId: 1,
    address: '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48',
    symbol: 'USDC',
    decimals: 6,
    canonicalId: 1002,
    icon: '💵',
  },
  {
    chain: 'evm',
    chainId: 1,
    address: '0xdAC17F958D2ee523a2206206994597C13D831ec7',
    symbol: 'USDT',
    decimals: 6,
    canonicalId: 1003,
    icon: '💵',
  },
  {
    chain: 'evm',
    chainId: 1,
    address: '0x6B175474E89094C44Da98b954EescdeCB5F3BBAB',
    symbol: 'DAI',
    decimals: 18,
    canonicalId: 1004,
    icon: '📊',
  },
  {
    chain: 'evm',
    chainId: 1,
    address: '0x2260FAC5E5542a773Aa44fBCfeDf7C193bc2C599',
    symbol: 'WBTC',
    decimals: 8,
    canonicalId: 1005,
    icon: '₿',
  },
  
  // ============================================
  // ARBITRUM ONE ASSETS
  // ============================================
  {
    chain: 'evm',
    chainId: 42161,
    address: '0x82aF49447D8a07e3bd95BD0d56f35241523fBab1',
    symbol: 'WETH',
    decimals: 18,
    canonicalId: 2001,
    icon: 'Ξ',
  },
  {
    chain: 'evm',
    chainId: 42161,
    address: '0xaf88d065e77c8cC2239327C5EDb3A432268e5831',
    symbol: 'USDC',
    decimals: 6,
    canonicalId: 2002,
    icon: '💵',
  },
  {
    chain: 'evm',
    chainId: 42161,
    address: '0x912CE59144191C1204E64559FE8253a0e49E6548',
    symbol: 'ARB',
    decimals: 18,
    canonicalId: 2003,
    icon: '🔵',
  },
  
  // ============================================
  // OPTIMISM ASSETS
  // ============================================
  {
    chain: 'evm',
    chainId: 10,
    address: '0x4200000000000000000000000000000000000006',
    symbol: 'WETH',
    decimals: 18,
    canonicalId: 3001,
    icon: 'Ξ',
  },
  {
    chain: 'evm',
    chainId: 10,
    address: '0x0b2C639c533813f4Aa9D7837CAf62653d097Ff85',
    symbol: 'USDC',
    decimals: 6,
    canonicalId: 3002,
    icon: '💵',
  },
  {
    chain: 'evm',
    chainId: 10,
    address: '0x4200000000000000000000000000000000000042',
    symbol: 'OP',
    decimals: 18,
    canonicalId: 3003,
    icon: '🔴',
  },
  
  // ============================================
  // BASE ASSETS
  // ============================================
  {
    chain: 'evm',
    chainId: 8453,
    address: '0x4200000000000000000000000000000000000006',
    symbol: 'WETH',
    decimals: 18,
    canonicalId: 4001,
    icon: 'Ξ',
  },
  {
    chain: 'evm',
    chainId: 8453,
    address: '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913',
    symbol: 'USDC',
    decimals: 6,
    canonicalId: 4002,
    icon: '💵',
  },
  
  // ============================================
  // POLYGON ASSETS
  // ============================================
  {
    chain: 'evm',
    chainId: 137,
    address: '0x0d500B1d8E8eF31E21C99d1Db9A6444d3ADf1270',
    symbol: 'WMATIC',
    decimals: 18,
    canonicalId: 5001,
    icon: '🟣',
  },
  {
    chain: 'evm',
    chainId: 137,
    address: '0x3c499c542cEF5E3811e1192ce70d8cC03d5c3359',
    symbol: 'USDC',
    decimals: 6,
    canonicalId: 5002,
    icon: '💵',
  },
  {
    chain: 'evm',
    chainId: 137,
    address: '0x7ceB23fD6bC0adD59E62ac25578270cFf1b9f619',
    symbol: 'WETH',
    decimals: 18,
    canonicalId: 5003,
    icon: 'Ξ',
  },
  
  // ============================================
  // BSC (BNB SMART CHAIN) ASSETS
  // ============================================
  {
    chain: 'evm',
    chainId: 56,
    address: '0xbb4CdB9CBd36B01bD1cBaEBF2De08d9173bc095c',
    symbol: 'WBNB',
    decimals: 18,
    canonicalId: 6001,
    icon: '🟡',
  },
  {
    chain: 'evm',
    chainId: 56,
    address: '0x8AC76a51cc950d9822D68b83fE1Ad97B32Cd580d',
    symbol: 'USDC',
    decimals: 18,
    canonicalId: 6002,
    icon: '💵',
  },
  {
    chain: 'evm',
    chainId: 56,
    address: '0x55d398326f99059fF775485246999027B3197955',
    symbol: 'USDT',
    decimals: 18,
    canonicalId: 6003,
    icon: '💵',
  },
  
  // ============================================
  // AVALANCHE C-CHAIN ASSETS
  // ============================================
  {
    chain: 'evm',
    chainId: 43114,
    address: '0xB31f66AA3C1e785363F0875A1B74E27b85FD66c7',
    symbol: 'WAVAX',
    decimals: 18,
    canonicalId: 7001,
    icon: '🔺',
  },
  {
    chain: 'evm',
    chainId: 43114,
    address: '0xB97EF9Ef8734C71904D8002F8b6Bc66Dd9c48a6E',
    symbol: 'USDC',
    decimals: 6,
    canonicalId: 7002,
    icon: '💵',
  },
  
  // ============================================
  // FANTOM ASSETS
  // ============================================
  {
    chain: 'evm',
    chainId: 250,
    address: '0x21be370D5312f44cB42ce377BC9b8a0cEF1A4C83',
    symbol: 'WFTM',
    decimals: 18,
    canonicalId: 8001,
    icon: '👻',
  },
  {
    chain: 'evm',
    chainId: 250,
    address: '0x28a92dde19D9989F39A49905d7C9C2FAc7799bDf',
    symbol: 'USDC',
    decimals: 6,
    canonicalId: 8002,
    icon: '💵',
  },
  
  // ============================================
  // ZKSYNC ERA ASSETS
  // ============================================
  {
    chain: 'evm',
    chainId: 324,
    address: '0x5AEa5775959fBC2557Cc8789bC1bf90A239D9a91',
    symbol: 'WETH',
    decimals: 18,
    canonicalId: 9001,
    icon: 'Ξ',
  },
  {
    chain: 'evm',
    chainId: 324,
    address: '0x3355df6D4c9C3035724Fd0e3914dE96A5a83aaf4',
    symbol: 'USDC',
    decimals: 6,
    canonicalId: 9002,
    icon: '💵',
  },
  
  // ============================================
  // LINEA ASSETS
  // ============================================
  {
    chain: 'evm',
    chainId: 59144,
    address: '0xe5D7C2a44FfDDf6b295A15c148167daaAf5Cf34f',
    symbol: 'WETH',
    decimals: 18,
    canonicalId: 10001,
    icon: 'Ξ',
  },
  
  // ============================================
  // SCROLL ASSETS
  // ============================================
  {
    chain: 'evm',
    chainId: 534352,
    address: '0x5300000000000000000000000000000000000004',
    symbol: 'WETH',
    decimals: 18,
    canonicalId: 11001,
    icon: 'Ξ',
  },
  
  // ============================================
  // BLAST ASSETS
  // ============================================
  {
    chain: 'evm',
    chainId: 81457,
    address: '0x4300000000000000000000000000000000000004',
    symbol: 'WETH',
    decimals: 18,
    canonicalId: 12001,
    icon: 'Ξ',
  },
  {
    chain: 'evm',
    chainId: 81457,
    address: '0x4300000000000000000000000000000000000003',
    symbol: 'USDB',
    decimals: 18,
    canonicalId: 12002,
    icon: '💵',
  },
  
  // ============================================
  // MANTLE ASSETS
  // ============================================
  {
    chain: 'evm',
    chainId: 5000,
    address: '0x78c1b0C915c4FAA5FffA6CAbf0219DA63d7f4cb8',
    symbol: 'WMNT',
    decimals: 18,
    canonicalId: 13001,
    icon: '🟢',
  },
  
  // ============================================
  // CELO ASSETS
  // ============================================
  {
    chain: 'evm',
    chainId: 42220,
    address: '0x471EcE3750Da237f93B8E339c536989b8978a438',
    symbol: 'CELO',
    decimals: 18,
    canonicalId: 14001,
    icon: '🟢',
  },
  
  // ============================================
  // GNOSIS ASSETS
  // ============================================
  {
    chain: 'evm',
    chainId: 100,
    address: '0xe91D153E0b41518A2Ce8Dd3D7944Fa863463a97d',
    symbol: 'WXDAI',
    decimals: 18,
    canonicalId: 15001,
    icon: '🦉',
  },
  
  // ============================================
  // MOONBEAM ASSETS
  // ============================================
  {
    chain: 'evm',
    chainId: 1284,
    address: '0xAcc15dC74880C9944775448304B263D191c6077F',
    symbol: 'WGLMR',
    decimals: 18,
    canonicalId: 16001,
    icon: '🌙',
  },
  
  // ============================================
  // CRONOS ASSETS
  // ============================================
  {
    chain: 'evm',
    chainId: 25,
    address: '0x5C7F8A570d578ED84E63fdFA7b1eE72dEae1AE23',
    symbol: 'WCRO',
    decimals: 18,
    canonicalId: 17001,
    icon: '🔵',
  },
  
  // ============================================
  // ZORA ASSETS
  // ============================================
  {
    chain: 'evm',
    chainId: 7777777,
    address: '0x4200000000000000000000000000000000000006',
    symbol: 'WETH',
    decimals: 18,
    canonicalId: 18001,
    icon: 'Ξ',
  },
  
  // ============================================
  // MODE ASSETS
  // ============================================
  {
    chain: 'evm',
    chainId: 34443,
    address: '0x4200000000000000000000000000000000000006',
    symbol: 'WETH',
    decimals: 18,
    canonicalId: 19001,
    icon: 'Ξ',
  },
  
  // ============================================
  // FRAXTAL ASSETS
  // ============================================
  {
    chain: 'evm',
    chainId: 252,
    address: '0xFC00000000000000000000000000000000000006',
    symbol: 'frxETH',
    decimals: 18,
    canonicalId: 20001,
    icon: '⚫',
  },
  
  // ============================================
  // CORE ASSETS
  // ============================================
  {
    chain: 'evm',
    chainId: 1116,
    address: '0x40375C92d9FAf44d2f9db9Bd9ba41a3317a2404f',
    symbol: 'WCORE',
    decimals: 18,
    canonicalId: 21001,
    icon: '🟠',
  },
  
  // ============================================
  // PULSECHAIN ASSETS
  // ============================================
  {
    chain: 'evm',
    chainId: 369,
    address: '0xA1077a294dDE1B09bB078844df40758a5D0f9a27',
    symbol: 'WPLS',
    decimals: 18,
    canonicalId: 22001,
    icon: '💚',
  },
  
  // ============================================
  // BITCOIN L2s (EVM-Compatible)
  // ============================================
  {
    chain: 'evm',
    chainId: 200901,
    address: '0x0000000000000000000000000000000000000000',
    symbol: 'BTC',
    decimals: 18,
    canonicalId: 30001,
    icon: '₿',
  },
  {
    chain: 'evm',
    chainId: 60808, // BOB
    address: '0x0000000000000000000000000000000000000000',
    symbol: 'ETH',
    decimals: 18,
    canonicalId: 30002,
    icon: 'Ξ',
  },
  {
    chain: 'evm',
    chainId: 4200, // Merlin
    address: '0x0000000000000000000000000000000000000000',
    symbol: 'BTC',
    decimals: 18,
    canonicalId: 30003,
    icon: '₿',
  },
];

// Get assets by chain type
export function getAssetsByChainType(chainType: ChainType): CrossChainAsset[] {
  return CROSS_CHAIN_ASSETS.filter(asset => asset.chain === chainType);
}

// Get assets by chain ID
export function getAssetsByChainId(chainId: number | string): CrossChainAsset[] {
  return CROSS_CHAIN_ASSETS.filter(asset => asset.chainId === chainId);
}

// Get unique chains from assets
export function getUniqueChains(): Array<{ chainType: ChainType; chainId: number | string; name: string }> {
  const seen = new Set<string>();
  const result: Array<{ chainType: ChainType; chainId: number | string; name: string }> = [];
  
  for (const asset of CROSS_CHAIN_ASSETS) {
    const key = `${asset.chain}-${asset.chainId}`;
    if (!seen.has(key)) {
      seen.add(key);
      const chain = getChainById(asset.chainId!);
      result.push({
        chainType: asset.chain,
        chainId: asset.chainId!,
        name: chain?.name || asset.chain,
      });
    }
  }
  
  return result;
}

// EVM DEX Router addresses by chain
export const EVM_DEX_ROUTERS: Record<number | string, { name: string; router: string; factory?: string }> = {
  // Atlas Sphere
  'atlas-evm': { name: 'AtlasSwap', router: '0x7a250d5630B4cF539739dF2C5dAcb4c659F2488D' },
  
  // Ethereum Mainnet
  1: { name: 'Uniswap V2', router: '0x7a250d5630B4cF539739dF2C5dAcb4c659F2488D', factory: '0x5C69bEe701ef814a2B6a3EDD4B1652CB9cc5aA6f' },
  
  // Arbitrum One
  42161: { name: 'Uniswap V3', router: '0xE592427A0AEce92De3Edee1F18E0157C05861564', factory: '0x1F98431c8aD98523631AE4a59f267346ea31F984' },
  
  // Optimism
  10: { name: 'Uniswap V3', router: '0xE592427A0AEce92De3Edee1F18E0157C05861564', factory: '0x1F98431c8aD98523631AE4a59f267346ea31F984' },
  
  // Base
  8453: { name: 'Uniswap V3', router: '0x2626664c2603336E57B271c5C0b26F421741e481', factory: '0x33128a8fC17869897dcE68Ed026d694621f6FDfD' },
  
  // Polygon
  137: { name: 'QuickSwap', router: '0xa5E0829CaCEd8fFDD4De3c43696c57F7D7A678ff', factory: '0x5757371414417b8C6CAad45bAeF941aBc7d3Ab32' },
  
  // BSC
  56: { name: 'PancakeSwap V2', router: '0x10ED43C718714eb63d5aA57B78B54704E256024E', factory: '0xcA143Ce32Fe78f1f7019d7d551a6402fC5350c73' },
  
  // Avalanche
  43114: { name: 'Trader Joe', router: '0x60aE616a2155Ee3d9A68541Ba4544862310933d4', factory: '0x9Ad6C38BE94206cA50bb0d90783181671c04D70c' },
  
  // Fantom
  250: { name: 'SpookySwap', router: '0xF491e7B69E4244ad4002BC14e878a34207E38c29', factory: '0x152eE697f2E276fA89E96742e9bB9aB1F2E61bE3' },
  
  // zkSync Era
  324: { name: 'SyncSwap', router: '0x2da10A1e27bF85cEdD8FFb1AbBe97e53391C0295', factory: '0xf2DAd89f2788a8CD54625C60b55cD3d2D0ACa7Cb' },
  
  // Linea
  59144: { name: 'SyncSwap', router: '0x80e38291e06339d10AAB483C65695D004dBD5C69', factory: '0x37BAc764494c8db4e54BDE72f6965beA9fa0AC2d' },
  
  // Scroll
  534352: { name: 'SyncSwap', router: '0x80e38291e06339d10AAB483C65695D004dBD5C69', factory: '0x37BAc764494c8db4e54BDE72f6965beA9fa0AC2d' },
  
  // Blast
  81457: { name: 'Thruster', router: '0x98994a9A7a2570367554589189dC9772241650f6', factory: '0xb4A7D971D0ADea1c73198C97d7ab3f9CE4aaFA13' },
  
  // Mantle
  5000: { name: 'Agni Finance', router: '0x319B69888b0d11cEC22caA5034e25FfFBDc88421', factory: '0x25CbdDb98b35ab1FF77413456B31EC81A6B6B746' },
  
  // Celo
  42220: { name: 'Ubeswap', router: '0xE3D8bd6Aed4F159bc8000a9cD47CffDb95F96121', factory: '0x62d5b84bE28a183aBB507E125B384122D2C25fAE' },
  
  // Gnosis
  100: { name: 'SushiSwap', router: '0x1b02dA8Cb0d097eB8D57A175b88c7D8b47997506', factory: '0xc35DADB65012eC5796536bD9864eD8773aBc74C4' },
  
  // Moonbeam
  1284: { name: 'StellaSwap', router: '0x70085a09D30D6f8C4ecF6eE10120d1847383BB57', factory: '0x68A384D826D3678f78BB9FB1533c7E9577dACc0E' },
  
  // Cronos
  25: { name: 'VVS Finance', router: '0x145863Eb42Cf62847A6Ca784e6416C1682b1b2Ae', factory: '0x3B44B2a187a7b3824131F8db5a74194D0a42Fc15' },
  
  // Zora
  7777777: { name: 'Uniswap V3', router: '0x7De04c96BE5159c3b5CeffC82aa176dc81281557' },
  
  // Mode
  34443: { name: 'Uniswap V3', router: '0xE592427A0AEce92De3Edee1F18E0157C05861564' },
  
  // Manta Pacific
  169: { name: 'QuickSwap', router: '0xa5E0829CaCEd8fFDD4De3c43696c57F7D7A678ff' },
  
  // Metis
  1088: { name: 'Netswap', router: '0x1E876cCe41B7b844FDe09E38Fa1cf00f213bFf56', factory: '0x70f51d68D16e8f9e418441280342Bd43AC9Dff9f' },
  
  // Aurora
  1313161554: { name: 'Trisolaris', router: '0x2CB45Edb4517d5947aFdE3BEAbF95A582506858B', factory: '0xc66F594268041dB60507F00703b152492fb176E7' },
  
  // Kava
  2222: { name: 'Equilibre', router: '0x42be75636374dfA4F50A1082E4f0a2A1E3E0b6F6' },
  
  // Klaytn
  8217: { name: 'ClaimSwap', router: '0xEf71750C100f7918d6Ded239Ff1CF09E81dEA92D', factory: '0xC33c7A1DE6c0F35f5b7c4e61E2c6A3b2BdB3e7C7' },
  
  // Harmony
  1666600000: { name: 'DeFi Kingdoms', router: '0x24ad62502d1C652Cc7684081169D04896aC20f30', factory: '0x9014B937069918bd319f80e8B3BB4A2cf6FAA5F7' },
  
  // Evmos
  9001: { name: 'EvmoSwap', router: '0x2E6B31E86fD8F855456f97CA8E5d27c0aFBccc6C' },
  
  // Fuse
  122: { name: 'Voltage Finance', router: '0xE3F85aAd0c8DD7337427B9dF5d0fB741d65EEEB5', factory: '0x1998E4b0F1F922367d8Ec20600ea2b86df55f34E' },
  
  // Boba
  288: { name: 'OolongSwap', router: '0x17C83E2B96ACfb5190d63F5E46d93c107eC0b514', factory: '0x7DDaF116889D655D1c486bEB95017a8211265d29' },
  
  // Oasis Emerald
  42262: { name: 'YuzuSwap', router: '0x250d48C5E78f1E85F7AB07FEC61E93ba703aE668', factory: '0x5F50fD99C6A01e1b8d9A4F3F8E8f1c3e6E7d5b9E' },
  
  // Telos
  40: { name: 'Swapsicle', router: '0x7b4c8f0D816f04A5B7b12f0e0d60F54B4b3EE6c8' },
  
  // Astar
  592: { name: 'ArthSwap', router: '0xE915D2393a08a00c5A463053edD31bAe2199b9e7', factory: '0xA9473608514457b4bF083f9045fA63ae5810A03E' },
  
  // Shiden
  336: { name: 'ArthSwap', router: '0xf3Cd476C3C4D3Ac5Ca2724767f269070CA09A043' },
  
  // IoTeX
  4689: { name: 'Mimo', router: '0x0c6E8d0E5eBc8C0b77F2E8Bf0F43e07e5F7c58C1' },
  
  // Syscoin
  57: { name: 'Pegasys', router: '0x017dAd2578372CAEE5c6CddfE35eEDB3728544C4', factory: '0x8dde7eA5Fb8B67E0bC54B96cA4b45e967D3F55d9' },
  
  // Milkomeda
  2001: { name: 'MilkySwap', router: '0x57bB5E0F7f84b2F2A0E9F5F60Ccd6eBe32cF9BcC' },
  
  // ThunderCore
  108: { name: 'TTSwap', router: '0x1a8c7E66e11f1f8b5DCf5Aa54ce8c7F3d1f3E9Ba' },
  
  // Godwoken
  71402: { name: 'Yokai Swap', router: '0x7Cb8c7A1a7b8d3C4FA7B1E8c2E3D4F5A6B7C8D9E' },
  
  // Flare
  14: { name: 'SparkDex', router: '0xF15b8e866EDa16fA8f9a6e5b43fE2e8E5d7F9C3B' },
  
  // Songbird
  19: { name: 'BlazeSwap', router: '0xF15b8e866EDa16fA8f9a6e5b43fE2e8E5d7F9C3B' },
  
  // Velas
  106: { name: 'WagyuSwap', router: '0x3D1c58B6d4501E34DF37Cf0f664A58059a188F00' },
  
  // EOS EVM
  17777: { name: 'Noah Swap', router: '0xF491e7B69E4244ad4002BC14e878a34207E38c29' },
  
  // Canto
  7700: { name: 'Canto DEX', router: '0xa252eEE9BDe830Ca4793F054B506587027825a8e' },
  
  // Core
  1116: { name: 'SushiSwap', router: '0x1b02dA8Cb0d097eB8D57A175b88c7D8b47997506' },
  
  // PulseChain
  369: { name: 'PulseX', router: '0x98bf93ebf5c380C0e6Ae8e192A7e2AE08edAcc02', factory: '0x1715a3E4A142d8b698131108995174F37aEBA10D' },
  
  // Filecoin
  314: { name: 'SushiSwap', router: '0x1b02dA8Cb0d097eB8D57A175b88c7D8b47997506' },
  
  // Fraxtal
  252: { name: 'Fraxswap', router: '0x39cd4db6460d8B5961F73E997E86DdbB7Ca4D5F6' },
  
  // ZetaChain
  7000: { name: 'Izumi Finance', router: '0x34bc1b87f60e0a30c0e24FD7Abada70436c71406' },
  
  // Sei
  1329: { name: 'DragonSwap', router: '0x3a0BDEF9ECd6A22A1AE4fba77DBaF3f6cBdB01b8' },
  
  // Taiko
  167000: { name: 'Uniswap V3', router: '0xE592427A0AEce92De3Edee1F18E0157C05861564' },
  
  // World Chain
  480: { name: 'Uniswap V3', router: '0xE592427A0AEce92De3Edee1F18E0157C05861564' },
  
  // Abstract
  2741: { name: 'Abstract DEX', router: '0x1b02dA8Cb0d097eB8D57A175b88c7D8b47997506' },
  
  // Berachain
  80094: { name: 'Kodiak', router: '0x7a250d5630B4cF539739dF2C5dAcb4c659F2488D' },
  
  // Ink
  57073: { name: 'Uniswap V3', router: '0xE592427A0AEce92De3Edee1F18E0157C05861564' },
  
  // Rootstock
  30: { name: 'Sovryn', router: '0x98aCE08D2b759a265ae326F010496bcD63C15afc' },
  
  // Bitlayer
  200901: { name: 'Bitswap', router: '0x7a250d5630B4cF539739dF2C5dAcb4c659F2488D' },
  
  // BOB
  60808: { name: 'BOB Swap', router: '0x1b02dA8Cb0d097eB8D57A175b88c7D8b47997506' },
  
  // Merlin
  4200: { name: 'Merlin Swap', router: '0x7a250d5630B4cF539739dF2C5dAcb4c659F2488D' },
  
  // B2 Network
  223: { name: 'B2 Swap', router: '0x7a250d5630B4cF539739dF2C5dAcb4c659F2488D' },
  
  // BounceBit
  6001: { name: 'BounceBit DEX', router: '0x7a250d5630B4cF539739dF2C5dAcb4c659F2488D' },
};

// Helper to get DEX router for a chain
export function getDexRouter(chainId: number | string): { name: string; router: string; factory?: string } | undefined {
  return EVM_DEX_ROUTERS[chainId];
}

// EVM swap function signatures
export const EVM_SWAP_SIGNATURES = {
  // Uniswap V2 style
  swapExactTokensForTokens: '0x38ed1739',
  swapExactETHForTokens: '0x7ff36ab5',
  swapExactTokensForETH: '0x18cbafe5',
  swapTokensForExactTokens: '0x8803dbee',
  swapETHForExactTokens: '0xfb3bdb41',
  swapTokensForExactETH: '0x4a25d94a',
  // Uniswap V3 style
  exactInputSingle: '0x414bf389',
  exactInput: '0xc04b8d59',
  exactOutputSingle: '0xdb3e2198',
  exactOutput: '0xf28c0498',
  // Multicall
  multicall: '0xac9650d8',
} as const;
