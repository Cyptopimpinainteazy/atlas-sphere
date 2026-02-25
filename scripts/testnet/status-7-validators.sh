#!/usr/bin/env bash
set -euo pipefail

BASE_RPC_PORT="${BASE_RPC_PORT:-9944}"
COUNT="${COUNT:-7}"

printf "%-5s %-7s %-9s %-6s %-12s %s\n" "NODE" "RPC" "SYNCING" "PEERS" "BLOCK" "HASH"

for i in $(seq 0 $((COUNT - 1))); do
  port=$((BASE_RPC_PORT + i))
  node=$((i + 1))
  url="http://127.0.0.1:${port}"

  health=$(curl -s --max-time 1 -H "Content-Type: application/json" \
    -d '{"jsonrpc":"2.0","id":1,"method":"system_health","params":[]}' \
    "$url" || true)

  if [[ -z "$health" ]]; then
    printf "%-5s %-7s %-9s %-6s %-12s %s\n" "$node" "$port" "DOWN" "-" "-" "-"
    continue
  fi

  header=$(curl -s --max-time 1 -H "Content-Type: application/json" \
    -d '{"jsonrpc":"2.0","id":1,"method":"chain_getHeader","params":[]}' \
    "$url" || true)

  hash=$(curl -s --max-time 1 -H "Content-Type: application/json" \
    -d '{"jsonrpc":"2.0","id":1,"method":"chain_getBlockHash","params":[]}' \
    "$url" || true)

  NODE="$node" PORT="$port" HEALTH="$health" HEADER="$header" HASH="$hash" python - <<'PY'
import json
import os
import sys

health_raw = os.environ["HEALTH"]
header_raw = os.environ.get("HEADER", "")
hash_raw = os.environ.get("HASH", "")

def parse_json(raw: str):
    try:
        return json.loads(raw)
    except Exception:
        return None

try:
    health = json.loads(health_raw)
except Exception:
    if os.environ.get("DEBUG") == "1":
        print("DEBUG health:", health_raw)
    print("DOWN")
    sys.exit(0)

if "result" not in health:
    if os.environ.get("DEBUG") == "1":
        print("DEBUG health:", health_raw)
    print("DOWN")
    sys.exit(0)

is_syncing = health["result"].get("isSyncing", True)
peers = health["result"].get("peers", 0)

block = health["result"].get("bestBlock", None)
if block is None:
    header = parse_json(header_raw)
    if header and "result" in header and header["result"]:
        num = header["result"].get("number")
        try:
            if isinstance(num, str) and num.startswith("0x"):
                block = int(num, 16)
            else:
                block = int(num)
        except Exception:
            block = "-"
    else:
        block = "-"

hash_ = "-"
block_hash = parse_json(hash_raw)
if block_hash and "result" in block_hash and block_hash["result"]:
    hash_ = block_hash["result"]

node = os.environ.get("NODE")
port = os.environ.get("PORT")

print(f"{node:<5} {port:<7} {str(is_syncing):<9} {peers:<6} {block:<12} {hash_}")
PY
done
