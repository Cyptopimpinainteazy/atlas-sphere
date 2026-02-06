#!/usr/bin/env bash
set -euo pipefail

ARTIFACT_DIR="./artifacts"
mkdir -p "$ARTIFACT_DIR"
LOG="$ARTIFACT_DIR/tla-check.log"
: > "$LOG"

echo "Searching for .tla specs (repo-wide) and excluding .git, node_modules, target..." | tee -a "$LOG"

# Collect candidate TLA files (repo-wide)
FILES=()
while IFS= read -r -d $'\0' f; do
  # make path relative to repo root when using docker mount
  rel="${f#$PWD/}"
  FILES+=("$rel")
done < <(find . -type f -name '*.tla' -not -path './.git/*' -not -path './node_modules/*' -not -path './target/*' -print0)

# Optional: prefer top-level X3.tla if present
if [ -f ./X3.tla ]; then
  # move to front if not already first
  for i in "${!FILES[@]}"; do
    if [ "${FILES[$i]}" = "./X3.tla" ] || [ "${FILES[$i]}" = "X3.tla" ]; then
      unset 'FILES[$i]'
      break
    fi
  done
  FILES=("X3.tla" "${FILES[@]}")
fi

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
