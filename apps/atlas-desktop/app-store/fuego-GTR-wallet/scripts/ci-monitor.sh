#!/bin/bash

# CI Monitoring and Auto-Fix Script for FuegoGT Wallet
# This script monitors CI builds, identifies failures, and implements fixes

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Configuration
REPO_OWNER="fuego-wallet"
REPO_NAME="fuego-GTR-wallet"
GITHUB_API="https://api.github.com"
MAX_ITERATIONS=10
CURRENT_ITERATION=1

# Logging function
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

# Check if GitHub CLI is available
check_gh_cli() {
    if ! command -v gh &> /dev/null; then
        error "GitHub CLI (gh) is not installed. Please install it first."
        echo "Visit: https://cli.github.com/"
        return 1
    fi
    
    # Check if authenticated
    if ! gh auth status &> /dev/null; then
        error "GitHub CLI is not authenticated. Please run 'gh auth login'"
        return 1
    fi
    
    return 0
}

# Get latest workflow run status
get_workflow_status() {
    local workflow_name="$1"
    
    log "Checking status for workflow: $workflow_name"
    
    # Get the latest workflow run
    local run_data=$(gh api repos/$REPO_OWNER/$REPO_NAME/actions/workflows/ci.yml/runs \
        --jq '.workflow_runs[0] | {id: .id, status: .status, conclusion: .conclusion, html_url: .html_url}' 2>/dev/null)
    
    if [ -z "$run_data" ]; then
        warning "No workflow runs found for $workflow_name"
        return 1
    fi
    
    echo "$run_data"
}

# Get workflow run logs
get_workflow_logs() {
    local run_id="$1"
    local temp_dir=$(mktemp -d)
    
    log "Downloading logs for run ID: $run_id"
    
    # Download logs
    gh api repos/$REPO_OWNER/$REPO_NAME/actions/runs/$run_id/logs > "$temp_dir/logs.zip" 2>/dev/null || {
        error "Failed to download logs for run $run_id"
        return 1
    }
    
    # Extract logs
    cd "$temp_dir"
    unzip -q logs.zip 2>/dev/null || {
        error "Failed to extract logs"
        return 1
    }
    
    echo "$temp_dir"
}

