#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
cd "$ROOT_DIR"

echo "Checking Tauri capability scopes..."
CAP_FILES="$(rg --files apps | rg 'src-tauri/capabilities/.*\.json$' || true)"
if [[ -n "${CAP_FILES}" ]]; then
  if rg -n '"shell:allow-(execute|spawn|stdin-write)"' ${CAP_FILES}; then
    echo "ERROR: Broad Tauri shell execution permissions detected in capability files."
    exit 1
  fi
fi

echo "Checking CSP for unsafe-eval in production config..."
if rg -n "unsafe-eval" \
  apps/x3-desktop/src-tauri/tauri.conf.json \
  apps/x3-desktop/index.html; then
  echo "ERROR: unsafe-eval is forbidden in desktop production CSP."
  exit 1
fi

echo "Desktop security guardrails passed."
