#!/usr/bin/env node
/**
 * scripts/validate-chains.js
 *
 * Usage: node scripts/validate-chains.js path/to/chains.json --concurrency=50 --timeout=10000
 *
 * Reads a chains.json array (matching ChainDescriptor) and probes each `defaultRpcUrls` endpoint.
 * Writes a report to `scripts/validation-report.json` with success/failure per endpoint.
 */

const fs = require('fs');
const path = require('path');
const { HealthMonitor } = require('../packages/blockchain-connector/dist/connector/health-monitor.js');

async function main() {
  const input = process.argv[2] || path.resolve(__dirname, '..', 'packages', 'blockchain-connector', 'src', 'chains', 'generated', 'chains.json');
  const concurrencyArg = process.argv.find(a => a.startsWith('--concurrency='));
  const timeoutArg = process.argv.find(a => a.startsWith('--timeout='));
  const concurrency = concurrencyArg ? parseInt(concurrencyArg.split('=')[1], 10) : 50;
  const timeoutMs = timeoutArg ? parseInt(timeoutArg.split('=')[1], 10) : 10000;

  if (!fs.existsSync(input)) {
    console.error('Chains JSON not found at', input);
    process.exit(2);
  }

  const raw = fs.readFileSync(input, 'utf8');
  const arr = JSON.parse(raw);

  const monitor = new HealthMonitor({ concurrency, timeoutMs, intervalMs: 60_000 });

  const report = [];

  for (const chain of arr) {
    const endpoints = chain.defaultRpcUrls || [];
    const results = await monitor.probeEndpoints(endpoints, concurrency);
    report.push({ chain: chain.id, name: chain.name, endpoints: results });
  }

  const out = path.resolve(__dirname, 'validation-report.json');
  fs.writeFileSync(out, JSON.stringify(report, null, 2), 'utf8');
  console.log('Wrote validation report to', out);
}

main().catch(err => { console.error(err); process.exit(1); });
