#!/bin/bash

# Package Script for Solana Flashloan Arbitrage Bot
# Creates a deployable archive with all necessary files

set -e

PACKAGE_NAME="solana-flashloan-arb-bot-$(date +%Y%m%d-%H%M%S)"
ARCHIVE_NAME="${PACKAGE_NAME}.tar.gz"

echo "📦 Packaging Solana Flashloan Arbitrage Bot"
echo "Package name: $PACKAGE_NAME"
echo "Archive: $ARCHIVE_NAME"

# Colors for output
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m'

# Create temporary directory for packaging
TEMP_DIR=$(mktemp -d)
PACKAGE_DIR="$TEMP_DIR/$PACKAGE_NAME"

echo -e "${YELLOW}Creating package structure...${NC}"

# Create package directory structure
mkdir -p "$PACKAGE_DIR"

# Copy main directories and files
echo -e "${YELLOW}Copying source files...${NC}"

# Copy anchor project
cp -r anchor "$PACKAGE_DIR/"

# Copy Python services
mkdir -p "$PACKAGE_DIR/python-services"
cp -r python-services/arb_daemon "$PACKAGE_DIR/python-services/"
cp -r python-services/trading-engine "$PACKAGE_DIR/python-services/"

# Copy scripts
cp deploy.sh "$PACKAGE_DIR/"
cp stop.sh "$PACKAGE_DIR/"
cp package.sh "$PACKAGE_DIR/"

# Copy documentation
cp README.md "$PACKAGE_DIR/"
cp LICENSE "$PACKAGE_DIR/" 2>/dev/null || echo "No LICENSE file found"

# Create configuration templates
echo -e "${YELLOW}Creating configuration templates...${NC}"

# Create .env.example for Python services
cat > "$PACKAGE_DIR/python-services/.env.example" << 'EOF'
# Wallet Configuration
WALLET_PRIVATE_KEY=your_private_key_here

# Program IDs (will be filled during deployment)
FLASHLOAN_PROGRAM_ID=
ARB_ENGINE_PROGRAM_ID=

# Network Configuration
SOLANA_NETWORK=mainnet-beta
RPC_URL=https://api.mainnet-beta.solana.com

# Logging
LOG_LEVEL=INFO

# Optional: Alert Configuration
TELEGRAM_BOT_TOKEN=
TELEGRAM_CHAT_ID=
EOF

# Create config.yaml.example
cp python-services/arb_daemon/config.yaml "$PACKAGE_DIR/python-services/arb_daemon/config.yaml.example" 2>/dev/null || echo "Config file not found, creating basic template"

# Create deployment verification script
cat > "$PACKAGE_DIR/verify.sh" << 'EOF'
#!/bin/bash

# Verification Script for Deployed Bot
# Run this after deployment to verify everything is working

echo "🔍 Verifying Solana Flashloan Arbitrage Bot deployment"

# Check if services are running
if [ -f "arb_daemon.pid" ] && kill -0 $(cat arb_daemon.pid) 2>/dev/null; then
    echo "✅ Arbitrage daemon is running"
else
    echo "❌ Arbitrage daemon is not running"
fi

if [ -f "trading_engine.pid" ] && kill -0 $(cat trading_engine.pid) 2>/dev/null; then
    echo "✅ Trading engine API is running"
else
    echo "❌ Trading engine API is not running"
fi

# Check API health
if curl -s http://localhost:8001/health > /dev/null; then
    echo "✅ API health check passed"
else
    echo "❌ API health check failed"
fi

# Check database
if [ -f "arb_history.db" ]; then
    echo "✅ Trade history database exists"
else
    echo "❌ Trade history database missing"
fi

# Check log files
if [ -d "logs" ]; then
    echo "✅ Log directory exists"
    ls -la logs/
else
    echo "❌ Log directory missing"
fi

echo "🔍 Verification complete"
EOF

chmod +x "$PACKAGE_DIR/verify.sh"

