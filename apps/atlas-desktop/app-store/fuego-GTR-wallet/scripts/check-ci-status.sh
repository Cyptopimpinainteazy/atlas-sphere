#!/bin/bash

# Simple CI Status Checker
# This script checks the status of the latest CI builds

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

log() {
    echo -e "${BLUE}[$(date +'%Y-%m-%d %H:%M:%S')]${NC} $1"
}

error() {
    echo -e "${RED}[ERROR]${NC} $1" >&2
}

success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

# Check if we're in a git repository
if ! git rev-parse --git-dir > /dev/null 2>&1; then
    error "Not in a git repository"
    exit 1
fi

# Get current branch
CURRENT_BRANCH=$(git rev-parse --abbrev-ref HEAD)
log "Current branch: $CURRENT_BRANCH"

# Get latest commit
LATEST_COMMIT=$(git rev-parse HEAD)
COMMIT_MESSAGE=$(git log -1 --pretty=format:"%s")
log "Latest commit: ${LATEST_COMMIT:0:8} - $COMMIT_MESSAGE"

# Check if GitHub CLI is available
if command -v gh &> /dev/null; then
    log "Checking CI status using GitHub CLI..."
    
    # Get workflow runs for current branch
    WORKFLOW_RUNS=$(gh api repos/:owner/:repo/actions/runs --jq ".workflow_runs[] | select(.head_branch == \"$CURRENT_BRANCH\") | select(.head_sha == \"$LATEST_COMMIT\") | {name: .name, status: .status, conclusion: .conclusion, html_url: .html_url}" 2>/dev/null || echo "[]")
    
    if [ "$WORKFLOW_RUNS" = "[]" ] || [ -z "$WORKFLOW_RUNS" ]; then
        warning "No CI runs found for current commit. The build may not have started yet."
        log "Wait a few minutes and try again, or check manually at: https://github.com/$(gh repo view --json owner,name --jq '.owner.login + "/" + .name')/actions"
        exit 0
    fi
    
    echo "$WORKFLOW_RUNS" | jq -r '. | "Workflow: \(.name), Status: \(.status), Conclusion: \(.conclusion // "pending"), URL: \(.html_url)"' | while read -r line; do
        if echo "$line" | grep -q "Conclusion: success"; then
            success "$line"
        elif echo "$line" | grep -q "Conclusion: failure"; then
            error "$line"
        elif echo "$line" | grep -q "Status: in_progress\|Status: queued"; then
            warning "$line"
        else
            log "$line"
        fi
    done
    
    # Summary
    SUCCESS_COUNT=$(echo "$WORKFLOW_RUNS" | jq -r '. | select(.conclusion == "success")' | wc -l)
    FAILURE_COUNT=$(echo "$WORKFLOW_RUNS" | jq -r '. | select(.conclusion == "failure")' | wc -l)
    IN_PROGRESS_COUNT=$(echo "$WORKFLOW_RUNS" | jq -r '. | select(.status == "in_progress" or .status == "queued")' | wc -l)
    TOTAL_COUNT=$(echo "$WORKFLOW_RUNS" | jq -r '.' | wc -l)
    
    echo ""
    log "=== CI Status Summary ==="
    success "✅ Successful: $SUCCESS_COUNT"
    error "❌ Failed: $FAILURE_COUNT" 
    warning "🔄 In Progress: $IN_PROGRESS_COUNT"
    log "📊 Total workflows: $TOTAL_COUNT"
    
    if [ "$FAILURE_COUNT" -gt 0 ]; then
        echo ""
        error "Some builds have failed. Check the logs above for details."
        log "You can run the CI monitoring script to auto-fix issues:"
        log "  ./scripts/ci-monitor.sh"
        exit 1
    elif [ "$IN_PROGRESS_COUNT" -gt 0 ]; then
        echo ""
        warning "Builds are still in progress. Check back later."
        exit 0
    elif [ "$SUCCESS_COUNT" -gt 0 ]; then
        echo ""
        success "🎉 All builds are green!"
        exit 0
    fi
    
else
    warning "GitHub CLI not found. Install it from https://cli.github.com/ for automated status checking."
    log "Manual check: Visit https://github.com/fuego-wallet/fuego-GTR-wallet/actions"
fi

log "CI status check completed."