#!/usr/bin/env node

/**
 * LLM Provider Health Monitoring Script
 *
 * Continuously monitors the health of all LLM providers and sends alerts
 */

const fs = require('fs');
const path = require('path');

class HealthMonitor {
  constructor() {
    this.logFile = path.join(__dirname, '..', 'logs', 'llm-health.log');
    this.alertsFile = path.join(__dirname, '..', 'logs', 'llm-alerts.log');
    this.monitoringInterval = null;
    this.checkInterval = 30000; // 30 seconds
    this.alertCooldown = new Map(); // Prevent spam alerts
  }

  async start() {
    console.log('🏥 Starting LLM Health Monitor...');

    // Create logs directory if it doesn't exist
    const logsDir = path.dirname(this.logFile);
    if (!fs.existsSync(logsDir)) {
      fs.mkdirSync(logsDir, { recursive: true });
    }

    console.log(`📊 Monitoring interval: ${this.checkInterval / 1000}s`);
    console.log(`📝 Logs: ${this.logFile}`);
    console.log(`🚨 Alerts: ${this.alertsFile}\n`);

    // Start monitoring
    this.monitoringInterval = setInterval(() => {
      this.checkAllProviders();
    }, this.checkInterval);

    // Initial check
    await this.checkAllProviders();

    console.log('✅ Health monitoring started\n');

    // Graceful shutdown
    process.on('SIGINT', () => {
      console.log('\n🛑 Stopping health monitor...');
      this.stop();
      process.exit(0);
    });

    process.on('SIGTERM', () => {
      console.log('\n🛑 Stopping health monitor...');
      this.stop();
      process.exit(0);
    });
  }

  stop() {
    if (this.monitoringInterval) {
      clearInterval(this.monitoringInterval);
      this.monitoringInterval = null;
    }
    this.log('Health monitoring stopped');
  }

  async checkAllProviders() {
    const timestamp = new Date().toISOString();

    try {
      // Check if the API is available
      const response = await this.checkAPIHealth();
      this.log(`[${timestamp}] API Health Check: ${response.status}`);

      if (response.status === 'healthy') {
        const providers = response.providers || {};

        for (const [providerName, health] of Object.entries(providers)) {
          await this.checkProvider(providerName, health, timestamp);
        }
      } else {
        this.sendAlert('API_UNAVAILABLE', 'Main API endpoint is not responding', timestamp);
      }

    } catch (error) {
      this.log(`[${timestamp}] Health check failed: ${error.message}`);
      this.sendAlert('HEALTH_CHECK_FAILED', error.message, timestamp);
    }
  }

  async checkAPIHealth() {
    // Mock response - in real implementation, make HTTP request
    return new Promise((resolve) => {
      setTimeout(() => {
        resolve({
          status: 'healthy',
          providers: {
            deepseek: { status: 'healthy', response_time: 250 },
            groq: { status: 'healthy', response_time: 150 },
            ollama: { status: 'degraded', response_time: 800 },
            huggingface: { status: 'healthy', response_time: 400 }
          }
        });
      }, 100);
    });
  }

  async checkProvider(providerName, health, timestamp) {
    const status = health.status;
    const responseTime = health.response_time;

    // Log provider status
    this.log(`[${timestamp}] ${providerName}: ${status} (${responseTime}ms)`);

    // Check for alerts
    if (status === 'unavailable') {
      this.sendAlert(
        'PROVIDER_DOWN',
        `${providerName} provider is unavailable`,
        timestamp,
        { provider: providerName, response_time: responseTime }
      );
    } else if (status === 'degraded') {
      this.sendAlert(
        'PROVIDER_DEGRADED',
        `${providerName} provider performance degraded`,
        timestamp,
        { provider: providerName, response_time: responseTime }
      );
    } else if (status === 'healthy' && responseTime > 1000) {
      this.sendAlert(
        'SLOW_RESPONSE',
        `${providerName} responding slowly (${responseTime}ms)`,
        timestamp,
        { provider: providerName, response_time: responseTime }
      );
    }

    // Clear alert cooldown for healthy providers
    if (status === 'healthy') {
      this.alertCooldown.delete(`PROVIDER_DOWN_${providerName}`);
      this.alertCooldown.delete(`PROVIDER_DEGRADED_${providerName}`);
    }
  }

