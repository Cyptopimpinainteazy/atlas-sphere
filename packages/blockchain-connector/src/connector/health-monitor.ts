/**
 * Health Monitor — lightweight endpoint probing and status tracking.
 */

export type EndpointStatus = {
  endpoint: string;
  healthy: boolean;
  lastChecked: number | null;
  lastError?: string;
};

export class HealthMonitor {
  private statuses = new Map<string, EndpointStatus>();
  private intervalId: NodeJS.Timeout | null = null;
  private concurrency: number;
  private timeoutMs: number;
  private intervalMs: number;

  constructor({ concurrency = 50, timeoutMs = 10000, intervalMs = 60_000 } = {}) {
    this.concurrency = concurrency;
    this.timeoutMs = timeoutMs;
    this.intervalMs = intervalMs;
  }

  getStatus(endpoint: string): EndpointStatus | undefined {
    return this.statuses.get(endpoint);
  }

  async probeEndpoint(endpoint: string): Promise<EndpointStatus> {
    const controller = new AbortController();
    const signal = controller.signal;
    const timeout = setTimeout(() => controller.abort(), this.timeoutMs);

    let healthy = false;
    let lastError;
    try {
      // Try JSON-RPC POST (eth_blockNumber) first
      const body = JSON.stringify({ jsonrpc: "2.0", id: 1, method: "eth_blockNumber", params: [] });
      const res = await fetch(endpoint, { method: "POST", headers: { "Content-Type": "application/json" }, body, signal });
      const contentType = res.headers.get("content-type") || "";
      if (res.ok) {
        if (contentType.includes("application/json")) {
          const json = await res.json();
          if (json && (json.result || typeof json.result !== 'undefined')) {
            healthy = true;
          }
        } else {
          // Non-JSON response but HTTP 200
          healthy = true;
        }
      } else {
        lastError = `HTTP ${res.status}`;
      }
    } catch (err: any) {
      lastError = err?.message || String(err);
    } finally {
      clearTimeout(timeout);
      const status: EndpointStatus = { endpoint, healthy, lastChecked: Date.now(), lastError };
      this.statuses.set(endpoint, status);
      return status;
    }
  }

  async probeEndpoints(endpoints: string[], concurrency = this.concurrency): Promise<EndpointStatus[]> {
    const results: EndpointStatus[] = [];
    const pool: Promise<void>[] = [];
    let i = 0;

    const worker = async () => {
      while (i < endpoints.length) {
        const idx = i++;
        const ep = endpoints[idx];
        try {
          const st = await this.probeEndpoint(ep);
          results[idx] = st;
        } catch (err: any) {
          results[idx] = { endpoint: ep, healthy: false, lastChecked: Date.now(), lastError: err?.message };
        }
      }
    };

    for (let w = 0; w < Math.min(concurrency, endpoints.length); w++) {
      pool.push(worker());
    }
    await Promise.all(pool);
    return results;
  }

  startPeriodic(endpoints: string[]) {
    if (this.intervalId) return;
    this.intervalId = setInterval(async () => {
      await this.probeEndpoints(endpoints);
    }, this.intervalMs);
  }

  stop() {
    if (this.intervalId) clearInterval(this.intervalId as any);
    this.intervalId = null;
  }
}
