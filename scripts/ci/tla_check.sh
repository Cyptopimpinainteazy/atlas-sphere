#!/usr/bin/env bash
set -euo pipefail

ARTIFACT_DIR="./artifacts"
mkdir -p "$ARTIFACT_DIR"
LOG="$ARTIFACT_DIR/tla-check.log"
: > "$LOG"

echo "Searching for .tla specs (spec/, formal/, root X3.tla)..." | tee -a "$LOG"

# Collect candidate TLA files
FILES=()
# prefer root X3.tla if present
if [ -f X3.tla ]; then
  FILES+=("X3.tla")
fi
# search common spec directories
while IFS= read -r -d $'\0' f; do
  # make path relative to repo root when using docker mount
  rel="${f#$PWD/}"
  FILES+=("$rel")
done < <(find spec formal -type f -name '*.tla' -print0 2>/dev/null || true)

if [ ${#FILES[@]} -eq 0 ]; then
  echo "No TLA files found; skipping Apalache check" | tee -a "$LOG"
  exit 0
fi

EXIT_CODE=0
for f in "${FILES[@]}"; do
  echo "=== Checking $f ===" | tee -a "$LOG"
  if docker run --rm -v "$PWD":/src informalsystems/apalache:latest apalache-mc check "/src/$f" 2>&1 | tee -a "$LOG"; then
    echo "=== $f: PASSED ===" | tee -a "$LOG"
  else
    echo "=== $f: FAILED ===" | tee -a "$LOG"
    EXIT_CODE=1
  fi
  echo "" | tee -a "$LOG"
done

exit $EXIT_CODE