# Create cleanup script
cat > "$PACKAGE_DIR/cleanup.sh" << 'EOF'
#!/bin/bash

# Cleanup Script for Solana Flashloan Arbitrage Bot
# Removes all generated files and resets to clean state

echo "🧹 Cleaning up Solana Flashloan Arbitrage Bot"

# Stop services
./stop.sh 2>/dev/null || true

# Remove generated files
rm -f arb_daemon.pid
rm -f trading_engine.pid
rm -rf logs/
rm -f arb_history.db
rm -f python-services/.env
rm -rf python-services/venv/

# Remove Anchor build artifacts
cd anchor
anchor clean 2>/dev/null || true
rm -rf target/
rm -rf node_modules/
cd ..

echo "✅ Cleanup complete"
EOF

chmod +x "$PACKAGE_DIR/cleanup.sh"

# Create install script
cat > "$PACKAGE_DIR/install.sh" << 'EOF'
#!/bin/bash

# Installation Script for Solana Flashloan Arbitrage Bot
# Run this on a fresh system to set up all dependencies

set -e

echo "🔧 Installing Solana Flashloan Arbitrage Bot"

# Check OS
if [[ "$OSTYPE" == "linux-gnu"* ]]; then
    OS="linux"
elif [[ "$OSTYPE" == "darwin"* ]]; then
    OS="macos"
else
    echo "❌ Unsupported OS: $OSTYPE"
    exit 1
fi

echo "Detected OS: $OS"

# Install system dependencies
if [[ "$OS" == "linux" ]]; then
    sudo apt update
    sudo apt install -y curl build-essential pkg-config libssl-dev
elif [[ "$OS" == "macos" ]]; then
    # Assume Homebrew is installed
    brew install curl openssl
fi

# Install Rust
if ! command -v rustc &> /dev/null; then
    echo "Installing Rust..."
    curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh -s -- -y
    source $HOME/.cargo/env
fi

# Install Solana CLI
if ! command -v solana &> /dev/null; then
    echo "Installing Solana CLI..."
    sh -c "$(curl -sSfL https://release.solana.com/v1.16.0/install)"
    export PATH="$HOME/.local/share/solana/install/active_release/bin:$PATH"
fi

# Install Anchor
if ! command -v anchor &> /dev/null; then
    echo "Installing Anchor..."
    cargo install --git https://github.com/coral-xyz/anchor avm --locked --force
    avm install latest
    avm use latest
fi

# Install Node.js (if not present)
if ! command -v node &> /dev/null; then
    echo "Installing Node.js..."
    if [[ "$OS" == "linux" ]]; then
        curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
        sudo apt-get install -y nodejs
    elif [[ "$OS" == "macos" ]]; then
        brew install node
    fi
fi

# Install Python dependencies
cd python-services
python3 -m venv venv
source venv/bin/activate
pip install --upgrade pip
pip install -r arb_daemon/requirements.txt
pip install -r trading-engine/requirements.txt
cd ..

echo "✅ Installation complete!"
echo ""
echo "Next steps:"
echo "1. Configure your wallet: solana-keygen new --outfile ~/.config/solana/id.json"
echo "2. Fund your wallet with SOL"
echo "3. Copy .env.example to .env and fill in your configuration"
echo "4. Run ./deploy.sh to deploy and start the bot"
EOF

chmod +x "$PACKAGE_DIR/install.sh"

# Create Dockerfile for containerized deployment
cat > "$PACKAGE_DIR/Dockerfile" << 'EOF'
FROM ubuntu:20.04

