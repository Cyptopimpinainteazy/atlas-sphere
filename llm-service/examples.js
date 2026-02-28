#!/usr/bin/env node

/**
 * Example usage of SubstreamsSkillsClient
 * Demonstrates all major features
 */

const { SubstreamsSkillsClient, SubstreamsSkillsAssistant } = require('./client');

async function main() {
  console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('  Substreams Skills Client Examples');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

  // Initialize client
  const client = new SubstreamsSkillsClient({
    endpoint: 'http://localhost:3000',
    defaultProvider: 'ollama',
  });

  // Example 1: Health check
  console.log('1️⃣  Health Check');
  console.log('─'.repeat(60));
  try {
    const health = await client.getHealth();
    console.log(`✓ Status: ${health.status}`);
    console.log(`✓ Provider: ${health.provider}\n`);
  } catch (error) {
    console.error(`✗ Error: ${error.message}\n`);
    process.exit(1);
  }

  // Example 2: Get available models
  console.log('2️⃣  Available Models');
  console.log('─'.repeat(60));
  try {
    const models = await client.getModels();
    Object.entries(models).forEach(([name, config]) => {
      console.log(`${name}:`);
      console.log(`  Type: ${config.type}`);
      console.log(`  Model: ${config.default_model}`);
      console.log(`  Available: ${config.available ? '✓' : '✗'}\n`);
    });
  } catch (error) {
    console.error(`✗ Error: ${error.message}\n`);
  }

  // Example 3: Direct query
  console.log('3️⃣  Direct Query (Ollama)');
  console.log('─'.repeat(60));
  try {
    const result = await client.query(
      'What is a Substreams map module and how does it work?',
      { provider: 'ollama', temperature: 0.7 }
    );
    console.log(`Provider: ${result.provider}/${result.model}`);
    console.log(`Response time: ${result.response_time}ms\n`);
    console.log('Response:');
    console.log(result.response.substring(0, 300) + '...\n');
  } catch (error) {
    console.error(`✗ Error: ${error.message}\n`);
  }

  // Example 4: Query specific skill
  console.log('4️⃣  Query Specific Skill (substreams-dev)');
  console.log('─'.repeat(60));
  try {
    const result = await client.querySkill(
      'substreams-dev',
      'How do I create an efficient store module?',
      { provider: 'ollama' }
    );
    console.log(`Skill: ${result.skill}`);
    console.log(`Provider: ${result.provider}/${result.model}`);
    console.log(`Response time: ${result.response_time}ms\n`);
    console.log('Response:');
    console.log(result.response.substring(0, 300) + '...\n');
  } catch (error) {
    console.error(`✗ Error: ${error.message}\n`);
  }

  // Example 5: Helper methods
  console.log('5️⃣  Helper Methods');
  console.log('─'.repeat(60));

  const assistant = new SubstreamsSkillsAssistant(client);

  const questions = [
    { method: 'Design a protobuf schema', fn: 'askDevelopment' },
    { method: 'Set up PostgreSQL sink', fn: 'askSQL' },
    { method: 'Write unit tests', fn: 'askTesting' },
  ];

  for (const q of questions) {
    try {
      const result = await assistant[q.fn](q.method);
      console.log(`✓ ${q.method}`);
      console.log(`  Response time: ${result.response_time}ms`);
    } catch (error) {
      console.error(`✗ ${q.method}: ${error.message}`);
    }
  }

  console.log();

  // Example 6: Compare providers
  console.log('6️⃣  Compare Providers');
  console.log('─'.repeat(60));
  try {
    const testQuery = 'Explain Substreams index modules';
    console.log(`Query: "${testQuery}"\n`);

    const comparison = await client.compareProviders(testQuery);

    Object.entries(comparison).forEach(([provider, result]) => {
      if (result.success) {
        console.log(`${provider}:`);
        console.log(`  ✓ Response time: ${result.response_time}ms`);
        console.log(`  First 100 chars: ${result.response.substring(0, 100)}...\n`);
      } else {
        console.log(`${provider}: ✗ ${result.error}\n`);
      }
    });
  } catch (error) {
    console.error(`✗ Error: ${error.message}\n`);
  }

  // Example 7: Metrics
  console.log('7️⃣  Metrics & Statistics');
  console.log('─'.repeat(60));
  try {
    const metrics = await client.getMetrics();
    console.log(`Total queries: ${metrics.total_queries}`);
    console.log(`Uptime: ${(metrics.uptime_ms / 1000).toFixed(2)}s\n`);

    Object.entries(metrics.providers).forEach(([provider, stats]) => {
      console.log(`${provider}:`);
      console.log(`  Queries: ${stats.queries}`);
      console.log(`  Failures: ${stats.failures}`);
      console.log(`  Avg time: ${stats.avgTime.toFixed(0)}ms\n`);
    });
  } catch (error) {
    console.error(`✗ Error: ${error.message}\n`);
  }

  // Example 8: Error handling
  console.log('8️⃣  Error Handling Example');
  console.log('─'.repeat(60));
  try {
    const result = await client.query(
      'What is the meaning of life?',
      { provider: 'nonexistent-provider' }
    );
  } catch (error) {
    console.log(`✓ Caught error: ${error.message}\n`);
  }

  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('  Examples Complete!');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
}

main().catch(console.error);
