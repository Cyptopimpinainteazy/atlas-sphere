/**
 * Proof Relayer
 * Relays SPV proofs to target chains for settlement
 */

import { EventEmitter } from 'events';
import { SPVProof } from './spv-proof-generator';

export interface RelayTask {
  id: string;
  swapId: string;
  proof: SPVProof;
  sourceChain: string;
  targetChains: string[];
  status: 'pending' | 'in_progress' | 'completed' | 'failed';
  attempts: number;
  maxAttempts: number;
  createdAt: number;
  completedAt?: number;
}

export interface RelayResult {
  taskId: string;
  chain: string;
  success: boolean;
  txid?: string;
  error?: string;
}

export interface RelayConfig {
  maxRetries: number;
  retryDelay: number; // ms
  timeout: number; // ms
  batchSize: number;
  batchInterval: number; // ms
}

/**
 * Proof Relayer
 */
export class ProofRelayer extends EventEmitter {
  private tasks: Map<string, RelayTask> = new Map();
  private results: RelayResult[] = [];
  private config: RelayConfig;
  private chainRpcUrls: { [chain: string]: string };
  private relayInterval?: ReturnType<typeof setInterval>;

  constructor(config: RelayConfig, chainRpcUrls: { [chain: string]: string }) {
    super();
    this.config = config;
    this.chainRpcUrls = chainRpcUrls;
  }

  /**
   * Create relay task
   */
  async createTask(
    swapId: string,
    proof: SPVProof,
    sourceChain: string,
    targetChains: string[]
  ): Promise<string> {
    const taskId = `relay-${swapId}-${Date.now()}`;

    const task: RelayTask = {
      id: taskId,
      swapId,
      proof,
      sourceChain,
      targetChains,
      status: 'pending',
      attempts: 0,
      maxAttempts: this.config.maxRetries,
      createdAt: Math.floor(Date.now() / 1000),
    };

    this.tasks.set(taskId, task);
    this.emit('task-created', { taskId, swapId, targetChains });

    return taskId;
  }

  /**
   * Start relay processing
   */
  start(): void {
    this.relayInterval = setInterval(
      () => this.processPendingTasks(),
      this.config.batchInterval
    );
    this.emit('relayer-started');
  }

  /**
   * Stop relay processing
   */
  stop(): void {
    if (this.relayInterval) {
      clearInterval(this.relayInterval);
    }
    this.emit('relayer-stopped');
  }

  /**
   * Process pending relay tasks
   */
  private async processPendingTasks(): Promise<void> {
    const pendingTasks = Array.from(this.tasks.values()).filter(
      (task) => task.status === 'pending'
    );

    // Process in batches
    for (let i = 0; i < pendingTasks.length; i += this.config.batchSize) {
      const batch = pendingTasks.slice(
        i,
        i + this.config.batchSize
      );

      const promises = batch.map((task) => this.relayTask(task));
      await Promise.all(promises);
    }
  }

  /**
   * Relay proof to a single task
   */
  private async relayTask(task: RelayTask): Promise<void> {
    if (task.status !== 'pending') return;
    if (task.attempts >= task.maxAttempts) {
      task.status = 'failed';
      task.completedAt = Math.floor(Date.now() / 1000);
      this.emit('task-failed', {
        taskId: task.id,
        swapId: task.swapId,
        reason: 'Max retries exceeded',
      });
      return;
    }

    task.status = 'in_progress';
    task.attempts++;

    try {
      // Relay to all target chains
      const relayPromises = task.targetChains.map((chain) =>
        this.relayToChain(task, chain)
      );

      const results = await Promise.allSettled(relayPromises);

      // Check if all succeeded
      const allSucceeded = results.every((r) => r.status === 'fulfilled');

      if (allSucceeded) {
        task.status = 'completed';
        task.completedAt = Math.floor(Date.now() / 1000);
        this.emit('task-completed', {
          taskId: task.id,
          swapId: task.swapId,
          results,
        });
      } else {
        // Some failed, retry
        task.status = 'pending';
        this.emit('task-retry', {
          taskId: task.id,
          attempt: task.attempts,
          maxAttempts: task.maxAttempts,
        });

        // Backoff retry
        await new Promise((resolve) =>
          setTimeout(resolve, this.config.retryDelay * task.attempts)
        );
      }
    } catch (error) {
      task.status = 'pending';
      this.emit('relay-error', { taskId: task.id, error });
    }
  }

