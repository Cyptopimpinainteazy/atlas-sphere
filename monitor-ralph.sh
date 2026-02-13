#!/bin/bash
# Ralph Autonomous Execution Monitor
# Real-time dashboard to watch Ralph work

while true; do
    clear
    echo "╔════════════════════════════════════════════════════════════╗"
    echo "║        ⚡ Ralph Autonomous Task Executor Monitor ⚡         ║"
    echo "║                 $(date '+%Y-%m-%d %H:%M:%S')                  ║"
    echo "╚════════════════════════════════════════════════════════════╝"
    echo ""
    
    # Show running processes
    echo "📊 ACTIVE PROCESSES:"
    ps aux | grep -E "python3.*ralph|timeout.*ralph" | grep -v grep | awk '{print "  " $2 " | CPU: " $3 "% | MEM: " $4 "% | COMMAND: " $11 " " $12}' || echo "  (none running)"
    echo ""
    
    # Check PRD progress
    if [ -f "/home/lojak/Desktop/atlas-sphere-master/PRD.md" ]; then
        completed=$(grep -c "^\- \[x\]" "/home/lojak/Desktop/atlas-sphere-master/PRD.md" 2>/dev/null || echo "0")
        total=$(grep -c "^\- \[ \]" "/home/lojak/Desktop/atlas-sphere-master/PRD.md" 2>/dev/null || echo "0")
        total=$((completed + total))
        
        if [ "$total" -gt 0 ]; then
            percent=$((completed * 100 / total))
            echo "📈 PRD PROGRESS:"
            echo "  Completed: $completed/$total tasks ($percent%)"
            
            # Simple progress bar
            filled=$((percent / 5))
            empty=$((20 - filled))
            bar="["
            for ((i=0; i<filled; i++)); do bar+="="; done
            for ((i=0; i<empty; i++)); do bar+="-"; done
            bar+="]"
            echo "  $bar $percent%"
        fi
    fi
    echo ""
    
    # Show recent Ralph activity
    echo "📝 RECENT ACTIVITY:"
    if [ -f "/home/lojak/Desktop/atlas-sphere-master/ralph-logs/autonomous-ralph.log" ]; then
        tail -8 "/home/lojak/Desktop/atlas-sphere-master/ralph-logs/autonomous-ralph.log" | sed 's/^/  /'
    else
        echo "  (no log yet)"
    fi
    echo ""
    
    # Show cargo build status
    echo "🔨 BUILD STATUS:"
    if pgrep -f "cargo.*build" > /dev/null; then
        echo "  ✓ Build in progress..."
    else
        echo "  ○ Build idle"
    fi
    echo ""
    
    # Show test status  
    echo "✅ TEST STATUS:"
    if pgrep -f "cargo.*test" > /dev/null; then
        echo "  ✓ Tests running..."
    else
        echo "  ○ Tests idle"
    fi
    echo ""
    
    echo "╔════════════════════════════════════════════════════════════╗"
    echo "║ Refresh every 5s | Press Ctrl+C to exit | Check logs:      ║"
    echo "║ tail -f /tmp/ralph-autonomous.log                          ║"
    echo "╚════════════════════════════════════════════════════════════╝"
    
    sleep 5
done
