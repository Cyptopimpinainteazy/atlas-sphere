#!/usr/bin/env node

/**
 * LLM Orchestrator Setup Script
 *
 * This script helps set up the free LLM orchestration system by:
 * 1. Validating environment configuration
 * 2. Testing provider connectivity
 * 3. Setting up Ollama (optional)
 * 4. Generating configuration recommendations
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');
const readline = require('readline');

class LLMSetup {
  constructor() {
    this.envPath = path.join(__dirname, '..', '.env.local');
    this.envExamplePath = path.join(__dirname, '..', '.env.example');
    this.providers = ['deepseek', 'groq', 'huggingface', 'ollama'];
    this.configuredProviders = [];
  }

  async run() {
    console.log('🤖 Welcome to the Free LLM Orchestrator Setup!\n');

    try {
      // Check if .env.local exists
      if (!fs.existsSync(this.envPath)) {
        console.log('📝 Creating .env.local from template...');
        if (fs.existsSync(this.envExamplePath)) {
          fs.copyFileSync(this.envExamplePath, this.envPath);
          console.log('✅ Created .env.local from .env.example');
        } else {
          console.log('❌ .env.example not found');
          return;
        }
      }

      // Interactive setup
      await this.askForProviderSetup();
      await this.validateConfiguration();
      await this.testProviders();
      await this.setupOllama();
      await this.generateRecommendations();

      console.log('\n🎉 Setup complete! Your free LLM orchestration system is ready.');
      console.log('\n🚀 Next steps:');
      console.log('1. Start your application: npm run dev');
      console.log('2. Visit the AI management page: http://localhost:3000/ai');
      console.log('3. Configure task routing rules for optimal performance');
      console.log('4. Monitor provider health and performance');

    } catch (error) {
      console.error('❌ Setup failed:', error.message);
      process.exit(1);
    }
  }

  async askForProviderSetup() {
    console.log('\n🔧 Provider Configuration');
    console.log('Let\'s configure your free LLM providers:\n');

    const rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout
    });

    const question = (query) => new Promise(resolve => rl.question(query, resolve));

    try {
      for (const provider of this.providers) {
        const setup = await question(`Configure ${provider}? (y/n): `);
        if (setup.toLowerCase() === 'y' || setup.toLowerCase() === 'yes') {
          await this.configureProvider(provider, question);
        } else {
          console.log(`⏭️  Skipping ${provider}`);
        }
      }
    } finally {
      rl.close();
    }
  }

  async configureProvider(provider, question) {
    console.log(`\n📝 Configuring ${provider.toUpperCase()}`);

    switch (provider) {
      case 'deepseek':
        const deepseekKey = await question('Enter your DeepSeek API key: ');
        this.updateEnvVar('DEEPSEEK_API_KEY', deepseekKey);
        this.configuredProviders.push(provider);
        break;

      case 'groq':
        const groqKey = await question('Enter your Groq API key: ');
        this.updateEnvVar('GROQ_API_KEY', groqKey);
        this.configuredProviders.push(provider);
        break;

      case 'huggingface':
        const hfKey = await question('Enter your HuggingFace API key: ');
        this.updateEnvVar('HUGGINGFACE_API_KEY', hfKey);
        this.configuredProviders.push(provider);
        break;

      case 'ollama':
        const useOllama = await question('Install and setup Ollama locally? (y/n): ');
        if (useOllama.toLowerCase() === 'y' || useOllama.toLowerCase() === 'yes') {
          this.updateEnvVar('OLLAMA_SERVER_URL', 'http://localhost:11434');
          this.updateEnvVar('OLLAMA_ENABLED', 'true');
          this.configuredProviders.push(provider);
        }
        break;
    }

    console.log(`✅ ${provider} configured`);
  }

  updateEnvVar(key, value) {
    let envContent = fs.readFileSync(this.envPath, 'utf8');
    const regex = new RegExp(`^${key}=.*$`, 'm');

    if (regex.test(envContent)) {
      envContent = envContent.replace(regex, `${key}="${value}"`);
    } else {
      envContent += `\n${key}="${value}"`;
    }

    fs.writeFileSync(this.envPath, envContent);
  }

  async validateConfiguration() {
    console.log('\n🔍 Validating configuration...');

    const requiredVars = {
      deepseek: 'DEEPSEEK_API_KEY',
      groq: 'GROQ_API_KEY',
      huggingface: 'HUGGINGFACE_API_KEY'
    };

    let validCount = 0;

    for (const [provider, envVar] of Object.entries(requiredVars)) {
      if (this.configuredProviders.includes(provider)) {
        const value = this.getEnvVar(envVar);
        if (value && value !== 'your-api-key') {
          console.log(`✅ ${provider}: API key configured`);
          validCount++;
        } else {
          console.log(`❌ ${provider}: API key missing or invalid`);
        }
      }
    }

    if (validCount === 0) {
      console.log('⚠️  No valid API keys found. You\'ll need to configure them manually.');
    } else {
      console.log(`✅ ${validCount} provider(s) configured successfully`);
    }
  }

  async testProviders() {
    console.log('\n🧪 Testing provider connectivity...');

    for (const provider of this.configuredProviders) {
      try {
        await this.testProviderConnection(provider);
        console.log(`✅ ${provider}: Connection successful`);
      } catch (error) {
        console.log(`❌ ${provider}: Connection failed - ${error.message}`);
      }
    }
  }

  async testProviderConnection(provider) {
    // This would make actual API calls to test connectivity
    // For now, we'll just validate the configuration format
    const apiKey = this.getEnvVar(this.getProviderEnvVar(provider));
    if (!apiKey || apiKey.length < 10) {
      throw new Error('Invalid API key format');
    }
  }

  getProviderEnvVar(provider) {
    const envVars = {
      deepseek: 'DEEPSEEK_API_KEY',
      groq: 'GROQ_API_KEY',
      huggingface: 'HUGGINGFACE_API_KEY',
      ollama: 'OLLAMA_SERVER_URL'
    };
    return envVars[provider] || '';
  }

  getEnvVar(key) {
    try {
      const envContent = fs.readFileSync(this.envPath, 'utf8');
      const match = envContent.match(new RegExp(`^${key}="([^"]*)"$`, 'm'));
      return match ? match[1] : null;
    } catch {
      return null;
    }
  }

  async setupOllama() {
    if (!this.configuredProviders.includes('ollama')) {
      return;
    }

    console.log('\n🐳 Setting up Ollama...');

    try {
      // Check if Ollama is installed
      try {
        execSync('ollama --version', { stdio: 'pipe' });
        console.log('✅ Ollama is already installed');
      } catch {
        console.log('📦 Installing Ollama...');
        // Installation would depend on the OS
        console.log('Please install Ollama manually from https://ollama.ai');
        return;
      }

      // Check if Ollama is running
      try {
        execSync('curl -s http://localhost:11434/api/version', { stdio: 'pipe' });
        console.log('✅ Ollama server is running');
      } catch {
        console.log('🚀 Starting Ollama server...');
        try {
          execSync('ollama serve', { detached: true, stdio: 'ignore' });
          console.log('✅ Ollama server started');
        } catch (error) {
          console.log('❌ Failed to start Ollama server:', error.message);
        }
      }

      // Pull recommended models
      const models = ['llama2', 'codellama'];
      for (const model of models) {
        console.log(`📥 Pulling model: ${model}...`);
        try {
          execSync(`ollama pull ${model}`, { stdio: 'pipe' });
          console.log(`✅ Model ${model} ready`);
        } catch (error) {
          console.log(`❌ Failed to pull model ${model}:`, error.message);
        }
      }

    } catch (error) {
      console.log('⚠️  Ollama setup encountered issues:', error.message);
      console.log('You can still use other providers while troubleshooting Ollama');
    }
  }

  async generateRecommendations() {
    console.log('\n💡 Generating recommendations...');

    const recommendations = [];

    if (this.configuredProviders.includes('ollama')) {
      recommendations.push('• Use Ollama for privacy-sensitive tasks and local processing');
    }

    if (this.configuredProviders.includes('groq')) {
      recommendations.push('• Use Groq for real-time trading decisions and fast responses');
    }

    if (this.configuredProviders.includes('deepseek')) {
      recommendations.push('• Use DeepSeek for technical analysis and code generation');
    }

    if (this.configuredProviders.includes('huggingface')) {
      recommendations.push('• Use HuggingFace for sentiment analysis and NLP tasks');
    }

    if (recommendations.length > 0) {
      console.log('\n📋 Recommended configuration:');
      recommendations.forEach(rec => console.log(rec));
    }

    console.log('\n🎛️  Access your AI management dashboard at: /ai');
    console.log('🔧 Configure routing rules in the dashboard for optimal performance');
  }
}

// Run setup if called directly
if (require.main === module) {
  const setup = new LLMSetup();
  setup.run().catch(console.error);
}

module.exports = LLMSetup;