  /**
   * Relay proof to specific chain
   */
  private async relayToChain(
    task: RelayTask,
    targetChain: string
  ): Promise<RelayResult> {
    const rpcUrl = this.chainRpcUrls[targetChain];
    if (!rpcUrl) {
      throw new Error(`No RPC URL configured for chain: ${targetChain}`);
    }

    try {
      // Create settlement transaction
      const result = await this.submitSettlement(
        task.proof,
        targetChain,
        rpcUrl
      );

      const relayResult: RelayResult = {
        taskId: task.id,
        chain: targetChain,
        success: true,
        txid: result,
      };

      this.results.push(relayResult);
      this.emit('relay-success', { chain: targetChain, txid: result });

      return relayResult;
    } catch (error) {
      const relayResult: RelayResult = {
        taskId: task.id,
        chain: targetChain,
        success: false,
        error: String(error),
      };

      this.results.push(relayResult);
      this.emit('relay-failed', { chain: targetChain, error });

      throw error;
    }
  }

  /**
   * Submit settlement to target chain
   */
  private async submitSettlement(
    proof: SPVProof,
    chain: string,
    rpcUrl: string
  ): Promise<string> {
    // Chain-specific settlement logic
    switch (chain) {
      case 'ethereum':
        return this.submitEthereumSettlement(proof, rpcUrl);
      case 'solana':
        return this.submitSolanaSettlement(proof, rpcUrl);
      case 'x3vm':
        return this.submitX3VMSettlement(proof, rpcUrl);
      default:
        throw new Error(`Unsupported chain for settlement: ${chain}`);
    }
  }

  /**
   * Submit settlement to Ethereum
   */
  private async submitEthereumSettlement(
    proof: SPVProof,
    rpcUrl: string
  ): Promise<string> {
    // Create settlement transaction for X3HtlcEvm.claim()
    const settlementTx = {
      jsonrpc: '2.0',
      method: 'eth_sendRawTransaction',
      params: [this.encodeEthereumSettlement(proof)],
      id: 1,
    };

    const response = await fetch(rpcUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(settlementTx),
    });

    const result = await response.json();
    if (result.error) {
      throw new Error(`Ethereum settlement failed: ${result.error.message}`);
    }

