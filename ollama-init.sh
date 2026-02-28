#!/bin/bash

# Ollama Docker Entrypoint
# Initializes with recommended models

set -e

# Start Ollama service in background
/bin/ollama serve &
OLLAMA_PID=$!

# Wait for Ollama to be ready
echo "Waiting for Ollama to be ready..."
for i in {1..30}; do
    if curl -s http://localhost:11434/api/tags > /dev/null 2>&1; then
        echo "Ollama is ready!"
        break
    fi
    echo "Attempt $i/30..."
    sleep 1
done

# Pull models based on environment variable
MODELS=${OLLAMA_INIT_MODELS:-"mistral neural-chat"}

for model in $MODELS; do
    echo "Pulling model: $model"
    /bin/ollama pull "$model" || echo "Warning: Failed to pull $model"
done

# Keep the process running
wait $OLLAMA_PID
