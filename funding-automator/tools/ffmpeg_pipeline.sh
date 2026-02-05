#!/usr/bin/env bash
# Simple local pipeline example for assembling NovaFlux Shorts
# Assumes you have a background clip at /data/assets/bg_loop.mp4 and a TTS binary available (bark/tortoise)

set -euo pipefail

SCRIPT_FILE=${1:-/tmp/nova_script.txt}
ID=${2:-short_$(date +%s)}
OUT_DIR=${3:-/data/staging/videos}

mkdir -p "$OUT_DIR"

VOICE_OUT=/tmp/${ID}.wav

if command -v bark >/dev/null 2>&1; then
  bark --text_file "$SCRIPT_FILE" --out_file "$VOICE_OUT" --voice "NovaFlux"
elif command -v tortoise-tts >/dev/null 2>&1; then
  tortoise-tts --text-file "$SCRIPT_FILE" --out "$VOICE_OUT" --voice "NovaFlux"
else
  echo "No TTS binary found (bark or tortoise-tts). Provide one or install." >&2
  exit 2
fi

BG=/data/assets/bg_loop.mp4
OUT_VIDEO=${OUT_DIR}/${ID}.mp4

ffmpeg -y -stream_loop -1 -i "$BG" -i "$VOICE_OUT" -filter_complex "[0:v]scale=1080:1920,setsar=1[v];[v][1:a]concat=n=1:v=1:a=1[outv][outa]" -map [outv] -map [outa] -c:v libx264 -c:a aac -shortest "$OUT_VIDEO"

ffmpeg -y -i "$OUT_VIDEO" -ss 00:00:00 -vframes 1 "${OUT_DIR}/${ID}.thumb.jpg"

echo "Created $OUT_VIDEO and ${OUT_DIR}/${ID}.thumb.jpg"
