# Lane 2 — Video Auto‑Forge

Import path: Add the workflow found at `n8n/lane2-video-auto-forge.json` into n8n (Import Workflow). This workflow will:

- Read a staged script JSON from `/data/staging/text.json`
- Run local TTS via a CLI (hooks are provided for `bark` or `tortoise-tts`)
- Assemble a short vertical video using `ffmpeg` and a looping background (`/data/assets/bg_loop.mp4`)
- Write the video + thumbnail to `/data/staging/videos/` and push metadata to `http://localhost:3000/queue/videos` for Lane 3

Quick local test (example):

```bash
# create a simple script file
mkdir -p /data/staging && echo '{"id":"demo1","script":"What if one chain could run every EVM contract — but 10x faster? Dual VM: EVM + SVM. Join testnet — link in bio."}' > /data/staging/text.json
# run the helper script to produce audio+video (requires bark or tortoise-tts, and ffmpeg installed)
./tools/ffmpeg_pipeline.sh /data/staging/text.json demo1 /data/staging/videos
```

Notes:
- Customize the TTS command in `n8n/lane2-video-auto-forge.json` to match your local TTS binary arguments.
- Create `/data/assets/bg_loop.mp4` — a short vertical 1080x1920 loop for background visuals (stock clips or AI-generated frames).
