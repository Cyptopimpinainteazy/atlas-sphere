#!/bin/bash
# Script to start all Ralph agents with proper GPU configuration

export OLLAMA_GPU_LAYERS=35
export OLLAMA_NUM_GPU=3
export OLLAMA_SCHED_SPREAD=1
export RALPH_MODE=local

echo "Starting Ralph agents with multi-GPU support..."

# Start atlas-sphere agent
echo "Starting atlas-sphere..."
cd /home/lojak/Desktop/atlas-sphere-master && git checkout ralph/atlas-sphere
cd /home/lojak/ralph-ollama && ./start.sh atlas-sphere &
sleep 2

# Start atlas-defi agent
echo "Starting atlas-defi..."
cd /home/lojak/Desktop/atlas-sphere-master && git checkout ralph/atlas-defi
cd /home/lojak/ralph-ollama && ./start.sh atlas-defi &
sleep 2

# Start atlas-infra agent
echo "Starting atlas-infra..."
cd /home/lojak/Desktop/atlas-sphere-master && git checkout ralph/atlas-infra
cd /home/lojak/ralph-ollama && ./start.sh atlas-infra &
sleep 2

echo "All Ralph agents started!"
echo "Monitor with: tmux ls"
echo "Check status with: cat ~/ralph-ollama/projects/*/status.json"