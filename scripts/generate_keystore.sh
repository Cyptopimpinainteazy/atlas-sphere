#!/usr/bin/env bash
# scripts/generate_keystore.sh
# Lightweight helper that shows how to generate a wallet keystore on Linux
# This is *template* code for developer convenience. DO NOT use for production key material.

set -euo pipefail

USAGE() {
  cat <<EOF
Usage: $0 <label>

Creates an OpenSSL-encrypted keystore file (AES-256) for a generated private key and writes to ./keystore-<label>.pem
This is a convenience developer helper; it stores unprotected private keys if you choose an empty passphrase.
EOF
}

if [ "$#" -lt 1 ]; then
  USAGE
  exit 1
fi

LABEL="$1"
OUT="keystore-${LABEL}.pem"

# Generate a 32-byte private key (hex) and wrap in PEM for convenience
openssl rand -hex 32 | awk '{print "-----BEGIN PRIVATE KEY-----\n" $0 "\n-----END PRIVATE KEY-----"}' > "/tmp/${LABEL}.key"

# Encrypt with a password-based AES-256 (interactive) so developers can choose a passphrase
openssl enc -aes-256-cbc -salt -in "/tmp/${LABEL}.key" -out "$OUT"
rm -f "/tmp/${LABEL}.key"

cat <<EOF
Keystore written: $OUT
Tip: store keystore securely, or use a hardware wallet / HSM for production.
EOF
