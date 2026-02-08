#!/bin/bash
export OLLAMA_GPU_LAYERS=35
export OLLAMA_NUM_GPU=3
export OLLAMA_SCHED_SPREAD=1
export RALPH_MODE=local
cd /home/lojak/Desktop/atlas-sphere-master && git checkout ralph/atlas-infra
cd /home/lojak/ralph-ollama && exec ./start.sh atlas-infra