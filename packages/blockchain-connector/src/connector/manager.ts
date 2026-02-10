/**
 * Connector Manager — creates, manages, and monitors chain connectors.
 *
 * Central orchestrator that the SDK and UI both call into.
 */

import type {
  ConnectorOptions,
  ConnectorInstance,
  ConnectorStatus,
  ConnectorMetrics,
  Block,
  Transaction,
  ChainDescriptor,
} from "../types";
import { getChain, CHAIN_REGISTRY } from "../chains/registry";
import { createAdapter, type IChainAdapter } from "../adapters";
import { HealthMonitor } from "./health-monitor";

interface ManagedConnector {
  instance: ConnectorInstance;
  adapter: IChainAdapter;
}

export class ConnectorManager {
  private connectors = new Map<string, ManagedConnector>();
  private monitor?: HealthMonitor;

  constructor(opts?: { enableHealthMonitor?: boolean; intervalMs?: number; concurrency?: number; timeoutMs?: number }) {
    if (opts?.enableHealthMonitor) {
      this.monitor = new HealthMonitor({ concurrency: opts.concurrency || 50, timeoutMs: opts.timeoutMs || 10000, intervalMs: opts.intervalMs || 60000 });
    }
  }

  /**
   * Create a new connector to a blockchain.
   */
  async createConnector(options: ConnectorOptions): Promise<ConnectorInstance> {
    const chain = getChain(options.chain) ?? this.findChainByNameOrId(options.chain);
    if (!chain) {
      throw new Error(`Unknown chain: ${options.chain}. Available: ${CHAIN_REGISTRY.map(c => c.id).join(", ")}`);
    }

    const id = `conn_${crypto.randomUUID().split("-")[0]}`;
    const adapter = createAdapter(chain);
    const endpoints = options.endpoint ? [options.endpoint] : chain.defaultRpcUrls;

    if (!endpoints || endpoints.length === 0) {
      throw new Error(`No RPC endpoint for ${chain.name}. Provide one in options.endpoint or add to chain.defaultRpcUrls.`);
    }

    const instance: ConnectorInstance = {
      id,
      options,
      chain,
      status: "connecting",
      metrics: this.emptyMetrics(),
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    this.connectors.set(id, { instance, adapter });

    // Try endpoints in order and perform a quick health check (getLatestBlock) before committing.
    let connectedEndpoint: string | null = null;
    const errors: string[] = [];

    for (const ep of endpoints) {
      try {
        await adapter.connect(ep);
        try {
          await adapter.getLatestBlock(); // quick health check
          connectedEndpoint = ep;
          break;
        } catch (err: any) {
          errors.push(`Health check failed for ${ep}: ${err.message}`);
          await adapter.disconnect().catch(() => {});
        }
      } catch (err: any) {
        errors.push(`Connect failed for ${ep}: ${err.message}`);
      }
    }

    if (connectedEndpoint) {
      instance.status = "connected";
      instance.updatedAt = new Date().toISOString();
      instance.options.endpoint = connectedEndpoint;

      // If a health monitor is enabled, probe and register endpoints for background checks
      if (this.monitor) {
        // probe chosen endpoint now and also schedule all chain endpoints for periodic checks
        await this.monitor.probeEndpoint(connectedEndpoint).catch(() => {});
        if (chain.defaultRpcUrls && chain.defaultRpcUrls.length > 0) {
          this.monitor.startPeriodic(chain.defaultRpcUrls);
        }
      }

      // Fetch initial metrics
      const metrics = await adapter.getMetrics().catch(() => this.emptyMetrics());
      instance.metrics = metrics;
    } else {
      instance.status = "error";
      instance.error = `All endpoints failed: ${errors.join("; ")}`;
      instance.updatedAt = new Date().toISOString();
    }

    return instance;
  }

  /**
   * Get a connector by ID.
   */
  getConnector(id: string): ConnectorInstance | undefined {
    return this.connectors.get(id)?.instance;
  }

  /**
   * List all connectors.
   */
  listConnectors(): ConnectorInstance[] {
    return Array.from(this.connectors.values()).map((c) => c.instance);
  }

  /**
   * Refresh metrics for a connector.
   */
  async refreshMetrics(id: string): Promise<ConnectorMetrics> {
    const managed = this.connectors.get(id);
    if (!managed) throw new Error(`Connector ${id} not found`);

    try {
      const metrics = await managed.adapter.getMetrics();
      managed.instance.metrics = metrics;
      managed.instance.updatedAt = new Date().toISOString();
      return metrics;
    } catch (err: any) {
      managed.instance.status = "degraded";
      managed.instance.error = err.message;
      throw err;
    }
  }

  /**
   * Get latest block via a connector.
   */
  async getLatestBlock(id: string): Promise<Block> {
    const managed = this.connectors.get(id);
    if (!managed) throw new Error(`Connector ${id} not found`);
    return managed.adapter.getLatestBlock();
  }

  /**
   * Get a specific block.
   */
  async getBlock(id: string, numberOrHash: string | number): Promise<Block> {
    const managed = this.connectors.get(id);
    if (!managed) throw new Error(`Connector ${id} not found`);
    return managed.adapter.getBlock(numberOrHash);
  }

  /**
   * Get a transaction.
   */
  async getTransaction(id: string, hash: string): Promise<Transaction> {
    const managed = this.connectors.get(id);
    if (!managed) throw new Error(`Connector ${id} not found`);
    return managed.adapter.getTransaction(hash);
  }

  /**
   * Disconnect and remove a connector.
   */
  async removeConnector(id: string): Promise<void> {
    const managed = this.connectors.get(id);
    if (managed) {
      await managed.adapter.disconnect();
      this.connectors.delete(id);
    }
  }

  /**
   * Get the underlying adapter for advanced operations.
   */
  getAdapter(id: string): IChainAdapter | undefined {
    return this.connectors.get(id)?.adapter;
  }

  private findChainByNameOrId(query: string): ChainDescriptor | undefined {
    const q = query.toLowerCase();
    return CHAIN_REGISTRY.find(
      (c) => c.id === q || c.name.toLowerCase().includes(q) || String(c.chainId) === q,
    );
  }

  private emptyMetrics(): ConnectorMetrics {
    return {
      blockHeight: 0,
      tps: 0,
      peerCount: 0,
      latencyMs: 0,
      totalRequests: 0,
      totalErrors: 0,
      uptimeSeconds: 0,
      finalityLag: 0,
    };
  }
}
