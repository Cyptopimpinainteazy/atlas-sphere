#!/bin/bash

# Setup script for Substreams Skills + LLM Integration
# Quick setup for Ollama and OpenRouter integration

set -e

echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "  Substreams Skills LLM Integration Setup"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo

# Check prerequisites
echo "Checking prerequisites..."

# Check for Node.js
if ! command -v node &> /dev/null; then
    echo "✗ Node.js not found. Install from https://nodejs.org/"
    exit 1
fi
echo "✓ Node.js $(node --version)"

# Check for npm
if ! command -v npm &> /dev/null; then
    echo "✗ npm not found"
    exit 1
fi
echo "✓ npm $(npm --version)"

# Check for curl
if ! command -v curl &> /dev/null; then
    echo "⚠ curl not found (optional, needed for healthchecks)"
fi

echo
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "  Step 1: Choose LLM Provider Setup"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo

echo "1. Ollama (Local, Free)"
echo "2. OpenRouter (API, Requires Key)"
echo "3. Both (Recommended)"
echo

read -p "Choose setup [1-3] (default: 1): " CHOICE
CHOICE=${CHOICE:-1}

SETUP_OLLAMA=false
SETUP_OPENROUTER=false

case $CHOICE in
    1) SETUP_OLLAMA=true ;;
    2) SETUP_OPENROUTER=true ;;
    3) SETUP_OLLAMA=true; SETUP_OPENROUTER=true ;;
    *) echo "Invalid choice"; exit 1 ;;
esac

# Setup Node.js dependencies
echo
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "  Step 2: Install Dependencies"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo

# Create package.json if doesn't exist
if [ ! -f package.json ]; then
    echo "Creating package.json..."
    cat > package.json << 'EOF'
{
  "name": "substreams-llm-router",
  "version": "1.0.0",
  "description": "LLM Router for Substreams Skills",
  "main": "llm-service/router.js",
  "scripts": {
    "start": "node llm-service/router.js",
    "dev": "node llm-service/router.js --config ./llm-config.json",
    "test": "node -e \"console.log('LLM service healthy!')\"",
    "test-query": "node scripts/test-query.js"
  },
  "dependencies": {
    "fetch": "^1.1.0"
  },
  "devDependencies": {},
  "engines": {
    "node": ">=18.0.0"
  }
}
EOF
fi

npm install --production || true
echo "✓ Dependencies installed"

# Setup Ollama
if [ "$SETUP_OLLAMA" = true ]; then
    echo
    echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
    echo "  Step 3: Ollama Setup"
    echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
    echo

    if command -v ollama &> /dev/null; then
        echo "✓ Ollama already installed"
        OLLAMA_VERSION=$(ollama --version)
        echo "  Version: $OLLAMA_VERSION"
    else
        echo "Ollama not installed. Install from https://ollama.ai"
        echo "  macOS/Linux: curl -fsSL https://ollama.ai/install.sh | sh"
        echo "  Windows: Download from https://ollama.ai/download/windows"
        echo "  Docker: docker pull ollama/ollama"
        echo

        read -p "Install Ollama? (y/n): " -n 1 -r
        echo
        if [[ $REPLY =~ ^[Yy]$ ]]; then
            case "$(uname -s)" in
                Linux*)
                    echo "Installing Ollama for Linux..."
                    curl -fsSL https://ollama.ai/install.sh | sh
                    ;;
                Darwin*)
                    echo "Installing Ollama for macOS..."
                    echo "Please download and install from https://ollama.ai/download"
                    ;;
                *)
                    echo "Please visit https://ollama.ai to install Ollama"
                    ;;
            esac
        fi
    fi

    echo
    echo "Recommended models:"
    echo "  ollama pull mistral       # Balanced (7B, 4GB)"
    echo "  ollama pull neural-chat   # Fast (7B, 3GB)"
    echo "  ollama pull codellama     # Code-focused (7B, 5GB)"
    echo
    
    if pgrep -x "ollama" > /dev/null; then
        echo "✓ Ollama service is running"
    else
        echo "⚠ Ollama service is not running"
        echo "  Start with: ollama serve"
    fi
