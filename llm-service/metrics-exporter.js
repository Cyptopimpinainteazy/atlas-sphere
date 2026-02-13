#!/usr/bin/env node

/**
 * Prometheus Metrics Exporter for LLM Router
 * Exposes metrics in Prometheus format
 * Usage: node metrics-exporter.js
 */

const http = require('http');
const fs = require('fs');
const path = require('path');

class PrometheusMetricsCollector {
  constructor() {
    this.metrics = {
      http_requests_total: new Map(),
      http_request_duration_seconds: new Map(),
      llm_queries_total: new Map(),
      llm_query_errors_total: new Map(),
      llm_query_duration_seconds: new Map(),
      provider_availability: new Map(),
      tokens_processed_total: new Map(),
    };

    this.startTime = Date.now();
    this.loadMetricsFromFile();
  }

  loadMetricsFromFile() {
    const metricsFile = '/tmp/llm_metrics.json';
    try {
      if (fs.existsSync(metricsFile)) {
        const data = JSON.parse(fs.readFileSync(metricsFile, 'utf8'));
        this.lastMetrics = data;
      }
    } catch (error) {
      console.error('Could not load metrics file:', error.message);
    }
  }

  recordQuery(provider, model, durationMs, success, tokensProcessed = 0) {
    const key = `${provider}/${model}`;
    
    // Query counter
    const queryKey = `llm_queries_total_${provider}_${model}`;
    this.metrics.llm_queries_total.set(
      queryKey,
      (this.metrics.llm_queries_total.get(queryKey) || 0) + 1
    );

    // Error counter
    if (!success) {
      const errorKey = `llm_query_errors_total_${provider}_${model}`;
      this.metrics.llm_query_errors_total.set(
        errorKey,
        (this.metrics.llm_query_errors_total.get(errorKey) || 0) + 1
      );
    }

    // Duration histogram (simple bucket approach)
    const durationKey = `llm_query_duration_seconds_${provider}_${model}`;
    if (!this.metrics.llm_query_duration_seconds.has(durationKey)) {
      this.metrics.llm_query_duration_seconds.set(durationKey, []);
    }
    this.metrics.llm_query_duration_seconds
      .get(durationKey)
      .push(durationMs / 1000);

    // Tokens processed
    if (tokensProcessed > 0) {
      const tokenKey = `tokens_processed_total_${provider}_${model}`;
      this.metrics.tokens_processed_total.set(
        tokenKey,
        (this.metrics.tokens_processed_total.get(tokenKey) || 0) + tokensProcessed
      );
    }
  }

  recordHttpRequest(endpoint, statusCode, durationMs) {
    const key = `http_requests_total_${endpoint}_${statusCode}`;
    this.metrics.http_requests_total.set(
      key,
      (this.metrics.http_requests_total.get(key) || 0) + 1
    );

    const durationKey = `http_request_duration_seconds_${endpoint}`;
    if (!this.metrics.http_request_duration_seconds.has(durationKey)) {
      this.metrics.http_request_duration_seconds.set(durationKey, []);
    }
    this.metrics.http_request_duration_seconds
      .get(durationKey)
      .push(durationMs / 1000);
  }

  setProviderAvailability(provider, available) {
    const key = `provider_availability_${provider}`;
    this.metrics.provider_availability.set(key, available ? 1 : 0);
  }

  calculatePercentile(values, percentile) {
    if (values.length === 0) return 0;
    const sorted = values.sort((a, b) => a - b);
    const index = Math.ceil((percentile / 100) * sorted.length) - 1;
    return sorted[Math.max(0, index)];
  }

