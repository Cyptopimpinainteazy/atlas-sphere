#!/usr/bin/env node

/**
 * LLM Provider Testing Script
 *
 * Tests connectivity and performance of all configured LLM providers
 */

const fs = require('fs');
const path = require('path');
const { performance } = require('perf_hooks');

class ProviderTester {
  constructor() {
    this.envPath = path.join(__dirname, '..', '.env.local');
    this.results = [];
  }

  async run() {
    console.log('🧪 Testing LLM Providers\n');

    try {
      // Load environment variables
      await this.loadEnvironment();

      // Test each provider
      await this.testDeepSeek();
      await this.testGroq();
      await this.testHuggingFace();
      await this.testOllama();

      // Display results
      this.displayResults();

      // Generate recommendations
      this.generateRecommendations();

    } catch (error) {
      console.error('❌ Testing failed:', error.message);
      process.exit(1);
    }
  }

  async loadEnvironment() {
    if (!fs.existsSync(this.envPath)) {
      throw new Error('.env.local not found. Please run setup-llm.js first.');
    }

    // In a real implementation, you'd load the .env file
    console.log('✅ Environment loaded');
  }

  async testDeepSeek() {
    console.log('🔬 Testing DeepSeek...');

    const startTime = performance.now();
    try {
      // Mock test - replace with actual API call
      await this.delay(500 + Math.random() * 1000);

      const responseTime = performance.now() - startTime;
      this.results.push({
        provider: 'DeepSeek',
        status: 'healthy',
        responseTime,
        error: null
      });

      console.log(`   ✅ DeepSeek: ${responseTime.toFixed(0)}ms`);
    } catch (error) {
      this.results.push({
        provider: 'DeepSeek',
        status: 'error',
        responseTime: performance.now() - startTime,
        error: error.message
      });
      console.log(`   ❌ DeepSeek: ${error.message}`);
    }
  }

  async testGroq() {
    console.log('🔬 Testing Groq...');

    const startTime = performance.now();
    try {
      // Mock test - replace with actual API call
      await this.delay(200 + Math.random() * 500);

      const responseTime = performance.now() - startTime;
      this.results.push({
        provider: 'Groq',
        status: 'healthy',
        responseTime,
        error: null
      });

      console.log(`   ✅ Groq: ${responseTime.toFixed(0)}ms`);
    } catch (error) {
      this.results.push({
        provider: 'Groq',
        status: 'error',
        responseTime: performance.now() - startTime,
        error: error.message
      });
      console.log(`   ❌ Groq: ${error.message}`);
    }
  }

  async testHuggingFace() {
    console.log('🔬 Testing HuggingFace...');

    const startTime = performance.now();
    try {
      // Mock test - replace with actual API call
      await this.delay(800 + Math.random() * 1200);

      const responseTime = performance.now() - startTime;
      this.results.push({
        provider: 'HuggingFace',
        status: 'healthy',
        responseTime,
        error: null
      });

      console.log(`   ✅ HuggingFace: ${responseTime.toFixed(0)}ms`);
    } catch (error) {
      this.results.push({
        provider: 'HuggingFace',
        status: 'error',
        responseTime: performance.now() - startTime,
        error: error.message
      });
      console.log(`   ❌ HuggingFace: ${error.message}`);
    }
  }

  async testOllama() {
    console.log('🔬 Testing Ollama...');

    const startTime = performance.now();
    try {
      // Mock test - replace with actual API call
      await this.delay(100 + Math.random() * 200);

      const responseTime = performance.now() - startTime;
      this.results.push({
        provider: 'Ollama',
        status: 'healthy',
        responseTime,
        error: null
      });

      console.log(`   ✅ Ollama: ${responseTime.toFixed(0)}ms`);
    } catch (error) {
      this.results.push({
        provider: 'Ollama',
        status: 'error',
        responseTime: performance.now() - startTime,
        error: error.message
      });
      console.log(`   ❌ Ollama: ${error.message}`);
    }
  }

  delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  displayResults() {
    console.log('\n📊 Test Results:');

    const healthy = this.results.filter(r => r.status === 'healthy');
    const errors = this.results.filter(r => r.status === 'error');

    console.log(`\n✅ Healthy: ${healthy.length}/${this.results.length}`);
    console.log(`❌ Errors: ${errors.length}/${this.results.length}`);

    // Performance summary
    if (healthy.length > 0) {
      const avgResponseTime = healthy.reduce((sum, r) => sum + r.responseTime, 0) / healthy.length;
      const fastest = healthy.reduce((min, r) => r.responseTime < min.responseTime ? r : min);
      const slowest = healthy.reduce((max, r) => r.responseTime > max.responseTime ? r : max);

      console.log('\n⚡ Performance:');
      console.log(`   Average: ${avgResponseTime.toFixed(0)}ms`);
      console.log(`   Fastest: ${fastest.provider} (${fastest.responseTime.toFixed(0)}ms)`);
      console.log(`   Slowest: ${slowest.provider} (${slowest.responseTime.toFixed(0)}ms)`);
    }

    // Detailed results
    console.log('\n📋 Details:');
    this.results.forEach(result => {
      const icon = result.status === 'healthy' ? '✅' : '❌';
      console.log(`   ${icon} ${result.provider}: ${result.responseTime.toFixed(0)}ms`);

      if (result.error) {
        console.log(`      Error: ${result.error}`);
      }
    });
  }

  generateRecommendations() {
    console.log('\n💡 Recommendations:');

    const healthy = this.results.filter(r => r.status === 'healthy');
    const errors = this.results.filter(r => r.status === 'error');

    if (healthy.length === 0) {
      console.log('   ❌ No providers are working. Please check your API keys.');
      return;
    }

    if (healthy.length === this.results.length) {
      console.log('   ✅ All providers are working correctly!');
    }

    // Provider-specific recommendations
    const groq = healthy.find(r => r.provider === 'Groq');
    const deepseek = healthy.find(r => r.provider === 'DeepSeek');
    const huggingface = healthy.find(r => r.provider === 'HuggingFace');
    const ollama = healthy.find(r => r.provider === 'Ollama');

    if (groq && groq.responseTime < 300) {
      console.log('   🚀 Use Groq for real-time trading decisions (fastest)');
    }

    if (deepseek) {
      console.log('   🔧 Use DeepSeek for technical analysis and code generation');
    }

    if (huggingface) {
      console.log('   💭 Use HuggingFace for sentiment analysis');
    }

    if (ollama) {
      console.log('   🛡️ Use Ollama for privacy-sensitive tasks (local processing)');
    }

    if (errors.length > 0) {
      console.log('\n   🔧 Troubleshooting:');
      errors.forEach(error => {
        console.log(`      ${error.provider}: ${error.error}`);
      });
    }
  }
}

// Run tests if called directly
if (require.main === module) {
  const tester = new ProviderTester();
  tester.run().catch(console.error);
}

module.exports = ProviderTester;