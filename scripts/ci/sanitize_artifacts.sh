#!/usr/bin/env bash
set -euo pipefail

ARTIFACT_DIR=${1:-artifacts}

if [ ! -d "$ARTIFACT_DIR" ]; then
  echo "No artifact directory found at $ARTIFACT_DIR, nothing to sanitize."
  exit 0
fi

echo "Sanitizing artifacts under $ARTIFACT_DIR"

# Find log/text/json files and attempt to mask common secrets.
# This is intentionally conservative and best-effort — add patterns as needed.
find "$ARTIFACT_DIR" -type f \( -iname '*.log' -o -iname '*.txt' -o -iname '*.json' -o -iname '*.csv' \) | while read -r F; do
  echo "  Sanitizing: $F"
  # Replace long hexs starting with 0x
  sed -E -i 's/0x[0-9a-fA-F]{20,}/0x[REDACTED_HEX]/g' "$F" || true
  # Replace 64-char hex strings (common private key format)
  sed -E -i 's/\b[0-9a-fA-F]{64}\b/[REDACTED_HEX_64]/g' "$F" || true
  # Mask bearer tokens
  sed -E -i 's/(Bearer|bearer) [A-Za-z0-9._-]{10,}/[REDACTED_TOKEN]/g' "$F" || true
  # Mask any lines containing PRIVATE or SECRET (case-insensitive)
  sed -E -i 's/.*(PRIVATE|SECRET|PASSWORD).*/[REDACTED]/Ig' "$F" || true
done

# Remove common env files entirely
find "$ARTIFACT_DIR" -type f -iname '.env' -exec rm -f {} \; -print || true
find "$ARTIFACT_DIR" -type f -iname '*.pem' -exec rm -f {} \; -print || true

echo "Sanitization complete"