# Install system dependencies
RUN apt update && apt install -y \
    curl \
    build-essential \
    pkg-config \
    libssl-dev \
    python3 \
    python3-pip \
    python3-venv \
    nodejs \
    npm \
    sqlite3 \
    && rm -rf /var/lib/apt/lists/*

# Install Rust
RUN curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh -s -- -y
ENV PATH="/root/.cargo/bin:${PATH}"

# Install Solana CLI
RUN sh -c "$(curl -sSfL https://release.solana.com/v1.16.0/install)"
ENV PATH="$HOME/.local/share/solana/install/active_release/bin:${PATH}"

# Install Anchor
RUN cargo install --git https://github.com/coral-xyz/anchor avm --locked --force
RUN avm install latest && avm use latest

# Set working directory
WORKDIR /app

# Copy source code
COPY . .

# Install Python dependencies
RUN cd python-services && python3 -m venv venv && \
    . venv/bin/activate && \
    pip install --upgrade pip && \
    pip install -r arb_daemon/requirements.txt && \
    pip install -r trading-engine/requirements.txt

# Install Node.js dependencies
RUN cd anchor && npm install

# Make scripts executable
RUN chmod +x deploy.sh stop.sh verify.sh cleanup.sh

# Expose ports
EXPOSE 8001

# Default command
CMD ["./deploy.sh"]
EOF

# Create docker-compose.yml
cat > "$PACKAGE_DIR/docker-compose.yml" << 'EOF'
version: '3.8'

services:
  arb-bot:
    build: .
    container_name: solana-arb-bot
    volumes:
      - ./logs:/app/logs
      - ./arb_history.db:/app/arb_history.db
      - ~/.config/solana:/root/.config/solana:ro
    environment:
      - WALLET_PRIVATE_KEY=${WALLET_PRIVATE_KEY}
      - SOLANA_NETWORK=mainnet-beta
    ports:
      - "8001:8001"
    restart: unless-stopped
    healthcheck:
      test: ["CMD", "curl", "-f", "http://localhost:8001/health"]
      interval: 30s
      timeout: 10s
      retries: 3
EOF

# Create .dockerignore
cat > "$PACKAGE_DIR/.dockerignore" << 'EOF'
.git
.gitignore
*.log
logs/
arb_history.db
__pycache__/
*.pyc
.pytest_cache/
.coverage
htmlcov/
node_modules/
anchor/target/
anchor/.anchor/
*.tar.gz
EOF

# Create comprehensive .gitignore
cat > "$PACKAGE_DIR/.gitignore" << 'EOF'
# Python
__pycache__/
*.py[cod]
*$py.class
*.so
.Python
build/
develop-eggs/
dist/
downloads/
eggs/
.eggs/
lib/
lib64/
parts/
sdist/
var/
wheels/
*.egg-info/
.installed.cfg
*.egg
MANIFEST

# Virtual environments
venv/
env/
ENV/

# IDE
.vscode/
.idea/
*.swp
*.swo

# OS
.DS_Store
Thumbs.db

# Logs
logs/
*.log

# Database
arb_history.db
*.db

# Keys and secrets
.env
.env.local
.env.*.local
secrets/
keys/

# Anchor
anchor/target/
anchor/.anchor/
anchor/node_modules/

# Node.js
node_modules/
npm-debug.log*
yarn-debug.log*
yarn-error.log*

# Build artifacts
*.tar.gz
dist/
build/

# Temporary files
tmp/
temp/
*.tmp
EOF

# Create MANIFEST.txt with file descriptions
cat > "$PACKAGE_DIR/MANIFEST.txt" << 'EOF'
Solana Flashloan Arbitrage Bot - File Manifest
==============================================

Core Components:
├── anchor/                    # Anchor framework project
│   ├── programs/             # Solana programs (Rust)
│   │   ├── FlashloanReceiver/ # Flashloan borrow/repay logic
│   │   └── ArbEngine/         # Arbitrage execution engine
│   ├── tests/                # Program tests
│   └── Anchor.toml           # Anchor configuration
├── python-services/          # Off-chain services (Python)
│   ├── arb_daemon/           # Main arbitrage daemon
│   │   ├── arb_daemon.py     # Main daemon script
│   │   ├── config.yaml       # Configuration file
│   │   └── requirements.txt  # Python dependencies
│   └── trading-engine/       # Trading API server
│       ├── main.py           # FastAPI server
│       └── requirements.txt  # Python dependencies
├── deploy.sh                 # Deployment script
├── stop.sh                   # Stop script
├── verify.sh                 # Verification script
└── cleanup.sh                # Cleanup script

Configuration & Documentation:
├── README.md                 # Comprehensive documentation
├── .env.example             # Environment variables template
├── config.yaml.example      # Daemon configuration template
├── docker-compose.yml       # Docker compose configuration
├── Dockerfile               # Docker container definition
├── MANIFEST.txt            # This file
└── .gitignore              # Git ignore rules

Scripts:
├── install.sh               # System dependency installation
├── package.sh               # Create deployable archive
└── verify.sh                # Post-deployment verification

Key Files Description:
======================

Programs (Rust/Anchor):
- FlashloanReceiver: Handles Solend flashloan integration with arbitrage execution
- ArbEngine: Multi-DEX arbitrage routing and trade execution

Python Services:
- arb_daemon.py: Real-time price monitoring, opportunity detection, trade execution
- main.py (trading-engine): FastAPI server for trade management and monitoring

Configuration:
- config.yaml: Main daemon configuration (trading params, risk management, DEX settings)
- .env: Environment variables (wallet keys, API keys, network settings)

Deployment:
- deploy.sh: Automated deployment to Solana mainnet
- stop.sh: Graceful service shutdown
- verify.sh: Health checks and verification
- cleanup.sh: Reset to clean state

Containerization:
- Dockerfile: Containerized deployment
- docker-compose.yml: Multi-service orchestration
- .dockerignore: Docker build exclusions

Dependencies:
- Python requirements.txt: Python packages for off-chain services
- Anchor.toml: Solana program dependencies and configuration

Security Notes:
- Never commit .env files with real keys
- Use secure key management in production
- Regularly rotate API keys and wallet access
- Monitor for unusual trading patterns

Deployment Checklist:
1. Install system dependencies (install.sh)
2. Configure wallet and keys (.env)
3. Customize trading parameters (config.yaml)
4. Deploy programs (deploy.sh)
5. Verify deployment (verify.sh)
6. Start monitoring logs
EOF

# Create final archive
echo -e "${YELLOW}Creating archive...${NC}"

cd "$TEMP_DIR"
tar -czf "$ARCHIVE_NAME" "$PACKAGE_NAME"

# Move archive to current directory
cd -
mv "$TEMP_DIR/$ARCHIVE_NAME" .

# Cleanup
rm -rf "$TEMP_DIR"

echo -e "${GREEN}Package created successfully!${NC}"
echo -e "${GREEN}Archive: $ARCHIVE_NAME${NC}"
echo ""
echo "📦 Package contents:"
echo "├── $PACKAGE_NAME/"
echo "│   ├── anchor/                    # On-chain programs"
echo "│   ├── python-services/           # Off-chain services"
echo "│   ├── deploy.sh                  # Deployment script"
echo "│   ├── stop.sh                    # Stop script"
echo "│   ├── verify.sh                  # Verification script"
echo "│   ├── cleanup.sh                 # Cleanup script"
echo "│   ├── install.sh                 # Installation script"
echo "│   ├── README.md                  # Documentation"
echo "│   ├── Dockerfile                 # Container definition"
echo "│   ├── docker-compose.yml         # Service orchestration"
echo "│   ├── MANIFEST.txt               # File descriptions"
echo "│   └── .env.example               # Configuration template"
echo ""
echo "🚀 To deploy:"
echo "1. tar -xzf $ARCHIVE_NAME"
echo "2. cd $PACKAGE_NAME"
echo "3. ./install.sh    # Install dependencies"
echo "4. Configure .env  # Add your wallet key"
echo "5. ./deploy.sh     # Deploy to mainnet"

# Show archive info
echo ""
echo "📊 Archive details:"
ls -lh "$ARCHIVE_NAME"