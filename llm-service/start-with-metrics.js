#!/usr/bin/env node

/**
 * LLM Router with integrated Prometheus Metrics
 * Runs both the LLM router service and metrics exporter
 */

const child_process = require('child_process');
const path = require('path');
const fs = require('fs');

const LLM_ROUTER_PORT = process.env.PORT || 3000;
const METRICS_PORT = process.env.METRICS_PORT || 9090;
const CONFIG_PATH = process.argv[2]?.replace('--config=', '') || './llm-config.json';

console.log(`
╔════════════════════════════════════════════════════════════╗
║   LLM Router with Prometheus Metrics Exporter             ║
╚════════════════════════════════════════════════════════════╝

📊 Services Starting:
  - LLM Router:           http://localhost:${LLM_ROUTER_PORT}
  - Prometheus Metrics:   http://localhost:${METRICS_PORT}/metrics
  - Configuration:        ${CONFIG_PATH}

📈 Monitoring Setup:
  1. Prometheus scrapes /metrics every 15s
  2. Metrics available immediately
  3. Check: curl http://localhost:${METRICS_PORT}/metrics

🚀 Starting services...
`);

// Start LLM Router in background
const routerProcess = child_process.fork(
  path.join(__dirname, 'router.js'),
  [`--config=${CONFIG_PATH}`],
  {
    env: { ...process.env, PORT: LLM_ROUTER_PORT },
    stdio: 'inherit'
  }
);

// Start Metrics Exporter in background
const metricsProcess = child_process.fork(
  path.join(__dirname, 'metrics-exporter.js'),
  [],
  {
    env: { ...process.env, METRICS_PORT: METRICS_PORT },
    stdio: 'inherit'
  }
);

// Handle graceful shutdown
process.on('SIGINT', () => {
  console.log('\n\n🛑 Shutting down services...');
  routerProcess.kill();
  metricsProcess.kill();
  process.exit(0);
});

process.on('SIGTERM', () => {
  console.log('\n\n🛑 Shutting down services...');
  routerProcess.kill();
  metricsProcess.kill();
  process.exit(0);
});

// Log if either process dies unexpectedly
routerProcess.on('exit', (code) => {
  if (code !== 0) {
    console.error('❌ LLM Router exited with code:', code);
    metricsProcess.kill();
    process.exit(1);
  }
});

metricsProcess.on('exit', (code) => {
  if (code !== 0) {
    console.error('❌ Metrics Exporter exited with code:', code);
    routerProcess.kill();
    process.exit(1);
  }
});
