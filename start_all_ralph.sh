#!/bin/bash
# Script to start all Ralph agents with proper GPU configuration

export OLLAMA_GPU_LAYERS=35
export OLLAMA_NUM_GPU=3
export OLLAMA_SCHED_SPREAD=1
export RALPH_MODE=local

echo "Starting Ralph agents with multi-GPU support..."

# Start x3-chain agent
echo "Starting x3-chain..."
cd /home/lojak/Desktop/x3-chain-master && git checkout ralph/x3-chain
cd /home/lojak/ralph-ollama && ./start.sh x3-chain &
sleep 2

# Start x3-defi agent
echo "Starting x3-defi..."
cd /home/lojak/Desktop/x3-chain-master && git checkout ralph/x3-defi
cd /home/lojak/ralph-ollama && ./start.sh x3-defi &
sleep 2

# Start x3-infra agent
echo "Starting x3-infra..."
cd /home/lojak/Desktop/x3-chain-master && git checkout ralph/x3-infra
cd /home/lojak/ralph-ollama && ./start.sh x3-infra &
sleep 2

echo "All Ralph agents started!"
echo "Monitor with: tmux ls"
echo "Check status with: cat ~/ralph-ollama/projects/*/status.json"