#!/bin/bash
#
# deploy.sh - Phase 5 Jury Blockchain Anchoring Deployment Automation
# Usage: ./scripts/deploy.sh [staging|production] [with-monitoring]
#

set -e

ENV=${1:-staging}
ENABLE_MONITORING=${2:-}
DEPLOYMENT_DIR=$(dirname "$(readlink -f "$0")")
PROJECT_ROOT=$(dirname "$DEPLOYMENT_DIR")

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

# Helper functions
log_step() {
    echo -e "${BLUE}▶${NC} $1"
}

log_success() {
    echo -e "${GREEN}✓${NC} $1"
}

log_error() {
    echo -e "${RED}✗${NC} $1"
}

log_warning() {
    echo -e "${YELLOW}⚠${NC} $1"
}

# Pre-deployment checks
check_requirements() {
    log_step "Checking requirements..."
    
    # Check Docker
    if ! command -v docker &> /dev/null; then
        log_error "Docker not found. Please install Docker."
        exit 1
    fi
    log_success "Docker found"
    
    # Check Docker Compose
    if ! command -v docker-compose &> /dev/null; then
        log_error "Docker Compose not found. Please install Docker Compose."
        exit 1
    fi
    log_success "Docker Compose found"
    
    # Check environment file
    ENV_FILE="${PROJECT_ROOT}/.env.${ENV}"
    if [ ! -f "$ENV_FILE" ]; then
        log_warning "Environment file not found: $ENV_FILE"
        log_step "Creating from template..."
        cat > "$ENV_FILE" << 'EOF'
# Atlas Jury Phase 5 Deployment Environment
RPC_URL=http://localhost:9944
JURY_SERVICE_URL=http://localhost:8080
DB_HOST=localhost
DB_PORT=5432
DB_USER=jury_admin
DB_PASSWORD=changeme_secure_password
JURY_AUTHORITY=0x0000000000000000000000000000000000000000
LOG_LEVEL=INFO
POLLING_INTERVAL_SECONDS=2
MAX_FINALIZATION_ATTEMPTS=30
EOF
        log_warning "Please update .env.${ENV} with correct values"
    fi
    log_success "Environment file ready"
}

# Backup current state
backup_database() {
    log_step "Backing up database..."
    
    BACKUP_DIR="${PROJECT_ROOT}/backups"
    mkdir -p "$BACKUP_DIR"
    
    BACKUP_FILE="${BACKUP_DIR}/jury_db_$(date +%Y%m%d_%H%M%S).sql"
    
    # Check if database is running
    if docker ps | grep -q postgres; then
        docker exec $(docker ps -q -f "ancestor=postgres:15") \
            pg_dump -U jury_admin jury_db > "$BACKUP_FILE" 2>/dev/null || {
            log_warning "Database backup skipped (database may not be initialized yet)"
            return
        }
        log_success "Database backed up to $BACKUP_FILE"
    else
        log_warning "Database not running, skipping backup"
    fi
}

# Build runtime changes
build_pallet() {
    log_step "Building runtime pallet..."
    
    cd "${PROJECT_ROOT}/pallets/atlas-jury-anchor"
    
    if ! cargo build --release 2>&1 | tail -20; then
        log_error "Pallet build failed"
        exit 1
    fi
    
    log_success "Pallet built successfully"
    cd - > /dev/null
}

# Deploy services
deploy_services() {
    local compose_file="${PROJECT_ROOT}/docker-compose.${ENV}.yml"
    
    if [ ! -f "$compose_file" ]; then
        log_warning "Using default docker-compose.yml"
        compose_file="${PROJECT_ROOT}/docker-compose.yml"
    fi
    
    log_step "Deploying services to $ENV environment..."
    
    export ENV_FILE="${PROJECT_ROOT}/.env.${ENV}"
    
    docker-compose -f "$compose_file" down 2>/dev/null || true
    sleep 2
    
    docker-compose -f "$compose_file" up -d || {
        log_error "Docker Compose failed"
        exit 1
    }
    
    log_success "Services deployed"
}

# Wait for services
wait_for_services() {
    log_step "Waiting for services to be ready..."
    
    local max_attempts=30
    local attempt=0
    
    while [ $attempt -lt $max_attempts ]; do
        if curl -s http://localhost:9944 > /dev/null 2>&1; then
            log_success "RPC node is ready"
            break
        fi
        
        attempt=$((attempt + 1))
        echo -n "."
        sleep 1
    done
    
    if [ $attempt -eq $max_attempts ]; then
        log_error "Services failed to start"
        exit 1
    fi
}

# Run health checks
run_health_checks() {
    log_step "Running health checks..."
    
    bash "${PROJECT_ROOT}/scripts/health-check.sh" || {
        log_error "Health checks failed"
        return 1
    }
    
    log_success "All health checks passed"
}

# Show deployment summary
show_summary() {
    echo ""
    echo -e "${GREEN}========================================${NC}"
    echo -e "${GREEN}  Deployment Complete${NC}"
    echo -e "${GREEN}========================================${NC}"
    echo ""
    echo "Environment: $ENV"
    echo "RPC Endpoint: http://localhost:9944"
    echo "Jury Service: http://localhost:8080"
    echo "Database: localhost:5432"
    echo ""
    echo "Next steps:"
    echo "  1. Verify deployment: bash ./scripts/health-check.sh"
    echo "  2. Run tests: pytest tests/test_jury_anchoring.py -v"
    echo "  3. Monitor: docker-compose logs -f jury-anchorer"
    echo ""
}

# Main execution
main() {
    echo ""
    echo -e "${BLUE}╔═══════════════════════════════════════════════════════════╗${NC}"
    echo -e "${BLUE}║  Phase 5: Jury Blockchain Anchoring Deployment             ║${NC}"
    echo -e "${BLUE}║  Environment: $ENV                                           ${NC}"
    echo -e "${BLUE}╚═══════════════════════════════════════════════════════════╝${NC}"
    echo ""
    
    check_requirements
    backup_database
    build_pallet
    deploy_services
    wait_for_services
    sleep 5
    run_health_checks
    show_summary
}

# Run main function
main