  generatePrometheusOutput() {
    let output = '';

    // Help and type comments
    output += '# HELP llm_queries_total Total number of LLM queries processed\n';
    output += '# TYPE llm_queries_total counter\n';

    // LLM Queries Total
    for (const [key, value] of this.metrics.llm_queries_total) {
      const labels = this.parseKey(key);
      output += `llm_queries_total{${labels}} ${value}\n`;
    }

    output += '\n# HELP llm_query_errors_total Total number of failed LLM queries\n';
    output += '# TYPE llm_query_errors_total counter\n';

    // LLM Query Errors Total
    for (const [key, value] of this.metrics.llm_query_errors_total) {
      const labels = this.parseKey(key);
      output += `llm_query_errors_total{${labels}} ${value}\n`;
    }

    output += '\n# HELP llm_query_duration_seconds LLM query duration in seconds\n';
    output += '# TYPE llm_query_duration_seconds histogram\n';

    // LLM Query Duration (histogram buckets)
    for (const [key, values] of this.metrics.llm_query_duration_seconds) {
      const labels = this.parseKey(key);
      const buckets = [0.01, 0.05, 0.1, 0.5, 1, 5, 10, 30, 60, 120];
      
      let count = values.length;
      let sum = values.reduce((a, b) => a + b, 0);

      for (const bucket of buckets) {
        const bucketCount = values.filter(v => v <= bucket).length;
        output += `llm_query_duration_seconds_bucket{${labels},le="${bucket}"} ${bucketCount}\n`;
      }
      output += `llm_query_duration_seconds_bucket{${labels},le="+Inf"} ${count}\n`;
      output += `llm_query_duration_seconds_sum{${labels}} ${sum.toFixed(2)}\n`;
      output += `llm_query_duration_seconds_count{${labels}} ${count}\n`;
    }

    output += '\n# HELP tokens_processed_total Total tokens processed by LLM providers\n';
    output += '# TYPE tokens_processed_total counter\n';

    // Tokens Processed Total
    for (const [key, value] of this.metrics.tokens_processed_total) {
      const labels = this.parseKey(key);
      output += `tokens_processed_total{${labels}} ${value}\n`;
    }

    output += '\n# HELP provider_availability Provider availability status (1=available, 0=unavailable)\n';
    output += '# TYPE provider_availability gauge\n';

    // Provider Availability
    for (const [key, value] of this.metrics.provider_availability) {
      const labels = this.parseKey(key);
      output += `provider_availability{${labels}} ${value}\n`;
    }

    output += '\n# HELP http_requests_total Total HTTP requests\n';
    output += '# TYPE http_requests_total counter\n';

    // HTTP Requests Total
    for (const [key, value] of this.metrics.http_requests_total) {
      const labels = this.parseKey(key);
      output += `http_requests_total{${labels}} ${value}\n`;
    }

    output += '\n# HELP http_request_duration_seconds HTTP request duration in seconds\n';
    output += '# TYPE http_request_duration_seconds histogram\n';

    // HTTP Request Duration (histogram buckets)
    for (const [key, values] of this.metrics.http_request_duration_seconds) {
      const labels = this.parseKey(key);
      const buckets = [0.001, 0.005, 0.01, 0.05, 0.1, 0.5, 1];
      
      let count = values.length;
      let sum = values.reduce((a, b) => a + b, 0);

      for (const bucket of buckets) {
        const bucketCount = values.filter(v => v <= bucket).length;
        output += `http_request_duration_seconds_bucket{${labels},le="${bucket}"} ${bucketCount}\n`;
      }
      output += `http_request_duration_seconds_bucket{${labels},le="+Inf"} ${count}\n`;
      output += `http_request_duration_seconds_sum{${labels}} ${sum.toFixed(4)}\n`;
      output += `http_request_duration_seconds_count{${labels}} ${count}\n`;
    }

    // Uptime
    const uptime = (Date.now() - this.startTime) / 1000;
    output += '\n# HELP process_uptime_seconds Process uptime in seconds\n';
    output += '# TYPE process_uptime_seconds gauge\n';
    output += `process_uptime_seconds ${uptime.toFixed(2)}\n`;

    return output;
  }

  parseKey(key) {
    // Converts "llm_queries_total_ollama_llama2:13b" to 'provider="ollama",model="llama2:13b"'
    const parts = key.split('_');
    
    if (key.includes('http_')) {
      // http_requests_total_/query_200 -> endpoint="/query",status_code="200"
      const matches = key.match(/(.*?)_(\d+)$/);
      if (matches) {
        const endpoint = matches[1].replace('http_requests_total_', '');
        const statusCode = matches[2];
        return `endpoint="${endpoint}",status_code="${statusCode}"`;
      }
    }

    if (key.includes('provider_availability_')) {
      const provider = key.replace('provider_availability_', '');
      return `provider="${provider}"`;
    }

    // Extract provider and model from key
    // Format: "metricname_provider_model"
    const metricMatch = key.match(/^[a-z_]+_(.+?)_(.+)$/);
    if (metricMatch) {
      return `provider="${metricMatch[1]}",model="${metricMatch[2]}"`;
    }

    // Fallback for duration endpoints
    if (key.includes('http_request_duration_seconds_')) {
      const endpoint = key.replace('http_request_duration_seconds_', '');
      return `endpoint="${endpoint}"`;
    }

    return '';
  }
}

// Global collector instance
const collector = new PrometheusMetricsCollector();

// Start metrics server
const PORT = process.env.METRICS_PORT || 9090;

const server = http.createServer((req, res) => {
  res.setHeader('Content-Type', 'text/plain; version=0.0.4');

  if (req.url === '/metrics') {
    res.writeHead(200);
    res.end(collector.generatePrometheusOutput());
  } else if (req.url === '/health') {
    res.writeHead(200);
    res.end(JSON.stringify({ status: 'healthy', timestamp: new Date().toISOString() }));
  } else {
    res.writeHead(404);
    res.end('Not Found');
  }
});

server.listen(PORT, () => {
  console.log(`Prometheus Metrics Exporter running on port ${PORT}`);
  console.log(`Metrics available at: http://127.0.0.1:${PORT}/metrics`);
});

module.exports = PrometheusMetricsCollector;
