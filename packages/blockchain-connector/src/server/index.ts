import http from 'http';
import type { HealthMonitor } from '../connector/health-monitor';
import client from 'prom-client';

export function startServer({ monitor, port = 9464 } : { monitor?: HealthMonitor; port?: number }) {
  // expose Prometheus metrics
  client.collectDefaultMetrics();

  const server = http.createServer(async (req, res) => {
    if (!req.url) return res.end('');
    if (req.url.startsWith('/metrics')) {
      try {
        const metrics = await client.register.metrics();
        res.writeHead(200, { 'Content-Type': client.register.contentType });
        res.end(metrics);
      } catch (e: any) {
        res.writeHead(500);
        res.end('error');
      }
      return;
    }

    if (req.url.startsWith('/health')) {
      const body: any = { version: '0.1.0', status: 'unknown' };
      if (monitor) {
        // expose top-level counts
        const map = (monitor as any).statuses as Map<string, any> | undefined;
        if (map) {
          const statuses = Array.from(map.values());
          body.totalEndpoints = statuses.length;
          body.healthy = statuses.filter((s: any) => s.healthy).length;
          body.percentHealthy = ((body.healthy / body.totalEndpoints) * 100) || 0;
        }
        body.status = 'ok';
      }
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify(body));
      return;
    }

    res.writeHead(404);
    res.end('not found');
  });

  server.listen(port, () => console.log(`blockchain-connector server listening on :${port}`));
  return server;
}
