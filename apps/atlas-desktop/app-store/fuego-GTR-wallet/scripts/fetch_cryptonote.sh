#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
CRYPTO_DIR="$ROOT_DIR/src-tauri/cryptonote"
UPSTREAM_URL="https://github.com/ColinRitman/fuego"

echo "[fetch_cryptonote] Root: $ROOT_DIR"
echo "[fetch_cryptonote] Target: $CRYPTO_DIR"

mkdir -p "$CRYPTO_DIR"

TMP_DIR="$(mktemp -d)"
trap 'rm -rf "$TMP_DIR"' EXIT

echo "[fetch_cryptonote] Cloning upstream..."
git clone --depth=1 "$UPSTREAM_URL" "$TMP_DIR/upstream"

# Copy only cryptonote-related sources (adjust path if upstream layout differs)
if [ -d "$TMP_DIR/upstream/src/cryptonote" ]; then
  SRC_PATH="$TMP_DIR/upstream/src/cryptonote"
elif [ -d "$TMP_DIR/upstream/cryptonote" ]; then
  SRC_PATH="$TMP_DIR/upstream/cryptonote"
else
  # Try to locate WalletLegacy headers as anchor
  CANDIDATE=$(find "$TMP_DIR/upstream" -type d -path "*/WalletLegacy" | head -n1 || true)
  if [ -n "${CANDIDATE:-}" ]; then
    SRC_PATH="$(dirname "$(dirname "$CANDIDATE")")"
  fi
fi

if [ -z "${SRC_PATH:-}" ] || [ ! -d "$SRC_PATH" ]; then
  echo "[fetch_cryptonote] Could not locate cryptonote sources in upstream repo (looked for src/cryptonote, cryptonote, WalletLegacy)." >&2
  exit 1
fi

echo "[fetch_cryptonote] Using source path: $SRC_PATH"
if command -v rsync >/dev/null 2>&1; then
  rsync -a --delete "$SRC_PATH/" "$CRYPTO_DIR/"
else
  echo "[fetch_cryptonote] rsync not found, using cp -a fallback"
  rm -rf "$CRYPTO_DIR"/*
  mkdir -p "$CRYPTO_DIR"
  cp -a "$SRC_PATH/." "$CRYPTO_DIR/"
fi

echo "[fetch_cryptonote] Sync complete. Files available in $CRYPTO_DIR"