    return result.result;
  }

  /**
   * Submit settlement to Solana
   */
  private async submitSolanaSettlement(
    proof: SPVProof,
    rpcUrl: string
  ): Promise<string> {
    // Create settlement transaction for Anchor program
    const settlementTx = {
      jsonrpc: '2.0',
      method: 'sendTransaction',
      params: [this.encodeSolanaSettlement(proof)],
      id: 1,
    };

    const response = await fetch(rpcUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(settlementTx),
    });

    const result = await response.json();
    if (result.error) {
      throw new Error(`Solana settlement failed: ${result.error.message}`);
    }

    return result.result;
  }

  /**
   * Submit settlement to X3VM
   */
  private async submitX3VMSettlement(
    proof: SPVProof,
    rpcUrl: string
  ): Promise<string> {
    // Create settlement extrinsic for X3VM pallet
    let encoded = null;
    try {
      const wsUrl = this.chainRpcUrls['x3vm']?.replace('http', 'ws') || process.env.X3VM_WS_URL || 'ws://localhost:9944';
      const { encodeSettlementExtrinsic } = require('./handlers/x3vm-encoder');
      const payload = {
        shipmentId: `spv-${proof.blockHeight}-${proof.confirmations || 0}`,
        parts: [proof.merkleRoot || ''],
        amount: 0,
      };
      encoded = await encodeSettlementExtrinsic(wsUrl, 'settlement', 'settle', payload);
    } catch (err) {
      console.warn('[X3VM] encoder failed; falling back to generic encoding', err.message || err);
      encoded = (
        '0x' +
        Buffer.from(
          JSON.stringify({
            blockHeight: proof.blockHeight,
            merkleProof: proof.merkleProof,
          })
        ).toString('hex')
      );
    }

    const settlementTx = {
      jsonrpc: '2.0',
      method: 'author_submitExtrinsic',
      params: [encoded],
      id: 1,
    };

    const response = await fetch(rpcUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(settlementTx),
    });

    const result = await response.json();
    if (result.error) {
      throw new Error(`X3VM settlement failed: ${result.error.message}`);
    }

    return result.result;
  }

  /**
   * Encode settlement for Ethereum
   */
  private encodeEthereumSettlement(proof: SPVProof): string {
    // Simplified encoding - in production would use ABI encoding
    return (
      '0x' +
      Buffer.from(
        JSON.stringify({
          blockHeight: proof.blockHeight,
          merkleProof: proof.merkleProof,
          confirmations: proof.confirmations,
        })
      ).toString('hex')
    );
  }

  /**
   * Encode settlement for Solana
   */
  private encodeSolanaSettlement(proof: SPVProof): string {
    // Simplified encoding - in production would use Borsh/Anchor encoding
    return (
      '0x' +
      Buffer.from(
        JSON.stringify({
          blockHeight: proof.blockHeight,
          merkleProof: proof.merkleProof,
        })
      ).toString('hex')
    );
  }

  /**
   * Encode settlement for X3VM
   */
  private encodeX3VMSettlement(proof: SPVProof): string {
    // Use metadata-driven encoder if available (attempt live node encode)
    try {
      const wsUrl = this.chainRpcUrls['x3vm']?.replace('http', 'ws') || process.env.X3VM_WS_URL || 'ws://localhost:9944';
      const { encodeSettlementExtrinsic } = require('./handlers/x3vm-encoder');
      // Map proof -> settlement payload; adjust mapping if pallet expects different fields
      const payload = {
        shipmentId: `spv-${proof.blockHeight}-${proof.confirmations || 0}`,
        parts: [proof.merkleRoot || ''],
        amount: 0
      };
      // NOTE: this is a synchronous wrapper; encodeSettlementExtrinsic returns a Promise so we block here
      // to keep existing interface; in future refactor to async
      const wait = (p: Promise<any>) => { let r:any; p.then((v:any)=>r=v).catch((e:any)=>{throw e}); const start = Date.now(); while (r===undefined && Date.now()-start<2000){}; return r; };
      const hex = (async () => await encodeSettlementExtrinsic(wsUrl, 'settlement', 'settle', payload))();
      // We cannot await here synchronously; fallback to generic remark encoding
    } catch (err) {
      // fallback to generic remark encoding
    }

    // Fallback - minimal encoding
    return (
      '0x' +
      Buffer.from(
        JSON.stringify({
          blockHeight: proof.blockHeight,
          merkleProof: proof.merkleProof,
        })
      ).toString('hex')
    );
  }

  /**
   * Get task status
   */
  getTaskStatus(taskId: string): RelayTask | undefined {
    return this.tasks.get(taskId);
  }

  /**
   * Get all tasks
   */
  getAllTasks(): RelayTask[] {
    return Array.from(this.tasks.values());
  }

  /**
   * Get relay results
   */
  getResults(
    filter?: { taskId?: string; chain?: string; status?: 'success' | 'failed' }
  ): RelayResult[] {
    return this.results.filter((result) => {
      if (filter?.taskId && result.taskId !== filter.taskId) return false;
      if (filter?.chain && result.chain !== filter.chain) return false;
      if (filter?.status === 'success' && !result.success) return false;
      if (filter?.status === 'failed' && result.success) return false;
      return true;
    });
  }

  /**
   * Get relay statistics
   */
  getStatistics() {
    const allTasks = Array.from(this.tasks.values());
    const successCount = allTasks.filter((t) => t.status === 'completed').length;
    const failedCount = allTasks.filter((t) => t.status === 'failed').length;
    const pendingCount = allTasks.filter((t) => t.status === 'pending').length;

    return {
      totalTasks: allTasks.length,
      completed: successCount,
      failed: failedCount,
      pending: pendingCount,
      successRate:
        allTasks.length > 0
          ? ((successCount / allTasks.length) * 100).toFixed(2) + '%'
          : 'N/A',
    };
  }
}

export default ProofRelayer;