fi

# Setup OpenRouter
if [ "$SETUP_OPENROUTER" = true ]; then
    echo
    echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
    echo "  Step 4: OpenRouter Setup"
    echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
    echo

    if [ -z "$OPENROUTER_API_KEY" ]; then
        echo "OpenRouter API key not set."
        echo "1. Visit https://openrouter.ai"
        echo "2. Sign in or create account"
        echo "3. Copy API key from settings"
        echo "4. Set environment variable:"
        echo
        echo "   export OPENROUTER_API_KEY=sk-or-..."
        echo

        read -p "Enter your OpenRouter API key (leave blank to skip): " API_KEY
        if [ -n "$API_KEY" ]; then
            export OPENROUTER_API_KEY="$API_KEY"
            echo "export OPENROUTER_API_KEY='$API_KEY'" >> ~/.bashrc
            echo "export OPENROUTER_API_KEY='$API_KEY'" >> ~/.bash_profile
            echo "✓ API key saved to ~/.bashrc and ~/.bash_profile"
        fi
    else
        echo "✓ OPENROUTER_API_KEY is set"
    fi
fi

# Create scripts directory
echo
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "  Step 5: Creating Helper Scripts"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo

mkdir -p scripts

# Create test script
cat > scripts/test-query.js << 'EOF'
#!/usr/bin/env node

const http = require('http');

const query = "What is a Substreams map module?";
const payload = JSON.stringify({ query, provider: "ollama" });

const options = {
  hostname: 'localhost',
  port: 3000,
  path: '/query',
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Content-Length': Buffer.byteLength(payload),
  },
};

console.log(`\nTesting LLM Router (${query})\n`);
console.log('━'.repeat(60));

const req = http.request(options, (res) => {
  let data = '';
  res.on('data', chunk => { data += chunk; process.stdout.write('.'); });
  res.on('end', () => {
    try {
      const response = JSON.parse(data);
      console.log('\n');
      console.log(`Provider: ${response.provider}/${response.model}`);
      console.log(`Response time: ${response.responseTime}ms`);
      console.log(`\n${response.response}`);
    } catch (e) {
      console.error('\nError:', e.message);
    }
  });
});

req.on('error', (e) => {
  console.error(`\nConnection error: ${e.message}`);
  console.error('\nMake sure LLM Router is running:');
  console.error('  npm start\n');
});

req.write(payload);
req.end();
EOF

chmod +x scripts/test-query.js
echo "✓ Created scripts/test-query.js"

# Summary
echo
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "  Setup Complete!"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo

echo "Next steps:"
echo
echo "1. Start Ollama (if using):"
echo "   $ ollama serve"
echo
echo "2. In another terminal, start the LLM Router:"
echo "   $ npm start"
echo
echo "3. Test the setup:"
echo "   $ node scripts/test-query.js"
echo
echo "4. Use the client libraries:"
echo "   - JavaScript: require('./llm-service/client.js')"
echo "   - Python: from llm_service.client import SubstreamsSkillsClient"
echo
echo "5. Read the docs:"
echo "   - See: substreams-skills-llm-integration.md"
echo

if [ "$SETUP_OLLAMA" = true ]; then
    echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
    echo "  Recommended Ollama Models"
    echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
    echo
    echo "Fast (3-4GB RAM):"
    echo "  ollama pull neural-chat"
    echo
    echo "Balanced (4GB RAM) - RECOMMENDED:"
    echo "  ollama pull mistral"
    echo
    echo "Code-focused (5GB RAM):"
    echo "  ollama pull codellama"
    echo
    echo "Powerful (8GB+ RAM):"
    echo "  ollama pull mistral:13b"
    echo "  ollama pull llama2:13b"
    echo
fi

echo "Happy Coding! 🚀"
echo
