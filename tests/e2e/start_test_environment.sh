#!/bin/bash

# X3-Atlas-Sphere E2E Test Environment Startup Script
# This script starts the complete test environment with monitoring and mock services

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"
COMPOSE_FILE="$SCRIPT_DIR/docker-compose.test.yml"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

log_info() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

log_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

log_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

log_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# Check if Docker is running
if ! docker info > /dev/null 2>&1; then
    log_error "Docker is not running. Please start Docker and try again."
    exit 1
fi

# Check if Docker Compose is available
if ! command -v docker-compose > /dev/null 2>&1 && ! docker compose version > /dev/null 2>&1; then
    log_error "Docker Compose is not available. Please install Docker Compose and try again."
    exit 1
fi

# Set up environment variables
export TEST_ENVIRONMENT=testnet
export ATLAS_NODE_ENV=testnet
export DOCKER_BUILDKIT=1

log_info "Starting X3-Atlas-Sphere E2E Test Environment..."
log_info "Test Environment: $TEST_ENVIRONMENT"
log_info "Project Root: $PROJECT_ROOT"

# Clean up any existing containers
log_info "Cleaning up existing containers..."
docker-compose -f "$COMPOSE_FILE" down -v --remove-orphans 2>/dev/null || true

# Create necessary directories
log_info "Creating necessary directories..."
mkdir -p "$SCRIPT_DIR/logs"
mkdir -p "$SCRIPT_DIR/test-results"
mkdir -p "$SCRIPT_DIR/monitoring/data"

# Build and start services
log_info "Building and starting services..."
docker-compose -f "$COMPOSE_FILE" up -d --build

# Wait for services to be healthy
log_info "Waiting for services to be healthy..."

# Function to wait for service
wait_for_service() {
    local service_name=$1
    local url=$2
    local max_attempts=60
    local attempt=0
    
    log_info "Waiting for $service_name to be ready..."
    
    while [ $attempt -lt $max_attempts ]; do
        if curl -f -s "$url" > /dev/null 2>&1; then
            log_success "$service_name is ready!"
            return 0
        fi
        
        attempt=$((attempt + 1))
        echo -n "."
        sleep 2
    done
    
    log_error "$service_name failed to start within expected time"
    return 1
}

# Wait for critical services
echo ""
wait_for_service "Atlas Node" "http://localhost:9933/health"
wait_for_service "Redis" "http://localhost:6379"
wait_for_service "PostgreSQL" "http://localhost:5432"

# Wait for mock services (optional)
echo ""
log_info "Waiting for mock services..."
docker-compose -f "$COMPOSE_FILE" ps

# Show service status
log_info "Service Status:"
docker-compose -f "$COMPOSE_FILE" ps

# Display access information
echo ""
log_success "🎉 E2E Test Environment is ready!"
echo ""
echo "🔗 Service Access Points:"
echo "  📊 Grafana Dashboard: http://localhost:3000 (admin/admin)"
echo "  📈 Prometheus: http://localhost:9090"
echo "  🚨 AlertManager: http://localhost:9093"
echo "  🔗 Atlas Node RPC: http://localhost:9933"
echo "  🔌 WebSocket: ws://localhost:9944"
echo "  💾 Redis: localhost:6379"
echo "  🗄️  PostgreSQL: localhost:5432 (atlas_testnet/testuser/testpass)"
echo ""
echo "🚀 To run tests:"
echo "  cd $SCRIPT_DIR"
echo "  ./run_e2e_tests.sh"
echo ""
echo "🧹 To stop environment:"
echo "  ./stop_test_environment.sh"
echo ""

# Save PID for cleanup
echo $$ > "$SCRIPT_DIR/.test_env.pid"
log_success "Test environment started successfully!"