# Analyze logs for common errors
analyze_logs() {
    local logs_dir="$1"
    local issues=()
    
    log "Analyzing logs in $logs_dir"
    
    # Check for common error patterns
    for log_file in "$logs_dir"/*.txt; do
        if [ -f "$log_file" ]; then
            local os_name=$(basename "$log_file" | cut -d'_' -f1)
            
            # Check for path issues
            if grep -q "No such file or directory.*fuego-tauri" "$log_file"; then
                issues+=("PATH_ISSUE:$os_name:fuego-tauri directory not found")
            fi
            
            # Check for npm ci failures
            if grep -q "npm ci.*failed" "$log_file"; then
                issues+=("NPM_CI_FAILURE:$os_name:npm ci failed")
            fi
            
            # Check for Rust compilation errors
            if grep -q "error\[E[0-9]\+\]" "$log_file"; then
                issues+=("RUST_COMPILE_ERROR:$os_name:Rust compilation failed")
            fi
            
            # Check for dependency issues
            if grep -q "libwebkit2gtk-4.0-dev.*not found" "$log_file"; then
                issues+=("UBUNTU_DEPS:$os_name:Missing webkit2gtk-4.0-dev")
            fi
            
            if grep -q "libwebkit2gtk-4.1-dev.*not found" "$log_file"; then
                issues+=("UBUNTU_DEPS:$os_name:Missing webkit2gtk-4.1-dev")
            fi
            
            # Check for Tauri build failures
            if grep -q "tauri build.*failed" "$log_file"; then
                issues+=("TAURI_BUILD_FAILURE:$os_name:Tauri build failed")
            fi
        fi
    done
    
    printf '%s\n' "${issues[@]}"
}

# Implement fixes based on identified issues
implement_fixes() {
    local issues=("$@")
    local fixes_applied=0
    
    log "Implementing fixes for ${#issues[@]} identified issues"
    
    for issue in "${issues[@]}"; do
        IFS=':' read -r issue_type os_name description <<< "$issue"
        
        case "$issue_type" in
            "PATH_ISSUE")
                log "Fixing path issues in CI workflows"
                fix_path_issues
                ((fixes_applied++))
                ;;
            "NPM_CI_FAILURE")
                log "Fixing npm ci failure for $os_name"
                fix_npm_ci_issues
                ((fixes_applied++))
                ;;
            "UBUNTU_DEPS")
                log "Fixing Ubuntu dependencies"
                fix_ubuntu_dependencies
                ((fixes_applied++))
                ;;
            "TAURI_BUILD_FAILURE")
                log "Fixing Tauri build issues"
                fix_tauri_build_issues
                ((fixes_applied++))
                ;;
            *)
                warning "Unknown issue type: $issue_type"
                ;;
        esac
    done
    
    if [ $fixes_applied -gt 0 ]; then
        success "Applied $fixes_applied fixes"
        return 0
    else
        warning "No fixes were applied"
        return 1
    fi
}

# Fix path issues in workflows
fix_path_issues() {
    local workflow_file="/workspace/.github/workflows/ci.yml"
    
    # Remove incorrect working-directory references
    sed -i '/working-directory: fuego-tauri/d' "$workflow_file"
    
    # Update paths that reference fuego-tauri subdirectory
    sed -i 's|fuego-tauri/src-tauri|src-tauri|g' "$workflow_file"
    sed -i 's|fuego-tauri/package-lock.json|package-lock.json|g' "$workflow_file"
}

# Fix npm ci issues
fix_npm_ci_issues() {
    # Ensure package-lock.json exists and is valid
    if [ ! -f "/workspace/package-lock.json" ]; then
        cd /workspace
        npm install
    fi
}

# Fix Ubuntu dependencies
fix_ubuntu_dependencies() {
    local workflow_file="/workspace/.github/workflows/ci.yml"
    
    # Update Ubuntu dependencies to use webkit2gtk-4.1-dev
    sed -i 's|libwebkit2gtk-4.0-dev|libwebkit2gtk-4.1-dev|g' "$workflow_file"
    
    # Add patchelf if missing
    if ! grep -q "patchelf" "$workflow_file"; then
        sed -i '/librsvg2-dev/a\            patchelf' "$workflow_file"
    fi
}

# Fix Tauri build issues
fix_tauri_build_issues() {
    # Check if Cargo.lock exists
    if [ ! -f "/workspace/src-tauri/Cargo.lock" ]; then
        cd /workspace/src-tauri
        cargo generate-lockfile
    fi
    
    # Update tauri.conf.json if needed
    local tauri_config="/workspace/src-tauri/tauri.conf.json"
    if [ -f "$tauri_config" ]; then
        # Ensure proper configuration
        log "Tauri config exists, checking configuration..."
    fi
}

# Commit and push fixes
commit_and_push_fixes() {
    cd /workspace
    
    # Check if there are changes to commit
    if git diff --quiet && git diff --cached --quiet; then
        log "No changes to commit"
        return 0
    fi
    
    log "Committing and pushing fixes"
    
    git add .
    git commit -m "CI: Auto-fix build issues (iteration $CURRENT_ITERATION)

- Fix path inconsistencies in workflows
- Update Ubuntu dependencies
- Correct working directory references
- Ensure proper npm and cargo configurations

Auto-generated by ci-monitor.sh"
    
    git push origin main
    
    success "Changes committed and pushed"
}

# Wait for workflow to complete
wait_for_workflow() {
    local max_wait=1800  # 30 minutes
    local wait_time=0
    local check_interval=60  # 1 minute
    
    log "Waiting for workflow to complete..."
    
    while [ $wait_time -lt $max_wait ]; do
        local status_data=$(get_workflow_status "ci")
        local status=$(echo "$status_data" | jq -r '.status // "unknown"')
        local conclusion=$(echo "$status_data" | jq -r '.conclusion // "null"')
        
        if [ "$status" = "completed" ]; then
            if [ "$conclusion" = "success" ]; then
                success "Workflow completed successfully!"
                return 0
            else
                error "Workflow completed with conclusion: $conclusion"
                return 1
            fi
        fi
        
        log "Workflow status: $status, waiting..."
        sleep $check_interval
        wait_time=$((wait_time + check_interval))
    done
    
    error "Timeout waiting for workflow to complete"
    return 1
}

# Main monitoring loop
main() {
    log "Starting CI monitoring and auto-fix process"
    log "Repository: $REPO_OWNER/$REPO_NAME"
    
    # Check prerequisites
    if ! check_gh_cli; then
        exit 1
    fi
    
    while [ $CURRENT_ITERATION -le $MAX_ITERATIONS ]; do
        log "=== Iteration $CURRENT_ITERATION/$MAX_ITERATIONS ==="
        
        # Get latest workflow status
        local status_data=$(get_workflow_status "ci")
        if [ $? -ne 0 ]; then
            error "Failed to get workflow status"
            break
        fi
        
        local run_id=$(echo "$status_data" | jq -r '.id')
        local status=$(echo "$status_data" | jq -r '.status')
        local conclusion=$(echo "$status_data" | jq -r '.conclusion // "null"')
        local html_url=$(echo "$status_data" | jq -r '.html_url')
        
        log "Latest run: $html_url"
        log "Status: $status, Conclusion: $conclusion"
        
        # If workflow is successful, we're done
        if [ "$conclusion" = "success" ]; then
            success "All builds are green! 🎉"
            break
        fi
        
        # If workflow failed, analyze and fix
        if [ "$conclusion" = "failure" ]; then
            log "Build failed, analyzing logs..."
            
            local logs_dir=$(get_workflow_logs "$run_id")
            if [ $? -eq 0 ]; then
                local issues=($(analyze_logs "$logs_dir"))
                
                if [ ${#issues[@]} -gt 0 ]; then
                    log "Found ${#issues[@]} issues:"
                    printf '  - %s\n' "${issues[@]}"
                    
                    if implement_fixes "${issues[@]}"; then
                        commit_and_push_fixes
                        
                        log "Fixes applied, waiting for new build..."
                        sleep 120  # Wait 2 minutes for new build to start
                        
                        if wait_for_workflow; then
                            success "Build fixed successfully!"
                            break
                        fi
                    else
                        error "Failed to implement fixes"
                    fi
                else
                    warning "No specific issues identified from logs"
                fi
                
                # Cleanup
                rm -rf "$logs_dir"
            else
                error "Failed to get workflow logs"
            fi
        fi
        
        ((CURRENT_ITERATION++))
        
        if [ $CURRENT_ITERATION -le $MAX_ITERATIONS ]; then
            log "Moving to next iteration..."
            sleep 60  # Wait before next iteration
        fi
    done
    
    if [ $CURRENT_ITERATION -gt $MAX_ITERATIONS ]; then
        error "Maximum iterations reached without success"
        exit 1
    fi
    
    success "CI monitoring completed successfully"
}

# Run main function if script is executed directly
if [[ "${BASH_SOURCE[0]}" == "${0}" ]]; then
    main "$@"
fi