#!/bin/bash
# Autonomous Ralph Task Executor
# Runs Ralph completely autonomously with logging and monitoring

set -e

PROJECT_DIR="/home/lojak/Desktop/atlas-sphere-master"
LOG_DIR="${PROJECT_DIR}/ralph-logs"
RALPH_LOG="${LOG_DIR}/autonomous-ralph.log"
PID_FILE="${LOG_DIR}/ralph.pid"

# Create log directory
mkdir -p "$LOG_DIR"

# Function to log
log_msg() {
    local timestamp=$(date '+%Y-%m-%d %H:%M:%S')
    echo "[$timestamp] $1" | tee -a "$RALPH_LOG"
}

# Function to monitor and restart
monitor_and_restart() {
    log_msg "🚀 Starting autonomous Ralph executor..."
    
    while true; do
        # Check if Ralph is still running
        if [ -f "$PID_FILE" ]; then
            local pid=$(cat "$PID_FILE")
            if kill -0 "$pid" 2>/dev/null; then
                log_msg "✓ Ralph running (PID: $pid)"
                sleep 30
            else
                log_msg "⚠️  Ralph process died (PID: $pid), restarting..."
                rm -f "$PID_FILE"
                start_ralph
            fi
        else
            log_msg "⚠️  No PID file found, starting Ralph..."
            start_ralph
        fi
    done
}

# Start Ralph
start_ralph() {
    log_msg "Starting Ralph task executor..."
    
    # Export environment variables for multi-GPU support
    export RALPH_MODE=local
    export OLLAMA_GPU_LAYERS=35
    export OLLAMA_NUM_GPU=3
    export OLLAMA_SCHED_SPREAD=1
    
    cd "$PROJECT_DIR"
    
    # Start Ralph Python executor in background
    python3 ralph.py >> "$RALPH_LOG" 2>&1 &
    local ralph_pid=$!
    echo "$ralph_pid" > "$PID_FILE"
    
    log_msg "Ralph started with PID: $ralph_pid"
    
    # Also start the local Ralph agent if available
    if [ -d "/home/lojak/ralph-ollama" ]; then
        log_msg "Starting local Ralph agents..."
        cd /home/lojak/ralph-ollama
        
        # Start each agent in background
        RALPH_MODE=local ./start.sh atlas-sphere >> "$RALPH_LOG" 2>&1 &
        RALPH_MODE=local ./start.sh atlas-defi >> "$RALPH_LOG" 2>&1 &
        RALPH_MODE=local ./start.sh atlas-infra >> "$RALPH_LOG" 2>&1 &
        
        log_msg "Local Ralph agents started"
    fi
}

# Build the project during Ralph execution
build_and_test() {
    log_msg "Running cargo build and tests..."
    
    cd "$PROJECT_DIR"
    
    # Build
    if cargo build --release --workspace >> "$RALPH_LOG" 2>&1; then
        log_msg "✓ Build successful"
    else
        log_msg "⚠️  Build failed, fixing issues..."
    fi
    
    # Run tests
    if cargo test --workspace >> "$RALPH_LOG" 2>&1; then
        log_msg "✓ Tests passed"
    else
        log_msg "⚠️  Some tests failed"
    fi
}

# Check PRD progress
check_progress() {
    local completed=$(grep -c "^\- \[x\]" "$PROJECT_DIR/PRD.md" 2>/dev/null || echo "0")
    local total=$(grep -c "^\- \[ \]" "$PROJECT_DIR/PRD.md" 2>/dev/null || echo "0")
    total=$((completed + total))
    
    if [ "$total" -gt 0 ]; then
        local percent=$((completed * 100 / total))
        log_msg "📊 Progress: $completed/$total tasks complete ($percent%)"
    fi
}

# Cleanup
cleanup() {
    log_msg "🛑 Stopping autonomous Ralph..."
    if [ -f "$PID_FILE" ]; then
        local pid=$(cat "$PID_FILE")
        kill "$pid" 2>/dev/null || true
        rm -f "$PID_FILE"
    fi
    log_msg "Ralph stopped"
}

trap cleanup EXIT

# Main execution
log_msg "═══════════════════════════════════════════════════════════"
log_msg "Autonomous Ralph Task Executor Started"
log_msg "Project: $PROJECT_DIR"
log_msg "Log file: $RALPH_LOG"
log_msg "═══════════════════════════════════════════════════════════"

# Start Ralph
start_ralph

# Build and test while Ralph runs
log_msg "Running build and tests in parallel..."
build_and_test &
BUILD_PID=$!

# Monitor Ralph execution
while true; do
    if [ -d "$LOG_DIR" ]; then
        check_progress
    fi
    
    # Check if all PRD tasks are done
    remaining=$(grep -c "^\- \[ \]" "$PROJECT_DIR/PRD.md" 2>/dev/null || echo "1")
    if [ "$remaining" -eq 0 ]; then
        log_msg "✅ All PRD tasks complete!"
        log_msg "Final check: running full test suite..."
        cd "$PROJECT_DIR"
        cargo test --workspace --release >> "$RALPH_LOG" 2>&1
        log_msg "✅ AUTOMATION COMPLETE - All tasks done and tests passing!"
        break
    fi
    
    sleep 60
done
