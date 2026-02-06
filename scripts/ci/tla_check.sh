#!/usr/bin/env bash
set -euo pipefail

ARTIFACT_DIR="./artifacts"
mkdir -p "$ARTIFACT_DIR"

if [ -f X3.tla ]; then
  echo "Running Apalache on X3.tla"
  docker run --rm -v "$PWD":/src informalsystems/apalache:latest apalache-mc check /src/X3.tla 2>&1 | tee "$ARTIFACT_DIR/tla-check.log"
  exit ${PIPESTATUS[0]}
elif [ -f spec/X3.tla ]; then
  echo "Running Apalache on spec/X3.tla"
  docker run --rm -v "$PWD":/src informalsystems/apalache:latest apalache-mc check /src/spec/X3.tla 2>&1 | tee "$ARTIFACT_DIR/tla-check.log"
  exit ${PIPESTATUS[0]}
else
  echo "X3.tla not found; skipping Apalache check" | tee "$ARTIFACT_DIR/tla-check.log"
  exit 0
fi