  sendAlert(type, message, timestamp, data = {}) {
    // Check cooldown to prevent spam
    const cooldownKey = `${type}_${data.provider || 'general'}`;
    const lastAlert = this.alertCooldown.get(cooldownKey);

    if (lastAlert && (Date.now() - lastAlert) < 300000) { // 5 minutes cooldown
      return;
    }

    this.alertCooldown.set(cooldownKey, Date.now());

    // Log alert
    const alertMessage = `[${timestamp}] 🚨 ALERT ${type}: ${message}`;
    this.log(alertMessage, 'alerts');

    // Console output
    console.log(`🚨 ${type}: ${message}`);

    // In production, you might want to send notifications:
    // - Email alerts
    // - Slack/Discord webhooks
    // - SMS notifications
    // - PagerDuty integration

    // For now, just log to alerts file
    fs.appendFileSync(this.alertsFile, alertMessage + '\n');
  }

  log(message, type = 'health') {
    const logMessage = `${message}\n`;
    const filePath = type === 'alerts' ? this.alertsFile : this.logFile;

    // Ensure log file exists
    if (!fs.existsSync(filePath)) {
      fs.writeFileSync(filePath, logMessage);
    } else {
      fs.appendFileSync(filePath, logMessage);
    }
  }

  // Get health summary
  async getHealthSummary() {
    try {
      const logs = fs.readFileSync(this.logFile, 'utf8');
      const lines = logs.split('\n').filter(line => line.trim());

      const last24Hours = lines.slice(-100); // Last 100 entries
      const healthy = last24Hours.filter(line => line.includes('healthy')).length;
      const degraded = last24Hours.filter(line => line.includes('degraded')).length;
      const unavailable = last24Hours.filter(line => line.includes('unavailable')).length;

      return {
        total_checks: last24Hours.length,
        healthy,
        degraded,
        unavailable,
        uptime_percentage: last24Hours.length > 0 ? ((healthy / last24Hours.length) * 100).toFixed(1) : 0
      };
    } catch (error) {
      return {
        total_checks: 0,
        healthy: 0,
        degraded: 0,
        unavailable: 0,
        uptime_percentage: 0
      };
    }
  }

  // Display current status
  async displayStatus() {
    console.log('\n📊 Current Health Status:');

    try {
      const summary = await this.getHealthSummary();
      console.log(`   Total Checks: ${summary.total_checks}`);
      console.log(`   Healthy: ${summary.healthy}`);
      console.log(`   Degraded: ${summary.degraded}`);
      console.log(`   Unavailable: ${summary.unavailable}`);
      console.log(`   Uptime: ${summary.uptime_percentage}%`);

      // Show recent alerts
      if (fs.existsSync(this.alertsFile)) {
        const alerts = fs.readFileSync(this.alertsFile, 'utf8');
        const recentAlerts = alerts.split('\n').slice(-5).filter(line => line.trim());

        if (recentAlerts.length > 0) {
          console.log('\n🚨 Recent Alerts:');
          recentAlerts.forEach(alert => {
            if (alert.trim()) {
              console.log(`   ${alert}`);
            }
          });
        }
      }
    } catch (error) {
      console.log('   Error reading health data:', error.message);
    }
  }
}

// CLI interface
async function main() {
  const args = process.argv.slice(2);
  const command = args[0];

  const monitor = new HealthMonitor();

  switch (command) {
    case 'start':
      await monitor.start();
      break;

    case 'status':
      await monitor.displayStatus();
      break;

    case 'stop':
      monitor.stop();
      console.log('✅ Health monitor stopped');
      break;

    default:
      console.log('🤖 LLM Health Monitor');
      console.log('\nUsage:');
      console.log('  node scripts/monitor-health.js start   - Start continuous monitoring');
      console.log('  node scripts/monitor-health.js status  - Show current health status');
      console.log('  node scripts/monitor-health.js stop    - Stop monitoring');
      console.log('\nExamples:');
      console.log('  npm run monitor-health start');
      console.log('  npm run monitor-health status');
      break;
  }
}

// Run if called directly
if (require.main === module) {
  main().catch(console.error);
}

module.exports = HealthMonitor;